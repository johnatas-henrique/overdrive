using System;
using System.Collections.Generic;
using NUnit.Framework;
using UnityEditor;
using UnityEditor.AddressableAssets.Settings;
using UnityEngine;
using Overdrive.Content;
using Overdrive.Content.Editor;

namespace Overdrive.Content.Tests
{
    /// <summary>
    /// Editor tests for the content group topology + address mirror (Story 3-8, ADR-0003).
    /// Two layers: structural (validates the REAL topology.json manifest structure) and
    /// semantic (validates ContentTopologyValidator/AddressAssignmentTool logic against a
    /// fixture manifest + temporary AddressableAssetSettings with committed fixture assets —
    /// never the global AddressableAssetSettingsDefaultObject).
    /// NOTE: fixtures live under Assets/tests/content/Fixtures (NOT a folder named "Editor")
    /// because AddressableAssetUtility.IsPathValidForEntry rejects any asset whose path
    /// contains "/Editor/".
    /// </summary>
    public class ContentTopologyTests
    {
        private const string FixturesRoot = "Assets/tests/content/Fixtures";
        private const string SharedDir = FixturesRoot + "/Shared";
        private const string ManifestPath = "Assets/Settings/Content/topology.json";
        private const string TempSettingsDir = "Assets/tests/editor/content/TempSettings";

        private static readonly string[] TeamIds =
        {
            "team_tier1_a", "team_tier1_b", "team_tier1_c", "team_tier1_d",
            "team_tier2_a", "team_tier2_b", "team_tier2_c", "team_tier2_d",
            "team_tier3_a", "team_tier3_b", "team_tier3_c", "team_tier3_d",
            "team_tier4_a", "team_tier4_b", "team_tier4_c", "team_tier4_d"
        };

        // Fixture layer car ids: teamA (cross-car ref), teamB (baseline), teamC (shared ref),
        // plus 13 fillers to reach 16 car groups (21 total with Shared + 4 Tracks).
        private static readonly string[] FixtureCarIds =
        {
            "teamA", "teamB", "teamC",
            "teamFiller01", "teamFiller02", "teamFiller03", "teamFiller04", "teamFiller05",
            "teamFiller06", "teamFiller07", "teamFiller08", "teamFiller09", "teamFiller10",
            "teamFiller11", "teamFiller12", "teamFiller13"
        };

        private static readonly string[] TrackIds = { "monaco", "monza", "silverstone", "spa" };

        private AddressableAssetSettings _settings;

        [SetUp]
        public void SetUp()
        {
            if (AssetDatabase.IsValidFolder(TempSettingsDir))
                AssetDatabase.DeleteAsset(TempSettingsDir);
            AssetDatabase.CreateFolder("Assets/tests/editor/content", "TempSettings");
            _settings = AddressableAssetSettings.Create(TempSettingsDir, "Default Group", createDefaultGroups: false, isPersisted: false);
            Assert.That(_settings, Is.Not.Null);
        }

        [TearDown]
        public void TearDown()
        {
            if (_settings != null)
            {
                UnityEngine.Object.DestroyImmediate(_settings, true);
                _settings = null;
            }
            if (AssetDatabase.IsValidFolder(TempSettingsDir))
                AssetDatabase.DeleteAsset(TempSettingsDir);
        }

        // ------------------------------------------------------------------ helpers

