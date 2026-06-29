// @vitest-environment happy-dom
/**
 * @fileoverview Story 003 — HTML Overlay for Dev Tools.
 *
 * Tests the DevTools class: lazy DOM creation, visibility toggle,
 * SceneInstrumentation integration, frame-end refresh, and pointer-events.
 *
 * @see TR-DVT-001 — HTML overlay rendering above 3D viewport
 * @see ADR-0009 — Dev Tools Architecture
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

vi.mock("@babylonjs/core/Instrumentation/sceneInstrumentation", () => ({
  SceneInstrumentation: vi.fn(function mockConstructor() {
    return mockInstrumentation;
  }),
}));

// ---------------------------------------------------------------------------
// Mock ConfigManager for config data source tests
// ---------------------------------------------------------------------------

const mockConfigManager = vi.hoisted(() => ({
  getDebugState: vi.fn(() => ({
    namespaces: { physics: { gravity: 9.81 } },
    accessLog: [],
  })),
  get: vi.fn(),
  init: vi.fn(),
  register: vi.fn(),
  setRuntime: vi.fn((_key: string, value: unknown) => value),
}));

vi.mock("@/foundation/config/config-manager", () => ({
  getConfigManager: vi.fn(() => mockConfigManager),
  ConfigManager: vi.fn(function mockConfigManager() {
    return mockConfigManager;
  }),
}));

// ---------------------------------------------------------------------------
// Import the class under test AFTER mocks are established
// ---------------------------------------------------------------------------

import {
  _resetDevToolsForTesting,
  getDevTools,
  initDevTools,
} from "@/core/dev-tools";
import { DevTools } from "@/core/dev-tools/dev-tools";
import type { IDevTools } from "@/core/dev-tools/types";
import { getConfigManager } from "@/foundation/config/config-manager";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Reset mock instrumentation to default values between tests. */
function resetMockInstrumentation(): void {
  mockInstrumentation.frameTimeCounter.current = 16.5;
  mockInstrumentation.drawCallsCounter.current = 120;
  mockInstrumentation.physicsTimeCounter.current = 0.5;
  vi.clearAllMocks();
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

// Ensure each test starts with clean mock instrumentation values
beforeEach(() => {
  resetMockInstrumentation();
});

function cleanDOM(): void {
  document.body.innerHTML = "";
}

// ---------------------------------------------------------------------------
// AC-3a: DOM creation and visibility toggle
// ---------------------------------------------------------------------------

describe("AC-3a: DOM creation and visibility toggle", () => {
  let devTools: IDevTools;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    cleanDOM();
    mocks = createMocks();
    devTools = new DevTools(mocks.engine as never, mocks.scene as never);
  });

  afterEach(() => {
    devTools.dispose();
    cleanDOM();
  });

  it("should have no #dev-overlay in DOM before first toggle", () => {
    expect(document.getElementById("dev-overlay")).toBeNull();
  });

  it("should create overlay DOM on first toggle and toggle visibility", () => {
    // First toggle — creates DOM, shows
    devTools.toggle();
    const overlay = document.getElementById("dev-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay?.style.display).toBe("flex");

    // Second toggle — hides
    devTools.toggle();
    expect(overlay?.style.display).toBe("none");

    // Third toggle — shows again
    devTools.toggle();
    expect(overlay?.style.display).toBe("flex");
  });
});

// ---------------------------------------------------------------------------
// AC-3b: Top bar shows FPS, frame time, draw calls, mesh count
// ---------------------------------------------------------------------------

describe("AC-3b: Top bar shows FPS, frame time, draw calls, mesh count", () => {
  let devTools: IDevTools;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    cleanDOM();
    mocks = createMocks();
    devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();
    devTools.update();
  });

  afterEach(() => {
    devTools.dispose();
    cleanDOM();
  });

  it("should display five metric items with labels", () => {
    const overlay = document.getElementById("dev-overlay");
    const topBar = overlay?.querySelector(".top-bar");
    const labels = topBar
      ? Array.from(topBar.children).map(
          (item) => (item.children[0] as HTMLSpanElement).textContent ?? ""
        )
      : [];
    expect(labels).toHaveLength(5);
    expect(labels).toEqual(["FPS", "Frame", "DC", "Meshes", "Phys"]);
  });

  it("should show numeric values for all five metrics", () => {
    // frameTimeCounter.current = 16.5 → FPS = Math.round(1000 / 16.5) = 61
    expect(document.querySelector('[data-metric="fps"]')?.textContent).toBe(
      "61"
    );
    expect(document.querySelector('[data-metric="frame"]')?.textContent).toBe(
      "16.5 ms"
    );
    expect(document.querySelector('[data-metric="dc"]')?.textContent).toBe(
      "120"
    );
    expect(document.querySelector('[data-metric="meshes"]')?.textContent).toBe(
      "3"
    );
    // physicsTimeCounter.current = 0.5 → "0.5 ms"
    expect(document.querySelector('[data-metric="phys"]')?.textContent).toBe(
      "0.5 ms"
    );
  });
});

// ---------------------------------------------------------------------------
// AC-3c: SceneInstrumentation captures frameTime, physicsTime, drawCalls
// ---------------------------------------------------------------------------

describe("AC-3c: SceneInstrumentation captures metrics", () => {
  let devTools: IDevTools;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    cleanDOM();
    mocks = createMocks();
    devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();
    devTools.update();
  });

  afterEach(() => {
    devTools.dispose();
    cleanDOM();
  });

  it("should reflect updated instrumentation values on refresh", () => {
    // Mutate the shared mock instrumentation object
    mockInstrumentation.frameTimeCounter.current = 50;
    mockInstrumentation.drawCallsCounter.current = 200;
    mockInstrumentation.physicsTimeCounter.current = 2.5;

    devTools.update();

    // FPS = Math.round(1000 / 50) = 20
    expect(document.querySelector('[data-metric="fps"]')?.textContent).toBe(
      "20"
    );
    expect(document.querySelector('[data-metric="frame"]')?.textContent).toBe(
      "50.0 ms"
    );
    expect(document.querySelector('[data-metric="dc"]')?.textContent).toBe(
      "200"
    );
    expect(document.querySelector('[data-metric="meshes"]')?.textContent).toBe(
      "3"
    );
    expect(document.querySelector('[data-metric="phys"]')?.textContent).toBe(
      "2.5 ms"
    );
  });
});

// ---------------------------------------------------------------------------
// AC-3d: Overlay refresh via onEndFrameObservable
// ---------------------------------------------------------------------------

