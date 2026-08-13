using System;
using System.Collections.Generic;
using NUnit.Framework;

namespace Overdrive.Settings.Core.Tests
{
    /// <summary>
    /// Unit tests for the transactional settings edit session (Story 002: SettingsEditSession &amp;
    /// Lifecycle). Engine-free — uses the real <see cref="SettingsBlobService"/> over a fake
    /// <see cref="IPlayerPrefsStore"/>, a fake lifecycle context, and a fake display-confirm gate.
    /// </summary>
    public class SettingsEditSessionTests
    {
        // ------------------------------------------------------------------ //
        // Helpers
        // ------------------------------------------------------------------ //

        private sealed class FakeStore : IPlayerPrefsStore
        {
            public readonly Dictionary<string, string> Data = new Dictionary<string, string>();
            public bool ThrowOnSetString;
            public string GetString(string key) => Data.TryGetValue(key, out string v) ? v : null;
            public bool HasKey(string key) => Data.ContainsKey(key);
            public void SetString(string key, string value)
            {
                if (ThrowOnSetString) throw new InvalidOperationException("Store full.");
                Data[key] = value;
            }
            public void Save() { }
        }

        /// <summary>
        /// Store whose PRIMARY key write always fails (backup succeeds). Used to exercise the
        /// backup-ok-primary-fails path (Apply → PrimaryFailed, backup preserved).
        /// </summary>
        private sealed class FailPrimaryStore : IPlayerPrefsStore
        {
            public readonly Dictionary<string, string> Data = new Dictionary<string, string>();
            public string GetString(string key) => Data.TryGetValue(key, out string v) ? v : null;
            public bool HasKey(string key) => Data.ContainsKey(key);
            public void SetString(string key, string value)
            {
                if (key == SettingsPersistence.PrimaryKey) throw new InvalidOperationException("Primary unreachable.");
                Data[key] = value;
            }
            public void Save() { }
        }

        /// <summary>Gate whose Confirm throws — exercises the gate-failure latch recovery path.</summary>
        private sealed class ThrowingDisplayGate : IDisplayConfirmGate
        {
            public void Confirm(DisplayCandidate candidate, Action<DisplayConfirmResult> onResult)
                => throw new InvalidOperationException("Gate unavailable.");
        }

        /// <summary>Store whose writes can be toggled to fail — exercises Apply retry after transient failure.</summary>
        private sealed class ToggleableFailStore : IPlayerPrefsStore
        {
            public readonly Dictionary<string, string> Data = new Dictionary<string, string>();
            public bool FailWrites;
            public string GetString(string key) => Data.TryGetValue(key, out string v) ? v : null;
            public bool HasKey(string key) => Data.ContainsKey(key);
            public void SetString(string key, string value)
            {
                if (FailWrites) throw new InvalidOperationException("Store unavailable.");
                Data[key] = value;
            }
            public void Save() { }
        }

        /// <summary>Gate that fails once, then behaves normally — exercises retry after transient failure.</summary>
        private sealed class TransientFailingDisplayGate : IDisplayConfirmGate
        {
            private readonly List<Action<DisplayConfirmResult>> _callbacks = new List<Action<DisplayConfirmResult>>();
            private bool _failedOnce;

            public void Confirm(DisplayCandidate candidate, Action<DisplayConfirmResult> onResult)
            {
                if (!_failedOnce)
                {
                    _failedOnce = true;
                    throw new InvalidOperationException("Transient gate failure.");
                }
                _callbacks.Add(onResult);
            }

            public void CompleteLatest(DisplayConfirmResult outcome)
                => _callbacks[_callbacks.Count - 1](outcome);
        }

        private sealed class FakeLifecycleContext : ISettingsLifecycleContext
        {
            public bool CanOpenSettings { get; set; } = true;
            public bool IsDifficultyEditable { get; set; } = true;
        }

        /// <summary>
        /// Gate that records candidates and lets the test invoke a specific callback manually
        /// (simulating the Story 005 gate's async timer, including stale callbacks firing late).
        /// </summary>
        private sealed class FakeDisplayGate : IDisplayConfirmGate
        {
            public readonly List<DisplayCandidate> Candidates = new List<DisplayCandidate>();
            private readonly List<Action<DisplayConfirmResult>> _callbacks = new List<Action<DisplayConfirmResult>>();

            public void Confirm(DisplayCandidate candidate, Action<DisplayConfirmResult> onResult)
            {
                Candidates.Add(candidate);
                _callbacks.Add(onResult);
            }

            /// <summary>Invokes the callback at <paramref name="index"/> (0-based, in confirmation order).</summary>
            public void CompleteAt(int index, DisplayConfirmResult outcome)
            {
                _callbacks[index](outcome);
            }

            /// <summary>Invokes the MOST RECENT callback (the real gate invokes the latest).</summary>
            public void CompleteLatest(DisplayConfirmResult outcome)
            {
                if (_callbacks.Count == 0) throw new InvalidOperationException("No pending confirmation.");
                CompleteAt(_callbacks.Count - 1, outcome);
            }
        }