        private static ContentTopologyData BuildFixtureManifest()
        {
            var manifest = new ContentTopologyData
            {
                expectedGroupCount = 21,
                allowedSharedDependencies = true,
                forbiddenCrossCarDependencies = true
            };
            manifest.groups.Add(new ContentTopologyGroup
            {
                name = "Shared",
                category = "Shared",
                allowedTypes = new List<string> { "Prefab", "AudioClip", "Shader", "Texture2D" },
                allowedPaths = new List<string> { SharedDir + "/**" }
            });
            foreach (var team in FixtureCarIds)
            {
                // teamA is the FAILURE fixture (carries the cross-car reference) — never a
                // root in the default manifest; only the Edge1 test arms it as a root.
                var isWired = team == "teamB" || team == "teamC";
                manifest.groups.Add(new ContentTopologyGroup
                {
                    name = "Cars/" + team,
                    category = "Cars",
                    rootAddress = isWired ? $"Cars/{team}/CarDefinition" : null,
                    rootPath = isWired ? $"{FixturesRoot}/Cars/{team}/CarDefinition.asset" : null,
                    allowedPaths = new List<string> { $"{FixturesRoot}/Cars/{team}/**" }
                });
            }
            foreach (var track in TrackIds)
            {
                manifest.groups.Add(new ContentTopologyGroup
                {
                    name = "Tracks/" + track,
                    category = "Tracks",
                    rootAddress = track == "monaco" ? "Tracks/monaco/TrackData" : null,
                    rootPath = track == "monaco" ? $"{FixturesRoot}/Tracks/monaco/TrackData.asset" : null,
                    allowedPaths = new List<string> { $"{FixturesRoot}/Tracks/{track}/**" }
                });
            }
            return manifest;
        }

        private void CreateAllFixtureGroups()
        {
            foreach (var name in GroupNames())
            {
                _settings.CreateGroup(name, setAsDefaultGroup: false, readOnly: false, postEvent: false,
                    schemasToCopy: new List<AddressableAssetGroupSchema>(), types: new Type[0]);
            }
        }

        private static IEnumerable<string> GroupNames()
        {
            yield return "Shared";
            foreach (var team in FixtureCarIds) yield return "Cars/" + team;
            foreach (var track in TrackIds) yield return "Tracks/" + track;
        }

        private void AddEntry(string groupName, string assetPath, string address)
        {
            var group = _settings.FindGroup(ContentTopologyValidator.ToSettingsGroupName(groupName));
            Assert.That(group, Is.Not.Null, $"Group '{groupName}' missing");
            var guid = AssetDatabase.AssetPathToGUID(assetPath);
            Assert.That(guid, Is.Not.Empty, $"No GUID for '{assetPath}'");
            var entry = _settings.CreateOrMoveEntry(guid, group, readOnly: false, postEvent: false);
            Assert.That(entry, Is.Not.Null, $"CreateOrMoveEntry returned null for '{assetPath}'");
            entry.address = address;
        }

        /// Adds the wired root entries (teamB, teamC, monaco) with correct mirror addresses —
        /// the minimal valid entry set the default manifest requires.
        private void AddWiredRootEntries()
        {
            AddEntry("Cars/teamB", FixturesRoot + "/Cars/teamB/CarDefinition.asset", "Cars/teamB/CarDefinition");
            AddEntry("Cars/teamC", FixturesRoot + "/Cars/teamC/CarDefinition.asset", "Cars/teamC/CarDefinition");
            AddEntry("Tracks/monaco", FixturesRoot + "/Tracks/monaco/TrackData.asset", "Tracks/monaco/TrackData");
        }

        // ------------------------------------------------------------------ structural

        [Test]
        public void AC_Structural_RealManifestHasTwentyOneGroupsThreeCategories()
        {
            var text = System.IO.File.ReadAllText(ManifestPath);
            var manifest = JsonUtility.FromJson<ContentTopologyData>(text);

            Assert.That(manifest, Is.Not.Null);
            Assert.That(manifest.groups, Is.Not.Null);
            Assert.That(manifest.groups.Count, Is.EqualTo(21), "Manifest must declare 21 groups (1 Shared + 16 Cars + 4 Tracks).");
            Assert.That(manifest.expectedGroupCount, Is.EqualTo(21));
            Assert.That(manifest.forbiddenCrossCarDependencies, Is.True);
        }

