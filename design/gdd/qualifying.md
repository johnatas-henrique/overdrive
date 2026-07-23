# Qualifying

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-22
> **Implements Pillar**: Speed You Can Feel

## Overview

**Qualifying** is a single-attempt qualifying session before each race. The player completes one flying lap with a fixed fuel load — no fuel strategy, no tire management, just pure speed. The qualifying time determines grid position: faster time = better position. If the player skips qualifying or fails to complete the lap, they start at position 16 (last). Optional — the player can choose to skip directly to the race.

## Player Fantasy

**Framing:** Direct — the player actively participates in qualifying.

**Emotional target:** One layer, pure:

1. **The Limit Lap (pure speed, no safety net):** Qualifying is where you prove you're the fastest. One lap, full throttle, no second chances. No fuel strategy, no tire management — just you and the car at absolute limit. The timing tower is the only judge. Anchor: final sector, already over the limit, a single missed apex costs pole. You cross the line and the number tells you the truth.

**Pillar alignment:** Speed You Can Feel — qualifying is the purest expression of speed. Every Short Race Matters — a tenth here reshapes the entire race.

**Design test:** Does the player feel that qualifying is the moment where speed matters most? Do they feel the tension of "one shot, no safety net"?

## Detailed Design

### Core Rules

**1. Qualifying Format**

Single flying lap. Player starts from pit lane, completes one timed lap. After crossing the finish line, a cutscene shows the return to pit lane (skippable). Fastest time = grid position. One chance only — no retry.

**2. Fuel During Qualifying**

Fixed low fuel load — enough for 1 flying lap (~1.0L). Return is cutscene (no fuel consumption). Player cannot refuel during qualifying.

**3. Tire Wear During Qualifying**

No tire wear. Tires remain at 100% grip for the entire qualifying session. Pure speed.

**4. Return Lap**

After crossing the finish line on the flying lap:
- Timer stops, time is recorded
- Cutscene begins: car returns to pit lane automatically
- Cutscene is skippable (player can press button to skip)
- No fuel consumption during cutscene
- No player control during cutscene

**5. Post-Qualifying Screen**

After cutscene completes (or is skipped):
- Full grid screen shows all 16 positions with car names and qualifying times
- Player's position highlighted
- "Start Race" button — no retry option

**6. Grid Position Calculation**

Grid position = rank by qualifying time (fastest = position 1). 16 cars total. Player's qualifying time is compared against 15 AI qualifying times.

**7. AI Qualifying Times**

