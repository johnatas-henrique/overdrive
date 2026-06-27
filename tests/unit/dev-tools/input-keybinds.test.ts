// @vitest-environment happy-dom
/**
 * @fileoverview Story 002 — Input Keybinds for Dev Tools.
 *
 * Tests keyboard keybind handling: toggle key, reload key, minimise key,
 * preventDefault behaviour, and app.ts wiring for initDevTools.
 *
 * @see TR-DVT-007 — Dev-menu keybinds (configurable via devTools.keys.*)
 * @see ADR-0009 — Dev Tools Architecture
 * @see Control Manifest D5 — Toggle/reload keys polled via keyboard path
 */

import { Observable } from "@babylonjs/core/Misc/observable";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock Babylon.js SceneInstrumentation
// The mock object uses vi.hoisted() so it's available when vi.mock factory runs.
// The shared reference lets tests mutate counters between refresh cycles.
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

const mockReload = vi.hoisted(() =>
  vi.fn<() => Array<{ key: string; old: unknown; new: unknown }>>(() => [])
);

const mockGetConfigManager = vi.hoisted(() =>
  vi.fn(() => ({ reload: mockReload }))
);

vi.mock("@babylonjs/core/Instrumentation/sceneInstrumentation", () => ({
  SceneInstrumentation: vi.fn(function mockConstructor() {
    return mockInstrumentation;
  }),
}));

