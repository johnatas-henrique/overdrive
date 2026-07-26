# AI Rival

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Rivals Make the Grid Personal

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Per-race AI archetypes, racing decisions, pace, overtakes, errors, and pit strategy without persistence. |
| MVP architecture constraints | AI decisions use explicit race state and can accept later persistent rival inputs. |
| Alpha | Basic rival memory, confidence-based behavioral changes, and active obstacle avoidance. |
| Beta | Expanded rival memory and career consequences. |
| Release | Advanced rival memory. |

### Review Boundary
Persistent rival behavior is non-blocking unless MVP AI interfaces cannot accept future state.

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

Every physics tick (60 Hz), each AI agent reads the immutable final `PublishedSimulationSnapshot` from tick N, evaluates behavior and deterministic PCG32 error/noise using `(race_seed, car_id, simulationStepCount)`, then writes cached `AIInput` for tick N+1. Vehicle Physics consumes that cached input on the next tick; AI never partially changes the world state it just observed.

**2. Target Speed Formula**

`target_speed = base_speed × state_modifier × personality_modifier × pace_noise × error_noise`

| Variable | Type | Range | Description |
|----------|------|-------|-------------|
| base_speed | float | 0–310 km/h | Car's max velocity from Car Definition Data; difficulty does not multiply it |
| state_modifier | float | 0.7–1.1 | Depends on current state |
| personality_modifier | float | 0.95–1.05 | Per-archetype adjustment |
| pace_noise | float | 0.92–1.08 | Deterministic difficulty-specific pace variation per tick around the car's base speed |
| error_noise | float | 0.97–1.03 | Deterministic per-tick noise from error generation |

**3. Racing Line Following**

AI follows a reference spline (one per track). At each simulation tick:

`steer_input = clamp(racing_line_offset_normalized × steer_gain × grip_modifier, -1, 1)`

| State | Line Offset | Rationale |
|-------|-------------|-----------|
| Racing | 0.0 normalized track-width offset | Follow the fastest path |
| Overtaking | -0.3 to -0.5 normalized offset | Move inside to pass |
| Defending | +0.2 to +0.4 normalized offset | Protect the inside line |
| Recovering | 0.0 normalized offset | Return to racing line |
| Pitting | Pit spline supplied by Track | Commit to pit lane |

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

Error is per-tick noise added to AI inputs. Three components:

| Component | Formula | Description |
|-----------|---------|-------------|
| Steering noise | `random_range(-error_amplitude, +error_amplitude) × DifficultyProfile.ai_error_multiplier` | Lateral deviation |
| Brake offset | `random_range(-brake_error_m, +brake_error_m) × DifficultyProfile.ai_error_multiplier` | Braking point error (meters) |
| Throttle modulation | `random_range(-throttle_error_pct, +throttle_error_pct) × DifficultyProfile.ai_error_multiplier` | Throttle variance |

| Archetype | error_amplitude | brake_error_m | throttle_error_pct |
|-----------|----------------|---------------|-------------------|
| Consistent | 0.04 | 2.5 m | 2.5% |
| Aggressive | 0.03 | 2.0 m | 2% |
| Inconsistent | 0.10 | 6.0 m | 5% |
| Cautious | 0.02 | 1.5 m | 1.5% |

**7. Pit Strategy**

After completing lap 1, AI uses that lap's measured Fuel consumption and Tire wear to forecast the next lap. Before beginning a non-final next lap, it commits to the pit-lane route when post-current-lap Fuel or Tire life cannot cover `1.10 × predicted_next_lap_resource`. It never commits to pit entry before lap 1 or before the final lap. Difficulty does not alter this decision. This deterministic projection is the sole pit trigger; no probability or fixed percentage threshold is used.

**8. Collision Recovery**

Vehicle Physics owns collision resolution. AI does not actively evade cars or obstacles in MVP. After a collision or track-blocking incident, the AI enters `Recovering`, applies the `0.85` recovery speed modifier, and returns to the racing line when safe. Active obstacle avoidance is an Alpha extension and does not change the MVP collision contract.

### States and Transitions

| State | Behavior | Speed Modifier | Line Offset |
|-------|----------|---------------|-------------|
| **Racing** | Follow optimal line | 1.00 | 0.0 |
| **Overtaking** | Move inside, push to pass | 1.03 | -0.4 |
| **Defending** | Protect inside line | 1.01 | +0.3 |
| **Recovering** | Return to racing line | 0.85 | 0.0 |
| **Pitting** | Follow Track pit spline, obey 80 km/h cap, navigate assigned box and wait until full tank | 80 km/h cap | Pit spline |
| **Finished** | Cross finish line, coast | 0.0 | 0.0 |

**Priority order:** Finished > Pitting > Recovering > Overtaking/Defending

### Car Stats → AI Behavior Mapping

