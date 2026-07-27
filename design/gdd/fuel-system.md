# Fuel System

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Every Short Race Matters

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Throttle-proportional fuel consumption, fuel states, pit refueling, and HUD feedback. |
| MVP architecture constraints | Fuel values are data-driven and exposed through the local race-state contract. |
| Alpha | Not designed. |
| Beta | Not designed. |
| Release | Not designed. |

### Review Boundary
All defined fuel behavior is MVP; unassigned open questions are not implied future commitments.

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

`fuel_rate = base_rate × accelerateOut × efficiency_modifier`

- **accelerateOut:** 0.0 (off) to 1.0 (full). Partial throttle = partial consumption. The skill mechanic: lifting off reduces consumption dramatically. Value comes from `ResolvedCarInput[carId].accelerateOut` at Tick Step 5.
- **efficiency_modifier:** `(1 - stat × 0.025)` where stat is the car's Efficiency (0-20). At stat 20: modifier = 0.5 (half consumption). At stat 4: modifier = 0.9 (near full). Spread is 1.8x — noticeable but not game-breaking.
- **base_rate:** 0.06 L/s in the MVP before throttle and Efficiency modifiers. It is the operational base rate for all cars and difficulties.

At full throttle, the per-car reference rate is `fuel_rate_for_car = base_rate × efficiency_modifier`. Qualifying uses that full-throttle reference rate to initialize its load.

Difficulty does not modify fuel rules in MVP. Difficulty changes AI competence and race behavior, not tank capacity, consumption formulas, or resource thresholds.

During `RaceMode.Qualifying`, Fuel initializes the computed load supplied by Qualifying: `min(8.0L, fuel_rate_for_car × reference_flying_lap_time × 1.10)`. The player does not manage or monitor this load, and qualifying does not refuel.

**3. Fuel States**

| State | Fuel Level | Behavior |
|-------|-----------|----------|
| **Full** | > 50% | Full power. No performance difference. |
| **Conserving** | 50%–25% | Full power. Visual fuel warning begins (yellow bar). Player decides: push or conserve. |
| **Critical** | < 25% | Full power. Visual warning intensifies (red bar, audio cue). Player must decide: pit now or risk it. |
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

**6. Low Fuel Speed Bonus**

When fuel < 25%, apply a +1% top speed bonus. This is a perception hack, not a physics change: vehicle mass remains constant and cornering/handling do not change.

**7. Pit Stop Refueling**

- Fuel fills at 0.8 L/s (1% tank per 0.1s); an empty-to-full refill takes 10s. This is the empty-entry case; actual service duration depends on entry fuel.
- Tire swap completes after 2s. Player may then exit with the current partial fuel level; AI waits until full in MVP.
- Service duration is `max(2s, missing_fuel_liters / 0.8 L/s)`.

**Authority note:** Fuel System owns `fuel_rate_for_car` and `fuel_fill_rate`; Pit Stop consumes both during service.

**Countdown:** Fuel does not consume or change state while SimulationState is Countdown. Race consumption begins on the first Racing tick after GO.
- Pit stop is optional. Player can skip it entirely if they manage fuel well.

**8. Display**

- HUD fuel bar: horizontal bar, 0-100%, positioned bottom-left of race HUD.
- Color states: green (>50%), yellow (50-25%), red (<25%).
- Numeric readout: "X.X L" below the bar.
- Audio cue: A discrete Critical stinger plays once when fuel first drops below 25%; Audio System owns the exact continuous `fuel_factor` curve.

### States and Transitions

| State | Fuel Range | Entry Condition | Exit Condition |
|-------|-----------|-----------------|----------------|
| **Full** | > 50% | Race start | Fuel drops to 50% |
| **Conserving** | 50%–25% | Fuel drops to 50% | Fuel drops below 25% OR fuel refilled (pit) |
| **Critical** | < 25% | Fuel drops below 25% | Fuel drops to 0% OR fuel refilled (pit) |
| **Empty** | 0% | Fuel hits 0% | Fuel refilled (pit) OR car retires |

