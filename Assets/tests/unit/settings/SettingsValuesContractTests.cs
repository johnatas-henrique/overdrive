using System;
using System.Collections.Generic;
using NUnit.Framework;

namespace Overdrive.Settings.Core.Tests
{
    /// <summary>
    /// Unit tests for the Settings Values Contract (Story 006): typed value ports, default
    /// reconciliation, domain guards, the runtime preference resolver truth table, and the
    /// edit-session port wiring. Engine-free — uses the real <see cref="SettingsBlobService"/>
    /// over a fake <see cref="IPlayerPrefsStore"/>.
    /// </summary>
    public class SettingsValuesContractTests
    {
        // ------------------------------------------------------------------ //
        // Helpers
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

        private sealed class FakeDisplayGate : IDisplayConfirmGate
        {
            public readonly List<Action<DisplayConfirmResult>> Callbacks = new List<Action<DisplayConfirmResult>>();
            private bool _hasActive;

            public void Confirm(DisplayCandidate candidate, Action<DisplayConfirmResult> onResult)
            {
                Callbacks.Add(onResult);
                _hasActive = true;
            }

            public void CancelActiveConfirmation()
            {
                if (!_hasActive) return;
                _hasActive = false;
                Callbacks[Callbacks.Count - 1](DisplayConfirmResult.RejectedOrTimeout);
            }

            /// <summary>Invokes the MOST RECENT callback (the real gate invokes the latest).</summary>
            public void CompleteLatest(DisplayConfirmResult outcome)
            {
                if (Callbacks.Count == 0) throw new InvalidOperationException("No pending confirmation.");
                _hasActive = false;
                Callbacks[Callbacks.Count - 1](outcome);
            }
        }

        /// <summary>
        /// Gate that RETAINS the callback (simulating a gate that arms before failing) and throws on the
        /// FIRST call only — exercises the qa-tester R2 B1 generation-recycling defect: the retained
        /// callback from the failed candidate must never accept a later candidate via a recycled version.
        /// </summary>
        private sealed class FailOnceThenSucceedGate : IDisplayConfirmGate
        {
            public readonly List<Action<DisplayConfirmResult>> Callbacks = new List<Action<DisplayConfirmResult>>();
            private bool _failed;

            public void Confirm(DisplayCandidate candidate, Action<DisplayConfirmResult> onResult)
            {
                Callbacks.Add(onResult); // retain BEFORE throwing — the failure mode B1 guards against
                if (!_failed)
                {
                    _failed = true;
                    throw new InvalidOperationException("Gate crashed after arming.");
                }
                // Second and later calls succeed (callback retained, no throw).
            }

            public void CancelActiveConfirmation() { }
        }

        private static SettingsEditSession OpenWithWarningSink(
            IPlayerPrefsStore store,
            IDisplayConfirmGate gate,
            Action<string> warningSink,
            AudioSettingsPort audio,
            AccessibilitySettingsPort accessibility,
            CameraSettingsPort camera,
            VfxSettingsPort vfx,
            out SettingsOpenResult result)
        {
            return SettingsEditSession.TryOpen(
                NewBlobService(store), new FakeLifecycleContext(), gate, warningSink, null,
                audio, accessibility, camera, vfx, out result);
        }

        private static SettingsBlobService NewBlobService(IPlayerPrefsStore store) =>
            new SettingsBlobService(new SettingsPersistence(store));

        private static SettingsEditSession Open(
            IPlayerPrefsStore store,
            AudioSettingsPort audio,
            AccessibilitySettingsPort accessibility,
            CameraSettingsPort camera,
            VfxSettingsPort vfx,
            out SettingsOpenResult result)
        {
            return OpenWithGate(store, new FakeDisplayGate(), audio, accessibility, camera, vfx, out result);
        }

        private static SettingsEditSession OpenWithGate(
            IPlayerPrefsStore store,
            IDisplayConfirmGate gate,
            AudioSettingsPort audio,
            AccessibilitySettingsPort accessibility,
            CameraSettingsPort camera,
            VfxSettingsPort vfx,
            out SettingsOpenResult result)
        {
            return SettingsEditSession.TryOpen(
                NewBlobService(store), new FakeLifecycleContext(), gate, null, null,
                audio, accessibility, camera, vfx, out result);
        }

        /// <summary>Captures the last audio update emitted by a port.</summary>
        private sealed class AudioCapture
        {
            public AudioSettingsUpdate? Last;
            public int Count;
            public void Subscribe(AudioSettingsPort port) => port.Updated += u => { Last = u; Count++; };
        }

        /// <summary>Captures the last accessibility update emitted by a port.</summary>
        private sealed class AccessibilityCapture
        {
            public AccessibilityUpdate? Last;
            public int Count;
            public void Subscribe(AccessibilitySettingsPort port) => port.Updated += u => { Last = u; Count++; };
        }

        /// <summary>Captures the last camera update emitted by a port.</summary>
        private sealed class CameraCapture
        {
            public CameraSettingsUpdate? Last;
            public int Count;
            public void Subscribe(CameraSettingsPort port) => port.Updated += u => { Last = u; Count++; };
        }

        /// <summary>Captures the last VFX quality emitted by a port.</summary>
        private sealed class VfxCapture
        {
            public QualityPresetId? Last;
            public int Count;
            public void Subscribe(VfxSettingsPort port) => port.Updated += u => { Last = u; Count++; };
        }

        // ------------------------------------------------------------------ //
        // Defaults reconciliation (gate R2/R5 + unity-specialist BLOCKING)
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_Defaults_AudioDataMatchesGdd()
        {
            // GDD settings.md:146-149 — Master 0.8, Music 0.7, SFX 0.8, UI 0.6.
            Assert.That(AudioData.Default.Master, Is.EqualTo(0.8f).Within(1e-6f));
            Assert.That(AudioData.Default.Music, Is.EqualTo(0.7f).Within(1e-6f));
            Assert.That(AudioData.Default.Sfx, Is.EqualTo(0.8f).Within(1e-6f));
            Assert.That(AudioData.Default.Ui, Is.EqualTo(0.6f).Within(1e-6f));
            Assert.That(AudioData.Default.MuteMusic, Is.False);
            Assert.That(AudioData.Default.MuteSfx, Is.False);
        }

        [Test]
        public void AC_Defaults_CameraDataMatchesGdd()
        {
            // GDD settings.md:158-161 — Shake 1.0, Motion Blur On, Reduced Motion Off, Chase HUD On.
            Assert.That(CameraData.Default.ShakeIntensity, Is.EqualTo(1.0f).Within(1e-6f));
            Assert.That(CameraData.Default.MotionBlur, Is.True);
            Assert.That(CameraData.Default.ReducedMotion, Is.False);
            Assert.That(CameraData.Default.ShowChaseHudInCockpit, Is.True);
        }

        [Test]
        public void AC_Defaults_CodecFallbacksMatchGdd()
        {
            // DeserializeAudio/DeserializeCamera fallbacks must match the new defaults
            // (unity-specialist REQUIRED — Codec_MissingCategoryObjectsUseDefaults would break).
            string json = "{\"version\":3,\"difficulty\":1}";
            var settings = SettingsJsonCodec.Deserialize(json);
            Assert.That(settings.Audio.Master, Is.EqualTo(0.8f).Within(1e-6f));
            Assert.That(settings.Audio.Music, Is.EqualTo(0.7f).Within(1e-6f));
            Assert.That(settings.Audio.Sfx, Is.EqualTo(0.8f).Within(1e-6f));
            Assert.That(settings.Audio.Ui, Is.EqualTo(0.6f).Within(1e-6f));
            Assert.That(settings.Camera.ShakeIntensity, Is.EqualTo(1.0f).Within(1e-6f));
            Assert.That(settings.Camera.ShowChaseHudInCockpit, Is.True);
        }

        [Test]
        public void AC_Defaults_ValidatorShakeMaxIsTwo()
        {
            // unity-specialist BLOCKING: the validator's shake max was 1.0 — it silently destroyed
            // player values 1.5-2.0 on reload. Max 2.0, fallback 1.0 (GDD settings.md:158).
            string json = "{\"version\":3,\"camera\":{\"shake_intensity\":1.5}}";
            string validated = SettingsValidator.Validate(json);
            Assert.That(validated, Does.Contain("1.5"), "A valid 1.5 shake value must be preserved (max is 2.0).");
        }

