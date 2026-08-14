using System.Collections.Generic;
using NUnit.Framework;
using Overdrive.Settings;
using Overdrive.Settings.Core;
using Overdrive.Simulation;

namespace Overdrive.Settings.Tests
{
    /// <summary>
    /// Integration tests for the Settings Values Contract wiring (Story 006): the real edit session
    /// (with the real lifecycle adapter) publishing typed value ports end-to-end, persistence via
    /// Apply, and the overload-pair source compatibility. Uses real PlayerPrefs (cleaned per fixture)
    /// and the Unity-backed <see cref="SettingsLifecycleContext"/> adapter with a fake state gate.
    /// </summary>
    public class SettingsRuntimeIntegrationTests
    {
        [SetUp]
        public void CleanupPlayerPrefs()
        {
            UnityEngine.PlayerPrefs.DeleteKey(SettingsPersistence.PrimaryKey);
            UnityEngine.PlayerPrefs.DeleteKey(SettingsPersistence.BackupKey);
        }

        private sealed class FakeStateGate : ISimulationStateGate
        {
            public SimulationState State { get; set; }
            public bool CanTick => State == SimulationState.Countdown || State == SimulationState.Racing;
            public SimulationState? ResumeState { get; set; }
            public bool IsForfeit => false;
            public int ForfeitLapCount => 0;
            public float RaceTimeAtForfeit => 0f;
            public bool TryTransition(SimulationState state) { State = state; return true; }
        }

        private sealed class NoOpDisplayGate : IDisplayConfirmGate
        {
            public void Confirm(DisplayCandidate candidate, System.Action<DisplayConfirmResult> onResult) { }
            public void CancelActiveConfirmation() { }
        }

        private static SettingsEditSession OpenSession(
            ISettingsLifecycleContext lifecycle,
            AudioSettingsPort audio,
            AccessibilitySettingsPort accessibility,
            CameraSettingsPort camera,
            VfxSettingsPort vfx,
            out SettingsOpenResult result)
        {
            var persistence = new SettingsPersistence(new PlayerPrefsStore());
            var blob = new SettingsBlobService(persistence);
            return SettingsEditSession.TryOpen(blob, lifecycle, new NoOpDisplayGate(), null, null,
                audio, accessibility, camera, vfx, out result);
        }

        [Test]
        public void AC_Int_PortsPublishThroughRealSessionAndPersistOnApply()
        {
            var lifecycle = new SettingsLifecycleContext(new FakeStateGate { State = SimulationState.Idle });
            var audio = new AudioSettingsPort();
            var accessibility = new AccessibilitySettingsPort();
            var camera = new CameraSettingsPort();
            var vfx = new VfxSettingsPort();

            var receivedAudio = new List<AudioSettingsUpdate>();
            var receivedAccessibility = new List<AccessibilityUpdate>();
            var receivedCamera = new List<CameraSettingsUpdate>();
            var receivedVfx = new List<QualityPresetId>();
            audio.Updated += u => receivedAudio.Add(u);
            accessibility.Updated += u => receivedAccessibility.Add(u);
            camera.Updated += u => receivedCamera.Add(u);
            vfx.Updated += u => receivedVfx.Add(u);

            var session = OpenSession(lifecycle, audio, accessibility, camera, vfx, out SettingsOpenResult result);
            Assert.That(result, Is.EqualTo(SettingsOpenResult.Opened));

            // Change audio + camera — ports publish synchronously, nothing persisted yet.
            session.SetValue(SettingsCategory.Audio, new AudioData(0.5f, 0.4f, 0.3f, 0.2f, false, false));
            session.SetValue(SettingsCategory.Camera, new CameraData(1.5f, true, true, false));

            Assert.That(receivedAudio.Count, Is.EqualTo(2), "Full-payload publication fires on EVERY Working mutation (audio + camera) — consumers observe deltas.");
            Assert.That(receivedAudio[receivedAudio.Count - 1].MasterVolume, Is.EqualTo(0.5f), "The latest audio publication carries the audio Working.");
            Assert.That(receivedCamera.Count, Is.EqualTo(2));
            Assert.That(receivedCamera[receivedCamera.Count - 1].ShakeIntensity, Is.EqualTo(1.5f));
            Assert.That(receivedAccessibility.Count, Is.EqualTo(2));
            Assert.That(receivedAccessibility[receivedAccessibility.Count - 1].ReducedMotion, Is.True, "Accessibility republishes with the camera ReducedMotion.");
            Assert.That(receivedVfx.Count, Is.EqualTo(2));

            // Persistence happens ONLY on Apply — and the real PlayerPrefs store holds the blob.
            Assert.That(UnityEngine.PlayerPrefs.HasKey(SettingsPersistence.PrimaryKey), Is.False, "Nothing persisted before Apply.");

            var applyResult = session.Apply();
            Assert.That(applyResult, Is.EqualTo(ApplyResult.Success));
            Assert.That(UnityEngine.PlayerPrefs.HasKey(SettingsPersistence.PrimaryKey), Is.True, "Apply persisted the primary blob.");
        }

