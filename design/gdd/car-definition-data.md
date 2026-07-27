# Car Definition Data

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Earn the Next Seat, Rivals Make the Grid Personal

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Six fixed stats plus engine audio-profile fields for 16 teams, tier data, and local car-definition assets. |
| MVP architecture constraints | Car data is externalized so later condition or stat extensions do not require vehicle-code changes. |
| Alpha | Car condition/stat variation if approved. |
| Beta | Not designed. |
| Release | Not designed. |

### Review Boundary
Future car progression is non-blocking unless MVP data schema prevents extension.

## Overview

**Car Definition Data** is the data layer that defines the mechanical identity of each of the 16 F1 teams — 6 stats per car (Top Speed, Acceleration, Brake Power, Grip Level, Stability, Efficiency) on a 0–20 scale, plus the car's audio profile, identified by stable IDs (`team_tier1_a` through `team_tier4_d`). It is consumed by Vehicle Physics (motion), Fuel (consumption rate), Tire (wear rate), Audio (engine profile), and AI Rival (performance ceiling). The player never reads this data directly — they feel it through how each car responds to their input and sounds at speed. Without it, every car drives identically, the seat-ascension progression loses meaning, and the grid becomes a texture swap instead of a hierarchy.

## Player Fantasy

**Framing:** Direct — the player feels car differences through driving. The stats are invisible; the response to input is everything.

**Emotional target:** Three layers that work as a cycle:

1. **The Earned Throne (Pillar 3 — Earn the Next Seat):** The 16 teams are a ladder of legitimacy (`team_tier4_d` at the bottom, `team_tier1_a` at the top). Each rung is a status you hold, not a thing you own. When you move from `team_tier4_d` to a higher-tier team, the world treats you differently — rivals respect you, the grid respects you, and the car *responds* to inputs you've always imagined but never felt. Nobody wants `team_tier4_d`. Everyone wants `team_tier1_a`. Your seat is your rank.

2. **The Grudge Match (Pillar 4 — Rivals Make the Grid Personal):** The cars are people's seats. When you beat a rival, you take their place, and they know it. Every promotion is a small humiliation. The standings are a story of grudges written in lap times. Your good machine makes your seat a target — the next rival is already pushing to take it from you.

3. **The Car Speaks (Pillar 1 — Speed You Can Feel):** Every machine has a voice. The player learns to listen — not in a sim way, but through hands and rhythm. First lap in a new car: trail-brake into Turn 1, feel the rear step out differently than expected, adjust, find the line. The stats disappear; what's left is the relationship between driver and machine.

**Anchor moment:** The first race in `team_tier1_a`. Lap 1, you brake where you always braked in `team_tier4_d` — and the car doesn't even notice. You brake ten meters later and the nose tucks. You realize the car is *waiting* for you. Then you glance at the mirror and see the rival you displaced, pushing hard. You belong here. And they know it.

**Tone:** Champion's poise, broken by the occasional flash of grudge. Cold pride, hot competition, tactile connection.

**Design test:** Does the player feel that moving to a better car is earned, not given? Does the new car feel tangibly different within the first corner? Does the player feel their seat is worth defending?

## Detailed Design

### Core Rules

**1. Stat Definitions**

Every car has exactly 6 stats on a 0–20 scale. Higher is better. Weight is a constant (505 kg) for all cars.

| Stat | Source (SMGP) | Controls | Higher = Better |
|------|--------------|----------|-----------------|
| **Top Speed** | ENG | Maximum velocity on straights | Faster top end |
| **Acceleration** | TM | Time to reach top speed | Quicker launches and exits |
| **Brake Power** | BRA | Deceleration rate | Later braking points |
| **Grip Level** | TIRE | Tire adhesion, cornering grip | More planted in corners |
| **Stability** | SUS | Bump handling, resistance to loss of control | Less likely to lose control |
| **Efficiency** | New | Dimensionless Fuel/Tire efficiency modifier | Lower resource drain |

**Constant:** Weight = 505 kg for all cars. Not a differentiating stat — exists for physics calculations only.

**2. Stat Distribution**

