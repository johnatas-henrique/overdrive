# Accessibility Requirements: Overdrive

> **Status**: Committed
> **Author**: User + Agents
> **Last Updated**: 2026-07-28
> **Accessibility Tier Target**: Standard
> **Platform(s)**: PC, Web
> **External Standards Targeted**:
> - WCAG 2.1 Level A
> - AbleGamers CVAA Guidelines (partial)
> **Accessibility Consultant**: None engaged
> **Linked Documents**: `design/gdd/systems-index.md`, `docs/architecture/control-manifest.md`, `docs/architecture/adr-0005-input-context-controller-and-action-map-inventory.md`, `design/art/art-bible.md`

---

## Accessibility Features Matrix

| # | Feature | Status | Requirement Source |
|---|---------|--------|-------------------|
| A1 | Full control remapping (actions except Confirm/Cancel/Pause) | Required | ADR-0005 |
| A2 | Reserved actions (Confirm, Cancel, Pause) not rebindable | Required | ADR-0005 |
| A3 | Keyboard/Mouse + Gamepad parity (both complete control schemes) | Required | ADR-0005, technical-preferences.md |
| A4 | Colorblind-safe backup palette | Required | art-bible.md §2 |
| A5 | Text scaling (minimum 14px, Spline Sans UI font) | Required | art-bible.md §6 |
| A6 | Reduced motion option (CameraSettings.ReducedMotion) | Required | ADR-0010 |
| A7 | Difficulty profiles (5 tiers: Very Easy through Very Hard) | Required | ADR-0004 |
| A8 | Pause at any gameplay moment | Required | ADR-0005 |
| A9 | Keyboard navigation in all menus (no mouse-only screens) | Required | ADR-0005, technical-preferences.md |
| A10 | Visual indicators for essential audio cues (engine state, pit status, countdown) | Recommended | — |
| A11 | UI text with high contrast against backgrounds (no color-only state indication) | Required | art-bible.md §9 |
| A12 | Settings persistence with factory-defaults recovery on corruption | Required | ADR-0004 |

---

## Feature Details

### A1 — Full Control Remapping

All actions in both action maps (`OverdriveGameplay`, `OverdriveUI`) are rebindable except the three reserved actions (Confirm, Cancel, Pause). Rebinding is accessible via Settings → Controls → Listening mode. Dead-zone and EMA alpha values are independently configurable per action and per device type.

Keyboard and gamepad bindings are stored independently. Resetting bindings to defaults is a one-action restore.

### A2 — Reserved Actions

- **Confirm** (Enter/South): Cannot be unbound or reassigned. Fixed for UI module Submit.
- **Cancel** (Escape/East): Cannot be unbound or reassigned. Fixed for UI module Cancel.
- **Pause** (Escape/Start during gameplay, P/Start during Finished): Cannot be unbound or reassigned.

All three are reserved because they trigger input-module-level behavior (InputSystemUIInputModule Submit/Cancel routing) that would break if reassigned. See ADR-0005 §4.1.

### A3 — Keyboard/Mouse + Gamepad Parity

Both input methods support every gameplay action. Mouse is UI-only (hover, click, pointer selection) — never produces Accelerate, Brake, or Steer. Gamepad and keyboard are equivalent complete-control schemes.

Active scheme arbitration: last significant device wins. UI adapts prompts to active scheme (keyboard keys or gamepad button icons).

### A4 — Colorblind-Safe Palette

Art bible defines a parallel colorblind-safe palette for all status indicators. Color is never the sole carrier of information — every state indicated by color also has a text label, icon, or position indicator.

**High-risk areas:**
- Tire wear indicator: percentage readout + color gradient (green/yellow/red). Colorblind mode adds pattern overlay or icon state.
- Fuel indicator: percentage readout + color. Empty state has pulsing icon.
- PIT THIS LAP advisory: text label, not color-only.

### A5 — Text Scaling

UI font (Spline Sans) minimum 14px in all menus and HUD. Players can scale UI text via Settings → Display → UI Scale (90-150%, in 10% increments). HUD text (Gemunu Libre) scales independently (90-130%).

Text scaling affects all menu text, dialogue, and settings labels. It does not affect HUD layout — element positions are fixed; only font size increases within the element bounds.

### A6 — Reduced Motion

When enabled (Settings → Accessibility → Reduced Motion):
- Camera shake is disabled entirely
- Speed lines are disabled
- Confetti particle bursts are disabled
- LCD-style bar transitions remain (stepped, not animated)
- All menu transitions remain (slide/fade — these are functional, not decorative)

