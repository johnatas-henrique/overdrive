// @vitest-environment node

/**
 * Integration tests: GSM-Driven Camera Lifecycle (Story 002).
 *
 * Tests all 5 acceptance criteria for GSM-driven camera transitions:
 *   AC-7: Grid camera positioned at (trackCenter.x, 30, trackCenter.z - 40)
 *   AC-8: PreRace grid camera active until GSM transitions to Racing
 *   Transition sequence: Inactive → Grid → Cockpit/Chase → Drone → Inactive
 *   Never calls gsm.transition()
 *   Racing preserves toggle choice
 *
 * @see Story 002 — GSM-Driven Camera Lifecycle
 * @see ADR-0007 — Camera Architecture
 * @see TR-CAM-007
 */

import type { FollowCamera } from "@babylonjs/core/Cameras/followCamera";
import type { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  ChaseCameraReader,
  GridCameraReader,
} from "@/camera/camera-manager";
import { CameraManager } from "@/camera/camera-manager";
import { CameraMode } from "@/camera/types";
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

/** Create a mock GridCameraReader with configurable positions. */
function createMockGridReader(
  trackCenter = new Vector3(0, 0, 0),
  firstCar = new Vector3(-5, 0, 0),
  lastCar = new Vector3(5, 0, 0)
): GridCameraReader {
  return {
    getTrackCenter: () => trackCenter,
    getFirstCarPosition: () => firstCar,
    getLastCarPosition: () => lastCar,
  };
}

