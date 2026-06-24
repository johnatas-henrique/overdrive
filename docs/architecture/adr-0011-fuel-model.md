# ADR-0011: Fuel Model

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                 |
| ------------------------- | ----------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                     |
| **Domain**                | Simulation — Fuel                                     |
| **Knowledge Risk**        | LOW — pure TypeScript math, no engine API usage       |
| **References Consulted**  | fuel.md GDD, architecture.md Pipeline Order           |
| **Post-Cutoff APIs Used** | None                                                  |
| **Verification Required** | fuelMult = 0 → Physics receives power multiplier of 0 |

## ADR Dependencies

| Field             | Value                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Depends On**    | ADR-0008 (Physics — consumes `fuelMult`, provides `throttleAvg`), ADR-0010 (Collision — fuel pipeline slot #5), ADR-0001 (Event Bus — emits `car.fuel_empty`) |
| **Enables**       | Pit Stop refueling (`addFuel`), HUD fuel bar display, AI Driver fuel-aware strategy                                                                           |
| **Blocks**        | Tire Wear (sibling slot #6), Race Management (listens for fuel-level DNF)                                                                                     |
| **Ordering Note** | Pipeline slot #5 (after Collision #4, before Tire Wear #6). Init slot #5 (part of simulation init group).                                                     |

## Context

### Problem Statement

Fuel consumption is a strategic layer: the player decides how hard to push on throttle, trading lap time for fuel reserve. Each car consumes fuel per tick proportionally to throttle position, efficiency upgrade, and a global rate. Fuel level scales engine power linearly via `fuelMult`. Empty fuel → engine dead → DNF.

### Constraints

- Fixed timestep consumption (1/60s per tick)
- Fuel consumption is zero when throttle = 0 (coasting)
- `fuelMult` delivered to Physics with exactly 1-tick delay (16ms — imperceptible)
- `maxCapacity` is a global constant — all cars share the same tank size; strategic spread comes from per-team efficiency upgrades
- Pit Stop is the only external writer to fuel level (via `addFuel`)

### Requirements

- Per-tick consumption: `fuelUsed = throttleAvg × baseRate × efficiencyRate × fixedDt`
- `fuelMult = max(0.0, fuelLevel / maxCapacity)` sent to Physics next tick
- Emit `car.fuel_empty` when fuelLevel ≤ 0
- Expose `addFuel(carId, amount)` for pit stop refueling
- Each car tracks fuel independently (Map<string, FuelState>)
- Reset all cars to `maxCapacity` on race restart

## Decision

### Architecture

```
Pipeline slot #5 (FixedUpdatePipeline):
  Fuel.calculate(dt)
    │
    Read:  throttleAvg[carId] from Physics (written by slot #2)
    │
    Calc:  fuelUsed = throttleAvg × baseRate × efficiencyRate × dt
    │       fuelLevel -= fuelUsed
    │       fuelMult = fuelLevel / maxCapacity (clamped to 0)
    │
    Write: fuelMult[carId] → Physics reads next tick
    │
    If fuelLevel ≤ 0:
      emit('car.fuel_empty', { carId })
```

### Key Interfaces

```typescript
interface IFuel {
  /** Register a car (called on entity.spawned from Event Bus) */
  registerCar(carId: string, efficiencyLevel: number): void;
  /** Remove a car (called on entity.despawned) */
  unregisterCar(carId: string): void;
  /** Called by pipeline slot #5 — consumes throttleAvg, writes fuelMult to shared state */
  calculate(dt: number): void;
  /** Called by Pit Stop during refuel */
  addFuel(carId: string, amount: number): void;
  getFuelLevel(carId: string): number;
  getFuelMult(carId: string): number;
  reset(): void; // race restart → all to maxCapacity
  dispose(): void;
}

interface FuelState {
  level: number;
  efficiencyRate: number; // from upgrade level, set during registerCar
}
```

### fuelMult Delivery

Fuel writes `fuelMult` to a shared `Map<string, number>` that Physics reads each tick. This is a shared state map, not a push API:

```
Fuel.calculate():
  fuelMultMap.set(carId, max(0.0, fuelLevel / maxCapacity))

Physics slot #2:
  fuelMult = fuelMultMap.get(carId) ?? 1.0  // defaults to 1.0 if no Fuel yet
```

Physics's `onFuelUpdate(carId, fuelMult)` callback from ADR-0008 is not used — the shared map is simpler and avoids the callback registration overhead for an 8-car system.

interface FuelConfig {
baseRate: number; // global consumption rate at full throttle
upgradeL1toL5: number[]; // efficiency multiplier per upgrade level
maxCapacity: number; // global tank size
}

```

### Consumption Formula

```

fuelUsed = throttleAvg × baseRate × efficiencyRate × fixedDt
fuelLevel -= fuelUsed
fuelMult = max(0.0, fuelLevel / maxCapacity)

````

Where:
- `throttleAvg` (0..1): average throttle from Physics over the tick
- `baseRate` (default 0.02): global tuning constant, fraction of maxCapacity consumed per second at full throttle
- `efficiencyRate`: from upgrade level (L1=1.0, L2=0.9, L3=0.8, L4=0.7, L5=0.6)
- `fixedDt`: 1/60s

### One-Tick Delay

Physics consumes `fuelMult` from the previous tick's calculation. This means:

```typescript
// Tick N:
Fuel.calculate():
  fuelMult[N] = fuelLevel / maxCapacity  // written after Physics slot #2 already ran
  // Physics already used fuelMult[N-1] this tick

// Tick N+1 (16ms later):
Physics slot #2:
  power = torqueCurve(rpm) × throttle × fuelMult[N]  // uses value from last Fuel tick
````

The 16ms delay is imperceptible and avoids a circular dependency within a single tick.

### car.fuel_empty Event

```typescript
if (fuelLevel <= 0 && !this.emittedEmpty[carId]) {
  this.emittedEmpty[carId] = true;
  eventBus.emit("car.fuel_empty", { carId });
}
```

The flag prevents re-emission every tick while fuel stays at 0.

## Alternatives Considered

### Alternative 1: Zero-delay fuel delivery

- **Description**: Physics reads fuelMult after Fuel runs in the same tick. Pipeline order: Physics Phase 1 (input) → AI → Collision → Fuel → Physics Phase 2 (apply fuelMult).
- **Cons**: Splitting Physics into two phases complicates the pipeline. The 1-tick delay is 16ms — below human perception.
- **Rejection Reason**: A two-phase Physics slot adds complexity with zero perceptible benefit. 1-tick delay is standard for cross-system data dependencies.

## Consequences

### Positive

- Simple linear formula — easy to tune, easy to debug
- Coasting = zero consumption — direct skill feedback
- One-tick delay avoids intra-tick circular dependency with Physics
- `addFuel` is the only external writer — consumption path is pure deterministic math
- `maxCapacity` global + per-team efficiency spread creates strategic diversity

### Negative

- AI Driver reads fuelLevel for pit timing — must access Fuel's map directly (no event-based notification for gradual fuel drop)
- `car.fuel_empty` is a one-shot event — if the flag logic has a bug, multiple emissions could flood the bus. Mitigated by `emittedEmpty` guard.

### Risks

- **Risk**: baseRate calibration requires playtesting for the intended fuel curve (80% throttle → DNF 1 lap before finish)
  **Mitigation**: baseRate is a knob — tunable without code changes. Calibration target documented in fuel.md.

## GDD Requirements Addressed

| GDD System | Requirement                           | How This ADR Addresses It                      |
| ---------- | ------------------------------------- | ---------------------------------------------- |
| fuel.md    | Per-tick consumption from throttleAvg | `throttleAvg × baseRate × efficiencyRate × dt` |
| fuel.md    | Zero consumption when coasting        | throttleAvg = 0 → fuelUsed = 0                 |
| fuel.md    | fuelMult = 0 when empty               | `max(0.0, fuelLevel / maxCapacity)`            |
| fuel.md    | Efficiency upgrade mapping            | upgradeL1-L5 in FuelConfig                     |
| fuel.md    | addFuel for pit stop refueling        | `addFuel(carId, amount)` API                   |
| fuel.md    | car.fuel_empty event                  | One-shot emit with guard                       |
| fuel.md    | Race restart reset                    | `reset()` → all cars to maxCapacity            |

## Performance Implications

- **CPU**: One multiplication + one subtraction + one division per car per tick = ~0.001ms for 8 cars
- **Memory**: `Map<string, FuelState>` with 8 entries = ~500 bytes

## Validation Criteria

- [ ] `fuelLevel -= throttleAvg × baseRate × efficiencyRate × dt` produces correct consumption
- [ ] Coasting (throttleAvg = 0) → fuelUsed = 0
- [ ] `fuelMult = 0` when fuelLevel ≤ 0 → Physics receives power multiplier of 0
- [ ] `car.fuel_empty` emitted exactly once per car (guard prevents re-emission)
- [ ] `addFuel` correctly adds fuel and clamps to maxCapacity
- [ ] `reset()` sets all cars to maxCapacity
- [ ] Efficiency upgrade L1 consumes 1.0×, L5 consumes 0.6× of baseline under same throttle

## Related Decisions

- ADR-0008 (Physics — consumes fuelMult each tick with 1-tick delay)
- ADR-0014 (Pit Stop Flow — calls addFuel during refuel)
- ADR-0001 (Event Bus — car.fuel_empty event)
