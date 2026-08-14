using System;
using System.Collections;
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.Rendering.Universal;
using UnityEngine.TestTools;
using Overdrive.Settings.Core;
namespace Overdrive.Settings.Tests
{
    /// <summary>
    /// PlayMode integration smoke tests for Story 005 (Display Confirm &amp; Quality Presets):
    /// the real <see cref="ScreenDisplayApi"/> (AC-DR1 supported states, idempotent preview)
    /// and the real <see cref="QualityPresetApplier"/> against the active URP pipeline asset
    /// (AC-DR6). Runs in PlayMode because <see cref="Screen.SetResolution"/> is a runtime API —
    /// EditMode has no game-window context. Teardown restores any modified pipeline state.
    /// </summary>
    public class DisplaySettingsIntegrationTests
    {
        private UniversalRenderPipelineAsset _pipelineBefore;
        private float _renderScaleBefore;
        private int _msaaBefore;

        [UnitySetUp]
        public IEnumerator SetUp()
        {
            _pipelineBefore = QualitySettings.renderPipeline as UniversalRenderPipelineAsset;
            if (_pipelineBefore != null)
            {
                _renderScaleBefore = _pipelineBefore.renderScale;
                _msaaBefore = _pipelineBefore.msaaSampleCount;
            }
            yield return null;
        }

        [UnityTearDown]
        public IEnumerator TearDown()
        {
            // Restore the pipeline asset exactly — tests must never leave the project's
            // render pipeline mutated.
            if (_pipelineBefore != null)
            {
                _pipelineBefore.renderScale = _renderScaleBefore;
                _pipelineBefore.msaaSampleCount = _msaaBefore;
            }
            yield return null;
        }

