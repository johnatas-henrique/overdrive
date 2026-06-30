# Story 004: Tab Blur Safety + Gamepad Disconnect Handling

> **Epic**: Input
> **Status**: Complete
> **Last Updated**: 2026-06-29
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/input.md`
**Requirements**:

- `TR-INP-005` — Focus loss (tab/native/visibility) zeros all outputs immediately — single flag in `getState()`; focus return resumes live hardware state (no replay)
- `TR-INP-009` — Gamepad disconnect → `activeGamepad` set to null immediately; `getState()` returns zeroed axes for disconnected gamepad; keyboard remains active

**ADR Governing Implementation**: ADR-0006: Input Abstraction
**ADR Decision Summary**: Dual detection: `window.blur`/`focus` for OS-level focus loss, `document.visibilitychange` for tab switch/multi-monitor coverage. GamepadManager `onGamepadDisconnectedObservable` sets `activeGamepad = null`; `getState()` returns zeroed axes via null check. Keyboard remains active on disconnect.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Standard DOM event listeners (blur, focus, visibilitychange) — no Babylon APIs needed for blur detection. GamepadManager observables from `@babylonjs/core/Gamepads/gamepadManager`. Note: `onGamepadDisconnectedObservable` may fire late after stale axis values — mitigation: null check in `getState()` as primary safety.

**Control Manifest Rules (this layer)**:

- Required (C14): Tab blur zeros all outputs — no stuck keys on focus loss. Resume live state on focus.
- Performance (F-G3): Slot 1 (Input) < 0.01ms per tick — blur check is a single flag read.

---

## Acceptance Criteria

_From GDD `design/gdd/input.md`, scoped to this story:_

- [ ] **AC-1**: Tab blur (`window.blur` + `document.visibilitychange` with `document.hidden === true`) sets internal `hidden = true`; `getState()` returns all-zeros
- [ ] **AC-2**: Tab focus return (`window.focus` + `document.visibilitychange` with `document.hidden === false`) sets `hidden = false`; next `getState()` reads live hardware values (no replay of pre-blur inputs)
- [ ] **AC-3**: Gamepad disconnect (`onGamepadDisconnectedObservable`) → `activeGamepad = null` immediately; `getState()` returns zeroed axes for gamepad channels; keyboard remain active and readable
- [ ] **AC-4**: Gamepad reconnect (`onGamepadConnectedObservable`) → `activeGamepad` restored; next `getState()` resumes gamepad readings from current hardware state
- [ ] **AC-5**: All-zeros means all fields at neutral/zero/false: matches `InputState.ZERO` from Story 001
- [ ] **AC-6**: No replay of missed inputs on focus return — post-focus values reflect current hardware state, not pre-blur state

---

## Implementation Notes

_Derived from ADR-0006 Implementation Guidelines:_

1. **Dual detection** (from ADR-0006 Focus Loss Handling):

   ```typescript
   window.addEventListener("blur", () => {
     this.hidden = true;
   });
   window.addEventListener("focus", () => {
     this.hidden = false;
   });
   document.addEventListener("visibilitychange", () => {
     this.hidden = document.hidden;
   });
   ```

   Both are needed: `blur` covers OS-level focus change (alt-tab), `visibilitychange` covers tab switch without OS focus change (multi-monitor).

2. **Registration in `init()`**: Add event listeners during `PlayerInput.init()`. Remove in `dispose()`. Prevent listener leaks on re-init (Race Again scenario).

3. **Gamepad connect/disconnect** (from ADR-0006 Gamepad State Management):

   ```typescript
   gamepadManager.onGamepadConnectedObservable.add((gp) => {
     this.activeGamepad = gp;
     this.onDeviceChanged.notifyObservers("gamepad");
   });
   gamepadManager.onGamepadDisconnectedObservable.add(() => {
     this.activeGamepad = null;
     // Axes zeroed in getState() because activeGamepad is null
     // Keyboard analog still works
   });
   ```

4. **Early return in getState()**: The hidden check is the first non-blocking guard in `getState()`:

   ```typescript
   getState(): InputState {
     // 0. GSM transition blocking (Story 005)
     if (this.transitionBlocking) return InputState.ZERO;
     // 1. Tab blur → zero all
     if (this.hidden) return InputState.ZERO;
     // 2. Core polling loop (Story 003)
     // ...
   }
   ```

5. **No replay guarantee**: On focus return, the next `getState()` reads live hardware values via DSM and GamepadManager. No buffered/cached values are replayed. This is inherent in the polling architecture — there is no event queue to replay. Verify in integration tests by setting pre-blur state, blurring, changing mocked hardware state, focusing, and asserting post-focus values match the new hardware state.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 003 (PlayerInput)**: Core polling loop — this story adds the blur/disconnect guards to it
- **Story 005 (GSM State)**: Transition blocking — similar early-return pattern but driven by Event Bus, not browser events
- **Story 007 (Device Detection)**: `onDeviceChanged` observable wiring — this story fires the observable on gamepad connect/disconnect but does not own the device-tracking logic

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Integration story — automated test specs:**

- **AC-1**: blur zeros all outputs
  - Given: PlayerInput with throttle = 0.8 (mocked gamepad)
  - When: `window.dispatchEvent(new Event('blur'))` AND `document.hidden = true; document.dispatchEvent(new Event('visibilitychange'))`
  - Then: `getState()` matches `InputState.ZERO`
  - Edge cases: blur fires twice → still zero; blur without prior input → zero

- **AC-2**: focus resumes live values
  - Given: PlayerInput is blurred (all zeros)
  - When: `window.dispatchEvent(new Event('focus'))` AND `document.hidden = false; document.dispatchEvent(new Event('visibilitychange'))`
  - And: mocked gamepad has throttle = 0.5
  - Then: `getState().throttle === 0.5` (live value, not replayed)
  - Edge cases: focus without prior blur → normal operation; focus when already focused → no-op

- **AC-3**: gamepad disconnect zeros gamepad axes; keyboard stays
  - Given: gamepad steer = 0.5 AND keyboard Space pressed
  - When: `onGamepadDisconnectedObservable.notifyObservers()`
  - Then: `getState().steer === 0` (gamepad zeroed)
  - And: `getState().confirm === true` (keyboard still works)
  - Edge cases: disconnect when no gamepad was active → safe no-op; double disconnect → safe no-op

- **AC-4**: gamepad reconnect resumes
  - Given: no activeGamepad
  - When: `onGamepadConnectedObservable.notifyObservers(stubGamepad)`
  - Then: `activeGamepad === stubGamepad`
  - When: mocked stubGamepad has `leftStick.x = 0.8`
  - Then: `getState().steer ≈ deadZoneApply(0.8, 0.15)`
  - Edge cases: reconnect during blur → gamepad stored but getState() still returns zero; rapid disconnect-reconnect → last connected wins

- **AC-5**: all-zeros matches InputState.ZERO
  - Given: any state where all outputs should be zero (blur, disconnect, transition block)
  - Then: verify against `InputState.ZERO` structural equality
  - Edge cases: all-zero path does not mutate the ZERO constant

- **AC-6**: no replay on focus return
  - Given: pre-blur throttle = 0.8
  - When: blur + focus sequence occurs
  - And: post-focus mocked throttle = 0.3
  - Then: `getState().throttle === 0.3` (not 0.8)
  - Edge cases: inputs changed during blur (key released, stick moved) → post-focus state is correct

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:

- Tests: `tests/integration/input/focus-disconnect-safety.test.ts` — must exist and pass
- Requires `// @vitest-environment happy-dom` for DOM event dispatching
- Mocked GamepadManager + window/document event targets

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (PlayerInput class to add blur/disconnect handlers to)
- Unlocks: None

## Completion Notes

**Completed**: 2026-06-29
**Criteria**: 6/6 passing (all auto-verified by tests)
**Deviations**: OUT OF SCOPE — player-input-polling.test.ts modified for branch coverage (logged as tech debt SP2/input/ST4). REFACTOR — _readKeyboard() and _readGamepad() split into sub-methods to resolve LP-CODE-REVIEW concerns (method length/complexity).
**Test Evidence**: Integration: test file at `tests/integration/input/focus-disconnect-safety.test.ts` (26 tests, all passing)
**Code Review**: COMPLETE — LP-CODE-REVIEW APPROVE (after refactor), QL-TEST-COVERAGE ADEQUATE
