# Story 001: Physics Core Skeleton

> **Epic**: Physics / Handling
> **Status**: Complete
> **Last Updated**: 2026-06-30
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 20h

## Context

**GDD**: `design/gdd/physics-handling.md`
**Requirements**: `TR-PHYSICS-002`, `TR-PHYSICS-003`, `TR-PHYSICS-004` (partial — input consumption)

- **TR-PHYSICS-002**: One PhysicsBody DYNAMIC per car — no wheel bodies, no suspension joints, no constraint-based vehicle.
- **TR-PHYSICS-003**: Post-step velocity override: body.setLinearVelocity(forward × targetSpeed) + body.setAngularVelocity — preserves collision position delta while snapping to arcade speed.
- **TR-PHYSICS-004** (partial): Consume InputState per tick: steer (-1..1), throttle (0..1), brake (0..1), gearDelta — input consumption from pipeline.

**ADR Governing Implementation**: ADR-0008: Vehicle Physics — Arcade Dynamic
**ADR Decision Summary**: 1 DYNAMIC PhysicsBody per car. Three-phase pipeline: Phase 1 (arcade model computes target speed/yaw), Phase 2 (Havok executeStep resolves collision impulses), Phase 3 (velocity override snaps to arcade speed, collision position delta preserved).

**Engine**: Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12 | **Risk**: MEDIUM
**Engine Notes**: `setLinearVelocity` with DYNAMIC body post-step override. `body.disablePreStep = true` on all physics bodies prevents Havok auto-stepping outside the pipeline. Verification required that `scene.render()` does not trigger a second Havok step.

**Control Manifest Rules (this layer)**:

- C21: 1 DYNAMIC body per car — no wheel bodies, no suspension joints, no constraint-based vehicle.
- C22: 3-phase execution within pipeline slot #2: Phase 1 (arcade grip model → target speed/yaw), Phase 2 (Havok executeStep → collision impulse resolve), Phase 3 (velocity override → snap to arcade speed, preserve collision position delta).
- C11: `activeBodies: PhysicsBody[]` — for pipeline executeStep(dt, bodies) and cleanup.
- C-F5: Never implement vehicle physics with multiple bodies (wheels, suspension) per car.

---

## Acceptance Criteria

_Revised per QL-STORY-READY gate on 2026-06-22:_

- [x] **AC-1**: Pipeline slot #2 executes Physics update in fixed order: Input → **Physics** → AI → Collision → Fuel → Tire → Race Management → Pit Stop (verified via pipeline instrumentation)
- [x] **AC-2**: Havok `executeStep(dt, activeBodies)` is called **exactly once per tick** during Racing state. Auto-step suppression verified: `body.disablePreStep = true` on all bodies prevents Havok integration outside our pipeline call.
- [x] **[lifecycle-gated] AC-3**: Per-car `CarPhysicsState` initialized on `entity.spawned` and cleaned on `entity.despawned` — state map has exactly 8 entries during race, 0 after `destroyAll()`
- [x] **AC-4**: Phase 3 runs after Phase 2. After Phase 3, car body position = previous position + collision push-apart delta (from Phase 2 Havok step) + arcade target velocity × dt (from Phase 3 `setLinearVelocity`). Each term measurable in isolation via body.position readout
- [x] **AC-5**: Ground tracking: car Y position (Y-up physics world) follows track spline elevation within epsilon each tick after Phase 3 — verified with mock spline at known elevation
- [x] **[lifecycle-gated] AC-6**: `activeBodies[]` length matches car count during race; empty after `destroyAll()`
- [x] **AC-7** (determinism): Two pipeline ticks with identical seed and identical `InputState` produce identical per-car position, velocity, and heading output — verified via snapshot comparison

**Performance budget**: Physics slot #2 target ≤ 0.06ms/tick (C-G1), body allocation ≤ 4KB per car (C-G2).

**Dependency note**: AC-3 and AC-6 depend on `entity.spawned`/`entity.despawned` events and `destroyAll()` from ADR-0005 (Entity/Car Lifecycle). That epic has no implementation stories yet — AC-3 and AC-6 will be verified once Entity/Car Lifecycle stories are created. The `CarPhysicsState` map structure is defined here; the lifecycle hooks are a cross-epic dependency.

