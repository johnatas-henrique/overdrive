# Fuel System

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-21
> **Implements Pillar**: Every Short Race Matters

## Overview

**Fuel System** tracks and depletes fuel in real time during a race. It consumes throttle input from Vehicle Physics, applies the car's Efficiency stat from Car Definition Data, and outputs current fuel level to HUD and Pit Stop. The system creates the strategic layer that separates mechanical skill from race craft — a fast driver who burns all their fuel on lap 3 has no answer for a patient rival who lifts and coasts. Without this system, races are pure speed contests with no resource pressure.

## Player Fantasy

**Framing:** Direct — the player feels fuel pressure through the fuel bar and strategic decisions. Two experiences, one system.

**Emotional target:** Two modes that alternate depending on the player's choices:

1. **The Ice Vein (restraint as mastery):** You're the calm head in a grid of berserkers. You lift on the straight while rivals blast past — then they pit, and you inherit the lead. Speed feels sharper because you chose it. Anchor: lap 4, fuel bar half-empty, you conserve while the pack ahead burns through their tanks. The positions come to you not through speed, but through patience.

2. **The Edge Runner (tension as currency):** The fuel bar is a tightrope. Every lap is a gamble. You push to the limit, fuel in the red on the final lap, and cross the line with fumes. Anchor: final straight, fuel warning flashing, you hold the throttle and pray the math works. Maximum arcade adrenaline.

**Pillar alignment:** Every Short Race Matters — fuel decisions have immediate, visible consequences within a 5-lap race. Speed You Can Feel — fuel pressure is felt through the bar, through the decision to lift, through the tension of watching it drop.

**Design test:** Does the player feel that fuel is a strategic tool, not a punishment? Can both the patient strategist and the aggressive risk-taker find satisfaction in the same system?

## Detailed Design

### Core Rules

**1. Tank Capacity**

All cars have the same fuel tank: **8.0 liters**. Fixed across all tiers, all difficulties. The player never worries about tank size — only about how fast they burn through it.

**2. Fuel Consumption**

Fuel is consumed proportionally to throttle input. The consumption rate is:

`fuel_rate = base_rate × throttle_input × efficiency_modifier × difficulty_modifier`

- **throttle_input:** 0.0 (off) to 1.0 (full). Partial throttle = partial consumption. The skill mechanic: lifting off reduces consumption dramatically.
- **efficiency_modifier:** `(1 - stat × 0.025)` where stat is the car's Efficiency (0-20). At stat 20: modifier = 0.5 (half consumption). At stat 4: modifier = 0.9 (near full). Spread is 1.8x — noticeable but not game-breaking.
- **difficulty_modifier:** Scales the consumption spread. Very Easy = compressed (fuel barely matters). Hard = expanded (fuel is critical).
- **base_rate:** Calibrated so full-throttle driving with Efficiency 4 (worst) needs a pit stop, while Efficiency 20 (best) can almost finish without one.

**3. Fuel States**

| State | Fuel Level | Behavior |
|-------|-----------|----------|
| **Full** | 100%–50% | Full power. No performance difference. |
| **Conserving** | 50%–25% | Full power. Visual fuel warning begins (yellow bar). Player decides: push or conserve. |
| **Critical** | 25%–1% | Full power. Visual warning intensifies (red bar, audio cue). Player must decide: pit now or risk it. |
| **Empty** | 0% | Engine cuts. Car coasts on inertia. No throttle response. Player must reach pit lane or retire. |

**4. Empty Fuel Behavior**

When fuel hits 0:
- Throttle input is ignored (no acceleration).
- Car coasts on current momentum.
- Brakes still work (hydraulic, not engine-dependent).
- Steering still works.
- Car can be pushed to pit lane by coasting, or retires if it stops on track.

**5. Fuel Weight Effect**

Ignored. Cars do not change weight based on fuel level. Weight is constant 505 kg for all cars at all times.

**6. Low Fuel Speed Bonus (Optional)**

As fuel decreases, the car becomes marginally faster due to reduced mass (even though weight is constant for physics, the *feel* can be faked). Implementation: when fuel < 25%, apply a +1-2% top speed bonus. This is a perception hack, not a physics change. Adds the "second wind" sensation without affecting cornering or handling.

**7. Pit Stop Refueling**

- Pit stop duration: 8-10 seconds (fixed, not proportional to fuel added).
- Refueling is instant within the pit window — the car leaves with a full tank.
- Player cannot choose how much fuel to add — always refills to full.
- Pit stop is optional. Player can skip it entirely if they manage fuel well.

**8. Display**

- HUD fuel bar: horizontal bar, 0-100%, positioned bottom-left of race HUD.
- Color states: green (>50%), yellow (50-25%), red (25-1%).
- Numeric readout: "X.X L" below the bar.
- Audio cue: engine pitch drops subtly as fuel decreases (perception, not physics).

