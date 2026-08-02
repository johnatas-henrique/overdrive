# Pit Stop

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Every Short Race Matters

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Local pit entry, service sequence, refuel, tire change, and AI pit behavior. |
| MVP architecture constraints | Pit events and service state remain explicit for race consumers. |
| Alpha | Not designed. |
| Beta | Not designed. |
| Release | Not designed. |

### Review Boundary
All specified pit mechanics are MVP; unassigned pit extensions are non-blocking.

## Overview

**Pit Stop** is the recovery mechanism that turns fuel and tire management into strategic decisions. It gives the player a choice: spend 2-10 seconds in service, determined by tire swap plus fuel required, or stay out and risk running out of fuel or losing grip. The pit stop is the consequence that makes resource management matter — without it, fuel and tire would be theoretical concerns rather than race-defining choices.

## Player Fantasy

**Framing:** Technical — the pit stop is the consequence that makes resource management matter.

**Emotional target:** Three layers:

1. **The Gambler's Breath (tension):** Stay out as long as you can, then pit with a corner to spare. Anchor: lap 4, fuel light blinking, gap to rival shrinking — you stay out for one more corner, then one more.

2. **The 8-Second Reset (spectacle):** Pure spectacle and relief — 8 seconds between track chaos and clean air. Anchor: cross pit line, camera punches in, lollipop drops, fresh rubber, full tank.

3. **The Race Engineer (strategy underneath):** The pit stop is a weapon. You orchestrate a 5-lap strategy where every stop is calculated. Anchor: pit on lap 2 while rival pits on lap 3, rejoin ahead.

**Pillar alignment:** Every Short Race Matters — pit decisions have immediate, visible consequences within a 5-lap race.

**Design test:** Does the player feel that pitting is a decision with real consequences? Does the pit stop itself feel satisfying?

## Detailed Design

### Core Rules

**1. Pit Stop Trigger**

A pit stop is triggered when the player enters the pit lane zone. Pit stops are optional — the player can skip entirely and race with depleting fuel and worn tires.

**2. Pit Stop Sequence**

1. **Entry:** Car enters pit lane zone. Speed auto-clamped to 80 km/h. Player loses control (automated navigation to pit box).
2. **Navigation:** Car auto-navigates to assigned pit box (16 boxes, one per car).
3. **Stop:** Car stops at pit box. Service begins.
4. **Tire swap:** Binary — old tires removed, new tires installed. Duration: ~2 seconds.
5. **Fuel refill:** Starts at 0.8 L/s (1% tank per 0.1s) until the 8L tank is full.
6. **Player exit:** After the 2s tire swap completes, the player may exit with the fuel loaded so far. If the player does not exit, the car auto-exits as soon as the tank is full.
7. **AI exit:** AI never exits early in MVP; it auto-exits only with a full tank.

**Service duration:** `max(2s, missing_fuel_liters / 0.8 L/s)`. Tire swap and refuel run in parallel; pit-lane navigation and exit are separate transit phases.

**3. Fuel Fill Mechanics**

- Fuel fills continuously at 0.8 L/s. A full empty-to-full refill takes 10s.
- Tire swap always completes at 2s. Only after that point may the player exit with partial fuel.
- AI waits until fuel is full; early AI exit is deferred beyond MVP.

**4. Tire Change Mechanics**

- Tire change is binary: old → new and completes exactly at 2.0s.
- Tire always resets to 0% wear (fresh tires).
- No tire compound choice in MVP (fixed compound).

**5. AI Pit Behavior**

- AI first evaluates pit need after completing lap 1. It forecasts Fuel and Tire resources for the next lap using the first completed lap's actual consumption/wear plus a 10% margin.
- Before beginning a non-final next lap, AI enters pit if its projected resource after the current lap would not cover the next lap's forecast. On the final lap, AI never enters pit.
- AI waits until its tank is full in MVP.

**5a. Player Pit Advisory**

After the player completes lap 1, Pit Stop evaluates whether the player can begin the next non-final lap. It uses the player's last completed-lap Fuel/Tire deltas and the same 10% resource margin as AI. This is intentionally evaluated mid-lap so the player receives warning before pit entry; AI evaluates at the lap boundary. The 1.10× margin value is owned by AI Rival's Tuning Knob (ai-rival.md, "Pit resource safety margin"); the `pit_required_before_next_lap` formula itself is owned by Pit Stop and applies that value consistently for both AI and player.

