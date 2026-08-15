# Story 004: Race Unload

> **Epic**: Content Pipeline
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: M (3-4h)

## Context

**GDD**: `design/gdd/content-pipeline.md`
**Requirement**: `TR-content-006`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0003: Content Pipeline and Addressables
**ADR Decision Summary**: UnloadRace() destroys instances first (`Addressables.ReleaseInstance`), then releases base handles (`Addressables.Release`). Called at the start of every LoadRace() to guarantee the previous race is fully unloaded. `ContentUnloadComplete` emitted when all handles released; Simulation may enter Idle only after that signal. Never use `Destroy()` directly on Addressable instances — always `ReleaseInstance`.

**Engine**: Unity 6000.3.22f1 (Unity 6.3 LTS) | **Risk**: LOW

**Engine Notes**: `Addressables.ReleaseInstance()` + `Addressables.Release()` confirmed in 3.1.0 (ADR-0003:19). No new engine API beyond what Story 003 already wraps via `Overdrive.Content.Unity`.

**Control Manifest Rules (Foundation layer)**:
- Required: Unload all race-specific assets on race end; release every instance and handle — source: ADR-0003
- Forbidden: Never use `Destroy()` directly on Addressable instances — always `ReleaseInstance` — source: ADR-0003

---

## Acceptance Criteria

*From GDD `design/gdd/content-pipeline.md`, scoped to this story:*

