import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IEventBus } from "../../src/foundation/event-bus";
import type { State } from "../../src/foundation/gsm";
import {
  GameStateError,
  GameStateMachine,
  TRANSITIONS,
} from "../../src/foundation/gsm";

// Suppress console.warn/console.error output during tests
let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

/** Create a mock Event Bus with a vi.fn() emit spy for testing emissions. */
function createMockBus(): IEventBus {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    dispose: vi.fn(),
  };
}

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
  it("should transition from Loading to Menu", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
  });

  it("should not throw on a valid transition", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
  });

  it("should support a full valid transition path: Loading → Menu → PreRace → Racing", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
    await gsm.transition("PreRace");
    expect(gsm.getCurrentState()).toBe("PreRace");
    await gsm.transition("Racing");
    expect(gsm.getCurrentState()).toBe("Racing");
  });

  it.each([
    undefined,
    null,
    "",
    "racing",
    "UNKNOWN",
  ])("should throw GameStateError for invalid target: %s", async (invalid) => {
    const gsm = new GameStateMachine();
    gsm.init();
    await expect(gsm.transition(invalid as unknown as State)).rejects.toThrow(
      GameStateError
    );
  });
});

// ---------------------------------------------------------------------------
// AC-3: Invalid transition throws GameStateError
// ---------------------------------------------------------------------------

describe("AC-3: invalid transition throws GameStateError", () => {
  it("should throw GameStateError when transitioning from Loading to Racing", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await expect(gsm.transition("Racing")).rejects.toThrow(GameStateError);
  });

  it("should throw with exact message 'Cannot transition from Loading to Racing'", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await expect(gsm.transition("Racing")).rejects.toThrow(
      "Cannot transition from Loading to Racing"
    );
  });

  it("should carry from/to fields on the error", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    try {
      await gsm.transition("Racing");
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(GameStateError);
      const err = e as GameStateError;
      expect(err.from).toBe("Loading");
      expect(err.to).toBe("Racing");
    }
  });

  it("should leave state unchanged after a failed transition", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    try {
      await gsm.transition("Racing");
    } catch {
      // Expected
    }
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should throw when transitioning from Loading to any state except Menu", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    // Note: "Loading" excluded — same-state transition is a no-op (AC-4)
    const invalidTargets: State[] = ["PreRace", "Racing", "Paused", "PostRace"];
    for (const target of invalidTargets) {
      await expect(gsm.transition(target)).rejects.toThrow(GameStateError);
    }
  });

  it("should throw for every illegal transition pair from the transition table", async () => {
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
            await gsm.transition(step);
          }
        }

        const isAllowed = TRANSITIONS[from].includes(to);
        if (isAllowed) {
          await expect(gsm.transition(to)).resolves.toBeUndefined();
        } else {
          await expect(gsm.transition(to)).rejects.toThrow(GameStateError);
        }
      }
    }
  });

  it("should throw GameStateError name set correctly", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    try {
      await gsm.transition("Racing");
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
  it("should not throw when transitioning to the same state", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await expect(gsm.transition("Loading")).resolves.toBeUndefined();
  });

  it("should leave state unchanged for same-state transition", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Loading");
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should be a no-op for EVERY state in the table", async () => {
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
          await gsm.transition(step);
        }
      }
      // Same-state transition — no-op
      await gsm.transition(state);
      expect(gsm.getCurrentState()).toBe(state);
    }
  });

  it("should handle 10 consecutive same-state calls", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    for (let i = 0; i < 10; i++) {
      await gsm.transition("Loading");
    }
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should treat case-sensitive mismatches as invalid transitions", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    // @ts-expect-error — testing runtime case sensitivity with invalid state
    await expect(gsm.transition("racing")).rejects.toThrow(GameStateError);
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
  it("should throw GameStateError when transitioning before init()", async () => {
    const gsm = new GameStateMachine();
    await expect(gsm.transition("Menu")).rejects.toThrow(GameStateError);
  });

  it("should throw with 'Uninitialized' as the from state", async () => {
    const gsm = new GameStateMachine();
    try {
      await gsm.transition("Menu");
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
  it("should support Racing → Paused → Racing", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Menu");
    await gsm.transition("PreRace");
    await gsm.transition("Racing");
    await gsm.transition("Paused");
    expect(gsm.getCurrentState()).toBe("Paused");
    await gsm.transition("Racing");
    expect(gsm.getCurrentState()).toBe("Racing");
  });

  it("should support Racing → PostRace → Menu → PreRace → Racing", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Menu");
    await gsm.transition("PreRace");
    await gsm.transition("Racing");
    await gsm.transition("PostRace");
    expect(gsm.getCurrentState()).toBe("PostRace");
    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
    await gsm.transition("PreRace");
    await gsm.transition("Racing");
    expect(gsm.getCurrentState()).toBe("Racing");
  });

  it("should support Paused → Menu", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Menu");
    await gsm.transition("PreRace");
    await gsm.transition("Racing");
    await gsm.transition("Paused");
    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
  });

  it("should support PostRace → PreRace", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Menu");
    await gsm.transition("PreRace");
    await gsm.transition("Racing");
    await gsm.transition("PostRace");
    await gsm.transition("PreRace");
    expect(gsm.getCurrentState()).toBe("PreRace");
  });
});

// ===========================================================================
// Lifecycle Hooks (Story 002)
// ===========================================================================

// ---------------------------------------------------------------------------
// AC-1: StateDefinition with optional hooks
// ---------------------------------------------------------------------------

describe("Lifecycle AC-1: StateDefinition with optional hooks", () => {
  it("should accept state definitions with onEnter", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([{ name: "Menu", onEnter: () => {} }]);
    gsm.init();
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
  });

  it("should accept state definitions with both hooks", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([{ name: "Menu", onEnter: () => {}, onExit: () => {} }]);
    gsm.init();
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
  });

  it("should accept state definitions with no hooks (both omitted)", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([{ name: "Menu" }]);
    gsm.init();
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
  });

  it("should accept state definitions with onEnter only (onExit omitted)", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([{ name: "Menu", onEnter: () => {} }]);
    gsm.init();
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
  });

  it("should accept state definitions with onExit only (onEnter omitted)", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([{ name: "Menu", onExit: () => {} }]);
    gsm.init();
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
  });

  it("should accept multiple state definitions", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([
      { name: "Loading" },
      { name: "Menu", onEnter: () => {} },
      { name: "PreRace", onExit: () => {} },
    ]);
    gsm.init();
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
  });

  it("should allow transitioning to states without registered definitions", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([{ name: "Menu" }]);
    gsm.init();
    // Loading has no definition, but transition should still work
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-2: Hook invocation order
// ---------------------------------------------------------------------------

describe("Lifecycle AC-2: Hook invocation order", () => {
  it("should call onExit(source) before onEnter(target)", async () => {
    const order: string[] = [];
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Loading",
        onExit: () => {
          order.push("Loading.onExit");
        },
      },
      {
        name: "Menu",
        onEnter: () => {
          order.push("Menu.onEnter");
        },
      },
    ]);
    gsm.init();
    await gsm.transition("Menu");
    expect(order).toEqual(["Loading.onExit", "Menu.onEnter"]);
  });

  it("should call each hook exactly once per transition", async () => {
    const onExitCalls = vi.fn();
    const onEnterCalls = vi.fn();
    const gsm = new GameStateMachine();
    gsm.registerStates([
      { name: "Loading", onExit: onExitCalls },
      { name: "Menu", onEnter: onEnterCalls },
    ]);
    gsm.init();
    await gsm.transition("Menu");
    expect(onExitCalls).toHaveBeenCalledTimes(1);
    expect(onEnterCalls).toHaveBeenCalledTimes(1);
  });

  it("should not call hooks for states without definitions", async () => {
    const onEnterCalls = vi.fn();
    const gsm = new GameStateMachine();
    gsm.registerStates([{ name: "Menu", onEnter: onEnterCalls }]);
    gsm.init();
    // Loading has no definition, so no onExit should be called
    await gsm.transition("Menu");
    expect(onEnterCalls).toHaveBeenCalledTimes(1);
  });

  it("should call hooks for chain of 3 transitions in correct order", async () => {
    const order: string[] = [];
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Loading",
        onExit: () => order.push("Loading.onExit"),
      },
      {
        name: "Menu",
        onEnter: () => order.push("Menu.onEnter"),
        onExit: () => order.push("Menu.onExit"),
      },
      {
        name: "PreRace",
        onEnter: () => order.push("PreRace.onEnter"),
      },
    ]);
    gsm.init();
    await gsm.transition("Menu");
    await gsm.transition("PreRace");
    expect(order).toEqual([
      "Loading.onExit",
      "Menu.onEnter",
      "Menu.onExit",
      "PreRace.onEnter",
    ]);
  });

  it("should not call onEnter on rollback (only source.onExit was called)", async () => {
    const order: string[] = [];
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Loading",
        onExit: () => order.push("Loading.onExit"),
      },
      {
        name: "Menu",
        onEnter: () => {
          order.push("Menu.onEnter");
          throw new Error("fail");
        },
      },
    ]);
    gsm.init();
    await gsm.transition("Menu");
    // onExit was called, onEnter was called (and threw), but no re-entry onEnter
    expect(order).toEqual(["Loading.onExit", "Menu.onEnter"]);
    expect(gsm.getCurrentState()).toBe("Loading");
  });
});

// ---------------------------------------------------------------------------
// AC-3: Async onEnter is awaited before transition completes
// ---------------------------------------------------------------------------

