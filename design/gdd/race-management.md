# Race Management

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Foundation — Race Flow

## Overview

Race Management is the central authority for all race-state data during a live race. It owns the current position grid, lap counters, DNF registry, race timing, and the internal race sub-state machine (Showing Grid → Countdown → GreenFlag → Racing → Checkered). It does NOT own race configuration (lap count, grid size, track id) — that is provided by the calling mode (Single Race, Championship) via `RaceConfiguration`.

The system is **mode-agnostic**: it accepts a `RaceConfiguration`, publishes `RaceEvent`s via the Event Bus, and exposes `getResults()` at the end. Single Race and Championship are different configurations, not different code paths. The GSM remains in `Racing` throughout all sub-states; Race Management handles sub-state transitions internally.

---

## Developer Fantasy

The developer calls `raceManager.init(config)` and `raceManager.startRace()`. From that point, Race Management manages every aspect of race progression — lap counting, position sorting, DNF detection, and final results — all through its fixed pipeline tick. A new track or race format requires a new config, not new race logic.

The debug overlay shows current race sub-state, the live position grid (updated every tick), per-car lap times, and the DNF list. The developer can inject a fake `RaceConfiguration` and test a full race cycle in under 2 seconds by hot-reloading the tick rate.

---

## Detailed Design

### Core Rules

**1. Sub-state machine.** Race Management owns an internal state machine that progresses linearly through the race lifecycle. The GSM remains in `Racing` throughout — Race Management's sub-states are invisible to the rest of the game.

**2. Single authority for race data.** Position, lap count, DNF status, and timing are owned by Race Management. No other system writes to these values. Other systems (HUD, Audio, Camera) read them via Event Bus events or a read-only snapshot.

**3. Tick-driven.** Race Management runs last in the pipeline (after Tire Wear), processing one tick for all cars in sequence. No async timers, no setTimeout — only the fixed tick.

**4. Event-driven output.** State transitions, position changes, and DNF detections are emitted as Event Bus events. Consumers (HUD, Camera, Audio) subscribe and react independently.

**5. Fail-fast on misconfiguration.** An invalid `RaceConfiguration` (lapCount = 0, gridSize > available positions, unknown trackId) throws `ConfigError` at init. A race never starts with bad configuration.

### Race State Machine

```
GSM: Racing
  └── Race Management sub-states:

      Showing Grid ──→ Countdown ──→ GreenFlag ──→ Racing ──→ Checkered
           │                                                   │
           │   (auto-skip 10s)                                  │
           └────────────────────────────────────────────────────┘
                      (player finishes all laps or DNF)
```

| Sub-state        | Description                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Showing Grid** | Camera is in Grid mode (ArcRotateCamera, 30m above, 40m ahead). Race Management orders grid positions from `RaceConfiguration`, locks all cars to their grid positions. Player acclimates to the grid layout. |
| **Countdown**    | Camera switches to player's default (cockpit or chase). Car locked at 0 km/h, steering wheel animates. Lights sequence: 5 red → 4 → 3 → 2 → 1 → GREEN.                                                        |
| **GreenFlag**    | All cars unlocked. Race timer starts. Normal racing physics active for all cars.                                                                                                                              |
| **Racing**       | Race is live. Position grid updates every tick, lap counting active, DNF monitoring active.                                                                                                                   |
| **Checkered**    | Player completed all laps OR player DNF. Results computed for all 8 cars from total distance at checkered moment. Race timer stops. `endRace()` called → GSM transition to `PostRace`.                        |

**Transitions:**

- `Showing Grid → Countdown`: Player presses SKIP button (or auto-skip after 10s).
- `Countdown → GreenFlag`: Lights sequence completes (GREEN). All cars unlocked.
- `GreenFlag → Racing`: Immediate (first tick after GREEN).
- `Racing → Checkered`: Player lap count equals `RaceConfiguration.lapCount` OR player DNF detected.
- `Checkered → (GSM PostRace)`: `RaceManagement.endRace()` calls `gsm.transition('PostRace')`.

### Position & Lap Tracking

**Position grid** is computed every tick after all other systems have run:

```typescript
function updatePositions(): void {
  const trackLength = trackConfig.spline.length; // total meters

  const sorted = activeCars
    .filter((c) => !dnfRegistry.has(c.id))
    .map((c) => {
      const lap = lapCount.get(c.id) ?? 0;
      const splinePos = c.physics.splinePosition; // 0..trackLength from Physics
      const totalDist = lap * trackLength + splinePos;
      return { carId: c.id, totalDist, lap, splinePos };
    })
    .sort((a, b) => b.totalDist - a.totalDist); // descending = most distance first

  sorted.forEach((entry, index) => {
    positionGrid.set(entry.carId, index + 1); // 1-based position
  });
}
```

