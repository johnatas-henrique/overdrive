# Vehicle Physics

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-21
> **Implements Pillar**: Speed You Can Feel

## Overview

**Vehicle Physics** is the core simulation layer that translates player input (throttle, brake, steer) into car motion — position, velocity, rotation, and angular velocity at 60 Hz. It implements a high-grip, forgiving arcade handling model inspired by 4PGP and Horizon Chase: strong traction through most cornering, recoverable loss of grip within 1–2 seconds, skill expression through speed and efficiency rather than drift control. The system consumes tire grip multipliers from the Tire System, fuel weight from the Fuel System, and car performance data from Car Definition Data, then outputs kinematic state (position, rotation, velocity) that Camera, HUD, Audio, VFX, AI Rival, Ghost Recording, and Multiplayer Architecture all consume. Without this system, the car doesn't move — every other system in the game depends on its output.

**Interaction:** Direct — the player feels this system through every input response. Throttle application, braking force, steering sensitivity, and grip recovery are all Vehicle Physics behaviors.

**Why it exists:** Without vehicle physics, there is no game. This system IS the core loop — push speed, avoid error, recover, decide. Every design pillar ultimately flows through how the car responds to input.

## Player Fantasy

**Framing:** Direct — the player actively feels this system through every input response. Throttle application, braking force, steering sensitivity, and grip recovery are all Vehicle Physics behaviors.

**Emotional target:** Trust. Not the absence of challenge, but the presence of a machine that does what they ask. Speed arrives as a consequence of clean inputs, not a reward for surviving chaos. When they lift slightly, rotate slightly, and get back on the power, the car obeys and the lap time answers. The fantasy is restraint as power — the calm driver going faster than the frantic one.

**Anchor moment:** The player enters a corner at full speed. They lift off the throttle slightly. The car rotates just enough. They get back on the power. The car grips and shoots out of the corner. They didn't drift — they drove cleanly, and it felt incredible.

**Pillar alignment:** Speed You Can Feel — physics IS the speed. High grip means velocity is delivered as a coherent rush, not a wrestling match. Earn the Next Seat — the forgiving handling lowers the floor; the grip edge raises the ceiling. A new player can finish, a skilled player can dominate. Every Short Race Matters — permanent results demand a system the player can trust to evaluate fairly.

**Design test:** Does the player feel that lifting off the throttle is a powerful tool, not a punishment? If yes, the fantasy is landing. If they feel like they're fighting the car, the system has failed.

## Detailed Design

### Core Rules

**1. Car Properties (per car, data-driven)**

Every car has exactly 6 stats, mapped from SMGP1's 5-stat model plus one new stat for strategic depth. Stats are on a 0-20 scale. Weight is a constant (505 kg) for all cars.

| Stat | SMGP1 Equiv. | Controls | Higher = Better |
|------|-------------|----------|-----------------|
| **Top Speed** | ENG | Maximum velocity on straights | Faster top end |
| **Acceleration** | TM | Time to reach top speed | Quicker launches and exits |
| **Brake Power** | BRA | Deceleration rate | Later braking points |
| **Grip Level** | TIRE | Tire adhesion, cornering grip | More planted in corners |
| **Stability** | SUS | Bump handling, resistance to loss of control | Less likely to lose control |
| **Efficiency** | New | Base fuel consumption rate + base tire wear rate | Lower resource drain |

**Constant:** Weight = 505 kg for all cars — physics parameter, not a differentiating stat.

**SMGP1 reference (original game data):** `team_tier1_a` (original: Madonna) has ENG 20, TM 20, SUS 20, TIRE 20, BRA 16. `team_tier4_d` (original: Zeroforce) has ENG 16, TM 8, SUS 12, TIRE 12, BRA 4.

**Stat mapping to Overdrive:**
- ENG → Top Speed
- TM → Acceleration
- BRA → Brake Power
- TIRE → Grip Level
- SUS → Stability
- New → Efficiency (base consumption for fuel and tires)
- New → Stability (affects resistance to loss of control)

**2. Movement Rules**

Everything happens every physics tick (60 Hz). Each rule is independent. They stack additively.

**2.1 Throttle → Forward Speed**
- Player holds throttle: car accelerates toward Top Speed.
- Acceleration is strong and immediate. No ramp-up delay.
- Releasing throttle: car coasts. Speed decays slowly due to Drag. No engine braking.
- Throttle is analog (0-100%). Partial throttle = partial acceleration. Matters for fuel saving.

