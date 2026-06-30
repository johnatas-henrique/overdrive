// @vitest-environment happy-dom

/**
 * Integration tests: AssetManager lifecycle
 *
 * Tests the AssetManager with real Babylon.js objects. Uses Babylon.js's
 * built-in `NullEngine` to create Engine and Scene instances without
 * requiring a WebGL/WebGPU context — making these tests runnable in any
 * environment (CI, headless, happy-dom).
 *
 * Verifies structural Babylon.js behavior:
 * - Scene() pushes itself to `engine.scenes[]`
 * - Scene reference management through AssetManager
 * - AssetManager routing and error handling with real Scene objects
 * - Playground removal (grep-based verification)
 *
 * @see TR-AM-001 — AssetContainers cache (Map<string, AssetContainer>)
 * @see TR-AM-002 — Two-scene references owned by Asset Manager
 * @see TR-AM-003 — setActiveScene() controls which scene renders
 * @see TR-AM-004 — Both scenes coexist in engine.scenes[]
 * @see ADR-0003 — Two-Scene Architecture & Asset Lifecycle
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Scene } from "@babylonjs/core/scene";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetError } from "@/asset-manager/asset-error";
import { AssetManager } from "@/asset-manager/asset-manager";
import type { TrackManifest } from "@/asset-manager/types";
import { EventBus } from "@/foundation/event-bus/event-bus";

vi.mock("@babylonjs/core/Loading/sceneLoader", () => ({
  LoadAssetContainerAsync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a real Babylon.js Engine (no WebGL needed — NullEngine). */
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
// Setup / Teardown
// ---------------------------------------------------------------------------

let engine: NullEngine;

/** Track created Scenes so we can clean them up between tests. */
const createdScenes: Scene[] = [];

afterEach(() => {
  for (const s of createdScenes) {
    s.dispose();
  }
  createdScenes.length = 0;
  if (engine) {
    engine.dispose();
  }
});

// ---------------------------------------------------------------------------
// Integration Suite
// ---------------------------------------------------------------------------

describe("AssetManager lifecycle", () => {
  // ── Babylon.js prerequisite: Scene constructor registers in engine.scenes[] ──

  it("should register Scene instances in engine.scenes[] via constructor", () => {
    engine = createEngine();
    const menuScene = new Scene(engine);
    createdScenes.push(menuScene);
    const raceScene = new Scene(engine);
    createdScenes.push(raceScene);

    // Scene constructor pushes itself to engine.scenes[]
    // Note: NullEngine may create internal scenes, so we check >= 2 not === 2
    expect(engine.scenes.length).toBeGreaterThanOrEqual(2);

    // Both scenes are registered in engine.scenes[]
    const sceneSet = new Set(engine.scenes);
    expect(sceneSet.has(menuScene)).toBe(true);
    expect(sceneSet.has(raceScene)).toBe(true);
  });

  it("should store scene references accessible via setActiveScene", () => {
    engine = createEngine();
    const menuScene = new Scene(engine);
    createdScenes.push(menuScene);
    const raceScene = new Scene(engine);
    createdScenes.push(raceScene);

    const am = new AssetManager();
    am.init(menuScene, raceScene);

    // Cache is empty after init
    expect(am.cacheSize).toBe(0);

    // Verify the scenes stored in AssetManager are the same objects
    am.setActiveScene("menu");
    expect(am.getActiveScene()).toBe(menuScene);

    am.setActiveScene("race");
    expect(am.getActiveScene()).toBe(raceScene);
  });

  // ── setActiveScene() error handling ────────────────────────────

  it("should throw AssetError when setActiveScene is called before init", () => {
    engine = createEngine();
    const menuScene = new Scene(engine);
    createdScenes.push(menuScene);
    const raceScene = new Scene(engine);
    createdScenes.push(raceScene);

    const am = new AssetManager();

    // Should throw before init
    expect(() => am.setActiveScene("race")).toThrow(AssetError);
    expect(() => am.setActiveScene("race")).toThrow("Not initialized");

    // After init it should work
    am.init(menuScene, raceScene);
    expect(() => am.setActiveScene("race")).not.toThrow();
    expect(am.getActiveScene()).toBe(raceScene);
  });

  // ── init() idempotency ────────────────────────────────────────

  it("should be idempotent — second init call is no-op", () => {
    engine = createEngine();
    const menuScene = new Scene(engine);
    createdScenes.push(menuScene);
    const raceScene = new Scene(engine);
    createdScenes.push(raceScene);

    const am = new AssetManager();
    am.init(menuScene, raceScene);

    const activeBefore = am.getActiveScene();
    expect(() => am.init(menuScene, raceScene)).not.toThrow();
    expect(am.getActiveScene()).toBe(activeBefore);
  });

  // ── setActiveScene with invalid name ──────────────────────────

  it("should throw AssetError for invalid scene name", () => {
    engine = createEngine();
    const menuScene = new Scene(engine);
    createdScenes.push(menuScene);
    const raceScene = new Scene(engine);
    createdScenes.push(raceScene);

    const am = new AssetManager();
    am.init(menuScene, raceScene);

    // @ts-expect-error — intentionally passing invalid value
    expect(() => am.setActiveScene("invalid")).toThrow(AssetError);
  });

  // ── getActiveScene() states ───────────────────────────────────

  it("should return menuScene by default after init", () => {
    engine = createEngine();
    const menuScene = new Scene(engine);
    createdScenes.push(menuScene);
    const raceScene = new Scene(engine);
    createdScenes.push(raceScene);

    const am = new AssetManager();
    am.init(menuScene, raceScene);

    expect(am.getActiveScene()).toBe(menuScene);
  });

  it("should throw AssetError when getActiveScene is called before init", () => {
    engine = createEngine();
    const am = new AssetManager();

    expect(() => am.getActiveScene()).toThrow(AssetError);
    expect(() => am.getActiveScene()).toThrow("Not initialized");
  });
});

