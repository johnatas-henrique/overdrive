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

    // ── Write State ──────────────────────────────────────────────────

    // Placeholder targetSpeed until Story 003 (engine/gears/drag)
    state.targetSpeed = 5;
    state.targetYawRate = yawRate;

    // Update speedKmh for the next tick (from the placeholder target)
    state.speedKmh = state.targetSpeed * 3.6;

    // ── Telemetry ────────────────────────────────────────────────────

    this._computeTelemetry(
      state,
      input,
      yawRate,
      steeringLimit,
      gripMax,
      config
    );
  }

  /**
   * Compute telemetry fields for one car.
   *
   * Extracted from compute() for method length compliance.
   * Sets lateralG, tireSqueal, gripMultiplier, rpm, gear.
   *
   * @param state - Per-car physics state (mutated in place)
   * @param input - InputState for this tick
   * @param yawRate - Computed yaw rate from Phase 1
   * @param steeringLimit - Velocity-dependent steering limit
   * @param gripMax - Maximum lateral acceleration
   * @param config - Physics configuration
   */
  private _computeTelemetry(
    state: CarPhysicsState,
    input: InputState,
    yawRate: number,
    steeringLimit: number,
    gripMax: number,
    config: PhysicsConfig
  ): void {
    const speedMs = state.speedKmh / 3.6;

    state.lateralG = ArcadeGripModel.computeLateralG(yawRate, speedMs);
    state.tireSqueal = ArcadeGripModel.computeTireSqueal(
      input.steer * steeringLimit,
      gripMax,
      speedMs
    );
    state.gripMultiplier = gripMax / Math.max(config.baseGrip, 0.01);

    // RPM and gear remain placeholder until Story 003 (Engine/Gears)
    state.rpm = 3000;
    state.gear = 1;
  }
}
