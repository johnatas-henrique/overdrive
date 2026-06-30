/**
 * Story 002: Arcade Grip Model — Unit tests.
 *
 * Covers all 7 acceptance criteria for the arcade grip model.
 * Pure math tests — no Babylon.js imports needed.
 *
 * @see STORY-002 — Arcade Grip Model
 * @see TR-PHYSICS-001 — gripMax formula
 * @see ADR-0008 — Vehicle Physics — Arcade Dynamic
 */

import { describe, expect, it } from "vitest";
import { InputState } from "@/foundation/determinism/types";
import type {
  GripConfig,
  LiftOffConfig,
} from "@/physics-handling/arcade-grip-model";
import { ArcadeGripModel } from "@/physics-handling/arcade-grip-model";
import type { CarPhysicsState } from "@/physics-handling/car-physics-state";
import type { PhysicsConfig } from "@/physics-handling/physics-config";

// ─── Test Helpers ───────────────────────────────────────────────────────────

/**
 * Default GripConfig for most AC-4 and AC-5 tests.
 * All factors start at 1.0 for baseline multiplicative testing.
 */
const DEFAULT_GRIP_CONFIG: GripConfig = {
  speedModRefSpeedKmh: 250,
  speedModMinFactor: 0.5,
  minGripFactor: 0.15,
};

/**
 * Default LiftOffConfig for AC-3 tests.
 */
const DEFAULT_LIFT_OFF: LiftOffConfig = {
  throttleMax: 0.05,
  minSteering: 0.1,
  brakeMax: 0.05,
};

/**
 * Minimal PhysicsConfig for compute() method tests.
 * Matches the structure used in the existing skeleton tests.
 */
function createTestConfig(overrides?: Partial<PhysicsConfig>): PhysicsConfig {
  return {
    baseGrip: 0.95,
    steerClampSpeed: 25, // m/s = 90 km/h
    steerMinRatio: 0.4,
    liftOffMinSteering: 0.3,
    liftOffThrottleMax: 0.3,
    liftOffBrakeMax: 0.05,
    dragCoeff: 0.3,
    maxBrakeForce: 15,
    pitSpeedLimit: 12,
    offTrackFriction: 0.4,
    offTrackGripFactor: 0.6,
    offTrackMinSpeed: 5,
    kerbGripLoss: 0.5,
    speedModRefSpeed: 30, // m/s = 108 km/h
    speedModMinFactor: 0.8,
    autoShiftRpmThreshold: 8000,
    rpmMax: 10000,
    minGripFactor: 0.1,
    stopEpsilon: 0.1,
    carHalfWidth: 0.7,
    topSpeedL1toL5: [40, 50, 60, 72, 85] as [
      number,
      number,
      number,
      number,
      number,
    ],
    accelerationL1toL5: [0.8, 1.0, 1.2, 1.4, 1.6] as [
      number,
      number,
      number,
      number,
      number,
    ],
    corneringL1toL5: [0.6, 0.7, 0.8, 0.9, 1.0] as [
      number,
      number,
      number,
      number,
      number,
    ],
    ...overrides,
  };
}

/**
 * Create a minimal CarPhysicsState for compute() integration tests.
 */
function createState(overrides?: Partial<CarPhysicsState>): CarPhysicsState {
  return {
    carId: "test_car",
    body: null,
    targetSpeed: 0,
    targetYawRate: 0,
    splinePosition: 0,
    speedKmh: 0,
    rpm: 0,
    gear: 0,
    lateralG: 0,
    accelG: 0,
    tireSqueal: 0,
    kerbHit: false,
    offTrack: false,
    gripMultiplier: 1,
    fuelMult: 1,
    tireCondition: 1,
    locked: false,
    pitMode: false,
    tireBlownEmitted: false,
    fuelEmptyEmitted: false,
    wasAboveStopEpsilon: false,
    ...overrides,
  };
}

// ─── AC-1: Velocity-Dependent Steering ──────────────────────────────────────

