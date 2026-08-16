// PROTOTYPE - NOT FOR PRODUCTION
// Question: Is the arcade grip (ADR-0002) fun and responsive enough to sustain the 30s loop?
// Date: 2026-08-01

using UnityEngine;
using UnityEngine.InputSystem;

namespace RaceFeel
{
    /// <summary>
    /// Orchestrates the prototype loop: countdown (3-2-1-GO) -> 2 complete laps -> finish.
    /// Reads input via the new Input System (Keyboard + gamepad), feeds ArcadeCar.
    /// </summary>
    public class RaceFeelController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] ArcadeCar car;
        [SerializeField] PrototypeTrack track;
        [SerializeField] MinimalHud hud;

        [Header("Loop")]
        [SerializeField] int totalLaps = 3;
        [SerializeField] float countdownSeconds = 3f;

        [Header("Timing Metrics")]
        [SerializeField] bool collectMetrics = true;

        public enum State { Countdown, Racing, Finished }

        State _state = State.Countdown;
        float _countdownRemaining;
        float _lapStartTime;
        float _raceStartTime;
        float _lastLapTime;
        float _bestLapTime = float.MaxValue;
        float _finishTime;
        int _lapsCompleted = 0;
        bool _lapCountingArmed = false; // set true after car leaves the spawn line
        // Finish-crossing detection (no trigger, no dead-zone): the finish
        // line is the plane through the first centerline point (the array
        // STARTS at the start/finish line - track-atlas source), perpendicular
        // to the track tangent. Track the sign of the car's projection onto
        // the tangent between physics ticks; a sign flip = a crossing.
        // Anti-double-count: only count if the car has TRAVELED >= MinLapDistance
        // since the last count. Distance traveled is accumulated per tick (a
        // 1.5 m dead-zone was bugged: at 310 km/h the car moves 1.43 m/tick,
        // crossing the whole line inside the dead-zone; and comparing crossing
        // POSITIONS fails because every lap crosses the line at the same
        // position - 2026-08-02).
        float _lastTickSide = float.NaN;
        float _distanceSinceLastCount;
        Vector3 _lastPhysicsPos;
        const float MinLapDistance = 30f; // m: traveled since last count

        // Manual accumulator (ADR-0001): the project runs SimulationMode.Script,
        // so the prototype must drive physics with explicit Physics.Simulate.
        const float FixedDt = 1f / 60f;
        float _accumulator = 0f;

        // Metrics
        float _frameTimeAccumulator;
        int _frameCount;
        float _maxFrameMs;
        float _p95FrameMs;
        readonly System.Collections.Generic.List<float> _frameTimes = new System.Collections.Generic.List<float>();

        public State CurrentState => _state;
        public float CountdownRemaining => _countdownRemaining;
        public int CurrentLap => Mathf.Min(_lapsCompleted, totalLaps); // 0-based display
        public int TotalLaps => totalLaps;
        public float LastLapTime => _lastLapTime;
        public float BestLapTime => _bestLapTime;
        public float FinishTime => _finishTime;
        public float CurrentLapTime =>
            _state == State.Racing ? Time.time - _lapStartTime : 0f;

        void Start()
        {
            // The prototype owns time: force a clean 1.0 scale. Editor play
            // sessions inherit the previous session's timeScale (observed:
            // automated tests left 0 behind, freezing the countdown at "3").
            Time.timeScale = 1f;

            // ADR-0001: the simulation must run under manual accumulator control.
            // The project default is FixedUpdate; the prototype forces Script mode
            // so Physics.Simulate calls in Update() are valid and deterministic.
            Physics.simulationMode = SimulationMode.Script;

            if (track == null) track = FindFirstObjectByType<PrototypeTrack>();
            if (car == null) car = FindFirstObjectByType<ArcadeCar>();
            if (hud == null) hud = FindFirstObjectByType<MinimalHud>();

            car.gameObject.tag = "Player";
            track.BuildTrack();
            ResetRace();
        }

        /// <summary>
        /// Full session reset used by the tuning panel after a track switch:
        /// rebuilds the active track, repositions the car, restarts countdown.
        /// </summary>
        public void ResetSession()
        {
            track.BuildTrack(); // no-op unless the variant changed
            ResetRace();
        }

        void ResetRace()
        {
            car.ResetTo(track.StartPosition, track.StartRotation);
            car.GridLocked = true; // countdown: car cannot move/accelerate until GO (GDD #1400)
            _state = State.Countdown;
            _countdownRemaining = countdownSeconds;
            _lapStartTime = 0f;
            _lastLapTime = 0f;
            _bestLapTime = float.MaxValue;
            _lapsCompleted = 0;
            _lapCountingArmed = false;
            _lastTickSide = float.NaN;
            _distanceSinceLastCount = 0f;
            _lastPhysicsPos = car.transform.position;
            _frameTimes.Clear();
            _frameCount = 0;
            _frameTimeAccumulator = 0f;
            _maxFrameMs = 0f;
            _p95FrameMs = 0f;
        }

        void Update()
        {
            // Quick restart: R resets the car to the grid and restarts the
            // countdown (playtest convenience).
            if (Keyboard.current != null && Keyboard.current.rKey.wasPressedThisFrame)
                ResetRace();

            if (collectMetrics)
            {
                float frameMs = Time.deltaTime * 1000f;
                _frameTimes.Add(frameMs);
                _frameTimeAccumulator += frameMs;
                _frameCount++;
                _maxFrameMs = Mathf.Max(_maxFrameMs, frameMs);
            }

            if (_state == State.Countdown)
            {
                _countdownRemaining -= Time.deltaTime;
                if (_countdownRemaining <= 0f)
                {
                    _state = State.Racing;
                    car.GridLocked = false; // GO: release the car (GDD #1400)
                    _raceStartTime = Time.time;
                    _lapStartTime = Time.time;
                    _countdownRemaining = 0f;
                    // Arm lap counting once the car moves away from the spawn line.
                    _lapCountingArmed = false;
                }
            }
            else if (_state == State.Racing)
            {
                // Arm when the car has left the spawn line area (10 m).
                if (!_lapCountingArmed)
                {
                    Vector3 spawnPos = track.StartPosition;
                    spawnPos.y = 0f;
                    Vector3 carPos = car.transform.position;
                    carPos.y = 0f;
                    if (Vector3.Distance(spawnPos, carPos) > 10f)
                        _lapCountingArmed = true;
                }

                // Finish detection: 2 laps completed.
                if (_lapsCompleted >= totalLaps)
                {
                    _finishTime = Time.time - _raceStartTime;
                    _state = State.Finished;
                }
            }

            // Manual accumulator (ADR-0001): each frame, sample input once and
            // advance physics by fixed ticks. Excess above 2x FixedDt is discarded.
            _accumulator += Time.deltaTime;
            if (_accumulator > 2f * FixedDt)
                _accumulator = 2f * FixedDt;
            while (_accumulator >= FixedDt)
            {
                ReadInputAndDrive();
                Physics.Simulate(FixedDt);
                car.OnPhysicsTick();
                DetectFinishCrossing();
                _accumulator -= FixedDt;
            }

            // Render interpolation (ADR-0001): place the car's visual transform at
            // the interpolated pose between the last two physics ticks HERE, in
            // Update, so any LateUpdate consumer (camera) always reads the smooth
            // pose. Syncing in LateUpdate raced the camera's own LateUpdate.
            float alpha = _accumulator / FixedDt;
            car.SyncRenderTransform(alpha);
        }

        /// <summary>
        /// Finish-line crossing detection by sign transition, no dead-zone.
        /// The finish line is the plane through the first centerline point
        /// (the array starts AT the start/finish line) perpendicular to the
        /// track tangent. The car crosses it exactly once per lap; the sign
        /// of its projection onto the tangent flips at the crossing.
        /// Anti-double-count: the car must have TRAVELED MinLapDistance since
        /// the last count. Distance is accumulated per tick from the physics
        /// positions - comparing crossing positions would fail because every
        /// lap crosses the line at the same position (2026-08-02).
        /// </summary>
        void DetectFinishCrossing()
        {
            if (_state != State.Racing) return;

            Vector3 pos = car.transform.position;
            _distanceSinceLastCount += Vector3.Distance(pos, _lastPhysicsPos);
            _lastPhysicsPos = pos;

            Vector3 linePos = track.FinishLinePosition;
            Vector3 lineDir = track.FinishLineDirection;
            float side = Vector3.Dot(pos - linePos, lineDir);

            if (!float.IsNaN(_lastTickSide) && _lastTickSide <= 0f && side > 0f)
            {
                if (_distanceSinceLastCount >= MinLapDistance)
                {
                    if (!_lapCountingArmed)
                    {
                        // First crossing right after GO: that is the race start,
                        // not a completed lap. Arm now; lap counting starts from
                        // the NEXT crossing (the completed first lap).
                        _lapCountingArmed = true;
                    }
                    else
                    {
                        // Completed one lap.
                        float now = Time.time;
                        _lastLapTime = now - _lapStartTime;
                        if (_lastLapTime < _bestLapTime) _bestLapTime = _lastLapTime;
                        _lapStartTime = now;
                        _lapsCompleted++;
                    }
                    _distanceSinceLastCount = 0f;
                }
            }

            _lastTickSide = side;
        }

        void ReadInputAndDrive()
        {
            var keyboard = Keyboard.current;
            var gamepad = Gamepad.current;

            float throttle = 0f;
            float brake = 0f;
            float steer = 0f;

            if (keyboard != null)
            {
                if (keyboard.wKey.isPressed || keyboard.upArrowKey.isPressed) throttle = 1f;
                if (keyboard.sKey.isPressed || keyboard.downArrowKey.isPressed) brake = 1f;
                float steerKb = 0f;
                if (keyboard.aKey.isPressed || keyboard.leftArrowKey.isPressed) steerKb -= 1f;
                if (keyboard.dKey.isPressed || keyboard.rightArrowKey.isPressed) steerKb += 1f;
                steer = steerKb;
            }

            if (gamepad != null)
            {
                throttle = Mathf.Max(throttle, gamepad.rightTrigger.ReadValue());
                brake = Mathf.Max(brake, gamepad.leftTrigger.ReadValue());
                steer += gamepad.leftStick.x.ReadValue();
                steer = Mathf.Clamp(steer, -1f, 1f);
            }

            car.SetInput(throttle, brake, steer, FixedDt);
        }

        public (float avg, float max, float p95) GetFrameMetrics()
        {
            if (_frameTimes.Count == 0) return (0f, 0f, 0f);
            var sorted = new System.Collections.Generic.List<float>(_frameTimes);
            sorted.Sort();
            int p95Index = Mathf.Clamp((int)(sorted.Count * 0.95f), 0, sorted.Count - 1);
            return (_frameTimeAccumulator / _frameCount, _maxFrameMs, sorted[p95Index]);
        }
    }
}
