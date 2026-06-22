# ADR-0015: Race Management

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Engine**                | Babylon.js 9.12.0                                                                                                                                |
| **Domain**                | Simulation — Race Management                                                                                                                     |
| **Knowledge Risk**        | LOW — pure TypeScript state machine + arithmetic. No Babylon APIs.                                                                               |
| **References Consulted**  | race-management.md GDD, ADR-0001 (Event Bus), ADR-0002 (Pipeline slot #7), ADR-0008 (Physics — splinePosition), ADR-0014 (Pit Stop — pit events) |
| **Post-Cutoff APIs Used** | None                                                                                                                                             |

## ADR Dependencies

| Field          | Value                                                                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Depends On** | ADR-0001 (Event Bus — all I/O), ADR-0002 (pipeline slot #7), ADR-0008 (Physics — splinePosition per tick), ADR-0011 (Fuel — car.fuel_empty), ADR-0012 (Tire — car.tire_blown), ADR-0014 (Pit Stop — pit.status, car.stalled_in_pit, pit.exit), ADR-0006 (Input — confirm for PreRace skip) |
| **Enables**    | HUD (race events), Camera (checkered → drone), Audio (lap/DNF/checkered), PostRace (results), Telemetry Recorder                                                                                                                                                                           |
| **Blocks**     | Single Race adapter, Championship Mode, Replay System                                                                                                                                                                                                                                      |

## Context

### Problem Statement

Race Management is the central authority for all race-state data during a live race. It owns positions, lap counters, DNF status, and race timing. It does NOT own race configuration (lap count, grid size, track id) — those come from the calling mode via `RaceConfiguration`.

### Constraints

- Pure TypeScript — zero Babylon APIs. No mesh, no camera, no physics query.
- Pipeline slot #7 (after Tire Wear #6, before Pit Stop #8). All simulation data for the tick is ready before RM processes.
- Race Management does NOT know or care whether a car is player or AI — it tracks all cars by `carId`.
- Race Management does NOT own the GSM — it subscribes to `gsm.state.entered` and calls `gsm.transition()` only at race end. The `gsm.transition()` call from `endRace()` is deferred to end-of-tick (not executed synchronously from pipeline slot #7), ensuring all pipeline slots (including Pit Stop slot #8) complete in the `Racing` state before the GSM transitions to `PostRace`.
- All cross-system communication goes through Event Bus. RM does not import any other system directly.
- `init()` must be reentrant — `off()` before `on()` to prevent listener duplication on Race Again.

### Requirements

- Own 4 sub-states: Countdown → GreenFlag → Racing → Checkered
- Compute position grid every tick from `totalDistance = lap × trackLength + splinePosition`
- Lap detection via spline wrap-around (no collision trigger)
- DNF lifecycle: pendingDNF (on fuel_empty) → exceções → DNF (on car.stopped)
- 3 race-end conditions: voltas completas, último colocado, uma volta atrás
- Emit race events via Event Bus
- Produce `getResults()` with final standings sorted by totalDistance
- Reentrant init for Race Again

## Decision

### Architecture

Race Management is a **sub-state machine** operating inside GSM's `Racing` state. GSM does not know about Countdown, GreenFlag, or Checkered — it only knows RM is "racing."

```
                  GSM: Racing
                    ┌────────┐
       init() ──→   │ Ready  │ ← RaceConfiguration loaded
                    └───┬────┘
              startRace()
                        │
                        ▼
                  ┌───────────┐
                  │ Countdown │ ← 5→4→3→2→1→GREEN (lights sequence)
                  └─────┬─────┘
                        │ lights complete
                        ▼
                   ┌───────────┐
                   │ GreenFlag │ ← race.green.flag emitted
                   └─────┬─────┘
                         │ first tick after green
                         ▼
                    ┌──────────┐
                    │  Racing  │ ← positions, laps, DNF active
                    └─────┬────┘
                          │ one of 3 conditions met
                          ▼
                    ┌────────────┐
                    │ Checkered │ ← endRace() → gsm.transition('PostRace')
                    └────────────┘
```

### Race-End Conditions

Three independent conditions, checked in priority order every tick during `Racing` sub-state:

| #   | Condition            | Trigger                                                                                       | Action                                                                                                                                                    |
| --- | -------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Voltas completas** | Player crosses finish line on lap N (where N = RaceConfiguration.lapCount)                    | `setSubState('Checkered')` immediately. Results computed from all cars' totalDistance at this moment.                                                     |
| 2   | **Último colocado**  | The car immediately ahead of the player (P[N-1]) crosses finish line on its final lap         | `setSubState('Checkered')` immediately — no need for player to finish current lap. Player position is frozen at current distance — impossible to improve. |
| 3   | **Uma volta atrás**  | Leader crosses finish line on lap N AND player is ≥1 lap behind (leader.lap - player.lap ≥ 1) | Race continues until player crosses finish line on current lap. When player crosses → `setSubState('Checkered')`. No new lap starts.                      |

```typescript
function checkRaceEnd(): void {
  const playerLap = lapCount.get(playerCarId) ?? 0;
  const playerPos = splinePositions.get(playerCarId) ?? 0;

  // Condition 1: Player completed all laps
  if (playerLap >= raceConfig.lapCount) {
    // Already handled by car.lap.completed handler — this is a safety check
    setSubState("Checkered");
    return;
  }

  // Condition 2: Player is last, car ahead just finished
  const playerPosition = positionGrid.get(playerCarId) ?? 0;
  if (playerPosition > 1) {
    // Find the car one position ahead of player
    const aheadCarId = findCarAtPosition(playerPosition - 1);
    if (aheadCarId) {
      const aheadDone = lapCount.get(aheadCarId) ?? 0;
      // If car ahead just finished all laps, player can't improve P8
      if (aheadDone >= raceConfig.lapCount) {
        setSubState("Checkered");
        return;
      }
    }
  }

  // Condition 3: Leader finished but player is ≥1 lap behind
  const leaderCar = findRaceLeader(); // car with max totalDistance
  if (leaderCar) {
    const leaderLap = lapCount.get(leaderCar) ?? 0;
    if (leaderLap >= raceConfig.lapCount && leaderLap - playerLap >= 1) {
      // Player finishes current lap, then ends
      // Handled in car.lap.completed — check there
    }
  }
}
```

For condition 3, the race ends when the player crosses the line on the current lap:

```typescript
function updateLaps(carId: string): void {
  // ... lap detection logic ...

  if (carId === playerCarId) {
    const newLap = lapCount.get(carId) ?? 0;

    // Condition 1: Player completed all laps
    if (newLap >= raceConfig.lapCount) {
      setSubState("Checkered");
      return;
    }

    // Condition 3: Leader finished, player finished current lap
    const leaderLap = lapCount.get(raceLeaderId) ?? 0;
    if (leaderLap >= raceConfig.lapCount && leaderLap - newLap >= 1) {
      setSubState("Checkered");
      return;
    }
  }
}
```

Condition 2 is checked every tick in `checkRaceEnd()` (no need to wait for lap crossing — player position is frozen).

### Position Tracking

```typescript
function updatePositions(): void {
  for each car not in dnfRegistry:
    const lap = lapCount.get(carId) ?? 0;
    const splinePos = physics.getSplinePosition(carId); // 0..trackLength
    const totalDist = lap * trackLength + splinePos;
    totalDistance.set(carId, totalDist);
  }

  // Sort by totalDistance descending
  const sorted = [...totalDistance.entries()]
    .sort((a, b) => b[1] - a[1]);

  // Hysteresis: emit position.changed only when |delta| > threshold
  for (const [carId, dist] of sorted) {
    const newPos = sorted.indexOf(some) + 1;
    const oldPos = positionGrid.get(carId) ?? newPos;
    if (newPos !== oldPos && isSwapSustained(carId, newPos)) {
      positionGrid.set(carId, newPos);
      emit('position.changed', { carId, old: oldPos, new: newPos });
    }
  }
}
```

### Lap Detection via Spline Wrap-Around

```typescript
// Finish line is at spline position 0
// Car wraps from ~trackLength to ~0 — detect the crossing

const currentPos = physics.getSplinePosition(carId);
const prevPos = prevSplinePositions.get(carId) ?? 0;

if (prevPos > trackLength * 0.9 && currentPos < trackLength * 0.1) {
  // Forward crossing detected
  const newLap = (lapCount.get(carId) ?? 0) + 1;
  lapCount.set(carId, newLap);
  emit("car.lap.completed", { carId, lap: newLap, lapTime });
}

prevSplinePositions.set(carId, currentPos);
```

### DNF Lifecycle

```
car.fuel_empty ──→ pendingDNF[carId] = true
                         │
                         ▼
                  car.stopped (velocity ≈ 0)
                         │
                    ┌─────┴──────┐
                    │             │
              pit zone      not pit zone
              (distance     (normal track)
               to garage)
                    │             │
                    ▼             ▼
            clear pending   registerDNF(carId, 'fuel_empty')
            (Pit Stop
             handles it)
```

Additional events:

- `pit.status(status=pitStopped)` → clear `pendingDNF[carId]` (car is being serviced)
- `car.stalled_in_pit` → `registerDNF(carId, 'stalled_in_pit')`
- `car.tire_blown` → logged only, no DNF action

**Pit zone determination**: When `car.stopped` is received, RM checks if the car is in the pit entry zone via `track.isInPitEntryZone(carId)` (defined in ADR-0016 — Track + Environment). Pit Stop is NOT queried — RM reads the geometric data directly from Track, since the car may have stopped before Pit Stop could register it. The `pit.status(pitStopped)` event is the reliable signal for "car is safe" — it fires after Pit Stop confirms the car reached its garage slot.

### Key Interfaces

```typescript
interface IRaceManagement {
  init(config: RaceConfiguration): void; // reentrant — off() before on()
  startRace(): void; // transitions Ready → Countdown
  tick(dt: number): void; // pipeline slot #7
  endRace(): RaceResult[]; // returns cached results
  getResults(): RaceResult[] | null; // null before endRace()
  getState(): "inactive" | "ready" | "racing" | "complete";
  getPositions(): Map<string, number>; // current grid snapshot
  dispose(): void;
}

interface RaceConfiguration {
  trackId: string;
  lapCount: number; // default 5 (min 1, max 20)
  gridSize: number; // default 8
  playerCarId: string;
  difficulty: number; // 0.75 / 0.875 / 1.0 / 1.125 / 1.25
  seed: number; // Date.now() default, propagates to SeededRandom
  aiDrivers: AIDriverConfig[];
}

interface RaceResult {
  carId: string;
  teamId: string;
  finalPosition: number; // 1-based
  totalDistance: number;
  totalTime: number; // ticks × 1/60
  bestLapTime: number;
  lapCount: number;
  dnf: boolean;
  dnfReason?: string;
  pitStops: number;
  pitTotalTime: number;
}
```

### Countdown Timing

The countdown sequence is paced by tick count, not real-time — ensuring deterministic replay:

```typescript
// Inside Countdown sub-state
const LIGHT_INTERVAL_TICKS = 60; // 60 ticks × 16.667ms = 1s per light
let countdownTicks = 0;
let currentLightsOn = 5; // start at 5 red lights

function tickCountdown(dt: number): void {
  countdownTicks++;
  if (countdownTicks >= LIGHT_INTERVAL_TICKS) {
    countdownTicks = 0;
    currentLightsOn--;
    if (currentLightsOn < 0) {
      // All lights off → GREEN
      setSubState("GreenFlag");
      return;
    }
    emit("race.light.countdown", { lightsOn: currentLightsOn });
  }
}
```

Total countdown: 5 lights × 1s = 5s. Each 1s interval is exactly 60 ticks at fixed 60Hz.

### Events

**Subscribed:**

| Event                           | Source    | Reaction                                        |
| ------------------------------- | --------- | ----------------------------------------------- |
| `gsm.state.entered(to=PreRace)` | GSM       | Start 8s grid timer, lock all cars              |
| `gsm.state.entered(to=Racing)`  | GSM       | `init(config)` → Countdown sub-state            |
| `car.fuel_empty`                | Fuel      | Mark `pendingDNF[carId]`                        |
| `car.stopped`                   | Physics   | Check pendingDNF → DNF or skip                  |
| `pit.status(status=pitStopped)` | Pit Stop  | Clear `pendingDNF[carId]`                       |
| `car.stalled_in_pit`            | Pit Stop  | `registerDNF(carId, 'stalled_in_pit')`          |
| `car.tire_blown`                | Tire Wear | Log only — no DNF                               |
| `pit.exit`                      | Pit Stop  | Increment pitStopCount, accumulate pitTotalTime |

**Emitted:**

| Event                  | Payload                           | When                                        |
| ---------------------- | --------------------------------- | ------------------------------------------- |
| `race.starting`        | `{ trackId, lapCount, gridSize }` | First pipeline tick after Countdown begins  |
| `race.light.countdown` | `{ lightsOn: number }`            | Each light turns off (5→4→…→0 → GreenFlag)  |
| `race.green.flag`      | `{ raceId, timestamp }`           | Lights sequence complete, all cars unlocked |
| `car.lap.completed`    | `{ carId, lap, lapTime }`         | Each finish line crossing per car           |
| `race.checkered`       | `{ carId, lap, results }`         | Race-end condition met (player car)         |
| `race.completed`       | `{ results }`                     | After endRace(), for PostRace               |
| `car.dnf`              | `{ carId, reason }`               | When a car is registered DNF                |
| `position.changed`     | `{ carId, old, new }`             | Sustained position change                   |

### Reentrancy Pattern

```typescript
init(config: RaceConfiguration): void {
  // Clear previous state
  lapCount.clear();
  positionGrid.clear();
  dnfRegistry.clear();
  // etc.

  // Re-subscribe with off() before on() — prevents duplicate listeners
  eventBus.off('car.fuel_empty', this.onFuelEmpty)
    .on('car.fuel_empty', this.onFuelEmpty);
  eventBus.off('car.stopped', this.onCarStopped)
    .on('car.stopped', this.onCarStopped);
  eventBus.off('pit.status', this.onPitStatus)
    .on('pit.status', this.onPitStatus);
  eventBus.off('pit.exit', this.onPitExit)
    .on('pit.exit', this.onPitExit);
  eventBus.off('car.stalled_in_pit', this.onStalledInPit)
    .on('car.stalled_in_pit', this.onStalledInPit);

  this.config = config;
  this.state = 'ready';
}
```

## Alternatives Considered

### Alternative 1: GSM owns all race sub-states (no RM sub-state machine)

- **GSM** would have 5 states: PreRace → Countdown → GreenFlag → Racing → Checkered → PostRace.
- **Rejected**: Each GSM transition requires a separate tick (Core Rule 3: max 1 transition/tick). Countdown→GreenFlag would add 3 ticks of latency. HUD/Camera/Audio already subscribe to `race.*` events — they don't read GSM state for sub-transitions. Adding GSM states provides no value and adds tick latency.

### Alternative 2: Race ends on leader's final lap (F1 real)

- **Rejected**: With varied AI performance, the leader could be 2-3 laps ahead. Player would be abruptly stopped mid-lap. The "one lap behind" condition (Condition 3) provides the F1 feel (let lapped cars finish) while keeping the player-centric design.

### Alternative 3: Lap detection via collision trigger at finish line

- **Rejected**: Would require a Havok trigger body at position 0 — each car crossing would generate a collision event. Spline wrap-around is O(1), deterministic, and has zero Havok coupling.

## Consequences

### Positive

- Pure TypeScript — fully testable with vitest. No scene, no engine.
- Sub-state machine is invisible to all other systems — HUD/Camera/Audio react to events, not state machines.
- 3 race-end conditions cover all realistic scenarios without the complexity of F1-style "leader finishes" logic.
- Reentrancy pattern prevents Race Again bugs (duplicate listeners would double-count pit stops, DNFs, etc.).
- DNF lifecycle handles the coasting gap between `fuel_empty` and `car.stopped` — car can reach pit.

### Negative

- Race Management must know which car is the player (`playerCarId`) to evaluate race-end conditions. Multiplayer (Alpha) will need to evaluate per-human-player.
- The "car immediately ahead" in Condition 2 assumes sorted position grid — correct but requires verifying DNF cars are excluded from position sorting.
- `race.starting` emitted on first pipeline tick after Countdown (not synchronously) — HUD must not assume immediate subscription.

### Risks

- **Risk**: Condition 2 fires incorrectly if position grid has stale data (car ahead already DNF but still in grid)
  **Mitigation**: `checkRaceEnd()` reads `positionGrid` which excludes DNF cars via `updatePositions()`. Prior tick already filtered them.
- **Risk**: Condition 3 — leader finishes but player is on same lap (distance gap is small but real)
  **Mitigation**: `leaderLap - playerLap >= 1` ensures only lapped players trigger early end. Same-lap close finish uses Condition 1 (player crosses line).

## GDD Requirements Addressed

| GDD                | Requirement                          | How This ADR Addresses It                            |
| ------------------ | ------------------------------------ | ---------------------------------------------------- |
| race-management.md | Sub-state machine (4 states)         | Countdown → GreenFlag → Racing → Checkered           |
| race-management.md | Position authority                   | RM owns positionGrid, totalDistance                  |
| race-management.md | Lap detection via spline wrap-around | `prev > 0.9*track` and `current < 0.1*track`         |
| race-management.md | DNF lifecycle                        | pendingDNF → exceções → registerDNF                  |
| race-management.md | 3 race-end conditions                | Voltas completas / Último colocado / Uma volta atrás |
| race-management.md | Reentrancy                           | off() before on() in init()                          |
| race-management.md | Seed → SeededRandom                  | seed from RaceConfiguration                          |
| race-management.md | Position hysteresis                  | threshold + 3-tick sustain → emit position.changed   |

## Performance Implications

- **CPU**: Position sort O(8 log 8) = trivial. Lap detection O(8). DNF checks O(1). Total <0.01ms.
- **Memory**: 8 cars × (lapCount, totalDistance, bestLap, pitStopCount, pitTotalTime) + Maps = ~1KB.

## Validation Criteria

- [ ] `init()` with valid config → Ready state. Invalid config → ConfigError.
- [ ] `startRace()` → Countdown → lights sequence → GreenFlag → Racing.
- [ ] Position grid sorted by `lap × trackLength + splinePosition` descending.
- [ ] Lap increments only on forward spline wrap-around.
- [ ] Backward crossing does NOT increment lap.
- [ ] `car.fuel_empty` → pendingDNF set but no immediate DNF.
- [ ] `car.stopped` with pendingDNF in pit entry zone → NO DNF (coast to pit).
- [ ] `car.stopped` with pendingDNF on track → DNF registered.
- [ ] `pit.status(pitStopped)` clears pendingDNF.
- [ ] Condition 1: player completes lap N → Checkered.
- [ ] Condition 2: car ahead of player completes final lap → immediate Checkered (player races over).
- [ ] Condition 3: leader finishes + player ≥1 lap behind → Checkered after player crosses line.
- [ ] `getResults()` returns 8 entries sorted finishers first, DNF last.
- [ ] `position.changed` throttled — not emitted every tick.
- [ ] `init()` twice → no duplicate listeners.
- [ ] All 8 cars DNF → player last → race ends (no hang).
- [ ] Same seed + same config → identical results.

## Related Decisions

- ADR-0001 (Event Bus — all I/O between RM and other systems)
- ADR-0002 (Fixed Timestep — pipeline slot #7)
- ADR-0008 (Physics — splinePosition per tick, car.stopped event)
- ADR-0011 (Fuel — car.fuel_empty event)
- ADR-0014 (Pit Stop — pit.status, car.stalled_in_pit, pit.exit events)
- ADR-0006 (Input — confirm for PreRace skip)
