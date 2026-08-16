# UX Spec: Car Selection

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-31
> **Journey Phase(s)**: Orientation (5-30 minutes)
> **Platform Target**: PC, Web
> **Template**: UX Spec

---

## Purpose & Player Need

Car Selection is where the player chooses their weapon. It shows the 3D car model on a turntable, team identity, 6 performance stats, and fuel comparison — letting the player pick based on preference, strategy, or team loyalty.

**Player goal:** Choose a car that matches their driving style — the fast one, the balanced one, or the one they feel connected to.

**What goes wrong without it:** The player has no control over what they drive. The game feels predetermined, not player-driven.

**Emotional contract:** "This is MY team. This is MY car." The moment the player picks a car and sees it rotate under warm garage light, they feel ownership.

---

## Player Context on Arrival

**After track selection:** The player just picked their track. They're now choosing the car to race with. They already know where they're going — now they need to decide what to drive.

**Return from race:** The player just finished a race and wants to try a different car. They return to Car Selection via Title → Track Selection → Car Selection.

**Emotional state:** Decisive, strategic. "Which car is best for Monaco?" or "I want to try the fastest one."

---

## Navigation Position

Car Selection is the third screen in the pre-race flow:

```
Title → Track Selection → Car Selection → Qualifying Not Started → Qualifying → Qualifying Results → Loading → Race
```

Back/Cancel returns to Track Selection. The player has already chosen their track — going back means reconsidering the arena, not the car.

---

## Entry & Exit Points

**Entry Points:**

| Entry Source | Trigger | Player carries this context |
|---|---|---|
| Track Selection | Confirm on selected track | Track ID locked |

**Exit Points:**

| Exit Destination | Trigger | Notes |
|---|---|---|
| Qualifying Not Started | "Select" button (Confirm) | Car choice locked, proceeds to qualifying |
| Track Selection | Back/Cancel | Returns to Track Selection |

**Notes:** Car Selection is a simple one-step screen — pick a car, move forward. Track ID is carried from Track Selection.

---

## Layout Specification

### Information Hierarchy

| Priority | Information | Location |
|----------|------------|----------|
| 1 | 3D car model (turntable) | Right panel — visual anchor |
| 2 | Team name + logo | Right panel header |
| 3 | 6 stats (real values or descriptive words) | Right panel below model |
| 4 | Car list (all 16 teams) | Left panel — scrollable |

### Layout Zones

- **Zone 1 — Header (top):** "SELECT YOUR CAR"
- **Zone 2 — Car List (left):** Vertical scrollable list of team names with logos. Selected car highlighted. Team accent colors apply.
- **Zone 3 — Car Detail (right):** 3D model (turntable, warm lighting), team name + logo, 6 stat bars with real values/words. Team accent colors apply.
- **Zone 4 — Bottom:** "SELECT" button + hint text

**Data-driven:** All car data comes from the car definition file (team name, logo, 6 stats). No hardcoded team names. Layout works for any number of cars via scroll.

**Team theming:** The entire screen shifts accent colors to match the selected team's livery. Left list highlight, right panel accents, and stat bar colors all adapt.

### Component Inventory

| Component | Zone | Type | Interactive | Notes |
|-----------|------|------|-------------|-------|
| "SELECT YOUR CAR" label | 1 | Label | No | Header |
| Team list (scrollable) | 2 | List | Yes | Navigate up/down, selected team highlighted with accent |
| Team logo | 2 | Image | No | Beside team name in list |
| 3D car model | 3 | 3D render | No | Turntable rotation, warm Garage Lit lighting |
| Team name + logo | 3 | Label + Image | No | Header for detail panel |
| Stat bars (6) | 3 | Bars + Labels | No | Real values (km/h, s) or descriptive words (Excellent/Poor) |
| "SELECT" button | 4 | Button | Yes | Confirm pattern (Enter/South) |

### Stat Display Rules

| Stat | Display | Unit |
|------|---------|------|
| Top Speed | Real value | km/h |
| Acceleration | Real value | s (0-100) |
| Brake Power | Descriptive word | Excellent/Very Good/Good/Fair/Poor |
| Grip Level | Descriptive word | Excellent/Very Good/Good/Fair/Poor |
| Stability | Descriptive word | Excellent/Very Good/Good/Fair/Poor |
| Efficiency | Descriptive word | Excellent/Very Good/Good/Fair/Poor |

