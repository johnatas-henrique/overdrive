using System;
using UnityEngine;
using Overdrive.Settings.Core;

namespace Overdrive.Settings
{
    /// <summary>
    /// A physical display state (resolution, refresh-rate fraction, and fullscreen mode).
    /// Lives in the Unity-backed <c>Overdrive.Settings</c> assembly because
    /// <see cref="ScreenMode"/> is <see cref="UnityEngine.FullScreenMode"/>. This is a
    /// PHYSICAL attribute resolved at the display boundary — it is never persisted in
    /// <see cref="Overdrive.Settings.Core.DisplayData"/> (Story 005 contract).
    /// </summary>
    public readonly struct DisplayState
    {
        /// <summary>Creates a display state.</summary>
        public DisplayState(int width, int height, int refreshRateNumerator, int refreshRateDenominator, FullScreenMode screenMode)
        {
            Width = width;
            Height = height;
            RefreshRateNumerator = refreshRateNumerator;
            RefreshRateDenominator = refreshRateDenominator;
            ScreenMode = screenMode;
        }

        /// <summary>Window width in pixels.</summary>
        public int Width { get; }

        /// <summary>Window height in pixels.</summary>
        public int Height { get; }

        /// <summary>Refresh-rate fraction numerator (for <see cref="UnityEngine.RefreshRate"/>). Zero/zero = system default.</summary>
        public int RefreshRateNumerator { get; }

        /// <summary>Refresh-rate fraction denominator (for <see cref="UnityEngine.RefreshRate"/>). Zero/zero = system default.</summary>
        public int RefreshRateDenominator { get; }

        /// <summary>Fullscreen mode.</summary>
        public FullScreenMode ScreenMode { get; }
    }

    /// <summary>
    /// The outcome of applying a display preview. <see cref="Applied"/> means the state was
    /// applied (or is already active); the Rejected values mean the preview was refused and
    /// the caller should NOT start a confirmation timer.
    /// </summary>
    public enum DisplayPreviewResult
    {
        /// <summary>The preview was applied (or is idempotently already active).</summary>
        Applied,
        /// <summary>No supported state matches (empty supported list).</summary>
        RejectedNoSupported,
        /// <summary>The platform does not support the requested display operation (WebGL). Fake-testable here; real platform validation is deferred to the WebGL target gate.</summary>
        RejectedWebGLUnsupported
    }

    /// <summary>
    /// The display hardware port (Story 005). Adapter over <see cref="Screen.resolutions"/>,
    /// <see cref="Screen.SetResolution(int, int, FullScreenMode, RefreshRate)"/>, and
    /// <see cref="Screen.fullScreenMode"/>. A fake is used for deterministic tests.
    /// </summary>
    public interface IDisplayApi
    {
        /// <summary>The current display state.</summary>
        DisplayState CurrentState { get; }

        /// <summary>The real supported display states (from <see cref="Screen.resolutions"/>).</summary>
        System.Collections.Generic.IReadOnlyList<DisplayState> SupportedStates { get; }

        /// <summary>
        /// Resolves <paramref name="requested"/> to the nearest supported state (deterministic
        /// absolute-area distance; lexicographic tie-break). Returns false when no candidate
        /// exists. When the resolved state differs from the requested state, the adapter raises
        /// its own <see cref="Warning"/> event BEFORE returning (Story 005 DR2).
        /// </summary>
        bool TryResolveRequested(DisplayState requested, out DisplayState resolved);

        /// <summary>
        /// Applies an already-resolved state via
        /// <see cref="Screen.SetResolution(int, int, FullScreenMode, RefreshRate)"/> (RefreshRate
        /// struct — the int overload is deprecated). The caller must pass an already-resolved
        /// state; the adapter is idempotent when the state is already active.
        /// </summary>
        DisplayPreviewResult ApplyPreview(DisplayState resolved);

        /// <summary>Restores a previous display state (Story 005 DR5 rollback).</summary>
        void Restore(DisplayState previousState);

