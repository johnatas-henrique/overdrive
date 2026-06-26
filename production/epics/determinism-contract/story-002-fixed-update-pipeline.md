# Story 002: FixedUpdatePipeline

> **Epic**: Determinism Contract
> **Status**: Complete
> **Last Updated**: 2026-06-24
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/determinism-contract.md`
**Requirements**: `TR-DET-001`

**ADR Governing Implementation**: ADR-0002: Fixed Timestep & Determinism Pipeline
**ADR Decision Summary**: 8 fixed immutable pipeline slots executed in order each tick. Slot order defined at startup via `register(systemId, update, slotIndex)`. `register()` throws after `start()`. Pipeline state machine: Uninitialized → Ready (start) → Disposed (stop/close). Throwing slot does not prevent subsequent slots.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer. The pipeline class itself imports nothing from Babylon; only the integration layer (Story 005) touches `engine.runRenderLoop()`.

**Control Manifest Rules (this layer)**:

- Required: F12 — 8 fixed immutable pipeline slots: Input → Physics → AI → Collision → Fuel → Tire → Race Management → Pit Stop
- Required: F13 — Fixed timestep at 1/60s — `FIXED_DT = 16.667ms`
- Forbidden: F-F10 — Never register pipeline in `scene.onBeforeRenderObservable`
- Guardrail: F-G2 — Pipeline: < 0.001ms overhead per tick (8 function calls)

---

## Acceptance Criteria

_From GDD `design/gdd/determinism-contract.md`, scoped to this story:_

- [ ] AC-1: `register('input', updateFn, 1)` inserts the system at slot index 1. `executeTick(dt)` calls it in order.
- [ ] AC-2: Spy systems at slots 1, 2, 3 record call order as `[slot1, slot2, slot3]` — verified by test assertion.
- [ ] AC-3: `register('physics', fn, 2)` followed by `register('ai', fn, 3)` — `executeTick()` calls physics before ai.
- [ ] AC-4: `register()` called after `start()` throws `PipelineError('Cannot register after pipeline has started')`.
- [ ] AC-5: `executeTick()` called before `start()` throws `PipelineError('Pipeline not started')`.
- [ ] AC-6: A throwing slot (slot 2 throws `Error`) does not prevent slots 3–8 from executing — all subsequent slots are called.
- [ ] AC-7: `getCurrentTick()` returns 0 before any tick, increments by 1 per `executeTick()` call.
- [ ] AC-8: `dispose()` transitions pipeline to Disposed state; further `executeTick()` throws `PipelineError('Pipeline is disposed')`.
- [ ] AC-9: Slot indices outside 1–8 (e.g. 0 or 9) throw `PipelineError('Invalid slot index: 0')`.
- [ ] AC-10: `register()` with duplicate `systemId` (e.g. `register('physics', fn, 2)` then `register('physics', fn, 2)` again) throws `PipelineError('System already registered: physics')`.

---

## Implementation Notes

_Derived from ADR-0002 Implementation Guidelines:_

- `IFixedUpdatePipeline` interface:
  ```typescript
  interface IFixedUpdatePipeline {
    register(
      systemId: string,
      update: (dt: number) => void,
      slotIndex: number
    ): void;
    start(): void;
    stop(): void;
    executeTick(dt: number): void;
    getCurrentTick(): number;
    dispose(): void;
  }
  ```
- Internal slots stored as an array of length 8 (1-indexed, index 0 unused). Each slot holds `{ systemId, update } | null`.
- `register()` stores at `slots[slotIndex]`. If slot already occupied, throw `PipelineError('Slot N already occupied by: ...')`.
- State machine: `Uninitialized` → `start()` → `Ready` → `stop()` → `Disposed`. `dispose()` transitions from any state to `Disposed`.
- `executeTick()` iterates slots 1–8, skips null slots, calls `update(dt)`, catches any error per slot and continues.
- `getCurrentTick()` — simple counter incremented each `executeTick()`.
- `PipelineError` — custom error class in `src/foundation/determinism/errors.ts`, extends `Error`, exported.
- File location: `src/foundation/determinism/fixed-update-pipeline.ts`.
- Test with simple spy functions (vi.fn() or plain call-recording closures) — no engine, no DOM.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 003]: InputBuffer — double-buffer pattern for input state
- [Story 004]: Fixed Timestep Accumulator — the accumulator math that drives tick timing
- [Story 005]: Pipeline Engine Integration — wiring pipeline into `engine.runRenderLoop()`
- [Story 006]: Determinism Enforcement — dev guards for `Math.random`/`Date.now`/`performance.now`

---

## QA Test Cases

**AC-1: Basic slot registration and execution**

- Given: A pipeline in Uninitialized state, `register('input', spyFn, 1)` called
- When: `start()` then `executeTick(FIXED_DT)` is called
- Then: `spyFn` was called once with `FIXED_DT` as argument
- Edge cases: register at slot 8 (last slot); register at slot 1 after slot 2 already registered

**AC-2: Call order verification**

- Given: Three spy functions at slots 1, 2, 3, each recording their slot index on call
- When: `executeTick(FIXED_DT)` is called once
- Then: Recorded call order is `[1, 2, 3]`
- Edge cases: non-contiguous slots (only slots 1, 5, 8 registered — still executes in ascending order)

**AC-3: Registration order independence**

- Given: `register('ai', fn, 3)` called first, then `register('physics', fn, 2)` called second
- When: `executeTick(FIXED_DT)` is called
- Then: physics is called before ai (slot index determines order, not registration order)
- Edge cases: register all 8 slots in reverse order — executeTick must still run 1→8

**AC-4: register after start throws**

- Given: Pipeline `start()` has been called
- When: `register('late', fn, 1)` is called
- Then: Throws `PipelineError('Cannot register after pipeline has started')`
- Edge cases: the pipeline is in Disposed state — register also throws

**AC-5: executeTick before start throws**

- Given: Pipeline in Uninitialized state, no `start()` called
- When: `executeTick(FIXED_DT)` is called
- Then: Throws `PipelineError('Pipeline not started')`
- Edge cases: pipeline was started then stopped — executeTick after stop also throws

**AC-6: Throwing slot isolation**

- Given: Three systems registered at slots 1, 2, 3. Slot 2's update throws `Error('Physics fail')`
- When: `executeTick(FIXED_DT)` is called
- Then: Slot 1 executes, slot 2 throws (caught), slot 3 still executes — verified by spy on slot 3
- Edge cases: all 8 slots throw — no crash, all errors caught; slot 1 throws — slots 2–8 still execute

**AC-7: Tick counting**

- Given: Pipeline `start()` called
- When: `executeTick(FIXED_DT)` is called 5 times
- Then: `getCurrentTick()` returns 5
- Edge cases: `getCurrentTick()` before any tick returns 0; after `stop()` and new `start()`, counter resets

**AC-8: Disposed state**

- Given: Pipeline `start()` followed by `dispose()`
- When: `executeTick(FIXED_DT)` is called
- Then: Throws `PipelineError('Pipeline is disposed')`
- Edge cases: `dispose()` called twice — second call is safe no-op

**AC-9: Invalid slot index**

- Given: A pipeline in Uninitialized state
- When: `register('bad', fn, 0)` is called
- Then: Throws `PipelineError('Invalid slot index: 0')`
- Edge cases: index 9 (out of range); negative index; non-integer index

**AC-10: Duplicate systemId**

- Given: `register('physics', fn1, 2)` called once
- When: `register('physics', fn2, 2)` is called (same systemId, same slot)
- Then: Throws `PipelineError('System already registered: physics')`
- Edge cases: same systemId at a different slot — also throws (systemId unique across all slots)

---

## QA Test Cases

**Test file**: `tests/unit/determinism.test.ts`

### AC-1: systems execute in order
- Register spy systems A, B, C
- Call `executeTick(1/60)`
- Assert: call order is A → B → C

### AC-2: executeTick runs all registered
- Register 3 systems
- Call `executeTick(1/60)`
- Assert: all 3 systems receive tick call

### AC-3: invalid system rejected
- Attempt to register object with wrong signature
- Assert: pipeline rejects with clear error

### AC-4: empty pipeline
- Create pipeline with no systems
- Call `executeTick(1/60)`
- Assert: no error

## Test Evidence

Test evidence: `tests/unit/determinism.test.ts` — verify all acceptance criteria pass.

## Dependencies

- Depends on: None (standalone — pipeline class is pure TypeScript)
- Unlocks: Story 004 (Accumulator uses pipeline's tick counting interface), Story 005 (Pipeline Engine Integration), Story 006 (Determinism Enforcement hooks into pipeline lifecycle)

## Completion Notes

**Completed**: 2026-06-24
**Criteria**: 10/10 passing
**Deviations**: Added Number.isInteger() check to register() for non-integer slot index validation (AC-9 edge case — was missing from original implementation)
**Test Evidence**: Unit test at `tests/unit/determinism.test.ts` — 59/59 tests, 100% coverage on fixed-update-pipeline.ts, tsc clean, lint clean
**Code Review**: Complete (APPROVED — 0 BLOCKING, 2 WARNING addressed)
