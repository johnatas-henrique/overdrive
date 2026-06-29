/**
 * Unit tests: AssetManager
 *
 * Tests the AssetManager state machine, scene switching, and error handling
 * using mocked Engine / Scene objects. These tests verify internal logic
 * (routing, state transitions, error paths) without real Babylon.js objects.
 *
 * @see TR-AM-001 — AssetContainers cache (Map<string, AssetContainer>)
 * @see TR-AM-002 — Two-scene references owned by Asset Manager
 * @see TR-AM-003 — setActiveScene() controls which scene renders
 * @see TR-AM-004 — Both scenes coexist in engine.scenes[]
 * @see ADR-0003 — Two-Scene Architecture & Asset Lifecycle
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetError } from "@/asset-manager/asset-error";
import { AssetManager } from "@/asset-manager/asset-manager";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fake Scene object for testing. */
function createFakeScene(name: string): any {
  return {
    name,
    // Minimal Babylon.js Scene surface — enough for AssetManager to work with
    _engine: null,
    isDisposed: false,
  };
}

/** Create a fake AssetContainer with a spy on addAllToScene. */
function createFakeContainer(): any {
  return {
    addAllToScene: vi.fn(),
    meshes: [],
    dispose: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("AssetManager", () => {
  let assetManager: AssetManager;
  let menuScene: any;
  let raceScene: any;

  beforeEach(() => {
    assetManager = new AssetManager();
    menuScene = createFakeScene("menuScene");
    raceScene = createFakeScene("raceScene");
  });

  // ── init() ────────────────────────────────────────────────────

  describe("init()", () => {
    it("should create empty cache, store scenes, and transition to Ready", () => {
      assetManager.init(menuScene, raceScene);

      // Cache is empty after init
      expect(assetManager.cacheSize).toBe(0);

      // After init, getActiveScene() should return menuScene (default)
      expect(assetManager.getActiveScene()).toBe(menuScene);

      // Switching to race works
      assetManager.setActiveScene("race");
      expect(assetManager.getActiveScene()).toBe(raceScene);
    });

    it("should be idempotent — second call is safe no-op", () => {
      assetManager.init(menuScene, raceScene);
      const activeAfterFirst = assetManager.getActiveScene();

      // Second init should not change state
      expect(() => assetManager.init(menuScene, raceScene)).not.toThrow();
      expect(assetManager.getActiveScene()).toBe(activeAfterFirst);
    });
  });

  // ── setActiveScene() ──────────────────────────────────────────

  describe("setActiveScene()", () => {
    it("should route to menuScene when called with 'menu'", () => {
      assetManager.init(menuScene, raceScene);

      // Start with race, then switch back to menu
      assetManager.setActiveScene("race");
      assetManager.setActiveScene("menu");

      expect(assetManager.getActiveScene()).toBe(menuScene);
    });

    it("should route to raceScene when called with 'race'", () => {
      assetManager.init(menuScene, raceScene);

      assetManager.setActiveScene("race");

      expect(assetManager.getActiveScene()).toBe(raceScene);
    });

    it("should throw AssetError when called before init()", () => {
      expect(() => assetManager.setActiveScene("race")).toThrow(AssetError);
      expect(() => assetManager.setActiveScene("race")).toThrow(
        "Not initialized"
      );
    });

    it("should throw AssetError for invalid scene name", () => {
      assetManager.init(menuScene, raceScene);

      // @ts-expect-error — intentionally passing invalid value
      expect(() => assetManager.setActiveScene("invalid")).toThrow(AssetError);
      // @ts-expect-error — intentionally passing invalid value
      expect(() => assetManager.setActiveScene("invalid")).toThrow(
        "Expected 'menu' or 'race'"
      );
      // @ts-expect-error — intentionally passing invalid value
      expect(() => assetManager.setActiveScene("garage")).toThrow(AssetError);
    });

    it("should throw 'Not initialized' when called before init with invalid name", () => {
      // @ts-expect-error — intentionally passing invalid value
      expect(() => assetManager.setActiveScene("invalid")).toThrow(
        "Not initialized"
      );
    });
  });

  // ── _addAllToScene() ─────────────────────────────────────────

  describe("_addAllToScene()", () => {
    it("should call container.addAllToScene() with no arguments", () => {
      assetManager.init(menuScene, raceScene);
      const container = createFakeContainer();

      assetManager._addAllToScene(container);

      expect(container.addAllToScene).toHaveBeenCalledTimes(1);
      // NOTE: AssetContainer.addAllToScene() takes NO parameters
      // (Babylon.js 9.12.0 API). The container is scene-bound at load time.
      expect(container.addAllToScene).toHaveBeenCalledWith();
    });

    it("should call addAllToScene regardless of which scene is active", () => {
      assetManager.init(menuScene, raceScene);
      const container = createFakeContainer();

      // Switch to race
      assetManager.setActiveScene("race");
      assetManager._addAllToScene(container);
      expect(container.addAllToScene).toHaveBeenCalledTimes(1);

      // Switch to menu — addAllToScene still called with no args
      assetManager.setActiveScene("menu");
      assetManager._addAllToScene(container);
      expect(container.addAllToScene).toHaveBeenCalledTimes(2);
    });

    it("should throw AssetError when called before init()", () => {
      const container = createFakeContainer();

      expect(() => assetManager._addAllToScene(container)).toThrow(AssetError);
      expect(() => assetManager._addAllToScene(container)).toThrow(
        "Not initialized"
      );
    });
  });

  // ── getActiveScene() ──────────────────────────────────────────

  describe("getActiveScene()", () => {
    it("should return menuScene by default after init()", () => {
      assetManager.init(menuScene, raceScene);

      expect(assetManager.getActiveScene()).toBe(menuScene);
    });

    it("should throw AssetError when called before init()", () => {
      expect(() => assetManager.getActiveScene()).toThrow(AssetError);
      expect(() => assetManager.getActiveScene()).toThrow("Not initialized");
    });
  });
});
