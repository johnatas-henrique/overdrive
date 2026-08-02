# Tire System

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Every Short Race Matters

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | One tire compound, continuous wear, grip degradation, and pit replacement. |
| MVP architecture constraints | Tire compound data is extensible without changing vehicle code. |
| Alpha | Additional compounds if approved. |
| Beta | Not designed. |
| Release | Not designed. |

### Review Boundary
Additional compounds are non-blocking unless MVP data design prevents expansion.

## Overview

**Tire System** tracks tire wear in real time during a race. It consumes distance traveled, slide events from Vehicle Physics, and surface type, applies the car's Efficiency stat from Car Definition Data, and outputs tire grip multiplier to Vehicle Physics and tire wear percentage to HUD. The system creates the second strategic layer alongside fuel — a driver who pushes hard on worn tires loses cornering grip, while a patient driver preserves tires but sacrifices lap time. Without this system, every corner feels identical from lap 1 to lap 5.

## Player Fantasy

**Framing:** Direct — the player feels tire degradation through cornering grip loss. Two experiences:

1. **The Failing Nerve (Pillar 1 — Speed You Can Feel):** You feel the grip die through the wheel before the steering goes light. The car tells you first, then the lap time confirms it. Anchor: lap 3, turn 4 — the rear twitches on a curb you took flat-out on lap 1. You back off and remember the exact corner it gave up.

2. **The Burned Trade (Pillar 4 — Rivals Make the Grid Personal):** Spending tire life as a weapon — diving inside a rival at full throttle, knowing you'll pay on the last lap. Anchor: lap 2, turn 1 — your tires scream, you've spent grip for 0.3s and the position. The receipt comes on lap 5.

**Pillar alignment:** Speed You Can Feel — grip loss must be felt through input, camera, and audio, not just read on a meter. Rivals Make the Grid Personal — aggressive driving against a rival has visible consequences later.

**Design test:** Does the player feel grip loss through input/camera/audio, not just a meter? Can aggressive driving against a rival have visible consequences later?

## Detailed Design

### Core Rules

**1. Tire Wear Model**

Tire wear is **continuous and linear**. Every physics tick, wear accumulates based on distance, driving behavior, and surface. No breakpoints, no discrete states — grip degrades smoothly from 100% to 0%.

**2. Wear Drivers**

Wear accumulates from three factors:

- **Distance:** Base wear from rolling. Every meter traveled costs wear. This is the primary driver.
- **Aggression:** Triggered by Vehicle Physics slide state. When the car is drifting/sliding (lateral force exceeds grip), the aggression multiplier activates. Multiplier: 1.0 (no slide) to 2.0 (active slide). Full throttle on straights = no aggression. Full throttle into a corner that causes a slide = high aggression. The Tire System does NOT calculate when slides happen — it reads the slide state from the prior tick's CarState in `TickStartSnapshot` at Tick Step 5 (before the current tick's physics).
- **Surface:** Off-track surfaces (grass, gravel, runoff) accelerate wear significantly. On-track asphalt = 1.0, kerb = 1.2, and off-track surfaces = 2.5 according to the Track System surface table. Surface type is read from `CarState.surface` in `TickStartSnapshot` at Tick Step 5 (before the current tick's physics).

**3. Grip Degradation**

Grip loss is **linear** with wear. The formula:

`tire_runtime_grip_multiplier = grip_base × (1.0 - (wear_fraction × (1.0 - grip_floor)))`

Where:
- `wear_fraction`: 0.0 (new) to 1.0 (completely worn)
- `grip_base`: 1.0 for the fixed MVP compound; supplied by the TireCompound asset for future compounds
- `grip_floor`: 0.20 (minimum grip when fully worn — car is still drivable but terrible)
- At 0% wear: tire_runtime_grip_multiplier = 1.0 (full grip)
- At 50% wear: tire_runtime_grip_multiplier = 0.60 (noticeable loss)
- At 100% wear: tire_runtime_grip_multiplier = 0.20 (floor — very slippery)

**4. Tire States (Continuous)**

| Wear Range | Grip Multiplier | Player Feel |
|-----------|----------------|-------------|
| 0%–25% | 1.00–0.80 | Fresh. Full grip. No perceptible difference. |
| 25%–50% | 0.80–0.60 | Worn. Grip loss begins. Cornering feels softer. |
| 50%–75% | 0.60–0.40 | Critical. Significant grip loss. Corners require care. |
| 75%–100% | 0.40–0.20 | Bald. Very slippery. Player must slow down or spin. |

**5. Tire Compound (Fixed for MVP)**

One compound for all cars. Stored as ScriptableObject `TireCompound`:
- `compoundName`: string
- `gripBase`: float (1.0) — how much grip the tire provides when new
- `wearRateMultiplier`: float (1.0) — how fast the tire wears; consumed as a multiplier in the tire_wear_rate formula

Future expansion: add soft/hard compounds by creating new assets. No code changes needed.

**6. Pit Stop — Tire Change**

- Tire change is **binary**: old tires removed, new tires installed after 2s minimum service.
- Fuel refills at 0.8 L/s in parallel. Player may exit after tires complete with partial fuel; AI waits full in MVP.
- Tire always resets to 0% wear (fresh tires) on pit stop.

**Authority note:** Tire System owns `tire_swap_time`; Pit Stop consumes it during service.

**7. Fuel and Tire Independence**

Fuel and tire are separate resources with separate bars. They share the Efficiency stat (higher Efficiency = slower wear for both), but the player's behavior determines actual consumption independently:
- A player who lifts off throttle saves fuel BUT still wears tires from distance.
- A player who drives smoothly preserves tires BUT still burns fuel from throttle.
- The player who is good at fuel saving but drives aggressively will run out of tires before fuel, and vice versa.

**8. Display**

- HUD tire bar: horizontal bar, 0-100%, color-coded (green > 50%, yellow 25-50%, red < 25%).
- Numeric readout: "X%" below the bar.
- Tire wear is visible through grip loss (cornering feel), not just the bar.

**Countdown:** Tire wear does not accumulate while SimulationState is Countdown. Race wear begins on the first Racing tick after GO.

### States and Transitions

This system is continuous — no discrete states. Wear progresses smoothly from 0% to 100%. The grip multiplier decreases linearly. No state transitions exist; the system is always in a single continuous state.

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Vehicle Physics** | Outbound | `tire_runtime_grip_multiplier` (0.20–1.0) | Applied to lateral friction |
| **Vehicle Physics** | Inbound | `surface` from `CarState` in `TickStartSnapshot` at Step 5 | Track surface type for wear calculation (Asphalt/Kerb/Gravel/Grass/Runoff) |
| **Car Definition Data** | Inbound | Efficiency stat | Modifies wear rate |
| **Fuel** | Parallel | Shares Efficiency stat | Independent resources, same stat |
| **HUD** | Outbound | Wear percent (0–100%) and grip_multiplier | Displayed as bar + color; grip_multiplier available via PublishedSimulationSnapshot |
| **Pit Stop** | Bidirectional | Pit trigger → tire swap | Tire resets to 0% wear at 2s service completion. |
| **AI Rival** | Bidirectional | Tire wear and last-lap wear delta → AI reads for pit projection; AI pit decision → Tire receives pit event | AI evaluates after lap 1 for next-lap forecast +10%. |
| **Ghost Recording** | Indirect | Tire state derived from replay (not recorded per tick); initial tire state captured in ReplayInitialState | Ghost replay recalculates tire wear from input using same formula |

At each `LapCompleted`, Tire snapshots `last_lap_tire_wear = wear_at_current_lap_boundary - wear_at_previous_lap_boundary`, then resets its per-lap accumulator. Pit Stop and AI consume this Tire-owned value; Race Session Manager does not calculate Tire wear.

## Formulas

**Current live values:** see `Assets/Data/Cars/TireConfig.asset` (ScriptableObject).

### Tire Wear Rate

The **tire_wear_rate** formula is defined as:

`tire_wear_rate = base_rate × distance_factor × aggression × surface_penalty × efficiency_modifier × wearRateMultiplier`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| base_rate | — | float | calibrated | Base wear per second |
| distance_factor | — | float | 0.0–1.0 | `clamp(speed_kmh / reference_speed_kmh, 0, 1)` |
| aggression | — | float | 1.0–2.0 | 1.0 = no slide, 2.0 = active slide (from Vehicle Physics) |
| surface_penalty | — | float | 1.0–2.5 | Asphalt = 1.0, kerb = 1.2, off-track surfaces = 2.5 |
| efficiency_modifier | — | float | 0.5–0.9 | `(1 - stat × 0.025)`, same as fuel |
| wearRateMultiplier | — | float | 1.0 (MVP) | Compound wear rate multiplier from TireCompound asset. 1.0 for fixed MVP compound; varies for future soft/hard compounds |
| reference_speed_kmh | — | float | 300 km/h | Speed at which `distance_factor = 1.0` |

### Grip Degradation

The **tire_runtime_grip_multiplier** formula is defined as:

`tire_runtime_grip_multiplier = grip_base × (1.0 - (wear_fraction × (1.0 - grip_floor)))`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| wear_fraction | — | float | 0.0–1.0 | Current tire wear (0 = new, 1 = bald) |
| grip_base | — | float | 1.0 for MVP | New-tire grip supplied by TireCompound |
| grip_floor | — | float | 0.20 | Minimum grip when fully worn. Must be ≥ 0.20 (Vehicle Physics effective_grip floor); values below 0.20 are silently overridden by Vehicle Physics clamp. |

**Output Range:** 0.20–1.0 for the fixed MVP compound. At 0% wear: 1.0 (full grip). At 50% wear: 0.60. At 100% wear: 0.20.

## Edge Cases

- **If tire reaches 100% wear mid-corner:** Grip multiplier = 0.20. Car is very slippery but still controllable. Player must slow down significantly.
- **If player pits with tires > 50%:** Pit stop still swaps tires to new. Player wastes tire life but gains no strategic advantage. Should be rare.
- **If player skips pit entirely:** Tires degrade to 0.20 grip floor. Car is drivable but very slow in corners. May lose multiple positions.
- **If Efficiency stat is corrupted:** Clamp to nearest valid (4-20). Log warning.
- **If car is in slide state for entire race:** Tires wear roughly twice as fast. Player needs pit stop or accepts very low grip on final laps.
- **If surface_penalty is at maximum (2.5) for extended time (off-track):** Tires wear 2.5 times as fast. Staying off-track is heavily punished.
- **If all tires are at 0% wear (new):** Grip multiplier = 1.0. Maximum cornering performance. This is the starting state.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Vehicle Physics** | Outbound | `tire_runtime_grip_multiplier` | Hard — grip affects cornering |
| **Simulation Architecture** | Indirect via Simulation | Hard | Assembles `ResolvedCarInput[carId]` at Tick Step 2; Tire consumes `surface`, `speed`, and `slideState` from `TickStartSnapshot` at Step 5 |
| **Car Definition Data** | Inbound | Efficiency stat | Hard — determines wear rate |
| **HUD** | Outbound | Wear percent | Hard — player needs to see tire state |
| **Pit Stop** | Bidirectional | Pit trigger ↔ tire swap | Hard — pit stops are the recovery mechanism |
| **AI Rival** | Bidirectional | Tire wear (AI) | Hard — AI tire management |
| **Ghost Recording** | Indirect | Tire state derived from replay (not recorded per tick) | Soft — ghost replay shows tire state |
| **Audio** | Outbound | wear_percent, grip_multiplier | Hard — drives tire squeal |
| **Track** | Inbound | Surface wear modifier | Hard — affects tire wear |
| **VFX** | Outbound | Wear % | Soft — drives smoke intensity |
| **Qualifying** | Inbound | Qualifying mode (no wear) | Hard — 100% grip, no wear during qualifying |
| **Race Session Manager** | Inbound | LapCompleted, PitEntry, PitExit | Hard — tire wears per lap |

## Tuning Knobs

All values below are serialized fields in `TireConfig.asset` (ScriptableObject).

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Base wear rate | playtesting | 0.001–0.01 | Tires never wear | Tires last 1 lap |
| Aggression multiplier | 1.0–2.0 | 1.0–3.0 | No difference between driving styles | Aggressive driving instantly kills tires |
| Surface penalty (off-track) | 2.5 | 1.5–3.0 | Off-track has no penalty | Off-track instantly kills tires |
| Grip floor | 0.20 | 0.20–0.30 (≥ 0.20 — VP effective_grip floor; below is silently overridden) | Car undrivable at 0% | Car too grippy even at 0% |
| Efficiency modifier spread | 0.5–0.9 | 0.3–1.0 | All cars wear same | Worst car unplayable |
| Tire swap time | 2 s | 1–4 s | Instant (no spectacle) | Too slow |

## Visual/Audio Requirements

- **Tire wear visual:** As tires wear, subtle visual cues — slightly different tire shader (less shiny), minor particle effects on curbs. Not dramatic; the player should feel it through input, not see it on the model.
- **VFX consumption:** VFX System (vfx.md) consumes tire wear/grip data for smoke particle emissions at Step 10, prior to Render.
- **Audio cue:** Tire squeal becomes more frequent as wear increases while pitch remains constant at the Audio System's 1200 Hz value. At 75%+ wear, squealing is constant in corners.
- **Grip loss feel:** Steering becomes lighter. Camera shake increases slightly in corners. Vehicle Physics handles this via grip_multiplier; haptics/force feedback are out of MVP scope.

## UI Requirements

- **Race HUD:** Tire wear bar (see above). Always visible during race.
- **Post-race:** Optional tire remaining display.

> **📌 UX Flag — Tire System**: This system has UI requirements. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for the tire display before writing epics.

## Acceptance Criteria

- **GIVEN** a car with tire wear at 0%, **WHEN** cornering at speed, **THEN** grip multiplier is 1.0 (full grip).
- **GIVEN** a car with tire wear at 50%, **WHEN** cornering at speed, **THEN** grip multiplier is 0.60 ± 0.01.
- **GIVEN** a car with tire wear at 100%, **WHEN** cornering at speed, **THEN** grip multiplier is 0.20 ± 0.01 (floor).
- **GIVEN** a car driving off-track (surface_penalty = 2.5), **WHEN** tire wear is calculated, **THEN** wear rate is approximately 2.5× the on-track rate.
- **GIVEN** a car driving aggressively (aggression = 2.0), **WHEN** tire wear is calculated, **THEN** wear rate is approximately 2× the smooth driving rate.
- **GIVEN** a pit stop reaches 2.0s service, **WHEN** tire swap completes, **THEN** tire wear is 0% (fresh) regardless of the remaining fuel-fill duration.
- **GIVEN** Countdown runs for 300 ticks, **WHEN** tire wear is observed before GO, **THEN** wear equals its Countdown-entry value.
- **GIVEN** a car with Efficiency 20, **WHEN** tire wear is calculated, **THEN** wear rate is approximately 50% of the base rate (most efficient).
- **GIVEN** a car with Efficiency 4, **WHEN** tire wear is calculated, **THEN** wear rate is approximately 90% of the base rate (least efficient).
- **GIVEN** any difficulty, **WHEN** tire wear is calculated for the same car and driving sequence, **THEN** the wear rate is identical; difficulty does not modify Tire rules.
- **GIVEN** a car with 100% tire wear, **WHEN** the player attempts to corner at racing speed, **THEN** the car slides significantly but remains controllable (grip floor = 0.20).

## Open Questions

- **Tire wear feedback timing:** MVP uses the existing continuous HUD thresholds and grip/audio feedback; no additional 50% event is required.
- **Pit stop decision:** Resolved for MVP: physical pit-zone entry is automatic; service is owned by Pit Stop; Confirm permits player exit after 2s.
- **AI tire management:** AI tire wear remains hidden; only the player's tire state is displayed.
- **Tire wear in qualifying:** Resolved by Qualifying: no tire wear during the flying lap; tires remain at 100% grip.
- **Multiple compounds in future:** When soft/hard compounds are added, should the pre-race screen show compound choice? Or is it automatic based on race strategy?