        [Test]
        public void AC_Structural_RealManifestExactTeamAndTrackIds()
        {
            var text = System.IO.File.ReadAllText(ManifestPath);
            var manifest = JsonUtility.FromJson<ContentTopologyData>(text);

            var carNames = new List<string>();
            var trackNames = new List<string>();
            foreach (var g in manifest.groups)
            {
                if (g.category == "Cars") carNames.Add(g.name);
                else if (g.category == "Tracks") trackNames.Add(g.name);
            }
            Assert.That(carNames.Count, Is.EqualTo(16));
            foreach (var team in TeamIds)
                Assert.That(carNames, Does.Contain("Cars/" + team), $"Missing car group {team}");
            Assert.That(trackNames.Count, Is.EqualTo(4));
            foreach (var track in TrackIds)
                Assert.That(trackNames, Does.Contain("Tracks/" + track), $"Missing track group {track}");
        }

        [Test]
        public void AC_Structural_RealManifestHasExactThreeCategories()
        {
            var text = System.IO.File.ReadAllText(ManifestPath);
            var manifest = JsonUtility.FromJson<ContentTopologyData>(text);

            var categories = new HashSet<string>();
            foreach (var g in manifest.groups) categories.Add(g.category);
            Assert.That(categories, Is.EquivalentTo(new[] { "Shared", "Cars", "Tracks" }),
                "The real manifest may only declare the three canonical categories.");
        }

        [Test]
        public void AC_Structural_RealManifestAllowlistsPresent()
        {
            var text = System.IO.File.ReadAllText(ManifestPath);
            var manifest = JsonUtility.FromJson<ContentTopologyData>(text);

            foreach (var g in manifest.groups)
            {
                Assert.That(g.allowedPaths, Is.Not.Null.And.Not.Empty, $"Group '{g.name}' must declare allowedPaths.");
                if (g.category == "Cars")
                {
                    var team = g.name.Substring("Cars/".Length);
                    Assert.That(g.allowedPaths, Does.Contain($"Assets/Cars/{team}/**"), $"Car {team} allowedPaths glob");
                }
                else if (g.category == "Tracks")
                {
                    var track = g.name.Substring("Tracks/".Length);
                    Assert.That(g.allowedPaths, Does.Contain($"Assets/Tracks/{track}/**"), $"Track {track} allowedPaths glob");
                }
                else // Shared
                {
                    Assert.That(g.allowedTypes, Is.Not.Null.And.Not.Empty, "Shared must declare allowedTypes.");
                    Assert.That(g.allowedTypes, Is.EquivalentTo(new[] { "Prefab", "AudioClip", "Shader", "Texture2D" }),
                        "Shared allowedTypes must be the canonical four.");
                    Assert.That(g.allowedPaths, Is.EquivalentTo(new[]
                    {
                        "Assets/UI/**", "Assets/HUD/**", "Assets/Audio/Shared/**", "Assets/Shaders/**", "Assets/Loading/**"
                    }), "Shared allowedPaths must be the canonical five globs.");
                }
            }
        }

        [Test]
        public void AC_Structural_RealManifestHasExactlyOneSharedGroup()
        {
            var text = System.IO.File.ReadAllText(ManifestPath);
            var manifest = JsonUtility.FromJson<ContentTopologyData>(text);

            var shared = new List<ContentTopologyGroup>();
            foreach (var g in manifest.groups)
            {
                if (g.category == "Shared") shared.Add(g);
            }
            Assert.That(shared.Count, Is.EqualTo(1), "Exactly one group may carry the Shared category.");
            Assert.That(shared[0].name, Is.EqualTo("Shared"), "The Shared group must be named exactly 'Shared'.");
            Assert.That(shared[0].rootAddress, Is.Null.Or.Empty, "Shared must omit rootAddress.");
        }

