using System;
using System.Collections.Generic;

namespace Overdrive.Simulation
{
    /// <summary>
    /// Request emitted by Simulation when Content Pipeline must load or reload a session.
    /// Content consumes this value and reports completion through the machine's methods;
    /// it never writes <see cref="SimulationState"/> (ADR-0003).
    /// </summary>
    public readonly struct ContentLoadRequest
    {
        public readonly RaceMode RaceMode;
        public readonly GridAssignment GridAssignment;

        public ContentLoadRequest(RaceMode raceMode, GridAssignment gridAssignment)
        {
            RaceMode = raceMode;
            GridAssignment = gridAssignment;
        }

        public RaceMode Mode => RaceMode;
        public GridAssignment Grid => GridAssignment;
    }

    /// <summary>Logger seam used for deterministic physics-failure tests.</summary>
    public interface ISimulationLogger
    {
        /// <summary>Records one authoritative simulation error.</summary>
        void Error(string message, Exception exception);
    }

    /// <summary>
    /// Optional driver seam for converting a failed physics boundary into a frozen
    /// machine state without advancing driver counters or the accumulator.
    /// </summary>
    public interface ISimulationPhysicsFailureHandler
    {
        void HandlePhysicsFailure(Exception exception);
    }

    /// <summary>
    /// Authoritative session lifecycle for Story 003. State transitions are O(1), and
    /// the tick methods do not allocate. Content readiness and errors are explicit
    /// inbound calls so the content system cannot mutate simulation state directly.
    ///
    /// Example:
    /// <code>
    /// var machine = new SimulationStateMachine(errorLogger: message =&gt; log.Add(message));
    /// machine.ContentLoadRequested += request =&gt; content.Load(request);
    /// machine.StartSingleRace(RaceMode.Race, grid);
    /// </code>
    /// </summary>
    public class SimulationStateMachine : ISimulationStateGate, ISimulationPhysicsFailureHandler
    {
        /// <summary>Authoritative Countdown length: 300 simulation ticks (ADR-0001).</summary>
        public const int CountdownDurationTicks = 300;

        private readonly Action<string> _errorLogger;
        private readonly ISimulationLogger _logger;
        private readonly bool _allowUnrestrictedTransitions;

        private SimulationState _state;
        private RaceMode _raceMode;
        private GridAssignment _gridAssignment;
        private int _countdownRemainingTicks;
        private bool _isGridLocked;
        private bool _goPending;
        private bool _retryHold;
        private SimulationState? _resumeState;

        // Story 005 terminal flow state (ADR-0001 / ADR-0018).
        private PostFinishSnapshot _terminalSnapshot;
        private ResolvedFinishOrder _resolvedFinishOrder;
        private ResultKind _resultKind;
        private bool _resolutionComplete;
        private float _playerFinishTime;
        private bool _terminalPresentationRequest;
        private bool _isForfeit;
        private int _forfeitLapCount;
        private float _raceTimeAtForfeit;
        private bool _unloadRequested;

        /// <summary>Raised after an accepted lifecycle transition.</summary>
        public event Action<SimulationStateChanged> StateChanged;

        /// <summary>
        /// Raised exactly once per pause entry, AFTER <see cref="StateChanged"/>, carrying the
        /// originating Countdown or Racing state (Story 004, ADR-0001). Never raised on resume.
        /// </summary>
        public event Action<PausedStateChanged> PausedStateChanged;

        /// <summary>Raised once for each accepted start or racing retry reload.</summary>
        public event Action<ContentLoadRequest> ContentLoadRequested;

        /// <summary>Raised once per accepted Continue/Back from Results (ADR-0001 unload handshake).</summary>
        public event Action<ContentUnloadRequest> ContentUnloadRequested;

        /// <summary>Raised once when a forfeit aborts the session (Story 008 consumes for buffer discard).</summary>
        public event Action<RaceAborted> RaceAborted;

        /// <summary>Raised once for each accepted abortive content error.</summary>
        public event Action<LifecycleErrorRaised> LifecycleErrorRaised;

        /// <summary>Raised when qualifying enters Racing and the input context may activate.</summary>
        public event Action GameplayQualifyingRequested;

        /// <summary>Current authoritative lifecycle state.</summary>
        public SimulationState State => _state;

        /// <summary>True when a simulation tick may execute (Countdown or Racing, not retry-held).</summary>
        public bool CanTick =>
            !_retryHold && (_state == SimulationState.Countdown || _state == SimulationState.Racing);