describe("AC-1 — Velocity-dependent steering", () => {
  it("test_zeroSpeed_fullSteering", () => {
    // At 0 km/h, steeringLimit = steerMax × 1.0 = steerMax
    const limit = ArcadeGripModel.computeSteeringLimit(0, 1.0, 150, 0.3);
    expect(limit).toBe(1.0);
  });

  it("test_atClampSpeed_minSteering", () => {
    // At clampSpeed (150 km/h), steeringLimit = steerMax × steerMinRatio = 1.0 × 0.3
    const limit = ArcadeGripModel.computeSteeringLimit(150, 1.0, 150, 0.3);
    expect(limit).toBe(0.3);
  });

  it("test_reductionGreaterThan50Percent_atClampSpeed", () => {
    // AC-1: >50% reduction at clampSpeed
    const limit0 = ArcadeGripModel.computeSteeringLimit(0, 1.0, 150, 0.3);
    const limitClamped = ArcadeGripModel.computeSteeringLimit(
      150,
      1.0,
      150,
      0.3
    );
    expect(limitClamped).toBeLessThan(limit0 * 0.5);
    // 0.3 < 0.5 ✓
  });

  it("test_aboveClampSpeed_staysAtMinRatio", () => {
    // Speed above clampSpeed → should floor at steerMinRatio
    const limit = ArcadeGripModel.computeSteeringLimit(200, 1.0, 150, 0.3);
    expect(limit).toBe(0.3);
  });

  it("test_differentMinRatio_reducesByRatio", () => {
    // steerMinRatio = 0.1 → up to 90% reduction
    const limitMin = ArcadeGripModel.computeSteeringLimit(150, 1.0, 150, 0.1);
    expect(limitMin).toBe(0.1);

    const limit0 = ArcadeGripModel.computeSteeringLimit(0, 1.0, 150, 0.1);
    expect(limit0).toBe(1.0);
  });

  it("test_linearTransition_betweenZeroAndClampSpeed", () => {
    // At half clamp speed, should be halfway between 1.0 and minRatio
    const limit = ArcadeGripModel.computeSteeringLimit(75, 1.0, 150, 0.3);
    // ratio = max(0.3, min(1.0, 1 - 75/150)) = max(0.3, 0.5) = 0.5
    expect(limit).toBeCloseTo(0.5, 5);
  });

  it("test_customSteerMax_scalesOutput", () => {
    // steerMax = 2.0 should double the output
    const limit = ArcadeGripModel.computeSteeringLimit(0, 2.0, 150, 0.3);
    expect(limit).toBe(2.0);

    const limitClamped = ArcadeGripModel.computeSteeringLimit(
      150,
      2.0,
      150,
      0.3
    );
    expect(limitClamped).toBe(0.6);
  });
});

// ─── AC-2: Understeer Clamping ─────────────────────────────────────────────

describe("AC-2 — Understeer clamping", () => {
  it("test_demandExceedsGripMax_yawRateCapped", () => {
    // gripMax = 6.0, speed = 200 km/h (55.56 m/s)
    // maxYawRate = 6.0 / 55.56 ≈ 0.108
    // With steerInput = 1.0, steeringLimit at 200 km/h ≈ 1.0 * max(0.3, min(1.0, 1-200/150)) = 0.3
    // lateralDemand = 0.3, which exceeds maxYawRate → clamp to ~0.108
    const gripMax = 6.0;
    const steerLimit = ArcadeGripModel.computeSteeringLimit(200, 1.0, 150, 0.3);
    const yawRate = ArcadeGripModel.computeYawRate(
      1.0,
      steerLimit,
      gripMax,
      200,
      0,
      0,
      DEFAULT_LIFT_OFF
    );

    const speedMs = 200 / 3.6;
    const lateralAccel = yawRate * speedMs;

    // Lateral acceleration must be ≤ gripMax
    expect(lateralAccel).toBeLessThanOrEqual(gripMax + 1e-10);
    // And the yaw rate must be less than the uncapped lateral demand
    expect(Math.abs(yawRate)).toBeLessThan(steerLimit);
  });

  it("test_demandEqualsGripMax_headingFollowsInput", () => {
    // When demand exactly equals the grip limit, yaw rate matches
    // gripMax = 10.0, speed = 100 km/h (27.78 m/s)
    // maxYawRate = 10.0 / 27.78 ≈ 0.36
    // At clampSpeed=150, minRatio=0.3:
    // ratio = max(0.3, min(1.0, 1-100/150)) = 0.333, limit = 0.333
    // lateralDemand = 1.0 * 0.333 = 0.333
    // maxYawRate = 10.0 / 27.78 ≈ 0.36
    // 0.333 < 0.36 → no clamp, yawRate = 0.333
    // throttle=1.0 to prevent lift-off oversteer from adding rotation boost
    const gripMax = 10.0;
    const steerLimit = ArcadeGripModel.computeSteeringLimit(100, 1.0, 150, 0.3);
    const yawRate = ArcadeGripModel.computeYawRate(
      1.0,
      steerLimit,
      gripMax,
      100,
      1.0,
      0,
      DEFAULT_LIFT_OFF
    );

    // lateralDemand ≈ 0.333, maxYawRate ≈ 0.36
    // yawRate should follow input (no clamping)
    const expectedDemand = 1.0 * steerLimit;
    expect(yawRate).toBeCloseTo(expectedDemand, 4);
  });

  it("test_gripMaxZero_zeroHeadingChange", () => {
    // gripMax = 0 → maxYawRate = 0 → yawRate = 0
    const steerLimit = ArcadeGripModel.computeSteeringLimit(50, 1.0, 150, 0.3);
    const yawRate = ArcadeGripModel.computeYawRate(
      1.0,
      steerLimit,
      0,
      50,
      0,
      0,
      DEFAULT_LIFT_OFF
    );

    expect(yawRate).toBe(0);
  });

  it("test_isUndersteering_returnsTrue_whenDemandExceedsGrip", () => {
    // lateralDemand = 2.0, gripMax = 6.0, speedMs = 5 m/s
    // demandedLateralAccel = |2.0| × 5 = 10 > 6 → understeering
    const under = ArcadeGripModel.isUndersteering(2.0, 6.0, 5);
    expect(under).toBe(true);
  });

  it("test_isUndersteering_returnsFalse_whenDemandWithinGrip", () => {
    // lateralDemand = 1.0, gripMax = 6.0, speedMs = 5 m/s
    // demandedLateralAccel = |1.0| × 5 = 5 ≤ 6 → not understeering
    const under = ArcadeGripModel.isUndersteering(1.0, 6.0, 5);
    expect(under).toBe(false);
  });

  it("test_isUndersteering_boundary_atLimit", () => {
    // At exact boundary: demand == grip
    // lateralDemand = 1.2, gripMax = 6.0, speedMs = 5 m/s
    // demandedLateralAccel = 1.2 × 5 = 6.0 = gripMax → not understeering (≤)
    const under = ArcadeGripModel.isUndersteering(1.2, 6.0, 5);
    expect(under).toBe(false);
  });
});

