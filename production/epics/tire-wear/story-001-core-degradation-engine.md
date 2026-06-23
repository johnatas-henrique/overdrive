# Story 001: Core Tire Degradation Engine

> **Epic**: Tire Wear
> **Status**: Ready
> **Layer**: Core (slot #6 — pipeline)
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/tire-wear.md`
**Requirement**: `TR-TIRE-001`, `TR-TIRE-002`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0012: Tire Model
**ADR Decision Summary**: Tire degradation per tick from 3-axis loads (lateralG, accelG, brakeG) with configurable per-axis weights. Single health pool per car. `tireCondition` (0..1) written to Physics with 1-tick delay.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript math — zero engine API usage. Verified via `tsc --noEmit`.

**Control Manifest Rules (this layer)**:

- Required: C36 — tire degradation formula: `wear = lateralG × latFactor + accelG × accelFactor + brakeG × brakeFactor`
- Required: C38 — single health pool per car (4 wheels aggregated)
- Required: C27 — `tireCondition = 0` → grip drops to `minGripFactor` (0.15), engine power unaffected, 1-tick delay
- Required: F19 — slot N reads from slot N-1, no cross-layer upward imports
- Guardrail: C-G10 — Tire < 0.001ms/car/tick

---

## Acceptance Criteria

_From GDD `design/gdd/tire-wear.md`, scoped to this story:_

- [ ] AC-1: `registerCar(carId, durabilityLevel)` creates per-car `TireState` with `tireCondition = 1.0`
- [ ] AC-2: `unregisterCar(carId)` removes car state — `getTireCondition(carId)` returns `undefined` for unregistered IDs
- [ ] AC-3: `getTireCondition(carId)` returns current value clamped to [0..1]
- [ ] AC-4: `calculate(dt)` computes degradation:
  - `tireLoad = lateralG × latFactor + accelG × accelFactor + brakeG × brakeFactor`
  - `degradation = tireLoad × baseDegradationRate × efficiencyRate × trackAbrasion × dt`
  - `tireCondition = max(0.0, tireCondition - degradation)`
  - When `durabilityLevel` is unused (Story 001 only), `efficiencyRate = 1.0`. When `trackAbrasion` is not set, it defaults to `1.0`.
- [ ] AC-5: `tireCondition` never exceeds 1.0 (ceiling clamp)
- [ ] AC-6: LateralG of 0, accelG of 0, brakeG of 0 produces zero degradation (coasting)
- [ ] AC-7: At pit-limiter loads `lateralG = 0.1, accelG = 0.05, brakeG = 0.02`, degradation per tick is `> 0` and `<= 1e-6`
- [ ] AC-8: `baseDegradationRate = 0` produces zero degradation regardless of loads (dev mode)
- [ ] AC-9: Each car tracks independent `tireCondition` — separate `registerCar` calls produce independent state

---

## Implementation Notes

_Derived from ADR-0012 Implementation Guidelines:_

- `TireState { condition: number; efficiencyRate: number }` — efficiencyRate set from durability upgrade level during `registerCar`
- `TireConfig` is plain data loaded via Data & Config Manager (namespace `tire.*`)
- Load inputs (`lateralG`, `accelG`, `brakeG`) received from Physics each tick — structure defined in `ITireLoadInput`
- No Babylon.js types — all interfaces are plain TypeScript
- `getTireCondition` for non-existent carId returns `undefined` (caller responsibility to check)
- `tireCondition` written to Physics via `Physics.onTireUpdate(carId, condition)` with 1-tick delay (shared `Map<string, number>` pattern per ADR-0011)

```typescript
interface TireConfig {
  latFactor: number; // default 1.5
  accelFactor: number; // default 1.0
  brakeFactor: number; // default 0.8
  baseDegradationRate: number; // default 0.01
  upgradeL1toL5: number[]; // [1.0, 0.9, 0.8, 0.7, 0.6]
  offTrackMult: number; // default 2.0
  trackAbrasion: number; // default 1.0
}

interface TireState {
  condition: number;
  efficiencyRate: number;
}

interface TireLoadInput {
  lateralG: number;
  accelG: number;
  brakeG: number;
  offTrack: boolean;
}
```

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 002]: Off-track multiplier, track abrasion, and durability upgrade stat mapping
- [Story 003]: `car.tire_blown` event emission, `resetTires`, and race lifecycle

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1 (registerCar creates state)**:
  - Given: TireWearSystem is empty
  - When: `registerCar("car-1", 1)` is called
  - Then: `getTireCondition("car-1") === 1.0`; internal map size === 1

- **AC-2 (unregisterCar removes state)**:
  - Given: "car-1" is registered with condition = 1.0
  - When: `unregisterCar("car-1")` is called
  - Then: `getTireCondition("car-1")` returns `undefined`; internal map size === 0

- **AC-3 (getTireCondition returns current value)**:
  - Given: "car-1" registered with efficiencyRate = 1.0
  - When: `calculate(0.016)` is called with `lateralG = 2.0, accelG = 0.5, brakeG = 0.3`, defaults applied
  - Then: `getTireCondition("car-1")` is in range [0, 1]

- **AC-4 (degradation formula)**:
  - Given: "car-1" registered, `latFactor = 1.5, accelFactor = 1.0, brakeFactor = 0.8`, `baseDegradationRate = 0.01`, `efficiencyRate = 1.0`, `trackAbrasion = 1.0`
  - When: `calculate(0.016)` with `lateralG = 2.0, accelG = 0.5, brakeG = 0.3`, `offTrack = false`
  - Then: `tireLoad = 2.0×1.5 + 0.5×1.0 + 0.3×0.8 = 3.0 + 0.5 + 0.24 = 3.74`; `degradation = 3.74 × 0.01 × 1.0 × 1.0 × 0.016 = 0.0005984`; `tireCondition = 1.0 - 0.0005984 = 0.9994016`

- **AC-5 (ceiling clamp)**:
  - Given: "car-1" with `tireCondition = 0.8`
  - When: negative degradation would raise it above 1.0
  - Then: `tireCondition` is clamped to `max(tireCondition, 1.0)`

- **AC-6 (zero loads = zero degradation)**:
  - Given: "car-1" registered with any efficiencyRate
  - When: `calculate(0.016)` with all loads = 0
  - Then: `tireCondition` unchanged (degradation = 0)

- **AC-7 (pit-limiter loads)**:
  - Given: "car-1" registered, default config
  - When: `calculate(0.016)` with `lateralG = 0.1, accelG = 0.05, brakeG = 0.02`
  - Then: degradation > 0 and <= 1e-6

- **AC-8 (dev mode)**:
  - Given: "car-1" registered, `baseDegradationRate = 0`
  - When: `calculate(0.016)` with maximum loads
  - Then: `tireCondition === 1.0` (no degradation)

- **AC-9 (independent per-car state)**:
  - Given: "car-1" with `tireCondition = 0.5`, "car-2" with `tireCondition = 1.0`
  - When: `calculate(0.016)` called — both cars receive same loads
  - Then: both cars degrade independently; `getTireCondition("car-2") > getTireCondition("car-1")`

- **Edge cases**:
  - `unregisterCar` on non-existent carId: no-op, no error thrown
  - `getTireCondition` on non-existent carId: returns `undefined`
  - `registerCar` for already-registered carId: no-op or replace (TBD — consistent with Fuel pattern)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/tire-wear/tire-degradation.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: TireConfig values must be registered in Data & Config Manager (namespace `tire.*`) before Tire Wear init
- Unlocks: Story 002 (Tire Wear Modifiers), Story 003 (Tire Blowout, resetTires, and Race Lifecycle)
