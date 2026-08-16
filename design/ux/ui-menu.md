# UX Spec: UI Menu

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-29
> **Journey Phase(s)**: Pre-Race (menu navigation), Post-Race (results review)
> **Platform Target**: PC, Web
> **Template**: UX Spec

---

## Purpose & Player Need

UI Menu is the non-race layer of Overdrive — the garage between sessions. It manages all screens the player visits outside of active racing: title screen, track selection, car selection, settings, qualifying results, and race results.

**Player goal:** Start a race, configure the game, or review results — while feeling immersed in a warm, tactile garage environment.

**What goes wrong without it:** The player has no way to begin, configure, or conclude a race.

**Emotional contract:** The player arrives wanting to feel like a driver in their team's garage — choosing where to prove themselves, seeing their car, checking their results. Not clicking through a database.

---

## Player Context on Arrival

**First encounter:** The player launches the game. They see the Title screen — game logo, "Single Race", "Settings". No prior context. Emotional state: curious, ready to play.

**Return from race:** The player just finished a race (Results screen). They return to the menu. Emotional state: satisfied or frustrated depending on result. They want to race again or adjust settings.

**Return from settings:** The player just tweaked controls or audio. They return to the previous menu. Emotional state: focused, wanting to test changes.

---

## Navigation Position

UI Menu is the root layer of the game's navigation hierarchy. All non-race screens live here.

```
[Root] Title
  ├── Track Selection
  │     └── Car Selection
  │           ├── Qualifying Not Started
  │           │     └── Loading → Qualifying → Qualifying Results → Loading → Race (HUD/RSM)
  │           └── Skip → Qualifying Results → Loading → Race (HUD/RSM)
  ├── Settings (from Title, Car Selection, Pause Menu)
  └── Results ← Race (via Finished Presentation)
        └── Return to Title
```

**Race** lives outside UI Menu — it's the gameplay layer (HUD + RSM). **Results** is the re-entry point back into UI Menu after racing. **Settings** is the only screen reachable from multiple parents (Title, Car Selection, Pause Menu).

---

## Entry & Exit Points

**Entry Points:**

| Entry Source | Trigger | Player carries this context |
|---|---|---|
| App launch | Game starts | None — fresh session |
| Results screen | "Return to Title" button | Race results (position, time, laps) |
| Pause Menu | "Return to Menu" (forfeit) | Forfeit state — race abandoned |
| Settings | Back/Cancel from Settings | None — settings changes persist |

**Exit Points:**

| Exit Destination | Trigger | Notes |
|---|---|---|
| Track Selection | "Single Race" on Title | — |
| Settings | "Settings" button | Accessible from Title, Car Selection, Pause Menu |
| Loading → Qualifying/Race | "Start" or "Skip" on Car Selection | Irreversible — loading blocks Back/Cancel |
| Title | "Return to Title" on Results | — |

---

## Layout Specification

### Information Hierarchy

| Priority | Information | Location |
|----------|------------|----------|
| 1 | Primary action: "Single Race" | Center, prominent |
| 2 | Settings | Below primary action |
| 3 | Game identity: Logo | Top, centered |
| 4 | Content error (when present) | Bottom banner |

### Layout Zones

- **Zone 1 — Identity (top):** Game logo, centered
- **Zone 2 — Hero (center):** 3D car on turntable or garage scene — the visual anchor
- **Zone 3 — Actions (bottom-center):** Vertical list of mode buttons, data-driven. MVP: Single Race + Settings. Future: Championship (Alpha+), Career (Beta+). Locked modes appear greyed out.
- **Zone 4 — Error banner (bottom):** Only appears when content load fails

### Component Inventory