// ─── AC-3: Lift-Off Oversteer ──────────────────────────────────────────────

describe("AC-3 — Lift-off oversteer", () => {
  it("test_liftOffConditions_rotationBoostAdded", () => {
    // throttle = 0.0, brake = 0.0, steer = 0.5, speed = 100 km/h
    // All lift-off conditions met → rotationBoost > 0
    const steerLimit = ArcadeGripModel.computeSteeringLimit(100, 1.0, 150, 0.3);
    const yawRate = ArcadeGripModel.computeYawRate(
      0.5,
      steerLimit,
      10.0,
      100,
      0.0,
      0.0,
      DEFAULT_LIFT_OFF
    );

    // With no lift-off (steer=0.5, limit≈0.333, lateralDemand≈0.167)
    // With lift-off: rotationBoost adds positive value
    // yawRate should be > the non-boosted case
    const yawRateNoBoost = ArcadeGripModel.computeYawRate(
      0.5,
      steerLimit,
      10.0,
      100,
      1.0,
      0.0,
      DEFAULT_LIFT_OFF
    );

    expect(Math.abs(yawRate)).toBeGreaterThan(Math.abs(yawRateNoBoost));
  });

  it("test_throttleJustBelowMax_triggersBoost", () => {
    // throttle = 0.049 (< 0.05) → boost should trigger
    const steerLimit = ArcadeGripModel.computeSteeringLimit(100, 1.0, 150, 0.3);
    const yawRateBoost = ArcadeGripModel.computeYawRate(
      0.5,
      steerLimit,
      10.0,
      100,
      0.049,
      0.0,
      DEFAULT_LIFT_OFF
    );

    const yawRateNoBoost = ArcadeGripModel.computeYawRate(
      0.5,
      steerLimit,
      10.0,
      100,
      1.0,
      0.0,
      DEFAULT_LIFT_OFF
    );

    expect(Math.abs(yawRateBoost)).toBeGreaterThan(Math.abs(yawRateNoBoost));
  });

  it("test_throttleJustAboveMax_noBoost", () => {
    // throttle = 0.051 (> 0.05) → no boost
    const steerLimit = ArcadeGripModel.computeSteeringLimit(100, 1.0, 150, 0.3);
    const yawRate = ArcadeGripModel.computeYawRate(
      0.5,
      steerLimit,
      10.0,
      100,
      0.051,
      0.0,
      DEFAULT_LIFT_OFF
    );

    // Compute expected without boost
    const expectedDemand = 0.5 * steerLimit;
    expect(yawRate).toBeCloseTo(expectedDemand, 4);
  });

  it("test_steeringBelowMinThreshold_noBoost", () => {
    // steer = 0.09 (< 0.1) → no boost
    const steerLimit = ArcadeGripModel.computeSteeringLimit(100, 1.0, 150, 0.3);
    const yawRate = ArcadeGripModel.computeYawRate(
      0.09,
      steerLimit,
      10.0,
      100,
      0.0,
      0.0,
      DEFAULT_LIFT_OFF
    );

    const expectedDemand = 0.09 * steerLimit;
    expect(yawRate).toBeCloseTo(expectedDemand, 4);
  });

  it("test_brakeAboveThreshold_noBoost", () => {
    // brake = 0.05 (not < 0.05) → no boost
    const steerLimit = ArcadeGripModel.computeSteeringLimit(100, 1.0, 150, 0.3);
    const yawRate = ArcadeGripModel.computeYawRate(
      0.5,
      steerLimit,
      10.0,
      100,
      0.0,
      0.05,
      DEFAULT_LIFT_OFF
    );

    const expectedDemand = 0.5 * steerLimit;
    expect(Math.abs(yawRate - expectedDemand)).toBeLessThan(0.001);
  });

  it("test_rotationBoost_returnsPositiveValue", () => {
    // rotationBoost should return > 0 when lateralDemand > 0 and speed > 0
    const boost = ArcadeGripModel.rotationBoost(0.5, 100);
    expect(boost).toBeGreaterThan(0);
  });

  it("test_rotationBoost_returnsZero_atZeroSpeed", () => {
    // No rotation boost at zero speed (no weight transfer)
    const boost = ArcadeGripModel.rotationBoost(0.5, 0);
    expect(boost).toBe(0);
  });

  it("test_rotationBoost_plateausAtHighSpeed", () => {
    // At 200+ km/h, speedWeight = 1.0
    const boost200 = ArcadeGripModel.rotationBoost(0.5, 200);
    const boost300 = ArcadeGripModel.rotationBoost(0.5, 300);
    expect(boost200).toBe(boost300);
  });

  it("test_rotationBoost_negativeSteer_increasesMagnitude", () => {
    // Negative steer (left turn) with lift-off: magnitude should increase
    // This catches the symmetry bug where Math.abs() was used
    const steerLimit = ArcadeGripModel.computeSteeringLimit(100, 1.0, 150, 0.3);
    const yawRate = ArcadeGripModel.computeYawRate(
      -0.5,
      steerLimit,
      10.0,
      100,
      0.0,
      0.0,
      DEFAULT_LIFT_OFF
    );

    // Without lift-off: yawRate = -0.5 * steerLimit ≈ -0.167
    const yawRateNoBoost = ArcadeGripModel.computeYawRate(
      -0.5,
      steerLimit,
      10.0,
      100,
      1.0,
      0.0,
      DEFAULT_LIFT_OFF
    );

    // With lift-off: magnitude should be larger (more negative)
    expect(Math.abs(yawRate)).toBeGreaterThan(Math.abs(yawRateNoBoost));
    // Both should be negative (left turn)
    expect(yawRate).toBeLessThan(0);
    expect(yawRateNoBoost).toBeLessThan(0);
  });

  it("test_rotationBoost_symmetric_positiveAndNegativeSteer", () => {
    // Positive and negative steer should produce equal magnitude boost
    const boostPositive = ArcadeGripModel.rotationBoost(0.5, 100);
    const boostNegative = ArcadeGripModel.rotationBoost(-0.5, 100);
    expect(Math.abs(boostPositive)).toBe(Math.abs(boostNegative));
    expect(boostPositive).toBeGreaterThan(0);
    expect(boostNegative).toBeLessThan(0);
  });
});

