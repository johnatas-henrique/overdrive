# Story 003: RSM Lifecycle Contracts

> **Epic**: Race Flow
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/race-session-manager.md`
**Requirement**: `TR-rsm-005` (transition requests), `TR-rsm-006` (GridAssignment)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0018: Race Session Manager Authority (RSM Ownership Summary)
**ADR Decision Summary**: RSM emits `TransitionRequest` production while Simulation remains the sole `SimulationState` writer. RSM owns `GridAssignment` creation (carId → gridSlot[1..16]), immutable, traveling through `TransitionRequest(Loading, QualifyingComplete, gridAssignment)`. RSM remains in Results until `ContentUnloadComplete` — Idle becomes valid only after. Forfeit: Return to Menu while Countdown/Racing paused → resultClassification Forfeit, final position null, RaceAborted(Forfeit) emitted without resuming simulation.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C# — contracts only, no engine APIs.

**Control Manifest Rules (this layer)**:
- Required: RSM emits transition requests; Simulation is the sole state-machine writer
- Required: GridAssignment immutable; created by RSM; consumed by Grid & Start + Content

---

## Acceptance Criteria

*From ADR-0018 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Given an injected qualifying start/completion signal, RSM emits the appropriate `TransitionRequest(Loading, reason, gridAssignment)` without mutating `SimulationState`
- [ ] `GridAssignment` is immutable — caller mutation of the source collection after request creation does not change the request payload (no shallow aliasing)
- [ ] RSM remains in Results until `ContentUnloadComplete`; Continue/Back emits/retains the unload contract and does not authorize Idle before completion
- [ ] Forfeit (Return to Menu while paused) → resultClassification Forfeit, final position null, `RaceAborted(Forfeit)` emitted, no simulation resume
- [ ] Qualifying completion → RSM creates the immutable GridAssignment (ascending time, stable carId tie-break) carried through the transition request — not recalculated by Grid & Start

---

## Implementation Notes

*Derived from ADR-0018 Implementation Guidelines:*

- RSM never writes `SimulationState` — it produces requests the Simulation consumes (kernel already enforces this boundary)
- `GridAssignment` ctor copies the source array (defensive copy — verified in the kernel Foundation contract)
- The Results unload gate mirrors the kernel's `ContentUnloadRequest`/`ContentUnloadComplete` lifecycle (ADR-0003)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 004]: publication contract
- [Simulation Kernel]: actual state transitions (RSM only requests)
- [race-strategy epic]: pit events (LapCompleted consumption)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (transition request)**: injected qualifying start/completion → correct Loading TransitionRequest with reason + assignment; edge: RSM's simulation-state input unchanged
- **AC-2 (assignment immutability)**: caller mutates source collection after creation → request payload unchanged; edge: no shallow aliasing
- **AC-3 (results unload gate)**: Results + no ContentUnloadComplete → Continue/Back emits/retains unload contract, no Idle; edge: Idle valid only after completion
- **AC-4 (forfeit)**: Return to Menu paused → Forfeit classification, null position, RaceAborted, no resume
- **AC-5 (qualifying assignment)**: ascending time, stable carId tie-break → GridAssignment immutable; edge: equal times

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/RaceSessionManagerTests.cs` — transition production, immutability, unload gate
- Logic companion: `Assets/tests/unit/simulation/RaceSessionManagerTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (ranking), Simulation Kernel (TransitionRequest consumption), Content (unload lifecycle)
- Unlocks: Story 004 (publication), Story 008 (Grid & Start consumes GridAssignment)
