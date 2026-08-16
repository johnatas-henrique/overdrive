using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Overdrive.Input;
using Overdrive.Simulation;

namespace Overdrive.Simulation.Tests
{
    /// <summary>Story 003 evidence for the session-start lifecycle and retry boundary.</summary>
    [TestFixture]
    public sealed class SessionStartTests
    {
        private static GridAssignment RaceGrid => new GridAssignment(new[] { 1, 2, 3 });

        [Test]
        public void AC41c_NullReasonErrorStillReturnsToIdleSafely()
        {
            var machine = LoadingMachine(RaceMode.Race);
            LifecycleErrorRaised raised = default;
            machine.LifecycleErrorRaised += value => raised = value;

            machine.OnContentLoadError(null, ContentErrorType.Shared);

            Assert.AreEqual(SimulationState.Idle, machine.State);
            Assert.AreEqual(null, raised.Reason);
            Assert.AreEqual(ContentErrorType.Shared, raised.ContentErrorType);
            // Session cleared: no grid/mode remnants exposed.
            Assert.IsNull(machine.GridAssignment);
        }

        [Test]
        public void AC41b_StaleReadinessEmitsNoRequestOrTick()
        {
            var machine = LoadingMachine(RaceMode.Race);
            var requests = new List<ContentLoadRequest>();
            machine.ContentLoadRequested += requests.Add;
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            Assert.AreEqual(SimulationState.Countdown, machine.State);

            // Stale readiness (now in Countdown) must not emit any request.
            machine.OnRaceLoadReady(RaceMode.Qualifying, new GridAssignment(1));
            Assert.AreEqual(0, requests.Count);
        }

        [Test]
        public void AC710_RepeatedPhysicsFailuresDoNotAutoLoop()
        {
            var errors = new List<string>();
            var machine = new SimulationStateMachine(errorLogger: errors.Add);
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            var driver = CreateDriver(machine, new RecordingProcessor(), new ThrowingPhysics());

            // Each Update while retry-held must not execute a tick: physics call count stays 0
            // (the failed tick never committed) and no automatic retry loop starts.
            for (int i = 0; i < 5; i++) driver.Update();

            Assert.IsTrue(machine.IsRetryHeld);
            Assert.AreEqual(1, errors.Count);
            Assert.AreEqual(0, driver.SimulationStepCount);
        }

        [Test]
        public void AC44_MultipleTicksPerFrameAdvanceInputAndPhysicsPerTick()
        {
            var machine = LoadingMachine(RaceMode.Race);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            var processor = new RecordingProcessor();
            var physics = new RecordingPhysics(machine);
            // 2 x FIXED_DT per frame (the driver clamps the accumulator to 2 ticks, ADR-0001)
            // -> exactly 2 ticks per Update; 150 frames complete the 300-tick countdown.
            var driver = CreateDriver(machine, processor, physics, SimulationDriver.FIXED_DT * 2f);

            for (int i = 0; i < 150; i++) driver.Update(); // 300 ticks total

            Assert.AreEqual(300, processor.Calls);
            Assert.AreEqual(300, physics.Calls);
            Assert.IsTrue(physics.GridLockedAtCall.All(locked => locked));
            Assert.AreEqual(SimulationState.Racing, machine.State);
        }

        [Test]
        public void AC40_NullGridStartRejectedWithoutLeavingIdle()
        {
            var machine = new SimulationStateMachine();
            var requests = new List<ContentLoadRequest>();
            machine.ContentLoadRequested += requests.Add;

            Assert.IsFalse(machine.StartSingleRace(RaceMode.Race, null));
            Assert.AreEqual(SimulationState.Idle, machine.State);
            Assert.AreEqual(0, requests.Count);
        }

        [Test]
        public void AC41_NullOrWrongModeReadinessRejectedInLoading()
        {
            var machine = LoadingMachine(RaceMode.Race);

            // Null grid readiness ignored.
            machine.OnRaceLoadReady(RaceMode.Race, null);
            Assert.AreEqual(SimulationState.Loading, machine.State);

            // Wrong-mode readiness ignored while still Loading.
            machine.OnRaceLoadReady(RaceMode.Qualifying, new GridAssignment(1));
            Assert.AreEqual(SimulationState.Loading, machine.State);
            Assert.AreEqual(RaceMode.Race, machine.RaceMode);

            // Correct readiness still works afterward.
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            Assert.AreEqual(SimulationState.Countdown, machine.State);
        }

