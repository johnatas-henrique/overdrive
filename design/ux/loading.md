# UX Spec: Loading

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-31
> **Journey Phase(s)**: Transition (menu → race)
> **Platform Target**: PC, Web
> **Template**: UX Spec

---

## Purpose & Player Need

Loading bridges the gap between decision and action. It shows the player that the game is working — assets are being prepared, the race is being built. Without it, the player stares at a frozen screen with no feedback.

**Player goal:** Wait as briefly as possible while the race loads. Understand that progress is happening.

**What goes wrong without it:** The player thinks the game crashed. No feedback, no progress, no trust.

**Emotional contract:** "Almost there." The loading bar moves, the player feels progress, anticipation builds.

---

## Player Context on Arrival

**After qualifying decision:** The player just chose "Start Qualifying" or "Skip." They're committed — track and car are locked. Loading is the point of no return.

**After qualifying results:** The player just confirmed "Start Race" on the qualifying results screen. The grid is set. Loading prepares the race.

**Emotional state:** Anticipatory, impatient. The player wants to race NOW. Loading must feel fast, not frustrating.

---

## Navigation Position

Loading appears at two points in the pre-race flow:

```
Qualifying Not Started → Loading → Qualifying → Qualifying Results → Loading → Race
```

It's a transition state — not a destination. The player never navigates TO Loading voluntarily; they're sent there by the game after making a decision.

---

## Entry & Exit Points

**Entry Points:**

| Entry Source | Trigger | Player carries this context |
|---|---|---|
| Qualifying Not Started | "Start Qualifying" | Track ID + Car ID |
| Qualifying Not Started | "Skip" | Track ID + Car ID |
| Qualifying Results | "Start Race" | Track ID + Car ID + grid assignment |

**Exit Points:**

| Exit Destination | Trigger | Notes |
|---|---|---|
| Qualifying | Content LoadReady (Qualifying mode) | One flying lap begins |
| Race (Countdown) | Content LoadReady (Race mode) | Race countdown begins |
| Previous screen | Content LoadError | Error message shown, Back/Cancel unblocked |

**Notes:** Back/Cancel is BLOCKED during loading. The only way out is success (→ race) or failure (→ error → previous screen). This is a one-way gate.

---

## Layout Specification

### Information Hierarchy

| Priority | Information | Location |
|----------|------------|----------|
| 1 | Progress bar | Center, prominent |
| 2 | Status text ("Loading track...", "Loading cars...") | Below progress bar |
| 3 | Track + car summary | Top, subtle |
| 4 | VFX (particles, ambient animation) | Background |

### Layout Zones

