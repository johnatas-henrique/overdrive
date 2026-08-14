using NUnit.Framework;
using Overdrive.Settings;
using Overdrive.Settings.Core;
using Overdrive.Simulation;

namespace Overdrive.Settings.Tests
{
    /// <summary>
    /// Integration tests for the Unity lifecycle context adapter (Story 002 AC-D6 / AC-E2 / AC-ST1):
    /// maps <see cref="ISimulationStateGate"/> states to the settings lifecycle queries. Uses a fake
    /// state gate (the real SimulationStateMachine is exercised by the Simulation epic).
    /// </summary>
    public class SettingsLifecycleTests
    {
        [SetUp]
        public void CleanupPlayerPrefs()
        {
            // Fixture-level hygiene: a real PlayerPrefs store persists across runs — stale keys from
            // a previous run must not seed session snapshots (GAPS, code review R3).
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

        private static (SettingsLifecycleContext ctx, FakeStateGate gate) NewContext()
        {
            var gate = new FakeStateGate();
            return (new SettingsLifecycleContext(gate), gate);
        }

        // ------------------------------------------------------------------ //
        // CanOpenSettings (AC-E2, AC-ST1)
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_ST1_IdleAllowsOpen()
        {
            var (ctx, gate) = NewContext();
            gate.State = SimulationState.Idle;
            Assert.That(ctx.CanOpenSettings, Is.True);
        }

        [Test]
        public void AC_E2_ActiveCountdownBlocksOpen()
        {
            var (ctx, gate) = NewContext();
            gate.State = SimulationState.Countdown;
            Assert.That(ctx.CanOpenSettings, Is.False, "Active Countdown blocks settings (GDD:252).");
        }

        [Test]
        public void AC_E2_PausedCountdownAllowsOpen()
        {
            var (ctx, gate) = NewContext();
            gate.State = SimulationState.Paused;
            gate.ResumeState = SimulationState.Countdown;
            Assert.That(ctx.CanOpenSettings, Is.True, "Paused Countdown opens through the normal pause menu (GDD:252).");
        }

        [Test]
        public void AC_E2_PausedRaceAllowsOpen()
        {
            var (ctx, gate) = NewContext();
            gate.State = SimulationState.Paused;
            gate.ResumeState = SimulationState.Racing;
            Assert.That(ctx.CanOpenSettings, Is.True);
        }

        // ------------------------------------------------------------------ //
        // IsDifficultyEditable (AC-D6, GDD:299)
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_D6_ActiveCountdownDisablesDifficulty()
        {
            var (ctx, gate) = NewContext();
            gate.State = SimulationState.Countdown;
            Assert.That(ctx.IsDifficultyEditable, Is.False, "Countdown owns the immutable race snapshot.");
        }

        [Test]
        public void AC_D6_ActiveRacingDisablesDifficulty()
        {
            var (ctx, gate) = NewContext();
            gate.State = SimulationState.Racing;
            Assert.That(ctx.IsDifficultyEditable, Is.False);
        }

        [Test]
        public void AC_D6_PausedCountdownDisablesDifficulty()
        {
            var (ctx, gate) = NewContext();
            gate.State = SimulationState.Paused;
            gate.ResumeState = SimulationState.Countdown;
            Assert.That(ctx.IsDifficultyEditable, Is.False, "Paused Countdown still owns the snapshot (AC-D6).");
        }

        [Test]
        public void AC_D6_PausedRacingDisablesDifficulty()
        {
            var (ctx, gate) = NewContext();
            gate.State = SimulationState.Paused;
            gate.ResumeState = SimulationState.Racing;
            Assert.That(ctx.IsDifficultyEditable, Is.False, "Paused Racing still owns the snapshot (AC-D6).");
        }

        [Test]
        public void AC_D6_IdleAllowsDifficultyEditing()
        {
            var (ctx, gate) = NewContext();
            gate.State = SimulationState.Idle;
            Assert.That(ctx.IsDifficultyEditable, Is.True);
        }

        [Test]
        public void AC_D6_PausedWithoutResumeAllowsDifficultyEditing()
        {
            // A pause not originating from a race (no valid resume state) has no immutable snapshot.
            var (ctx, gate) = NewContext();
            gate.State = SimulationState.Paused;
            gate.ResumeState = null;
            Assert.That(ctx.IsDifficultyEditable, Is.True);
        }

        [Test]
        public void AC_D6_FinishedAndResultsAllowDifficultyEditing()
        {
            var (ctx, gate) = NewContext();
            gate.State = SimulationState.Finished;
            Assert.That(ctx.IsDifficultyEditable, Is.True);
            gate.State = SimulationState.Results;
            Assert.That(ctx.IsDifficultyEditable, Is.True);
        }

        // ------------------------------------------------------------------ //
        // Session + real adapter end-to-end (AC-ST1, AC-E2)
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_ST1_OpenThroughRealAdapterInIdle()
        {
            var (ctx, gate) = NewContext();
            gate.State = SimulationState.Idle;
            var store = new PlayerPrefsStore();
            var blob = new SettingsBlobService(new SettingsPersistence(store));
            var fakeGate = new FakeDisplayConfirm();

            var session = SettingsEditSession.TryOpen(blob, ctx, fakeGate, null, null, out SettingsOpenResult result);

            Assert.That(result, Is.EqualTo(SettingsOpenResult.Opened));
            Assert.That(session, Is.Not.Null);
            session.Cancel();
        }

        [Test]
        public void AC_E2_OpenThroughRealAdapterInActiveCountdownBlocked()
        {
            var (ctx, gate) = NewContext();
            gate.State = SimulationState.Countdown;
            var store = new PlayerPrefsStore();
            var blob = new SettingsBlobService(new SettingsPersistence(store));

            var session = SettingsEditSession.TryOpen(blob, ctx, new FakeDisplayConfirm(), null, null, out SettingsOpenResult result);

            Assert.That(result, Is.EqualTo(SettingsOpenResult.BlockedCountdown));
            Assert.That(session, Is.Null);
        }

        [Test]
        public void AC_ST1_OpenThroughRealAdapterFromPausedRacing()
        {
            var (ctx, gate) = NewContext();
            gate.State = SimulationState.Paused;
            gate.ResumeState = SimulationState.Racing;
            var blob = new SettingsBlobService(new SettingsPersistence(new PlayerPrefsStore()));

            var session = SettingsEditSession.TryOpen(blob, ctx, new FakeDisplayConfirm(), null, null, out SettingsOpenResult result);

            Assert.That(result, Is.EqualTo(SettingsOpenResult.Opened), "Paused Racing opens through the normal pause menu (AC-ST1).");
            Assert.That(session, Is.Not.Null);
            Assert.That(ctx.IsDifficultyEditable, Is.False, "Paused Racing owns the immutable DifficultyProfile snapshot (AC-D6).");
            session.Cancel();
        }

        [Test]
        public void AC_ST1_OpenThroughRealAdapterFromPausedCountdown()
        {
            var (ctx, gate) = NewContext();
            gate.State = SimulationState.Paused;
            gate.ResumeState = SimulationState.Countdown;
            var blob = new SettingsBlobService(new SettingsPersistence(new PlayerPrefsStore()));

            var session = SettingsEditSession.TryOpen(blob, ctx, new FakeDisplayConfirm(), null, null, out SettingsOpenResult result);

            Assert.That(result, Is.EqualTo(SettingsOpenResult.Opened), "Paused Countdown opens through the normal pause menu (AC-E2).");
            Assert.That(session, Is.Not.Null);
            Assert.That(ctx.IsDifficultyEditable, Is.False, "Paused Countdown still owns the immutable snapshot (AC-D6).");
            session.Cancel();
        }

        /// <summary>Gate that immediately confirms as Accepted.</summary>
        private sealed class FakeDisplayConfirm : IDisplayConfirmGate
        {
            public void Confirm(DisplayCandidate candidate, System.Action<DisplayConfirmResult> onResult)
                => onResult(DisplayConfirmResult.Accepted);

            // Confirms synchronously — never an active confirmation to cancel.
            public void CancelActiveConfirmation() { }
        }
    }
}