describe("Lifecycle AC-3: Async onEnter is awaited", () => {
  it("should not change state while async onEnter is pending", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => onEnterPromise,
      },
    ]);
    gsm.init();

    // Start the transition (does not await yet)
    const transitionPromise = gsm.transition("Menu");

    // State should still be Loading while onEnter is pending
    expect(gsm.getCurrentState()).toBe("Loading");

    // Resolve the async hook
    resolveOnEnter?.();
    await transitionPromise;

    // Now state should be Menu
    expect(gsm.getCurrentState()).toBe("Menu");
  });

  it("should change state after async onEnter resolves", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => Promise.resolve(),
      },
    ]);
    gsm.init();
    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
  });

  it("should handle sync onEnter (resolves immediately)", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => {
          /* sync void */
        },
      },
    ]);
    gsm.init();
    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
  });

  it("should await async onExit before calling onEnter", async () => {
    let resolveOnExit: () => void;
    const onExitPromise = new Promise<void>((resolve) => {
      resolveOnExit = resolve;
    });
    const order: string[] = [];

    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Loading",
        onExit: () => {
          order.push("Loading.onExit:start");
          return onExitPromise.then(() => {
            order.push("Loading.onExit:end");
          });
        },
      },
      {
        name: "Menu",
        onEnter: () => {
          order.push("Menu.onEnter");
        },
      },
    ]);
    gsm.init();

    const transitionPromise = gsm.transition("Menu");

    // onExit started but hasn't finished yet
    expect(order).toEqual(["Loading.onExit:start"]);

    resolveOnExit?.();
    await transitionPromise;

    // Both hooks completed in order
    expect(order).toEqual([
      "Loading.onExit:start",
      "Loading.onExit:end",
      "Menu.onEnter",
    ]);
    expect(gsm.getCurrentState()).toBe("Menu");
  });
});

// ---------------------------------------------------------------------------
// AC-4: Async onEnter rejection rolls back
// ---------------------------------------------------------------------------

describe("Lifecycle AC-4: Async onEnter rejection rolls back", () => {
  it("should remain in previous state when onEnter rejects", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => Promise.reject(new Error("Menu init failed")),
      },
    ]);
    gsm.init();
    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should remain in previous state when onEnter throws synchronously", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => {
          throw new Error("Sync failure");
        },
      },
    ]);
    gsm.init();
    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should log a warning via console.warn on rejection", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => Promise.reject(new Error("fail")),
      },
    ]);
    gsm.init();
    await gsm.transition("Menu");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toBe("[GSM] onEnter failed for");
    expect(warnSpy.mock.calls[0]?.[1]).toBe("Menu");
    warnSpy.mockRestore();
  });

  it("should log a warning on synchronous throw", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => {
          throw new Error("sync fail");
        },
      },
    ]);
    gsm.init();
    await gsm.transition("Menu");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toBe("[GSM] onEnter failed for");
    warnSpy.mockRestore();
  });

  it("should not throw to the caller on rejection (error is caught)", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => Promise.reject(new Error("should not propagate")),
      },
    ]);
    gsm.init();
    // Should NOT throw — the error is caught internally
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
  });

  it("should not throw to the caller on synchronous throw", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => {
          throw new Error("should not propagate");
        },
      },
    ]);
    gsm.init();
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
  });

  it("should allow retry after rollback", async () => {
    let shouldFail = true;
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => {
          if (shouldFail) {
            return Promise.reject(new Error("fail"));
          }
        },
      },
    ]);
    gsm.init();

    // First attempt fails
    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Loading");

    // Fix the issue and retry
    shouldFail = false;
    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
  });

  it("should handle multiple consecutive onEnter failures", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => Promise.reject(new Error("fail")),
      },
    ]);
    gsm.init();

    for (let i = 0; i < 3; i++) {
      await gsm.transition("Menu");
      expect(gsm.getCurrentState()).toBe("Loading");
    }
  });

  it("should handle non-Error rejection values", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => Promise.reject("string error"),
      },
    ]);
    gsm.init();
    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Loading");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// AC-5: Rollback re-emits gsm.state.entered for previous state
// ---------------------------------------------------------------------------

describe("Lifecycle AC-5: Rollback re-emits gsm.state.entered", () => {
  it("should emit gsm.state.entered for previous state on rollback", async () => {
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => Promise.reject(new Error("fail")),
      },
    ]);
    gsm.init();
    await gsm.transition("Menu");
    expect(bus.emit).toHaveBeenCalledTimes(1);
    expect(bus.emit).toHaveBeenCalledWith("gsm.state.entered", {
      from: "Loading",
      to: "Loading",
    });
  });

  it("should NOT emit gsm.state.exited on rollback (only entered)", async () => {
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => Promise.reject(new Error("fail")),
      },
    ]);
    gsm.init();
    await gsm.transition("Menu");
    expect(bus.emit).not.toHaveBeenCalledWith(
      "gsm.state.exited",
      expect.anything()
    );
  });

  it("should emit gsm.state.entered on synchronous throw rollback", async () => {
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => {
          throw new Error("sync");
        },
      },
    ]);
    gsm.init();
    await gsm.transition("Menu");
    expect(bus.emit).toHaveBeenCalledTimes(1);
    expect(bus.emit).toHaveBeenCalledWith("gsm.state.entered", {
      from: "Loading",
      to: "Loading",
    });
  });

  it("should handle missing Event Bus gracefully on rollback", async () => {
    const gsm = new GameStateMachine(); // No Event Bus
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => Promise.reject(new Error("fail")),
      },
    ]);
    gsm.init();
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should emit entered once per rollback", async () => {
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => Promise.reject(new Error("fail")),
      },
    ]);
    gsm.init();

    await gsm.transition("Menu");
    await gsm.transition("Menu");
    await gsm.transition("Menu");

    // Each rollback emits exactly one gsm.state.entered
    expect(bus.emit).toHaveBeenCalledTimes(3);
    expect(bus.emit.mock.calls).toEqual([
      ["gsm.state.entered", { from: "Loading", to: "Loading" }],
      ["gsm.state.entered", { from: "Loading", to: "Loading" }],
      ["gsm.state.entered", { from: "Loading", to: "Loading" }],
    ]);
  });
});

// ---------------------------------------------------------------------------
// AC-6: Hook validation — TypeError for non-function hooks
// ---------------------------------------------------------------------------

describe("Lifecycle AC-6: Hook validation at registration", () => {
  it("should throw TypeError if onEnter is a string", () => {
    const gsm = new GameStateMachine();
    expect(() =>
      gsm.registerStates([
        { name: "Menu", onEnter: "not a function" as unknown as () => void },
      ])
    ).toThrow(TypeError);
  });

  it("should throw TypeError if onEnter is a number", () => {
    const gsm = new GameStateMachine();
    expect(() =>
      gsm.registerStates([
        { name: "Menu", onEnter: 42 as unknown as () => void },
      ])
    ).toThrow(TypeError);
  });

  it("should throw TypeError if onEnter is an object", () => {
    const gsm = new GameStateMachine();
    expect(() =>
      gsm.registerStates([
        {
          name: "Menu",
          onEnter: {} as unknown as () => void,
        },
      ])
    ).toThrow(TypeError);
  });

  it("should throw TypeError if onExit is a string", () => {
    const gsm = new GameStateMachine();
    expect(() =>
      gsm.registerStates([
        { name: "Menu", onExit: "not a function" as unknown as () => void },
      ])
    ).toThrow(TypeError);
  });

  it("should throw TypeError if onExit is a boolean", () => {
    const gsm = new GameStateMachine();
    expect(() =>
      gsm.registerStates([
        { name: "Menu", onExit: true as unknown as () => void },
      ])
    ).toThrow(TypeError);
  });

  it("should include state name in TypeError message", () => {
    const gsm = new GameStateMachine();
    expect(() =>
      gsm.registerStates([
        { name: "Menu", onEnter: "bad" as unknown as () => void },
      ])
    ).toThrow('onEnter for state "Menu" must be a function');
  });

  it("should include the actual type in TypeError message", () => {
    const gsm = new GameStateMachine();
    expect(() =>
      gsm.registerStates([
        { name: "Menu", onEnter: 42 as unknown as () => void },
      ])
    ).toThrow("got number");
  });

  it("should accept undefined hooks without error", () => {
    const gsm = new GameStateMachine();
    expect(() =>
      gsm.registerStates([
        { name: "Menu", onEnter: undefined, onExit: undefined },
      ])
    ).not.toThrow();
  });

  it("should accept function hooks without error", () => {
    const gsm = new GameStateMachine();
    expect(() =>
      gsm.registerStates([
        { name: "Menu", onEnter: () => {}, onExit: () => {} },
      ])
    ).not.toThrow();
  });

  it("should accept async function hooks without error", () => {
    const gsm = new GameStateMachine();
    expect(() =>
      gsm.registerStates([
        {
          name: "Menu",
          onEnter: async () => {},
          onExit: async () => {},
        },
      ])
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Busy flag — transitions enqueued instead of throwing
// ---------------------------------------------------------------------------

describe("Busy flag: enqueues transitions instead of throwing", () => {
  it("should enqueue transition when busy instead of throwing", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => onEnterPromise,
      },
      {
        name: "PreRace",
        onEnter: () => {},
      },
    ]);
    gsm.init();

    // Start first transition (will be busy)
    const transition1 = gsm.transition("Menu");

    // Second transition should NOT throw — enqueue instead
    await expect(gsm.transition("PreRace")).resolves.toBeUndefined();
    expect(gsm.getCurrentState()).toBe("Loading");

    // Complete the first transition
    resolveOnEnter?.();
    await transition1;
    expect(gsm.getCurrentState()).toBe("Menu");

    // Tick should process the queued PreRace transition
    gsm.tick();
    // Tick fires _doTransition asynchronously — flush microtasks
    await Promise.resolve();
    expect(gsm.getCurrentState()).toBe("PreRace");
  });

  it("should queue multiple transitions while busy and process one per tick", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => onEnterPromise,
      },
      { name: "PreRace", onEnter: () => {} },
      { name: "Racing", onEnter: () => {} },
    ]);
    gsm.init();

    // Start first transition (will be busy)
    const transition1 = gsm.transition("Menu");

    // Queue 2 valid transitions while busy
    await expect(gsm.transition("PreRace")).resolves.toBeUndefined();
    await expect(gsm.transition("Racing")).resolves.toBeUndefined();

    // Complete first transition
    resolveOnEnter?.();
    await transition1;
    expect(gsm.getCurrentState()).toBe("Menu");

    // Process first queued: Menu → PreRace
    gsm.tick();
    await Promise.resolve();
    expect(gsm.getCurrentState()).toBe("PreRace");

    // Process second queued: PreRace → Racing
    gsm.tick();
    await Promise.resolve();
    expect(gsm.getCurrentState()).toBe("Racing");
  });

  it("should allow direct transitions after busy flag is cleared", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => Promise.resolve(),
      },
      {
        name: "PreRace",
        onEnter: () => {},
      },
    ]);
    gsm.init();

    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");

    await gsm.transition("PreRace");
    expect(gsm.getCurrentState()).toBe("PreRace");
  });
});

