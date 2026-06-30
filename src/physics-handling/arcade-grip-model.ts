/**
 * Arcade Grip Model — Phase 1 of the Arcade Dynamic vehicle pipeline.
 *
 * Computes gripMax, yaw rate, and telemetry values for one car per tick.
 * Pure math — no engine API dependencies, no Babylon.js imports.
 *
 * **Grip formula** (C23): gripMax = baseGrip × cornerStat × tireCondition × speedMod
 * **Steering**: velocity-dependent clamp + understeer limit + lift-off oversteer
 *
 * @see ADR-0008 — Vehicle Physics — Arcade Dynamic
 * @see TR-PHYSICS-001 — Arcade grip model formula
 * @see C22 — Phase 1 runs first in pipeline slot #2
 * @see C23 — Grip formula definition
 *
 * @example
 * ```typescript
 * const model = new ArcadeGripModel();
 * model.compute(state, input, dt, config);
 * ```
 */

import type { InputState } from "@/foundation/determinism/types";
import type { CarPhysicsState } from "./car-physics-state";
import type { PhysicsConfig } from "./physics-config";

// ─── Config Sub-Interfaces ──────────────────────────────────────────────────

/**
 * Configuration needed for speed-modulated grip computation.
 */
export interface SpeedModConfig {
  /** Reference speed (km/h) at which speedMod reaches 1.0. */
  readonly speedModRefSpeedKmh: number;
  /** Minimum grip factor at zero speed (0..1). */
  readonly speedModMinFactor: number;
}

/**
 * Configuration needed for gripMax computation (extends SpeedModConfig).
 */
export interface GripConfig extends SpeedModConfig {
  /** Minimum effective grip factor — floor to prevent zero-grip ice. */
  readonly minGripFactor: number;
}

/**
 * Configuration for lift-off oversteer detection.
 */
export interface LiftOffConfig {
  /** Throttle threshold below which lift-off oversteer activates (0..1). */
  readonly throttleMax: number;
  /** Minimum steering input magnitude to trigger lift-off oversteer. */
  readonly minSteering: number;
  /** Brake threshold below which lift-off oversteer activates (0..1). */
  readonly brakeMax: number;
}

// ─── Engine Constants ───────────────────────────────────────────────────────

/** Number of forward gears (1–6). */
export const GEAR_COUNT = 6;

/**
 * Acceleration level to torque curve multiplier mapping.
 * accelLevel 1 → 1.0, accelLevel 5 → 1.3
 * @see ADR-0008 — Engine Power section
 */
export const ACCEL_MAP: readonly number[] = [1.0, 1.08, 1.16, 1.22, 1.3];

// ─── Engine Sub-Interfaces ──────────────────────────────────────────────────

/**
 * Per-tick analog inputs consumed by the engine model.
 */
export interface EngineInputs {
  /** Throttle input: 0 (none) to 1 (full). */
  readonly throttle: number;
  /** Brake input: 0 (none) to 1 (full). */
  readonly brake: number;
  /** Gear change delta: -1 (downshift), 0 (no change), +1 (upshift). */
  readonly gearDelta: -1 | 0 | 1;
}

/**
 * Mutable engine state snapshot for computeTargetSpeed.
 * Fields are mutated during gear/RPM computations, then read back.
 */
export interface EngineStateSnapshot {
  /** Current forward speed in m/s. */
  speedMs: number;
  /** Current gear (0 = neutral, 1–6 = forward, -1 = reverse). */
  gear: number;
  /** Current engine RPM. */
  rpm: number;
  /** Fuel multiplier (0..1) — scales power linearly. */
  fuelMult: number;
  /** Track gradient at car position (sin of slope angle, positive uphill). */
  gradient: number;
  /** Car mass in kg. */
  mass: number;
}

/**
 * Configuration sub-interface for the engine model.
 */
