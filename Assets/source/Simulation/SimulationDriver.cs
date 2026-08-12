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
        private readonly PerformanceMonitor _performanceMonitor;
        private readonly GhostRecorderLifecycle _ghostLifecycle;
        private readonly ISimulationPhysicsFailureHandler _physicsFailureHandler;

        private double _accumulator;
        private int _simulationStepCount;
        private int _activeRaceStepCount;
        private bool _forfeitSnapshotPublished;
        private SimulationState _lastHookedState;

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
        /// <param name="performanceMonitor">Optional performance protection monitor evaluated once per frame.</param>
        /// <param name="ghostRecorder">Optional MVP ghost recorder (Story 008): one record per completed Racing tick, Pause edges, discard on terminal states.</param>
        /// <param name="replayStateProvider">Optional GO-boundary replay capture provider (AC-3.9).</param>
        /// <param name="physicsFailureHandler">Optional physics-failure handler (Story 003 retry hold);
        /// when null, a tick that throws is rethrown (production composition passes the state machine,
        /// which implements <see cref="ISimulationPhysicsFailureHandler"/>).</param>
        public SimulationDriver(
            SimulationKernel kernel,
            ISimulationStateGate stateGate,
            IFrameInputCapture inputCapture,
            IFrameDeltaSource deltaSource,
            IPreAccumulatorLifecycleHook lifecycleHook = null,
            Func<bool> pauseEdgeSource = null,
            Action pauseEdgeConsumer = null,
            PerformanceMonitor performanceMonitor = null,
            IGhostRecorder ghostRecorder = null,
            IReplayInitialStateProvider replayStateProvider = null,
            ISimulationPhysicsFailureHandler physicsFailureHandler = null)
        {
            _kernel = kernel ?? throw new ArgumentNullException(nameof(kernel));
            _stateGate = stateGate ?? throw new ArgumentNullException(nameof(stateGate));
            _inputCapture = inputCapture ?? throw new ArgumentNullException(nameof(inputCapture));
            _deltaSource = deltaSource ?? throw new ArgumentNullException(nameof(deltaSource));
            _lifecycleHook = lifecycleHook;
            _pauseEdgeSource = pauseEdgeSource;
            _pauseEdgeConsumer = pauseEdgeConsumer;
            _performanceMonitor = performanceMonitor;
            _ghostLifecycle = new GhostRecorderLifecycle(ghostRecorder, replayStateProvider);
            _physicsFailureHandler = physicsFailureHandler;
            if (performanceMonitor != null)
                performanceMonitor.PerformanceStatusChanged += OnPerformanceStatusChanged;
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

        /// <summary>The GO-boundary replay capture (AC-3.9), or null before the first Racing tick.</summary>
        public ReplayInitialState? ReplayInitialState => _ghostLifecycle.ReplayInitialState;

        /// <summary>Raised after the driver decorates and publishes a tick snapshot.</summary>
        public event Action<PublishedSimulationSnapshot> SnapshotPublished;

        /// <summary>
        /// Raised when the performance monitor transitions Reduced/Restored. Forwarded from the
        /// injected <see cref="PerformanceMonitor"/> (producer-only signal, ADR-0001).
        /// </summary>
        public event Action<PerformanceSignal> PerformanceStatusChanged;

        /// <summary>
        /// Processes one render frame. Capture occurs once before the clock is read and before
        /// the accumulator is changed. The accumulator is permanently clamped to two ticks.
        /// </summary>
        public void Update()
        {
            SimulationState stateBeforeHook = _stateGate.State;
            _lifecycleHook?.BeforeAccumulator(stateBeforeHook);
            SimulationState stateAfterHook = _stateGate.State;

            // Performance monitor state tracking: notify lifecycle transitions. Resets
            // (Idle/Loading/Finished/Results, non-performance Paused) apply even on
            // early-return frames (AC-7.7b/7.7f, AC-7.6a). The before/after hook state pair is
            // the reliable transition signal: a boundary hook may resume (Paused -> Countdown)
            // inside BeforeAccumulator on the SAME frame the driver first sees the transition.
            // The guard covers BOTH a hook-observed transition (before != after) and an external
            // transition between frames (after != lastHooked) — a resume back to the same state
            // the driver already knew (Countdown -> Paused -> Countdown in one frame) only shows
            // up in the before/after pair.
            // The monitor owns the resume decision (producer-only, ADR-0001) — it detects
            // Paused -> Countdown/Racing internally and consumes the resume-frame FPS in its
            // Evaluate (AC-7.7a/7.7c).
            if (_performanceMonitor != null &&
                (stateBeforeHook != stateAfterHook || stateAfterHook != _lastHookedState))
            {
                _performanceMonitor.OnStateChanged(stateBeforeHook, stateAfterHook);
                _lastHookedState = stateAfterHook;
            }

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

            // The focus-loss lifecycle boundary publishes one immutable non-ticking snapshot
            // carrying the Simulation-owned resumeState (ADR-0001, AC-7.1/7.1a).
            if (enteredPaused)
                PublishPausedSnapshot();

            // A forfeit (Return to Menu from Paused, AC-4.12) happens OUTSIDE the Update loop
            // (the player acts while Paused), so the driver cannot observe Paused -> Results
            // via the hook. State-based detection publishes the forfeit Results lifecycle
            // snapshot exactly once per forfeit entry (no resumed physics tick — CanTick is
            // false in Results). Reset when the session leaves Results-forfeit.
            HandleForfeitSnapshot();

            float frameDelta = enteredPaused ? 0f : _deltaSource.GetUnscaledDeltaTime();

            // Performance monitor evaluates once per frame with the SAME delta the accumulator
            // uses (single-capture semantics, ADR-0001) while in Countdown/Racing. A resume frame
            // reports its FPS to the monitor for the clear/persist decision (AC-7.7a/7.7c).
            EvaluatePerformanceMonitor(stateAfterHook, frameDelta);

            // Ghost discard and GO-capture re-arm on lifecycle transitions (see module).
            _ghostLifecycle.ObserveTransition(stateAfterHook);

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
        /// Publishes the forfeit Results lifecycle snapshot exactly once per forfeit entry
        /// (state-based detection — the forfeit happens outside the Update loop while Paused,
        /// AC-4.12). Reset when the session leaves Results-forfeit.
        /// </summary>
        private void HandleForfeitSnapshot()
        {
            if (_stateGate.State != SimulationState.Results || !_stateGate.IsForfeit)
                _forfeitSnapshotPublished = false;
            else if (!_forfeitSnapshotPublished)
            {
                PublishForfeitSnapshot();
                _forfeitSnapshotPublished = true;
            }
        }

        /// <summary>
        /// Drives the optional performance monitor for the current frame: evaluates the frame
        /// delta. No-op when no monitor is injected. Single-capture semantics — uses the same
        /// delta the accumulator consumes. Resume-frame FPS is consumed internally by the monitor
        /// (AC-7.7a/7.7c); the driver no longer owns resume detection.
        /// </summary>
        private void EvaluatePerformanceMonitor(SimulationState stateAfterHook, float frameDelta)
        {
            if (_performanceMonitor == null)
                return;

            _performanceMonitor.Evaluate(frameDelta, stateAfterHook);
        }

        /// <summary>
        /// Executes one accumulated simulation tick: runs the 14-step spine, subtracts the fixed
        /// duration, advances the authoritative counters, and decorates the published snapshot.
        /// </summary>
        private void ExecuteSingleTick(bool startedInRacing, bool pauseEdge, out bool pauseEdgeDelivered)
        {
            // Pre-compute the post-increment counters so the RSM consume step (index 10) can
            // freeze the FINAL values into PostFinishSnapshot while the driver keeps counter
            // ownership (ADR-0001; unity-specialist story-005 review, defect 3).
            SimulationTickContext context;
            try
            {
                context = _kernel.ExecuteTick(pauseEdge,
                    nextSimulationStepCount: _simulationStepCount + 1,
                    nextActiveRaceStepCount: _activeRaceStepCount + (startedInRacing ? 1 : 0));
            }
            catch (Exception exception)
            {
                // Physics failures are converted into a machine-owned retry hold. The
                // failed tick has not reached the accumulator/counter commit below.
                if (_physicsFailureHandler != null)
                {
                    _physicsFailureHandler.HandlePhysicsFailure(exception);
                    pauseEdgeDelivered = false;
                    return;
                }
                throw;
            }

            pauseEdgeDelivered = pauseEdge;
            if (pauseEdge)
                _pauseEdgeConsumer?.Invoke();

            // A pause boundary interrupts the tick at step 4: the edge is consumed and the
            // Paused transition is published, but no fixed duration is subtracted, no counter
            // advances, and no physics tick ran (ADR-0001: steps 4-14 do not execute). The
            // accumulator remainder is preserved for resume. One immutable non-ticking
            // snapshot carrying resumeState is published (AC-4.6a).
            if (context.PauseBoundaryReached)
            {
                // AC-3.10: the consumed Pause edge is recorded in the parallel standalone
                // stream with the CURRENT (pre-increment) simulationStepCount — the count of
                // completed ticks. No continuous sample is appended for this step (the boundary
                // path returns before the append).
                _ghostLifecycle.RecordPauseEdge((uint)_simulationStepCount);
                PublishPausedSnapshot();
                return;
            }

            _accumulator -= FIXED_DT;
            if (_accumulator < 0d)
                _accumulator = 0d;

            // The physics seam returns only after the tick's physics boundary has completed.
            _simulationStepCount++;
            if (startedInRacing)
                _activeRaceStepCount++;

            // AC-3.9: capture ReplayInitialState exactly once at GO — on the GO tick (which
            // transitions Countdown -> Racing), BEFORE any continuous record is appended for
            // the first Racing tick. The snapshot is immutable; the provider's source state
            // may mutate after capture without affecting it.
            _ghostLifecycle.CaptureAtGo(context);

            // AC-6.1: exactly one continuous record per completed Racing tick, with the
            // POST-increment tick index (the tick that just completed).
            if (startedInRacing)
                _ghostLifecycle.RecordCompletedTick(context.SimulationInput, (uint)_simulationStepCount);

            PublishDecoratedSnapshot(context, startedInRacing);
        }

        private void PublishDecoratedSnapshot(SimulationTickContext context, bool startedInRacing)
        {
            // Story 001 owns creation of the terminal snapshot. The driver only decorates it;
            // it never fabricates empty terminal arrays when a pipeline has not published one.
            if (context.PublishedSnapshot == null)
                return;

            float publishedSimTime = startedInRacing ? SimTime : 0f;
            PostFinishSnapshot terminal = context.PublishedSnapshot.Terminal;
            PublishedSimulationSnapshot published = new PublishedSimulationSnapshot(
                terminal,
                _simulationStepCount,
                _activeRaceStepCount,
                publishedSimTime,
                null,
                isForfeit: false,
                forfeitLapCount: -1,
                raceTimeAtForfeit: 0f,
                resultKind: terminal?.Rsm.ResultKind ?? ResultKind.Race,
                resolutionComplete: terminal?.Rsm.ResolutionComplete ?? false,
                playerFinishTime: terminal?.Rsm.PlayerFinishTime ?? 0f,
                terminalPresentationRequest: terminal?.Rsm.TerminalPresentationRequest ?? false,
                resolvedFinishOrder: context.ResolvedFinishOrder);
            context.PublishSnapshot(published);
            _kernel.PublishSnapshot(published);
            SnapshotPublished?.Invoke(published);
        }

        /// <summary>
        /// Publishes the immutable Results lifecycle snapshot on a forfeit (AC-4.12). No
        /// terminal state is fabricated — the snapshot carries the RSM-originated forfeit
        /// metadata (<c>resultClassification = Forfeit</c>, <c>forfeitLapCount</c>,
        /// <c>raceTimeAtForfeit</c>) and no finish order.
        /// </summary>
        private void PublishForfeitSnapshot()
        {
            PublishedSimulationSnapshot published = new PublishedSimulationSnapshot(
                null,
                _simulationStepCount,
                _activeRaceStepCount,
                SimTime,
                null,
                isForfeit: true,
                forfeitLapCount: _stateGate.ForfeitLapCount,
                raceTimeAtForfeit: _stateGate.RaceTimeAtForfeit,
                resultKind: ResultKind.Race,
                resolutionComplete: false,
                playerFinishTime: 0f,
                terminalPresentationRequest: false,
                resolvedFinishOrder: null);
            _kernel.PublishSnapshot(published);
            SnapshotPublished?.Invoke(published);
        }

        /// <summary>
        /// Publishes the single immutable non-ticking lifecycle snapshot on Paused entry
        /// (manual, focus, or performance pause). No terminal state is fabricated —
        /// <see cref="PublishedSimulationSnapshot.HasTerminal"/> is false and the snapshot
        /// carries the Simulation-owned <c>resumeState</c> plus current counters (AC-4.6a,
        /// ADR-0001 non-ticking lifecycle output).
        /// </summary>
        private void PublishPausedSnapshot()
        {
            SimulationState? resumeState = _stateGate.ResumeState;
            PublishedSimulationSnapshot published = new PublishedSimulationSnapshot(
                null,
                _simulationStepCount,
                _activeRaceStepCount,
                SimTime,
                resumeState);
            _kernel.PublishSnapshot(published);
            SnapshotPublished?.Invoke(published);
        }

        private void OnPerformanceStatusChanged(PerformanceSignal signal)
        {
            PerformanceStatusChanged?.Invoke(signal);
        }
    }
}
