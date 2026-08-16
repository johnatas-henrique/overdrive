namespace Overdrive.Settings.Core
{
    /// <summary>
    /// The outcome of a settings save (ADR-0004:76).
    /// </summary>
    public enum SaveResult : byte
    {
        /// <summary>Backup and primary writes succeeded and the store was flushed.</summary>
        Success = 0,

        /// <summary>The backup write failed; the primary was not overwritten.</summary>
        BackupFailed = 1,

        /// <summary>The backup succeeded but the primary write (or restore) failed; backup remains intact for next-launch recovery.</summary>
        PrimaryFailed = 2
    }
}