        [Test]
        public void AC_Structural_RealManifestRootAddressesMirror()
        {
            var text = System.IO.File.ReadAllText(ManifestPath);
            var manifest = JsonUtility.FromJson<ContentTopologyData>(text);

            foreach (var g in manifest.groups)
            {
                if (g.category == "Cars")
                {
                    var team = g.name.Substring("Cars/".Length);
                    Assert.That(g.rootAddress, Is.EqualTo($"Cars/{team}/CarDefinition"), $"Car {team} rootAddress");
                    Assert.That(g.rootPath, Is.EqualTo($"Assets/Cars/{team}/CarDefinition.prefab"), $"Car {team} rootPath");
                }
                else if (g.category == "Tracks")
                {
                    var track = g.name.Substring("Tracks/".Length);
                    Assert.That(g.rootAddress, Is.EqualTo($"Tracks/{track}/TrackData"), $"Track {track} rootAddress");
                    Assert.That(g.rootPath, Is.EqualTo($"Assets/Tracks/{track}/TrackData.asset"), $"Track {track} rootPath");
                }
                else
                {
                    Assert.That(g.rootAddress, Is.Null.Or.Empty, "Shared must omit rootAddress");
                    Assert.That(string.IsNullOrEmpty(g.rootPath), Is.True, "Shared must omit rootPath");
                }
            }
        }

        // ------------------------------------------------------------------ semantic: categories + counts

