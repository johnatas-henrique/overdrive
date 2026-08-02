# UX Spec: Qualifying Not Started

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-31
> **Journey Phase(s)**: Orientation (5-30 minutes)
> **Platform Target**: PC, Web
> **Template**: UX Spec

---

## Purpose & Player Need

Qualifying Not Started is the moment of commitment. The player has chosen their track and car — now they decide how to approach the race. Qualify for a better grid position, or skip and start last.

**Player goal:** Decide their strategy — risk the flying lap for a better starting position, or accept P16 and focus on the race.

**What goes wrong without it:** The player is thrown into qualifying without choosing. No agency, no strategy.

**Emotional contract:** "I can prove myself on the track, or I can trust my race craft from the back." The decision is weighty — one chance, no retry.

---

## Player Context on Arrival

**After car selection:** The player just picked their car. They're now facing the final decision before the race. Track and car are locked — only the approach remains.

**Emotional state:** Decisive, focused. "Should I qualify or skip?" The design should make the consequences clear without being preachy.

---

## Navigation Position

Qualifying Not Started is the fourth screen in the pre-race flow:

```
Title → Track Selection → Car Selection → [QUALIFYING NOT STARTED] → Qualifying → Qualifying Results → Loading → Race
                                          └→ Skip → Qualifying Results → Loading → Race
```

Back/Cancel returns to Car Selection. This is the last screen before the race begins — after this, Loading blocks all navigation.

---

## Entry & Exit Points

**Entry Points:**

| Entry Source | Trigger | Player carries this context |
|---|---|---|
| Car Selection | Confirm on selected car | Track ID + Car ID locked |

**Exit Points:**

| Exit Destination | Trigger | Notes |
|---|---|---|
| Qualifying | "Start Qualifying" (Confirm) | One flying lap, no retry. Irreversible. |
| Qualifying Results → Loading → Race | "Skip" (Confirm) | Player starts at P16. Irreversible. |
| Car Selection | Back/Cancel | Returns to Car Selection |

**Notes:** Both "Start Qualifying" and "Skip" lead to Loading, which blocks Back/Cancel. The player cannot return to this screen once they choose.

---

## Layout Specification

### Information Hierarchy

| Priority | Information | Location |
|----------|------------|----------|
| 1 | Decision prompt ("Ready to race?") | Center, prominent |
| 2 | Track + Car summary | Below prompt |
| 3 | "Start Qualifying" button | Bottom-left |
| 4 | "Skip" button | Bottom-right |

### Layout Zones

- **Zone 1 — Header (top):** Track name + car name summary
- **Zone 2 — Prompt (center):** "Ready to race?" or similar decision prompt
- **Zone 3 — Actions (bottom):** Two buttons — "Start Qualifying" (primary) and "Skip" (secondary)

### Component Inventory

| Component | Zone | Type | Interactive | Notes |
|-----------|------|------|-------------|-------|
| Track + Car summary | 1 | Label | No | Context reminder |
| Decision prompt | 2 | Label | No | "Ready to race?" |
| "Start Qualifying" button | 3 | Button | Yes | Primary action — Confirm pattern |
| "Skip" button | 3 | Button | Yes | Secondary action — Confirm pattern |

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│           Monaco — Madonna                          │
│                                                     │
│              Ready to race?                         │
│                                                     │
│                                                     │
│                                                     │
│                                                     │
│      [START QUALIFYING]        [SKIP]              │
│      Enter: Qualify            Tab+Enter: Skip      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Notes:** "Start Qualifying" is the primary action (left, highlighted). "Skip" is secondary (right, less prominent). The player must deliberately navigate to Skip — it's not the default.

---

## States & Variants

| State | Trigger | What Changes |
|-------|---------|--------------|
| Default | Normal load | Both buttons enabled, "Start Qualifying" focused by default |

**Notes:** This screen has no error states — it's a pure decision point with no external data dependency.

---

## Interaction Map

| Component | Action | Input (Keyboard) | Input (Gamepad) | Feedback | Outcome |
|-----------|--------|-------------------|------------------|----------|---------|
| "Start Qualifying" | Confirm | Enter | South (A) | Button flash + click sound | Loading → Qualifying |
| "Skip" | Confirm | Tab+Enter or Right+Enter | D-pad Right + South | Button flash + click sound | Loading → Qualifying Results (P16) |
| Navigate | Move focus | ← / → or Tab | D-pad Left/Right | Focus moves between buttons | Highlight button |
| Back/Cancel | Return | Escape | East (B) | Returns to Car Selection | Car Selection screen |

