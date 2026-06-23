# UX Spec: Menu

> **Status**: In Design
> **Author**: ux-designer
> **Last Updated**: 2026-06-22
> **Journey Phase(s)**: First Contact, Orientation, First Mastery
> **Platform Target**: PC (web — Electron/Tauri)
> **Template**: UX Spec

---

## Purpose & Player Need

The player arrives wanting to get into a race or adjust settings. The menu is preparation, not navigation — press start, pick your options, and go.

**What the player needs from each screen**:

- **Title**: confirm the game, press ENTER
- **Main Menu**: choose to start a race or open settings
- **Car Select**: choose a team
- **Race Setup**: pick a track, set laps and difficulty
- **Loading**: anticipation before the race
- **Results**: see performance and proceed

---

## Player Context on Arrival

The player first encounters the Title at game launch. They arrive at each screen by navigating forward or backward via ESC.

| Screen         | Context                                                                |
| -------------- | ---------------------------------------------------------------------- |
| **Title**      | Game just launched. Emotional state: eager, ready to race.             |
| **Main Menu**  | Player pressed ENTER on Title. Now choosing: Single Player or Options. |
| **Car Select** | Player chose Single Player. Quick decision expected.                   |
| **Race Setup** | Player chose a car. Now picking track, laps, difficulty.               |
| **Loading**    | Anticipation building.                                                 |
| **Results**    | Race just ended. Satisfied, frustrated, or neutral.                    |

---

## Navigation Position

The menu flow:

```
Title ──ENTER──▶ Main Menu ──Single Player──▶ Car Select ──CONFIRM──▶ Race Setup ──CONFIRM──▶ Loading ──READY──▶ [Race]
   ▲                    │                                                            │
   │                    └──Options──▶ Options Screen ──ESC──▶ Main Menu                │ ESC
   │                                                                                   ▼
   └───────────────────── "Main Menu" ◀─── Results ◀─────── [Race ends] ───────────────┘
                                 │
                                 └─── "Race Again" ──▶ PreRace (preserves selections)
```

All screens live under the GSM `Menu` state (except Results, under `PostRace`). Main Menu is the hub — Single Player pushes Car Select, Options pushes the settings screen.

```
GSM state: Menu ──────────────────────────────────► PostRace
             │                                           │
             ▼                                        ▼
  Title → Car Select → Race Setup → Loading → [Race] → Results
    ▲         ▲              │                             │
    │         │              │ ESC                         │
    │         │              ▼                             │
    │         └─────── Race Setup ◀────────────────────────┘
    │
    └─── "Main Menu" ◀─── Results ──── "Race Again" ──► PreRace ──► Racing
```

---

## Entry & Exit Points

| Screen         | Entry Trigger                                    | Exit Trigger(s)                                      | Player Carries This Context        |
| -------------- | ------------------------------------------------ | ---------------------------------------------------- | ---------------------------------- |
| **Title**      | GSM Menu entry                                   | ENTER/Start → Main Menu                              | —                                  |
| **Main Menu**  | ENTER from Title                                 | Single Player → Car Select; Options → Options screen | —                                  |
| **Car Select** | Single Player from Main Menu                     | Confirm → Race Setup; ESC → Main Menu                | Selected team ID                   |
| **Race Setup** | Confirm from Car Select                          | Confirm → Loading; ESC → Car Select                  | Team, track, lap count, difficulty |
| **Loading**    | Confirm from Race Setup                          | Assets ready → GSM PreRace (one-way)                 | Complete RaceConfiguration         |
| **Results**    | Drone finish (skip or timeout, see race-flow.md) | "Race Again" → PreRace. "Main Menu" → Title          | Race results                       |

Note: ESC on Title is ignored per design (no accidental game exit).