        /// <summary>Session race mode resolved at start (Race or Qualifying).</summary>
        public RaceMode RaceMode => _raceMode;

        /// <summary>Session grid handoff (race slots or qualifying pit-box slot).</summary>
        public GridAssignment GridAssignment => _gridAssignment;

        /// <summary>True while the car is grid-locked during Countdown; false after GO releases it.</summary>
        public bool IsGridLocked => _isGridLocked;

        /// <summary>Remaining unpaused countdown ticks; 0 when GO is pending or not in Countdown.</summary>
        public int CountdownRemainingTicks => _countdownRemainingTicks;

        /// <summary>True while a physics failure has frozen the session awaiting explicit retry.</summary>
        public bool IsRetryHeld => _retryHold;

        /// <summary>
        /// The Countdown or Racing state active immediately before the current pause, or null
        /// when not Paused / no valid pause entry was recorded (Story 004, ADR-0001).
        /// </summary>
        public SimulationState? ResumeState => _resumeState;

        // ---- Story 005 terminal-flow properties (RSM-originated metadata) ----

        /// <summary>Captured terminal snapshot at the Finished transition, or null.</summary>
        public PostFinishSnapshot TerminalSnapshot => _terminalSnapshot;

        /// <summary>Resolved finish order frozen at the Finished transition, or null (no finish order on forfeit).</summary>
        public ResolvedFinishOrder ResolvedFinishOrder => _resolvedFinishOrder;

        /// <summary>Race or Qualifying — selects destination results screen (RSM-originated).</summary>
        public ResultKind ResultKind => _resultKind;

        /// <summary>True once finish resolution has completed (immediately true for qualifying).</summary>
        public bool ResolutionComplete => _resolutionComplete;

        /// <summary>Player final race time in seconds (RSM-originated).</summary>
        public float PlayerFinishTime => _playerFinishTime;

        /// <summary>True while UI Presentation should show the terminal presentation (RSM-originated).</summary>
        public bool TerminalPresentationRequest => _terminalPresentationRequest;

        /// <summary>True when the current Results state was entered by forfeit (Return to Menu from Paused).</summary>
        public bool IsForfeit => _isForfeit;

        /// <summary>Forfeit lap count (0 for Countdown forfeit); valid only when <see cref="IsForfeit"/>.</summary>
        public int ForfeitLapCount => _forfeitLapCount;

        /// <summary>Forfeit race time in seconds (0.0 for Countdown forfeit); valid only when <see cref="IsForfeit"/>.</summary>
        public float RaceTimeAtForfeit => _raceTimeAtForfeit;

        /// <summary>
        /// Set by Story 007's performance monitor when the below-15-FPS threshold is reached.
        /// Consumed exactly once at the pause boundary step (GDD step 4, Story 004).
        /// </summary>
        public bool PendingPerformancePause { get; set; }

        /// <summary>
        /// Creates a machine in Idle. The logger callback is invoked once per handled
        /// physics failure; it is never called from a successful tick.
        /// </summary>
        public SimulationStateMachine(
            SimulationState initial = SimulationState.Idle,
            Action<string> errorLogger = null)
            : this(initial, errorLogger, false)
        {
        }

        // Compatibility adapter constructor used only by SimulationStateGate.
        protected SimulationStateMachine(
            SimulationState initial,
            Action<string> errorLogger,
            bool allowUnrestrictedTransitions)
        {
            _state = initial;
            _errorLogger = errorLogger;
            _logger = null;
            _allowUnrestrictedTransitions = allowUnrestrictedTransitions;
        }

        /// <summary>
        /// Alternate logger seam for callers that need the exception as well as its
        /// message. Passing null is valid and simply disables logging.
        /// </summary>
        public SimulationStateMachine(SimulationState initial, ISimulationLogger logger)
            : this(initial, (Action<string>)null)
        {
            _logger = logger;
        }

        /// <summary>
        /// Starts one Single Race content handshake. Invalid (null) assignments and
        /// repeated starts are rejected without changing state or emitting a request.
        /// </summary>
        public bool StartSingleRace(GridAssignment gridAssignment)
        {
            return StartSingleRace(RaceMode.Race, gridAssignment);
        }

