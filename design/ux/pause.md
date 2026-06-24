# UX Spec: Pause Overlay

> **Status**: In Design
> **Author**: ux-designer
> **Last Updated**: 2026-06-22
> **Journey Phase(s)**: Racing (any point) → Paused → Racing
> **Platform Target**: PC (web — Electron/Tauri)
> **Template**: UX Spec

---

## Purpose & Player Need

The player arrives at this screen wanting to temporarily pause the game or quit the race.

**Player goal**: Interrupt the race without losing progress (pause) or abandon the current race entirely (quit). The screen serves a real-life need — the player needs to step away, or has decided the current race is not worth finishing.

**What would go wrong without it**: Without a pause overlay, the player has no way to safely interrupt a race. Mid-race ESC would either be ignored (forcing the player to keep driving) or hard-quit to desktop (losing all progress). The pause overlay is the only interruptible state between Racing and PostRace.

---

## Player Context on Arrival

The player first encounters this screen during their first race, when they press ESC (keyboard) or Start (gamepad).

**What they were doing**: Actively racing — focused on the track, rivals, and pit strategy. The pause is an intentional interruption of a high-focus activity.

**Emotional state**: Varies by context — interrupted (real-life distraction like a doorbell), frustrated (losing positions or crashed), or strategic (deciding to abandon a doomed race to try a different team/track). The design must accommodate all three without assuming any single emotional tone.

**Voluntary**: Yes — the player presses ESC/Start deliberately. Pause never triggers automatically.

---

## Navigation Position

This screen lives at: **[Gameplay] → [Racing] → [Pause Overlay]**

Context-dependent overlay — only reachable from the Racing GSM state. Not accessible from Menu, PreRace, PostRace, or Loading. Single entry point: the player is racing, presses ESC/Start, simulation freezes, overlay appears.

---

## Entry & Exit Points

| Entry Source | Trigger                                 | Player Carries This Context                                                                               |
| ------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Racing       | Press ESC (keyboard) or Start (gamepad) | Current race state is preserved — positions, fuel, tires, lap count. Simulation is frozen, not destroyed. |

| Exit Destination | Trigger                                | Notes                                                                                                                                             |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Racing           | Press ESC/Start again, or click Resume | Simulation unfreezes. All systems resume from frozen state. No time passes.                                                                       |
| PostRace         | Click Quit → confirm                   | Race is abandoned. `endRace()` is called without `race.completed`. Results screen shows current position as DNF. This is one-way — cannot resume. |

**Edge case**: During pit service (pitStopped sub-state), ESC/Start also triggers pause. The pit overlay is hidden, pause overlay shown. Resume returns to pit overlay.

---

## Layout Specification

### Information Hierarchy

| Rank | Item    | Rationale                                               |
| ---- | ------- | ------------------------------------------------------- |
| 1    | Resume  | Most common action — player wants to return to the race |
| 2    | Options | Quick-access settings without leaving the race          |
| 3    | Quit    | Destructive action — placed last, visually secondary    |

No race information displayed on the overlay — the frozen game background is visible behind the semi-transparent overlay, showing the player's current position, speed, and lap.

### Layout Zones

Single content zone, centred vertically and horizontally. Semi-transparent background (30-40% opacity) covers the full screen. No header, no footer.

### Component Inventory

| Zone                     | Component        | Type        | Content      | Interactive                      | Pattern                 |
| ------------------------ | ---------------- | ----------- | ------------ | -------------------------------- | ----------------------- |
| Content                  | Resume button    | Button      | "RESUME"     | Yes — closes pause, resumes race | Global Confirm / Cancel |
| Content                  | Options button   | Button      | "OPTIONS"    | Yes — opens Options screen       | —                       |
| Content                  | Quit button      | Button      | "QUIT"       | Yes — opens quit confirmation    | —                       |
| Content (confirm prompt) | Yes / No buttons | Button pair | "YES" / "NO" | Yes — confirms or cancels quit   | Double-press Safety     |