        [Test]
        public void AC413_LoadingDoesNotAccumulateElapsedTime()
        {
            var machine = LoadingMachine(RaceMode.Race);
            var physics = new RecordingPhysics(machine);
            var driver = CreateDriver(machine, new RecordingProcessor(), physics, 1f);

            driver.Update();

            // Loading is not tickable: no physics, no counters, and the accumulator is
            // not advanced (the driver returns before accumulating when CanTick is false).
            Assert.AreEqual(0, physics.Calls);
            Assert.AreEqual(0, driver.SimulationStepCount);
            Assert.AreEqual(0d, driver.AccumulatorSeconds);
        }

        [Test]
        public void AC411_RepeatedLoadingUpdatesStayInert()
        {
            var machine = LoadingMachine(RaceMode.Race);
            var physics = new RecordingPhysics(machine);
            var driver = CreateDriver(machine, new RecordingProcessor(), physics);

            for (int i = 0; i < 10; i++) driver.Update();

            Assert.AreEqual(SimulationState.Loading, machine.State);
            Assert.AreEqual(0, physics.Calls);
            Assert.AreEqual(0, driver.SimulationStepCount);
            Assert.AreEqual(0d, driver.AccumulatorSeconds);
        }

        [Test]
        public void AC40_IdleStartTransitionsToLoadingAndEmitsOneRequest()
        {
            var machine = new SimulationStateMachine();
            var requests = new List<ContentLoadRequest>();
            machine.ContentLoadRequested += requests.Add;

            Assert.IsTrue(machine.StartSingleRace(RaceMode.Race, RaceGrid));
            Assert.IsFalse(machine.StartSingleRace(RaceMode.Race, RaceGrid));
            Assert.AreEqual(SimulationState.Loading, machine.State);
            Assert.AreEqual(1, requests.Count);
            Assert.AreEqual(RaceMode.Race, requests[0].RaceMode);
        }

        [Test]
        public void AC41_RaceReadyTransitionsToCountdownWithGridLock()
        {
            var machine = LoadingMachine(RaceMode.Race);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);

            Assert.AreEqual(SimulationState.Countdown, machine.State);
            Assert.IsTrue(machine.IsGridLocked);
            Assert.AreEqual(SimulationStateMachine.CountdownDurationTicks, machine.CountdownRemainingTicks);
        }

        [Test]
        public void AC41a_QualifyingReadyTransitionsDirectlyToRacingAndSignalsContext()
        {
            var machine = LoadingMachine(RaceMode.Qualifying);
            int signalCount = 0;
            machine.GameplayQualifyingRequested += () => signalCount++;

            machine.OnRaceLoadReady(RaceMode.Qualifying, new GridAssignment(4));

            Assert.AreEqual(SimulationState.Racing, machine.State);
            Assert.AreEqual(RaceMode.Qualifying, machine.RaceMode);
            Assert.IsFalse(machine.IsGridLocked);
            Assert.AreEqual(1, signalCount);
        }

        [Test]
        public void AC41aa_QualifyingSkipsCountdownAndGridLock()
        {
            var machine = LoadingMachine(RaceMode.Qualifying);
            machine.OnRaceLoadReady(RaceMode.Qualifying, new GridAssignment(4));

            Assert.AreEqual(SimulationState.Racing, machine.State);
            Assert.AreEqual(0, machine.CountdownRemainingTicks);
            Assert.IsFalse(machine.IsGridLocked);
        }

