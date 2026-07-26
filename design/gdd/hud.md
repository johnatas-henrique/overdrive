# HUD

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Speed You Can Feel

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Race, qualifying, pit, and results HUD information for local races. |
| MVP architecture constraints | HUD reads authoritative local race state and remains legible at racing speed. |
| Alpha | Ghost delta and any per-car cockpit placement additions. |
| Beta | Not designed. |
| Release | Not designed. |

### Review Boundary
Ghost UI is non-blocking during MVP review unless it changes MVP HUD state contracts.

## Overview

**HUD** displays race-critical information during gameplay. Universal layout shared by all 16 cars, with cosmetic variations per team (team color, team icon). Designed for fast reading at 200+ km/h — every element must be comprehensible in under 0.5 seconds. The HUD is the player's instrument panel: speed, fuel, tire, position, lap, and rival state. Cockpit camera is primary; chase camera is the optional tactical view. References: Top Gear dashboard, 4PGP, Super Monaco GP.

## Player Fantasy

**Framing:** Direct — the player actively reads and reacts to HUD information during races.

**Emotional target:** Two layers:

1. **The Dashboard Confidence (instruments you trust):** Like Top Gear's instrument panel — you glance at fuel, tire, speed, and you know exactly where you stand. No ambiguity, no guessing. The HUD tells you what's true, and you make the call. Anchor: lap 3 of 5, you're P4, fuel bar half-empty, tire bar amber — you know to push or conserve without thinking.

2. **The Rival Pulse (the duel is visible):** Like SMGP's position awareness — you see the rival behind you, their gap, their state. The race isn't just numbers, it's a conversation with the car ahead. Anchor: lap 4, rival 0.4s behind, their tire arc red while yours is white — you know they're struggling, you defend.

**Pillar alignment:** Speed You Can Feel — HUD elements are designed for sub-0.5s reading at speed. Every Short Race Matters — fuel and tire bars make strategic decisions visible. Rivals Make the Grid Personal — rival state is always on screen.

**Design test:** Can the player read fuel, tire, speed, and position in under 0.5 seconds while racing at 200+ km/h?

## Detailed Design

### Core Rules

**1. HUD Elements (Chase Camera — 7 elements in MVP, 8 with Ghost Recording)**

| # | Element | Data Source | Position | Size | Phase |
|---|---------|-------------|----------|------|-------|
| 1 | **Speed** | Vehicle Physics (km/h) | Bottom-center | Large — primary reference | MVP |
| 2 | **Position/Lap** | Race Session Manager (position, lap/total) | Top-left | Medium — always visible | MVP |
| 3 | **Fuel Bar** | Fuel (0-100%) | Bottom-left | Horizontal bar with state-color fill and numeric "X.X L" readout below | MVP |
| 4 | **Tire Bar** | Tire remaining life (0-100%) | Bottom-left, below fuel | Horizontal bar, state-color fill | MVP |
| 5 | **Race Time** | Simulation (elapsed) | Top-right | Small — secondary reference | MVP |
| 6 | **Rival Gap** | Race Session Manager (gap in seconds) | Right-center | Medium — always visible | MVP |
| 7 | **Track Map** | Race Session Manager positions + Track geometry | Bottom-right | Mini-map: main spline, pit-lane spline, pit-entry marker and all 16 cars | MVP |
| 8 | **Ghost Delta** | Ghost Recording (time delta) | Below speed | Small, appears only when ghost is active | Alpha |

`PIT THIS LAP` is a transient advisory, not an eighth persistent HUD element. It appears only when Pit Stop outputs `PitThisLap = true` and clears at pit entry.

**2. HUD Elements (Cockpit Camera — 4 elements minimum, up to 11 with overlay)**

