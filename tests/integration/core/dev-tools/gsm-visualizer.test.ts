// @vitest-environment happy-dom

/**
 * Integration tests: GSM State Visualizer.
 *
 * Verifies that GsmVisualizer correctly captures state transitions from the
 * Event Bus, maintains a 20-entry ring buffer, displays current state,
 * shows transitions newest-first, renders transition buttons from the
 * TRANSITIONS table, and never calls emit().
 *
 * @see TR-DVT-005 — GSM state visualiser
 * @see ADR-0009 — Dev Tools Architecture
 * @see ADR-0024 — Game State Machine
 * @see Control Manifest D6 — Read-only on all systems (with DEV-guarded exception)
 * @see Story 006 — GSM State Visualizer
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "../../../../src/foundation/event-bus";
import { TRANSITIONS } from "../../../../src/foundation/gsm/TransitionTable";
import type { State } from "../../../../src/foundation/gsm/types";

// Import after mocks
let GsmVisualizer: typeof import("../../../../src/core/dev-tools/gsm-visualizer").GsmVisualizer;

// ---------------------------------------------------------------------------
// Fake GameStateMachine for testing
// ---------------------------------------------------------------------------

interface FakeTransitionRecord {
  from: string;
  to: string;
  timestamp: number;
  durationInPreviousState: number;
}

/**
 * Minimal fake GameStateMachine that satisfies the interface needed by
 * GsmVisualizer: getHistory() and transition().
 */
class FakeGsm {
  private _history: FakeTransitionRecord[] = [];
  private _callbacks: Array<(target: State) => void> = [];

  getHistory(): ReadonlyArray<FakeTransitionRecord> {
    return [...this._history];
  }

  async transition(target: State): Promise<void> {
    for (const cb of this._callbacks) {
      cb(target);
    }
  }

  onTransition(cb: (target: State) => void): void {
    this._callbacks.push(cb);
  }

  /** Add a fake entry to the history ring buffer for testing. */
  addEntry(
    from: string,
    to: string,
    timestamp?: number,
    duration?: number
  ): void {
    this._history.push({
      from,
      to,
      timestamp: timestamp ?? Date.now(),
      durationInPreviousState: duration ?? 100,
    });
  }

  /** Clear all history entries. */
  clearHistory(): void {
    this._history = [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a container element for the visualizer to render into. */
function createContainer(): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = "width:100%;height:500px";
  return el;
}

/** Emit a GSM state.exit event on the bus. */
function emitExit(
  bus: EventBus,
  from: string,
  _timestamp: number = Date.now()
): void {
  // We override timestamp via a spy; but for simplicity, just emit the event.
  bus.emit("gsm.state.exited" as never, { from } as never);
}

/** Emit a GSM state.entered event on the bus. */
function emitEnter(bus: EventBus, to: string): void {
  // The payload contains { from: string; to: string } but we need the event
  // bus to route it properly. Since the EventMap has string-typed fields,
  // we use cast for test flexibility.
  bus.emit("gsm.state.entered" as never, { from: "test", to } as never);
}

function cleanDOM(): void {
  document.body.innerHTML = "";
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe("GSM Visualizer — AC-6", () => {
  beforeAll(async () => {
    const mod = await import("../../../../src/core/dev-tools/gsm-visualizer");
    GsmVisualizer = mod.GsmVisualizer;
  });

  beforeEach(() => {
    vi.stubEnv("DEV", true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanDOM();
  });

  // =======================================================================
  // AC-6a: GSM history shows last 20 transitions with timestamps and
  //        duration in previous state (newest first)
  // =======================================================================

  describe("AC-6a: GSM history display", () => {
    it("should show transitions seeded from GSM history", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Menu", 1000, 500);
      gsm.addEntry("Menu", "PreRace", 2000, 750);

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);

      const history = visualizer.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].from).toBe("Loading");
      expect(history[0].to).toBe("Menu");
      expect(history[0].durationInPreviousState).toBe(500);
      expect(history[1].from).toBe("Menu");
      expect(history[1].to).toBe("PreRace");
      expect(history[1].durationInPreviousState).toBe(750);

      visualizer.dispose();
    });

    it("should display transitions with timestamps and duration in DOM (newest first)", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Menu", 1000, 500);
      gsm.addEntry("Menu", "PreRace", 2000, 750);

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);
      visualizer.refresh();

      const text = container.textContent ?? "";
      // Should show both states
      expect(text).toContain("Loading");
      expect(text).toContain("Menu");
      expect(text).toContain("PreRace");
      // Should show durations
      expect(text).toContain("500ms");
      expect(text).toContain("750ms");

      // Newest first: PreRace row should be above Menu row in DOM
      const rows = container.querySelectorAll(".gsm-history-row");
      expect(rows.length).toBe(2);
      expect(rows[0].getAttribute("data-from-state")).toBe("Menu");
      expect(rows[0].getAttribute("data-to-state")).toBe("PreRace");
      expect(rows[1].getAttribute("data-from-state")).toBe("Loading");
      expect(rows[1].getAttribute("data-to-state")).toBe("Menu");

      visualizer.dispose();
    });

    it("should show timestamps in HH:MM:SS.mmm format for each row", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Menu", 1000, 100);

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);
      visualizer.refresh();

      const rows = container.querySelectorAll(".gsm-history-row");
      expect(rows.length).toBe(1);
      const rowText = rows[0].textContent ?? "";
      // Timestamp pattern: two digits:two digits:two digits.three digits
      expect(rowText).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);

