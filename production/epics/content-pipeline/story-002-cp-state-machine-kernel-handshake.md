# Story 002: CP_ State Machine & Kernel Handshake

> **Epic**: Content Pipeline
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: L (5-6h)

## Context

**GDD**: `design/gdd/content-pipeline.md`
**Requirement**: `TR-content-003`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0003: Content Pipeline and Addressables; ADR-0001: Manual Simulation Authority and Determinism Boundary
**ADR Decision Summary**: CP_ state machine (Idle → LoadingTrack → LoadingCars → Ready → Racing → Unloading → Idle + transient RaceReconfigure) maps onto SimulationState. Content emits readiness/errors (`RaceLoadReady`, `ContentLoadError`, `ContentUnloadComplete`); Simulation ACCEPTS them. Content never writes `SimulationState`. RaceReconfigure: no Addressables I/O — cache hit only.

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS) | **Risk**: HIGH (Kernel handshake — direction must be exact)

**Engine Notes**: Simulation Kernel (stories 1-8, DONE) already emits `ContentLoadRequested` (SimulationStateMachine.cs:217) and `ContentUnloadRequested` (:371-380), and consumes Content readiness/errors via `OnRaceLoadReady` (:225-245) and `OnContentLoadError` (:251-259). **Content EMITS readiness; Simulation ACCEPTS it — the reverse would be a defect.**

**Control Manifest Rules (Foundation layer)**:
- Required: CP_ state machine: CP_Idle → CP_LoadingTrack → CP_LoadingCars → CP_Ready → CP_Racing → CP_Unloading → CP_Idle (7-state base lifecycle) + transient `CP_RaceReconfigure` — source: ADR-0003
- Required: RaceReconfigure performs NO Addressables load/unload (cache hit only); `RaceReconfigureStart` is a one-way event — source: ADR-0003
- Required: `RaceLoadReady(RaceMode, GridAssignment)` emitted only when ALL assets are fully loaded and instantiated — source: ADR-0003

---

## Acceptance Criteria

*From GDD `design/gdd/content-pipeline.md`, scoped to this story:*

- [ ] **AC-SM1**: Given app initializes, When Content Pipeline starts, Then initial state is Idle with only Shared loaded.
- [ ] **AC-SM2**: Given Idle state, When no race selected, Then no car or track bundles loaded.
- [ ] **AC-SM3**: Given Simulation remains Results and sends `ContentUnloadRequest`, When Content receives it, Then state transitions to Unloading while Simulation stays Results.
- [ ] **AC-SM4**: Given Loading Track or Loading Cars state, When Content emits `ContentLoadError`, Then pending handles are released, state reaches Unloading, and then transitions to Idle after cleanup; player Cancel/Back does not cancel the load.
- [ ] **AC-SM5**: Given Ready state, When no countdown trigger, Then state remains Ready.
- [ ] **AC-LO4**: Given Content Pipeline is in Idle, When player selects race, Then state transitions to Loading Track.
- [ ] **AC-LO5**: Given Content Pipeline is in Loading Cars, When all 16 car bundles finish, Then state transitions to Ready.
- [ ] **AC-LO6** (corrected direction): Given Content Pipeline is in Ready, When it emits `RaceLoadReady(RaceMode.Qualifying)` or `RaceLoadReady(RaceMode.Race, gridAssignment)` and Simulation accepts, Then Content transitions to its fully loaded active state and remains loaded while Simulation runs Qualifying or Countdown/Racing.
- [ ] **AC-LO7**: Given Simulation is in Results and sends `ContentUnloadRequest`, When Content receives it, Then Content transitions to Unloading without requiring Simulation to enter Idle first.
- [ ] **AC-LO8**: Given Content Pipeline is in Unloading, When all handles and instances are released, Then Content emits `ContentUnloadComplete`; only after that signal may Simulation enter Idle.
- [ ] **RaceReconfigure** (ADR-0003:72-74, :155-172): Given Content in Racing with a qualifying→race transition, When the selection identity is unchanged, Then Content transitions Racing → RaceReconfigure → Ready: emits `RaceReconfigureStart` (one-way event), instantiates cars from the locked GridAssignment, re-emits `RaceLoadReady(RaceMode.Race, gridAssignment)`, and performs ZERO Addressables I/O (verified by spy).
- [ ] **AC-EC6** (double-click): Given two races are requested simultaneously, When the second request fires, Then the second request is ignored (Content is idempotent while busy). *(Kernel also rejects repeated starts at :207-218 — Content stays idempotent.)*

---

## Implementation Notes

