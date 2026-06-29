/**
 * @fileoverview PlayerInput — concrete implementation of IInput.
 *
 * GDD Requirement: TR-INP-002 — DeviceSourceManager for keyboard, GamepadManager
 *   for gamepad — polled each tick and merged into single InputState.
 * GDD Requirement: TR-INP-004 — Gamepad analog overrides keyboard binary for
 *   steer/throttle/brake when both active; keyboard digital always active.
 *
 * Governing ADR: ADR-0006 (Input Abstraction)
 *   - Decision: Input owns DSM (keyboard) + GamepadManager (gamepad). Every tick
 *     getState() polls both and merges into InputState.
 *   - Polling detail: keyboard → binary steer, throttle, brake; gamepad → analog
 *     override; dead zone applies; pulse edges for digital.
 * Control Manifest:
 *   C12 — Polling per tick (getState reads current hardware state)
 *   C14 — Tab blur zeros all outputs (hidden flag check)
 *   C15 — getState reads player input only
 *   C-F6 — Never branch Physics on player vs AI input
 *   C-F9 — Never read Input on scene.onBeforeRenderObservable
 *   F-G3 — Slot 1 < 0.01ms per tick
 *
 * DEV-IATION: Some keycode interpretations. The design doc's table maps
 *   Q → gearDelta=-1 but the QA test expectations show Q → gearDelta=+1.
 *   Following AC-10 (tested behavior): Q = gear up (+1), E = gear down (-1),
 *   matching the gamepad RShoulder = gearUp, LShoulder = gearDown semantics.
 *
 * Zero-allocation: Reuses a single InputState instance across ticks,
 *   mutated in place and returned by reference.
 */

import { DeviceType as BabylonDeviceType } from "@babylonjs/core/DeviceInput/InputDevices/deviceEnums";
import { DeviceSourceManager } from "@babylonjs/core/DeviceInput/InputDevices/deviceSourceManager";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Gamepad } from "@babylonjs/core/Gamepads/gamepad";
import { GamepadManager } from "@babylonjs/core/Gamepads/gamepadManager";
import { Observable } from "@babylonjs/core/Misc/observable";
import { applyDeadZone } from "./dead-zone";
import { type DeviceType, type IInput, InputState } from "./IInput";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default dead zone threshold for all analog axes. */
const DEFAULT_DEAD_ZONE = 0.15;

// Keyboard keycode constants (from DOM KeyboardEvent.keyCode)
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

// Standard Gamepad API button indices
const GP_BUTTON_A = 0;
const GP_BUTTON_B = 1;
const GP_BUTTON_Y = 3;
const GP_BUTTON_L_SHOULDER = 4;
const GP_BUTTON_R_SHOULDER = 5;
const GP_BUTTON_L_TRIGGER = 6;
const GP_BUTTON_R_TRIGGER = 7;
const GP_BUTTON_START = 9;
const GP_BUTTON_DPAD_UP = 12;
const GP_BUTTON_DPAD_DOWN = 13;

// Standard Gamepad API axis index
const GP_AXIS_LEFT_STICK_X = 0;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * Raw (pre-edge-detection) state for all pulse-based digital inputs.
 * Accumulated via OR from both keyboard and gamepad each tick.
 */
interface DigitalRawState {
  confirm: boolean;
  pauseToggle: boolean;
  cameraToggle: boolean;
  cancel: boolean;
  navUp: boolean;
  navDown: boolean;
  gearUp: boolean;
  gearDown: boolean;
}

// ---------------------------------------------------------------------------
// PlayerInput implementation
// ---------------------------------------------------------------------------

export class PlayerInput implements IInput {
  // -- Dependencies (lazy-init via init()) ----------------------------------
  private _dsm: DeviceSourceManager | null = null;
  private _gamepadManager: GamepadManager | null = null;
  private _activeGamepad: Gamepad | null = null;
  private _hidden = false;
  private _transitionBlocking = false;
  private _deadZoneThreshold = DEFAULT_DEAD_ZONE;
  private _lastActiveDevice: DeviceType = "keyboard";

