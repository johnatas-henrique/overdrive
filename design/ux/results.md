# UX Spec: Results

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-29
> **Journey Phase(s)**: Post-Race (outcome review → decision)
> **Platform Target**: PC, Web
> **Template**: UX Spec

---

## Purpose & Player Need

Results is the moment of truth after the race. It shows the outcome — position, time, who won. It's where the player decides: "One more race" or "Adjust settings and try again."

**Player goal:** See how they performed. Understand the outcome. Decide what to do next.

**What goes wrong without it:** The player has no closure. They finished a race but don't know the result. No motivation to continue or improve.

**Emotional contract:** "I finished P3 — 2 seconds behind the winner. Next time I'll pit earlier." Satisfaction or determination, never confusion.

---

## Player Context on Arrival

**After finishing (normal):** The player just crossed the finish line. They're riding the adrenaline of the final push. They see the results — satisfaction if they won or podium'd, determination if they didn't.

**After forfeiting:** The player chose to return to menu mid-race. They see a forfeit summary — completed laps and elapsed time. No position. They know they abandoned the race.

**Emotional state:** Varies — euphoria (win), satisfaction (podium), frustration (poor finish), acceptance (forfeit). The design must accommodate all without biasing toward any.

---

## Navigation Position

Race Results is a terminal screen — one-way, no back path. It sits at:

```
Race → Finished Presentation → Race Results → Title
```

Or, for forfeit:

```
Race (Paused) → Forfeit → Race Results → Title
```

There is no alternate entry path. The player always arrives from either Finished Presentation (normal finish) or Pause Menu Return to Menu (forfeit). The only exit is "Continue" or "Back" → Title.

---

## Entry & Exit Points

**Entry Points:**

| Entry Source | Trigger | Player carries this context |
|---|---|---|
| Finished Presentation | Confirm after 5s timer or player dismisses | Position, time, lap times, classification |
| Pause Menu → Return to Menu | Forfeit confirmation | forfeitLapCount, raceTimeAtForfeit, no final position |

**Exit Points:**

| Exit Destination | Trigger | Notes |
|---|---|---|
| Loading → Race (same config) | "Next Race" | Re-race the same track/car — RSM returns a Loading TransitionRequest without an intermediate Idle state (ui-menu GDD, RSM:148) |
| Title (UI Menu) | "Continue" or "Back" | Content unloads race assets, Simulation → Idle. Irreversible. |

**Notes:** The GDD says: "Next Race enters Loading and Continue/Back returns to Idle/Title." Both actions coexist on the Results screen: Next Race is the quick rematch path, Continue/Back returns to the menu.

---

## Layout Specification

### Information Hierarchy

| Priority | Information | Location |
|----------|------------|----------|
| 1 | Player's position (highlighted) | Prominent in results list |
| 2 | Race standings (all 16 positions with times) | Main content area |
| 3 | Track name and race info | Header |
| 4 | "Continue" button | Bottom |

### Layout Zones

- **Zone 1 — Header (top):** Track name + "RACE RESULTS"
- **Zone 2 — Results List (center):** All 16 positions, player highlighted with ★. Top 3 have gold/silver/bronze accent.
- **Zone 3 — Bottom:** "Continue" button

### Component Inventory

