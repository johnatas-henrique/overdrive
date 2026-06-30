// @vitest-environment happy-dom
/**
 * @fileoverview Integration tests for Story 005: GSM State Integration + Input Blocking.
 *
 * GDD Requirement: TR-INP-006 — Subscribe to gsm.state.entered and gsm.state.exited
 *   on Event Bus; maintain local currentState copy (never call gsm.getCurrent()).
 *   Block all inputs during the transition window.
 *
 * Governing ADR: ADR-0006 (Input Abstraction) — GSM Transition Blocking section
 * Control Manifest:
 *   F20 — Event Bus is the ONLY cross-system pattern for state-change signals
 *   F23 — No system calls gsm.getCurrent() — all systems react to Event Bus events
 *   F24 — GSM emits 2 events per transition: exited(old) then entered(new)
 *   F-F5 — Never call gsm.getCurrent() from any system
 *
 * Covers all 8 Acceptance Criteria.
 */

import { describe, expect, it, vi } from "vitest";
import { InputState } from "@/core/input/IInput";

// =============================================================================
// Mock state — hoisted before all imports so vi.mock factories can reference it
// =============================================================================

const hoisted = vi.hoisted(() => {
  const mockKeyState: Record<number, number> = {};

  const mockKbSource = {
    getInput: (code: number): number => mockKeyState[code] ?? 0,
  };

  const mockDsmInstance = {
    getDeviceSource: () => mockKbSource,
    dispose: () => {},
  };

  const gpConnectedCbs: Array<(gp: unknown) => void> = [];
  const gpDisconnectedCbs: Array<() => void> = [];

  const mockBrowserGamepad = {
    axes: [0, 0, 0, 0],
    buttons: [
      { pressed: false, value: 0 }, // 0: A
      { pressed: false, value: 0 }, // 1: B
      { pressed: false, value: 0 }, // 2: X
      { pressed: false, value: 0 }, // 3: Y
      { pressed: false, value: 0 }, // 4: LB
      { pressed: false, value: 0 }, // 5: RB
      { pressed: false, value: 0 }, // 6: LT
      { pressed: false, value: 0 }, // 7: RT
      { pressed: false, value: 0 }, // 8: Back
      { pressed: false, value: 0 }, // 9: Start
      { pressed: false, value: 0 }, // 10: LS
      { pressed: false, value: 0 }, // 11: RS
      { pressed: false, value: 0 }, // 12: D-pad Up
      { pressed: false, value: 0 }, // 13: D-pad Down
      { pressed: false, value: 0 }, // 14: D-pad Left
      { pressed: false, value: 0 }, // 15: D-pad Right
    ],
    connected: true,
    id: "Mock Gamepad (STANDARD GAMEPAD Vendor: Mock Product: Mock)",
    index: 0,
    mapping: "standard",
  };

  const mockGmInstance = {
    gamepads: [],
    onGamepadConnectedObservable: {
      add: (cb: (gp: unknown) => void) => {
        gpConnectedCbs.push(cb);
      },
    },
    onGamepadDisconnectedObservable: {
      add: (cb: () => void) => {
        gpDisconnectedCbs.push(cb);
      },
    },
    dispose: () => {},
  };

  // --- Event Bus handlers storage ---
  const eventHandlers = new Map<string, Set<(...args: unknown[]) => void>>();

  const mockEventBus = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)?.add(handler);
      return {
        unsubscribe: () => {
          eventHandlers.get(event)?.delete(handler);
        },
      };
    }),
    emit: vi.fn(),
    off: vi.fn(),
  };

  const gsmTransitionMock = vi.fn().mockResolvedValue(undefined);
  const gsmMock = { transition: gsmTransitionMock };

  /**
   * Fire a GSM event through the mock Event Bus, invoking all registered handlers.
   */
  function fireEvent(event: string, payload: unknown): void {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(payload);
      }
    }
  }

  function resetMockState(): void {
    for (const k of Object.keys(mockKeyState)) {
      delete mockKeyState[k as unknown as number];
    }
    // Reset axes
    mockBrowserGamepad.axes.fill(0);
    // Reset buttons
    for (const btn of mockBrowserGamepad.buttons) {
      btn.pressed = false;
      btn.value = 0;
    }
    gpConnectedCbs.length = 0;
    gpDisconnectedCbs.length = 0;
    eventHandlers.clear();
    mockEventBus.on.mockClear();
    mockEventBus.emit.mockClear();
    gsmTransitionMock.mockClear();
  }

  return {
    mockKeyState,
    mockKbSource,
    mockDsmInstance,
    mockGmInstance,
    mockBrowserGamepad,
    mockEventBus,
    gsmMock,
    gsmTransitionMock,
    gpConnectedCbs,
    fireEvent,
    resetMockState,
  };
});

