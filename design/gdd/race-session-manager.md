# Race Session Manager

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-22
> **Implements Pillar**: Every Short Race Matters

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
| `lapCount` | int | 0–5 | Laps completed by this car. Increments at start/finish line crossing. |
| `position` | int | 1–16 | Current race position. Recalculated every sim step. |
| `raceTime` | float | 0.0–∞ | Elapsed race time in seconds. Starts at countdown end. |
| `lapTimes` | float[] | 0–5 entries | Individual lap times. Populated on each lap completion. |
| `totalDistance` | float | 0.0–∞ | Cumulative distance traveled in meters. Primary position metric. |
| `isFinished` | bool | false/true | Set true when car crosses finish line on lap 5. |
| `isPitting` | bool | false/true | Set true when car enters pit lane, false on exit. |

**2. Position Calculation**

Position is determined by ranking all 16 cars using spline position (where the car is on the racing surface):

`position = rank(car) by: 1. lapCount DESC, 2. splinePosition DESC (within same lapCount)`

Spline position is the car's projection onto the racing spline (0.0–1.0), regardless of whether the car is on the racing surface or in the pit lane. This reflects the car's actual position on the track.

Tiebreaker: if two cars have identical lapCount AND splinePosition (within 0.001 tolerance), the car that reached that position first ranks higher.

**3. Track Progress Measurement**

`totalDistance` is accumulated from the car's position on the track. Each sim step:

`totalDistance += distance_traveled_this_step`

Distance traveled = magnitude of position delta between sim steps.

**4. Lap Detection**

A lap counts when the car crosses the start/finish line. The car's position is always tracked on the racing spline, even when in the pit lane. When the spline position wraps from ~1.0 to ~0.0, the lap counts.

| Condition | Check | Rationale |
|-----------|-------|-----------|
| Car crosses start/finish line | `previousSplinePosition > 0.95 AND currentSplinePosition < 0.05` | Primary detection — works for racing surface and pit lane |
| Minimum distance traveled | `distanceSinceLastLap > trackLength × 0.90` | Anti-cut: must traverse 90% of track |

**Output:** `LapCompleted(carId, lapNumber, lapTime)` event fires when all conditions met.

**Pit lane behavior:** The racing spline is the single source of truth for lap progress. When a car enters the pit lane, its spline position continues to advance. The line crossing inside the pit lane counts as a lap completion. This is consistent with F1 timing — the position is determined at the moment of crossing.

**5. Finish Conditions**

| Condition | Meaning |
|-----------|---------|
| Player car crosses finish line on lap 5 | Race ends for player → transition to Results |
| All 16 cars finish OR 30s elapse after player finishes | Race ends for all → force-finish remaining cars |
| Player retires (fuel empty + stopped on track) | Race ends for player → DNF result |

**6. Race Timer**

| Timer | Start | Stop | Used By |
|-------|-------|------|---------|
| `raceTime` | Countdown ends ("GO") | Player finishes or retires | HUD display, lap time calculation |
| `lapTime[N]` | Previous lap finish (or race start for lap 1) | Current lap finish | HUD display, ghost comparison |
| `countdownTimer` | Scene loaded | Reaches 0.0 | Countdown HUD, input gate |

### States and Transitions

| State | Description | RSM Behavior | Events Fired |
|-------|-------------|--------------|--------------|
| `Idle` | No race active | No tracking | None |
| `Countdown` | 3-2-1-GO | Initialize all car state | None |
| `Racing` | Active race | Recalculate positions, detect laps | RaceStarted, LapCompleted, PositionChanged, PitEntry, PitExit |
| `Paused` | Player paused | Freeze all timers | None |
| `Finished` | Race complete for player | Continue tracking AI | RaceFinished per car |
| `Results` | Post-race | No tracking | None |

**Transition Rules:**

| From | To | Trigger |
|------|----|---------|
| Idle | Countdown | Scene loaded, all cars spawned |
| Countdown | Racing | Countdown timer reaches 0.0 |
| Racing | Paused | Player presses Pause |
| Paused | Racing | Player resumes |
| Racing | Finished | Player crosses finish line on lap 5 |
| Finished | Results | All cars finish OR 30s timeout |
| Paused | Results | Player quits mid-race (forfeit) |

### Race Events

| Event | Payload | Fired When | Consumers |
|-------|---------|------------|-----------|
| `RaceStarted` | none | Countdown ends | Ghost Recording, HUD, AI Rival |
| `LapCompleted` | carId, lapNumber, lapTime, position | Car crosses finish line | HUD, Fuel, Tire, AI Rival, Ghost Recording |
| `PositionChanged` | carId, oldPosition, newPosition | Position recalculated | HUD, AI Rival |
| `PitEntry` | carId, raceTime | Car enters pit lane | Fuel, Tire, HUD, AI Rival |
| `PitExit` | carId, raceTime | Car exits pit lane | Fuel, Tire, HUD, AI Rival |
| `RaceFinished` | carId, position, totalTime, lapTimes[] | Car completes lap 5 | HUD, Ghost Recording, Results |
| `RaceAborted` | reason | Player quits or car retired | Ghost Recording, HUD |

### Interactions with Other Systems

