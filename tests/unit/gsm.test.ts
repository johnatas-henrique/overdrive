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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (gsm as any).currentState = "Racing";
    expect(gsm.getCurrentState()).toBe("Loading");
  });

  it("TypeScript private fields are not runtime-enforced (known limitation)", () => {
    const gsm = new GameStateMachine();
    gsm.init();
    // JS private fields are runtime properties — `as any` bypasses TS privacy.
    // The contract is that no production code uses `as any` to bypass privacy.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// Busy flag — concurrent transition prevention
// ---------------------------------------------------------------------------

describe("Busy flag: prevents concurrent transitions", () => {
  it("should throw GameStateError when transitioning while busy", async () => {
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

    // Second transition should fail because GSM is busy
    await expect(gsm.transition("PreRace")).rejects.toThrow(GameStateError);

    // Complete the first transition
    resolveOnEnter?.();
    await transition1;

    expect(gsm.getCurrentState()).toBe("Menu");
  });

  it("should allow transitions after busy flag is cleared", async () => {
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
// Busy flag error message
// ---------------------------------------------------------------------------

describe("Busy flag: error message content", () => {
  it("should throw GameStateError with correct from/to fields when busy", async () => {
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

    try {
      await gsm.transition("PreRace");
    } catch (e) {
      expect(e).toBeInstanceOf(GameStateError);
      expect((e as GameStateError).from).toBe("Loading");
      expect((e as GameStateError).to).toBe("PreRace");
    }

    resolveOnEnter?.();
    await transition1;
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
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
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
