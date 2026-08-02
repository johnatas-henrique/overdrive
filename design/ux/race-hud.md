# HUD Design

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-29
> **Template**: HUD Design
> **Journey Phase**: Racing (core gameplay loop)
> **Platform Target**: PC, Web
> **GDD Requirements**: 13 GDDs (HUD, Fuel, Tire, RSM, VP, Input, Pit Stop, Track, Ghost, Settings, Camera, VFX, Content Pipeline)
> **Accessibility Tier**: Standard
> **Input Methods**: Keyboard/Mouse + Gamepad (equivalent)

---

## HUD Philosophy

**"Minimal density by default, adaptive complexity when it matters."**

The HUD is always present but never overwhelming. Every element earns its place by passing the 0.5-second reading test. The information adapts to the player's context without them asking:

- **Racing (full focus):** 8 elements showing everything the player needs — speed, position, lap, fuel, tire, lap time, rival, track map.
- **Qualifying (timer pressure):** Only 3 elements — speed, position/lap, race time. No rival or map.
- **Pit service (mechanical pause):** Speed replaced by service progress. Focus on fuel fill, tire swap, exit timer.
- **Countdown (anticipation):** Five-light sequence is the only HUD. Race data suppressed.
- **Finished (resolution):** Race HUD fades. Terminal presentation takes over.

Each state transition is crisp (150ms fade). The player never wonders "what does this number mean?" — color carries state, numbers carry precision.

---

## Information Architecture

### Full Information Inventory

All data points the HUD must communicate, extracted from 13 GDDs:

| # | Element | Source | Chase | Cockpit + HUD ON | Cockpit + HUD OFF |
|---|---------|--------|-------|-----------------|-------------------|
| 1 | Speed (km/h) | Vehicle Physics | Visible | Visible (redundant with dashboard) | Hidden — only car dashboard 3D shows |
| 2 | Position ("3/16") | RSM | Visible | Visible | Hidden |
| 3 | Lap ("L3/5") | RSM | Visible | Visible | Hidden |
| 4 | Fuel Bar (0-100% + X.X L) | Fuel | Visible | Visible (redundant) | Hidden |
| 5 | Tire Bar (0-100% + X%) | Tire | Visible | Visible (redundant) | Hidden |
| 6 | Lap Time (current mm:ss.ms, prev, best) | Simulation (current) + RSM (prev/best) | Visible | Visible | Hidden |
| 7 | Rival Gap (+X.Xs / LEADER) | RSM | Visible | Visible | Hidden |
| 8 | Track Map | RSM + Track | Visible | Visible | Hidden |
| 9 | Ghost Delta (+/-X.Xs) | Ghost Recording | Visible (Alpha) | Visible (Alpha) | Hidden |

### Transient / Contextual Elements

| # | Element | Trigger | Visible In |
|---|---------|---------|------------|
| 9 | PIT THIS LAP | PitStop.PitThisLap = true | From warning_start_progress until pit entry |
| 10 | Pit Service Overlay (timer, fuel fill, tire status, exit prompt) | PitPhase = InPitBox | Replaces speed display during service |
| 11 | Performance Reduced overlay | Simulation emits PerformanceReduced | Until FPS recovers for 3s |
| 12 | No Input Device overlay | Input.inputAvailability = NoInputDevice | Until valid scheme selected |
| 13 | FUEL EMPTY + red flash | Fuel state = Empty | Over fuel bar area |
| 14 | TYRES WORN + red flash | Tire grip floor reached | Over tire bar area |
| 15 | Countdown lights | Simulation countdown | Full-screen overlay pre-race |

### Categorization (derived from GDD states)

| Category | Elements |
|----------|----------|
| **Must Show** (always visible in race) | Speed, Position, Lap, Fuel Bar, Tire Bar, Lap Time, Rival Gap, Track Map |
| **Contextual** (visible when condition met) | PIT THIS LAP, Pit Service Overlay, Performance Reduced, No Input Device, FUEL EMPTY, TYRES WORN, Countdown lights |
| **On Demand** (player must request) | None in MVP — HUD has no toggleable elements (Cockpit overlay is a Settings option, not a runtime toggle) |
| **Hidden** (never on-screen text) | Fuel/tire audio cues (engine sound cut when empty, tire squeal when worn) |

