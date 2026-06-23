# Story 006: Dispose Safety

> **Epic**: Game State Machine
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/game-state-machine.md`
**Requirement**: `TR-GSM-008` — Dispose during mid-transition aborts: runs onExit of source state, does not run onEnter of target.

**ADR Governing Implementation**: ADR-0024: Game State Machine
**ADR Decision Summary**: If the GSM is disposed while mid-transition, the current transition is aborted. `onExit` of the source state runs, but `onEnter` of the target does not. After dispose, no new transitions are accepted, no events are emitted, and `tick()` is a no-op.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer.

**Control Manifest Rules (this layer)**:

- Required: F26 (onEnter/onExit async with rollback — dispose mid-flight should not trigger rollback)
- Required: F25 (Max 1 transition per tick — dispose should clear the tick queue)

---

## Acceptance Criteria

- [ ] `GSM.dispose()` sets a disposed flag that prevents any new transitions — calls to `transition()` become no-ops (no error thrown)
- [ ] If `dispose()` is called mid-transition (hooks executing), `onExit` of the source state is initiated but the system does NOT wait for async completion; `onEnter` of the target state does NOT run
- [ ] After `dispose()`, any `transition()` call is a no-op (no error thrown — system is shut down)
- [ ] After `dispose()`, the GSM emits no further events on the Event Bus
- [ ] After `dispose()`, `tick()` is a no-op and the transition queue is cleared

---

## Implementation Notes

_Derived from ADR-0024 Implementation Guidelines:_

1. **Dispose flag**: `_disposed: boolean`. Set to `true` at the start of `dispose()`.
2. **Guard pattern**: At the top of `transition()` and `tick()`, check `if (this._disposed) return;` — no-op, no error. The system is being torn down; throwing would be unfriendly.
3. **Mid-transition detection**: Before calling `onExit` during dispose, check `_busy`. If busy:
   - Call `onExit(source)` synchronously (or initiate it, but do not await)
   - Do NOT call `onEnter(target)`
   - Do NOT emit `gsm.state.exited` or `gsm.state.entered`
   - The transition queue is cleared
4. **Async onExit during dispose**: If `onExit` is async, call it but do NOT await. The dispose is happening — we don't wait for cleanup hooks to complete. This is consistent with TR-GSM-008 ("runs onExit" = initiates, not completes).
5. **Event Bus cleanup**: The GSM is an emitter (no subscriptions). After dispose, the `_eventBus` reference is set to null so no further `emit()` calls occur.
6. **History cleanup**: Set `_history.length = 0` (Story 005's ring buffer).
7. **Queue cleanup**: Set `_queue.length = 0` (Story 004's transition queue).
8. **Re-init after dispose**: `init()` after `dispose()` is a no-op — once disposed, the GSM is not reusable. This prevents accidental re-initialization after system teardown.
9. **File**: Add `dispose()` method to `GameStateMachine.ts`.

---

## Out of Scope

- Disposing external systems that depend on GSM (done by the owning system, not GSM)
- Restarting/recreating the GSM after dispose (a new instance should be created)
- Garbage collection of the GSM instance (caller responsibility)

---

## QA Test Cases

- **AC-1**: dispose() sets disposed flag, prevents new transitions
  - Given: GSM initialized in Loading
  - When: GSM.dispose() is called
  - Then: GSM.transition('Menu') is a no-op (no error); GSM.currentState remains 'Loading'
  - Edge cases: dispose() called twice (no-op second time); transition() called 10 times after dispose (all no-ops)

- **AC-2**: Dispose mid-transition — onExit initiates, onEnter skipped
  - Given: GSM initialized; transitioning to Menu with a slow async onEnter
  - When: GSM.dispose() is called while onEnter is pending
  - Then: onExit of source (Loading) is initiated; onEnter of target (Menu) does NOT run; GSM.currentState is 'Loading'
  - Edge cases: onExit is async (do NOT await); transition with sync hooks (dispose before hooks complete); no transition in progress (dispose is clean)

- **AC-3**: After dispose, transition() is no-op (no error)
  - Given: GSM disposed
  - When: GSM.transition('Menu') is called
  - Then: No error thrown; no state change; no events emitted
  - Edge cases: transition to every possible state (all no-ops); transition after double dispose; transition(null/undefined) after dispose (no-op, not TypeError)

- **AC-4**: After dispose, GSM emits no further events on Event Bus
  - Given: GSM with mock Event Bus, disposed while in 'Loading'
  - When: GSM.transition('Menu') is attempted (will be no-op)
  - Then: mock EB.emit() was never called after dispose
  - Edge cases: dispose mid-transition where exited was already emitted (entered is NOT re-emitted as it would be in a rollback); transition queue had items (cleared, not processed)

- **AC-5**: After dispose, tick() is no-op and queue cleared
  - Given: GSM disposed with 3 queued transitions
  - When: GSM.tick() is called
  - Then: No transitions processed; queue is empty; no state change
  - Edge cases: tick() called after dispose with empty queue; tick() called after dispose 10 times (all no-ops)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/foundation/gsm/006-dispose-safety.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- **Depends on**: Story 001 (core-fsm-transition-table) — requires currentState and transition(); Story 002 (async-lifecycle-hooks) — requires onExit/onEnter hooks; Story 004 (transition-throttling) — requires tick() and transition queue
- **Unlocks**: None (end of GSM story chain)
