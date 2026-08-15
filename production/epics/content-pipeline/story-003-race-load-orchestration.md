# Story 003: Race Load Orchestration

> **Epic**: Content Pipeline
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: L (6-8h)

## Context

**GDD**: `design/gdd/content-pipeline.md`
**Requirement**: `TR-content-002`, `TR-content-004`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0003: Content Pipeline and Addressables
**ADR Decision Summary**: LoadRace(trackId, teamIds, grid) initiates 17 async handles in parallel (1 track + 16 cars), tracks completion collectively, derives progress from `GetDownloadStatus()` (DownloadedBytes/TotalBytes), instantiates the track + loads prefab assets before emitting RaceLoadReady, and handles per-car failure via `CarLoadDegraded` (non-fatal — race continues with 15 cars + placeholder).

**Engine**: Unity 6000.3.22f1 (Unity 6.3 LTS) | **Risk**: MEDIUM (Addressables 3.1.0 async API post-cutoff — LoadAssetAsync/ReleaseInstance/Release confirmed)

**Engine Notes**: `Addressables.LoadAssetAsync<T>()`, `ReleaseInstance()`, `Release()` confirmed in 3.1.0 (ADR-0003:19). Progress via `AsyncOperationHandle.GetDownloadStatus()` (ADR-0003:226).

**Performance disposition**: Load orchestration runs on discrete events (race select, load completion, memory-pressure sampling) — never per-frame; the 17 concurrent Addressable handles are async (no main-thread blocking); progress polling is throttled to discrete samples (25/50/75%) not a per-frame loop. Zero gameplay-loop impact; orchestration latency budget measured at the assembly gate (TD-026).

**Control Manifest Rules (Foundation layer)**:
- Required: Per-car address, never a shared constant: `Cars/{teamId}/CarDefinition`; `Tracks/{trackId}/TrackData` — source: ADR-0003
- Required: Loading progress from byte counts via `AsyncOperationHandle.GetDownloadStatus()` (DownloadedBytes / TotalBytes) — source: ADR-0003
- Required: `RaceLoadReady(RaceMode, GridAssignment)` emitted only when ALL required slots are completed — loaded OR degraded-placeholder per slot (GDD:144; degraded car counts as completed; source ADR-0003 as interpreted by Story 002/architecture.yaml:224)
- Required: `ContentErrorType` = {Track, Shared, Catalog}; Car is never abortive — car failure emits `CarLoadDegraded(reason, teamId)` — source: ADR-0003
- Guardrail: Memory pressure > 95% during loading: abort, release partial handles, emit `ContentLoadError("Memory pressure", ContentErrorType.Track)` — source: ADR-0003

---

## Acceptance Criteria

*From GDD `design/gdd/content-pipeline.md`, scoped to this story:*