| # | Element | Data Source | Position | Notes |
|---|---------|-------------|----------|-------|
| 1 | **Position/Lap** | Race Session Manager | Top-left | Same as chase |
| 2 | **Fuel Warning** | Fuel (state only) | Dashboard area | Color flash only (yellow/red), no bar |
| 3 | **Tire Warning** | Tire (state only) | Dashboard area | Color flash only, no bar |
| 4 | **Rival Gap** | Race Session Manager | Right-center | Same as chase |

**Cockpit Overlay (Settings option):** Player can disable "Show Chase HUD in Cockpit" in Settings. When enabled by default during Race, all 7 active Chase elements are overlaid on the cockpit view (total: 11 elements including the 4 cockpit elements). In Qualifying, the overlay respects the Qualifying state and does not reintroduce the race-only Rival Gap or Track Map. The player may turn it off to restore the minimal cockpit HUD. This is a readability preference, not a hard element-count limit; the 0.5-second reading target and maximum 2 pieces of information per glance still apply.

**Note (Alpha/Beta):** When additional cars become playable, each cockpit has a different dashboard layout. Cockpit HUD positioning may need per-car adjustment to avoid overlapping dashboard elements. This is deferred to Alpha/Beta when cockpit variants are implemented.

**3. Team Cosmetic Variations**

- **Full theming:** HUD background tint, element borders, and all accent text use team colors
- **Team color application:** Element borders, position number, speed text accent, and non-state decorative accents. Fuel and tire fills use state colors first.
- **Team icon:** Small badge next to position display
- **Fallback:** If team color has low contrast with track (e.g., yellow on desert), auto-adjust to white/black outline for readability

**4. HUD States**

| State | Elements Active | Notes |
|-------|----------------|-------|
| **Race** | All 7 (chase) / 4 (cockpit) | Full HUD during race |
| **Qualifying** | Speed, Position/Lap, Race Time | No rival gap or track map; cockpit overlay does not add race-only elements |
| **Countdown** | Countdown overlay | Race time hidden; five-light sequence is authoritative |
| **Finished** | Terminal presentation | Race HUD suppressed; result/presentation UI owns the screen |
| **Paused** | Last authoritative telemetry behind pause UI | Race HUD does not advance; a Performance pause exposes only Resume and Return to Menu |
| **Pit** | Race HUD during PitTransit/Exiting; service overlay only during InPitBox | Race telemetry remains visible while navigating the lane. InPitBox shows fuel fill progress, tire-swap completion, elapsed service timer, and exit prompt after 2s. |
| **Results** | Full-screen takeover | Normal finish shows position, time, stats, and rival results. Forfeit shows classification, completed laps, and accumulated race time; no final position or projected AI order is shown. |

**5. Reading Speed Budget**

Every element must be readable in **under 0.5 seconds** at 200+ km/h. This means:
- Maximum 2 pieces of information per glance
- Color carries state (green/yellow/red), numbers carry precision
- Font size: minimum 16px at 1080p for secondary, 24px for primary
- High contrast: white text on dark background with 2px outline

### States and Transitions

