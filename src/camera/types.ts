/**
 * @fileoverview Camera system type definitions for Overdrive.
 *
 * Core types shared across all camera stories:
 * - CameraMode enum (5 values: Inactive, Grid, Cockpit, Chase, Drone)
 * - ICameraManager interface (7 methods)
 * - CameraConfig interface (25 knobs across 7 groups)
 * - ShakeType, ShakeConfig, ActiveShake (forward types — full impl in Story 007)
 *
 * @see ADR-0007 — Camera Architecture
 * @see Story 001 — Camera Foundation
 * @see Story 007 — Shake System (full ShakeConfig/ActiveShake implementation)
 */

import type { Scene } from "@babylonjs/core/scene";

// ---------------------------------------------------------------------------
// CameraMode
// ---------------------------------------------------------------------------

/**
 * All possible camera states in the game.
 *
 * Exactly 5 values. Only one camera is `scene.activeCamera` per frame;
 * the others remain dormant in the scene's camera list.
 *
 * - `Inactive`: No camera active (Menu/Loading states). GSM drives transitions.
 * - `Grid`: FreeCamera framing the starting grid (PreRace).
 * - `Cockpit`: FreeCamera parented to player car's `driver_eye` (Racing).
 * - `Chase`: FollowCamera behind the player car (Racing).
 * - `Drone`: ArcRotateCamera auto-orbiting the player car (PostRace).
 *
 * @see TR-CAM-001 — Three camera modes
 * @see ADR-0007 §Camera Types by Mode
 */
export enum CameraMode {
  Inactive = 0,
  Grid,
  Cockpit,
  Chase,
  Drone,
}

// ---------------------------------------------------------------------------
// ICameraManager
// ---------------------------------------------------------------------------

/**
 * CameraManager contract — the only public API external systems interact with.
 *
 * All 8 methods are required. The CameraManager is constructed with a Scene
 * reference, then `init()` creates cameras and stores the player car ID.
 * After init, `setActiveMode()` activates one camera per frame via
 * `scene.activeCamera`. `update(dt)` runs per-tick (FOV shift, shake, etc.)
 *
 * @see ADR-0007 §Key Interfaces
 * @see ADR-0007 §GSM Lifecycle
 */
export interface ICameraManager {
  /**
   * Create all 4 camera instances and set up internal state.
   * Must be called once before any other method.
   *
   * @param scene       — The Babylon.js Scene to create cameras in
   * @param playerCarId — Entity ID of the player's car (for follow target, etc.)
   */
  init(scene: Scene, playerCarId: string): void;

  /**
   * Switch the active camera. Sets `scene.activeCamera` to the camera
   * matching the given mode. Invalid/unrecognised values are silently
   * ignored (no-op, no throw).
   *
   * @param mode — Desired CameraMode to activate
   */
  setActiveMode(mode: CameraMode): void;

  /**
   * Toggle between Cockpit and Chase camera modes.
   * Called on cameraToggle pulse from InputState (ADR-0006).
   * If neither Cockpit nor Chase is active, does nothing (no-op).
   *
   * @see TR-CAM-002 — Instant toggle
   * @see Story 005 — Cockpit/Chase toggle
   */
  toggleCockpitChase(): void;

  /**
   * Push current player speed into the camera system.
   * Used by the FOV shift calculation each tick.
   *
   * @param speedKmh — Current player car speed in km/h
   * @see Story 006 — FOV shift
   */
  setSpeedData(speedKmh: number): void;

  /**
   * Add a shake effect to the active camera.
   * Shake is additive with exponential decay per event.
   *
   * @param type      — Source category (kerb, collision, offTrack)
   * @param intensity — Shake strength (0.0 to 1.0)
   * @see Story 007 — Shake system
   */
  addShake(type: ShakeType, intensity: number): void;

  /**
   * Attempt to skip the drone camera sequence.
   *
   * Called by the input system on confirm action (during Drone mode only).
   * If `drone.skipDelay` has elapsed since drone activation, switches to
   * Inactive mode. Otherwise, the call is silently ignored (no-op).
   *
   * @see TR-CAM-010 — Drone camera auto-orbit (skippable after delay)
   * @see Story 008 — AC-10 (skip on confirm after delay)
   */
  trySkipDrone(): void;

  /**
   * Per-tick update called from the game loop.
   * Drives FOV shift, shake decay, chase occlusion raycast,
   * and drone auto-orbit.
   *
   * @param dt — Delta time in seconds (fixed 1/60s)
   */
  update(dt: number): void;