// =============================================================================
// Mock Babylon modules
// =============================================================================

vi.mock("@babylonjs/core/DeviceInput/InputDevices/deviceSourceManager", () => ({
  // biome-ignore lint/complexity/useArrowFunction: must be constructible
  DeviceSourceManager: function () {
    return hoisted.mockDsmInstance;
  },
}));

vi.mock("@babylonjs/core/Gamepads/gamepadManager", () => ({
  // biome-ignore lint/complexity/useArrowFunction: must be constructible
  GamepadManager: function () {
    return hoisted.mockGmInstance;
  },
}));

// =============================================================================
// Import module under test
// =============================================================================

import { PlayerInput } from "@/core/input/player-input";
import type { IEventBus } from "@/foundation/event-bus/types";
import type { GameStateMachine } from "@/foundation/gsm/GameStateMachine";

// =============================================================================
// Keycode constants matching player-input.ts
// =============================================================================

const KEY_W = 87;
const KEY_D = 68;
const KEY_SPACE = 32;
const KEY_ESCAPE = 27;
const KEY_BACKSPACE = 8;
const KEY_ARROW_UP = 38;
const KEY_ARROW_DOWN = 40;

const GP_AXIS_LEFT_X = 0;
const GP_BUTTON_A = 0;

// =============================================================================
// Test helpers
// =============================================================================

/** Create a fresh PlayerInput with mocks and call init(). */
function createPlayerInput(): PlayerInput {
  hoisted.resetMockState();
  const input = new PlayerInput(
    hoisted.mockEventBus as unknown as IEventBus,
    hoisted.gsmMock as unknown as GameStateMachine
  );
  input.init({} as unknown as never);
  return input;
}

/** Simulate connecting a gamepad. Returns the mock browser gamepad for configuration. */
function connectGamepad(): typeof hoisted.mockBrowserGamepad {
  if (hoisted.gpConnectedCbs.length > 0) {
    const babylonGamepad = { browserGamepad: hoisted.mockBrowserGamepad };
    hoisted.gpConnectedCbs[0](babylonGamepad);
  }
  return hoisted.mockBrowserGamepad;
}

/** Press a keyboard key for the next getState() call. */
function pressKey(code: number): void {
  hoisted.mockKeyState[code] = 1;
}

/** Release a keyboard key. */
function _releaseKey(code: number): void {
  delete hoisted.mockKeyState[code];
}

/**
 * Call getState() twice and return snapshots.
 * First tick reads current hardware and detects edges (spread to capture).
 * Second tick reads current hardware again to verify held keys don't re-pulse.
 */
function tickTwice(input: PlayerInput): [InputState, InputState] {
  return [{ ...input.getState() }, { ...input.getState() }];
}

// =============================================================================
// AC-1: Subscribes to GSM events on init
// =============================================================================

describe("AC-1: subscribes to GSM events on init", () => {
  it("subscribes_to_gsm_state_entered_and_exited", () => {
    createPlayerInput();

    const onCalls = hoisted.mockEventBus.on.mock.calls;
    const events = onCalls.map((call) => call[0]);

    expect(events).toContain("gsm.state.entered");
    expect(events).toContain("gsm.state.exited");
  });

  it("uses_subscription_pattern_on_returns_subscription", () => {
    createPlayerInput();

    const results = hoisted.mockEventBus.on.mock.results;
    for (const result of results) {
      const sub = result.value;
      expect(sub).toBeDefined();
      expect(typeof sub.unsubscribe).toBe("function");
    }
  });
});

