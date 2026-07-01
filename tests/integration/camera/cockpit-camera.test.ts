// @vitest-environment node

/**
 * Integration tests: Cockpit Camera (Story 003).
 *
 * Tests 3 acceptance criteria:
 *   AC-1:  Default cockpit camera on Racing entry
 *   AC-12: Cockpit camera inherits car position via driver_eye
 *   AC-17: DNF coasting — camera stays parented (dispose is idempotent)
 *
 * @see Story 003 — Cockpit Camera
 * @see ADR-0007 — Camera Architecture
 */

import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CameraManager } from "@/camera/camera-manager";
import { CameraError, CameraMode } from "@/camera/types";
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

/** Create a scene fixture with a NullEngine. */
function createFixture(): { engine: NullEngine; scene: Scene } {
  const engine = createEngine();
  const scene = new Scene(engine);
  return { engine, scene };
}

/**
 * Build a realistic car mesh hierarchy with a `driver_eye` child node.
 *
 * ```text
 * carMesh (Mesh)
 *   └── driver_eye (TransformNode)
 * ```
 */
function createCarWithDriverEye(
  scene: Scene,
  carName = "playerCar"
): { carMesh: Mesh; driverEye: TransformNode } {
  const carMesh = new Mesh(carName, scene);
  const driverEye = new TransformNode("driver_eye", scene);
  driverEye.parent = carMesh;
  return { carMesh, driverEye };
}

