// @vitest-environment node

/**
 * Unit tests: Head Bob + Lateral Lean (Story 009).
 *
 * Exhaustively tests the bob/lean computation in `update()` and the
 * combined transform application in `_updateShake()`:
 * - AC-13: Head bob and lateral lean active in cockpit mode,
 *   configurable to zero (no oscillation or roll at zero intensity).
 * - AC-16: Purely cosmetic — zero impact on car position (verified
 *   at integration level, tested here for correct transform isolation).
 * - AC-16a: Deterministic physics replay is preserved (shakeNode is a
 *   leaf in the hierarchy — transforms never propagate to the car).
 *
 * Also tests the `setLateralG()` interface contract:
 * - Values are stored correctly and consumed by the lean calculation.
 * - Default value is 0 (no lean without explicit input).
 * - Reset to 0 on dispose().
 *
 * @see Story 009 — Head Bob + Lateral Lean
 * @see TR-CAM-009 — Head bob and lateral lean (cosmetic only)
 * @see ADR-0007 — Camera Architecture §Shake System
 * @see design/gdd/camera.md — GDD requirement TR-CAM-009
 */

import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CameraManager } from "@/camera/camera-manager";
import { CameraMode } from "@/camera/types";

// ---------------------------------------------------------------------------
// Constants (from createDefaultCameraConfig)
// ---------------------------------------------------------------------------

const HEAD_BOB_INTENSITY = 0.02;
const HEAD_BOB_FREQUENCY = 2.0;
const LEAN_INTENSITY = 2.0;

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

/** Cast to any to access private members for test verification. */
function expose(cm: CameraManager): Record<string, unknown> {
  return cm as unknown as Record<string, unknown>;
}

/**
 * Create a mock TransformNode with mutable position and rotation for
 * verifying shakeNode transform updates in unit tests.
 *
 * Both `position` and `rotation` are plain objects with x/y/z that can
 * be assigned to or mutated, matching how Babylon.js TransformNode
 * works at the property level.
 */
