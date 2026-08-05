using UnityEngine;

namespace RaceFeel
{
    /// <summary>
    /// Animates the Carrera prefab's visual wheels without affecting arcade physics.
    /// Example: attach it to PlayerCar alongside ArcadeCar.
    /// </summary>
    public sealed class CarreraVisualMotion : MonoBehaviour
    {
        [SerializeField, Min(0.01f)] float wheelRadius = 0.354f;
        [SerializeField, Range(0f, 45f)] float maximumSteerAngle = 28f;

        readonly Transform[] _frontSteerRoots = new Transform[2];
        readonly Transform[] _rollingRims = new Transform[4];
        readonly Quaternion[] _frontSteerRestRotations = new Quaternion[2];
        readonly Quaternion[] _rimRestRotations = new Quaternion[4];

        ArcadeCar _car;
        Rigidbody _body;
        float _rollDegrees;

        void Awake()
        {
            _car = GetComponent<ArcadeCar>();
            _body = GetComponent<Rigidbody>();
            if (_car == null || _body == null)
            {
                Debug.LogError(
                    "CarreraVisualMotion expected ArcadeCar and Rigidbody on PlayerCar.",
                    this);
                enabled = false;
            }
        }

        void Start()
        {
            // Wheel transforms are cached in Start, not Awake: the CARRERA
            // prefab (nested under CARRERA_Visual) can still be instantiating
            // when this object's Awake runs, so Find misses the wheels and
            // LateUpdate throws NRE every frame (observed 2026-08-05). Start
            // runs after every Awake, so the hierarchy is guaranteed complete.
            Transform carrera = transform.Find("CARRERA_Visual/CARRERA");
            if (carrera == null || !CacheWheelTransforms(carrera))
            {
                Debug.LogError(
                    "CarreraVisualMotion: wheel transforms not found under CARRERA_Visual/CARRERA — animation disabled.",
                    this);
                enabled = false;
            }
        }

        void LateUpdate()
        {
            ApplyFrontSteering();
            ApplyWheelRoll();
        }

        /// <summary>Cache the wheel transforms. Returns false if any is
        /// missing (the caller disables the script — a null entry throws
        /// NRE in every LateUpdate, observed 2026-08-05).</summary>
        bool CacheWheelTransforms(Transform carrera)
        {
            string[] steerPaths = { "brakes1", "brakes2" };
            string[] rimPaths =
                { "brakes1/rim1", "brakes2/rim2", "brakes003/rim003", "brakes004/rim004" };

            for (int index = 0; index < _frontSteerRoots.Length; index++)
            {
                _frontSteerRoots[index] = carrera.Find(steerPaths[index]);
                if (_frontSteerRoots[index] == null)
                {
                    Debug.LogError($"CarreraVisualMotion: front steer root not found: {steerPaths[index]}.", this);
                    return false;
                }
            }
            for (int index = 0; index < _rollingRims.Length; index++)
            {
                _rollingRims[index] = carrera.Find(rimPaths[index]);
                if (_rollingRims[index] == null)
                {
                    Debug.LogError($"CarreraVisualMotion: rolling rim not found: {rimPaths[index]}.", this);
                    return false;
                }
            }

            for (int index = 0; index < _frontSteerRoots.Length; index++)
                _frontSteerRestRotations[index] = _frontSteerRoots[index].localRotation;
            for (int index = 0; index < _rollingRims.Length; index++)
                _rimRestRotations[index] = _rollingRims[index].localRotation;
            return true;
        }

        void ApplyFrontSteering()
        {
            Quaternion steeringRotation = Quaternion.Euler(
                0f,
                _car.VisualSteerInput * maximumSteerAngle,
                0f);
            for (int index = 0; index < _frontSteerRoots.Length; index++)
                _frontSteerRoots[index].localRotation = _frontSteerRestRotations[index] * steeringRotation;
        }

        void ApplyWheelRoll()
        {
            float forwardSpeedMps = Vector3.Dot(_body.linearVelocity, transform.forward);
            float circumference = 2f * Mathf.PI * wheelRadius;
            _rollDegrees = Mathf.Repeat(
                _rollDegrees + forwardSpeedMps / circumference * 360f * Time.deltaTime,
                360f);
            Quaternion rollRotation = Quaternion.AngleAxis(_rollDegrees, Vector3.right);
            for (int index = 0; index < _rollingRims.Length; index++)
                _rollingRims[index].localRotation = _rimRestRotations[index] * rollRotation;
        }
    }
}