**Word scale (data-driven, table in code):**

| Stat Range | Word |
|------------|------|
| 18-20 | Excellent |
| 14-17 | Very Good |
| 10-13 | Good |
| 6-9 | Fair |
| 2-5 | Poor |

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│                    [SELECT YOUR CAR]                        │
│                                                             │
│  ┌──────────────┬──────────────────────────────────────┐   │
│  │              │                                      │   │
│  │  > Madonna   │         ┌────────────────┐           │   │
│  │    [logo]    │         │                │           │   │
│  │              │         │   3D CAR MODEL │           │   │
│  │  Firenze     │         │   (turntable)  │           │   │
│  │    [logo]    │         │                │           │   │
│  │              │         └────────────────┘           │   │
│  │  Millions    │                                      │   │
│  │    [logo]    │  Madonna          [logo]             │   │
│  │              │                                      │   │
│  │  Macklen     │  Top Speed     298 km/h   ████░░░░  │   │
│  │    [logo]    │  Acceleration  3.2s       ██████░░  │   │
│  │              │  Brake Power   Very Good  ██████░░  │   │
│  │  Willard     │  Grip Level    Very Good  ████████  │   │
│  │    [logo]    │  Stability     Very Good  ██████░░  │   │
│  │              │  Efficiency    Very Good  ████████  │   │
│  │  Ferrell     │                                      │   │
│  │    [logo]    │                                      │   │
│  │              │                                      │   │
│  │  ...         │                                      │   │
│  └──────────────┴──────────────────────────────────────┘   │
│                                                             │
│                    [SELECT]                                 │
│                    Enter: Select    Esc: Back               │
└─────────────────────────────────────────────────────────────┘
```

---

## States & Variants

| State | Trigger | What Changes |
|-------|---------|--------------|
| Default | Normal load | All cars shown, first car selected by default |
| Car locked (Alpha+) | Player hasn't earned access | Car greyed out, "LOCKED" overlay, cannot be selected |
| Content error | Car data fails to load | Error message, car removed from list |

**Notes:** MVP has all 16 cars unlocked. Locked cars are Alpha+ when team switching via rival challenge is added. Content error is rare — car data is local. Team accent colors change dynamically based on selection.

---

## Interaction Map

| Component | Action | Input (Keyboard) | Input (Gamepad) | Feedback | Outcome |
|-----------|--------|-------------------|------------------|----------|---------|
| Car list | Navigate | ↑ / ↓ | D-pad ↑↓ / Left stick | Car highlight moves, detail panel updates, team colors shift | Detail panel updates |
| Car list | Select | Enter | South (A) | Car confirmed, highlight stays | Proceeds to Qualifying Not Started |
| "SELECT" button | Confirm | Enter | South (A) | Button flash + click sound | Qualifying Not Started |
| Back/Cancel | Return | Escape | East (B) | Returns to Track Selection | Track Selection screen |

**Notes:** The car list and "SELECT" button both respond to Confirm/Enter. Team accent colors update in real-time as the player navigates the list.

---

## Events Fired

| Player Action | Event Fired | Payload |
|---|---|---|
| Select car (Enter/South on list or button) | `CarSelected` | `{ carId }` |

**Notes:** The event carries only the car ID. All car data (team name, logo, stats, colors) is derived from the car definition file at runtime. No analytics events — this is a navigation event.

---

## Transitions & Animations

| Transition | Animation | Duration | Notes |
|------------|-----------|----------|-------|
| Screen enter | Slide from right | 300ms | Push navigation from Track Selection |
| Screen exit → Qualifying | Slide left | 300ms | Push navigation to Qualifying Not Started |
| Screen exit → Track Selection | Slide right | 300ms | Pop navigation back |
| Car selection highlight | Team accent color fill | 150ms | Smooth transition between cars |
| Detail panel update | Crossfade | 200ms | 3D model + stats fade in/out on car change |
| 3D car turntable | Continuous slow rotation | Loop | ~10s per revolution, pauses on button hover |
| Team color shift | Accent color transition | 300ms | Screen accents smoothly shift to selected team's colors |

**Reduced Motion:** All transitions instant. No slide, no crossfade, no turntable rotation — static model. Team color shift becomes instant.

---

## Data Requirements

| Data | Source System | Read / Write | Notes |
|------|--------------|--------------|-------|
| Car list | Content Pipeline | Read | Data-driven, from car definition files |
| Team name | Car Definition Data | Read | Display name (fictionalized) |
| Team logo | Car Definition Data | Read | Static image asset |
| Team colors | Car Definition Data | Read | For screen accent theming |
| 3D car model | Content Pipeline | Read | Loaded via Addressables |
| Top Speed (km/h) | Car Definition Data | Read | Computed from formula: min=250, max=310 |
| Acceleration (s) | Car Definition Data | Read | Computed from formula: min=2.0, max=5.0 |
| Brake Power (word) | Car Definition Data | Read | Mapped from stat via word scale table |
| Grip Level (word) | Car Definition Data | Read | Mapped from stat via word scale table |
| Stability (word) | Car Definition Data | Read | Mapped from stat via word scale table |
| Efficiency (word) | Car Definition Data | Read | Mapped from stat via word scale table |
| Selected car ID | Settings / Save | Write | Stored for Qualifying/Race |

**Notes:** Car Selection is read-only except for storing the selected car ID. All visual data comes from car definition files. Word scale table is data-driven (changeable in code without touching UX spec).

---

## Accessibility

**Tier: Standard**

| Requirement | Implementation |
|-------------|----------------|
| Keyboard-only navigation | Car list reachable via ↑/↓, Confirm via Enter. Back via Escape. |
| Gamepad navigation | Car list reachable via D-pad/Left stick, Confirm via South. Back via East. |
| Focus indicator | Visible 2px outline on selected car in list |
| Text contrast | Minimum 4.5:1 — white text on dark background |
| Color-independent | Selected car highlighted by outline + ">" marker, not just team color. Stats show words, not just bar lengths. |
| Accessible labels | Car list items carry semantic names ("Madonna — Top Speed 298 km/h, Acceleration 3.2 seconds") for future assistive tech expansion; no active screen reader support at Standard tier |
| Reduced Motion | No slide transitions, no crossfade, no turntable — static model. Team color shift instant. |
| Text scaling | All text respects 75%–200% scaling. List and detail panel reflow. |

---

## Localization Considerations

| Element | Max Length | Layout Impact | Priority |
|---------|-----------|---------------|----------|
| Team names | ~20 chars | List item width — 40% expansion safe | HIGH |
| "SELECT" button | ~15 chars | Button width — 40% expansion safe | HIGH |
| Stat words ("Excellent", "Very Good") | ~15 chars | Stat label width — 40% expansion safe | HIGH |
| Top Speed / Acceleration values | ~10 chars | Fixed format, no expansion | LOW |

**Notes:** Team names and stat words are the longest variable elements. Values (km/h, s) use invariant formatting. The 40% expansion rule applies to team names, button labels, and stat words.

---

## Acceptance Criteria

- [ ] Car Selection opens within 300ms from Track Selection
- [ ] All 16 cars shown in scrollable list with team names and logos
- [ ] Selected car shows 3D model (turntable), team name + logo, 6 stats
- [ ] Stats display real values (km/h, s) for Top Speed and Acceleration
- [ ] Stats display descriptive words (Excellent/Very Good/Good/Fair/Poor) for Brake Power, Grip Level, Stability, Efficiency
- [ ] Team accent colors shift dynamically when selecting different cars
- [ ] ↑/↓ (keyboard) or D-pad/Left stick (gamepad) moves selection in car list
- [ ] Enter/South confirms selection and navigates to Qualifying Not Started
- [ ] Escape/East returns to Track Selection
- [ ] Detail panel updates instantly on car change
- [ ] Focus indicator visible on selected car
- [ ] Accessible labels on car list items announce team name, top speed, and acceleration (semantic naming for future assistive tech)
- [ ] Reduced Motion: no slide transitions, no crossfade, no turntable — static model
- [ ] All text meets minimum 14px at 1080p

---

## Open Questions

- ~~3D car model: loaded via Addressables per-race. Should it be preloaded on Car Selection screen for instant display, or loaded on-demand (brief loading)?~~ **DECIDED:** All 16 cars preloaded on Car Selection entry (all cars are always used in every race — no lazy-load).
- Team logos: static PNG assets, one per team. Generated from art pipeline.
- Locked cars (Alpha+): overlay with "LOCKED" text + greyed model. Unlock via rival challenge.