### Camera Behavior

**Context:** In cockpit camera, the car's dashboard 3D model is visible — it shows speed, gear indicator, RPM, and basic warning lights directly on the car mesh. These are part of the 3D car model, not HUD overlays. In chase camera, the car is seen from behind and the dashboard is not readable.

**Settings option:** `Show Chase HUD in Cockpit` (Camera section in Settings)

| Camera | Show Chase HUD in Cockpit | HUD Overlay | Car Dashboard 3D |
|--------|---------------------------|-------------|------------------|
| **Chase** | N/A | All 8 elements visible | Not visible (car seen from behind) |
| **Cockpit** | ON (default) | All 8 elements visible | Visible on car mesh |
| **Cockpit** | OFF | No HUD overlay | Visible on car mesh |

**Key rule:** HUD layout is static. Elements never reposition when switching cameras. `Show Chase HUD in Cockpit` hides/shows the entire HUD overlay, not individual elements. The car dashboard is always visible in cockpit regardless of the setting.

**Why ON is default:** The toggle exists for immersion-minded players, but default ON keeps race data accessible in cockpit view. Players who prefer the pure dashboard experience turn it off in Settings. Seeing the same speed on the dashboard AND as a floating overlay is the accepted trade-off for data continuity; the player chooses.

### State-based Element Visibility

| State | Active Elements | Notes |
|-------|----------------|-------|
| **Race (Chase)** | All 8 + active Contextual | Full HUD. Dashboard not visible at chase distance. |
| **Race (Cockpit — Show ON)** | All 8 + active Contextual | HUD overlay visible on cockpit. Static layout. |
| **Race (Cockpit — Show OFF)** | No HUD overlay | Immersion mode. Only car dashboard 3D model visible. |
| **Qualifying** | Speed + Gear, Position `/16`, Lap Time (as flying lap timer) | Lap Time header changes to `QUALIFYING`. Rival Gap, Fuel Bar, Tire %, Track Map hidden. No Countdown lights — flying lap starts immediately after content load. |
| **Countdown** | Five-light sequence overlay | Race timer at 0.0. No HUD elements active. |
| **Pit Transit/Exiting** | Same as Race | Full HUD while navigating pit lane. |
| **Pit Service (InPitBox)** | Service overlay replaces Speed. Fuel/Tire bars remain live. | Elapsed time, fill progress, tire swap status, exit prompt. |
| **Finished** | HUD suppressed | Terminal presentation UI owns screen. Race HUD fades out. |
| **Paused** | Last telemetry behind pause overlay | HUD does not advance; telemetry frozen. |
| **Results** | Full-screen takeover | No HUD elements. Results UI replaces everything. |

---

## Layout Zones

### Information Hierarchy (reading order at speed)

Derived from art bible §6.1 and HUD GDD:

| Priority | Element | Rationale |
|----------|---------|-----------|
| 1 (highest) | **Speed + Gear** | Top-center. Largest element. The primary read — how fast am I going? |
| 2 | **Position** | Top-right. "3/16" — where am I in the race? |
| 3 | **Lap** | Top-right, below Position. "L3/5" — how much race is left? |
| 4 | **Lap Time** | Top-left. Current/prev/best — am I improving? |
| 5 | **Rival Gap** | Below Lap Time. Who is near me and by how much? |
| 6 | **Fuel Bar + Tire %** | Bottom-right. Resource awareness — can I finish or should I pit? |
| 7 | **Track Map** | Right side. Saccadic — planning pit entry or checking position spread. |

**Note:** This layout is provisional. It will be revisited when a playable prototype exists and playtesting validates or challenges the element positions. Until then, nothing is final.

### Layout Diagram

```
┌──────────────────────────────────────┐
│ LAP TIME         285 6       3/16   │  Top-left: Lap Time | Top-center: Speed+gear | Top-right: Position
│ +0.4s                          L3/5  │  Rival Gap below Lap Time | Lap below Position
│ Prev: 00:04.289                      │
│ Best: 00:03.950                      │
│                                      │
│                              [🗺]    │  Right side: Track Map
│                                      │
│                                      │
│                         [⛽ ████]    │  Bottom-right: Fuel Bar
│                         [⚙ 60% ]    │  Bottom-right: Tire % below Fuel
│                         8.0L         │
└──────────────────────────────────────┘
```