// ─── AC-4: gripMax Multiplicative ──────────────────────────────────────────

describe("AC-4 — gripMax multiplicative", () => {
  const baseGrip = 9.0;
  const tireCondition = 1.0;
  const corneringLevel = 5; // cornerStat = 1.0

  it("test_cornerStatScalesIndependently", () => {
    // cornerStat = 0.6 (level 1) → gripMax = 9.0 × 0.6 × 1.0 × 1.0 = 5.4
    // speedMod = 1.0 (at refSpeed)
    const gripLevel1 = ArcadeGripModel.computeGripMax(
      baseGrip,
      1,
      tireCondition,
      250,
      DEFAULT_GRIP_CONFIG
    );
    expect(gripLevel1).toBeCloseTo(5.4, 5);

    // cornerStat = 1.0 (level 5) → gripMax = 9.0 × 1.0 × 1.0 × 1.0 = 9.0
    const gripLevel5 = ArcadeGripModel.computeGripMax(
      baseGrip,
      5,
      tireCondition,
      250,
      DEFAULT_GRIP_CONFIG
    );
    expect(gripLevel5).toBeCloseTo(9.0, 5);
  });

  it("test_tireConditionScalesIndependently", () => {
    // tireCondition = 0.0 → clamped to minGripFactor (0.15) before multiply
    // gripMax = 9.0 × 1.0 × max(0.15, 0.0) × 1.0 = 9.0 × 0.15 = 1.35
    const gripWorn = ArcadeGripModel.computeGripMax(
      baseGrip,
      corneringLevel,
      0.0,
      250,
      DEFAULT_GRIP_CONFIG
    );
    expect(gripWorn).toBeCloseTo(9.0 * 0.15, 5);

    // tireCondition = 0.5 → gripMax = 9.0 × 1.0 × 0.5 × 1.0 = 4.5
    const gripHalf = ArcadeGripModel.computeGripMax(
      baseGrip,
      corneringLevel,
      0.5,
      250,
      DEFAULT_GRIP_CONFIG
    );
    expect(gripHalf).toBeCloseTo(4.5, 5);
  });

  it("test_speedModScalesIndependently", () => {
    // speedMod = 0.5 (at speed=0) → gripMax = 9.0 × 1.0 × 1.0 × 0.5 = 4.5
    const gripLowSpeed = ArcadeGripModel.computeGripMax(
      baseGrip,
      corneringLevel,
      tireCondition,
      0,
      DEFAULT_GRIP_CONFIG
    );
    expect(gripLowSpeed).toBeCloseTo(4.5, 5);

    // speedMod = 1.0 (at refSpeed=250) → gripMax = 9.0 × 1.0 × 1.0 × 1.0 = 9.0
    const gripHighSpeed = ArcadeGripModel.computeGripMax(
      baseGrip,
      corneringLevel,
      tireCondition,
      250,
      DEFAULT_GRIP_CONFIG
    );
    expect(gripHighSpeed).toBeCloseTo(9.0, 5);
  });

  it("test_allFactorsMinimum_productFormula", () => {
    // All factors at minimum: baseGrip=5, cornerStat=0.6, tireCond=0.15, speedMod=0.5
    // product = 5 × 0.6 × 0.15 × 0.5 = 0.225
    // minGripFactor = 0.15, max(0.15, 0.225) = 0.225
    const gripMin = ArcadeGripModel.computeGripMax(
      5,
      1,
      DEFAULT_GRIP_CONFIG.minGripFactor,
      0,
      DEFAULT_GRIP_CONFIG
    );
    expect(gripMin).toBeCloseTo(0.225, 5);
  });

  it("test_minGripFactor_clamps_tireCondition", () => {
    // minGripFactor clamps tireCondition before multiplication, not the final product.
    // baseGrip=0.1, cornerStat=0.6, tireCond=0.01 clamped→0.15, speedMod=0.5
    // gripMax = 0.1 × 0.6 × 0.15 × 0.5 = 0.0045
    const grip = ArcadeGripModel.computeGripMax(
      0.1,
      1,
      0.01,
      0,
      DEFAULT_GRIP_CONFIG
    );
    expect(grip).toBeCloseTo(0.0045, 5);
  });

  it("test_eachFactorScalesLinearly_productPropertyHolds", () => {
    // Product property: scaling any factor by k scales output by k (within limits)
    const baseConfig: GripConfig = {
      speedModRefSpeedKmh: 250,
      speedModMinFactor: 0.5,
      minGripFactor: 0.01, // Very low to avoid clamp interference
    };

    const gripBase = ArcadeGripModel.computeGripMax(
      9.0,
      5,
      1.0,
      250,
      baseConfig
    );

    // Double tireCondition from 0.5 to 1.0
    const gripHalf = ArcadeGripModel.computeGripMax(
      9.0,
      5,
      0.5,
      250,
      baseConfig
    );
    const gripFull = ArcadeGripModel.computeGripMax(
      9.0,
      5,
      1.0,
      250,
      baseConfig
    );
    expect(gripFull).toBeCloseTo(gripHalf * 2, 4);

    // Halve baseGrip
    const gripHalfBase = ArcadeGripModel.computeGripMax(
      4.5,
      5,
      1.0,
      250,
      baseConfig
    );
    expect(gripHalfBase).toBeCloseTo(gripBase * 0.5, 4);
  });
});