        private static SettingsBlobService NewBlobService(IPlayerPrefsStore store) =>
            new SettingsBlobService(new SettingsPersistence(store));

        private static SettingsEditSession Open(IPlayerPrefsStore store, FakeLifecycleContext lifecycle, IDisplayConfirmGate gate, out SettingsOpenResult result)
        {
            return SettingsEditSession.TryOpen(NewBlobService(store), lifecycle, gate, null, null, out result);
        }

        // ------------------------------------------------------------------ //
        // AC-ST1: open transitions
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_ST1_ClosedTitleOpensSession()
        {
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var gate = new FakeDisplayGate();

            var session = Open(store, lifecycle, gate, out SettingsOpenResult result);

            Assert.That(result, Is.EqualTo(SettingsOpenResult.Opened));
            Assert.That(session, Is.Not.Null);
            Assert.That(session.IsOpen, Is.True);
            // Snapshot = Working = the loaded values (first launch → defaults).
            Assert.That(session.Snapshot.Version, Is.EqualTo(SettingsSchema.CurrentVersion));
            Assert.That(session.Working.Version, Is.EqualTo(SettingsSchema.CurrentVersion));
        }

        [Test]
        public void AC_ST1_OpenSeedsSnapshotFromPersistedValues()
        {
            var store = new FakeStore();
            var persisted = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                new DifficultySelection(3),
                ControlsData.Default,
                new AudioData(0.7f, 1f, 1f, 1f, false, false),
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);
            store.Data[SettingsPersistence.PrimaryKey] = SettingsJsonCodec.Serialize(persisted);
            var lifecycle = new FakeLifecycleContext();
            var gate = new FakeDisplayGate();

            var session = Open(store, lifecycle, gate, out _);

            Assert.That(session.Snapshot.Audio.Master, Is.EqualTo(0.7f).Within(1e-6f));
            Assert.That(session.Snapshot.Difficulty.Level, Is.EqualTo(3));
        }

        // ------------------------------------------------------------------ //
        // AC-E2: countdown blocking
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_E2_ActiveCountdownBlocksOpen()
        {
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext { CanOpenSettings = false };
            var gate = new FakeDisplayGate();

            var session = Open(store, lifecycle, gate, out SettingsOpenResult result);

            Assert.That(result, Is.EqualTo(SettingsOpenResult.BlockedCountdown));
            Assert.That(session, Is.Null, "No session may be created when blocked.");
        }

        [Test]
        public void AC_E2_PausedCountdownOpensNormally()
        {
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext { CanOpenSettings = true };
            var gate = new FakeDisplayGate();

            var session = Open(store, lifecycle, gate, out SettingsOpenResult result);

            Assert.That(result, Is.EqualTo(SettingsOpenResult.Opened));
            Assert.That(session.IsOpen, Is.True);
        }

        // ------------------------------------------------------------------ //
        // AC-E8: one session at a time + rapid toggle
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_E8_ExistingOpenSessionRejectsSecondOpen()
        {
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var gate = new FakeDisplayGate();
            var first = Open(store, lifecycle, gate, out _);

            var second = SettingsEditSession.TryOpen(NewBlobService(store), lifecycle, gate, null, first, out SettingsOpenResult result);

            Assert.That(result, Is.EqualTo(SettingsOpenResult.SessionActive));
            Assert.That(second, Is.Null, "No duplicate session may be created.");
            Assert.That(first.IsOpen, Is.True, "The existing session is untouched.");
        }

        [Test]
        public void AC_E8_AfterCancelNewOpenSucceeds()
        {
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var gate = new FakeDisplayGate();
            var first = Open(store, lifecycle, gate, out _);
            first.Cancel();

            var second = Open(store, lifecycle, gate, out SettingsOpenResult result);

            Assert.That(result, Is.EqualTo(SettingsOpenResult.Opened));
            Assert.That(second, Is.Not.Null);
            Assert.That(second.IsOpen, Is.True);
        }

