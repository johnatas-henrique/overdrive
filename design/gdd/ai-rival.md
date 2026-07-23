# AI Rival

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-22
> **Implements Pillar**: Rivals Make the Grid Personal

## Overview

**AI Rival** controls the 15 AI opponents during races. In MVP, AI drivers have distinct car stats (from Car Definition Data) and basic racing behavior: follow optimal line, avoid collisions, vary pace by tier. No persistent memory, no confidence system, no named rival tracking — each race is standalone. The system creates competitive races where Tier 1 cars are faster and more consistent, while Tier 4 cars are slower and more error-prone. The player's experience is "16 cars on grid, each driving differently." Alpha adds persistent rival memory and behavioral changes.

## Player Fantasy

**Framing:** Both — AI is infrastructure (behind the scenes) but player experiences the effects directly (rivals on track).

**Emotional target:** One layer for MVP:

1. **The Grid Feels Alive (16 distinct drivers):** Each car on the grid drives differently. Tier 1 cars are precise and fast. Tier 4 cars are slower and make more mistakes. You can feel the difference between racing against Madonna and racing against Zeroforce. The grid isn't 15 copies of the same AI — it's 15 individuals with different capabilities. Anchor: lap 3, you're fighting for P8 — the car ahead is a Tier 3, you know they're slower than you in corners but faster on straights. You plan your overtake.

**Pillar alignment:** Rivals Make the Grid Personal — even in MVP, each car feels distinct through stats and behavior. Every Short Race Matters — competitive grid makes every position fight meaningful.

**Design test:** Can the player tell the difference between racing against a Tier 1 car and a Tier 4 car without looking at the HUD?

## Detailed Design

### Core Rules

**1. AI Decision Loop**

Every physics tick (60 Hz), each AI agent executes:
1. Read car state (speed, position, grip, fuel, tire)
2. Evaluate current state behavior
3. Generate inputs (steer, throttle, brake)
4. Apply error/noise layer
5. Output to Vehicle Physics

**2. Target Speed Formula**

`target_speed = base_speed × state_modifier × personality_modifier × error_noise`

| Variable | Type | Range | Description |
|----------|------|-------|-------------|
| base_speed | float | 0–310 km/h | Car's max velocity from Car Definition Data, scaled by difficulty |
| state_modifier | float | 0.7–1.1 | Depends on current state |
| personality_modifier | float | 0.95–1.05 | Per-archetype adjustment |
| error_noise | float | 0.97–1.03 | Random per-frame noise from error generation |

**3. Racing Line Following**

AI follows a reference spline (one per track). At each frame:

`steer_input = clamp(racing_line_offset × steer_gain × grip_modifier, -1, 1)`

| State | Line Offset | Rationale |
|-------|-------------|-----------|
| Racing | 0.0 (optimal line) | Follow the fastest path |
| Overtaking | -0.3 to -0.5 (inside) | Move inside to pass |
| Defending | +0.2 to +0.4 (inside of defender) | Protect the inside line |
| Recovering | 0.0 (optimal line) | Return to racing line |
| Pitting | -1.0 (far inside → pit entry) | Commit to pit lane |

**4. Overtaking Logic**

Activates when: car ahead within 100m AND speed advantage > 5% AND AI in Racing state.

`overtake_probability = min(1.0, (speed_advantage / 0.15) × aggression_factor)`

| Variable | Range | Description |
|----------|-------|-------------|
| speed_advantage | 0.0–0.3 | (AI_speed - ahead_speed) / AI_speed |
| aggression_factor | 0.5–1.5 | Per-archetype |

Overtaking lasts until: pass complete, advantage < 1%, or 5s timeout.

**5. Defending Logic**

Activates when: car behind within 80m AND threat speed > 3% AND AI in Racing state.

`defend_probability = min(1.0, (threat_speed / 0.10) × defensiveness_factor)`

Defending lasts until: threat recedes > 100m, AI falls behind, or 3s timeout.

**6. Error Generation**

Error is per-frame noise added to AI inputs. Three components:

| Component | Formula | Description |
|-----------|---------|-------------|
| Steering noise | `random_range(-error_amplitude, +error_amplitude)` | Lateral deviation |
| Brake offset | `random_range(-brake_error_m, +brake_error_m)` | Braking point error (meters) |
| Throttle modulation | `random_range(-throttle_error_pct, +throttle_error_pct)` | Throttle variance |

| Archetype | error_amplitude | brake_error_m | throttle_error_pct |
|-----------|----------------|---------------|-------------------|
| Consistent | 0.04 | 2.5 m | 2.5% |
| Aggressive | 0.03 | 2.0 m | 2% |
| Inconsistent | 0.10 | 6.0 m | 5% |
| Cautious | 0.02 | 1.5 m | 1.5% |