Anchors (from SMGP reference):
- `team_tier1_a`: Top Speed 20, Acceleration 20, Brake Power 16, Grip Level 20, Stability 20, Efficiency 20
- `team_tier4_d`: Top Speed 16, Acceleration 8, Brake Power 4, Grip Level 12, Stability 12, Efficiency 8

Complete distribution (all stats in increments of 4):

| Team ID | Top Speed | Accel | Brake | Grip | Stability | Eff |
|---------|-----------|-------|-------|------|-----------|-----|
| `team_tier1_a` | 20 | 20 | 16 | 20 | 20 | 20 |
| `team_tier1_b` | 16 | 20 | 20 | 16 | 20 | 20 |
| `team_tier1_c` | 20 | 16 | 20 | 16 | 16 | 16 |
| `team_tier1_d` | 20 | 12 | 20 | 20 | 20 | 20 |
| `team_tier2_a` | 16 | 16 | 16 | 16 | 16 | 16 |
| `team_tier2_b` | 12 | 20 | 20 | 16 | 12 | 16 |
| `team_tier2_c` | 20 | 12 | 16 | 16 | 16 | 16 |
| `team_tier2_d` | 12 | 16 | 16 | 12 | 12 | 12 |
| `team_tier3_a` | 12 | 12 | 12 | 12 | 12 | 12 |
| `team_tier3_b` | 16 | 8 | 8 | 12 | 8 | 8 |
| `team_tier3_c` | 16 | 8 | 16 | 16 | 16 | 16 |
| `team_tier3_d` | 16 | 12 | 8 | 12 | 8 | 8 |
| `team_tier4_a` | 16 | 8 | 8 | 12 | 12 | 8 |
| `team_tier4_b` | 16 | 8 | 8 | 12 | 8 | 8 |
| `team_tier4_c` | 12 | 8 | 8 | 8 | 8 | 8 |
| `team_tier4_d` | 16 | 8 | 4 | 12 | 12 | 8 |

**Design rationale:**
- Tier gap: ~4-point average drop between tiers (noticeable but not insurmountable)
- Within-tier spread: 1-3 points (teams feel different but tier identity is clear)
- Each team has a distinct profile (e.g., `team_tier1_c` trades top speed for grip/efficiency, `team_tier2_b` trades brakes for speed/accel)

**3. Weight Mechanics**

Weight is a constant (505 kg) for all cars. It exists for physics calculations (acceleration force, braking distance) but does not differentiate teams. All cars share the same mass.

**4. Stat-to-Behavior Mapping**

Stats are consumed by Vehicle Physics via range-based formulas. See Section D for full formulas with variable tables. Summary:

| Stat | Formula Pattern | Inverted? | Effect |
|------|----------------|-----------|--------|
| Top Speed | `min + (stat/20) × (max-min)` | No | Higher = faster on straights |
| Acceleration | `min + ((20-stat)/20) × (max-min)` | Yes | Higher = faster 0-100 time |
| Brake Power | `min + ((20-stat)/20) × (max-min)` | Yes | Higher = shorter stopping distance |
| Grip Level | `min + (stat/20) × (max-min)` | No | Higher = faster cornering |
| Stability | `stat / 20` | No | Higher = harder to lose control |
| Efficiency | `base × (1 - stat × 0.025)` | Yes | Higher = lower consumption |

**4a. Player-Facing Feel Contrast**

The 5% differentiation rule: stats within 5% feel similar; >5% feels different. What the player observes:

| Stat Difference | Player Observation |
|-----------------|-------------------|
| Top Speed ±4 (e.g., 20 vs 16) | "This car is noticeably faster on straights — I pull away from rivals on long sections" |
| Acceleration ±4 | "This car launches quicker — I gain positions at race start and corner exits" |
| Brake Power ±4 | "This car brakes later — I can dive into corners deeper than rivals" |
| Grip Level ±4 | "This car holds corners better — I can carry more speed through turns" |
| Stability ±4 | "This car is more forgiving — I recover from slides faster" |
| Efficiency ±4 | "This car lasts longer — I can push harder before needing to pit" |