        [Test]
        public void AC_E8_RapidOpenApplyCancelNoCorruption()
        {
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var gate = new FakeDisplayGate();

            // Open → modify → cancel → reopen → modify → apply, all in sequence.
            var s1 = Open(store, lifecycle, gate, out _);
            s1.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 1f, 1f, 1f, false, false));
            s1.Cancel();
            Assert.That(s1.IsOpen, Is.False);

            var s2 = Open(store, lifecycle, gate, out _);
            s2.SetValue(SettingsCategory.Audio, new AudioData(0.6f, 1f, 1f, 1f, false, false));
            ApplyResult applied = s2.Apply();

            Assert.That(applied, Is.EqualTo(ApplyResult.Success));
            Assert.That(s2.IsOpen, Is.False);
            // Persisted working, not the cancelled snapshot.
            var outcome = NewBlobService(store).Load();
            Assert.That(outcome.Settings.Audio.Master, Is.EqualTo(0.6f).Within(1e-6f));
        }

        // ------------------------------------------------------------------ //
        // AC-AM1: working preview + notifications
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_AM1_SetValueRaisesWorkingChangedAndUpdatesWorking()
        {
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            var raised = new List<SettingsCategory>();
            session.WorkingChanged += c => raised.Add(c);

            session.SetValue(SettingsCategory.Controls, new ControlsData(0.25f, 0.9f, 0.35f, 0.35f, 0.55f, string.Empty));

            Assert.That(raised, Is.EqualTo(new[] { SettingsCategory.Controls }), "Notification raised synchronously.");
            Assert.That(session.Working.Controls.StickInner, Is.EqualTo(0.25f).Within(1e-6f));
            // Snapshot untouched — preview only.
            Assert.That(session.Snapshot.Controls.StickInner, Is.EqualTo(ControlsData.Default.StickInner).Within(1e-6f));
        }

        [Test]
        public void AC_AM1_DifficultySetValueUpdatesWorking()
        {
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            session.SetValue(SettingsCategory.Difficulty, 4);
            Assert.That(session.Working.Difficulty.Level, Is.EqualTo(4));
        }

        [Test]
        public void AC_AM1_NonDisplayDisplayFieldsApplyImmediately()
        {
            // vsync/quality changes are not candidates — they apply immediately (AC-AM1 edge).
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            var raised = new List<SettingsCategory>();
            session.WorkingChanged += c => raised.Add(c);

            session.SetValue(SettingsCategory.Display, new DisplayData(1920, 1080, 2, 0, 1)); // same res, vsync 0

            Assert.That(raised, Is.EqualTo(new[] { SettingsCategory.Display }));
            Assert.That(session.Working.Display.Vsync, Is.EqualTo(0));
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "Non-candidate display change must not route to the gate.");
        }

        [Test]
        public void AC_AM1_SetValueWrongTypeThrows()
        {
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            Assert.Throws<ArgumentException>(() => session.SetValue(SettingsCategory.Audio, 42));
        }

        [Test]
        public void AC_AM1_SetValueNullThrows()
        {
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            Assert.Throws<ArgumentNullException>(() => session.SetValue(SettingsCategory.Audio, null));
        }

        [Test]
        public void AC_AM1_SetValueOutOfRangeCategoryThrows()
        {
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            Assert.Throws<ArgumentOutOfRangeException>(() => session.SetValue((SettingsCategory)99, 1));
        }

        [Test]
        public void AC_AM1_SetValueAfterCancelIsNoOp()
        {
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            session.Cancel();

            session.SetValue(SettingsCategory.Audio, new AudioData(0.3f, 1f, 1f, 1f, false, false));

            Assert.That(session.Working.Audio.Master, Is.EqualTo(AudioData.Default.Master).Within(1e-6f),
                "No-op when Closed — working must not change.");
        }

        // ------------------------------------------------------------------ //
        // Display routing (AC-E9, AM1 edge)
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_E9_DisplayCandidateRoutesToGateAndDoesNotChangeWorkingWhilePending()
        {
            var store = new FakeStore();
            var session = Open(store, new FakeLifecycleContext(), new FakeDisplayGate(), out _);

            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 1));

            Assert.That(session.HasPendingDisplayConfirm, Is.True, "Resolution candidate must route to the gate.");
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1920),
                "Working.Display must retain prior values while pending.");
        }

        [Test]
        public void AC_E9_DisplayCandidateAcceptedUpdatesWorking()
        {
            var gate = new FakeDisplayGate();
            var session = Open(new FakeStore(), new FakeLifecycleContext(), gate, out _);
            var raised = new List<SettingsCategory>();
            session.WorkingChanged += c => raised.Add(c);

            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 1));
            gate.CompleteLatest(DisplayConfirmResult.Accepted);

            Assert.That(session.HasPendingDisplayConfirm, Is.False);
            Assert.That(session.Working.Display, Is.EqualTo(new DisplayData(2560, 1440, 2, 1, 1)),
                "Accepted candidate replaces Working.Display entirely (fullscreen/vsync/quality preserved from candidate).");
            Assert.That(raised, Is.EqualTo(new[] { SettingsCategory.Display }), "Accepted candidate raises the preview notification.");
        }

        [Test]
        public void AC_E9_DisplayCandidateRejectedKeepsPriorValues()
        {
            var gate = new FakeDisplayGate();
            var session = Open(new FakeStore(), new FakeLifecycleContext(), gate, out _);
            var raised = new List<SettingsCategory>();
            session.WorkingChanged += c => raised.Add(c);

            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 1));
            gate.CompleteLatest(DisplayConfirmResult.RejectedOrTimeout);

            Assert.That(session.HasPendingDisplayConfirm, Is.False);
            Assert.That(session.Working.Display, Is.EqualTo(DisplayData.Default),
                "Rejected candidate keeps the FULL prior DisplayData (GAPS, code review R4).");
            Assert.That(raised.Count, Is.EqualTo(0), "Rejected candidate must not raise a preview notification.");
        }

        [Test]
        public void AC_E9_SecondCandidateReplacesPendingOne()
        {
            var gate = new FakeDisplayGate();
            var session = Open(new FakeStore(), new FakeLifecycleContext(), gate, out _);

            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 1));
            session.SetValue(SettingsCategory.Display, new DisplayData(3840, 2160, 2, 1, 1));

            Assert.That(gate.Candidates.Count, Is.EqualTo(2), "Each candidate must be confirmed.");
            // Stale outcome for the first candidate arrives AFTER the second was selected — no-op.
            gate.CompleteLatest(DisplayConfirmResult.Accepted);

            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(3840), "Latest selection wins.");
            Assert.That(session.HasPendingDisplayConfirm, Is.False);
        }

        [Test]
        public void AC_ST7_ApplyWhileDisplayPendingReturnsDisplayConfirmPending()
        {
            var gate = new FakeDisplayGate();
            var session = Open(new FakeStore(), new FakeLifecycleContext(), gate, out _);
            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 1));

            ApplyResult result = session.Apply();

            Assert.That(result, Is.EqualTo(ApplyResult.DisplayConfirmPending), "Apply is disabled while confirmation is pending (GDD:110).");
            Assert.That(session.IsOpen, Is.True);
        }

        // ------------------------------------------------------------------ //
        // AC-ST7: Apply
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_ST7_ApplySuccessCommitsAndCloses()
        {
            var store = new FakeStore();
            var session = Open(store, new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            GameSettingsData committed = default;
            session.Committed += w => committed = w;

            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 1f, 1f, 1f, false, false));
            ApplyResult result = session.Apply();

            Assert.That(result, Is.EqualTo(ApplyResult.Success));
            Assert.That(session.IsOpen, Is.False, "Session closes on success (AC-ST7).");
            Assert.That(committed.Audio.Master, Is.EqualTo(0.4f).Within(1e-6f), "Committed(working) raised with the persisted values.");
            // Persisted.
            var outcome = NewBlobService(store).Load();
            Assert.That(outcome.Settings.Audio.Master, Is.EqualTo(0.4f).Within(1e-6f));
            Assert.That(outcome.UsedDefaults, Is.False);
        }

        [Test]
        public void AC_ST7_ApplyBackupFailedStaysOpenAndRaisesApplyFailed()
        {
            var store = new FakeStore();
            store.ThrowOnSetString = true;
            var session = Open(store, new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            SaveResult reported = (SaveResult)99;
            session.ApplyFailed += r => reported = r;

            ApplyResult result = session.Apply();

            Assert.That(result, Is.EqualTo(ApplyResult.BackupFailed));
            Assert.That(session.IsOpen, Is.True, "Session stays Open on failure (AC-S5/AC-ST7).");
            Assert.That(reported, Is.EqualTo(SaveResult.BackupFailed), "ApplyFailed raised with the SaveResult.");
        }

        [Test]
        public void AC_ST7_ApplyAfterCancelReturnsAlreadyClosed()
        {
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            session.Cancel();

            ApplyResult result = session.Apply();

            Assert.That(result, Is.EqualTo(ApplyResult.AlreadyClosed));
        }

        // ------------------------------------------------------------------ //
        // AC-ST8: Cancel
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_ST8_CancelRestoresSnapshotAndCloses()
        {
            var store = new FakeStore();
            var session = Open(store, new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            GameSettingsData restored = default;
            session.SnapshotRestored += s => restored = s;

            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 1f, 1f, 1f, false, false));
            session.Cancel();

            Assert.That(session.IsOpen, Is.False, "Session closes on Cancel (AC-ST8).");
            Assert.That(restored.Audio.Master, Is.EqualTo(AudioData.Default.Master).Within(1e-6f),
                "SnapshotRestored raised with the session-start values.");
            // No persistence occurred.
            Assert.That(store.Data.ContainsKey(SettingsPersistence.PrimaryKey), Is.False,
                "Cancel must not persist.");
        }

        // ------------------------------------------------------------------ //
        // AC-E9: Restore Defaults
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_E9_RestoreDefaultsAppliesFactoryDefaultsToAllNonDisplayCategories()
        {
            var store = new FakeStore();
            var session = Open(store, new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            // Seed EVERY non-display category away from defaults (GAPS, code review R4).
            session.SetValue(SettingsCategory.Difficulty, 4);
            session.SetValue(SettingsCategory.Controls, new ControlsData(0.25f, 0.9f, 0.35f, 0.35f, 0.55f, string.Empty));
            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 0.5f, 0.6f, 0.7f, true, true));
            session.SetValue(SettingsCategory.Accessibility, new AccessibilityData(2, 1.25f));
            session.SetValue(SettingsCategory.Camera, new CameraData(0.2f, false, true, true));

            session.RestoreDefaults();

            // Assert EXACT factory defaults per category, not just the seeded ones.
            Assert.That(session.Working.Difficulty.Level, Is.EqualTo(DifficultySelection.Default.Level));
            Assert.That(session.Working.Controls, Is.EqualTo(ControlsData.Default), "Controls fully restored.");
            Assert.That(session.Working.Audio, Is.EqualTo(AudioData.Default), "Audio fully restored (incl. mutes).");
            Assert.That(session.Working.Accessibility, Is.EqualTo(AccessibilityData.Default), "Accessibility fully restored.");
            Assert.That(session.Working.Camera, Is.EqualTo(CameraData.Default), "Camera fully restored.");

            // Persistence deferral: Restore Defaults alone never touches the store.
            Assert.That(store.Data.ContainsKey(SettingsPersistence.PrimaryKey), Is.False,
                "Restore Defaults must not persist — persistence happens only on Apply.");

            // Persistence happens only after Apply.
            Assert.That(session.Apply(), Is.EqualTo(ApplyResult.Success));
            Assert.That(store.Data.ContainsKey(SettingsPersistence.PrimaryKey), Is.True,
                "Apply persists the restored defaults.");
        }

        [Test]
        public void AC_E9_RestoreDefaultsDisplayCandidateRoutesThroughGate()
        {
            // Seed a persisted working display different from the factory defaults so the restore is a candidate.
            var store = new FakeStore();
            var persisted = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                DifficultySelection.Default,
                ControlsData.Default,
                AudioData.Default,
                new DisplayData(2560, 1440, 2, 1, 1),
                AccessibilityData.Default,
                CameraData.Default);
            store.Data[SettingsPersistence.PrimaryKey] = SettingsJsonCodec.Serialize(persisted);
            var gate = new FakeDisplayGate();
            var session = Open(store, new FakeLifecycleContext(), gate, out _);

            session.RestoreDefaults();

            Assert.That(gate.Candidates.Count, Is.EqualTo(1), "Factory display differs from working — must confirm.");
            Assert.That(session.HasPendingDisplayConfirm, Is.True);

            gate.CompleteLatest(DisplayConfirmResult.Accepted);
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1920), "Accepted factory candidate applied.");
        }

        // ------------------------------------------------------------------ //
        // AC-E8: Dispose
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_E8_DisposeOpenSessionCancelsAndCloses()
        {
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 1f, 1f, 1f, false, false));
            GameSettingsData restored = default;
            session.SnapshotRestored += s => restored = s;

            session.Dispose();

            Assert.That(session.IsOpen, Is.False);
            Assert.That(restored.Audio.Master, Is.EqualTo(AudioData.Default.Master).Within(1e-6f),
                "Disposing an open session must restore the snapshot (no orphaned previews).");
        }

        [Test]
        public void AC_E8_DisposeClosedSessionIsSafe()
        {
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            session.Cancel();

            Assert.DoesNotThrow(() => session.Dispose());
            Assert.DoesNotThrow(() => session.Dispose());
        }

        // ------------------------------------------------------------------ //
        // Display-confirm race hardening (code review R1)
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_E9_StaleOutcomeForReplacedCandidateIsNoOp()
        {
            var gate = new FakeDisplayGate();
            var session = Open(new FakeStore(), new FakeLifecycleContext(), gate, out _);

            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 1));
            session.SetValue(SettingsCategory.Display, new DisplayData(3840, 2160, 2, 1, 1));

            // The FIRST candidate's outcome arrives late (after the second replaced it) — no-op.
            gate.CompleteAt(0, DisplayConfirmResult.Accepted);

            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1920),
                "Stale Accepted must not touch Working.");
            Assert.That(session.HasPendingDisplayConfirm, Is.True,
                "The current (second) candidate is still pending.");

            gate.CompleteAt(1, DisplayConfirmResult.Accepted);
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(3840),
                "The current candidate still applies after the stale one.");
        }

        [Test]
        public void AC_E9_LateAcceptedAfterCancelIsNoOp()
        {
            var gate = new FakeDisplayGate();
            var session = Open(new FakeStore(), new FakeLifecycleContext(), gate, out _);
            var raised = new List<SettingsCategory>();
            session.WorkingChanged += c => raised.Add(c);

            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 1));
            session.Cancel();

            // Outcome arrives after the session was cancelled — must not mutate the closed session.
            gate.CompleteLatest(DisplayConfirmResult.Accepted);

            Assert.That(session.IsOpen, Is.False);
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "Cancel invalidates the pending confirmation.");
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1920),
                "Late Accepted must not touch Working after Cancel.");
            Assert.That(raised.Count, Is.EqualTo(0), "No WorkingChanged may fire after Cancel.");
        }

        [Test]
        public void AC_E9_LateOutcomeAfterApplySuccessIsNoOp()
        {
            var gate = new FakeDisplayGate();
            var session = Open(new FakeStore(), new FakeLifecycleContext(), gate, out _);

            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 1));
            // Apply while pending is rejected; resolve via Cancel-free path: first apply the pending
            // check, then cancel the pending via a rejected outcome and apply.
            Assert.That(session.Apply(), Is.EqualTo(ApplyResult.DisplayConfirmPending));
            gate.CompleteLatest(DisplayConfirmResult.RejectedOrTimeout);
            Assert.That(session.Apply(), Is.EqualTo(ApplyResult.Success));

            // A stale Accepted for the rejected candidate arriving after Apply-success is a no-op.
            gate.CompleteAt(0, DisplayConfirmResult.Accepted);

            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1920),
                "Late outcome after close must not mutate Working.");
        }

        [Test]
        public void AC_E8_BlockedLifecycleTakesPrecedenceOverSessionActive()
        {
            // Contract (story Implementation Notes L130): CanOpenSettings is consulted FIRST, then
            // session existence. With lifecycle blocked AND a held session, the result must be
            // BlockedCountdown, not SessionActive.
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext { CanOpenSettings = false };
            var gate = new FakeDisplayGate();
            var held = Open(store, new FakeLifecycleContext(), gate, out _); // open, but a different lifecycle

            var result = SettingsEditSession.TryOpen(NewBlobService(store), lifecycle, gate, null, held, out SettingsOpenResult openResult);

            Assert.That(openResult, Is.EqualTo(SettingsOpenResult.BlockedCountdown),
                "Lifecycle gate is consulted before session existence (story L130).");
            Assert.That(result, Is.Null);
        }

        [Test]
        public void AC_E8_RejectedSecondOpenPreservesExistingSessionState()
        {
            // AC-E8 "no state corruption": a rejected second TryOpen must not disturb the existing
            // session's Snapshot/Working (QA coverage gate gap).
            var store = new FakeStore();
            var lifecycle = new FakeLifecycleContext();
            var gate = new FakeDisplayGate();
            var first = Open(store, lifecycle, gate, out _);
            first.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 1f, 1f, 1f, false, false));
            GameSettingsData snapshotBefore = first.Snapshot;
            GameSettingsData workingBefore = first.Working;

            var rejected = SettingsEditSession.TryOpen(NewBlobService(store), lifecycle, gate, null, first, out SettingsOpenResult result);

            Assert.That(result, Is.EqualTo(SettingsOpenResult.SessionActive));
            Assert.That(rejected, Is.Null);
            Assert.That(first.IsOpen, Is.True);
            Assert.That(first.Snapshot, Is.EqualTo(snapshotBefore), "Rejected open must not mutate Snapshot.");
            Assert.That(first.Working, Is.EqualTo(workingBefore), "Rejected open must not mutate Working.");
        }

        [Test]
        public void AC_E8_RestoreDefaultsAfterCloseIsNoOp()
        {
            // AC-E8: mutating ops are silent no-ops when Closed — RestoreDefaults included.
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 1f, 1f, 1f, false, false));
            session.Cancel();
            GameSettingsData workingAfterCancel = session.Working; // == Snapshot

            session.RestoreDefaults();

            Assert.That(session.Working, Is.EqualTo(workingAfterCancel),
                "RestoreDefaults on a Closed session is a no-op.");
            Assert.That(session.IsOpen, Is.False);
        }

        [Test]
        public void AC_ST7_ApplyBackupOkPrimaryFailsReturnsPrimaryFailed()
        {
            var store = new FailPrimaryStore();
            var session = Open(store, new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 1f, 1f, 1f, false, false));
            SaveResult reported = (SaveResult)99;
            session.ApplyFailed += r => reported = r;

            ApplyResult result = session.Apply();

            Assert.That(result, Is.EqualTo(ApplyResult.PrimaryFailed));
            Assert.That(session.IsOpen, Is.True, "Session stays Open on primary failure (AC-S5).");
            Assert.That(session.Working.Audio.Master, Is.EqualTo(0.4f).Within(1e-6f),
                "Working preserved for retry/Cancel.");
            Assert.That(reported, Is.EqualTo(SaveResult.PrimaryFailed));
            // Backup was written and preserved — a later retry can still roll back.
            Assert.That(store.Data.ContainsKey(SettingsPersistence.BackupKey), Is.True);
        }

        [Test]
        public void AC_ST7_ApplyRetryAfterTransientFailureSucceeds()
        {
            var store = new ToggleableFailStore();
            var session = Open(store, new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 1f, 1f, 1f, false, false));

            // First Apply fails (transient store failure) — session stays Open, Working retained.
            store.FailWrites = true;
            Assert.That(session.Apply(), Is.EqualTo(ApplyResult.BackupFailed));
            Assert.That(session.IsOpen, Is.True);
            Assert.That(session.Working.Audio.Master, Is.EqualTo(0.4f).Within(1e-6f), "Working retained for retry (AC-S5).");

            // Store recovers — retry succeeds, commits, closes, persists.
            store.FailWrites = false;
            Assert.That(session.Apply(), Is.EqualTo(ApplyResult.Success));
            Assert.That(session.IsOpen, Is.False);
            var outcome = NewBlobService(store).Load();
            Assert.That(outcome.Settings.Audio.Master, Is.EqualTo(0.4f).Within(1e-6f), "Retried Apply persists Working.");
        }

        [Test]
        public void AC_E9_RestoreDefaultsAtDefaultsMakesNoGateCalls()
        {
            var gate = new FakeDisplayGate();
            // Fresh session — Working already equals factory defaults.
            var session = Open(new FakeStore(), new FakeLifecycleContext(), gate, out _);

            session.RestoreDefaults();

            Assert.That(gate.Candidates.Count, Is.EqualTo(0),
                "No display candidate when working already matches factory defaults.");
            Assert.That(session.HasPendingDisplayConfirm, Is.False);
        }

        [Test]
        public void AC_E9_RestoreDefaultsRaisesOnlyActuallyChangedCategories()
        {
            var gate = new FakeDisplayGate();
            var session = Open(new FakeStore(), new FakeLifecycleContext(), gate, out _);
            var raised = new List<SettingsCategory>();
            session.WorkingChanged += c => raised.Add(c);

            // Seed a non-default audio, then restore: only Audio (and the display candidate if any)
            // should raise. Default display == factory display → no gate call, no display raise.
            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 1f, 1f, 1f, false, false));
            session.RestoreDefaults();

            Assert.That(raised, Is.EqualTo(new[] { SettingsCategory.Audio, SettingsCategory.Audio }),
                "Audio raises on the seed; only Audio raises again on restore (others already at defaults).");
            Assert.That(gate.Candidates.Count, Is.EqualTo(0), "Factory display equals working display — no candidate.");
            Assert.That(session.Working.Audio.Master, Is.EqualTo(AudioData.Default.Master).Within(1e-6f));
        }

        [Test]
        public void AC_AM1_AccessibilityAndCameraAndAudioRaiseWorkingChanged()
        {
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            var raised = new List<SettingsCategory>();
            session.WorkingChanged += c => raised.Add(c);

            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 1f, 1f, 1f, false, false));
            session.SetValue(SettingsCategory.Accessibility, new AccessibilityData(2, 1.25f));
            session.SetValue(SettingsCategory.Camera, new CameraData(0.2f, false, true, true));

            Assert.That(raised, Is.EqualTo(new[]
            {
                SettingsCategory.Audio,
                SettingsCategory.Accessibility,
                SettingsCategory.Camera
            }));
            Assert.That(session.Working.Audio.Master, Is.EqualTo(0.4f).Within(1e-6f));
            Assert.That(session.Working.Accessibility.ColorblindMode, Is.EqualTo(2));
            Assert.That(session.Working.Camera.ReducedMotion, Is.True);
        }

        [Test]
        public void AC_ST7_ApplyWhilePendingDoesNotPersistOrEmitEvents()
        {
            var store = new FakeStore();
            var gate = new FakeDisplayGate();
            var session = Open(store, new FakeLifecycleContext(), gate, out _);
            var events = new List<string>();
            session.Committed += _ => events.Add("Committed");
            session.ApplyFailed += _ => events.Add("ApplyFailed");
            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 1));

            session.Apply();

            Assert.That(store.Data.ContainsKey(SettingsPersistence.PrimaryKey), Is.False,
                "No persistence while display confirmation pending.");
            Assert.That(events, Is.Empty, "Neither Committed nor ApplyFailed may fire while pending.");
        }

        [Test]
        public void AC_ST7_ThrowingCommittedSubscriberDoesNotBreakApply()
        {
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            session.Committed += _ => throw new InvalidOperationException("boom");

            ApplyResult result = session.Apply();

            Assert.That(result, Is.EqualTo(ApplyResult.Success), "A throwing subscriber must not change the Apply outcome.");
            Assert.That(session.IsOpen, Is.False);
        }

        [Test]
        public void AC_AM1_IdenticalSetValueIsNoOpNoRaise()
        {
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            var raised = new List<SettingsCategory>();
            session.WorkingChanged += c => raised.Add(c);

            // Audio already at default — setting the same value must not raise or rebuild.
            session.SetValue(SettingsCategory.Audio, AudioData.Default);
            // Display already at default — identical resolution/fullscreen/vsync/quality.
            session.SetValue(SettingsCategory.Display, DisplayData.Default);

            Assert.That(raised, Is.Empty, "Identical values are no-ops (no WorkingChanged).");
            Assert.That(session.Working.Audio.Master, Is.EqualTo(AudioData.Default.Master).Within(1e-6f));
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1920));
        }

        [Test]
        public void AC_E9_SupersededDisplaySelectionClearsPendingConfirm()
        {
            var gate = new FakeDisplayGate();
            var session = Open(new FakeStore(), new FakeLifecycleContext(), gate, out _);

            // Pending candidate: 2560×1440 differs from Working (1920×1080) → confirmation armed.
            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 1));
            Assert.That(session.HasPendingDisplayConfirm, Is.True);

            // Restore Defaults: factory display equals the CURRENT Working display (unchanged while
            // pending) → the non-candidate branch runs and must supersede the stale pending confirm.
            session.RestoreDefaults();

            Assert.That(session.HasPendingDisplayConfirm, Is.False,
                "Restore Defaults with a display equal to Working must clear a stale pending confirmation.");
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1920));

            // A late Accepted for the superseded candidate is a no-op (version bumped by invalidation).
            gate.CompleteLatest(DisplayConfirmResult.Accepted);
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1920),
                "Superseded candidate outcome must not apply.");

            // Apply is no longer blocked.
            Assert.That(session.Apply(), Is.EqualTo(ApplyResult.Success));
        }

        [Test]
        public void AC_AM1_DifficultyOutOfRangeThrows()
        {
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            Assert.Throws<ArgumentOutOfRangeException>(() => session.SetValue(SettingsCategory.Difficulty, -1));
            Assert.Throws<ArgumentOutOfRangeException>(() => session.SetValue(SettingsCategory.Difficulty, 5));
            // Boundary values are accepted.
            session.SetValue(SettingsCategory.Difficulty, 0);
            session.SetValue(SettingsCategory.Difficulty, 4);
            Assert.That(session.Working.Difficulty.Level, Is.EqualTo(4));
        }

        [Test]
        public void AC_E9_DisplayGateFailureDoesNotBrickSession()
        {
            var store = new FakeStore();
            var gate = new ThrowingDisplayGate();
            var session = Open(store, new FakeLifecycleContext(), gate, out _);

            // Gate throws on Confirm — the session must not stay pending forever.
            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 1));

            Assert.That(session.HasPendingDisplayConfirm, Is.False,
                "A failing gate must clear the pending latch (Apply not blocked forever).");
            Assert.That(session.Apply(), Is.EqualTo(ApplyResult.Success), "Session remains usable after gate failure.");
        }

        [Test]
        public void AC_E9_DisplayGateRetryAfterFailureRearmsCleanly()
        {
            var store = new FakeStore();
            var gate = new TransientFailingDisplayGate();
            var session = Open(store, new FakeLifecycleContext(), gate, out _);

            // First attempt fails (transient) — latch cleared, generation recycled.
            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 1));
            Assert.That(session.HasPendingDisplayConfirm, Is.False);

            // Retry: the gate works now — the candidate arms and completes normally.
            session.SetValue(SettingsCategory.Display, new DisplayData(3840, 2160, 2, 1, 1));
            Assert.That(session.HasPendingDisplayConfirm, Is.True, "Retry must re-arm the confirmation.");

            gate.CompleteLatest(DisplayConfirmResult.Accepted);
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(3840),
                "Retried candidate applies normally after the transient failure.");
            Assert.That(session.Apply(), Is.EqualTo(ApplyResult.Success));
        }

        [Test]
        public void AC_ST8_CancelResetsWorkingToSnapshot()
        {
            var session = Open(new FakeStore(), new FakeLifecycleContext(), new FakeDisplayGate(), out _);
            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 1f, 1f, 1f, false, false));
            session.SetValue(SettingsCategory.Difficulty, 4);

            session.Cancel();

            Assert.That(session.Working.Audio.Master, Is.EqualTo(session.Snapshot.Audio.Master).Within(1e-6f),
                "Cancel resets Working to Snapshot (no stale edits after close).");
            Assert.That(session.Working.Difficulty.Level, Is.EqualTo(session.Snapshot.Difficulty.Level));
            Assert.That(session.Working, Is.EqualTo(session.Snapshot), "Working fully equals Snapshot after Cancel.");
        }

        [Test]
        public void AC_E9_RestoreDefaultsDisplayRejectedKeepsPriorValues()
        {
            var store = new FakeStore();
            var persisted = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                DifficultySelection.Default,
                ControlsData.Default,
                new AudioData(0.4f, 1f, 1f, 1f, false, false),
                new DisplayData(2560, 1440, 2, 1, 1),
                AccessibilityData.Default,
                CameraData.Default);
            store.Data[SettingsPersistence.PrimaryKey] = SettingsJsonCodec.Serialize(persisted);
            var gate = new FakeDisplayGate();
            var session = Open(store, new FakeLifecycleContext(), gate, out _);

            session.RestoreDefaults();
            gate.CompleteLatest(DisplayConfirmResult.RejectedOrTimeout);

            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(2560),
                "Rejected factory display restore keeps the prior values.");
            Assert.That(session.Working.Display, Is.EqualTo(new DisplayData(2560, 1440, 2, 1, 1)),
                "Rejected candidate keeps the FULL prior DisplayData (fullscreen/vsync/quality).");
            Assert.That(session.HasPendingDisplayConfirm, Is.False);
            // Non-display categories still restored to defaults — Audio was seeded non-default
            // (0.4 master) so this assert is meaningful, not vacuous.
            Assert.That(session.Working.Audio, Is.EqualTo(AudioData.Default),
                "Non-display categories restored to factory defaults despite display rejection.");
        }
    }
}