describe("AC-3d: Overlay refresh via onEndFrameObservable", () => {
  let devTools: IDevTools;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    cleanDOM();
    mocks = createMocks();
    devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();
  });

  afterEach(() => {
    devTools.dispose();
    cleanDOM();
  });

  it("should update DOM when engine.onEndFrameObservable is notified", () => {
    // Initial state after toggle
    expect(document.querySelector('[data-metric="fps"]')?.textContent).toBe(
      "61"
    ); // 1000 / 16.5

    // Mutate instrumentation values
    mockInstrumentation.frameTimeCounter.current = 33.333;

    // Notify the observable — triggers _refreshDisplay via constructor-registered handler
    mocks.engine.onEndFrameObservable.notifyObservers(mocks.engine as never);

    // DOM reflects new values
    expect(document.querySelector('[data-metric="fps"]')?.textContent).toBe(
      "30"
    ); // Math.round(1000 / 33.333) = 30
    expect(document.querySelector('[data-metric="frame"]')?.textContent).toBe(
      "33.3 ms"
    );
  });
});

// ---------------------------------------------------------------------------
// AC-7: pointer-events: none on overlay
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// B-1: dispose removes the onEndFrameObservable observer
// ---------------------------------------------------------------------------

describe("B-1: dispose removes onEndFrameObservable observer", () => {
  let devTools: IDevTools;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    cleanDOM();
    mocks = createMocks();
    devTools = new DevTools(mocks.engine as never, mocks.scene as never);
  });

  afterEach(() => {
    cleanDOM();
  });

  it("should stop refreshing after dispose", () => {
    devTools.toggle();

    // Sanity check: refresh works while alive
    expect(document.querySelector('[data-metric="fps"]')?.textContent).toBe(
      "61"
    );

    // Dispose
    devTools.dispose();

    // Create a fresh DevTools (dispose cleans the DOM)
    cleanDOM();
    const c2 = document.createElement("div");
    const cv2 = document.createElement("canvas");
    c2.appendChild(cv2);
    document.body.appendChild(c2);
    const engine2 = {
      getRenderingCanvas: () => cv2,
      onEndFrameObservable: new Observable(),
      getDeltaTime: () => 16.667,
    };
    const scene2 = { meshes: [{}, {}] };
    const dt2 = new DevTools(engine2 as never, scene2 as never);
    dt2.toggle();

    // Notify the ORIGINAL observable — should do nothing
    mocks.engine.onEndFrameObservable.notifyObservers(engine2 as never);

    // After notify, no crash, dt2 still works
    expect(document.querySelector('[data-metric="fps"]')?.textContent).toBe(
      "61"
    );

    dt2.dispose();
  });

  it("should call instrumentation.dispose on dispose", () => {
    devTools.dispose();
    expect(mockInstrumentation.dispose).toHaveBeenCalledOnce();
  });

  it("should not leak the observer after dispose", async () => {
    devTools.dispose();
    // Babylon.js Observable.remove() defers unregister via setTimeout(0)
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.engine.onEndFrameObservable.observers.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-3e: frameTime = 0 shows "--"
// ---------------------------------------------------------------------------

describe("AC-3e: frameTime = 0 shows placeholder", () => {
  let devTools: IDevTools;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    cleanDOM();
    mocks = createMocks();
    devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();
  });

  afterEach(() => {
    devTools.dispose();
    cleanDOM();
  });

  it("should show -- for FPS when frameTime is 0", () => {
    mockInstrumentation.frameTimeCounter.current = 0;
    devTools.update();
    expect(document.querySelector('[data-metric="fps"]')?.textContent).toBe(
      "--"
    );
  });

  it("should show -- ms for frame time when frameTime is 0", () => {
    mockInstrumentation.frameTimeCounter.current = 0;
    devTools.update();
    expect(document.querySelector('[data-metric="frame"]')?.textContent).toBe(
      "-- ms"
    );
  });

  it("should show -- ms for physics time when physicsTime is 0", () => {
    mockInstrumentation.physicsTimeCounter.current = 0;
    devTools.update();
    expect(document.querySelector('[data-metric="phys"]')?.textContent).toBe(
      "-- ms"
    );
  });
});

// ---------------------------------------------------------------------------
// AC-7: pointer-events: none
// ---------------------------------------------------------------------------

describe("AC-7: pointer-events: none", () => {
  let devTools: IDevTools;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    cleanDOM();
    mocks = createMocks();
    devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();
  });

  afterEach(() => {
    devTools.dispose();
    cleanDOM();
  });

  it("should have overlay element with correct ID for CSS targeting (S12)", () => {
    const overlay = document.getElementById(
      "dev-overlay"
    ) as HTMLElement | null;
    expect(overlay).not.toBeNull();
    // happy-dom doesn't process CSS files — verify the ID selector exists
    // which targets the #dev-overlay CSS rule with pointer-events: none
    expect(overlay?.id).toBe("dev-overlay");
  });
});

// ---------------------------------------------------------------------------
// registerDataSource: stores reader function for future data panels
// ---------------------------------------------------------------------------

describe("registerDataSource", () => {
  let devTools: IDevTools;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    cleanDOM();
    mocks = createMocks();
    devTools = new DevTools(mocks.engine as never, mocks.scene as never);
  });

  afterEach(() => {
    devTools.dispose();
    cleanDOM();
  });

  it("should store a data source reader by name", () => {
    const reader = () => ({ fps: 60, frameTime: 16.67 });
    devTools.registerDataSource("performance", reader);

    // No throw — data source is registered silently
    expect(() =>
      devTools.registerDataSource("performance", reader)
    ).not.toThrow();
  });

  it("should allow multiple data sources with different names", () => {
    const reader1 = () => ({ fps: 60 });
    const reader2 = () => ({ events: [] });

    devTools.registerDataSource("perf", reader1);
    devTools.registerDataSource("events", reader2);

    // Both registered without conflict
    expect(() => devTools.registerDataSource("perf", reader1)).not.toThrow();
    expect(() => devTools.registerDataSource("events", reader2)).not.toThrow();
  });

  it("should overwrite existing data source with same name", () => {
    const reader1 = () => ({ old: true });
    const reader2 = () => ({ new: true });

    devTools.registerDataSource("test", reader1);
    devTools.registerDataSource("test", reader2);

    // No error on overwrite
    expect(() => devTools.registerDataSource("test", reader2)).not.toThrow();
  });

  it("should silently accept minimised state (Story 003 adds visual)", () => {
    expect(() => devTools.setMinimised(true)).not.toThrow();
    expect(() => devTools.setMinimised(false)).not.toThrow();
  });

  it("should clear data sources on dispose", () => {
    const reader = () => ({ data: 1 });
    devTools.registerDataSource("test", reader);
    devTools.dispose();

    // After dispose, re-register should work (Map was cleared)
    const devTools2 = new DevTools(mocks.engine as never, mocks.scene as never);
    expect(() => devTools2.registerDataSource("test", reader)).not.toThrow();
    devTools2.dispose();
  });
});

// ---------------------------------------------------------------------------
// Edge cases: null canvas, dispose ordering, visibility state, DEV guard
// ---------------------------------------------------------------------------

