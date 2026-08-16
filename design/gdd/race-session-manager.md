# Race Session Manager

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-08-01
> **Implements Pillar**: Every Short Race Matters

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Standalone qualifying-to-race-to-results flow, local timers, positions, laps, and finish events. |
| MVP architecture constraints | Race events and results are explicit so later sessions can consume them without changing race rules. |
| Alpha | Three-race sessions and persistent standings. |
| Beta | Not designed. |
| Release | Full championship flow. |

### Review Boundary
Session/championship behavior is non-blocking unless MVP events cannot support later orchestration.

## Overview

**Race Session Manager** tracks race state (lap count, position, timer) and fires race events (start, finish, lap complete, pit entry). It reads simulation time and car positions to determine lap counts, positions, and finish conditions. Other systems consume these events: HUD displays lap/position, Audio triggers music stings, AI Rival adjusts behavior, Fuel/Tire track consumption per lap. Without this system, no one knows what lap it is, who's in what position, or when the race ends.

## Player Fantasy

**Framing:** Indirect — the player experiences the effects (knowing their position, hearing the final lap sting) but doesn't interact with the system directly.

**Emotional target:** One layer:

1. **The Race Is Alive (constant feedback):** Every lap, every position change, every finish is tracked and communicated. The player never wonders "what lap am I on?" or "am I still P4?" — the system tells them through HUD, audio, and events. Anchor: lap 4 of 5, position changes from P4 to P3 — the HUD updates, the audio cues, the race feels real.

**Pillar alignment:** Every Short Race Matters — lap counting and position tracking make each lap count. Speed You Can Feel — race events trigger audio/visual feedback.

**Design test:** Can the player always tell their current lap, position, and time without confusion?

## Detailed Design

### Core Rules

**1. Race State Tracking**

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `lapCount` | int | 0–`totalLaps` | Laps completed by this car. `totalLaps` is the current race configuration, 5 in MVP. |
| `position` | int / null | 1–16 or null | Current race position. Recalculated every sim step; null for a Forfeit result. |
| `positionEntryStep` | uint | 0–∞ | Simulation step at which the car first reached its current tied spline position; used only for deterministic ties. |
| `raceTime` | float | 0.0–∞ | Derived from Simulation `activeRaceStepCount × FIXED_DT`; starts at GO and never advances during Countdown or Paused. |
| `lapTimes` | float[] | 0–`totalLaps` entries | Individual lap times. Populated on each lap completion. |
| `totalDistance` | float | 0.0–∞ | Cumulative distance traveled in meters. Used for anti-cut validation and telemetry; never for live position ranking. |
| `isFinished` | bool | false/true | Set true when car crosses finish line on `totalLaps`. |
| `isPitting` | bool | false/true | Set true when car enters pit lane, false on exit. |
| `raceMode` | `Race` / `Qualifying` | Session mode | Owns session-specific rules while Simulation remains in its shared Racing state. |
| `resultKind` | `Qualifying` / `Race` | Result presentation kind | Selects Grid Results after Qualifying or Race Results after a race. |
| `resultClassification` | `Finished` / `DNF` / `Forfeit` | Result outcome | `Forfeit` is voluntary Return to Menu before Finished; it has no final position and never invokes FinishOrderResolver. |
| `forfeitLapCount` | int | Forfeit-only result value | Copies the player's completed `lapCount` when `resultClassification = Forfeit`. |
| `raceTimeAtForfeit` | float | Forfeit-only result value | Copies the player's current `raceTime` when `resultClassification = Forfeit`. |
| `resolutionComplete` | bool | false/true | HUD/UI use it to enable Continue; Results may open only after it is true and terminal presentation is dismissed. |
| `projectedFinishTime` | float / DNF | Result-only value | FinishOrderResolver assigns unfinished trailing AI from remaining distance and pre-established race pace. |
| `gridAssignment` | `carId → gridSlot[1..16]` | Locked before race setup | RSM creates it from qualifying times or skip rule, carries it through QualifyingComplete TransitionRequest, and Grid & Start consumes it. |

**2. Position Calculation**

Position is determined by ranking all 16 cars using spline position (where the car is on the racing surface):

`position = rank(car) by: 1. lapCount DESC, 2. splinePosition DESC (within same lapCount)`

Spline position is main-spline progress (0.0–1.0). On the racing surface it is the car's racing-spline projection; in pit lane it is Track's authored `pitSpline → racingSpline` mapping. This reflects progress consistently without nearest-world-point ambiguity.

Tiebreaker: if two cars have identical lapCount AND splinePosition (within 0.001 tolerance), the car with the lower recorded `positionEntryStep` ranks higher. If that is also identical, stable `carId` breaks the tie.

