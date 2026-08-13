using System;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// The persistence core: load cascade (primary → backup → factory defaults) and backup-first
    /// atomic save (ADR-0004:48, :62, :204-210). Engine-free — all storage access flows through the
    /// injected <see cref="IPlayerPrefsStore"/> port. The caller owns migrate-before-validate ordering
    /// (see <see cref="SettingsMigration"/> and <see cref="SettingsValidator"/>).
    /// </summary>
    public sealed class SettingsPersistence : ISettingsPersistence
    {
        /// <summary>The primary settings key (ADR-0004:69).</summary>
        public const string PrimaryKey = "OverdriveSettings";

        /// <summary>The backup settings key (ADR-0004:70).</summary>
        public const string BackupKey = "OverdriveSettings_Backup";

        private readonly IPlayerPrefsStore _store;

        /// <summary>Creates the persistence core over the injected store.</summary>
        /// <param name="store">The platform store port.</param>
        public SettingsPersistence(IPlayerPrefsStore store)
        {
            _store = store ?? throw new ArgumentNullException(nameof(store));
        }

        /// <summary>
        /// The result of a load: the resolved raw blob and whether it came from the backup or defaults.
        /// </summary>
        public readonly struct LoadResult
        {
            /// <summary>Creates a load result.</summary>
            /// <param name="json">The resolved raw blob (may be null when no valid blob exists — caller falls back to factory defaults).</param>
            /// <param name="source">Where the blob came from.</param>
            public LoadResult(string json, LoadSource source)
            {
                Json = json;
                Source = source;
            }

            /// <summary>The resolved raw blob, or null when nothing valid exists.</summary>
            public string Json { get; }

            /// <summary>Where the blob came from.</summary>
            public LoadSource Source { get; }
        }

        /// <summary>The source of a loaded blob.</summary>
        public enum LoadSource
        {
            /// <summary>Loaded from the primary key.</summary>
            Primary,

            /// <summary>Primary was corrupt/missing; loaded from the backup key.</summary>
            Backup,

            /// <summary>Both primary and backup were corrupt/missing; no blob returned (caller uses factory defaults).</summary>
            None
        }

        /// <summary>
        /// Loads the settings blob following the cascade: primary → backup → None.
        /// A blob is considered VALID when it exists AND parses as JSON. (Validation of version/values
        /// is the caller's responsibility after migration.)
        /// </summary>
        /// <returns>The load result.</returns>
        public LoadResult Load()
        {
            if (TryReadValid(PrimaryKey, out string primary)) return new LoadResult(primary, LoadSource.Primary);
            if (TryReadValid(BackupKey, out string backup)) return new LoadResult(backup, LoadSource.Backup);
            return new LoadResult(null, LoadSource.None);
        }

        /// <summary>
        /// Backup-first atomic save (ADR-0004:48, :62, GDD:86): serialize → validate (caller) →
        /// preserve the VALID CURRENT PRIMARY in the backup key → write primary → <c>Save()</c> →
        /// report Success. The backup must hold the previous primary (not the new blob) so a corrupt
        /// new write can be rolled back. A backup failure aborts before touching the primary. A
        /// primary failure after a successful backup attempts restore-from-backup; if restore also
        /// fails, the backup stays intact for next-launch recovery.
        /// </summary>
        /// <param name="json">The validated version-3 blob to persist.</param>
        /// <returns>The save outcome.</returns>
        public SaveResult Save(string json)
        {
            if (json == null) throw new ArgumentNullException(nameof(json));

            // Backup-first: preserve the valid CURRENT primary in the backup key BEFORE overwriting
            // (GDD:86). When no valid primary exists (first launch) or the primary is corrupt, seed
            // the backup with the new blob as a minimal recovery anchor.
            if (!TryWriteBackup(json)) return SaveResult.BackupFailed;

            try
            {
                _store.SetString(PrimaryKey, json);
            }
            catch (Exception)
            {
                // Primary write failed after backup succeeded: attempt restore from backup; if restore
                // also fails, the backup stays intact for next-launch recovery.
                TryRestoreFromBackup();
                return SaveResult.PrimaryFailed;
            }

            // Explicit flush — SetString alone does not synchronously persist on all platforms (ADR-0004:62).
            try
            {
                _store.Save();
            }
            catch (Exception)
            {
                // Flush failure still reports PrimaryFailed: the primary write completed but durability
                // is not guaranteed; the backup remains intact.
                return SaveResult.PrimaryFailed;
            }

            return SaveResult.Success;
        }

        /// <summary>
        /// Writes the backup key: the VALID CURRENT PRIMARY (when one exists) is preserved, so a
        /// corrupt new write can be rolled back; otherwise (first launch / corrupt primary) the new
        /// blob seeds the backup as a minimal recovery anchor. Returns false when the backup write
        /// failed (Apply must abort before touching the primary).
        /// </summary>
        private bool TryWriteBackup(string json)
        {
            try
            {
                if (HasValidPrimary(out string currentPrimary))
                {
                    _store.SetString(BackupKey, currentPrimary);
                }
                else
                {
                    _store.SetString(BackupKey, json);
                }
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        /// <summary>
        /// Attempts restore-from-backup after a primary write failure. The restored primary is
        /// flushed (ADR-0004:62) so it cannot be lost on abrupt termination. A restore failure is
        /// swallowed — the backup remains intact for next-launch recovery.
        /// </summary>
        private void TryRestoreFromBackup()
        {
            try
            {
                if (_store.HasKey(BackupKey))
                {
                    string backup = _store.GetString(BackupKey);
                    _store.SetString(PrimaryKey, backup);
                    _store.Save();
                }
            }
            catch (Exception)
            {
                // Restore failed — backup remains intact for next-launch recovery.
            }
        }

        private bool HasValidPrimary(out string primary)
        {
            primary = null;
            try
            {
                if (!_store.HasKey(PrimaryKey)) return false;
                string value = _store.GetString(PrimaryKey);
                if (string.IsNullOrEmpty(value)) return false;
                JsonNode.Parse(value);
                primary = value;
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        /// <summary>
        /// Attempts to read one cascade level, returning true only when the key exists AND its value
        /// parses as JSON (a valid-bytes-but-corrupt blob is treated as absent).
        /// </summary>
        /// <param name="key">The storage key to read.</param>
        /// <param name="json">The raw blob when valid.</param>
        /// <returns>True when a parseable blob was read.</returns>
        public bool TryReadValid(string key, out string json)
        {
            json = null;
            try
            {
                if (!_store.HasKey(key)) return false;
                string value = _store.GetString(key);
                if (string.IsNullOrEmpty(value)) return false;

                // A blob is valid only if it parses as JSON.
                JsonNode.Parse(value);
                json = value;
                return true;
            }
            catch (Exception)
            {
                // Corrupt (unparseable) blob → try the next cascade level.
                return false;
            }
        }
    }
}
