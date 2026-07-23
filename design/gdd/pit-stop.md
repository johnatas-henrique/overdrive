# Pit Stop

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-21
> **Implements Pillar**: Every Short Race Matters

## Overview

**Pit Stop** is the recovery mechanism that turns fuel and tire management into strategic decisions. It gives the player a choice: spend 8-10 seconds in the pit lane to refuel and change tires, or stay out and risk running out of fuel or losing grip. The pit stop is the consequence that makes resource management matter — without it, fuel and tire would be theoretical concerns rather than race-defining choices.

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
5. **Fuel fill:** Gradual — fills during the remaining 6-8 seconds. Full tank (8L) takes 8-10 seconds total.
6. **Early exit (optional):** After tire swap completes (~2s), HUD shows "Hold [PIT EXIT] to leave early." Player holds button → car exits with current fuel level. If player does nothing, car waits full 8-10s and exits with full tank.
7. **Exit:** Car auto-exits pit lane. Player regains control at pit exit point.

**Total pit duration:** 8-10 seconds (tire swap + fuel fill happen in parallel, not sequentially).

**3. Fuel Fill Mechanics**

- Fuel fills gradually during the 8-10 second pit window.
- Fill rate: 8L / 10s = 0.8 L/s (fills completely in 10 seconds).
- If player exits early (after 2s tire swap), fuel is partial: ~1.6L added.
- Player can see fuel level rising in real time on HUD during pit stop.

**4. Tire Change Mechanics**

- Tire change is binary: old → new. Instant swap, ~2 seconds.
- Tire always resets to 0% wear (fresh tires).
- No tire compound choice in MVP (fixed compound).

**5. AI Pit Behavior**

- AI pits when fuel OR tire crosses a threshold.
- Threshold varies by difficulty:
  - Very Easy: 40% fuel / 40% tire
  - Normal: 30% fuel / 30% tire
  - Hard: 20% fuel / 20% tire
- **Lap remaining check:** If AI hits threshold with 1 lap remaining, it checks whether it can finish the race without pitting. If yes → skip pit. If no → pit. This prevents unnecessary pit stops on the last lap.
- AI always waits full pit duration (no early exit).

**6. Pit Stop State**

| State | Duration | Description |
|-------|----------|-------------|
| **Approaching** | Variable | Car entering pit lane, speed clamped |
| **Navigating** | ~2s | Car moving to pit box |
| **Tire Swap** | ~2s | Old tires off, new tires on |
| **Refueling** | 0-8s | Fuel filling (overlaps with tire swap) |
| **Early Exit** | After ~2s | Player can leave with partial fuel |
| **Exiting** | ~2s | Car leaving pit box, returning to track |

### States and Transitions

| State | Entry Condition | Exit Condition |
|-------|-----------------|----------------|
| **Not Pitting** | Race start | Player enters pit lane zone |
| **Approaching** | Car enters pit lane | Car reaches pit box |
| **In Pit Box** | Car stops at box | Service complete OR early exit button pressed |
| **Exiting** | Service complete / early exit | Car exits pit lane zone |
| **Not Pitting** | Car exits pit lane | Race end OR player enters pit lane again |

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Fuel** | Bidirectional | Pit trigger → fuel fill | Fuel fills during pit window |
| **Tire** | Outbound | Pit trigger → tire swap | Tire resets to 0% wear |
| **Track** | Inbound | Pit lane geometry, entry/exit points | Pit lane spline and speed limit |
| **Vehicle Physics** | Outbound | Speed limit enforcement, auto-navigation | Car controlled by system during pit |
| **HUD** | Outbound | Pit status, fuel fill progress, early exit prompt | Real-time feedback during pit |
| **AI Rival** | Outbound | AI pit decision, threshold, lap check | AI pits based on difficulty threshold |
| **Settings** | Inbound | Difficulty level | AI pit threshold scales with difficulty |

## Formulas

**Current live values:** see `Assets/Data/Cars/CarConfig.asset` (ScriptableObject).

### Pit Stop Duration

`pit_duration = max(tire_swap_time, fuel_fill_time)`

Tire swap (~2s) and fuel fill (~8-10s) happen in parallel. Total duration is the longer of the two: 8-10 seconds.

### Fuel Fill Rate

`fuel_fill_rate = tank_capacity / max_fill_time`

With tank = 8L and max fill time = 10s: fill rate = 0.8 L/s.

**Fuel added during pit:** `fuel_added = fuel_fill_rate × time_in_pit`

Early exit after 2s: ~1.6L added. Full 10s: 8L (full tank).

### AI Pit Threshold

`pit_threshold = base_threshold × difficulty_modifier`

| Difficulty | Base Threshold | Effective Range |
|------------|---------------|-----------------|
| Very Easy | 0.40 | Fuel ≤ 40% OR tire ≤ 40% |
| Easy | 0.35 | Fuel ≤ 35% OR tire ≤ 35% |
| Normal | 0.30 | Fuel ≤ 30% OR tire ≤ 30% |
| Hard | 0.25 | Fuel ≤ 25% OR tire ≤ 25% |
| Very Hard | 0.20 | Fuel ≤ 20% OR tire ≤ 20% |

**Lap remaining check:** `can_finish = (current_fuel / consumption_rate) > remaining_race_time`

