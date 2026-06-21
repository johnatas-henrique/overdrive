# Event Bus

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Foundation — communication backbone for all systems

## Overview

The Event Bus is a typed publish-subscribe system. Every event is defined as a property on a global `EventMap` interface — adding a new event is a type declaration, nothing more. Subscribers register typed handlers (`on<EventType>(handler)`) and publishers dispatch (`emit(event)`). Dispatch is synchronous: by the time `emit()` returns, all subscribers have executed. The bus provides `once()` for one-shot subscriptions, `off()` for explicit cleanup, and a built-in leak detector that warns when a system disposes without unregistering its handlers. No wildcard subscriptions (`on('*')`) are allowed — event types must always be explicit.

## Player Fantasy

_For infrastructure systems, the "player" is the developer using this API._

Every system communicates without knowing the others exist. Fuel doesn't know about HUD — it just emits `{ type: 'fuel.low', data: { lap: 3 } }`. The HUD team adds a new indicator by subscribing, not by modifying Fuel's code. When something breaks, the event inspector shows exactly which events fired and who was listening. New features are wired by adding a subscriber — zero changes to existing systems.

## Detailed Design

### Core Rules

**1. EventMap.** Every event type is declared as a property on a global `EventMap` interface. TypeScript enforces that `emit('fuel.low', ...)` uses the correct payload type and that `on('fuel.low', handler)` receives the same. Adding a new event is a one-line type declaration — no registration, no boilerplate.

**2. Synchronous dispatch.** `emit()` executes all registered handlers in registration order, on the same call stack. If a handler throws, the error is caught and logged individually — other handlers still execute. There is no async queuing, no microtask deferral. Synchronous dispatch eliminates race conditions between publisher and subscriber.

**3. Single payload.** Every event carries exactly one argument: `emit('fuel.low', { lap: 3, percentage: 0.15 })`. No variadic arguments. This simplifies typing and prevents argument-order bugs.

**4. Mandatory cleanup.** `on()` returns a `Subscription` object with `.unsubscribe()`. When a system is disposed without unsubscribing its handlers, the leak detector emits a warning. A system that does not clean up its subscriptions is a bug — stale handlers keep references to destroyed objects and cause unpredictable behavior.

### States and Transitions

```
[Uninitialized] --init()--> [Ready] --dispose()--> [Disposed]
```

| State             | Description                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| **Uninitialized** | Event bus not yet created. `on()`, `emit()`, `off()` all throw `EventBusError('Not initialized')`. |
| **Ready**         | Bus is operational. Subscriptions can be registered, events dispatched.                            |
| **Disposed**      | All subscriptions are automatically cleaned up. No further calls allowed.                          |

**Transitions:**

- Uninitialized → Ready: `EventBus.init()` called
- Ready → Disposed: `EventBus.dispose()` called — unsubscribes all handlers, frees references. Systems should have already unsubscribed; the leak detector fires warnings for any remaining subscriptions.

### Interactions with Other Systems

The Event Bus is the communication backbone of the entire game. Every system that needs to react to or announce state changes interacts with it in exactly one of two roles:

1. **Publisher:** calls `emit(eventName, payload)` when something happens (fuel low, collision detected, race finished, lap completed)
2. **Subscriber:** calls `on(eventName, handler)` during its own initialization to react to events from other systems

The Event Bus itself has zero knowledge of any system. It neither knows who publishes nor who subscribes. This is enforced by design — the bus is pure infrastructure.

**Known interactions (non-exhaustive — grows with each new system):**

- Fuel → All: `'car.fuel_empty'`
- Tire Wear → All: `'car.tire_blown'`
- Physics/Handling → All: `'car.stopped'`
- Collision → All: `'collision.impact'`
- Race Management → All: `'race.starting'`, `'race.light.countdown'`, `'race.green.flag'`, `'race.checkered'`, `'race.completed'`, `'car.lap.completed'`, `'car.dnf'`, `'position.changed'`
- Pit Stop → All: `'pit.entry'`, `'pit.exit'`, `'pit.status'`, `'pit.fuel_status'`, `'pit.tire_status'`, `'car.stalled_in_pit'`
- GSM → All: `'gsm.state.entered'`, `'gsm.state.exited'`
- Entity/Car Lifecycle → All: `'entity.spawned'`, `'entity.despawned'`

## Formulas

None. The Event Bus does not compute or transform data — it routes typed payloads from publishers to subscribers.

## Edge Cases

1. **Subscribe during dispatch.** A handler registered inside another handler's execution does not receive the current event — it only activates for subsequent dispatches. This prevents infinite loops and ensures deterministic iteration.
2. **Unsubscribe during dispatch.** Removing a handler that is currently executing does not cancel its execution — the current handler runs to completion. It is removed from all future dispatches.
3. **Handler throws during dispatch.** The error is caught, logged, and the remaining handlers still execute. One broken subscriber never silences others.
4. **Circular emit.** Handler A emits event B → Handler B emits event A. The bus detects the cycle by counting emit depth per tick and throws `EventBusError('Max emit depth exceeded')` after a configurable limit (default: 10). The current dispatch chain is aborted.
5. **Memory leak — stale subscriptions.** A system that is destroyed without unsubscribing leaves dangling references. The leak detector at `dispose()` logs every namespace that has active subscriptions. Prevention is mandatory — each `on()` returns a `Subscription` that the subscriber MUST call during its own cleanup.
6. **Event name collision.** Two systems accidentally using the same event name `'fuel.low'` with different payload types. Prevented by the EventMap interface — only one type declaration per event name is possible, and `emit()`/`on()` are checked against it.

## Dependencies

**Zero.** The Event Bus is a standalone utility with no engine or library dependency. It initializes before any other system.

## Tuning Knobs

None for gameplay. Developer-facing parameters:

- **Max emit depth** (default: 10) — circular dependency detection threshold
- **Leak detection level** (dev: `warn`, prod: `silent`) — whether to log unsubscription warnings

## Visual/Audio Requirements

None. The Event Bus produces no visual or audio output.

## UI Requirements

**Debug Overlay integration** — live event inspector showing:

- Firing order of recent events (last 100), newest first
- For each event: timestamp, event name, payload (collapsed JSON)
- Subscriber count per event type
- Total events dispatched this session
- Depth warnings when circular emit threshold is approached

The inspector hooks into `emit()` internally — it is not a subscriber itself, so it does not count toward subscriber metrics.

## Acceptance Criteria

1. `EventBus.init()` makes the bus operational; `EventBus.dispose()` cleans up all subscriptions.
2. `on('race.finish', handler)` followed by `emit('race.finish', data)` executes the handler with the correct payload.
3. Multiple subscribers on the same event all fire in registration order.
4. `once('race.finish', handler)` fires exactly once — second `emit` does not execute it.
5. `off()` removes a specific handler; subsequent emits do not fire it.
6. `emit()` on an event with zero subscribers succeeds silently — no error.
7. Subscribe during dispatch does not receive the current event; unsubscribe during dispatch does not cancel the current handler.
8. A handler that throws does not prevent other handlers from executing.
9. Circular emit (depth > 10) throws `EventBusError('Max emit depth exceeded')`.
10. `dispose()` warns if any system still has active subscriptions (leak detection).
11. `emit('fuel.low', wrongPayload)` fails at compile time (TypeScript), not runtime.

## Open Questions

None yet.