State evaluation happens after the Fuel tick updates the current value. Exact 25.0% remains Conserving until the value drops below 25.0%, so the HUD does not flicker across the boundary within a race tick.

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Vehicle Physics** | Bidirectional | `accelerateOut` from `ResolvedCarInput[carId]` (in); fuel state, low-fuel max-speed modifier (out) | Fuel consumes throttle every physics tick and outputs the low-fuel speed bonus when fuel < 25% |
| **Car Definition Data** | Inbound | Efficiency stat | Modifies consumption rate |
| **HUD** | Outbound | Fuel level (0-100%), state | Displayed as bar + numeric |
| **Pit Stop** | Bidirectional | Pit trigger → 0.8 L/s refuel → partial/full exit | Player may exit after 2s; AI exits full in MVP. |
| **AI Rival** | Bidirectional | Fuel level and last-lap consumption | AI evaluates after lap 1 for next-lap forecast +10%. |
| **Qualifying** | Inbound | `qualifying_fuel_load` request and reference lap estimate | Initializes the minimum load needed for one flying lap plus the approved margin. |
| **Ghost Recording** | Indirect | Fuel state derived from replay (not recorded per tick); initial fuel state captured in ReplayInitialState | Ghost replay recalculates fuel from input using same formula |
| **Audio** | Outbound | Critical stinger and continuous fuel pitch curve | Plays the one-shot 25% warning stinger and the continuous pitch curve owned by Audio System |
| **UI Menu** | Outbound | Fuel rate comparison data | Displays the pre-race fuel comparison. |

At each `LapCompleted`, Fuel snapshots `last_lap_fuel_use = max(0, fuel_at_previous_lap_boundary - fuel_at_current_lap_boundary)`, then resets its per-lap accumulator. Pit Stop and AI consume this Fuel-owned value; Race Session Manager does not calculate Fuel consumption.

## Formulas

**Current live values:** see `Assets/Data/Cars/CarConfig.asset` (ScriptableObject).

### Fuel Consumption

The **fuel_rate** formula is defined as:

`fuel_rate = base_rate × accelerateOut × efficiency_modifier`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| base_rate | — | float | 0.06 L/s in MVP | Operational base consumption per second at full throttle |
| accelerateOut | — | float | 0.0–1.0 | Player's throttle input from `ResolvedCarInput[carId].accelerateOut` at Tick Step 5 |
| efficiency_modifier | — | float | 0.5–0.9 | `(1 - stat × 0.025)`, stat 20 = 0.5, stat 4 = 0.9 |

**Output Range:** 0 (coasting) to `base_rate × 0.9` (full throttle, worst Efficiency) = 0.054 L/s.
**Example:** base_rate = 0.06, throttle = 1.0, stat 4 → 0.06 × 1.0 × 0.9 = 0.054 L/s. An 8L tank lasts 148s (2.5 min).

### Time to Empty (Reference)

| Efficiency | Throttle | Rate (L/s) | Time to Empty |
|------------|----------|------------|---------------|
| 20 (best) | 100% | 0.030 | 267s (4.4 min) |
| 4 (worst) | 100% | 0.054 | 148s (2.5 min) |
| 20 (best) | 50% (lift) | 0.015 | 533s (8.9 min) |
| 4 (worst) | 50% (lift) | 0.027 | 296s (4.9 min) |

**Key insight:** Full throttle with even the best Efficiency exhausts the tank during a 5-lap race. Lift-and-coast can still finish without pit, but it now carries a real time-vs-refuel trade-off.

### Low Fuel Speed Bonus

When fuel < 25%: apply +1% to max_velocity (top speed bonus only, not acceleration or handling).

`effective_max = max_velocity × (1 + 0.01 × (1 - fuel_percent / 25))` when fuel_percent < 25.

**Output:** 0% bonus at 25% fuel, 1% bonus at 0% fuel. Perception hack, not physics change.

