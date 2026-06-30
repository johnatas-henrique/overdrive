// @vitest-environment happy-dom
/**
 * @fileoverview Integration tests for Story 003: PlayerInput — Keyboard + Gamepad Polling Loop.
 *
 * GDD Requirement: TR-INP-002 — DeviceSourceManager for keyboard, GamepadManager
 *   for gamepad — polled each tick and merged into single InputState.
 * GDD Requirement: TR-INP-004 — Gamepad analog overrides keyboard binary for
 *   steer/throttle/brake when both active; keyboard digital always active.
 *
 * Governing ADR: ADR-0006 (Input Abstraction)
 * Control Manifest: C12 (polling per tick), C14 (tab blur zeros all),
 *   C15 (player-only), C-F6 (no branch), C-F9 (no onBeforeRender), F-G3 (<0.01ms)
 *
 * Covers all 10 acceptance criteria.
 */

import { Observable } from "@babylonjs/core/Misc/observable";
import { describe, expect, it } from "vitest";
import { applyDeadZone } from "@/core/input/dead-zone";
import { type IInput, InputState } from "@/core/input/IInput";

// =============================================================================
// Shared mutable mock state — hoisted before imports so vi.mock factories
// can reference them.
// =============================================================================

const hoisted = vi.hoisted(() => {
  // --- Keyboard mock state ---
  const mockKeyState: Record<number, number> = {};

  // --- Keyboard device source ---
  const mockKbSource = {
    getInput: (code: number): number => mockKeyState[code] ?? 0,
  };

  // --- DSM mock ---
  const mockDsmInstance = {
    getDeviceSource: () => mockKbSource,
    dispose: () => {},
  };

  // --- Gamepad connect/disconnect callback storage ---
  const gpConnectedCbs: Array<(gp: unknown) => void> = [];
  const gpDisconnectedCbs: Array<() => void> = [];

  // --- Browser Gamepad mock ---
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

  /**
   * Reset all mock state to neutral (no keys pressed, axes centered, no gamepad connected).
   */
  function resetMockState(): void {
    // Clear all key states
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
    // Clear callback arrays
    gpConnectedCbs.length = 0;
    gpDisconnectedCbs.length = 0;
  }

  // --- GamepadManager mock ---
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

  return {
    mockKeyState,
    mockKbSource,
    mockDsmInstance,
    mockGmInstance,
    mockBrowserGamepad,
    gpConnectedCbs,
    gpDisconnectedCbs,
    resetMockState,
  };
});

// =============================================================================
// Mock Babylon.js modules — hoisted to execute before all imports.
// =============================================================================

vi.mock("@babylonjs/core/DeviceInput/InputDevices/deviceSourceManager", () => ({
  // biome-ignore lint/complexity/useArrowFunction: must be constructible for `new DeviceSourceManager()`
  DeviceSourceManager: function () {
    return hoisted.mockDsmInstance;
  },
}));

vi.mock("@babylonjs/core/Gamepads/gamepadManager", () => ({
  // biome-ignore lint/complexity/useArrowFunction: must be constructible for `new GamepadManager()`
  GamepadManager: function () {
    return hoisted.mockGmInstance;
  },
}));

// =============================================================================
// Import module under test (after mocks — vi.mock is hoisted, so the order is
// safe even though this appears after the mock definitions in the source file).
// =============================================================================

import { PlayerInput } from "@/core/input/player-input";

// =============================================================================
// Constants matching player-input.ts
// =============================================================================

const DEFAULT_DEAD_ZONE = 0.15;

// Keycodes
const KEY_W = 87;
const KEY_A = 65;
const KEY_S = 83;
const KEY_D = 68;
const KEY_Q = 81;
const KEY_E = 69;
const KEY_SPACE = 32;
const KEY_ESCAPE = 27;
const KEY_C = 67;
const KEY_BACKSPACE = 8;
const KEY_ARROW_UP = 38;
const KEY_ARROW_DOWN = 40;

// Gamepad button indices
const GP_A = 0;
const GP_B = 1;
const GP_Y = 3;
const GP_LB = 4;
const GP_RB = 5;
const GP_LT = 6;
const GP_RT = 7;
const GP_START = 9;
const GP_DPAD_UP = 12;
const GP_DPAD_DOWN = 13;

// =============================================================================
// Test helpers
// =============================================================================

/** Create a fresh PlayerInput instance and call init(). */
function createPlayerInput(): PlayerInput {
  hoisted.resetMockState();
  const input = new PlayerInput();
  input.init({} as unknown as never);
  return input;
}

/** Simulate connecting a gamepad. Returns the mock browser gamepad for configuration. */
function connectGamepad(): typeof hoisted.mockBrowserGamepad {
  if (hoisted.gpConnectedCbs.length > 0) {
    // We need to pass an object that looks like a Babylon Gamepad with browserGamepad
    const babylonGamepad = { browserGamepad: hoisted.mockBrowserGamepad };
    hoisted.gpConnectedCbs[0](babylonGamepad);
  }
  return hoisted.mockBrowserGamepad;
}

/** Simulate disconnecting a gamepad via the observable. */
function disconnectGamepad(): void {
  if (hoisted.gpDisconnectedCbs.length > 0) {
    hoisted.gpDisconnectedCbs[0]();
  }
}

/** Press a keyboard key for the next getState() call. */
function pressKey(code: number): void {
  hoisted.mockKeyState[code] = 1;
}

/** Release a keyboard key. */
function releaseKey(code: number): void {
  delete hoisted.mockKeyState[code];
}

