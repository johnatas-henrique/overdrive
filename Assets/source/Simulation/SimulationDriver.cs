using System;
using Overdrive.Input;

namespace Overdrive.Simulation
{
    /// <summary>
    /// Supplies the render-frame clock used by the manual simulation accumulator.
    /// Production uses unscaled wall time; tests provide deterministic values.
    /// Example: <c>var driver = new SimulationDriver(kernel, gate, capture, clock, physics);</c>
    /// </summary>
    public interface IFrameDeltaSource
    {
        /// <summary>Returns the current render-frame duration in seconds.</summary>
        float GetUnscaledDeltaTime();
    }

    /// <summary>
    /// Captures the latest platform input once per render frame. The returned sample is
    /// reused by every simulation tick produced by that frame (ADR-0001).
    /// Example: <c>RawInputSample sample = capture.CaptureLatest();</c>
    /// </summary>
    public interface IFrameInputCapture
    {
        /// <summary>Captures exactly one immutable raw input sample.</summary>
        RawInputSample CaptureLatest();
    }

    /// <summary>
    /// The canonical whole-scene physics boundary step (GDD simulation-architecture.md
    /// step 7, array index 6). Composition injects this step at index 6 of the 14-step
    /// spine so the kernel itself stays agnostic of physics — the kernel only executes
    /// the steps in array order (ADR-0001: one Physics.Simulate(FIXED_DT) per active tick).
    /// </summary>
    public sealed class PhysicsSimulateStep : ISimulationPipelineStep
    {
        /// <summary>The canonical 0-based position of the physics boundary in the 14-step spine (GDD step 7).</summary>
        public const int SpineIndex = 6;

        private readonly IPhysicsSimulator _simulator;

        /// <summary>Creates a step that invokes the whole-scene physics boundary exactly once.</summary>
        public PhysicsSimulateStep(IPhysicsSimulator simulator)
        {
            _simulator = simulator ?? throw new ArgumentNullException(nameof(simulator));
        }

        /// <inheritdoc />
        public void Execute(SimulationTickContext context)
        {
            _simulator.Simulate(SimulationTickContext.FIXED_DT);
        }
    }

    /// <summary>
    /// Owns the manual fixed-step accumulator and drives the Story 001 kernel spine.
    /// This class deliberately has no Unity dependency: Unity-facing clock and physics
    /// adapters live outside the engine-free Simulation assembly.
    /// </summary>
    public sealed class SimulationDriver
    {
        /// <summary>The authoritative simulation duration: exactly 60 ticks per second.</summary>
        public const float FIXED_DT = SimulationTickContext.FIXED_DT;

        private const double MaximumAccumulator = FIXED_DT * 2d;

        private readonly SimulationKernel _kernel;
        private readonly ISimulationStateGate _stateGate;
        private readonly IPreAccumulatorLifecycleHook _lifecycleHook;
        private readonly IFrameInputCapture _inputCapture;
        private readonly IFrameDeltaSource _deltaSource;
        private readonly Func<bool> _pauseEdgeSource;
        private readonly Action _pauseEdgeConsumer;

        private double _accumulator;
        private int _simulationStepCount;
        private int _activeRaceStepCount;

        /// <summary>
        /// Creates a manual simulation driver.
        /// </summary>
        /// <param name="kernel">The Story 001 fourteen-step simulation kernel.</param>
        /// <param name="stateGate">The authoritative lifecycle state gate.</param>
        /// <param name="inputCapture">The one-per-render-frame input capture seam.</param>
        /// <param name="deltaSource">The unscaled render-frame clock seam.</param>
        /// <param name="lifecycleHook">Optional focus/pause boundary hook invoked before timing.</param>
        /// <param name="pauseEdgeSource">Optional input pause-edge query used by production wiring.</param>
        /// <param name="pauseEdgeConsumer">Optional callback that consumes a delivered pause edge.</param>
        public SimulationDriver(
            SimulationKernel kernel,
            ISimulationStateGate stateGate,
            IFrameInputCapture inputCapture,
            IFrameDeltaSource deltaSource,
            IPreAccumulatorLifecycleHook lifecycleHook = null,
            Func<bool> pauseEdgeSource = null,
            Action pauseEdgeConsumer = null)
        {
            _kernel = kernel ?? throw new ArgumentNullException(nameof(kernel));
            _stateGate = stateGate ?? throw new ArgumentNullException(nameof(stateGate));
            _inputCapture = inputCapture ?? throw new ArgumentNullException(nameof(inputCapture));
            _deltaSource = deltaSource ?? throw new ArgumentNullException(nameof(deltaSource));
            _lifecycleHook = lifecycleHook;
            _pauseEdgeSource = pauseEdgeSource;
            _pauseEdgeConsumer = pauseEdgeConsumer;
        }

        /// <summary>Current sub-tick remainder in seconds; always in [0, FIXED_DT).</summary>
        public float Accumulator => (float)_accumulator;

        /// <summary>Double-precision remainder exposed for deterministic test assertions.</summary>
        public double AccumulatorSeconds => _accumulator;

        /// <summary>Completed physics ticks, including Countdown ticks.</summary>
        public int SimulationStepCount => _simulationStepCount;

        /// <summary>Completed ticks that started in Racing.</summary>
        public int ActiveRaceStepCount => _activeRaceStepCount;

        /// <summary>Race time derived exclusively from ActiveRaceStepCount.</summary>
        public float SimTime => ActiveRaceStepCount * FIXED_DT;

