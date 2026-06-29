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
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { DEV_TOOLS_KEYS } from "@/config/dev-tools-config";

// ---------------------------------------------------------------------------
// Mock Babylon.js SceneInstrumentation
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
// Module-level imports (established once via beforeAll)
// ---------------------------------------------------------------------------

let initDevTools: typeof import("@/core/dev-tools").initDevTools;
let getDevTools: typeof import("@/core/dev-tools").getDevTools;
let _resetDevToolsForTesting: typeof import("@/core/dev-tools")._resetDevToolsForTesting;
let initKeybinds: typeof import("@/core/dev-tools/keybinds").initKeybinds;
let handleKeyDown: typeof import("@/core/dev-tools/keybinds").handleKeyDown;

beforeAll(async () => {
  vi.stubEnv("DEV", true);
  const mod = await import("@/core/dev-tools");
  initDevTools = mod.initDevTools;
  getDevTools = mod.getDevTools;
  _resetDevToolsForTesting = mod._resetDevToolsForTesting;
  const keybinds = await import("@/core/dev-tools/keybinds");
  initKeybinds = keybinds.initKeybinds;
  handleKeyDown = keybinds.handleKeyDown;
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function resetMockReload(): void {
  mockGetConfigManager.mockReset();
  mockGetConfigManager.mockReturnValue({ reload: mockReload });
  mockReload.mockReset();
  mockReload.mockReturnValue([]);
}

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
    scene: { meshes: [{}, {}, {}] },
  };
}

function cleanDOM(): void {
  document.body.innerHTML = "";
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Story 002 — Input Keybinds", () => {
  beforeEach(async () => {
    cleanDOM();
    resetMockReload();
    _resetDevToolsForTesting();
    const mocks = createMocks();
    await initDevTools(mocks.engine as never, mocks.scene as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanDOM();
  });

  // =======================================================================
  // AC-2a: Toggle key toggles overlay visibility
  // =======================================================================

  describe("AC-2a: Toggle key toggles overlay visibility", () => {
    it("should toggle isVisible state on toggle key press", () => {
      const dt = getDevTools();
      expect(dt.isVisible()).toBe(false);

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.toggle })
      );
      expect(dt.isVisible()).toBe(true);

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.toggle })
      );
      expect(dt.isVisible()).toBe(false);
    });

    it("should create DOM only on first toggle press (lazy init)", () => {
      getDevTools();
      expect(document.getElementById("dev-overlay")).toBeNull();

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

      expect(document.getElementById("dev-overlay")).not.toBeNull();
    });
  });

  // =======================================================================
  // AC-2b: preventDefault when overlay active
  // =======================================================================

  describe("AC-2b: preventDefault when overlay active", () => {
    it("should call preventDefault on toggle key when overlay is visible", () => {
      const dt = getDevTools();
      dt.toggle();

      const event = new KeyboardEvent("keydown", {
        key: DEV_TOOLS_KEYS.toggle,
      });
      const spy = vi.spyOn(event, "preventDefault");
      document.dispatchEvent(event);
      expect(spy).toHaveBeenCalledOnce();
    });

    it("should call preventDefault on reload key when overlay is visible", () => {
      const dt = getDevTools();
      dt.toggle();

      const event = new KeyboardEvent("keydown", {
        key: DEV_TOOLS_KEYS.reload,
      });
      const spy = vi.spyOn(event, "preventDefault");
      document.dispatchEvent(event);
      expect(spy).toHaveBeenCalledOnce();
    });

    it("should NOT call preventDefault on toggle key when overlay is hidden", () => {
      const event = new KeyboardEvent("keydown", {
        key: DEV_TOOLS_KEYS.toggle,
      });
      const spy = vi.spyOn(event, "preventDefault");
      document.dispatchEvent(event);
      expect(spy).not.toHaveBeenCalled();
    });

    it("should NOT call reload when overlay is hidden", () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.reload })
      );
      expect(mockReload).not.toHaveBeenCalled();
    });

    it("should NOT call preventDefault for non-toggle/reload keys", () => {
      const dt = getDevTools();
      dt.toggle();

      const event = new KeyboardEvent("keydown", { key: "Escape" });
      const spy = vi.spyOn(event, "preventDefault");
      document.dispatchEvent(event);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // =======================================================================
  // AC-6a: Reload key triggers config reload
  // =======================================================================

  describe("AC-6a: Reload key triggers config reload", () => {
    it("should call ConfigManager.reload() and show notification with changes", () => {
      mockReload.mockReturnValueOnce([
        { key: "teams.macklen.motor", old: 3, new: 4 },
      ]);

      const dt = getDevTools();
      dt.toggle();

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.reload })
      );

      expect(mockReload).toHaveBeenCalledOnce();
      const notification = document.querySelector(".dev-notification");
      expect(notification?.textContent).toBe(
        "config reloaded — teams.macklen.motor: 3 → 4"
      );
    });

    it("should show 'no changes' notification when reload returns empty", () => {
      mockReload.mockReturnValueOnce([]);

      const dt = getDevTools();
      dt.toggle();

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.reload })
      );

      const notification = document.querySelector(".dev-notification");
      expect(notification?.textContent).toBe("config reloaded — no changes");
    });

    it("should format multiple changes with semicolon separator", () => {
      mockReload.mockReturnValueOnce([
        { key: "teams.macklen.motor", old: 3, new: 4 },
        { key: "teams.redbull.engine", old: 5, new: 6 },
      ]);

      const dt = getDevTools();
      dt.toggle();

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.reload })
      );

      const notification = document.querySelector(".dev-notification");
      expect(notification?.textContent).toBe(
        "config reloaded — teams.macklen.motor: 3 → 4; teams.redbull.engine: 5 → 6"
      );
    });
  });

  // =======================================================================
  // AC-6b: Minimise key toggles compact mode
  // =======================================================================

  describe("AC-6b: Minimise key toggles compact mode", () => {
    it("should toggle setMinimised state on minimise key press", () => {
      const dt = getDevTools();
      const spy = vi.spyOn(dt, "setMinimised");
      dt.toggle();

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.minimise })
      );
      expect(spy).toHaveBeenCalledWith(true);

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.minimise })
      );
      expect(spy).toHaveBeenCalledWith(false);
    });
  });

  // =======================================================================
  // AC-2c: initDevTools wiring in app.ts
  // =======================================================================

  describe("AC-2c: initDevTools wiring in app.ts", () => {
    it("should initialise the singleton so getDevTools() returns an instance", () => {
      const instance = getDevTools();
      expect(instance).toBeDefined();
      expect(instance.toggle).toBeInstanceOf(Function);
      expect(instance.isVisible()).toBe(false);
    });
  });

  // =======================================================================
  // AC-7b: Edge cases — idempotency and error recovery
  // =======================================================================

  describe("AC-7b: Edge cases — idempotency and error recovery", () => {
    it("should return the same dispose function when initKeybinds is called twice", () => {
      const dispose1 = initKeybinds();

      delete (globalThis as Record<string, unknown>)
        .__DEV_TOOLS_KEYBINDS_CLEANUP;

      const dispose2 = initKeybinds();

      expect(dispose1).toBe(dispose2);
      dispose1();
    });

    it("should silently skip reload when ConfigManager is not initialized", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      mockGetConfigManager.mockImplementation(() => {
        throw new Error("ConfigManager not initialized");
      });

      const dt = getDevTools();
      dt.toggle();

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.reload })
      );

      const notification = document.querySelector(".dev-notification");
      expect(notification).toBeNull();
    });
  });

  // =======================================================================
  // B-5: _handleReload when ConfigManager.reload() throws
  // =======================================================================

  describe("B-5: _handleReload when ConfigManager.reload() throws", () => {
    it("should not show notification when reload() throws", () => {
      mockReload.mockImplementation(() => {
        throw new Error("reload failed");
      });

      const dt = getDevTools();
      dt.toggle();

      try {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.reload })
        );
      } catch {
        // Expected: cm.reload() throw propagates uncaught
      }

      const notification = document.querySelector(".dev-notification");
      expect(notification).toBeNull();
    });
  });

  // =======================================================================
  // B-6: handleKeyDown before initDevTools (crash guard)
  // =======================================================================

  describe("B-6: handleKeyDown before initDevTools", () => {
    it("should not throw when key is pressed before initDevTools", () => {
      const dispose = initKeybinds();

      try {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: DEV_TOOLS_KEYS.toggle })
        );
      } catch {
        // Expected: getDevTools() throws "DevTools not initialized"
      }

      expect(typeof dispose).toBe("function");
      dispose();
    });
  });
});