### Zone Map

| Zone | Element | Position |
|------|---------|----------|
| Top-left | Lap Time | Current lap time (header), prev lap, best lap |
| Top-left | Rival Gap | Below lap time block, "+X.Xs" or "LEADER" |
| Top-center | Speed + Gear | Largest element, speed number + gear indicator |
| Top-right | Position | "3/16" — current position / total grid |
| Top-right | Lap | Below Position, "L3/5" — current lap / total laps |
| Right side | Track Map | Compact mini-map (spline + cars + pit marker) |
| Bottom-right | Fuel Bar | Horizontal bar + numeric "X.X L" readout |
| Bottom-right | Tire % | Below fuel, icon + percentage, color-coded |

### Transient Element Placement

| Element | Position | Behavior |
|---------|----------|----------|
| PIT THIS LAP | Below Speed, center | Appears at warning_start_progress, fades at pit entry |
| Pit Service Overlay | Replaces Speed area | Timer, fuel fill, tire status, exit prompt during InPitBox |
| Performance Reduced | Top-center, below Speed | Compact non-blocking text overlay |
| No Input Device | Center-screen | Bold overlay, clears when input reconnects |
| FUEL EMPTY / TYRES WORN | Over respective bar area | Red flash + text |
| Countdown lights | Full-screen | Five red lights, one by one, 0.5s interval |

---

## HUD Elements

### 1. Speed

| Property | Value |
|----------|-------|
| Category | Must Show |
| Position | Top-center |
| Format | `[speedometer icon] [number] [gear]` — e.g. `[🚗] 285 6` |
| Font | Gemunu Libre Bold 72px |
| Color | White `#FFF8F0` with 2px Carbon Black `#1A1A1A` outline |
| Units | None (km/h implicit) |
| Icon | Flat outlined speedometer, 2px stroke, 32×32px (design/art/art-bible.md §6.3) |
| Gear | Small numeral (Gemunu Libre Bold 18px), same color as speed |
| Update | Snap — per simulation tick |
| Animation | None (instant numeric update) |
| Notes | No team color applied. Same color for all teams. |

### 2. Position

| Property | Value |
|----------|-------|
| Category | Must Show |
| Position | Top-right |
| Format | `3/16` — current position / total grid |
| Font | Gemunu Libre Bold 36px |
| Color | White `#FFF8F0` with 2px outline. P1 (leading) uses Champion Gold `#F5C518` |
| Update | Snap — per position change event from RSM |
| Animation | None (instant numeric update) |

---

### 3. Lap

| Property | Value |
|----------|-------|
| Category | Must Show |
| Position | Top-right, below Position |
| Format | `L3/5` — current lap / total laps |
| Font | Gemunu Libre Bold 24px |
| Color | White `#FFF8F0` with 2px outline |
| Update | Snap — per lap completion event |
| Animation | Brief brightness pulse (0.2s) on lap completion |

---

### 4. Lap Time

| Property | Value |
|----------|-------|
| Category | Must Show |
| Position | Top-left |
| Format | **Header:** `LAP TIME` (yellow `#FFD700`). **Line 1:** `Current: 00:04.289`. **Line 2:** `Prev: 00:04.789`. **Line 3:** `Best: 00:03.950` |
| Font | Spline Sans Regular 16px (data), Bold 14px (labels) |
| Color | Header: yellow `#FFD700`. Data: white `#FFF8F0`. Labels: gray `#B0BEC5` |
| Update | Per tick for current, per lap completion for prev/best |
| Animation | Snap (instant). Prev and Best fade in when updated (0.15s) |

---

### 5. Rival Gap

| Property | Value |
|----------|-------|
| Category | Must Show |
| Position | Top-left, below Lap Time block |
| Format | `+0.4s` or `LEADER` (no gap when P1) |
| Font | Spline Sans Medium 20px |
| Color | Green `#4CAF50` if gaining, Red `#F44336` if losing, White if stable |
| Update | Per tick — from RSM rival gap data |
| Animation | Snap (instant). Color changes are immediate |

