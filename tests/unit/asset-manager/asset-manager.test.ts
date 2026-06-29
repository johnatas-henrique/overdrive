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

import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetError } from "@/asset-manager/asset-error";
import { AssetManager } from "@/asset-manager/asset-manager";
import type { TrackManifest } from "@/asset-manager/types";

vi.mock("@babylonjs/core/Loading/sceneLoader", () => ({
  LoadAssetContainerAsync: vi.fn(),
}));

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
    removeAllFromScene: vi.fn(),
    meshes: [],
    transformNodes: [],
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

  // ── registerManifest() ────────────────────────────────────────

  describe("registerManifest()", () => {
    const testManifest: TrackManifest = {
      glb: { rootUrl: "assets/tracks/spa/", filename: "spa.glb" },
    };

    it("should store manifest accessible via internal state (AC-2a)", () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);

      const manifests = (assetManager as any)._manifests as Map<
        string,
        TrackManifest
      >;
      expect(manifests.has("spa")).toBe(true);
      expect(manifests.get("spa")).toEqual(testManifest);
    });

    it("should throw AssetError before init (AC-2b)", () => {
      expect(() => assetManager.registerManifest("spa", testManifest)).toThrow(
        AssetError
      );
      expect(() => assetManager.registerManifest("spa", testManifest)).toThrow(
        "Not initialized"
      );
    });

    it("should throw 'Already disposed' after dispose (AC-2b disposed)", () => {
      assetManager.init(menuScene, raceScene);
      (assetManager as any)._state = "disposed";

      expect(() => assetManager.registerManifest("spa", testManifest)).toThrow(
        AssetError
      );
      expect(() => assetManager.registerManifest("spa", testManifest)).toThrow(
        "Already disposed"
      );
    });

    it("should overwrite silently on duplicate ID (AC-2c)", () => {
      assetManager.init(menuScene, raceScene);
      const manifest2: TrackManifest = {
        glb: { rootUrl: "assets/tracks/nurb/", filename: "nurb.glb" },
      };

      // First registration
      assetManager.registerManifest("spa", testManifest);
      // Overwrite silently (no error)
      expect(() =>
        assetManager.registerManifest("spa", manifest2)
      ).not.toThrow();

      const manifests = (assetManager as any)._manifests as Map<
        string,
        TrackManifest
      >;
      expect(manifests.get("spa")).toEqual(manifest2);
    });
  });

  // ── load() ────────────────────────────────────────────────────

  describe("load()", () => {
    const testManifest: TrackManifest = {
      glb: { rootUrl: "assets/tracks/spa/", filename: "spa.glb" },
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should call LoadAssetContainerAsync, cache container, add to activeScene (AC-3a)", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);

      const container = createFakeContainer();
      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(container);

      const result = await assetManager.load("spa");

      // LoadAssetContainerAsync called with correct args
      expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(1);
      expect(LoadAssetContainerAsync).toHaveBeenCalledWith(
        "spa.glb",
        raceScene,
        { rootUrl: "assets/tracks/spa/" }
      );

      // removeAllFromScene called after load
      expect(container.removeAllFromScene).toHaveBeenCalledTimes(1);

      // Container cached
      expect(assetManager.cacheSize).toBe(1);

      // addAllToScene called (via _addAllToScene)
      expect(container.addAllToScene).toHaveBeenCalledTimes(1);
      expect(container.addAllToScene).toHaveBeenCalledWith();

      // Returns the container
      expect(result).toBe(container);
    });

    it("should throw AssetError before init (AC-3b)", async () => {
      // No registerManifest needed — lifecycle guard fires before look-up
      await expect(assetManager.load("spa")).rejects.toThrow(AssetError);
      await expect(assetManager.load("spa")).rejects.toThrow("Not initialized");
    });

    it("should throw AssetError after dispose (AC-3c)", async () => {
      assetManager.init(menuScene, raceScene);
      (assetManager as any)._state = "disposed";

      await expect(assetManager.load("spa")).rejects.toThrow(AssetError);
      await expect(assetManager.load("spa")).rejects.toThrow(
        "Already disposed"
      );
    });

    it("should skip LoadAssetContainerAsync on cache hit (AC-4a)", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);

      const container = createFakeContainer();
      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(container);

      // First load
      await assetManager.load("spa");
      expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(1);

      // Second load — cache hit
      const result = await assetManager.load("spa");
      expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(1); // Still 1
      expect(container.addAllToScene).toHaveBeenCalledTimes(2); // re-added to scene
      expect(result).toBe(container);
    });

    it("should return synchronously on cache hit (AC-4b)", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);

      const container = createFakeContainer();
      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(container);

      // First load (awaits real async)
      await assetManager.load("spa");

      // Second load — should resolve without calling loader again
      const result = await assetManager.load("spa");
      expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(1); // Still 1 — no new I/O
      expect(result).toBe(container); // Same cached reference
    });

    it("should throw AssetError for unregistered ID (edge)", async () => {
      assetManager.init(menuScene, raceScene);

      await expect(assetManager.load("nonexistent")).rejects.toThrow(
        AssetError
      );
      await expect(assetManager.load("nonexistent")).rejects.toThrow(
        "Manifest not found"
      );
    });

    it("should propagate loader error without caching partial state (edge)", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);

      vi.mocked(LoadAssetContainerAsync).mockRejectedValue(
        new Error("Network error")
      );

      await expect(assetManager.load("spa")).rejects.toThrow("Network error");
      expect(assetManager.cacheSize).toBe(0); // No partial state cached
    });
  });

  // ── get() ─────────────────────────────────────────────────────

  describe("get()", () => {
    const testManifest: TrackManifest = {
      glb: { rootUrl: "assets/tracks/spa/", filename: "spa.glb" },
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return node from cached transformNodes (AC-5a)", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);

      const rootNode = { name: "spa_root", id: "spa_root" };
      const container = createFakeContainer();
      container.transformNodes = [rootNode];
      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(container);

      await assetManager.load("spa");

      const result = assetManager.get("spa_root");
      expect(result).toBe(rootNode);
    });

    it("should return node from cached meshes (AC-5a mesh variant)", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);

      const meshNode = { name: "spa_barrier", id: "spa_barrier" };
      const container = createFakeContainer();
      container.meshes = [meshNode];
      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(container);

      await assetManager.load("spa");

      const result = assetManager.get("spa_barrier");
      expect(result).toBe(meshNode);
    });

    it("should find node by name when id does not match", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);

      // Node with mismatched id/name — search by name triggers || branch
      const node = { name: "track_root", id: "auto_generated_id" };
      const container = createFakeContainer();
      container.transformNodes = [node];
      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(container);

      await assetManager.load("spa");

      const result = assetManager.get("track_root");
      expect(result).toBe(node);
    });

    it("should find mesh by name when mesh id does not match", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);

      // Mesh with mismatched id/name — exercises name branch in mesh search
      const mesh = { name: "barrier_a", id: "mesh_042" };
      const container = createFakeContainer();
      container.meshes = [mesh];
      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(container);

      await assetManager.load("spa");

      const result = assetManager.get("barrier_a");
      expect(result).toBe(mesh);
    });

    it("should return undefined for nonexistent ID (AC-5b)", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);

      const container = createFakeContainer();
      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(container);

      await assetManager.load("spa");

      const result = assetManager.get("nonexistent");
      expect(result).toBeUndefined();
    });

    it("should return undefined before any load (edge)", () => {
      assetManager.init(menuScene, raceScene);

      const result = assetManager.get("anything");
      expect(result).toBeUndefined();
    });
  });
});
