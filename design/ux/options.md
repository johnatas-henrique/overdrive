# UX Spec: Options (Settings Screen)

> **Status**: In Design
> **Author**: ux-designer
> **Last Updated**: 2026-06-22
> **Journey Phase(s)**: First Contact, Orientation
> **Platform Target**: PC (web — Electron/Tauri)
> **Template**: UX Spec

---

## Purpose & Player Need

The player needs to adjust game settings to their personal preference: audio levels, control mapping, and accessibility options.

**What would go wrong without it**: Player cannot adjust volume, cannot remap controls to their preferred layout, and cannot enable accessibility features (colorblind mode, simplified HUD). For players with accessibility needs, the game is unplayable without these options.

---

## Player Context on Arrival

Two entry points, two different contexts:

| Entry              | Context                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **From Pause**     | Player was mid-race. Emotional state: interrupted. They want a quick adjustment (volume, toggle accessibility) and get back to racing.                      |
| **From Main Menu** | Player is at Title or Car Select. Emotional state: preparatory. They want to configure controls, set preferred difficulty, or adjust video before starting. |

---

## Navigation Position

**From Pause**: `[Racing] → [Pause Overlay] → [Options]`
**From Main Menu**: `[Title / Car Select / Race Setup] → [Options]`

The Options screen is a full-screen replacement (not overlay). It pushes onto the screen stack from whichever screen invoked it. ESC/B pops back to the previous screen.

```
Pause ──Options──▶ Options Screen ──ESC──▶ Pause
Title ──Options──▶ Options Screen ──ESC──▶ Title
Car Select ──Options──▶ Options Screen ──ESC──▶ Car Select
```

All settings changes applied immediately (no "Apply" button required). Only accessibility settings that affect rendering (colorblind mode) take effect on next relevant screen redraw.

---

## Entry & Exit Points

| Entry Source  | Trigger              | Context Preserved                                   |
| ------------- | -------------------- | --------------------------------------------------- |
| Main Menu     | Click Options button | —. Player returns to Main Menu on exit.             |
| Pause overlay | Click Options button | Race state frozen. Player returns to Pause on exit. |

| Exit Destination     | Trigger | Notes                                                 |
| -------------------- | ------- | ----------------------------------------------------- |
| Previous screen      | ESC / B | All settings already applied — no confirmation needed |
| Pause (if from race) | ESC / B | Back to frozen pause overlay. Race state unchanged.   |

---

## Layout Specification

### Sections Overview

Left sidebar with section tabs (vertical list). Right content area changes per selected section. Misto dark-panel style per art bible (same as Menu screens).

### Audio Section

| Control      | Type   | Range  | Default | Notes                                 |
| ------------ | ------ | ------ | ------- | ------------------------------------- |
| Music volume | Slider | 0–100% | 80%     | Controls menu music volume            |
| SFX volume   | Slider | 0–100% | 100%    | Controls engine, collision, UI sounds |

No master volume in MVP — post-MVP if needed. Sliders update immediately (no confirm).

### Controls Section

| Control       | Type         | Range               | Default          | Notes                                                                        |
| ------------- | ------------ | ------------------- | ---------------- | ---------------------------------------------------------------------------- |
| Steering axis | Remap target | Axis input          | Left stick       | Player presses new key/button to bind                                        |
| Throttle      | Remap target | Axis input          | Right trigger    |                                                                              |
| Brake         | Remap target | Axis input          | Left trigger     |                                                                              |
| Gear up       | Remap target | Button              | Right bumper / E |                                                                              |
| Gear down     | Remap target | Button              | Left bumper / Q  |                                                                              |
| Camera toggle | Remap target | Button              | C                |                                                                              |
| Pause         | Remap target | Button              | ESC / Start      | Cannot be unbound                                                            |
| Confirm       | Remap target | Button              | ENTER / A        | Cannot be unbound                                                            |
| Cancel        | Remap target | Button              | ESC / B          | Cannot be unbound                                                            |
| Dead zone     | Slider       | 0.0–0.5 (step 0.05) | 0.15             | Adjusts analog stick dead zone (accessibility-requirements.md Standard tier) |

Remapping flow: select control → press new key/button → binding updates immediately. Conflicts resolved by unbinding the old mapping (last-assigned wins). Pause/Confirm/Cancel cannot be unbound (minimum navigation guarantee). If the player presses ESC during capture mode, the remap is cancelled and the previous binding is restored.

### Accessibility Section

| Control         | Type     | Options                                   | Default | Notes                                      |
| --------------- | -------- | ----------------------------------------- | ------- | ------------------------------------------ |
| Colorblind mode | Dropdown | Off, Protanopia, Deuteranopia, Tritanopia | Off     | Affects UI colours only (not track/world)  |
| Simplified HUD  | Toggle   | ON/OFF                                    | OFF     | Hides minimap + position change indicators |
| Invert look     | Toggle   | ON/OFF                                    | OFF     | Inverts camera Y-axis in chase/cockpit     |

### Video Section

Not included in MVP Options. Only Audio, Controls, and Accessibility tabs exist in Phase 1.

---

## States & Variants

| State                   | Trigger                             | What Changes                                                                    |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------- |
| **Default**             | Enter Options                       | Audio section shown by default (first tab)                                      |
| **Section switch**      | Player clicks/tabs another section  | Content area replaces with selected section                                     |
| **Remapping active**    | Player clicks "Change" on a control | Current binding text replaced by "Press key/button..." — input listening active |
| **Remapping cancelled** | Player presses ESC during remapping | Capture cancelled. Previous binding restored. Display returns to default.       |
| **Remapping complete**  | Player presses a key/button         | New binding saved, display updates                                              |

