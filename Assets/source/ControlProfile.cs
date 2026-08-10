using System;
using System.Collections.Generic;

namespace Overdrive.Input
{
    /// <summary>Identifies a control-profile field that failed validation (AC-68).</summary>
    public enum ProfileWarningKind
    {
        /// <summary>The stick dead-zone pair is invalid (<c>inner ≥ outer</c>, out of range, or non-finite).</summary>
        StickDeadZoneInvalid,

        /// <summary>The trigger threshold is invalid (out of <c>[0, 1)</c> or non-finite). Input-owned, never player-editable.</summary>
        TriggerThresholdInvalid,

        /// <summary>An EMA alpha is outside <c>[0, 1]</c> or non-finite. The <see cref="Channel"/> identifies the channel.</summary>
        EmaAlphaInvalid
    }

    /// <summary>A named validation warning for one invalid control-profile field (AC-68).</summary>
    public readonly struct ProfileWarning
    {
        /// <summary>Creates a warning.</summary>
        /// <param name="kind">The invalid field category.</param>
        /// <param name="channel">The affected channel for alpha warnings; empty for stick/trigger.</param>
        /// <param name="offendingValue">The persisted value that failed validation.</param>
        public ProfileWarning(ProfileWarningKind kind, string channel, float offendingValue)
        {
            Kind = kind;
            Channel = channel;
            OffendingValue = offendingValue;
        }

        /// <summary>The invalid field category.</summary>
        public ProfileWarningKind Kind { get; }

        /// <summary>The affected channel for alpha warnings (Accelerate/Brake/Steer); empty otherwise.</summary>
        public string Channel { get; }

        /// <summary>The persisted value that failed validation.</summary>
        public float OffendingValue { get; }
    }

    /// <summary>
    /// The data-driven input tuning values that Settings may configure (AC-50/AC-11). Stick dead-zone and
    /// EMA alphas are player-configurable; <see cref="TriggerInner"/> is Input-owned tuning (control manifest
    /// line 44) that is validated against a loaded value but never exposed to the player. Every field is
    /// validated per-field on load with fallback to the approved default and one named warning per invalid
    /// field (AC-68).
    /// Example: <c>ControlProfile sanitized = ControlProfile.Sanitize(loaded, out var warnings);</c>
    /// </summary>
    public readonly struct ControlProfile
    {
        /// <summary>Creates a control profile.</summary>
        /// <param name="stickInner">Radial stick inner threshold.</param>
        /// <param name="stickOuter">Radial stick outer threshold.</param>
        /// <param name="triggerInner">Axial trigger inner threshold (Input-owned tuning).</param>
        /// <param name="accelerateAlpha">Accelerate EMA alpha.</param>
        /// <param name="brakeAlpha">Brake EMA alpha.</param>
        /// <param name="steerAlpha">Steer EMA alpha.</param>
        public ControlProfile(
            float stickInner,
            float stickOuter,
            float triggerInner,
            float accelerateAlpha,
            float brakeAlpha,
            float steerAlpha)
        {
            StickInner = stickInner;
            StickOuter = stickOuter;
            TriggerInner = triggerInner;
            AccelerateAlpha = accelerateAlpha;
            BrakeAlpha = brakeAlpha;
            SteerAlpha = steerAlpha;
        }

        /// <summary>Radial stick inner threshold (GDD default 0.15).</summary>
        public float StickInner { get; }

        /// <summary>Radial stick outer threshold (GDD default 0.95).</summary>
        public float StickOuter { get; }

        /// <summary>Axial trigger inner threshold (Input-owned tuning, GDD default 0.05).</summary>
        public float TriggerInner { get; }

        /// <summary>Accelerate EMA alpha (GDD default 0.3).</summary>
        public float AccelerateAlpha { get; }

        /// <summary>Brake EMA alpha (GDD default 0.3).</summary>
        public float BrakeAlpha { get; }

        /// <summary>Steer EMA alpha (GDD default 0.5).</summary>
        public float SteerAlpha { get; }

        /// <summary>The approved default profile (GDD values, matching the module defaults).</summary>
        public static ControlProfile Default { get; } = new ControlProfile(
            DeadZoneNormalizer.StickInnerThreshold,
            DeadZoneNormalizer.StickOuterThreshold,
            DeadZoneNormalizer.TriggerInnerThreshold,
            EmaBrakePriority.DefaultAccelerateAlpha,
            EmaBrakePriority.DefaultBrakeAlpha,
            EmaBrakePriority.DefaultSteerAlpha);

        /// <summary>
        /// Validates a loaded profile per-field (AC-68): invalid fields fall back to their approved default
        /// and produce one named warning each. A loaded profile may carry a trigger value even though the
        /// player never edits it (control manifest line 44) — the field is still validated per GDD:109.
        /// </summary>
        /// <param name="input">The loaded profile to validate.</param>
        /// <param name="warnings">The named warnings for each invalid field (at most one per field per load).</param>
        /// <returns>A sanitized profile with every invalid field replaced by its approved default.</returns>
        public static ControlProfile Sanitize(ControlProfile input, out ProfileWarning[] warnings)
        {
            List<ProfileWarning> list = new List<ProfileWarning>();

            float stickInner = input.StickInner;
            float stickOuter = input.StickOuter;
            if (IsNonFinite(stickInner) || IsNonFinite(stickOuter) || stickInner < 0f || stickOuter > 1f || stickInner >= stickOuter)
            {
                stickInner = Default.StickInner;
                stickOuter = Default.StickOuter;
                list.Add(new ProfileWarning(ProfileWarningKind.StickDeadZoneInvalid, string.Empty, input.StickInner));
            }

            float triggerInner = input.TriggerInner;
            if (IsNonFinite(triggerInner) || triggerInner < 0f || triggerInner >= 1f)
            {
                triggerInner = Default.TriggerInner;
                list.Add(new ProfileWarning(ProfileWarningKind.TriggerThresholdInvalid, string.Empty, input.TriggerInner));
            }

            float accelerateAlpha = SanitizeAlpha(input.AccelerateAlpha, Default.AccelerateAlpha, "Accelerate", list);
            float brakeAlpha = SanitizeAlpha(input.BrakeAlpha, Default.BrakeAlpha, "Brake", list);
            float steerAlpha = SanitizeAlpha(input.SteerAlpha, Default.SteerAlpha, "Steer", list);

            warnings = list.ToArray();
            return new ControlProfile(stickInner, stickOuter, triggerInner, accelerateAlpha, brakeAlpha, steerAlpha);
        }

        private static float SanitizeAlpha(float value, float fallback, string channel, List<ProfileWarning> list)
        {
            if (IsNonFinite(value) || value < 0f || value > 1f)
            {
                list.Add(new ProfileWarning(ProfileWarningKind.EmaAlphaInvalid, channel, value));
                return fallback;
            }

            return value;
        }

        private static bool IsNonFinite(float value) => float.IsNaN(value) || float.IsInfinity(value);
    }
}