export interface EngineConfigSub {
  /** 6 forward gear ratios (G1 through G6). */
  readonly gearRatios: number[];
  /** Maximum engine RPM. */
  readonly rpmMax: number;
  /** Acceleration level (1–5) for torque curve multiplier. */
  readonly accelLevel: number;
  /** Maximum power output multiplier. */
  readonly powerCeiling: number;
  /** Aerodynamic drag coefficient. */
  readonly dragCoeff: number;
  /** Maximum braking force. */
  readonly maxBrakeForce: number;
  /** Speed below which the car is considered stopped (m/s). */
  readonly stopEpsilon: number;
  /** RPM threshold for automatic upshift (fraction of rpmMax). */
  readonly autoShiftRpmThreshold: number;
  /** RPM ratio for downshift threshold (fraction of upshift threshold). */
  readonly downshiftRpmRatio: number;
  /** Maximum reverse speed (m/s). */
  readonly reverseMaxSpeed: number;
  /** Speed (m/s) at which 1st gear reaches rpmMax — determines RPM scaling. */
  readonly gear1RedlineSpeed: number;
  /** Car mass in kg. */
  readonly mass: number;
}

// ─── ArcadeGripModel ────────────────────────────────────────────────────────

/**
 * Arcade grip model — pure math functions for Phase 1 computation.
 *
 * All static methods are pure functions (no side effects, deterministic).
 * The instance `compute()` method writes to CarPhysicsState and is the
 * Phase 1 entry point called by PhysicsService.
 */
export class ArcadeGripModel {
  /** Cached GripConfig — updated when PhysicsConfig changes. */
  private _gripConfig: GripConfig = {
    speedModRefSpeedKmh: 0,
    speedModMinFactor: 0,
    minGripFactor: 0,
  };

  /** Cached LiftOffConfig — updated when PhysicsConfig changes. */
  private _liftOffConfig: LiftOffConfig = {
    throttleMax: 0,
    minSteering: 0,
    brakeMax: 0,
  };

  // ─── Public Static API (Pure Math) ──────────────────────────────────────

  /**
   * Compute gripMax — the lateral acceleration limit for one car.
   *
   * Formula: gripMax = baseGrip × cornerStat × tireCondition × speedMod
   * Clamped: result ≥ minGripFactor (prevents zero-grip ice).
   *
   * @param baseGrip - Base grip coefficient (primary feel knob)
   * @param corneringLevel - Cornering stat level (1–5)
   * @param tireCondition - Tire condition (0 = worn, 1 = new)
   * @param speedKmh - Current speed in km/h
   * @param config - Grip configuration values
   * @returns Lateral acceleration limit (m/s²)
   *
   * @see TR-PHYSICS-001 — gripMax formula
   * @see C23 — Grip formula definition
   */
  static computeGripMax(
    baseGrip: number,
    corneringLevel: number,
    tireCondition: number,
    speedKmh: number,
    config: GripConfig
  ): number {
    const cornerStat = ArcadeGripModel.computeCornerStat(corneringLevel);
    const speedMod = ArcadeGripModel.computeSpeedMod(speedKmh, config);
    // tireCondition is clamped to minGripFactor to prevent zero-grip ice
    const clampedTire = Math.max(config.minGripFactor, tireCondition);
    return baseGrip * cornerStat * clampedTire * speedMod;
  }

  /**
   * Compute cornerStat from a cornering level (1–5).
   *
   * Formula: cornerStat = 0.6 + (level - 1) × 0.1
   * Level 1 → 0.6, Level 5 → 1.0
   *
   * @param level - Cornering upgrade level (1–5)
   * @returns Corner stat multiplier
   */
  static computeCornerStat(level: number): number {
    // Clamp to 1–5 range to prevent out-of-bounds
    const clamped = Math.max(1, Math.min(5, Math.round(level)));
    return 0.6 + (clamped - 1) * 0.1;
  }

  /**
   * Compute speed modulation factor — simulates downforce effect.
   *
   * Formula: speedMod = lerp(speedModMinFactor, 1.0, clamp(speed / refSpeed, 0, 1))
   *
   * Grip increases linearly with speed up to refSpeed, then plateaus at 1.0.
   *
   * @param speedKmh - Current speed in km/h
   * @param config - Speed modulation configuration
   * @returns Speed modulation factor (speedModMinFactor .. 1.0)
   */
  static computeSpeedMod(speedKmh: number, config: SpeedModConfig): number {
    const t = Math.max(0, Math.min(1, speedKmh / config.speedModRefSpeedKmh));
    // lerp(speedModMinFactor, 1.0, t)
    return config.speedModMinFactor + (1.0 - config.speedModMinFactor) * t;
  }

