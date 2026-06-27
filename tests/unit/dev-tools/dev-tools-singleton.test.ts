// @vitest-environment happy-dom
/**
 * @fileoverview Tests for Dev Tools singleton pattern (index.ts).
 *
 * Covers initDevTools(), getDevTools(), and devTools proxy.
 * Uses vi.resetModules() to get fresh module state per test.
 *
 * @see ADR-0009 — Dev Tools Architecture
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock Babylon.js dependencies
// ---------------------------------------------------------------------------

const mockInstrumentation = vi.hoisted(() => ({
  captureFrameTime: false,
  captureRenderTime: false,
  capturePhysicsTime: false,
  frameTimeCounter: { current: 16.5 },
  drawCallsCounter: { current: 120 },
  physicsTimeCounter: { current: 0.5 },
  dispose: vi.fn(),
}));

vi.mock("@babylonjs/core/Instrumentation/sceneInstrumentation", () => ({
  SceneInstrumentation: vi.fn(function mockConstructor() {
    return mockInstrumentation;
  }),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMocks() {
  const container = document.createElement("div");
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  document.body.appendChild(container);

  const observers: Array<() => void> = [];
  const onEndFrameObservable = {
    add: (callback: () => void) => {
      observers.push(callback);
      return { remove: vi.fn() };
    },
    remove: vi.fn(),
    notifyObservers: () => {
      for (const cb of observers) cb();
    },
    _observers: observers,
  };

  return {
    engine: {
      getRenderingCanvas: () => canvas,
      onEndFrameObservable,
      getDeltaTime: () => 16.667,
    },
    scene: { meshes: [{}, {}, {}] },
  };
}

function cleanDOM(): void {
  document.body.innerHTML = "";
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Dev Tools singleton (index.ts)", () => {
  beforeEach(() => {
    cleanDOM();
    vi.stubEnv("DEV", true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    cleanDOM();
  });

  // -----------------------------------------------------------------------
  // initDevTools
  // -----------------------------------------------------------------------

  describe("initDevTools", () => {
    it("should initialize the singleton with engine and scene", async () => {
      vi.resetModules();
      const { initDevTools, getDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();

      await initDevTools(mocks.engine as never, mocks.scene as never);
      const instance = getDevTools();

      expect(instance).toBeDefined();
      expect(instance.toggle).toBeInstanceOf(Function);
      expect(instance.isVisible()).toBe(false);

      instance.dispose();
    });

    it("should be a no-op on subsequent calls (idempotent)", async () => {
      vi.resetModules();
      const { initDevTools, getDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();

      await initDevTools(mocks.engine as never, mocks.scene as never);
      const first = getDevTools();

      await initDevTools(mocks.engine as never, mocks.scene as never);
      const second = getDevTools();

      expect(first).toBe(second);

      first.dispose();
    });

    it("should be a no-op when DEV is false", async () => {
      vi.stubEnv("DEV", false);
      vi.resetModules();
      const { initDevTools, getDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();

      await initDevTools(mocks.engine as never, mocks.scene as never);

      expect(() => getDevTools()).toThrow("DevTools not initialized");
    });
  });

  // -----------------------------------------------------------------------
  // getDevTools
  // -----------------------------------------------------------------------

  describe("getDevTools", () => {
    it("should throw if initDevTools was not called", async () => {
      vi.resetModules();
      const { getDevTools } = await import("@/core/dev-tools");

      expect(() => getDevTools()).toThrow("DevTools not initialized");
    });
  });

  // -----------------------------------------------------------------------
  // devTools proxy
  // -----------------------------------------------------------------------

  describe("devTools proxy", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    it("should throw when accessing properties before init", async () => {
      vi.resetModules();
      const { devTools } = await import("@/core/dev-tools");

      expect(() => devTools.toggle).toThrow("DevTools not initialized");
    });

    it("should delegate to the singleton after init", async () => {
      vi.resetModules();
      const { initDevTools, devTools } = await import("@/core/dev-tools");
      const mocks = createMocks();

      await initDevTools(mocks.engine as never, mocks.scene as never);

      expect(devTools.isVisible()).toBe(false);
      devTools.toggle();
      expect(devTools.isVisible()).toBe(true);

      devTools.dispose();
    });

    it("should bind methods correctly (this context)", async () => {
      vi.resetModules();
      const { initDevTools, devTools } = await import("@/core/dev-tools");
      const mocks = createMocks();

      await initDevTools(mocks.engine as never, mocks.scene as never);

      // Extract method via proxy — should still work
      const toggle = devTools.toggle;
      expect(() => toggle()).not.toThrow();

      devTools.dispose();
    });

    it("should return non-function properties directly", async () => {
      vi.resetModules();
      const { initDevTools, devTools } = await import("@/core/dev-tools");
      const mocks = createMocks();

      await initDevTools(mocks.engine as never, mocks.scene as never);

      // isVisible is a method, but when accessed as a property it returns the bound function
      // Access a non-existent property to hit the undefined path
      expect((devTools as Record<string, unknown>).nonExistent).toBeUndefined();

      devTools.dispose();
    });
  });
});
