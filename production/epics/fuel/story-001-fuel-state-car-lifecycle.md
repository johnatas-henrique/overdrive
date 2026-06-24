# Story 001: Fuel State & Car Lifecycle

> **Epic**: Fuel
> **Status**: Ready
> **Layer**: Core (slot #5 — pipeline)
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/fuel.md`
**Requirement**: `TR-FUEL-001` — Map<carId, fuelState> per-car, init from RaceConfiguration
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0011: Fuel Model
**ADR Decision Summary**: Fuel consumption per tick based on throttle position, efficiency rate, and global base rate. `maxCapacity` is a global constant — all cars share the same tank size. Strategic spread from per-team efficiency upgrades.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript math — zero engine API usage. Verified via `tsc --noEmit`.

**Control Manifest Rules (this layer)**:

- Required: C33 — consumption formula; C34 — fuelMult formula
- Required: F19 — slot N reads from slot N-1, no cross-layer upward imports
- Guardrail: C-G9 — Fuel < 0.001ms/car/tick

---

## Acceptance Criteria

_From GDD `design/gdd/fuel.md`, scoped to this story:_

- [ ] AC-8: Each car tracks fuel independently (player and AI) — `Map<string, FuelState>`
- [ ] AC-11: `fuel.maxCapacity` is a global constant (same value for all cars; efficiency upgrade creates strategic spread)
- [ ] `registerCar(carId, efficiencyLevel)` creates internal map entry with `fuelLevel = maxCapacity`
- [ ] `unregisterCar(carId)` removes car from map — unregistering non-existent carId is a safe no-op
- [ ] `getFuelLevel(carId)` returns current `fuelLevel` for the car
- [ ] `getFuelMult(carId)` returns computed `fuelLevel / maxCapacity` (on-the-fly, not stored)
- [ ] `dispose()` clears all state — map empty, all getters return `undefined`
- [ ] FuelConfig is a single shared instance — `baseRate`, `maxCapacity`, `upgradeL1..L5` loaded from Data & Config Manager

---

## Implementation Notes

_Derived from ADR-0011 Implementation Guidelines:_

- `FuelState { level: number; efficiencyRate: number }` — efficiencyRate set from upgrade level during `registerCar`
- `FuelConfig` is plain data: `{ baseRate, upgradeL1toL5: number[], maxCapacity }`
- No Babylon.js types — all interfaces are plain TypeScript
- `getFuelLevel` for non-existent carId returns `undefined` (caller responsibility to check)
- `getFuelMult` for non-existent carId returns `1.0` (Physics default per ADR-0011 — caller may use `?? 1.0`)
- Config values loaded during system init from Data & Config Manager namespace `fuel.*`

```typescript
interface FuelConfig {
  baseRate: number; // default 0.02
  upgradeL1toL5: number[]; // [1.0, 0.9, 0.8, 0.7, 0.6]
  maxCapacity: number; // global constant, same for all cars
}

interface FuelState {
  level: number;
  efficiencyRate: number;
}
```

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 002]: Consumption calculation and fuelMult delivery
- [Story 003]: `car.fuel_empty` event emission and edge cases

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1 (registerCar)**:
  - Given: FuelStateManager is empty
  - When: `registerCar("car-1", 1)` is called
  - Then: `getFuelLevel("car-1") === FuelConfig.maxCapacity`; internal map size === 1

- **AC-2 (registerCar stores efficiencyRate)**:
  - Given: FuelStateManager is empty
  - When: `registerCar("car-1", 3)` is called
  - Then: calculate(0.016) with throttleAvg = 0.5 produces `fuelUsed = 0.5 × baseRate × FuelConfig.upgrade[2] × 0.016`

- **AC-3 (unregisterCar)**:
  - Given: "car-1" is registered
  - When: `unregisterCar("car-1")` is called
  - Then: `getFuelLevel("car-1")` returns `undefined`; internal map size === 0

- **AC-4 (getFuelMult computed)**:
  - Given: "car-1" with `fuelLevel = 50`, `maxCapacity = 100`
  - When: `getFuelMult("car-1")` is called
  - Then: result === 0.5

- **AC-5 (getFuelMult empty)**:
  - Given: `fuelLevel = 0`, `maxCapacity = 100`
  - When: `getFuelMult("car-1")` is called
  - Then: result === 0.0

- **AC-6 (dispose clears all)**:
  - Given: 3 cars registered
  - When: `dispose()` is called
  - Then: internal map is empty; all getters return `undefined`

- **Edge cases**:
  - `unregisterCar` on non-existent carId: no-op, no error thrown
  - `getFuelLevel` on non-existent carId: returns `undefined`
  - `getFuelMult` on non-existent carId: returns `1.0` (caller defaults via `?? 1.0`)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/fuel/fuel-state.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: TR-FUEL-008 (FuelConfig values must be registered in Data & Config Manager before Fuel init)
- Unlocks: Story 002 (Consumption Math)