        /// <summary>
        /// Starts a race or qualifying content handshake from Idle.
        /// </summary>
        public bool StartSingleRace(RaceMode raceMode, GridAssignment gridAssignment)
        {
            if (_state != SimulationState.Idle || gridAssignment == null)
                return false;

            _raceMode = raceMode;
            _gridAssignment = gridAssignment;
            _countdownRemainingTicks = 0;
            _isGridLocked = false;
            _goPending = false;
            _retryHold = false;
            TransitionTo(SimulationState.Loading);
            ContentLoadRequested?.Invoke(new ContentLoadRequest(raceMode, gridAssignment));
            return true;
        }

        /// <summary>
        /// Accepts the only loading completion signal. Readiness outside Loading,
        /// with a stale mode, or with a null assignment is ignored.
        /// </summary>
        public void OnRaceLoadReady(RaceMode raceMode, GridAssignment gridAssignment)
        {
            if (_state != SimulationState.Loading || gridAssignment == null || raceMode != _raceMode)
                return;

            _gridAssignment = gridAssignment;
            _goPending = false;
            _retryHold = false;
            if (raceMode == RaceMode.Qualifying)
            {
                _countdownRemainingTicks = 0;
                _isGridLocked = false;
                TransitionTo(SimulationState.Racing);
                GameplayQualifyingRequested?.Invoke();
                return;
            }

            _countdownRemainingTicks = CountdownDurationTicks;
            _isGridLocked = true;
            TransitionTo(SimulationState.Countdown);
        }

        /// <summary>
        /// Aborts a loading handshake and publishes its metadata exactly once. Car
        /// degradation is intentionally not routed here; ContentErrorType has no Car value.
        /// </summary>
        public void OnContentLoadError(string reason, ContentErrorType contentErrorType)
        {
            if (_state != SimulationState.Loading)
                return;

            ClearSession();
            TransitionTo(SimulationState.Idle);
            LifecycleErrorRaised?.Invoke(new LifecycleErrorRaised(reason, contentErrorType));
        }

        /// <summary>
        /// Advances one countdown tick. This is the pre-physics pipeline trigger.
        /// The 1-to-0 transition is deferred until <see cref="CompletePhysicsTick"/>.
        /// </summary>
        public void ProcessCountdownTick()
        {
            if (!CanTick || _state != SimulationState.Countdown || _goPending)
                return;

            if (_countdownRemainingTicks <= 0)
                return;

            _countdownRemainingTicks--;
            if (_countdownRemainingTicks == 0)
                _goPending = true;
        }

        /// <summary>
        /// Completes the post-physics GO boundary. Grid lock is released only after
        /// the physics step returns successfully; the following tick starts in Racing.
        /// </summary>
        public void CompletePhysicsTick(SimulationTickContext context = null)
        {
            if (_state != SimulationState.Countdown || !_goPending || _retryHold)
                return;

            _goPending = false;
            _isGridLocked = false;
            if (context != null)
                context.IsGoTick = true;
            TransitionTo(SimulationState.Racing);
        }

        /// <summary>
        /// Enters Paused from Countdown or Racing, recording the originating state as
        /// <see cref="ResumeState"/> before publishing the Paused lifecycle events.
        /// Event order (Story 004): record resumeState, transition, raise StateChanged,
        /// then raise PausedStateChanged LAST. No-op when not in Countdown/Racing or
        /// already Paused (duplicate signals produce exactly one transition).
        /// </summary>
        public void EnterPaused(SimulationState? source)
        {
            if (_state != SimulationState.Countdown && _state != SimulationState.Racing)
                return;
            if (_state == SimulationState.Paused)
                return;

            SimulationState previous = _state;
            _resumeState = source ?? _state;
            TransitionTo(SimulationState.Paused);
            PausedStateChanged?.Invoke(new PausedStateChanged(_resumeState.Value, previous));
        }

        /// <summary>
        /// Explicit player-initiated resume — the SOLE exit path from Paused. Returns to the
        /// recorded <see cref="ResumeState"/> (Countdown or Racing). No-op when not Paused or
        /// when no valid resumeState was recorded; focus return never auto-resumes (ADR-0001).
        /// </summary>
        public void RequestResume()
        {
            if (_state != SimulationState.Paused)
                return;
            if (!_resumeState.HasValue)
                return;

            TransitionTo(_resumeState.Value);
            _resumeState = null;
        }