  /**
   * Compute velocity-dependent steering limit.
   *
   * Formula: steeringLimit = steerMax × clamp(1 − speed / clampSpeed, minRatio, 1.0)
   *
   * At 0 km/h: steeringLimit = steerMax (full lock).
   * At steerClampSpeed: steeringLimit = steerMax × steerMinRatio (minimum).
   * Above clampSpeed: clamped to steerMinRatio × steerMax.
   *
   * @param speedKmh - Current speed in km/h
   * @param steerMax - Maximum steering angle (normalised, typically 1.0)
   * @param steerClampSpeedKmh - Speed (km/h) at which steering is fully clamped
   * @param steerMinRatio - Minimum steering ratio at high speed (0..1)
   * @returns Effective steering limit
   */
  static computeSteeringLimit(
    speedKmh: number,
    steerMax: number,
    steerClampSpeedKmh: number,
    steerMinRatio: number
  ): number {
    const ratio = Math.max(
      steerMinRatio,
      Math.min(1.0, 1 - speedKmh / steerClampSpeedKmh)
    );
    return steerMax * ratio;
  }

  /**
   * Compute target yaw rate from steering input, grip limit, and lift-off state.
   *
   * 1. Compute lateral demand from steering input × steering limit
   * 2. If lift-off oversteer conditions met, add rotation boost
   * 3. Clamp yaw rate to grip limit (understeer enforcement)
   *
   * The understeer clamp ensures: lateralAccel = yawRate × speedMs ≤ gripMax
   *
   * @param steerInput - Steering input (-1 full left to +1 full right)
   * @param steeringLimit - Velocity-dependent steering limit from computeSteeringLimit()
   * @param gripMax - Lateral acceleration limit from computeGripMax()
   * @param speedKmh - Current speed in km/h
   * @param throttle - Throttle input (0..1)
   * @param brake - Brake input (0..1)
   * @param liftOffConfig - Lift-off oversteer configuration
   * @returns Target yaw rate (radians per tick)
   */
  static computeYawRate(
    steerInput: number,
    steeringLimit: number,
    gripMax: number,
    speedKmh: number,
    throttle: number,
    brake: number,
    liftOffConfig: LiftOffConfig
  ): number {
    let lateralDemand = steerInput * steeringLimit;

    // Lift-off oversteer: throttle lifted mid-turn adds rotation
    if (
      throttle < liftOffConfig.throttleMax &&
      brake < liftOffConfig.brakeMax &&
      Math.abs(steerInput) > liftOffConfig.minSteering
    ) {
      lateralDemand += ArcadeGripModel.rotationBoost(lateralDemand, speedKmh);
    }

    // Convert km/h to m/s for grip limit calculation
    const speedMs = speedKmh / 3.6;

    // Max yaw rate from grip envelope: lateralAccel = yawRate × speedMs ≤ gripMax
    // At speedMs = 0, maxYawRate is Infinity (unclamped) — handles zero-speed case
    const maxYawRate = speedMs > 0 ? gripMax / speedMs : Infinity;

    // Understeer clamp: heading cannot exceed physical grip limit
    const yawRate =
      Math.sign(lateralDemand) * Math.min(Math.abs(lateralDemand), maxYawRate);

    return yawRate; // radians per tick
  }

  /**
   * Detect if the car is understeering (lateral demand exceeds grip capacity).
   *
   * @param lateralDemand - Requested lateral acceleration from steering
   * @param gripMax - Maximum available lateral acceleration
   * @param speedMs - Current speed in m/s
   * @returns True if lateral demand exceeds grip limit
   */
  static isUndersteering(
    lateralDemand: number,
    gripMax: number,
    speedMs: number
  ): boolean {
    const demandedLateralAccel = Math.abs(lateralDemand) * speedMs;
    return demandedLateralAccel > gripMax;
  }