- `predicted_fuel_at_next_lap_start = current_fuel - last_lap_fuel_use × remaining_racing_progress`
- `predicted_tire_life_at_next_lap_start = (1 - current_tire_wear_fraction) - last_lap_tire_wear_fraction × remaining_racing_progress`
- `next_lap_fuel_required = 1.10 × last_lap_fuel_use`
- `next_lap_tire_required = 1.10 × last_lap_tire_wear`

If either predicted next-lap-start resource is insufficient, Pit Stop outputs `PitThisLap = true`. The HUD displays the transient `PIT THIS LAP` warning from `warning_start_progress` until the player crosses the pit-entry zone. No warning appears before lap 1, during the final lap, or while already in the pit lane.

**6. Pit Stop State**

| State | Duration | Description |
|-------|----------|-------------|
| **Not Pitting** | — | Normal racing outside the pit-entry zone |
| **Pit Transit** | Variable | Car crossed pit-entry zone; 80 km/h clamp and automatic navigation to assigned box; player driving input is disabled |
| **In Pit Box** | `max(2s, missing_fuel / 0.8)` | Tire swap completes at 2s while fuel fills at 0.8 L/s; Confirm may exit after tire completion, AI waits full |
| **Exiting** | ~2s | Car automatically leaves box and merges to track |

### States and Transitions

| State | Entry Condition | Exit Condition |
|-------|-----------------|----------------|
| **Not Pitting** | Race start or pit exit | Vehicle Physics crosses Track pit-entry zone and RSM publishes `PitEntry` |
| **Pit Transit** | RSM `PitEntry` | Car reaches assigned pit box |
| **In Pit Box** | Car stops at box | Confirm (Enter/South) after 2s, or tank becomes full |
| **Exiting** | Player exit / full tank | RSM publishes `PitExit` after car exits pit lane |

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Fuel** | Bidirectional | Pit trigger → fuel fill; Fuel state → service result | Fuel fills only during service and publishes current fuel |
| **Tire** | Bidirectional | Pit trigger → tire swap; Tire state → swap completion | Tire resets to 0% wear at completion |
| **Track** | Inbound | Pit lane geometry, entry/exit points | Pit lane spline and speed limit |
| **Race Session Manager** | Inbound | `PitEntry`, `PitExit`, lap boundary and mapped racing progress | Vehicle Physics detects physical entry; RSM publishes the session event consumed by Pit Stop. |
| **Vehicle Physics** | Bidirectional | Speed limit enforcement, auto-navigation, `PitPhase`, pit events | Pit Stop supplies phase/speed constraints; Vehicle Physics reports movement and pit events |
| **HUD** | Outbound | Pit status, elapsed service time, `tireSwapComplete`, `PitThisLap` | Real-time feedback during pit and transient advisory during Racing |
| **AI Rival** | Bidirectional | AI commits to pit-lane route, navigation and service completion; Pit Stop sends PitPhase and service completion | AI uses the same pit lane, speed cap, box and service flow as player |
| **Camera** | Outbound | `PitPhase`, pit-box arrival/exit | Camera enters PitCamera only during `InPitBox` and returns when Exiting begins |
| **Input System** | Inbound | Direct Confirm action in PitService | InputContextController disables generic UI-module routing in all pit phases and sends Confirm directly to Pit Stop only after tire-swap eligibility |
| **Audio** | Outbound | PitTransit, InPitBox, Exiting events | Audio selects pit movement/service cues |
| **Qualifying** | Inbound | RaceMode.Qualifying check | Hard — pit entry, service, and pit exit are blocked during qualifying; RSM does not publish PitEntry when RaceMode is Qualifying |

## Formulas

**Current live values:** see `Assets/Data/Cars/CarConfig.asset` (ScriptableObject).

### Pit Stop Duration

`fuel_fill_rate = 0.8 L/s` — Fuel System owns fuel_fill_rate; Pit Stop applies it.

`service_duration = max(2.0s, (8.0L - current_fuel) / fuel_fill_rate)`
    — Tire System owns tire_swap_time (2.0s); Pit Stop applies it in parallel with fueling.

Tire swap completes at 2.0s. Player early exit is valid only after tire swap; AI waits through `service_duration` until 8.0L.

### Service Result

At tire-swap completion: `tire_wear_fraction = 0.0`. At service completion: `fuel = 8.0 L`. A player who exits after `service_elapsed_seconds >= 2.0` has `fuel = min(8.0L, fuel_at_entry + 0.8 L/s × service_elapsed_seconds)`.

### AI Pit Projection

`predicted_fuel_per_lap = fuel_consumed_in_last_completed_lap`

`predicted_tire_wear_per_lap = tire_wear_gained_in_last_completed_lap`