        [Test]
        public void AC_Defaults_ValidatorShakeOutOfRangeFallsBackToOne()
        {
            string json = "{\"version\":3,\"camera\":{\"shake_intensity\":2.5}}";
            string validated = SettingsValidator.Validate(json);
            // The serializer writes integral doubles without a decimal point (1.0 → "1").
            Assert.That(validated, Does.Not.Contain("2.5"), "Out-of-range 2.5 is replaced.");
            Assert.That(validated, Does.Contain("\"shake_intensity\":1"), "Falls back to 1.0 (serialized as 1).");
        }

        [Test]
        public void AC_Defaults_ValidatorAudioFallbacksMatchGdd()
        {
            // ValidateNumericOrDefault only repairs EXISTING fields — the audio object must exist.
            string json = "{\"version\":3,\"audio\":{\"master\":999}}";
            string validated = SettingsValidator.Validate(json);
            // Master 0.8 falls back into the validated blob (music/sfx/ui untouched by the repair).
            Assert.That(validated, Does.Contain("0.8"));
        }

        // ------------------------------------------------------------------ //
        // Domain guards (gate R3 — explicit rejection, no clamping)
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_E5_TextScaleBoundariesAccepted()
        {
            var store = new FakeStore();
            var session = Open(store, null, null, null, null, out _);
            session.SetValue(SettingsCategory.Accessibility, new AccessibilityData(0, 0.75f));
            session.SetValue(SettingsCategory.Accessibility, new AccessibilityData(0, 2.0f));
            Assert.That(session.Working.Accessibility.TextScale, Is.EqualTo(2.0f));
        }

        [Test]
        public void AC_E5_TextScaleOutOfRangeThrowsAndLeavesWorking()
        {
            var store = new FakeStore();
            var session = Open(store, null, null, null, null, out _);
            Assert.Throws<ArgumentOutOfRangeException>(() =>
                session.SetValue(SettingsCategory.Accessibility, new AccessibilityData(0, 0.74f)));
            Assert.Throws<ArgumentOutOfRangeException>(() =>
                session.SetValue(SettingsCategory.Accessibility, new AccessibilityData(0, 2.01f)));
            Assert.That(session.Working.Accessibility.TextScale, Is.EqualTo(AccessibilityData.Default.TextScale));
        }

        [Test]
        public void AC_E5_InvalidColorblindModeThrows()
        {
            var store = new FakeStore();
            var session = Open(store, null, null, null, null, out _);
            Assert.Throws<ArgumentOutOfRangeException>(() =>
                session.SetValue(SettingsCategory.Accessibility, new AccessibilityData(4, 1.0f)));
            Assert.That(session.Working.Accessibility.ColorblindMode, Is.EqualTo(AccessibilityData.Default.ColorblindMode));
        }

        [Test]
        public void AC_CAM1_ShakeIntensityOutOfRangeThrows()
        {
            var store = new FakeStore();
            var session = Open(store, null, null, null, null, out _);
            Assert.Throws<ArgumentOutOfRangeException>(() =>
                session.SetValue(SettingsCategory.Camera, new CameraData(-0.1f, true, false, true)));
            Assert.Throws<ArgumentOutOfRangeException>(() =>
                session.SetValue(SettingsCategory.Camera, new CameraData(2.1f, true, false, true)));
            Assert.That(session.Working.Camera.ShakeIntensity, Is.EqualTo(CameraData.Default.ShakeIntensity));
        }

        [Test]
        public void AC_Gate_QualityPresetOutOfRangeThrows()
        {
            // Gate R5 — Custom (4) is never persisted; rejected at the Display SetValue guard.
            var store = new FakeStore();
            var session = Open(store, null, null, null, null, out _);
            Assert.Throws<ArgumentOutOfRangeException>(() =>
                session.SetValue(SettingsCategory.Display, new DisplayData(1920, 1080, 2, 1, 4)));
            Assert.Throws<ArgumentOutOfRangeException>(() =>
                session.SetValue(SettingsCategory.Display, new DisplayData(1920, 1080, 2, 1, -1)));
            Assert.That(session.Working.Display.QualityPreset, Is.EqualTo(DisplayData.Default.QualityPreset));
        }

        // ------------------------------------------------------------------ //
        // AC-A1..A5: audio port
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_A1_AudioPortEmitsOnWorkingChange()
        {
            var store = new FakeStore();
            var port = new AudioSettingsPort();
            var capture = new AudioCapture();
            capture.Subscribe(port);
            var session = Open(store, port, null, null, null, out _);

            session.SetValue(SettingsCategory.Audio, new AudioData(0.5f, 0.4f, 0.3f, 0.2f, false, false));

            Assert.That(capture.Count, Is.EqualTo(1));
            Assert.That(capture.Last.Value.MasterVolume, Is.EqualTo(0.5f));
            Assert.That(capture.Last.Value.MusicVolume, Is.EqualTo(0.4f));
            Assert.That(capture.Last.Value.SfxVolume, Is.EqualTo(0.3f));
            Assert.That(capture.Last.Value.UiVolume, Is.EqualTo(0.2f));
        }

        [Test]
        public void AC_A2_UnmuteEmitsStoredVolumeNotMax()
        {
            // AC-A2/AC-E7 — unmute re-emits the STORED MusicVolume (0.7), not max, with MuteMusic false.
            var store = new FakeStore();
            var port = new AudioSettingsPort();
            var capture = new AudioCapture();
            capture.Subscribe(port);
            var session = Open(store, port, null, null, null, out _);

            session.SetValue(SettingsCategory.Audio, new AudioData(0.8f, 0.7f, 0.8f, 0.6f, true, false));
            Assert.That(capture.Last.Value.MuteMusic, Is.True, "Muted state carries the flag with the stored volume intact.");

            session.SetValue(SettingsCategory.Audio, new AudioData(0.8f, 0.7f, 0.8f, 0.6f, false, false));
            Assert.That(capture.Last.Value.MuteMusic, Is.False);
            Assert.That(capture.Last.Value.MusicVolume, Is.EqualTo(0.7f).Within(1e-6f), "Stored volume preserved — never max.");
        }

        [Test]
        public void AC_A3_SfxZeroIsPreserved()
        {
            var store = new FakeStore();
            var port = new AudioSettingsPort();
            var capture = new AudioCapture();
            capture.Subscribe(port);
            var session = Open(store, port, null, null, null, out _);

            session.SetValue(SettingsCategory.Audio, new AudioData(0.8f, 0.7f, 0f, 0.6f, false, false));

            Assert.That(capture.Last.Value.SfxVolume, Is.EqualTo(0f));
        }

        [Test]
        public void AC_A4_UnchangedFieldsPreservedInFullPayload()
        {
            var store = new FakeStore();
            var port = new AudioSettingsPort();
            var capture = new AudioCapture();
            capture.Subscribe(port);
            var session = Open(store, port, null, null, null, out _);

            session.SetValue(SettingsCategory.Audio, new AudioData(0.8f, 0.7f, 0.8f, 0.6f, false, false));
            session.SetValue(SettingsCategory.Audio, new AudioData(0.8f, 0.9f, 0.8f, 0.6f, false, false));

            // Only Music changed (AC-A4: "change Music, carry the rest"); Master/Sfx/Ui/mutes carried
            // through unchanged (full-payload emission).
            Assert.That(capture.Last.Value.MasterVolume, Is.EqualTo(0.8f).Within(1e-6f));
            Assert.That(capture.Last.Value.MusicVolume, Is.EqualTo(0.9f));
            Assert.That(capture.Last.Value.SfxVolume, Is.EqualTo(0.8f).Within(1e-6f));
            Assert.That(capture.Last.Value.UiVolume, Is.EqualTo(0.6f).Within(1e-6f));
        }