- [ ] **AC-LO1**: Given the player selects a race, When loading begins, Then the track bundle and all 16 car bundles start loading asynchronously in parallel.
- [ ] **AC-LO2**: Given loading is in progress, When progress is sampled at 25%, 50%, and 75%, Then progress increases monotonically and is derived from bytes_loaded / total_bytes.
- [ ] **AC-LO3** (re-scoped): Given all bundles are loaded, When loading completes, Then Content instantiates/provides the track instance and car prefab references (via `IRaceContentRuntime`), and emits the race-load payload with the locked GridAssignment; car GameObject spawning on grid positions is Vehicle Physics/Grid & Start responsibility (not Content).
- [ ] **AC-EC2** (re-scoped — placeholder instantiation is downstream): Given car bundle fails to load, When detected, Then the SM is notified via `ReportCarDegraded(session, teamId)` — the degraded slot is a COMPLETED slot in the SM snapshot (GDD:144); NO `ContentLoadError` is emitted for a car; the runtime's CarReferences exposes the loaded refs with the degraded slot ABSENT. *(The placeholder GameObject filling the grid position and visible race continuation are Vehicle Physics/Grid & Start — out of this story's seams.)*
- [ ] **AC-EC4**: Given memory exceeds 95% during load, When detected, Then the load is aborted and `ReportLoadError("Memory pressure", ContentErrorType.Track)` is called on the SM *(the SM's cleanup-before-error + final `ContentLoadError` emission to the Kernel follows Story 002 AC-SM4 / Story 005 — out of this story's seams; this story asserts the abort + report)*.
- [ ] **AC-EC8** (re-scoped — red-box instantiation is downstream): Given the car prefab asset is missing from the loaded bundle, When detected, Then the SM is notified via `ReportCarDegraded(session, teamId)` (same non-fatal path as AC-EC2 — the degraded slot is completed, race readiness still reaches 100% with 15 loaded + 1 degraded). *(The red-box placeholder GameObject is instantiated by Vehicle Physics/Grid & Start when it finds the slot absent — out of this story's seams.)*
- [ ] **AC-LP1**: Given total assets 600 MB, When 150 MB loaded, Then progress = 0.25 (±1%).
- [ ] **AC-LP2**: Given all bundles loaded, When final progress calculated, Then progress = 1.0.
- [ ] **AC-LP3**: Given 1 of 16 car bundles fails, When remaining 15 + track loaded, Then progress reaches 100%.
- [ ] **AC-MB3**: Given memory pressure below 0.85, When loading proceeds, Then no warning is emitted (no `DiagnosticsSink.LogWarning` call) and no quality-reduction request is made.
- [ ] **AC-MB4**: Given memory pressure in [0.85, 0.95], When detected, Then a warning is emitted (via the injectable `IDiagnosticsSink`) AND a quality-reduction request is made (via the injectable `IQualityReductionRequest`).
- [ ] **AC-MB5**: Given memory pressure strictly above 0.95, When detected, Then the load is aborted and `ReportLoadError("Memory pressure", ContentErrorType.Track)` is called on the SM *(the SM's cleanup + final `ContentLoadError` emission to the Kernel follows Story 002 AC-SM4 / Story 005 — same scoping as AC-EC4)*. Exact boundary: 0.95 is warning territory (AC-MB4), NOT abort.

---

## Implementation Notes

*Derived from ADR-0003 Implementation Guidelines:*

- **Seam: `RaceContentSelection`** (gate F5 — the struct is DEFINED by Story 002, the first implemented story; consumed here) — the Kernel's `ContentLoadRequest` carries only `RaceMode` + `GridAssignment` (SimulationStateMachine.cs:6-24); track/car identity is NOT in the request. Content needs it via:
  ```csharp
  public readonly struct RaceContentSelection {
      public readonly string TrackId;
      public readonly IReadOnlyList<string> TeamIds;   // canonical car identifier = team id (address: Cars/{teamId}/CarDefinition)
      public static string Identity(RaceContentSelection s) => $"{s.TrackId}|{string.Join(",", s.TeamIds.OrderBy(t => t))}";
  }
  ```
  Registration: UI race-selection coordinator supplies it via composition root before LoadRace. Immutable snapshot. Stale-selection rejection (a selection different from the current request's is rejected). Reconfigure rule (Story 002): same identity → RaceReconfigure (zero I/O); changed → NEXT-RACE load (Racing → CP_LoadingTrack directly — the previous runtime is superseded, NO ContentUnloadComplete is emitted; the unload is internal to the next LoadRace, Story 002 NextRace contract).
- **Seam: `IRaceContentRuntime`** (gate NEW-01, registered in architecture.yaml as `content_race_runtime_handoff`):
  ```csharp
  public interface IRaceContentRuntime {
      object TrackInstance { get; }               // loaded+instantiated by Content
      IReadOnlyList<object> CarReferences { get; } // loaded prefab assets, NOT instantiated — VP spawns
      GridAssignment Grid { get; }
      bool IsValid { get; }  // valid from RaceLoadReady until the EARLIER of ContentUnloadComplete (unload path) or a next-race transition into CP_LoadingTrack (story-002 dual-path contract); invalidated after either
  }
  ```
  Ownership: Content instantiates TRACK; loads PREFAB assets; Vehicle Physics/Grid & Start INSTANTIATES car GameObjects. Readiness ordering: populated BEFORE RaceLoadReady. Supersedes the ambiguous reading of ADR-0003:159.
- **Composition root responsibilities (Story 002 handoffs)**: this story's composition root ALSO wires the three Story-002-declared handoffs — (a) `IReadinessForwarder` implementation: `Forward(RaceMode, GridAssignment)` → `SimulationStateMachine.OnRaceLoadReady(mode, grid)` (void invocation with exact payload — no acknowledge; the SM already guards readiness); (b) `IRaceContentRuntime.IsValid` projection: the concrete runtime's `IsValid` reads the SM `HandoffValid` flag (valid from RaceLoadReady until the EARLIER of ContentUnloadComplete or next-race transition — Story 002 dual-path contract); (c) `IContentSelectionSource` implementation: supplies the current `RaceContentSelection` (TrackId + TeamIds) from the RaceSessionManager/UI race selection.
- **Session fencing (Story 002 gate — the implementation MUST honor it)**: this story implements the `IContentLoadSeam` inbound callbacks `ReportTrackLoaded` / `ReportCarLoaded` / `ReportCarDegraded` / `ReportLoadError` — ALL carry `int sessionGeneration`. The implementation reads `ContentStateMachine.SessionGeneration` ONCE when it receives `RequestTrackLoad`/`RequestCarLoads` and returns that token in every `Report*`; the SM accepts ONLY the current token (a stale report from a previous session — e.g. a late Addressables callback after a next-race superseded the session — is fenced out). The `ReportCarDegraded(teamId)` invocation replaces the legacy `CarLoadDegraded` signal (same non-fatal semantics, GDD:144).
- **Injectable Addressables seams** (gate F7 + R2 contracts): `IAddressableLoader` — `IAsyncLoadHandle LoadAssetAsync<T>(object key, Action<IAsyncLoadHandle> onComplete)`; `IAsyncLoadHandle` — `bool IsDone { get; }`, `object Result { get; }`, `Exception OperationException { get; }`, `void Release()`; `IDownloadStatusSource` — `(long DownloadedBytes, long TotalBytes) GetDownloadStatus()` (per handle); `IContentInstantiator` — `object Instantiate(object prefab)`, `void ReleaseInstance(object instance)` *(track instantiates at the origin — the track is the world-frame reference; positioning the camera/cars relative to it is Vehicle Physics/Grid &amp; Start responsibility, so position/rotation are NOT seam inputs — gate R3 contract alignment)*; `IMemoryPressureSource` — `float Pressure { get; }` (used/available ratio); `IQualityReductionRequest` — `void RequestQualityReduction(string reason)` (application is Settings-owned — out of scope); `IDiagnosticsSink` — `void LogWarning(string message)`, `void LogError(string message)` (production impl wires `Debug.Log`; injectable so AC-MB3/4 warnings are observable in unit tests). **Progress output seam (gate R2)**: the orchestrator exposes `IRaceLoadProgress` — `float Progress { get; }` (aggregated bytes_loaded/total_bytes, monotonic, clamped 0..1) + `event Action<float> ProgressChanged` (raised on each sampled change) — the observable contract AC-LO2/LP1/LP3 assert against. **Clock seam (gate R4)**: `IClock` — `float Time { get; }` (injectable; production impl wraps `Time.realtimeSinceStartup`; unit tests inject a fake to drive the 1s progress/memory sampling tick deterministically).
- **Parallel load** (ADR-0003:48-55): LoadRace initiates 17 handles in parallel, tracks completion collectively. RaceLoadReady only when ALL required slots completed (loaded or degraded placeholder). **Out-of-order completions (gate R2)**: the SM buffers car completions that arrive before the track report (17-parallel — a car may finish first); readiness fires when the LAST required slot completes, regardless of order (track-first COMPLETION still drives LoadingTrack → LoadingCars, but car completions are accepted in both states).
- **Progress** (GDD:169-177): `progress = bytes_loaded / total_bytes`, monotonic, clamped 0..1. Cached-load status: `total_bytes == 0` → progress stays 0 while any handle is pending (undefined ratio — do not divide by zero; gate R1); final progress is FORCED to 1.0 once ALL required slots terminate (loaded or degraded — AC-LP2/LP3: a degraded car does not block 100%). During loading with a failed car, progress is byte-derived from the remaining handles; the 1.0 final only at full termination. **ProgressChanged semantics (gate R3)**: emitted on EVERY observed progress change (intermediate samples allowed and expected); the 25/50/75% points in AC-LO2 are the TEST verification points, not a restriction on sampling cadence.
- **Memory policy** (GDD:181-189): threshold = used/available. `<0.85` normal (AC-MB3: no warning, no quality request); `[0.85, 0.95]` warning + quality-reduction request via `IQualityReductionRequest` (AC-MB4 — exact 0.85 and 0.95 are warning territory); `>0.95` abort + cleanup + `ContentLoadError("Memory pressure", ContentErrorType.Track)` (AC-MB5 — exact 0.95 does NOT abort). Tested with fake memory provider + quality seam (gate F12). **Sampling cadence (gate R3)**: the orchestrator samples `IMemoryPressureSource.Pressure` deterministically — once per slot completion AND at each progress sampling tick (fixed 1s interval while any handle is pending) — making "when detected" testable. **Quality-reduction target (gate R3)**: the request carries only the reason string; the target tier and its application are Settings-owned (out of scope — the impl asserts the request was made, not the tier applied).
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
- **Buffered completions (gate R2)**: Given 17-parallel; When a car completes before the track; Then the completion is buffered (not lost), and readiness fires when the LAST required slot completes (all cars before track → fires at ReportTrackLoaded; partial → fires at the final car report).
- **AC-LO3**: Given all loaded; When completes; Then TrackInstance + CarReferences + Grid populated BEFORE RaceLoadReady; car spawning NOT by Content. Edge: readiness ordering violated fails.
- **AC-EC2**: Given car bundle fails; When detected; Then `ReportCarDegraded(session, teamId)` emitted, degraded slot is a completed slot (SM snapshot), NO `ContentLoadError`; runtime CarReferences has the slot absent. *(Placeholder GameObject instantiation: VP/Grid & Start — downstream.)*
- **AC-EC4**: Given memory >95%; When detected; Then load aborted + `ContentLoadError("Memory pressure", Track)`. Edge: exactly 0.95 boundary does NOT abort (warning, AC-MB4).
- **AC-EC8**: Given prefab missing from bundle; When detected; Then `ReportCarDegraded` (same non-fatal path); readiness still reaches 100% with 15 + 1 degraded. *(Red-box placeholder: VP/Grid & Start — downstream.)*
- **AC-LP1**: Given total 600MB; When 150MB loaded; Then progress = 0.25 ±1%.
- **AC-LP2**: Given all loaded; When final; Then progress = 1.0.
- **AC-LP3**: Given 1/16 car fails; When remaining 15 + track loaded; Then progress reaches 100%.
- **AC-MB3**: Given pressure <0.85; When loading; Then no warnings.
- **AC-MB4**: Given pressure 0.85-0.95; When detected; Then warning (DiagnosticsSink) + quality reduction requested (IQualityReductionRequest).
- **AC-MB5**: Given pressure >0.95; When detected; Then load aborted + `ReportLoadError("Memory pressure", Track)` called on the SM. Edge: exactly 0.95 = warning not abort. *(Final ContentLoadError emission: Story 002 AC-SM4.)*

**Edge cases**: track instantiation before car refs (order), stale selection rejection, changed selection → unload+load (not reconfigure), memory exactly at thresholds.

---

## Test Evidence

**Story Type**: Integration
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/content/RaceLoadTests.cs` — parallel orchestration, progress, memory policy via fakes
- Integration: `Assets/tests/integration/content/RaceLoadIntegrationTests.cs` — IRaceContentRuntime handoff, selection registration

**Status**: [x] Created and passing — `Assets/tests/unit/content/raceload/RaceLoadTests.cs` (38 tests, `RaceLoadUnitTests` assembly) + `Assets/tests/integration/content/RaceLoadIntegrationTests.cs` (8 tests, `ContentIntegrationTests` assembly) — 891/891 PlayMode + 43/43 EditMode green (2026-08-14)

## Completion Notes

**Completed**: 2026-08-15
**Criteria**: 12/12 passing (0 deferred)
**Deviations**: None blocking — 3 documented design decisions (1-arg IContentInstantiator, ReportCarDegraded session token, next-race track-handle release) all aligned with Story 002 / architecture.yaml:224
**Test Evidence**: Integration — 41 unit (`RaceLoadTests.cs`, RaceLoadUnitTests) + 9 integration (`RaceLoadIntegrationTests.cs`, ContentIntegrationTests) = 50 tests; 895/895 PlayMode + 43/43 EditMode green
**Code Review**: Complete (7 rounds — qa-tester TESTABLE R7, unity-specialist APPROVED ×4; 9 production bugs fixed)
**Gates**: LP-CODE-REVIEW APPROVED · QL-TEST-COVERAGE ADEQUATE (R2 — fencing echo, grid timing, sampling tick)
**Scope note**: fix SM 3-9 (17-parallel + buffering, from readiness gate R1-R2) shipped in this closure per user decision; MultiplayerIsolationTests AC4 guardrail updated (+Overdrive.Content.Unity)

## Implementation Notes — deviations & decisions (2026-08-14)

- **Assembly split** (unity-specialist APPROVED): `Overdrive.Content` stays engine-free (owns seams + orchestrator); new `Overdrive.Content.Unity` asmdef (Unity-backed, refs Content + Simulation + Unity.Addressables + Unity.ResourceManager) owns the concrete Addressables wrappers (AddressableLoader/AddressableLoadHandle, ContentInstantiator, MemoryPressureSource, ClockSource, DiagnosticsSink, DiagnosticQualityReductionRequest) + UnityContentRuntime + ContentCompositionRoot — the Settings.Core → Settings pattern.
- **Construction cycle broken**: the SM needs the load seam and the orchestrator needs the SM — resolved with `IContentLoadReporter` (the SM implements it; new engine-free interface in RaceLoadContracts) + a late-bound `LoadSeamProxy` + a `DelegateForwarder` closure (runtime late-bound) in the composition root.
- **IAsyncLoadHandle : IDownloadStatusSource** — the handle IS the per-handle status source (story seams "per handle").
- **IRaceContentAccumulator** — write-side of the runtime handoff (Reset/SetTrackInstance/AddCarReference/AddRetainedHandle/SetGrid); UnityContentRuntime implements BOTH the get-only IRaceContentRuntime and the accumulator.
- **Track handle retained, not released**: successful track/car handles are retained (AddRetainedHandle) for the race lifetime; Story 004 (cleanup) releases them via UnityContentRuntime.ReleaseAll() (handles + track instance destroy). The abort path releases only the still-in-flight car handles. The next-race reset ALSO releases prior-session retained handles + destroys the prior track instance (next-race has no cleanup path — the SM goes Racing → LoadingTrack directly).
- **Progress final 1.0 not overwritten**: SampleProgress early-returns once _completedSlots reaches TotalSlots (the forced 1.0 from CountCompletion must not be recomputed from byte ratios) — found by test (AC_LP2 was returning 0.0).
- **Session fencing per entry**: each ActiveLoad captures the SessionGeneration at start and echoes it on reports — a handle finishing after a next-race superseded its session is fenced out by the SM (and the reset drops it from the active set).
- **Multiplayer isolation guardrail**: AC4 known-assembly list += Overdrive.Content.Unity.

---

## Dependencies

- Depends on: Story 001 (AddressableKeys) — DONE; Story 002 (CP_ state machine) — DONE
- Unlocks: Stories 004-007
