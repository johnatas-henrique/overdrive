# Story 002: Fastest Lap Tracking & Best Lap Time

> **Epic**: Race Results
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/race-management.md` (sections: Race Timing, Race End & Results)
**Requirement**: `TR-RM-007` — `getResults() returns RaceResults: { positions, dnfList, fastestLap, winnerId, totalLaps, elapsedTime }` (fastestLap sub-requirement)

**ADR Governing Implementation**: ADR-0015: Race Management
**ADR Decision Summary**: Best lap time is the minimum `lapTime` across all completed laps (excluding the first crossing which is a sector, not a lap). Fastest lap available via `getFastestLap()` method on `IRaceManagement`.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No engine APIs used — pure TypeScript arithmetic.

**Control Manifest Rules (this layer)**:

- Required: C52 (sub-state under GSM Racing)
- Forbidden: F15 (Date.now/performance.now forbidden inside slot update — use tickCount)
- Guardrail: C-G7 (Race Management < 0.01ms/tick)

---

## Acceptance Criteria

_From GDD `design/gdd/race-management.md`, scoped to this story:_

- [ ] **AC-1**: Best lap time is tracked per car as the minimum `lapTime` across all completed laps
- [ ] **AC-2**: The first finish line crossing (race start) does NOT count as a lap time
- [ ] **AC-3**: `bestLapTime` appears in `RaceResult.bestLapTime` for each car
- [ ] **AC-4**: A car with 0 completed laps reports `bestLapTime = 0`
- [ ] **AC-5**: `getFastestLap(): { carId: string; lapTime: number } | null` is added to `IRaceManagement`. Returns `null` if no laps completed by any car. Returns the carId and lapTime of the fastest lap across all cars.
- [ ] **AC-6**: Lap time is measured as the time between consecutive finish line crossings
- [ ] **AC-7**: Zero and negative lap times are ignored — they never replace a positive `bestLapTime`

---

## Implementation Notes

_Derived from ADR-0015 Implementation Guidelines:_

1. **Lap time measurement**: On each finish line crossing, compute `currentTickCount - lastCrossingTickCount[carId]` as lap time in ticks. Convert to seconds: `lapTime_seconds = lapTicks × FIXED_DT`.

2. **First crossing rule**: The first finish line crossing for each car starts the lap timer but does not count as a completed lap time. Only subsequent crossings produce lap times that can update `bestLapTime`.

3. **bestLapTime tracking**: Maintain `Map<string, number>` for `bestLaps`. On each lap completion, compare the just-completed lap time to the stored best. Update if the new time is lower and positive.

4. **getFastestLap()** — separate method on `IRaceManagement`:

   ```typescript
   getFastestLap(): { carId: string; lapTime: number } | null {
     let fastest: { carId: string; lapTime: number } | null = null;
     for (const [carId, time] of this.bestLaps) {
       if (fastest === null || time < fastest.lapTime) {
         fastest = { carId, lapTime: time };
       }
     }
     return fastest; // null if no laps completed
   }
   ```

5. **Aggregate interface extension** — add to `IRaceManagement`:

   ```typescript
   interface IRaceManagement {
     // ... existing methods ...
     getFastestLap(): { carId: string; lapTime: number } | null;
   }
   ```

6. **Zero/negative guard**: Guard conditions — `if (lapTime > 0)` before comparing against best.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 001**: RaceResult interface definition and buildResults() aggregation
- **Story 003**: DNF classification (fastest lap is tracked for all cars regardless of DNF status)
- **Story 004**: JSON serialization of results
- **RM Core Story 003**: Lap detection via spline wrap-around (already in RM Core)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1**: Best lap time is minimum of all completed lap times
  - Given: Car completes 3 laps with lap times 95.0s, 92.5s, 93.2s
  - When: The race ends and buildResults() is called
  - Then: bestLapTime = 92.5 (the minimum)
  - Edge cases: All lap times identical; single lap completed; lap times in ascending order

- **AC-2**: First crossing does not produce a lap time
  - Given: Car crosses finish line for the first time (race start → lap 1)
  - When: The crossing is processed
  - Then: No lap time is recorded; the timer starts for the first lap
  - Edge cases: Safety car to green crossing starts the timer; driver who starts from pit lane

- **AC-3**: bestLapTime appears in RaceResult output
  - Given: Any car with completed laps
  - When: buildResults() is called
  - Then: The car's RaceResult contains bestLapTime matching the per-car minimum lap time
  - Edge cases: bestLapTime is 0 for cars with 0 completed laps

- **AC-4**: 0 completed laps → bestLapTime = 0
  - Given: A car DNF before completing any lap (or DNF on lap 0)
  - When: buildResults() is called
  - Then: bestLapTime = 0 for that car
  - Edge cases: All 8 cars DNF on first lap → everyone has bestLapTime = 0

- **AC-5**: getFastestLap() returns correct aggregate
  - Given: Cars with bestLapTimes: Car A (91.0s), Car B (89.5s), Car C (92.0s)
  - When: getFastestLap() is called
  - Then: Returns { carId: "car_B", lapTime: 89.5 }
  - Edge cases: No laps completed → returns null; single car with one lap; tie (identical times — first encountered wins)

- **AC-6**: Lap time between consecutive crossings
  - Given: Car crosses finish line at tick 3600, then again at tick 7200
  - When: The second crossing is processed
  - Then: Lap time = (7200 - 3600) × (1/60) = 60.0 seconds
  - Edge cases: Variable tick counts between laps (slow lap vs fast lap)

- **AC-7**: Zero/negative lap times are ignored
  - Given: bestLapTime is 95.0s, then a "lap" completes with time 0s (clock anomaly or negative due to overflow)
  - When: The anomalous time is compared against best
  - Then: bestLapTime remains 95.0s (anomalous time discarded)
  - Edge cases: All lap times are 0 or negative → bestLapTime = 0; mix of positive and zero times

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/race-management/fastest-lap.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (RaceResult interface, buildResults mechanics), RM Core Story 003 (lap detection — provides lap times)
- Unlocks: None directly; results display can render fastest lap
