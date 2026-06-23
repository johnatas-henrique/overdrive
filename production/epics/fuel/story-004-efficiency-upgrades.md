# Story 004: Efficiency Upgrades

> **Epic**: Fuel
> **Status**: Ready
> **Layer**: Core (slot #5 — pipeline)
> **Type**: Config/Data
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/fuel.md`
**Requirement**: `TR-FUEL-006` — Efficiency upgrades reduce efficiencyRate per level
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0011: Fuel Model
**ADR Decision Summary**: Efficiency upgrade L1–L5 maps to `efficiencyRate` values (1.0 → 0.6). Set during `registerCar()` from team config. Consumption scales linearly: `fuelUsed = throttleAvg × baseRate × efficiencyRate × fixedDt`. Same throttle input burns less fuel at higher efficiency levels.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure data — no engine API usage.

**Control Manifest Rules (this layer)**:

- Required: C33 — consumption formula uses efficiencyRate
- Required: F2 — `get<T>(key)` throws ConfigError on missing key

---

## Acceptance Criteria

_From GDD `design/gdd/fuel.md`, scoped to this story:_

- [ ] AC-4: Efficiency upgrade Level 1 consumes baseline (1.0×), Level 5 consumes 60% of baseline (0.6×)
- [ ] Level 1 → `efficiencyRate = 1.0`
- [ ] Level 2 → `efficiencyRate = 0.9`
- [ ] Level 3 → `efficiencyRate = 0.8`
- [ ] Level 4 → `efficiencyRate = 0.7`
- [ ] Level 5 → `efficiencyRate = 0.6`
- [ ] `efficiencyRate` set during `registerCar(carId, efficiencyLevel)` — looks up from `FuelConfig.upgradeL1toL5[level - 1]`
- [ ] Config knobs in `fuel.*` namespace: `fuel.upgradeL1` through `fuel.upgradeL5`
- [ ] Out-of-range level (0 or >5) throws `ConfigError` or clamps to nearest valid value

---

## Implementation Notes

_Derived from ADR-0011 Implementation Guidelines:_

```typescript
// In FuelConfig:
upgradeL1toL5: [1.0, 0.9, 0.8, 0.7, 0.6]; // index 0 = Level 1

// During registerCar:
const efficiencyRate = config.upgradeL1toL5[level - 1] ?? 1.0;
// Out-of-range levels default to 1.0 (baseline) — defensive fallback
```

_Key details:_

- Config values registered in Data & Config Manager under `fuel.*` namespace
- All 5 levels must be present in config — missing level throws `ConfigError` at init (per F2)
- The efficiency upgrade affects all driving equally — it does not change the relationship between aggressive and conservative driving
- An efficient car extracts more laps from the same tank than an inefficient one (strategic spread from same `maxCapacity`)

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 001]: `registerCar()` integration (this story provides the efficiencyRate mapping used by Story 001)
- [Story 002]: Consumption formula (uses efficiencyRate provided by this story's config)
- Team upgrades UI: Selecting efficiency level in car setup / garage screen

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **Test 4.1 (level mapping)**:
  - Verify `FuelConfig.upgrade` array matches spec: `[1.0, 0.9, 0.8, 0.7, 0.6]`
  - `registerCar("car", 1)` → `efficiencyRate = 1.0`
  - `registerCar("car", 5)` → `efficiencyRate = 0.6`

- **Test 4.2 (consumption ratio across levels)**:
  - For each level L in 1..5: registerCar, then calculate(0.016, throttleAvg=1.0)
  - `fuelUsed(L) / fuelUsed(1) === FuelConfig.upgrade[L-1] / 1.0`

- **Test 4.3 (knob namespace convention)**:
  - Verify `FuelConfig` values accessible under `fuel.*` namespace:
    - `fuel.baseRate`, `fuel.upgradeL1`..`fuel.upgradeL5`, `fuel.maxCapacity`

- **Test 4.4 (out-of-range level)**:
  - `registerCar("car", 0)` → defaults to 1.0 (baseline, defensive fallback)
  - `registerCar("car", 6)` → defaults to 1.0 (baseline, defensive fallback)

---

## Test Evidence

**Story Type**: Config/Data
**Required evidence**: `tests/unit/fuel/fuel-efficiency.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (Fuel State — registerCar must exist to apply efficiency mapping)
- Unlocks: Race Strategy decisions (AI driver reads efficiency for pit timing)
