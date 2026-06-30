/**
 * @fileoverview PlayerInput — concrete implementation of IInput.
 *
 * GDD Requirement: TR-INP-002 — DeviceSourceManager for keyboard, GamepadManager
 *   for gamepad — polled each tick and merged into single InputState.
 * GDD Requirement: TR-INP-004 — Gamepad analog overrides keyboard binary for
 *   steer/throttle/brake when both active; keyboard digital always active.
 * GDD Requirement: TR-INP-005 — Focus loss zeros all outputs immediately;
 *   focus return resumes live hardware state (no replay).
 * GDD Requirement: TR-INP-008 — onDeviceChanged observable fires once per
 *   device switch (keyboard→gamepad or vice versa) for HUD hints.
 * GDD Requirement: TR-INP-009 — Gamepad disconnect → activeGamepad set to null;
 *   getState() returns zeroed axes; keyboard remains active.
 *
 * Governing ADR: ADR-0006 (Input Abstraction)
 *   - Decision: Input owns DSM (keyboard) + GamepadManager (gamepad). Every tick
 *     getState() polls both and merges into InputState.
 *   - Polling detail: keyboard → binary steer, throttle, brake; gamepad → analog
 *     override; dead zone applies; pulse edges for digital.
 *   - Focus Loss Handling: dual detection (blur + visibilitychange) via AbortController.
 *   - Gamepad State Management: onGamepadDisconnectedObservable zeros activeGamepad;
 *     disconnected browserGamepad check hardens timing window.
 * Control Manifest:
 *   C12 — Polling per tick (getState reads current hardware state)
 *   C14 — Tab blur zeros all outputs (hidden flag check → InputState.ZERO)
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
 *   mutated in place and returned by reference. Hidden/blur path returns
 *   InputState.ZERO singleton directly (no mutation, zero allocation).
 */

