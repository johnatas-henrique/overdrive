using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Overdrive.Input;
using Overdrive.Simulation;

namespace Overdrive.Simulation.Tests
{
    /// <summary>
    /// Story 005 evidence for the terminal lifecycle: finish detection/resolution (4.8,
    /// 4.8dnf, 4.8e, 4.8f), terminal presentation + dismissal (4.8a, 4.8b, 4.8c, 4.8i, 4.8g),
    /// snapshot immutability (4.8d), AI skip (4.8j), results/forfeit/unload (4.8h, 4.10,
    /// 4.10a, 4.10b, 4.12), finished focus retention (7.1c). Integration type: the finish
    /// flow is exercised through the real 14-step pipeline with RSM/UI/content mocks.
    /// </summary>
    [TestFixture]
    public sealed class SessionEndTests
    {
        private static GridAssignment RaceGrid => new GridAssignment(new[] { 1, 2, 3 });

        // ---- Pipeline helper: real spine with RSM/UI/content seams mounted ----

        private static SimulationDriver CreateDriver(
            SimulationStateMachine machine,
            RecordingProcessor processor,
            IPhysicsSimulator physics,
            float delta,
            IRaceSessionManagerEvaluate rsm = null,
            IFinishOrderResolver resolver = null,
            IPreAccumulatorLifecycleHook lifecycleHook = null,
            List<int> aiLog = null)
        {
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new NoOpStep();
            steps[CountdownStep.SpineIndex] = new CountdownStep(machine);
            steps[PhysicsSimulateStep.SpineIndex] = new PhysicsSimulateStep(physics);
            steps[GoStep.SpineIndex] = new GoStep(machine);
            // Post-physics readout writes the frozen arrays (defect 2 fix).
            steps[ReadoutStep.SpineIndex] = new ReadoutStep();
            steps[RsmEvaluationStep.SpineIndex] = new RsmEvaluationStep(rsm ?? new NoFinishRsm(), machine);
            steps[RsmConsumeStep.SpineIndex] = new RsmConsumeStep(machine, resolver ?? new NoOpResolver());
            steps[11] = new PublishStep();
            steps[AiSkipStep.SpineIndex] = new AiSkipStep(machine);
            return new SimulationDriver(
                new SimulationKernel(processor, steps),
                machine,
                new FixedCapture(),
                new FixedDeltaSource(delta),
                lifecycleHook);
        }

        /// <summary>
        /// Builds a driver whose Step 13 is the AI producer (simulating the AI epic writing
        /// the cache during active ticks) instead of the default no-op — used by AC-4.8j to
        /// prove the Kernel's AiSkipStep clears the cache after resolution.
        /// </summary>
        private static SimulationDriver CreateDriverWithAiProducer(
            SimulationStateMachine machine,
            RecordingProcessor processor,
            IPhysicsSimulator physics,
            float delta,
            IRaceSessionManagerEvaluate rsm,
            IFinishOrderResolver resolver,
            AiProducerStep producer)
        {
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new NoOpStep();
            steps[CountdownStep.SpineIndex] = new CountdownStep(machine);
            steps[PhysicsSimulateStep.SpineIndex] = new PhysicsSimulateStep(physics);
            steps[GoStep.SpineIndex] = new GoStep(machine);
            steps[ReadoutStep.SpineIndex] = new ReadoutStep();
            steps[RsmEvaluationStep.SpineIndex] = new RsmEvaluationStep(rsm, machine);
            steps[RsmConsumeStep.SpineIndex] = new RsmConsumeStep(machine, resolver);
            steps[11] = new PublishStep();
            steps[AiSkipStep.SpineIndex] = new AiSkipStep(machine);
            steps[AiSkipStep.SpineIndex + 1] = producer; // index 13 = Step 14 slot
            return new SimulationDriver(
                new SimulationKernel(processor, steps),
                machine,
                new FixedCapture(),
                new FixedDeltaSource(delta));
        }

        /// <summary>
        /// Builds a driver whose every pipeline step logs its execution index — proves no
        /// step of any kind runs on Finished/Results frames (AC-4.8e gap: Fuel/Tire/Pit/AI
        /// steps belong to other epics, but the Kernel guarantees the spine is not invoked).
        /// </summary>
        private static SimulationDriver CreateDriverWithStepLog(
            SimulationStateMachine machine,
            RecordingProcessor processor,
            IPhysicsSimulator physics,
            float delta,
            IRaceSessionManagerEvaluate rsm,
            IFinishOrderResolver resolver,
            List<int> stepLog)
        {
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
            {
                int index = i;
                steps[i] = new LoggingStep(index, stepLog);
            }
            steps[CountdownStep.SpineIndex] = new CountdownStep(machine);
            steps[PhysicsSimulateStep.SpineIndex] = new PhysicsSimulateStep(physics);
            steps[GoStep.SpineIndex] = new GoStep(machine);
            steps[ReadoutStep.SpineIndex] = new ReadoutStep();
            steps[RsmEvaluationStep.SpineIndex] = new RsmEvaluationStep(rsm, machine);
            steps[RsmConsumeStep.SpineIndex] = new RsmConsumeStep(machine, resolver);
            steps[11] = new PublishStep();
            steps[AiSkipStep.SpineIndex] = new AiSkipStep(machine);
            return new SimulationDriver(
                new SimulationKernel(processor, steps),
                machine,
                new FixedCapture(),
                new FixedDeltaSource(delta));
        }

        /// <summary>Runs a session to Racing (start + readiness + full 300-tick countdown).</summary>
        private static SimulationDriver RacingDriver(
            SimulationStateMachine machine,
            IPhysicsSimulator physics = null,
            IRaceSessionManagerEvaluate rsm = null,
            IFinishOrderResolver resolver = null,
            List<int> aiLog = null,
            float delta = SimulationDriver.FIXED_DT)
        {
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            var driver = CreateDriver(machine, new RecordingProcessor(), physics ?? new NoOpPhysics(),
                delta, rsm, resolver, null, aiLog);
            for (int i = 0; i < 300; i++) driver.Update();
            Assert.AreEqual(SimulationState.Racing, machine.State, "setup must reach Racing");
            return driver;
        }

        private static SimulationStateMachine FinishedMachine(
            IFinishOrderResolver resolver = null,
            ResultClassification playerClassification = ResultClassification.Finished)
        {
            var machine = new SimulationStateMachine();
            var rsm = new SequenceRsm(
                new FinishDetected(ResultKind.Race, playerClassification, 98.5f));
            var driver = RacingDriver(machine, new NoOpPhysics(), rsm, resolver ?? new NoOpResolver());
            driver.Update(); // first Racing tick evaluates the finish (tick 301)
            Assert.AreEqual(SimulationState.Finished, machine.State, "finish must reach Finished");
            return machine;
        }

        // =================================================================================
        // AC-4.8: finish detected → Finished, no further tick, resolver once
        // =================================================================================