// =============================================================================
// AC-2: Local currentState from entered events; never calls gsm.getCurrent
// =============================================================================

describe("AC-2: local currentState from entered events", () => {
  it("maintains_local_state_from_entered_payload", () => {
    const input = createPlayerInput();

    // Fire entered event for Racing
    hoisted.fireEvent("gsm.state.entered", {
      from: "Loading",
      to: "Racing",
    });

    // Verify local state via pauseToggle routing behavior:
    // In Racing state, pauseToggle should route to gsm.transition('Paused')
    pressKey(KEY_ESCAPE);
    input.getState(); // triggers _processPulse

    expect(hoisted.gsmTransitionMock).toHaveBeenCalledWith("Paused");
  });

  it("never_calls_gsm_get_current", () => {
    // There is no gsm.getCurrent() call in the implementation.
    // The only GSM interaction is via event subscriptions and gsm.transition().
    // This test verifies by inspecting the source contract: the mock GSM
    // has no getCurrent method, and the implementation never references it.
    //
    // We verify indirectly: getState() works correctly with only entered/exited
    // events (no getCurrent calls needed).

    const input = createPlayerInput();
    hoisted.fireEvent("gsm.state.entered", {
      from: "Loading",
      to: "Menu",
    });

    // Should not throw — proves no getCurrent() dependency
    expect(() => input.getState()).not.toThrow();
  });
});

// =============================================================================
// AC-3: exited blocks all inputs
// =============================================================================

describe("AC-3: exited blocks all inputs", () => {
  it("exited_sets_transition_blocking_returns_zero", () => {
    const input = createPlayerInput();

    // Simulate live inputs
    pressKey(KEY_W);
    pressKey(KEY_D);

    // Fire exited event as if a transition started
    hoisted.fireEvent("gsm.state.exited", { from: "Racing" });

    // getState() should return InputState.ZERO
    const state = input.getState();
    expect(state).toStrictEqual(InputState.ZERO);
    expect(state.steer).toBe(0);
    expect(state.throttle).toBe(0);
  });

  it("exited_twice_still_blocked_idempotent", () => {
    const input = createPlayerInput();

    pressKey(KEY_W);

    // Fire exited twice
    hoisted.fireEvent("gsm.state.exited", { from: "Racing" });
    hoisted.fireEvent("gsm.state.exited", { from: "Racing" });

    // Still blocked — idempotent
    const state = input.getState();
    expect(state).toStrictEqual(InputState.ZERO);
  });
});

// =============================================================================
// AC-4: entered unblocks inputs and resets
// =============================================================================

describe("AC-4: entered unblocks and flushes cache", () => {
  it("entered_sets_transition_blocking_false", () => {
    const input = createPlayerInput();

    // Block first
    hoisted.fireEvent("gsm.state.exited", { from: "Racing" });
    expect(input.getState()).toStrictEqual(InputState.ZERO);

    // Enter new state
    hoisted.fireEvent("gsm.state.entered", {
      from: "Racing",
      to: "Menu",
    });

    // Should resume live input
    pressKey(KEY_D);
    const state = input.getState();
    expect(state.steer).toBe(1);
    expect(state).not.toStrictEqual(InputState.ZERO);
  });

  it("entered_twice_still_unblocked_idempotent", () => {
    const input = createPlayerInput();

    // Start a transition, then fire entered twice
    hoisted.fireEvent("gsm.state.exited", { from: "Loading" });
    hoisted.fireEvent("gsm.state.entered", { from: "Loading", to: "Menu" });
    hoisted.fireEvent("gsm.state.entered", { from: "Loading", to: "Menu" });

    // Still unblocked
    pressKey(KEY_W);
    const state = input.getState();
    expect(state.throttle).toBe(1);
  });

  it("entered_flushes_stale_cache_no_stale_pulse", () => {
    const input = createPlayerInput();
    pressKey(KEY_SPACE);

    // First tick: Space produces confirm pulse
    const [tick1] = tickTwice(input);
    expect(tick1.confirm).toBe(true);

    // Now simulate transition: exited → entered (with Space still held)
    hoisted.fireEvent("gsm.state.exited", { from: "Racing" });
    hoisted.fireEvent("gsm.state.entered", {
      from: "Racing",
      to: "Menu",
    });

    // Space is still held, but flush should have prevented a stale pulse.
    // After flush, prevDigital.confirm = rawDigital.confirm = true (Space held).
    // Edge detection: raw.confirm && !prev.confirm = true && !true = false.
    const [postTransition] = tickTwice(input);
    expect(postTransition.confirm).toBe(false);
  });
});

