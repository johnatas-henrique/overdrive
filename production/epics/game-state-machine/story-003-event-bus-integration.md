# Story 003: Event Bus Integration

> **Epic**: Game State Machine
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/game-state-machine.md`
**Requirements**: `TR-GSM-003` (On every transition emit two Event Bus events in order: `'gsm.state.exited'` (payload: `{ from }`) then `'gsm.state.entered'` (payload: `{ from, to }`)), `TR-GSM-007` (If Event Bus is unavailable during transition, state change still completes and warning is logged)

**ADR Governing Implementation**: ADR-0024: Game State Machine
**ADR Decision Summary**: Every transition emits `gsm.state.exited` with `{ from: previousState }` then `gsm.state.entered` with `{ from: previousState, to: newState }` in that order. Systems subscribe to these events — they never call `gsm.getCurrent()`. If Event Bus is unavailable, transition still completes with a warning.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer. Verified via `tsc --noEmit`. Depends on Event Bus interface (ADR-0001).

**Control Manifest Rules (this layer)**:

- Required: F24 (GSM emits 2 events per transition: `gsm.state.exited(old)` then `gsm.state.entered(new)`)
- Required: F20 (Event Bus is the ONLY cross-system pattern for state-change signals)
- Required: F23 (No system calls `gsm.getCurrent()` — all systems react to events via Event Bus)

---

## Acceptance Criteria

- [ ] On successful transition, GSM emits `'gsm.state.exited'` with payload `{ from: previousState }`
- [ ] On successful transition, GSM emits `'gsm.state.entered'` with payload `{ from: previousState, to: newState }`
- [ ] Events are emitted in strict order: exited BEFORE entered — this ordering is invariant under all conditions
- [ ] Event Bus dependency is injected via constructor — not hardcoded or imported as singleton
- [ ] If Event Bus is null/undefined, transition still completes and `console.warn` is logged with a message indicating the Event Bus is unavailable
- [ ] If Event Bus `emit()` throws, the error is caught and logged, transition still completes

---

## Implementation Notes

_Derived from ADR-0024 Implementation Guidelines:_

1. **Event names**: Use string constants for event names to avoid typos:
   ```typescript
   const GSM_STATE_EXITED = "gsm.state.exited";
   const GSM_STATE_ENTERED = "gsm.state.entered";
   ```
2. **Emit sequence**: After `currentState` is updated (or, for rollback, after `currentState` is restored), emit in order:
   ```typescript
   this._eventBus?.emit("gsm.state.exited", { from: previousState });
   this._eventBus?.emit("gsm.state.entered", {
     from: previousState,
     to: newState,
   });
   ```
3. **Optional Event Bus**: Constructor accepts `eventBus: EventBus | null | undefined`. Use TypeScript optional chaining (`this._eventBus?.emit(...)`) — if EB is null, the emit is a no-op.
4. **Warning on null EB**: In `transition()`, before the first emit, check if `this._eventBus` is null/undefined. If so, log once per first transition per session (not every transition — avoid log spam). Use a `_warnedEbMissing` flag.
5. **Catch emit errors**: Wrap `emit()` calls in try/catch. Log the error with `console.warn('[GSM] Event Bus emit failed:', error)`. The transition is NOT rolled back — the state change already happened.
6. **Injector pattern**: The GSM should not import Event Bus directly. The constructor receives an `EventBus` reference:
   ```typescript
   constructor(private readonly _eventBus: EventBus | null = null) { }
   ```
7. **Rollback re-emit**: Also applies during Story 002's rollback — if onEnter fails and state rolls back, re-emit `gsm.state.entered` for the restored state.
8. **Event type registration**: The EventMap type should include these events. This happens in the Event Bus epic (EventMap is the central type registry). GSM just uses the typed `emit()` method.
9. **File**: Extend `GameStateMachine.ts` with Event Bus integration.

---

## Out of Scope

- Subscription/`on()` calls — GSM is an emitter only (Story 001, 002 of Event Bus epic)
- Debug overlay consuming GSM events (Dev Tools epic, TR-DVT-005)
- Actual game systems reacting to GSM events (separate epics: Camera, HUD, Audio, etc.)

---

## QA Test Cases

- **AC-1**: Successful transition emits 'gsm.state.exited' with correct payload
  - Given: GSM initialized (currentState = 'Loading') with a mock Event Bus
  - When: GSM.transition('Menu') is called and succeeds
  - Then: Event Bus received exactly one 'gsm.state.exited' event; payload is `{ from: 'Loading' }`
  - Edge cases: Same-state no-op (exited NOT emitted); rollback (exited WAS emitted before rollback — verify)

- **AC-2**: Successful transition emits 'gsm.state.entered' with correct payload
  - Given: GSM initialized (currentState = 'Loading') with a mock Event Bus
  - When: GSM.transition('Menu') is called and succeeds
  - Then: Event Bus received exactly one 'gsm.state.entered' event; payload is `{ from: 'Loading', to: 'Menu' }`
  - Edge cases: Payload shape is exact `{ from: string, to: string }` (no extra fields); rollback re-emit has `{ to: previousState }`

- **AC-3**: Events emitted in order: exited BEFORE entered
  - Given: GSM initialized (currentState = 'Loading') with ordered-event spy
  - When: GSM.transition('Menu') is called
  - Then: The event log shows `['gsm.state.exited', 'gsm.state.entered']`; order is NEVER reversed
  - Edge cases: Chain of 2 transitions (log shows exited, entered, exited, entered); same-state no-op (log empty); ordering within same synchronous call stack

- **AC-4**: Event Bus dependency injected via constructor
  - Given: TypeScript source code for GSM
  - When: Inspecting the constructor signature
  - Then: Constructor accepts Event Bus parameter; no import of Event Bus singleton within GSM module; GSM does not create its own Event Bus

- **AC-5**: Event Bus unavailable — transition completes, warning logged
  - Given: GSM initialized with `eventBus = null`
  - When: GSM.transition('Menu') from Loading
  - Then: GSM.currentState is 'Menu' (transition succeeded); console.warn was called with message containing 'Event Bus'; no crash or reference error
  - Edge cases: EB undefined (not just null); EB available at init, unavailable later (handled by emit() throw case); subsequent transitions while EB unavailable

- **AC-6**: Event Bus emit() throws — error caught, transition completes
  - Given: GSM initialized with mock EB whose emit() throws on first call
  - When: GSM.transition('Menu') from Loading
  - Then: GSM.currentState is 'Menu'; warning logged about emit failure; no uncaught exception propagates
  - Edge cases: emit() throws for 'gsm.state.exited' only (entered still attempted); both emits throw (both caught); emit() throws destructively (non-Error value)

---

## QA Test Cases

**Test file**: `tests/integration/gsm.test.ts`

### AC-1: events emitted on Event Bus
- Transition Loading → Menu
- Assert: `gsm.state.exited` event on Event Bus with `from: 'Loading'`
- Assert: `gsm.state.entered` event on Event Bus with `from: 'Loading', to: 'Menu'`

### AC-2: event payload structure
- Verify `gsm.state.entered` payload contains `from` and `to` state names
- Assert: both fields are strings, `to` matches target state

### AC-3: all transitions visible
- Execute all valid transitions in GSM table
- Assert: each transition produces corresponding events on Event Bus

## Test Evidence
## Dependencies

- **Depends on**: Story 001 (core-fsm-transition-table) — requires working transitions; Story 002 (async-lifecycle-hooks) — requires hook execution and rollback re-emission
- **Unlocks**: Story 004 (transition-throttling), Story 005 (state-history-ring-buffer)