  /**
   * Compute lateral acceleration in G from yaw rate and speed.
   *
   * @param yawRate - Current yaw rate (radians per tick)
   * @param speedMs - Current speed in m/s
   * @returns Lateral acceleration in G (1G = 9.81 m/s²)
   */
  static computeLateralG(yawRate: number, speedMs: number): number {
    return (yawRate * speedMs) / 9.81;
  }

  /**
   * Compute tire squeal intensity (0 = silent, 1 = full screech).
   *
   * Maps the ratio of lateral demand vs grip capacity to a 0–1 range:
   * - Below 70% capacity: no squeal (0)
   * - At 70–100% capacity: linear ramp from 0 to 1
   * - At 100%+: full squeal (1)
   *
   * @param lateralDemand - Requested lateral acceleration magnitude
   * @param gripMax - Maximum available lateral acceleration
   * @param speedMs - Current speed in m/s
   * @returns Tire squeal intensity (0–1)
   */
  static computeTireSqueal(
    lateralDemand: number,
    gripMax: number,
    speedMs: number
  ): number {
    const lateralAccel = Math.abs(lateralDemand) * speedMs;
    const ratio = lateralAccel / Math.max(gripMax, 0.01);
    // Below 70% capacity: no squeal. At 70–100%: ramp. Above 100%: full.
    return Math.max(0, Math.min(1, (ratio - 0.7) / 0.3));
  }

  /**
   * Compute lift-off oversteer rotation boost.
   *
   * When the throttle is lifted mid-turn, weight transfers to the front
   * tires, reducing rear grip and creating a rotation moment proportional
   * to steering demand and speed.
   *
   * @param lateralDemand - Current lateral demand from steering
   * @param speedKmh - Current speed in km/h
   * @returns Rotation boost value (added to lateral demand)
   */
  static rotationBoost(lateralDemand: number, speedKmh: number): number {
    // Signed: preserves steer direction for left/right symmetry.
    // Positive steer → positive boost, negative steer → negative boost.
    const speedWeight = Math.min(speedKmh / 200, 1.0);
    return lateralDemand * speedWeight;
  }

  /**
   * Document the no-drift invariant.
   *
   * At high speed + high steer input, the understeer clamp ensures
   * front-grip-loss behavior. The car pushes wide rather than entering
   * a sustained drift. No additional drift model exists.
   *
   * If yawRate × speedMs < gripMax: car turns as requested (within envelope).
   * If yawRate × speedMs ≥ gripMax: car understeers (pushes wide).
   *
   * @param _yawRate - Current yaw rate (unused — documentation only)
   * @param _speedMs - Current speed in m/s (unused — documentation only)
   * @param _steerInput - Steering input (unused — documentation only)
   */
  static noDriftEnforcement(
    _yawRate: number,
    _speedMs: number,
    _steerInput: number
  ): void {
    // No-drift invariant is enforced by the understeer clamp in computeYawRate().
    // This function documents the behavior; no additional enforcement needed.
  }

  // ─── Engine Model (Story 003) ─────────────────────────────────────────────

  /**
   * Compute engine RPM from forward speed and current gear.
   *
   * Formula: RPM = (speedMs / gearRatio(gear)) × (rpmMax / refSpeed), where
   * refSpeed is the speed at which rpmMax is reached in the lowest gear.
   * For neutral (gear 0) or reverse (gear -1), returns idle RPM.
   * For gear > GEAR_COUNT, uses the top gear ratio.
   *
   * @param speedMs - Current forward speed in m/s
   * @param gear - Current gear (0 = neutral, 1–6 = forward)
   * @param gearRatios - 6-element array of gear ratios (G1 = shortest)
   * @param rpmMax - Maximum engine RPM
   * @returns Computed RPM (clamped to 0..rpmMax × 1.05)
   *
   * @see TR-PHYSICS-010 — Engine model specification
   */
  static computeRpm(
    speedMs: number,
    gear: number,
    gearRatios: number[],
    rpmMax: number,
    gear1RedlineSpeed: number
  ): number {
    // Neutral or reverse: return 40% of rpmMax (ticking idle)
    if (gear < 1) {
      return rpmMax * 0.4;
    }

    // Forward gear at zero speed: return idle RPM (car can accelerate from standstill)
    if (speedMs === 0) {
      return rpmMax * 0.4;
    }

    const idx = Math.min(gear, GEAR_COUNT) - 1;
    const ratio = gearRatios[idx] ?? 1;

    // RPM = speed × gearRatio × (rpmMax / (gear1RedlineSpeed × gear1Ratio))
    // For a typical car: redline in 1st gear at ~10 m/s.
    const RPM_PER_UNIT = gearRatios[0] * gear1RedlineSpeed;
    const rpm = (speedMs * ratio * rpmMax) / RPM_PER_UNIT;

    // Clamp with 5% over-rev buffer
    return Math.max(0, Math.min(rpm, rpmMax * 1.05));
  }

