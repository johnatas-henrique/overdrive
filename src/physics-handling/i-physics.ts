/**
 * Physics subsystem interface for the Arcade Dynamic vehicle model.
 *
 * Defines the contract for the physics pipeline slot #2, which executes
 * three phases per tick: arcade model computation (Phase 1), Havok
 * collision resolution (Phase 2), and velocity override (Phase 3).
 *
 * @see ADR-0008 — Vehicle Physics — Arcade Dynamic
 * @see C21 — 1 DYNAMIC body per car
 * @see C22 — 3-phase execution within pipeline slot #2
 */

import type { PhysicsConfig } from "./physics-config";

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
  /** Current gear: 0 (neutral) or 1–6. */
  readonly gear: 0 | 1 | 2 | 3 | 4 | 5 | 6;
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

/**
 * Physics subsystem interface.
 *
 * All simulation state is internal — external systems query via
 * getTelemetry() and getSplinePosition(). Control signals arrive
 * via setLocked(), setPit(), onFuelUpdate(), and onTireUpdate().
 *
 * @example
 * ```typescript
 * const physics = new PhysicsService(scene, trackSystem);
 * await physics.init(config);
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