| Stat | AI Behavior Effect | Formula |
|------|-------------------|---------|
| **Top Speed** | Sets base_speed | `base_speed = max_velocity(stat)` |
| **Acceleration** | Corner exit speed | `exit_speed_mult = 0.95 + (stat / 20) × 0.05` |
| **Brake Power** | Braking aggression | `brake_threshold = 1.0 - (stat / 20) × 0.15` |
| **Grip Level** | Cornering commitment | `cornering_confidence = stat / 20` |
| **Stability** | Error resistance | `error_resistance = stat / 20` |
| **Efficiency** | Indirect pit pressure | Lower Efficiency increases observed Fuel use through Fuel System; it adds no separate pit-timing modifier. |

### DifficultyProfile Scaling

Simulation snapshots one immutable external DifficultyProfile at race initialization. Car stats remain unchanged. AI consumes `ai_precision`, `ai_error_multiplier`, and `pace_noise` during Racing and deterministic Qualifying generation.

| Level | Precision | Error Mult | Pace Noise | Tier Gap |
|-------|-----------|-----------|----------------|----------|
| Very Easy | 90% | 1.5× | ±8% | 5% |
| Easy | 95% | 1.2× | ±5% | 15% |
| Normal | 100% | 1.0× | ±2% | 25% |
| Hard | 100% | 0.5× | ±0% | 40% |
| Very Hard | 100% | 0.0× | ±0% | 60% |

Precision scales racing-line correction. Error Mult scales every deterministic error component above. Pace Noise sets the symmetric target-speed noise range. Tier Gap is an integrated benchmark target, not a direct car-stat multiplier.

### Personality Archetypes

| Archetype | Error Rate | Overtake | Defend |
|-----------|-----------|----------|--------|
| **Consistent** | -20% | 1.0× | 1.0× |
| **Aggressive** | +10% | 1.3× | 1.4× |
| **Inconsistent** | +40% | 0.7–1.3× | 0.6–1.2× |
| **Cautious** | -40% | 0.6× | 0.5× |

**Grid composition:** The roster contains 16 team archetype assignments. At runtime, the player's selected team is excluded from AI control, leaving exactly 15 AI drivers; archetype counts therefore depend on the player's team selection.

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
| **Settings** | Inbound via Simulation | Immutable DifficultyProfile | Scales precision, deterministic error amplitudes, and pace noise for the full race |
| **Car Definition Data** | Inbound | 6 racing stats plus audio profile fields | Determines AI capabilities and provides car identity |
| **Qualifying** | Bidirectional | DifficultyProfile precision/error/pace semantics | Qualifying reuses the same field interpretation; runtime AI does not consume generated times |
| **HUD** | Indirect | Rival gap and position via RSM (AI does not directly write HUD data) | Player sees AI state through RSM-computed values |
| **Simulation Architecture** | Bidirectional | PublishedSimulationSnapshot, cached `AIInput`, tick index | Hard — owns deterministic observation and next-tick input timing |
| **Race Session Manager** | Bidirectional | RaceMode, lap/finish/pit events | Hard — owns race-session context consumed by AI |
| **Grid & Start** | Inbound | GridAssignment and grid transforms | Hard — provides initial car placement |
| **Pit Stop** | Bidirectional | PitPhase and service completion | Hard — AI follows the shared pit service flow |

## Formulas

**Current live values:** see AI configuration (ScriptableObject `AIBehaviorProfile`).

### Target Speed

`target_speed = base_speed × state_modifier × personality_modifier × pace_noise × error_noise`

**Output Range:** `0.7 × 0.95 × 0.92 × 0.955 × base_speed` to `1.1 × 1.05 × 1.08 × 1.045 × base_speed`, then clamped to the car's max velocity.

`pace_noise` is drawn deterministically from `1 ± DifficultyProfile.pace_noise`. If base error noise is in `[-0.03,+0.03]`, `error_noise = 1 + base_error_noise × DifficultyProfile.ai_error_multiplier`, producing `[0.955,1.045]` at Very Easy.

### Racing-Line Precision

`line_correction = base_line_correction × DifficultyProfile.ai_precision`

**Output Range:** 90%–100% of the archetype/car-derived base correction.

### Overtake Probability

`overtake_probability = min(1.0, (speed_advantage / 0.15) × aggression_factor)`

**Output Range:** 0.0 to 1.0.

### Defend Probability

`defend_probability = min(1.0, (threat_speed / 0.10) × defensiveness_factor)`

**Output Range:** 0.0 to 1.0.

### Pit Projection

Pit uses the deterministic remaining-lap resource projection defined by Pit Stop. It has no per-frame probability and no fixed percentage threshold.

## Edge Cases