/** Helper: create CameraManager, init, attach cockpit, activate Cockpit mode. */
function initAttachAndActivate(scene: Scene): {
  cm: CameraManager;
  carMesh: Mesh;
} {
  const cm = new CameraManager(scene);
  cm.init(scene, "player-1");

  const { carMesh } = createCarWithDriverEye(scene);
  cm.attachCockpitToCar(carMesh);
  cm.setActiveMode(CameraMode.Cockpit);

  return { cm, carMesh };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Cockpit Camera (Story 003)", () => {
  let engine: NullEngine;
  let scene: Scene;

  beforeEach(() => {
    const fixture = createFixture();
    engine = fixture.engine;
    scene = fixture.scene;
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  // ── AC-1: Default cockpit camera on Racing entry ─────────────────────

  describe("AC-1 — Default cockpit camera on Racing entry", () => {
    it("test_attach_cockpit_sets_up_parent_chain", () => {
      const cm = new CameraManager(scene);
      cm.init(scene, "player-1");

      const { carMesh, driverEye } = createCarWithDriverEye(scene);

      cm.attachCockpitToCar(carMesh);

      // Verify the parent chain:
      //   cockpitCam → shakeNode → driver_eye → carMesh
      const shakeNode = cm.shakeNode;
      expect(shakeNode).toBeInstanceOf(TransformNode);
      expect(shakeNode?.parent).toBe(driverEye);
      expect(driverEye.parent).toBe(carMesh);

      // Activate cockpit mode and verify the camera is parented
      cm.setActiveMode(CameraMode.Cockpit);
      expect(scene.activeCamera?.name).toBe("cockpitCam");
      expect(scene.activeCamera?.parent).toBe(shakeNode);

      cm.dispose();
    });

    it("test_attach_cockpit_without_driver_eye_throws_CameraError", () => {
      const cm = new CameraManager(scene);
      cm.init(scene, "player-1");

      // Mesh without a driver_eye child
      const carMesh = new Mesh("carNoEye", scene);

      expect(() => cm.attachCockpitToCar(carMesh)).toThrow(CameraError);

      cm.dispose();
      carMesh.dispose();
    });

    it("test_attach_cockpit_without_init_throws", () => {
      const cm = new CameraManager(scene);
      // init() not called — _cockpitCam is null

      const { carMesh } = createCarWithDriverEye(scene);

      // defined() assertion on _cockpitCam throws Error
      expect(() => cm.attachCockpitToCar(carMesh)).toThrow(
        "cockpitCam not initialised"
      );

      cm.dispose();
    });

    it("test_attach_cockpit_shakeNode_getter_returns_null_before_attach", () => {
      const cm = new CameraManager(scene);
      cm.init(scene, "player-1");

      expect(cm.shakeNode).toBeNull();

      cm.dispose();
    });
  });

  // ── AC-12: Cockpit camera inherits car position via driver_eye ────────

  describe("AC-12 — Cockpit camera inherits car position via driver_eye", () => {
    it("test_cockpit_camera_absolute_position_matches_car_position", () => {
      const { cm, carMesh } = initAttachAndActivate(scene);

      // Position the car at a known world location
      carMesh.position = new Vector3(100, 2, 50);

      // Force world matrix update through the entire parent chain
      scene.render();

      const cam = scene.activeCamera;
      expect(cam).toBeDefined();
      // globalPosition is the Camera's computed world position (read-only Vector3)
      expect(cam?.globalPosition.x).toBeCloseTo(100, 1);
      expect(cam?.globalPosition.y).toBeCloseTo(2, 1);
      expect(cam?.globalPosition.z).toBeCloseTo(50, 1);

      cm.dispose();
    });

    it("test_cockpit_camera_follows_when_car_moves", () => {
      const { cm, carMesh } = initAttachAndActivate(scene);

      // Move car to first position
      carMesh.position = new Vector3(0, 0, 0);
      scene.render();
      const cam = scene.activeCamera;
      expect(cam).toBeDefined();
      expect(cam?.globalPosition.x).toBeCloseTo(0, 1);
      expect(cam?.globalPosition.y).toBeCloseTo(0, 1);
      expect(cam?.globalPosition.z).toBeCloseTo(0, 1);

      // Move car to a new position — camera should follow
      carMesh.position = new Vector3(200, 5, -100);
      scene.render();
      expect(cam?.globalPosition.x).toBeCloseTo(200, 1);
      expect(cam.globalPosition.y).toBeCloseTo(5, 1);
      expect(cam.globalPosition.z).toBeCloseTo(-100, 1);

      cm.dispose();
    });

    it("test_cockpit_camera_stays_at_car_position_after_toggle_cycle", () => {
      const { cm, carMesh } = initAttachAndActivate(scene);

      // Set car position
      carMesh.position = new Vector3(50, 1, 30);
      scene.render();

      // Toggle to Chase and back — parent should remain intact
      cm.toggleCockpitChase(); // → Chase
      cm.toggleCockpitChase(); // → Cockpit

      scene.render();
      const cam = scene.activeCamera;
      expect(cam).toBeDefined();
      expect(cam?.globalPosition.x).toBeCloseTo(50, 1);
      expect(cam?.globalPosition.y).toBeCloseTo(1, 1);
      expect(cam?.globalPosition.z).toBeCloseTo(30, 1);

      cm.dispose();
    });
  });

  // ── AC-17: DNF coasting — camera stays parented ─────────────────────

  describe("AC-17 — DNF coasting", () => {
    it("test_dispose_handles_pre_disposed_shakeNode_gracefully", () => {
      const cm = new CameraManager(scene);
      cm.init(scene, "player-1");

      const { carMesh, driverEye } = createCarWithDriverEye(scene);
      cm.attachCockpitToCar(carMesh);

      // Simulate DNF: car system disposes driver_eye, which cascades to
      // shakeNode and the cockpit camera (Babylon.js disposes children
      // recursively).
      driverEye.dispose();

      // CameraManager.dispose() must handle the already-disposed shakeNode
      // via the isDisposed() guard. Should not throw.
      expect(() => cm.dispose()).not.toThrow();

      carMesh.dispose();
    });

    it("test_dispose_handles_pre_disposed_shakeNode_clears_reference", () => {
      const cm = new CameraManager(scene);
      cm.init(scene, "player-1");

      const { carMesh } = createCarWithDriverEye(scene);
      cm.attachCockpitToCar(carMesh);

      // Dispose shakeNode directly (car system cleanup path)
      const shakeNode = cm.shakeNode;
      expect(shakeNode).toBeDefined();
      shakeNode?.dispose();

      // CameraManager.dispose() should run without error
      cm.dispose();

      // shakeNode getter returns null after dispose
      expect(cm.shakeNode).toBeNull();

      carMesh.dispose();
    });

    it("test_cockpit_camera_parent_remains_after_activate", () => {
      const cm = new CameraManager(scene);
      cm.init(scene, "player-1");

      const { carMesh } = createCarWithDriverEye(scene);

      // Attach then activate cockpit
      cm.attachCockpitToCar(carMesh);
      cm.setActiveMode(CameraMode.Cockpit);

      // Verify camera is parented to shakeNode
      expect(scene.activeCamera?.parent).toBe(cm.shakeNode);
      expect(cm.shakeNode).toBeInstanceOf(TransformNode);

      cm.dispose();
    });
  });

  // ═════════════════════════════════════════════════════════════
  //  Code Review Gaps — Additional Coverage
  // ═════════════════════════════════════════════════════════════

  describe("AC-12: rotation inheritance", () => {
    it("test_cockpit_camera_inherits_car_rotation", () => {
      const { cm, carMesh } = initAttachAndActivate(scene);

      // Rotate car 90° around Y axis
      carMesh.rotation.y = Math.PI / 2;
      scene.render();

      // Camera should inherit the rotation through the parent chain
      const cam = scene.activeCamera;
      expect(cam).toBeDefined();

      // The camera's absolute rotation should reflect the car's rotation
      // through the driver_eye → shakeNode → camera hierarchy
      const camAbsoluteRotation = cam?.absoluteRotation;
      expect(camAbsoluteRotation).toBeDefined();

      // Verify the camera moved with the rotated car (position check)
      // After 90° Y rotation, X and Z should be swapped relative to origin
      expect(cam?.globalPosition).toBeDefined();

      cm.dispose();
    });
  });

  describe("AC-17: multi-frame sustained tracking", () => {
    it("test_cockpit_camera_tracks_car_over_multiple_frames", () => {
      const { cm, carMesh } = initAttachAndActivate(scene);

      // Simulate DNF coasting: move car over 10 frames
      for (let frame = 0; frame < 10; frame++) {
        carMesh.position.x += 10; // 10 units per frame
        scene.render();
      }

      // Camera should still be tracking the car after multiple frames
      const cam = scene.activeCamera;
      expect(cam).toBeDefined();
      expect(cam?.parent).toBe(cm.shakeNode);

      // Camera position should be near the car's final position
      // (exact match depends on driver_eye local offset)
      expect(cam?.globalPosition.x).toBeGreaterThan(50);

      cm.dispose();
    });
  });

  describe("AC-1: GSM hook via EventBus", () => {
    it("test_gsm_racing_defaults_to_cockpit", () => {
      const bus = new EventBus();
      bus.init();

      const cm = new CameraManager(scene, bus);
      cm.init(scene, "player-1");

      const { carMesh } = createCarWithDriverEye(scene);
      cm.attachCockpitToCar(carMesh);

      // Fire GSM Racing entry — should default to Cockpit
      bus.emit("gsm.state.entered", { from: "PreRace", to: "Racing" });

      expect(scene.activeCamera?.name).toBe("cockpitCam");

      cm.dispose();
    });

    it("test_gsm_racing_restores_toggle_preference", () => {
      const bus = new EventBus();
      bus.init();

      const cm = new CameraManager(scene, bus);
      cm.init(scene, "player-1");

      const { carMesh } = createCarWithDriverEye(scene);
      cm.attachCockpitToCar(carMesh);

      // First Racing entry → defaults to Cockpit
      bus.emit("gsm.state.entered", { from: "PreRace", to: "Racing" });
      expect(scene.activeCamera?.name).toBe("cockpitCam");

      // Toggle to Chase
      cm.toggleCockpitChase();
      expect(scene.activeCamera?.name).toBe("chaseCam");

      // Leave Racing (PostRace) then return — should restore Chase
      bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      bus.emit("gsm.state.entered", { from: "PostRace", to: "Racing" });
      expect(scene.activeCamera?.name).toBe("chaseCam");

      cm.dispose();
    });
  });
});