        [Test]
        public void AC_A5_AudioPortSynchronousAndDoesNotPersist()
        {
            // Synchronous emission; persistence only via Apply (AC-A5).
            var store = new FakeStore();
            var port = new AudioSettingsPort();
            var capture = new AudioCapture();
            bool emitted = false;
            port.Updated += _ => emitted = true;
            var session = Open(store, port, null, null, null, out _);

            session.SetValue(SettingsCategory.Audio, new AudioData(0.5f, 0.7f, 0.8f, 0.6f, false, false));

            Assert.That(emitted, Is.True, "Emission is synchronous — the handler ran before SetValue returned.");
            Assert.That(store.Data, Is.Empty, "No persistence on emission — Apply only.");
        }

        // ------------------------------------------------------------------ //
        // AC-AC1..AC-AC5: accessibility port
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_AC1_TextScaleLowerBoundaryEmitted()
        {
            var store = new FakeStore();
            var port = new AccessibilitySettingsPort();
            var capture = new AccessibilityCapture();
            capture.Subscribe(port);
            var session = Open(store, null, port, null, null, out _);

            session.SetValue(SettingsCategory.Accessibility, new AccessibilityData(0, 0.75f));

            Assert.That(capture.Last.Value.TextScale, Is.EqualTo(0.75f).Within(1e-6f));
        }

        [Test]
        public void AC_AC2_TextScaleUpperBoundaryEmitted()
        {
            var store = new FakeStore();
            var port = new AccessibilitySettingsPort();
            var capture = new AccessibilityCapture();
            capture.Subscribe(port);
            var session = Open(store, null, port, null, null, out _);

            session.SetValue(SettingsCategory.Accessibility, new AccessibilityData(0, 2.0f));

            Assert.That(capture.Last.Value.TextScale, Is.EqualTo(2.0f).Within(1e-6f));
        }

        [Test]
        public void AC_AC3_PerModePaletteCoversRequiredStates()
        {
            // AC-AC3 — every mode's palette covers Critical/Warning/Normal (AC-AC4 holds for ALL modes).
            foreach (int mode in new[] { 0, 1, 2, 3 })
            {
                var store = new FakeStore();
                var port = new AccessibilitySettingsPort();
                var capture = new AccessibilityCapture();
                capture.Subscribe(port);
                var session = Open(store, null, port, null, null, out _);

                session.SetValue(SettingsCategory.Accessibility, new AccessibilityData(mode, 1.5f));

                Assert.That(capture.Last.Value.Mode, Is.EqualTo(AccessibilitySettingsPort.ToColorblindMode(mode)), $"Mode {mode} maps to its enum.");
                Assert.That(HasState(capture.Last.Value.Cues, PaletteStateIds.Critical), Is.True, $"Mode {mode} covers critical.");
                Assert.That(HasState(capture.Last.Value.Cues, PaletteStateIds.Warning), Is.True, $"Mode {mode} covers warning.");
                Assert.That(HasState(capture.Last.Value.Cues, PaletteStateIds.Normal), Is.True, $"Mode {mode} covers normal.");
            }
        }

        [Test]
        public void AC_AC4_EveryCueHasLabelAndPatternOrShape()
        {
            // AC-AC4 — every emitted cue carries a non-empty label AND at least one cue, across EVERY
            // colorblind mode (metadata is structurally identical per AC-AC3/AC-AC4; color is deferred).
            foreach (var mode in new[] { ColorblindMode.None, ColorblindMode.Protanopia, ColorblindMode.Deuteranopia, ColorblindMode.Tritanopia })
            {
                var cues = AccessibilitySettingsPort.BuildPaletteCues(mode);
                Assert.That(cues, Has.Length.EqualTo(3), $"Mode {mode} emits Critical/Warning/Normal.");
                foreach (var cue in cues)
                {
                    Assert.That(string.IsNullOrEmpty(cue.Label), Is.False, $"State {cue.StateId} must have a non-empty label.");
                    Assert.That(cue.HasPatternCue || cue.HasShapeCue, Is.True, $"State {cue.StateId} must carry a pattern or shape cue.");
                }
            }
        }

        [Test]
        public void AC_AC5_AccessibilityEmissionSynchronousNoPersistence()
        {
            var store = new FakeStore();
            var port = new AccessibilitySettingsPort();
            bool emitted = false;
            port.Updated += _ => emitted = true;
            var session = Open(store, null, port, null, null, out _);

            session.SetValue(SettingsCategory.Accessibility, new AccessibilityData(1, 1.2f));

            Assert.That(emitted, Is.True);
            Assert.That(store.Data, Is.Empty);
        }

        [Test]
        public void AC_Gate_AccessibilityResolvesReducedMotionFromCamera()
        {
            // Gate R2/R4 — the accessibility update resolves ReducedMotion from the camera Working at
            // emission (never stored); camera changes republish accessibility with the fresh value.
            var store = new FakeStore();
            var accessibility = new AccessibilitySettingsPort();
            var camera = new CameraSettingsPort();
            var accCapture = new AccessibilityCapture();
            accCapture.Subscribe(accessibility);
            var camCapture = new CameraCapture();
            camCapture.Subscribe(camera);
            var session = Open(store, null, accessibility, camera, null, out _);

            // Reduce motion via the camera category — accessibility must republish with ReducedMotion = true.
            session.SetValue(SettingsCategory.Camera, new CameraData(1.0f, true, true, true));

            Assert.That(camCapture.Last.Value.ReducedMotion, Is.True);
            Assert.That(accCapture.Last.Value.ReducedMotion, Is.True, "Accessibility republishes with the resolved camera ReducedMotion.");
        }

        // ------------------------------------------------------------------ //
        // AC-CAM1..CAM3, CAM5: camera port
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_CAM1_ShakeIntensityMapped()
        {
            var store = new FakeStore();
            var port = new CameraSettingsPort();
            var capture = new CameraCapture();
            capture.Subscribe(port);
            var session = Open(store, null, null, port, null, out _);

            session.SetValue(SettingsCategory.Camera, new CameraData(1.5f, true, false, true));

            Assert.That(capture.Last.Value.ShakeIntensity, Is.EqualTo(1.5f).Within(1e-6f));
        }

        [Test]
        public void AC_CAM2_MotionBlurMapped()
        {
            var store = new FakeStore();
            var port = new CameraSettingsPort();
            var capture = new CameraCapture();
            capture.Subscribe(port);
            var session = Open(store, null, null, port, null, out _);

            session.SetValue(SettingsCategory.Camera, new CameraData(1.5f, true, false, true));
            Assert.That(capture.Last.Value.MotionBlur, Is.True);

            session.SetValue(SettingsCategory.Camera, new CameraData(1.5f, false, false, true));
            Assert.That(capture.Last.Value.MotionBlur, Is.False);
        }

        [Test]
        public void AC_CAM3_CameraPortSynchronous()
        {
            var store = new FakeStore();
            var port = new CameraSettingsPort();
            bool emitted = false;
            port.Updated += _ => emitted = true;
            var session = Open(store, null, null, port, null, out _);

            session.SetValue(SettingsCategory.Camera, new CameraData(1.5f, true, false, true));

            Assert.That(emitted, Is.True);
            Assert.That(store.Data, Is.Empty);
        }

        [Test]
        public void AC_CAM5_ShowChaseHudDefaultOn()
        {
            // GDD settings.md:161 / ADR-0014 / TR-settings-007 — cockpit chase HUD defaults On.
            var store = new FakeStore();
            var port = new CameraSettingsPort();
            var capture = new CameraCapture();
            capture.Subscribe(port);
            var session = Open(store, null, null, port, null, out _);

            Assert.That(session.Working.Camera.ShowChaseHudInCockpit, Is.True, "Factory default is On.");

            session.SetValue(SettingsCategory.Camera, new CameraData(1.0f, true, false, false));
            Assert.That(capture.Last.Value.ShowChaseHudInCockpit, Is.False, "Explicit Off is emitted.");
        }

        // ------------------------------------------------------------------ //
        // AC-CAM4, CAM6, E10: runtime preference resolver truth table
        // ------------------------------------------------------------------ //

        private static readonly CameraSettingsUpdate Saved = new CameraSettingsUpdate(
            reducedMotion: false, shakeIntensity: 1.5f, motionBlur: true, showChaseHudInCockpit: true);

