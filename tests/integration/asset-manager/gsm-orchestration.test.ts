// @vitest-environment happy-dom

/**
 * Integration tests: AssetManager GSM orchestration (Story 005b).
 *
 * Tests that the AssetManager correctly subscribes to GSM state transitions
 * via the Event Bus and reacts to each state entry by preloading assets,
 * switching active scenes, or unloading race resources.
 *
 * @see Story 005b — GSM Orchestration
 * @see ADR-0003 — Two-Scene Architecture & Asset Lifecycle
 * @see TR-AM-008 — GSM orchestration requirements
 */

import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Scene } from "@babylonjs/core/scene";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetManager } from "@/asset-manager/asset-manager";
import { CAR_MANIFEST_IDS } from "@/config/assets/cars";
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

function fakeContainer(): any {
  return {
    addAllToScene: vi.fn(),
    removeAllFromScene: vi.fn(),
    dispose: vi.fn(),
    meshes: [],
    transformNodes: [],
  };
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

interface Fixture {
  engine: NullEngine;
  bus: EventBus;
  am: AssetManager;
  menuScene: Scene;
  raceScene: Scene;
}

function createFixture(): Fixture {
  const engine = createEngine();
  const menuScene = new Scene(engine);
  const raceScene = new Scene(engine);
  const bus = new EventBus();
  bus.init();
  const am = new AssetManager(bus);
  am.init(menuScene, raceScene);
  return { engine, bus, am, menuScene, raceScene };
}

const createdFixtures: Fixture[] = [];

afterEach(() => {
  for (const fx of createdFixtures) {
    vi.clearAllMocks();
    fx.am.dispose();
    fx.menuScene.dispose();
    fx.raceScene.dispose();
    fx.engine.dispose();
  }
  createdFixtures.length = 0;
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("AssetManager GSM orchestration", () => {
  // ── AC-g1: Loading→Menu triggers car preload ─────────────────

  it("should preload car manifests on Loading→Menu transition (AC-g1)", async () => {
    const fx = createFixture();
    createdFixtures.push(fx);

    vi.mocked(LoadAssetContainerAsync).mockResolvedValue(fakeContainer());

    const preloadSpy = vi.spyOn(fx.am, "preload");

    // Simulate GSM: Loading→Menu
    fx.bus.emit("gsm.state.entered", { from: "Loading", to: "Menu" });

    // preload should be called with all car manifest IDs
    expect(preloadSpy).toHaveBeenCalledTimes(1);
    expect(preloadSpy).toHaveBeenCalledWith([...CAR_MANIFEST_IDS]);

    preloadSpy.mockRestore();
  });

  it("should NOT preload on non-Loading→Menu transitions (AC-g1 negative)", () => {
    const fx = createFixture();
    createdFixtures.push(fx);

    const preloadSpy = vi.spyOn(fx.am, "preload").mockResolvedValue();

    // Racing→PostRace should NOT trigger preload
    fx.bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });

    expect(preloadSpy).not.toHaveBeenCalled();

    preloadSpy.mockRestore();
  });

  // ── AC-g2: Menu→PreRace triggers scene switch + track load ───

  it("should switch to race scene and load track on Menu→PreRace (AC-g2)", () => {
    const fx = createFixture();
    createdFixtures.push(fx);

    fx.am.setTrackId("spa");

    const sceneSpy = vi.spyOn(fx.am, "setActiveScene");
    const loadSpy = vi.spyOn(fx.am, "load").mockResolvedValue(fakeContainer());

    // Simulate GSM: Menu→PreRace
    fx.bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });

    // setActiveScene('race') called first
    expect(sceneSpy).toHaveBeenCalledWith("race");
    // load(trackId) called with the stored track ID
    expect(loadSpy).toHaveBeenCalledWith("spa");
    // setActiveScene must be called BEFORE load
    expect(sceneSpy.mock.invocationCallOrder[0]).toBeLessThan(
      loadSpy.mock.invocationCallOrder[0]
    );

    sceneSpy.mockRestore();
    loadSpy.mockRestore();
  });

  it("should skip load when no track ID is set on Menu→PreRace (AC-g2 edge)", () => {
    const fx = createFixture();
    createdFixtures.push(fx);

    const sceneSpy = vi.spyOn(fx.am, "setActiveScene");
    const loadSpy = vi.spyOn(fx.am, "load");

    // No setTrackId() — track is null
    fx.bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });

    // setActiveScene('race') still called
    expect(sceneSpy).toHaveBeenCalledWith("race");
    // load() NOT called (no track selected)
    expect(loadSpy).not.toHaveBeenCalled();

    sceneSpy.mockRestore();
    loadSpy.mockRestore();
  });

  // ── AC-g3: PostRace→Menu triggers unload + scene switch ─────

  it("should unload all and switch to menu on PostRace→Menu (AC-g3)", () => {
    const fx = createFixture();
    createdFixtures.push(fx);

    const unloadSpy = vi.spyOn(fx.am, "unloadAll");
    const sceneSpy = vi.spyOn(fx.am, "setActiveScene");

    // Simulate GSM: PostRace→Menu
    fx.bus.emit("gsm.state.entered", { from: "PostRace", to: "Menu" });

    expect(unloadSpy).toHaveBeenCalledTimes(1);
    expect(sceneSpy).toHaveBeenCalledWith("menu");

    // Verify unloadAll() is called BEFORE setActiveScene('menu')
    expect(unloadSpy.mock.invocationCallOrder[0]).toBeLessThan(
      sceneSpy.mock.invocationCallOrder[0]
    );

    unloadSpy.mockRestore();
    sceneSpy.mockRestore();
  });

  // ── AC-g4: Subscription lifecycle ────────────────────────────

  it("should subscribe on init and unsubscribe on dispose (AC-g4)", () => {
    const fx = createFixture();
    createdFixtures.push(fx);

    // After init, there should be a subscription for gsm.state.entered
    const subsBefore = fx.bus.getSubscriptions();
    expect(subsBefore.get("gsm.state.entered")).toBe(1);

    // After dispose, subscription should be released
    fx.am.dispose();
    const subsAfter = fx.bus.getSubscriptions();
    expect(subsAfter.get("gsm.state.entered")).toBeUndefined();

    // Remove from cleanup array since we already disposed
    createdFixtures.pop();
  });

  // ── AC-g5: Car manifest count ─────────────────────────────────

  it("should export exactly 8 car manifest IDs (AC-g5)", () => {
    expect(CAR_MANIFEST_IDS).toHaveLength(8);
  });

  it("should not import Babylon.js modules (AC-g5 edge)", () => {
    const content = readFileSync("src/config/assets/cars.ts", "utf-8");
    expect(content).not.toMatch(/from ["']@babylonjs/);
  });

  // ── Fire-and-forget error handling ───────────────────────────

  it("should silently catch preload errors during Loading→Menu (fire-and-forget)", async () => {
    const fx = createFixture();
    createdFixtures.push(fx);

    // Make preload reject
    vi.spyOn(fx.am, "preload").mockRejectedValue(new Error("load failed"));

    // Emit Loading→Menu — should not throw
    expect(() => {
      fx.bus.emit("gsm.state.entered", { from: "Loading", to: "Menu" });
    }).not.toThrow();

    // Wait for async handler to settle
    await new Promise((r) => setTimeout(r, 10));
  });

  it("should silently catch load errors during Menu→PreRace (fire-and-forget)", async () => {
    const fx = createFixture();
    createdFixtures.push(fx);

    fx.am.setTrackId("spa");

    // Make load reject
    vi.spyOn(fx.am, "load").mockRejectedValue(new Error("track load failed"));

    // Emit Menu→PreRace — should not throw
    expect(() => {
      fx.bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });
    }).not.toThrow();

    // Wait for async handler to settle
    await new Promise((r) => setTimeout(r, 10));
  });

  it("should silently catch sync errors from _onGsmEvent via outer catch", async () => {
    const fx = createFixture();
    createdFixtures.push(fx);

    // Make setActiveScene throw — the async _onGsmEvent wraps this
    // in a rejected promise, which the outer .catch() handles
    vi.spyOn(fx.am, "setActiveScene").mockImplementation(() => {
      throw new Error("scene switch failed");
    });

    // Emit Menu→PreRace (any transition that touches setActiveScene)
    expect(() => {
      fx.bus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });
    }).not.toThrow();

    await new Promise((r) => setTimeout(r, 10));
  });
});