/**
 * Call getState() twice to simulate two ticks.
 * First tick: reads current hardware, detects edges.
 * Second tick: reads current hardware again (press state persists).
 * Returns snapshots [state1, state2] for comparing across ticks.
 *
 * Snapshots are necessary because PlayerInput reuses a single mutable
 * InputState instance (zero-allocation). Without spreading, the second
 * call's _resetOutputState() would overwrite values from the first call
 * since both entries in the tuple would reference the same object.
 */
function tickTwice(input: PlayerInput): [InputState, InputState] {
  return [{ ...input.getState() }, { ...input.getState() }];
}

// =============================================================================
// Tests
// =============================================================================

// ---------------------------------------------------------------------------
// AC-1: PlayerInput class implements IInput
// ---------------------------------------------------------------------------

describe("AC-1: PlayerInput implements IInput", () => {
  it("test_implements_iinput_interface", () => {
    const input: IInput = new PlayerInput();
    expect(input).toBeInstanceOf(PlayerInput);
    expect(typeof input.init).toBe("function");
    expect(typeof input.dispose).toBe("function");
    expect(typeof input.getState).toBe("function");
    expect(input.onDeviceChanged).toBeInstanceOf(Observable);
  });

  it("test_all_iinput_methods_callable_without_error", () => {
    const input: IInput = new PlayerInput();
    // init
    input.init({} as unknown as never);
    // getState
    const state = input.getState();
    expect(state).toBeDefined();
    expect(state.steer).toBe(0);
    // dispose
    expect(() => input.dispose()).not.toThrow();
    // After dispose, getState should not throw
    expect(() => input.getState()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC-2: init(engine) constructs DSM and GamepadManager
// ---------------------------------------------------------------------------

describe("AC-2: init constructs DSM and GamepadManager", () => {
  it("test_init_creates_dsm_and_gamepad_manager", () => {
    // The mocks are verified implicitly by the module mock setup.
    // If DSM or GamepadManager constructors threw, the test would fail.
    const input = createPlayerInput();
    expect(input).toBeDefined();

    // Calling init again re-creates (no lingering references)
    expect(() => input.init({} as unknown as never)).not.toThrow();
  });

  it("test_init_twice_no_lingering_references", () => {
    const input = new PlayerInput();
    input.init({} as unknown as never);
    // First getState should work
    expect(input.getState().steer).toBe(0);

    // Re-init and verify still works
    input.init({} as unknown as never);
    expect(input.getState().steer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-3: keyboard WASD produces correct steer values
// ---------------------------------------------------------------------------

describe("AC-3: keyboard WASD steer", () => {
  it("test_d_key_sets_steer_to_plus_one", () => {
    const input = createPlayerInput();
    pressKey(KEY_D);
    expect(input.getState().steer).toBe(1);
  });

  it("test_a_key_sets_steer_to_minus_one", () => {
    const input = createPlayerInput();
    pressKey(KEY_A);
    expect(input.getState().steer).toBe(-1);
  });

  it("test_no_wasd_keys_steer_is_zero", () => {
    const input = createPlayerInput();
    expect(input.getState().steer).toBe(0);
  });

  it("test_a_and_d_simultaneous_steer_is_zero", () => {
    const input = createPlayerInput();
    pressKey(KEY_A);
    pressKey(KEY_D);
    expect(input.getState().steer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-4: gamepad leftStick.x maps to steer
// ---------------------------------------------------------------------------

describe("AC-4: gamepad leftStick.x → steer", () => {
  it("test_left_stick_x_half_maps_to_steer_after_dead_zone", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.axes[0] = 0.5;
    const expected = applyDeadZone(0.5, DEFAULT_DEAD_ZONE);
    expect(input.getState().steer).toBeCloseTo(expected, 5);
  });

  it("test_left_stick_x_full_right_maps_to_full_steer", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.axes[0] = 1.0;
    const expected = applyDeadZone(1.0, DEFAULT_DEAD_ZONE);
    expect(input.getState().steer).toBeCloseTo(expected, 5);
  });

  it("test_left_stick_x_negative_maps_to_negative_steer", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.axes[0] = -0.8;
    const expected = applyDeadZone(-0.8, DEFAULT_DEAD_ZONE);
    expect(input.getState().steer).toBeCloseTo(expected, 5);
  });
});

// ---------------------------------------------------------------------------
// AC-5: gamepad analog overrides keyboard binary for analog axes
// ---------------------------------------------------------------------------

describe("AC-5: gamepad analog overrides keyboard binary", () => {
  it("test_gamepad_steer_overrides_keyboard_binary", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    // Keyboard D is pressed (steer = +1)
    pressKey(KEY_D);
    // Gamepad left stick is left (steer = -0.8)
    bgp.axes[0] = -0.8;
    const expected = applyDeadZone(-0.8, DEFAULT_DEAD_ZONE);
    const state = input.getState();
    expect(state.steer).toBeCloseTo(expected, 5);
  });

  it("test_keyboard_digital_confirm_still_works_with_gamepad", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    // Set gamepad steer
    bgp.axes[0] = 0.5;
    // Keyboard Space (confirm) should still work
    pressKey(KEY_SPACE);
    const [state1] = tickTwice(input); // First tick: space is edge
    expect(state1.confirm).toBe(true);
  });

  it("test_gamepad_disconnected_keyboard_takes_over_analog", () => {
    const input = createPlayerInput();
    // Connect then disconnect gamepad
    connectGamepad();
    if (hoisted.gpDisconnectedCbs.length > 0) {
      hoisted.gpDisconnectedCbs[0]();
    }
    // Keyboard D pressed
    pressKey(KEY_D);
    expect(input.getState().steer).toBe(1);
  });

  it("test_gamepad_throttle_overrides_keyboard_w_key", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    pressKey(KEY_W); // keyboard throttle = 1
    bgp.buttons[GP_RT].value = 0.3; // gamepad throttle = 0.3
    const expected = applyDeadZone(0.3, DEFAULT_DEAD_ZONE);
    expect(input.getState().throttle).toBeCloseTo(expected, 5);
  });
});

// ---------------------------------------------------------------------------
// AC-6: pulse edge detection fires true exactly once per press
// ---------------------------------------------------------------------------

describe("AC-6: pulse edge detection", () => {
  it("test_confirm_fires_true_once_on_press", () => {
    const input = createPlayerInput();
    pressKey(KEY_SPACE);
    const [state1, state2] = tickTwice(input);
    // First tick: edge detected
    expect(state1.confirm).toBe(true);
    // Second tick: still held, but no edge
    expect(state2.confirm).toBe(false);
  });

  it("test_repeated_press_release_produces_alternating_pattern", () => {
    const input = createPlayerInput();

    // Press, release, press, release — four separate presses
    const results: boolean[] = [];

    // First press
    pressKey(KEY_SPACE);
    results.push(input.getState().confirm);
    releaseKey(KEY_SPACE);
    results.push(input.getState().confirm);

    // Second press
    pressKey(KEY_SPACE);
    results.push(input.getState().confirm);
    releaseKey(KEY_SPACE);
    results.push(input.getState().confirm);

    expect(results).toEqual([true, false, true, false]);
  });

  it("test_pause_toggle_edge_detected", () => {
    const input = createPlayerInput();
    pressKey(KEY_ESCAPE);
    const [state1, state2] = tickTwice(input);
    expect(state1.pauseToggle).toBe(true);
    expect(state2.pauseToggle).toBe(false);
  });

  it("test_camera_toggle_edge_detected", () => {
    const input = createPlayerInput();
    pressKey(KEY_C);
    const [state1, state2] = tickTwice(input);
    expect(state1.cameraToggle).toBe(true);
    expect(state2.cameraToggle).toBe(false);
  });

  it("test_cancel_edge_detected", () => {
    const input = createPlayerInput();
    input.setGsmCurrentState("Menu");
    pressKey(KEY_BACKSPACE);
    const [state1, state2] = tickTwice(input);
    expect(state1.cancel).toBe(true);
    expect(state2.cancel).toBe(false);
  });

  it("test_nav_up_edge_detected", () => {
    const input = createPlayerInput();
    input.setGsmCurrentState("Menu");
    pressKey(KEY_ARROW_UP);
    const [state1, state2] = tickTwice(input);
    expect(state1.navUp).toBe(true);
    expect(state2.navUp).toBe(false);
  });

  it("test_nav_down_edge_detected", () => {
    const input = createPlayerInput();
    input.setGsmCurrentState("Menu");
    pressKey(KEY_ARROW_DOWN);
    const [state1, state2] = tickTwice(input);
    expect(state1.navDown).toBe(true);
    expect(state2.navDown).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-7: steering with dead zone applied
// ---------------------------------------------------------------------------

describe("AC-7: steering dead zone", () => {
  it("test_steer_below_dead_zone_returns_zero", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.axes[0] = 0.1; // below 0.15 default
    expect(input.getState().steer).toBe(0);
  });

  it("test_steer_above_dead_zone_remaps_correctly", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.axes[0] = 0.5;
    expect(input.getState().steer).toBeCloseTo(0.412, 3);
  });

  it("test_steer_negative_below_dead_zone_returns_zero", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.axes[0] = -0.1;
    expect(input.getState().steer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-8: throttle/brake with dead zone applied
// ---------------------------------------------------------------------------

describe("AC-8: throttle/brake dead zone", () => {
  it("test_throttle_below_dead_zone_returns_zero", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[GP_RT].value = 0.1; // below threshold
    expect(input.getState().throttle).toBe(0);
  });

  it("test_throttle_above_dead_zone_remaps_correctly", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[GP_RT].value = 0.5;
    expect(input.getState().throttle).toBeCloseTo(0.412, 3);
  });

  it("test_brake_below_dead_zone_returns_zero", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[GP_LT].value = 0.1;
    expect(input.getState().brake).toBe(0);
  });

  it("test_brake_above_dead_zone_remaps_correctly", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[GP_LT].value = 0.5;
    expect(input.getState().brake).toBeCloseTo(0.412, 3);
  });
});

// ---------------------------------------------------------------------------
// AC-9: keyboard produces binary digital equivalents
// ---------------------------------------------------------------------------

describe("AC-9: keyboard binary digital equivalents", () => {
  it("test_w_key_sets_throttle_brake_off", () => {
    const input = createPlayerInput();
    pressKey(KEY_W);
    const state = input.getState();
    expect(state.throttle).toBe(1);
    expect(state.brake).toBe(0);
  });

  it("test_s_key_sets_brake_throttle_off", () => {
    const input = createPlayerInput();
    pressKey(KEY_S);
    const state = input.getState();
    expect(state.throttle).toBe(0);
    expect(state.brake).toBe(1);
  });

  it("test_no_wasd_keys_throttle_brake_off", () => {
    const input = createPlayerInput();
    const state = input.getState();
    expect(state.throttle).toBe(0);
    expect(state.brake).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-10: gearDelta fires +1/-1 once per press (pulse)
// ---------------------------------------------------------------------------

describe("AC-10: gearDelta pulse from keyboard", () => {
  it("test_q_key_fires_gear_delta_plus_one_once", () => {
    const input = createPlayerInput();
    pressKey(KEY_Q);
    const [state1, state2] = tickTwice(input);
    expect(state1.gearDelta).toBe(1);
    expect(state2.gearDelta).toBe(0);
  });

  it("test_e_key_fires_gear_delta_minus_one_once", () => {
    const input = createPlayerInput();
    pressKey(KEY_E);
    const [state1, state2] = tickTwice(input);
    expect(state1.gearDelta).toBe(-1);
    expect(state2.gearDelta).toBe(0);
  });

  it("test_gear_delta_zero_when_no_gear_key", () => {
    const input = createPlayerInput();
    const state = input.getState();
    expect(state.gearDelta).toBe(0);
  });

  it("test_q_held_gear_delta_fires_only_first_tick", () => {
    const input = createPlayerInput();
    pressKey(KEY_Q);
    // Tick 1
    expect(input.getState().gearDelta).toBe(1);
    // Tick 2..10 (still held)
    for (let i = 0; i < 9; i++) {
      expect(input.getState().gearDelta).toBe(0);
    }
  });

  it("test_qe_simultaneous_gear_delta_is_zero", () => {
    const input = createPlayerInput();
    pressKey(KEY_Q);
    pressKey(KEY_E);
    const [state1] = tickTwice(input);
    expect(state1.gearDelta).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Additional: Tab blur / hidden flag zeros all outputs
// ---------------------------------------------------------------------------

describe("Tab blur (hidden flag)", () => {
  it("test_hidden_flag_zeros_all_outputs", () => {
    const input = createPlayerInput();
    pressKey(KEY_W);
    pressKey(KEY_D);
    // Before hidden: normal values
    const before = input.getState();
    expect(before.throttle).toBe(1);
    expect(before.steer).toBe(1);
    // After hidden: all zeros
    input.setHidden(true);
    const after = input.getState();
    expect(after.steer).toBe(0);
    expect(after.throttle).toBe(0);
    expect(after.brake).toBe(0);
    expect(after.gearDelta).toBe(0);
    expect(after.confirm).toBe(false);
    expect(after.pauseToggle).toBe(false);
    expect(after.cameraToggle).toBe(false);
    expect(after.cancel).toBe(false);
    expect(after.navUp).toBe(false);
    expect(after.navDown).toBe(false);
  });

  it("test_hidden_flag_restored_on_focus_return", () => {
    const input = createPlayerInput();
    input.setHidden(true);
    input.getState(); // zeros
    input.setHidden(false);
    pressKey(KEY_W);
    const state = input.getState();
    expect(state.throttle).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Additional: dispose and reinit
// ---------------------------------------------------------------------------

describe("dispose", () => {
  it("test_dispose_cleans_up_and_allows_reinit", () => {
    const input = createPlayerInput();
    pressKey(KEY_SPACE);
    expect(input.getState().confirm).toBe(true);
    input.dispose();
    // After dispose, getState should still work (safe no-op)
    expect(() => input.getState()).not.toThrow();
    // Re-init and use again
    input.init({} as unknown as never);
    pressKey(KEY_W);
    expect(input.getState().throttle).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Additional: Gamepad digital buttons produce correct output
// ---------------------------------------------------------------------------

describe("Gamepad digital buttons", () => {
  it("test_gamepad_a_button_produces_confirm_pulse", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[GP_A].pressed = true;
    const [state1, state2] = tickTwice(input);
    expect(state1.confirm).toBe(true);
    expect(state2.confirm).toBe(false);
  });

  it("test_gamepad_start_produces_pause_toggle_pulse", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[GP_START].pressed = true;
    const [state1, state2] = tickTwice(input);
    expect(state1.pauseToggle).toBe(true);
    expect(state2.pauseToggle).toBe(false);
  });

  it("test_gamepad_b_produces_cancel_pulse", () => {
    const input = createPlayerInput();
    input.setGsmCurrentState("Menu");
    const bgp = connectGamepad();
    bgp.buttons[GP_B].pressed = true;
    const [state1, state2] = tickTwice(input);
    expect(state1.cancel).toBe(true);
    expect(state2.cancel).toBe(false);
  });

  it("test_gamepad_rb_produces_gear_up_pulse", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[GP_RB].pressed = true;
    const [state1, state2] = tickTwice(input);
    expect(state1.gearDelta).toBe(1);
    expect(state2.gearDelta).toBe(0);
  });

  it("test_gamepad_lb_produces_gear_down_pulse", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[GP_LB].pressed = true;
    const [state1, state2] = tickTwice(input);
    expect(state1.gearDelta).toBe(-1);
    expect(state2.gearDelta).toBe(0);
  });

  it("test_gamepad_y_produces_camera_toggle_pulse", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[GP_Y].pressed = true;
    const [state1, state2] = tickTwice(input);
    expect(state1.cameraToggle).toBe(true);
    expect(state2.cameraToggle).toBe(false);
  });

  it("test_gamepad_dpad_up_produces_nav_up_pulse", () => {
    const input = createPlayerInput();
    input.setGsmCurrentState("Menu");
    const bgp = connectGamepad();
    bgp.buttons[GP_DPAD_UP].pressed = true;
    const [state1, state2] = tickTwice(input);
    expect(state1.navUp).toBe(true);
    expect(state2.navUp).toBe(false);
  });

  it("test_gamepad_dpad_down_produces_nav_down_pulse", () => {
    const input = createPlayerInput();
    input.setGsmCurrentState("Menu");
    const bgp = connectGamepad();
    bgp.buttons[GP_DPAD_DOWN].pressed = true;
    const [state1, state2] = tickTwice(input);
    expect(state1.navDown).toBe(true);
    expect(state2.navDown).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Additional: transitionBlocking zeros all outputs (GSM state integration)
// ---------------------------------------------------------------------------

describe("transitionBlocking", () => {
  it("test_transition_blocking_zeros_all_outputs", () => {
    const input = createPlayerInput();
    pressKey(KEY_W);
    pressKey(KEY_D);
    // Before blocking: normal values
    const before = input.getState();
    expect(before.throttle).toBe(1);
    expect(before.steer).toBe(1);
    // After blocking: InputState.ZERO
    input.setTransitionBlocking(true);
    const after = input.getState();
    expect(after.steer).toBe(0);
    expect(after.throttle).toBe(0);
    expect(after.brake).toBe(0);
    expect(after.gearDelta).toBe(0);
    expect(after.confirm).toBe(false);
  });

  it("test_transition_blocking_resume_normal_polling", () => {
    const input = createPlayerInput();
    input.setTransitionBlocking(true);
    const blocked = input.getState();
    expect(blocked.steer).toBe(0);
    // Resume
    input.setTransitionBlocking(false);
    pressKey(KEY_W);
    const resumed = input.getState();
    expect(resumed.throttle).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Additional: onDeviceChanged observable fires on gamepad connect
// ---------------------------------------------------------------------------

describe("onDeviceChanged observable", () => {
  it("test_gamepad_connect_fires_device_changed", () => {
    const input = createPlayerInput();
    const notifications: string[] = [];
    input.onDeviceChanged.add((device) => {
      notifications.push(device);
    });
    connectGamepad();
    expect(notifications).toEqual(["gamepad"]);
  });

  it("test_dispose_clears_observable_subscriptions", () => {
    const input = createPlayerInput();
    let callCount = 0;
    input.onDeviceChanged.add(() => {
      callCount++;
    });
    input.dispose();
    connectGamepad();
    // Observable was cleared in dispose, so notification should not fire
    expect(callCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Additional: setDeadZoneThreshold override
// ---------------------------------------------------------------------------

describe("setDeadZoneThreshold", () => {
  it("test_dead_zone_threshold_override_affects_steer", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    // Override threshold to 0.5
    input.setDeadZoneThreshold(0.5);
    bgp.axes[0] = 0.6; // above 0.5, below 0.15 default
    const expected = applyDeadZone(0.6, 0.5);
    expect(input.getState().steer).toBeCloseTo(expected, 5);
  });

  it("test_dead_zone_threshold_override_below_threshold_returns_zero", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    input.setDeadZoneThreshold(0.5);
    bgp.axes[0] = 0.3; // below 0.5 threshold
    expect(input.getState().steer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Additional: gamepad idle with keyboard analog
// ---------------------------------------------------------------------------

describe("gamepad idle with keyboard analog", () => {
  it("test_gamepad_present_but_idle_keyboard_still_works", () => {
    const input = createPlayerInput();
    connectGamepad(); // gamepad connected, all axes at 0
    pressKey(KEY_W);
    expect(input.getState().throttle).toBe(1);
  });

  it("test_gamepad_present_but_idle_keyboard_steer_works", () => {
    const input = createPlayerInput();
    connectGamepad(); // gamepad connected, all axes at 0
    pressKey(KEY_D);
    expect(input.getState().steer).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Additional: brake analog override from gamepad
// ---------------------------------------------------------------------------

describe("brake analog override", () => {
  it("test_gamepad_brake_overrides_keyboard_s_key", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    pressKey(KEY_S); // keyboard brake = 1
    bgp.buttons[GP_LT].value = 0.7; // gamepad brake = 0.7
    const expected = applyDeadZone(0.7, DEFAULT_DEAD_ZONE);
    expect(input.getState().brake).toBeCloseTo(expected, 5);
  });
});

// ---------------------------------------------------------------------------
// Additional: getLastActiveDevice
// ---------------------------------------------------------------------------

describe("getLastActiveDevice", () => {
  it("test_default_device_is_keyboard", () => {
    const input = createPlayerInput();
    expect(input.getLastActiveDevice()).toBe("keyboard");
  });

  it("test_keyboard_activity_sets_last_active_to_keyboard", () => {
    const input = createPlayerInput();
    connectGamepad(); // switch to gamepad first
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");
    // Now press keyboard key
    pressKey(KEY_W);
    input.getState();
    expect(input.getLastActiveDevice()).toBe("keyboard");
  });

  it("test_gamepad_activity_sets_last_active_to_gamepad", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.axes[0] = 0.5;
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });
});

// ---------------------------------------------------------------------------
// Additional: init() dispose-first guard
// ---------------------------------------------------------------------------

describe("init dispose-first guard", () => {
  it("test_init_when_already_initialized_disposes_first", () => {
    const input = createPlayerInput();
    pressKey(KEY_W);
    expect(input.getState().throttle).toBe(1);
    // Re-init should dispose and recreate
    input.init({} as unknown as never);
    // After re-init, keyboard should still work (fresh DSM)
    pressKey(KEY_D);
    expect(input.getState().steer).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Additional: edge cases in _readGamepad null guards
// ---------------------------------------------------------------------------

describe("gamepad null guard edge cases", () => {
  it("test_gamepad_no_browser_gamepad_property", () => {
    const input = createPlayerInput();
    // Connect a gamepad that lacks browserGamepad property
    const badGamepad = {
      /* no browserGamepad */
    };
    if (hoisted.gpConnectedCbs.length > 0) {
      hoisted.gpConnectedCbs[0](badGamepad);
    }
    pressKey(KEY_D);
    // Should fall through to keyboard
    expect(input.getState().steer).toBe(1);
  });

  it("test_gamepad_no_axes_or_buttons", () => {
    const input = createPlayerInput();
    const noAxesGamepad = { browserGamepad: { axes: null, buttons: null } };
    if (hoisted.gpConnectedCbs.length > 0) {
      hoisted.gpConnectedCbs[0](noAxesGamepad);
    }
    pressKey(KEY_D);
    // Should fall through to keyboard
    expect(input.getState().steer).toBe(1);
  });

  it("test_gamepad_axes_undefined_fallback", () => {
    const input = createPlayerInput();
    // Gamepad with axes array missing the left stick index
    const sparseAxesGamepad = {
      browserGamepad: {
        axes: [undefined],
        buttons: Array(16).fill({ pressed: false, value: 0 }),
      },
    };
    if (hoisted.gpConnectedCbs.length > 0) {
      hoisted.gpConnectedCbs[0](sparseAxesGamepad);
    }
    // steerRaw should fall back to 0 via ?? 0
    const state = input.getState();
    expect(state.steer).toBe(0);
  });

  it("test_gamepad_trigger_buttons_undefined_fallback", () => {
    const input = createPlayerInput();
    // Gamepad with trigger buttons missing
    const noTriggersGamepad = {
      browserGamepad: {
        axes: [0, 0, 0, 0],
        buttons: [
          { pressed: false, value: 0 }, // 0: A
          { pressed: false, value: 0 }, // 1: B
          { pressed: false, value: 0 }, // 2: X
          { pressed: false, value: 0 }, // 3: Y
          { pressed: false, value: 0 }, // 4: LB
          { pressed: false, value: 0 }, // 5: RB
          undefined, // 6: LT — missing
          undefined, // 7: RT — missing
        ],
      },
    };
    if (hoisted.gpConnectedCbs.length > 0) {
      hoisted.gpConnectedCbs[0](noTriggersGamepad);
    }
    pressKey(KEY_W);
    // Trigger fallbacks should use ?? 0, keyboard throttle should still work
    expect(input.getState().throttle).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Additional: DSM keyboard source null guard
// ---------------------------------------------------------------------------

describe("DSM keyboard source null guard", () => {
  it("test_dsm_no_keyboard_source_returns_zero", () => {
    const input = createPlayerInput();
    // Override getDeviceSource to return null for keyboard
    const originalGetDeviceSource = hoisted.mockDsmInstance.getDeviceSource;
    hoisted.mockDsmInstance.getDeviceSource = () => null;
    try {
      const state = input.getState();
      // Keyboard values should all be zero (no keyboard source)
      expect(state.steer).toBe(0);
      expect(state.throttle).toBe(0);
      expect(state.brake).toBe(0);
    } finally {
      // Restore mock
      hoisted.mockDsmInstance.getDeviceSource = originalGetDeviceSource;
    }
  });
});

// ---------------------------------------------------------------------------
// Additional: transitionBlocking + hidden interaction (both flags)
// ---------------------------------------------------------------------------

describe("transitionBlocking + hidden interaction", () => {
  it("test_transition_blocking_takes_priority_over_hidden", () => {
    const input = createPlayerInput();
    pressKey(KEY_W);
    input.getState(); // clear edges

    // Set both flags
    input.setTransitionBlocking(true);
    input.setHidden(true);

    // Should return ZERO (transition blocking checked first)
    const state = input.getState();
    expect(state).toStrictEqual(InputState.ZERO);
  });

  it("test_hidden_checked_second_when_not_blocking", () => {
    const input = createPlayerInput();
    pressKey(KEY_W);
    input.getState(); // clear edges

    // Only hidden set (transition blocking off)
    input.setHidden(true);
    const state = input.getState();
    expect(state).toStrictEqual(InputState.ZERO);
  });

  it("test_resume_from_both_flags_resumes_polling", () => {
    const input = createPlayerInput();
    input.setTransitionBlocking(true);
    input.setHidden(true);
    input.getState(); // zeros

    // Resume both
    input.setTransitionBlocking(false);
    input.setHidden(false);
    pressKey(KEY_W);
    const state = input.getState();
    expect(state.throttle).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Additional: dispose clears gamepad observer subscriptions
// ---------------------------------------------------------------------------

describe("dispose clears gamepad observers", () => {
  it("test_dispose_stops_gamepad_connect_notifications", () => {
    const input = createPlayerInput();
    let deviceChangedCount = 0;
    input.onDeviceChanged.add(() => {
      deviceChangedCount++;
    });

    // Connect — should fire
    connectGamepad();
    expect(deviceChangedCount).toBe(1);

    // Dispose
    input.dispose();

    // Reconnect — should NOT fire because observers were cleared
    connectGamepad();
    expect(deviceChangedCount).toBe(1); // no new notification
  });

  it("test_dispose_stops_gamepad_disconnect_observable", () => {
    const input = createPlayerInput();
    connectGamepad();

    // Dispose
    input.dispose();

    // Disconnect after dispose — should not throw
    expect(() => disconnectGamepad()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Additional: re-init creates fresh gamepad observers
// ---------------------------------------------------------------------------

describe("re-init creates fresh gamepad observers", () => {
  it("test_reinit_allows_gamepad_connect_to_work", () => {
    const input = createPlayerInput();
    connectGamepad();

    // Re-init
    input.init({} as unknown as never);

    // New gamepad connect should work
    const bgp = connectGamepad();
    bgp.axes[0] = 0.8;
    const state = input.getState();
    expect(state.steer).not.toBe(0);
  });

  it("test_reinit_resets_last_active_device", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.axes[0] = 0.5;
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");

    // Re-init resets to keyboard
    input.init({} as unknown as never);
    expect(input.getLastActiveDevice()).toBe("keyboard");
  });
});

// ---------------------------------------------------------------------------
// Additional: getLastActiveDevice transitions (full coverage)
// ---------------------------------------------------------------------------

describe("getLastActiveDevice transitions", () => {
  it("test_keyboard_to_gamepad_to_keyboard_full_cycle", () => {
    const input = createPlayerInput();
    expect(input.getLastActiveDevice()).toBe("keyboard");

    // Switch to gamepad via analog input
    const bgp = connectGamepad();
    bgp.axes[0] = 0.5;
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");

    // Clear gamepad activity so keyboard can win
    bgp.axes[0] = 0;
    pressKey(KEY_W);
    input.getState();
    expect(input.getLastActiveDevice()).toBe("keyboard");

    // Switch to gamepad via digital input
    bgp.buttons[0].pressed = true; // A button
    input.getState(); // clear edge
    input.getState(); // detect gamepad activity
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });

  it("test_gamepad_digital_only_switches_device", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[9].pressed = true; // Start button
    input.getState(); // clear edge
    input.getState(); // detect
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });

  it("test_keyboard_switches_back_from_gamepad_digital", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[0].pressed = true; // A button
    input.getState();
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");

    // Clear gamepad activity so keyboard can win
    bgp.buttons[0].pressed = false;
    pressKey(KEY_A);
    input.getState();
    expect(input.getLastActiveDevice()).toBe("keyboard");
  });
});

// ---------------------------------------------------------------------------
// Additional: _readGamepad device activity tracking branches
// ---------------------------------------------------------------------------

describe("_readGamepad device activity tracking", () => {
  it("test_gamepad_analog_input_switches_device", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();

    // Only analog input (stick > 0.1)
    bgp.axes[0] = 0.5;
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });

  it("test_gamepad_throttle_above_threshold_switches_device", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();

    // Only throttle > 0.1
    bgp.buttons[7].value = 0.2;
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });

  it("test_gamepad_brake_above_threshold_switches_device", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();

    // Only brake > 0.1
    bgp.buttons[6].value = 0.2;
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });

  it("test_gamepad_digital_input_switches_device", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();

    // Only D-pad up
    bgp.buttons[12].pressed = true;
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });

  it("test_gamepad_connect_sets_device_to_gamepad", () => {
    const input = createPlayerInput();
    // connectGamepad fires onGamepadConnectedObservable which sets _lastActiveDevice = "gamepad"
    connectGamepad();
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });

  it("test_keyboard_overwrites_when_gamepad_idle", () => {
    const input = createPlayerInput();
    connectGamepad(); // sets device to gamepad

    // Gamepad is idle (all axes at 0, no buttons pressed)
    // Keyboard activity should win because _readGamepad doesn't overwrite
    pressKey(KEY_D);
    input.getState();
    expect(input.getLastActiveDevice()).toBe("keyboard");
  });
});

// ---------------------------------------------------------------------------
// Additional: gamepad digital + keyboard digital OR
// ---------------------------------------------------------------------------

describe("gamepad digital + keyboard digital OR", () => {
  it("test_space_plus_gamepad_a_both_trigger_confirm", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();

    // Both pressed simultaneously
    pressKey(KEY_SPACE);
    bgp.buttons[0].pressed = true; // A button

    // Confirm should fire (OR logic)
    const state1 = input.getState();
    expect(state1.confirm).toBe(true);

    // Second tick: both still held, no edge
    const state2 = input.getState();
    expect(state2.confirm).toBe(false);
  });

  it("test_keyboard_only_confirm_pulse", () => {
    const input = createPlayerInput();
    connectGamepad(); // gamepad connected but no buttons pressed

    pressKey(KEY_SPACE);
    const [state1] = tickTwice(input);
    expect(state1.confirm).toBe(true);
  });

  it("test_gamepad_only_confirm_pulse", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[0].pressed = true; // A button

    const [state1] = tickTwice(input);
    expect(state1.confirm).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Additional: W+S simultaneous (both throttle and brake)
// ---------------------------------------------------------------------------

describe("W+S simultaneous", () => {
  it("test_w_and_s_both_pressed_throttle_and_brake_are_one", () => {
    const input = createPlayerInput();
    pressKey(KEY_W);
    pressKey(KEY_S);
    const state = input.getState();
    // Both are binary 1 — no cancellation
    expect(state.throttle).toBe(1);
    expect(state.brake).toBe(1);
  });

  it("test_w_only_throttle_one_brake_zero", () => {
    const input = createPlayerInput();
    pressKey(KEY_W);
    const state = input.getState();
    expect(state.throttle).toBe(1);
    expect(state.brake).toBe(0);
  });

  it("test_s_only_brake_one_throttle_zero", () => {
    const input = createPlayerInput();
    pressKey(KEY_S);
    const state = input.getState();
    expect(state.throttle).toBe(0);
    expect(state.brake).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Additional: gamepad trigger zero value does not override keyboard
// ---------------------------------------------------------------------------

describe("gamepad trigger zero value", () => {
  it("test_gamepad_throttle_zero_does_not_override_keyboard_w", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    pressKey(KEY_W); // keyboard throttle = 1
    bgp.buttons[GP_RT].value = 0; // gamepad throttle = 0
    // Gamepad only overrides when value > 0
    expect(input.getState().throttle).toBe(1);
  });

  it("test_gamepad_brake_zero_does_not_override_keyboard_s", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    pressKey(KEY_S); // keyboard brake = 1
    bgp.buttons[GP_LT].value = 0; // gamepad brake = 0
    // Gamepad only overrides when value > 0
    expect(input.getState().brake).toBe(1);
  });

  it("test_gamepad_steer_zero_does_not_override_keyboard_d", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    pressKey(KEY_D); // keyboard steer = 1
    bgp.axes[0] = 0; // gamepad steer = 0
    // Gamepad only overrides when steerRaw !== 0
    expect(input.getState().steer).toBe(1);
  });

  it("test_gamepad_steer_zero_does_not_override_keyboard_a", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    pressKey(KEY_A); // keyboard steer = -1
    bgp.axes[0] = 0; // gamepad steer = 0
    // Gamepad only overrides when steerRaw !== 0
    expect(input.getState().steer).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// Additional: branch coverage for ?? and || operators
// ---------------------------------------------------------------------------

describe("branch coverage: ?? and || fallbacks", () => {
  it("test_axes_truthy_buttons_falsy_returns_early", () => {
    // Line 454: if (!axes || !buttons) return;
    // Tests the !buttons branch specifically (axes exists, buttons doesn't)
    const input = createPlayerInput();
    const noButtonsGamepad = {
      browserGamepad: {
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: null,
      },
    };
    if (hoisted.gpConnectedCbs.length > 0) {
      hoisted.gpConnectedCbs[0](noButtonsGamepad);
    }
    pressKey(KEY_D);
    // Falls through to keyboard because gamepad read returns early
    expect(input.getState().steer).toBe(1);
  });

  it("test_axes_falsy_buttons_truthy_returns_early", () => {
    // Line 454: if (!axes || !buttons) return;
    // Tests the !axes branch specifically (buttons exists, axes doesn't)
    const input = createPlayerInput();
    const noAxesGamepad = {
      browserGamepad: {
        connected: true,
        axes: null,
        buttons: Array(16).fill({ pressed: false, value: 0 }),
      },
    };
    if (hoisted.gpConnectedCbs.length > 0) {
      hoisted.gpConnectedCbs[0](noAxesGamepad);
    }
    pressKey(KEY_D);
    expect(input.getState().steer).toBe(1);
  });

  it("test_axes_index_undefined_fallback_to_zero", () => {
    // Line 458: axes[GP_AXIS_LEFT_STICK_X] ?? 0
    // Tests the ?? fallback when axes[0] is undefined
    const input = createPlayerInput();
    const sparseAxesGamepad = {
      browserGamepad: {
        connected: true,
        axes: [], // empty array — axes[0] is undefined
        buttons: Array(16).fill({ pressed: false, value: 0 }),
      },
    };
    if (hoisted.gpConnectedCbs.length > 0) {
      hoisted.gpConnectedCbs[0](sparseAxesGamepad);
    }
    // steerRaw should be 0 via ?? fallback, keyboard D takes over
    pressKey(KEY_D);
    expect(input.getState().steer).toBe(1);
  });

  it("test_throttle_trigger_button_undefined_fallback", () => {
    // Line 464: buttons[GP_BUTTON_R_TRIGGER]?.value ?? 0
    // Tests the ?? fallback when buttons[7] is undefined
    const input = createPlayerInput();
    const noRTGamepad = {
      browserGamepad: {
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: (() => {
          const arr = Array(16)
            .fill(null)
            .map(() => ({
              pressed: false,
              value: 0,
            }));
          arr[7] = undefined; // RT missing
          return arr;
        })(),
      },
    };
    if (hoisted.gpConnectedCbs.length > 0) {
      hoisted.gpConnectedCbs[0](noRTGamepad);
    }
    pressKey(KEY_W);
    // throttleRaw = 0 via ?? fallback, keyboard W throttle = 1 preserved
    expect(input.getState().throttle).toBe(1);
  });

  it("test_brake_trigger_button_undefined_fallback", () => {
    // Line 469: buttons[GP_BUTTON_L_TRIGGER]?.value ?? 0
    // Tests the ?? fallback when buttons[6] is undefined
    const input = createPlayerInput();
    const noLTGamepad = {
      browserGamepad: {
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: (() => {
          const arr = Array(16)
            .fill(null)
            .map(() => ({
              pressed: false,
              value: 0,
            }));
          arr[6] = undefined; // LT missing
          return arr;
        })(),
      },
    };
    if (hoisted.gpConnectedCbs.length > 0) {
      hoisted.gpConnectedCbs[0](noLTGamepad);
    }
    pressKey(KEY_S);
    // brakeRaw = 0 via ?? fallback, keyboard S brake = 1 preserved
    expect(input.getState().brake).toBe(1);
  });

  it("test_digital_button_index_undefined_fallback", () => {
    // Line 476: buttons[idx]?.pressed ?? false
    // Tests the ?? fallback when buttons[0] (A) is undefined
    const input = createPlayerInput();
    const noABtnGamepad = {
      browserGamepad: {
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: (() => {
          const arr = Array(16)
            .fill(null)
            .map(() => ({
              pressed: false,
              value: 0,
            }));
          arr[0] = undefined; // A button missing
          return arr;
        })(),
      },
    };
    if (hoisted.gpConnectedCbs.length > 0) {
      hoisted.gpConnectedCbs[0](noABtnGamepad);
    }
    // isPressed(0) returns false via ?? fallback — no gamepad confirm pulse
    const [state1] = tickTwice(input);
    expect(state1.confirm).toBe(false);
  });

  it("test_keyboard_digital_fallback_when_gamepad_button_undefined", () => {
    // Line 476: buttons[idx]?.pressed ?? false
    // Tests that keyboard confirm still works when gamepad A button is undefined
    const input = createPlayerInput();
    const noABtnGamepad = {
      browserGamepad: {
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: (() => {
          const arr = Array(16)
            .fill(null)
            .map(() => ({
              pressed: false,
              value: 0,
            }));
          arr[0] = undefined; // A button missing
          return arr;
        })(),
      },
    };
    if (hoisted.gpConnectedCbs.length > 0) {
      hoisted.gpConnectedCbs[0](noABtnGamepad);
    }
    pressKey(KEY_SPACE); // keyboard confirm
    const [state1] = tickTwice(input);
    expect(state1.confirm).toBe(true);
  });
});
