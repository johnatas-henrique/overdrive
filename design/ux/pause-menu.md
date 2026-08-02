# UX Spec: Pause Menu

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-31
> **Journey Phase(s)**: First Mastery (30 min - 2 hours)
> **Platform Target**: PC, Web
> **Template**: UX Spec

---

## Purpose & Player Need

Pause Menu is the player's control center during a race. It freezes the simulation, shows the current state, and offers three options: resume, adjust settings, or quit the race.

**Player goal:** Take a break, change settings, or abandon the race with full awareness of the consequences.

**What goes wrong without it:** The player is stuck in the race with no way to pause, adjust, or leave. No agency, no control.

**Emotional contract:** "I'm in control." The pause is instant, the menu is clear, and the consequences of each choice are obvious.

---

## Player Context on Arrival

**Mid-race pause:** The player pressed Escape/Start during Countdown or Racing. The simulation is frozen. They need a moment — maybe to adjust volume, check settings, or just take a breath.

**Emotional state:** Calm but alert. The race is frozen but still present. The player wants control without commitment — resume should feel effortless, quitting should feel deliberate.

---

## Navigation Position

Pause Menu is an overlay — it sits on top of the race, not in the navigation hierarchy. It's triggered by Escape/Start during gameplay and dismisses back to the race.

```
Race (Countdown/Racing) → [PAUSE MENU] → Race (resume)
                                       → Settings → [back to PAUSE MENU]
                                       → Return to Menu → Results (Forfeit)
```

---

## Entry & Exit Points

**Entry Points:**

| Entry Source | Trigger | Player carries this context |
|---|---|---|
| Race (Countdown) | Escape / Start (gamepad) | Simulation frozen, countdown paused |
| Race (Racing) | Escape / Start (gamepad) | Simulation frozen, race time paused |

**Exit Points:**

| Exit Destination | Trigger | Notes |
|---|---|---|
| Race (resume) | "Resume" or Escape/Start | Simulation unfreezes, continues from exact state |
| Settings | "Settings" | Opens Settings, returns to Pause Menu on Cancel |
| Results (Forfeit) | "Return to Menu" | Race ends with Forfeit result, no final position |

**Notes:** "Return to Menu" is the only destructive exit — it ends the race with a Forfeit. Resume and Settings are safe exits. The player must confirm "Return to Menu" to prevent accidental forfeit.

---

## Layout Specification

### Information Hierarchy

| Priority | Information | Location |
|----------|------------|----------|
| 1 | "PAUSED" header | Center overlay, top |
| 2 | "Resume" button | Center overlay, primary |
| 3 | "Settings" button | Center overlay, secondary |
| 4 | "Return to Menu" button | Center overlay, destructive |

### Layout Zones

- **Zone 1 — Overlay (center):** Semi-transparent dark panel with "PAUSED" header + 3 buttons stacked vertically
- **Background:** Frozen game state + HUD remains visible — player sees their position, lap, fuel, tire, speed, rival gap

### Component Inventory

