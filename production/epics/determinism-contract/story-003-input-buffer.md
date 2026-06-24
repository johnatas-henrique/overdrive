# Story 003: InputBuffer

> **Epic**: Determinism Contract
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/determinism-contract.md`
**Requirements**: `TR-DET-005`

**ADR Governing Implementation**: ADR-0002: Fixed Timestep & Determinism Pipeline
**ADR Decision Summary**: Double-buffer pattern for input state. Slot #1 writes hardware state via `write(state)`. Slots #2–8 read via `read()`. `flip()` called after all 8 slots complete a tick. `InputState.ZERO` default ensures no stale input on first tick. Buffer isolation prevents torn frames.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer.

**Control Manifest Rules (this layer)**:

- Required: F12 — Pipeline slot order: Input is slot #1
- Forbidden: F-F4 — Never import Foundation from higher layers
- Guardrail: F-G2 — Pipeline overhead < 0.001ms per tick

---

## Acceptance Criteria

_From GDD `design/gdd/determinism-contract.md`, scoped to this story:_

- [ ] AC-1: `write({ steer: 0.5, throttle: 1, brake: 0 })` then `read()` returns exactly that state object.
- [ ] AC-2: `read()` before any `write()` returns `InputState.ZERO` (all fields zero/default).
- [ ] AC-3: `write(stateA)` then `write(stateB)` before `flip()` — after flip, `read()` returns `stateB` (last write wins within same tick).
- [ ] AC-4: Full tick cycle: `write(A) → read() → flip() → write(B) → read()` returns B (not A). Previous tick's data is isolated.
- [ ] AC-5: `read()` called twice in same tick returns the same value both times (input is not consumed/destructive).
- [ ] AC-6: Zero imports from Babylon.js, `@babylonjs/*`, or any npm package — verified by `tsc --noEmit` on Foundation directory.

---

## Implementation Notes

_Derived from ADR-0002 Implementation Guidelines:_

- Double-buffer pattern:

  ```typescript
  class InputBuffer {
    private buffers: [InputState | null, InputState | null] = [null, null];
    private writeIndex = 0;

    write(state: InputState): void {
      this.buffers[this.writeIndex] = state;
    }

    read(): InputState {
      return this.buffers[this.writeIndex] ?? InputState.ZERO;
    }

    flip(): void {
      this.writeIndex ^= 1;
      this.buffers[this.writeIndex] = null;
    }
  }
  ```

- `InputState` interface:

  ```typescript
  interface InputState {
    steer: number; // -1..1
    throttle: number; // 0..1
    brake: number; // 0..1
    gearDelta: -1 | 0 | 1;
    confirm: boolean;
    pauseToggle: boolean;
    cameraToggle: boolean;
    cancel: boolean;
    navUp: boolean;
    navDown: boolean;
  }

  // ZERO constant — all fields at default
  const InputStateZERO: InputState = {
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
  ```

- Lifecycle within a tick: Slot #1 calls `write()`, slots #2-8 call `read()`, after slot #8 the pipeline calls `flip()`.
- `InputState.ZERO` is exported as a static property or module constant for test consumers.
- File location: `src/foundation/determinism/input-buffer.ts`.
- `InputState` type and `ZERO` constant live in `src/foundation/determinism/types.ts`.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 005]: Pipeline Engine Integration — calling `flip()` after slot #8 in the render loop
- Input hardware polling (Input epic) — this is just the buffer that connects Input slot to downstream slots
- AI Driver input map (separate `Map<carId, InputState>` consumed by Physics slot)

---

## QA Test Cases

**AC-1: write then read returns state**

- Given: An `InputBuffer` instance
- When: `write({ steer: 0.5, throttle: 1, brake: 0, gearDelta: 0, confirm: false, pauseToggle: false, cameraToggle: false, cancel: false, navUp: false, navDown: false })` then `read()` is called
- Then: The returned object has `steer: 0.5`, `throttle: 1`, `brake: 0`, all booleans `false`
- Edge cases: write with partial object (must be caught by TypeScript — InputState is a required shape); write with extreme values (`steer: -1`, `throttle: 0`)

**AC-2: read before any write returns ZERO**

- Given: A fresh `InputBuffer`
- When: `read()` is called without any prior `write()`
- Then: Returns `InputState.ZERO` — all numeric fields 0, all boolean fields false
- Edge cases: read after flip but before write — should also return ZERO; read after constructor — ZERO

**AC-3: Last write wins in same tick**

- Given: An `InputBuffer`
- When: `write(A)` is called, then `write(B)` is called before any flip, then `flip()` then `read()`
- Then: Returns B (A was overwritten within the write buffer)
- Edge cases: write only once — normal operation; write three times — last one wins

**AC-4: Buffer isolation across ticks**

- Given: An `InputBuffer`
- When: `write(tick1State)` → `read()` → `flip()` → `write(tick2State)` → `read()` is called
- Then: The final `read()` returns tick2State, not tick1State
- Edge cases: flip() called twice without write in between — read() returns ZERO; write after flip but before next flip — normal operation

**AC-5: read is non-destructive**

- Given: An `InputBuffer` with `write(testState)` called
- When: `read()` is called twice
- Then: Both calls return the same value (object identity may differ but deep-equal)
- Edge cases: read() five times in a row — all return same value

**AC-6: Zero dependencies**

- Given: All InputBuffer source files in `src/foundation/determinism/`
- When: The files are checked for import statements
- Then: No imports from `'babylonjs'`, `'@babylonjs/*'`, or any npm package
- Edge cases: Import of local sibling file (`'./types'`, `'./input-buffer'`) is allowed

---

## QA Test Cases

**Test file**: `tests/unit/determinism.test.ts`

### AC-1: buffer and consume
- Push input event between tick N and tick N+1
- Execute tick N+1
- Assert: input consumed exactly once during tick N+1

### AC-2: input not lost
- Push 3 inputs between ticks
- Assert: each input consumed in subsequent ticks (none lost)

### AC-3: input not duplicated
- Push 1 input
- Execute 2 ticks
- Assert: input consumed exactly once (not duplicated)

### AC-4: empty buffer
- Execute tick with no buffered input
- Assert: no error, no input processed

## Test Evidence
## Dependencies

- Depends on: None (standalone — pure TypeScript data structure)
- Unlocks: Story 005 (Pipeline Engine Integration wires `flip()` into the render loop)
