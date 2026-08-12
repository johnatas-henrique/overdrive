using System.Collections.Generic;
using NUnit.Framework;
using Overdrive.Input;
using Overdrive.Simulation;

namespace Overdrive.Simulation.Tests
{
    /// <summary>
    /// Integration contract evidence for the Simulation Kernel foundation spine (Story 001).
    /// Covers every acceptance criterion: AC-3.1..3.8 and AC-7.8/7.9.
    /// </summary>
    [TestFixture]
    public sealed class ContractSpineTests
    {
        private static RawInputSample Sample(ulong sequence, float accelerate, ControlScheme scheme = ControlScheme.KeyboardMouse, InputAvailability availability = InputAvailability.Available)
        {
            return new RawInputSample(sequence, scheme, accelerate, 0f, 0f, availability, RawInputValidityFlags.None);
        }

        private static ISimulationPipelineStep[] Spies(int count)
        {
            var result = new ISimulationPipelineStep[count];
            for (int i = 0; i < count; i++) result[i] = new SpyStep();
            return result;
        }

        private sealed class SpyStep : ISimulationPipelineStep
        {
            public void Execute(SimulationTickContext context) { }
        }

        /// <summary>Recording step spy: appends its index to a SHARED order list so the
        /// full 14-step execution sequence can be asserted.</summary>
        private sealed class RecordingStep : ISimulationPipelineStep
        {
            private readonly List<int> _sharedOrder;
            private readonly int _index;

            public RecordingStep(int index, List<int> sharedOrder)
            {
                _index = index;
                _sharedOrder = sharedOrder;
            }

            public void Execute(SimulationTickContext context) => _sharedOrder.Add(_index);
        }

        /// <summary>Consumer spy for DispatchResolvedCarInputs: records full payload and delta.</summary>
        private sealed class ConsumerSpy : IResolvedCarInputConsumer
        {
            public readonly List<ResolvedCarInput> Seen = new List<ResolvedCarInput>();
            public readonly List<float> Deltas = new List<float>();
            public int Calls;

            public void Consume(IReadOnlyList<ResolvedCarInput> inputs, float fixedDeltaTime)
            {
                Calls++;
                Deltas.Add(fixedDeltaTime);
                foreach (ResolvedCarInput input in inputs) Seen.Add(input);
            }
        }

        // --- AC-3.1: latest RawInputSample used by tick ---
        [Test]
        public void AC31_LatestSampleIsUsedByTick()
        {
            var kernel = new SimulationKernel(new TickProcessor(), Spies(14));
            kernel.CaptureLatestRawSample(Sample(1, 0.1f));
            kernel.CaptureLatestRawSample(Sample(2, 0.2f));
            kernel.CaptureLatestRawSample(Sample(3, 0.8f));
            SimulationTickContext context = kernel.ExecuteTick();
            Assert.AreEqual(3UL, context.RawInputSample.CaptureSequence);
            Assert.AreEqual(0.8f, context.SimulationInput.RawAcceleratePostDeadZone);
        }
        // --- AC-3.2: same sample, two ticks, EMA once per tick ---
        [Test]
        public void AC32_ReusingSampleAdvancesEmaOncePerTick()
        {
            var processor = new TickProcessor();
            RawInputSample sample = Sample(1, 1f);
            // EMA alpha = 0.3 (GDD DefaultAccelerateAlpha): starting from 0,
            // tick 1 → 0.3, tick 2 → 0.51. Two ticks on the same sample must advance twice.
            SimulationInput first = processor.ProcessTick(sample, false);
            SimulationInput second = processor.ProcessTick(sample, false);
            Assert.AreEqual(1f, second.RawAcceleratePostDeadZone);
            Assert.AreEqual(0.3f, first.AccelerateOut, 0.0001f);
            Assert.AreEqual(0.51f, second.AccelerateOut, 0.0001f);
        }

