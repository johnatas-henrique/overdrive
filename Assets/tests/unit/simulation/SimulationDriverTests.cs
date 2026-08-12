using System;
using System.Collections.Generic;
using NUnit.Framework;
using Overdrive.Input;
using Overdrive.Simulation;

namespace Overdrive.Simulation.Tests
{
    /// <summary>
    /// Deterministic evidence for Story 002's manual accumulator, capture seam,
    /// physics boundary, counters, and pause behavior (engine-free driver logic).
    /// </summary>
    [TestFixture]
    public sealed class SimulationDriverTests
    {
        private static RawInputSample Sample(ulong sequence = 1, float accelerate = 0.75f)
        {
            return new RawInputSample(
                sequence,
                ControlScheme.KeyboardMouse,
                accelerate,
                0.11f,
                -0.22f,
                InputAvailability.Available,
                RawInputValidityFlags.None);
        }

        private static PostFinishSnapshot Terminal(SimulationState state)
        {
            return new PostFinishSnapshot(
                new[] { new CarState(3, 13.5f) },
                new[] { new FuelState(4.25f) },
                new[] { new TireState(0.35f) },
                new RsmState(9),
                state);
        }

        private static SimulationDriver CreateDriver(
            SimulationState initialState,
            IFrameDeltaSource deltaSource,
            IFrameInputCapture inputCapture,
            IPhysicsSimulator physics,
            ISimulationInputProcessor processor = null,
            IPreAccumulatorLifecycleHook hook = null,
            Action<SimulationTickContext> publish = null,
            Func<bool> pauseEdgeSource = null,
            Action pauseEdgeConsumer = null,
            TestStateGate gate = null)
        {
            gate = gate ?? new TestStateGate(initialState);
            processor = processor ?? new TickProcessor();
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
            {
                // Canonical physics boundary: GDD step 7 (array index 6).
                steps[i] = i == PhysicsSimulateStep.SpineIndex
                    ? new PhysicsSimulateStep(physics)
                    : new CallbackStep(i == 11 ? publish : null);
            }

            var kernel = new SimulationKernel(processor, steps);
            return new SimulationDriver(
                kernel,
                gate,
                inputCapture,
                deltaSource,
                hook,
                pauseEdgeSource,
                pauseEdgeConsumer);
        }

        [Test]
        public void AC11_SixHundredStepsInTenSeconds()
        {
            var clock = new SequenceDeltaSource(1f / 120f);
            var capture = new RecordingCapture(Sample());
            var physics = new RecordingPhysicsSimulator();
            SimulationDriver driver = CreateDriver(SimulationState.Racing, clock, capture, physics);

            for (int frame = 0; frame < 1200; frame++)
                driver.Update();

            Assert.AreEqual(600, physics.Calls);
            Assert.AreEqual(600, driver.SimulationStepCount);
            Assert.Less(driver.Accumulator, SimulationDriver.FIXED_DT);

            // A zero-duration frame cannot manufacture a final tick.
            clock.NextDelta = 0f;
            driver.Update();
            Assert.AreEqual(600, physics.Calls);
        }

        [Test]
        public void AC12_ThirtyFpsTwoTicksWithoutDiscard()
        {
            var clock = new SequenceDeltaSource(2f / 60f);
            var physics = new RecordingPhysicsSimulator();
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                new RecordingCapture(Sample()),
                physics);

            for (int frame = 0; frame < 300; frame++)
                driver.Update();

            Assert.AreEqual(600, physics.Calls);
            Assert.AreEqual(0d, driver.AccumulatorSeconds, 1e-6d);
        }

        [Test]
        public void AC13_EighteenMillisecondFrameLeavesOnePointThreeThreeMilliseconds()
        {
            var clock = new SequenceDeltaSource(0.018f);
            var physics = new RecordingPhysicsSimulator();
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                new RecordingCapture(Sample()),
                physics);

            driver.Update();

            Assert.AreEqual(1, physics.Calls);
            Assert.AreEqual(0.018f - SimulationDriver.FIXED_DT, driver.Accumulator, 1e-6f);
            Assert.GreaterOrEqual(driver.Accumulator, 0f);
            Assert.Less(driver.Accumulator, SimulationDriver.FIXED_DT);