| Exit Destination | Trigger                           | Notes                                |
| ---------------- | --------------------------------- | ------------------------------------ |
| **PreRace**      | Loading completes OR "Race Again" | Race starts. Not reversible.         |
| **Title**        | "Main Menu" from Results          | Returns to start of flow.            |
| **OS close**     | Alt+F4 / Cmd+Q / window close     | Only allowed exit from Title screen. |

---

## Layout Specification

### Title Screen

```
┌──────────────────────────────────────┐
│                                      │
│                                      │
│          ╔══════════════╗            │
│          ║   OVERDRIVE  ║            │  ← Game logo, centred, large
│          ╚══════════════╝            │
│                                      │
│            v0.1.0                    │  ← Version number, muted
│                                      │
│       PRESS ENTER TO START           │  ← Static text
│                                      │
│                                      │
│   [Background: dark (#0d0d0f).       │
│    Post-MVP: strongest car           │
│    (McLaren Marlboro) rendered       │
│    behind the title]                 │
└──────────────────────────────────────┘
```

**Key points**:

- Single action — ENTER pushes Main Menu
- No menu options on Title
- ESC ignored (no accidental exit)
- Post-MVP: 3D car render of the championship-winning car behind the title

---

### Main Menu

```
┌──────────────────────────────────────┐
│                                      │
│         ╔══════════════╗             │
│         ║   OVERDRIVE  ║             │  ← Logo, smaller than Title
│         ╚══════════════╝             │
│                                      │
│        ┌──────────────────┐          │
│        │   SINGLE PLAYER  │          │  ← Primary action, accent colour
│        └──────────────────┘          │
│                                      │
│        ┌──────────────────┐          │
│        │     OPTIONS      │          │  ← Opens settings screen
│        └──────────────────┘          │
│                                      │
│                                      │
│   [Background: dark (#0d0d0f),       │
│    same style as Title]              │
└──────────────────────────────────────┘
```

**Key points**:

- Hub screen: Single Player starts the race flow, Options opens settings
- ESC returns to Title
- Clean, minimal — two buttons, no clutter

---

### Car Select (8-team grid)

```
┌──────────────────────────────────────┐
│  SELECT YOUR TEAM                    │
│                                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│  │ LOR  │ │ MACK │ │ FER  │ │ WILL ││  ← 2×4 grid
│  │ #7   │ │ #1   │ │ #27  │ │ #5   ││     Team colour swatch
│  └──────┘ └──────┘ └──────┘ └──────┘│     Car number
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│     Team name (3-4 chars)
│  │ JOR  │ │ BRA  │ │ PRO  │ │ ARQ  ││
│  │ #15  │ │ #11  │ │ #22  │ │ #77  ││
│  └──────┘ └──────┘ └──────┘ └──────┘│
│                                      │
│     [CONFIRM]         ║car render║   │  ← Confirm button + thumbnail
│                                      │
│  [Selected team's car thumbnail      │
│   on neutral background]             │
└──────────────────────────────────────┘
```

**Key points**:

- Grid navigation via keyboard arrows / D-pad
- Selected team highlighted with accent border
- Confirm button disabled until a team is selected
- Car thumbnail updates reactively on selection change
- Team colour accent updates across the screen on selection

---

### Race Setup (Track Select + Settings combined)

```
┌──────────────────────────────────────┐
│         RACE SETUP                   │
│                                      │
│  ┌──────────┐ ┌──────────┐          │
│  │  ═══     │ │  ═══     │          │  ← Track cards with
│  │  ═ SPA   │ │  MONZA   │          │     silhouette/photo
│  │  ═══     │ │          │          │     (4 horizontal, or
│  └──────────┘ └──────────┘          │      2×2 grid)
│  ┌──────────┐ ┌──────────┐          │
│  │          │ │          │          │
│  │INTERLAGOS│ │  MONACO  │          │
│  │          │ │          │          │
│  └──────────┘ └──────────┘          │
│                                      │
│  LAPS                                │
│  [3] [5] [10] [20]                   │  ← Horizontal button group
│                                      │
│  DIFFICULTY                          │
│  [Very Easy] [Easy] [Medium]         │
│  [Hard] [Very Hard]                  │
│                                      │
│  ── Confirmed: LORRIS #7 ──          │
│            [START RACE]              │
└──────────────────────────────────────┘
```

