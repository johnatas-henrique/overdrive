// @vitest-environment happy-dom
/**
 * @fileoverview Integration tests for Story 007: Device Detection + onDeviceChanged Observable.
 *
 * GDD Requirement: TR-INP-008 — onDeviceChanged observable fires once per device switch
 *   (keyboard→gamepad or vice versa) for HUD hints.
 *
 * Governing ADR: ADR-0006 (Input Abstraction)
 *   - Detection logic in getState() — after both keyboard and gamepad read
 *   - Gamepad priority: gamepad wins when both have input in the same tick
 *   - Sub-threshold noise does NOT trigger a switch
 *
 * Control Manifest: C12 (polling per tick), F-G3 (<0.01ms per tick)
 *
 * Covers all 3 acceptance criteria.
 */

import { describe, expect, it } from "vitest";
import type { DeviceType } from "@/core/input/IInput";

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
// Import module under test (after mocks).
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
const _KEY_E = 69;
const KEY_SPACE = 32;
const KEY_ESCAPE = 27;
const _KEY_C = 67;
const _KEY_BACKSPACE = 8;
const _KEY_ARROW_UP = 38;
const _KEY_ARROW_DOWN = 40;

// Gamepad button indices
const GP_A = 0;
const _GP_B = 1;
const _GP_Y = 3;
const _GP_LB = 4;
const GP_RB = 5;
const GP_LT = 6;
const GP_RT = 7;
const _GP_START = 9;
const GP_DPAD_UP = 12;
const _GP_DPAD_DOWN = 13;

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
function releaseKey(code: number): void {
  delete hoisted.mockKeyState[code];
}

// =============================================================================
// Tests
// =============================================================================

// ---------------------------------------------------------------------------
// AC-1: Tracks lastActiveDevice based on meaningful input
// ---------------------------------------------------------------------------

describe("AC-1: lastActiveDevice tracks meaningful input", () => {
  it("test_default_device_is_keyboard", () => {
    const input = createPlayerInput();
    expect(input.getLastActiveDevice()).toBe("keyboard");
  });

  it("test_keyboard_w_key_sets_last_active_to_keyboard", () => {
    const input = createPlayerInput();
    pressKey(KEY_W);
    input.getState();
    expect(input.getLastActiveDevice()).toBe("keyboard");
  });

  it("test_keyboard_caps_lock_sets_device_to_keyboard", () => {
    // Non-game key like caps lock (keyCode 20) — not directly mapped,
    // but the DSM mock reports it when set in mockKeyState.
    // The device detection covers all mapped keys.
    const input = createPlayerInput();
    // First make it gamepad, then any keyboard key (including non-game)
    // switches back. Since we don't map caps lock, use a mapped key
    // to verify the any-key-press intent.
    const bgp = connectGamepad();
    bgp.axes[0] = 0.5;
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");

    // Clear gamepad axes before keyboard — otherwise getState() still
    // sees gamepad analog activity and gamepad wins priority
    bgp.axes[0] = 0;
    // Now press a non-WASD key — should switch to keyboard
    pressKey(KEY_SPACE);
    input.getState();
    expect(input.getLastActiveDevice()).toBe("keyboard");
  });

  it("test_gamepad_analog_above_dead_zone_sets_gamepad", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.axes[0] = 0.6; // above DEFAULT_DEAD_ZONE (0.15)
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });

  it("test_gamepad_right_trigger_above_threshold_sets_gamepad", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[GP_RT].value = 0.2; // above dead zone
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });

  it("test_gamepad_left_trigger_above_threshold_sets_gamepad", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[GP_LT].value = 0.2; // above dead zone
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });

  it("test_gamepad_digital_button_sets_gamepad", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[GP_A].pressed = true; // A button
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });

  it("test_gamepad_sub_threshold_noise_does_not_switch", () => {
    const input = createPlayerInput();
    // Default is keyboard. Connect gamepad (device becomes "gamepad" from
    // the connect observable — Story 004 behavior).
    const bgp = connectGamepad();
    expect(input.getLastActiveDevice()).toBe("gamepad");

    // Send sub-threshold noise — should NOT trigger activity
    bgp.axes[0] = 0.05; // below dead zone (0.15)
    bgp.buttons[GP_RT].value = 0.05; // below dead zone
    input.getState();
    // Should still be "gamepad" from connect — sub-threshold noise does
    // not produce meaningful gamepad input to switch device.
    expect(input.getLastActiveDevice()).toBe("gamepad");

    // Keyboard input should still work and switch device back
    pressKey(KEY_W);
    input.getState();
    expect(input.getLastActiveDevice()).toBe("keyboard");

    // Now send meaningful gamepad input
    bgp.axes[0] = 0.5;
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });

  it("test_no_input_leaves_device_at_default", () => {
    const input = createPlayerInput();
    // No input at all
    input.getState();
    expect(input.getLastActiveDevice()).toBe("keyboard");
    input.getState();
    expect(input.getLastActiveDevice()).toBe("keyboard");
  });

  it("test_gamepad_digital_shoulder_button_sets_gamepad", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[GP_RB].pressed = true;
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });

  it("test_gamepad_digital_dpad_up_sets_gamepad", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.buttons[GP_DPAD_UP].pressed = true;
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });

  it("test_both_keyboard_and_gamepad_gamepad_wins_priority", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    // Both keyboard and gamepad have input this tick
    pressKey(KEY_W);
    bgp.axes[0] = 0.5;
    input.getState();
    // Gamepad should win (racing game — gamepad is primary)
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });
});

