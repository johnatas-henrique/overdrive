using NUnit.Framework;
using Overdrive.Settings;
using Overdrive.Settings.Core;
using UnityEngine;

namespace Overdrive.Settings.Tests
{
    /// <summary>
    /// Integration smoke for the PlayerPrefs adapter: real SetString/Save/Get round-trip through
    /// UnityEngine.PlayerPrefs (EditMode), verifying the adapter maps the port correctly and the
    /// loader wires the engine-free core to Unity surfaces end-to-end.
    /// </summary>
    public class SettingsPersistenceIntegrationTests
    {
        [TearDown]
        public void TearDown()
        {
            // Never leave test keys in the real store.
            PlayerPrefs.DeleteKey(SettingsPersistence.PrimaryKey);
            PlayerPrefs.DeleteKey(SettingsPersistence.BackupKey);
            PlayerPrefs.Save();
        }

        [Test]
        public void PlayerPrefsStore_RoundTripsString()
        {
            var store = new PlayerPrefsStore();
            const string key = "OverdriveSettings_IntegrationTest";
            PlayerPrefs.DeleteKey(key);

            store.SetString(key, "hello");
            store.Save();

            Assert.That(store.HasKey(key), Is.True, "HasKey must observe the stored key.");
            Assert.That(store.GetString(key), Is.EqualTo("hello"), "GetString must return the stored value.");

            PlayerPrefs.DeleteKey(key);
            PlayerPrefs.Save();
        }

        [Test]
        public void BlobService_PersistsAndReloadsThroughRealPlayerPrefs()
        {
            var store = new PlayerPrefsStore();
            var persistence = new SettingsPersistence(store);
            var service = new SettingsBlobService(persistence);

            var custom = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                new DifficultySelection(3),
                ControlsData.Default,
                new AudioData(0.7f, 0.8f, 0.9f, 1f, false, false),
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);

            SaveResult saveResult = service.Save(custom);
            Assert.That(saveResult, Is.EqualTo(SaveResult.Success), "Save through the real store must succeed.");

            var outcome = service.Load();
            Assert.That(outcome.UsedDefaults, Is.False, "After a successful save, defaults must NOT be used.");
            Assert.That(outcome.Settings.Audio.Master, Is.EqualTo(0.7f).Within(1e-6f));
            Assert.That(outcome.Settings.Difficulty.Level, Is.EqualTo(3));
        }

        [Test]
        public void SettingsLoader_LoadsPersistedDataWithControlProfileMapping()
        {
            // End-to-end through the loader: persist a custom control profile, then load through
            // SettingsLoader and verify the Input.ControlProfile mapping + resolved bindings.
            var store = new PlayerPrefsStore();
            var persistence = new SettingsPersistence(store);
            var service = new SettingsBlobService(persistence);
            var loader = new SettingsLoader(service);

            var custom = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                DifficultySelection.Default,
                new ControlsData(0.2f, 0.9f, 0.4f, 0.35f, 0.6f, string.Empty),
                AudioData.Default,
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);

            Assert.That(service.Save(custom), Is.EqualTo(SaveResult.Success));

            var loaded = loader.Load();

            Assert.That(loaded.UsedDefaults, Is.False);
            Assert.That(loaded.ControlProfile.StickInner, Is.EqualTo(0.2f).Within(1e-6f), "Loader must map persisted stick inner into the Input ControlProfile.");
            Assert.That(loaded.ControlProfile.SteerAlpha, Is.EqualTo(0.6f).Within(1e-6f));
            Assert.That(loaded.ResolvedBindings, Is.Not.Null);
        }

        [Test]
        public void SettingsLoader_FirstLaunchPersistsDefaultsAndWarnsOnFailure()
        {
            // First launch through the loader: defaults become active and the system attempts to
            // persist them (GDD:84). With a working store the attempt succeeds silently.
            var store = new PlayerPrefsStore();
            var persistence = new SettingsPersistence(store);
            var service = new SettingsBlobService(persistence);
            string warning = null;
            var loader = new SettingsLoader(service, message => warning = message);

            var loaded = loader.Load();

            Assert.That(loaded.UsedDefaults, Is.True, "First launch must use defaults.");
            Assert.That(store.HasKey(SettingsPersistence.PrimaryKey), Is.True, "Defaults must be persisted on first launch (GDD:84).");
            Assert.That(warning, Is.Null, "Successful first-launch persist must not warn.");
        }

        [Test]
        public void SettingsLoader_EDuplicateBindingsFirstWinsWithWarning()
        {
            // AC-E4 end-to-end through the loader: a persisted bindings_json with two overrides on
            // the same path resolves first-wins and reports the duplicate through the warning sink.
            // Fixed deterministic binding ids (binding ids are stable identifiers, not seeds).
            var first = new System.Guid("00000000-0000-0000-0000-000000000001");
            var second = new System.Guid("00000000-0000-0000-0000-000000000002");
            string bindingsJson = SettingsBindings.Serialize(new[]
            {
                new BindingOverrideData(first, "<Keyboard>/w"),
                new BindingOverrideData(second, "<Keyboard>/w")
            });

            var store = new PlayerPrefsStore();
            var persistence = new SettingsPersistence(store);
            var service = new SettingsBlobService(persistence);
            var custom = new GameSettingsData(
                SettingsSchema.CurrentVersion,
                DifficultySelection.Default,
                new ControlsData(0.15f, 0.95f, 0.3f, 0.3f, 0.5f, bindingsJson),
                AudioData.Default,
                DisplayData.Default,
                AccessibilityData.Default,
                CameraData.Default);
            Assert.That(service.Save(custom), Is.EqualTo(SaveResult.Success));

            string warning = null;
            var loader = new SettingsLoader(service, message => warning = message);
            var loaded = loader.Load();

            Assert.That(loaded.ResolvedBindings.Length, Is.EqualTo(1), "Duplicate path must be removed.");
            Assert.That(loaded.ResolvedBindings[0].BindingId, Is.EqualTo(first), "First override must keep the binding.");
            Assert.That(warning, Is.Not.Null, "Duplicate must be reported through the warning sink.");
            Assert.That(warning, Does.Contain("<Keyboard>/w"));
        }

        [Test]
        public void SettingsLoader_FirstLaunchPersistFailureWarnsAndKeepsDefaults()
        {
            // GDD:84 — when the initial persist attempt fails, defaults remain active and a save
            // warning is reported through the sink; the game never crashes. Uses a failing fake store
            // (SettingsLoader accepts any IPlayerPrefsStore).
            var store = new ThrowingStore();
            var persistence = new SettingsPersistence(store);
            var service = new SettingsBlobService(persistence);
            string warning = null;
            var loader = new SettingsLoader(service, message => warning = message);

            var loaded = loader.Load();

            Assert.That(loaded.UsedDefaults, Is.True, "Defaults must remain active after a failed initial write.");
            Assert.That(warning, Is.Not.Null, "Failed initial persist must report a save warning.");
            Assert.That(warning, Does.Contain("Initial settings save failed"));
        }

        /// <summary>Store whose SetString always throws — simulates a full/unwritable platform store.</summary>
        private sealed class ThrowingStore : IPlayerPrefsStore
        {
            public string GetString(string key) => null;
            public bool HasKey(string key) => false;
            public void SetString(string key, string value) => throw new System.InvalidOperationException("Store full.");
            public void Save() { }
        }
    }
}
