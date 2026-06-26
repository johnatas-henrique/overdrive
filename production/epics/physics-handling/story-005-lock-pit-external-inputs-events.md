# Story 005: Lock, Pit, External Inputs & Edge Events

> **Epic**: Physics / Handling
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 12h

## Context

**GDD**: `design/gdd/physics-handling.md`
**Requirements**: `TR-PHYSICS-005`, `TR-PHYSICS-006`, `TR-PHYSICS-007`, `TR-PHYSICS-008`, `TR-PHYSICS-009`

- **TR-PHYSICS-005**: setLocked(carId, bool) — grid start lock (all cars) and pit stop lock (single car); locked car has zero velocity and ignores input.
- **TR-PHYSICS-006**: setPit(carId, bool) — pit lane speed enforcement (pit limiter) with smooth acceleration/deceleration.
- **TR-PHYSICS-007**: fuelMult (0..1 from Fuel system) scales engine power output linearly.
- **TR-PHYSICS-008**: tireCondition (0..1 from Tire Wear system) scales gripMax proportionally.
- **TR-PHYSICS-009**: Emit car.tire_blown, car.fuel_empty, car.stopped events via Event Bus — edge-triggered with hysteresis.

**ADR Governing Implementation**: ADR-0008: Vehicle Physics — Arcade Dynamic
**ADR Decision Summary**: setLocked zeroes velocity in Phase 3 regardless of input. setPit clamps targetSpeed to pitSpeedLimit with linear deceleration profile. fuelMult and tireCondition delivered with 1-tick delay. Edge-triggered events use hysteresis guard to prevent re-emission and chatter.

**Engine**: Babylon.js 9.12.0 | **Risk**: MEDIUM
**Engine Notes**: Event Bus integration for edge-triggered events. Fuel/Tire systems (own ADRs) deliver values asynchronously via Event Bus — Physics subscribes via `onFuelUpdate`/`onTireUpdate`.

**Control Manifest Rules (this layer)**:

- C24: `setLocked(carId, bool)` — velocity = 0 regardless of input.
- C25: `setPit(carId, bool)` — target speed clamped to pitSpeedLimit with smooth deceleration.
- C26: `fuelMult = 0` → engine power = 0, car coasts to stop. Delivered with 1-tick delay.
- C27: `tireCondition = 0` → grip drops to minGripFactor (0.15), engine power unaffected. Delivered with 1-tick delay.
- C28: `car.stopped` is edge-triggered — emitted once when velocity crosses below stopEpsilon from above. Hysteresis prevents chatter.

---

## Acceptance Criteria

_Revised per QL-STORY-READY gate on 2026-06-22:_

- [ ] **AC-1**: `setLocked(carId, true)` → Phase 3 sets velocity = 0 and angular velocity = 0 regardless of input; `setLocked(carId, false)` restores normal behavior
- [ ] **AC-2**: `setPit(carId, true)` → targetSpeed clamped to pitSpeedLimit (80 km/h). Car speed decreases from current speed to pitSpeedLimit within `pit.speedTransitionTime` seconds (from `pit.*` config namespace via ConfigManager, default: 2.0s) following a **linear ramp** (not instant snap). Verified at multiple speed→limit transition points. `setPit(carId, false)` → normal speed restored
- [ ] **AC-3**: `onFuelUpdate(carId, fuelMult)` — fuelMult = 0 → engine power output = 0 regardless of throttle; car coasts using remaining momentum (drag-only, no active braking)
- [ ] **AC-4**: `onTireUpdate(carId, tireCondition)` — tireCondition = 0 → grip drops to minGripFactor (0.15). **Quantified**: max cornering speed at tireCondition=0 is <33% of max cornering speed at tireCondition=1.0 for the same steering input and speed. Engine power output is unchanged
- [ ] **AC-5**: `car.tire_blown` emitted on Event Bus when tireCondition → 0 — one-shot guard prevents re-emission
- [ ] **AC-6**: `car.fuel_empty` emitted on Event Bus when fuelMult → 0 — one-shot guard prevents re-emission
- [ ] **AC-7**: `car.stopped` emitted (edge-triggered, hysteresis) when velocity crosses below stopEpsilon from above — does NOT fire every tick while stationary. Once emitted, guard prevents re-emission until velocity rises above stopEpsilon + hysteresis band and crosses again
- [ ] **AC-8**: fuelMult and tireCondition have 1-tick delay — new value takes effect on the tick AFTER receipt

---

## Implementation Notes

_Derived from ADR-0008 Implementation Guidelines:_

### setLocked

```typescript
private lockedCars: Set<string> = new Set();

setLocked(carId: string, locked: boolean): void {
  if (locked) {
    this.lockedCars.add(carId);
  } else {
    this.lockedCars.delete(carId);
  }
}

// Applied in Phase 3:
if (this.lockedCars.has(state.carId)) {
  aggregate.body.setLinearVelocity(Vector3.Zero());
  aggregate.body.setAngularVelocity(Vector3.Zero());
  return; // skip arcade velocity override
}
```