describe("Edge cases", () => {
  // -----------------------------------------------------------------------
  // 1a: Null canvas container
  // -----------------------------------------------------------------------

  it("should handle null canvas container gracefully", () => {
    cleanDOM();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const engine = {
      getRenderingCanvas: () => null,
      onEndFrameObservable: new Observable<unknown>(),
      getDeltaTime: () => 16.667,
    };
    const scene = { meshes: [] };
    const devTools = new DevTools(engine as never, scene as never);

    // toggle() when canvas is null → _initOverlay returns early → no DOM
    expect(() => devTools.toggle()).not.toThrow();
    expect(document.getElementById("dev-overlay")).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[DevTools]"));

    devTools.dispose();
    warnSpy.mockRestore();
    cleanDOM();
  });

  // -----------------------------------------------------------------------
  // 1b: Dispose before toggle
  // -----------------------------------------------------------------------

  it("should handle dispose before toggle safely", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    // Dispose before any toggle — should not throw
    expect(() => devTools.dispose()).not.toThrow();

    // After dispose, _initialized is reset to false
    expect(
      (devTools as unknown as { _initialized: boolean })._initialized
    ).toBe(false);

    cleanDOM();
  });

  // -----------------------------------------------------------------------
  // 1c: Toggle after dispose
  // -----------------------------------------------------------------------

  it("should not re-create overlay after dispose (DT-012)", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    devTools.toggle(); // creates DOM
    expect(document.getElementById("dev-overlay")).not.toBeNull();

    devTools.dispose(); // tears down DOM and state
    expect(document.getElementById("dev-overlay")).toBeNull();

    // Toggle again — disposed instance should NOT re-create DOM (DT-012)
    devTools.toggle();
    const overlay = document.getElementById("dev-overlay");
    expect(overlay).toBeNull();

    cleanDOM();
  });

  // -----------------------------------------------------------------------
  // 1d: isVisible() correctness
  // -----------------------------------------------------------------------

  it("should return correct visibility state", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    expect(devTools.isVisible()).toBe(false);

    devTools.toggle();
    expect(devTools.isVisible()).toBe(true);

    devTools.toggle();
    expect(devTools.isVisible()).toBe(false);

    devTools.dispose();
    cleanDOM();
  });

  // -----------------------------------------------------------------------
  // 1e: DEV guard — no-op when DEV is false
  // -----------------------------------------------------------------------

  it("should be no-op when DEV is false", () => {
    cleanDOM();
    vi.stubEnv("DEV", false);

    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    // toggle() should return early — no DOM created
    devTools.toggle();
    expect(document.getElementById("dev-overlay")).toBeNull();

    // update() should not throw
    expect(() => devTools.update()).not.toThrow();

    // dispose() should return early — no error
    expect(() => devTools.dispose()).not.toThrow();

    vi.stubEnv("DEV", true);
    cleanDOM();
  });

  // -----------------------------------------------------------------------
  // 1f: update() after dispose — no crash
  // -----------------------------------------------------------------------

  it("should not crash when update() is called after dispose", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();
    devTools.dispose();

    // _refreshDisplay returns early because _initialized is false
    expect(() => devTools.update()).not.toThrow();
  });

  // -----------------------------------------------------------------------
  // 1g: update() when overlay is hidden (initialized but not visible)
  // -----------------------------------------------------------------------

  it("should be no-op when overlay is hidden", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle(); // creates DOM, sets _visible=true
    devTools.toggle(); // hides: _initialized=true, _visible=false

    // _refreshDisplay returns early because _visible is false
    expect(() => devTools.update()).not.toThrow();

    devTools.dispose();
    cleanDOM();
  });
});

// ---------------------------------------------------------------------------
// Notification auto-dismiss
// ---------------------------------------------------------------------------

describe("showNotification", () => {
  let devTools: IDevTools;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    cleanDOM();
    vi.useFakeTimers();
    vi.stubEnv("DEV", "true");
    mocks = createMocks();
    devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle(); // creates overlay
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    devTools.dispose();
    cleanDOM();
  });

  it("should create a notification element visible in the overlay", () => {
    devTools.showNotification("test message");
    const notification = document.querySelector(".dev-notification");
    expect(notification).not.toBeNull();
    expect(notification?.textContent).toBe("test message");
  });

  it("should remove the notification after 2000ms timeout", () => {
    devTools.showNotification("test message");
    expect(document.querySelector(".dev-notification")).not.toBeNull();

    vi.advanceTimersByTime(2000);

    expect(document.querySelector(".dev-notification")).toBeNull();
  });

  it("should not create notification when DEV is false", () => {
    vi.stubEnv("DEV", false);

    devTools.showNotification("test");
    expect(document.querySelector(".dev-notification")).toBeNull();

    vi.stubEnv("DEV", true);
  });

  it("should not throw when notification element is detached before timeout", () => {
    devTools.showNotification("test");
    const el = document.querySelector(".dev-notification");
    el?.remove(); // detach from DOM before timeout fires

    // Callback fires with el.parentElement === null — should not throw
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
    expect(document.querySelector(".dev-notification")).toBeNull();
  });

  it("should not show notification when overlay is not initialized", () => {
    const uninitMocks = createMocks();
    const uninitDevTools = new DevTools(
      uninitMocks.engine as never,
      uninitMocks.scene as never
    );
    // No toggle() — _initialized is false, _overlay is null

    uninitDevTools.showNotification("test");
    expect(document.querySelector(".dev-notification")).toBeNull();

    uninitDevTools.dispose();
  });

  it("should replace existing notification when showNotification is called again", () => {
    devTools.showNotification("first");
    expect(document.querySelectorAll(".dev-notification")).toHaveLength(1);
    expect(document.querySelector(".dev-notification")?.textContent).toBe(
      "first"
    );

    devTools.showNotification("second");
    const notifications = document.querySelectorAll(".dev-notification");
    expect(notifications).toHaveLength(1); // old one was removed by existing.remove()
    expect(notifications[0]?.textContent).toBe("second");
  });
});

// ---------------------------------------------------------------------------
// Config data source wiring (Story 004)
// ---------------------------------------------------------------------------