### ASCII Wireframe

```
┌──────────────────────────────────────┐
│                                      │
│            ╔══════════╗              │
│            ║  RESUME  ║              │  ← Primary action, accent colour
│            ╚══════════╝              │
│                                      │
│          ┌─────────────┐             │
│          │   OPTIONS   │             │  ← Opens settings/options screen
│          └─────────────┘             │
│                                      │
│            ┌──────────┐              │
│            │   QUIT   │              │  ← Secondary, neutral colour
│            └──────────┘              │
│                                      │
│  [Background: frozen race frame      │
│   with 35% dark overlay on top]      │
└──────────────────────────────────────┘

After QUIT is pressed, buttons are replaced by:

┌──────────────────────────────────────┐
│                                      │
│        ABANDON RACE?                 │
│                                      │
│        ┌─────┐  ┌─────┐             │
│        │ YES │  │ NO  │             │
│        └─────┘  └─────┘             │
│                                      │
└──────────────────────────────────────┘
```

---

## States & Variants

| State / Variant              | Trigger                                                     | What Changes                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Default**                  | ESC/Start during Racing                                     | Overlay appears with Resume + Options + Quit buttons. Background is the frozen race frame with 35% dark overlay. Simulation paused.                       |
| **Quit Confirm**             | Click Quit                                                  | All three buttons replaced by "Abandon Race?" prompt with YES / NO pair. NO returns to Default state.                                                     |
| **Resuming**                 | Click Resume or ESC                                         | Overlay dismissed. Simulation resumes from frozen state.                                                                                                  |
| **Race over (during pause)** | Game event (e.g., another car finishes triggering race end) | Pause overlay remains but Quit becomes the only meaningful action — race results already determined. Resume returns to a race that may already be ending. |

---

## Interaction Map

Mapping interactions for: Keyboard/Mouse + Gamepad (Full). Primary Input: Gamepad.

**Navigation**: D-pad up/down or left stick vertical moves focus between buttons. Gamepad triggers/accelerator/brake also navigate (up/down). Focus wraps? Yes — circular, down from Quit goes to Resume, up from Resume goes to Quit.

| Component               | Action         | Keyboard   | Gamepad                                 | Feedback                               | Outcome                               |
| ----------------------- | -------------- | ---------- | --------------------------------------- | -------------------------------------- | ------------------------------------- |
| Resume / Options / Quit | Navigate focus | ▲ ▼ arrows | D-pad up/down or left stick or triggers | Highlight moves, selected button glows | Focused option is visually active     |
| Resume                  | Select         | ENTER      | A                                       | Button press, overlay fades            | Simulation resumes, overlay dismissed |
| Options                 | Select         | ENTER      | A                                       | Button press                           | Opens Options screen (separate spec)  |
| Quit                    | Select         | ENTER      | A                                       | Button press                           | Shows YES/NO confirm prompt           |
| YES                     | Confirm quit   | ENTER      | A                                       | Brief flash                            | Race abandoned → PostRace with DNF    |
| NO                      | Cancel quit    | ESC        | B                                       | Returns to Default                     | Overlay shows Resume + Options + Quit |
| Global                  | Close pause    | ESC        | B (when Resume focused)                 | Overlay fades                          | Resume race (same as clicking Resume) |

**Tab order**: Resume (default focus) → Options → Quit → YES → NO → back to Resume

---

## Events Fired

| Player Action            | Event Fired                | Payload / Data | Notes                                                    |
| ------------------------ | -------------------------- | -------------- | -------------------------------------------------------- |
| Press ESC / Start        | `gsm.transition('Paused')` | —              | Handled by GSM. No Event Bus emission.                   |
| Click Resume / Press ESC | `gsm.transition('Racing')` | —              | GSM resumes. Simulation unfreezes.                       |
| Click Options            | —                          | —              | Routes to Options screen. No game event.                 |
| Click Quit → YES         | `raceManager.endRace()`    | —              | Triggers DNF, PostRace state. No `race.completed` event. |