| State | Entry Condition | Exit Condition | HUD Mode |
|-------|-----------------|----------------|----------|
| **Qualifying** | Qualifying starts | Qualifying ends | Timer-focused (3 elements) |
| **Countdown** | Simulation enters Countdown | GO | Countdown overlay; race timer remains 0.0 |
| **Race** | Race starts | Race ends or InPitBox service begins | Full HUD (7/4 elements); PitTransit and Exiting retain the race HUD |
| **Finished** | Player objective ends | Finished Presentation dismissed after `resolutionComplete`; then Race Results, or Qualifying Results confirms Start Race and transitions Loading | Player-car terminal presentation; HUD reads immutable `resultKind`, `resolutionComplete`, and resolved result metadata from PublishedSimulationSnapshot while continuing to read live domain telemetry from each owner; Continue is enabled only when resolution is complete |
| **Paused** | Simulation enters Paused | Player resumes or quits | Last authoritative telemetry remains behind pause UI; Performance pause shows Resume and Return to Menu only |
| **Pit** | Car enters pit lane | Car exits pit lane | Race HUD during PitTransit/Exiting; four-element service overlay only in InPitBox |
| **Results** | Finished Presentation is dismissed after `resolutionComplete` | Player dismisses results or selects the next flow | Full-screen takeover |

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Fuel** | Inbound | Fuel level (0-100%), state (Full/Conserving/Critical/Empty) | Drives fuel bar fill + color |
| **Tire** | Inbound | Tire wear (0-100%), grip multiplier | Drives tire bar fill + color |
| **Vehicle Physics** | Inbound | Speed (km/h), gear | Drives speed display |
| **Race Session Manager** | Inbound | Position (1-16), lap (current/total), racing spline progress, pit proximity, rival gap | Drives position/lap, track map and rival gap |
| **Track** | Inbound | Main spline, pit-lane spline, pit-entry marker | Drives Track Map geometry and pit-entry location. |
| **Pit Stop** | Inbound | `PitThisLap`, pit-service elapsed time, `tireSwapComplete` | Drives transient advisory and Pit HUD state. |
| **Simulation** | Inbound | `sim_time`, `SimulationState`, countdown remaining ticks, `PerformanceReduced { severity, observedFps }`, and Finished-only immutable result metadata | Drives race time, countdown, presentation-state transitions and the transient performance warning. During Loading, Paused, Finished, or Results, HUD reads the last authoritative speed/fuel/tire/position outputs retained by their owners until active simulation resumes. |
| **Car Definition Data** | Inbound | Team color, team icon | Drives cosmetic theming |
| **Ghost Recording** | Inbound | Time delta (Alpha+) | Drives ghost delta element |
| **Input System** | Inbound | Input availability state only | Drives the transient NoInputDevice overlay; no persistent device icon |
| **Camera** | Inbound | Camera mode | Selects the cockpit/chase HUD layout and overlay behavior |
| **Settings** | Inbound | text scale, Colorblind mode, and `show_chase_hud_in_cockpit` | Applies accessibility scaling/palette and the cockpit overlay preference through transactional preview |

## Formulas

**Current live values:** see HUD configuration (no ScriptableObject — UI values are designer-tuned).

### Color Thresholds

**Fuel bar color:**
- Green: fuel > 50%
- Yellow: fuel 25-50%
- Red: fuel < 25%

**Tire bar color:**
- Green: tire > 50%
- Yellow: tire 25-50%
- Red: tire < 25%

### Rival Gap Display

`rival_gap_display = round(rival_gap_seconds, 1)` — always one decimal place.

If gap < 0.1s: display "0.0" (too close to measure).

### Track Map Scale

Mini-map scale: `map_scale = track_length / map_size_pixels`. All 16 cars shown as dots, player car highlighted.

## Edge Cases

- **If player has no rival (P1, no one behind):** Rival gap shows "LEADER" instead of a time gap.
- **If rival gap > 10 seconds:** Display ">10s" — exact distance irrelevant.
- **If fuel is 0%:** Fuel bar empty, red flash every 2 seconds, "FUEL EMPTY" text overlay.
- **If tire is at grip floor (0.20):** Tire bar empty, red flash, "TYRES WORN" text overlay.
- **If no input scheme is available:** HUD continues rendering authoritative race telemetry, displays the transient "NO INPUT DEVICE" overlay, and removes it when Input System reports an available scheme. A partial gamepad disconnect with KeyboardMouse fallback does not show an overlay.
- **If qualifying and player hasn't started:** Timer shows "--:--" until first input.
- **At 2s pit service:** Tire bar shows 100% remaining (0% wear) and player exit prompt becomes active; fuel bar remains live.
- **At full fuel:** Fuel bar shows full and auto-exit occurs if player has not already left.
- **If `PIT THIS LAP` is active:** Warning remains visible from `warning_start_progress` until physical pit entry, then clears.
- **If results screen and player disconnects:** Local Results remain open; network/disconnect state has no effect on the results flow.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Fuel** | Inbound | Fuel level + state | Hard — drives fuel bar |
| **Tire** | Inbound | Tire wear + grip | Hard — drives tire bar |
| **Vehicle Physics** | Inbound | Speed + gear | Hard — drives speed display |
| **Race Session Manager** | Inbound | Position, lap, pit proximity, rival gap | Hard — drives position/lap, map and rival display |
| **Simulation** | Inbound | Race time, state, performance signal | Hard — drives time, state transitions and performance warning |
| **Car Definition Data** | Inbound | Team color, icon | Hard — drives cosmetic theming |
| **Content Pipeline** | Inbound | Loading progress, asset readiness | Hard — drives race-load progress UI |
| **Ghost Recording** | Inbound | Time delta | Soft — Alpha+ only |
| **Input System** | Inbound | Input availability | Soft — drives only the NoInputDevice overlay |
| **Camera** | Inbound | Camera mode | Hard — selects cockpit/chase layout |
| **Track** | Inbound | Main and pit spline geometry | Hard — drives Track Map geometry |
| **Pit Stop** | Inbound | PitThisLap and service state | Hard — drives advisory and InPitBox overlay |
| **Settings** | Inbound | Colorblind mode and cockpit overlay preference | Hard — drives accessibility and layout preference |