**Key points**:

- Combined screen reduces navigation steps (eliminates separate Track Select → confirm → Race Settings)
- Track cards show a circuit silhouette or photo — prevents a bland text-only screen
- 4 tracks in 2×2 grid or horizontal row (responsive)
- Selected track highlighted with accent border
- Lap count and difficulty are horizontal button groups — one active at a time
- ESC returns to Car Select with all selections preserved
- "Confirmed: [Team]" bar shows current selection below settings

---

### Loading Screen

```
┌──────────────────────────────────────┐
│                                      │
│              SPA                      │  ← Track name, large, centred
│                                      │
│   "Brake early into La Source —      │
│    the inside line is tighter than   │  ← Random tip from pool
│    it looks."                        │
│                                      │
│                                      │
│   [No progress bar — minimum 0.5s    │
│    display. After 10s: "Still        │
│    loading..." indicator appears]    │
│                                      │
└──────────────────────────────────────┘
```

**Key points**:

- Pure UI screen — no 3D scene rendered behind it
- Minimum 0.5s display (skip if loading completes faster)
- Single random tip from config pool
- After 10s: "Still loading..." text appears (safety net)
- Transitions to PreRace when assets ready AND minimum time elapsed

---

### Results Screen

```
┌──────────────────────────────────────┐
│          RACE RESULTS                │
│                                      │
│  P1  MACKLEN     12:30.200           │  ← Top 3 with times
│  P2  FERREL      12:32.100           │     Player position
│  P3  LORRIS      12:34.567  ← YOU    │     highlighted if in top 3
│                                      │
│  Fastest lap: 1:32.400 (MACKLEN)     │
│                                      │
│  "You got lucky out there."          │  ← Rival reaction
│              — Macklen               │     Ironic, arrogant, 90s-style
│                                      │
│  [RACE AGAIN]      [MAIN MENU]       │
└──────────────────────────────────────┘

If player is NOT in top 3:
┌──────────────────────────────────────┐
│  P1  MACKLEN     12:30.200           │
│  P2  FERREL      12:32.100           │
│  P3  WILLARD     12:33.800           │
│                                      │
│  P7  LORRIS      12:45.100  ← YOU    │
│                                      │
│  Fastest lap: 1:32.400 (MACKLEN)     │
│                                      │
│  "Not your day, rookie."             │
│              — Macklen               │
│                                      │
│  [RACE AGAIN]      [MAIN MENU]       │
└──────────────────────────────────────┘
```

**Key points**:

- Position number animated count-up (~200ms per digit, one-time)
- Top 3 always shown with total race time
- Player position shown separately if outside top 3
- Total time format: MM:SS.mmm
- Fastest lap shown with driver name (may not be the player)
- Rival reaction from the highest-standing rival: ironic, arrogant, 90s-style trash talk (min 2 variants per rival per position band: win, mid-pack, DNF)
- "Race Again" preserves all previous selections — back to PreRace directly
- "Main Menu" returns to Title screen

---

## States & Variants

