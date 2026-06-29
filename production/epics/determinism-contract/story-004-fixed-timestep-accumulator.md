# Story 004: Fixed Timestep Accumulator

> **Epic**: Determinism Contract
> **Status**: Complete
> **Last Updated**: 2026-06-24
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/determinism-contract.md`
**Requirements**: `TR-DET-002`

**ADR Governing Implementation**: ADR-0002: Fixed Timestep & Determinism Pipeline
**ADR Decision Summary**: Accumulator pattern driven from `engine.runRenderLoop()`. `FIXED_DT = 1/60` (16.667ms). Max 4 catch-up ticks (`MAX_CATCHUP = 4`) for spiral-of-death protection. Frame deltas > 1s clamped to 1s. After max catch-up, remaining accumulator clamped to 0.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript math. The accumulator function itself is a pure transformation `(accumulator, frameDelta) → TickResult`. The engine integration (calling `engine.getDeltaTime()` and passing to accumulator) lives in Story 005.

**Control Manifest Rules (this layer)**:

- Required: F13 — Fixed timestep at 1/60s, accumulator-driven from `engine.getDeltaTime()`
- Required: F14 — Max 4 catch-up ticks, spiral-of-death protection: `if (accumulator >= FIXED_DT) accumulator = 0`
- Guardrail: F-G2 — Pipeline overhead < 0.001ms per tick

---

## Acceptance Criteria

_From GDD `design/gdd/determinism-contract.md`, scoped to this story:_

- [ ] AC-1: With `FIXED_DT = 1/60` and `frameDelta = 1/60`, accumulator produces exactly 1 tick and remaining accumulator is `< FIXED_DT`.
- [ ] AC-2: With `frameDelta = 3/60`, accumulator produces exactly 3 ticks with accumulator near 0.
- [ ] AC-3: With `frameDelta = 5/60`, accumulator produces exactly 4 ticks (capped) with accumulator remainder ≈ 1/60.
- [ ] AC-4: With `frameDelta = 0`, accumulator produces 0 ticks — accumulator unchanged.
- [ ] AC-5: With `frameDelta = 30` (tab backgrounded), frameDelta is clamped to 1s first, then produces max 4 ticks.
- [ ] AC-6: Spiral-of-death safeguard: after max catch-up, if remaining accumulator `>= FIXED_DT`, accumulator is clamped to 0.
- [ ] AC-7: Negative `frameDelta` is clamped to 0 — produces 0 ticks, accumulator unchanged.

---

## Implementation Notes

_Derived from ADR-0002 Implementation Guidelines:_

- Pure function interface:

  ```typescript
  interface TickResult {
    ticks: number; // number of ticks to execute (0..MAX_CATCHUP)
    newAccumulator: number; // remaining time for next frame
    clamped: boolean; // true if spiral-of-death clamp fired
  }

  function accumulate(
    currentAccumulator: number,
    frameDelta: number
  ): TickResult;
  ```

- Constants: `FIXED_DT = 1 / 60`, `MAX_CATCHUP = 4`, `MAX_FRAME_DELTA = 1.0` (1 second).
- Logic:
  1. Clamp `frameDelta = Math.min(frameDelta, MAX_FRAME_DELTA)` — prevent huge accumulator on tab background.
  2. Clamp negative delta to 0.
  3. `accumulator += frameDelta`.
  4. `ticks = 0`. While `accumulator >= FIXED_DT && ticks < MAX_CATCHUP`: `accumulator -= FIXED_DT`, `ticks++`.
  5. After loop: if `accumulator >= FIXED_DT`, set `accumulator = 0` and `clamped = true` (spiral-of-death).
  6. Return `{ ticks, newAccumulator: accumulator, clamped }`.
- File location: `src/foundation/determinism/accumulator.ts`.
- The accumulator does NOT call `pipeline.executeTick()` — it returns `{ ticks }` and the caller (Story 005) calls `executeTick()` that many times.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 002]: FixedUpdatePipeline — the `executeTick()` method that receives the tick count
- [Story 005]: Pipeline Engine Integration — calling `engine.getDeltaTime()`, passing to accumulator, calling `pipeline.executeTick()` in a loop

---

## QA Test Cases

**AC-1: Normal single tick**

- Given: `accumulate(0, 1/60)` is called
- When: The function executes
- Then: Returns `{ ticks: 1, newAccumulator: < FIXED_DT, clamped: false }`
- Edge cases: `accumulate(FIXED_DT * 0.999, 0.001)` — accumulator just reaches threshold, exactly 1 tick

**AC-2: Multiple ticks**

- Given: `accumulate(0, 3/60)` is called
- When: The function executes
- Then: Returns `{ ticks: 3, newAccumulator: ~0, clamped: false }`
- Edge cases: `accumulate(0.01, 3/60 - 0.01)` — residual from previous frame carries over, 3 ticks

**AC-3: Cap enforcement at 4 ticks**

- Given: `accumulate(0, 5/60)` is called
- When: The function executes
- Then: Returns `{ ticks: 4, newAccumulator: ~1/60, clamped: false }` — 4 ticks processed, 1/60 remains
- Edge cases: `accumulate(0, 4/60)` — exactly 4 ticks, no remainder; `accumulate(FIXED_DT/2, 4/60)` — 4 ticks + half-tick remainder

**AC-4: Zero frame delta**

- Given: `accumulate(0.5, 0)` is called
- When: The function executes
- Then: Returns `{ ticks: 0, newAccumulator: 0.5, clamped: false }`
- Edge cases: `accumulate(0, 0)` — ticks 0, accumulator 0

**AC-5: Tab backgrounded (large delta)**

- Given: `accumulate(0, 30)` is called
- When: The function executes
- Then: frameDelta is clamped to 1s, so `{ ticks: 4, newAccumulator: clamped to 0, clamped: true }` (spiral-of-death fires)
- Edge cases: `accumulate(0, 1.0)` — exactly 1s, produces 60 ticks → capped at 4, spiral-of-death fires

**AC-6: Spiral-of-death clamp**

- Given: `accumulate(0, 5/60)` called (produces 4 ticks, remainder ≥ FIXED_DT)
- When: The function executes
- Then: Returns `{ ticks: 4, newAccumulator: 0, clamped: true }` — spiral-of-death clamped the remainder
- Edge cases: remainder exactly equals FIXED_DT — still clamped (no 5th tick); remainder just below FIXED_DT — not clamped

**AC-7: Negative frame delta**

- Given: `accumulate(0.5, -0.1)` is called
- When: The function executes
- Then: Negative delta clamped to 0. Returns `{ ticks: 0, newAccumulator: 0.5, clamped: false }`
- Edge cases: `accumulate(0, -100)` — clamped to 0, ticks 0; `accumulate(FIXED_DT, -0.001)` — clamped to 0, accumulator stays at FIXED_DT, 1 tick may or may not fire depending on clamp order

---

## QA Test Cases

**Test file**: `tests/unit/determinism.test.ts`

### AC-1: normal frame
- Frame delta = exactly 1/60s
- Assert: exactly 1 tick processed

### AC-2: large frame (catch-up capped)
- Frame delta = 5/60s
- Assert: exactly `MAX_TICKS_PER_FRAME` ticks processed (cap applied)
- Assert: remaining time used for rendering interpolation

### AC-3: accumulator carries across frames
- Frame 1 delta = 0.5/60s (half tick, no tick processed, accumulator = 0.5/60)
- Frame 2 delta = 0.6/60s (accumulator = 1.1/60 → 1 tick processed, remainder 0.1/60)
- Assert: correct tick count based on accumulator
- Assert: remainder preserved for next frame

## Test Evidence

Test evidence: `tests/unit/determinism.test.ts` — verify all acceptance criteria pass.

## Dependencies

- Depends on: None (standalone — pure math function)
- Unlocks: Story 005 (Pipeline Engine Integration consumes accumulator output)

## Completion Notes

**Completed**: 2026-06-24
**Criteria**: 7/7 passing
**Deviations**: AC-3/AC-4 story spec discrepancies documented — implementation correct per ADR-0002. Added Number.isFinite guard for NaN/Infinity input.
**Test Evidence**: Unit test at `tests/unit/determinism.test.ts` — 111/111 tests, 100% coverage on accumulator.ts, tsc clean, lint clean
**Code Review**: Complete (APPROVED — 0 BLOCKING, 2 WARNING addressed)