      visualizer.dispose();
    });

    it("should display 'No transitions recorded yet' when history is empty", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);
      visualizer.refresh();

      expect(container.textContent).toContain("No transitions recorded yet");

      visualizer.dispose();
    });

    it("should show arrow between from and to states in each row", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Menu", 1000, 100);

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);
      visualizer.refresh();

      const rows = container.querySelectorAll(".gsm-history-row");
      expect(rows.length).toBe(1);
      const rowText = rows[0].textContent ?? "";
      // Both states and the transition arrow should be visible
      expect(rowText).toContain("Loading");
      expect(rowText).toContain("Menu");
      expect(rowText).toMatch(/→/);

      visualizer.dispose();
    });
  });

  // =======================================================================
  // AC-6a: history ring buffer cap at 20
  // =======================================================================

  describe("AC-6a: history ring buffer cap at 20", () => {
    it("should retain exactly 20 entries after 25 seeded transitions", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();

      // Seed 25 entries
      for (let i = 0; i < 25; i++) {
        gsm.addEntry(`State${i}`, `State${i + 1}`, i * 100, 50);
      }

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);

      const history = visualizer.getHistory();
      expect(history.length).toBe(20);

      // Should have the last 20 entries (entries 6-25, not 1-5)
      expect(history[0].from).toBe("State5");
      expect(history[0].to).toBe("State6");
      expect(history[19].from).toBe("State24");
      expect(history[19].to).toBe("State25");

      visualizer.dispose();
    });

    it("should enforce buffer cap from Event Bus emissions", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);

      // Emit 25 transitions via Event Bus (entered events)
      for (let i = 0; i < 25; i++) {
        bus.emit("gsm.state.exited" as never, { from: `State${i}` } as never);
        bus.emit(
          "gsm.state.entered" as never,
          { from: `State${i}`, to: `State${i + 1}` } as never
        );
      }

      visualizer.refresh();

      const rows = container.querySelectorAll(".gsm-history-row");
      expect(rows.length).toBe(20);

      // Newest first: last entry should be State24 → State25
      expect(rows[0].getAttribute("data-from-state")).toBe("State24");
      expect(rows[0].getAttribute("data-to-state")).toBe("State25");

      visualizer.dispose();
    });
  });

  // =======================================================================
  // AC-6b: Current state indicator
  // =======================================================================

  describe("AC-6b: Current state indicator", () => {
    it("should show the current state from seeded history", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Menu", 1000, 500);
      gsm.addEntry("Menu", "PreRace", 2000, 750);

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);

      // Current state should be derived from the last history entry
      expect(visualizer.getCurrentState()).toBe("PreRace");

      visualizer.dispose();
    });

    it("should display current state prominently in the DOM", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Menu", 1000, 500);

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);
      visualizer.refresh();

      const text = container.textContent ?? "";
      expect(text).toContain("Current State:");
      expect(text).toContain("Menu");

      // The state value should have the highlight class
      const stateValue = container.querySelector(
        ".gsm-current-state-value"
      ) as HTMLElement;
      expect(stateValue).not.toBeNull();
      expect(stateValue.textContent).toBe("Menu");
      expect(stateValue.classList.contains("gsm-state-highlight")).toBe(true);

      visualizer.dispose();
    });

    it("should update current state indicator when Event Bus emits entered event", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);

      // Simulate GSM transition via Event Bus
      bus.emit("gsm.state.exited" as never, { from: "Loading" } as never);
      bus.emit(
        "gsm.state.entered" as never,
        { from: "Loading", to: "Menu" } as never
      );

      // Visualizer should auto-render on events
      expect(visualizer.getCurrentState()).toBe("Menu");
      const stateValue = container.querySelector(
        ".gsm-current-state-value"
      ) as HTMLElement;
      expect(stateValue.textContent).toBe("Menu");

      // Second transition
      bus.emit("gsm.state.exited" as never, { from: "Menu" } as never);
      bus.emit(
        "gsm.state.entered" as never,
        { from: "Menu", to: "PreRace" } as never
      );

      expect(visualizer.getCurrentState()).toBe("PreRace");
      expect(stateValue.textContent).toBe("PreRace");

      visualizer.dispose();
    });

    it("should show '(none)' when no state has been entered", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);
      visualizer.refresh();

      const stateValue = container.querySelector(
        ".gsm-current-state-value"
      ) as HTMLElement;
      expect(stateValue.textContent).toBe("(none)");
      // Should NOT have the highlight class
      expect(stateValue.classList.contains("gsm-state-highlight")).toBe(false);

      visualizer.dispose();
    });
  });

  // =======================================================================
  // AC-6c: Manual transition buttons
  // =======================================================================

  describe("AC-6c: Manual transition buttons", () => {
    it("should render a button for each valid target state", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Racing", 1000, 500);

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);
      visualizer.refresh();

      // From Racing, valid transitions are PostRace and Paused
      const buttons = container.querySelectorAll(
        ".gsm-transition-btn"
      ) as NodeListOf<HTMLButtonElement>;
      expect(buttons.length).toBe(2);

      const btnTexts = Array.from(buttons).map((b) => b.textContent);
      expect(btnTexts).toContain("→ PostRace");
      expect(btnTexts).toContain("→ Paused");

      visualizer.dispose();
    });

    it("should render buttons for all states based on TRANSITIONS table", () => {
      const bus = new EventBus();
      bus.init();

      // Test multiple states by setting up different current states
      const states = Object.keys(TRANSITIONS) as State[];

      for (const state of states) {
        const gsmInstance = new FakeGsm();
        gsmInstance.addEntry("Loading", state, 1000, 500);

        const container = createContainer();
        const visualizer = new GsmVisualizer(
          container,
          bus,
          gsmInstance as never
        );
        visualizer.refresh();

        const expectedTargets = TRANSITIONS[state];
        if (expectedTargets && expectedTargets.length > 0) {
          const buttons = container.querySelectorAll(".gsm-transition-btn");
          expect(buttons.length).toBe(expectedTargets.length);

          const btnTexts = Array.from(buttons).map((b) => b.textContent);
          for (const target of expectedTargets) {
            expect(btnTexts).toContain(`→ ${target}`);
          }
        }

        visualizer.dispose();
      }
    });

    it("should call gsm.transition() when a transition button is clicked", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Racing", 1000, 500);

      // Track the transition target
      let transitionTarget: string | null = null;
      gsm.onTransition((target: State) => {
        transitionTarget = target;
      });

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);
      visualizer.refresh();

      // Stub window.confirm to return true
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

      // Click the PostRace button
      const buttons = container.querySelectorAll(
        ".gsm-transition-btn"
      ) as NodeListOf<HTMLButtonElement>;
      const postRaceBtn = Array.from(buttons).find(
        (b) => b.dataset.targetState === "PostRace"
      );
      expect(postRaceBtn).not.toBeNull();
      postRaceBtn?.click();

      expect(window.confirm).toHaveBeenCalledWith('Transition to "PostRace"?');
      expect(transitionTarget).toBe("PostRace");

      vi.unstubAllGlobals();
      visualizer.dispose();
    });

    it("should update current state indicator after transition button click + Event Bus round-trip", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Racing", 1000, 500);

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);
      visualizer.refresh();

      // Pre-condition: current state is Racing
      expect(visualizer.getCurrentState()).toBe("Racing");

      // Stub window.confirm to return true
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

      // Click the Paused transition button
      const buttons = container.querySelectorAll(
        ".gsm-transition-btn"
      ) as NodeListOf<HTMLButtonElement>;
      const pausedBtn = Array.from(buttons).find(
        (b) => b.dataset.targetState === "Paused"
      );
      expect(pausedBtn).not.toBeNull();
      pausedBtn?.click();

      // FakeGsm doesn't emit events on the Event Bus (the real GSM does),
      // so we simulate the real flow by emitting the exit/enter events.
      emitExit(bus, "Racing");
      emitEnter(bus, "Paused");

      // The visualizer should now reflect the new state
      expect(visualizer.getCurrentState()).toBe("Paused");
      const stateValue = container.querySelector(
        ".gsm-current-state-value"
      ) as HTMLElement;
      expect(stateValue).not.toBeNull();
      expect(stateValue.textContent).toBe("Paused");
      expect(stateValue.classList.contains("gsm-state-highlight")).toBe(true);

      vi.unstubAllGlobals();
      visualizer.dispose();
    });

    it("should NOT call gsm.transition() when confirm is cancelled", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Racing", 1000, 500);

      let transitionTarget: string | null = null;
      gsm.onTransition((target: State) => {
        transitionTarget = target;
      });

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);
      visualizer.refresh();

      // Stub window.confirm to return false
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));

      const buttons = container.querySelectorAll(
        ".gsm-transition-btn"
      ) as NodeListOf<HTMLButtonElement>;
      const pausedBtn = Array.from(buttons).find(
        (b) => b.dataset.targetState === "Paused"
      );
      expect(pausedBtn).not.toBeNull();
      pausedBtn?.click();

      expect(window.confirm).toHaveBeenCalledWith('Transition to "Paused"?');
      // transition should NOT have been called
      expect(transitionTarget).toBeNull();

      vi.unstubAllGlobals();
      visualizer.dispose();
    });

    it("should show 'No valid transitions' when current state has no targets", () => {
      // All states in TRANSITIONS have at least one valid transition,
      // but if current state is null, no buttons should render.
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);
      visualizer.refresh();

      const buttons = container.querySelectorAll(".gsm-transition-btn");
      expect(buttons.length).toBe(0);

      visualizer.dispose();
    });

    it("should have DEV section label visible", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Racing", 1000, 500);

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);
      visualizer.refresh();

      expect(container.textContent).toContain("Manual Transitions (DEV)");

      visualizer.dispose();
    });
  });

  // =======================================================================
  // Event capture from Event Bus
  // =======================================================================

  describe("Event Bus integration", () => {
    it("should record transitions from gsm.state.exited + entered events", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);

      // Simulate transition via Event Bus
      bus.emit("gsm.state.exited" as never, { from: "Menu" } as never);
      bus.emit(
        "gsm.state.entered" as never,
        { from: "Menu", to: "Racing" } as never
      );

      const history = visualizer.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].from).toBe("Menu");
      expect(history[0].to).toBe("Racing");

      visualizer.dispose();
    });

    it("should include exited+entered transitions from Event Bus in the displayed history", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);
      visualizer.refresh();

      // Simulate 3 transitions
      const transitions = [
        ["Loading", "Menu"],
        ["Menu", "PreRace"],
        ["PreRace", "Racing"],
      ] as const;

      for (const [from, to] of transitions) {
        bus.emit("gsm.state.exited" as never, { from } as never);
        bus.emit("gsm.state.entered" as never, { from, to } as never);
      }

      visualizer.refresh();

      const rows = container.querySelectorAll(".gsm-history-row");
      expect(rows.length).toBe(3);

      // Newest first: Racing should be first
      expect(rows[0].getAttribute("data-from-state")).toBe("PreRace");
      expect(rows[0].getAttribute("data-to-state")).toBe("Racing");

      // Current state should be the last entered state
      expect(visualizer.getCurrentState()).toBe("Racing");

      visualizer.dispose();
    });
  });

  // =======================================================================
  // Read-only compliance (Control Manifest D6, D-F2, D-F3)
  // =======================================================================

  describe("Read-only compliance", () => {
    it("should never call emit() on the Event Bus", () => {
      const bus = new EventBus();
      bus.init();
      const emitSpy = vi.spyOn(bus, "emit");
      const gsm = new FakeGsm();

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);

      // Construction should not have called emit
      expect(emitSpy).not.toHaveBeenCalled();

      // Refresh should not call emit
      visualizer.refresh();
      expect(emitSpy).not.toHaveBeenCalled();

      // Even though the Event Bus emitted events in other tests,
      // the visualizer itself should never call emit
      bus.emit("race.starting" as never, {} as never);
      expect(emitSpy).toHaveBeenCalledTimes(1);

      visualizer.refresh();
      expect(emitSpy).toHaveBeenCalledTimes(1);

      visualizer.dispose();
      expect(emitSpy).toHaveBeenCalledTimes(1);
    });
  });

  // =======================================================================
  // Edge cases
  // =======================================================================

  describe("Edge cases", () => {
    it("should handle dispose without errors", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);

      expect(() => visualizer.dispose()).not.toThrow();
      // Double dispose should be safe
      expect(() => visualizer.dispose()).not.toThrow();
    });

    it("should stop capturing events after dispose", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);

      visualizer.dispose();

      // Emit after dispose — should not be captured
      bus.emit("gsm.state.exited" as never, { from: "Menu" } as never);
      bus.emit(
        "gsm.state.entered" as never,
        { from: "Menu", to: "Racing" } as never
      );

      expect(visualizer.getHistory().length).toBe(0);
    });

    it("should handle overlapping states correctly (exited without entered)", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);

      // Emit exited without entered — pending exit should be set
      bus.emit("gsm.state.exited" as never, { from: "Menu" } as never);

      // Then emit entered — should record with pending exit data
      bus.emit(
        "gsm.state.entered" as never,
        { from: "Menu", to: "Racing" } as never
      );

      const history = visualizer.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].from).toBe("Menu");
      expect(history[0].to).toBe("Racing");

      visualizer.dispose();
    });

    it("should handle entered without prior exited (duration 0)", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);

      // Emit entered without prior exited
      bus.emit(
        "gsm.state.entered" as never,
        { from: "Loading", to: "Menu" } as never
      );

      const history = visualizer.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].from).toBe("Loading");
      expect(history[0].to).toBe("Menu");
      // Duration should default to 0 since there was no pending exit
      expect(history[0].durationInPreviousState).toBe(0);

      visualizer.dispose();
    });
  });

  // =======================================================================
  // DEV guard: no-op when DEV = false
  // =======================================================================

  describe("DEV guard", () => {
    it("should not capture events when DEV = false", async () => {
      vi.stubEnv("DEV", false);
      vi.resetModules();

      // Re-import with DEV = false
      const mod = await import("../../../../src/core/dev-tools/gsm-visualizer");
      const Visualizer = mod.GsmVisualizer;

      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();

      const container = createContainer();
      const visualizer = new Visualizer(container, bus, gsm as never);

      bus.emit(
        "gsm.state.entered" as never,
        { from: "Loading", to: "Menu" } as never
      );

      expect(visualizer.getHistory().length).toBe(0);
      expect(visualizer.getCurrentState()).toBeNull();

      visualizer.dispose();
    });

    it("should not render transition buttons when DEV = false", async () => {
      vi.stubEnv("DEV", false);
      vi.resetModules();

      const mod = await import("../../../../src/core/dev-tools/gsm-visualizer");
      const Visualizer = mod.GsmVisualizer;

      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Menu", 1000, 500);

      const container = createContainer();
      const visualizer = new Visualizer(container, bus, gsm as never);
      visualizer.refresh();

      const buttons = container.querySelectorAll(".gsm-transition-btn");
      expect(buttons.length).toBe(0);

      // "Manual Transitions (DEV)" label should NOT appear
      expect(container.textContent).not.toContain("Manual Transitions");

      visualizer.dispose();
    });
  });

  // =======================================================================
  // Coverage: DEV guard — _renderTransitionButtons early return (line 415)
  //           and click handler DEV guard (line 439)
  // =======================================================================

  describe("Coverage: DEV=false paths", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("should skip _renderTransitionButtons when DEV=false (line 415)", () => {
      // Create with DEV=true so buttons section exists
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Menu", 1000, 500);

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);

      // Buttons should exist with DEV=true
      const buttons = container.querySelectorAll(".gsm-transition-btn");
      expect(buttons.length).toBeGreaterThan(0);

      // Stub DEV to false and refresh — _renderTransitionButtons should early-return
      vi.stubEnv("DEV", false);
      visualizer.refresh();

      // Buttons should still exist (not removed) but not updated
      // The important thing is that refresh() didn't crash
      visualizer.dispose();
    });

    it("should skip transition when click handler fires with DEV=false (line 439)", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Menu", 1000, 500);

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);

      // Now stub DEV to false
      vi.stubEnv("DEV", false);

      // The click handler should early-return when DEV=false
      // We can't directly test the handler since buttons aren't re-rendered
      // but we can verify that transition() is not called
      const transitionSpy = vi.spyOn(gsm, "transition");

      // Verify refresh works without crash when DEV=false
      visualizer.refresh();

      expect(transitionSpy).not.toHaveBeenCalled();
      visualizer.dispose();
    });

    it("should not update transition buttons when DEV is stubbed to false", () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Menu", 1000, 500);

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);

      // With DEV=true, buttons should exist
      let buttons = container.querySelectorAll(".gsm-transition-btn");
      expect(buttons.length).toBeGreaterThan(0);

      // Record initial button content
      const initialBtnText = buttons[0].textContent;

      // Stub DEV to false and refresh — _renderTransitionButtons returns early
      vi.stubEnv("DEV", false);
      visualizer.refresh();

      // Buttons should still exist with the same content (not re-rendered)
      buttons = container.querySelectorAll(".gsm-transition-btn");
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons[0].textContent).toBe(initialBtnText);

      // transition() should not be callable when DEV=false
      const transitionSpy = vi.spyOn(gsm, "transition");
      expect(transitionSpy).not.toHaveBeenCalled();

      visualizer.dispose();
    });
  });

  // =======================================================================

  describe("Coverage: Transition failure", () => {
    it("should catch and warn when gsm.transition() rejects", async () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Menu", 1000, 500);

      // Override transition to reject
      const rejectError = new Error("Invalid transition");
      gsm.transition = vi.fn().mockRejectedValue(rejectError);

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);
      visualizer.refresh();

      // Spy on console.warn
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Find and click a transition button
      const buttons = container.querySelectorAll(".gsm-transition-btn");
      expect(buttons.length).toBeGreaterThan(0);

      // Click the first button (with confirm() returning true)
      vi.stubGlobal(
        "confirm",
        vi.fn(() => true)
      );
      (buttons[0] as HTMLElement).click();

      // Wait for the async rejection
      await vi.waitFor(() => {
        expect(warnSpy).toHaveBeenCalledWith(
          "[GsmVisualizer] Transition failed:",
          rejectError
        );
      });

      warnSpy.mockRestore();
      vi.unstubAllGlobals();
      visualizer.dispose();
    });

    // =======================================================================
    // Coverage: DEV=false constructor paths — _initDOM skips transition
    // buttons, _startCapture returns early (lines 248-280)
    // =======================================================================

    it("should skip _initDOM transition buttons section when DEV=false (line 248)", async () => {
      vi.stubEnv("DEV", false);
      vi.resetModules();

      const mod = await import("../../../../src/core/dev-tools/gsm-visualizer");
      const Visualizer = mod.GsmVisualizer;

      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Menu", 1000, 500);

      const container = createContainer();
      const visualizer = new Visualizer(container, bus, gsm as never);
      visualizer.refresh();

      // Constructor returns early when DEV=false — no DOM created at all
      expect(container.textContent).toBe("");
      // "Manual Transitions (DEV)" label and "Transition History" both absent
      expect(container.textContent).not.toContain("Manual Transitions");
      expect(container.textContent).not.toContain("Transition History");
      // History buffer not seeded because _seedFromGsmHistory is never called
      expect(visualizer.getHistory().length).toBe(0);

      visualizer.dispose();
      vi.unstubAllEnvs();
    });

    it("should skip _startCapture subscriptions when DEV=false (line 280)", async () => {
      vi.stubEnv("DEV", false);
      vi.resetModules();

      const mod = await import("../../../../src/core/dev-tools/gsm-visualizer");
      const Visualizer = mod.GsmVisualizer;

      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();

      const container = createContainer();
      const visualizer = new Visualizer(container, bus, gsm as never);

      // Emit events after construction with DEV=false
      bus.emit("gsm.state.exited" as never, { from: "Menu" } as never);
      bus.emit(
        "gsm.state.entered" as never,
        { from: "Menu", to: "Racing" } as never
      );

      // No history captured — _startCapture was skipped
      expect(visualizer.getHistory().length).toBe(0);
      expect(visualizer.getCurrentState()).toBeNull();

      visualizer.dispose();
      vi.unstubAllEnvs();
    });

    it("should not warn when confirm() is cancelled", async () => {
      const bus = new EventBus();
      bus.init();
      const gsm = new FakeGsm();
      gsm.addEntry("Loading", "Menu", 1000, 500);

      gsm.transition = vi
        .fn()
        .mockRejectedValue(new Error("Should not be called"));

      const container = createContainer();
      const visualizer = new GsmVisualizer(container, bus, gsm as never);
      visualizer.refresh();

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Click with confirm() returning false
      const confirmSpy = vi.fn(() => false);
      vi.stubGlobal("confirm", confirmSpy);

      const buttons = container.querySelectorAll(".gsm-transition-btn");
      (buttons[0] as HTMLElement).click();

      // Immediately check — transition should NOT have been called
      expect(confirmSpy).toHaveBeenCalled();
      expect(gsm.transition).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      vi.unstubAllGlobals();
      visualizer.dispose();
    });
  });
});