| Screen         | State / Variant            | Trigger                      | What Changes                                                                                                             |
| -------------- | -------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Title**      | Default                    | GSM Menu entry               | Logo + "Press ENTER" shown. No selection needed.                                                                         |
| **Title**      | Post-MVP car render        | Game loads                   | 3D car model visible behind the title elements                                                                           |
| **Main Menu**  | Default                    | ENTER from Title             | Two buttons: Single Player + Options. Logo displayed.                                                                    |
| **Car Select** | Default                    | Single Player from Main Menu | 8-team grid, no selection, Confirm disabled                                                                              |
| **Car Select** | Team selected              | Player highlights a team     | Accent border on cell. Confirm enabled. Car thumbnail updates.                                                           |
| **Race Setup** | Default                    | Confirm from Car Select      | Track cards, lap count (5 default), difficulty (Medium default). All settings have defaults — START RACE always enabled. |
| **Race Setup** | Track selected             | Player highlights a track    | Accent border on card                                                                                                    |
| **Loading**    | Loading                    | Confirm from Race Setup      | Track name + tip shown. No progress bar. Minimum 0.5s.                                                                   |
| **Loading**    | Stalled (10s+)             | Loading > 10s                | "Still loading..." text appears below tip                                                                                |
| **Loading**    | Error — asset load failure | Asset load fails             | "Failed to load assets. Returning to menu..." text + auto-return to Title after 2s                                       |
| **Results**    | Default                    | GSM PostRace                 | Top 3 classification, player position, rival reaction                                                                    |
| **Results**    | Empty / DNF                | Player DNF'd                 | Position shows DNF, rival reaction handles DNF as special case, total time shows "—"                                     |

---

## Interaction Map

Mapping interactions for: Keyboard/Mouse + Gamepad (Full). Primary Input: Gamepad.

### Title

**Default focus**: N/A — single action (ENTER), no tab order needed.

| Component | Action      | Keyboard | Gamepad | Feedback         | Outcome        |
| --------- | ----------- | -------- | ------- | ---------------- | -------------- |
| Screen    | Press Start | ENTER    | A       | Brief transition | Push Main Menu |

### Main Menu

**Default focus**: Single Player button. Tab order: Single Player → Options → [wrap to Single Player].

| Component     | Action | Keyboard              | Gamepad   | Feedback     | Outcome             |
| ------------- | ------ | --------------------- | --------- | ------------ | ------------------- |
| Single Player | Select | ENTER (default focus) | A         | Button press | Push Car Select     |
| Options       | Select | ▲ ▼ + ENTER           | D-pad + A | Button press | Push Options screen |
| ESC           | Back   | ESC                   | B         | —            | Pop to Title        |

### Car Select

**Default focus**: First team card (top-left, LOR). Grid focus order: row by row, left to right, top to bottom. No wrap within grid — end of row moves to next row, end of grid stays on last cell. Confirm button reachable via Tab or down navigation from bottom row.

| Component      | Action   | Keyboard               | Gamepad             | Feedback                      | Outcome                                    |
| -------------- | -------- | ---------------------- | ------------------- | ----------------------------- | ------------------------------------------ |
| Team grid      | Navigate | ▲ ▼ ◀ ▶ arrows or WASD | D-pad or left stick | Highlight moves between cells | Selected cell has accent border            |
| Confirm button | Select   | ENTER                  | A                   | Button press                  | Push Race Setup (preserves team selection) |
| ESC            | Back     | ESC                    | B                   | —                             | Pop to Title                               |

### Race Setup

**Default focus**: First track card. Tab order: track cards → lap count group → difficulty group → START RACE → ESC → [wrap to first track card].

| Component   | Action   | Keyboard            | Gamepad             | Feedback                      | Outcome                                      |
| ----------- | -------- | ------------------- | ------------------- | ----------------------------- | -------------------------------------------- |
| Track cards | Navigate | ▲ ▼ ◀ ▶             | D-pad or left stick | Highlight moves between cards | Selected card has accent border              |
| Lap count   | Select   | ◀ ▶ on active group | D-pad left/right    | Button toggle                 | Active lap count highlighted                 |
| Difficulty  | Select   | ◀ ▶ on active group | D-pad left/right    | Button toggle                 | Active difficulty highlighted                |
| START RACE  | Confirm  | ENTER               | A                   | Button press                  | Push Loading                                 |
| ESC         | Back     | ESC                 | B                   | —                             | Pop to Car Select (preserves all selections) |

### Loading

No interactive elements — auto-transition only. No tab order needed.

### Results

