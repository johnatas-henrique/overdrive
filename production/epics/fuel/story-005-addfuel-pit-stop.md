# Story 005: addFuel for Pit Stop

> **Epic**: Fuel
> **Status**: Ready
> **Layer**: Core (slot #5 — pipeline)
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/fuel.md`
**Requirement**: `TR-FUEL-005` — addFuel(carId, amount) for pit stop refueling
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0011: Fuel Model
**ADR Decision Summary**: `addFuel(carId, amount)` is the sole external writer to fuel level. Called by Pit Stop during refuel. Adds fuel at any rate, clamps to `maxCapacity`. Clears `emittedEmpty` flag so engine can restart. Consumption path is read-only from outside — no other code calls `addFuel`.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript — no engine API usage.

**Control Manifest Rules (this layer)**:

- Required: C35 — Pit Stop is sole external writer to fuel level
- Required: F19 — slot N reads from slot N-1, no upward imports
- Guardrail: C-G9 — Fuel < 0.001ms/car/tick

---

## Acceptance Criteria

_From GDD `design/gdd/fuel.md`, scoped to this story:_

- [ ] `addFuel(carId, amount)` increments fuelLevel by `amount` (can be called at any time, not just during calculate())
- [ ] Result clamped to `maxCapacity` — never exceed tank size
- [ ] Clears `emittedEmpty[carId]` flag — engine can produce power again after refuel
- [ ] AC-5 lifecycle: `addFuel` after `car.fuel_empty` allows engine restart; next empty cycle re-emits the event
- [ ] Edge case "Fuel empty in pit entry": car reaches garage, refuels normally — no DNF while in pit
- [ ] Sole external writer — no other public method modifies `fuelLevel` (consumption path is internal to `calculate()`)
- [ ] Calling `addFuel` on non-existent carId throws `FuelError('Car not registered: ...')` (consistent with Foundation's strict error pattern)

---

## Implementation Notes

_Derived from ADR-0011 Implementation Guidelines:_

```typescript
addFuel(carId: string, amount: number): void {
  const state = this.cars.get(carId);
  if (!state) throw new FuelError(`Car not registered: ${carId}`);
  state.level = Math.min(state.level + amount, this.config.maxCapacity);
  delete this.emittedEmpty[carId];  // clear guard — engine can restart
}
```

_Key details:_

- **fuelMult staleness**: After `addFuel`, `fuelMult` only updates on the **next** `calculate()` call. One-tick delay per ADR-0011 — engine stays dead for 16ms after refuel. This is intentional and imperceptible.
- `emittedEmpty` is cleared so `car.fuel_empty` can fire again if the car re-empties after refuel
- Pit Stop calls `addFuel` each tick while servicing (aggregated refuel)
- No special refuel rate — Pit Stop controls the scheduling; Fuel only accepts the additive call

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 002]: Consumption calculation (the only other writer of fuelLevel)
- Pit Stop epic: Refuel scheduling, refuel rate, garage arrival/departure logic

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1 (increments fuelLevel)**:
  - Given: "car-1" with `fuelLevel = 30`, `maxCapacity = 100`
  - When: `addFuel("car-1", 50)` is called
  - Then: `getFuelLevel("car-1") === 80`

- **AC-2 (clamps to maxCapacity)**:
  - Given: "car-1" with `fuelLevel = 80`, `maxCapacity = 100`
  - When: `addFuel("car-1", 50)` is called (would exceed maxCapacity)
  - Then: `getFuelLevel("car-1") === 100` (clamped)

- **AC-3 (clears emittedEmpty)**:
  - Given: "car-1" emitted `car.fuel_empty` (`emittedEmpty[car-1] = true`), `fuelLevel = 0`
  - When: `addFuel("car-1", 100)` is called, then `calculate(0.016)` runs next tick with `throttleAvg = 1.0`
  - Then: `"car.fuel_empty"` NOT emitted (emittedEmpty was cleared); `fuelMult > 0` (engine restarted)

- **AC-4 (sole external writer — architectural invariant)**:
  - Verify there is no public `setFuelLevel()` or direct fuelLevel assignment outside `calculate()` and `addFuel()` (compile-time/lint check)

- **AC-5 (unregistered car throws)**:
  - Given: No car "ghost-car" registered
  - When: `addFuel("ghost-car", 50)` is called
  - Then: `FuelError('Car not registered: ghost-car')` is thrown

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/fuel/fuel-addFuel.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (Fuel State — must have registered cars)
- Depends on: Story 003 (fuel_empty — must understand emittedEmpty lifecycle)
- Unlocks: Pit Stop epic — refueling pipeline
