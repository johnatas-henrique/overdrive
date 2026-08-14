using System;
using UnityEngine;
using UnityEngine.Rendering.Universal;

namespace Overdrive.Settings
{
    /// <summary>
    /// <see cref="IQualityPresetApplier"/> adapter over the URP render pipeline asset
    /// (Story 005 AC-DR6/DR7). ResolveMapping is a pure table (GDD settings.md:120-125);
    /// ApplyPreset writes the render scale and MSAA to the active
    /// <see cref="UniversalRenderPipelineAsset"/> (read via <see cref="QualitySettings.renderPipeline"/>,
    /// which returns the active pipeline — <c>GraphicsSettings.renderPipelineAsset</c> is the
    /// global override and may be null). Returns <see cref="ApplyStatus.Rejected"/> when no URP
    /// asset is active. Does NOT own URP shader compilation (E6 — deferred to the VFX epic);
    /// VFX density, shadows, and anisotropic are published via <see cref="PresetApplied"/> for
    /// consumers.
    /// </summary>
    public sealed class QualityPresetApplier : IQualityPresetApplier
    {
        /// <summary>The default preset (Medium — matches <c>DisplayData.Default</c> quality preset 1).</summary>
        public QualityPresetId DefaultPreset => QualityPresetId.Medium;

        /// <inheritdoc />
        public event Action<QualityPresetMapping> PresetApplied;

        /// <inheritdoc />
        public QualityPresetId ActivePreset { get; private set; } = QualityPresetId.Medium;

        /// <inheritdoc />
        public QualityPresetMapping ResolveMapping(QualityPresetId id)
        {
            switch (id)
            {
                case QualityPresetId.Low:
                    return new QualityPresetMapping(QualityPresetId.Low, 0.75f, VfxDensityLevel.Low, ShadowLevel.Off, MSAASamples.Off, AnisotropicLevel.PerTexture);
                case QualityPresetId.Medium:
                    return new QualityPresetMapping(QualityPresetId.Medium, 0.85f, VfxDensityLevel.Medium, ShadowLevel.Soft, MSAASamples.X2, AnisotropicLevel.ForcedOn);
                case QualityPresetId.High:
                    return new QualityPresetMapping(QualityPresetId.High, 1.0f, VfxDensityLevel.High, ShadowLevel.Hard, MSAASamples.X4, AnisotropicLevel.ForcedOn);
                case QualityPresetId.Ultra:
                    return new QualityPresetMapping(QualityPresetId.Ultra, 1.0f, VfxDensityLevel.Ultra, ShadowLevel.Hard, MSAASamples.X4, AnisotropicLevel.ForcedOn);
                default:
                    throw new ArgumentOutOfRangeException(nameof(id), id, "Custom has no preset mapping — resolve a real preset (Low..Ultra).");
            }
        }

        /// <inheritdoc />
        public ApplyStatus ApplyPreset(QualityPresetMapping mapping)
        {
            // QualitySettings.renderPipeline returns the ACTIVE pipeline for the current quality
            // level (GraphicsSettings.renderPipelineAsset is the optional global override and is
            // null when unset — verified in the Unity 6000.3.22f1 editor).
            var pipeline = QualitySettings.renderPipeline as UniversalRenderPipelineAsset;
            if (pipeline == null) return ApplyStatus.Rejected;

            pipeline.renderScale = mapping.RenderScale;
            pipeline.msaaSampleCount = (int)mapping.MSAA;

            ActivePreset = mapping.PresetId;
            PresetApplied?.Invoke(mapping);
            return ApplyStatus.Applied;
        }

        /// <inheritdoc />
        public void MarkCustomOverride()
        {
            ActivePreset = QualityPresetId.Custom;
        }
    }
}
