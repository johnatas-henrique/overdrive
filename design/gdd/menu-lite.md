# Menu LITE

> **Status**: Design Complete
> **Author**: Overdrive Team
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Speed That Is Felt, Racing Is Progression (scaffold)

## Overview

Menu LITE is the minimum viable pre-race and post-race screen flow. It exists so the player is not thrown directly into a race — there is a title screen, a car and track choice, a brief loading moment, and a results screen when the race ends. In Phase 1 it is purely 2D UI (Babylon.js GUI), with no 3D paddock, no navigable garage, and no dialogue. The full paddock experience arrives in Alpha.

Screen order:

`Title → Main Menu → Single Player → Car Select → Race Setup → Loading → [Race] → Results`

In the opposite direction, Results can loop back to PreRace ("Race Again") or back to Title.

## Player Fantasy

The player is in the paddock — or rather, its essence. The title screen says "you are here." The car selection says "this is your machine." The loading screen says "get ready." The menu is preparation, not navigation: pick your weapon, pick your battlefield, and go. The fantasy is that the menus disappear into the ritual of race day.

## Detailed Design

### Core Rules

- **Screen stack**: one screen active at a time. No overlapping dialogs in Phase 1. Each screen pushes onto a stack; the Back action pops it. At the bottom of the stack is Title — popping Title exits to the OS-level close flow.
- **Title screen**: shows game logo, version number, and "Press ENTER to start." No menu options. ENTER pushes Main Menu. Post-MVP: strongest car (McLaren Marlboro) rendered behind the title.
- **Main Menu**: hub screen with two buttons: Single Player (starts race flow) and Options (opens settings screen). ESC returns to Title. Clean layout — logo + two buttons only.
- **Car Select**: grid of 8 teams, one per cell. Each cell shows: team colour swatch, car number, team name. Selecting a team highlights it and enables the "Confirm" button. Player can change selection any number of times before confirming. ESC returns to Main Menu.
- **Race Setup** (merged Track Select + Race Settings): single screen showing track selection (4 cards with circuit silhouette/photo), lap count selector (3, 5, 10, 20 — default 5), and difficulty selector (Very Easy, Easy, Medium, Hard, Very Hard — default Medium). Track cards have visual thumbnails. Selected track highlighted with accent border. Confirmed team shown in info bar at bottom. Player confirms once to proceed to Loading. ESC returns to Car Select.
- **Loading screen**: shown after Race Setup confirm. Displays track name + a single random tip (e.g. "Brake early into La Source — the inside line is tighter than it looks"). No progress bar in Phase 1 — assets load in sequence; the screen stays for a fixed minimum duration (0.5s) or until load completes, whichever is longer.
- **Results screen**: triggered by GSM `PostRace` entry. Shows: top 3 classification with total race time for each, player position (highlighted if in top 3, separate row if outside), fastest lap with driver name, and a one-line rival reaction (ironic/arrogant, 90s style trash talk) based on the highest-standing rival's personality + player position. "Race Again" button goes directly to PreRace (preserving all selections); "Main Menu" goes to Title.
- **Back navigation**: ESC or B (gamepad) pops the current screen. At Title, ESC is ignored (no accidental exit).
- **Theme fidelity**: all screens follow the Misto dark-panel style defined in art bible Section 7.1. Team colour accent reflects the currently selected team.
- **Car thumbnail**: static 3D render view of the selected team's car, imported as a sprite or a simple isolated mesh with a plain background. Uses BeautyContour render (no shadows, no environment — just the car on a neutral backdrop).

### States and Transitions

| State      | Description                                        | Entry                        | Exit                                                               |
| ---------- | -------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------ |
| Title      | Logo + "Press ENTER"                               | GSM Menu entry               | ENTER → Main Menu                                                  |
| Main Menu  | Hub: Single Player or Options                      | ENTER from Title             | Single Player → Car Select; Options → Options; ESC → Title         |
| Car Select | Choose team                                        | Single Player from Main Menu | Confirm → Race Setup; ESC → Main Menu                              |
| Race Setup | Choose track + laps + difficulty                   | Car confirm                  | Confirm → Loading; ESC → Car Select                                |
| Loading    | Load assets, minimum 0.5s display (skip if faster) | Race Setup confirm           | Race ready → GSM transitions to PreRace                            |
| Results    | Top 3 classification, time, rival reaction         | GSM PostRace                 | "Race Again" → PreRace (preserves selections); "Main Menu" → Title |

