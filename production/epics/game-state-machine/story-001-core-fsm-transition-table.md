# Story 001: Core FSM — Transition Table

> **Epic**: Game State Machine
> **Status**: Complete
> **Last Updated**: 2026-06-24
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/game-state-machine.md`
**Requirement**: `TR-GSM-001` — Transition table as `Record<State, State[]>` — transitions not in the table throw `GameStateError`; transition to same state is silent no-op.

**ADR Governing Implementation**: ADR-0024: Game State Machine
**ADR Decision Summary**: Flat FSM with `Record<State, State[]>` transition table. Six states: Loading, Menu, PreRace, Racing, Paused, PostRace. Invalid transitions throw `GameStateError`. Same-state transition is a silent no-op. No public `getCurrent()` — internal `currentState` is private with a read-only getter for debug/test access.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer. Verified via `tsc --noEmit`.

**Control Manifest Rules (this layer)**:

- Required: F22 (flat FSM with `Record<State, State[]>`), F23 (no system calls `gsm.getCurrent()`)
- Forbidden: F-F5 (never call `gsm.getCurrent()` from any system)

---

## Acceptance Criteria

- [ ] `GSM.init()` sets the initial state to `Loading` — no events are emitted
- [ ] `GSM.transition('Menu')` from `Loading` succeeds and `currentState` becomes `'Menu'`
- [ ] `GSM.transition('Racing')` from `Loading` throws `GameStateError('Cannot transition from Loading to Racing')` — state unchanged
- [ ] `GSM.transition('Racing')` while already in `Racing` is a silent no-op — no error, no events emitted, `currentState` unchanged
- [ ] `GSM.currentState` is a read-only getter — cannot be set from outside the GSM

---

## Implementation Notes

_Derived from ADR-0024 Implementation Guidelines:_

1. **State type**: Define `State` as a string union type or const enum: `'Loading' | 'Menu' | 'PreRace' | 'Racing' | 'Paused' | 'PostRace'`.
2. **Transition table**: Declared as `Record<State, State[]>`:
   ```typescript
   const TRANSITIONS: Record<State, State[]> = {
     Loading: ["Menu"],
     Menu: ["PreRace"],
     PreRace: ["Racing"],
     Racing: ["PostRace", "Paused"],
     Paused: ["Racing", "Menu"],
     PostRace: ["Menu", "PreRace"],
   };
   ```
3. **GameStateError**: Custom error class extending `Error` — carries `from` and `to` fields for debugging. Error message format: `'Cannot transition from ${from} to ${to}'`.
4. **init()**: Sets `currentState` to `'Loading'`. Does NOT emit events — the initial state is a bootstrap, not a transition. Idempotent: second call is a no-op.
5. **transition()**: Looks up `TRANSITIONS[currentState]` for the target. If not found, throws `GameStateError`. If target === currentState, returns immediately (no-op, no event). If valid, sets `currentState` to target.
6. **No public getter**: `currentState` is a private field with a `getCurrentState(): State` accessor. ADR-0024 Decision 6 says systems must not poll — but a read-only accessor is needed for test assertions. The getter is marked `@internal` or `/** @internal */` to signal it's not for game systems.
7. **File structure**: `src/foundation/gsm/State.ts` (type), `src/foundation/gsm/GameStateError.ts`, `src/foundation/gsm/TransitionTable.ts` (constant), `src/foundation/gsm/GameStateMachine.ts` (main class).

---

## Out of Scope

- Event Bus emissions (Story 003)
- `onEnter`/`onExit` lifecycle hooks (Story 002)
- Transition throttling / tick queue (Story 004)
- State history ring buffer (Story 005)
- Dispose safety (Story 006)

---

## QA Test Cases

- **AC-1**: GSM.init() sets initial state to Loading — no event emitted
  - Given: A fresh GSM instance with a mock Event Bus
  - When: GSM.init() is called
  - Then: GSM.currentState is 'Loading'
    And: mock EB.emit() was never called
  - Edge cases: init() called twice (no-op); init() after dispose() (recommended: no-op); init() with null Event Bus (state set, no error)

- **AC-2**: GSM.transition('Menu') from Loading succeeds
  - Given: GSM initialized (currentState = 'Loading')
  - When: GSM.transition('Menu') is called
  - Then: GSM.currentState is 'Menu'
    And: No exception is thrown
  - Edge cases: transition() with undefined/null state name (throws TypeError); transition() with empty string (throws GameStateError — not a valid state)

- **AC-3**: GSM.transition('Racing') from Loading throws GameStateError
  - Given: GSM initialized (currentState = 'Loading')
  - When: GSM.transition('Racing') is called
  - Then: GameStateError('Cannot transition from Loading to Racing') is thrown
    And: GSM.currentState remains 'Loading'
  - Edge cases: Try every illegal transition pair from the transition table; error message format is exact match

- **AC-4**: GSM.transition('Racing') while already in Racing is silent no-op
  - Given: GSM initialized and transitioned to 'Racing'
  - When: GSM.transition('Racing') is called again
  - Then: No exception is thrown; GSM.currentState is still 'Racing'; No events were emitted
  - Edge cases: Same-state no-op for EVERY state in the table; 10 consecutive same-state calls; case sensitivity ('racing' !== 'Racing')

- **AC-5**: GSM.currentState is a read-only getter
  - Given: GSM instance after init()
  - When: Attempting to set `(gsm as any).currentState = 'Racing'`
  - Then: At runtime, the setter either does not exist or silently ignores the write; getter still returns 'Loading'
  - Edge cases: Attempt to delete the property; Object.freeze detection (out of scope for unit test)

---

## Test Evidence

Test evidence: `tests/unit/gsm.test.ts` — verify all acceptance criteria pass.

## Dependencies

- **Depends on**: None (first GSM story)
- **Unlocks**: Story 002 (async-lifecycle-hooks)

## Completion Notes

**Completed**: 2026-06-24
**Criteria**: 5/5 passing
**Deviations**: None
**Test Evidence**: Unit test at `tests/unit/gsm.test.ts` — 47/47 tests, tsc clean
**Code Review**: Complete (APPROVED WITH SUGGESTIONS — all suggestions applied)
