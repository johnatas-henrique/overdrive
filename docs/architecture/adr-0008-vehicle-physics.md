# ADR-0008: Vehicle Physics

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12                                                                                                                                                                                                                                                                                                                                                               |
| **Domain**                | Vehicle Physics                                                                                                                                                                                                                                                                                                                                                                                            |
| **Knowledge Risk**        | MEDIUM — Havok Physics V2 `setLinearVelocity` override with DYNAMIC body, manual `executeStep` (verified in ADR-0002)                                                                                                                                                                                                                                                                                      |
| **References Consulted**  | VERSION.md, modules/physics.md, physics-handling.md GDD, collision.md GDD, ADR-0002 (fixed timestep), ADR-0005 (entity lifecycle)                                                                                                                                                                                                                                                                          |
| **Post-Cutoff APIs Used** | `PhysicsAggregate` (stable); `PhysicsBody.setLinearVelocity()` (stable); `executeStep(dt, bodies)` (stable)                                                                                                                                                                                                                                                                                                |
| **Verification Required** | DYNAMIC body with post-step velocity override preserves collision impulse position delta; `collisionEndedObservable` fires with correct impulse magnitude; verify `(scene as any)._advancePhysicsEngineStep = () => {}` suppression actually prevents double-stepping in v9.12 (specialist flagged risk that `scene.render()` may call `_physicsEngine._step()` directly, bypassing the suppressed method) |

## ADR Dependencies

