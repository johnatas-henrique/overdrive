using System;
using System.Linq;
using NUnit.Framework;
using Overdrive.Settings;
using Overdrive.Settings.Core;
using Overdrive.Simulation;
using UnityEngine;
using UnityEditor;

namespace Overdrive.Settings.Tests
{
    /// <summary>
    /// Integration tests for the DifficultyProfile pipeline (story 3-4, AC-D1..D8):
    /// real SO assets under Assets/Settings/Difficulty/, the catalog resolver,
    /// the Settings-backed provider chain (persisted ID -> profile -> capture
    /// input), and snapshot immutability.
    /// </summary>
    public class DifficultyProfileIntegrationTests
    {
        private const string CatalogPath = "Assets/Settings/Difficulty/DifficultyProfileCatalog.asset";

        [Test]
        public void CatalogAsset_LoadsFiveProfiles_FromRealAssets()
        {
            var catalog = AssetDatabase.LoadAssetAtPath<DifficultyProfileCatalog>(CatalogPath);

            Assert.That(catalog, Is.Not.Null, "The catalog asset must exist at " + CatalogPath);
            Assert.That(catalog.Profiles, Is.Not.Null, "Catalog profiles must be populated.");
            Assert.That(catalog.Profiles.Length, Is.EqualTo(5),
                "Exactly five tier assets are required (Very Easy..Very Hard).");
            Assert.That(catalog.Profiles.Count(p => p != null), Is.EqualTo(5),
                "All five slots must be assigned.");
        }

        [Test]
        public void AC_D1_VeryEasy_ResolvesToApprovedRow()
        {
            var catalog = LoadCatalog();
            var profile = catalog.GetProfile(0);

            AssertRow(profile, level: 0, aiPrecision: 0.90f, aiErrorMultiplier: 1.5f,
                paceNoise: 0.08f, grip: 0.60f, wallLoss: 0.20f);
        }

        [Test]
        public void AC_D2_Easy_ResolvesToApprovedRow()
        {
            var catalog = LoadCatalog();
            var profile = catalog.GetProfile(1);

            AssertRow(profile, level: 1, aiPrecision: 0.95f, aiErrorMultiplier: 1.2f,
                paceNoise: 0.05f, grip: 0.50f, wallLoss: 0.30f);
        }

        [Test]
        public void AC_D3_Normal_ResolvesToApprovedRow()
        {
            var catalog = LoadCatalog();
            var profile = catalog.GetProfile(2);

            AssertRow(profile, level: 2, aiPrecision: 1.00f, aiErrorMultiplier: 1.0f,
                paceNoise: 0.02f, grip: 0.40f, wallLoss: 0.40f);
        }

        [Test]
        public void AC_D4_Hard_ResolvesToApprovedRow()
        {
            var catalog = LoadCatalog();
            var profile = catalog.GetProfile(3);

            AssertRow(profile, level: 3, aiPrecision: 1.00f, aiErrorMultiplier: 0.5f,
                paceNoise: 0.00f, grip: 0.30f, wallLoss: 0.50f);
        }

        [Test]
        public void AC_D5_VeryHard_ResolvesToApprovedRow()
        {
            var catalog = LoadCatalog();
            var profile = catalog.GetProfile(4);

            AssertRow(profile, level: 4, aiPrecision: 1.00f, aiErrorMultiplier: 0.0f,
                paceNoise: 0.00f, grip: 0.25f, wallLoss: 0.60f);
        }

        [Test]
        public void GetProfile_OutOfRange_Throws()
        {
            var catalog = LoadCatalog();

            Assert.Throws<ArgumentOutOfRangeException>(() => catalog.GetProfile(-1));
            Assert.Throws<ArgumentOutOfRangeException>(() => catalog.GetProfile(5));
        }