**Lap detection** uses spline position wrap-around. The finish line is at spline position 0:

```typescript
function updateLaps(carId: string): void {
  const current = cars.get(carId).physics.splinePosition;
  const prev = prevSplinePos.get(carId) ?? 0;

  // Car crossed the start/finish line moving forward
  // (wrapped from near end of spline to near beginning)
  if (prev > trackLength * 0.9 && current < trackLength * 0.1) {
    const newLap = (lapCount.get(carId) ?? 0) + 1;
    lapCount.set(carId, newLap);

    if (carId === playerCarId) {
      // Record lap time
      recordLapTime(carId, newLap);

      // Check if race should end
      if (newLap >= raceConfig.lapCount) {
        emit("race.checkered", { carId, lap: newLap, results: buildResults() });
        setSubState("Checkered");
      }
    }

    emit("car.lap.completed", {
      carId,
      lap: newLap,
      lapTime: lastLapTime(carId),
    });
  }

  // Crossing backward (wrong direction) is ignored — no lap counted
  // Crossing and then reversing across the line is also ignored
  // Only forward crossings trigger lap detection

  prevSplinePos.set(carId, current);
}
```

**Lap time** is measured from one finish line crossing to the next. The first crossing (safety car to green) starts the timer but does not count as a lap — actual laps start at the second crossing.

**Best lap time** is tracked per car and available in results.

### DNF Detection

```typescript
// Runtime state (module-level Maps and Sets):
//   lapCount, positionGrid, dnfRegistry, pendingDNF, prevSplinePos,
//   bestLaps, pitStopCount (Map<string, number>), pitTotalTime (Map<string, number>)
// All initialized in init().

// Reentrancy: init() may be called multiple times (Race Again).
// All eventBus.on() calls below must use off() before on() to prevent
// listener duplication. Each subscriber pattern:
//   eventBus.off('car.fuel_empty', ...).on('car.fuel_empty', ...)

// Event subscriptions at init:
eventBus.on("car.fuel_empty", (event) => {
  pendingDNF.add(event.carId); // car is coasting, not yet DNF
});

eventBus.on("car.stopped", (event) => {
  // Physics emits car.stopped when velocity ≈ 0 for a car with no engine power
  if (pendingDNF.has(event.carId)) {
    // Check exceptions before marking DNF
    const car = cars.get(event.carId);

    // Exception 1: Car is in pit entry zone (can still coast to garage → refuel)
    if (isInPitEntryZone(car)) return;

    // Exception 2: Car is on last lap and finish line is ahead
    const currentLap = lapCount.get(event.carId) ?? 0;
    const remaining = raceConfig.lapCount - currentLap;
    if (remaining <= 1 && distanceToFinishLine(car) < currentSpeed(car) * 5) {
      return; // let the car coast to the line
    }

    // No exception applies → DNF
    registerDNF(event.carId, "fuel_empty");
  }
});

eventBus.on("car.stalled_in_pit", (event) => {
  // Car entered pit entry zone but could not reach garage (velocity ≈ 0 mid-pit)
  registerDNF(event.carId, "stalled_in_pit");
});

eventBus.on("car.tire_blown", (_event) => {
  // Tire blowout: logged but never causes DNF automatically.
  // Player can limp at 15% grip, decide to pit or finish.
  // Only fuel-empty coast-to-stop triggers DNF.
});

eventBus.on("pit.exit", (event) => {
  // Car completed a pit stop — increment counter and record total time
  const carId = event.carId;
  pitStopCount.set(carId, (pitStopCount.get(carId) ?? 0) + 1);
  if (event.totalTimeMs !== undefined) {
    pitTotalTime.set(carId, event.totalTimeMs);
  }
});
```

```typescript
function registerDNF(carId: string, reason: DNFReason): void {
  dnfRegistry.set(carId, reason);
  positionGrid.delete(carId); // car disappears from the live grid
  emit("car.dnf", { carId, reason });

  // If the DNF car is the player, end the race immediately
  if (carId === playerCarId) {
    setSubState("Checkered");
  }
}
```

**Fuel-empty rule summary:**