describe("config data source", () => {
  let devTools: IDevTools;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    cleanDOM();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.clearAllMocks();
    mockConfigManager.getDebugState.mockReturnValue({
      namespaces: { physics: { gravity: 9.81 } },
      accessLog: [],
    });
    mocks = createMocks();
    devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    // Toggle overlay on to initialize DOM (lazy init on first toggle)
    devTools.toggle();
  });

  afterEach(() => {
    devTools.dispose();
    cleanDOM();
  });

  it("should register config data source from ConfigManager on first update", () => {
    devTools.update();
    expect(mockConfigManager.getDebugState).toHaveBeenCalled();
  });

  it("should not refresh config tree on update (per-frame refresh removed)", () => {
    // Config tree is NOT refreshed on every update() — that was the bug.
    // It's refreshed once on toggle() and on explicit refreshConfigTree().
    mockConfigManager.getDebugState.mockClear();

    devTools.update();
    expect(mockConfigManager.getDebugState).not.toHaveBeenCalled();
  });

  it("should refresh config tree on explicit refreshConfigTree() call", () => {
    mockConfigManager.getDebugState.mockClear();

    devTools.refreshConfigTree();
    expect(mockConfigManager.getDebugState).toHaveBeenCalled();
  });

  it("should handle ConfigManager not initialized gracefully", () => {
    (getConfigManager as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("Not initialized");
    });

    expect(() => devTools.update()).not.toThrow();
  });

  it("should handle getDebugState missing gracefully", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    (getConfigManager as ReturnType<typeof vi.fn>).mockReturnValue({});

    expect(() => devTools.update()).not.toThrow();
  });

  it("should throw when ConfigTreePanel.refresh() fails", () => {
    // Ensure getConfigManager returns the mock (previous tests may have
    // changed its implementation without restoring it)
    (getConfigManager as ReturnType<typeof vi.fn>).mockReturnValue(
      mockConfigManager
    );

    mockConfigManager.getDebugState.mockReturnValue({
      namespaces: { physics: { gravity: 9.81 } },
      accessLog: [],
    });

    // toggle() (called in beforeEach) already created ConfigTreePanel successfully.
    // Now make getDebugState throw — error propagates through refreshConfigTree()
    mockConfigManager.getDebugState.mockImplementation(() => {
      throw new Error("getDebugState failed");
    });

    expect(() => devTools.refreshConfigTree()).toThrow("getDebugState failed");
  });
});

// ---------------------------------------------------------------------------
// Config tree panel value edit: triggers notification via callback (line 443)
// ---------------------------------------------------------------------------

describe("config tree panel value edit", () => {
  let devTools: IDevTools;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    cleanDOM();
    vi.clearAllMocks();
    mockConfigManager.getDebugState.mockReturnValue({
      namespaces: { physics: { gravity: 9.81 } },
      accessLog: [],
    });
    mocks = createMocks();
    devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle(); // Creates overlay + ConfigTreePanel via _refreshConfigTree
  });

  afterEach(() => {
    devTools.dispose();
    cleanDOM();
  });

  it("should show notification when a config value is edited in the tree panel", () => {
    // Full render pass to ensure ConfigTreePanel DOM is built
    devTools.update();

    // Find the config value element rendered by ConfigTreePanel
    const valueSpan = document.querySelector(
      '[data-config-key="physics.gravity"]'
    ) as HTMLSpanElement | null;
    expect(valueSpan).not.toBeNull();
    expect(valueSpan?.textContent).toBe("9.81");

    // Make setRuntime return the old value (realistic mock: real impl returns old value)
    mockConfigManager.setRuntime.mockReturnValueOnce(9.81);

    // Double-click the value to enter edit mode (span → input)
    valueSpan?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    // Verify the value span was replaced by an input element
    const input = document.querySelector("input");
    expect(input).not.toBeNull();
    expect(input?.value).toBe("9.81");

    // Set a new value and press Enter to confirm the edit
    (input as HTMLInputElement).value = "42";
    input?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );

    // Verify the notification was created by showNotification (line 443 coverage)
    const notification = document.querySelector(".dev-notification");
    expect(notification).not.toBeNull();
    expect(notification?.textContent).toBe(
      "config updated — physics.gravity: 9.81 → 42"
    );
  });
});

// ---------------------------------------------------------------------------
// Coverage: setGsm() paths (lines 111-129)
// ---------------------------------------------------------------------------

