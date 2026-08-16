# UX Spec: Qualifying Results

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-29
> **Journey Phase(s)**: Pre-Race (grid confirmation)
> **Platform Target**: PC, Web
> **Template**: UX Spec

---

## Purpose & Player Need

Qualifying Results is the moment of consequence before the race. It shows all 16 starting positions — the direct result of qualifying performance. The player sees where they start, who's ahead, and who's behind. It's a brief pause between preparation and action.

**Player goal:** See their starting position and the grid order. Understand the challenge ahead.

**What goes wrong without it:** The player has no context for the race start. They don't know where they are on the grid or who they're racing against.

**Emotional contract:** Tension and anticipation. "I qualified P5 — 4 cars ahead, 11 behind. The race starts NOW."

---

## Player Context on Arrival

**After qualifying:** The player just completed a flying lap. They're still riding the adrenaline of pushing the car to the limit. They see the grid and their position — satisfaction if they qualified well, determination if they didn't.

**After skipping qualifying:** The player chose to skip. They know they're starting at P16 (last). The grid confirms this. No surprise — they opted into this consequence.

**Emotional state:** Focused, anticipatory. The race is about to begin. This screen is the last breath before the lights.

---

## Navigation Position

Qualifying Results is a terminal confirmation screen — one-way, no back path. It sits at:

```
Finished Presentation → Qualifying Results → Loading → Race
Skip Qualifying → Qualifying Results → Loading → Race
```

There is no alternate entry path. The player always arrives from either Finished Presentation (after qualifying) or the Skip decision. There is no exit back — only forward into the race.

---

## Entry & Exit Points

**Entry Points:**

| Entry Source | Trigger | Player carries this context |
|---|---|---|
| Finished Presentation | Confirm (Enter/South) | Qualifying times for all 16 cars, player's position |
| Skip Qualifying | Confirm on "Skip" | No qualifying times — player at P16, AI times pre-generated |

**Exit Points:**

| Exit Destination | Trigger | Notes |
|---|---|---|
| Loading → Race | Confirm (Start Race) | Irreversible — race begins. Grid assignment is consumed. |

**Notes:** The GDD explicitly states: "no timeout or Back/Cancel path." The only exit is Confirm → Loading → Race. This is a one-way gate.

---

## Layout Specification

### Information Hierarchy

| Priority | Information | Location |
|----------|------------|----------|
| 1 | Player's position (highlighted) | Prominent in grid list |
| 2 | Grid order (P1–P16) with car names and qualifying times | Main content area |
| 3 | Track name and race info | Header |
| 4 | "Start Race" button | Bottom |

### Layout Zones

- **Zone 1 — Header (top):** Track name + race info (laps)
- **Zone 2 — Grid List (center):** 2-column staggered formation matching the real grid. Left column (P1, P3, P5…) is visually ahead of right column (P2, P4, P6…). Player's row highlighted.
- **Zone 3 — Bottom:** Confirm button ("Start Race")
- **Background:** 3D scene showing 16 cars on grid, static top-down camera

### Component Inventory

| Component | Zone | Type | Interactive | Notes |
|-----------|------|------|-------------|-------|
| Track name + laps | 1 | Label | No | Header info |
| Grid rows (16) | 2 | List items | No | 2-column staggered, player highlighted |
| Qualifying times | 2 | Labels | No | Beside each car name, or "DNQ" |
| "Start Race" button | 3 | Button | Yes | Confirm pattern (Enter/South) |

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────┐
│              [TRACK NAME — 5 LAPS]                  │
│                                                     │
│  P1  Car Name                                      │
│              P2  Car Name                           │
│  P3  Car Name                                      │
│              P4  Car Name                           │
│  P5  Car Name ★                                    │
│              P6  Car Name                           │
│  P7  Car Name                                      │
│              P8  Car Name                           │
│  P9  Car Name                                      │
│              P10 Car Name                           │
│  P11 Car Name                                      │
│              P12 Car Name                           │
│  P13 Car Name                                      │
│              P14 Car Name                           │
│  P15 Car Name                                      │
│              P16 Car Name                           │
│                                                     │
│         Qualifying times shown beside each name     │
│                                                     │
│              [START RACE]                           │
│              Enter: Start                           │
└─────────────────────────────────────────────────────┘
        [3D grid scene — background]