        [Test]
        public void AC_Int_LoadedValuesPublishOnRestoreDefaults()
        {
            // Persist a custom camera value, reopen, then RestoreDefaults — the ports publish the
            // post-cascade defaults ONCE (batch mode) with fresh resolved ReducedMotion.
            var lifecycle = new SettingsLifecycleContext(new FakeStateGate { State = SimulationState.Idle });
            var camera = new CameraSettingsPort();
            var accessibility = new AccessibilitySettingsPort();

            var session1 = OpenSession(lifecycle, null, null, camera, null, out _);
            session1.SetValue(SettingsCategory.Camera, new CameraData(1.8f, true, true, false));
            session1.Apply();

            var receivedCamera = new List<CameraSettingsUpdate>();
            var receivedAccessibility = new List<AccessibilityUpdate>();
            camera.Updated += u => receivedCamera.Add(u);
            accessibility.Updated += u => receivedAccessibility.Add(u);

            var session2 = OpenSession(lifecycle, null, accessibility, camera, null, out _);
            Assert.That(session2.Working.Camera.ShakeIntensity, Is.EqualTo(1.8f), "Reopened session loads the persisted 1.8.");

            session2.RestoreDefaults();

            Assert.That(receivedCamera.Count, Is.EqualTo(1), "RestoreDefaults publishes the camera port once.");
            Assert.That(receivedCamera[0].ShakeIntensity, Is.EqualTo(1.0f), "Default shake 1.0 (GDD settings.md:158).");
            Assert.That(receivedCamera[0].ShowChaseHudInCockpit, Is.True, "Default chase HUD On (GDD settings.md:161).");
            Assert.That(receivedAccessibility.Count, Is.EqualTo(1));
            Assert.That(receivedAccessibility[0].ReducedMotion, Is.False, "Fresh resolved value after the cascade.");
        }

        [Test]
        public void AC_Int_FiveArgOverloadSourceCompatible()
        {
            // The original 5-arg TryOpen still opens a session (source-compatible overload pair).
            var lifecycle = new SettingsLifecycleContext(new FakeStateGate { State = SimulationState.Idle });
            var persistence = new SettingsPersistence(new PlayerPrefsStore());
            var blob = new SettingsBlobService(persistence);

            SettingsOpenResult result;
            var session = SettingsEditSession.TryOpen(blob, lifecycle, new NoOpDisplayGate(), null, null, out result);

            Assert.That(result, Is.EqualTo(SettingsOpenResult.Opened));
            Assert.That(session.Audio, Is.Null);
            Assert.That(session.IsOpen, Is.True);
            session.Dispose();
        }