ReducedMotion is defined in `CameraSettings` and read by both CameraSystem and VfxSystem per ADR-0010.

### A7 — Difficulty Profiles

Five profiles: Very Easy, Easy, Normal, Hard, Very Hard. Each is a ScriptableObject asset defining AI aggression, pace, error margins, fuel consumption rate modifier, and tire wear modifier.

Difficulty is immutable per race — snapshotted at race initialization. Cannot be changed mid-race (per ADR-0004). Players may change difficulty between races or during pause → Settings (excluding Difficulty while mid-race).

### A8 — Pause

Pause (Escape/Start) is available during all gameplay contexts (Countdown, Racing, Qualifying, Finished Presentation). Pause during Countdown freezes the countdown timer and resumes from prior time. Pause during Racing opens the pause menu with Settings (Difficulty disabled), Return to Race, and Return to Menu (Forfeit).

### A9 — Keyboard Navigation

All menu screens are fully navigable by keyboard without a mouse. Tab/Arrow keys navigate between elements. Enter/South confirms, Escape/East cancels. No screen or action requires mouse-only interaction.

### A10 — Visual Audio Cues (Recommended)

Race-critical audio events that lack a natural visual equivalent should have a visual indicator:
- **Countdown beeps**: Visual countdown numbers on screen (already in HUD).
- **Pit-in advisory**: "PIT THIS LAP" text (already in HUD).
- **Low-fuel warning**: Fuel bar turns red + percentage pulses (already in HUD).
- **Tire critical**: Tire bar turns red + percentage pulses (already in HUD).
- **Engine RPM**: Tachometer or gear indicator in cockpit view (already in HUD).

No additional audio-specific visual cues are required at Standard tier. All essential race information is already represented visually in the HUD.

### A11 — High Contrast UI Text

All UI text and HUD numbers render on a solid or semi-opaque background (#1A1A1A at 85% on HUD, 90% on menu overlays). Status is never conveyed by color alone — text labels, percentages, and icons accompany every color-coded state.

### A12 — Settings Persistence with Recovery

Settings are persisted as a single PlayerPrefs JSON blob with backup-first write (ADR-0004). On corruption or loss, the backup blob is loaded. If both blobs are corrupt, factory defaults are loaded and the player receives a one-time "Settings restored to defaults" message.

---

## Testing Requirements

| # | Test | Method |
|---|------|--------|
| T1 | Verify all actions are rebindable (except 3 reserved) in Settings → Controls | Manual QA |
| T2 | Verify keyboard-only navigation completes all menu flows without mouse | Manual QA |
| T3 | Verify colorblind-safe palette renders correctly on all state indicators | Manual QA + screenshot |
| T4 | Verify ReducedMotion disables shake, speed lines, and confetti | Manual QA |
| T5 | Verify UI text at minimum and maximum scale settings is readable and not clipped | Manual QA |
| T6 | Verify all 5 difficulty profiles produce distinguishable AI behavior | PlayMode test |
| T7 | Verify Pause is available during Countdown, Racing, Qualifying, Finished | Manual QA |
| T8 | Verify Settings persistence survives crash (backup blob loads on next launch) | PlayMode test |
| T9 | Verify gamepad and keyboard produce equivalent control (same race, same seed) | EditMode test |
| T10 | Verify no status indicator uses color as sole information carrier | Code review |

---

## Tier Criteria

| Criterion | Status | Notes |
|-----------|--------|-------|
| Full control remapping | ✅ | All non-reserved actions rebindable |
| Colorblind-safe visuals | ✅ | Palette defined, no color-only indicators |
| Text scaling | ✅ | 90-150% UI scale, 90-130% HUD scale |
| Reduced motion | ✅ | Camera shake toggle |
| Difficulty options | ✅ | 5 profiles |
| Keyboard navigation | ✅ | All menus accessible without mouse |
| Pause at any time | ✅ | Gameplay pause reserved |
| Settings persistence + recovery | ✅ | Backup-first write |
| Audio cue visual equivalents | ⚠️ Recommended | All essential race info already in HUD |
| Subtitles/captions | ❌ Out of scope | No dialogue in MVP (Standard tier) |
| Screen reader support | ❌ Out of scope | Not targeted at Standard tier |
| High-contrast mode | ❌ Out of scope | UI text contrast sufficient at Standard tier |
