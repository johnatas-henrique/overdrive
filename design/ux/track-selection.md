# UX Spec: Track Selection

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-31
> **Journey Phase(s)**: Orientation (5-30 minutes)
> **Platform Target**: PC, Web
> **Template**: UX Spec

---

## Purpose & Player Need

Track Selection is where the player chooses the arena for the next race. It shows all available tracks with their layout, name, distance, and elevation — letting the player pick based on preference, challenge, or variety.

**Player goal:** Choose a track that matches their mood — the familiar one they want to master, or the new one they haven't tried yet.

**What goes wrong without it:** The player has no control over where they race. The game feels repetitive, not player-driven.

**Emotional contract:** "Monaco again — I want to beat my time." or "Spa — I haven't tried Eau Rouge yet." Choice creates investment.

---

## Player Context on Arrival

**First encounter:** The player just pressed "Single Race" on the Title screen. They're in the Orientation phase — curious, wanting to try different tracks. They see 4 tracks and pick one.

**Return from race:** The player just finished a race (Results screen → Title → Single Race). They want to try a different track or replay the same one to improve.

**Emotional state:** Curious, exploratory. "Which track should I try next?" The design should make each track feel distinct and inviting.

---

## Navigation Position

Track Selection is a linear step in the pre-race flow. It sits at:

```
Title → Track Selection → Car Selection → Qualifying Not Started → Qualifying → Qualifying Results → Loading → Race
```

It's the second screen in the chain — the player chooses the arena before choosing the car. Back/Cancel returns to Title.

---

## Entry & Exit Points

**Entry Points:**

| Entry Source | Trigger | Player carries this context |
|---|---|---|
| Title screen | "Single Race" button | None — fresh selection |

**Exit Points:**

| Exit Destination | Trigger | Notes |
|---|---|---|
| Car Selection | Confirm on selected track | Track choice locked, proceeds to car selection |
| Title | Back/Cancel | Returns to Title screen |

**Notes:** Track Selection is a simple one-step screen — pick a track, move forward. No complex state to carry.

---

## Layout Specification

### Information Hierarchy

| Priority | Information | Location |
|----------|------------|----------|
| 1 | Track map preview (top-down) | Right panel — visual anchor |
| 2 | Track name | Left list (selected) + Right panel header |
| 3 | Distance, elevation, laps | Right panel stats |
| 4 | Track description | Right panel (brief, below stats) |

### Layout Zones

- **Zone 1 — Header (top):** "SELECT A TRACK"
- **Zone 2 — Track List (left):** Vertical scrollable list of track names. Selected track highlighted with accent color.
- **Zone 3 — Track Detail (right):** Map preview (top-down), distance, elevation, laps, brief description. Updates on selection.
- **Zone 4 — Bottom:** "NEXT →" button + hint text

**Data-driven:** All track data comes from the track file (name, distance, elevation, laps, description). No hardcoded track names. Layout works for any number of tracks via scroll.

### Component Inventory