        /// <summary>
        /// Raised BY THE ADAPTER (its own event — legal in C#) when
        /// <see cref="TryResolveRequested"/> falls back to a nearest-supported state. The
        /// orchestrator subscribes before resolving and re-routes to the UI warning sink; the
        /// gate never handles warnings.
        /// </summary>
        event Action<string> Warning;
    }

    /// <summary>
    /// Focus-change port (Story 005 DR5 focus-loss seam). Adapter over
    /// <see cref="Application.focusChanged"/>; a fake drives loss/re-focus deterministically.
    /// </summary>
    public interface IFocusChangeSource
    {
        /// <summary>Raised when the application gains (true) or loses (false) focus.</summary>
        event Action<bool> FocusChanged;
    }

    /// <summary>
    /// The gate real implementation (Story 005) implements both the Core seam
    /// <see cref="Overdrive.Settings.Core.IDisplayConfirmGate"/> (the session sees only this)
    /// and this extended control surface the UI uses: player outcomes, the runtime timer pump,
    /// and the transient physical-state handoff. Lives in the Unity-backed assembly because
    /// <see cref="PrepareDisplayState"/> takes a <see cref="DisplayState"/>.
    /// </summary>
    /// <remarks>
    /// Single-threaded contract: the gate is driven from the UI/main thread only (menu-time
    /// code, not a per-frame hot path). Late events — a KeepChanges/Cancel/Tick arriving after
    /// the confirmation already completed (e.g. timer expired on the previous frame) — are
    /// intentionally silent no-ops: the session's generation counter already invalidates stale
    /// outcomes, so the player's action is dropped rather than double-applied.
    /// </remarks>
    public interface IDisplayConfirmControl : Overdrive.Settings.Core.IDisplayConfirmGate
    {
        /// <summary>
        /// Transient physical-state handoff: the orchestrator calls this AFTER
        /// <see cref="IDisplayApi.TryResolveRequested"/> and BEFORE building the
        /// <see cref="Overdrive.Settings.Core.DisplayData"/> sent to the session. The gate stores
        /// the prepared state as the expected next candidate so the refresh-rate fraction is
        /// preserved (the persisted candidate seam carries only width/height/mode).
        /// </summary>
        void PrepareDisplayState(DisplayState resolved);

        /// <summary>Player clicked Keep Changes — the candidate remains applied, onResult(Accepted).</summary>
        void KeepChanges();

        /// <summary>Player clicked Cancel — the pre-preview state is restored, onResult(RejectedOrTimeout).</summary>
        void Cancel();

        /// <summary>
        /// Runtime pump — called once per frame while DisplayConfirm is active; drives the
        /// 15-second unscaled timer. The caller (UI/Unity driver) supplies
        /// <see cref="Time.unscaledDeltaTime"/> at runtime; tests supply a fake constant.
        /// </summary>
        void Tick(float unscaledDeltaTime);
    }

    /// <summary>Named quality preset — moved to <see cref="Overdrive.Settings.Core.QualityPresetId"/> (Story 3-7).</summary>
    /// <summary>Shadow quality (GDD settings.md:120-125 preset outputs).</summary>
    public enum ShadowLevel
    {
        /// <summary>Shadows off.</summary>
        Off,
        /// <summary>Soft shadows.</summary>
        Soft,
        /// <summary>Hard shadows.</summary>
        Hard
    }

    /// <summary>MSAA sample count (GDD settings.md:120-125 preset outputs).</summary>
    public enum MSAASamples
    {
        /// <summary>MSAA off (1 sample).</summary>
        Off = 1,
        /// <summary>2x MSAA.</summary>
        X2 = 2,
        /// <summary>4x MSAA.</summary>
        X4 = 4
    }

    /// <summary>Anisotropic filtering mode (GDD settings.md:120-125 preset outputs).</summary>
    public enum AnisotropicLevel
    {
        /// <summary>Per-texture setting.</summary>
        PerTexture,
        /// <summary>Forced on.</summary>
        ForcedOn
    }