**Car personality through stat combinations:**
- High Speed + Low Brake = "The Missile" — fast on straights, struggles in corners
- High Grip + Low Speed = "The Corner King" — dominates turns, loses on straights
- High Stability + Low Efficiency = "The Tank" — consistent but pit-hungry
- Balanced stats = "The All-Rounder" — no weakness, no strength

**5. Storage Format**

Each team is stored as a ScriptableObject asset:
```
Assets/Data/Cars/team_tier1_a.asset
```

ScriptableObject fields: `teamId` (string), `tier` (int), `topSpeed` (int), `acceleration` (int), `brakePower` (int), `gripLevel` (int), `stability` (int), `efficiency` (int), `engineCylinders` (int, 6–12), `engineType` (string identifier). Weight is a global constant, not per-car. The concrete audio-profile values for each team are assigned in the Car Definition review; Audio consumes them without duplicating ownership.

MVP default audio profile: `engineCylinders = 10`, `engineType = V10`. A team asset may override these fields within the declared range; missing audio fields fall back to this default without affecting vehicle performance.

Loading: Addressables group `Cars/` — loaded per-race based on grid composition.

**6. Interface Contract**

| Data Field | Type | Range | Consuming System |
|------------|------|-------|-----------------|
| `team_id` | string | `team_tier{N}_{a-d}` | Race, UI, Save/Load |
| `tier` | int | 1–4 | Matchmaking, Difficulty |
| `top_speed` | int | 0–20 | Vehicle Physics → max velocity |
| `acceleration` | int | 0–20 | Vehicle Physics → force/throttle curve |
| `brake_power` | int | 0–20 | Vehicle Physics → deceleration rate |
| `grip_level` | int | 0–20 | Vehicle Physics → lateral friction |
| `stability` | int | 0–20 | Vehicle Physics → loss-of-control threshold |
| `efficiency` | int | 0–20 | Fuel → consumption rate, Tire → wear rate |
| `engine_cylinders` | int | 6–12 | Audio → procedural engine frequency |
| `engine_type` | string | Project-defined identifier | Audio → oscillator/timbre profile |

### States and Transitions

This system is static data — no runtime states. Car definitions are loaded at race start and remain constant throughout the race.

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Vehicle Physics** | Outbound | 6 stats | Primary consumer — translates stats to motion |
| **Fuel** | Outbound | Efficiency stat | Determines base fuel consumption rate |
| **Tire** | Outbound | Efficiency stat | Determines base tire wear rate |
| **AI Rival** | Outbound | All 6 stats | Performance ceiling for AI behavior |
| **Content Pipeline** | Outbound | team_id → asset path | Loads correct car prefab, materials, audio |
| **Audio** | Outbound | engine_cylinders, engine_type | Supplies the procedural engine profile |
| **Settings** | Not consumed at runtime | Difficulty | Difficulty changes AI competence, not car-definition stat formulas |

## Formulas

All formulas use a stat value (0–20) to position the car within a defined range. **Current live values:** see `Assets/Data/Cars/CarConfig.asset` (ScriptableObject). This section documents the formula structure and safe tuning ranges — not the exact numbers used in builds.

### Top Speed

The **max_velocity** formula is defined as:

`max_velocity = min + (stat / 20) × (max - min)`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| min | — | float | 250 km/h | Fixed MVP baseline inherited from the Normal tuning value |
| max | — | float | 310 km/h | Constant ceiling |
| stat | top_speed | int | 0–20 | Car's Top Speed stat |

**Output Range:** 250–310 km/h depending on stat; Difficulty does not alter this formula.
**Example:** stat 20 = 310 km/h. stat 16 = 298 km/h. stat 4 = 262 km/h.

### Acceleration

The **accel_time** formula is defined as:

`accel_time = min + ((20 - stat) / 20) × (max - min)`

⚠️ **Inverted:** higher stat = lower value (faster is better).

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| min | — | float | 2.0 s | Best possible 0-100 km/h time |
| max | — | float | 5.0 s | Worst possible 0-100 km/h time |
| stat | acceleration | int | 0–20 | Car's Acceleration stat |

**Output Range:** 2.0–5.0 s (0-100 km/h).
**Example:** stat 20 = 2.0 s. stat 4 = 4.4 s. stat 8 = 3.8 s.

### Brake Power

The **brake_distance** formula is defined as:

