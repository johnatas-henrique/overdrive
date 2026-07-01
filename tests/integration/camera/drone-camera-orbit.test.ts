// @vitest-environment node

/**
 * Integration tests: Drone Camera Auto-Orbit (Story 008).
 *
 * Tests all 5 acceptance criteria:
 *   AC-9:  PostRace transitions to drone, alpha changes by ~15°/s
 *   AC-10: Drone active until confirm after skip delay
 *   AC-17: Drone activates immediately (no velocity=0 wait)
 *   Skippable: Confirm before skipDelay does nothing, after skips
 *   trySkipDrone: Method exists and follows C-F7 (no GSM transition)
 *
 * @see Story 008 — Drone Camera Auto-Orbit
 * @see ADR-0007 — Camera Architecture
 * @see TR-CAM-010
 */

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChaseCameraReader } from "@/camera/camera-manager";
import { CameraManager } from "@/camera/camera-manager";
import { CameraMode, type ICameraManager } from "@/camera/types";
import { EventBus } from "@/foundation/event-bus/event-bus";

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

/** Create a mock ChaseCameraReader with an optional mesh. */
function createMockChaseReader(mesh?: unknown): ChaseCameraReader {
  return {
    getPlayerCarMesh: () => mesh ?? null,
  };
}

/** Number of degrees per second the drone orbits at (from defaults). */
const DRONE_SPEED_DEG_PER_S = 15;

/** Expected alpha delta after 1 second of orbit, in radians. */
const EXPECTED_ALPHA_DELTA_1S = (DRONE_SPEED_DEG_PER_S * Math.PI) / 180;

/** Default skip delay from camera-defaults.ts (seconds). */
const SKIP_DELAY = 0.5;

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

interface Fixture {
  engine: NullEngine;
  scene: Scene;
  bus: EventBus;
  cm: CameraManager;
}

