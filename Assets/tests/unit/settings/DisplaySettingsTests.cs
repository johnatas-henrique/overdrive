using System;
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using Overdrive.Settings.Core;

namespace Overdrive.Settings.Tests
{
    /// <summary>
    /// Unit tests for Story 005 (Display Confirm &amp; Quality Presets): the
    /// <see cref="DisplayConfirmGate"/> (15s timer, baseline/restore, focus-loss rollback,
    /// typed rejection), <see cref="DisplayStateResolver"/> (nearest-supported + fullscreen
    /// conversion), <see cref="QualityPresetApplier"/> mapping table, and
    /// <see cref="DisplaySettingsOrchestrator"/> (AC-DR6 apply-before-SetValue ordering,
    /// AC-DR7 VSync → Custom). Fakes for the display hardware, focus source, and applier.
    /// </summary>
    public class DisplaySettingsTests
    {
        // ------------------------------------------------------------------ //
        // Fakes
        // ------------------------------------------------------------------ //

        private sealed class FakeStore : IPlayerPrefsStore
        {
            public readonly Dictionary<string, string> Data = new Dictionary<string, string>();
            public string GetString(string key) => Data.TryGetValue(key, out string v) ? v : null;
            public bool HasKey(string key) => Data.ContainsKey(key);
            public void SetString(string key, string value) => Data[key] = value;
            public void Save() { }
        }

        private sealed class FakeLifecycleContext : ISettingsLifecycleContext
        {
            public bool CanOpenSettings { get; set; } = true;
            public bool IsDifficultyEditable { get; set; } = true;
        }

        /// <summary>Deterministic display hardware fake — drives the gate and orchestrator.</summary>
        private sealed class FakeDisplayApi : IDisplayApi
        {
            public IReadOnlyList<DisplayState> SupportedStates { get; set; } = Array.Empty<DisplayState>();
            public DisplayState CurrentStateValue { get; set; } = new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow);
            public DisplayState CurrentState => CurrentStateValue;

            public bool TryResolveResult { get; set; } = true;
            public DisplayState ResolvedState { get; set; }
            public int TryResolveCalls { get; private set; }

            public DisplayPreviewResult ApplyPreviewResult { get; set; } = DisplayPreviewResult.Applied;
            public readonly List<DisplayState> AppliedStates = new List<DisplayState>();

            public int RestoreCalls { get; private set; }
            public readonly List<DisplayState> RestoredStates = new List<DisplayState>();

            public event Action<string> Warning;
            public readonly List<string> Warnings = new List<string>();

            /// <summary>Chronological operation log — used to assert warning-before-apply ordering.</summary>
            public readonly List<string> EventLog = new List<string>();

            public bool TryResolveRequested(DisplayState requested, out DisplayState resolved)
            {
                EventLog.Add("resolve");
                TryResolveCalls++;
                if (TryResolveResult) resolved = ResolvedState.Equals(default(DisplayState)) ? requested : ResolvedState;
                else resolved = default;
                if (TryResolveResult && !DisplayStateResolver.SameState(resolved, requested))
                {
                    EventLog.Add("warning");
                    Warnings.Add($"Fallback to {resolved.Width}x{resolved.Height}");
                    Warning?.Invoke(Warnings[Warnings.Count - 1]);
                }
                return TryResolveResult;
            }

            public DisplayPreviewResult ApplyPreview(DisplayState resolved)
            {
                EventLog.Add("apply");
                AppliedStates.Add(resolved);
                if (ApplyPreviewResult == DisplayPreviewResult.Applied)
                {
                    CurrentStateValue = resolved; // stateful fake: a successful preview CHANGES the current state (QA R3 F1)
                }
                return ApplyPreviewResult;
            }

            public void Restore(DisplayState previousState)
            {
                EventLog.Add("restore");
                RestoreCalls++;
                RestoredStates.Add(previousState);
                CurrentStateValue = previousState; // stateful fake: restore reverts the current state (QA R3 F1)
            }
        }

        private sealed class FakeFocusSource : IFocusChangeSource
        {
            public event Action<bool> FocusChanged;
            public int SubscriberCount => FocusChanged?.GetInvocationList().Length ?? 0;
            public void RaiseFocus(bool focused) => FocusChanged?.Invoke(focused);
        }

        /// <summary>Deterministic applier fake — records apply calls and the ordering.</summary>
        private sealed class FakeQualityPresetApplier : IQualityPresetApplier
        {
            public QualityPresetMapping Mapping { get; set; } =
                new QualityPresetMapping(QualityPresetId.Medium, 0.85f, VfxDensityLevel.Medium, ShadowLevel.Soft, MSAASamples.X2, AnisotropicLevel.ForcedOn);
            public ApplyStatus ApplyStatus { get; set; } = ApplyStatus.Applied;
            public QualityPresetId ActivePreset { get; private set; } = QualityPresetId.Medium;
            public readonly List<QualityPresetMapping> AppliedMappings = new List<QualityPresetMapping>();
            public int MarkCustomCalls { get; private set; }
            public event Action<QualityPresetMapping> PresetApplied;
            public readonly List<QualityPresetMapping> PublishedMappings = new List<QualityPresetMapping>();

            public QualityPresetMapping ResolveMapping(QualityPresetId id)
            {
                ResolveCalls.Add(id);
                // Mirrors the real applier: ANY id outside Low..Ultra throws (Custom has no
                // mapping, undefined values too) — QA R11 F2.
                if (id != QualityPresetId.Low
                    && id != QualityPresetId.Medium
                    && id != QualityPresetId.High
                    && id != QualityPresetId.Ultra)
                {
                    throw new ArgumentOutOfRangeException(nameof(id));
                }
                return Mapping;
            }
            public readonly List<QualityPresetId> ResolveCalls = new List<QualityPresetId>();
            public Action OnApply;
            public ApplyStatus ApplyPreset(QualityPresetMapping mapping)
            {
                OnApply?.Invoke();
                AppliedMappings.Add(mapping);
                if (ApplyStatus == ApplyStatus.Applied)
                {
                    ActivePreset = mapping.PresetId;
                    PublishedMappings.Add(mapping);
                    PresetApplied?.Invoke(mapping);
                }
                return ApplyStatus;
            }
            public void MarkCustomOverride() { MarkCustomCalls++; ActivePreset = QualityPresetId.Custom; }
        }

        private static SettingsBlobService NewBlobService(IPlayerPrefsStore store) =>
            new SettingsBlobService(new SettingsPersistence(store));

        private static SettingsEditSession Open(IPlayerPrefsStore store, FakeLifecycleContext lifecycle, IDisplayConfirmGate gate, out SettingsOpenResult result)
            => SettingsEditSession.TryOpen(NewBlobService(store), lifecycle, gate, null, null, out result);

