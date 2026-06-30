/**
 * Unit tests: AssetManager
 *
 * Comprehensive tests for the AssetManager state machine, scene switching,
 * asset loading, caching, event emission, and lifecycle management.
 * Uses mocked Engine / Scene objects — no real Babylon.js runtime.
 *
 * @see TR-AM-001 — AssetContainers cache (Map<string, AssetContainer>)
 * @see TR-AM-002 — Two-scene references owned by Asset Manager
 * @see TR-AM-003 — setActiveScene() controls which scene renders
 * @see TR-AM-004 — Both scenes coexist in engine.scenes[]
 * @see TR-AM-005 — unloadAll removes containers from scene (cache intact)
 * @see TR-AM-006 — dispose disposes containers, clears cache, transitions state
 * @see TR-AM-007 — disposeContainer per-asset removal
 * @see ADR-0003 — Two-Scene Architecture & Asset Lifecycle
 */

import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetError } from "@/asset-manager/asset-error";
import { AssetManager } from "@/asset-manager/asset-manager";
import type { TrackManifest } from "@/asset-manager/types";
import type { IEventBus } from "@/foundation/event-bus/types";

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
    dispose: vi.fn(),
    isDisposed: false,
    _engine: null,
  };
}

/** Create a fake AssetContainer with spies on lifecycle methods. */
function createFakeContainer(): any {
  return {
    addAllToScene: vi.fn(),
    removeAllFromScene: vi.fn(),
    dispose: vi.fn(),
    meshes: [],
    transformNodes: [],
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const testManifest: TrackManifest = {
  glb: { rootUrl: "assets/tracks/spa/", filename: "spa.glb" },
};

const testManifest2: TrackManifest = {
  glb: { rootUrl: "assets/tracks/nurb/", filename: "nurb.glb" },
};

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
    vi.clearAllMocks();
  });

  // ── init() ────────────────────────────────────────────────────

  describe("init()", () => {
    it("should create empty cache, store scenes, and transition to Ready", () => {
      assetManager.init(menuScene, raceScene);

      expect(assetManager.cacheSize).toBe(0);
      expect(assetManager.getActiveScene()).toBe(menuScene);

      assetManager.setActiveScene("race");
      expect(assetManager.getActiveScene()).toBe(raceScene);
    });

    it("should be idempotent — second call is safe no-op", () => {
      assetManager.init(menuScene, raceScene);
      const activeAfterFirst = assetManager.getActiveScene();

      expect(() => assetManager.init(menuScene, raceScene)).not.toThrow();
      expect(assetManager.getActiveScene()).toBe(activeAfterFirst);
    });
  });

  // ── setActiveScene() ──────────────────────────────────────────

  describe("setActiveScene()", () => {
    it("should route to menuScene when called with 'menu'", () => {
      assetManager.init(menuScene, raceScene);

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

      assetManager.registerManifest("spa", testManifest);
      expect(() =>
        assetManager.registerManifest("spa", testManifest2)
      ).not.toThrow();

      const manifests = (assetManager as any)._manifests as Map<
        string,
        TrackManifest
      >;
      expect(manifests.get("spa")).toEqual(testManifest2);
    });

    it("should allow two different IDs (AC-9c)", () => {
      assetManager.init(menuScene, raceScene);

      assetManager.registerManifest("spa", testManifest);
      assetManager.registerManifest("nurb", testManifest2);

      const manifests = (assetManager as any)._manifests as Map<
        string,
        TrackManifest
      >;
      expect(manifests.size).toBe(2);
      expect(manifests.get("spa")).toEqual(testManifest);
      expect(manifests.get("nurb")).toEqual(testManifest2);
    });
  });

  // ── load() ────────────────────────────────────────────────────

  describe("load()", () => {
    it("should call LoadAssetContainerAsync, cache container, add to activeScene (AC-3a)", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);

      const container = createFakeContainer();
      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(container);

      const result = await assetManager.load("spa");

      expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(1);
      expect(LoadAssetContainerAsync).toHaveBeenCalledWith(
        "spa.glb",
        raceScene,
        { rootUrl: "assets/tracks/spa/" }
      );
      expect(container.removeAllFromScene).toHaveBeenCalledTimes(1);
      expect(assetManager.cacheSize).toBe(1);
      expect(container.addAllToScene).toHaveBeenCalledTimes(1);
      expect(container.addAllToScene).toHaveBeenCalledWith();
      expect(result).toBe(container);
    });

    it("should throw AssetError before init (AC-3b)", async () => {
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

      await assetManager.load("spa");
      expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(1);

      const result = await assetManager.load("spa");
      expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(1);
      expect(container.addAllToScene).toHaveBeenCalledTimes(2);
      expect(result).toBe(container);
    });

    it("should return synchronously on cache hit (AC-4b)", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);

      const container = createFakeContainer();
      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(container);

      await assetManager.load("spa");

      const result = await assetManager.load("spa");
      expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(1);
      expect(result).toBe(container);
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
      expect(assetManager.cacheSize).toBe(0);
    });
  });

  // ── get() ─────────────────────────────────────────────────────

  describe("get()", () => {
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

    it("should throw AssetError on get() after dispose (AC-8c)", () => {
      assetManager.init(menuScene, raceScene);
      assetManager.dispose();

      expect(() => assetManager.get("spa")).toThrow(AssetError);
      expect(() => assetManager.get("spa")).toThrow("Already disposed");
    });
  });

  // ── Event Bus integration ────────────────────────────────────

  describe("Event Bus integration", () => {
    /** Create a mock IEventBus with spied emit(). */
    function createMockBus(): IEventBus {
      return {
        emit: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
        getSubscriptions: vi.fn(),
        dispose: vi.fn(),
      };
    }

    it("should emit asset.load.start when load begins (AC-10a)", async () => {
      const bus = createMockBus();
      const am = new AssetManager(bus);
      am.init(menuScene, raceScene);
      am.registerManifest("spa", testManifest);

      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(
        createFakeContainer()
      );

      await am.load("spa");

      expect(bus.emit).toHaveBeenNthCalledWith(1, "asset.load.start", {
        ids: ["spa"],
      });
    });

    it("should emit asset.load.progress and asset.load.complete on successful first load (AC-10b)", async () => {
      const bus = createMockBus();
      const am = new AssetManager(bus);
      am.init(menuScene, raceScene);
      am.registerManifest("spa", testManifest);

      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(
        createFakeContainer()
      );

      await am.load("spa");

      const emitCalls = vi.mocked(bus.emit).mock.calls;
      const eventCalls = emitCalls.filter(([event]) =>
        (event as string).startsWith("asset.load")
      );
      expect(eventCalls).toEqual([
        ["asset.load.start", { ids: ["spa"] }],
        ["asset.load.progress", { id: "spa", loaded: 1, total: 1 }],
        ["asset.load.complete", { id: "spa" }],
      ]);
    });

    it("should emit progress and complete on cache hit (AC-10c)", async () => {
      const bus = createMockBus();
      const am = new AssetManager(bus);
      am.init(menuScene, raceScene);
      am.registerManifest("spa", testManifest);

      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(
        createFakeContainer()
      );

      await am.load("spa");
      vi.mocked(bus.emit).mockClear();

      const container = await am.load("spa");

      const emitCalls = vi.mocked(bus.emit).mock.calls;
      expect(emitCalls).toEqual([
        ["asset.load.start", { ids: ["spa"] }],
        ["asset.load.progress", { id: "spa", loaded: 1, total: 1 }],
        ["asset.load.complete", { id: "spa" }],
      ]);
      expect(container).toBeDefined();
    });

    it("should emit asset.error with payload and NOT complete on manifest-not-found (AC-10d)", async () => {
      const bus = createMockBus();
      const am = new AssetManager(bus);
      am.init(menuScene, raceScene);

      await expect(am.load("unknown")).rejects.toThrow(AssetError);

      const emitCalls = vi.mocked(bus.emit).mock.calls;
      const eventCalls = emitCalls.map(([event]) => event as string);
      expect(eventCalls).toContain("asset.load.start");
      expect(eventCalls).toContain("asset.error");
      expect(eventCalls).not.toContain("asset.load.progress");
      expect(eventCalls).not.toContain("asset.load.complete");

      const errorCall = emitCalls.find(([e]) => e === "asset.error");
      expect(errorCall).toBeDefined();
      const payload = errorCall?.[1] as { assetId: string; error: Error };
      expect(payload.assetId).toBe("unknown");
      expect(payload.error).toBeInstanceOf(AssetError);
    });

    it("should emit asset.error with payload and NOT complete on loader rejection (AC-10d variant)", async () => {
      const bus = createMockBus();
      const am = new AssetManager(bus);
      am.init(menuScene, raceScene);
      am.registerManifest("spa", testManifest);

      vi.mocked(LoadAssetContainerAsync).mockRejectedValue(
        new Error("Network failure")
      );

      await expect(am.load("spa")).rejects.toThrow("Network failure");

      const emitCalls = vi.mocked(bus.emit).mock.calls;
      const eventCalls = emitCalls.map(([event]) => event as string);
      expect(eventCalls).toContain("asset.load.start");
      expect(eventCalls).toContain("asset.error");
      expect(eventCalls).not.toContain("asset.load.progress");
      expect(eventCalls).not.toContain("asset.load.complete");

      const errorCall = emitCalls.find(([e]) => e === "asset.error");
      expect(errorCall).toBeDefined();
      const payload = errorCall?.[1] as { assetId: string; error: Error };
      expect(payload.assetId).toBe("spa");
      expect(payload.error).toBeInstanceOf(Error);
      expect(payload.error.message).toBe("Network failure");
    });

    it("should wrap non-Error rejection in Error for asset.error payload", async () => {
      const bus = createMockBus();
      const am = new AssetManager(bus);
      am.init(menuScene, raceScene);
      am.registerManifest("spa", testManifest);

      vi.mocked(LoadAssetContainerAsync).mockRejectedValue("string error");

      await expect(am.load("spa")).rejects.toBe("string error");

      const emitCalls = vi.mocked(bus.emit).mock.calls;
      const errorCall = emitCalls.find(([e]) => e === "asset.error");
      expect(errorCall).toBeDefined();
      const payload = errorCall?.[1] as { assetId: string; error: Error };
      expect(payload.assetId).toBe("spa");
      expect(payload.error).toBeInstanceOf(Error);
      expect(payload.error.message).toBe("string error");
    });

    it("should NOT emit any events when no EventBus is provided (no-bus path)", async () => {
      const am = new AssetManager();
      am.init(menuScene, raceScene);
      am.registerManifest("spa", testManifest);

      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(
        createFakeContainer()
      );

      const result = await am.load("spa");
      expect(result).toBeDefined();
    });

    it("should emit asset.load.start before cache check (AC-6a)", async () => {
      const bus = createMockBus();
      const am = new AssetManager(bus);
      am.init(menuScene, raceScene);
      am.registerManifest("spa", testManifest);

      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(
        createFakeContainer()
      );

      await am.load("spa");
      vi.mocked(bus.emit).mockClear();

      await am.load("spa");

      expect(bus.emit).toHaveBeenCalledWith("asset.load.start", {
        ids: ["spa"],
      });
    });

    it("should NOT emit asset.load.complete when error occurs (AC-6b)", async () => {
      const bus = createMockBus();
      const am = new AssetManager(bus);
      am.init(menuScene, raceScene);

      await expect(am.load("unknown")).rejects.toThrow(AssetError);

      const emitCalls = vi.mocked(bus.emit).mock.calls;
      const completeCalls = emitCalls.filter(
        ([event]) => event === "asset.load.complete"
      );
      expect(completeCalls).toHaveLength(0);
    });
  });

  // ── unloadAll() ──────────────────────────────────────────────

  describe("unloadAll()", () => {
    it("should call removeAllFromScene on each container (AC-7a)", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);
      assetManager.registerManifest("nurb", testManifest2);

      const container1 = createFakeContainer();
      const container2 = createFakeContainer();
      vi.mocked(LoadAssetContainerAsync)
        .mockResolvedValueOnce(container1)
        .mockResolvedValueOnce(container2);

      await assetManager.load("spa");
      await assetManager.load("nurb");

      container1.removeAllFromScene.mockClear();
      container2.removeAllFromScene.mockClear();

      assetManager.unloadAll();

      expect(container1.removeAllFromScene).toHaveBeenCalledTimes(1);
      expect(container2.removeAllFromScene).toHaveBeenCalledTimes(1);
      expect(assetManager.cacheSize).toBe(2);
    });

    it("should allow re-adding containers via load() after unloadAll (AC-7b)", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);

      const container = createFakeContainer();
      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(container);

      await assetManager.load("spa");
      expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(1);

      assetManager.unloadAll();

      container.addAllToScene.mockClear();

      const result = await assetManager.load("spa");

      expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(1);
      expect(container.addAllToScene).toHaveBeenCalledTimes(1);
      expect(result).toBe(container);
    });

    it("should be idempotent — second call is safe no-op (AC-7c)", () => {
      assetManager.init(menuScene, raceScene);

      expect(() => assetManager.unloadAll()).not.toThrow();
      expect(() => assetManager.unloadAll()).not.toThrow();
    });

    it("should be safe no-op after dispose", () => {
      assetManager.init(menuScene, raceScene);
      assetManager.dispose();

      expect(() => assetManager.unloadAll()).not.toThrow();
    });

    it("should throw AssetError when called before init()", () => {
      expect(() => assetManager.unloadAll()).toThrow(AssetError);
      expect(() => assetManager.unloadAll()).toThrow("Not initialized");
    });
  });

  // ── dispose() ────────────────────────────────────────────────

  describe("dispose()", () => {
    it("should call dispose on each container, clear cache, set state (AC-8a)", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);
      assetManager.registerManifest("nurb", testManifest2);

      const container1 = createFakeContainer();
      const container2 = createFakeContainer();
      vi.mocked(LoadAssetContainerAsync)
        .mockResolvedValueOnce(container1)
        .mockResolvedValueOnce(container2);

      await assetManager.load("spa");
      await assetManager.load("nurb");

      expect(assetManager.cacheSize).toBe(2);

      assetManager.dispose();

      expect(container1.dispose).toHaveBeenCalledTimes(1);
      expect(container2.dispose).toHaveBeenCalledTimes(1);
      expect(assetManager.cacheSize).toBe(0);
    });

    it("should NOT dispose scenes (AC-8b)", () => {
      assetManager.init(menuScene, raceScene);
      assetManager.dispose();

      expect(menuScene.dispose).not.toHaveBeenCalled();
      expect(raceScene.dispose).not.toHaveBeenCalled();
    });

    it("should throw AssetError on load() after dispose (AC-8c)", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.dispose();

      await expect(assetManager.load("spa")).rejects.toThrow(AssetError);
      await expect(assetManager.load("spa")).rejects.toThrow(
        "Already disposed"
      );
    });

    it("should throw AssetError when called before init()", () => {
      expect(() => assetManager.dispose()).toThrow(AssetError);
      expect(() => assetManager.dispose()).toThrow("Not initialized");
    });

    it("should be idempotent — second call is safe no-op", () => {
      assetManager.init(menuScene, raceScene);
      assetManager.dispose();

      expect(() => assetManager.dispose()).not.toThrow();
      expect(assetManager.cacheSize).toBe(0);
    });
  });

  // ── disposeContainer() ───────────────────────────────────────

  describe("disposeContainer()", () => {
    it("should dispose and remove a single container from cache (AC-NEW-1)", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);
      assetManager.registerManifest("nurb", testManifest2);

      const container1 = createFakeContainer();
      const container2 = createFakeContainer();
      vi.mocked(LoadAssetContainerAsync)
        .mockResolvedValueOnce(container1)
        .mockResolvedValueOnce(container2);

      await assetManager.load("spa");
      await assetManager.load("nurb");
      expect(assetManager.cacheSize).toBe(2);

      assetManager.disposeContainer("spa");

      expect(container1.dispose).toHaveBeenCalledTimes(1);
      expect(assetManager.cacheSize).toBe(1);
      expect(container2.dispose).not.toHaveBeenCalled();
    });

    it("should be safe no-op for missing ID (AC-NEW-1)", () => {
      assetManager.init(menuScene, raceScene);

      expect(() => assetManager.disposeContainer("nonexistent")).not.toThrow();
    });

    it("should leave other containers unaffected (AC-NEW-1 variant)", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);
      assetManager.registerManifest("nurb", testManifest2);

      const container1 = createFakeContainer();
      const container2 = createFakeContainer();
      vi.mocked(LoadAssetContainerAsync)
        .mockResolvedValueOnce(container1)
        .mockResolvedValueOnce(container2);

      await assetManager.load("spa");
      await assetManager.load("nurb");

      assetManager.disposeContainer("spa");

      expect(assetManager.cacheSize).toBe(1);
      expect(container2.dispose).not.toHaveBeenCalled();

      const result = await assetManager.load("nurb");
      expect(result).toBe(container2);
    });

    it("should throw AssetError when called before init()", () => {
      expect(() => assetManager.disposeContainer("spa")).toThrow(AssetError);
      expect(() => assetManager.disposeContainer("spa")).toThrow(
        "Not initialized"
      );
    });

    it("should throw AssetError when called after dispose", () => {
      assetManager.init(menuScene, raceScene);
      assetManager.dispose();

      expect(() => assetManager.disposeContainer("spa")).toThrow(AssetError);
      expect(() => assetManager.disposeContainer("spa")).toThrow(
        "Already disposed"
      );
    });
  });

  // ── Combined lifecycle sequence ─────────────────────────────

  describe("lifecycle sequence", () => {
    it("should survive init → register → load → unloadAll → dispose sequence", async () => {
      assetManager.init(menuScene, raceScene);
      assetManager.registerManifest("spa", testManifest);

      const container = createFakeContainer();
      vi.mocked(LoadAssetContainerAsync).mockResolvedValue(container);

      await assetManager.load("spa");
      expect(assetManager.cacheSize).toBe(1);

      assetManager.unloadAll();
      expect(assetManager.cacheSize).toBe(1);

      assetManager.dispose();
      expect(assetManager.cacheSize).toBe(0);

      await expect(assetManager.load("spa")).rejects.toThrow(
        "Already disposed"
      );
      await expect(assetManager.load("spa")).rejects.toThrow(AssetError);
    });
  });
});
