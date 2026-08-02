# UX Spec: Finished Presentation

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-31
> **Journey Phase(s)**: First Mastery (30 min - 2 hours)
> **Platform Target**: PC, Web
> **Template**: UX Spec

---

## Purpose & Player Need

Finished Presentation is the emotional payoff — the moment the player sees their car cross the finish line from a cinematic camera angle. It's the game saying "you did it" before showing the numbers.

**Player goal:** Experience the finish moment visually. See their car, their livery, their position — without HUD clutter, without data, just the car and the track.

**What goes wrong without it:** The race ends abruptly, jumping straight to a data screen. No emotional closure, no sense of accomplishment.

**Emotional contract:** "I finished." The camera takes over, the HUD disappears, and for a few seconds the player is a spectator of their own achievement.

---

## Player Context on Arrival

**Just crossed the finish line:** The player was driving at full intensity. The race is over. The camera switches from their driving view to a cinematic angle showing their car.

**Emotional state:** Peak emotion — relief, excitement, or frustration depending on result. The design should be neutral — celebrate the finish, not the position. The Results screen will show the numbers.

---

## Navigation Position

Finished Presentation is a transition state between race and results. It sits at:

```
Race → [FINISHED PRESENTATION] → Results → Title
```

It's not a destination — it's a cinematic bridge. The player passes through it on the way to Results.

---

## Entry & Exit Points

**Entry Points:**

| Entry Source | Trigger | Player carries this context |
|---|---|---|
| Race (Racing) | FinishDetected + PostFinishSnapshot | Position, time, classification |
| Race (Qualifying) | FinishDetected + PostFinishSnapshot | Qualifying time, grid position |

**Exit Points:**

| Exit Destination | Trigger | Notes |
|---|---|---|
| Results | Confirm (Enter/South) after 5s or player dismisses | Position, time, lap times |
| Results | Timer expires (5s auto-dismiss) | Same as Confirm |

**Notes:** Cancel is SUPPRESSED — the player cannot go back to the race. The result is locked. Only Confirm or timer expiry leads to Results.

---

## Layout Specification

### Information Hierarchy

| Priority | Information | Location |
|----------|------------|----------|
| 1 | Cinematic camera view of car | Full screen |
| 2 | "Enter to continue" hint | Bottom-center, fades in after 2s |

### Layout Zones

- **Zone 1 — Cinematic (full screen):** Camera orbits the player's car crossing the finish line. No HUD, no data, no text. Pure visual reward.
- **Zone 2 — Hint (bottom-center):** "Press Enter to continue" fades in after 2 seconds. Subtle, non-intrusive.

### Component Inventory

