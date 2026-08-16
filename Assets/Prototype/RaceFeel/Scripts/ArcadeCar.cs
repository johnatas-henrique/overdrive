// PROTOTYPE - NOT FOR PRODUCTION
// Question: Is the arcade grip (ADR-0002) fun and responsive enough to sustain the 30s loop?
// Date: 2026-08-01

using UnityEngine;

namespace RaceFeel
{
    /// <summary>
    /// Arcade grip car for the prototype.
    ///
    /// Arcade steering model: yaw rate is set DIRECTLY on the Rigidbody
    /// (angularVelocity), not accumulated through torque. Torque-based steering
    /// carries inertia and feels like a simulator; direct yaw rate responds
    /// instantly and is the standard arcade approach.
    ///
    /// Steering capacity (playtest 2026-08-02): ONE state, ONE capacity curve
    /// that falls with speed. No track measurement, no lookahead, no state
    /// switching. The car turns the most at low speed and less at top speed,
    /// Horizon Chase / Top Gear style.
    ///
    /// Reverse: holding brake at near-zero forward speed applies reverse drive.
    ///
    /// Speed cap: a hard per-race limit (panel input) so curves can be tested
    /// at a fixed speed without feathering the throttle - floor it and the car
    /// holds exactly the cap.
    ///
    /// Render interpolation (ADR-0001 pattern): physics runs at fixed 60 Hz
    /// ticks; the visual transform is interpolated between the previous and
    /// current physics pose in LateUpdate so the camera never sees stepping.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    public class ArcadeCar : MonoBehaviour
    {
        [Header("Tuning")]
        [SerializeField] float enginePower = 40f;       // m/s^2 traction-limited accel at launch (arcade; now the power-curve ceiling)
        [SerializeField] float powerPerMass = 1012f;    // m^2/s^3: P/m of the 1989 Honda RA109E (511 kW / 505 kg) - force = P/v
        [SerializeField] float dragCoeff = 0f;         // 1/m: quadratic aero drag a = K*v^2 (Option A real-engine presets; 0 = linear damping only)
        [SerializeField] float brakePower = 35f;        // m/s^2 braking deceleration
        [SerializeField] float reversePower = 14f;      // m/s^2 reverse drive (reaches 50 km/h in ~1s)
        [SerializeField] float maxSpeed = 90f;          // top speed m/s (~324 km/h)
        [SerializeField] float maxReverseSpeed = 13.9f; // reverse cap m/s = 50 km/h (unstick convenience)

        // 1-STATE ARCADE STEERING (playtest 2026-08-02): the car has ONE
        // steering capacity curve. The max yaw rate is the minimum of three
        // limits, evaluated every tick - no states, no hysteresis:
        //   1. Steering ceiling: lerp(maxSteerLow -> maxSteerHigh) across the
        //      speed falloff. Max turn rate at low speed, minimum at top
        //      speed. Lifting off the throttle drops speed, which RAISES the
        //      ceiling - more steering at lower speed = the SMGP tuck-in.
        //   2. Min turn radius guard: yaw <= v / minTurnRadius. A real car
        //      has a minimum turning circle; this prevents pivoting in place
        //      (the "spins on its own axis" bug) while still allowing full
        //      lock at low speed.
        //   3. Grip ceiling: yaw <= a_max / v - smooth understeer above the
        //      lateral grip limit (car never slides sideways past its grip).
        [SerializeField] float maxSteerLow = 3.0f;      // rad/s: max yaw rate at low speed
        [SerializeField] float maxSteerHigh = 1.4f;     // rad/s: max yaw rate at top speed
        [SerializeField] float liftOffSteerBonus = 0.6f; // rad/s: extra yaw authority while NOT accelerating (SMGP tuck-in)
        [SerializeField] float minTurnRadius = 8f;      // m: minimum turning circle (never pivot in place)
        [SerializeField] float falloffStartKmh = 60f;   // km/h: speed where the ceiling starts to fall
        [SerializeField] float falloffEndKmh = 324f;    // km/h: speed where the ceiling reaches its minimum
        [SerializeField] float falloffShape = 1f;       // 1 = linear falloff; <1 drops early; >1 drops late
        [SerializeField] float speedCapKmh = 0f;        // 0 = no cap; else hard speed limit for curve testing

        [Header("Drift (Option B, playtest 2026-08-02)")]
        [SerializeField] float driftFactor = 1.15f;     // heading may ask F x grip when ABOVE the curve's speed limit
        [SerializeField] float driftLookahead = 40f;    // m: corner radius sample distance ahead

        [Header("Grip Stack (ADR-0002)")]
        [SerializeField] float gripBase = 1.0f;
        [SerializeField] float surfaceGrip = 1.0f;      // asphalt reference; grass multiplies this
        [SerializeField] float tireGrip = 1.0f;
        [SerializeField] float controlThreshold = 1.0f;
        [SerializeField] float maxLateralG = 20.0f;     // max centripetal accel in g (grip ceiling; arcade)
        [SerializeField] float liftOffGripBonus = 3.0f;  // g: FIXED extra grip while NOT accelerating (tuck-in)
                                                         // User decision 2026-08-02: fixed g, not a % of grip -
                                                         // a percentage would give BETTER cars more tuck-in
                                                         // (better cars have more g to multiply). Fixed value
                                                         // gives worse cars the same absolute tool, so an
                                                         // excellent driver in a weak car can fight - the car
                                                         // must not decide the race before it starts.
        [SerializeField] float driftSpeedLoss = 2.5f;    // m/s^2 speed lost while sliding (drift costs speed)
        [SerializeField] float gripAlignRate = 8.0f;     // rad/s: how fast velocity rotates toward heading (grip response)

        [Header("Off-track (grass, playtest 2026-08-02)")]
        [SerializeField] float grassGrip = 0.55f;       // surface multiplier on grass (grip stack)
        [SerializeField] float grassDecel = 4f;         // m/s^2 constant decel while on grass
        [SerializeField] float grassTraction = 0.25f;   // engine power fraction on grass (reduced drive)

        [Header("Coasting (playtest 2026-08-02)")]
        [SerializeField] float coastDecel = 3.5f;        // m/s^2 constant decel with NO pedals (engine-braking feel)
        [SerializeField] float deadStopMps = 0.1f;       // m/s: below this with no pedals, velocity is zeroed (car actually stops)

        // ARCADE STEERING MODEL (2-state, playtest 2026-08-02): fixed turning
        // RADIUS per state, not fixed yaw rate. yaw = speed / radius, so
        // holding the button traces the same geometric line at any speed.
        //
        // The previous model blended 4 radius sources (measured-ahead sweep,
        // speed-scaled fallback, hysteresis hold, blend curve) every tick -
        // the active radius oscillated, so the car "sometimes turned too much,
        // sometimes too little" (user report). The 2-state model removes the
        // sources: straight = one constant radius; corner = the track radius,
        // locked on entry, released on exit.
        //
        // Grip: 20 g is physically absurd on purpose - the arcade ceiling.
        // At 324 km/h it allows radius v^2/g = 41 m; at 180 km/h, 12.8 m.
        // Unreachable measured radii (OSM joint kinks, La Source at 300+) are
        // ignored - the car understeers through them and the player brakes.

        [Header("EMA (ADR-0005)")]
        [SerializeField] float throttleEmaAlpha = 0.35f;
        [SerializeField] float steerEmaAlpha = 0.50f; // keyboard: near-instant response (was 0.30)

        [Header("Runtime State (read-only)")]
        [SerializeField] float currentSpeedKmh = 0f;
        [SerializeField] bool isSliding = false;
        [SerializeField] float slipRatio = 0f;
        [SerializeField] bool gridLocked = false; // countdown: car cannot move/accelerate

        Rigidbody _rb;
        PrototypeTrack _track;
        float _throttleEma;
        float _brakeEma;
        float _steerEma;
        float _targetYawRate;  // last commanded yaw (panel readout)
        float _lastThrottle;   // last raw throttle input (lift-off state)

        // Render interpolation state (physics pose at tick boundaries).
        Vector3 _prevPhysPos;
        Vector3 _currPhysPos;
        Quaternion _prevPhysRot;
        Quaternion _currPhysRot;

        public float CurrentSpeedKmh => currentSpeedKmh;
        public bool IsSliding => isSliding;
        public float SlipRatio => slipRatio;
        public float TargetYawRate => _targetYawRate;

        /// <summary>
        /// Smoothed steering input consumed by presentation-only vehicle visuals.
        /// Example: a front-wheel visual turns by VisualSteerInput * maxVisualAngle.
        /// </summary>
        public float VisualSteerInput => _steerEma;

        // Tuning surface for the runtime panel (settable, applies next tick).
        public float MaxSteerLow { get => maxSteerLow; set => maxSteerLow = value; }
        public float MaxSteerHigh { get => maxSteerHigh; set => maxSteerHigh = value; }
        public float LiftOffSteerBonus { get => liftOffSteerBonus; set => liftOffSteerBonus = value; }
        public float MinTurnRadius { get => minTurnRadius; set => minTurnRadius = value; }
        public float FalloffStartKmh { get => falloffStartKmh; set => falloffStartKmh = value; }
        public float FalloffEndKmh { get => falloffEndKmh; set => falloffEndKmh = value; }
        public float FalloffShape { get => falloffShape; set => falloffShape = value; }
        public float MaxLateralG { get => maxLateralG; set => maxLateralG = value; }
        public float LiftOffGripBonus { get => liftOffGripBonus; set => liftOffGripBonus = value; }
        public float GrassGrip { get => grassGrip; set => grassGrip = value; }
        public float GrassDecel { get => grassDecel; set => grassDecel = value; }
        public float GrassTraction { get => grassTraction; set => grassTraction = value; }
        public bool OnGrass { get; private set; } // any wheel outside the asphalt edge

        /// <summary>
        /// Grid lock (GDD #1400): while true the car cannot move, accelerate,
        /// or turn - the controller holds it until GO. The EMA keeps
        /// accumulating while locked, so the exact control state applies
        /// immediately at GO (perfect-start needs throttle held BEFORE the
        /// lights go out).
        /// </summary>
        public bool GridLocked { get => gridLocked; set => gridLocked = value; }
        public float SpeedCapKmh { get => speedCapKmh; set => speedCapKmh = value; }
        public float CoastDecel { get => coastDecel; set => coastDecel = value; }
        public float DeadStopMps { get => deadStopMps; set => deadStopMps = value; }
        public float EnginePower { get => enginePower; set => enginePower = value; }
        public float PowerPerMass { get => powerPerMass; set => powerPerMass = value; }
        public float DragCoeff { get => dragCoeff; set => dragCoeff = value; }
        public float BrakePower { get => brakePower; set => brakePower = value; }
        public float MaxSpeedMps { get => maxSpeed; set => maxSpeed = value; }
        public float ControlThreshold { get => controlThreshold; set => controlThreshold = value; }
        public float DriftFactor { get => driftFactor; set => driftFactor = value; }
        public float DriftLookahead { get => driftLookahead; set => driftLookahead = value; }
        public float DriftHeadBoost { get => driftHeadBoost; set => driftHeadBoost = value; }
        public float LinearDamping { get => _rb != null ? _rb.linearDamping : 0.28f; set { if (_rb != null) _rb.linearDamping = value; } }

        /// <summary>
        /// Theoretical max yaw at the current speed WITH the throttle held
        /// (no lift-off bonus). For the tuning panel: shows the ceiling
        /// without needing to corner.
        /// </summary>
        public float MaxYawThrottle => ComputeMaxYaw(CurrentFwdAbs, false);

        /// <summary>
        /// Theoretical max yaw at the current speed with the throttle
        /// released (lift-off bonus applied). Shows the tuck-in effect
        /// without needing to corner.
        /// </summary>
        public float MaxYawLiftOff => ComputeMaxYaw(CurrentFwdAbs, true);

        /// <summary>Smallest radius at current speed with throttle held (v / maxYaw).</summary>
        public float MinRadiusThrottle => RadiusFromYaw(MaxYawThrottle);

        /// <summary>Smallest radius at current speed with throttle released.</summary>
        public float MinRadiusLiftOff => RadiusFromYaw(MaxYawLiftOff);

        float CurrentFwdAbs
        {
            get
            {
                if (_rb == null) return 0f;
                return Mathf.Abs(Vector3.Dot(_rb.linearVelocity, transform.forward));
            }
        }

        float RadiusFromYaw(float yaw)
        {
            float fwdAbs = CurrentFwdAbs;
            return yaw > 0.001f && fwdAbs > 0.5f ? fwdAbs / yaw : 0f;
        }

        /// <summary>
        /// Drift factor (Option B, user-approved 2026-08-02): while
        /// ACCELERATING above the curve's grip limit (v > sqrt(a*R_ahead)),
        /// the car asks up to driftFactor x grip. Lifting off returns F = 1
        /// immediately (tuck-in). The 12% transition band makes the drift
        /// grow smoothly instead of snapping on. Shared by the heading
        /// (ComputeMaxYaw) and the velocity rotation (SetInput) so both ask
        /// the same F - the 2026-08-02 fix: F on the heading alone made the
        /// car understeer off the line ("sai de frente") because the
        /// velocity followed only the real grip.
        ///
        /// HEAD/VELOCITY SPLIT (2026-08-02): the velocity follows the
        /// boosted grip (F = driftFactor, so the trajectory can close), but
        /// the HEADING asks a bit more (F x driftHeadBoost). The gap between
        /// them is the slip angle - the visible rear-out drift. With equal
        /// Fs the slip stays zero (heading and velocity rotate at the same
        /// rate) and there is no drift at all. Validated by simulation:
        /// F_vel=1.15 + F_head=1.30 -> ~25 deg slip, corner completed
        /// on-track at 245 km/h (Zakspeed, oval 70m).
        /// </summary>
        [SerializeField] float driftHeadBoost = 1.40f; // heading asks F x this vs the velocity (slip gap)

        float ComputeDriftFactor(bool liftOff)
        {
            if (liftOff || _track == null) return 1f;
            Vector3 hv = new Vector3(_rb.linearVelocity.x, 0f, _rb.linearVelocity.z);
            float hSpeed = hv.magnitude;
            if (hSpeed <= 0.5f) return 1f;
            float R = _track.GetCornerRadiusAhead(transform.position, driftLookahead);
            if (R >= 9000f) return 1f; // straight ahead: no drift
            float vLimit = Mathf.Sqrt(effectiveGripMaxAccel() * R);
            float band = Mathf.InverseLerp(vLimit, vLimit * 1.12f, hSpeed);
            return Mathf.Lerp(1f, driftFactor, band);
        }

        float effectiveGripMaxAccel()
        {
            float g = Mathf.Clamp(gripBase * surfaceGrip * tireGrip, 0.20f, 1.20f);
            return g * maxLateralG * 9.81f;
        }

        /// <summary>
        /// Full steering model: the maximum yaw rate the car may use at
        /// speed fwdAbs, optionally with the lift-off bonus applied.
        /// maxYaw = min(steeringCeiling(v), v / minTurnRadius, gripCeiling)
        /// </summary>
        float ComputeMaxYaw(float fwdAbs, bool liftOff)
        {
            // CORNERING ability belongs to the Grip stat ONLY (user decision
            // 2026-08-02): controlThreshold (Stability) no longer multiplies
            // the grip stack here. A low-stability car keeps full cornering
            // capacity but slides easily (SetInput's slip behavior).
            float effectiveGrip = Mathf.Clamp(
                gripBase * surfaceGrip * tireGrip,
                0.20f, 1.20f);
            float maxLateralAccel = effectiveGrip * maxLateralG * 9.81f;
            // LIFT-OFF GRIP BONUS (fixed g, user decision 2026-08-02): while
            // NOT accelerating, the car gains liftOffGripBonus g of lateral
            // capacity (SMGP tuck-in - the circle of adhesion releases the
            // grip that longitudinal force was consuming). FIXED g, not a
            // percentage: a % would scale the tuck-in with car quality;
            // fixed g is the same absolute tool for every car, so an
            // excellent driver in a weak car can fight.
            if (liftOff) maxLateralAccel += liftOffGripBonus * 9.81f;

            // 1. Steering ceiling falls with speed (Horizon Chase / Top Gear
            //    model): full lock at low speed, minimum at top speed.
            float speedKmh = fwdAbs * 3.6f;
            float t = Mathf.InverseLerp(falloffStartKmh, falloffEndKmh, speedKmh);
            float eased = Mathf.Pow(t, falloffShape);
            float steerCeiling = Mathf.Lerp(maxSteerLow, maxSteerHigh, eased);

            // 2. Min turning circle: never tighter than v / minTurnRadius.
            //    Lift-off bonus (SMGP tuck-in) applied to the steering
            //    ceiling BEFORE the grip ceiling (option A, user-approved
            //    2026-08-02): lifting off helps only where steering is the
            //    limiter (medium speed). At high speed the grip ceiling
            //    cuts first, so the car never asks for more yaw than the
            //    chassis can deliver - it tucks in as speed falls
            //    (gripCeiling = a_max / v rises). The old order (bonus
            //    AFTER the grip min) produced artificial lift-off oversteer.
            float steerBonus = liftOff ? liftOffSteerBonus : 0f;
            float circleCeiling = fwdAbs / Mathf.Max(minTurnRadius, 1f);
            float maxYaw = Mathf.Min(steerCeiling + steerBonus, circleCeiling);

            // 3. Grip ceiling: yaw <= a_max / v. Above it, understeer.
            //    DRIFT FACTOR (Option B, user-approved 2026-08-02): while
            //    ACCELERATING above the curve's grip limit (v > sqrt(a*R)),
            //    the heading may ask up to driftFactor x grip - the
            //    velocity follows only the real grip, so the rear slides
            //    out (legal drift). Below the limit F = 1 (clean line).
            //    Lifting off returns F = 1 immediately (tuck-in). The 12%
            //    transition band makes the drift grow smoothly instead of
            //    snapping on. hSpeed (not fwdAbs) in the denominator:
            //    fwdAbs shrinks as the slip angle grows, which would
            //    RAISE the ceiling mid-slide - the positive feedback that
            //    spun the car out on lift-off (observed 2026-08-02).
            Vector3 hv = new Vector3(_rb.linearVelocity.x, 0f, _rb.linearVelocity.z);
            float hSpeed = hv.magnitude;
            float gripSpeed = hSpeed > 0.5f ? hSpeed : fwdAbs;
            float drift = ComputeDriftFactor(liftOff);
            if (gripSpeed > 0.5f)
            {
                // HEADING asks drift x driftHeadBoost while drifting (the
                // velocity follows only drift - see SetInput). The gap is
                // the slip angle. Below the limit drift=1 and the boost is
                // OFF (headF = drift), so a clean line stays clean - the
                // boost must not create a slip gap when the car is not
                // drifting (2026-08-02 fix).
                float headF = drift > 1f ? drift * driftHeadBoost : drift;
                maxYaw = Mathf.Min(maxYaw, maxLateralAccel * headF / gripSpeed);
            }

            return maxYaw;
        }

        void Awake()
        {
            _rb = GetComponent<Rigidbody>();
            _track = FindFirstObjectByType<PrototypeTrack>();
            _rb.mass = 505f;
            _rb.linearDamping = 0.28f;
            _rb.angularDamping = 0.3f;
            // Arcade: car never rolls over or pitches.
            _rb.constraints = RigidbodyConstraints.FreezeRotationX | RigidbodyConstraints.FreezeRotationZ;

            // Continuous collision: prevents tunneling through thin walls at
            // high speed (observed: car passed through the track limits).
            _rb.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;

            // No Rigidbody interpolation: render interpolation is done manually
            // (ADR-0001 pattern) so the camera gets a smooth pose in LateUpdate.
            _rb.interpolation = RigidbodyInterpolation.None;

            // Zero-friction contact: the custom grip model owns lateral behavior.
            var col = GetComponent<Collider>();
            if (col != null) col.material = RaceFeel.PrototypeTrack.ZeroFriction();
        }

        /// <summary>Apply input from the controller. Values are raw -1..1.
        /// dt is the fixed tick length (1/60) - Time.fixedDeltaTime is 0.02
        /// (50 Hz) in this project, so it must NOT be used here (the velocity
        /// rotation would turn 20% faster than the heading and the drift
        /// slip would never grow - observed 2026-08-02).</summary>
        public void SetInput(float throttle, float brake, float steer, float dt = 1f / 60f)
        {
            _lastThrottle = throttle;

            // EMA smoothing (ADR-0005): brake freezes throttle EMA while active.
            _throttleEma = brake > 0f
                ? 0f
                : Mathf.Lerp(_throttleEma, throttle, throttleEmaAlpha);
            _brakeEma = Mathf.Lerp(_brakeEma, brake, throttleEmaAlpha);
            _steerEma = Mathf.Lerp(_steerEma, steer, steerEmaAlpha);

            // GRID LOCK (countdown, GDD #1400): while locked, zero any
            // velocity/rotation the car might have and apply NO forces.
            // The EMA updates above keep accumulating so the held input
            // state is ready at GO. Vertical velocity (gravity drop) is
            // preserved.
            if (gridLocked)
            {
                Vector3 v = _rb.linearVelocity;
                _rb.linearVelocity = new Vector3(0f, v.y, 0f);
                _rb.angularVelocity = Vector3.zero;
                _targetYawRate = 0f;
                currentSpeedKmh = 0f;
                isSliding = false;
                slipRatio = 0f;
                return;
            }

            Vector3 forward = transform.forward;
            Vector3 velocity = _rb.linearVelocity;
            float forwardSpeed = Vector3.Dot(velocity, forward);

            // OFF-TRACK detection (playtest 2026-08-02): the car sits on
            // grass when its lateral offset from the centerline exceeds the
            // asphalt half-width. Grass costs grip (surface multiplier) and
            // speed (constant decel + hard cap) - the runoff penalty that
            // lets the player make mistakes instead of hitting a wall.
            OnGrass = false;
            if (_track != null)
            {
                float lateral = _track.GetLateralOffset(transform.position);
                OnGrass = Mathf.Abs(lateral) > _track.HalfWidth;
            }

            // Effective grip (ADR-0002): clamp(base x surface x tire, 0.20, 1.20)
            // WITHOUT controlThreshold - cornering capacity is the Grip stat's
            // job. Stability (controlThreshold) acts on the SLIP behavior
            // below: slide threshold, recovery rate, and slide speed loss.
            // User decision 2026-08-02 (separation of concerns): a low-
            // stability car corners as well as its grip allows but slides
            // early, recovers slowly, and loses more speed while sliding.
            float effectiveGrip = Mathf.Clamp(
                gripBase * surfaceGrip * (OnGrass ? grassGrip : 1f) * tireGrip,
                0.20f, 1.20f);

            // GRIP = rotate the HORIZONTAL velocity toward the heading,
            // preserving speed. Only the horizontal component is rotated:
            //  - Vertical velocity (spawn drop, gravity) stays untouched,
            //    so the car does not land already rolling forward after
            //    the spawn drop (~6 km/h observed 2026-08-02).
            //  - The rotation target is -forward while reversing, so
            //    reverse drives straight back instead of crabbing
            //    sideways (grip was pulling reverse velocity toward +forward).
            float vY = velocity.y;
            Vector3 horiz = new Vector3(velocity.x, 0f, velocity.z);
            float hSpeed = horiz.magnitude;
            if (hSpeed > 0.5f)
            {
                // How much centripetal accel the grip allows this tick.
                float maxCentripetal = effectiveGrip * maxLateralG * 9.81f;
                // DRIFT FACTOR (Option B) applied to the VELOCITY TOO
                // (2026-08-02 fix): the velocity follows drift x grip so the
                // trajectory can close while the heading asks drift x
                // driftHeadBoost - the gap is the slip angle (rear-out
                // drift). Before this fix F applied only to the heading and
                // the car understeered off the line ("sai de frente").
                float driftF = ComputeDriftFactor(throttle <= 0f);
                maxCentripetal *= driftF;
                // LIFT-OFF GRIP BONUS (fixed g) applied HERE TOO - the
                // velocity must be allowed to follow the extra yaw the
                // steering now requests (ComputeMaxYaw has the same bonus).
                // Without it the car would ask for more yaw than the
                // velocity can follow and slide harder (the old bug).
                if (throttle <= 0f) maxCentripetal += liftOffGripBonus * 9.81f;
                // Rotating velocity by angle a over dt yields centripetal a = speed * a / dt.
                // Max rotation per second = maxCentripetal / speed (rad/s).
                // STABILITY (controlThreshold) scales the recovery rate:
                // a low-stability car's velocity follows the heading more
                // slowly, so the slip angle grows - it slides easily.
                float maxRotateRate = Mathf.Min(gripAlignRate * controlThreshold, maxCentripetal / hSpeed);
                Vector3 heading = Vector3.Dot(horiz / hSpeed, forward) >= 0f ? forward : -forward;
                Vector3 rotated = Vector3.RotateTowards(
                    horiz / hSpeed, heading, maxRotateRate * dt, 1f);
                _rb.linearVelocity = new Vector3(rotated.x * hSpeed, vY, rotated.z * hSpeed);
            }

            // Slip detection for drift feedback (velocity vs heading angle).
            // STABILITY (controlThreshold): the slide threshold scales with
            // it - stability 1.0 slides at >0.25 slip (as before), stability
            // 0.2 slides at >0.05 (a small angle already loses grip).
            float headingDot = hSpeed > 0.5f
                ? Mathf.Clamp01(Vector3.Dot(_rb.linearVelocity.normalized, forward))
                : 1f;
            slipRatio = 1f - headingDot;
            float slideThreshold = 0.25f * Mathf.Max(controlThreshold, 0.2f);
            isSliding = slipRatio > slideThreshold;

            // 1-STATE ARCADE STEERING (user-approved model 2026-08-02):
            //   maxYaw = min(steeringCeiling(v), v / minTurnRadius, gripCeiling)
            // One expression, evaluated every tick. No track measurement.
            float forwardAbs = Mathf.Abs(forwardSpeed);
            float maxYaw = ComputeMaxYaw(forwardAbs, throttle <= 0f);

            // ARCADE REVERSE (2026-08-04): while reversing the car moves
            // along -forward, so the heading's left/right are opposite to
            // the motion's left/right. Invert the yaw sign so left input
            // turns the car left on screen (Top Gear / Horizon Chase);
            // simulator-style un-inverted steering was reported as a bug.
            float reverseSign = forwardSpeed < 0f ? -1f : 1f;
            _targetYawRate = _steerEma * maxYaw * reverseSign;
            Vector3 angVel = _rb.angularVelocity;
            angVel.y = _targetYawRate;
            _rb.angularVelocity = angVel;

            // Drift costs speed: while sliding, bleed speed so drifting is a
            // trade-off, not free. Scales with slip ratio (full slide = full loss).
            // STABILITY (controlThreshold): low-stability cars lose MORE speed
            // while sliding (driftSpeedLoss x (2 - stability)): stability 1.0
            // keeps the base 2.5, stability 0.2 loses up to 4.5 m/s^2.
            if (isSliding)
            {
                float slideLoss = driftSpeedLoss * (2f - controlThreshold);
                _rb.AddForce(-velocity.normalized * (slideLoss * slipRatio), ForceMode.Acceleration);
            }

            // Longitudinal: throttle forward, brake decelerates, then reverse.
            // POWER CURVE (F1 1989 base, 2026-08-02): force = min(traction, P/v).
            // A constant-force motor accelerates linearly to the cap ("no power
            // curve" - user report); a real engine delivers ~constant torque
            // at launch (traction-limited) and falls off with 1/v as speed
            // rises (P = F*v). The Honda RA109E: 511 kW / 505 kg = 1012 m^2/s^3.
            // On GRASS the engine applies only grassTraction of its force
            // (wheelspin - reduced drive), plus the grassDecel drag below, so
            // the car naturally settles at a low speed instead of being
            // hard-capped (the 80 km/h clamp was an abrupt artificial limit;
            // replaced by physics 2026-08-02).
            // Speed cap (panel input): with a cap set, floor the throttle and
            // the car accelerates to the cap and holds it exactly - curve
            // testing at a fixed speed without feathering the pedal.
            float capMps = speedCapKmh > 0f ? speedCapKmh / 3.6f : maxSpeed;
            const float capHysteresis = 0.5f; // m/s: avoid motor on/off chatter at the cap
            if (throttle > 0f && forwardSpeed < capMps - capHysteresis)
            {
                float v = Mathf.Max(forwardSpeed, 5f); // avoid div-by-zero at launch
                float accel = Mathf.Min(enginePower, powerPerMass / v);
                if (OnGrass) accel *= grassTraction;
                _rb.AddForce(forward * (_throttleEma * accel), ForceMode.Acceleration);
            }
            else if (brake > 0f && forwardSpeed > 0.5f)
            {
                // Moving forward + brake: decelerate.
                _rb.AddForce(-forward * (_brakeEma * brakePower), ForceMode.Acceleration);
            }
            else if (brake > 0f && forwardSpeed <= 0.5f && forwardSpeed > -maxReverseSpeed)
            {
                // Nearly stopped + brake held: reverse drive. Cap at 50 km/h
                // so a wall-stuck car can back out and re-approach (playtest).
                _rb.AddForce(-forward * (_brakeEma * reversePower), ForceMode.Acceleration);
            }

            // QUADRATIC AERO DRAG (Option A real-engine presets, 2026-08-02):
            // a = K*v^2 replaces the linear Rigidbody damping for the real
            // car presets (they set LinearDamping = 0 and K = P/m / vmax^3,
            // so the car lands exactly on its real top speed). Grows with
            // v^2 - the power curve's "dying top" is drag-limited, like a
            // real F1. Coasting with no pedals uses coastDecel below.
            if (dragCoeff > 0.001f)
            {
                Vector3 vDrag = _rb.linearVelocity;
                Vector3 hDrag = new Vector3(vDrag.x, 0f, vDrag.z);
                float v2 = hDrag.sqrMagnitude;
                if (v2 > 0.1f)
                    _rb.AddForce(-hDrag.normalized * (dragCoeff * v2), ForceMode.Acceleration);
            }

            // Coasting with NO pedals: constant decel (engine-braking feel)
            // instead of Rigidbody damping alone, which is asymptotic and
            // never actually stops the car (~3 km/h forever). Below
            // deadStopMps the horizontal velocity is zeroed outright.
            if (throttle <= 0f && brake <= 0f)
            {
                Vector3 v = _rb.linearVelocity;
                Vector3 h = new Vector3(v.x, 0f, v.z);
                if (h.magnitude < deadStopMps)
                {
                    _rb.linearVelocity = new Vector3(0f, v.y, 0f);
                    _targetYawRate = 0f;
                    Vector3 av = _rb.angularVelocity;
                    av.y = 0f;
                    _rb.angularVelocity = av;
                }
                else
                {
                    _rb.AddForce(-h.normalized * coastDecel, ForceMode.Acceleration);
                }
            }

            // GRASS penalty: constant decel while off-track (applies even
            // with the throttle held - grass drag beats the engine; engine
            // power itself is reduced to grassTraction above). The car
            // settles at whatever speed balances drive vs drag - no hard
            // cap.
            // EASE-OUT (playtest 2026-08-02): below 150 km/h the decel fades
            // to zero at 80 km/h (smoothstep). Without it, a car stopped on
            // grass cannot drive away - the constant decel ate the reduced
            // engine force ("impossible to leave the grass" - user report).
            if (OnGrass)
            {
                Vector3 v = _rb.linearVelocity;
                Vector3 h = new Vector3(v.x, 0f, v.z);
                if (h.magnitude > 0.1f)
                {
                    float speedKmh = h.magnitude * 3.6f;
                    float t = Mathf.InverseLerp(80f, 150f, speedKmh); // 0 below 80, 1 above 150
                    t = t * t * (3f - 2f * t); // smoothstep (ease at both ends)
                    _rb.AddForce(-h.normalized * grassDecel * t, ForceMode.Acceleration);
                }
            }

            currentSpeedKmh = _rb.linearVelocity.magnitude * 3.6f;
        }

        /// <summary>
        /// Called by the controller after each physics tick. Stores the physics
        /// pose so the render transform can be interpolated between ticks.
        /// </summary>
        public void OnPhysicsTick()
        {
            _prevPhysPos = _currPhysPos;
            _prevPhysRot = _currPhysRot;
            _currPhysPos = _rb.position;
            _currPhysRot = _rb.rotation;
        }

        /// <summary>
        /// Called in LateUpdate (render time) with the accumulator alpha.
        /// Moves the visual transform to the interpolated pose, so the camera
        /// (which reads the transform) sees smooth motion between 60 Hz ticks.
        /// </summary>
        public void SyncRenderTransform(float alpha)
        {
            transform.position = Vector3.Lerp(_prevPhysPos, _currPhysPos, alpha);
            transform.rotation = Quaternion.Slerp(_prevPhysRot, _currPhysRot, alpha);
        }

        /// <summary>Position the car at a spawn point and zero velocity.</summary>
        public void ResetTo(Vector3 position, Quaternion rotation)
        {
            _rb.position = position;
            _rb.rotation = rotation;
            _rb.linearVelocity = Vector3.zero;
            _rb.angularVelocity = Vector3.zero;
            _prevPhysPos = _currPhysPos = position;
            _prevPhysRot = _currPhysRot = rotation;
            transform.position = position;
            transform.rotation = rotation;
            _throttleEma = _brakeEma = _steerEma = 0f;
            _lastThrottle = 0f;
            currentSpeedKmh = 0f;
            isSliding = false;
            slipRatio = 0f;
            gridLocked = false; // ResetRace decides (controller sets it)
        }
    }
}
