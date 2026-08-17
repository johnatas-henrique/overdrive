# Story 008: Grid & Start — Formation, Perfect Start, Countdown

> **Epic**: Race Flow
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 2.0h

## Context

**GDD**: `design/gdd/grid-start.md`
**Requirement**: `TR-grid-001` (formation), `TR-grid-002` (Perfect Start), `TR-grid-003` (1.15× 600 ticks), `TR-grid-004` (countdown lights), `TR-grid-005` (Qualifying Results Confirm-only)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0018 (GridAssignment ownership) + ADR-0013 (results)
**ADR Decision Summary**: Grid & Start consumes the immutable `GridAssignment` verbatim (RSM owns ranking — never recomputes rank/tier). Formation: 16 cars 2-wide (8.0m rows, 3.5m columns, 3-5m stagger by first-corner direction; default right-column-front). Perfect Start: arming window GO-12..GO-1 with rawAcceleratePostDeadZone > 0.5 AND rawBrakePostDeadZone == 0 at GO → `PerfectStartResult.active=true`, multiplier 1.15 for 600 ticks (VP applies the force multiplier — Grid & Start emits the result). Countdown: five one-second lights, all off = GO event + grid-lock release on tick 300 (Simulation owns tick-300 ordering). AI never receives the Perfect Start multiplier (player-only).

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C# contracts; VP/Simulation own the physical effects.

**Control Manifest Rules (this layer)**:
- Required: `perfect_start_arming_window = [GO−12, GO−1]`; `perfect_start = armed AND rawAcceleratePostDeadZone(GO) > 0.5 AND rawBrakePostDeadZone(GO) == 0`
- Required: `longitudinalDriveForceFinal *= 1.15` for 600 ticks after a valid perfect start (VP applies)
- Required: Qualifying Results Confirm-only, no timeout/Back/Cancel (TR-grid-005 — UI Menu routing, gate contract)

---

## Acceptance Criteria

*From ADR-0013/0018 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Given immutable `GridAssignment` + Track first-corner direction → 16 grid transforms with the specified spacing/stagger (8 rows, leading column by direction; unknown → right-column-front)
- [ ] Given raw input samples during GO-12..GO-1 and at GO → `PerfectStartResult` emitted: active=true, multiplier 1.15, remainingTicks 600 before the first Racing tick (VP applies the multiplier; AI never receives it)
- [ ] Brake above dead-zone at GO blocks the bonus even with throttle > 0.5; release before the window → no bonus (normal start)
- [ ] Grid & Start consumes the supplied `GridAssignment` verbatim — no tier-based reordering; equal times already resolved upstream (stable carId)
- [ ] Countdown lights: five one-second lights, all off = GO event + grid-lock release (Simulation owns the tick-300 ordering contract — consumed here)
- [ ] TR-grid-005: Qualifying Results is Confirm-only (no timeout/Back/Cancel) — the gate contract emitted for UI Menu routing

---

## Implementation Notes

*Derived from ADR-0013/0018 Implementation Guidelines:*

- `PerfectStartResult` is the boundary contract (active, multiplier, remainingTicks) — VP consumes it to apply the 1.15× to `longitudinalDriveForceFinal` (vehicle-physics-dynamics story 003 seam)
- Grid formation consumes Track's first-corner direction (seam) and the RSM-owned assignment — no ranking logic here
- Countdown light state is a presentation output; the tick-300 ordering (Countdown remains tick 300, GO unlock after physics, Racing next tick) is Simulation's contract — Grid & Start publishes light state + unlock request
- AI cars start from the grid but never receive the Perfect Start multiplier (player-only, resolved MVP)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 003]: GridAssignment ranking/creation (RSM)
- [vehicle-physics-dynamics Story 003]: 1.15× force application (consumes PerfectStartResult)
- [ui-menu epic]: Qualifying Results screen routing
- [Simulation Kernel]: tick-300 ordering, grid-lock release execution

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (formation)**: 16-slot immutable assignment + direction → 8 rows, correct spacing, correct leading column; edge: unknown direction → right-column-front
- **AC-2 (perfect start)**: valid accelerate/brake samples in GO-12..GO-1 and at GO → active=true, 1.15, 600 ticks; edge: brake at GO blocks, no arming window, released input at GO → inactive
- **AC-3 (assignment verbatim)**: cross-tier qualifying order → slots applied exactly, no tier reorder; edge: equal times pre-resolved
- **AC-4 (countdown)**: lights state + GO event + unlock request on tick 300; edge: ordering contract consumed from Simulation
- **AC-5 (confirm-only)**: Qualifying Results gate contract — no timeout/Back/Cancel

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/GridStartTests.cs` — formation, Perfect Start, countdown with fakes
- Logic companion: `Assets/tests/unit/simulation/GridStartTests.cs` (arming-window math)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (GridAssignment), Track (first-corner direction), vehicle-physics-dynamics Story 003 (multiplier seam)
- Unlocks: ui-menu (Qualifying Results), HUD (countdown/perfect-start indicator)
