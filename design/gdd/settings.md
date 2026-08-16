# Settings

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Speed You Can Feel

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Local difficulty, controls, audio, display, accessibility, camera settings, and PlayerPrefs persistence. |
| MVP architecture constraints | Settings schema is versioned and changes flow through an edit-session/apply model. |
| Alpha | Optional cloud settings synchronization and subtitles when spoken content exists. |
| Beta | Not designed. |
| Release | Not designed. |

### Unassigned / Open Phase Decisions
- Preset sharing and per-track quality overrides have no assigned phase.

### Review Boundary
For MVP review, cloud synchronization and subtitles are non-blocking Alpha+ context. They block MVP approval only if the local schema or apply semantics cannot be extended safely.

## Overview

**Settings** is the centralized configuration layer that stores and applies player preferences across all game systems — difficulty level, control remapping, audio volume, display options, and accessibility features. It persists between sessions, exposes values to every gameplay system at startup, and previews supported runtime changes through a transactional edit session. Without this system, every player preference would need its own ad-hoc storage, leading to inconsistent behavior and lost configurations between sessions.

**Interaction:** Active — the player interacts with it through the Settings menu. Supported settings preview immediately; Difficulty is snapshotted only when the next race initializes.

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
| **Difficulty** | 5 data-driven profiles: Very Easy, Easy, Normal, Hard, Very Hard | Persist on Apply; consume at next race initialization |
| **Controls** | Remappable bindings for Accelerate, Brake, Steer, and `CameraToggle`; fixed reserved bindings for Confirm, Cancel, and Pause; stick inner/outer dead zone; per-channel EMA alpha | Preview immediate; persist on Apply |
| **Audio** | Master volume, Music volume, SFX volume, UI volume, Mute | Immediate |
| **Display** | Resolution, Fullscreen mode, VSync, Quality preset, Advanced quality | Immediate; resolution/fullscreen require 15-second confirmation |
| **Accessibility** | Colorblind mode (None/Protanopia/Deuteranopia/Tritanopia), Text scaling (75%–200%) | Immediate |
| **Camera** | Camera shake intensity, Motion blur (On/Off), Reduced Motion (On/Off), Show Chase HUD in Cockpit (On/Off) | Immediate |

**2. Storage**

Settings are stored as a single JSON blob in Unity's `PlayerPrefs` under the key `"OverdriveSettings"`. The blob includes a version field for migration:

```
GameSettings {
    version: int (currently 3)
    difficulty: { level: int (0-4) }
    controls: {
        bindings_json: string (stable action/binding IDs with per-slot overrides),
        stick_dead_zone_inner: float,
        stick_dead_zone_outer: float,
        accelerate_ema_alpha: float,
        brake_ema_alpha: float,
        steer_ema_alpha: float
    }
    audio: { master: float, music: float, sfx: float, ui: float, mute_music: bool, mute_sfx: bool }
    display: { resolution_w: int, resolution_h: int, fullscreen_mode: int, vsync: int, quality_preset: int, advanced: {...} }
    accessibility: { colorblind_mode: int, text_scale: float }
    camera: { shake_intensity: float, motion_blur: bool, reduced_motion: bool, show_chase_hud_in_cockpit: bool }
}
```

On first launch, factory defaults become active and the system attempts to persist them. If that initial write fails, defaults remain active for the session and a save warning is shown; the game does not crash. On subsequent launches, the primary blob is loaded and validated. If primary deserialization or validation fails, the backup key is attempted; defaults are restored only when neither key contains a valid blob.

Before Apply mutates persistence, Settings serializes and validates `working`. If a valid primary blob exists, copying and persisting it to `"OverdriveSettings_Backup"` must succeed before the primary key is overwritten. The new primary is then written and persisted. A backup-write or primary-write failure aborts Apply, keeps Settings open, preserves the last valid persisted blob, retains the current working preview for retry or Cancel, and shows a save error. If the primary write fails after the backup succeeds, Settings attempts to restore primary from the valid backup; failure of that restoration still leaves the backup intact for next-launch recovery.

Version 1 migrates `dead_zone` to `stick_dead_zone_inner`, applies defaults for stick outer threshold and per-action EMA alpha, and discards the unused vibration field. Version 2 migrates to version 3 by discarding player-owned `trigger_dead_zone_inner` and `subtitles`; trigger threshold remains Input-owned design tuning, and subtitles return only when Alpha+ spoken content defines a producer/consumer contract. Every successful migration is validated as version 3 before it may replace the primary blob.

Binding overrides are keyed by Input-owned stable action and binding IDs. If an override references an unknown ID after an asset/schema change, Input discards only that override, restores the affected slot default, and reports the fallback to Settings; all other valid overrides remain intact.

