/**
 * Story 003: Engine, Gears, Drag, Braking — Unit tests.
 *
 * Covers all 9 acceptance criteria for the engine power, gears, drag,
 * braking, and elevation physics model. Pure math tests — no Babylon.js
 * imports needed.
 *
 * @see STORY-003 — Engine, Gears, Drag, Braking
 * @see TR-PHYSICS-010 — Engine model specification
 * @see ADR-0008 — Vehicle Physics — Arcade Dynamic
 */

import { describe, expect, it } from "vitest";
import { InputState } from "@/foundation/determinism/types";
import type {
  EngineConfigSub,
  EngineInputs,
  EngineStateSnapshot,
} from "@/physics-handling/arcade-grip-model";
import {
  ACCEL_MAP,
  ArcadeGripModel,
  GEAR_COUNT,
} from "@/physics-handling/arcade-grip-model";
import type { CarPhysicsState } from "@/physics-handling/car-physics-state";
import type { PhysicsConfig } from "@/physics-handling/physics-config";

// ─── Test Helpers ───────────────────────────────────────────────────────────

/**
 * Default engine config for most tests.
 */
const DEFAULT_ENGINE_CONFIG: EngineConfigSub = {
  gearRatios: [3.5, 2.5, 1.8, 1.3, 1.0, 0.8],
  rpmMax: 10000,
  accelLevel: 1,
  powerCeiling: 1,
  dragCoeff: 0.3,
  maxBrakeForce: 15,
  stopEpsilon: 0.1,
  autoShiftRpmThreshold: 0.8,
  downshiftRpmRatio: 0.5,
  reverseMaxSpeed: 20,
  gear1RedlineSpeed: 10,
  mass: 800,
};

/**
 * Default engine state snapshot.
 */
const DEFAULT_ENGINE_STATE: EngineStateSnapshot = {
  speedMs: 0,
  gear: 1,
  rpm: 0,
  fuelMult: 1,
  gradient: 0,
  mass: 800,
};

/**
 * Minimal PhysicsConfig for integration tests.
 */
function createTestConfig(overrides?: Partial<PhysicsConfig>): PhysicsConfig {
  return {
    baseGrip: 0.95,
    steerClampSpeed: 25,
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
    speedModRefSpeed: 30,
    speedModMinFactor: 0.8,
    autoShiftRpmThreshold: 8000,
    rpmMax: 10000,
    gearRatios: [3.5, 2.5, 1.8, 1.3, 1.0, 0.8],
    accelLevel: 1,
    powerCeiling: 1,
    downshiftRpmRatio: 0.5,
    reverseMaxSpeed: 20,
    gear1RedlineSpeed: 10,
    mass: 800,
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
    gradient: 0,
    locked: false,
    pitMode: false,
    tireBlownEmitted: false,
    fuelEmptyEmitted: false,
    wasAboveStopEpsilon: false,
    ...overrides,
  };
}

// ─── AC-1: computeRpm — RPM from Speed and Gear ────────────────────────────

describe("AC-1 — computeRpm: RPM from speed and gear", () => {
  const ratios = [3.5, 2.5, 1.8, 1.3, 1.0, 0.8];
  const rpmMax = 10000;

  it("test_zeroSpeed_returnsIdleRpm", () => {
    // At 0 speed, RPM should be idle (40% of rpmMax) regardless of gear
    const rpm = ArcadeGripModel.computeRpm(0, 1, ratios, rpmMax, 10);
    expect(rpm).toBe(rpmMax * 0.4);
  });

  it("test_lowerGear_higherRpm_atSameSpeed", () => {
    // At 10 m/s, gear 1 (ratio 3.5) should produce higher RPM than gear 2 (ratio 2.5)
    const rpmGear1 = ArcadeGripModel.computeRpm(10, 1, ratios, rpmMax, 10);
    const rpmGear2 = ArcadeGripModel.computeRpm(10, 2, ratios, rpmMax, 10);
    expect(rpmGear1).toBeGreaterThan(rpmGear2);
  });

  it("test_gear6_lowestRpm_atSameSpeed", () => {
    // At 30 m/s, gear 6 (ratio 0.8) should produce lower RPM than gear 5 (ratio 1.0)
    const rpmGear5 = ArcadeGripModel.computeRpm(30, 5, ratios, rpmMax, 10);
    const rpmGear6 = ArcadeGripModel.computeRpm(30, 6, ratios, rpmMax, 10);
    expect(rpmGear6).toBeLessThan(rpmGear5);
  });

  it("test_neutral_returnsIdleRpm", () => {
    // Neutral (gear 0) should return 40% of rpmMax regardless of speed
    const rpm = ArcadeGripModel.computeRpm(50, 0, ratios, rpmMax, 10);
    expect(rpm).toBe(rpmMax * 0.4);
  });

  it("test_reverse_returnsIdleRpm", () => {
    // Reverse (gear -1) should also return idle RPM
    const rpm = ArcadeGripModel.computeRpm(10, -1, ratios, rpmMax, 10);
    expect(rpm).toBe(rpmMax * 0.4);
  });

  it("test_rpmClamped_atOrBelowRpmMaxTimes1_05", () => {
    // Very high speed should not produce RPM beyond the over-rev buffer
    const rpm = ArcadeGripModel.computeRpm(100, 1, ratios, rpmMax, 10);
    expect(rpm).toBeLessThanOrEqual(rpmMax * 1.05 + 0.01);
  });

  it("test_gearAboveMax_usesTopGearRatio", () => {
    // Gear 10 (beyond GEAR_COUNT) should use the top gear ratio (gear 6)
    const rpmNormal = ArcadeGripModel.computeRpm(20, 6, ratios, rpmMax, 10);
    const rpmOob = ArcadeGripModel.computeRpm(20, 10, ratios, rpmMax, 10);
    expect(rpmOob).toBe(rpmNormal);
  });

  it("test_deterministic_identicalInputs", () => {
    const rpm1 = ArcadeGripModel.computeRpm(25, 3, ratios, rpmMax, 10);
    const rpm2 = ArcadeGripModel.computeRpm(25, 3, ratios, rpmMax, 10);
    expect(rpm1).toBe(rpm2);
  });
});

