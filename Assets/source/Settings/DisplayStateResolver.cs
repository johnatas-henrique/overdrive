using System;
using System.Collections.Generic;
using UnityEngine;

namespace Overdrive.Settings
{
    /// <summary>
    /// Pure deterministic helpers for display-state resolution (Story 005). No Unity runtime
    /// calls — safe to use from both the gate (matching prepared state) and the adapter
    /// (nearest-supported resolution), and unit-testable with plain data.
    /// </summary>
    public static class DisplayStateResolver
    {
        /// <summary>
        /// Resolves <paramref name="requested"/> to the nearest supported state.
        /// Distance = |requested.Width·Height − candidate.Width·Height| (ABSOLUTE area
        /// difference); the candidate with the smallest distance wins ALWAYS — including when
        /// all candidates are larger than requested (no special upscale rule). Ties are broken
        /// lexicographically by (Width, Height, RefreshRateNumerator, RefreshRateDenominator,
        /// ScreenMode). Returns false when <paramref name="supported"/> is null or empty.
        /// </summary>
        /// <param name="requested">The requested display state.</param>
        /// <param name="supported">The supported states (from the display adapter).</param>
        /// <param name="resolved">The nearest supported state (default when false).</param>
        /// <returns>True when a candidate exists; false when the supported list is empty.</returns>
        public static bool TryResolveNearest(DisplayState requested, IReadOnlyList<DisplayState> supported, out DisplayState resolved)
        {
            if (supported == null || supported.Count == 0)
            {
                resolved = default;
                return false;
            }

            long requestedArea = (long)requested.Width * requested.Height;
            DisplayState best = default;
            long bestDistance = long.MaxValue;

            for (int i = 0; i < supported.Count; i++)
            {
                DisplayState candidate = supported[i];
                long area = (long)candidate.Width * candidate.Height;
                long distance = Math.Abs(requestedArea - area);

                if (distance < bestDistance || (distance == bestDistance && i > 0 && IsLexicographicallyLess(candidate, best)))
                {
                    best = candidate;
                    bestDistance = distance;
                }
            }

            resolved = best;
            return true;
        }

        /// <summary>
        /// Lexicographic tie-break: (Width, Height, RefreshRateNumerator, RefreshRateDenominator,
        /// ScreenMode). True when <paramref name="a"/> sorts before <paramref name="b"/>.
        /// </summary>
        private static bool IsLexicographicallyLess(DisplayState a, DisplayState b)
        {
            if (a.Width != b.Width) return a.Width < b.Width;
            if (a.Height != b.Height) return a.Height < b.Height;
            if (a.RefreshRateNumerator != b.RefreshRateNumerator) return a.RefreshRateNumerator < b.RefreshRateNumerator;
            if (a.RefreshRateDenominator != b.RefreshRateDenominator) return a.RefreshRateDenominator < b.RefreshRateDenominator;
            return (int)a.ScreenMode < (int)b.ScreenMode;
        }

        /// <summary>
        /// Canonical int → <see cref="FullScreenMode"/> conversion (Story 005 R4 finding 9,
        /// using the SHIPPED int semantics from <c>DisplayData.FullscreenMode</c>):
        /// 0=Windowed → Windowed(3), 1=FullScreen → ExclusiveFullScreen(0), 2=Borderless →
        /// FullScreenWindow(1). The two conventions are NOT aligned — a direct cast is a real
        /// bug. Unknown values defensively map to <see cref="FullScreenMode.Windowed"/>.
        /// </summary>
        public static FullScreenMode ToFullScreenMode(int intMode)
        {
            switch (intMode)
            {
                case 0: return FullScreenMode.Windowed;
                case 1: return FullScreenMode.ExclusiveFullScreen;
                case 2: return FullScreenMode.FullScreenWindow;
                default:
                    Debug.LogWarning($"Unknown display fullscreen-mode int {intMode} — falling back to Windowed.");
                    return FullScreenMode.Windowed;
            }
        }

        /// <summary>
        /// Canonical <see cref="FullScreenMode"/> → int conversion (inverse of
        /// <see cref="ToFullScreenMode"/>): Windowed→0, ExclusiveFullScreen→1,
        /// FullScreenWindow→2. <see cref="FullScreenMode.MaximizedWindow"/> is not representable
        /// in the persisted schema (int domain 0-2) and maps to 0 (Windowed).
        /// </summary>
        public static int ToIntMode(FullScreenMode mode)
        {
            switch (mode)
            {
                case FullScreenMode.Windowed: return 0;
                case FullScreenMode.ExclusiveFullScreen: return 1;
                case FullScreenMode.FullScreenWindow: return 2;
                default:
                    Debug.LogWarning($"FullScreenMode {mode} is not representable in the persisted int schema — mapping to Windowed (0).");
                    return 0;
            }
        }

        /// <summary>
        /// Structural equality of the resolvable attributes (width, height, refresh fraction,
        /// mode). Used by the adapter to decide whether a warning is needed (resolved != requested).
        /// </summary>
        public static bool SameState(DisplayState a, DisplayState b)
        {
            return a.Width == b.Width
                && a.Height == b.Height
                && a.RefreshRateNumerator == b.RefreshRateNumerator
                && a.RefreshRateDenominator == b.RefreshRateDenominator
                && a.ScreenMode == b.ScreenMode;
        }

        /// <summary>
        /// Release-safe refresh-rate construction (QA R14 F3, R15 F1): a NEGATIVE component on
        /// either side (invalid — <see cref="Screen.resolutions"/> exposes uint, so negatives can
        /// only arrive from a defective caller) collapses the whole pair to 0/0, the
        /// system-default sentinel (RefreshRate{0,0} is valid — #378). This is stricter than
        /// per-component clamping: a zero denominator alone (e.g. 60/0) is a division-by-zero
        /// hazard, so mixed signs never produce a partially-valid rate. A non-negative int
        /// converts to uint losslessly. Shared by the adapter's preview and restore paths so both
        /// honor the same conversion.
        /// </summary>
        public static RefreshRate ToRefreshRate(int numerator, int denominator)
        {
            if (numerator < 0 || denominator < 0)
            {
                return new RefreshRate { numerator = 0u, denominator = 0u };
            }
            return new RefreshRate { numerator = (uint)numerator, denominator = (uint)denominator };
        }
    }
}
