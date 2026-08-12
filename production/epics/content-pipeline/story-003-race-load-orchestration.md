# Story 003: Race Load Orchestration

> **Epic**: Content Pipeline
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: L (6-8h)

## Context

**GDD**: `design/gdd/content-pipeline.md`
**Requirement**: `TR-content-002`, `TR-content-004`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0003: Content Pipeline and Addressables
**ADR Decision Summary**: LoadRace(trackId, carIds, grid) initiates 17 async handles in parallel (1 track + 16 cars), tracks completion collectively, derives progress from `GetDownloadStatus()` (DownloadedBytes/TotalBytes), instantiates the track + loads prefab assets before emitting RaceLoadReady, and handles per-car failure via `CarLoadDegraded` (non-fatal — race continues with 15 cars + placeholder).

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS) | **Risk**: MEDIUM (Addressables 3.1.0 async API post-cutoff — LoadAssetAsync/ReleaseInstance/Release confirmed)

**Engine Notes**: `Addressables.LoadAssetAsync<T>()`, `ReleaseInstance()`, `Release()` confirmed in 3.1.0 (ADR-0003:19). Progress via `AsyncOperationHandle.GetDownloadStatus()` (ADR-0003:226).

**Control Manifest Rules (Foundation layer)**:
- Required: Per-car address, never a shared constant: `Cars/{teamId}/CarDefinition`; `Tracks/{trackId}/TrackData` — source: ADR-0003
- Required: Loading progress from byte counts via `AsyncOperationHandle.GetDownloadStatus()` (DownloadedBytes / TotalBytes) — source: ADR-0003
- Required: `RaceLoadReady(RaceMode, GridAssignment)` emitted only when ALL assets are fully loaded and instantiated — source: ADR-0003
- Required: `ContentErrorType` = {Track, Shared, Catalog}; Car is never abortive — car failure emits `CarLoadDegraded(reason, teamId)` — source: ADR-0003
- Guardrail: Memory pressure > 95% during loading: abort, release partial handles, emit `ContentLoadError("Memory pressure", ContentErrorType.Track)` — source: ADR-0003

---

## Acceptance Criteria

*From GDD `design/gdd/content-pipeline.md`, scoped to this story:*

- [ ] **AC-LO1**: Given the player selects a race, When loading begins, Then the track bundle and all 16 car bundles start loading asynchronously in parallel.
- [ ] **AC-LO2**: Given loading is in progress, When progress is sampled at 25%, 50%, and 75%, Then progress increases monotonically and is derived from bytes_loaded / total_bytes.
- [ ] **AC-LO3** (re-scoped): Given all bundles are loaded, When loading completes, Then Content instantiates/provides the track instance and car prefab references (via `IRaceContentRuntime`), and emits the race-load payload with the locked GridAssignment; car GameObject spawning on grid positions is Vehicle Physics/Grid & Start responsibility (not Content).
- [ ] **AC-EC2**: Given car bundle fails to load, When detected, Then car skipped, placeholder fills position, error logged, race continues with 15 cars.
- [ ] **AC-EC4**: Given memory exceeds 95% during load, When detected, Then race load aborted, error shown.
- [ ] **AC-EC8**: Given car prefab missing from bundle, When instantiation attempted, Then red box placeholder used, error logged, race continues.
- [ ] **AC-LP1**: Given total assets 600 MB, When 150 MB loaded, Then progress = 0.25 (±1%).
- [ ] **AC-LP2**: Given all bundles loaded, When final progress calculated, Then progress = 1.0.
- [ ] **AC-LP3**: Given 1 of 16 car bundles fails, When remaining 15 + track loaded, Then progress reaches 100%.
- [ ] **AC-MB3**: Given memory pressure below 0.85, When loading proceeds, Then no warnings are shown.
- [ ] **AC-MB4**: Given memory pressure at 0.85–0.95, When detected, Then a warning is logged and quality reduction is attempted.
- [ ] **AC-MB5**: Given memory pressure exceeds 0.95, When detected, Then race load is aborted and error message is shown.

---

## Implementation Notes

*Derived from ADR-0003 Implementation Guidelines:*

