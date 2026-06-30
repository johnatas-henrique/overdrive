# Story 002: Arcade Grip Model

> **Epic**: Physics / Handling
> **Status**: Complete
> **Last Updated**: 2026-06-30
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 10h

## Context

**GDD**: `design/gdd/physics-handling.md`
**Requirement**: `TR-PHYSICS-001`

- **TR-PHYSICS-001**: Arcade grip model: gripMax = baseGrip × cornerStat × tireCondition × speedMod — computed per car per tick.

**ADR Governing Implementation**: ADR-0008: Vehicle Physics — Arcade Dynamic
**ADR Decision Summary**: Arcade grip model computes target yaw rate each tick. gripMax is the lateral acceleration limit. Understeer occurs when lateral demand exceeds gripMax. Lift-off oversteer adds rotationBoost when throttle is lifted mid-turn.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure math — no engine APIs needed for model computation. Output feeds Phase 2 (Havok step) and Phase 3 (velocity override) via CarPhysicsState.targetYawRate.

**Control Manifest Rules (this layer)**:

- C23: Grip formula: `gripMax = baseGrip × cornerStat × tireCondition × speedMod`.
- C22: Phase 1 (arcade grip model → target speed/yaw) runs first in pipeline slot #2.

---

## Acceptance Criteria

_From QL-STORY-READY gate — all ADEQUATE:_

- [ ] **AC-1**: Car turns tighter at low speed than high speed — steeringLimit decreased by >50% at steerClampSpeed (150 km/h) vs 0 km/h
- [ ] **AC-2**: Car understeers (pushes wide) if lateral demand exceeds gripMax — heading delta < steering input delta when demand > gripMax
- [ ] **AC-3**: Lift-off oversteer: throttle < 0.05 AND brake < 0.05 AND |steerInput| > 0.1 → rotationBoost added to targetYawRate
- [ ] **AC-4**: gripMax formula multiplicative: `gripMax = baseGrip × cornerStat × tireCondition × speedMod` — each factor scales output correctly (independent multiplicative tests)
- [ ] **AC-5**: speedMod = lerp(0.5, 1.0, clamp(speed / speedModRefSpeed, 0, 1)) — grip increases with speed up to ref speed, then plateaus
- [ ] **AC-6**: cornerStat(level) = 0.6 + (level - 1) × 0.1 — level 1 = 0.6, level 5 = 1.0
- [ ] **AC-7** (no-drift invariant): Extended steer + throttle hold at speed does NOT produce sustained rotation — car understeers (front grip loss) rather than entering a sustained slide

---

## Implementation Notes

_Derived from ADR-0008 Implementation Guidelines:_

### Lateral Grip (Core Feel — GDD Core Rule #2)

```typescript
function computeGripMax(
  baseGrip: number,
  corneringLevel: number,
  tireCondition: number,
  speedKmh: number,
  config: SpeedModConfig
): number {
  const cornerStat = 0.6 + (corneringLevel - 1) * 0.1; // level 1-5 → 0.6-1.0
  const speedMod = computeSpeedMod(speedKmh, config);
  const grip = baseGrip * cornerStat * tireCondition * speedMod;
  return grip;
}
```

### SpeedMod (Downforce Effect)

```typescript
function computeSpeedMod(
  speedKmh: number,
  config: {
    speedModRefSpeed: number;
    speedModMinFactor: number;
  }
): number {
  const t = Math.max(0, Math.min(1, speedKmh / config.speedModRefSpeed));
  // lerp(speedModMinFactor, 1.0, t)
  return config.speedModMinFactor + (1.0 - config.speedModMinFactor) * t;
}
```

### Velocity-Dependent Steering (GDD Core Rule #4)

```typescript
function computeSteeringLimit(
  speedKmh: number,
  steerMax: number,
  steerClampSpeed: number,
  steerMinRatio: number
): number {
  const ratio = Math.max(
    steerMinRatio,
    Math.min(1.0, 1 - speedKmh / steerClampSpeed)
  );
  return steerMax * ratio;
}
```

