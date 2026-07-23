# UI Menu

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-22
> **Implements Pillar**: Earn the Next Seat

## Overview

**UI Menu** manages the non-race screens: title, track selection, car selection, settings, and results. The visual language is "Garage Lit" — warm, tactile, team-centered. The car is the hero; everything else is workshop, pit lane, or memory. Without UI Menu, the player has no way to start a race, change settings, or see results.

## Player Fantasy

**Framing:** Direct — the player interacts with menus to start and conclude races.

**Emotional target:** One layer:

1. **The Workshop Is Yours (warm, tactile, owned):** The menus feel like a garage — warm lighting, team colors, the car as centerpiece. Selecting a track feels like choosing where to prove yourself. Selecting a car feels like walking into your pit box. The results screen feels like a podium. The menu is not a cold interface — it's the space between races where the player lives.

**Pillar alignment:** Earn the Next Seat — the garage is where you see your car, your team, your progress. Every Short Race Matters — results screen shows what you accomplished.

**Design test:** Does the player feel like they're in a garage, not a database?

## Detailed Design

### Core Rules

**1. Screen Flow (MVP)**

```
Title → Track Selection → Car Selection → Grid Display → Race → Results → Title
                    ↑                              ↑
                    └── Settings ←─────────────────┘
```

Linear stack navigation: back button always returns to previous screen.

**2. Screen Specifications**

| Screen | Elements | Notes |
|--------|----------|-------|
| **Title** | Game logo, "Single Race" button, "Settings" button | Warm garage lighting background |
| **Track Selection** | 4 track cards with map layout, name, distance, elevation | Monaco, Silverstone, Spa, Monza |
| **Car Selection** | 3D model turntable, team name, 6 stats, "Select" button | Car rotates slowly, warm lighting |
| **Settings** | Volume sliders, difficulty selector, control remapping | Standard settings layout |
| **Grid Display** | 16 positions with car names and qualifying times | 5s or skip |
| **Race** | (Managed by HUD + Race Session Manager) | N/A |
| **Results** | Position, car name, race time | Top 3 highlighted |

**3. Navigation Rules**

- **Back button:** Always returns to previous screen
- **Confirm:** Advances to next screen
- **Cancel:** Returns to previous screen
- **Escape/Start:** Opens pause menu during race

**4. Car Selection Details**

- 3D model rotates slowly (15 RPM)
- Warm "Garage Lit" lighting (amber/orange tones)
- Stats displayed as horizontal bars (0-20 scale)
- Team colors on model and UI accents
- "Select" button confirms choice

**5. Track Selection Details**

- Track map shows layout shape (top-down view)
- Name, distance (km), elevation change (m)
- Team-colored highlight on selection
- Difficulty indicator (based on track characteristics)

**6. Results Screen Details**

- Simple list: Position, Car Name, Race Time
- Top 3 positions highlighted (gold/silver/bronze)
- Player's position highlighted
- "Continue" button returns to Title

### States and Transitions

| State | Screen | Notes |
|-------|--------|-------|
| **Title** | Title screen | Entry point |
| **Track Select** | Track selection | Choose track |
| **Car Select** | Car selection | Choose car |
| **Settings** | Settings menu | Adjust settings |
| **Grid Display** | Grid overlay | Pre-race |
| **Race** | In-race (HUD active) | Gameplay |
| **Results** | Results screen | Post-race |

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Settings** | Inbound/Outbound | Volume, difficulty, controls | Read/write settings |
| **Track** | Inbound | Track list, distances, elevation | Display in selection |
| **Car Definition Data** | Inbound | Team stats, names, colors | Display in selection |
| **Qualifying** | Outbound | Player chose qualifying? | Skip or run qualifying |
| **Race Session Manager** | Outbound | Race start trigger | After grid display |
| **Audio** | Outbound | Menu music, button sounds | Background audio |
| **Content Pipeline** | Inbound | Track/car assets | Load for preview |

## Formulas

No formulas for this system. UI Menu is display and navigation only.

## Edge Cases

- **If player backs out during grid display:** Return to car selection, race not started.
- **If player changes settings mid-race:** Settings apply immediately, no restart needed.
- **If track assets fail to load:** Show error message, return to title.
- **If player selects same car/track as last race:** No special handling, normal flow.
- **If player presses back during race:** Pause menu opens, not back navigation.
- **If results screen shows DNF:** Position shows "DNF" instead of time.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Settings** | Bidirectional | Volume, difficulty, controls | Hard — read/write settings |
| **Track** | Inbound | Track data | Hard — display in selection |
| **Car Definition Data** | Inbound | Team data | Hard — display in selection |
| **Qualifying** | Outbound | Skip/run qualifying | Hard — triggers qualifying |
| **Race Session Manager** | Outbound | Race start | Hard — triggers race |
| **Audio** | Outbound | Menu music | Soft — background audio |
| **Content Pipeline** | Inbound | Asset loading | Hard — load preview assets |

## Tuning Knobs

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Car rotation speed | 15 RPM | 5–30 RPM | Too slow (boring) | Too fast (dizzying) |
| Grid display duration | 5s | 3–10s | Too fast to read | Too long (boring) |
| Menu music volume | 0.5 | 0.0–1.0 | Silent menus | Overpowers UI sounds |
| Button repeat delay | 0.5s | 0.2–1.0s | Too fast (accidental) | Too slow (annoying) |

## Visual/Audio Requirements

- **Title screen:** Warm garage lighting, game logo, subtle car silhouette in background.
- **Track selection:** Track map diagrams, warm amber tones, team-colored highlights.
- **Car selection:** 3D model with warm lighting, stats as horizontal bars, team colors.
- **Settings:** Clean layout, standard sliders and toggles.
- **Results:** Simple list, gold/silver/bronze highlights for top 3.
- **Audio:** Menu music (warm, garage ambiance), button click sounds, selection confirmation sounds.

## UI Requirements

> **📌 UX Flag — UI Menu**: This system has extensive UI requirements. In Phase 4 (Pre-Production), run `/ux-design` to create UX specs for each screen before writing epics.

## Acceptance Criteria

- **GIVEN** player on title screen, **WHEN** "Single Race" is selected, **THEN** track selection screen appears.
- **GIVEN** player selects track, **WHEN** "Next" is pressed, **THEN** car selection screen appears.
- **GIVEN** player selects car, **WHEN** "Select" is pressed, **THEN** grid display appears (or qualifying if enabled).
- **GIVEN** player on any screen, **WHEN** "Back" is pressed, **THEN** previous screen appears.
- **GIVEN** player on car selection, **WHEN** car model is displayed, **THEN** 3D model rotates at 15 RPM.
- **GIVEN** race results, **WHEN** results are displayed, **THEN** position, car name, and race time are shown.
- **GIVEN** player on settings, **WHEN** volume slider is adjusted, **THEN** volume changes immediately.
- **GIVEN** player on track selection, **WHEN** track is selected, **THEN** track map, name, and distance are displayed.

## Open Questions

- **Track map art:** Should track maps be procedural (generated from spline data) or hand-drawn?
- **Car model source:** Should car models be pre-made assets or generated from Car Definition Data?
- **Localization:** Should menu text support multiple languages? (Post-MVP)
- **Accessibility:** Should menu navigation support keyboard-only and controller-only?
- **Loading transitions:** Should screens fade in/out, or cut instantly?
