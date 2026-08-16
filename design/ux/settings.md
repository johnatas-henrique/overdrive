# UX Spec: Settings

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-29
> **Journey Phase(s)**: Pre-Race (configuration), Pause (mid-race adjustment)
> **Platform Target**: PC, Web
> **Template**: UX Spec

---

## Purpose & Player Need

Settings is where the player takes ownership of their experience — controls that match their muscle memory, difficulty that matches their skill, audio that feels right. It persists between sessions, previews changes in real-time, and uses a transactional model (snapshot → working copy → Apply/Cancel) so nothing is lost by accident.

**Player goal:** Make the game feel like theirs. Remap controls to match another racing game. Set difficulty to the right challenge. Balance audio for their setup.

**What goes wrong without it:** Hardcoded values. One-size-fits-all. The game fights the player instead of adapting to them.

**Emotional contract:** Ownership. "This is MY game." The first time a player remaps a control to match their muscle memory, the game instantly feels familiar.

---

## Player Context on Arrival

**From Title/Car Selection:** The player hasn't started a race yet. Emotional state: calm, focused on setup. They're preparing — like a mechanic tuning a car before the race.

**From Pause Menu (mid-race):** The player is in the middle of a race and paused to adjust something specific — controls feel wrong, audio too loud, camera shake too intense. Emotional state: slightly stressed, time-pressured (the race is paused but they want to get back). Difficulty is locked (the race already owns its profile).

**First encounter:** Player opens Settings for the first time. Default values are applied. They explore what's available.

---

## Navigation Position

Settings is a mid-level screen — not a root destination, but accessible from multiple parents. It lives at:

```
Title → Settings
Car Selection → Settings
Pause Menu → Settings (race-paused or countdown-paused)
```

**Back/Cancel returns to the screen that opened Settings** — not to Title. If opened from Pause Menu, Cancel returns to Pause Menu. If opened from Title, Cancel returns to Title. This preserves navigation context.

---

## Entry & Exit Points

**Entry Points:**

| Entry Source | Trigger | Player carries this context |
|---|---|---|
| Title screen | "Settings" button | None — fresh config session |
| Car Selection | "Settings" button | None — pre-race config |
| Pause Menu | "Settings" during race pause | Race state (difficulty locked) |
| DisplayConfirm timeout | 15s expires on resolution/fullscreen change | Display candidate reverts |

**Exit Points:**

| Exit Destination | Trigger | Notes |
|---|---|---|
| Title screen | Back/Cancel from Title entry | Snapshot restored, working discarded |
| Car Selection | Back/Cancel from Car Selection entry | Snapshot restored, working discarded |
| Pause Menu | Back/Cancel from Pause entry | Snapshot restored, working discarded |
| Pause Menu | Apply succeeds | Working persisted, returns to Pause |
| Title / Car Selection | Apply succeeds | Working persisted, returns to parent |
| DisplayConfirm | Keep Changes / Cancel / Timeout | Display state managed separately |

---

## Layout Specification

### Information Hierarchy

| Priority | Information | Location |
|----------|------------|----------|
| 1 | Category navigation (tabs) | Top tab bar |
| 2 | Active category settings | Center content area |
| 3 | Apply / Cancel / Restore Defaults | Bottom bar |
| 4 | Category-specific warnings | Inline within category |

### Layout Zones

- **Zone 1 — Tab Bar (top):** 6 category tabs, horizontal. Q/E (keyboard) or LB/RB (gamepad) to switch.
- **Zone 2 — Content Area (center):** Settings specific to selected category. Scrollable if content exceeds viewport.
- **Zone 3 — Bottom Bar:** Hint text (left), Restore Defaults (center-left), Cancel (center-right), Apply (right). Esc aligns with Cancel, Enter aligns with Apply.

### Component Inventory