- **Seam: `IRaceContentSelection`** (gate F5) — the Kernel's `ContentLoadRequest` carries only `RaceMode` + `GridAssignment` (SimulationStateMachine.cs:6-24); track/car identity is NOT in the request. Content needs it via:
  ```csharp
  public readonly struct RaceContentSelection {
      public readonly string TrackId;
      public readonly IReadOnlyList<string> CarIds;
      public static string Identity(RaceContentSelection s) => $"{s.TrackId}|{string.Join(",", s.CarIds.OrderBy(c => c))}";
  }
  ```
  Registration: UI race-selection coordinator supplies it via composition root before LoadRace. Immutable snapshot. Stale-selection rejection (a selection different from the current request's is rejected). Reconfigure rule: same identity → RaceReconfigure (zero I/O, Story 002); changed → unload then load.
- **Seam: `IRaceContentRuntime`** (gate NEW-01, registered in architecture.yaml as `content_race_runtime_handoff`):
  ```csharp
  public interface IRaceContentRuntime {
      object TrackInstance { get; }               // loaded+instantiated by Content
      IReadOnlyList<object> CarReferences { get; } // loaded prefab assets, NOT instantiated — VP spawns
      GridAssignment Grid { get; }
      bool IsValid { get; }  // from RaceLoadReady until ContentUnloadComplete; invalidated after
  }
  ```
  Ownership: Content instantiates TRACK; loads PREFAB assets; Vehicle Physics/Grid & Start INSTANTIATES car GameObjects. Readiness ordering: populated BEFORE RaceLoadReady. Supersedes the ambiguous reading of ADR-0003:159.
- **Injectable Addressables seams** (gate F7): `IAddressableLoader` (LoadAssetAsync), `IAsyncLoadHandle` (completion/status), `IDownloadStatusSource` (DownloadedBytes/TotalBytes), `IContentInstantiator` (Instantiate/ReleaseInstance), `IMemoryPressureSource` (used/available).
- **Parallel load** (ADR-0003:48-55): LoadRace initiates 17 handles in parallel, tracks completion collectively. RaceLoadReady only when ALL loaded+instantiated.
- **Progress** (GDD:169-177): `progress = bytes_loaded / total_bytes`, monotonic, clamped 0..1. Cached-load status: total bytes may be 0 — handle gracefully (gate F7). Final forced to 1.0.
- **Memory policy** (GDD:181-189): threshold = used/available. <0.85 normal; 0.85-0.95 warning + quality reduction request (via quality seam); >0.95 abort + cleanup + `ContentLoadError("Memory pressure", ContentErrorType.Track)`. Tested with fake memory provider + quality seam (gate F12).
- **Car failure** (ADR-0003:52): `CarLoadDegraded(reason, teamId)` — non-fatal; placeholder fills grid position; race continues with 15. Never emits ContentLoadError for a car.
- **Track instantiation order** (gate F6): track instance first, then car refs — proven by ordering test.

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- [Story 002]: CP_ state machine transitions (this story runs within CP_LoadingTrack/LoadingCars)
- Car GameObject spawning/placement → Vehicle Physics/Grid & Start (via IRaceContentRuntime)
- [Story 004]: Unload + partial-handle cleanup on error
- [Story 005]: Catalog init, Shared fatal, track fatal classification
- Measured memory footprints (MB1/2/6/7) → TD-026 (profiling gate)

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate). The developer implements against these — do not invent new test cases during implementation.*

- **AC-LO1**: Given race selected; When loading begins; Then all 17 ops started before any completion. Edge: no sequential wait.
- **AC-LO2**: Given loading in progress; When progress sampled at 25/50/75%; Then monotonic increase, byte-derived. Edge: monotonic clamping, cached-load zero total bytes.
- **AC-LO3**: Given all loaded; When completes; Then TrackInstance + CarReferences + Grid populated BEFORE RaceLoadReady; car spawning NOT by Content. Edge: readiness ordering violated fails.
- **AC-EC2**: Given car bundle fails; When detected; Then car skipped, placeholder fills position, race continues with 15; no ContentLoadError. Edge: 15 loaded + 1 placeholder still reaches 100%.
- **AC-EC4**: Given memory >95%; When detected; Then race load aborted, error shown. Edge: exactly 0.95 boundary.
- **AC-EC8**: Given prefab missing from bundle; When instantiation; Then red box placeholder, error logged, race continues.
- **AC-LP1**: Given total 600MB; When 150MB loaded; Then progress = 0.25 ±1%.
- **AC-LP2**: Given all loaded; When final; Then progress = 1.0.
- **AC-LP3**: Given 1/16 car fails; When remaining 15 + track loaded; Then progress reaches 100%.
- **AC-MB3**: Given pressure <0.85; When loading; Then no warnings.
- **AC-MB4**: Given pressure 0.85-0.95; When detected; Then warning logged + quality reduction requested.
- **AC-MB5**: Given pressure >0.95; When detected; Then load aborted + error shown.

**Edge cases**: track instantiation before car refs (order), stale selection rejection, changed selection → unload+load (not reconfigure), memory exactly at thresholds.

---

## Test Evidence

**Story Type**: Integration
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/content/RaceLoadTests.cs` — parallel orchestration, progress, memory policy via fakes
- Integration: `Assets/tests/integration/content/RaceLoadIntegrationTests.cs` — IRaceContentRuntime handoff, selection registration

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (AddressableKeys) — DONE; Story 002 (CP_ state machine) — DONE
- Unlocks: Stories 004-007