**3. Track Progress Measurement**

`totalDistance` is accumulated from the car's position on the track. Each sim step:

`totalDistance += distance_traveled_this_step`

Forward distance traveled = `max(0, mapped_progress_delta × trackLength)`, with one wrap adjustment when progress crosses 1.0 → 0.0. Reverse movement and lateral movement do not increase the anti-cut accumulator.

**4. Lap Detection**

A lap counts when the car crosses the start/finish line. The car's position is always tracked on the racing spline, even when in the pit lane. When the spline position wraps from ~1.0 to ~0.0, the lap counts.

| Condition | Check | Rationale |
|-----------|-------|-----------|
| Car crosses start/finish line | Track `CrossedLapBoundary(previousMappedProgress, currentMappedProgress)` | Authoritative wrap test over main-spline or authored pit-spline mapping; works even when one tick crosses from 0.94 to 0.01 |
| Minimum distance traveled | `distanceSinceLastLap > trackLength × 0.90` | Anti-cut: must traverse 90% of track |

**Output:** `LapCompleted(carId, lapNumber, lapTime)` event fires when all conditions are met. Fuel and Tire independently snapshot their own per-lap deltas at this boundary; AI Rival and Pit Stop consume those owner-published values for next-lap forecasting.

**Pit lane behavior:** The racing spline is the single source of truth for lap progress. Track maps every pit-spline sample to main-spline progress and exposes `CrossedLapBoundary`; the line crossing inside pit lane counts as a lap completion.

**5. Finish Conditions**

| Condition | Meaning |
|-----------|---------|
| Player car crosses finish line on `totalLaps` | RSM returns `FinishDetected`; Simulation captures PostFinishSnapshot, then transition to Finished resolves only trailing AI |
| Player result is locked | RSM's FinishOrderResolver projects unfinished trailing AI once from Simulation-captured PostFinishSnapshot |
| Player retires (fuel empty + stopped on track) | RSM returns `FinishDetected` with player DNF; Simulation enters Finished and resolver projects all non-DNF unfinished AI without waiting |

**PostFinishSnapshot:** Simulation captures this immutable final post-physics snapshot when RSM returns `FinishDetected`. It contains all 16 CarStates, RSM lap/position state, `playerFinishTime`, `resultKind`, player classification, existing DNF state and tick counters. RSM receives it once for FinishOrderResolver, which returns `ResolvedFinishOrder { entriesByPosition[] }`; every entry carries `carId`, final classification (`Finished` or `DNF`), finish position, and final/projected time. The resolver never re-runs PhysX, Fuel, Tire, Pit, collisions or tactical AI.

**Expected race pace:** For each unfinished AI, FinishOrderResolver uses `expectedRacePace` in metres per second. If the AI has two completed laps, use `trackLength / mean(lastTwoCompletedLapTimes)`. Otherwise, use `trackLength / sessionTargetLapTime`, where `sessionTargetLapTime` is that AI's pre-generated qualifying time for the current track and difficulty. This fallback exists before racing begins, including when the player skips Qualifying.

**MVP approximation:** The FinishOrderResolver projects trailing AI by pace-only. It does not account for AI pit status, low fuel, or worn tires at the moment of the snapshot. This is accepted for MVP because the `PostFinishSnapshot` is captured at the tick the player crosses the finish line on `totalLaps` (or retires); no further physics, fuel, tire, pit, or AI simulation runs after that point. The projection is cosmetic — it determines only the final standing order among trailing AI for the results screen. Future phases may add pit/resource penalties for increased precision.

**6. Race Timer**

| Timer | Start | Stop | Used By |
|-------|-------|------|---------|
| `raceTime` | Countdown ends ("GO") | Player finishes or retires | HUD display, lap time calculation |
| `lapTime[N]` | Previous lap finish (or race start for lap 1) | Current lap finish | HUD display, ghost comparison |
| `countdownTimer` | Countdown entry | Derived from `countdownRemainingTicks × FIXED_DT` | Countdown HUD only; Simulation owns the tick counter and GO transition. |

### States and Transitions

