# Physics/Handling

> **Status**: Design Complete
> **Author**: Overdrive Team
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Speed That Is Felt (primary)

## Overview

Physics/Handling is the system that moves the car around the track in response to player input. It is the single most important system for the Speed That Is Felt pillar — if the physics do not feel right, nothing else matters. The model is arcade grip: the car sticks to the ground up to a lateral acceleration limit, the primary turning technique is lift-off oversteer, and there is no simulation of suspension geometry, tire temperature, weight transfer, or ERS. The design test (game-concept.md §47) applies here directly: "If we're debating between a realistic physics tweak and one that makes the car feel faster at the same speed, we choose the one that feels faster."

This system receives raw analog input (steering, throttle, brake) and digital input (gear up/down) from the Input system and produces the car's position, velocity, heading, and telemetry data (speed, RPM, gear, lateral G, tire squeal) — consumed by Camera, Audio, HUD, Fuel, Tire Wear, and Collision.

## Player Fantasy

The car is an extension of the driver's body. The player thinks "turn" and the car turns — predictably, responsively, within a visible envelope. The grip is generous but has a sharp, readable edge: the player can feel when the front tires are about to give, and the best players live on that edge every corner.

Lift-and-turn is the primary technique: lift throttle before the corner entry, let the rear step out just enough to rotate the nose toward the apex, then apply power through exit. The player who masters this rhythm at Monza and Interlagos will beat the player who brakes early and crawls through.

## Detailed Design

### Core Rules

**1. Ground adhesion.** The car is always on the ground in Phase 1. No airborne, no jumps, no terrain ramps. The car follows the track surface height and normal at all times.

**2. Lateral grip envelope (the key model).** Every car has a lateral grip limit — the maximum lateral acceleration its tires can sustain. This limit is the product of:

```
grip_max = base_grip × cornering_stat × tire_condition × speed_mod
```

- `base_grip` — global tuning constant for the feel of the game
- `cornering_stat` — the team's inherent cornering ability (upgrade level 1-5, mapped to a 0.6-1.0 multiplier)
- `tire_condition` — current tire state (1.0 = brand new, ~0.4 = completely worn, fed from Tire Wear system each tick)
- `speed_mod` — simplified downforce effect: grip increases with speed up to a reference point

**Within the envelope**: the car turns exactly as requested — responsive, planted, predictable. **Beyond the envelope**: the car understeers (front tires lose grip, the car pushes wide). The player feels the edge approaching as a gradual loss of response before the push begins.

**3. Lift-off oversteer.** When the player lifts throttle mid-turn (throttle ≈ 0, steering > threshold), rear grip drops below front grip for a brief window. The car rotates toward the apex faster than normal. This is the primary skill mechanic — knowing when to lift and when to get back on power defines a good lap.

```
if throttle < 0.05 AND brake < 0.05 AND |steering| > 0.1:
  rear_grip_mult = lift_off_rear_factor  // default 0.7, rear grip is 70% of front
  // grip imbalance creates rotation torque → car tucks into the corner
```

**4. Velocity-dependent steering.** Maximum steering angle is clamped by speed: at low speed the front wheels turn fully; at high speed steering is progressively limited. This is a secondary speed-feel cue — the wheel becomes heavier (visually) at speed.

**5. No drift model.** The car does not sustain slides. Oversteer is a rotation assist, not a drift state. If the player holds extreme steering at speed with throttle down, the front understeers rather than the rear oversteering.

**6. Kerbs.** Running over kerbs causes ~20% grip reduction for 2 ticks and sends a shake signal to Camera. No damage, no spin in Phase 1 — just time loss if overdone.

**7. Gear system (auto-shift with manual override).** Default auto-shift near the RPM ceiling (configurable threshold, default 95%). Player can toggle manual. 6 forward gears + reverse + neutral. Gear selection determines the torque multiplier applied to throttle — lower gear = more acceleration per throttle, higher gear = higher top speed.

