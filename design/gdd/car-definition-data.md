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
- `team_tier4_d`: Top Speed 6, Acceleration 6, Brake Power 4, Grip Level 12, Stability 12, Efficiency 8

Complete distribution (stats are integers 0–20, physics-derived; authoritative values in `design/registry/entities.yaml`):

| Team ID | Top Speed | Accel | Brake | Grip | Stability | Eff |
|---------|-----------|-------|-------|------|-----------|-----|
| `team_tier1_a` | 20 | 20 | 16 | 20 | 20 | 20 |
| `team_tier1_b` | 20 | 20 | 20 | 16 | 20 | 20 |
| `team_tier1_c` | 17 | 19 | 20 | 16 | 16 | 16 |
| `team_tier1_d` | 15 | 17 | 20 | 20 | 20 | 20 |
| `team_tier2_a` | 11 | 14 | 16 | 16 | 16 | 16 |
| `team_tier2_b` | 11 | 14 | 20 | 16 | 12 | 16 |
| `team_tier2_c` | 8 | 11 | 16 | 16 | 16 | 16 |
| `team_tier2_d` | 11 | 14 | 16 | 12 | 12 | 12 |
| `team_tier3_a` | 8 | 11 | 12 | 12 | 12 | 12 |
| `team_tier3_b` | 8 | 11 | 8 | 12 | 8 | 8 |
| `team_tier3_c` | 8 | 11 | 16 | 16 | 16 | 16 |
| `team_tier3_d` | 8 | 11 | 8 | 12 | 8 | 8 |
| `team_tier4_a` | 8 | 11 | 8 | 12 | 12 | 8 |
| `team_tier4_b` | 8 | 11 | 8 | 12 | 8 | 8 |
| `team_tier4_c` | 8 | 11 | 8 | 8 | 8 | 8 |
| `team_tier4_d` | 6 | 6 | 4 | 12 | 12 | 8 |

**Design rationale:**
- Tier gap: ~3–4.5-point drop between adjacent tiers (T1→T2 ~4.5, T2→T3 ~3, T3→T4 ~2; noticeable but not insurmountable)
- Within-tier spread: 1-3 points (teams feel different but tier identity is clear)
- Each team has a distinct profile (e.g., `team_tier1_c` trades top speed for grip/efficiency, `team_tier2_b` trades brakes for speed/accel)

**3. Weight Mechanics**

Weight is a constant (505 kg) for all cars. It exists for physics calculations (acceleration force, braking distance) but does not differentiate teams. All cars share the same mass.

**4. Stat-to-Behavior Mapping**

Stats are consumed by Vehicle Physics via range-based formulas. See Section D for full formulas with variable tables. Summary:

| Stat | Formula Pattern | Inverted? | Effect |
|------|----------------|-----------|--------|
| Top Speed | `300 + stat × 2.0` | No | Higher = faster on straights |
| Acceleration | `t300 rank (0→300 km/h time)` | No | Higher = faster acceleration (metric, not formula) |
| Brake Power | `min + ((20-stat)/20) × (max-min)` | Yes | Higher = shorter stopping distance |
| Grip Level | `% of own vmax (gripLow→gripHigh)` | No | Higher = faster cornering |
| Stability | `stat / 20` | No | Higher = harder to lose control (slip-only) |
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

Serialized backing fields: `_teamId` (string), `_stats` (CarStats: six ints 0–20), `_audioProfile` (CarAudioProfile — see ADR-0012), `_teamColor` (opaque Color), and `_cockpitOffset` (Vector3 in meters). Public read-only properties expose `TeamId`, derived-and-validated `Tier`, `Stats`, `AudioProfile`, `TeamColor`, and `CockpitOffset`. Vehicle mass is the global 505 kg Vehicle Physics constant, not per-car content. Audio consumes `AudioProfile` without duplicating ownership.