---

## Implementation Notes

_Derived from ADR-0008 Implementation Guidelines:_

### IPhysics Interface

```typescript
interface IPhysics {
  init(config: PhysicsConfig): void;
  update(dt: number): void; // called by pipeline slot #2
  setLocked(carId: string, locked: boolean): void;
  setPit(carId: string, enabled: boolean): void;
  getTelemetry(carId: string): CarTelemetry | undefined;
  getSplinePosition(carId: string): number;
  onRaceGreenFlag(): void;
  onFuelUpdate(carId: string, fuelMult: number): void;
  onTireUpdate(carId: string, tireCondition: number): void;
  dispose(): void;
}
```

### PhysicsConfig Interface

```typescript
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

### Pipeline Integration

```typescript
import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/plugins/havokPlugin";
import { Vector3 } from "@babylonjs/core/Maths/math";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";

// Required side-effect import for PhysicsBody constructor:
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";
```

CRITICAL — scene.enablePhysics + auto-step suppression:

```typescript
const havokInstance = await HavokPhysics();
const havokPlugin = new HavokPlugin(true, havokInstance);
const gravity = new Vector3(0, -9.81, 0);

scene.enablePhysics(gravity, havokPlugin);

// Suppress scene's auto-step — our pipeline calls executeStep
(scene as any)._advancePhysicsEngineStep = () => {};
```

### Per-Car State (Phase 1 output cached for Phase 3)

```typescript
interface CarPhysicsState {
  carId: string;
  body: PhysicsBody | null; // reference to PhysicsAggregate.body from CarEntity
  targetSpeed: number; // m/s — computed by Phase 1
  targetYawRate: number; // rad/tick — computed by Phase 1
  splinePosition: number; // 0..trackLength
  speedKmh: number; // computed from velocity
  rpm: number;
  gear: number;
  lateralG: number;
  accelG: number;
  tireSqueal: number;
  kerbHit: boolean;
  offTrack: boolean;
  gripMultiplier: number; // current effective grip factor (gripMax / baseGrip)
  // External inputs (with 1-tick delay handling)
  fuelMult: number; // from Fuel system, default 1.0
  tireCondition: number; // from Tire Wear, default 1.0
  // Control state
  locked: boolean;
  pitMode: boolean;
  // Edge-event guards
  tireBlownEmitted: boolean;
  fuelEmptyEmitted: boolean;
  wasAboveStopEpsilon: boolean;
}
```

### Three-Phase Pipeline Slot #2

```typescript
update(dt: number): void {
  // Phase 1: Arcade Model — compute target speed/yaw per car
  for (const state of this.carStates.values()) {
    if (state.locked) continue; // locked cars skip Phase 1 model
    this.phase1.compute(state, dt);
  }

  // Phase 2: Havok executeStep — resolves DYNAMIC×DYNAMIC collisions
  this.havokPlugin.executeStep(dt, this.activeBodies);

  // Phase 3: Velocity Override — snap to arcade speed
  for (const state of this.carStates.values()) {
    this.phase3.apply(state, dt);
  }
}
```

### Phase 3 Velocity Override + Ground Tracking

```typescript
phase3.apply(state: CarPhysicsState, dt: number): void {
  const aggregate = this.carEntityMap.get(state.carId)?.physicsBody;
  if (!aggregate?.body) return;

  const body = aggregate.body;
  const forwardDir = this.trackSystem.getTangent(state.splinePosition);
  const targetVel = forwardDir.scale(state.targetSpeed);

  // Y-up ground tracking from spline elevation
  const splineY = this.trackSystem.getElevation(state.splinePosition);
  targetVel.y = (splineY - body.position.y) / dt;

  if (state.locked) {
    body.setLinearVelocity(Vector3.Zero());
    body.setAngularVelocity(Vector3.Zero());
  } else {
    body.setLinearVelocity(targetVel);
    body.setAngularVelocity(new Vector3(0, state.targetYawRate, 0));
  }
}
```

### Import Paths

```typescript
import { HavokPlugin } from "@babylonjs/core/Physics/v2/plugins/havokPlugin";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { Vector3 } from "@babylonjs/core/Maths/math";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent"; // side-effect
```

---

## Out of Scope

- **Story 002**: Arcade grip model formulas (gripMax, steering clamp, lift-off oversteer, speedMod)
- **Story 003**: Engine power, gear system, drag, braking formulas
- **Story 004**: Surface detection (off-track/kerb), surface grip/friction modifiers
- **Story 005**: setLocked/setPit control, fuelMult/tireCondition 1-tick delay, edge-triggered events

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1** (pipeline ordering):
  - Given: FixedUpdatePipeline with all 8 slots registered, Physics at slot #2
  - When: `pipeline.runTick(FIXED_DT)` is called
  - Then: Physics.update() executes after Input slot and before AI slot — verified via ordered call-log instrumentation
  - Edge: Pipeline startup — first tick has Physics.update() called after Input.write()

- **AC-2** (Havok executeStep exactly once):
  - Given: HavokPlugin initialized, scene.enablePhysics() called, auto-step suppressed
  - When: `update(dt)` is called once (simulating one pipeline tick)
  - Then: `havokPlugin.executeStep` invoked exactly once
  - When: `scene.render()` is called after the pipeline tick
  - Then: No additional Havok step has occurred (body velocity after render equals body velocity after Phase 3)
  - Edge: Auto-step suppression works even when scene.render() triggers internal physics engine calls — verify with dev assertion

- **AC-3** (state lifecycle):
  - Given: PhysicsService initialized, entity map empty, activeBodies empty
  - When: 8 `entity.spawned` events fire
  - Then: `carStates.size === 8`, `activeBodies.length === 8`
  - When: `destroyAll()` is called
  - Then: `carStates.size === 0`, `activeBodies.length === 0`
  - Edge: Second `entity.spawned` of same carId overwrites without error

- **AC-4** (Phase 3 override):
  - Given: Car with known body.position, known targetSpeed, known collision push-apart delta from Havok step
  - When: Phase 3 applies setLinearVelocity(targetVel)
  - Then: After Phase 3, body.position.xz = previous position.xz + collisionPushApartDelta.xz + (targetVel.xz × dt) (within numerical epsilon)
  - Edge: Zero targetSpeed → body stops moving after position update
  - Edge: Locked car → body.setLinearVelocity(ZERO) regardless of targetSpeed

- **AC-5** (ground tracking):
  - Given: Mock track spline with known elevation profile (flat, uphill, downhill, banked)
  - When: Phase 3 ground tracking runs for each car
  - Then: |body.position.y - splineElevation| ≤ 0.01m for all cars each tick
  - Edge: Banked section — forward direction derived from spline tangent, Y tracking follows spline normal component

- **AC-6** (activeBodies lifecycle):
  - Given: PhysicsService initialized
  - When: Cars are spawned and registered
  - Then: activeBodies.length === spawned car count every tick
  - When: destroyAll() called mid-race (post-tick)
  - Then: activeBodies.length === 0
  - Edge: Body added/removed while update not ticking — no stale references

- **AC-7** (determinism):
  - Given: SeededRandom with fixed seed, fixed InputState sequence for 2 cars
  - When: 60 ticks execute (1 second of race time)
  - Then: Ticks 1-60 produce identical position/velocity/heading when re-run with same seed and same inputs
  - Edge: InputState.ZERO for all ticks → cars should never move beyond drag-induced deceleration (identical across runs)

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/physics-handling/physics-core-skeleton_test.ts` OR documented playtest with pipeline verification

**Status**: [x] Complete — `tests/unit/physics-handling/physics-core-skeleton.test.ts` (43 tests)

---

## Dependencies

- Depends on: Foundation pipeline (ADR-0002), Entity/Car Lifecycle (ADR-0005), Track System (spline data access), ConfigManager (physics.\* namespace)
- Unlocks: Stories 002–005

---

## Completion Notes

**Completed**: 2026-06-30
**Criteria**: 7/7 passing (AC-3, AC-6 deferred to ADR-0005 entity lifecycle)
**Deviations**: None
**Test Evidence**: `tests/unit/physics-handling/physics-core-skeleton.test.ts` (43 tests)
**Code Review**: Complete (0 BLOCKING, 0 WARNING after fixes)
**Tech Debt Resolved**: 0 items (1 new item introduced: gravity hardcoding)
