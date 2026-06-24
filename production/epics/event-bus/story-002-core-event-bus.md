# Story 002: Core Event Bus

> **Epic**: Event Bus
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/event-bus.md`
**Requirements**: `TR-EVB-002` (Synchronous dispatch, error isolation), `TR-EVB-004` (Subscription pattern — `on()` returns `Subscription`), `TR-EVB-006` (`off()` removes specific handler, partial)

**ADR Governing Implementation**: ADR-0001: Event Bus Architecture
**ADR Decision Summary**: Synchronous `emit()` executes all handlers in registration order on the same call stack. Handler errors are caught individually — remaining handlers still execute. `on()` returns `Subscription` with `unsubscribe()`. `off()` is idempotent. Leak detector (handled in Story 003). State machine: Uninitialized → Ready → Disposed.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer.

**Control Manifest Rules (this layer)**:

- Required: F7 — Event Bus synchronous emit (no microtask/macrotask queuing), F8 — Subscription pattern
- Forbidden: F-F6 — Never use async Event Bus (microtask/macrotask) — breaks frame ordering, F-F7 — Never use third-party library for Event Bus
- Guardrail: F-G1 — Event Bus < 1 KB gzipped

---

## Acceptance Criteria

_From GDD `design/gdd/event-bus.md`, scoped to this story:_

- [ ] AC-1a: `EventBus.init()` transitions Uninitialized → Ready; `dispose()` transitions Ready → Disposed
- [ ] AC-1b: `emit()`, `on()`, `off()` called before `init()` throw `EventBusError('Not initialized')`; called after `dispose()` throw `EventBusError('Already disposed')`
- [ ] AC-1c: `init()` and `dispose()` are idempotent — second call is a safe no-op (no error, no double-cleanup)
- [ ] AC-2: `on('race.finish', handler)` followed by `emit('race.finish', data)` executes the handler with the correct payload
- [ ] AC-3: Multiple subscribers on the same event all fire in registration order
- [ ] AC-5: `off()` removes a specific handler; subsequent emits do not fire it; calling `off()` twice on the same `Subscription` is safe (idempotent)
- [ ] AC-6: `emit()` on an event with zero subscribers succeeds silently — no error
- [ ] AC-8: A handler that throws does not prevent other handlers from executing — all handlers are attempted; error is logged per handler

---

## Implementation Notes

_Derived from ADR-0001 Implementation Guidelines:_

1. **Internal storage**: `Map<keyof EventMap, Set<Handler>>` — one `Set` per event type for O(1) registration/deregistration and deterministic registration-order iteration.
2. **State tracking**: Three states — `'uninitialized' | 'ready' | 'disposed'`. Guard every public method against the current state.
3. **init()**: Sets state to `'ready'`. Must be called before any other operation. Second call is no-op.
4. **dispose()**: Clears all handler maps. Sets state to `'disposed'`. Second call is no-op. Leak detection warning is handled in Story 003.
5. **emit()**: Iterates a **snapshot** of the handler Set (convert to array at dispatch start) to handle concurrent mutations. This naturally prevents subscribe-during-dispatch and unsubscribe-during-dispatch issues (Story 003 verifies these).
6. **Error isolation**: Wrap each handler call in try/catch. Log the error to `console.error` (or a logging callback if one is configured). Do not re-throw.
7. **on()**: Adds handler to the Set for the given event. Returns `Subscription` with `unsubscribe()` that removes that handler from the event's Set.
8. **off()**: Receives `Subscription`, delegates to `subscription.unsubscribe()`. Idempotent — calling twice does nothing.
9. **Zero subscribers on emit()**: Just return. No error, no allocation. Guard is `if (!handlers || handlers.size === 0) return;`.
10. **File location**: `src/foundation/event-bus/event-bus.ts` — the main EventBus class.
11. **Bundle size target**: < 1 KB gzipped. Keep implementation concise (~80-100 lines).
12. **No async/await, no Promises, no setTimeout/requestAnimationFrame/microtask** — all dispatch is synchronous.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 001]: Type definitions (EventMap, IEventBus, Subscription interfaces, EventBusError class)
- [Story 003]: `once()` auto-unsubscribe, subscribe/unsubscribe during dispatch edge cases, circular emit depth detection, leak detection warnings on `dispose()`

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**AC-1a: init/dispose lifecycle**

- Given: A fresh `EventBus` instance (uninitialized state)
- When: `init()` is called
- Then: The bus enters Ready state — `on()` and `emit()` become operational
- Given: An initialized `EventBus` in Ready state
- When: `dispose()` is called
- Then: All subscriptions are cleaned up; bus enters Disposed state
- Edge: `init()` called twice — second call is safe no-op (state remains Ready, no error)

**AC-1b: Guards on uninitialized/disposed state**

- Given: An uninitialized `EventBus`
- When: `emit('race.finish', { carId: 'player' })` is called
- Then: Throws `EventBusError('Not initialized')`
- Given: An uninitialized `EventBus`
- When: `on('race.finish', handler)` is called
- Then: Throws `EventBusError('Not initialized')`
- Given: A disposed `EventBus`
- When: `emit('race.finish', { carId: 'player' })` is called
- Then: Throws `EventBusError('Already disposed')`
- Given: A disposed `EventBus`
- When: `on('race.finish', handler)` is called
- Then: Throws `EventBusError('Already disposed')`

**AC-1c: Idempotent init/dispose**

- Given: An initialized `EventBus` in Ready state
- When: `init()` is called again
- Then: No error, bus stays in Ready state, existing subscriptions intact
- Given: A disposed `EventBus`
- When: `dispose()` is called again
- Then: No error, bus stays in Disposed state

**AC-2: Basic subscribe + emit with correct payload**

- Given: Initialized `EventBus`, a handler variable `result` that captures its argument
- When: `on('race.finish', (data) => { result = data; })` then `emit('race.finish', { winnerId: 'player' })`
- Then: Handler is called with `{ winnerId: 'player' }`
- Edge: Payload with multiple fields — all fields present in handler
- Edge: Empty payload `emit('race.starting', {})` — handler receives `{}`
- Edge: `emit()` returns `void` — confirm return type is `undefined`

**AC-3: Multiple subscribers fire in registration order**

- Given: Initialized `EventBus`
- When: Three handlers A, B, C are registered in sequence via `on('race.finish')`, then `emit('race.finish', data)`
- Then: Handler A executes first, then B, then C (execution order tracked via a shared array)
- Edge: 0 subscribers → `emit()` succeeds silently (overlaps AC-6)
- Edge: 25+ subscribers — all execute in registration order

**AC-5: off() removes specific handler**

- Given: Initialized `EventBus`, handlers A and B registered on `'race.finish'`
- When: `off(A_subscription)` is called, then `emit('race.finish', data)`
- Then: Handler B executes, Handler A does NOT execute
- Edge: `off()` on already-removed subscription — no error, no effect (idempotent)
- Edge: `off()` on a `Subscription` from a different event — other subscribers unaffected

**AC-6: emit() with zero subscribers**

- Given: Initialized `EventBus`, no subscribers on `'race.finish'`
- When: `emit('race.finish', { winnerId: 'player' })` is called
- Then: No error is thrown, returns `undefined`
- Edge: `emit('race.finish')` called 1000 times with 0 subscribers — no memory leak
- Edge: `emit()` on event name that previously had subscribers but all were removed

**AC-8: Handler throw does not prevent other handlers**

- Given: Initialized `EventBus`, three handlers on `'race.finish'`: A (throws `Error('fail')`), B (appends to execution log), C (throws `Error('fail2')`)
- When: `emit('race.finish', data)`
- Then: A throws (logged via `console.error`), B executes normally and receives correct payload, C throws (logged). All three handlers attempted.
- Edge: All handlers throw — no uncaught exception propagates to `emit()` caller
- Edge: Handler throws non-`Error` value (e.g., `throw "string"`) — still caught, other handlers unaffected
- Edge: `console.error` is called for each thrown handler — verify logging occurred

---

## QA Test Cases

**Test file**: `tests/unit/event-bus.test.ts`

### AC-1: init() and dispose()
- Call `EventBus.init()`
- Assert: bus operational (subscribing and emitting works)
- Call `EventBus.dispose()`
- Assert: all subscriptions cleaned up

### AC-2: on() + emit()
- Subscribe to `'race.finish'` with handler
- Emit `'race.finish'` with payload
- Assert: handler executes with correct payload

### AC-3: multiple subscribers
- Subscribe 3 handlers to same event
- Emit event
- Assert: all 3 fire in registration order

### AC-4: once() fires once
- Subscribe with `once('race.finish', handler)`
- Emit twice
- Assert: handler fires exactly once

### AC-5: off() removes subscription
- Subscribe, then `off()` before emit
- Assert: handler does not fire

### AC-6: subscribe during dispatch
- Start dispatch, handler A subscribes handler B for same event
- Assert: handler B does not receive current event (activates next dispatch only)

### AC-7: unsubscribe during dispatch
- Start dispatch, handler A unsubscribes itself
- Assert: handler A runs to completion for current dispatch
- Assert: handler A removed from future dispatches

## Test Evidence
## Dependencies

- Depends on: Story 001 (Event Types and Contracts — provides `EventMap`, `IEventBus`, `Subscription`, `EventBusError`)
- Unlocks: Story 003 (Edge Cases), all Foundation and Core systems that emit/subscribe to events