## Tuning Knobs

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Fuel warning threshold | 25% | 15-35% | Warning too late | Warning too early |
| Tire warning threshold | 25% | 15-35% | Warning too late | Warning too early |
| Rival gap display precision | 0.1s | 0.05-0.5s | Too precise (unreadable) | Too coarse (meaningless) |
| Track map scale | Auto | Fixed/Auto | Map too small | Map too large |
| Font size (primary) | 24px | 18-32px | Too small at speed | Too large, blocks view |
| Font size (secondary) | 16px | 12-20px | Too small | Too large |
| HUD opacity | 85% | 70-100% | Too transparent (unreadable) | Too opaque (blocks view) |
| Cockpit overlay | On | On/Off | N/A | N/A |

## Visual/Audio Requirements

- **Fuel bar:** Horizontal fill bar, team color, depletes left-to-right. Pulse animation when <25%.
- **Tire bar:** Horizontal fill bar, color-coded (green/yellow/red). No pulse — wear is continuous.
- **Speed:** Large numeric display, team color accent. No units displayed (km/h implicit).
- **Position/Lap:** "P1 L3/5" format. Position bold, lap secondary.
- **Rival gap:** "+0.4s" format. Green if gaining, red if losing, white if stable.
- **Track map:** Semi-transparent mini-map showing main spline, pit-lane spline, pit-entry marker and all 16 cars as dots. Player = white dot with ring.
- **Team theming:** Background tint at 20% opacity, element borders in team color, accent text in team color.
- **State transitions:** Fade in/out (150ms, ease-out). No pop-in.
- **Performance warning:** When Simulation emits `PerformanceReduced`, show a compact non-blocking `PERFORMANCE REDUCED` overlay. When Simulation pauses for Performance, the pause UI explains Resume or Return to Menu; authoritative HUD telemetry remains visible behind it.

## UI Requirements

> **📌 UX Flag — HUD**: This system has UI requirements. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for the race HUD before writing epics. Stories that reference UI should cite `design/ux/race-hud.md`, not the GDD directly.

## Acceptance Criteria

