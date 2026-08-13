using System;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// The high-level settings blob service: orchestrates the full load and save sequences that the
    /// persistence core + migration + validator expose individually. This is the primary entry point
    /// the Unity adapter and tests consume.
    ///
    /// Load sequence (ADR-0004:204-210): read primary → if corrupt/missing try backup → if backup also
    /// corrupt/missing factory defaults → migrate loaded blob to current version (sequential v1→v2→v3)
    /// → validate every field (non-finite → per-field default).
    ///
    /// Save sequence (ADR-0004:48, :62): serialize → validate → write backup → write primary →
    /// <c>Save()</c> → report Success.
    /// </summary>
    public sealed class SettingsBlobService
    {
        private readonly ISettingsPersistence _persistence;

        /// <summary>Creates the blob service over the persistence seam.</summary>
        /// <param name="persistence">The persistence seam (backup-first save, load cascade).</param>
        public SettingsBlobService(ISettingsPersistence persistence)
        {
            _persistence = persistence ?? throw new ArgumentNullException(nameof(persistence));
        }

        /// <summary>
        /// The result of a full load: the resolved version-3 settings data plus whether a restoration
        /// event occurred (backup used, or factory defaults loaded because both were corrupt).
        /// </summary>
        public readonly struct LoadOutcome
        {
            /// <summary>Creates a load outcome.</summary>
            /// <param name="settings">The resolved, migrated, validated settings.</param>
            /// <param name="usedBackup">Whether the backup blob was loaded (primary was corrupt/missing).</param>
            /// <param name="usedDefaults">Whether factory defaults were loaded (both corrupt/missing).</param>
            public LoadOutcome(GameSettingsData settings, bool usedBackup, bool usedDefaults)
            {
                Settings = settings;
                UsedBackup = usedBackup;
                UsedDefaults = usedDefaults;
            }

            /// <summary>The resolved, migrated, validated settings.</summary>
            public GameSettingsData Settings { get; }

            /// <summary>Whether the backup blob was loaded.</summary>
            public bool UsedBackup { get; }

            /// <summary>Whether factory defaults were loaded.</summary>
            public bool UsedDefaults { get; }
        }



        /// <summary>
        /// Validates and persists the settings (backup-first atomic write, ADR-0004:48).
        /// </summary>
        /// <param name="settings">The settings to persist (must be version 3).</param>
        /// <returns>The save outcome.</returns>
        public SaveResult Save(GameSettingsData settings)
        {
            if (settings.Version != SettingsSchema.CurrentVersion)
                throw new ArgumentException($"Save requires version {SettingsSchema.CurrentVersion}; got {settings.Version}.", nameof(settings));

            // Serialize → validate → backup-first write.
            string json = SettingsJsonCodec.Serialize(settings);
            json = SettingsValidator.Validate(json);
            return _persistence.Save(json);
        }

        /// <summary>
        /// Best-effort persistence of the factory defaults on first launch (GDD settings.md:84):
        /// "factory defaults become active and the system attempts to persist them". Never throws —
        /// a failed initial write leaves defaults active for the session (the caller reports the
        /// save warning).
        /// </summary>
        /// <returns>The save outcome (caller ignores it beyond warning reporting).</returns>
        public SaveResult TryPersistDefaults()
        {
            try
            {
                return Save(GameSettingsData.Defaults);
            }
            catch (Exception)
            {
                return SaveResult.BackupFailed;
            }
        }

        /// <summary>
        /// Loads, migrates, and validates the settings blob, falling back through primary → backup →
        /// factory defaults (ADR-0004:204-210, GDD:84). A level is VALID only when it parses as JSON
        /// AND migrates/validates successfully — a semantically corrupt blob (e.g. unsupported version)
        /// falls through to the next level, never crashing the load.
        /// </summary>
        /// <returns>The load outcome.</returns>
        public LoadOutcome Load()
        {
            if (TryLoadAndProcess(SettingsPersistence.PrimaryKey, out LoadOutcome primary))
                return primary;
            if (TryLoadAndProcess(SettingsPersistence.BackupKey, out LoadOutcome backup))
                return backup;
            return new LoadOutcome(GameSettingsData.Defaults, usedBackup: false, usedDefaults: true);
        }

        /// <summary>Attempts to read, migrate, and validate one cascade level. Returns false when the level is absent or corrupt.</summary>
        private bool TryLoadAndProcess(string key, out LoadOutcome outcome)
        {
            outcome = default;
            if (!_persistence.TryReadValid(key, out string json)) return false;

            try
            {
                string migrated = SettingsMigration.MigrateToCurrent(json);
                string validated = SettingsValidator.Validate(migrated);
                GameSettingsData data = SettingsJsonCodec.Deserialize(validated);
                outcome = new LoadOutcome(data, usedBackup: key == SettingsPersistence.BackupKey, usedDefaults: false);
                return true;
            }
            catch (Exception)
            {
                // Processing failure (migration/validation/deserialization) = corrupt level → next.
                return false;
            }
        }
    }
}