### setPit (with linear ramp)

```typescript
private pitCars: Set<string> = new Set();
private pitSpeedLimit: number; // from PhysicsConfig

setPit(carId: string, enabled: boolean): void {
  if (enabled) {
    this.pitCars.add(carId);
  } else {
    this.pitCars.delete(carId);
  }
}

// Applied in Phase 1 target speed computation:
function applyPitLimiter(
  targetSpeed: number,
  currentSpeed: number,
  pitSpeedLimit: number,
  isPitMode: boolean,
  transitionTime: number,
  dt: number
): number {
  if (!isPitMode) return targetSpeed;

  // Linear ramp toward pitSpeedLimit
  const speedDiff = currentSpeed - pitSpeedLimit;
  if (Math.abs(speedDiff) < 0.1) return pitSpeedLimit; // near-zero → snap to limit

  const maxStep = (currentSpeed / transitionTime) * dt; // linear decel/accel rate
  const clampedDiff = Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), maxStep);
  return currentSpeed - clampedDiff;
}
```

### fuelMult / tireCondition (1-tick delay)

```typescript
private pendingFuelUpdate: Map<string, number> = new Map();
private pendingTireUpdate: Map<string, number> = new Map();

onFuelUpdate(carId: string, fuelMult: number): void {
  // Store for next tick — 1-tick delay
  this.pendingFuelUpdate.set(carId, fuelMult);
}

onTireUpdate(carId: string, tireCondition: number): void {
  this.pendingTireUpdate.set(carId, tireCondition);
}

// Called at the START of each update(dt) — apply pending values before Phase 1:
private applyPendingUpdates(): void {
  for (const [carId, fuelMult] of this.pendingFuelUpdate) {
    const state = this.carStates.get(carId);
    if (state) state.fuelMult = fuelMult;
  }
  this.pendingFuelUpdate.clear();

  for (const [carId, tireCondition] of this.pendingTireUpdate) {
    const state = this.carStates.get(carId);
    if (state) state.tireCondition = tireCondition;
  }
  this.pendingTireUpdate.clear();
}
```

### Edge-Triggered Events

```typescript
// Checked after Phase 1 computes state:

function checkEdgeEvents(state: CarPhysicsState, eventBus: IEventBus): void {
  // tire_blown — one-shot guard
  if (state.tireCondition <= 0 && !state.tireBlownEmitted) {
    state.tireBlownEmitted = true;
    eventBus.emit("car.tire_blown", { carId: state.carId });
  }

  // fuel_empty — one-shot guard
  if (state.fuelMult <= 0 && !state.fuelEmptyEmitted) {
    state.fuelEmptyEmitted = true;
    eventBus.emit("car.fuel_empty", { carId: state.carId });
  }

  // car.stopped — edge-triggered with hysteresis
  const isBelowEpsilon = state.speedMs < config.stopEpsilon;
  if (isBelowEpsilon && state.wasAboveStopEpsilon) {
    // Edge: was above, now below → emit once
    eventBus.emit("car.stopped", { carId: state.carId });
  }
  // Hysteresis: re-arm when speed rises above stopEpsilon + 50% margin
  state.wasAboveStopEpsilon = state.speedMs > config.stopEpsilon * 1.5;
}
```

### Event Bus Integration

```typescript
// Subscribe in init():
this.subscriptions = [
  eventBus.on("race.green.flag", () => this.onRaceGreenFlag()),
  // fuelMult and tireCondition updates arrive via onFuelUpdate/onTireUpdate
  // called directly by Fuel and Tire systems (not Event Bus — per-frame data)
];
```

---

## Out of Scope

- **Story 001**: Pipeline registration, Havok init, Phase 2/3 skeleton
- **Story 002**: Core gripMax formula (tireCondition scales gripMax, but formula lives in Story 002)
- **Story 003**: Engine power formula (fuelMult scales power, but formula lives in Story 003)
- **Story 004**: Surface-specific grip modifiers (composed with tireCondition grip penalty in Story 002)

---

## QA Test Cases

_Written by qa-lead at story creation:_

- **AC-1** (setLocked):
  - Given: Car at speed = 200 km/h, PhysicsService with lock set to false
  - When: `setLocked(carId, true)` is called, Phase 3 applies
  - Then: body.linearVelocity === Vector3.Zero() and body.angularVelocity === Vector3.Zero()
  - When: `setLocked(carId, false)` is called, Phase 3 applies
  - Then: body.linearVelocity === arcade target velocity (normal behavior restored)
  - Edge: Locked car receives collision impulse → position delta persists, velocity stays zero