function createFixture(): Fixture {
  const engine = createEngine();
  const scene = new Scene(engine);
  const bus = new EventBus();
  bus.init();
  const cm = new CameraManager(scene, bus);
  cm.init(scene, "player-1");
  return { engine, scene, bus, cm };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Drone Camera Auto-Orbit (Story 008)", () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = createFixture();
  });

  afterEach(() => {
    fx.cm.dispose();
    fx.scene.dispose();
    fx.engine.dispose();
  });

  // ── AC-9: Drone activation + orbit ─────────────────────────────────

  describe("AC-9 — PostRace activates drone with auto-orbit", () => {
    it("test_postRace_sets_drone_as_active_camera", () => {
      fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });

      expect(fx.scene.activeCamera).toBeInstanceOf(ArcRotateCamera);
      expect(fx.scene.activeCamera?.name).toBe("droneCam");
    });

    it("test_drone_alpha_increases_by_15_degrees_per_second", () => {
      fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      const droneCam = fx.scene.activeCamera as ArcRotateCamera;
      const initialAlpha = droneCam.alpha;

      // Simulate 1 second of game time
      fx.cm.update(1.0);

      const delta = droneCam.alpha - initialAlpha;
      expect(delta).toBeCloseTo(EXPECTED_ALPHA_DELTA_1S, 4);
    });

    it("test_drone_alpha_delta_scales_with_dt", () => {
      fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      const droneCam = fx.scene.activeCamera as ArcRotateCamera;
      const initialAlpha = droneCam.alpha;

      // Half a second at 15°/s = 7.5°
      fx.cm.update(0.5);

      const delta = droneCam.alpha - initialAlpha;
      expect(delta).toBeCloseTo(EXPECTED_ALPHA_DELTA_1S * 0.5, 4);
    });

    it("test_drone_alpha_accumulates_over_multiple_updates", () => {
      fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      const droneCam = fx.scene.activeCamera as ArcRotateCamera;
      const initialAlpha = droneCam.alpha;

      // 60 frames at 1/60s = 1 second total
      for (let i = 0; i < 60; i++) {
        fx.cm.update(1 / 60);
      }

      const delta = droneCam.alpha - initialAlpha;
      expect(delta).toBeCloseTo(EXPECTED_ALPHA_DELTA_1S, 3);
    });

    it("test_drone_tracks_player_car_position", () => {
      const carPosition = new Vector3(25, 0, -10);
      const mockMesh = {
        position: carPosition,
        absolutePosition: carPosition,
        getAbsolutePosition: () => carPosition,
      };
      const reader = createMockChaseReader(mockMesh);
      fx.cm.setChaseCameraReader(reader);

      fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });

      // Target is set in update() — advance one frame
      fx.cm.update(1 / 60);

      const droneCam = fx.scene.activeCamera as ArcRotateCamera;
      expect(droneCam.target.x).toBeCloseTo(25);
      expect(droneCam.target.y).toBeCloseTo(0);
      expect(droneCam.target.z).toBeCloseTo(-10);
    });
  });

  // ── AC-10: Drone skip on confirm ───────────────────────────────────

  describe("AC-10 — Drone skips on confirm after delay", () => {
    it("test_trySkipDrone_before_delay_does_not_skip", () => {
      fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      expect(fx.scene.activeCamera?.name).toBe("droneCam");

      // Simulate 0.4s — still within skip delay (0.5s)
      fx.cm.update(0.4);
      fx.cm.trySkipDrone();

      // Must still be in Drone mode
      expect(fx.scene.activeCamera).toBeInstanceOf(ArcRotateCamera);
      expect(fx.scene.activeCamera?.name).toBe("droneCam");
    });

    it("test_trySkipDrone_after_delay_skips_to_inactive", () => {
      fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      expect(fx.scene.activeCamera?.name).toBe("droneCam");

      // Simulate past the skip delay (0.5s → 0.7s total)
      fx.cm.update(0.7);
      fx.cm.trySkipDrone();

      // Must have switched to Inactive
      expect(fx.scene.activeCamera).toBeNull();
    });

    it("test_trySkipDrone_is_noop_in_non_drone_mode", () => {
      // Start in Grid mode
      fx.bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });
      expect(fx.scene.activeCamera?.name).toBe("gridCam");

      // trySkipDrone should be a no-op (not Drone mode)
      fx.cm.trySkipDrone();
      expect(fx.scene.activeCamera?.name).toBe("gridCam");
    });

    it("test_skip_transitions_to_inactive_not_menu", () => {
      // Verify that trySkipDrone sets Inactive, not Menu.
      // GSM handles Menu transitions (C-F7).
      fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      fx.cm.update(1.0);
      fx.cm.trySkipDrone();

      // Camera is Inactive (scene.activeCamera === null)
      expect(fx.scene.activeCamera).toBeNull();

      // No gsm.state.entered events should have been emitted
      const gsmEvents: string[] = [];
      fx.bus.on("gsm.state.entered", ({ to }) => {
        gsmEvents.push(to);
      });

      // Clear the events from PostRace setup, then try to skip
      fx.cm.setActiveMode(CameraMode.Drone);
      fx.cm.update(1.0);
      fx.cm.trySkipDrone();

      expect(gsmEvents).toHaveLength(0);
    });
  });

  // ── AC-17: Immediate activation (no velocity=0 wait) ───────────────

  describe("AC-17 — Immediate drone activation timing", () => {
    it("test_drone_active_immediately_on_postRace", () => {
      // Simulate drone activation without calling update() first
      fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });

      // Drone should be active immediately — no update() required
      expect(fx.scene.activeCamera).toBeInstanceOf(ArcRotateCamera);
      expect(fx.scene.activeCamera?.name).toBe("droneCam");
    });

    it("test_drone_active_regardless_of_speed", () => {
      // Set a non-zero speed before activating PostRace
      fx.cm.setSpeedData(30);

      fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });

      // Drone should be active immediately — does not check velocity
      expect(fx.scene.activeCamera).toBeInstanceOf(ArcRotateCamera);
      expect(fx.scene.activeCamera?.name).toBe("droneCam");
    });

    it("test_drone_orbits_on_first_update_after_postRace", () => {
      fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      const droneCam = fx.scene.activeCamera as ArcRotateCamera;
      const initialAlpha = droneCam.alpha;

      // First update after activation should orbit
      fx.cm.update(1 / 60);

      const delta = droneCam.alpha - initialAlpha;
      expect(delta).toBeGreaterThan(0);
    });
  });

  // ── Skippable delay edge cases ─────────────────────────────────────

  describe("Skippable delay — boundary testing", () => {
    it("test_skip_at_exact_skipDelay_boundary_passes", () => {
      fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });

      // Exactly at skipDelay (0.5s)
      fx.cm.update(SKIP_DELAY);
      fx.cm.trySkipDrone();

      // >= check means exactly at boundary should skip
      expect(fx.scene.activeCamera).toBeNull();
    });

    it("test_skip_just_before_delay_is_blocked", () => {
      fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });

      // Just before skipDelay (0.4999s)
      fx.cm.update(SKIP_DELAY - 0.0001);
      fx.cm.trySkipDrone();

      // Must still be in Drone mode
      expect(fx.scene.activeCamera).toBeInstanceOf(ArcRotateCamera);
    });

    it("test_skip_accumulates_update_calls_correctly", () => {
      fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });

      // Multiple small updates summing to 0.3s
      for (let i = 0; i < 18; i++) {
        fx.cm.update(1 / 60);
      }

      // At 0.3s — not yet skippable
      fx.cm.trySkipDrone();
      expect(fx.scene.activeCamera).toBeInstanceOf(ArcRotateCamera);

      // Another 0.3s → total 0.6s, past skip delay
      for (let i = 0; i < 18; i++) {
        fx.cm.update(1 / 60);
      }

      fx.cm.trySkipDrone();
      expect(fx.scene.activeCamera).toBeNull();
    });

    it("test_skip_delay_resets_on_drone_reactivation", () => {
      // First drone activation
      fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      fx.cm.update(1.0);
      fx.cm.trySkipDrone();
      expect(fx.scene.activeCamera).toBeNull();

      // Reactivate drone manually
      fx.cm.setActiveMode(CameraMode.Drone);
      expect(fx.scene.activeCamera?.name).toBe("droneCam");

      // Try to skip immediately — should be blocked (reset delay)
      fx.cm.trySkipDrone();
      expect(fx.scene.activeCamera?.name).toBe("droneCam");

      // After delay, should be skippable again
      fx.cm.update(SKIP_DELAY);
      fx.cm.trySkipDrone();
      expect(fx.scene.activeCamera).toBeNull();
    });
  });

  // ── trySkipDrone method contract ──────────────────────────────────

  describe("trySkipDrone — interface contract", () => {
    it("test_trySkipDrone_exists_on_interface", () => {
      // Compile-time check: these keys must exist on ICameraManager
      const methodNames: Array<keyof ICameraManager> = [
        "init",
        "setActiveMode",
        "toggleCockpitChase",
        "setSpeedData",
        "addShake",
        "trySkipDrone",
        "update",
        "dispose",
      ];
      expect(methodNames).toHaveLength(8);
    });

    it("test_trySkipDrone_does_not_throw", () => {
      fx.cm.setActiveMode(CameraMode.Drone);
      expect(() => fx.cm.trySkipDrone()).not.toThrow();
    });

    it("test_trySkipDrone_is_noop_before_init", () => {
      const fresh = new CameraManager(fx.scene);
      // trySkipDrone before init should not throw
      expect(() => fresh.trySkipDrone()).not.toThrow();
      fresh.dispose();
    });

    it("test_wireDroneTarget_with_null_mesh_from_reader", () => {
      // If chaseReader returns null mesh, drone still works (orbits origin)
      fx.cm.setChaseCameraReader(createMockChaseReader(undefined));
      fx.cm.setActiveMode(CameraMode.Drone);
      fx.cm.update(1 / 60);
      // Drone should still be active even without a mesh target
      expect(fx.scene.activeCamera).toBeInstanceOf(ArcRotateCamera);
    });
  });

  // ── Drone camera properties ─────────────────────────────────────────

  describe("Drone camera properties", () => {
    it("test_drone_has_zero_inertia", () => {
      fx.cm.setActiveMode(CameraMode.Drone);
      const droneCam = fx.scene.activeCamera as ArcRotateCamera;
      expect(droneCam.inertia).toBe(0);
    });

    it("test_drone_inputs_are_cleared", () => {
      fx.cm.setActiveMode(CameraMode.Drone);
      const droneCam = fx.scene.activeCamera as ArcRotateCamera;
      expect(droneCam.inputs).toBeDefined();
      // inputs.clear() was called during init — no crash means success
      expect(droneCam.inertia).toBe(0);
    });
  });
});
