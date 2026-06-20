# Tire Wear

> **Status**: Design Complete
> **Author**: build agent
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Simple Strategy

## Overview

Tire Wear tracks each car's tire degradation and calculates `tire_condition` (0.0–1.0) which feeds into Physics/Handling as a multiplier on lateral grip. Degradation is driven by cornering and acceleration loads — aggressive driving wears tires faster, smooth driving preserves them.

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
tire_load = ((lateralG × lat_factor) + (accelG × accel_factor) + (brakeG × brake_factor))
            × (offTrack ? off_track_mult : 1.0)
degradation = tire_load × base_degradation_rate × efficiency_rate × track_abrasion × fixed_dt
tire_condition -= degradation
tire_condition = max(0.0, tire_condition)
```

- `lateralG` — 0.0 to ~3.0 (g-force from cornering)
- `lat_factor` — lateral load weight (default 1.5 — cornering loads wear tires fastest)
- `accel_factor` — acceleration load weight (default 1.0)
- `brake_factor` — braking load weight (default 0.8 — brakes can lock but are brief)
- `offTrack` — received from Track + Environment (spline distance > track width/2)
- `off_track_mult` — off-track load multiplier (default 2.0, range 1.0–5.0)
- `base_degradation_rate` — global tuning constant (~0.01 / s at medium load default)
- `efficiency_rate` — upgrade stat multiplier (see Section 5.2)
- `track_abrasion` — global multiplier for surface roughness (default 1.0, range 0.5–2.0). Same value for all cars; per-team durability upgrades create the strategic spread.
- `fixed_dt` — 1/60 s

### Upgrade Mapping

Tire durability upgrade (`Tire Wear`, level 1–5) maps to `efficiency_rate`:

| Level | `efficiency_rate` | Degradation per lap (relative to Level 1) |
| ----- | ----------------- | ----------------------------------------- |
| 1     | 1.0               | 100% (baseline)                           |
| 2     | 0.9               | 90%                                       |
| 3     | 0.8               | 80%                                       |
| 4     | 0.7               | 70%                                       |
| 5     | 0.6               | 60%                                       |

### Tire Operations

Tire Wear exposes `resetTires(carId)` — called by Pit Stop after `tire_change_delay`. Sets `tire_condition = 1.0` for that car.

### Effect on Physics

_Note: Tire temperature is not modelled in MVP — condition alone drives grip (see game-concept.md:65, Anti-Pillars). Temperature simulation is deferred to Alpha._

`tire_condition` is sent to Physics each tick. Physics uses it in the grip_max formula:

```
grip_max = base_grip × cornering_stat × tire_condition × speed_mod
```

At `tire_condition` values:

- **1.0 → 0.5**: gradual grip reduction — car becomes lazier in corners, needs more patience on turn-in
- **0.5 → 0.2**: noticeable understeer — car pushes wide if driven aggressively
- **0.2 → 0.01**: severe degradation — corners must be taken at very low speed
- **0.0**: tire blown — grip drops to `min_grip_factor` (~15%, configurable)

When `tire_condition` reaches 0.0, Tire Wear emits `car.tire_blown` via Event Bus. The car can still drive at ~15% grip. No automatic DNF.

### Tire Pipeline

```
Track + Environment (offTrack flag per car per tick)
  │
  ▼
Physics (lateralG, accelG, brakeG, offTrack per car per tick)
  │
  ▼
TireWear.calculate()
  │  tire_load × off_track_mult × base_rate × efficiency_rate × track_abrasion × dt
  │  → updates tire_condition (0.0–1.0)
  │
  ▼
Physics receives tire_condition next tick
  │  grip_max = base_grip × cornering_stat × tire_condition × speed_mod
  │
  ▼
If tire_condition ≤ 0:
  Event Bus emit: car.tire_blown { carId }
  // Grip drops to min_grip_factor. No DNF — player may still finish.
