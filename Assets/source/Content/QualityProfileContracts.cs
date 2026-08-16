using System;
using Overdrive.Settings.Core;

namespace Overdrive.Content
{
    /// <summary>
    /// Source of the currently applied quality preset (story 3-14). Settings owns the
    /// preset (selected/default/fallback); Content consumes <see cref="Current"/> to
    /// derive the texture mipmap policy. The value reflects the APPLIED preset
    /// (last <c>ApplyPreset</c>/<c>MarkCustomOverride</c>), never a persisted-only value.
    /// </summary>
    public interface IQualityProfileSource
    {
        /// <summary>The currently applied preset (Low/Medium/High/Ultra/Custom).</summary>
        QualityPresetId Current { get; }
    }

    /// <summary>
    /// Runtime performance-protection override (GDD:114, ADR-0010). While
    /// <see cref="IsReduced"/> is true, quality consumers must use the Low-equivalent
    /// level. The override NEVER rewrites persisted preferences — it remaps behavior
    /// only while active and restores on <see cref="Changed"/>(false).
    /// </summary>
    public interface IQualityOverrideSource
    {
        /// <summary>True while performance protection forces Low-equivalent quality.</summary>
        bool IsReduced { get; }

        /// <summary>Fires on IsReduced transitions (true = reduced, false = restored). Exactly once per transition.</summary>
        event Action<bool> Changed;
    }

    /// <summary>
    /// Engine seam for the texture mipmap policy (story 3-14). The engine-free core
    /// derives the limit via <see cref="MipmapLimitResolver"/>; the Unity implementation
    /// writes <c>QualitySettings.globalTextureMipmapLimit</c>. The 0-3 range is a
    /// resolver policy, not an engine constraint — the API accepts any int.
    /// </summary>
    public interface ITextureMipmapApplier
    {
        /// <summary>Applies the mipmap limit (0 = full resolution).</summary>
        void Apply(int limit);
    }
}