        [Test]
        public void AC_CAM4_ReducedMotionSuppressesAndPreservesSaved()
        {
            var resolver = new RuntimePreferenceResolver();

            var prefs = resolver.Resolve(Saved, QualityPresetId.High, new OverrideState(false, true));

            Assert.That(prefs.ReducedMotionEffective, Is.True);
            Assert.That(prefs.ShakeIntensityEffective, Is.EqualTo(0f), "Shake suppressed.");
            Assert.That(prefs.MotionBlurEffective, Is.False, "Motion blur suppressed.");
            Assert.That(prefs.DynamicFovSuppressed, Is.True);
            Assert.That(prefs.LookAheadSuppressed, Is.True);
            // Saved input bit-identical — the pure merge never rewrites the saved snapshot.
            Assert.That(prefs.SavedVfxQuality, Is.EqualTo(QualityPresetId.High));
            Assert.That(Saved.ShakeIntensity, Is.EqualTo(1.5f), "Saved input is never mutated.");
            Assert.That(Saved.MotionBlur, Is.True);
        }

        [Test]
        public void AC_CAM6_SavedMotionBlurRestoredWhenOverrideClears()
        {
            var resolver = new RuntimePreferenceResolver();

            var reduced = resolver.Resolve(Saved, QualityPresetId.Medium, new OverrideState(false, true));
            Assert.That(reduced.MotionBlurEffective, Is.False);

            var restored = resolver.Resolve(Saved, QualityPresetId.Medium, new OverrideState(false, false));
            Assert.That(restored.MotionBlurEffective, Is.True, "Saved Motion Blur restored once the override clears.");
            Assert.That(restored.ShakeIntensityEffective, Is.EqualTo(1.5f).Within(1e-6f));
        }

        [Test]
        public void AC_E10_PerformanceReducedForcesLowDensityPreservesSaved()
        {
            var resolver = new RuntimePreferenceResolver();

            var prefs = resolver.Resolve(Saved, QualityPresetId.Ultra, new OverrideState(true, false));

            Assert.That(prefs.EffectiveVfxDensity, Is.EqualTo(VfxDensityLevel.Low), "PerformanceReduced forces density Low (not the whole preset).");
            Assert.That(prefs.SavedVfxQuality, Is.EqualTo(QualityPresetId.Ultra), "Saved preset NEVER rewritten.");
        }

        [Test]
        public void AC_Gate_NoOverrideIsPassthrough()
        {
            var resolver = new RuntimePreferenceResolver();

            var prefs = resolver.Resolve(Saved, QualityPresetId.Ultra, new OverrideState(false, false));

            Assert.That(prefs.ReducedMotionEffective, Is.False);
            Assert.That(prefs.ShakeIntensityEffective, Is.EqualTo(1.5f).Within(1e-6f));
            Assert.That(prefs.MotionBlurEffective, Is.True);
            Assert.That(prefs.DynamicFovSuppressed, Is.False);
            Assert.That(prefs.LookAheadSuppressed, Is.False);
            Assert.That(prefs.EffectiveVfxDensity, Is.EqualTo(VfxDensityLevel.Ultra));
        }

        [Test]
        public void AC_Gate_SavedReducedMotionSuppressesWithoutOverride()
        {
            // ReducedMotionEffective = override || saved — a saved reduced-motion flag suppresses too.
            var resolver = new RuntimePreferenceResolver();
            var savedRm = new CameraSettingsUpdate(true, 1.0f, true, true);

            var prefs = resolver.Resolve(savedRm, QualityPresetId.Medium, new OverrideState(false, false));

            Assert.That(prefs.ReducedMotionEffective, Is.True);
            Assert.That(prefs.ShakeIntensityEffective, Is.EqualTo(0f));
        }

        [Test]
        public void AC_Gate_DensityIdentityMapping()
        {
            var resolver = new RuntimePreferenceResolver();
            Assert.That(RuntimePreferenceResolver.PresetToDensity(QualityPresetId.Low), Is.EqualTo(VfxDensityLevel.Low));
            Assert.That(RuntimePreferenceResolver.PresetToDensity(QualityPresetId.Medium), Is.EqualTo(VfxDensityLevel.Medium));
            Assert.That(RuntimePreferenceResolver.PresetToDensity(QualityPresetId.High), Is.EqualTo(VfxDensityLevel.High));
            Assert.That(RuntimePreferenceResolver.PresetToDensity(QualityPresetId.Ultra), Is.EqualTo(VfxDensityLevel.Ultra));
            Assert.Throws<ArgumentOutOfRangeException>(() =>
                RuntimePreferenceResolver.PresetToDensity(QualityPresetId.Custom), "Custom never reaches the resolver (gate R5).");
        }

        // ------------------------------------------------------------------ //
        // Session wiring: publication order, batch, re-entrancy, overload pair
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_Gate_PublicationOrderCameraAccessibilityAudioVfx()
        {
            var store = new FakeStore();
            var audio = new AudioSettingsPort();
            var accessibility = new AccessibilitySettingsPort();
            var camera = new CameraSettingsPort();
            var vfx = new VfxSettingsPort();
            var order = new List<string>();
            audio.Updated += _ => order.Add("audio");
            accessibility.Updated += _ => order.Add("accessibility");
            camera.Updated += _ => order.Add("camera");
            vfx.Updated += _ => order.Add("vfx");
            var session = Open(store, audio, accessibility, camera, vfx, out _);

            session.SetValue(SettingsCategory.Camera, new CameraData(1.5f, true, false, true));

            Assert.That(order, Is.EqualTo(new[] { "camera", "accessibility", "audio", "vfx" }),
                "Fixed publication order — Camera → Accessibility (resolved ReducedMotion) → Audio → Vfx.");
        }

        [Test]
        public void AC_Gate_VfxEmitsQualityPreset()
        {
            var store = new FakeStore();
            var vfx = new VfxSettingsPort();
            var capture = new VfxCapture();
            capture.Subscribe(vfx);
            var session = Open(store, null, null, null, vfx, out _);

            session.SetValue(SettingsCategory.Display, new DisplayData(1920, 1080, 2, 1, 3));

            Assert.That(capture.Last, Is.EqualTo(QualityPresetId.Ultra), "Display quality preset int 3 → Ultra.");
        }

        [Test]
        public void AC_Gate_RestoreDefaultsPublishesOnce()
        {
            // unity-specialist BLOCKING — RestoreDefaults must publish the ports ONCE (batch mode),
            // not 5× per SetValue with partially-updated Working.
            var store = new FakeStore();
            var audio = new AudioSettingsPort();
            var accessibility = new AccessibilitySettingsPort();
            var camera = new CameraSettingsPort();
            var vfx = new VfxSettingsPort();
            var audioCount = 0;
            var accCount = 0;
            var camCount = 0;
            var vfxCount = 0;
            audio.Updated += _ => audioCount++;
            accessibility.Updated += _ => accCount++;
            camera.Updated += _ => camCount++;
            vfx.Updated += _ => vfxCount++;
            var session = Open(store, audio, accessibility, camera, vfx, out _);

            session.RestoreDefaults();

            Assert.That(audioCount, Is.EqualTo(1), "Audio published once.");
            Assert.That(accCount, Is.EqualTo(1), "Accessibility published once.");
            Assert.That(camCount, Is.EqualTo(1), "Camera published once.");
            Assert.That(vfxCount, Is.EqualTo(1), "Vfx published once.");
        }

        [Test]
        public void AC_Gate_RestoreDefaultsEmitsFreshResolvedReducedMotion()
        {
            // After RestoreDefaults the camera Working is the default (ReducedMotion false) — the
            // accessibility publication must carry the POST-cascade resolved value, never stale.
            var store = new FakeStore();
            var accessibility = new AccessibilitySettingsPort();
            var camera = new CameraSettingsPort();
            AccessibilityUpdate? lastAcc = null;
            accessibility.Updated += u => lastAcc = u;
            var session = Open(store, null, accessibility, camera, null, out _);

            // Pre-set a reduced-motion camera so the cascade actually changes it.
            session.SetValue(SettingsCategory.Camera, new CameraData(1.0f, true, true, true));
            session.RestoreDefaults();

            Assert.That(lastAcc.Value.ReducedMotion, Is.False, "Post-cascade camera default (ReducedMotion false) resolved fresh.");
        }

