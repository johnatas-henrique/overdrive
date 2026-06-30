# Story 003: PlayerInput — Keyboard + Gamepad Polling Loop

> **Epic**: Input
> **Status**: Complete
> **Last Updated**: 2026-06-29
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 10h

## Context

**GDD**: `design/gdd/input.md`
**Requirements**:

- `TR-INP-002` — DeviceSourceManager for keyboard, GamepadManager for gamepad — polled each tick and merged into single InputState
- `TR-INP-004` — Gamepad takes priority over keyboard for analog axes when both are active (analog override); keyboard binary inputs always active

**ADR Governing Implementation**: ADR-0006: Input Abstraction
**ADR Decision Summary**: Every tick, `getState()` polls DSM (keyboard) and GamepadManager (gamepad), merges into InputState. Gamepad analog overrides keyboard analog. Pulse edge detection for digital buttons. Full key mapping enumerated.

**Engine**: Babylon.js 9.12.0 | **Risk**: MEDIUM
**Engine Notes**: DeviceSourceManager for keyboard + device-type detection. GamepadManager for gamepad polling (native Gamepad API, avoids DSM v9.11 Linux detection issues). Post-cutoff note: DSM stable since v7.x, no breaking changes in 9.x. GamepadManager onGamepadDisconnectedObservable may fire late — mitigation via null check documented in ADR.

**Control Manifest Rules (this layer)**:

- Required (C12): Input — polling per tick — Physics needs current frame's values, not last event.
- Required (C14): Tab blur zeros all outputs — no stuck keys on focus loss. Resume live state on focus.
- Required (C15): `IInput.getState()` reads player input only — AI has separate pipeline slot #3.
- Forbidden (C-F9): Never read Input on `scene.onBeforeRenderObservable` — pipeline must own all input reads deterministically.
- Forbidden (C-F6): Never branch Physics on player vs AI input — Physics reads from unified `inputBuffer` map.
- Performance (F-G3): Slot 1 (Input) < 0.01ms per tick.

---

## Acceptance Criteria

_From GDD `design/gdd/input.md`, scoped to this story:_

- [ ] **AC-1**: `PlayerInput` class implements `IInput`
- [ ] **AC-2**: `init(engine)` constructs DeviceSourceManager (keyboard) and GamepadManager
- [ ] **AC-3**: `getState()` reads keyboard via DSM with mapped keys: WASD → steer (-1/0/+1), W/S → throttle/brake (0/1), Q/E → gearDelta (+1/-1), Space → confirm, Escape → pauseToggle, C → cameraToggle, Backspace → cancel, Arrows → navUp/navDown
- [ ] **AC-4**: `getState()` reads gamepad via GamepadManager with mapped controls: leftStick.x → steer, rightTrigger → throttle, leftTrigger → brake, RShoulder up → gearUp, RShoulder down → gearDown, A → confirm, Start → pauseToggle, Y → cameraToggle, B → cancel, D-pad → navUp/navDown
- [ ] **AC-5**: Gamepad analog values override keyboard binary for steer/throttle/brake when both active; keyboard still provides digital-only fields (confirm, pauseToggle, gearDelta, cameraToggle, cancel, nav)
- [ ] **AC-6**: Pulse edge detection — boolean fields (confirm, pauseToggle, cameraToggle, cancel, navUp, navDown) fire `true` for exactly one tick on press, not on hold
- [ ] **AC-7**: Steering axis reads -1..1 from gamepad left stick with dead zone applied (uses Story 002 formula)
- [ ] **AC-8**: Throttle and brake read 0..1 from triggers with dead zone applied
- [ ] **AC-9**: Keyboard WASD/arrows produce correct digital equivalents: steer binary (-1/0/+1), throttle binary (0/1), brake binary (0/1)
- [ ] **AC-10**: Gear up/down produce discrete +1/-1 pulses per press (not held)

---

## Implementation Notes

_Derived from ADR-0006 Implementation Guidelines:_

1. **File location**: `src/core/input/PlayerInput.ts` — concrete implementation of `IInput`.