        [Test]
        public void AC_D7_PersistedDifficulty_FlowsThroughProvider_ToCaptureInput()
        {
            // AC-D7: Apply persists the ID -> provider reads it -> catalog resolves
            // -> ReplayInitialStateCaptureInput carries the immutable profile.
            var store = new PlayerPrefsStore();
            var persistence = new SettingsPersistence(store);
            var blob = new SettingsBlobService(persistence);
            var catalog = LoadCatalog();

            using (var session = OpenSession(blob))
            {
                session.SetValue(Overdrive.Settings.Core.SettingsCategory.Difficulty, 3);
                var apply = session.Apply();
                Assert.That(apply, Is.EqualTo(ApplyResult.Success), "Apply must persist the Hard selection.");
            }

            var provider = new SettingsDifficultyProvider(new BaseProvider(), blob, catalog);
            var capture = provider.GetCaptureInput();

            Assert.That(capture.DifficultyProfile.Level, Is.EqualTo(3),
                "The capture input must carry the persisted Hard tier.");
            Assert.That(capture.DifficultyProfile.AiPrecision, Is.EqualTo(1.00f),
                "The resolved profile must be the full Hard row, not a stub.");
            Assert.That(capture.DifficultyProfile.PlayerWallSpeedLoss, Is.EqualTo(0.50f),
                "The resolved profile must be the full Hard row.");

            // The race-snapshot boundary is protected by Kernel AC39_FieldsPopulatedFromCaptureInput
            // (real steps + GO capture). This local construction is a smoke that the resolved profile
            // survives the 1:1 mapping; the Kernel-side guard is authoritative.
            var initialState = new ReplayInitialState(
                capture.Version, capture.RaceConfigurationId, capture.ContentVersionHash,
                capture.SimSeed, capture.GridAssignment, capture.CarIds,
                capture.InitialFuelState, capture.InitialTireState,
                capture.PerfectStartRemainingTicks, capture.DifficultyProfile);
            Assert.That(initialState.DifficultyProfile.Level, Is.EqualTo(3),
                "The race snapshot must carry the Hard tier.");
            Assert.That(initialState.DifficultyProfile.PlayerWallSpeedLoss, Is.EqualTo(0.50f),
                "The race snapshot must carry the full Hard row.");

            ClearSettingsKeys();
        }

        [Test]
        public void AC_D7_AM2_CurrentRaceImmutable_NextRaceNewProfile()
        {
            // ADR-0004: the current-race snapshot never changes mid-race.
            var store = new PlayerPrefsStore();
            var persistence = new SettingsPersistence(store);
            var blob = new SettingsBlobService(persistence);
            var catalog = LoadCatalog();

            using (var session = OpenSession(blob))
            {
                session.SetValue(Overdrive.Settings.Core.SettingsCategory.Difficulty, 1);
                var firstApply = session.Apply();
                Assert.That(firstApply, Is.EqualTo(ApplyResult.Success), "First Apply must persist Easy.");
            }

            var provider = new SettingsDifficultyProvider(new BaseProvider(), blob, catalog);
            var firstCapture = provider.GetCaptureInput();

            // Player changes difficulty between races; the already-captured snapshot must not mutate.
            using (var session2 = OpenSession(blob))
            {
                session2.SetValue(Overdrive.Settings.Core.SettingsCategory.Difficulty, 4);
                var secondApply = session2.Apply();
                Assert.That(secondApply, Is.EqualTo(ApplyResult.Success), "Second Apply must persist Very Hard.");
            }

            var secondCapture = provider.GetCaptureInput();
            Assert.That(secondCapture.DifficultyProfile.Level, Is.EqualTo(4),
                "The new race must resolve the new selection.");
            Assert.That(firstCapture.DifficultyProfile.Level, Is.EqualTo(1),
                "The already-captured snapshot must remain the old selection — immutable per race.");

            ClearSettingsKeys();
        }

