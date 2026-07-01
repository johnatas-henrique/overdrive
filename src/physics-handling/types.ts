/**
 * @fileoverview Physics system type definitions for Overdrive.
 *
 * Core types shared across all physics stories:
 * - CarPhysicsState: per-car mutable tick-level state
 * - IPhysics: physics subsystem interface (pipeline slot #2)
 * - CarTelemetry: read-only telemetry snapshot for external consumers
 * - ITrackSystem: track spline query interface (elevation + tangent)
 * - PhysicsConfig: all tuning knobs for the arcade model
 *
 * @see ADR-0008 — Vehicle Physics — Arcade Dynamic
 * @see Story 001 — Physics Core Skeleton
 */

import type { Vector3 } from "@babylonjs/core/Maths/math";
import type { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";

// ---------------------------------------------------------------------------
// Gear type
// ---------------------------------------------------------------------------

/** Transmission gear: -1 (reverse), 0 (neutral), 1–6 (forward). */
export type Gear = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ---------------------------------------------------------------------------
// CarPhysicsState
// ---------------------------------------------------------------------------

/**
 * Create a default CarPhysicsState with all fields initialised.
 *
 * Shared factory function used by PhysicsService.registerCar() and
 * test helpers — prevents field drift when CarPhysicsState is extended.
 *
 * @param carId - Unique car identifier
 * @param body - Havok PhysicsBody for the car
 * @param topSpeedMs - Car's top speed in m/s (used for off-track min speed floor).
 *                     Defaults to 50 when config is not yet available.
 * @returns A fully initialised CarPhysicsState
 *
 * @see FR-006 — Factory extraction for DRY default state
 */
export function createDefaultCarPhysicsState(
  carId: string,
  body: PhysicsBody | null,
  topSpeedMs: number = 50
): CarPhysicsState {
  return {
    carId,
    body,
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
    frictionMultiplier: 1,
    minSurfaceSpeed: 0,
    gripMultiplier: 1,
    fuelMult: 1,
    tireCondition: 1,
    pitEntrySpeed: null,
    gradient: 0,
    topSpeedMs,
    tireBlownEmitted: false,
    fuelEmptyEmitted: false,
    wasAboveStopEpsilon: false,
  };
}

/**
 * Per-car physics state for one simulation tick.
 *
 * Instances are created on entity.spawned (Story 001 defines the structure;
 * lifecycle hooks are a cross-epic dependency with ADR-0005).
 * Destroyed on entity.despawned.
 *
 * All mutable fields are public — the state is owned and mutated
 * exclusively by PhysicsService during pipeline slot #2 execution.
 *
 * @see ADR-0008 — Arcade Model (Phase 1) and Velocity Override (Phase 3)
 * @see C21 — 1 DYNAMIC body per car
 */
export interface CarPhysicsState {
  /** Stable car identifier matching CarEntity.id. */
  readonly carId: string;

  /**
   * Reference to the Havok PhysicsBody from CarEntity.physicsAggregate.body.
   * Null until the car entity has been spawned and the body is available.
   */
  body: PhysicsBody | null;

  // ─── Phase 1 Output (cached for Phase 3) ────────────────────────────

  /** Target forward speed in m/s — computed by Phase 1 arcade model. */
  targetSpeed: number;

  /** Target yaw rate in radians/tick — computed by Phase 1. */
  targetYawRate: number;

  // ─── Spline & Velocity ──────────────────────────────────────────────

  /** Current position along the track spline (0..trackLength). */
  splinePosition: number;

  /** Current speed in km/h (converted from body velocity each tick). */
  speedKmh: number;

  // ─── Engine & Gearbox ───────────────────────────────────────────────

  /** Current engine RPM. */
  rpm: number;

  /** Current gear: -1 (reverse), 0 (neutral), or 1–6. */
  gear: Gear;

  // ─── Telemetry (published each tick) ────────────────────────────────

  /** Lateral acceleration in G. */
  lateralG: number;

  /** Longitudinal acceleration in G. */
  accelG: number;

  /** Tire squeal intensity (0 = silent, 1 = full screech). */
  tireSqueal: number;

  /** True if any wheel is on a kerb this tick. */
  kerbHit: boolean;

  /** True if car is fully off the track surface. */
  offTrack: boolean;

  /**
   * Friction multiplier from surface (1.0 = tarmac, >1 = off-track).
   * Applied to dragCoeff in the engine model to increase drag on
   * off-track surfaces (grass/gravel).
   *
   * @see STORY-004 — AC-2: Off-track 6× friction
   */
  frictionMultiplier: number;

  /**
   * Minimum speed floor for current surface in m/s.
   * 0 = no floor (tarmac/kerb). >0 = car cannot slow below this on
   * off-track surfaces (grass/gravel).
   *
   * Formula: minSurfaceSpeed = topSpeed × minSpeedFraction
   *
   * @see STORY-004 — AC-3: Off-track minimum speed
   */
  minSurfaceSpeed: number;

  /** Current effective grip multiplier (gripMax / baseGrip). */
  gripMultiplier: number;

  // ─── Track Data ──────────────────────────────────────────────────

  /** Track gradient at car's spline position (sin of slope angle). Positive = uphill. */
  gradient: number;

  /**
   * Car's top speed in m/s — used for off-track minimum speed floor.
   *
   * Initialized from PhysicsConfig.topSpeedL1toL5[defaultLevel] when the
   * car state is created. Will be replaced by per-car stat lookup when
   * car stats integration lands (Story 005b+).
   *
   * @see TD-PHYS-001 — per-car topSpeed integration
   */
  topSpeedMs: number;

  // ─── External Inputs (1-tick delay per ADR-0008) ──────────────────

  /** Fuel multiplier from Fuel system (0..1). Default 1.0. */
  fuelMult: number;

  /** Tire condition from Tire Wear system (0..1). Default 1.0. */
  tireCondition: number;

  // ─── Pit Limiter State ────────────────────────────────────────────

  /**
   * Speed at pit mode entry (m/s). Used to compute constant-rate linear
   * deceleration toward pitSpeedLimit. Set when setPit(true) is called,
   * cleared when setPit(false).
   *
   * @see AC-2 — Pit limiter linear ramp acceptance criteria
   */
  pitEntrySpeed: number | null;

  // ─── Edge-Event Guards ──────────────────────────────────────────────

  /** Guard — `car.tire_blown` already emitted for this car. */
  tireBlownEmitted: boolean;

  /** Guard — `car.fuel_empty` already emitted for this car. */
  fuelEmptyEmitted: boolean;

  /** Guard — was above stopEpsilon on the previous tick. */
  wasAboveStopEpsilon: boolean;
}

// ---------------------------------------------------------------------------
// CarTelemetry
// ---------------------------------------------------------------------------

/**
 * Telemetry snapshot for one car, published each physics tick.
 *
 * Read by Camera (FOV, shake), Audio (engine pitch, tire squeal),
 * and HUD (speed, rpm, gear displays).
 *
 * @example
 * ```typescript
 * const telemetry = physics.getTelemetry("car_01");
 * if (telemetry) {
 *   hud.setSpeed(telemetry.speedKmh);
 *   hud.setGear(telemetry.gear);
 * }
 * ```
 */
export interface CarTelemetry {
  /** Speed in km/h — converted from internal m/s each tick. */
  readonly speedKmh: number;
  /** Engine RPM. */
  readonly rpm: number;
  /** Current gear: -1 (reverse), 0 (neutral), or 1–6. */
  readonly gear: Gear;
  /** Lateral acceleration in G. */
  readonly lateralG: number;
  /** Longitudinal acceleration in G. */
  readonly accelG: number;
  /** Tire squeal intensity (0 = silent, 1 = full screech). */
  readonly tireSqueal: number;
  /** True if any wheel is on a kerb this tick. */
  readonly kerbHit: boolean;
  /** True if car is fully off the track surface. */
  readonly offTrack: boolean;
}

// ---------------------------------------------------------------------------
// IPhysics
// ---------------------------------------------------------------------------

/**
 * Physics subsystem interface.
 *
 * All simulation state is internal — external systems query via
 * getTelemetry() and getSplinePosition(). Control signals arrive
 * via setLocked(), setPit(), onFuelUpdate(), and onTireUpdate().
 *
 * @see ADR-0008 — Vehicle Physics — Arcade Dynamic
 * @see C21 — 1 DYNAMIC body per car
 * @see C22 — 3-phase execution within pipeline slot #2
 *
 * @example
 * ```typescript
 * const physics = new PhysicsService(scene, trackSystem);
 * await physics.init(config);
 * physics.setSurfaceProvider((pos) => trackSystem.getSurfaceAt(pos));
 * pipeline.register("physics", (dt) => physics.update(dt), 2);
 * ```
 */
export interface IPhysics {
  /**
   * Initialize the physics subsystem.
   *
   * Creates the Havok plugin, enables physics on the scene, suppresses
   * auto-stepping, and allocates internal state maps. Must be called
   * once before any update() call.
   *
   * @param config - Physics configuration (all tuning values)
   */
  init(config: PhysicsConfig): Promise<void>;

  /**
   * Execute one physics tick (3-phase pipeline).
   *
   * Called by FixedUpdatePipeline slot #2 exactly once per fixed tick.
   *
   * @param dt - Delta time in seconds (typically 1/60)
   */
  update(dt: number): void;

  /**
   * Register a car with the physics service.
   *
   * Creates internal state for the car so it participates in the physics
   * pipeline on subsequent update() ticks.
   *
   * @param carId - Unique car identifier
   * @param body - Havok PhysicsBody for the car
   * @param initialState - Optional partial state overrides for initial setup
   *
   * @throws {Error} When carId is already registered
   */
  registerCar(
    carId: string,
    body: PhysicsBody,
    initialState?: Partial<CarPhysicsState>
  ): void;

  /**
   * Remove a car and all associated state from the physics service.
   *
   * Cleans up surface state, input state, telemetry, pit mode, and lock
   * state for the given carId.
   *
   * @param carId - Unique car identifier
   */
  removeCar(carId: string): void;

  /**
   * Lock or unlock a car for grid start or pit stop.
   *
   * Locked cars skip Phase 1 arcade model and receive zero velocity
   * in Phase 3.
   *
   * @param carId - Unique car identifier
   * @param locked - True to lock, false to unlock
   */
  setLocked(carId: string, locked: boolean): void;

  /**
   * Enable or disable pit lane speed limiting for a car.
   *
   * Pit-enabled cars have their target speed clamped to
   * pitSpeedLimit with smooth deceleration.
   *
   * @param carId - Unique car identifier
   * @param enabled - True to enable pit mode, false to disable
   */
  setPit(carId: string, enabled: boolean): void;

  /**
   * Get the latest telemetry for a car.
   *
   * @param carId - Unique car identifier
   * @returns CarTelemetry snapshot, or undefined if carId is unknown
   */
  getTelemetry(carId: string): CarTelemetry | undefined;

  /**
   * Get the car's current spline position.
   *
   * Written by Physics slot #2 every tick. Read by Race Management
   * slot #7 for lap detection and position sorting.
   *
   * @param carId - Unique car identifier
   * @returns Spline position in the range [0, trackLength)
   */
  getSplinePosition(carId: string): number;

  /**
   * Prepare for race start.
   *
   * Called when the race green flag is shown. Resets per-car
   * integration state that should not carry across race sessions.
   */
  onRaceGreenFlag(): void;

  /**
   * Receive a fuel multiplier update from the Fuel system.
   *
   * Stored with 1-tick delay — applied on the next tick after receipt.
   *
   * @param carId - Unique car identifier
   * @param fuelMult - Fuel multiplier (0 = empty, 1 = full)
   */
  onFuelUpdate(carId: string, fuelMult: number): void;

  /**
   * Receive a tire condition update from the Tire Wear system.
   *
   * Stored with 1-tick delay — applied on the next tick after receipt.
   *
   * @param carId - Unique car identifier
   * @param tireCondition - Tire condition (0 = worn, 1 = new)
   */
  onTireUpdate(carId: string, tireCondition: number): void;

  /**
   * Dispose all physics resources.
   *
   * Disposes the Havok plugin, clears all state maps, and removes
   * all physics bodies from the scene. Safe to call multiple times.
   */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// ITrackSystem
// ---------------------------------------------------------------------------

/**
 * Minimal track spline query interface.
 *
 * Provides elevation and tangent queries needed by Physics Phase 3
 * ground tracking and heading derivation. Implemented by the Track
 * system (ADR-0025).
 *
 * @see ADR-0008 — Ground Tracking section
 */
export interface ITrackSystem {
  /**
   * Get the spline elevation (Y in physics world) at a position.
   *
   * @param splinePosition - Position along the track spline (0..trackLength)
   * @returns Elevation at that position in world units
   */
  getElevation(splinePosition: number): number;

  /**
   * Get the forward direction tangent at a spline position.
   *
   * Used by Phase 3 velocity override to derive the car's heading
   * from the track spline (not the car mesh). The returned vector
   * must be normalized.
   *
   * @param splinePosition - Position along the track spline (0..trackLength)
   * @returns Normalized forward direction Vector3
   */
  getTangent(splinePosition: number): Vector3;
}

// ---------------------------------------------------------------------------
// PhysicsConfig
// ---------------------------------------------------------------------------

/**
 * Physics configuration — all tuning knobs for the arcade model.
 *
 * Loaded from ConfigManager (physics.* namespace) at init time.
 * All values are data-driven — never hardcoded in gameplay code.
 *
 * @see ADR-0008 — PhysicsConfig interface definition
 * @see C-F3 (technical-preferences.md) — Hardcoded gameplay values forbidden
 */
export interface PhysicsConfig {
  // ─── Grip ──────────────────────────────────────────────────────────

  /** Base grip coefficient — primary feel knob. */
  readonly baseGrip: number;

  // ─── Physics Constants ─────────────────────────────────────────────

  /** Gravity acceleration in m/s² (positive = downward). */
  readonly gravity: number;

  // ─── Steering ──────────────────────────────────────────────────────

  /** Speed (m/s) at which steering is fully clamped to steerMinRatio. */
  readonly steerClampSpeed: number;
  /** Minimum steering ratio at high speed (0..1). */
  readonly steerMinRatio: number;

  // ─── Lift-Off Oversteer ────────────────────────────────────────────

  /** Minimum steering input magnitude to trigger lift-off oversteer. */
  readonly liftOffMinSteering: number;
  /** Throttle threshold below which lift-off oversteer activates. */
  readonly liftOffThrottleMax: number;
  /** Brake threshold below which lift-off oversteer activates. */
  readonly liftOffBrakeMax: number;

  // ─── Lift-Off Oversteer Speed ─────────────────────────────────────────

  /** Reference speed (km/h) for rotation boost normalization. Default: 200. */
  readonly liftOffRefSpeedKmh: number;

  // ─── Drag & Braking ────────────────────────────────────────────────

  /** Aerodynamic drag coefficient (applied as deceleration opposing velocity). */
  readonly dragCoeff: number;
  /** Maximum braking force (deceleration per tick). */
  readonly maxBrakeForce: number;

  // ─── Pit Limiter ───────────────────────────────────────────────────

  /** Maximum speed in pit lane (m/s). */
  readonly pitSpeedLimit: number;

  /**
   * Time in seconds to transition from current speed to pitSpeedLimit.
   * Used by the linear ramp in applyPitLimiter().
   * Default: 2.0s — car decelerates smoothly from 250 km/h to 80 km/h.
   */
  readonly pitSpeedTransitionTime: number;

  // ─── Off-Track ─────────────────────────────────────────────────────

  /** Friction multiplier when off-track. */
  readonly offTrackFriction: number;
  /** Grip multiplier when off-track (0..1). */
  readonly offTrackGripFactor: number;
  /** Minimum speed fraction of topSpeed when off-track (0..1, e.g. 0.3 = 30%). */
  readonly offTrackMinSpeedFraction: number;

  // ─── Kerb ──────────────────────────────────────────────────────────

  /** Grip loss factor when on a kerb (0..1, lower = more loss). */
  readonly kerbGripLoss: number;

  // ─── Speed Modulation ──────────────────────────────────────────────

  /** Reference speed for speed-dependent grip modulation (m/s). */
  readonly speedModRefSpeed: number;
  /** Minimum grip factor at zero speed (speedMod saturates here). */
  readonly speedModMinFactor: number;

  // ─── Gearbox ───────────────────────────────────────────────────────

  /** Fraction of rpmMax for upshift threshold (0..1, e.g. 0.8 = 80% of rpmMax). */
  readonly autoShiftRpmThreshold: number;
  /** Maximum engine RPM. */
  readonly rpmMax: number;
  /** 6 forward gear ratios (G1 through G6). */
  readonly gearRatios: [number, number, number, number, number, number];
  /** Acceleration level (1–5) for torque curve multiplier. */
  readonly accelLevel: 1 | 2 | 3 | 4 | 5;
  /** RPM ratio for downshift threshold (fraction of upshift threshold). */
  readonly downshiftRpmRatio: number;
  /** Maximum reverse speed (m/s). */
  readonly reverseMaxSpeed: number;
  /** Speed (m/s) at which 1st gear reaches rpmMax — determines RPM scaling. */
  readonly gear1RedlineSpeed: number;

  // ─── Engine Power ──────────────────────────────────────────────────

  /** Maximum power output multiplier. */
  readonly powerCeiling: number;
  /** Car mass in kg (used for gradient force and coast deceleration). */
  readonly mass: number;

  // ─── Misc ──────────────────────────────────────────────────────────

  /** Minimum effective grip factor (floor, prevents zero-grip ice). */
  readonly minGripFactor: number;
  /** Speed below which the car is considered stopped (m/s). */
  readonly stopEpsilon: number;
  /** Half-width of the car chassis (used for track boundary checks). */
  readonly carHalfWidth: number;

  // ─── Per-Level Stats ───────────────────────────────────────────────

  /** Top speed (m/s) per level 1–5. */
  readonly topSpeedL1toL5: [number, number, number, number, number];
  /** Acceleration factor per level 1–5. */
  readonly accelerationL1toL5: [number, number, number, number, number];
  /** Cornering stat per level 1–5 (feeds cornerStat formula). */
  readonly corneringL1toL5: [number, number, number, number, number];
}