        // ------------------------------------------------------------------ //
        // DisplayStateResolver — nearest-supported + conversion
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_DR1_EmptySupportedListResolvesFalse()
        {
            var requested = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow);
            Assert.That(DisplayStateResolver.TryResolveNearest(requested, Array.Empty<DisplayState>(), out _), Is.False);
        }

        [Test]
        public void AC_DR1_EmptyAdapterListRejectsWithoutPreviewOrPersistence()
        {
            // QL-TEST-COVERAGE gap 1: the empty-supported-list contract END-TO-END — the
            // adapter's TryResolveRequested returns false (no candidate), the orchestrator
            // rejects BEFORE touching the session: no PrepareDisplayState, no SetValue, no
            // timer, no preview, no persistence.
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi
            {
                SupportedStates = Array.Empty<DisplayState>(), // empty adapter list
                TryResolveResult = false, // adapter reports no candidate
                ApplyPreviewResult = DisplayPreviewResult.RejectedNoSupported
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);
            DisplayData before = session.Working.Display;

            bool applied = orchestrator.ApplyDisplay(
                new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow), session);

            Assert.That(applied, Is.False, "No supported state — rejected.");
            Assert.That(gate.IsActive, Is.False, "No timer starts.");
            Assert.That(displayApi.AppliedStates.Count, Is.EqualTo(0), "No preview applied.");
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(0), "Nothing to restore.");
            Assert.That(session.Working.Display, Is.EqualTo(before), "Working unchanged — no candidate entered the session.");
            Assert.That(store.Data.Count, Is.EqualTo(0), "Zero persistence calls.");
        }

        [Test]
        public void AC_DR1_ExactMatchResolvesItself()
        {
            var supported = new List<DisplayState>
            {
                new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow),
                new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow)
            };
            var requested = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow);
            Assert.That(DisplayStateResolver.TryResolveNearest(requested, supported, out var resolved), Is.True);
            Assert.That(resolved.Width, Is.EqualTo(1280));
            Assert.That(resolved.Height, Is.EqualTo(720));
        }

        [Test]
        public void AC_DR2_AllCandidatesLargerPicksMinimumAbsoluteAreaDifference()
        {
            // Both candidates are larger than requested — the smallest absolute area
            // difference wins (no special upscale rule; Story 005 R5 finding 5).
            var supported = new List<DisplayState>
            {
                new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow), // area 2073600, diff from 1280x720 (921600) = 1152000
                new DisplayState(1600, 900, 60, 1, FullScreenMode.FullScreenWindow)   // area 1440000, diff = 518400 → wins
            };
            var requested = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow);
            Assert.That(DisplayStateResolver.TryResolveNearest(requested, supported, out var resolved), Is.True);
            Assert.That(resolved.Width, Is.EqualTo(1600));
        }

        [Test]
        public void AC_DR1_NearestPicksSmallestAbsoluteAreaDistanceBothSides()
        {
            // QA R4: candidates on BOTH sides of the request — the smallest ABSOLUTE area
            // distance wins. A clamped/directional distance (e.g. Math.Max(0, requestedArea - area))
            // would wrongly pick the larger candidate.
            var supported = new List<DisplayState>
            {
                new DisplayState(1600, 900, 60, 1, FullScreenMode.FullScreenWindow), // area 1440000, diff from 1920x1080 (2073600) = 633600
                new DisplayState(2560, 1080, 60, 1, FullScreenMode.FullScreenWindow) // area 2764800, diff = 691200 → loses
            };
            var requested = new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow);
            Assert.That(DisplayStateResolver.TryResolveNearest(requested, supported, out var resolved), Is.True);
            Assert.That(resolved.Width, Is.EqualTo(1600), "1600x900 wins by smaller absolute area distance.");
        }

        [Test]
        public void AC_DR1_EqualAreaTieBreaksLexicographicallyByTuple()
        {
            // Same area (1920x1080 == 2160x960); lexicographic by (Width, Height, ...) → 1920 first.
            var supported = new List<DisplayState>
            {
                new DisplayState(2160, 960, 60, 1, FullScreenMode.FullScreenWindow),
                new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow)
            };
            var requested = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow);
            Assert.That(DisplayStateResolver.TryResolveNearest(requested, supported, out var resolved), Is.True);
            Assert.That(resolved.Width, Is.EqualTo(1920));
        }

        [Test]
        public void AC_DR1_EqualAreaTieBreaksByRefreshRateLexicographically()
        {
            // QA R3 F3: identical width/height AND area — the lexicographically smaller refresh
            // tuple must win. Removing the refresh comparison from IsLexicographicallyLess would
            // pass the width/height-only test above but fail here.
            var supported = new List<DisplayState>
            {
                new DisplayState(1920, 1080, 120, 1, FullScreenMode.FullScreenWindow),
                new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow) // smaller numerator → wins
            };
            var requested = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow);
            Assert.That(DisplayStateResolver.TryResolveNearest(requested, supported, out var resolved), Is.True);
            Assert.That(resolved.RefreshRateNumerator, Is.EqualTo(60), "Smaller refresh numerator wins the tie-break.");
        }

        [Test]
        public void AC_DR1_EqualAreaTieBreaksByDenominatorThenModeLexicographically()
        {
            // QA R3 F3: same numerator — denominator decides; then the mode decides.
            var supported = new List<DisplayState>
            {
                new DisplayState(1920, 1080, 120, 2, FullScreenMode.Windowed),
                new DisplayState(1920, 1080, 120, 1, FullScreenMode.Windowed) // smaller denominator → wins
            };
            var requested = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow);
            Assert.That(DisplayStateResolver.TryResolveNearest(requested, supported, out var resolved), Is.True);
            Assert.That(resolved.RefreshRateDenominator, Is.EqualTo(1), "Smaller denominator wins the tie-break.");

            var byMode = new List<DisplayState>
            {
                new DisplayState(1920, 1080, 60, 1, FullScreenMode.Windowed),        // (int)3
                new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow) // (int)1 → wins
            };
            Assert.That(DisplayStateResolver.TryResolveNearest(requested, byMode, out var resolvedMode), Is.True);
            Assert.That(resolvedMode.ScreenMode, Is.EqualTo(FullScreenMode.FullScreenWindow), "Smaller mode int wins the tie-break.");
        }

        [Test]
        public void FullScreenConversion_CanonicalMappingBothDirections()
        {
            Assert.That(DisplayStateResolver.ToFullScreenMode(0), Is.EqualTo(FullScreenMode.Windowed));
            Assert.That(DisplayStateResolver.ToFullScreenMode(1), Is.EqualTo(FullScreenMode.ExclusiveFullScreen));
            Assert.That(DisplayStateResolver.ToFullScreenMode(2), Is.EqualTo(FullScreenMode.FullScreenWindow));
            // Round-trip.
            Assert.That(DisplayStateResolver.ToIntMode(DisplayStateResolver.ToFullScreenMode(0)), Is.EqualTo(0));
            Assert.That(DisplayStateResolver.ToIntMode(DisplayStateResolver.ToFullScreenMode(1)), Is.EqualTo(1));
            Assert.That(DisplayStateResolver.ToIntMode(DisplayStateResolver.ToFullScreenMode(2)), Is.EqualTo(2));
        }

        [Test]
        public void FullScreenConversion_NonAlignedConventionsAreExplicit()
        {
            // The int and enum conventions are INVERTED: int 0=Windowed vs enum 0=Exclusive.
            // A direct cast of 1 (FullScreen) would yield FullScreenWindow (1) instead of
            // ExclusiveFullScreen (0) — the canonical conversion must be used.
            Assert.That((int)DisplayStateResolver.ToFullScreenMode(1), Is.EqualTo(0)); // 1 → ExclusiveFullScreen (0)
            Assert.That((int)DisplayStateResolver.ToFullScreenMode(2), Is.EqualTo(1)); // 2 → FullScreenWindow (1)
        }

        [Test]
        public void AC_DR2_UnsupportedCandidateEmitsWarningBeforeDisplayConfirm()
        {
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            // Requested 640x480 resolves to a DIFFERENT supported state (fallback) — the adapter
            // emits its own Warning, the orchestrator re-routes it to the UI sink BEFORE the
            // gate applies (warning ordering, Story 005 R5 finding 2).
            var displayApi = new FakeDisplayApi
            {
                TryResolveResult = true,
                ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);
            var warnings = new List<string>();
            orchestrator.Warning += warnings.Add;

            bool ok = orchestrator.ApplyDisplay(
                new DisplayState(640, 480, 60, 1, FullScreenMode.FullScreenWindow), session);

            Assert.That(ok, Is.True);
            Assert.That(warnings.Count, Is.EqualTo(1), "Fallback warning raised exactly once (orchestrator re-route).");
            Assert.That(displayApi.EventLog, Is.EqualTo(new[] { "resolve", "warning", "apply" }),
                "Warning emitted BEFORE the gate applies (DR2 ordering).");
            Assert.That(displayApi.AppliedStates[0].Width, Is.EqualTo(1280), "The RESOLVED state is applied — never the unsupported requested 640x480.");
            Assert.That(displayApi.AppliedStates[0].Height, Is.EqualTo(720));
            Assert.That(displayApi.AppliedStates[0].RefreshRateNumerator, Is.EqualTo(60), "Complete resolved state applied (refresh).");
            Assert.That(displayApi.AppliedStates[0].ScreenMode, Is.EqualTo(FullScreenMode.FullScreenWindow), "Complete resolved state applied (mode).");
            Assert.That(session.HasPendingDisplayConfirm, Is.True, "Fallback proceeds INTO DisplayConfirm (DR2).");
            Assert.That(displayApi.AppliedStates.Count, Is.EqualTo(1), "Exactly one apply call (gate reachability).");
        }

        // ------------------------------------------------------------------ //
        // DisplayConfirmGate — timer, baseline/restore, focus loss, rejection
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_DR3_ValidCandidateOpensConfirmationAndSessionRejectsApply()
        {
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi
            {
                TryResolveResult = true,
                ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);

            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);
            bool ok = orchestrator.ApplyDisplay(
                new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow), session);

            Assert.That(ok, Is.True);
            Assert.That(displayApi.AppliedStates.Count, Is.EqualTo(1));
            Assert.That(displayApi.AppliedStates[0].Width, Is.EqualTo(1280));
            Assert.That(displayApi.AppliedStates[0].RefreshRateNumerator, Is.EqualTo(60), "Prepared physical state (refresh-rate) must be used verbatim.");
            Assert.That(session.HasPendingDisplayConfirm, Is.True);
            Assert.That(session.Apply(), Is.EqualTo(ApplyResult.DisplayConfirmPending));
        }

        [Test]
        public void AC_DR3_RepeatedTickDrivesTimerTowardTimeout()
        {
            // Distinct baseline (2560x1440@144 Exclusive) so the restored value is provably the
            // EXACT pre-preview state, not a coincidental default.
            var displayApi = new FakeDisplayApi
            {
                ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(2560, 1440, 144, 1, FullScreenMode.ExclusiveFullScreen)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var candidate = new DisplayCandidate(1280, 720, 2);
            var results = new List<DisplayConfirmResult>();
            gate.Confirm(candidate, results.Add);

            gate.Tick(14f);
            Assert.That(results, Is.Empty, "Timer still running before 15s.");
            gate.Tick(1.1f);
            Assert.That(results, Is.EqualTo(new[] { DisplayConfirmResult.RejectedOrTimeout }));
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(1), "Timeout restores the pre-preview state exactly once.");
            Assert.That(displayApi.RestoredStates[0].Width, Is.EqualTo(2560), "Timeout restores the EXACT pre-preview baseline (width).");
            Assert.That(displayApi.RestoredStates[0].Height, Is.EqualTo(1440));
            Assert.That(displayApi.RestoredStates[0].RefreshRateNumerator, Is.EqualTo(144), "Refresh-rate fraction preserved in the restore.");
            Assert.That(displayApi.RestoredStates[0].ScreenMode, Is.EqualTo(FullScreenMode.ExclusiveFullScreen));
        }

        [Test]
        public void AC_DR4_KeepChangesKeepsCandidateInWorkingWithoutPersistence()
        {
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);

            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);
            orchestrator.ApplyDisplay(new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow), session);
            gate.KeepChanges();

            Assert.That(session.HasPendingDisplayConfirm, Is.False);
            Assert.That(session.IsOpen, Is.True, "Session returns to Open — no persistence on Keep.");
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1280), "Candidate copied to working.");
            Assert.That(session.Working.Display.ResolutionHeight, Is.EqualTo(720));
            Assert.That(store.Data.Count, Is.EqualTo(0), "No persistence call occurred before Apply.");
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(0), "Keep does NOT restore.");
        }

        [Test]
        public void AC_DR5_CancelRestoresPrePreviewExactlyOnce()
        {
            var displayApi = new FakeDisplayApi
            {
                ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(2560, 1440, 144, 1, FullScreenMode.ExclusiveFullScreen)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var candidate = new DisplayCandidate(1280, 720, 2);
            var results = new List<DisplayConfirmResult>();
            gate.Confirm(candidate, results.Add);
            gate.Cancel();

            Assert.That(displayApi.RestoreCalls, Is.EqualTo(1));
            Assert.That(displayApi.RestoredStates[0].Width, Is.EqualTo(2560), "Cancel restores the EXACT pre-preview baseline.");
            Assert.That(displayApi.RestoredStates[0].RefreshRateNumerator, Is.EqualTo(144));
            Assert.That(results, Is.EqualTo(new[] { DisplayConfirmResult.RejectedOrTimeout }));
            Assert.That(gate.IsActive, Is.False);
        }

        [Test]
        public void AC_DR5_CancelThroughSessionNeverPersists()
        {
            // QL-TEST-COVERAGE gap 3: a rollback outcome through the SESSION never persists —
            // Cancel after a display preview restores the baseline, keeps the session open, and
            // leaves the store untouched.
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi
            {
                ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(2560, 1440, 144, 1, FullScreenMode.ExclusiveFullScreen)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);
            DisplayData before = session.Working.Display;

            orchestrator.ApplyDisplay(
                new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow), session);
            Assert.That(session.HasPendingDisplayConfirm, Is.True, "Confirmation opened.");
            gate.Cancel(); // rollback outcome

            Assert.That(session.IsOpen, Is.True, "Session stays open after rollback (returns to Open).");
            Assert.That(session.HasPendingDisplayConfirm, Is.False);
            Assert.That(displayApi.RestoredStates[0].Width, Is.EqualTo(2560), "Baseline restored.");
            Assert.That(session.Working.Display, Is.EqualTo(before), "Working unchanged — candidate not accepted.");
            Assert.That(store.Data.Count, Is.EqualTo(0), "Rollback never persists — zero writes to the store.");
        }

        [Test]
        public void AC_DR5_FocusLossRestoresExactlyOnceAndIsIdempotent()
        {
            var displayApi = new FakeDisplayApi
            {
                ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(2560, 1440, 144, 1, FullScreenMode.ExclusiveFullScreen)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var results = new List<DisplayConfirmResult>();
            gate.Confirm(new DisplayCandidate(1280, 720, 2), results.Add);

            focus.RaiseFocus(false);
            focus.RaiseFocus(false); // repeated loss — idempotent

            Assert.That(displayApi.RestoreCalls, Is.EqualTo(1), "Repeated focus loss triggers exactly one restore.");
            Assert.That(displayApi.RestoredStates[0].Width, Is.EqualTo(2560), "Focus loss restores the EXACT pre-preview baseline.");
            Assert.That(displayApi.RestoredStates[0].RefreshRateNumerator, Is.EqualTo(144));
            Assert.That(results, Is.EqualTo(new[] { DisplayConfirmResult.RejectedOrTimeout }));
            Assert.That(gate.IsActive, Is.False);
        }

        [Test]
        public void AC_DR5_ReFocusDoesNotCancelRunningTimer()
        {
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var results = new List<DisplayConfirmResult>();
            gate.Confirm(new DisplayCandidate(1280, 720, 2), results.Add);

            focus.RaiseFocus(true); // re-focus while pending — must NOT cancel the timer
            gate.Tick(15.1f);       // timer still runs → timeout

            Assert.That(results, Is.EqualTo(new[] { DisplayConfirmResult.RejectedOrTimeout }));
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(1));
        }

        [Test]
        public void AC_DR5_DisposeWhilePendingCompletesConfirmationAndSessionNotBricked()
        {
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);

            orchestrator.ApplyDisplay(new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow), session);
            Assert.That(session.HasPendingDisplayConfirm, Is.True, "Confirmation is active before Dispose.");

            gate.Dispose(); // disposed while the confirmation is ACTIVE

            Assert.That(session.HasPendingDisplayConfirm, Is.False, "Dispose completes the pending confirmation — session is not bricked (Apply works again).");
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(1), "Dispose restores the pre-preview baseline exactly once.");
            Assert.That(gate.IsActive, Is.False);
            Assert.That(session.Apply(), Is.Not.EqualTo(ApplyResult.DisplayConfirmPending), "Session Apply no longer blocked by a stale pending flag.");
        }

        [Test]
        public void AC_DR5_RejectedPreviewDoesNotStartTimerAndReturnsImmediately()
        {
            var displayApi = new FakeDisplayApi
            {
                ApplyPreviewResult = DisplayPreviewResult.RejectedNoSupported,
                TryResolveResult = false
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var results = new List<DisplayConfirmResult>();
            gate.Confirm(new DisplayCandidate(1280, 720, 2), results.Add);

            Assert.That(results, Is.EqualTo(new[] { DisplayConfirmResult.RejectedOrTimeout }), "Callback before return, no timer.");
            Assert.That(gate.IsActive, Is.False);
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(0), "Nothing was applied — nothing to restore.");
            // Timer is not started: a Tick never produces a second outcome.
            gate.Tick(15.1f);
            Assert.That(results, Is.EqualTo(new[] { DisplayConfirmResult.RejectedOrTimeout }));
        }

        [Test]
        public void AC_DR5_RejectionWhileAnotherPendingRestoresBaselineOnce()
        {
            var displayApi = new FakeDisplayApi
            {
                ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(2560, 1440, 144, 1, FullScreenMode.ExclusiveFullScreen)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            // Capture the ORIGINAL baseline independently BEFORE any preview — the fake is
            // stateful (ApplyPreview/Restore mutate CurrentStateValue), so comparing against
            // CurrentStateValue AFTER the restore would be tautological (QL verification round).
            DisplayState originalBaseline = displayApi.CurrentStateValue;
            var resultsA = new List<DisplayConfirmResult>();
            var resultsB = new List<DisplayConfirmResult>();
            gate.Confirm(new DisplayCandidate(1280, 720, 2), resultsA.Add); // first preview APPLIES

            // Second candidate replaces the first and is REJECTED.
            displayApi.ApplyPreviewResult = DisplayPreviewResult.RejectedNoSupported;
            gate.Confirm(new DisplayCandidate(1920, 1080, 2), resultsB.Add);

            Assert.That(displayApi.RestoreCalls, Is.EqualTo(1), "Abandoned preview restored to the ORIGINAL baseline exactly once.");
            Assert.That(displayApi.RestoredStates[0].Width, Is.EqualTo(originalBaseline.Width), "Restored width == original baseline (QL gap 2).");
            Assert.That(displayApi.RestoredStates[0].Height, Is.EqualTo(originalBaseline.Height));
            Assert.That(displayApi.RestoredStates[0].RefreshRateNumerator, Is.EqualTo(originalBaseline.RefreshRateNumerator));
            Assert.That(displayApi.RestoredStates[0].RefreshRateDenominator, Is.EqualTo(originalBaseline.RefreshRateDenominator));
            Assert.That(displayApi.RestoredStates[0].ScreenMode, Is.EqualTo(originalBaseline.ScreenMode));
            Assert.That(resultsA, Is.Empty, "Stale callback A never fires (QA R3 F8).");
            Assert.That(resultsB, Is.EqualTo(new[] { DisplayConfirmResult.RejectedOrTimeout }), "Only the latest callback B fires with RejectedOrTimeout.");
            Assert.That(gate.IsActive, Is.False);
        }

        [Test]
        public void PrepareDisplayState_MatchUsesPreparedVerbatimWithoutSecondResolve()
        {
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);

            // Prepared state carries a NON-default refresh fraction (75 Hz) — the candidate seam
            // carries only width/height/mode, so the gate must use the prepared state verbatim.
            gate.PrepareDisplayState(new DisplayState(1280, 720, 75, 1, FullScreenMode.FullScreenWindow));
            gate.Confirm(new DisplayCandidate(1280, 720, 2), _ => { });

            Assert.That(displayApi.AppliedStates.Count, Is.EqualTo(1));
            Assert.That(displayApi.AppliedStates[0].RefreshRateNumerator, Is.EqualTo(75), "Prepared refresh-rate preserved — no second resolve.");
            Assert.That(displayApi.TryResolveCalls, Is.EqualTo(0), "No second resolve on the gate path.");
        }

        [Test]
        public void PrepareDisplayState_MismatchResolvesWithCurrentRefreshRate()
        {
            var displayApi = new FakeDisplayApi
            {
                CurrentStateValue = new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);

            // No prepare (e.g. RestoreDefaults path) — the gate resolves with the candidate as
            // requested and the current display's refresh-rate as the default.
            gate.Confirm(new DisplayCandidate(1280, 720, 2), _ => { });

            Assert.That(displayApi.AppliedStates.Count, Is.EqualTo(1));
            Assert.That(displayApi.AppliedStates[0].RefreshRateNumerator, Is.EqualTo(60), "Current display refresh-rate used as default.");
            Assert.That(displayApi.AppliedStates[0].ScreenMode, Is.EqualTo(FullScreenMode.FullScreenWindow), "int 2 → FullScreenWindow (canonical conversion).");
        }

        // ------------------------------------------------------------------ //
        // QualityPresetApplier — GDD mapping table
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_DR6_ResolveMappingMatchesGddValues()
        {
            var applier = new QualityPresetApplier();

            // Full five-dimension table for every preset (GDD settings.md:120-125). A mutation
            // to ANY omitted dimension would otherwise pass (QA finding R1).
            var low = applier.ResolveMapping(QualityPresetId.Low);
            Assert.That(low.PresetId, Is.EqualTo(QualityPresetId.Low));
            Assert.That(low.RenderScale, Is.EqualTo(0.75f).Within(1e-6f));
            Assert.That(low.VfxDensity, Is.EqualTo(VfxDensityLevel.Low));
            Assert.That(low.Shadows, Is.EqualTo(ShadowLevel.Off));
            Assert.That(low.MSAA, Is.EqualTo(MSAASamples.Off));
            Assert.That(low.Anisotropic, Is.EqualTo(AnisotropicLevel.PerTexture));

            var medium = applier.ResolveMapping(QualityPresetId.Medium);
            Assert.That(medium.PresetId, Is.EqualTo(QualityPresetId.Medium));
            Assert.That(medium.RenderScale, Is.EqualTo(0.85f).Within(1e-6f));
            Assert.That(medium.VfxDensity, Is.EqualTo(VfxDensityLevel.Medium));
            Assert.That(medium.Shadows, Is.EqualTo(ShadowLevel.Soft));
            Assert.That(medium.MSAA, Is.EqualTo(MSAASamples.X2));
            Assert.That(medium.Anisotropic, Is.EqualTo(AnisotropicLevel.ForcedOn));

            var high = applier.ResolveMapping(QualityPresetId.High);
            Assert.That(high.PresetId, Is.EqualTo(QualityPresetId.High));
            Assert.That(high.RenderScale, Is.EqualTo(1.0f).Within(1e-6f));
            Assert.That(high.VfxDensity, Is.EqualTo(VfxDensityLevel.High));
            Assert.That(high.Shadows, Is.EqualTo(ShadowLevel.Hard));
            Assert.That(high.MSAA, Is.EqualTo(MSAASamples.X4));
            Assert.That(high.Anisotropic, Is.EqualTo(AnisotropicLevel.ForcedOn));

            var ultra = applier.ResolveMapping(QualityPresetId.Ultra);
            Assert.That(ultra.PresetId, Is.EqualTo(QualityPresetId.Ultra));
            Assert.That(ultra.RenderScale, Is.EqualTo(1.0f).Within(1e-6f));
            Assert.That(ultra.VfxDensity, Is.EqualTo(VfxDensityLevel.Ultra));
            Assert.That(ultra.Shadows, Is.EqualTo(ShadowLevel.Hard));
            Assert.That(ultra.MSAA, Is.EqualTo(MSAASamples.X4));
            Assert.That(ultra.Anisotropic, Is.EqualTo(AnisotropicLevel.ForcedOn));
        }

        [Test]
        public void AC_DR6_CustomHasNoMapping()
        {
            var applier = new QualityPresetApplier();
            Assert.Throws<ArgumentOutOfRangeException>(() => applier.ResolveMapping(QualityPresetId.Custom));
        }

        // ------------------------------------------------------------------ //
        // DisplaySettingsOrchestrator — apply ordering (AC-DR6), VSync → Custom (AC-DR7)
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_DR6_ApplyPresetRunsBeforeSetValueAndWorkingUpdatesAfterApplied()
        {
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var applier = new FakeQualityPresetApplier
            {
                Mapping = new QualityPresetMapping(QualityPresetId.High, 1.0f, VfxDensityLevel.High, ShadowLevel.Hard, MSAASamples.X4, AnisotropicLevel.ForcedOn)
            };
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, applier, gate);
            var published = new List<QualityPresetMapping>();
            applier.PresetApplied += published.Add;
            // Chronological ordering proof (QA R2 F7): ApplyPreset must run BEFORE SetValue.
            var order = new List<string>();
            applier.OnApply = () => order.Add("apply");
            session.WorkingChanged += _ => order.Add("set");

            var status = orchestrator.ApplyQualityPreset(QualityPresetId.High, session);

            Assert.That(status, Is.EqualTo(ApplyStatus.Applied));
            Assert.That(applier.ResolveCalls, Is.EqualTo(new[] { QualityPresetId.High }), "ResolveMapping called with the REQUESTED preset id (QA R3 F9).");
            Assert.That(applier.AppliedMappings.Count, Is.EqualTo(1), "ApplyPreset called FIRST.");
            Assert.That(session.IsOpen, Is.True, "Session stays open after a quality apply (QA R9 F3).");
            Assert.That(store.Data.Count, Is.EqualTo(0), "Quality apply does NOT persist — persistence only on explicit session.Apply (QA R9 F3).");
            Assert.That(applier.AppliedMappings[0].PresetId, Is.EqualTo(QualityPresetId.High));
            Assert.That(applier.AppliedMappings[0].RenderScale, Is.EqualTo(1.0f).Within(1e-6f), "Full mapping delivered (render scale).");
            Assert.That(applier.AppliedMappings[0].MSAA, Is.EqualTo(MSAASamples.X4), "Full mapping delivered (MSAA).");
            Assert.That(applier.AppliedMappings[0].Shadows, Is.EqualTo(ShadowLevel.Hard), "Full mapping delivered (shadows).");
            Assert.That(applier.AppliedMappings[0].VfxDensity, Is.EqualTo(VfxDensityLevel.High), "Full mapping delivered (VFX density).");
            Assert.That(applier.AppliedMappings[0].Anisotropic, Is.EqualTo(AnisotropicLevel.ForcedOn), "Full mapping delivered (anisotropic).");
            Assert.That(order, Is.EqualTo(new[] { "apply", "set" }), "ApplyPreset runs BEFORE session.SetValue (DR6 ordering).");
            Assert.That(published.Count, Is.EqualTo(1), "PresetApplied event observed directly (not just the fake's bookkeeping).");
            Assert.That(published[0].PresetId, Is.EqualTo(QualityPresetId.High));
            Assert.That(published[0].RenderScale, Is.EqualTo(1.0f).Within(1e-6f));
            Assert.That(published[0].VfxDensity, Is.EqualTo(VfxDensityLevel.High), "PresetApplied payload carries VFX density.");
            Assert.That(published[0].Anisotropic, Is.EqualTo(AnisotropicLevel.ForcedOn), "PresetApplied payload carries anisotropic.");
            Assert.That(session.Working.Display.QualityPreset, Is.EqualTo((int)QualityPresetId.High), "SetValue ran AFTER apply and Working updated.");
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "Quality change is a non-display field — applies immediately, no gate.");
        }

        [Test]
        public void AC_DR6_RejectedPresetSkipsSetValueLeavingWorkingUnchanged()
        {
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var applier = new FakeQualityPresetApplier { ApplyStatus = ApplyStatus.Rejected };
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, applier, gate);
            var workingChanges = new List<SettingsCategory>();
            session.WorkingChanged += workingChanges.Add;

            var status = orchestrator.ApplyQualityPreset(QualityPresetId.Ultra, session);

            Assert.That(status, Is.EqualTo(ApplyStatus.Rejected));
            Assert.That(session.Working.Display.QualityPreset, Is.EqualTo(DisplayData.Default.QualityPreset), "Working unchanged — SetValue skipped.");
            Assert.That(applier.PublishedMappings.Count, Is.EqualTo(0), "PresetApplied NOT raised on rejection.");
            Assert.That(applier.ActivePreset, Is.EqualTo(QualityPresetId.Medium), "ActivePreset remains the previous preset.");
            Assert.That(store.Data.Count, Is.EqualTo(0), "No persistence occurs.");
            Assert.That(workingChanges.Count, Is.EqualTo(0), "Rejected preset raises NO WorkingChanged (QA R9 F4).");
        }

        [Test]
        public void AC_DR7_SetVsyncMarksCustomOverrideAndUpdatesWorking()
        {
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var applier = new FakeQualityPresetApplier
            {
                Mapping = new QualityPresetMapping(QualityPresetId.High, 1.0f, VfxDensityLevel.High, ShadowLevel.Hard, MSAASamples.X4, AnisotropicLevel.ForcedOn)
            };
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, applier, gate);

            // Precondition: a real preset is active first (QA finding R1) — the Custom
            // transition must hold from a non-default preset, not just the fake's default.
            orchestrator.ApplyQualityPreset(QualityPresetId.High, session);
            Assert.That(applier.ActivePreset, Is.EqualTo(QualityPresetId.High));

            orchestrator.SetVsync(0, session);
            Assert.That(applier.MarkCustomCalls, Is.EqualTo(1));
            Assert.That(applier.ActivePreset, Is.EqualTo(QualityPresetId.Custom), "VSync change → active preset becomes Custom.");
            Assert.That(session.Working.Display.Vsync, Is.EqualTo(0));

            orchestrator.SetVsync(1, session);
            Assert.That(applier.MarkCustomCalls, Is.EqualTo(2));
            Assert.That(applier.ActivePreset, Is.EqualTo(QualityPresetId.Custom));
            Assert.That(session.Working.Display.Vsync, Is.EqualTo(1), "VSync On also marks Custom and persists the new value.");
        }

        // ------------------------------------------------------------------ //
        // AC-ST9 — every DisplayConfirm outcome returns to Open
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_ST9_AllOutcomesReturnSessionToOpen()
        {
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi();
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);

            // Path 1: Keep — requested 1280x720 (Working is the 1920x1080 default).
            displayApi.ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow);
            orchestrator.ApplyDisplay(new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow), session);
            Assert.That(session.HasPendingDisplayConfirm, Is.True, "Path 1 ENTERS DisplayConfirm.");
            gate.KeepChanges();
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "Path 1 EXITS DisplayConfirm.");
            Assert.That(session.IsOpen, Is.True);

            // Path 2: Cancel — requested 1600x900 (Working is now 1280x720).
            displayApi.ResolvedState = new DisplayState(1600, 900, 60, 1, FullScreenMode.FullScreenWindow);
            orchestrator.ApplyDisplay(new DisplayState(1600, 900, 60, 1, FullScreenMode.FullScreenWindow), session);
            Assert.That(session.HasPendingDisplayConfirm, Is.True, "Path 2 ENTERS DisplayConfirm.");
            gate.Cancel();
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "Path 2 EXITS DisplayConfirm.");
            Assert.That(session.IsOpen, Is.True);
            // QA R4/R5: FULL rollback tuple fidelity — not just width.
            Assert.That(displayApi.RestoredStates[0].Width, Is.EqualTo(1280), "Path 2 (Cancel) restores the pre-preview baseline.");
            Assert.That(displayApi.RestoredStates[0].Height, Is.EqualTo(720));
            Assert.That(displayApi.RestoredStates[0].RefreshRateNumerator, Is.EqualTo(60));
            Assert.That(displayApi.RestoredStates[0].ScreenMode, Is.EqualTo(FullScreenMode.FullScreenWindow));
            Assert.That(displayApi.CurrentStateValue.Width, Is.EqualTo(1280), "Current state reverted to the baseline after Cancel.");
            Assert.That(displayApi.CurrentStateValue.Height, Is.EqualTo(720));
            Assert.That(displayApi.CurrentStateValue.RefreshRateNumerator, Is.EqualTo(60));
            Assert.That(displayApi.CurrentStateValue.RefreshRateDenominator, Is.EqualTo(1), "Current-state refresh denominator restored (QA R6 F1).");
            Assert.That(displayApi.CurrentStateValue.ScreenMode, Is.EqualTo(FullScreenMode.FullScreenWindow), "Current-state mode restored (QA R6 F1).");

            // Path 3: timeout — requested 1920x1080 (Working is 1280x720).
            displayApi.ResolvedState = new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow);
            orchestrator.ApplyDisplay(new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow), session);
            Assert.That(session.HasPendingDisplayConfirm, Is.True, "Path 3 ENTERS DisplayConfirm.");
            gate.Tick(15.1f);
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "Path 3 EXITS DisplayConfirm.");
            Assert.That(session.IsOpen, Is.True);
            Assert.That(displayApi.RestoredStates[1].Width, Is.EqualTo(1280), "Path 3 (timeout) restores the pre-preview baseline.");
            Assert.That(displayApi.RestoredStates[1].Height, Is.EqualTo(720));
            Assert.That(displayApi.RestoredStates[1].RefreshRateNumerator, Is.EqualTo(60));
            Assert.That(displayApi.RestoredStates[1].ScreenMode, Is.EqualTo(FullScreenMode.FullScreenWindow));
            Assert.That(displayApi.CurrentStateValue.Width, Is.EqualTo(1280), "Current state reverted to the baseline after timeout.");
            Assert.That(displayApi.CurrentStateValue.Height, Is.EqualTo(720));
            Assert.That(displayApi.CurrentStateValue.RefreshRateNumerator, Is.EqualTo(60), "Current-state refresh numerator restored after timeout (QA R7 F1).");
            Assert.That(displayApi.CurrentStateValue.RefreshRateDenominator, Is.EqualTo(1), "Current-state refresh denominator restored after timeout (QA R6 F1).");
            Assert.That(displayApi.CurrentStateValue.ScreenMode, Is.EqualTo(FullScreenMode.FullScreenWindow), "Current-state mode restored after timeout (QA R6 F1).");

            // Path 4: focus loss — requested 1366x768 (Working is 1280x720, always a NEW candidate).
            displayApi.ResolvedState = new DisplayState(1366, 768, 60, 1, FullScreenMode.FullScreenWindow);
            orchestrator.ApplyDisplay(new DisplayState(1366, 768, 60, 1, FullScreenMode.FullScreenWindow), session);
            Assert.That(session.HasPendingDisplayConfirm, Is.True, "Path 4 ENTERS DisplayConfirm.");
            focus.RaiseFocus(false);
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "Path 4 EXITS DisplayConfirm.");
            Assert.That(session.IsOpen, Is.True);
            Assert.That(displayApi.RestoredStates[2].Width, Is.EqualTo(1280), "Path 4 (focus loss) restores the pre-preview baseline.");
            Assert.That(displayApi.RestoredStates[2].Height, Is.EqualTo(720));
            Assert.That(displayApi.RestoredStates[2].RefreshRateNumerator, Is.EqualTo(60));
            Assert.That(displayApi.RestoredStates[2].ScreenMode, Is.EqualTo(FullScreenMode.FullScreenWindow));
            Assert.That(displayApi.CurrentStateValue.Width, Is.EqualTo(1280), "Final current state is the restored baseline.");
            Assert.That(displayApi.CurrentStateValue.Height, Is.EqualTo(720));
            Assert.That(displayApi.CurrentStateValue.RefreshRateNumerator, Is.EqualTo(60), "Final current-state refresh numerator restored (QA R7 F1).");
            Assert.That(displayApi.CurrentStateValue.RefreshRateDenominator, Is.EqualTo(1), "Final current-state refresh denominator restored (QA R6 F1).");
            Assert.That(displayApi.CurrentStateValue.ScreenMode, Is.EqualTo(FullScreenMode.FullScreenWindow), "Final current-state mode restored (QA R6 F1).");
        }

        [Test]
        public void AC_ST9_TypedRejectionReturnsToOpenImmediately()
        {
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi { TryResolveResult = false };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);

            bool ok = orchestrator.ApplyDisplay(new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow), session);

            Assert.That(ok, Is.False, "RejectedNoSupported (empty supported list) → typed rejection.");
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "No timer starts.");
            Assert.That(session.IsOpen, Is.True, "Session returns to Open.");
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(DisplayData.Default.ResolutionWidth), "Working unchanged.");
        }

        // ------------------------------------------------------------------ //
        // QA R1 additions — sequential baselines, typed rejection matrix,
        // replacement-with-success, focus subscription lifetime
        // ------------------------------------------------------------------ //

        [Test]
        public void SequentialPreviewsRestoreTheirOwnBaseline()
        {
            // QA R1 finding: _hasBaseline was never reset — a second preview restored the FIRST
            // preview's baseline. This test fails without the CompletePending reset.
            var displayApi = new FakeDisplayApi
            {
                ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(2560, 1440, 144, 1, FullScreenMode.ExclusiveFullScreen)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);

            // Preview 1: baseline = 2560x1440@144 Exclusive. Keep (no restore).
            gate.Confirm(new DisplayCandidate(1280, 720, 2), _ => { });
            gate.KeepChanges();
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(0));

            // Between sessions the display state changes (e.g. another app took fullscreen).
            displayApi.CurrentStateValue = new DisplayState(3440, 1440, 120, 1, FullScreenMode.FullScreenWindow);

            // Preview 2: baseline must be the NEW current state (3440x1440@120 Windowed).
            gate.Confirm(new DisplayCandidate(1920, 1080, 2), _ => { });
            gate.Cancel();

            Assert.That(displayApi.RestoreCalls, Is.EqualTo(1));
            Assert.That(displayApi.RestoredStates[0].Width, Is.EqualTo(3440), "Second preview restores its OWN baseline, not the first preview's.");
            Assert.That(displayApi.RestoredStates[0].RefreshRateNumerator, Is.EqualTo(120));
            Assert.That(displayApi.RestoredStates[0].ScreenMode, Is.EqualTo(FullScreenMode.FullScreenWindow));
        }

        [TestCase(DisplayPreviewResult.RejectedNoSupported)]
        [TestCase(DisplayPreviewResult.RejectedWebGLUnsupported)]
        public void AC_ST9_TypedRejectionMatrixReturnsToOpenImmediately(DisplayPreviewResult rejection)
        {
            // Both typed rejections must behave identically: immediate outcome, no timer, no
            // restore, no persistence, Working unchanged (QA R1 finding).
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi { TryResolveResult = true, ApplyPreviewResult = rejection };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);

            bool ok = orchestrator.ApplyDisplay(new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow), session);

            Assert.That(ok, Is.True, "TryResolve succeeded — the rejection happens at ApplyPreview.");
            Assert.That(displayApi.TryResolveCalls, Is.EqualTo(1), "Orchestrator resolved exactly once (gate reachability).");
            Assert.That(displayApi.AppliedStates.Count, Is.EqualTo(1), "The gate invoked ApplyPreview exactly once with the rejection result.");
            Assert.That(displayApi.EventLog, Is.EqualTo(new[] { "resolve", "apply" }), "Rejection path: resolve then apply (no warning — no fallback).");
            Assert.That(session.HasPendingDisplayConfirm, Is.False, $"{rejection} starts no timer.");
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(0), $"{rejection} restores nothing (nothing retained).");
            Assert.That(session.IsOpen, Is.True);
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(DisplayData.Default.ResolutionWidth), "Working unchanged.");
            Assert.That(store.Data.Count, Is.EqualTo(0), "No persistence.");
        }

        [Test]
        public void ReplacementCandidateWithSuccessKeepsOnlyLatestCallback()
        {
            // QA R1 finding: two SUCCESSFUL pending previews — the stale (first) callback must
            // never fire; Keep applies only the latest candidate. QA R2 F9: use SEPARATE result
            // lists so a wrongly-invoked stale callback is observable (the session's generation
            // counter would otherwise hide it).
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var resultsA = new List<DisplayConfirmResult>();
            var resultsB = new List<DisplayConfirmResult>();

            gate.Confirm(new DisplayCandidate(1280, 720, 2), resultsA.Add);   // candidate A
            gate.Confirm(new DisplayCandidate(1600, 900, 2), resultsB.Add);   // candidate B replaces A
            gate.KeepChanges();

            Assert.That(resultsA, Is.Empty, "Stale callback A never fires after B replaces it.");
            Assert.That(resultsB, Is.EqualTo(new[] { DisplayConfirmResult.Accepted }), "Only the latest callback B receives the outcome.");
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(0), "Keep never restores.");
            Assert.That(displayApi.AppliedStates.Count, Is.EqualTo(2), "Both previews applied (QA R3 F7: B must be PREVIEWED, not just callback-delivered).");
            Assert.That(displayApi.AppliedStates[1].Width, Is.EqualTo(1600), "AppliedStates[1] is candidate B's resolved state.");
            Assert.That(displayApi.AppliedStates[1].Height, Is.EqualTo(900));
        }

        [Test]
        public void BaselineResetAfterRejectionWhilePending()
        {
            // QA R2 F5: _hasBaseline must reset after EVERY terminal path — here the terminal
            // path is rejection-while-pending. Preview A applies (baseline 2560x1440@144);
            // replacement B is REJECTED (restores A's baseline, resets _hasBaseline); the
            // display changes; preview C must capture the NEW state as its baseline.
            var displayApi = new FakeDisplayApi
            {
                ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(2560, 1440, 144, 1, FullScreenMode.ExclusiveFullScreen)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);

            gate.Confirm(new DisplayCandidate(1280, 720, 2), _ => { }); // A applies — baseline 2560x1440@144
            displayApi.ApplyPreviewResult = DisplayPreviewResult.RejectedNoSupported;
            gate.Confirm(new DisplayCandidate(1920, 1080, 2), _ => { }); // B rejected — restores A's baseline
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(1), "B rejection restored preview A's baseline.");

            displayApi.ApplyPreviewResult = DisplayPreviewResult.Applied;
            displayApi.CurrentStateValue = new DisplayState(3440, 1440, 120, 1, FullScreenMode.FullScreenWindow);
            gate.Confirm(new DisplayCandidate(1600, 900, 2), _ => { }); // C applies — baseline must be the NEW state
            gate.Cancel();

            Assert.That(displayApi.RestoreCalls, Is.EqualTo(2));
            Assert.That(displayApi.RestoredStates[1].Width, Is.EqualTo(3440), "Preview C restores ITS OWN baseline, not A's (reset after rejection).");
            Assert.That(displayApi.RestoredStates[1].RefreshRateNumerator, Is.EqualTo(120));
            Assert.That(displayApi.RestoredStates[1].ScreenMode, Is.EqualTo(FullScreenMode.FullScreenWindow));
        }

        [Test]
        public void FocusSubscriptionLifecycleSubscribedWhilePendingUnsubscribedAfterOutcome()
        {
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var results = new List<DisplayConfirmResult>();

            gate.Confirm(new DisplayCandidate(1280, 720, 2), results.Add);
            Assert.That(focus.SubscriberCount, Is.EqualTo(1), "Subscribed while pending — focus loss can roll back.");

            gate.KeepChanges();
            Assert.That(focus.SubscriberCount, Is.EqualTo(0), "Unsubscribed after Keep.");

            // A stale focus-loss after completion must not produce another outcome.
            focus.RaiseFocus(false);
            Assert.That(results, Is.EqualTo(new[] { DisplayConfirmResult.Accepted }), "Stale focus-loss after completion is a no-op.");

            gate.Confirm(new DisplayCandidate(1920, 1080, 2), results.Add);
            Assert.That(focus.SubscriberCount, Is.EqualTo(1), "Re-subscribed on the next confirmation.");
            focus.RaiseFocus(false);
            Assert.That(focus.SubscriberCount, Is.EqualTo(0), "Unsubscribed after focus-loss outcome.");
            Assert.That(results, Is.EqualTo(new[] { DisplayConfirmResult.Accepted, DisplayConfirmResult.RejectedOrTimeout }),
                "Second focus-loss produces the rejection outcome (QA R2 F10).");
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(1), "Second focus-loss restores the second preview's baseline.");
        }

        [Test]
        public void AC_DR4_KeepPersistsChangedFullscreenModeToWorking()
        {
            // QA R5 F5: a candidate with a CHANGED mode (Windowed, int 0 — the default is 2)
            // must be retained in Working on Keep. The old test used mode 2 matching the
            // default, so a keep that silently reused the old mode would have passed.
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.Windowed) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);

            orchestrator.ApplyDisplay(new DisplayState(1280, 720, 60, 1, FullScreenMode.Windowed), session);
            gate.KeepChanges();

            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1280));
            Assert.That(session.Working.Display.ResolutionHeight, Is.EqualTo(720));
            Assert.That(session.Working.Display.FullscreenMode, Is.EqualTo(0), "Windowed (int 0) retained in Working on Keep.");
        }

        [Test]
        public void AC_DR3_ExactFifteenSecondBoundaryTimesOutImmediately()
        {
            // QA R5 F6: the timeout condition is <= 0 — a Tick of exactly 15.0s must time out
            // (a < 0 mutation would fail this test).
            var displayApi = new FakeDisplayApi
            {
                ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(2560, 1440, 144, 1, FullScreenMode.ExclusiveFullScreen)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var results = new List<DisplayConfirmResult>();
            gate.Confirm(new DisplayCandidate(1280, 720, 2), results.Add);

            gate.Tick(15f); // exactly 15.0 — remaining reaches 0

            Assert.That(results, Is.EqualTo(new[] { DisplayConfirmResult.RejectedOrTimeout }), "Exact 15s boundary times out.");
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(1), "Exact-boundary timeout restores exactly once.");
            Assert.That(gate.IsActive, Is.False);
        }

        [Test]
        public void AC_DR3_FullscreenOnlyChangeEntersDisplayConfirm()
        {
            // QA R6 F2: a MODE-only change (same resolution) must enter DisplayConfirm. Removing
            // the FullscreenMode comparison from the session's change detection would fail this
            // test (the existing fullscreen tests also change resolution, so they'd pass).
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi
            {
                // Working default is 1920x1080 Borderless (int 2) — request the SAME resolution
                // but Windowed (int 0).
                ResolvedState = new DisplayState(1920, 1080, 60, 1, FullScreenMode.Windowed)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);

            bool ok = orchestrator.ApplyDisplay(new DisplayState(1920, 1080, 60, 1, FullScreenMode.Windowed), session);

            Assert.That(ok, Is.True);
            Assert.That(session.HasPendingDisplayConfirm, Is.True, "Mode-only change enters DisplayConfirm.");
            Assert.That(displayApi.AppliedStates[0].ScreenMode, Is.EqualTo(FullScreenMode.Windowed), "Windowed preview applied.");
            Assert.That(displayApi.AppliedStates[0].Width, Is.EqualTo(1920), "Resolution unchanged.");
        }

        [Test]
        public void AC_DR4_KeepThenRejectedConfirmDoesNotRestoreAcceptedChange()
        {
            // QA R6 F3 (REAL production bug): KeepChanges previously left _previewApplied stale,
            // so a Keep followed by a REJECTED confirm restored the pre-Keep baseline — undoing
            // the accepted change. Now Keep clears the preview flag: the accepted state stays
            // applied, and the rejected confirm restores nothing.
            var displayApi = new FakeDisplayApi
            {
                ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(2560, 1440, 144, 1, FullScreenMode.ExclusiveFullScreen)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);

            gate.Confirm(new DisplayCandidate(1280, 720, 2), _ => { }); // A applies (baseline 2560x1440@144)
            gate.KeepChanges();                                          // A accepted — stays applied

            displayApi.ApplyPreviewResult = DisplayPreviewResult.RejectedNoSupported;
            gate.Confirm(new DisplayCandidate(1920, 1080, 2), _ => { }); // B rejected — never applied

            Assert.That(displayApi.RestoreCalls, Is.EqualTo(0), "Rejected B restores NOTHING — A's accepted state is not undone (QA R6 F3).");
            Assert.That(displayApi.CurrentStateValue.Width, Is.EqualTo(1280), "Current state is still A's applied preview.");
        }

        [Test]
        public void AC_DR1_NullSupportedListRejectsWithoutCrash()
        {
            // QA R6 F5: the resolver documents null-list rejection.
            var requested = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow);
            Assert.That(DisplayStateResolver.TryResolveNearest(requested, null, out _), Is.False,
                "Null supported list rejects.");
        }

        [Test]
        public void AC_DR1_MaximumDimensionAreaDoesNotOverflow()
        {
            // QA R6 F5: 64-bit area arithmetic — int.MaxValue x int.MaxValue would overflow int
            // multiplication but stays exact in long. The nearest selection must remain correct.
            var huge = new DisplayState(int.MaxValue, int.MaxValue, 60, 1, FullScreenMode.FullScreenWindow);
            var near = new DisplayState(2000000000, 2000000000, 60, 1, FullScreenMode.FullScreenWindow);
            var small = new DisplayState(640, 480, 60, 1, FullScreenMode.FullScreenWindow);
            var supported = new List<DisplayState> { near, small }; // near area 4e18, small 307200
            var requested = huge; // area ~4.61e18

            Assert.That(DisplayStateResolver.TryResolveNearest(requested, supported, out var resolved), Is.True);
            Assert.That(resolved.Width, Is.EqualTo(2000000000), "Nearest (by area) wins without int overflow.");
        }

        [Test]
        public void AC_DR7_SetVsyncSameValueIsNoOpAndDoesNotMarkCustom()
        {
            // QA R6 F6: setting VSync to the SAME value is not a change — the active preset must
            // remain untouched (no Custom transition).
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var applier = new FakeQualityPresetApplier
            {
                Mapping = new QualityPresetMapping(QualityPresetId.High, 1.0f, VfxDensityLevel.High, ShadowLevel.Hard, MSAASamples.X4, AnisotropicLevel.ForcedOn)
            };
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, applier, gate);

            orchestrator.ApplyQualityPreset(QualityPresetId.High, session);
            int currentVsync = session.Working.Display.Vsync;
            Assert.That(applier.ActivePreset, Is.EqualTo(QualityPresetId.High));
            int markCallsBefore = applier.MarkCustomCalls;

            orchestrator.SetVsync(currentVsync, session); // same value → no-op

            Assert.That(applier.MarkCustomCalls, Is.EqualTo(markCallsBefore), "No Custom transition on a same-value VSync call.");
            Assert.That(applier.ActivePreset, Is.EqualTo(QualityPresetId.High), "ActivePreset unchanged.");
            Assert.That(session.Working.Display.Vsync, Is.EqualTo(currentVsync));
        }

        [Test]
        public void AC_DR4_KeepThenRejectedSessionLevelWorkingRemainsAccepted()
        {
            // QA R7 F3: session-level regression for the Keep-then-rejected fix — after Keep A
            // and a REJECTED B, the session's Working.Display must remain A (accepted), no
            // additional WorkingChanged, pending cleared. The direct-gate R6 test proved the
            // physical display stays at A; this proves the session state too.
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);
            var workingChanges = new List<SettingsCategory>();
            session.WorkingChanged += workingChanges.Add;

            // A: Apply + Keep (accepted → Working = 1280x720).
            orchestrator.ApplyDisplay(new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow), session);
            gate.KeepChanges();
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1280), "A accepted into Working.");
            int changesAfterA = workingChanges.Count;

            // B: rejected — must NOT touch Working and must NOT raise a second WorkingChanged.
            displayApi.ApplyPreviewResult = DisplayPreviewResult.RejectedNoSupported;
            orchestrator.ApplyDisplay(new DisplayState(1600, 900, 60, 1, FullScreenMode.FullScreenWindow), session);

            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1280), "Working remains the ACCEPTED A.");
            Assert.That(session.Working.Display.ResolutionHeight, Is.EqualTo(720));
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "Rejected B clears pending.");
            Assert.That(workingChanges.Count, Is.EqualTo(changesAfterA), "Rejected B produces no additional WorkingChanged (QA R7 F3).");
        }

        [TestCase(QualityPresetId.Low)]
        [TestCase(QualityPresetId.Medium)]
        [TestCase(QualityPresetId.High)]
        [TestCase(QualityPresetId.Ultra)]
        public void AC_DR6_OrchestratorAppliesAllPresetsToWorking(QualityPresetId id)
        {
            // QA R8 F1: the ORCHESTRATOR must update Working with the REQUESTED preset — a
            // mutation hardcoding High ((int)id → (int)QualityPresetId.High) would fail this
            // parameterized test (the existing High-only test would pass it).
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var applier = new FakeQualityPresetApplier
            {
                Mapping = new QualityPresetMapping(id, 1.0f, VfxDensityLevel.High, ShadowLevel.Hard, MSAASamples.X4, AnisotropicLevel.ForcedOn)
            };
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, applier, gate);
            var workingChanges = new List<SettingsCategory>();
            session.WorkingChanged += workingChanges.Add;

            ApplyStatus status = orchestrator.ApplyQualityPreset(id, session);

            Assert.That(status, Is.EqualTo(ApplyStatus.Applied));
            Assert.That(applier.AppliedMappings[0].PresetId, Is.EqualTo(id), "Applied mapping matches the REQUESTED preset.");
            Assert.That(session.Working.Display.QualityPreset, Is.EqualTo((int)id), "Working updated to the requested preset.");
            // The default preset is Medium (DisplayData.Default) — applying Medium is a SetValue
            // no-op, so no WorkingChanged; the other presets change the value and raise exactly one.
            int expectedChanges = id == QualityPresetId.Medium ? 0 : 1;
            Assert.That(workingChanges.Count, Is.EqualTo(expectedChanges), "WorkingChanged raised only when the preset value actually changed.");
        }

        [Test]
        public void AC_DR1_SupportedStatesBuilderStampsRequestedMode()
        {
            // QA R8 F3: the deterministic builder seam — the SAME resolution list built under
            // two different modes stamps each entry with the requested mode, and an exact
            // request for a mode resolves without fallback within that mode's list. The runtime
            // cache-staleness risk is tracked under TD-034.
            var resolutions = new[]
            {
                new Resolution { width = 1920, height = 1080, refreshRateRatio = new RefreshRate { numerator = 60, denominator = 1 } },
                new Resolution { width = 1280, height = 720, refreshRateRatio = new RefreshRate { numerator = 60, denominator = 1 } }
            };

            var modeWindowed = ScreenDisplayApi.BuildSupportedStates(resolutions, FullScreenMode.FullScreenWindow);
            var modeExclusive = ScreenDisplayApi.BuildSupportedStates(resolutions, FullScreenMode.ExclusiveFullScreen);
            Assert.That(modeWindowed[0].ScreenMode, Is.EqualTo(FullScreenMode.FullScreenWindow));
            Assert.That(modeExclusive[0].ScreenMode, Is.EqualTo(FullScreenMode.ExclusiveFullScreen), "Builder stamps the REQUESTED mode.");
            Assert.That(modeWindowed[0].Width, Is.EqualTo(1920));
            Assert.That(modeWindowed[0].RefreshRateNumerator, Is.EqualTo(60), "Refresh fraction preserved.");

            // An exact request for mode B resolves to a state carrying B — no fallback.
            var requested = new DisplayState(1920, 1080, 60, 1, FullScreenMode.ExclusiveFullScreen);
            Assert.That(DisplayStateResolver.TryResolveNearest(requested, modeExclusive, out var resolved), Is.True);
            Assert.That(DisplayStateResolver.SameState(resolved, requested), Is.True, "Exact B-mode request resolves without fallback within B-mode states.");
        }

        [Test]
        public void AC_DR3_OrchestratorPreservesResolvedRefreshRate()
        {
            // QA R9 F2: PrepareDisplayState must hand off the RESOLVED refresh fraction (75/2)
            // to the gate — removing the prepare call falls back to the current rate (60/1) and
            // fails here.
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi
            {
                ResolvedState = new DisplayState(1280, 720, 75, 2, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);

            orchestrator.ApplyDisplay(new DisplayState(1280, 720, 75, 2, FullScreenMode.FullScreenWindow), session);

            Assert.That(displayApi.TryResolveCalls, Is.EqualTo(1), "Exactly one resolve.");
            Assert.That(displayApi.AppliedStates[0].RefreshRateNumerator, Is.EqualTo(75), "Resolved refresh numerator preserved (not the 60/1 current).");
            Assert.That(displayApi.AppliedStates[0].RefreshRateDenominator, Is.EqualTo(2), "Resolved refresh denominator preserved.");
            Assert.That(session.HasPendingDisplayConfirm, Is.True);
        }

        [TestCase(QualityPresetId.Custom)]
        [TestCase((QualityPresetId)999)]
        public void AC_DR6_InvalidPresetIdRejectedNotThrown(QualityPresetId id)
        {
            // Pre-emptive (R10) + QA R11 F2: the orchestrator is a UI facade — an invalid preset
            // id (Custom has no mapping; an UNDEFINED enum value must behave identically, not be
            // special-cased) must return Rejected, never crash the facade or touch the session.
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi();
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var applier = new FakeQualityPresetApplier();
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, applier, gate);
            var workingChanges = new List<SettingsCategory>();
            session.WorkingChanged += workingChanges.Add;

            ApplyStatus status = orchestrator.ApplyQualityPreset(id, session);

            Assert.That(status, Is.EqualTo(ApplyStatus.Rejected), $"{id} resolves to Rejected, not a throw.");
            Assert.That(applier.AppliedMappings.Count, Is.EqualTo(0), "Nothing applied.");
            Assert.That(session.Working.Display.QualityPreset, Is.EqualTo(DisplayData.Default.QualityPreset), "Working untouched.");
            Assert.That(workingChanges.Count, Is.EqualTo(0), "No WorkingChanged.");
            Assert.That(session.IsOpen, Is.True);
        }

        [Test]
        public void NegativeTickDoesNotProlongConfirmationTimer()
        {
            // Pre-emptive (R10): a non-positive delta must not hold the confirmation open
            // forever. Without the clamp: Tick(-15) raises remaining to 30, then Tick(20) still
            // leaves 10 (active). With the clamp: Tick(20) consumes 15 → timeout fires.
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var results = new List<DisplayConfirmResult>();
            gate.Confirm(new DisplayCandidate(1280, 720, 2), results.Add);

            gate.Tick(-15f); // must be ignored
            gate.Tick(20f);  // consumes the full 15s → timeout

            Assert.That(results, Is.EqualTo(new[] { DisplayConfirmResult.RejectedOrTimeout }), "Timer fires on cumulative positive delta.");
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(1), "Timeout restored the pre-preview state.");
            Assert.That(gate.IsActive, Is.False);
        }

        [Test]
        public void SupportedStatesRebuildWhenModeChanges()
        {
            // QA R10 F1 + R11 F1: the cache must rebuild when the fullscreen mode changes at
            // runtime — a stale cache would list every resolution under the OLD mode. The mode
            // source is invoked EXACTLY ONCE per SupportedStates read (no double sampling), and
            // EVERY entry must carry the sampled mode (not just the first). Deterministic via
            // the mode-source seam (the live Screen.fullScreenMode cannot change in the editor).
            FullScreenMode currentMode = FullScreenMode.Windowed;
            int modeSamples = 0;
            var api = new ScreenDisplayApi(() => { modeSamples++; return currentMode; });

            var statesA = api.SupportedStates;
            Assert.That(modeSamples, Is.EqualTo(1), "Exactly ONE mode-source sample per SupportedStates read.");
            Assert.That(statesA, Is.Not.Empty);
            for (int i = 0; i < statesA.Count; i++)
            {
                Assert.That(statesA[i].ScreenMode, Is.EqualTo(FullScreenMode.Windowed), $"Entry {i} stamped with mode A.");
            }
            Assert.That(api.SupportedStates, Is.SameAs(statesA), "Same-mode read returns the cached list (identity).");
            Assert.That(modeSamples, Is.EqualTo(2), "Cached read samples the mode ONCE (for the invalidation check) — never twice.");

            currentMode = FullScreenMode.FullScreenWindow; // runtime mode flip
            var statesB = api.SupportedStates;
            Assert.That(modeSamples, Is.EqualTo(3), "Mode change re-samples exactly once.");
            for (int i = 0; i < statesB.Count; i++)
            {
                Assert.That(statesB[i].ScreenMode, Is.EqualTo(FullScreenMode.FullScreenWindow), $"Entry {i} rebuilt with mode B — no stale mode-A entries.");
            }
            Assert.That(api.SupportedStates, Is.SameAs(statesB), "Stable while mode stays B.");
            Assert.That(modeSamples, Is.EqualTo(4), "Stable-mode cached read samples exactly once.");

            currentMode = FullScreenMode.Windowed; // flip back
            var statesC = api.SupportedStates;
            Assert.That(modeSamples, Is.EqualTo(5), "Flip-back re-samples exactly once.");
            for (int i = 0; i < statesC.Count; i++)
            {
                Assert.That(statesC[i].ScreenMode, Is.EqualTo(FullScreenMode.Windowed), $"Entry {i} rebuilt back to A — no stale mode-B entries.");
            }
        }

        [Test]
        public void ReplacementRetainsSingleFocusSubscription()
        {
            // QA R10 F3: replacing an active candidate must retain exactly ONE focus
            // subscription (the _focusSubscribed guard) and remove it after completion.
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);

            gate.Confirm(new DisplayCandidate(1280, 720, 2), _ => { });
            gate.Confirm(new DisplayCandidate(1600, 900, 2), _ => { }); // replaces A

            Assert.That(focus.SubscriberCount, Is.EqualTo(1), "Replacement keeps exactly one focus subscription (no double-subscribe).");

            gate.KeepChanges();
            Assert.That(focus.SubscriberCount, Is.EqualTo(0), "Unsubscribed after completing the replacement.");
        }

        [Test]
        public void OrchestratorDisposeStopsWarningForwarding()
        {
            // QA R10 F4: disposing the orchestrator must unsubscribe the warning re-route — a
            // later adapter warning must not reach the UI sink.
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi { ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow) };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);
            var forwarded = new List<string>();
            orchestrator.Warning += forwarded.Add;

            orchestrator.Dispose();

            // Trigger a fake-adapter warning AFTER dispose (resolved != requested → warning).
            displayApi.TryResolveRequested(new DisplayState(640, 480, 60, 1, FullScreenMode.FullScreenWindow), out _);
            Assert.That(forwarded.Count, Is.EqualTo(0), "No warning forwarded after Dispose.");
        }

        [Test]
        public void UnchangedDisplayLeavesNoStalePreparedState()
        {
            // QA R11 F3: an unchanged display through the orchestrator must NOT leave a stale
            // prepared state — a later confirmation (RestoreDefaults-style, bypassing the
            // orchestrator) must resolve from the CURRENT display state, not the stale rate.
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            // Working default is DisplayData.Default = 1920x1080, FullscreenMode int 2 (Borderless → FullScreenWindow).
            var displayApi = new FakeDisplayApi
            {
                ResolvedState = new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);

            // Identical request (matches Working default) — a session no-op, no confirmation.
            bool ok = orchestrator.ApplyDisplay(new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow), session);
            Assert.That(ok, Is.True);
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "Identical display does not open a confirmation.");

            // The display's refresh changes externally; a NEW confirmation via the gate directly
            // (RestoreDefaults bypasses the orchestrator) must NOT pick up a stale prepared 60/1.
            displayApi.CurrentStateValue = new DisplayState(1920, 1080, 144, 1, FullScreenMode.FullScreenWindow);
            var results = new List<DisplayConfirmResult>();
            gate.Confirm(new DisplayCandidate(1920, 1080, 2), results.Add); // int 2 = Borderless = FullScreenWindow

            // Successful preview → pending confirmation; the APPLIED state must carry the CURRENT
            // refresh (144/1), not the stale prepared rate (60/1).
            Assert.That(displayApi.AppliedStates.Count, Is.EqualTo(1));
            Assert.That(displayApi.AppliedStates[0].RefreshRateNumerator, Is.EqualTo(144),
                "Confirmation resolves from the CURRENT display refresh — no stale prepared 60/1 (the fix skips PrepareDisplayState on unchanged displays).");

            gate.Cancel(); // complete the pending confirmation (cleanup)
            Assert.That(results, Is.EqualTo(new[] { DisplayConfirmResult.RejectedOrTimeout }));
        }

        [Test]
        public void FallbackToCurrentLeavesNoStalePreparedState()
        {
            // QA R12 F2a: an UNSUPPORTED request that falls back to the current Working display
            // must not prepare — the session treats the resolved (identical) display as a no-op,
            // and a stale prepared state must not linger for a later confirmation. The guard
            // compares the RESOLVED state (what the session receives), not the raw request.
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi
            {
                // Request resolves (nearest fallback) to the current Working default: 1920x1080.
                ResolvedState = new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);

            // Unsupported request (4000x2000) → resolves to 1920x1080 (= Working default).
            bool ok = orchestrator.ApplyDisplay(new DisplayState(4000, 2000, 60, 1, FullScreenMode.FullScreenWindow), session);
            Assert.That(ok, Is.True);
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "Resolved-identical display does not open a confirmation.");

            // The display refresh changes externally; a LATER direct gate confirmation must
            // resolve from the CURRENT state — no stale prepared 60/1 from the fallback.
            displayApi.CurrentStateValue = new DisplayState(1920, 1080, 144, 1, FullScreenMode.FullScreenWindow);
            gate.Confirm(new DisplayCandidate(1920, 1080, 2), _ => { });

            Assert.That(displayApi.AppliedStates.Count, Is.EqualTo(1));
            Assert.That(displayApi.AppliedStates[0].RefreshRateNumerator, Is.EqualTo(144),
                "Fallback-to-current left no stale prepared state — confirmation uses the CURRENT refresh.");

            gate.Cancel(); // cleanup
        }

        [Test]
        public void RefreshOnlyChangeIsUnchangedByDesign()
        {
            // QA R12 F2b design boundary: the candidate seam carries only width/height/mode
            // (refresh is resolved by the gate at SetResolution time — story-readiness R2
            // finding 5), so a request whose RESOLVED dims+mode match Working cannot open a
            // confirmation and its refresh rides ONLY with a dims/mode change. This test proves
            // the guard drops the refresh-only change without leaving a stale prepared state or
            // opening a spurious confirmation — refresh-only selection is not an MVP flow.
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi
            {
                // Same dims+mode as Working default, but a DIFFERENT refresh (75/2 vs current 60/1).
                ResolvedState = new DisplayState(1920, 1080, 75, 2, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);

            bool ok = orchestrator.ApplyDisplay(new DisplayState(1920, 1080, 75, 2, FullScreenMode.FullScreenWindow), session);

            Assert.That(ok, Is.True);
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "Same dims+mode as Working is a no-op — refresh alone does not open a confirmation.");
            Assert.That(gate.IsActive, Is.False, "No gate activity for an unchanged candidate.");

            // A later real confirmation of the SAME candidate (1920x1080 + mode) after the
            // display refresh changed externally must resolve from the CURRENT state — the
            // dropped refresh-only change must leave nothing stale behind. A same-dims candidate
            // would MATCH a stale prepared 75/2, so an always-prepare mutation would be caught.
            displayApi.CurrentStateValue = new DisplayState(1920, 1080, 144, 1, FullScreenMode.FullScreenWindow);
            var results = new List<DisplayConfirmResult>();
            gate.Confirm(new DisplayCandidate(1920, 1080, 2), results.Add);
            Assert.That(displayApi.AppliedStates.Count, Is.EqualTo(1));
            Assert.That(displayApi.AppliedStates[0].RefreshRateNumerator, Is.EqualTo(144),
                "Refresh-only change left no stale prepared state — same-candidate confirmation uses the CURRENT refresh (144/1), not the dropped 75/2.");
            gate.Cancel(); // cleanup
        }

        [Test]
        public void ClosedSessionLeavesNoPreparedState()
        {
            // QA R12 F3: ApplyDisplay on a CLOSED session must not prepare — the session silently
            // ignores SetValue, so a prepared state would be stale for a later confirmation.
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi
            {
                ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);

            session.Cancel(); // close the session
            Assert.That(session.IsOpen, Is.False);

            bool ok = orchestrator.ApplyDisplay(new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow), session);
            Assert.That(ok, Is.True);
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "Closed session never opens a confirmation.");

            // The display refresh changes externally; a LATER direct confirmation of the SAME
            // candidate the closed-session ApplyDisplay would have prepared (1280x720 + mode)
            // must NOT consume a stale prepared 60/1 — it must resolve from the CURRENT 144/1.
            // The same-dims candidate would MATCH a stale prepared state, so a removed
            // session.IsOpen guard would be caught here.
            displayApi.CurrentStateValue = new DisplayState(1920, 1080, 144, 1, FullScreenMode.FullScreenWindow);
            gate.Confirm(new DisplayCandidate(1280, 720, 2), _ => { });
            Assert.That(displayApi.AppliedStates.Count, Is.EqualTo(1));
            Assert.That(displayApi.AppliedStates[0].RefreshRateNumerator, Is.EqualTo(144),
                "Closed-session ApplyDisplay left no stale prepared state (same-candidate confirmation uses the CURRENT refresh).");
            gate.Cancel(); // cleanup
        }

        [Test]
        public void SessionCancelCompletesActiveGateImmediately()
        {
            // QA R14 F1 (scenario 1): session.Cancel() while a display confirmation is active
            // must COMPLETE the real gate — the physical preview is restored immediately, not
            // left applied until the 15s timer or focus loss.
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi
            {
                ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);

            orchestrator.ApplyDisplay(new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow), session);
            Assert.That(gate.IsActive, Is.True, "Confirmation opened.");
            Assert.That(displayApi.AppliedStates.Count, Is.EqualTo(1), "Preview applied.");
            Assert.That(session.HasPendingDisplayConfirm, Is.True);

            session.Cancel();

            Assert.That(session.IsOpen, Is.False);
            Assert.That(gate.IsActive, Is.False, "Gate completed by session Cancel — not left running.");
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(1), "Preview restored IMMEDIATELY — no orphan on the display.");
        }

        [Test]
        public void NonDisplayChangeCompletesPendingGate()
        {
            // QA R14 F1 (scenario 2): a superseding non-display change (VSync) while a
            // confirmation is pending must complete the gate — Apply() must not be able to
            // persist while the physical preview is still applied.
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var displayApi = new FakeDisplayApi
            {
                ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var session = Open(store, lifecycle, gate, out _);
            var orchestrator = new DisplaySettingsOrchestrator(displayApi, new FakeQualityPresetApplier(), gate);

            orchestrator.ApplyDisplay(new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow), session);
            Assert.That(gate.IsActive, Is.True);
            Assert.That(session.HasPendingDisplayConfirm, Is.True);

            // VSync change (Working Display default vsync is 1 → change to 0) supersedes the
            // pending confirmation via the session's immediate-apply path.
            orchestrator.SetVsync(0, session);

            Assert.That(gate.IsActive, Is.False, "Gate completed by the superseding VSync change.");
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(1), "Preview restored — no orphan.");
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "Session latch cleared.");
            ApplyResult apply = session.Apply();
            Assert.That(apply, Is.Not.EqualTo(ApplyResult.DisplayConfirmPending), "Apply is unblocked after the gate completed.");
        }

        [Test]
        public void ZeroRefreshRateSentinelPreservedThroughResolve()
        {
            // QA R14 F2: RefreshRate{0,0} (system-default sentinel, #378) must survive the
            // resolver and the conversion helper untouched.
            var sentinel = new DisplayState(1920, 1080, 0, 0, FullScreenMode.FullScreenWindow);
            Assert.That(DisplayStateResolver.TryResolveNearest(sentinel, new[] { sentinel }, out var resolved), Is.True);
            Assert.That(resolved.RefreshRateNumerator, Is.EqualTo(0), "0/0 numerator survives resolve.");
            Assert.That(resolved.RefreshRateDenominator, Is.EqualTo(0), "0/0 denominator survives resolve.");

            RefreshRate rate = DisplayStateResolver.ToRefreshRate(0, 0);
            Assert.That(rate.numerator, Is.EqualTo(0u), "0/0 sentinel preserved through conversion.");
            Assert.That(rate.denominator, Is.EqualTo(0u));
        }

        [Test]
        public void RefreshRateConversionClampsNegativeValues()
        {
            // QA R14 F3: negative refresh values (invalid — only a defective caller supplies
            // them) are clamped to the 0/0 sentinel release-safely (Debug.Assert alone would not
            // protect release builds). Max int converts losslessly.
            RefreshRate negative = DisplayStateResolver.ToRefreshRate(-1, -2);
            Assert.That(negative.numerator, Is.EqualTo(0u), "Negative numerator clamps to 0/0.");
            Assert.That(negative.denominator, Is.EqualTo(0u));

            // QA R15 F1: MIXED signs must also collapse to 0/0 — a zero denominator alone
            // (60/0) is a division-by-zero hazard; per-component clamping would leak 60/0.
            RefreshRate mixedNum = DisplayStateResolver.ToRefreshRate(-1, 60);
            Assert.That(mixedNum.numerator, Is.EqualTo(0u), "Negative numerator with valid denominator collapses to 0/0.");
            Assert.That(mixedNum.denominator, Is.EqualTo(0u));
            RefreshRate mixedDen = DisplayStateResolver.ToRefreshRate(60, -1);
            Assert.That(mixedDen.numerator, Is.EqualTo(0u), "Valid numerator with negative denominator collapses to 0/0.");
            Assert.That(mixedDen.denominator, Is.EqualTo(0u));

            RefreshRate max = DisplayStateResolver.ToRefreshRate(int.MaxValue, int.MaxValue);
            Assert.That(max.numerator, Is.EqualTo((uint)int.MaxValue), "int.MaxValue converts losslessly.");
            Assert.That(max.denominator, Is.EqualTo((uint)int.MaxValue));
        }

        [Test]
        public void CancelActiveConfirmationIsIdempotentOnRealGate()
        {
            // QA R15 F2: repeated CancelActiveConfirmation must invoke the outcome callback
            // EXACTLY once (the real gate's IsActive guard consumed by the first call) — a
            // second terminal operation must not double-fire the callback or double-restore.
            var displayApi = new FakeDisplayApi
            {
                ResolvedState = new DisplayState(1280, 720, 60, 1, FullScreenMode.FullScreenWindow),
                CurrentStateValue = new DisplayState(1920, 1080, 60, 1, FullScreenMode.FullScreenWindow)
            };
            var focus = new FakeFocusSource();
            var gate = new DisplayConfirmGate(displayApi, focus);
            var results = new List<DisplayConfirmResult>();
            gate.Confirm(new DisplayCandidate(1280, 720, 2), results.Add);
            Assert.That(gate.IsActive, Is.True);

            gate.CancelActiveConfirmation();
            gate.CancelActiveConfirmation(); // repeat — must be a no-op

            Assert.That(results.Count, Is.EqualTo(1), "Outcome fires exactly once.");
            Assert.That(displayApi.RestoreCalls, Is.EqualTo(1), "Preview restored exactly once.");
            Assert.That(gate.IsActive, Is.False);
        }
    }
}
