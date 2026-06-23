# Story 001: Event Types and Contracts

> **Epic**: Event Bus
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/event-bus.md`
**Requirements**: `TR-EVB-001` (Typed EventMap), `TR-EVB-003` (Single payload), `TR-EVB-008` (Zero deps)

**ADR Governing Implementation**: ADR-0001: Event Bus Architecture
**ADR Decision Summary**: Synchronous emit, Subscription pattern, EventMap central type registry (25+ events), leak detection on dispose. Zero-dependency constraint: Foundation layer must remain importable in bare vitest environment.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer. No engine imports permitted anywhere in this file.

**Control Manifest Rules (this layer)**:

- Required: F7 — Event Bus synchronous emit, F8 — Subscription pattern, F10 — EventMap central type registry
- Forbidden: F-F7 — Never use third-party library for Event Bus
- Guardrail: F-G1 — Event Bus < 1 KB gzipped

---

## Acceptance Criteria

_From GDD `design/gdd/event-bus.md`, scoped to this story:_

- [ ] AC-11a: `emit('fuel.low', wrongPayload)` fails at compile time — TypeScript type error on payload mismatch
- [ ] AC-11b: `on('fuel.low', handler)` is compile-time checked — handler receives the correct payload type
- [ ] AC-11c: Non-existent event name in `emit()` or `on()` is a compile error
- [ ] TR-EVB-008: Zero imports from Babylon.js, `@babylonjs/*`, or any npm package in the Event Bus source files — verified by `tsc --noEmit`

---

## Implementation Notes

_Derived from ADR-0001 Implementation Guidelines:_

1. **EventMap interface** — Define as a global TypeScript type. Every event is a property with its payload type:
   ```typescript
   type EventMap = {
     "collision.impact": { carIdA: string; carIdB: string; impulse: number };
     "race.finish": { winnerId: string };
     // ... 25+ events as defined in ADR-0001
   };
   ```
2. **IEventBus interface** — Generic over EventMap:
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
   ```
3. **Subscription interface** — Single method:
   ```typescript
   interface Subscription {
     unsubscribe(): void;
   }
   ```
4. **EventBusError** — Custom error class extending `Error`, used in all error paths.
5. **Single payload rule** — Every `emit()` takes exactly one argument after the event name. No variadic overloads. Enforced by the type system.
6. **File location**: `src/foundation/event-bus/types.ts` (types only) and `src/foundation/event-bus/errors.ts` (error class).
7. **Zero-dependency verification**: Run `tsc --noEmit` on the Foundation directory. Any import from outside Foundation is a build error.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 002]: Core Event Bus runtime — `init()`, `dispose()`, `emit()`, `on()`, `off()`, Subscription implementation
- [Story 003]: Edge cases — `once()`, subscribe/unsubscribe during dispatch, circular emit detection, leak detection

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**AC-11a: Wrong payload is compile error**

- **Test**: Compile-time type checking
- Given: `EventMap` has `"fuel.low": { percentage: number }`
- When: `emit('fuel.low', { percentage: "notANumber" })` is written in a test file
- Then: TypeScript compilation fails — type error on payload property `percentage` type mismatch
- Edge: `emit('fuel.low', {})` — missing required property — compile error
- Edge: `emit('fuel.low', { percentage: 0.15, extra: true })` — extra property — compile error (exact type check)

**AC-11b: Handler receives correct payload type**

- **Test**: Compile-time type checking
- Given: `EventMap` has `"fuel.low": { percentage: number }`
- When: `on('fuel.low', handler)` is written where `handler` expects `(payload: { percentage: number }) => void`
- Then: The handler type is compatible — no compile error
- Edge: Handler expecting `(payload: { percentage: string }) => void` — compile error, payload type mismatch

**AC-11c: Non-existent event name is compile error**

- **Test**: Compile-time type checking
- Given: `EventMap` has no key `"nonexistent"`
- When: `emit('nonexistent', {})` is written
- Then: TypeScript compilation fails — `'nonexistent'` is not assignable to parameter of type `keyof EventMap`
- Edge: `on('nonexistent', handler)` — same compile error
- Edge: `emit('car.fuel_empty', { carId: "player" })` — valid event — compiles successfully

**TR-EVB-008: Zero dependencies**

- **Test**: Import analysis (manual or scripted)
- Given: All Event Bus source files in `src/foundation/event-bus/`
- When: The files are analyzed for import statements
- Then: No imports from `'babylonjs'`, `'@babylonjs/*'`, or any npm package
- Edge: Import of local sibling file (`'./errors'`, `'./types'`) is allowed
- Edge: Import of standard TypeScript/JS lib types only (no runtime polyfills)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:

- Logic: `tests/unit/event-bus/event-types.test.ts` — must exist and pass
- File contains `@ts-expect-error` annotations to verify type errors (compile-time test pattern)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None (foundational — pure types used by all other Event Bus stories)
- Unlocks: Story 002 (Core Event Bus), Story 003 (Edge Cases), all other Foundation and Core systems