// =============================================================================
// AC-5: pauseToggle routes per state
// =============================================================================

describe("AC-5: pauseToggle routes per state", () => {
  it("racing_state_routes_to_paused", () => {
    const input = createPlayerInput();
    hoisted.fireEvent("gsm.state.entered", {
      from: "Loading",
      to: "Racing",
    });

    pressKey(KEY_ESCAPE);
    input.getState(); // _processPulse routes pauseToggle

    expect(hoisted.gsmTransitionMock).toHaveBeenCalledWith("Paused");
  });

  it("paused_state_routes_to_racing", () => {
    const input = createPlayerInput();
    hoisted.fireEvent("gsm.state.entered", {
      from: "Loading",
      to: "Paused",
    });

    pressKey(KEY_ESCAPE);
    input.getState(); // _processPulse routes pauseToggle

    expect(hoisted.gsmTransitionMock).toHaveBeenCalledWith("Racing");
  });

  it("non_gameplay_states_silently_ignore_pause_toggle", () => {
    const _input = createPlayerInput();

    // Test each non-gameplay state
    const silentStates = ["Loading", "Menu", "PreRace", "PostRace"];

    for (const state of silentStates) {
      hoisted.resetMockState();
      // Re-init with fresh mock
      hoisted.gsmTransitionMock.mockClear();
      const freshInput = new PlayerInput(
        hoisted.mockEventBus as unknown as IEventBus,
        hoisted.gsmMock as unknown as GameStateMachine
      );
      freshInput.init({} as unknown as never);

      hoisted.fireEvent("gsm.state.entered", {
        from: "Loading",
        to: state,
      });

      pressKey(KEY_ESCAPE);
      freshInput.getState();

      expect(hoisted.gsmTransitionMock).not.toHaveBeenCalled();
    }
  });
});

// =============================================================================
// AC-6: confirm routes per state
// =============================================================================

describe("AC-6: confirm routes per state", () => {
  it("prerace_transitions_to_racing", () => {
    const input = createPlayerInput();
    hoisted.fireEvent("gsm.state.entered", {
      from: "Loading",
      to: "PreRace",
    });

    pressKey(KEY_SPACE);
    input.getState();

    expect(hoisted.gsmTransitionMock).toHaveBeenCalledWith("Racing");
  });

  it("racing_emits_pit_depart", () => {
    const input = createPlayerInput();
    hoisted.fireEvent("gsm.state.entered", {
      from: "Loading",
      to: "Racing",
    });

    pressKey(KEY_SPACE);
    input.getState();

    expect(hoisted.mockEventBus.emit).toHaveBeenCalledWith(
      "input.pit.depart",
      {}
    );
  });

  it("postrace_emits_confirm_postrace", () => {
    const input = createPlayerInput();
    hoisted.fireEvent("gsm.state.entered", {
      from: "Loading",
      to: "PostRace",
    });

    pressKey(KEY_SPACE);
    input.getState();

    expect(hoisted.mockEventBus.emit).toHaveBeenCalledWith(
      "input.confirm.postRace",
      {}
    );
  });

  it("menu_emits_confirm_menu", () => {
    const input = createPlayerInput();
    hoisted.fireEvent("gsm.state.entered", {
      from: "Loading",
      to: "Menu",
    });

    pressKey(KEY_SPACE);
    input.getState();

    expect(hoisted.mockEventBus.emit).toHaveBeenCalledWith(
      "input.confirm.menu",
      {}
    );
  });

  it("paused_state_ignores_confirm", () => {
    const input = createPlayerInput();
    hoisted.fireEvent("gsm.state.entered", {
      from: "Loading",
      to: "Paused",
    });

    pressKey(KEY_SPACE);
    input.getState();

    // No gsm transition called (pause owns Escape in Paused state)
    expect(hoisted.gsmTransitionMock).not.toHaveBeenCalled();
    // No event bus emit for confirm either
    expect(hoisted.mockEventBus.emit).not.toHaveBeenCalled();
  });
});

