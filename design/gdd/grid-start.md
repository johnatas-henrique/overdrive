# Grid & Start

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-22
> **Implements Pillar**: Every Short Race Matters

## Overview

**Grid & Start** places 16 cars on the starting grid based on qualifying results and manages the standing start sequence. The system handles grid formation (2-wide formation), countdown (3-2-1-GO), and the transition from stationary to racing. Grid position is determined by qualifying time — faster qualifier starts ahead. Standing start means all cars are stationary until the "GO" signal. Without this system, cars would appear randomly on the track with no race start.

## Player Fantasy

**Framing:** Direct — the player actively experiences the tension of the start.

**Emotional target:** One layer:

1. **The Grid Is Set (consequence is visible):** Your qualifying performance determined your starting position. If you qualified well, you start near the front — close to the rivals you want to beat. If you qualified poorly, you start at the back —15 cars between you and victory. The grid is the visible consequence of your qualifying effort. Anchor: lights go out, you're P8 —8 cars ahead,7 behind. The race starts NOW.

**Pillar alignment:** Every Short Race Matters — grid position is the first consequence of performance. Speed You Can Feel — the tension of lights-out and the launch.

**Design test:** Does the player feel that their qualifying performance directly impacts their race start position?

## Detailed Design

### Core Rules

**1. Grid Formation**

16 cars in 2-wide formation (8 rows). Grid positions determined by qualifying times — fastest = P1, slowest = P16. If player skips qualifying, starts at P16.

**Column stagger:** Offset depends on first corner direction:
- First corner right → left column in front (pole sitter gets inside line)
- First corner left → right column in front

Row spacing: 8.0m. Column spacing: 3.5m. Stagger offset: 3-5m.

**2. Grid Display Phase**

After qualifying (or skip), a grid display screen shows all16 positions with car names and qualifying times. Duration: 5 seconds OR player presses button to skip. Camera shows the grid from above.

**3. Countdown Sequence**

```
GRID DISPLAY: 5s (or skip)
    ↓
LIGHTS SEQUENCE: 5s
    - Camera moves to grid level
    - Red lights illuminate one by one (1s intervals)
    - All lights on → 1s pause → all lights off = GO!
    - Player can accelerate at any time
    - Accelerating at the EXACT moment of GO → 10s acceleration bonus
```

**4. Perfect Start Mechanic**

- Player can accelerate at any time before/during/after GO
- If player accelerates within ±0.2s of the GO signal → **10s acceleration bonus** (+15% acceleration)
- If player accelerates before GO → normal start, no bonus
- If player accelerates after GO → normal start, no bonus
- Bonus applies to Vehicle Physics acceleration modifier

**5. Launch Mechanics**

- All cars are stationary until GO
- Player input is blocked during countdown (except throttle for perfect start timing)
- At GO: full input unlocked, all cars accelerate
- AI launches based on archetype: Aggressive = faster launch, Cautious = slower launch

**6. Grid Position Calculation**

`grid_position = rank(qualifying_times, ascending)` — fastest = P1.

If player skips qualifying: `grid_position = 16`.

AI qualifying times are pre-generated before grid display (from Qualifying system).

### States and Transitions

| State | Description | Duration | Player Control |
|-------|-------------|----------|----------------|
| **Grid Display** | Show grid positions and times | 5s or skip | Yes — skip button |
| **Countdown** | Lights sequence | 5s | Throttle only (for timing) |
| **Racing** | Race active | Until finish | Full control |

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Qualifying** | Inbound | AI qualifying times, grid positions | Determines grid order |
| **Track** | Inbound | First corner direction | Determines column stagger |
| **Vehicle Physics** | Outbound | Perfect start bonus (15% acceleration for 10s) | Affects launch |
| **AI Rival** | Outbound | Grid positions, AI launch behavior | AI starts from grid |
| **Race Session Manager** | Outbound | Race start event | RSM starts countdown |
| **HUD** | Outbound | Grid display, countdown, perfect start indicator | Player feedback |
| **Audio** | Outbound | Countdown beeps, launch sounds | Audio cues |
| **Settings** | Inbound | Difficulty | May affect AI launch |