**8. Elevation affects speed.** Uphill reduces net acceleration; downhill increases it. Applied as a longitudinal force modifier derived from track gradient data.

**9. Zero input = coast.** All analog inputs at zero → drag + rolling friction gradually reduce speed. No auto-brake, no auto-steer.

**10. Fixed timestep only.** Physics runs exclusively in the 1/60 s fixed update tick. No physics in the render loop. Pipeline order: Input → **Physics/Handling** → AI Driver → Collision → Fuel → Tire Wear → Race Management.

### Upgrades (5 stats)

Every car has 5 upgradeable stats, each level 1-5:

| Stat                | Effect on Physics                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Top Speed**       | Maps to `power_ceiling` — maximum speed the car can achieve on a flat straight                             |
| **Acceleration**    | Maps to `accel_factor` — how quickly the car reaches its speed ceiling                                     |
| **Cornering**       | Maps to `cornering_stat` — the car's lateral grip limit multiplier (0.6 → 1.0)                             |
| **Fuel Efficiency** | Consumed by Fuel system (less throttle integral per unit of fuel → Physics publishes throttle data)        |
| **Tire Wear**       | Consumed by Tire Wear system (slower degradation rate → Physics receives higher tire_condition for longer) |

Fuel efficiency and tire durability are owned by their respective systems. Physics is the data source (throttle integral, lateral/longitudinal loads) and the consumer (fuel → power cutoff, tire condition → grip).

### Fuel and Tire Effects on Physics

- **Tire condition** (`tire_condition`, 0.0–1.0): fed from Tire Wear system once per tick. Multiplies grip_max linearly. At 0.4 the car is barely driveable through corners. At 0.0 the tire has blown — grip drops to ~15% of normal (configurable via `min_grip_factor`). Engine power is unaffected. The car can still drive, but corners must be taken at very low speed. No automatic DNF from tire blowout — the player decides whether they can limp to the finish. Physics emits `car.tire_blown`. If the player crosses the finish line, the race ends normally.
- **Fuel level** (`fuel_mult`, 0.0–1.0): fed from Fuel system once per tick. Multiplies engine power output linearly. At 0.0 the engine is dead — throttle produces zero power. Physics emits `car.fuel_empty`. The car coasts with remaining momentum. If it crosses the finish line before stopping, the race finishes normally. DNF triggers only when velocity ≈ 0.
- **Engine dead coast-to-stop** (velocity ≈ 0, engine dead from fuel_empty): Physics emits `car.stopped`. Payload: `{ carId }`. Condition: `engineDead && velocity < epsilon && prevVelocity > epsilon`. Race Management subscribes to this event for DNF processing.

### States and Transitions

Physics runs during the Racing GSM state. No idle/warmup/racing substate in Phase 1.

| State    | Description                                                                                                                                                                         | Entry                      | Exit                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| Inactive | No car loaded. Not ticking.                                                                                                                                                         | GSM exit                   | GSM → PreRace                                                           |
| Grid     | Car on starting position. **Car locked at 0 km/h.** Input accepted (steering wheel and wheel rotation animate) but the car does not move. Lights countdown running.                 | PreRace entry              | Race start (lights out)                                                 |
| Racing   | Car responds to all inputs. Physics ticking each fixed step.                                                                                                                        | Lights out                 | Finish line crossed, player retires, or DNF (fuel empty → velocity ≈ 0) |
| Retired  | Car DNF — fuel empty (engine dead, coasts to stop, DNF at velocity ≈ 0) or player manually retired. Tire blowout alone does NOT trigger DNF — the player may still finish the race. | Physics or Race Mgmt event | GSM → PostRace → Inactive                                               |

On the grid: the steering wheel and front wheels animate visually (player can turn the wheel) but the car has zero velocity and will not move. This is purely cosmetic during the starting procedure. The car is unlocked automatically when the race starts.

### Interactions with Other Systems