// ─── AC-5: SpeedMod ────────────────────────────────────────────────────────

describe("AC-5 — SpeedMod lerp", () => {
  const config: GripConfig = {
    speedModRefSpeedKmh: 250,
    speedModMinFactor: 0.5,
    minGripFactor: 0.15,
  };

  it("test_zeroSpeed_minFactor", () => {
    const mod = ArcadeGripModel.computeSpeedMod(0, config);
    expect(mod).toBe(0.5);
  });

  it("test_halfRefSpeed_lerpMidpoint", () => {
    // speed = 125 km/h (half of 250)
    // t = 125/250 = 0.5
    // lerp(0.5, 1.0, 0.5) = 0.5 + (1.0 - 0.5) × 0.5 = 0.5 + 0.25 = 0.75
    const mod = ArcadeGripModel.computeSpeedMod(125, config);
    expect(mod).toBeCloseTo(0.75, 5);
  });

  it("test_atRefSpeed_fullFactor", () => {
    const mod = ArcadeGripModel.computeSpeedMod(250, config);
    expect(mod).toBe(1.0);
  });

  it("test_aboveRefSpeed_plateau", () => {
    const mod250 = ArcadeGripModel.computeSpeedMod(250, config);
    const mod300 = ArcadeGripModel.computeSpeedMod(300, config);
    expect(mod300).toBe(1.0);
    expect(mod300).toBe(mod250);
  });

  it("test_negativeSpeed_clampedToMinFactor", () => {
    // Negative speed should be clamped to 0 by the formula
    const mod = ArcadeGripModel.computeSpeedMod(-10, config);
    expect(mod).toBe(0.5);
  });

  it("test_differentMinFactor_returnsCorrectAtZero", () => {
    const configLow: GripConfig = {
      speedModRefSpeedKmh: 250,
      speedModMinFactor: 0.1,
      minGripFactor: 0.15,
    };
    const mod = ArcadeGripModel.computeSpeedMod(0, configLow);
    expect(mod).toBe(0.1);
  });

  it("test_linearTransition_acrossSpeedRange", () => {
    // At speed 62.5 km/h (quarter of ref), should be quarter of lerp range
    const mod = ArcadeGripModel.computeSpeedMod(62.5, config);
    // lerp(0.5, 1.0, 0.25) = 0.5 + 0.5 * 0.25 = 0.625
    expect(mod).toBeCloseTo(0.625, 5);
  });
});