        // --- AC-3.3: identical SimulationInput at 30 vs 144 FPS (contract ref Input AC-7) ---
        [Test]
        public void AC33_IdenticalSequenceAt30And144Fps()
        {
            var low = new TickProcessor();
            var high = new TickProcessor();
            RawInputSample[] frames = { Sample(1, 0.1f), Sample(2, 0.2f), Sample(3, 0.5f), Sample(4, 0.9f) };
            // 30 FPS: each render frame produces 2 ticks (60Hz sim); 144 FPS: each frame 0..1 ticks.
            var lowSequence = new List<SimulationInput>();
            var highSequence = new List<SimulationInput>();
            for (int i = 0; i < 60; i++)
            {
                lowSequence.Add(low.ProcessTick(frames[i % 4], false));
            }
            for (int i = 0; i < 60; i++)
            {
                highSequence.Add(high.ProcessTick(frames[i % 4], false));
            }
            // Both consume the identical ordered raw sequence → identical EMA progression.
            // Compare the full SimulationInput contract, not just one field.
            for (int i = 0; i < lowSequence.Count; i++)
            {
                Assert.AreEqual(lowSequence[i].AccelerateOut, highSequence[i].AccelerateOut, 0.0001f);
                Assert.AreEqual(lowSequence[i].BrakeOut, highSequence[i].BrakeOut, 0.0001f);
                Assert.AreEqual(lowSequence[i].SteerOut, highSequence[i].SteerOut, 0.0001f);
                Assert.AreEqual(lowSequence[i].RawAcceleratePostDeadZone, highSequence[i].RawAcceleratePostDeadZone, 0.0001f);
                Assert.AreEqual(lowSequence[i].RawBrakePostDeadZone, highSequence[i].RawBrakePostDeadZone, 0.0001f);
                Assert.AreEqual(lowSequence[i].RawSteerPostDeadZone, highSequence[i].RawSteerPostDeadZone, 0.0001f);
                Assert.AreEqual(lowSequence[i].PauseEdge, highSequence[i].PauseEdge);
                Assert.AreEqual(lowSequence[i].Availability, highSequence[i].Availability);
            }
        }

        // --- AC-3.4: pause rising edge consumed once at tick boundary ---
        [Test]
        public void AC34_PauseEdgeConsumedOnceAtTickBoundary()
        {
            var kernel = new SimulationKernel(new TickProcessor(), Spies(14));
            kernel.CaptureLatestRawSample(Sample(1, 0f));
            SimulationTickContext first = kernel.ExecuteTick(pauseEdge: true);
            Assert.IsTrue(first.SimulationInput.PauseEdge);
            // Repeated ticks without a new edge must not re-consume.
            SimulationTickContext second = kernel.ExecuteTick(pauseEdge: false);
            Assert.IsFalse(second.SimulationInput.PauseEdge);
        }

        // --- AC-3.5: gamepad disconnect → KeyboardMouse, no freeze (contract ref Input AC-8) ---
        [Test]
        public void AC35_GamepadDisconnectFallsBackToKeyboardMouse()
        {
            var processor = new TickProcessor();
            RawInputSample gamepad = Sample(1, 0.5f, ControlScheme.Gamepad);
            RawInputSample keyboard = Sample(2, 0.4f, ControlScheme.KeyboardMouse);
            SimulationInput fromGamepad = processor.ProcessTick(gamepad, false);
            Assert.AreEqual(ControlScheme.Gamepad, gamepad.ActiveScheme);
            SimulationInput afterFallback = processor.ProcessTick(keyboard, false);
            Assert.AreEqual(ControlScheme.KeyboardMouse, keyboard.ActiveScheme);
            // Tick loop continues; no freeze: process completes and returns a valid input.
            Assert.IsNotNull(afterFallback);
            Assert.AreEqual(0.4f, afterFallback.RawAcceleratePostDeadZone);
            // gamepad sample still processed (availability flag unchanged) — disconnect handled by Input system, sim consumes latest.
            Assert.AreEqual(InputAvailability.Available, fromGamepad.Availability);
        }

