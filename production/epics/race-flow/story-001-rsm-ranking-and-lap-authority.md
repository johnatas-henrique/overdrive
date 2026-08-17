# Story 001: RSM Ranking & Lap Authority

> **Epic**: Race Flow
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/race-session-manager.md`
**Requirement**: `TR-rsm-001` (ranking), `TR-rsm-002` (lap authority)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0018: Race Session Manager Authority — Ranking, Lap Authority, and Finish Resolution
**ADR Decision Summary**: Position ranking = `lapCount DESC → splinePosition DESC → positionEntryStep ASC → carId ASC`; tie tolerance within 0.001 spline position (inclusive, `<=` — resolved 2026-08-16). Lap counts only when BOTH conditions hold: Track's `CrossedLapBoundary` AND `distanceSinceLastLap > trackLength × 0.90`. RSM owns the lap-counting rule composition and the `LapCompleted` event; Track is the detection provider. `totalDistance` never ranks live position.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C# — no engine-specific APIs.

**Control Manifest Rules (this layer)**:
- Required: ranking by the 4-key order; totalDistance anti-cut/telemetry only
- Required: RSM owns lap rule composition; Track provides detection data

---

## Acceptance Criteria

*From ADR-0018 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Given car progress, previous-step spline progress, `positionEntryStep`, and `carId` supplied through simulation seams, RSM publishes ranking by `lapCount DESC → splinePosition DESC → positionEntryStep ASC → carId ASC`; `totalDistance` has no effect on ranking
- [ ] Same-step finish-line crossing ranks the car with higher previous-step spline position first
- [ ] Tie tolerance: two cars with lapCount identical AND splinePosition within 0.001 **inclusive** — lower `positionEntryStep` ranks higher; identical entry step → stable `carId` (boundary decision: `<= 0.001` — resolved 2026-08-16)
- [ ] Lap counting: given the Track seam `{ crossedLapBoundary, distanceSinceLastLap, trackLength }`, RSM increments the lap only when BOTH boundary crossing AND `distanceSinceLastLap > trackLength × 0.90` hold; reverse-movement/accumulator correctness is Track's (consumed here as normalized values)
- [ ] `LapCompleted(carId, lapNumber, lapTime)` and `PositionChanged(...)` published to an event sink exactly once per occurrence (no duplicate when position unchanged); Fuel/Tire/AI/HUD reactions are their own epics' tests

---

## Implementation Notes

*Derived from ADR-0018 Implementation Guidelines:*

- Ranking is pure C# over the seam-supplied progress records — unit-testable without a scene
- The `CrossedLapBoundary` test works even across the 0.94 → 0.01 wrap (Track owns); RSM consumes the boolean + distance accumulator values
- `positionEntryStep` is the recorded tick when the car entered its current spline position band — monotonic per car
- Event sink: publisher pattern with exactly-once semantics; consumer side effects are NOT asserted here

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Track epic]: boundary detection, distance accumulator, reverse normalization
- [Story 002-004]: finish resolution, lifecycle, publication
- [Fuel/Tire/AI/HUD epics]: LapCompleted/PositionChanged consumer behavior

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (ranking order)**: 16 progress records with varied laps/spline/entry/id → output follows the 4-key order; `totalDistance` has no effect; edge: same-step finish uses previous-step spline position; exact tolerance boundary (≤ 0.001)
- **AC-2 (lap authority)**: Track seam values → lap increments and LapCompleted fires only when both conditions pass; edge: boundary false, distance below threshold, distance exactly at threshold, reverse data treated as normalized
- **AC-3 (event publication)**: lap completion + position change → correct payloads reach the sink exactly once; edge: no duplicate when position unchanged; consumer side effects not asserted

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/simulation/RaceSessionManagerTests.cs` — ranking tie-breaks, lap composition, boundary 0.001

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Simulation Kernel (PostFinishSnapshot/step seams), Track epic (CrossedLapBoundary seam — consumed)
- Unlocks: Story 002 (resolver consumes ranking), HUD/AI consumers