**2.2 Brake → Deceleration**
- Player holds brake: car decelerates toward zero.
- Braking is decisive. Brake never reverses the car. Speed floors at zero.
- Brake is analog. Partial brake = gentle slowing. Full brake = hard stop.

**2.3 Steer → Direction Change**
- Player steers: car rotates around its vertical axis.
- Steering is instant. No delay, no ramp-up.
- At low-to-medium speed: full response.
- At high speed (above ~70% of Top Speed): steer rate reduces ~20-30%. Prevents high-speed twitchiness.

**2.4 Grip → Track Adhesion**
- **On track:** Full grip. Car follows steer direction exactly.
- **Off track (grass, gravel, runoff):** Grip drops sharply. Car drifts slightly before responding to steering. Slippery, not uncontrollable.
- **Recovery:** Full grip restores instantly when car returns to surface. No transition delay.
- **Off-track duration:** Player can recover within 1-2 seconds.

**2.5 Wall Contact → Speed Loss + Bounce**
- Hitting a wall reduces speed instantly. Harder hit = more speed lost.
- Car bounces off at shallow angle. Does not stick, spin out, or stop.
- After bounce, car continues at reduced speed. Player regains control immediately.
- Car never stops from wall contact alone. Always keeps moving.

**2.6 Lift-Off Rotation → Skill Mechanic**
- When player releases throttle while turning, car rotates slightly into corner.
- Faster speed + more steering = more rotation assist.
- Smooth, controlled. Not a drift. Not a slide. The car pivots.
- Skilled players carry more speed through corners. Casual players can ignore it entirely.

**3. Resource Consumption**

Fuel and tires are separate resources with separate bars. The Efficiency stat sets the BASE consumption rate for both. Player behavior determines actual consumption independently.

**Fuel consumption:**
`fuel_rate = base_rate × throttle_input × efficiency_modifier × difficulty_modifier`

- Full throttle = maximum consumption
- Lift-and-coast = minimal consumption (the skill mechanic)
- Idle = negligible consumption

**Tire consumption:**
`tire_rate = base_rate (from Efficiency) × distance × aggression × surface_penalty`

- Clean driving on-track = normal wear
- Off-track = accelerated wear (surface_penalty)
- Aggressive steering = accelerated wear (aggression)
- The player who is good at fuel saving but drives aggressively will run out of tires before fuel, and vice versa

**4. Car States**

| State | Meaning |
|-------|---------|
| **Driving** | Normal operation. On track, full grip. |
| **OffTrack** | Left racing surface. Reduced grip, slippery. |
| **WallHit** | Brief state (0.2-0.5s) after wall contact. Speed penalty applied. |
| **Pitting** | In pit lane. No player input. Automated sequence. |

**5. CarState Output**

Every physics tick produces a read-only CarState snapshot consumed by all downstream systems.

| Field | Type | Description |
|-------|------|-------------|
| `position` | Vector3 | World coordinates |
| `rotation` | Quaternion | Heading (y-axis primary) |
| `speed` | float | Current forward speed |
| `throttle` | float | Current throttle input (0-1) |
| `brake` | float | Current brake input (0-1) |
| `steer` | float | Current steer input (-1 to 1) |
| `gripState` | enum | Driving / OffTrack / WallHit / Pitting |
| `lapDistance` | float | Distance along track spline |
| `lapCount` | int | Current lap number |

**6. Global Tuning Constants**

| Constant | Purpose | Affected by Difficulty |
|----------|---------|----------------------|
| Off-track grip multiplier | How slippery off-track surfaces are | Yes |
| Wall speed-loss factor | How much speed is lost on wall contact | Yes |
| Wall bounce angle | How sharply car deflects off walls | No |
| High-speed steer reduction | How much steer rate drops above 70% speed | No |
| Lift-off rotation strength | How much rotation lift-off provides | No |

**7. What This Ruleset Does NOT Include**

| Excluded | Why |
|----------|-----|
| Slip angle | Grip is a state, not a calculation |
| Centripetal force | Car turns because you steer |
| Per-wheel grip | One car, one grip state |
| Lateral/longitudinal decomposition | Speed is speed. Turn is turn |
| Force integration | Speed changes by addition/subtraction |
| Tire temperature | Not in scope |
| Suspension | Not in scope |
| Downforce | Handled by steer-rate reduction only |
| Damage model | Wall contact is a speed penalty |
| Stability assists (TCS/ABS/ESC) | Car is stable by design via grip floor |