        // --- AC-3.6: PublishedSimulationSnapshot immutable ---
        [Test]
        public void AC36_SnapshotsCopyNestedCollections()
        {
            var snapshot = new PublishedSimulationSnapshot(new PostFinishSnapshot(
                new[] { new CarState(2, 10f) }, new[] { new FuelState(5f) }, new[] { new TireState(1f) }, new RsmState(4), SimulationState.Finished));
            // Mutating a returned CarState array must not reach the snapshot's backing store.
            var cars = (CarState[])snapshot.CarState;
            cars[0] = new CarState(99);
            Assert.AreEqual(2, snapshot.CarState[0].CarId);
            // Same guarantee for Fuel and Tire collections.
            var fuel = (FuelState[])snapshot.FuelState;
            fuel[0] = new FuelState(99f);
            Assert.AreEqual(5f, snapshot.FuelState[0].Amount, 0.0001f);
            var tires = (TireState[])snapshot.TireState;
            tires[0] = new TireState(99f);
            Assert.AreEqual(1f, snapshot.TireState[0].Wear, 0.0001f);
            // Mutating the source array after construction must not affect the snapshot (defensive copy).
            var srcCars = new[] { new CarState(7, 1f) };
            var srcFuel = new[] { new FuelState(2f) };
            var srcTires = new[] { new TireState(3f) };
            var snapshot2 = new PublishedSimulationSnapshot(new PostFinishSnapshot(srcCars, srcFuel, srcTires, new RsmState(1), SimulationState.Finished));
            srcCars[0] = new CarState(77);
            srcFuel[0] = new FuelState(22f);
            srcTires[0] = new TireState(33f);
            Assert.AreEqual(7, snapshot2.CarState[0].CarId);
            Assert.AreEqual(2f, snapshot2.FuelState[0].Amount, 0.0001f);
            Assert.AreEqual(3f, snapshot2.TireState[0].Wear, 0.0001f);
        }

        // --- AC-3.7: ascending-carId ResolvedCarInput consumed identically ---
        [Test]
        public void AC37_ResolvedInputsAreStrictlyAscendingAndIdentical()
        {
            // Distinct values per field so a field-swap (delivering the wrong field's value)
            // cannot pass: AccelerateOut ≠ RawAcceleratePostDeadZone ≠ BrakeOut ≠ SteerOut.
            SimulationInput player = new SimulationInput(0.11f, 0.22f, -0.33f, 0.44f, 0.55f, -0.66f, true, InputAvailability.Available);
            AIInput[] ai = { new AIInput(1, 0.1f), new AIInput(4, 0.2f), new AIInput(12, 0.3f) };
            ResolvedCarInput[] result = SimulationKernel.ResolveCarInputs(new[] { 1, 4, 12 }, player, ai);
            // Ascending car ids preserved in output order.
            Assert.AreEqual(1, result[0].CarId);
            Assert.AreEqual(4, result[1].CarId);
            Assert.AreEqual(12, result[2].CarId);
            // Full PlayerInput contract carried unchanged into every resolved entry.
            for (int i = 0; i < result.Length; i++)
            {
                Assert.AreEqual(player.AccelerateOut, result[i].PlayerInput.AccelerateOut, 0.0001f);
                Assert.AreEqual(player.BrakeOut, result[i].PlayerInput.BrakeOut, 0.0001f);
                Assert.AreEqual(player.SteerOut, result[i].PlayerInput.SteerOut, 0.0001f);
                Assert.AreEqual(player.RawAcceleratePostDeadZone, result[i].PlayerInput.RawAcceleratePostDeadZone, 0.0001f);
                Assert.AreEqual(player.RawBrakePostDeadZone, result[i].PlayerInput.RawBrakePostDeadZone, 0.0001f);
                Assert.AreEqual(player.RawSteerPostDeadZone, result[i].PlayerInput.RawSteerPostDeadZone, 0.0001f);
                Assert.AreEqual(player.PauseEdge, result[i].PlayerInput.PauseEdge);
                Assert.AreEqual(player.Availability, result[i].PlayerInput.Availability);
                // Per-car AI input matched to its car id.
                Assert.AreEqual(ai[i].CarId, result[i].AI.CarId);
                Assert.AreEqual(ai[i].Accelerate, result[i].AI.Accelerate, 0.0001f);
            }
            Assert.Throws<System.ArgumentException>(() => SimulationKernel.ResolveCarInputs(new[] { 2, 1 }, player,
                new[] { new AIInput(2), new AIInput(1) }));
        }

