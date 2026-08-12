# Story 001: Content Groups & Address Mirror

> **Epic**: Content Pipeline
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Config/Data + Editor Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: M (3-4h)

## Context

**GDD**: `design/gdd/content-pipeline.md`
**Requirement**: `TR-content-001`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0003: Content Pipeline and Addressables
**ADR Decision Summary**: 3 Addressable group categories (Shared + Cars/{teamId} + Tracks/{trackId}), one bundle per car/track for individual memory tracking and incremental rebuilds. Group NAMES are never runtime load keys — the load key is the asset's ADDRESS; group names must be mirrored by explicit address assignment in editor tooling.

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS) | **Risk**: LOW (Addressables 3.1.0 editor APIs)

**Engine Notes**: Addressables 3.1.0 installed (Packages/manifest.json:5). Editor APIs: `UnityEditor.AddressableAssets.Settings.AddressableAssetSettingsDefaultObject.Settings.groups`. Groups window is editor-only; runtime locators expose keys/locations, not editor group topology.

**Control Manifest Rules (Foundation layer)**:
- Required: 3 groups (Shared, Cars/{teamId}, Tracks/{trackId}); 17 bundles (1 track + 16 cars) load in parallel — source: ADR-0003
- Required: Addressable GROUP NAMES are never runtime load keys — the load key is the asset's ADDRESS; editor tooling must mirror group names with explicit address assignment; editor import script asserts the mirror — source: ADR-0003
- Required: Per-car address, never a shared constant: `Cars/{teamId}/CarDefinition`; `Tracks/{trackId}/TrackData` — source: ADR-0003
- Forbidden: Never use a monolithic single Addressables group — source: ADR-0003

---

## Acceptance Criteria

*From GDD `design/gdd/content-pipeline.md`, scoped to this story (editor-integration verified via editor test against real Addressables settings):*

- [ ] **AC-CG1**: Given the game builds for any platform, When the Addressable catalog is inspected, Then exactly 3 top-level group categories exist: Shared, Cars/{TeamId}, and Tracks/{TrackId}.
- [ ] **AC-CG2**: Given a race with 16 teams and 1 track, When the Addressable groups are listed, Then 18 groups exist: 1 Shared + 16 Cars + 1 Track.
- [ ] **AC-CG3**: Given the Shared group, When its contents are inspected, Then it contains only: core UI, HUD prefabs, common audio clips, shared shaders, and loading screen assets.
- [ ] **AC-CG4**: Given the `Cars/team_tier4_d` group, When its contents are inspected, Then it contains only `team_tier4_d`'s car prefab, materials, textures, and engine audio — no assets from other teams.
- [ ] **AC-CG5**: Given the Tracks/Track_A group, When its contents are inspected, Then it contains only Track_A's mesh, environment, lighting, and track audio — no car assets.
- [ ] **AC-CG6**: Given any car bundle, When inspected, Then the bundle is self-contained with no cross-references to other car bundles. *(Clarified: declared dependencies on Shared assets are allowed; dependencies on another car bundle are forbidden.)*
- [ ] **Address mirror (ADR-0003:129-147)**: Every car root asset carries the address `Cars/{teamId}/CarDefinition`; every track root carries `Tracks/{trackId}/TrackData`; group names are never used as runtime load keys.

---

## Implementation Notes

*Derived from ADR-0003 Implementation Guidelines:*

- **Topology manifest** (gate NEW-04): `Assets/Settings/Content/topology.json` — canonical manifest with fields:
  ```json
  {
    "groups": [
      { "name": "Shared", "category": "Shared", "rootAddress": null, "expectedEntries": ["..."] },
      { "name": "Cars/team_tier4_d", "category": "Cars", "rootAddress": "Cars/team_tier4_d/CarDefinition", "expectedEntries": ["..."] },
      { "name": "Tracks/Track_A", "category": "Tracks", "rootAddress": "Tracks/Track_A/TrackData", "expectedEntries": ["..."] }
    ],
    "expectedGroupCount": 18,
    "allowedSharedDependencies": true,
    "forbiddenCrossCarDependencies": true
  }
  ```
  The editor TEST asserts against ACTUAL `AddressableAssetSettingsDefaultObject.Settings.groups` — the manifest is tested against real settings, not against itself.
- **Editor tooling**: `Overdrive.Content.Editor` assembly (refs `UnityEditor.AddressableAssets` + Content) — tooling that assigns addresses mirroring group names (ADR-0003:130-137). Editor import script asserts the mirror.
- **`AddressableKeys` constants** (ADR-0003:138-149): `SharedGroup`, `CarGroup(teamId)` → `Cars/{teamId}`, `TrackGroup(trackId)` → `Tracks/{trackId}`, `CarPrefab`, `CarDefinition(teamId)` → `Cars/{teamId}/CarDefinition`, `TrackData(trackId)` → `Tracks/{trackId}/TrackData`, `TrackEnvironment`.
- **Negative fixtures** (gate F2): shared `CarDefinition` address (must fail — per-car only), mismatched group/address, missing `TrackData` address, cross-car dependency.

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- [Story 002]: CP_ state machine (consumes the keys)
- Runtime load orchestration → Story 003
- Actual Addressable group creation in the Unity Editor → manual editor setup per ADR-0003 Migration Plan (groups window)

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate). The developer implements against these — do not invent new test cases during implementation.*

- **AC-CG1**: Given built game; When catalog inspected; Then exactly 3 group categories (Shared, Cars/, Tracks/) exist. Edge: no extra top-level categories.
- **AC-CG2**: Given 16 teams + 1 track race; When groups listed; Then 18 groups (1 Shared + 16 Cars + 1 Track). Edge: 17 or 19 fails.
- **AC-CG3**: Given Shared group; When contents inspected; Then only core UI/HUD/audio/shaders/loading assets. Edge: any car/track asset in Shared fails.
- **AC-CG4**: Given Cars/team_tier4_d group; When contents inspected; Then only team_tier4_d assets. Edge: cross-team asset fails.
- **AC-CG5**: Given Tracks/Track_A group; When contents inspected; Then only Track_A assets. Edge: car asset in track group fails.
- **AC-CG6**: Given any car bundle; When dependency graph inspected; Then no cross-car references; Shared deps allowed. Edge: car→car dep fails.
- **Address mirror**: Given manifest topology; When real Addressables settings enumerated; Then each group's root address matches `Cars/{teamId}/CarDefinition` / `Tracks/{trackId}/TrackData`; group names not used as runtime keys. Edges: shared CarDefinition, mismatched group/address, missing TrackData, cross-car dep — all fail.

---

## Test Evidence

**Story Type**: Config/Data + Editor Integration
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Editor test: `Assets/tests/editor/content/ContentTopologyTests.cs` — enumerates real AddressableAssetSettings, asserts manifest topology (must exist and pass)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None (first Content story)
- Unlocks: Stories 002-007 (all consume the AddressableKeys + topology)