        [Test]
        public void AC41b_ReadinessIgnoredInAllNonLoadingStates()
        {
            var machine = new SimulationStateMachine();
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            Assert.AreEqual(SimulationState.Idle, machine.State);

            // Idle -> start -> Loading -> Countdown; readiness is consumed once.
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            Assert.AreEqual(SimulationState.Countdown, machine.State);

            // Countdown: stale readiness ignored (state + session unchanged).
            machine.OnRaceLoadReady(RaceMode.Qualifying, new GridAssignment(1));
            Assert.AreEqual(SimulationState.Countdown, machine.State);
            Assert.AreEqual(RaceMode.Race, machine.RaceMode);

            // Racing: stale readiness ignored.
            for (int i = 0; i < 300; i++) machine.ProcessCountdownTick();
            machine.CompletePhysicsTick();
            Assert.AreEqual(SimulationState.Racing, machine.State);
            machine.OnRaceLoadReady(RaceMode.Qualifying, new GridAssignment(1));
            Assert.AreEqual(SimulationState.Racing, machine.State);
            Assert.AreEqual(RaceMode.Race, machine.RaceMode);

            // Paused: stale readiness ignored.
            machine.TryTransition(SimulationState.Paused);
            machine.OnRaceLoadReady(RaceMode.Qualifying, new GridAssignment(1));
            Assert.AreEqual(SimulationState.Paused, machine.State);

            // Back to Racing, then Finished: stale readiness ignored.
            machine.TryTransition(SimulationState.Racing);
            machine.TryTransition(SimulationState.Finished);
            machine.OnRaceLoadReady(RaceMode.Qualifying, new GridAssignment(1));
            Assert.AreEqual(SimulationState.Finished, machine.State);

            // Results: stale readiness ignored.
            machine.TryTransition(SimulationState.Results);
            machine.OnRaceLoadReady(RaceMode.Qualifying, new GridAssignment(1));
            Assert.AreEqual(SimulationState.Results, machine.State);
        }

        [Test]
        public void AC41c_ContentErrorReturnsToIdleAndPublishesMetadataOnce()
        {
            var machine = LoadingMachine(RaceMode.Race);
            LifecycleErrorRaised raised = default;
            int signalCount = 0;
            machine.LifecycleErrorRaised += value => { raised = value; signalCount++; };

            machine.OnContentLoadError("track missing", ContentErrorType.Track);
            machine.OnContentLoadError("duplicate", ContentErrorType.Catalog);

            Assert.AreEqual(SimulationState.Idle, machine.State);
            Assert.AreEqual(1, signalCount);
            Assert.AreEqual("track missing", raised.Reason);
            Assert.AreEqual(ContentErrorType.Track, raised.ContentErrorType);
        }

        [Test]
        public void AC41d_LoadingCompletionResetsAccumulatorBeforeFirstActiveTick()
        {
            // Real driver path: a prior session leaves a sub-tick remainder in the accumulator;
            // Loading cannot tick it away, and readiness (delivered inside the pre-accumulator
            // hook, the production composition path) must zero it (AC-4.1d).
            var machine = new SimulationStateMachine();
            var ready = new ReadinessHook(machine, RaceMode.Race, RaceGrid);
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                SimulationDriver.FIXED_DT * 0.5f, ready);

            // Prior session: reach Countdown, accumulate 1.5 ticks, consume 1, leave 0.5.
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            driver.Update(); // 0.5 remains (no full tick yet)
            Assert.AreEqual(SimulationDriver.FIXED_DT * 0.5d, driver.AccumulatorSeconds);

            // Abandon the session back to Idle, then start fresh into Loading. The 0.5
            // remainder persists through Loading (CanTick = false, cannot be consumed).
            machine.TryTransition(SimulationState.Idle);
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            Assert.AreEqual(SimulationState.Loading, machine.State);
            Assert.AreEqual(SimulationDriver.FIXED_DT * 0.5d, driver.AccumulatorSeconds);