**3. Difficulty Profiles**

Car Definition stats and stat-to-physics formulas remain immutable at every difficulty. The five `DifficultyProfile` definitions are external design data; the player blob stores only the selected profile ID. Simulation resolves and snapshots the corresponding immutable profile at race initialization and supplies its fields to AI Rival and Vehicle Physics. Field names are normalized at the Simulation Architecture boundary (e.g., Settings "AI precision" becomes `ai_precision` in the internal profile). No current-race setting change mutates that snapshot.

| Level | Target observed tier-pressure gap | AI precision | AI error mult | Pace noise | Player off-track grip | Player wall speed loss | Player Experience |
|-------|----------------------------------:|-------------:|--------------:|-----------:|----------------------:|-----------------------:|-------------------|
| Very Easy | 5% | 90% | 1.5× | ±8% | 0.60 | 0.20 | Forgiving — AI is less precise and mistakes cost less |
| Easy | 15% | 95% | 1.2× | ±5% | 0.50 | 0.30 | Relaxed — tier matters but recovery remains generous |
| Normal | 25% | 100% | 1.0× | ±2% | 0.40 | 0.40 | Balanced baseline |
| Hard | 40% | 100% | 0.5× | ±0% | 0.30 | 0.50 | Challenging — precise AI and stronger mistake penalties |
| Very Hard | 60% | 100% | 0.0× | ±0% | 0.25 | 0.60 | Hardcore — near-perfect AI and full tier pressure |

The percentages are integrated balance targets, not direct stat multipliers. A controlled deterministic benchmark measures the median clean-lap deficit between a neutral Tier 4 and Tier 1 AI car on the reference track with the same predefined seed set. AI precision/error/pace values tune the observed gap; player off-track grip and wall speed loss tune mistake recovery without modifying car data, Fuel, Tire, track layout, or race length.

**4. Apply Model**

- **SettingsEditSession:** Opening Settings creates a `snapshot` of active values and an editable `working` copy.
- **Preview immediate:** Audio, supported Display values, Accessibility, and Camera apply `working` values to runtime immediately for feedback. Settings owns `SettingsInputPreviewEvaluator`, a UI-only evaluator that renders stick dead-zone and EMA response from the working control profile while Settings is open in Idle or Paused. It does not read or write SimulationInput and does not advance simulation; it applies the same stick dead-zone and EMA formulas as Input System's per-tick routine. The working control profile becomes race behavior on the first 60 Hz simulation tick after Resume or at the next race's first gameplay tick.
- **Display confirmation:** Resolution and fullscreen candidates enter `DisplayConfirm` for 15 unscaled seconds. Keep Changes accepts them into `working`; Cancel, timeout, or application focus loss restores the pre-preview display values. Apply is disabled while confirmation is pending.
- **Apply:** Uses the validated backup-first persistence sequence, commits `working` as the active profile only after persistence succeeds, and closes Settings. Difficulty becomes authoritative only at the next race initialization.
- **Cancel:** Restores `snapshot` to runtime, discards `working`, and closes Settings without persistence.
- **Restore Defaults:** After confirmation, replaces `working` with factory defaults and previews them. If factory resolution/fullscreen differs from the current display, that candidate must complete DisplayConfirm before it remains in `working`. Persistence still requires Apply.
- **Override precedence:** Performance protection has highest runtime authority and may force VFX density to Low. Reduced Motion next forces camera shake, look-ahead, dynamic FOV, and Motion Blur off. Player `working`/persisted quality and camera preferences apply only where those overrides do not suppress them. Overrides never rewrite persisted preferences.

**5. Quality Presets**

The dropdown offers 4 presets: Low, Medium, High, Ultra. Each maps to a set of URP overrides on a single render pipeline asset:

| Preset | Render Scale | Shadows | MSAA | Anisotropic | VFX Density |
|--------|-------------|---------|------|-------------|-------------|
| Low | 0.75 | Off | Off | Per Texture | Low |
| Medium | 0.85 | Soft | 2x | Forced On | Medium |
| High | 1.0 | Hard | 4x | Forced On | High |
| Ultra | 1.0 | Hard | 4x | Forced On | Ultra |

**Advanced settings** (accessible via expandable section): Individual controls for Render Scale (50%–100%), Shadow Resolution, MSAA (Off/2x/4x), and VSync (Off/On/Adaptive). Motion Blur appears in the Camera tab for player convenience but is executed by VFX.

**6. Control Remapping**

