# Pit Stop

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Simple Strategy

## Overview

Pit Stop manages the full pit lane lifecycle for every car: detecting entry, taking control of the car along the pit lane spline, executing refuel and tire change, and releasing the car back onto the track. The pit lane is a physical part of the track geometry (modelled from the start), with a dedicated spline guiding cars from entry to garage and from garage to exit.

Phase 1 pit stops include refuelling (progressive fill, player can leave early) and tire changes (automatic, fixed delay). There is no additional crew animation, tyre compound selection, or nose/wing change — those are deferred to Alpha.

---

## Player Fantasy

The player sees the pit entry cone approaching, passes the bounding box, and feels the car decelerate smoothly to 80 km/h as steering is taken over. The car guides itself along the pit lane, stopping exactly at the team garage. An overlay appears: a fuel bar filling in real time, a tire change indicator, and a flashing "EXIT" prompt.

The player chooses when to leave — early with partial fuel and fresh tires, or wait for a full tank. Every second in the pit lane is a second not racing, and rivals who pitted earlier or later will gain or lose time based on this decision. The fantasy is **pulling off a faster pit stop than the competition** — leaving at the optimal moment while rivals are too conservative or too impatient.

---

## Detailed Design

### Pit Lifecycle

Each car has a `pitState` that progresses through the following stages:

```
onTrack → pitEntry → pitStopped → departing → onTrack
```

The GSM remains in **Racing** for all cars. Pit stop is a per-car flag, not a game state transition.

| Stage          | Description                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **onTrack**    | Normal racing. Car follows regular physics.                                                                             |
| **pitEntry**   | Car crossed pit entry BoundingBox. Physics takes over steering. Follows pit lane spline at 80 km/h.                     |
| **pitStopped** | Car reached its garage slot. Stopped. Refuel + tire change in progress. Player sees HUD overlay.                        |
| **departing**  | Car exited garage. Follows pit lane spline toward exit. Merge check active. At pit exit BoundingBox → control returned. |

### Pit Detection

Pit entry and exit are detected via **spatial BoundingBox zones** defined per track in `TrackConfig`:

```typescript
interface TrackConfig {
  // ...
  pitEntryZone: BoundingBox; // car center enters → pitEntry
  pitExitZone: BoundingBox; // car center exits → onTrack
  pitLaneSpline: Vec3[]; // waypoints from entry → garage area → exit
  pitGarageSlots: Vec3[]; // 16 positions, first 8 used in MVP
}
```

Detection is a simple point-in-box check run by Track + Environment each tick, identical to the existing off-track spline check. No Havok involvement.

### Pit Guidance (Car Control Takeover)

When a car enters `pitEntry`:

1. **Pit Stop overrides input** for that car — Physics continues simulating but ignores player throttle/brake/steer while pit state is active. The FixedUpdatePipeline still updates its position.
2. **Deceleration**: Pit Stop calls `physics.setPit(carId, true)`. Physics applies brake force to decelerate smoothly from race speed toward `physics.pitSpeedLimit` (80 km/h) over `pit.speedTransitionTime` seconds using `lerp(currentSpeed, pitSpeedLimit, deltaTime / speedTransitionTime)`.
3. **Spline follower activates** once speed ≤ pitSpeedLimit + epsilon: car position is guided along `pitLaneSpline` at the pit speed limit. The lateral position follows the spline; longitudinal speed is maintained at the limit.
4. **Garage stop**: when car reaches its assigned `pitGarageSlots[teamIndex]`, velocity = 0. Car is stopped.

During `pitStopped`:

- Car position is locked at garage slot
- Engine idles audibly (RPM at idle)
- Refuel and tire change timers start
- Player can press **confirm** (assigned input, e.g. A/cross) — Pit Stop gatekeeps this input: it only reacts when `pitState === 'pitStopped'`. Confirm during pitEntry, departing, or on-track is silently ignored.

When confirm is pressed (or both refuel + tire change complete):

1. Spline follower resumes along pit exit waypoints.
2. Speed climbs to 80 km/h.
3. **Merge check**: before entering the main pit lane flow, the system checks if any car is within 30 m ahead on the exit path. If occupied, wait 200 ms and retry. Once clear, proceed.
4. At `pitExitZone`, control returns to player: Physics re-enables input, speed limit removed.