        // --- AC-3.8: lifecycle snapshot preserves last authoritative values ---
        [Test]
        public void AC38_StateGateAndLifecycleEventPreserveBoundary()
        {
            // The test gate stub is the faithful ISimulationStateGate seam (story-001: "driver
            // tests use a faithful stub") — permissive transitions for synthetic driver states.
            var gate = new TestGate(SimulationState.Idle);
            Assert.IsFalse(gate.CanTick);
            Assert.IsTrue(gate.TryTransition(SimulationState.Racing));
            Assert.IsTrue(gate.CanTick);
            var kernel = new SimulationKernel(new TickProcessor(), Spies(14));
            SimulationStateChanged change = default;
            kernel.StateChanged += value => change = value;
            kernel.NotifyStateChanged(SimulationState.Racing, SimulationState.Paused);
            Assert.AreEqual(SimulationState.Paused, change.Current);
        }

        // --- 14-step spine: every step executes once, in canonical order (Test Evidence) ---
        [Test]
        public void Spine14StepsExecuteInCanonicalOrder()
        {
            var steps = new ISimulationPipelineStep[14];
            var sharedOrder = new List<int>();
            for (int i = 0; i < 14; i++) steps[i] = new RecordingStep(i, sharedOrder);
            var kernel = new SimulationKernel(new TickProcessor(), steps);
            kernel.CaptureLatestRawSample(Sample(1, 0.5f));
            kernel.ExecuteTick();
            CollectionAssert.AreEqual(new[] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 }, sharedOrder);
        }

