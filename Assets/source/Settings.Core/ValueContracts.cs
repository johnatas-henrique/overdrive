using System.Collections.Generic;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// Color-blind mode (GDD settings.md:227-237, reconciled by Story 3-7).
    /// <see cref="AccessibilityData.ColorblindMode"/> is a persisted int; the accessibility port maps
    /// 0=None, 1=Protanopia, 2=Deuteranopia, 3=Tritanopia at the emission boundary.
    /// </summary>
    public enum ColorblindMode
    {
        /// <summary>No color-blind adjustment.</summary>
        None = 0,

        /// <summary>Protanopia (red-deficient) palette.</summary>
        Protanopia = 1,

        /// <summary>Deuteranopia (green-deficient) palette.</summary>
        Deuteranopia = 2,

        /// <summary>Tritanopia (blue-deficient) palette.</summary>
        Tritanopia = 3
    }

    /// <summary>
    /// A single palette cue entry for one HUD state (AC-AC3/AC-AC4, Story 3-7). The color component is
    /// NOT modeled here — color rendering is deferred (HUD/UI epic); the cue METADATA (label + pattern/
    /// shape booleans) is contract-owned and structurally identical across color-blind modes.
    /// </summary>
    public readonly struct PaletteCue
    {
        /// <summary>State identifier — one of <see cref="PaletteStateIds"/>.</summary>
        public readonly string StateId;

        /// <summary>Label/name cue beyond color — must be non-empty (AC-AC4).</summary>
        public readonly string Label;

        /// <summary>True when a pattern cue (beyond color) is present (AC-AC4).</summary>
        public readonly bool HasPatternCue;

        /// <summary>True when a shape cue (beyond color) is present (AC-AC4).</summary>
        public readonly bool HasShapeCue;

        /// <summary>Creates a palette cue. All arguments required; the struct is immutable.</summary>
        public PaletteCue(string stateId, string label, bool hasPatternCue, bool hasShapeCue)
        {
            StateId = stateId;
            Label = label;
            HasPatternCue = hasPatternCue;
            HasShapeCue = hasShapeCue;
        }
    }

    /// <summary>
    /// Required HUD state identifiers for the emitted palette (AC-AC3/AC-AC4, Story 3-7).
    /// Every emitted <see cref="AccessibilityUpdate.Cues"/> list must contain at least
    /// <see cref="Critical"/>, <see cref="Warning"/> and <see cref="Normal"/>.
    /// </summary>
    public static class PaletteStateIds
    {
        /// <summary>Critical state — highest urgency HUD elements.</summary>
        public const string Critical = "critical";

        /// <summary>Warning state — caution HUD elements.</summary>
        public const string Warning = "warning";

        /// <summary>Normal state — baseline HUD elements.</summary>
        public const string Normal = "normal";
    }

    /// <summary>
    /// Audio value contract emitted by <see cref="AudioSettingsPort"/> (Story 3-7). Mirrors
    /// <see cref="AudioData"/> field-for-field. <see cref="MusicVolume"/> is ALWAYS the STORED volume —
    /// mute never zeros it; <see cref="MuteMusic"/> is the flag the mixer consumes (AC-E7).
    /// </summary>
    public readonly struct AudioSettingsUpdate
    {
        /// <summary>Master volume, 0.0–1.0, default 0.8 (GDD settings.md:146).</summary>
        public readonly float MasterVolume;

        /// <summary>Music volume, 0.0–1.0, default 0.7 (GDD settings.md:147). Stored volume preserved on unmute.</summary>
        public readonly float MusicVolume;

        /// <summary>SFX volume, 0.0–1.0, default 0.8 (GDD settings.md:148).</summary>
        public readonly float SfxVolume;

        /// <summary>UI volume, 0.0–1.0, default 0.6 (GDD settings.md:149).</summary>
        public readonly float UiVolume;

        /// <summary>True when the music mixer group is muted (default false).</summary>
        public readonly bool MuteMusic;

        /// <summary>True when the SFX mixer group is muted (default false).</summary>
        public readonly bool MuteSfx;

        /// <summary>Creates the audio update. All arguments required; the struct is immutable.</summary>
        public AudioSettingsUpdate(float masterVolume, float musicVolume, float sfxVolume, float uiVolume, bool muteMusic, bool muteSfx)
        {
            MasterVolume = masterVolume;
            MusicVolume = musicVolume;
            SfxVolume = sfxVolume;
            UiVolume = uiVolume;
            MuteMusic = muteMusic;
            MuteSfx = muteSfx;
        }
    }

    /// <summary>
    /// Camera value contract emitted by <see cref="CameraSettingsPort"/> (Story 3-7). Mirrors
    /// <see cref="CameraData"/> field-for-field. <see cref="ReducedMotion"/> is the single source of
    /// truth (ADR-0004:104-108) — the accessibility update resolves it at emission (never stored twice).
    /// </summary>
    public readonly struct CameraSettingsUpdate
    {
        /// <summary>Reduced motion flag — single source of truth (ADR-0004:104-108).</summary>
        public readonly bool ReducedMotion;

        /// <summary>Camera shake intensity, 0.0–2.0, default 1.0 (GDD settings.md:158).</summary>
        public readonly float ShakeIntensity;

        /// <summary>Motion blur, default On (GDD settings.md:159).</summary>
        public readonly bool MotionBlur;

        /// <summary>Chase-overlay visibility in cockpit, default On (GDD settings.md:161, ADR-0014, TR-settings-007).</summary>
        public readonly bool ShowChaseHudInCockpit;

        /// <summary>Creates the camera update. All arguments required; the struct is immutable.</summary>
        public CameraSettingsUpdate(bool reducedMotion, float shakeIntensity, bool motionBlur, bool showChaseHudInCockpit)
        {
            ReducedMotion = reducedMotion;
            ShakeIntensity = shakeIntensity;
            MotionBlur = motionBlur;
            ShowChaseHudInCockpit = showChaseHudInCockpit;
        }
    }

    /// <summary>
    /// Accessibility value contract emitted by <see cref="AccessibilitySettingsPort"/> (Story 3-7).
    /// <see cref="ReducedMotion"/> is RESOLVED at emission from the camera Working (passed into
    /// Publish) — never stored in the accessibility data. <see cref="Cues"/> is the per-mode palette
    /// (AC-AC3/AC-AC4).
    /// </summary>
    public readonly struct AccessibilityUpdate
    {
        /// <summary>Resolved reduced-motion flag — from CameraSettings at emission, never stored.</summary>
        public readonly bool ReducedMotion;

        /// <summary>Text scale, 0.75–2.0, default 1.0 (GDD settings.md:156; ADR-0004 says 1.0–2.0 — GDD wins).</summary>
        public readonly float TextScale;

        /// <summary>Selected color-blind mode.</summary>
        public readonly ColorblindMode Mode;

        /// <summary>Per-state palette cues — must cover Critical/Warning/Normal (AC-AC4).
        /// Read-only list contract (TD-036): consumers cannot mutate the published cues.</summary>
        public readonly IReadOnlyList<PaletteCue> Cues;

        /// <summary>Creates the accessibility update. All arguments required; the struct is immutable.</summary>
        public AccessibilityUpdate(bool reducedMotion, float textScale, ColorblindMode mode, IReadOnlyList<PaletteCue> cues)
        {
            ReducedMotion = reducedMotion;
            TextScale = textScale;
            Mode = mode;
            Cues = cues;
        }
    }

    /// <summary>
    /// Runtime override state (GDD settings.md:114, ADR-0010) consumed by <see cref="IRuntimePreferenceResolver"/>.
    /// Performance protection has the highest runtime authority; Reduced Motion suppresses motion effects.
    /// Overrides never rewrite persisted preferences.
    /// </summary>
    public readonly struct OverrideState
    {
        /// <summary>True when performance protection is active — forces the EFFECTIVE VFX DENSITY to Low (GDD settings.md:114).</summary>
        public readonly bool PerformanceReduced;

        /// <summary>True when reduced-motion is overridden on — suppresses shake, motion blur, dynamic FOV, look-ahead.</summary>
        public readonly bool ReducedMotionOverride;

        /// <summary>Creates the override state. All arguments required; the struct is immutable.</summary>
        public OverrideState(bool performanceReduced, bool reducedMotionOverride)
        {
            PerformanceReduced = performanceReduced;
            ReducedMotionOverride = reducedMotionOverride;
        }
    }

    /// <summary>
    /// Effective runtime preferences produced by <see cref="IRuntimePreferenceResolver"/> (Story 3-7,
    /// AC-CAM4/AC-CAM6/AC-E10). Saved player values are NEVER rewritten — the resolver is a pure merge
    /// over readonly inputs.
    /// </summary>
    public readonly struct RuntimePreferences
    {
        /// <summary>Effective reduced motion (override || saved).</summary>
        public readonly bool ReducedMotionEffective;

        /// <summary>Effective shake intensity — 0 when reduced motion is effective.</summary>
        public readonly float ShakeIntensityEffective;

        /// <summary>Effective motion blur — false when reduced motion is effective.</summary>
        public readonly bool MotionBlurEffective;

        /// <summary>True when dynamic FOV is suppressed (reduced motion effective).</summary>
        public readonly bool DynamicFovSuppressed;

        /// <summary>True when camera look-ahead is suppressed (GDD settings.md:114 / ADR-0010).</summary>
        public readonly bool LookAheadSuppressed;

        /// <summary>The player's saved quality preset — ALWAYS unchanged (never rewritten).</summary>
        public readonly QualityPresetId SavedVfxQuality;

        /// <summary>Effective VFX density — Low when performance-reduced, else from the saved preset (identity mapping).</summary>
        public readonly VfxDensityLevel EffectiveVfxDensity;

        /// <summary>Creates the runtime preferences. All arguments required; the struct is immutable.</summary>
        public RuntimePreferences(
            bool reducedMotionEffective,
            float shakeIntensityEffective,
            bool motionBlurEffective,
            bool dynamicFovSuppressed,
            bool lookAheadSuppressed,
            QualityPresetId savedVfxQuality,
            VfxDensityLevel effectiveVfxDensity)
        {
            ReducedMotionEffective = reducedMotionEffective;
            ShakeIntensityEffective = shakeIntensityEffective;
            MotionBlurEffective = motionBlurEffective;
            DynamicFovSuppressed = dynamicFovSuppressed;
            LookAheadSuppressed = lookAheadSuppressed;
            SavedVfxQuality = savedVfxQuality;
            EffectiveVfxDensity = effectiveVfxDensity;
        }
    }

    /// <summary>
    /// Pure runtime preference resolver (Story 3-7, AC-CAM4/AC-CAM6/AC-E10, GDD settings.md:114).
    /// Merges the saved camera/vfx values with the current override state; never persists, never
    /// mutates its inputs. Truth table:
    ///   ReducedMotionEffective   = overrides.ReducedMotionOverride || saved.ReducedMotion
    ///   ShakeIntensityEffective  = 0 if ReducedMotionEffective else saved.ShakeIntensity
    ///   MotionBlurEffective      = !ReducedMotionEffective &amp;&amp; saved.MotionBlur
    ///   DynamicFovSuppressed     = ReducedMotionEffective
    ///   LookAheadSuppressed      = ReducedMotionEffective
    ///   EffectiveVfxDensity      = Low if overrides.PerformanceReduced else density from savedVfx (identity mapping)
    ///   SavedVfxQuality          = savedVfx (always the unchanged persisted preset)
    /// </summary>
    public interface IRuntimePreferenceResolver
    {
        /// <summary>Resolves effective preferences for the given saved values and override state.</summary>
        RuntimePreferences Resolve(CameraSettingsUpdate saved, QualityPresetId savedVfx, OverrideState overrides);
    }

    /// <summary>
    /// Default pure implementation of <see cref="IRuntimePreferenceResolver"/> (Story 3-7).
    /// Engine-free; deterministic; no side effects.
    /// </summary>
    public sealed class RuntimePreferenceResolver : IRuntimePreferenceResolver
    {
        /// <summary>Maps a persisted preset to its VFX density (identity — from the Story 3-6 QualityPresetMapping).</summary>
        public static VfxDensityLevel PresetToDensity(QualityPresetId preset)
        {
            switch (preset)
            {
                case QualityPresetId.Low: return VfxDensityLevel.Low;
                case QualityPresetId.Medium: return VfxDensityLevel.Medium;
                case QualityPresetId.High: return VfxDensityLevel.High;
                case QualityPresetId.Ultra: return VfxDensityLevel.Ultra;
                default:
                    // QualityPresetId.Custom never persists and never reaches the resolver (gate R5).
                    throw new System.ArgumentOutOfRangeException(nameof(preset), preset, "Only persisted presets (Low/Medium/High/Ultra) reach the resolver.");
            }
        }

        /// <inheritdoc/>
        public RuntimePreferences Resolve(CameraSettingsUpdate saved, QualityPresetId savedVfx, OverrideState overrides)
        {
            bool reducedMotionEffective = overrides.ReducedMotionOverride || saved.ReducedMotion;

            return new RuntimePreferences(
                reducedMotionEffective: reducedMotionEffective,
                shakeIntensityEffective: reducedMotionEffective ? 0f : saved.ShakeIntensity,
                motionBlurEffective: !reducedMotionEffective && saved.MotionBlur,
                dynamicFovSuppressed: reducedMotionEffective,
                lookAheadSuppressed: reducedMotionEffective,
                savedVfxQuality: savedVfx,
                effectiveVfxDensity: overrides.PerformanceReduced ? VfxDensityLevel.Low : PresetToDensity(savedVfx));
        }
    }
}
