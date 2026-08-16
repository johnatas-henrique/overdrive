using System;
using System.Collections.Generic;
using NUnit.Framework;
using Overdrive.Settings.Core;

namespace Overdrive.Settings.Core.Tests
{
    /// <summary>
    /// Verifies Settings Persistence &amp; Migration (Story 001): backup-first atomic save, load cascade
    /// (primary → backup → factory defaults), sequential schema migration v1→v3, per-field validation,
    /// duplicate-binding de-duplication with warning sink, and the AC-E1/E3 simulated failure/restart
    /// paths. Engine-free — all storage flows through the fake store.
    /// </summary>
    public class SettingsPersistenceTests
    {
        // ------------------------------------------------------------------ //
        // Fake store
        // ------------------------------------------------------------------ //

        /// <summary>In-memory store recording the call sequence for backup-first atomicity assertions.</summary>
        private sealed class FakeStore : IPlayerPrefsStore
        {
            public readonly Dictionary<string, string> Data = new Dictionary<string, string>();
            public readonly List<string> Calls = new List<string>();
            public bool ThrowOnSetString;
            public bool ThrowOnSave;
            public bool ThrowOnGetString;
            public bool ThrowOnHasKey;

            public string GetString(string key)
            {
                Calls.Add($"Get:{key}");
                if (ThrowOnGetString) throw new InvalidOperationException("GetString simulated failure.");
                return Data.TryGetValue(key, out string value) ? value : null;
            }

            public bool HasKey(string key)
            {
                Calls.Add($"Has:{key}");
                if (ThrowOnHasKey) throw new InvalidOperationException("HasKey simulated failure.");
                return Data.ContainsKey(key);
            }

            public void SetString(string key, string value)
            {
                Calls.Add($"Set:{key}");
                if (ThrowOnSetString) throw new InvalidOperationException("SetString simulated failure.");
                Data[key] = value;
            }

            public void Save()
            {
                Calls.Add("Save");
                if (ThrowOnSave) throw new InvalidOperationException("Save simulated failure.");
            }
        }

        private static FakeStore NewStore() => new FakeStore();

        private static SettingsBlobService NewService(IPlayerPrefsStore store) => new SettingsBlobService(new SettingsPersistence(store));

        // ------------------------------------------------------------------ //
        // AC-S1: first launch loads factory defaults
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_S1_FirstLaunchLoadsFactoryDefaultsAcrossSixCategories()
        {
            var store = NewStore();
            var service = NewService(store);

            var outcome = service.Load();

            Assert.That(outcome.UsedDefaults, Is.True, "No persisted blob must fall back to defaults.");
            Assert.That(outcome.UsedBackup, Is.False);
            Assert.That(outcome.Settings.Version, Is.EqualTo(SettingsSchema.CurrentVersion));

            // All six categories reflect defaults.
            Assert.That(outcome.Settings.Difficulty.Level, Is.EqualTo(DifficultySelection.Default.Level));
            Assert.That(outcome.Settings.Controls.StickInner, Is.EqualTo(ControlsData.Default.StickInner).Within(1e-6f));
            Assert.That(outcome.Settings.Audio.Master, Is.EqualTo(AudioData.Default.Master).Within(1e-6f));
            Assert.That(outcome.Settings.Display.ResolutionWidth, Is.EqualTo(DisplayData.Default.ResolutionWidth));
            Assert.That(outcome.Settings.Accessibility.TextScale, Is.EqualTo(AccessibilityData.Default.TextScale).Within(1e-6f));
            Assert.That(outcome.Settings.Camera.ReducedMotion, Is.EqualTo(CameraData.Default.ReducedMotion));
        }

        // ------------------------------------------------------------------ //
        // AC-S2: Apply writes version-3 blob backup-first
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_S2_ApplyWritesBackupThenPrimaryThenSave()
        {
            var store = NewStore();
            var service = NewService(store);

            // Seed a DISTINCT prior primary so we can prove the backup preserves it (not the new blob).
            var prior = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                new DifficultySelection(1),
                ControlsData.Default,
                new AudioData(0.4f, 1f, 1f, 1f, false, false),
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);
            string priorJson = SettingsJsonCodec.Serialize(prior);
            store.Data[SettingsPersistence.PrimaryKey] = priorJson;

            var updated = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                new DifficultySelection(4),
                ControlsData.Default,
                new AudioData(0.9f, 1f, 1f, 1f, false, false),
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);
            var result = service.Save(updated);

            Assert.That(result, Is.EqualTo(SaveResult.Success));

            // Call sequence must be backup Set → primary Set → Save.
            int backupIdx = store.Calls.IndexOf("Set:OverdriveSettings_Backup");
            int primaryIdx = store.Calls.IndexOf("Set:OverdriveSettings");
            int saveIdx = store.Calls.IndexOf("Save");
            Assert.That(backupIdx, Is.GreaterThanOrEqualTo(0), "Backup must be written.");
            Assert.That(primaryIdx, Is.GreaterThan(backupIdx), "Backup must be written BEFORE primary.");
            Assert.That(saveIdx, Is.GreaterThan(primaryIdx), "Save() must be called AFTER the writes (ADR-0004:62).");