`remaining_tire_life = 1.0 - current_tire_wear_fraction`

`fuel_required_for_next_lap = 1.10 × predicted_fuel_per_lap`

`tire_required_for_next_lap = 1.10 × predicted_tire_wear_per_lap`

`pit_required_before_next_lap = NOT is_final_lap AND (fuel_after_current_lap < fuel_required_for_next_lap OR tire_life_after_current_lap < tire_required_for_next_lap)`

Immediately after its first `LapCompleted` event and each later lap boundary, AI uses its measured fuel/tire deltas to decide whether to commit to the pit route for the upcoming non-final lap. It cannot commit before GO or on lap 1, and it never commits for the final lap.

### Player Advisory Start Progress

`warning_start_progress = min(0.80, max(0.0, pit_entry_progress - 0.05))`

`remaining_racing_progress = 1.0 - racing_spline_progress` is the fraction of the current lap remaining, not the remaining race distance.

The 0.05 lead guarantees that a track whose pit entry occurs before 80% still warns before the entry. `PitThisLap` clears immediately when the player crosses the physical pit-entry zone.

## Edge Cases

- **If player enters pit lane with fuel > 80%:** Pit stop still refuels to full. Player wastes time but gains no advantage. Should be rare.
- **If player enters pit lane with tire > 80%:** Pit stop still swaps tires. Player wastes tire life but gains no advantage.
- **If two AI rivals require pit on the same lap:** Both pit. 16 boxes, simultaneous service. No conflict.
- **If player exits after 2s:** Tires are fresh; fuel equals the amount accumulated at 0.8 L/s and can be partial.
- **If the final lap begins:** AI does not enter pit, even if its projection would otherwise request it.
- **If AI projected resources cover remaining laps:** AI skips pit. It may finish with low fuel/tire but does not pit unnecessarily.
- **If player never pits:** Fuel degrades to 0 (car coasts), tire degrades to 0.20 grip floor. Car is drivable but very slow. May lose many positions.
- **If pit lane is blocked (car stopped on track in pit lane):** Not possible in MVP — each pit box is an independent bay offset from the fast lane (see Track System §7 — two-lane F1 model). A car stopped in its box does not block the fast lane or other boxes.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Fuel** | Bidirectional | Fuel fill | Hard — pit refuels fuel |
| **Tire** | Bidirectional | Pit trigger → tire swap; Tire state → swap completion | Hard — pit changes tires and reads swap status |
| **Track** | Inbound | Pit lane geometry | Hard — pit lane is part of track |
| **Vehicle Physics** | Bidirectional | Speed limit, auto-nav, PitPhase, pit events | Hard — Pit Stop supplies constraints; Vehicle Physics reports movement and events |
| **HUD** | Outbound | Pit status display | Hard — player needs feedback |
| **AI Rival** | Bidirectional | AI commits to pit-lane route, navigation and service completion | Hard — AI uses the same pit lane, speed cap, box and service flow as player |
| **Race Session Manager** | Inbound | PitEntry, PitExit, lap boundary, mapped progress | Hard — owns race/session events consumed by Pit Stop |
| **Camera** | Outbound | PitPhase and pit-box anchors | Hard — owns PitCamera presentation |
| **Qualifying** | Inbound | RaceMode.Qualifying check | Hard — pit entry, service, and exit are blocked during qualifying |
| **Input System** | Inbound | Direct Confirm action in PitService | Hard — generic UI Submit/Cancel/navigation remain disabled; direct Confirm permits manual player exit |
| **Audio** | Outbound | Pit phase events | Soft — plays pit movement/service cues |

## Tuning Knobs

**Authority note:** Track System owns `pit_lane_speed_limit`, Fuel System owns `fuel_fill_rate`, and Tire System owns `tire_swap_time`; Pit Stop applies all three during service.

Pit Stop does not own unique tuning knobs in MVP. See Fuel, Tire, Track, and AI Rival for the authoritative values it consumes during service.

## Visual/Audio Requirements

- **Pit lane approach:** Visual markers (banners, lines) indicating pit entry. Audio cue: "Box this lap" radio message (optional).
- **Pit stop animation:** On entering InPitBox, Camera blends to PitCamera. Crew swaps tires (2s), fuel nozzle fills at 0.8 L/s, and the lollipop man drops when player exits after 2s or fuel reaches full. Exiting blends back to the player-selected camera.
- **HUD during pit:** Fuel fill progress, tire-swap status, and an exit prompt after 2s. AI has no early-exit UI.
- **Pit exit:** Camera pulls back. Car merges onto track. Audio: engine revs up.