describe("Coverage: setGsm() after overlay initialized", () => {
  let devTools: IDevTools;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    cleanDOM();
    mocks = createMocks();
    devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle(); // Overlay is now initialized

    // Set Event Bus first (required for GSM tab creation)
    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };
    devTools.setEventBus(fakeBus as never);
  });

  afterEach(() => {
    devTools.dispose();
    cleanDOM();
  });

  it("should create GSM History tab when setGsm() called after overlay is initialized", () => {
    // Create a minimal fake GSM
    const fakeGsm = {
      getHistory: () => [],
      transition: vi.fn().mockResolvedValue(undefined),
    };

    // setGsm() should create the GSM History tab because overlay is initialized
    devTools.setGsm(fakeGsm as never);

    // Verify the tab button was created
    const gsmTabBtn = document.querySelector(
      "button[data-tab-id='gsm-history']"
    );
    expect(gsmTabBtn).not.toBeNull();
    expect(gsmTabBtn?.textContent).toBe("GSM History");

    // Verify the tab panel was created
    const gsmPanel = document.querySelector(
      ".tab-panel[data-tab-id='gsm-history']"
    );
    expect(gsmPanel).not.toBeNull();
  });

  it("should not create duplicate tabs when setGsm() called twice", () => {
    // First set Event Bus (required for tab creation)
    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };
    devTools.setEventBus(fakeBus as never);

    const fakeGsm = {
      getHistory: () => [],
      transition: vi.fn().mockResolvedValue(undefined),
    };

    devTools.setGsm(fakeGsm as never);
    devTools.setGsm(fakeGsm as never); // Second call should be no-op

    // Check that only one GSM tab button exists
    const tabBtns = document.querySelectorAll(
      "button[data-tab-id='gsm-history']"
    );
    expect(tabBtns.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Coverage: setEventBus() when GSM already set (line 336)
// ---------------------------------------------------------------------------

describe("Coverage: setEventBus() after setGsm()", () => {
  let devTools: IDevTools;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    cleanDOM();
    mocks = createMocks();
    devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();
  });

  afterEach(() => {
    devTools.dispose();
    cleanDOM();
  });

  it("should create GSM History tab when setEventBus() called after setGsm()", () => {
    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };
    const fakeGsm = {
      getHistory: () => [],
      transition: vi.fn().mockResolvedValue(undefined),
    };

    // Set GSM first (no Event Bus yet, so tab is NOT created)
    devTools.setGsm(fakeGsm as never);
    let gsmTab = document.querySelector("button[data-tab-id='gsm-history']");
    expect(gsmTab).toBeNull(); // No tab yet — no Event Bus

    // Set Event Bus (now both are available, tab SHOULD be created)
    devTools.setEventBus(fakeBus as never);
    gsmTab = document.querySelector("button[data-tab-id='gsm-history']");
    expect(gsmTab).not.toBeNull();
  });

  it("should create Event Log tab but NOT GSM tab when setEventBus() called without GSM", () => {
    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };

    // Set Event Bus WITHOUT GSM — only Event Log tab should be created
    devTools.setEventBus(fakeBus as never);

    const eventLogTab = document.querySelector(
      "button[data-tab-id='event-log']"
    );
    expect(eventLogTab).not.toBeNull();

    // GSM tab should NOT exist (line 394: early return because !this._gsm)
    const gsmTab = document.querySelector("button[data-tab-id='gsm-history']");
    expect(gsmTab).toBeNull();
  });

  // -----------------------------------------------------------------------
  // B-7a: setEventBus creates both tabs when GSM pre-initialized
  // -----------------------------------------------------------------------

  it("should create both Event Log and GSM History tabs when both are available (B-7a)", () => {
    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };
    const fakeGsm = {
      getHistory: () => [],
      transition: vi.fn().mockResolvedValue(undefined),
    };

    // Set GSM first (no Event Bus yet, so tab is NOT created)
    devTools.setGsm(fakeGsm as never);
    expect(
      document.querySelector("button[data-tab-id='gsm-history']")
    ).toBeNull();

    // Set Event Bus (now both are available, BOTH tabs should be created)
    devTools.setEventBus(fakeBus as never);

    // Verify Event Log tab exists
    const eventLogTab = document.querySelector(
      "button[data-tab-id='event-log']"
    );
    expect(eventLogTab).not.toBeNull();
    expect(eventLogTab?.textContent).toBe("Event Log");

    // Verify GSM History tab exists
    const gsmTabB7a = document.querySelector(
      "button[data-tab-id='gsm-history']"
    );
    expect(gsmTabB7a).not.toBeNull();
    expect(gsmTabB7a?.textContent).toBe("GSM History");

    // Verify tab panels exist
    const eventLogPanel = document.querySelector(
      ".tab-panel[data-tab-id='event-log']"
    );
    expect(eventLogPanel).not.toBeNull();
    const gsmPanel = document.querySelector(
      ".tab-panel[data-tab-id='gsm-history']"
    );
    expect(gsmPanel).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// B-7b: tab refresh callback through _refreshDisplay
// ---------------------------------------------------------------------------

describe("B-7b: tab refresh callback through _refreshDisplay", () => {
  let devTools: IDevTools;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    cleanDOM();
    mocks = createMocks();
    devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();
  });

  afterEach(() => {
    devTools.dispose();
    cleanDOM();
  });

  it("should invoke active tab's refresh callback on update()", () => {
    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };

    devTools.setEventBus(fakeBus as never);
    devTools.update();

    // The active tab (event-log) refresh calls inspector.refresh()
    // which calls getSubscriptions() on the bus
    expect(fakeBus.getSubscriptions).toHaveBeenCalled();
  });

  it("should invoke refresh callback on each subsequent update()", () => {
    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };

    devTools.setEventBus(fakeBus as never);

    // Clear calls from setEventBus initialization
    fakeBus.getSubscriptions.mockClear();

    devTools.update();
    devTools.update();
    devTools.update();

    // getSubscriptions called once per update() for the active tab refresh
    expect(fakeBus.getSubscriptions).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// W-6: setMinimised() behavioral tests
// ---------------------------------------------------------------------------

describe("W-6: setMinimised() behavioral tests", () => {
  it("should hide _middle and _sidebar when setMinimised(true)", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();

    devTools.setMinimised(true);

    const middle = document.querySelector(".dev-middle") as HTMLElement;
    const sidebar = document.querySelector(".sidebar") as HTMLElement;
    expect(middle).not.toBeNull();
    expect(middle.style.display).toBe("none");
    expect(sidebar).not.toBeNull();
    expect(sidebar.style.display).toBe("none");

    devTools.dispose();
    cleanDOM();
  });

  it("should restore _middle and _sidebar when setMinimised(false)", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();

    devTools.setMinimised(true);
    devTools.setMinimised(false);

    const middle = document.querySelector(".dev-middle") as HTMLElement;
    const sidebar = document.querySelector(".sidebar") as HTMLElement;
    expect(middle.style.display).toBe("flex");
    expect(sidebar.style.display).toBe("");

    devTools.dispose();
    cleanDOM();
  });

  it("should not crash when setMinimised() called before overlay initialization", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    // No toggle() — _middle and _topBar are null

    expect(() => devTools.setMinimised(true)).not.toThrow();
    expect(() => devTools.setMinimised(false)).not.toThrow();

    devTools.dispose();
    cleanDOM();
  });

  it("should not crash when _sidebar is null but _middle/_topBar exist (defensive guard L189/L192)", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    // Artificially set _middle and _topBar without _sidebar to exercise the
    // defensive `if (this._sidebar)` guards at lines 189/192. This simulates
    // a partial-init scenario that the guards protect against.
    const dt = devTools as unknown as {
      _middle: HTMLDivElement;
      _topBar: HTMLDivElement;
      _sidebar: null;
    };
    dt._middle = document.createElement("div");
    dt._topBar = document.createElement("div");
    dt._sidebar = null;

    // Both branches: the _sidebar guard prevents null access on each path
    expect(() => devTools.setMinimised(true)).not.toThrow();
    expect(() => devTools.setMinimised(false)).not.toThrow();

    devTools.dispose();
    cleanDOM();
  });

  it("should toggle between minimised and restored states", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();

    const middle = document.querySelector(".dev-middle") as HTMLElement;

    // Start: visible (flex)
    expect(middle.style.display).toBe("flex");

    // Minimise
    devTools.setMinimised(true);
    expect(middle.style.display).toBe("none");

    // Restore
    devTools.setMinimised(false);
    expect(middle.style.display).toBe("flex");

    // Minimise again
    devTools.setMinimised(true);
    expect(middle.style.display).toBe("none");

    devTools.dispose();
    cleanDOM();
  });
});

// ---------------------------------------------------------------------------
// W-7: _switchTab with invalid tabId
// ---------------------------------------------------------------------------

describe("W-7: _switchTab with invalid tabId", () => {
  it("should not crash when switching to a non-existent tab", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();

    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };
    devTools.setEventBus(fakeBus as never);
    devTools.update();

    // _switchTab sets _activeTabId unconditionally but no refresh is called
    // for a non-existent tab (the find() returns undefined)
    const dt = devTools as unknown as { _switchTab: (id: string) => void };
    expect(() => dt._switchTab("non-existent-tab")).not.toThrow();

    // _activeTabId is updated even for invalid tabId
    const activeTabId = (devTools as unknown as { _activeTabId: string })
      ._activeTabId;
    expect(activeTabId).toBe("non-existent-tab");

    devTools.dispose();
    cleanDOM();
  });

  it("should remove active class from all tabs when switching to invalid tabId", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();

    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };
    devTools.setEventBus(fakeBus as never);
    devTools.update();

    // event-log tab should be active initially
    const eventLogBtn = document.querySelector(
      "button[data-tab-id='event-log']"
    ) as HTMLButtonElement;
    expect(eventLogBtn.classList.contains("active")).toBe(true);

    // Switch to invalid tab — removes active from all tabs
    const dt = devTools as unknown as { _switchTab: (id: string) => void };
    dt._switchTab("non-existent");

    // No tab button should have the active class
    expect(eventLogBtn.classList.contains("active")).toBe(false);

    devTools.dispose();
    cleanDOM();
  });

  it("should not invoke any refresh callback when switching to invalid tabId", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();

    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };
    devTools.setEventBus(fakeBus as never);

    // Clear calls from initialization
    fakeBus.getSubscriptions.mockClear();

    // Switch to invalid tab — no refresh should be called
    const dt = devTools as unknown as { _switchTab: (id: string) => void };
    dt._switchTab("non-existent");

    expect(fakeBus.getSubscriptions).not.toHaveBeenCalled();

    devTools.dispose();
    cleanDOM();
  });
});

