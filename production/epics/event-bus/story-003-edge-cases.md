# Story 003: Edge Cases

> **Epic**: Event Bus
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/event-bus.md`
**Requirements**:

- `TR-EVB-004` (Leak detection at `dispose()` — partial; `Subscription.unsubscribe()` covered by Story 002)
- `TR-EVB-005` (Circular emit depth detection, configurable, default 10)
- `TR-EVB-006` (`once()` fires exactly one emit then auto-unsubscribes; `off()` on once-returned Subscription)
- `TR-EVB-007` (Subscribe during dispatch does not receive current event; unsubscribe during dispatch does not cancel current handler)

**ADR Governing Implementation**: ADR-0001: Event Bus Architecture
**ADR Decision Summary**: Invariant 4 — `off()` is idempotent. Leak detector warns on `dispose()` if subscriptions remain. Circular emit guard with configurable depth (default 10). Handler subscribed during dispatch does NOT receive current event. Unsubscribe during dispatch does not cancel current execution.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer.

**Control Manifest Rules (this layer)**:

- Required: F9 — Handler subscribed during dispatch does NOT receive current event
- Forbidden: F-F6 — Never use async Event Bus (breaks frame ordering)
- Guardrail: F-G1 — Event Bus < 1 KB gzipped

---

## Acceptance Criteria

_From GDD `design/gdd/event-bus.md`, scoped to this story:_

- [ ] AC-4a: `once('race.finish', handler)` fires exactly once — second `emit` does not execute it
- [ ] AC-4b: `off()` on a `Subscription` returned by `once()` works correctly; calling `off()` twice on the same `Subscription` is safe (ADR-0001 Invariant 4 — idempotent)
- [ ] AC-7a: A handler subscribed during dispatch does NOT receive the current event — it only activates for subsequent dispatches
- [ ] AC-7b: Unsubscribe during dispatch does not cancel the currently-executing handler — it runs to completion; the handler is removed from all future dispatches
- [ ] AC-9a: Circular emit (depth > default 10) throws `EventBusError('Max emit depth exceeded')`; depth exactly = 10 succeeds
- [ ] AC-9b: Max emit depth is configurable via a constructor parameter (default: 10)
- [ ] AC-10a: `dispose()` warns via `console.warn` if any subscriptions remain; the warning identifies the active subscription namespace(s)
- [ ] AC-10b: Leak detection level can be set to `'silent'` (production) — `console.warn` is NOT called in silent mode

---

## Implementation Notes

_Derived from ADR-0001 Implementation Guidelines:_

1. **once()**: Wrap the user's handler in a function that calls `unsubscribe()` before calling the handler, then delegates to the wrapped handler. Register the wrapper via the same `on()` mechanism:

   ```typescript
   once<E extends keyof EventMap>(event: E, handler: Handler<E>): Subscription {
     const wrapper = (payload: EventMap[E]) => {
       sub.unsubscribe();
       handler(payload);
     };
     const sub = this.on(event, wrapper);
     return sub; // return the original Subscription so off() works on it
   }
   ```

2. **Subscribe during dispatch**: Handled naturally by iterating a snapshot of the handler Set. Convert to array at dispatch start — any new subscriptions added mid-dispatch won't be in the snapshot.

3. **Unsubscribe during dispatch**: Same snapshot approach — the removed handler is still in the snapshot array and runs to completion. The `Set` no longer contains it, so future dispatches skip it.

4. **Circular emit detection**: Maintain a depth counter on the `EventBus` instance:
   - Increment on every `emit()`, decrement on return
   - If `depth > maxDepth` (default 10), throw `EventBusError('Max emit depth exceeded')` and reset depth to 0 (abort chain)
   - Configurable via constructor: `new EventBus({ maxEmitDepth: 10 })`
   - After a circular emit abort, subsequent emits work normally (depth reset)

5. **Leak detection at dispose()**: Before clearing the handler maps, check if any event has subscribers. If so, `console.warn` with the event names that have active subscriptions. Track "namespace" via the event name prefix (e.g., `'race.'`, `'car.'`, `'pit.'`) for grouping.
   - Configurable leak detection level: `'warn'` (default, dev mode) or `'silent'` (production)
   - `once()` subscriptions that already auto-unsubscribed are not counted

6. **File location**: `src/foundation/event-bus/event-bus.ts` (same class as Story 002 — these are methods on the main class).

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 001]: Type definitions (EventMap, IEventBus, Subscription interfaces, EventBusError class)
- [Story 002]: Core Event Bus — `init()`, `dispose()` lifecycle, basic `emit()`/`on()`/`off()`, Subscription.unsubscribe() implementation, handler error isolation, zero-subscriber silent success
- `dispose()` during in-flight dispatch (a handler calling `dispose()` while executing) — deferred: Story 002's snapshot iteration provides natural protection, but explicit verification is out of scope here

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**AC-4a: once() fires exactly once**

- Given: Initialized `EventBus`, a handler with call counter registered via `once('race.finish')`
- When: `emit('race.finish', data)` called twice
- Then: First `emit` fires handler (counter=1); second `emit` does NOT fire handler (counter=1)
- Edge: `once()` on an event with other `on()` subscribers — `once()` handler fires once; `on()` handlers fire both times
- Edge: `once()` registration, event is never emitted — no memory leak after `dispose()` (leak detection does not warn for `once()` subscriptions that never fired)
- Edge: `once()` handler calls `on()` for same event inside itself — `on()` handler does NOT fire for this emit (covered by AC-7a)

**AC-4b: off() on once()-returned Subscription**

- Given: Initialized `EventBus`, handler registered via `once('race.finish')`, capturing the returned `Subscription`
- When: `off(subscription)` is called before any `emit()`, then `emit('race.finish', data)`
- Then: Handler never fires (unsubscribed before first emit)
- Edge: `off()` called twice on same once-Subscription — idempotent, no error (ADR-0001 Invariant 4)
- Edge: `once()` Subscription that auto-unsubscribed (after first emit), `off()` on it after — no error, safe

**AC-7a: Subscribe during dispatch does not receive current event**

- Given: Initialized `EventBus`, handler A registered via `on('evt')`; A subscribes handler B to same event during its execution
- When: `emit('evt', data)` — A executes, subscribes B during dispatch
- Then: A receives the current event, B does NOT receive the current event; on a second `emit('evt', data)`, B receives it
- Edge: Multiple handlers A1, A2 — A1 subscribes B, A2 subscribes C during same dispatch — B and C neither fire now; both fire on subsequent emit
- Edge: A subscribes to a _different_ event during dispatch — that subscription is immediate and independent; does not affect current event's dispatch

**AC-7b: Unsubscribe during dispatch does not cancel current handler**

- Given: Initialized `EventBus`, handlers A and B registered on `'evt'`
- When: During handler A's execution, A calls `off(B_subscription)`; then `emit` returns
- Then: Handler B still executes this time (was in the snapshot when dispatch started); on next `emit('evt')`, B does NOT execute
- Edge: Handler removes itself during dispatch — A still runs to completion; A is removed from the Set so future emits skip it
- Edge: All handlers remove themselves during dispatch — all run once; queue is empty for next emit

**AC-9a: Circular emit detection (default depth 10)**

- Given: Initialized `EventBus` (default `maxEmitDepth=10`); handler A emits event B; handler B emits event A
- When: `emit('a', data)` is called
- Then: After 10 nested emits (depth=10), the next emit at depth=11 throws `EventBusError('Max emit depth exceeded')`
- Edge: Depth exactly 10 succeeds — only depth > 10 throws
- Edge: Three-event cycle (A→B→C→A) — still detected at depth 10 (counts total emit depth, not per-event)
- Edge: After deep emit throws, subsequent normal `emit()` works (depth counter reset, no permanent breakage)

**AC-9b: Configurable max emit depth**

- Given: Initialized `EventBus` with `maxEmitDepth=3`; handler A emits B; handler B emits A
- When: `emit('a', data)` is called
- Then: After 3 nested emits, throws `EventBusError('Max emit depth exceeded')`
- Edge: `maxEmitDepth=1` — even a single nested emit causes immediate abort
- Edge: Verify default is 10 when no config provided

**AC-10a: Leak detection warns on dispose with active subscriptions**

- Given: Initialized `EventBus`, handler registered via `on('race.finish')`
- When: `dispose()` is called without calling `off()` first
- Then: `console.warn` is called with a message indicating active subscription(s); the message includes the event name or namespace

**AC-10b: Leak detection level silent (production) suppresses warning**

- Given: Initialized `EventBus` with `leakDetectionLevel='silent'`, handler registered via `on('race.finish')`
- When: `dispose()` is called without calling `off()` first
- Then: No `console.warn` call — warning is suppressed
- Edge: Default leak detection level is `'warn'` in dev mode, produces warnings

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:

- Logic: `tests/unit/event-bus/edge-cases.test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002 (Core Event Bus — provides the `EventBus` class with `init()`, `emit()`, `on()`, `off()`, `dispose()`)
- Unlocks: All Foundation and Core systems that rely on `once()`, circular emit safety, and leak detection