        [Test]
        public void AC48_FinishDetectedTransitionsToFinishedWithResolverOnce()
        {
            var machine = new SimulationStateMachine();
            var rsm = new SequenceRsm(new FinishDetected(ResultKind.Race, ResultClassification.Finished, 98.5f));
            var resolver = new RecordingResolver();
            var physics = new RecordingPhysics();
            var driver = RacingDriver(machine, physics, rsm, resolver);
            int callsAfterSetup = physics.Calls; // 300 countdown ticks

            driver.Update(); // the finishing tick — physics runs once, then resolution

            Assert.AreEqual(SimulationState.Finished, machine.State);
            Assert.AreEqual(1, resolver.Calls, "FinishOrderResolver runs exactly once");
            Assert.IsNotNull(resolver.LastSnapshot, "resolver receives the locked post-finish snapshot");
            Assert.AreEqual(callsAfterSetup + 1, physics.Calls,
                "the finishing tick is still a Racing tick (physics once); NO physics after resolution");

            driver.Update(); // a Finished frame — no tick, no physics
            Assert.AreEqual(callsAfterSetup + 1, physics.Calls, "no physics on Finished frames");
            Assert.AreEqual(1, resolver.Calls, "duplicate frame does not re-resolve");
        }

        [Test]
        public void AC48_DuplicateFinishDetectedDoesNotReResolve()
        {
            var machine = new SimulationStateMachine();
            var rsm = new SequenceRsm(
                new FinishDetected(ResultKind.Race, ResultClassification.Finished, 98.5f),
                new FinishDetected(ResultKind.Race, ResultClassification.Finished, 98.5f));
            var resolver = new RecordingResolver();
            var driver = RacingDriver(machine, new NoOpPhysics(), rsm, resolver);

            driver.Update(); // first finish
            Assert.AreEqual(1, resolver.Calls);
            Assert.AreEqual(SimulationState.Finished, machine.State);

            // A later frame would deliver the second finish signal, but the machine is
            // Finished — RsmEvaluationStep gates on Racing, so the resolver is never
            // re-invoked even if the RSM mock reports again.
            driver.Update();
            driver.Update();
            Assert.AreEqual(1, resolver.Calls, "duplicate finish after resolution does not re-resolve");
        }

        [Test]
        public void AC48_FinishOnNonFinalLapDoesNotTransition()
        {
            var machine = new SimulationStateMachine();
            var rsm = new SequenceRsm(); // no finish ever
            var driver = RacingDriver(machine, new NoOpPhysics(), rsm, new NoOpResolver());

            driver.Update();

            Assert.AreEqual(SimulationState.Racing, machine.State, "no finish signal — stays Racing");
        }

        // =================================================================================
        // AC-4.8dnf: fuel empty DNF resolution
        // =================================================================================

        [Test]
        public void AC48dnf_PlayerDNFResolvesWithDNFClassifiedSnapshot()
        {
            var machine = new SimulationStateMachine();
            var rsm = new SequenceRsm(new FinishDetected(ResultKind.Race, ResultClassification.DNF, 0f));
            var resolver = new RecordingResolver();
            var driver = RacingDriver(machine, new NoOpPhysics(), rsm, resolver);

            driver.Update();

            Assert.AreEqual(SimulationState.Finished, machine.State);
            Assert.AreEqual(1, resolver.Calls);
            Assert.AreEqual(ResultClassification.DNF, resolver.LastSnapshot.PlayerClassification,
                "resolver receives the DNF-classified locked snapshot");
            Assert.IsTrue(resolver.LastSnapshot.Rsm.ResolutionComplete);
        }

        // =================================================================================
        // AC-4.8a: Finished → Results without physics, resultKind published — gated on dismissal
        // =================================================================================

        [Test]
        public void AC48a_DismissalTransitionsFinishedToResultsWithoutPhysics()
        {
            var machine = FinishedMachine();
            // Physics spy attached to a REAL driver over the Finished machine — proves no
            // physics runs while Finished/Results (the machine alone cannot tick).
            var physics = new RecordingPhysics();
            var driver = CreateDriver(machine, new RecordingProcessor(), physics, SimulationDriver.FIXED_DT);
            driver.Update(); // Finished frame — no tick
            int physicsBefore = physics.Calls;
            Assert.AreEqual(0, physicsBefore, "no physics while Finished");

            machine.OnDismissTerminalPresentation();
            driver.Update(); // Results frame

            Assert.AreEqual(SimulationState.Results, machine.State);
            Assert.AreEqual(physicsBefore, physics.Calls, "no Physics.Simulate on dismissal or Results");
            Assert.IsFalse(machine.TerminalPresentationRequest, "terminal request cleared after dismissal");
        }

        [Test]
        public void AC48a_DismissalBeforeResolutionIgnored()
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            // No finish yet — dismissal from Countdown is ignored.
            machine.OnDismissTerminalPresentation();

            Assert.AreEqual(SimulationState.Countdown, machine.State, "dismissal ignored outside Finished");
        }

        // =================================================================================
        // AC-4.8b: Qualifying flying lap → immediate resolution, Confirm/timeout → Results
        // =================================================================================