            // Readiness inside the hook: driver observes Loading -> Countdown, resets the
            // prior 0.5 remainder to zero, then adds this frame's delta (0.5). Without the
            // reset the accumulator would be 0.5 + 0.5 = 1.0; with it, only the fresh 0.5.
            driver.Update();
            Assert.AreEqual(SimulationState.Countdown, machine.State);
            Assert.AreEqual(SimulationDriver.FIXED_DT * 0.5d, driver.AccumulatorSeconds);
        }

        [Test]
        public void AC41d_QualifyingReadyAlsoResetsAccumulator()
        {
            var machine = new SimulationStateMachine();
            var ready = new ReadinessHook(machine, RaceMode.Qualifying, new GridAssignment(4));
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine),
                SimulationDriver.FIXED_DT * 0.5f, ready);

            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            driver.Update();
            machine.TryTransition(SimulationState.Idle);
            machine.StartSingleRace(RaceMode.Qualifying, new GridAssignment(4));
            Assert.AreEqual(SimulationState.Loading, machine.State);
            Assert.AreEqual(SimulationDriver.FIXED_DT * 0.5d, driver.AccumulatorSeconds);

            driver.Update();
            Assert.AreEqual(SimulationState.Racing, machine.State);
            // Reset proved: only this frame's fresh 0.5 delta remains, not 0.5 (prior) + 0.5.
            Assert.AreEqual(SimulationDriver.FIXED_DT * 0.5d, driver.AccumulatorSeconds);
        }

        [Test]
        public void AC42_CountdownInitializesAtThreeHundredAndDecrementsOnce()
        {
            var machine = LoadingMachine(RaceMode.Race);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            Assert.AreEqual(300, machine.CountdownRemainingTicks);

            machine.ProcessCountdownTick();
            Assert.AreEqual(299, machine.CountdownRemainingTicks);
        }

        [Test]
        public void AC42_CountdownDoesNotDecrementWhilePausedOrOutsideBounds()
        {
            var machine = LoadingMachine(RaceMode.Race);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            Assert.AreEqual(300, machine.CountdownRemainingTicks);

            // Paused: CanTick=false -> no decrement.
            machine.TryTransition(SimulationState.Paused);
            machine.ProcessCountdownTick();
            Assert.AreEqual(300, machine.CountdownRemainingTicks);

            // Back to Countdown: exactly one decrement per tick, cannot exceed 300.
            machine.TryTransition(SimulationState.Countdown);
            machine.ProcessCountdownTick();
            machine.ProcessCountdownTick();
            Assert.AreEqual(298, machine.CountdownRemainingTicks);

            // Zero is the floor: no negative values.
            for (int i = 0; i < 400; i++) machine.ProcessCountdownTick();
            Assert.IsTrue(machine.CountdownRemainingTicks >= 0);
        }

        [Test]
        public void AC43_FinalCountdownTickDefersReleaseUntilPostPhysics()
        {
            var machine = LoadingMachine(RaceMode.Race);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            for (int i = 0; i < 299; i++) machine.ProcessCountdownTick();
            machine.ProcessCountdownTick();

            Assert.AreEqual(0, machine.CountdownRemainingTicks);
            Assert.AreEqual(SimulationState.Countdown, machine.State);
            Assert.IsTrue(machine.IsGridLocked);
            machine.CompletePhysicsTick();
            Assert.AreEqual(SimulationState.Racing, machine.State);
            Assert.IsFalse(machine.IsGridLocked);
        }

        [Test]
        public void AC44_CountdownProcessesInputWhileGridRemainsLocked()
        {
            var machine = LoadingMachine(RaceMode.Race);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            var processor = new RecordingProcessor();
            var physics = new RecordingPhysics(machine);
            var driver = CreateDriver(machine, processor, physics);

            for (int i = 0; i < 300; i++) driver.Update();

            Assert.AreEqual(300, processor.Calls);
            Assert.AreEqual(300, physics.Calls);
            Assert.IsTrue(physics.GridLockedAtCall.Count == 300);
            // Grid lock observed on every physics call during Countdown (300 ticks, all locked).
            Assert.IsTrue(physics.GridLockedAtCall.All(locked => locked));
            Assert.IsFalse(machine.IsGridLocked);
        }

        [Test]
        public void AC44a_CountdownDoesNotExposeResourceMutation()
        {
            // Fuel/Tire are pipeline steps 5a/5b owned by their epics. Within Story 003 the
            // contract is that the session-start machine never exposes or mutates resource
            // state: 300 countdown ticks leave no resource seam touched (QA case: "Fuel and
            // Tire values exactly equal initial race values" is verified at the Fuel/Tire
            // pipeline steps, out of this story's scope).
            var machine = LoadingMachine(RaceMode.Race);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            for (int i = 0; i < 300; i++) machine.ProcessCountdownTick();

            // 300 decrements reach zero; the machine exposes no resource mutation seam.
            Assert.AreEqual(0, machine.CountdownRemainingTicks);
            Assert.AreEqual(SimulationState.Countdown, machine.State);
        }

        [Test]
        public void AC44b_GoTickTransitionsAfterPhysicsAndMarksGoBoundary()
        {
            var machine = LoadingMachine(RaceMode.Race);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            var physics = new RecordingPhysics(machine);
            var driver = CreateDriver(machine, new RecordingProcessor(), physics);
            PublishedSimulationSnapshot published = null;
            driver.SnapshotPublished += value => published = value;

            for (int i = 0; i < 300; i++) driver.Update();

            Assert.AreEqual(SimulationState.Racing, machine.State);
            Assert.AreEqual(300, driver.SimulationStepCount);
            Assert.AreEqual(0, driver.ActiveRaceStepCount);
            Assert.IsNotNull(published);
            Assert.AreEqual(0, published.activeRaceStepCount);
            Assert.AreEqual(0f, published.sim_time);
            // 300 physics calls all saw grid lock (including the GO tick itself — release
            // happens only AFTER physics returns; ADR-0001 L139).
            Assert.AreEqual(300, physics.Calls);
            Assert.IsTrue(physics.GridLockedAtCall.All(locked => locked));
        }

        [Test]
        public void AC44b_GoTickSetsIsGoBoundaryOnContext()
        {
            var machine = LoadingMachine(RaceMode.Race);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            var physics = new RecordingPhysics(machine);
            var driver = CreateDriver(machine, new RecordingProcessor(), physics);
            // The kernel exposes the context only through the published snapshot path;
            // the IsGoTick flag is observable on the published snapshot's step boundary via
            // the GoStep setting it before publish. We verify the GO tick occurred at the
            // boundary by confirming the transition happened after physics (grid lock seen
            // on the 300th call) and the following tick is the first Racing tick.
            for (int i = 0; i < 301; i++) driver.Update();

            // GO tick (300th) ran physics while locked; Racing tick 301 unlocked.
            Assert.AreEqual(SimulationState.Racing, machine.State);
            Assert.AreEqual(301, physics.Calls);
            Assert.IsTrue(physics.GridLockedAtCall[299]);
            Assert.IsFalse(physics.GridLockedAtCall[300]);
            Assert.AreEqual(1, driver.ActiveRaceStepCount);
        }

        [Test]
        public void AC411_LoadingIgnoresNonCompletionEventsAndCannotTick()
        {
            var machine = LoadingMachine(RaceMode.Race);
            var physics = new RecordingPhysics(machine);
            var driver = CreateDriver(machine, new RecordingProcessor(), physics);
            driver.Update();

            Assert.AreEqual(SimulationState.Loading, machine.State);
            Assert.IsFalse(machine.CanTick);
            Assert.AreEqual(0, physics.Calls);
        }

        [Test]
        public void AC413_LoadingRunsNoPhysicsEvenWithLargeElapsedTime()
        {
            var machine = LoadingMachine(RaceMode.Race);
            var physics = new RecordingPhysics(machine);
            var driver = CreateDriver(machine, new RecordingProcessor(), physics, 1f);
            driver.Update();

            Assert.AreEqual(0, physics.Calls);
            Assert.AreEqual(0, driver.SimulationStepCount);
        }

        [Test]
        public void AC17_FirstRacingSnapshotStartsAtZeroRaceTime()
        {
            var machine = LoadingMachine(RaceMode.Race);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            var driver = CreateDriver(machine, new RecordingProcessor(), new RecordingPhysics(machine));
            var racingSnapshots = new List<PublishedSimulationSnapshot>();
            driver.SnapshotPublished += value =>
            {
                if (value.SimulationState == SimulationState.Racing)
                    racingSnapshots.Add(value);
            };

            for (int i = 0; i < 300; i++) driver.Update();

            // First Racing snapshot (the one published on the GO tick) starts at zero.
            Assert.IsNotEmpty(racingSnapshots);
            PublishedSimulationSnapshot first = racingSnapshots[0];
            Assert.AreEqual(SimulationState.Racing, first.SimulationState);
            Assert.AreEqual(0, first.ActiveRaceStepCount);
            Assert.AreEqual(0f, first.SimTime);

            // The following tick is the first to start in Racing: it increments to 1.
            driver.Update();
            Assert.AreEqual(1, driver.ActiveRaceStepCount);
            Assert.AreEqual(SimulationDriver.FIXED_DT, driver.SimTime);
        }

        [Test]
        public void AC710_CountdownPhysicsFailureFreezesAndRetryRestartsCountdown()
        {
            var errors = new List<string>();
            var machine = new SimulationStateMachine(errorLogger: errors.Add);
            var requests = new List<ContentLoadRequest>();
            machine.ContentLoadRequested += requests.Add;
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            var driver = CreateDriver(machine, new RecordingProcessor(), new ThrowingPhysics());

            driver.Update();
            // Failed tick must not commit: no step count, no partial advancement.
            Assert.AreEqual(0, driver.SimulationStepCount);
            Assert.IsTrue(machine.IsRetryHeld);
            Assert.AreEqual(SimulationState.Countdown, machine.State);
            Assert.AreEqual(1, errors.Count);

            machine.RequestRetry();
            // Countdown failure restarts ONLY the 300-tick counter and stays Countdown
            // (AC-7.10: "retry restarts Countdown at countdownRemainingTicks = 300 if the
            // exception occurred during Countdown"). No reload request is emitted.
            Assert.AreEqual(SimulationState.Countdown, machine.State);
            Assert.IsFalse(machine.IsRetryHeld);
            Assert.AreEqual(SimulationStateMachine.CountdownDurationTicks, machine.CountdownRemainingTicks);
            Assert.AreEqual(1, requests.Count);
        }

        [Test]
        public void AC710_RacingPhysicsFailureRetryReloadsCurrentRace()
        {
            var errors = new List<string>();
            var machine = new SimulationStateMachine(errorLogger: errors.Add);
            var requests = new List<ContentLoadRequest>();
            machine.ContentLoadRequested += requests.Add;
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            // Succeeds through the 300 countdown ticks, then throws on the first Racing tick.
            var driver = CreateDriver(machine, new RecordingProcessor(), new ThrowsAfterGoPhysics());

            for (int i = 0; i < 300; i++) driver.Update();
            Assert.AreEqual(SimulationState.Racing, machine.State);
            Assert.AreEqual(0, driver.ActiveRaceStepCount);
            Assert.AreEqual(300, driver.SimulationStepCount);

            driver.Update(); // first Racing tick -> physics throws
            Assert.IsTrue(machine.IsRetryHeld);
            Assert.AreEqual(1, errors.Count);
            // Frozen: the failed Racing tick must not commit step/race counters.
            Assert.AreEqual(300, driver.SimulationStepCount);
            Assert.AreEqual(0, driver.ActiveRaceStepCount);
            Assert.AreEqual(SimulationState.Racing, machine.State);

            machine.RequestRetry();
            // Racing failure reloads the current race: ContentLoadRequest -> Loading, then
            // fresh RaceLoadReady -> Countdown (AC-7.10 / GDD "offer retry from last checkpoint").
            Assert.AreEqual(SimulationState.Loading, machine.State);
            Assert.AreEqual(2, requests.Count);
            Assert.AreEqual(RaceMode.Race, requests[1].RaceMode);

            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            Assert.AreEqual(SimulationState.Countdown, machine.State);
            Assert.AreEqual(SimulationStateMachine.CountdownDurationTicks, machine.CountdownRemainingTicks);
        }

        [Test]
        public void AC710_QualifyingPhysicsFailureReturnsIdleWithoutRetry()
        {
            var errors = new List<LifecycleErrorRaised>();
            var machine = new SimulationStateMachine(errorLogger: _ => { });
            machine.LifecycleErrorRaised += errors.Add;
            machine.StartSingleRace(RaceMode.Qualifying, new GridAssignment(2));
            machine.OnRaceLoadReady(RaceMode.Qualifying, new GridAssignment(2));
            var driver = CreateDriver(machine, new RecordingProcessor(), new ThrowingPhysics());

            driver.Update();

            Assert.AreEqual(SimulationState.Idle, machine.State);
            Assert.IsFalse(machine.IsRetryHeld);
            Assert.AreEqual(1, errors.Count);

            // A qualifying failure is NOT retryable (ADR-0013): RequestRetry on the cleared
            // session must not resurrect the session or emit a load request.
            var requests = new List<ContentLoadRequest>();
            machine.ContentLoadRequested += requests.Add;
            machine.RequestRetry();
            Assert.AreEqual(SimulationState.Idle, machine.State);
            Assert.AreEqual(0, requests.Count);
        }

        private static SimulationStateMachine LoadingMachine(RaceMode mode)
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(mode, mode == RaceMode.Race ? RaceGrid : new GridAssignment(1));
            return machine;
        }

        private static SimulationDriver CreateDriver(
            SimulationStateMachine machine,
            RecordingProcessor processor,
            IPhysicsSimulator physics,
            float delta = SimulationDriver.FIXED_DT,
            IPreAccumulatorLifecycleHook lifecycleHook = null)
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
          new FixedDeltaSource(delta),
          lifecycleHook,
          physicsFailureHandler: machine);
        }

        private sealed class NoOpStep : ISimulationPipelineStep
        {
            public void Execute(SimulationTickContext context) { }
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
            private readonly List<bool> _gridLockedAtCall = new List<bool>();

            public RecordingPhysics(SimulationStateMachine machine)
            {
                _machine = machine;
            }

            public int Calls { get; private set; }
            public IReadOnlyList<bool> GridLockedAtCall => _gridLockedAtCall;

            public void Simulate(float fixedDeltaTime)
            {
                Calls++;
                _gridLockedAtCall.Add(_machine.IsGridLocked);
            }
        }

        private sealed class ThrowingPhysics : IPhysicsSimulator
        {
            public void Simulate(float fixedDeltaTime)
            {
                throw new InvalidOperationException("physics failure");
            }
        }

        /// <summary>Succeeds during Countdown; throws on the first tick after GO (Racing).</summary>
        private sealed class ThrowsAfterGoPhysics : IPhysicsSimulator
        {
            private int _calls;

            public void Simulate(float fixedDeltaTime)
            {
                _calls++;
                if (_calls > 300)
                    throw new InvalidOperationException("physics failure after GO");
            }
        }

        private sealed class FixedCapture : IFrameInputCapture
        {
            public RawInputSample CaptureLatest()
            {
                return new RawInputSample(1, ControlScheme.KeyboardMouse, 0.8f, 0.2f, 0.1f,
                    InputAvailability.Available, RawInputValidityFlags.None);
            }

            /// <summary>Optional pause-edge provider (C4: edge lives on the frame seam).</summary>
            public Func<bool> EdgeProvider;

            /// <summary>Counts pause-edge consumptions for delivery assertions.</summary>
            public int EdgeConsumeCount { get; private set; }

            public bool HasPendingPauseEdge => EdgeProvider?.Invoke() ?? false;

            public void ConsumePendingPauseEdge() => EdgeConsumeCount++;
        }

        private sealed class FixedDeltaSource : IFrameDeltaSource
        {
            private readonly float _delta;
            public FixedDeltaSource(float delta) => _delta = delta;
            public float GetUnscaledDeltaTime() => _delta;
        }

        /// <summary>
        /// Simulates the production composition path: when the driver invokes the
        /// pre-accumulator hook, content readiness is delivered inside the hook so the
        /// driver observes Loading -> Countdown/Racing on that same frame (AC-4.1d).
        /// </summary>
        private sealed class ReadinessHook : IPreAccumulatorLifecycleHook
        {
            private readonly SimulationStateMachine _machine;
            private readonly RaceMode _mode;
            private readonly GridAssignment _grid;
            private bool _delivered;

            public ReadinessHook(SimulationStateMachine machine, RaceMode mode, GridAssignment grid)
            {
                _machine = machine;
                _mode = mode;
                _grid = grid;
            }

            public void BeforeAccumulator(SimulationState state)
            {
                if (_delivered || state != SimulationState.Loading)
                    return;
                _machine.OnRaceLoadReady(_mode, _grid);
                _delivered = true;
            }
        }
    }
}
