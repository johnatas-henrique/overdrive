# Vehicle Physics

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Speed You Can Feel

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Local arcade vehicle handling, car stats, fuel/tire interfaces, collisions, and GridLocked behavior. |
| MVP architecture constraints | Car state and input interfaces remain explicit and data-driven. |
| Alpha | Not designed. |
| Beta | Not designed. |
| Release | Not designed. |

### Review Boundary
All current rules are MVP unless explicitly deferred; future network behavior is non-blocking.

## Overview

**Vehicle Physics** is the core simulation layer that translates player input (throttle, brake, steer) into car motion — position, velocity, rotation, and angular velocity at 60 Hz. It implements a high-grip, forgiving arcade handling model inspired by 4PGP and Horizon Chase: strong traction through most cornering, recoverable loss of grip within 1–2 seconds, skill expression through speed and efficiency rather than drift control. The system consumes the runtime grip multiplier from Tire System, Fuel state and its low-fuel max-speed modifier from Fuel System, and car performance data from Car Definition Data; fuel weight is never simulated because vehicle mass is the constant 505 kg. It outputs kinematic state for Camera, HUD, Audio, VFX, AI Rival, and future Alpha/Beta consumers. Without this system, the car doesn't move — every other system in the game depends on its output.

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
| **Efficiency** | New | Dimensionless Fuel/Tire efficiency modifier | Lower resource drain |

**Constant:** Weight = 505 kg for all cars — physics parameter, not a differentiating stat.

**SMGP1 reference (original game data):** `team_tier1_a` (original: Madonna) has ENG 20, TM 20, SUS 20, TIRE 20, BRA 16. `team_tier4_d` (original: Zeroforce) has ENG 16, TM 8, SUS 12, TIRE 12, BRA 4.

**Stat mapping to Overdrive:**
- ENG → Top Speed
- TM → Acceleration
- BRA → Brake Power
- TIRE → Grip Level
- SUS → Stability
- New → Efficiency (dimensionless Fuel/Tire efficiency modifier)

**2. Movement Rules**

Everything happens every physics tick (60 Hz). Each rule is evaluated by its owning subsystem. Grip modifiers stack multiplicatively and are clamped by the approved grip floor and ceiling; input, resource, collision, and presentation outputs follow their explicit contracts rather than a global additive rule.

**2.1 Throttle → Forward Speed**
- Player holds throttle: car accelerates toward Top Speed.
- Acceleration is strong and immediate. No ramp-up delay.
- Releasing throttle: car coasts. Speed decays slowly due to Drag. No engine braking.
- Throttle is analog (0-100%). Partial throttle = partial acceleration. Matters for fuel saving.
- During GridLocked, throttle is consumed for Perfect Start evaluation but produces no longitudinal movement until GO.
- `longitudinalDriveForceFinal` is the final longitudinal force after normal car-stat, tire-grip, and fuel-state modifiers, immediately before Vehicle Physics applies longitudinal acceleration.
- Grid & Start may apply `perfectStartDriveForceMultiplier = 1.15` to `longitudinalDriveForceFinal` for 600 ticks after GO. No other system may write that multiplier.

**2.2 Brake → Deceleration**
- Player holds brake: car decelerates toward zero.
- Braking is decisive. Brake never reverses the car. Speed floors at zero.
- Brake is analog. Partial brake = gentle slowing. Full brake = hard stop.

**2.3 Steer → Direction Change**
- Player steers: car rotates around its vertical axis.
- Steering is instant at the physics boundary: on each 60 Hz tick, Vehicle Physics applies the received `SimulationInput.steerOut` without an additional input ramp or smoothing layer.
- At low-to-medium speed: full response.
- At high speed (above ~70% of Top Speed): steer rate reduces ~20-30%. Prevents high-speed twitchiness.
- During GridLocked, steer updates the wheel/visual steering state while each car remains at its assigned grid transform and its race movement remains locked.
- Grid lock is applied before each whole-scene simulation tick by freezing each car's translational and rotational race movement at its assigned grid transform while retaining engine/wheel visual state. Every racing Rigidbody uses `Rigidbody.interpolation = None`; Simulation Architecture owns manual LateUpdate interpolation.