        [UnityTest]
        public IEnumerator AC_DR1_ScreenAdapterExposesSupportedStatesIncludingCurrent()
        {
            var api = new ScreenDisplayApi();
            var supported = api.SupportedStates;
            Assert.That(supported, Is.Not.Empty, "A real screen exposes at least one supported state.");

            // Contract 1 (unconditional): every entry must correspond to a real Screen.resolutions
            // resolution — width, height, AND the refresh-rate fraction + current fullscreen mode
            // (QA R1: matching only dimensions lets a broken refresh/mode pass).
            var resolutions = Screen.resolutions;
            var currentMode = Screen.fullScreenMode;
            for (int i = 0; i < supported.Count; i++)
            {
                bool isReal = false;
                for (int j = 0; j < resolutions.Length; j++)
                {
                    if (supported[i].Width == resolutions[j].width
                        && supported[i].Height == resolutions[j].height
                        && supported[i].RefreshRateNumerator == (int)resolutions[j].refreshRateRatio.numerator
                        && supported[i].RefreshRateDenominator == (int)resolutions[j].refreshRateRatio.denominator
                        && supported[i].ScreenMode == currentMode)
                    {
                        isReal = true;
                        break;
                    }
                }
                Assert.That(isReal, Is.True, $"SupportedStates[{i}] {supported[i].Width}x{supported[i].Height}@" +
                    $"{supported[i].RefreshRateNumerator}/{supported[i].RefreshRateDenominator} {supported[i].ScreenMode} is not a real Screen.resolutions entry.");
            }

            // Contract 2 (unconditional): CurrentState is an HONEST reflection of what Screen
            // reports (window dimensions + display refresh fraction + active mode). A broken
            // adapter that invents a state fails here.
            var current = api.CurrentState;
            var currentRate = Screen.currentResolution.refreshRateRatio;
            Assert.That(current.Width, Is.EqualTo(Screen.width), "CurrentState width must derive from Screen.width.");
            Assert.That(current.Height, Is.EqualTo(Screen.height), "CurrentState height must derive from Screen.height.");
            Assert.That(current.RefreshRateNumerator, Is.EqualTo((int)currentRate.numerator), "CurrentState refresh numerator derives from Screen.currentResolution.");
            Assert.That(current.RefreshRateDenominator, Is.EqualTo((int)currentRate.denominator));
            Assert.That(current.ScreenMode, Is.EqualTo(Screen.fullScreenMode), "CurrentState mode derives from Screen.fullScreenMode.");

            // Contract 3 (deterministic current-inclusion): the ACTIVE DISPLAY resolution
            // (Screen.currentResolution) is by definition a supported resolution — the adapter
            // must list it as the FULL tuple (dimensions + refresh fraction + active mode, QA
            // R5 F4). This proves the AC-DR1 intent (the active state appears in the dropdown)
            // without depending on the editor Game View size, which is NOT a real supported
            // resolution and cannot be changed via Screen.SetResolution in the editor (verified
            // 6000.3.22f1: the Game View is editor-controlled).
            bool containsActiveDisplay = false;
            for (int i = 0; i < supported.Count; i++)
            {
                var s = supported[i];
                if (s.Width == Screen.currentResolution.width
                    && s.Height == Screen.currentResolution.height
                    && s.RefreshRateNumerator == (int)Screen.currentResolution.refreshRateRatio.numerator
                    && s.RefreshRateDenominator == (int)Screen.currentResolution.refreshRateRatio.denominator
                    && s.ScreenMode == Screen.fullScreenMode)
                {
                    containsActiveDisplay = true;
                    break;
                }
            }
            Assert.That(containsActiveDisplay, Is.True, "SupportedStates must include the ACTIVE display resolution as the FULL tuple (AC-DR1).");

            // Contract 5 (QA R7 F2): in a BUILT game the current window is always a supported
            // resolution, so the complete CurrentState tuple must appear in SupportedStates. In
            // the EDITOR the Game View can be an arbitrary size NOT present in Screen.resolutions
            // (verified 6000.3.22f1, project constraint #377) — the editor limitation. Contracts
            // 1+4 above already prove SupportedStates derives 1:1 from Screen.resolutions, so a
            // supported window is included BY CONSTRUCTION; this check covers the runtime case.
            var currentState = api.CurrentState;
            bool windowIsSupported = false;
            for (int j = 0; j < resolutions.Length; j++)
            {
                if (resolutions[j].width == currentState.Width && resolutions[j].height == currentState.Height)
                {
                    windowIsSupported = true;
                    break;
                }
            }
            if (windowIsSupported)
            {
                bool currentPresent = false;
                for (int i = 0; i < supported.Count; i++)
                {
                    if (DisplayStateResolver.SameState(supported[i], currentState))
                    {
                        currentPresent = true;
                        break;
                    }
                }
                Assert.That(currentPresent, Is.True, "SupportedStates must contain the complete CurrentState when the window is a supported resolution (AC-DR1).");
            }

            // Contract 4 (QA R2 F1): 1:1 coverage — SupportedStates must contain EVERY real
            // Screen.resolutions entry (a resolver returning only the active resolution omitting
            // the rest would otherwise pass). Multiset comparison (QA R3 F4): full-tuple → count
            // on BOTH sides, so a duplicate-in-source/different-duplicate-in-adapter mutation
            // fails even though the raw counts match.
            Assert.That(supported.Count, Is.EqualTo(resolutions.Length),
                "SupportedStates count must equal Screen.resolutions count (1:1 coverage).");
            var sourceCounts = new Dictionary<string, int>();
            var adapterCounts = new Dictionary<string, int>();
            for (int j = 0; j < resolutions.Length; j++)
            {
                string key = $"{resolutions[j].width}x{resolutions[j].height}@" +
                    $"{resolutions[j].refreshRateRatio.numerator}/{resolutions[j].refreshRateRatio.denominator}|{(int)currentMode}";
                sourceCounts[key] = sourceCounts.TryGetValue(key, out int c) ? c + 1 : 1;
            }
            for (int i = 0; i < supported.Count; i++)
            {
                string key = $"{supported[i].Width}x{supported[i].Height}@" +
                    $"{supported[i].RefreshRateNumerator}/{supported[i].RefreshRateDenominator}|{(int)supported[i].ScreenMode}";
                adapterCounts[key] = adapterCounts.TryGetValue(key, out int c) ? c + 1 : 1;
            }
            Assert.That(adapterCounts.Count, Is.EqualTo(sourceCounts.Count),
                "SupportedStates and Screen.resolutions must have the same distinct full-tuple set (multiset).");
            foreach (var kv in sourceCounts)
            {
                Assert.That(adapterCounts.TryGetValue(kv.Key, out int adapterCount) && adapterCount == kv.Value,
                    $"Full tuple {kv.Key} appears {kv.Value}x in Screen.resolutions but {adapterCount} in SupportedStates.");
            }
            yield return null;
        }