At 0 km/h: `steeringLimit = steerMax × 1.0` (full).
At steerClampSpeed (150 km/h): `steeringLimit = steerMax × steerMinRatio` (minimum).
Above steerClampSpeed: clamped to `steerMinRatio × steerMax`.

### Yaw Rate Computation

```typescript
function computeYawRate(
  steerInput: number, // -1..1
  steeringLimit: number,
  gripMax: number,
  speedKmh: number,
  throttle: number,
  brake: number,
  liftOffConfig: LiftOffConfig
): number {
  const lateralDemand = steerInput * steeringLimit;

  // Check lift-off oversteer conditions
  if (
    throttle < liftOffConfig.throttleMax &&
    brake < 0.05 &&
    Math.abs(steerInput) > liftOffConfig.minSteering
  ) {
    // rotationBoost helps car tuck into corner
    lateralDemand += rotationBoost(lateralDemand, speedKmh);
  }

  // Understeer: clamp lateral acceleration to gripMax
  // lateralAccel = yawRate × speed ≤ gripMax
  const maxYawRate = gripMax / (speedKmh / 3.6); // convert km/h to m/s

  // If the car is understeering (demand > max), heading delta < input delta
  const yawRate =
    Math.sign(lateralDemand) * Math.min(Math.abs(lateralDemand), maxYawRate);

  return yawRate; // radians per tick
}
```

### Understeer Detection (for telemetry)

```typescript
function isUndersteering(
  lateralDemand: number,
  gripMax: number,
  speedMs: number
): boolean {
  const maxLateralAccel = gripMax;
  const demandedLateralAccel = Math.abs(lateralDemand) * speedMs;
  return demandedLateralAccel > maxLateralAccel;
}
```

### No-Drift Invariant

When the player holds extreme steering + throttle at speed, the model MUST NOT produce sustained rotation. The understeer clamp (`yawRate` capped at `gripMax / speedMs`) ensures the car pushes wide (front grip loss) rather than entering a drift state:

```typescript
function noDriftEnforcement(
  yawRate: number,
  speedMs: number,
  steerInput: number
): void {
  // At high speed + high steer input, the understeer clamp ensures front-grip-loss
  // behavior. No additional drift model — the car does NOT sustain slides.
  // If yawRate × speedMs < gripMax, the car turns as requested (within envelope).
  // If yawRate × speedMs ≥ gripMax, the car understeers (pushes wide).
}
```

### Telemetry Values from Arcade Model

```typescript
function computeLateralG(yawRate: number, speedMs: number): number {
  return (yawRate * speedMs) / 9.81; // in Gs
}

function computeTireSqueal(
  lateralDemand: number,
  gripMax: number,
  speedMs: number
): number {
  // tireSqueal 0-1: ratio of lateral demand vs grip capacity
  const lateralAccel = Math.abs(lateralDemand) * speedMs;
  const ratio = lateralAccel / Math.max(gripMax, 0.01);
  return Math.max(0, Math.min(1, (ratio - 0.7) / 0.3));
  // Below 70% capacity: no squeal (0). At 100%+: full squeal (1).
}
```

---

## Out of Scope

- **Story 001**: Pipeline registration, Havok init, Phase 2/3, ground tracking
- **Story 003**: Engine power, gears, drag, braking formulas (Phase 1 targetSpeed computation)
- **Story 004**: Off-track/kerb surface grip modifiers
- **Story 005**: setLocked/setPit, fuelMult/tireCondition, edge-triggered events

---

## QA Test Cases

_Written by qa-lead at story creation:_

- **AC-1** (velocity-dependent steering):
  - Given: `steerClampSpeed = 150`, `steerMinRatio = 0.3`, `steerMax = 1.0`
  - When: `computeSteeringLimit(speed=0)` → limit0 = 1.0
  - When: `computeSteeringLimit(speed=150)` → limitClamped = 0.3
  - Then: `limitClamped < limit0 × 0.5` (confirmed >50% reduction)
  - Edge: `speed=200` (>clampSpeed) → result = 0.3 (min floor); `steerMinRatio=0.1` → reduction up to 90%

