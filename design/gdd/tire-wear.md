# Tire Wear

> **Status**: Design Complete
> **Author**: build agent
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Simple Strategy

## Overview

Tire Wear tracks each car's tire degradation and calculates `tireCondition` (0.0–1.0) which feeds into Physics/Handling as a multiplier on lateral grip. Degradation is driven by cornering and acceleration loads — aggressive driving wears tires faster, smooth driving preserves them.

Tire condition directly affects the car's ability to corner. A car with worn tires cannot carry speed through turns, creating a natural incentive for the player to drive smoothly over a race distance. Phase 1 includes tire changes during pit stops — the Pit Stop system calls `TireWear.resetTires(carId)` after a fixed delay, restoring grip to 100%.

---

## Player Fantasy

The player feels the front end start to wash mid-corner on lap 3 and knows: "I've been pushing too hard." They adjust their line — smoother turn-in, earlier lift, gentler throttle application — to preserve what grip remains for the final laps.

Tire management rewards smoothness and consistency. The player who brakes late and yanks the wheel will have an advantage for the first two laps, then watch the pack reel them in as their tires fall off the cliff.

---

## Detailed Design

### Tire Degradation Model

Tire degradation is calculated per fixed tick (1/60 s), running after Fuel in the pipeline order:

```
Input → Physics/Handling → AI Driver → Collision → Fuel → Tire Wear → Race Management
```

Each tick, Tire Wear receives lateral and longitudinal load data from Physics:

```typescript
type TireLoad = {
  lateralG: number; // absolute lateral acceleration this tick
  accelG: number; // longitudinal acceleration this tick (absolute)
  brakeG: number; // longitudinal deceleration this tick (absolute)
  offTrack: boolean; // true when car is outside track boundaries
};
```

Degradation is the sum of all loads, scaled by tuning constants. Off-track driving multiplies the effective load — rough surfaces (grass/gravel) are abrasive on tires:

```
tireLoad = ((lateralG × latFactor) + (accelG × accelFactor) + (brakeG × brakeFactor))
            × (offTrack ? offTrackMult : 1.0)
degradation = tireLoad × baseDegradationRate × efficiencyRate × trackAbrasion × fixedDt
tireCondition -= degradation
tireCondition = max(0.0, tireCondition)
```

- `lateralG` — 0.0 to ~3.0 (g-force from cornering)
- `latFactor` — lateral load weight (default 1.5 — cornering loads wear tires fastest)
- `accelFactor` — acceleration load weight (default 1.0)
- `brakeFactor` — braking load weight (default 0.8 — brakes can lock but are brief)
- `offTrack` — received from Track + Environment (spline distance > track width/2)
- `offTrackMult` — off-track load multiplier (default 2.0, range 1.0–5.0)
- `baseDegradationRate` — global tuning constant (~0.01 / s at medium load default)
- `efficiencyRate` — upgrade stat multiplier (see Section 5.2)
- `trackAbrasion` — global multiplier for surface roughness (default 1.0, range 0.5–2.0). Same value for all cars; per-team durability upgrades create the strategic spread.
- `fixedDt` — 1/60 s

### Upgrade Mapping

Tire durability upgrade (`Tire Wear`, level 1–5) maps to `efficiencyRate`:

| Level | `efficiencyRate` | Degradation per lap (relative to Level 1) |
| ----- | ---------------- | ----------------------------------------- |
| 1     | 1.0              | 100% (baseline)                           |
| 2     | 0.9              | 90%                                       |
| 3     | 0.8              | 80%                                       |
| 4     | 0.7              | 70%                                       |
| 5     | 0.6              | 60%                                       |

### Tire Operations

Tire Wear exposes `resetTires(carId)` — called by Pit Stop after `pit.tireChangeDelay`. Sets `tireCondition = 1.0` for that car.

### Effect on Physics

_Note: Tire temperature is not modelled in MVP — condition alone drives grip (see game-concept.md:65, Anti-Pillars). Temperature simulation is deferred to Alpha._