**2.4 Grip → Track Adhesion**
- **On track:** The surface contribution is full, while Grip Level, Stability, Tire wear, and other approved modifiers still apply. The car follows steer direction with high, readable grip.
- **Off track (grass, gravel, runoff):** Grip drops sharply. Car drifts slightly before responding to steering. Slippery, not uncontrollable.
- **Recovery:** The surface contribution restores instantly when car returns to surface. Tire wear and other persistent modifiers remain active; no surface transition delay is added.
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

Fuel and tires are separate resources with separate bars. Car Definition Data supplies the dimensionless `efficiency_modifier`; Fuel and Tire own their operational rates and formulas. Player behavior determines actual consumption independently.

**Fuel consumption:** Fuel System owns the formula. Vehicle Physics supplies the current throttle input and consumes Fuel's returned state and low-fuel max-speed modifier.

- Full throttle = maximum consumption
- Lift-and-coast = minimal consumption (the skill mechanic)
- Idle = negligible consumption

**Tire consumption:** Tire System owns the formula. Vehicle Physics supplies distance, slip/aggression, and surface inputs and consumes Tire's runtime grip multiplier.

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
| **Pitting** | In pit lane. Driving input is blocked; Pit Stop owns service and receives Confirm for the permitted manual exit. |
| **GridLocked** | Countdown state. Driving controls are consumed, but the assigned grid transform and race movement remain locked until GO. |

**5. CarState Output**

Every physics tick produces a read-only CarState snapshot consumed by all downstream systems.

| Field | Type | Description |
|-------|------|-------------|
| `position` | float3 | World coordinates |
| `rotation` | quaternion | Heading (y-axis primary) |
| `speed` | float | Current forward speed in km/h |
| `throttle` | float | Current throttle input (0-1) |
| `brake` | float | Current brake input (0-1) |
| `steer` | float | Current applied steer output (-1 to 1) |
| `gripState` | enum | Driving / OffTrack / WallHit / Pitting |
| `forwardDot` | float | Dot product of car forward and track tangent for RSM direction validation |
| `isGridLocked` | bool | True during Countdown until GO releases the lock |
| `rpm` | float | Engine revolutions per minute for audio |
| `gear` | int | Current selected gear for audio and HUD |
| `wallContact` | bool | True for the tick containing a wall impact |
| `slideState` | float | Normalized lateral-slip presentation value for audio/VFX |
| `surface` | `Asphalt` / `Kerb` / `Gravel` / `Grass` / `Runoff` | Current track surface type from Track System; available in TickStartSnapshot for Tire System consumption at Step 5 |
| `pitPhase` | `None` / `PitTransit` / `InPitBox` / `Exiting` | Pit Stop owns and publishes it; Vehicle Physics includes the read-only value in CarState for Input and HUD consumers. |

**6. Global Tuning Constants**

| Constant | Purpose | Affected by Difficulty |
|----------|---------|----------------------|
| Player off-track grip multiplier | How forgiving off-track surfaces are for the player | Yes — DifficultyProfile player recovery field |
| Player wall speed-loss factor | How much player speed is lost on wall contact | Yes — DifficultyProfile player recovery field |
| Wall bounce angle | How sharply car deflects off walls | No |
| High-speed steer reduction | How much steer rate drops above 70% speed | No |
| Lift-off rotation strength | How much rotation lift-off provides | No |

Simulation snapshots the selected DifficultyProfile at race initialization. The player uses its `player_offtrack_grip` and `player_wall_speed_loss` fields. AI cars always use the Normal physics baseline `0.40 / 0.40`; AI difficulty is expressed through AI competence, never hidden physics-stat changes. Car Definition values and formulas remain immutable across difficulty levels.

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
| `Driving` | `Pitting` | Final transform after `Physics.Simulate()` crosses Track pit-entry zone; transition begins on next tick |
| `Pitting` | `Driving` | `PitPhase` reaches `Exiting` completion and `PitExit` is crossed |
| Any | `OffTrack` | Car leaves surface |
| Any | `WallHit` | Car contacts wall |

### Interactions with Other Systems

