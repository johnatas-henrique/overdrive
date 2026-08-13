using UnityEngine;

namespace Overdrive.Settings
{
    /// <summary>
    /// ScriptableObject asset holding one immutable difficulty row (ADR-0004:167).
    /// One instance per tier lives under <c>Assets/Settings/Difficulty/</c>; the
    /// <see cref="DifficultyProfileCatalog"/> collects the five into the catalog.
    /// </summary>
    [CreateAssetMenu(fileName = "Difficulty_", menuName = "Overdrive/Difficulty Profile")]
    public sealed class DifficultyProfileData : ScriptableObject
    {
        [SerializeField, Range(0, 4)] private int _level;
        [SerializeField, Range(0f, 1f)] private float _aiPrecision;
        [SerializeField, Range(0f, 2f)] private float _aiErrorMultiplier;
        [SerializeField, Range(0f, 0.5f)] private float _paceNoise;
        [SerializeField, Range(0f, 1f)] private float _playerOffTrackGrip;
        [SerializeField, Range(0f, 1f)] private float _playerWallSpeedLoss;

        /// <summary>Tier identifier 0-4 (Very Easy..Very Hard).</summary>
        public int Level => _level;

        /// <summary>AI lap-time precision multiplier.</summary>
        public float AiPrecision => _aiPrecision;

        /// <summary>AI error multiplier.</summary>
        public float AiErrorMultiplier => _aiErrorMultiplier;

        /// <summary>AI pace noise, +/- fraction.</summary>
        public float PaceNoise => _paceNoise;

        /// <summary>Player off-track grip multiplier.</summary>
        public float PlayerOffTrackGrip => _playerOffTrackGrip;

        /// <summary>Player wall-contact speed loss fraction.</summary>
        public float PlayerWallSpeedLoss => _playerWallSpeedLoss;

        /// <summary>
        /// Initializes this asset with the given row values (editor tooling and
        /// tests). Ignored when the asset is already configured.
        /// </summary>
        public void Configure(int level, float aiPrecision, float aiErrorMultiplier, float paceNoise,
            float playerOffTrackGrip, float playerWallSpeedLoss)
        {
            Overdrive.Settings.Core.DifficultyProfileValidation.ValidateLevel(level);
            _level = level;
            _aiPrecision = aiPrecision;
            _aiErrorMultiplier = aiErrorMultiplier;
            _paceNoise = paceNoise;
            _playerOffTrackGrip = playerOffTrackGrip;
            _playerWallSpeedLoss = playerWallSpeedLoss;
        }
    }
}
