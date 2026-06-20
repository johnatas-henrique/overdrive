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

The player sees the pit entry cone approaching, passes the bounding box, and immediately feels the car slow to 80 km/h as steering is taken over. The car guides itself along the pit lane, stopping exactly at the team garage. An overlay appears: a fuel bar filling in real time, a tire change indicator, and a flashing "EXIT" prompt.

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
2. **Spline follower activates**: car position is set along `pitLaneSpline` at a constant 80 km/h (22.22 m/s).
3. **Speed enforcement**: Physics clamps velocity to 80 km/h. Any throttle input is ignored. Brake input ignored (spline follower handles deceleration toward garage stop).
4. **Garage stop**: when car reaches its assigned `pitGarageSlots[teamIndex]`, velocity = 0. Car is stopped.

During `pitStopped`:

- Car position is locked at garage slot
- Engine idles audibly (RPM at idle)
- Refuel and tire change timers start
- Player can press EXIT (assigned input, e.g. A/cross) at any time

When EXIT is pressed (or both refuel + tire change complete):

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
- Fuel level increases at `pit.refuel_rate` (units/second), up to `max_fuel`.
- The fuel bar in the pit overlay shows this progress in real time.
- If player presses EXIT early, refuel stops at whatever level the tank is at.
- Fuel level carries over into racing — no reset, the car leaves with whatever fuel it has.

```typescript
// Called each tick during pitStopped
if (refuelActive.has(carId)) {
  const added = pit.refuel_rate * dt;
  fuelSystem.addFuel(carId, added);
  if (fuelSystem.getFuelLevel(carId) >= fuelConfig.max_capacity) {
    refuelActive.delete(carId); // tank full
  }
}
```

### Tire Change

Tire Wear system exposes `resetTires(carId)`.

- Tire change starts after a fixed `pit.tire_change_delay` (~2 s, configurable).
- After the delay elapses, `tire_condition` resets to 1.0 for that car.
- If player presses EXIT before the delay completes, the tire change is skipped — tires remain at pre-pit condition.
- Pit overlay shows tire change status: in progress (spinner/dots) → done (checkmark).

```typescript
// Called each tick during pitStopped
if (tireChangeTimer.has(carId)) {
  tireChangeTimer.tick(carId, dt);
  if (tireChangeTimer.elapsed(carId) >= pit.tire_change_delay) {
    tireWearSystem.resetTires(carId);
    tireChangeTimer.delete(carId);
  }
}
```

### Pit Timing

The total pit stop time is:

```
pit_total = entry_travel_time + service_time + exit_wait_time + exit_travel_time
```

