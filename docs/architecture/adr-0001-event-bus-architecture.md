# ADR-0001: Event Bus Architecture

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                  |
| ------------------------- | -------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                      |
| **Domain**                | Core (TypeScript)                      |
| **Knowledge Risk**        | LOW                                    |
| **References Consulted**  | VERSION.md — no engine-specific domain |
| **Post-Cutoff APIs Used** | None                                   |
| **Verification Required** | None                                   |

## ADR Dependencies

| Field             | Value                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| **Depends On**    | None                                                                                           |
| **Enables**       | ADR-0002 (Determinism Pipeline), ADR-0004 (Module Boundaries), ADR-0005 (Entity/Car Lifecycle) |
| **Blocks**        | All Foundation and Core systems that communicate via events                                    |
| **Ordering Note** | Must be written before any system that emits or subscribes to events                           |

## Context

### Problem Statement

24 game systems need to exchange state-change signals without creating circular module dependencies (e.g., Collision emits `collision.impact` → Audio plays SFX; Audio must never import Collision). The system needs typed, debuggable, zero-dependency pub-sub that preserves the Foundation layer's promise of pure TypeScript with no third-party imports.

### Constraints

- Must be pure TypeScript — zero Babylon.js imports (Foundation requirement)
- Zero third-party dependencies — Foundation layer must remain dependency-free
- Synchronous dispatch — no microtask/macrotask queuing that breaks frame order
- Must support 25+ event types without boilerplate explosion
- Must detect subscriber leaks (forgotten `on()` — system disposed but still listening)
- Type-safe: wrong payload shape must be a compile error
- Runtime size budget: under 1 KB gzipped

### Requirements

- 25+ event types from 11 producer systems
- Subscribe-once (`once()`), unsubscribe (`off()`)
- `emit()` returns only after all handlers execute
- Payload is `{ carId }` or light identity — never heavy data (speed, fuelLevel)
- Handlers must not receive current event if subscribed during dispatch

## Decision

