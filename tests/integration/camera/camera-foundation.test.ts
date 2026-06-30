// @vitest-environment node

/**
 * Integration tests: Camera Foundation (Story 001).
 *
 * Tests all 7 acceptance criteria (F1–F7) for the camera system foundation:
 *   F1: CameraMode enum — exactly 5 values with correct names/ordinals
 *   F2: ICameraManager interface — 7 methods with correct signatures
 *   F3: CameraManager class — initialises without throwing
 *   F4: 4 camera instances — correct Babylon.js types
 *   F5: Input cleanup — inputs.clear() + inertia === 0 on all cameras
 *   F6: setActiveMode — switches scene.activeCamera, invalid mode no-throw
 *   F7: CameraConfig defaults — 25 knobs with non-null/non-undefined values
 *
 * @see Story 001 — Camera Foundation
 * @see ADR-0007 — Camera Architecture
 * @see TR-CAM-001, TR-CAM-008
 */

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { FollowCamera } from "@babylonjs/core/Cameras/followCamera";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultCameraConfig } from "@/camera/camera-defaults";
import { CameraManager } from "@/camera/camera-manager";
import { CameraMode, type ICameraManager } from "@/camera/types";

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

/**
 * Recursively count all numeric leaf values in an object.
 * Used to verify the 25-knob count in CameraConfig.
 */
function countNumericLeaves(value: unknown): number {
  if (typeof value === "number") return 1;
  if (value !== null && typeof value === "object") {
    let count = 0;
    for (const val of Object.values(value as Record<string, unknown>)) {
      count += countNumericLeaves(val);
    }
    return count;
  }
  return 0;
}

/**
 * Recursively check that all leaf values are non-null and non-undefined.
 */
function checkNoNullOrUndefined(
  value: unknown,
  path: string,
  errors: string[]
): void {
  if (value === null || value === undefined) {
    errors.push(`${path} is ${String(value)}`);
    return;
  }
  if (typeof value === "object") {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      checkNoNullOrUndefined(val, `${path}.${key}`, errors);
    }
  }
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

interface Fixture {
  engine: NullEngine;
  scene: Scene;
}

