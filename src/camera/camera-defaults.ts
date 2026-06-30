/**
 * @fileoverview Default camera configuration factory for Overdrive.
 *
 * Produces a fully-populated CameraConfig with all 25 knobs set to
 * tuned gameplay values. This is the single source of truth for default
 * camera tuning — overridden at runtime by ConfigManager (ADR-0023).
 *
 * @see Story 001 — Camera Foundation
 * @see ADR-0007 — Camera Architecture
 * @see Story 010 — Config HMR (future)
 */

import type { CameraConfig } from "./types";

/**
 * Create a CameraConfig with default values for all 25 knobs.
 *
 * Contains exactly 25 numeric values across 7 groups:
 * cockpit(3) + chase(8) + drone(4) + speedFactor(1) + headBob(2) +
 * lean(1) + shake(6) = 25.
 *
 * @returns A fully-populated CameraConfig with tuned defaults
 */
export function createDefaultCameraConfig(): CameraConfig {
  return {
    // ── Cockpit (3 knobs) ──────────────────────────────────────────
    cockpit: {
      fov: 75,
      fovMin: 65,
      fovMax: 85,
    },

    // ── Chase (8 knobs) ────────────────────────────────────────────
    chase: {
      fov: 60,
      fovMin: 52,
      fovMax: 68,
      distance: 6,
      height: 3,
      offset: 0.5,
      cameraAcceleration: 0.005,
      maxCameraSpeed: 10,
    },

    // ── Drone (4 knobs) ────────────────────────────────────────────
    drone: {
      distance: 8,
      speed: 15,
      skipDelay: 500,
      fov: 75,
    },

    // ── Speed factor (1 knob) ──────────────────────────────────────
    speedFactor: 0.05,

    // ── Head bob (2 knobs) ─────────────────────────────────────────
    headBob: {
      intensity: 0.02,
      frequency: 2.0,
    },

    // ── Lean (1 knob) ──────────────────────────────────────────────
    lean: {
      intensity: 2.0,
    },

    // ── Shake (6 knobs) ────────────────────────────────────────────
    shake: {
      kerbIntensity: 0.03,
      kerbDecay: 6.0,
      collisionFactor: 0.001,
      collisionDecay: 4.0,
      offtrackIntensity: 0.02,
      offtrackDecay: 5.0,
    },
  };
}
