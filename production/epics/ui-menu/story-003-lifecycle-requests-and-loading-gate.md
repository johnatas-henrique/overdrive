# Story 003: Lifecycle Requests & Loading Gate

> **Epic**: UI Menu
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/ui-menu.md`
**Requirement**: `TR-ui-005` (Loading, Qualifying Results use explicit non-stack lifecycle contracts)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0019 (Loading cancellation rules; Qualifying Results confirm-only) + ADR-0003 (Loading blocks Back/Cancel) + ADR-0013 (Qualifying Results) + ADR-0018 (StartRaceRequested acceptance)
**ADR Decision Summary**: Qualifying Results Confirm emits `StartRaceRequested` exactly once; UI enters an awaiting/blocked presentation state only after an injected host acceptance signal (never assumes RSM accepted). Loading blocks UI Back/Cancel until consumed `RaceLoadReady` or `ContentLoadError`; `RaceLoadReady(RaceMode.Qualifying)` releases to the qualifying destination (UI never writes Simulation state); `ContentLoadError` returns UI to Title with the supplied message. Qualifying Results remains Confirm-only (no timeout, no Back, no Cancel). Results Continue/Back emits a results-exit request and stays non-interactive until consumed `ContentUnloadComplete` (owned by the Results story if 004A owns Results).

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Event-consumption routing; injected host seams.

**Control Manifest Rules (this layer)**:
- Required: StartRaceRequested exactly once; loading blocks Back/Cancel until RaceLoadReady/ContentLoadError
- Required: Qualifying Results Confirm-only; UI never writes Simulation state

---

## Acceptance Criteria

*From ADR-0019/0003/0013/0018, scoped per QL-STORY-READY 2026-08-16 (003A split):*

- [ ] Qualifying Results Confirm emits `StartRaceRequested` exactly once; UI enters awaiting/blocked presentation only after an injected host acceptance signal (never assumes RSM accepted)
- [ ] Loading blocks UI Back/Cancel until consumed `RaceLoadReady` or `ContentLoadError`
- [ ] `RaceLoadReady(RaceMode.Qualifying)` releases the loading presentation to the qualifying destination; UI does not write Simulation state
- [ ] `ContentLoadError` returns UI to Title with the supplied message
- [ ] Qualifying Results remains Confirm-only: no timeout, no Back, no Cancel
- [ ] Results Continue/Back emits a results-exit request and remains non-interactive until consumed `ContentUnloadComplete` (moved to the Results story if 004A owns Results — cross-reference)

---

## Implementation Notes

*Derived from ADR-0019/0003 Implementation Guidelines:*

- UI is a pure consumer of lifecycle events and producer of requests — never a Simulation-state writer
- The awaiting/blocked state requires the host acceptance signal (RSM's actual acceptance is tested by RSM's integration)
- Loading cancellation: after loading begins, Back/Cancel are blocked (ADR-0003)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 003B]: Finished Presentation/Pause routing
- [race-flow]: RSM acceptance, Simulation transitions
- [Content]: actual loading

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-START**: Qualifying Results Confirm → exactly one StartRaceRequested; awaiting state only after host acceptance
- **AC-LOADING-GATE**: Back/Cancel blocked until RaceLoadReady/ContentLoadError; Qualifying-ready releases to qualifying destination; no Simulation write
- **AC-LOAD-ERROR**: ContentLoadError → Title with message
- **AC-CONFIRM-ONLY**: Qualifying Results → no timeout, no Back, no Cancel
- **AC-RESULTS-GATE**: Continue/Back emits exit request; non-interactive until ContentUnloadComplete

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/ui-menu/UiMenuTests.cs` — lifecycle routing with fakes (RSM/Simulation/Content seams)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002 (selection → StartRaceRequested), race-flow (RSM acceptance), Content (loading events)
- Unlocks: Story 003B, Story 004A (Results)