2. **Constructor pattern**:

   ```typescript
   class PlayerInput implements IInput {
     private dsm: DeviceSourceManager;
     private gamepadManager: GamepadManager;
     private activeGamepad: Gamepad | null = null;
     private prevDigitalState: InputStateDigital; // for edge detection
     private lastActiveDevice: DeviceType = "keyboard";
     private hidden = false;
     private transitionBlocking = false;
     private currentState: GameState | null = null;
     // ... other private state
   }
   ```

3. **getState() polling order** (per ADR-0006):

   ```
   0. If transitionBlocking → return InputState.ZERO
   1. If hidden → return all-zeros (cached until focus returns)
   2. Read keyboard DSM: WASD → binary steer, W/S → throttle/brake, Q/E → gear, Space/Escape/C/Backspace/Arrows → digital
   3. Read gamepad: leftStick.x → steer, triggers → throttle/brake, shoulders → gear, face buttons → digital
   4. Gamepad takes priority for analog when both active
   5. Apply dead zone to all analog inputs (import applyDeadZone from Story 002)
   6. Detect pulse edges for digital buttons (compare against prevDigitalState)
   7. Return InputState
   ```

4. **Pulse edge detection**: Maintain a `prevDigitalState` record. A boolean field is `true` in the returned InputState only if it is `true` in current hardware AND was `false` in `prevDigitalState`. Update `prevDigitalState` after each tick.

5. **DSM keyboard reading**: Use `dsm.getInput(DeviceSourceType.Keyboard, keyCode)` — returns 0 (up) or 1 (down) for each key. Key mappings:
   - W (87) → throttle=1, A (65) → steer=-1, S (83) → brake=1, D (68) → steer=+1
   - Q (81) → gearDelta=+1 (gear up), E (69) → gearDelta=-1 (gear down)
   - Space (32) → confirm, Escape (27) → pauseToggle, C (67) → cameraToggle
   - Backspace (8) → cancel, ArrowUp (38) → navUp, ArrowDown (40) → navDown

6. **Gamepad reading**: Access via `gamepadManager.gamepads` array. Standard Gamepad API:
   - `leftStick.x` (axes[0]) → steer, `rightTrigger` (axes[5] or buttons[7]) → throttle, `leftTrigger` (axes[4] or buttons[6]) → brake
   - `RShoulder` (buttons[5]) → gearUp, `LShoulder` (buttons[4]) → gearDown
   - `A` (buttons[0]) → confirm, `Start` (buttons[9]) → pauseToggle, `Y` (buttons[3]) → cameraToggle
   - `B` (buttons[1]) → cancel, `D-padUp` (buttons[12]) → navUp, `D-padDown` (buttons[13]) → navDown

7. **Config integration for dead zone**: On `init()`, read `configManager.get('input.deadZone')` once and cache. Stories 002+003 own the formula; the config read is the integration seam. For HMR support, subscribe to config change events if the Data & Config Manager provides them (optional — deferred).

8. **Zero allocation**: Reuse a single `InputState` instance across ticks. Mutate in place and return it. Do not allocate a new object each tick.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 004 (Focus/Disconnect)**: Tab blur detection, gamepad connect/disconnect observers — this story uses but does not implement those handlers
- **Story 005 (GSM State)**: Event Bus subscription for GSM state — this story uses but does not implement transition blocking
- **Story 006 (Debounce)**: Camera toggle debounce, gear rate limiting — pulse detection is raw here; debounce refines it
- **Story 007 (Device Detection)**: `onDeviceChanged` observable wiring — this story tracks `lastActiveDevice` minimally; Story 007 owns the observable
- HMR live update of `input.deadZone` — deferred to E2E verification (Integration/Polish phase)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Integration story — automated test specs:**

- **AC-1**: PlayerInput implements IInput
  - Given: the `PlayerInput` class
  - When: instantiated
  - Then: type assertion confirms `implements IInput`
  - Edge cases: all IInput methods callable without error

