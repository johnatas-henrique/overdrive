using System;
using Overdrive.Settings.Core;

namespace Overdrive.Content
{
    /// <summary>
    /// Pure preset→mipmap-limit table (story 3-14, GDD QP1/QP2). Low uses a higher
    /// limit (lower texture resolution); High/Ultra use full resolution (0).
    /// Custom (display-customization state, set by <c>MarkCustomOverride</c>) has no
    /// preset mapping — the policy falls back to the quality default (Medium-equivalent,
    /// matching DefaultPreset). Values are exact ints; tests assert them independently
    /// (the 0-3 range is this resolver's policy, not a QualitySettings constraint).
    /// </summary>
    public static class MipmapLimitResolver
    {
        /// <summary>Maps a preset to its mipmap limit (0 = full resolution).</summary>
        public static int Resolve(QualityPresetId preset)
        {
            switch (preset)
            {
                case QualityPresetId.Low: return 2;
                case QualityPresetId.Medium: return 1;
                case QualityPresetId.High: return 0;
                case QualityPresetId.Ultra: return 0;
                case QualityPresetId.Custom: return 1; // Medium-equivalent fallback (ADR-0010: custom tweaks do not degrade below Medium)
                default:
                    throw new ArgumentOutOfRangeException(nameof(preset), preset, "Unknown quality preset.");
            }
        }
    }
}
