# Story 002: Async Lifecycle Hooks

> **Epic**: Game State Machine
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic (mixed: AC5 requires mock Event Bus)
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/game-state-machine.md`
**Requirements**: `TR-GSM-002` (Per-state `onEnter()`/`onExit()` hooks returning `void` or `Promise<void>`; GSM awaits async hooks before completing transition), `TR-GSM-006` (Async `onEnter()` rejection rolls back to previous state — error logged, transition aborted)

**ADR Governing Implementation**: ADR-0024: Game State Machine
**ADR Decision Summary**: Each state defines optional `onEnter(context?: EnterContext): void | Promise<void>` and `onExit(): void | Promise<void>`. Async hooks are awaited; if `onEnter` rejects, GSM catches the error, logs it, and remains in the previous state. On rollback, GSM re-emits `gsm.state.entered` for the previous state (idempotent re-entry).

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer. Verified via `tsc --noEmit`.

**Control Manifest Rules (this layer)**:

- Required: F26 (`onEnter`/`onExit` async with rollback — if `onEnter` fails, previous state is restored)
- Required: F24 (GSM emits 2 events per transition: `gsm.state.exited(old)` then `gsm.state.entered(new)`) — AC5 rollback re-emission

---

## Acceptance Criteria

- [ ] Each state definition accepts optional `onEnter(): void | Promise<void>` and `onExit(): void | Promise<void>` hooks — both may be omitted
- [ ] `GSM.transition()` calls `onExit()` of the source state, then `onEnter()` of the target state — in that order, both invoked
- [ ] Async `onEnter()` is awaited before the transition is marked complete — `currentState` does not change until the promise resolves
- [ ] If `onEnter()` rejects, the GSM catches the error, logs a warning via `console.warn`, and remains in the previous state — currentState is unchanged
- [ ] On rollback from a failed `onEnter()`, GSM re-emits `gsm.state.entered` for the previous state (idempotent re-entry, requires mock Event Bus)
- [ ] Hooks that are not functions at registration time throw `TypeError`

---

## Implementation Notes

_Derived from ADR-0024 Implementation Guidelines:_

1. **State definition interface**:
   ```typescript
   interface StateDefinition {
     name: State;
     onEnter?: () => void | Promise<void>;
     onExit?: () => void | Promise<void>;
   }
   ```
2. **Hook invocation order**: `source.onExit()` → `target.onEnter()`. If `onExit` is async, await it before calling `onEnter`. Hooks are optional — skip if undefined.
3. **Async handling**: Use an internal `_transitionPromise` to track the in-progress async operation. The transition is "complete" only after `onEnter` resolves (or rejects).
4. **Rollback on rejection**: Wrap `onEnter()` in try/catch. On catch:
   - Log with `console.warn('[GSM] onEnter failed for', target, error)`
   - Restore `currentState` to the original (source) state
   - If Event Bus is available, emit `gsm.state.entered` for the restored state
   - Do NOT call `onExit` of the original source again — the source was never fully exited
5. **Hook validation**: During state registration, check that hook values are either undefined or functions. Throw `TypeError` if not.
6. **Busy/locked flag**: Set `_busy = true` before executing hooks, clear on completion or rollback. New `transition()` calls while busy are queued (Story 004).
7. **Logger**: Use `console.warn` for hook failures (consistent with Foundation pattern). Not a dedicated logger interface.
8. **File**: `src/foundation/gsm/StateDefinition.ts` (interface), extend `GameStateMachine.ts` (hook execution logic).

---

## Out of Scope

- Event Bus injection and event shape (Story 003)
- Queue management for transitions during async hooks (Story 004)
- Dispose mid-async-hook behavior (Story 006)

---

## QA Test Cases

- **AC-1**: Each state defines optional onEnter/onExit hooks
  - Given: A state definition with onEnter returning void; a state with onEnter returning Promise<void>; a state with no onEnter at all
  - When: Each state definition is passed to the GSM
  - Then: All three are accepted without error; only states with defined hooks have their hooks called during transitions
  - Edge cases: onEnter defined but onExit omitted (no error); both hooks omitted (no error); hook is not a function (throws TypeError at registration time)

- **AC-2**: GSM.transition() calls onExit(source) then onEnter(target)
  - Given: GSM initialized in Loading, onExit_Loading spy and onEnter_Menu spy recording calls
  - When: GSM.transition('Menu') is called
  - Then: onExit_Loading was called BEFORE onEnter_Menu; both called exactly once; no other hooks called
  - Edge cases: Chain of 3 transitions (source.onExit → target.onEnter → target.onExit → next.onEnter); onExit called with correct context (this); call count verification

- **AC-3**: Async onEnter is awaited before transition completes
  - Given: GSM in Loading, onEnter_Menu is async and resolves after 50ms
  - When: GSM.transition('Menu') is called
  - Then: GSM.currentState is 'Loading' immediately after transition() returns (while promise pending); after the promise resolves, GSM.currentState is 'Menu'
  - Edge cases: Async onEnter resolves immediately (synchronous-like); transition while async hook pending (queued by Story 004)

- **AC-4**: Async onEnter rejection does not change state, logs error
  - Given: GSM in Loading, onEnter_Menu rejects with `new Error('Menu init failed')`
  - When: GSM.transition('Menu') is called
  - Then: Rejection is caught (no unhandled promise rejection); console.warn is called with a message containing 'onEnter'; GSM.currentState is still 'Loading'
  - Edge cases: Rejection with non-Error value (still caught); onExit rejects during rollback (should be decided); multiple consecutive async onEnter failures

- **AC-5**: On rollback, GSM re-emits gsm.state.entered for previous state
  - Given: GSM initialized in Loading with a mock Event Bus; onEnter_Menu rejects
  - When: GSM.transition('Menu') is called and onEnter fails
  - Then: mock EB received 'gsm.state.entered' with `{ to: 'Loading' }`; event is idempotent with a normal re-entry
  - Edge cases: Two rollbacks in a row (only one gsm.state.entered per rollback); Event Bus unavailable during rollback (warning logged, per TR-GSM-007)

---

## QA Test Cases

**Test file**: `tests/unit/gsm.test.ts`

### AC-1: async onExit/onEnter called
- Transition PreRace → Racing
- Assert: `PreRace.onExit()` completes, then `Racing.onEnter()` starts

### AC-2: async onEnter failure rolls back
- Configure `Racing.onEnter()` to reject
- Call `transition('Racing')` from PreRace
- Assert: error caught and logged
- Assert: GSM remains in PreRace (rollback)

### AC-3: onEnter error isolation
- Configure `Racing.onEnter()` to throw synchronously
- Call `transition('Racing')`
- Assert: error caught, logged, state rolled back

## Test Evidence
## Dependencies

- **Depends on**: Story 001 (core-fsm-transition-table) — requires State type, transition table, and `currentState` accessor
- **Unlocks**: Story 003 (event-bus-integration), Story 006 (dispose-safety)