| Component | Zone | Type | Interactive | Notes |
|-----------|------|------|-------------|-------|
| "PAUSED" header | 1 | Label | No | Centered, prominent |
| "Resume" button | 1 | Button | Yes | Primary action — Confirm pattern |
| "Settings" button | 1 | Button | Yes | Secondary action — Confirm pattern |
| "Return to Menu" button | 1 | Button | Yes | Destructive action — requires confirmation |

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────┐
│  [HUD: P3  Lap 2/5  Fuel ████░░░  Tire ██████░░]  │
│                                                     │
│                                                     │
│              ┌─────────────────────┐               │
│              │     PAUSED          │               │
│              │                     │               │
│              │     [RESUME]        │               │
│              │     [SETTINGS]      │               │
│              │     [RETURN TO MENU]│               │
│              │                     │               │
│              └─────────────────────┘               │
│                                                     │
│                                                     │
│  [HUD: Speed 247 km/h      Rival +1.2s]            │
└─────────────────────────────────────────────────────┘
```

---

## States & Variants

| State | Trigger | What Changes |
|-------|---------|--------------|
| Default (Countdown) | Pause during countdown | All 3 buttons enabled |
| Default (Racing) | Pause during racing | All 3 buttons enabled |
| Confirm Return | Player selects "Return to Menu" | Confirmation modal: "Quit race? Forfeit position." Yes/No |

**Notes:** The Confirm Return state is critical — "Return to Menu" is destructive (Forfeit). A confirmation modal prevents accidental forfeit.

---

## Interaction Map

| Component | Action | Input (Keyboard) | Input (Gamepad) | Feedback | Outcome |
|-----------|--------|-------------------|------------------|----------|---------|
| "Resume" | Confirm | Enter | South (A) | Button flash + click sound | Simulation unfreezes, race continues |
| "Settings" | Confirm | ↓ + Enter or Tab + Enter | D-pad Down + South | Button flash + click sound | Opens Settings, returns to Pause Menu on Cancel |
| "Return to Menu" | Confirm | ↓↓ + Enter or Tab×2 + Enter | D-pad Down×2 + South | Button flash + click sound | Opens confirmation modal |
| Confirmation: Yes | Confirm | Enter | South (A) | Button flash + click sound | Race ends with Forfeit, Results screen |
| Confirmation: No | Cancel | Escape | East (B) | Returns to Pause Menu | Back to 3 buttons |
| Pause toggle | Resume | Escape / Start | Start | Instant | Simulation unfreezes, race continues |

**Notes:** "Resume" is focused by default. "Return to Menu" requires deliberate navigation (2× Down). Escape/Start while paused = instant resume (no menu interaction needed). This is the standard pause toggle behavior.

---

## Events Fired

| Player Action | Event Fired | Payload |
|---|---|---|
| Resume (button or Escape/Start) | `PauseResumed` | `{ pauseDuration }` — UI-local event; not a simulation contract (pause edge handling is owned by Simulation per ADR-0001; this event is for UI presentation only) |
| Settings opened | `PauseSettingsOpened` | none |
| Return to Menu confirmed | `ReturnToMenuRequested` | `{ resultClassification: "Forfeit", forfeitLapCount, raceTimeAtForfeit }` |

**Notes:** `ReturnToMenuRequested` triggers `RaceAborted` in Race Session Manager, which sets the Forfeit result and transitions to Results. The payload carries the forfeit data needed for the Results screen.

---

## Transitions & Animations

| Transition | Animation | Duration | Notes |
|------------|-----------|----------|-------|
| Screen enter (pause) | Dark overlay fade in | 150ms | Fast — player wants instant control |
| Screen exit (resume) | Dark overlay fade out | 150ms | Fast — back to action |
| Confirmation modal enter | Scale from 0.9 → 1.0 | 200ms | Subtle emphasis on destructive choice |
| Confirmation modal exit | Scale from 1.0 → 0.9 | 150ms | Dismiss back to buttons |
| Button focus | Scale 1.0 → 1.05 | 100ms | Subtle emphasis |

**Reduced Motion:** All transitions instant. No fade, no scale — instant overlay appear/disappear.

---

## Data Requirements

| Data | Source System | Read / Write | Notes |
|------|--------------|--------------|-------|
| Pause duration | Simulation Architecture | Read | Time since pause started |
| Current lap count | Race Session Manager | Read | For forfeit payload |
| Current race time | Race Session Manager | Read | For forfeit payload |
| Result classification | Race Session Manager | Write | Set to "Forfeit" on Return to Menu |

**Notes:** Pause Menu reads simulation state (frozen) and writes the forfeit classification. The HUD continues to display live data from the frozen simulation state.

---

## Accessibility

**Tier: Standard**

| Requirement | Implementation |
|-------------|----------------|
| Keyboard-only navigation | All 3 buttons reachable via ↑/↓ + Enter. Confirmation modal reachable. |
| Gamepad navigation | All 3 buttons reachable via D-pad + South. Confirmation modal reachable. |
| Focus indicator | Visible 2px outline on focused button |
| Text contrast | Minimum 4.5:1 — white text on semi-transparent dark overlay |
| Color-independent | "Return to Menu" is destructive — position (bottom) distinguishes it, not just color |
| Accessible labels | Buttons carry semantic names ("Resume", "Settings", "Return to Menu") for future assistive tech expansion; no active screen reader support at Standard tier |
| Reduced Motion | No fade, no scale — instant overlay appear/disappear |
| Text scaling | All text respects 75%–200% scaling |

---

## Localization Considerations

| Element | Max Length | Layout Impact | Priority |
|---------|-----------|---------------|----------|
| "PAUSED" | ~10 chars | Header — must fit on one line | MEDIUM |
| "RESUME" | ~10 chars | Button — 40% expansion safe | HIGH |
| "SETTINGS" | ~15 chars | Button — 40% expansion safe | HIGH |
| "RETURN TO MENU" | ~20 chars | Button — 40% expansion safe | HIGH |
| Confirmation text | ~40 chars | Modal — must wrap cleanly | HIGH |

**Notes:** "Return to Menu" is the longest button label. Confirmation modal text must support 40% expansion. The 40% expansion rule applies to all text elements.

---

## Acceptance Criteria

- [ ] Pause Menu opens within 150ms from Escape/Start
- [ ] Simulation freezes immediately on pause
- [ ] HUD remains visible behind overlay
- [ ] "Resume" button focused by default
- [ ] "Resume" or Escape/Start unfreezes simulation and returns to race
- [ ] "Settings" opens Settings, returns to Pause Menu on Cancel
- [ ] "Return to Menu" opens confirmation modal
- [ ] Confirmation "Yes" ends race with Forfeit result
- [ ] Confirmation "No" returns to Pause Menu
- [ ] Focus indicator visible on focused button
- [ ] Accessible labels on buttons announce "Paused" and available actions (semantic naming for future assistive tech)
- [ ] Reduced Motion: no fade, no scale — instant overlay
- [ ] All text meets minimum 14px at 1080p

---

## Open Questions

- Should the Pause Menu show the current track name and car name? Or is the HUD context sufficient?
- Should there be a "Restart Race" option? Or is that deferred to Alpha?
