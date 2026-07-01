# Story 003: Engine, Gears, Drag, Braking

> **Epic**: Physics / Handling
> **Status**: Complete
> **Last Updated**: 2026-06-30
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 10h

## Context

**GDD**: `design/gdd/physics-handling.md`
**Requirement**: `TR-PHYSICS-010`

- **TR-PHYSICS-010**: Auto-shift logic with manual override via gearDelta; gear ratios configurable via car stats.

**ADR Governing Implementation**: ADR-0008: Vehicle Physics — Arcade Dynamic
**ADR Decision Summary**: targetSpeed computed from engine power (torqueCurve × throttle × fuelMult × powerCeiling), drag (dragCoeff × speed²), and braking (brakeInput × maxBrakeForce). Auto-shift at rpmMax threshold with manual gearDelta override. 6 forward gears + reverse + neutral.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure math — engine model is formula-driven, no Babylon.js APIs required beyond targetSpeed output fed to Phase 3.

**Control Manifest Rules (this layer)**:

- C21: 1 DYNAMIC body per car — no wheel bodies, no suspension joints.
- C22: Phase 1 (arcade model) includes target speed computation.

---

## Acceptance Criteria

_From QL-STORY-READY gate — all ADEQUATE (minor clarifications noted):_

- [ ] **AC-1**: RPM computed as `min(speed / gearRatio[gear] × gearRatio[1], rpmMax)` — RPM increases with speed, capped at rpmMax
- [ ] **AC-2**: Auto-shift triggers when RPM > rpmMax × autoShiftRpmThreshold (default 0.95) — upshift to next gear; at max gear (6) no shift occurs
- [ ] **AC-3**: Manual gearDelta override: +1 shifts up, -1 shifts down, 0 leaves auto-shift in control; invalid gear changes clamped to valid gear range (gear 1-6)
- [ ] **AC-4**: 6 forward gears + reverse + neutral — reverse only when stopped (speed < stopEpsilon) AND brake held AND downshift past 1st; neutral between gear 1 and reverse (no power transmission, engine idles)
- [ ] **AC-5**: Brake > throttle override: `brake > 0` → net force = brake + drag (throttle contribution = 0)
- [ ] **AC-6**: dragForce = dragCoeff × speed² × sign(-speed) — drag opposes velocity, scales quadratically
- [ ] **AC-7**: Power output: power = torqueCurve(rpm) × throttle × fuelMult × powerCeiling — zero when fuelMult=0 or throttle=0
- [ ] **AC-8** (elevation): Uphill gradient reduces net acceleration proportionally; downhill increases it — verified against track gradient data at multiple angles
- [ ] **AC-9** (zero-input coast): All analog inputs at zero → speed decreases by drag + rolling friction only — no auto-brake, no auto-steer

---

## Implementation Notes

_Derived from ADR-0008 Implementation Guidelines:_

### RPM Calculation

```typescript
function computeRpm(
  speedMs: number,
  gear: number,
  gearRatios: number[],
  rpmMax: number
): number {
  if (gear === 0) return 0; // neutral — no load RPM
  const ratio = gearRatios[gear]; // gearRatios[1] = 1st gear, etc.
  const gearRatioFirst = gearRatios[0]; // gearRatio[1]
  if (ratio === 0) return rpmMax; // guard against division by zero (shouldn't happen)
  return Math.min((speedMs / ratio) * gearRatioFirst, rpmMax);
}
```

### Torque Curve

```typescript
function computeTorque(
  rpm: number,
  accelLevel: number,
  rpmMax: number
): number {
  // accelLevel 1-5 maps to a torque curve multiplier
  // Higher level = more area under the curve → better acceleration
  const baseTorque = 1.0; // normalized torque from curve shape
  // Simple model: peak torque at 70% rpmMax, linear falloff
  const normalizedRpm = rpm / rpmMax;
  const curveValue =
    normalizedRpm <= 0.7
      ? normalizedRpm / 0.7 // linear rise to peak
      : 1 - (normalizedRpm - 0.7) / 0.3; // linear falloff to 0
  const accelMultiplier = ACCEL_MAP[accelLevel]; // [1.0, 1.08, 1.16, 1.22, 1.3]
  return Math.max(0, baseTorque * curveValue * accelMultiplier);
}
```

### Power Output to targetSpeed