  /**
   * Compute engine torque from RPM and acceleration level.
   *
   * Torque follows a linear ramp from 0 at RPM=0 to
   * rpmMax × ACCEL_MAP[accelLevel-1] at RPM=rpmMax.
   *
   * @param rpm - Current engine RPM
   * @param accelLevel - Acceleration level (1–5)
   * @param rpmMax - Maximum engine RPM
   * @returns Torque value (arbitrary units, scaled by powerCeiling later)
   */
  static computeTorque(
    rpm: number,
    accelLevel: number,
    rpmMax: number
  ): number {
    const clampedLevel = Math.max(1, Math.min(5, Math.round(accelLevel)));
    const multiplier = ACCEL_MAP[clampedLevel - 1];
    const t = rpm / Math.max(rpmMax, 1);
    return t * multiplier;
  }

  /**
   * Aerodynamic drag force opposing forward velocity.
   *
   * Formula: dragForce = -dragCoeff × speedMs² × sign(speedMs)
   *
   * Drag always opposes motion (direction of velocity).
   *
   * @param speedMs - Current forward speed in m/s
   * @param dragCoeff - Aerodynamic drag coefficient
   * @returns Drag force in the direction opposite to velocity (always ≤ 0)
   */
  static computeDragForce(speedMs: number, dragCoeff: number): number {
    if (speedMs === 0) {
      return 0;
    }
    return -dragCoeff * speedMs * speedMs * Math.sign(speedMs);
  }

  /**
   * Braking force opposing forward velocity.
   *
   * Formula: brakeForce = brakeInput × maxBrakeForce
   *
   * @param brakeInput - Brake input (0 to 1)
   * @param maxBrakeForce - Maximum braking force
   * @returns Braking force magnitude (always ≥ 0)
   */
  static computeBrakeForce(brakeInput: number, maxBrakeForce: number): number {
    return brakeInput * maxBrakeForce;
  }

  /**
   * Gravity component along a slope (gradient force).
   *
   * Formula: gradientForce = -9.81 × mass × gradient
   *   where gradient = sin(slopeAngle), positive uphill
   *
   * A positive gradient (uphill) produces a negative force (slows down).
   * A negative gradient (downhill) produces a positive force (speeds up).
   *
   * @param gradient - Track gradient (sin of slope angle, positive uphill)
   * @param mass - Car mass in kg
   * @returns Gradient force in Newtons (positive = acceleration)
   */
  static computeGradientForce(gradient: number, mass: number): number {
    if (gradient === 0) {
      return 0;
    }
    return -9.81 * mass * gradient;
  }

