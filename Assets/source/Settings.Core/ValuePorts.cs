using System;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// Typed audio value port (Story 3-7, AC-A1..A5). The SettingsEditSession publishes the Working
    /// audio category on change; consumers (Audio epic) subscribe to <see cref="Updated"/>. Pure mapper —
    /// no persistence, no Unity coupling.
    /// </summary>
    public sealed class AudioSettingsPort
    {
        /// <summary>Raised synchronously with the mapped update whenever the Working audio category changes.</summary>
        public event Action<AudioSettingsUpdate> Updated;

        /// <summary>Maps an <see cref="AudioData"/> working value to <see cref="AudioSettingsUpdate"/> and raises <see cref="Updated"/>.</summary>
        public void Publish(AudioData working)
        {
            var update = new AudioSettingsUpdate(
                masterVolume: working.Master,
                musicVolume: working.Music,
                sfxVolume: working.Sfx,
                uiVolume: working.Ui,
                muteMusic: working.MuteMusic,
                muteSfx: working.MuteSfx);
            Updated?.Invoke(update);
        }
    }

    /// <summary>
    /// Typed accessibility value port (Story 3-7, AC-AC1..AC-AC5). <paramref name="cameraReducedMotion"/>
    /// is the RESOLVED camera ReducedMotion passed at emission — the accessibility update never stores it
    /// (no competing copy, gate F12/R2).
    /// </summary>
    public sealed class AccessibilitySettingsPort
    {
        /// <summary>Raised synchronously with the mapped update whenever the Working accessibility category changes.</summary>
        public event Action<AccessibilityUpdate> Updated;

        /// <summary>Maps an <see cref="AccessibilityData"/> working value plus the resolved camera ReducedMotion to <see cref="AccessibilityUpdate"/>.</summary>
        public void Publish(AccessibilityData working, bool cameraReducedMotion)
        {
            var update = new AccessibilityUpdate(
                reducedMotion: cameraReducedMotion,
                textScale: working.TextScale,
                mode: ToColorblindMode(working.ColorblindMode),
                cues: BuildPaletteCues(ToColorblindMode(working.ColorblindMode)));
            Updated?.Invoke(update);
        }

        /// <summary>Maps the persisted int (0=None, 1=Protanopia, 2=Deuteranopia, 3=Tritanopia) to the enum.</summary>
        public static ColorblindMode ToColorblindMode(int value)
        {
            switch (value)
            {
                case 1: return ColorblindMode.Protanopia;
                case 2: return ColorblindMode.Deuteranopia;
                case 3: return ColorblindMode.Tritanopia;
                default: return ColorblindMode.None;
            }
        }

        /// <summary>
        /// Builds the per-mode palette cue list (AC-AC3/AC-AC4): Critical/Warning/Normal, each with a
        /// non-empty Label and at least one cue (pattern or shape). The color component is deferred —
        /// the metadata is contract-owned and structurally identical across modes.
        /// </summary>
        public static PaletteCue[] BuildPaletteCues(ColorblindMode mode)
        {
            // The mode parameter is intentionally unused for now: cue METADATA is structurally
            // identical across colorblind modes (AC-AC4); per-mode COLOR rendering is deferred to the
            // HUD/UI epic. Reserved for future per-mode cue differentiation.
            return new[]
            {
                new PaletteCue(PaletteStateIds.Critical, "Critical", hasPatternCue: true, hasShapeCue: false),
                new PaletteCue(PaletteStateIds.Warning, "Warning", hasPatternCue: false, hasShapeCue: true),
                new PaletteCue(PaletteStateIds.Normal, "Normal", hasPatternCue: true, hasShapeCue: true)
            };
        }
    }

    /// <summary>
    /// Typed camera value port (Story 3-7, AC-CAM1..CAM3, CAM5). The SettingsEditSession publishes the
    /// Working camera category on change; the camera epic subscribes to <see cref="Updated"/>.
    /// </summary>
    public sealed class CameraSettingsPort
    {
        /// <summary>Raised synchronously with the mapped update whenever the Working camera category changes.</summary>
        public event Action<CameraSettingsUpdate> Updated;

        /// <summary>Maps a <see cref="CameraData"/> working value to <see cref="CameraSettingsUpdate"/> and raises <see cref="Updated"/>.</summary>
        public void Publish(CameraData working)
        {
            var update = new CameraSettingsUpdate(
                reducedMotion: working.ReducedMotion,
                shakeIntensity: working.ShakeIntensity,
                motionBlur: working.MotionBlur,
                showChaseHudInCockpit: working.ShowChaseHudInCockpit);
            Updated?.Invoke(update);
        }
    }

    /// <summary>
    /// Typed VFX quality port (Story 3-7, AC-E10). Emits the persisted <see cref="QualityPresetId"/>
    /// (Low/Medium/High/Ultra); <see cref="QualityPresetId.Custom"/> (the Story 3-6 VSync override
    /// marker) is never persisted and never emitted here.
    /// </summary>
    public sealed class VfxSettingsPort
    {
        /// <summary>Raised synchronously whenever the Working quality preset changes.</summary>
        public event Action<QualityPresetId> Updated;

        /// <summary>Publishes the working quality preset and raises <see cref="Updated"/>.</summary>
        public void Publish(QualityPresetId working)
        {
            Updated?.Invoke(working);
        }
    }
}
