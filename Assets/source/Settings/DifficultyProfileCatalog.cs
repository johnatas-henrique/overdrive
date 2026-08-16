using System;
using Overdrive.Settings.Core;
using Overdrive.Simulation;
using UnityEngine;

namespace Overdrive.Settings
{
    /// <summary>
    /// Unity-backed implementation of <see cref="IDifficultyProfileCatalog"/>:
    /// maps the stored tier identifier to the immutable
    /// <see cref="Overdrive.Simulation.DifficultyProfile"/> struct using the five
    /// <see cref="DifficultyProfileData"/> assets under
    /// <c>Assets/Settings/Difficulty/</c> (ADR-0004:167).
    /// </summary>
    [CreateAssetMenu(fileName = "DifficultyProfileCatalog", menuName = "Overdrive/Difficulty Profile Catalog")]
    public sealed class DifficultyProfileCatalog : ScriptableObject, IDifficultyProfileCatalog
    {
        [SerializeField] private DifficultyProfileData[] _profiles = new DifficultyProfileData[0];

        /// <summary>The five tier assets, one per level 0-4.</summary>
        public DifficultyProfileData[] Profiles => _profiles;

        /// <summary>
        /// Assigns the tier assets (editor tooling, tests, and composition root).
        /// </summary>
        /// <param name="profiles">Five assets indexed by level 0-4.</param>
        public void Configure(DifficultyProfileData[] profiles)
        {
            _profiles = profiles ?? throw new ArgumentNullException(nameof(profiles));
        }

        /// <inheritdoc/>
        public DifficultyProfile GetProfile(int level)
        {
            DifficultyProfileValidation.ValidateLevel(level);

            if (_profiles == null || _profiles.Length <= level || _profiles[level] == null)
            {
                throw new InvalidOperationException(
                    $"No DifficultyProfileData asset configured for level {level}. " +
                    $"Populate the catalog with all five assets under Assets/Settings/Difficulty/.");
            }

            DifficultyProfileData data = _profiles[level];
            return new DifficultyProfile(
                level,
                data.AiPrecision,
                data.AiErrorMultiplier,
                data.PaceNoise,
                data.PlayerOffTrackGrip,
                data.PlayerWallSpeedLoss);
        }
    }
}