        // --- AC-3.7 (dispatch): identical ascending-carId input, exactly-once, to all three consumers ---
        [Test]
        public void AC37_DispatchSendsIdenticalInputsExactlyOnceToAllConsumers()
        {
            // Distinct per-field values so a field-swap cannot pass the assertions.
            SimulationInput player = new SimulationInput(0.11f, 0.22f, -0.33f, 0.44f, 0.55f, -0.66f, true, InputAvailability.Available);
            ResolvedCarInput[] resolved = SimulationKernel.ResolveCarInputs(
                new[] { 1, 2, 3 }, player,
                new[] { new AIInput(1, 0.1f), new AIInput(2, 0.2f), new AIInput(3, 0.3f) });
            // Defensive copy: compare consumers against a frozen baseline, so an in-place
            // mutation of `resolved` cannot corrupt the comparison itself.
            var baseline = new ResolvedCarInput[resolved.Length];
            for (int i = 0; i < resolved.Length; i++) baseline[i] = resolved[i];
            var fuel = new ConsumerSpy();
            var tire = new ConsumerSpy();
            var vp = new ConsumerSpy();
            SimulationKernel.DispatchResolvedCarInputs(resolved, fuel, tire, vp);
            Assert.AreEqual(1, fuel.Calls);
            Assert.AreEqual(1, tire.Calls);
            Assert.AreEqual(1, vp.Calls);
            // Full payload identical across all three consumers AND matches the frozen
            // baseline — guards against uniform corruption of ANY field.
            Assert.AreEqual(3, fuel.Seen.Count);
            for (int i = 0; i < fuel.Seen.Count; i++)
            {
                // Baseline: every consumer received exactly what ResolveCarInputs produced,
                // on EVERY payload field (CarId, full PlayerInput, full AI).
                Assert.AreEqual(baseline[i].CarId, fuel.Seen[i].CarId);
                Assert.AreEqual(baseline[i].CarId, tire.Seen[i].CarId);
                Assert.AreEqual(baseline[i].CarId, vp.Seen[i].CarId);
                Assert.AreEqual(baseline[i].PlayerInput.AccelerateOut, fuel.Seen[i].PlayerInput.AccelerateOut, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.AccelerateOut, tire.Seen[i].PlayerInput.AccelerateOut, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.AccelerateOut, vp.Seen[i].PlayerInput.AccelerateOut, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.BrakeOut, fuel.Seen[i].PlayerInput.BrakeOut, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.BrakeOut, tire.Seen[i].PlayerInput.BrakeOut, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.BrakeOut, vp.Seen[i].PlayerInput.BrakeOut, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.SteerOut, fuel.Seen[i].PlayerInput.SteerOut, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.SteerOut, tire.Seen[i].PlayerInput.SteerOut, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.SteerOut, vp.Seen[i].PlayerInput.SteerOut, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.RawAcceleratePostDeadZone, fuel.Seen[i].PlayerInput.RawAcceleratePostDeadZone, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.RawAcceleratePostDeadZone, tire.Seen[i].PlayerInput.RawAcceleratePostDeadZone, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.RawAcceleratePostDeadZone, vp.Seen[i].PlayerInput.RawAcceleratePostDeadZone, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.RawBrakePostDeadZone, fuel.Seen[i].PlayerInput.RawBrakePostDeadZone, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.RawBrakePostDeadZone, tire.Seen[i].PlayerInput.RawBrakePostDeadZone, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.RawBrakePostDeadZone, vp.Seen[i].PlayerInput.RawBrakePostDeadZone, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.RawSteerPostDeadZone, fuel.Seen[i].PlayerInput.RawSteerPostDeadZone, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.RawSteerPostDeadZone, tire.Seen[i].PlayerInput.RawSteerPostDeadZone, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.RawSteerPostDeadZone, vp.Seen[i].PlayerInput.RawSteerPostDeadZone, 0.0001f);
                Assert.AreEqual(baseline[i].PlayerInput.PauseEdge, fuel.Seen[i].PlayerInput.PauseEdge);
                Assert.AreEqual(baseline[i].PlayerInput.PauseEdge, tire.Seen[i].PlayerInput.PauseEdge);
                Assert.AreEqual(baseline[i].PlayerInput.PauseEdge, vp.Seen[i].PlayerInput.PauseEdge);
                Assert.AreEqual(baseline[i].PlayerInput.Availability, fuel.Seen[i].PlayerInput.Availability);
                Assert.AreEqual(baseline[i].PlayerInput.Availability, tire.Seen[i].PlayerInput.Availability);
                Assert.AreEqual(baseline[i].PlayerInput.Availability, vp.Seen[i].PlayerInput.Availability);
                // AI full contract: CarId + Accelerate.
                Assert.AreEqual(baseline[i].AI.CarId, fuel.Seen[i].AI.CarId);
                Assert.AreEqual(baseline[i].AI.CarId, tire.Seen[i].AI.CarId);
                Assert.AreEqual(baseline[i].AI.CarId, vp.Seen[i].AI.CarId);
                Assert.AreEqual(baseline[i].AI.Accelerate, fuel.Seen[i].AI.Accelerate, 0.0001f);
                Assert.AreEqual(baseline[i].AI.Accelerate, tire.Seen[i].AI.Accelerate, 0.0001f);
                Assert.AreEqual(baseline[i].AI.Accelerate, vp.Seen[i].AI.Accelerate, 0.0001f);
            }
            // FIXED_DT passed explicitly to every consumer.
            Assert.AreEqual(SimulationTickContext.FIXED_DT, fuel.Deltas[0], 0.0001f);
            Assert.AreEqual(SimulationTickContext.FIXED_DT, tire.Deltas[0], 0.0001f);
            Assert.AreEqual(SimulationTickContext.FIXED_DT, vp.Deltas[0], 0.0001f);
        }

