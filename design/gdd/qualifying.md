# Qualifying

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-08-01
> **Implements Pillar**: Speed You Can Feel

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | One-attempt qualifying, local AI times, grid placement, skip/failure behavior. |
| MVP architecture constraints | Qualifying produces a deterministic grid result for Race Session Manager. |
| Alpha | Not designed. |
| Beta | Not designed. |
| Release | Not designed. |

### Review Boundary
Future qualifying presentation or replay behavior is non-blocking during MVP review.

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

Single flying lap. Starting Qualifying requests Content Loading; after Simulation accepts `RaceLoadReady(RaceMode.Qualifying)`, it enters `SimulationState.Racing` with `GameplayQualifying` directly, without Countdown or grid lock. The player starts from the pit box (assigned by boxId from TrackData.PitLaneDefinition), drives an out-lap through the pit lane onto track (pit speed limit enforced, no fuel consumption, no tire wear, timer does not start), then completes one timed flying lap. After it ends, the player car is presented for up to 5 seconds; Confirm may advance immediately to Qualifying Results. Fastest time = grid position. One chance only — no retry. Race Session Manager owns `RaceMode.Qualifying`; Simulation owns Loading, Racing, Finished, and Results.

**2. Fuel During Qualifying**

Computed minimum fuel load — enough for the track's reference flying-lap time plus a 10% safety margin, using the current car's Fuel rate. The player never manages or monitors fuel during qualifying. Once the lap ends, qualifying resolution is immediate and no further fuel is consumed; the player cannot refuel during qualifying.

**3. Tire Wear During Qualifying**

No tire wear. Tires remain at 100% grip for the entire qualifying session. Pure speed.

**4. Terminal Presentation**

Finished Presentation is the visible terminal screen. Its UI Presentation controller owns the timer, pause flag, and dismissal signal; it never changes qualifying results or SimulationState.

After crossing the finish line on the flying lap:
- Timer stops, time is recorded
- Player car remains in terminal presentation for up to 5 seconds
- UI Confirm (Enter / gamepad South) advances immediately; UI Cancel (Escape / gamepad East) is ignored
- Qualifying Results opens automatically after the 5-second terminal presentation expires
- No player driving, fuel consumption, tire wear or return-lap simulation occurs

**5. Post-Qualifying Screen**

After terminal presentation completes (or Confirm advances):
- Full grid screen shows all 16 positions with car names and qualifying times
- Player's position highlighted
- "Start Race" button (Confirm / Enter / South) — no retry option; Qualifying Results waits for Confirm and does not auto-advance

**6. Grid Position Calculation**

Grid position = rank by qualifying time (fastest = position 1). 16 cars total. Player's qualifying time is compared against 15 AI qualifying times.

**7. AI Qualifying Times**

AI times are deterministic and consume the same immutable DifficultyProfile used during Racing:
- `precision_penalty = 1 - profile.ai_precision`
- `error_penalty = PCG32Float01 × 0.005 × profile.ai_error_multiplier`
- `pace_variation = PCG32Range(-profile.pace_noise, +profile.pace_noise)`
- `ai_time = track_reference_lap_time × tier_modifier × (1 + precision_penalty + error_penalty + pace_variation)`
- **tier_modifier:** Tier 1 = 1.00, Tier 2 = 1.015, Tier 3 = 1.035, Tier 4 = 1.055
- PCG32 is keyed by race seed, stable carId, and qualifying generation index.
- Tier order is not artificially preserved. On forgiving profiles, deterministic AI imprecision may allow a lower-tier car to outqualify a higher-tier car.

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
| **Not Started** | Pre-qualifying menu before Content Loading | Yes — choose to start or skip |
| **Loading** | Qualifying content and runtime state are prepared | No — Input remains blocked UI routing |
| **Flying Lap** | Timed lap — full speed | Yes — player drives |
| **Finished Presentation** | Show player car after lap | UI Confirm advances; Pause available; UI Cancel ignored |
| **Qualifying Results** | Full grid display | Yes — choose "Start Race" |