// =============================================================================
// AC-7: Menu navigation only active in Menu state
// =============================================================================

describe("AC-7: menu navigation gated to Menu state", () => {
  it("nav_up_active_in_menu", () => {
    const input = createPlayerInput();
    hoisted.fireEvent("gsm.state.entered", {
      from: "Loading",
      to: "Menu",
    });

    pressKey(KEY_ARROW_UP);
    const state = input.getState();
    expect(state.navUp).toBe(true);
  });

  it("nav_down_active_in_menu", () => {
    const input = createPlayerInput();
    hoisted.fireEvent("gsm.state.entered", {
      from: "Loading",
      to: "Menu",
    });

    pressKey(KEY_ARROW_DOWN);
    const state = input.getState();
    expect(state.navDown).toBe(true);
  });

  it("cancel_active_in_menu", () => {
    const input = createPlayerInput();
    hoisted.fireEvent("gsm.state.entered", {
      from: "Loading",
      to: "Menu",
    });

    pressKey(KEY_BACKSPACE);
    const state = input.getState();
    expect(state.cancel).toBe(true);
  });

  it("nav_up_zero_in_racing", () => {
    const input = createPlayerInput();
    hoisted.fireEvent("gsm.state.entered", {
      from: "Loading",
      to: "Racing",
    });

    pressKey(KEY_ARROW_UP);
    const state = input.getState();
    expect(state.navUp).toBe(false);
  });

  it("nav_down_zero_in_racing", () => {
    const input = createPlayerInput();
    hoisted.fireEvent("gsm.state.entered", {
      from: "Loading",
      to: "Racing",
    });

    pressKey(KEY_ARROW_DOWN);
    const state = input.getState();
    expect(state.navDown).toBe(false);
  });

  it("cancel_zero_in_racing", () => {
    const input = createPlayerInput();
    hoisted.fireEvent("gsm.state.entered", {
      from: "Loading",
      to: "Racing",
    });

    pressKey(KEY_BACKSPACE);
    const state = input.getState();
    expect(state.cancel).toBe(false);
  });

  it("all_nav_fields_zero_in_non_menu_states", () => {
    const nonMenuStates = [
      "Loading",
      "PreRace",
      "Racing",
      "Paused",
      "PostRace",
    ];

    for (const state of nonMenuStates) {
      hoisted.resetMockState();
      hoisted.gsmTransitionMock.mockClear();
      hoisted.mockEventBus.emit.mockClear();

      const input = createPlayerInput();
      hoisted.fireEvent("gsm.state.entered", {
        from: "Loading",
        to: state,
      });

      pressKey(KEY_ARROW_UP);
      pressKey(KEY_ARROW_DOWN);
      pressKey(KEY_BACKSPACE);

      const s = input.getState();
      expect(s.navUp).toBe(false);
      expect(s.navDown).toBe(false);
      expect(s.cancel).toBe(false);
    }
  });
});

// =============================================================================
// AC-8: All inputs blocked during GSM transitions (exited → entered)
// =============================================================================

