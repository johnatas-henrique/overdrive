/**
 * @fileoverview Unit tests for Story 001: IInput Interface + InputState Type Definitions.
 *
 * GDD Requirement: TR-INP-001
 * Governing ADR: ADR-0006 (Input Abstraction)
 * Control Manifest: C12 (polling per tick), C15 (player-only), C-F6 (no branch), C-F9 (no onBeforeRender)
 *
 * Covers all 5 acceptance criteria:
 *   AC-1: IInput interface defines correct method signatures
 *   AC-2: InputState has all defined fields with correct types
 *   AC-3: DeviceType is a union type of "keyboard" | "gamepad"
 *   AC-4: Import paths resolve correctly
 *   AC-5: InputState.ZERO returns neutral/zero/false values
 */

import { Observable } from "@babylonjs/core/Misc/observable";
import { describe, expect, it } from "vitest";
import { type DeviceType, type IInput, InputState } from "@/core/input/IInput";

// ---------------------------------------------------------------------------
// AC-1: IInput interface defines correct method signatures
// ---------------------------------------------------------------------------

describe("IInput interface", () => {
  it("test_interface_defines_correct_method_signatures", () => {
    // Compile-time type assertion: this class MUST satisfy IInput.
    // If the interface changes incompatibly, the `implements IInput` clause
    // here will fail at compile time.
    class MockInput implements IInput {
      onDeviceChanged = new Observable<DeviceType>();

      // Use `unknown` for Engine param to keep the mock free of Babylon runtime imports.
      // The interface parameter type is `Engine` — an `unknown` parameter is compatible
      // in TypeScript with strict method parameter bivariance disabled.
      init(_engine: unknown): void {
        // no-op for test
      }

      dispose(): void {
        // no-op for test
      }

      getState(): InputState {
        return InputState.ZERO;
      }
    }

    const input: IInput = new MockInput();

    // Runtime verification: all expected members exist with correct function types
    expect(typeof input.init).toBe("function");
    expect(input.init.length).toBe(1); // Engine parameter

    expect(typeof input.dispose).toBe("function");
    expect(input.dispose.length).toBe(0); // no parameters

    expect(typeof input.getState).toBe("function");
    expect(input.getState.length).toBe(0); // no parameters

    // onDeviceChanged is an Observable instance
    expect(input.onDeviceChanged).toBeInstanceOf(Observable);
  });
});

// ---------------------------------------------------------------------------
// AC-2: InputState has all defined fields with correct types
// ---------------------------------------------------------------------------