        [Test]
        public void AC_Int_OverloadParity_GuardsAndRejections()
        {
            // qa-tester R1 GAP: overload parity — both overloads share the same guards. The 5-arg
            // overload must reject active Countdown and an already-open session exactly like the full
            // overload, and both must throw on null required arguments.
            var idle = new SettingsLifecycleContext(new FakeStateGate { State = SimulationState.Idle });
            var blob = new SettingsBlobService(new SettingsPersistence(new PlayerPrefsStore()));

            // Countdown rejection through the 5-arg overload.
            var countdown = new SettingsLifecycleContext(new FakeStateGate { State = SimulationState.Countdown });
            SettingsOpenResult blocked;
            var blockedSession = SettingsEditSession.TryOpen(blob, countdown, new NoOpDisplayGate(), null, null, out blocked);
            Assert.That(blocked, Is.EqualTo(SettingsOpenResult.BlockedCountdown));
            Assert.That(blockedSession, Is.Null);

            // One-session-at-a-time through the 5-arg overload.
            var first = SettingsEditSession.TryOpen(blob, idle, new NoOpDisplayGate(), null, null, out SettingsOpenResult opened);
            Assert.That(opened, Is.EqualTo(SettingsOpenResult.Opened));
            SettingsOpenResult secondResult;
            var second = SettingsEditSession.TryOpen(blob, idle, new NoOpDisplayGate(), null, first, out secondResult);
            Assert.That(secondResult, Is.EqualTo(SettingsOpenResult.SessionActive));
            Assert.That(second, Is.Null);
            first.Dispose();

            // Null required-argument guards on the full overload (same as the 5-arg).
            SettingsOpenResult unused;
            Assert.Throws<System.ArgumentNullException>(() =>
                SettingsEditSession.TryOpen(null, idle, new NoOpDisplayGate(), null, null, null, null, null, null, out unused));
            Assert.Throws<System.ArgumentNullException>(() =>
                SettingsEditSession.TryOpen(blob, null, new NoOpDisplayGate(), null, null, null, null, null, null, out unused));
            Assert.Throws<System.ArgumentNullException>(() =>
                SettingsEditSession.TryOpen(blob, idle, null, null, null, null, null, null, null, out unused),
                "Null displayConfirm is rejected by the guard (qa-tester R2 R4).");
            // Direct five-argument overload null-display assertion (qa-tester R3 TESTABLE — the
            // 5-arg delegates to the guarded overload; a bypass would escape a full-overload-only test).
            Assert.Throws<System.ArgumentNullException>(() =>
                SettingsEditSession.TryOpen(blob, idle, null, null, null, out unused));

            // Full overload with ALL ports null behaves exactly like the 5-arg overload.
            var allNull = SettingsEditSession.TryOpen(blob, idle, new NoOpDisplayGate(), null, null, null, null, null, null, out SettingsOpenResult allNullResult);
            Assert.That(allNullResult, Is.EqualTo(SettingsOpenResult.Opened));
            Assert.That(allNull.Audio, Is.Null);
            Assert.That(allNull.Accessibility, Is.Null);
            Assert.That(allNull.Camera, Is.Null);
            Assert.That(allNull.Vfx, Is.Null);
            allNull.Dispose();
        }

        [Test]
        public void AC_Int_CountdownBlocksPortSession()
        {
            // AC-E2 — active Countdown blocks settings through the real lifecycle adapter.
            var lifecycle = new SettingsLifecycleContext(new FakeStateGate { State = SimulationState.Countdown });
            var persistence = new SettingsPersistence(new PlayerPrefsStore());
            var blob = new SettingsBlobService(persistence);

            SettingsOpenResult result;
            var session = SettingsEditSession.TryOpen(blob, lifecycle, new NoOpDisplayGate(), null, null,
                new AudioSettingsPort(), null, null, null, out result);

            Assert.That(result, Is.EqualTo(SettingsOpenResult.BlockedCountdown));
            Assert.That(session, Is.Null);
        }
    }
}