| Component | Zone | Type | Interactive | Notes |
|-----------|------|------|-------------|-------|
| "SELECT A TRACK" label | 1 | Label | No | Header |
| Track list (scrollable) | 2 | List | Yes | Navigate up/down, selected track highlighted |
| Track map preview | 3 | Image | No | Top-down layout shape, generated from spline data |
| Track stats (distance, elevation, laps) | 3 | Labels | No | Read-only, from track file |
| Track description | 3 | Label | No | Brief text, from track file |
| "NEXT →" button | 4 | Button | Yes | Confirm pattern (Enter/South) |

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────┐
│              [SELECT A TRACK]                       │
│                                                     │
│  ┌──────────────┬──────────────────────────────┐   │
│  │              │                              │   │
│  │  > MONACO    │      ┌────────────────┐      │   │
│  │              │      │                │      │   │
│  │  SILVERSTONE │      │   MONACO MAP   │      │   │
│  │              │      │   (top-down)   │      │   │
│  │  SPA         │      │                │      │   │
│  │              │      └────────────────┘      │   │
│  │  MONZA       │                              │   │
│  │              │  Distance: 4309 m           │   │
│  │              │  Elevation: 42m              │   │
│  │              │  Laps: 5                     │   │
│  │              │                              │   │
│  │              │  ──────────────────────      │   │
│  │              │  Casino, Harbour, Fairmont   │   │
│  │              │                              │   │
│  └──────────────┴──────────────────────────────┘   │
│                                                     │
│              [NEXT →]                               │
│              Enter: Select    Esc: Back             │
└─────────────────────────────────────────────────────┘
```

---

## States & Variants

| State | Trigger | What Changes |
|-------|---------|--------------|
| Default | Normal load | All tracks shown, first track selected by default |
| Track locked (Alpha+) | Player hasn't earned access | Track greyed out, "LOCKED" overlay, cannot be selected |
| Content error | Track data fails to load | Error message, track removed from list |

**Notes:** MVP has all 4 tracks unlocked. Locked tracks are Alpha+ when progression is added. Content error is rare — track data is local. Future additions (flags, difficulty indicators, best times) are visual extras — the skeleton accommodates them.

---

## Interaction Map

| Component | Action | Input (Keyboard) | Input (Gamepad) | Feedback | Outcome |
|-----------|--------|-------------------|------------------|----------|---------|
| Track list | Navigate | ↑ / ↓ | D-pad ↑↓ / Left stick | Track highlight moves | Detail panel updates |
| Track list | Select | Enter | South (A) | Track confirmed, highlight stays | Proceeds to Car Selection |
| "NEXT →" button | Confirm | Enter | South (A) | Button flash + click sound | Car Selection |
| Back/Cancel | Return | Escape | East (B) | Returns to Title | Title screen |

**Notes:** The track list and "NEXT →" button both respond to Confirm/Enter. The player can either press Enter on a track in the list OR navigate to the button. Both achieve the same result: proceed to Car Selection with the selected track.

---

## Events Fired

| Player Action | Event Fired | Payload |
|---|---|---|
| Select track (Enter/South on list or button) | `TrackSelected` | `{ trackId }` |

**Notes:** The event carries only the track ID. All track data (name, distance, elevation, laps, description) is derived from the track file at runtime. No analytics events — this is a navigation event.

---

## Transitions & Animations

| Transition | Animation | Duration | Notes |
|------------|-----------|----------|-------|
| Screen enter | Slide from right | 300ms | Push navigation from Title |
| Screen exit → Car Selection | Slide left | 300ms | Push navigation to Car Selection |
| Screen exit → Title | Slide right | 300ms | Pop navigation back |
| Track selection highlight | Accent color fill | 150ms | Smooth transition between tracks |
| Detail panel update | Crossfade | 200ms | Map + stats fade in/out on track change |

**Reduced Motion:** All transitions instant. No slide, no crossfade — instant swap.

---

## Data Requirements

| Data | Source System | Read / Write | Notes |
|------|--------------|--------------|-------|
| Track list | Content Pipeline | Read | Data-driven, from track files |
| Track name | Track Definition Data | Read | Display name (fictionalized) |
| Track map preview | Track Definition Data | Read | Static PNG generated offline from spline data |
| Track distance | Track Definition Data | Read | In meters |
| Track elevation | Track Definition Data | Read | In meters |
| Track laps | Track Definition Data | Read | Default lap count |
| Track description | Track Definition Data | Read | Brief text, from track file |
| Selected track ID | Settings / Save | Write | Stored for Car Selection |

**Notes:** Track Selection is read-only except for storing the selected track ID. Map preview is a static PNG asset generated once during the track asset pipeline (offline from spline data), not rendered at runtime. If the generated image is unsatisfactory, it can be manually recreated in ComfyUI or Photoshop.

---

## Accessibility

**Tier: Standard**

| Requirement | Implementation |
|-------------|----------------|
| Keyboard-only navigation | Track list reachable via ↑/↓, Confirm via Enter. Back via Escape. |
| Gamepad navigation | Track list reachable via D-pad/Left stick, Confirm via South. Back via East. |
| Focus indicator | Visible 2px outline on selected track in list |
| Text contrast | Minimum 4.5:1 — white text on dark background |
| Color-independent | Selected track highlighted by outline + ">" marker, not just color |
| Accessible labels | Track list items carry semantic names ("Monaco — 4309 meters, 42m elevation") for future assistive tech expansion; no active screen reader support at Standard tier |
| Reduced Motion | No slide transitions, no crossfade — instant swap |
| Text scaling | All text respects 75%–200% scaling. List and detail panel reflow. |

---

## Localization Considerations

| Element | Max Length | Layout Impact | Priority |
|---------|-----------|---------------|----------|
| Track names | ~20 chars | List item width — 40% expansion safe | HIGH |
| "NEXT →" button | ~15 chars | Button width — 40% expansion safe | HIGH |
| Track description | ~60 chars | Detail panel — must wrap cleanly | HIGH |
| Track stats (distance, elevation, laps) | ~15 chars | Fixed format (meters), no expansion | LOW |
| "SELECT A TRACK" header | ~25 chars | Header — must fit on one line | MEDIUM |

**Notes:** Track names are the longest variable element. Descriptions must support text wrapping. Distance in meters (no decimals). Elevation in meters. The 40% expansion rule applies to track names and button labels.

---

## Acceptance Criteria

- [ ] Track Selection opens within 300ms from Title
- [ ] All tracks shown in scrollable list with names
- [ ] Selected track shows map preview, distance (meters), elevation, laps, description
- [ ] ↑/↓ (keyboard) or D-pad/Left stick (gamepad) moves selection in track list
- [ ] Enter/South confirms selection and navigates to Car Selection
- [ ] Escape/East returns to Title
- [ ] Detail panel updates instantly on track change
- [ ] Focus indicator visible on selected track
- [ ] Accessible labels on track list items announce track name, distance, and elevation (semantic naming for future assistive tech)
- [ ] Reduced Motion: no slide transitions, no crossfade — instant swap
- [ ] All text meets minimum 14px at 1080p

---

## Open Questions

- Map preview: static PNG generated offline from spline data. Manual fallback (ComfyUI/Photoshop) if generated image is unsatisfactory.
- Track flags: may be added as visual extras next to track names. Skeleton accommodates them.
- Locked tracks: Alpha+ when progression is added. MVP has all tracks unlocked.