        /// <summary>
        /// Exits the internal retry hold. Countdown failures restart only the 300-tick
        /// countdown. Racing failures reload the current race and await fresh readiness.
        /// Ignored from Paused — Paused exits exclusively via <see cref="RequestResume"/>.
        /// </summary>
        public void RequestRetry()
        {
            if (_state == SimulationState.Paused)
                return;

            if (!_retryHold)
                return;

            _retryHold = false;
            _goPending = false;
            if (_raceMode == RaceMode.Race && _state == SimulationState.Countdown)
            {
                _countdownRemainingTicks = CountdownDurationTicks;
                _isGridLocked = true;
                return;
            }

            if (_raceMode == RaceMode.Race && _state == SimulationState.Racing)
            {
                _isGridLocked = false;
                TransitionTo(SimulationState.Loading);
                ContentLoadRequested?.Invoke(new ContentLoadRequest(RaceMode.Race, _gridAssignment));
                return;
            }

            // Qualifying never holds retry (ADR-0013: single flying lap, one attempt, no
            // retry). If we ever reach here, the session was cleared by a qualifying failure
            // that already transitioned to Idle — nothing further to do.
        }

        /// <summary>
        /// Continue/Back from Results (AC-4.10a): sends <see cref="ContentUnloadRequest"/>,
        /// remains Results while unload executes, and executes no simulation tick. The request
        /// is emitted at most once per Results entry — repeated Continue/Back presses do not
        /// duplicate it (QA case AC-4.10a).
        /// </summary>
        public bool RequestUnload()
        {
            if (_state != SimulationState.Results)
                return false;

            if (!_unloadRequested)
            {
                _unloadRequested = true;
                ContentUnloadRequested?.Invoke(new ContentUnloadRequest());
            }
            return true;
        }

        /// <summary>
        /// Applies the finish boundary (GDD step 11): freezes the captured terminal snapshot
        /// and resolved order, then transitions Racing → Finished. Consumed exactly once by
        /// the RSM consume step; duplicate applications are ignored outside Racing.
        /// </summary>
        public void ApplyFinish(PostFinishSnapshot snapshot, ResolvedFinishOrder resolvedOrder)
        {
            if (_state != SimulationState.Racing)
                return;

            _terminalSnapshot = snapshot;
            _resolvedFinishOrder = resolvedOrder;
            _resultKind = snapshot?.Rsm.ResultKind ?? ResultKind.Race;
            _resolutionComplete = true;
            _playerFinishTime = snapshot?.Rsm.PlayerFinishTime ?? 0f;
            _terminalPresentationRequest = true;
            TransitionTo(SimulationState.Finished);
        }

        /// <summary>
        /// Consumes UI Presentation's dismissal of the terminal presentation (AC-4.8g).
        /// Finished → Results without a physics tick; ignored from any other state.
        /// </summary>
        public void OnDismissTerminalPresentation()
        {
            if (_state != SimulationState.Finished)
                return;

            _terminalPresentationRequest = false;
            TransitionTo(SimulationState.Results);
        }

        /// <summary>
        /// Consumes Content's unload completion (AC-4.10b). Results → Idle with no Kernel-owned
        /// session references retained; ignored outside Results or when no unload was requested
        /// (a stale completion from Content must not prematurely end the session).
        /// </summary>
        public void OnContentUnloadComplete()
        {
            if (_state != SimulationState.Results || !_unloadRequested)
                return;

            ClearSession();
            TransitionTo(SimulationState.Idle);
        }

        /// <summary>
        /// Starts the next race or the race after Qualifying Results (AC-4.8h / AC-4.10).
        /// Results → Loading with a fresh grid assignment and one ContentLoadRequest;
        /// transitions to Countdown only after a matching <see cref="OnRaceLoadReady"/>.
        /// </summary>
        public bool StartRaceFromResults(GridAssignment gridAssignment)
        {
            if (_state != SimulationState.Results || gridAssignment == null)
                return false;

            _raceMode = RaceMode.Race;
            _gridAssignment = gridAssignment;
            _countdownRemainingTicks = 0;
            _isGridLocked = false;
            _goPending = false;
            _retryHold = false;
            _unloadRequested = false;
            // A fresh session must not inherit the previous race's terminal state: the
            // published snapshot derives SimulationState from Terminal (compat constructor),
            // so a stale Finished terminal would leak into Loading/Countdown snapshots.
            _terminalSnapshot = null;
            _resolvedFinishOrder = null;
            _resultKind = ResultKind.Race;
            _resolutionComplete = false;
            _playerFinishTime = 0f;
            _terminalPresentationRequest = false;
            _isForfeit = false;
            _forfeitLapCount = 0;
            _raceTimeAtForfeit = 0f;
            TransitionTo(SimulationState.Loading);
            ContentLoadRequested?.Invoke(new ContentLoadRequest(RaceMode.Race, gridAssignment));
            return true;
        }