---

## Interaction Map

| Component          | Action   | Keyboard   | Gamepad          | Feedback                                                | Outcome                                           |
| ------------------ | -------- | ---------- | ---------------- | ------------------------------------------------------- | ------------------------------------------------- |
| Section tabs       | Navigate | ▲ ▼ arrows | D-pad up/down    | Highlight moves between sections                        | Content area updates                              |
| Tab select         | Select   | ENTER      | A                | Content area switches                                   | Active section highlighted                        |
| Slider             | Adjust   | ◀ ▶ arrows | D-pad left/right | Value changes in real time                              | Setting applied immediately                       |
| Remap button       | Select   | ENTER      | A                | Text becomes "Press key..."                             | Input capture mode                                |
| Remap capture mode | Cancel   | ESC        | B                | Text reverts to previous binding                        | Capture cancelled, existing binding preserved     |
| Remap conflict     | —        | —          | —                | Brief flash + "Conflict: [action] reassigned" indicator | Last-assigned wins, old action returns to default |
| Toggle             | Toggle   | ENTER      | A                | Toggle switches ON/OFF                                  | Setting applied immediately                       |
| Back               | Exit     | ESC        | B                | —                                                       | Returns to previous screen                        |

---

## Events Fired

| Player Action        | Event                                  | Payload                                | Notes                                        |
| -------------------- | -------------------------------------- | -------------------------------------- | -------------------------------------------- |
| Change volume        | Persistence save                       | `audio.musicVolume`, `audio.sfxVolume` | Persisted via IPersistence                   |
| Remap control        | Persistence save + Input config update | `input.bindings[action]`               | Updated in Config Manager namespace          |
| Remap cancel         | —                                      | —                                      | No event — input reverts to previous binding |
| Adjust dead zone     | Persistence save                       | `input.deadZone`                       | Persisted via IPersistence                   |
| Toggle accessibility | Persistence save                       | `accessibility.*`                      | Rendered immediately on affected screens     |

---

## Transitions & Animations

| Transition     | Method               | Duration | Notes                      |
| -------------- | -------------------- | -------- | -------------------------- |
| Enter Options  | Instant (push)       | 0ms      | No fade                    |
| Section switch | Instant content swap | 0ms      | No crossfade               |
| Exit Options   | Instant (pop)        | 0ms      | Returns to previous screen |

---

## Data Requirements

| Data                | Source System              | Read / Write | Notes                                |
| ------------------- | -------------------------- | ------------ | ------------------------------------ |
| Audio volumes       | IPersistence               | Read/Write   | Read on init, write on slider change |
| Control bindings    | Config Manager (`input.*`) | Read/Write   | Read on init, write on remap         |
| Accessibility prefs | IPersistence               | Read/Write   | Colorblind mode, HUD toggle, invert  |

---

## Accessibility

Standard tier (MVP launch).

| Requirement         | Implementation                                                 |
| ------------------- | -------------------------------------------------------------- |
| Keyboard navigation | ▲ ▼ ◀ ▶ for tabs/sliders/toggles. ENTER to remap. ESC to exit. |
| Focus indicators    | Visible outline on focused slider, tab, toggle, remap button   |
| Text contrast       | White on #0d0d0f — WCAG AA                                     |
| Colorblind mode     | Available within this screen — 3 presets testing in MVP        |
| Reduced motion      | N/A — instant transitions only                                 |

---

## Localization Considerations

| Section       | Elements                                           | Layout Risk             |
| ------------- | -------------------------------------------------- | ----------------------- |
| General       | "OPTIONS", "AUDIO", "CONTROLS", "ACCESSIBILITY"    | Low — single words      |
| Audio         | "Music volume", "SFX volume"                       | Low                     |
| Controls      | Action names (Steering, Throttle, etc.)            | Low — common game terms |
| Accessibility | "Colorblind mode", "Simplified HUD", "Invert look" | Low — short phrases     |

---

## Acceptance Criteria

- [ ] Options accessible from both Main Menu (Options button) and Pause overlay (Options button)
- [ ] Main Menu entry returns to Main Menu on ESC; Pause entry returns to Pause on ESC
- [ ] Three section tabs visible: Audio, Controls, Accessibility — Audio selected by default
- [ ] Music and SFX volume sliders adjust levels in real time
- [ ] Control remapping: select action → press key/button → binding updates immediately
- [ ] Pause/Confirm/Cancel cannot be unbound
- [ ] Colorblind mode dropdown (Off, Protanopia, Deuteranopia, Tritanopia) affects UI colours
- [ ] Simplified HUD toggle hides minimap and position change indicators
- [ ] Invert look toggle inverts camera Y-axis
- [ ] All settings persist through session restart (localStorage)
- [ ] ESC returns to previous screen (Pause or Menu)
- [ ] All interactive elements reachable via keyboard-only navigation

---

## Open Questions

| Question                                                                                | Owner         | Deadline | Resolution                                   |
| --------------------------------------------------------------------------------------- | ------------- | -------- | -------------------------------------------- |
| Where in Main Menu is Options accessible? Title screen button, or only from Car Select? | game-designer | Alpha    | [Accessible from Title via dedicated button] |
| Remapping conflict resolution — warn player or just overwrite?                          | ux-designer   | MVP      | [Overwrite silently — last-assigned wins]    |
| Colorblind mode presets: need to define palette swaps per mode                          | art-director  | Alpha    | [Deferred to Alpha implementation]           |