| Scenario                                                                  | Result                                    |
| ------------------------------------------------------------------------- | ----------------------------------------- |
| Fuel empty → engine dead → car coasts to a stop on track                  | DNF (`fuel_empty`)                        |
| Fuel empty → engine dead → car coasts into pit entry zone, reaches garage | No DNF — Pit Stop refuels, race continues |
| Fuel empty → engine dead → car coasts into pit but stops before garage    | DNF (`stalled_in_pit`)                    |
| Fuel empty → engine dead → car coasts across finish line on last lap      | No DNF — race ends normally               |
| Tire blowout → grip at 15% → car still has engine power                   | No DNF — player decides                   |

### Race End & Results

The race ends when **either** condition is met:

1. **Player crosses finish line on lap N** where `N = raceConfig.lapCount` — race ends, results computed for all 8 cars
2. **Player DNF** — fuel empty + coast to stop (or stalled in pit)

When the race ends (Checkered sub-state):

```typescript
function endRace(): void {
  const results = buildResults();
  raceResult = results;
  emit("race.completed", { results });
  gsm.transition("PostRace");
}
```

On player DNF (condition 2): positions are calculated for ALL 8 cars based on their total distance at the moment the checkered flag fires. The player's car is placed last among non-DNF cars, or if all cars have more distance, the player is P8.

```typescript
function buildResults(): RaceResult[] {
  const trackLength = trackConfig.spline.length;

  return allCarIds
    .map((carId) => {
      const lap = lapCount.get(carId) ?? 0;
      const dnf = dnfRegistry.get(carId);
      return {
        carId,
        teamId: cars.get(carId).teamId,
        finalPosition: positionGrid.get(carId) ?? 8,
        totalTime: raceTime, // ms since GreenFlag
        bestLapTime: bestLaps.get(carId) ?? 0,
        lapCount: lap,
        dnf: !!dnf,
        dnfReason: dnf ?? undefined,
        pitStops: pitStopCount.get(carId) ?? 0,
        pitTotalTime: pitTotalTime.get(carId) ?? 0,
      };
    })
    .sort((a, b) => a.finalPosition - b.finalPosition);
}
```

Results are read-only after endRace(). `RaceManagement.getResults()` returns the same object — no recomputation.

### Race Timing

- **Race clock** starts at GreenFlag and stops at Checkered. Measured in game ticks (1/60 s each).
- **Lap time** starts at first finish line crossing and resets at each subsequent crossing.
- **Best lap** is the minimum `lapTime` across all completed laps (excluding the first crossing which is a sector, not a lap).
- **Pit total time** is recorded by Pit Stop per car and reported in results.

### Events

Race Management subscribes to:

| Event                           | Emitter   | Reaction                                                 |
| ------------------------------- | --------- | -------------------------------------------------------- |
| `gsm.state.entered` (to=Racing) | GSM       | `init()` config → set sub-state to Showing Grid          |
| `car.fuel_empty`                | Fuel      | Mark car for pending DNF (coasting)                      |
| `car.stopped`                   | Physics   | If pending DNF → check exceptions → register DNF or skip |
| `car.stalled_in_pit`            | Pit Stop  | Register DNF with reason `stalled_in_pit`                |
| `car.tire_blown`                | Tire Wear | Log only — no DNF action                                 |
| `pit.exit`                      | Pit Stop  | Increment pit stop counter, record total pit time        |

Race Management emits:

| Event               | Payload                                 | Consumers                                                        |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| `race.starting`     | `{ trackId, lapCount, gridSize }`       | Menu, HUD                                                        |
| `race.green.flag`   | `{ raceId, timestamp }`                 | HUD (start timer), Camera (unlock), AI (go)                      |
| `car.lap.completed` | `{ carId, lap, lapTime }`               | HUD (lap counter), Audio (lap trigger)                           |
| `race.checkered`    | `{ carId, lap, results: RaceResult[] }` | HUD (top 3 + player), Camera (drone transition), Audio (fanfare) |
| `race.completed`    | `{ results: RaceResult[] }`             | PostRace, Single Race, Telemetry Recorder                        |
| `car.dnf`           | `{ carId, reason }`                     | HUD (gray out), Audio (announcement), AI (ignore car)            |
| `position.changed`  | `{ carId, oldPos, newPos }`             | HUD (position indicator), Audio (overtake sound)                 |

The `position.changed` event is throttled: emitted only when a car's position changes, not every tick. Useful for HUD updates and audio cues without flooding the Event Bus.

---

## States & Transitions

| State        | Description                                                                                |
| ------------ | ------------------------------------------------------------------------------------------ |
| **Inactive** | No race configured.                                                                        |
| **Ready**    | `RaceConfiguration` loaded, awaiting `startRace()`.                                        |
| **Racing**   | Race sub-state machine active (Showing Grid → Countdown → GreenFlag → Racing → Checkered). |
| **Complete** | Results computed. `getResults()` available. Ready for PostRace.                            |