| System               | Data Out                                          | Data In                                             | Direction           |
| -------------------- | ------------------------------------------------- | --------------------------------------------------- | ------------------- |
| Input                | —                                                 | steering (-1..1), throttle (0..1), brake (0..1)     | Input → Physics     |
| Entity/Car Lifecycle | —                                                 | `CarEntity` reference (mesh, transform)             | Lifecycle → Physics |
| Data & Config        | —                                                 | team stats, global tuning constants, upgrade levels | Config → Physics    |
| Determinism          | —                                                 | fixed timestep contract, FixedUpdatePipeline entry  | Contract → Physics  |
| **Fuel**             | throttle integral (0..1 per tick)                 | `fuel_mult` (0..1) → multiplies engine power        | Physics ↔ Fuel      |
| **Tire Wear**        | lateral load, longitudinal load per tick          | `tire_condition` (0..1) → multiplies grip_max       | Physics ↔ Tire Wear |
| Camera               | speed_kmh, lateral G, accel G, kerb_hit flag      | —                                                   | Physics → Camera    |
| Audio                | speed_kmh, RPM, gear, tire_squeal (0-1), kerb_hit | —                                                   | Physics → Audio     |
| HUD                  | speed_kmh, RPM, gear                              | —                                                   | Physics → HUD       |
| Collision            | current mesh bounds, velocity                     | collision impulse (direction, magnitude)            | Collision ↔ Physics |
| Dev Tools            | telemetry snapshot                                | —                                                   | Physics → Dev Tools |

## Formulas

### Lateral Grip

```
grip_max = base_grip × corner_stat(virarem_level) × tire_condition × speed_mod

speed_mod = lerp(0.5, 1.0, speed / reference_speed)
  // Downforce effect: grip increases with speed up to a reference point
```

`corner_stat(level) = 0.6 + (level - 1) × 0.1` → level 1 = 0.6, level 5 = 1.0.

### Steering Rate

```
steering_limit = steer_max × clamp(1 - speed / steer_clamp_speed, steer_min_ratio, 1.0)

yaw_rate = steering_input × steering_limit × dt
```

`steer_clamp_speed` (~150 km/h) = above this, only 30% steering remains. `steer_min_ratio` = 0.3.

On the grid (speed = 0): steering_limit = steer_max (full rotation). The wheel and front wheels animate, but the car has zero velocity so yaw_rate × 0 = no movement. When the race starts, the car is unlocked automatically.

### Engine Power

```
rpm = min(speed / gear_ratio[current_gear] × gear_ratio[1], rpm_max)

power = torque_curve(rpm) × throttle × fuel_mult × power_ceiling
```

`fuel_mult` is supplied by the Fuel system (1.0 = full tank, 0.0 = empty → power = 0).
`power_ceiling` is derived from `velocidade_final` upgrade level.
`torque_curve` is defined by `aceleracao` upgrade level (higher = more area under the curve).

### Drag

```
drag_force = drag_coefficient × speed² × sign(-speed)
```

### Brake Force

```
brake_force = brake_input × max_brake_force
```

Brakes are not upgradeable — the brake stat is a global constant tuned to produce the desired stopping distance. All teams brake equally (the skill is choosing whether and when to brake, not how hard).

### Off-track Surface

```
on_grass:
  grip_max = grip_max × 0.3          // 70% grip reduction, car barely turns
  friction = friction × 6            // loses speed fast
  min_grass_speed = top_speed × 0.3  // car is never slowed below ~1/3 top speed
```

The car can rejoin the track by steering back. If the player cuts a corner, they enter at reduced speed and low grip — it costs time without trapping them.

## Edge Cases