| System | Direction | Data | Contract |
|--------|-----------|------|----------|
| **Simulation Architecture** | Inbound | `SimulationInput.accelerateOut`, `brakeOut`, `steerOut` | Per 60 Hz tick. Input System has already applied dead zones and EMA at Simulation Architecture's tick boundary. |
| **Settings** | Inbound via Simulation | Immutable DifficultyProfile | Supplies player-only off-track grip and wall-loss fields; AI remains on Normal physics baseline |
| **Fuel System** | Bidirectional | Throttle-derived consumption input → Fuel; fuel state/max-speed modifier ← | Fuel owns rate and efficiency formula; difficulty does not modify fuel rules, and Vehicle Physics does not use fuel weight. |
| **Tire System** | Bidirectional | Distance, slip, surface → Tire; runtime grip multiplier ← | Tire owns wear and efficiency formula; difficulty does not modify tire rules, and Vehicle Physics applies the grip multiplier. |
| **Camera** | Outbound | Position, rotation | Camera reads interpolated visual transform |
| **HUD** | Outbound | Speed, grip state, inputs | HUD reads CarState every frame |
| **Audio** | Outbound | Speed, throttle, grip state | Audio reads CarState for engine pitch, tire squeal |
| **AI Rival** | Outbound | Full car state | AI reads position, velocity, grip for decision-making |
| **Ghost Recording** | Indirect via Simulation | SimulationInput per tick | Simulation records the authoritative input; replay feeds it back through the same simulation |
| **Multiplayer Architecture** | Deferred / Beta | Kinematic state for rollback | Future Beta only; MVP Vehicle Physics has no network runtime dependency. |
| **Car Definition Data** | Inbound | 6 stats per car | Vehicle Physics reads Top Speed, Acceleration, Brake Power, Grip Level, Stability, Efficiency |
| **Grid & Start** | Bidirectional | Grid lock and Perfect Start force multiplier | Grid & Start supplies the assigned grid lock and may write `perfectStartDriveForceMultiplier` only during the approved post-GO window |
| **Track System** | Inbound | Surface, racing boundary, tangent, pit-entry zone | Track supplies surface classification, track tangent, and pit-entry detection inputs |
| **Pit Stop** | Bidirectional | `PitPhase`, pit speed limit, exit state | Pit Stop owns service and phase transitions; Vehicle Physics blocks driving input and applies the pit speed limit |

## Formulas

### Fuel Consumption

Fuel System owns `fuel_rate = 0.05 L/s × throttle_input × efficiency_modifier` and all unit calculations. Vehicle Physics supplies consumed throttle and reads Fuel state plus the low-fuel max-speed modifier; it does not define a second fuel formula. Difficulty does not modify Fuel rules in MVP.

### Tire Wear

Tire System owns `tire_wear_rate = base_rate × distance_factor × aggression × surface_penalty × efficiency_modifier`. Vehicle Physics supplies speed/distance, slip/aggression and surface inputs; Tire System returns runtime grip multiplier. Vehicle Physics does not define a second wear formula. Difficulty does not modify Tire rules in MVP.

### Grip Decomposition

`effective_grip = clamp(grip_base × surface_grip_multiplier × tire_runtime_grip_multiplier × control_threshold, 0.20, 1.20)`

Vehicle Physics owns this multiplicative stack. Tire System supplies `tire_runtime_grip_multiplier`; Car Definition Data supplies `grip_base` and `control_threshold`; Track supplies the surface multiplier. The 0.20 floor preserves controllability and the 1.20 ceiling prevents stacked modifiers from creating unbounded grip.

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Grip Base | grip_base | float | project-defined | Car Definition Data's Grip Level output (different from Tire System's `grip_base` which is tire compound grip) |
| Surface Grip Multiplier | surface_grip_multiplier | float | 0.25–1.20 | Track surface contribution; player off-track value may come from DifficultyProfile |
| Tire Runtime Grip Multiplier | tire_runtime_grip_multiplier | float | 0.20–1.0 | Tire System's continuous wear output |
| Control Threshold | control_threshold | float | 0.20–1.0 | Stability contribution from Car Definition Data |

**Output Range:** `effective_grip` is clamped to 0.20–1.20. The resulting grip value drives the simplified lateral response; no separate additive grip stack is permitted.

For the player while off-track, `surface_grip_multiplier` is selected from the active DifficultyProfile: Very Easy 0.60, Easy 0.50, Normal 0.40, Hard 0.30, Very Hard 0.25. AI uses 0.40. On wall contact, player retained speed is `speed_after = speed_before × (1 - player_wall_speed_loss)` with losses 0.20/0.30/0.40/0.50/0.60 by profile; AI uses 0.40.