All states correspond to the GSM's `Menu` substate (the GSM tracks `Menu`; Menu LITE manages the screen stack within it).

**Flow:**

```
Title ──ENTER──▶ Main Menu ──Single Player──▶ Car Select ──CONFIRM──▶ Race Setup ──CONFIRM──▶ Loading ──LOADED──▶ [Race]
   ▲                   │                                                                         │
   │                   └──Options──▶ Options Screen ──ESC──▶ Main Menu                            │
   │                                                                                              │
   └─── "Main Menu" ◀─── Results ◀──────────────────────────── [Race ends] ────────────────────────┘
                                 │
                                 └─── "Race Again" ──▶ PreRace (preserves selections)
```

### Interactions with Other Systems

| System        | Data Out                                                    | Data In                                                                  | Direction            |
| ------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------- |
| Input         | nav controls (up/down/confirm/cancel/enter)                 | —                                                                        | Input → Menu         |
| GSM           | `requestTransition(Menu→PreRace)`                           | —                                                                        | Menu → GSM           |
| Event Bus     | —                                                           | `gsm.state.entered`, `gsm.state.exited` (Menu LITE maintains local copy) | Event Bus → Menu     |
| Asset Manager | —                                                           | track/team assets loading request                                        | Menu → Asset Manager |
| Data & Config | —                                                           | team data, track list, loading tips                                      | Menu → Data & Config |
| Single Race   | `RaceConfiguration` (selected car, track, laps, difficulty) | —                                                                        | Menu → Single Race   |

The Single Race system receives the player's choices as a `RaceConfiguration` payload after Race Setup confirm. The GSM handles the `Menu → PreRace` transition; Menu LITE triggers it via `requestTransition` when loading completes.

## Formulas

Menu LITE has no formulas. All data is display-only: team names, track names, results come from other systems.

## Edge Cases

