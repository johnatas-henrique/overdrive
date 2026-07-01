# Story 004: Results Serialization & Pit Stop Data Integration

> **Epic**: Race Results
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/race-management.md` (sections: DNF Detection — pit events, Race End & Results)
**Requirement**: `TR-RM-007` — results aggregation (serialization); `TR-RM-008` — `Pit stop tracking — totalTimePerCar incremented by pit.stop events; pitStopCount per car`

**ADR Governing Implementation**: ADR-0015: Race Management
**ADR Decision Summary**: Pit stop data (count + total time) is accumulated from `pit.exit` events into internal Maps. Results output must be JSON-serializable plain data for the Persistence system to consume.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No engine APIs used — pure TypeScript data serialization.

**Control Manifest Rules (this layer)**:

- Required: C53 (reentrant init — off/on for pit event subscriptions)
- Forbidden: None specific
- Guardrail: C-G7 (Race Management < 0.01ms/tick)

---

## Acceptance Criteria

_From GDD `design/gdd/race-management.md`, scoped to this story:_

- [ ] **AC-1**: `RaceResult[]` is JSON-serializable — `JSON.stringify()` does not throw
- [ ] **AC-2**: No class instances, Maps, Sets, or non-serializable types in the output — only plain objects, arrays, strings, numbers, booleans, and `undefined`
- [ ] **AC-3**: Pit stop count per car is recorded and available in `RaceResult.pitStops`
- [ ] **AC-4**: Pit total time per car is recorded and available in `RaceResult.pitTotalTime`
- [ ] **AC-5**: Pit data integrates from internal Maps (`pitStopCount`, `pitTotalTime`) which are populated by `pit.exit` events via Event Bus — observable in controlled test environment
- [ ] **AC-6**: JSON round-trip preserves all fields — `JSON.parse(JSON.stringify(results))` is deeply equal to the original
- [ ] **AC-7**: A car with 0 pit stops reports `pitStops = 0`, `pitTotalTime = 0`

---

## Implementation Notes

_Derived from ADR-0015 Implementation Guidelines:_

1. **Pit data accumulation** — in `init()`, subscribe to `pit.exit` events:

   ```typescript
   eventBus.off("pit.exit", this.onPitExit).on("pit.exit", (event) => {
     const carId = event.carId;
     pitStopCount.set(carId, (pitStopCount.get(carId) ?? 0) + 1);
     if (event.totalTimeMs !== undefined) {
       pitTotalTime.set(
         carId,
         (pitTotalTime.get(carId) ?? 0) + event.totalTimeMs
       );
     }
   });
   ```

2. **Pit data in buildResults()** — read from `pitStopCount` and `pitTotalTime` Maps, include in each `RaceResult` entry. Default to 0 for cars with no pit stops.

3. **Serialization contract** — the `RaceResult` objects returned by `buildResults()` must be "data" only:
   - All fields are primitives (string, number, boolean) or `undefined`
   - No nested objects beyond the flat `RaceResult` shape
   - No `Map`, `Set`, or class instances anywhere in the output array
   - `dnfReason` must be `undefined` (not the string `"undefined"`) for non-DNF cars — `JSON.stringify` drops `undefined` values, which is correct for serialization

4. **Round-trip test**: After `endRace()`, the output must survive `JSON.parse(JSON.stringify(results))` with all numeric values intact (including floating-point lap times).

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 001**: RaceResult interface definition, buildResults() core mechanics
- **Story 002**: Fastest lap tracking
- **Story 003**: DNF classification rules
- **Persistence system**: Actual save/load of results — this story only ensures the data shape is compatible (plain JSON). The Persistence epic handles storage.

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1**: RaceResult[] is JSON-serializable without error
  - Given: A fully populated RaceResult[] with mixed data (strings, numbers, booleans, optional dnfReason, 0/positive pit values)
  - When: JSON.stringify() is called on the array
  - Then: No exception is thrown
  - Edge cases: Empty array []; array with single entry; array with all 8 entries including undefined dnfReason

- **AC-2**: No non-serializable types in the output
  - Given: A RaceResult[] after endRace()
  - When: The array is recursively inspected for non-serializable types
  - Then: No Map, Set, class instances, functions, or symbols found — only plain objects, arrays, strings, numbers, booleans, and undefined
  - Edge cases: dnfReason is undefined (not the string "undefined"); empty strings are preserved

- **AC-3/4**: Pit stop count and total time in RaceResult
  - Given: A car completed 3 pit stops with total time 127500ms
  - When: endRace() is called
  - Then: The car's RaceResult has pitStops=3, pitTotalTime=127500
  - Edge cases: Car with 0 pit stops → pitStops=0, pitTotalTime=0

- **AC-5**: Pit data integrates via pit.exit events (integration)
  - Given: A race in progress with EventBus wired
  - When: pit.exit events fire for car_1 (×3) and car_2 (×1) with varying totalTimeMs values
  - And: endRace() is called
  - Then: car_1 → pitStops=3, pitTotalTime=sum(event totals); car_2 → pitStops=1, pitTotalTime=event total
  - Edge cases: pit.exit fires with totalTimeMs=0; pit.exit after endRace() (no effect — results cached); pit event for unknown carId

- **AC-6**: JSON round-trip preserves all fields
  - Given: Any valid RaceResult[] from buildResults()
  - When: Serialized via JSON.stringify() then parsed via JSON.parse()
  - Then: The parsed result is deeply equal to the original — all fields match including numeric values, string IDs, boolean flags, and absent undefined fields
  - Edge cases: Floating point values (lap times) survive without precision loss; dnfReason fields remain absent; integer pit values survive

- **AC-7**: 0 pit stops → pitStops=0, pitTotalTime=0
  - Given: A car that never entered the pit lane
  - When: endRace() is called
  - Then: The car's RaceResult has pitStops=0, pitTotalTime=0
  - Edge cases: No pit.exit events for any car → all have 0/0; car entered pit lane but didn't complete stop → still 0/0

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/race-management/results-serialization.test.ts` — must exist and pass (or documented playtest)
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (RaceResult data model), RM Core Story 008 (event emission — pit.exit events must be streaming)
- Unlocks: Persistence system can save/load RaceResult[]
