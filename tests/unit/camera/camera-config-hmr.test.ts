// @vitest-environment node

/**
 * Unit tests: Camera Config HMR Integration (Story 010).
 *
 * Tests ConfigManager registration, live config reads per tick,
 * and runtime config changes via setRuntime().
 *
 * AC-14a: Camera registers `camera.*` namespace with 25 keys
 * AC-14b: setRuntime() changes reflected in next update()
 * AC-14c: ConfigManager.get("camera") called each tick
 *
 * @see Story 010 — Camera Config HMR Integration
 * @see ADR-0023 — Data Config Manager
 * @see ADR-0007 — Camera Architecture
 */

import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CameraManager } from "@/camera/camera-manager";
import { CameraMode } from "@/camera/types";
import { ConfigManager } from "@/foundation/config/config-manager";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEngine(): NullEngine {
  return new NullEngine({
    renderWidth: 1,
    renderHeight: 1,
    textureSize: 1,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
}

function createFixture() {
  const engine = createEngine();
  const scene = new Scene(engine);
  const cm = new ConfigManager();
  cm.init();
  const cameraManager = new CameraManager(scene, null, cm);
  cameraManager.init(scene, "player-1");
  return { engine, scene, cm, cameraManager };
}

function expose(cm: CameraManager): Record<string, unknown> {
  return cm as unknown as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Expected 25 config keys from CameraConfig. */
const EXPECTED_CAMERA_KEYS = [
  "cockpit",
  "chase",
  "drone",
  "speedFactor",
  "headBob",
  "lean",
  "shake",
];

const EXPECTED_COCKPIT_KEYS = ["fov", "fovMin", "fovMax"];
const EXPECTED_CHASE_KEYS = [
  "fov",
  "fovMin",
  "fovMax",
  "distance",
  "height",
  "offset",
  "cameraAcceleration",
  "maxCameraSpeed",
];
const EXPECTED_DRONE_KEYS = ["distance", "speed", "skipDelay", "fov"];
const EXPECTED_HEADBOB_KEYS = ["intensity", "frequency"];
const EXPECTED_LEAN_KEYS = ["intensity"];
const EXPECTED_SHAKE_KEYS = [
  "kerbIntensity",
  "kerbDecay",
  "collisionFactor",
  "collisionDecay",
  "offtrackIntensity",
  "offtrackDecay",
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Camera Config HMR (Story 010)", () => {
  let engine: NullEngine;
  let scene: Scene;
  let cm: ConfigManager;
  let cameraManager: CameraManager;

  beforeEach(() => {
    const f = createFixture();
    engine = f.engine;
    scene = f.scene;
    cm = f.cm;
    cameraManager = f.cameraManager;
  });

  afterEach(() => {
    cameraManager.dispose();
    scene.dispose();
    engine.dispose();
  });

  // ── AC-14a: Namespace registration ──────────────────────────────────

  describe("AC-14a: namespace registration", () => {
    it("test_camera_namespace_registered_with_config_manager", () => {
      // ConfigManager should have the "camera" namespace
      const config = cm.get<Record<string, unknown>>("camera");
      expect(config).toBeDefined();
    });

    it("test_camera_config_has_25_keys", () => {
      const config = cm.get<Record<string, unknown>>("camera");

      // Top-level keys
      for (const key of EXPECTED_CAMERA_KEYS) {
        expect(config).toHaveProperty(key);
      }

      // Nested keys count
      const cockpit = config.cockpit as Record<string, unknown>;
      const chase = config.chase as Record<string, unknown>;
      const drone = config.drone as Record<string, unknown>;
      const headBob = config.headBob as Record<string, unknown>;
      const lean = config.lean as Record<string, unknown>;
      const shake = config.shake as Record<string, unknown>;

      for (const key of EXPECTED_COCKPIT_KEYS) {
        expect(cockpit).toHaveProperty(key);
      }
      for (const key of EXPECTED_CHASE_KEYS) {
        expect(chase).toHaveProperty(key);
      }
      for (const key of EXPECTED_DRONE_KEYS) {
        expect(drone).toHaveProperty(key);
      }
      expect(config).toHaveProperty("speedFactor");
      for (const key of EXPECTED_HEADBOB_KEYS) {
        expect(headBob).toHaveProperty(key);
      }
      for (const key of EXPECTED_LEAN_KEYS) {
        expect(lean).toHaveProperty(key);
      }
      for (const key of EXPECTED_SHAKE_KEYS) {
        expect(shake).toHaveProperty(key);
      }
    });

    it("test_default_values_match_expected", () => {
      const config = cm.get<Record<string, unknown>>("camera");
      const cockpit = config.cockpit as Record<string, number>;
      const chase = config.chase as Record<string, number>;
      const drone = config.drone as Record<string, number>;

      expect(cockpit.fov).toBe(75);
      expect(chase.distance).toBe(6);
      expect(drone.speed).toBe(15);
      expect(config.speedFactor).toBe(0.05);
    });
  });

  // ── AC-14b: Runtime config changes ──────────────────────────────────

  describe("AC-14b: runtime config changes via setRuntime", () => {
    it("test_cockpit_fov_change_reflected_in_next_update", () => {
      cameraManager.setActiveMode(CameraMode.Cockpit);

      // Change cockpit.fov from 75 to 90
      cm.setRuntime("camera.cockpit.fov", 90);

      // Next update should read fresh config
      cameraManager.update(1 / 60);

      const cfg = expose(cameraManager)._config as Record<string, unknown>;
      const cockpit = cfg.cockpit as Record<string, number>;
      expect(cockpit.fov).toBe(90);
    });

    it("test_chase_distance_change_reflected", () => {
      cm.setRuntime("camera.chase.distance", 10);
      cameraManager.update(1 / 60);

      const cfg = expose(cameraManager)._config as Record<string, unknown>;
      const chase = cfg.chase as Record<string, number>;
      expect(chase.distance).toBe(10);
    });

    it("test_shake_kerbIntensity_change_reflected", () => {
      cm.setRuntime("camera.shake.kerbIntensity", 0.1);
      cameraManager.update(1 / 60);

      const cfg = expose(cameraManager)._config as Record<string, unknown>;
      const shake = cfg.shake as Record<string, number>;
      expect(shake.kerbIntensity).toBe(0.1);
    });

    it("test_headBob_intensity_change_reflected", () => {
      cm.setRuntime("camera.headBob.intensity", 0.05);
      cameraManager.update(1 / 60);

      const cfg = expose(cameraManager)._config as Record<string, unknown>;
      const headBob = cfg.headBob as Record<string, number>;
      expect(headBob.intensity).toBe(0.05);
    });

    it("test_drone_speed_change_reflected", () => {
      cm.setRuntime("camera.drone.speed", 25);
      cameraManager.update(1 / 60);

      const cfg = expose(cameraManager)._config as Record<string, unknown>;
      const drone = cfg.drone as Record<string, number>;
      expect(drone.speed).toBe(25);
    });
  });

  // ── AC-14c: Config read each tick ───────────────────────────────────

  describe("AC-14c: config read each tick", () => {
    it("test_config_manager_get_called_each_update", () => {
      const spy = vi.spyOn(cm, "get");

      cameraManager.update(1 / 60);
      cameraManager.update(1 / 60);
      cameraManager.update(1 / 60);

      // get("camera") should be called at least once per update
      const cameraCalls = spy.mock.calls.filter((call) => call[0] === "camera");
      expect(cameraCalls.length).toBeGreaterThanOrEqual(3);

      spy.mockRestore();
    });
  });

  // ── Backward compatibility ──────────────────────────────────────────

  describe("backward compatibility", () => {
    it("test_works_without_config_manager_injected", () => {
      // CameraManager without ConfigManager should still work
      const cm2 = new CameraManager(scene);
      cm2.init(scene, "player-2");

      expect(() => cm2.update(1 / 60)).not.toThrow();

      cm2.dispose();
    });
  });
});