  /**
   * Manual gear shift with reverse gate protection.
   *
   * Rules:
   * - gearDelta +1 upshifts (gear +1, capped at GEAR_COUNT)
   * - gearDelta -1 downshifts (gear -1, capped at 1 for forward gears)
   * - From reverse (-1): downshift from reverse needs near-zero speed or brake
   * - From neutral (0): any input shifts to 1 (forward) or -1 (reverse)
   *
   * @param currentGear - Current gear (-1 = reverse, 0 = neutral, 1–6 = forward)
   * @param delta - Gear change delta (-1, 0, or +1)
   * @param brake - Current brake input (0..1)
   * @param speedMs - Current speed in m/s
   * @param config - Engine configuration (stopEpsilon, gearRatios)
   * @returns New gear
   */
  static applyGearDelta(
    currentGear: number,
    delta: -1 | 0 | 1,
    brake: number,
    speedMs: number,
    config: EngineConfigSub
  ): number {
    if (delta === 0) {
      return currentGear;
    }

    // Reverse gate: to leave reverse, must be near stop or braking
    if (currentGear === -1) {
      return delta > 0 && (speedMs < config.stopEpsilon || brake > 0) ? 0 : -1;
    }

    // Neutral handling: delta +1 → first gear, delta -1 → reverse
    if (currentGear === 0) {
      return delta > 0 ? 1 : -1;
    }

    // Forward gears: apply delta with clamping
    const newGear = currentGear + delta;
    return Math.max(1, Math.min(GEAR_COUNT, newGear));
  }

  /**
   * Automatic upshift/downshift based on RPM thresholds.
   *
   * Upshifts when RPM > rpmMax × threshold
   * Downshifts when RPM < rpmMax × threshold × 0.5 (half-threshold hysteresis)
   *
   * @param rpm - Current engine RPM
   * @param currentGear - Current gear (should be 1–6 for auto-shift)
   * @param rpmMax - Maximum engine RPM
   * @param threshold - Upshift threshold fraction of rpmMax (e.g. 0.8)
   * @returns Gear after auto-shift
   */
  static autoShift(
    rpm: number,
    currentGear: number,
    rpmMax: number,
    threshold: number,
    downshiftRatio: number = 0.5
  ): number {
    // Auto-shift only applies to forward gears
    if (currentGear < 1 || currentGear >= GEAR_COUNT) {
      return currentGear;
    }

    const upshiftThreshold = rpmMax * threshold;
    const downshiftThreshold = upshiftThreshold * downshiftRatio;

    if (rpm > upshiftThreshold) {
      return currentGear + 1;
    }
    if (rpm < downshiftThreshold && currentGear > 1) {
      return currentGear - 1;
    }
    return currentGear;
  }

  /**
   * Compute coast deceleration (throttle = 0, brake = 0) from drag.
   *
   * Formula: coastDecel = (dragCoeff × speedMs²) / mass
   *
   * Used to model natural deceleration when no throttle or brake is applied.
   * Only represents drag — does not include rolling resistance or drivetrain loss.
   *
   * @param speedMs - Current forward speed in m/s
   * @param dragCoeff - Aerodynamic drag coefficient
   * @param mass - Car mass in kg
   * @returns Coast deceleration magnitude in m/s² (always ≥ 0)
   */
  static computeCoastDeceleration(
    speedMs: number,
    dragCoeff: number,
    mass: number
  ): number {
    return (dragCoeff * speedMs * speedMs) / Math.max(mass, 1);
  }