**Default focus**: Race Again button. Tab order: Race Again → Main Menu → [wrap to Race Again].

| Component  | Action | Keyboard | Gamepad | Feedback     | Outcome                                          |
| ---------- | ------ | -------- | ------- | ------------ | ------------------------------------------------ |
| Race Again | Select | ENTER    | A       | Button press | GSM transition to PreRace (selections preserved) |
| Main Menu  | Select | ESC      | B       | Button press | Pop to Title                                     |

---

## Events Fired

| Player Action         | Event                                 | Payload                                           | Notes                       |
| --------------------- | ------------------------------------- | ------------------------------------------------- | --------------------------- |
| Confirm on Race Setup | `RaceConfiguration` to Single Race    | `{ teamId, trackId, lapCount, difficulty, seed }` | Triggers asset loading      |
| Loading complete      | `requestTransition(Menu→PreRace)`     | —                                                 | GSM handles state change    |
| "Race Again"          | `requestTransition(PostRace→PreRace)` | Same `RaceConfiguration` as previous race         | Selections preserved        |
| "Main Menu"           | Pop to Title                          | —                                                 | Menu LITE pops back to root |

---

## Transitions & Animations

Todas as transições entre telas do Menu são **instantâneas** — sem fade, slide, ou crossfade. A Loading screen serve como a única transição com duração visível entre o Menu e a corrida. Nenhuma animação de menu dura mais que um frame.

| Transition                     | Method                           | Duration           | Notes                                                       |
| ------------------------------ | -------------------------------- | ------------------ | ----------------------------------------------------------- |
| Title → Main Menu              | Instant (`isVisible` toggle)     | 0ms                | Push. ESC returns to Title.                                 |
| Main Menu → Car Select         | Instant                          | 0ms                | Push. ESC returns to Main Menu.                             |
| Car Select → Race Setup        | Instant                          | 0ms                | Push. ESC returns to Car Select with selection preserved.   |
| Main Menu → Options            | Instant                          | 0ms                | Push. ESC returns to Main Menu.                             |
| Race Setup → Loading           | Instant                          | 0ms                | Loading screen appears immediately. Race assets load async. |
| Loading → PreRace              | Scene swap behind Loading        | 0ms                | Loading stays visible until scene ready.                    |
| Results → PreRace (Race Again) | Instant                          | 0ms                | Same RaceConfiguration. No asset reload.                    |
| Results → Title (Main Menu)    | Instant pop to root              | 0ms                | Screen stack cleared. Title reappears.                      |
| Position count-up (Results)    | Tick animation, ~200ms per digit | Varies by position | One-time, only on Results entry                             |
| Pause → Options                | Instant                          | 0ms                | Push. ESC returns to Pause overlay.                         |

---

## Data Requirements

| Data                   | Source System         | Read / Write | Notes                                              | Null / Failure Display                                                          |
| ---------------------- | --------------------- | ------------ | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| Team roster            | Data & Config         | Read         | 8 teams with colours, numbers, name                | Show loading spinner. If unreachable, show "Teams unavailable" + ESC to return  |
| Track list             | Data & Config         | Read         | 4 tracks with name, silhouette/thumbnail path      | Show loading spinner. If unreachable, show "Tracks unavailable" + ESC to return |
| Loading tips           | Data & Config         | Read         | Pool of random tips                                | Show empty — "Still loading..." appears at 10s regardless                       |
| Selected team/track    | Menu LITE local state | Read/Write   | Temporary; emitted as RaceConfiguration on confirm | — (always set by player before navigation)                                      |
| Lap count + difficulty | Menu LITE local state | Read/Write   | Temporary; defaults: 5, Medium                     | — (always have default values)                                                  |
| Race results           | Race Management       | Read         | Position, total time, fastest lap, rival data      | If unreachable: "Results unavailable" text over placeholder layout              |

---

## Accessibility

Standard tier (MVP launch).

