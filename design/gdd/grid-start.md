# Grid & Start

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Every Short Race Matters

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Grid formation, lights, grid lock, Perfect Start, and local launch behavior. |
| MVP architecture constraints | Grid state and GO event are explicit local race contracts. |
| Alpha | Not designed. |
| Beta | Not designed. |
| Release | Not designed. |

### Review Boundary
All defined grid/start behavior is MVP; future presentation additions are non-blocking.

## Overview

**Grid & Start** places 16 cars on the starting grid from the immutable `GridAssignment` produced by Race Session Manager and manages the standing start presentation. The system handles grid formation, the five-light/five-beep Countdown, and the transition from stationary to racing at the Simulation-owned GO boundary. Standing start means all cars remain grid-locked until the 300th Countdown tick (countdown duration owned by Race Session Manager). Without this system, cars would appear randomly on the track with no race start.

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

After qualifying (or skip), a grid display screen shows all 16 positions with car names and qualifying times or `DNQ`. The screen waits for the player to press Confirm; there is no timeout or Back/Cancel path. Camera shows the grid from a static top-down view in MVP.

**3. Countdown Sequence**

```
GRID DISPLAY: Confirm only
    ↓
LIGHTS SEQUENCE: 5s
    - Camera moves to grid level
    - Five red lights illuminate one by one at 1s intervals
    - The fifth light turns off immediately at the fifth second = GO
    - Player controls remain active; cars remain grid-locked until GO
    - A correctly armed throttle at GO → 10s acceleration bonus
```

**4. Perfect Start Mechanic**

- Accelerate, Brake, and Steer remain active before/during/after GO; grid lock prevents movement before GO
- From `GO_tick - 12` through `GO_tick - 1`, Input System arms Perfect Start if `rawThrottlePostDeadZone > 0.5` and `rawBrakePostDeadZone == 0` on any tick.
- On the GO tick, the same raw condition must still hold. If it does and Perfect Start is armed, apply the **10s acceleration bonus** (+15% drive force).
- A player who does not satisfy the condition during the 12-tick pre-GO window and at GO receives a normal start with no bonus. Beginning to accelerate earlier is allowed if the valid condition is present again during the approved window and at GO.
- Bonus applies `perfectStartDriveForceMultiplier = 1.15` to Vehicle Physics `longitudinalDriveForceFinal` for 600 simulation ticks
- At GO, Grid & Start publishes immutable `PerfectStartResult { active, remainingTicks }`; `remainingTicks` is 600 when active and 0 otherwise. Simulation copies this result into ReplayInitialState before the first Racing tick.

**5. Launch Mechanics**

- All cars are stationary until GO
- Accelerate, Brake, Steer, and Pause function during countdown; Settings remains blocked and grid lock prevents pit-lane entry
- At GO: grid lock releases and the current control state drives all cars
- AI launches based on archetype: Aggressive = faster launch, Cautious = slower launch. AI never receives the player-only Perfect Start multiplier in MVP.

**6. Grid Position Calculation**

`grid_position = rank(qualifying_times, ascending, stable_car_id)` — fastest = P1; stable `carId` breaks equal-time ties.

If player skips qualifying: `grid_position = 16`.

AI qualifying times are pre-generated before grid display (from Qualifying system).

### States and Transitions

| State | Description | Duration | Player Control |
|-------|-------------|----------|----------------|
| **Grid Display** | Show grid positions and times | Confirm only | No |
| **Countdown** | Lights sequence; cars grid-locked | 5s | Accelerate, Brake, Steer, Pause |
| **Racing** | Race active | Until finish | Full control |

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Qualifying** | Inbound | AI qualifying times | Informs final race order |
| **Race Session Manager** | Inbound | `GridAssignment { carId → gridSlot[1..16] }`, race mode | Locked after Qualifying or skip; Grid & Start applies it before Countdown |
| **Track** | Inbound | First corner direction | Determines column stagger |
| **Vehicle Physics** | Outbound | grid_lock, `perfectStartDriveForceMultiplier` | Holds cars before GO; multiplies `longitudinalDriveForceFinal` by 1.15 for 600 ticks after a valid start |
| **AI Rival** | Outbound | Grid positions, AI launch behavior | AI starts from grid |
| **Simulation Architecture** | Inbound | Countdown ticks, GO boundary, grid-lock lifecycle | Simulation releases grid lock on tick 300 and publishes the first Racing snapshot |
| **Input System** | Inbound | Accelerate, Brake, Steer, Pause, Confirm | Player controls remain active during Countdown; Confirm advances Grid Display |
| **HUD** | Outbound | Grid display, countdown, perfect start indicator | Player feedback |
| **Audio** | Outbound | Countdown beeps, launch sounds | Audio cues |