---

## Transitions & Animations

| Transition          | Method                       | Duration | Notes                                              |
| ------------------- | ---------------------------- | -------- | -------------------------------------------------- |
| Enter (pause)       | Instant: `isVisible = true`  | 0ms      | Must feel immediate — no fade that delays response |
| Exit (resume / ESC) | Instant: `isVisible = false` | 0ms      | Game resumes same tick                             |
| Quit confirm prompt | Instant swap of button group | 0ms      | Resume/Options/Quit replaced by YES/NO             |
| YES → PostRace      | Brief delay then transition  | ~500ms   | Prevents accidental quit from feeling like a bug   |

---

## Data Requirements

| Data               | Source System                     | Read / Write                   | Notes                                                                                  |
| ------------------ | --------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| Current GSM state  | GSM (via Event Bus local copy)    | Read                           | Determines whether overlay is visible (Racing → Paused = show, Paused → Racing = hide) |
| Race configuration | Race Management (via init config) | Read (only for Quit → endRace) | Needed only on quit confirmation — no real-time data displayed on this screen          |

No time-sensitive or real-time data required. The overlay is a static screen — the frozen background provides all race context the player needs.

---

## Accessibility

Standard tier (MVP launch).

| Requirement                     | Implementation                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Keyboard navigation             | ▲ ▼ arrows navigate buttons. ENTER selects. ESC closes (same as Resume).                                          |
| Focus indicators                | All buttons have visible focus ring (2px accent border + glow). Default focus on Resume.                          |
| Text contrast                   | White text (#FFFFFF) on 35% dark overlay (#000000 with 35% opacity). Meets WCAG AA.                               |
| Color-independent communication | "ABANDON RACE?" uses text content + question mark, not red colour alone. Quit is labelled with text, not an icon. |
| Motion sensitivity              | Zero animation — instant transitions. No reduced-motion option needed for this screen.                            |

---

## Localization Considerations

| Element | String        | Max Length (EN) | Layout Risk                                            |
| ------- | ------------- | --------------- | ------------------------------------------------------ |
| Button  | RESUME        | 6 chars         | Low — single word, fits button                         |
| Button  | OPTIONS       | 7 chars         | Low — single word, fits button                         |
| Button  | QUIT          | 4 chars         | Low — single word, fits button                         |
| Prompt  | ABANDON RACE? | 13 chars        | Medium — 40% expansion (~18 chars) still fits one line |
| Button  | YES / NO      | 3 / 2 chars     | Low                                                    |

All strings are short and button sizes use padding-based width (not fixed pixel width), accommodating translation expansion without layout breakage.

---

## Acceptance Criteria

- [ ] Overlay appears within 1 frame of pressing ESC/Start during Racing state
- [ ] ▲ ▼ arrows cycle focus: Resume → Options → Quit → Resume (no wrap)
- [ ] ENTER on Resume closes overlay and resumes race at the same state
- [ ] ENTER on Quit replaces buttons with "Abandon Race?" + YES/NO prompt
- [ ] NO or ESC on quit prompt returns to Resume/Options/Quit buttons
- [ ] YES on quit prompt calls `endRace()` and transitions to PostRace with DNF status
- [ ] All buttons reachable via keyboard-only navigation (no mouse required)
- [ ] Tab blur while paused does not close or break the overlay

## Open Questions

| Question                                                                             | Owner         | Deadline       | Resolution                                                     |
| ------------------------------------------------------------------------------------ | ------------- | -------------- | -------------------------------------------------------------- |
| Should the Options screen be accessible from pause, or only from the main menu?      | game-designer | Alpha          | [Pause spec includes Options button — screen is separate spec] |
| Does Quit need an additional "hold to confirm" instead of a single ENTER on YES?     | game-designer | Alpha playtest | [To be tested]                                                 |
| Is the Options screen a full-screen replacement or a second overlay on top of pause? | ux-designer   | Options spec   | [To be decided in Options spec]                                |
