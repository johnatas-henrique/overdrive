/**
 * @fileoverview Pure type definitions for the Overdrive Input abstraction layer.
 *
 * GDD Requirement: TR-INP-001 — IInput interface with getState(): InputState
 * governing ADR: ADR-0006 (Input Abstraction)
 *
 * This file contains only types, interfaces, and a single readonly constant.
 * No runtime logic, no concrete implementations.
 *
 * @remarks
 * DEV-IATION: The import path for DeviceSourceManager differs from the spec.
 *   Spec:  @babylonjs/core/DeviceInput/deviceSourceManager
 *   Actual: @babylonjs/core/DeviceInput/InputDevices/deviceSourceManager
 *   Rationale: Babylon.js 9.x restructured module paths. The spec intent
 *   ("tree-shakeable submodule import") is preserved.
 */

import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Observable } from "@babylonjs/core/Misc/observable";
// Note: DeviceSourceManager and GamepadManager are intentionally not imported
// here — they are implementation details used by the concrete PlayerInput class
// (Story 003). This file is pure types + interface only.
// Tree-shakeable import paths for reference:
//   import type { DeviceSourceManager } from "@babylonjs/core/DeviceInput/InputDevices/deviceSourceManager";
//   import type { GamepadManager } from "@babylonjs/core/Gamepads/gamepadManager";

/**
 * Union type representing the physical input device currently active.
 *
 * - `"keyboard"`: Keyboard is the last active device (or only connected device)
 * - `"gamepad"`: Gamepad is the last active device
 */
export type DeviceType = "keyboard" | "gamepad";

/**
 * Universal tick-level input signal shared by Player Input and AI Driver.
 *
 * This is the contract between input producers (pipeline slot #1 for player,
 * slot #3 for AI Driver) and consumers (slot #2 Physics, menu navigation,
 * camera). All values are normalized to the documented ranges below.
 *
 * @remarks
 * - Analog values are normalized: steer ∈ [-1, 1], throttle/brake ∈ [0, 1]
 * - Digital values are boolean pulses (edge-detected per tick)
 * - gearDelta is tri-state: -1 (downshift), 0 (no change), +1 (upshift)
 *
 * Documented as the universal tick-level signal. Physics (slot #2) reads
 * from a double-buffered `Map<string, InputState>`, never branching on
 * player vs AI origin.
 */
export interface InputState {
  /**
   * Steering input. -1 = full left, 0 = center, +1 = full right.
   * After dead zone processing per TR-INP-003 / ADR-0006.
   */
  steer: number;

  /**
   * Throttle input. 0 = released, 1 = fully pressed.
   * After dead zone processing per TR-INP-003 / ADR-0006.
   */
  throttle: number;

  /**
   * Brake input. 0 = released, 1 = fully pressed.
   * After dead zone processing per TR-INP-003 / ADR-0006.
   */
  brake: number;

  /**
   * Gear shift delta.
   * - -1: downshift (one gear lower)
   * -  0: no gear change
   * - +1: upshift (one gear higher)
   *
   * Pulse semantics — consumed exactly once per press, not held.
   */
  gearDelta: -1 | 0 | 1;

  /** Confirm action (menu select, dialogue accept). Pulse. */
  confirm: boolean;

  /** Toggle pause. Pulse — consumed by GSM transition. */
  pauseToggle: boolean;

  /** Toggle camera view (cockpit ↔ chase). Pulse — debounced per TR-INP-007. */
  cameraToggle: boolean;

  /** Cancel / back action (menu exit). Pulse. */
  cancel: boolean;

  /** Navigate up in menus / UI lists. Pulse. */
  navUp: boolean;

  /** Navigate down in menus / UI lists. Pulse. */
  navDown: boolean;
}

/**
 * Namespace containing the zero-state constant for InputState.
 *
 * The singleton is created once at module load and reused every tick
 * for zero-allocation paths (tab blur, GSM transition blocking, initial state).
 * Never mutate this value — treat as readonly.
 */
export namespace InputState {
  /**
   * All-neutral / all-false InputState.
   *
   * Use cases:
   * - Initial state before first poll
   * - Tab blur zeroing (all outputs return to neutral)
   * - GSM transition blocking (prevent inputs crossing state boundaries)
   */
  export const ZERO: InputState = {
    steer: 0,
    throttle: 0,
    brake: 0,
    gearDelta: 0,
    confirm: false,
    pauseToggle: false,
    cameraToggle: false,
    cancel: false,
    navUp: false,
    navDown: false,
  };
}

/**
 * Input abstraction — player hardware input provider.
 *
 * Implementations wrap Babylon.js DeviceSourceManager (keyboard) and
 * GamepadManager (gamepad), polling each fixed timestep tick and merging
 * into a single normalized InputState.
 *
 * **This interface is for player input only.**
 * AI Driver has its own dedicated pipeline slot (#3) and produces InputState
 * via IAIDriver.tick(), never implementing IInput. Physics reads from a
 * unified input buffer map, never branching on player vs AI origin.
 *
 * @remarks
 * - `init()` requires an Engine reference (DeviceSourceManager constructor needs it)
 * - `dispose()` must clean up DSM, GamepadManager, and Event Bus subscriptions
 * - `getState()` is called exactly once per fixed timestep tick (pipeline slot #1)
 * - `onDeviceChanged` fires on device switch for HUD hint updates
 */
export interface IInput {
  /**
   * Initialize input systems with the game engine.
   *
   * Creates and configures DeviceSourceManager (keyboard) and GamepadManager
   * (gamepad). Must be called once before any getState() calls.
   *
   * @param engine - Babylon.js Engine instance (required by DeviceSourceManager)
   */
  init(engine: Engine): void;

  /**
   * Dispose all input resources.
   *
   * Tears down DeviceSourceManager, GamepadManager, and any
   * Event Bus or window event subscriptions registered during init().
   * Safe to call multiple times (idempotent in well-behaved implementations).
   */
  dispose(): void;

  /**
   * Returns the current tick's normalized input state.
   *
   * Polling sequence (per ADR-0006 Section: Polling Detail):
   * 1. Tab blurred → return InputState.ZERO immediately
   * 2. Read keyboard DSM: WASD → binary steer (-1/0/+1), binary throttle (0/1),
   *    binary brake (0/1), digital pulses for confirm/pause/camera/cancel/nav
   * 3. Read gamepad: leftStick.x → steer, rightTrigger → throttle,
   *    leftTrigger → brake (all after dead zone)
   * 4. Gamepad takes priority when both are active (analog override)
   * 5. Apply dead zone formula to all analog inputs (see Story 002)
   * 6. Detect pulse edges for digital buttons
   * 7. Return complete InputState
   *
   * Called exactly once per fixed timestep tick (pipeline slot #1).
   */
  getState(): InputState;

  /**
   * Observable firing when the last active device changes.
   *
   * Payload is the new device type (`"keyboard"` or `"gamepad"`):
   * - Fires once on keyboard → gamepad switch (when gamepad input is first detected)
   * - Fires once on gamepad → keyboard switch (when keyboard input is first detected
   *   after last gamepad input)
   *
   * Used by HUD to update input hints (e.g., show "Press Space" vs "Press A").
   */
  onDeviceChanged: Observable<DeviceType>;
}
