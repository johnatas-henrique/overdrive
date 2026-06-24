# Story 003: Lap Detection via Spline Wrap-Around

> **Epic**: Race Management (Core)
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/race-management.md`
**Requirement**: `TR-RM-003` (lap detection via splinePosition wrap-around)

**ADR Governing Implementation**: ADR-0015: Race Management
**ADR Decision Summary**: Lap detection uses spline position wrap-around — not collision triggers. Forward crossing is detected when `prevPos > 0.9 × trackLength AND currentPos < 0.1 × trackLength`. Backwards crossing does NOT increment.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No Babylon APIs used. Pure TypeScript arithmetic. Reads `physics.splinePosition` per car per tick — this is a float from Physics slot #2.

**Control Manifest Rules (this layer)**:

- Required: C56 (lap detection — spline wrap-around), C52 (sub-state under GSM Racing)
- Guardrail: C-G7 (Race Management: < 0.01ms/tick)

---

## Acceptance Criteria

_From GDD `design/gdd/race-management.md`, scoped to this story:_

- [ ] **AC-6**: Lap counter increments correctly when car crosses start/finish line
- [ ] **AC-7**: Crossing finish line backward does not increment lap counter

---

## Implementation Notes

_Derived from ADR-0015 Implementation Guidelines:_

1. **Detection formula**: `prevSplinePos > trackLength * 0.9 && currentSplinePos < trackLength * 0.1`. The finish line is at spline position 0. The threshold values (0.9 and 0.1) are hardcoded constants, not configurable.
2. **Forward-only**: Backward movement (position going from low → high across the 0 boundary) does NOT satisfy the condition because `prev` will be < 0.9. No additional direction tracking needed — the math handles it.
3. **Lap counter**: Per-car `Map<string, number>` initialized to 0 at `init()`. On each valid crossing, `lapCount.set(carId, lapCount.get(carId) + 1)`.
4. **Event emission**: On every lap increment, emit `car.lap.completed { carId, lap: newLap, lapTime }` via Event Bus. This fires for ALL cars — not just the player.
5. **Lap time measurement**: Time between consecutive finish line crossings. The first crossing for a car (lap 0 → 1) starts the timer but does NOT count as a timed lap. Actual lap 1 time is measured between crossing 1 and crossing 2. Store `lastCrossingTick` per car.
6. **Prev position storage**: Each tick, store `prevSplinePos.set(carId, currentSplinePos)` after processing lap detection. This is used as `prev` in the next tick's check.
7. **Edge case — car spawns at start line**: On tick 0, prevSplinePos is 0. The car moves forward to e.g., position 5. No wrap-around condition is met. Correct.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 004**: Position sorting and hysteresis (reads lapCount but does not set it)
- **Story 007**: Race-end conditions — these are checked in updateLaps() AND checkRaceEnd()
- **Story 002**: Countdown sequence — no lap detection during Countdown/GreenFlag sub-states

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-6**: Lap counter increments on forward start/finish crossing
  - Given: Track length = 1000m; car at prevSplinePos = 950 (0.95 × length)
  - When: `tick()` updates car splinePosition to 50 (0.05 × length)
  - Then: `lapCount[carId]` increases by 1; `car.lap.completed` event fires with `{ carId, lap, lapTime }`; `prevSplinePos[carId]` is updated to 50
  - Edge cases: prev exactly at 900 (0.9 × length) and current exactly at 100 (0.1 × length) — boundary condition, should count; prev at 901, current at 99 — should count; prev at 899, current at 101 — should NOT count (prev < 0.9); multiple cars crossing in the same tick — each counted independently

- **AC-7**: Backward crossing does not increment lap counter
  - Given: Track length = 1000m; car at prevSplinePos = 50 (0.05 × length)
  - When: `tick()` updates car splinePosition to 950 (0.95 × length)
  - Then: `lapCount[carId]` is unchanged; no `car.lap.completed` event fires; `prevSplinePos[carId]` is updated to 950
  - Edge cases: Car crosses forward then reverses back across the line in the same tick — pipeline processes per-tick, so prev captures the starting position, no double-count; car sits exactly at the start/finish line (splinePos = 0) for multiple ticks — prev stays at 0, no wrap-around pattern detected

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/race-management/lap-detection_test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (init), Story 002 (sub-state machine — must be in Racing sub-state for lap detection to be active)
- Unlocks: Story 004 (position tracking reads lapCount), Story 007 (race-end checks lapCount)