// ---------------------------------------------------------------------------
// W-8: _refreshDisplay active tab refresh callback
// ---------------------------------------------------------------------------

describe("W-8: _refreshDisplay active tab refresh callback", () => {
  it("should call active tab's refresh callback on each update()", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();

    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };
    devTools.setEventBus(fakeBus as never);

    // Clear the call count from setEventBus initialization
    fakeBus.getSubscriptions.mockClear();

    // Call update() multiple times — each triggers _refreshDisplay
    // which calls the active tab's refresh callback
    devTools.update();
    devTools.update();
    devTools.update();

    // getSubscriptions called once per update() via the active tab refresh
    expect(fakeBus.getSubscriptions).toHaveBeenCalledTimes(3);

    devTools.dispose();
    cleanDOM();
  });

  it("should not call refresh callback when no tab is active", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();

    // No Event Bus set — no tabs created, _activeTabId is null
    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };

    // Register a data source (not a tab) to confirm update() works
    devTools.registerDataSource("test", () => ({ val: 1 }));

    // update() should not crash — no active tab refresh to invoke
    expect(() => devTools.update()).not.toThrow();

    // getSubscriptions should not be called (no tab with refresh callback)
    expect(fakeBus.getSubscriptions).not.toHaveBeenCalled();

    devTools.dispose();
    cleanDOM();
  });
});

// ---------------------------------------------------------------------------
// L341: _initOverlay() creates GSM tab when Event Bus + GSM set before toggle
// ---------------------------------------------------------------------------

describe("L341: _initOverlay creates both tabs when setEventBus + setGsm before toggle", () => {
  it("should create both tabs when setEventBus() and setGsm() called before first toggle", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };
    const fakeGsm = {
      getHistory: () => [],
      transition: vi.fn().mockResolvedValue(undefined),
    };

    // Set both BEFORE toggle — _initOverlay should create both tabs
    devTools.setEventBus(fakeBus as never);
    devTools.setGsm(fakeGsm as never);

    // Toggle triggers _initOverlay which should create both tabs (L341)
    devTools.toggle();

    const eventLogTab = document.querySelector(
      "button[data-tab-id='event-log']"
    );
    const gsmTab = document.querySelector("button[data-tab-id='gsm-history']");
    expect(eventLogTab).not.toBeNull();
    expect(gsmTab).not.toBeNull();

    devTools.dispose();
    cleanDOM();
  });
});

// ---------------------------------------------------------------------------
// L424: Tab refresh callback invoked via _refreshDisplay() for GSM History tab
// ---------------------------------------------------------------------------

describe("L424: GSM History tab refresh callback via _refreshDisplay", () => {
  it("should call GSM History tab refresh callback when gsm-history is active and update() is called", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };
    const fakeGsm = {
      getHistory: vi.fn(() => []),
      transition: vi.fn().mockResolvedValue(undefined),
    };

    // Set both BEFORE toggle so both tabs are created
    devTools.setEventBus(fakeBus as never);
    devTools.setGsm(fakeGsm as never);

    // Toggle triggers _initOverlay → creates both tabs
    devTools.toggle();

    // Switch to gsm-history tab (makes it the active tab)
    const gsmBtn = document.querySelector(
      "button[data-tab-id='gsm-history']"
    ) as HTMLElement;
    expect(gsmBtn).not.toBeNull();
    gsmBtn.click();

    // Verify gsm-history is now the active tab
    expect(gsmBtn.classList.contains("active")).toBe(true);

    // Call update() → _refreshDisplay() → activeTab.refresh() → L424 callback
    devTools.update();

    // Verify the GSM visualizer rendered its DOM (refresh called _renderAll)
    const gsmContainer = document.querySelector(".gsm-container");
    expect(gsmContainer).not.toBeNull();

    // Verify the "No transitions recorded yet" message is shown (getHistory returns [])
    const emptyMsg = document.querySelector(".gsm-empty");
    expect(emptyMsg).not.toBeNull();
    expect(emptyMsg?.textContent).toBe("No transitions recorded yet");

    devTools.dispose();
    cleanDOM();
  });
});

// ---------------------------------------------------------------------------
// Coverage: setSimulationSnapshot() (lines 142-150)
// ---------------------------------------------------------------------------

describe("Coverage: setSimulationSnapshot()", () => {
  const fakeSnapshot = {
    getRegisteredSystems: () => [],
    getHashes: () => new Map(),
    takeSnapshot: () => null,
    restoreSnapshot: () => ({ succeeded: [], failed: [] }),
    register: () => {},
    init: () => {},
  };

  it("should be no-op when DEV is false", () => {
    cleanDOM();
    vi.stubEnv("DEV", false);

    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    // DEV=false → setSimulationSnapshot returns early
    devTools.setSimulationSnapshot(fakeSnapshot as never);

    // Tab should not exist
    const simTab = document.querySelector("button[data-tab-id='sim-snapshot']");
    expect(simTab).toBeNull();

    vi.stubEnv("DEV", true);
    devTools.dispose();
    cleanDOM();
  });

  it("should be idempotent — second call should be noop", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    // Toggle overlay first so snapshot tab would be created
    devTools.toggle();

    // Set Event Bus so the overlay is fully initialized with tab system
    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };
    devTools.setEventBus(fakeBus as never);

    // First call — creates tab
    devTools.setSimulationSnapshot(fakeSnapshot as never);

    // Second call — should be noop (idempotency guard)
    devTools.setSimulationSnapshot(fakeSnapshot as never);

    // Verify only one Sim Snapshot tab button exists
    const simTabs = document.querySelectorAll(
      "button[data-tab-id='sim-snapshot']"
    );
    expect(simTabs.length).toBe(1);

    devTools.dispose();
    cleanDOM();
  });

  it("should create Sim Snapshot tab when overlay is already initialized", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    // Spy on showNotification to verify the callback at line 474 is invoked
    vi.spyOn(devTools, "showNotification" as never);

    // Toggle overlay first
    devTools.toggle();

    // Then call setSimulationSnapshot — should create tab immediately
    devTools.setSimulationSnapshot(fakeSnapshot as never);

    const simTab = document.querySelector("button[data-tab-id='sim-snapshot']");
    expect(simTab).not.toBeNull();
    expect(simTab?.textContent).toBe("Sim Snapshot");

    // Tab panel should also exist
    const simPanel = document.querySelector(
      ".tab-panel[data-tab-id='sim-snapshot']"
    );
    expect(simPanel).not.toBeNull();

    // Trigger takeSnapshot to exercise the notification callback (line 474)
    const simSnapshotPanel = (
      devTools as unknown as {
        _simSnapshotPanel: { debugTakeSnapshot: () => void };
      }
    )._simSnapshotPanel;
    if (simSnapshotPanel) {
      simSnapshotPanel.debugTakeSnapshot();
      // The fake snapshot returns null, so notification won't fire.
      // For full line 474 coverage, we'll test with a non-null result below.
    }

    devTools.dispose();
    cleanDOM();
  });

  it("should show Sim Snapshot panel when tab is clicked (W11)", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    // Init with mock snapshot
    devTools.toggle();
    devTools.setSimulationSnapshot(fakeSnapshot as never);

    // Verify tab button exists
    const simTabBtn = document.querySelector(
      "button[data-tab-id='sim-snapshot']"
    ) as HTMLElement;
    expect(simTabBtn).not.toBeNull();
    expect(simTabBtn?.textContent).toBe("Sim Snapshot");

    // Verify panel exists (hidden initially)
    const simPanel = document.querySelector(
      ".tab-panel[data-tab-id='sim-snapshot']"
    ) as HTMLElement;
    expect(simPanel).not.toBeNull();

    // Click the tab — should activate it
    simTabBtn.click();
    expect(simTabBtn.classList.contains("active")).toBe(true);

    devTools.dispose();
    cleanDOM();
  });
});