| Component | Zone | Type | Interactive | Notes |
|-----------|------|------|-------------|-------|
| Category Tabs | 1 | Tab bar | Yes | 6 tabs, Q/E or LB/RB to switch |
| Setting controls (per category) | 2 | Sliders, dropdowns, toggles, radio buttons | Yes | Varies per category |
| Hint text | 3 | Label | No | "Q/E: Tabs ↑↓: Navigate Esc: Back Enter: Select" |
| "Restore Defaults" button | 3 | Button | Yes | Confirmation dialog before action |
| "Cancel" button | 3 | Button | Yes | Restores snapshot, closes |
| "Apply" button | 3 | Button | Yes | Persists working copy, closes |

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────┐
│ [Difficulty] [Controls] [Audio] [Display] [Access] [Camera] │
├─────────────────────────────────────────────────────┤
│                                                     │
│              Category content area                   │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Q/E: Tabs  ↑↓: Navigate  Esc: Back  Enter: Select  │
│  [Restore Defaults]          [Cancel]    [Apply]    │
└─────────────────────────────────────────────────────┘
```

---

## States & Variants

| State | Trigger | What Changes |
|-------|---------|--------------|
| Default | Normal load | All categories enabled, default values from snapshot |
| Difficulty Locked | Settings opened from race-pause | Difficulty tab disabled/greyed, cannot be selected |
| DisplayConfirm Active | Resolution or fullscreen changed | 15s countdown modal, Apply disabled, Keep Changes/Cancel options |
| Listening (Controls) | Player taps a binding slot | Slot shows "Listening..." text, next valid input captured |
| BindingConflict (Controls) | Captured input conflicts with existing binding | Modal: "This key is bound to [action]. Reassign?" |
| Save Error | Apply fails (PlayerPrefs write error) | Error message, Settings stays open, working preserved |
| Restore Defaults Confirm | Player taps Restore Defaults | Confirmation dialog: "Reset all settings to defaults?" |

---

## Interaction Map

| Component | Action | Input (Keyboard) | Input (Gamepad) | Feedback | Outcome |
|-----------|--------|-------------------|------------------|----------|---------|
| Tab bar | Switch tab | Q / E | LB / RB | Tab highlight slides | Content area updates |
| Navigate | Move focus | ↑ / ↓ | D-pad ↑↓ / Left stick | Focus outline moves | Next control highlighted |
| Slider | Adjust value | ← / → | Left stick ←→ / D-pad | Slider handle moves, value updates | Working copy updated |
| Dropdown | Open/select | Enter / ↓ | South / D-pad ↓ | Dropdown expands/collapses | Option selected |
| Toggle | Switch on/off | Enter | South | Toggle animates | Working copy updated |
| Radio button | Select option | Enter | South | Radio fills | Working copy updated |
| Binding slot (Controls) | Start rebinding | Enter | South | "Listening..." text | Listening state activated |
| Listening | Capture input | Any key | Any button | Captured key displayed | Binding updated or conflict |
| BindingConflict modal | Confirm/Cancel rebinding | Enter / Escape | South / East | Modal closes | Binding accepted or reverted |
| DisplayConfirm modal | Keep Changes | Enter | South | Modal closes, display persists in working | State returns to Open |
| DisplayConfirm modal | Cancel | Escape | East | Modal closes, display reverts | State returns to Open |
| DisplayConfirm countdown | 15s timeout | — | — | Countdown reaches 0, display reverts | State returns to Open |
| "Apply" button | Persist all | Enter (when focused) | South | Button flash, Settings closes | Working → persisted |
| "Cancel" button | Discard all | Escape (when focused) | East | Settings closes | Snapshot restored |
| "Restore Defaults" | Reset to factory | Enter (when focused) | South | Confirmation dialog | Working → defaults |
| Back/Cancel (global) | Return to parent | Escape | East | Settings closes | Snapshot restored |

---

## Events Fired

| Player Action | Event Fired | Payload |
|---|---|---|
| Tab switch | `SettingsTabChanged` | `{ category: "audio" }` |
| Setting value changed | `SettingValueChanged` | `{ category, key, oldValue, newValue }` |
| Apply | `SettingsApplied` | `{ categories_changed: ["audio", "controls"] }` |
| Cancel | `SettingsCancelled` | `{ categories_changed: ["audio"] }` |
| Restore Defaults | `SettingsDefaultsRestored` | `{ previous_values: {...} }` |
| DisplayConfirm started | `DisplayPreviewStarted` | `{ resolution, fullscreen }` |
| DisplayConfirm kept | `DisplayPreviewConfirmed` | `{ resolution, fullscreen }` |
| DisplayConfirm cancelled | `DisplayPreviewReverted` | `{ reverted_to }` |
| Binding captured | `BindingChanged` | `{ action, slot, oldBinding, newBinding }` |
| Binding conflict resolved | `BindingConflictResolved` | `{ action, slot, resolution: "override" | "cancel" }` |
| Save error | `SettingsSaveFailed` | `{ error: "PlayerPrefs write failed" }` |

**Notes:** `SettingValueChanged` fires on every slider/dropdown/toggle change — analytics only, no game-state modification. `SettingsApplied` is the only event that triggers persistence.

---

## Transitions & Animations

| Transition | Animation | Duration | Notes |
|------------|-----------|----------|-------|
| Screen enter | Slide from right | 300ms | Push navigation from parent |
| Screen exit | Slide to right | 300ms | Pop navigation back |
| Tab switch | Content crossfade | 200ms | Old content fades out, new fades in |
| Tab highlight | Slide underline | 150ms | Underline follows active tab |
| Slider adjust | Handle follows input | Immediate | No animation lag |
| Toggle switch | Knob slides | 150ms | Left/right position |
| DisplayConfirm modal | Fade in overlay | 200ms | Modal appears over Settings |
| Listening state | Pulse on slot | Loop 800ms | "Listening..." text pulses |
| Apply button flash | Flash green | 200ms | Confirmation feedback |
| Error banner | Fade in | 200ms | Non-blocking, top of content area |

**Reduced Motion:** All transitions instant (0ms). Tab switch is instant swap. Listening pulse becomes static text. No slide animations.

---

## Data Requirements

| Data | Source System | Read / Write | Notes |
|------|--------------|--------------|-------|
| Difficulty level (0-4) | Settings (PlayerPrefs) | Read → Write (on Apply) | Consumed at next race init |
| Control bindings | Input System | Read → Write (on Apply) | Stable action/binding IDs with overrides |
| Dead zone values (inner/outer) | Input System | Read → Write (on Apply) | Shared control settings |
| EMA alpha values (accel/brake/steer) | Input System | Read → Write (on Apply) | Shared control settings |
| Audio volumes (master/music/sfx/ui) | Unity Audio Mixer | Read → Write (immediate) | Preview applies instantly |
| Mute states (music/sfx) | Unity Audio Mixer | Read → Write (immediate) | Preview applies instantly |
| Resolution | Display System | Read → Write (on Apply) | Requires DisplayConfirm |
| Fullscreen mode | Display System | Read → Write (on Apply) | Requires DisplayConfirm |
| VSync | Display System | Read → Write (on Apply) | — |
| Quality preset | URP Pipeline | Read → Write (immediate) | Preview applies instantly |
| Advanced quality settings | URP Pipeline | Read → Write (on Apply) | Render scale, shadows, MSAA |
| Colorblind mode | UI/HUD systems | Read → Write (immediate) | Preview applies instantly |
| Text scaling | UI Text system | Read → Write (immediate) | Preview applies instantly |
| Camera shake intensity | Camera System | Read → Write (immediate) | Preview applies instantly |
| Motion blur | VFX System | Read → Write (immediate) | Reduced Motion overrides |
| Reduced Motion | CameraSettings | Read → Write (immediate) | Forces shake/blur/FOV off |
| Show Chase HUD in Cockpit | HUD System | Read → Write (immediate) | Controls cockpit overlay; Camera-section setting previews instantly per ADR-0004 |

**Notes:** Audio, Display preview, Accessibility, and Camera apply immediately. Difficulty, Controls, and Display confirmation persist only on Apply. The screen is a read-modify-write interface — it doesn't own any game state, it mediates between the player and the systems that do.

---

## Accessibility

**Tier: Standard**

| Requirement | Implementation |
|-------------|----------------|
| Keyboard-only navigation | All controls reachable via ↑/↓/Enter/Escape. Q/E for tabs. |
| Gamepad navigation | All controls reachable via D-pad/Left stick + South/East. LB/RB for tabs. |
| Focus indicator | Visible 2px outline on focused control, high contrast (#FFF8F0 on #1A1A1A) |
| Text contrast | Minimum 4.5:1 ratio for all text. Spline Sans 18px body, 24px buttons. |
| Color-independent | No information by color alone — disabled tabs show "LOCKED" text + greyed visual |
| Accessible labels | All controls carry semantic names; tabs announce category name in their label text for future assistive tech expansion; no active screen reader support at Standard tier |
| Reduced Motion | All transitions instant, no pulse animations, no slide animations |
| Text scaling | All text respects 75%–200% scaling. Controls reflow. |
| Colorblind modes | Preview applies instantly so player can verify before Apply |
| Minimum text size | 14px at 1080p (art-bible rule) |

---

## Localization Considerations

| Element | Max Length | Layout Impact | Priority |
|---------|-----------|---------------|----------|
| Tab labels ("Difficulty", "Controls", etc.) | ~15 chars | Tab width — 40% expansion safe | HIGH |
| Slider labels ("Master Volume", etc.) | ~25 chars | Label width — must not overflow slider | HIGH |
| Button labels ("Apply", "Cancel", "Restore Defaults") | ~20 chars | Bottom bar width — 40% expansion safe | HIGH |
| Dropdown options ("Very Easy", "Fullscreen Window") | ~25 chars | Dropdown width — must fit longest option | HIGH |
| Binding conflict modal text | ~60 chars | Modal width — must wrap cleanly | HIGH |
| "Listening..." text | ~15 chars | Slot width — fixed, minimal risk | LOW |
| Hint text ("Q/E: Tabs...") | ~50 chars | Bottom bar — must fit on one line | MEDIUM |

**Notes:** All labels follow the 40% expansion rule. Tab labels are the tightest constraint — "Accessibility" (13 chars) expands to "Barrierefreiheit" (16 chars) in German, still safe. Dropdown options are the second constraint — "Fullscreen Window" (17 chars) could expand to "Vollbildfenster" (15 chars) or similar. No currencies or dates. Numbers (slider percentages) use invariant formatting.

---

## Acceptance Criteria

- [ ] Settings opens within 300ms from any entry point
- [ ] All 6 category tabs are visible and navigable via Q/E (keyboard) or LB/RB (gamepad)
- [ ] Tab switch updates content area within 200ms
- [ ] All setting controls (sliders, dropdowns, toggles, radio buttons) are reachable via keyboard and gamepad
- [ ] Slider values update in real-time as player adjusts
- [ ] Difficulty tab is disabled/greyed when Settings opened from race-pause
- [ ] "Listening..." state activates on binding slot selection, captures next valid input
- [ ] Binding conflict modal appears when captured input conflicts, offers Override/Cancel
- [ ] DisplayConfirm modal appears with 15s countdown when resolution/fullscreen changed
- [ ] Apply persists all working values to PlayerPrefs and closes Settings
- [ ] Cancel restores snapshot and closes Settings without persistence
- [ ] Restore Defaults shows confirmation dialog, then resets working to factory defaults
- [ ] Save error keeps Settings open with error message, working preserved
- [ ] Back/Cancel returns to the screen that opened Settings (Title, Car Selection, or Pause)
- [ ] All text meets minimum 14px at 1080p
- [ ] All interactive elements have visible focus indicators
- [ ] Reduced Motion mode: all transitions instant, no animations

---

## Open Questions

- Web platform: are resolution/fullscreen settings available or hidden on WebGL?
- Future: cloud settings sync (Alpha) — how does this affect the Apply model?