If true → skip pit. If false → pit.

## Edge Cases

- **If player enters pit lane with fuel > 80%:** Pit stop still refuels to full. Player wastes time but gains no advantage. Should be rare.
- **If player enters pit lane with tire > 80%:** Pit stop still swaps tires. Player wastes tire life but gains no advantage.
- **If player exits early with very low fuel:** Car may run out of fuel shortly after pit exit. Player must manage the trade-off.
- **If two AI rivals hit threshold on same lap:** Both pit. 16 boxes, simultaneous service. No conflict.
- **If AI can finish race without pitting (lap remaining check):** AI skips pit. Stays out with low fuel/tire. May lose positions but finishes.
- **If player never pits:** Fuel degrades to 0 (car coasts), tire degrades to 0.20 grip floor. Car is drivable but very slow. May lose many positions.
- **If pit lane is blocked (car stopped on track in pit lane):** Not possible in MVP — 16 boxes, one per car, simultaneous service.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Fuel** | Bidirectional | Fuel fill | Hard — pit refuels fuel |
| **Tire** | Outbound | Tire swap | Hard — pit changes tires |
| **Track** | Inbound | Pit lane geometry | Hard — pit lane is part of track |
| **Vehicle Physics** | Outbound | Speed limit, auto-nav | Hard — car controlled during pit |
| **HUD** | Outbound | Pit status display | Hard — player needs feedback |
| **AI Rival** | Outbound | AI pit decisions | Hard — AI must pit strategically |
| **Settings** | Inbound | Difficulty threshold | Hard — AI behavior scales |

## Tuning Knobs

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Pit stop duration | 8-10 s | 6-15 s | Pits too fast (no penalty) | Pits too slow (always costly) |
| Tire swap time | 2 s | 1-4 s | Instant (no spectacle) | Too slow |
| Fuel fill rate | 0.8 L/s | 0.5-2.0 L/s | Takes forever | Fuel fills too fast |
| AI threshold (Normal) | 30% | 20-40% | AI never pits | AI pits every lap |
| Early exit available after | 2 s | 1-3 s | Before tires done | Too long to wait |
| Pit lane speed limit | 80 km/h | 60-120 km/h | Pits too slow | Speeding in pits |

## Visual/Audio Requirements

- **Pit lane approach:** Visual markers (banners, lines) indicating pit entry. Audio cue: "Box this lap" radio message (optional).
- **Pit stop animation:** Camera punches in. Crew swaps tires (2s), fuel nozzle attached (8-10s). Lollipop man holds sign, drops when ready.
- **HUD during pit:** Fuel bar filling in real time. Tire bar reset to 100%. "Hold [PIT EXIT] to leave early" prompt after 2s.
- **Pit exit:** Camera pulls back. Car merges onto track. Audio: engine revs up.

## UI Requirements

- **Race HUD:** Pit indicator (distance to pit entry, recommended pit window).
- **Pit stop HUD:** Fuel fill progress, tire swap status, early exit button prompt.
- **Pre-race:** Pit strategy recommendation (optional).

> **📌 UX Flag — Pit Stop**: This system has UI requirements. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for the pit stop HUD before writing epics.

## Acceptance Criteria

- **GIVEN** a car entering pit lane, **WHEN** speed is checked, **THEN** speed is clamped to 80 km/h or less.
- **GIVEN** a pit stop, **WHEN** tire swap begins, **THEN** tires are at 100% within 2 seconds ± 0.5s.
- **GIVEN** a pit stop, **WHEN** fuel fill begins, **THEN** fuel increases at 0.8 L/s ± 0.1.
- **GIVEN** a pit stop with early exit after 2s, **WHEN** car exits pit, **THEN** fuel is approximately 1.6L (not full).
- **GIVEN** a pit stop with full duration (10s), **WHEN** car exits pit, **THEN** fuel is 8L (full tank).
- **GIVEN** AI with Normal difficulty and fuel at 30%, **WHEN** pit decision is evaluated, **THEN** AI pits.
- **GIVEN** AI with Normal difficulty and fuel at 30% with 1 lap remaining, **WHEN** lap remaining check runs, **THEN** AI skips pit if it can finish.
- **GIVEN** a player who never pits, **WHEN** fuel reaches 0%, **THEN** car coasts and can still reach pit lane by momentum.
- **GIVEN** 16 cars pitting simultaneously, **WHEN** all boxes are occupied, **THEN** all 16 are serviced without conflict.
- **GIVEN** a pit stop, **WHEN** the player presses [PIT EXIT] before 2s, **THEN** nothing happens (button not active yet).

## Open Questions

- **Pit stop visual fidelity:** Should the pit stop show a full crew animation (realistic) or a simplified graphic (arcade)? Affects art production scope.
- **Pit lane audio:** Should the player hear other cars pitting? Or just their own pit stop audio?
- **Pit strategy UI:** Should the HUD show recommended pit window (e.g., "Pit in 2 laps")? Or leave it to the player?
- **Multiple pit stops:** Should the game support/optimize for 2-stop strategies? Or is 0-stop vs 1-stop the intended decision space?
- **Pit stop penalty:** Should there be a penalty for unsafe pit exit (e.g., cutting across the track)? Or is pit exit always safe?