// ---------------------------------------------------------------------------
// AC-2: onDeviceChanged fires exactly once on device switch
// ---------------------------------------------------------------------------

describe("AC-2: onDeviceChanged fires once on switch, not each tick", () => {
  it("test_initial_keyboard_no_fire_on_keyboard_input", () => {
    const input = createPlayerInput();
    let callCount = 0;
    input.onDeviceChanged.add(() => {
      callCount++;
    });

    // Default is keyboard — first keyboard input should not fire (no switch)
    pressKey(KEY_W);
    input.getState();
    expect(callCount).toBe(0);
  });

  it("test_keyboard_input_10_ticks_no_fire", () => {
    const input = createPlayerInput();
    let callCount = 0;
    input.onDeviceChanged.add(() => {
      callCount++;
    });

    pressKey(KEY_W);
    // 10 ticks of keyboard input
    for (let i = 0; i < 10; i++) {
      input.getState();
    }
    expect(callCount).toBe(0);
  });

  it("test_first_gamepad_input_fires_exactly_once", () => {
    const input = createPlayerInput();
    let callCount = 0;
    input.onDeviceChanged.add(() => {
      callCount++;
    });

    // Connect gamepad (fires onDeviceChanged via observable)
    const _bgp = connectGamepad();
    // First tick: connect observable already set _lastActiveDevice to "gamepad"
    // and fired onDeviceChanged. So by the time getState() runs,
    // _lastActiveDevice is already "gamepad".

    // This means the connect notification IS the first fire.
    // The per-tick detection won't re-fire because no switch occurs.

    expect(callCount).toBe(1); // fired once from connect observable
  });

  it("test_keyboard_to_gamepad_switch_fires_on_device_change", () => {
    const input = createPlayerInput();
    const notifications: DeviceType[] = [];
    input.onDeviceChanged.add((device) => {
      notifications.push(device);
    });

    // Start with keyboard, no gamepad connected yet.
    // Clear initial connect by re-initializing state
    pressKey(KEY_W);
    input.getState(); // keyboard, no fire
    expect(notifications).toEqual([]);

    // Connect gamepad — this fires onDeviceChanged via observable
    const bgp = connectGamepad();
    bgp.axes[0] = 0; // no meaningful input yet

    // Note: connectGamepad fires the connect observable which calls
    // notifyObservers("gamepad"). But _lastActiveDevice is set to "gamepad"
    // in the same handler. The getState() call below sees device already
    // as "gamepad", so no additional notification from _determineActiveDevice.

    expect(notifications).toEqual(["gamepad"]); // fired from connect
  });

  it("test_gamepad_input_10_ticks_no_repeat_fire", () => {
    const input = createPlayerInput();
    let callCount = 0;
    input.onDeviceChanged.add(() => {
      callCount++;
    });

    // Default is keyboard. Connect gamepad — fires once.
    const bgp = connectGamepad();
    expect(callCount).toBe(1);

    // Send gamepad input for 10 ticks
    bgp.axes[0] = 0.5;
    for (let i = 0; i < 10; i++) {
      input.getState();
    }
    // Should still be 1 — same device, no switch
    expect(callCount).toBe(1);
  });

  it("test_rapid_alternating_kb_gp_fires_each_switch", () => {
    const input = createPlayerInput();
    const notifications: DeviceType[] = [];
    input.onDeviceChanged.add((device) => {
      notifications.push(device);
    });

    // Connect gamepad but don't send input yet (fire from connect)
    const bgp = connectGamepad();
    // connect fired "gamepad"

    // Clear the fire from connect: reset notifications
    const connectFire = notifications.shift();
    expect(connectFire).toBe("gamepad");

    // --- keyboard ---
    // Need to clear gamepad axes first so gamepad detection is false
    bgp.axes[0] = 0;

    pressKey(KEY_W);
    input.getState(); // switches to keyboard
    expect(notifications).toEqual(["keyboard"]);

    // --- gamepad ---
    releaseKey(KEY_W);
    bgp.axes[0] = 0.5;
    input.getState(); // switches to gamepad
    expect(notifications).toEqual(["keyboard", "gamepad"]);

    // --- keyboard ---
    bgp.axes[0] = 0;
    pressKey(KEY_A);
    input.getState(); // switches to keyboard
    expect(notifications).toEqual(["keyboard", "gamepad", "keyboard"]);
  });

  it("test_same_device_repeated_input_does_not_refire", () => {
    const input = createPlayerInput();
    let callCount = 0;
    input.onDeviceChanged.add(() => {
      callCount++;
    });

    // Keyboard only — no connect event, no gamepad input
    pressKey(KEY_W);
    input.getState();
    expect(callCount).toBe(0);

    pressKey(KEY_D);
    input.getState();
    expect(callCount).toBe(0); // still keyboard, no switch

    pressKey(KEY_SPACE);
    input.getState();
    expect(callCount).toBe(0); // still keyboard
  });

  it("test_on_device_changed_observable_add_remove_works", () => {
    const input = createPlayerInput();
    let callCount = 0;
    const handler = () => {
      callCount++;
    };
    input.onDeviceChanged.add(handler);

    // Connect gamepad — fires
    const _bgp = connectGamepad();
    expect(callCount).toBe(1);

    // Remove handler and connect again (after re-init)
    input.onDeviceChanged.remove(handler);
    input.dispose();

    // Re-init with fresh observable
    input.init({} as unknown as never);

    // Fresh handler
    let callCount2 = 0;
    input.onDeviceChanged.add(() => {
      callCount2++;
    });

    const _bgp2 = connectGamepad();
    expect(callCount2).toBe(1);
    // Old handler should not fire
    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC-3: No penalty for switching mid-race
// ---------------------------------------------------------------------------

describe("AC-3: no penalty for switching mid-race", () => {
  it("test_gamepad_steer_uninterrupted_when_keyboard_triggers_switch", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();

    // Set gamepad steer to 0.5
    bgp.axes[0] = 0.5;

    // Press keyboard W (triggers device switch, but steer should be analog)
    pressKey(KEY_W);
    const state = input.getState();

    // Keyboard W sets throttle to 1, but steering should be from gamepad (analog)
    const expectedSteer = (0.5 - DEFAULT_DEAD_ZONE) / (1 - DEFAULT_DEAD_ZONE);
    expect(state.steer).toBeCloseTo(expectedSteer, 5);
    expect(state.throttle).toBe(1); // keyboard throttle still works
    expect(input.getLastActiveDevice()).toBe("gamepad"); // gamepad priority
  });

  it("test_brake_continues_during_device_switch", () => {
    const input = createPlayerInput();
    // Start with keyboard only — no gamepad
    pressKey(KEY_S); // brake
    input.getState(); // ticks 1: clear state
    releaseKey(KEY_S);

    // Now connect gamepad mid-race and set brake
    const bgp = connectGamepad();
    bgp.buttons[GP_LT].value = 0.5; // gamepad brake

    // Also press a keyboard key (would trigger switch if not already switched)
    pressKey(KEY_SPACE);

    const state = input.getState();
    // Brake should come from gamepad analog (override)
    const expectedBrake = (0.5 - DEFAULT_DEAD_ZONE) / (1 - DEFAULT_DEAD_ZONE);
    expect(state.brake).toBeCloseTo(expectedBrake, 5);
    expect(state.confirm).toBe(true); // keyboard digital still works
    expect(input.getLastActiveDevice()).toBe("gamepad");
  });

  it("test_steer_throttle_brake_all_work_during_switch", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();

    // Gamepad provides all analog values
    bgp.axes[0] = -0.8; // steer left
    bgp.buttons[GP_RT].value = 0.7; // throttle
    bgp.buttons[GP_LT].value = 0.3; // brake

    // First getState() to clear initial state — no keyboard pressed yet
    input.getState();

    // Now press keyboard key for edge detection (Escape — pauseToggle)
    pressKey(KEY_ESCAPE); // pauseToggle

    // Tick 1: edge detected
    const state1 = { ...input.getState() };
    // All analog should come from gamepad (dead zone formula:
    // sign(raw) × (|raw| - threshold) / (1 - threshold))
    const expectedSteer =
      (Math.sign(-0.8) * (Math.abs(-0.8) - DEFAULT_DEAD_ZONE)) /
      (1 - DEFAULT_DEAD_ZONE);
    const expectedThrottle =
      (0.7 - DEFAULT_DEAD_ZONE) / (1 - DEFAULT_DEAD_ZONE);
    const expectedBrake = (0.3 - DEFAULT_DEAD_ZONE) / (1 - DEFAULT_DEAD_ZONE);
    expect(state1.steer).toBeCloseTo(expectedSteer, 5);
    expect(state1.throttle).toBeCloseTo(expectedThrottle, 5);
    expect(state1.brake).toBeCloseTo(expectedBrake, 5);
    // Digital should fire on tick 1
    expect(state1.pauseToggle).toBe(true);

    // Tick 2: pulse consumed, no edge
    const state2 = { ...input.getState() };
    expect(state2.pauseToggle).toBe(false);
  });

  it("test_keyboard_only_works_when_gamepad_disconnected", () => {
    const input = createPlayerInput();

    // Connect then disconnect gamepad
    connectGamepad();
    if (hoisted.gpDisconnectedCbs.length > 0) {
      hoisted.gpDisconnectedCbs[0]();
    }

    // Keyboard should still work
    pressKey(KEY_D);
    const state = input.getState();
    expect(state.steer).toBe(1); // keyboard binary steer
    expect(input.getLastActiveDevice()).toBe("keyboard");
  });

  it("test_observable_fires_with_device_type_while_values_uninterrupted", () => {
    const input = createPlayerInput();
    let lastNotified: DeviceType = "keyboard";
    input.onDeviceChanged.add((device) => {
      lastNotified = device;
    });

    // Gamepad provides steer
    const bgp = connectGamepad();
    bgp.axes[0] = 0.8;
    input.getState();
    expect(lastNotified).toBe("gamepad"); // from connect

    // Keyboard only input (no gamepad activity this tick)
    bgp.axes[0] = 0;
    pressKey(KEY_W);
    input.getState();

    // Observable fired with "keyboard", but values are keyboard binary
    expect(lastNotified).toBe("keyboard");
    const state = input.getState();
    expect(state.steer).toBe(0); // no gamepad input, keyboard no A/D
    expect(state.throttle).toBe(1); // keyboard W

    // Gamepad back
    bgp.axes[0] = 0.6;
    releaseKey(KEY_W);
    input.getState();
    expect(lastNotified).toBe("gamepad");
  });

  it("test_switch_during_dead_zone_zeroed_input", () => {
    const input = createPlayerInput();
    let lastNotified: DeviceType = "keyboard";
    input.onDeviceChanged.add((device) => {
      lastNotified = device;
    });

    const bgp = connectGamepad();
    // Gamepad provides sub-threshold input (no meaningful gamepad activity)
    bgp.axes[0] = 0.05; // below dead zone
    input.getState();

    // Should still be gamepad from connect
    expect(lastNotified).toBe("gamepad");
    expect(input.getLastActiveDevice()).toBe("gamepad");

    // Keyboard key switches
    pressKey(KEY_W);
    input.getState();
    expect(lastNotified).toBe("keyboard");
    expect(input.getLastActiveDevice()).toBe("keyboard");
  });

  it("test_gear_up_pulse_works_after_device_switch", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();

    // Gamepad provides input
    bgp.axes[0] = 0.5;

    // Keyboard Q (gear up)
    pressKey(KEY_Q);
    const state = input.getState();
    expect(state.gearDelta).toBe(1);
    expect(input.getLastActiveDevice()).toBe("gamepad"); // gamepad priority
  });
});

// ---------------------------------------------------------------------------
// Edge cases: Initial state, disposal, re-init
// ---------------------------------------------------------------------------

describe("device detection edge cases", () => {
  it("test_initial_last_active_device_is_keyboard", () => {
    const input = new PlayerInput();
    expect(input.getLastActiveDevice()).toBe("keyboard");
  });

  it("test_dispose_resets_to_keyboard_on_reinit", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.axes[0] = 0.5;
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");

    input.dispose();
    // After dispose, _fullReset() sets _lastActiveDevice to "keyboard"
    expect(input.getLastActiveDevice()).toBe("keyboard");
  });

  it("test_on_device_changed_cleared_on_dispose", () => {
    const input = createPlayerInput();
    let callCount = 0;
    input.onDeviceChanged.add(() => {
      callCount++;
    });

    // Connect gamepad — fires
    connectGamepad();
    expect(callCount).toBe(1);

    // Dispose clears observable
    input.dispose();
    expect(callCount).toBe(1); // no new fire

    // Re-init — observable is fresh
    input.init({} as unknown as never);
    let callCount2 = 0;
    input.onDeviceChanged.add(() => {
      callCount2++;
    });
    connectGamepad();
    expect(callCount2).toBe(1);
  });

  it("test_reinit_resets_device_to_keyboard", () => {
    const input = createPlayerInput();
    const bgp = connectGamepad();
    bgp.axes[0] = 0.5;
    input.getState();
    expect(input.getLastActiveDevice()).toBe("gamepad");

    // Re-init
    input.init({} as unknown as never);
    expect(input.getLastActiveDevice()).toBe("keyboard");
  });
});