---

### 6. Fuel Bar

| Property | Value |
|----------|-------|
| Category | Must Show |
| Position | Bottom-right |
| Format | Horizontal bar (state-color fill) + numeric readout `8.0L` below |
| Font | Gemunu Libre Bold 18px (numeric), Spline Sans 14px (label) |
| Color | Green `#4CAF50` (>50%), Yellow `#FFC107` (25-50%), Red `#F44336` (<25%) |
| Icon | Fuel pump silhouette (outlined, 24×24px) at bar start |
| Update | Per tick — from Fuel system |
| Animation | Stepped bar transition (LCD-style per art bible §6.4). Pulse when <25% |

---

### 7. Tire %

| Property | Value |
|----------|-------|
| Category | Must Show |
| Position | Bottom-right, below Fuel Bar |
| Format | Icon + percentage: `[⚙] 60%` |
| Font | Gemunu Libre Bold 18px |
| Color | Green (>50%), Yellow (25-50%), Red (<25%). Full backup pattern per art bible §6.3 |
| Icon | Tire cross-section (outlined, 24×24px) |
| Update | Per tick — from Tire system |
| Animation | No pulse (wear is continuous per GDD). Stepped transitions |

---

### 8. Track Map

| Property | Value |
|----------|-------|
| Category | Must Show |
| Position | Right side, below Position/Lap area |
| Format | Compact mini-map. Main spline + pit-lane spline + pit-entry marker. All 16 cars as dots. Player = white dot with ring |
| Size | ~180×180px at 1080p |
| Color | Semi-transparent dark background. White lines (track). Player: white dot + ring. Rivals: gray dots. Pit marker: yellow |
| Update | Per tick (car positions on spline) |
| Animation | None (continuous update) |

---

### 9. Transient Elements

| Element | Position | Trigger | Behavior |
|---------|----------|---------|----------|
| PIT THIS LAP | Below Speed, center | PitStop.PitThisLap = true | Appears at warning_start_progress, fade out 0.3s with 10px downward slide on pit entry |
| Pit Service Overlay | Replaces Speed area | PitPhase = InPitBox | Shows elapsed service time, fuel fill progress (L/s), tire swap status, exit prompt after 2s |
| Performance Reduced | Below Speed | Simulation.PerformanceReduced | Compact non-blocking text, clears after FPS recovers 3s |
| No Input Device | Center-screen | Input.inputAvailability = NoInputDevice | Bold text, clears when valid scheme resolves |
| FUEL EMPTY | Over fuel bar | Fuel state = Empty | Red flash (2s interval) + text. Persistent until refuel |
| TYRES WORN | Over tire % | Tire grip floor reached | Red flash (2s interval) + text. Persistent until tire swap |
| Countdown lights | Full-screen center | Simulation countdown | Five red lights, 0.5s interval, each light pulses 0.1s on activation. GO = all lights out |

---

## Dynamic Behaviors

### State Transitions

| Transition | Behavior | Duration |
|------------|----------|----------|
| Race → PitTransit | HUD unchanged (same 8 elements). No transition needed. | Instant |
| PitTransit → InPitBox | Speed element fades out (0.15s). Service overlay fades in (0.15s) replacing Speed area. Fuel + Tire bars remain live. | 0.15s |
| InPitBox → PitExiting | Service overlay fades out (0.15s). Speed fades in (0.15s) returning to previous value. | 0.15s |
| Race → Countdown | Full-screen five-light overlay. Race HUD elements fade out (0.15s). | 0.15s |
| Countdown → Race | Five lights go out. HUD elements fade in (0.15s). Speed snaps to current value. | 0.15s |
| Race → Finished | HUD fades out (0.3s). Terminal presentation UI takes over. | 0.3s |
| Race → Paused | HUD telemetry freezes (last authoritative values). Pause overlay fades in (0.2s vignette + 4px blur). | 0.2s |
| Paused → Race | Pause overlay fades out (0.2s). HUD resumes live updates. | 0.2s |
| Race → Results | Full-screen takeover. No HUD elements visible. | Instant (after terminal presentation) |