| Component | Zone | Type | Interactive | Notes |
|-----------|------|------|-------------|-------|
| Track name + "RACE RESULTS" | 1 | Label | No | Header info |
| Results rows (16) | 2 | List items | No | Position, car name, race time |
| Player row | 2 | List item | No | Highlighted with ★ + outline |
| Top 3 highlight | 2 | List items | No | Gold/silver/bronze accent for P1-P3 |
| "Next Race" button | 3 | Button | Yes | Confirm pattern (Enter/South) — re-race same config |
| "Continue" button | 3 | Button | Yes | Confirm pattern (Enter/South) — return to Title |

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────┐
│              [TRACK NAME — RACE RESULTS]            │
│                                                     │
│  P1  Car Name        01:23.456                      │
│  P2  Car Name        01:24.123                      │
│  P3  Car Name        01:25.789                      │
│  P4  Car Name        01:26.012                      │
│  P5  Car Name ★      01:27.345                      │
│  P6  Car Name        01:28.678                      │
│  ...                                                │
│  P16 Car Name        01:45.012                      │
│                                                     │
│       [NEXT RACE]     [CONTINUE]                    │
│              Enter: Continue                        │
└─────────────────────────────────────────────────────┘
```

---

## States & Variants

| State | Trigger | What Changes |
|-------|---------|--------------|
| Normal finish | Player crosses finish line on final lap | Full results: position, car name, race time. Top 3 highlighted. |
| DNF | Player retires (fuel empty, stopped) | "DNF" instead of position/time. No top 3 highlight. |
| Forfeit | Player returns to menu mid-race | "FORFEIT" header, completed laps, elapsed race time. No position. |

**Notes:** Race Results is always a vertical list. Qualifying Results is a separate screen with grid formation layout. The two screens serve different purposes: Qualifying Results shows "where you start," Race Results shows "how you finished."

---

## Interaction Map

| Component | Action | Input (Keyboard) | Input (Gamepad) | Feedback | Outcome |
|-----------|--------|-------------------|------------------|----------|---------|
| "Continue" button | Confirm | Enter | South (A) | Button flash + click sound | Title (UI Menu) |
| "Next Race" button | Confirm | Enter | South (A) | Button flash + click sound | Loading → Race (same track/car) |
| Navigate | Move focus | ↑ / ↓ | D-pad / Left stick | Focus outline on button | Highlight button |

**Notes:** Race Results has TWO interactive elements — "Next Race" (quick rematch, same track/car) and "Continue" (return to Title). There is no Back/Cancel, no scrolling, no other actions. The player arrives, sees the result, and picks Next Race to go again or Continue to return to the menu.

---

## Events Fired

| Player Action | Event Fired | Payload |
|---|---|---|
| Continue | `ResultsContinue` | `{ trackId, carId, resultClassification }` |
| Next Race | `ResultsNextRace` | `{ trackId, carId }` | RSM consumes as a Loading TransitionRequest (same config) |

**Notes:** The event triggers Content Pipeline to unload race assets and Simulation to transition to Idle. No analytics events — this is a system event.

---

## Transitions & Animations

| Transition | Animation | Duration | Notes |
|------------|-----------|----------|-------|
| Screen enter | Fade in from Finished Presentation | 500ms | Smooth transition |
| Results rows appear | Stagger fade-in from P1 to P16 | 100ms per row | Builds anticipation |
| Player row highlight | Pulse glow on player's position | Loop 1s | Draws eye to result |
| Top 3 accent | Gold/silver/bronze shimmer | Subtle | Celebratory for podium |
| Screen exit → Title | Fade to black | 300ms | Transitions to menu |

**Reduced Motion:** All transitions instant. No stagger animation. No pulse — player row uses static outline instead. No shimmer.

---

## Data Requirements

| Data | Source System | Read / Write | Notes |
|------|--------------|--------------|-------|
| Player position | RSM (FinishOrderResolver) | Read | Final race position |
| Car names (all 16) | Car Definition Data | Read | Display names |
| Race times (all 16) | RSM | Read | Total race time per car |
| Classification | RSM | Read | Finished / DNF / Forfeit |
| Forfeit lap count | RSM | Read | Forfeit only |
| Forfeit elapsed time | RSM | Read | Forfeit only |
| Track name | Track Definition Data | Read | For header display |
| Race laps | RSM | Read | For header display |
| Player car ID | Settings / Save | Read | To highlight player's row |

**Notes:** Race Results is purely read-only. It displays data produced by RSM and FinishOrderResolver. It does not write any game state — the `ResultsContinue` event triggers content unload, but the screen itself doesn't persist anything.

---

## Accessibility

**Tier: Standard**

| Requirement | Implementation |
|-------------|----------------|
| Keyboard-only navigation | Continue button reachable via Enter |
| Gamepad navigation | Continue button reachable via South (A) |
| Focus indicator | Visible 2px outline on Continue button |
| Text contrast | Minimum 4.5:1 — white text on dark background |
| Color-independent | Player highlighted by ★ symbol + outline, not just color. Top 3 use medal icons alongside colors. |
| Accessible labels | Results rows carry semantic names ("You finished P5 of 16") for future assistive tech expansion; no active screen reader support at Standard tier |
| Reduced Motion | No stagger animation, no pulse — static outline on player row |
| Text scaling | All text respects 75%–200% scaling. List reflows. |

---

## Localization Considerations

| Element | Max Length | Layout Impact | Priority |
|---------|-----------|---------------|----------|
| Car names | ~20 chars | List row width — 40% expansion safe | HIGH |
| "CONTINUE" / "NEXT RACE" buttons | ~15 chars | Button width — 40% expansion safe | HIGH |
| Track name | ~30 chars | Header — must fit on one line | HIGH |
| Race times | ~10 chars (00:00.000) | Fixed format, no expansion | LOW |
| "DNF" label | 3 chars | Fixed, no expansion | LOW |
| "FORFEIT" label | ~10 chars | Fixed, no expansion | LOW |
| Position labels ("P1", "P16") | ~4 chars | Fixed, no expansion | LOW |

**Notes:** Car names are the longest variable element. Race times use invariant format (MM:SS.mmm). No currencies or dates. The 40% expansion rule applies to "CONTINUE" and track names.

---

## Acceptance Criteria

- [ ] Race Results opens within 500ms from Finished Presentation or Forfeit
- [ ] All 16 positions shown with car names and race times (or DNF/Forfeit)
- [ ] Player's position highlighted with ★ symbol and outline
- [ ] Top 3 positions highlighted with gold/silver/bronze accent
- [ ] "Continue" button visible and reachable via Enter (keyboard) or South (gamepad)
- [ ] "Next Race" button visible and reachable via Enter (keyboard) or South (gamepad)
- [ ] Confirm on Continue triggers unload → Title transition
- [ ] Confirm on Next Race triggers Loading → Race with same track/car (no Idle intermediate)
- [ ] No Back/Cancel path — player cannot return to race
- [ ] Forfeit state shows "FORFEIT", completed laps, and elapsed time (no position)
- [ ] DNF state shows "DNF" instead of position/time
- [ ] Reduced Motion: no stagger animation, no pulse, static outline on player row
- [ ] All text meets minimum 14px at 1080p

---

## Open Questions

- Next Race: currently "Continue" returns to Title. Future: "Next Race" button for quick replay (Alpha+).
- Podium celebration: currently top 3 get visual accent only. Future: 3D podium scene (Alpha+).
