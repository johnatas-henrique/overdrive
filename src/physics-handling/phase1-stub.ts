/**
 * Stub Phase 1 arcade model for Story 001 (Physics Core Skeleton).
 *
 * Sets a minimal target speed and zero yaw rate so Phase 3 has valid
 * values to apply. Replaced entirely by Story 002 (full arcade grip model).
 *
 * @see ADR-0008 — Phase 1: arcadeModel.updateAll(dt)
 */

import type { InputState } from "@/foundation/determinism/types";
import type { CarPhysicsState, PhysicsConfig } from "./types";

/**
 * Stub Phase 1 compute function.
 *
 * Accepts InputState and PhysicsConfig for forward compatibility with Story 002.
 * Currently sets a fixed low-speed baseline and zero yaw.
 */
export class Phase1Stub {
  /**
   * Compute target speed and yaw rate for one car.
   *
   * Story 001: sets targetSpeed to a fixed low baseline (5 m/s) and
   * targetYawRate to zero. The InputState and PhysicsConfig parameters are
   * accepted for forward compatibility but not consumed.
   *
   * @param state - Per-car physics state (mutated in place)
   * @param _input - InputState for this tick (unused in Story 001 stub)
   * @param _dt - Delta time in seconds (unused in Story 001 stub)
   * @param _config - Physics configuration (unused in Story 001 stub)
   */
  compute(
    state: CarPhysicsState,
    _input: InputState,
    _dt: number,
    _config: PhysicsConfig
  ): void {
    // Story 001: fixed low speed, no steering
    state.targetSpeed = 5; // 5 m/s ≈ 18 km/h
    state.targetYawRate = 0;

    // Derive basic telemetry from targetSpeed
    state.speedKmh = state.targetSpeed * 3.6;
    // RPM is a fixed stub value (3000) until Story 003 (Engine/Gears) derives
    // it from actual torque curve and gear ratios. Any downstream system (Audio,
    // HUD, Camera) wiring up to rpm before Story 003 will see constant 3000.
    state.rpm = 3000;
    state.gear = 1;
  }
}
