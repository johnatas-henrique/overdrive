# Story 003: Tire Blowout, resetTires, and Race Lifecycle

> **Epic**: Tire Wear
> **Status**: Ready
> **Layer**: Core (slot #6 — pipeline)
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/tire-wear.md`
**Requirement**: `TR-TIRE-003`, `TR-TIRE-004`, `TR-TIRE-009`, `TR-TIRE-010`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0012: Tire Model
**ADR Decision Summary**: `car.tire_blown` emitted when `tireCondition` reaches 0 — one-shot with guard. No DNF — informational only. `resetTires(carId)` restores condition to 1.0 for pit stops. Race restart resets all cars.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript math — zero engine API usage. Event Bus dependency is an injectable interface (typed `IEv entBus`), not a concrete implementation. Verified via `tsc --noEmit`.

**Control Manifest Rules (this layer)**:

- Required: C39 — Binary tire change, `resetTires()` restores to 1.0 after `tireChangeDelay`
- Required: C40 — `car.tire_blown` one-shot, guard prevents re-emission
- Required: C27 — `tireCondition = 0` → grip drops to `minGripFactor` (0.15), engine power unaffected, 1-tick delay
- Required: F19 — slot N reads from slot N-1, no cross-layer upward imports
- Guardrail: C-G10 — Tire < 0.001ms/car/tick
- Forbidden: No DNF from tire blowout — `car.tire_blown` is informational only

---

## Acceptance Criteria

_From GDD `design/gdd/tire-wear.md`, scoped to this story:_

- [ ] AC-1: When `tireCondition` reaches ≤ 0 after degradation, `car.tire_blown` is emitted once via Event Bus
- [ ] AC-2: After first emission, `car.tire_blown` is NOT re-emitted on subsequent ticks (one-shot guard)
- [ ] AC-3: `car.tire_blown` payload is `{ carId }` only — no DNF flag included
- [ ] AC-4: `resetTires(carId)` sets `tireCondition` back to 1.0
- [ ] AC-5: `resetTires(carId)` also clears the `emittedBlown` guard for that car (re-arming blowout detection)
- [ ] AC-6: `TireWearSystem` exposes a `resetAllTires()` method that calls `resetTires(carId)` for every registered car
- [ ] AC-7: `TireWearSystem.init()` subscribes to the Event Bus. `TireWearSystem.dispose()` unsubscribes all listeners. Calling `init()` twice without an intervening `dispose()` MUST NOT double-register any listener.
- [ ] AC-8: Tire blowout does NOT set any DNF flag — Race Management handles DNF separately

---

## Implementation Notes

_Derived from ADR-0012 Implementation Guidelines:_

- Blown state tracked per car: `Map<string, boolean>` as `emittedBlown` guard
- Event Bus dependency via `IEventBus` interface (from Foundation layer) — injectable, no concrete dependency
- `resetTires(carId)` updates `TireState.condition = 1.0` and clears `emittedBlown[carId] = false`
- `resetAllTires()` iterates all registered cars and calls `resetTires` for each
- `init()` subscribes to relevant GSM events via Event Bus (race restart, etc.)
- `dispose()` unsubscribes all Event Bus listeners and clears internal state
- No Babylon.js types — all interfaces are plain TypeScript

```typescript
interface ITireWear {
  registerCar(carId: string, durabilityLevel: number): void;
  unregisterCar(carId: string): void;
  calculate(dt: number): void;
  getTireCondition(carId: string): number | undefined;
  resetTires(carId: string): void;
  resetAllTires(): void;
  init(): void;
  dispose(): void;
}

// The blown guard:
private emittedBlown: Map<string, boolean> = new Map();

// In calculate(dt) — after degradation:
if (state.condition <= 0 && !this.emittedBlown.get(carId)) {
  this.emittedBlown.set(carId, true);
  this.eventBus.emit("car.tire_blown", { carId });
}
```

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 001]: Core degradation formula, state management, per-car tracking
- [Story 002]: Off-track multiplier, track abrasion, durability upgrades
- Pit Stop epic: `tireChangeDelay` timer logic and when `resetTires` is called during pit stops

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1 (tire_blown emitted once)**:
  - Given: "car-1" registered, `tireCondition` just above 0
  - When: `calculate(0.016)` pushes `tireCondition` to ≤ 0
  - Then: `eventBus.emit` was called with `"car.tire_blown"` and payload `{ carId: "car-1" }`

- **AC-2 (one-shot guard)**:
  - Given: "car-1" has `tireCondition = 0` and `emittedBlown = true`
  - When: `calculate(0.016)` called again with any loads
  - Then: `eventBus.emit` was NOT called for `"car.tire_blown"` — event not re-emitted

- **AC-3 (payload shape)**:
  - Given: "car-1" blows tires
  - When: `car.tire_blown` is emitted
  - Then: payload strictly equals `{ carId: "car-1" }` — no `dnf` or other fields

- **AC-4 (resetTires restores condition)**:
  - Given: "car-1" with `tireCondition = 0.3`
  - When: `resetTires("car-1")` is called
  - Then: `getTireCondition("car-1") === 1.0`

- **AC-5 (resetTires clears guard)**:
  - Given: "car-1" at `tireCondition = 0` and `emittedBlown = true`
  - When: `resetTires("car-1")` is called, then `calculate(0.016)` drops it to 0 again
  - Then: `car.tire_blown` is emitted a second time (guard was cleared)

- **AC-6 (resetAllTires)**:
  - Given: 3 cars registered, all with `tireCondition < 0.5`
  - When: `resetAllTires()` is called
  - Then: `getTireCondition(carId) === 1.0` for all 3 cars

- **AC-7 (init/dispose lifecycle)**:
  - Given: `TireWearSystem` not initialized
  - When: `init()` is called
  - Then: Event Bus subscriptions are active (subscription count > 0)
  - When: `dispose()` is called
  - Then: Event Bus subscriptions are cleared (subscription count returns to pre-init level)
  - When: `init()` is called twice without intervening `dispose()`
  - Then: Subscription count is the same as a single `init()` (no double-registration)

- **AC-8 (no DNF)**:
  - Given: "car-1" with `tireCondition = 0`
  - When: any method is called
  - Then: No DNF-related flag or field is set anywhere in TireWearSystem state

- **Edge cases**:
  - `resetTires` on non-existent carId: no-op, no error thrown
  - `resetAllTires` with zero registered cars: no-op, no error thrown
  - Tire blowout on car where `emittedBlown` is already true: no re-emission
  - `dispose()` when already disposed: safe no-op (idempotent)
  - `init()` when already initialized with no `dispose()` in between: must not double-register

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/tire-wear/tire-blowout-lifecycle.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (Core Tire Degradation Engine) — requires `registerCar`, `calculate`, `TireState`
- Depends on: Event Bus Foundation system — provides `IEventBus` interface
- Unlocks: Pit Stop epic (calls `resetTires`), Race Management (reads `tireCondition` for awareness, no DNF)
