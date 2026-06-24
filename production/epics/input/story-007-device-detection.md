# Story 007: Device Detection + onDeviceChanged Observable

> **Epic**: Input
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/input.md`
**Requirement**: `TR-INP-008` — `onDeviceChanged` observable — fires once per device switch (keyboard→gamepad or vice versa) for HUD hints.

**ADR Governing Implementation**: ADR-0006: Input Abstraction
**ADR Decision Summary**: Track `lastActiveDevice: DeviceType`. On keyboard input (any key above dead zone) → switch to "keyboard". On gamepad input (any analog above dead zone or button press) → switch to "gamepad". Fire observable on actual change only. Integration point for HUD system to display context-sensitive controls.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Uses `Observable<DeviceType>` from `@babylonjs/core/Misc/observable`. The `onDeviceChanged` observable is defined on the `IInput` interface (Story 001). This story wires it.

**Control Manifest Rules (this layer)**:

- Required (C12): Input — polling per tick — device detection is part of the per-tick polling logic.
- Performance (F-G3): Slot 1 (Input) < 0.01ms per tick — device detection is a single string comparison + optional observable notify.

---

## Acceptance Criteria

_From GDD `design/gdd/input.md`, scoped to this story:_

- [ ] **AC-1**: Tracks `lastActiveDevice: DeviceType` — keyboard key press → `"keyboard"`; gamepad analog above dead zone or gamepad button press → `"gamepad"`
- [ ] **AC-2**: `onDeviceChanged` observable fires exactly once on switch, not every tick — repeated same-device input does not re-fire
- [ ] **AC-3**: No penalty for switching mid-race — observable fires, but steer/throttle/brake values continue uninterrupted (both devices remain readable simultaneously)
- [ ] **AC-4**: If keyboard and gamepad are both active, the last device that sent **meaningful** input (above dead zone for analog, any press for digital) is tracked as active

---

## Implementation Notes

_Derived from ADR-0006 Implementation Guidelines:_

1. **Detection logic in getState()**: After reading both keyboard and gamepad, determine active device:

   ```typescript
   private determineActiveDevice(keyboardInput: boolean, gamepadAnalog: boolean): void {
     const newDevice: DeviceType =
       gamepadAnalog ? "gamepad" :
       keyboardInput ? "keyboard" :
       this.lastActiveDevice; // no change

     if (newDevice !== this.lastActiveDevice) {
       this.lastActiveDevice = newDevice;
       this.onDeviceChanged.notifyObservers(newDevice);
     }
   }
   ```

2. **"Meaningful input" definition**:
   - **Gamepad analog**: `Math.abs(leftStick.x) > deadZone` OR `rightTrigger > deadZone` OR `leftTrigger > deadZone`
   - **Gamepad digital**: any button press (A, B, Start, Y, shoulder, D-pad)
   - **Keyboard**: any key press (not just WASD — any DSM-reported key event)
   - Sub-threshold gamepad noise (stick drift below dead zone) does NOT trigger a switch

3. **No penalty guarantee**: The observable fires _after_ the input is read and merged. The `getState()` return value is unaffected by the device switch notification. Both keyboard and gamepad are read every tick regardless of active device — switching only changes which is used for UI hint context.

4. **HUD integration point**: Downstream systems (HUD, Menu) subscribe to `onDeviceChanged` to update control hints. The contract:

   ```typescript
   input.onDeviceChanged.add((device: DeviceType) => {
     // Update displayed key bindings / button prompts
   });
   ```

   **Definition of Done note**: The observable contract and HUD integration point must be documented in the source code and referenced in the HUD epic story. This is verified during code review.

5. **Gamepad connect/disconnect also fires**: The `onGamepadConnectedObservable` handler (Story 004) already fires `onDeviceChanged.notifyObservers("gamepad")`. The detection here fills the keyboard→gamepad direction (and covers gamepad input after connection).

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 003 (PlayerInput)**: Core polling loop — device detection is a refinement layer on top
- **Story 004 (Focus/Disconnect)**: Fires `onDeviceChanged` on gamepad connect/disconnect — this story covers per-tick device tracking
- **HUD system (Feature layer)**: Consumes `onDeviceChanged` for UI hints — not implemented here
- **Menu system**: Consumes device detection for control scheme display

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Integration story — automated test specs:**

- **AC-1**: lastActiveDevice tracks last meaningful input
  - Given: only keyboard input
  - When: key 'w' is pressed
  - Then: `lastActiveDevice === "keyboard"`
  - Given: only gamepad input with `leftStick.x = 0.6` (above dead zone)
  - Then: `lastActiveDevice === "gamepad"`
  - Given: gamepad sub-threshold input (`leftStick.x = 0.05`, below 0.15 dead zone)
  - Then: `lastActiveDevice` unchanged (no switch)
  - Edge cases: no input at all → `lastActiveDevice` remains at initial default (`"keyboard"`)

- **AC-2**: onDeviceChanged fires once on switch, not each tick
  - Given: observer spy on `onDeviceChanged`
  - When: keyboard input occurs (device switch from default)
  - Then: observer call count === 1
  - When: keyboard input continues for 10 ticks
  - Then: observer call count === 1 (no additional fires)
  - When: gamepad input occurs
  - Then: observer call count === 2 (keyboard→gamepad switch)
  - Edge cases: rapid alternating keyboard/gamepad input → fires each switch, not each tick

- **AC-3**: no penalty for switching mid-race
  - Given: gamepad `steer = 0.5`
  - When: keyboard key 'w' pressed (triggers device switch)
  - Then: `getState().steer ≈ 0.5` (gamepad still providing analog — not interrupted)
  - And: observer fired with DeviceType change
  - Edge cases: switch during dead-zone-zeroed input → switch still occurs (keyboard key is meaningful)

- **AC-4**: last active device tracked with meaningful input only
  - Given: both keyboard and gamepad active
  - When: keyboard input sent
  - Then: `lastActiveDevice === "keyboard"`
  - When: gamepad input above threshold sent
  - Then: `lastActiveDevice === "gamepad"`
  - When: gamepad sub-threshold noise sent
  - Then: `lastActiveDevice === "gamepad"` (unchanged)
  - Edge cases: keyboard caps lock press (non-game key) → still counts as keyboard input

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:

- Tests: `tests/integration/input/device-detection.test.ts` — must exist and pass
- Mocked observable + spy for fire count verification
- Combined keyboard + gamepad input scenarios

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (PlayerInput polling loop; this story adds device tracking to it)
- Unlocks: HUD/Hints system (Feature layer)