Transition flow: `Inactive → Ready` (on `init(config)`) → `Ready → Racing` (on `startRace()`) → `Racing → Complete` (on `endRace()`).

---

## Formulas

**Total distance (for position sorting):**

```
totalDist = completedLaps × trackLength + splinePosition
```

**Lap wrap-around detection:**

```
prevPos > trackLength × 0.9 AND currentPos < trackLength × 0.1
  → lap_increment
```

**Race time:**

```
raceTime = tickCount × fixed_dt
```

where `fixed_dt = 1/60 s`, `tickCount` starts at GreenFlag, stops at Checkered.

---

## System Interactions

| System               | Interaction                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Physics/Handling** | Provides `splinePosition` per car each tick (0..trackLength). Emits `car.stopped` when velocity ≈ 0 for engine-dead cars.             |
| **Event Bus**        | Primary I/O channel: subscribes to events from Fuel, Tire Wear, Pit Stop, Physics, GSM; emits race events for HUD, Camera, Audio, AI. |
| **GSM**              | Receives `gsm.state.entered` (Racing → init). Calls `gsm.transition('PostRace')` via `endRace()`.                                     |
| **Fuel**             | Emits `car.fuel_empty` — Race Management marks pending DNF.                                                                           |
| **Tire Wear**        | Emits `car.tire_blown` — logged, no DNF action.                                                                                       |
| **Pit Stop**         | Emits `car.stalled_in_pit` — Race Management registers DNF. Records pit stop timing data consumed in results.                         |
| **Collision**        | Emits `collision.impact` — logged in Phase 1 for informational purposes. No gameplay consequence.                                     |
| **AI Driver**        | Reads positions (throttled) for overtaking decisions.                                                                                 |
| **HUD**              | Subscribes to `car.lap.completed`, `car.dnf`, `position.changed`, `race.green.flag`.                                                  |
| **Camera**           | Subscribes to `race.checkered` (drone transition).                                                                                    |
| **Audio**            | Subscribes to `car.lap.completed`, `car.dnf`, `position.changed`, `race.checkered`.                                                   |
| **Data & Config**    | Provides tuning knobs (none currently — race parameters are in RaceConfiguration).                                                    |
| **PostRace**         | Receives `race.completed` → reads `getResults()` → renders standings.                                                                 |

---

## Edge Cases

| Case                                                   | Behaviour                                                                                                                                                                                           |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Car spins at start line**                            | Spline position stays near 0 for many frames. Wrap-around detection not triggered — `prev > 0.9*trackLength` is false.                                                                              |
| **Car crosses finish line backward**                   | Spline position moves from low to high (not high to low). Wrap-around condition `prev > high AND current < low` is false. No lap counted.                                                           |
| **Player DNF on first lap**                            | Race ends immediately. Results computed with whatever distance each car had covered. Player is placed last among starters.                                                                          |
| **All AI cars DNF before player**                      | Race continues normally until player finishes all laps or DNF. No special handling needed — position grid filters DNF cars.                                                                         |
| **Player DNF at exact moment of finish line crossing** | If player crosses line on last lap with fuel empty, `car.lap.completed` fires before `car.stopped` (pipeline order: Fuel → Tire → Race Mgmt). Race ends before DNF check. Safe.                     |
| **Multiple position changes in one tick**              | `position.changed` event fires for each affected car. Throttling prevents Event Bus flood — only 8 cars, max 7 position changes/tick.                                                               |
| **Race config with 0 laps**                            | `ConfigError` at init. Race never starts.                                                                                                                                                           |
| **Race config with unknown trackId**                   | `ConfigError` at init. Track + Environment validates the id exists in its registry.                                                                                                                 |
| **Race ends while car is in pit**                      | Race Management computes positions based on total distance at Checkered moment — pit car's distance is wherever it was on the spline. Results include its pit stop time.                            |
| **Pit stop merges at race end**                        | If merge check is active when checkered fires, car's position is frozen at current spline position. No special pit-end interaction needed.                                                          |
| **Lap count crosses threshold mid-tick**               | All lap checks happen in the same tick pipeline. Player completes lap N → `setSubState('Checkered')` → pipeline continues for remaining cars → next tick starts in Checkered (no more lap updates). |
| **Fuel empty in pit entry zone (coasting)**            | Pit Stop detects car entered pit entry BoundingBox. If car reaches garage → refuel. If car stops before garage → `car.stalled_in_pit` → DNF.                                                        |

---

## Dependencies