        /// <summary>
        /// Forfeit path (AC-4.12): Return to Menu from a Paused state whose resumeState is
        /// Countdown or Racing. Transitions directly to Results without a resumed physics
        /// tick, records the RSM-originated forfeit metadata, and emits
        /// <see cref="RaceAborted"/> for Ghost Recording's buffer discard (Story 008).
        /// Never creates a finish order and never invokes the resolver.
        /// </summary>
        public bool RequestForfeit(int forfeitLapCount, float raceTimeAtForfeit)
        {
            if (_state != SimulationState.Paused)
                return false;
            if (!_resumeState.HasValue ||
                (_resumeState.Value != SimulationState.Countdown &&
                 _resumeState.Value != SimulationState.Racing))
                return false;

            _isForfeit = true;
            _forfeitLapCount = forfeitLapCount;
            _raceTimeAtForfeit = raceTimeAtForfeit;
            _resolvedFinishOrder = null;
            _resumeState = null;
            TransitionTo(SimulationState.Results);
            RaceAborted?.Invoke(new RaceAborted(ResultClassification.Forfeit));
            return true;
        }

        /// <summary>
        /// Enters the Results lifecycle from a legal transition (Racing → Results). Clears
        /// the forfeit marker so a normal completion is not mislabelled.
        /// </summary>
        public void EnterResults()
        {
            if (_state != SimulationState.Racing && _state != SimulationState.Finished)
                return;

            _isForfeit = false;
            TransitionTo(SimulationState.Results);
        }

        /// <summary>
        /// Handles a failed physics boundary. Race sessions freeze in-place and wait
        /// for explicit retry; qualifying has one attempt and aborts to Idle.
        /// </summary>
        public void HandlePhysicsFailure(Exception exception)
        {
            if (!CanTick)
                return;

            string reason = exception == null ? "Physics.Simulate failed." : exception.Message;
            _errorLogger?.Invoke(reason);
            _logger?.Error(reason, exception);

            if (_raceMode == RaceMode.Qualifying)
            {
                ClearSession();
                TransitionTo(SimulationState.Idle);
                LifecycleErrorRaised?.Invoke(new LifecycleErrorRaised(reason, ContentErrorType.Shared));
                return;
            }

            // A GO candidate has not completed physics. Restore the countdown authority
            // so retry cannot silently skip its final tick.
            if (_state == SimulationState.Countdown && _goPending)
            {
                _countdownRemainingTicks = 1;
                _goPending = false;
            }
            _retryHold = true;
        }

        /// <summary>Alias kept explicit for physics adapters that use the exception terminology.</summary>
        public void HandlePhysicsException(Exception exception) => HandlePhysicsFailure(exception);

        /// <summary>Implementation of the existing gate seam.</summary>
        public virtual bool TryTransition(SimulationState state)
        {
            if (state == _state)
                return true;
            if (!_allowUnrestrictedTransitions && !IsLegalTransition(_state, state))
                return false;

            TransitionTo(state);
            return true;
        }

        private static bool IsLegalTransition(SimulationState from, SimulationState to)
        {
            switch (from)
            {
                case SimulationState.Idle:
                    return to == SimulationState.Loading;
                case SimulationState.Loading:
                    return to == SimulationState.Idle || to == SimulationState.Countdown || to == SimulationState.Racing;
                case SimulationState.Countdown:
                    return to == SimulationState.Racing || to == SimulationState.Paused || to == SimulationState.Idle;
                case SimulationState.Racing:
                    return to == SimulationState.Paused || to == SimulationState.Finished ||
                           to == SimulationState.Results || to == SimulationState.Loading || to == SimulationState.Idle;
                case SimulationState.Paused:
                    return to == SimulationState.Countdown || to == SimulationState.Racing ||
                           to == SimulationState.Results || to == SimulationState.Idle;
                case SimulationState.Finished:
                    return to == SimulationState.Results || to == SimulationState.Idle;
                case SimulationState.Results:
                    return to == SimulationState.Idle || to == SimulationState.Loading;
                default:
                    return false;
            }
        }