- **GIVEN** a race in progress, **WHEN** player looks at HUD, **THEN** all 7 chase elements are visible and readable in under 0.5 seconds.
- **GIVEN** fuel at 30%, **WHEN** fuel bar is displayed, **THEN** bar shows yellow (between 25-50% threshold).
- **GIVEN** fuel at 20%, **WHEN** fuel bar is displayed, **THEN** bar shows red and pulses.
- **GIVEN** tire remaining life is 40% (60% wear), **WHEN** tire bar is displayed, **THEN** bar shows yellow (between 25-50% threshold).
- **GIVEN** rival 0.4s behind, **WHEN** rival gap is displayed, **THEN** shows "+0.4" with appropriate color.
- **GIVEN** player is P1, **WHEN** rival gap is displayed, **THEN** shows "LEADER" instead of time.
- **GIVEN** cockpit camera active with `Show Chase HUD in Cockpit` disabled, **WHEN** HUD is displayed, **THEN** only 4 elements show (position/lap, fuel warning, tire warning, rival gap).
- **GIVEN** Pit Stop is in `InPitBox`, **WHEN** HUD is displayed, **THEN** the service overlay shows elapsed pit-service time instead of speed; PitTransit and Exiting retain the race HUD.
- **GIVEN** qualifying active, **WHEN** HUD is displayed, **THEN** only speed, position/lap, and race time shown.
- **GIVEN** a normal finish reaches Results, **WHEN** the results screen appears, **THEN** full-screen takeover shows position, time, and stats; Forfeit uses its separate result contract.
- **GIVEN** team_tier1_a (Madonna), **WHEN** HUD is displayed, **THEN** elements use Madonna's team color for borders and accents.
- **GIVEN** team_tier4_d (ZeroForce), **WHEN** HUD is displayed, **THEN** elements use ZeroForce's team color, with auto-contrast adjustment if needed.
- **GIVEN** cockpit camera with overlay enabled during Race, **WHEN** HUD is displayed, **THEN** all 7 active Chase elements are overlaid on cockpit view.
- **GIVEN** cockpit camera with overlay disabled, **WHEN** HUD is displayed, **THEN** only 4 minimal elements shown.
- **GIVEN** qualifying is active with cockpit overlay enabled, **WHEN** HUD is displayed, **THEN** the overlay does not add Rival Gap or Track Map to the three-element Qualifying HUD.
- **GIVEN** cockpit camera with overlay enabled by default, **WHEN** HUD is displayed, **THEN** all 7 Chase elements are overlaid with the 4 cockpit elements, for 11 total, while the 0.5-second reading target remains documented.
- **GIVEN** a new profile uses Settings defaults, **WHEN** cockpit HUD is first shown, **THEN** `show_chase_hud_in_cockpit = On` and the documented 11-element composition is active.
- **GIVEN** Settings previews text scale 150%, **WHEN** HUD reflows, **THEN** every active element uses the working scale without clipping and Cancel restores the prior scale.
- **GIVEN** player disables `Show Chase HUD in Cockpit`, **WHEN** cockpit HUD is displayed, **THEN** only the 4 minimal cockpit elements remain.
- **GIVEN** Input System reports no available scheme, **WHEN** HUD updates, **THEN** authoritative telemetry remains visible and the "NO INPUT DEVICE" overlay is shown.
- **GIVEN** Simulation emits `PerformanceReduced`, **WHEN** HUD updates, **THEN** a non-blocking PERFORMANCE REDUCED overlay is shown without replacing race telemetry.
- **GIVEN** Pit Stop emits `PitThisLap = true`, **WHEN** the player is before physical pit entry, **THEN** the transient PIT THIS LAP advisory is visible and clears at pit entry.
- **GIVEN** a Forfeit result, **WHEN** Results opens, **THEN** classification, completed laps, and accumulated race time are shown without a final position or projected AI order.

**Accessibility requirement:** HUD consumes Settings colorblind mode. Fuel and tire states retain non-color cues through labels, thresholds, and a UX-specified pattern treatment. Exact palette/pattern mapping is defined by the HUD UX specification before implementation.

## Open Questions

- **HUD layout for widescreen vs ultrawide:** Should the HUD scale with aspect ratio, or use fixed positions? Affects track map and rival gap placement.
- **Split-screen HUD:** If local multiplayer is added later, how does the HUD shrink? Or is HUD simplified for split-screen?
- **HUD customization:** Should the player be able to reposition or hide HUD elements? Or is the layout fixed?
- **Pit countdown format:** Should it show seconds remaining, or a progress bar? Or both?