Four logical actions are remappable: Accelerate, Brake, Steer, and CameraToggle. KeyboardMouse exposes Primary and Secondary slots for Accelerate, Brake, Steer Left, Steer Right, and CameraToggle; Gamepad exposes one slot for Accelerate, Brake, analog Steer, and CameraToggle. The UI always selects one concrete slot, and keyboard Steer changes the selected 1D-axis composite part rather than the composite root. Confirm, Cancel, and Pause are fixed reserved actions: Enter / South confirms, Escape / East cancels, and Escape / Start pauses gameplay. They cannot be selected as rebinding targets, replaced, or removed. Pit entry is physical through the pit-entry zone and has no binding. Mouse remains fixed pointer input for UI and is not a race-action binding in MVP. Haptics/rumble are out of MVP scope.

Rebinding flow:
1. Player selects one concrete binding slot to rebind
2. Settings asks Input System to enter rebinding-capture mode for that stable binding ID/index — gameplay dispatch is suppressed and the next valid keyboard or gamepad control is captured
3. Input System returns Captured, Conflict, Cancelled, or Rejected
4. Confirm, Cancel, and Pause cannot enter Listening and their bindings cannot be captured, replaced, or removed. Escape or Gamepad East always cancels an active capture. Any candidate that conflicts with a fixed reserved binding is rejected immediately.
5. A non-critical conflict opens BindingConflict; player may override or cancel
6. Apply persists the working binding set to the JSON blob

**7. Defaults**

