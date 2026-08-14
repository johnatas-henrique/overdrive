using System;
using System.Collections.Generic;
using UnityEngine;

namespace Overdrive.Settings
{
    /// <summary>
    /// <see cref="IDisplayApi"/> adapter over the real Unity display surface (Story 005):
    /// <see cref="Screen.resolutions"/>, <see cref="Screen.SetResolution(int, int, FullScreenMode, RefreshRate)"/>
    /// (RefreshRate struct — the int overload is deprecated in Unity 6000.3), and
    /// <see cref="Screen.fullScreenMode"/>. The WebGL platform check is intentionally NOT
    /// implemented here — real platform validation is deferred to the WebGL target gate
    /// (the fake in unit tests covers the RejectedWebGLUnsupported path).
    /// </summary>
    public sealed class ScreenDisplayApi : IDisplayApi
    {
        /// <summary>Raised by this adapter (own event) when nearest-supported fallback occurs (DR2).</summary>
        public event Action<string> Warning;

        private readonly Func<FullScreenMode> _modeSource;
        private IReadOnlyList<DisplayState> _supportedCache;
        private FullScreenMode _cachedMode;

        /// <summary>Creates the adapter over the real display surface.</summary>
        public ScreenDisplayApi() : this(() => Screen.fullScreenMode) { }

        /// <summary>
        /// Creates the adapter with an explicit mode source (test seam — deterministic cache
        /// tests drive the mode without touching the live display; QA R10 F1/F2).
        /// </summary>
        /// <param name="modeSource">Supplies the current fullscreen mode (default: <see cref="Screen.fullScreenMode"/>).</param>
        public ScreenDisplayApi(Func<FullScreenMode> modeSource)
        {
            _modeSource = modeSource ?? throw new ArgumentNullException(nameof(modeSource));
        }

        /// <inheritdoc />
        public DisplayState CurrentState
        {
            get
            {
                RefreshRate rate = Screen.currentResolution.refreshRateRatio;
                return new DisplayState(
                    Screen.width,
                    Screen.height,
                    (int)rate.numerator,
                    (int)rate.denominator,
                    Screen.fullScreenMode);
            }
        }

        /// <inheritdoc />
        /// <remarks>
        /// Cached on first access per fullscreen MODE (QA R9 F1): the supported resolution SET
        /// cannot change while the game runs (a monitor swap requires a platform restart), but
        /// the fullscreen mode CAN change at runtime (windowed ↔ fullscreen transitions) — the
        /// cache is invalidated and rebuilt when <see cref="Screen.fullScreenMode"/> changes, so
        /// a mode-only request never resolves back to a stale mode. Caching also removes the
        /// TOCTOU hazard of re-querying <see cref="Screen.resolutions"/> between calls. Unity API
        /// limitation: <see cref="Screen.resolutions"/> carries no per-resolution mode data, so
        /// every entry is stamped with the CURRENT <see cref="Screen.fullScreenMode"/>.
        /// </remarks>
        public IReadOnlyList<DisplayState> SupportedStates
        {
            get
            {
                // Single snapshot per read (QA R10 F2 TOCTOU): the mode is captured ONCE and
                // used for both the invalidation check and the cache label — a mode flip between
                // separate reads can never leave the cache holding mode A while _cachedMode
                // records mode B.
                FullScreenMode mode = _modeSource();
                if (_supportedCache != null && _cachedMode == mode) return _supportedCache;
                _supportedCache = BuildSupportedStates(Screen.resolutions, mode);
                _cachedMode = mode;
                return _supportedCache;
            }
        }

        /// <summary>
        /// Builds the supported-state list, stamping every entry with <paramref name="mode"/>
        /// (QA R8 deterministic builder seam — the pure list construction is unit-testable
        /// without touching the live display; the runtime cache-mode-staleness risk is tracked
        /// under TD-034).
        /// </summary>
        /// <param name="resolutions">The platform resolution list (e.g. <see cref="Screen.resolutions"/>).</param>
        /// <param name="mode">The fullscreen mode stamped on every entry.</param>
        public static IReadOnlyList<DisplayState> BuildSupportedStates(Resolution[] resolutions, FullScreenMode mode)
        {
            var states = new List<DisplayState>(resolutions.Length);
            // Each supported resolution is applicable in the current fullscreen mode; a
            // zero/zero refresh rate (system default) is preserved as valid — the resolver
            // never divides by the denominator.
            for (int i = 0; i < resolutions.Length; i++)
            {
                RefreshRate rate = resolutions[i].refreshRateRatio;
                states.Add(new DisplayState(
                    resolutions[i].width,
                    resolutions[i].height,
                    (int)rate.numerator,
                    (int)rate.denominator,
                    mode));
            }
            return states;
        }

        /// <inheritdoc />
        public bool TryResolveRequested(DisplayState requested, out DisplayState resolved)
        {
            if (!DisplayStateResolver.TryResolveNearest(requested, SupportedStates, out DisplayState nearest))
            {
                resolved = default;
                return false;
            }

            // Mode requests are HONORED — windowed ↔ fullscreen transitions are supported by
            // Screen.SetResolution; only the RESOLUTION falls back to the nearest supported. The
            // supported list stamps every entry with the CURRENT mode (Unity API limitation —
            // Screen.resolutions carries no per-resolution mode data), so without stamping the
            // requested mode here, a mode-only change would resolve back to the current mode,
            // never reach the gate, and silently drop the player's choice (QA R9 F1 completion).
            resolved = new DisplayState(
                nearest.Width,
                nearest.Height,
                nearest.RefreshRateNumerator,
                nearest.RefreshRateDenominator,
                requested.ScreenMode);

            if (!DisplayStateResolver.SameState(resolved, requested))
            {
                Warning?.Invoke(
                    $"Requested display {requested.Width}x{requested.Height} is not supported — using nearest supported {resolved.Width}x{resolved.Height}.");
            }
            return true;
        }

        /// <inheritdoc />
        public DisplayPreviewResult ApplyPreview(DisplayState resolved)
        {
            // Defense-in-depth: refuse to apply when the platform exposes NO supported display
            // state (e.g. a broken display driver). The resolved state itself always comes from
            // a path that already resolved it (gate PrepareDisplayState or orchestrator
            // TryResolveRequested), so no per-call membership check is needed.
            if (SupportedStates.Count == 0) return DisplayPreviewResult.RejectedNoSupported;

            // RefreshRate fields are UInt32 — the int→uint cast is safe (rates are ≥ 0; negative
            // values from a defective caller are clamped to the 0/0 sentinel by ToRefreshRate —
            // QA R14 F3, release-safe — not just Debug.Assert).
            Screen.SetResolution(
                resolved.Width,
                resolved.Height,
                resolved.ScreenMode,
                DisplayStateResolver.ToRefreshRate(resolved.RefreshRateNumerator, resolved.RefreshRateDenominator));
            return DisplayPreviewResult.Applied;
        }

        /// <inheritdoc />
        public void Restore(DisplayState previousState)
        {
            Screen.SetResolution(
                previousState.Width,
                previousState.Height,
                previousState.ScreenMode,
                DisplayStateResolver.ToRefreshRate(previousState.RefreshRateNumerator, previousState.RefreshRateDenominator));
        }
    }
}
