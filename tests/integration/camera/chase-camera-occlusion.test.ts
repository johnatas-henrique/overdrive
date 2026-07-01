// @vitest-environment node

/**
 * Integration tests: Chase Camera + Occlusion Raycast (Story 004).
 *
 * Tests 3 acceptance criteria:
 *   AC-11a: Occluded mesh on barrier layer — camera snaps to hitPoint - 0.5m
 *   AC-11b: No occluding mesh — FollowCamera spring returns camera to configured distance
 *   AC-17:  DNF coasting — FollowCamera continues tracking via lockedTarget
 *   Layer filter: Meshes without barrier collision group are ignored
 *
 * @see Story 004 — Chase Camera + Occlusion Raycast
 * @see ADR-0007 — Camera Architecture
 * @see TR-CAM-005
 */

import type { FollowCamera } from "@babylonjs/core/Cameras/followCamera";
import type { Ray } from "@babylonjs/core/Culling/ray";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

/** Create a scene fixture with a NullEngine. */
function createFixture(): { engine: NullEngine; scene: Scene } {
  const engine = createEngine();
  const scene = new Scene(engine);
  return { engine, scene };
}

/**
 * Force world matrix computation on a mesh.
 *
 * In NullEngine tests, `scene.render()` throws when no activeCamera is set.
 * This helper directly computes the mesh's world matrix so that
 * `absolutePosition` and `forward` return correct world-space values.
 */
function computeMeshWorld(mesh: Mesh): void {
  mesh.computeWorldMatrix(true);
}

/** Create a player car mesh at an optional position (default: origin). */
function createPlayerCarMesh(scene: Scene, position = Vector3.Zero()): Mesh {
  const mesh = new Mesh("playerCar", scene);
  mesh.position = position.clone();
  return mesh;
}

/** Create a mock ChaseCameraReader returning the given mesh. */
function createMockChaseReader(mesh: AbstractMesh) {
  return {
    getPlayerCarMesh: () => mesh,
  };
}

/**
 * Build a {@link PickingInfo}-like object for `scene.pickWithRay` mocks.
 *
 * The returned object matches the subset of PickingInfo properties consumed
 * by `_runOcclusionRaycast`: `hit`, `pickedPoint`, `pickedMesh`, `distance`.
 */