## Edge Cases

- **If car is stopped + full brake:** Brake force clamped to 0. Car does not reverse.
- **If car is stopped + full throttle:** Normal acceleration from standstill.
- **If wall hit at 0 speed:** No impact (velocity into wall ≈ 0).
- **If multiple rapid wall bounces:** Cooldown reduces impulse by 50%. Prevents jitter.
- **If off-track + full grip input:** The surface multiplier reduces the multiplicative stack. The 0.20 floor and 1.20 ceiling are enforced after all grip modifiers — `effective_grip = clamp(grip_base × surface_grip_multiplier × tire_runtime_grip_multiplier × control_threshold, 0.20, 1.20)`.
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
- **If a device disconnects but another valid scheme remains:** The next tick uses the fallback scheme with no Vehicle Physics special case.
- **If no input scheme remains:** SimulationInput is zeroed; the car coasts until a scheme returns.
- **If stopped car on track:** Car can be pushed by other cars through the normal collision impulse. Mass remains the constant 505 kg; no reduced-mass exception exists. The car does not block the track permanently.

## Dependencies

| System | Direction | Type | Data Flow |
|--------|-----------|------|-----------|
| Input System | Indirect via Simulation | Hard | Input System produces SimulationInput at the fixed tick boundary; Simulation Architecture forwards it to Vehicle Physics once per 60 Hz tick |
| Simulation Architecture | Bidirectional | Hard | Sim → Physics: FIXED_DT + tick. Physics → Sim: CarState |
| Settings | Inbound via Simulation | Hard | Immutable DifficultyProfile → player-only recovery fields; never mutates car stats or AI physics |
| Fuel System | Bidirectional | Hard | Fuel reads `accelerateOut` from `ResolvedCarInput[carId]` at Tick Step 5 (before physics). Fuel → Physics: fuel state and low-fuel max-speed modifier; vehicle mass remains constant |
| Tire System | Bidirectional | Hard | Tire → Physics: grip multiplier. Tire reads speed, surface, and slide state from prior CarState in `TickStartSnapshot` at Tick Step 5 (before physics) |
| Car Definition Data | Inbound | Hard | CarDef → Physics: 6 stats per car (Top Speed, Acceleration, Brake Power, Grip Level, Stability, Efficiency) |
| Camera | Downstream | Soft | Physics → Camera: raw position/rotation (interpolation performed by Simulation Architecture) |
| HUD | Downstream | Soft | Physics → HUD: speed, grip state, inputs |
| Audio | Downstream | Soft | Physics → Audio: speed, throttle for engine pitch |
| VFX | Downstream | Soft | Physics → VFX: speed, wallContact, slideState for directional velocity effects |
| AI Rival | Downstream | Soft | Physics → AI: full car state for decision-making |
| Ghost Recording | Indirect via Simulation | Hard | Simulation → Ghost: SimulationInput per tick. Replay input re-enters through Simulation Architecture. |
| Multiplayer Architecture | Deferred / Beta | Architecture constraint only | Future Beta may provide kinematic state and remote inputs after a separate network architecture decision; MVP has no network dependency. |
| Grid & Start | Bidirectional | Hard | Grid & Start → Physics: grid lock and Perfect Start multiplier; Physics → Grid & Start: GO-boundary CarState |
| Track System | Inbound | Hard | Track → Physics: surface, tangent, racing boundary, pit-entry zone |
| Pit Stop | Bidirectional | Hard | Pit Stop → Physics: `PitPhase` and pit speed limit; Physics → Pit Stop: CarState and pit-entry/exit events |

## Tuning Knobs

| Knob | Default | Range | Too Low | Too High |
|------|---------|-------|---------|----------|
| Player off-track grip by profile | 0.60/0.50/0.40/0.30/0.25 | 0.2–0.6 | Uncontrollable off-track | No penalty for leaving track |
| Player wall speed-loss by profile | 0.20/0.30/0.40/0.50/0.60 | 0.2–0.6 | Wall hits are meaningless | Wall hits are race-ending |
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
- **AC-CP2:** Given Tier 1 Top Speed 20 resolves to 310 km/h and Tier 4 Top Speed 16 resolves to 298 km/h, When compared on the same track, Then Tier 4 top speed is approximately 3.9% lower.