```

---

## States & Variants

| State | Trigger | What Changes |
|-------|---------|--------------|
| Default | Normal load | Grid shown, player highlighted, Start Race button enabled |
| Player at P16 (skipped qualifying) | Skip qualifying | Player at last position, no qualifying time shown for player |
| Player qualified (normal) | After qualifying | Player's qualifying time shown, position determined by time |

**Notes:** Qualifying Results is a simple screen with minimal state variation. The only differences are whether the player qualified (shows time) or skipped (P16, no time). No error states — the grid is always populated from qualifying data or defaults.

---

## Interaction Map

| Component | Action | Input (Keyboard) | Input (Gamepad) | Feedback | Outcome |
|-----------|--------|-------------------|------------------|----------|---------|
| "Start Race" button | Confirm | Enter | South (A) | Button flash + click sound | Loading → Race |
| Navigate | Move focus | ↑ / ↓ | D-pad / Left stick | Focus outline on button | Highlight button |

**Notes:** Qualifying Results has only ONE interactive element — the "Start Race" button. There is no Back/Cancel, no navigation between grid rows, no scrolling. The player arrives, sees the grid, and presses Start Race.

---

## Events Fired

| Player Action | Event Fired | Payload |
|---|---|---|
| Start Race | `GridDisplayConfirmed` | `{ gridAssignment, trackId, laps }` |

**Notes:** Only one event. The grid assignment is consumed by Content Pipeline to begin loading the race. No analytics events — this is a system event, not a player tracking event.

---

## Transitions & Animations

| Transition | Animation | Duration | Notes |
|------------|-----------|----------|-------|
| Screen enter | Fade in from Qualifying Results | 500ms | Smooth transition from results |
| Grid rows appear | Stagger fade-in from P1 to P16 | 100ms per row | Builds anticipation, top to bottom |
| Player row highlight | Pulse glow on player's position | Loop 1s | Draws eye to player's starting spot |
| Screen exit → Loading | Fade to black | 300ms | Transitions to race loading |
| 3D background | Static top-down camera | No movement | Cars already placed on grid |

**Reduced Motion:** All transitions instant. No stagger animation. No pulse — player row uses static outline instead.

---

## Data Requirements

| Data | Source System | Read / Write | Notes |
|------|--------------|--------------|-------|
| Grid assignment (carId → gridSlot) | RSM (via TransitionRequest) | Read | Immutable after qualifying |
| Car names | Car Definition Data | Read | Display names for each car |
| Qualifying times | Qualifying system | Read | Per-car times, or DNQ |
| Track name | Track Definition Data | Read | For header display |
| Race laps | Race Session Manager | Read | For header display |
| Player car ID | Settings / Save | Read | To highlight player's row |

**Notes:** Qualifying Results is purely read-only. It displays data produced by qualifying and RSM. It does not write any game state — the `GridDisplayConfirmed` event triggers Content Pipeline loading, but the screen itself doesn't persist anything.

---

## Accessibility

**Tier: Standard**

| Requirement | Implementation |
|-------------|----------------|
| Keyboard-only navigation | Start Race button reachable via Enter |
| Gamepad navigation | Start Race button reachable via South (A) |
| Focus indicator | Visible 2px outline on Start Race button |
| Text contrast | Minimum 4.5:1 — white text on dark grid background |
| Color-independent | Player highlighted by ★ symbol + outline, not just color |
| Accessible labels | Grid rows and Start Race button carry semantic names ("Starting position P5 of 16") for future assistive tech expansion; no active screen reader support at Standard tier |
| Reduced Motion | No stagger animation, no pulse — static outline on player row |
| Text scaling | All text respects 75%–200% scaling. Grid reflows. |

---

## Localization Considerations

| Element | Max Length | Layout Impact | Priority |
|---------|-----------|---------------|----------|
| Car names | ~20 chars | Grid row width — 40% expansion safe | HIGH |
| "START RACE" button | ~15 chars | Button width — 40% expansion safe | HIGH |
| Track name | ~30 chars | Header — must fit on one line | HIGH |
| Qualifying times | ~10 chars (00:00.000) | Fixed format, no expansion | LOW |
| "DNQ" label | 3 chars | Fixed, no expansion | LOW |
| Lap count ("5 LAPS") | ~10 chars | Header — must fit on one line | MEDIUM |

**Notes:** Car names are the longest variable element. Team display names should be short enough for the grid layout. Qualifying times use invariant format (MM:SS.mmm). No currencies or dates. The 40% expansion rule applies to "START RACE" and track names.

---

## Acceptance Criteria

- [ ] Qualifying Results opens within 500ms from Finished Presentation or Skip
- [ ] All 16 grid positions shown with car names in correct order (P1 fastest, P16 slowest)
- [ ] Player's position highlighted with ★ symbol and outline
- [ ] Qualifying times shown beside each car name (or "DNQ" for skipped)
- [ ] 2-column staggered layout matches real grid formation
- [ ] "Start Race" button visible and reachable via Enter (keyboard) or South (gamepad)
- [ ] Confirm triggers Loading → Race transition
- [ ] No Back/Cancel path — player cannot return to previous screen
- [ ] 3D background shows 16 cars on grid (static top-down camera)
- [ ] Player at P16 when qualifying is skipped
- [ ] Reduced Motion: no stagger animation, no pulse, static outline on player row
- [ ] All text meets minimum 14px at 1080p

---

## Open Questions

- Grid display camera angle: static top-down confirmed for MVP. Dynamic camera (sweep over grid) deferred to Alpha.
- Player row highlight: currently ★ symbol + outline. Could also use team color accent if art-bible allows.
