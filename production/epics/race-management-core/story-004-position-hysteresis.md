# Story 004: Position Grid & Position Hysteresis

> **Epic**: Race Management (Core)
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/race-management.md`
**Requirement**: `TR-RM-002` (position grid computed every tick), `TR-RM-006` (emit race events — position.changed)

**ADR Governing Implementation**: ADR-0015: Race Management
**ADR Decision Summary**: Position grid is computed every tick by sorting all non-DNF cars by `totalDistance = lap × trackLength + splinePosition` descending. Position changes use a 3-tick hysteresis: position.changed is only emitted if the distance delta between adjacent cars remains below 0.5m for 3 consecutive ticks.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No Babylon APIs used. Pure TypeScript sort + arithmetic. Reads `physics.splinePosition` per car per tick.

**Control Manifest Rules (this layer)**:

- Required: C57 (position hysteresis — 3-tick sustain), C52 (sub-state under GSM Racing)
- Guardrail: C-G7 (Race Management: < 0.01ms/tick — O(8 log 8) sort)

---

## Acceptance Criteria

_From GDD `design/gdd/race-management.md`, scoped to this story:_

- [ ] **AC-5**: Position grid updates every tick and reflects correct order by `lap × trackLength + splinePosition`
- [ ] **AC-15**: `position.changed` event fires only when a car's position changes (not every tick)

---

## Implementation Notes

_Derived from ADR-0015 Implementation Guidelines:_

1. **Position formula**: `totalDistance = completedLaps × trackLength + splinePosition`. Cars with higher `totalDistance` are ahead.
2. **Sort execution**: Run every tick during `Racing` sub-state. Filter out DNF cars first. Sort by `totalDistance` descending (O(8 log 8) — trivial for 8 cars).
3. **Hysteresis — 3-tick sustain**: Maintain a `Map<string, number>` called `hysteresisTicks` counting how many consecutive ticks an adjacent pair has been below the 0.5m threshold. Only swap if `hysteresisTicks[carId] >= 3`. Reset to 0 when delta exceeds threshold or position stabilizes.
4. **Non-adjacent swaps**: If a car changes more than 1 position (|newPos - prevPos| > 1) — emit position.changed immediately without hysteresis. This catches rapid overtakes (e.g., pit exit rejoins in a different position).
5. **`position.changed` event**: Payload is `{ carId, old: number, new: number }`. Emitted once per affected car per tick — at most 7 emits per tick (8 cars, one stable).
6. **DNF exclusion**: DNF cars are removed from `positionGrid` via `registerDNF()`. The position sort filter excludes them. No additional logic needed.
7. **Grid initialization**: At `startRace()`, grid positions are set based on qualifying order from RaceConfiguration. During Countdown and GreenFlag, positions are locked — no position.changed events fire until Racing sub-state.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 003**: Lap detection (position grid reads lapCount but does not set it)
- **Story 005/006**: DNF lifecycle (positions exclude DNF cars)
- **Story 007**: Race-end conditions
- **Story 008**: Final results (position grid is live state, results are frozen at race end)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-5**: Position grid sorted by totalDistance each tick
  - Given: 3 active cars with states: Car A (lap=1, splinePos=500 → totalDist=1500), Car B (lap=0, splinePos=900 → totalDist=900), Car C (lap=0, splinePos=100 → totalDist=100)
  - When: `tick()` runs in Racing sub-state
  - Then: Position grid order is [Car A (P1), Car B (P2), Car C (P3)]
  - Edge cases: All cars on same lap with different spline positions — sorted by splinePos descending; DNF car excluded from grid entirely; 0 active cars (all DNF) — positionGrid is empty, no crash

- **AC-15**: position.changed with 3-tick hysteresis
  - Given: 2 cars side-by-side: Car A (lap=0, splinePos=500), Car B (lap=0, splinePos=499.8) — delta = 0.2m < 0.5m threshold; current grid: [A(P1), B(P2)]
  - When: `tick()` 3 times, delta stays below 0.5m
  - Then: Tick 1 — no position.changed, hysteresisTicks[A] = 1; Tick 2 — no position.changed, hysteresisTicks[A] = 2; Tick 3 — position.changed fires { carId: B, old: 2, new: 1 }, hysteresisTicks[B] reset to 0
  - Given: Cars side-by-side, delta < 0.5m
  - When: `tick()` — delta below threshold, hysteresisTicks[A] = 1
  - When: `tick()` — delta now >= 0.5m (car pulled ahead)
  - Then: No position.changed, hysteresisTicks[A] reset to 0 (never reached sustain threshold)
  - Given: Car jumps 2 positions (non-adjacent): Car A passes both B and C in one tick
  - When: `tick()`
  - Then: position.changed fires immediately for A (no hysteresis), old position difference > 1
  - Given: Position grid is stable (no car changes position)
  - When: `tick()` N times
  - Then: No position.changed events fire at all — zero emissions on stable grid

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/race-management/position-hysteresis.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (init), Story 002 (must be in Racing sub-state), Story 003 (lap detection populates lapCount)
- Unlocks: Story 008 (results use splinePositions captured here)