### States and Transitions

| State | Fuel Range | Entry Condition | Exit Condition |
|-------|-----------|-----------------|----------------|
| **Full** | 100%–50% | Race start | Fuel drops below 50% |
| **Conserving** | 50%–25% | Fuel drops below 50% | Fuel drops below 25% OR fuel refilled (pit) |
| **Critical** | 25%–1% | Fuel drops below 25% | Fuel drops to 0% OR fuel refilled (pit) |
| **Empty** | 0% | Fuel hits 0% | Fuel refilled (pit) OR car retires |

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Vehicle Physics** | Inbound | Throttle input (0-1) | Consumed every physics tick |
| **Car Definition Data** | Inbound | Efficiency stat | Modifies consumption rate |
| **Settings** | Inbound | Difficulty level | Scales consumption spread |
| **HUD** | Outbound | Fuel level (0-100%), state | Displayed as bar + numeric |
| **Pit Stop** | Bidirectional | Pit trigger → refuel → full tank | Pit stops refuel to 100% |
| **AI Rival** | Outbound | Fuel level (AI consumption) | AI manages fuel based on difficulty |
| **Ghost Recording** | Outbound | Fuel level per tick | Recorded for ghost replay |

## Formulas

**Current live values:** see `Assets/Data/Cars/CarConfig.asset` (ScriptableObject).

### Fuel Consumption

The **fuel_rate** formula is defined as:

`fuel_rate = base_rate × throttle_input × efficiency_modifier × difficulty_modifier`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| base_rate | — | float | calibrated per difficulty | Base consumption per second at full throttle |
| throttle_input | — | float | 0.0–1.0 | Player's throttle input |
| efficiency_modifier | — | float | 0.5–0.9 | `(1 - stat × 0.025)`, stat 20 = 0.5, stat 4 = 0.9 |
| difficulty_modifier | — | float | 0.7–1.5 | Scales spread: Very Easy = 0.7, Hard = 1.5 |

**Output Range:** 0 (coasting) to base_rate × 0.9 × 1.5 (full throttle, worst Efficiency, Hard).
**Example:** base_rate = 0.02, throttle = 1.0, stat 4, Hard → 0.02 × 1.0 × 0.9 × 1.5 = 0.027 L/s. 8L tank lasts 296s (~5 min).

### Time to Empty (Reference)

| Efficiency | Throttle | Difficulty | Rate (L/s) | Time to Empty |
|------------|----------|------------|------------|---------------|
| 20 (best) | 100% | Normal | 0.010 | 800s (13.3 min) |
| 20 (best) | 100% | Hard | 0.015 | 533s (8.9 min) |
| 4 (worst) | 100% | Normal | 0.018 | 444s (7.4 min) |
| 4 (worst) | 100% | Hard | 0.027 | 296s (4.9 min) |
| 20 (best) | 50% (lift) | Normal | 0.005 | 1600s (26.7 min) |
| 4 (worst) | 50% (lift) | Normal | 0.009 | 889s (14.8 min) |

**Key insight:** Full throttle with worst Efficiency on Hard barely fits in a 5-lap race (~5 min). Lift-and-coast comfortably finishes without pit. This creates the strategic decision.

### Low Fuel Speed Bonus

When fuel < 25%: apply +1% to max_velocity (top speed bonus only, not acceleration or handling).

`effective_max = max_velocity × (1 + 0.01 × (1 - fuel_percent / 25))` when fuel_percent < 25.

**Output:** 0% bonus at 25% fuel, 1% bonus at 0% fuel. Perception hack, not physics change.

## Edge Cases

- **If fuel hits 0 mid-corner:** Car coasts through corner on momentum. Player can still steer and brake. No throttle response until pit stop.
- **If player pits with fuel > 50%:** Pit stop still refuels to full. Player wastes time but gains no strategic advantage. Should be rare.
- **If player skips pit entirely:** Must manage fuel through lift-and-coast. If fuel runs out, car coasts to a stop. Can still retire gracefully.
- **If AI runs out of fuel:** AI coasts toward pit lane. If AI stops on track, it retires. AI fuel management scales with difficulty.
- **If difficulty is changed mid-race:** Difficulty modifier applies to the NEXT race, not the current one. No mid-race changes.
- **If Efficiency stat is corrupted (0 or >20):** Clamp to nearest valid (4-20). Log warning.
- **If base_rate is 0 (corrupted):** Fuel never depletes. Log warning. Treat as infinite fuel.
- **If throttle_input is held at 100% for entire race (Hard difficulty, worst Efficiency):** Fuel runs out around lap 3-4. Player must pit or retire. This is the intended behavior.
- **If lift-and-coast is used for entire race:** Fuel lasts well beyond race end. No pit needed. This is the intended "Ice Vein" path.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Vehicle Physics** | Inbound | Throttle input | Hard — fuel consumption depends on throttle |
| **Car Definition Data** | Inbound | Efficiency stat | Hard — determines consumption rate |
| **Settings** | Inbound | Difficulty level | Hard — scales consumption spread |
| **HUD** | Outbound | Fuel level + state | Hard — player needs to see fuel |
| **Pit Stop** | Bidirectional | Pit trigger ↔ refuel | Hard — pit stops are the recovery mechanism |
| **AI Rival** | Outbound | Fuel level (AI) | Soft — AI fuel management |
| **Ghost Recording** | Outbound | Fuel level per tick | Soft — ghost replay shows fuel state |