### CarAudioProfile (from ADR-0012)

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `EngineCylinders` | int | 8, 10, 12 | Engine cylinder count (V8/V10/V12) |
| `EngineBasePitch` | float | 0.8–1.2 | Engine character pitch multiplier |
| `ExhaustNote` | enum | Standard, Deep, Sharp | Timbre variant for procedural engine |

The `engineType` (string) field is removed — replaced by structured `CarAudioProfile`. MVP default: `EngineCylinders = 10`, `EngineBasePitch = 1.0`, `ExhaustNote = Standard`.

Loading: Addressables group `Cars/` — loaded per-race based on grid composition.

**6. Interface Contract**

| Data Field | Type | Range | Consuming System |
|------------|------|-------|-----------------|
| `TeamId` | string | `team_tier{N}_{a-d}` | Race, UI, Save/Load |
| `Tier` | int | 1–4, derived from `TeamId` | Matchmaking, Difficulty |
| `Stats.TopSpeed` | int | 0–20 | Vehicle Physics → max velocity |
| `Stats.Acceleration` | int | 0–20 | Vehicle Physics → force/throttle curve |
| `Stats.BrakePower` | int | 0–20 | Vehicle Physics → deceleration rate |
| `Stats.GripLevel` | int | 0–20 | Vehicle Physics → lateral friction |
| `Stats.Stability` | int | 0–20 | Vehicle Physics → loss-of-control threshold |
| `Stats.Efficiency` | int | 0–20 | Fuel → consumption rate, Tire → wear rate |
| `AudioProfile.EngineCylinders` | int | 8, 10, 12 | Audio → procedural engine frequency |
| `AudioProfile.EngineBasePitch` | float | 0.8–1.2 | Audio → engine pitch multiplier |
| `AudioProfile.ExhaustNote` | enum | Standard, Deep, Sharp | Audio → engine character |
| `TeamColor` | Color | opaque team identity | HUD → track-map dots; livery accent |
| `CockpitOffset` | Vector3 | meters | Camera → cockpit POV offset |

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
| **Audio** | Outbound | `engine_cylinders`, `exhaust_note` (CarAudioProfile) | Supplies the procedural engine profile |
| **Settings** | Not consumed at runtime | Difficulty | Difficulty changes AI competence, not car-definition stat formulas |

## Formulas

All formulas use a stat value (0–20) to position the car within a defined range. **Current live values (prototype 2026-08-04):** stats in `design/registry/entities.yaml`, physics in `prototypes/race-feel/engine-data.md`. Production values land in `Assets/Data/Cars/CarConfig.asset` (ScriptableObject). This section documents the formula structure and safe tuning ranges — not the exact numbers used in builds.

### Top Speed

The **max_velocity** formula is defined as:

`max_velocity = 300 + stat × 2.0`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| stat | top_speed | int | 0–20 | Car's Top Speed stat |

**Output Range:** 300–340 km/h (2 km/h per stat point); Difficulty does not alter this formula. This is the THEORETICAL ceiling (vmax_th) — the practical top speed is vmax_th − 2 km/h (quadratic drag asymptote, see vehicle-physics.md); no car ever reaches the theoretical ceiling.

**Example:** stat 20 = 340 km/h (McLaren, Ferrari). stat 17 = 334 km/h (Williams). stat 15 = 330 km/h (Benetton). stat 6 = 312 km/h (Zakspeed).

### Acceleration