### Transient Element Behavior

| Element | Appear | Visible While | Dismiss |
|---------|--------|---------------|---------|
| PIT THIS LAP | Pulse 3× (0.1s each) below Speed, then hold | From warning_start_progress until physical pit entry | Fade out 0.3s + 10px downward slide |
| FUEL EMPTY | Pulse 3× over fuel bar area, then hold with 2s flash cycle | Until refuel at pit | Fade out 0.3s |
| TYRES WORN | Pulse 3× over tire area, then hold with 2s flash cycle | Until tire swap at pit | Fade out 0.3s |
| Performance Reduced | Fade in 0.15s below Speed | Until FPS recovers for 3s | Fade out 0.3s |
| No Input Device | Fade in 0.15s center-screen | Until valid input scheme resolves | Fade out 0.3s |

### Final Lap Indicator

When lap counter reaches the final lap (e.g. "L5/5"), a `FINAL LAP` text element appears briefly at center-screen (1.5s), then fades out. No persistent HUD change. Audio cue (music change or announcer) is the primary final-lap indicator per Audio system design.

### Performance Degradation

| Condition | HUD Response |
|-----------|-------------|
| Sustained < 30 FPS for 3s | Show `PERFORMANCE REDUCED` compact overlay below Speed area |
| Sustained < 15 FPS for 3s after reduction | Simulation pauses race, shows pause UI with Resume/Return to Menu options |
| FPS recovers ≥ 30 for 3s | Overlay clears. Full HUD restores. |

### Focus Loss

| Event | HUD Response |
|-------|-------------|
| Window loses focus (Alt+Tab) | HUD freezes on last frame. Simulation pauses per ADR-0005. |
| Window regains focus | HUD resumes. Simulation resumes if player unpauses. |

---

## Platform & Input Variants

### Aspect Ratio

- **Target:** 16:9 (1920×1080 primary, scales to 1280×720 and 2560×1440)
- **Ultrawide (21:9):** HUD elements remain at 16:9 positions (centered within 16:9 area). Track Map and Rival Gap may shift slightly outward. Ultrawide support is secondary — readability at 16:9 is priority.
- **Scaling:** HUD scales with resolution. Font sizes defined at 1080p scale linearly to other resolutions.

### Input Method Adaptation

- **Keyboard/Mouse:** No cursor needed during race. All inputs via keyboard.
- **Gamepad:** Equivalent to KBM. No difference in HUD.
- **Prompt glyphs:** Not shown on HUD during race. HUD is information-only, no action prompts. Input prompts appear only in UI menus (Settings rebinding, Qualifying Results Start Race button).

### No-Input-Device State

- HUD continues showing last authoritative telemetry
- Center-screen overlay: "NO INPUT DEVICE"
- Clears automatically when any valid input device is detected

---

## Accessibility

### Colorblind Mode (Settings toggle)

- Fuel bar and Tire % use pattern backup per art bible §6.3:
  - Green → Checkered flag icon (outlined + full fill)
  - Yellow → Diagonal stripe overlay on bar
  - Red → Stop octagon icon + pulsing animation + text label
- Color alone never carries information — all states have shape/text backup

### Text Scaling

- Font sizes defined at 1080p scale with Settings text scale (100%-200%)
- Minimum 14px at 1080p after scaling (accessibility-requirements.md)
- Layout reflows at larger scales — elements with overflow fade rather than clip

### Reduced Motion

- When Settings Camera > Reduced Motion is ON:
  - All transient animations (fade, slide, pulse) are disabled
  - Elements appear/disappear instantly
  - Bar transitions remain stepped (not animated)
- Critical alerts (FUEL EMPTY, TYRES WORN) may use a single static flash instead of pulse

### High Contrast

- White `#FFF8F0` text with 2px Carbon Black `#1A1A1A` outline on all elements
- Semi-transparent dark background behind HUD elements (70% opacity `#1A1A1A` segments, not a full HUD panel)
- Contrast ratio 15.8:1 — exceeds WCAG AAA

### Keyboard Navigation (menus only)

- Not applicable to race HUD (no interactive elements during race)
- Race HUD is read-only

---

## Open Questions

[To be designed]