// ─── AC-6: CornerStat Levels ───────────────────────────────────────────────

describe("AC-6 — CornerStat levels", () => {
  it("test_level1_cornerStat", () => {
    expect(ArcadeGripModel.computeCornerStat(1)).toBe(0.6);
  });

  it("test_level2_cornerStat", () => {
    expect(ArcadeGripModel.computeCornerStat(2)).toBe(0.7);
  });

  it("test_level3_cornerStat", () => {
    expect(ArcadeGripModel.computeCornerStat(3)).toBe(0.8);
  });

  it("test_level4_cornerStat", () => {
    expect(ArcadeGripModel.computeCornerStat(4)).toBe(0.9);
  });

  it("test_level5_cornerStat", () => {
    expect(ArcadeGripModel.computeCornerStat(5)).toBe(1.0);
  });

  it("test_levelBelowRange_clampsToLevel1", () => {
    // Level 0 should be clamped to level 1
    expect(ArcadeGripModel.computeCornerStat(0)).toBe(0.6);
  });

  it("test_levelAboveRange_clampsToLevel5", () => {
    // Level 6 should be clamped to level 5
    expect(ArcadeGripModel.computeCornerStat(6)).toBe(1.0);
  });

  it("test_negativeLevel_clampsToLevel1", () => {
    expect(ArcadeGripModel.computeCornerStat(-1)).toBe(0.6);
  });
});

// ─── AC-7: No-Drift Invariant ──────────────────────────────────────────────

describe("AC-7 — No-drift invariant", () => {
  it("test_highSpeedHighSteer_lateralAccelCappedAtGripMax", () => {
    // Speed = 200 km/h, gripMax = 6.0, steerInput = 1.0, throttle = 1.0
    // The understeer clamp must keep lateral acceleration ≤ gripMax
    const steerLimit = ArcadeGripModel.computeSteeringLimit(200, 1.0, 150, 0.3);
    const yawRate = ArcadeGripModel.computeYawRate(
      1.0,
      steerLimit,
      6.0,
      200,
      1.0,
      0.0,
      DEFAULT_LIFT_OFF
    );

    const speedMs = 200 / 3.6;
    const lateralAccel = Math.abs(yawRate) * speedMs;

    // Invariant: lateralAccel ≤ gripMax
    expect(lateralAccel).toBeLessThanOrEqual(6.0 + 1e-10);
  });

  it("test_liftOffMidTurn_rotationBoostNotSustainedDrift", () => {
    // Throttle lifted mid-turn provides rotation boost, but the understeer
    // clamp prevents sustained drift. The yaw rate is still bounded by gripMax.
    const steerLimit = ArcadeGripModel.computeSteeringLimit(200, 1.0, 150, 0.3);
    const gripMax = 6.0;
    const speedKmh = 200;

    // With lift-off: throttle = 0, steer = 1.0
    const yawRateLift = ArcadeGripModel.computeYawRate(
      1.0,
      steerLimit,
      gripMax,
      speedKmh,
      0.0,
      0.0,
      DEFAULT_LIFT_OFF
    );
    // Without lift-off: throttle = 1.0, steer = 1.0
    const yawRateNoLift = ArcadeGripModel.computeYawRate(
      1.0,
      steerLimit,
      gripMax,
      speedKmh,
      1.0,
      0.0,
      DEFAULT_LIFT_OFF
    );

    const speedMs = speedKmh / 3.6;

    // Lift-off adds temporary rotation boost
    expect(Math.abs(yawRateLift)).toBeGreaterThanOrEqual(
      Math.abs(yawRateNoLift)
    );

    // But it's still bounded by the grip limit
    const lateralAccelLift = Math.abs(yawRateLift) * speedMs;
    expect(lateralAccelLift).toBeLessThanOrEqual(gripMax + 1e-10);
  });

  it("test_documentation_noDriftEnforcementDoesNotThrow", () => {
    // noDriftEnforcement is a documentation-only function
    expect(() =>
      ArcadeGripModel.noDriftEnforcement(0.1, 50, 1.0)
    ).not.toThrow();
  });
});