  /**
   * Full engine model: computes target speed from power, drag, brake, and gradient.
   *
   * Orchestrates the following steps:
   * 1. Apply manual gear delta (gearDelta) with reverse gate protection
   * 2. Compute RPM from speed and gear
   * 3. If no manual gear delta, run auto-shift
   * 4. Compute torque from RPM and accel level
   * 5. Compute power = torque × throttle × fuelMult × powerCeiling
   * 6. Compute net force: power + drag + gradient
   * 7. If braking: replace net force with brake + drag
   * 8. Integrate: newSpeed = max(0, speedMs + (netForce / mass) × dt)
   *
   * Mutates engineState.gear and engineState.rpm to reflect any shifts.
   *
   * @param engineState - Mutable engine state snapshot (speedMs, gear, rpm, etc.)
   * @param inputs - Throttle, brake, and gear delta inputs
   * @param dt - Delta time in seconds
   * @param config - Engine configuration (gear ratios, RPM limits, etc.)
   * @returns New target speed in m/s
   *
   * @see TR-PHYSICS-010 — Engine model specification
   */
  static computeTargetSpeed(
    engineState: EngineStateSnapshot,
    inputs: EngineInputs,
    dt: number,
    config: EngineConfigSub
  ): number {
    // Step 1: Apply manual gear delta
    engineState.gear = ArcadeGripModel.applyGearDelta(
      engineState.gear,
      inputs.gearDelta,
      inputs.brake,
      engineState.speedMs,
      config
    );

    // Step 2: Compute RPM from speed and gear
    engineState.rpm = ArcadeGripModel.computeRpm(
      engineState.speedMs,
      engineState.gear,
      config.gearRatios,
      config.rpmMax,
      config.gear1RedlineSpeed
    );

    // Step 3: Auto-shift if no manual gear delta
    if (inputs.gearDelta === 0) {
      engineState.gear = ArcadeGripModel.autoShift(
        engineState.rpm,
        engineState.gear,
        config.rpmMax,
        config.autoShiftRpmThreshold,
        config.downshiftRpmRatio
      );
      engineState.rpm = ArcadeGripModel.computeRpm(
        engineState.speedMs,
        engineState.gear,
        config.gearRatios,
        config.rpmMax,
        config.gear1RedlineSpeed
      );
    }

    // Step 4: Compute torque and power
    const torque = ArcadeGripModel.computeTorque(
      engineState.rpm,
      config.accelLevel,
      config.rpmMax
    );
    let power =
      torque * inputs.throttle * engineState.fuelMult * config.powerCeiling;

    // Reverse gear: engine produces negative force (moves backward)
    if (engineState.gear === -1) {
      power = -power;
    }

    // Step 5 & 6: Build net force from power + drag + gradient
    let netForce = power;

    // Drag always opposes motion
    netForce += ArcadeGripModel.computeDragForce(
      engineState.speedMs,
      config.dragCoeff
    );

    // Step 7: Brake override — braking replaces throttle power entirely
    if (inputs.brake > 0) {
      const drag = ArcadeGripModel.computeDragForce(
        engineState.speedMs,
        config.dragCoeff
      );
      netForce =
        -ArcadeGripModel.computeBrakeForce(inputs.brake, config.maxBrakeForce) +
        drag;
    }

    // Gradient force (gravity component along slope)
    netForce += ArcadeGripModel.computeGradientForce(
      engineState.gradient,
      engineState.mass
    );

    // Step 8: Integrate — new speed = speed + (netForce / mass) × dt
    // Allow negative speed for reverse gear, clamp to reverseMaxSpeed
    const minSpeed = engineState.gear === -1 ? -config.reverseMaxSpeed : 0;
    const newSpeedMs = Math.max(
      minSpeed,
      engineState.speedMs + (netForce / engineState.mass) * dt
    );

    return newSpeedMs;
  }

  // ─── Instance Method ─────────────────────────────────────────────────────

