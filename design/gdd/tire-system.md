# Tire System

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-21
> **Implements Pillar**: Every Short Race Matters

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
- **Aggression:** Triggered by Vehicle Physics slide state. When the car is drifting/sliding (lateral force exceeds grip), the aggression multiplier activates. Multiplier: 1.0 (no slide) to 2.0 (active slide). Full throttle on straights = no aggression. Full throttle into a corner that causes a slide = high aggression. The Tire System does NOT calculate when slides happen — it reads the slide state from Vehicle Physics.
- **Surface:** Off-track surfaces (grass, gravel, runoff) accelerate wear significantly. On-track (asphalt, kerb) = normal wear. Surface penalty: 1.0 (on-track) to 3.0 (off-track).

**3. Grip Degradation**

Grip loss is **linear** with wear. The formula:

`grip_multiplier = 1.0 - (wear_percent × (1.0 - grip_floor))`

Where:
- `wear_percent`: 0.0 (new) to 1.0 (completely worn)
- `grip_floor`: 0.20 (minimum grip when fully worn — car is still drivable but terrible)
- At 0% wear: grip_multiplier = 1.0 (full grip)
- At 50% wear: grip_multiplier = 0.60 (noticeable loss)
- At 100% wear: grip_multiplier = 0.20 (floor — very slippery)

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
- `wearRateMultiplier`: float (1.0) — how fast the tire wears

Future expansion: add soft/hard compounds by creating new assets. No code changes needed.

**6. Pit Stop — Tire Change**

- Pit stop duration: 8-10 seconds (shared with fuel).
- Tire change is **binary**: old tires removed, new tires installed. Instant swap within the pit window.
- Fuel fills gradually during the same pit window.
- Player can leave pit before fuel is full (tire is done, fuel is partial). Creates strategy: "leave now with half fuel, or wait for full tank?"
- Tire always resets to 100% on pit stop.

**7. Fuel and Tire Independence**

Fuel and tire are separate resources with separate bars. They share the Efficiency stat (higher Efficiency = slower wear for both), but the player's behavior determines actual consumption independently:
- A player who lifts off throttle saves fuel BUT still wears tires from distance.
- A player who drives smoothly preserves tires BUT still burns fuel from throttle.
- The player who is good at fuel saving but drives aggressively will run out of tires before fuel, and vice versa.

**8. Display**

- HUD tire bar: horizontal bar, 0-100%, color-coded (green > 50%, yellow 50-25%, red 25-1%).
- Numeric readout: "X%" below the bar.
- Tire wear is visible through grip loss (cornering feel), not just the bar.

### States and Transitions

This system is continuous — no discrete states. Wear progresses smoothly from 0% to 100%. The grip multiplier decreases linearly. No state transitions exist; the system is always in a single continuous state.

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Vehicle Physics** | Outbound | Grip multiplier (0.20–1.0) | Applied to lateral friction |
| **Car Definition Data** | Inbound | Efficiency stat | Modifies wear rate |
| **Fuel** | Parallel | Shares Efficiency stat | Independent resources, same stat |
| **HUD** | Outbound | Wear percent (0–100%) | Displayed as bar + color |
| **Pit Stop** | Bidirectional | Pit trigger → tire swap | Tire resets to 100% |
| **AI Rival** | Outbound | Tire wear (AI management) | AI manages tire based on difficulty |
| **Ghost Recording** | Outbound | Tire wear per tick | Recorded for ghost replay |

## Formulas

**Current live values:** see `Assets/Data/Cars/TireConfig.asset` (ScriptableObject).

### Tire Wear Rate

The **tire_wear_rate** formula is defined as:

`tire_wear_rate = base_rate × distance_factor × aggression × surface_penalty × efficiency_modifier × difficulty_modifier`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| base_rate | — | float | calibrated | Base wear per second |
| distance_factor | — | float | 0.0–1.0 | Proportional to speed (faster = more distance = more wear) |
| aggression | — | float | 1.0–2.0 | 1.0 = no slide, 2.0 = active slide (from Vehicle Physics) |
| surface_penalty | — | float | 1.0–3.0 | On-track = 1.0, off-track = 3.0 |
| efficiency_modifier | — | float | 0.5–0.9 | `(1 - stat × 0.025)`, same as fuel |
| difficulty_modifier | — | float | 0.7–1.5 | Scales spread with difficulty |

### Grip Degradation

The **grip_multiplier** formula is defined as:

`grip_multiplier = 1.0 - (wear_percent × (1.0 - grip_floor))`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| wear_percent | — | float | 0.0–1.0 | Current tire wear (0 = new, 1 = bald) |
| grip_floor | — | float | 0.20 | Minimum grip when fully worn |

**Output Range:** 0.20–1.0. At 0% wear: 1.0 (full grip). At 50% wear: 0.60. At 100% wear: 0.20.

## Edge Cases

