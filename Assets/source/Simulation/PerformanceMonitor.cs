using System;

namespace Overdrive.Simulation
{
    /// <summary>Performance protection state published via <see cref="PerformanceMonitor.PerformanceStatusChanged"/>.</summary>
    public enum PerformanceStatus
    {
        /// <summary>Sustained degradation below 30 FPS for 3s detected (ADR-0001).</summary>
        Reduced,

        /// <summary>Sustained recovery at or above 30 FPS for 3s detected (ADR-0001).</summary>
        Restored
    }

    /// <summary>
    /// Producer-only performance signal payload. Simulation owns the signal; consumer behavior
    /// (HUD warning ADR-0014, VFX/camera degradation ADR-0010) is defined in the consuming ADRs.
    /// </summary>
    public readonly struct PerformanceSignal
    {
        /// <summary>Reduced or Restored transition that occurred.</summary>
        public readonly PerformanceStatus Status;

        /// <summary>The display FPS sampled from the frame feed during the sustained window.</summary>
        public readonly float ObservedFps;

        public PerformanceSignal(PerformanceStatus status, float observedFps)
        {
            Status = status;
            ObservedFps = observedFps;
        }
    }

    /// <summary>
    /// Manual-simulation performance protection monitor (ADR-0001 PerformanceReduced Signal).
    /// Runs in Update() and measures display FPS only while SimulationState is Countdown or
    /// Racing. Emits <see cref="PerformanceStatusChanged"/> exactly once per transition
    /// (Reduced, Restored) and requests a performance pause via the injected <paramref name="requestPause"/>
    /// seam when FPS stays below 15 for 3s after reduction. It never mutates SimulationState
    /// directly, never changes FIXED_DT or Time.timeScale (producer-only; the tick's Step 3
    /// consumes the pending pause flag — Story 001 spine).
    /// </summary>
    public sealed class PerformanceMonitor
    {
        /// <summary>Minimum sustained FPS before degradation is reported.</summary>
        public const float ReducedThresholdFps = 30f;

        /// <summary>Minimum sustained FPS before a protection pause is requested.</summary>
        public const float PauseThresholdFps = 15f;

        /// <summary>Sustained window (seconds) that triggers an emission or pause request.</summary>
        public const float ThresholdSeconds = 3f;

        /// <summary>Frame delta above which the frame is slower than 30 FPS (below the reduced threshold).</summary>
        public const float Below30DeltaSeconds = 1f / ReducedThresholdFps;

        /// <summary>Frame delta above which the frame is slower than 15 FPS (below the pause threshold).</summary>
        public const float Below15DeltaSeconds = 1f / PauseThresholdFps;

        private readonly Action _requestPause;

        private float _below30Timer;
        private float _below15Timer;
        private float _recoveryTimer;
        private bool _reduced;
        private bool _pauseRequested;
        private SimulationState _lastState;

        /// <summary>Raised exactly once per performance transition (Reduced, Restored).</summary>
        public event Action<PerformanceSignal> PerformanceStatusChanged;

        /// <summary>
        /// Creates a performance monitor.
        /// </summary>
        /// <param name="requestPause">
        /// Injectable pause seam — the caller wires it to set the simulation's pending
        /// performance pause (e.g. <c>SimulationStateMachine.PendingPerformancePause = true</c>).
        /// The monitor never references the state machine concretely.
        /// </param>
        public PerformanceMonitor(Action requestPause)
        {
            _requestPause = requestPause ?? throw new ArgumentNullException(nameof(requestPause));
            _lastState = SimulationState.Idle;
        }

        /// <summary>True while sustained degradation is active (below 30 FPS 3s and not yet restored).</summary>
        public bool IsReduced => _reduced;

        /// <summary>
        /// True when this monitor requested a performance pause that has not yet been resolved
        /// (cleared by restore, state-change reset, or resume at/above 30 FPS).
        /// </summary>
        public bool IsPauseRequested => _pauseRequested;

        /// <summary>Current below-30 sustained timer in seconds (exposed for tests).</summary>
        public float Below30TimerSeconds => _below30Timer;

        /// <summary>Current below-15 sustained timer in seconds (exposed for tests).</summary>
        public float Below15TimerSeconds => _below15Timer;

        /// <summary>Current recovery timer in seconds (exposed for tests).</summary>
        public float RecoveryTimerSeconds => _recoveryTimer;