`brake_distance = min + ((20 - stat) / 20) × (max - min)`

⚠️ **Inverted:** higher stat = lower value (shorter distance is better).

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| min | — | float | 30 m | Best stopping distance from 200 km/h |
| max | — | float | 80 m | Worst stopping distance from 200 km/h |
| stat | brake_power | int | 0–20 | Car's Brake Power stat |

**Output Range:** 30–80 m (stopping from 200 km/h).
**Example:** stat 20 = 30 m. stat 4 = 70 m. stat 8 = 60 m.

### Grip Level

The **cornering_speed** formula is defined as:

`cornering_speed = min + (stat / 20) × (max - min)`

**Note:** Vehicle Physics consumes Grip Level stat as `grip_base` in its effective_grip multiplicative stack. The `cornering_speed` formula above defines the player-facing cornering performance; `grip_base` is the internal physics input derived from the same stat. Both use the same stat value (0–20) but produce different outputs for different consumption contexts.

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| min | — | float | 120 km/h | Worst cornering speed |
| max | — | float | 200 km/h | Best cornering speed |
| stat | grip_level | int | 0–20 | Car's Grip Level stat |

**Output Range:** 120–200 km/h (sustained cornering speed).
**Example:** stat 20 = 200 km/h. stat 4 = 136 km/h. stat 12 = 168 km/h.

### Stability

The **control_threshold** formula is defined as:

`control_threshold = stat / 20`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| stat | stability | int | 0–20 | Car's Stability stat |

**Output Range:** 0.2–1.0 (dimensionless multiplier for valid stat values 4–20). Higher = harder to lose control.
**Example:** stat 20 = 1.0 (almost never loses control). stat 4 = 0.2 (easily loses control). stat 12 = 0.6.

### Efficiency Modifier (Fuel)

The **efficiency_modifier** formula is defined as:

`efficiency_modifier = 1 - stat × 0.025`

⚠️ **Inverted:** higher stat = lower consumption (better).

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| stat | efficiency | int | 0–20 | Car's Efficiency stat |

**Output Range:** 0.50–0.90 (dimensionless).
**Example:** stat 20 = 0.50. stat 4 = 0.90. stat 12 = 0.70. Fuel System owns the operational `base_rate = 0.06 L/s` for all difficulties.

### Efficiency Modifier (Tire Wear)

The same **efficiency_modifier** applies to Tire System wear calculations:

`efficiency_modifier = 1 - stat × 0.025`

⚠️ **Inverted:** higher stat = lower wear (better).

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| stat | efficiency | int | 0–20 | Car's Efficiency stat |

**Output Range:** 0.50–0.90 (dimensionless). Tire System owns operational base wear and all race-condition modifiers.

## Edge Cases

- **If stat data is missing or corrupted:** Fall back to stat = 12 (midpoint of the valid 4-point increments) for all stats. Log warning. Car drives as generic mid-tier.
- **If two teams have identical stat profiles:** They drive identically. No tiebreaker in physics — differentiation comes from livery, audio, and team identity only.
- **If stat is outside 0–20 range:** Clamp to nearest valid value (4 minimum, 20 maximum). Log warning.
- **If audio profile fields are missing:** Use the MVP default `10-cylinder V10` profile and log a warning.
- **If a stat is 0 (corrupted data):** Treat as stat = 4 (minimum valid). A stat of 0 would produce 0 km/h top speed or 0 grip, which breaks the game.
- **High Top Speed + low Brake Power (e.g., `team_tier4_a`):** Car is fast on straights but can't stop. Player must brake much earlier. This is an intentional archetype — "the missile."
- **High Acceleration + low Grip (e.g., `team_tier2_b`):** Car launches hard but corners poorly. Player must be smooth in corners to capitalize on straight-line speed.
- **High Efficiency + low everything else:** Car consumes fewer resources but is slow. Player has more strategic flexibility but less raw pace.
- **All stats at minimum (stat = 4):** Car is slower (262 km/h max, 4.4s 0-100, 64m braking). Still drivable — the floor is set so the game remains playable.
- **All stats at maximum (stat = 20):** Car is very fast (310 km/h max, 2.0s 0-100, 30m braking). This is the ceiling — no car exceeds this.
- **Efficiency formula at stat 20:** `1 - 20 × 0.025 = 0.5` → 50% of base consumption. At stat 0 (if corrupted): `1 - 0 × 0.025 = 1.0` → 100% of base. The formula is safe at all valid stat values.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Vehicle Physics** | Outbound | Stats → motion formulas | Hard — car doesn't move without stats |
| **Fuel** | Outbound | Efficiency → consumption rate | Hard — fuel system needs base rate |
| **Tire** | Outbound | Efficiency → wear rate | Hard — tire system needs base rate |
| **AI Rival** | Outbound | All 6 stats → AI performance | Hard — AI ceiling defined by stats |
| **Content Pipeline** | Outbound | team_id → asset path | Hard — loads correct car assets |
| **Settings** | Not consumed at runtime | Difficulty selection | Soft — AI consumes difficulty; Car Definition formulas remain fixed |
| **Race Session Manager** | Outbound | team_id → grid composition | Hard — race needs to know which cars are on grid |

