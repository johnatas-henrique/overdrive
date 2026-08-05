using System;
using UnityEngine;

namespace RaceFeel
{
    /// <summary>
    /// Applies the art-book primary team color to the Carrera body materials
    /// while preserving the imported body texture and non-body materials.
    /// </summary>
    public sealed class CarVisualLivery : MonoBehaviour
    {
        private const string BodyMaterialName = "CARRERA_4096";
        private const string MatteMaterialName = "CARRERA_4096_MATTE";
        private const string BaseColorProperty = "_BaseColor";

        private static readonly string[] TeamPrimaryHexes =
        {
            "#E03C31", // McLaren / Madonna
            "#DC2828", // Ferrari / Firenze
            "#1A3A6B", // Williams / Millions
            "#2E7D32", // Benetton / Bestowal
            "#66C5C5", // March / May
            "#E8A830", // Lotus / Losel
            "#1E4D8C", // Tyrrell / Tyrant
            "#1A3A8C", // Brabham / Blanche
            "#F5C518", // Minardi / Minarae
            "#0D2B5E", // Ligier / Linden
            "#DC2828", // Dallara / Dardan
            "#FFF8F0", // Arrows / Bullets
            "#1A3A8C", // Rial / Rigel
            "#FFF8F0", // Coloni / Comet
            "#1A2A5C", // Onyx / Orchis
            "#8B1A1A"  // Zakspeed / Zeroforce
        };

        [SerializeField, Range(0, 15)]
        private int defaultTeamIndex = 15;

        private Renderer[] _renderers = Array.Empty<Renderer>();
        private MaterialPropertyBlock _propertyBlock;

        /// <summary>Gets the currently applied team index.</summary>
        public int CurrentTeamIndex { get; private set; } = -1;

        private void Awake()
        {
            _renderers = GetComponentsInChildren<Renderer>(true);
            _propertyBlock = new MaterialPropertyBlock();
            ApplyTeamColor(defaultTeamIndex);
        }

        /// <summary>
        /// Applies one art-book primary color to body and matte slots.
        /// Example: ApplyTeamColor(0) selects the McLaren primary color.
        /// </summary>
        public void ApplyTeamColor(int teamIndex)
        {
            if (teamIndex < 0 || teamIndex >= TeamPrimaryHexes.Length)
                throw new ArgumentOutOfRangeException(nameof(teamIndex), teamIndex, "Expected a team index from 0 to 15.");

            if (!ColorUtility.TryParseHtmlString(TeamPrimaryHexes[teamIndex], out var color))
                throw new InvalidOperationException($"Invalid team color '{TeamPrimaryHexes[teamIndex]}'.");

            _renderers = _renderers == null || _renderers.Length == 0
                ? GetComponentsInChildren<Renderer>(true)
                : _renderers;
            _propertyBlock ??= new MaterialPropertyBlock();

            foreach (var renderer in _renderers)
                ApplyColorToBodySlots(renderer, color);

            CurrentTeamIndex = teamIndex;
        }

        private void ApplyColorToBodySlots(Renderer renderer, Color color)
        {
            var materials = renderer.sharedMaterials;
            for (var materialIndex = 0; materialIndex < materials.Length; materialIndex++)
            {
                var material = materials[materialIndex];
                if (!IsBodyMaterial(material)) continue;

                _propertyBlock.Clear();
                renderer.GetPropertyBlock(_propertyBlock, materialIndex);
                _propertyBlock.SetColor(BaseColorProperty, color);
                renderer.SetPropertyBlock(_propertyBlock, materialIndex);
            }
        }

        private static bool IsBodyMaterial(Material material)
        {
            if (material == null) return false;
            return material.name == BodyMaterialName || material.name == MatteMaterialName;
        }
    }
}