### States and Transitions

| From | To | Trigger |
|------|----|---------|
| `Driving` | `OffTrack` | Car leaves racing surface |
| `OffTrack` | `Driving` | Car returns to racing surface |
| `Driving` | `WallHit` | Car contacts wall |
| `WallHit` | `Driving` | Cooldown expires (0.2-0.5s) |
| `Driving` | `Pitting` | Car enters pit lane |
| `Pitting` | `Driving` | Pit stop complete |
| Any | `OffTrack` | Car leaves surface |
| Any | `WallHit` | Car contacts wall |

### Interactions with Other Systems

| System | Direction | Data | Contract |
|--------|-----------|------|----------|
| **Input System** | Inbound | Throttle, brake, steer values | Per render frame → buffered → consumed per 60 Hz tick |
| **Fuel System** | Bidirectional | Throttle value → fuel consumption | Fuel reads throttle from CarState; Vehicle Physics reads fuel weight |
| **Tire System** | Bidirectional | Grip multiplier → car adhesion | Tire outputs grip modifier; Vehicle Physics applies it |
| **Camera** | Outbound | Position, rotation | Camera reads interpolated visual transform |
| **HUD** | Outbound | Speed, grip state, inputs | HUD reads CarState every frame |
| **Audio** | Outbound | Speed, throttle, grip state | Audio reads CarState for engine pitch, tire squeal |
| **AI Rival** | Outbound | Full car state | AI reads position, velocity, grip for decision-making |
| **Ghost Recording** | Outbound | Input + state per tick | Ghost records inputs; replay feeds them back through same simulation |
| **Multiplayer Architecture** | Bidirectional | Kinematic state for rollback | Position, rotation, velocity, angular velocity synced |
| **Car Definition Data** | Inbound | 6 stats per car | Vehicle Physics reads Top Speed, Acceleration, Brake Power, Grip Level, Stability, Efficiency |

## Formulas

### Fuel Consumption Rate

`fuel_rate = base_rate × throttle_input × efficiency_modifier × difficulty_modifier`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Base Rate | base_rate | float | 0.01–0.05 | From Efficiency stat (higher efficiency = lower rate) |
| Throttle Input | throttle_input | float | 0.0–1.0 | Current throttle position |
| Efficiency Modifier | efficiency_modifier | float | 0.5–0.9 | `(1 - stat × 0.025)`, stat 20 = 0.5, stat 4 = 0.9 |
| Difficulty Modifier | difficulty_modifier | float | 0.8–1.2 | Scales consumption spread by difficulty |

**Output Range:** 0.0 (coasting) to 0.075 (full throttle at Hard difficulty)
**Example:** Efficiency 15/20 → base_rate = 0.02, efficiency_modifier = 0.625. Full throttle at Normal → 0.02 × 1.0 × 0.625 × 1.0 = 0.0125 per tick. Over 375 seconds (5 laps): 0.0125 × 60 × 375 = 281 units consumed.

### Tire Wear Rate

`tire_rate = base_rate × distance × aggression × surface_penalty`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Base Rate | base_rate | float | 0.001–0.005 | From Efficiency stat |
| Distance | distance | float | meters | Distance traveled this tick |
| Aggression | aggression | float | 1.0–2.0 | Steering intensity (1.0 = calm, 2.0 = aggressive) |
| Surface Penalty | surface_penalty | float | 1.0–3.0 | On-track = 1.0, off-track = 3.0 |

**Output Range:** 0.001 (calm on-track) to 0.030 (aggressive off-track)
**Example:** Efficiency 15/20 → base_rate = 0.002. Aggressive driving off-track: 0.002 × 50m × 1.8 × 2.5 = 0.45 per tick.

### Grip Decomposition (Simplified)

