using System;

/// <summary>
/// Control scheme selected for the current raw input sample.
/// </summary>
public enum ControlScheme
{
    /// <summary>Keyboard and mouse controls.</summary>
    KeyboardMouse = 0,

    /// <summary>Gamepad controls.</summary>
    Gamepad = 1,
}

/// <summary>
/// Availability of an eligible input device at capture time.
/// </summary>
public enum InputAvailability
{
    /// <summary>At least one input device is available.</summary>
    Available = 0,

    /// <summary>No input device is currently available.</summary>
    NoInputDevice = 1,
}

/// <summary>
/// Validity diagnostics for raw channels captured before tick processing.
/// </summary>
[Flags]
public enum RawInputValidityFlags
{
    /// <summary>No raw-channel validity issue was detected.</summary>
    None = 0,

    /// <summary>The accelerate source channel was non-finite.</summary>
    AccelerateNonFinite = 1 << 0,

    /// <summary>The brake source channel was non-finite.</summary>
    BrakeNonFinite = 1 << 1,

    /// <summary>The steer source channel was non-finite.</summary>
    SteerNonFinite = 1 << 2,
}

/// <summary>
/// Immutable raw input captured once at the start of a render-frame simulation update.
///
/// <example>
/// <code>
/// RawInputSample sample = controller.CaptureLatestRawSample();
/// if (sample.pauseRise)
///     OpenPauseMenu();
/// </code>
/// </example>
/// </summary>
public readonly struct RawInputSample
{
    /// <summary>Monotonic render-update capture number.</summary>
    public readonly ulong captureSequence;

    /// <summary>Control scheme selected for this sample.</summary>
    public readonly ControlScheme activeScheme;

    /// <summary>Raw accelerate value, normally in the range 0.0 to 1.0.</summary>
    public readonly float accelerateRaw;

    /// <summary>Raw brake value, normally in the range 0.0 to 1.0.</summary>
    public readonly float brakeRaw;

    /// <summary>Raw steer value, normally in the range -1.0 to 1.0.</summary>
    public readonly float steerRaw;

    /// <summary>Whether the first pending gameplay Pause rise was observed.</summary>
    public readonly bool pauseRise;

    /// <summary>Whether an eligible input device was available during capture.</summary>
    public readonly InputAvailability inputAvailability;

    /// <summary>Validity diagnostics for the captured source channels.</summary>
    public readonly RawInputValidityFlags validityFlags;

    /// <summary>
    /// Creates one immutable raw input sample.
    /// </summary>
    public RawInputSample(
        ulong captureSequence,
        ControlScheme activeScheme,
        float accelerateRaw,
        float brakeRaw,
        float steerRaw,
        bool pauseRise,
        InputAvailability inputAvailability,
        RawInputValidityFlags validityFlags)
    {
        this.captureSequence = captureSequence;
        this.activeScheme = activeScheme;
        this.accelerateRaw = accelerateRaw;
        this.brakeRaw = brakeRaw;
        this.steerRaw = steerRaw;
        this.pauseRise = pauseRise;
        this.inputAvailability = inputAvailability;
        this.validityFlags = validityFlags;
    }
}

/// <summary>
/// Pure validity checks for raw input channels.
/// </summary>
public static class RawInputSampleValidity
{
    /// <summary>
    /// Returns channel flags without changing any source value.
    /// </summary>
    public static RawInputValidityFlags GetFlags(float accelerateRaw, float brakeRaw, float steerRaw)
    {
        var flags = RawInputValidityFlags.None;
        if (!float.IsFinite(accelerateRaw))
            flags |= RawInputValidityFlags.AccelerateNonFinite;
        if (!float.IsFinite(brakeRaw))
            flags |= RawInputValidityFlags.BrakeNonFinite;
        if (!float.IsFinite(steerRaw))
            flags |= RawInputValidityFlags.SteerNonFinite;
        return flags;
    }
}
