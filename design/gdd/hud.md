# HUD

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-22
> **Implements Pillar**: Speed You Can Feel

## Overview

**HUD** displays race-critical information during gameplay. Universal layout shared by all 16 cars, with cosmetic variations per team (team color, team icon). Designed for fast reading at 200+ km/h — every element must be comprehensible in under 0.5 seconds. The HUD is the player's instrument panel: speed, fuel, tire, position, lap, and rival state. Chase camera is primary; cockpit camera is secondary. References: Top Gear dashboard, 4PGP, Super Monaco GP.

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
| 2 | **Position/Lap** | Track (position, lap/total) | Top-left | Medium — always visible | MVP |
| 3 | **Fuel Bar** | Fuel (0-100%) | Bottom-left | Horizontal bar, team color fill | MVP |
| 4 | **Tire Bar** | Tire (0-100%) | Bottom-left, below fuel | Horizontal bar, color-coded | MVP |
| 5 | **Race Time** | Simulation (elapsed) | Top-right | Small — secondary reference | MVP |
| 6 | **Rival Gap** | AI Rival (gap in seconds) | Right-center | Medium — always visible | MVP |
| 7 | **Track Map** | Track (position on spline) | Bottom-right | Mini-map, all 16 cars | MVP |
| 8 | **Ghost Delta** | Ghost Recording (time delta) | Below speed | Small, appears only when ghost is active | Alpha |

**2. HUD Elements (Cockpit Camera — 4 elements minimum, up to 12 with overlay)**

| # | Element | Data Source | Position | Notes |
|---|---------|-------------|----------|-------|
| 1 | **Position/Lap** | Track | Top-left | Same as chase |
| 2 | **Fuel Warning** | Fuel (state only) | Dashboard area | Color flash only (yellow/red), no bar |
| 3 | **Tire Warning** | Tire (state only) | Dashboard area | Color flash only, no bar |
| 4 | **Rival Gap** | AI Rival | Right-center | Same as chase |

**Cockpit Overlay (Settings option):** Player can enable "Show Chase HUD in Cockpit" in Settings. When enabled, all 7 chase elements are overlaid on the cockpit view (total: up to 11 elements). Disabled by default — cockpit fantasy is "inside the machine" with minimal HUD.

**Note (Alpha/Beta):** When additional cars become playable, each cockpit has a different dashboard layout. Cockpit HUD positioning may need per-car adjustment to avoid overlapping dashboard elements. This is deferred to Alpha/Beta when cockpit variants are implemented.

**3. Team Cosmetic Variations**

- **Full theming:** HUD background tint, element borders, and all accent text use team colors
- **Team color application:** Fuel bar fill, tire bar fill, position number, speed text accent
- **Team icon:** Small badge next to position display
- **Fallback:** If team color has low contrast with track (e.g., yellow on desert), auto-adjust to white/black outline for readability

**4. HUD States**

| State | Elements Active | Notes |
|-------|----------------|-------|
| **Race** | All 7 (chase) / 4 (cockpit) | Full HUD during race |
| **Qualifying** | Speed, Position/Lap, Race Time | No rival gap, no track map |
| **Pit** | Pit countdown, Fuel fill bar, Tire status | Speed replaced by pit timer. Auto during pit stop. |
| **Results** | Full-screen takeover | Position, time, stats, rival results. No racing HUD. |

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
| **Race** | Race starts | Race ends or pit entered | Full HUD (7/4 elements) |
| **Pit** | Car enters pit lane | Car exits pit lane | Pit overlay (3 elements) |
| **Results** | Race ends | Player dismisses results | Full-screen takeover |

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Fuel** | Inbound | Fuel level (0-100%), state (Full/Conserving/Critical/Empty) | Drives fuel bar fill + color |
| **Tire** | Inbound | Tire wear (0-100%), grip multiplier | Drives tire bar fill + color |
| **Vehicle Physics** | Inbound | Speed (km/h), gear | Drives speed display |
| **Track** | Inbound | Position (1-16), lap (current/total), pit proximity | Drives position/lap + track map |
| **AI Rival** | Inbound | Rival gap (seconds), rival state | Drives rival gap display |
| **Simulation** | Inbound | Race time, state | Drives race time + state transitions |
| **Car Definition Data** | Inbound | Team color, team icon | Drives cosmetic theming |
| **Ghost Recording** | Inbound | Time delta (Alpha+) | Drives ghost delta element |

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
- **If player disconnects (device):** HUD freezes, "DEVICE DISCONNECTED" overlay.
- **If qualifying and player hasn't started:** Timer shows "--:--" until first input.
- **If pit stop and fuel is full:** Fuel bar shows full, "READY" text, early exit button active.
- **If results screen and player disconnects:** Results auto-dismiss after 10 seconds.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Fuel** | Inbound | Fuel level + state | Hard — drives fuel bar |
| **Tire** | Inbound | Tire wear + grip | Hard — drives tire bar |
| **Vehicle Physics** | Inbound | Speed + gear | Hard — drives speed display |
| **Track** | Inbound | Position, lap, pit proximity | Hard — drives position/lap + map |
| **AI Rival** | Inbound | Rival gap + state | Hard — drives rival display |
| **Simulation** | Inbound | Race time, state | Hard — drives time + state transitions |
| **Car Definition Data** | Inbound | Team color, icon | Hard — drives cosmetic theming |
| **Ghost Recording** | Inbound | Time delta | Soft — Alpha+ only |

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
| Cockpit overlay | Off | On/Off | N/A | N/A |

