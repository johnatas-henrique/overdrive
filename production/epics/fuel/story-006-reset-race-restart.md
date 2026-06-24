# Story 006: Reset & Race Restart

> **Epic**: Fuel
> **Status**: Ready
> **Layer**: Core (slot #5 — pipeline)
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 2h

## Context

**GDD**: `design/gdd/fuel.md`
**Requirement**: `TR-FUEL-010` — Race Again reinitialisation: `off()` before `on()` on Event Bus subscriptions
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0011: Fuel Model
**ADR Decision Summary**: `reset()` sets all cars to `maxCapacity`, clears `emittedEmpty` flags, and re-initialises Event Bus subscriptions with the off-before-on pattern to prevent listener duplication on Race Again.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript — Event Bus subscription management via typed interface.

**Control Manifest Rules (this layer)**:

- Required: C53 — Race Management reentrant `init()` (parallel pattern: off() before on())
- Required: F8 — Subscription pattern with `unsubscribe()`
- Required: F24 — GSM emits `gsm.state.exited` then `gsm.state.entered`

---

## Acceptance Criteria

_From GDD `design/gdd/fuel.md`, scoped to this story:_

- [ ] AC-7: Race restart resets all fuel to `maxCapacity`
- [ ] `reset()` sets all registered cars to `maxCapacity`
- [ ] `reset()` clears all `emittedEmpty` flags (so `car.fuel_empty` can fire again next race)
- [ ] Event Bus subscriptions: `off()` called before `on()` to prevent listener duplication on repeated `reset()` calls
- [ ] Second `reset()` call is safe idempotent no-op (all cars already at maxCapacity, flags already cleared)

---

## Implementation Notes

_Derived from ADR-0011 Implementation Guidelines:_

```typescript
reset(): void {
  for (const [carId, state] of this.cars) {
    state.level = this.config.maxCapacity;
  }
  this.emittedEmpty = {};  // clear all one-shot guards

  // Re-entrant subscription safety:
  this.eventBus.off("gsm.state.entered", this.onStateEntered);
  this.eventBus.on("gsm.state.entered", this.onStateEntered);
}
```

_Key details:_

- `reset()` is called when GSM enters PreRace state (fuel should be at maxCapacity before race start)
- Also called on race restart (Race Again flow)
- The off-before-on pattern is the same as C53 (Race Management's reentrant init) — prevents listener accumulation across races
- `emittedEmpty` must be cleared because a new race means fresh fuel — if a car empties in the new race, the event must fire

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 002]: Consumption math (uses reset state)
- Race Management epic: Triggers `reset()` on state transitions

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1 (reset sets all to maxCapacity)**:
  - Given: 3 cars registered, after some consumption (various fuelLevels)
  - When: `reset()` is called
  - Then: `getFuelLevel("car-1") === maxCapacity`; `getFuelLevel("car-2") === maxCapacity`; `getFuelLevel("car-3") === maxCapacity`

- **AC-2 (reset clears emittedEmpty)**:
  - Given: "car-1" emitted `car.fuel_empty` (`emittedEmpty[car-1] = true`)
  - When: `reset()` is called
  - Then: On next `calculate()` where fuelLevel ≤ 0 after emptying: `car.fuel_empty` emitted again (proves emittedEmpty was cleared)

- **AC-3 (second reset idempotent)**:
  - Given: All cars at maxCapacity (after first `reset()`)
  - When: `reset()` is called again
  - Then: All cars still at maxCapacity; no errors thrown; `fuelMult = 1.0` for all cars

- **AC-4 (reset doesn't affect unregistered cars)**:
  - Given: "car-1" is registered, "car-2" was unregistered
  - When: `reset()` is called
  - Then: `getFuelLevel("car-1") === maxCapacity`; `getFuelLevel("car-2") === undefined`

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/fuel/fuel-reset.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (Fuel State — must have registered cars to reset)
- Depends on: Story 003 (fuel_empty — must clear emittedEmpty)
- Unlocks: Race Management restart flow