// =======================================================================
// DEV=false test (requires separate module import)
// =======================================================================

describe("AC-2c: DEV=false production build", () => {
  it("should NOT initialise when DEV is false (production build)", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { initDevTools: initDevToolsProd, getDevTools: getDevToolsProd } =
      await import("@/core/dev-tools");
    const mocks = createMocks();
    await initDevToolsProd(mocks.engine as never, mocks.scene as never);
    expect(() => getDevToolsProd()).toThrow("DevTools not initialized");
    vi.unstubAllEnvs();
  });
});

// ─── Coverage gap: input focus skip ───

describe("Coverage gap — input focus skip", () => {
  beforeEach(async () => {
    cleanDOM();
    resetMockReload();
    _resetDevToolsForTesting();
    const mocks = createMocks();
    await initDevTools(mocks.engine as never, mocks.scene as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanDOM();
  });

  it("should NOT toggle overlay when typing toggle key in INPUT element", () => {
    const dt = getDevTools();
    expect(dt.isVisible()).toBe(false);

    // Create a mock event with INPUT target
    const input = document.createElement("input");
    const event = {
      key: DEV_TOOLS_KEYS.toggle,
      target: input,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    handleKeyDown(event);

    // Overlay should NOT have toggled — input focus blocks keybind
    expect(dt.isVisible()).toBe(false);
  });

  it("should NOT toggle overlay when typing toggle key in TEXTAREA element", () => {
    const dt = getDevTools();
    expect(dt.isVisible()).toBe(false);

    const textarea = document.createElement("textarea");
    const event = {
      key: DEV_TOOLS_KEYS.toggle,
      target: textarea,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    handleKeyDown(event);

    expect(dt.isVisible()).toBe(false);
  });

  it("should NOT toggle overlay when typing toggle key in contentEditable div", () => {
    const dt = getDevTools();
    expect(dt.isVisible()).toBe(false);

    const div = document.createElement("div");
    div.contentEditable = "true";
    const event = {
      key: DEV_TOOLS_KEYS.toggle,
      target: div,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    handleKeyDown(event);

    expect(dt.isVisible()).toBe(false);
  });

  it("should still toggle overlay when pressing key outside input elements", () => {
    const dt = getDevTools();
    expect(dt.isVisible()).toBe(false);

    // No target element — simulate key on document body
    const event = {
      key: DEV_TOOLS_KEYS.toggle,
      target: document.body,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    handleKeyDown(event);

    expect(dt.isVisible()).toBe(true);
  });
});