## Visual/Audio Requirements

- **Fuel bar:** Horizontal fill bar, team color, depletes left-to-right. Pulse animation when <25%.
- **Tire bar:** Horizontal fill bar, color-coded (green/yellow/red). No pulse — wear is continuous.
- **Speed:** Large numeric display, team color accent. No units displayed (km/h implicit).
- **Position/Lap:** "P1 L3/5" format. Position bold, lap secondary.
- **Rival gap:** "+0.4s" format. Green if gaining, red if losing, white if stable.
- **Track map:** Semi-transparent mini-map, all 16 cars as dots. Player = white dot with ring.
- **Team theming:** Background tint at 20% opacity, element borders in team color, accent text in team color.
- **State transitions:** Fade in/out (150ms, ease-out). No pop-in.

## UI Requirements

> **📌 UX Flag — HUD**: This system has UI requirements. In Phase 4 (Pre-Production), run `/ux-design` to create a UX spec for the race HUD before writing epics. Stories that reference UI should cite `design/ux/race-hud.md`, not the GDD directly.

## Acceptance Criteria

- **GIVEN** a race in progress, **WHEN** player looks at HUD, **THEN** all 7 chase elements are visible and readable in under 0.5 seconds.
- **GIVEN** fuel at 30%, **WHEN** fuel bar is displayed, **THEN** bar shows yellow (between 25-50% threshold).
- **GIVEN** fuel at 20%, **WHEN** fuel bar is displayed, **THEN** bar shows red and pulses.
- **GIVEN** tire at 60% wear, **WHEN** tire bar is displayed, **THEN** bar shows yellow (between 25-50% threshold).
- **GIVEN** rival 0.4s behind, **WHEN** rival gap is displayed, **THEN** shows "+0.4" with appropriate color.
- **GIVEN** player is P1, **WHEN** rival gap is displayed, **THEN** shows "LEADER" instead of time.
- **GIVEN** cockpit camera active, **WHEN** HUD is displayed, **THEN** only 4 elements shown (position/lap, fuel warning, tire warning, rival gap).
- **GIVEN** pit stop active, **WHEN** HUD is displayed, **THEN** speed is replaced by pit countdown.
- **GIVEN** qualifying active, **WHEN** HUD is displayed, **THEN** only speed, position/lap, and race time shown.
- **GIVEN** race ends, **WHEN** results screen appears, **THEN** full-screen takeover with position, time, and stats.
- **GIVEN** team_tier1_a (Madonna), **WHEN** HUD is displayed, **THEN** elements use Madonna's team color for borders and accents.
- **GIVEN** team_tier4_d (ZeroForce), **WHEN** HUD is displayed, **THEN** elements use ZeroForce's team color, with auto-contrast adjustment if needed.
- **GIVEN** cockpit camera with overlay enabled, **WHEN** HUD is displayed, **THEN** all 7 chase elements are overlaid on cockpit view.
- **GIVEN** cockpit camera with overlay disabled, **WHEN** HUD is displayed, **THEN** only 4 minimal elements shown.

## Open Questions

- **HUD layout for widescreen vs ultrawide:** Should the HUD scale with aspect ratio, or use fixed positions? Affects track map and rival gap placement.
- **Split-screen HUD:** If local multiplayer is added later, how does the HUD shrink? Or is HUD simplified for split-screen?
- **Accessibility:** Should there be a colorblind mode that replaces color-coded bars with patterns or icons?
- **HUD customization:** Should the player be able to reposition or hide HUD elements? Or is the layout fixed?
- **Pit countdown format:** Should it show seconds remaining, or a progress bar? Or both?
