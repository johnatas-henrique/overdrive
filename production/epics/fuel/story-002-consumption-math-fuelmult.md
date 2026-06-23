# Story 002: Consumption Math & fuelMult Delivery

> **Epic**: Fuel
> **Status**: Ready
> **Layer**: Core (slot #5 — pipeline)
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/fuel.md`
**Requirements**: `TR-FUEL-002` (consumption formula), `TR-FUEL-003` (fuelMult formula)
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0011: Fuel Model
**ADR Decision Summary**: Per-tick consumption `fuelUsed = throttleAvg × baseRate × efficiencyRate × fixedDt`. `fuelMult = max(0.0, fuelLevel / maxCapacity)` sent to Physics with 1-tick delay via shared Map. Zero-throttle → zero consumption inherent in formula.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript math — no engine API usage. `Date.now()`/`performance.now()` forbidden inside pipeline slot `update()`.

**Control Manifest Rules (this layer)**:

- Required: C33 — consumption formula
- Required: C34 — fuelMult with 1-tick delay
- Required: F37 — determinism: no `Date.now()` / `performance.now()` in simulation code
- Forbidden: F-F5 — never call `gsm.getCurrent()` from any system
- Guardrail: C-G9 — Fuel < 0.001ms/car/tick

---

## Acceptance Criteria

_From GDD `design/gdd/fuel.md`, scoped to this story:_

- [ ] AC-1: Fuel consumption calculated per tick from `throttleAvg`
- [ ] AC-2: Consumption is zero when `throttleAvg = 0` (coasting / lift-and-coast)
- [ ] AC-3: `fuelMult` reaches 0 when `fuelLevel → 0`, engine output zero
- [ ] `calculate(dt)` is the pipeline entry point — called once per tick for all registered cars
- [ ] Formula: `fuelUsed = throttleAvg × baseRate × efficiencyRate × fixedDt`
- [ ] `fuelLevel -= fuelUsed`
- [ ] `fuelMult = max(0.0, fuelLevel / maxCapacity)` — clamped to floor of 0.0
- [ ] `fuelMult` written to shared `Map<string, number>` every tick for every registered car
- [ ] Physics reads `fuelMultMap.get(carId) ?? 1.0` next tick (1-tick delay is structural — Physics slot #2 ran before Fuel slot #5)

---

## Implementation Notes

_Derived from ADR-0011 Implementation Guidelines:_

```typescript
// Tick order (pipeline slot #5):
//   Fuel.calculate(dt):
//     1. Read throttleAvg[carId] from Physics output (written by slot #2)
//     2. fuelUsed = throttleAvg × baseRate × efficiencyRate × dt
//     3. fuelLevel -= fuelUsed
//     4. fuelMult = max(0.0, fuelLevel / maxCapacity)
//     5. fuelMultMap.set(carId, fuelMult)  // Physics reads next tick

// Tick N: Fuel writes fuelMult[N] AFTER Physics slot #2 already ran
// Tick N+1: Physics reads fuelMult[N] as its power multiplier
// The 16ms delay is imperceptible and avoids intra-tick circular dependency.
```

_Key details:_

- `baseRate = 0` → `fuelUsed = 0` always (dev mode — see Story 003 for edge case coverage)
- `efficiencyRate` is set during `registerCar()` — see Story 001
- `fuelMult` map is a shared data structure; Fuel writes, Physics reads. Not an Event Bus payload (per-frame heavy data goes via direct getter/shared map per F20)
- `fuelLevel` decreasing past 0 (floating point edge case) still produces `fuelMult = 0.0` via `max(0.0, ...)` — clamped correctly
- Determinism: do not use `Math.random()`, `Date.now()`, or `performance.now()` inside `calculate()`

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 001]: State registration, getters, FuelConfig
- [Story 003]: `car.fuel_empty` event emission (triggered when fuelLevel ≤ 0 after this story's calculation)
- [Story 004]: Efficiency upgrade mapping (provides efficiencyRate consumed by this story)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1 (basic consumption)**:
  - Given: "car-1" with `fuelLevel = 100`, `baseRate = 0.02`, `efficiencyRate = 1.0`, `maxCapacity = 100`
  - When: `calculate(0.016)` with `throttleAvg = 1.0`
  - Then: `fuelUsed = 1.0 × 0.02 × 1.0 × 0.016 = 0.00032`; `fuelLevel = 99.99968`; `fuelMult = 0.9999968`

- **AC-2 (zero throttle / lift-and-coast)**:
  - Given: "car-1" with `fuelLevel = 100`, `baseRate = 0.02`, `efficiencyRate = 1.0`
  - When: `calculate(0.016)` with `throttleAvg = 0.0`
  - Then: `fuelUsed = 0.0`; `fuelLevel` unchanged (= 100)

- **AC-3 (fuelMult = 0 at empty)**:
  - Given: "car-1" with `fuelLevel = 0.00001`, `baseRate = 0.02`, `efficiencyRate = 1.0`
  - When: `calculate(0.016)` with `throttleAvg = 1.0`
  - Then: `fuelUsed = 0.00032`; `fuelLevel = -0.00031` (floats); `fuelMult = 0.0` via `max(0.0, ...)`

- **AC-4 (fuelMult written every tick)**:
  - Given: "car-1" registered, `fuelMultMap` is empty
  - When: `calculate(0.016)` is called
  - Then: `fuelMultMap.get("car-1")` equals computed fuelMult value

- **AC-5 (efficiency scales consumption)**:
  - Given: `car-1` with `efficiencyRate = 0.6` (L5), `car-2` with `efficiencyRate = 1.0` (L1); both at `fuelLevel = 100`
  - When: `calculate(0.016)` with `throttleAvg = 1.0` for both
  - Then: `fuelUsed(car-2) / fuelUsed(car-1) = 1.0 / 0.6 ≈ 1.667`

- **Edge cases**:
  - `throttleAvg = 1.0` extended drain: fuelLevel → 0, verify fuelMult monotonic non-negative
  - `throttleAvg = 0.5`, `efficiencyRate = 0.6`, `baseRate = 0.1` (max range): verify linearity
  - Multiple cars with different throttleAvgs: each calculated independently in one `calculate()` call
  - `calculate()` with `dt = 0`: `fuelUsed = 0`, `fuelLevel` unchanged
  - Floating point drain: continuous from 100 → 0 across thousands of ticks, verify fuelMult never negative

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/fuel/fuel-consumption.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (Fuel State & Car Lifecycle) — must be DONE
- Unlocks: Story 003 (fuel_empty Event), Story 004 (Efficiency — provides efficiencyRate)