- **AC-2** (setPit linear ramp):
  - Given: Car at speed = 250 km/h, pitSpeedLimit = 80 km/h, transitionTime = 2.0s
  - When: `setPit(carId, true)` called at tick N
  - Then: targetSpeed at tick N+1 = currentSpeed - (250 / 2.0 × dt) (linear ramp)
  - When: speed reaches 80 km/h (FINE_TOLERANCE)
  - Then: targetSpeed clamps to 80 km/h (no oscillation)
  - When: `setPit(carId, false)` called
  - Then: pit limiter removed, targetSpeed returns to normal arcade computation
  - Edge: speed already below pitSpeedLimit when setPit(true) called → no deceleration needed; transitionTime = 0 → instant snap to limit

- **AC-3** (fuelMult → power):
  - Given: EngineModel, fuelMult = 1.0, throttle = 1.0, powerCeiling = 1.0
  - When: onFuelUpdate(carId, 0) is called
  - Then: current tick still uses fuelMult = 1.0 (1-tick delay)
  - When: next tick starts → state.fuelMult = 0
  - Then: power = torqueCurve × throttle × 0 × powerCeiling = 0 regardless of torque
  - Edge: fuelMult returns to 1.0 → power restored next tick; fuelMult = 0 at tick N, throttle released tick N+1 → power still 0 (fuel dead)

- **AC-4** (tireCondition → grip):
  - Given: ArcadeModel, gripMax at tireCondition=1.0 = 9.0, speed = same, steerInput = 1.0
  - When: onTireUpdate(carId, 0) → next tick: tireCondition = 0, grip = 9.0 × 0.15 = 1.35
  - Then: max cornering speed at tireCondition=0 is <33% of max cornering speed at tireCondition=1.0 for same steering input
  - Edge: Engine power output is identical at tireCondition=0 vs 1.0 (verified via power formula); tireCondition = 0.4 → grip = 9.0 × 0.4 = 3.6 (linear)

- **AC-5** (car.tire_blown):
  - Given: car.tireBlownEmitted = false, tireCondition = 0.01 (above zero)
  - When: tireCondition drops to 0 → checkEdgeEvents()
  - Then: `car.tire_blown` emitted once with payload `{ carId }`, tireBlownEmitted = true
  - When: checkEdgeEvents() called again same tick and subsequent ticks
  - Then: `car.tire_blown` NOT re-emitted (guard prevents re-emission)
  - Edge: tireCondition recovers above 0 → guard still prevents re-emission; tireCondition stays at 0 for entire race → single emission only

- **AC-6** (car.fuel_empty):
  - Given: car.fuelEmptyEmitted = false, fuelMult = 0.01 (above zero)
  - When: fuelMult drops to 0 → checkEdgeEvents()
  - Then: `car.fuel_empty` emitted once with payload `{ carId }`, fuelEmptyEmitted = true
  - Edge: Same one-shot pattern as tire_blown

- **AC-7** (car.stopped edge-triggered):
  - Given: stopEpsilon = 0.01, car velocity = 5.0 m/s, wasAboveStopEpsilon = true
  - When: velocity drops to 0.005 m/s (below epsilon) → checkEdgeEvents()
  - Then: `car.stopped` emitted once with payload `{ carId }`
  - When: car remains stationary for 60 ticks (velocity ≈ 0)
  - Then: `car.stopped` NOT emitted again
  - When: car is pushed by collision, velocity rises to 0.1 m/s (> stopEpsilon × 1.5 = 0.015)
  - Then: wasAboveStopEpsilon resets to true
  - When: velocity drops below epsilon again
  - Then: `car.stopped` emitted again (second edge)
  - Edge: Velocity hovers around epsilon → hysteresis prevents chatter (0.012 → 0.008 → 0.011 → 0.007 does NOT re-trigger; must cross above 0.015 first)

- **AC-8** (1-tick delay):
  - Given: state.fuelMult = 0.5, pendingFuelUpdate = empty
  - When: onFuelUpdate(carId, 0) called mid-tick
  - Then: pendingFuelUpdate = { carId: 0 }, state.fuelMult still = 0.5
  - When: current Phase 1 runs → uses state.fuelMult = 0.5 (correct — old value)
  - When: next tick starts, applyPendingUpdates() called
  - Then: state.fuelMult = 0 (new value applied)
  - Edge: Two onFuelUpdate calls before next tick → only last value stored (overwrite); onFuelUpdate with same value → still delayed 1 tick

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/physics-handling/lock-pit-events_test.ts` OR documented playtest

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Stories 001-004 (all prior stories must be DONE — this story integrates all control interfaces)
- Unlocks: Collision (car.stopped event), Fuel system (consumes throttle integral), Tire Wear (consumes lateral load), Race Management (grid lock, DNF from car.stopped)