        private void TransitionTo(SimulationState state)
        {
            SimulationState previous = _state;
            _state = state;
            StateChanged?.Invoke(new SimulationStateChanged(previous, state));
        }

        private void ClearSession()
        {
            _raceMode = RaceMode.Race;
            _gridAssignment = null;
            _countdownRemainingTicks = 0;
            _isGridLocked = false;
            _goPending = false;
            _retryHold = false;
            _unloadRequested = false;
            _terminalSnapshot = null;
            _resolvedFinishOrder = null;
            _resultKind = ResultKind.Race;
            _resolutionComplete = false;
            _playerFinishTime = 0f;
            _terminalPresentationRequest = false;
            _isForfeit = false;
            _forfeitLapCount = 0;
            _raceTimeAtForfeit = 0f;
        }
    }

    /// <summary>
    /// Pre-physics boundary step: consumes the gameplay pause edge and the pending
    /// performance-pause flag exactly once, then decrements the countdown when in
    /// Countdown (GDD step 4 "Pause consumption and Countdown decrement", Story 004).
    /// When a pause is consumed the context halts the spine immediately (steps 4-14
    /// do not execute on the interrupting tick, ADR-0001).
    /// </summary>
    public sealed class CountdownStep : ISimulationPipelineStep
    {
        /// <summary>
        /// Canonical position of the pause consumption and countdown decrement in the
        /// 14-step spine (ADR-0001: "Pause consumption and Countdown decrement" is step 4,
        /// 0-based index 3 — after TickStartSnapshot at index 2, before Tire/Fuel pre-step
        /// at index 4).
        /// </summary>
        public const int SpineIndex = 3;

        private readonly SimulationStateMachine _machine;

        public CountdownStep(SimulationStateMachine machine)
        {
            _machine = machine ?? throw new ArgumentNullException(nameof(machine));
        }

        /// <summary>
        /// Consumes a pause edge / performance flag first (transitions to Paused and halts
        /// the spine), otherwise decrements the countdown once per pre-physics tick.
        /// </summary>
        public void Execute(SimulationTickContext context)
        {
            bool pauseEdge = context.PauseEdge;
            bool performancePause = _machine.PendingPerformancePause;
            if (pauseEdge || performancePause)
            {
                _machine.PendingPerformancePause = false; // consumed exactly once
                SimulationState source = _machine.State;
                _machine.EnterPaused(source);
                context.PauseBoundaryReached = true;
                return;
            }

            _machine.ProcessCountdownTick();
        }
    }

    /// <summary>Post-physics GO trigger; keep this step thin.</summary>
    public sealed class GoStep : ISimulationPipelineStep
    {
        /// <summary>Immediately after PhysicsSimulateStep and before snapshot publication.</summary>
        public const int SpineIndex = PhysicsSimulateStep.SpineIndex + 1;

        private readonly SimulationStateMachine _machine;

        public GoStep(SimulationStateMachine machine)
        {
            _machine = machine ?? throw new ArgumentNullException(nameof(machine));
        }

        /// <summary>Completes the post-physics GO boundary and releases grid lock.</summary>
        public void Execute(SimulationTickContext context)
        {
            _machine.CompletePhysicsTick(context);
        }
    }

    /// <summary>
    /// GDD step 10: invokes the RSM evaluation seam over the post-physics CarStates and
    /// records <see cref="SimulationTickContext.PendingFinish"/> when a finish or
    /// retirement is detected. RSM never writes SimulationState directly (ADR-0018).
    /// </summary>
    public sealed class RsmEvaluationStep : ISimulationPipelineStep
    {
        /// <summary>Canonical position after PitStopSystem (index 9) and before RSM consume (index 10).</summary>
        public const int SpineIndex = 9;

        private readonly IRaceSessionManagerEvaluate _rsm;
        private readonly SimulationStateMachine _machine;

        public RsmEvaluationStep(IRaceSessionManagerEvaluate rsm, SimulationStateMachine machine)
        {
            _rsm = rsm ?? throw new ArgumentNullException(nameof(rsm));
            _machine = machine ?? throw new ArgumentNullException(nameof(machine));
        }

