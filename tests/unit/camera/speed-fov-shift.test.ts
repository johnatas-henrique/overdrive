// @vitest-environment node

/**
 * Unit tests: Speed-Dependent FOV Shift (Story 006).
 *
 * Exhaustively tests the `_updateFOV()` logic driven through `update()`:
 * - AC-3a: Base FOV at speed=0 equals baseFOV for the active mode
 * - AC-3b: FOV = clamp(baseFOV + speedFactor × speed_kmh, FOV_min, FOV_max)
 * - AC-3c: Zero smoothing — FOV is applied synchronously after one update() call
 * - Grid and Drone modes are unchanged (no speed-dependent shift)
 * - Edge cases: negative speeds, extreme speeds, dispose safety
 *
 * @see Story 006 — Speed-Dependent FOV Shift
 * @see ADR-0007 — Camera Architecture
 * @see TR-CAM-003 — Speed-dependent FOV
 * @see C20 — FOV shift formula: baseFOV + speedFactor × speed_kmh, clamped
 */

import type { Camera } from "@babylonjs/core/Cameras/camera";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CameraManager } from "@/camera/camera-manager";
import { CameraMode } from "@/camera/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal NullEngine for headless camera construction. */
function createEngine(): NullEngine {
  return new NullEngine({
    renderWidth: 1,
    renderHeight: 1,
    textureSize: 1,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
}

/** Create a fresh fixture with engine, scene, and initialised CameraManager. */
function createFixture() {
  const engine = createEngine();
  const scene = new Scene(engine);
  const cameraManager = new CameraManager(scene);
  cameraManager.init(scene, "player-1");
  return { engine, scene, cameraManager };
}

// ---------------------------------------------------------------------------
// Expected values (from createDefaultCameraConfig)
// ---------------------------------------------------------------------------

const COCKPIT_BASE = 75;
const COCKPIT_MIN = 65;
const COCKPIT_MAX = 85;

const CHASE_BASE = 60;
const CHASE_MIN = 52;
const CHASE_MAX = 68;

/** Convert degrees to radians with default tolerances. */
function degToRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("speed-dependent FOV shift (Story 006)", () => {
  let engine: NullEngine;
  let scene: Scene;
  let cm: CameraManager;

  beforeEach(() => {
    const f = createFixture();
    engine = f.engine;
    scene = f.scene;
    cm = f.cameraManager;
  });

  afterEach(() => {
    cm.dispose();
    scene.dispose();
    engine.dispose();
  });

  // ── AC-3a: Base FOV at rest ────────────────────────────────────────

  describe("AC-3a: base FOV at speed=0", () => {
    it("test_cockpit_base_fov_at_rest", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      cm.setSpeedData(0);
      cm.update(1 / 60);

      // At rest, FOV should equal baseFOV (75°)
      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(COCKPIT_BASE), 5);
    });

    it("test_chase_base_fov_at_rest", () => {
      cm.setActiveMode(CameraMode.Chase);
      cm.setSpeedData(0);
      cm.update(1 / 60);

      // At rest, FOV should equal baseFOV (60°)
      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(CHASE_BASE), 5);
    });
  });

  // ── AC-3b: FOV formula across speed range ──────────────────────────

  describe("AC-3b: FOV formula across speed range", () => {
    it("test_cockpit_at_100_kmh", () => {
      // clamp(75 + 0.05*100, 65, 85) = clamp(80, 65, 85) = 80°
      cm.setActiveMode(CameraMode.Cockpit);
      cm.setSpeedData(100);
      cm.update(1 / 60);

      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(80), 5);
    });

    it("test_cockpit_clamp_to_max_at_200_kmh", () => {
      // clamp(75 + 0.05*200, 65, 85) = clamp(85, 65, 85) = 85°
      cm.setActiveMode(CameraMode.Cockpit);
      cm.setSpeedData(200);
      cm.update(1 / 60);

      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(COCKPIT_MAX), 5);
    });

    it("test_cockpit_clamp_to_max_at_500_kmh", () => {
      // clamp(75 + 0.05*500, 65, 85) = clamp(100, 65, 85) = 85°
      cm.setActiveMode(CameraMode.Cockpit);
      cm.setSpeedData(500);
      cm.update(1 / 60);

      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(COCKPIT_MAX), 5);
    });

    it("test_cockpit_clamp_to_min_at_negative_200_kmh", () => {
      // clamp(75 + 0.05*(-200), 65, 85) = clamp(65, 65, 85) = 65°
      cm.setActiveMode(CameraMode.Cockpit);
      cm.setSpeedData(-200);
      cm.update(1 / 60);

      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(COCKPIT_MIN), 5);
    });

    it("test_cockpit_clamp_to_min_at_extreme_negative_speed", () => {
      // clamp(75 + 0.05*(-1000), 65, 85) = clamp(25, 65, 85) = 65°
      cm.setActiveMode(CameraMode.Cockpit);
      cm.setSpeedData(-1000);
      cm.update(1 / 60);

      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(COCKPIT_MIN), 5);
    });

    it("test_chase_at_100_kmh", () => {
      // clamp(60 + 0.05*100, 52, 68) = clamp(65, 52, 68) = 65°
      cm.setActiveMode(CameraMode.Chase);
      cm.setSpeedData(100);
      cm.update(1 / 60);

      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(65), 5);
    });

    it("test_chase_clamp_to_max_at_200_kmh", () => {
      // clamp(60 + 0.05*200, 52, 68) = clamp(70, 52, 68) = 68°
      cm.setActiveMode(CameraMode.Chase);
      cm.setSpeedData(200);
      cm.update(1 / 60);

      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(CHASE_MAX), 5);
    });

    it("test_chase_clamp_to_min_at_negative_160_kmh", () => {
      // clamp(60 + 0.05*(-160), 52, 68) = clamp(52, 52, 68) = 52°
      cm.setActiveMode(CameraMode.Chase);
      cm.setSpeedData(-160);
      cm.update(1 / 60);

      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(CHASE_MIN), 5);
    });

    it("test_chase_mid_speed_linear", () => {
      // clamp(60 + 0.05*40, 52, 68) = clamp(62, 52, 68) = 62°
      // Verifies the linear portion of the formula (not at bounds)
      cm.setActiveMode(CameraMode.Chase);
      cm.setSpeedData(40);
      cm.update(1 / 60);

      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(62), 5);
    });
  });

  // ── AC-3c: Zero smoothing / synchronous application ─────────────────

  describe("AC-3c: zero smoothing delay", () => {
    it("test_fov_applied_synchronously_after_one_update", () => {
      // Set mode and speed, then verify FOV changes immediately after
      // a single update() call — no lerp, no deferred animation.
      cm.setActiveMode(CameraMode.Cockpit);
      cm.setSpeedData(200);

      // Before update: FOV should be the initial camera FOV (still the
      // default from camera creation), not yet shifted.
      // The initial FreeCamera fov in Babylon.js defaults to 0.8 rad.
      // After our first update, it should be 85° in radians.
      cm.update(1 / 60);

      // After one update: FOV must equal the formula result for 200 km/h
      // with zero smoothing — the value is assigned directly.
      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(COCKPIT_MAX), 5);
    });

    it("test_fov_updates_immediately_when_speed_changes", () => {
      cm.setActiveMode(CameraMode.Cockpit);

      // Frame 1: speed = 0 → baseFOV
      cm.setSpeedData(0);
      cm.update(1 / 60);
      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(COCKPIT_BASE), 5);

      // Frame 2: speed = 100 → 80° (no lerp, direct assignment)
      cm.setSpeedData(100);
      cm.update(1 / 60);
      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(80), 5);

      // Frame 3: speed = 200 → 85° (clamped to max)
      cm.setSpeedData(200);
      cm.update(1 / 60);
      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(COCKPIT_MAX), 5);
    });
  });

  // ── Grid and Drone modes ───────────────────────────────────────────

  describe("Grid and Drone use fixed FOV", () => {
    it("test_grid_mode_fov_unchanged", () => {
      cm.setActiveMode(CameraMode.Grid);

      // Grid should keep its initial FOV regardless of speed
      const initialFov = scene.activeCamera?.fov;
      cm.setSpeedData(300);
      cm.update(1 / 60);

      // FOV must remain unchanged (no speed-dependent shift for Grid)
      expect(scene.activeCamera?.fov).toBe(initialFov);
    });

    it("test_drone_mode_fov_unchanged", () => {
      cm.setActiveMode(CameraMode.Drone);

      // Drone should keep its initial FOV regardless of speed
      const initialFov = scene.activeCamera?.fov;
      cm.setSpeedData(300);
      cm.update(1 / 60);

      // FOV must remain unchanged (no speed-dependent shift for Drone)
      expect(scene.activeCamera?.fov).toBe(initialFov);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("test_does_not_throw_when_active_camera_is_null", () => {
      // After init with no active mode set, activeCamera is null.
      // update() should not throw.
      cm.setSpeedData(100);
      expect(() => cm.update(1 / 60)).not.toThrow();
    });

    it("test_activeCamera_null_guard_skips_fov_assignment", () => {
      // Set mode so _updateFOV doesn't return early, but nullify activeCamera
      cm.setActiveMode(CameraMode.Cockpit);
      scene.activeCamera = null;
      cm.setSpeedData(100);
      // Should not throw — the if (activeCam) guard skips assignment
      expect(() => cm.update(1 / 60)).not.toThrow();
    });

    it("test_does_not_throw_after_dispose", () => {
      cm.dispose();
      cm.setSpeedData(100);
      // After dispose, _currentMode is Inactive and activeCamera is null
      expect(() => cm.update(1 / 60)).not.toThrow();
    });

    it("test_inactive_mode_fov_unchanged", () => {
      // Inactive mode should not change FOV (no active camera)
      cm.setSpeedData(200);
      cm.update(1 / 60);

      expect(scene.activeCamera).toBeNull();
    });

    it("test_chase_and_cockpit_use_independent_fov_ranges", () => {
      // Cockpit at 100 km/h → 80°
      cm.setActiveMode(CameraMode.Cockpit);
      cm.setSpeedData(100);
      cm.update(1 / 60);
      const cockpitFov = (scene.activeCamera as Camera).fov;

      // Switch to Chase at same speed → 65° (different base/range)
      cm.setActiveMode(CameraMode.Chase);
      cm.setSpeedData(100);
      cm.update(1 / 60);
      const chaseFov = (scene.activeCamera as Camera).fov;

      // Verify independence: cockpit FOV and chase FOV differ because
      // each mode has its own baseFOV, fovMin, fovMax.
      expect(cockpitFov).toBeCloseTo(degToRad(80), 5);
      expect(chaseFov).toBeCloseTo(degToRad(65), 5);
      expect(cockpitFov).not.toBeCloseTo(chaseFov, 5);
    });

    it("test_speed_factor_zero_disables_shift", () => {
      // Override config via private access: set speedFactor to 0.
      // This simulates what ConfigManager HMR would do (Story 010).
      const cfg = (cm as unknown as Record<string, unknown>)._config as Record<
        string,
        unknown
      >;
      cfg.speedFactor = 0;

      cm.setActiveMode(CameraMode.Cockpit);
      cm.setSpeedData(200);
      cm.update(1 / 60);

      // With speedFactor=0, FOV = baseFOV regardless of speed
      expect(scene.activeCamera?.fov).toBeCloseTo(degToRad(COCKPIT_BASE), 5);
    });
  });
});
