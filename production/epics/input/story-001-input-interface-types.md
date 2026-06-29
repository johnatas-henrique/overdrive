# Story 001: IInput Interface + InputState Type Definitions

> **Epic**: Input
> **Status**: Complete
> **Last Updated**: 2026-06-29
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 2h

## Context

**GDD**: `design/gdd/input.md`
**Requirement**: `TR-INP-001` — IInput interface with `getState(): InputState` — steer (-1..1), throttle (0..1), brake (0..1), gearDelta (-1/0/+1), confirm, pauseToggle, cameraToggle, cancel, navUp, navDown.

**ADR Governing Implementation**: ADR-0006: Input Abstraction
**ADR Decision Summary**: DSM + GamepadManager wrappers, polling per tick, IInput interface that produces InputState. Keyboard + Gamepad support. Dead zone formula configurable. Tab blur safety.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Type definitions only — no runtime Babylon dependency. DSM and GamepadManager imported as type references only. Post-cutoff note: DeviceSourceManager stable since v7.x, no breaking changes in 9.x.

**Control Manifest Rules (this layer)**:

- Required (C12): Input — polling per tick — Physics needs current frame's values, not last event.
- Required (C15): `IInput.getState()` reads player input only — AI has separate pipeline slot #3.
- Forbidden (C-F9): Never read Input on `scene.onBeforeRenderObservable` — pipeline must own all input reads deterministically.
- Forbidden (C-F6): Never branch Physics on player vs AI input — Physics reads from unified `inputBuffer` map.

---

## Acceptance Criteria

_From GDD `design/gdd/input.md`, scoped to this story:_

- [ ] **AC-1**: IInput interface defines `init(engine: Engine): void`, `dispose(): void`, `getState(): InputState`, `onDeviceChanged: Observable<"keyboard" | "gamepad">`
- [ ] **AC-2**: InputState interface defines all fields: steer (number, -1..1), throttle (number, 0..1), brake (number, 0..1), gearDelta (-1 \| 0 \| 1), confirm (boolean), pauseToggle (boolean), cameraToggle (boolean), cancel (boolean), navUp (boolean), navDown (boolean)
- [ ] **AC-3**: DeviceType exported as `"keyboard" | "gamepad"` union type
- [ ] **AC-4**: Import paths for DSM and GamepadManager are `@babylonjs/core/DeviceInput/deviceSourceManager` and `@babylonjs/core/Gamepads/gamepadManager` (tree-shakeable submodule paths)
- [ ] **AC-5**: `InputState.ZERO` static constant returns all fields at neutral/zero/false: `{ steer: 0, throttle: 0, brake: 0, gearDelta: 0, confirm: false, pauseToggle: false, cameraToggle: false, cancel: false, navUp: false, navDown: false }`

---

## Implementation Notes

_Derived from ADR-0006 Implementation Guidelines:_

1. **Interface shape**: `IInput` must accept `Engine` parameter in `init()` — DSM constructor requires it. `dispose()` must clean up DSM, GamepadManager, and Event Bus subscriptions.
2. **Observable import**: `onDeviceChanged` uses Babylon's `Observable` from `@babylonjs/core/Misc/observable`. This is the only runtime import — everything else in this file is type-level.
3. **Tree-shakeable imports**: Use submodule paths, not barrel imports:
   ```typescript
   import { DeviceSourceManager } from "@babylonjs/core/DeviceInput/deviceSourceManager";
   import { GamepadManager } from "@babylonjs/core/Gamepads/gamepadManager";
   ```
4. **InputState.ZERO as static**: Define as `static readonly ZERO: InputState = { ... }` — create once, reuse every tick from all-zero path (blur, transition blocking).
5. **InputState is a contract**: This same shape is what AI Driver (pipeline slot #3) writes to the double-buffered `Map<string, InputState>`. Physics slot #2 reads from that map, never branching on player vs AI. Document `InputState` as the universal tick-level signal.
6. **File location**: `src/core/input/IInput.ts` — pure types + interface. No implementations in this file.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 002 (Dead Zone)**: Formula function and analog processing logic
- **Story 003 (PlayerInput)**: Concrete class implementing IInput with DSM + GamepadManager
- **Story 004 (Focus/Disconnect)**: Tab blur and gamepad disconnect runtime handling
- **Story 005 (GSM State)**: Event Bus subscription and transition blocking
- **Story 006 (Debounce)**: Camera toggle debounce, gear rate limiting, steering edge cases
- **Story 007 (Device Detection)**: `onDeviceChanged` observable wiring, last active device tracking

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Logic story — automated test specs:**

- **AC-1**: IInput interface defines correct method signatures
  - Given: a mock class that implements `IInput`
  - When: instantiated with `init(engine)`, `dispose()`, `getState()`
  - Then: the type checker accepts the implementation and `onDeviceChanged` is an `Observable<DeviceType>`

- **AC-2**: InputState has all defined fields with correct types
  - Given: an InputState instance
  - Then: `steer` is a `number` in range -1..1, `throttle` is a `number` in range 0..1, `brake` is a `number` in range 0..1, `gearDelta` is -1 \| 0 \| 1, all boolean fields are `boolean`

- **AC-3**: DeviceType is a union type of `"keyboard" | "gamepad"`
  - Given: a variable typed as `DeviceType`
  - When: assigned `"keyboard"` or `"gamepad"`
  - Then: the type checker accepts
  - Edge cases: any other string value is rejected at compile time

- **AC-4**: Import paths resolve correctly
  - Given: the module is imported
  - When: importing `DeviceSourceManager` from submodule path
  - Then: no module-not-found error occurs at runtime (test runner fails on bad import)

- **AC-5**: InputState.ZERO returns neutral/zero/false
  - Given: `InputState.ZERO`
  - Then: `steer === 0`, `throttle === 0`, `brake === 0`, `gearDelta === 0`, `confirm === false`, `pauseToggle === false`, `cameraToggle === false`, `cancel === false`, `navUp === false`, `navDown === false`

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:

- Tests: `tests/unit/input/input-interface-types.test.ts` — must exist and pass
- Type-level tests (compile-time assertions) + runtime constant verification

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: Stories 002, 003, 004, 005, 006, 007

---

## Completion Notes

**Completed**: 2026-06-29
**Criteria**: 5/5 passing
**Deviations**: ADVISORY — DSM import path corrected from `DeviceInput/deviceSourceManager` to `DeviceInput/InputDevices/deviceSourceManager` (Babylon.js 9.x restructuring). Logged as tech debt.
**Test Evidence**: Logic: test file at `tests/unit/input/input-interface-types.test.ts` (13 tests, all passing)
**Code Review**: Complete — APPROVED (babylonjs-specialist + qa-tester + lead-programmer all APPROVE/ADEQUATE)
