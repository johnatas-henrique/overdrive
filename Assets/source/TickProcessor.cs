using System;
using UnityEngine;
using Overdrive.Simulation;

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
    public sealed class TickProcessor : ISimulationInputProcessor
    {
        /// <summary>Warning rate-limit window: one warning per channel per this many consecutive ticks.</summary>
        public const int WarningWindowTicks = 60;

        private readonly ControlProfile _profile;
        private readonly EmaBrakePriority _ema;
        private int _accelerateInvalidTicks;
        private int _brakeInvalidTicks;
        private int _steerInvalidTicks;

        /// <summary>Raised when a raw channel is non-finite, rate-limited (1 per channel per 60-tick window).</summary>
        public event Action<InputChannel, float> InvalidInputWarning;

        /// <summary>
        /// Creates the processor with a control profile (dead-zone thresholds and EMA alphas).
        /// A <c>null</c> profile uses <see cref="ControlProfile.Default"/>. The trigger threshold is
        /// Input-owned tuning (ADR-0004) — a profile passed here must have been sanitized so its
        /// trigger value is the approved Input default.
        /// </summary>
        public TickProcessor(ControlProfile? profile = null)
        {
            _profile = profile ?? ControlProfile.Default;
            _ema = new EmaBrakePriority(_profile.AccelerateAlpha, _profile.BrakeAlpha, _profile.SteerAlpha);
        }

        /// <summary>
        /// Reinitializes the internal EMA previous-output state from the given raw sample's
        /// post-dead-zone values (applies the dead-zone + sanitization exactly as
        /// <see cref="ProcessTick"/> does). Called on active-scheme change (Story 005,
        /// AC-23/AC-39) and on UI→Gameplay resume (Story 006, AC-41a); no filtered value
        /// carries from the prior scheme/context.
        /// </summary>
        public void InitializeFromPostDeadZone(RawInputSample sample)
        {
            ApplyDeadZone(sample, out float acceleratePostDz, out float brakePostDz, out float steerPostDz);
            _ema.InitializeFromPostDeadZone(
                EmaBrakePriority.Sanitize(acceleratePostDz),
                EmaBrakePriority.Sanitize(brakePostDz),
                EmaBrakePriority.Sanitize(steerPostDz));
        }

        /// <summary>Kernel seam: processes one tick. Delegates to <see cref="ProcessTick"/>.</summary>
        public SimulationInput Process(RawInputSample sample, bool pausePending)
        {
            return ProcessTick(sample, pausePending);
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

            // NoInputDevice (GDD input-system.md AC-42-9): no eligible scheme can provide
            // gameplay input, so Accelerate, Brake, and Steer are forced to 0.0 — the car
            // coasts. Availability propagates unchanged; PauseEdge still flows.
            if (sample.Availability == InputAvailability.NoInputDevice)
            {
                accelerateSanitized = 0f;
                brakeSanitized = 0f;
                steerSanitized = 0f;
                ema = new EmaOutput(0f, 0f, 0f);
            }

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

            accelerate = DeadZoneNormalizer.NormalizeTrigger(sample.AccelerateRaw, _profile.TriggerInner);
            brake = DeadZoneNormalizer.NormalizeTrigger(sample.BrakeRaw, _profile.TriggerInner);
            steer = DeadZoneNormalizer.NormalizeStick(new Vector2(sample.SteerRaw, 0f), _profile.StickInner, _profile.StickOuter).x;
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
