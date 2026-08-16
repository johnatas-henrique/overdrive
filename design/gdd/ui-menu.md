# UI Menu

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-08-01
> **Implements Pillar**: Earn the Next Seat

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Title, Single Race, local track/car selection, settings, qualifying results, pause, and results navigation. |
| MVP architecture constraints | Navigation is content-driven and supports later screens without altering local race flow. |
| Alpha | Career, team-switching, session, and standings screens. |
| Beta | Multiplayer UI if designed later. |
| Release | Localization if approved. |

### Review Boundary
Career, multiplayer, and localization UI are non-blocking unless MVP navigation cannot extend safely.

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
Title → Track Selection → Car Selection → Qualifying Not Started (optional)
                                      ├─ Start → Loading → Qualifying → Qualifying Results → Loading → Countdown → Race
                                      ├─ Skip  → Qualifying Results → Loading → Countdown → Race
                                      └─ Flying Lap → Finished Presentation → Qualifying Results → Loading → Countdown → Race
                    ↑                                  ↓                                      ↓
                    └── Settings ←─────────────────────┘                              Pause Menu        Idle/Title
                                                                                       ReturnToMenu → Results
                                                                                       Next Race → Loading
```

Linear stack navigation applies to menu screens. Loading blocks Back/Cancel after loading begins; Pause Menu Back/Cancel resumes the race; Qualifying Results is a shared pre-race confirmation screen shown after qualifying or after skipping qualifying, with Start Race as the only action and Confirm sends `StartRaceRequested`; Grid & Start owns display rules — there is no timeout and no Back/Cancel path from this screen; Results and Forfeit use their explicit destination contracts instead of generic stack-back behavior.

**2. Screen Specifications**

| Screen | Elements | Notes |
|--------|----------|-------|
| **Title** | Game logo, "Single Race" button, "Settings" button, Content error message when present | Warm garage lighting background; SimulationState.Idle |
| **Track Selection** | 4 track cards with map layout, name, distance, elevation | Data-driven track list from Content Pipeline (MVP: 4 tracks); no undefined track-difficulty indicator |
| **Car Selection** | 3D model turntable, team name, 6 stats, fuel comparison bar/number, "Select" button | Car rotates slowly, warm lighting; pre-race fuel comparison is shown here |
| **Qualifying Not Started** | Start Qualifying and Skip buttons | Confirm starts; Cancel returns to Car Select |
| **Loading** | Loading indicator and optional Content error message | Used before Qualifying and Race; Back/Cancel blocked after loading begins |
| **Settings** | Volume sliders, difficulty selector, per-slot control remapping, `Show Chase HUD in Cockpit` toggle | KeyboardMouse Primary/Secondary slots and one Gamepad slot per approved action/composite part |
| **Qualifying Results** | 16 positions with car names and qualifying times or `DNQ` | Metadata-only screen; Start Race button only |
| **Pause Menu** | Resume, Settings, Return to Menu | Return to Menu emits `ReturnToMenuRequested`; in Countdown/Racing this is Forfeit |
| **Race** | (Managed by HUD + Race Session Manager) | N/A |
| **Finished Presentation** | Player car terminal presentation, optional pause, Continue | Input routes Confirm/Pause directly to UI Presentation; generic UI module is disabled and Cancel is suppressed |
| **Results** | Normal result: position, car name, race time; Forfeit: FORFEIT, completed laps, elapsed race time | Top 3 highlighted only for normal classified results |

**3. Navigation Rules**

- **Pointer navigation:** Mouse hover selects a focusable element; primary click activates it. Pointer input is menu-only and never controls the car.
- **Keyboard navigation:** Arrow keys or WASD move UI focus; Enter submits; Escape performs Back/Cancel.
- **Gamepad navigation:** Left stick or D-pad move UI focus; South submits; East performs Back/Cancel.
- **Focus boundary:** Navigate stops at the edge of the current focus group; it never wraps automatically.
- **Pointer coexistence:** Pointer movement of at least 2 pixels or click makes mouse active; click assigns focus before activation. Keyboard/gamepad Navigate, Confirm, or Cancel hides the pointer and updates prompt glyphs to the active scheme.
- **Pause contextual action:** During Race, Escape or Start opens the pause menu. In menu contexts, Escape or East performs Back/Cancel through the reserved UI Cancel action. Confirm and Cancel are not remappable in MVP.
- **Loading cancellation:** Once Content loading begins, Back/Cancel is blocked until `RaceLoadReady` or `ContentLoadError`. A load error returns to Title with the Content error message.
- **Finished Presentation controls:** While SimulationState is Finished, InputContextController disables `InputSystemUIInputModule`, routes P/Start and Enter/South directly to UI Presentation, and suppresses Escape/East. UI pauses the terminal timer while application focus is lost and never changes simulation state, race clocks, or results.
- **Finished terminology:** Finished Presentation is this visible UI screen. UI Presentation is its controller, responsible only for the timer, pause flag, and `DismissTerminalPresentation` signal.

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

**6. Results Screen Details**

- Qualifying Results: full grid list, player highlighted, Start Race button.
- Race Results: normal result shows position, car name and race time; forfeit shows **FORFEIT**, completed laps and elapsed race time, with no final position or top-3 placement.
- Top 3 positions highlighted (gold/silver/bronze)
- Player's position highlighted
- **Next Race** requests Loading for the currently selected track/car configuration; Simulation performs the actual Loading state transition. Changing selection uses the normal Title → Track Selection → Car Selection flow.
- **Continue** and Back release race assets, transition Simulation to Idle, and return to Title.

### States and Transitions

| State | Screen | Notes |
|-------|--------|-------|
| **Title** | Title screen | Entry point; SimulationState.Idle |
| **Track Select** | Track selection | Choose track |
| **Car Select** | Car selection | Choose car |
| **Qualifying Not Started** | Qualifying start/skip screen | Confirm starts; Cancel returns to Car Select |
| **Loading** | Loading screen | Back/Cancel blocked after content loading begins |
| **Qualifying Results** | Grid positions and qualifying results | Shared pre-race screen; Start Race button only; no timeout and no Back/Cancel path |
| **Settings** | Settings menu | Adjust settings |
| **Pause Menu** | Resume, Settings, Return to Menu | ReturnToMenuRequested is the only route to Forfeit |
| **Race** | In-race (HUD active) | Gameplay |
| **Finished Presentation** | Player-car terminal view | Receives `terminalPresentationRequest` from PublishedSimulationSnapshot; owns the up-to-5-second timer and emits `DismissTerminalPresentation` |
| **Results** | Race results screen | After race terminal resolution or forfeit; displays race standings, DNF, or FORFEIT summary; Next Race enters Loading and Continue/Back returns to Idle/Title |

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Settings** | Inbound/Outbound | Volume, difficulty, controls, `show_chase_hud_in_cockpit` | Read/write settings |
| **Track** | Inbound | Track list, distances, elevation | Display in selection |
| **Car Definition Data** | Inbound | Team stats, names, colors | Display in selection |
| **Qualifying** | Bidirectional | Start/skip request and qualifying result | UI starts or skips qualifying and displays the returned result |
| **Race Session Manager** | Bidirectional | `StartRaceRequested` from Qualifying Results, `ReturnToMenuRequested`, result data | UI submits session requests; RSM owns lifecycle rules |
| **Simulation Architecture** | Inbound/Outbound | `terminalPresentationRequest`, `DismissTerminalPresentation` | UI owns presentation timing; Simulation owns Loading, Countdown, Finished, Results, and Idle lifecycle |
| **Camera** | Inbound | Finished Presentation camera request | Camera owns the external terminal viewpoint |
| **Audio** | Outbound | Menu music, button sounds | Background audio |
| **Content Pipeline** | Bidirectional | Track/car assets, `RaceLoadReady`, `ContentLoadError` | Load for preview and report race-load results |
| **Input System** | Inbound | OverdriveUI Confirm, Cancel, Pause, navigation, pointer, active control scheme | Drives menu focus, prompt glyphs, pointer interaction, and contextual pause |

## Formulas

No formulas for this system. UI Menu is display and navigation only.

## Edge Cases

- **If player attempts Back/Cancel during Qualifying Results:** No navigation occurs; race loading has not started and no race-resource unload is required.
- **If player changes settings from an active-race pause menu:** Settings previews supported values immediately; Apply persists working values, Cancel restores the session snapshot, and Difficulty remains disabled because the current race already owns an immutable DifficultyProfile.
- **If track assets fail to load:** Show error message, return to title.
- **If player selects same car/track as last race:** No special handling, normal flow.
- **If player presses back during race:** Pause menu opens, not back navigation.
- **If results screen shows DNF:** Classification shows `DNF`; no fabricated finish position is shown.
- **If results screen shows Forfeit:** Classification shows `FORFEIT`, completed laps, and elapsed race time; no final position or top-three placement is shown.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Settings** | Bidirectional | Volume, difficulty, controls | Hard — read/write settings |
| **Track** | Inbound | Track data | Hard — display in selection |
| **Car Definition Data** | Inbound | Team data | Hard — display in selection |
| **Fuel** | Inbound | Fuel rate comparison data | Hard — pre-race fuel comparison for the selected car vs. grid average |
| **Qualifying** | Bidirectional | Start/skip request and qualifying result | Hard — owns qualifying entry and result presentation |
| **Race Session Manager** | Bidirectional | StartRaceRequested, ReturnToMenuRequested, result data | Hard — owns race/session requests and results |
| **Simulation Architecture** | Bidirectional | SimulationState, terminal presentation, loading results | Hard — owns Loading, Finished, Results, and Idle transitions |
| **Camera** | Inbound | Finished Presentation camera request | Hard — presents the terminal camera |
| **Audio** | Outbound | Menu music | Soft — background audio |
| **Content Pipeline** | Bidirectional | Asset loading, RaceLoadReady, ContentLoadError | Hard — load preview assets and report race-load results |
| **Input System** | Inbound | OverdriveUI Confirm, Cancel, navigation, pointer, and active scheme | Hard — drives focus, prompts, and pointer interaction |

## Tuning Knobs

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Car rotation speed | 15 RPM | 5–30 RPM | Too slow (boring) | Too fast (dizzying) |
| Qualifying Results display duration | Confirm only | Fixed for MVP; changes require design review | Too fast to read | Too long (boring) |
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
- **GIVEN** player selects car, **WHEN** "Select" is pressed, **THEN** Qualifying Not Started appears when qualifying is enabled; otherwise Qualifying Results appears.
- **GIVEN** player on a navigable menu screen outside Loading, Finished Presentation, Results, Pause Menu, and Qualifying Results, **WHEN** "Back" is pressed, **THEN** the previous screen appears.
- **GIVEN** Pause Menu is open, **WHEN** Cancel/Back is pressed, **THEN** the race resumes and no stack navigation occurs.
- **GIVEN** Qualifying Results is open, **WHEN** Cancel/Back is pressed, **THEN** no navigation occurs.
- **GIVEN** Qualifying Results is open, **WHEN** Confirm is pressed, **THEN** UI sends `StartRaceRequested` to RSM and Simulation begins Loading only after the request is accepted.
- **GIVEN** player on car selection, **WHEN** car model is displayed, **THEN** 3D model rotates at 15 RPM.
- **GIVEN** normal race results, **WHEN** results are displayed, **THEN** position, car name, and race time are shown; DNF and Forfeit use their explicit classifications and omit unavailable position data.
- **GIVEN** player on settings, **WHEN** volume slider is adjusted, **THEN** volume changes immediately.
- **GIVEN** player on track selection, **WHEN** track is selected, **THEN** track map, name, and distance are displayed.
- **GIVEN** player uses keyboard or gamepad Navigate at a focus-group boundary, **WHEN** input is processed, **THEN** focus remains at that boundary.
- **GIVEN** Menu is active, **WHEN** Enter/South or Escape/East is pressed, **THEN** the reserved binding submits or cancels respectively.
- **GIVEN** Countdown is running and not paused, **WHEN** player attempts to open Settings, **THEN** Settings remains unavailable; **GIVEN** Countdown is paused, **WHEN** player opens Settings from the pause menu, **THEN** it opens with the same restrictions as Racing-paused.
- **GIVEN** Content loading has begun, **WHEN** player presses Back or Cancel, **THEN** the request is blocked until RaceLoadReady or ContentLoadError.
- **GIVEN** Finished Presentation is visible, **WHEN** Escape/East is pressed, **THEN** no dismissal or state transition occurs; only Enter/South dismisses the presentation.
- **GIVEN** Finished Presentation is visible, **WHEN** its input routing is inspected, **THEN** `InputSystemUIInputModule` is disabled, Confirm/Pause route directly to UI Presentation, and no generic Submit/Cancel handler is invoked.
- **GIVEN** player starts Qualifying, **WHEN** Content loading begins, **THEN** UI shows Loading and all navigation remains blocked until `RaceLoadReady(RaceMode.Qualifying)` transitions Simulation directly to Racing/GameplayQualifying without Countdown.
- **GIVEN** Results Continue/Back is selected, **WHEN** ContentUnloadRequest is active, **THEN** UI remains on a non-interactive Results/transition presentation until `ContentUnloadComplete`; only then may Title/Idle appear.
- **GIVEN** player selects Return to Menu from the Pause Menu during Countdown or Racing, **WHEN** the request is accepted, **THEN** UI emits `ReturnToMenuRequested` and Results displays `FORFEIT` without resuming simulation.
- **GIVEN** `Show Chase HUD in Cockpit` is changed in Settings, **WHEN** the setting is applied or previewed, **THEN** the `show_chase_hud_in_cockpit` value reaches UI Menu and Cockpit HUD visibility updates according to the Settings transactional-preview contract.

## Open Questions

- **Track map art:** MVP uses generated top-down layouts from Track spline data; hand-authored polish is optional.
- **Car model source:** MVP uses Content Pipeline car assets; Car Definition Data supplies metadata and stats, not mesh generation.
- **Localization:** Should menu text support multiple languages? (Post-MVP)
- **Accessibility:** Keyboard-only and controller-only navigation are required. Screen-specific focus layouts are defined by the UI Menu UX specification before implementation.
- **Loading transitions:** UX may use the project-standard short fade; this does not alter the loading cancellation contract.
