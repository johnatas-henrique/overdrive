# ADR-0012: Tire Model

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                                                   |
| **Domain**                | Simulation — Tire Wear                                                              |
| **Knowledge Risk**        | LOW — pure TypeScript math, no engine API usage                                     |
| **References Consulted**  | tire-wear.md GDD, architecture.md Pipeline Order, ADR-0011 (Fuel — sibling pattern) |
| **Post-Cutoff APIs Used** | None                                                                                |
| **Verification Required** | `tireCondition` → Physics gripMax; `car.tire_blown` emitted once, no DNF            |

## ADR Dependencies

| Field             | Value                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Depends On**    | ADR-0008 (Physics — provides lateralG, accelG, brakeG and consumes tireCondition), ADR-0002 (Fixed Timestep Pipeline — Tire slot #6, 1-tick delay), ADR-0001 (Event Bus — emits `car.tire_blown`) |
| **Enables**       | Pit Stop tire change (`resetTires`), HUD tire bar, AI Driver tire-aware corner speed                                                                                                              |
| **Blocks**        | Race Management (listens for tire_blown, no DNF)                                                                                                                                                  |
| **Ordering Note** | Pipeline slot #6 (after Fuel #5, before Race Management #7). Init slot #6.                                                                                                                        |

## Context

### Problem Statement

Tire degradation is a strategic layer: aggressive driving (high lateral/accel loads) wears tires faster, smooth driving preserves them. Tire condition scales grip linearly via `tireCondition` sent to Physics. At 0.0, grip drops to `minGripFactor` (~15%) — the car can still drive, but corners require very low speed. No automatic DNF from tire blowout.

### Constraints

- Fixed timestep degradation (1/60s per tick)
- Degradation driven by: lateralG × latFactor + accelG × accelFactor + brakeG × brakeFactor
- Off-track driving applies multiplier (default 2.0× load) — abrasive surface
- `tireCondition` delivered to Physics with 1-tick delay (same pattern as Fuel)
- `trackAbrasion` is a global constant — all cars/tracks share same value; per-team durability upgrades create strategic spread
- Tire condition is a single health pool per car (all 4 wheels aggregated)
- Pit Stop calls `resetTires(carId)` to restore condition to 1.0

### Requirements

- Per-tick degradation from Physics loads
- `tireCondition` sent to Physics each tick for gripMax formula
- Emit `car.tire_blown` when condition reaches 0 (one-shot, guard prevents re-emission)
- Expose `resetTires(carId)` for pit stop tire changes
- Each car tracks tire condition independently

## Decision

### Architecture

```
Pipeline slot #6 (FixedUpdatePipeline):
  TireWear.calculate(dt)
    │
    Read:  lateralG[carId], accelG[carId], brakeG[carId], offTrack[carId]
    │       from Physics (slot #2) and Track + Environment (slot #1)
    │
    Calc:  tireLoad = (latG × latFactor + accelG × accelFactor + brakeG × brakeFactor)
            × (offTrack ? offTrackMult : 1.0)
           degradation = tireLoad × baseDegradationRate × efficiencyRate × trackAbrasion × dt
           tireCondition -= degradation
           tireCondition = max(0.0, tireCondition)
    │
    Write: tireCondition[carId] → Physics reads next tick
    │
    If tireCondition ≤ 0 AND not yet emitted:
      emit('car.tire_blown', { carId })
```

### Key Interfaces

```typescript
interface ITireWear {
  registerCar(carId: string, durabilityLevel: number): void;
  unregisterCar(carId: string): void;
  calculate(dt: number): void; // pipeline slot #6
  resetTires(carId: string): void; // called by Pit Stop
  getTireCondition(carId: string): number; // 0..1
  dispose(): void;
}

interface TireState {
  condition: number; // 0..1, starts at 1.0
  efficiencyRate: number; // from durability upgrade level
}

interface TireConfig {
  latFactor: number;
  accelFactor: number;
  brakeFactor: number;
  baseDegradationRate: number;
  offTrackMult: number;
  trackAbrasion: number;
  upgradeL1toL5: number[];
}
```

### Degradation Formula

```
tireLoad = (lateralG × latFactor) + (accelG × accelFactor) + (brakeG × brakeFactor)
           × (offTrack ? offTrackMult : 1.0)
degradation = tireLoad × baseDegradationRate × efficiencyRate × trackAbrasion × fixedDt
tireCondition = max(0.0, tireCondition - degradation)
```

### tireCondition Delivery

Same pattern as Fuel — Tire calls `physics.onTireUpdate(carId, tireCondition)` (defined in ADR-0008's IPhysics interface), or writes to a shared `Map<string, number>` that Physics reads:

```
TireWear.calculate():
  const newCondition = max(0.0, tireCondition - degradation);
  Physics.onTireUpdate(carId, newCondition);  // per ADR-0008 IPhysics
  // Equivalent to: tireConditionMap.set(carId, newCondition)

Physics slot #2 (next tick):
  gripMax = baseGrip × cornerStat × tireCondition × speedMod
  // But clamp to prevent grip from dropping below minGripFactor at tireCondition = 0:
  // appliedGrip = max(gripMax, baseGrip × minGripFactor × cornerStat × speedMod)
```

### car.tire_blown Event

```typescript
if (tireCondition <= 0 && !this.emittedBlown[carId]) {
  this.emittedBlown[carId] = true;
  eventBus.emit("car.tire_blown", { carId });
}
```

### No DNF on Tire Blowout

`car.tire_blown` is informational only — Race Management does not trigger DNF. The car continues with grip at `minGripFactor`. The player can limp to the finish if they manage speed through corners.

## Alternatives Considered

### Alternative 1: Per-wheel tire tracking

- **Description**: Track tire condition for each of 4 wheels independently. Front-left wears differently from rear-right.
- **Cons**: Quadruple the state (32 entries for 8 cars). No gameplay mechanic in Phase 1 that differentiates per-wheel wear. Adds complexity to pit stop (replace specific wheel).
- **Rejection Reason**: A single health pool is sufficient for Phase 1 strategic gameplay. Per-wheel tracking adds complexity with no corresponding player-facing mechanic in MVP.

## Consequences

### Positive

- Simple linear degradation — easy to tune
- Direct feedback loop: aggressive driving → visible grip loss → strategic adjustment
- Single health pool per car — straightforward state management
- Same 1-tick delay pattern as Fuel — consistent pipeline design

### Negative

- Per-wheel tire tracking deferred — if Alpha introduces asymmetric wear, the single-pool model must be replaced
- Off-track multiplier is binary (on/off). Gradual degradation gradient at track edge not modeled in Phase 1

## GDD Requirements Addressed

| GDD Requirement                               | How This ADR Addresses It                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Degradation model per fixed tick              | `tireCondition` updated each 1/60s from Physics `TireLoad`                                                     |
| Wear formula with lateral/accel/brake factors | `tireLoad = (lateralG × latFactor) + (accelG × accelFactor) + (brakeG × brakeFactor)` with offTrack multiplier |
| Tire condition fed to Physics for grip        | `tireCondition` sent each tick — `gripMax = baseGrip × ... × tireCondition`                                    |
| `car.tire_blown` event                        | Emitted when `tireCondition = 0` — no DNF, reduced grip only                                                   |
| `resetTires(carId)` API for Pit Stop          | Sets `tireCondition = 1.0` after `tireChangeDelay`                                                             |
| Durability upgrades stored in ConfigManager   | `efficiencyRate` per upgrade level (L1–L5), same progression as fuel                                           |
| Global track abrasion multiplier              | `tire.trackAbrasion` (0.5–2.0) in ConfigManager                                                                |
| HUD and Audio consuming tire data             | HUD receives `tireCondition` per frame; Audio uses load for squeal intensity                                   |
| Off-track driving doubles tire load           | `offTrackMult` (2.0×) when spline distance > track width/2                                                     |
| Dev mode for testing                          | `baseDegradationRate = 0` disables wear entirely                                                               |

## Performance Implications

- **CPU**: ~0.002ms for 8 cars (5 multiplications + 2 additions + 1 clamp per car)
- **Memory**: `Map<string, TireState>` with 8 entries

## Validation Criteria

- [ ] Tire degradation proportional to lateralG, accelG, brakeG with configurable weights
- [ ] Coasting with zero load → zero degradation
- [ ] `car.tire_blown` emitted exactly once per car when condition reaches 0
- [ ] `resetTires(carId)` sets condition to 1.0
- [ ] Grip at tireCondition = 0 drops to `minGripFactor` (verified via Physics gripMax)
- [ ] No DNF triggered by tire blowout — race continues
- [ ] Off-track driving applies `offTrackMult` (2.0×) to tire load

## Related Decisions

- ADR-0008 (Physics — consumes tireCondition for gripMax formula)
- ADR-0011 (Fuel — sibling system, same pipeline pattern)
- ADR-0014 (Pit Stop Flow — calls resetTires during tire change)
- ADR-0001 (Event Bus — car.tire_blown event)
