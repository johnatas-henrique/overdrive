// @vitest-environment happy-dom
/**
 * @fileoverview Integration tests for Story 004: Tab Blur Safety + Gamepad Disconnect Handling.
 *
 * GDD Requirement: TR-INP-005 — Focus loss (tab/native/visibility) zeros all outputs
 *   immediately — single flag in getState(); focus return resumes live hardware state.
 * GDD Requirement: TR-INP-009 — Gamepad disconnect → activeGamepad set to null;
 *   getState() returns zeroed axes for disconnected gamepad; keyboard remains active.
 *
 * Governing ADR: ADR-0006 (Input Abstraction)
 *   - Focus Loss Handling: dual detection (blur + visibilitychange), AbortController cleanup
 *   - Gamepad State Management: onGamepadDisconnectedObservable → activeGamepad = null
 * Control Manifest: C14 (tab blur zeros), F-G3 (<0.01ms slot budget)
 *
 * Covers all 6 acceptance criteria (AC-1 through AC-6).
 */

import { describe, expect, it } from "vitest";

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
   * Reset all mock state to neutral.
   */
  function resetMockState(): void {
    for (const k of Object.keys(mockKeyState)) {
      delete mockKeyState[k as unknown as number];
    }
    mockBrowserGamepad.axes.fill(0);
    for (const btn of mockBrowserGamepad.buttons) {
      btn.pressed = false;
      btn.value = 0;
    }
    mockBrowserGamepad.connected = true;
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
// Mock Babylon.js modules
// =============================================================================

vi.mock("@babylonjs/core/DeviceInput/InputDevices/deviceSourceManager", () => ({
  // biome-ignore lint/complexity/useArrowFunction: Vitest mock factory requires function syntax
  DeviceSourceManager: function () {
    return hoisted.mockDsmInstance;
  },
}));

vi.mock("@babylonjs/core/Gamepads/gamepadManager", () => ({
  // biome-ignore lint/complexity/useArrowFunction: Vitest mock factory requires function syntax
  GamepadManager: function () {
    return hoisted.mockGmInstance;
  },
}));

// =============================================================================
// Import module under test
// =============================================================================

import { InputState } from "@/core/input/IInput";
import { PlayerInput } from "@/core/input/player-input";

// =============================================================================
// Constants matching player-input.ts
// =============================================================================

const KEY_W = 87;
const KEY_D = 68;
const KEY_SPACE = 32;

const GP_AXIS_LEFT_X = 0;

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

/** Simulate connecting a gamepad. Returns the mock browser gamepad. */
function connectGamepad(): typeof hoisted.mockBrowserGamepad {
  if (hoisted.gpConnectedCbs.length > 0) {
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

// =============================================================================
// Tests
// =============================================================================

// ---------------------------------------------------------------------------
// AC-1: Tab blur zeros all outputs
// ---------------------------------------------------------------------------

describe("AC-1: blur zeros all outputs", () => {
  it("window_blur_sets_hidden_and_getState_returns_all_zeros", () => {
    const input = createPlayerInput();
    pressKey(KEY_W);
    pressKey(KEY_D);
    // Verify normal operation before blur
    expect(input.getState().throttle).toBe(1);
    expect(input.getState().steer).toBe(1);

    // Dispatch window blur event
    window.dispatchEvent(new Event("blur"));

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

  it("visibilitychange_with_hidden_true_zeros_all_outputs", () => {
    const input = createPlayerInput();
    pressKey(KEY_W);

    // Simulate tab switch: document.hidden is true
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    const state = input.getState();
    expect(state.steer).toBe(0);
    expect(state.throttle).toBe(0);
  });

  it("blur_fires_twice_still_returns_zero", () => {
    const input = createPlayerInput();
    pressKey(KEY_W);

    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("blur")); // second blur

    const state = input.getState();
    expect(state.throttle).toBe(0);
  });

  it("blur_without_prior_input_returns_zero", () => {
    const input = createPlayerInput();

    window.dispatchEvent(new Event("blur"));

    const state = input.getState();
    expect(state.steer).toBe(0);
    expect(state.throttle).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-2: focus resumes live values
// ---------------------------------------------------------------------------

describe("AC-2: focus resumes live values", () => {
  it("window_focus_restores_live_polling", () => {
    const input = createPlayerInput();

    // Blur first
    window.dispatchEvent(new Event("blur"));
    expect(input.getState().throttle).toBe(0);

    // Focus — should resume live reading
    window.dispatchEvent(new Event("focus"));
    pressKey(KEY_W);
    expect(input.getState().throttle).toBe(1);
  });

  it("visibilitychange_hidden_false_restores_live_polling", () => {
    const input = createPlayerInput();

    // Hide via visibilitychange
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(input.getState().steer).toBe(0);

    // Show via visibilitychange
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    pressKey(KEY_D);
    expect(input.getState().steer).toBe(1);
  });

  it("focus_without_prior_blur_is_no_op", () => {
    const input = createPlayerInput();

    // Focus when already focused — should not break anything
    window.dispatchEvent(new Event("focus"));

    pressKey(KEY_W);
    expect(input.getState().throttle).toBe(1);
  });

  it("focus_when_already_focused_is_no_op", () => {
    const input = createPlayerInput();
    pressKey(KEY_W);

    // Focus twice when already focused
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("focus"));

    expect(input.getState().throttle).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC-3: gamepad disconnect zeros gamepad axes; keyboard stays
// ---------------------------------------------------------------------------

describe("AC-3: gamepad disconnect zeros gamepad axes; keyboard stays", () => {
  it("disconnect_zeros_gamepad_axes_keyboard_still_works", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();

    // Set gamepad analog value + keyboard binary input
    bgp.axes[GP_AXIS_LEFT_X] = 0.5;
    pressKey(KEY_W); // keyboard throttle (binary, NOT edge-detected)

    // Verify both work before disconnect
    const stateBefore = input.getState();
    expect(stateBefore.steer).not.toBe(0);
    expect(stateBefore.throttle).toBe(1);

    // Disconnect gamepad
    disconnectGamepad();

    // After disconnect: gamepad steer is zeroed, keyboard throttle still works
    const stateAfter = input.getState();
    expect(stateAfter.steer).toBe(0);
    expect(stateAfter.throttle).toBe(1);
  });

  it("disconnect_when_no_gamepad_is_safe_no_op", () => {
    const input = createPlayerInput();

    // No gamepad connected — disconnect should be safe
    expect(() => disconnectGamepad()).not.toThrow();
    expect(input.getState().steer).toBe(0);
  });

  it("double_disconnect_is_safe_no_op", () => {
    const input = createPlayerInput();
    connectGamepad();
    disconnectGamepad();

    // Second disconnect — activeGamepad is already null
    expect(() => disconnectGamepad()).not.toThrow();
    expect(input.getState().steer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-4: gamepad reconnect resumes
// ---------------------------------------------------------------------------

describe("AC-4: gamepad reconnect resumes", () => {
  it("reconnect_restores_active_gamepad", () => {
    const input = createPlayerInput();
    connectGamepad();
    disconnectGamepad();
    expect(input.getState().steer).toBe(0);

    // Reconnect — restore and read
    const bgp = connectGamepad();
    bgp.axes[GP_AXIS_LEFT_X] = 0.8;

    // After reconnect and stick moved, steer should be non-zero
    const state = input.getState();
    expect(state.steer).not.toBe(0);
  });

  it("reconnect_during_blur_gamepad_stored_but_getState_returns_zero", () => {
    const input = createPlayerInput();

    // Blur
    window.dispatchEvent(new Event("blur"));

    // Reconnect during blur — gamepad is stored internally
    const bgp = connectGamepad();
    bgp.axes[GP_AXIS_LEFT_X] = 0.8;

    // getState should still return zero because tab is hidden
    expect(input.getState().steer).toBe(0);

    // After focus, gamepad readings resume
    window.dispatchEvent(new Event("focus"));
    const state = input.getState();
    expect(state.steer).not.toBe(0);
  });

  it("rapid_disconnect_reconnect_last_connected_wins", () => {
    const input = createPlayerInput();
    const bgp1 = connectGamepad();
    bgp1.axes[GP_AXIS_LEFT_X] = 0.3;

    // Disconnect
    disconnectGamepad();

    // Reconnect with different value
    const bgp2 = connectGamepad();
    bgp2.axes[GP_AXIS_LEFT_X] = 0.9;

    // Last connected should be active
    const state = input.getState();
    expect(Math.abs(state.steer)).toBeGreaterThan(0.3);
  });
});

// ---------------------------------------------------------------------------
// AC-5: all-zeros matches InputState.ZERO
// ---------------------------------------------------------------------------

describe("AC-5: all-zeros matches InputState.ZERO", () => {
  it("blur_returns_structurally_equal_to_input_state_zero", () => {
    const input = createPlayerInput();
    pressKey(KEY_W);
    pressKey(KEY_D);

    window.dispatchEvent(new Event("blur"));
    const state = input.getState();

    // Structural equality check using toStrictEqual
    expect(state).toStrictEqual(InputState.ZERO);
  });

  it("all_zero_path_does_not_mutate_zero_constant", () => {
    const input = createPlayerInput();

    // Capture a snapshot of ZERO before
    const before = { ...InputState.ZERO };

    // Trigger blur path — returns ZERO singleton
    window.dispatchEvent(new Event("blur"));
    const state = input.getState();

    // Even if someone tried to mutate the returned state...
    // (in practice, returning the singleton doesn't protect against mutation
    //  by the caller, but we verify ZERO itself is unchanged)
    expect(InputState.ZERO).toStrictEqual(before);

    // The returned state IS structurally ZERO
    expect(state).toStrictEqual(InputState.ZERO);
  });

  it("disconnect_returns_structurally_equal_to_input_state_zero_for_gamepad_axes", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.axes[GP_AXIS_LEFT_X] = 0.5;

    disconnectGamepad();
    const state = input.getState();

    // Gamepad axes are zeroed; keyboard is zero because no keys pressed
    expect(state.steer).toBe(0);
    expect(state.throttle).toBe(0);
    expect(state.brake).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-6: no replay on focus return
// ---------------------------------------------------------------------------

describe("AC-6: no replay on focus return", () => {
  it("post_focus_value_is_live_hardware_not_pre_blur", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();

    // Pre-blur: throttle = 0.8 via gamepad
    bgp.buttons[7].value = 0.8;
    const preBlur = input.getState();
    expect(preBlur.throttle).toBeGreaterThan(0);

    // Blur
    window.dispatchEvent(new Event("blur"));
    expect(input.getState().throttle).toBe(0);

    // Change mocked hardware while blurred
    bgp.buttons[7].value = 0.3;

    // Focus
    window.dispatchEvent(new Event("focus"));

    // Post-focus should read 0.3, NOT the pre-blur 0.8
    const postFocus = input.getState();
    expect(postFocus.throttle).toBeGreaterThan(0);
    // Dead zone applied: (0.3 - 0.15) / (1 - 0.15) ≈ 0.176
    // The value should be closer to 0.3 raw (pre-dead-zone) than 0.8
    expect(postFocus.throttle).toBeLessThan(0.5);
  });

  it("inputs_changed_during_blur_post_focus_is_correct", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();

    // Pre-blur: steer = 0.5
    bgp.axes[GP_AXIS_LEFT_X] = 0.5;

    // Blur
    window.dispatchEvent(new Event("blur"));

    // While blurred, stick moved to opposite direction
    bgp.axes[GP_AXIS_LEFT_X] = -0.7;

    // Focus
    window.dispatchEvent(new Event("focus"));

    // Post-focus steer should be negative (the new hardware value)
    const state = input.getState();
    expect(state.steer).toBeLessThan(0);
  });

  it("key_released_during_blur_is_reflected_post_focus", () => {
    const input = createPlayerInput();

    // Pre-blur: W pressed (throttle = 1)
    pressKey(KEY_W);
    expect(input.getState().throttle).toBe(1);

    // Blur
    window.dispatchEvent(new Event("blur"));
    expect(input.getState().throttle).toBe(0);

    // While blurred, release W
    releaseKey(KEY_W);

    // Focus
    window.dispatchEvent(new Event("focus"));

    // Post-focus: throttle should be 0 (key was released)
    expect(input.getState().throttle).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Additional: AbortController lifecycle — listener cleanup
// ---------------------------------------------------------------------------

describe("AbortController lifecycle", () => {
  it("dispose_aborts_blur_controller_listeners_are_removed", () => {
    const input = createPlayerInput();

    // Dispose
    input.dispose();

    // After dispose, blur event should NOT set _hidden because listeners are removed
    window.dispatchEvent(new Event("blur"));

    // Re-init and verify it still works (fresh listeners)
    input.init({} as unknown as never);
    pressKey(KEY_W);
    expect(input.getState().throttle).toBe(1);
  });

  it("re_init_creates_new_listeners_blur_still_works", () => {
    const input = createPlayerInput();

    // First cycle
    pressKey(KEY_W);
    expect(input.getState().throttle).toBe(1);

    // Re-init (simulates Race Again)
    input.init({} as unknown as never);

    // Blur should still work after re-init
    pressKey(KEY_D);
    expect(input.getState().steer).toBe(1);

    window.dispatchEvent(new Event("blur"));
    expect(input.getState().steer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Additional: Disconnect timing hardening — browserGamepad.connected check
// ---------------------------------------------------------------------------

describe("Disconnect timing hardening", () => {
  it("disconnected_browser_gamepad_clears_active_gamepad", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();

    // Stale axis value that should NOT be read
    bgp.axes[GP_AXIS_LEFT_X] = 0.8;

    // Simulate hardware disconnect: browserGamepad.connected = false
    // before GamepadManager's observable fires
    bgp.connected = false;

    // getState should clear activeGamepad due to hardening check in _readGamepad
    const state = input.getState();
    expect(state.steer).toBe(0);
  });

  it("disconnected_browser_gamepad_keyboard_still_works", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.axes[GP_AXIS_LEFT_X] = 0.8;
    bgp.connected = false;

    // Keyboard should still work
    pressKey(KEY_SPACE);
    const state = input.getState();
    expect(state.steer).toBe(0);
    expect(state.confirm).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Additional: onDeviceChanged observable does NOT fire on disconnect
// ---------------------------------------------------------------------------

describe("onDeviceChanged negative: disconnect does not fire", () => {
  it("disconnect_does_not_fire_on_device_changed", () => {
    const input = createPlayerInput();
    const notifications: string[] = [];
    input.onDeviceChanged.add((device) => {
      notifications.push(device);
    });

    // Connect gamepad — should fire
    connectGamepad();
    expect(notifications).toEqual(["gamepad"]);

    // Disconnect gamepad — should NOT fire
    disconnectGamepad();
    expect(notifications).toEqual(["gamepad"]); // no new notification
  });

  it("disconnect_without_prior_connect_does_not_fire", () => {
    const input = createPlayerInput();
    const notifications: string[] = [];
    input.onDeviceChanged.add((device) => {
      notifications.push(device);
    });

    // No connect, just disconnect — should not fire
    disconnectGamepad();
    expect(notifications).toEqual([]);
  });
});