**7. Pit Strategy**

AI pits when fuel < 40% OR tire < 30%.

`pit_probability = base_pit_chance × urgency_factor × personality_modifier`

Urgency: `1.0 + (1.0 - current_level / threshold_level) × 2.0`

### States and Transitions

| State | Behavior | Speed Modifier | Line Offset |
|-------|----------|---------------|-------------|
| **Racing** | Follow optimal line | 1.00 | 0.0 |
| **Overtaking** | Move inside, push to pass | 1.03 | -0.4 |
| **Defending** | Protect inside line | 1.01 | +0.3 |
| **Recovering** | Return to racing line | 0.85 | 0.0 |
| **Pitting** | Enter pit lane, stop | N/A | -1.0 |
| **Finished** | Cross finish line, coast | 0.0 | 0.0 |

**Priority order:** Finished > Pitting > Recovering > Overtaking/Defending

### Car Stats → AI Behavior Mapping

| Stat | AI Behavior Effect | Formula |
|------|-------------------|---------|
| **Top Speed** | Sets base_speed | `base_speed = max_velocity(stat, difficulty)` |
| **Acceleration** | Corner exit speed | `exit_speed_mult = 0.95 + (stat / 20) × 0.05` |
| **Brake Power** | Braking aggression | `brake_threshold = 1.0 - (stat / 20) × 0.15` |
| **Grip Level** | Cornering commitment | `cornering_confidence = stat / 20` |
| **Stability** | Error resistance | `error_resistance = stat / 20` |
| **Efficiency** | Pit timing | `pit_threshold_modifier = 1.0 - (stat / 20) × 0.1` |

### Difficulty Scaling

| Level | Precision | Error Mult | Speed Variance | Tier Gap |
|-------|-----------|-----------|----------------|----------|
| Very Easy | 90% | 1.5× | ±8% | 5% |
| Easy | 95% | 1.2× | ±5% | 15% |
| Normal | 100% | 1.0× | ±2% | 25% |
| Hard | 100% | 0.5× | ±0% | 40% |
| Very Hard | 100% | 0.0× | ±0% | 60% |

### Personality Archetypes

| Archetype | Error Rate | Overtake | Defend | Pit Timing |
|-----------|-----------|----------|--------|------------|
| **Consistent** | -20% | 1.0× | 1.0× | Standard |
| **Aggressive** | +10% | 1.3× | 1.4× | Late (0.7×) |
| **Inconsistent** | +40% | 0.7–1.3× | 0.6–1.2× | Variable |
| **Cautious** | -40% | 0.6× | 0.5× | Early (1.3×) |

**Grid composition:** 4 Consistent, 4 Aggressive, 4 Inconsistent, 3 Cautious

**Team archetype assignment:**

| Team ID | Archetype |
|---------|-----------|
| team_tier1_a | Consistent |
| team_tier1_b | Consistent |
| team_tier1_c | Inconsistent |
| team_tier1_d | Cautious |
| team_tier2_a | Consistent |
| team_tier2_b | Aggressive |
| team_tier2_c | Inconsistent |
| team_tier2_d | Aggressive |
| team_tier3_a | Cautious |
| team_tier3_b | Aggressive |
| team_tier3_c | Cautious |
| team_tier3_d | Consistent |
| team_tier4_a | Inconsistent |
| team_tier4_b | Cautious |
| team_tier4_c | Aggressive |
| team_tier4_d | Inconsistent |

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Vehicle Physics** | Outbound | Throttle, brake, steer inputs | AI drives same physics as player |
| **Track** | Inbound | Racing line spline, boundaries | AI follows track geometry |
| **Fuel** | Bidirectional | Fuel level, consumption | AI consumes fuel, decides pit |
| **Tire** | Bidirectional | Tire wear, grip | AI degrades tires, decides pit |
| **Settings** | Inbound | Difficulty level | Scales AI behavior |
| **Car Definition Data** | Inbound | 6 stats per car | Determines AI capabilities |
| **Qualifying** | Inbound | AI qualifying times | Pre-generated before race |
| **HUD** | Outbound | Rival gap, position | Player sees AI state |

## Formulas

**Current live values:** see AI configuration (ScriptableObject `AIBehaviorProfile`).

### Target Speed

`target_speed = base_speed × state_modifier × personality_modifier × error_noise`