  /** Reusable mutable InputState — mutated in place, zero allocation. */
  private _currentState: InputState = {
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

  /** Raw hardware digital state accumulated this tick (keyboard OR gamepad). */
  private _rawDigital: DigitalRawState = {
    confirm: false,
    pauseToggle: false,
    cameraToggle: false,
    cancel: false,
    navUp: false,
    navDown: false,
    gearUp: false,
    gearDown: false,
  };

  /** Previous tick's raw digital state — used for pulse edge detection. */
  private _prevDigital: DigitalRawState = {
    confirm: false,
    pauseToggle: false,
    cameraToggle: false,
    cancel: false,
    navUp: false,
    navDown: false,
    gearUp: false,
    gearDown: false,
  };

  // -- IInput interface -----------------------------------------------------

  /** @inheritdoc */
  readonly onDeviceChanged = new Observable<DeviceType>();

  /** @inheritdoc */
  init(engine: Engine): void {
    // Guard: if already initialised, dispose first to avoid leaking resources
    if (this._dsm) {
      this.dispose();
    }

    this._dsm = new DeviceSourceManager(engine);
    this._gamepadManager = new GamepadManager();

    // Wire gamepad connect/disconnect observables
    this._gamepadManager.onGamepadConnectedObservable.add((gp: Gamepad) => {
      this._activeGamepad = gp;
      this._lastActiveDevice = "gamepad";
      this.onDeviceChanged.notifyObservers("gamepad");
    });

    this._gamepadManager.onGamepadDisconnectedObservable.add(() => {
      this._activeGamepad = null;
      // keyboard remains active — no device changed event since keyboard is still usable
    });

    // NOTE: Config integration for input.deadZone is deferred until the Data &
    // Config Manager (Story DCM) is available. For now the default 0.15 applies.
    // HMR live-update of dead zone is also deferred (Integration/Polish phase).
  }

  /** @inheritdoc */
  dispose(): void {
    this._dsm?.dispose();
    this._dsm = null;
    this._gamepadManager?.dispose();
    this._gamepadManager = null;
    this._activeGamepad = null;
    this.onDeviceChanged.clear();
    this._fullReset();
  }

  /** @inheritdoc */
  getState(): InputState {
    // 0. GSM transition blocking → return all-zeros singleton
    //     Prevents stale inputs crossing state boundaries (Menu → PreRace, etc.)
    if (this._transitionBlocking) {
      return InputState.ZERO;
    }

    // 1. Tab blur / hidden → return all-zeros (no stuck keys on focus loss)
    if (this._hidden) {
      this._resetOutputState();
      return this._currentState;
    }

    // Reset per-tick accumulators
    this._resetOutputState();
    this._resetRawDigital();

    // 2. Read keyboard via DSM
    this._readKeyboard();

    // 3. Read gamepad via GamepadManager
    this._readGamepad();

    // 4. Gamepad analog override already applied in _readGamepad —
    //    it overwrites _currentState.steer/throttle/brake from keyboard binary values.

    // 5. Apply dead zone to all analog inputs
    this._currentState.steer = applyDeadZone(
      this._currentState.steer,
      this._deadZoneThreshold
    );
    this._currentState.throttle = applyDeadZone(
      this._currentState.throttle,
      this._deadZoneThreshold
    );
    this._currentState.brake = applyDeadZone(
      this._currentState.brake,
      this._deadZoneThreshold
    );

    // 6. Pulse edge detection for digital fields
    this._detectEdges();

    return this._currentState;
  }

  // -- Public helpers (for wiring by parent stories) ------------------------

  /**
   * Returns the last active device type.
   * Used by Story 007 for onDeviceChanged observable detection.
   */
  getLastActiveDevice(): DeviceType {
    return this._lastActiveDevice;
  }

  /**
   * Set whether the window/tab is hidden (tab blur detection).
   * Called by Story 004 (Focus/Disconnect) when blur/focus/visibility fires.
   */
  setHidden(hidden: boolean): void {
    this._hidden = hidden;
  }

  /**
   * Set whether GSM transition is active (input blocking).
   * Called by Story 005 (GSM State Integration) when transition starts/ends.
   */
  setTransitionBlocking(blocking: boolean): void {
    this._transitionBlocking = blocking;
  }

  /**
   * Override the dead zone threshold (for config integration).
   */
  setDeadZoneThreshold(threshold: number): void {
    this._deadZoneThreshold = threshold;
  }

  // -- Private helpers ------------------------------------------------------

  /** Reset the mutable output state to neutral/zero/false. */
  private _resetOutputState(): void {
    this._currentState.steer = 0;
    this._currentState.throttle = 0;
    this._currentState.brake = 0;
    this._currentState.gearDelta = 0;
    this._currentState.confirm = false;
    this._currentState.pauseToggle = false;
    this._currentState.cameraToggle = false;
    this._currentState.cancel = false;
    this._currentState.navUp = false;
    this._currentState.navDown = false;
  }

  /** Reset raw digital accumulator for a new tick. */
  private _resetRawDigital(): void {
    this._rawDigital.confirm = false;
    this._rawDigital.pauseToggle = false;
    this._rawDigital.cameraToggle = false;
    this._rawDigital.cancel = false;
    this._rawDigital.navUp = false;
    this._rawDigital.navDown = false;
    this._rawDigital.gearUp = false;
    this._rawDigital.gearDown = false;
  }

  /** Full reset (used by dispose). */
  private _fullReset(): void {
    this._resetOutputState();
    this._resetRawDigital();
    this._prevDigital = { ...this._rawDigital };
    this._lastActiveDevice = "keyboard";
  }

  // -- Keyboard reading -----------------------------------------------------

  /**
   * Read keyboard state via DeviceSourceManager.
   *
   * Mappings:
   *   W → throttle=1, A → steer=-1, S → brake=1, D → steer=+1
   *   Q → gearUp (+1), E → gearDown (-1)
   *   Space → confirm, Escape → pauseToggle, C → cameraToggle
   *   Backspace → cancel, ArrowUp → navUp, ArrowDown → navDown
   */
  private _readKeyboard(): void {
    const dsm = this._dsm;
    if (!dsm) return;

    const kbSource = dsm.getDeviceSource(BabylonDeviceType.Keyboard);
    if (!kbSource) return;

    // Helper: returns true if the given keycode is currently pressed (value === 1)
    const isPressed = (code: number): boolean => kbSource.getInput(code) === 1;

    // --- Binary analog equivalents ---

    // WASD → steer (-1/0/+1)
    const aPressed = isPressed(KEY_A);
    const dPressed = isPressed(KEY_D);
    if (aPressed && !dPressed) {
      this._currentState.steer = -1;
    } else if (dPressed && !aPressed) {
      this._currentState.steer = 1;
    }
    // else both/neither → 0 (already reset)

    // W/S → binary throttle/brake (0 or 1)
    if (isPressed(KEY_W)) {
      this._currentState.throttle = 1;
    }
    if (isPressed(KEY_S)) {
      this._currentState.brake = 1;
    }

    // --- Raw digital state (accumulated for edge detection) ---

    this._rawDigital.gearUp = this._rawDigital.gearUp || isPressed(KEY_Q);
    this._rawDigital.gearDown = this._rawDigital.gearDown || isPressed(KEY_E);
    this._rawDigital.confirm = this._rawDigital.confirm || isPressed(KEY_SPACE);
    this._rawDigital.pauseToggle =
      this._rawDigital.pauseToggle || isPressed(KEY_ESCAPE);
    this._rawDigital.cameraToggle =
      this._rawDigital.cameraToggle || isPressed(KEY_C);
    this._rawDigital.cancel =
      this._rawDigital.cancel || isPressed(KEY_BACKSPACE);
    this._rawDigital.navUp = this._rawDigital.navUp || isPressed(KEY_ARROW_UP);
    this._rawDigital.navDown =
      this._rawDigital.navDown || isPressed(KEY_ARROW_DOWN);

    // Track device activity
    if (aPressed || dPressed || isPressed(KEY_W) || isPressed(KEY_S)) {
      this._lastActiveDevice = "keyboard";
    }
  }

  // -- Gamepad reading ------------------------------------------------------

  /**
   * Read gamepad state via GamepadManager (standard Gamepad API).
   *
   * Mappings:
   *   leftStick.x (axes[0]) → steer
   *   rightTrigger (buttons[7].value) → throttle
   *   leftTrigger (buttons[6].value) → brake
   *   RShoulder (buttons[5].pressed) → gearUp
   *   LShoulder (buttons[4].pressed) → gearDown
   *   A (buttons[0].pressed) → confirm
   *   Start (buttons[9].pressed) → pauseToggle
   *   Y (buttons[3].pressed) → cameraToggle
   *   B (buttons[1].pressed) → cancel
   *   D-padUp (buttons[12].pressed) → navUp
   *   D-padDown (buttons[13].pressed) → navDown
   *
   * Gamepad analog overrides keyboard binary for steer/throttle/brake.
   * Keyboard digital fields remain active (OR'd with gamepad).
   */
  private _readGamepad(): void {
    const gp = this._activeGamepad;
    if (!gp) return;

    // Access the browser Gamepad API object via Babylon's wrapper.
    // This is a public property on the Babylon Gamepad class.
    const browserGamepad = (
      gp as unknown as { browserGamepad: globalThis.Gamepad }
    ).browserGamepad;
    if (!browserGamepad) return;

    const axes = browserGamepad.axes;
    const buttons = browserGamepad.buttons;

    if (!axes || !buttons) return;

    // --- Analog axes (override keyboard binary) ---

    const steerRaw = axes[GP_AXIS_LEFT_STICK_X] ?? 0;
    // Dead zone is applied later in getState() for all analog values
    if (steerRaw !== 0) {
      this._currentState.steer = steerRaw;
    }

    const throttleRaw = buttons[GP_BUTTON_R_TRIGGER]?.value ?? 0;
    if (throttleRaw > 0) {
      this._currentState.throttle = throttleRaw;
    }

    const brakeRaw = buttons[GP_BUTTON_L_TRIGGER]?.value ?? 0;
    if (brakeRaw > 0) {
      this._currentState.brake = brakeRaw;
    }

    // --- Digital buttons (OR'd with keyboard) ---

    const isPressed = (idx: number): boolean => buttons[idx]?.pressed ?? false;

    this._rawDigital.gearUp =
      this._rawDigital.gearUp || isPressed(GP_BUTTON_R_SHOULDER);
    this._rawDigital.gearDown =
      this._rawDigital.gearDown || isPressed(GP_BUTTON_L_SHOULDER);
    this._rawDigital.confirm =
      this._rawDigital.confirm || isPressed(GP_BUTTON_A);
    this._rawDigital.pauseToggle =
      this._rawDigital.pauseToggle || isPressed(GP_BUTTON_START);
    this._rawDigital.cameraToggle =
      this._rawDigital.cameraToggle || isPressed(GP_BUTTON_Y);
    this._rawDigital.cancel = this._rawDigital.cancel || isPressed(GP_BUTTON_B);
    this._rawDigital.navUp =
      this._rawDigital.navUp || isPressed(GP_BUTTON_DPAD_UP);
    this._rawDigital.navDown =
      this._rawDigital.navDown || isPressed(GP_BUTTON_DPAD_DOWN);

    // Detect any gamepad activity for device-switch tracking
    const hasAnalogInput =
      Math.abs(steerRaw) > 0.1 || throttleRaw > 0.1 || brakeRaw > 0.1;
    const hasDigitalInput =
      isPressed(GP_BUTTON_A) ||
      isPressed(GP_BUTTON_START) ||
      isPressed(GP_BUTTON_Y) ||
      isPressed(GP_BUTTON_B) ||
      isPressed(GP_BUTTON_DPAD_UP) ||
      isPressed(GP_BUTTON_DPAD_DOWN) ||
      isPressed(GP_BUTTON_R_SHOULDER) ||
      isPressed(GP_BUTTON_L_SHOULDER);

    if (hasAnalogInput || hasDigitalInput) {
      this._lastActiveDevice = "gamepad";
    }
  }

  // -- Edge detection -------------------------------------------------------

  /**
   * Detect pulse edges for all digital fields.
   *
   * A boolean field is true in the output ONLY if it is true in the current
   * raw hardware state AND was false in the previous tick. This guarantees
   * each press produces exactly one tick of output (no repeats on hold).
   *
   * gearDelta follows the same pulse logic but outputs -1/0/+1 instead of
   * true/false.
   */
  private _detectEdges(): void {
    const raw = this._rawDigital;
    const prev = this._prevDigital;

    // Boolean pulse fields
    this._currentState.confirm = raw.confirm && !prev.confirm;
    this._currentState.pauseToggle = raw.pauseToggle && !prev.pauseToggle;
    this._currentState.cameraToggle = raw.cameraToggle && !prev.cameraToggle;
    this._currentState.cancel = raw.cancel && !prev.cancel;
    this._currentState.navUp = raw.navUp && !prev.navUp;
    this._currentState.navDown = raw.navDown && !prev.navDown;

    // Gear delta: dual-direction pulse
    const gearUpPulse = raw.gearUp && !prev.gearUp;
    const gearDownPulse = raw.gearDown && !prev.gearDown;

    if (gearUpPulse && !gearDownPulse) {
      this._currentState.gearDelta = 1;
    } else if (gearDownPulse && !gearUpPulse) {
      this._currentState.gearDelta = -1;
    }
    // else both or neither → 0 (already reset)

    // Persist current raw state as previous for next tick's edge detection
    this._prevDigital.confirm = raw.confirm;
    this._prevDigital.pauseToggle = raw.pauseToggle;
    this._prevDigital.cameraToggle = raw.cameraToggle;
    this._prevDigital.cancel = raw.cancel;
    this._prevDigital.navUp = raw.navUp;
    this._prevDigital.navDown = raw.navDown;
    this._prevDigital.gearUp = raw.gearUp;
    this._prevDigital.gearDown = raw.gearDown;
  }
}