// ─── Telemetry Functions ───────────────────────────────────────────────────

describe("Telemetry functions", () => {
  it("test_computeLateralG_convertsToGs", () => {
    // yawRate = 0.1 rad/tick, speedMs = 50 m/s
    // lateralAccel = 0.1 × 50 = 5 m/s²
    // in G = 5 / 9.81 ≈ 0.51 G
    const lateralG = ArcadeGripModel.computeLateralG(0.1, 50);
    expect(lateralG).toBeCloseTo((0.1 * 50) / 9.81, 5);
  });

  it("test_computeLateralG_zeroSpeed_zeroG", () => {
    expect(ArcadeGripModel.computeLateralG(0.5, 0)).toBe(0);
  });

  it("test_computeTireSqueal_below70percent_noSqueal", () => {
    // lateralDemand = 0.5, gripMax = 10.0, speedMs = 10 m/s
    // lateralAccel = 0.5 × 10 = 5 m/s²
    // ratio = 5/10 = 0.5, (0.5 - 0.7)/0.3 = -0.667 → clamped to 0
    const squeal = ArcadeGripModel.computeTireSqueal(0.5, 10.0, 10);
    expect(squeal).toBe(0);
  });

  it("test_computeTireSqueal_at100percent_fullSqueal", () => {
    // lateralDemand = 1.0, gripMax = 10.0, speedMs = 10 m/s
    // lateralAccel = 1.0 × 10 = 10 m/s²
    // ratio = 10/10 = 1.0, (1.0 - 0.7)/0.3 = 1.0 → clamped to 1
    const squeal = ArcadeGripModel.computeTireSqueal(1.0, 10.0, 10);
    expect(squeal).toBe(1.0);
  });

  it("test_computeTireSqueal_partial_at85percent", () => {
    // lateralDemand = 0.85, gripMax = 10.0, speedMs = 10 m/s
    // lateralAccel = 0.85 × 10 = 8.5 m/s²
    // ratio = 0.85, (0.85 - 0.7)/0.3 = 0.5
    const squeal = ArcadeGripModel.computeTireSqueal(0.85, 10.0, 10);
    expect(squeal).toBeCloseTo(0.5, 5);
  });

  it("test_computeTireSqueal_clampedToZero_one", () => {
    // ratio far below 0.7 → still clamped to 0
    const squealLow = ArcadeGripModel.computeTireSqueal(0.1, 10.0, 10);
    expect(squealLow).toBe(0);

    // ratio far above 1.0 → clamped to 1
    const squealHigh = ArcadeGripModel.computeTireSqueal(2.0, 10.0, 10);
    expect(squealHigh).toBe(1.0);
  });

  it("test_computeTireSqueal_handlesZeroGrip", () => {
    // gripMax = 0 → should use 0.01 as fallback to avoid division by zero
    const squeal = ArcadeGripModel.computeTireSqueal(1.0, 0, 10);
    expect(squeal).toBeGreaterThanOrEqual(0);
    expect(squeal).toBeLessThanOrEqual(1);
  });
});

// ─── compute() Integration Tests ────────────────────────────────────────────