## Formulas

### Perfect Start Window

`perfect_start_window = GO_time ± 0.2s`

If player throttle input > 0 within this window → bonus active.

### Acceleration Bonus

`acceleration_modifier = 1.15` for 10 seconds after perfect start.

### Grid Position

`grid_position = rank(qualifying_times, ascending)`

If player skips: `grid_position = 16`.

## Edge Cases

- **If player doesn't accelerate at all:** Car stays stationary. Other cars leave. Player starts last.
- **If player accelerates 1s before GO:** Normal start, no bonus. No penalty.
- **If two players in multiplayer (Alpha):** Both can get perfect start independently.
- **If AI tier spans multiple grid rows:** AI positions based on qualifying times, not tier. Tier1 cars naturally qualify P1-P4 due to faster stats.
- **If qualifying times are identical:** Tiebreak by tier (higher tier gets better position), then random.
- **If track has no clear first corner direction:** Default to right column in front.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Qualifying** | Inbound | AI times, grid positions | Hard — determines grid order |
| **Track** | Inbound | First corner direction | Hard — determines stagger |
| **Vehicle Physics** | Outbound | Perfect start bonus | Hard — affects launch |
| **AI Rival** | Outbound | Grid positions, launch behavior | Hard — AI starts from grid |
| **Race Session Manager** | Outbound | Race start event | Hard — triggers countdown |
| **HUD** | Outbound | Grid display, countdown | Hard — player feedback |
| **Audio** | Outbound | Countdown sounds | Soft — audio cues |

## Tuning Knobs

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Row spacing | 8.0m | 6–10m | Cars too close (collision) | Cars too spread out |
| Column spacing | 3.5m | 2.5–5m | Cars overlap | Grid too wide |
| Stagger offset | 3–5m | 2–7m | Minimal offset | Too much offset |
| Perfect start window | ±0.2s | ±0.1–0.5s | Too hard to time | Too easy |
| Acceleration bonus | 15% for 10s | 10–20%, 5–15s | Bonus negligible | Bonus too strong |
| Countdown duration | 5s | 3–8s | Too fast (no prep) | Too slow (boring) |
| Grid display duration | 5s | 3–10s | Too fast to read | Too long |

## Visual/Audio Requirements

- **Grid display:** Full grid with positions, names, and times. Team colors on cars.
- **Countdown:** Red lights illuminate one by one. All lights off = GO.
- **Perfect start indicator:** Visual flash or HUD indicator when bonus activates.
- **Launch:** Camera shakes slightly on GO. Engine sounds intensify.

## UI Requirements

> **📌 UX Flag — Grid & Start**: This system has UI requirements. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for the grid display and countdown before writing epics.

## Acceptance Criteria

- **GIVEN** qualifying results, **WHEN** grid is formed, **THEN** P1 has fastest qualifying time and P16 has slowest.
- **GIVEN** player skips qualifying, **WHEN** grid is formed, **THEN** player is at P16.
- **GIVEN** first corner is right, **WHEN** grid is formed, **THEN** left column is in front (staggered).
- **GIVEN** player accelerates within ±0.2s of GO, **WHEN** race starts, **THEN** acceleration bonus is active for 10s.
- **GIVEN** player accelerates 1s before GO, **WHEN** race starts, **THEN** normal start, no bonus.
- **GIVEN** countdown at 3s, **WHEN** lights are shown, **THEN** 3 red lights are illuminated.
- **GIVEN** countdown at GO, **WHEN** lights are shown, **THEN** all lights off and input unlocked.
- **GIVEN** AI Tier1 car, **WHEN** grid is formed, **THEN** car is in P1-P4 range.

## Open Questions

- **Grid display camera angle:** Should it be a cinematic pan over the grid, or a static top-down view?
- **Perfect start audio cue:** Should there be a specific sound when the bonus activates?
- **AI perfect start:** Should AI also get perfect start bonuses? Or is it player-only?
- **Grid formation animation:** Should cars drive to their grid positions, or spawn already placed?