## Tuning Knobs

All values below are serialized fields in `CarConfig.asset` (ScriptableObject). Designers adjust these in the Unity Inspector during playtesting — no code changes required.

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Top Speed max | 310 km/h | 280–350 | Cars feel slow | Cars feel uncontrollable |
| Top Speed min (Normal) | 250 km/h | 220–280 | Worst car is too slow | No speed difference between cars |
| Acceleration min | 2.0 s | 1.5–3.0 s | Cars feel instant (no skill) | Cars feel sluggish |
| Acceleration max | 5.0 s | 4.0–7.0 s | Still too fast for worst car | Worst car can't keep up |
| Brake min | 30 m | 25–40 m | Brakes feel like teleportation | No risk in braking late |
| Brake max | 80 m | 60–100 m | Still manageable | Can't stop for corners |
| Grip min | 120 km/h | 100–140 km/h | Uncontrollable in corners | Cornering too easy |
| Grip max | 200 km/h | 180–220 km/h | Best car can't corner | Unrealistic for arcade |
| Efficiency modifier | `1 - stat × 0.025` | 0.50–0.90 | Fuel/tire balance is lost | Fuel/tire balance is lost |
| Stability multiplier | stat/20 | — | All cars spin out | No car ever loses control |
| Weight constant | 505 kg | 450–600 kg | Cars feel weightless | Cars feel like trucks |

**Interaction notes:**
- Top Speed and Brake interact: high speed + poor brakes = "the missile" archetype (intentional)
- Grip and Stability interact: high grip + low stability = car grips until it suddenly doesn't (intentional tension)
- Efficiency affects both fuel AND tire — changing one changes both (by design)

## Visual/Audio Requirements

This system has no direct visual or audio output. It is pure data. The visual identity of each team (livery, colors, helmet design) is defined by the art bible and content pipeline — this system provides the mechanical data that determines how each car *drives*, not how it *looks*.

The only visual connection: when a car's stats are displayed in UI (pre-race screen, garage), the values from this system populate the display.

## UI Requirements