**Notes:** "Start Qualifying" is focused by default. The player must deliberately navigate right to reach "Skip" — this prevents accidental skips.

---

## Events Fired

| Player Action | Event Fired | Payload |
|---|---|---|
| Start Qualifying | `QualifyingStarted` | `{ trackId, carId }` |
| Skip | `QualifyingSkipped` | `{ trackId, carId }` |

**Notes:** Both events trigger Loading. `QualifyingStarted` loads qualifying mode; `QualifyingSkipped` loads qualifying results directly with player at P16.

---

## Transitions & Animations

| Transition | Animation | Duration | Notes |
|------------|-----------|----------|-------|
| Screen enter | Slide from right | 300ms | Push navigation from Car Selection |
| Screen exit → Loading | Fade to black | 300ms | Transitions to loading |
| Screen exit → Car Selection | Slide right | 300ms | Pop navigation back |
| Button focus | Scale 1.0 → 1.05 | 150ms | Subtle emphasis |

**Reduced Motion:** All transitions instant. No slide, no scale — instant swap.

---

## Data Requirements

| Data | Source System | Read / Write | Notes |
|------|--------------|--------------|-------|
| Track name | Track Definition Data | Read | For header display |
| Car name | Car Definition Data | Read | For header display |
| Track ID | Settings / Save | Read | Carried from Track Selection |
| Car ID | Settings / Save | Read | Carried from Car Selection |

**Notes:** Qualifying Not Started is read-only — it displays context (track + car) and triggers an event. No game state is modified on this screen.

---

## Accessibility

**Tier: Standard**

| Requirement | Implementation |
|-------------|----------------|
| Keyboard-only navigation | Both buttons reachable via ←/→ or Tab + Enter |
| Gamepad navigation | Both buttons reachable via D-pad + South |
| Focus indicator | Visible 2px outline on focused button |
| Text contrast | Minimum 4.5:1 — white text on dark background |
| Color-independent | "Start Qualifying" is primary (left), "Skip" is secondary (right) — position distinguishes them, not just color |
| Accessible labels | Buttons carry semantic names ("Start Qualifying", "Skip") and the summary reads "Monaco, Madonna" for future assistive tech expansion; no active screen reader support at Standard tier |
| Reduced Motion | No slide transitions, no scale — instant swap |
| Text scaling | All text respects 75%–200% scaling |

---

## Localization Considerations

| Element | Max Length | Layout Impact | Priority |
|---------|-----------|---------------|----------|
| "START QUALIFYING" | ~20 chars | Button width — 40% expansion safe | HIGH |
| "SKIP" | ~10 chars | Button width — 40% expansion safe | HIGH |
| Track name | ~20 chars | Header — must fit on one line | HIGH |
| Car name | ~20 chars | Header — must fit on one line | HIGH |
| Decision prompt | ~25 chars | Center — must fit on one line | MEDIUM |

**Notes:** Button labels are the longest variable elements. Track and car names are data-driven. The 40% expansion rule applies to all text elements.

---

## Acceptance Criteria

- [ ] Screen opens within 300ms from Car Selection
- [ ] Track name and car name displayed in header
- [ ] "Start Qualifying" button focused by default
- [ ] "Start Qualifying" triggers Loading → Qualifying
- [ ] "Skip" triggers Loading → Qualifying Results (player at P16)
- [ ] ←/→ or Tab moves focus between buttons
- [ ] Escape/East returns to Car Selection
- [ ] Focus indicator visible on focused button
- [ ] Accessible labels on buttons announce track, car, and available actions (semantic naming for future assistive tech)
- [ ] Reduced Motion: no slide transitions, no scale — instant swap
- [ ] All text meets minimum 14px at 1080p

---

## Open Questions

- Should the screen show track stats (distance, elevation) alongside the name? Or just track + car?
- ~~Should "Skip" show a warning ("You will start at P16")?~~ **DECIDED:** No warning. The two buttons are clear ("Start Qualifying" vs "Skip"), the player must navigate deliberately to Skip, and the consequence (P16) is obvious for racing game players.
