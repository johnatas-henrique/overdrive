# Story 003: Pit Service Lifecycle & Command Contract

> **Epic**: Race Strategy
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/pit-stop.md`
**Requirement**: `TR-pit-001` (service duration), `TR-pit-002` (player exit/AI full tank), `TR-pit-004` (PitPhase ownership)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0011: Pit Stop Architecture (§PitServiceCommand, §Data Flow)
**ADR Decision Summary**: PitStopSystem (Step 9b) reads CarState.PitPhase — it does NOT detect entry or write PitPhase (VP owns). At InPitBox it emits the next-tick `PitServiceCommand { active, targetFuel 8.0, tireSwapRequired, requestExit }`; Fuel/Tire read it read-only on the next tick; VP consumes requestExit (1-tick latency). Service duration = `max(2.0, missingFuel / 0.8)`; tire+fuel parallel; tire swap completes at exactly 2s; player early exit unavailable before 2s, eligible after (Confirm direct — input epic); AI never requests exit until fuel 8.0L; full fuel auto-requests exit; command inactive after exit requested.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C# state machine + timer; no Unity APIs.

**Control Manifest Rules (this layer)**:
- Required: PitStop writes ONLY PitServiceCommand + PitState — never PitPhase/FuelState/TireState
- Required: service duration max(2s, missing/0.8); player exit after 2s; AI full tank; 16 cars isolated

---

## Acceptance Criteria

*From ADR-0011, scoped per QL-STORY-READY 2026-08-16 (split 003A — service lifecycle):*

- [ ] `PitStopSystem.Tick` reads `CarState.PitPhase`; does not detect entry or write PitPhase
- [ ] At InPitBox, emits the exact next-tick command (active, targetFuel 8.0, tireSwapRequired, requestExit)
- [ ] Service duration: missing fuel 0/4/8L → 2s/5s/10s (`max(2.0, missingFuel / 0.8)`); fuel+tire parallel
- [ ] Tire swap completes at exactly 2s; player early exit unavailable before 2s, eligible after (Confirm delivered → one exit request; repeated Confirm no duplicate)
- [ ] AI never requests exit until fuel reaches 8.0L; full fuel auto-requests exit once
- [ ] Command becomes inactive after exit is requested
- [ ] Fuel/Tire state mutation verified by their own tests (narrow integration harness, not direct PitStop mutation)

---

## Implementation Notes

*Derived from ADR-0011 Implementation Guidelines:*

- `PitState { carId, assignedBoxId, phase, serviceTimer, tireSwapComplete, fuelLoaded, playerCanExit, pitThisLap }`
- requestExit is consumed by VP on the next authoritative tick (PitPhase → PitExiting) — PitStop never writes PitPhase (ADR-0002 ownership)
- Pit entry detection + one-tick pipeline ordering → VP/Simulation integration (not this story)
- 80 km/h enforcement + pit navigation → VP/Track integration
- Generic UI disablement + Confirm routing → Input System (ADR-0005)
- RSM PitEntry/PitExit event publication → RSM (race-flow)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [vehicle-physics]: entry detection, 80 km/h enforcement, PitPhase
- [race-flow]: RSM PitEntry/PitExit events
- [input epic]: UI disablement, Confirm routing

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (command contract)**: PitPhase InPitBox at Step 9b → exact PitServiceCommand; Fuel/Tire consume next tick; edge: Transit/Exiting/NotPitting; command read-only to consumers
- **AC-2 (service duration)**: missing 0/4/8L → 2s/5s/10s; edge: floating boundary at exactly 2s, target below current
- **AC-3 (player exit)**: timer < 2s + Confirm → no exit request; ≥ 2s + Confirm → one; edge: repeated Confirm, exact 2.0s boundary, partial fuel
- **AC-4 (AI full tank)**: tire complete + fuel < 8.0 → no exit; fuel reaches 8.0 → exit once
- **AC-5 (command inactive)**: after exit requested → active false

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/PitStopTests.cs` — command contract, service timing with fakes
- Logic companion: `Assets/tests/unit/simulation/PitStopTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001/002 (Fuel/Tire consume the command), vehicle-physics (PitPhase seam)
- Unlocks: Story 004 (multi-car/mode), Story 005 (advisory)