| System | Consumes Events | Produces Data for RSM | Interface |
|--------|----------------|----------------------|-----------|
| **Simulation Architecture** | — | sim_time, car positions | RSM reads per step |
| **Vehicle Physics** | — | car.position, car.forwardDot | RSM reads for distance |
| **Fuel System** | LapCompleted, PitEntry, PitExit | — | Fuel resets on pit exit |
| **Tire System** | LapCompleted, PitEntry, PitExit | — | Tire resets on pit exit |
| **AI Rival** | PositionChanged, LapCompleted, PitEntry, PitExit | — | AI adjusts strategy |
| **HUD** | PositionChanged, LapCompleted, RaceFinished | — | HUD displays state |
| **Ghost Recording** | RaceStarted, LapCompleted, RaceFinished | — | Ghost marks splits |
| **Pit Stop** | PitEntry, PitExit | — | Pit manages service |
| **Qualifying** | — | grid positions | RSM initializes positions |
| **Track** | — | trackLength, spline data | RSM reads for distance |

## Formulas

**Current live values:** see race configuration.

### Position Ranking

`position = rank(cars, by: lapCount DESC, totalDistance DESC)`

**Output Range:** 1 (leading) to 16 (last).

### Lap Time

`lapTime[N] = raceTime_at_lap_N_finish - raceTime_at_lap_N_start`

**Output Range:** ~70–80s per lap (track-dependent).

### Pit Delta (F1 formula)

`pit_delta = (pit_in_lap_time + pit_out_lap_time) - (2 × standard_lap_time)`

**Output Range:** ~20–25s (track-dependent).

## Edge Cases

- **Two cars cross finish line same step:** Tiebreaker: car with higher spline position at previous step ranks first.
- **Car reverses across start/finish:** Distance check prevents counting (must traverse 90% of track forward).
- **Car cuts chicane:** Minimum distance check fails → lap not counted.
- **Player retires mid-race:** RaceAborted fires. Race continues for AI. Results show DNF.
- **Player pauses during countdown:** Countdown timer pauses. Resume continues from paused time.
- **All AI finish before player:** Race continues for player. Finished AI positions locked.
- **Car is lapped:** No special handling. Position calculation works identically.
- **Ghost Recording fails to record lap:** Lap time still counted. Ghost data missing for that lap only.
- **Car exits pit lane ahead of another car:** Spline position correctly reflects physical position — car that is physically ahead has higher spline position and ranks higher.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Simulation Architecture** | Inbound | sim_time, car positions | Hard — RSM reads per step |
| **Vehicle Physics** | Inbound | car.position, forwardDot | Hard — RSM reads for distance |
| **Fuel** | Outbound | LapCompleted, PitEntry, PitExit | Hard — Fuel consumes per lap |
| **Tire** | Outbound | LapCompleted, PitEntry, PitExit | Hard — Tire wears per lap |
| **AI Rival** | Outbound | PositionChanged, LapCompleted | Hard — AI adjusts strategy |
| **HUD** | Outbound | PositionChanged, LapCompleted, RaceFinished | Hard — HUD displays state |
| **Ghost Recording** | Outbound | RaceStarted, LapCompleted, RaceFinished | Soft — Ghost marks splits |
| **Pit Stop** | Outbound | PitEntry, PitExit | Hard — Pit manages service |
| **Qualifying** | Inbound | grid positions | Hard — RSM initializes positions |
| **Track** | Inbound | trackLength, spline | Hard — RSM reads for distance |

## Tuning Knobs

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Race laps | 5 | 3–10 | Too short (no strategy) | Too long (boring) |
| Finish timeout | 30s | 15–60s | AI forced too early | Race drags on |
| Anti-cut threshold | 90% | 80–95% | Cuts not detected | legitimate shortcuts fail |
| Countdown duration | 3.0s | 2–5s | Too fast (no prep) | Too slow (boring) |

## Visual/Audio Requirements

- **Lap counter:** HUD shows "LAP 3/5" during race.
- **Position indicator:** HUD shows "P4" during race.
- **Race timer:** HUD shows elapsed time.
- **Final lap:** Audio sting triggers when lapCount = totalLaps - 1.
- **Finish:** Audio sting triggers when player crosses finish line.

## UI Requirements

> **📌 UX Flag — Race Session Manager**: This system contributes data to the race HUD. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for the race HUD before writing epics.

## Acceptance Criteria

- **GIVEN** a car crosses start/finish line on lap 3, **WHEN** lapCount is checked, **THEN** it is 3.
- **GIVEN** two cars with identical lapCount and totalDistance, **WHEN** tiebreak runs, **THEN** car that reached distance first ranks higher.
- **GIVEN** player crosses finish line on lap 5, **WHEN** state is checked, **THEN** state is Finished.
- **GIVEN** player finishes and 30s elapse, **WHEN** remaining AI are checked, **THEN** they are force-finished.
- **GIVEN** player retires (fuel empty), **WHEN** race state is checked, **THEN** RaceAborted fires and result is DNF.
- **GIVEN** car enters pit lane, **WHEN** PitEntry event fires, **THEN** Fuel and Tire systems receive the event.
- **GIVEN** car exits pit lane, **WHEN** PitExit event fires, **THEN** Fuel and Tire systems reset.
- **GIVEN** position changes from P4 to P3, **WHEN** PositionChanged fires, **THEN** HUD updates and AI Rival receives event.

## Open Questions

- **Lapped traffic:** Should lapped cars be blue-flagged and forced to yield? Or is it pure position-based?
- **Safety car:** Should MVP include safety car mechanics? Or is it Alpha+?
- **Photo finish UI:** Should there be a special UI for close finishes (within 0.1s)?
- **Retirement animation:** When a car retires, should there be a visual indication (car stops, smoke, etc.)?