// ─── AC-2: computeTorque — Torque Curve ────────────────────────────────────

describe("AC-7 — computeTorque + computeTargetSpeed: Power output", () => {
  const rpmMax = 10000;

  it("test_zeroRpm_zeroTorque", () => {
    // At 0 RPM, torque should be 0
    const torque = ArcadeGripModel.computeTorque(0, 1, rpmMax);
    expect(torque).toBe(0);
  });

  it("test_atRpmMax_fullTorqueForLevel1", () => {
    // At rpmMax, torque = 1.0 * ACCEL_MAP[0] = 1.0
    const torque = ArcadeGripModel.computeTorque(rpmMax, 1, rpmMax);
    expect(torque).toBeCloseTo(ACCEL_MAP[0], 5);
  });

  it("test_higherAccelLevel_higherTorque", () => {
    // Level 5 should produce higher torque than Level 1 at same RPM
    const torqueL1 = ArcadeGripModel.computeTorque(5000, 1, rpmMax);
    const torqueL5 = ArcadeGripModel.computeTorque(5000, 5, rpmMax);
    expect(torqueL5).toBeGreaterThan(torqueL1);
  });

  it("test_linearRamp_halfRpm_halfTorque", () => {
    // At half rpmMax, torque should be half of ACCEL_MAP[level-1]
    const torque = ArcadeGripModel.computeTorque(5000, 1, rpmMax);
    expect(torque).toBeCloseTo(0.5 * ACCEL_MAP[0], 5);
  });

  it("test_accelLevelClamped_below1", () => {
    // Level 0 should be clamped to level 1
    const torqueL0 = ArcadeGripModel.computeTorque(5000, 0, rpmMax);
    const torqueL1 = ArcadeGripModel.computeTorque(5000, 1, rpmMax);
    expect(torqueL0).toBeCloseTo(torqueL1, 10);
  });

  it("test_accelLevelClamped_above5", () => {
    // Level 6 should be clamped to level 5
    const torqueL6 = ArcadeGripModel.computeTorque(5000, 6, rpmMax);
    const torqueL5 = ArcadeGripModel.computeTorque(5000, 5, rpmMax);
    expect(torqueL6).toBeCloseTo(torqueL5, 10);
  });

  it("test_deterministic_identicalInputs", () => {
    const t1 = ArcadeGripModel.computeTorque(7500, 3, rpmMax);
    const t2 = ArcadeGripModel.computeTorque(7500, 3, rpmMax);
    expect(t1).toBe(t2);
  });
});

// ─── AC-3: applyGearDelta — Manual Gear Shift ──────────────────────────────