Car stats may be displayed in:
- **Pre-race screen:** Show the player's car stats vs. the grid average. 6 bars or numbers.
- **Garage/team screen:** Full stat breakdown for a selected team.
- **Post-race results:** Optional stat comparison (player car vs. winner's car).

Display format: 6 stat names with bar fills or numeric values. No formula details exposed to player — just the stat name and relative strength (bar fill or number).

> **📌 UX Flag — Car Definition Data**: This system has UI requirements. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for the pre-race stat display before writing epics.

## Acceptance Criteria

- **GIVEN** a car definition with Top Speed stat at 4, **WHEN** the fixed MVP max_velocity formula is applied with min 250 km/h, **THEN** the result is 262 km/h ± 0.1.
- **GIVEN** a car definition with Top Speed stat at 20, **WHEN** the max_velocity formula is applied at any difficulty, **THEN** the result is exactly 310 km/h.
- **GIVEN** a car definition with Acceleration stat at 4, **WHEN** the accel_time formula is applied, **THEN** the result is 4.4 seconds ± 0.01.
- **GIVEN** a car definition with Acceleration stat at 20, **WHEN** the accel_time formula is applied, **THEN** the result is exactly 2.0 seconds.
- **GIVEN** a car definition with Brake Power stat at 4, **WHEN** the brake_distance formula is applied, **THEN** the result is 70 meters ± 0.1.
- **GIVEN** a car definition with Brake Power stat at 20, **WHEN** the brake_distance formula is applied, **THEN** the result is exactly 30 meters.
- **GIVEN** a car definition with Grip Level stat at 4, **WHEN** the cornering_speed formula is applied, **THEN** the result is 136 km/h ± 0.1.
- **GIVEN** a car definition with Grip Level stat at 20, **WHEN** the cornering_speed formula is applied, **THEN** the result is exactly 200 km/h.
- **GIVEN** a car definition with Stability stat at 4, **WHEN** the control_threshold formula is applied, **THEN** the result is 0.2 ± 0.001.
- **GIVEN** a car definition with Stability stat at 20, **WHEN** the control_threshold formula is applied, **THEN** the result is exactly 1.0.
- **GIVEN** a car definition with Efficiency stat at 4, **WHEN** efficiency_modifier is evaluated, **THEN** the result is 0.90 ± 0.001.
- **GIVEN** a car definition with Efficiency stat at 20, **WHEN** efficiency_modifier is evaluated, **THEN** the result is 0.50 ± 0.001.
- **GIVEN** any of the 16 team car definitions, **WHEN** stat values are inspected, **THEN** every stat is one of {4, 8, 12, 16, 20}.
- **GIVEN** any of the 16 team car definitions, **WHEN** the stat count is verified, **THEN** exactly 6 stats exist (Top Speed, Acceleration, Brake Power, Grip Level, Stability, Efficiency).
- **GIVEN** any of the 16 team car definitions, **WHEN** the audio profile is validated, **THEN** `engine_cylinders` is an integer from 6–12 and `engine_type` is a non-empty project-defined identifier.
- **GIVEN** a team definition without audio-profile overrides, **WHEN** the asset is loaded, **THEN** it uses `engine_cylinders = 10` and `engine_type = V10` without changing any racing stat.
- **GIVEN** the 16 team car definitions across 4 tiers, **WHEN** the average stat per tier is computed, **THEN** each tier differs from adjacent tiers by approximately 2–4 points (T1→T2 and T2→T3 are ~3–3.5 points; T3→T4 is ~2 points).
- **GIVEN** a car definition with any valid stat, **WHEN** the weight value is read, **THEN** it is exactly 505 kg.
- **GIVEN** a car definition with a stat value outside 0-20 or non-multiple of 4, **WHEN** the system processes the definition, **THEN** the stat is clamped to the nearest valid value {4, 8, 12, 16, 20}.
- **GIVEN** a car definition with a missing or null stat field, **WHEN** the system processes the definition, **THEN** a default value of 12 (midpoint) is used and a warning is logged.
- **GIVEN** a car definition with Top Speed stat at 16, **WHEN** the fixed MVP max_velocity formula is applied with min 250 km/h, **THEN** the result is 298 km/h ± 0.1 and is identical at every difficulty.
- **GIVEN** a car definition with corrupted numeric data (e.g., stat = -5 or stat = 25), **WHEN** the system processes the definition, **THEN** the value is clamped to the valid range [4, 20] and normalized to the nearest increment of 4.

## Open Questions

- **Stat display language:** Should stats be shown as raw numbers (0-20), bar fills (visual), or both? Bar fills are more accessible; numbers are more precise.
- **Hidden stats:** Should some stats be hidden from the player initially and revealed through gameplay? (e.g., Efficiency not shown until the player learns fuel/tire management)
- **Stat comparison UI:** Should the player see a direct comparison (their car vs. rival's car) before a race? Or just their own stats?
- **Dynamic stat changes:** In Alpha (career mode), should stats change slightly based on car condition (e.g., worn tires reduce effective Grip Level)? Or is Grip Level always the base value?
- **Stat visualization in race:** Should the HUD show the car's current effective stats (e.g., "Grip: 16" degraded to "Grip: 12" due to tire wear)? Or just the bars?
