# Story 001: Content Groups & Address Mirror

> **Epic**: Content Pipeline
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Integration (editor integration tests)
> **Manifest Version**: 2026-08-05
> **Estimate**: M (3-4h)

## Context

**GDD**: `design/gdd/content-pipeline.md`
**Requirement**: `TR-content-001`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0003: Content Pipeline and Addressables
**ADR Decision Summary**: 3 Addressable group categories (Shared + Cars/{teamId} + Tracks/{trackId}), one bundle per car/track for individual memory tracking and incremental rebuilds. Group NAMES are never runtime load keys — the load key is the asset's ADDRESS; group names must be mirrored by explicit address assignment in editor tooling.

**Engine**: Unity 6000.3.22f1 (Unity 6.3 LTS) | **Risk**: LOW (Addressables editor APIs)

**Engine Notes**: Addressables 3.1.0 installed (Packages/manifest.json). Editor APIs: `UnityEditor.AddressableAssets.Settings.AddressableAssetSettingsDefaultObject.Settings.groups`. Groups window is editor-only; runtime locators expose keys/locations, not editor group topology.

**Performance disposition**: Editor-time topology checks have no runtime cost (they run in the Editor import/inspection path, never in builds). Addressable bundle composition (17 bundles, per-car isolation) is a memory/load-time concern measured at the profiling gate — TD-026; this story's editor tooling only asserts the mirror invariant, it does not measure bundle load budgets.

**Control Manifest Rules (Foundation layer)**:
- Required: 3 groups (Shared, Cars/{teamId}, Tracks/{trackId}); 17 bundles (1 track + 16 cars) load in parallel — source: ADR-0003
- Required: Addressable GROUP NAMES are never runtime load keys — the load key is the asset's ADDRESS; editor tooling must mirror group names with explicit address assignment; editor import script asserts the mirror — source: ADR-0003
- Required: Per-car address, never a shared constant: `Cars/{teamId}/CarDefinition`; `Tracks/{trackId}/TrackData` — source: ADR-0003
- Forbidden: Never use a monolithic single Addressables group — source: ADR-0003

---

## Acceptance Criteria

*From GDD `design/gdd/content-pipeline.md`, scoped to this story. Verification seam: EDITOR test against real `AddressableAssetSettings` objects (fixtures — see Implementation Notes). Runtime catalog/bundle verification is explicitly deferred to Story 003 (runtime load):*

- [ ] **AC-CG1**: Given the project's Addressable settings, When the top-level groups are enumerated, Then exactly 3 group categories exist: Shared, Cars/{TeamId}, and Tracks/{TrackId} — no other top-level categories.
- [ ] **AC-CG2**: Given the project's full topology, When all groups are enumerated, Then 21 groups exist: 1 Shared + 16 Cars + 4 Tracks (MVP track set: monaco, monza, silverstone, spa). *(Race projection — 16 cars + 1 selected track = 18 loaded bundles — is a runtime-load concern, owned by Story 003; the editor topology invariant is the global 21.)*
- [ ] **AC-CG3**: Given the Shared group, When its entries are enumerated against the manifest allowlist predicates (allowedTypes + allowedPaths), Then it contains only: UI prefabs, HUD prefabs, shared audio clips, shared shaders, and loading screen assets — no car or track assets.
- [ ] **AC-CG4**: Given the `Cars/team_tier4_d` group, When its entries are enumerated against the manifest allowlist, Then it contains only `team_tier4_d`'s assets (car prefab, materials, textures, engine audio) — no assets from other teams.
- [ ] **AC-CG5**: Given a `Tracks/{trackId}` group, When its entries are enumerated against the manifest allowlist, Then it contains only that track's assets (mesh, environment, lighting, track audio) — no car assets.
- [ ] **AC-CG6**: Given any car group, When its dependency closure is computed via `AssetDatabase.GetDependencies`, Then it has no cross-references to another car bundle. *(Declared dependencies on Shared assets are allowed; dependencies on another car bundle are forbidden — editor static check, runtime bundle analysis deferred to Story 003.)*
- [ ] **Address mirror (ADR-0003:129-149)**: Given any car root asset and track root asset, When their assigned addresses are inspected, Then the car root carries `Cars/{teamId}/CarDefinition` and the track root carries `Tracks/{trackId}/TrackData`. *(Group names remain a namespace mirror — runtime load keys are owned by Story 003; this story only asserts the editor-side address assignment.)*