- **AC-2**: init(engine) constructs DSM and GamepadManager
  - Given: a mocked `Engine` instance
  - When: `PlayerInput.init(engine)` is called
  - Then: DSM constructor was called with engine; GamepadManager constructor was called
  - Edge cases: calling `init()` twice re-creates both (no lingering references)

- **AC-3**: keyboard WASD produces correct steer values
  - Given: mocked DSM reporting key states
  - When: key 'd' is pressed (D)
  - Then: `getState().steer === 1`
  - When: key 'a' is pressed (A)
  - Then: `getState().steer === -1`
  - When: neither A nor D pressed
  - Then: `getState().steer === 0`
  - Edge cases: A+D simultaneously → `steer === 0` (handled in Story 006; raw level: both keys read, steer is last-write-wins in analog override path)

- **AC-4**: gamepad leftStick.x maps to steer
  - Given: mocked GamepadManager with active gamepad
  - When: `leftStick.x = 0.5`
  - Then: `getState().steer ≈ deadZoneApply(0.5, 0.15)`
  - Edge cases: `leftStick.x = 1.0` → `steer ≈ 1.0` (after dead zone)

- **AC-5**: gamepad overrides keyboard for analog
  - Given: keyboard D is pressed (steer=+1) AND gamepad `leftStick.x = -0.8`
  - Then: `getState().steer ≈ deadZoneApply(-0.8, 0.15)` (gamepad wins for analog)
  - And: `getState().confirm === true` (keyboard still provides digital)
  - Edge cases: gamepad disconnected → keyboard analog takes over

- **AC-6**: pulse edge detection fires true exactly once
  - Given: Space is pressed
  - When: first tick → `confirm === true`
  - When: second tick (Space still held) → `confirm === false`
  - Edge cases: repeated press-release at tick rate produces alternating pattern

- **AC-7**: steering with dead zone applied
  - Given: gamepad `leftStick.x = 0.1` (below default threshold 0.15)
  - Then: `getState().steer === 0`
  - Given: `leftStick.x = 0.5`
  - Then: `getState().steer ≈ 0.412`

- **AC-8**: throttle/brake with dead zone applied
  - Given: rightTrigger = 0.1 (below threshold)
  - Then: `getState().throttle === 0`
  - Given: rightTrigger = 0.5
  - Then: `getState().throttle ≈ 0.412`

- **AC-9**: keyboard produces binary digital equivalents
  - Given: key 'w' pressed
  - Then: `getState().throttle === 1`, `getState().brake === 0`
  - Given: key 's' pressed
  - Then: `getState().throttle === 0`, `getState().brake === 1`

- **AC-10**: gearDelta fires +1 once per press
  - Given: Q pressed (gear up)
  - When: tick 1 → `gearDelta === 1`
  - When: tick 2..10 (Q held) → `gearDelta === 0`
  - Edge cases: rapid Q-E-Q within one tick produces `gearDelta === 0` (cancel, handled in Story 006)

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:

- Tests: `tests/integration/input/player-input-polling.test.ts` — must exist and pass
- Mocked DeviceSourceManager and GamepadManager (`vi.mock` or factory wrappers per ADR-0006)
- Requires `// @vitest-environment happy-dom` for DOM/browser API access

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (IInput interface, InputState type), Story 002 (applyDeadZone function)
- Unlocks: Stories 004, 005, 006, 007

---

## Completion Notes

**Completed**: 2026-06-29
**Criteria**: 10/10 passing
**Deviations**: ADVISORY — ADR-0006 import path fix (documentation), Story 003 Q→gearDelta fix (documentation), file naming follows project convention (kebab-case)
**Test Evidence**: Integration test at `tests/integration/input/player-input-polling.test.ts` (66 tests, all passing, 100% coverage)
**Code Review**: Complete — APPROVED WITH SUGGESTIONS (babylonjs-specialist + qa-tester + lead-programmer all APPROVE)
**Tech debt logged**: 1 item (JSDoc completeness on public setters — S-1 from lead-programmer review)
