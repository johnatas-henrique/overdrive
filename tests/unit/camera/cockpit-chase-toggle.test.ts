// @vitest-environment node

/**
 * Unit tests: Instant Cockpit/Chase Toggle (Story 005).
 *
 * Tests all acceptance criteria for the toggle method:
 *   AC-2:  Instant toggle — switches scene.activeCamera in zero frames,
 *          no intermediate blend state.
 *   AC-15: Toggle choice persists across GSM transitions (tested here for
 *          the toggle method; GSM persistence is tested in integration).
 *   AC-16: Toggle is a no-op when called during Grid, Drone, or Inactive
 *          modes — no crash, activeCamera unchanged.
 *
 * @see Story 005 — Instant Cockpit/Chase Toggle
 * @see ADR-0007 — Camera Architecture
 * @see TR-CAM-002 — Instant toggle (no lerp)
 */

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { FollowCamera } from "@babylonjs/core/Cameras/followCamera";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
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

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

interface Fixture {
  engine: NullEngine;
  scene: Scene;
  cm: CameraManager;
}

function createFixture(): Fixture {
  const engine = createEngine();
  const scene = new Scene(engine);
  const cm = new CameraManager(scene);
  cm.init(scene, "player-1");
  return { engine, scene, cm };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Cockpit/Chase Toggle (Story 005)", () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = createFixture();
  });

  afterEach(() => {
    fixture.cm.dispose();
    fixture.scene.dispose();
    fixture.engine.dispose();
  });

  // ── AC-2: Instant toggle ────────────────────────────────────────────

  describe("AC-2 — Instant toggle", () => {
    it("test_toggle_from_cockpit_to_chase_switches_immediately", () => {
      const { scene, cm } = fixture;

      cm.setActiveMode(CameraMode.Cockpit);
      expect(scene.activeCamera?.name).toBe("cockpitCam");
      expect(scene.activeCamera).toBeInstanceOf(FreeCamera);

      // Toggle — synchronous, same frame
      cm.toggleCockpitChase();

      expect(scene.activeCamera?.name).toBe("chaseCam");
      expect(scene.activeCamera).toBeInstanceOf(FollowCamera);
    });

    it("test_toggle_from_chase_to_cockpit_switches_immediately", () => {
      const { scene, cm } = fixture;

      cm.setActiveMode(CameraMode.Chase);
      expect(scene.activeCamera?.name).toBe("chaseCam");
      expect(scene.activeCamera).toBeInstanceOf(FollowCamera);

      // Toggle — synchronous, same frame
      cm.toggleCockpitChase();

      expect(scene.activeCamera?.name).toBe("cockpitCam");
      expect(scene.activeCamera).toBeInstanceOf(FreeCamera);
    });

    it("test_multiple_toggles_alternate_correctly", () => {
      const { scene, cm } = fixture;

      cm.setActiveMode(CameraMode.Cockpit);

      cm.toggleCockpitChase(); // → Chase
      expect(scene.activeCamera?.name).toBe("chaseCam");

      cm.toggleCockpitChase(); // → Cockpit
      expect(scene.activeCamera?.name).toBe("cockpitCam");

      cm.toggleCockpitChase(); // → Chase
      expect(scene.activeCamera?.name).toBe("chaseCam");

      cm.toggleCockpitChase(); // → Cockpit
      expect(scene.activeCamera?.name).toBe("cockpitCam");
    });

    it("test_toggle_is_synchronous_no_promise_or_lerp", () => {
      const { scene, cm } = fixture;

      cm.setActiveMode(CameraMode.Cockpit);

      // Capture the camera reference before toggle
      const beforeCam = scene.activeCamera;

      cm.toggleCockpitChase();

      // After toggle, the active camera must be a different instance
      const afterCam = scene.activeCamera;
      expect(afterCam).not.toBe(beforeCam);
      // The switch happened synchronously — no intermediate state
      expect(afterCam?.name).toBe("chaseCam");
    });
  });

  // ── AC-16: No-op in non-Cockpit/Chase modes ─────────────────────────

  describe("AC-16 — No-op on non-Cockpit/Chase modes", () => {
    it("test_toggle_from_inactive_is_noop", () => {
      const { scene, cm } = fixture;

      // No active mode after init
      expect(scene.activeCamera).toBeNull();

      // Toggle should do nothing
      cm.toggleCockpitChase();

      // Still null — no crash, no unexpected activation
      expect(scene.activeCamera).toBeNull();
    });

    it("test_toggle_from_grid_is_noop", () => {
      const { scene, cm } = fixture;

      cm.setActiveMode(CameraMode.Grid);
      expect(scene.activeCamera?.name).toBe("gridCam");

      cm.toggleCockpitChase();

      // Grid camera should remain active
      expect(scene.activeCamera?.name).toBe("gridCam");
    });

    it("test_toggle_from_drone_is_noop", () => {
      const { scene, cm } = fixture;

      cm.setActiveMode(CameraMode.Drone);
      expect(scene.activeCamera?.name).toBe("droneCam");
      expect(scene.activeCamera).toBeInstanceOf(ArcRotateCamera);

      cm.toggleCockpitChase();

      // Drone camera should remain active
      expect(scene.activeCamera?.name).toBe("droneCam");
      expect(scene.activeCamera).toBeInstanceOf(ArcRotateCamera);
    });

    it("test_toggle_from_grid_does_not_throw", () => {
      const { cm } = fixture;

      cm.setActiveMode(CameraMode.Grid);
      expect(() => cm.toggleCockpitChase()).not.toThrow();
    });

    it("test_toggle_from_drone_does_not_throw", () => {
      const { cm } = fixture;

      cm.setActiveMode(CameraMode.Drone);
      expect(() => cm.toggleCockpitChase()).not.toThrow();
    });
  });

  // ── AC-15: Toggle choice stored indirectly via toggle behavior ─────

  describe("AC-15 — Toggle choice stored (via toggle behavior)", () => {
    it("test_toggle_makes_chase_active_witch_toggles_back_to_cockpit", () => {
      const { scene, cm } = fixture;

      // Start in Cockpit, toggle to Chase
      cm.setActiveMode(CameraMode.Cockpit);
      cm.toggleCockpitChase();
      expect(scene.activeCamera?.name).toBe("chaseCam");

      // Toggle back — should return to Cockpit
      cm.toggleCockpitChase();
      expect(scene.activeCamera?.name).toBe("cockpitCam");
    });
  });
});
