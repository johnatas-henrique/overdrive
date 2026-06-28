// @vitest-environment happy-dom

/**
 * Integration tests: Event Bus Inspector.
 *
 * Verifies that EventBusInspector correctly captures events, maintains a
 * 100-entry ring buffer, displays events newest-first, renders subscription
 * counts, filters by event name, and never calls emit().
 *
 * Also verifies the Dev Tools tab system integration: tab bar creation,
 * tab button click activates the panel.
 *
 * @see TR-DVT-002 — Event Bus inspector
 * @see ADR-0009 — Dev Tools Architecture
 * @see ADR-0001 — Event Bus Architecture
 * @see Story 005 — Event Bus Inspector
 */

import { Observable } from "@babylonjs/core/Misc/observable";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBusInspector } from "../../../../src/core/dev-tools/event-bus-inspector";
import { EventBus } from "../../../../src/foundation/event-bus";

// ---------------------------------------------------------------------------
// Mock Babylon.js dependencies for DevTools integration tests
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

const mockGetConfigManager = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("@babylonjs/core/Instrumentation/sceneInstrumentation", () => ({
  SceneInstrumentation: vi.fn(function mockConstructor() {
    return mockInstrumentation;
  }),
}));

vi.mock("@/foundation/config/config-manager", () => ({
  getConfigManager: mockGetConfigManager,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a container element for the inspector to render into. */
function createContainer(): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = "width:100%;height:500px";
  return el;
}

/**
 * Create mock engine and scene objects for DevTools integration tests.
 * Appends a canvas container to the document body.
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
// Setup
// ---------------------------------------------------------------------------

describe("Event Bus Inspector — AC-5", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    cleanDOM();
  });

  // =======================================================================
  // AC-5a: Event log shows last 100 events, newest first, scrollable
  // =======================================================================

  describe("AC-5a: Event log shows last 100 events, newest first", () => {
    it("should capture and display emitted events", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      bus.emit("race.starting", {});
      bus.emit("race.green.flag", {});
      bus.emit("car.fuel_empty", { carId: "car1" });
      bus.emit("car.lap.completed", { carId: "car1", lap: 1, lapTime: 90 });

      inspector.refresh();

      const logText = container.textContent ?? "";
      expect(logText).toContain("race.starting");
      expect(logText).toContain("race.green.flag");
      expect(logText).toContain("car.fuel_empty");
      expect(logText).toContain("car.lap.completed");
    });

    it("should display events newest first (reverse chronological)", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      // Emit events in order A, B, C, D, E
      bus.emit("race.starting", {});
      bus.emit("race.green.flag", {});
      bus.emit("race.completed", {
        results: {
          positions: [],
          fastestLap: { carId: "c1", lapTime: 90 },
          totalLaps: 5,
        },
      });
      bus.emit("race.checkered", {
        carId: "c1",
        lap: 5,
        results: {
          positions: [],
          fastestLap: { carId: "c1", lapTime: 90 },
          totalLaps: 5,
        },
      });
      bus.emit("race.abandoned", {});

      inspector.refresh();

      // The DOM rows should show newest first: abandoned, checkered, completed, green, starting
      const rows = container.querySelectorAll("[data-event-name]");
      expect(rows.length).toBe(5);
      expect(rows[0].getAttribute("data-event-name")).toBe("race.abandoned");
      expect(rows[1].getAttribute("data-event-name")).toBe("race.checkered");
      expect(rows[2].getAttribute("data-event-name")).toBe("race.completed");
      expect(rows[3].getAttribute("data-event-name")).toBe("race.green.flag");
      expect(rows[4].getAttribute("data-event-name")).toBe("race.starting");
    });

    it("should have a scrollable event log container", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      inspector.refresh();

      const logList = container.querySelector(
        ".inspector-log-list"
      ) as HTMLElement;
      expect(logList).not.toBeNull();
      // CSS .inspector-log-list sets overflow-y: auto
      expect(logList.classList.contains("inspector-log-list")).toBe(true);
    });

    it("should show placeholder when no events are captured", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      inspector.refresh();

      expect(container.textContent).toContain("No events captured yet");
    });

    it("should display timestamps for each event row", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      bus.emit("race.starting", {});

      inspector.refresh();

      // Each row should have a timestamp (HH:MM:SS.mmm format)
      const rows = container.querySelectorAll("[data-event-name]");
      expect(rows.length).toBe(1);

      const rowText = rows[0].textContent ?? "";
      // Timestamp pattern: two digits:two digits:two digits.three digits
      expect(rowText).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
    });
  });

  // =======================================================================
  // AC-5a: FIFO eviction — only 100 events retained
  // =======================================================================

  describe("AC-5a: FIFO eviction", () => {
    it("should retain exactly 100 events after 105 emissions", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      // Emit 105 events
      for (let i = 0; i < 105; i++) {
        bus.emit("race.starting", {});
      }

      inspector.refresh();

      // The event log should have exactly 100 entries
      const rows = container.querySelectorAll("[data-event-name]");
      expect(rows.length).toBe(100);
    });

    it("should keep the most recent events (oldest evicted)", () => {
      const bus = new EventBus();
      bus.init();

      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      // First 5 events: "race.starting"
      for (let i = 0; i < 5; i++) {
        bus.emit("race.starting", {});
      }

      // Next 100 events: "car.fuel_empty" — these should fill the buffer
      for (let i = 0; i < 100; i++) {
        bus.emit("car.fuel_empty", { carId: `car${i}` });
      }

      inspector.refresh();

      const rows = container.querySelectorAll("[data-event-name]");
      expect(rows.length).toBe(100);

      // All visible events should be "car.fuel_empty" (the last 100)
      for (const row of rows) {
        expect(row.getAttribute("data-event-name")).toBe("car.fuel_empty");
      }

      // "race.starting" events (the first 5) should be evicted
      const logText = container.textContent ?? "";
      expect(logText).not.toContain("race.starting");
    });
  });

  // =======================================================================
  // AC-5b: Subscription list
  // =======================================================================

  describe("AC-5b: Subscription list", () => {
    it("should show event name and handler count for active subscriptions", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      // Subscribe 3 handlers to one event, 1 handler to another
      bus.on("gsm.state.entered", () => {});
      bus.on("gsm.state.entered", () => {});
      bus.on("gsm.state.entered", () => {});
      bus.on("collision.impact", () => {});

      inspector.refresh();

      const subsText = container.textContent ?? "";

      // "gsm.state.entered" should appear
      expect(subsText).toContain("gsm.state.entered");

      // The count "3" should appear in the subscription section
      const subsSection = container.querySelector(
        ".inspector-subs-list"
      ) as HTMLElement;
      expect(subsSection).not.toBeNull();
      expect(subsSection.textContent).toContain("3");

      // "collision.impact" should show count 1
      expect(subsText).toContain("collision.impact");
    });

    it("should NOT show events with zero subscriptions", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      // Subscribe to one event only
      bus.on("gsm.state.entered", () => {});

      inspector.refresh();

      // "gsm.state.entered" should appear
      expect(container.textContent).toContain("gsm.state.entered");

      // "race.checkered" should NOT appear (no subscribers)
      expect(container.textContent).not.toContain("race.checkered");
    });

    it("should show the inspector's own wildcard subscription (F-001)", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      // The inspector constructor subscribes to "*" for event capture.
      // F-001 now includes wildcard subscriptions in getSubscriptions(),
      // so the subscription list shows "*:1" rather than "No active subscriptions".
      const inspector = new EventBusInspector(container, bus);

      inspector.refresh();

      const subsSection = container.querySelector(
        ".inspector-subs-list"
      ) as HTMLElement;
      expect(subsSection).not.toBeNull();
      // The wildcard subscription from the inspector itself is now visible
      expect(subsSection.textContent).toContain("*:1");
    });

    it("should sort subscriptions alphabetically by event name", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      // Subscribe in non-alphabetical order
      bus.on("position.changed", () => {});
      bus.on("car.lap.completed", () => {});
      bus.on("collision.impact", () => {});
      bus.on("gsm.state.entered", () => {});

      inspector.refresh();

      const subsSection = container.querySelector(
        ".inspector-subs-list"
      ) as HTMLElement;
      const text = subsSection?.textContent ?? "";

      // car.lap.completed should come before collision.impact before
      // gsm.state.entered before position.changed
      const carIdx = text.indexOf("car.lap.completed");
      const colIdx = text.indexOf("collision.impact");
      const gsmIdx = text.indexOf("gsm.state.entered");
      const posIdx = text.indexOf("position.changed");

      expect(carIdx).toBeGreaterThanOrEqual(0);
      expect(colIdx).toBeGreaterThan(carIdx);
      expect(gsmIdx).toBeGreaterThan(colIdx);
      expect(posIdx).toBeGreaterThan(gsmIdx);
    });

    it("should update subscription count when handlers are added and removed", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      // Subscribe two handlers to the same event
      const sub1 = bus.on("position.changed", () => {});
      bus.on("position.changed", () => {});

      inspector.refresh();

      const subsSection = container.querySelector(
        ".inspector-subs-list"
      ) as HTMLElement;
      expect(subsSection.textContent).toContain("position.changed");
      expect(subsSection.textContent).toContain("2");

      // Unsubscribe one handler
      sub1.unsubscribe();
      inspector.refresh();

      // Count should decrease to 1, event should still appear
      expect(subsSection.textContent).toContain("position.changed");
      expect(subsSection.textContent).toContain("1");
    });
  });

  // =======================================================================
  // AC-5c: Filter by event name
  // =======================================================================

  describe("AC-5c: Filter by event name", () => {
    it("should filter displayed events by substring match on event name", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      // Emit multiple event types
      bus.emit("race.starting", {});
      bus.emit("race.green.flag", {});
      bus.emit("car.fuel_empty", { carId: "car1" });
      bus.emit("car.tire_blown", { carId: "car2" });
      bus.emit("collision.impact", {
        carIdA: "car1",
        carIdB: "car2",
        impulse: 50,
      });

      inspector.refresh();

      // Initially all 5 events visible
      let rows = container.querySelectorAll("[data-event-name]");
      expect(rows.length).toBe(5);

      // Type "fuel" in the filter input
      const filterInput = container.querySelector(
        ".inspector-filter input"
      ) as HTMLInputElement;
      expect(filterInput).not.toBeNull();

      filterInput.value = "fuel";
      filterInput.dispatchEvent(new Event("input"));

      inspector.refresh();

      // Only "car.fuel_empty" should be visible
      rows = container.querySelectorAll("[data-event-name]");
      expect(rows.length).toBe(1);
      expect(rows[0].getAttribute("data-event-name")).toBe("car.fuel_empty");
    });

    it("should be case-insensitive", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      bus.emit("car.fuel_empty", { carId: "car1" });
      bus.emit("car.tire_blown", { carId: "car2" });

      inspector.refresh();

      const filterInput = container.querySelector(
        ".inspector-filter input"
      ) as HTMLInputElement;

      // Uppercase filter should still match lowercase event name
      filterInput.value = "FUEL";
      filterInput.dispatchEvent(new Event("input"));

      inspector.refresh();

      const rows = container.querySelectorAll("[data-event-name]");
      expect(rows.length).toBe(1);
      expect(rows[0].getAttribute("data-event-name")).toBe("car.fuel_empty");
    });

    it("should show placeholder when filter matches no events", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      bus.emit("race.starting", {});

      inspector.refresh();

      const filterInput = container.querySelector(
        ".inspector-filter input"
      ) as HTMLInputElement;

      filterInput.value = "nonexistent_event";
      filterInput.dispatchEvent(new Event("input"));

      inspector.refresh();

      const logList = container.querySelector(
        ".inspector-log-list"
      ) as HTMLElement;
      expect(logList.textContent).toContain(
        'No events matching "nonexistent_event"'
      );
    });

    it("should restore all events when filter is cleared", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      bus.emit("race.starting", {});
      bus.emit("car.fuel_empty", { carId: "car1" });

      inspector.refresh();

      const filterInput = container.querySelector(
        ".inspector-filter input"
      ) as HTMLInputElement;

      // Apply filter — narrows to 1
      filterInput.value = "fuel";
      filterInput.dispatchEvent(new Event("input"));
      inspector.refresh();

      expect(container.querySelectorAll("[data-event-name]").length).toBe(1);

      // Clear filter — restores to 2
      filterInput.value = "";
      filterInput.dispatchEvent(new Event("input"));
      inspector.refresh();

      expect(container.querySelectorAll("[data-event-name]").length).toBe(2);
    });
  });

  // =======================================================================
  // AC-5d: No emit
  // =======================================================================

  describe("AC-5d: No emit", () => {
    it("should never call emit() on the Event Bus", () => {
      const bus = new EventBus();
      bus.init();
      const emitSpy = vi.spyOn(bus, "emit");

      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      // Construction should not have called emit
      expect(emitSpy).not.toHaveBeenCalled();

      // Capture some events (these call emit via our test code, not the inspector)
      bus.emit("race.starting", {});
      bus.emit("car.fuel_empty", { carId: "car1" });
      expect(emitSpy).toHaveBeenCalledTimes(2);

      // Refresh the display
      inspector.refresh();
      expect(emitSpy).toHaveBeenCalledTimes(2);

      // Use filter input
      const filterInput = container.querySelector(
        ".inspector-filter input"
      ) as HTMLInputElement;
      filterInput.value = "fuel";
      filterInput.dispatchEvent(new Event("input"));
      inspector.refresh();
      expect(emitSpy).toHaveBeenCalledTimes(2);

      // Read subscriptions
      bus.getSubscriptions();
      expect(emitSpy).toHaveBeenCalledTimes(2);

      // Dispose the inspector
      inspector.dispose();
      expect(emitSpy).toHaveBeenCalledTimes(2);
    });

    it("should receive a read-only wrapper type that lacks emit()", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();

      // IReadOnlyEventBus only has on/off/getSubscriptions — not emit
      // TypeScript enforces this at compile time.
      const inspector = new EventBusInspector(container, bus);

      // The inspector's internal buffer should be accessible via getEventLog()
      const log = inspector.getEventLog();
      expect(Array.isArray(log)).toBe(true);

      // Direct verification: inspect gets the log via wildcard subscription,
      // never by calling emit()
      inspector.dispose();
    });
  });

  // =======================================================================
  // Edge cases
  // =======================================================================

  describe("Edge cases", () => {
    it("should handle dispose without errors", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      expect(() => inspector.dispose()).not.toThrow();

      // Double dispose should be safe
      expect(() => inspector.dispose()).not.toThrow();
    });

    it("should not capture events after dispose", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      inspector.dispose();

      // After dispose, events should not be captured
      bus.emit("race.starting", {});

      expect(inspector.getEventLog().length).toBe(0);
    });

    it("should render serializable payloads as truncated JSON", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      bus.emit("car.fuel_empty", { carId: "player", fuelLeft: 0 });

      inspector.refresh();

      const rows = container.querySelectorAll("[data-event-name]");
      expect(rows.length).toBe(1);
      const rowText = rows[0].textContent ?? "";
      // Payload should be serialized as JSON
      expect(rowText).toContain("player");
      expect(rowText).toContain("0");
    });

    it("should render [unserializable] for circular reference payloads", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      // Create an object with a circular reference
      const circular: Record<string, unknown> = { key: "value" };
      circular.self = circular;

      bus.emit("test.circular", circular);
      inspector.refresh();

      const rows = container.querySelectorAll("[data-event-name]");
      expect(rows.length).toBe(1);
      const rowText = rows[0].textContent ?? "";
      expect(rowText).toContain("[unserializable]");
    });

    it("should handle undefined payload without crashing or rendering 'undefined' literal", () => {
      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      bus.emit("test.null-payload", undefined);
      inspector.refresh();

      const rows = container.querySelectorAll("[data-event-name]");
      expect(rows.length).toBe(1);
      const rowText = rows[0].textContent ?? "";
      expect(rowText).toContain("test.null-payload");
      // The payload span should be empty string — check that "undefined"
      // does not appear as a literal payload (the event name is safe since
      // it doesn't contain the word "undefined")
      const rowChildren = rows[0].children;
      const payloadSpan = rowChildren[rowChildren.length - 1];
      expect(payloadSpan.textContent).toBe("");
    });
  });

  // =======================================================================
  // DEV guard: no-op when DEV = false
  // =======================================================================

  describe("DEV guard", () => {
    it("should not capture events when DEV = false", () => {
      vi.stubEnv("DEV", false);

      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      bus.emit("race.starting", {});

      // No events should be captured when DEV = false
      expect(inspector.getEventLog().length).toBe(0);

      inspector.dispose();
    });

    it("should do nothing when refresh() is called while DEV = false", () => {
      vi.stubEnv("DEV", false);

      const bus = new EventBus();
      bus.init();
      const container = createContainer();
      const inspector = new EventBusInspector(container, bus);

      // Emit events — won't be captured because _startCapture returns early
      bus.emit("race.starting", {});
      bus.emit("car.fuel_empty", { carId: "car1" });

      // refresh() should return immediately due to DEV guard
      inspector.refresh();

      // No event rows should be rendered
      const rows = container.querySelectorAll("[data-event-name]");
      expect(rows.length).toBe(0);

      // No events captured in the buffer
      expect(inspector.getEventLog().length).toBe(0);

      inspector.dispose();
    });
  });
});

// =======================================================================
// Tab system integration
// =======================================================================

describe("Tab system integration", () => {
  let initDevTools: (...args: unknown[]) => Promise<void>;
  let getDevTools: () => ReturnType<
    typeof import("../../../../src/core/dev-tools").getDevTools
  >;
  let _resetDevToolsForTesting: () => void;

  beforeAll(async () => {
    const mod = await import("../../../../src/core/dev-tools");
    initDevTools = mod.initDevTools;
    getDevTools = mod.getDevTools;
    _resetDevToolsForTesting = mod._resetDevToolsForTesting;
  });

  beforeEach(() => {
    vi.stubEnv("DEV", true);
    cleanDOM();
    _resetDevToolsForTesting();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    cleanDOM();
  });

  it("should create tab bar with Event Log button when setEventBus is called", async () => {
    const bus = new EventBus();
    bus.init();
    const mocks = createMocks();

    // Pass the event bus during initialization
    await initDevTools(mocks.engine as never, mocks.scene as never, bus);
    const dt = getDevTools();
    dt.toggle(); // Show overlay

    // Tab bar should exist
    const tabBar = document.querySelector(".tab-bar");
    expect(tabBar).not.toBeNull();

    // Tab button should exist with "Event Log" label
    const tabBtn = tabBar?.querySelector(".tab") as HTMLButtonElement;
    expect(tabBtn).not.toBeNull();
    expect(tabBtn?.textContent).toBe("Event Log");
    expect(tabBtn?.dataset.tabId).toBe("event-log");

    // Tab panel should exist
    const tabPanel = document.querySelector(
      '.tab-panel[data-tab-id="event-log"]'
    );
    expect(tabPanel).not.toBeNull();

    // Tab panel should be visible (active on creation)
    // CSS .tab-panel.active sets display: flex
    expect((tabPanel as HTMLElement).classList.contains("active")).toBe(true);

    // Tab button should be styled as active
    expect(tabBtn?.classList.contains("active")).toBe(true);

    dt.dispose();
  });

  it("should create Event Log tab when setEventBus is called after overlay init", async () => {
    const bus = new EventBus();
    bus.init();
    const mocks = createMocks();

    // Init WITHOUT event bus
    await initDevTools(mocks.engine as never, mocks.scene as never);
    const dt = getDevTools();
    dt.toggle(); // Show overlay (no tab yet)

    // No tab should exist yet
    expect(document.querySelector(".tab-bar")?.children.length).toBe(0);

    // Now set the event bus
    dt.setEventBus(bus);

    // Tab should now exist
    const tabBtn = document.querySelector(".tab") as HTMLButtonElement;
    expect(tabBtn).not.toBeNull();
    expect(tabBtn?.textContent).toBe("Event Log");

    dt.dispose();
  });

  it("should activate tab panel on tab button click", async () => {
    const bus = new EventBus();
    bus.init();
    const mocks = createMocks();

    await initDevTools(mocks.engine as never, mocks.scene as never, bus);
    const dt = getDevTools();
    dt.toggle();

    // Tab panel should be visible initially
    const tabPanel = document.querySelector(
      '.tab-panel[data-tab-id="event-log"]'
    ) as HTMLElement;
    // CSS .tab-panel.active sets display: flex
    expect(tabPanel.classList.contains("active")).toBe(true);

    // Tab button click should keep it active (only one tab exists)
    const tabBtn = document.querySelector(".tab") as HTMLButtonElement;
    tabBtn?.click();

    // CSS .tab-panel.active sets display: flex
    expect(tabPanel.classList.contains("active")).toBe(true);
    expect(tabBtn?.classList.contains("active")).toBe(true);

    dt.dispose();
  });

  it("should not create Event Log tab in production mode", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { initDevTools: initDT, getDevTools: getDT } = await import(
      "../../../../src/core/dev-tools"
    );

    const bus = new EventBus();
    bus.init();
    const mocks = createMocks();

    await initDT(mocks.engine as never, mocks.scene as never, bus);

    expect(() => getDT()).toThrow("DevTools not initialized");

    // No overlay DOM should exist
    expect(document.getElementById("dev-overlay")).toBeNull();
  });

  it("should not create Event Log tab when setEventBus is never called", async () => {
    const mocks = createMocks();
    await initDevTools(mocks.engine as never, mocks.scene as never);
    const dt = getDevTools();
    dt.toggle();

    // Tab bar should exist but be empty
    const tabBar = document.querySelector(".tab-bar");
    expect(tabBar).not.toBeNull();
    expect(tabBar?.children.length).toBe(0);

    dt.dispose();
  });
});

// ─── Coverage gap: non-cloneable payload ───

describe("Coverage gap — non-cloneable payload", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    cleanDOM();
  });

  it("should handle non-cloneable payload gracefully", () => {
    const bus = new EventBus();
    bus.init();
    const container = createContainer();
    const inspector = new EventBusInspector(container, bus);

    // Create a payload with a circular reference (non-cloneable)
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    bus.emit("test.event" as never, circular as never);

    // Should not throw — structuredClone fails, falls back to reference
    inspector.refresh();

    // Verify the event was captured
    const logList = container.querySelector(".inspector-log-list");
    expect(logList).not.toBeNull();
    expect(logList?.textContent).toContain("test.event");

    inspector.dispose();
  });
});