        [UnityTest]
        public IEnumerator AC_DR1_NearestResolutionResolvesWithoutCrash()
        {
            var api = new ScreenDisplayApi();
            var supported = api.SupportedStates;
            Assert.That(supported.Count, Is.GreaterThan(1), "Requires at least 2 supported states to prove non-first resolution.");

            // QA R3 F2: request a supported state that is NOT the first in the list — an
            // 'always return first' resolver must FAIL. In the current editor environment
            // Screen is 640x480 and supported[0] is 640x480, so requesting CurrentState made
            // the old test tautological.
            var request = supported[1];
            Assert.That(api.TryResolveRequested(request, out var resolved), Is.True);
            Assert.That(DisplayStateResolver.SameState(resolved, request),
                "Exact-match request must resolve to ITSELF (not the first supported state).");
            yield return null;
        }

        [UnityTest]
        public IEnumerator AC_DR3_ApplyPreviewIsIdempotentOnCurrentState()
        {
            var api = new ScreenDisplayApi();
            var current = api.CurrentState;

            // Applying the ALREADY-active state is idempotent — returns Applied without crash.
            DisplayPreviewResult result = api.ApplyPreview(current);
            Assert.That(result, Is.EqualTo(DisplayPreviewResult.Applied));
            // Restore to the same state — no crash on the DR5 rollback path.
            api.Restore(current);
            yield return null;
        }

        [UnityTest]
        public IEnumerator AC_DR6_QualityPresetAppliesToActiveUrpPipeline()
        {
            var applier = new QualityPresetApplier();

            // QA R4: subscribe BEFORE the first apply — the FIRST PresetApplied event must also
            // be observed (suppressing only the first event would otherwise pass).
            var published = new System.Collections.Generic.List<QualityPresetMapping>();
            applier.PresetApplied += published.Add;

            var mapping = applier.ResolveMapping(QualityPresetId.High);
            Assert.That(mapping.PresetId, Is.EqualTo(QualityPresetId.High));
            Assert.That(mapping.RenderScale, Is.EqualTo(1.0f).Within(1e-6f));

            ApplyStatus status = applier.ApplyPreset(mapping);

            // The editor project uses URP — the active pipeline must be a UniversalRenderPipelineAsset.
            if (_pipelineBefore != null)
            {
                Assert.That(status, Is.EqualTo(ApplyStatus.Applied));
                Assert.That(_pipelineBefore.renderScale, Is.EqualTo(1.0f).Within(1e-6f), "renderScale written to the active URP asset.");
                Assert.That(_pipelineBefore.msaaSampleCount, Is.EqualTo((int)MSAASamples.X4), "MSAA written to the active URP asset (QA R2 F11).");
                Assert.That(applier.ActivePreset, Is.EqualTo(QualityPresetId.High));

                // QA R3 F6 + R4: the REAL applier must publish exactly one complete PresetApplied
                // per successful apply — the FIRST event included (counts 1 then 2).
                Assert.That(published.Count, Is.EqualTo(1), "First PresetApplied event observed with the complete mapping.");
                Assert.That(published[0].PresetId, Is.EqualTo(QualityPresetId.High));
                Assert.That(published[0].RenderScale, Is.EqualTo(1.0f).Within(1e-6f));
                Assert.That(published[0].VfxDensity, Is.EqualTo(VfxDensityLevel.High));
                Assert.That(published[0].Shadows, Is.EqualTo(ShadowLevel.Hard));
                Assert.That(published[0].MSAA, Is.EqualTo(MSAASamples.X4));
                Assert.That(published[0].Anisotropic, Is.EqualTo(AnisotropicLevel.ForcedOn));

                ApplyStatus second = applier.ApplyPreset(applier.ResolveMapping(QualityPresetId.High));
                Assert.That(second, Is.EqualTo(ApplyStatus.Applied));
                Assert.That(published.Count, Is.EqualTo(2), "Second successful apply publishes a second event.");
            }
            else
            {
                // No URP asset active (e.g. custom pipeline) — the applier must reject cleanly,
                // never throw.
                Assert.That(status, Is.EqualTo(ApplyStatus.Rejected));
            }
            yield return null;
        }