Use a **typed Event Bus** with a global `EventMap` type registry, synchronous `emit()`, and a disposable `Subscription` pattern. The Event Bus is a single shared instance initialized during Foundation Phase 0 init (slot #4). Estimated implementation: ~150 lines of TypeScript.

The same functionality could be achieved with a 200-byte library (mitt) plus ~25 lines of wrapper, but zero dependencies is the deciding factor: the Foundation layer must remain importable in a bare `vitest` environment with no npm-installed packages.

### Architecture

```
Producer                    Event Bus                     Consumer
  │                           │                             │
  │── emit('car.fuel_empty',  │                             │
  │    { carId: 'player' }) ──→  iterate subscriber list ───→ handler(payload)
  │                           │                             │
  │                           └── all handlers run ─────────→ return to producer
  │                           │        before emit() returns │
```

### Key Interfaces

```typescript
interface IEventBus {
  on<E extends keyof EventMap>(
    event: E,
    handler: (payload: EventMap[E]) => void
  ): Subscription;
  once<E extends keyof EventMap>(
    event: E,
    handler: (payload: EventMap[E]) => void
  ): Subscription;
  emit<E extends keyof EventMap>(event: E, payload: EventMap[E]): void;
  off(handler: Subscription): void;
  dispose(): void;
}

interface Subscription {
  unsubscribe(): void;
}
```

### EventMap (Central Type Registry)

```typescript
type EventMap = {
  "gsm.state.entered": { state: string; previous: string };
  "gsm.state.exited": { state: string; next: string };
  "entity.spawned": { carId: string };
  "entity.despawned": { carId: string };
  "collision.impact": { carIdA: string; carIdB: string; impulse: number };
  "car.fuel_empty": { carId: string };
  "car.tire_blown": { carId: string };
  "car.stopped": { carId: string };
  "pit.entry": { carId: string };
  "pit.exit": { carId: string };
  "pit.status": { carId: string; status: PitState };
  "pit.fuel_status": { carId: string; progress: number };
  "pit.tire_status": { carId: string; progress: number };
  "position.changed": { carId: string; old: number; new: number };
  "car.lap.completed": { carId: string; lap: number; lapTime: number };
  "car.dnf": { carId: string; reason: string };
  "car.stalled_in_pit": { carId: string };
  "race.starting": {};
  "race.light.countdown": { lightsOn: number };
  "race.green.flag": {};
  "race.completed": { results: RaceResults };
  "race.checkered": { carId: string; lap: number; results: RaceResults };
  "race.abandoned": {};
  "asset.error": { assetId: string; error: Error };
};
```

### Invariants

1. `emit()` executes all handlers synchronously — same call stack, same frame
2. A handler subscribed during dispatch does NOT receive the current event
3. A handler that throws does not affect other handlers (try/catch per handler)
4. `off()` is idempotent — calling twice on same Subscription is safe
5. `dispose()` unsubscribes all handlers — called during app teardown
6. Leak detector: warn (console.warn) if a system is disposed without unsubscribing

## Alternatives Considered

### Alternative 1: Direct Method Calls (No Event Bus)

- **Description:** Systems import each other's interfaces and call methods directly
- **Pros:** Zero overhead, full type safety, easy to trace in debugger
- **Cons:** Creates circular module imports (Audio imports Collision → Collision imports Audio), breaks the Foundation → Core → Presentation init order, impossible to test systems in isolation without instantiating their dependents
- **Rejection Reason:** Circular dependencies violate the dependency graph and make init ordering impossible to validate

### Alternative 2: Typed Third-Party Library (mitt v3+)

- **Description:** Use `mitt` (200 bytes) with a generic Events map plus thin wrapper for `once()` and leak detection
- **Pros:** Battle-tested, 200 bytes, supports generic type maps since v3, simple API
- **Cons:** Adds a dependency to the Foundation layer (breaks the zero-dependency rule), leak detection and `once()` require ~25 lines of wrapper code anyway, generic `Events` map is slightly less ergonomic than a single `EventMap` for discoverability
- **Rejection Reason:** Zero dependencies is a Foundation constraint — the Event Bus must work in a bare vitest environment with no npm-installed packages. The 25 lines of wrapper needed over mitt are comparable to the 150 lines of a purpose-built Event Bus, so the dependency offers no significant savings.

### Alternative 3: Third-Party Library (EventEmitter3)

- **Description:** Use EventEmitter3 (~1.5 KB) — the standard Node.js EventEmitter pattern
- **Pros:** Battle-tested, well-known API (on/emit/off/once), includes `once()` natively
- **Cons:** Largest dependency, no compile-time type safety for event names or payloads (string-keyed only), class-based API requires extending EventEmitter3 or wrapping it
- **Rejection Reason:** Loss of type safety is unacceptable for a 25+ event system. Every event has a distinct payload — untyped `emit('anyString', any)` would lead to runtime payload mismatches that are invisible until playtesting.

## Consequences

### Positive

- All event contracts visible in one `EventMap` type — no hunting for event definitions
- Zero engine dependency — testable with `vitest` alone, no browser needed
- Synchronous dispatch guarantees no frame-order corruption
- Leak detection prevents silent bugs from orphaned subscriptions

### Negative

- 25+ event types in one `EventMap` makes the file large (but grepable)
- Synchronous dispatch means a slow handler blocks all other handlers
- Custom code (~150 lines) instead of a 200-byte library

### Risks

- **Risk:** A handler blocks the pipeline by doing heavy work synchronously
  **Mitigation:** Handlers must be lightweight (state updates, flag sets). Heavy work (file I/O, network, assertion checks) is forbidden inside handlers. Dev Tools will warn if any handler exceeds 1ms.

## GDD Requirements Addressed

| GDD System     | Requirement                            | How This ADR Addresses It                                                          |
| -------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| event-bus.md   | Typed event system with typed payloads | `EventMap` registry provides compile-time type safety per event                    |
| event-bus.md   | Synchronous dispatch                   | `emit()` runs all handlers on same call stack                                      |
| event-bus.md   | Leak detection                         | `dispose()` + console.warn on orphaned subscription                                |
| event-bus.md   | Subscription lifecycle                 | `Subscription.unsubscribe()` with idempotent `off()`                               |
| All 24 systems | Event payload convention               | Payload limited to `{ carId }` or identity-only — per-frame data via direct getter |

## Performance Implications

- **CPU:** O(n) per event where n = subscribers for that event. At 60fps with average 2 subscribers per event: negligible (<0.01ms/frame total).
- **Memory:** One function reference per subscriber. 25 events × 2 avg subscribers = 50 function references (~400 bytes). Leak detection adds one WeakRef per system registration (~40 bytes per system).
- **Load Time:** Zero — no files to load, no async initialization.

## Migration Plan

First implementation is greenfield — no existing code to migrate. Future migrations (e.g., to a Web Worker for threaded processing) would add a `postMessage` bridge behind the same `IEventBus` interface.

## Validation Criteria

- [ ] `emit()` fires all subscribed handlers in the same frame
- [ ] `once()` fires exactly once, then auto-unsubscribes
- [ ] Handler subscribed during dispatch does not receive current event
- [ ] `off()` on the same subscription twice is safe (no error, no double unsubscribe)
- [ ] `dispose()` removes all subscriptions for a system
- [ ] TypeScript compile error: wrong payload shape passed to `emit()`
- [ ] TypeScript compile error: non-existent event name in `on()`

## Related Decisions

- Architecture.md (docs/architecture/architecture.md) — API Boundaries: IEventBus, EventMap, Subscription
- Architecture.md (docs/architecture/architecture.md) — Data Flow: Event/Signal Path table