The Acceleration stat is the **rank of the 0→300 km/h time** (t300), computed
by integrating the real-engine physics (P/m power curve + quadratic drag, see
vehicle-physics.md). It is a **measured metric, not a formula** — the physics
comes first (P/m per engine), the stat is the resulting rank. Changing the
stat does NOT change the physics; the physics defines the stat (user decision
2026-08-04: formulas are fixed, the stat recalcuates the car's values).

**Why 0→300, not 0→100 or 0→vmax:** 0-100 is identical for all cars
(traction-limited at 13.5 m/s² → 2.11 s for every car); 0→vmax punishes
high-top-speed cars (the drag asymptote makes a 340 km/h car take longer to
reach its own ceiling than a 316 km/h car takes to reach its). A fixed 300
km/h reference keeps the metric comparable across cars while covering the
high-speed band where engine power differentiates.

**Current rank (16 teams, 2026-08-04):** McLaren/Ferrari 20 (t300 8.58/8.59s),
Williams 19 (8.87), Benetton 17 (9.13), Judd ×3 14 (9.74), DFR ×9 11 (10.37),
Zakspeed 6 (11.38). Full table: `prototypes/race-feel/engine-data.md`.

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

Grip is defined as a **percentage of the car's own vmax** it can sustain in a
70 m-radius corner while accelerating (the oval prototype reference):

`pct = (gripLow + (gripHigh − gripLow) × (stat / 20)) / 100`   [fraction 0–1]

`maxLateralG = (pct × vmax / 3.6)² / (9.81 × 70)`

⚠️ **gripLow/gripHigh are PERCENTAGES (50–90); the ÷100 converts to a fraction
(0.50–0.90) before the physical conversion.** Skipping it multiplies g by 100×
(implementation trap found during GR validation 2026-08-04).

**Player reading:** GR is the % of the car's OWN top speed it holds through the
reference corner — GR 20 = 90% of vmax, GR 4 = 58%. Grip scales with the car's
speed: a faster car with the same GR needs more lateral g to hold the same
percentage.

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| gripLow | — | float | 50% (default) | Grip % for stat 0 — global calibration knob |
| gripHigh | — | float | 90% (default) | Grip % for stat 20 — global calibration knob |
| stat | grip_level | int | 0–20 | Car's Grip Level stat |
| vmax | — | km/h | 300-340 | Car's top speed (Top Speed formula) |

**Output Range:** 50-90% of the car's own vmax (sustained cornering speed in
the 70 m reference corner). Vehicle Physics consumes the result as `grip_base`
(maxLateralG) in its effective_grip multiplicative stack.

**Validated table (16 teams, 2026-08-04):**
| Team | GR | vmax | pct | cornering @70m | maxLateralG |
|------|----|------|-----|----------------|-------------|
| 1a McLaren | 20 | 340 | 90% | 306.0 km/h | 10.52g |
| 1b Ferrari | 16 | 340 | 82% | 278.8 km/h | 8.73g |
| 1c Williams | 16 | 334 | 82% | 273.9 km/h | 8.43g |
| 1d Benetton | 20 | 330 | 90% | 297.0 km/h | 9.91g |
| 2a March | 16 | 322 | 82% | 264.0 km/h | 7.83g |
| 2b Lotus | 16 | 322 | 82% | 264.0 km/h | 7.83g |
| 2c Tyrrell | 16 | 316 | 82% | 259.1 km/h | 7.54g |
| 2d Brabham | 12 | 322 | 74% | 238.3 km/h | 6.38g |
| 3a Minardi | 12 | 316 | 74% | 233.8 km/h | 6.14g |
| 3b Ligier | 12 | 316 | 74% | 233.8 km/h | 6.14g |
| 3c Dallara | 16 | 316 | 82% | 259.1 km/h | 7.54g |
| 3d Arrows | 12 | 316 | 74% | 233.8 km/h | 6.14g |
| 4a Rial | 12 | 316 | 74% | 233.8 km/h | 6.14g |
| 4b Coloni | 12 | 316 | 74% | 233.8 km/h | 6.14g |
| 4c Onyx | 8 | 316 | 66% | 208.6 km/h | 4.89g |
| 4d Zakspeed | 12 | 312 | 74% | 230.9 km/h | 5.99g |

**Examples (2026-08-04):** GR 20 → 90% of vmax (McLaren: 306 km/h in the
oval = 10.5g). GR 12 → 74% (Zakspeed: 231 km/h = 6.0g). GR 8 → 66% (Onyx:
209 km/h = 4.9g).

### Stability

The **control_threshold** formula is defined as:

`control_threshold = stat / 20`