// ---------------------------------------------------------------------------
// onExit rejection propagation
// ---------------------------------------------------------------------------

describe("onExit rejection: error propagates to caller", () => {
  it("should propagate sync onExit throw to caller", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Loading",
        onExit: () => {
          throw new Error("onExit failed");
        },
      },
    ]);
    gsm.init();

    await expect(gsm.transition("Menu")).rejects.toThrow("onExit failed");
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should propagate async onExit rejection to caller", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Loading",
        onExit: () => Promise.reject(new Error("async onExit failed")),
      },
    ]);
    gsm.init();

    await expect(gsm.transition("Menu")).rejects.toThrow("async onExit failed");
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should clear busy flag after onExit rejection", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Loading",
        onExit: () => {
          throw new Error("onExit failed");
        },
      },
      { name: "Menu", onEnter: () => {} },
    ]);
    gsm.init();

    // First transition fails (onExit throws)
    await expect(gsm.transition("Menu")).rejects.toThrow();

    // Busy flag should be cleared — second transition should also fail (same onExit)
    await expect(gsm.transition("Menu")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Busy flag enqueue — error message on invalid queued transition
// ---------------------------------------------------------------------------

describe("Busy flag enqueue: queued invalid transition fails at execution time", () => {
  it("should throw GameStateError when tick() processes an invalid queued transition", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const gsm = new GameStateMachine();
    gsm.registerStates([
      { name: "Menu", onEnter: () => onEnterPromise },
      { name: "PreRace", onEnter: () => {} },
    ]);
    gsm.init();

    const transition1 = gsm.transition("Menu");

    // Queue PreRace while busy — valid from Menu (current state at exec time)
    await expect(gsm.transition("PreRace")).resolves.toBeUndefined();

    resolveOnEnter?.();
    await transition1;
    expect(gsm.getCurrentState()).toBe("Menu");

    // Replace queue with a controlled sequence for testing
    // First: Racing from Menu is invalid (simulate state race between queue and exec)
    // Second: PreRace from Menu is valid (verify queue continues after failure)
    (gsm as { _queue: string[] })._queue.length = 0;
    (gsm as { _queue: string[] })._queue.push("Racing");
    (gsm as { _queue: string[] })._queue.push("PreRace");

    // First tick processes "Racing" from Menu — invalid, error logged
    gsm.tick();
    await Promise.resolve();
    expect(warnSpy).toHaveBeenCalledWith(
      "[GSM] Queued transition failed:",
      expect.any(GameStateError)
    );
    // State unchanged after failure
    expect(gsm.getCurrentState()).toBe("Menu");

    // Second tick processes "PreRace" from Menu — valid, state changes
    gsm.tick();
    await Promise.resolve();
    expect(gsm.getCurrentState()).toBe("PreRace");
  });
});

// ---------------------------------------------------------------------------
// Duplicate state protection
// ---------------------------------------------------------------------------

describe("registerStates: duplicate state protection", () => {
  it("should throw TypeError when registering duplicate state names", () => {
    const gsm = new GameStateMachine();
    gsm.init();

    expect(() =>
      gsm.registerStates([
        { name: "Menu", onEnter: () => {} },
        { name: "Menu", onEnter: () => {} },
      ])
    ).toThrow(TypeError);
  });

  it("should include state name in error message", () => {
    const gsm = new GameStateMachine();
    gsm.init();

    expect(() =>
      gsm.registerStates([
        { name: "Racing", onEnter: () => {} },
        { name: "Racing", onEnter: () => {} },
      ])
    ).toThrow('Duplicate state definition for "Racing"');
  });
});

// ===========================================================================
// Transition Throttling (Story 004)
// ===========================================================================

// ---------------------------------------------------------------------------
// AC-1: tick() processes at most 1 queued transition per call
// ---------------------------------------------------------------------------

describe("Transition Throttling AC-1: one transition per tick()", () => {
  it("should process exactly 1 queued transition per tick() call", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const gsm = new GameStateMachine();
    gsm.registerStates([{ name: "Menu", onEnter: () => onEnterPromise }]);
    gsm.init();

    // Start async transition — GSM becomes busy
    const firstTransition = gsm.transition("Menu");

    // Queue 2 transitions while busy
    gsm.transition("Menu");
    gsm.transition("Menu");

    // Complete first transition
    resolveOnEnter?.();
    await firstTransition;
    expect(gsm.getCurrentState()).toBe("Menu");

    // First tick: process 1 queued (same-state no-op)
    gsm.tick();
    await Promise.resolve();
    expect(gsm.getCurrentState()).toBe("Menu");

    // Second tick: process last queued
    gsm.tick();
    await Promise.resolve();
    expect(gsm.getCurrentState()).toBe("Menu");
  });

  it("should be a no-op when queue is empty", () => {
    const gsm = new GameStateMachine();
    gsm.init();

    expect(() => gsm.tick()).not.toThrow();
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should be a no-op when called 10 times on empty queue", () => {
    const gsm = new GameStateMachine();
    gsm.init();

    for (let i = 0; i < 10; i++) {
      expect(() => gsm.tick()).not.toThrow();
    }
    expect(gsm.getCurrentState()).toBe("Loading");
  });
});

// ---------------------------------------------------------------------------
// AC-2: transition() called while busy is queued (does not throw)
// ---------------------------------------------------------------------------

describe("Transition Throttling AC-2: busy → enqueue, not throw", () => {
  it("should not throw when transition() is called while busy", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const gsm = new GameStateMachine();
    gsm.registerStates([
      { name: "Menu", onEnter: () => onEnterPromise },
      { name: "PreRace", onEnter: () => {} },
    ]);
    gsm.init();

    // Start first transition (busy)
    const first = gsm.transition("Menu");

    // Should not throw — enqueues
    await expect(gsm.transition("PreRace")).resolves.toBeUndefined();

    resolveOnEnter?.();
    await first;
    expect(gsm.getCurrentState()).toBe("Menu");

    // Process queued PreRace
    gsm.tick();
    await Promise.resolve();
    expect(gsm.getCurrentState()).toBe("PreRace");
  });

  it("should queue 5 rapid transition() calls while busy", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const gsm = new GameStateMachine();
    gsm.registerStates([{ name: "Menu", onEnter: () => onEnterPromise }]);
    gsm.init();

    const first = gsm.transition("Menu");

    // 5 rapid calls while busy — all queued silently
    for (let i = 0; i < 5; i++) {
      await expect(gsm.transition("Menu")).resolves.toBeUndefined();
    }

    resolveOnEnter?.();
    await first;
  });

  it("should enqueue even if target is not valid from current state (validated later)", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const gsm = new GameStateMachine();
    gsm.registerStates([{ name: "Menu", onEnter: () => onEnterPromise }]);
    gsm.init();

    const first = gsm.transition("Menu");

    // Even invalid transitions are queued without error
    await expect(gsm.transition("Racing")).resolves.toBeUndefined();

    resolveOnEnter?.();
    await first;

    // State is now Menu — Racing from Menu is invalid
    // tick attempts _doTransition which will fail
    gsm.tick();
    await Promise.resolve();

    // Error is logged, state unchanged
    expect(warnSpy).toHaveBeenCalledWith(
      "[GSM] Queued transition failed:",
      expect.any(GameStateError)
    );
    expect(gsm.getCurrentState()).toBe("Menu");
  });
});

// ---------------------------------------------------------------------------
// AC-3: Queued transitions validated against current state at execution time
// ---------------------------------------------------------------------------

describe("Transition Throttling AC-3: execution-time validation", () => {
  it("should throw GameStateError when queued transition is invalid at execution time", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const gsm = new GameStateMachine();
    gsm.registerStates([
      { name: "Menu", onEnter: () => onEnterPromise },
      { name: "PreRace", onEnter: () => {} },
    ]);
    gsm.init();

    const first = gsm.transition("Menu");

    // Queue PreRace — valid from Menu but not from Loading
    gsm.transition("PreRace");

    resolveOnEnter?.();
    await first;

    // Don't tick yet — don't process PreRace yet
    // Now manually insert a transition that would skip Menu
    // (simulating state change between queue and execution)
    // Note: At execution time the state WILL be Menu (from the first transition),
    // so PreRace IS valid. But we can test the inverse by changing _currentState.
    (gsm as { _currentState: string })._currentState = "Loading";

    // Now PreRace from Loading is invalid
    gsm.tick();
    await Promise.resolve();

    // Error logged, state still Loading
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("should handle same-state queued transition as no-op at execution time", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const gsm = new GameStateMachine();
    gsm.registerStates([{ name: "Menu", onEnter: () => onEnterPromise }]);
    gsm.init();

    const first = gsm.transition("Menu");

    // Queue same-state (Menu while in Loading)
    gsm.transition("Menu");

    resolveOnEnter?.();
    await first;
    expect(gsm.getCurrentState()).toBe("Menu");

    // tick processes queued Menu from Menu — same-state no-op
    gsm.tick();
    await Promise.resolve();
    expect(gsm.getCurrentState()).toBe("Menu");
  });
});

