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

        /// <summary>Raised after an accepted lifecycle transition.</summary>
        public event Action<SimulationStateChanged> StateChanged;

        /// <summary>Raised once for each accepted start or racing retry reload.</summary>
        public event Action<ContentLoadRequest> ContentLoadRequested;

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
        /// Exits the internal retry hold. Countdown failures restart only the 300-tick
        /// countdown. Racing failures reload the current race and await fresh readiness.
        /// </summary>
        public void RequestRetry()
        {
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
        }
    }

    /// <summary>Pre-physics countdown trigger; keep this step thin.</summary>
    public sealed class CountdownStep : ISimulationPipelineStep
    {
        /// <summary>
        /// Canonical position of the countdown decrement in the 14-step spine (ADR-0001:
        /// "Pause consumption and Countdown decrement" is step 4, 0-based index 3 — after
        /// TickStartSnapshot at index 2, before Tire/Fuel pre-step at index 4).
        /// </summary>
        public const int SpineIndex = 3;

        private readonly SimulationStateMachine _machine;

        public CountdownStep(SimulationStateMachine machine)
        {
            _machine = machine ?? throw new ArgumentNullException(nameof(machine));
        }

        /// <summary>Decrements the countdown once per pre-physics tick (SpineIndex 3).</summary>
        public void Execute(SimulationTickContext context)
        {
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
}