- **Car stationary on grid**: Car locked at 0 km/h. Steering wheel and wheels rotate visually. No movement until lights-out trigger.
- **Tire blowout (tire_condition → 0)**: grip drops to ~15% of normal (`min_grip_factor` knob). Engine power unaffected. The car can still drive, but corners require very low speed. Physics emits `car.tire_blown`. No automatic DNF — the player may still finish the race.
- **Fuel empty (fuel_mult → 0)**: Engine power → 0 regardless of throttle. Physics emits `car.fuel_empty`. Car coasts with remaining momentum. Physics emits `car.stopped` when velocity ≈ 0. DNF only after `car.stopped` — player may coast to finish line before stopping.
- **Off-track**: Grass/gravel applies 6× friction and 70% grip reduction. Car maintains ~1/3 top speed minimum — can always rejoin.
- **Reverse driving**: If the car is stopped and the player holds brake + downshift past 1st, car enters reverse (capped at ~40 km/h).
- **Spinning**: Not simulated in Phase 1. If a collision sends the car backward, the forward direction is the nose direction — the car can drive from there.
- **Frame drop catch-up**: Accumulator capped at `FIXED_DT × 4`. Physics never skips a tick.
- **Brake + throttle simultaneously**: Brake overrides throttle. Net force = brake + drag.

## Dependencies

| Dependency           | Type     | Notes                                               |
| -------------------- | -------- | --------------------------------------------------- |
| Babylon.js 9.12.0    | Platform | Vector3 math, Quaternion rotations, Mesh transforms |
| Input                | Upstream | Steering, throttle, brake (analog); gear (digital)  |
| Entity/Car Lifecycle | Upstream | Provides the CarEntity (mesh reference + transform) |
| Data & Config Mgmt   | Upstream | Team stats, upgrade levels, global tuning constants |
| Determinism Contract | Upstream | FixedUpdatePipeline registration, fixed timestep    |

## Tuning Knobs

**Every formula constant, threshold, and mapping in this document is a runtime-configurable value** read from the Data & Config Manager at namespace `physics.*`. No hardcoded magic numbers — if a number appears in a formula, it is a knob. This guarantees that playtesting can tune any value without code changes.

The table below lists the initial 21 knobs. As playtesting reveals needs, new knobs are added to the namespace without structural changes — the system reads all values from Config Manager at startup and can hot-reload them via HMR (Data & Config Manager §6).

| Knob                        | Namespace                        | Default | Range       | Description                                               |
| --------------------------- | -------------------------------- | ------- | ----------- | --------------------------------------------------------- |
| Base grip                   | physics.base_grip                | 9.0     | 5.0–15.0    | Max lateral acceleration (m/s²) — center of the feel      |
| Steer clamp speed           | physics.steer_clamp_speed        | 150     | 80–350      | Speed (km/h) where steering is fully clamped              |
| Steer min ratio             | physics.steer_min_ratio          | 0.3     | 0.1–0.8     | Fraction of steering remaining at clamp speed             |
| Lift-off rear factor        | physics.lift_off_rear_factor     | 0.7     | 0.3–0.95    | Rear grip multiplier during lift-off oversteer            |
| Lift-off min steering       | physics.lift_off_min_steering    | 0.1     | 0.01–0.5    | Minimum steering input to trigger lift-off oversteer      |
| Lift-off throttle threshold | physics.lift_off_throttle_max    | 0.05    | 0–0.3       | Max throttle to be considered "lifted"                    |
| Drag coefficient            | physics.drag_coeff               | 0.012   | 0.005–0.030 | Base drag multiplier                                      |
| Max brake force             | physics.max_brake_force          | 25      | 10–50       | Base braking deceleration (m/s²)                          |
| Pit speed limit             | physics.pit_speed_limit          | 80      | 60–120      | Max speed in pit lane (km/h)                              |
| Off-track friction          | physics.off_track_friction       | 6       | 3–10        | Drag multiplier on grass/gravel                           |
| Off-track grip factor       | physics.off_track_grip_factor    | 0.3     | 0.05–0.8    | Grip multiplier on grass/gravel (× grip_max)              |
| Off-track min speed frac    | physics.off_track_min_speed      | 0.3     | 0.1–0.5     | Minimum speed fraction (× top_speed) on grass             |
| Kerb grip loss              | physics.kerb_grip_loss           | 0.20    | 0–0.5       | Grip reduction fraction on kerbs                          |
| Speed mod reference speed   | physics.speed_mod_ref_speed      | 250     | 100–400     | Speed (km/h) where downforce grip boost reaches maximum   |
| Speed mod min factor        | physics.speed_mod_min_factor     | 0.5     | 0.1–1.0     | Grip multiplier at zero speed (ground floor of speed_mod) |
| Auto-shift RPM threshold    | physics.auto_shift_rpm_threshold | 0.95    | 0.8–1.0     | Fraction of rpm_max where auto-shift triggers             |
| RPM max                     | physics.rpm_max                  | 13000   | 8000–18000  | Engine redline RPM                                        |
| Corner stat L1              | physics.corner_stat_L1           | 0.60    | 0.3–0.7     | Cornering multiplier at viragem upgrade level 1           |
| Corner stat L5              | physics.corner_stat_L5           | 1.00    | 0.8–1.2     | Cornering multiplier at viragem upgrade level 5           |
| Grass speed fraction        | physics.grass_speed_fraction     | 0.30    | 0.1–0.5     | Minimum speed on grass as fraction of top speed           |
| Tire blowout min grip       | physics.min_grip_factor          | 0.15    | 0.05–0.5    | Grip multiplier when tire_condition = 0 (blown tire)      |