| Setting | Default Value |
|---------|---------------|
| Difficulty | Normal profile (25% target tier-pressure gap) |
| Master Volume | 0.8 |
| Music Volume | 0.7 |
| SFX Volume | 0.8 |
| UI Volume | 0.6 |
| Mute Music | Off |
| Mute SFX | Off |
| Resolution | Native (monitor's current resolution) |
| Fullscreen | FullScreenWindow |
| VSync | On |
| Quality | High (PC) / Medium (Web) |
| Text Scaling | 100% |
| Colorblind Mode | None |
| Camera Shake | 100% |
| Motion Blur | On |
| Reduced Motion | Off |
| Show Chase HUD in Cockpit | On |
| Dead Zone (Stick) | 0.15 |
| Dead Zone Outer (Stick) | 0.95 |
| EMA Alpha (Accelerate) | 0.3 |
| EMA Alpha (Brake) | 0.3 |
| EMA Alpha (Steer) | 0.5 |

### States and Transitions

| State | Description | Player Input | Simulation Impact |
|-------|-------------|-------------|-------------------|
| `Closed` | Settings not open; game runs normally | Gameplay input | None |
| `Open` | Settings edit session visible; working values previewed | Menu navigation only | No ownership change; title remains Idle and pause-menu entry remains Paused |
| `Listening` | Waiting for a candidate binding | Captures next input only | Existing Idle/Paused state retained |
| `BindingConflict` | Candidate conflicts with a non-critical binding | Confirm/Cancel only | Existing Idle/Paused state retained |
| `DisplayConfirm` | Resolution/fullscreen preview awaiting confirmation for 15 unscaled seconds | Keep Changes / Cancel | Existing Idle/Paused state retained |

**Transition rules:**

| From | To | Trigger |
|------|----|---------|
| `Closed` | `Open` | Player opens Settings from pause menu or title screen |
| `Open` | `Listening` | Player selects a binding to change |
| `Listening` | `Open` | Binding captured, cancelled, or rejected |
| `Listening` | `BindingConflict` | Candidate conflicts with a non-critical binding |
| `BindingConflict` | `Open` | Player overrides or cancels conflict |
| `Open` | `DisplayConfirm` | Player previews a resolution or fullscreen candidate |
| `DisplayConfirm` | `Open` | Keep Changes accepts candidate, or Cancel/timeout/focus loss restores pre-preview display values |
| `Open` | `Closed` | Player applies or cancels Settings |

**State behavior details:**

- **Closed → Open:** Settings creates SettingsEditSession from active GameSettings. Settings never pauses Simulation itself: Title is already Idle, and gameplay entry is available only through an already-Paused pause menu. Settings has no Countdown-specific variant; Racing-paused and Countdown-paused use the same restrictions, including Difficulty disabled for the current race.
- **Open → Listening:** Action to rebind is highlighted. "Press any key..." prompt appears. Input System enters rebinding-capture mode; gameplay dispatch is suppressed.
- **Listening → Open:** Captured, Cancelled, and Rejected outcomes return to Open with an explicit result message. Escape or Gamepad East cancels capture through the reserved UI Cancel action; reserved Confirm, Cancel, and Pause bindings are not candidates.
- **Listening → BindingConflict:** A valid non-critical duplicate binding is captured and the player may override or cancel it.
- **BindingConflict → Open:** Override clears the old non-critical binding; Cancel preserves the working binding set.
- **Open → DisplayConfirm:** The candidate resolution/fullscreen mode applies immediately, the prior display values are retained separately from `working`, and a 15-second unscaled timer begins. Keep Changes copies the candidate into `working`; every other exit restores the prior display values.

### Interactions with Other Systems

| System | Direction | Data Flow | Timing | Interface Description |
|--------|-----------|-----------|--------|----------------------|
| **Input System** | Outbound | Key bindings, stick inner/outer dead zone, per-channel EMA alpha | Preview on change; persist on Apply | Settings previews working overrides and profile at runtime. Apply persists them; Cancel restores the snapshot. Trigger dead-zone tuning is not player-owned. |
| **Simulation Architecture** | Outbound | Selected immutable `DifficultyProfile` | Race initialization | Simulation snapshots the profile and transports its fields to race consumers. Current-race difficulty never changes. |
| **AI Rival** | Indirect via Simulation | Precision, error multiplier, pace noise | Race initialization | AI consumes the snapshotted profile without changing Car Definition stats. |
| **Vehicle Physics** | Indirect via Simulation | Player off-track grip and wall speed-loss values | Race initialization | Vehicle Physics consumes only the approved recovery fields; car-stat formulas remain fixed. |
| **Audio** | Outbound | Volume percentages and mute state | Preview immediate | Audio owns conversion and routing through its AudioMixer groups; Settings does not apply a second `AudioListener.volume` attenuation path. |
| **HUD** | Outbound | Text scaling, colorblind mode, cockpit-overlay preference | Preview immediate | HUD applies accessibility values and layout preference; it does not provide display resolution. |
| **UI Menu** | Bidirectional | Settings menu navigation | On open/close | UI Menu owns the Settings screen layout. Settings system provides the data and applies changes. |
| **Camera** | Outbound | Shake intensity, Reduced Motion | Preview immediate | Camera applies shake/look-ahead/dynamic-FOV behavior; mode blending and collision avoidance remain active. |
| **VFX** | Outbound | Quality density, Motion Blur preference, Reduced Motion | Preview immediate | VFX owns execution. Simulation supplies PerformanceReduced separately; runtime overrides suppress effects without rewriting player preferences. |

## Formulas

### Observed Tier-Pressure Benchmark

`observed_tier_pressure_gap = (median_tier4_lap_time - median_tier1_lap_time) / median_tier1_lap_time`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Tier 4 median lap time | median_tier4_lap_time | seconds | >0 | Median clean-lap time for the neutral Tier 4 benchmark car under the selected profile |
| Tier 1 median lap time | median_tier1_lap_time | seconds | >0 | Median clean-lap time for the neutral Tier 1 benchmark car under the same profile |

The benchmark uses the same dry reference track, neutral AI archetype, predefined deterministic seed set, and race configuration for both cars. The measured percentage must fall within ±5 percentage points of the selected profile target. This metric tunes AI profile values; it never rewrites Car Definition stats or Vehicle Physics stat formulas.

### Text Scaling

`effective_font_size = base_font_size × text_scale`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Base Font Size | base_font_size | float | varies | Design-time font size for each UI element |
| Text Scale | text_scale | float | 0.75–2.0 | Player-selected scaling factor |

**Output Range:** 75% to 200% of base size
**Example:** Base 24px × 1.5 scale = 36px effective

## Edge Cases

- **If settings JSON is corrupted:** Attempt the backup key first. Use factory defaults only if backup also fails validation. Player sees "Settings restored to defaults" only in that final fallback.
- **If Apply cannot persist backup or primary:** Abort Apply, keep Settings open, preserve the last valid persisted blob, retain the working preview, and show a retryable save error. Never replace valid settings with defaults because a new write failed.
- **If player changes resolution to unsupported value:** Fall back to nearest supported resolution. Show warning. Never crash.
- **If display confirmation times out, is cancelled, or loses application focus:** Restore the pre-preview resolution/fullscreen values and return to Open. No persistence occurs.
- **If player remaps a key to a system key (Alt+Tab, Ctrl+Alt+Del):** Reject the binding. Show "This key combination is reserved by the operating system."
- **If two non-critical actions are bound to the same key:** Show conflict warning. Player can choose to override (old binding is cleared) or cancel.
- **If a candidate conflicts with a reserved Confirm, Cancel, or Pause binding:** Reject it immediately. Show "This navigation binding is reserved."
- **If player changes difficulty mid-race via external tool:** Ignore. Difficulty is locked at race start. Only the stored value at race start is used.
- **If WebGL localStorage is cleared (private mode, browser settings):** Settings are lost. Game falls back to defaults on next launch. No crash.
- **If audio volume is set to 0 and player unmutes that channel:** Volume returns to the stored level (not max). Each Mute toggle is independent from volume.
- **If text scaling is at maximum (200%) and UI elements overflow:** Layout reflows, substitutes a stacked layout, or exposes scrolling. No text is clipped or hidden.
- **If player opens Settings while Countdown is running:** Settings are blocked. Show "Unavailable during countdown." If the player first pauses Countdown, Settings opens through the normal pause menu with the same restrictions as Racing-paused.
- **If a gamepad reconnects during Listening:** Rebind capture consumes the candidate without changing active control scheme. The scheme may change only after Listening ends and a later meaningful input occurs outside capture.
- **If quality preset change causes shader recompile:** One-frame hitch is expected. If it exceeds 100ms, show "Applying quality settings..." loading indicator.

## Dependencies

| System | Direction | Type | Data Flow |
|--------|-----------|------|-----------|
| Input System | Outbound | Hard | Settings → Input: key bindings, stick inner/outer dead zone, and per-channel EMA alpha (previewed immediately; persisted on Apply) |
| Simulation Architecture | Outbound | Hard | Settings → SimArch: immutable DifficultyProfile at race initialization |
| AI Rival | Indirect via Simulation | Hard | DifficultyProfile → AI: precision, error multiplier, and pace noise |
| Audio | Outbound | Hard | Settings → Audio: volume levels and mute state preview immediately; persistence occurs on Apply |
| HUD | Outbound | Hard | Settings → HUD: text scaling, colorblind mode, cockpit-overlay preference |
| UI Menu | Bidirectional | Hard | Settings ↔ UI Menu: menu navigation, settings data read/write |
| Camera | Outbound | Soft | Settings → Camera: shake intensity and Reduced Motion |
| VFX | Outbound | Hard | Settings → VFX: density, Motion Blur preference, Reduced Motion; Simulation supplies PerformanceReduced separately |
| Vehicle Physics | Indirect via Simulation | Hard | DifficultyProfile → Vehicle Physics: player off-track grip and wall speed-loss values only |
| Content Pipeline | Outbound | Hard | Settings → Content Pipeline: default quality (Medium WebGL / High PC) |

## Tuning Knobs

| Knob | Default | Range | Too Low | Too High |
|------|---------|-------|---------|----------|
| Tier-pressure targets | 5/15/25/40/60% | ±5 percentage points after benchmark tuning | Difficulty bands collapse together | Tier pressure becomes punitive or unattainable |
| AI error multipliers | 1.5/1.2/1.0/0.5/0.0 | 0.0–2.0 | Hard modes remain error-prone | Easy modes look incompetent |
| AI pace noise | ±8/±5/±2/±0/±0% | 0–10% | Difficulty lacks pace texture | Outcomes become random |
| Player off-track grip | 0.60/0.50/0.40/0.30/0.25 | 0.20–0.60 | Recovery becomes punitive | Leaving track has little cost |
| Player wall speed loss | 0.20/0.30/0.40/0.50/0.60 | 0.20–0.60 | Wall contact has little cost | Contact becomes race-ending |
| Text Scale | 1.0 | 0.75–2.0 | Too small for accessibility | UI overflow, layout breaks |
| Camera Shake Intensity | 1.0 | 0.0–2.0 | No speed feedback | Motion sickness, disorientation |
| Dead Zone Inner (Stick) | 0.15 | 0.05–0.25 | Stick drift, phantom inputs | Misses small inputs |
| Dead Zone Outer (Stick) | 0.95 | 0.85–1.0 | Loses range at stick edges | Cannot reach full output |
| EMA Alpha (Steer) | 0.5 | 0.2–0.8 | Over-smoothed, unresponsive | Twitchy steering, amplifies stick noise |
| EMA Alpha (Accelerate) | 0.3 | 0.1–0.8 | Sluggish throttle response | Twitchy, no smoothing |
| EMA Alpha (Brake) | 0.3 | 0.1–0.8 | Sluggish brake response | Twitchy, no smoothing |

## Visual/Audio Requirements

The Settings menu requires UI audio feedback (button clicks, confirmation tones, rebind listening) and visual feedback (panel transitions, tab highlights, slider fills). Detailed specifications belong to the UX design phase — this GDD establishes the requirement, not the implementation.

## UI Requirements

The Settings system requires a dedicated Settings menu screen with the following layout:

**Top-level navigation:** Tab bar with 6 categories (Difficulty, Controls, Audio, Display, Accessibility, Camera)

**Per-category layout:**
- **Difficulty:** 5 radio buttons (Very Easy / Easy / Normal / Hard / Very Hard). Current selection highlighted; when an active race is paused, the category is disabled because that race already owns an immutable DifficultyProfile.
- **Controls:** KeyboardMouse tab lists Primary/Secondary slots for Accelerate, Brake, Steer Left, Steer Right, and `CameraToggle`; Gamepad lists one slot for Accelerate, Brake, analog Steer, and `CameraToggle`. Confirm, Cancel, and Pause display their fixed reserved bindings and cannot be selected. Tap/click one slot to rebind it. "Listening..." provides visual feedback. Below bindings, expose stick inner/outer dead-zone values and Accelerate/Brake/Steer EMA alpha values. Dead-zone and EMA values are shared control settings.
- **Audio:** 4 sliders (Master, Music, SFX, UI) and 2 Mute toggles (Mute Music, Mute SFX). Sliders show percentage. Each Mute toggle silences its channel independently; Master volume still applies.
- **Display:** Resolution dropdown (filtered to supported resolutions), Fullscreen dropdown (Windowed/Fullscreen Window/Exclusive), VSync toggle, Quality dropdown (Low/Medium/High/Ultra). Resolution/fullscreen preview opens the 15-second DisplayConfirm dialog. Expandable "Advanced" section contains the remaining individual controls.
- **Accessibility:** Colorblind mode dropdown (None/Protanopia/Deuteranopia/Tritanopia) and Text scaling slider (75%–200%) with live preview. Critical states retain labels/patterns and never rely on color alone.
- **Camera:** Shake intensity slider (0%–200%), Motion Blur toggle, Reduced Motion toggle, and Show Chase HUD in Cockpit toggle (On by default). Reduced Motion forces runtime shake, look-ahead, dynamic FOV, and Motion Blur off while preserving mode blending, collision avoidance, and the saved preferences. Show Chase HUD in Cockpit controls whether the eight Chase elements are added to the four-element cockpit layout.

**Bottom bar:** "Apply" button (persists working values and closes), "Cancel" button (restores snapshot and closes), "Restore Defaults" button (replaces working values with defaults after confirmation; Apply persists them).

## Acceptance Criteria

### 1. Storage

- **AC-S1:** Given no saved settings (first launch), When game starts, Then default settings loaded, all 6 categories reflect defaults.
- **AC-S2:** Given player changes any setting, When Apply succeeds, Then version-3 JSON is written to PlayerPrefs and any valid previous primary was persisted to backup first.
- **AC-S3:** Given valid settings JSON in PlayerPrefs, When game launches, Then settings loaded and applied to all systems.
- **AC-S4:** Given corrupted settings JSON, When game launches, Then backup restored; if backup also corrupt, factory defaults loaded.
- **AC-S5:** Given PlayerPrefs cannot persist the backup or primary blob, When Apply runs, Then Apply aborts, Settings remains Open, the last valid persisted blob remains recoverable, the working preview remains available for retry/Cancel, and defaults are not substituted.
- **AC-S6:** Given a valid version-1 blob, When migration runs, Then it produces a valid version-3 blob with stick inner/outer dead zone and per-action EMA defaults, without vibration, player-owned trigger threshold, or subtitles.
- **AC-S7:** Given a valid version-2 blob, When migration runs, Then it produces a valid version-3 blob that discards `trigger_dead_zone_inner` and `subtitles` while preserving all remaining supported values.

### 2. Difficulty

- **AC-D1:** Given Very Easy is selected, When the controlled tier-pressure benchmark runs, Then the measured gap is 5% ±5 percentage points and the race profile contains AI precision 90%, error multiplier 1.5, pace noise ±8%, player off-track grip 0.60, and wall speed loss 0.20.
- **AC-D2:** Given Easy is selected, When the benchmark and race initialization run, Then the measured gap is 15% ±5 percentage points and the profile values match the Easy row.
- **AC-D3:** Given Normal is selected, When the benchmark and race initialization run, Then the measured gap is 25% ±5 percentage points and the profile values match the Normal row.
- **AC-D4:** Given Hard is selected, When the benchmark and race initialization run, Then the measured gap is 40% ±5 percentage points and the profile values match the Hard row.
- **AC-D5:** Given Very Hard is selected, When the benchmark and race initialization run, Then the measured gap is 60% ±5 percentage points and the profile values match the Very Hard row.
- **AC-D6:** Given player opens Settings from a Racing-paused or Countdown-paused pause menu, When Settings opens, Then Difficulty option is disabled/grayed out.
- **AC-D7:** Given player changes Difficulty from menu outside an active race, When Apply succeeds, Then the selected profile ID is stored and used for the next race. Difficulty cannot change the current race snapshot.
- **AC-D8:** Given any DifficultyProfile, When Car Definition stats and formulas are inspected, Then they are identical to every other difficulty; only the snapshotted AI and player-recovery fields differ.

### 3. Controls

- **AC-C1:** Given player selects action to rebind, When selected, Then system enters Listening state, shows "Press a key or button...".
- **AC-C2:** Given Listening state, When player presses a valid non-conflicting key/button, Then working binding updates and state returns to Open.
- **AC-C3:** Given Listening state, When player presses Escape or Gamepad East, Then rebinding is cancelled and the previous working binding is preserved.
- **AC-C4:** Given player binds key already assigned, When conflict detected, Then prompt: "This key is bound to [action]. Reassign?"
- **AC-C5:** Given player confirms BindingConflict, When accepted, Then working binding updates, old non-critical binding is cleared, and persistence waits for Apply.
- **AC-C6:** Given player modifies one binding slot, When Apply succeeds, Then only that stable slot in the selected scheme is persisted and all other slots remain unchanged.
- **AC-C7:** Given player is in Listening, When a valid keyboard or gamepad control is pressed, Then Input System delivers it to Settings rebinding capture and not to gameplay or menu navigation.
- **AC-C8:** Given a candidate conflicts with any fixed Confirm, Cancel, or Pause binding, When validation runs, Then the candidate is rejected immediately.
- **AC-C9:** Given player selects Confirm, Cancel, or Pause in the Controls screen, When rebinding is requested, Then Listening does not begin and the fixed binding remains unchanged.
- **AC-C10:** Given stick magnitude 0.55, inner threshold 0.15, and outer threshold 0.95 in the working profile, When SettingsInputPreviewEvaluator renders it, Then normalized magnitude is exactly 0.5 without reading or writing SimulationInput.
- **AC-C11:** Given Accelerate alpha 0.3, raw input 1.0, and previous output 0.0 in the working profile, When SettingsInputPreviewEvaluator advances one preview step, Then displayed EMA output is exactly 0.3 without advancing simulation.
- **AC-C12:** Given a saved override references an unknown action or binding ID, When Input reports the fallback, Then Settings preserves every valid override, restores only the affected slot default, and exposes a non-blocking migration notice.

### 4. Audio

- **AC-A1:** Given player adjusts Master volume, When changed, Then output changes in real time.
- **AC-A2:** Given player moves Music slider from 0 to positive, When changed, Then music playback resumes.
- **AC-A3:** Given player sets SFX volume to 0, When changed, Then all sound effects silenced.
- **AC-A4:** Given player adjusts Music independently of Master, When changed, Then only music changes.
- **AC-A5:** Given player changes any audio setting, When changed, Then immediate effect, no restart.

### 5. Display

- **AC-DR1:** Given player opens Display settings, When dropdown shown, Then only supported resolutions listed.
- **AC-DR2:** Given player selects an unsupported resolution, When preview begins, Then the nearest supported resolution is used and the warning appears before DisplayConfirm.
- **AC-DR3:** Given resolution or fullscreen preview begins, When candidate applies, Then DisplayConfirm opens with 15 unscaled seconds remaining and Apply is disabled.
- **AC-DR4:** Given DisplayConfirm is active, When Keep Changes is selected, Then the candidate remains in `working` and state returns to Open without persistence.
- **AC-DR5:** Given DisplayConfirm is active, When Cancel, timeout, or focus loss occurs, Then the pre-preview display values are restored and state returns to Open without persistence.
- **AC-DR6:** Given player selects Quality Preset, When preview updates, Then rendering settings and VFX density match the preset unless a higher-priority runtime override suppresses them.
- **AC-DR7:** Given player changes an advanced setting while a preset is active, When changed, Then preset label changes to "Custom".

### 6. Accessibility

- **AC-AC1:** Given player sets text scaling to 75%, When applied, Then text renders at 75% without clipping.
- **AC-AC2:** Given player sets text scaling to 200%, When applied, Then text renders at 200%, HUD reflows.
- **AC-AC3:** Given player enables colorblind mode, When applied, Then UI/HUD colors shift to selected palette.
- **AC-AC4:** Given a critical state is displayed under any colorblind mode, When its presentation is inspected, Then a label, pattern, or shape cue remains in addition to color.
- **AC-AC5:** Given player changes an MVP accessibility setting, When changed, Then immediate effect occurs without restart.

### 7. Camera

- **AC-CAM1:** Given player adjusts shake intensity, When changed, Then effect changes in real time.
- **AC-CAM2:** Given player toggles Motion Blur while Reduced Motion is Off and no higher-priority override suppresses it, When changed, Then VFX updates Motion Blur immediately.
- **AC-CAM3:** Given player changes camera setting, When changed, Then immediate effect, no restart.
- **AC-CAM4:** Given player enables Reduced Motion, When changed, Then runtime shake, look-ahead, dynamic FOV, and Motion Blur are disabled immediately while base FOV, mode transitions, collision avoidance, and saved preferences remain unchanged.
- **AC-CAM5:** Given `Show Chase HUD in Cockpit` is On by default, When cockpit HUD is displayed, Then the eight Chase elements are visible in addition to the four cockpit elements; when Off, only the four cockpit elements remain.
- **AC-CAM6:** Given Motion Blur is saved On and Reduced Motion is enabled then disabled, When the override clears, Then Motion Blur returns to the working On preference.

### 8. State Transitions

- **AC-ST1:** Given Settings Closed, When player opens from title or a pause menu, Then transitions to Open; all categories are browsable, while Difficulty remains disabled when the pause menu belongs to an active race or Countdown.
- **AC-ST2:** Given Settings Open, When player selects binding, Then transitions to Listening.
- **AC-ST3:** Given Listening, When valid input provided, Then transitions to Open (captured or rejected) or BindingConflict (non-critical conflict).
- **AC-ST4:** Given Listening, When Escape pressed, Then transitions to Open, no change.
- **AC-ST5:** Given BindingConflict, When override is confirmed, Then old non-critical binding is cleared and state transitions to Open.
- **AC-ST6:** Given BindingConflict, When cancelled, Then working binding set is preserved and state transitions to Open.
- **AC-ST7:** Given Settings Open, When Apply persistence succeeds, Then working values become active and state transitions to Closed; when persistence fails, state remains Open under AC-S5.
- **AC-ST8:** Given Settings Open, When Cancel is pressed, Then snapshot values are restored to runtime and state transitions to Closed.
- **AC-ST9:** Given Settings Open, When a resolution or fullscreen candidate is selected, Then state transitions to DisplayConfirm; every DisplayConfirm outcome returns to Open.

### 9. Apply Model

- **AC-AM1:** Given player changes Controls/Audio/Display/Accessibility/Camera, When a working value changes, Then its supported runtime or evaluator preview updates immediately; persistence occurs only after successful Apply.
- **AC-AM2:** Given player changes Difficulty from menu outside an active race, When Apply succeeds, Then the selected profile is used at the next race initialization. Difficulty cannot change the current race snapshot.

### 10. Edge Cases

- **AC-E1:** Given WebGL localStorage is full, When Apply attempts persistence, Then a save error is shown, Apply aborts, the last valid persisted blob and backup remain recoverable, and defaults are not substituted.
- **AC-E2:** Given Countdown is running and not paused, When player opens Settings, Then it is blocked with tooltip: "Unavailable during countdown." Given Countdown is paused, Settings opens through the normal pause menu.
- **AC-E3:** Given the game closes or crashes with unapplied working settings, When it relaunches, Then the last successfully persisted primary or valid backup loads; unapplied preview values do not become authoritative.
- **AC-E4:** Given two actions bound to same key (external edit), When game loads, Then first action keeps binding, second reset to default with console warning.
- **AC-E5:** Given text scaling at 75% or 200% (boundary), When applied, Then text renders correctly at boundary.
- **AC-E6:** Given a quality preview requires shader recompile, When previewed, Then the loading indicator is shown and the menu does not appear frozen.
- **AC-E7:** Given player unmutes Music from 0 to positive, When changed, Then playback resumes from current position.
- **AC-E8:** Given player opens/closes Settings rapidly, When toggled quickly, Then no state corruption, menu responsive.
- **AC-E9:** Given player selects Restore Defaults and confirms, When preview updates, Then non-display working values match factory defaults; any changed resolution/fullscreen candidate completes DisplayConfirm before remaining in `working`, and all persistence still waits for Apply.
- **AC-E10:** Given PerformanceReduced and Reduced Motion are both active, When rendering preferences are resolved, Then PerformanceReduced owns VFX density, Reduced Motion suppresses motion effects, and persisted player values remain unchanged.
- **AC-E11:** Given a gamepad reconnects during Listening, When it sends a candidate control, Then Settings evaluates it only for rebinding and active control scheme remains unchanged until Listening ends.

## Open Questions

- **Cloud Settings Sync:** Should settings sync across devices via the network SDK's KV storage? (Alpha+ feature — not MVP; SDK deferred to ADR-0016)
- **Subtitles:** Return in Alpha+ only when spoken content defines explicit subtitle events, ownership, and presentation requirements.
- **Preset sharing:** Should players be able to share their control bindings as a code? (Nice-to-have for community)
- **Per-track quality overrides:** Should the game auto-lower quality on demanding tracks to maintain 60 FPS? (Dynamic quality scaling)