Guidance system pseudocode:

```typescript
function updateCarOnPitLane(carId: string, dt: number): void {
  const state = pitStates.get(carId);
  if (state === 'onTrack') return;

  const spline = trackConfig.pitLaneSpline;
  const progress = pitProgress.get(carId); // distance along spline [0..totalLength]

  if (state === 'pitEntry') {
    speed = 80 km/h;
    progress += speed * dt;
    car.position = spline.interpolate(progress);
    car.heading = spline.tangent(progress);
    if (progress >= garageStopPoint[teamIndex]) {
      car.velocity = 0;
      pitStates.set(carId, 'pitStopped');
    }
  }

  if (state === 'departing') {
    speed = 80 km/h;
    if (mergeCheckClear(carId)) {
      progress += speed * dt;
      car.position = spline.interpolate(progress);
      car.heading = spline.tangent(progress);
    }
    if (progress >= splineTotalLength) {
      // car crossed exit BoundingBox
      returnControlToPlayer(carId);
    }
  }
}
```

### Refuel

Fuel system exposes `addFuel(carId, amount)`.

- Refuel starts immediately when car reaches `pitStopped`.
- Fuel level increases at `pit.refuelRate` (units/second), up to `maxCapacity`.
- The fuel bar in the pit overlay shows this progress in real time.
- If player presses confirm early, refuel stops at whatever level the tank is at.
- Fuel level carries over into racing — no reset, the car leaves with whatever fuel it has.

```typescript
// Called each tick during pitStopped
if (refuelActive.has(carId)) {
  const added = pit.refuelRate * dt;
  fuelSystem.addFuel(carId, added);
  if (fuelSystem.getFuelLevel(carId) >= fuelConfig.maxCapacity) {
    refuelActive.delete(carId); // tank full
  }
}
```

### Tire Change

Tire Wear system exposes `resetTires(carId)`.

- Tire change starts after a fixed `pit.tireChangeDelay` (~2 s, configurable).
- After the delay elapses, `tireCondition` resets to 1.0 for that car.
- If player presses confirm before the delay completes, the tire change is skipped — tires remain at pre-pit condition.
- Pit overlay shows tire change status: in progress (spinner/dots) → done (checkmark).

```typescript
// Called each tick during pitStopped
if (tireChangeTimer.has(carId)) {
  tireChangeTimer.tick(carId, dt);
  if (tireChangeTimer.elapsed(carId) >= pit.tireChangeDelay) {
    tireWearSystem.resetTires(carId);
    tireChangeTimer.delete(carId);
  }
}
```

### Pit Timing

The total pit stop time is:

```
pitTotal = entryTravelTime + serviceTime + exitWaitTime + exitTravelTime
```

