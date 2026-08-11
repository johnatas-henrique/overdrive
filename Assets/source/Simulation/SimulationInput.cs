namespace Overdrive.Input
{
    /// <summary>
    /// The authoritative gameplay-input contract produced once per 60 Hz simulation tick.
    /// Example: <c>SimulationInput input = processor.ProcessTick(sample, pausePending);</c>
    /// </summary>
    public readonly struct SimulationInput
    {
        /// <summary>Gets the EMA-filtered accelerate output (0..1); zeroed while brake priority is active.</summary>
        public readonly float AccelerateOut;

        /// <summary>Gets the EMA-filtered brake output (0..1).</summary>
        public readonly float BrakeOut;

        /// <summary>Gets the EMA-filtered steer output (-1..1).</summary>
        public readonly float SteerOut;

        /// <summary>Gets the dead-zone-normalized, sanitized raw accelerate (0..1), before EMA/brake priority.</summary>
        public readonly float RawAcceleratePostDeadZone;

        /// <summary>Gets the dead-zone-normalized, sanitized raw brake (0..1), before EMA/brake priority.</summary>
        public readonly float RawBrakePostDeadZone;

        /// <summary>Gets the dead-zone-normalized, sanitized raw steer (-1..1), before EMA/brake priority.</summary>
        public readonly float RawSteerPostDeadZone;

        /// <summary>Gets whether a Pause edge is pending for consumption (one-shot; true on the consuming tick).</summary>
        public readonly bool PauseEdge;

        /// <summary>Gets the input availability at capture time.</summary>
        public readonly InputAvailability Availability;

        /// <summary>Creates the authoritative per-tick gameplay-input contract.</summary>
        public SimulationInput(
            float accelerateOut, float brakeOut, float steerOut,
            float rawAcceleratePostDeadZone, float rawBrakePostDeadZone, float rawSteerPostDeadZone,
            bool pauseEdge, InputAvailability availability)
        {
            AccelerateOut = accelerateOut;
            BrakeOut = brakeOut;
            SteerOut = steerOut;
            RawAcceleratePostDeadZone = rawAcceleratePostDeadZone;
            RawBrakePostDeadZone = rawBrakePostDeadZone;
            RawSteerPostDeadZone = rawSteerPostDeadZone;
            PauseEdge = pauseEdge;
            Availability = availability;
        }
    }
}