## Formulas

### Perfect Start Window

`perfect_start_arming_window = [GO_tick - 12, GO_tick - 1]`

`perfect_start = armed AND rawThrottlePostDeadZone(GO_tick) > 0.5 AND rawBrakePostDeadZone(GO_tick) == 0`

### Acceleration Bonus

`longitudinalDriveForceFinal *= 1.15` for 600 ticks after a valid perfect start.

### Grid Position

`grid_position = rank(qualifying_times, ascending, stable_car_id)`

If player skips: `grid_position = 16`.

## Edge Cases

- **If player doesn't accelerate at all:** Car stays stationary. Other cars leave. Player starts last.
- **If player accelerates 1s before GO:** Normal start, no bonus. No penalty.
- **If two players in multiplayer (Alpha):** Deferred; MVP has one player and AI never receives the Perfect Start multiplier.
- **If AI tier spans multiple grid rows:** AI positions are based on qualifying times, not a fixed tier range.
- **If qualifying times are identical:** Tiebreak by stable `carId`; no random ordering is used.
- **If track has no clear first corner direction:** Default to right column in front.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Qualifying** | Inbound | AI times, grid positions | Hard — determines grid order |
| **Track** | Inbound | First corner direction | Hard — determines stagger |
| **Vehicle Physics** | Outbound | Perfect start bonus | Hard — affects launch |
| **AI Rival** | Outbound | Grid positions, launch behavior | Hard — AI starts from grid |
| **Race Session Manager** | Inbound | immutable `GridAssignment`, race mode | Hard — supplies the locked order |
| **Simulation Architecture** | Bidirectional | GO tick and grid-lock state in; immutable PerfectStartResult out | Hard — Simulation owns the lifecycle boundary and copies the result into ReplayInitialState |
| **Input System** | Inbound | Confirm and gameplay controls | Hard — owns skip and pre-GO input |
| **HUD** | Outbound | Grid display, countdown | Hard — player feedback |
| **Audio** | Outbound | Countdown sounds | Soft — audio cues |

## Tuning Knobs

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Row spacing | 8.0m | 6–10m | Cars too close (collision) | Cars too spread out |
| Column spacing | 3.5m | 2.5–5m | Cars overlap | Grid too wide |
| Stagger offset | 3–5m | 2–7m | Minimal offset | Too much offset |
| Perfect start window | 12 pre-GO ticks + GO tick | Fixed for MVP; changes require design review | Too hard to time | Too easy |
| Acceleration bonus | 15% for 10s | 10–20%, 5–15s | Bonus negligible | Bonus too strong |
| Countdown duration | 5s / 300 ticks | Fixed for MVP; changes require design review | Too fast (no prep) | Too slow (boring) |
| Grid display duration | Confirm only | Fixed for MVP; changes require design review | Too fast to read | Too long |

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
- **GIVEN** first corner is left, **WHEN** grid is formed, **THEN** right column is in front (staggered).
- **GIVEN** the valid raw condition occurred at least once during GO-12 through GO-1 and still holds on GO, **WHEN** race starts, **THEN** `perfectStartDriveForceMultiplier = 1.15`, `PerfectStartResult.active = true`, and `remainingTicks = 600` before the first Racing tick.
- **GIVEN** the GO tick has raw Brake above its dead-zone threshold, **WHEN** race starts, **THEN** no Perfect Start bonus activates even if raw Throttle is above 0.5.
- **GIVEN** player accelerates 1s before GO but releases before the 12-tick arming window or is not holding the valid condition at GO, **WHEN** race starts, **THEN** normal start, no bonus.
- **GIVEN** the 5-second countdown reaches GO on tick 300, **WHEN** lights are shown, **THEN** all five lights are off, the GO event is published, and grid lock releases.
- **GIVEN** Countdown is active and player steers or brakes, **WHEN** simulation ticks, **THEN** the controls are consumed while the car remains stationary under grid lock.
- **GIVEN** an AI car with a faster qualifying time than another car, **WHEN** grid is formed, **THEN** it receives the earlier grid slot; no fixed tier-to-position range is assumed after excluding the player car.
- **GIVEN** two qualifying times are identical, **WHEN** grid is formed, **THEN** stable `carId` determines their order without randomization.

## Open Questions

- **Grid display camera angle:** MVP uses a static top-down view.
- **Perfect start audio cue:** Audio may add a dedicated activation cue; the gameplay contract does not depend on it.
- **AI perfect start:** Resolved for MVP: player-only.
- **Grid formation animation:** Cars spawn at their validated assigned grid transforms; no drive-to-grid animation is required in MVP.
