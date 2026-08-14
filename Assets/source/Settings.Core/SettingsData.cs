using System;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// The settings JSON schema version currently persisted (ADR-0004:80).
    /// </summary>
    public static class SettingsSchema
    {
        /// <summary>The current persisted schema version.</summary>
        public const byte CurrentVersion = 3;
    }

    /// <summary>
    /// The difficulty tier identifier persisted in the settings blob (GDD settings.md:68).
    /// Index into the five difficulty profiles (0-4: Very Easy..Very Hard).
    /// </summary>
    public readonly struct DifficultySelection
    {
        /// <summary>The inclusive lower bound of the approved profile range (Very Easy).</summary>
        public const int MinLevel = 0;

        /// <summary>The inclusive upper bound of the approved profile range (Very Hard).</summary>
        public const int MaxLevel = 4;

        /// <summary>Creates a difficulty selection.</summary>
        /// <param name="level">The profile index (0-4).</param>
        public DifficultySelection(int level)
        {
            Level = level;
        }

        /// <summary>The profile index (0-4).</summary>
        public int Level { get; }

        /// <summary>The approved default difficulty (Normal = 2).</summary>
        public static DifficultySelection Default => new DifficultySelection(2);
    }

    /// <summary>
    /// The persisted control profile values (GDD settings.md:71-75). This is the Settings-layer
    /// storage model — it does NOT reference <c>Overdrive.Input.ControlProfile</c> (the adapter maps
    /// between them at the boundary). Per-field validation delegates to the validator; profile-level
    /// validation (stick inner &lt; outer, EMA in [0,1]) is enforced via <c>ControlProfile.Sanitize</c>
    /// by the Unity adapter.
    /// </summary>
    public readonly struct ControlsData
    {
        /// <summary>Creates control settings data.</summary>
        /// <param name="stickInner">Radial stick inner threshold.</param>
        /// <param name="stickOuter">Radial stick outer threshold.</param>
        /// <param name="accelerateAlpha">Accelerate EMA alpha.</param>
        /// <param name="brakeAlpha">Brake EMA alpha.</param>
        /// <param name="steerAlpha">Steer EMA alpha.</param>
        /// <param name="bindingsJson">Serialized binding overrides (stable InputBinding IDs).</param>
        public ControlsData(float stickInner, float stickOuter, float accelerateAlpha, float brakeAlpha, float steerAlpha, string bindingsJson)
        {
            StickInner = stickInner;
            StickOuter = stickOuter;
            AccelerateAlpha = accelerateAlpha;
            BrakeAlpha = brakeAlpha;
            SteerAlpha = steerAlpha;
            BindingsJson = bindingsJson;
        }

        /// <summary>Radial stick inner threshold (GDD default 0.15).</summary>
        public float StickInner { get; }

        /// <summary>Radial stick outer threshold (GDD default 0.95).</summary>
        public float StickOuter { get; }

        /// <summary>Accelerate EMA alpha (GDD default 0.3).</summary>
        public float AccelerateAlpha { get; }

        /// <summary>Brake EMA alpha (GDD default 0.3).</summary>
        public float BrakeAlpha { get; }

        /// <summary>Steer EMA alpha (GDD default 0.5).</summary>
        public float SteerAlpha { get; }

        /// <summary>Serialized binding overrides keyed by stable InputBinding IDs.</summary>
        public string BindingsJson { get; }

        /// <summary>The approved default control settings.</summary>
        public static ControlsData Default => new ControlsData(0.15f, 0.95f, 0.3f, 0.3f, 0.5f, string.Empty);
    }

    /// <summary>
    /// The persisted audio settings (GDD settings.md:77).
    /// </summary>
    public readonly struct AudioData
    {
        /// <summary>Creates audio settings data.</summary>
        /// <param name="master">Master volume 0..1.</param>
        /// <param name="music">Music volume 0..1.</param>
        /// <param name="sfx">SFX volume 0..1.</param>
        /// <param name="ui">UI volume 0..1.</param>
        /// <param name="muteMusic">Whether music is muted.</param>
        /// <param name="muteSfx">Whether SFX is muted.</param>
        public AudioData(float master, float music, float sfx, float ui, bool muteMusic, bool muteSfx)
        {
            Master = master;
            Music = music;
            Sfx = sfx;
            Ui = ui;
            MuteMusic = muteMusic;
            MuteSfx = muteSfx;
        }

        /// <summary>Master volume 0..1.</summary>
        public float Master { get; }

        /// <summary>Music volume 0..1.</summary>
        public float Music { get; }

        /// <summary>SFX volume 0..1.</summary>
        public float Sfx { get; }

        /// <summary>UI volume 0..1.</summary>
        public float Ui { get; }

        /// <summary>Whether music is muted.</summary>
        public bool MuteMusic { get; }

        /// <summary>Whether SFX is muted.</summary>
        public bool MuteSfx { get; }

        /// <summary>
        /// The approved default audio settings (GDD settings.md:146-149 — Master 0.8, Music 0.7,
        /// SFX 0.8, UI 0.6; unmuted). Corrected by Story 3-7 (defaults reconciliation, gate R2/R5).
        /// </summary>
        public static AudioData Default => new AudioData(0.8f, 0.7f, 0.8f, 0.6f, false, false);
    }

    /// <summary>
    /// The persisted display settings (GDD settings.md:78). Resolution/fullscreen changes require
    /// DisplayConfirm (Story 005) — this story only persists the values.
    /// </summary>
    public readonly struct DisplayData
    {
        /// <summary>Creates display settings data.</summary>
        /// <param name="resolutionWidth">Window width in pixels.</param>
        /// <param name="resolutionHeight">Window height in pixels.</param>
        /// <param name="fullscreenMode">Fullscreen mode as int (0=Windowed, 1=FullScreen, 2=Borderless).</param>
        /// <param name="vsync">VSync count (0=Off, 1=On).</param>
        /// <param name="qualityPreset">Quality preset index (0=Low, 1=Medium, 2=High, 3=Ultra).</param>
        public DisplayData(int resolutionWidth, int resolutionHeight, int fullscreenMode, int vsync, int qualityPreset)
        {
            ResolutionWidth = resolutionWidth;
            ResolutionHeight = resolutionHeight;
            FullscreenMode = fullscreenMode;
            Vsync = vsync;
            QualityPreset = qualityPreset;
        }

        /// <summary>Window width in pixels.</summary>
        public int ResolutionWidth { get; }

        /// <summary>Window height in pixels.</summary>
        public int ResolutionHeight { get; }

        /// <summary>Fullscreen mode int (0=Windowed, 1=FullScreen, 2=Borderless).</summary>
        public int FullscreenMode { get; }

        /// <summary>VSync count.</summary>
        public int Vsync { get; }

        /// <summary>Quality preset index.</summary>
        public int QualityPreset { get; }

        /// <summary>The approved default display settings (1920x1080 borderless, VSync on, Medium).</summary>
        public static DisplayData Default => new DisplayData(1920, 1080, 2, 1, 1);
    }

    /// <summary>
    /// The persisted accessibility settings (GDD settings.md:79).
    /// </summary>
    public readonly struct AccessibilityData
    {
        /// <summary>Creates accessibility settings data.</summary>
        /// <param name="colorblindMode">Colorblind mode int (0=None, 1=Protanopia, 2=Deuteranopia, 3=Tritanopia).</param>
        /// <param name="textScale">Text scale 0.75..2.0 (GDD 75%-200%).</param>
        public AccessibilityData(int colorblindMode, float textScale)
        {
            ColorblindMode = colorblindMode;
            TextScale = textScale;
        }

        /// <summary>Colorblind mode int.</summary>
        public int ColorblindMode { get; }

        /// <summary>Text scale 0.75..2.0.</summary>
        public float TextScale { get; }

        /// <summary>The approved default accessibility settings.</summary>
        public static AccessibilityData Default => new AccessibilityData(0, 1f);
    }

    /// <summary>
    /// The persisted camera settings (GDD settings.md:80).
    /// </summary>
    public readonly struct CameraData
    {
        /// <summary>Creates camera settings data.</summary>
        /// <param name="shakeIntensity">Camera shake intensity.</param>
        /// <param name="motionBlur">Whether motion blur is enabled.</param>
        /// <param name="reducedMotion">Whether reduced-motion mode is enabled (single source of truth).</param>
        /// <param name="showChaseHudInCockpit">Whether chase HUD overlays in cockpit view.</param>
        public CameraData(float shakeIntensity, bool motionBlur, bool reducedMotion, bool showChaseHudInCockpit)
        {
            ShakeIntensity = shakeIntensity;
            MotionBlur = motionBlur;
            ReducedMotion = reducedMotion;
            ShowChaseHudInCockpit = showChaseHudInCockpit;
        }

        /// <summary>Camera shake intensity.</summary>
        public float ShakeIntensity { get; }

        /// <summary>Whether motion blur is enabled.</summary>
        public bool MotionBlur { get; }

        /// <summary>Whether reduced-motion mode is enabled.</summary>
        public bool ReducedMotion { get; }

        /// <summary>Whether chase HUD overlays in cockpit view.</summary>
        public bool ShowChaseHudInCockpit { get; }

        /// <summary>
        /// The approved default camera settings (GDD settings.md:158-161 — Shake 1.0, Motion Blur On,
        /// Reduced Motion Off, Show Chase HUD in Cockpit On; ADR-0014). Corrected by Story 3-7
        /// (defaults reconciliation, gate R2/R5).
        /// </summary>
        public static CameraData Default => new CameraData(1.0f, true, false, true);
    }

    /// <summary>
    /// The full persisted settings blob (GDD settings.md:66-81) — the Settings-layer storage model.
    /// PascalCase storage model; the JSON serializer maps to snake_case for the blob.
    /// </summary>
    public readonly struct GameSettingsData
    {
        /// <summary>Creates the settings blob data.</summary>
        /// <param name="version">The schema version.</param>
        /// <param name="difficulty">The difficulty selection.</param>
        /// <param name="controls">The control settings.</param>
        /// <param name="audio">The audio settings.</param>
        /// <param name="display">The display settings.</param>
        /// <param name="accessibility">The accessibility settings.</param>
        /// <param name="camera">The camera settings.</param>
        public GameSettingsData(byte version, DifficultySelection difficulty, ControlsData controls, AudioData audio, DisplayData display, AccessibilityData accessibility, CameraData camera)
        {
            Version = version;
            Difficulty = difficulty;
            Controls = controls;
            Audio = audio;
            Display = display;
            Accessibility = accessibility;
            Camera = camera;
        }

        /// <summary>The schema version (current = 3).</summary>
        public byte Version { get; }

        /// <summary>The difficulty selection.</summary>
        public DifficultySelection Difficulty { get; }

        /// <summary>The control settings.</summary>
        public ControlsData Controls { get; }

        /// <summary>The audio settings.</summary>
        public AudioData Audio { get; }

        /// <summary>The display settings.</summary>
        public DisplayData Display { get; }

        /// <summary>The accessibility settings.</summary>
        public AccessibilityData Accessibility { get; }

        /// <summary>The camera settings.</summary>
        public CameraData Camera { get; }

        /// <summary>The approved factory defaults (version 3, all categories at defaults).</summary>
        public static GameSettingsData Defaults => new GameSettingsData(
            SettingsSchema.CurrentVersion,
            DifficultySelection.Default,
            ControlsData.Default,
            AudioData.Default,
            DisplayData.Default,
            AccessibilityData.Default,
            CameraData.Default);
    }
}