| State | Description | RSM Behavior | Events Fired |
|-------|-------------|--------------|--------------|
| `Idle` | No race active | No tracking | None |
| `Qualifying` | Single-lap qualifying session | Sets `raceMode = Qualifying`; Simulation runs as Racing | QualifyingStarted, QualifyingCompleted |
| `Countdown` | 5-second lights sequence; observes Simulation-owned 300-tick countdown | Derives countdownTimer for HUD from published ticks; never writes GO state |
| `Racing` | Active race | Recalculate positions, detect laps | RaceStarted, LapCompleted, PositionChanged, PitEntry, PitExit |
| `Paused` | Player paused | Freeze all timers | None |
| `Finished` | Player objective complete | Locks player result, runs FinishOrderResolver once from PostFinishSnapshot, starts terminal presentation; returns `TransitionRequest` without writing SimulationState | RaceFinished per car, TransitionRequest |
| `Results` | Post-race | No tracking | None |

**Transition Rules:**

| From | To | Trigger |
|------|----|---------|
| Idle | Countdown | Content emits `RaceLoadReady(RaceMode.Race, gridAssignment)` and Simulation accepts it for a Race-mode load |
| Idle | Qualifying | Player starts qualifying; RSM sets `raceMode = Qualifying` and returns `TransitionRequest(Loading, QualifyingStartRequested)` while Simulation performs Loading before the first Qualifying tick |
| Idle | Idle | Qualifying Results sends `StartRaceRequested`; RSM locks the existing qualifying/skip `gridAssignment` or creates the skip assignment, returns `TransitionRequest(Loading, RaceStartRequested, gridAssignment)`, and remains Idle while Simulation performs Loading |
| Qualifying | Paused | Player presses Pause; retain `raceMode = Qualifying` |
| Paused | Qualifying | Player resumes qualifying; retain `raceMode = Qualifying` |
| Qualifying | Finished | Flying lap completes or fails; set `resultKind = Qualifying`, lock grid result and request Simulation Finished |
| Finished | Results | `resultKind = Qualifying`, `resolutionComplete = true`, and player dismisses terminal presentation; Simulation opens Qualifying Results |
| Results | Results | Qualifying Results sends `StartRaceRequested`; RSM locks `gridAssignment`, sets `raceMode = Race`, and returns `TransitionRequest(Loading, QualifyingComplete, gridAssignment)` while Simulation begins Loading |
| Countdown | Racing | Simulation-owned `countdownRemainingTicks` reaches 0 (GO) |
| Countdown | Paused | Player presses Pause; countdownTimer freezes |
| Paused | Countdown | Player resumes before GO; countdownTimer continues from remaining time |
| Racing | Paused | Player presses Pause |
| Paused | Racing | Player resumes |
| Racing | Finished | Player crosses finish line on `totalLaps` or retires; return `FinishDetected`, receive Simulation-captured PostFinishSnapshot, run FinishOrderResolver, and return `TransitionRequest(Finished, resolvedFinishOrder)` |
| Finished | Results | `resultKind = Race`, `resolutionComplete = true`, and player dismisses terminal presentation |
| Paused | Results | Player selects Return to Menu before Finished; set `resultClassification = Forfeit`, retain `forfeitLapCount` and `raceTimeAtForfeit`, omit final position, and fire `RaceAborted(Forfeit)` |
| Results | Idle | Continue/Back to Title only after Content emits `ContentUnloadComplete` and Simulation accepts the lifecycle transition |
| Results | Results | Next Race request; RSM returns a Loading TransitionRequest while Simulation performs Loading without an intermediate Idle state |

### Race Events

| Event | Payload | Fired When | Consumers |
|-------|---------|------------|-----------|
| `RaceStarted` | none | Countdown ends | Ghost Recording, HUD, AI Rival |
| `QualifyingStarted` | DifficultyProfile ID, race seed | Simulation accepts `RaceLoadReady(RaceMode.Qualifying)` | Qualifying, HUD, AI Rival |
| `LapCompleted` | carId, lapNumber, lapTime, position | Car crosses finish line | HUD, Fuel, Tire, AI Rival, Ghost Recording |
| `PositionChanged` | carId, oldPosition, newPosition | Position recalculated | HUD, AI Rival |
| `PitEntry` | carId, raceTime | Car enters pit lane | Fuel, Tire, Pit Stop, HUD, AI Rival |
| `PitExit` | carId, raceTime | Car exits pit lane | Fuel, Tire, Pit Stop, HUD, AI Rival |
| `TransitionRequest` | targetSimulationState, reason, resultKind, `resolvedFinishOrder` when target is Finished, `gridAssignment` when reason is QualifyingComplete | RSM completes final-state evaluation | Simulation Architecture |
| `RaceFinished` | carId, position, totalTime, `lapTimes[totalLaps]` | Car completes `totalLaps` | HUD, Ghost Recording, Results |
| `RaceAborted` | reason, resultClassification, forfeitLapCount, raceTimeAtForfeit | Player selects Return to Menu before Finished | Ghost Recording, HUD, Results |