- `entry_travel_time` — distance from entry BBox to garage at 80 km/h (~2–3 s for most tracks)
- `service_time` — refuel time + tire change delay (variable based on player's EXIT decision)
- `exit_wait_time` — merge check delay (0–2 s depending on traffic)
- `exit_travel_time` — garage to exit BBox at 80 km/h (~2–3 s)

Race Management records pit_total per car as part of race timing. The split is viewable in results.

### AI Pit Strategy

AI cars cycle through the same pit lifecycle, but their decisions are automated:

- **Pit timing**: AI pits when fuel_level is critical OR tire_condition is critical. No artificial lap window — each team's efficiency/durability rates naturally spread pit windows.
- **Simultaneous pits**: 16 garage slots exist per track (8 active in MVP, one per team). Multiple AI cars can pit in the same lap without queueing — each goes to its own slot. Only pit exit merge is regulated (merge check).
- **EXIT decision**: AI waits until both refuel and tire change are complete (full fuel, new tires). AI never exits early.
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
fuel_added = pit.refuel_rate × dt
```

**Service time:**

```
service_time = max(refuel_time, tire_change_delay)
// where refuel_time = (max_fuel - current_fuel) / pit.refuel_rate
```

**Pit total time (recorded by Race Management):**

```
pit_total = entryTravel + serviceTime + exitWait + exitTravel
```

---

## System Interactions

| System                   | Interaction                                                                                                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Track + Environment**  | Provides `pitEntryZone`, `pitExitZone`, `pitLaneSpline`, `pitGarageSlots` per track. Detects zone entry/exit each tick.                                                                                                                                                                                    |
| **Physics/Handling**     | Disables/enables player input per car during pit. Enforces 80 km/h speed cap while pit state active.                                                                                                                                                                                                       |
| **Fuel**                 | Receives `addFuel(carId, amount)`. Provides `fuel_level` for pit overlay.                                                                                                                                                                                                                                  |
| **Tire Wear**            | Receives `resetTires(carId)` after `tire_change_delay`.                                                                                                                                                                                                                                                    |
| **Race Management**      | Records `pit_total` per car for timing.                                                                                                                                                                                                                                                                    |
| **Entity/Car Lifecycle** | Car entity is the same during pit — no spawning/despawning. Pit update runs on existing entity.                                                                                                                                                                                                            |
| **Event Bus**            | Emits `pit.entry` (carId), `pit.exit` (carId, totalTimeMs?) for audio/HUD and Race Management timing. Emits `pit.status` (carId, status: 'idle'\|'pitEntry'\|'pitStopped'\|'departing'), `pit.fuel_status` (carId, fuelLevel, maxFuel), `pit.tire_status` (carId, completed: boolean) for HUD pit overlay. |
| **HUD**                  | Shows pit overlay during pitStopped: fuel bar, tire status, EXIT button.                                                                                                                                                                                                                                   |
| **Audio**                | Plays pit lane ambient, refuel sound, tire change sound.                                                                                                                                                                                                                                                   |
| **Camera**               | Unchanged — stays in whatever mode it was (cockpit or chase).                                                                                                                                                                                                                                              |
| **Data & Config**        | Provides `pit.refuel_rate`, `pit.tire_change_delay`.                                                                                                                                                                                                                                                       |
| **Input**                | EXIT key mapped (A/cross or assigned). During pitEntry/departing, throttle/brake/steering ignored.                                                                                                                                                                                                         |

---

## Edge Cases

| Case                                        | Behaviour                                                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **EXIT during tire change**                 | Tire change skipped. Car leaves with pre-pit tire_condition.                                                          |
| **EXIT during refuel**                      | Refuel stops. Car leaves with partial fuel.                                                                           |
| **Both complete, player doesn't EXIT**      | Car leaves automatically after a grace period (~3 s).                                                                 |
| **Fuel full but tire change still running** | Tire continues. Car cannot leave until EXIT pressed or grace timer fires.                                             |
| **Two cars in pit simultaneously**          | Each tracks its own pitState. Merge check at exit handles spacing.                                                    |
| **Car enters pit on final lap**             | Car goes through full pit cycle. Race Management handles DNF logic based on final crossing.                           |
| **Race ends while car in pit**              | If checkered flag fires while car is in pit, car is scored at its current position.                                   |
| **Merge check stuck (constant traffic)**    | After 5 s of failed merge attempts, force-merge (safely insert, no collision physics during pit).                     |
| **Pit entry zone crossed at high speed**    | Physics ignores input but does not brake instantaneously — transitions smoothly from race speed to 80 km/h over ~1 s. |
| **Refuel rate set to 0**                    | Dev mode. Instant refuel.                                                                                             |
| **tire_change_delay set to 0**              | Dev mode. Instant tire change.                                                                                        |

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
| **Race Management**      | Hard            | Records pit stop timing per car, applies pit_total to race result.   |

---

## Tuning Knobs

All knobs are in the `pit.*` namespace.

**Note**: Pit speed limit is defined in Physics GDD as `physics.pit_speed_limit`. Pit Stop reads this value — no duplicate knob.

| Knob                        | Default | Range   | Description                                                 |
| --------------------------- | ------- | ------- | ----------------------------------------------------------- |
| `pit.refuel_rate`           | 2.0     | 0.5–5.0 | Fuel added per second (fraction of max_fuel)                |
| `pit.tire_change_delay`     | 2.0     | 0–5.0   | Delay in seconds before tire reset completes                |
| `pit.exit_grace_timeout`    | 3.0     | 1–10    | Auto-release after both services complete (seconds)         |
| `pit.merge_check_distance`  | 30      | 10–50   | Required clear distance ahead for merge (meters)            |
| `pit.merge_check_interval`  | 0.2     | 0.1–1.0 | Retry interval for merge check (seconds)                    |
| `pit.force_merge_timeout`   | 5.0     | 2–10    | After this, force-merge regardless of traffic (seconds)     |
| `pit.speed_transition_time` | 1.0     | 0.5–3.0 | Seconds to smoothly transition from race speed to pit limit |

---

## Visual & Audio Requirements

| Element                   | Requirement                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| **Pit overlay**           | HUD panel during pitStopped: fuel bar (0→100%), tire indicator (spinner→check), EXIT prompt. |
| **Pit speed enforcement** | No visual change — car slows naturally. Player sees the pit lane go by at 80 km/h.           |
| **Garage visual**         | Team-colored garage box visible in the pit lane (modelled in track geometry).                |
| **Audio: pit entry**      | Whoosh/Doppler effect as car enters the enclosed pit lane area.                              |
| **Audio: refuel**         | Low pump sound during refuel.                                                                |
| **Audio: tire change**    | Impact wrench sound during tire change.                                                      |
| **Audio: pit exit**       | Engine revving up as car leaves pit lane.                                                    |

---

## Acceptance Criteria

1. ✅ Car entering pit entry BoundingBox transitions to `pitEntry` state
2. ✅ Car speed limited to `pit_speed_limit` during pit entry/exit
3. ✅ Car follows pitLaneSpline waypoints automatically during pit
4. ✅ Car stops at assigned garage slot when position matches `pitGarageSlots[teamIndex]`
5. ✅ Refuel begins immediately after garage stop, fuel bar shows progress
6. ✅ Tire change begins after `tire_change_delay`, tire_condition resets to 1.0
7. ✅ Player can press EXIT during pitStopped — leaves with current fuel + tire state
8. ✅ If EXIT not pressed and both services complete, auto-release after `exit_grace_timeout`
9. ✅ Merge check waits 200 ms if car ahead within `merge_check_distance`
10. ✅ After `force_merge_timeout` with no gap, car force-merges
11. ✅ Car exiting pit exit BoundingBox returns to onTrack — full control restored
12. ✅ AI cars execute same pit lifecycle automatically (full fuel, new tires, never early exit)
13. ✅ Race Management records `pit_total` per car
14. ✅ Fuel system no-refuel GDD references updated (Phase 1 has refuel during pit)
15. ✅ Tire Wear system no-tire-change GDD references updated (Phase 1 has tire change during pit)
16. ✅ Two or more cars can be in different pit stages simultaneously without interference
17. ✅ `pit.refuel_rate = 0` → instant refuel (dev mode)
18. ✅ `pit.tire_change_delay = 0` → instant tire change (dev mode)
19. ✅ Force-merge after 5s of continuous traffic prevents softlock
20. ✅ Camera position and FOV remain unchanged during pit cycle