### States and Transitions

| From | To | Trigger | Notes |
|------|----|---------|-------|
| Not Started | Loading | Player starts qualifying | RSM returns a Qualifying Loading request; Input remains blocked UI routing |
| Loading | Flying Lap | Simulation accepts `RaceLoadReady(RaceMode.Qualifying)` | Simulation enters Racing directly, applies qualifying fuel, and spawns the car at pit box without Countdown; player drives out-lap through pit lane (no fuel/wear, timer off) then starts flying lap |
| Flying Lap | Finished Presentation | Player crosses start/finish line | Timer stops, time/grid result recorded |
| Finished Presentation | Qualifying Results | 5s expires or Confirm advances | Grid determined |
| Flying Lap | Finished Presentation | Player crashes/spins | No time recorded, P16 grid result locked; no retry |
| Qualifying Results | — | Player presses "Start Race" | Grid finalized |

**GridAssignment:** When qualifying completes or is skipped, Race Session Manager locks `GridAssignment { carId → gridSlot[1..16] }` from the final grid order. Qualifying Results displays that locked assignment; Start Race passes it through `StartRaceRequested` → `TransitionRequest(Loading, QualifyingComplete, gridAssignment)` for Content Pipeline and Grid & Start. Note: Content Pipeline handles this transition as a lightweight Race Reconfigure (no asset unload/reload) since track and car bundles are already loaded from qualifying.

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Input** | Inbound | `GameplayQualifying` controls | Same driving physics as race; Accelerate, Brake, Steer, and Pause are active. Vehicle Physics ignores pit-entry zones during Qualifying. |
| **Track** | Inbound | Track geometry, start/finish line | Same track as race |
| **Vehicle Physics** | Bidirectional | Car physics, speed, handling | Same as race |
| **Fuel** | Bidirectional | `fuel_rate_for_car`, computed `qualifying_fuel_load` | Initializes the minimum calculated load for one flying lap; no player fuel management |
| **Tire** | Inbound | Tire state | 100% grip, no wear |
| **Settings** | Inbound via Simulation | Immutable DifficultyProfile | Supplies AI precision, error multiplier, and pace noise used by deterministic time generation |
| **AI Rival** | Bidirectional | AI qualifying times | Generated before qualifying starts |
| **Race Session Manager** | Outbound | Final grid order | Locks `GridAssignment { carId → gridSlot[1..16] }` before race start |
| **HUD** | Outbound | Qualifying timer | Display during flying lap |
| **Audio** | Outbound | Qualifying state | Audio system adapts |
| **Simulation Architecture** | Bidirectional | Loading, `RaceMode.Qualifying`, Pause, Finished Presentation, Results | Hard — qualifying enters shared SimulationState.Racing directly after readiness and never uses Countdown |
| **Pit Stop** | Inbound | Qualifying mode | Hard — pit entry, service, and pit exit are blocked during qualifying |

## Formulas

**Current live values:** see qualifying configuration.

### AI Qualifying Time

`precision_penalty = 1 - profile.ai_precision`

`error_penalty = PCG32Float01 × 0.005 × profile.ai_error_multiplier`

`pace_variation = PCG32Range(-profile.pace_noise, +profile.pace_noise)`

`ai_time = track_reference_lap_time × tier_modifier × (1 + precision_penalty + error_penalty + pace_variation)`

**Variables:**

| Symbol | Type | Range | Description |
|--------|------|-------|-------------|
| track_reference_lap_time | float | 60–90s | Track-dependent neutral reference lap time |
| tier_modifier | float | 1.00–1.055 | Tier 1 = 1.00, Tier 4 = 1.055 |
| profile.ai_precision | float | 0.90–1.00 | Same DifficultyProfile precision consumed by AI Rival |
| profile.ai_error_multiplier | float | 0.0–1.5 | Scales deterministic non-negative qualifying error |
| profile.pace_noise | float | 0.0–0.08 | Symmetric deterministic pace variation from the selected profile |