### Interactions with Other Systems

| System | Consumes Events | Produces Data for RSM | Interface |
|--------|----------------|----------------------|-----------|
| **Simulation Architecture** | — | TickStartSnapshot, sim_time, SimulationState | RSM evaluates final post-physics CarState in Simulation step 10 and returns `TransitionRequest` for Simulation to consume before the current snapshot publishes. |
| **Vehicle Physics** | — | final `CarState` per car | RSM reads final post-physics CarState in Simulation step 10 before the current tick snapshot publishes. |
| **Fuel System** | LapCompleted, PitEntry, PitExit | — | Fuel snapshots lap deltas at LapCompleted and fills during InPitBox; PitExit resumes normal driving consumption. |
| **Tire System** | LapCompleted, PitEntry, PitExit | — | Tire snapshots lap deltas at LapCompleted, resets at InPitBox 2s, and resumes normal wear after PitExit. |
| **AI Rival** | PositionChanged, LapCompleted, PitEntry, PitExit | — | AI adjusts strategy |
| **HUD** | PositionChanged, LapCompleted, RaceFinished | — | HUD displays state |
| **Ghost Recording** | RaceStarted, LapCompleted, RaceFinished | — | Ghost marks splits |
| **Pit Stop** | PitEntry, PitExit | — | Pit manages service |
| **Qualifying** | — | qualifying result and grid-order candidates | RSM creates the immutable final assignment |
| **Track** | — | trackLength, spline data | RSM reads for distance |

## Formulas

**Current live values:** see race configuration.

### Position Ranking

`position = rank(cars, by: lapCount DESC, splinePosition DESC, positionEntryStep ASC, carId ASC)`

When a car first enters its current tied spline-position bucket, RSM stores the current `simulationStepCount` as `positionEntryStep`.

**Output Range:** 1 (leading) to 16 (last).

### Lap Time

`lapTime[N] = raceTime_at_lap_N_finish - raceTime_at_lap_N_start`

**Output Range:** ~70–80s per lap (track-dependent).

### Pit Delta (deferred telemetry)

`pit_delta` is not used by MVP race resolution. If telemetry is added later, it is derived from recorded pit-in/pit-out timestamps; it does not affect position, lap counting, or results.

This is deferred telemetry only and has no MVP output or gameplay effect.

## Edge Cases

- **Two cars cross finish line same step:** Tiebreaker: car with higher spline position at previous step ranks first.
- **Car reverses across start/finish:** Distance check prevents counting (must traverse 90% of track forward).
- **Car cuts chicane:** Minimum distance check fails → lap not counted.
- **Player retires mid-race:** `FinishDetected` fires with player classification `DNF`. Race resolution continues for AI; Results show DNF.
- **Player pauses during countdown:** Countdown timer pauses. Resume continues from paused time.
- **All AI finish before player:** Race continues for player. Finished AI positions locked.
- **Car is lapped:** No special handling. Position calculation works identically.
- **Ghost Recording fails to record lap:** Lap time still counted. Ghost data missing for that lap only.
- **Car exits pit lane ahead of another car:** Spline position correctly reflects physical position — car that is physically ahead has higher spline position and ranks higher.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Simulation Architecture** | Bidirectional | sim_time, car positions, TransitionRequest consumption | Hard — RSM reads per step and submits lifecycle requests |
| **Vehicle Physics** | Inbound | final `CarState` and Track-mapped spline progress | Hard — RSM reads post-physics state for distance and ranking |
| **Fuel** | Outbound | LapCompleted, PitEntry, PitExit | Hard — Fuel consumes per lap |
| **Tire** | Outbound | LapCompleted, PitEntry, PitExit | Hard — Tire wears per lap |
| **AI Rival** | Bidirectional | PositionChanged, LapCompleted | Hard — AI adjusts strategy |
| **HUD** | Outbound | PositionChanged, LapCompleted, RaceFinished | Hard — HUD displays state |
| **Ghost Recording** | Outbound | RaceStarted, LapCompleted, RaceFinished | Hard — Ghost marks splits |
| **Pit Stop** | Outbound | PitEntry, PitExit | Hard — Pit manages service |
| **Qualifying** | Inbound | grid positions | Hard — RSM initializes positions |
| **Track** | Inbound | trackLength, spline | Hard — RSM reads for distance |
| **Grid & Start** | Outbound | immutable `GridAssignment` | Hard — RSM creates the assignment consumed during loading |
| **Content Pipeline** | Bidirectional | RaceLoadReady / ContentLoadError; ContentLoadRequest through Simulation | Hard — loading gates session start |
| **Car Definition Data** | Inbound | team_id → grid composition | Hard — RSM needs to know which cars are on grid |
| **UI Menu** | Inbound | StartRaceRequested, ReturnToMenuRequested | Hard — UI submits lifecycle requests |
| **Audio** | Outbound | lap, final-lap, finish events | Hard — drives stings |