        /// <inheritdoc />
        public void Execute(SimulationTickContext context)
        {
            // The RSM evaluates laps/positions/finish from the post-physics CarStates. A
            // finish condition can only be detected during Racing (final lap / retirement);
            // the countdown and post-resolution states never produce a finish signal. The
            // GO boundary tick (which transitions Countdown -> Racing in GoStep at index 7)
            // is excluded: "the following tick starts in Racing" (ADR-0001) — the RSM has no
            // racing distance to evaluate on the boundary tick itself.
            if (_machine.State != SimulationState.Racing || context.IsGoTick ||
                context.PostTickCarState == null)
                return;
            context.PendingFinish = _rsm.Evaluate(context.PostTickCarState);
        }
    }

    /// <summary>
    /// GDD step 11: consumes RSM outputs before publication. On a pending finish it freezes
    /// the PostFinishSnapshot from the post-physics readout, passes it once to RSM's
    /// FinishOrderResolver, applies <c>TransitionRequest(Finished)</c>, and freezes the
    /// resolved order. No PhysX, Fuel, Tire, Pit, collision, or tactical AI runs after
    /// finish (ADR-0001). Duplicate finish detections are ignored — resolution runs once.
    /// </summary>
    public sealed class RsmConsumeStep : ISimulationPipelineStep
    {
        /// <summary>Canonical position immediately after RSM evaluation (GDD step 11).</summary>
        public const int SpineIndex = 10;

        private readonly SimulationStateMachine _machine;
        private readonly IFinishOrderResolver _resolver;

        public RsmConsumeStep(SimulationStateMachine machine, IFinishOrderResolver resolver)
        {
            _machine = machine ?? throw new ArgumentNullException(nameof(machine));
            _resolver = resolver ?? throw new ArgumentNullException(nameof(resolver));
        }

        /// <inheritdoc />
        public void Execute(SimulationTickContext context)
        {
            FinishDetected? pending = context.PendingFinish;
            if (!pending.HasValue)
                return;

            // Defensive depth: only a Racing tick can consume a finish (the evaluation step
            // already gates on Racing; this guard also protects direct-step unit usage).
            if (_machine.State != SimulationState.Racing)
                return;

            // Duplicate detection: the machine rejects ApplyFinish outside Racing, so a
            // second finish signal on a later tick cannot re-resolve (AC-4.8 edge case).
            FinishDetected detected = pending.Value;
            PostFinishSnapshot snapshot = new PostFinishSnapshot(
                context.PostTickCarState,
                context.PostTickFuelState,
                context.PostTickTireState,
                new RsmState(
                    eventCount: 0,
                    resultKind: detected.ResultKind,
                    resolutionComplete: true,
                    playerFinishTime: detected.PlayerFinishTime,
                    terminalPresentationRequest: true),
                SimulationState.Finished,
                resultClassification: null,
                simulationStepCount: context.NextSimulationStepCount,
                activeRaceStepCount: context.NextActiveRaceStepCount,
                raceTime: context.NextActiveRaceStepCount * SimulationTickContext.FIXED_DT,
                raceMode: _machine.RaceMode,
                playerClassification: detected.PlayerClassification);

            ResolvedFinishOrder resolved = _resolver.Resolve(snapshot);
            context.TerminalSnapshot = snapshot;
            context.ResolvedFinishOrder = resolved;
            _machine.ApplyFinish(snapshot, resolved);
        }
    }

    /// <summary>
    /// GDD step 13: AI reads the published snapshot only when the state has a future active
    /// tick (Countdown, Racing). In Finished/Results (and Idle/Loading/Paused) AI evaluation
    /// is skipped and stale cached input is cleared — AI never runs after a finish result is
    /// resolved (AC-4.8j). The cached-AI clearing seam is observable via
    /// <see cref="SimulationTickContext.CachedAiInput"/>.
    /// </summary>
    public sealed class AiSkipStep : ISimulationPipelineStep
    {
        /// <summary>Canonical position immediately after snapshot publication (GDD step 13).</summary>
        public const int SpineIndex = 12;

        private readonly SimulationStateMachine _machine;

        public AiSkipStep(SimulationStateMachine machine)
        {
            _machine = machine ?? throw new ArgumentNullException(nameof(machine));
        }

        /// <inheritdoc />
        public void Execute(SimulationTickContext context)
        {
            // Active states delegate AI evaluation to the AI Rival epic (produces the cache
            // at this step). Non-ticking states must never carry stale AI input forward.
            if (_machine.State != SimulationState.Countdown &&
                _machine.State != SimulationState.Racing)
                context.CachedAiInput = Array.Empty<AIInput>();
        }
    }
}
