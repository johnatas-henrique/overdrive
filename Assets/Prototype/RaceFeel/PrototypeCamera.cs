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

        [Header("Speed Feel")]
        [SerializeField] float baseFov = 62f;        // FOV at standstill
        [SerializeField] float maxFov = 88f;         // FOV at top speed (speed FOV, ADR-0010)

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

            // Rigid follow (no smoothing): the car pose is already interpolated.
            Vector3 camPos = target.position + target.TransformDirection(offset);
            transform.position = camPos;

            // Look-ahead: aim at a point ahead of the car along its motion.
            var car = target.GetComponent<ArcadeCar>();
            float speedRatio = car != null
                ? Mathf.Clamp01(car.CurrentSpeedKmh / maxSpeedKmh)
                : 0f;
            Vector3 lookTarget = target.position + target.forward * (lookAheadMax * speedRatio);

            transform.rotation = Quaternion.LookRotation(
                lookTarget - camPos, Vector3.up);

            // Speed FOV (ADR-0010 pattern): widening the field of view with
            // speed makes peripheral objects stream past faster. This is the
            // single strongest speed cue in arcade racing; without it 320 km/h
            // reads as ~100 km/h on a featureless track (observed in playtest).
            var cam = GetComponent<Camera>();
            cam.fieldOfView = Mathf.Lerp(baseFov, maxFov, speedRatio);
        }
    }
}