- **If AI runs out of fuel mid-race:** Car coasts at current speed, no throttle. Engine cuts (per Fuel GDD). AI continues until race ends or reaches pit lane.
- **If AI tire at grip floor (0.20):** AI drives very slowly, high error rate. Still finishes race if possible.
- **If two AI attempt to overtake same car:** Both offset to inside line. May collide — Vehicle Physics handles collision (wall bounce, speed loss).
- **If AI pit stop overlaps with player pit stop:** Both serviced simultaneously (16 pit boxes). No conflict.
- **If AI crashes and blocks track:** Vehicle Physics resolves the collision. The affected AI enters Recovering and returns to the racing line; other AI do not execute active obstacle avoidance in MVP.
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
| **Settings** | Inbound via Simulation | DifficultyProfile | Hard — immutable precision/error/pace fields affect AI competence without changing car stats |
| **Car Definition Data** | Inbound | 6 racing stats plus audio profile fields | Hard — determines capabilities and car identity |
| **Qualifying** | Bidirectional | DifficultyProfile precision/error/pace semantics | Hard — Qualifying reuses the AI field contract without executing runtime AI |
| **HUD** | Indirect | Rival gap and position via RSM (AI does not directly write HUD data) | Soft — player feedback through RSM-computed values |
| **Simulation Architecture** | Bidirectional | Published snapshot, cached `AIInput`, tick index | Hard — owns observation and next-tick timing |
| **Race Session Manager** | Bidirectional | RaceMode, lap/finish/pit events | Hard — owns race-session context |
| **Grid & Start** | Inbound | GridAssignment and grid transforms | Hard — provides initial placement |
| **Pit Stop** | Bidirectional | PitPhase and service completion | Hard — shared pit service flow |

## Tuning Knobs

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Overtake threshold | 5% speed advantage | 3–10% | AI overtakes too easily | AI never overtakes |
| Defend threshold | 3% threat speed | 1–5% | AI never defends | AI defends constantly |
| Error base rate | 0.05 | 0.01–0.10 | AI too perfect | AI too error-prone |
| Pit resource safety margin | 10% next-lap forecast | 0–20% | AI risks empty tank/bald tires | AI pits unnecessarily; Pit Stop's `pit_required_before_next_lap` formula applies the 1.10 multiplier. |
| Overtake timeout | 5s | 3–10s | AI gives up too fast | AI forces pass too long |

## Visual/Audio Requirements

- **Rival cars:** Each team has distinct livery colors (per art bible). Must be identifiable in pack at speed.
- **Rival audio:** Engine sounds same as player car (procedural RPM). Spatial audio optional (Alpha).
- **Overtake/defend feedback:** No visual indicator of AI state — player reads behavior on track.

## UI Requirements

AI exposes no archetype/state UI. Race Session Manager owns the player-facing position and rival-gap values derived from all cars.

## Acceptance Criteria

- **GIVEN** a Tier 1 AI car in Racing state with neutral personality, `pace_noise = 1.0`, and `error_noise = 1.0`, **WHEN** target speed is calculated, **THEN** it is approximately 310 km/h before the max-velocity clamp.
- **GIVEN** a Tier 4 AI car with Top Speed stat 16 in Racing state with neutral personality, `pace_noise = 1.0`, and `error_noise = 1.0`, **WHEN** target speed is calculated, **THEN** it is approximately 298 km/h before the max-velocity clamp.
- **GIVEN** AI with Aggressive archetype, **WHEN** car ahead within 100m with 8% speed advantage, **WHEN** overtake probability is calculated, **THEN** it is approximately 69%.
- **GIVEN** AI with Cautious archetype, **WHEN** car behind within 80m with 5% threat, **WHEN** defend probability is calculated, **THEN** it is approximately 25%.
- **GIVEN** an AI with post-current-lap Fuel or Tire resource below 110% of its last completed-lap use, **WHEN** the next lap is not final, **THEN** it commits to pit entry regardless of difficulty.
- **GIVEN** Very Easy difficulty, **WHEN** AI error rate is calculated, **THEN** errors are 1.5× base rate.
- **GIVEN** Hard difficulty, **WHEN** AI error rate is calculated, **THEN** errors are 0.5× base rate.
- **GIVEN** Very Easy profile precision is 0.90, **WHEN** racing-line correction is calculated, **THEN** line correction is exactly 90% of the archetype/car-derived base correction before steering clamp.
- **GIVEN** an archetype steering-error amplitude of 0.04, Easy profile error multiplier 1.2, and deterministic signed sample 0.5, **WHEN** steering noise is calculated, **THEN** the applied offset is 0.024.
- **GIVEN** Simulation snapshots a DifficultyProfile at race initialization, **WHEN** Settings changes afterward, **THEN** every AI keeps the original profile until the next race.
- **GIVEN** AI crosses finish line on final lap, **WHEN** state transition fires, **THEN** AI enters Finished state immediately.
- **GIVEN** the same race seed, car ID, and simulation tick, **WHEN** AI error/noise is generated twice, **THEN** both results are identical.
- **GIVEN** an MVP AI collision occurs, **WHEN** Vehicle Physics resolves it, **THEN** the affected AI enters Recovering and no active obstacle-avoidance decision runs.

## Open Questions

- **AI racing line generation:** Resolved for MVP: Track supplies the pre-computed racing spline; dynamic generation is deferred.
- **AI collision avoidance:** Resolved for MVP: Vehicle Physics collision plus Recovering. Active obstacle avoidance is an Alpha extension.
- **AI pit visibility:** AI pit entries remain visible through normal track/pit presentation and Track Map data; no archetype-specific indicator is added.
- **AI personality visibility:** Purely behavioral in MVP; no archetype label is shown in HUD.
- **AI error visual feedback:** No dedicated AI-error UI/VFX contract in MVP; the player reads the behavior through speed, line, and collisions.