## Tuning Knobs

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Race laps | 5 | 3–10 | Too short (no strategy) | Too long (boring) |
| Anti-cut threshold | 90% | 80–95% | Cuts not detected | legitimate shortcuts fail |
| Countdown duration | 5.0s / 300 ticks | Fixed for MVP; changes require design review | Too fast (no prep) | Too slow (boring) |

## Visual/Audio Requirements

- **Lap counter:** HUD shows "LAP 3/5" during race.
- **Position indicator:** HUD shows "P4" during race.
- **Race timer:** HUD shows elapsed time.
- **Final lap:** Audio sting triggers when lapCount = totalLaps - 1.
- **Finish:** Audio sting triggers when player crosses finish line.

## UI Requirements

> **📌 UX Flag — Race Session Manager**: This system contributes data to the race HUD. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for the race HUD before writing epics.

## Acceptance Criteria

- **GIVEN** a car crosses start/finish line on lap 3 of a 5-lap race, **WHEN** lapCount is checked, **THEN** it is 3.
- **GIVEN** two cars with identical lapCount and splinePosition within 0.001, **WHEN** tiebreak runs, **THEN** the car with the lower `positionEntryStep` ranks higher; stable `carId` breaks an exact tie.
- **GIVEN** Countdown starts, **WHEN** 300 unpaused simulation ticks complete, **THEN** RSM observes the GO boundary and publishes RaceStarted; Simulation owns the Countdown → Racing state transition.
- **GIVEN** player crosses finish line on `totalLaps`, **WHEN** state is checked, **THEN** RSM returns FinishDetected and Simulation enters Finished.
- **GIVEN** player finishes, **WHEN** FinishOrderResolver consumes PostFinishSnapshot, **THEN** it runs once, preserves completed/DNF drivers, projects only trailing AI, and sets `resolutionComplete = true`.
- **GIVEN** player retires (fuel empty and stopped), **WHEN** race state is checked, **THEN** FinishDetected fires with resultClassification DNF; RaceAborted is reserved for Forfeit.
- **GIVEN** car enters pit lane, **WHEN** PitEntry event fires, **THEN** Fuel, Tire, Pit Stop, HUD, and AI Rival receive the event.
- **GIVEN** car exits pit lane, **WHEN** PitExit event fires, **THEN** Fuel, Tire, Pit Stop, HUD, and AI Rival receive the event.
- **GIVEN** position changes from P4 to P3, **WHEN** PositionChanged fires, **THEN** HUD updates and AI Rival receives event.
- **GIVEN** Qualifying completes, **WHEN** RSM creates `gridAssignment`, **THEN** the immutable carId → gridSlot list travels through `TransitionRequest(Loading, QualifyingComplete, gridAssignment)` and is not recalculated by Grid & Start.
- **GIVEN** player starts Qualifying, **WHEN** RSM accepts the request, **THEN** it returns `TransitionRequest(Loading, QualifyingStartRequested)`; Simulation enters Racing/GameplayQualifying only after `RaceLoadReady(RaceMode.Qualifying)` and no Countdown event is emitted.
- **GIVEN** Qualifying Finished Presentation is dismissed, **WHEN** `resolutionComplete = true`, **THEN** Simulation enters Results with `resultKind = Qualifying`; RSM does not return to Idle before the Start Race or unload decision.
- **GIVEN** Results Continue/Back requests a return to Title, **WHEN** Content unloading is incomplete, **THEN** RSM remains Results; Idle becomes valid only after `ContentUnloadComplete`.
- **GIVEN** the player selects Return to Menu while Countdown or Racing is paused, **WHEN** the request is accepted, **THEN** resultClassification is Forfeit, final position is null, and RaceAborted(Forfeit) is emitted without resuming simulation.
- **GIVEN** a race load is in progress, **WHEN** Cancel or Back is pressed, **THEN** RSM does not abort the load; it waits for RaceLoadReady or ContentLoadError.

## Open Questions

- **Lapped traffic:** MVP remains pure position-based; no blue-flag behavior is introduced.
- **Safety car:** Safety-car mechanics are out of MVP scope.
- **Photo finish UI:** MVP uses deterministic tiebreak data and ordinary Results presentation; no special photo-finish screen.
- **Retirement animation:** VFX owns the visual indication; RSM emits DNF state and does not prescribe the effect.