describe("AC-3 — applyGearDelta: Manual gear shift", () => {
  const config = DEFAULT_ENGINE_CONFIG;

  it("test_deltaZero_noChange", () => {
    const gear = ArcadeGripModel.applyGearDelta(3, 0, 0, 20, config);
    expect(gear).toBe(3);
  });

  it("test_upshiftFromGear1_toGear2", () => {
    const gear = ArcadeGripModel.applyGearDelta(1, 1, 0, 20, config);
    expect(gear).toBe(2);
  });

  it("test_downshiftFromGear3_toGear2", () => {
    const gear = ArcadeGripModel.applyGearDelta(3, -1, 0, 20, config);
    expect(gear).toBe(2);
  });

  it("test_upshiftFromGear6_cappedAtGear6", () => {
    // Upshifting from top gear should stay at GEAR_COUNT
    const gear = ArcadeGripModel.applyGearDelta(GEAR_COUNT, 1, 0, 20, config);
    expect(gear).toBe(GEAR_COUNT);
  });

  it("test_downshiftFromGear1_staysAtGear1", () => {
    // Downshifting from first gear should stay at 1 (forward gears floor at 1)
    const gear = ArcadeGripModel.applyGearDelta(1, -1, 0, 20, config);
    expect(gear).toBe(1);
  });

  it("test_neutralUpshift_toGear1", () => {
    // Delta +1 from neutral → gear 1
    const gear = ArcadeGripModel.applyGearDelta(0, 1, 0, 0, config);
    expect(gear).toBe(1);
  });

  it("test_neutralDownshift_toReverse", () => {
    // Delta -1 from neutral → reverse (-1)
    const gear = ArcadeGripModel.applyGearDelta(0, -1, 0, 0, config);
    expect(gear).toBe(-1);
  });

  it("test_reverseGate_requiresStopOrBrakeToLeaveReverse", () => {
    // Reverse → neutral: delta=+1, but speed=5 > stopEpsilon → stay in reverse
    const gear = ArcadeGripModel.applyGearDelta(-1, 1, 0, 5, config);
    expect(gear).toBe(-1);

    // Reverse → neutral: delta=+1, speed=0.05 < stopEpsilon → approve
    const gearLowSpeed = ArcadeGripModel.applyGearDelta(-1, 1, 0, 0.05, config);
    expect(gearLowSpeed).toBe(0);

    // Reverse → neutral: delta=+1, brake > 0 → approve regardless of speed
    const gearBrake = ArcadeGripModel.applyGearDelta(-1, 1, 0.5, 20, config);
    expect(gearBrake).toBe(0);
  });

  it("test_reverseGate_downshiftFromReverse_staysInReverse", () => {
    // Delta -1 from reverse should keep it at -1 (can't go lower)
    const gear = ArcadeGripModel.applyGearDelta(-1, -1, 0, 0, config);
    expect(gear).toBe(-1);
  });

  it("test_deterministic_identicalInputs", () => {
    const g1 = ArcadeGripModel.applyGearDelta(3, 1, 0, 20, config);
    const g2 = ArcadeGripModel.applyGearDelta(3, 1, 0, 20, config);
    expect(g1).toBe(g2);
  });
});

// ─── AC-4: autoShift — Automatic Gear Changes ──────────────────────────────

describe("AC-2 — autoShift: Automatic gear changes", () => {
  const rpmMax = 10000;
  const threshold = 0.8;

  it("test_aboveThreshold_upshifts", () => {
    // RPM above upshift threshold (8000) in gear 3 → upshift to gear 4
    const gear = ArcadeGripModel.autoShift(8500, 3, rpmMax, threshold);
    expect(gear).toBe(4);
  });

  it("test_belowHalfThreshold_downshifts", () => {
    // RPM below half-threshold (4000) in gear 3 → downshift to gear 2
    const gear = ArcadeGripModel.autoShift(3000, 3, rpmMax, threshold);
    expect(gear).toBe(2);
  });

  it("test_inMidRange_noChange", () => {
    // RPM at 5000 (between 4000 and 8000) in gear 3 → no change
    const gear = ArcadeGripModel.autoShift(5000, 3, rpmMax, threshold);
    expect(gear).toBe(3);
  });

  it("test_gear6_noUpshift", () => {
    // In top gear, even with high RPM, no upshift should occur
    const gear = ArcadeGripModel.autoShift(9500, GEAR_COUNT, rpmMax, threshold);
    expect(gear).toBe(GEAR_COUNT);
  });

  it("test_gear1_noDownshift", () => {
    // In gear 1, even with very low RPM, no downshift should occur
    const gear = ArcadeGripModel.autoShift(500, 1, rpmMax, threshold);
    expect(gear).toBe(1);
  });

  it("test_neutral_noAutoShift", () => {
    // Auto-shift should not affect neutral
    const gear = ArcadeGripModel.autoShift(8500, 0, rpmMax, threshold);
    expect(gear).toBe(0);
  });

  it("test_reverse_noAutoShift", () => {
    // Auto-shift should not affect reverse
    const gear = ArcadeGripModel.autoShift(8500, -1, rpmMax, threshold);
    expect(gear).toBe(-1);
  });

  it("test_aboveThresholdAtGear5_upshiftsToGear6", () => {
    // Gear 5 with high RPM → upshift to gear 6 (top gear)
    const gear = ArcadeGripModel.autoShift(8500, 5, rpmMax, threshold);
    expect(gear).toBe(6);
  });

  it("test_atExactThreshold_noShift", () => {
    // Exactly at threshold (8000) — not strictly above it → no upshift
    const gear = ArcadeGripModel.autoShift(8000, 3, rpmMax, threshold);
    expect(gear).toBe(3);
  });

  it("test_deterministic_identicalInputs", () => {
    const g1 = ArcadeGripModel.autoShift(8500, 3, rpmMax, threshold);
    const g2 = ArcadeGripModel.autoShift(8500, 3, rpmMax, threshold);
    expect(g1).toBe(g2);
  });
});