        [Test]
        public void AC48b_QualifyingFlyingLapResolvesImmediately()
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Qualifying, GridAssignment.ForQualifying(1));
            machine.OnRaceLoadReady(RaceMode.Qualifying, GridAssignment.ForQualifying(1));
            // Qualifying goes straight to Racing (no countdown).
            Assert.AreEqual(SimulationState.Racing, machine.State);
            var rsm = new SequenceRsm(new FinishDetected(ResultKind.Qualifying, ResultClassification.Finished, 74.2f));
            var resolver = new RecordingResolver();
            var driver = CreateDriver(machine, new RecordingProcessor(), new NoOpPhysics(),
                SimulationDriver.FIXED_DT, rsm, resolver);

            driver.Update(); // flying lap completes

            Assert.AreEqual(SimulationState.Finished, machine.State);
            Assert.IsTrue(machine.ResolutionComplete, "resolutionComplete immediately true for qualifying");
            Assert.AreEqual(ResultKind.Qualifying, machine.ResultKind);
            Assert.IsTrue(machine.TerminalPresentationRequest, "terminal presentation begins");

            // Confirm (dismissal) transitions to Results — no unconditional immediate transition.
            machine.OnDismissTerminalPresentation();
            Assert.AreEqual(SimulationState.Results, machine.State);
        }

        [Test]
        public void AC48b_ConfirmBeforeLapResolutionDoesNotTransition()
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Qualifying, GridAssignment.ForQualifying(1));
            machine.OnRaceLoadReady(RaceMode.Qualifying, GridAssignment.ForQualifying(1));
            var rsm = new SequenceRsm(); // flying lap not yet complete
            var driver = CreateDriver(machine, new RecordingProcessor(), new NoOpPhysics(),
                SimulationDriver.FIXED_DT, rsm, new NoOpResolver());

            machine.OnDismissTerminalPresentation(); // premature dismissal
            Assert.AreEqual(SimulationState.Racing, machine.State, "no transition before resolution");
        }

        [Test]
        public void AC48b_FailedLapStillProducesResolvedQualifyingResult()
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Qualifying, GridAssignment.ForQualifying(1));
            machine.OnRaceLoadReady(RaceMode.Qualifying, GridAssignment.ForQualifying(1));
            // Failed lap = RSM reports DNF classification (RSM evidence; Kernel consumes).
            var rsm = new SequenceRsm(new FinishDetected(ResultKind.Qualifying, ResultClassification.DNF, 0f));
            var resolver = new RecordingResolver();
            var driver = CreateDriver(machine, new RecordingProcessor(), new NoOpPhysics(),
                SimulationDriver.FIXED_DT, rsm, resolver);

            driver.Update();

            Assert.AreEqual(SimulationState.Finished, machine.State);
            Assert.IsTrue(machine.ResolutionComplete);
            Assert.AreEqual(ResultClassification.DNF, resolver.LastSnapshot.PlayerClassification);
        }

        // =================================================================================
        // AC-4.8c: terminal presentation P/Start — Kernel state invariant
        // =================================================================================

        [Test]
        public void AC48c_TerminalPresentationPauseToggleKeepsFinished()
        {
            var machine = FinishedMachine();
            // Attached physics spy over a real driver — proves no tick while terminal active.
            var physics = new RecordingPhysics();
            var driver = CreateDriver(machine, new RecordingProcessor(), physics, SimulationDriver.FIXED_DT);

            // UI Presentation toggles its timer (mock); the Kernel must not transition.
            machine.TryTransition(SimulationState.Paused); // illegal from Finished — ignored
            driver.Update();
            Assert.AreEqual(SimulationState.Finished, machine.State, "P/Start toggles only UI timer");
            Assert.AreEqual(0, physics.Calls, "no physics tick while terminal active");
        }

        // =================================================================================
        // AC-4.8d: published snapshot has immutable RSM-originated copies
        // =================================================================================

        [Test]
        public void AC48d_PublishedSnapshotCarriesImmutableRsmCopies()
        {
            var machine = new SimulationStateMachine();
            var rsm = new SequenceRsm(new FinishDetected(ResultKind.Race, ResultClassification.Finished, 98.5f));
            var resolver = new FixedResolver();
            var driver = RacingDriver(machine, new NoOpPhysics(), rsm, resolver);
            var published = new List<PublishedSimulationSnapshot>();
            driver.SnapshotPublished += published.Add;

            driver.Update(); // finishing tick publishes Finished

            PublishedSimulationSnapshot snapshot = published.Last();
            Assert.IsTrue(snapshot.HasRsmTerminalData, "RSM terminal data present in Finished");
            Assert.AreEqual(ResultKind.Race, snapshot.ResultKind);
            Assert.IsTrue(snapshot.ResolutionComplete);
            Assert.AreEqual(98.5f, snapshot.PlayerFinishTime, 1e-6f);
            Assert.IsTrue(snapshot.TerminalPresentationRequest);
            Assert.IsNotNull(snapshot.ResolvedFinishOrder, "resolved order published");
            Assert.AreEqual(2, snapshot.ResolvedFinishOrder.EntriesByPosition.Count);
        }

        [Test]
        public void AC48d_MutatingRsmSourceAfterPublicationDoesNotAlterSnapshot()
        {
            var machine = new SimulationStateMachine();
            var rsm = new SequenceRsm(new FinishDetected(ResultKind.Race, ResultClassification.Finished, 98.5f));
            var resolver = new MutatingResolver(); // mutates its source array after building
            var driver = RacingDriver(machine, new NoOpPhysics(), rsm, resolver);
            var published = new List<PublishedSimulationSnapshot>();
            driver.SnapshotPublished += published.Add;

            driver.Update();
            PublishedSimulationSnapshot snapshot = published.Last();

            // The resolver mutated its own source list AFTER building the immutable order;
            // the published snapshot must still carry the frozen copies.
            IReadOnlyList<FinishOrderEntry> entries = snapshot.ResolvedFinishOrder.EntriesByPosition;
            Assert.AreEqual(2, entries.Count);
            Assert.AreEqual(ResultClassification.Finished, entries[0].Classification,
                "frozen copy survives source mutation");
            Assert.AreEqual(98.5f, snapshot.PlayerFinishTime, 1e-6f);

            // Consumer mutation: mutating the returned list must NOT reach the snapshot.
            if (entries is FinishOrderEntry[] consumerArray)
            {
                consumerArray[0] = new FinishOrderEntry(1, ResultClassification.Forfeit, -1, 0f);
                Assert.AreEqual(ResultClassification.Finished,
                    snapshot.ResolvedFinishOrder.EntriesByPosition[0].Classification,
                    "consumer mutation of the returned copy cannot reach the snapshot");
            }
        }

        // =================================================================================
        // AC-4.8e: Kernel resolver-interface constraint
        // =================================================================================

        [Test]
        public void AC48e_ResolverReceivesLockedSnapshotOnceNoPhysicsAfter()
        {
            var machine = new SimulationStateMachine();
            var rsm = new SequenceRsm(new FinishDetected(ResultKind.Race, ResultClassification.Finished, 98.5f));
            var resolver = new RecordingResolver();
            var physics = new RecordingPhysics();
            var driver = RacingDriver(machine, physics, rsm, resolver);
            int physicsBeforeFinishTick = physics.Calls; // 300 (the finishing tick itself runs physics once)

            driver.Update(); // finishing tick — physics runs once, then resolution happens

            Assert.AreEqual(physicsBeforeFinishTick + 1, physics.Calls,
                "the finishing tick runs physics exactly once (it is still a Racing tick)");
            Assert.AreEqual(1, resolver.Calls);
            Assert.AreEqual(SimulationState.Finished, machine.State);

            driver.Update(); // Finished frame — no physics after resolution
            Assert.AreEqual(physicsBeforeFinishTick + 1, physics.Calls,
                "no PhysX after resolution on subsequent frames");
        }

        // =================================================================================
        // AC-4.8f: PostFinishSnapshot once, TransitionRequest(Finished), current tick publishes
        // =================================================================================

        [Test]
        public void AC48f_FinishingTickPublishesFinishedWithCounters()
        {
            var machine = new SimulationStateMachine();
            var rsm = new SequenceRsm(new FinishDetected(ResultKind.Race, ResultClassification.Finished, 98.5f));
            var resolver = new RecordingResolver();
            var driver = RacingDriver(machine, new NoOpPhysics(), rsm, resolver);
            int stepBefore = driver.SimulationStepCount;
            var published = new List<PublishedSimulationSnapshot>();
            driver.SnapshotPublished += published.Add;

            driver.Update(); // finishing tick

            Assert.AreEqual(stepBefore + 1, driver.SimulationStepCount, "finishing tick increments counters once");
            PublishedSimulationSnapshot finish = published.Last();
            Assert.AreEqual(SimulationState.Finished, finish.Terminal.SimulationState);
            Assert.AreEqual(driver.SimulationStepCount, finish.Terminal.SimulationStepCount,
                "PostFinishSnapshot freezes the final counter (defect 3 fix)");

            driver.Update(); // subsequent Finished frame
            Assert.AreEqual(stepBefore + 1, driver.SimulationStepCount, "no counter growth after finish");
            Assert.AreEqual(1, resolver.Calls, "no re-capture or re-resolve");
        }

        // =================================================================================
        // AC-4.8g: DismissTerminalPresentation → Results without Simulate
        // =================================================================================

        [Test]
        public void AC48g_DismissalFromFinishedNoPhysicsNoRaceDataMutation()
        {
            var machine = FinishedMachine();
            ResolvedFinishOrder frozen = machine.ResolvedFinishOrder;

            machine.OnDismissTerminalPresentation();

            Assert.AreEqual(SimulationState.Results, machine.State);
            Assert.AreSame(frozen, machine.ResolvedFinishOrder,
                "resolved order stays frozen (not mutated by dismissal)");
        }

        [Test]
        public void AC48g_StaleDuplicateDismissalNoAdditionalTransition()
        {
            var machine = FinishedMachine();
            var transitions = new List<SimulationState>();
            machine.StateChanged += e => transitions.Add(e.Current);

            machine.OnDismissTerminalPresentation(); // first: Finished → Results
            machine.OnDismissTerminalPresentation(); // stale: ignored (already Results)

            Assert.AreEqual(SimulationState.Results, machine.State);
            Assert.AreEqual(1, transitions.Count(t => t == SimulationState.Results),
                "exactly one transition to Results");
        }

        // =================================================================================
        // AC-4.8h: Qualifying Results Start Race → Loading → Countdown after RaceLoadReady
        // =================================================================================

        [Test]
        public void AC48h_StartRaceFromResultsGoesLoadingThenCountdown()
        {
            var machine = FinishedMachine();
            machine.OnDismissTerminalPresentation();
            Assert.AreEqual(SimulationState.Results, machine.State);
            var requests = new List<ContentLoadRequest>();
            machine.ContentLoadRequested += requests.Add;

            bool started = machine.StartRaceFromResults(RaceGrid);
            Assert.IsTrue(started);
            Assert.AreEqual(SimulationState.Loading, machine.State);
            Assert.AreEqual(1, requests.Count, "one ContentLoadRequest");
            Assert.AreEqual(RaceMode.Race, requests[0].RaceMode, "qualifying→race loads a Race");

            // Countdown only after matching RaceLoadReady.
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            Assert.AreEqual(SimulationState.Countdown, machine.State);
        }

        [Test]
        public void AC48h_QualifyingResultsStartRaceLoadsRaceSession()
        {
            // Qualifying path (AC-4.8h): the machine reaches Finished with resultKind
            // Qualifying; Start Race from Qualifying Results must load a RACE session.
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Qualifying, GridAssignment.ForQualifying(1));
            machine.OnRaceLoadReady(RaceMode.Qualifying, GridAssignment.ForQualifying(1));
            Assert.AreEqual(SimulationState.Racing, machine.State);
            var rsm = new SequenceRsm(new FinishDetected(ResultKind.Qualifying, ResultClassification.Finished, 74.2f));
            var driver = CreateDriver(machine, new RecordingProcessor(), new NoOpPhysics(),
                SimulationDriver.FIXED_DT, rsm, new NoOpResolver());
            driver.Update(); // flying lap completes → Finished
            Assert.AreEqual(SimulationState.Finished, machine.State);
            machine.OnDismissTerminalPresentation();
            Assert.AreEqual(SimulationState.Results, machine.State);
            Assert.AreEqual(ResultKind.Qualifying, machine.ResultKind);

            var requests = new List<ContentLoadRequest>();
            machine.ContentLoadRequested += requests.Add;
            bool started = machine.StartRaceFromResults(RaceGrid);

            Assert.IsTrue(started);
            Assert.AreEqual(SimulationState.Loading, machine.State);
            Assert.AreEqual(1, requests.Count);
            Assert.AreEqual(RaceMode.Race, requests[0].RaceMode, "qualifying→race loads a Race session");
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            Assert.AreEqual(SimulationState.Countdown, machine.State);
        }

        [Test]
        public void AC48h_ReadinessBeforeLoadingOrWrongModeIgnored()
        {
            var machine = FinishedMachine();
            machine.OnDismissTerminalPresentation();
            Assert.AreEqual(SimulationState.Results, machine.State);

            // Readiness BEFORE Loading (while Results) is ignored.
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            Assert.AreEqual(SimulationState.Results, machine.State, "readiness before Loading ignored");

            machine.StartRaceFromResults(RaceGrid);
            Assert.AreEqual(SimulationState.Loading, machine.State);

            // Wrong-mode readiness ignored while Loading (guard: raceMode != _raceMode).
            machine.OnRaceLoadReady(RaceMode.Qualifying, GridAssignment.ForQualifying(1));
            Assert.AreEqual(SimulationState.Loading, machine.State);

            // Correct readiness works.
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            Assert.AreEqual(SimulationState.Countdown, machine.State);
        }

        // =================================================================================
        // AC-4.8i: Finished timer — Kernel state invariant
        // =================================================================================

        [Test]
        public void AC48i_NoDismissalLeavesFinishedUnchanged()
        {
            var machine = FinishedMachine();
            var physics = new RecordingPhysics();
            var driver = CreateDriver(machine, new RecordingProcessor(), physics, SimulationDriver.FIXED_DT);

            driver.Update(); // timer still has time — no dismissal

            Assert.AreEqual(SimulationState.Finished, machine.State, "Finished remains unchanged");
            Assert.AreEqual(0, physics.Calls, "no physics while terminal timer active");
        }

        [Test]
        public void AC48i_SingleDismissalTriggersExactlyOneTransition()
        {
            var machine = FinishedMachine();
            var transitions = new List<SimulationState>();
            machine.StateChanged += e => transitions.Add(e.Current);

            machine.OnDismissTerminalPresentation();
            machine.OnDismissTerminalPresentation(); // duplicate — idempotent

            Assert.AreEqual(1, transitions.Count(t => t == SimulationState.Results));
        }

        // =================================================================================
        // AC-4.8j: Step 13 skipped in Finished, stale AI cache cleared
        // =================================================================================

        [Test]
        public void AC48j_FinishedFrameClearsStaleAiCache()
        {
            // End-to-end AI-cache seam: a producer step (simulating the AI epic) writes
            // CachedAiInput during active ticks; AiSkipStep (index 12) must clear it when
            // the published state is Finished, and the pipeline must never produce AI after
            // the result resolves.
            var machine = new SimulationStateMachine();
            var rsm = new SequenceRsm(new FinishDetected(ResultKind.Race, ResultClassification.Finished, 98.5f));
            var aiLog = new List<int>();
            var producer = new AiProducerStep(machine, aiLog);
            var driver = CreateDriverWithAiProducer(machine, new RecordingProcessor(), new NoOpPhysics(),
                SimulationDriver.FIXED_DT, rsm, new NoOpResolver(), producer);

            // Setup: run to Racing (300 countdown ticks produce cache while active).
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            for (int i = 0; i < 300; i++) driver.Update();
            Assert.AreEqual(SimulationState.Racing, machine.State);
            Assert.IsTrue(aiLog.Count > 0, "AI produced cache during Countdown/Racing active ticks");

            int aiProducedDuringRacing = aiLog.Count(v => v == 1);
            driver.Update(); // finishing tick (tick 301) — state becomes Finished

            Assert.AreEqual(SimulationState.Finished, machine.State);
            int aiProducedAfterFinish = aiLog.Count(v => v == 1) - aiProducedDuringRacing;
            Assert.AreEqual(0, aiProducedAfterFinish,
                "no AI evaluation after result resolution (AC-4.8j)");

            // A Finished frame: no tick, no AI work, cache cleared.
            driver.Update();
            Assert.AreEqual(SimulationState.Finished, machine.State);
            Assert.AreEqual(0, aiLog.Count(v => v == 1) - aiProducedDuringRacing,
                "Finished frames produce no AI");
        }

        [Test]
        public void AC48e_NoPipelineStepExecutesAfterFinish()
        {
            // Gap QL-TEST-COVERAGE (AC-4.8e): the Fuel/Tire/Pit/collision/tactical-AI seams
            // are other-epic steps not mounted in the Kernel MVP — but the Kernel CAN prove
            // that NO pipeline step of any kind executes after the result resolves.
            var machine = new SimulationStateMachine();
            var rsm = new SequenceRsm(new FinishDetected(ResultKind.Race, ResultClassification.Finished, 98.5f));
            var stepLog = new List<int>();
            var driver = CreateDriverWithStepLog(machine, new RecordingProcessor(), new NoOpPhysics(),
                SimulationDriver.FIXED_DT, rsm, new NoOpResolver(), stepLog);
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            for (int i = 0; i < 300; i++) driver.Update();
            Assert.AreEqual(SimulationState.Racing, machine.State);
            int stepsAfterSetup = stepLog.Count;

            driver.Update(); // finishing tick
            Assert.AreEqual(SimulationState.Finished, machine.State);
            // The spine has 8 real steps (indices 3,6,7,8,9,10,11,12) and 6 LoggingSteps
            // (indices 0,1,2,4,5,13). A full tick logs exactly the 6 LoggingSteps — proving
            // the whole 14-step spine ran once.
            int stepsOnFinishFrame = stepLog.Count - stepsAfterSetup;
            Assert.AreEqual(6, stepsOnFinishFrame,
                "the finishing tick runs the full 14-step spine exactly once (6 of 14 steps are logging spies)");
            int stepCountAfterFinish = driver.SimulationStepCount;

            // Finished frames: CanTick=false, so the driver executes NO tick — no pipeline
            // step of ANY kind (spied or real) runs after the result resolves. The counter
            // and the spy log together prove the absence.
            driver.Update();
            driver.Update();
            Assert.AreEqual(stepCountAfterFinish, driver.SimulationStepCount,
                "no simulation tick on Finished frames — no Fuel/Tire/Pit/AI step executes");
            Assert.AreEqual(0, stepLog.Count - stepsAfterSetup - stepsOnFinishFrame,
                "no pipeline step of any kind executes after resolution");
        }

        [Test]
        public void AC48j_AiSkipStepClearsCacheInNonTickingStates()
        {
            // Countdown (active): the AI epic owns the cache — Kernel leaves it alone.
            var countdown = new SimulationStateMachine();
            countdown.StartSingleRace(RaceMode.Race, RaceGrid);
            countdown.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            Assert.AreEqual(SimulationState.Countdown, countdown.State);
            var step = new AiSkipStep(countdown);
            var context = new SimulationTickContext { CachedAiInput = new[] { new AIInput(1, 0.5f) } };
            step.Execute(context);
            Assert.AreEqual(1, context.CachedAiInput.Count, "Countdown keeps the AI-owned cache");

            // Finished (non-ticking): the Kernel clears stale cached input (AC-4.8j).
            var finished = FinishedMachine();
            var finishedStep = new AiSkipStep(finished);
            var finishedContext = new SimulationTickContext { CachedAiInput = new[] { new AIInput(1, 0.5f) } };
            finishedStep.Execute(finishedContext);
            Assert.AreEqual(0, finishedContext.CachedAiInput.Count, "stale AI cache cleared in Finished");
        }

        // =================================================================================
        // AC-4.10: Results Next Race → Loading
        // =================================================================================

        [Test]
        public void AC410_NextRaceTransitionsToLoadingOnce()
        {
            var machine = FinishedMachine();
            machine.OnDismissTerminalPresentation();
            var requests = new List<ContentLoadRequest>();
            machine.ContentLoadRequested += requests.Add;

            bool started = machine.StartRaceFromResults(RaceGrid);
            Assert.IsTrue(started);
            Assert.AreEqual(SimulationState.Loading, machine.State);
            Assert.AreEqual(1, requests.Count, "request issued once");

            // No simulation tick before a valid RaceLoadReady (CanTick false in Loading).
            var physics = new RecordingPhysics();
            var driver = CreateDriver(machine, new RecordingProcessor(), physics, SimulationDriver.FIXED_DT);
            driver.Update();
            Assert.AreEqual(0, physics.Calls, "no tick before RaceLoadReady");
        }

        // =================================================================================
        // AC-4.10a: Results Continue/Back → ContentUnloadRequest, remains Results, no tick
        // =================================================================================

        [Test]
        public void AC410a_ContinueBackSendsUnloadAndStaysResults()
        {
            var machine = FinishedMachine();
            machine.OnDismissTerminalPresentation();
            var unloads = new List<ContentUnloadRequest>();
            machine.ContentUnloadRequested += unloads.Add;

            bool sent = machine.RequestUnload();
            Assert.IsTrue(sent);
            Assert.AreEqual(SimulationState.Results, machine.State, "remains Results while unloading");
            Assert.AreEqual(1, unloads.Count);

            // Repeated Continue/Back does not duplicate the request.
            bool sentAgain = machine.RequestUnload();
            Assert.AreEqual(1, unloads.Count, "repeated unload request not duplicated");
            Assert.IsTrue(sentAgain);
        }

        [Test]
        public void AC410a_UnloadInProgressExecutesNoSimulationTick()
        {
            var machine = FinishedMachine();
            machine.OnDismissTerminalPresentation();
            machine.RequestUnload();
            var physics = new RecordingPhysics();
            var driver = CreateDriver(machine, new RecordingProcessor(), physics, SimulationDriver.FIXED_DT);

            driver.Update(); // Results while unloading — CanTick false

            Assert.AreEqual(0, physics.Calls, "no simulation tick while unloading");
        }

        // =================================================================================
        // AC-4.10b: ContentUnloadComplete → Idle, no Kernel references retained
        // =================================================================================

        [Test]
        public void AC410b_UnloadCompletePublishesIdleWithNoReferences()
        {
            // Qualifying session: proves RaceMode is reset to Race (not Qualifying) on unload.
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Qualifying, GridAssignment.ForQualifying(1));
            machine.OnRaceLoadReady(RaceMode.Qualifying, GridAssignment.ForQualifying(1));
            Assert.AreEqual(RaceMode.Qualifying, machine.RaceMode);
            var rsm = new SequenceRsm(new FinishDetected(ResultKind.Qualifying, ResultClassification.Finished, 74.2f));
            var driver = CreateDriver(machine, new RecordingProcessor(), new NoOpPhysics(),
                SimulationDriver.FIXED_DT, rsm, new NoOpResolver());
            driver.Update(); // flying lap completes → Finished
            machine.OnDismissTerminalPresentation();
            machine.RequestUnload();

            machine.OnContentUnloadComplete();

            Assert.AreEqual(SimulationState.Idle, machine.State);
            Assert.IsNull(machine.GridAssignment, "no Kernel-owned grid reference retained");
            Assert.IsNull(machine.ResolvedFinishOrder, "no resolved order retained");
            Assert.IsFalse(machine.TerminalPresentationRequest);
            Assert.AreEqual(RaceMode.Race, machine.RaceMode, "RaceMode reset to default Race on unload");
        }

        [Test]
        public void AC410b_IncompleteUnloadLeavesResults()
        {
            var machine = FinishedMachine();
            machine.OnDismissTerminalPresentation();
            machine.RequestUnload();

            Assert.AreEqual(SimulationState.Results, machine.State, "incomplete unload stays Results");
        }

        [Test]
        public void AC410b_DuplicateUnloadCompleteHarmless()
        {
            var machine = FinishedMachine();
            machine.OnDismissTerminalPresentation();
            machine.RequestUnload();

            machine.OnContentUnloadComplete();
            machine.OnContentUnloadComplete(); // duplicate — ignored outside Results

            Assert.AreEqual(SimulationState.Idle, machine.State);
        }

        [Test]
        public void AC410b_UnloadClearsTerminalDataBeforeNextSession()
        {
            // Gap R2-3: terminal data must be cleared when a session unloads to Idle, so a
            // fresh session cannot inherit the previous race's frozen snapshot/order.
            var machine = FinishedMachine();
            Assert.IsNotNull(machine.TerminalSnapshot);
            machine.OnDismissTerminalPresentation();
            machine.RequestUnload();

            machine.OnContentUnloadComplete();

            Assert.AreEqual(SimulationState.Idle, machine.State);
            Assert.IsNull(machine.TerminalSnapshot, "terminal snapshot cleared on unload");
            Assert.IsNull(machine.ResolvedFinishOrder, "resolved order cleared on unload");
            Assert.IsFalse(machine.TerminalPresentationRequest);
        }

        [Test]
        public void AC410b_NormalResultsAndForfeitSnapshotsAreDistinct()
        {
            // Gap R2-2: a normal completion publishes HasRsmTerminalData=true, IsForfeit=false;
            // a forfeit publishes IsForfeit=true, HasRsmTerminalData=false — consumers must be
            // able to distinguish the two Results presentations.
            var normal = new SimulationStateMachine();
            var rsm = new SequenceRsm(new FinishDetected(ResultKind.Race, ResultClassification.Finished, 98.5f));
            var normalDriver = RacingDriver(normal, new NoOpPhysics(), rsm, new NoOpResolver());
            var normalPublished = new List<PublishedSimulationSnapshot>();
            normalDriver.SnapshotPublished += normalPublished.Add;
            normalDriver.Update(); // finish
            normal.OnDismissTerminalPresentation();
            PublishedSimulationSnapshot normalSnapshot = normalPublished.Last(f => f.HasRsmTerminalData);
            Assert.IsTrue(normalSnapshot.HasRsmTerminalData);
            Assert.IsFalse(normalSnapshot.IsForfeit);

            var forfeit = new SimulationStateMachine();
            forfeit.StartSingleRace(RaceMode.Race, RaceGrid);
            forfeit.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            forfeit.EnterPaused(SimulationState.Racing);
            var forfeitDriver = CreateDriver(forfeit, new RecordingProcessor(), new NoOpPhysics(),
                SimulationDriver.FIXED_DT);
            var forfeitPublished = new List<PublishedSimulationSnapshot>();
            forfeitDriver.SnapshotPublished += forfeitPublished.Add;
            forfeit.RequestForfeit(2, 30f);
            forfeitDriver.Update();
            PublishedSimulationSnapshot forfeitSnapshot = forfeitPublished.Last(f => f.IsForfeit);
            Assert.IsTrue(forfeitSnapshot.IsForfeit);
            Assert.IsFalse(forfeitSnapshot.HasRsmTerminalData);
            Assert.IsNull(forfeitSnapshot.ResolvedFinishOrder);
        }

        [Test]
        public void AC410b_ResultsToLoadingToIdleFullCycle()
        {
            // Gap R2-1: complete normal path Results → Loading (Next Race) → Countdown →
            // forfeit back to Results → unload → Idle.
            var machine = FinishedMachine();
            machine.OnDismissTerminalPresentation();
            Assert.AreEqual(SimulationState.Results, machine.State);

            bool started = machine.StartRaceFromResults(RaceGrid);
            Assert.IsTrue(started);
            Assert.AreEqual(SimulationState.Loading, machine.State);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            Assert.AreEqual(SimulationState.Countdown, machine.State);
            machine.EnterPaused(SimulationState.Countdown);
            machine.RequestForfeit(0, 0f);
            Assert.AreEqual(SimulationState.Results, machine.State);

            machine.RequestUnload();
            machine.OnContentUnloadComplete();
            Assert.AreEqual(SimulationState.Idle, machine.State);
        }

        [Test]
        public void AC410b_UnloadCompleteWithoutRequestIgnored()
        {
            // Regression for qa-tester round-3 finding: a stale Content completion (without
            // a matching RequestUnload) must not prematurely transition Results → Idle.
            var machine = FinishedMachine();
            machine.OnDismissTerminalPresentation();
            Assert.AreEqual(SimulationState.Results, machine.State);

            machine.OnContentUnloadComplete(); // stale — no RequestUnload was issued

            Assert.AreEqual(SimulationState.Results, machine.State,
                "unload completion without a request is ignored");
        }

        [Test]
        public void AC48h_StartRaceFromResultsClearsPriorTerminalState()
        {
            // Regression for qa-tester round-3 finding: starting a new race from Results must
            // not leak the previous session's terminal snapshot into the new session's snapshots
            // (the compat constructor derives SimulationState from Terminal).
            var machine = FinishedMachine();
            Assert.IsNotNull(machine.TerminalSnapshot);
            machine.OnDismissTerminalPresentation();

            machine.StartRaceFromResults(RaceGrid);

            Assert.AreEqual(SimulationState.Loading, machine.State);
            Assert.IsNull(machine.TerminalSnapshot, "terminal snapshot cleared for the new session");
            Assert.IsNull(machine.ResolvedFinishOrder);
            Assert.IsFalse(machine.TerminalPresentationRequest);
            Assert.IsFalse(machine.IsForfeit);
        }

        [Test]
        public void AC410a_UnloadRequestResetForSecondSession()
        {
            // Regression for unity-specialist round-1 finding: StartRaceFromResults must
            // reset _unloadRequested so a SECOND Results session can unload again.
            var machine = FinishedMachine();
            machine.OnDismissTerminalPresentation();
            var unloads = new List<ContentUnloadRequest>();
            machine.ContentUnloadRequested += unloads.Add;

            machine.RequestUnload(); // first session: 1 request
            Assert.AreEqual(1, unloads.Count);
            machine.OnContentUnloadComplete();
            Assert.AreEqual(SimulationState.Idle, machine.State);

            // Second session from Idle via a fresh race flow, ending in forfeit to Results.
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            machine.EnterPaused(SimulationState.Racing);
            machine.RequestForfeit(1, 5f);
            Assert.AreEqual(SimulationState.Results, machine.State);

            machine.RequestUnload(); // must emit again in the second session
            Assert.AreEqual(2, unloads.Count, "unload request emitted again in the second session");
        }

        // =================================================================================
        // AC-4.12: Paused (resumeState Countdown/Racing) + Return to Menu → Results forfeit
        // =================================================================================

        [Test]
        public void AC412_ForfeitFromPausedRacingTransitionsToResultsWithMetadata()
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            machine.EnterPaused(SimulationState.Racing);
            Assert.AreEqual(SimulationState.Paused, machine.State);
            var aborted = new List<RaceAborted>();
            machine.RaceAborted += aborted.Add;
            // A resolver IS mounted — the forfeit must never invoke it (ADR-0018).
            var resolver = new RecordingResolver();
            var driver = CreateDriver(machine, new RecordingProcessor(), new NoOpPhysics(),
                SimulationDriver.FIXED_DT, null, resolver);

            bool forfeited = machine.RequestForfeit(forfeitLapCount: 5, raceTimeAtForfeit: 78.4f);

            Assert.IsTrue(forfeited);
            Assert.AreEqual(SimulationState.Results, machine.State, "direct to Results, no resumed tick");
            Assert.IsTrue(machine.IsForfeit);
            Assert.AreEqual(5, machine.ForfeitLapCount);
            Assert.AreEqual(78.4f, machine.RaceTimeAtForfeit, 1e-6f);
            Assert.IsNull(machine.ResolvedFinishOrder, "no finish order created on forfeit");
            Assert.AreEqual(1, aborted.Count, "RaceAborted(Forfeit) emitted once");
            Assert.AreEqual(ResultClassification.Forfeit, aborted[0].Classification);
            driver.Update(); // Results frame — no tick, no resolution
            Assert.AreEqual(0, resolver.Calls, "FinishOrderResolver never invoked on forfeit");
        }

        [Test]
        public void AC412_ForfeitSnapshotPublishedWithNoTerminal()
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            machine.EnterPaused(SimulationState.Racing);
            var driver = CreateDriver(machine, new RecordingProcessor(), new NoOpPhysics(), SimulationDriver.FIXED_DT);
            var published = new List<PublishedSimulationSnapshot>();
            driver.SnapshotPublished += published.Add;

            // The forfeit transition happens outside the driver (player acts while Paused);
            // the driver's state-based detection publishes the forfeit snapshot on the next
            // frame and must publish it exactly ONCE per forfeit entry.
            machine.RequestForfeit(3, 45.0f);
            driver.Update(); // frame 1 — publishes the forfeit snapshot
            driver.Update(); // frame 2 — must NOT publish a duplicate

            Assert.AreEqual(1, published.Count(f => f.IsForfeit),
                "forfeit snapshot published exactly once (mutation: _forfeitSnapshotPublished guard)");
            PublishedSimulationSnapshot forfeit = published.Last(f => f.IsForfeit);
            Assert.IsTrue(forfeit.IsForfeit);
            Assert.IsFalse(forfeit.HasTerminal, "forfeit snapshot carries no terminal state");
            Assert.AreEqual(3, forfeit.ForfeitLapCount);
            Assert.AreEqual(45.0f, forfeit.RaceTimeAtForfeit, 1e-6f);
            Assert.IsNull(forfeit.ResolvedFinishOrder);
        }

        [Test]
        public void AC412_CountdownForfeitZeroLapZeroTime()
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            machine.EnterPaused(SimulationState.Countdown);

            bool forfeited = machine.RequestForfeit(0, 0.0f);

            Assert.IsTrue(forfeited);
            Assert.AreEqual(SimulationState.Results, machine.State);
            Assert.AreEqual(0, machine.ForfeitLapCount);
            Assert.AreEqual(0f, machine.RaceTimeAtForfeit, 1e-6f);
        }

        [Test]
        public void AC412_ForfeitWithoutValidResumeStateIgnored()
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            machine.EnterPaused(SimulationState.Racing);
            machine.RequestResume(); // clears resumeState, back to Racing
            machine.EnterPaused(SimulationState.Racing);
            machine.RequestResume(); // back to Racing — not Paused
            Assert.AreEqual(SimulationState.Racing, machine.State);

            // Paused → Results forfeit requires Paused; from Racing it is ignored.
            bool forfeited = machine.RequestForfeit(1, 10f);
            Assert.IsFalse(forfeited, "forfeit only valid from Paused");
        }

        [Test]
        public void AC412_ForfeitFromPausedWithNullResumeStateIgnored()
        {
            // Gap QL-TEST-COVERAGE: a Paused state with NO recorded resumeState (entered via
            // the permissive gate path) must reject the forfeit — it cannot know whether the
            // session was in Countdown or Racing.
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, RaceGrid);
            machine.OnRaceLoadReady(RaceMode.Race, RaceGrid);
            // Enter Paused via the permissive gate — records no resumeState.
            machine.TryTransition(SimulationState.Paused);
            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.IsNull(machine.ResumeState);

            bool forfeited = machine.RequestForfeit(0, 0f);

            Assert.IsFalse(forfeited, "forfeit requires a valid Countdown/Racing resumeState");
            Assert.AreEqual(SimulationState.Paused, machine.State, "state unchanged on rejected forfeit");
        }

        // =================================================================================
        // AC-7.1c: Finished Presentation focus loss — Kernel state invariant
        // =================================================================================

        [Test]
        public void AC71c_FocusLossDuringFinishedKeepsFinishedNoAutoDismiss()
        {
            var machine = FinishedMachine();
            // Forced hook: calls EnterPaused on the FIRST frame regardless of state — proves
            // the machine itself rejects a pause entry from Finished (focus loss during the
            // terminal presentation cannot transition the Kernel).
            var focus = new ForcedFocusHook(machine);
            var physics = new RecordingPhysics();
            var driver = CreateDriver(machine, new RecordingProcessor(), physics, 1f, null, null, focus);

            driver.Update(); // focus lost while Finished

            Assert.AreEqual(SimulationState.Finished, machine.State, "focus loss does not transition Finished");
            Assert.AreEqual(0, physics.Calls, "no physics resume on focus return");
        }

        [Test]
        public void AC71c_UnfocusedIntervalCannotTransitionKernelState()
        {
            var machine = FinishedMachine();
            var focus = new ForcedFocusHook(machine);
            var driver = CreateDriver(machine, new RecordingProcessor(), new NoOpPhysics(), 1f, null, null, focus);

            driver.Update(); // focus lost
            driver.Update(); // 30s later (focus returns)
            driver.Update();

            Assert.AreEqual(SimulationState.Finished, machine.State, "unfocused interval cannot transition");
            Assert.IsTrue(machine.TerminalPresentationRequest, "no auto-dismiss without UI signal");
        }

        // =================================================================================
        // Test doubles
        // =================================================================================

        private sealed class NoOpStep : ISimulationPipelineStep
        {
            public void Execute(SimulationTickContext context) { }
        }

        /// <summary>Logs its spine index on every execution — proves which steps run per frame.</summary>
        private sealed class LoggingStep : ISimulationPipelineStep
        {
            private readonly int _index;
            private readonly List<int> _log;

            public LoggingStep(int index, List<int> log)
            {
                _index = index;
                _log = log;
            }

            public void Execute(SimulationTickContext context) => _log.Add(_index);
        }

        /// <summary>
        /// Simulates the AI epic's Step 13 producer: writes a cache entry during active
        /// (Countdown/Racing) ticks and logs a 1 per active execution, 0 otherwise. The
        /// Kernel's AiSkipStep (index 12) clears the cache; when the state is Finished the
        /// producer must never run (no tick executes), so no AI is produced after resolution.
        /// </summary>
        private sealed class AiProducerStep : ISimulationPipelineStep
        {
            private readonly SimulationStateMachine _machine;
            private readonly List<int> _log;

            public AiProducerStep(SimulationStateMachine machine, List<int> log)
            {
                _machine = machine;
                _log = log;
            }

            public void Execute(SimulationTickContext context)
            {
                bool active = _machine.State == SimulationState.Countdown ||
                              _machine.State == SimulationState.Racing;
                _log.Add(active ? 1 : 0);
                if (active)
                    context.CachedAiInput = new[] { new AIInput(1, 0.5f) };
            }
        }

        /// <summary>Writes the post-physics readout arrays so RsmConsumeStep can freeze them (defect 2 fix).</summary>
        private sealed class ReadoutStep : ISimulationPipelineStep
        {
            public const int SpineIndex = 8;

            public void Execute(SimulationTickContext context)
            {
                context.PostTickCarState = new[] { new CarState(1, 1000f) };
                context.PostTickFuelState = new[] { new FuelState(0.5f) };
                context.PostTickTireState = new[] { new TireState(0.9f) };
            }
        }

        private sealed class PublishStep : ISimulationPipelineStep
        {
            public void Execute(SimulationTickContext context)
            {
                PostFinishSnapshot terminal = context.TerminalSnapshot;
                if (terminal == null)
                {
                    terminal = new PostFinishSnapshot(
                        new[] { new CarState(1) }, new[] { new FuelState(1) }, new[] { new TireState(0) },
                        new RsmState(), SimulationState.Racing);
                }
                context.PublishSnapshot(new PublishedSimulationSnapshot(terminal));
            }
        }

        private sealed class RecordingProcessor : ISimulationInputProcessor
        {
            public int Calls { get; private set; }

            public SimulationInput Process(RawInputSample sample, bool pausePending)
            {
                Calls++;
                return new SimulationInput(0f, 0f, 0f, 0f, 0f, 0f, false, InputAvailability.Available);
            }
        }

        private sealed class NoOpPhysics : IPhysicsSimulator
        {
            public void Simulate(float fixedDeltaTime) { }
        }

        private sealed class RecordingPhysics : IPhysicsSimulator
        {
            public int Calls { get; private set; }
            public void Simulate(float fixedDeltaTime) => Calls++;
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

        /// <summary>Returns one finish per configured sequence slot, then none.</summary>
        private sealed class SequenceRsm : IRaceSessionManagerEvaluate
        {
            private readonly FinishDetected[] _finishes;
            private int _index;

            public SequenceRsm(params FinishDetected[] finishes) => _finishes = finishes;

            public FinishDetected? Evaluate(IReadOnlyList<CarState> carStates)
            {
                if (_index < _finishes.Length)
                    return _finishes[_index++];
                return null;
            }
        }

        private sealed class NoFinishRsm : IRaceSessionManagerEvaluate
        {
            public FinishDetected? Evaluate(IReadOnlyList<CarState> carStates) => null;
        }

        private sealed class RecordingResolver : IFinishOrderResolver
        {
            public int Calls { get; private set; }
            public PostFinishSnapshot LastSnapshot { get; private set; }

            public ResolvedFinishOrder Resolve(PostFinishSnapshot snapshot)
            {
                Calls++;
                LastSnapshot = snapshot;
                return new ResolvedFinishOrder(new[]
                {
                    new FinishOrderEntry(1, ResultClassification.Finished, 1, snapshot.Rsm.PlayerFinishTime),
                    new FinishOrderEntry(2, ResultClassification.Finished, 2, 99.1f)
                });
            }
        }

        private sealed class FixedResolver : IFinishOrderResolver
        {
            public ResolvedFinishOrder Resolve(PostFinishSnapshot snapshot)
            {
                return new ResolvedFinishOrder(new[]
                {
                    new FinishOrderEntry(1, ResultClassification.Finished, 1, snapshot.Rsm.PlayerFinishTime),
                    new FinishOrderEntry(2, ResultClassification.DNF, -1, 0f)
                });
            }
        }

        /// <summary>Builds an order, then MUTATES its own source list — the published copy must stay frozen.</summary>
        private sealed class MutatingResolver : IFinishOrderResolver
        {
            private readonly List<FinishOrderEntry> _source = new List<FinishOrderEntry>
            {
                new FinishOrderEntry(1, ResultClassification.Finished, 1, 98.5f),
                new FinishOrderEntry(2, ResultClassification.Finished, 2, 99.1f)
            };

            public ResolvedFinishOrder Resolve(PostFinishSnapshot snapshot)
            {
                var order = new ResolvedFinishOrder(_source);
                _source[0] = new FinishOrderEntry(1, ResultClassification.DNF, -1, 0f);
                _source[1] = new FinishOrderEntry(2, ResultClassification.Forfeit, -1, 0f);
                return order;
            }
        }

        private sealed class NoOpResolver : IFinishOrderResolver
        {
            public ResolvedFinishOrder Resolve(PostFinishSnapshot snapshot)
            {
                return new ResolvedFinishOrder(new[]
                {
                    new FinishOrderEntry(1, snapshot.PlayerClassification, 1, snapshot.Rsm.PlayerFinishTime)
                });
            }
        }

        /// <summary>
        /// Calls EnterPaused unconditionally on the first BeforeAccumulator invocation — forces
        /// the machine's own state guard to be the protection (proves a pause entry from
        /// Finished/Results is rejected, AC-7.1c focus-loss retention).
        /// </summary>
        private sealed class ForcedFocusHook : IPreAccumulatorLifecycleHook
        {
            private readonly SimulationStateMachine _machine;
            private bool _fired;

            public ForcedFocusHook(SimulationStateMachine machine) => _machine = machine;

            public void BeforeAccumulator(SimulationState state)
            {
                if (_fired)
                    return;
                _fired = true;
                _machine.EnterPaused(state);
            }
        }
    }
}