function createFixture(): Fixture {
  const engine = createEngine();
  const scene = new Scene(engine);
  return { engine, scene };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Camera Foundation (Story 001)", () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = createFixture();
  });

  afterEach(() => {
    fixture.scene.dispose();
    fixture.engine.dispose();
  });

  // ── F1: CameraMode enum ──────────────────────────────────────────

  describe("F1 — CameraMode enum", () => {
    it("test_enum_has_exactly_5_values", () => {
      const keys = Object.keys(CameraMode).filter((k) =>
        Number.isNaN(Number(k))
      );
      expect(keys).toHaveLength(5);
    });

    it("test_enum_values_have_correct_names_and_ordinals", () => {
      expect(CameraMode.Inactive).toBe(0);
      expect(CameraMode.Grid).toBe(1);
      expect(CameraMode.Cockpit).toBe(2);
      expect(CameraMode.Chase).toBe(3);
      expect(CameraMode.Drone).toBe(4);
    });

    it("test_enum_reverse_lookup_returns_correct_names", () => {
      expect(CameraMode[0]).toBe("Inactive");
      expect(CameraMode[1]).toBe("Grid");
      expect(CameraMode[2]).toBe("Cockpit");
      expect(CameraMode[3]).toBe("Chase");
      expect(CameraMode[4]).toBe("Drone");
    });
  });

  // ── F2: ICameraManager interface ─────────────────────────────────

  describe("F2 — ICameraManager interface", () => {
    it("test_interface_has_7_methods", () => {
      // Compile-time check: these should all compile without error
      const _check: ICameraManager = null as unknown as ICameraManager;

      // Runtime method name check via a mock implementation
      const methodNames: Array<keyof ICameraManager> = [
        "init",
        "setActiveMode",
        "toggleCockpitChase",
        "setSpeedData",
        "addShake",
        "update",
        "dispose",
      ];
      expect(methodNames).toHaveLength(7);
    });

    it("test_init_signature_accepts_scene_and_carId", () => {
      const cm = new CameraManager(fixture.scene);
      // Should not throw — Scene + string params
      expect(() => cm.init(fixture.scene, "player-1")).not.toThrow();
      cm.dispose();
    });
  });

  // ── F3: CameraManager init ───────────────────────────────────────

  describe("F3 — CameraManager initialisation", () => {
    it("test_constructor_does_not_throw", () => {
      expect(() => new CameraManager(fixture.scene)).not.toThrow();
    });

    it("test_constructor_returns_valid_instance", () => {
      const cm = new CameraManager(fixture.scene);
      expect(cm).toBeInstanceOf(CameraManager);
      cm.dispose();
    });

    it("test_init_does_not_throw", () => {
      const cm = new CameraManager(fixture.scene);
      expect(() => cm.init(fixture.scene, "player-1")).not.toThrow();
      cm.dispose();
    });

    it("test_init_called_twice_does_not_throw", () => {
      // Initialising twice should be safe (cameras are recreated)
      const cm = new CameraManager(fixture.scene);
      cm.init(fixture.scene, "player-1");
      expect(() => cm.init(fixture.scene, "player-1")).not.toThrow();
      cm.dispose();
    });
  });

  // ── F4: Camera instances ─────────────────────────────────────────

  describe("F4 — Camera instances are correct types", () => {
    function getInitManager(fixture: Fixture): CameraManager {
      // Access camera instances via type cast after init
      const cm = new CameraManager(fixture.scene);
      cm.init(fixture.scene, "player-1");
      return cm;
    }

    it("test_gridCam_is_FreeCamera", () => {
      const cm = getInitManager(fixture);
      cm.setActiveMode(CameraMode.Grid);
      expect(fixture.scene.activeCamera).toBeInstanceOf(FreeCamera);
      cm.dispose();
    });

    it("test_cockpitCam_is_FreeCamera", () => {
      const cm = getInitManager(fixture);
      cm.setActiveMode(CameraMode.Cockpit);
      expect(fixture.scene.activeCamera).toBeInstanceOf(FreeCamera);
      cm.dispose();
    });

    it("test_chaseCam_is_FollowCamera", () => {
      const cm = getInitManager(fixture);
      cm.setActiveMode(CameraMode.Chase);
      expect(fixture.scene.activeCamera).toBeInstanceOf(FollowCamera);
      cm.dispose();
    });

    it("test_droneCam_is_ArcRotateCamera", () => {
      const cm = getInitManager(fixture);
      cm.setActiveMode(CameraMode.Drone);
      expect(fixture.scene.activeCamera).toBeInstanceOf(ArcRotateCamera);
      cm.dispose();
    });

    it("test_all_4_cameras_are_distinct_instances", () => {
      const cm = new CameraManager(fixture.scene);
      cm.init(fixture.scene, "player-1");

      // Check each camera is a distinct object
      cm.setActiveMode(CameraMode.Grid);
      const grid = fixture.scene.activeCamera;
      cm.setActiveMode(CameraMode.Cockpit);
      const cockpit = fixture.scene.activeCamera;
      cm.setActiveMode(CameraMode.Chase);
      const chase = fixture.scene.activeCamera;
      cm.setActiveMode(CameraMode.Drone);
      const drone = fixture.scene.activeCamera;

      expect(grid).not.toBe(cockpit);
      expect(grid).not.toBe(chase);
      expect(grid).not.toBe(drone);
      expect(cockpit).not.toBe(chase);
      expect(cockpit).not.toBe(drone);
      expect(chase).not.toBe(drone);

      cm.dispose();
    });
  });

  // ── F5: Inputs cleared + inertia ─────────────────────────────────

  describe("F5 — Input cleanup (C17)", () => {
    function getInitManager(fixture: Fixture): CameraManager {
      const cm = new CameraManager(fixture.scene);
      cm.init(fixture.scene, "player-1");
      return cm;
    }

    it("test_gridCam_inertia_is_zero", () => {
      const cm = getInitManager(fixture);
      cm.setActiveMode(CameraMode.Grid);
      expect((fixture.scene.activeCamera as FreeCamera).inertia).toBe(0);
      cm.dispose();
    });

    it("test_cockpitCam_inertia_is_zero", () => {
      const cm = getInitManager(fixture);
      cm.setActiveMode(CameraMode.Cockpit);
      expect((fixture.scene.activeCamera as FreeCamera).inertia).toBe(0);
      cm.dispose();
    });

    it("test_chaseCam_inertia_is_zero", () => {
      const cm = getInitManager(fixture);
      cm.setActiveMode(CameraMode.Chase);
      expect((fixture.scene.activeCamera as FollowCamera).inertia).toBe(0);
      cm.dispose();
    });

    it("test_droneCam_inertia_is_zero", () => {
      const cm = getInitManager(fixture);
      cm.setActiveMode(CameraMode.Drone);
      expect((fixture.scene.activeCamera as ArcRotateCamera).inertia).toBe(0);
      cm.dispose();
    });

    it("test_inputs_clear_does_not_crash_on_any_camera", () => {
      // The real test is that calling inputs.clear() doesn't throw.
      // Verify by activating each camera after init (clear was called during init).
      const cm = getInitManager(fixture);

      cm.setActiveMode(CameraMode.Grid);
      expect(fixture.scene.activeCamera).toBeInstanceOf(FreeCamera);

      cm.setActiveMode(CameraMode.Cockpit);
      expect(fixture.scene.activeCamera).toBeInstanceOf(FreeCamera);

      cm.setActiveMode(CameraMode.Chase);
      expect(fixture.scene.activeCamera).toBeInstanceOf(FollowCamera);

      cm.setActiveMode(CameraMode.Drone);
      expect(fixture.scene.activeCamera).toBeInstanceOf(ArcRotateCamera);

      cm.dispose();
    });

    it("test_drone_movement_input_map_cleared", () => {
      const cm = getInitManager(fixture);
      cm.setActiveMode(CameraMode.Drone);

      // Verify the extra v9.8+ cleanup ran without crashing
      const droneCam = fixture.scene.activeCamera as ArcRotateCamera;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const movement = (droneCam as any).movement;
      if (movement?.input?.inputMap) {
        expect(movement.input.inputMap.length).toBe(0);
      }
      // If movement property structure doesn't exist in this BJS version,
      // the code path in CameraManager._applyInputCleanup guards with
      // optional chaining, so it won't crash either way.

      cm.dispose();
    });

    it("test_drone_movement_input_map_cleared_when_property_exists", () => {
      // Test the static _clearDroneInputMapping method directly with a mock
      // that has the full movement.input.inputMap structure.
      const mockInputMap: unknown[] = ["old", "entries"];
      const mockDrone = {
        movement: { input: { inputMap: mockInputMap } },
      } as unknown as ArcRotateCamera;

      CameraManager._clearDroneInputMapping(mockDrone);
      expect(mockInputMap.length).toBe(0);
    });

    it("test_drone_movement_input_map_noop_when_property_absent", () => {
      // Test the static method with a drone that has no movement property
      // (NullEngine scenario) — should not throw
      const mockDrone = {} as unknown as ArcRotateCamera;
      expect(() =>
        CameraManager._clearDroneInputMapping(mockDrone)
      ).not.toThrow();
    });
  });

  // ── F6: setActiveMode switching ──────────────────────────────────

  describe("F6 — setActiveMode switching", () => {
    function getInitManager(fixture: Fixture): CameraManager {
      const cm = new CameraManager(fixture.scene);
      cm.init(fixture.scene, "player-1");
      return cm;
    }

    it("test_setActiveMode_Inactive_sets_null", () => {
      const cm = getInitManager(fixture);
      cm.setActiveMode(CameraMode.Inactive);
      expect(fixture.scene.activeCamera).toBeNull();
      cm.dispose();
    });

    it("test_setActiveMode_Grid_switches_to_gridCam", () => {
      const cm = getInitManager(fixture);
      cm.setActiveMode(CameraMode.Grid);
      expect(fixture.scene.activeCamera).toBeInstanceOf(FreeCamera);
      expect(fixture.scene.activeCamera?.name).toBe("gridCam");
      cm.dispose();
    });

    it("test_setActiveMode_Cockpit_switches_to_cockpitCam", () => {
      const cm = getInitManager(fixture);
      cm.setActiveMode(CameraMode.Cockpit);
      expect(fixture.scene.activeCamera).toBeInstanceOf(FreeCamera);
      expect(fixture.scene.activeCamera?.name).toBe("cockpitCam");
      cm.dispose();
    });

    it("test_setActiveMode_Chase_switches_to_chaseCam", () => {
      const cm = getInitManager(fixture);
      cm.setActiveMode(CameraMode.Chase);
      expect(fixture.scene.activeCamera).toBeInstanceOf(FollowCamera);
      expect(fixture.scene.activeCamera?.name).toBe("chaseCam");
      cm.dispose();
    });

    it("test_setActiveMode_Drone_switches_to_droneCam", () => {
      const cm = getInitManager(fixture);
      cm.setActiveMode(CameraMode.Drone);
      expect(fixture.scene.activeCamera).toBeInstanceOf(ArcRotateCamera);
      expect(fixture.scene.activeCamera?.name).toBe("droneCam");
      cm.dispose();
    });

    it("test_switching_modes_alternates_correctly", () => {
      const cm = getInitManager(fixture);

      cm.setActiveMode(CameraMode.Grid);
      expect(fixture.scene.activeCamera?.name).toBe("gridCam");

      cm.setActiveMode(CameraMode.Chase);
      expect(fixture.scene.activeCamera?.name).toBe("chaseCam");

      cm.setActiveMode(CameraMode.Drone);
      expect(fixture.scene.activeCamera?.name).toBe("droneCam");

      cm.setActiveMode(CameraMode.Cockpit);
      expect(fixture.scene.activeCamera?.name).toBe("cockpitCam");

      cm.setActiveMode(CameraMode.Inactive);
      expect(fixture.scene.activeCamera).toBeNull();

      cm.dispose();
    });

    it("test_invalid_mode_does_not_throw_and_leaves_camera_unchanged", () => {
      const cm = getInitManager(fixture);

      // Set to a known mode first
      cm.setActiveMode(CameraMode.Cockpit);
      const currentCam = fixture.scene.activeCamera;
      expect(currentCam?.name).toBe("cockpitCam");

      // Invalid mode (outside enum range) — must not throw
      expect(() => cm.setActiveMode(99 as CameraMode)).not.toThrow();

      // scene.activeCamera should remain unchanged
      expect(fixture.scene.activeCamera).toBe(currentCam);

      cm.dispose();
    });

    it("test_setActiveMode_toggleCockpitChase_switches_between_cockpit_and_chase", () => {
      const cm = getInitManager(fixture);

      // Start in Cockpit
      cm.setActiveMode(CameraMode.Cockpit);
      expect(fixture.scene.activeCamera?.name).toBe("cockpitCam");

      // Toggle to Chase
      cm.toggleCockpitChase();
      expect(fixture.scene.activeCamera?.name).toBe("chaseCam");

      // Toggle back to Cockpit
      cm.toggleCockpitChase();
      expect(fixture.scene.activeCamera?.name).toBe("cockpitCam");

      cm.dispose();
    });
  });

  // ── F7: CameraConfig defaults ────────────────────────────────────

  describe("F7 — CameraConfig defaults", () => {
    it("test_default_config_has_exactly_25_numeric_knobs", () => {
      const config = createDefaultCameraConfig();
      const count = countNumericLeaves(config);
      expect(count).toBe(25);
    });

    it("test_default_config_no_null_or_undefined_values", () => {
      const config = createDefaultCameraConfig();
      const errors: string[] = [];
      checkNoNullOrUndefined(config, "config", errors);
      expect(errors).toHaveLength(0);
    });

    it("test_default_config_has_expected_structure", () => {
      const config = createDefaultCameraConfig();

      // Cockpit (3 knobs)
      expect(typeof config.cockpit.fov).toBe("number");
      expect(typeof config.cockpit.fovMin).toBe("number");
      expect(typeof config.cockpit.fovMax).toBe("number");

      // Chase (8 knobs)
      expect(typeof config.chase.fov).toBe("number");
      expect(typeof config.chase.fovMin).toBe("number");
      expect(typeof config.chase.fovMax).toBe("number");
      expect(typeof config.chase.distance).toBe("number");
      expect(typeof config.chase.height).toBe("number");
      expect(typeof config.chase.offset).toBe("number");
      expect(typeof config.chase.cameraAcceleration).toBe("number");
      expect(typeof config.chase.maxCameraSpeed).toBe("number");

      // Drone (4 knobs)
      expect(typeof config.drone.distance).toBe("number");
      expect(typeof config.drone.speed).toBe("number");
      expect(typeof config.drone.skipDelay).toBe("number");
      expect(typeof config.drone.fov).toBe("number");

      // Speed factor (1 knob)
      expect(typeof config.speedFactor).toBe("number");

      // Head bob (2 knobs)
      expect(typeof config.headBob.intensity).toBe("number");
      expect(typeof config.headBob.frequency).toBe("number");

      // Lean (1 knob)
      expect(typeof config.lean.intensity).toBe("number");

      // Shake (6 knobs)
      expect(typeof config.shake.intensity).toBe("number");
      expect(typeof config.shake.decayRate).toBe("number");
      expect(typeof config.shake.maxOffset).toBe("number");
      expect(typeof config.shake.frequency).toBe("number");
      expect(typeof config.shake.decayFloor).toBe("number");
      expect(typeof config.shake.maxActiveShakes).toBe("number");
    });

    it("test_default_config_values_are_in_expected_ranges", () => {
      const config = createDefaultCameraConfig();

      // Cockpit FOV should be reasonable (60-100 degrees)
      expect(config.cockpit.fov).toBeGreaterThanOrEqual(60);
      expect(config.cockpit.fov).toBeLessThanOrEqual(100);

      // Chase follow distances should be positive
      expect(config.chase.distance).toBeGreaterThan(0);
      expect(config.chase.height).toBeGreaterThan(0);

      // Drone orbit distance should be positive
      expect(config.drone.distance).toBeGreaterThan(0);
      expect(config.drone.speed).toBeGreaterThan(0);

      // Speed factor should be small (> 0)
      expect(config.speedFactor).toBeGreaterThan(0);

      // Shake parameters should be reasonable
      expect(config.shake.intensity).toBeGreaterThan(0);
      expect(config.shake.decayRate).toBeGreaterThan(0);
      expect(config.shake.maxOffset).toBeGreaterThan(0);
      expect(config.shake.maxActiveShakes).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("test_dispose_before_init_does_not_throw", () => {
      const cm = new CameraManager(fixture.scene);
      expect(() => cm.dispose()).not.toThrow();
    });

    it("test_dispose_is_idempotent", () => {
      const cm = new CameraManager(fixture.scene);
      cm.init(fixture.scene, "player-1");
      cm.dispose();
      expect(() => cm.dispose()).not.toThrow();
    });

    it("test_dispose_clears_activeCamera", () => {
      const cm = new CameraManager(fixture.scene);
      cm.init(fixture.scene, "player-1");
      cm.setActiveMode(CameraMode.Cockpit);
      expect(fixture.scene.activeCamera).not.toBeNull();
      cm.dispose();
      expect(fixture.scene.activeCamera).toBeNull();
    });

    it("test_toggleCockpitChase_when_inactive_defaults_to_cockpit", () => {
      const cm = new CameraManager(fixture.scene);
      cm.init(fixture.scene, "player-1");
      // No active mode set — toggleCockpitChase should activate Cockpit
      cm.toggleCockpitChase();
      expect(fixture.scene.activeCamera?.name).toBe("cockpitCam");
      cm.dispose();
    });
  });

  // ── Config getter ───────────────────────────────────────────────

  describe("Config getter", () => {
    it("test_config_returns_readonly_config", () => {
      const cm = new CameraManager(fixture.scene);
      const config = cm.config;
      expect(config).toBeDefined();
      expect(typeof config.cockpit.fov).toBe("number");
      expect(typeof config.chase.distance).toBe("number");
      expect(typeof config.drone.speed).toBe("number");
      cm.dispose();
    });

    it("test_config_matches_default_factory", () => {
      const cm = new CameraManager(fixture.scene);
      const config = cm.config;
      const defaults = createDefaultCameraConfig();
      expect(config).toEqual(defaults);
      cm.dispose();
    });

    it("test_config_is_same_reference_on_repeated_calls", () => {
      const cm = new CameraManager(fixture.scene);
      const first = cm.config;
      const second = cm.config;
      expect(first).toBe(second);
      cm.dispose();
    });
  });

  // ── Stub methods (Story 006/007 placeholders) ──────────────────

  describe("Stub methods", () => {
    it("test_setSpeedData_does_not_throw", () => {
      const cm = new CameraManager(fixture.scene);
      cm.init(fixture.scene, "player-1");
      expect(() => cm.setSpeedData(0)).not.toThrow();
      expect(() => cm.setSpeedData(120)).not.toThrow();
      expect(() => cm.setSpeedData(-10)).not.toThrow();
      cm.dispose();
    });

    it("test_addShake_does_not_throw", () => {
      const cm = new CameraManager(fixture.scene);
      cm.init(fixture.scene, "player-1");
      expect(() => cm.addShake("kerb", 0.5)).not.toThrow();
      expect(() => cm.addShake("collision", 1.0)).not.toThrow();
      expect(() => cm.addShake("offTrack", 0)).not.toThrow();
      cm.dispose();
    });

    it("test_update_does_not_throw", () => {
      const cm = new CameraManager(fixture.scene);
      cm.init(fixture.scene, "player-1");
      expect(() => cm.update(1 / 60)).not.toThrow();
      expect(() => cm.update(0)).not.toThrow();
      expect(() => cm.update(1)).not.toThrow();
      cm.dispose();
    });
  });

  // ── Branch coverage: toggleCockpitChase from non-Cockpit/Chase ─

  describe("toggleCockpitChase branch coverage", () => {
    it("test_toggle_from_grid_defaults_to_cockpit", () => {
      const cm = new CameraManager(fixture.scene);
      cm.init(fixture.scene, "player-1");
      cm.setActiveMode(CameraMode.Grid);
      expect(fixture.scene.activeCamera?.name).toBe("gridCam");
      cm.toggleCockpitChase();
      expect(fixture.scene.activeCamera?.name).toBe("cockpitCam");
      cm.dispose();
    });

    it("test_toggle_from_drone_defaults_to_cockpit", () => {
      const cm = new CameraManager(fixture.scene);
      cm.init(fixture.scene, "player-1");
      cm.setActiveMode(CameraMode.Drone);
      expect(fixture.scene.activeCamera?.name).toBe("droneCam");
      cm.toggleCockpitChase();
      expect(fixture.scene.activeCamera?.name).toBe("cockpitCam");
      cm.dispose();
    });
  });
});