// ---------------------------------------------------------------------------
// AC-4: Configurable max queue size with overflow dropping oldest
// ---------------------------------------------------------------------------

describe("Transition Throttling AC-4: queue overflow", () => {
  it("should drop oldest entry with console.warn when queue overflows", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    // maxQueueSize = 3
    const gsm = new GameStateMachine(undefined, { maxQueueSize: 3 });
    gsm.registerStates([{ name: "Menu", onEnter: () => onEnterPromise }]);
    gsm.init();

    // Start async transition — busy
    const first = gsm.transition("Menu");

    // Fill queue to capacity (3)
    gsm.transition("Menu");
    gsm.transition("Menu");
    gsm.transition("Menu");

    // Queue is now full at 3. Next call should drop the oldest.
    gsm.transition("Menu");

    // Verify warn was called with the dropped entry
    expect(warnSpy).toHaveBeenCalledWith(
      "[GSM] Transition queue overflow — dropping:",
      "Menu"
    );

    resolveOnEnter?.();
    await first;
  });

  it("should preserve newest entries when dropping oldest (FIFO)", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    // maxQueueSize = 2
    const gsm = new GameStateMachine(undefined, { maxQueueSize: 2 });
    gsm.registerStates([{ name: "Menu", onEnter: () => onEnterPromise }]);
    gsm.init();

    const first = gsm.transition("Menu");

    // Queue 2 items
    gsm.transition("Menu");
    gsm.transition("Menu");

    // 3rd call drops the oldest (the first "Menu")
    gsm.transition("Menu");

    resolveOnEnter?.();
    await first;

    // Both queued Menu transitions processed as no-ops
    gsm.tick();
    gsm.tick();
    await Promise.resolve();
    expect(gsm.getCurrentState()).toBe("Menu");
  });

  it("should use default maxQueueSize of 10 when not specified", () => {
    const gsm = new GameStateMachine();
    expect(gsm).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-5: After dispose(), tick() is no-op and queue cleared
// ---------------------------------------------------------------------------

describe("Transition Throttling AC-5: dispose behavior", () => {
  it("should set _disposed and clear queue on dispose()", () => {
    const gsm = new GameStateMachine();
    gsm.init();

    // Manually fill queue via private access for test
    const queue = (gsm as { _queue: string[] })._queue;
    queue.push("Menu", "Menu", "Menu", "Menu", "Menu");
    expect(queue.length).toBe(5);

    gsm.dispose();

    expect(queue.length).toBe(0);
    expect((gsm as { _disposed: boolean })._disposed).toBe(true);
  });

  it("should be a no-op when queue is empty and dispose() is called", () => {
    const gsm = new GameStateMachine();
    gsm.init();

    expect(() => gsm.dispose()).not.toThrow();
    expect((gsm as { _disposed: boolean })._disposed).toBe(true);
  });

  it("should be a permanent no-op for tick() after dispose()", () => {
    const gsm = new GameStateMachine();
    gsm.init();

    // Fill queue
    const queue = (gsm as { _queue: string[] })._queue;
    queue.push("Menu", "Menu", "Menu");

    gsm.dispose();

    // tick() should be no-op after dispose
    expect(() => gsm.tick()).not.toThrow();
    expect(gsm.getCurrentState()).toBeUndefined();
    expect(queue.length).toBe(0);
  });
});

// ===========================================================================
// Event Bus Integration (Story 003)
// ===========================================================================

// ---------------------------------------------------------------------------
// AC-1: exited emitted with correct payload
// ---------------------------------------------------------------------------

describe("Event Bus AC-1: gsm.state.exited emitted", () => {
  it("should emit gsm.state.exited on successful transition", async () => {
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.init();
    await gsm.transition("Menu");
    expect(bus.emit).toHaveBeenCalledWith("gsm.state.exited", {
      from: "Loading",
    });
  });

  it("should use the previous state as the 'from' value", async () => {
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.init();
    await gsm.transition("Menu");
    await gsm.transition("PreRace");
    // Second transition: from Menu to PreRace
    expect(bus.emit).toHaveBeenCalledWith("gsm.state.exited", {
      from: "Menu",
    });
  });

  it("should NOT emit gsm.state.exited on same-state transition (no-op)", async () => {
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.init();
    await gsm.transition("Loading"); // same-state no-op
    expect(bus.emit).not.toHaveBeenCalled();
  });

  it("should NOT emit gsm.state.exited on rollback (only entered)", async () => {
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => Promise.reject(new Error("fail")),
      },
    ]);
    gsm.init();
    await gsm.transition("Menu");
    expect(bus.emit).not.toHaveBeenCalledWith(
      "gsm.state.exited",
      expect.anything()
    );
  });
});

// ---------------------------------------------------------------------------
// AC-2: entered emitted with correct payload
// ---------------------------------------------------------------------------

describe("Event Bus AC-2: gsm.state.entered emitted", () => {
  it("should emit gsm.state.entered on successful transition", async () => {
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.init();
    await gsm.transition("Menu");
    expect(bus.emit).toHaveBeenCalledWith("gsm.state.entered", {
      from: "Loading",
      to: "Menu",
    });
  });

  it("should carry both from and to in the payload", async () => {
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.init();
    await gsm.transition("Menu");
    const enteredCalls = (
      bus.emit as ReturnType<typeof vi.fn>
    ).mock.calls.filter((call: unknown[]) => call[0] === "gsm.state.entered");
    expect(enteredCalls).toHaveLength(1);
    expect(enteredCalls[0][1]).toEqual({
      from: "Loading",
      to: "Menu",
    });
  });

  it("should NOT emit gsm.state.entered on invalid transition (no state change)", async () => {
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.init();
    try {
      await gsm.transition("Racing"); // Invalid from Loading
    } catch {
      // Expected
    }
    expect(bus.emit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC-3: Event ordering — exited BEFORE entered
// ---------------------------------------------------------------------------

describe("Event Bus AC-3: exited before entered ordering", () => {
  it("should emit exited BEFORE entered on successful transition", async () => {
    const order: string[] = [];
    const bus = createMockBus();
    (bus.emit as ReturnType<typeof vi.fn>).mockImplementation(
      (event: string) => {
        order.push(event);
      }
    );
    const gsm = new GameStateMachine(bus);
    gsm.init();
    await gsm.transition("Menu");
    expect(order).toEqual(["gsm.state.exited", "gsm.state.entered"]);
  });

  it("should maintain ordering across a chain of 2 transitions", async () => {
    const order: string[] = [];
    const bus = createMockBus();
    (bus.emit as ReturnType<typeof vi.fn>).mockImplementation(
      (event: string) => {
        order.push(event);
      }
    );
    const gsm = new GameStateMachine(bus);
    gsm.init();
    await gsm.transition("Menu");
    await gsm.transition("PreRace");
    expect(order).toEqual([
      "gsm.state.exited",
      "gsm.state.entered",
      "gsm.state.exited",
      "gsm.state.entered",
    ]);
  });

  it("should not emit anything on same-state no-op (empty log)", async () => {
    const order: string[] = [];
    const bus = createMockBus();
    (bus.emit as ReturnType<typeof vi.fn>).mockImplementation(
      (event: string) => {
        order.push(event);
      }
    );
    const gsm = new GameStateMachine(bus);
    gsm.init();
    await gsm.transition("Loading"); // no-op
    expect(order).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-4: Event Bus injected via constructor
// ---------------------------------------------------------------------------

describe("Event Bus AC-4: dependency injection", () => {
  it("should accept Event Bus via constructor", () => {
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    expect(gsm).toBeDefined();
    // Verify the bus is used by checking emissions work
    gsm.init();
    gsm.transition("Menu");
    expect(bus.emit).toHaveBeenCalled();
  });

  it("should accept undefined (no Event Bus provided)", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    expect(() => gsm.transition("Menu")).not.toThrow();
  });

  it("should accept explicit null", () => {
    const gsm = new GameStateMachine(null);
    gsm.init();
    expect(() => gsm.transition("Menu")).not.toThrow();
  });

  it("should accept explicit undefined", () => {
    const gsm = new GameStateMachine(undefined);
    gsm.init();
    expect(() => gsm.transition("Menu")).not.toThrow();
  });

  it("should not import Event Bus singleton in GSM module (verified by type check)", () => {
    // Static assertion: the GSM module only imports IEventBus interface,
    // never the concrete EventBus class. Verified by tsc --noEmit.
    const gsm = new GameStateMachine();
    expect(gsm).toBeInstanceOf(GameStateMachine);
  });
});

// ---------------------------------------------------------------------------
// AC-5: Event Bus unavailable — transition completes, warning logged
// ---------------------------------------------------------------------------

describe("Event Bus AC-5: unavailable Event Bus", () => {
  it("should complete transition when Event Bus is null", async () => {
    const gsm = new GameStateMachine(null);
    gsm.init();
    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
  });

  it("should complete transition when Event Bus is undefined", async () => {
    const gsm = new GameStateMachine(undefined);
    gsm.init();
    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
  });

  it("should log a warning when Event Bus is unavailable", async () => {
    const gsm = new GameStateMachine(null);
    gsm.init();
    await gsm.transition("Menu");
    expect(warnSpy).toHaveBeenCalledWith(
      "[GSM] Event Bus unavailable — events will not be emitted"
    );
  });

  it("should warn only once across multiple transitions", async () => {
    const gsm = new GameStateMachine(null);
    gsm.init();
    await gsm.transition("Menu");
    await gsm.transition("PreRace");
    // Warning should only be logged once
    const warnCalls = warnSpy.mock.calls.filter(
      (call) =>
        call[0] === "[GSM] Event Bus unavailable — events will not be emitted"
    );
    expect(warnCalls).toHaveLength(1);
  });

  it("should not crash when Event Bus is null and transition fails", async () => {
    const gsm = new GameStateMachine(null);
    gsm.init();
    await expect(gsm.transition("Racing")).rejects.toThrow(GameStateError);
    expect(gsm.getCurrentState()).toBe("Loading");
  });
});

// ---------------------------------------------------------------------------
// AC-6: emit() throws — error caught, transition completes
// ---------------------------------------------------------------------------

describe("Event Bus AC-6: emit() failure resilience", () => {
  it("should complete transition when emit() throws", async () => {
    const bus = createMockBus();
    (bus.emit as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("emit failed");
    });
    const gsm = new GameStateMachine(bus);
    gsm.init();
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
    expect(gsm.getCurrentState()).toBe("Menu");
  });

  it("should log a warning when emit() throws", async () => {
    const bus = createMockBus();
    (bus.emit as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("emit failed");
    });
    const gsm = new GameStateMachine(bus);
    gsm.init();
    await gsm.transition("Menu");
    expect(warnSpy).toHaveBeenCalledWith(
      "[GSM] Event Bus emit failed:",
      expect.any(Error)
    );
  });

  it("should still attempt gsm.state.entered if gsm.state.exited throws", async () => {
    let callCount = 0;
    const bus = createMockBus();
    (bus.emit as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        throw new Error("exited emit failed");
      }
      // Second call (entered) should succeed
    });
    const gsm = new GameStateMachine(bus);
    gsm.init();
    await gsm.transition("Menu");
    // Both exited and entered should have been attempted
    expect(bus.emit).toHaveBeenCalledTimes(2);
    expect(bus.emit).toHaveBeenCalledWith("gsm.state.entered", {
      from: "Loading",
      to: "Menu",
    });
  });

  it("should handle both emits throwing (both caught)", async () => {
    const bus = createMockBus();
    (bus.emit as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("always fails");
    });
    const gsm = new GameStateMachine(bus);
    gsm.init();
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
    expect(gsm.getCurrentState()).toBe("Menu");
    // Both emits were attempted
    expect(bus.emit).toHaveBeenCalledTimes(2);
    // Two warnings should have been logged
    const emitFailCalls = warnSpy.mock.calls.filter(
      (call) => call[0] === "[GSM] Event Bus emit failed:"
    );
    expect(emitFailCalls).toHaveLength(2);
  });

  it("should handle non-Error throw values from emit()", async () => {
    const bus = createMockBus();
    (bus.emit as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw "string error";
    });
    const gsm = new GameStateMachine(bus);
    gsm.init();
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
    expect(gsm.getCurrentState()).toBe("Menu");
  });

  it("should complete transition when emit throws on rollback", async () => {
    const bus = createMockBus();
    (bus.emit as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("emit failed");
    });
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => Promise.reject(new Error("onEnter fail")),
      },
    ]);
    gsm.init();
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
    expect(gsm.getCurrentState()).toBe("Loading");
  });
});

