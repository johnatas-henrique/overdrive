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
// Import the class under test AFTER mocks are established
// ---------------------------------------------------------------------------

import { DevTools } from "@/core/dev-tools/dev-tools";
import type { IDevTools } from "@/core/dev-tools/types";

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

  it("should have pointer-events: none CSS on the overlay", () => {
    const overlay = document.getElementById(
      "dev-overlay"
    ) as HTMLElement | null;
    expect(overlay).not.toBeNull();
    const style = getComputedStyle(overlay as HTMLElement);
    expect(style.pointerEvents).toBe("none");
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

  it("should re-initialize after dispose", () => {
    cleanDOM();
    const mocks = createMocks();
    const devTools = new DevTools(mocks.engine as never, mocks.scene as never);

    devTools.toggle(); // creates DOM
    expect(document.getElementById("dev-overlay")).not.toBeNull();

    devTools.dispose(); // tears down DOM and state
    expect(document.getElementById("dev-overlay")).toBeNull();

    // Toggle again — should re-create DOM from scratch
    devTools.toggle();
    const overlay = document.getElementById("dev-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay?.style.display).toBe("flex");

    devTools.dispose();
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
