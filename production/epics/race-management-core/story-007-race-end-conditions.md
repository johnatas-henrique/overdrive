# Story 007: Race-End Conditions

> **Epic**: Race Management (Core)
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/race-management.md`
**Requirement**: `TR-RM-005` (three race-end conditions: lap limit, penultimate car finishes, one-lap-behind)

**ADR Governing Implementation**: ADR-0015: Race Management
**ADR Decision Summary**: Three independent race-end conditions checked every tick during Racing sub-state, in priority order: (1) Player completes all laps → immediate Checkered; (2) Penultimate car ahead finishes → immediate Checkered (player races over); (3) Leader finishes + player ≥1 lap behind → Checkered after player finishes current lap (no new lap starts). Condition 2 is checked in `checkRaceEnd()` each tick; conditions 1 and 3 are checked in `updateLaps()` on player finish line crossing.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No Babylon APIs used. Pure TypeScript state machine + arithmetic.

**Control Manifest Rules (this layer)**:

- Required: C55 (3 race-end conditions), C58 (gsm.transition() deferred to end-of-tick)
- Forbidden: C-F8 (never call gsm.transition() from within pipeline slot except from endRace())
- Guardrail: C-G7 (Race Management: < 0.01ms/tick)

---

## Acceptance Criteria

_From GDD `design/gdd/race-management.md`, scoped to this story:_

- [ ] **AC-8**: Player completing all laps triggers Checkered → `endRace()` → GSM PostRace transition
- [ ] **AC-18**: Race can run to completion with all 8 cars DNFing (player last) without hanging
- [ ] **AC-20**: Car ahead of player finishing all laps (condition 2) triggers immediate Checkered — player races over
- [ ] **AC-21**: Leader finishing with player ≥1 lap behind (condition 3) triggers Checkered after player finishes current lap — no new lap started

---

## Implementation Notes

_Derived from ADR-0015 Implementation Guidelines:_

1. **Three conditions, checked in priority order**:
   - **Condition 1 (Voltas completas)**: Player crosses finish line on lap N where N = `raceConfig.lapCount`. Checked in `updateLaps()`. On trigger → `setSubState("Checkered")`, `endRace()` called.
   - **Condition 2 (Último colocado)**: The car immediately ahead of the player (P[N-1]) crosses finish line on its final lap. Checked in `checkRaceEnd()` every tick. On trigger → `setSubState("Checkered")` immediately. Player does NOT finish current lap — position is frozen.
   - **Condition 3 (Uma volta atrás)**: Leader finishes all laps AND player is ≥1 lap behind (`leaderLap - playerLap >= 1`). Checked in `updateLaps()`. On trigger → race continues until player crosses finish line on current lap. When player crosses → `setSubState("Checkered")`. No new lap is started for the player.
2. **endRace()**: Calls `buildResults()`, stores results, emits `race.completed`, calls `gsm.transition("PostRace")`. The `gsm.transition()` is deferred to end-of-tick (not synchronous from pipeline slot #7) — see C58.
3. **All DNF scenario (AC-18)**: When all 8 cars DNF (player last), the race ends via player DNF (AC-9 from Story 005). The position grid becomes empty — `buildResults()` handles this correctly because it reads from `allCarIds` (not positionGrid) and sorts all entries including DNF cars. No crash, no hang.
4. **Condition 2 safety check**: `checkRaceEnd()` returns early if subState !== "Racing" or if player is leading (position ≤ 1). Only checks the car immediately ahead (playerPosition - 1).

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 008**: `buildResults()` and `getResults()` — called by `endRace()` but implemented separately
- **Story 005/006**: DNF lifecycle — provides `registerDNF()` and `dnfRegistry`
- **Story 003**: Lap detection — provides lapCount used by all three conditions

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-8**: Player completes all laps → Checkered → endRace → PostRace
  - Given: Player car in Racing sub-state on lap N-1 (one lap to go); splinePosition crosses finish line
  - When: `updateLaps(playerCarId)` detects lap N completion
  - Then: `setSubState("Checkered")` is called; `race.checkered` event fires with results; `endRace()` → `race.completed` fires; `gsm.transition("PostRace")` is called (deferred to end-of-tick)
  - Edge cases: Player crosses finish line on final lap while fuel_empty — pipeline order ensures lap detection fires before car.stopped (Fuel → Tire → Race Mgmt pipeline order); multiple player cars (multiplayer Alpha) — each player evaluated independently

- **AC-18**: All 8 cars DNF without hang
  - Given: 8 cars in Racing sub-state, all added to pendingDNF sequentially
  - When: `car.stopped` fires for each carId (no pit zone, no last lap exception)
  - Then: All 8 cars eventually registered DNF; player DNF → sub-state transitions to Checkered; `endRace()` runs; `buildResults()` returns 8 entries, all with dnf=true, sorted by totalDistance; no crash, no infinite loop, no hang
  - Edge cases: Position grid becomes empty during transition — `updatePositions()` handles empty sorted array gracefully; `checkRaceEnd()` has playerPosition = undefined (player already DNF) — guard clause returns early

- **AC-20**: Car ahead of player finishes → immediate Checkered (condition 2)
  - Given: Player is P8 (last place, 7 cars ahead); P7 car is on final lap lapCount = raceConfig.lapCount - 1
  - When: P7 crosses finish line (lapCount[P7] reaches raceConfig.lapCount)
  - When: `checkRaceEnd()` runs on the next tick
  - Then: `findCarAtPosition(7)` returns P7 carId; `lapCount[P7] >= raceConfig.lapCount` → true; `setSubState("Checkered")` is called immediately
  - Edge cases: Player is P1 (leading) — condition 2 is skipped (playerPosition <= 1); multiple cars between player and leader — only the immediate ahead car matters; P7 finishes on same tick player is also about to finish — condition 1 takes priority (checked in updateLaps before checkRaceEnd)

- **AC-21**: Leader finishes, player ≥1 lap behind → Checkered after player finishes current lap (condition 3)
  - Given: Leader just crossed finish line on lap raceConfig.lapCount; player is 2 laps behind (lapCount[leader] - lapCount[player] >= 1); player is on track mid-lap
  - When: `checkRaceEnd()` runs → condition 3 is pending
  - When: `updateLaps(playerCarId)` detects player crossing finish line on current lap
  - Then: `setSubState("Checkered")` is called; player lap count does NOT increment (no new lap started); results computed from distance at this moment
  - Edge cases: Player is on same lap as leader (lapCount difference < 1) → condition 3 does NOT fire — race continues normally; leader finishes but player is also on final lap and crosses line same tick → condition 1 fires first, condition 3 is moot; player never finishes current lap (DNF before crossing) → race ends via player DNF

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/race-management/race-end-conditions_test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (init), Story 002 (sub-state machine), Story 003 (lap detection — lapCount), Story 004 (position grid — positionGrid for condition 2)
- Unlocks: Story 008 (endRace() calls buildResults() and getResults())