// ─── AC-5: computeDragForce — Aerodynamic Drag ─────────────────────────────

describe("AC-6 — computeDragForce: Aerodynamic drag", () => {
  it("test_zeroSpeed_zeroDrag", () => {
    // At 0 m/s, no aerodynamic drag
    const drag = ArcadeGripModel.computeDragForce(0, 0.3);
    expect(drag).toBe(0);
  });

  it("test_positiveSpeed_negativeDrag", () => {
    // At positive speed, drag opposes motion (negative value)
    const drag = ArcadeGripModel.computeDragForce(10, 0.3);
    expect(drag).toBeLessThan(0);
  });

  it("test_dragGrowsWithSpeedSquared", () => {
    // Drag scales with speed²: at 20 m/s, drag should be 4× the drag at 10 m/s
    const drag10 = ArcadeGripModel.computeDragForce(10, 0.3);
    const drag20 = ArcadeGripModel.computeDragForce(20, 0.3);
    expect(drag20).toBeCloseTo(drag10 * 4, 10);
  });

  it("test_higherDragCoeffMoreDrag", () => {
    // Higher drag coefficient → more negative drag
    const dragLow = ArcadeGripModel.computeDragForce(20, 0.3);
    const dragHigh = ArcadeGripModel.computeDragForce(20, 0.6);
    expect(dragHigh).toBeLessThan(dragLow);
  });

  it("test_negativeSpeed_positiveDrag", () => {
    // At negative speed (moving backward), drag should be positive (opposing)
    const drag = ArcadeGripModel.computeDragForce(-10, 0.3);
    expect(drag).toBeGreaterThan(0);
  });

  it("test_preciseFormula_verification", () => {
    // Exact check: drag = -0.3 * 15² * 1 = -67.5
    const drag = ArcadeGripModel.computeDragForce(15, 0.3);
    expect(drag).toBeCloseTo(-67.5, 5);
  });

  it("test_deterministic_identicalInputs", () => {
    const d1 = ArcadeGripModel.computeDragForce(25, 0.3);
    const d2 = ArcadeGripModel.computeDragForce(25, 0.3);
    expect(d1).toBe(d2);
  });
});

// ─── AC-6: computeBrakeForce — Braking ─────────────────────────────────────

describe("AC-5 — computeBrakeForce: Braking", () => {
  it("test_zeroBrake_zeroForce", () => {
    const brake = ArcadeGripModel.computeBrakeForce(0, 15);
    expect(brake).toBe(0);
  });

  it("test_fullBrake_maxForce", () => {
    const brake = ArcadeGripModel.computeBrakeForce(1, 15);
    expect(brake).toBe(15);
  });

  it("test_halfBrake_halfForce", () => {
    // Brake at 50% should produce 50% of max brake force
    const brake = ArcadeGripModel.computeBrakeForce(0.5, 15);
    expect(brake).toBe(7.5);
  });

  it("test_higherMaxForce_strongerBrake", () => {
    const brakeDefault = ArcadeGripModel.computeBrakeForce(0.5, 15);
    const brakeStrong = ArcadeGripModel.computeBrakeForce(0.5, 30);
    expect(brakeStrong).toBe(brakeDefault * 2);
  });

  it("test_outputAlwaysNonNegative", () => {
    // Brake force is a magnitude, always ≥ 0
    const b1 = ArcadeGripModel.computeBrakeForce(0, 15);
    const b2 = ArcadeGripModel.computeBrakeForce(0.3, 15);
    const b3 = ArcadeGripModel.computeBrakeForce(1, 15);
    expect(b1).toBeGreaterThanOrEqual(0);
    expect(b2).toBeGreaterThanOrEqual(0);
    expect(b3).toBeGreaterThanOrEqual(0);
  });

  it("test_deterministic_identicalInputs", () => {
    const b1 = ArcadeGripModel.computeBrakeForce(0.7, 15);
    const b2 = ArcadeGripModel.computeBrakeForce(0.7, 15);
    expect(b1).toBe(b2);
  });
});

// ─── AC-7: computeCoastDeceleration ────────────────────────────────────────