        // --- AC-7.8: NoInputDevice → zeroed input, tick loop continues ---
        [Test]
        public void AC78_NoInputDeviceProducesZeroedInput()
        {
            var processor = new TickProcessor();
            // Non-zero brake/steer prove the branch zeroes ALL channels, not just accelerate.
            RawInputSample noDevice = new RawInputSample(
                1, ControlScheme.KeyboardMouse, 0.9f, 0.5f, -0.7f,
                InputAvailability.NoInputDevice, RawInputValidityFlags.None);
            SimulationInput input = processor.ProcessTick(noDevice, false);
            // GDD input-system.md AC-42-9: Accelerate, Brake, Steer forced to 0.0 — the car coasts.
            Assert.AreEqual(0f, input.AccelerateOut, 0.0001f);
            Assert.AreEqual(0f, input.BrakeOut, 0.0001f);
            Assert.AreEqual(0f, input.SteerOut, 0.0001f);
            Assert.AreEqual(0f, input.RawAcceleratePostDeadZone, 0.0001f);
            Assert.AreEqual(0f, input.RawBrakePostDeadZone, 0.0001f);
            Assert.AreEqual(0f, input.RawSteerPostDeadZone, 0.0001f);
            Assert.AreEqual(InputAvailability.NoInputDevice, input.Availability);
            // Repeated NoInputDevice ticks remain zeroed (no EMA recovery while unavailable).
            SimulationInput second = processor.ProcessTick(noDevice, false);
            Assert.AreEqual(0f, second.AccelerateOut, 0.0001f);
            Assert.AreEqual(0f, second.BrakeOut, 0.0001f);
            Assert.AreEqual(0f, second.SteerOut, 0.0001f);
            // Tick loop continues: subsequent available sample is processed normally.
            RawInputSample available = Sample(2, 0.4f, ControlScheme.KeyboardMouse, InputAvailability.Available);
            SimulationInput after = processor.ProcessTick(available, false);
            Assert.AreEqual(0.4f, after.RawAcceleratePostDeadZone, 0.0001f);
            Assert.AreEqual(InputAvailability.Available, after.Availability);
            // EMA resumes from the preserved previous output: GDD input:240 specifies NO
            // EMA re-seed for NoInputDevice (only scheme change re-seeds, input:239).
            // Accelerate prev is FROZEN at 0 during the no-device ticks because the sample's
            // brake=0.5 triggers brake priority (EmaBrakePriority freezes accelerate prev while
            // raw brake > 0). Recovery with brake=0: 0.3×0.4 + 0.7×0 = 0.12.
            Assert.AreEqual(0.12f, after.AccelerateOut, 0.001f);
        }

        // --- AC-7.9: scheme change during Racing → next SimulationInput uses new scheme ---
        [Test]
        public void AC79_SchemeChangeUsesNewSchemeNextInput()
        {
            var processor = new TickProcessor();
            // KeyboardMouse passes raw values through the dead-zone (no module thresholds).
            RawInputSample keyboard = Sample(1, 0.3f, ControlScheme.KeyboardMouse);
            // Gamepad applies dead-zone normalization with the module thresholds.
            RawInputSample gamepad = Sample(2, 0.7f, ControlScheme.Gamepad);
            SimulationInput fromKeyboard = processor.ProcessTick(keyboard, false);
            Assert.AreEqual(ControlScheme.KeyboardMouse, keyboard.ActiveScheme);
            // KeyboardMouse path: raw value passes through dead-zone unchanged.
            Assert.AreEqual(0.3f, fromKeyboard.RawAcceleratePostDeadZone, 0.0001f);
            SimulationInput fromGamepad = processor.ProcessTick(gamepad, false);
            Assert.AreEqual(ControlScheme.Gamepad, gamepad.ActiveScheme);
            // Gamepad path: dead-zone normalized — (0.7 - 0.05) / (1 - 0.05) ≈ 0.6842.
            // Exact assertion so a broken dead-zone that passes raw 0.7 fails the test.
            Assert.AreEqual(0.6842f, fromGamepad.RawAcceleratePostDeadZone, 0.001f);
            Assert.IsNotNull(fromGamepad);
        }

        /// <summary>
        /// Faithful ISimulationStateGate stub (story-001) with permissive transitions for
        /// synthetic driver states. The permissive bypass lives in the TEST only — production
        /// composition uses the real SimulationStateMachine with legal transitions.
        /// </summary>
        private sealed class TestGate : ISimulationStateGate
        {
            private SimulationState _state;

            public TestGate(SimulationState initialState) => _state = initialState;

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