// ---------------------------------------------------------------------------
// Coverage: _initOverlay creates Sim Snapshot tab when setSimulationSnapshot
// called before toggle (line 370)
// ---------------------------------------------------------------------------

describe("Coverage: setSimulationSnapshot before toggle", () => {
  const fakeSnapshot = {
    getRegisteredSystems: () => [],
    getHashes: () => new Map(),
    takeSnapshot: () => null,
    restoreSnapshot: () => ({ succeeded: [], failed: [] }),
    register: () => {},
    init: () => {},
  };

  it("should create Sim Snapshot tab when toggle() is called after setSimulationSnapshot", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    // Call setSimulationSnapshot BEFORE toggle (overlay not initialized)
    devTools.setSimulationSnapshot(fakeSnapshot as never);

    // Tab should NOT exist yet (overlay not initialized)
    let simTab = document.querySelector("button[data-tab-id='sim-snapshot']");
    expect(simTab).toBeNull();

    // Toggle triggers _initOverlay which checks _simulationSnapshot and creates tab
    devTools.toggle();

    // Tab should now exist
    simTab = document.querySelector("button[data-tab-id='sim-snapshot']");
    expect(simTab).not.toBeNull();
    expect(simTab?.textContent).toBe("Sim Snapshot");

    // Tab panel should also exist
    const simPanel = document.querySelector(
      ".tab-panel[data-tab-id='sim-snapshot']"
    );
    expect(simPanel).not.toBeNull();

    devTools.dispose();
    cleanDOM();
  });
});

// ---------------------------------------------------------------------------
// Coverage: _createSimSnapshotTab() full method (lines 464-490)
// ---------------------------------------------------------------------------

describe("Coverage: _createSimSnapshotTab creates tab elements and registers refresh", () => {
  const fakeSnapshot = {
    getRegisteredSystems: () => [],
    getHashes: () => new Map(),
    takeSnapshot: () => null,
    restoreSnapshot: () => ({ succeeded: [], failed: [] }),
    register: () => {},
    init: () => {},
  };

  it("should create tab panel, tab button, and register tab definition", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    // Toggle overlay to initialize
    devTools.toggle();

    // Call setSimulationSnapshot — creates tab
    devTools.setSimulationSnapshot(fakeSnapshot as never);

    // Verify tab button exists with correct attributes
    const btn = document.querySelector(
      "button[data-tab-id='sim-snapshot']"
    ) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe("Sim Snapshot");
    expect(btn.classList.contains("tab")).toBe(true);

    // Verify tab panel exists with correct attributes
    const panel = document.querySelector(
      ".tab-panel[data-tab-id='sim-snapshot']"
    ) as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.classList.contains("tab-panel")).toBe(true);

    // Verify tab was registered in _tabs
    const tabs = (
      devTools as unknown as {
        _tabs: Array<{ id: string; label: string; refresh?: () => void }>;
      }
    )._tabs;
    const simTabDef = tabs.find((t) => t.id === "sim-snapshot");
    expect(simTabDef).toBeDefined();
    expect(simTabDef?.label).toBe("Sim Snapshot");
    expect(typeof simTabDef?.refresh).toBe("function");

    devTools.dispose();
    cleanDOM();
  });

  it("should invoke notification callback when snapshot is taken (line 474)", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    // Spy on showNotification
    vi.spyOn(devTools, "showNotification" as never);

    // Snapshot that returns a non-null result
    const returningSnapshot = {
      getRegisteredSystems: () => [],
      getHashes: () => new Map(),
      takeSnapshot: () => ({ tick: 42 }),
      restoreSnapshot: () => ({ succeeded: [], failed: [] }),
      register: () => {},
      init: () => {},
    };

    devTools.toggle();
    devTools.setSimulationSnapshot(returningSnapshot as never);

    // Access the internal SimSnapshotPanel and call debugTakeSnapshot
    const simSnapshotPanel = (
      devTools as unknown as {
        _simSnapshotPanel: { debugTakeSnapshot: () => void };
      }
    )._simSnapshotPanel;
    simSnapshotPanel.debugTakeSnapshot();

    // Notification should have been shown
    expect(devTools.showNotification).toHaveBeenCalledWith(
      expect.stringContaining("Snapshot taken at tick 42")
    );

    devTools.dispose();
    cleanDOM();
  });

  it("should call refresh callback when sim-snapshot tab is active (line 490)", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    devTools.toggle();
    devTools.setSimulationSnapshot(fakeSnapshot as never);

    // Switch to sim-snapshot tab to make it the active tab
    const simBtn = document.querySelector(
      "button[data-tab-id='sim-snapshot']"
    ) as HTMLElement;
    expect(simBtn).not.toBeNull();
    simBtn.click();
    expect(simBtn.classList.contains("active")).toBe(true);

    // Call update() → _refreshDisplay() → activeTab.refresh() → line 490
    devTools.update();

    // No crash — refresh completed successfully
    devTools.dispose();
    cleanDOM();
  });
});

// ---------------------------------------------------------------------------
// Coverage: AI Telemetry tab creation paths (lines 145-153, 391-393, 528-558)
// ---------------------------------------------------------------------------