        [Test]
        public void AC_D7_RepeatedCapture_WithoutChange_ReturnsSameProfile()
        {
            var store = new PlayerPrefsStore();
            var persistence = new SettingsPersistence(store);
            var blob = new SettingsBlobService(persistence);
            var catalog = LoadCatalog();

            using (var session = OpenSession(blob))
            {
                session.SetValue(Overdrive.Settings.Core.SettingsCategory.Difficulty, 2);
                session.Apply();
            }

            var provider = new SettingsDifficultyProvider(new BaseProvider(), blob, catalog);
            var first = provider.GetCaptureInput();
            var second = provider.GetCaptureInput();

            Assert.That(second.DifficultyProfile.Level, Is.EqualTo(2), "Repeated capture must resolve the same tier.");
            Assert.That(second.DifficultyProfile.AiPrecision, Is.EqualTo(first.DifficultyProfile.AiPrecision),
                "AiPrecision must match.");
            Assert.That(second.DifficultyProfile.AiErrorMultiplier, Is.EqualTo(first.DifficultyProfile.AiErrorMultiplier),
                "AiErrorMultiplier must match.");
            Assert.That(second.DifficultyProfile.PaceNoise, Is.EqualTo(first.DifficultyProfile.PaceNoise),
                "PaceNoise must match.");
            Assert.That(second.DifficultyProfile.PlayerOffTrackGrip, Is.EqualTo(first.DifficultyProfile.PlayerOffTrackGrip),
                "PlayerOffTrackGrip must match.");
            Assert.That(second.DifficultyProfile.PlayerWallSpeedLoss, Is.EqualTo(first.DifficultyProfile.PlayerWallSpeedLoss),
                "PlayerWallSpeedLoss must match.");

            ClearSettingsKeys();
        }

        [Test]
        public void Provider_FirstLaunch_FallsBackToDefaultNormal()
        {
            // No persisted blob (factory defaults path): the provider must resolve the
            // approved default (Normal = 2) without throwing.
            ClearSettingsKeys(); // isolate: no pre-existing blob may leak into this test

            var store = new PlayerPrefsStore();
            var persistence = new SettingsPersistence(store);
            var blob = new SettingsBlobService(persistence);
            var catalog = LoadCatalog();

            var load = blob.Load();
            Assert.That(load.UsedDefaults, Is.True,
                "An empty store must load factory defaults — this test must actually exercise the cascade.");
            Assert.That(load.Settings.Difficulty.Level, Is.EqualTo(DifficultySelection.Default.Level),
                "The cascade default is Normal.");

            var provider = new SettingsDifficultyProvider(new BaseProvider(), blob, catalog);
            var capture = provider.GetCaptureInput();

            Assert.That(capture.DifficultyProfile.Level, Is.EqualTo(DifficultySelection.Default.Level),
                "Factory defaults must resolve to Normal.");
            Assert.That(capture.DifficultyProfile.AiPrecision, Is.EqualTo(1.00f),
                "Normal row values must resolve.");

            ClearSettingsKeys();
        }

        [Test]
        public void Provider_NullBaseProvider_Throws()
        {
            var store = new PlayerPrefsStore();
            var persistence = new SettingsPersistence(store);
            var blob = new SettingsBlobService(persistence);
            var catalog = LoadCatalog();

            Assert.Throws<ArgumentNullException>(() =>
                new SettingsDifficultyProvider(null, blob, catalog));
            Assert.Throws<ArgumentNullException>(() =>
                new SettingsDifficultyProvider(new BaseProvider(), null, catalog));
            Assert.Throws<ArgumentNullException>(() =>
                new SettingsDifficultyProvider(new BaseProvider(), blob, null));
        }

        [Test]
        public void Catalog_MissingSlot_ThrowsInvalidOperation()
        {
            var catalog = ScriptableObject.CreateInstance<DifficultyProfileCatalog>();
            catalog.Configure(new DifficultyProfileData[5]); // all slots null

            Assert.Throws<InvalidOperationException>(() => catalog.GetProfile(2),
                "A missing profile asset must fail loudly, not resolve a zeroed row.");
        }

        [Test]
        public void Catalog_ConfigureOutOfRange_Throws()
        {
            var data = ScriptableObject.CreateInstance<DifficultyProfileData>();
            Assert.Throws<ArgumentOutOfRangeException>(() => data.Configure(5, 1f, 1f, 0f, 0.4f, 0.4f),
                "Configure must reject out-of-range levels (defense-in-depth).");
        }

