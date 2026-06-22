# ADR-0014: Pit Stop Flow

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Engine**                | Babylon.js 9.12.0                                                                                                                                            |
| **Domain**                | Simulation — Pit Stop                                                                                                                                        |
| **Knowledge Risk**        | LOW — no Babylon API usage; pure TypeScript state machine + spline interpolation                                                                             |
| **References Consulted**  | pit-stop.md GDD, ADR-0008 (Physics — setPit API), ADR-0011 (Fuel — addFuel), ADR-0012 (Tire — resetTires), ADR-0001 (Event Bus), ADR-0002 (Pipeline slot #8) |
| **Post-Cutoff APIs Used** | None                                                                                                                                                         |

## ADR Dependencies

| Field          | Value                                                                                                                                                                                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Depends On** | ADR-0008 (IPhysics — setPit, brakeCar), ADR-0011 (IFuel — addFuel), ADR-0012 (ITireWear — resetTires), ADR-0001 (Event Bus), ADR-0002 (pipeline slot #8), ADR-0004 (Module Boundary — Pit Stop is a standalone Core system with mutable API), ADR-0006 (Input — confirm event, Pit Stop gatekeeps) |
| **Enables**    | Race Management (records pitTotal), HUD (pit overlay)                                                                                                                                                                                                                                              |
| **Blocks**     | ADR-0015 (Race Management — pit timing recording)                                                                                                                                                                                                                                                  |

## Context

### Problem Statement

AI and player cars must enter the pit lane, stop at their assigned garage, receive fuel and tire service, and return to the track — all without disrupting the main race simulation. Pit Stop is a per-car state machine that temporarily overrides the car's normal physics input.

### Constraints

- Pit Stop does NOT import Babylon APIs — it's a pure state machine over spline data
- Pit Stop does NOT own a pipeline slot for physics operations — it operates at slot #8 (after all simulation systems)
- During pit entry/depart, Pit Stop writes position and heading directly — Physics is still ticking but its input is suppressed
- Pit Stop reads confirm from Input system, gatekeeping it to `pitState === 'pitStopped'`
- No crew animation, no tire compound selection in Phase 1
- AI pit timing is delegated to Pit Stop (AI Driver does not decide when to pit — Pit Stop owns the trigger)

### Requirements

- Per-car pit state machine: `onTrack → pitEntry → pitStopped → departing → onTrack`
- Spatial detection via Track BoundingBox zones (not Event Bus — Track evaluates every tick)
- Speed limiting to `physics.pitSpeedLimit` during pit entry/exit
- Spline-based guidance along `pitLaneSpline` during pit entry/exit
- Garage stop at `pitGarageSlots[teamIndex]`
- Refuel via `IFuel.addFuel()` at `pit.refuelRate`
- Tire change via `ITireWear.resetTires()` after `pit.tireChangeDelay`
- Player confirm (early exit) or grace timeout auto-release
- Merge check at pit exit (200ms retry, force-merge at 5s)
- Event Bus emissions for HUD and Audio

## Decision

### Havok Coordination — Velocity-Driven Approach (No Position Override)

**Critical design decision**: Pit Stop does NOT set position/heading directly during pitEntry or departing. Direct position override on a DYNAMIC PhysicsBody creates an oscillation cycle:

```
Tick N:
  Slot #2: Physics Fase 3 → body.setLinearVelocity(forward × 22.2 m/s)
  Slot #8: Pit Stop → body.setPosition(splinePos)           ← overwrites
Tick N+1:
  Slot #2: executeStep() → integrates velocity: pos' = splinePos + 0.37m ← Havok moves car
  Slot #8: Pit Stop → body.setPosition(splinePos')          ← corrects back ← VIBRATION
```

**Solution**: Pit Stop drives the car via velocity targets, not position overrides. Physics Fase 3 honors the pit velocity override when `setPit(carId, true)` is active.

```typescript
// Pit Stop tick() during pitEntry / departing:
const direction = spline.tangent(currentProgress);
const targetVelocity = direction.scale(pitSpeedLimit);
physics.setPitVelocity(carId, targetVelocity, direction); // velocity + heading

// Physics Fase 3 (ADR-0008): if pit velocity is set for this car, use it:
if (pitVelocityMap.has(carId)) {
  body.setLinearVelocity(targetVelocity);
  // NO arcade model computation for this car while in pit mode
}
```

This eliminates oscillation entirely — Pit Stop controls velocity, Havok integrates it naturally.

### Pit Stopped — Car Must Be Fully Locked

During `pitStopped`, the car must be stationary. `setPit()` only limits speed — it does NOT zero velocity. The transition `pitEntry → pitStopped` calls `physics.setLocked(carId, true)` (ADR-0008 Fase 3 zeros velocity and prevents further integration). The transition `pitStopped → departing` calls `physics.setLocked(carId, false)` before setting the pit velocity override.

### confirm Event — Requires playerCarId

The global `confirm` pulse from ADR-0006 does not carry a `carId`. Pit Stop stores `playerCarId` from `RaceConfiguration` and resolves the confirm target to the player's car:

```typescript
init(config: RaceConfiguration): void {
  this.playerCarId = config.playerCarId;
}

onConfirm(): void {   // no carId — resolved internally
  if (pitStates.get(this.playerCarId) !== 'pitStopped') return;
  transitionToDeparting(this.playerCarId);
}
```

### Architecture

```
                   ┌──────────┐
                   │  onTrack  │
                   └─────┬─────┘
              Track detects pitEntryZone collision
                         │
                         ▼
                   ┌──────────┐
                   │ pitEntry │   ← physics.setPit(carId, true)
                   └────┬─────┘
                        │ progress along pitLaneSpline >= garageStopPoint
                        ▼
                  ┌─────────────┐
                  │ pitStopped  │ ← physics.setLocked(carId, true)
                  └──────┬──────┘
              tires done + (confirm OR refuel done + grace timeout)
                         │
                         ▼
                   ┌───────────┐
                   │ departing │ ← physics.setLocked(carId, false)
                   └─────┬─────┘    physics.setPitVelocity(carId, forward·pitSpeed)
              spline progress >= totalLength AND mergeCheckClear
                         │
                         ▼
                   ┌──────────┐
                   │  onTrack  │ ← physics.setPit(carId, false)
                   └──────────┘
```

### State Transition Table

| From       | To         | Trigger                                                                                                                                           | Action                                                                                                                                 |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| onTrack    | pitEntry   | Track detects car center in `pitEntryZone` BoundingBox                                                                                            | Emit `pit.entry(carId)`. Call `physics.setPit(carId, true)`. Set progress = 0.                                                         |
| pitEntry   | pitStopped | Spline progress >= garageStopPoint                                                                                                                | Call `physics.setLocked(carId, true)`. Start refuel timer. Start tire change timer. Emit `pit.status(carId, 'pitStopped')`.            |
| pitStopped | departing  | confirm (available after tires done — leave with fresh tires + partial fuel) OR (refuel done + tires done + grace timeout — leave with full tank) | Call `physics.setLocked(carId, false)`. Call `physics.setPitVelocity(carId, forward·pitSpeed)`. Emit `pit.status(carId, 'departing')`. |
| departing  | onTrack    | Car crosses `pitExitZone` BoundingBox                                                                                                             | Call `physics.setPit(carId, false)`. Emit `pit.exit(carId, totalTimeMs)`. Clear all pit state.                                         |

### Key Interfaces

```typescript
interface IPitStop {
  init(
    track: ITrack,
    fuel: IFuel,
    tireWear: ITireWear,
    physics: IPhysicsWrite
  ): void;
  tick(dt: number): void; // pipeline slot #8
  /** Called by Track when car enters or exits a pit zone */
  onZoneEntry(carId: string, zone: "pitEntry" | "pitExit"): void;

  getPitState(carId: string): PitState;
  getPitTimer(carId: string): PitTimer | undefined; // for HUD overlay
  confirmPitExit(carId: string): void; // called by Input gating
  dispose(): void;
}

type PitState = "onTrack" | "pitEntry" | "pitStopped" | "departing";

interface PitTimer {
  /** Fuel data for overlay */
  fuelLevel: number;
  maxFuel: number;
  /** Tire data for overlay */
  tireDone: boolean;
  tireTimer: number;
  /** Service completion */
  refuelDone: boolean;
}
```

### Pit Guidance — Velocity-Driven Approach (Not Position Override)

During `pitEntry` and `departing`, Pit Stop drives the car via velocity targets:

```typescript
function tick(dt: number): void {
  for each car in pitStates:
    if state === 'pitEntry' or 'departing':
      // Advance spline progress
      const newProgress = progress + pitSpeedLimit * dt;
      pitProgress.set(carId, newProgress);

      // Get pit lane direction at current progress
      const direction = spline.tangent(newProgress);

      // Set velocity override — Physics Fase 3 applies it directly,
      // no arcade model computation for this car
      physics.setPitVelocity(carId, direction.scale(pitSpeedLimit), direction);

      if state === 'pitStopped':
        // physics.setLocked() already called — car is stationary
        processServices(carId, dt);
}

// On pitExit zone:
function returnToTrack(carId: string): void {
  physics.setPit(carId, false);  // restore normal input
}
```

### Refuel & Tire Change During pitStopped

**Tire change is binary**: it always completes after `pit.tireChangeDelay`. The player cannot leave before tires are done. **Refuel is progressive**: the player can leave early with partial fuel after tires complete.

```typescript
// Called each tick for each car in pitStopped
function processServices(carId: string, dt: number): void {
  // Refuel — progressive, always active
  const currentFuel = fuel.getFuelLevel(carId);
  if (currentFuel < fuel.maxCapacity) {
    const added = pit.refuelRate * dt;
    fuel.addFuel(carId, added);
  }

  // Tire change — binary, always completes
  if (!tireTimer.has(carId)) {
    tireTimer.set(carId, 0);
  }
  const elapsed = tireTimer.get(carId) + dt;
  tireTimer.set(carId, elapsed);
  if (elapsed >= pit.tireChangeDelay) {
    tireWear.resetTires(carId);
    tireTimer.delete(carId);
  }

  // confirm only becomes available after tires are done
  const tiresDone = tireTimer.has(carId) === false;
  this.tiresDone.set(carId, tiresDone);
}
```

### Merge Check

```typescript
function canMerge(carId: string): boolean {
  const exitProgress = pitProgress.get(carId);
  for each otherCar in pitStates:
    if otherCar.state === 'departing' || otherCar.state === 'pitEntry':
      const aheadDistance = pitProgress.get(otherCar) - exitProgress;
      if (0 < aheadDistance < mergeCheckDistance) {
        return false;  // car ahead too close
      }
  return true;
}
```

Merge check runs every tick during `departing`. If blocked, car holds position. After `forceMergeTimeout` seconds of continuous blocking, force-merge (safe insertion, no collision during pit transit).

### AI Pit Strategy

Pit Stop owns the AI pit timing trigger (not AI Driver):

```typescript
function tick(dt: number): void {
  // AI pit trigger — runs before per-car state machine
  for each AI car in onTrack:
    const fuelLevel = fuel.getFuelLevel(carId);
    const tireCond = tireWear.getTireCondition(carId);
    if (fuelLevel <= fuelCriticalThreshold || tireCond <= tireCriticalThreshold):
      // AI will pit when its spline progress next reaches pit entry zone
      pendingPit.set(carId, true);  // flag: pit on next pass of entry zone
}
```

This happens during the `tick()` call, before individual car state transitions. AI cars never exit early — they always wait for both services to complete (full fuel + fresh tires). No confirm button for AI; departure is automatic when both services finish.

### confirm Gatekeeping

Pit Stop subscribes to the `confirm` input event but only processes it when `pitState === 'pitStopped'`:

```typescript
// Pit Stop subscribes to confirm event (ADR-0006), resolves to playerCarId:
onConfirm(): void {
  const carId = this.playerCarId;
  if (pitStates.get(carId) !== 'pitStopped') return;   // ignore non-pit
  if (!this.tiresDone.get(carId)) return;               // ignore — tires still changing
  transitionToDeparting(carId);                          // exit with partial fuel, fresh tires
}
```

The `confirm` action is defined in ADR-0006 as a global pulse. Pit Stop is one of multiple consumers that gatekeep it by current state.

## Alternatives Considered

### Alternative 1: Physics handles all pit lane transit (no direct position override)

- **Pit Stop tells Physics "follow spline at 80 km/h"**, Physics computes the movement via its normal step.
- **Rejected**: Physics would need spline query APIs and a special "pit mode" per body. Direct position/heading override is simpler and doesn't couple Physics to track geometry. Physics already has `setPit(carId, true)` to suppress input — adding spline-follow inside Physics would be a layering violation.

### Alternative 2: Pit Stop as Race Management sub-system

- Pit Stop was proposed as a sub-system of Race Management during architecture review.
- **Rejected**: Pit Stop has independent state (per-car, independent of race counters), manages lifecycle via Track zones (not RM), and needs to exist before RM in init order. Keeping Pit Stop as a standalone Core system with a clear `IPitStop` interface makes it testable in isolation.

## Consequences

### Positive

- Pit Stop is pure TypeScript — zero Babylon imports, fully testable with vitest
- Per-car state machine prevents any cross-car interference (16 independent pit slots)
- confirm gating via state check is simple and unambiguous (no complex routing)
- Merge check prevents pit exit collisions without needing Havok sensors
- AI pit timing is deterministic (triggered by fuel/tire thresholds, not random lap windows)

### Negative

- Pit Stop directly overrides position/heading during pit transit — violates the principle that only Physics or Collision moves cars. Acceptable because pit transit is a brief, deterministic sequence that doesn't interact with race physics.
- Merge check uses simple distance check, not Havok overlap query. Risk: two cars on spline with different egress angles may have a distance check that passes but a visual overlap occurs. Mitigation: exit path tangents are designed so cars exit in sequence along the same line — no cross-angle paths.

### Risks

- **Risk**: Car enters pit at 300+ km/h, setPit suppresses input but car doesn't slow fast enough
  **Mitigation**: Physics applies brake force via `physics.brakeCar(carId, force)` over `speedTransitionTime` (default 2s). The transition time is conservative for 300→80 km/h at ~3g.
- **Risk**: Two cars force-merge simultaneously, overlapping in pit exit
  **Mitigation**: Force-merge inserts cars sequentially (one per tick) with safe clearance. The forceMergeTimeout is staggered per-car (jittered by 100ms).

## GDD Requirements Addressed

| GDD System  | Requirement                          | How This ADR Addresses It                            |
| ----------- | ------------------------------------ | ---------------------------------------------------- |
| pit-stop.md | Pit lifecycle (5 states)             | Direct state machine implementation                  |
| pit-stop.md | Spatial detection via BoundingBox    | Track evaluates per tick, calls IPitStop.onZoneEntry |
| pit-stop.md | Speed limiting to 80 km/h            | physics.setPit + brakeCar for deceleration           |
| pit-stop.md | Spline guidance                      | Pit Stop writes position/heading directly            |
| pit-stop.md | Refuel via IFuel.addFuel             | processServices in pitStopped section                |
| pit-stop.md | Tire change via ITireWear.resetTires | processServices with timer                           |
| pit-stop.md | Player confirm / grace timeout       | confirm gating + exitGraceTimeout                    |
| pit-stop.md | Merge check                          | canMerge() with retry/force                          |
| pit-stop.md | AI pit strategy delegated            | AI trigger in tick(), before per-car state machine   |

## Performance Implications

- **CPU**: per-pitting-car state machine tick: ~0.001ms (spline interpolation + service timers)
- **Memory**: per-car PitTimer (fuelLevel, tireTimer flags) × 8 AI + 1 player = ~200 bytes total

## Validation Criteria

- [ ] Car entering pitEntryZone transitions to pitEntry
- [ ] Car speed limited to 80 km/h during pit entry
- [ ] Car follows pitLaneSpline from entry to garage
- [ ] Car stops at assigned garage slot
- [ ] Refuel increases fuelLevel at pit.refuelRate
- [ ] Tire change resets tireCondition to 1.0 after tireChangeDelay
- [ ] Player confirm during pitStopped (after tires done) exits with fresh tires + current fuel level
- [ ] Grace timeout auto-releases after both services complete
- [ ] Merge check waits if car ahead within mergeCheckDistance
- [ ] Force-merge after forceMergeTimeout
- [ ] Car exiting pitExitZone returns to onTrack with full control
- [ ] Two AI cars pit simultaneously without interference
- [ ] AI car pits when fuel or tire hits critical threshold
- [ ] AI never exits early (waits for both services complete)
- [ ] pit.refuelRate = 0 → instant refuel
- [ ] pit.tireChangeDelay = 0 → instant tire change

## Related Decisions

- ADR-0008 (Physics — setPit API for input suppression + speed limiting)
- ADR-0011 (Fuel — addFuel for refueling)
- ADR-0012 (Tire — resetTires for tire change)
- ADR-0001 (Event Bus — pit.entry, pit.status, pit.exit events)
- ADR-0002 (Pipeline slot #8 — lowest priority, after all simulation systems)
- ADR-0006 (Input — confirm action gated by pitState)
- ADR-0015 (Race Management — records pitTotal per car)