**Role (validated 2026-08-04):** Stability modulates SLIP behavior only — it
is NOT part of the cornering grip stack. Cornering capacity is exclusively the
Grip Level stat's domain. Control threshold affects:
- slide threshold: `0.25 × max(control_threshold, 0.2)`
- recovery rate: `gripAlignRate × control_threshold` (gripAlignRate = 8.0 rad/s, global)
- slide speed loss: `driftSpeedLoss × (2 − control_threshold)` (driftSpeedLoss = 2.5 m/s², global)

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| stat | stability | int | 0–20 | Car's Stability stat |

**Output Range:** 0.2–1.0 (dimensionless for valid stat values 4–20). Higher = slides later, recovers faster, loses less speed while sliding.
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
- **All stats at minimum (stat = 4):** Car is slower (308 km/h max, ~11.4s 0-300, 70m braking). Still drivable — the floor is set so the game remains playable.
- **All stats at maximum (stat = 20):** Car is very fast (340 km/h max, ~8.6s 0-300, 30m braking). This is the ceiling — no car exceeds this.
- **Efficiency formula at stat 20:** `1 - 20 × 0.025 = 0.5` → 50% of base consumption. At stat 0 (if corrupted): `1 - 0 × 0.025 = 1.0` → 100% of base. The formula is safe at all valid stat values.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Vehicle Physics** | Outbound | Stats → motion formulas | Hard — car doesn't move without stats |
| **Fuel** | Outbound | Efficiency → consumption rate | Hard — fuel system needs base rate |
| **Tire** | Outbound | Efficiency → wear rate | Hard — tire system needs base rate |
| **AI Rival** | Outbound | All 6 stats → AI performance | Hard — AI ceiling defined by stats |
| **Content Pipeline** | Outbound | TeamId → asset path | Hard — loads correct car assets |
| **Settings** | Not consumed at runtime | Difficulty selection | Soft — AI consumes difficulty; Car Definition formulas remain fixed |
| **Race Session Manager** | Outbound | TeamId → grid composition | Hard — race needs to know which cars are on grid |
| **HUD** | Outbound | TeamColor | Hard — cosmetic theming |
| **VFX** | Outbound | Per-car `max_velocity` (derives `global_max_velocity`) | Hard — normalizes speed effects |

## Tuning Knobs

All values below are serialized fields in `CarConfig.asset` (ScriptableObject). Designers adjust these in the Unity Inspector during playtesting — no code changes required.

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Top Speed max | 340 km/h | 320–360 | Cars feel slow | Cars feel uncontrollable |
| Top Speed min (Normal) | 300 km/h | 290–310 | Worst car is too slow | No speed difference between cars |
| Acceleration min | 8.6 s (t300) | 8.0–9.5 s | Cars feel instant (no skill) | Cars feel sluggish |
| Acceleration max | 11.4 s (t300) | 10.5–13.0 s | Still too fast for worst car | Worst car can't keep up |
| Brake min | 30 m | 25–40 m | Brakes feel like teleportation | No risk in braking late |
| Brake max | 80 m | 60–100 m | Still manageable | Can't stop for corners |
| Grip min | 50% of vmax | 40–60% | Uncontrollable in corners | Cornering too easy |
| Grip max | 90% of vmax | 80–100% | Best car can't corner | Unrealistic for arcade |
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