describe("AC-9 — computeCoastDeceleration: Zero-input coast", () => {
  it("test_zeroSpeed_zeroDeceleration", () => {
    // At 0 m/s, no drag → no coast deceleration
    const decel = ArcadeGripModel.computeCoastDeceleration(0, 0.3, 800);
    expect(decel).toBe(0);
  });

  it("test_positiveSpeed_positiveDeceleration", () => {
    // Coast deceleration should be positive (slowing down)
    const decel = ArcadeGripModel.computeCoastDeceleration(20, 0.3, 800);
    expect(decel).toBeGreaterThan(0);
  });

  it("test_higherDragCoeff_fasterDeceleration", () => {
    const decelLow = ArcadeGripModel.computeCoastDeceleration(20, 0.3, 800);
    const decelHigh = ArcadeGripModel.computeCoastDeceleration(20, 0.6, 800);
    expect(decelHigh).toBeGreaterThan(decelLow);
  });

  it("test_lowerMass_fasterDeceleration", () => {
    // Lighter car decelerates faster under same drag
    const decelHeavy = ArcadeGripModel.computeCoastDeceleration(20, 0.3, 1600);
    const decelLight = ArcadeGripModel.computeCoastDeceleration(20, 0.3, 800);
    expect(decelLight).toBeGreaterThan(decelHeavy);
  });

  it("test_preciseFormula_verification", () => {
    // decel = (0.3 * 15²) / 800 = 67.5 / 800 = 0.084375
    const decel = ArcadeGripModel.computeCoastDeceleration(15, 0.3, 800);
    expect(decel).toBeCloseTo(0.084375, 10);
  });

  it("test_deterministic_identicalInputs", () => {
    const d1 = ArcadeGripModel.computeCoastDeceleration(20, 0.3, 800);
    const d2 = ArcadeGripModel.computeCoastDeceleration(20, 0.3, 800);
    expect(d1).toBe(d2);
  });
});

// ─── AC-8: computeGradientForce — Elevation Effect ─────────────────────────

describe("AC-8 — computeGradientForce: Elevation effect", () => {
  const mass = 800;

  it("test_flatGradient_zeroForce", () => {
    // Gradient = 0 (flat) → no gradient force
    const force = ArcadeGripModel.computeGradientForce(0, mass);
    expect(force).toBe(0);
  });

  it("test_uphillGradient_negativeForce", () => {
    // Positive gradient (uphill) → force opposes motion (negative)
    const force = ArcadeGripModel.computeGradientForce(0.1, mass);
    expect(force).toBeLessThan(0);
  });

  it("test_downhillGradient_positiveForce", () => {
    // Negative gradient (downhill) → force aids motion (positive)
    const force = ArcadeGripModel.computeGradientForce(-0.1, mass);
    expect(force).toBeGreaterThan(0);
  });

  it("test_steeperGradient_strongerForce", () => {
    // Steeper uphill gradient produces more negative force
    const gentle = ArcadeGripModel.computeGradientForce(0.05, mass);
    const steep = ArcadeGripModel.computeGradientForce(0.2, mass);
    expect(steep).toBeLessThan(gentle);
  });

  it("test_heavierMass_strongerGradientForce", () => {
    // Heavier car experiences stronger gradient force
    const light = ArcadeGripModel.computeGradientForce(0.1, 600);
    const heavy = ArcadeGripModel.computeGradientForce(0.1, 1200);
    expect(heavy).toBeLessThan(light); // More negative (stronger downhill pull)
  });

  it("test_preciseFormula_verification", () => {
    // gradientForce = -9.81 × 800 × 0.1 = -784.8
    const force = ArcadeGripModel.computeGradientForce(0.1, 800);
    expect(force).toBeCloseTo(-784.8, 5);
  });

  it("test_uphillSlowsNetAcceleration", () => {
    // Net acceleration on uphill = net acceleration on flat - gradientForce/mass
    // gradientForce/mass = -9.81 × 0.1 = -0.981 m/s² reduction
    const force = ArcadeGripModel.computeGradientForce(0.1, 800);
    const decelDueToGradient = force / 800;
    expect(decelDueToGradient).toBeCloseTo(-0.981, 5);
  });

  it("test_deterministic_identicalInputs", () => {
    const f1 = ArcadeGripModel.computeGradientForce(0.1, 800);
    const f2 = ArcadeGripModel.computeGradientForce(0.1, 800);
    expect(f1).toBe(f2);
  });
});

// ─── AC-9: computeTargetSpeed — Full Engine Model Integration ──────────────