        [Test]
        public void AC_CG1_OnlyThreeCategoriesPass()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddWiredRootEntries();
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.True, string.Join("\n", result.Issues));
        }

        [Test]
        public void AC_CG1_ExtraCategoryFails()
        {
            var manifest = BuildFixtureManifest();
            manifest.groups.Add(new ContentTopologyGroup { name = "Music", category = "Music", allowedPaths = new List<string> { FixturesRoot + "/**" } });
            CreateAllFixtureGroups();
            AddWiredRootEntries();
            _settings.CreateGroup("Music", false, false, false, new List<AddressableAssetGroupSchema>(), new Type[0]);
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.UnknownGroup), Is.True, "Extra category must fail validation.");
        }

        [Test]
        public void AC_CG2_TwentyOneGroupsPass()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddWiredRootEntries();
            Assert.That(_settings.groups.Count, Is.EqualTo(21));
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.True, string.Join("\n", result.Issues));
        }

        [Test]
        public void AC_CG2_MissingGroupFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            // Remove one car group from settings → count 20, and a manifest group is missing.
            var group = _settings.FindGroup(ContentTopologyValidator.ToSettingsGroupName("Cars/" + FixtureCarIds[0]));
            _settings.RemoveGroup(group);
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.GroupCountMismatch), Is.True);
        }

        // ------------------------------------------------------------------ semantic: membership

        [Test]
        public void AC_CG3_SharedAllowlistPassesWithAllTypes()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddEntry("Shared", SharedDir + "/SharedUiPrefab.prefab", "Shared/SharedUiPrefab");
            AddEntry("Shared", SharedDir + "/SharedAudio.wav", "Shared/SharedAudio");
            AddEntry("Shared", SharedDir + "/SharedShader.shader", "Shared/SharedShader");
            AddEntry("Shared", SharedDir + "/LoadingTexture.png", "Shared/LoadingTexture");
            AddWiredRootEntries();
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.True, string.Join("\n", result.Issues));
        }

        [Test]
        public void AC_CG3_CarEntryInSharedFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddEntry("Shared", FixturesRoot + "/Cars/teamB/CarDefinition.asset", "Shared/ShouldNotBeHere");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.MembershipPathViolation), Is.True,
                "A car asset inside the Shared group violates the Shared allowedPaths.");
        }

        [Test]
        public void AC_CG4_CarGroupOwnAssetsPass()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddWiredRootEntries();
            AddEntry("Cars/teamB", FixturesRoot + "/Cars/teamB/CarDefinition.asset", "Cars/teamB/CarDefinition");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.True, string.Join("\n", result.Issues));
        }

        [Test]
        public void AC_CG4_CrossTeamEntryFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddEntry("Cars/teamB", FixturesRoot + "/Cars/teamC/CarDefinition.asset", "Cars/teamB/ShouldNotBeHere");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.MembershipPathViolation), Is.True,
                "Another team's asset inside a car group violates the folder-ownership rule.");
        }

        [Test]
        public void AC_CG5_TrackGroupOwnAssetsPass()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddWiredRootEntries();
            AddEntry("Tracks/monaco", FixturesRoot + "/Tracks/monaco/TrackData.asset", "Tracks/monaco/TrackData");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.True, string.Join("\n", result.Issues));
        }

        [Test]
        public void AC_CG5_CarEntryInTrackGroupFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddEntry("Tracks/monaco", FixturesRoot + "/Cars/teamB/CarDefinition.asset", "Tracks/monaco/ShouldNotBeHere");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.MembershipPathViolation), Is.True);
        }

        // ------------------------------------------------------------------ semantic: address mirror + root identity

        [Test]
        public void AC_Mirror_CarAndTrackRootAddressesPass()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddWiredRootEntries();
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.True, string.Join("\n", result.Issues));
        }

        [Test]
        public void AC_Mirror_EmptyRootAddressFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddEntry("Cars/teamB", FixturesRoot + "/Cars/teamB/CarDefinition.asset", ""); // root without an assigned address
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.AddressMirrorViolation), Is.True,
                "A root without an assigned address does not carry rootAddress → AddressMirrorViolation (the Addressables default is the asset path).");
        }

        [Test]
        public void AC_Mirror_MismatchedRootAddressFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddEntry("Cars/teamB", FixturesRoot + "/Cars/teamB/CarDefinition.asset", "Tracks/monaco/TrackData"); // wrong namespace
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.NamespaceViolation), Is.True);
        }

        [Test]
        public void AC_Mirror_SharedCarAddressFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddEntry("Shared", SharedDir + "/SharedUiPrefab.prefab", "Cars/teamB/CarDefinition"); // per-car address in Shared
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.NamespaceViolation), Is.True);
        }

        [Test]
        public void AC_Mirror_MissingRootEntryFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            // Group exists with an entry, but the ROOT path entry is absent.
            AddEntry("Cars/teamB", FixturesRoot + "/Cars/teamB/CarDefinition.asset", "Cars/teamB/CarDefinition");
            var group = _settings.FindGroup(ContentTopologyValidator.ToSettingsGroupName("Cars/teamB"));
            foreach (var e in new List<AddressableAssetEntry>(group.entries)) group.RemoveAssetEntry(e);
            // Re-add a NON-root entry only.
            AddEntry("Cars/teamB", FixturesRoot + "/Cars/teamC/CarDefinition.asset", "Cars/teamB/CarDefinition");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.RootEntryMissing), Is.True);
        }

        // ------------------------------------------------------------------ semantic: dependency closure

        [Test]
        public void AC_CG6_BaselineNoCrossCarPasses()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddWiredRootEntries();
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.True, string.Join("\n", result.Issues));
        }

        [Test]
        public void AC_CG6_Edge1CrossCarReferenceFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            // Car A's root fixture carries the cross-car reference to car B's asset.
            AddEntry("Cars/teamA", FixturesRoot + "/Cars/teamA/CarDefinition.asset", "Cars/teamA/CarDefinition");
            AddEntry("Cars/teamB", FixturesRoot + "/Cars/teamB/CarDefinition.asset", "Cars/teamB/CarDefinition");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.CrossCarDependency), Is.True,
                "Car A's closure reaches car B's asset — cross-car dependency must be reported.");
        }

        [Test]
        public void AC_CG6_Edge2SharedDependencyPasses()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            // Car C's root fixture carries the legitimate Shared reference.
            AddWiredRootEntries();
            AddEntry("Shared", SharedDir + "/SharedUiPrefab.prefab", "Shared/SharedUiPrefab");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.True, string.Join("\n", result.Issues));
        }

        [Test]
        public void AC_CG3_DisallowedTypeInSharedFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            // Path matches Shared allowedPaths, but the type (CarFixtureData SO) is not in the
            // Shared allowlist (Prefab/AudioClip/Shader/Texture2D) → MembershipTypeViolation.
            AddEntry("Shared", SharedDir + "/NotAllowed.asset", "Shared/NotAllowed");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.MembershipTypeViolation), Is.True,
                "A ScriptableObject inside Shared violates the allowedTypes allowlist.");
        }

        [Test]
        public void AC_Manifest_UnknownLabelFailsEvenWhenAnotherLabelMatches()
        {
            var manifest = BuildFixtureManifest();
            manifest.groups[0].allowedTypes.Add("Bogus"); // Shared group (index 0)
            CreateAllFixtureGroups();
            AddEntry("Shared", SharedDir + "/SharedUiPrefab.prefab", "Shared/SharedUiPrefab");
            AddWiredRootEntries();
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.UnknownManifestLabel), Is.True,
                "An unknown manifest label is a validation error even when another label matches the entry.");
        }

        [Test]
        public void AC_Manifest_UnknownLabelCardinalityAndDedup()
        {
            var manifest = BuildFixtureManifest();
            manifest.groups[0].allowedTypes.Add("Bogus");
            manifest.groups[0].allowedTypes.Add("Nope");
            manifest.groups[0].allowedTypes.Add("Bogus"); // duplicate — must be reported once
            CreateAllFixtureGroups();
            AddWiredRootEntries();
            var result = ContentTopologyValidator.Validate(_settings, manifest);

            var unknownLabels = new List<string>();
            foreach (var issue in result.Issues)
            {
                if (issue.Kind == ContentTopologyIssueKind.UnknownManifestLabel)
                {
                    unknownLabels.Add(issue.Message);
                    Assert.That(issue.GroupName, Is.EqualTo("Shared"), "Unknown label issue must carry its group name.");
                }
            }
            Assert.That(unknownLabels.Count, Is.EqualTo(2), "Two DISTINCT unknown labels → two issues; the duplicate 'Bogus' is deduplicated.");
            Assert.That(unknownLabels, Has.Some.Contains("Bogus"));
            Assert.That(unknownLabels, Has.Some.Contains("Nope"));
        }

        [Test]
        public void AC_Manifest_UnknownLabelReportedOnEntrylessGroup()
        {
            var manifest = BuildFixtureManifest();
            manifest.groups[0].allowedTypes.Add("Bogus");
            CreateAllFixtureGroups();
            // No entries at all — the pre-pass must still report the unknown label.
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.UnknownManifestLabel), Is.True,
                "Unknown labels are manifest errors even when the group has zero entries.");
        }

        [Test]
        public void AC_Manifest_UnknownLabelOnAbsentGroupReportsUnknownGroupOnly()
        {
            // Documents the diagnostic behavior: manifest groups absent from settings are
            // reported via UnknownGroup; their label problems are NOT validated (the group
            // itself cannot be validated), so UnknownManifestLabel stays absent.
            var manifest = BuildFixtureManifest();
            manifest.groups.Add(new ContentTopologyGroup
            {
                name = "Cars/teamGhost",
                category = "Cars",
                allowedTypes = new List<string> { "Bogus" },
                allowedPaths = new List<string> { FixturesRoot + "/Cars/teamGhost/**" }
            });
            CreateAllFixtureGroups();
            AddWiredRootEntries();
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.UnknownGroup), Is.True,
                "A manifest group missing from settings must be reported as UnknownGroup.");
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.UnknownManifestLabel), Is.False,
                "Label validation is coupled to group presence — an absent group's labels are not validated.");
        }

        [Test]
        public void AC_Membership_NonRootExplicitInNamespaceAddressPasses()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddWiredRootEntries();
            // Non-root entries must carry an EXPLICIT in-namespace address: Addressables defaults
            // an unset address to the asset path (outside the group namespace → violation), so
            // "empty address" is not representable — the mirror rule applies to every entry.
            AddEntry("Cars/teamC", FixturesRoot + "/Cars/teamC/ExtraClean.asset", "Cars/teamC/ExtraClean");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.True, string.Join("\n", result.Issues));
        }

        [Test]
        public void AC_Mirror_UnsetNonRootAddressDefaultsToPathAndFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddWiredRootEntries();
            // An entry whose address is NOT explicitly assigned gets the Addressables default
            // (its asset path) — outside the group namespace → NamespaceViolation.
            AddEntry("Cars/teamC", FixturesRoot + "/Cars/teamC/ExtraClean.asset", "");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.NamespaceViolation), Is.True,
                "An unset address defaults to the asset path — outside the namespace.");
        }

        [Test]
        public void AC_Mirror_TrackRootEmptyAddressFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            // QA case L124: missing TrackData must fail — the track root is only covered
            // positively elsewhere; a track-root regression must not pass unnoticed.
            AddEntry("Tracks/monaco", FixturesRoot + "/Tracks/monaco/TrackData.asset", "");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.AddressMirrorViolation), Is.True,
                "A track root without an assigned address must fail the mirror check.");
        }

        [Test]
        public void AC_CG3_SharedGlobPartitionsMatchIndividually()
        {
            var manifest = BuildFixtureManifest();
            // Restrictive per-partition globs instead of the broad catch-all: proves the
            // validator applies each allowedPaths glob independently (OR semantics), not just
            // a single glob — the partition behavior behind the canonical five globs.
            manifest.groups[0].allowedPaths.Clear();
            manifest.groups[0].allowedPaths.Add(SharedDir + "/*.png");
            manifest.groups[0].allowedPaths.Add(SharedDir + "/*.wav");
            CreateAllFixtureGroups();
            AddWiredRootEntries();
            AddEntry("Shared", SharedDir + "/LoadingTexture.png", "Shared/LoadingTexture");
            AddEntry("Shared", SharedDir + "/SharedAudio.wav", "Shared/SharedAudio");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.True, string.Join("\n", result.Issues));

            // A prefab matches NO partition → MembershipPathViolation.
            AddEntry("Shared", SharedDir + "/SharedUiPrefab.prefab", "Shared/SharedUiPrefab");
            var result2 = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(ContainsKind(result2, ContentTopologyIssueKind.MembershipPathViolation), Is.True,
                "An entry matching no allowedPaths partition must be a path violation.");
        }

        [Test]
        public void AC_Mirror_SameNamespaceWrongAddressFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            // Same-namespace wrong address: prefix "Cars/teamB/" is valid, but the root address
            // differs from rootAddress → AddressMirrorViolation, NOT NamespaceViolation.
            AddEntry("Cars/teamB", FixturesRoot + "/Cars/teamB/CarDefinition.asset", "Cars/teamB/WrongAddress");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.AddressMirrorViolation), Is.True);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.NamespaceViolation), Is.False,
                "The wrong address is in the correct namespace — only the root equality check may fire.");
        }

        [Test]
        public void AC_Namespace_CrossTeamCarAddressFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddEntry("Cars/teamB", FixturesRoot + "/Cars/teamB/CarDefinition.asset", "Cars/teamC/CarDefinition");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.NamespaceViolation), Is.True,
                "Cars/teamC address inside Cars/teamB must be a namespace violation.");
        }

        [Test]
        public void AC_Namespace_CrossTrackAddressFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddEntry("Tracks/monaco", FixturesRoot + "/Tracks/monaco/TrackData.asset", "Tracks/monza/TrackData");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.NamespaceViolation), Is.True,
                "Tracks/monza address inside Tracks/monaco must be a namespace violation.");
        }

        [Test]
        public void AC_Namespace_SharedTrackAddressFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddEntry("Shared", SharedDir + "/SharedUiPrefab.prefab", "Tracks/monaco/TrackData");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.NamespaceViolation), Is.True,
                "A Tracks/ address inside Shared must be a namespace violation.");
        }

        [Test]
        public void AC_CG1_UndeclaredSettingsGroupFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddWiredRootEntries();
            // Group exists in settings but is NOT declared in the manifest → UnknownGroup by name.
            _settings.CreateGroup("Secret", false, false, false, new List<AddressableAssetGroupSchema>(), new Type[0]);
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.UnknownGroup), Is.True,
                "An undeclared settings group must fail via UnknownGroup.");
        }

        [Test]
        public void AC_CG6_NonRootCrossCarEntryFails()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            // teamB group with its clean ROOT entry PLUS a NON-root entry whose fixture carries a
            // cross-car reference to teamC — proves the closure check runs for EVERY entry.
            AddEntry("Cars/teamB", FixturesRoot + "/Cars/teamB/CarDefinition.asset", "Cars/teamB/CarDefinition");
            AddEntry("Cars/teamB", FixturesRoot + "/Cars/teamB/Extra.asset", "");
            var result = ContentTopologyValidator.Validate(_settings, manifest);
            Assert.That(result.IsValid, Is.False);
            Assert.That(ContainsKind(result, ContentTopologyIssueKind.CrossCarDependency), Is.True,
                "A non-root entry's closure reaching another car group must be reported.");
        }

        // ------------------------------------------------------------------ semantic: assignment tooling

        [Test]
        public void AC_Tooling_AssignAllPopulatesEmptyRootAddresses()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            // Every wired root (all groups with rootPath in the fixture manifest) starts EMPTY.
            AddEntry("Cars/teamB", FixturesRoot + "/Cars/teamB/CarDefinition.asset", "");
            AddEntry("Cars/teamC", FixturesRoot + "/Cars/teamC/CarDefinition.asset", "");
            AddEntry("Tracks/monaco", FixturesRoot + "/Tracks/monaco/TrackData.asset", "");

            var assigned = AddressAssignmentTool.AssignAll(_settings, manifest);

            // 3 wired roots — a mutation skipping any group must drop this below 3.
            Assert.That(assigned, Is.EqualTo(3));
            var bGroup = _settings.FindGroup(ContentTopologyValidator.ToSettingsGroupName("Cars/teamB"));
            Assert.That(FindEntry(bGroup, FixturesRoot + "/Cars/teamB/CarDefinition.asset").address,
                Is.EqualTo("Cars/teamB/CarDefinition"));
            var cGroup = _settings.FindGroup(ContentTopologyValidator.ToSettingsGroupName("Cars/teamC"));
            Assert.That(FindEntry(cGroup, FixturesRoot + "/Cars/teamC/CarDefinition.asset").address,
                Is.EqualTo("Cars/teamC/CarDefinition"));
            var mGroup = _settings.FindGroup(ContentTopologyValidator.ToSettingsGroupName("Tracks/monaco"));
            Assert.That(FindEntry(mGroup, FixturesRoot + "/Tracks/monaco/TrackData.asset").address,
                Is.EqualTo("Tracks/monaco/TrackData"));
        }

        [Test]
        public void AC_Tooling_AssignAllCorrectsCorruptedAddress()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddEntry("Cars/teamB", FixturesRoot + "/Cars/teamB/CarDefinition.asset", "Tracks/monaco/TrackData"); // corrupted

            var assigned = AddressAssignmentTool.AssignAll(_settings, manifest);

            Assert.That(assigned, Is.EqualTo(1));
            var bGroup = _settings.FindGroup(ContentTopologyValidator.ToSettingsGroupName("Cars/teamB"));
            Assert.That(FindEntry(bGroup, FixturesRoot + "/Cars/teamB/CarDefinition.asset").address,
                Is.EqualTo("Cars/teamB/CarDefinition"), "AssignAll must correct the wrong address.");
        }

        [Test]
        public void AC_Tooling_AssignAllIdempotentOnCorrect()
        {
            var manifest = BuildFixtureManifest();
            CreateAllFixtureGroups();
            AddWiredRootEntries();

            var assigned = AddressAssignmentTool.AssignAll(_settings, manifest);

            Assert.That(assigned, Is.EqualTo(0), "Correct addresses are left unchanged.");
        }

        // ------------------------------------------------------------------ helpers

        private static bool ContainsKind(ContentTopologyResult result, ContentTopologyIssueKind kind)
        {
            foreach (var issue in result.Issues)
            {
                if (issue.Kind == kind) return true;
            }
            return false;
        }

        private static AddressableAssetEntry FindEntry(AddressableAssetGroup group, string assetPath)
        {
            foreach (var entry in group.entries)
            {
                if (entry != null && string.Equals(entry.AssetPath, assetPath, System.StringComparison.OrdinalIgnoreCase)) return entry;
            }
            return null;
        }
    }
}