  /**
   * Compute Phase 1 values (target speed and yaw) for one car.
   *
   * Matches the Phase1Stub interface for PhysicsService compatibility.
   * Sets targetSpeed (placeholder until Story 003), targetYawRate, and
   * telemetry fields (lateralG, tireSqueal, gripMultiplier).
   *
   * @param state - Per-car physics state (mutated in place)
   * @param input - InputState for this tick
   * @param _dt - Delta time in seconds (unused in Phase 1 model)
   * @param config - Physics configuration (all tuning values)
   */
  compute(
    state: CarPhysicsState,
    input: InputState,
    _dt: number,
    config: PhysicsConfig
  ): void {
    const speedKmh = state.speedKmh || 0;
    const oldSpeedMs = speedKmh / 3.6;

    // Cornering level defaults to 1 until per-car stat integration
    const corneringLevel = 1;

    // Convert config values from m/s to km/h for the pure math functions
    const steerClampSpeedKmh = config.steerClampSpeed * 3.6;
    const speedModRefSpeedKmh = config.speedModRefSpeed * 3.6;

    // Update cached config sub-interfaces (avoids per-tick allocation)
    this._gripConfig = {
      speedModRefSpeedKmh,
      speedModMinFactor: config.speedModMinFactor,
      minGripFactor: config.minGripFactor,
    };

    this._liftOffConfig = {
      throttleMax: config.liftOffThrottleMax,
      minSteering: config.liftOffMinSteering,
      brakeMax: config.liftOffBrakeMax,
    };

    // Compute grip max
    const gripMax = ArcadeGripModel.computeGripMax(
      config.baseGrip,
      corneringLevel,
      state.tireCondition,
      speedKmh,
      this._gripConfig
    );

    // Compute steering limit
    const steerMax = 1.0; // Normalised input range
    const steeringLimit = ArcadeGripModel.computeSteeringLimit(
      speedKmh,
      steerMax,
      steerClampSpeedKmh,
      config.steerMinRatio
    );

    // Compute yaw rate with grip envelope and lift-off oversteer
    const yawRate = ArcadeGripModel.computeYawRate(
      input.steer,
      steeringLimit,
      gripMax,
      speedKmh,
      input.throttle,
      input.brake,
      this._liftOffConfig
    );

    // ── Engine Model (Story 003) ─────────────────────────────────────

    // Build engine state snapshot for computeTargetSpeed
    const engineState: EngineStateSnapshot = {
      speedMs: speedKmh / 3.6,
      gear: state.gear,
      rpm: state.rpm,
      fuelMult: state.fuelMult,
      gradient: state.gradient,
      mass: config.mass,
    };

    const engineInputs: EngineInputs = {
      throttle: input.throttle,
      brake: input.brake,
      gearDelta: input.gearDelta,
    };

    const engineConfig: EngineConfigSub = {
      gearRatios: config.gearRatios,
      rpmMax: config.rpmMax,
      accelLevel: config.accelLevel,
      powerCeiling: config.powerCeiling,
      dragCoeff: config.dragCoeff,
      maxBrakeForce: config.maxBrakeForce,
      stopEpsilon: config.stopEpsilon,
      autoShiftRpmThreshold: config.autoShiftRpmThreshold,
      downshiftRpmRatio: config.downshiftRpmRatio,
      reverseMaxSpeed: config.reverseMaxSpeed,
      gear1RedlineSpeed: config.gear1RedlineSpeed,
      mass: config.mass,
    };

    const targetSpeed = ArcadeGripModel.computeTargetSpeed(
      engineState,
      engineInputs,
      _dt,
      engineConfig
    );

    state.targetSpeed = targetSpeed;
    state.gear = engineState.gear;
    state.rpm = engineState.rpm;

    // Update speedKmh for the next tick
    state.speedKmh = state.targetSpeed * 3.6;

    // ── Write State ──────────────────────────────────────────────────

    state.targetYawRate = yawRate;

    // ── Telemetry ────────────────────────────────────────────────────

    this._computeTelemetry(
      state,
      input,
      yawRate,
      steeringLimit,
      gripMax,
      config,
      oldSpeedMs
    );
  }

  /**
   * Compute telemetry fields for one car.
   *
   * Extracted from compute() for method length compliance.
   * Sets lateralG, accelG, tireSqueal, gripMultiplier, rpm, gear.
   *
   * @param state - Per-car physics state (mutated in place)
   * @param input - InputState for this tick
   * @param yawRate - Computed yaw rate from Phase 1
   * @param steeringLimit - Velocity-dependent steering limit
   * @param gripMax - Maximum lateral acceleration
   * @param config - Physics configuration
   * @param oldSpeedMs - Previous tick speed in m/s (for accelG computation)
   */
  private _computeTelemetry(
    state: CarPhysicsState,
    input: InputState,
    yawRate: number,
    steeringLimit: number,
    gripMax: number,
    config: PhysicsConfig,
    oldSpeedMs: number
  ): void {
    const speedMs = state.speedKmh / 3.6;

    state.lateralG = ArcadeGripModel.computeLateralG(yawRate, speedMs);
    state.tireSqueal = ArcadeGripModel.computeTireSqueal(
      input.steer * steeringLimit,
      gripMax,
      speedMs
    );
    state.gripMultiplier = gripMax / Math.max(config.baseGrip, 0.01);

    // Longitudinal acceleration in G (positive = accelerating, negative = braking)
    const accelMs2 = (speedMs - oldSpeedMs) * 60; // ×60 for dt=1/60s
    state.accelG = accelMs2 / 9.81;

    // RPM and gear are now set by the engine model in compute()
    // _computeTelemetry reads state.rpm and state.gear post-computation.
  }
}