`lateral_speed = lateral_speed × (1 - grip_factor)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Grip Factor | grip_factor | float | 0.0–1.0 | 0.0 = full grip (no lateral slide), 1.0 = no grip (full slide) |
| Lateral Speed | lateral_speed | float | unbounded | Component of velocity perpendicular to forward vector |

**Output Range:** Lateral speed reduced by grip factor. On-track: grip_factor ≈ 0.05 (minimal slide). Off-track: grip_factor ≈ 0.6 (significant slide).

## Edge Cases

- **If car is stopped + full brake:** Brake force clamped to 0. Car does not reverse.
- **If car is stopped + full throttle:** Normal acceleration from standstill.
- **If wall hit at 0 speed:** No impact (velocity into wall ≈ 0).
- **If multiple rapid wall bounces:** Cooldown reduces impulse by 50%. Prevents jitter.
- **If off-track + full grip input:** Surface penalty reduces grip. Floor (0.20) enforced AFTER surface penalties — `effective_grip = max(0.20, base_grip × surface_modifier)`.
- **If tire at 0%:** Grip reduced to floor (0.20). Combined with reduced brake/accel, car is controllable but significantly slower.
- **If fuel at 0%:** Car coasts. No throttle response. Brake and steer remain functional. Player must pit.
- **If fuel and tire both at 0%:** Grip at floor, no acceleration. Car coasts at current speed with minimal grip. If pit lane unreachable by coasting, car stops on track.
- **If lift-off at very low speed:** Rotation assist is minimal (proportional to speed).
- **If steer input is reversed after wall bounce:** Car responds normally. No lockout.
- **If grip floor (0.20) is reached:** Car slides but is still controllable. Floor prevents total loss of control.
- **If wall grinding (parallel scraping):** Bounce only triggers on perpendicular impacts. Parallel scraping applies small speed penalty (friction) but no bounce.
- **If lift-off spam (rapid throttle taps):** Assist activates when throttle transitions from held to released while steer active. Requires throttle held ≥0.3s before next activation.
- **If steer threshold at exactly 70% speed:** Transition band 65%-75% smoothly lerps from full to 75% steer rate. No hard cutoff snap.
- **If car-to-car collision:** Both cars lose 15-25% current speed. Both receive push impulse away from collision. No damage. Cooldown prevents repeated impulses.
- **If fuel depletion mid-corner:** Car loses acceleration but retains steering and braking. Momentum carries car through corner. May run wide.
- **If pit stop entry at high speed:** Pit lane is separate zone. Wall bounce does not apply inside pit lane. Speed clamped to pit limit automatically.
- **If frame rate drops below 60 FPS:** Physics continues at 60 Hz fixed timestep. Rendering shows fewer frames but simulation is correct. Car interpolates between ticks.
- **If input system fails (controller disconnect):** Car coasts (throttle=0, steer=0, brake=0). On reconnect, inputs resume immediately.
- **If stopped car on track:** Car can be pushed by other cars. Reduced mass for collision purposes. Does not block track permanently.

## Dependencies

| System | Direction | Type | Data Flow |
|--------|-----------|------|-----------|
| Input System | Upstream | Hard | Input → Vehicle Physics: normalized values per frame |
| Simulation Architecture | Bidirectional | Hard | Sim → Physics: FIXED_DT + tick. Physics → Sim: CarState |
| Fuel System | Bidirectional | Hard | Physics → Fuel: throttle value. Fuel → Physics: fuel weight |
| Tire System | Bidirectional | Hard | Tire → Physics: grip multiplier. Physics → Tire: speed, surface |
| Car Definition Data | Inbound | Hard | CarDef → Physics: 6 stats per car (Top Speed, Acceleration, Brake Power, Grip Level, Stability, Efficiency) |
| Camera | Downstream | Soft | Physics → Camera: interpolated position/rotation |
| HUD | Downstream | Soft | Physics → HUD: speed, grip state, inputs |
| Audio | Downstream | Soft | Physics → Audio: speed, throttle for engine pitch |
| AI Rival | Downstream | Soft | Physics → AI: full car state for decision-making |
| Ghost Recording | Bidirectional | Hard | Physics → Ghost: input + state per tick. Ghost → Physics: recorded input during replay |
| Multiplayer Architecture | Bidirectional | Hard | Physics → Network: kinematic state. Network → Physics: remote inputs + rollback |

## Tuning Knobs

| Knob | Default | Range | Too Low | Too High |
|------|---------|-------|---------|----------|
| Off-track Grip Multiplier | 0.4 | 0.2–0.6 | Uncontrollable off-track | No penalty for leaving track |
| Wall Speed-Loss Factor | 0.4 | 0.2–0.6 | Wall hits are meaningless | Wall hits are race-ending |
| Wall Bounce Angle | 30° | 15°–45° | Car sticks to wall | Car bounces erratically |
| High-Speed Steer Reduction | 25% | 15%–35% | High-speed twitchiness | High-speed unresponsive |
| Lift-Off Rotation Strength | 0.25 | 0.1–0.4 | No skill expression | Overpowered rotation |
| Drag Coefficient | 0.02 | 0.01–0.04 | No top-end resistance | Cars feel sluggish |

## Visual/Audio Requirements

Vehicle Physics has no direct visual or audio output. It provides state that other systems consume:
- **Camera** reads interpolated position/rotation for smooth movement
- **VFX** reads speed for Directional Velocity effects (streaks, blur)
- **Audio** reads speed and throttle for engine pitch, tire squeal on grip loss

No VFX, animation, or audio assets are owned by this system.

## UI Requirements

Vehicle Physics has no direct UI. The **HUD** reads CarState for:
- Speed display (speedometer)
- Grip state indicator (on-track/off-track visual cue)
- Fuel and tire bars (consumption driven by this system's output)

The HUD itself is owned by the HUD System GDD.

## Acceptance Criteria

### Car Properties
- **AC-CP1:** Given a Tier 1 car with Top Speed 20, When throttle is held at 100%, Then car reaches top speed in 3-5 seconds.
- **AC-CP2:** Given a Tier 4 car with Top Speed 16, When compared to Tier 1 at same track, Then Tier 4 top speed is ~20% lower.

### Movement
- **AC-M1:** Given player holds throttle at 100% from standstill, When 3 seconds elapse, Then car has accelerated to ≥80% of top speed.
- **AC-M2:** Given player holds brake at 100% from top speed, When 3 seconds elapse, Then car speed is reduced to ≤30% of top speed (±5% tolerance).
- **AC-M3:** Given player steers at low speed, When steer input is applied, Then car rotates within 1 physics step (16ms at 60Hz).
- **AC-M4a:** Given player steers at 70% of top speed, When steer input is applied, Then steer rate is 100% of base rate (no reduction yet).
- **AC-M4b:** Given player steers at 90% of top speed, When steer input is applied, Then steer rate is ~75% of base rate (25% reduction).

### Grip
- **AC-G1:** Given car is on-track, When steer input is applied, Then car follows steer direction with no visible slide.
- **AC-G2:** Given car goes off-track onto grass, When car crosses track boundary, Then grip is visibly reduced within 1 frame of leaving surface.
- **AC-G3:** Given car returns to track from off-track, When car crosses track boundary, Then full grip restores instantly.

### Wall Contact
- **AC-W1:** Given car hits wall at 200 km/h, When impact occurs, Then speed drops by ~40-50%.
- **AC-W2:** Given car hits wall, When bounce occurs, Then car deflects at ≤30° from wall surface and continues moving.
- **AC-W3:** Given car hits wall, When cooldown expires, Then steer input is immediately responsive (no dead zone).

### Lift-Off Rotation
- **AC-L1:** Given car is turning at 70% speed, When player releases throttle (after holding ≥0.3s), Then car rotates ~5-10 degrees into corner (verify with rotation debug display).
- **AC-L2:** Given car is at low speed (20%), When player releases throttle, Then rotation assist is <2 degrees (not visually perceptible).
- **AC-L3:** Given player taps throttle rapidly on/off while turning, When assist triggers, Then next activation requires throttle held ≥0.3s (no spam).

### Resources
- **AC-R1:** Given Efficiency stat 15/20, When player holds full throttle for 60 seconds, Then fuel consumed is between 40-60% of fuel tank capacity.
- **AC-R2:** Given Efficiency stat 15/20, When player drives with constant throttle + weaving off-track for 30 seconds, Then tire wear is ≥2× compared to straight-line on-track driving for 30 seconds at same Efficiency.
- **AC-R3:** Given fuel at 0%, When player presses throttle, Then car does not accelerate but steering and braking remain functional.
- **AC-R4:** Given tire at 0%, When car is on-track, Then effective grip is reduced to floor (0.20) and car is controllable but significantly slower.

### Car-to-Car
- **AC-CC1:** Given two cars collide at combined speed >100 km/h, When impact occurs, Then both cars lose 15-25% current speed and receive push impulse away from collision.
- **AC-CC2:** Given car is stopped on track, When another car hits it, Then stopped car is pushed aside (not immovable).

## Open Questions

- **Downforce:** Should high-speed grip reduction be modeled as implicit downforce or just steer-rate reduction? (Current: steer-rate only)
- **Weight transfer:** Should braking while turning affect grip? (Current: no — keeping it simple. Weight is constant 505 kg for all cars.)
- **Car differentiation beyond stats:** Should each team have unique throttle curves or steer response shapes, or just different numbers on the same curves?