        /// <summary>
        /// Per-frame evaluation. Called once per Update() by the driver with the SAME frame
        /// delta the accumulator uses (single-capture semantics, ADR-0001). No-op outside
        /// Countdown/Racing and on invalid or non-finite frame deltas.
        /// </summary>
        /// <param name="frameDelta">Unscaled render-frame delta in seconds.</param>
        /// <param name="state">Current simulation lifecycle state.</param>
        public void Evaluate(float frameDelta, SimulationState state)
        {
            // AC-7.6a edge: invalid/non-positive delta produces no event and no timer accumulation.
            if (frameDelta <= 0f || !float.IsFinite(frameDelta))
                return;

            if (state != SimulationState.Countdown && state != SimulationState.Racing)
                return;

            float fps = 1f / frameDelta;

            // Threshold comparison uses the frame delta against the delta limit, not the
            // divided FPS, so an exactly-30 FPS frame (frameDelta == 1/30) never rounds to
            // 30.000002 and mis-qualifies. A frame slower than 1/30s is below 30 FPS.
            if (frameDelta > Below30DeltaSeconds)
            {
                _below30Timer += frameDelta;
                if (_below30Timer >= ThresholdSeconds && !_reduced)
                    EmitReduced(fps);
            }
            else
            {
                _below30Timer = 0f;
            }

            if (!_reduced)
                return;

            if (frameDelta > Below15DeltaSeconds)
            {
                _below15Timer += frameDelta;
                if (_below15Timer >= ThresholdSeconds && !_pauseRequested)
                {
                    _requestPause();
                    _pauseRequested = true;
                }
            }
            else
            {
                _below15Timer = 0f;
            }

            if (frameDelta <= Below30DeltaSeconds)
            {
                _recoveryTimer += frameDelta;
                if (_recoveryTimer >= ThresholdSeconds)
                    EmitRestored(fps);
            }
            else
            {
                _recoveryTimer = 0f;
            }
        }

        /// <summary>
        /// State-change hook. The driver calls this when the lifecycle state changes. Resets all
        /// timers, the reduced state, and the pause request when entering Idle, Loading, Finished,
        /// or Results (AC-7.7b/7.7f). Paused entry PRESERVES timers when this monitor requested the
        /// pause (AC-7.7c); otherwise resets (manual/focus pause, AC-7.6a).
        /// </summary>
        /// <param name="state">The new lifecycle state.</param>
        public void OnStateChanged(SimulationState state)
        {
            bool transitioned = state != _lastState;
            _lastState = state;

            if (!transitioned)
                return;

            switch (state)
            {
                case SimulationState.Idle:
                case SimulationState.Loading:
                case SimulationState.Finished:
                case SimulationState.Results:
                    ResetAll();
                    break;

                case SimulationState.Paused:
                    // Performance-caused pause preserves the timers for resume (AC-7.7c);
                    // any other Paused entry (manual, focus) starts clean (AC-7.6a).
                    if (!_pauseRequested)
                        ResetAll();
                    break;
            }
        }

        /// <summary>
        /// Resume hook. The driver calls this when the session resumes from Paused to
        /// Countdown/Racing. At/above 30 FPS clears all timers and the reduced state immediately
        /// (AC-7.7a); below 30 persists so protection can re-trigger (AC-7.7c).
        /// </summary>
        /// <param name="fpsAtResume">Display FPS measured on the resume frame.</param>
        public void OnResume(float frameDeltaAtResume)
        {
            // Invalid resume deltas (zero, negative, NaN, infinity) cannot decide the
            // clear/persist path — no-op (mirrors the Evaluate guard; the driver also guards,
            // but the public seam must be safe on its own).
            if (frameDeltaAtResume <= 0f || !float.IsFinite(frameDeltaAtResume))
                return;

            // The pause request was delivered and the session is back in an active state — the
            // request is always cleared so protection can re-arm (AC-7.7c "so protection can
            // re-trigger"). Timers/reduced persist below 30 FPS (AC-7.7c) or clear at/above
            // 30 FPS (AC-7.7a).
            _pauseRequested = false;
            if (frameDeltaAtResume <= Below30DeltaSeconds)
                ResetAll();
        }

        private void EmitReduced(float observedFps)
        {
            _reduced = true;
            _below15Timer = 0f; // below-15 timer starts at 0 when reduced emits (ADR-0001)
            PerformanceStatusChanged?.Invoke(new PerformanceSignal(PerformanceStatus.Reduced, observedFps));
        }

        private void EmitRestored(float observedFps)
        {
            ResetAll();
            PerformanceStatusChanged?.Invoke(new PerformanceSignal(PerformanceStatus.Restored, observedFps));
        }

        private void ResetAll()
        {
            _below30Timer = 0f;
            _below15Timer = 0f;
            _recoveryTimer = 0f;
            _reduced = false;
            _pauseRequested = false;
        }
    }
}
