using Overdrive.Content;
using Overdrive.Settings.Core;

namespace Overdrive.Settings
{
    /// <summary>
    /// Unity-backed <see cref="IQualityProfileSource"/> (story 3-14): reports the
    /// APPLIED preset from <see cref="QualityPresetApplier.ActivePreset"/> — the last
    /// preset written by ApplyPreset/MarkCustomOverride, never a persisted-only value.
    /// Constructed by the app bootstrapper and injected into the Content composition
    /// root; no Content runtime dependency.
    /// </summary>
    public sealed class SettingsQualityProfileSource : IQualityProfileSource
    {
        private readonly QualityPresetApplier _applier;

        /// <summary>Wraps the applier as the source of truth for the applied preset.</summary>
        public SettingsQualityProfileSource(QualityPresetApplier applier)
        {
            _applier = applier ?? throw new System.ArgumentNullException(nameof(applier));
        }

        /// <inheritdoc />
        public QualityPresetId Current => _applier.ActivePreset;
    }
}
