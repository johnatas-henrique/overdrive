# Story 001: RaceResult Data Model & Results Aggregation

> **Epic**: Race Results
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/race-management.md` (sections: Race End & Results, Formulas)
**Requirement**: `TR-RM-007` — `getResults() returns RaceResults: { positions, dnfList, fastestLap, winnerId, totalLaps, elapsedTime }`

**ADR Governing Implementation**: ADR-0015: Race Management
**ADR Decision Summary**: Pure TypeScript results aggregation with no Babylon APIs. `buildResults()` reads from internal Maps (lapCount, bestLaps, dnfRegistry, pitStopCount, pitTotalTime, splinePositions) and produces sorted `RaceResult[]`. `endRace()` caches results; `getResults()` returns cached. `gsm.transition()` deferred to end-of-tick.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No engine APIs used — pure TypeScript data aggregation.

**Control Manifest Rules (this layer)**:

- Required: C52 (sub-state under GSM Racing), C53 (reentrant init), C58 (gsm.transition deferred)
- Forbidden: C-F8 (never call gsm.transition from pipeline slot except endRace — deferred)
- Guardrail: C-G7 (Race Management < 0.01ms/tick)

---

## Acceptance Criteria

_From GDD `design/gdd/race-management.md`, scoped to this story:_

- [ ] **AC-1**: RaceResult interface is defined with fields: `carId`, `teamId`, `finalPosition`, `totalDistance`, `totalTime`, `bestLapTime`, `lapCount`, `dnf`, `dnfReason?`, `pitStops`, `pitTotalTime`
- [ ] **AC-2**: `buildResults()` produces a `RaceResult[]` where each entry's fields are correctly populated from the current race state (lap counts, DNF status, pit data, spline positions)
- [ ] **AC-3**: Results are sorted: finishers first by `totalDistance` descending, then DNF cars by `totalDistance` descending
- [ ] **AC-4**: `finalPosition` is assigned 1-based from sorted order
- [ ] **AC-5**: `endRace()` calls `buildResults()` once and caches the result
- [ ] **AC-6**: `getResults()` returns the cached result; returns `null` before `endRace()` is called
- [ ] **AC-7**: Second call to `endRace()` returns the same cached object (idempotent — no recomputation)
- [ ] **AC-8**: `totalDistance = lap × trackLength + splinePosition`; `totalTime = tickCount × FIXED_DT` (tickCount starts at GreenFlag, stops at Checkered)

---

## Implementation Notes

_Derived from ADR-0015 Implementation Guidelines:_

1. **RaceResult interface** — match the ADR-0015 `RaceResult` definition exactly:

   ```typescript
   interface RaceResult {
     carId: string;
     teamId: string;
     finalPosition: number; // 1-based
     totalDistance: number; // lap × trackLength + splinePosition
     totalTime: number; // ticks × 1/60
     bestLapTime: number; // min lapTime across completed laps (0 if none)
     lapCount: number; // completed laps
     dnf: boolean;
     dnfReason?: string; // 'fuel_empty' | 'stalled_in_pit'
     pitStops: number; // count of completed pit stops
     pitTotalTime: number; // accumulated pit time in ms
   }
   ```

2. **buildResults() algorithm** — read from runtime Maps:
   - `lapCount`, `dnfRegistry`, `pitStopCount`, `pitTotalTime`, `bestLaps`, `splinePositions`
   - Compute `totalDistance` per car: `(lapCount ?? 0) × trackLength + (splinePositions ?? 0)`
   - Sort: finishers (`dnf === false`) first by `totalDistance` descending, then DNF cars by `totalDistance` descending
   - Assign `finalPosition` as 1-based index in sorted array

3. **endRace() caching** — call `buildResults()` once, store in private `raceResult` field. Subsequent calls return same reference. Called from `Checkered` sub-state. `gsm.transition("PostRace")` is deferred to end-of-tick.

4. **getResults()** — returns `raceResult ?? null`. Consumers check for null before accessing.

5. **totalTime** — computed from `tickCount` (incremented during Racing sub-state, starts at GreenFlag, stops at Checkered). `FIXED_DT = 1/60`.

6. **All results data is plain data** — no class instances, no Maps, no Sets in the output array. Plain objects and primitives only.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 002**: Fastest lap tracking and `getFastestLap()` method
- **Story 003**: DNF-specific classification rules (positioning of DNF cars among themselves)
- **Story 004**: JSON serialization round-trip testing and pit stop data integration from events
- **RM Core Story 007**: Race-end conditions (already in RM Core)
- **RM Core Story 008**: Event emission for `race.completed`, `race.checkered` (already in RM Core)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1**: RaceResult interface fields are present and typed correctly
  - Given: A valid RaceResult object is constructed with all fields populated
  - When: The object is accessed
  - Then: Each field (carId, teamId, finalPosition, totalDistance, totalTime, bestLapTime, lapCount, dnf, dnfReason?, pitStops, pitTotalTime) exists with the correct type
  - Edge cases: dnfReason is undefined when dnf=false; optional field is absent for non-DNF cars

- **AC-2/3**: buildResults() produces results sorted by finishers-then-DNF, descending distance
  - Given: A race state with 3 finishers (distances: 5000, 4900, 4800) and 2 DNF cars (distances: 3000, 1500)
  - When: buildResults() is called
  - Then: The returned array has 5 entries in order: finishers @ 5000 → 4900 → 4800, then DNF @ 3000 → 1500
  - Edge cases: Single finisher + single DNF; all finishers; all DNF; 0 cars (empty grid)

- **AC-4**: finalPosition is 1-based from sorted order
  - Given: 8 cars sorted by buildResults()
  - When: Results are produced
  - Then: finalPosition values are 1, 2, 3, 4, 5, 6, 7, 8 with no gaps or duplicates
  - Edge cases: finalPosition always starts at 1 even with DNF cars removed from live grid

- **AC-5/6**: endRace() caches result, getResults() returns cached
  - Given: A race in Checkered sub-state
  - When: endRace() is called, then getResults() is called twice
  - Then: The first getResults() returns a non-null array; the second getResults() returns the identical object (===) as the first
  - Edge cases: getResults() before endRace() returns null

- **AC-7**: endRace() is idempotent
  - Given: endRace() has been called once
  - When: endRace() is called a second time
  - Then: The return value is the same object reference (===) as the first call; no recomputation
  - Edge cases: Calling endRace() 3+ times still returns the same reference

- **AC-8a**: totalDistance formula correctness
  - Given: Car with 5 completed laps, splinePosition = 200, trackLength = 1000
  - When: buildResults() computes totalDistance
  - Then: totalDistance = 5 × 1000 + 200 = 5200
  - Edge cases: 0 laps + splinePosition 0 → totalDistance = 0; splinePosition at trackLength boundary

- **AC-8b**: totalTime formula correctness
  - Given: Race duration of 1800 ticks, FIXED_DT = 1/60
  - When: buildResults() computes totalTime
  - Then: totalTime = 1800 / 60 = 30 seconds
  - Edge cases: Race with 0 ticks (immediate end); race with fractional tick counts

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/race-management/results-data-model_test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: RM Core (Stories 001-008) — lapCount, dnfRegistry, pitStopCount, pitTotalTime, bestLaps, splinePositions Maps must be populated before buildResults()
- Unlocks: Story 002 (Fastest Lap), Story 003 (DNF Classification), Story 004 (Serialization)