### Movement
- **AC-M1:** Given player holds throttle at 100% from standstill, When 3 seconds elapse, Then car has accelerated to ≥80% of top speed.
- **AC-M2:** Given player holds brake at 100% from top speed, When 3 seconds elapse, Then car speed is reduced to ≤30% of top speed (±5% tolerance).
- **AC-M3:** Given player steers at low speed, When steer input is applied, Then car rotates within 1 physics step (`FIXED_DT` ≈ 16.667ms at 60Hz).
- **AC-M4a:** Given player steers at 70% of top speed, When steer input is applied, Then steer rate is 100% of base rate (no reduction yet).
- **AC-M4b:** Given player steers at 90% of top speed, When steer input is applied, Then steer rate is ~75% of base rate (25% reduction).

### Grip
- **AC-G1:** Given car is on-track with unworn tires, When steer input is applied, Then car follows steer direction with high grip and no visually distracting slide.
- **AC-G2:** Given car goes off-track onto grass, When car crosses track boundary, Then grip is visibly reduced within 1 frame of leaving surface.
- **AC-G3:** Given car returns to track from off-track, When car crosses track boundary, Then the surface contribution restores instantly while Tire wear and persistent car modifiers remain unchanged.

### Wall Contact
- **AC-W1:** Given a player or AI car uses the Normal 0.40 wall-loss baseline and hits a wall at 200 km/h, When impact occurs, Then speed drops by approximately 40% before any separate bounce impulse.
- **AC-W2:** Given car hits wall, When bounce occurs, Then car deflects at ≤30° from wall surface and continues moving.
- **AC-W3:** Given car hits wall, When cooldown expires, Then steer input is immediately responsive (no dead zone).
- **AC-W4:** Given the player hits a wall at 100 km/h, When Very Hard wall loss 0.60 is applied, Then retained speed is 40 km/h; under Normal loss 0.40 it is 60 km/h.

### Lift-Off Rotation
- **AC-L1:** Given car is turning at 70% speed, When player releases throttle (after holding ≥0.3s), Then car rotates ~5-10 degrees into corner (verify with rotation debug display).
- **AC-L2:** Given car is at low speed (20%), When player releases throttle, Then rotation assist is <2 degrees (not visually perceptible).
- **AC-L3:** Given player taps throttle rapidly on/off while turning, When assist triggers, Then next activation requires throttle held ≥0.3s (no spam).

### Resources
- **AC-R1:** Given Efficiency stat 16/20, When player holds full throttle for 60 seconds, Then Fuel reports approximately 1.8L consumed, equal to about 22.5% of the fixed 8.0L tank (±0.1L), independent of DifficultyProfile.
- **AC-R2:** Given Efficiency stat 15/20, When player drives with constant throttle + weaving off-track for 30 seconds, Then tire wear is ≥2× compared to straight-line on-track driving for 30 seconds at same Efficiency.
- **AC-R3:** Given fuel at 0%, When player presses throttle, Then car does not accelerate but steering and braking remain functional.
- **AC-R4:** Given tire at 0%, When car is on-track, Then effective grip is reduced to floor (0.20) and car is controllable but significantly slower.
- **AC-R5:** Given the player is off-track under Very Easy, When effective grip is resolved, Then the player surface multiplier is 0.60 while an AI car on the same surface uses 0.40.
- **AC-R6:** Given Difficulty changes between races, When CarDefinition data is compared, Then all six racing stats, mass, and derived formulas remain unchanged.

### Car-to-Car
- **AC-CC1:** Given two cars collide at combined speed >100 km/h, When impact occurs, Then both cars lose 15-25% current speed and receive push impulse away from collision.
- **AC-CC2:** Given car is stopped on track, When another car hits it, Then stopped car is pushed aside (not immovable).

## Open Questions

- **Downforce:** Should high-speed grip reduction be modeled as implicit downforce or just steer-rate reduction? (Current: steer-rate only)
- **Weight transfer:** Should braking while turning affect grip? (Current: no — keeping it simple. Weight is constant 505 kg for all cars.)
- **Car differentiation beyond stats:** Should each team have unique throttle curves or steer response shapes, or just different numbers on the same curves?