| Component | Zone | Type | Interactive | Notes |
|-----------|------|------|-------------|-------|
| Game Logo | 1 | Image | No | Static branding |
| 3D Car / Garage Scene | 2 | 3D render | No | Animated turntable, warm lighting |
| "Single Race" button | 3 | Button | Yes | Primary CTA, leads to Track Selection |
| "Settings" button | 3 | Button | Yes | Leads to Settings screen |
| Future mode buttons | 3 | Button | Yes/No | Added data-driven per phase; disabled if locked |
| Error banner | 4 | Banner | No | Appears on ContentLoadError |

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────┐
│                    [LOGO]                           │
│                                                     │
│              3D car / garage background             │
│                                                     │
│         ┌──────────────────────────┐               │
│         │      SINGLE RACE         │               │
│         ├──────────────────────────┤               │
│         │       SETTINGS           │               │
│         ├──────────────────────────┤               │
│         │     [CHAMPIONSHIP]       │  ← Alpha+     │
│         ├──────────────────────────┤               │
│         │       [CAREER]           │  ← Beta+      │
│         └──────────────────────────┘               │
│              [Content Error if present]             │
└─────────────────────────────────────────────────────┘
```

---

## States & Variants

| State | Trigger | What Changes |
|-------|---------|--------------|
| Default | Normal load | Logo + 3D car + action buttons |
| Content Error | ContentLoadError | Error banner appears at bottom, action buttons remain functional |
| First Launch | No save data | Default settings applied, normal display |
| Loading (future) | Content loading before Title | Spinner overlay, buttons disabled |

**Notes:** Title screen is always accessible — no loading state on the screen itself. Content error is the only exceptional state in MVP. Future states: "Update Available", "First Time Tutorial Overlay".

---

## Interaction Map

| Component | Action | Input (Keyboard) | Input (Gamepad) | Feedback | Outcome |
|-----------|--------|-------------------|------------------|----------|---------|
| Single Race | Click/Press | Enter or Click | South (A) | Button highlight + click sound | Navigate → Track Selection |
| Settings | Click/Press | Enter or Click | South (A) | Button highlight + click sound | Navigate → Settings |
| [Locked mode] | Click/Press | Enter or Click | South (A) | Denied sound, no navigation | Nothing — mode locked |
| Navigate | Move focus | Arrow keys / WASD | D-pad / Left stick | Focus moves between buttons | Highlight next button |
| Back/Cancel | Press | Escape | East (B) | — | No-op on Title (root screen) |

**Notes:** Title is the root screen — Back/Cancel does nothing. Pointer and gamepad coexist: mouse 2px movement activates pointer mode, gamepad input switches back. Focus starts on "Single Race".

---

## Events Fired

| Player Action | Event Fired | Payload |
|---|---|---|
| Single Race | `MenuModeSelected` | `{ mode: "single_race" }` |
| Settings | `MenuSettingsOpened` | `{ source: "title" }` |
| [Locked mode] | none | — |
| Navigate | none | — |
| Back/Cancel | none | — |

**Notes:** No persistent game state is modified on the Title screen. Events are analytics/navigation only. Settings changes are persisted from the Settings screen, not from Title.

---

## Transitions & Animations

| Transition | Animation | Duration | Notes |
|------------|-----------|----------|-------|
| Screen enter | Fade in from black | 500ms | On app launch or return from Results |
| Screen exit → Track Selection | Slide left | 300ms | Push navigation |
| Screen exit → Settings | Slide left | 300ms | Push navigation |
| Button focus change | Scale 1.0 → 1.05 + glow | 150ms | Subtle emphasis |
| Button press | Scale 1.05 → 0.95 → 1.0 | 200ms | Press feedback |
| Content error appear | Fade in banner | 200ms | Non-blocking, bottom of screen |
| 3D car turntable | Continuous slow rotation | Loop | ~10s per revolution, pauses on button hover |

**Reduced Motion:** All transitions instant (0ms). Turntable rotation stops. Button feedback uses outline only (no scale).

---

## Data Requirements

| Data | Source System | Read / Write | Notes |
|------|--------------|--------------|-------|
| Available game modes | Content Pipeline | Read | Data-driven list of modes + lock state |
| Content error message | Content Pipeline | Read | Shown when ContentLoadError occurs |
| 3D car model | Content Pipeline | Read | For turntable display |
| Settings values | Settings (PlayerPrefs) | Read | Applied at startup, not modified here |

**Notes:** Title screen is read-only — it doesn't write any game state. Mode selection triggers navigation, not data changes. The only write is navigation state (which screen to go to next).

---

## Accessibility

**Tier: Standard**

| Requirement | Implementation |
|-------------|----------------|
| Keyboard-only navigation | All buttons reachable via Arrow/WASD + Enter |
| Gamepad navigation | All buttons reachable via D-pad/Left stick + South |
| Focus indicator | Visible outline on focused button (2px, high contrast) |
| Text contrast | Minimum 4.5:1 ratio for all text against background |
| Color-independent | No information conveyed by color alone — locked modes use text "LOCKED" + disabled visual, not just greyed color |
| Accessible labels | All buttons carry semantic labels ("Single Race", "Settings") for future assistive tech expansion; no active screen reader support at Standard tier |
| Reduced Motion | Transitions instant, turntable stops, button feedback uses outline only |
| Text scaling | Buttons scale with text scaling setting (75%–200%) |

---

## Localization Considerations

| Element | Max Length | Layout Impact | Priority |
|---------|-----------|---------------|----------|
| "SINGLE RACE" | ~15 chars | Button width — 40% expansion safe | HIGH |
| "SETTINGS" | ~12 chars | Button width — 40% expansion safe | HIGH |
| "LOCKED" | ~10 chars | Badge text — minimal impact | MEDIUM |
| Error message | ~80 chars | Banner width — must wrap cleanly | HIGH |
| Future: "CHAMPIONSHIP" | ~15 chars | Button width — same grid | MEDIUM |

**Notes:** Button labels are short and fit a fixed-width grid. The 40% expansion rule (English → German/French) is safe for all current labels. Error messages must support text wrapping without breaking layout. No currencies or dates on this screen.

---

## Acceptance Criteria

- [ ] Title screen opens within 500ms of app launch
- [ ] "Single Race" button navigates to Track Selection on click/Enter/South
- [ ] "Settings" button navigates to Settings on click/Enter/South
- [ ] Arrow/WASD/D-pad moves focus between buttons in vertical order
- [ ] Focus indicator (2px outline) visible on focused button
- [ ] Escape/Back/East does nothing on Title (root screen)
- [ ] Content error banner appears on ContentLoadError and disappears on retry
- [ ] 3D car turntable rotates slowly, pauses on button hover
- [ ] All buttons reachable via keyboard-only and gamepad-only navigation
- [ ] Reduced Motion mode: no transitions, no rotation, outline-only feedback
- [ ] Text scaling (75%–200%) does not break button layout
- [ ] Locked modes appear greyed with "LOCKED" text, not just disabled color

---

## Open Questions

- 3D car model on Title: should it show the last selected car or a default hero car?
- Future modes (Championship, Career): confirmation needed on lock/unlock criteria per phase