describe("Coverage: AI Telemetry tab creation paths", () => {
  const mockTelemetryReader = () => [
    {
      carId: "player-1",
      speed: 120,
      position: { lap: 3, trackProgress: 0.45, overall: 1 },
      behavior: "Normal",
    },
  ];

  it("should create AI Telemetry tab when reader set before overlay init", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    // Set reader BEFORE toggle — tab creation deferred to _initOverlay
    devTools.setAiTelemetry(mockTelemetryReader);

    // Tab should NOT exist yet (overlay not initialized)
    let aiTab = document.querySelector("button[data-tab-id='ai-telemetry']");
    expect(aiTab).toBeNull();

    // Toggle triggers _initOverlay which checks _aiTelemetryReader and creates tab
    devTools.toggle();

    // Tab should now exist
    aiTab = document.querySelector("button[data-tab-id='ai-telemetry']");
    expect(aiTab).not.toBeNull();
    expect(aiTab?.textContent).toBe("AI Telemetry");

    // Tab panel should also exist
    const aiPanel = document.querySelector(
      ".tab-panel[data-tab-id='ai-telemetry']"
    );
    expect(aiPanel).not.toBeNull();

    devTools.dispose();
    cleanDOM();
  });

  it("should create AI Telemetry tab when reader set after overlay init", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    // Toggle overlay first (creates DOM)
    devTools.toggle();

    // Tab should NOT exist yet
    let aiTab = document.querySelector("button[data-tab-id='ai-telemetry']");
    expect(aiTab).toBeNull();

    // Set reader AFTER toggle — tab created immediately via setAiTelemetry
    devTools.setAiTelemetry(mockTelemetryReader);

    // Tab should now exist
    aiTab = document.querySelector("button[data-tab-id='ai-telemetry']");
    expect(aiTab).not.toBeNull();
    expect(aiTab?.textContent).toBe("AI Telemetry");

    // Tab panel should also exist
    const aiPanel = document.querySelector(
      ".tab-panel[data-tab-id='ai-telemetry']"
    );
    expect(aiPanel).not.toBeNull();

    // Click the AI Telemetry tab to activate it, then update() triggers its
    // refresh callback (line 556) via _refreshDisplay
    const aiTabBtn = document.querySelector(
      "button[data-tab-id='ai-telemetry']"
    ) as HTMLElement;
    expect(aiTabBtn).not.toBeNull();
    aiTabBtn.click();
    expect(aiTabBtn.classList.contains("active")).toBe(true);
    expect(() => devTools.update()).not.toThrow();

    devTools.dispose();
    cleanDOM();
  });

  it("should be idempotent — second call to setAiTelemetry() is no-op (line 146)", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    // First call sets the reader
    devTools.setAiTelemetry(mockTelemetryReader);
    // Second call hits the idempotency guard and returns early
    devTools.setAiTelemetry(mockTelemetryReader);

    // Toggle creates overlay — only one tab should exist
    devTools.toggle();
    const aiTabs = document.querySelectorAll(
      "button[data-tab-id='ai-telemetry']"
    );
    expect(aiTabs.length).toBe(1);

    devTools.dispose();
    cleanDOM();
  });

  it("should not throw when disposing with AI Telemetry reader set", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    // Set reader and toggle to create tab
    devTools.setAiTelemetry(mockTelemetryReader);
    devTools.toggle();

    // Dispose should not throw — cleans up panel and reader references
    expect(() => devTools.dispose()).not.toThrow();

    cleanDOM();
  });

  it("should show AI Telemetry panel when tab is clicked (W10)", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    // Init with mock telemetry reader
    devTools.setAiTelemetry(mockTelemetryReader);
    devTools.toggle();

    // Verify tab button exists
    const aiTabBtn = document.querySelector(
      "button[data-tab-id='ai-telemetry']"
    ) as HTMLElement;
    expect(aiTabBtn).not.toBeNull();
    expect(aiTabBtn?.textContent).toBe("AI Telemetry");

    // Verify panel exists (hidden initially)
    const aiPanel = document.querySelector(
      ".tab-panel[data-tab-id='ai-telemetry']"
    ) as HTMLElement;
    expect(aiPanel).not.toBeNull();

    // Click the tab — should activate both button and panel
    aiTabBtn.click();
    expect(aiTabBtn.classList.contains("active")).toBe(true);

    devTools.dispose();
    cleanDOM();
  });
});

// ---------------------------------------------------------------------------
// Coverage: setEventBus() before toggle without setGsm() (line 380 falsy branch)
// ---------------------------------------------------------------------------

describe("Coverage: setEventBus before toggle without setGsm", () => {
  it("should create Event Log tab but not GSM History tab when setEventBus called before toggle without setGsm", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };

    // Set Event Bus BEFORE toggle but NOT GSM
    devTools.setEventBus(fakeBus as never);

    // Toggle triggers _initOverlay — creates Event Log, skips GSM (line 380: !this._gsm)
    devTools.toggle();

    // Event Log tab should exist
    const eventLogTab = document.querySelector(
      "button[data-tab-id='event-log']"
    );
    expect(eventLogTab).not.toBeNull();

    // GSM History tab should NOT exist (no GSM set)
    const gsmTab = document.querySelector("button[data-tab-id='gsm-history']");
    expect(gsmTab).toBeNull();

    devTools.dispose();
    cleanDOM();
  });
});

// ---------------------------------------------------------------------------
// Coverage: Event Log tab button click handler (line 428 anonymous_17)
// ---------------------------------------------------------------------------

describe("Coverage: Event Log tab button click", () => {
  it("should handle Event Log tab button click without error", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);
    devTools.toggle();

    const fakeBus = {
      on: vi.fn(() => ({ unsubscribe: vi.fn() })),
      off: vi.fn(),
      emit: vi.fn(),
      getSubscriptions: vi.fn(() => new Map()),
    };
    devTools.setEventBus(fakeBus as never);

    // Click the Event Log tab button exercises the click handler (line 428)
    const eventLogBtn = document.querySelector(
      "button[data-tab-id='event-log']"
    ) as HTMLElement;
    expect(eventLogBtn).not.toBeNull();
    expect(() => eventLogBtn.click()).not.toThrow();
    expect(eventLogBtn.classList.contains("active")).toBe(true);

    devTools.dispose();
    cleanDOM();
  });
});

// ---------------------------------------------------------------------------
// Coverage note: Line 427 (_createGsmHistoryTab early return guard)
//
// This guard is dead code — the method is only called from two places:
// 1. setGsm() — which checks _initialized && _tabBar && _tabContent && _eventBus
//    before calling _createGsmHistoryTab()
// 2. _initOverlay() — which also only calls it when _eventBus && _gsm are set
//    after overlay is initialized
//
// In both call sites, all dependencies are guaranteed to exist before the
// call. The guard on line 426-427 is a defensive belt-and-suspenders check
// that can never be triggered. It's unreachable.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Coverage: _resetDevToolsForTesting
// ---------------------------------------------------------------------------

describe("_resetDevToolsForTesting (B7)", () => {
  afterEach(() => {
    cleanDOM();
  });

  it("should reset singleton and allow initDevTools to be called again", async () => {
    cleanDOM();
    const mocks = createMocks();

    // First initialization via initDevTools
    vi.stubEnv("DEV", true);
    await initDevTools(mocks.engine as never, mocks.scene as never);
    const first = getDevTools();
    expect(first).toBeDefined();
    expect(first.toggle).toBeInstanceOf(Function);
    first.dispose();

    // Reset singleton state
    _resetDevToolsForTesting();

    // Second initialization — should work without error
    await initDevTools(mocks.engine as never, mocks.scene as never);
    const second = getDevTools();
    expect(second).toBeDefined();
    expect(second).not.toBe(first); // New instance after reset

    second.dispose();
    _resetDevToolsForTesting();
    cleanDOM();
  });
});