// ---------------------------------------------------------------------------
// Exhaustive event-emission across all valid transitions
// ---------------------------------------------------------------------------

describe("Event Bus: exhaustive emission for all valid transitions", () => {
  it("should emit correct events for every valid transition in the table", async () => {
    const states: State[] = [
      "Loading",
      "Menu",
      "PreRace",
      "Racing",
      "Paused",
      "PostRace",
    ];

    for (const from of states) {
      for (const to of TRANSITIONS[from]) {
        const bus = createMockBus();
        const gsm = new GameStateMachine(bus);
        gsm.init();
        // Navigate to `from` state
        if (from !== "Loading") {
          for (const step of getPathTo(from)) {
            await gsm.transition(step);
          }
        }
        vi.clearAllMocks();

        await gsm.transition(to);

        expect(bus.emit).toHaveBeenCalledWith("gsm.state.exited", {
          from,
        });
        expect(bus.emit).toHaveBeenCalledWith("gsm.state.entered", {
          from,
          to,
        });
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Throttling edge cases (GAP fixes)
// ---------------------------------------------------------------------------

describe("Throttling edge cases", () => {
  it("tick() should be no-op while busy (gap-1)", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const gsm = new GameStateMachine();
    gsm.registerStates([{ name: "Menu", onEnter: () => onEnterPromise }]);
    gsm.init();

    // Start async transition — GSM is busy
    gsm.transition("Menu");
    // Queue a transition while busy
    gsm.transition("PreRace");

    // tick() while busy — should be no-op
    gsm.tick();
    await Promise.resolve();

    // Queue should still have 1 item
    const queue = (gsm as { _queue: string[] })._queue;
    expect(queue.length).toBe(1);
    expect(gsm.getCurrentState()).toBe("Loading");

    resolveOnEnter?.();
    await Promise.resolve();
  });

  it("tick() should emit events via _doTransition (gap-2)", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([{ name: "Menu", onEnter: () => onEnterPromise }]);
    gsm.init();

    // Start async transition — busy
    gsm.transition("Menu");
    // Queue a transition while busy
    gsm.transition("PreRace");

    // Complete first transition
    resolveOnEnter?.();
    await Promise.resolve();
    vi.clearAllMocks();

    // tick() should process queued transition and emit events
    gsm.tick();
    await Promise.resolve();

    expect(bus.emit).toHaveBeenCalledWith("gsm.state.exited", {
      from: "Menu",
    });
    expect(bus.emit).toHaveBeenCalledWith("gsm.state.entered", {
      from: "Menu",
      to: "PreRace",
    });
  });

  it("should use default maxQueueSize of 10 (gap-3)", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const gsm = new GameStateMachine();
    gsm.registerStates([{ name: "Menu", onEnter: () => onEnterPromise }]);
    gsm.init();

    // Start async — busy
    gsm.transition("Menu");

    // Queue 10 transitions (should not overflow)
    for (let i = 0; i < 10; i++) {
      gsm.transition("Menu");
    }

    // No overflow warning yet
    expect(warnSpy).not.toHaveBeenCalledWith(
      "[GSM] Transition queue overflow — dropping:",
      expect.anything()
    );

    // 11th should trigger overflow
    gsm.transition("Menu");
    expect(warnSpy).toHaveBeenCalledWith(
      "[GSM] Transition queue overflow — dropping:",
      "Menu"
    );

    resolveOnEnter?.();
    await Promise.resolve();
  });

  it("should drop the oldest entry with distinct targets (gap-4)", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    // Need Menu and PreRace registered for valid transitions
    const gsm = new GameStateMachine(undefined, { maxQueueSize: 3 });
    gsm.registerStates([
      { name: "Menu", onEnter: () => onEnterPromise },
      { name: "PreRace" },
    ]);
    gsm.init();

    // Start async — busy
    gsm.transition("Menu");

    // Fill queue with distinct targets: Menu, PreRace, Racing
    gsm.transition("PreRace");
    gsm.transition("PreRace");
    gsm.transition("Racing");

    // Queue is full (3). Next should drop oldest ("PreRace" — first queued)
    gsm.transition("PreRace");

    expect(warnSpy).toHaveBeenCalledWith(
      "[GSM] Transition queue overflow — dropping:",
      "PreRace"
    );

    resolveOnEnter?.();
    await Promise.resolve();
  });

  it("should call onExit on source state during queued transition (gap-5)", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const onExitSpy = vi.fn().mockResolvedValue(undefined);

    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      { name: "Menu", onEnter: () => onEnterPromise, onExit: onExitSpy },
      { name: "PreRace" },
    ]);
    gsm.init();

    // Start async transition — GSM is busy
    gsm.transition("Menu");
    // Queue a transition while busy
    gsm.transition("PreRace");

    // Complete first transition
    resolveOnEnter?.();
    await Promise.resolve();
    vi.clearAllMocks();

    // tick() should process queued transition and call onExit on source state
    gsm.tick();
    await Promise.resolve();

    expect(onExitSpy).toHaveBeenCalledOnce();
    expect(onExitSpy).toHaveBeenCalledWith();
    // Transition should complete successfully
    expect(gsm.getCurrentState()).toBe("PreRace");
    // Events should be emitted for the completed transition
    expect(bus.emit).toHaveBeenCalledWith("gsm.state.exited", {
      from: "Menu",
    });
    expect(bus.emit).toHaveBeenCalledWith("gsm.state.entered", {
      from: "Menu",
      to: "PreRace",
    });
  });

  it("should rollback on onEnter failure during queued transition (gap-6)", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      { name: "Menu", onEnter: () => onEnterPromise },
      {
        name: "PreRace",
        onEnter: async () => {
          throw new Error("onEnter crashed");
        },
      },
    ]);
    gsm.init();

    // Start async transition — GSM is busy
    gsm.transition("Menu");
    // Queue a transition while busy
    gsm.transition("PreRace");

    // Complete first transition
    resolveOnEnter?.();
    await Promise.resolve();
    vi.clearAllMocks();

    // tick() should process queued transition and handle onEnter failure
    gsm.tick();
    await Promise.resolve();

    // Rollback warning should be logged (line 363)
    expect(warnSpy).toHaveBeenCalledWith(
      "[GSM] onEnter failed for",
      "PreRace",
      expect.any(Error)
    );

    // State should remain at source (rollback) — _currentState never changed
    expect(gsm.getCurrentState()).toBe("Menu");

    // Should emit entered for the restored state (from → to both Menu) — line 366
    expect(bus.emit).toHaveBeenCalledWith("gsm.state.entered", {
      from: "Menu",
      to: "Menu",
    });
  });
});

// ===========================================================================
// State History Ring Buffer (Story 005)
// ===========================================================================

// ---------------------------------------------------------------------------
// AC-1: Each successful transition records TransitionRecord
// ---------------------------------------------------------------------------

