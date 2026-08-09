using System;

namespace Overdrive.Input
{
    /// <summary>
    /// Pure C# per-channel EMA (exponential moving average) filter with brake priority
    /// and input sanitization. One tick = one <see cref="Process"/> call. Executes once per
    /// 60 Hz simulation tick (ADR-0001), never per render frame.
    /// Example: <c>var processor = new EmaBrakePriority(); var o = processor.Process(1f, 0f, -0.5f);</c>
    /// </summary>
    public sealed class EmaBrakePriority
    {
        /// <summary>Default Accelerate EMA alpha (GDD).</summary>
        public const float DefaultAccelerateAlpha = 0.3f;

        /// <summary>Default Brake EMA alpha (GDD).</summary>
        public const float DefaultBrakeAlpha = 0.3f;

        /// <summary>Default Steer EMA alpha (GDD).</summary>
        public const float DefaultSteerAlpha = 0.5f;

        private readonly float _accelerateAlpha;
        private readonly float _brakeAlpha;
        private readonly float _steerAlpha;

        private float _acceleratePrev;
        private float _brakePrev;
        private float _steerPrev;

        /// <summary>
        /// Creates the processor with the given per-channel alphas. Alphas default to the GDD
        /// values (0.3/0.3/0.5); Story 008 (Settings) passes control-profile alphas instead —
        /// the recurrence itself never hardcodes alphas beyond these defaults.
        /// </summary>
        public EmaBrakePriority(float accelerateAlpha = DefaultAccelerateAlpha,
            float brakeAlpha = DefaultBrakeAlpha,
            float steerAlpha = DefaultSteerAlpha)
        {
            _accelerateAlpha = accelerateAlpha;
            _brakeAlpha = brakeAlpha;
            _steerAlpha = steerAlpha;
        }

        /// <summary>
        /// Reinitializes all EMA previous-output state to zero.
        /// </summary>
        public void Reset()
        {
            _acceleratePrev = 0f;
            _brakePrev = 0f;
            _steerPrev = 0f;
        }

        /// <summary>
        /// Reinitializes EMA previous-output state from the given post-dead-zone channel values.
        /// Used on active-scheme change (Story 005, AC-23/AC-39) and on UI→Gameplay resume
        /// (Story 006, AC-41a): no filtered value carries from the prior scheme/context. Values are
        /// sanitized for consistency with <see cref="Process"/>.
        /// </summary>
        public void InitializeFromPostDeadZone(float accelerate, float brake, float steer)
        {
            _acceleratePrev = Sanitize(accelerate);
            _brakePrev = Sanitize(brake);
            _steerPrev = Sanitize(steer);
        }

        /// <summary>
        /// Processes one simulation tick: sanitizes each channel (NaN/Infinity → 0.0f, values
        /// outside [-1.0, 1.0] clamped), advances the EMA recurrence for Brake and Steer, then
        /// applies brake priority to Accelerate — when raw Brake (post dead-zone) is above zero,
        /// accelerateOut is 0.0 and the Accelerate EMA state is frozen at its last pre-brake
        /// value, resuming from that frozen value once raw Brake returns to zero.
        /// </summary>
        public EmaOutput Process(float rawAccelerate, float rawBrake, float rawSteer)
        {
            // Sanitization BEFORE the EMA recurrence (AC-71, ADR-0005:135-142).
            float accelerate = Sanitize(rawAccelerate);
            float brake = Sanitize(rawBrake);
            float steer = Sanitize(rawSteer);

            _brakePrev = _brakeAlpha * brake + (1f - _brakeAlpha) * _brakePrev;
            _steerPrev = _steerAlpha * steer + (1f - _steerAlpha) * _steerPrev;

            float accelerateOut;
            if (brake > 0f)
            {
                // Brake priority: accelerateOut = 0; Accelerate EMA state is frozen
                // (not advanced) at its pre-brake value until raw Brake returns to 0.
                accelerateOut = 0f;
            }
            else
            {
                _acceleratePrev = _accelerateAlpha * accelerate + (1f - _accelerateAlpha) * _acceleratePrev;
                accelerateOut = _acceleratePrev;
            }

            return new EmaOutput(accelerateOut, _brakePrev, _steerPrev);
        }

        /// <summary>
        /// Sanitizes a raw channel before the EMA recurrence: NaN/Infinity become 0.0f and
        /// values outside the legal [-1.0, 1.0] range are clamped (TR-input-012). Also used by the
        /// tick processor to sanitize the SimulationInput rawXxxPostDeadZone fields.
        /// </summary>
        public static float Sanitize(float value)
        {
            if (float.IsNaN(value) || float.IsInfinity(value))
            {
                return 0f;
            }

            return Math.Clamp(value, -1f, 1f);
        }
    }

    /// <summary>
    /// The per-tick output of the input processor: the EMA-filtered brake and steer plus the
    /// brake-priority-corrected accelerate. Immutable value type; no heap allocation per tick.
    /// </summary>
    public readonly struct EmaOutput
    {
        /// <summary>Filtered accelerate output; zeroed while brake priority is active.</summary>
        public readonly float Accelerate;

        /// <summary>Filtered brake output.</summary>
        public readonly float Brake;

        /// <summary>Filtered steer output (-1..1).</summary>
        public readonly float Steer;

        /// <summary>Creates the per-tick output with the given filtered channel values.</summary>
        public EmaOutput(float accelerate, float brake, float steer)
        {
            Accelerate = accelerate;
            Brake = brake;
            Steer = steer;
        }
    }
}