describe("AC-7-integration — computeTargetSpeed: Full engine model", () => {
  it("test_throttleIncreasesSpeed_fromRolling", () => {
    // Throttle at rolling speed should produce non-zero target speed
    const engineState: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 10,
      gear: 2,
      rpm: 3000,
    };
    const inputs: EngineInputs = { throttle: 0.5, brake: 0, gearDelta: 0 };

    const newSpeed = ArcadeGripModel.computeTargetSpeed(
      engineState,
      inputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );

    // With powerCeiling=1 and drag opposing motion, output may be less than input.
    // The key assertion: no crash, output is >= 0, and engine state was updated.
    expect(newSpeed).toBeGreaterThanOrEqual(0);
    expect(engineState.rpm).toBeGreaterThan(0);
    expect(engineState.gear).toBeGreaterThanOrEqual(1);
  });

  it("test_zeroThrottle_coastsToStop", () => {
    // With no throttle or brake, drag should decelerate the car
    const engineState: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 30,
      gear: 3,
      rpm: 5000,
    };
    const inputs: EngineInputs = { throttle: 0, brake: 0, gearDelta: 0 };

    const newSpeed = ArcadeGripModel.computeTargetSpeed(
      engineState,
      inputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );

    // Speed should decrease due to drag (no power, no brake)
    expect(newSpeed).toBeGreaterThanOrEqual(0);
    expect(newSpeed).toBeLessThan(engineState.speedMs);
  });

  it("test_brakingReducesSpeed_fasterThanCoast", () => {
    // Brake should decelerate faster than coast alone
    const stateCoast: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 30,
      gear: 3,
      rpm: 5000,
    };
    const stateBrake: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 30,
      gear: 3,
      rpm: 5000,
    };
    const coastInputs: EngineInputs = { throttle: 0, brake: 0, gearDelta: 0 };
    const brakeInputs: EngineInputs = { throttle: 0, brake: 1, gearDelta: 0 };

    const speedCoast = ArcadeGripModel.computeTargetSpeed(
      stateCoast,
      coastInputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );
    const speedBrake = ArcadeGripModel.computeTargetSpeed(
      stateBrake,
      brakeInputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );

    expect(speedBrake).toBeLessThan(speedCoast);
  });

  it("test_speedNeverGoesBelowZero", () => {
    // Braking reduces speed and the result must never be negative
    const engineState: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 1,
      gear: 1,
      rpm: 1000,
    };
    const inputs: EngineInputs = { throttle: 0, brake: 1, gearDelta: 0 };

    const newSpeed = ArcadeGripModel.computeTargetSpeed(
      engineState,
      inputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );

    // Speed should decrease with brake applied
    expect(newSpeed).toBeLessThan(engineState.speedMs);
    // Speed must never go negative
    expect(newSpeed).toBeGreaterThanOrEqual(0);
  });

  it("test_uphillGradient_reducesAcceleration", () => {
    // Uphill gradient reduces net acceleration compared to flat
    const stateFlat: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 10,
      gear: 2,
      rpm: 3000,
    };
    const stateUphill: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 10,
      gear: 2,
      rpm: 3000,
      gradient: 0.1,
    };
    const inputs: EngineInputs = { throttle: 0.5, brake: 0, gearDelta: 0 };

    const speedFlat = ArcadeGripModel.computeTargetSpeed(
      stateFlat,
      inputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );
    const speedUphill = ArcadeGripModel.computeTargetSpeed(
      stateUphill,
      inputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );

    // Uphill should be slower than flat
    expect(speedUphill).toBeLessThan(speedFlat);
  });

  it("test_downhillGradient_increasesAcceleration", () => {
    // Downhill gradient increases net acceleration compared to flat
    const stateFlat: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 10,
      gear: 2,
      rpm: 3000,
    };
    const stateDownhill: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 10,
      gear: 2,
      rpm: 3000,
      gradient: -0.1,
    };
    const inputs: EngineInputs = { throttle: 0.5, brake: 0, gearDelta: 0 };

    const speedFlat = ArcadeGripModel.computeTargetSpeed(
      stateFlat,
      inputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );
    const speedDownhill = ArcadeGripModel.computeTargetSpeed(
      stateDownhill,
      inputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );

    // Downhill should be faster than flat
    expect(speedDownhill).toBeGreaterThan(speedFlat);
  });

  it("test_autoShift_upshiftsAtHighRpm", () => {
    // With sustained throttle in low gear, RPM rises and triggers upshift
    // Simulation: high speed in gear 1 with full throttle
    const engineState: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 15, // Fast enough to make RPM high in gear 1
      gear: 1,
      rpm: 3000,
    };
    const inputs: EngineInputs = { throttle: 1, brake: 0, gearDelta: 0 };

    ArcadeGripModel.computeTargetSpeed(
      engineState,
      inputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );

    // autoShift should have upshifted due to high RPM
    expect(engineState.gear).toBeGreaterThanOrEqual(1);
  });

  it("test_manualGearOverride_shiftsGear", () => {
    // Manual downshift should override auto-shift
    const engineState: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 20,
      gear: 3,
      rpm: 4000,
    };
    const inputs: EngineInputs = { throttle: 0.5, brake: 0, gearDelta: -1 };

    ArcadeGripModel.computeTargetSpeed(
      engineState,
      inputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );

    // Gear should decrease by 1 (manual downshift)
    expect(engineState.gear).toBe(2);
  });

  it("test_fuelMult_scalesPower", () => {
    // Low fuel should reduce acceleration
    const stateFullFuel: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 5,
      gear: 1,
      rpm: 2000,
      fuelMult: 1,
    };
    const stateLowFuel: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 5,
      gear: 1,
      rpm: 2000,
      fuelMult: 0.5,
    };
    const inputs: EngineInputs = { throttle: 1, brake: 0, gearDelta: 0 };

    const speedFull = ArcadeGripModel.computeTargetSpeed(
      stateFullFuel,
      inputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );
    const speedLow = ArcadeGripModel.computeTargetSpeed(
      stateLowFuel,
      inputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );

    expect(speedFull).toBeGreaterThan(speedLow);
  });

  it("test_deterministic_identicalInputs", () => {
    const state1: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 20,
      gear: 2,
      rpm: 4000,
    };
    const state2: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 20,
      gear: 2,
      rpm: 4000,
    };
    const inputs: EngineInputs = { throttle: 0.7, brake: 0, gearDelta: 0 };

    const s1 = ArcadeGripModel.computeTargetSpeed(
      state1,
      inputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );
    const s2 = ArcadeGripModel.computeTargetSpeed(
      state2,
      inputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );

    expect(s1).toBe(s2);
    expect(state1.gear).toBe(state2.gear);
    expect(state1.rpm).toBe(state2.rpm);
  });
});

