using System;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// Engine-free guard for the difficulty tier domain (ADR-0004, story 3-4).
    /// The valid tier range is owned by <see cref="DifficultySelection"/> (0-4,
    /// Very Easy..Very Hard); this guard centralizes the range check so the
    /// ScriptableObject catalog and the edit session share one rule.
    /// </summary>
    public static class DifficultyProfileValidation
    {
        /// <summary>
        /// Validates a difficulty tier level against
        /// <see cref="DifficultySelection.MinLevel"/>..<see cref="DifficultySelection.MaxLevel"/>.
        /// </summary>
        /// <param name="level">The tier identifier to validate.</param>
        /// <exception cref="ArgumentOutOfRangeException">
        /// Thrown when <paramref name="level"/> is outside the approved range.</exception>
        public static void ValidateLevel(int level)
        {
            if (level < DifficultySelection.MinLevel || level > DifficultySelection.MaxLevel)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(level),
                    level,
                    $"Difficulty level must be within {DifficultySelection.MinLevel}..{DifficultySelection.MaxLevel} " +
                    $"(Very Easy..Very Hard); got {level}.");
            }
        }
    }
}