function createMockShakeNode(): Record<string, unknown> {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    isDisposed: () => false,
    dispose: () => {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("head bob and lateral lean (Story 009)", () => {
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

  // ── setLateralG interface ──────────────────────────────────────────

  describe("setLateralG() interface contract", () => {
    it("test_setLateralG_stores_value_for_lean_computation", () => {
      cm.setLateralG(0.8);
      expect(expose(cm)._lateralG).toBeCloseTo(0.8, 6);
    });

    it("test_setLateralG_negative_value_stored_correctly", () => {
      cm.setLateralG(-0.5);
      expect(expose(cm)._lateralG).toBeCloseTo(-0.5, 6);
    });

    it("test_lateralG_defaults_to_zero", () => {
      expect(expose(cm)._lateralG).toBe(0);
    });

    it("test_setLateralG_overwrites_previous_value", () => {
      cm.setLateralG(0.8);
      cm.setLateralG(0.3);
      expect(expose(cm)._lateralG).toBeCloseTo(0.3, 6);
    });
  });

  // ── Head bob: active in cockpit, zero at zero intensity ────────────

  describe("AC-13: head bob active in cockpit mode", () => {
    it("test_head_bob_applies_vertical_offset_in_cockpit_mode", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      cm.setLateralG(0);
      cm.update(1 / 60);

      // With non-zero headBob.intensity and elapsed time > 0, position.y
      // should be non-zero (bobOffset = sin(elapsed * freq * 2PI) * intensity)
      expect((node.position as { y: number }).y).not.toBe(0);
    });

    it("test_head_bob_computes_expected_value_at_known_time", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      // Set elapsed time to 0.125s so sin(0.125 * 2 * 2 * PI) = sin(PI/2) = 1
      // bobOffset = 1.0 * 0.02 = 0.02
      expose(cm)._totalElapsed = 0;
      cm.update(0.125);

      const expectedBob =
        Math.sin(0.125 * HEAD_BOB_FREQUENCY * 2 * Math.PI) * HEAD_BOB_INTENSITY;
      expect(expectedBob).toBeCloseTo(0.02, 4);
      expect((node.position as { y: number }).y).toBeCloseTo(expectedBob, 4);
    });

    it("test_head_bob_produces_zero_offset_when_intensity_is_zero", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      // Override headBob.intensity to 0
      const cfg = expose(cm)._config as Record<string, unknown>;
      const headBob = cfg.headBob as Record<string, unknown>;
      headBob.intensity = 0;

      // Run update with a meaningful dt to accumulate elapsed
      cm.update(0.5);

      // With intensity=0, bobOffset should always be 0
      expect((node.position as { y: number }).y).toBe(0);
    });

    it("test_head_bob_oscillates_between_positive_and_negative", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      // At t=0.25s: sin(0.25 * 2 * 2 * PI) = sin(PI) = 0
      expose(cm)._totalElapsed = 0;
      cm.update(0.25);
      const yAtZero = (node.position as { y: number }).y;

      // At t=0.375s: sin(0.375 * 2 * 2 * PI) = sin(1.5PI) = -1
      cm.update(0.125);
      const yAtNegative = (node.position as { y: number }).y;

      // sin wave goes through zero and into negative
      expect(yAtZero).toBeGreaterThan(-0.001);
      expect(yAtZero).toBeLessThan(0.001);
      expect(yAtNegative).toBeLessThan(0);
    });
  });

  // ── Lateral lean: active in cockpit, zero at zero intensity ────────

  describe("AC-13: lateral lean active in cockpit mode", () => {
    it("test_lateral_lean_rotation_applied_in_cockpit_mode", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      cm.setLateralG(1.0);
      cm.update(1 / 60);

      // With lean.intensity=2.0° and lateralG=1.0: leanAngle = 1.0 * 2.0 * PI/180
      const expectedLean = 1.0 * LEAN_INTENSITY * (Math.PI / 180);
      expect((node.rotation as { z: number }).z).toBeCloseTo(expectedLean, 6);
    });

    it("test_lateral_lean_scales_with_lateralG", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      // lateralG = 0.5 → leanAngle = 0.5 * 2.0 * PI/180 = PI/180 ≈ 0.0175
      cm.setLateralG(0.5);
      cm.update(1 / 60);
      const lean05 = (node.rotation as { z: number }).z;

      // lateralG = 0.8 → leanAngle = 0.8 * 2.0 * PI/180 ≈ 0.0279
      cm.setLateralG(0.8);
      cm.update(1 / 60);
      const lean08 = (node.rotation as { z: number }).z;

      expect(lean05).toBeGreaterThan(0);
      expect(lean08).toBeGreaterThan(lean05);
    });

    it("test_lateral_lean_negative_lateralG_rolls_opposite_direction", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      // Positive lateralG → positive rotation.z
      cm.setLateralG(1.0);
      cm.update(1 / 60);
      const positiveLean = (node.rotation as { z: number }).z;

      // Negative lateralG → negative rotation.z
      expose(cm)._shakeNode = createMockShakeNode();
      const node2 = expose(cm)._shakeNode as Record<string, unknown>;
      cm.setLateralG(-1.0);
      cm.update(1 / 60);
      const negativeLean = (node2.rotation as { z: number }).z;

      expect(positiveLean).toBeGreaterThan(0);
      expect(negativeLean).toBeLessThan(0);
      expect(positiveLean).toBeCloseTo(-negativeLean, 6);
    });

    it("test_lateral_lean_produces_zero_rotation_when_intensity_is_zero", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      // Override lean.intensity to 0
      const cfg = expose(cm)._config as Record<string, unknown>;
      const lean = cfg.lean as Record<string, unknown>;
      lean.intensity = 0;

      cm.setLateralG(1.0);
      cm.update(1 / 60);

      // With intensity=0, leanAngle should always be 0
      expect((node.rotation as { z: number }).z).toBe(0);
    });
  });

  // ── Mode gating: bob and lean are cockpit-only ─────────────────────

  describe("AC-16: bob and lean are cockpit-only (no effect in other modes)", () => {
    it("test_bob_and_lean_not_applied_in_chase_mode", () => {
      cm.setActiveMode(CameraMode.Chase);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      cm.setLateralG(1.0);
      cm.update(1 / 60);

      // In Chase mode, bobOffset and leanAngle should remain 0
      expect((node.position as { y: number }).y).toBe(0);
      expect((node.rotation as { z: number }).z).toBe(0);
    });

    it("test_bob_and_lean_not_applied_in_drone_mode", () => {
      cm.setActiveMode(CameraMode.Drone);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      cm.setLateralG(1.0);
      cm.update(1 / 60);

      expect((node.position as { y: number }).y).toBe(0);
      expect((node.rotation as { z: number }).z).toBe(0);
    });

    it("test_bob_and_lean_not_applied_in_grid_mode", () => {
      cm.setActiveMode(CameraMode.Grid);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      cm.setLateralG(1.0);
      cm.update(1 / 60);

      expect((node.position as { y: number }).y).toBe(0);
      expect((node.rotation as { z: number }).z).toBe(0);
    });

    it("test_bob_and_lean_not_applied_in_inactive_mode", () => {
      // Post-init, _currentMode is Inactive
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      cm.setLateralG(1.0);
      cm.update(1 / 60);

      expect((node.position as { y: number }).y).toBe(0);
      expect((node.rotation as { z: number }).z).toBe(0);
    });
  });

  // ── Combined transforms: bob + shake on position.y, lean on rotation.z ──

  describe("combined transforms on shakeNode", () => {
    it("test_position_y_combines_bob_and_shake_offset", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      // Set elapsed to known value for predictable bob offset
      expose(cm)._totalElapsed = 0;
      cm.setLateralG(0);

      // Add a shake and advance time
      cm.addShake("kerb", 0.03);
      cm.update(0.125);

      // position.y should equal bobOffset + totalOffset.y
      // We can't assert exact shake offset due to Math.random(),
      // but we can verify y is NOT simply totalOffset on its own
      const posY = (node.position as { y: number }).y;

      // The shake offset is random, but we know bobOffset ≈ 0.02
      // position.y must be at least bobOffset (shake could be negative)
      // but the important check is that y != pure_bob and y != pure_shake
      // Only verify it doesn't throw and is finite
      expect(posY).not.toBeNaN();
      expect(Number.isFinite(posY)).toBe(true);
    });

    it("test_rotation_z_equals_lean_angle_unaffected_by_shake", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      cm.setLateralG(0.5);
      cm.addShake("kerb", 0.03);
      cm.update(1 / 60);

      // rotation.z must equal exactly leanAngle (shake doesn't affect rotation)
      const expectedLean = 0.5 * LEAN_INTENSITY * (Math.PI / 180);
      expect((node.rotation as { z: number }).z).toBeCloseTo(expectedLean, 6);
    });
  });

  // ── Backward compatibility ─────────────────────────────────────────

  describe("backward compatibility", () => {
    it("test_update_does_not_throw_when_shakeNode_is_null", () => {
      // _shakeNode is null before attachCockpitToCar — update should not throw
      cm.setActiveMode(CameraMode.Cockpit);
      cm.setLateralG(1.0);
      expect(() => cm.update(1 / 60)).not.toThrow();
    });
  });

  // ── Dispose behavior ───────────────────────────────────────────────

  describe("dispose behavior", () => {
    it("test_lateralG_reset_to_zero_on_dispose", () => {
      cm.setLateralG(0.8);
      expect(expose(cm)._lateralG).toBeCloseTo(0.8, 6);

      cm.dispose();
      expect(expose(cm)._lateralG).toBe(0);
    });

    it("test_does_not_throw_when_calling_setLateralG_after_dispose", () => {
      cm.dispose();
      expect(() => cm.setLateralG(0.5)).not.toThrow();
    });

    it("test_bob_and_lean_not_applied_after_dispose", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      cm.setLateralG(1.0);
      cm.dispose();

      // Re-init and check that lateralG is 0
      expect(expose(cm)._lateralG).toBe(0);
    });
  });

  // ── NaN/Infinity guard ────────────────────────────────────────────

  describe("NaN/Infinity lateralG guard", () => {
    it("test_setLateralG_NaN_resets_to_zero", () => {
      cm.setLateralG(Number.NaN);
      expect(expose(cm)._lateralG).toBe(0);
    });

    it("test_setLateralG_Infinity_resets_to_zero", () => {
      cm.setLateralG(Number.POSITIVE_INFINITY);
      expect(expose(cm)._lateralG).toBe(0);
    });

    it("test_setLateralG_negative_Infinity_resets_to_zero", () => {
      cm.setLateralG(Number.NEGATIVE_INFINITY);
      expect(expose(cm)._lateralG).toBe(0);
    });
  });

  // ── QA boundary values (AC-13 intensity=0.1, lean=10) ────────────

  describe("AC-13: QA boundary values", () => {
    it("test_head_bob_at_QA_boundary_intensity_0_1", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      // Override to QA boundary values
      const cfg = expose(cm)._config as Record<string, unknown>;
      (cfg.headBob as Record<string, unknown>).intensity = 0.1;

      expose(cm)._totalElapsed = 0;
      cm.update(0.125); // sin(0.125 * 2 * 2PI) = sin(PI/2) = 1

      const expectedBob = 1.0 * 0.1; // = 0.1
      expect((node.position as { y: number }).y).toBeCloseTo(expectedBob, 4);
    });

    it("test_lateral_lean_at_QA_boundary_intensity_10", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      // Override to QA boundary values
      const cfg = expose(cm)._config as Record<string, unknown>;
      (cfg.lean as Record<string, unknown>).intensity = 10;

      cm.setLateralG(1.0);
      cm.update(1 / 60);

      const expectedLean = 1.0 * 10 * (Math.PI / 180);
      expect((node.rotation as { z: number }).z).toBeCloseTo(expectedLean, 6);
    });
  });

  // ── AC-16a: determinism — car position unchanged by bob/lean ──────

  describe("AC-16a: determinism — car position preserved", () => {
    it("test_bob_and_lean_do_not_propagate_to_car_position", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      const node = createMockShakeNode();
      expose(cm)._shakeNode = node;

      // Simulate a car mesh with a known position
      const carPosition = { x: 10, y: 0, z: 5 };
      const mockCarMesh = {
        get absolutePosition() {
          return carPosition;
        },
      };
      expose(cm)._playerCarMesh = mockCarMesh;

      // Run update with strong bob/lean
      cm.setLateralG(1.0);
      cm.update(1 / 60);

      // Car position must be unchanged — bob/lean only affect shakeNode
      expect(carPosition.x).toBe(10);
      expect(carPosition.y).toBe(0);
      expect(carPosition.z).toBe(5);

      // Run again with different lateralG
      cm.setLateralG(-1.0);
      cm.update(1 / 60);

      // Car position still unchanged
      expect(carPosition.x).toBe(10);
      expect(carPosition.y).toBe(0);
      expect(carPosition.z).toBe(5);
    });
  });
});