- [ ] **AC-UL1**: Given Simulation remains Results after Continue/Back and sends ContentUnloadRequest, When `OnContentUnloadRequested` transitions the SM to CP_Unloading and the cleanup seam's `BeginCleanup(cleanupId)` executes, Then instances are destroyed FIRST via `ReleaseInstance`, then base handles released via `Release` (ADR-0003:100-105 order), and `ContentUnloadComplete` is emitted only after `ReportCleanupComplete(cleanupId)` echoes the SM-generated id. **This story is authorized to correct the ordering in `UnityContentRuntime.ReleaseAll()` (Story 003 file) — the shipped order is handles-then-instance.**
- [ ] **AC-UL2**: Given unloading completes (`ContentUnloadComplete` emitted), When the runtime is inspected, Then every retained handle was released (Release called once on each) and the track instance was destroyed (`TrackInstance == null`) — no car or track residual holds in the runtime. (Engine-free observable: fakes record per-handle/per-instance release; Shared group assets are outside the runtime's retained set by construction.)
- [ ] **AC-UL5**: Given the SM is in CP_Unloading (player returns to menu — `OnContentUnloadRequested`), When the cleanup seam runs to completion, Then `ContentUnloadComplete` fires and the Content SM returns to CP_Idle — no leak: every instance and handle released exactly once. (Kernel Idle transition is NOT asserted here — the SM does not write Simulation state; that wiring is Story 002/race-session territory.)
- [ ] **AC-UL6**: Given unloading completes, When the runtime is inspected, Then the retained-handle set is empty and `TrackInstance == null` — no car or track residuals remain.
- [ ] **Partial-handle cleanup** (gate F9): Given an abortive load error (memory >95% abort, track failure), When the SM enters CP_Unloading via `ReportLoadError` and the cleanup seam runs, Then the retained handles from the partially-completed load are released before `ContentLoadError` propagates (cleanup-before-error, AC-SM4) — no leak from the aborted load. In-flight handles are released by Story 003's `Abort()`; this story releases retained + instance.
- [ ] **Edge — idempotency**: Given `ContentUnloadComplete` already emitted (cleanup ran), When `BeginCleanup` fires again or `ReportCleanupComplete` repeats, Then no double-release (Release called exactly once per handle/instance) and no error.
- [ ] **Edge — stale cleanup id**: Given a cleanup id from a superseded session, When `ReportCleanupComplete` echoes it, Then the SM ignores it (session fencing — SM-owned monotonic id).
- [ ] **Edge — empty retained set**: Given no race content held (Idle after prior unload), When cleanup runs, Then it completes cleanly with no releases and `ContentUnloadComplete` still fires (or SM Idle no-op per Story 002).

---

## Completion Notes

**Completed**: 2026-08-15
**Criteria**: 8/8 passing (0 deferred)
**Deviations**: None blocking — 3 authorized ADR-consistent decisions (ReleaseAll order correction in Story 003 file, composition root seam wiring, next-race inline order alignment), documented in Implementation Contract
**Test Evidence**: Logic + Integration — 9 unit (`RaceUnloadTests.cs`, ContentUnitTests) + 7 integration (`RaceUnloadIntegrationTests.cs`, ContentIntegrationTests) = 16 tests; 911/911 PlayMode + 43/43 EditMode green
**Code Review**: Complete (unity-specialist APPROVED R1; qa-tester TESTABLE R2 — 5 R1 findings, 3 tests added, 2 verified already covered by SM 3-9)
**Gates**: LP-CODE-REVIEW APPROVED · QL-TEST-COVERAGE ADEQUATE
**Cross-story**: Story 003 files modified (ReleaseAll order, composition root ctor wiring, orchestrator next-race order); 3-10 integration tests updated (harness — real seam completes cleanup automatically)

## Implementation Notes — Race Unload

- **Unload order** (ADR-0003:100-105, :266): instances first via `ReleaseInstance`, then base handles via `Release`. Never `Destroy()` directly on Addressable instances.
- **Release-before-load** (GDD:104): a new race never starts while the previous race's content is still held. Delivered by Story 003's `RequestTrackLoad` inline release on next-race supersede (see Implementation Contract — no `ContentUnloadComplete` on that path).
- **Same-track reload** (GDD:102): even if the next race uses the same track, full unload + reload (NOT retained) — delivered by Story 003's next-race inline release (cross-epic, no ContentUnloadComplete).
- **Completion signal** (ADR-0003:50, :266): `ContentUnloadComplete` emitted when ALL handles released + instances destroyed; only after that may Simulation enter Idle (LO8, Story 002).
- **Partial-handle cleanup** (gate F9): on abortive ContentLoadError (memory, track, shared), release every partially-loaded handle before propagating the error or emitting ContentUnloadComplete — no residual handles from an aborted load.
- **Performance disposition**: release/cleanup runs at transition frequency (race end, menu return, abort) — never per-frame. The `ReleaseAll` path iterates the 17-entry retained set once; no allocation or hot-path impact expected.

---

## Implementation Contract (aligns with shipped Story 002/003 seams)

This story implements the **`IContentCleanupSeam`** port (shipped in Story 002, `ContentSeams.cs`) — it does NOT create a free-standing `UnloadRace()` method. The shipped seams this story consumes:

- `IContentCleanupSeam.BeginCleanup(int cleanupId)` — the SM calls this when entering CP_Unloading (both the unload path `OnContentUnloadRequested` and the error path `ReportLoadError`). The implementation performs the real release and MUST echo the SM-generated `cleanupId` back via `ReportCleanupComplete` (session fencing — Story 002 R5 contract: the SM owns the id, the seam only echoes).
- `UnityContentRuntime.ReleaseAll()` (shipped Story 003) — releases every retained handle + destroys the track instance; idempotent. **THIS STORY AUTHORIZED to correct the ordering to ADR-0003:100-105 (instances via `ReleaseInstance` FIRST, then base handles via `Release`).** The correction lives in `UnityContentRuntime.ReleaseAll()` (Story 003 file); an operation-log fake verifies instance-before-handle order (AC-UL1).
- `ContentStateMachine.OnContentUnloadRequested()` → `EnterUnloading()` → `BeginCleanup` → ... → `ReportCleanupComplete(cleanupId)` → `ContentUnloadComplete` (unload path) or `ContentLoadError` (error path, cleanup-before-error AC-SM4).
- **Cleanup seam wiring (this story)**: the production `IContentCleanupSeam` implementation is engine-free (Overdrive.Content) and receives a dedicated release port via constructor — **`IContentReleaser.ReleaseAll()`** (this story adds the port to `ContentSeams.cs`; NOT `IRaceContentAccumulator` — that interface expresses load mutation and does not expose instance release). `ContentCompositionRoot.cs` (Story 003 file) constructs the engine-free seam and late-binds the port to `UnityContentRuntime.ReleaseAll()` via a closure, mirroring the existing `DelegateForwarder` pattern. Flow: `BeginCleanup(cleanupId)` → `_releaser.ReleaseAll()` → `ReportCleanupComplete(cleanupId)` → SM emits `ContentUnloadComplete` + returns to CP_Idle.
- **Integration evidence (composition root real)**: `RaceUnloadIntegrationTests.cs` constructs the REAL composition root, issues `OnContentUnloadRequested`, and asserts: real `ReleaseAll()` release ORDER (instance before handle — operation-log on the real runtime's instantiator+loader), completion-ID echo, `ContentUnloadComplete` fired, SM state == CP_Idle. The existing integration tests use `FakeCleanupSeam` + manual `ReportCleanupComplete` and would NOT catch missing production wiring — this test closes that gap.
- In-flight handles on abort are released by the orchestrator (Story 003 `Abort()`); retained handles + track instance are released by this story's cleanup seam via the release port.
- Next-race supersede (Racing → LoadingTrack) has NO cleanup path and NO `ContentUnloadComplete` — Story 003's `RequestTrackLoad` releases inline (ADR-0003:159 interpretation). **AC-UL3/UL4 (next-race/same-track release) are CROSS-EPIC — already covered by Story 003's `NextRace_ReleasesPriorSessionRetainedHandlesAndTrack` (RaceLoadTests.cs) + `ReleaseAll_DestroysTrackInstanceAndReleasesHandles` (integration); this story only adds an idempotency regression if the ReleaseAll reorder touches that path.**
- **`IRaceContentRuntime` invalidation**: `IsValid` → false at the EARLIER of `ContentUnloadComplete` (this story's path) or a next-race transition into CP_LoadingTrack (Story 002's path — the next LoadRace supersedes the old runtime; no ContentUnloadComplete on that path); consumers must not retain past invalidation (architecture.yaml content_race_runtime_handoff).

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- [Story 002]: Unloading state transition + completion signal wiring
- [Story 003]: Load orchestration (releases prior race inline on next-race supersede)
- [Story 005]: Error classification (this story handles the cleanup mechanics on error)

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate). The developer implements against these — do not invent new test cases during implementation.*

- **AC-UL1**: Given Results + ContentUnloadRequest; When SM enters Unloading + BeginCleanup; Then ReleaseInstance for the track instance FIRST, then Release for each retained handle (order per ADR-0003 — ReleaseAll corrected in Story 003 file), before ReportCleanupComplete → ContentUnloadComplete. Edge: reversed order (handles before instance) fails.
- **AC-UL2**: Given unloading completes; When runtime inspected; Then every retained handle released exactly once + track instance destroyed (fakes record). Edge: any unreleased handle/instance fails.
- **AC-UL5**: Given CP_Unloading (menu return); When cleanup completes; Then ContentUnloadComplete fires + SM returns to Idle. Edge: leak (handle/instance not released) fails.
- **AC-UL6**: Given unloading completes; When runtime inspected; Then retained set empty + track instance null.
- **Partial cleanup**: Given aborted load (memory/track); When SM enters Unloading via ReportLoadError + cleanup seam runs; Then retained handles released before ContentLoadError (cleanup-before-error). Edge: 5 of 17 loaded then abort — in-flight 5 released by Abort(), retained + instance by seam; nothing leaks.
- **Idempotency**: Given ContentUnloadComplete emitted; When BeginCleanup fires again / ReportCleanupComplete repeats; Then Release called exactly once per handle/instance (no double-release).
- **Stale cleanup id**: Given superseded session's cleanup id; When echoed; Then SM ignores it (fencing).
- **Empty retained set**: Given Idle (no content held); When cleanup runs; Then completes cleanly with no releases (SM Idle no-op or ContentUnloadComplete per Story 002).

---

## Test Evidence

**Story Type**: Logic
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/content/RaceUnloadTests.cs` — cleanup seam ordering (ReleaseInstance before Release via operation-log fake), partial cleanup, idempotency (Release exactly once per handle/instance), stale cleanup id, empty retained set, retained-set-empty + TrackInstance-null postconditions (AC-UL2/UL6) — engine-free via fakes
- Integration: `Assets/tests/integration/content/RaceUnloadIntegrationTests.cs` — REAL composition root + unload request: real `ReleaseAll()` release order (instance before handle), completion-ID echo, `ContentUnloadComplete` fired, SM state == CP_Idle, retained-set-empty + TrackInstance-null after completion (AC-UL2/UL6). (Closes the FakeCleanupSeam gap — existing integration tests would not catch missing production wiring.)

**Status**: [x] Created and passing — `Assets/tests/unit/content/RaceUnloadTests.cs` (9 tests, `ContentUnitTests` assembly) + `Assets/tests/integration/content/RaceUnloadIntegrationTests.cs` (7 tests, `ContentIntegrationTests` assembly) — 911/911 PlayMode + 43/43 EditMode green (2026-08-15)

---

## Dependencies

- Depends on: Story 002 (CP_ state machine — Unloading transition) — DONE; Story 003 (LoadRace calls UnloadRace) — DONE
- Unlocks: Story 005 (error cleanup integration)