`tireCondition` is sent to Physics each tick. Physics uses it in the gripMax formula:

```
gripMax = baseGrip × corneringStat × tireCondition × speedMod
```

At `tireCondition` values:

- **1.0 → 0.5**: gradual grip reduction — car becomes lazier in corners, needs more patience on turn-in
- **0.5 → 0.2**: noticeable understeer — car pushes wide if driven aggressively
- **0.2 → 0.01**: severe degradation — corners must be taken at very low speed
- **0.0**: tire blown — grip drops to `physics.minGripFactor` (~15%, configurable)

When `tireCondition` reaches 0.0, Tire Wear emits `car.tire_blown` via Event Bus. The car can still drive at ~15% grip. No automatic DNF.

### Tire Pipeline

```
Track + Environment (offTrack flag per car per tick)
  │
  ▼
Physics (lateralG, accelG, brakeG, offTrack per car per tick)
  │
  ▼
TireWear.calculate()
  │  tireLoad × offTrackMult × baseRate × efficiencyRate × trackAbrasion × dt
  │  → updates tireCondition (0.0–1.0)
  │
  ▼
Physics receives tireCondition next tick
  │  gripMax = baseGrip × corneringStat × tireCondition × speedMod
  │
  ▼
If tireCondition ≤ 0:
  Event Bus emit: car.tire_blown { carId }
  // Grip drops to `physics.minGripFactor`. No DNF — player may still finish.
```

---

## States & Transitions

| State        | Description                                                                              |
| ------------ | ---------------------------------------------------------------------------------------- |
| **Inactive** | No race loaded. Tire levels not initialized.                                             |
| **Ready**    | All cars at `tireCondition = 1.0`. Waiting for race start.                               |
| **Racing**   | Degrading each tick based on loads.                                                      |
| **Blown**    | One or more cars at tireCondition = 0.0. Grip at `physics.minGripFactor` for those cars. |

Transition flow: `Inactive → Ready → Racing → Blown → Ready` (next race).

---

## Formulas

**Per-tick tire load:**

```
tireLoad = ((lateralG × latFactor) + (accelG × accelFactor) + (brakeG × brakeFactor)) × (offTrack ? offTrackMult : 1.0)
```

**Per-tick degradation:**

```
degradation = tireLoad × baseDegradationRate × efficiencyRate × trackAbrasion × fixedDt
```

**Tire condition:**

```
tireCondition = max(0.0, tireCondition - degradation)
```

---

## System Interactions

| System                  | Interaction                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| **Physics/Handling**    | Receives `tireCondition` per tick. Sends `lateralG`, `accelG`, `brakeG` per tick.                    |
| **Track + Environment** | Sends `offTrack` flag per car per tick (spline distance > track width/2).                            |
| **Data & Config**       | Provides `baseDegradationRate`, efficiency upgrade level, `trackAbrasion` (global), `offTrackMult`.  |
| **Event Bus**           | Emits `car.tire_blown` when a car's tireCondition reaches 0.                                         |
| **HUD**                 | Consumes `tireCondition` (0.0–1.0) per car for tire bar display each frame.                          |
| **AI Driver**           | Reads `tireCondition` per car for corner speed calculation and pit timing decisions.                 |
| **Pit Stop**            | Calls `resetTires(carId)` after `pit.tireChangeDelay` during pit stop — tireCondition resets to 1.0. |
| **Audio**               | Consumes load data for tire squeal intensity. Consumes `tire_blown` event for audio cue.             |
| **Race Management**     | Listens for tire_blown events but does not trigger DNF.                                              |

---

## Edge Cases

| Case                             | Behaviour                                                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tire blowout on last lap**     | Grip drops to `physics.minGripFactor`. Player can limp to finish if they slow down enough for corners.                                                |
| **Race restart**                 | All cars reset to `tireCondition = 1.0`.                                                                                                              |
| **Multiple cars blow tires**     | Each car emits `car.tire_blown` independently. Race continues for remaining cars.                                                                     |
| **Very low loads (pit limiter)** | Degradation is minimal — driving 80 km/h in pit lane produces near-zero tire wear.                                                                    |
| **baseDegradationRate = 0**      | Dev mode. Tire never wears.                                                                                                                           |
| **Off-track driving**            | Activates `offTrackMult` (~2.0x) on tire load while car is outside track boundaries. Even brief cuts through grass accelerate degradation noticeably. |
| **Per-car blowout**              | Tires are per-car (4 wheels tracked as one health pool). A blowout affects all 4 equally.                                                             |

