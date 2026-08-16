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
    /// The single per-frame input seam the Simulation driver consumes (C4, 2026-08-15 —
    /// one contract for capture AND pause-edge, Input-owned implementations per
    /// ADR-0001:41). Captures the latest platform input exactly once per render frame;
    /// the returned sample is reused by every simulation tick produced by that frame
    /// (ADR-0001). The pause-edge pair completes the frame contract: the driver queries
    /// <see cref="HasPendingPauseEdge"/> on the first tick of a frame and consumes it
    /// exactly once after delivery (ADR-0005).
    /// Example: <c>RawInputSample sample = capture.CaptureLatest();</c>
    /// </summary>
    public interface IFrameInputCapture
    {
        /// <summary>Captures exactly one immutable raw input sample.</summary>
        RawInputSample CaptureLatest();

        /// <summary>Whether Input has a pending gameplay Pause edge (consumed on the first tick of a frame).</summary>
        bool HasPendingPauseEdge { get; }

        /// <summary>Consumes the pending Pause edge after the first tick that receives it.</summary>
        void ConsumePendingPauseEdge();
    }

    /// <summary>
    /// The canonical whole-scene physics boundary step (GDD simulation-architecture.md
    /// step 7, array index 6). Composition injects this step at index 6 of the 14-step
    /// spine so the kernel itself stays agnostic of physics — the kernel only executes
    /// the steps in array order (ADR-0001: one Physics.Simulate(FIXED_DT) per active tick).
    /// </summary>
    public sealed class PhysicsSimulateStep : ISimulationPipelineStep, ICanonicalSpineStep
    {
        /// <summary>The canonical 0-based position of the physics boundary in the 14-step spine (GDD step 7).</summary>
        public const int SpineIndex = 6;

        /// <inheritdoc />
        public int CanonicalSpineIndex => SpineIndex;

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
        /// <param name="inputCapture">The single per-frame input seam: capture plus the
        /// pause-edge pair (C4, 2026-08-15). Input-owned implementation per ADR-0001:41.</param>
        public SimulationDriver(
            SimulationKernel kernel,
            ISimulationStateGate stateGate,
            IFrameInputCapture inputCapture,
            IFrameDeltaSource deltaSource,
            IPreAccumulatorLifecycleHook lifecycleHook = null,
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
        /// Processes one render frame as a fixed sequence of phases (C1, 2026-08-15):
        /// Boundary → Capture → Lifecycle publish → Gate → Accumulator → Tick loop. The
        /// ordering invariants are structural — each phase is a named step below and a
        /// named method above — so a new concern lands in its phase instead of threading
        /// through the timing path. Capture occurs exactly once before the clock is read
        /// and before the accumulator is changed (ADR-0001:41); the accumulator is
        /// permanently clamped to two ticks.
        /// </summary>
        public void Update()
        {
            // ── Phase 1 · Boundary — pre-accumulator lifecycle observation ──────────────
            ObserveBoundary(out SimulationState stateAfterHook, out bool enteredPaused);

            // ── Phase 2 · Capture — Input-owned raw sample, exactly once, before the clock
            //    and accumulator. Unconditional, including paused and zero-tick frames
            //    (ADR-0001: capture-before-accumulator). ─────────────────────────────────
            _kernel.CaptureLatestRawSample(_inputCapture.CaptureLatest());

            // ── Phase 3 · Lifecycle publishes — paused snapshot, forfeit snapshot,
            //    performance monitor, ghost lifecycle observation. All unconditional
            //    (resets apply even on early-return frames, AC-7.7b/7.7f). ───────────────
            if (enteredPaused)
                PublishPausedSnapshot();
            HandleForfeitSnapshot();
            float frameDelta = enteredPaused ? 0f : _deltaSource.GetUnscaledDeltaTime();
            EvaluatePerformanceMonitor(stateAfterHook, frameDelta);
            _ghostLifecycle.ObserveTransition(stateAfterHook);

            // ── Phase 4 · Gate — a focus/pause boundary or a non-ticking state stops here. ──
            if (enteredPaused || !_stateGate.CanTick)
                return;

            // ── Phase 5 · Accumulator — validated platform delta, clamped to two ticks. ──
            if (!AccumulateFrameDelta(frameDelta))
                return;

            // ── Phase 6 · Tick loop — drain whole FIXED_DT ticks while time remains. ─────
            DrainTicks();
        }

        /// <summary>
        /// Phase 1: observes the pre-accumulator lifecycle hook (the reliable transition
        /// signal — a boundary hook may resume inside BeforeAccumulator on the same frame
        /// the driver first sees the transition). Owns the performance-monitor state
        /// notification (before/after pair guard: hook-observed transition AND external
        /// between-frames transition — a resume back to the same state only shows in the
        /// pair, AC-7.6a), the accumulator reset when content readiness starts a fresh
        /// timing boundary (Loading → Countdown/Racing discards the Loading remainder),
        /// and the focus/pause boundary detection.
        /// </summary>
        private void ObserveBoundary(out SimulationState stateAfterHook, out bool enteredPaused)
        {
            SimulationState stateBeforeHook = _stateGate.State;
            _lifecycleHook?.BeforeAccumulator(stateBeforeHook);
            stateAfterHook = _stateGate.State;

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

            // A focus/pause boundary is not allowed to contribute the boundary frame's
            // elapsed time. The sub-tick remainder and counters remain untouched.
            enteredPaused =
                (stateBeforeHook == SimulationState.Racing || stateBeforeHook == SimulationState.Countdown) &&
                stateAfterHook == SimulationState.Paused;
        }

        /// <summary>
        /// Phase 5: validates the platform clock delta (rejects NaN, +Infinity, and
        /// negative values — invalid clocks cannot move authoritative time forward),
        /// accumulates it, and clamps to the two-tick maximum. Time above the clamp is
        /// permanently discarded, never caught up later.
        /// </summary>
        private bool AccumulateFrameDelta(float frameDelta)
        {
            if (!float.IsFinite(frameDelta) || frameDelta <= 0f)
                return false;
            _accumulator += frameDelta;
            // FIXED_DT is float 1/60 ≈ 0.016666668; promotion to double is conservative —
            // slightly less permissive than exact 1/60. No practical impact.
            if (_accumulator > MaximumAccumulator)
                _accumulator = MaximumAccumulator;
            return true;
        }

        /// <summary>
        /// Phase 6: drains whole accumulated ticks. The pause edge is consumed at most
        /// once per frame (the first tick of the frame); subsequent ticks reuse the same
        /// edge-free state. The edge query and consumption live on the frame seam
        /// (<see cref="IFrameInputCapture"/>, C4).
        /// </summary>
        private void DrainTicks()
        {
            bool pauseEdgeConsumedThisFrame = false;
            while (_accumulator >= FIXED_DT && _stateGate.CanTick)
            {
                SimulationState tickStartState = _stateGate.State;
                bool startedInRacing = tickStartState == SimulationState.Racing;
                bool pauseEdge = !pauseEdgeConsumedThisFrame && _inputCapture.HasPendingPauseEdge;

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
                _inputCapture.ConsumePendingPauseEdge();

            // Per-tick tick-boundary dispatch: the lifecycle decides internally whether this
            // tick records a pause edge, captures ReplayInitialState at GO, or appends a
            // continuous Racing record (C2, 2026-08-15 — ordering lives in the module, not
            // here). stepCountBeforeIncrement is the counter value before this tick's
            // increment, which the module derives the edge/record indices from.
            _ghostLifecycle.OnTickCommitted(
                context,
                startedInRacing,
                (uint)_simulationStepCount);

            // A pause boundary interrupts the tick at step 4: the edge is consumed and the
            // Paused transition is published, but no fixed duration is subtracted, no counter
            // advances, and no physics tick ran (ADR-0001: steps 4-14 do not execute). The
            // accumulator remainder is preserved for resume. One immutable non-ticking
            // snapshot carrying resumeState is published (AC-4.6a).
            if (context.PauseBoundaryReached)
            {
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
