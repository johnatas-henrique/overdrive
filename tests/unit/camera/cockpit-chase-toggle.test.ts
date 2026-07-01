// @vitest-environment node

/**
 * Unit tests: Cockpit/Chase Toggle (Story 005).
 *
 * Exhaustively tests the `toggleCockpitChase()` method in isolation:
 * - Core toggle behavior (Cockpit ↔ Chase)
 * - No-op from non-Cockpit/Chase modes (default branch removed)
 * - `_lastToggleChoice` preference tracking
 * - Edge cases (dispose, init ordering, invalid state)
 *
 * @see Story 005 — Instant Cockpit/Chase Toggle
 * @see ADR-0007 — Camera Architecture
 * @see TR-CAM-002 — Instant toggle (no lerp)
 */

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

/** Cast to any to access private members for test verification. */
function expose(cm: CameraManager): Record<string, unknown> {
  return cm as unknown as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("toggleCockpitChase (Story 005)", () => {
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

  // ── Core toggle behavior ───────────────────────────────────────────

  describe("core toggle", () => {
    it("test_from_cockpit_toggles_to_chase", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      expect(scene.activeCamera?.name).toBe("cockpitCam");

      cm.toggleCockpitChase();

      expect(scene.activeCamera?.name).toBe("chaseCam");
    });

    it("test_from_chase_toggles_to_cockpit", () => {
      cm.setActiveMode(CameraMode.Chase);
      expect(scene.activeCamera?.name).toBe("chaseCam");

      cm.toggleCockpitChase();

      expect(scene.activeCamera?.name).toBe("cockpitCam");
    });

    it("test_full_cycle_cockpit_chase_cockpit_chase", () => {
      cm.setActiveMode(CameraMode.Cockpit);
      expect(scene.activeCamera?.name).toBe("cockpitCam");

      cm.toggleCockpitChase();
      expect(scene.activeCamera?.name).toBe("chaseCam");

      cm.toggleCockpitChase();
      expect(scene.activeCamera?.name).toBe("cockpitCam");

      cm.toggleCockpitChase();
      expect(scene.activeCamera?.name).toBe("chaseCam");
    });

    it("test_double_toggle_returns_to_original_mode", () => {
      cm.setActiveMode(CameraMode.Cockpit);

      cm.toggleCockpitChase(); // → Chase
      cm.toggleCockpitChase(); // → Cockpit

      expect(scene.activeCamera?.name).toBe("cockpitCam");
    });

    it("test_toggle_is_instant_no_lerp_indicator", () => {
      // TR-CAM-002: toggle switches scene.activeCamera synchronously,
      // no deferred animation or lerp. Verified by checking that the
      // active camera changes immediately after the call.
      cm.setActiveMode(CameraMode.Cockpit);

      cm.toggleCockpitChase();

      // The active camera reference is updated synchronously in the
      // same call stack — no render() required.
      expect(scene.activeCamera?.name).toBe("chaseCam");
    });
  });

  // ── No-op behavior (default branch removed) ────────────────────────

  describe("no-op from non-Cockpit/Chase modes", () => {
    it("test_from_inactive_does_nothing", () => {
      // Current mode is Inactive (post-init)
      expect(scene.activeCamera).toBeNull();

      cm.toggleCockpitChase();

      // Should remain Inactive — no default fallback
      expect(scene.activeCamera).toBeNull();
    });

    it("test_from_grid_does_nothing", () => {
      cm.setActiveMode(CameraMode.Grid);
      expect(scene.activeCamera?.name).toBe("gridCam");

      cm.toggleCockpitChase();

      // Should remain Grid — unchanged
      expect(scene.activeCamera?.name).toBe("gridCam");
    });

    it("test_from_drone_does_nothing", () => {
      cm.setActiveMode(CameraMode.Drone);
      expect(scene.activeCamera?.name).toBe("droneCam");

      cm.toggleCockpitChase();

      // Should remain Drone — unchanged
      expect(scene.activeCamera?.name).toBe("droneCam");
    });
  });

  // ── _lastToggleChoice tracking ────────────────────────────────────

  describe("_lastToggleChoice preference tracking", () => {
    it("test_sets_lastToggleChoice_to_chase_when_toggling_from_cockpit", () => {
      cm.setActiveMode(CameraMode.Cockpit);

      cm.toggleCockpitChase();

      expect(expose(cm)._lastToggleChoice).toBe(CameraMode.Chase);
    });

    it("test_sets_lastToggleChoice_to_cockpit_when_toggling_from_chase", () => {
      cm.setActiveMode(CameraMode.Chase);

      cm.toggleCockpitChase();

      expect(expose(cm)._lastToggleChoice).toBe(CameraMode.Cockpit);
    });

    it("test_lastToggleChoice_unchanged_on_noop_toggle", () => {
      // Set a known preference first
      cm.setActiveMode(CameraMode.Cockpit);
      cm.toggleCockpitChase();
      expect(expose(cm)._lastToggleChoice).toBe(CameraMode.Chase);

      // Toggle from Grid (no-op) — should NOT change _lastToggleChoice
      cm.setActiveMode(CameraMode.Grid);
      cm.toggleCockpitChase();

      expect(expose(cm)._lastToggleChoice).toBe(CameraMode.Chase);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("test_does_not_throw_before_init", () => {
      const uninit = new CameraManager(scene);
      // _currentMode is Inactive, no cameras — toggle should be no-op
      expect(() => uninit.toggleCockpitChase()).not.toThrow();
      // No disposal needed — nothing was initialised
    });

    it("test_does_not_throw_after_dispose", () => {
      cm.dispose();
      // After dispose, _currentMode is Inactive — toggle should be no-op
      expect(() => cm.toggleCockpitChase()).not.toThrow();
    });

    it("test_toggle_leaves_scene_camera_list_intact", () => {
      // Toggling should not add or remove cameras from the scene
      const beforeCount = scene.cameras.length;

      cm.setActiveMode(CameraMode.Cockpit);
      cm.toggleCockpitChase();
      cm.toggleCockpitChase();

      expect(scene.cameras.length).toBe(beforeCount);
    });

    it("test_lastToggleChoice_is_null_on_fresh_instance", () => {
      // Fresh CameraManager should have no toggle preference
      expect(expose(cm)._lastToggleChoice).toBeNull();
    });

    it("test_lastToggleChoice_persists_after_dispose_reinit", () => {
      // Set a preference
      cm.setActiveMode(CameraMode.Cockpit);
      cm.toggleCockpitChase();
      expect(expose(cm)._lastToggleChoice).toBe(CameraMode.Chase);

      // Dispose and reinit — preference persists (in-memory, same session)
      cm.dispose();
      cm.init(scene, "player-1");
      expect(expose(cm)._lastToggleChoice).toBe(CameraMode.Chase);
    });
  });
});