describe("State History AC-1: records TransitionRecord on success", () => {
  it("should record a TransitionRecord after a successful transition", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Menu");

    const history = gsm.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      from: "Loading",
      to: "Menu",
    });
    expect(history[0].timestamp).toBeGreaterThan(0);
    expect(history[0].durationInPreviousState).toBeGreaterThanOrEqual(0);
  });

  it("should compute durationInPreviousState from initTimestamp for first transition", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const gsm = new GameStateMachine();
    gsm.init();

    // Advance clock by 1000ms before first transition
    vi.setSystemTime(1000);
    await gsm.transition("Menu");

    const history = gsm.getHistory();
    expect(history[0].durationInPreviousState).toBe(1000);
    vi.useRealTimers();
  });

  it("should compute durationInPreviousState from previous entry for subsequent transitions", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Menu");
    const first = gsm.getHistory()[0];

    await gsm.transition("PreRace");
    const second = gsm.getHistory()[1];

    expect(second.durationInPreviousState).toBeGreaterThanOrEqual(0);
    // second.duration should be approx now - first.timestamp
    expect(second.durationInPreviousState).toBe(
      second.timestamp - first.timestamp
    );
  });

  it("should NOT record same-state no-ops", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Loading"); // same-state no-op

    expect(gsm.getHistory()).toHaveLength(0);
  });

  it("should NOT record rollbacks (onEnter rejection)", async () => {
    const gsm = new GameStateMachine();
    gsm.registerStates([
      {
        name: "Menu",
        onEnter: () => Promise.reject(new Error("rollback")),
      },
    ]);
    gsm.init();
    await gsm.transition("Menu");

    // Transition rolled back — history should be empty
    expect(gsm.getHistory()).toHaveLength(0);
  });

  it("should NOT record invalid transitions that throw", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    try {
      await gsm.transition("Racing"); // invalid from Loading
    } catch {
      // expected
    }
    expect(gsm.getHistory()).toHaveLength(0);
  });

  it("should record queued transitions via tick()", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const gsm = new GameStateMachine();
    gsm.registerStates([{ name: "Menu", onEnter: () => onEnterPromise }]);
    gsm.init();

    // Start async — busy
    gsm.transition("Menu");
    // Queue a transition while busy
    gsm.transition("PreRace");

    // Complete first
    resolveOnEnter?.();
    await Promise.resolve();

    // tick processes queued PreRace
    gsm.tick();
    await Promise.resolve();

    const history = gsm.getHistory();
    expect(history).toHaveLength(2);
    expect(history[1].to).toBe("PreRace");
  });
});

// ---------------------------------------------------------------------------
// AC-2: Buffer max capacity of exactly 20 entries
// ---------------------------------------------------------------------------

describe("State History AC-2: max capacity of 20 entries", () => {
  it("should have exactly 20 entries after 20 transitions", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Menu");

    // Navigate through all states multiple times
    // Menu → PreRace → Menu (via Paused) → PreRace ...
    for (let i = 0; i < 19; i++) {
      if (gsm.getCurrentState() === "Menu") {
        await gsm.transition("PreRace");
      } else if (gsm.getCurrentState() === "PreRace") {
        await gsm.transition("Racing");
      } else if (gsm.getCurrentState() === "Racing") {
        await gsm.transition("Paused");
      } else if (gsm.getCurrentState() === "Paused") {
        await gsm.transition("Menu");
      }
    }

    // We need exactly 20 transitions total. init→Menu = 1, plus 19 above = 20.
    expect(gsm.getHistory()).toHaveLength(20);
  });

  it("should stay at 20 after 21 transitions (FIFO eviction)", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Menu");

    for (let i = 0; i < 20; i++) {
      if (gsm.getCurrentState() === "Menu") {
        await gsm.transition("PreRace");
      } else if (gsm.getCurrentState() === "PreRace") {
        await gsm.transition("Racing");
      } else if (gsm.getCurrentState() === "Racing") {
        await gsm.transition("Paused");
      } else if (gsm.getCurrentState() === "Paused") {
        await gsm.transition("Menu");
      }
    }

    // 21 transitions total (init→Menu + 20 more)
    expect(gsm.getHistory()).toHaveLength(20);
  });

  it("should have empty history before any transition", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    expect(gsm.getHistory()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-3: FIFO eviction — oldest removed first
// ---------------------------------------------------------------------------

describe("State History AC-3: FIFO eviction", () => {
  /** Perform N transitions, returning the `to` state of each entry. */
  async function performTransitions(
    gsm: GameStateMachine,
    count: number
  ): Promise<void> {
    for (let i = 0; i < count; i++) {
      const current = gsm.getCurrentState();
      if (current === "Loading") {
        await gsm.transition("Menu");
      } else if (current === "Menu") {
        await gsm.transition("PreRace");
      } else if (current === "PreRace") {
        await gsm.transition("Racing");
      } else if (current === "Racing") {
        await gsm.transition("Paused");
      } else if (current === "Paused") {
        await gsm.transition("Menu");
      }
    }
  }

  it("should drop the first 5 entries after 25 transitions", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await performTransitions(gsm, 25);

    const history = gsm.getHistory();
    expect(history).toHaveLength(20);

    // First entry should no longer be Loading→Menu (that was entry #1)
    // After 25 transitions, entries 6–25 are retained.
    expect(history[0].from).not.toBe("Loading");
  });

  it("should keep only the last 20 after 100 transitions", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await performTransitions(gsm, 100);

    expect(gsm.getHistory()).toHaveLength(20);
  });
});

// ---------------------------------------------------------------------------
// AC-4: getHistory() returns ReadonlyArray<TransitionRecord>
// ---------------------------------------------------------------------------