- **GIVEN** a car definition with Top Speed stat at 4, **WHEN** the max_velocity formula (300 + stat×2) is applied, **THEN** the result is 308 km/h ± 0.1.
- **GIVEN** a car definition with Top Speed stat at 20, **WHEN** the max_velocity formula is applied at any difficulty, **THEN** the result is exactly 340 km/h.
- **GIVEN** a car definition with Acceleration stat at 4, **WHEN** the t300 metric (0→300 km/h) is evaluated, **THEN** the rank is bottom (Zakspeed reference: 11.38s).
- **GIVEN** a car definition with Acceleration stat at 20, **WHEN** the t300 metric is evaluated, **THEN** the rank is top (McLaren/Ferrari reference: 8.58/8.59s).
- **GIVEN** a car definition with Brake Power stat at 4, **WHEN** the brake_distance formula is applied, **THEN** the result is 70 meters ± 0.1.
- **GIVEN** a car definition with Brake Power stat at 20, **WHEN** the brake_distance formula is applied, **THEN** the result is exactly 30 meters.
- **GIVEN** a car definition with Grip Level stat at 4, **WHEN** the grip % formula (gripLow→gripHigh, defaults 50/90) is applied, **THEN** the result is pct = 58% of the car's own vmax.
- **GIVEN** a car definition with Grip Level stat at 20, **WHEN** the grip % formula is applied, **THEN** the result is exactly 90% of the car's own vmax.
- **GIVEN** a car definition with Stability stat at 4, **WHEN** the control_threshold formula is applied, **THEN** the result is 0.2 ± 0.001.
- **GIVEN** a car definition with Stability stat at 20, **WHEN** the control_threshold formula is applied, **THEN** the result is exactly 1.0.
- **GIVEN** a car definition with Efficiency stat at 4, **WHEN** efficiency_modifier is evaluated, **THEN** the result is 0.90 ± 0.001.
- **GIVEN** a car definition with Efficiency stat at 20, **WHEN** efficiency_modifier is evaluated, **THEN** the result is 0.50 ± 0.001.
- **GIVEN** any of the 16 team car definitions, **WHEN** stat values are inspected, **THEN** every stat is an integer in 0–20.
- **GIVEN** any of the 16 team car definitions, **WHEN** the stat count is verified, **THEN** exactly 6 stats exist (Top Speed, Acceleration, Brake Power, Grip Level, Stability, Efficiency).
- **GIVEN** any of the 16 team car definitions, **WHEN** the audio profile is validated, **THEN** `engine_cylinders` is an integer from 6–12 and `exhaust_note` is one of the defined enum values (Standard, Deep, Sharp).
- **GIVEN** a team definition without audio-profile overrides, **WHEN** the asset is loaded, **THEN** it uses `engine_cylinders = 10` and `exhaust_note = Standard` without changing any racing stat.
- **GIVEN** the 16 team car definitions across 4 tiers, **WHEN** the average stat per tier is computed, **THEN** each tier differs from adjacent tiers by approximately 2–4.5 points (T1→T2 ~4.5, T2→T3 ~3, T3→T4 ~2).
- **GIVEN** a car definition with any valid stat, **WHEN** the weight value is read, **THEN** it is exactly 505 kg.
- **GIVEN** a car definition with a stat value outside 0-20, **WHEN** the system processes the definition, **THEN** the stat is clamped to the nearest integer in [0, 20].
- **GIVEN** a car definition with a missing or null stat field, **WHEN** the system processes the definition, **THEN** a default value of 12 (midpoint) is used and a warning is logged.
- **GIVEN** a car definition with Top Speed stat at 16, **WHEN** the max_velocity formula (300 + stat×2) is applied, **THEN** the result is 332 km/h ± 0.1 and is identical at every difficulty.
- **GIVEN** a car definition with corrupted numeric data (e.g., stat = -5 or stat = 25), **WHEN** the system processes the definition, **THEN** the value is clamped to the valid range [0, 20] and normalized to the nearest integer.

## Open Questions

- **Stat display language:** Should stats be shown as raw numbers (0-20), bar fills (visual), or both? Bar fills are more accessible; numbers are more precise.
- **Hidden stats:** Should some stats be hidden from the player initially and revealed through gameplay? (e.g., Efficiency not shown until the player learns fuel/tire management)
- **Stat comparison UI:** Should the player see a direct comparison (their car vs. rival's car) before a race? Or just their own stats?
- **Dynamic stat changes:** In Alpha (career mode), should stats change slightly based on car condition (e.g., worn tires reduce effective Grip Level)? Or is Grip Level always the base value?
- **Stat visualization in race:** Should the HUD show the car's current effective stats (e.g., "Grip: 16" degraded to "Grip: 12" due to tire wear)? Or just the bars?
