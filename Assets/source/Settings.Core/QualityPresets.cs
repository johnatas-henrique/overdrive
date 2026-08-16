namespace Overdrive.Settings.Core
{
    /// <summary>
    /// Quality preset identifier (ADR-0004:41, reconciled by Story 3-6 / Story 3-7).
    /// Pure domain enum — moved from <c>Overdrive.Settings.DisplayContracts</c> (Story 3-6) to the
    /// engine-free core so the VfxSettingsPort and the runtime preference resolver (Story 3-7) can
    /// reference it without a Unity-backed dependency (gate R4, unity-specialist verified SAFE:
    /// no URP/Unity API touches either enum).
    /// </summary>
    public enum QualityPresetId
    {
        /// <summary>Low — VfxDensityLevel.Low (0.75 render scale, shadows off, no MSAA).</summary>
        Low = 0,

        /// <summary>Medium — the factory default preset (matches DisplayData.Default quality preset 1).</summary>
        Medium = 1,

        /// <summary>High — VfxDensityLevel.High (1.0 render scale, hard shadows, 4x MSAA).</summary>
        High = 2,

        /// <summary>Ultra — VfxDensityLevel.Ultra (1.0 render scale, hard shadows, 4x MSAA).</summary>
        Ultra = 3,

        /// <summary>
        /// VSync-override marker owned by the Story 3-6 quality applier (IQualityPresetApplier.MarkCustomOverride).
        /// Never persisted and never reaches the runtime preference resolver — rejected at the session
        /// Display guard (SetValue) and falls back to <see cref="Medium"/> at load (Story 3-7, gate R5).
        /// </summary>
        Custom = 4
    }

    /// <summary>
    /// VFX density level (ADR-0010). Pure domain enum — moved from <c>Overdrive.Settings.DisplayContracts</c>
    /// (Story 3-6) to the engine-free core so the runtime preference resolver (Story 3-7) can expose the
    /// effective density without a Unity-backed dependency.
    /// </summary>
    public enum VfxDensityLevel
    {
        /// <summary>Reduced density — forced by performance protection (GDD settings.md:114).</summary>
        Low = 0,

        /// <summary>Medium density (medium preset).</summary>
        Medium = 1,

        /// <summary>High density (high preset).</summary>
        High = 2,

        /// <summary>Maximum density (ultra preset).</summary>
        Ultra = 3
    }
}