## UI Requirements

- **Race HUD:** Track Map receives pit-lane spline and entry marker directly from Track. `PIT THIS LAP` is a transient advisory when Pit Stop predicts the player cannot begin the next non-final lap with Fuel or Tire resources plus 10% margin.
- **Pit stop HUD:** Fuel fill progress, tire-swap status and early-exit prompt after 2s.
- **Pre-race:** Pit strategy recommendation (optional).

> **📌 UX Flag — Pit Stop**: This system has UI requirements. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for the pit stop HUD before writing epics.

## Acceptance Criteria

- **GIVEN** a car entering pit lane, **WHEN** speed is checked, **THEN** speed is clamped to 80 km/h or less.
- **GIVEN** an empty tank enters pit, **WHEN** 10s of service elapse, **THEN** fuel is exactly 8.0L and tire wear is 0%.
- **GIVEN** a player enters pit with 4.0L, **WHEN** 2.0s elapse and the player exits, **THEN** tire wear is 0% and fuel is 5.6L ± 0.01L.
- **GIVEN** a player presses exit before 2.0s, **WHEN** tire swap is incomplete, **THEN** no exit occurs.
- **GIVEN** a player reaches the pit-entry zone, **WHEN** Vehicle Physics reports crossing after `Physics.Simulate()`, **THEN** the next tick starts Pit Transit automatically without a gameplay input.
- **GIVEN** Pit Transit is active, **WHEN** Accelerate, Brake, or Steer is pressed, **THEN** no player driving input changes the automated pit route.
- **GIVEN** PitTransit, InPitBox, or Exiting is active, **WHEN** generic UI navigation, Submit, or Cancel is attempted, **THEN** `InputSystemUIInputModule` remains disabled and no UI handler executes.
- **GIVEN** InPitBox tire swap is complete, **WHEN** Enter/South rises, **THEN** InputContextController delivers one direct Confirm to Pit Stop and Exiting begins without a generic UI Submit event.
- **GIVEN** tire swap reaches exactly 2.0s, **WHEN** PitService is displayed, **THEN** its Enter/South exit prompt becomes active and `tireSwapComplete` is true.
- **GIVEN** the player does not press Enter/South, **WHEN** fuel reaches 8.0L, **THEN** Exiting begins automatically.
- **GIVEN** a car is in Pit Transit, In Pit Box, or Exiting, **WHEN** Fuel and Tire update, **THEN** driving fuel consumption and Tire wear do not accumulate; In Pit Box fuel refill at 0.8 L/s remains active.
- **GIVEN** an AI enters pit with 4.0L, **WHEN** 2.0s elapse, **THEN** it remains in service until fuel is exactly 8.0L.
- **GIVEN** an AI has completed lap 1 and its post-current-lap Fuel or Tire projection cannot cover the next lap plus 10%, **WHEN** the next lap is not final, **THEN** AI pits regardless of difficulty.
- **GIVEN** an AI is about to begin the final lap, **WHEN** Fuel or Tire projection cannot cover that lap, **THEN** AI does not enter pit.
- **GIVEN** the player has completed lap 1, is not on the final lap, and predicted next-lap-start Fuel or Tire cannot cover the next lap plus 10%, **WHEN** racing spline progress reaches `warning_start_progress`, **THEN** `PIT THIS LAP` displays.
- **GIVEN** pit entry occurs at 0.72 progress, **WHEN** the player needs pit, **THEN** `warning_start_progress` is 0.67 and the warning appears before pit entry.
- **GIVEN** `PIT THIS LAP` is visible, **WHEN** the player crosses the pit-entry zone, **THEN** the warning clears immediately.
- **GIVEN** the player is on lap 1 or the final lap, **WHEN** Fuel or Tire would otherwise trigger advisory, **THEN** `PIT THIS LAP` does not display.
- **GIVEN** a player who never pits, **WHEN** fuel reaches 0%, **THEN** car coasts and can still reach pit lane by momentum.
- **GIVEN** 16 cars pitting simultaneously, **WHEN** all boxes are occupied, **THEN** all 16 are serviced without conflict.

## Open Questions

- **Pit stop visual fidelity:** MVP requires the service states and camera presentation; exact crew animation fidelity is an art-production detail.
- **Pit lane audio:** MVP guarantees the player's own pit cues; other-car pit audio is optional ambient detail.
- **Multiple pit stops:** Multiple stops are allowed; MVP does not impose a separate two-stop strategy rule.
- **Pit stop penalty:** Pit exit is safe in MVP; no unsafe-exit penalty or collision rule is introduced.
