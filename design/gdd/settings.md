# Settings

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-21
> **Implements Pillar**: Speed You Can Feel

## Overview

**Settings** is the centralized configuration layer that stores and applies player preferences across all game systems — difficulty level, control remapping, audio volume, display options, and accessibility features. It persists between sessions, exposes values to every gameplay system at startup, and allows runtime changes without requiring a restart. Without this system, every player preference would need its own ad-hoc storage, leading to inconsistent behavior and lost configurations between sessions.

**Interaction:** Active — the player interacts with it through the Settings menu. Changes take effect immediately for most settings; some require a race restart.

**Why it exists:** Without centralized settings, difficulty tuning, control remapping, and audio balance would be hardcoded — impossible to change without modifying code. The game would ship with one set of values and no way for players to customize their experience.

## Player Fantasy

**Framing:** Direct — the player opens the Settings menu and takes control of their experience. Every option is a lever they pull to make the game feel right for them.

**Emotional target:** Ownership. The player feels that this is *their* game — their controls, their difficulty, their audio balance. When they tweak the steering sensitivity and the car responds exactly how they want, they feel competent and in control.

**Anchor moment:** The first time a player remaps controls to match their muscle memory from another racing game. The game instantly feels familiar. They didn't have to adapt to Overdrive — Overdrive adapted to them.

**Pillar alignment:** Speed You Can Feel — settings ensure the controls feel right for each player. Every Short Race Matters — difficulty settings ensure the challenge is meaningful, not frustrating.

**Design test:** Does the player ever feel like the game is fighting them? If settings exist but don't solve the problem, the system has failed.

## Detailed Design

### Core Rules

**1. Setting Categories**

The Settings system organizes configuration into 6 categories:

| Category | Settings | Apply Model |
|----------|----------|-------------|
| **Difficulty** | 5 levels: Very Easy, Easy, Normal, Hard, Very Hard | Race Restart Required |
| **Controls** | Key bindings (all 6 actions), dead zone, EMA alpha, vibration | Immediate |
| **Audio** | Master volume, Music volume, SFX volume, UI volume, Mute | Immediate |
| **Display** | Resolution, Fullscreen mode, VSync, Quality preset, Advanced quality | Immediate |
| **Accessibility** | Subtitles (On/Off), Colorblind mode (None/Protanopia/Deuteranopia/Tritanopia), Text scaling (75%–200%) | Immediate |
| **Camera** | Camera shake intensity, Motion blur (On/Off) | Immediate |

**2. Storage**

Settings are stored as a single JSON blob in Unity's `PlayerPrefs` under the key `"OverdriveSettings"`. The blob includes a version field for migration:

```
GameSettings {
    version: int (currently 1)
    difficulty: { level: int (0-4) }
    controls: { bindings_json: string, dead_zone: float, ema_alpha: float, vibration: bool }
    audio: { master: float, music: float, sfx: float, ui: float, muted: bool }
    display: { resolution_w: int, resolution_h: int, fullscreen_mode: int, vsync: int, quality_preset: int, advanced: {...} }
    accessibility: { subtitles: bool, colorblind_mode: int, text_scale: float }
    camera: { shake_intensity: float, motion_blur: bool }
}
```

On first launch, default values are written. On subsequent launches, the saved file is loaded. If deserialization fails, defaults are restored and a backup key (`"OverdriveSettings_Backup"`) is attempted.

**3. Difficulty Levels**

| Level | Tier Gap (Tier 4 vs Tier 1) | Player Experience |
|-------|---------------------------|-------------------|
| Very Easy | ~5% | Forgiving — car tier barely matters, mistakes are free |
| Easy | ~15% | Relaxed — tier matters but driving skill dominates |
| Normal | ~25% | Balanced — good driving wins, tier provides meaningful edge |
| Hard | ~40% | Challenging — tier matters significantly, mastery required |
| Very Hard | ~60% | Hardcore — car tier is dominant, only expert driving compensates |

The difficulty level scales the performance gap between car tiers. It does NOT change AI behavior, track layout, or race length — only how much the car's stats matter relative to player skill.

**4. Apply Model**

- **Immediate:** Controls, Audio, Display, Accessibility, Camera. Changes take effect the instant the player changes them. No confirmation needed.
- **Race Restart Required:** Difficulty. The tier gap is calculated at race start and cannot be safely changed mid-race. A "Restart Required" badge is shown next to this setting.

**5. Quality Presets**

