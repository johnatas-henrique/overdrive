namespace Overdrive.Input
{
    /// <summary>Identifies the currently active input device scheme.</summary>
    public enum ControlScheme
    {
        /// <summary>The keyboard/mouse scheme.</summary>
        KeyboardMouse,

        /// <summary>The gamepad scheme.</summary>
        Gamepad
    }

    /// <summary>Describes whether an input device is currently connected.</summary>
    public enum InputAvailability
    {
        /// <summary>A valid input device is connected and capture is live.</summary>
        Available,

        /// <summary>No input device is connected; driving input must be zeroed.</summary>
        NoInputDevice
    }

    /// <summary>Flags which raw channels carried a non-finite value at capture time.</summary>
    [System.Flags]
    public enum RawInputValidityFlags
    {
        /// <summary>All channels carried finite values.</summary>
        None = 0,

        /// <summary>The accelerate channel carried NaN or infinity.</summary>
        AccelerateNonFinite = 1 << 0,

        /// <summary>The brake channel carried NaN or infinity.</summary>
        BrakeNonFinite = 1 << 1,

        /// <summary>The steer channel carried NaN or infinity.</summary>
        SteerNonFinite = 1 << 2
    }

    /// <summary>
    /// Immutable snapshot of the raw player input captured once per render frame.
    /// Example: <c>RawInputSample sample = controller.CaptureLatestRawSample();</c>
    /// </summary>
    public readonly struct RawInputSample
    {
        /// <summary>Gets a monotonically increasing capture counter.</summary>
        public readonly ulong CaptureSequence;

        /// <summary>Gets the active scheme used for capture.</summary>
        public readonly ControlScheme ActiveScheme;

        /// <summary>Gets the raw throttle value before dead-zone normalization.</summary>
        public readonly float AccelerateRaw;

        /// <summary>Gets the raw brake value before dead-zone normalization.</summary>
        public readonly float BrakeRaw;

        /// <summary>Gets the raw steer value before dead-zone normalization (stick x / keyboard -1..1).</summary>
        public readonly float SteerRaw;

        /// <summary>Gets the input availability at capture time.</summary>
        public readonly InputAvailability Availability;

        /// <summary>Gets which channels carried a non-finite value at capture time.</summary>
        public readonly RawInputValidityFlags ValidityFlags;

        /// <summary>Creates an immutable raw input sample.</summary>
        public RawInputSample(
            ulong captureSequence,
            ControlScheme activeScheme,
            float accelerateRaw,
            float brakeRaw,
            float steerRaw,
            InputAvailability availability,
            RawInputValidityFlags validityFlags)
        {
            CaptureSequence = captureSequence;
            ActiveScheme = activeScheme;
            AccelerateRaw = accelerateRaw;
            BrakeRaw = brakeRaw;
            SteerRaw = steerRaw;
            Availability = availability;
            ValidityFlags = validityFlags;
        }
    }
}