```typescript
function computeTargetSpeed(
  state: EngineState,
  inputs: { throttle: number; brake: number; gearDelta: -1 | 0 | 1 },
  dt: number,
  config: EngineConfig
): number {
  // Step 1: Process gear input
  state.gear = applyGearDelta(
    state.gear,
    inputs.gearDelta,
    inputs.brake,
    state.speedMs,
    config
  );

  // Step 2: Compute RPM
  state.rpm = computeRpm(
    state.speedMs,
    state.gear,
    config.gearRatios,
    config.rpmMax
  );

  // Auto-shift
  if (inputs.gearDelta === 0) {
    state.gear = autoShift(
      state.rpm,
      state.gear,
      config.rpmMax,
      config.autoShiftRpmThreshold
    );
    state.rpm = computeRpm(
      state.speedMs,
      state.gear,
      config.gearRatios,
      config.rpmMax
    );
  }

  // Step 3: Power output
  const torque = computeTorque(state.rpm, config.accelLevel, config.rpmMax);
  const power = torque * inputs.throttle * state.fuelMult * config.powerCeiling;

  // Step 4: Forces
  let netForce = power; // positive = acceleration

  // Drag (always present, opposes motion)
  netForce -=
    config.dragCoeff *
    state.speedMs *
    state.speedMs *
    Math.sign(state.speedMs || 1);

  // Brake (overrides throttle)
  if (inputs.brake > 0) {
    netForce =
      -(inputs.brake * config.maxBrakeForce) -
      config.dragCoeff *
        state.speedMs *
        state.speedMs *
        Math.sign(state.speedMs || 1);
  }

  // Elevation modifier (GDD Core Rule #8)
  if (state.gradient !== 0) {
    netForce -= 9.81 * state.gradient; // gravity component along slope
  }

  // Step 5: Apply as speed delta
  state.speedMs = Math.max(0, state.speedMs + (netForce / state.mass) * dt);
  return state.speedMs;
}
```

### Gear System

```typescript
const GEAR_COUNT = 6;
enum Gear {
  Reverse = -1,
  Neutral = 0,
  First = 1,
  Second = 2,
  Third = 3,
  Fourth = 4,
  Fifth = 5,
  Sixth = 6,
}

function applyGearDelta(
  currentGear: number,
  delta: -1 | 0 | 1,
  brake: number,
  speedMs: number,
  config: GearConfig
): number {
  if (delta === 0) return currentGear; // auto-shift in control

  const newGear = currentGear + delta;

  // Clamp to valid range (forward gears 1-6)
  if (newGear > GEAR_COUNT) return GEAR_COUNT;
  if (newGear < -1) return -1; // reverse is min

  // Reverse gate: stopped + brake + downshift past 1st
  if (newGear === 0 && currentGear === 1 && delta === -1) {
    // Enter neutral from 1st with downshift
    // Next downshift → reverse (if still stopped + brake held)
    return 0; // neutral
  }
  if (
    currentGear === 0 &&
    delta === -1 &&
    speedMs < config.stopEpsilon &&
    brake > 0.5
  ) {
    return -1; // reverse
  }

  return Math.max(1, Math.min(GEAR_COUNT, newGear));
}
```

### Auto-Shift

```typescript
function autoShift(
  rpm: number,
  currentGear: number,
  rpmMax: number,
  threshold: number
): number {
  if (currentGear >= GEAR_COUNT) return currentGear; // max gear — no upshift
  if (rpm > rpmMax * threshold) return currentGear + 1; // upshift
  if (rpm < rpmMax * 0.6 && currentGear > 1) return currentGear - 1; // downshift lugging
  return currentGear;
}
```

### Drag

```typescript
function computeDragForce(speedMs: number, dragCoeff: number): number {
  return dragCoeff * speedMs * speedMs * Math.sign(-speedMs);
}
// Note: sign(-speedMs) ensures drag opposes velocity direction
// Positive speed → negative drag. Negative speed (reverse) → positive drag.
```

### Brake

```typescript
function computeBrakeForce(brakeInput: number, maxBrakeForce: number): number {
  return brakeInput * maxBrakeForce;
}
```

### Elevation Modifier

```typescript
// Applied as gravitational component along slope:
// gradient = sin(angle) — positive uphill, negative downhill
// forceAdjustment = -9.81 * mass * sin(angle)
function computeGradientForce(gradient: number, mass: number): number {
  return -9.81 * mass * gradient;
  // uphill: gradient > 0 → negative force (slows car)
  // downhill: gradient < 0 → positive force (speeds car)
}
```

### Zero-Input Coast Invariant

```typescript
function computeCoastDeceleration(
  speedMs: number,
  dragCoeff: number,
  mass: number
): number {
  // throttle = 0, brake = 0 → only drag acts on the car
  const dragForce = dragCoeff * speedMs * speedMs;
  return dragForce / mass; // deceleration in m/s²
  // No auto-brake term, no auto-steer term — pure drag + rolling friction
}
```

### Gear Ratio Configuration

```typescript
// Config namespace: physics.*
// gearRatios defined per car from `physics.topSpeedL1-L5` and `physics.accelerationL1-L5`
// Defaults (configurable):
const DEFAULT_GEAR_RATIOS = [3.5, 2.5, 1.8, 1.3, 1.0, 0.8]; // G1 through G6
```

---

## Out of Scope

- **Story 001**: Pipeline integration, Havok init, Phase 2/3 velocity override skeleton
- **Story 002**: Grip model, steering clamp, lift-off oversteer, understeer (determines yaw behavior)
- **Story 004**: Surface friction/grip modifiers (off-track, kerb)
- **Story 005**: fuelMult/tireCondition delivery, setLocked/setPit, edge events

---

## QA Test Cases

_Written by qa-lead at story creation:_