**Output Range:** profile-dependent and always positive for the approved five profiles. Very Easy produces at least a 2% penalty before tier scaling (`1 + 0.10 - 0.08`); Very Hard adds no precision, error, or pace variation.

**Example (75s reference, Tier 1, Easy, PCG values error=0.5 and pace=-0.02):** `75 × 1.00 × (1 + 0.05 + 0.5 × 0.005 × 1.2 - 0.02) = 77.475s`.

### Grid Position

`grid_position = rank(qualifying_times, ascending, stable_car_id)` — fastest time = position 1; ties broken by stable car ID (deterministic, same as Grid & Start).

If player skips: `grid_position = 16`.

### Fuel Required

`fuel_required_for_flying_lap = fuel_rate_for_car × reference_flying_lap_time`

`qualifying_fuel_load = min(8.0L, fuel_required_for_flying_lap × (1.0 + qualifying_fuel_margin))`

`qualifying_fuel_margin = 0.10` in MVP. Fuel System supplies `fuel_rate_for_car`; Track supplies `reference_flying_lap_time`. The load is the minimum calculated amount that covers the reference lap plus the margin, not a player-facing resource decision.

`fuel_rate_for_car` is the Fuel System rate at full throttle for the selected car. `reference_flying_lap_time` is the Track-provided reference time for the current circuit and qualifying configuration.

## Edge Cases

- **If player crashes on flying lap:** No time recorded. Starts at position 16. No retry.
- **If player runs out of fuel on flying lap:** Car coasts. If player crosses finish line, time counts. If not, starts at position 16.
- **If player doesn't cross start/finish line:** No time recorded. Starts at position 16.
- **If any two cars have identical qualifying times:** Tiebreak by stable `car_id` (deterministic, same as Grid & Start).
- **If a lower-tier AI outqualifies a higher-tier AI:** Preserve the generated order. DifficultyProfile imprecision is allowed to cross tiers; deterministic tiebreakers apply only to exact equal times.
- **If player's time beats all AI:** Player starts at position 1 (pole position).
- **If player's time is slowest of all:** Player starts at position 16.
- **If player skips and AI times are generated:** Grid is fully populated, player is inserted at position 16.
- **If Finished Presentation is dismissed:** Qualifying Results appears immediately after Confirm; UI Cancel is ignored.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Input** | Inbound | Player controls | Hard — player drives qualifying lap |
| **Track** | Inbound | Track geometry | Hard — qualifying uses same track |
| **Vehicle Physics** | Bidirectional | Car physics | Hard — same handling as race |
| **Fuel** | Bidirectional | `fuel_rate_for_car`, computed `qualifying_fuel_load` | Hard — initializes the minimum calculated load for one flying lap |
| **Tire** | Inbound | Tire state | Soft — 100% grip, no wear |
| **Settings** | Inbound via Simulation | DifficultyProfile | Hard — supplies AI precision, error multiplier, and pace noise |
| **AI Rival** | Bidirectional | AI qualifying times | Hard — determines grid |
| **Grid & Start** | Outbound via RSM | Locked `GridAssignment` | Hard — receives the RSM-owned assignment during race loading |
| **HUD** | Outbound | Timer, position | Hard — player needs feedback |
| **Audio** | Outbound | Qualifying state | Soft — audio adapts |
| **Simulation Architecture** | Bidirectional | Loading, `RaceMode.Qualifying`, Pause, Finished Presentation, Results | Hard — qualifying enters Racing directly after readiness and never uses Countdown |
| **Pit Stop** | Inbound | Qualifying mode | Hard — pit entry, service, and pit exit are blocked during qualifying |

## Tuning Knobs

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Qualifying fuel margin | 10% over reference lap | 5–20% | Slow players can run out before the line | Adds unnecessary fuel and undermines the fastest-lap fantasy |
| Base qualifying error factor | 0.5% | 0–1% | Difficulty error multiplier has little effect | Grid becomes random |
| Tier modifier spread | 5.5% (T1→T4) | 3–8% | Tiers too close | Tiers too far apart |
| DifficultyProfile precision/error/pace | Settings profile values | Five approved profiles | Difficulty bands collapse | AI grid becomes erratic |
| Finished Presentation duration | 5s | 3–15s | Too fast (no atmosphere) | Too long (boring) |