```

---

## States & Transitions

| State        | Description                                                                       |
| ------------ | --------------------------------------------------------------------------------- |
| **Inactive** | No race loaded. Tire levels not initialized.                                      |
| **Ready**    | All cars at `tire_condition = 1.0`. Waiting for race start.                       |
| **Racing**   | Degrading each tick based on loads.                                               |
| **Blown**    | One or more cars at tire_condition = 0.0. Grip at min_grip_factor for those cars. |

Transition flow: `Inactive → Ready → Racing → Blown → Ready` (next race).

---

## Formulas

**Per-tick tire load:**

```
tire_load = ((lateralG × lat_factor) + (accelG × accel_factor) + (brakeG × brake_factor)) × (offTrack ? off_track_mult : 1.0)
```

**Per-tick degradation:**

```
degradation = tire_load × base_degradation_rate × efficiency_rate × track_abrasion × fixed_dt
```

**Tire condition:**

```
tire_condition = max(0.0, tire_condition - degradation)
```

---

## System Interactions

| System                  | Interaction                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| **Physics/Handling**    | Receives `tire_condition` per tick. Sends `lateralG`, `accelG`, `brakeG` per tick.                       |
| **Track + Environment** | Sends `offTrack` flag per car per tick (spline distance > track width/2).                                |
| **Data & Config**       | Provides `base_degradation_rate`, efficiency upgrade level, `track_abrasion` (global), `off_track_mult`. |
| **Event Bus**           | Emits `car.tire_blown` when a car's tire_condition reaches 0.                                            |
| **HUD**                 | Consumes `tire_condition` (0.0–1.0) per car for tire bar display each frame.                             |
| **Pit Stop**            | Calls `resetTires(carId)` after `tire_change_delay` during pit stop — tire_condition resets to 1.0.      |
| **Audio**               | Consumes load data for tire squeal intensity. Consumes `tire_blown` event for audio cue.                 |
| **Race Management**     | Listens for tire_blown events but does not trigger DNF.                                                  |

---

## Edge Cases

| Case                             | Behaviour                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tire blowout on last lap**     | Grip drops to min_grip_factor. Player can limp to finish if they slow down enough for corners.                                                          |
| **Race restart**                 | All cars reset to `tire_condition = 1.0`.                                                                                                               |
| **Multiple cars blow tires**     | Each car emits `car.tire_blown` independently. Race continues for remaining cars.                                                                       |
| **Very low loads (pit limiter)** | Degradation is minimal — driving 80 km/h in pit lane produces near-zero tire wear.                                                                      |
| **base_degradation_rate = 0**    | Dev mode. Tire never wears.                                                                                                                             |
| **Off-track driving**            | Activates `off_track_mult` (~2.0x) on tire load while car is outside track boundaries. Even brief cuts through grass accelerate degradation noticeably. |
| **Per-car blowout**              | Tires are per-car (4 wheels tracked as one health pool). A blowout affects all 4 equally.                                                               |

---

## Dependencies

| System                  | Dependency Type | Notes                                                               |
| ----------------------- | --------------- | ------------------------------------------------------------------- |
| **Physics/Handling**    | Hard            | Receives load data per tick. Sends tire_condition per tick.         |
| **Track + Environment** | Hard            | Sends `offTrack` flag per tick for off-road degradation multiplier. |
| **Data & Config**       | Hard            | All tuning knobs, upgrade level, track abrasion, off_track_mult.    |
| **Event Bus**           | Hard            | Emits `car.tire_blown`.                                             |

---

## Tuning Knobs

All knobs in the `tire.*` namespace.

| Knob                         | Default | Range   | Description                                                                |
| ---------------------------- | ------- | ------- | -------------------------------------------------------------------------- |
| `tire.lat_factor`            | 1.5     | 0.5–3.0 | Lateral load weight in degradation calculation                             |
| `tire.accel_factor`          | 1.0     | 0.5–2.0 | Acceleration load weight                                                   |
| `tire.brake_factor`          | 0.8     | 0.5–2.0 | Braking load weight                                                        |
| `tire.base_degradation_rate` | 0.01    | 0–0.05  | Degradation per second at unit load (multiplied by tire_load)              |
| `tire.off_track_mult`        | 2.0     | 1.0–5.0 | Effective load multiplier when car is off-track (grass/gravel is abrasive) |
| `tire.min_grip_factor`       | 0.15    | 0–0.5   | Grip multiplier when tire_condition = 0 (blown)                            |
| `tire.upgrade_L1`            | 1.0     | —       | Durability at level 1 (baseline)                                           |
| `tire.upgrade_L2`            | 0.9     | —       | Durability at level 2                                                      |
| `tire.upgrade_L3`            | 0.8     | —       | Durability at level 3                                                      |
| `tire.upgrade_L4`            | 0.7     | —       | Durability at level 4                                                      |
| `tire.upgrade_L5`            | 0.6     | —       | Durability at level 5                                                      |

Global: `tire.trackAbrasion` — surface roughness multiplier (0.5–2.0). Same value for all cars and tracks; per-team durability upgrades create strategic spread.

---

## Visual & Audio Requirements

| Element                  | Requirement                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| **Tire bar**             | HUD element showing `tire_condition` per car. Player bar prominent. |
| **Tire blowout warning** | HUD flash when tire_condition < 0.2.                                |
| **Tire squeal**          | Audio intensity mapped to tire_load — more load = more squeal.      |
| **Audio: tire_blown**    | Distinct pop/rubber sound when `car.tire_blown` fires.              |

---

## Acceptance Criteria

1. ✅ Degradation calculated per tick from lateral and longitudinal loads
2. ✅ Higher loads cause faster degradation (cornering most impactful via lat_factor)
3. ✅ tire_condition updates each tick and is clamped to [0.0, 1.0]
4. ✅ Durability upgrade Level 1 degrades at baseline, Level 5 at 60% of baseline
5. ✅ `car.tire_blown` emitted via Event Bus when tire_condition = 0
6. ✅ Grip at tire_condition = 0 drops to `min_grip_factor` (~15%) — no DNF
7. ✅ Track abrasion multiplier — global constant (same for all tracks, per-team durability upgrades create strategic spread)
8. ✅ Race restart resets all cars to tire_condition = 1.0
9. ✅ Each car tracks tire condition independently
10. ✅ Off-track driving applies `off_track_mult` multiplier to tire load (default 2.0x)
11. ✅ `base_degradation_rate = 0` makes tire never wear (dev mode)
12. ✅ HUD receives tire_condition each frame for tyre bar display
13. ✅ Audio receives load data for tire squeal intensity mapping
14. ✅ Very low loads (pit limiter) produce near-zero degradation