- **AC-2** (understeer):
  - Given: `gripMax = 6.0`, speed = 200 km/h, steerInput = 1.0, lateral demand exceeds gripMax
  - When: `computeYawRate(...)` computed
  - Then: actual yawRate × speed_m/s < gripMax (lateral acceleration capped); heading delta per tick < requested heading delta per tick
  - Edge: demand exactly = gripMax → heading follows input (boundary); gripMax = 0 → zero heading change

- **AC-3** (lift-off oversteer):
  - Given: `liftOffRearFactor = 0.7`, `liftOffMinSteering = 0.1`, `liftOffThrottleMax = 0.05`
  - When: throttle = 0.0, brake = 0.0, steer = 0.5, speed = 100 km/h
  - Then: `targetYawRate` includes rotationBoost > 0
  - Edge: throttle = 0.049 (below max → boost); throttle = 0.051 (above → no boost); steer = 0.09 (below min → no boost)

- **AC-4** (gripMax multiplicative):
  - Given: `baseGrip = 9.0`, `tireCondition = 1.0`, `cornerStat = 1.0`, `speedMod = 1.0`
  - When: cornerStat = 0.6 → gripMax = 5.4; cornerStat = 1.0 → gripMax = 9.0
  - When: tireCondition = 0.0 → gripMax = 9.0 × 0.15 (minGripFactor clamp); tireCondition = 0.5 → 4.5
  - When: speedMod = 0.5 → gripMax = 4.5; speedMod = 1.0 → gripMax = 9.0
  - Then: Each factor scales linearly and independently (product property holds)
  - Edge: All factors at minimum → gripMax = 5 × 0.6 × 0.15 × 0.5 = 0.225

- **AC-5** (speedMod):
  - Given: `speedModRefSpeed = 250`, `speedModMinFactor = 0.5`
  - When: speed = 0 → speedMod = 0.5; speed = 125 → 0.75; speed = 250 → 1.0; speed = 300 → 1.0 (plateau)
  - Then: grip increases linearly to ref speed, plateaus at 1.0
  - Edge: Negative speed → clamped to 0 = 0.5; `speedModMinFactor = 0.1` → at speed=0 returns 0.1

- **AC-6** (cornerStat levels):
  - Given: cornering upgrade levels 1-5
  - When: level 1 → 0.6; level 2 → 0.7; level 3 → 0.8; level 4 → 0.9; level 5 → 1.0
  - Then: Each level produces the expected multiplier
  - Edge: level = 0 (invalid) → clamp to L1 or throw? level = 6 → clamp to L5?

- **AC-7** (no-drift invariant):
  - Given: Car at speed 200 km/h, gripMax = 6.0, steerInput = 1.0, throttle = 1.0
  - When: yawRate computed with no-drift enforcement
  - Then: lateral acceleration = yawRate × speed_m/s ≤ gripMax (always capped); car understeers rather than entering sustained slide
  - Edge: throttle lifted mid-turn → lift-off oversteer provides momentary rotationBoost but does NOT transition to sustained drift

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/physics-handling/arcade-grip-model.test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (CarPhysicsState structure, PhysicsConfig)
- Unlocks: Stories 003, 004, 005

## Completion Notes

**Completed**: 2026-06-30
**Criteria**: 7/7 passing
**Deviations**: Scope expansion — `physics-config.ts` modified (removed `liftOffRearFactor`, added `liftOffBrakeMax`) and `physics-core-skeleton.test.ts` updated to match. Valid changes for code review fixes.
**Test Evidence**: `tests/unit/physics-handling/arcade-grip-model.test.ts` — 65 tests, 100% coverage (stmts/branches/funcs/lines)
**Code Review**: Complete — APPROVED (2 required fixes + 5 suggestions applied)
**QL-TEST-COVERAGE**: ADEQUATE