## Visual/Audio Requirements

- **Qualifying timer:** Large, center-screen during flying lap. Shows current lap time in real time.
- **Qualifying Results:** Full grid with positions, names, and times after qualifying.
- **Pit lane:** Same visual as race pit lane.
- **Audio:** Engine sounds same as race. No music stings during qualifying (pure focus).

## UI Requirements

> **📌 UX Flag — Qualifying**: This system has UI requirements. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for the qualifying screen and Qualifying Results before writing epics.

## Acceptance Criteria

- **GIVEN** player starts qualifying, **WHEN** fuel is checked, **THEN** the initial load equals `min(8.0L, fuel_rate_for_car × reference_flying_lap_time × 1.10)` and no fuel-management UI is shown.
- **GIVEN** player completes flying lap, **WHEN** tire wear is checked, **THEN** tires are at 100% (no wear applied).
- **GIVEN** player's qualifying time is fastest, **WHEN** grid is calculated, **THEN** player starts at position 1.
- **GIVEN** player skips qualifying, **WHEN** grid is displayed, **THEN** player is at position 16.
- **GIVEN** player crashes on flying lap, **WHEN** qualifying ends, **THEN** no time is recorded and player starts at position 16 (no retry).
- **GIVEN** an Easy profile with precision 0.95, error multiplier 1.2, PCG error sample 0.5 and pace variation -0.02, **WHEN** a Tier 1 AI time is generated on a 75s reference, **THEN** time is 77.475s ±0.001.
- **GIVEN** two AI with identical times, **WHEN** tiebreak runs, **THEN** stable `car_id` determines the deterministic order (same as Grid & Start).
- **GIVEN** player completes or fails qualifying, **WHEN** Finished Presentation begins, **THEN** `resultKind = Qualifying`, UI Cancel is ignored, and Confirm opens Qualifying Results with all 16 positions and a Start Race button.
- **GIVEN** player skips qualifying, **WHEN** Qualifying Results appears, **THEN** all AI times are generated, player is P16, and Start Race routes through Loading before Countdown.
- **GIVEN** qualifying is active, **WHEN** the player reaches a pit-entry zone, **THEN** Pit Stop does not enter Pit Transit or In Pit Box.
- **GIVEN** two cars have equal time, tier, and stats, **WHEN** grid order is resolved, **THEN** stable `car_id` determines the deterministic order.
- **GIVEN** player starts Qualifying, **WHEN** content is not yet ready, **THEN** Input remains blocked in UI Loading; **WHEN** Simulation accepts `RaceLoadReady(RaceMode.Qualifying)`, **THEN** the first active state is Racing/GameplayQualifying with no Countdown or grid-lock tick.
- **GIVEN** two AI have identical qualifying times, **WHEN** grid order is resolved, **THEN** stable `car_id` determines the deterministic order (same as Grid & Start).
- **GIVEN** qualifying is skipped or failed, **WHEN** the grid screen appears, **THEN** the player result is labeled `DNQ`, not shown as a fabricated qualifying time.

## Open Questions

- **Qualifying visual feedback:** Should the player see a "ghost" of their best time during the flying lap? Or is the raw timer sufficient?
- **Out lap behavior:** MVP spawns the player at the pit box after Qualifying content readiness, drives out-lap through pit lane (pit speed limit enforced, no fuel consumption, no tire wear, timer does not start), then starts the single flying lap. No Countdown or separate cutscene is required.
- **Replay qualifying:** After a failed lap, should the player see what went wrong (sector times, comparison to AI)? Or just retry?
- **Qualifying per car:** If different cars have different cockpit layouts (Alpha/Beta), does the qualifying HUD change?