        [Test]
        public void AC_Gate_ReentrantMutationFromPortHandlerThrows()
        {
            var store = new FakeStore();
            var audio = new AudioSettingsPort();
            var session = Open(store, audio, null, null, null, out _);
            // A port handler mutating the session during publication is rejected by the re-entrancy
            // guard; SafePublish (unity-specialist R1) contains the throw → warning sink, the session
            // transition completes, and Working keeps the EXTERNAL value (the reentrant mutation never
            // lands).
            audio.Updated += _ => session.SetValue(SettingsCategory.Audio, new AudioData(0.1f, 0.1f, 0.1f, 0.1f, false, false));

            session.SetValue(SettingsCategory.Audio, new AudioData(0.5f, 0.7f, 0.8f, 0.6f, false, false));

            Assert.That(session.Working.Audio.Master, Is.EqualTo(0.5f),
                "Working keeps the external value; the reentrant mutation is rejected.");
            Assert.That(session.IsOpen, Is.True, "Session survives the guarded reentrant attempt.");
        }

        [Test]
        public void AC_Gate_NullPortsAreNoOpPublishers()
        {
            // The 5-arg overload (no ports) is source-compatible and publishes nothing.
            var store = new FakeStore();
            SettingsOpenResult result;
            var session = SettingsEditSession.TryOpen(
                NewBlobService(store), new FakeLifecycleContext(), new FakeDisplayGate(), null, null, out result);

            Assert.That(result, Is.EqualTo(SettingsOpenResult.Opened));
            Assert.That(session.Audio, Is.Null, "No ports configured — properties are null.");
            Assert.That(session.Camera, Is.Null);
            session.SetValue(SettingsCategory.Audio, new AudioData(0.5f, 0.7f, 0.8f, 0.6f, false, false));
            Assert.That(session.Working.Audio.Master, Is.EqualTo(0.5f), "SetValue still works without ports.");
        }

        [Test]
        public void AC_Gate_PortsExposedAsProperties()
        {
            var store = new FakeStore();
            var audio = new AudioSettingsPort();
            var accessibility = new AccessibilitySettingsPort();
            var camera = new CameraSettingsPort();
            var vfx = new VfxSettingsPort();
            var session = Open(store, audio, accessibility, camera, vfx, out _);

            Assert.That(session.Audio, Is.SameAs(audio));
            Assert.That(session.Accessibility, Is.SameAs(accessibility));
            Assert.That(session.Camera, Is.SameAs(camera));
            Assert.That(session.Vfx, Is.SameAs(vfx));
        }

        // ------------------------------------------------------------------ //
        // QualityPresetId enum move (gate R4 — enums now live in Core)
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_Gate_QualityPresetEnumsLiveInCore()
        {
            // The enums moved from Overdrive.Settings to Overdrive.Settings.Core — this test (in the
            // engine-free Core test assembly) references them directly, proving the move.
            Assert.That((int)QualityPresetId.Low, Is.EqualTo(0));
            Assert.That((int)QualityPresetId.Custom, Is.EqualTo(4));
            Assert.That((int)VfxDensityLevel.Ultra, Is.EqualTo(3));
        }

        [Test]
        public void AC_Gate_InvalidPersistedQualityFallsBackToMedium()
        {
            // Gate R5: out-of-range persisted quality must fall back to Medium (1) at load — the
            // validator repairs it before deserialization (99 would otherwise map to Ultra in
            // ToQualityPresetId, violating the R5 contract).
            string json = "{\"version\":3,\"display\":{\"quality_preset\":99}}";
            string validated = SettingsValidator.Validate(json);
            Assert.That(validated, Does.Not.Contain("99"), "Out-of-range 99 is replaced.");
            Assert.That(validated, Does.Contain("\"quality_preset\":1"), "Falls back to Medium (1, serialized as 1).");
        }

        [Test]
        public void AC_Gate_InvalidPersistedColorblindModeFallsBackToNone()
        {
            // qa-tester R1: invalid persisted colorblind int must be repaired at load, consistent with
            // the quality_preset repair (99 would otherwise silently map to None at emission).
            string json = "{\"version\":3,\"accessibility\":{\"colorblind_mode\":99}}";
            string validated = SettingsValidator.Validate(json);
            Assert.That(validated, Does.Not.Contain("99"), "Out-of-range 99 is replaced.");
            Assert.That(validated, Does.Contain("\"colorblind_mode\":0"), "Falls back to None (0, serialized as 0).");
        }

        [Test]
        public void AC_Gate_ControlsAndDifficultyMutationsPublishFullPayload()
        {
            // qa-tester R1: every Working mutation category must publish the full payload through all
            // four ports — Controls and Difficulty were untested (audio/camera only).
            var store = new FakeStore();
            var audio = new AudioSettingsPort();
            var accessibility = new AccessibilitySettingsPort();
            var camera = new CameraSettingsPort();
            var vfx = new VfxSettingsPort();
            var audioCapture = new AudioCapture();
            var accessibilityCapture = new AccessibilityCapture();
            var cameraCapture = new CameraCapture();
            var vfxCapture = new VfxCapture();
            audioCapture.Subscribe(audio);
            accessibilityCapture.Subscribe(accessibility);
            cameraCapture.Subscribe(camera);
            vfxCapture.Subscribe(vfx);
            var session = Open(store, audio, accessibility, camera, vfx, out _);

            // Difficulty mutation (level 3, non-default) publishes all four ports.
            session.SetValue(SettingsCategory.Difficulty, 3);
            Assert.That(cameraCapture.Count, Is.EqualTo(1), "Camera publishes on Difficulty change.");
            Assert.That(accessibilityCapture.Count, Is.EqualTo(1), "Accessibility publishes on Difficulty change.");
            Assert.That(audioCapture.Count, Is.EqualTo(1), "Audio publishes on Difficulty change.");
            Assert.That(vfxCapture.Count, Is.EqualTo(1), "Vfx publishes on Difficulty change.");

            // Controls mutation (custom dead zone) publishes all four ports with the full payload.
            session.SetValue(SettingsCategory.Controls, new ControlsData(0.2f, 0.9f, 0.4f, 0.4f, 0.6f, string.Empty));
            Assert.That(cameraCapture.Count, Is.EqualTo(2));
            Assert.That(accessibilityCapture.Count, Is.EqualTo(2));
            Assert.That(audioCapture.Count, Is.EqualTo(2));
            Assert.That(vfxCapture.Count, Is.EqualTo(2));
        }

        [Test]
        public void AC_E10_BothOverridesActiveForceLowAndSuppressMotion()
        {
            // qa-tester R1: AC-E10 requires BOTH PerformanceReduced and ReducedMotion active in the same
            // resolution — Low density AND all motion suppression fields together.
            var saved = new CameraSettingsUpdate(true, 1.5f, true, true); // ReducedMotion saved on
            var resolver = new RuntimePreferenceResolver();
            var overrides = new OverrideState(performanceReduced: true, reducedMotionOverride: true);

            RuntimePreferences p = resolver.Resolve(saved, QualityPresetId.Ultra, overrides);

            Assert.That(p.ReducedMotionEffective, Is.True);
            Assert.That(p.ShakeIntensityEffective, Is.EqualTo(0f));
            Assert.That(p.MotionBlurEffective, Is.False);
            Assert.That(p.DynamicFovSuppressed, Is.True);
            Assert.That(p.LookAheadSuppressed, Is.True);
            Assert.That(p.EffectiveVfxDensity, Is.EqualTo(VfxDensityLevel.Low), "PerformanceReduced forces Low regardless of preset.");
            Assert.That(p.SavedVfxQuality, Is.EqualTo(QualityPresetId.Ultra), "Saved preset never rewritten.");
        }

