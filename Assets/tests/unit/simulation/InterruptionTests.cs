using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Overdrive.Input;
using Overdrive.Simulation;

namespace Overdrive.Simulation.Tests
{
    /// <summary>
    /// Story 004 evidence for the interruption lifecycle: pause entry (pause button,
    /// focus boundary, performance protection), resumeState recording, explicit resume,
    /// and the focus-loss pre-accumulator boundary (AC-4.5 through AC-7.1b, ADR-0001).
    /// </summary>
    [TestFixture]
    public sealed class InterruptionTests
    {
        private static GridAssignment RaceGrid => new GridAssignment(new[] { 1, 2, 3 });

        // ---- AC-4.5: Countdown pause preserves remaining ticks ----

        [Test]
        public void AC45_CountdownPausePreservesRemainingTicksAndResumeContinues()
        {
            var machine = CountdownMachine(advancedTicks: 100);
            Assert.AreEqual(200, machine.CountdownRemainingTicks);

            var button = new PauseButton();
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                SimulationDriver.FIXED_DT, null, button.Query, button.Consume);
            button.Armed = true;

            driver.Update(); // the pause boundary tick does NOT decrement the countdown

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(200, machine.CountdownRemainingTicks, "pause tick must not decrement");
            Assert.IsFalse(button.Armed, "pause edge consumed exactly once");
            double remainderAfterPause = driver.AccumulatorSeconds;
            Assert.AreEqual(SimulationDriver.FIXED_DT, remainderAfterPause, 1e-6d);

            // Long paused updates add no time and consume no ticks (same driver preserves remainder).
            for (int i = 0; i < 10; i++) driver.Update();
            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(200, machine.CountdownRemainingTicks);
            Assert.AreEqual(remainderAfterPause, driver.AccumulatorSeconds, 1e-6d,
                "remainder preserved across pause");

            machine.RequestResume();
            Assert.AreEqual(SimulationState.Countdown, machine.State);
            Assert.AreEqual(200, machine.CountdownRemainingTicks);

            // Resume resumes fixed-step processing from the preserved remainder.
            driver.Update(); // 2 x FIXED_DT clamp -> 2 countdown ticks
            Assert.AreEqual(198, machine.CountdownRemainingTicks);
        }

        [Test]
        public void AC45_ZeroRemainderPauseStillPreservesCount()
        {
            var machine = CountdownMachine(advancedTicks: 0);
            var button = new PauseButton();
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                SimulationDriver.FIXED_DT, null, button.Query, button.Consume);
            button.Armed = true;

