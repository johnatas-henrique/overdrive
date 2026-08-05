// PROTOTYPE - NOT FOR PRODUCTION
// Question: Is the arcade grip (ADR-0002) fun and responsive enough to sustain the 30s loop?
// Date: 2026-08-01

using UnityEngine;

namespace RaceFeel
{
    /// <summary>
    /// Simple chase camera for the prototype: follows the car from behind.
    ///
    /// NO Lerp/Slerp: the car's visual transform is already interpolated between
    /// physics ticks (ADR-0001 pattern), so the camera reads that smooth pose
    /// directly — smoothing here caused frame-rate-dependent jitter.
    ///
    /// Life comes from look-ahead: the camera aims at a point ahead of the car
    /// along its velocity, proportional to speed. Deterministic, no jitter, and
    /// it reads speed better than a rigid follow.
    /// </summary>
    public class PrototypeCamera : MonoBehaviour
    {
        [SerializeField] Transform target;
        [SerializeField] Vector3 offset = new Vector3(0f, 2.6f, -8f);
        [SerializeField] float lookAheadMax = 12f;   // meters ahead at full speed
        [SerializeField] float maxSpeedKmh = 324f;   // for look-ahead scaling
        [SerializeField] float minimumVelocityDirectionMps = 1.5f;
        [SerializeField] float lowSpeedDirectionSharpness = 8f;
        [SerializeField] float highSpeedDirectionSharpness = 18f;

        [Header("Speed Feel")]
        [SerializeField] float baseFov = 62f;        // FOV at standstill
        [SerializeField] float maxFov = 88f;         // FOV at top speed (speed FOV, ADR-0010)

        Vector3 _filteredMotionDirection;

        void Start()
        {
            if (target == null)
            {
                var car = FindFirstObjectByType<ArcadeCar>();
                if (car != null) target = car.transform;
            }
        }

        void LateUpdate()
        {
            if (target == null) return;

            // DRIFT-VISIBLE FOLLOW (2026-08-03): the camera follows the car's
            // HORIZONTAL VELOCITY direction, not the heading (target.forward).
            // When the car drifts, heading and velocity diverge: the old code
            // attached the camera to the heading (TransformDirection(offset) +
            // target.forward look-ahead), so the camera rotated WITH the drift
            // and the slide was invisible. Following the velocity keeps the
            // camera on the trajectory line, so the car's sideways yaw is
            // visible on screen (Top Gear / Horizon Chase behavior).
            var car = target.GetComponent<ArcadeCar>();
            float speedRatio = car != null
                ? Mathf.Clamp01(car.CurrentSpeedKmh / maxSpeedKmh)
                : 0f;

            Vector3 velocityDir = GetVelocityDirection();
            if (velocityDir == Vector3.zero)
            {
                // Below the velocity threshold (slow/stopped): fall back to
                // the heading. The car CANNOT turn in place (minTurnRadius
                // guard: maxYaw = v / minTurnRadius -> 0 at standstill, and
                // dead stop zeroes velocity below 0.1 m/s), so the heading is
                // stable at rest and the chase camera stays behind the car.
                // A held direction would freeze the camera during slow turning
                // maneuvers (reverse + steer) and let the car leave the center
                // of the frame (user correction 2026-08-04).
                velocityDir = target.forward;
            }

            Vector3 motionDirection = FilterMotionDirection(velocityDir, speedRatio);

            // Rigid follow along the motion line (no smoothing - pose already
            // interpolated, ADR-0001 pattern). offset.z is behind, offset.y up.
            Vector3 camPos = target.position + motionDirection * offset.z + Vector3.up * offset.y;
            transform.position = camPos;

            // Look-ahead along the MOTION line: aim where the car is going,
            // so the drift yaw (heading) is visible relative to the trajectory.
            Vector3 lookTarget = target.position + motionDirection * (lookAheadMax * speedRatio);

            transform.rotation = Quaternion.LookRotation(
                lookTarget - camPos, Vector3.up);

            // Speed FOV (ADR-0010 pattern): widening the field of view with
            // speed makes peripheral objects stream past faster. This is the
            // single strongest speed cue in arcade racing; without it 320 km/h
            // reads as ~100 km/h on a featureless track (observed in playtest).
            var cam = GetComponent<Camera>();
            cam.fieldOfView = Mathf.Lerp(baseFov, maxFov, speedRatio);
        }

        /// <summary>
        /// Horizontal direction the car is actually moving (XZ projection of
        /// the Rigidbody velocity). Zero when the car is (nearly) stationary.
        /// </summary>
        Vector3 GetVelocityDirection()
        {
            var rb = target != null ? target.GetComponent<Rigidbody>() : null;
            if (rb == null) return Vector3.zero;
            Vector3 hv = new Vector3(rb.linearVelocity.x, 0f, rb.linearVelocity.z);
            return hv.sqrMagnitude > minimumVelocityDirectionMps * minimumVelocityDirectionMps
                ? hv.normalized
                : Vector3.zero;
        }

        Vector3 FilterMotionDirection(Vector3 desiredDirection, float speedRatio)
        {
            if (_filteredMotionDirection == Vector3.zero)
            {
                _filteredMotionDirection = desiredDirection;
                return _filteredMotionDirection;
            }

            float sharpness = Mathf.Lerp(
                lowSpeedDirectionSharpness,
                highSpeedDirectionSharpness,
                speedRatio);
            float blend = 1f - Mathf.Exp(-sharpness * Time.deltaTime);
            _filteredMotionDirection = Vector3.Slerp(
                _filteredMotionDirection,
                desiredDirection,
                blend).normalized;
            return _filteredMotionDirection;
        }
    }
}