        [Test]
        public void AC_Gate_ShakeAndQualityBoundariesAccepted()
        {
            // qa-tester R1: exact domain boundaries must be accepted — shake 0.0 and 2.0, quality 0 (Low).
            var store = new FakeStore();
            var vfx = new VfxSettingsPort();
            var vfxCapture = new VfxCapture();
            vfxCapture.Subscribe(vfx);
            var camera = new CameraSettingsPort();
            var cameraCapture = new CameraCapture();
            cameraCapture.Subscribe(camera);
            var session = Open(store, null, null, camera, vfx, out _);

            session.SetValue(SettingsCategory.Camera, new CameraData(0.0f, true, false, true));
            Assert.That(cameraCapture.Last.Value.ShakeIntensity, Is.EqualTo(0f));
            session.SetValue(SettingsCategory.Camera, new CameraData(2.0f, true, false, true));
            Assert.That(cameraCapture.Last.Value.ShakeIntensity, Is.EqualTo(2f));

            // Quality 0 (Low) through the immediate display path.
            session.SetValue(SettingsCategory.Display, new DisplayData(1920, 1080, 2, 1, 0));
            Assert.That(vfxCapture.Last.Value, Is.EqualTo(QualityPresetId.Low));
        }

        [Test]
        public void AC_Gate_CancelDoesNotRepublishPorts()
        {
            // qa-tester R1 GAP: Cancel restores Snapshot but does NOT republish ports — the ports are a
            // Working preview projection; runtime restore is via SnapshotRestored (session closed).
            var store = new FakeStore();
            var audio = new AudioSettingsPort();
            var audioCapture = new AudioCapture();
            audioCapture.Subscribe(audio);
            var session = Open(store, audio, null, null, null, out _);

            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 0.7f, 0.8f, 0.6f, false, false));
            Assert.That(audioCapture.Count, Is.EqualTo(1));

            session.Cancel();
            Assert.That(audioCapture.Count, Is.EqualTo(1), "Cancel does not re-publish the ports.");