// ---------------------------------------------------------------------------
// Playground removal verification (non-runtime)
// ---------------------------------------------------------------------------

/**
 * Scan a directory recursively for files matching a content pattern.
 *
 * Uses Node.js filesystem APIs instead of shelling out to grep, making
 * this portable across platforms and immune to non-standard import forms.
 *
 * @param dir - Root directory to scan
 * @param pattern - RegExp to test against each file's content
 * @returns Paths of files whose content matches the pattern
 */
function findFilesWithContent(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { recursive: true })) {
    if (typeof entry !== "string") continue;
    const fullPath = join(dir, entry);
    if (!entry.endsWith(".ts") && !entry.endsWith(".tsx")) continue;
    const content = readFileSync(fullPath, "utf-8");
    if (pattern.test(content)) results.push(fullPath);
  }
  return results;
}

describe("Playground removal", () => {
  it("should have no imports from src/playground/ in src/", () => {
    const matches = findFilesWithContent(
      "src",
      /from.*['"].*playground|import.*['"].*playground/
    );
    expect(matches).toEqual([]);
  });

  it("should have no CreateMainScene references in src/", () => {
    const matches = findFilesWithContent("src", /CreateMainScene/);
    expect(matches).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Story 002: registerManifest + load lifecycle (integration with NullEngine)
// ---------------------------------------------------------------------------

describe("registerManifest + load lifecycle", () => {
  let engine: NullEngine;
  let am: AssetManager;

  afterEach(() => {
    vi.clearAllMocks();
    if (engine) engine.dispose();
  });

  function createScene(_name: string): Scene {
    const scene = new Scene(engine);
    return scene;
  }

  it("should register and load with real scenes (NullEngine)", async () => {
    engine = createEngine();
    const menuScene = createScene("menu");
    const raceScene = createScene("race");
    am = new AssetManager();
    am.init(menuScene, raceScene);

    const manifest: TrackManifest = {
      glb: { rootUrl: "assets/tracks/spa/", filename: "spa.glb" },
    };
    am.registerManifest("spa", manifest);

    const fakeContainer = {
      addAllToScene: vi.fn(),
      removeAllFromScene: vi.fn(),
      dispose: vi.fn(),
      meshes: [],
      transformNodes: [],
    };
    vi.mocked(LoadAssetContainerAsync).mockResolvedValue(fakeContainer as any);

    const container = await am.load("spa");

    expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(1);
    expect(LoadAssetContainerAsync).toHaveBeenCalledWith("spa.glb", raceScene, {
      rootUrl: "assets/tracks/spa/",
    });
    expect(fakeContainer.removeAllFromScene).toHaveBeenCalledTimes(1);
    expect(fakeContainer.addAllToScene).toHaveBeenCalledTimes(1);
    expect(container).toBe(fakeContainer);
    expect(am.cacheSize).toBe(1);
  });

  it("should return cached container on second load (cache hit)", async () => {
    engine = createEngine();
    const menuScene = createScene("menu");
    const raceScene = createScene("race");
    am = new AssetManager();
    am.init(menuScene, raceScene);

    const manifest: TrackManifest = {
      glb: { rootUrl: "assets/tracks/spa/", filename: "spa.glb" },
    };
    am.registerManifest("spa", manifest);

    const fakeContainer = {
      addAllToScene: vi.fn(),
      removeAllFromScene: vi.fn(),
      dispose: vi.fn(),
      meshes: [],
      transformNodes: [],
    };
    vi.mocked(LoadAssetContainerAsync).mockResolvedValue(fakeContainer as any);

    // First load
    await am.load("spa");
    expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(1);

    // Second load — cache hit, no I/O
    const result = await am.load("spa");
    expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(1); // Still 1
    expect(fakeContainer.addAllToScene).toHaveBeenCalledTimes(1); // already in-scene, skipped
    expect(result).toBe(fakeContainer);
  });

  it("should retrieve nodes via get() with real containers", async () => {
    engine = createEngine();
    const menuScene = createScene("menu");
    const raceScene = createScene("race");
    am = new AssetManager();
    am.init(menuScene, raceScene);

    const manifest: TrackManifest = {
      glb: { rootUrl: "assets/tracks/spa/", filename: "spa.glb" },
    };
    am.registerManifest("spa", manifest);

    const rootNode = { name: "spa_root", id: "spa_root" };
    const fakeContainer = {
      addAllToScene: vi.fn(),
      removeAllFromScene: vi.fn(),
      dispose: vi.fn(),
      meshes: [],
      transformNodes: [rootNode],
    };
    vi.mocked(LoadAssetContainerAsync).mockResolvedValue(fakeContainer as any);

    await am.load("spa");

    // get() returns the node from transformNodes
    const result = am.get("spa_root");
    expect(result).toBe(rootNode);
    expect(am.get("nonexistent")).toBeUndefined();
  });

  it("should throw AssetError for unregistered load", async () => {
    engine = createEngine();
    const menuScene = createScene("menu");
    const raceScene = createScene("race");
    am = new AssetManager();
    am.init(menuScene, raceScene);

    await expect(am.load("unknown")).rejects.toThrow(AssetError);
    await expect(am.load("unknown")).rejects.toThrow("Manifest not found");
  });
});

// ---------------------------------------------------------------------------
// Event emission lifecycle (real EventBus)
// ---------------------------------------------------------------------------

describe("Event emission lifecycle", () => {
  let engine: NullEngine;
  let am: AssetManager;

  afterEach(() => {
    vi.clearAllMocks();
    if (engine) engine.dispose();
  });

  function createScene(_name: string): Scene {
    const scene = new Scene(engine);
    return scene;
  }

  it("should emit start/progress/complete on successful load via real EventBus", async () => {
    engine = createEngine();
    const menuScene = createScene("menu");
    const raceScene = createScene("race");
    const bus = new EventBus();
    bus.init();
    am = new AssetManager(bus);
    am.init(menuScene, raceScene);

    const manifest: TrackManifest = {
      glb: { rootUrl: "assets/tracks/spa/", filename: "spa.glb" },
    };
    am.registerManifest("spa", manifest);

    const events: string[] = [];
    bus.on("asset.load.start", () => events.push("start"));
    bus.on("asset.load.progress", () => events.push("progress"));
    bus.on("asset.load.complete", () => events.push("complete"));

    const fakeContainer = {
      addAllToScene: vi.fn(),
      removeAllFromScene: vi.fn(),
      dispose: vi.fn(),
      meshes: [],
      transformNodes: [],
    };
    vi.mocked(LoadAssetContainerAsync).mockResolvedValue(fakeContainer as any);

    const container = await am.load("spa");

    expect(events).toEqual(["start", "progress", "complete"]);
    expect(container).toBe(fakeContainer);
  });

  it("should emit start/progress/complete on cache hit via real EventBus", async () => {
    engine = createEngine();
    const menuScene = createScene("menu");
    const raceScene = createScene("race");
    const bus = new EventBus();
    bus.init();
    am = new AssetManager(bus);
    am.init(menuScene, raceScene);

    const manifest: TrackManifest = {
      glb: { rootUrl: "assets/tracks/spa/", filename: "spa.glb" },
    };
    am.registerManifest("spa", manifest);

    const fakeContainer = {
      addAllToScene: vi.fn(),
      removeAllFromScene: vi.fn(),
      dispose: vi.fn(),
      meshes: [],
      transformNodes: [],
    };
    vi.mocked(LoadAssetContainerAsync).mockResolvedValue(fakeContainer as any);

    // Populate cache
    await am.load("spa");

    // Subscribe AFTER first load to capture only the second load
    const events: string[] = [];
    bus.on("asset.load.start", () => events.push("start"));
    bus.on("asset.load.progress", () => events.push("progress"));
    bus.on("asset.load.complete", () => events.push("complete"));

    const result = await am.load("spa");

    expect(events).toEqual(["start", "progress", "complete"]);
    expect(result).toBe(fakeContainer);
  });

  it("should emit error and NOT complete on loader rejection via real EventBus", async () => {
    engine = createEngine();
    const menuScene = createScene("menu");
    const raceScene = createScene("race");
    const bus = new EventBus();
    bus.init();
    am = new AssetManager(bus);
    am.init(menuScene, raceScene);

    const manifest: TrackManifest = {
      glb: { rootUrl: "assets/tracks/spa/", filename: "spa.glb" },
    };
    am.registerManifest("spa", manifest);

    vi.mocked(LoadAssetContainerAsync).mockRejectedValue(
      new Error("Connection lost")
    );

    const events: string[] = [];
    const errors: any[] = [];
    bus.on("asset.load.start", () => events.push("start"));
    bus.on("asset.load.progress", () => events.push("progress"));
    bus.on("asset.load.complete", () => events.push("complete"));
    bus.on("asset.error", (payload) => errors.push(payload));

    await expect(am.load("spa")).rejects.toThrow("Connection lost");

    // Error event has the right shape
    expect(errors).toHaveLength(1);
    expect(errors[0].id).toBe("spa");
    expect(errors[0].error.message).toBe("Connection lost");

    // start was emitted, but NOT progress or complete
    expect(events).toEqual(["start"]);
  });

  it("should emit error and NOT complete on manifest-not-found via real EventBus", async () => {
    engine = createEngine();
    const menuScene = createScene("menu");
    const raceScene = createScene("race");
    const bus = new EventBus();
    bus.init();
    am = new AssetManager(bus);
    am.init(menuScene, raceScene);

    const events: string[] = [];
    const errors: any[] = [];
    bus.on("asset.load.start", () => events.push("start"));
    bus.on("asset.load.progress", () => events.push("progress"));
    bus.on("asset.load.complete", () => events.push("complete"));
    bus.on("asset.error", (payload) => errors.push(payload));

    await expect(am.load("nonexistent")).rejects.toThrow(AssetError);

    expect(errors).toHaveLength(1);
    expect(errors[0].id).toBe("nonexistent");

    expect(events).toEqual(["start"]);
  });

  it("should NOT throw when EventBus emits during load (handler error isolation)", async () => {
    engine = createEngine();
    const menuScene = createScene("menu");
    const raceScene = createScene("race");
    const bus = new EventBus();
    bus.init();
    am = new AssetManager(bus);
    am.init(menuScene, raceScene);

    const manifest: TrackManifest = {
      glb: { rootUrl: "assets/tracks/spa/", filename: "spa.glb" },
    };
    am.registerManifest("spa", manifest);

    // Subscriber that throws — EventBus isolates errors per ADR-0001
    bus.on("asset.load.start", () => {
      throw new Error("Handler crash");
    });

    const fakeContainer = {
      addAllToScene: vi.fn(),
      removeAllFromScene: vi.fn(),
      dispose: vi.fn(),
      meshes: [],
      transformNodes: [],
    };
    vi.mocked(LoadAssetContainerAsync).mockResolvedValue(fakeContainer as any);

    // Should NOT throw despite the handler throwing
    const result = await am.load("spa");
    expect(result).toBe(fakeContainer);
  });
});
