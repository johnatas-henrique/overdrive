namespace Overdrive.Settings.Core
{
    /// <summary>
    /// Resolves a stored difficulty tier identifier to its immutable
    /// <c>Overdrive.Simulation.DifficultyProfile</c> row (ADR-0004:167).
    /// Engine-free port: the Unity-backed catalog (ScriptableObject assets)
    /// implements this in the <c>Overdrive.Settings</c> assembly; engine-free
    /// consumers and tests inject a fake catalog.
    /// </summary>
    public interface IDifficultyProfileCatalog
    {
        /// <summary>
        /// Returns the immutable profile row for the given tier level.
        /// </summary>
        /// <param name="level">Tier identifier 0-4 (Very Easy..Very Hard).</param>
        /// <returns>The fully populated immutable profile.</returns>
        /// <exception cref="System.ArgumentOutOfRangeException">
        /// Thrown when <paramref name="level"/> is outside
        /// <see cref="DifficultySelection.MinLevel"/>..<see cref="DifficultySelection.MaxLevel"/>.</exception>
        Overdrive.Simulation.DifficultyProfile GetProfile(int level);
    }
}