The upgrade stat–to–handling mapping is also fully defined by config entries:

| Config                              | Maps to                          | Default curve                                          |
| ----------------------------------- | -------------------------------- | ------------------------------------------------------ |
| `physics.velocidade_final_L1–L5`    | Power ceiling (top speed)        | [1.0, 1.1, 1.2, 1.3, 1.4]                              |
| `physics.aceleracao_L1–L5`          | Accel factor                     | [1.0, 1.08, 1.16, 1.22, 1.3]                           |
| `physics.viragem_L1–L5`             | Corner stat (via corner_stat_Lx) | [0.6, 0.7, 0.8, 0.9, 1.0]                              |
| `physics.consumo_combustivel_L1–L5` | Fuel efficiency                  | [1.0, 1.1, 1.2, 1.3, 1.4] (used by Fuel system)        |
| `physics.consumo_pneu_L1–L5`        | Tire durability                  | [1.0, 1.15, 1.3, 1.45, 1.6] (used by Tire Wear system) |

## Visual/Audio Requirements

Physics produces data only — no rendering, no sounds, no camera shake directly. Published telemetry:

| Consumer | Data Published                                                       |
| -------- | -------------------------------------------------------------------- |
| Camera   | speed_kmh, lateral_g, accel_g, kerb_hit, off_track                   |
| Audio    | rpm, speed_kmh, gear, tire_squeal (0-1), kerb_hit, collision_impulse |
| HUD      | speed_kmh, rpm, gear                                                 |

## UI Requirements

None. Physics has no direct UI.

## Acceptance Criteria

1. Car turns tighter at low speed than high speed (velocity-dependent steering)
2. Car understeers (pushes wide) if lateral demand exceeds grip_max
3. Lift-off oversteer: lifting throttle mid-turn causes visible extra rotation toward apex
4. 5 upgradeable stats — each maps to a measurable effect (top speed, accel, cornering, fuel efficiency, tire durability)
5. Tire condition degrades grip_max progressively; at tire_condition = 0 the car still has engine power and ~15% grip — can limp to finish if the player manages speed through corners
6. Fuel at 0 kills engine power completely; car coasts to stop — DNF only when velocity ≈ 0
7. Standing grid start: car locked at 0 km/h until lights-out; wheel and steering animate
8. Off-track applies high friction (rapid speed loss) and minimal grip
9. Off-track maintains minimum ~1/3 top speed — car can always rejoin
10. Kerbs cause brief grip reduction + send shake signal to Camera
11. Brake + throttle simultaneously: brake dominates
12. Physics runs at 1/60s fixed timestep only — no physics in render loop
13. Two identical inputs + same seed produce identical trajectories (determinism contract)

## Open Questions

- **Off-track minimum speed**: proposed 0.3 × top_speed. Research how reference arcade racers handle grass speed limits. Adjustable via knob, default 0.3.
