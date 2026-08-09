using UnityEngine;

namespace Overdrive.Input
{
    /// <summary>
    /// Pure, stateless dead-zone normalization for gamepad stick and trigger axes.
    /// Example: <c>Vector2 steer = DeadZoneNormalizer.NormalizeStick(rawStick);</c>
    /// Keyboard input never passes through this module (keyboard maps directly to -1/0/1).
    /// </summary>
    public static class DeadZoneNormalizer
    {
        /// <summary>Radial stick inner threshold: magnitudes at or below this map to zero.</summary>
        public const float StickInnerThreshold = 0.15f;

        /// <summary>Radial stick outer threshold: magnitudes at or above this map to unit magnitude.</summary>
        public const float StickOuterThreshold = 0.95f;

        /// <summary>Axial trigger inner threshold: values at or below this map to zero.</summary>
        public const float TriggerInnerThreshold = 0.05f;

        /// <summary>
        /// Normalizes a raw stick vector with a radial profile. A magnitude at or below
        /// <paramref name="inner"/> yields zero; a magnitude at or above
        /// <paramref name="outer"/> yields a unit vector in the raw direction; in between,
        /// the magnitude is remapped linearly while the direction is preserved.
        /// The thresholds default to <see cref="StickInnerThreshold"/>/<see cref="StickOuterThreshold"/>;
        /// Story 008 (Settings) passes control-profile values instead.
        /// </summary>
        public static Vector2 NormalizeStick(Vector2 raw, float inner = StickInnerThreshold, float outer = StickOuterThreshold)
        {
            float magnitude = raw.magnitude;
            if (magnitude <= inner)
            {
                return Vector2.zero;
            }

            float remapped = Mathf.Clamp01((magnitude - inner) / (outer - inner));
            return raw.normalized * remapped;
        }

        /// <summary>
        /// Normalizes a raw trigger value with an axial profile. Values at or below
        /// <paramref name="inner"/> yield zero; above it, the value is remapped so that
        /// the inner threshold maps to zero and one maps to one. The threshold defaults to
        /// <see cref="TriggerInnerThreshold"/>; Story 008 passes the Input-owned tuning value instead.
        /// </summary>
        public static float NormalizeTrigger(float raw, float inner = TriggerInnerThreshold)
        {
            if (raw <= inner)
            {
                return 0f;
            }

            return Mathf.Clamp01((raw - inner) / (1f - inner));
        }
    }
}