            // The backup must hold the PRIOR primary (GDD:86) — not the new blob.
            Assert.That(store.Data[SettingsPersistence.BackupKey], Is.EqualTo(priorJson),
                "Backup must preserve the previous valid primary, not duplicate the new blob.");
            // The primary holds the new version-3 blob — with the UPDATED values.
            var persisted = SettingsJsonCodec.Deserialize(store.Data[SettingsPersistence.PrimaryKey]);
            Assert.That(persisted.Version, Is.EqualTo(3));
            Assert.That(persisted.Difficulty.Level, Is.EqualTo(4), "Primary must contain the updated difficulty.");
            Assert.That(persisted.Audio.Master, Is.EqualTo(0.9f).Within(1e-6f), "Primary must contain the updated audio.");
        }

        [Test]
        public void AC_S2_FirstSaveWithoutPriorPrimarySeedsBackupWithNewBlob()
        {
            var store = NewStore();
            var service = NewService(store);

            var result = service.Save(GameSettingsData.Defaults);

            Assert.That(result, Is.EqualTo(SaveResult.Success));
            Assert.That(store.Calls, Does.Contain("Set:OverdriveSettings"));
            Assert.That(store.Calls, Does.Contain("Save"));
            // No valid prior primary exists — the backup is seeded with the new blob as a recovery anchor.
            Assert.That(store.Data[SettingsPersistence.BackupKey], Is.EqualTo(store.Data[SettingsPersistence.PrimaryKey]));
        }

        // ------------------------------------------------------------------ //
        // AC-S3: valid JSON loads, validates, publishes
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_S3_ValidBlobLoadsAndValidates()
        {
            var store = NewStore();
            var service = NewService(store);

            var custom = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                new DifficultySelection(4), // Very Hard
                new ControlsData(0.2f, 0.9f, 0.4f, 0.35f, 0.6f, string.Empty),
                new AudioData(0.8f, 0.5f, 0.7f, 0.9f, true, false),
                new DisplayData(2560, 1440, 1, 1, 2),
                new AccessibilityData(1, 1.5f),
                new CameraData(0.3f, true, true, true));
            store.Data[SettingsPersistence.PrimaryKey] = SettingsJsonCodec.Serialize(custom);

            var outcome = service.Load();

            Assert.That(outcome.UsedDefaults, Is.False);
            Assert.That(outcome.UsedBackup, Is.False);
            Assert.That(outcome.Settings.Difficulty.Level, Is.EqualTo(4));
            Assert.That(outcome.Settings.Controls.StickInner, Is.EqualTo(0.2f).Within(1e-6f));
            Assert.That(outcome.Settings.Audio.Master, Is.EqualTo(0.8f).Within(1e-6f));
            Assert.That(outcome.Settings.Display.ResolutionWidth, Is.EqualTo(2560));
            Assert.That(outcome.Settings.Accessibility.ColorblindMode, Is.EqualTo(1));
            Assert.That(outcome.Settings.Camera.ShowChaseHudInCockpit, Is.True);
        }

        [Test]
        public void AC_S3_ValidZeroVolumeAndBoundaryTextScaleRemainValid()
        {
            var store = NewStore();
            var service = NewService(store);

            var custom = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                DifficultySelection.Default,
                ControlsData.Default,
                new AudioData(0f, 0f, 0f, 0f, false, false),
                DisplayData.Default,
                new AccessibilityData(0, 2f), // max boundary 2.0
                CameraData.Default);
            store.Data[SettingsPersistence.PrimaryKey] = SettingsJsonCodec.Serialize(custom);

            var outcome = service.Load();

            Assert.That(outcome.Settings.Audio.Master, Is.EqualTo(0f).Within(1e-6f), "Zero volume must remain valid.");
            Assert.That(outcome.Settings.Accessibility.TextScale, Is.EqualTo(2f).Within(1e-6f), "Boundary text scale must remain valid.");
        }

        // ------------------------------------------------------------------ //
        // AC-S4: corrupted primary → backup; both corrupt → factory defaults
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_S4_CorruptPrimaryFallsBackToValidBackup()
        {
            var store = NewStore();
            var service = NewService(store);

            store.Data[SettingsPersistence.PrimaryKey] = "{not valid json";
            // Distinct backup values so we can assert the LOADED data (not just the flag).
            var backupData = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                new DifficultySelection(3),
                new ControlsData(0.25f, 0.9f, 0.45f, 0.35f, 0.55f, string.Empty),
                new AudioData(0.6f, 0.7f, 0.8f, 0.9f, true, false),
                new DisplayData(1280, 720, 0, 0, 0),
                new AccessibilityData(1, 1.25f),
                new CameraData(0.2f, false, true, true));
            store.Data[SettingsPersistence.BackupKey] = SettingsJsonCodec.Serialize(backupData);

            var outcome = service.Load();

            Assert.That(outcome.UsedBackup, Is.True, "Corrupt primary must fall back to backup.");
            Assert.That(outcome.UsedDefaults, Is.False);
            // The LOADED DATA must be the backup's values — not just the flag.
            Assert.That(outcome.Settings.Difficulty.Level, Is.EqualTo(3));
            Assert.That(outcome.Settings.Controls.StickInner, Is.EqualTo(0.25f).Within(1e-6f));
            Assert.That(outcome.Settings.Audio.Master, Is.EqualTo(0.6f).Within(1e-6f));
            Assert.That(outcome.Settings.Display.ResolutionWidth, Is.EqualTo(1280));
            Assert.That(outcome.Settings.Accessibility.ColorblindMode, Is.EqualTo(1));
            Assert.That(outcome.Settings.Camera.ReducedMotion, Is.True);
        }

        [Test]
        public void AC_S4_BothCorruptLoadsFactoryDefaults()
        {
            var store = NewStore();
            var service = NewService(store);

            store.Data[SettingsPersistence.PrimaryKey] = "{corrupt";
            store.Data[SettingsPersistence.BackupKey] = "also corrupt";

            var outcome = service.Load();

            Assert.That(outcome.UsedDefaults, Is.True, "Both corrupt must fall back to factory defaults.");
            Assert.That(outcome.Settings.Version, Is.EqualTo(SettingsSchema.CurrentVersion));
            // Full default model loaded.
            Assert.That(outcome.Settings.Difficulty.Level, Is.EqualTo(DifficultySelection.Default.Level));
            Assert.That(outcome.Settings.Controls.StickInner, Is.EqualTo(ControlsData.Default.StickInner).Within(1e-6f));
            Assert.That(outcome.Settings.Audio.Master, Is.EqualTo(AudioData.Default.Master).Within(1e-6f));
            Assert.That(outcome.Settings.Display.Vsync, Is.EqualTo(DisplayData.Default.Vsync));
            Assert.That(outcome.Settings.Accessibility.TextScale, Is.EqualTo(AccessibilityData.Default.TextScale).Within(1e-6f));
            Assert.That(outcome.Settings.Camera.MotionBlur, Is.EqualTo(CameraData.Default.MotionBlur));
        }

        [Test]
        public void AC_S1_FirstLaunchAttemptsPersistDefaults()
        {
            // GDD:84 — first launch makes defaults active AND attempts to persist them.
            var store = NewStore();
            var service = NewService(store);

            SaveResult persistResult = service.TryPersistDefaults();

            Assert.That(persistResult, Is.EqualTo(SaveResult.Success));
            Assert.That(store.Data.ContainsKey(SettingsPersistence.PrimaryKey), Is.True, "Defaults must be persisted on first launch.");
            Assert.That(store.Calls, Does.Contain("Save"), "Persist attempt must flush.");
        }

        [Test]
        public void Load_SemanticallyCorruptPrimaryFallsBackToBackup()
        {
            // GDD:84 — a blob that PARSES as JSON but fails validation/migration (unsupported version)
            // is corrupt and must cascade to the backup, never crash the load.
            var store = NewStore();
            store.Data[SettingsPersistence.PrimaryKey] = "{ \"version\": 99 }";
            store.Data[SettingsPersistence.BackupKey] = SettingsJsonCodec.Serialize(GameSettingsData.Defaults);
            var service = NewService(store);

            var outcome = service.Load();

            Assert.That(outcome.UsedBackup, Is.True, "Semantically corrupt primary must cascade to backup.");
            Assert.That(outcome.UsedDefaults, Is.False);
            Assert.That(outcome.Settings.Version, Is.EqualTo(SettingsSchema.CurrentVersion));
        }

        [Test]
        public void Load_SemanticallyCorruptBackupFallsBackToDefaults()
        {
            // When the BACKUP is also semantically corrupt (version 99), the cascade reaches defaults.
            var store = NewStore();
            store.Data[SettingsPersistence.PrimaryKey] = "{ \"version\": 99 }";
            store.Data[SettingsPersistence.BackupKey] = "{ \"version\": 99 }";
            var service = NewService(store);

            var outcome = service.Load();

            Assert.That(outcome.UsedDefaults, Is.True, "Semantically corrupt backup must cascade to factory defaults.");
            Assert.That(outcome.UsedBackup, Is.False);
            Assert.That(outcome.Settings.Version, Is.EqualTo(SettingsSchema.CurrentVersion));
        }

        [Test]
        public void AC_S1_InitialWriteFailureKeepsDefaultsActive()
        {
            // GDD:84 — failed initial write leaves defaults active for the session; no crash.
            var store = NewStore();
            store.ThrowOnSetString = true;
            var service = NewService(store);

            SaveResult persistResult = service.TryPersistDefaults();

            Assert.That(persistResult, Is.EqualTo(SaveResult.BackupFailed));
            // Defaults remain active (the caller keeps them; the service does not throw).
            var outcome = service.Load();
            Assert.That(outcome.UsedDefaults, Is.True);
            Assert.That(outcome.Settings.Version, Is.EqualTo(SettingsSchema.CurrentVersion));
        }

        // ------------------------------------------------------------------ //
        // AC-S5: backup/primary write failure — abort, blobs recoverable, no defaults
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_S5_BackupWriteFailureAbortsAndKeepsPrimaryIntact()
        {
            var store = NewStore();
            var service = NewService(store);

            // DISTINCT prior vs working: proves the working input is never persisted on failure.
            var prior = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                new DifficultySelection(1),
                ControlsData.Default,
                new AudioData(0.4f, 1f, 1f, 1f, false, false),
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);
            string priorJson = SettingsJsonCodec.Serialize(prior);
            store.Data[SettingsPersistence.PrimaryKey] = priorJson;
            store.ThrowOnSetString = true;

            var working = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                new DifficultySelection(4),
                ControlsData.Default,
                new AudioData(0.9f, 1f, 1f, 1f, false, false),
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);
            string workingJson = SettingsJsonCodec.Serialize(working);
            var result = service.Save(working);

            Assert.That(result, Is.EqualTo(SaveResult.BackupFailed));
            // Primary untouched — last valid persisted blob remains recoverable (the WORKING input was
            // never written).
            Assert.That(store.Data[SettingsPersistence.PrimaryKey], Is.EqualTo(priorJson));
            Assert.That(store.Data[SettingsPersistence.PrimaryKey], Is.Not.EqualTo(workingJson),
                "Working input must not be substituted into storage on failure.");
            // No defaults were substituted into storage.
            Assert.That(store.Data.ContainsKey(SettingsPersistence.BackupKey), Is.False);
        }

        /// <summary>
        /// Store that fails the FIRST primary SetString (simulating the primary write failing during
        /// Save) but allows subsequent primary writes — so the restore-from-backup path can actually
        /// complete and be observed. Without this, the restore attempt would throw and the test would
        /// falsely pass (primary unchanged because the write failed, not because the restore ran).
        /// </summary>
        private sealed class FailPrimaryStore : IPlayerPrefsStore
        {
            private readonly string _priorPrimary;
            private bool _primaryFailureConsumed;
            public readonly Dictionary<string, string> Data = new Dictionary<string, string>();
            public readonly List<string> Calls = new List<string>();

            public FailPrimaryStore(string priorPrimary)
            {
                _priorPrimary = priorPrimary;
                Data[SettingsPersistence.PrimaryKey] = _priorPrimary;
            }

            public string GetString(string key)
            {
                Calls.Add($"Get:{key}");
                return Data.TryGetValue(key, out string v) ? v : null;
            }

            public bool HasKey(string key)
            {
                Calls.Add($"Has:{key}");
                return Data.ContainsKey(key);
            }

            public void SetString(string key, string value)
            {
                Calls.Add($"Set:{key}");
                if (key == SettingsPersistence.PrimaryKey && !_primaryFailureConsumed)
                {
                    _primaryFailureConsumed = true;
                    throw new InvalidOperationException("Primary write simulated failure.");
                }
                Data[key] = value;
            }

            public void Save()
            {
                Calls.Add("Save");
            }
        }

        [Test]
        public void AC_S5_PrimaryWriteFailureRestoresFromBackup()
        {
            // Distinct prior vs working: the restore must recover the PREVIOUS valid primary, not
            // the failed new blob.
            var prior = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                new DifficultySelection(1),
                ControlsData.Default,
                new AudioData(0.4f, 1f, 1f, 1f, false, false),
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);
            string priorJson = SettingsJsonCodec.Serialize(prior);
            var working = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                new DifficultySelection(4),
                ControlsData.Default,
                new AudioData(0.9f, 1f, 1f, 1f, false, false),
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);

            var targeted = new FailPrimaryStore(priorJson);
            var service = new SettingsBlobService(new SettingsPersistence(targeted));

            var result = service.Save(working);

            Assert.That(result, Is.EqualTo(SaveResult.PrimaryFailed));
            // Backup holds the PRIOR primary (not the working blob).
            Assert.That(targeted.Data[SettingsPersistence.BackupKey], Is.EqualTo(priorJson),
                "Backup must hold the previous valid primary.");
            // Primary restored from backup → equals prior (not working).
            Assert.That(targeted.Data[SettingsPersistence.PrimaryKey], Is.EqualTo(priorJson),
                "Primary must be restored from the backup (the prior valid blob).");
            // The restore path must have re-written the primary (mutation guard: the restore is not a no-op).
            int primaryWrites = 0;
            foreach (string call in targeted.Calls)
                if (call == "Set:OverdriveSettings") primaryWrites++;
            Assert.That(primaryWrites, Is.EqualTo(2),
                "Primary must be written twice: the failed save attempt and the restore.");
        }

        [Test]
        public void AC_S5_PrimaryFailureRestoreFlushesSave()
        {
            // The restore path must flush (ADR-0004:62) — an unflushed restored primary could be
            // lost on abrupt termination.
            var targeted = new FailPrimaryStore("prior");
            var service = new SettingsBlobService(new SettingsPersistence(targeted));

            var result = service.Save(GameSettingsData.Defaults);

            Assert.That(result, Is.EqualTo(SaveResult.PrimaryFailed));
            int saveIdx = targeted.Calls.IndexOf("Save");
            // The restore is the LAST primary write (first one failed).
            int restoreIdx = -1;
            for (int i = targeted.Calls.Count - 1; i >= 0; i--)
                if (targeted.Calls[i] == "Set:OverdriveSettings") { restoreIdx = i; break; }
            Assert.That(restoreIdx, Is.GreaterThanOrEqualTo(0), "Primary must be written (restore path).");
            Assert.That(saveIdx, Is.GreaterThan(restoreIdx), "Save() must flush AFTER the restore write (ADR-0004:62).");
        }

        // ------------------------------------------------------------------ //
        // AC-S6: v1 migration → v3
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_S6_V1MigrationProducesV3WithMappedAndDiscardedFields()
        {
            // v1 blob: dead_zone (single) + vibration, no stick_outer, no EMA alphas.
            const string v1 = @"{
                ""version"": 1,
                ""controls"": { ""dead_zone"": 0.25, ""vibration"": 0.5 }
            }";

            string migrated = SettingsMigration.MigrateToCurrent(v1);

            var root = (JsonNode.ObjectNode)JsonNode.Parse(migrated);
            var controls = (JsonNode.ObjectNode)root.Get("controls");

            Assert.That(((JsonNode.NumberNode)root.Get("version")).Value, Is.EqualTo(3d), "Must end at version 3.");
            Assert.That(controls.Get("dead_zone"), Is.Null, "v1 dead_zone must be removed.");
            Assert.That(controls.Get("vibration"), Is.Null, "v1 vibration must be discarded.");

            Assert.That(((JsonNode.NumberNode)controls.Get("stick_dead_zone_inner")).Value, Is.EqualTo(0.25d), "dead_zone value must map to stick_dead_zone_inner.");
            Assert.That(((JsonNode.NumberNode)controls.Get("stick_dead_zone_outer")).Value, Is.EqualTo(0.95d), "stick outer default must be applied.");
            Assert.That(((JsonNode.NumberNode)controls.Get("accelerate_ema_alpha")).Value, Is.EqualTo(0.3d), "accelerate EMA default must be applied.");
            Assert.That(((JsonNode.NumberNode)controls.Get("brake_ema_alpha")).Value, Is.EqualTo(0.3d));
            Assert.That(((JsonNode.NumberNode)controls.Get("steer_ema_alpha")).Value, Is.EqualTo(0.5d));
        }

        // ------------------------------------------------------------------ //
        // AC-S7: v2 migration → v3 discards trigger_dead_zone_inner + subtitles
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_S7_V2MigrationDiscardsTriggerAndSubtitlesPreservingRest()
        {
            // v2 blob: has stick/EMA values + player-owned trigger_dead_zone_inner + subtitles.
            const string v2 = @"{
                ""version"": 2,
                ""controls"": {
                    ""stick_dead_zone_inner"": 0.1,
                    ""stick_dead_zone_outer"": 0.9,
                    ""accelerate_ema_alpha"": 0.2,
                    ""brake_ema_alpha"": 0.25,
                    ""steer_ema_alpha"": 0.4,
                    ""trigger_dead_zone_inner"": 0.05
                },
                ""accessibility"": { ""text_scale"": 1.25, ""subtitles"": true }
            }";

            string migrated = SettingsMigration.MigrateToCurrent(v2);

            var root = (JsonNode.ObjectNode)JsonNode.Parse(migrated);
            var controls = (JsonNode.ObjectNode)root.Get("controls");
            var accessibility = (JsonNode.ObjectNode)root.Get("accessibility");

            Assert.That(((JsonNode.NumberNode)root.Get("version")).Value, Is.EqualTo(3d));
            Assert.That(controls.Get("trigger_dead_zone_inner"), Is.Null, "v2 player-owned trigger must be discarded.");
            Assert.That(accessibility.Get("subtitles"), Is.Null, "v2 subtitles must be discarded.");

            // Preserved values.
            Assert.That(((JsonNode.NumberNode)controls.Get("stick_dead_zone_inner")).Value, Is.EqualTo(0.1d));
            Assert.That(((JsonNode.NumberNode)controls.Get("stick_dead_zone_outer")).Value, Is.EqualTo(0.9d));
            Assert.That(((JsonNode.NumberNode)controls.Get("accelerate_ema_alpha")).Value, Is.EqualTo(0.2d));
            Assert.That(((JsonNode.NumberNode)accessibility.Get("text_scale")).Value, Is.EqualTo(1.25d));
        }

        // ------------------------------------------------------------------ //
        // AC-E1: simulated full storage — failure, recoverable, no defaults
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_E1_FullStorageFailsApplyAndKeepsPriorRecoverable()
        {
            var store = NewStore();
            var service = NewService(store);

            string prior = SettingsJsonCodec.Serialize(GameSettingsData.Defaults);
            store.Data[SettingsPersistence.PrimaryKey] = prior;
            store.ThrowOnSetString = true; // simulated full localStorage

            var result = service.Save(GameSettingsData.Defaults);

            Assert.That(result, Is.EqualTo(SaveResult.BackupFailed));
            Assert.That(store.Data[SettingsPersistence.PrimaryKey], Is.EqualTo(prior), "Prior primary must remain recoverable.");
            Assert.That(store.Data.ContainsKey(SettingsPersistence.BackupKey), Is.False, "No backup written on failure.");
        }

        // ------------------------------------------------------------------ //
        // AC-E3: simulated restart — only persisted data loads, unapplied preview never authoritative
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_E3_NewStoreInstanceLoadsOnlyPersistedData()
        {
            // Session 1: apply a setting → persisted.
            var store1 = NewStore();
            var service1 = NewService(store1);
            var applied = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                DifficultySelection.Default,
                ControlsData.Default,
                new AudioData(0.6f, 1f, 1f, 1f, false, false),
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);
            Assert.That(service1.Save(applied), Is.EqualTo(SaveResult.Success));

            // "Restart": a NEW store seeded with session-1 persisted data (crash simulation discards
            // any in-memory working preview that was never applied).
            var store2 = new FakeStore();
            foreach (var kv in store1.Data) store2.Data[kv.Key] = kv.Value;
            var service2 = NewService(store2);

            // The unapplied working preview the user had open (Audio 0.9) is NEVER written to the
            // store — it is discarded by the crash/restart boundary, so it cannot become authoritative.
            var unappliedWorking = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                DifficultySelection.Default,
                ControlsData.Default,
                new AudioData(0.9f, 1f, 1f, 1f, false, false),
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);
            Assert.That(store2.Data.ContainsValue(SettingsJsonCodec.Serialize(unappliedWorking)), Is.False,
                "Unapplied working preview must never have been persisted.");

            var outcome = service2.Load();

            Assert.That(outcome.Settings.Audio.Master, Is.EqualTo(0.6f).Within(1e-6f), "Last successfully persisted primary must load.");
            Assert.That(outcome.UsedDefaults, Is.False, "Unapplied preview must not become authoritative.");
        }

        [Test]
        public void AC_E3_RestartRecoversFromBackupWhenPrimaryLost()
        {
            // Session 1: apply → primary + backup written (backup holds the prior primary).
            var store1 = NewStore();
            var service1 = NewService(store1);
            var applied = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                new DifficultySelection(2),
                ControlsData.Default,
                new AudioData(0.5f, 1f, 1f, 1f, false, false),
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);
            Assert.That(service1.Save(applied), Is.EqualTo(SaveResult.Success));

            // "Restart": the primary is LOST/corrupt (storage level failure), backup survives.
            var store2 = new FakeStore();
            store2.Data[SettingsPersistence.BackupKey] = store1.Data[SettingsPersistence.BackupKey];
            store2.Data[SettingsPersistence.PrimaryKey] = "corrupted-after-termination";
            var service2 = NewService(store2);

            var outcome = service2.Load();

            Assert.That(outcome.UsedBackup, Is.True, "Restart with corrupt primary must recover from backup.");
            Assert.That(outcome.UsedDefaults, Is.False);
            Assert.That(outcome.Settings.Difficulty.Level, Is.EqualTo(2), "Backup must hold the last successfully persisted values.");
        }

        // ------------------------------------------------------------------ //
        // AC-E4: duplicate external bindings — first keeps, second reset with warning
        // ------------------------------------------------------------------ //

        [Test]
        public void AC_E4_DuplicateBindingPathFirstWinsWithWarning()
        {
            Guid first = new Guid("00000000-0000-0000-0000-000000000011");
            Guid second = new Guid("00000000-0000-0000-0000-000000000012");
            var overrides = new[]
            {
                new BindingOverrideData(first, "<Keyboard>/w"),
                new BindingOverrideData(second, "<Keyboard>/w") // duplicate path
            };

            var warnings = new List<string>();
            var resolved = SettingsBindings.ResolveDuplicatePaths(overrides, warnings.Add);

            Assert.That(resolved.Length, Is.EqualTo(1), "Duplicate path must be removed.");
            Assert.That(resolved[0].BindingId, Is.EqualTo(first), "First override must keep the binding.");
            Assert.That(warnings.Count, Is.EqualTo(1), "One warning must be reported.");
            Assert.That(warnings[0], Does.Contain("<Keyboard>/w"));
            Assert.That(warnings[0], Does.Contain(second.ToString()));
        }

        [Test]
        public void AC_E4_DistinctPathsAllKept()
        {
            var overrides = new[]
            {
                new BindingOverrideData(new Guid("00000000-0000-0000-0000-000000000021"), "<Keyboard>/w"),
                new BindingOverrideData(new Guid("00000000-0000-0000-0000-000000000022"), "<Keyboard>/a"),
                new BindingOverrideData(new Guid("00000000-0000-0000-0000-000000000023"), "<Keyboard>/s")
            };

            var warnings = new List<string>();
            var resolved = SettingsBindings.ResolveDuplicatePaths(overrides, warnings.Add);

            Assert.That(resolved.Length, Is.EqualTo(3));
            Assert.That(warnings, Is.Empty);
        }

        [Test]
        public void Save_FlushFailureReportsPrimaryFailedWithIntactBlobs()
        {
            // PlayerPrefs.Save() throwing (ADR-0004:62 durability) must report PrimaryFailed — the
            // writes completed but durability is not guaranteed — and both blobs remain present.
            var store = NewStore();
            store.ThrowOnSave = true;
            var service = NewService(store);

            var result = service.Save(GameSettingsData.Defaults);

            Assert.That(result, Is.EqualTo(SaveResult.PrimaryFailed));
            Assert.That(store.Data.ContainsKey(SettingsPersistence.PrimaryKey), Is.True);
            Assert.That(store.Data.ContainsKey(SettingsPersistence.BackupKey), Is.True);
            Assert.That(store.Data[SettingsPersistence.PrimaryKey], Is.EqualTo(store.Data[SettingsPersistence.BackupKey]));
        }

        // ------------------------------------------------------------------ //
        // JSON codec round-trip
        // ------------------------------------------------------------------ //

        [Test]
        public void Codec_RoundTripPreservesAllValues()
        {
            var original = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                new DifficultySelection(3),
                new ControlsData(0.2f, 0.9f, 0.4f, 0.35f, 0.6f, SettingsBindings.Serialize(new[] { new BindingOverrideData(new Guid("00000000-0000-0000-0000-000000000031"), "<Keyboard>/w") })),
                new AudioData(0.8f, 0.5f, 0.7f, 0.9f, true, true),
                new DisplayData(2560, 1440, 1, 1, 3),
                new AccessibilityData(2, 1.5f),
                new CameraData(0.3f, false, true, true));

            string json = SettingsJsonCodec.Serialize(original);
            var roundTripped = SettingsJsonCodec.Deserialize(json);

            Assert.That(roundTripped.Version, Is.EqualTo(original.Version));
            Assert.That(roundTripped.Difficulty.Level, Is.EqualTo(3));
            Assert.That(roundTripped.Controls.StickInner, Is.EqualTo(0.2f).Within(1e-6f));
            Assert.That(roundTripped.Controls.SteerAlpha, Is.EqualTo(0.6f).Within(1e-6f));
            Assert.That(roundTripped.Audio.Master, Is.EqualTo(0.8f).Within(1e-6f));
            Assert.That(roundTripped.Audio.MuteMusic, Is.True);
            Assert.That(roundTripped.Display.ResolutionWidth, Is.EqualTo(2560));
            Assert.That(roundTripped.Accessibility.ColorblindMode, Is.EqualTo(2));
            Assert.That(roundTripped.Camera.ReducedMotion, Is.True);
        }

        [Test]
        public void Codec_SerializesSnakeCaseFieldNames()
        {
            string json = SettingsJsonCodec.Serialize(GameSettingsData.Defaults);

            Assert.That(json, Does.Contain("stick_dead_zone_inner"), "Blob must use snake_case field names per GDD.");
            Assert.That(json, Does.Contain("resolution_w"));
            Assert.That(json, Does.Contain("show_chase_hud_in_cockpit"));
            Assert.That(json, Does.Not.Contain("StickInner"), "PascalCase model names must not leak into the blob.");
        }

        // ------------------------------------------------------------------ //
        // Per-field validation
        // ------------------------------------------------------------------ //

        [Test]
        public void Validator_NonFiniteFallsBackToPerFieldDefault()
        {
            // JSON cannot represent NaN/Infinity natively — simulate a corrupt numeric field by
            // injecting a string "NaN" where a number is expected; the validator must repair it.
            string blob = @"{
                ""version"": 3,
                ""controls"": { ""stick_dead_zone_inner"": 0.15, ""stick_dead_zone_outer"": 0.95,
                    ""accelerate_ema_alpha"": ""NaN"", ""brake_ema_alpha"": 0.3, ""steer_ema_alpha"": 0.5 }
            }";

            string validated = SettingsValidator.Validate(blob);

            var root = (JsonNode.ObjectNode)JsonNode.Parse(validated);
            var controls = (JsonNode.ObjectNode)root.Get("controls");
            Assert.That(((JsonNode.NumberNode)controls.Get("accelerate_ema_alpha")).Value, Is.EqualTo(0.3d),
                "Non-numeric EMA alpha must fall back to the approved default.");
        }

        [Test]
        public void Validator_OutOfRangeValueFallsBack()
        {
            string blob = @"{
                ""version"": 3,
                ""controls"": { ""stick_dead_zone_inner"": 0.15, ""stick_dead_zone_outer"": 0.95,
                    ""accelerate_ema_alpha"": 1.5, ""brake_ema_alpha"": 0.3, ""steer_ema_alpha"": 0.5 }
            }";

            string validated = SettingsValidator.Validate(blob);

            var root = (JsonNode.ObjectNode)JsonNode.Parse(validated);
            var controls = (JsonNode.ObjectNode)root.Get("controls");
            Assert.That(((JsonNode.NumberNode)controls.Get("accelerate_ema_alpha")).Value, Is.EqualTo(0.3d),
                "Out-of-range EMA alpha (>1) must fall back to default.");
        }

        // ------------------------------------------------------------------ //
        // Migration guard rails
        // ------------------------------------------------------------------ //

        [Test]
        public void Migration_NewerVersionThrows()
        {
            const string v99 = @"{ ""version"": 99 }";
            Assert.Throws<ArgumentException>(() => SettingsMigration.MigrateToCurrent(v99));
        }

        [Test]
        public void Migration_InvalidVersionsThrowClearly()
        {
            // Negative / zero / fractional versions must produce a clear error, not a silent byte-wrap.
            Assert.Throws<ArgumentException>(() => SettingsMigration.MigrateToCurrent("{ \"version\": -1 }"));
            Assert.Throws<ArgumentException>(() => SettingsMigration.MigrateToCurrent("{ \"version\": 0 }"));
            Assert.Throws<ArgumentException>(() => SettingsMigration.MigrateToCurrent("{ \"version\": 1.5 }"));
        }

        [Test]
        public void Migration_MissingVersionThrows()
        {
            const string noVersion = @"{ ""controls"": {} }";
            Assert.Throws<ArgumentException>(() => SettingsMigration.MigrateToCurrent(noVersion));
        }

        // ------------------------------------------------------------------ //
        // Failure paths (qa-tester round 1)
        // ------------------------------------------------------------------ //

        [Test]
        public void Load_HasKeyThrowOnPrimaryFallsThroughToBackup()
        {
            // A store exception on the PRIMARY HasKey must not crash the load — it is treated as a
            // corrupt level and the cascade continues to the backup.
            var store = new SelectiveThrowStore(throwOnHasKey: SettingsPersistence.PrimaryKey);
            var backupData = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                new DifficultySelection(3),
                ControlsData.Default,
                new AudioData(0.6f, 1f, 1f, 1f, false, false),
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);
            store.Data[SettingsPersistence.BackupKey] = SettingsJsonCodec.Serialize(backupData);
            var service = NewService(store);

            var outcome = service.Load();

            Assert.That(outcome.UsedBackup, Is.True, "HasKey failure on primary must cascade to backup.");
            // The LOADED DATA must be the backup's values (not defaults, not a random blob).
            Assert.That(outcome.Settings.Difficulty.Level, Is.EqualTo(3));
            Assert.That(outcome.Settings.Audio.Master, Is.EqualTo(0.6f).Within(1e-6f));
        }

        [Test]
        public void Load_GetStringThrowOnPrimaryFallsThroughToBackup()
        {
            // GetString throws only when reading the primary; the backup read succeeds.
            var store = new SelectiveThrowStore(throwOnGetString: SettingsPersistence.PrimaryKey);
            store.Data[SettingsPersistence.PrimaryKey] = "x";
            var backupData = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                new DifficultySelection(2),
                ControlsData.Default,
                new AudioData(0.5f, 1f, 1f, 1f, false, false),
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);
            store.Data[SettingsPersistence.BackupKey] = SettingsJsonCodec.Serialize(backupData);
            var service = NewService(store);

            var outcome = service.Load();

            Assert.That(outcome.UsedBackup, Is.True, "GetString failure on primary must cascade to backup.");
            Assert.That(outcome.Settings.Difficulty.Level, Is.EqualTo(2));
            Assert.That(outcome.Settings.Audio.Master, Is.EqualTo(0.5f).Within(1e-6f));
        }

        /// <summary>Store that throws for a SPECIFIC key operation, leaving all others functional.</summary>
        private sealed class SelectiveThrowStore : IPlayerPrefsStore
        {
            private readonly string _throwOnHasKey;
            private readonly string _throwOnGetString;
            public readonly Dictionary<string, string> Data = new Dictionary<string, string>();

            public SelectiveThrowStore(string throwOnHasKey = null, string throwOnGetString = null)
            {
                _throwOnHasKey = throwOnHasKey;
                _throwOnGetString = throwOnGetString;
            }

            public string GetString(string key)
            {
                if (_throwOnGetString != null && key == _throwOnGetString)
                    throw new InvalidOperationException($"GetString simulated failure for {key}.");
                return Data.TryGetValue(key, out string v) ? v : null;
            }

            public bool HasKey(string key)
            {
                if (_throwOnHasKey != null && key == _throwOnHasKey)
                    throw new InvalidOperationException($"HasKey simulated failure for {key}.");
                return Data.ContainsKey(key);
            }

            public void SetString(string key, string value) => Data[key] = value;
            public void Save() { }
        }

        [Test]
        public void Save_RestoreFailureLeavesBackupIntact()
        {
            // Primary write fails AND the restore attempt fails (GetString throws): backup stays intact
            // for next-launch recovery; the result is PrimaryFailed.
            var prior = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                new DifficultySelection(1),
                ControlsData.Default,
                new AudioData(0.4f, 1f, 1f, 1f, false, false),
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);
            string priorJson = SettingsJsonCodec.Serialize(prior);
            var store = new RestoreFailingStore(priorJson);
            var service = new SettingsBlobService(new SettingsPersistence(store));

            var result = service.Save(GameSettingsData.Defaults);

            Assert.That(result, Is.EqualTo(SaveResult.PrimaryFailed));
            // The backup must hold the PRIOR primary, unchanged — it is the recovery anchor.
            Assert.That(store.Data.ContainsKey(SettingsPersistence.BackupKey), Is.True, "Backup must remain intact for next-launch recovery.");
            Assert.That(store.Data[SettingsPersistence.BackupKey], Is.EqualTo(priorJson),
                "Backup must preserve the prior primary unchanged.");
            // The primary was restored (or remains recoverable) — it must NOT be the new defaults blob.
            Assert.That(store.Data[SettingsPersistence.PrimaryKey], Is.EqualTo(priorJson),
                "Primary must remain the prior valid blob after failed save + failed restore.");
        }

        /// <summary>Store that fails the primary write and throws during the restore read.</summary>
        private sealed class RestoreFailingStore : IPlayerPrefsStore
        {
            private bool _primaryFailureConsumed;
            public readonly Dictionary<string, string> Data = new Dictionary<string, string>();

            public RestoreFailingStore(string priorPrimary)
            {
                Data[SettingsPersistence.PrimaryKey] = priorPrimary;
            }

            public string GetString(string key)
            {
                // Restore read fails: simulate the backup being unreadable mid-restore.
                if (key == SettingsPersistence.BackupKey) throw new InvalidOperationException("Backup unreadable.");
                return Data.TryGetValue(key, out string v) ? v : null;
            }

            public bool HasKey(string key) => Data.ContainsKey(key);

            public void SetString(string key, string value)
            {
                if (key == SettingsPersistence.PrimaryKey && !_primaryFailureConsumed)
                {
                    _primaryFailureConsumed = true;
                    throw new InvalidOperationException("Primary write simulated failure.");
                }
                Data[key] = value;
            }

            public void Save() { }
        }

        [Test]
        public void Bindings_EmptyStringYieldsNoOverrides()
        {
            var parsed = SettingsBindings.Parse(string.Empty);
            Assert.That(parsed.Length, Is.EqualTo(0));
        }

        [Test]
        public void Bindings_MalformedJsonThrows()
        {
            Assert.Throws<JsonParseException>(() => SettingsBindings.Parse("{not a json array"));
        }

        [Test]
        public void Bindings_SerializeRoundTrips()
        {
            var overrides = new[]
            {
                new BindingOverrideData(new Guid("00000000-0000-0000-0000-000000000041"), "<Keyboard>/w"),
                new BindingOverrideData(new Guid("00000000-0000-0000-0000-000000000042"), "<Keyboard>/a")
            };

            string json = SettingsBindings.Serialize(overrides);
            var parsed = SettingsBindings.Parse(json);

            Assert.That(parsed.Length, Is.EqualTo(2));
            Assert.That(parsed[0].BindingId, Is.EqualTo(overrides[0].BindingId));
            Assert.That(parsed[0].Path, Is.EqualTo(overrides[0].Path));
            Assert.That(parsed[1].Path, Is.EqualTo(overrides[1].Path));
        }

        [Test]
        public void Codec_MissingCategoryObjectsUseDefaults()
        {
            // A minimal version-3 blob with no category objects must deserialize to defaults.
            const string minimal = @"{ ""version"": 3 }";
            var data = SettingsJsonCodec.Deserialize(minimal);

            Assert.That(data.Difficulty.Level, Is.EqualTo(DifficultySelection.Default.Level));
            Assert.That(data.Controls.StickInner, Is.EqualTo(ControlsData.Default.StickInner).Within(1e-6f));
            Assert.That(data.Audio.Master, Is.EqualTo(AudioData.Default.Master).Within(1e-6f));
            Assert.That(data.Display.ResolutionWidth, Is.EqualTo(DisplayData.Default.ResolutionWidth));
            Assert.That(data.Accessibility.TextScale, Is.EqualTo(AccessibilityData.Default.TextScale).Within(1e-6f));
            Assert.That(data.Camera.ReducedMotion, Is.EqualTo(CameraData.Default.ReducedMotion));
        }
    }
}