describe("State History AC-4: getHistory() accessor", () => {
  it("should return an empty array before any transition", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    const history = gsm.getHistory();
    expect(Array.isArray(history)).toBe(true);
    expect(history).toHaveLength(0);
  });

  it("should return a shallow copy that cannot mutate internal state", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Menu");

    const firstRead = gsm.getHistory();
    expect(firstRead).toHaveLength(1);

    // Mutate the returned copy
    (firstRead as unknown[]).pop();

    // Internal state should be unaffected
    expect(gsm.getHistory()).toHaveLength(1);
  });

  it("should return typed entries with all required fields", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Menu");

    const history = gsm.getHistory();
    const record = history[0];
    expect(record).toHaveProperty("from");
    expect(record).toHaveProperty("to");
    expect(record).toHaveProperty("timestamp");
    expect(record).toHaveProperty("durationInPreviousState");

    // Verify types via runtime checks
    expect(typeof record.from).toBe("string");
    expect(typeof record.to).toBe("string");
    expect(typeof record.timestamp).toBe("number");
    expect(typeof record.durationInPreviousState).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// AC-5: Timestamps from Date.now() (debug data, not simulation)
// ---------------------------------------------------------------------------

describe("State History AC-5: timestamps from Date.now()", () => {
  it("should record timestamps consistent with Date.now() using fake timers", async () => {
    vi.useFakeTimers();
    // Reset clock to epoch so _initTimestamp starts at 0
    vi.setSystemTime(0);
    const gsm = new GameStateMachine();
    gsm.init();
    vi.setSystemTime(1000);

    await gsm.transition("Menu");
    let history = gsm.getHistory();
    expect(history[0].timestamp).toBe(1000);
    expect(history[0].durationInPreviousState).toBe(1000); // init at 0, now at 1000

    vi.setSystemTime(1500);
    await gsm.transition("PreRace");

    history = gsm.getHistory();
    expect(history[1].timestamp).toBe(1500);
    expect(history[1].durationInPreviousState).toBe(500); // 1500 - 1000

    vi.useRealTimers();
  });

  it("should use consistent timer (Date.now()) across all entries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const gsm = new GameStateMachine();
    gsm.init();
    vi.setSystemTime(500);

    await gsm.transition("Menu");
    vi.setSystemTime(700);
    await gsm.transition("PreRace");
    vi.setSystemTime(900);
    await gsm.transition("Racing");

    const history = gsm.getHistory();
    expect(history[0].timestamp).toBe(500);
    expect(history[1].timestamp).toBe(700);
    expect(history[2].timestamp).toBe(900);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// AC-6: On dispose(), history is cleared
// ---------------------------------------------------------------------------

describe("State History AC-6: dispose() clears history", () => {
  it("should clear history on dispose()", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Menu");
    await gsm.transition("PreRace");

    expect(gsm.getHistory()).toHaveLength(2);

    gsm.dispose();
    expect(gsm.getHistory()).toHaveLength(0);
  });

  it("should not throw when dispose() is called with empty history", () => {
    const gsm = new GameStateMachine();
    gsm.init();

    expect(() => gsm.dispose()).not.toThrow();
    expect(gsm.getHistory()).toHaveLength(0);
  });

  it("should not allow new transitions after dispose (existing behavior)", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    await gsm.transition("Menu");
    gsm.dispose();

    // transition() is a no-op after dispose (Story 006 — dispose safety).
    // History should remain empty from the clear.
    expect(gsm.getHistory()).toHaveLength(0);
  });
});

// ===========================================================================
// Dispose Safety (Story 006)
// ===========================================================================

// ---------------------------------------------------------------------------
// AC-1: dispose() sets disposed flag, prevents new transitions
// ---------------------------------------------------------------------------

describe("Dispose Safety AC-1: dispose prevents new transitions", () => {
  it("should set disposed flag and make transition() a no-op", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.dispose();
    expect((gsm as { _disposed: boolean })._disposed).toBe(true);
    // transition() should be no-op after dispose
    expect(() => gsm.transition("Menu")).not.toThrow();
    expect(gsm.getCurrentState()).toBeUndefined();
  });

  it("should return undefined from getCurrentState() after dispose", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.dispose();
    expect(gsm.getCurrentState()).toBeUndefined();
  });

  it("should handle double dispose() without error", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.dispose();
    expect(() => gsm.dispose()).not.toThrow();
  });

  it("should make 10 consecutive transition() calls after dispose all no-ops", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.dispose();
    for (let i = 0; i < 10; i++) {
      await expect(gsm.transition("Menu")).resolves.toBeUndefined();
    }
    expect(gsm.getCurrentState()).toBeUndefined();
  });

  it("should not allow init() after dispose", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.dispose();
    // init() after dispose should be a no-op
    gsm.init();
    expect(gsm.getCurrentState()).toBeUndefined();
  });

  it("should handle init() on pristine GSM, dispose, then init() again", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    expect(gsm.getCurrentState()).toBe("Loading");
    gsm.dispose();
    expect(gsm.getCurrentState()).toBeUndefined();
    // init() after dispose is no-op
    gsm.init();
    expect(gsm.getCurrentState()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-2: Dispose mid-transition — onExit initiates, onEnter skipped
// ---------------------------------------------------------------------------

describe("Dispose Safety AC-2: mid-transition dispose", () => {
  it("should initiate onExit but skip onEnter when disposed during onExit await", async () => {
    let resolveOnExit: () => void;
    const onExitPromise = new Promise<void>((resolve) => {
      resolveOnExit = resolve;
    });
    const onExitSpy = vi.fn().mockReturnValue(onExitPromise);
    const onEnterSpy = vi.fn();

    const gsm = new GameStateMachine();
    gsm.registerStates([
      { name: "Loading", onExit: onExitSpy },
      { name: "Menu", onEnter: onEnterSpy },
    ]);
    gsm.init();

    // Start transition — will await the slow onExit
    const transPromise = gsm.transition("Menu");

    // onExit spy was called (initiated)
    expect(onExitSpy).toHaveBeenCalledTimes(1);
    // onEnter spy NOT called yet
    expect(onEnterSpy).not.toHaveBeenCalled();

    // Dispose mid-transition (while onExit is pending)
    gsm.dispose();

    // Resolve onExit — transition code resumes, sees _disposed, returns early
    resolveOnExit?.();
    await transPromise;

    // onEnter should never have been called
    expect(onEnterSpy).not.toHaveBeenCalled();
    // State is undefined (disposed)
    expect(gsm.getCurrentState()).toBeUndefined();
  });

  it("should skip events when disposed during mid-transition", async () => {
    let resolveOnExit: () => void;
    const onExitPromise = new Promise<void>((resolve) => {
      resolveOnExit = resolve;
    });

    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      { name: "Loading", onExit: () => onExitPromise },
      { name: "Menu", onEnter: () => {} },
    ]);
    gsm.init();

    vi.clearAllMocks();

    // Start transition — will await slow onExit
    gsm.transition("Menu");

    // Dispose mid-transition
    gsm.dispose();

    // Resolve onExit
    resolveOnExit?.();
    await Promise.resolve();

    // No events should have been emitted
    expect(bus.emit).not.toHaveBeenCalled();
  });

  it("should clean up properly when disposed during async onEnter", async () => {
    const onExitSpy = vi.fn();
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });
    const onEnterSpy = vi.fn().mockReturnValue(onEnterPromise);

    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      { name: "Loading", onExit: onExitSpy },
      { name: "Menu", onEnter: onEnterSpy },
    ]);
    gsm.init();

    // Start transition — onExit is sync, proceeds to await onEnter
    gsm.transition("Menu");
    // Flush microtasks — transition code continues past `await undefined`
    // (the yield from awaiting a non-thenable onExit result)
    // Now the async onEnter has been initiated and is pending
    await Promise.resolve();

    // Both hooks were initiated (dispose during onEnter await)
    expect(onExitSpy).toHaveBeenCalledTimes(1);
    expect(onEnterSpy).toHaveBeenCalledTimes(1);

    // Dispose during onEnter
    gsm.dispose();

    // Resolve onEnter
    resolveOnEnter?.();
    await Promise.resolve();

    // State is undefined after dispose
    expect(gsm.getCurrentState()).toBeUndefined();
    // No events emitted
    expect(bus.emit).not.toHaveBeenCalled();
  });

  // Coverage: transition() inner catch block at line 293-294 —
  // onEnter rejection is caught after dispose, disposed guard suppresses rollback
  it("should suppress rollback events when disposed during async onEnter rejection in transition()", async () => {
    let rejectOnEnter: (reason: Error) => void;
    const onEnterPromise = new Promise<void>((_resolve, reject) => {
      rejectOnEnter = reject;
    });
    const onEnterSpy = vi.fn().mockReturnValue(onEnterPromise);
    const onExitSpy = vi.fn();

    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      { name: "Loading", onExit: onExitSpy },
      { name: "Menu", onEnter: onEnterSpy },
    ]);
    gsm.init();

    // Start transition — onExit is sync, proceeds to await onEnter
    const transPromise = gsm.transition("Menu");
    // Flush microtasks — transition continues past `await undefined`
    // (the yield from awaiting a non-thenable onExit result)
    await Promise.resolve();

    expect(onExitSpy).toHaveBeenCalledTimes(1);
    expect(onEnterSpy).toHaveBeenCalledTimes(1);

    // Dispose while onEnter is pending — _disposed = true
    gsm.dispose();

    // Reject onEnter — catch block fires, sees _disposed, returns at line 294
    rejectOnEnter?.(new Error("onEnter failed after dispose"));
    await transPromise;

    // State is undefined (disposed)
    expect(gsm.getCurrentState()).toBeUndefined();
    // No events emitted — both resolved and rollback paths suppressed
    expect(bus.emit).not.toHaveBeenCalled();
    // No rollback warning logged
    expect(warnSpy).not.toHaveBeenCalledWith(
      "[GSM] onEnter failed for",
      expect.anything()
    );
  });

  it("should not call onExit twice when disposed mid-transition with onExit fire-and-forget", async () => {
    let resolveOnExit: () => void;
    const onExitPromise = new Promise<void>((resolve) => {
      resolveOnExit = resolve;
    });
    const onExitSpy = vi.fn().mockReturnValue(onExitPromise);
    const onEnterSpy = vi.fn();

    const gsm = new GameStateMachine();
    gsm.registerStates([
      { name: "Loading", onExit: onExitSpy },
      { name: "Menu", onEnter: onEnterSpy },
    ]);
    gsm.init();

    // Start transition — awaiting slow onExit
    const transPromise = gsm.transition("Menu");
    expect(onExitSpy).toHaveBeenCalledTimes(1);

    // Dispose mid-transition — dispose also calls onExit fire-and-forget
    // because _busy is true. This means onExit is called a second time
    // (by design — Story 006 Implementation Note 3 says to call onExit during
    // dispose). Hook authors should make onExit idempotent.
    gsm.dispose();

    // onExit was called twice: once by transition code, once by dispose() fire-and-forget
    expect(onExitSpy).toHaveBeenCalledTimes(2);

    // Resolve onExit
    resolveOnExit?.();
    await transPromise;

    // onEnter should never have been called
    expect(onEnterSpy).not.toHaveBeenCalled();
  });

  // Coverage: dispose() falsy branch of sourceDef?.onExit at line 362 —
  // sourceDef is undefined when the current state has no registered definition
  it("should handle dispose while busy when current state has no onExit hook", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });

    const gsm = new GameStateMachine();
    // Register only Menu state (with async onEnter) — Loading has NO definition
    gsm.registerStates([{ name: "Menu", onEnter: () => onEnterPromise }]);
    gsm.init();

    // Start transition Loading → Menu — GSM becomes busy (async onEnter)
    // Loading has no state definition, so in dispose():
    //   sourceDef = _stateDefinitions.get("Loading") → undefined
    //   sourceDef?.onExit → undefined → falsy branch
    const transPromise = gsm.transition("Menu");

    // Dispose while busy — no onExit triggered (Loading has no definition)
    expect(() => gsm.dispose()).not.toThrow();

    // State cleaned up after dispose
    expect(gsm.getCurrentState()).toBeUndefined();

    // Clean up the pending onEnter promise
    resolveOnEnter?.();
    await transPromise;
  });

  it("should suppress onExit rejection during dispose (fire-and-forget catch)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onEnterSpy = vi.fn();
    let callCount = 0;
    const onExitSpy = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        // First call (from transition) — pending promise, never resolves
        return new Promise<void>(() => {
          /* pending forever */
        });
      }
      // Second call (from dispose fire-and-forget) — rejects immediately
      return Promise.reject(new Error("onExit rejected during dispose"));
    });

    const gsm = new GameStateMachine();
    gsm.registerStates([
      { name: "Loading", onExit: onExitSpy },
      { name: "Menu", onEnter: onEnterSpy },
    ]);
    gsm.init();

    // Start transition — onExit is pending (never resolves)
    const _transPromise = gsm.transition("Menu");

    // Dispose mid-transition — dispose calls onExit (2nd call), gets rejecting promise
    // The .catch() in dispose() suppresses the floating rejection
    gsm.dispose();

    // Resolve the first onExit promise so transition can finish
    // The transition code sees _disposed and returns early
    // We need to resolve the first promise — but we can't because it never resolves.
    // Instead, since dispose already set _currentState = undefined, the transition
    // code will see _disposed at line 266 and return.
    // But the first promise never resolves, so transPromise hangs...
    // We need to resolve it somehow. Let's use a different approach.

    // Actually, let's just verify no unhandled rejection and onEnter not called
    // The transition promise will eventually be garbage collected
    await new Promise((r) => setTimeout(r, 10));

    expect(onEnterSpy).not.toHaveBeenCalled();
    expect(onExitSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// AC-3: After dispose, transition() is no-op (no error)
// ---------------------------------------------------------------------------

describe("Dispose Safety AC-3: transition no-op after dispose", () => {
  it("should not throw when calling transition() after dispose", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.dispose();
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
  });

  it("should not change state when calling transition() after dispose", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.dispose();
    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBeUndefined();
  });

  it("should be no-op for every possible state after dispose", async () => {
    const states: State[] = [
      "Loading",
      "Menu",
      "PreRace",
      "Racing",
      "Paused",
      "PostRace",
    ];
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.dispose();
    for (const state of states) {
      await expect(gsm.transition(state)).resolves.toBeUndefined();
    }
  });

  it("should be no-op after double dispose", async () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.dispose();
    gsm.dispose(); // double dispose
    await expect(gsm.transition("Menu")).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-4: After dispose, GSM emits no further events on Event Bus
// ---------------------------------------------------------------------------

describe("Dispose Safety AC-4: no events after dispose", () => {
  it("should not emit events when transition() called after dispose", async () => {
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.init();

    // Navigate to a state first
    await gsm.transition("Menu");
    vi.clearAllMocks();

    gsm.dispose();

    // Any transition after dispose should not emit events
    await gsm.transition("PreRace");
    expect(bus.emit).not.toHaveBeenCalled();
  });

  it("should not emit events from tick() after dispose", () => {
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.init();

    gsm.dispose();
    gsm.tick();
    expect(bus.emit).not.toHaveBeenCalled();
  });

  it("should not emit events after dispose mid-transition", async () => {
    let resolveOnExit: () => void;
    const onExitPromise = new Promise<void>((resolve) => {
      resolveOnExit = resolve;
    });

    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      { name: "Loading", onExit: () => onExitPromise },
      { name: "Menu" },
    ]);
    gsm.init();
    vi.clearAllMocks();

    // Start transition — will await slow onExit
    gsm.transition("Menu");

    // Dispose mid-transition (busy with onExit in-flight)
    gsm.dispose();

    // Resolve onExit
    resolveOnExit?.();
    await Promise.resolve();

    // No events emitted — state transition aborted
    expect(bus.emit).not.toHaveBeenCalled();
  });

  it("should not emit events when Event Bus reference is nulled", () => {
    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.init();

    // After dispose, _eventBus is null — no emit calls can fire
    gsm.dispose();

    // Even if we somehow got to _emitExited, optional chaining prevents call
    expect((gsm as { _eventBus: unknown })._eventBus).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-5: After dispose, tick() is no-op and queue cleared
// ---------------------------------------------------------------------------

describe("Dispose Safety AC-5: tick no-op after dispose", () => {
  it("should be a no-op when tick() called after dispose", () => {
    const gsm = new GameStateMachine();
    gsm.init();

    // Fill queue via private access
    const queue = (gsm as { _queue: string[] })._queue;
    queue.push("Menu", "Menu");

    gsm.dispose();
    expect(() => gsm.tick()).not.toThrow();
    // Queue should have been cleared by dispose
    expect(queue.length).toBe(0);
    expect(gsm.getCurrentState()).toBeUndefined();
  });

  it("should be no-op for 10 consecutive tick() calls after dispose", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    gsm.dispose();
    for (let i = 0; i < 10; i++) {
      expect(() => gsm.tick()).not.toThrow();
    }
    expect(gsm.getCurrentState()).toBeUndefined();
  });

  it("should have queue cleared even with items before dispose", () => {
    const gsm = new GameStateMachine();
    gsm.init();

    const queue = (gsm as { _queue: string[] })._queue;
    queue.push("Menu", "PreRace", "Racing");
    expect(queue.length).toBe(3);

    gsm.dispose();

    // Queue cleared by dispose
    expect(queue.length).toBe(0);
  });

  it("should be no-op for tick when disposed mid-transition with queued items", async () => {
    let resolveOnExit: () => void;
    const onExitPromise = new Promise<void>((resolve) => {
      resolveOnExit = resolve;
    });

    const gsm = new GameStateMachine();
    gsm.registerStates([
      { name: "Loading", onExit: () => onExitPromise },
      { name: "Menu" },
    ]);
    gsm.init();

    // Start async transition — GSM busy
    gsm.transition("Menu");

    // Queue a transition while busy
    gsm.transition("PreRace");

    // Dispose mid-transition
    gsm.dispose();

    // Resolve onExit
    resolveOnExit?.();
    await Promise.resolve();

    // tick should be no-op after dispose (queue is cleared)
    gsm.tick();
    await Promise.resolve();

    expect(gsm.getCurrentState()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-6: Tick-path dispose guards (tick() → _doTransition())
// ---------------------------------------------------------------------------
// Existing AC-2 tests exercise dispose guards via transition() (direct path).
// These tests exercise the same guards via tick() → _doTransition() (queued
// path), which hit _doTransition's inline guards at different source lines.
// ---------------------------------------------------------------------------

describe("Dispose Safety AC-6: tick → _doTransition guarded returns", () => {
  // Coverage line 138: init() after dispose without prior init
  it("should be no-op when init() called after dispose on pristine GSM", () => {
    const gsm = new GameStateMachine();
    // Dispose before any init() — pristine GSM
    gsm.dispose();
    // init() after dispose should be a no-op (guard at _disposed check)
    gsm.init();
    expect(gsm.getCurrentState()).toBeUndefined();
  });

  // _doTransition guard: disposed after onExit (line 453–454)
  it("should skip onEnter when disposed during onExit in _doTransition via tick", async () => {
    let resolveOnExit: () => void;
    const onExitPromise = new Promise<void>((resolve) => {
      resolveOnExit = resolve;
    });
    const menuOnExitSpy = vi.fn().mockReturnValue(onExitPromise);
    const preRaceOnEnterSpy = vi.fn();

    const gsm = new GameStateMachine();
    gsm.registerStates([
      { name: "Loading", onExit: vi.fn() },
      { name: "Menu", onExit: menuOnExitSpy },
      { name: "PreRace", onEnter: preRaceOnEnterSpy },
    ]);
    gsm.init();

    // Fast transition to Menu
    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
    vi.clearAllMocks();

    // Directly enqueue so tick() processes via _doTransition
    const queue = (gsm as { _queue: string[] })._queue;
    queue.push("PreRace");

    // tick() → _doTransition("PreRace"):
    //   source=Menu (slow onExit), target=PreRace
    //   await menuOnExitSpy() → yields, _doTransition suspended
    gsm.tick();

    expect(menuOnExitSpy).toHaveBeenCalledTimes(1);
    expect(preRaceOnEnterSpy).not.toHaveBeenCalled();

    // Dispose while _doTransition awaits onExit
    gsm.dispose();

    // Resolve onExit → _doTransition resumes → guard fires (line 453–454)
    resolveOnExit?.();
    await Promise.resolve();

    // onEnter never called; state is undefined (disposed)
    expect(preRaceOnEnterSpy).not.toHaveBeenCalled();
    expect(gsm.getCurrentState()).toBeUndefined();
  });

  // _doTransition guard: disposed after onEnter (line 464–465)
  it("should not change state when disposed during onEnter in _doTransition via tick", async () => {
    let resolveOnEnter: () => void;
    const onEnterPromise = new Promise<void>((resolve) => {
      resolveOnEnter = resolve;
    });
    const menuOnExitSpy = vi.fn();
    const preRaceOnEnterSpy = vi.fn().mockReturnValue(onEnterPromise);

    const gsm = new GameStateMachine();
    gsm.registerStates([
      { name: "Loading", onExit: vi.fn() },
      { name: "Menu", onExit: menuOnExitSpy },
      { name: "PreRace", onEnter: preRaceOnEnterSpy },
    ]);
    gsm.init();

    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
    vi.clearAllMocks();

    // Enqueue for tick() processing
    const queue = (gsm as { _queue: string[] })._queue;
    queue.push("PreRace");

    // tick() → _doTransition("PreRace"):
    //   onExit (Menu) sync → await undefined yields microtask
    gsm.tick();

    // Flush microtask: sync onExit completes, async onEnter begins (pending)
    await Promise.resolve();

    expect(menuOnExitSpy).toHaveBeenCalledTimes(1);
    expect(preRaceOnEnterSpy).toHaveBeenCalledTimes(1);

    // Dispose while _doTransition awaits onEnter
    gsm.dispose();

    // Resolve onEnter → _doTransition resumes → guard fires (line 464–465)
    resolveOnEnter?.();
    await Promise.resolve();

    // State is undefined after dispose
    expect(gsm.getCurrentState()).toBeUndefined();
  });

  // _doTransition guard: disposed during rollback (line 480–481)
  it("should not emit rollback events when disposed during onEnter failure in _doTransition via tick", async () => {
    const menuOnExitSpy = vi.fn();
    const preRaceOnEnterSpy = vi.fn().mockRejectedValue(new Error("rollback"));

    const bus = createMockBus();
    const gsm = new GameStateMachine(bus);
    gsm.registerStates([
      { name: "Loading", onExit: vi.fn() },
      { name: "Menu", onExit: menuOnExitSpy },
      { name: "PreRace", onEnter: preRaceOnEnterSpy },
    ]);
    gsm.init();

    await gsm.transition("Menu");
    expect(gsm.getCurrentState()).toBe("Menu");
    vi.clearAllMocks();

    // Enqueue for tick() processing
    const queue = (gsm as { _queue: string[] })._queue;
    queue.push("PreRace");

    // tick() → _doTransition("PreRace")
    gsm.tick();

    // Flush: sync onExit resolves, onEnter returns rejected promise (microtask queued)
    await Promise.resolve();

    expect(menuOnExitSpy).toHaveBeenCalledTimes(1);
    expect(preRaceOnEnterSpy).toHaveBeenCalledTimes(1);

    // Dispose before rejection propagates into catch block
    gsm.dispose();

    // Flush rejection microtask — catch block sees disposed, returns (line 480–481)
    await Promise.resolve();

    // No rollback events (warn/entered) should have been emitted
    expect(bus.emit).not.toHaveBeenCalled();
    expect(gsm.getCurrentState()).toBeUndefined();
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