---

## Implementation Notes

*Derived from ADR-0003 Implementation Guidelines + gate corrections (topology count, deterministic fixtures, schema):*

- **Assembly plan** (gate R2-4): two assemblies + one editor test assembly:
  - `Overdrive.Content` (runtime, Unity-backed): `AddressableKeys` constants (ADR-0003:138-149) + `ContentTopologyData` manifest model (JSON-deserializable). No editor dependency.
  - `Overdrive.Content.Editor` (platform: Editor; refs `Unity.Addressables.Editor` + `Overdrive.Content`): `ContentTopologyValidator` (validates an injected `AddressableAssetSettings` against a manifest — reads each entry's `AddressableAssetEntry.address` directly; an empty/missing root address is an `AddressMirrorViolation`; no separate address-source seam is needed since the assignment tooling writes the same entry field) + `AddressAssignmentTool` (callable seam: `AssignAll(AddressableAssetSettings settings, ContentTopologyData manifest)` sets each car/track group's root entry address to `rootAddress`; idempotent — re-running on a correct settings leaves it unchanged, re-running on a settings with a WRONG address corrects it). NOTE: the Addressables EDITOR assembly reference is `Unity.Addressables.Editor` (the namespace `UnityEditor.AddressableAssets` is not an asmdef reference).
  - Type predicate mapping (gate R6-2 + R7-2): manifest `allowedTypes` labels map to concrete `System.Type` values resolved by `AssetDatabase.GetMainAssetTypeAtPath`: `"Prefab"` → `typeof(GameObject)`, `"AudioClip"` → `typeof(AudioClip)`, `"Shader"` → `typeof(Shader)`, `"Texture2D"` → `typeof(Texture2D)` — the validator resolves labels via this table; an unknown label is a manifest validation error.
  - Editor test: `Assets/tests/editor/content/ContentTopologyTests.asmdef` — `autoReferenced: false`, `optionalUnityReferences: ["TestAssemblies"]` (project convention — the explicit TestRunner refs are redundant; the specialist-confirmed pattern), `includePlatforms: ["Editor"]` (editor-only by nature; the project's PLAYMODE test asmdefs use `includePlatforms: []` because they run in PlayMode — an editor test assembly is Editor-only by definition), refs `Overdrive.Content.Editor` + `Overdrive.Content` + `Unity.Addressables.Editor` (asmdef refs are NON-transitive — the test needs a direct ref to `Overdrive.Content` even though `Overdrive.Content.Editor` already references it) — with test class `ContentTopologyTests`.

- **Topology manifest** (gate NEW-04 + R1-2/R1-4/R1-7 + R2-2 + R3-1 + R4-1/R4-3): `Assets/Settings/Content/topology.json` — canonical manifest with concrete predicates. **The JSON below is a REPRESENTATIVE EXCERPT (3 groups) — the real manifest lists all 21 groups** (Shared + 16 Cars + 4 Tracks); the structural test derives the full group set by pattern (every `Cars/*` and `Tracks/*` group present, count == 21):
  ```json
  {
    "groups": [
      { "name": "Shared", "category": "Shared", "rootAddress": null,
        "allowedTypes": ["Prefab", "AudioClip", "Shader", "Texture2D"],
        "allowedPaths": ["Assets/UI/**", "Assets/HUD/**", "Assets/Audio/Shared/**", "Assets/Shaders/**", "Assets/Loading/**"] },
      { "name": "Cars/team_tier4_d", "category": "Cars",
        "rootAddress": "Cars/team_tier4_d/CarDefinition",
        "rootPath": "Assets/Cars/team_tier4_d/CarDefinition.prefab",
        "allowedPaths": ["Assets/Cars/team_tier4_d/**"] },
      { "name": "Tracks/monaco", "category": "Tracks",
        "rootAddress": "Tracks/monaco/TrackData",
        "rootPath": "Assets/Tracks/monaco/TrackData.asset",
        "allowedPaths": ["Assets/Tracks/monaco/**"] }
    ],
    "expectedGroupCount": 21,
    "allowedSharedDependencies": true,
    "forbiddenCrossCarDependencies": true
  }
  ```
  - `expectedGroupCount: 21` = full project topology (1 Shared + 16 Cars + 4 Tracks); the 18-bundle race projection is a Story 003 runtime concern.
  - **Membership predicate per entry** (gate R4-2): the validator classifies every group entry by (a) its asset PATH against the group's `allowedPaths` globs (project-relative), and (b) its main asset TYPE (`AssetDatabase.GetMainAssetTypeAtPath`) against `allowedTypes` where present (Shared group). A car group's `allowedPaths` (`Assets/Cars/{teamId}/**`) IS the complete predicate — the folder-ownership rule makes type lists redundant there. Any entry failing its group's predicate is a topology violation. In the SEMANTIC fixture layer the same rule applies with fixture paths: `Assets/tests/content/Fixtures/Cars/{teamId}/**`, `Fixtures/Tracks/{trackId}/**`, `Fixtures/Shared/**` — the fixture manifest's allowedPaths mirror the ownership shape so AC-CG4/5 semantics are identical.
  - **Addressables group-name sanitization** (implemented fact, gate did not cover): `AddressableAssetGroup.CreateGroup` REPLACES `/` with `-` in group names — a group created as `Cars/team_tier4_d` is stored as `Cars-team_tier4_d` (the `/` is illegal in bundle names). The manifest keeps the conceptual names (ADR mirror); the validator/tooling translate via `ContentTopologyValidator.ToSettingsGroupName` (manifest→settings: `/`→`-`) and `ToManifestGroupName` (reverse) for `settings.FindGroup` lookups. The address namespace mirror check uses the MANIFEST name (with `/`) — `Cars/team_tier4_d/CarDefinition` stays the executable address. Also: `CreateGroup` throws NRE internally when `schemasToCopy`/`types` are null — pass empty list / empty `Type[0]`.
  - **Root asset identity** (gate R4-3 + R5-1/R5-2): each car/track group declares `rootPath` (the project-relative path of its root entry) alongside `rootAddress`. The validator asserts: (a) the group has an entry whose asset path == `rootPath`; (b) that entry's `address` == `rootAddress`; (c) a root entry with an EMPTY address is an `AddressMirrorViolation` (missing-address case); (d) an entry with an address outside its group's namespace is an `AddressMirrorViolation` (mismatched case). In the SEMANTIC fixture layer, `rootPath` is rewritten to the concrete fixture asset (e.g. `Assets/tests/content/Fixtures/Cars/{teamId}/CarDefinition.asset` and `Fixtures/Tracks/{trackId}/TrackData.asset`) — the fixture manifest's rootPath values always resolve to committed fixture assets. The Shared group declares `rootAddress: null` and OMITS `rootPath`: the validator SKIPS root-identity validation for Shared, but still rejects any entry in Shared whose address uses a `Cars/` or `Tracks/` namespace prefix (an invalid per-car address in Shared is still an `AddressMirrorViolation`).
  - **Address scope rule** (gate R6-4 + implemented fact): the NAMESPACE check applies to EVERY entry of a car/track group (no entry may carry an address with another group's namespace prefix — e.g. an entry in `Cars/team_tier4_d` with address `Cars/team_tier1_b/...` is an `AddressMirrorViolation`), while the ROOT IDENTITY check (rootPath entry exists and its address == rootAddress) applies only to the group's root entry. IMPLEMENTED FACT: `AddressableAssetEntry.address` is NEVER empty — an unset address defaults to the asset path (outside the namespace), so non-root entries must carry an EXPLICIT in-namespace address to pass; the story's original "non-root may have an empty address" premise is not representable in Addressables (covered by `AC_Membership_NonRootExplicitInNamespaceAddressPasses` + `AC_Mirror_UnsetNonRootAddressDefaultsToPathAndFails`). Shared-group entries must have no `Cars/`/`Tracks/`-prefixed address.
  - **Fixture asset contract** (gate R6-3): committed fixture assets under `Assets/tests/content/Fixtures/` (IMPLEMENTED DEVIATION: the story's original `Assets/tests/editor/content/Fixtures/` path is impossible — `AddressableAssetUtility.IsPathValidForEntry` REJECTS any asset whose path contains `/Editor/` (case-insensitive), and the fixtures are Addressables entries; `Assets/tests/content/...` has no `Editor` segment. The editor TEST (asmdef + .cs) stays under `Assets/tests/editor/content/` — only the FIXTURES moved) with a concrete inventory:
    - `Fixtures/Scripts/CarFixtureData.cs` — `[Serializable]` ScriptableObject with two optional reference fields: `[SerializeField] UnityEngine.Object CrossCarReference` (null except on car A's fixture, where it references car B's asset) and `[SerializeField] UnityEngine.Object SharedReference` (non-null only on car C's fixture, referencing `Fixtures/Shared/SharedUiPrefab.prefab`) + `Fixtures/Scripts/TrackFixtureData.cs` — `[Serializable]` ScriptableObject.
    - `Fixtures/Shared/SharedUiPrefab.prefab`, `Fixtures/Shared/SharedHudPrefab.prefab`, `Fixtures/Shared/LoadingScreenPrefab.prefab`, `Fixtures/Shared/SharedAudio.asset` (AudioClip), `Fixtures/Shared/SharedShader.shader`, `Fixtures/Shared/LoadingTexture.png` (Texture2D).
    - `Fixtures/Cars/{teamId}/CarDefinition.asset` (CarFixtureData; ONLY car A's instance carries the cross-car reference to `Fixtures/Cars/{teamB}/CarDefinition.asset`; car C's instance carries a legitimate reference to `Fixtures/Shared/SharedUiPrefab.prefab` — the Shared-dependency fixture exercising `allowedSharedDependencies`; all other 14 cars are reference-free).
    - `Fixtures/Tracks/{trackId}/TrackData.asset` (TrackFixtureData).
    The semantic tests reference these concrete paths; nothing is temp-created under Assets/ at test time. Baseline (no cross-car) uses any reference-free car (e.g. car B); the negative cross-car case uses car A — no fixture mutation/restore needed.
  - **Cross-car closure scope** (gate R5-3): the dependency policy is GROUP-LEVEL — the validator computes `AssetDatabase.GetDependencies` for EVERY entry in the group (not only the root) and asserts no entry's closure resolves to an asset path inside another `Cars/{other}/**` folder (`allowedSharedDependencies` allows `Shared` roots). The cross-car fixture therefore places the cross-car `[SerializeField] UnityEngine.Object` reference on car A's ROOT fixture asset (`Fixtures/Cars/{teamA}/CarDefinition.asset`), guaranteeing the edge is inside the group's tested closure.
  - ADDRESSES are runtime keys derived from `rootAddress` — never persisted per entry; the mirror rule (below) asserts the root address of the group's root asset.
  - Dependency policy booleans are VERIFIED (not declared): the editor test computes each car group's dependency closure via `AssetDatabase.GetDependencies(entryPath)` and asserts no entry resolves to an asset path in another `Cars/{other}/**` folder (`allowedSharedDependencies` allows `Assets/Shared/**`-style shared roots).
- **Deterministic test fixture** (gate R1-3 + R2-1 + R3-4/R3-5): the editor test does NOT depend on manually-created project groups. **Two-layer validation** resolves the fixture-path/ownership contradiction:
  - **Structural layer** (always passable, validates the REAL manifest): parse `Assets/Settings/Content/topology.json` via `JsonUtility.FromJson<ContentTopologyData>`; assert 21 groups (1 Shared + 16 Cars + 4 Tracks), the 3 category names, the exact 16 team IDs (team_tier1_a..d, team_tier2_a..d, team_tier3_a..d, team_tier4_a..d), the 4 track IDs (monaco, monza, silverstone, spa), and each group's rootAddress. No asset content is required.
  - **Semantic layer** (validates validator LOGIC): the test builds a `ContentTopologyData` fixture manifest IN CODE whose `allowedPaths` point at the committed fixture paths (`Assets/tests/content/Fixtures/Cars/...`, `.../Tracks/...`, `.../Shared/...`), plus a temporary `AddressableAssetSettings` (created via `AddressableAssetSettings.Create` with `createDefaultGroup: false`), fixture groups (21: Shared + 16 Cars + 4 Tracks) and entries via `settings.CreateOrMoveEntry(AssetDatabase.AssetPathToGUID(fixturePath), group)`. The settings object is destroyed in teardown (`UnityEngine.Object.DestroyImmediate`). Fixture assets are committed (never temp-created) so GetDependencies and type checks see real imported assets.
  - The manifest JSON model is JsonUtility-compatible: `[Serializable]` classes with public fields, `List<T>` collections, no dictionaries, no properties-only members.
- **Editor tooling**: `Overdrive.Content.Editor` assembly (refs `Unity.Addressables.Editor` + `Overdrive.Content`) — tooling that assigns addresses mirroring group names (ADR-0003:130-137). Editor import script asserts the mirror (group name `Cars/{teamId}` ↔ root address `Cars/{teamId}/CarDefinition` — PREFIX mirror, per ADR-0003:146-147 which is the executable contract).
- **`AddressableKeys` constants** (ADR-0003:138-149): `SharedGroup`, `CarGroup(teamId)` → `Cars/{teamId}`, `TrackGroup(trackId)` → `Tracks/{trackId}`, `CarPrefab`, `CarDefinition(teamId)` → `Cars/{teamId}/CarDefinition`, `TrackData(trackId)` → `Tracks/{trackId}/TrackData`, `TrackEnvironment`.
- **Negative fixtures** (gate F2 + R1-6 + R2-3 + R4-4 + R5-3): all implemented against the fixture settings with committed fixture assets — (a) shared `CarDefinition` address (a Shared-group entry carrying a `Cars/`-prefixed address → validator fails with `AddressMirrorViolation`), (b) mismatched group/address (car root address outside its group namespace, e.g. `Tracks/monaco/CarDefinition` in the car group → `AddressMirrorViolation`), (c) missing `TrackData` address (track group root entry with empty address → `AddressMirrorViolation`), (d) cross-car dependency — the fixture car A ROOT asset (`Fixtures/Cars/{teamA}/CarDefinition.asset`) carries a `[SerializeField] UnityEngine.Object` field referencing an asset in fixture car B's folder; the serialized reference creates a real `AssetDatabase.GetDependencies` edge once imported, and the group-level closure check (every entry, see above) sees it → validator emits `CrossCarDependency` and fails. Validator result type: `ContentTopologyResult { bool IsValid; List<ContentTopologyIssue> Issues }` with issue kinds named above.
- **ADR ambiguity resolution** (gate R1-8): ADR-0003:134 says the root asset is addressed `Cars/{teamId}` while the executable code (L146-147) defines `Cars/{teamId}/CarDefinition`. The CODE governs: group name = namespace, root asset address = per-root (`.../CarDefinition`/`.../TrackData`). The story asserts the per-root address; the group name is only a mirror prefix.

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- [Story 002]: CP_ state machine (consumes the keys)
- [Story 003]: Runtime load orchestration (including: runtime catalog/bundle verification, group names as load-key prohibition enforcement, the 18-bundle race projection)
- Actual Addressable group creation in the Unity Editor → manual editor setup per ADR-0003 Migration Plan (groups window); the story's editor test uses deterministic fixtures, NOT the project's production settings, so it does not depend on this manual setup
- Dependency/closure verification for BUILT bundles (bundle-level analysis) → profiling gate (TD-026)

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate) and corrected by gate R1. The developer implements against these — do not invent new test cases during implementation.*

- **AC-CG1**: Given fixture settings with 3 categories; When top-level groups enumerated; Then exactly Shared, Cars/, Tracks/ exist. Edge: an extra top-level category fails.
- **AC-CG2**: Given fixture mirroring full topology; When all groups enumerated; Then 21 groups (1 Shared + 16 Cars + 4 Tracks). Edge: 20 or 22 fails.
- **AC-CG3**: Given Shared group fixture; When entries enumerated against manifest allowlist; Then only UI/HUD/audio/shader/loading entries pass. Edge: a car prefab entry in Shared fails.
- **AC-CG4**: Given Cars/team_tier4_d fixture; When entries enumerated; Then only team_tier4_d entries. Edge: another team's asset entry fails.
- **AC-CG5**: Given Tracks/monaco fixture; When entries enumerated; Then only monaco entries. Edge: a car asset entry fails.
- **AC-CG6**: Given the fixture car groups (A, B, C) where reference-free car B's closure contains NO reference to any other car; When the dependency closure is computed via AssetDatabase.GetDependencies on every entry of each car group; Then validation passes for B (baseline). Edge 1: car A (whose root fixture's `CrossCarReference` points to car B) → validator emits `CrossCarDependency` and fails. Edge 2: car C (whose root fixture's `SharedReference` points to `Fixtures/Shared/SharedUiPrefab.prefab`) → validator passes (Shared dependency allowed).
- **Address mirror**: Given fixture with root assets; When addresses inspected; Then car root = `Cars/{teamId}/CarDefinition`, track root = `Tracks/{trackId}/TrackData`. Edges: shared CarDefinition fails; mismatched group/address fails; missing TrackData fails; cross-car dep fails.
- **Assignment tooling**: Given fixture settings with EMPTY root addresses; When `AddressAssignmentTool.AssignAll(settings, manifest)` runs; Then every car/track root entry address == `rootAddress`. Edge: re-running AssignAll on a settings where one address was corrupted to a wrong value CORRECTS it (tooling is the tested seam, not manual assignment).

---

## Test Evidence

**Story Type**: Integration
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Editor test: `Assets/tests/editor/content/ContentTopologyTests.cs` — builds deterministic fixture AddressableAssetSettings, asserts manifest topology (21 groups, 3 categories, allowlists, address mirror, dependency closure, assignment tooling). Must exist and pass.

**Status**: [x] CREATED — `Assets/tests/editor/content/ContentTopologyTests.cs`, **42 editor tests green** (6 structural + 36 semantic), full suite **785/785 PlayMode** (2026-08-14). Also: `Assets/tests/content/Fixtures/` committed fixtures (car A cross-ref, car B baseline, car C shared-ref + Extra non-root cross-ref, ExtraClean clean non-root, Shared/NotAllowed disallowed-type, Shared prefabs/audio/shader/png). Implemented deviations documented in Implementation Notes: group-name sanitization (`/`→`-`), fixtures outside `/Editor/` paths, `entry.address` never empty (path default).

---

## Dependencies

- Depends on: None (first Content story); does NOT depend on manual Addressables group setup — the editor test uses deterministic fixtures
- Unlocks: Stories 002-007 (all consume the AddressableKeys + topology)

---

## Completion Notes

**Completed**: 2026-08-14
**Criteria**: 7/7 passing (0 deferred)
**Deviations**: None — 3 implemented facts (Addressables behaviors the readiness gate could not cover) documented in Implementation Notes: (1) CreateGroup sanitizes `/`→`-` in group names, translated via ToSettingsGroupName/ToManifestGroupName; (2) AddressableAssetUtility.IsPathValidForEntry rejects any path containing `/Editor/` — fixtures live under Assets/tests/content/Fixtures (test asmdef stays under Assets/tests/editor/content/); (3) AddressableAssetEntry.address is NEVER empty — unset defaults to the asset path (story L81 corrected).
**Test Evidence**: Integration — `Assets/tests/editor/content/ContentTopologyTests.cs` (42 editor tests: 6 structural + 36 semantic), full suite 785/785 PlayMode
**Code Review**: Complete — unity-specialist APPROVED (4 rounds), qa-tester TESTABLE (R6, 0 findings); gates LP-CODE-REVIEW APPROVED, QL-TEST-COVERAGE ADEQUATE (R2)
**Out of scope (valid)**: MultiplayerIsolationTests.cs AC4 guardrail widened +Overdrive.Content (required for the new assembly — same pattern as story 3-2)
**Tech debt**: None new (TD-026 pre-existing covers runtime bundle analysis)
