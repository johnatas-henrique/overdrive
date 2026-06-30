/**
 * Per-car physics state — mutable tick-level state for the arcade model.
 *
 * Each car has one CarPhysicsState instance in the PhysicsService's
 * internal state map. Phase 1 writes targetSpeed/targetYawRate,
 * Phase 3 reads them for the velocity override.
 *
 * @see ADR-0008 — Arcade Model (Phase 1) and Velocity Override (Phase 3)
 * @see C21 — 1 DYNAMIC body per car
 */

import type { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";

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
 * @example
 * ```typescript
 * const state: CarPhysicsState = {
 *   carId: "car_01",
 *   body: aggregate.body,
 *   targetSpeed: 0,
 *   targetYawRate: 0,
 *   splinePosition: 0,
 *   speedKmh: 0,
 *   rpm: 0,
 *   gear: 0,
 *   lateralG: 0,
 *   accelG: 0,
 *   tireSqueal: 0,
 *   kerbHit: false,
 *   offTrack: false,
 *   gripMultiplier: 1,
 *   fuelMult: 1,
 *   tireCondition: 1,
 *   locked: true,
 *   pitMode: false,
 *   tireBlownEmitted: false,
 *   fuelEmptyEmitted: false,
 *   wasAboveStopEpsilon: false,
 * };
 * ```
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

  /** Current gear: 0 = neutral, 1–6 = forward gears. */
  gear: number;

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

  /** Current effective grip multiplier (gripMax / baseGrip). */
  gripMultiplier: number;

  // ─── Track Data ──────────────────────────────────────────────────

  /** Track gradient at car's spline position (sin of slope angle). Positive = uphill. */
  gradient: number;

  // ─── External Inputs (1-tick delay per ADR-0008) ──────────────────

  /** Fuel multiplier from Fuel system (0..1). Default 1.0. */
  fuelMult: number;

  /** Tire condition from Tire Wear system (0..1). Default 1.0. */
  tireCondition: number;

  // ─── Control State ──────────────────────────────────────────────────

  /** True when car is locked (grid start / pit stop). */
  locked: boolean;

  /** True when car is in pit lane speed-limited mode. */
  pitMode: boolean;

  // ─── Edge-Event Guards ──────────────────────────────────────────────

  /** Guard — `car.tire_blown` already emitted for this car. */
  tireBlownEmitted: boolean;

  /** Guard — `car.fuel_empty` already emitted for this car. */
  fuelEmptyEmitted: boolean;

  /** Guard — was above stopEpsilon on the previous tick. */
  wasAboveStopEpsilon: boolean;
}