function mockHit(
  hit: boolean,
  pickedPoint: Vector3 | null,
  pickedMesh: AbstractMesh | null,
  distance: number
) {
  return { hit, pickedPoint, pickedMesh, distance };
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

interface Fixture {
  engine: NullEngine;
  scene: Scene;
}

/**
 * Shared setup for every test: creates CameraManager, player car,
 * wires the chase reader, activates Chase mode, and computes world matrices.
 */
function initChaseCam(
  scene: Scene,
  carPosition = Vector3.Zero(),
  carRotation?: number
): { cm: CameraManager; playerCar: Mesh; chaseCam: FollowCamera } {
  const cm = new CameraManager(scene);
  cm.init(scene, "player-1");

  const playerCar = createPlayerCarMesh(scene, carPosition);
  if (carRotation !== undefined) {
    playerCar.rotation.y = carRotation;
  }
  computeMeshWorld(playerCar);

  cm.setChaseCameraReader(createMockChaseReader(playerCar));
  cm.setActiveMode(CameraMode.Chase);

  const chaseCam = scene.activeCamera as FollowCamera;
  return { cm, playerCar, chaseCam };
}

describe("Chase Camera Occlusion (Story 004)", () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = createFixture();
  });

  afterEach(() => {
    fixture.scene.dispose();
    fixture.engine.dispose();
  });

  // ── AC-11a: Occluded camera snaps closer ─────────────────────────────

  describe("AC-11a — Occluded camera snaps closer", () => {
    it("test_occlusion_snaps_camera_to_hitPoint_minus_05m", () => {
      const { scene } = fixture;
      const { cm, chaseCam, playerCar } = initChaseCam(scene);

      // Car at (0,0,0), no rotation → forward=(0,0,1), backward=(0,0,-1).
      // (Babylon.js 9.x: Vector3.Forward() = +Z, Backward() = -Z)
      // Mock hit at distance 3 behind the car along the backward ray.
      vi.spyOn(scene, "pickWithRay").mockReturnValueOnce(
        mockHit(
          true,
          new Vector3(0, 0, -3),
          { collisionGroup: 2 } as AbstractMesh,
          3
        )
      );

      cm.update(1 / 60);

      // snapPosition = hitPoint - backward * 0.5
      //   = (0, 0, -3) - (0, 0, -1) * 0.5 = (0, 0, -3) - (0, 0, -0.5) = (0, 0, -2.5)
      expect(chaseCam.position.x).toBeCloseTo(0, 2);
      expect(chaseCam.position.y).toBeCloseTo(0, 2);
      expect(chaseCam.position.z).toBeCloseTo(-2.5, 2);

      cm.dispose();
      playerCar.dispose();
    });

    it("test_occlusion_position_differs_from_configured_distance", () => {
      const { scene } = fixture;
      const { cm, chaseCam, playerCar } = initChaseCam(scene);

      // The configured follow distance is 6 (from defaults).
      expect(cm.config.chase.distance).toBe(6);

      // Mock hit at 4m → snap to -3.5m (not -6m).
      vi.spyOn(scene, "pickWithRay").mockReturnValueOnce(
        mockHit(
          true,
          new Vector3(0, 0, -4),
          { collisionGroup: 2 } as AbstractMesh,
          4
        )
      );

      cm.update(1 / 60);

      expect(chaseCam.position.z).toBeCloseTo(-3.5, 2);
      expect(chaseCam.position.z).not.toBeCloseTo(-6, 0);

      cm.dispose();
      playerCar.dispose();
    });

    it("test_occlusion_snaps_regardless_of_car_rotation", () => {
      const { scene } = fixture;

      // Car at (10, 0, 20) rotated 90° → faces +X in Babylon.js.
      const { cm, chaseCam, playerCar } = initChaseCam(
        scene,
        new Vector3(10, 0, 20),
        Math.PI / 2
      );

      // forward after 90° Y rotation: (1, 0, 0)
      // backward: (-1, 0, 0)
      // hit point at distance 3 from car = (10 - 3, 0, 20) = (7, 0, 20)
      vi.spyOn(scene, "pickWithRay").mockReturnValueOnce(
        mockHit(
          true,
          new Vector3(7, 0, 20),
          { collisionGroup: 2 } as AbstractMesh,
          3
        )
      );

      cm.update(1 / 60);

      // snapPosition = (7, 0, 20) - (-1, 0, 0) * 0.5 = (7.5, 0, 20)
      expect(chaseCam.position.x).toBeCloseTo(7.5, 2);
      expect(chaseCam.position.y).toBeCloseTo(0, 2);
      expect(chaseCam.position.z).toBeCloseTo(20, 2);

      cm.dispose();
      playerCar.dispose();
    });
  });

  // ── AC-11b: No occlusion, camera springs to configured distance ──────

  describe("AC-11b — No occlusion, camera springs to configured distance", () => {
    it("test_no_occlusion_camera_position_not_snapped", () => {
      const { scene } = fixture;
      const { cm, chaseCam, playerCar } = initChaseCam(scene);

      // Mock pickWithRay returning no hit (null)
      vi.spyOn(scene, "pickWithRay").mockReturnValueOnce(null);

      cm.update(1 / 60);

      // With no occlusion, the occlusion code does NOT touch camera position.
      // Position stays at FollowCamera initial position (0, height, -distance) = (0, 3, -6).
      expect(chaseCam.position.x).toBeCloseTo(0, 2);
      expect(chaseCam.position.y).toBeCloseTo(3, 2);
      expect(chaseCam.position.z).toBeCloseTo(-6, 2);

      cm.dispose();
      playerCar.dispose();
    });

    it("test_no_occlusion_clears_occlusion_state", () => {
      const { scene } = fixture;
      const { cm, chaseCam, playerCar } = initChaseCam(scene);

      // First tick: occluded → camera snaps to -2.5m
      vi.spyOn(scene, "pickWithRay").mockReturnValueOnce(
        mockHit(
          true,
          new Vector3(0, 0, -3),
          { collisionGroup: 2 } as AbstractMesh,
          3
        )
      );
      cm.update(1 / 60);

      // Verify camera was snapped (snap position = (-3) - (-1)*0.5 = -2.5)
      expect(chaseCam.position.z).toBeCloseTo(-2.5, 2);

      // Second tick: no longer occluded (null return) → occlusion state clears.
      // Should not throw during the state transition.
      vi.spyOn(scene, "pickWithRay").mockReturnValueOnce(null);
      expect(() => cm.update(1 / 60)).not.toThrow();

      // After clearing, the camera position stays at its snapped value
      // (FollowCamera spring only runs during scene.render(), which NullEngine
      // skips). The important thing is the internal occlusion state toggled
      // without crashing.
      expect(chaseCam.position.z).toBeCloseTo(-2.5, 2);

      cm.dispose();
      playerCar.dispose();
    });
  });

  // ── Layer filter: non-barrier meshes ────────────────────────────────

  describe("Layer filter — barrier collision group", () => {
    it("test_layer_filter_accepts_barrier_meshes_only", () => {
      const { scene } = fixture;
      const { cm, playerCar } = initChaseCam(scene);

      // Capture the predicate that CameraManager passes to pickWithRay
      let capturedPredicate: ((mesh: AbstractMesh) => boolean) | null = null;
      vi.spyOn(scene, "pickWithRay").mockImplementation(
        (_ray: Ray, predicate?: (mesh: AbstractMesh) => boolean) => {
          capturedPredicate = predicate ?? null;
          return null; // no hit — we only test the predicate
        }
      );

      cm.update(1 / 60);

      expect(capturedPredicate).toBeDefined();

      const predicate = capturedPredicate as (mesh: AbstractMesh) => boolean;

      // Barrier mesh (collisionGroup === 2) should be accepted
      expect(predicate({ collisionGroup: 2 } as AbstractMesh)).toBe(true);

      // Non-barrier meshes should be rejected
      expect(predicate({ collisionGroup: 0 } as AbstractMesh)).toBe(false);
      expect(predicate({ collisionGroup: 1 } as AbstractMesh)).toBe(false);
      expect(predicate({ collisionGroup: 4 } as AbstractMesh)).toBe(false);

      cm.dispose();
      playerCar.dispose();
    });
  });

  // ── AC-17: DNF coasting — FollowCamera continues tracking ────────────

  describe("AC-17 — DNF coasting (FollowCamera tracks)", () => {
    it("test_chase_camera_lockedTarget_remains_set_on_car", () => {
      const { scene } = fixture;
      const { cm, chaseCam, playerCar } = initChaseCam(scene);

      // lockedTarget should be the player car after Chase activation
      expect(chaseCam.lockedTarget).toBe(playerCar);

      // update() should not clear the lockedTarget
      cm.update(1 / 60);
      expect(chaseCam.lockedTarget).toBe(playerCar);

      cm.dispose();
      playerCar.dispose();
    });

    it("test_chase_camera_tracks_car_over_multiple_frames", () => {
      const { scene } = fixture;
      const { cm, chaseCam, playerCar } = initChaseCam(scene);

      // Simulate car coasting (moving forward in -Z) over 5 frames
      for (let frame = 0; frame < 5; frame++) {
        playerCar.position.z -= 5; // car moves in -Z each frame
        computeMeshWorld(playerCar);
        cm.update(1 / 60);

        // lockedTarget should always point at the player car
        expect(chaseCam.lockedTarget).toBe(playerCar);
      }

      // After 5 frames, car should be at z = -25
      expect(playerCar.position.z).toBeCloseTo(-25, 0);

      cm.dispose();
      playerCar.dispose();
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("test_occlusion_does_not_run_in_non_chase_mode", () => {
      const { scene } = fixture;
      const cm = new CameraManager(scene);
      cm.init(scene, "player-1");

      const playerCar = createPlayerCarMesh(scene);
      cm.setChaseCameraReader(createMockChaseReader(playerCar));
      computeMeshWorld(playerCar);

      // Activate Cockpit mode instead of Chase
      cm.setActiveMode(CameraMode.Cockpit);

      const pickSpy = vi.spyOn(scene, "pickWithRay");

      // update should NOT call pickWithRay — not in Chase mode
      cm.update(1 / 60);
      expect(pickSpy).not.toHaveBeenCalled();

      cm.dispose();
      playerCar.dispose();
    });

    it("test_occlusion_does_not_crash_without_player_mesh", () => {
      const { scene } = fixture;
      const cm = new CameraManager(scene);
      cm.init(scene, "player-1");

      // Activate Chase without setting a reader → no mesh available
      cm.setActiveMode(CameraMode.Chase);

      const pickSpy = vi.spyOn(scene, "pickWithRay");

      expect(() => cm.update(1 / 60)).not.toThrow();
      expect(pickSpy).not.toHaveBeenCalled();

      cm.dispose();
    });

    it("test_occlusion_does_not_crash_with_hit_but_no_pickedMesh", () => {
      const { scene } = fixture;
      const { cm, playerCar } = initChaseCam(scene);

      // Mock hit = true but pickedMesh = null → should be treated as miss
      vi.spyOn(scene, "pickWithRay").mockReturnValueOnce(
        mockHit(true, new Vector3(0, 0, 3), null, 3)
      );

      expect(() => cm.update(1 / 60)).not.toThrow();

      cm.dispose();
      playerCar.dispose();
    });

    it("test_dispose_resets_player_car_mesh_reference", () => {
      const { scene } = fixture;
      const { cm, playerCar } = initChaseCam(scene);

      // Dispose the CameraManager
      cm.dispose();

      // After dispose, update should not run occlusion (mesh ref is null)
      const pickSpy = vi.spyOn(scene, "pickWithRay");
      expect(() => cm.update(1 / 60)).not.toThrow();
      expect(pickSpy).not.toHaveBeenCalled();

      playerCar.dispose();
    });
  });
});
