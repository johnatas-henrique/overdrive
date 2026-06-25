import { describe, expect, it } from "vitest";
import type { State } from "../../src/foundation/gsm";
import {
  GameStateError,
  GameStateMachine,
  TRANSITIONS,
} from "../../src/foundation/gsm";

// ---------------------------------------------------------------------------
// Transition table
// ---------------------------------------------------------------------------

describe("TransitionTable", () => {
  it("should have entries for all 6 states", () => {
    const states: State[] = [
      "Loading",
      "Menu",
      "PreRace",
      "Racing",
      "Paused",
      "PostRace",
    ];
    for (const state of states) {
      expect(TRANSITIONS[state]).toBeDefined();
      expect(Array.isArray(TRANSITIONS[state])).toBe(true);
    }
  });

  it("Loading can only transition to Menu", () => {
    expect(TRANSITIONS.Loading).toEqual(["Menu"]);
  });

  it("Menu can only transition to PreRace", () => {
    expect(TRANSITIONS.Menu).toEqual(["PreRace"]);
  });

  it("PreRace can only transition to Racing", () => {
    expect(TRANSITIONS.PreRace).toEqual(["Racing"]);
  });

  it("Racing can transition to PostRace or Paused", () => {
    expect(TRANSITIONS.Racing).toEqual(["PostRace", "Paused"]);
  });

  it("Paused can transition to Racing or Menu", () => {
    expect(TRANSITIONS.Paused).toEqual(["Racing", "Menu"]);
  });

  it("PostRace can transition to Menu or PreRace", () => {
    expect(TRANSITIONS.PostRace).toEqual(["Menu", "PreRace"]);
  });
});

// ---------------------------------------------------------------------------
// AC-1: init() sets Loading
// ---------------------------------------------------------------------------

describe("AC-1: init() sets initial state to Loading", () => {
  it("should set currentState to Loading after init()", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should be idempotent — calling init() twice is a no-op", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.init(); // Second call — no error, state unchanged
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should return undefined before init() is called", () => {
    const gsm = new GameStateMachine();
    expect(gsm.getCurrentState()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-2: Valid transition
// ---------------------------------------------------------------------------

describe("AC-2: valid transition from Loading to Menu", () => {
  it("should transition from Loading to Menu", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
  });

  it("should not throw on a valid transition", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    expect(() => gsm.transition("Menu")).not.toThrow();
  });

  it("should support a full valid transition path: Loading → Menu → PreRace → Racing", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
    gsm.transition("PreRace");
    expect(gsm.getCurrentState()).toBe("PreRace");
    gsm.transition("Racing");
    expect(gsm.getCurrentState()).toBe("Racing");
  });

  it.each([
    undefined,
    null,
    "",
    "racing",
    "UNKNOWN",
  ])("should throw GameStateError for invalid target: %s", (invalid) => {
    const gsm = new GameStateMachine();
    gsm.init();
    expect(() => gsm.transition(invalid as unknown as State)).toThrow(
      GameStateError
    );
  });
});

// ---------------------------------------------------------------------------
// AC-3: Invalid transition throws GameStateError
// ---------------------------------------------------------------------------

describe("AC-3: invalid transition throws GameStateError", () => {
  it("should throw GameStateError when transitioning from Loading to Racing", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    expect(() => gsm.transition("Racing")).toThrow(GameStateError);
  });

  it("should throw with exact message 'Cannot transition from Loading to Racing'", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    expect(() => gsm.transition("Racing")).toThrow(
      "Cannot transition from Loading to Racing"
    );
  });

  it("should carry from/to fields on the error", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    try {
      gsm.transition("Racing");
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(GameStateError);
      const err = e as GameStateError;
      expect(err.from).toBe("Loading");
      expect(err.to).toBe("Racing");
    }
  });

  it("should leave state unchanged after a failed transition", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    try {
      gsm.transition("Racing");
    } catch {
      // Expected
    }
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should throw when transitioning from Loading to any state except Menu", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    // Note: "Loading" excluded — same-state transition is a no-op (AC-4)
    const invalidTargets: State[] = ["PreRace", "Racing", "Paused", "PostRace"];
    for (const target of invalidTargets) {
      expect(() => gsm.transition(target)).toThrow(GameStateError);
    }
  });

  it("should throw for every illegal transition pair from the transition table", () => {
    const states: State[] = [
      "Loading",
      "Menu",
      "PreRace",
      "Racing",
      "Paused",
      "PostRace",
    ];
    for (const from of states) {
      for (const to of states) {
        if (from === to) continue; // Same-state is no-op, tested separately
        const gsm = new GameStateMachine();
        // Navigate to `from` state
        if (from === "Loading") {
          gsm.init();
        } else {
          gsm.init();
          // Build a path to the `from` state
          const path = getPathTo(from);
          for (const step of path) {
            gsm.transition(step);
          }
        }

        const isAllowed = TRANSITIONS[from].includes(to);
        if (isAllowed) {
          expect(() => gsm.transition(to)).not.toThrow();
        } else {
          expect(() => gsm.transition(to)).toThrow(GameStateError);
        }
      }
    }
  });

  it("should throw GameStateError name set correctly", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    try {
      gsm.transition("Racing");
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as Error).name).toBe("GameStateError");
    }
  });
});

// ---------------------------------------------------------------------------
// AC-4: Same-state transition is silent no-op
// ---------------------------------------------------------------------------

