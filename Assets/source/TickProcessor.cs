using System;
using UnityEngine;

namespace Overdrive.Input
{
    /// <summary>Identifies a raw input channel for warning reporting.</summary>
    public enum InputChannel
    {
        /// <summary>The accelerate (throttle) channel.</summary>
        Accelerate,

        /// <summary>The brake channel.</summary>
        Brake,

        /// <summary>The steer channel.</summary>
        Steer
    }

    /// <summary>
    /// Pure, deterministic per-tick simulation-input processor. Runs the canonical order once per
    /// 60 Hz simulation tick (ADR-0001): validation → dead-zone → sanitization → EMA → brake priority
    /// → SimulationInput assembly. Holds the EMA state across ticks.
    /// Example: <c>SimulationInput input = processor.ProcessTick(sample, controller.HasPendingPauseEdge());</c>
    /// </summary>
    public sealed class TickProcessor
    {
        /// <summary>Default radial stick inner threshold (GDD/Story 002).</summary>
        public const float DefaultStickInner = DeadZoneNormalizer.StickInnerThreshold;

        /// <summary>Default radial stick outer threshold (GDD/Story 002).</summary>
        public const float DefaultStickOuter = DeadZoneNormalizer.StickOuterThreshold;

        /// <summary>Default axial trigger inner threshold (GDD/Story 002).</summary>
        public const float DefaultTriggerInner = DeadZoneNormalizer.TriggerInnerThreshold;

        /// <summary>Warning rate-limit window: one warning per channel per this many consecutive ticks.</summary>
        public const int WarningWindowTicks = 60;

        private readonly float _triggerInner;
        private readonly float _stickInner;
        private readonly float _stickOuter;
        private readonly EmaBrakePriority _ema;
        private int _accelerateInvalidTicks;
        private int _brakeInvalidTicks;
        private int _steerInvalidTicks;

        /// <summary>Raised when a raw channel is non-finite, rate-limited (1 per channel per 60-tick window).</summary>
        public event Action<InputChannel, float> InvalidInputWarning;

        /// <summary>
        /// Creates the processor with the given dead-zone thresholds and EMA alphas. Thresholds and
        /// alphas default to the GDD values; Story 008 (Settings) passes control-profile values instead.
        /// </summary>
        public TickProcessor(
            float triggerInner = DefaultTriggerInner,
            float stickInner = DefaultStickInner,
            float stickOuter = DefaultStickOuter,
            float accelerateAlpha = EmaBrakePriority.DefaultAccelerateAlpha,
            float brakeAlpha = EmaBrakePriority.DefaultBrakeAlpha,
            float steerAlpha = EmaBrakePriority.DefaultSteerAlpha)
        {
            _triggerInner = triggerInner;
            _stickInner = stickInner;
            _stickOuter = stickOuter;
            _ema = new EmaBrakePriority(accelerateAlpha, brakeAlpha, steerAlpha);
        }

        /// <summary>
        /// Processes one simulation tick and assembles the authoritative SimulationInput.
        /// </summary>
        /// <param name="sample">The latest immutable raw input sample captured this render frame.</param>
        /// <param name="pausePending">Whether a Pause edge is pending; the caller consumes it after the first tick.</param>
        public SimulationInput ProcessTick(RawInputSample sample, bool pausePending)
        {
            EmitInvalidInputWarnings(sample);
            ApplyDeadZone(sample, out float acceleratePostDz, out float brakePostDz, out float steerPostDz);

            // Sanitization (AC-22, ADR-0005): NaN/Infinity → 0.0f, clamp to [-1, 1]. These sanitized
            // values are captured as the rawXxxPostDeadZone fields (Option A).
            float accelerateSanitized = EmaBrakePriority.Sanitize(acceleratePostDz);
            float brakeSanitized = EmaBrakePriority.Sanitize(brakePostDz);
            float steerSanitized = EmaBrakePriority.Sanitize(steerPostDz);

            // EMA + brake priority (Story 003); re-sanitizes idempotently.
            EmaOutput ema = _ema.Process(accelerateSanitized, brakeSanitized, steerSanitized);

            return new SimulationInput(
                ema.Accelerate, ema.Brake, ema.Steer,
                accelerateSanitized, brakeSanitized, steerSanitized,
                pausePending,
                sample.Availability);
        }

        private void ApplyDeadZone(RawInputSample sample, out float accelerate, out float brake, out float steer)
        {
            // Keyboard is exempt (maps directly to -1/0/1); gamepad uses the module thresholds.
            if (sample.ActiveScheme != ControlScheme.Gamepad)
            {
                accelerate = sample.AccelerateRaw;
                brake = sample.BrakeRaw;
                steer = sample.SteerRaw;
                return;
            }

            accelerate = DeadZoneNormalizer.NormalizeTrigger(sample.AccelerateRaw, _triggerInner);
            brake = DeadZoneNormalizer.NormalizeTrigger(sample.BrakeRaw, _triggerInner);
            steer = DeadZoneNormalizer.NormalizeStick(new Vector2(sample.SteerRaw, 0f), _stickInner, _stickOuter).x;
        }

        private void EmitInvalidInputWarnings(RawInputSample sample)
        {
            RawInputValidityFlags flags = sample.ValidityFlags;
            EmitChannelWarning(flags, RawInputValidityFlags.AccelerateNonFinite, InputChannel.Accelerate, sample.AccelerateRaw, ref _accelerateInvalidTicks);
            EmitChannelWarning(flags, RawInputValidityFlags.BrakeNonFinite, InputChannel.Brake, sample.BrakeRaw, ref _brakeInvalidTicks);
            EmitChannelWarning(flags, RawInputValidityFlags.SteerNonFinite, InputChannel.Steer, sample.SteerRaw, ref _steerInvalidTicks);
        }

        private void EmitChannelWarning(RawInputValidityFlags flags, RawInputValidityFlags flag, InputChannel channel, float offendingValue, ref int invalidTicks)
        {
            if (!flags.HasFlag(flag))
            {
                invalidTicks = 0;
                return;
            }

            // First tick of each 60-tick window (tick 0, 60, 120, ...) while the value persists.
            if (invalidTicks % WarningWindowTicks == 0)
            {
                InvalidInputWarning?.Invoke(channel, offendingValue);
            }

            invalidTicks++;
        }
    }
}