- **Zone 1 — Context (top):** Track name + car name (subtle, confirms what's loading)
- **Zone 2 — Progress (center):** Progress bar + status text
- **Zone 3 — Background:** Ambient VFX (particles, fade, or animation) — 3MB budget

### Component Inventory

| Component | Zone | Type | Interactive | Notes |
|-----------|------|------|-------------|-------|
| Track + car summary | 1 | Label | No | Subtle confirmation |
| Progress bar | 2 | Bar | No | Fills left to right based on byte count |
| Status text | 2 | Label | No | "Loading track...", "Loading cars...", "Preparing..." |
| VFX | 3 | Particles/animation | No | Background polish, 3MB budget |
| Error message | 2 | Banner | No | Appears on ContentLoadError, replaces progress |

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│           Monaco — Madonna                          │
│                                                     │
│                                                     │
│              ████████████████░░░░░░░░░░░            │
│              Loading cars... 67%                    │
│                                                     │
│                                                     │
│                                                     │
│                                                     │
│              [ambient VFX / particles]              │
└─────────────────────────────────────────────────────┘
```

**Notes:** Loading is a full-screen takeover. No interactive elements. Back/Cancel is blocked. The player waits.

---

## States & Variants

| State | Trigger | What Changes |
|-------|---------|--------------|
| Loading (normal) | Content loading in progress | Progress bar fills, status text updates |
| First launch | App startup, catalog initialization | "Preparing..." with spinner, no progress bar |
| Content error | ContentLoadError | Error message replaces progress, Back/Cancel unblocked |
| VFX background | Always | Ambient particles/animation during loading |

**Notes:** Loading has 3 functional states: normal (progress bar), first launch (spinner), and error (message). VFX runs in all states except error.

---

## Interaction Map

| Component | Action | Input (Keyboard) | Input (Gamepad) | Feedback | Outcome |
|-----------|--------|-------------------|------------------|----------|---------|
| None | — | — | — | — | No interactive elements |

**Notes:** Loading has NO interactive elements. All input is blocked. The player cannot pause, cancel, or interact. The only "interaction" is waiting for Content Pipeline to emit `RaceLoadReady`.

---

## Events Fired

| Player Action | Event Fired | Payload |
|---|---|---|
| None | — | — |

**Notes:** Loading fires no player events. It's a passive state — Content Pipeline drives the transitions.

---

## Transitions & Animations

| Transition | Animation | Duration | Notes |
|------------|-----------|----------|-------|
| Screen enter | Fade to black | 300ms | From previous screen |
| Progress bar fill | Smooth fill left to right | Per byte count | Updates as assets load |
| Status text change | Instant swap | 0ms | "Loading track..." → "Loading cars..." |
| VFX | Continuous ambient | Loop | Particles, fade, or ambient animation |
| Screen exit → Race | Fade from black | 300ms | Into countdown or qualifying |
| Error appear | Fade in error banner | 200ms | Replaces progress bar area |

**Reduced Motion:** All transitions instant. No fade, no VFX — static progress bar only.

---

## Data Requirements

| Data | Source System | Read / Write | Notes |
|------|--------------|--------------|-------|
| Load progress (0-100%) | Content Pipeline | Read | Derived from byte counts of pending bundles |
| Status text | Content Pipeline | Read | "Preparing...", "Loading track...", "Loading cars..." |
| Track name | Track Definition Data | Read | For context display |
| Car name | Car Definition Data | Read | For context display |
| Content error message | Content Pipeline | Read | Shown on ContentLoadError |

**Notes:** Loading is purely read-only. It displays progress driven by Content Pipeline. No game state is modified on this screen.

---

## Accessibility

**Tier: Standard**

| Requirement | Implementation |
|-------------|----------------|
| Accessible labels | Status text carries semantic names ("Loading race — Monaco, Madonna. 67 percent complete") for future assistive tech expansion; no active screen reader support at Standard tier |
| Text contrast | Minimum 4.5:1 — white text on dark background |
| Color-independent | Progress bar uses fill + percentage text, not just color |
| Reduced Motion | No VFX, no fade transitions — static progress bar only |
| Text scaling | All text respects 75%–200% scaling |

**Notes:** Loading has no interactive elements, so keyboard/gamepad navigation is not applicable. Accessibility focuses on screen reader updates and visual clarity.

---

## Localization Considerations

| Element | Max Length | Layout Impact | Priority |
|---------|-----------|---------------|----------|
| Status text ("Loading track...") | ~25 chars | Must fit on one line | HIGH |
| Error message | ~80 chars | Must wrap cleanly | HIGH |
| Track name | ~20 chars | Context header | MEDIUM |
| Car name | ~20 chars | Context header | MEDIUM |
| Percentage ("67%") | ~5 chars | Fixed format, no expansion | LOW |

**Notes:** Status text is the longest variable element. Error messages must support text wrapping. The 40% expansion rule applies to status text.

---

## Acceptance Criteria

- [ ] Loading opens within 300ms from previous screen
- [ ] Progress bar fills smoothly from 0% to 100%
- [ ] Status text updates: "Preparing..." → "Loading track..." → "Loading cars..."
- [ ] Track name and car name displayed in context header
- [ ] Back/Cancel is blocked during loading
- [ ] Content error message appears on ContentLoadError and unblocks Back/Cancel
- [ ] Accessible labels on status text announce progress percentage on update (semantic naming for future assistive tech)
- [ ] VFX (particles/animation) runs in background during loading
- [ ] Reduced Motion: no VFX, no fade — static progress bar only
- [ ] All text meets minimum 14px at 1080p

---

## Open Questions

- VFX content: particles, ambient animation, or static image? Depends on art direction.
- ~~Loading duration target: how fast should PC/Web load a race? Content Pipeline GDD doesn't specify a target.~~ **DECIDED:** PC (SSD) ≤5s, Web ≤10s. Progress bar must be smooth and continuous (no jumps). **NOTE:** this target is a UX proposal — the content-pipeline.md GDD does not define load-time budgets; the value must be registered as a content-pipeline tuning knob (or AC) before implementation.
- Should the loading screen show tips or track info? Or keep it minimal?