vi.mock("@/foundation/config/config-manager", () => ({
  getConfigManager: mockGetConfigManager,
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are established
// ---------------------------------------------------------------------------

import { DEV_TOOLS_KEYS } from "@/config/dev-tools-config";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Reset mock reload to default behaviour between tests. */
function resetMockReload(): void {
  mockGetConfigManager.mockReset();
  mockGetConfigManager.mockReturnValue({ reload: mockReload });
  mockReload.mockReset();
  mockReload.mockReturnValue([]);
}

/**
 * Create mock engine and scene objects, plus a canvas container in the DOM.
 */
function createMocks(): {
  engine: {
    getRenderingCanvas: () => HTMLCanvasElement;
    onEndFrameObservable: Observable<unknown>;
    getDeltaTime: () => number;
  };
  scene: { meshes: unknown[] };
} {
  const container = document.createElement("div");
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  document.body.appendChild(container);

  return {
    engine: {
      getRenderingCanvas: () => canvas,
      onEndFrameObservable: new Observable<unknown>(),
      getDeltaTime: () => 16.667,
    },
    scene: {
      meshes: [{}, {}, {}],
    },
  };
}

function cleanDOM(): void {
  document.body.innerHTML = "";
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Story 002 — Input Keybinds", () => {
  beforeEach(() => {
    cleanDOM();
    vi.stubEnv("DEV", true);
    resetMockReload();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    cleanDOM();
  });

  // =======================================================================
  // AC-2a: Toggle key (backtick) toggles overlay visibility
  // =======================================================================

  describe("AC-2a: Toggle key toggles overlay visibility", () => {
    it("should toggle isVisible state on toggle key press", async () => {
      vi.resetModules();
      const { initDevTools, getDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();
      await initDevTools(mocks.engine as never, mocks.scene as never);

      const dt = getDevTools();
      expect(dt.isVisible()).toBe(false);

      // First press — visible
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.toggle })
      );
      expect(dt.isVisible()).toBe(true);

      // Second press — hidden
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.toggle })
      );
      expect(dt.isVisible()).toBe(false);

      dt.dispose();
    });

    it("should create DOM only on first toggle press (lazy init)", async () => {
      vi.resetModules();
      const { initDevTools, getDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();
      await initDevTools(mocks.engine as never, mocks.scene as never);

      const dt = getDevTools();
      expect(document.getElementById("dev-overlay")).toBeNull();

      // Toggle 3 times: visible → hidden → visible
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.toggle })
      );
      expect(document.getElementById("dev-overlay")).not.toBeNull();

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.toggle })
      );

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.toggle })
      );

      // DOM still exists (created once on first toggle)
      expect(document.getElementById("dev-overlay")).not.toBeNull();

      dt.dispose();
    });
  });

  // =======================================================================
  // AC-2b: preventDefault when overlay active
  // =======================================================================

  describe("AC-2b: preventDefault when overlay active", () => {
    it("should call preventDefault on toggle key when overlay is visible", async () => {
      vi.resetModules();
      const { initDevTools, getDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();
      await initDevTools(mocks.engine as never, mocks.scene as never);

      const dt = getDevTools();
      dt.toggle(); // make visible

      const event = new KeyboardEvent("keydown", {
        key: DEV_TOOLS_KEYS.toggle,
      });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalledOnce();

      dt.dispose();
    });

    it("should call preventDefault on reload key when overlay is visible", async () => {
      vi.resetModules();
      const { initDevTools, getDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();
      await initDevTools(mocks.engine as never, mocks.scene as never);

      const dt = getDevTools();
      dt.toggle(); // make visible

      const event = new KeyboardEvent("keydown", {
        key: DEV_TOOLS_KEYS.reload,
      });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalledOnce();

      dt.dispose();
    });

    it("should NOT call preventDefault on toggle key when overlay is hidden", async () => {
      vi.resetModules();
      const { initDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();
      await initDevTools(mocks.engine as never, mocks.scene as never);

      const event = new KeyboardEvent("keydown", {
        key: DEV_TOOLS_KEYS.toggle,
      });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      document.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("should NOT call reload when overlay is hidden", async () => {
      vi.resetModules();
      const { initDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();
      await initDevTools(mocks.engine as never, mocks.scene as never);

      // Overlay is hidden by default
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.reload })
      );

      expect(mockReload).not.toHaveBeenCalled();
    });

    it("should NOT call preventDefault for non-toggle/reload keys", async () => {
      vi.resetModules();
      const { initDevTools, getDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();
      await initDevTools(mocks.engine as never, mocks.scene as never);

      const dt = getDevTools();
      dt.toggle(); // make visible

      const event = new KeyboardEvent("keydown", { key: "Escape" });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      document.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();

      dt.dispose();
    });
  });

  // =======================================================================
  // AC-6a: Reload key triggers config reload
  // =======================================================================

  describe("AC-6a: Reload key triggers config reload", () => {
    it("should call ConfigManager.reload() and show notification with changes", async () => {
      mockReload.mockReturnValueOnce([
        { key: "teams.macklen.motor", old: 3, new: 4 },
      ]);

      vi.resetModules();
      const { initDevTools, getDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();
      await initDevTools(mocks.engine as never, mocks.scene as never);

      const dt = getDevTools();
      dt.toggle(); // make overlay visible

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.reload })
      );

      expect(mockReload).toHaveBeenCalledOnce();

      // Check notification in overlay
      const notification = document.querySelector(".dev-notification");
      expect(notification).not.toBeNull();
      expect(notification?.textContent).toBe(
        "config reloaded — teams.macklen.motor: 3 → 4"
      );

      dt.dispose();
    });

    it("should show 'no changes' notification when reload returns empty", async () => {
      mockReload.mockReturnValueOnce([]);

      vi.resetModules();
      const { initDevTools, getDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();
      await initDevTools(mocks.engine as never, mocks.scene as never);

      const dt = getDevTools();
      dt.toggle(); // make overlay visible

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.reload })
      );

      const notification = document.querySelector(".dev-notification");
      expect(notification).not.toBeNull();
      expect(notification?.textContent).toBe("config reloaded — no changes");

      dt.dispose();
    });

    it("should format multiple changes with semicolon separator", async () => {
      mockReload.mockReturnValueOnce([
        { key: "teams.macklen.motor", old: 3, new: 4 },
        { key: "teams.redbull.engine", old: 5, new: 6 },
      ]);

      vi.resetModules();
      const { initDevTools, getDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();
      await initDevTools(mocks.engine as never, mocks.scene as never);

      const dt = getDevTools();
      dt.toggle(); // make overlay visible

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.reload })
      );

      const notification = document.querySelector(".dev-notification");
      expect(notification).not.toBeNull();
      expect(notification?.textContent).toBe(
        "config reloaded — teams.macklen.motor: 3 → 4; teams.redbull.engine: 5 → 6"
      );

      dt.dispose();
    });
  });

  // =======================================================================
  // AC-6b: Minimise key toggles compact mode
  // =======================================================================

  describe("AC-6b: Minimise key toggles compact mode", () => {
    it("should toggle setMinimised state on minimise key press", async () => {
      vi.resetModules();
      const { initDevTools, getDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();
      await initDevTools(mocks.engine as never, mocks.scene as never);

      const dt = getDevTools();
      const setMinimisedSpy = vi.spyOn(dt, "setMinimised");
      dt.toggle(); // make overlay visible

      // First press — minimise
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.minimise })
      );
      expect(setMinimisedSpy).toHaveBeenCalledWith(true);

      // Second press — restore
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.minimise })
      );
      expect(setMinimisedSpy).toHaveBeenCalledWith(false);

      dt.dispose();
    });
  });

  // =======================================================================
  // AC-2c: initDevTools wiring in app.ts
  // =======================================================================

  describe("AC-2c: initDevTools wiring in app.ts", () => {
    it("should initialise the singleton so getDevTools() returns an instance", async () => {
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

    it("should NOT initialise when DEV is false (production build)", async () => {
      vi.stubEnv("DEV", false);
      vi.resetModules();
      const { initDevTools, getDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();

      await initDevTools(mocks.engine as never, mocks.scene as never);

      expect(() => getDevTools()).toThrow("DevTools not initialized");
    });
  });

  // =======================================================================
  // AC-7b: Edge cases — idempotency and error recovery
  // =======================================================================

  describe("AC-7b: Edge cases — idempotency and error recovery", () => {
    it("should return the same dispose function when initKeybinds is called twice", async () => {
      vi.resetModules();
      const { initKeybinds } = await import("@/core/dev-tools/keybinds");
      const dispose1 = initKeybinds();

      // Clear the global cleanup handle so the second call skips cleanup
      // and hits the _disposeKeybindListener guard (line 72)
      delete (globalThis as Record<string, unknown>)
        .__DEV_TOOLS_KEYBINDS_CLEANUP;

      const dispose2 = initKeybinds();

      expect(dispose1).toBe(dispose2);

      dispose1();
    });

    it("should silently skip reload when ConfigManager is not initialized", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      mockGetConfigManager.mockImplementation(() => {
        throw new Error("ConfigManager not initialized");
      });

      vi.resetModules();
      const { initDevTools, getDevTools } = await import("@/core/dev-tools");
      const mocks = createMocks();
      await initDevTools(mocks.engine as never, mocks.scene as never);

      const dt = getDevTools();
      dt.toggle();

      // Press reload key — should not throw, no notification
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.reload })
      );

      const notification = document.querySelector(".dev-notification");
      expect(notification).toBeNull();

      dt.dispose();
    });
  });
});