**Output Range:** 0.7 × base_speed to 1.1 × base_speed (clamped to car's max).

### Overtake Probability

`overtake_probability = min(1.0, (speed_advantage / 0.15) × aggression_factor)`

**Output Range:** 0.0 to 1.0.

### Defend Probability

`defend_probability = min(1.0, (threat_speed / 0.10) × defensiveness_factor)`

**Output Range:** 0.0 to 1.0.

### Pit Probability

`pit_probability = base_pit_chance × urgency_factor × personality_modifier`

**Output Range:** 0.0 to 1.0 per frame.

## Edge Cases

- **If AI runs out of fuel mid-race:** Car coasts at current speed, no throttle. Engine cuts (per Fuel GDD). AI continues until race ends or reaches pit lane.
- **If AI tire at grip floor (0.20):** AI drives very slowly, high error rate. Still finishes race if possible.
- **If two AI attempt to overtake same car:** Both offset to inside line. May collide — Vehicle Physics handles collision (wall bounce, speed loss).
- **If AI pit stop overlaps with player pit stop:** Both serviced simultaneously (16 pit boxes). No conflict.
- **If AI crashes and blocks track:** AI enters Recovering state, returns to racing line. Other AI navigate around (basic avoidance).
- **If all 15 AI pit on same lap:** All 16 boxes occupied. No conflict — simultaneous service.
- **If difficulty is Very Hard and AI makes 0 errors:** AI drives near-perfect racing line. Player must be skilled to compete.
- **If difficulty is Very Easy and AI makes 10%+ errors:** AI is visibly error-prone. Player can overtake easily.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Vehicle Physics** | Outbound | AI inputs | Hard — AI drives same physics |
| **Track** | Inbound | Racing line, boundaries | Hard — AI follows track |
| **Fuel** | Bidirectional | Fuel level, consumption | Hard — AI pits on threshold |
| **Tire** | Bidirectional | Tire wear, grip | Hard — AI pits on threshold |
| **Settings** | Inbound | Difficulty | Hard — scales AI behavior |
| **Car Definition Data** | Inbound | 6 stats | Hard — determines capabilities |
| **Qualifying** | Inbound | AI qualifying times | Hard — pre-race grid |
| **HUD** | Outbound | Rival gap, position | Soft — player feedback |

## Tuning Knobs

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Overtake threshold | 5% speed advantage | 3–10% | AI overtakes too easily | AI never overtakes |
| Defend threshold | 3% threat speed | 1–5% | AI never defends | AI defends constantly |
| Error base rate | 0.05 | 0.01–0.10 | AI too perfect | AI too error-prone |
| Pit fuel threshold | 40% | 30–50% | AI runs out of fuel | AI pits too early |
| Pit tire threshold | 30% | 20–40% | AI drives on bald tires | AI pits too early |
| Overtake timeout | 5s | 3–10s | AI gives up too fast | AI forces pass too long |

## Visual/Audio Requirements

- **Rival cars:** Each team has distinct livery colors (per art bible). Must be identifiable in pack at speed.
- **Rival audio:** Engine sounds same as player car (procedural RPM). Spatial audio optional (Alpha).
- **Overtake/defend feedback:** No visual indicator of AI state — player reads behavior on track.

## UI Requirements

No UI requirements for this system. AI state is not exposed to player.

## Acceptance Criteria

- **GIVEN** a Tier 1 AI car, **WHEN** racing, **WHEN** target speed is calculated, **THEN** it is approximately 310 km/h (base_speed for Tier 1).
- **GIVEN** a Tier 4 AI car, **WHEN** racing, **WHEN** target speed is calculated, **THEN** it is approximately 240 km/h (base_speed for Tier 4).
- **GIVEN** AI with Aggressive archetype, **WHEN** car ahead within 100m with 8% speed advantage, **WHEN** overtake probability is calculated, **THEN** it is approximately 69%.
- **GIVEN** AI with Cautious archetype, **WHEN** car behind within 80m with 5% threat, **WHEN** defend probability is calculated, **THEN** it is approximately 25%.
- **GIVEN** AI with fuel at 20% (threshold 40%), **WHEN** urgency is calculated, **THEN** urgency_factor is approximately 2.0.
- **GIVEN** Very Easy difficulty, **WHEN** AI error rate is calculated, **THEN** errors are 1.5× base rate.
- **GIVEN** Hard difficulty, **WHEN** AI error rate is calculated, **THEN** errors are 0.5× base rate.
- **GIVEN** AI crosses finish line on final lap, **WHEN** state transition fires, **THEN** AI enters Finished state immediately.

## Open Questions

- **AI racing line generation:** Should the racing line be pre-computed per track (baked spline) or generated dynamically? Pre-computed is simpler but requires art pass per track.
- **AI collision avoidance:** Should AI actively avoid other cars, or rely on Vehicle Physics collision? Active avoidance is more realistic but adds complexity.
- **AI pit visibility:** Should the player see AI pit stops (cars entering/exiting pit lane)? Or are AI pit stops hidden?
- **AI personality visibility:** Should the HUD show which archetype each rival has? Or is it purely behavioral?
- **AI error visual feedback:** When AI makes an error, should there be visible tire smoke, wide line, or other visual cues? Or is it purely speed-based?
