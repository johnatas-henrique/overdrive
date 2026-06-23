# Race Management

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Foundation — Race Flow

## Overview

Race Management is the central authority for all race-state data during a live race. It owns the current position grid, lap counters, DNF registry, race timing, and the internal race sub-state machine (Countdown → GreenFlag → Racing → Checkered). It does NOT own race configuration (lap count, grid size, track id) — that is provided by the calling mode (Single Race, Championship) via `RaceConfiguration`.

The system is **mode-agnostic**: it accepts a `RaceConfiguration`, publishes `RaceEvent`s via the Event Bus, and exposes `getResults()` at the end. Single Race and Championship are different configurations, not different code paths. The GSM remains in `Racing` throughout all sub-states; Race Management handles sub-state transitions internally.

---

## Player Fantasy

> _For infrastructure systems, the "player" is the developer using this API._

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

**6. Seed propagation.** `RaceConfiguration.seed` is passed to `SeededRandom` at init. All simulation RNG (AI Driver variance, Camera shake direction) draws from this single seeded instance. Same seed + same inputs → identical race outcome (Determinism Contract AC #5).

### Race State Machine

```
GSM: Racing
  └── Race Management sub-states:

      Countdown ──→ GreenFlag ──→ Racing ──→ Checkered
                                              │
                                              └── (player finishes all laps or DNF)
```

| Sub-state     | Description                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Countdown** | Race Management orders grid positions from `RaceConfiguration`, locks all cars. Camera in player's default (cockpit or chase). Lights sequence: 5 red → 4 → 3 → 2 → 1 → GREEN.         |
| **GreenFlag** | All cars unlocked. Race timer starts. Normal racing physics active for all cars. Grid cinematic already played during GSM PreRace.                                                     |
| **Racing**    | Race is live. Position grid updates every tick, lap counting active, DNF monitoring active.                                                                                            |
| **Checkered** | Player completed all laps OR player DNF. Results computed for all 8 cars from total distance at checkered moment. Race timer stops. `endRace()` called → GSM transition to `PostRace`. |

**PreRace grid timer:**

- On `gsm.state.entered(to=PreRace)`: Race Management starts an 8-second timer.
- Player presses **confirm** input → calls `gsm.transition('Racing')` immediately.
- Timer expires (8s) → calls `gsm.transition('Racing')`.
- Both triggers produce the same result: GSM enters `Racing`, Race Management begins `Countdown`.

**Race sub-state transitions:**

- `Countdown → GreenFlag`: Lights sequence completes (GREEN). All cars unlocked.
- `GreenFlag → Racing`: Immediate (first tick after GREEN).
- `Racing → Checkered`: Player lap count equals `RaceConfiguration.lapCount` OR player DNF detected.
- `Checkered → (GSM PostRace)`: `RaceManagement.endRace()` calls `gsm.transition('PostRace')`.

### Position & Lap Tracking

**Position grid** is computed every tick after all other systems have run:

```typescript
function updatePositions(): void {
  const trackLength = trackConfig.spline.length; // total meters
  const hysteresis = configManager.get("race.position.hysteresisThreshold"); // default 0.5m

  const sorted = activeCars
    .filter((c) => !dnfRegistry.has(c.id))
    .map((c) => {
      const lap = lapCount.get(c.id) ?? 0;
      const splinePos = c.physics.splinePosition; // 0..trackLength from Physics
      splinePositions.set(c.id, splinePos); // store for buildResults
      const totalDist = lap * trackLength + splinePos;
      return { carId: c.id, totalDist, lap, splinePos };
    })
    .sort((a, b) => b.totalDist - a.totalDist); // descending = most distance first

  // Hysteresis (3-tick sustain): Only swap adjacent cars if the distance delta
  // remains below the threshold for 3 consecutive ticks. Prevents position
  // flicker during sustained side-by-side racing while still resolving close
  // battles that don't settle within a few frames.
  //
  //   Tick 1: delta < 0.5m → hystTick = 1, position held
  //   Tick 2: delta < 0.5m → hystTick = 2, position held
  //   Tick 3: delta < 0.5m → hystTick = 3, swap fires
  //   Any tick: delta >= 0.5m → hystTick reset to 0
  //
  const SUSTAIN_TICKS = 3;
  for (const entry of sorted) {
    const prevPos = positionGrid.get(entry.carId) ?? sorted.length;
    const newPos = sorted.indexOf(entry) + 1; // 1-based
    if (newPos === prevPos) {
      // Position stable — reset hysteresis counter
      hysteresisTicks.set(entry.carId, 0);
      continue;
    }

    // For non-adjacent swaps, emit immediately (no hysteresis needed)
    if (Math.abs(newPos - prevPos) > 1) {
      hysteresisTicks.set(entry.carId, 0);
      positionGrid.set(entry.carId, newPos);
      emit("position.changed", {
        carId: entry.carId,
        old: prevPos,
        new: newPos,
      });
      continue;
    }

    // Adjacent swap — apply 3-tick hysteresis
    const neighbor = sorted[newPos - 1];
    const distanceDelta = Math.abs(entry.totalDist - neighbor.totalDist);
    if (distanceDelta >= hysteresis) {
      // Delta exceeds threshold — safe to swap immediately
      hysteresisTicks.set(entry.carId, 0);
      positionGrid.set(entry.carId, newPos);
      emit("position.changed", {
        carId: entry.carId,
        old: prevPos,
        new: newPos,
      });
      continue;
    }

    // Delta below threshold — increment sustain counter
    const currentTicks = hysteresisTicks.get(entry.carId) ?? 0;
    const newTicks = currentTicks + 1;
    if (newTicks >= SUSTAIN_TICKS) {
      // Sustained for 3 ticks — allow the swap
      hysteresisTicks.set(entry.carId, 0);
      positionGrid.set(entry.carId, newPos);
      emit("position.changed", {
        carId: entry.carId,
        old: prevPos,
        new: newPos,
      });
    } else {
      // Not yet sustained — hold position, increment counter
      hysteresisTicks.set(entry.carId, newTicks);
    }
  }
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

      // Condition 1: Player completed all laps
      if (newLap >= raceConfig.lapCount) {
        emit("race.checkered", { carId, lap: newLap, results: buildResults() });
        setSubState("Checkered");
        prevSplinePos.set(carId, current);
        return;
      }

      // Condition 3: Leader finished, player is >=1 lap behind
      // Player finishes current lap, then race ends — no new lap starts
      const leaderId = findRaceLeader();
      if (leaderId) {
        const leaderLap = lapCount.get(leaderId) ?? 0;
        if (leaderLap >= raceConfig.lapCount && leaderLap - newLap >= 1) {
          emit("race.checkered", {
            carId,
            lap: newLap,
            results: buildResults(),
          });
          setSubState("Checkered");
          prevSplinePos.set(carId, current);
          return;
        }
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
//   lapCount, positionGrid, dnfRegistry, pendingDNF, prevSplinePos, splinePositions,
//   bestLaps, pitStopCount (Map<string, number>), pitTotalTime (Map<string, number>),
//   hysteresisTicks (Map<string, number>) — per-car tick counter for 3-tick sustain
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
  // Physics emits car.stopped when velocity ≈ 0 for a car with no engine power.
  if (subState === "Checkered") return; // race already ended — no DNF after checkered

  if (pendingDNF.has(event.carId)) {
    const car = cars.get(event.carId);

    // Exception: Car is in pit entry zone (can still coast to garage → refuel)
    // Direct geometric query: reads car's current position against TrackConfig.pitEntryZone BoundingBox.
    // Not a cached flag — works regardless of spatial detection pipeline position.
    if (isInPitEntryZone(car)) return;

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
    pitTotalTime.set(carId, (pitTotalTime.get(carId) ?? 0) + event.totalTimeMs);
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

The race ends when **one of three conditions** is met, checked in priority order every tick during `Racing` sub-state:

| #   | Condition            | Trigger                                                                                       | Action                                                                                                                                                    |
| --- | -------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Voltas completas** | Player crosses finish line on lap N (where N = RaceConfiguration.lapCount)                    | `setSubState('Checkered')` immediately. Results computed from all cars' totalDistance at this moment.                                                     |
| 2   | **Último colocado**  | The car immediately ahead of the player (P[N-1]) crosses finish line on its final lap         | `setSubState('Checkered')` immediately — no need for player to finish current lap. Player position is frozen at current distance — impossible to improve. |
| 3   | **Uma volta atrás**  | Leader crosses finish line on lap N AND player is ≥1 lap behind (leader.lap - player.lap ≥ 1) | Race continues until player crosses finish line on current lap. When player crosses → `setSubState('Checkered')`. No new lap starts.                      |

Conditions 1 and 3 are checked inside `updateLaps()` (on each player finish line crossing). Condition 2 is checked every tick via `checkRaceEnd()`:

```typescript
function checkRaceEnd(): void {
  if (subState !== "Racing") return;

  const playerPosition = positionGrid.get(playerCarId);
  if (!playerPosition || playerPosition <= 1) return; // player is leading — no condition 2

  // Condition 2: Car immediately ahead of player just finished all laps
  const aheadCarId = findCarAtPosition(playerPosition - 1);
  if (aheadCarId) {
    const aheadLap = lapCount.get(aheadCarId) ?? 0;
    if (aheadLap >= raceConfig.lapCount) {
      setSubState("Checkered");
    }
  }
}
```

When the race ends (Checkered sub-state):

```typescript
function endRace(): void {
  const results = buildResults();
  raceResult = results;
  emit("race.completed", { results });
  gsm.transition("PostRace");
}
```

> **Note**: `gsm.transition("PostRace")` from `endRace()` is deferred to end-of-tick (not executed synchronously from pipeline slot #7). This ensures all pipeline slots (including Pit Stop slot #8) complete in the `Racing` state before the GSM transitions to `PostRace`.

On player DNF: positions for ALL 8 cars are computed from total distance at the checkered moment. DNF cars are placed after all finishers, sorted by distance achieved before retirement. The player's car is placed last among non-DNF cars, or if all cars have more distance, the player is P8.

```typescript
function buildResults(): RaceResult[] {
  const trackLength = trackConfig.spline.length;

  // Compute total distance per car (lap × trackLength + spline position)
  const entries = allCarIds.map((carId) => {
    const lap = lapCount.get(carId) ?? 0;
    const splinePos = splinePositions.get(carId) ?? 0;
    const dnf = dnfRegistry.get(carId);
    return {
      carId,
      teamId: cars.get(carId).teamId,
      totalDistance: lap * trackLength + splinePos,
      totalTime: raceTime,
      bestLapTime: bestLaps.get(carId) ?? 0,
      lapCount: lap,
      dnf: !!dnf,
      dnfReason: dnf ?? undefined,
      pitStops: pitStopCount.get(carId) ?? 0,
      pitTotalTime: pitTotalTime.get(carId) ?? 0,
    };
  });

  // Sort: all finishers (DNF=false) by totalDistance descending, then DNF cars by totalDistance descending
  entries.sort((a, b) => {
    if (a.dnf !== b.dnf) return a.dnf ? 1 : -1;
    return b.totalDistance - a.totalDistance;
  });

  // Assign final positions from sorted order (1-based)
  return entries.map((entry, index) => ({
    ...entry,
    finalPosition: index + 1,
  }));
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

| Event                            | Emitter   | Reaction                                                                                                                                                                                                                                        |
| -------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gsm.state.entered` (to=PreRace) | GSM       | Start grid timer (8s). Lock all cars via `physics.setLocked(carId, true)`.                                                                                                                                                                      |
| `gsm.state.entered` (to=Racing)  | GSM       | `init()` config → set sub-state to Countdown. Cancel grid timer if still running. Cars remain locked until `race.green.flag`. `race.starting` is emitted on the first pipeline tick after Countdown begins (not synchronously during dispatch). |
| `car.fuel_empty`                 | Fuel      | Mark car for pending DNF (coasting)                                                                                                                                                                                                             |
| `car.stopped`                    | Physics   | If pending DNF → check exceptions → register DNF or skip                                                                                                                                                                                        |
| `pit.status` (status=pitStopped) | Pit Stop  | Clear `pendingDNF[carId]` — car is being serviced; fuel-empty condition is resolved                                                                                                                                                             |
| `car.stalled_in_pit`             | Pit Stop  | Register DNF with reason `stalled_in_pit`                                                                                                                                                                                                       |
| `car.tire_blown`                 | Tire Wear | Log only — no DNF action                                                                                                                                                                                                                        |
| `pit.exit`                       | Pit Stop  | Increment pit stop counter, record total pit time                                                                                                                                                                                               |

Race Management emits:

| Event                  | Payload                                 | Consumers                                                                                                            |
| ---------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `race.starting`        | `{ trackId, lapCount, gridSize }`       | Menu, HUD (deferred — emitted on first pipeline tick after Countdown start, not synchronously during event dispatch) |
| `race.light.countdown` | `{ lightsRemaining: number }`           | HUD (CountdownBlock: update displayed lights) — emitted each time a light turns off (5→4→…→1→0)                      |
| `race.green.flag`      | `{ raceId, timestamp }`                 | HUD (start timer), Camera (unlock), AI (go), Physics → `setLocked(false)`                                            |
| `car.lap.completed`    | `{ carId, lap, lapTime }`               | HUD (lap counter), Audio (lap trigger)                                                                               |
| `race.checkered`       | `{ carId, lap, results: RaceResult[] }` | HUD (top 3 + player), Camera (drone transition), Audio (fanfare)                                                     |
| `race.completed`       | `{ results: RaceResult[] }`             | PostRace, Single Race, Telemetry Recorder                                                                            |
| `car.dnf`              | `{ carId, reason }`                     | HUD (gray out), Audio (announcement), AI (ignore car)                                                                |
| `position.changed`     | `{ carId, oldPos, newPos }`             | HUD (position indicator), Audio (overtake sound)                                                                     |

The `position.changed` event is throttled: emitted only when a car's position changes, not every tick. Useful for HUD updates and audio cues without flooding the Event Bus.

---

## States & Transitions

| State        | Description                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| **Inactive** | No race configured.                                                         |
| **Ready**    | `RaceConfiguration` loaded, awaiting `startRace()`.                         |
| **Racing**   | Race sub-state machine active (Countdown → GreenFlag → Racing → Checkered). |
| **Complete** | Results computed. `getResults()` available. Ready for PostRace.             |

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
| **Tie at finish line (same totalDistance)**            | Academic — never happened in 70+ years of F1. Tiebreaker: grid position (whoever started ahead wins). Guarantees deterministic results without affecting normal race outcomes.                      |

---

## Dependencies

| System                   | Dependency Type | Notes                                                                            |
| ------------------------ | --------------- | -------------------------------------------------------------------------------- |
| **Physics/Handling**     | Hard            | Provides `splinePosition` per car for position sorting and lap detection.        |
| **Collision**            | Informational   | Collision events logged but no gameplay action in Phase 1.                       |
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

| Parameter                           | Location           | Description                                                                                                                        |
| ----------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `raceConfig.lapCount`               | RaceConfiguration  | Number of laps to complete                                                                                                         |
| `raceConfig.gridSize`               | RaceConfiguration  | Number of cars on grid (Phase 1: 8)                                                                                                |
| `raceConfig.difficulty`             | RaceConfiguration  | Difficulty multiplier (easy=0.8, medium=1.0, hard=1.2) — used by AI Driver                                                         |
| `race.position.hysteresisThreshold` | race.\*            | Minimum totalDistance delta (m) to register a position change (default: 0.5). Prevents position flicker during side-by-side racing |
| `trackLength`                       | TrackConfig.spline | Total meters of one lap (from Track + Environment)                                                                                 |

If future playtesting reveals a need for global race parameters (e.g., minimum lap count enforcement, time limit), they would be added to the `race.*` namespace in ConfigManager.

---

## Visual & Audio Requirements

| Element                | Requirement                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Grid display**       | Grid cinematic runs during GSM PreRace using existing ArcRotateCamera (Camera GDD). No additional visual elements.                   |
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
3. `startRace()` begins Countdown sub-state with cars locked at correct grid positions
4. Countdown plays 5-light sequence (5→4→3→2→1→GREEN) and unlocks all cars
5. Position grid updates every tick and reflects correct order by `lap × trackLength + splinePosition`
6. Lap counter increments correctly when car crosses start/finish line
7. Crossing finish line backward does not increment lap counter
8. Player completing all laps triggers Checkered → `endRace()` → GSM PostRace transition
9. Player DNF (fuel empty + coast to stop, not near pit, not near finish) transitions to Checkered
10. Fuel-empty coast to stop is NOT DNF if car reaches pit entry zone before stopping
11. Fuel-empty coast to stop is NOT DNF if car is on last lap near finish line
12. Stalled in pit (entered zone but stopped before garage) registers DNF with correct reason
13. Tire blowout does NOT trigger DNF under any circumstance
14. `getResults()` returns correct final positions, best lap, pit stops, and DNF status
15. `position.changed` event fires only when a car's position changes (not every tick)
16. `car.dnf` event fires with correct reason code
17. Race can run to completion with 7 AI cars + player with no errors
18. Race can run to completion with all 8 cars DNFing (player last) without hanging
19. `endRace()` can only be called once — subsequent calls return cached results
20. Car ahead of player finishing all laps (condition 2) triggers immediate Checkered — player races over
21. Leader finishing with player ≥1 lap behind (condition 3) triggers Checkered after player finishes current lap — no new lap started