  /**
   * Dispose all camera instances, transform nodes, and free resources.
   * Does NOT dispose the Scene (CameraManager does not own it).
   * Safe to call multiple times.
   */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// CameraConfig
// ---------------------------------------------------------------------------

/**
 * Data-driven camera tuning configuration.
 *
 * Contains exactly 25 numeric knobs grouped by camera mode and effect:
 * cockpit(3) + chase(8) + drone(4) + speedFactor(1) + headBob(2) +
 * lean(1) + shake(6) = 25.
 *
 * @see createDefaultCameraConfig() in camera-defaults.ts
 * @see ADR-0007 §Key Interfaces
 */
export interface CameraConfig {
  /** Cockpit camera (FreeCamera parented to driver_eye). */
  cockpit: {
    /** Base FOV in degrees. */
    fov: number;
    /** Minimum FOV (at high speed). */
    fovMin: number;
    /** Maximum FOV (at low speed). */
    fovMax: number;
  };

  /** Chase camera (FollowCamera behind player car). */
  chase: {
    /** Base FOV in degrees. */
    fov: number;
    /** Minimum FOV (at high speed). */
    fovMin: number;
    /** Maximum FOV (at low speed). */
    fovMax: number;
    /** Follow distance behind the car in world units. */
    distance: number;
    /** Camera height above follow target. */
    height: number;
    /** Lateral offset from follow target. */
    offset: number;
    /** FollowCamera native acceleration rate. */
    cameraAcceleration: number;
    /** FollowCamera native max velocity. */
    maxCameraSpeed: number;
  };

  /** Drone camera (ArcRotateCamera auto-orbit, PostRace). */
  drone: {
    /** Orbit distance from player car. */
    distance: number;
    /** Orbit angular speed in degrees per second. */
    speed: number;
    /** Seconds before player can skip the drone sequence. */
    skipDelay: number;
    /** FOV in degrees. */
    fov: number;
  };

  /** FOV shift multiplier: offset = speedFactor × speedKmh. */
  speedFactor: number;

  /** Head bob effect (cosmetic, cockpit-only). */
  headBob: {
    /** Bob displacement amplitude in world units. */
    intensity: number;
    /** Bob oscillation frequency in Hz. */
    frequency: number;
  };

  /** Lateral lean effect (cosmetic, cockpit-only). */
  lean: {
    /** Lean displacement amplitude in world units. */
    intensity: number;
  };

  /** Shake system configuration. */
  shake: ShakeConfig;
}

// ---------------------------------------------------------------------------
// Shake types (forward declarations — full implementation in Story 007)
// ---------------------------------------------------------------------------

/**
 * Categories of shake events in the game.
 *
 * Each type originates from a different trigger source:
 * - `kerb`: Driving over kerbs or rumble strips
 * - `collision`: Car-to-car or car-to-barrier impact
 * - `offTrack`: Driving on off-road surface (non-grip area)
 */
export type ShakeType = "kerb" | "collision" | "offTrack";

/**
 * Shake configuration knobs (6 values).
 *
 * Per-type intensity and decay configuration. Each shake type (kerb,
 * collision, offTrack) has its own default intensity and exponential
 * decay rate, allowing different "feels" per trigger source.
 *
 * @see Story 007 — Full shake system with ActiveShake[] runtime state
 */
export interface ShakeConfig {
  /** Default intensity for kerb-triggered shake (default 0.03). */
  kerbIntensity: number;
  /** Per-second exponential decay rate for kerb shake (default 6.0). */
  kerbDecay: number;
  /** Collision impulse-to-intensity multiplier (default 0.001). */
  collisionFactor: number;
  /** Per-second exponential decay rate for collision shake (default 4.0). */
  collisionDecay: number;
  /** Default intensity for off-track shake (default 0.02). */
  offtrackIntensity: number;
  /** Per-second exponential decay rate for off-track shake (default 5.0). */
  offtrackDecay: number;
}

// ---------------------------------------------------------------------------
// CameraError
// ---------------------------------------------------------------------------

/**
 * Error thrown by camera system operations when a precondition fails.
 *
 * Used instead of raw Error to allow callers (GSM, entity system) to
 * catch and handle camera-specific failures separately from generic errors.
 *
 * @example
 * ```typescript
 * try {
 *   cameraManager.attachCockpitToCar(carMesh);
 * } catch (err) {
 *   if (err instanceof CameraError) {
 *     // Handle missing driver_eye node gracefully
 *   }
 * }
 * ```
 */
export class CameraError extends Error {
  readonly name = "CameraError";
}

/**
 * Runtime active shake state.
 *
 * Each shake event creates one ActiveShake with its own intensity and decay.
 * The shake system tracks elapsed time per instance and removes it when
 * remaining intensity falls below `decayFloor` of initial.
 *
 * @see ADR-0007 §Shake System
 * @see Story 007 — Full implementation with ActiveShake[]
 */
export interface ActiveShake {
  /** Current intensity of this shake event (0.0 to initial value). */
  intensity: number;
  /** Per-second exponential decay rate. */
  decay: number;
  /** Elapsed time since this shake was triggered, in seconds. */
  time: number;
}