/** Create a mock ChaseCameraReader. */
function createMockChaseReader(): ChaseCameraReader {
  return {
    getPlayerCarMesh: () => null,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("GSM Camera Lifecycle (Story 002)", () => {
  let engine: NullEngine;
  let scene: Scene;
  let bus: EventBus;
  let cm: CameraManager;

  beforeEach(() => {
    engine = createEngine();
    scene = new Scene(engine);
    bus = new EventBus();
    bus.init();
    cm = new CameraManager(scene, bus);
    cm.init(scene, "player-1");
  });

  afterEach(() => {
    cm.dispose();
    scene.dispose();
    engine.dispose();
  });

  // ── Transition sequence (AC) ───────────────────────────────────────

  describe("Transition sequence", () => {
    it("test_preRace_emits_entered_sets_grid", () => {
      bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });
      expect(scene.activeCamera?.name).toBe("gridCam");
    });

    it("test_racing_emits_entered_sets_cockpit_by_default", () => {
      bus.emit("gsm.state.entered", { from: "PreRace", to: "Racing" });
      expect(scene.activeCamera?.name).toBe("cockpitCam");
    });

    it("test_postRace_emits_entered_sets_drone", () => {
      bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      expect(scene.activeCamera?.name).toBe("droneCam");
    });

    it("test_menu_emits_entered_sets_inactive", () => {
      bus.emit("gsm.state.entered", { from: "PostRace", to: "Menu" });
      expect(scene.activeCamera).toBeNull();
    });

    it("test_loading_emits_entered_sets_inactive", () => {
      bus.emit("gsm.state.entered", { from: "Menu", to: "Loading" });
      expect(scene.activeCamera).toBeNull();
    });

    it("test_full_lifecycle_menu_to_menu", () => {
      // Menu → PreRace → Racing → PostRace → Menu
      bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });
      expect(scene.activeCamera?.name).toBe("gridCam");

      bus.emit("gsm.state.entered", { from: "PreRace", to: "Racing" });
      expect(scene.activeCamera?.name).toBe("cockpitCam");

      bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      expect(scene.activeCamera?.name).toBe("droneCam");

      bus.emit("gsm.state.entered", { from: "PostRace", to: "Menu" });
      expect(scene.activeCamera).toBeNull();
    });
  });

  // ── AC-8: Grid camera active until Racing ──────────────────────────

  describe("AC-8 — Grid until Racing", () => {
    it("test_grid_remains_active_until_racing", () => {
      bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });
      expect(scene.activeCamera?.name).toBe("gridCam");

      // Paused should preserve grid camera
      bus.emit("gsm.state.entered", { from: "PreRace", to: "Paused" });
      expect(scene.activeCamera?.name).toBe("gridCam");

      // Back to PreRace — still grid
      bus.emit("gsm.state.entered", { from: "Paused", to: "PreRace" });
      expect(scene.activeCamera?.name).toBe("gridCam");

      // Racing switches away from grid
      bus.emit("gsm.state.entered", { from: "PreRace", to: "Racing" });
      expect(scene.activeCamera?.name).toBe("cockpitCam");
    });
  });

  // ── AC-7: Grid camera positioning ─────────────────────────────────

  describe("AC-7 — Grid camera positioning", () => {
    it("test_grid_camera_positions_via_reader", () => {
      const reader = createMockGridReader(
        new Vector3(10, 0, 20), // track center
        new Vector3(5, 0, 20), // first car
        new Vector3(15, 0, 20) // last car
      );
      cm.setGridCameraReader(reader);

      bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });

      const cam = scene.activeCamera;
      expect(cam?.name).toBe("gridCam");
      expect(cam?.position.x).toBeCloseTo(10); // trackCenter.x
      expect(cam?.position.y).toBeCloseTo(30); // fixed height
      expect(cam?.position.z).toBeCloseTo(-20); // trackCenter.z - 40
    });

    it("test_grid_camera_look_at_midpoint", () => {
      const reader = createMockGridReader(
        new Vector3(0, 0, 0),
        new Vector3(-10, 0, 0), // first car
        new Vector3(10, 0, 0) // last car
      );
      cm.setGridCameraReader(reader);

      bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });

      const cam = scene.activeCamera as FreeCamera;
      expect(cam.name).toBe("gridCam");
      // Midpoint between (-10,0,0) and (10,0,0) is (0,0,0)
      expect(cam.target.x).toBeCloseTo(0);
      expect(cam.target.y).toBeCloseTo(0);
      expect(cam.target.z).toBeCloseTo(0);
    });

    it("test_grid_camera_fallback_without_reader", () => {
      // No reader set — grid camera stays at default position
      bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });

      const cam = scene.activeCamera;
      expect(cam?.name).toBe("gridCam");
      expect(cam?.position.y).toBeCloseTo(30);
    });
  });

  // ── Toggle choice persistence ─────────────────────────────────────

  describe("Toggle choice persistence", () => {
    it("test_racing_restores_last_toggle_choice", () => {
      // First entry → Cockpit (default)
      bus.emit("gsm.state.entered", { from: "PreRace", to: "Racing" });
      expect(scene.activeCamera?.name).toBe("cockpitCam");

      // Toggle to Chase
      cm.toggleCockpitChase();
      expect(scene.activeCamera?.name).toBe("chaseCam");

      // Exit to PostRace
      bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      expect(scene.activeCamera?.name).toBe("droneCam");

      // Re-enter Racing → should restore Chase
      bus.emit("gsm.state.entered", { from: "PostRace", to: "Racing" });
      expect(scene.activeCamera?.name).toBe("chaseCam");
    });

    it("test_first_racing_entry_defaults_to_cockpit", () => {
      bus.emit("gsm.state.entered", { from: "PreRace", to: "Racing" });
      expect(scene.activeCamera?.name).toBe("cockpitCam");
    });

    it("test_toggle_persists_across_race_restarts", () => {
      // Race 1: toggle to Chase
      bus.emit("gsm.state.entered", { from: "PreRace", to: "Racing" });
      cm.toggleCockpitChase();
      expect(scene.activeCamera?.name).toBe("chaseCam");

      // PostRace → Menu → PreRace → Racing
      bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      bus.emit("gsm.state.entered", { from: "PostRace", to: "Menu" });
      bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });
      bus.emit("gsm.state.entered", { from: "PreRace", to: "Racing" });

      // Should restore Chase from race 1
      expect(scene.activeCamera?.name).toBe("chaseCam");
    });
  });

  // ── Never calls gsm.transition() ──────────────────────────────────

  describe("Never calls gsm.transition()", () => {
    it("test_no_gsm_transition_calls", () => {
      // Verify CameraManager never emits gsm.state.entered events itself.
      // It should only CONSUME events, not produce them.
      const received: string[] = [];
      bus.on("gsm.state.entered", ({ to }) => {
        received.push(to);
      });

      // Emit transitions — CameraManager should not add extra events
      bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });
      bus.emit("gsm.state.entered", { from: "PreRace", to: "Racing" });
      bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      bus.emit("gsm.state.entered", { from: "PostRace", to: "Menu" });

      // Only the 4 emitted events should have fired — no extras from CameraManager
      expect(received).toEqual(["PreRace", "Racing", "PostRace", "Menu"]);
    });

    it("test_toggle_does_not_emit_gsm_events", () => {
      const received: string[] = [];
      bus.on("gsm.state.entered", ({ to }) => {
        received.push(to);
      });

      // Activate Racing, then toggle multiple times
      bus.emit("gsm.state.entered", { from: "PreRace", to: "Racing" });
      received.length = 0; // clear setup events

      cm.toggleCockpitChase();
      cm.toggleCockpitChase();
      cm.toggleCockpitChase();

      // No gsm.state.entered events should have been emitted by toggle
      expect(received).toHaveLength(0);
    });
  });

  // ── Paused state preserves camera ─────────────────────────────────

  describe("Paused state", () => {
    it("test_paused_preserves_active_camera", () => {
      bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });
      expect(scene.activeCamera?.name).toBe("gridCam");

      bus.emit("gsm.state.entered", { from: "PreRace", to: "Paused" });
      // Paused preserves the current active camera (freeze view)
      expect(scene.activeCamera?.name).toBe("gridCam");
    });
  });

  // ── Unknown state handling ─────────────────────────────────────────

  describe("Unknown state", () => {
    it("test_unknown_state_sets_inactive", () => {
      bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });
      expect(scene.activeCamera?.name).toBe("gridCam");

      bus.emit("gsm.state.entered", { from: "PreRace", to: "SomeFutureState" });
      expect(scene.activeCamera).toBeNull();
    });
  });

  // ── Chase camera reader ───────────────────────────────────────────

  describe("Chase camera reader", () => {
    it("test_chase_reader_wired_on_activation", () => {
      const reader = createMockChaseReader();
      cm.setChaseCameraReader(reader);

      bus.emit("gsm.state.entered", { from: "PreRace", to: "Racing" });
      expect(scene.activeCamera?.name).toBe("cockpitCam");

      // Toggle to Chase
      cm.toggleCockpitChase();
      expect(scene.activeCamera?.name).toBe("chaseCam");
    });

    it("test_chase_reader_with_mesh_sets_locked_target", () => {
      // Create a mock mesh that FollowCamera can accept
      const mockMesh = {
        position: new Vector3(0, 0, 0),
        getAbsolutePosition: () => new Vector3(0, 0, 0),
      };
      const reader: ChaseCameraReader = {
        getPlayerCarMesh: () => mockMesh,
      };
      cm.setChaseCameraReader(reader);

      bus.emit("gsm.state.entered", { from: "PreRace", to: "Racing" });
      cm.toggleCockpitChase();

      // Verify lockedTarget was set (not just camera name)
      const chaseCam = scene.activeCamera as FollowCamera;
      expect(chaseCam.name).toBe("chaseCam");
      expect(chaseCam.lockedTarget).toBe(mockMesh);
    });
  });

  // ── EventBus lifecycle ────────────────────────────────────────────

  describe("EventBus lifecycle", () => {
    it("test_dispose_unsubscribes_from_bus", () => {
      const cm2 = new CameraManager(scene, bus);
      cm2.init(scene, "player-2");

      // Should work before dispose
      bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });
      expect(scene.activeCamera?.name).toBe("gridCam");

      cm2.dispose();

      // After dispose, events should not crash (handlers removed)
      expect(() =>
        bus.emit("gsm.state.entered", { from: "PreRace", to: "Racing" })
      ).not.toThrow();
    });

    it("test_no_eventbus_still_works", () => {
      const cmNoBus = new CameraManager(scene);
      cmNoBus.init(scene, "player-3");

      // Manual mode switching still works
      cmNoBus.setActiveMode(CameraMode.Grid);
      expect(scene.activeCamera?.name).toBe("gridCam");

      cmNoBus.dispose();
    });
  });
});