- **Double-press ENTER on Title**: first press immediately pushes Car Select; second press is consumed by Car Select's first input tick (ignored because no car is selected yet). No crash, no skip.
- **ESC on Title**: ignored — no accidental game exit. Player must use OS close or Ctrl+Q.
- **No team selected when pressing Enter**: the Confirm button is disabled until a team is highlighted. Keyboard navigation forces at least one selection.
- **Loading takes >2s**: screen stays until assets are ready. Minimum is 2s regardless of how fast assets load (prevents flash-loading that looks like a bug).
- **Loading takes >10s**: after 10s, display a "Still loading..." indicator. Not expected — Phase 1 assets are small — but safety net for slow connections or first load.
- **Race ends immediately (DNF/last lap crash)**: Results screen still shows with DNF position. Rival reaction text handles DNF as a special case.
- **Results screen appears with incomplete data**: if a system fails to provide telemetry (e.g. fuel system didn't log consumption), Results shows what it has and marks missing values as "—".
- **Player spams confirm on Car Select/Race Setup**: first confirm pushes the next screen; subsequent presses are ignored (single-fire button, not toggle).

## Dependencies

| Dependency         | Type     | Notes                                                         |
| ------------------ | -------- | ------------------------------------------------------------- |
| Babylon.js 9.12.0  | Platform | GUI via AdvancedDynamicTexture for all screens                |
| Input              | Upstream | Menu navigation (up/down/confirm/cancel)                      |
| Data & Config Mgmt | Upstream | Team roster, track list, loading tip pool                     |
| Asset Manager      | Upstream | Loads track + car assets before race                          |
| GSM                | Upstream | `currentState` to detect Menu/PostRace; triggers Menu→PreRace |

## Tuning Knobs

| Knob                | Namespace            | Default | Range    | Description                         |
| ------------------- | -------------------- | ------- | -------- | ----------------------------------- |
| Minimum load screen | menu.minLoadDuration | 2000    | 500-5000 | Minimum ms the loading screen shows |

All knobs read from Data & Config Manager.

## Visual/Audio Requirements

- **Style**: all screens follow the Misto dark-panel design (art bible Section 7.1):
  - Background: #0d0d0f, no textures or gradients
  - Panel: #111114, 1px border (5% white), 8px corner radius
  - Team colour accent: ≤5% of screen area, used on top bar (3px gradient), active menu item border, stat fill
  - Type: left-aligned or center-aligned only, uppercase for labels, sentence case for tips
- **Car Select thumbnails**: static render of each team's car on neutral background. No animation in Phase 1.
- **Race Setup**: track cards show a circuit silhouette or photo (prevents bland text-only screen). 4 tracks in responsive grid (2×2 or horizontal row). Settings are horizontal button groups.
- **Loading screen**: track name (large, center), loading tip (smaller, below). Optional: an ambient engine loop playing beneath the silence — brief taste of the car the player chose.
- **Results screen**: top 3 classification with total race times. Player position highlighted if in top 3, separate row if outside. Finish position animated count-up effect. Fastest lap shown with driver name (may not be the player). Rival reaction text: ironic, arrogant, 90s-style trash talk (italic, single line). Minimum 2 variants per rival per position band (win, mid-pack, DNF).
- **Audio**: menu music (synthwave, see Audio GDD §Menu Music) plays during Title/Car Select/Race Setup screens. Navigation tick on confirm/back. Post-MVP: audio settings (music/sfx volume sliders) in a settings screen. Results screen can play a short podium fanfare (3–5s loop) if assets permit.

## UI Requirements

- All screens are Babylon.js GUI (AdvancedDynamicTexture), not HTML overlay.
- Navigation: keyboard arrows/wasd + ENTER + ESC. Gamepad D-pad + A + B.
- Screen transitions: instant (no fade, no slide). Data loads are synchronous or masked by the Loading screen.
- Team colour accent updates reactively when the player selects a different team on Car Select.
- Car and track selection maintain a `selectedId` in a local state object, emitted as `RaceConfiguration` on confirm.
- Loading screen is a pure UI screen — it does not render the 3D scene. The 3D scene (track + cars) is set up behind it and becomes visible when GSM transitions to PreRace.

## Acceptance Criteria

1. Title screen shows logo + "Press ENTER" — no other options
2. ENTER on Title pushes Main Menu with Single Player and Options buttons
3. Single Player on Main Menu pushes Car Select; Options pushes Options screen
4. ESC on Main Menu returns to Title
5. Car Select shows 8 teams in 2×4 grid with colour swatch, number, name
6. Grid navigation (keyboard arrows / D-pad) works across the team grid
7. Selecting a team highlights it; Confirm button becomes active
8. Changing selection multiple times updates highlight and accent colour each time
9. CONFIRM on Car Select pushes Race Setup (combined track + settings screen)
10. Race Setup shows 4 track cards with circuit silhouettes/photos
11. Selecting a track highlights it with accent border
12. Lap count and difficulty selectors show correct range and respond to input
13. ESC on Race Setup returns to Car Select with previous selection preserved
14. CONFIRM on Race Setup pushes Loading screen (minimum 0.5s display, skip if faster)
15. Loading screen shows track name + one random tip from the config pool
16. GSM receives `requestTransition(Menu→PreRace)` when loading completes
17. GSM `PostRace` entry triggers Results screen with top 3 classification + player position
18. Results shows player highlighted if in top 3, separate row if outside
19. Rival reaction text appears (ironic/arrogant tone, one line, italic)
20. "Race Again" on Results triggers PreRace directly (selections preserved)
21. "Main Menu" on Results returns to Title
22. ESC on Title does nothing (no accidental exit)
23. Double-press ENTER on Title is safe (no crash, no screen skip)
24. All screens follow Misto dark-panel style with team colour accent

## Open Questions

- Track thumbnails — procedurally generated from track data or hand-drawn? Phase 1: hand-drawn top-down silhouette (~2–3 per track).
- Rival reaction text pool — how many variants per personality-per-position? Minimum: 2 per rival (win/non-win), plus 1 for DNF. More added in Alpha.