*Derived from ADR-0003 Implementation Guidelines:*

- **State machine** (ADR-0003:66-84): `CP_Idle → CP_LoadingTrack → CP_LoadingCars → CP_Ready → CP_Racing → CP_Unloading → CP_Idle`. Error path: `CP_Loading* → CP_Unloading → CP_Idle`. Reconfigure: `CP_Racing → CP_RaceReconfigure → CP_Ready`.
- **`CP_Error`** (ADR-0003:83): transient error-pending state before Unloading — NOT a stable state. The manifest's 7 lifecycle states + transient RaceReconfigure are canonical; CP_Error is the same state as CP_Loading* with a pending error signal (documented, not a separate stable state).
- **Handshake direction** (gate F3): ContentLoadRequested (Kernel) → CP_LoadingTrack. Content reaches CP_Ready after load+instantiate → EMITS `RaceLoadReady(mode, grid)` → composition wiring calls `SimulationStateMachine.OnRaceLoadReady` → Content transitions to CP_Racing after its own readiness publication succeeds. Event adapter owned by THIS story (no composition-root story exists).
- **CP_ ↔ SimulationState mapping** (ADR-0003:76-83): CP_Idle→Idle; CP_LoadingTrack/Cars→Loading; CP_Ready→Loading (awaiting acceptance); CP_Racing→Countdown/Racing/Finished/Paused; CP_RaceReconfigure→Loading (brief, sync); CP_Unloading→Results (after ContentUnloadRequest).
- **RaceReconfigure flow** (ADR-0003:155-172): Qualifying → Results → GridDisplay → StartRaceRequested → Content stays loaded → RaceReconfigure(GridAssignment) → emit RaceReconfigureStart → domain owners reset → instantiate cars from locked grid → re-emit RaceLoadReady(Race, grid) → NO Addressables I/O. Spy proves zero load/instantiate/release/unload during reconfiguration (gate F4).
- **Readiness guarantee** (ADR-0003:159): all assets loaded+instantiated BEFORE RaceLoadReady — so VehiclePhysicsSystem can subscribe to collision events on tick 0.

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- [Story 001]: AddressableKeys + topology (consumed here)
- [Story 003]: Actual load orchestration (17 parallel handles) — this story is the state machine only
- [Story 004]: Unload implementation — this story covers the Unloading transition + completion signal
- Car GameObject spawning → Vehicle Physics/Grid & Start (IRaceContentRuntime, Story 003)

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate). The developer implements against these — do not invent new test cases during implementation.*

- **AC-SM1**: Given app initializes; When Content starts; Then initial state is Idle with only Shared loaded.
- **AC-SM2**: Given Idle; When no race selected; Then no car/track bundles loaded.
- **AC-SM3**: Given Simulation Results + ContentUnloadRequest; When Content receives; Then transitions to Unloading while Simulation stays Results.
- **AC-SM4**: Given Loading Track/Cars; When ContentLoadError emitted; Then pending handles released, state reaches Unloading, then Idle after cleanup; player Cancel/Back does not cancel.
- **AC-SM5**: Given Ready; When no countdown trigger; Then state remains Ready.
- **AC-LO4**: Given Idle; When race selected; Then transitions to Loading Track.
- **AC-LO5**: Given Loading Cars; When all 16 finish; Then transitions to Ready.
- **AC-LO6**: Given Ready; When Content emits RaceLoadReady(mode) and Simulation accepts; Then transitions to active state; remains loaded during Qualifying/Countdown/Racing.
- **AC-LO7**: Given Results + ContentUnloadRequest; When received; Then transitions to Unloading without Idle first.
- **AC-LO8**: Given Unloading; When all handles released; Then emits ContentUnloadComplete; only after that may Simulation enter Idle.
- **RaceReconfigure**: Given Racing with qualifying→race, unchanged selection; When RaceReconfigure; Then Racing→RaceReconfigure→Ready, RaceReconfigureStart emitted, cars instantiated from locked grid, RaceLoadReady(Race, grid) re-emitted, ZERO Addressables I/O (spy). Edge: changed selection → NOT reconfigure (→ Story 003 rule).
- **AC-EC6**: Given two race requests simultaneously; When second fires; Then second ignored (idempotent while busy).

---

## Test Evidence

**Story Type**: Logic
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/content/ContentStateMachineTests.cs` — CP_ transitions, handshake adapter, RaceReconfigure spy — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (AddressableKeys + topology) — DONE; Simulation Kernel (handshake contracts) — DONE
- Unlocks: Stories 003-007