import { DeviceType as BabylonDeviceType } from "@babylonjs/core/DeviceInput/InputDevices/deviceEnums";
import { DeviceSourceManager } from "@babylonjs/core/DeviceInput/InputDevices/deviceSourceManager";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Gamepad } from "@babylonjs/core/Gamepads/gamepad";
import { GamepadManager } from "@babylonjs/core/Gamepads/gamepadManager";
import { Observable } from "@babylonjs/core/Misc/observable";
import type { IEventBus, Subscription } from "@/foundation/event-bus/types";
import type { GameStateMachine } from "@/foundation/gsm/GameStateMachine";
import type { State } from "@/foundation/gsm/types";
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

  /** AbortController for tab blur/focus event listener lifecycle management. */
  private _blurController: AbortController | null = null;

  /** GSM transition blocking flag — when true, getState() returns InputState.ZERO. */
  private _transitionBlocking = false;
  private _deadZoneThreshold = DEFAULT_DEAD_ZONE;
  private _lastActiveDevice: DeviceType = "keyboard";

  /**
   * Per-tick flag: was any keyboard key pressed this frame?
   * Used by _determineActiveDevice() for device tracking (TR-INP-008).
   * Reset to false at the start of each getState() call.
   */
  private _hadKeyboardInput = false;

  /**
   * Per-tick flag: was any meaningful gamepad input detected this frame?
   * Used by _determineActiveDevice() for device tracking (TR-INP-008).
   * Reset to false at the start of each getState() call.
   */
  private _hadGamepadInput = false;

  // -- Injected dependencies (GSM state integration — Story 005) ------------
  /** Event Bus — subscribed to gsm.state.exited/entered during init(). */
  private _eventBus: IEventBus | null = null;

  /** Game State Machine — used to initiate pauseToggle transitions. */
  private _gsm: GameStateMachine | null = null;

  /** Active Event Bus subscriptions — cleaned up in dispose(). */
  private _gsmSubscriptions: Subscription[] = [];

  /**
   * Current GSM state — maintained from gsm.state.entered payload (to field).
   * NEVER call gsm.getCurrentState() (rule F-F5 / F23).
   * Initialized to "Loading" matching GSM's bootstrap state.
   */
  private _gsmCurrentState: State = "Loading";

  /**
   * Create a new PlayerInput instance.
   *
   * @param eventBus - Optional Event Bus for GSM state integration.
   *   If provided, subscribes to gsm.state.exited/entered during init().
   * @param gsm - Optional Game State Machine for pauseToggle transitions.
   *   If provided, pauseToggle and confirm (PreRace) route through gsm.transition().
   */
  constructor(eventBus?: IEventBus | null, gsm?: GameStateMachine | null) {
    this._eventBus = eventBus ?? null;
    this._gsm = gsm ?? null;
  }

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

  /**
   * Timestamp of the last camera toggle pulse (from performance.now()).
   * Used for debounce gating: rapid presses within the debounce window
   * produce a single toggle (GDD TR-INP-007).
   * Initialized to -Infinity to guarantee first press always passes debounce gate.
   */
  private _lastCameraToggleTime = -Infinity;

  /**
   * Camera toggle debounce window in milliseconds.
   * Configurable via input.cameraDebounce (default 200ms).
   */
  private _cameraDebounce = 200;

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
    // GamepadManager.dispose() handles cleanup of these subscriptions
    this._gamepadManager.onGamepadConnectedObservable.add((gp: Gamepad) => {
      this._activeGamepad = gp;
      this._lastActiveDevice = "gamepad";
      this.onDeviceChanged.notifyObservers("gamepad");
    });

    this._gamepadManager.onGamepadDisconnectedObservable.add(() => {
      this._activeGamepad = null;
      // keyboard remains active — no device changed event since keyboard is still usable
    });

    // Tab blur / focus detection (Story 004 — Focus/Disconnect Safety)
    // Dual detection: blur covers OS-level focus loss (alt-tab), visibilitychange
    // covers tab switch without OS focus change (multi-monitor).
    this._blurController = new AbortController();
    const { signal } = this._blurController;

    window.addEventListener(
      "blur",
      () => {
        this._hidden = true;
      },
      { signal }
    );
    window.addEventListener(
      "focus",
      () => {
        this._hidden = false;
      },
      { signal }
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        this._hidden = document.hidden;
      },
      { signal }
    );

    // NOTE: Config integration for input.deadZone is deferred until the Data &
    // Config Manager (Story DCM) is available. For now the default 0.15 applies.
    // HMR live-update of dead zone is also deferred (Integration/Polish phase).

    // -- GSM State Integration (Story 005) ---------------------------------
    // Subscribe to GSM events when Event Bus is available.
    // The Event Bus may be absent in testing scenarios or before GSM init.
    if (this._eventBus) {
      this._gsmSubscriptions.push(
        this._eventBus.on("gsm.state.exited", () => {
          // Transition started — zero outputs immediately.
          // Prevents stale inputs crossing state boundaries.
          this._transitionBlocking = true;
        }),

        this._eventBus.on("gsm.state.entered", ({ to }) => {
          // Transition complete — resume live input.
          this._transitionBlocking = false;
          this._gsmCurrentState = to as State;

          // Flush stale cached digital state: set prevDigital to current raw
          // hardware state. This prevents stale pulse edges (e.g., a held menu
          // button) from triggering after the transition completes.
          this._prevDigital = { ...this._rawDigital };
        })
      );
    }
  }

  /** @inheritdoc */
  dispose(): void {
    this._dsm?.dispose();
    this._dsm = null;
    this._gamepadManager?.dispose();
    this._gamepadManager = null;
    this._activeGamepad = null;
    this._blurController?.abort();
    this._blurController = null;
    this.onDeviceChanged.clear();
    this._unsubscribeGsm();
    this._fullReset();
  }

  /** @inheritdoc */
  getState(): InputState {
    // 0. GSM transition blocking → return all-zeros singleton
    //     Prevents stale inputs crossing state boundaries (Menu → PreRace, etc.)
    if (this._transitionBlocking) {
      return InputState.ZERO;
    }

    // 1. Tab blur / hidden → return InputState.ZERO immediately
    if (this._hidden) {
      return InputState.ZERO;
    }

    // Reset per-tick accumulators
    this._resetOutputState();
    this._resetRawDigital();
    this._hadKeyboardInput = false;
    this._hadGamepadInput = false;

    // 2. Read keyboard via DSM
    this._readKeyboard();

    // 3. Read gamepad via GamepadManager
    this._readGamepad();

    // 4. Determine active device for onDeviceChanged (GDD TR-INP-008)
    //    After both keyboard and gamepad are read, check which device
    //    produced meaningful input this tick. Fire observable on switch.
    this._determineActiveDevice();

    // 5. Gamepad analog override already applied in _readGamepad —
    //    it overwrites _currentState.steer/throttle/brake from keyboard binary values.

    // 6. Apply dead zone to all analog inputs
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

    // 7. Pulse edge detection for digital fields
    this._detectEdges();

    // 7.5 Camera toggle debounce — gates cameraToggle through debounce timer
    //     GDD TR-INP-007: single pulse per press, press-and-hold does not cycle.
    //     performance.now() is permitted here — outside pipeline slot, no determinism requirement.
    this._applyCameraDebounce();

    // 8. Process pulse-based cross-system routing (pauseToggle, confirm)
    this._processPulse();

    // 9. Gate menu navigation — navUp, navDown, cancel only active in Menu state
    //    Prevents navigation inputs from leaking into gameplay states.
    if (this._gsmCurrentState !== "Menu") {
      this._currentState.navUp = false;
      this._currentState.navDown = false;
      this._currentState.cancel = false;
    }

    return this._currentState;
  }

  // -- Public helpers (for wiring by parent stories) ------------------------

  /**
   * Returns the last active device type.
   * Used by Story 007 for onDeviceChanged observable detection.
   *
   * @returns The device type that most recently produced input — "keyboard" or "gamepad".
   */
  getLastActiveDevice(): DeviceType {
    return this._lastActiveDevice;
  }

  /**
   * Set whether the window/tab is hidden (tab blur detection).
   * Called by Story 004 (Focus/Disconnect) when blur/focus/visibility fires.
   *
   * @internal Test/init wiring only — production state set by DOM events.
   * @param hidden - `true` when the tab loses focus; `false` when focus returns.
   */
  setHidden(hidden: boolean): void {
    this._hidden = hidden;
  }

  /**
   * Set whether GSM transition is active (input blocking).
   * Called by Story 005 (GSM State Integration) when transition starts/ends.
   *
   * @internal Test/init wiring only — production state set by Event Bus events.
   * @param blocking - `true` to zero all outputs during transition; `false` to resume normal polling.
   */
  setTransitionBlocking(blocking: boolean): void {
    this._transitionBlocking = blocking;
  }

  /**
   * Set the current GSM state (for testing/init wiring).
   * Called by Story 005 (GSM State Integration) and test scenarios.
   *
   * NOTE: In production, this is maintained from gsm.state.entered events.
   * This setter exists for testability and init wiring only.
   *
   * @param state - The GSM state to set as current.
   */
  setGsmCurrentState(state: State): void {
    this._gsmCurrentState = state;
  }

  /**
   * Override the dead zone threshold (for config integration).
   *
   * @param threshold - Dead zone threshold in range [0, 1). Values below this are clamped to 0.
   */
  setDeadZoneThreshold(threshold: number): void {
    this._deadZoneThreshold = threshold;
  }

  /**
   * Override the camera toggle debounce window (for config integration).
   *
   * GDD TR-INP-007: Camera toggle debounced at input.cameraDebounce ms.
   *   Single pulse per press — press-and-hold does not cycle.
   *
   * @param ms - Debounce window in milliseconds. 0 disables debounce (every press fires).
   */
  setCameraDebounce(ms: number): void {
    this._cameraDebounce = ms;
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
    this._gsmCurrentState = "Loading";
    this._lastCameraToggleTime = -Infinity;
  }

  /** Unsubscribe all GSM Event Bus subscriptions (used by dispose and re-init guard). */
  private _unsubscribeGsm(): void {
    for (const sub of this._gsmSubscriptions) {
      sub.unsubscribe();
    }
    this._gsmSubscriptions = [];
  }

  /**
   * Process pulse-based inputs that have cross-system routing.
   *
   * Called after edge detection in getState(). Routes:
   * - pauseToggle → gsm.transition() per _gsmCurrentState
   * - confirm    → gsm.transition() or eventBus.emit() per _gsmCurrentState
   *
   * @see TR-INP-006 — GSM state integration
   * @see ADR-0006 — GSM Transition Blocking
   */
  private _processPulse(): void {
    const pulse = this._currentState;

    // --- pauseToggle routing ---
    if (pulse.pauseToggle) {
      if (this._gsmCurrentState === "Racing") {
        // Racing → Paused
        this._gsm?.transition("Paused")?.catch((err: unknown) => {
          console.warn("[PlayerInput] Racing→Paused transition failed:", err);
        });
      } else if (this._gsmCurrentState === "Paused") {
        // Paused → Racing
        this._gsm?.transition("Racing")?.catch((err: unknown) => {
          console.warn("[PlayerInput] Paused→Racing transition failed:", err);
        });
      }
      // Other states → silently ignored (no stray transition)
    }

    // --- confirm routing ---
    if (pulse.confirm) {
      switch (this._gsmCurrentState) {
        case "PreRace":
          // Skip grid cinematic, start race
          this._gsm?.transition("Racing")?.catch((err: unknown) => {
            console.warn(
              "[PlayerInput] PreRace→Racing transition failed:",
              err
            );
          });
          break;

        case "Racing":
          // Pit Stop system gatekeeps: only acts when pitStopped (C49)
          this._eventBus?.emit("input.pit.depart", {});
          break;

        case "PostRace":
          // PostRace overlay consumes
          this._eventBus?.emit("input.confirm.postRace", {});
          break;

        case "Menu":
          // Menu layer consumes
          this._eventBus?.emit("input.confirm.menu", {});
          break;

        // Loading, Paused → silently ignored (pause owns Escape)
      }
    }
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

    const isPressed = (code: number): boolean => kbSource.getInput(code) === 1;

    this._readKeyboardAnalog(isPressed);
    this._readKeyboardDigital(isPressed);

    // GDD TR-INP-008: Any key press counts as meaningful keyboard input
    // for device detection — covers WASD, gear keys, pulses, and nav keys.
    this._hadKeyboardInput =
      this._hadKeyboardInput ||
      isPressed(KEY_W) ||
      isPressed(KEY_A) ||
      isPressed(KEY_S) ||
      isPressed(KEY_D) ||
      isPressed(KEY_Q) ||
      isPressed(KEY_E) ||
      isPressed(KEY_SPACE) ||
      isPressed(KEY_ESCAPE) ||
      isPressed(KEY_C) ||
      isPressed(KEY_BACKSPACE) ||
      isPressed(KEY_ARROW_UP) ||
      isPressed(KEY_ARROW_DOWN);
  }

  /** Read binary WASD → steer/throttle/brake and track keyboard activity. */
  private _readKeyboardAnalog(isPressed: (code: number) => boolean): void {
    const aPressed = isPressed(KEY_A);
    const dPressed = isPressed(KEY_D);

    // Opposing digital steering: A+D simultaneously → net zero (GDD edge case)
    if (aPressed && dPressed) {
      this._currentState.steer = 0;
    } else if (aPressed) {
      this._currentState.steer = -1;
    } else if (dPressed) {
      this._currentState.steer = 1;
    }

    if (isPressed(KEY_W)) {
      this._currentState.throttle = 1;
    }
    if (isPressed(KEY_S)) {
      this._currentState.brake = 1;
    }
  }

  /** Read digital keys → raw state for edge detection. */
  private _readKeyboardDigital(isPressed: (code: number) => boolean): void {
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

    const browserGamepad = (
      gp as unknown as { browserGamepad: globalThis.Gamepad }
    ).browserGamepad;
    if (!browserGamepad) return;

    if (!browserGamepad.connected) {
      this._activeGamepad = null;
      return;
    }

    const axes = browserGamepad.axes;
    const buttons = browserGamepad.buttons;
    if (!axes || !buttons) return;

    const steerRaw = this._readGamepadAnalog(axes, buttons);
    this._readGamepadDigital(buttons);
    this._updateGamepadDeviceActivity(steerRaw, buttons);
  }

  /** Read analog axes (steer/throttle/brake), overriding keyboard binary. */
  private _readGamepadAnalog(
    axes: readonly number[],
    buttons: readonly GamepadButton[]
  ): number {
    const steerRaw = axes[GP_AXIS_LEFT_STICK_X] ?? 0;
    if (Math.abs(steerRaw) > this._deadZoneThreshold) {
      this._currentState.steer = steerRaw;
    }

    const throttleRaw = buttons[GP_BUTTON_R_TRIGGER]?.value ?? 0;
    if (throttleRaw > this._deadZoneThreshold) {
      this._currentState.throttle = throttleRaw;
    }

    const brakeRaw = buttons[GP_BUTTON_L_TRIGGER]?.value ?? 0;
    if (brakeRaw > this._deadZoneThreshold) {
      this._currentState.brake = brakeRaw;
    }

    return steerRaw;
  }

  /** Read digital buttons → raw state for edge detection (OR'd with keyboard). */
  private _readGamepadDigital(buttons: readonly GamepadButton[]): void {
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
  }

  /**
   * Detect any gamepad activity for device-switch tracking.
   *
   * Sets _hadGamepadInput when meaningful gamepad input is detected:
   * - Analog (leftStick, triggers) above the dead zone threshold
   * - Any digital button press (A, B, Y, Start, shoulder, D-pad)
   *
   * Sub-threshold analog noise (stick drift below dead zone) does NOT trigger.
   * Uses _deadZoneThreshold so the gamepad detection threshold stays
   * consistent with the analog dead zone applied to outputs.
   */
  private _updateGamepadDeviceActivity(
    steerRaw: number,
    buttons: readonly GamepadButton[]
  ): void {
    const threshold = this._deadZoneThreshold;
    const isPressed = (idx: number): boolean => buttons[idx]?.pressed ?? false;

    const throttleRaw = buttons[GP_BUTTON_R_TRIGGER]?.value ?? 0;
    const brakeRaw = buttons[GP_BUTTON_L_TRIGGER]?.value ?? 0;

    const hasAnalogInput =
      Math.abs(steerRaw) > threshold ||
      throttleRaw > threshold ||
      brakeRaw > threshold;
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
      this._hadGamepadInput = true;
    }
  }

  // -- Device detection -----------------------------------------------------

  /**
   * Determine the last active device based on per-tick input flags.
   *
   * Called from getState() after both keyboard and gamepad are read.
   * Fires onDeviceChanged only when the device actually changes (not every tick).
   *
   * Priority: gamepad wins when both have input in the same tick
   * (racing game — gamepad is primary input device).
   *
   * GDD TR-INP-008: onDeviceChanged fires once per device switch.
   * ADR-0006: Detection logic — gamepad priority when both have input in same tick.
   * AC-2: Initial _lastActiveDevice is "keyboard" (from _fullReset). First keyboard
   *   input does not fire (no switch from default). First gamepad input fires once.
   */
  private _determineActiveDevice(): void {
    const newDevice: DeviceType = this._hadGamepadInput
      ? "gamepad"
      : this._hadKeyboardInput
        ? "keyboard"
        : this._lastActiveDevice; // no change

    if (newDevice !== this._lastActiveDevice) {
      this._lastActiveDevice = newDevice;
      this.onDeviceChanged.notifyObservers(newDevice);
    }
  }

  // -- Camera toggle debounce ------------------------------------------------

  /**
   * Gate cameraToggle through debounce timer.
   *
   * GDD TR-INP-007: Camera toggle debounced at input.cameraDebounce ms.
   *   Single pulse per press — press-and-hold does not cycle.
   *
   * Called after _detectEdges() in getState(). If the edge-detected
   * cameraToggle pulse is within the debounce window, it is suppressed.
   * If the window has elapsed, the pulse passes through and the timer
   * is reset to prevent further pulses until the window expires again.
   *
   * Uses performance.now() — permitted because this is outside the pipeline
   * slot's deterministic simulation path. No determinism requirement for UI timing.
   */
  private _applyCameraDebounce(): void {
    if (!this._currentState.cameraToggle) return;

    const now = performance.now();
    if (now - this._lastCameraToggleTime >= this._cameraDebounce) {
      // Window elapsed — allow toggle, reset timer
      this._lastCameraToggleTime = now;
    } else {
      // Within debounce window — suppress
      this._currentState.cameraToggle = false;
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