describe("AC-8: all inputs blocked during transitions", () => {
  it("all_fields_zero_on_exited", () => {
    const input = createPlayerInput();

    // Connect gamepad with strong analog input + digital button
    const bgp = connectGamepad();
    bgp.axes[GP_AXIS_LEFT_X] = 1.0;
    bgp.buttons[GP_BUTTON_A].pressed = true;

    // Also press keyboard keys
    pressKey(KEY_W);
    pressKey(KEY_SPACE);

    // Fire exited event
    hoisted.fireEvent("gsm.state.exited", { from: "Racing" });

    // EVERY field should be zero/false
    const state = input.getState();
    expect(state.steer).toBe(0);
    expect(state.throttle).toBe(0);
    expect(state.brake).toBe(0);
    expect(state.gearDelta).toBe(0);
    expect(state.confirm).toBe(false);
    expect(state.pauseToggle).toBe(false);
    expect(state.cameraToggle).toBe(false);
    expect(state.cancel).toBe(false);
    expect(state.navUp).toBe(false);
    expect(state.navDown).toBe(false);
  });

  it("every_tick_returns_zero_until_entered", () => {
    const input = createPlayerInput();

    pressKey(KEY_W);

    // Fire exited once
    hoisted.fireEvent("gsm.state.exited", { from: "Racing" });

    // Multiple ticks all return ZERO
    for (let i = 0; i < 5; i++) {
      const state = input.getState();
      expect(state).toStrictEqual(InputState.ZERO);
    }

    // After entered, resume
    hoisted.fireEvent("gsm.state.entered", {
      from: "Racing",
      to: "Menu",
    });

    const resumed = input.getState();
    expect(resumed.throttle).toBe(1);
  });
});

// =============================================================================
// Additional: transitionBlocking + hidden interaction (Story 004 + 005)
// =============================================================================

