# Fuel

> **Status**: Design Complete
> **Author**: build agent
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Simple Strategy

## Overview

Fuel tracks each car's remaining fuel and calculates `fuelMult` (0.0–1.0) which feeds into Physics/Handling as a multiplier on engine power output. Fuel is consumed per tick based on throttle position and the team's fuel efficiency upgrade. When the player lifts off the accelerator (coasting), consumption is zero.

Fuel is a **strategic layer**, not a simulation of thermodynamics. The player controls consumption with their right foot: full throttle every corner means burning through the tank faster; lift-and-coast means stretching fuel at the cost of lap time. Running out of fuel before the finish line means DNF — the car coasts to a stop.

Phase 1 includes refuelling during pit stops. The pit stop system calls `Fuel.addFuel(carId, amount)` when the car reaches the garage, adding fuel at `pit.refuelRate` each tick until the tank is full or the player chooses to exit early. Running out of fuel on track means DNF — the car coasts to a stop.

---

## Player Fantasy

The player glances at the fuel bar and makes a risk calculation: "I can push for two more laps, but then I'll be on fumes for the final. Do I start lift-and-coast now, or push and hope I have enough?"

Fuel management rewards planning over reaction. Every throttle application carries a cost — not just "am I going the right speed?" but "is this worth the fuel?" The player who masters lift-and-coast can complete the same race distance on less fuel, leaving room for aggressive bursts when it matters.

---

## Detailed Design

### Fuel Consumption Model

Fuel consumption is calculated per fixed tick (1/60 s) by the Fuel system, which runs after Physics in the pipeline order:

```
Input → Physics/Handling → AI Driver → Collision → Fuel → Tire Wear → Race Management
```

Each tick, Fuel receives the average throttle position from Physics (`throttleAvg`, 0.0–1.0) for each car:

```
fuelUsed = throttleAvg × baseRate × efficiencyRate × fixedDt
fuelLevel -= fuelUsed
fuelMult = fuelLevel / maxCapacity
```

- `throttleAvg` — average throttle position over the tick (from Physics). At 0 (coasting), consumption is zero.
- `baseRate` — global tuning constant, calibrated per race distance (~0.02 / s at full throttle default)
- `efficiencyRate` — upgrade stat multiplier (see Section 5.2)
- `fixedDt` — 1/60 s

`fuelMult` is sent to Physics **next tick** (one-tick delay). At 16 ms this is imperceptible.

Coasting (throttle = 0) means zero consumption. Every fuel saving decision is expressed as a driving action — the player lifts earlier before corners or coasts down straights. This is the same technique as real F1 lift-and-coast: the driver balances lap time against fuel remaining by choosing when to apply throttle.

### Upgrade Mapping

Fuel efficiency upgrade (`Fuel Efficiency`, level 1–5) maps to `efficiencyRate`:

| Level | `efficiencyRate` | Fuel per lap (relative to Level 1) |
| ----- | ---------------- | ---------------------------------- |
| 1     | 1.0              | 100% (baseline)                    |
| 2     | 0.9              | 90%                                |
| 3     | 0.8              | 80%                                |
| 4     | 0.7              | 70%                                |
| 5     | 0.6              | 60%                                |