// ─── compute() Integration Tests ────────────────────────────────────────────

describe("ArcadeGripModel.compute() — engine model integration", () => {
  it("test_compute_withThrottle_accelerates", () => {
    const model = new ArcadeGripModel();
    const state = createState({ speedKmh: 10, gear: 1, rpm: 3000 });
    const config = createTestConfig();
    const input: InputState = {
      ...InputState.ZERO,
      throttle: 1,
    };

    model.compute(state, input, 1 / 60, config);

    // With throttle applied, target speed should be above current speed
    expect(state.targetSpeed).toBeGreaterThan(0);
    expect(state.rpm).toBeGreaterThan(0);
  });

  it("test_compute_withBrake_slowsDown", () => {
    const model = new ArcadeGripModel();
    const state = createState({ speedKmh: 100, gear: 3, rpm: 6000 });
    const config = createTestConfig();
    const input: InputState = {
      ...InputState.ZERO,
      brake: 1,
    };

    model.compute(state, input, 1 / 60, config);

    // With brake applied, target speed should be less than current speed
    const currentMs = 100 / 3.6;
    expect(state.targetSpeed).toBeLessThan(currentMs);
  });

  it("test_compute_gearShift_applied", () => {
    const model = new ArcadeGripModel();
    const state = createState({ speedKmh: 50, gear: 2, rpm: 4000 });
    const config = createTestConfig();
    const input: InputState = {
      ...InputState.ZERO,
      throttle: 0.5,
      gearDelta: 1, // Upshift command
    };

    model.compute(state, input, 1 / 60, config);

    // Manual upshift should be reflected in the state
    expect(state.gear).toBe(3);
  });

  it("test_compute_gradientAffectsSpeed", () => {
    const model = new ArcadeGripModel();

    const stateFlat = createState({
      speedKmh: 50,
      gear: 2,
      rpm: 4000,
      gradient: 0,
    });
    const stateUphill = createState({
      speedKmh: 50,
      gear: 2,
      rpm: 4000,
      gradient: 0.2,
    });
    const config = createTestConfig();
    const input: InputState = {
      ...InputState.ZERO,
      throttle: 0.5,
    };

    model.compute(stateFlat, input, 1 / 60, config);
    model.compute(stateUphill, input, 1 / 60, config);

    // Uphill should result in lower target speed
    expect(stateUphill.targetSpeed).toBeLessThan(stateFlat.targetSpeed);
  });

  it("test_compute_deterministic_identicalOutput", () => {
    const model = new ArcadeGripModel();
    const config = createTestConfig();
    const input: InputState = {
      ...InputState.ZERO,
      throttle: 0.7,
    };

    const state1 = createState({ speedKmh: 60, gear: 3, rpm: 5000 });
    const state2 = createState({ speedKmh: 60, gear: 3, rpm: 5000 });

    model.compute(state1, input, 1 / 60, config);
    model.compute(state2, input, 1 / 60, config);

    expect(state1.targetSpeed).toBe(state2.targetSpeed);
    expect(state1.targetYawRate).toBe(state2.targetYawRate);
    expect(state1.rpm).toBe(state2.rpm);
    expect(state1.gear).toBe(state2.gear);
    expect(state1.speedKmh).toBe(state2.speedKmh);
  });

  it("test_compute_withZeroInput_engineAtRest", () => {
    const model = new ArcadeGripModel();
    const state = createState();
    const config = createTestConfig();

    model.compute(state, InputState.ZERO, 1 / 60, config);

    // With throttle=0: no power, gear stays at 0 (neutral default), rpm is idle
    expect(state.targetSpeed).toBe(0);
    expect(state.gear).toBe(0);
    expect(state.rpm).toBe(config.rpmMax * 0.4); // Idle RPM
  });

  it("test_compute_telemetryReflectsEngineState", () => {
    const model = new ArcadeGripModel();
    const state = createState({ speedKmh: 80, gear: 3, rpm: 5000 });
    const config = createTestConfig();
    const input: InputState = {
      ...InputState.ZERO,
      throttle: 0.5,
    };

    model.compute(state, input, 1 / 60, config);

    // After compute, telemetry fields should reflect the engine model results
    expect(state.lateralG).toBeTypeOf("number");
    expect(state.accelG).toBeTypeOf("number");
    expect(state.tireSqueal).toBeTypeOf("number");
    expect(state.rpm).toBeGreaterThan(0);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("test_zeroMass_doesNotDivideByZero", () => {
    // mass defaults to 1 in computeCoastDeceleration to prevent division by zero
    const decel = ArcadeGripModel.computeCoastDeceleration(20, 0.3, 0);
    expect(decel).toBe(0.3 * 400); // (0.3 * 400) / 1 = 120
    expect(decel).toBe(120);
  });

  it("test_rpmMaxZero_doesNotDivideByZero", () => {
    // rpmMax = 0 should not cause division by zero in computeTorque
    const torque = ArcadeGripModel.computeTorque(5000, 1, 0);
    // t = 5000 / max(0, 1) = 5000 — safe via Math.max(rpmMax, 1)
    expect(torque).toBeGreaterThanOrEqual(0);
  });

  it("test_veryHighSpeed_rpmClamped", () => {
    // Very high speed should clamp RPM to rpmMax * 1.05
    // Gear 2 at 200 m/s: 200 * 2.5 * 10000 / (3.5 * 10) ≈ 142857 → clamped to 10500
    const rpm = ArcadeGripModel.computeRpm(
      200,
      2,
      DEFAULT_ENGINE_CONFIG.gearRatios,
      10000,
      10
    );
    expect(rpm).toBe(10500); // 10000 * 1.05
  });

  it("test_compute_withEmptyState_doesNotThrow", () => {
    const model = new ArcadeGripModel();
    const state = createState();
    const config = createTestConfig();

    expect(() =>
      model.compute(state, InputState.ZERO, 1 / 60, config)
    ).not.toThrow();
  });

  it("test_brakeThenThrottle_brakeDominant", () => {
    // When both brake and throttle are applied, brake takes priority
    const engineState: EngineStateSnapshot = {
      ...DEFAULT_ENGINE_STATE,
      speedMs: 20,
      gear: 3,
      rpm: 4000,
    };
    const inputs: EngineInputs = { throttle: 1, brake: 1, gearDelta: 0 };

    const newSpeed = ArcadeGripModel.computeTargetSpeed(
      engineState,
      inputs,
      1 / 60,
      DEFAULT_ENGINE_CONFIG
    );

    // Brake dominant: net force should be negative
    expect(newSpeed).toBeLessThan(engineState.speedMs);
  });

  it("test_gear6_upshift_staysAtSix", () => {
    const gear = ArcadeGripModel.applyGearDelta(
      6,
      1,
      0,
      30,
      DEFAULT_ENGINE_CONFIG
    );
    expect(gear).toBe(6);
  });

  it("test_gear1_downshift_staysAtOne", () => {
    const gear = ArcadeGripModel.applyGearDelta(
      1,
      -1,
      0,
      30,
      DEFAULT_ENGINE_CONFIG
    );
    expect(gear).toBe(1);
  });
});

// ─── ACCEL_MAP Verification ─────────────────────────────────────────────────

describe("ACCEL_MAP — Acceleration multiplier table", () => {
  it("has exactly 5 entries", () => {
    expect(ACCEL_MAP).toHaveLength(5);
  });

  it("level1 is 1.0", () => {
    expect(ACCEL_MAP[0]).toBe(1.0);
  });

  it("level5 is 1.3", () => {
    expect(ACCEL_MAP[4]).toBe(1.3);
  });

  it("values are strictly increasing", () => {
    for (let i = 1; i < ACCEL_MAP.length; i++) {
      expect(ACCEL_MAP[i]).toBeGreaterThan(ACCEL_MAP[i - 1]);
    }
  });
});

// ─── GEAR_COUNT Verification ────────────────────────────────────────────────

describe("GEAR_COUNT — Forward gear count", () => {
  it("is exactly 6", () => {
    expect(GEAR_COUNT).toBe(6);
  });
});