- **AC-1** (RPM formula):
  - Given: `gearRatios = [3.5, 2.5, 1.8, 1.3, 1.0, 0.8]`, `rpmMax = 13000`
  - When: speed = 50 m/s in gear 1 → RPM = min(50/3.5 × 3.5, 13000) = 50
  - When: speed = 15000 in gear 1 → RPM = 13000 (capped)
  - Then: RPM increases with speed, capped at rpmMax
  - Edge: speed = 0 → RPM = 0; neutral gear → RPM = 0 (no load)

- **AC-2** (auto-shift):
  - Given: `autoShiftRpmThreshold = 0.95`, `rpmMax = 13000`, gear 3, RPM = 12450
  - When: `autoShift()` while 12450 > 13000 × 0.95 = 12350
  - Then: gear increments by 1 (gear 3 → 4)
  - Edge: At gear 6 with RPM above threshold → gear stays at 6; RPM exactly at threshold → define boundary (recommend: shift on threshold)

- **AC-3** (manual gearDelta):
  - Given: gear 3, auto-shift enabled
  - When: `applyGearDelta(+1)` → gear = 4; `applyGearDelta(-1)` → gear = 2; `applyGearDelta(0)` → auto-shift runs
  - Edge: gearDelta=+1 at gear 6 → clamped to 6; gearDelta=-1 at gear 1 → enters neutral (if brake held + stopped, next -1 → reverse)

- **AC-4** (6 forward + reverse + neutral):
  - Given: gear = 1, speed = 0, brake = 1.0
  - When: downshift → gear = 0 (neutral); downshift again → gear = -1 (reverse)
  - Edge: downshift while moving → stays gear 1; upshift from reverse → neutral → 1st

- **AC-5** (brake > throttle):
  - Given: `maxBrakeForce = 25`, `dragCoeff = 0.012`, speed = 200 km/h, throttle = 1, brake = 1
  - When: netForce = -25 - 0.012 × (55.56)² × 1 = -25 - 37.04 = -62.04 (deceleration)
  - Then: throttle contribution = 0; net force = brake + drag only
  - Edge: brake = 0.001 (tiny) → does brake dominate? Define threshold (recommend: any brake > 0 overrides)

- **AC-6** (drag):
  - Given: `dragCoeff = 0.012`
  - When: speed = 100 m/s → drag = 0.012 × 10000 × (-1) = -120
  - When: speed = -50 m/s (reverse) → drag = 0.012 × 2500 × (+1) = +30
  - Then: drag opposes velocity direction, scales quadratically
  - Edge: speed = 0 → drag = 0; `dragCoeff = 0.030` (max config) → 2.5× drag

- **AC-7** (power output):
  - Given: torqueCurve(8000) = 400, powerCeiling = 1.0
  - When: fuelMult = 0, throttle = 1.0 → power = 0
  - When: fuelMult = 1.0, throttle = 0 → power = 0
  - When: fuelMult = 0.5, throttle = 0.5 → power = 400 × 0.5 × 0.5 × 1.0 = 100
  - Edge: powerCeiling = 0 → power = 0; fuelMult very small (0.01) → power near zero

- **AC-8** (elevation):
  - Given: Car on uphill gradient = +0.1 (≈5.7°), mass = 800 kg, throttle sufficient to overcome
  - When: gradient force = -9.81 × 800 × 0.1 = -784.8 N
  - Then: Net acceleration on uphill = net acceleration on flat - 784.8/800 (0.981 m/s² reduction)
  - Edge: downhill gradient = -0.1 → +784.8 N (acceleration boost); flat gradient = 0 → no modifier

- **AC-9** (zero-input coast):
  - Given: car at speed = 200 km/h, throttle = 0, brake = 0, dragCoeff = 0.012, mass = 800 kg
  - When: computeCoastDeceleration(55.56 m/s, 0.012, 800)
  - Then: deceleration = 0.012 × (55.56)² / 800 = 0.0463 m/s² (drag-only, no auto-brake)
  - Edge: speed = 0 → no deceleration; held for 5 seconds → speed decreases by drag-only profile, verified no additional braking

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/physics-handling/engine-gears-drag-braking.test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (CarPhysicsState, PhysicsConfig), Story 002 (targetYawRate — yaw behavior needs speed)
- Unlocks: Stories 004, 005

## Completion Notes

**Completed**: 2026-06-30
**Criteria**: 9/9 passing
**Deviations**:
- accelG computed in _computeTelemetry (was declared but never written)
- gear1RedlineSpeed moved to PhysicsConfig (was hardcoded, C-F3 violation)
- computeRpm returns idle RPM for forward gears at zero speed (was returning 0, blocking acceleration from standstill)
**Test Evidence**: `tests/unit/physics-handling/engine-gears-drag-braking.test.ts` (91 tests)
**Coverage**: 100% stmts, 98.03% branches, 100% funcs, 100% lines
**Code Review**: Complete (QL-TEST-COVERAGE: ADEQUATE, LP-CODE-REVIEW: CONCERNS → fixed)