---

## Dependencies

| System                  | Dependency Type | Notes                                                               |
| ----------------------- | --------------- | ------------------------------------------------------------------- |
| **Physics/Handling**    | Hard            | Receives load data per tick. Sends tireCondition per tick.          |
| **Track + Environment** | Hard            | Sends `offTrack` flag per tick for off-road degradation multiplier. |
| **Data & Config**       | Hard            | All tuning knobs, upgrade level, track abrasion, offTrackMult.      |
| **Event Bus**           | Hard            | Emits `car.tire_blown`.                                             |

---

## Tuning Knobs

All knobs in the `tire.*` namespace.

| Knob                       | Default | Range   | Description                                                                |
| -------------------------- | ------- | ------- | -------------------------------------------------------------------------- |
| `tire.latFactor`           | 1.5     | 0.5–3.0 | Lateral load weight in degradation calculation                             |
| `tire.accelFactor`         | 1.0     | 0.5–2.0 | Acceleration load weight                                                   |
| `tire.brakeFactor`         | 0.8     | 0.5–2.0 | Braking load weight                                                        |
| `tire.baseDegradationRate` | 0.01    | 0–0.05  | Degradation per second at unit load (multiplied by tireLoad)               |
| `tire.offTrackMult`        | 2.0     | 1.0–5.0 | Effective load multiplier when car is off-track (grass/gravel is abrasive) |
| `tire.upgradeL1`           | 1.0     | —       | Durability at level 1 (baseline)                                           |
| `tire.upgradeL2`           | 0.9     | —       | Durability at level 2                                                      |
| `tire.upgradeL3`           | 0.8     | —       | Durability at level 3                                                      |
| `tire.upgradeL4`           | 0.7     | —       | Durability at level 4                                                      |
| `tire.upgradeL5`           | 0.6     | —       | Durability at level 5                                                      |

Global: `tire.trackAbrasion` — surface roughness multiplier (0.5–2.0). Same value for all cars and tracks; per-team durability upgrades create strategic spread.

---

## Visual & Audio Requirements

| Element                  | Requirement                                                        |
| ------------------------ | ------------------------------------------------------------------ |
| **Tire bar**             | HUD element showing `tireCondition` per car. Player bar prominent. |
| **Tire blowout warning** | HUD flash when tireCondition < 0.2.                                |
| **Tire squeal**          | Audio intensity mapped to tireLoad — more load = more squeal.      |
| **Audio: tire_blown**    | Distinct pop/rubber sound when `car.tire_blown` fires.             |

---

## Acceptance Criteria

1. Degradation calculated per tick from lateral and longitudinal loads
2. Higher loads cause faster degradation (cornering most impactful via latFactor)
3. tireCondition updates each tick and is clamped to [0.0, 1.0]
4. Durability upgrade Level 1 degrades at baseline, Level 5 at 60% of baseline
5. `car.tire_blown` emitted via Event Bus when tireCondition = 0
6. Grip at tireCondition = 0 drops to `physics.minGripFactor` (~15%) — no DNF
7. Track abrasion multiplier — global constant (same for all tracks, per-team durability upgrades create strategic spread)
8. Race restart resets all cars to tireCondition = 1.0
9. Each car tracks tire condition independently
10. Off-track driving applies `offTrackMult` multiplier to tire load (default 2.0x)
11. `baseDegradationRate = 0` makes tire never wear (dev mode)
12. HUD receives tireCondition each frame for tyre bar display
13. Audio receives load data for tire squeal intensity mapping
14. Very low loads (pit limiter) produce near-zero degradation