        [Test]
        public void AC_D8_ProfileSchema_HasNoMutableCarStatsOrFormulas()
        {
            // AC-D8 (scoped): only the six immutable AI/player-recovery fields exist.
            var fields = typeof(DifficultyProfile).GetFields(System.Reflection.BindingFlags.Public
                | System.Reflection.BindingFlags.Instance);

            var names = fields.Select(f => f.Name).OrderBy(n => n).ToArray();
            CollectionAssert.AreEquivalent(
                new[]
                {
                    "AiErrorMultiplier", "AiPrecision", "Level", "PaceNoise",
                    "PlayerOffTrackGrip", "PlayerWallSpeedLoss"
                },
                names,
                "The profile schema must contain exactly the six AI/player-recovery fields and nothing else.");

            foreach (var field in fields)
            {
                Assert.That(field.IsInitOnly, Is.True,
                    $"Field {field.Name} must be readonly — no mutable Car Definition stat or formula.");
            }
        }

        private static DifficultyProfileCatalog LoadCatalog()
        {
            var catalog = AssetDatabase.LoadAssetAtPath<DifficultyProfileCatalog>(CatalogPath);
            Assert.That(catalog, Is.Not.Null, "DifficultyProfileCatalog.asset must exist.");
            return catalog;
        }

        private static SettingsEditSession OpenSession(SettingsBlobService blob)
        {
            var session = SettingsEditSession.TryOpen(
                blob, new OpenLifecycle(), new FakeDisplayGate(), _ => { }, null, out var result);
            Assert.That(session, Is.Not.Null, "TryOpen must succeed for the test lifecycle.");
            Assert.That(result, Is.EqualTo(SettingsOpenResult.Opened));
            return session;
        }

        private static void ClearSettingsKeys()
        {
            PlayerPrefs.DeleteKey(SettingsPersistence.PrimaryKey);
            PlayerPrefs.DeleteKey(SettingsPersistence.BackupKey);
            PlayerPrefs.Save();
        }

        private static void AssertRow(DifficultyProfile p, int level, float aiPrecision, float aiErrorMultiplier,
            float paceNoise, float grip, float wallLoss)
        {
            Assert.That(p.Level, Is.EqualTo(level), "Level mismatch.");
            Assert.That(p.AiPrecision, Is.EqualTo(aiPrecision).Within(0.0001f), "AiPrecision mismatch.");
            Assert.That(p.AiErrorMultiplier, Is.EqualTo(aiErrorMultiplier).Within(0.0001f), "AiErrorMultiplier mismatch.");
            Assert.That(p.PaceNoise, Is.EqualTo(paceNoise).Within(0.0001f), "PaceNoise mismatch.");
            Assert.That(p.PlayerOffTrackGrip, Is.EqualTo(grip).Within(0.0001f), "PlayerOffTrackGrip mismatch.");
            Assert.That(p.PlayerWallSpeedLoss, Is.EqualTo(wallLoss).Within(0.0001f), "PlayerWallSpeedLoss mismatch.");
        }

        /// <summary>Lifecycle that always permits opening settings in tests.</summary>
        private sealed class OpenLifecycle : ISettingsLifecycleContext
        {
            public bool CanOpenSettings => true;
            public bool IsDifficultyEditable => true;
        }

        /// <summary>Display gate that accepts candidates synchronously (Story 005 owns the real timer).</summary>
        private sealed class FakeDisplayGate : IDisplayConfirmGate
        {
            public void Confirm(DisplayCandidate candidate, Action<DisplayConfirmResult> onResult)
            {
                onResult(DisplayConfirmResult.Accepted);
            }
        }

        /// <summary>Minimal base provider: fills the non-difficulty capture fields.</summary>
        private sealed class BaseProvider : IReplayInitialStateProvider
        {
            public ReplayInitialStateCaptureInput GetCaptureInput()
            {
                return new ReplayInitialStateCaptureInput
                {
                    Version = 1,
                    RaceConfigurationId = "test-race",
                    ContentVersionHash = "hash",
                    SimSeed = 42UL,
                    GridAssignment = new GridAssignment(new[] { 1, 2 }),
                    CarIds = new[] { 1, 2 },
                    InitialFuelState = Array.Empty<FuelState>(),
                    InitialTireState = Array.Empty<TireState>(),
                    PerfectStartRemainingTicks = 0
                };
            }
        }
    }
}