        // GDD/ADR domain names (snake_case) exposed for schema-level consumers that read the
        // published snapshot fields verbatim. PascalCase is the public C# surface; these aliases
        // keep the domain vocabulary discoverable without duplicating state.
        public int simulationStepCount => SimulationStepCount;
        public int activeRaceStepCount => ActiveRaceStepCount;
        public float sim_time => SimTime;

        /// <summary>The kernel's latest immutable published snapshot, or null before Step 12 publishes one.</summary>
        public PublishedSimulationSnapshot PublishedSnapshot => _kernel.PublishedSnapshot;

        /// <summary>Raised after the driver decorates and publishes a tick snapshot.</summary>
        public event Action<PublishedSimulationSnapshot> SnapshotPublished;

        /// <summary>
        /// Processes one render frame. Capture occurs once before the clock is read and before
        /// the accumulator is changed. The accumulator is permanently clamped to two ticks.
        /// </summary>
        public void Update()
        {
            SimulationState stateBeforeHook = _stateGate.State;
            _lifecycleHook?.BeforeAccumulator(stateBeforeHook);
            SimulationState stateAfterHook = _stateGate.State;

            // Content readiness starts a fresh timing boundary. Any remainder from the
            // Loading frame is discarded before the first Countdown/Racing tick.
            if (stateBeforeHook == SimulationState.Loading &&
                (stateAfterHook == SimulationState.Countdown || stateAfterHook == SimulationState.Racing))
                _accumulator = 0d;

            // A focus/pause boundary is not allowed to contribute the boundary frame's elapsed
            // time. The sub-tick remainder and counters remain untouched.
            bool enteredPaused =
                (stateBeforeHook == SimulationState.Racing || stateBeforeHook == SimulationState.Countdown) &&
                stateAfterHook == SimulationState.Paused;

            // This call is intentionally unconditional, including paused and zero-tick frames.
            // It is structurally before the clock read and accumulator evaluation.
            RawInputSample sample = _inputCapture.CaptureLatest();
            _kernel.CaptureLatestRawSample(sample);

            float frameDelta = enteredPaused ? 0f : _deltaSource.GetUnscaledDeltaTime();
            if (enteredPaused || !_stateGate.CanTick)
                return;

            // Invalid or non-finite platform clock values cannot move authoritative time forward.
            // Rejects NaN, +Infinity, and negative values.
            if (!float.IsFinite(frameDelta) || frameDelta <= 0f)
                return;
            _accumulator += frameDelta;
            // FIXED_DT is float 1/60 ≈ 0.016666668; promotion to double is conservative —
            // slightly less permissive than exact 1/60. No practical impact.
            if (_accumulator > MaximumAccumulator)
                _accumulator = MaximumAccumulator;

            bool pauseEdgeConsumedThisFrame = false;
            while (_accumulator >= FIXED_DT && _stateGate.CanTick)
            {
                SimulationState tickStartState = _stateGate.State;
                bool startedInRacing = tickStartState == SimulationState.Racing;
                bool pauseEdge = !pauseEdgeConsumedThisFrame &&
                                 _pauseEdgeSource != null &&
                                 _pauseEdgeSource();

                ExecuteSingleTick(startedInRacing, pauseEdge, out bool pauseEdgeDelivered);
                if (pauseEdgeDelivered)
                    pauseEdgeConsumedThisFrame = true;
            }
        }

        /// <summary>
        /// Executes one accumulated simulation tick: runs the 14-step spine, subtracts the fixed
        /// duration, advances the authoritative counters, and decorates the published snapshot.
        /// </summary>
        private void ExecuteSingleTick(bool startedInRacing, bool pauseEdge, out bool pauseEdgeDelivered)
        {
            SimulationTickContext context;
            try
            {
                context = _kernel.ExecuteTick(pauseEdge);
            }
            catch (Exception exception)
            {
                // Physics failures are converted into a machine-owned retry hold. The
                // failed tick has not reached the accumulator/counter commit below.
                if (_stateGate is ISimulationPhysicsFailureHandler failureHandler)
                {
                    failureHandler.HandlePhysicsFailure(exception);
                    pauseEdgeDelivered = false;
                    return;
                }
                throw;
            }

            pauseEdgeDelivered = pauseEdge;
            if (pauseEdge)
                _pauseEdgeConsumer?.Invoke();

            _accumulator -= FIXED_DT;
            if (_accumulator < 0d)
                _accumulator = 0d;

            // The physics seam returns only after the tick's physics boundary has completed.
            _simulationStepCount++;
            if (startedInRacing)
                _activeRaceStepCount++;

            PublishDecoratedSnapshot(context, startedInRacing);
        }

        private void PublishDecoratedSnapshot(SimulationTickContext context, bool startedInRacing)
        {
            // Story 001 owns creation of the terminal snapshot. The driver only decorates it;
            // it never fabricates empty terminal arrays when a pipeline has not published one.
            if (context.PublishedSnapshot == null)
                return;

            float publishedSimTime = startedInRacing ? SimTime : 0f;
            PublishedSimulationSnapshot published = new PublishedSimulationSnapshot(
                context.PublishedSnapshot.Terminal,
                _simulationStepCount,
                _activeRaceStepCount,
                publishedSimTime);
            context.PublishSnapshot(published);
            _kernel.PublishSnapshot(published);
            SnapshotPublished?.Invoke(published);
        }
    }
}