describe("ArcadeGripModel.compute() — integration", () => {
  it("test_compute_setsTargetSpeedToFive", () => {
    const model = new ArcadeGripModel();
    const state = createState();
    const config = createTestConfig();

    model.compute(state, InputState.ZERO, 1 / 60, config);

    expect(state.targetSpeed).toBe(5);
  });

  it("test_compute_withZeroInput_setsZeroYawRate", () => {
    const model = new ArcadeGripModel();
    const state = createState();
    const config = createTestConfig();

    model.compute(state, InputState.ZERO, 1 / 60, config);

    // With zero steer input, yaw rate should be 0
    expect(state.targetYawRate).toBe(0);
  });

  it("test_compute_setsTelemetryFields", () => {
    const model = new ArcadeGripModel();
    const state = createState({ speedKmh: 100 }); // Pre-set speed
    const config = createTestConfig();

    model.compute(state, InputState.ZERO, 1 / 60, config);

    expect(state.lateralG).toBeTypeOf("number");
    expect(state.tireSqueal).toBeTypeOf("number");
    expect(state.gripMultiplier).toBeGreaterThan(0);
    expect(state.rpm).toBe(3000);
    expect(state.gear).toBe(1);
  });

  it("test_compute_setsSpeedKmh_fromTargetSpeed", () => {
    const model = new ArcadeGripModel();
    const state = createState();
    const config = createTestConfig();

    model.compute(state, InputState.ZERO, 1 / 60, config);

    // targetSpeed = 5 m/s → speedKmh = 18 km/h
    expect(state.speedKmh).toBe(18);
  });

  it("test_compute_deterministic_identicalOutput", () => {
    // Two separate compute() calls with identical inputs produce identical output
    const model = new ArcadeGripModel();
    const config = createTestConfig();
    const input = InputState.ZERO;

    const state1 = createState({ speedKmh: 100 });
    const state2 = createState({ speedKmh: 100 });

    model.compute(state1, input, 1 / 60, config);
    model.compute(state2, input, 1 / 60, config);

    expect(state1.targetYawRate).toBe(state2.targetYawRate);
    expect(state1.targetSpeed).toBe(state2.targetSpeed);
    expect(state1.lateralG).toBe(state2.lateralG);
    expect(state1.tireSqueal).toBe(state2.tireSqueal);
    expect(state1.gripMultiplier).toBe(state2.gripMultiplier);
  });

  it("test_compute_withSteerInput_producesNonZeroYaw", () => {
    const model = new ArcadeGripModel();
    const state = createState({ speedKmh: 50 });
    const config = createTestConfig();
    const input: InputState = { ...InputState.ZERO, steer: 0.5 };

    model.compute(state, input, 1 / 60, config);

    // With non-zero steer, yaw rate should be non-zero
    expect(state.targetYawRate).not.toBe(0);
    // Should be positive for positive steer (right turn)
    expect(state.targetYawRate).toBeGreaterThan(0);
  });

  it("test_compute_withNegativeSteer_negativeYaw", () => {
    const model = new ArcadeGripModel();
    const state = createState({ speedKmh: 50 });
    const config = createTestConfig();
    const input: InputState = { ...InputState.ZERO, steer: -0.5 };

    model.compute(state, input, 1 / 60, config);

    expect(state.targetYawRate).toBeLessThan(0);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("test_zeroSpeed_maxYawRateInfinityNoClamp", () => {
    // At zero speed, maxYawRate is Infinity → yaw rate is unclamped
    const steerLimit = ArcadeGripModel.computeSteeringLimit(0, 1.0, 150, 0.3);
    const yawRate = ArcadeGripModel.computeYawRate(
      1.0,
      steerLimit,
      6.0,
      0,
      0,
      0,
      DEFAULT_LIFT_OFF
    );

    // lateralDemand = 1.0 * 1.0 = 1.0, no clamp (Infinity)
    expect(yawRate).toBe(1.0);
  });

  it("test_highGrip_noUndersteer", () => {
    // Very high grip relative to demand → no clamping needed
    // throttle=1.0 to prevent lift-off oversteer from adding rotation boost
    const steerLimit = ArcadeGripModel.computeSteeringLimit(50, 1.0, 150, 0.3);
    const yawRate = ArcadeGripModel.computeYawRate(
      0.3,
      steerLimit,
      100.0,
      50,
      1.0,
      0,
      DEFAULT_LIFT_OFF
    );

    const expectedDemand = 0.3 * steerLimit;
    expect(yawRate).toBeCloseTo(expectedDemand, 5);
  });

  it("test_tireConditionZero_gripClampedToMinFactor", () => {
    // tireCondition = 0 → clamped to minGripFactor (0.15) before multiply
    // gripMax = 9.0 × 1.0 × 0.15 × 1.0 = 1.35
    const grip = ArcadeGripModel.computeGripMax(
      9.0,
      5,
      0.0,
      250,
      DEFAULT_GRIP_CONFIG
    );
    expect(grip).toBeCloseTo(9.0 * DEFAULT_GRIP_CONFIG.minGripFactor, 5);
  });

  it("test_compute_withEmptyState_doesNotThrow", () => {
    const model = new ArcadeGripModel();
    const state = createState();
    const config = createTestConfig();

    // Should handle zero-speed initial state gracefully
    expect(() =>
      model.compute(state, InputState.ZERO, 1 / 60, config)
    ).not.toThrow();
  });
});