| System                   | Dependency Type | Notes                                                                            |
| ------------------------ | --------------- | -------------------------------------------------------------------------------- |
| **Physics/Handling**     | Hard            | Provides `splinePosition` per car for position sorting and lap detection.        |
| **Collision**            | Informational   | Collision events logged but no gameplay action in Phase 1.                       |
| **AI Driver**            | Hard            | AI reads position grid for overtaking decisions.                                 |
| **Event Bus**            | Hard            | All I/O with other systems.                                                      |
| **Data & Config**        | Hard            | Reads `RaceConfiguration` values.                                                |
| **Fuel**                 | Hard            | Receives `car.fuel_empty` event for DNF detection.                               |
| **Tire Wear**            | Soft            | Receives `car.tire_blown` event (logged only, no action).                        |
| **Pit Stop**             | Hard            | Receives `car.stalled_in_pit` event for DNF detection; records pit timing.       |
| **GSM**                  | Hard            | Receives state events (`gsm.state.entered`). Calls `gsm.transition('PostRace')`. |
| **Entity/Car Lifecycle** | Hard            | Provides car entities with IDs and team mapping.                                 |

---

## Tuning Knobs

No gameplay tuning knobs in Phase 1. Race parameters (lap count, grid size) are part of `RaceConfiguration`, not global config. The following are config-driven but per-race, not per-system:

| Parameter               | Location           | Description                                                                |
| ----------------------- | ------------------ | -------------------------------------------------------------------------- |
| `raceConfig.lapCount`   | RaceConfiguration  | Number of laps to complete                                                 |
| `raceConfig.gridSize`   | RaceConfiguration  | Number of cars on grid (Phase 1: 8)                                        |
| `raceConfig.difficulty` | RaceConfiguration  | Difficulty multiplier (easy=0.8, medium=1.0, hard=1.2) — used by AI Driver |
| `trackLength`           | TrackConfig.spline | Total meters of one lap (from Track + Environment)                         |

If future playtesting reveals a need for global race parameters (e.g., minimum lap count enforcement, time limit), they would be added to the `race.*` namespace in ConfigManager.

---

## Visual & Audio Requirements

| Element                | Requirement                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Grid display**       | Showing Grid uses existing ArcRotateCamera (Camera GDD). No additional visual elements.                                              |
| **Lights sequence**    | 5 red lights above the start line (3D model in track geometry). Countdown visual: lights turn off one by one. GREEN: all lights off. |
| **Lap counter**        | HUD displays current lap / total laps.                                                                                               |
| **Position indicator** | HUD displays current position (P1–P8) and change indicator (↑/↓/—).                                                                  |
| **DNF indicator**      | HUD grays out position for DNF cars. Player DNF → screen darkens, "DNF" overlay.                                                     |
| **Checkered flag**     | Visual flag effect on HUD (animated). Audio fanfare.                                                                                 |
| **Results screen**     | PostRace render: full standings grid (1–8), team names, total time, best lap, pit stops, DNF status.                                 |

---

## Acceptance Criteria

1. Race Management initializes cleanly with a valid `RaceConfiguration`
2. Invalid configuration (0 laps, unknown track) throws `ConfigError`
3. `startRace()` begins Showing Grid sub-state with cars locked at correct grid positions
4. Player SKIP transitions from Showing Grid to Countdown
5. Auto-skip fires after 10s if player does not press SKIP
6. Countdown plays 5-light sequence (5→4→3→2→1→GREEN) and unlocks all cars
7. Position grid updates every tick and reflects correct order by `lap × trackLength + splinePosition`
8. Lap counter increments correctly when car crosses start/finish line
9. Crossing finish line backward does not increment lap counter
10. Player completing all laps triggers Checkered → `endRace()` → GSM PostRace transition
11. Player DNF (fuel empty + coast to stop, not near pit, not near finish) transitions to Checkered
12. Fuel-empty coast to stop is NOT DNF if car reaches pit entry zone before stopping
13. Fuel-empty coast to stop is NOT DNF if car is on last lap near finish line
14. Stalled in pit (entered zone but stopped before garage) registers DNF with correct reason
15. Tire blowout does NOT trigger DNF under any circumstance
16. `getResults()` returns correct final positions, best lap, pit stops, and DNF status
17. `position.changed` event fires only when a car's position changes (not every tick)
18. `car.dnf` event fires with correct reason code
19. Race can run to completion with 7 AI cars + player with no errors
20. Race can run to completion with all 8 cars DNFing (player last) without hanging
21. `endRace()` can only be called once — subsequent calls return cached results