        [UnityTest]
        public IEnumerator AC_DR6_RejectedPresetLeavesPipelineUntouched()
        {
            // Deterministic non-URP fixture: temporarily clear the active pipeline (QA R1 — the
            // old DoesNotThrow test passed even if ApplyPreset wrongly APPLIED the preset).
            var applier = new QualityPresetApplier();
            var mapping = applier.ResolveMapping(QualityPresetId.Medium);
            var original = QualitySettings.renderPipeline;
            var published = new System.Collections.Generic.List<QualityPresetMapping>();
            applier.PresetApplied += published.Add;

            QualitySettings.renderPipeline = null;
            try
            {
                Assert.That(applier.ApplyPreset(mapping), Is.EqualTo(ApplyStatus.Rejected),
                    "No active pipeline → Rejected (never Applied).");
                Assert.That(applier.ActivePreset, Is.EqualTo(QualityPresetId.Medium), "ActivePreset unchanged on rejection.");
                Assert.That(published.Count, Is.EqualTo(0), "PresetApplied NOT raised on rejection.");
            }
            finally
            {
                QualitySettings.renderPipeline = original;
            }
            yield return null;
        }

        [UnityTest]
        public IEnumerator AC_DR7_MarkCustomOverrideTracksState()
        {
            var applier = new QualityPresetApplier();
            Assert.That(applier.ActivePreset, Is.EqualTo(QualityPresetId.Medium), "Default preset is Medium (matches DisplayData.Default).");
            applier.MarkCustomOverride();
            Assert.That(applier.ActivePreset, Is.EqualTo(QualityPresetId.Custom));
            yield return null;
        }

        [UnityTest]
        public IEnumerator AC_DR2_RealAdapterEmitsWarningOnUnsupportedFallback()
        {
            // QA R5 F2: the REAL ScreenDisplayApi warning behavior — subscribing to its own
            // Warning event and resolving an unsupported request must emit exactly one warning
            // with fallback resolution (removing the Invoke would otherwise pass, because the
            // unit fake duplicates the warning and the old integration tests never observed it).
            var api = new ScreenDisplayApi();
            var warnings = new System.Collections.Generic.List<string>();
            api.Warning += warnings.Add;

            // A resolution just above the largest supported width is GUARANTEED unsupported
            // (QA R6 suggestion — 1x1 is theoretically brittle on exotic displays).
            int maxWidth = 0;
            foreach (var s in api.SupportedStates) maxWidth = System.Math.Max(maxWidth, s.Width);
            var requested = new DisplayState(maxWidth + 1, 720, 60, 1, FullScreenMode.FullScreenWindow);
            Assert.That(api.TryResolveRequested(requested, out var resolved), Is.True);
            Assert.That(warnings.Count, Is.EqualTo(1), "Real adapter emits exactly one warning on fallback.");
            Assert.That(DisplayStateResolver.SameState(resolved, requested), Is.False, "Resolved differs from the unsupported request (fallback happened).");
            yield return null;
        }

        [UnityTest]
        public IEnumerator AC_DR6_AllPresetsApplyThroughRealApplier()
        {
            // QA R5 F3: Low/Medium/High/Ultra through the REAL applier — status, ActivePreset,
            // and the COMPLETE published payload for every preset (hardcoding renderScale=1.0 /
            // MSAA=4 for High alone would otherwise pass).
            var applier = new QualityPresetApplier();
            var published = new System.Collections.Generic.List<QualityPresetMapping>();
            applier.PresetApplied += published.Add;

            if (_pipelineBefore != null)
            {
                var presets = new[] { QualityPresetId.Low, QualityPresetId.Medium, QualityPresetId.High, QualityPresetId.Ultra };
                for (int i = 0; i < presets.Length; i++)
                {
                    QualityPresetId id = presets[i];
                    QualityPresetMapping mapping = applier.ResolveMapping(id);
                    Assert.That(applier.ApplyPreset(mapping), Is.EqualTo(ApplyStatus.Applied), $"{id} applies.");
                    Assert.That(applier.ActivePreset, Is.EqualTo(id));
                    // QA R6 F4: the pipeline must ACTUALLY receive this preset's render scale and
                    // MSAA — hardcoding High/Ultra values (1.0 / 4x) while publishing the correct
                    // mapping would otherwise pass.
                    Assert.That(_pipelineBefore.renderScale, Is.EqualTo(mapping.RenderScale).Within(1e-6f), $"{id} renderScale written to the pipeline.");
                    Assert.That(_pipelineBefore.msaaSampleCount, Is.EqualTo((int)mapping.MSAA), $"{id} MSAA written to the pipeline.");
                    Assert.That(published.Count, Is.EqualTo(i + 1), "Exactly one event per apply.");
                    QualityPresetMapping payload = published[i];
                    Assert.That(payload.PresetId, Is.EqualTo(id), "Published payload matches the preset.");
                    Assert.That(payload.RenderScale, Is.EqualTo(mapping.RenderScale).Within(1e-6f));
                    Assert.That(payload.VfxDensity, Is.EqualTo(mapping.VfxDensity));
                    Assert.That(payload.Shadows, Is.EqualTo(mapping.Shadows));
                    Assert.That(payload.MSAA, Is.EqualTo(mapping.MSAA));
                    Assert.That(payload.Anisotropic, Is.EqualTo(mapping.Anisotropic));
                }
            }
            yield return null;
        }

