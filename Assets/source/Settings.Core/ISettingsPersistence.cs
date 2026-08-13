namespace Overdrive.Settings.Core
{
    /// <summary>
    /// The persistence seam consumed by <see cref="SettingsBlobService"/>: the backup-first atomic
    /// write, the load cascade read, and the per-level valid-read probe. Implemented by
    /// <see cref="SettingsPersistence"/>; injectable so orchestration can be tested against a fake.
    /// </summary>
    public interface ISettingsPersistence
    {
        /// <summary>
        /// Reads the highest valid cascade level (primary → backup → none). Returns a result that
        /// records which source was used; a corrupt level is skipped, never thrown.
        /// </summary>
        SettingsPersistence.LoadResult Load();

        /// <summary>
        /// Backup-first atomic write of a validated version-3 blob.
        /// </summary>
        /// <returns>The save outcome.</returns>
        SaveResult Save(string json);

        /// <summary>
        /// Attempts to read one cascade level, returning true only when the key exists AND its value
        /// parses as JSON (a valid-bytes-but-corrupt blob is treated as absent).
        /// </summary>
        bool TryReadValid(string key, out string json);
    }
}