AI times are deterministic with small variance:
- `ai_time = base_time × tier_modifier × difficulty_modifier × variance`
- **tier_modifier:** Tier 1 = 1.00, Tier 2 = 1.015, Tier 3 = 1.035, Tier 4 = 1.055
- **difficulty_modifier:** Easy = 1.01, Normal = 1.00, Hard = 0.99
- **variance:** ±0.8% per race
- Tier order preserved: Tier 1 always qualifies ahead of Tier 4 (variance doesn't cross tiers)

**8. Skip Qualifying**

Player can choose to skip qualifying. If skipped:
- Player starts at position 16 (last)
- AI times are still generated (grid is populated)
- Full grid screen is still shown before race starts

**9. Failed Qualifying Lap**

If player crashes, spins, or fails to complete the qualifying lap:
- No time is recorded
- Player starts at position 16 (last)
- No retry — one chance only, everything has consequences

**10. Qualifying Session States**

| State | Description | Player Control |
|-------|-------------|----------------|
| **Not Started** | Pre-qualifying menu | Yes — choose to start or skip |
| **Flying Lap** | Timed lap — full speed | Yes — player drives |
| **Return Cutscene** | Car returns to pit lane | No — cutscene, skippable |
| **Grid Screen** | Full grid display | Yes — choose "Start Race" |

### States and Transitions

| From | To | Trigger | Notes |
|------|----|---------|-------|
| Not Started | Flying Lap | Player starts qualifying | Fuel load applied, car spawned at pit exit |
| Flying Lap | Return Cutscene | Player crosses start/finish line | Timer stops, time recorded |
| Return Cutscene | Grid Screen | Cutscene ends or is skipped | Grid determined |
| Flying Lap | Not Started | Player crashes/spins | No time recorded, starts at P16 |
| Grid Screen | — | Player presses "Start Race" | Grid finalized |

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Input** | Inbound | Player controls | Same as race |
| **Track** | Inbound | Track geometry, start/finish line | Same track as race |
| **Vehicle Physics** | Bidirectional | Car physics, speed, handling | Same as race |
| **Fuel** | Inbound | Fuel level, consumption | Fixed low load (~1.0L) |
| **Tire** | Inbound | Tire state | 100% grip, no wear |
| **Settings** | Inbound | Difficulty | Affects AI qualifying pace |
| **AI Rival** | Outbound | AI qualifying times | Generated before qualifying starts |
| **Grid & Start** | Outbound | Grid positions | Passed to race start |
| **HUD** | Outbound | Qualifying timer | Display during flying lap |
| **Audio** | Outbound | Qualifying state | Audio system adapts |

## Formulas

**Current live values:** see qualifying configuration.

### AI Qualifying Time

`ai_time = base_time × tier_modifier × difficulty_modifier × variance`

**Variables:**

| Symbol | Type | Range | Description |
|--------|------|-------|-------------|
| base_time | float | 60–90s | Track-dependent base lap time |
| tier_modifier | float | 1.00–1.055 | Tier 1 = 1.00, Tier 4 = 1.055 |
| difficulty_modifier | float | 0.99–1.01 | Easy = 1.01, Normal = 1.00, Hard = 0.99 |
| variance | float | 0.992–1.008 | ±0.8% per race |

**Output Range:** base_time × 0.982 (Tier 1, Easy, best variance) to base_time × 1.063 (Tier 4, Hard, worst variance).

**Example (Monaco, base 75s):**
- Tier 1 + Easy + best: 75 × 1.00 × 1.01 × 0.992 = 74.3s
- Tier 4 + Hard + worst: 75 × 1.055 × 0.99 × 1.008 = 79.5s
- Spread: 5.2s (6.9%)

### Grid Position

`grid_position = rank(qualifying_times, ascending)` — fastest time = position 1.

If player skips: `grid_position = 16`.

### Fuel Required

`fuel_required = fuel_rate × flying_lap_time`

With fuel_rate from Fuel System and typical lap times: ~1.0L for 1 flying lap.

## Edge Cases

- **If player crashes on flying lap:** No time recorded. Starts at position 16. No retry.
- **If player runs out of fuel on flying lap:** Car coasts. If player crosses finish line, time counts. If not, starts at position 16.
- **If player doesn't cross start/finish line:** No time recorded. Starts at position 16.
- **If two AI have identical qualifying times:** Tiebreak by tier (higher tier gets better position), then by car stats.
- **If player's time beats all AI:** Player starts at position 1 (pole position).
- **If player's time is slowest of all:** Player starts at position 16.
- **If player skips and AI times are generated:** Grid is fully populated, player is inserted at position 16.
- **If cutscene is skipped:** Grid screen appears immediately after skip.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Input** | Inbound | Player controls | Hard — player drives qualifying lap |
| **Track** | Inbound | Track geometry | Hard — qualifying uses same track |
| **Vehicle Physics** | Bidirectional | Car physics | Hard — same handling as race |
| **Fuel** | Inbound | Fuel level, consumption | Hard — fixed low load |
| **Tire** | Inbound | Tire state | Soft — 100% grip, no wear |
| **Settings** | Inbound | Difficulty | Hard — affects AI pace |
| **AI Rival** | Outbound | AI qualifying times | Hard — determines grid |
| **Grid & Start** | Outbound | Grid positions | Hard — feeds into race |
| **HUD** | Outbound | Timer, position | Hard — player needs feedback |
| **Audio** | Outbound | Qualifying state | Soft — audio adapts |

## Tuning Knobs

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Fuel load | 1.0L | 0.5–2.0L | Not enough for flying lap | Too much, strategy creep |
| AI variance | ±0.8% | ±0.5–2% | Grid too predictable | Grid too random, tier order breaks |
| Tier modifier spread | 5.5% (T1→T4) | 3–8% | Tiers too close | Tiers too far apart |
| Difficulty modifier | ±1% | ±0.5–3% | Difficulty doesn't matter | Difficulty too impactful |
| Cutscene duration | 5–8s | 3–15s | Too fast (no atmosphere) | Too long (boring) |

## Visual/Audio Requirements

- **Qualifying timer:** Large, center-screen during flying lap. Shows current lap time in real time.
- **Grid display:** Full grid with positions, names, and times after qualifying.
- **Pit lane:** Same visual as race pit lane.
- **Audio:** Engine sounds same as race. No music stings during qualifying (pure focus).

## UI Requirements

> **📌 UX Flag — Qualifying**: This system has UI requirements. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for the qualifying screen and grid display before writing epics.

## Acceptance Criteria

- **GIVEN** player starts qualifying, **WHEN** fuel is checked, **THEN** fuel is approximately 1.0L (enough for 1 flying lap).
- **GIVEN** player completes flying lap, **WHEN** tire wear is checked, **THEN** tires are at 100% (no wear applied).
- **GIVEN** player's qualifying time is fastest, **WHEN** grid is calculated, **THEN** player starts at position 1.
- **GIVEN** player skips qualifying, **WHEN** grid is displayed, **THEN** player is at position 16.
- **GIVEN** player crashes on flying lap, **WHEN** qualifying ends, **THEN** no time is recorded and player starts at position 16 (no retry).
- **GIVEN** AI Tier 4 car with Hard difficulty and +0.8% variance, **WHEN** qualifying time is generated, **THEN** time is base_time × 1.055 × 0.99 × 1.008.
- **GIVEN** two AI with identical times, **WHEN** tiebreak runs, **THEN** higher tier gets better position.
- **GIVEN** player completes qualifying, **WHEN** grid screen appears, **THEN** all 16 positions shown with times and "Start Race" button.

## Open Questions

- **Qualifying visual feedback:** Should the player see a "ghost" of their best time during the flying lap? Or is the raw timer sufficient?
- **Out lap behavior:** Should the out lap be a separate scene/cutscene, or should the player drive it manually?
- **Replay qualifying:** After a failed lap, should the player see what went wrong (sector times, comparison to AI)? Or just retry?
- **Qualifying per car:** If different cars have different cockpit layouts (Alpha/Beta), does the qualifying HUD change?