| Component | Zone | Type | Interactive | Notes |
|-----------|------|------|-------------|-------|
| Cinematic camera | 1 | Camera | No | Auto-orbits car, player has no control |
| "Enter to continue" hint | 2 | Label | No | Fade in after 2s, bottom-center |

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                                                     │
│                                                     │
│              [CINEMATIC CAMERA VIEW]                │
│              [Player car crossing finish]            │
│              [No HUD, no data, no text]              │
│                                                     │
│                                                     │
│                                                     │
│                                                     │
│              Press Enter to continue                 │
│              (fades in after 2s)                     │
└─────────────────────────────────────────────────────┘
```

**Timing:**
- 0–2s: Pure cinematic — no UI, no text, just car and camera
- 2–3s: "Press Enter to continue" fades in (subtle)
- 3–5s: Timer continues, player can dismiss
- 5s: Auto-dismiss to Results

---

## States & Variants

| State | Trigger | What Changes |
|-------|---------|--------------|
| Normal finish | FinishDetected (Race or Qualifying) | Cinematic camera, hint after 2s, auto-dismiss at 5s |
| DNF (Did Not Finish) | Player crashed/stopped | Same cinematic, but camera may show car off-track |
| Forfeit | Return to Menu from Pause | **Skips Finished Presentation entirely** — goes straight to Results |

**Notes:** Forfeit bypasses this screen because the player already chose to leave. DNF still shows the cinematic — the player finished (even if they didn't cross the line in position).

---

## Interaction Map

| Component | Action | Input (Keyboard) | Input (Gamepad) | Feedback | Outcome |
|-----------|--------|-------------------|------------------|----------|---------|
| Cinematic | Skip | Enter | South (A) | Instant | Results screen |
| Hint | — | — | — | — | No interactive elements |

**Notes:** Only 1 interaction: Skip. Cancel is SUPPRESSED. Pause is NOT available to the player — the cinematic is 5 seconds, no need to pause. Note: on window focus loss, the terminal presentation timer pauses per ADR-0001 (UI Presentation owns the timer and pauses it on focus loss); on focus return the timer resumes — this is system behavior, not a player pause action. The hint is purely visual — not a button.

---

## Events Fired

| Player Action | Event Fired | Payload |
|---|---|---|
| Skip (Enter/South) | `TerminalPresentationDismissed` | `{ finishTime, resultKind }` |
| Timer expires (5s) | `TerminalPresentationDismissed` | `{ finishTime, resultKind }` |

**Notes:** `TerminalPresentationDismissed` signals UI Presentation to transition to Results. The payload carries the finish time and result kind (Qualifying/Race) for the Results screen. No pause event — pause is not available on this screen.

---

## Transitions & Animations

| Transition | Animation | Duration | Notes |
|------------|-----------|----------|-------|
| Screen enter | Camera cut from race view | 0ms | Instant switch to cinematic |
| Hint fade in | Opacity 0 → 1 | 500ms | After 2s delay |
| Screen exit → Results | Fade to black | 300ms | Smooth transition to data screen |

**Reduced Motion:** All transitions instant. No fade, no camera cut — instant swap.

---

## Data Requirements

| Data | Source System | Read / Write | Notes |
|------|--------------|--------------|-------|
| Finish time | Race Session Manager | Read | For Results screen |
| Result kind | Race Session Manager | Read | Qualifying or Race |
| Player classification | Race Session Manager | Read | Finished, DNF, etc. |
| Terminal presentation timer | UI Presentation | Read | 5s countdown |

**Notes:** Finished Presentation is read-only — it displays the cinematic and signals when dismissed. No game state is modified on this screen.

---

## Accessibility

**Tier: Standard**

| Requirement | Implementation |
|-------------|----------------|
| Keyboard-only navigation | Enter/South to skip |
| Gamepad navigation | South (A) to skip |
| Accessible labels | Hint text carries semantic name ("Race finished — press Enter to continue") for future assistive tech expansion; no active screen reader support at Standard tier |
| Text contrast | Minimum 4.5:1 — white text on cinematic background |
| Reduced Motion | No fade, no camera cut — instant swap |
| Text scaling | Hint text respects 75%–200% scaling |

**Notes:** Finished Presentation has minimal UI — the accessibility focus is on the hint text and skip functionality.

---

## Localization Considerations

| Element | Max Length | Layout Impact | Priority |
|---------|-----------|---------------|----------|
| "Press Enter to continue" | ~30 chars | Bottom-center — must fit on one line | HIGH |

**Notes:** Only one text element. The 40% expansion rule applies. Must stay on one line — no wrapping.

---

## Acceptance Criteria

- [ ] Finished Presentation opens instantly after FinishDetected
- [ ] Camera switches to cinematic angle showing player car
- [ ] No HUD, no data, no text during first 2 seconds
- [ ] "Press Enter to continue" fades in after 2 seconds
- [ ] Enter/South skips to Results screen
- [ ] Timer auto-dismisses to Results after 5 seconds
- [ ] Cancel is suppressed — Escape/Start does nothing
- [ ] Accessible label on hint announces "Race finished — press Enter to continue" (semantic naming for future assistive tech)
- [ ] Reduced Motion: no fade, no camera cut — instant swap
- [ ] All text meets minimum 14px at 1080p

---

## Open Questions

- Camera orbit angle: fixed preset, or dynamic based on finish position (e.g., winner gets a more dramatic angle)?
- Sound design: should the engine sound fade out during the cinematic? Or continue?
- Hint prompt glyphs adapt to active input scheme (keyboard "Enter" vs gamepad South glyph) per accessibility A3 — implementation detail, not an open design question.