            clock.NextDelta = SimulationDriver.FIXED_DT;
            driver.Update();
            Assert.AreEqual(2, physics.Calls);
            Assert.AreEqual(0.018f - SimulationDriver.FIXED_DT, driver.Accumulator, 1e-6f);
        }

        [Test]
        public void AC14_PhysicsSimulateReceivesOneFixedDeltaPerStep()
        {
            var clock = new SequenceDeltaSource(SimulationDriver.FIXED_DT);
            var physics = new RecordingPhysicsSimulator();
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                new RecordingCapture(Sample()),
                physics);

            driver.Update();
            driver.Update();
            driver.Update();

            Assert.AreEqual(3, physics.Calls);
            for (int i = 0; i < physics.Durations.Count; i++)
                Assert.AreEqual(SimulationDriver.FIXED_DT, physics.Durations[i], 1e-7f);
        }

        [Test]
        public void AC15_AccumulatorClampLimitsFrameToTwoSteps()
        {
            var clock = new SequenceDeltaSource(2f * SimulationDriver.FIXED_DT + 0.001f);
            var physics = new RecordingPhysicsSimulator();
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                new RecordingCapture(Sample()),
                physics);

            driver.Update();

            Assert.AreEqual(2, physics.Calls);
            // The excess above 2 × FIXED_DT is permanently discarded (TR-sim-010): the clamp
            // cuts the frame to exactly 2 × FIXED_DT, which divides into two full ticks with a
            // zero remainder. If the clamp were missing, 0.001 would remain — this assert is
            // mutation-sensitive to the clamp itself.
            Assert.AreEqual(0d, driver.AccumulatorSeconds, 1e-12d);
            Assert.Less(driver.Accumulator, SimulationDriver.FIXED_DT);
        }

        [Test]
        public void AC15b_ExactDoubleFixedDeltaRunsTwoStepsWithZeroRemainder()
        {
            // Exact 2 × FIXED_DT boundary: two steps, zero remainder — never three.
            var clock = new SequenceDeltaSource(2f * SimulationDriver.FIXED_DT);
            var physics = new RecordingPhysicsSimulator();
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                new RecordingCapture(Sample()),
                physics);

            driver.Update();

            Assert.AreEqual(2, physics.Calls);
            Assert.AreEqual(0d, driver.AccumulatorSeconds, 1e-12d);
        }

        [Test]
        public void AC16_ExcessClampTimeIsPermanentlyDiscarded()
        {
            var clock = new SequenceDeltaSource(1f);
            var physics = new RecordingPhysicsSimulator();
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                new RecordingCapture(Sample()),
                physics);

            driver.Update();
            Assert.AreEqual(2, physics.Calls);

            clock.NextDelta = SimulationDriver.FIXED_DT;
            driver.Update();
            Assert.AreEqual(3, physics.Calls);

            // A zero frame after the normal frame cannot replay the discarded 1-second backlog.
            clock.NextDelta = 0f;
            driver.Update();
            Assert.AreEqual(3, physics.Calls);
        }

        [Test]
        public void AC18_RacingSnapshotTimeMatchesActiveRaceStepCount()
        {
            var snapshots = new List<PublishedSimulationSnapshot>();
            var physics = new RecordingPhysicsSimulator();
            SimulationState gateState = SimulationState.Racing;
            TestStateGate gate = new TestStateGate(gateState);
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                new SequenceDeltaSource(SimulationDriver.FIXED_DT),
                new RecordingCapture(Sample()),
                physics,
                publish: context => context.PublishSnapshot(new PublishedSimulationSnapshot(Terminal(SimulationState.Racing))),
                gate: gate);
            driver.SnapshotPublished += snapshots.Add;

            for (int tick = 0; tick < 6; tick++)
                driver.Update();

            Assert.AreEqual(6, snapshots.Count);
            for (int i = 0; i < snapshots.Count; i++)
            {
                Assert.AreEqual(i + 1, snapshots[i].ActiveRaceStepCount);
                Assert.AreEqual((i + 1) * SimulationDriver.FIXED_DT, snapshots[i].SimTime, 1e-6f);
                Assert.AreEqual(i + 1, snapshots[i].SimulationStepCount);
            }

            // A Racing tick that transitions to Finished still counts as a Racing-started tick.
            var finishPhysics = new RecordingPhysicsSimulator();
            var finishSnapshots = new List<PublishedSimulationSnapshot>();
            TestStateGate finishGate = new TestStateGate(SimulationState.Racing);
            SimulationDriver finishingDriver = CreateDriver(
                SimulationState.Racing,
                new SequenceDeltaSource(SimulationDriver.FIXED_DT),
                new RecordingCapture(Sample()),
                finishPhysics,
                publish: context =>
                {
                    finishGate.TryTransition(SimulationState.Finished);
                    context.PublishSnapshot(new PublishedSimulationSnapshot(Terminal(SimulationState.Finished)));
                },
                gate: finishGate);
            finishingDriver.SnapshotPublished += finishSnapshots.Add;
            finishingDriver.Update();
            Assert.AreEqual(1, finishingDriver.ActiveRaceStepCount);
            Assert.AreEqual(SimulationDriver.FIXED_DT, finishSnapshots[0].SimTime, 1e-6f);
        }

        [Test]
        public void AC19_CountdownSnapshotsKeepRaceTimeAtZero()
        {
            var snapshots = new List<PublishedSimulationSnapshot>();
            TestStateGate gate = new TestStateGate(SimulationState.Countdown);
            SimulationDriver driver = CreateDriver(
                SimulationState.Countdown,
                new SequenceDeltaSource(SimulationDriver.FIXED_DT),
                new RecordingCapture(Sample()),
                new RecordingPhysicsSimulator(),
                publish: context => context.PublishSnapshot(new PublishedSimulationSnapshot(Terminal(SimulationState.Countdown))),
                gate: gate);
            driver.SnapshotPublished += snapshots.Add;

            for (int tick = 0; tick < 300; tick++)
                driver.Update();

            Assert.AreEqual(300, snapshots.Count);
            Assert.AreEqual(300, driver.SimulationStepCount);
            Assert.AreEqual(0, driver.ActiveRaceStepCount);
            Assert.AreEqual(0f, driver.SimTime, 1e-6f);
            // Every countdown snapshot (not just selected indices) keeps race time at zero,
            // increments simulationStepCount per tick, and never advances activeRaceStepCount.
            for (int i = 0; i < snapshots.Count; i++)
            {
                Assert.AreEqual(0f, snapshots[i].SimTime, 1e-6f, "snapshot {0} sim_time", i);
                Assert.AreEqual(0, snapshots[i].ActiveRaceStepCount, "snapshot {0} activeRaceStepCount", i);
                Assert.AreEqual(i + 1, snapshots[i].SimulationStepCount, "snapshot {0} simulationStepCount", i);
            }
        }

        [Test]
        public void AC31a_CaptureOccursOnceBeforeClockAndTickProcessing()
        {
            var order = new List<string>();
            var capture = new RecordingCapture(Sample(), order);
            var clock = new SequenceDeltaSource(2f * SimulationDriver.FIXED_DT, order);
            var processor = new RecordingInputProcessor(order);
            var physics = new RecordingPhysicsSimulator(order);
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                capture,
                physics,
                processor: processor);

            driver.Update();

            Assert.AreEqual(1, capture.Calls);
            Assert.AreEqual(2, physics.Calls);
            CollectionAssert.AreEqual(new[] { "capture", "delta", "process", "physics", "process", "physics" }, order);

            // A frame with no tick still captures exactly once.
            order.Clear();
            clock.NextDelta = 0f;
            driver.Update();
            Assert.AreEqual(2, capture.Calls);
            CollectionAssert.AreEqual(new[] { "capture", "delta" }, order);
        }

        [Test]
        public void AC31a_CaptureObservesAccumulatorUnchanged()
        {
            // Seed a sub-tick remainder with a partial frame, then verify the capture callback
            // on the next frame sees the accumulator BEFORE it is mutated (a moved capture
            // point would observe the remainder already advanced by the frame delta).
            var clock = new SequenceDeltaSource(0.5f * SimulationDriver.FIXED_DT);
            var physics = new RecordingPhysicsSimulator();
            double accumulatorAtCapture = -1d;
            var capture = new AccumulatorReadingCapture(
                Sample(),
                driver => accumulatorAtCapture = driver.AccumulatorSeconds);
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                capture,
                physics);
            capture.Driver = driver;

            // Frame 1: partial → seeds 0.5×FIXED_DT remainder, no tick.
            driver.Update();
            Assert.AreEqual(0.5f * SimulationDriver.FIXED_DT, driver.Accumulator, 1e-9f);
            Assert.AreEqual(0d, accumulatorAtCapture, 1e-12d);

            // Frame 2: full FIXED_DT → one tick. At capture time the remainder must still be
            // the seeded 0.5×FIXED_DT, not yet advanced by the frame delta.
            clock.NextDelta = SimulationDriver.FIXED_DT;
            accumulatorAtCapture = -1d;
            driver.Update();
            Assert.AreEqual(1, physics.Calls);
            Assert.AreEqual(0.5f * SimulationDriver.FIXED_DT, accumulatorAtCapture, 1e-9f);
        }

        [Test]
        public void AC72_MultiTickFrameReusesSampleAndAdvancesEmaPerTick()
        {
            var processor = new RecordingInputProcessor();
            var capture = new RecordingCapture(new RawInputSample(
                77,
                ControlScheme.KeyboardMouse,
                1f,
                0f,
                0f,
                InputAvailability.Available,
                RawInputValidityFlags.None));
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                new SequenceDeltaSource(2f * SimulationDriver.FIXED_DT),
                capture,
                new RecordingPhysicsSimulator(),
                processor: processor);

            driver.Update();

            Assert.AreEqual(2, processor.Inputs.Count);
            Assert.AreEqual(77UL, processor.Samples[0].CaptureSequence);
            Assert.AreEqual(77UL, processor.Samples[1].CaptureSequence);
            Assert.AreEqual(0.3f, processor.Inputs[0].AccelerateOut, 1e-6f);
            Assert.AreEqual(0.51f, processor.Inputs[1].AccelerateOut, 1e-6f);
            Assert.AreEqual(1, capture.Calls);
        }

        [Test]
        public void AC74_PausePreservesRemainderAndResumeNeverCatchesUp()
        {
            var clock = new SequenceDeltaSource(0.25f * SimulationDriver.FIXED_DT);
            var physics = new RecordingPhysicsSimulator();
            TestStateGate gate = new TestStateGate(SimulationState.Racing);
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                new RecordingCapture(Sample()),
                physics,
                gate: gate);

            driver.Update();
            double remainder = driver.AccumulatorSeconds;
            gate.TryTransition(SimulationState.Paused);
            clock.NextDelta = 30f;
            for (int frame = 0; frame < 30; frame++)
                driver.Update();

            Assert.AreEqual(0, physics.Calls);
            Assert.AreEqual(remainder, driver.AccumulatorSeconds, 1e-12d);

            gate.TryTransition(SimulationState.Racing);
            clock.NextDelta = 0f;
            driver.Update();
            Assert.AreEqual(0, physics.Calls);
            Assert.AreEqual(remainder, driver.AccumulatorSeconds, 1e-12d);

            clock.NextDelta = SimulationDriver.FIXED_DT;
            driver.Update();
            Assert.AreEqual(1, physics.Calls);
            Assert.AreEqual(remainder, driver.AccumulatorSeconds, 1e-6d);

            // Focus boundary hook: the boundary frame adds no delta and does not consume remainder.
            var focusGate = new TestStateGate(SimulationState.Racing);
            var focusClock = new SequenceDeltaSource(1f);
            var focusPhysics = new RecordingPhysicsSimulator();
            var focusHook = new TransitionHook(focusGate, SimulationState.Paused);
            SimulationDriver focusDriver = CreateDriver(
                SimulationState.Racing,
                focusClock,
                new RecordingCapture(Sample()),
                focusPhysics,
                hook: focusHook,
                gate: focusGate);
            focusDriver.Update();
            Assert.AreEqual(0, focusPhysics.Calls);
            Assert.AreEqual(0d, focusDriver.AccumulatorSeconds, 1e-12d);

            // Focus return does NOT auto-resume: a normal frame while still Paused adds no
            // elapsed time and no ticks, even without any further transition request.
            focusClock.NextDelta = SimulationDriver.FIXED_DT;
            focusDriver.Update();
            Assert.AreEqual(0, focusPhysics.Calls);
            Assert.AreEqual(0d, focusDriver.AccumulatorSeconds, 1e-12d);
        }

        [Test]
        public void AC75_TwoHundredMillisecondSpikeHasNoLaterCatchUp()
        {
            var clock = new SequenceDeltaSource(0.200f);
            var physics = new RecordingPhysicsSimulator();
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                new RecordingCapture(Sample()),
                physics);

            driver.Update();
            Assert.AreEqual(2, physics.Calls);

            clock.NextDelta = SimulationDriver.FIXED_DT;
            driver.Update();
            Assert.AreEqual(3, physics.Calls);

            clock.NextDelta = 0f;
            driver.Update();
            Assert.AreEqual(3, physics.Calls);
        }

        [Test]
        public void AC16b_RepeatedSpikesDiscardIndependently()
        {
            // QA edge AC-1.6: repeated long frames each discard their own excess independently;
            // no backlog accumulates across spikes (TR-sim-010 permanent discard).
            var clock = new SequenceDeltaSource(1f);
            var physics = new RecordingPhysicsSimulator();
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                new RecordingCapture(Sample()),
                physics);

            driver.Update();
            Assert.AreEqual(2, physics.Calls);

            // Second spike: still exactly two steps, zero carry-over from the first.
            driver.Update();
            Assert.AreEqual(4, physics.Calls);
            Assert.AreEqual(0d, driver.AccumulatorSeconds, 1e-12d);

            // A third consecutive spike behaves identically — no backlog ever accumulates.
            driver.Update();
            Assert.AreEqual(6, physics.Calls);
            Assert.AreEqual(0d, driver.AccumulatorSeconds, 1e-12d);
        }

        [Test]
        public void AC72b_NewerSampleEligibleOnlyOnNextUpdate()
        {
            // QA edge AC-7.2: a sample captured by a later frame is NOT used by ticks of the
            // current frame; only the next driver Update sees it. The multi-tick frame must
            // reuse the frame's own single sample.
            var processor = new RecordingInputProcessor();
            var capture = new RecordingCapture(new RawInputSample(
                77,
                ControlScheme.KeyboardMouse,
                1f,
                0f,
                0f,
                InputAvailability.Available,
                RawInputValidityFlags.None));
            var clock = new SequenceDeltaSource(2f * SimulationDriver.FIXED_DT);
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                capture,
                new RecordingPhysicsSimulator(),
                processor: processor);

            driver.Update();
            Assert.AreEqual(2, processor.Samples.Count);
            Assert.AreEqual(77UL, processor.Samples[0].CaptureSequence);
            Assert.AreEqual(77UL, processor.Samples[1].CaptureSequence);

            // The next frame brings a NEW sample; it becomes eligible only now.
            capture.Sample = new RawInputSample(
                78,
                ControlScheme.KeyboardMouse,
                1f,
                0f,
                0f,
                InputAvailability.Available,
                RawInputValidityFlags.None);
            clock.NextDelta = SimulationDriver.FIXED_DT;
            driver.Update();

            Assert.AreEqual(3, processor.Samples.Count);
            Assert.AreEqual(78UL, processor.Samples[2].CaptureSequence);
        }

        [Test]
        public void AC18b_FirstRacingSnapshotPublishesZeroActiveRaceSteps()
        {
            // QA edge AC-1.8 N=0: the GO tick starts in Countdown, flips the gate to Racing
            // mid-tick (via the publish callback), and publishes the first Racing snapshot with
            // activeRaceStepCount = 0 and sim_time = 0 (story Implementation Notes: "The GO
            // tick publishes the first Racing snapshot with activeRaceStepCount = 0").
            var snapshots = new List<PublishedSimulationSnapshot>();
            var physics = new RecordingPhysicsSimulator();
            var gate = new TestStateGate(SimulationState.Countdown);
            SimulationDriver driver = CreateDriver(
                SimulationState.Countdown,
                new SequenceDeltaSource(SimulationDriver.FIXED_DT),
                new RecordingCapture(Sample()),
                physics,
                publish: context =>
                {
                    gate.TryTransition(SimulationState.Racing);
                    context.PublishSnapshot(new PublishedSimulationSnapshot(Terminal(SimulationState.Racing)));
                },
                gate: gate);
            driver.SnapshotPublished += snapshots.Add;

            // GO tick: starts Countdown, publishes after gate flips → N=0.
            driver.Update();
            Assert.AreEqual(1, snapshots.Count);
            Assert.AreEqual(0, snapshots[0].ActiveRaceStepCount);
            Assert.AreEqual(0f, snapshots[0].SimTime, 1e-6f);
            Assert.AreEqual(1, snapshots[0].SimulationStepCount);

            // Next tick now starts in Racing → activeRaceStepCount = 1, race time advances.
            driver.Update();
            Assert.AreEqual(2, snapshots.Count);
            Assert.AreEqual(1, snapshots[1].ActiveRaceStepCount);
            Assert.AreEqual(SimulationDriver.FIXED_DT, snapshots[1].SimTime, 1e-6f);
        }

        [Test]
        public void ResumeWithZeroRemainderExecutesNoStep()
        {
            // Paused with no sub-tick remainder: resume must not fabricate a step.
            var clock = new SequenceDeltaSource(SimulationDriver.FIXED_DT);
            var physics = new RecordingPhysicsSimulator();
            var gate = new TestStateGate(SimulationState.Racing);
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                new RecordingCapture(Sample()),
                physics,
                gate: gate);

            driver.Update();
            Assert.AreEqual(1, physics.Calls);
            Assert.AreEqual(0d, driver.AccumulatorSeconds, 1e-12d);

            gate.TryTransition(SimulationState.Paused);
            driver.Update();
            gate.TryTransition(SimulationState.Racing);
            clock.NextDelta = 0f;
            driver.Update();

            // Resume with zero remainder and zero delta executes no step, no catch-up.
            Assert.AreEqual(1, physics.Calls);
            Assert.AreEqual(0d, driver.AccumulatorSeconds, 1e-12d);
        }

        [Test]
        public void PhysicsExecutesBetweenForceApplicationAndGridRelease()
        {
            // GDD simulation-architecture.md step 7 = array index 6. The physics boundary
            // must execute between step 6 (force application) and step 8 (GO/grid release).
            // A shared execution log records force/physics/grid in one order so the test is
            // mutation-sensitive: moving physics to index 0 or 13 breaks the sequence.
            var order = new List<string>();
            var physics = new RecordingPhysicsSimulator(order);
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
            {
                int index = i;
                if (index == PhysicsSimulateStep.SpineIndex)
                    steps[i] = new PhysicsSimulateStep(physics);
                else if (index == 5)
                    steps[i] = new CallbackStep(_ => order.Add("force"));
                else if (index == 7)
                    steps[i] = new CallbackStep(_ => order.Add("grid"));
                else
                    steps[i] = new CallbackStep(null);
            }

            var kernel = new SimulationKernel(new TickProcessor(), steps);
            var driver = new SimulationDriver(
                kernel,
                new TestStateGate(SimulationState.Racing),
                new RecordingCapture(Sample()),
                new SequenceDeltaSource(SimulationDriver.FIXED_DT));

            driver.Update();

            Assert.AreEqual(PhysicsSimulateStep.SpineIndex, 6);
            Assert.AreEqual(1, physics.Calls);
            // Shared order: force application (step 6) → physics (step 7) → grid release (step 8).
            CollectionAssert.AreEqual(new[] { "force", "physics", "grid" }, order);
        }

        [Test]
        public void InvalidClockValuesDoNotAdvanceTime()
        {
            // Negative, NaN, and +Infinity frame deltas must not move authoritative time
            // forward (the driver guards with !float.IsFinite(frameDelta) || frameDelta <= 0f).
            var clock = new SequenceDeltaSource(-1f);
            var physics = new RecordingPhysicsSimulator();
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                new RecordingCapture(Sample()),
                physics);

            driver.Update();
            Assert.AreEqual(0, physics.Calls);
            Assert.AreEqual(0d, driver.AccumulatorSeconds, 1e-12d);

            clock.NextDelta = float.NaN;
            driver.Update();
            Assert.AreEqual(0, physics.Calls);
            Assert.AreEqual(0d, driver.AccumulatorSeconds, 1e-12d);

            // Positive infinity is also non-finite and must not move time forward.
            clock.NextDelta = float.PositiveInfinity;
            driver.Update();
            Assert.AreEqual(0, physics.Calls);
            Assert.AreEqual(0d, driver.AccumulatorSeconds, 1e-12d);
        }

        [Test]
        public void MidFrameStateTransitionStopsTickLoopWithoutCatchUp()
        {
            // A transition to Paused/Finished during the first tick of a multi-tick frame
            // must stop the loop; the remainder is not consumed by further ticks.
            var clock = new SequenceDeltaSource(2f * SimulationDriver.FIXED_DT);
            var physics = new RecordingPhysicsSimulator();
            var gate = new TestStateGate(SimulationState.Racing);
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                new RecordingCapture(Sample()),
                physics,
                publish: _ => gate.TryTransition(SimulationState.Paused),
                gate: gate);

            driver.Update();

            // First tick runs, second is prevented by CanTick=false.
            Assert.AreEqual(1, physics.Calls);
            Assert.AreEqual(1, driver.SimulationStepCount);
        }

        [Test]
        public void PauseEdgeDeliveredExactlyOncePerFrame()
        {
            int edgePolls = 0;
            int edgeDeliveries = 0;
            var clock = new SequenceDeltaSource(2f * SimulationDriver.FIXED_DT);
            var physics = new RecordingPhysicsSimulator();
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                new RecordingCapture(Sample()),
                physics,
                // Returns true on EVERY poll: if the driver polls the edge for each tick of
                // the multi-tick frame, edgeDeliveries would exceed one and the test fails.
                pauseEdgeSource: () => { edgePolls++; return true; },
                pauseEdgeConsumer: () => edgeDeliveries++);

            driver.Update();

            // The edge is delivered to exactly one tick (the first) in a multi-tick frame,
            // even though the source reports true on every subsequent poll.
            Assert.AreEqual(1, edgeDeliveries);
            Assert.AreEqual(2, physics.Calls);
        }

        [Test]
        public void NullSnapshotDoesNotPublish()
        {
            // When the pipeline never publishes a Step 12 snapshot, the driver must not raise
            // SnapshotPublished nor fabricate a terminal snapshot.
            var published = 0;
            var clock = new SequenceDeltaSource(SimulationDriver.FIXED_DT);
            var physics = new RecordingPhysicsSimulator();
            SimulationDriver driver = CreateDriver(
                SimulationState.Racing,
                clock,
                new RecordingCapture(Sample()),
                physics);
            driver.SnapshotPublished += _ => published++;

            driver.Update();

            Assert.AreEqual(1, physics.Calls);
            Assert.AreEqual(0, published);
        }

        private sealed class CallbackStep : ISimulationPipelineStep
        {
            private readonly Action<SimulationTickContext> _callback;

            public CallbackStep(Action<SimulationTickContext> callback)
            {
                _callback = callback;
            }

            public void Execute(SimulationTickContext context)
            {
                _callback?.Invoke(context);
            }
        }

        private sealed class SequenceDeltaSource : IFrameDeltaSource
        {
            private readonly List<string> _order;

            public float NextDelta { get; set; }

            public SequenceDeltaSource(float nextDelta, List<string> order = null)
            {
                NextDelta = nextDelta;
                _order = order;
            }

            public float GetUnscaledDeltaTime()
            {
                _order?.Add("delta");
                return NextDelta;
            }
        }

        private sealed class RecordingCapture : IFrameInputCapture
        {
            private readonly List<string> _order;

            public int Calls { get; private set; }

            /// <summary>The sample returned by CaptureLatest; settable so tests can simulate
            /// a newer sample arriving on a subsequent frame.</summary>
            public RawInputSample Sample { get; set; }

            public RecordingCapture(RawInputSample sample, List<string> order = null)
            {
                Sample = sample;
                _order = order;
            }

            public RawInputSample CaptureLatest()
            {
                Calls++;
                _order?.Add("capture");
                return Sample;
            }
        }

        private sealed class AccumulatorReadingCapture : IFrameInputCapture
        {
            private readonly RawInputSample _sample;
            private readonly Action<SimulationDriver> _onCapture;

            /// <summary>Set by the test after driver construction, before the first Update.</summary>
            public SimulationDriver Driver { get; set; }

            public AccumulatorReadingCapture(RawInputSample sample, Action<SimulationDriver> onCapture)
            {
                _sample = sample;
                _onCapture = onCapture;
            }

            public RawInputSample CaptureLatest()
            {
                // Reads the driver's accumulator at capture time so the test can assert the
                // capture seam observes the remainder BEFORE the frame delta mutates it.
                _onCapture(Driver);
                return _sample;
            }
        }

        private sealed class RecordingPhysicsSimulator : IPhysicsSimulator
        {
            public int Calls { get; private set; }
            public readonly List<float> Durations = new List<float>();
            private readonly List<string> _order;

            public RecordingPhysicsSimulator(List<string> order = null)
            {
                _order = order;
            }

            public void Simulate(float fixedDeltaTime)
            {
                Calls++;
                Durations.Add(fixedDeltaTime);
                _order?.Add("physics");
            }
        }

        private sealed class RecordingInputProcessor : ISimulationInputProcessor
        {
            private readonly TickProcessor _processor = new TickProcessor();
            private readonly List<string> _order;

            public readonly List<RawInputSample> Samples = new List<RawInputSample>();
            public readonly List<SimulationInput> Inputs = new List<SimulationInput>();

            public RecordingInputProcessor(List<string> order = null)
            {
                _order = order;
            }

            public SimulationInput Process(RawInputSample sample, bool pausePending)
            {
                _order?.Add("process");
                Samples.Add(sample);
                SimulationInput input = _processor.Process(sample, pausePending);
                Inputs.Add(input);
                return input;
            }
        }

        private sealed class TransitionHook : IPreAccumulatorLifecycleHook
        {
            private readonly TestStateGate _gate;
            private readonly SimulationState _target;

            public TransitionHook(TestStateGate gate, SimulationState target)
            {
                _gate = gate;
                _target = target;
            }

            public void BeforeAccumulator(SimulationState state)
            {
                _gate.TryTransition(_target);
            }
        }

        /// <summary>
        /// Faithful test stub of <see cref="ISimulationStateGate"/> (story-001: "driver tests
        /// use a faithful stub"). Permits unrestricted transitions so the driver can be tested
        /// from any synthetic state (Racing/Countdown/Paused) without walking the real legal
        /// transition graph — the permissive bypass lives in the TEST, never in production
        /// (SimulationStateMachine enforces legal transitions only).
        /// </summary>
        private sealed class TestStateGate : ISimulationStateGate
        {
            private SimulationState _state;

            public TestStateGate(SimulationState initialState)
            {
                _state = initialState;
            }

            public SimulationState State => _state;

            public bool CanTick => _state == SimulationState.Countdown || _state == SimulationState.Racing;

            public SimulationState? ResumeState => null;

            public bool IsForfeit => false;

            public int ForfeitLapCount => 0;

            public float RaceTimeAtForfeit => 0f;

            public bool TryTransition(SimulationState state)
            {
                _state = state;
                return true;
            }
        }
    }
}