    /// <summary>
    /// The outcome of applying a quality preset. <see cref="Rejected"/> means the applier could
    /// not apply the mapping (e.g. no URP pipeline asset) — the orchestrator then SKIPS
    /// <c>session.SetValue</c> so Working stays unchanged (Story 005 AC-DR6).
    /// </summary>
    public enum ApplyStatus
    {
        /// <summary>The preset was applied.</summary>
        Applied,
        /// <summary>The preset could not be applied.</summary>
        Rejected
    }

    /// <summary>
    /// The full GDD preset output mapping (Story 005 R5 finding 6): render scale, VFX density,
    /// shadows, MSAA, and anisotropic filtering. These are preset OUTPUTS applied by the
    /// applier/URP — they are NOT player-editable advanced fields (those remain deferred to the
    /// VFX epic). <see cref="QualityPresetId.Custom"/> has no mapping and is rejected.
    /// </summary>
    public readonly struct QualityPresetMapping
    {
        /// <summary>Creates a preset mapping.</summary>
        public QualityPresetMapping(QualityPresetId presetId, float renderScale, VfxDensityLevel vfxDensity, ShadowLevel shadows, MSAASamples msaa, AnisotropicLevel anisotropic)
        {
            PresetId = presetId;
            RenderScale = renderScale;
            VfxDensity = vfxDensity;
            Shadows = shadows;
            MSAA = msaa;
            Anisotropic = anisotropic;
        }

        /// <summary>The preset this mapping describes.</summary>
        public QualityPresetId PresetId { get; }

        /// <summary>Render scale fraction (0.75 / 0.85 / 1.0 / 1.0).</summary>
        public float RenderScale { get; }

        /// <summary>VFX density level.</summary>
        public VfxDensityLevel VfxDensity { get; }

        /// <summary>Shadow quality.</summary>
        public ShadowLevel Shadows { get; }

        /// <summary>MSAA sample count.</summary>
        public MSAASamples MSAA { get; }

        /// <summary>Anisotropic filtering mode.</summary>
        public AnisotropicLevel Anisotropic { get; }
    }

    /// <summary>
    /// The quality-preset application port (Story 005 AC-DR6/DR7). Adapter over the URP render
    /// pipeline asset; Settings publishes the selected preset + receives an observable apply
    /// status. Does NOT own URP shader compilation (E6 — deferred to the VFX epic).
    /// </summary>
    public interface IQualityPresetApplier
    {
        /// <summary>
        /// Pure table lookup returning the FULL five-dimension mapping for a preset
        /// (render scale, VFX density, shadows, MSAA, anisotropic). Throws for
        /// <see cref="QualityPresetId.Custom"/> (no mapping exists).
        /// </summary>
        QualityPresetMapping ResolveMapping(QualityPresetId id);

        /// <summary>
        /// Applies the mapping to the URP pipeline asset. Returns <see cref="ApplyStatus.Rejected"/>
        /// when no URP asset is active (QualitySettings.renderPipeline is not a
        /// UniversalRenderPipelineAsset). On success, <see cref="PresetApplied"/> is raised and
        /// <see cref="ActivePreset"/> becomes the mapping's preset.
        /// </summary>
        /// <remarks>
        /// Only <c>renderScale</c> and <c>msaaSampleCount</c> are written to the active URP
        /// pipeline asset (the two dimensions URP owns directly). The remaining mapping
        /// dimensions (VFX density, shadows, anisotropic) are published via
        /// <see cref="PresetApplied"/> for consumer-side application (VFX epic scope).
        /// </remarks>
        ApplyStatus ApplyPreset(QualityPresetMapping mapping);

        /// <summary>Raised after a preset is successfully applied (observable publication).</summary>
        event Action<QualityPresetMapping> PresetApplied;

        /// <summary>
        /// The currently active preset. Becomes <see cref="QualityPresetId.Custom"/> when an
        /// advanced display field owned by this story changes (VSync — Story 005 AC-DR7).
        /// </summary>
        QualityPresetId ActivePreset { get; }

        /// <summary>
        /// Marks the active preset as <see cref="QualityPresetId.Custom"/>. Called when VSync
        /// changes (the only advanced field in the shipped DisplayData schema) — Story 005 AC-DR7.
        /// </summary>
        void MarkCustomOverride();
    }
}