| Requirement                     | Implementation                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Keyboard navigation             | ▲ ▼ ◀ ▶ arrows + ENTER + ESC — full keyboard flow across all screens                                             |
| Focus indicators                | All interactive elements have visible focus rings (buttons, grid cells, toggle groups)                           |
| Text contrast                   | White text on #0d0d0f background. WCAG AA compliant.                                                             |
| Color-independent communication | Team selection uses accent border + team name, not colour alone. Position uses number + "YOU" label, not colour. |
| Motion sensitivity              | Zero transitions (instant). Count-up animation is optional, one-time, non-essential.                             |

---

## Localization Considerations

| Screen     | Elements                                                     | Layout Risk                                                                           |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Title      | "PRESS ENTER TO START"                                       | Low — short phrase                                                                    |
| Car Select | Team names (abbreviated, 3-4 chars)                          | Low — abbreviations stay short in all languages                                       |
| Race Setup | Track names proper nouns, "LAPS", "DIFFICULTY", "START RACE" | Low — labels are short                                                                |
| Loading    | Random tips (longest element)                                | Medium — 40% expansion may wrap at narrow widths. Tip pool can be curated per locale. |
| Results    | "RACE AGAIN", "MAIN MENU", rival reactions, "FASTEST LAP"    | Medium — rival reactions need per-locale adaptation (humour/cultural context)         |

Rival reactions require per-locale writing — 90s trash talk varies significantly by culture. Plan for 1–2 additional characters per line after translation. All button labels use padding-based widths, not fixed pixel sizes.

---

## Acceptance Criteria

- [ ] Title screen shows logo and "PRESS ENTER TO START" — no other options, ESC ignored
- [ ] ENTER on Title pushes Main Menu with Single Player and Options buttons
- [ ] Single Player pushes Car Select; Options pushes Options screen
- [ ] ESC on Main Menu returns to Title
- [ ] Car Select shows 8 teams in 2×4 grid with colour swatch, number, name
- [ ] ▲ ▼ ◀ ▶ navigates grid; selected team has accent border
- [ ] Confirm button is disabled until a team is selected
- [ ] CONFIRM pushes Race Setup showing 4 track cards + lap/difficulty selectors
- [ ] Track cards show circuit silhouette/photo with name
- [ ] Lap count defaults to 5, difficulty defaults to Medium
- [ ] ESC on Race Setup returns to Car Select with all selections preserved
- [ ] CONFIRM on Race Setup pushes Loading screen (minimum 0.5s)
- [ ] Loading screen shows track name + random tip
- [ ] "Still loading..." appears after 10s
- [ ] Results shows top 3 classification with total times
- [ ] Player position highlighted if in top 3, shown separately if outside
- [ ] Rival reaction text appears (ironic/arrogant tone, one line)
- [ ] "Race Again" starts new race with same settings
- [ ] "Main Menu" returns to Title
- [ ] All interactive elements reachable via keyboard-only navigation

## Open Questions

| Question                                                                                                                  | Owner              | Deadline | Resolution                                        |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------- | ------------------------------------------------- |
| Title screen car render — which car and how to render? (Static sprite, isolated 3D mesh, BeautyContour render?)           | art-director       | Alpha    | [Post-MVP — use strongest car (McLaren Marlboro)] |
| Track thumbnails — procedurally generated or hand-drawn?                                                                  | art-director       | Alpha    | [Phase 1: hand-drawn top-down silhouette]         |
| Rival reaction text pool — how many variants per rival per position band?                                                 | narrative-director | Alpha    | [Min 2 per rival × 3 bands (win, mid-pack, DNF)]  |
| Loading tips — curated pool per locale or English-only with auto-translate?                                               | localization-lead  | Alpha    | [English-first, locales in Alpha]                 |
| Race Setup hard confirmation — does the player need to explicitly START or can settings auto-confirm after a short delay? | game-designer      | MVP      | [Hard confirm via START RACE button]              |