## Tuning Knobs

All values below are serialized fields in `CarConfig.asset` (ScriptableObject).

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Tank capacity | 8.0 L | 6.0–12.0 L | Races too short (always pit) | Fuel never runs out |
| Base rate (Normal) | 0.02 L/s | 0.01–0.04 L/s | Fuel too conservative | Fuel runs out too fast |
| Efficiency modifier spread | 0.5–0.9 | 0.3–1.0 | All cars consume same | Worst car unplayable |
| Difficulty modifier range | 0.7–1.5 | 0.5–2.0 | No difficulty difference | Extreme punishment on Hard |
| Low fuel speed bonus | +1% | 0–3% | No perceptible boost | Noticeable speed change |
| Low fuel threshold | 25% | 15–35% | Bonus too late to matter | Bonus kicks in too early |
| Pit stop duration | 8-10 s | 6–15 s | Pits too fast (no penalty) | Pits too slow (always costly) |

## Visual/Audio Requirements

- **Fuel bar:** Horizontal bar, 0-100%, color-coded (green > 50%, yellow 50-25%, red 25-1%). Positioned bottom-left of race HUD.
- **Numeric readout:** "X.X L" below the bar. Updates in real time.
- **Audio cue:** Engine pitch drops subtly as fuel decreases (perception hack, not physics). Audio director to define the exact pitch curve.
- **Empty fuel:** Engine sound cuts. Only wind and tire noise remain. Strong audio feedback that fuel is gone.
- **Pit stop visual:** Fuel nozzle animation, 2-3 seconds of the 8-10 second stop.

## UI Requirements

- **Race HUD:** Fuel bar (see above). Always visible during race.
- **Pre-race screen:** Show fuel consumption rate comparison (player car vs. grid average). 1 bar or number.
- **Post-race:** Optional fuel remaining display (how much fuel was left at finish).

> **📌 UX Flag — Fuel System**: This system has UI requirements. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for the fuel display before writing epics.

## Acceptance Criteria

- **GIVEN** a car with Efficiency 4, **WHEN** full throttle is held for 5 laps at Hard difficulty, **THEN** fuel runs out before race end (pit stop required).
- **GIVEN** a car with Efficiency 20, **WHEN** lift-and-coast is used for 5 laps at Normal difficulty, **THEN** fuel remains above 0% at race end (no pit needed).
- **GIVEN** any car, **WHEN** fuel level is checked at race start, **THEN** tank is exactly 8.0 L.
- **GIVEN** fuel level at 0%, **WHEN** throttle input is applied, **THEN** car does not accelerate (coasts on momentum).
- **GIVEN** fuel level at 0%, **WHEN** brake is applied, **THEN** car decelerates normally (brakes are hydraulic).
- **GIVEN** fuel level at 25%, **WHEN** the low fuel speed bonus is applied, **THEN** max_velocity increases by 0.5-1.0%.
- **GIVEN** a pit stop, **WHEN** the car enters pit lane, **THEN** fuel is refilled to 8.0 L and pit takes 8-10 seconds.
- **GIVEN** fuel level at 50%, **WHEN** the player pits, **THEN** fuel is still refilled to 100% (no partial refuel option).
- **GIVEN** difficulty set to Very Easy, **WHEN** fuel consumption is calculated, **THEN** the spread between best and worst Efficiency is compressed (fuel barely matters).
- **GIVEN** difficulty set to Hard, **WHEN** fuel consumption is calculated, **THEN** the spread between best and worst Efficiency is expanded (fuel is critical).

## Open Questions

- **Fuel display in mirrors:** Should the fuel bar be visible in cockpit view mirrors? Or only in HUD overlay?
- **Pit lane automation:** Should the pit stop be fully automated (car enters pit, stops, refuels, exits) or should the player have some control (choose pit box, manage pit entry speed)?
- **Fuel strategy for AI:** Should AI rivals have visible fuel levels? Or is their fuel management hidden from the player?
- **Multiple pit stops:** Should the game allow/optimize for 2-stop strategies? Or is 0-stop vs 1-stop the intended decision space?
- **Fuel warning timing:** Should the audio cue for critical fuel start at 25% or later (e.g., 15%)?