describe("AC-4: same-state transition is a silent no-op", () => {
  it("should not throw when transitioning to the same state", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    expect(() => gsm.transition("Loading")).not.toThrow();
  });

  it("should leave state unchanged for same-state transition", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.transition("Loading");
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should be a no-op for EVERY state in the table", () => {
    const states: State[] = [
      "Loading",
      "Menu",
      "PreRace",
      "Racing",
      "Paused",
      "PostRace",
    ];
    for (const state of states) {
      const gsm = new GameStateMachine();
      gsm.init();
      // Navigate to `state`
      if (state !== "Loading") {
        const path = getPathTo(state);
        for (const step of path) {
          gsm.transition(step);
        }
      }
      // Same-state transition — no-op
      gsm.transition(state);
      expect(gsm.getCurrentState()).toBe(state);
    }
  });

  it("should handle 10 consecutive same-state calls", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    for (let i = 0; i < 10; i++) {
      gsm.transition("Loading");
    }
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should treat case-sensitive mismatches as invalid transitions", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    // @ts-expect-error — testing runtime case sensitivity with invalid state
    expect(() => gsm.transition("racing")).toThrow(GameStateError);
  });
});

// ---------------------------------------------------------------------------
// AC-5: currentState is read-only
// ---------------------------------------------------------------------------

describe("AC-5: currentState is a read-only getter", () => {
  it("should have getCurrentState() return the current state", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should not allow setting currentState via property assignment", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    // Attempt to set via type cast — should silently fail or be ignored
    (gsm as any).currentState = "Racing";
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("TypeScript private fields are not runtime-enforced (known limitation)", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    // JS private fields are runtime properties — `as any` bypasses TS privacy.
    // The contract is that no production code uses `as any` to bypass privacy.
    (gsm as any)._currentState = "Racing";
    expect(gsm.getCurrentState()).toBe("Racing");
  });

  it("should not have a public currentState setter", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    // Object.getOwnPropertyDescriptor checks if a setter exists
    const descriptor = Object.getOwnPropertyDescriptor(
      GameStateMachine.prototype,
      "currentState"
    );
    // There is no currentState property descriptor on the prototype —
    // getCurrentState() is a method, not a getter property
    expect(descriptor).toBeUndefined();
  });

  it("should not be deletable via delete operator", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (gsm as any).currentState;
    // The private field is unaffected — getter still returns Loading
    expect(gsm.getCurrentState()).toBe("Loading");
  });
});

// ---------------------------------------------------------------------------
// GameStateError
// ---------------------------------------------------------------------------

describe("GameStateError", () => {
  it("should construct with from and to fields", () => {
    const err = new GameStateError("Loading", "Racing");
    expect(err.from).toBe("Loading");
    expect(err.to).toBe("Racing");
  });

  it("should have correct message format", () => {
    const err = new GameStateError("Menu", "Paused");
    expect(err.message).toBe("Cannot transition from Menu to Paused");
  });

  it("should be an instance of Error", () => {
    const err = new GameStateError("Loading", "Menu");
    expect(err).toBeInstanceOf(Error);
  });

  it("should be an instance of GameStateError", () => {
    const err = new GameStateError("Loading", "Menu");
    expect(err).toBeInstanceOf(GameStateError);
  });

  it("should have name set to GameStateError", () => {
    const err = new GameStateError("Loading", "Menu");
    expect(err.name).toBe("GameStateError");
  });

  it("should capture stack trace", () => {
    const err = new GameStateError("Loading", "Menu");
    expect(err.stack).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Transition to uninitialized GSM
// ---------------------------------------------------------------------------

describe("Transition to uninitialized GSM", () => {
  it("should throw GameStateError when transitioning before init()", () => {
    const gsm = new GameStateMachine();
    expect(() => gsm.transition("Menu")).toThrow(GameStateError);
  });

  it("should throw with 'Uninitialized' as the from state", () => {
    const gsm = new GameStateMachine();
    try {
      gsm.transition("Menu");
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as GameStateError).from).toBe("Uninitialized");
      expect((e as GameStateError).to).toBe("Menu");
    }
  });
});

// ---------------------------------------------------------------------------
// Multi-step transitions
// ---------------------------------------------------------------------------

describe("Multi-step transitions", () => {
  it("should support Racing → Paused → Racing", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.transition("Menu");
    gsm.transition("PreRace");
    gsm.transition("Racing");
    gsm.transition("Paused");
    expect(gsm.getCurrentState()).toBe("Paused");
    gsm.transition("Racing");
    expect(gsm.getCurrentState()).toBe("Racing");
  });

  it("should support Racing → PostRace → Menu → PreRace → Racing", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.transition("Menu");
    gsm.transition("PreRace");
    gsm.transition("Racing");
    gsm.transition("PostRace");
    expect(gsm.getCurrentState()).toBe("PostRace");
    gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
    gsm.transition("PreRace");
    gsm.transition("Racing");
    expect(gsm.getCurrentState()).toBe("Racing");
  });

  it("should support Paused → Menu", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.transition("Menu");
    gsm.transition("PreRace");
    gsm.transition("Racing");
    gsm.transition("Paused");
    gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
  });

  it("should support PostRace → PreRace", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.transition("Menu");
    gsm.transition("PreRace");
    gsm.transition("Racing");
    gsm.transition("PostRace");
    gsm.transition("PreRace");
    expect(gsm.getCurrentState()).toBe("PreRace");
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a valid path from Loading to the target state.
 * Used by tests that need to navigate to a specific state before testing.
 */
function getPathTo(target: State): State[] {
  const paths: Record<State, State[]> = {
    Loading: [],
    Menu: ["Menu"],
    PreRace: ["Menu", "PreRace"],
    Racing: ["Menu", "PreRace", "Racing"],
    Paused: ["Menu", "PreRace", "Racing", "Paused"],
    PostRace: ["Menu", "PreRace", "Racing", "PostRace"],
  };
  return paths[target];
}