            session.Dispose();
            Assert.That(audioCapture.Count, Is.EqualTo(1), "Dispose does not re-publish the ports.");
        }

        [Test]
        public void AC_Gate_ApplyDoesNotDoubleFirePorts()
        {
            // qa-tester R1 GAP: Apply persists Working but emits NO additional port publications
            // (ports fire on Working mutations, not on persistence).
            var store = new FakeStore();
            var audio = new AudioSettingsPort();
            var audioCapture = new AudioCapture();
            audioCapture.Subscribe(audio);
            var session = Open(store, audio, null, null, null, out _);

            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 0.7f, 0.8f, 0.6f, false, false));
            Assert.That(audioCapture.Count, Is.EqualTo(1));

            Assert.That(session.Apply(), Is.EqualTo(ApplyResult.Success));
            Assert.That(audioCapture.Count, Is.EqualTo(1), "Apply does not re-publish the ports.");
        }

        [Test]
        public void AC_Gate_DisplayAcceptedPublishesPortsWithNewDisplay()
        {
            // qa-tester R1 GAP: the async gate-Accepted path must publish the ports with the accepted
            // display (Vfx quality from the accepted display, not the pre-confirmation Working).
            var store = new FakeStore();
            var vfx = new VfxSettingsPort();
            var vfxCapture = new VfxCapture();
            vfxCapture.Subscribe(vfx);
            var gate = new FakeDisplayGate();
            var session = OpenWithGate(store, gate, null, null, null, vfx, out _);

            // Resolution change routes through the gate; the candidate carries quality 3 (Ultra).
            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 3));
            Assert.That(vfxCapture.Count, Is.EqualTo(0), "Nothing published while the gate is pending.");

            gate.CompleteLatest(DisplayConfirmResult.Accepted);
            Assert.That(vfxCapture.Count, Is.EqualTo(1), "Accepted publishes the ports once.");
            Assert.That(vfxCapture.Last.Value, Is.EqualTo(QualityPresetId.Ultra), "Vfx carries the accepted display's quality.");
            Assert.That(session.Working.Display.QualityPreset, Is.EqualTo(3));
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(2560));
        }

        [Test]
        public void AC_Gate_DisplayAcceptedRestoresAllDefaultsThroughGate()
        {
            // qa-tester R1 BLOCKING: RestoreDefaults through the gate must restore the FULL default
            // display (vsync AND quality included), not keep the prior working vsync/quality.
            var store = new FakeStore();
            var vfx = new VfxSettingsPort();
            var vfxCapture = new VfxCapture();
            vfxCapture.Subscribe(vfx);
            var gate = new FakeDisplayGate();
            var session = OpenWithGate(store, gate, null, null, null, vfx, out _);

            // Prior working display: non-default vsync (0) and quality (3).
            session.SetValue(SettingsCategory.Display, new DisplayData(1280, 720, 0, 0, 3));
            gate.CompleteLatest(DisplayConfirmResult.Accepted); // resolution change routes through the gate
            Assert.That(vfxCapture.Count, Is.EqualTo(1));
            Assert.That(session.Working.Display.QualityPreset, Is.EqualTo(3));

            session.RestoreDefaults();
            // The default display differs (1920x1080 mode 2) → routed through the gate.
            Assert.That(session.HasPendingDisplayConfirm, Is.True);

            gate.CompleteLatest(DisplayConfirmResult.Accepted);
            Assert.That(session.Working.Display, Is.EqualTo(DisplayData.Default),
                "Accepted restores the FULL default display (resolution, mode, vsync, quality).");
            Assert.That(vfxCapture.Last.Value, Is.EqualTo(QualityPresetId.Medium), "Vfx re-publishes with the default quality (Medium).");
        }

        [Test]
        public void AC_Gate_WorkingChangedPrecedesPortPublication()
        {
            // qa-tester R1 GAP: consumers must never observe a port update before Working is updated
            // and WorkingChanged raised — order is Working update → WorkingChanged → ports.
            var store = new FakeStore();
            var audio = new AudioSettingsPort();
            var events = new List<string>();
            var session = Open(store, audio, null, null, null, out _);
            session.WorkingChanged += _ => events.Add("working-changed");
            audio.Updated += u => events.Add("port:" + u.MasterVolume.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture));

            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 0.7f, 0.8f, 0.6f, false, false));

            Assert.That(events, Is.EqualTo(new[] { "working-changed", "port:0.4" }),
                "WorkingChanged fires before the port, both carrying the new value.");
        }

        [Test]
        public void AC_Gate_PortsWorkIndependentlyOfSession()
        {
            // qa-tester R1 GAP: ports are standalone publishers — usable independently of a session
            // (dispose stops future session publications; empty subscriber lists are safe).
            var audio = new AudioSettingsPort();
            // No subscribers — Publish must not throw (null-conditional).
            audio.Publish(new AudioData(0.4f, 0.7f, 0.8f, 0.6f, false, false));

            var store = new FakeStore();
            var audioCapture = new AudioCapture();
            audioCapture.Subscribe(audio);
            var session = Open(store, audio, null, null, null, out _);

            session.SetValue(SettingsCategory.Audio, new AudioData(0.5f, 0.7f, 0.8f, 0.6f, false, false));
            Assert.That(audioCapture.Count, Is.EqualTo(1));

            session.Dispose();
            // After dispose the session is closed — SetValue is a no-op, no publication.
            session.SetValue(SettingsCategory.Audio, new AudioData(0.9f, 0.7f, 0.8f, 0.6f, false, false));
            Assert.That(audioCapture.Count, Is.EqualTo(1), "Closed session never publishes.");
        }

        [Test]
        public void AC_Gate_ReentrantApplyAndCancelThrow()
        {
            // qa-tester R1: the re-entrancy guard covers Apply and Cancel too — a port handler must
            // not persist or close the session during publication.
            var store = new FakeStore();
            var audio = new AudioSettingsPort();
            var session = Open(store, audio, null, null, null, out _);
            Exception applyThrown = null;
            Exception cancelThrown = null;
            audio.Updated += _ =>
            {
                try { session.Apply(); } catch (Exception ex) { applyThrown = ex; }
                try { session.Cancel(); } catch (Exception ex) { cancelThrown = ex; }
            };

            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 0.7f, 0.8f, 0.6f, false, false));

            Assert.That(applyThrown, Is.InstanceOf<InvalidOperationException>(), "Apply during publication throws.");
            Assert.That(cancelThrown, Is.InstanceOf<InvalidOperationException>(), "Cancel during publication throws.");
            Assert.That(session.IsOpen, Is.True, "Session survives the guarded attempts.");
        }

        [Test]
        public void AC_Gate_ThrowingPortSubscriberDoesNotBlockOtherPorts()
        {
            // unity-specialist R1: a throwing subscriber in ONE port must not prevent the remaining
            // ports from emitting (SafePublish wraps each port individually).
            var store = new FakeStore();
            var camera = new CameraSettingsPort();
            var audio = new AudioSettingsPort();
            var cameraCapture = new CameraCapture();
            var audioCapture = new AudioCapture();
            cameraCapture.Subscribe(camera);
            audioCapture.Subscribe(audio);
            camera.Updated += _ => throw new InvalidOperationException("Camera consumer down.");
            var session = Open(store, audio, null, camera, null, out _);

            session.SetValue(SettingsCategory.Camera, new CameraData(1.5f, true, false, true));

            Assert.That(audioCapture.Count, Is.EqualTo(1), "Audio still publishes when Camera subscriber throws.");
        }

        [Test]
        public void AC_Gate_ThrowingWarningSinkDoesNotBreakPublication()
        {
            // unity-specialist R2 S1 (double-fault): a port subscriber throwing AND a warning sink
            // throwing must still complete the remaining publications and the session transition.
            var store = new FakeStore();
            var camera = new CameraSettingsPort();
            var audio = new AudioSettingsPort();
            var audioCapture = new AudioCapture();
            audioCapture.Subscribe(audio);
            camera.Updated += _ => throw new InvalidOperationException("Camera consumer down.");
            var gate = new FakeDisplayGate();
            var session = OpenWithWarningSink(store, gate, _ => throw new InvalidOperationException("Sink down."), audio, null, camera, null, out _);

            session.SetValue(SettingsCategory.Camera, new CameraData(1.5f, true, false, true));

            Assert.That(audioCapture.Count, Is.EqualTo(1), "Audio publishes even when the warning sink throws.");
            Assert.That(session.IsOpen, Is.True, "Session transition completes despite the double fault.");
        }

        [Test]
        public void AC_Gate_NanValuesRejectedByGuards()
        {
            // qa-tester R2: NaN bypasses < / > comparisons (all comparisons false) — the guards must
            // reject non-finite values explicitly so NaN never reaches Working/ports/persistence.
            var store = new FakeStore();
            var session = Open(store, null, null, null, null, out _);

            Assert.Throws<System.ArgumentOutOfRangeException>(() =>
                session.SetValue(SettingsCategory.Accessibility, new AccessibilityData(0, float.NaN)));
            Assert.Throws<System.ArgumentOutOfRangeException>(() =>
                session.SetValue(SettingsCategory.Camera, new CameraData(float.NaN, true, false, true)));
            Assert.That(session.Working, Is.EqualTo(session.Snapshot), "Working untouched by rejected NaN values.");
        }

        [Test]
        public void AC_Gate_GateRetentionAfterThrowDoesNotRecycleGeneration()
        {
            // qa-tester R2 B1: a gate that retains its callback BEFORE throwing must not recycle the
            // generation counter — a late callback from the failed candidate must NOT accept a later,
            // different candidate.
            var store = new FakeStore();
            var gate = new FailOnceThenSucceedGate();
            var session = OpenWithGate(store, gate, null, null, null, null, out _);

            // Candidate A: gate retains the callback, then throws (caught by the session).
            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 1));
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "Latch cleared after gate failure.");

            // Candidate C: a fresh confirmation after the failure (different resolution → routes to gate).
            session.SetValue(SettingsCategory.Display, new DisplayData(3840, 2160, 2, 1, 1));
            Assert.That(gate.Callbacks.Count, Is.EqualTo(2));
            Assert.That(session.HasPendingDisplayConfirm, Is.True);

            // The LATE callback from the FAILED candidate A fires now — it must be a stale no-op,
            // not accept the pending candidate C.
            gate.Callbacks[0](DisplayConfirmResult.Accepted);
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1920),
                "Late A-callback must not apply; the pending candidate C (3840) is untouched.");
            Assert.That(session.HasPendingDisplayConfirm, Is.True, "Candidate C is still pending.");

            gate.Callbacks[1](DisplayConfirmResult.Accepted);
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(3840), "Candidate C accepted normally.");
        }

        [Test]
        public void AC_Gate_RejectedThenLateAcceptedIsNoOp()
        {
            // qa-tester R2 G1: after a candidate is REJECTED, a LATE Accepted callback for it is a
            // stale no-op (generation consumed) — Working keeps the pre-candidate display.
            var store = new FakeStore();
            var vfx = new VfxSettingsPort();
            var vfxCapture = new VfxCapture();
            vfxCapture.Subscribe(vfx);
            var gate = new FakeDisplayGate();
            var session = OpenWithGate(store, gate, null, null, null, vfx, out _);

            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 3));
            gate.CompleteLatest(DisplayConfirmResult.RejectedOrTimeout);
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1920), "Rejected keeps prior display.");

            // Re-invoking the SAME callback with Accepted is now a stale no-op (generation consumed).
            gate.CompleteLatest(DisplayConfirmResult.Accepted);
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1920), "Late Accepted after rejection is a stale no-op.");
        }

        [Test]
        public void AC_Gate_SupersededCandidateLateAcceptedIsNoOp()
        {
            // qa-tester R2 G1: candidate A superseded by candidate B — a LATE Accepted for A must not
            // apply A's display; only B's Accepted does.
            var store = new FakeStore();
            var vfx = new VfxSettingsPort();
            var vfxCapture = new VfxCapture();
            vfxCapture.Subscribe(vfx);
            var gate = new FakeDisplayGate();
            var session = OpenWithGate(store, gate, null, null, null, vfx, out _);

            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 3)); // A
            session.SetValue(SettingsCategory.Display, new DisplayData(3840, 2160, 2, 1, 0));  // B supersedes A
            Assert.That(gate.Callbacks.Count, Is.EqualTo(2));

            gate.Callbacks[0](DisplayConfirmResult.Accepted); // late A Accepted — must be no-op
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(1920), "Late A Accepted is a stale no-op.");
            Assert.That(session.HasPendingDisplayConfirm, Is.True, "B still pending.");

            gate.Callbacks[1](DisplayConfirmResult.Accepted); // B Accepted applies B
            Assert.That(session.Working.Display.ResolutionWidth, Is.EqualTo(3840));
            Assert.That(vfxCapture.Last.Value, Is.EqualTo(QualityPresetId.Low), "Vfx carries B's quality.");
        }

        [Test]
        public void AC_Gate_ControlsAndDifficultyPublishFullPayloadValues()
        {
            // qa-tester R2 R3: beyond counts, the emitted payloads must reflect the current full Working
            // after Controls and Difficulty mutations (non-default baseline).
            var store = new FakeStore();
            var audio = new AudioSettingsPort();
            var accessibility = new AccessibilitySettingsPort();
            var camera = new CameraSettingsPort();
            var vfx = new VfxSettingsPort();
            var audioCapture = new AudioCapture();
            var accessibilityCapture = new AccessibilityCapture();
            var cameraCapture = new CameraCapture();
            var vfxCapture = new VfxCapture();
            audioCapture.Subscribe(audio);
            accessibilityCapture.Subscribe(accessibility);
            cameraCapture.Subscribe(camera);
            vfxCapture.Subscribe(vfx);
            var session = Open(store, audio, accessibility, camera, vfx, out _);

            // Establish a non-default baseline across all four payloads.
            session.SetValue(SettingsCategory.Audio, new AudioData(0.5f, 0.6f, 0.7f, 0.8f, true, true));
            session.SetValue(SettingsCategory.Camera, new CameraData(1.5f, false, true, false));
            session.SetValue(SettingsCategory.Accessibility, new AccessibilityData(2, 1.5f));
            session.SetValue(SettingsCategory.Display, new DisplayData(1920, 1080, 2, 1, 0)); // quality Low (immediate)

            // Controls mutation — all four payloads reflect the FULL baseline (not resets).
            session.SetValue(SettingsCategory.Controls, new ControlsData(0.2f, 0.9f, 0.4f, 0.4f, 0.6f, string.Empty));
            Assert.That(audioCapture.Last.Value.MasterVolume, Is.EqualTo(0.5f), "Audio payload unchanged by Controls mutation.");
            Assert.That(cameraCapture.Last.Value.ShakeIntensity, Is.EqualTo(1.5f));
            Assert.That(accessibilityCapture.Last.Value.Mode, Is.EqualTo(ColorblindMode.Deuteranopia));
            Assert.That(accessibilityCapture.Last.Value.ReducedMotion, Is.True, "Resolved from the camera baseline.");
            Assert.That(vfxCapture.Last.Value, Is.EqualTo(QualityPresetId.Low));

            // Difficulty mutation — same full-payload guarantee.
            session.SetValue(SettingsCategory.Difficulty, 4);
            Assert.That(audioCapture.Last.Value.MasterVolume, Is.EqualTo(0.5f));
            Assert.That(cameraCapture.Last.Value.ShakeIntensity, Is.EqualTo(1.5f));
            Assert.That(accessibilityCapture.Last.Value.TextScale, Is.EqualTo(1.5f));
            Assert.That(vfxCapture.Last.Value, Is.EqualTo(QualityPresetId.Low));
        }

        [Test]
        public void AC_Gate_WorkingChangedReentrantSetValueThrows()
        {
            // Recursion guard (final review): a WorkingChanged handler calling SetValue would recurse
            // unboundedly (SetValue → WorkingChanged → SetValue → ...) and stack-overflow. The guard
            // rejects the feedback mutation; the session and the accepted Working stay intact.
            var store = new FakeStore();
            var gate = new FakeDisplayGate();
            var session = OpenWithGate(store, gate, null, null, null, null, out _);

            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 2));
            Exception reentrantThrown = null;
            session.WorkingChanged += _ =>
            {
                try { session.SetValue(SettingsCategory.Audio, new AudioData(0.1f, 0.1f, 0.1f, 0.1f, false, false)); }
                catch (Exception ex) { reentrantThrown = ex; }
            };
            gate.CompleteLatest(DisplayConfirmResult.Accepted); // dispatches WorkingChanged → reentrant SetValue

            Assert.That(reentrantThrown, Is.InstanceOf<InvalidOperationException>(),
                "SetValue from a WorkingChanged handler is rejected by the recursion guard.");
            Assert.That(session.Working.Display, Is.EqualTo(new DisplayData(2560, 1440, 2, 1, 2)),
                "The accepted candidate A applied; the rejected reentrant mutation never landed.");
            Assert.That(session.IsOpen, Is.True, "Session survives the guarded reentrant attempt.");
        }

        [Test]
        public void AC_Gate_WorkingChangedReentrantRestoreDefaultsThrows()
        {
            // Same recursion guard for RestoreDefaults: a WorkingChanged handler calling RestoreDefaults
            // would recurse through the cascade — rejected instead.
            var store = new FakeStore();
            var session = Open(store, null, null, null, null, out _);
            Exception reentrantThrown = null;
            session.WorkingChanged += _ =>
            {
                try { session.RestoreDefaults(); }
                catch (Exception ex) { reentrantThrown = ex; }
            };

            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 0.7f, 0.8f, 0.6f, false, false));

            Assert.That(reentrantThrown, Is.InstanceOf<InvalidOperationException>());
            Assert.That(session.IsOpen, Is.True);
        }

        [Test]
        public void AC_Gate_WorkingChangedCancelDuringAcceptanceDoesNotPublish()
        {
            // qa-tester R4 BLOCKING 1: a WorkingChanged subscriber calling Cancel during display
            // acceptance closes the session — no port publication may occur after closure.
            var store = new FakeStore();
            var vfx = new VfxSettingsPort();
            var vfxCapture = new VfxCapture();
            vfxCapture.Subscribe(vfx);
            var gate = new FakeDisplayGate();
            var session = OpenWithGate(store, gate, null, null, null, vfx, out _);

            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 3));
            session.WorkingChanged += _ => session.Cancel(); // reentrant Cancel during A's acceptance
            gate.CompleteLatest(DisplayConfirmResult.Accepted);

            Assert.That(session.IsOpen, Is.False, "Cancel closed the session.");
            Assert.That(vfxCapture.Count, Is.EqualTo(0), "No port publication after closure.");
        }

        [Test]
        public void AC_Gate_WorkingChangedApplyDuringAcceptanceDoesNotPublish()
        {
            // qa-tester R4 BLOCKING 1: Apply during display acceptance closes the session — no port
            // publication after commit.
            var store = new FakeStore();
            var vfx = new VfxSettingsPort();
            var vfxCapture = new VfxCapture();
            vfxCapture.Subscribe(vfx);
            var gate = new FakeDisplayGate();
            var session = OpenWithGate(store, gate, null, null, null, vfx, out _);

            session.SetValue(SettingsCategory.Display, new DisplayData(2560, 1440, 2, 1, 3));
            session.WorkingChanged += _ => session.Apply(); // reentrant Apply during A's acceptance
            gate.CompleteLatest(DisplayConfirmResult.Accepted);

            Assert.That(session.IsOpen, Is.False, "Apply closed the session.");
            Assert.That(vfxCapture.Count, Is.EqualTo(0), "No port publication after commit.");
        }

        [Test]
        public void AC_Gate_RestoreDefaultsCancelMidCascadeDoesNotReopenConfirm()
        {
            // qa-tester R4 BLOCKING 2: a WorkingChanged subscriber calling Cancel mid-RestoreDefaults
            // closes the session — the display HandleDisplayChange and the final publication must not
            // run on a closed session.
            var store = new FakeStore();
            var vfx = new VfxSettingsPort();
            var vfxCapture = new VfxCapture();
            vfxCapture.Subscribe(vfx);
            var gate = new FakeDisplayGate();
            var session = OpenWithGate(store, gate, null, null, null, vfx, out _);

            session.SetValue(SettingsCategory.Camera, new CameraData(1.5f, true, false, true));
            vfxCapture.Count = 0; // reset baseline
            session.WorkingChanged += _ => session.Cancel(); // reentrant Cancel on the FIRST cascade SetValue
            session.RestoreDefaults();

            Assert.That(session.IsOpen, Is.False, "Cancel closed the session mid-cascade.");
            Assert.That(session.HasPendingDisplayConfirm, Is.False, "No confirmation reopened on the closed session.");
            Assert.That(vfxCapture.Count, Is.EqualTo(0), "No port publication after closure.");
        }

        [Test]
        public void AC_Gate_SetValueCancelDuringWorkingChangedDoesNotPublish()
        {
            // Pre-emptive audit (qa-tester R4 pattern): a WorkingChanged subscriber calling Cancel
            // during a non-display SetValue closes the session — no port publication may follow.
            var store = new FakeStore();
            var vfx = new VfxSettingsPort();
            var vfxCapture = new VfxCapture();
            vfxCapture.Subscribe(vfx);
            var session = Open(store, null, null, null, vfx, out _);

            session.WorkingChanged += _ => session.Cancel(); // reentrant Cancel during SetValue dispatch
            session.SetValue(SettingsCategory.Audio, new AudioData(0.4f, 0.7f, 0.8f, 0.6f, false, false));

            Assert.That(session.IsOpen, Is.False);
            Assert.That(vfxCapture.Count, Is.EqualTo(0), "No port publication after closure.");
        }

        [Test]
        public void AC_Gate_DisplayImmediateCancelDuringWorkingChangedDoesNotPublish()
        {
            // Pre-emptive audit: the immediate display path (same resolution/mode, only quality/vsync
            // changes) also dispatches WorkingChanged → a reentrant Cancel must suppress publication.
            var store = new FakeStore();
            var vfx = new VfxSettingsPort();
            var vfxCapture = new VfxCapture();
            vfxCapture.Subscribe(vfx);
            var session = Open(store, null, null, null, vfx, out _);

            session.WorkingChanged += _ => session.Cancel(); // reentrant Cancel during immediate display apply
            session.SetValue(SettingsCategory.Display, new DisplayData(1920, 1080, 2, 1, 3)); // same res/mode → immediate

            Assert.That(session.IsOpen, Is.False);
            Assert.That(vfxCapture.Count, Is.EqualTo(0), "No port publication after closure.");
        }

        private static bool HasState(PaletteCue[] cues, string stateId)
        {
            foreach (var cue in cues)
            {
                if (cue.StateId == stateId) return true;
            }
            return false;
        }
    }
}
