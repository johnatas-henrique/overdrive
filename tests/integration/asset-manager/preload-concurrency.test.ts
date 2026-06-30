// @vitest-environment happy-dom

/**
 * Integration tests: AssetManager preload concurrency (Story 005a).
 *
 * Tests the `preload()` method's concurrent loading behavior with real
 * Babylon.js objects. Uses Babylon.js's built-in `NullEngine` to create
 * Engine and Scene instances without requiring a WebGL/WebGPU context.
 *
 * Verifies:
 * - Concurrent dispatch across uncached asset IDs
 * - Event emission (batch start, per-asset, allComplete)
 * - Partial failure handling (other loads continue, first error propagated)
 * - Cache-aware skipping
 * - Lifecycle guards
 *
 * @see Story 005a — Preload Concurrency
 * @see AC-p1 through AC-p7
 */

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

function createEngine(): NullEngine {
  return new NullEngine({
    renderWidth: 1,
    renderHeight: 1,
    textureSize: 1,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
}

/** Shared fake AssetContainer for tests that don't inspect container internals. */
function fakeContainer(): any {
  return {
    addAllToScene: vi.fn(),
    removeAllFromScene: vi.fn(),
    dispose: vi.fn(),
    meshes: [],
    transformNodes: [],
  };
}

/** Helper: create a basic TrackManifest for a given track ID. */
function makeManifest(id: string): TrackManifest {
  return {
    glb: { rootUrl: `assets/tracks/${id}/`, filename: `${id}.glb` },
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

/**
 * Shared test infrastructure: creates engine, two scenes, an AssetManager
 * with optional EventBus, and registers a set of manifests.
 */
interface Fixture {
  engine: NullEngine;
  am: AssetManager;
  menuScene: Scene;
  raceScene: Scene;
}

function createFixture(bus?: EventBus): Fixture {
  const engine = createEngine();
  const menuScene = new Scene(engine);
  const raceScene = new Scene(engine);
  const am = new AssetManager(bus);
  am.init(menuScene, raceScene);
  return { engine, am, menuScene, raceScene };
}

/** Dispose engine and scenes, clear mocks. */
function teardownFixture(fixture: Fixture): void {
  vi.clearAllMocks();
  fixture.menuScene.dispose();
  fixture.raceScene.dispose();
  fixture.engine.dispose();
}

/** Track created fixtures for afterEach cleanup (avoids leaked state on assertion failure). */
const createdFixtures: Fixture[] = [];

afterEach(() => {
  for (const fx of createdFixtures) {
    teardownFixture(fx);
  }
  createdFixtures.length = 0;
});

// ---------------------------------------------------------------------------
// Preload Concurrency (Story 005a)
// ---------------------------------------------------------------------------

describe("preload concurrency", () => {
  // ── AC-p1: concurrent load per uncached ID ────────────────────

  it("should call load for each uncached ID concurrently (AC-p1)", async () => {
    const fx = createFixture();
    createdFixtures.push(fx);
    const { am } = fx;

    am.registerManifest("spa", makeManifest("spa"));
    am.registerManifest("monza", makeManifest("monza"));
    am.registerManifest("silverstone", makeManifest("silverstone"));

    const fc = fakeContainer();
    vi.mocked(LoadAssetContainerAsync).mockResolvedValue(fc);

    await am.preload(["spa", "monza", "silverstone"]);

    // Each uncached ID should trigger exactly one LoadAssetContainerAsync call
    expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(3);
    // All three should now be in the cache
    expect(am.cacheSize).toBe(3);
  });

  // ── AC-p2: resolves when all complete ─────────────────────────

  it("should resolve Promise<void> when all loads complete (AC-p2)", async () => {
    const fx = createFixture();
    createdFixtures.push(fx);
    const { am } = fx;

    am.registerManifest("a", makeManifest("a"));
    am.registerManifest("b", makeManifest("b"));

    vi.mocked(LoadAssetContainerAsync).mockResolvedValue(fakeContainer());

    // preload returns a Promise<void> — verify it resolves
    const result = am.preload(["a", "b"]);
    expect(result).toBeInstanceOf(Promise);

    await expect(result).resolves.toBeUndefined();
    expect(am.cacheSize).toBe(2);
  });

  // ── AC-p3: partial failure handling ───────────────────────────

  it("should continue other loads on failure, emit error, reject promise (AC-p3)", async () => {
    const fx = createFixture();
    createdFixtures.push(fx);
    const { menuScene, raceScene } = fx;
    const bus = new EventBus();
    bus.init();
    const amWithBus = new AssetManager(bus);
    amWithBus.init(menuScene, raceScene);

    amWithBus.registerManifest("a", makeManifest("a"));
    amWithBus.registerManifest("b", makeManifest("b"));
    amWithBus.registerManifest("c", makeManifest("c"));

    const fcGood = fakeContainer();
    const mockedLoad = vi.mocked(LoadAssetContainerAsync);
    // "b" fails — use implementation to check filename
    mockedLoad.mockImplementation(async (filename: string) => {
      if (filename === "b.glb") {
        throw new Error("Network failure");
      }
      return fcGood;
    });

    const errorEvents: any[] = [];
    bus.on("asset.error", (payload) => errorEvents.push(payload));

    const allCompleteCalls: any[] = [];
    bus.on("asset.load.allComplete", (p) => allCompleteCalls.push(p));

    // preload should reject
    await expect(amWithBus.preload(["a", "b", "c"])).rejects.toThrow(
      "Network failure"
    );

    // asset.error should have been emitted for the failing asset
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0].assetId).toBe("b");
    expect(errorEvents[0].error.message).toBe("Network failure");

    // allComplete should NOT be emitted on partial failure
    expect(allCompleteCalls).toHaveLength(0);

    // Successful assets should still be cached (cacheSize checks _cache.size)
    expect(amWithBus.cacheSize).toBe(2);
  });

  // ── AC-p4: allComplete emitted on success ─────────────────────

  it("should emit asset.load.allComplete on full batch success (AC-p4)", async () => {
    const bus = new EventBus();
    bus.init();
    const fx = createFixture(bus);
    createdFixtures.push(fx);
    const { am } = fx;

    am.registerManifest("x", makeManifest("x"));
    am.registerManifest("y", makeManifest("y"));

    const fc = fakeContainer();
    vi.mocked(LoadAssetContainerAsync).mockResolvedValue(fc);

    // Capture events
    const events: string[] = [];
    let allCompletePayload: unknown = null;
    bus.on("asset.load.start", () => events.push("start"));
    bus.on("asset.load.progress", () => events.push("progress"));
    bus.on("asset.load.complete", () => events.push("complete"));
    bus.on("asset.load.allComplete", (payload) => {
      events.push("allComplete");
      allCompletePayload = payload;
    });

    await am.preload(["x", "y"]);

    // allComplete should be the last event
    expect(events[events.length - 1]).toBe("allComplete");
    // allComplete should have correct payload
    expect(allCompletePayload).toEqual({ ids: ["x", "y"] });
    // All assets should be cached
    expect(am.cacheSize).toBe(2);
  });

  // ── AC-p5: cached IDs skipped ─────────────────────────────────

  it("should skip already-cached IDs without additional I/O (AC-p5)", async () => {
    const bus = new EventBus();
    bus.init();
    const fx = createFixture(bus);
    createdFixtures.push(fx);
    const { am } = fx;

    am.registerManifest("cached", makeManifest("cached"));
    am.registerManifest("fresh", makeManifest("fresh"));

    const fc = fakeContainer();
    vi.mocked(LoadAssetContainerAsync).mockResolvedValue(fc);

    // Pre-populate cache by loading "cached" first
    await am.load("cached");
    expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(1);
    expect(am.cacheSize).toBe(1);

    // Capture events for the preload call
    const events: string[] = [];
    bus.on("asset.load.start", () => events.push("start"));
    bus.on("asset.load.complete", () => events.push("complete"));
    bus.on("asset.load.allComplete", () => events.push("allComplete"));

    // preload with the cached ID + a new one
    await am.preload(["cached", "fresh"]);

    // Should NOT have called LoadAssetContainerAsync again for "cached"
    // Only the "fresh" load should trigger I/O
    expect(LoadAssetContainerAsync).toHaveBeenCalledTimes(2);

    // Events: batch start for "fresh" only, then per-asset events, then allComplete
    // Cached ID should NOT emit any events
    expect(events).toContain("start");
    expect(events).toContain("allComplete");
    // No per-asset complete events for the cached ID
    const completeEvents = events.filter((e) => e === "complete");
    expect(completeEvents).toHaveLength(1); // Only "fresh" completes

    // Cache should now have both
    expect(am.cacheSize).toBe(2);
  });

  // ── AC-p6: empty array resolves immediately ──────────────────

  it("should resolve immediately when passed an empty array (AC-p6)", async () => {
    const bus = new EventBus();
    bus.init();
    const fx = createFixture(bus);
    createdFixtures.push(fx);
    const { am } = fx;

    const events: string[] = [];
    bus.on("asset.load.start", () => events.push("start"));
    bus.on("asset.load.allComplete", () => events.push("allComplete"));

    await am.preload([]);

    // No events
    expect(events).toEqual([]);
  });

  it("should resolve immediately when all requested IDs are cached (AC-p6 variant)", async () => {
    const fx = createFixture();
    createdFixtures.push(fx);
    const { am } = fx;

    am.registerManifest("spa", makeManifest("spa"));

    const fc = fakeContainer();
    vi.mocked(LoadAssetContainerAsync).mockResolvedValue(fc);

    // Pre-populate cache
    await am.load("spa");

    // Capture I/O call count before cached-only preload — must not increase
    const callsBefore = vi.mocked(LoadAssetContainerAsync).mock.calls.length;

    // Now preload with only cached IDs
    await am.preload(["spa"]);

    // Should NOT trigger any additional I/O
    expect(vi.mocked(LoadAssetContainerAsync).mock.calls.length).toBe(
      callsBefore
    );
    expect(am.cacheSize).toBe(1);
  });

  // ── AC-p7: lifecycle guards ──────────────────────────────────

  it("should throw AssetError when called before init (AC-p7)", async () => {
    const engine = createEngine();
    const menuScene = new Scene(engine);
    const raceScene = new Scene(engine);

    const am = new AssetManager();

    // Not yet initialized — should throw
    await expect(am.preload(["spa"])).rejects.toThrow(AssetError);
    await expect(am.preload(["spa"])).rejects.toThrow("Not initialized");

    // Verify it works after init (regression check)
    am.init(menuScene, raceScene);
    await expect(am.preload([])).resolves.toBeUndefined();

    menuScene.dispose();
    raceScene.dispose();
    engine.dispose();
  });

  it("should throw AssetError when called after dispose (AC-p7)", async () => {
    const fx = createFixture();
    createdFixtures.push(fx);
    const { am } = fx;

    am.dispose();

    // After dispose — should throw
    await expect(am.preload(["spa"])).rejects.toThrow(AssetError);
    await expect(am.preload(["spa"])).rejects.toThrow("Already disposed");
  });

  // ── Concurrency proof (F3 from code review) ────────────────

  it("should start all loads before any complete (concurrency proof)", async () => {
    const fx = createFixture();
    createdFixtures.push(fx);
    const { am } = fx;

    am.registerManifest("a", makeManifest("a"));
    am.registerManifest("b", makeManifest("b"));
    am.registerManifest("c", makeManifest("c"));

    const started: string[] = [];
    const completed: string[] = [];
    const resolvers: Array<() => void> = [];

    vi.mocked(LoadAssetContainerAsync).mockImplementation(
      async (filename: string) => {
        started.push(filename);
        // Block until resolver is called
        await new Promise<void>((r) => {
          resolvers.push(r);
        });
        completed.push(filename);
        return fakeContainer();
      }
    );

    const promise = am.preload(["a", "b", "c"]);

    // All three mock calls happen synchronously before preload's first await
    // (see _loadAssetContainer → LoadAssetContainerAsync mock), so by the
    // time preload returns its promise all loads have already started.
    // No microtask settling needed. (CR25)
    expect(started).toHaveLength(3);
    // None should have completed yet
    expect(completed).toHaveLength(0);

    // Unblock all
    for (const r of resolvers) r();
    await promise;

    expect(completed).toHaveLength(3);
  });

  // ── Multi-failure (F3 from code review) ────────────────────

  it("should emit asset.error for each failing asset and reject with first error (multi-failure)", async () => {
    const bus = new EventBus();
    bus.init();
    const fx = createFixture(bus);
    createdFixtures.push(fx);
    const { am } = fx;

    am.registerManifest("a", makeManifest("a"));
    am.registerManifest("b", makeManifest("b"));
    am.registerManifest("c", makeManifest("c"));

    vi.mocked(LoadAssetContainerAsync).mockImplementation(
      async (filename: string) => {
        if (filename === "a.glb") throw new Error("Error A");
        if (filename === "b.glb") throw new Error("Error B");
        return fakeContainer();
      }
    );

    const errorEvents: any[] = [];
    bus.on("asset.error", (payload) => errorEvents.push(payload));

    await expect(am.preload(["a", "b", "c"])).rejects.toThrow();

    // Both failures should emit asset.error
    expect(errorEvents).toHaveLength(2);
    const errorIds = errorEvents.map((e) => e.assetId).sort();
    expect(errorIds).toEqual(["a", "b"]);

    // Successful asset should still be cached
    expect(am.cacheSize).toBe(1);
  });

  // ── Non-Error throw coverage (line 462) ────────────────────

  it("should wrap non-Error throws into Error instances", async () => {
    const fx = createFixture();
    createdFixtures.push(fx);
    const { am } = fx;

    am.registerManifest("a", makeManifest("a"));

    // Throw a string, not an Error
    vi.mocked(LoadAssetContainerAsync).mockRejectedValue("raw string error");

    await expect(am.preload(["a"])).rejects.toThrow("raw string error");
  });

  // ── Batch event payload (AC-p5) ───────────────────────────

  it("should emit batch start with only uncached IDs in payload", async () => {
    const bus = new EventBus();
    bus.init();
    const fx = createFixture(bus);
    createdFixtures.push(fx);
    const { am } = fx;

    am.registerManifest("cached", makeManifest("cached"));
    am.registerManifest("fresh", makeManifest("fresh"));

    vi.mocked(LoadAssetContainerAsync).mockResolvedValue(fakeContainer());

    // Pre-populate cache
    await am.load("cached");

    let startPayload: { ids: string[] } | null = null;
    bus.on("asset.load.start", (payload) => {
      startPayload = payload as { ids: string[] };
    });

    await am.preload(["cached", "fresh"]);

    // Batch start should only include uncached IDs
    expect(startPayload?.ids).toEqual(["fresh"]);
  });

  // ── Pending-load deduplication ──────────────────────────────

  it("should deduplicate concurrent loads for the same ID", async () => {
    const fx = createFixture();
    createdFixtures.push(fx);
    const { am } = fx;

    am.registerManifest("a", makeManifest("a"));

    let callCount = 0;
    vi.mocked(LoadAssetContainerAsync).mockImplementation(async () => {
      callCount++;
      // Simulate slow load
      await new Promise((r) => setTimeout(r, 50));
      return fakeContainer();
    });

    // Fire two loads for the same ID concurrently
    const p1 = am.load("a");
    const p2 = am.load("a");

    await Promise.all([p1, p2]);

    // Only one actual load should have been made
    expect(callCount).toBe(1);
  });
});