## Edge Cases

- **If fuel hits 0 mid-corner:** Car coasts through corner on momentum. Player can still steer and brake. No throttle response until pit stop.
- **If player pits with fuel > 50%:** Player may exit after tire swap with useful partial fuel or wait to full; pit time still creates a trade-off.
- **If player skips pit entirely:** Must manage fuel through lift-and-coast. If fuel runs out, car coasts to a stop. Can still retire gracefully.
- **If AI runs out of fuel:** AI coasts toward pit lane. If AI stops on track, it retires. AI pit decisions use projected resources, not difficulty.
- **If Difficulty changes between races:** Fuel keeps the same base rate, efficiency formula, and fixed tank rules because DifficultyProfile contains no Fuel field.
- **If Efficiency stat is corrupted (0 or >20):** Clamp to nearest valid (4-20). Log warning.
- **If base_rate is 0 (corrupted):** Fuel never depletes. Log warning. Treat as infinite fuel.
- **If accelerateOut is held at 100% for entire race (worst Efficiency):** Fuel runs out around lap 3-4. Player must pit or retire. This behavior is independent of DifficultyProfile.
- **If lift-and-coast is used for entire race:** Fuel lasts well beyond race end. No pit needed. This is the intended "Ice Vein" path.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Vehicle Physics** | Bidirectional | Throttle input, low-fuel max-speed modifier | Hard — fuel consumption depends on throttle; Fuel outputs speed bonus when < 25% |
| **Simulation Architecture** | Indirect via Simulation | Hard | Assembles `ResolvedCarInput[carId]` at Tick Step 2; Fuel consumes `accelerateOut` at Tick Step 5 |
| **Car Definition Data** | Inbound | Efficiency stat | Hard — determines consumption rate |
| **HUD** | Outbound | Fuel level + state | Hard — player needs to see fuel |
| **Pit Stop** | Bidirectional | Pit trigger ↔ refuel | Hard — pit stops are the recovery mechanism |
| **AI Rival** | Bidirectional | Fuel level (AI) | Hard — AI fuel management |
| **Ghost Recording** | Indirect | Fuel state derived from replay (not recorded per tick) | Soft — ghost replay shows fuel state |

## Tuning Knobs

All values below are serialized fields in `CarConfig.asset` (ScriptableObject).

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Tank capacity | 8.0 L | 6.0–12.0 L | Races too short (always pit) | Fuel never runs out |
| Base rate (MVP) | 0.06 L/s | 0.05–0.07 L/s | Fuel too conservative | Fuel runs out too fast |
| Efficiency modifier spread | 0.5–0.9 | 0.3–1.0 | All cars consume same | Worst car unplayable |
| Low fuel speed bonus | +1% | 0–3% | No perceptible boost | Noticeable speed change |
| Low fuel threshold | 25% | 15–35% | Bonus too late to matter | Bonus kicks in too early |
| Fuel fill rate | 0.8 L/s | Fixed MVP value | Fuel timing unclear | Breaks standard pit timing |

## Visual/Audio Requirements

- **Fuel bar:** Horizontal bar, 0-100%, color-coded (green > 50%, yellow 50-25%, red < 25%). Positioned bottom-left of race HUD.
- **Numeric readout:** "X.X L" below the bar. Updates in real time.
- **Audio cue:** A discrete Critical stinger plays once when fuel first drops below 25%; Audio System owns the exact continuous `fuel_factor` curve.
- **Empty fuel:** Engine sound cuts. Only wind and tire noise remain. Strong audio feedback that fuel is gone.
- **Pit stop visual:** Fuel nozzle animation continues at 0.8 L/s through variable 2-10 second service; tire swap completes at 2s.

## UI Requirements

- **Race HUD:** Fuel bar (see above). Always visible during race.
- **Pre-race screen:** Show fuel consumption rate comparison (player car vs. grid average). 1 bar or number.
- **Post-race:** Optional fuel remaining display (how much fuel was left at finish).

