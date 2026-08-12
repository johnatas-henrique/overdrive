# Story 004: Race Unload

> **Epic**: Content Pipeline
> **Status**: Ready
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

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS) | **Risk**: LOW

**Engine Notes**: `Addressables.ReleaseInstance()` + `Addressables.Release()` confirmed in 3.1.0 (ADR-0003:19).

**Control Manifest Rules (Foundation layer)**:
- Required: Unload all race-specific assets on race end; release every instance and handle — source: ADR-0003
- Forbidden: Never use `Destroy()` directly on Addressable instances — always `ReleaseInstance` — source: ADR-0003

---

## Acceptance Criteria

*From GDD `design/gdd/content-pipeline.md`, scoped to this story:*

- [ ] **AC-UL1**: Given Simulation remains Results after Continue/Back and sends ContentUnloadRequest, When UnloadRace() executes, Then all instances are destroyed via ReleaseInstance and handles via Release before ContentUnloadComplete.
- [ ] **AC-UL2**: Given unloading completes, When memory is measured, Then only Shared group assets remain.
- [ ] **AC-UL3**: Given LoadRace() is called for a new race, When the method begins, Then UnloadRace() is called first.
- [ ] **AC-UL4**: Given two consecutive races use the same track, When the second loads, Then the track is fully unloaded and reloaded.
- [ ] **AC-UL5**: Given Content Pipeline is in Unloading, When player returns to menu, Then unloading completes with no leak.
- [ ] **AC-UL6**: Given unloading completes, When measured, Then no car or track residuals remain.
- [ ] **Partial-handle cleanup** (gate F9): Given a load error (memory >95% abort, track failure), When cleanup runs, Then all partially-loaded handles are released before ContentUnloadComplete or error propagation — no leaks from the aborted load.

---

## Implementation Notes

*Derived from ADR-0003 Implementation Guidelines:*

- **Unload order** (ADR-0003:100-105, :266): instances first via `ReleaseInstance`, then base handles via `Release`. Never `Destroy()` directly on Addressable instances.
- **UnloadRace() called first** (GDD:104): at the start of every `LoadRace()` — guarantees previous race fully unloaded before loading new one.
- **Same-track reload** (AC-UL4, GDD:102): even if the next race uses the same track, full unload + reload (NOT retained).
- **Completion signal** (ADR-0003:50, :266): `ContentUnloadComplete` emitted when ALL handles released + instances destroyed; only after that may Simulation enter Idle (LO8, Story 002).
- **Partial-handle cleanup** (gate F9): on abortive ContentLoadError (memory, track, shared), release every partially-loaded handle before propagating the error or emitting ContentUnloadComplete — no residual handles from an aborted load.
- **`IRaceContentRuntime` invalidation**: `IsValid` → false after ContentUnloadComplete; consumers must not retain past invalidation (architecture.yaml content_race_runtime_handoff).

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- [Story 002]: Unloading state transition + completion signal wiring
- [Story 003]: Load orchestration (calls UnloadRace first via LoadRace)
- [Story 005]: Error classification (this story handles the cleanup mechanics on error)

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate). The developer implements against these — do not invent new test cases during implementation.*

- **AC-UL1**: Given Results + ContentUnloadRequest; When UnloadRace executes; Then ReleaseInstance for all instances, then Release for all handles, before ContentUnloadComplete. Edge: order violated fails.
- **AC-UL2**: Given unloading completes; When memory measured; Then only Shared assets remain. Edge: any car/track residual fails.
- **AC-UL3**: Given LoadRace for new race; When method begins; Then UnloadRace called first. Edge: second race without unload fails.
- **AC-UL4**: Given two consecutive races same track; When second loads; Then track fully unloaded and reloaded. Edge: retained track fails.
- **AC-UL5**: Given Unloading; When player returns to menu; Then completes with no leak.
- **AC-UL6**: Given unloading completes; When measured; Then no car/track residuals.
- **Partial cleanup**: Given aborted load (memory/track); When cleanup runs; Then all partial handles released before error propagation. Edge: 5 of 17 loaded then abort — 5 released.

---

## Test Evidence

**Story Type**: Logic
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/content/RaceUnloadTests.cs` — unload order, partial cleanup via fake handles — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002 (CP_ state machine — Unloading transition) — DONE; Story 003 (LoadRace calls UnloadRace) — DONE
- Unlocks: Story 005 (error cleanup integration)