- `entryTravelTime` — distance from entry BBox to garage at 80 km/h (~2–3 s for most tracks)
- `serviceTime` — refuel time + tire change delay (variable based on player's decision to cut service short)
- `exitWaitTime` — merge check delay (0–2 s depending on traffic)
- `exitTravelTime` — garage to exit BBox at 80 km/h (~2–3 s)

Race Management records pitTotal per car as part of race timing. The split is viewable in results.

### AI Pit Strategy

AI cars cycle through the same pit lifecycle, but their decisions are automated:

- **Pit timing**: AI pits when fuelLevel is critical OR tireCondition is critical. No artificial lap window — each team's efficiency/durability rates naturally spread pit windows.
- **Simultaneous pits**: 16 garage slots exist per track (8 active in MVP, one per team). Multiple AI cars can pit in the same lap without queueing — each goes to its own slot. Only pit exit merge is regulated (merge check).
- **exit decision**: AI waits until both refuel and tire change are complete (full fuel, new tires). AI never exits early.
- **Merge priority**: all AI cars respect the same merge check. No special treatment.

---

## States & Transitions

| State          | Description                                                |
| -------------- | ---------------------------------------------------------- |
| **Inactive**   | No race. Pit stop system not initialized.                  |
| **Ready**      | System initialized. Monitoring track zones for entry/exit. |
| **Pit Active** | At least one car is in pitEntry, pitStopped, or departing. |

Transition flow: `Inactive → Ready` (on race init) → `Ready ↔ Pit Active` (as cars enter/leave pit).

---

## Formulas

**Refuel per tick:**

```
fuelAdded = pit.refuelRate × dt
```

**Service time:**

```
serviceTime = max(refuelTime, pit.tireChangeDelay)
// where refuelTime = (maxCapacity - currentFuel) / pit.refuelRate
```

**Pit total time (recorded by Race Management):**

```
pitTotal = entryTravel + serviceTime + exitWait + exitTravel
```

---

## System Interactions

| System                   | Interaction                                                                                                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Track + Environment**  | Provides `pitEntryZone`, `pitExitZone`, `pitLaneSpline`, `pitGarageSlots` per track. Detects zone entry/exit each tick.                                                                                                                                                                                    |
| **Physics/Handling**     | Disables/enables player input per car during pit. Enforces 80 km/h speed cap while pit state active.                                                                                                                                                                                                       |
| **Fuel**                 | Receives `addFuel(carId, amount)`. Provides `fuelLevel` for pit overlay.                                                                                                                                                                                                                                   |
| **Tire Wear**            | Receives `resetTires(carId)` after `pit.tireChangeDelay`.                                                                                                                                                                                                                                                  |
| **Race Management**      | Records `pitTotal` per car for timing.                                                                                                                                                                                                                                                                     |
| **Entity/Car Lifecycle** | Car entity is the same during pit — no spawning/despawning. Pit update runs on existing entity.                                                                                                                                                                                                            |
| **Event Bus**            | Emits `pit.entry` (carId), `pit.exit` (carId, totalTimeMs?) for audio/HUD and Race Management timing. Emits `pit.status` (carId, status: 'idle'\|'pitEntry'\|'pitStopped'\|'departing'), `pit.fuel_status` (carId, fuelLevel, maxFuel), `pit.tire_status` (carId, completed: boolean) for HUD pit overlay. |
| **HUD**                  | Shows pit overlay during pitStopped: fuel bar, tire status, confirm button.                                                                                                                                                                                                                                |
| **Audio**                | Plays pit lane ambient, refuel sound, tire change sound.                                                                                                                                                                                                                                                   |
| **Camera**               | Unchanged — stays in whatever mode it was (cockpit or chase).                                                                                                                                                                                                                                              |
| **Data & Config**        | Provides `pit.refuelRate`, `pit.tireChangeDelay`.                                                                                                                                                                                                                                                          |
| **Input**                | confirm mapped (A/cross or assigned). During pitEntry/departing, throttle/brake/steering ignored.                                                                                                                                                                                                          |

---

## Edge Cases

| Case                                        | Behaviour                                                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **confirm during tire change**              | Tire change skipped. Car leaves with pre-pit tireCondition.                                                           |
| **confirm during refuel**                   | Refuel stops. Car leaves with partial fuel.                                                                           |
| **Both complete, player doesn't confirm**   | Car leaves automatically after a grace period (~3 s).                                                                 |
| **Fuel full but tire change still running** | Tire continues. Car cannot leave until confirm pressed or grace timer fires.                                          |
| **Two cars in pit simultaneously**          | Each tracks its own pitState. Merge check at exit handles spacing.                                                    |
| **Car enters pit on final lap**             | Car goes through full pit cycle. Race Management handles DNF logic based on final crossing.                           |
| **Race ends while car in pit**              | If checkered flag fires while car is in pit, car is scored at its current position.                                   |
| **Merge check stuck (constant traffic)**    | After 5 s of failed merge attempts, force-merge (safely insert, no collision physics during pit).                     |
| **Pit entry zone crossed at high speed**    | Physics ignores input but does not brake instantaneously — transitions smoothly from race speed to 80 km/h over ~1 s. |
| **Refuel rate set to 0**                    | Dev mode. Instant refuel.                                                                                             |
| **pit.tireChangeDelay set to 0**            | Dev mode. Instant tire change.                                                                                        |

---

## Dependencies

| System                   | Dependency Type | Notes                                                                |
| ------------------------ | --------------- | -------------------------------------------------------------------- |
| **Track + Environment**  | Hard            | Provides pit lane spline, zones, garage positions per track.         |
| **Physics/Handling**     | Hard            | Receives pit state per car — disables input, enforces speed limit.   |
| **Fuel**                 | Hard            | Receives refuel commands.                                            |
| **Tire Wear**            | Hard            | Receives tire reset command after delay.                             |
| **Event Bus**            | Hard            | Emits pit entry/exit events.                                         |
| **Entity/Car Lifecycle** | Hard            | Provides CarEntity — pit guidance updates position on existing mesh. |
| **Data & Config**        | Hard            | Refuel rate, tire change delay.                                      |
| **Race Management**      | Hard            | Records pit stop timing per car, applies pitTotal to race result.    |

---

## Tuning Knobs

All knobs are in the `pit.*` namespace.

**Note**: Pit speed limit is defined in Physics GDD as `physics.pitSpeedLimit`. Pit Stop reads this value — no duplicate knob.

| Knob                      | Default | Range   | Description                                                                                                                                                    |
| ------------------------- | ------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pit.refuelRate`          | 2.0     | 0.5–5.0 | Fuel added per second (fraction of maxCapacity)                                                                                                                |
| `pit.tireChangeDelay`     | 2.0     | 0–5.0   | Delay in seconds before tire reset completes                                                                                                                   |
| `pit.exitGraceTimeout`    | 3.0     | 1–10    | Auto-release after both services complete (seconds)                                                                                                            |
| `pit.mergeCheckDistance`  | 30      | 10–50   | Required clear distance ahead for merge (meters)                                                                                                               |
| `pit.mergeCheckInterval`  | 0.2     | 0.1–1.0 | Retry interval for merge check (seconds)                                                                                                                       |
| `pit.forceMergeTimeout`   | 5.0     | 2–10    | After this, force-merge regardless of traffic (seconds)                                                                                                        |
| `pit.speedTransitionTime` | 2.0     | 1.0–4.0 | Seconds to smoothly decelerate from race speed to pit limit. Default conservatively accounts for 300→80 km/h at ~3g (300→80 = 61.1 m/s² ÷ 9.81 ≈ 3.1g over 2s) |

---

## Visual & Audio Requirements

| Element                   | Requirement                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| **Pit overlay**           | HUD panel during pitStopped: fuel bar (0→100%), tire indicator (spinner→check), confirm prompt. |
| **Pit speed enforcement** | No visual change — car slows naturally. Player sees the pit lane go by at 80 km/h.              |
| **Garage visual**         | Team-colored garage box visible in the pit lane (modelled in track geometry).                   |
| **Audio: pit entry**      | Whoosh/Doppler effect as car enters the enclosed pit lane area.                                 |
| **Audio: refuel**         | Low pump sound during refuel.                                                                   |
| **Audio: tire change**    | Impact wrench sound during tire change.                                                         |
| **Audio: pit exit**       | Engine revving up as car leaves pit lane.                                                       |

---

## Acceptance Criteria

1. Car entering pit entry BoundingBox transitions to `pitEntry` state
2. Car speed limited to `physics.pitSpeedLimit` during pit entry/exit
3. Car follows pitLaneSpline waypoints automatically during pit
4. Car stops at assigned garage slot when position matches `pitGarageSlots[teamIndex]`
5. Refuel begins immediately after garage stop, fuel bar shows progress
6. Tire change begins after `tireChangeDelay`, tireCondition resets to 1.0
7. Player can press confirm during pitStopped — leaves with current fuel + tire state
8. If confirm not pressed and both services complete, auto-release after `exitGraceTimeout`
9. Merge check waits 200 ms if car ahead within `mergeCheckDistance`
10. After `forceMergeTimeout` with no gap, car force-merges
11. Car exiting pit exit BoundingBox returns to onTrack — full control restored
12. AI cars execute same pit lifecycle automatically (full fuel, new tires, never early exit)
13. Race Management records `pitTotal` per car
14. Fuel system no-refuel GDD references updated (Phase 1 has refuel during pit)
15. Tire Wear system no-tire-change GDD references updated (Phase 1 has tire change during pit)
16. Two or more cars can be in different pit stages simultaneously without interference
17. `pit.refuelRate = 0` → instant refuel (dev mode)
18. `pit.tireChangeDelay = 0` → instant tire change (dev mode)
19. Force-merge after 5s of continuous traffic prevents softlock
20. Camera position and FOV remain unchanged during pit cycle