> **📌 UX Flag — Fuel System**: This system has UI requirements. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for the fuel display before writing epics.

## Acceptance Criteria

- **GIVEN** a car with Efficiency 4, **WHEN** full throttle is held from GO through a 5-lap reference race (75s/lap), **THEN** fuel reaches 0% before lap 3 begins (148.1s ± 0.5s).
- **GIVEN** a car with Efficiency 20, **WHEN** full throttle is held from GO through a 5-lap reference race (75s/lap), **THEN** fuel reaches 0% during lap 4 and before lap 5 begins (266.7s ± 0.5s).
- **GIVEN** a car with Efficiency 20, **WHEN** throttle is held at 50% for the full 5-lap reference race, **THEN** fuel remains above 0% at race end.
- **GIVEN** any car, **WHEN** fuel level is checked at race start, **THEN** tank is exactly 8.0 L.
- **GIVEN** fuel level at 0%, **WHEN** throttle input is applied, **THEN** car does not accelerate (coasts on momentum).
- **GIVEN** fuel level at 0%, **WHEN** brake is applied, **THEN** car decelerates normally (brakes are hydraulic).
- **GIVEN** fuel transitions from 50.1% to 49.9%, **WHEN** state is evaluated, **THEN** the state becomes Conserving and the HUD fuel bar is yellow.
- **GIVEN** fuel transitions from 25.1% to 24.9%, **WHEN** state is evaluated, **THEN** the state becomes Critical, the HUD fuel bar is red, and the Critical stinger plays once.
- **GIVEN** fuel level at 10%, **WHEN** the low fuel speed bonus is applied, **THEN** max_velocity bonus is exactly 0.6%.
- **GIVEN** Countdown runs for 300 ticks, **WHEN** fuel is observed before GO, **THEN** fuel equals its Countdown-entry value.
- **GIVEN** fuel level changes, **WHEN** Vehicle Physics reads car mass, **THEN** mass remains exactly 505 kg.
- **GIVEN** any difficulty, **WHEN** base fuel rate is read before modifiers, **THEN** it is exactly 0.06 L/s.
- **GIVEN** an empty tank enters pit, **WHEN** 10s of service elapse, **THEN** fuel is exactly 8.0 L.
- **GIVEN** fuel level at 50%, **WHEN** 2s of pit service elapse and player exits, **THEN** fuel is 70% (5.6 L) ± 0.01L.
- **GIVEN** any difficulty, **WHEN** fuel consumption is calculated for the same car and throttle sequence, **THEN** the fuel rate is identical; difficulty does not modify Fuel rules.
- **GIVEN** a car with corrupted Efficiency stat 0, **WHEN** fuel consumption is calculated, **THEN** efficiency_modifier clamps to the stat-4 value (0.9) and a warning is logged.
- **GIVEN** a completed lap that includes a pit stop, **WHEN** LapCompleted fires, **THEN** last_lap_fuel_use is clamped to a non-negative value and is available to Pit Stop and AI Rival.
- **GIVEN** a replay tick stream, **WHEN** Fuel is reconstructed during replay, **THEN** the replayed fuel state matches the live simulation for the same SimulationInput stream.

## Open Questions

- **Fuel display in mirrors:** Deferred to the Cockpit HUD UX specification; the authoritative fuel bar remains in the HUD/overlay.
- **Pit lane automation:** Resolved for MVP: physical pit-zone entry is automatic; Pit Stop handles service; the player may press Confirm after 2s to exit with partial fuel, otherwise service continues to full.
- **Fuel strategy for AI:** AI fuel levels remain hidden from the player; HUD exposes only the player's fuel state.
- **Multiple pit stops:** Multiple physical pit entries are allowed; MVP does not add a separate pit-count rule. AI avoids a final-lap pit through its own projection rule.
- **Fuel warning timing:** Critical fuel audio begins at the existing 25% Critical threshold; no second warning threshold is introduced.