            driver.Update();
            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(SimulationStateMachine.CountdownDurationTicks, machine.CountdownRemainingTicks);
        }

        // ---- AC-4.6: Racing -> Paused on pause button ----

        [Test]
        public void AC46_PauseEdgeTransitionsRacingToPausedWithoutPhysicsTick()
        {
            var machine = RacingMachine();
            Assert.AreEqual(SimulationState.Racing, machine.State);

            var physics = new RecordingPhysics(machine);
            var button = new PauseButton();
            var driver = CreateDriver(machine, new RecordingProcessor(), physics,
                SimulationDriver.FIXED_DT, null, button.Query, button.Consume);
            button.Armed = true;

            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(0, physics.Calls, "no physics tick on the pause boundary");
            Assert.AreEqual(0, driver.SimulationStepCount, "no counter increment on the pause tick");
            Assert.AreEqual(SimulationState.Racing, machine.ResumeState);
        }

        [Test]
        public void AC46_RepeatedPauseLevelsProduceExactlyOneTransition()
        {
            var machine = RacingMachine();
            var transitions = new List<SimulationStateChanged>();
            machine.StateChanged += transitions.Add;

            var button = new PauseButton();
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                SimulationDriver.FIXED_DT, null, button.Query, button.Consume);
            button.Armed = true;

            driver.Update(); // consumes the edge -> Paused
            driver.Update(); // second frame, edge not re-armed -> stays Paused

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(1, transitions.Count(t => t.Current == SimulationState.Paused));
        }

        // ---- AC-4.6a: resumeState recorded before publishing; three entry paths ----

        [Test]
        public void AC46a_StateChangedRaisedBeforePausedStateChangedOnPauseEntry()
        {
            var machine = RacingMachine();
            var order = new List<string>();
            SimulationState? resumeAtStateChanged = null;
            SimulationState previousPayload = default;
            machine.StateChanged += e =>
            {
                order.Add($"state:{e.Current}");
                // resumeState must already be recorded when StateChanged fires (AC-4.6a).
                resumeAtStateChanged = machine.ResumeState;
            };
            machine.PausedStateChanged += e =>
            {
                order.Add($"paused:resume={e.ResumeState}");
                // Contract completeness: Previous must equal the originating Racing state.
                previousPayload = e.Previous;
            };

            var button = new PauseButton();
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                SimulationDriver.FIXED_DT, null, button.Query, button.Consume);
            button.Armed = true;
            driver.Update();

            Assert.AreEqual(2, order.Count);
            Assert.AreEqual("state:Paused", order[0], "StateChanged must precede PausedStateChanged");
            Assert.AreEqual("paused:resume=Racing", order[1]);
            Assert.AreEqual(SimulationState.Racing, resumeAtStateChanged,
                "resumeState recorded BEFORE StateChanged fires");
            Assert.AreEqual(SimulationState.Racing, previousPayload,
                "PausedStateChanged.Previous carries the originating state");
        }

        [Test]
        public void AC46a_PerformancePauseConsumesFlagOnceAndRecordsResumeState()
        {
            var machine = RacingMachine();
            machine.PendingPerformancePause = true;
            var paused = new List<PausedStateChanged>();
            machine.PausedStateChanged += paused.Add;

            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                SimulationDriver.FIXED_DT);
            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(SimulationState.Racing, machine.ResumeState);
            Assert.AreEqual(1, paused.Count);
            Assert.AreEqual(SimulationState.Racing, paused[0].ResumeState);
            Assert.IsFalse(machine.PendingPerformancePause, "flag consumed exactly once");
        }

        [Test]
        public void AC46a_PauseFromCountdownRecordsCountdownAsResumeState()
        {
            var machine = CountdownMachine(advancedTicks: 0);
            var paused = new List<PausedStateChanged>();
            machine.PausedStateChanged += paused.Add;

            var button = new PauseButton();
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                SimulationDriver.FIXED_DT, null, button.Query, button.Consume);
            button.Armed = true;
            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(SimulationState.Countdown, machine.ResumeState);
            Assert.AreEqual(SimulationState.Countdown, paused[0].ResumeState);
        }

        [Test]
        public void AC46a_DuplicatePauseRequestProducesNoAdditionalEvent()
        {
            var machine = RacingMachine();
            var paused = new List<PausedStateChanged>();
            machine.PausedStateChanged += paused.Add;
            machine.EnterPaused(SimulationState.Racing);
            machine.EnterPaused(SimulationState.Racing); // duplicate -> no-op

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(1, paused.Count, "exactly one PausedStateChanged per pause entry");
        }

        // ---- AC-4.7: resume returns to recorded resumeState ----

        [Test]
        public void AC47_ResumeReturnsToRecordedResumeState()
        {
            var machine = RacingMachine();
            machine.EnterPaused(SimulationState.Racing);
            Assert.AreEqual(SimulationState.Paused, machine.State);

            machine.RequestResume();
            Assert.AreEqual(SimulationState.Racing, machine.State);
        }

        [Test]
        public void AC47_ResumeAfterCountdownPauseReturnsToCountdown()
        {
            var machine = RacingMachine();
            machine.EnterPaused(SimulationState.Countdown);

            machine.RequestResume();
            Assert.AreEqual(SimulationState.Countdown, machine.State);
        }

        [Test]
        public void AC47_InvalidResumeStateIgnoresRequestResume()
        {
            // Enter Paused via a path that records no resumeState (permissive gate path).
            var machine = RacingMachine();
            machine.TryTransition(SimulationState.Paused);
            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.IsNull(machine.ResumeState);

            var changed = new List<SimulationStateChanged>();
            var pausedEvents = new List<PausedStateChanged>();
            machine.StateChanged += changed.Add;
            machine.PausedStateChanged += pausedEvents.Add;
            machine.RequestResume();

            Assert.AreEqual(SimulationState.Paused, machine.State, "ignored without valid resumeState");
            Assert.AreEqual(0, changed.Count, "no transition event on ignored resume");
            Assert.AreEqual(0, pausedEvents.Count, "no PausedStateChanged on ignored resume");
        }

        [Test]
        public void AC47_FocusReturnAloneNeverAutoResumes()
        {
            var machine = RacingMachine();
            var focus = new FocusHook(machine, fireOnCall: 1);
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                1f, focus);

            driver.Update(); // focus loss -> Paused
            Assert.AreEqual(SimulationState.Paused, machine.State);

            // A subsequent focused frame must NOT resume.
            driver.Update();
            Assert.AreEqual(SimulationState.Paused, machine.State);

            machine.RequestResume();
            Assert.AreEqual(SimulationState.Racing, machine.State);
        }

        // ---- AC-5.3: no elapsed time, remainder preserved ----

        [Test]
        public void AC53_PausedUpdatesAccumulateNoElapsedTime()
        {
            var machine = RacingMachine();
            var button = new PauseButton();
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                1f, null, button.Query, button.Consume);
            button.Armed = true;

            driver.Update(); // pause consumes the edge
            double remainderAfterPause = driver.AccumulatorSeconds;
            for (int i = 0; i < 20; i++) driver.Update(); // large deltas while paused

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(remainderAfterPause, driver.AccumulatorSeconds,
                "no elapsed time accumulated while paused");
        }

        [Test]
        public void AC53_ResumeDoesNotCatchUp()
        {
            var machine = RacingMachine();
            machine.EnterPaused(SimulationState.Racing);
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                0.5f * SimulationDriver.FIXED_DT);

            // While Paused the delta is not accumulated at all (CanTick false).
            driver.Update();
            Assert.AreEqual(0d, driver.AccumulatorSeconds);

            machine.RequestResume();
            driver.Update(); // 0.5 tick accumulated, no full tick yet (0.5 < 1.0)
            Assert.AreEqual(0.5d * SimulationDriver.FIXED_DT, driver.AccumulatorSeconds);

            driver.Update(); // total 1.0 -> exactly one tick, no catch-up burst
            Assert.AreEqual(1, driver.SimulationStepCount);
        }

        // ---- AC-7.1: focus loss immediately publishes Paused pre-accumulator ----

        [Test]
        public void AC71_FocusLossImmediatelyPublishesPausedBeforeAccumulator()
        {
            var machine = RacingMachine();
            var focus = new FocusHook(machine, fireOnCall: 1);
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                1f, focus);

            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(0, driver.SimulationStepCount, "no tick executed");
            Assert.AreEqual(SimulationState.Racing, machine.ResumeState);
        }

        // ---- AC-7.1a: focus boundary records resumeState, does no domain work ----

        [Test]
        public void AC71a_FocusBoundaryPreservesStateAndDoesNoDomainWork()
        {
            var machine = RacingMachine();
            var physics = new RecordingPhysics(machine);
            var focus = new FocusHook(machine, fireOnCall: 1);
            var driver = CreateDriver(machine, new RecordingProcessor(), physics, 1f, focus);

            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(0, physics.Calls, "Physics.Simulate never called on focus boundary");
            Assert.AreEqual(0, driver.SimulationStepCount, "no counter incremented");
            Assert.AreEqual(0, driver.ActiveRaceStepCount);
            Assert.AreEqual(SimulationState.Racing, machine.ResumeState);
        }

        [Test]
        public void AC71a_FocusBoundaryPublishesExactlyOnePausedEvent()
        {
            var machine = RacingMachine();
            var paused = new List<PausedStateChanged>();
            machine.PausedStateChanged += paused.Add;
            var focus = new FocusHook(machine, fireOnCall: 1);
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine), 1f, focus);

            driver.Update();
            driver.Update(); // second frame: hook already fired, no re-entry

            Assert.AreEqual(1, paused.Count, "exactly one PausedStateChanged");
        }

        // ---- AC-7.1b: focus-change frame adds no delta ----

        [Test]
        public void AC71b_FocusChangeFramePreservesPreChangeRemainder()
        {
            var machine = RacingMachine();
            var focus = new FocusHook(machine, fireOnCall: 2);
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                0.5f * SimulationDriver.FIXED_DT, focus);

            driver.Update(); // frame 1: 0.5 accumulated, hook not yet fired
            Assert.AreEqual(0.5d * SimulationDriver.FIXED_DT, driver.AccumulatorSeconds);

            driver.Update(); // frame 2: focus lost, delta (1.0) must NOT be added
            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(0.5d * SimulationDriver.FIXED_DT, driver.AccumulatorSeconds,
                "focus-change frame adds no delta");
            Assert.AreEqual(0, driver.SimulationStepCount, "no catch-up tick on focus frame");
        }

        [Test]
        public void AC71b_MultipleFocusNotificationsInOneFrameProduceOneTransition()
        {
            var machine = RacingMachine();
            var paused = new List<PausedStateChanged>();
            machine.PausedStateChanged += paused.Add;
            // Fires EnterPaused TWICE within the same BeforeAccumulator call — the second is a
            // no-op (AC-4.6a duplicate edge) so exactly one transition and one event result.
            var focus = new MultiFireFocusHook(machine, 2);
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine), 1f, focus);

            driver.Update();

            Assert.AreEqual(1, paused.Count);
            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(SimulationState.Racing, machine.ResumeState);
        }

        // ---- Paused lifecycle snapshot publication (AC-4.6a / non-ticking lifecycle output) ----

        [Test]
        public void AC46a_PauseEdgePublishesPausedSnapshotWithResumeState()
        {
            var machine = RacingMachine();
            var button = new PauseButton();
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                SimulationDriver.FIXED_DT, null, button.Query, button.Consume);
            button.Armed = true;
            var snapshots = new List<PublishedSimulationSnapshot>();
            driver.SnapshotPublished += snapshots.Add;

            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(1, snapshots.Count, "exactly one Paused lifecycle snapshot");
            PublishedSimulationSnapshot paused = snapshots[0];
            Assert.IsFalse(paused.HasTerminal, "Paused snapshot carries no terminal state");
            Assert.AreEqual(SimulationState.Racing, paused.ResumeState,
                "Paused snapshot exposes Simulation-owned resumeState");
            Assert.IsNotNull(driver.PublishedSnapshot, "kernel-published snapshot available to consumers");
            Assert.IsFalse(driver.PublishedSnapshot.HasTerminal);
            Assert.AreEqual(SimulationState.Racing, driver.PublishedSnapshot.ResumeState);
        }

        [Test]
        public void AC71a_FocusPausePublishesPausedSnapshotWithResumeState()
        {
            var machine = RacingMachine();
            var focus = new FocusHook(machine, fireOnCall: 1);
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine), 1f, focus);
            var snapshots = new List<PublishedSimulationSnapshot>();
            driver.SnapshotPublished += snapshots.Add;

            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(1, snapshots.Count, "exactly one Paused lifecycle snapshot");
            PublishedSimulationSnapshot paused = snapshots[0];
            Assert.IsFalse(paused.HasTerminal);
            Assert.AreEqual(SimulationState.Racing, paused.ResumeState);
        }

        [Test]
        public void AC46_PauseEdgeWithNoAccumulatedFullTickDoesNotPause()
        {
            // A rising pause edge with no accumulated full tick is not consumed until a
            // tick boundary exists (edge consumed at Step 3 of the tick, ADR-0001).
            var machine = RacingMachine();
            var button = new PauseButton();
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                0.5f * SimulationDriver.FIXED_DT, null, button.Query, button.Consume);
            button.Armed = true;

            driver.Update(); // only 0.5 tick accumulated — no tick runs, edge stays armed

            Assert.AreEqual(SimulationState.Racing, machine.State, "no tick boundary yet — not paused");
            Assert.IsTrue(button.Armed, "pause edge not consumed without a tick boundary");
        }

        [Test]
        public void AC46a_SimultaneousPauseEdgeAndPerformanceFlagProduceOneTransition()
        {
            var machine = RacingMachine();
            machine.PendingPerformancePause = true;
            var paused = new List<PausedStateChanged>();
            machine.PausedStateChanged += paused.Add;
            var button = new PauseButton();
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                SimulationDriver.FIXED_DT, null, button.Query, button.Consume);
            button.Armed = true;

            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(1, paused.Count, "simultaneous causes produce exactly one transition");
            Assert.IsFalse(machine.PendingPerformancePause, "performance flag consumed");
            Assert.IsFalse(button.Armed, "pause edge consumed");
        }

        [Test]
        public void AC46a_PerformancePausePublishesSnapshotWithResumeState()
        {
            var machine = RacingMachine();
            machine.PendingPerformancePause = true;
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                SimulationDriver.FIXED_DT);
            var snapshots = new List<PublishedSimulationSnapshot>();
            driver.SnapshotPublished += snapshots.Add;

            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(1, snapshots.Count);
            Assert.AreEqual(SimulationState.Racing, snapshots[0].ResumeState);
            Assert.IsFalse(snapshots[0].HasTerminal);
        }

        [Test]
        public void AC46a_CountdownPausePublishesSnapshotWithZeroSimTime()
        {
            var machine = CountdownMachine(advancedTicks: 0);
            var button = new PauseButton();
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                SimulationDriver.FIXED_DT, null, button.Query, button.Consume);
            button.Armed = true;
            var snapshots = new List<PublishedSimulationSnapshot>();
            driver.SnapshotPublished += snapshots.Add;

            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(1, snapshots.Count);
            Assert.AreEqual(SimulationState.Countdown, snapshots[0].ResumeState);
            Assert.AreEqual(0f, snapshots[0].SimTime, "no Racing ticks yet — sim_time is 0");
            Assert.IsFalse(snapshots[0].HasTerminal);
            Assert.IsNotNull(driver.PublishedSnapshot);
            Assert.AreEqual(SimulationState.Countdown, driver.PublishedSnapshot.ResumeState);
        }

        [Test]
        public void AC47_ResumeClearsResumeStateAndPublishesNoPausedEvent()
        {
            var machine = RacingMachine();
            machine.EnterPaused(SimulationState.Racing);
            var pausedEvents = new List<PausedStateChanged>();
            machine.PausedStateChanged += pausedEvents.Add;

            machine.RequestResume();

            Assert.AreEqual(SimulationState.Racing, machine.State);
            Assert.IsNull(machine.ResumeState, "resumeState cleared after resume");
            Assert.AreEqual(0, pausedEvents.Count, "no PausedStateChanged on resume");
        }

        [Test]
        public void AC71_FocusLossFromCountdownPublishesPausedBeforeAccumulator()
        {
            var machine = CountdownMachine(advancedTicks: 50);
            var physics = new RecordingPhysics(machine);
            var focus = new FocusHook(machine, fireOnCall: 1);
            var driver = CreateDriver(machine, new RecordingProcessor(), physics, 1f, focus);

            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(SimulationState.Countdown, machine.ResumeState);
            Assert.AreEqual(0, physics.Calls, "no physics on focus boundary from Countdown");
            Assert.AreEqual(250, machine.CountdownRemainingTicks, "countdown ticks preserved");
        }

        [Test]
        public void AC71a_FocusLossWhileAlreadyPausedDoesNotRepublish()
        {
            var machine = RacingMachine();
            machine.EnterPaused(SimulationState.Racing);
            var snapshots = new List<PublishedSimulationSnapshot>();
            var paused = new List<PausedStateChanged>();
            machine.PausedStateChanged += paused.Add;
            // Forced hook: calls EnterPaused even though already Paused — the MACHINE's
            // internal no-op guard must prevent re-publication (mutation-adequate: if the
            // guard regressed, duplicate events/snapshots would surface here).
            var focus = new ForcedPauseHook(machine);
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine), 1f, focus);
            driver.SnapshotPublished += snapshots.Add;

            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(0, snapshots.Count, "no additional snapshot when already Paused");
            Assert.AreEqual(0, paused.Count, "no duplicate PausedStateChanged");
            Assert.AreEqual(SimulationState.Racing, machine.ResumeState,
                "resumeState unchanged by duplicate pause entry");
        }

        [Test]
        public void AC71a_FocusLossWithPendingPerformanceFlagDoesNotRunDomainWork()
        {
            var machine = RacingMachine();
            machine.PendingPerformancePause = true;
            var physics = new RecordingPhysics(machine);
            var focus = new FocusHook(machine, fireOnCall: 1);
            var driver = CreateDriver(machine, new RecordingProcessor(), physics, 1f, focus);

            driver.Update(); // focus boundary fires BEFORE any tick — perf flag never reaches step 4

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(0, physics.Calls, "no physics on focus boundary even with perf flag pending");
            Assert.IsTrue(machine.PendingPerformancePause,
                "perf flag not consumed by the focus boundary (consumed at tick step 4, which never ran)");
        }

        [Test]
        public void AC71a_FocusBoundaryRunsNoPipelineStepAfterIndexFour()
        {
            var machine = RacingMachine();
            var focus = new FocusHook(machine, fireOnCall: 1);
            var stepLog = new List<int>();
            var driver = CreateDriverWithSteps(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                1f, focus, stepLog);

            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.IsEmpty(stepLog, "no pipeline step (indices 4-13) executed on the focus boundary");
        }

        [Test]
        public void AC71b_ClockNotReadOnFocusChangeFrame()
        {
            var machine = RacingMachine();
            var focus = new FocusHook(machine, fireOnCall: 1);
            var clock = new CountingDeltaSource(1f);
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                1f, focus, null, null, clock);

            driver.Update(); // focus lost on first frame

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(0, clock.Reads, "clock never read on the focus-change frame");
        }

        [Test]
        public void AC71b_FocusDeltaZeroOrExactFixedDtAddsNothing()
        {
            foreach (float d in new[] { 0f, SimulationDriver.FIXED_DT })
            {
                var machine = RacingMachine();
                var focus = new FocusHook(machine, fireOnCall: 2);
                var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                    d, focus);

                driver.Update(); // frame 1: no focus, delta d accumulated (may tick and zero)
                double remainderAfterFrame1 = driver.AccumulatorSeconds;

                driver.Update(); // frame 2: focus lost — delta must NOT be added
                Assert.AreEqual(SimulationState.Paused, machine.State);
                Assert.AreEqual(remainderAfterFrame1, driver.AccumulatorSeconds, 1e-6d,
                    $"focus-change frame with delta {d} adds nothing");
            }
        }

        [Test]
        public void AC45_CountdownPauseAtOneRemainingPreservesCount()
        {
            var machine = CountdownMachine(advancedTicks: SimulationStateMachine.CountdownDurationTicks - 1);
            Assert.AreEqual(1, machine.CountdownRemainingTicks);
            var button = new PauseButton();
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                SimulationDriver.FIXED_DT, null, button.Query, button.Consume);
            button.Armed = true;

            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(1, machine.CountdownRemainingTicks, "pause at 1 remaining preserves the final tick");
            Assert.IsTrue(machine.IsGridLocked, "grid lock stays held while paused before GO");
        }

        [Test]
        public void AC46_MultiplePendingTicksConsumeEdgeOnFirstBoundary()
        {
            var machine = RacingMachine();
            var physics = new RecordingPhysics(machine);
            var button = new PauseButton();
            // Delta of 2 x FIXED_DT accumulates two pending ticks in one frame.
            var driver = CreateDriver(machine, new RecordingProcessor(), physics,
                SimulationDriver.FIXED_DT * 2f, null, button.Query, button.Consume);
            button.Armed = true;

            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(0, physics.Calls, "the pause boundary tick does NOT run physics");
            Assert.AreEqual(SimulationState.Racing, machine.ResumeState);
            // The pause boundary tick subtracts no FIXED_DT, so the full 2 x FIXED_DT delta
            // (clamped) remains in the accumulator — preserved for resume (no catch-up loss).
            Assert.AreEqual(SimulationDriver.FIXED_DT * 2f, driver.Accumulator, 1e-6f,
                "pause boundary preserves the accumulated delta");
        }

        [Test]
        public void AC47_ResumeWithRemainderJustBelowFixedDtExecutesNoStep()
        {
            var machine = RacingMachine();
            machine.EnterPaused(SimulationState.Racing);
            // Pre-seed the driver accumulator just below FIXED_DT via a tiny frame.
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                SimulationDriver.FIXED_DT * 0.999f);
            machine.RequestResume();

            driver.Update(); // 0.999 tick accumulated, still below 1.0

            Assert.AreEqual(SimulationState.Racing, machine.State);
            Assert.AreEqual(SimulationDriver.FIXED_DT * 0.999d, driver.AccumulatorSeconds, 1e-6d,
                "remainder just below FIXED_DT preserved; no step executes until it crosses");
            Assert.AreEqual(0, driver.SimulationStepCount);
        }

        [Test]
        public void AC46a_PerformancePauseFromCountdownRecordsCountdown()
        {
            var machine = CountdownMachine(advancedTicks: 0);
            machine.PendingPerformancePause = true;
            var paused = new List<PausedStateChanged>();
            machine.PausedStateChanged += paused.Add;
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                SimulationDriver.FIXED_DT);

            driver.Update();

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(SimulationState.Countdown, machine.ResumeState);
            Assert.AreEqual(1, paused.Count);
            Assert.AreEqual(SimulationState.Countdown, paused[0].ResumeState);
        }

        // ---- RequestRetry interaction (story contract) ----

        [Test]
        public void RequestRetry_IsIgnoredFromPaused()
        {
            var machine = RacingMachine();
            var requests = new List<ContentLoadRequest>();
            machine.ContentLoadRequested += requests.Add;
            machine.EnterPaused(SimulationState.Racing);

            machine.RequestRetry();

            Assert.AreEqual(SimulationState.Paused, machine.State, "Paused exits only via RequestResume");
            Assert.AreEqual(0, requests.Count, "no reload requested from Paused");
        }

        // ---- Helpers ----

        private static SimulationStateMachine RacingMachine()
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            for (int i = 0; i < SimulationStateMachine.CountdownDurationTicks; i++)
                machine.ProcessCountdownTick();
            machine.CompletePhysicsTick();
            return machine;
        }

        private static SimulationStateMachine CountdownMachine(int advancedTicks = 0)
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            for (int i = 0; i < advancedTicks; i++)
                machine.ProcessCountdownTick();
            return machine;
        }

        private static SimulationDriver CreateDriver(
            SimulationStateMachine machine,
            RecordingProcessor processor,
            IPhysicsSimulator physics,
            float delta = SimulationDriver.FIXED_DT,
            IPreAccumulatorLifecycleHook lifecycleHook = null,
            Func<bool> pauseEdgeSource = null,
            Action pauseEdgeConsumer = null,
            IFrameDeltaSource clock = null)
        {
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new NoOpStep();
            steps[CountdownStep.SpineIndex] = new CountdownStep(machine);
            steps[PhysicsSimulateStep.SpineIndex] = new PhysicsSimulateStep(physics);
            steps[GoStep.SpineIndex] = new GoStep(machine);
            steps[TestSteps.PublishSpineIndex] = new TestSteps.PublishStep();
            return new SimulationDriver(
                new SimulationKernel(processor, steps),
                machine,
                new FixedCapture(),
                clock ?? new FixedDeltaSource(delta),
                lifecycleHook,
                pauseEdgeSource,
                pauseEdgeConsumer);
        }

        /// <summary>
        /// Builds a driver whose pipeline steps (indices 4-13, beyond the pause boundary at 3)
        /// record their execution index into <paramref name="stepLog"/>. Proves steps after the
        /// pause boundary never run on an interrupting tick (ADR-0001).
        /// </summary>
        private static SimulationDriver CreateDriverWithSteps(
            SimulationStateMachine machine,
            RecordingProcessor processor,
            IPhysicsSimulator physics,
            float delta,
            IPreAccumulatorLifecycleHook lifecycleHook,
            List<int> stepLog)
        {
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new RecordingStep(i, stepLog);
            steps[CountdownStep.SpineIndex] = new CountdownStep(machine);
            steps[PhysicsSimulateStep.SpineIndex] = new PhysicsSimulateStep(physics);
            steps[GoStep.SpineIndex] = new GoStep(machine);
            steps[TestSteps.PublishSpineIndex] = new TestSteps.PublishStep();
            return new SimulationDriver(
                new SimulationKernel(processor, steps),
                machine,
                new FixedCapture(),
                new FixedDeltaSource(delta),
                lifecycleHook);
        }

        private sealed class PauseButton
        {
            public bool Armed { get; set; }
            public bool Query() => Armed;
            public void Consume() => Armed = false;
        }

        private sealed class FocusHook : IPreAccumulatorLifecycleHook
        {
            private readonly SimulationStateMachine _machine;
            private readonly int _fireOnCall;
            private int _calls;

            public FocusHook(SimulationStateMachine machine, int fireOnCall)
            {
                _machine = machine;
                _fireOnCall = fireOnCall;
            }

            public void BeforeAccumulator(SimulationState state)
            {
                _calls++;
                if (_calls == _fireOnCall &&
                    (state == SimulationState.Racing || state == SimulationState.Countdown))
                    _machine.EnterPaused(state);
            }
        }

        /// <summary>
        /// Fires EnterPaused unconditionally on the first call, even when the machine is
        /// already Paused — forces the machine's own no-op guard to be the protection
        /// (mutation-adequate duplicate-entry test).
        /// </summary>
        private sealed class ForcedPauseHook : IPreAccumulatorLifecycleHook
        {
            private readonly SimulationStateMachine _machine;
            private bool _fired;

            public ForcedPauseHook(SimulationStateMachine machine) => _machine = machine;

            public void BeforeAccumulator(SimulationState state)
            {
                if (_fired)
                    return;
                _fired = true;
                _machine.EnterPaused(state);
            }
        }

        /// <summary>
        /// Fires EnterPaused <paramref name="burstCount"/> times within a single
        /// BeforeAccumulator call to prove duplicate notifications produce exactly one
        /// transition (AC-4.6a edge).
        /// </summary>
        private sealed class MultiFireFocusHook : IPreAccumulatorLifecycleHook
        {
            private readonly SimulationStateMachine _machine;
            private readonly int _burstCount;
            private bool _fired;

            public MultiFireFocusHook(SimulationStateMachine machine, int burstCount)
            {
                _machine = machine;
                _burstCount = burstCount;
            }

            public void BeforeAccumulator(SimulationState state)
            {
                if (_fired ||
                    (state != SimulationState.Racing && state != SimulationState.Countdown))
                    return;
                _fired = true;
                for (int i = 0; i < _burstCount; i++)
                    _machine.EnterPaused(state);
            }
        }

        private sealed class NoOpStep : ISimulationPipelineStep
        {
            public void Execute(SimulationTickContext context) { }
        }

        /// <summary>Records every execution index — proves steps after the pause boundary never run.</summary>
        private sealed class RecordingStep : ISimulationPipelineStep
        {
            private readonly int _index;
            private readonly List<int> _log;

            public RecordingStep(int index, List<int> log)
            {
                _index = index;
                _log = log;
            }

            public void Execute(SimulationTickContext context) => _log.Add(_index);
        }

        /// <summary>Reads a fixed delta but counts reads — proves the clock is NOT read on the focus-change frame.</summary>
        private sealed class CountingDeltaSource : IFrameDeltaSource
        {
            private readonly float _delta;
            public CountingDeltaSource(float delta) => _delta = delta;
            public int Reads { get; private set; }
            public float GetUnscaledDeltaTime() { Reads++; return _delta; }
        }

  private sealed class RecordingProcessor : ISimulationInputProcessor
  {
  private readonly TickProcessor _processor = new TickProcessor();
            public int Calls { get; private set; }

            public SimulationInput Process(RawInputSample sample, bool pausePending)
            {
                Calls++;
                return _processor.Process(sample, pausePending);
            }
        }

        private sealed class RecordingPhysics : IPhysicsSimulator
        {
            private readonly SimulationStateMachine _machine;

            public RecordingPhysics(SimulationStateMachine machine)
            {
                _machine = machine;
            }

            public int Calls { get; private set; }

            public void Simulate(float fixedDeltaTime)
            {
                Calls++;
                _ = _machine.IsGridLocked;
            }
        }

        private sealed class FixedCapture : IFrameInputCapture
        {
            public RawInputSample CaptureLatest()
            {
                return new RawInputSample(1, ControlScheme.KeyboardMouse, 0.8f, 0.2f, 0.1f,
                    InputAvailability.Available, RawInputValidityFlags.None);
            }
        }

        private sealed class FixedDeltaSource : IFrameDeltaSource
        {
            private readonly float _delta;
            public FixedDeltaSource(float delta) => _delta = delta;
            public float GetUnscaledDeltaTime() => _delta;
        }
    }
}