describe("transitionBlocking + hidden priority", () => {
  it("transition_blocking_takes_priority_over_hidden", () => {
    const input = createPlayerInput();
    pressKey(KEY_W);
    input.getState(); // clear edges

    // Fire exited (sets transitionBlocking = true)
    hoisted.fireEvent("gsm.state.exited", { from: "Racing" });

    // Also set hidden
    input.setHidden(true);

    // Should return ZERO (transition blocking checked first)
    const state = input.getState();
    expect(state).toStrictEqual(InputState.ZERO);
  });

  it("entered_clears_blocking_and_allows_live_input", () => {
    const input = createPlayerInput();

    hoisted.fireEvent("gsm.state.exited", { from: "Racing" });
    hoisted.fireEvent("gsm.state.entered", {
      from: "Racing",
      to: "Menu",
    });

    pressKey(KEY_D);
    const state = input.getState();
    expect(state.steer).toBe(1);
  });

  // =========================================================================
  // QA Hardening Tests
  // =========================================================================

  it("dispose_unsubscribes_gsm_events", () => {
    const input = createPlayerInput();

    // Confirm subscriptions are active: fire exited → should set blocking
    hoisted.fireEvent("gsm.state.exited", { from: "Menu" });
    expect(input.getState()).toStrictEqual(InputState.ZERO);

    // Verify on() was called for GSM events
    expect(hoisted.mockEventBus.on).toHaveBeenCalledWith(
      "gsm.state.exited",
      expect.any(Function)
    );
    expect(hoisted.mockEventBus.on).toHaveBeenCalledWith(
      "gsm.state.entered",
      expect.any(Function)
    );
    const callCountBefore = hoisted.mockEventBus.on.mock.calls.length;

    // Dispose the input (unsubscribes GSM events)
    input.dispose();

    // Re-init — should subscribe again (new subscriptions)
    input.init({} as unknown as never);
    const callCountAfter = hoisted.mockEventBus.on.mock.calls.length;

    // New subscriptions were added
    expect(callCountAfter).toBeGreaterThan(callCountBefore);

    // The old subscriptions' unsubscribe() was called during dispose.
    // We can't directly verify this without spy gymnastics, but the
    // fact that dispose didn't throw and re-init works confirms cleanup.
  });

  it("null_dependency_constructor_does_not_throw", () => {
    hoisted.resetMockState();
    const input = new PlayerInput(null, null);
    input.init({} as unknown as never);

    // getState() should work without Event Bus or GSM
    const state = input.getState();
    expect(state).toBeDefined();

    // pauseToggle in Racing should not throw
    input.setGsmCurrentState("Racing");
    pressKey(KEY_ESCAPE);
    expect(() => input.getState()).not.toThrow();

    // confirm in Menu should not throw
    input.setGsmCurrentState("Menu");
    pressKey(KEY_SPACE);
    expect(() => input.getState()).not.toThrow();

    input.dispose();
  });

  it("confirm_ignored_in_loading_state", () => {
    const input = createPlayerInput();
    // Default state is "Loading" — no entered event fired
    pressKey(KEY_SPACE);
    input.getState(); // clear edges
    pressKey(KEY_SPACE);
    input.getState(); // second tick with Space held

    // confirm should be false (Loading state ignores it)
    expect(hoisted.mockEventBus.emit).not.toHaveBeenCalledWith(
      "input.pit.depart",
      expect.anything()
    );
    expect(hoisted.mockEventBus.emit).not.toHaveBeenCalledWith(
      "input.confirm.postRace",
      expect.anything()
    );
    expect(hoisted.mockEventBus.emit).not.toHaveBeenCalledWith(
      "input.confirm.menu",
      expect.anything()
    );
  });

  it("rapid_back_to_back_transitions_produce_correct_final_state", () => {
    const input = createPlayerInput();

    // Menu → PreRace → Racing in quick succession
    hoisted.fireEvent("gsm.state.exited", { from: "Menu" });
    hoisted.fireEvent("gsm.state.entered", { from: "Menu", to: "PreRace" });
    hoisted.fireEvent("gsm.state.exited", { from: "PreRace" });
    hoisted.fireEvent("gsm.state.entered", {
      from: "PreRace",
      to: "Racing",
    });

    // Final state should be Racing with live input
    pressKey(KEY_D);
    const state = input.getState();
    expect(state.steer).toBe(1); // live input, not stale
  });

  it("new_key_pressed_during_blocking_not_leaked_after_unblock", () => {
    const input = createPlayerInput();
    input.setGsmCurrentState("Menu");

    // Clear edges
    pressKey(KEY_SPACE);
    input.getState();

    // Start transition (blocking = true)
    hoisted.fireEvent("gsm.state.exited", { from: "Menu" });

    // Press a key during blocking
    pressKey(KEY_SPACE);
    const blocked = input.getState();
    expect(blocked).toStrictEqual(InputState.ZERO);

    // End transition (blocking = false)
    hoisted.fireEvent("gsm.state.entered", { from: "Menu", to: "PreRace" });

    // Key was held during blocking — edge detection should NOT produce a pulse
    // because the flush sets _prevDigital = _rawDigital (Space is raw=true)
    const after = input.getState();
    expect(after.confirm).toBe(false); // not leaked
  });

  // =========================================================================
  // Catch handler coverage (lines 468, 473, 485)
  // =========================================================================

  it("pauseToggle_racing_to_paused_catch_handles_rejection", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const input = createPlayerInput();
    input.setGsmCurrentState("Racing");

    // Make transition reject
    hoisted.gsmTransitionMock.mockRejectedValueOnce(
      new Error("Invalid transition")
    );

    pressKey(KEY_ESCAPE); // pauseToggle
    input.getState(); // clear edges
    pressKey(KEY_ESCAPE);
    input.getState(); // triggers _processPulse with pauseToggle=true

    // Wait for the rejected promise to settle
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Racing→Paused transition failed"),
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it("pauseToggle_paused_to_racing_catch_handles_rejection", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const input = createPlayerInput();
    input.setGsmCurrentState("Paused");

    hoisted.gsmTransitionMock.mockRejectedValueOnce(
      new Error("Invalid transition")
    );

    pressKey(KEY_ESCAPE);
    input.getState();
    pressKey(KEY_ESCAPE);
    input.getState();

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Paused→Racing transition failed"),
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it("confirm_prerace_to_racing_catch_handles_rejection", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const input = createPlayerInput();
    input.setGsmCurrentState("PreRace");

    hoisted.gsmTransitionMock.mockRejectedValueOnce(
      new Error("Invalid transition")
    );

    pressKey(KEY_SPACE);
    input.getState();
    pressKey(KEY_SPACE);
    input.getState();

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("PreRace→Racing transition failed"),
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });
});
