using Overdrive.Input;

namespace Overdrive.Simulation
{
    /// <summary>
    /// Owns the MVP ghost-recorder and GO-boundary replay-capture lifecycle for the
    /// simulation driver (GDD ghost-recording: "an in-memory buffer owned by Simulation").
    /// Concentrates the four integration points (lifecycle discard, pause-edge record,
    /// GO capture, continuous record) and their state (recorder, provider, observed
    /// previous state, capture flags) so the driver delegates instead of interleaving
    /// ghost bookkeeping with accumulator/counter logic.
    ///
    /// Lifecycle rules (ADR-0008, TR-ghost-004, AC-3.9/AC-6.1):
    /// - Terminal states (Results incl. forfeit, load-failure Idle, explicit Idle) discard
    ///   the MVP buffer unconditionally.
    /// - A new-session transition (Results/Idle → Loading/Countdown) discards the previous
    ///   race's records and re-arms the replay capture (capture is exactly once PER race).
    /// - ReplayInitialState is captured once at GO, before any continuous record for the
    ///   first Racing tick.
    /// </summary>
    public sealed class GhostRecorderLifecycle
    {
        private readonly IGhostRecorder _ghostRecorder;
        private readonly IReplayInitialStateProvider _replayStateProvider;

        private SimulationState _previousState;
        private bool _replayInitialStateCaptured;
        private ReplayInitialState _replayInitialState;

        /// <summary>
        /// Creates the ghost/replay lifecycle owner.
        /// </summary>
        /// <param name="ghostRecorder">Optional MVP ghost recorder (Story 008): one record per
        /// completed Racing tick, Pause edges, discard on terminal states. May be null to
        /// disable ghost recording entirely.</param>
        /// <param name="replayStateProvider">Optional GO-boundary replay capture provider
        /// (AC-3.9). May be null to disable replay capture.</param>
        public GhostRecorderLifecycle(
            IGhostRecorder ghostRecorder = null,
            IReplayInitialStateProvider replayStateProvider = null)
        {
            _ghostRecorder = ghostRecorder;
            _replayStateProvider = replayStateProvider;
        }

        /// <summary>
        /// The GO-boundary replay capture (AC-3.9), or null before the first Racing tick.
        /// Delegated by the driver's public surface so test consumers read it the same way.
        /// </summary>
        public ReplayInitialState? ReplayInitialState =>
            _replayInitialStateCaptured ? _replayInitialState : (ReplayInitialState?)null;

        /// <summary>
        /// Handles lifecycle transitions for the ghost recorder and the GO-boundary replay
        /// capture. Runs in the driver's per-frame observation BEFORE the early-return
        /// (Results/Idle have CanTick=false — the tick loop is not the right observation
        /// point) and never via StateChanged (which fires inside the spine at step 10, before
        /// the post-increment record append — a discard handler there would empty the buffer
        /// one record short).
        /// </summary>
        /// <param name="stateAfterHook">The lifecycle state after the pre-accumulator hook.</param>
        public void ObserveTransition(SimulationState stateAfterHook)
        {
            if (stateAfterHook == _previousState)
                return;

            SimulationState observed = _previousState;
            _previousState = stateAfterHook;

            bool terminalOrIdle = stateAfterHook == SimulationState.Results ||
                                  stateAfterHook == SimulationState.Idle;
            if (_ghostRecorder != null && terminalOrIdle)
                _ghostRecorder.Discard();

            // A composition root may transit Results/Idle -> Loading/Countdown between frames
            // without the driver ever observing the terminal state (e.g. forfeit -> immediate
            // re-race, or load-failure -> Idle -> re-race in one call stack). The previous
            // race's buffer must not leak into the new session.
            bool newSession =
                (stateAfterHook == SimulationState.Loading ||
                 stateAfterHook == SimulationState.Countdown) &&
                (observed == SimulationState.Results || observed == SimulationState.Idle);
            if (_ghostRecorder != null && newSession)
                _ghostRecorder.Discard();

            if (_replayStateProvider != null && newSession)
            {
                _replayInitialStateCaptured = false;
                _replayInitialState = default;
            }
        }

        /// <summary>
        /// Records a consumed Pause edge in the parallel standalone stream with the CURRENT
        /// (pre-increment) simulation step count — the count of completed ticks. No continuous
        /// sample is appended for this step (AC-3.10, ADR-0008).
        /// </summary>
        /// <param name="tickIndex">The current simulationStepCount at edge consumption.</param>
        public void RecordPauseEdge(uint tickIndex)
        {
            _ghostRecorder?.RecordEdgeEvent(tickIndex, EdgeEventFlags.Pause);
        }

        /// <summary>
        /// Captures ReplayInitialState exactly once at GO — on the GO tick (which transitions
        /// Countdown -> Racing), BEFORE any continuous record is appended for the first Racing
        /// tick. The snapshot is immutable; the provider's source state may mutate after
        /// capture without affecting it.
        /// </summary>
        /// <param name="context">The tick context; capture fires only when <see cref="SimulationTickContext.IsGoTick"/>.</param>
        public void CaptureAtGo(SimulationTickContext context)
        {
            if (_replayInitialStateCaptured || !context.IsGoTick)
                return;

            ReplayInitialStateCaptureInput input = _replayStateProvider?.GetCaptureInput();
            if (input == null)
                return;

            _replayInitialState = new ReplayInitialState(
                input.Version,
                input.RaceConfigurationId,
                input.ContentVersionHash,
                input.SimSeed,
                input.GridAssignment,
                input.CarIds,
                input.InitialFuelState,
                input.InitialTireState,
                input.PerfectStartRemainingTicks,
                input.DifficultyProfile);
            _replayInitialStateCaptured = true;
        }

        /// <summary>
        /// Records exactly one continuous record per completed Racing tick with the
        /// POST-increment tick index (the tick that just completed) (AC-6.1, ADR-0008).
        /// </summary>
        /// <param name="input">The authoritative per-tick SimulationInput.</param>
        /// <param name="tickIndex">The post-increment simulationStepCount of the completed tick.</param>
        public void RecordCompletedTick(SimulationInput input, uint tickIndex)
        {
            _ghostRecorder?.RecordTick(input, tickIndex);
        }
    }
}