- **If tire reaches 100% wear mid-corner:** Grip multiplier = 0.20. Car is very slippery but still controllable. Player must slow down significantly.
- **If player pits with tires > 50%:** Pit stop still swaps tires to new. Player wastes tire life but gains no strategic advantage. Should be rare.
- **If player skips pit entirely:** Tires degrade to 0.20 grip floor. Car is drivable but very slow in corners. May lose multiple positions.
- **If Efficiency stat is corrupted:** Clamp to nearest valid (4-20). Log warning.
- **If car is in slide state for entire race:** Tires wear roughly twice as fast. Player needs pit stop or accepts very low grip on final laps.
- **If surface_penalty is at maximum (3.0) for extended time (off-track):** Tires wear three times as fast. Staying off-track is heavily punished.
- **If all tires are at 0% wear (new):** Grip multiplier = 1.0. Maximum cornering performance. This is the starting state.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Vehicle Physics** | Outbound | Grip multiplier | Hard — grip affects cornering |
| **Car Definition Data** | Inbound | Efficiency stat | Hard — determines wear rate |
| **Settings** | Inbound | Difficulty level | Hard — scales wear spread |
| **HUD** | Outbound | Wear percent | Hard — player needs to see tire state |
| **Pit Stop** | Bidirectional | Pit trigger ↔ tire swap | Hard — pit stops are the recovery mechanism |
| **AI Rival** | Outbound | Tire wear (AI) | Soft — AI tire management |
| **Ghost Recording** | Outbound | Tire wear per tick | Soft — ghost replay shows tire state |

## Tuning Knobs

All values below are serialized fields in `TireConfig.asset` (ScriptableObject).

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Base wear rate | playtesting | 0.001–0.01 | Tires never wear | Tires last 1 lap |
| Aggression multiplier | 1.0–2.0 | 1.0–3.0 | No difference between driving styles | Aggressive driving instantly kills tires |
| Surface penalty (off-track) | 3.0 | 1.5–5.0 | Off-track has no penalty | Off-track instantly kills tires |
| Grip floor | 0.20 | 0.10–0.30 | Car undrivable at 0% | Car too grippy even at 0% |
| Efficiency modifier spread | 0.5–0.9 | 0.3–1.0 | All cars wear same | Worst car unplayable |
| Difficulty modifier range | 0.7–1.5 | 0.5–2.0 | No difficulty difference | Extreme punishment on Hard |
| Pit stop duration (tire) | 8-10 s | 6–15 s | Pits too fast (no penalty) | Pits too slow (always costly) |

## Visual/Audio Requirements

- **Tire wear visual:** As tires wear, subtle visual cues — slightly different tire shader (less shiny), minor particle effects on curbs. Not dramatic; the player should feel it through input, not see it on the model.
- **Audio cue:** Tire squeal becomes more frequent and higher-pitched as wear increases. At 75%+ wear, squealing is constant in corners.
- **Grip loss feel:** Steering becomes lighter (reduced force feedback if available). Camera shake increases slightly in corners. Vehicle Physics handles this via grip_multiplier.

## UI Requirements

- **Race HUD:** Tire wear bar (see above). Always visible during race.
- **Pre-race screen:** Show tire wear rate comparison (player car vs. grid average). 1 bar or number.
- **Post-race:** Optional tire remaining display.

> **📌 UX Flag — Tire System**: This system has UI requirements. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for the tire display before writing epics.

## Acceptance Criteria

- **GIVEN** a car with tire wear at 0%, **WHEN** cornering at speed, **THEN** grip multiplier is 1.0 (full grip).
- **GIVEN** a car with tire wear at 50%, **WHEN** cornering at speed, **THEN** grip multiplier is 0.60 ± 0.01.
- **GIVEN** a car with tire wear at 100%, **WHEN** cornering at speed, **THEN** grip multiplier is 0.20 ± 0.01 (floor).
- **GIVEN** a car driving off-track (surface_penalty = 3.0), **WHEN** tire wear is calculated, **THEN** wear rate is approximately 3× the on-track rate.
- **GIVEN** a car driving aggressively (aggression = 2.0), **WHEN** tire wear is calculated, **THEN** wear rate is approximately 2× the smooth driving rate.
- **GIVEN** a pit stop, **WHEN** the car enters pit lane, **THEN** tires are swapped to new (100% wear) and pit takes 8-10 seconds.
- **GIVEN** a car with Efficiency 20, **WHEN** tire wear is calculated, **THEN** wear rate is approximately 50% of the base rate (most efficient).
- **GIVEN** a car with Efficiency 4, **WHEN** tire wear is calculated, **THEN** wear rate is approximately 90% of the base rate (least efficient).
- **GIVEN** difficulty set to Hard, **WHEN** tire wear spread is calculated, **THEN** the difference between best and worst Efficiency is expanded.
- **GIVEN** a car with 0% tire wear, **WHEN** the player attempts to corner at racing speed, **THEN** the car slides significantly but remains controllable (grip floor = 0.20).

## Open Questions

- **Tire wear feedback timing:** Should the player receive an audio/visual cue when tires hit 50% wear (the "worn" threshold)? Or should they discover it through grip feel?
- **Pit stop decision:** Should the player choose to pit or is it automatic when entering pit lane? Can they abort a pit stop?
- **AI tire management:** Should AI rivals have visible tire wear? Or is their tire management hidden?
- **Tire wear in qualifying:** Should tire wear apply during qualifying laps? Or do qualifying laps use fresh tires?
- **Multiple compounds in future:** When soft/hard compounds are added, should the pre-race screen show compound choice? Or is it automatic based on race strategy?