        [UnityTest]
        public IEnumerator FocusChangeSource_ForwardsRealFocusAndStopsAfterDispose()
        {
            // QA R8 F2: assert the REAL forwarding + unsubscription by invoking the actual
            // Application.focusChanged delegate (engine-driven; the editor cannot lose focus
            // programmatically). Invoking the registered static delegate is the only
            // deterministic way to observe forwarding in the editor. Mutations — removing the
            // += in the ctor, an empty OnFocusChanged, or removing the -= in Dispose — fail.
            var source = new FocusChangeSource();
            var forwards = new System.Collections.Generic.List<bool>();
            source.FocusChanged += forwards.Add;

            try
            {
                InvokeRealFocusChanged(true);
                InvokeRealFocusChanged(false);
                Assert.That(forwards, Is.EqualTo(new[] { true, false }), "Real focus events forwarded in order.");

                source.Dispose();
                int countAfterDispose = forwards.Count;
                InvokeRealFocusChanged(true);
                Assert.That(forwards.Count, Is.EqualTo(countAfterDispose), "No forwarding after Dispose (unsubscribed).");
            }
            finally
            {
                source.Dispose(); // never leak the static subscription, even on assert failure (QA R9 F6)
            }
            yield return null;
        }

        /// <summary>
        /// Invokes the static <see cref="Application.focusChanged"/> delegate (its compiler
        /// backing field) so the real adapter's handler runs. Unity 6 event backing fields use
        /// the event name; the field existence is asserted so a Unity rename fails loudly
        /// (QA R9 F6 hardening).
        /// </summary>
        private static void InvokeRealFocusChanged(bool focused)
        {
            var field = typeof(Application).GetField(
                "focusChanged",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            Assert.That(field, Is.Not.Null, "Application.focusChanged backing field must exist (Unity 6).");
            var del = field.GetValue(null) as Action<bool>;
            del?.Invoke(focused);
        }

        [UnityTest]
        public IEnumerator AC_DR4_ModeRequestIsHonoredByResolver()
        {
            // QA R9 F1 completion: a mode-only request (a SUPPORTED resolution with a different
            // fullscreen mode) must resolve to the REQUESTED mode — the supported list's
            // current-mode stamping must not silently drop the player's mode choice. Pure
            // resolver contract — no SetResolution call (the editor Game View cannot change
            // mode; runtime fidelity is tracked under TD-034).
            var api = new ScreenDisplayApi();
            var baseState = api.SupportedStates[0];
            FullScreenMode otherMode = baseState.ScreenMode == FullScreenMode.Windowed
                ? FullScreenMode.FullScreenWindow
                : FullScreenMode.Windowed;
            var modeOnlyRequest = new DisplayState(
                baseState.Width, baseState.Height, baseState.RefreshRateNumerator, baseState.RefreshRateDenominator, otherMode);

            string warning = null;
            api.Warning += msg => warning = msg;

            Assert.That(api.TryResolveRequested(modeOnlyRequest, out var resolved), Is.True);
            Assert.That(resolved.ScreenMode, Is.EqualTo(otherMode), "The REQUESTED mode is honored, not the current mode.");
            Assert.That(resolved.Width, Is.EqualTo(baseState.Width), "Same resolution preserved.");
            Assert.That(resolved.Height, Is.EqualTo(baseState.Height));
            Assert.That(resolved.RefreshRateNumerator, Is.EqualTo(baseState.RefreshRateNumerator), "Refresh from the supported entry.");
            Assert.That(warning, Is.Null, "No warning — a mode-only change is not a resolution fallback.");
            yield return null;
        }
    }
}