The dropdown offers 4 presets: Low, Medium, High, Ultra. Each maps to a set of URP overrides on a single render pipeline asset:

| Preset | Render Scale | Shadows | MSAA | Anisotropic | VFX Density |
|--------|-------------|---------|------|-------------|-------------|
| Low | 0.75 | Off | Off | Per Texture | Low |
| Medium | 0.85 | Soft | 2x | Forced On | Medium |
| High | 1.0 | Hard | 4x | Forced On | High |
| Ultra | 1.0 | Hard | 4x | Forced On | Ultra |

**Advanced settings** (accessible via expandable section): Individual controls for Render Scale (50%–100%), Shadow Resolution, MSAA (Off/2x/4x), VSync (Off/On/Adaptive), Motion Blur (On/Off).

**6. Control Remapping**

All 6 actions are remappable: Accelerate, Brake, Steer, Pit, Pause, Confirm. The system supports both keyboard and gamepad rebinding with per-scheme overrides.

Rebinding flow:
1. Player selects action to rebind
2. System enters "Listening" state — captures next input
3. New binding is validated (no conflicts with other actions)
4. If conflict exists, player is warned and can choose to override or cancel
5. Binding is saved to the JSON blob

**7. Defaults**

| Setting | Default Value |
|---------|---------------|
| Difficulty | Normal (25% gap) |
| Master Volume | 0.8 |
| Music Volume | 0.7 |
| SFX Volume | 0.8 |
| UI Volume | 0.6 |
| Resolution | Native (monitor's current resolution) |
| Fullscreen | FullScreenWindow |
| VSync | On |
| Quality | High (PC) / Medium (Web) |
| Text Scaling | 100% |
| Colorblind Mode | None |
| Subtitles | Off |
| Camera Shake | 100% |
| Motion Blur | On |
| Dead Zone (Stick) | 0.15 |
| EMA Alpha (Steer) | 0.5 |

### States and Transitions

| State | Description | Player Input | Simulation Impact |
|-------|-------------|-------------|-------------------|
| `Closed` | Settings not open; game runs normally | Gameplay input | None |
| `Open` | Settings menu visible; game paused | Menu navigation only | Simulation paused |
| `Listening` | Waiting for new key/button binding | Captures next input only | Simulation paused |
| `Confirming` | Showing "Restart Required" dialog | Confirm/Cancel only | Simulation paused |

**Transition rules:**

| From | To | Trigger |
|------|----|---------|
| `Closed` | `Open` | Player opens Settings from pause menu or title screen |
| `Open` | `Listening` | Player selects a binding to change |
| `Listening` | `Open` | New binding captured (success) or canceled (Escape) |
| `Open` | `Confirming` | Player changes Difficulty (restart required) |
| `Confirming` | `Open` | Player cancels restart dialog |
| `Confirming` | `Closed` | Player confirms restart — saves and restarts race |
| `Open` | `Closed` | Player exits Settings (changes saved) |

**State behavior details:**

- **Closed → Open:** Game pauses. Settings menu appears. Current values are loaded from the in-memory GameSettings object.
- **Open → Listening:** Action to rebind is highlighted. "Press any key..." prompt appears. All other input is suppressed.
- **Listening → Open:** New binding is validated. If conflict exists, warning is shown. Binding is saved to GameSettings.
- **Open → Confirming:** Only triggered when Difficulty is changed. Dialog shows: "Difficulty changes take effect at the next race. Restart now?"
- **Confirming → Closed:** Player confirms. Race restarts with new difficulty. GameSettings is saved to PlayerPrefs.

### Interactions with Other Systems

| System | Direction | Data Flow | Timing | Interface Description |
|--------|-----------|-----------|--------|----------------------|
| **Input System** | Outbound | Key bindings, dead zone, EMA alpha | On apply (immediate) | Settings writes rebinding JSON to Input System via `LoadBindingOverridesFromJson`. Dead zone and EMA values are read by Input System each frame. |
| **Simulation Architecture** | Outbound | Difficulty level | On race start | Simulation reads difficulty level to calculate tier gap scaling. Cannot change mid-race. |
| **Audio** | Outbound | Volume levels, mute state | On apply (immediate) | Settings writes to `AudioListener.volume` and individual AudioMixer groups. |
| **HUD** | Bidirectional | Text scaling, colorblind mode settings | On apply (immediate) | Settings provides accessibility values. HUD applies text scale and colorblind filter in real-time. |
| **UI Menu** | Bidirectional | Settings menu navigation | On open/close | UI Menu owns the Settings screen layout. Settings system provides the data and applies changes. |
| **Camera** | Outbound | Shake intensity, motion blur | On apply (immediate) | Camera reads shake intensity from Settings. Motion blur is a URP post-processing toggle. |
| **Vehicle Physics** | Indirect | Difficulty → tier gap | On race start | Vehicle Physics reads difficulty to scale car performance differences. Not a direct interface — goes through Simulation Architecture. |

## Formulas

### Difficulty Tier Gap Scaling

`effective_tier_gap = base_tier_gap × difficulty_multiplier`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Base Tier Gap | base_tier_gap | float | 0.0–1.0 | Inherent performance difference between Tier 4 and Tier 1 cars |
| Difficulty Multiplier | difficulty_multiplier | float | 0.2–2.4 | Scales the gap based on difficulty level |

| Difficulty Level | difficulty_multiplier | Effective Gap (base=0.25) |
|------------------|---------------------|--------------------------|
| Very Easy | 0.2 | 5% |
| Easy | 0.6 | 15% |
| Normal | 1.0 | 25% |
| Hard | 1.6 | 40% |
| Very Hard | 2.4 | 60% |

**Output Range:** 0.05 to 0.60 (5% to 60%)
**Example:** At Normal difficulty: effective_tier_gap = 0.25 × 1.0 = 0.25 (25%)

**Note:** The base_tier_gap (0.25) is defined in Car Definition Data GDD. This formula scales it based on difficulty. The actual stat application happens in Vehicle Physics.

### Text Scaling

`effective_font_size = base_font_size × text_scale`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Base Font Size | base_font_size | float | varies | Design-time font size for each UI element |
| Text Scale | text_scale | float | 0.75–2.0 | Player-selected scaling factor |

**Output Range:** 75% to 200% of base size
**Example:** Base 24px × 1.5 scale = 36px effective

## Edge Cases

- **If settings JSON is corrupted:** Fall back to defaults. Log warning. Attempt to load from backup key. If backup also fails, use hardcoded defaults. Player sees "Settings restored to defaults" message.
- **If player changes resolution to unsupported value:** Fall back to nearest supported resolution. Show warning. Never crash.
- **If player remaps a key to a system key (Alt+Tab, Ctrl+Alt+Del):** Reject the binding. Show "This key combination is reserved by the operating system."
- **If two actions are bound to the same key:** Show conflict warning. Player can choose to override (old binding is cleared) or cancel.
- **If player changes difficulty mid-race via external tool:** Ignore. Difficulty is locked at race start. Only the stored value at race start is used.
- **If WebGL localStorage is cleared (private mode, browser settings):** Settings are lost. Game falls back to defaults on next launch. No crash.
- **If audio volume is set to 0 and player unmutes:** Volume returns to the stored level (not max). Mute is a separate toggle from volume.
- **If text scaling is at maximum (200%) and UI elements overflow:** UI elements use `overflow: hidden` or scroll. No text is cut off — layout adapts.
- **If player opens Settings during countdown:** Settings are accessible but game state is frozen. Countdown pauses. No simulation steps fire while Settings is open.
- **If quality preset change causes shader recompile:** One-frame hitch is expected. If it exceeds 100ms, show "Applying quality settings..." loading indicator.

## Dependencies

| System | Direction | Type | Data Flow |
|--------|-----------|------|-----------|
| Input System | Outbound | Hard | Settings → Input: key bindings, dead zone, EMA alpha (on apply) |
| Simulation Architecture | Outbound | Hard | Settings → SimArch: difficulty level (on race start) |
| Audio | Outbound | Hard | Settings → Audio: volume levels, mute state (on apply) |
| HUD | Bidirectional | Hard | Settings → HUD: text scaling, colorblind mode. HUD → Settings: current display resolution for resolution picker |
| UI Menu | Bidirectional | Hard | Settings ↔ UI Menu: menu navigation, settings data read/write |
| Camera | Outbound | Soft | Settings → Camera: shake intensity, motion blur |
| Vehicle Physics | Indirect | Soft | Settings → Vehicle Physics: difficulty level (via Simulation Architecture) |

## Tuning Knobs

| Knob | Default | Range | Too Low | Too High |
|------|---------|-------|---------|----------|
| Difficulty Multiplier (Very Easy) | 0.2 | 0.0–0.4 | No tier distinction at all | Tier still matters too much for casual players |
| Difficulty Multiplier (Hard) | 1.6 | 1.2–2.0 | Not enough challenge for experienced players | Tier gap too extreme, frustrating |
| Text Scale | 1.0 | 0.75–2.0 | Too small for accessibility | UI overflow, layout breaks |
| Camera Shake Intensity | 1.0 | 0.0–2.0 | No speed feedback | Motion sickness, disorientation |
| Dead Zone Inner (Stick) | 0.15 | 0.05–0.25 | Stick drift, phantom inputs | Misses small inputs |
| EMA Alpha (Steer) | 0.5 | 0.2–0.8 | Twitchy steering | Over-smoothed, unresponsive |

## Visual/Audio Requirements

The Settings menu requires UI audio feedback (button clicks, confirmation tones, rebind listening) and visual feedback (panel transitions, tab highlights, slider fills). Detailed specifications belong to the UX design phase — this GDD establishes the requirement, not the implementation.

## UI Requirements

The Settings system requires a dedicated Settings menu screen with the following layout:

**Top-level navigation:** Tab bar with 6 categories (Difficulty, Controls, Audio, Display, Accessibility, Camera)

**Per-category layout:**
- **Difficulty:** 5 radio buttons (Very Easy / Easy / Normal / Hard / Very Hard). "Restart Required" badge next to this category. Current selection highlighted.
- **Controls:** List of 6 actions with current binding displayed. Tap/click to rebind. "Listening..." state with visual feedback. Per-scheme tabs (Keyboard / Gamepad).
- **Audio:** 5 sliders (Master, Music, SFX, UI, Mute toggle). Sliders show percentage. Mute overrides individual volumes.
- **Display:** Resolution dropdown (filtered to supported resolutions), Fullscreen dropdown (Windowed/Fullscreen Window/Exclusive), VSync toggle, Quality dropdown (Low/Medium/High/Ultra). Expandable "Advanced" section with individual controls.
- **Accessibility:** Subtitles toggle, Colorblind mode dropdown (None/Protanopia/Deuteranopia/Tritanopia), Text scaling slider (75%–200%) with live preview.
- **Camera:** Shake intensity slider (0%–200%), Motion blur toggle.

**Bottom bar:** "Apply" button (saves and closes), "Cancel" button (reverts and closes), "Restore Defaults" button (resets all to defaults with confirmation).

## Acceptance Criteria

### 1. Storage

- **AC-S1:** Given no saved settings (first launch), When game starts, Then default settings loaded, all 6 categories reflect defaults.
- **AC-S2:** Given player changes any setting, When applied, Then JSON written to PlayerPrefs with backup of previous state.
- **AC-S3:** Given valid settings JSON in PlayerPrefs, When game launches, Then settings loaded and applied to all systems.
- **AC-S4:** Given corrupted settings JSON, When game launches, Then backup restored; if backup also corrupt, factory defaults loaded.
- **AC-S5:** Given PlayerPrefs near capacity (WebGL ~5MB), When player saves, Then save completes; if full, error shown and defaults used.

### 2. Difficulty

- **AC-D1:** Given player selects "Very Easy", When race starts, Then tier gap = 5%.
- **AC-D2:** Given player selects "Easy", When race starts, Then tier gap = 15%.
- **AC-D3:** Given player selects "Normal", When race starts, Then tier gap = 25%.
- **AC-D4:** Given player selects "Hard", When race starts, Then tier gap = 40%.
- **AC-D5:** Given player selects "Very Hard", When race starts, Then tier gap = 60%.
- **AC-D6:** Given player is in a race, When opens Settings, Then Difficulty option is disabled/grayed out.
- **AC-D7:** Given player changes Difficulty from menu (not in race), When confirmed, Then change applied for next race. Difficulty cannot be changed mid-race.

### 3. Controls

- **AC-C1:** Given player selects action to rebind, When selected, Then system enters Listening state, shows "Press a key...".
- **AC-C2:** Given Listening state, When player presses valid key/button, Then binding saved, returns to Open.
- **AC-C3:** Given Listening state, When player presses Escape, Then rebinding cancelled, previous binding preserved.
- **AC-C4:** Given player binds key already assigned, When conflict detected, Then prompt: "This key is bound to [action]. Reassign?"
- **AC-C5:** Given player confirms conflict, When accepted, Then new binding saved, old binding cleared.
- **AC-C6:** Given player modifies binding, When saved, Then only current scheme modified; Input System overrides applied.
- **AC-C7:** Given player in Controls menu, When bound key pressed, Then key NOT consumed by menu (input passthrough disabled during rebinding).

### 4. Audio

- **AC-A1:** Given player adjusts Master volume, When changed, Then output changes in real time.
- **AC-A2:** Given player moves Music slider from 0 to positive, When changed, Then music playback resumes.
- **AC-A3:** Given player sets SFX volume to 0, When changed, Then all sound effects silenced.
- **AC-A4:** Given player adjusts Music independently of Master, When changed, Then only music changes.
- **AC-A5:** Given player changes any audio setting, When changed, Then immediate effect, no restart.

### 5. Display

- **AC-DR1:** Given player opens Display settings, When dropdown shown, Then only supported resolutions listed.
- **AC-DR2:** Given player selects unsupported resolution, When applied, Then nearest supported used, warning shown.
- **AC-DR3:** Given player toggles Fullscreen, When applied, Then switches without crash or artifact.
- **AC-DR4:** Given player selects Quality Preset, When applied, Then all rendering settings update to preset values.
- **AC-DR5:** Given player changes advanced setting while preset active, When changed, Then preset label changes to "Custom".

### 6. Accessibility

- **AC-AC1:** Given player sets text scaling to 75%, When applied, Then text renders at 75% without clipping.
- **AC-AC2:** Given player sets text scaling to 200%, When applied, Then text renders at 200%, HUD reflows.
- **AC-AC3:** Given player enables colorblind mode, When applied, Then UI/HUD colors shift to selected palette.
- **AC-AC4:** Given player enables subtitles, When dialogue plays, Then subtitles appear with speaker ID.
- **AC-AC5:** Given player changes accessibility setting, When changed, Then immediate effect, no restart.

### 7. Camera

- **AC-CAM1:** Given player adjusts shake intensity, When changed, Then effect changes in real time.
- **AC-CAM2:** Given player toggles motion blur, When changed, Then URP post-processing updates immediately.
- **AC-CAM3:** Given player changes camera setting, When changed, Then immediate effect, no restart.

### 8. State Transitions

- **AC-ST1:** Given Settings Closed, When player opens, Then transitions to Open, all categories browsable.
- **AC-ST2:** Given Settings Open, When player selects binding, Then transitions to Listening.
- **AC-ST3:** Given Listening, When valid input provided, Then transitions to Open (no conflict) or Confirming (conflict).
- **AC-ST4:** Given Listening, When Escape pressed, Then transitions to Open, no change.
- **AC-ST5:** Given Confirming, When confirmed, Then binding saved, transitions to Open.
- **AC-ST6:** Given Confirming, When cancelled, Then binding reverted, transitions to Open.
- **AC-ST7:** Given Settings Open, When player closes, Then transitions to Closed, immediate changes persisted.

### 9. Apply Model

- **AC-AM1:** Given player changes Controls/Audio/Display/Accessibility/Camera, When confirmed, Then applied immediately.
- **AC-AM2:** Given player changes Difficulty from menu (not in race), When confirmed, Then change applied for next race. Difficulty cannot be changed mid-race.

### 10. Edge Cases

- **AC-E1:** Given WebGL localStorage near limit, When save attempted, Then save completes; if fails, error shown, defaults used.
- **AC-E2:** Given player in countdown (3-2-1), When opens Settings, Then blocked, tooltip: "Unavailable during countdown."
- **AC-E3:** Given game crashes with modified settings, When relaunches, Then last saved settings loaded (backup recovery).
- **AC-E4:** Given two actions bound to same key (external edit), When game loads, Then first action keeps binding, second reset to default with console warning.
- **AC-E5:** Given text scaling at 75% or 200% (boundary), When applied, Then text renders correctly at boundary.
- **AC-E6:** Given display change requiring shader recompile, When applied, Then loading indicator shown, no freeze.
- **AC-E7:** Given player unmutes Music from 0 to positive, When changed, Then playback resumes from current position.
- **AC-E8:** Given player opens/closes Settings rapidly, When toggled quickly, Then no state corruption, menu responsive.

## Open Questions

- **Cloud Settings Sync:** Should settings sync across devices via Coherence KV storage? (Alpha+ feature — not MVP)
- **Preset sharing:** Should players be able to share their control bindings as a code? (Nice-to-have for community)
- **Per-track quality overrides:** Should the game auto-lower quality on demanding tracks to maintain 60 FPS? (Dynamic quality scaling)