| Field             | Value                                                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Depends On**    | ADR-0006 (Input — IInput.getState() for steer/throttle/brake/gear), ADR-0002 (Fixed Timestep Pipeline — slot #2), ADR-0005 (Entity/Car Lifecycle — PhysicsAggregate on CarEntity)       |
| **Enables**       | Collision (contact callbacks), Fuel (consumes throttle integral), Tire Wear (consumes lateral load), Camera (telemetry), Audio (telemetry), AI Driver (needs same arcade model context) |
| **Blocks**        | All simulation systems (Fuel, Tire, AI, Collision) depend on Physics telemetry                                                                                                          |
| **Ordering Note** | Init slot #4 (after Camera #3, before Collision #5). Pipeline slot #2 (after Input #1, before AI #3).                                                                                   |

## Context

### Problem Statement

Move the car around the track in response to player input. The car must feel arcade-responsive: planted up to a lateral grip limit, responsive to lift-off oversteer, and with speed-dependent steering. Collisions (car↔car, car↔barrier) must feel present — cars push apart physically — but the arcade grip model must reassert control immediately. No suspension simulation, no tire temperature, no weight transfer.

The physics-handling GDD defines the model in detail: `gripMax = baseGrip × cornerStat × tireCondition × speedMod` (the primary feel formula), lift-off oversteer, velocity-dependent steering, and auto-shift with manual override.

### Constraints

- Fixed timestep only (1/60s). Never runs in render loop (ADR-0002).
- Deterministic: same seed + same inputs → same trajectory (ADR-0002).
- Collision GDD requires `collision.impact` with real impulse magnitude — contact callbacks must fire.
- GDD says "no suspension geometry, no tire temperature, no weight transfer" — zero multibody dynamics.
- GDD says "car always on ground" — no airborne, no jumps in Phase 1.
- Convex hull shape (from car mesh) per ADR-0005.
- 8 cars in MVP, each with one PhysicsBody.

### Requirements

- Receive InputState steer (-1..1) / throttle (0..1) / brake (0..1) / gearDelta (-1/0/+1) per tick
- Produce car position, velocity, heading each tick
- Emit telemetry: speedKmh, rpm, gear, lateralG, accelG, tireSqueal (0-1), kerbHit flag
- Support setLocked(carId, bool) — grid start and pit stop
- Support setPit(carId, bool) — pit lane speed enforcement with smooth deceleration
- Handle fuelMult (0..1 from Fuel system) → engine power scaling
- Handle tireCondition (0..1 from Tire Wear system) → grip scaling
- Emit car.tire_blown, car.fuel_empty, car.stopped events
  - `car.stopped` is **edge-triggered**: emitted once when velocity crosses below `stopEpsilon` from above. It does NOT fire every tick while the car is stationary. Hysteresis prevents chatter near the epsilon boundary.

## Decision

### Architecture: Arcade Dynamic (C+)

One PhysicsBody DYNAMIC per car. No wheel bodies, no suspension joints, no constraint-based vehicle. The arcade grip model computes target velocity each tick. Havok processes collisions naturally (DYNAMIC × DYNAMIC). A post-step velocity override snaps the car to arcade speed while preserving the collision position delta.

```
FixedUpdatePipeline slot #2 (Physics/Handling):
  │
  ├─ Phase 1: arcadeModel.updateAll(dt)
  │   Read:  InputState (steer/throttle/brake/gear), carStats, tireCondition, fuelMult
  │   Calc:  gripMax, targetSpeed, targetYawRate, rpm, gear, lateralG, tireSqueal
  │   Store: CarEntity.physicsTelemetry (published to Camera/Audio/HUD)
  │
  ├─ Phase 2: havokPlugin.executeStep(dt, activeBodies)
  │   Havok: resolves DYNAMIC×DYNAMIC and DYNAMIC×STATIC contacts
  │   Side:  contact callbacks fire → collision.impact events emitted
  │
  └─ Phase 3: velocityOverride.updateAll()
      Read:  targetSpeed, targetYawRate from Phase 1
      Write: body.setLinearVelocity(forward × targetSpeed)
             body.setAngularVelocity(new Vector3(0, targetYawRate, 0))
      Note:  velocity snaps — collision position delta persists
```

### Key Interfaces

```typescript
interface IPhysics {
  init(config: PhysicsConfig): void;
  update(dt: number): void; // called by pipeline slot #2
  setLocked(carId: string, locked: boolean): void;
  setPit(carId: string, enabled: boolean): void;
  getTelemetry(carId: string): CarTelemetry | undefined;
  /** Spline position (0..trackLength) for lap detection and position sorting.
   *  Written by Physics slot #2 every tick. Read by Race Management slot #7. */
  getSplinePosition(carId: string): number;

  // Event Bus subscriptions
  onRaceGreenFlag(): void;
  onFuelUpdate(carId: string, fuelMult: number): void;
  onTireUpdate(carId: string, tireCondition: number): void;

  dispose(): void;
}

interface CarTelemetry {
  speedKmh: number;
  rpm: number;
  gear: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  lateralG: number;
  accelG: number;
  tireSqueal: number; // 0..1
  kerbHit: boolean;
  offTrack: boolean;
}

interface PhysicsConfig {
  baseGrip: number;
  steerClampSpeed: number;
  steerMinRatio: number;
  liftOffRearFactor: number;
  liftOffMinSteering: number;
  liftOffThrottleMax: number;
  dragCoeff: number;
  maxBrakeForce: number;
  pitSpeedLimit: number;
  offTrackFriction: number;
  offTrackGripFactor: number;
  offTrackMinSpeed: number;
  kerbGripLoss: number;
  speedModRefSpeed: number;
  speedModMinFactor: number;
  autoShiftRpmThreshold: number;
  rpmMax: number;
  minGripFactor: number;
  stopEpsilon: number;
  carHalfWidth: number;
  topSpeedL1toL5: [number, number, number, number, number];
  accelerationL1toL5: [number, number, number, number, number];
  corneringL1toL5: [number, number, number, number, number];
}
```

### Arcade Model (Phase 1)

#### Lateral Grip

```
gripMax = baseGrip × cornerStat(corneringLevel) × tireCondition × speedMod
speedMod = lerp(0.5, 1.0, clamp(speed / speedModRefSpeed, 0, 1))
cornerStat(level) = 0.6 + (level - 1) × 0.1
```

Applied as lateral acceleration limit. If the car's lateral demand exceeds gripMax, the car understeers (heading does not follow steering input fully).

#### Steering / Yaw Rate

```
steeringLimit = steerMax × clamp(1 - speed / steerClampSpeed, steerMinRatio, 1.0)
targetYawRate = steerInput × steeringLimit  (in radians/tick)
```

Steering is progressively clamped by speed. At high speed, only `steerMinRatio` fraction of steering remains.

#### Lift-Off Oversteer

```
if throttle < 0.05 AND brake < 0.05 AND |steerInput| > 0.1:
  rearGripMult = liftOffRearFactor  // default 0.7
  // grip imbalance creates rotation boost → car tucks into corner
  targetYawRate += rotationBoost  // additive rotation assist
```

#### Engine Power

```
targetSpeed = computeTargetSpeed(throttle, brake, gear, rpm, fuelMult, powerCeiling)
// Internal formula in GDD: power = torqueCurve(rpm) × throttle × fuelMult × powerCeiling
// Determines acceleration force applied as speed delta per tick
```

#### Drag

```
dragForce = dragCoeff × speed²
Applied as deceleration opposing velocity direction.
```

### Velocity Override (Phase 3)

```typescript
for each active car:
  const aggregate = carEntity.physicsBody;  // PhysicsAggregate from ADR-0005
  if (!aggregate?.body) continue;           // null guard (entity not spawned yet)
  const body = aggregate.body;

  const forwardDir = trackSystem.getTangent(car.splinePosition);  // from spline, not mesh
  const targetVel = forwardDir.scale(targetSpeed);

  // Vertical ground tracking: Y from spline elevation (Y-up physics world)
  const splineY = trackSystem.getElevation(car.splinePosition);
  targetVel.y = (splineY - body.position.y) / dt;

  body.setLinearVelocity(targetVel);
  body.setAngularVelocity(new Vector3(0, targetYawRate, 0));
```

The velocity override happens AFTER Havok's `executeStep()`. This means:

- Collision impulses were already integrated into body positions during the step
- `body.position` reflects the collision push-apart
- Velocity snaps back to arcade target on the same tick
- Net effect: cars visually bump but never lose arcade speed

### Collision GDD Compatibility

Since the body is DYNAMIC and Havok processes all DYNAMIC×DYNAMIC contacts during `executeStep()`:

- **`onCollisionObservable`** fires `IPhysicsCollisionEvent` with real `impulse`, `point`, and `normal` data for collision detection
- **`onCollisionEndedObservable`** fires `IBasePhysicsCollisionEvent` (no impulse field, no point/normal) — contact separation tracking only
- Collision system (ADR-0010) subscribes to `onCollisionObservable` for impact detection and impulse magnitude
- The Collision GDD's `collision.impact(carId, impulse, direction)` is sourced from `IPhysicsCollisionEvent.impulse` on the collision-start event
- Collision GDD acceptance criteria satisfied without modification

### Lock / Pit Mode

```typescript
setLocked(carId: string, locked: boolean): void {
  if (locked) {
    // Phase 3 sets velocity = 0 — car stays at grid position
    this.lockedCars.add(carId);
  } else {
    this.lockedCars.delete(carId);
  }
}

setPit(carId: string, enabled: boolean): void {
  // Phase 1 clamps targetSpeed to pitSpeedLimit
  // Physics applies smooth brake force toward limit over pit.speedTransitionTime
}
```

Locked cars still receive Phase 1 model updates (for visual purposes), but Phase 3 sets velocity to 0 and angular velocity to 0.

### Ground Tracking (Y-up Physics World)

The car is always on the ground (GDD Core Rule #1). In Babylon.js 9.12 with Havok, the physics world uses Y-up (gravity at Vector3(0, -9.81, 0)). The vertical component (Y) follows the track spline elevation at the car's current spline position, applied as a velocity-based correction:

```typescript
// Phase 3 — Y-up physics world ground tracking
const forwardDir = car.getForwardDirection(); // derived from track spline tangent
const targetVel = forwardDir.scale(targetSpeed);

// Vertical ground tracking: Y from spline elevation
const splineY = trackSystem.getElevation(car.splinePosition);
targetVel.y = (splineY - body.position.y) / dt;

body.setLinearVelocity(targetVel);
body.setAngularVelocity(new Vector3(0, targetYawRate, 0));
```

No Havok constraint needed — the Y velocity correction keeps the car on the surface without fighting the physics solver. On banked track sections, `getForwardDirection()` must derive from the track spline's tangent vector (not the car mesh's local forward), ensuring the car follows the banking naturally.

**Note**: Direct `body.position` manipulation (e.g., snapping) would require `disablePreStep = true` or `PrestepType.TELEPORT`. Velocity-based ground tracking avoids this — the body remains in normal simulation flow.

## Alternatives Considered

### Alternative A: Kinematic Car + Havok Collision

- **Description**: Chassis as PhysicsBody kinematic, movement via `setPosition()`. Havok detects collisions but kinematic bodies receive zero impulse.
- **Rejection Reason**: Kinematic bodies cannot generate meaningful `collision.impact` impulse data. Two kinematic cars pass through each other. Violates Collision GDD AC #1 and #2. Contradicts ADR-0005's `physicsBody: PhysicsAggregate` (mass implies DYNAMIC).

### Alternative B: Full Havok Vehicle (SixDofJoint + HingeJoint)

- **Description**: Chassis DYNAMIC + 4 wheel spheres + SixDofJoint suspension + HingeJoint motor. 5 bodies + 8 joints per car.
- **Rejection Reason**: 40 bodies + 64 joints for 8 cars. Making suspension rigid (stiffness=100000) causes numerical instability at 60Hz. Micro-rotations from constraint compliance leak subtle body roll that fights the arcade model. GDD explicitly says "no suspension, no weight transfer." Entire complexity is wasted — the GDD's formulas would replace Havok's vehicle physics anyway.

### Alternative C: Dynamic Arcade (velocity override)

- **Description**: DYNAMIC body, `setLinearVelocity()` post-Havok-step. Suspension-free, wheel-free.
- **Accepted as C+** with three-phase pipeline (model → collision → override).

## Consequences

### Positive

- Arcade grip model maps directly to `setLinearVelocity()` / `setAngularVelocity()` — no force tuning
- Collision impulse data is real (Havok DYNAMIC × DYNAMIC)
- Deterministic: arcade model math + fixed dt Havok = reproducible output
- Body count: 8 DYNAMIC bodies, 0 joints — trivial for Havok (~0.05ms/tick)
- Lock/pit mode trivially implemented (skip or clamp velocity)
- GDD "no suspension" constraint is enforced by physical impossibility (no suspension joints exist)

### Negative

- Velocity override means collisions never cause lasting speed loss — "arcade bump" feel. If playtesting wants more dramatic collisions, add `physics.collisionRecoveryRate` knob for lerp blend.
- Ground tracking must be done manually (Z from spline) — no suspension to auto-follow terrain.
- Body position from collision step is approximate (Havok resolves position, velocity overrides next tick). Position delta is preserved but velocity override may slightly fight collision resolution in edge cases.

### Risks

- **Risk**: DYNAMIC body with setLinearVelocity every tick fights Havok's velocity integration
  **Mitigation**: Known pattern (documented by Babylon.js team). Position delta persists because Havok already integrated step position. Velocity is overwritten each tick — no accumulation conflict.
- **Risk**: Vertical velocity from collision (car pushed upward) conflicts with ground tracking
  **Mitigation**: Ground tracking via Y-velocity correction overwrites collision vertical component each tick. Car snaps back to spline elevation — acceptable for Phase 1 (no airborne).

## GDD Requirements Addressed

| GDD System          | Requirement                         | How This ADR Addresses It                                                   |
| ------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| physics-handling.md | Arcade grip model (gripMax formula) | Phase 1 arcadeModel computes gripMax → understeer if demand exceeds limit   |
| physics-handling.md | Lift-off oversteer                  | rotationBoost added to targetYawRate when throttle=0 and steering>threshold |
| physics-handling.md | Velocity-dependent steering         | steeringLimit clamped by speed, applied to targetYawRate                    |
| physics-handling.md | Locked on grid / pit mode           | setLocked() zeroes velocity; setPit() clamps targetSpeed                    |
| physics-handling.md | Fuel and tire effects on physics    | fuelMult scales power; tireCondition scales gripMax                         |
| physics-handling.md | Telemetry to Camera/Audio/HUD       | CarTelemetry struct published each tick                                     |
| collision.md        | collision.impact with real impulse  | DYNAMIC × DYNAMIC contact callsbacks provide real impulse magnitude         |
| collision.md        | Collision GDD AC #1 and #2          | Satisfied via Havok collision resolution on DYNAMIC bodies                  |

## Performance Implications

- **CPU**: Phase 1 (arcade model for 8 cars) ≈ 0.005ms. Phase 2 (Havok step, 8 DYNAMIC bodies) ≈ 0.05ms. Phase 3 (velocity override, 8 bodies) ≈ 0.002ms. Total ≈ 0.06ms/tick.
- **Memory**: 8 PhysicsBody × ~500 bytes = ~4KB. No joints, no wheel bodies.
- **Load Time**: Havok WASM instantiation (async) during init — ~50-200ms.

## Validation Criteria

- [ ] Car turns tighter at low speed than high speed (steering clamp verified)
- [ ] Car understeers if steering demand exceeds gripMax (visible push wide)
- [ ] Lift-off oversteer produces visible extra rotation toward apex
- [ ] Two identical seeds + identical inputs produce identical trajectories
- [ ] Collision between two cars produces `collision.impact` with impulse > 0
- [ ] Cars visually push apart after collision (position delta persists)
- [ ] setLocked(true) → car velocity = 0 regardless of input
- [ ] setPit(true) → targetSpeed clamped to pitSpeedLimit
- [ ] fuelMult = 0 → engine power → 0; car coasts to stop
- [ ] tireCondition = 0 → grip drops to minGripFactor (0.15); engine power unaffected
- [ ] Car Z position tracks ground spline height always (Y in physics world, velocity-based)
- [ ] OnCollisionObservable fires `IPhysicsCollisionEvent` with impulse > 0 for car↔car contact
- [ ] OnCollisionEndedObservable fires without impulse data (separation tracking only)
- [ ] Off-track applies 6× friction, 70% grip reduction

## Related Decisions

- ADR-0002 (Fixed Timestep Pipeline — Physics is slot #2, Havok manual step)
- ADR-0005 (Entity/Car Lifecycle — PhysicsAggregate convex hull, 800 kg)
- ADR-0006 (Input Abstraction — IInput.getState() consumed by Physics)
- ADR-0009 (Collision Model — consumes contact callbacks from Havok step)
- ADR-0010 (Fuel Model — consumes throttle integral, provides fuelMult)
- ADR-0011 (Tire Model — consumes lateral load, provides tireCondition)