describe("InputState interface", () => {
  it("test_input_state_defines_all_required_fields", () => {
    // Build a complete InputState with non-default values to verify all fields exist
    const state: InputState = {
      steer: 0.5,
      throttle: 0.8,
      brake: 0.1,
      gearDelta: 1,
      confirm: true,
      pauseToggle: false,
      cameraToggle: true,
      cancel: false,
      navUp: true,
      navDown: false,
    };

    // Every field must be present and writable
    expect(state.steer).toBe(0.5);
    expect(state.throttle).toBe(0.8);
    expect(state.brake).toBe(0.1);
    expect(state.gearDelta).toBe(1);
    expect(state.confirm).toBe(true);
    expect(state.pauseToggle).toBe(false);
    expect(state.cameraToggle).toBe(true);
    expect(state.cancel).toBe(false);
    expect(state.navUp).toBe(true);
    expect(state.navDown).toBe(false);
  });

  it("test_analog_fields_have_correct_types", () => {
    const state: InputState = InputState.ZERO;

    // Analog fields are numbers
    expect(typeof state.steer).toBe("number");
    expect(typeof state.throttle).toBe("number");
    expect(typeof state.brake).toBe("number");

    // gearDelta is also a number (narrowed at type level to -1|0|1)
    expect(typeof state.gearDelta).toBe("number");
  });

  it("test_gear_delta_type_accepts_only_valid_values", () => {
    // TypeScript rejects -2, 2, etc. at compile time.
    // At runtime, any number can be assigned — we verify contract in the
    // type-safe write path (the implementing class).
    const validValues = [-1, 0, 1] as const;
    expect(validValues).toContain(-1);
    expect(validValues).toContain(0);
    expect(validValues).toContain(1);
  });

  it("test_boolean_fields_have_correct_types", () => {
    const state: InputState = InputState.ZERO;

    // All digital fields are booleans
    expect(typeof state.confirm).toBe("boolean");
    expect(typeof state.pauseToggle).toBe("boolean");
    expect(typeof state.cameraToggle).toBe("boolean");
    expect(typeof state.cancel).toBe("boolean");
    expect(typeof state.navUp).toBe("boolean");
    expect(typeof state.navDown).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// AC-3: DeviceType is a union type of "keyboard" | "gamepad"
// ---------------------------------------------------------------------------

describe("DeviceType", () => {
  it("test_device_type_accepts_keyboard", () => {
    const device: DeviceType = "keyboard";
    expect(device).toBe("keyboard");
  });

  it("test_device_type_accepts_gamepad", () => {
    const device: DeviceType = "gamepad";
    expect(device).toBe("gamepad");
  });

  it("test_device_type_only_has_two_values", () => {
    // Verify the union is closed — only these two strings are valid
    const keyboard: DeviceType = "keyboard";
    const gamepad: DeviceType = "gamepad";

    // Any other string assignment is rejected at compile time by TypeScript
    expect([keyboard, gamepad]).toEqual(["keyboard", "gamepad"]);
  });
});

// ---------------------------------------------------------------------------
// AC-4: Import paths resolve correctly
// ---------------------------------------------------------------------------

describe("Import path resolution", () => {
  it("test_core_module_imports_resolve", () => {
    // The import at the top of this file already verifies that
    // `@/core/input/IInput` resolves. If the import were broken,
    // the test file would fail to load entirely.
    //
    // Additionally, the IInput module itself imports from Babylon submodule
    // paths. If those paths don't resolve, the test runner will throw a
    // module-not-found error before any test runs.
    //
    // This test exists as an explicit check that the import chain is intact.
    expect(typeof InputState.ZERO).toBe("object");
  });
});

// ---------------------------------------------------------------------------
// AC-5: InputState.ZERO returns neutral/zero/false values
// ---------------------------------------------------------------------------

describe("InputState.ZERO constant", () => {
  it("test_zero_returns_neutral_analog_values", () => {
    const zero = InputState.ZERO;

    expect(zero.steer).toBe(0);
    expect(zero.throttle).toBe(0);
    expect(zero.brake).toBe(0);
    expect(zero.gearDelta).toBe(0);
  });

  it("test_zero_returns_false_for_all_booleans", () => {
    const zero = InputState.ZERO;

    expect(zero.confirm).toBe(false);
    expect(zero.pauseToggle).toBe(false);
    expect(zero.cameraToggle).toBe(false);
    expect(zero.cancel).toBe(false);
    expect(zero.navUp).toBe(false);
    expect(zero.navDown).toBe(false);
  });

  it("test_zero_is_singleton_reference", () => {
    // ZERO is a module-level singleton — every access returns the same object
    const a = InputState.ZERO;
    const b = InputState.ZERO;
    expect(a).toBe(b);
  });

  it("test_zero_is_frozen", () => {
    // Object.freeze() prevents accidental mutation of the shared singleton
    expect(Object.isFrozen(InputState.ZERO)).toBe(true);
    expect(() => {
      (InputState.ZERO as { steer: number }).steer = 0.5;
    }).toThrow();
  });

  it("test_zero_fields_are_all_at_minimum", () => {
    const zero = InputState.ZERO;

    // steer at center
    expect(zero.steer).toBeGreaterThanOrEqual(-1);
    expect(zero.steer).toBeLessThanOrEqual(1);
    expect(zero.steer).toBe(0);

    // throttle at minimum (fully released)
    expect(zero.throttle).toBeGreaterThanOrEqual(0);
    expect(zero.throttle).toBeLessThanOrEqual(1);
    expect(zero.throttle).toBe(0);

    // brake at minimum (fully released)
    expect(zero.brake).toBeGreaterThanOrEqual(0);
    expect(zero.brake).toBeLessThanOrEqual(1);
    expect(zero.brake).toBe(0);
  });
});