A higher efficiency level means the same throttle produces less fuel burn. The upgrade affects all driving equally — it does not change the relationship between aggressive and conservative driving (that is always the player's throttle foot).

### Fuel Operations

Fuel exposes `addFuel(carId, amount)` — called by Pit Stop during refuel. This is the only external write to fuel levels other than the consumption pipeline. `addFuel` clamps the result to `maxCapacity`.

### Fuel Pipeline

```
Physics (throttleAvg per car per tick)
  │
  ▼
Fuel.calculate()
  │  throttleAvg × baseRate × efficiencyRate × dt
  │  → updates fuelLevel → fuelMult = fuelLevel / maxCapacity
  │
  ▼
Physics receives fuelMult next tick
  │  effectivePower = basePower × fuelMult
  │
  ▼
If fuelLevel ≤ 0:
  fuelMult = 0
  Event Bus emit: car.fuel_empty { carId }
  // Engine dead — car coasts. DNF when velocity ≈ 0.
```

### Fuel Capacity

Fuel capacity (`maxCapacity`) is a global constant — all cars share the same tank size. The strategic difference comes from per-team fuel efficiency upgrades (L1 = 1.0× consumption, L5 = 0.6×). An efficient car extracts more laps from the same tank than an inefficient one. Tank size is calibrated so that an average-efficiency car (Level 3) running at full throttle for ~80% of the race distance will just barely run out one lap before the finish. A player who lift-and-coasts (spending ~30% of the lap off-throttle) will finish with ~10-15% reserve. Aggressive full-throttle driving (rarely coasting, ~90% throttle duty cycle) will DNF before the final lap.

```typescript
// Calibration target:
// Track X at 5 laps, Level 3 efficiency
// Full throttle ~80% of lap → runs out on lap 4
// Lift-and-coast ~30% off-throttle → finishes with ~12% reserve
// AI personality decides throttle aggression per lap
```

`maxCapacity` is a global constant in the `fuel.*` namespace (see Tuning Knobs). Same value for all cars — the per-team efficiency upgrade creates the strategic spread.

---

## States & Transitions

| State        | Description                                                        |
| ------------ | ------------------------------------------------------------------ |
| **Inactive** | No race loaded. Fuel levels not initialized.                       |
| **Ready**    | Fuel loaded to `maxCapacity` for each car. Waiting for race start. |
| **Racing**   | Consuming fuel each tick.                                          |
| **Empty**    | One or more cars at fuelMult = 0. Engine dead for those cars.      |

Transition flow: `Inactive → Ready → Racing → Empty → Ready` (next race).

---

## Formulas

**Per-tick fuel consumption:**

```
fuelUsed = throttleAvg × baseRate × efficiencyRate × fixedDt
```

- Consumption is zero when throttle = 0 (coasting).

**Fuel multiplier to physics:**

```
fuelMult = max(0.0, fuelLevel / maxCapacity)
```

---

## System Interactions

| System               | Interaction                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| **Physics/Handling** | Receives `fuelMult` per tick. Sends `throttleAvg` per tick.                                         |
| **Data & Config**    | Provides `baseRate`, efficiency upgrade level, `maxCapacity`.                                       |
| **Event Bus**        | Emits `car.fuel_empty` when a car's fuel reaches 0.                                                 |
| **HUD**              | Consumes `fuelLevel` (0.0–1.0) per car for fuel bar display each frame.                             |
| **AI Driver**        | Reads `fuelLevel` per car to inform pit timing and fuel conservation decisions during race.         |
| **Pit Stop**         | Receives `addFuel(carId, amount)` when car reaches garage. Adds fuel at `pit.refuelRate` each tick. |
| **Audio**            | Consumes `fuel_empty` event for audio cue.                                                          |
| **Race Management**  | Listens for DNF from fuel_empty.                                                                    |

---

## Edge Cases

| Case                                  | Behaviour                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Fuel exactly 0 at finish line**     | If `fuelMult > 0` when crossing the finish line, the race ends normally. If fuelMult = 0 before crossing, DNF.        |
| **Fuel empty in pit entry**           | If fuel = 0 in pit, car reaches garage and refuels normally — no DNF. Only DNF if fuel = 0 and the car is not in pit. |
| **Race restart**                      | All cars reset to `maxCapacity`.                                                                                      |
| **AI fuel management**                | AI personality determines throttle aggression (e.g. aggressive = spends more time at full throttle per lap).          |
| **Fuel empty on last lap**            | Car coasts. If it crosses finish line before velocity = 0, race finishes normally.                                    |
| **Multiple cars fuel empty**          | Each car emits `car.fuel_empty` independently. Race continues for remaining cars.                                     |
| **baseRate set to 0 (infinite fuel)** | Dev mode for testing. Fuel never depletes.                                                                            |

---

## Dependencies

| System               | Dependency Type | Notes                                                     |
| -------------------- | --------------- | --------------------------------------------------------- |
| **Physics/Handling** | Hard            | Receives throttle data per tick. Sends fuelMult per tick. |
| **Data & Config**    | Hard            | All tuning knobs and upgrade levels.                      |
| **Event Bus**        | Hard            | Emits `car.fuel_empty`.                                   |

---

## Tuning Knobs

All knobs are in the `fuel.*` namespace in Data & Config Manager.

| Knob             | Default | Range | Description                                                            |
| ---------------- | ------- | ----- | ---------------------------------------------------------------------- |
| `fuel.baseRate`  | 0.02    | 0–0.1 | Fuel consumption per second at full throttle (fraction of maxCapacity) |
| `fuel.upgradeL1` | 1.0     | —     | Efficiency at level 1 (baseline)                                       |
| `fuel.upgradeL2` | 0.9     | —     | Efficiency at level 2                                                  |
| `fuel.upgradeL3` | 0.8     | —     | Efficiency at level 3                                                  |
| `fuel.upgradeL4` | 0.7     | —     | Efficiency at level 4                                                  |
| `fuel.upgradeL5` | 0.6     | —     | Efficiency at level 5                                                  |

Global: `fuel.maxCapacity` — fuel capacity for all cars (same tank size; efficiency upgrades create strategic spread per team).

---

## Visual & Audio Requirements

| Element                | Requirement                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| **Fuel bar**           | HUD element showing `fuelLevel` (0.0–1.0) per car. Player bar prominent, rival bars in standings. |
| **Fuel empty warning** | HUD flash when fuelMult < 0.1.                                                                    |
| **Audio: fuel_empty**  | Engine sputter audio cue when `car.fuel_empty` fires.                                             |

---

## Acceptance Criteria

1. Fuel consumption calculated per tick from throttleAvg
2. Consumption is zero when throttleAvg = 0 (coasting)
3. fuelMult reaches 0 when fuelLevel → 0, engine output zero
4. Efficiency upgrade Level 1 consumes baseline, Level 5 consumes 60% of baseline
5. `car.fuel_empty` emitted via Event Bus when fuelMult = 0
6. Car coasts after fuel_empty; DNF only when velocity ≈ 0
7. Race restart resets all fuel to maxCapacity
8. Each car tracks fuel independently (player and AI)
9. `baseRate = 0` makes fuel never deplete (dev mode)
10. HUD receives fuelLevel each frame for fuel bar display
11. fuel.maxCapacity is a global constant (same value for all cars; efficiency upgrade creates strategic spread)
