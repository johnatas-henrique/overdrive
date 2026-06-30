# Story 008: Race Results & Event Emission

> **Epic**: Race Management (Core)
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/race-management.md`
**Requirement**: `TR-RM-007` (getResults() returns RaceResults), `TR-RM-006` (emit race events)

**ADR Governing Implementation**: ADR-0015: Race Management
**ADR Decision Summary**: Results are computed once at `endRace()` via `buildResults()`. Finishers are sorted by totalDistance descending, then DNF cars by totalDistance descending. Results are frozen after `endRace()` — `getResults()` returns the same cached object. Events: `race.checkered`, `race.completed`, `car.dnf`, and `position.changed` are emitted at specific lifecycle points.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No Babylon APIs used. Pure TypeScript data transformation.

**Control Manifest Rules (this layer)**:

- Required: C58 (gsm.transition() deferred to end-of-tick from endRace())
- Forbidden: C-F8 (never call gsm.transition() from within pipeline slot except from endRace())
- Guardrail: C-G7 (Race Management: < 0.01ms/tick)

---

## Acceptance Criteria

_From GDD `design/gdd/race-management.md`, scoped to this story:_

- [ ] **AC-14**: `getResults()` returns correct final positions, best lap, pit stops, and DNF status
- [ ] **AC-16**: `car.dnf` event fires with correct reason code
- [ ] **AC-19**: `endRace()` can only be called once — subsequent calls return cached results

---

## Implementation Notes

_Derived from ADR-0015 Implementation Guidelines:_

1. **buildResults() execution**: Called exactly once from `endRace()`. Reads `allCarIds`, `lapCount`, `splinePositions` (captured during `updatePositions()`), `dnfRegistry`, `bestLaps`, `pitStopCount`, `pitTotalTime`. Computes `totalDistance = lap × trackLength + splinePosition` for each car.
2. **Sorting order**: All entries sorted by `(isDNF, totalDistance)`. Non-DNF cars (finishers) first, descending by totalDistance. Then DNF cars, descending by totalDistance. Positions assigned 1-based from sorted order.
3. **endRace() idempotency**: Store results in `raceResult` field. On first call → compute, store, emit. On subsequent calls → return stored `raceResult` without recomputation, without re-emitting events, without calling `gsm.transition()` again.
4. **RaceResult shape**:
   ```typescript
   interface RaceResult {
     carId: string;
     teamId: string;
     finalPosition: number; // 1-based
     totalDistance: number;
     totalTime: number; // ticks × 1/60
     bestLapTime: number; // milliseconds
     lapCount: number;
     dnf: boolean;
     dnfReason?: string; // "fuel_empty" | "stalled_in_pit" | undefined
     pitStops: number;
     pitTotalTime: number; // milliseconds
   }
   ```
5. **Event emission from buildResults path**: `race.checkered` is emitted by the code that calls `setSubState("Checkered")` (Story 007/005), not by `buildResults()` itself. `race.completed` is emitted by `endRace()` after buildResults. `car.dnf` is emitted by `registerDNF()` (Story 005/006).
6. **getState()**: Returns `"inactive" | "ready" | "racing" | "complete"`. Used by other systems to check whether results are available.
7. **getResults()**: Returns null if state is not `"complete"`. Returns the same `RaceResult[]` object (===) every time after `endRace()`.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 007**: Race-end conditions — trigger endRace() via setSubState("Checkered")
- **Story 005/006**: DNF lifecycle — registerDNF() emits car.dnf event
- **Story 003**: Lap detection — populates lapCount used in buildResults
- **Story 004**: Position tracking — reads splinePositions captured each tick

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-14**: getResults() returns correct structured results
  - Given: Completed race with known state — Track length = 1000m; Car A: lapCount=3, splinePos=500, bestLap=95000ms, pitStops=1, pitTotalTime=25000ms, dnf=false; Car B: lapCount=3, splinePos=200, bestLap=97000ms, pitStops=2, pitTotalTime=45000ms, dnf=false; Car C: lapCount=2, splinePos=800, bestLap=98000ms, pitStops=1, pitTotalTime=30000ms, dnf=true (fuel_empty)
  - When: `getResults()` is called after endRace()
  - Then: Results array has 3 entries, sorted: Position 1 — Car A (totalDist=3500, dnf=false); Position 2 — Car B (totalDist=3200, dnf=false); Position 3 — Car C (totalDist=2800, dnf=true). Each entry includes: carId, teamId, totalDistance, totalTime, bestLapTime, lapCount, dnf, dnfReason, pitStops, pitTotalTime, finalPosition
  - Edge cases: All cars DNF — all entries sorted by totalDistance desc, no non-DNF section; no cars DNF — all entries sorted by totalDistance desc; tie in totalDistance — tiebreaker is grid position; bestLap is 0 for a DNF car that completed 0 laps — clarify expected sentinel value (0 is acceptable, consumer handles it)

- **AC-16**: car.dnf event fires with correct reason code
  - Given: Pending DNF for carId
  - When: `registerDNF(carId, reason)` is called (reason ∈ {"fuel_empty", "stalled_in_pit"})
  - Then: `car.dnf` event fires on the Event Bus with payload `{ carId, reason }`
  - Edge cases: Two DNFs in same tick — both events fire, check each event has the correct reason for its carId; event fires BEFORE car is removed from positionGrid (order: add to dnfRegistry → delete from positionGrid → emit event)

- **AC-19**: endRace() is idempotent
  - Given: System in Checkered sub-state
  - When: `endRace()` is called the first time
  - Then: `buildResults()` is called once; `race.completed` event fires with results; internal `raceResult` is stored
  - When: `endRace()` is called a second time
  - Then: `buildResults()` is NOT called again; the exact same results object (===) is returned; no duplicate `race.completed` events; no second `gsm.transition("PostRace")` call
  - Edge cases: `endRace()` called before Checkered state (e.g., during Racing) — should be a no-op or throw (clarify in implementation); results object should be treated as immutable after first call

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/race-management/race-results-events.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 005 (DNF — supplies dnfRegistry), Story 003 (lapCount), Story 004 (splinePositions), Story 007 (calls endRace())
- Unlocks: Race Results epic (consumes getResults()), PostRace screen, Telemetry Recorder
