# Story 004: Transition Throttling

> **Epic**: Game State Machine
> **Status**: Complete
> **Last Updated**: 2026-06-24
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/game-state-machine.md`
**Requirement**: `TR-GSM-004` — Serialize transitions — max 1 transition per tick; subsequent calls in same tick queued for next.

**ADR Governing Implementation**: ADR-0024: Game State Machine
**ADR Decision Summary**: At most one `transition()` call succeeds per tick. Subsequent calls in the same tick are queued and execute on the next tick. Prevents transition storms (e.g., Loading → Menu → PreRace in a single frame). Tick advancement is driven by an explicit `tick()` method on the GSM, called by the FixedUpdatePipeline (ADR-0002 F11 — pipeline runs from `engine.runRenderLoop()`).

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer. `tick()` is called externally; the GSM has no frame concept internally.

**Control Manifest Rules (this layer)**:

- Required: F25 (Max 1 transition per tick — prevents transition storms)
- Forbidden: F-F5 (never call `gsm.getCurrent()` from any system)

---

## Acceptance Criteria

- [ ] GSM provides a `tick()` method that processes at most 1 queued transition per call. If no transitions are queued, `tick()` is a no-op
- [ ] If `transition()` is called while the GSM is in a busy/locked state (a transition is already executing, including async hooks), the request is added to an internal queue
- [ ] Queued transitions are validated against the **current state at execution time** (when `tick()` processes them), not when they were queued — a queued transition may become invalid
- [ ] The queue has a configurable maximum size via constructor parameter (default: 10). If the limit is exceeded, the oldest entries are dropped and `console.warn` is logged
- [ ] After `dispose()`, `tick()` is a no-op and all queued transitions are discarded immediately

---

## Implementation Notes

_Derived from ADR-0024 Implementation Guidelines:_

1. **Tick method**: `tick(): void` — called by the FixedUpdatePipeline (ADR-0002 slot F11) at the start of each frame. The GSM does NOT use `requestAnimationFrame`, `setTimeout`, or any engine timer.
   ```typescript
   tick(): void {
     if (this._disposed || this._busy || this._queue.length === 0) return;
     const next = this._queue.shift()!;
     this._doTransition(next); // internal — validates, executes hooks, emits events
   }
   ```
2. **Busy flag**: `_busy: boolean` — set `true` when `transition()` enters hook execution (Story 002). Set `false` when hooks complete or roll back.
3. **Queue type**: Simple array of target states. `_queue: State[]`.
4. **Transition flow**:
   - `transition(target)` called → if `_busy` or `_transitionPending` flag is set → enqueue and return
   - `tick()` called → if not busy and queue non-empty → dequeue and execute
5. **Queue validation**: When dequeued, look up the current state in the transition table. If the transition is no longer valid (state changed since queued), throw `GameStateError` and continue to next tick.
6. **Queue overflow**: If `_queue.length >= maxQueueSize`, shift off the oldest entry (FIFO) and log with `console.warn('[GSM] Transition queue overflow — dropping:', dropped)` before pushing the new one.
7. **Default max queue size**: 10. Constructor parameter: `constructor(..., options?: { maxQueueSize?: number })`.
8. **Dispose**: Set `_disposed = true`, clear `_queue.length = 0`. `tick()` checks `_disposed` first.
9. **File**: Extend `GameStateMachine.ts` with `tick()`, queue, and overflow logic.

---

## Out of Scope

- Actual wiring to FixedUpdatePipeline — the pipeline `tick()` call is done by `engine-runner` or `main.ts`, not by GSM
- Async hook execution (Story 002 — the "busy" state is set by hook execution from Story 002)
- Dispose safety beyond clearing the queue (Story 006)

---

## QA Test Cases

- **AC-1**: tick() processes at most 1 queued transition per call
  - Given: GSM initialized in Loading; 3 transitions to Menu queued
  - When: GSM.tick() is called once
  - Then: Exactly 1 transition processed; GSM.currentState is 'Menu'
  - When: GSM.tick() is called twice more
  - Then: GSM.currentState becomes 'PreRace', then 'Racing'
  - Edge cases: Empty queue (tick() is no-op); tick() called 10 times on empty queue (no-ops, no errors); tick() after dispose (no-op)

- **AC-2**: transition() called while busy is queued
  - Given: GSM in Loading; onEnter_Menu is async and takes 100ms; GSM.transition('Menu') called
  - When: GSM.transition('PreRace') is called while the async hook is pending
  - Then: The call to 'PreRace' does NOT throw; the request is enqueued; GSM.currentState is still 'Loading' (waiting for hooks)
  - Edge cases: 5 rapid transition() calls while busy (all queued); transition() to illegal state queued while busy (throws at execution time, not queue time)

- **AC-3**: Queued transitions validated against current state at execution time
  - Given: GSM in Loading; queue has ['PreRace'] (skipping Menu)
  - When: GSM.tick() processes the queue
  - Then: GameStateError('Cannot transition from Loading to PreRace') — invalid at execution time
  - Edge cases: State changes between queue and execution via some other mechanism (GSM has no other mechanism — this validates internal consistency only); queued transition was valid when queued but target state became current in between (same-state no-op at execution time)

- **AC-4**: Queue overflow drops oldest entry with warning
  - Given: GSM initialized with maxQueueSize = 3; already 3 transitions queued
  - When: A 4th transition() is called while busy
  - Then: console.warn is called with a message containing 'queue overflow'; the oldest queued item was dropped; the queue now has 3 items including the newest
  - Edge cases: Drop behavior is FIFO (not LIFO); warning includes identity of dropped transition; default maxQueueSize = 10

- **AC-5**: After dispose(), tick() is no-op and queue cleared
  - Given: GSM initialized; 5 transitions queued
  - When: GSM.dispose() is called
  - Then: \_queue is empty; tick() does nothing
  - Edge cases: queue of 0 on dispose (no-op, no error); dispose while tick() is processing (handled by Story 006)

---

## QA Test Cases

**Test file**: `tests/unit/gsm.test.ts`

### AC-1: one transition per tick
- Call `GSM.transition('A')`, then immediately `GSM.transition('B')` in same tick
- Assert: only first transition executes
- Assert: second call is queued for next tick

### AC-2: queue execution
- After tick boundary, queued transition executes
- Assert: state changes to queued target

### AC-3: queue overflow
- Queue more transitions than max allowed
- Assert: excess calls dropped or oldest dropped (defined behavior)

## Test Evidence

Test evidence: `tests/unit/gsm.test.ts` — verify all acceptance criteria pass.

## Dependencies

- **Depends on**: Story 001 (core-fsm-transition-table) — requires working transition table and `currentState`; Story 003 (event-bus-integration) — queued transitions must emit events when executed
- **Unlocks**: Story 005 (state-history-ring-buffer), Story 006 (dispose-safety)

## Completion Notes

**Completed**: 2026-06-24
**Criteria**: 5/5 passing
**Deviations**: None
**Test Evidence**: Unit test at `tests/unit/gsm.test.ts` — 143/143 tests, 100% coverage on GameStateMachine.ts, tsc clean, lint clean
**Code Review**: Complete (APPROVED WITH SUGGESTIONS — all suggestions applied: 4 gap tests, W-3 doc, 2 coverage tests)
