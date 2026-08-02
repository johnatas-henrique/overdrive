# Overdrive — Interaction Patterns

> **Status**: Initialized
> **Source**: ADR-0005 (Input Context Controller), game-concept.md, systems-index
> **Last Updated**: 2026-07-29
> **Platform Target**: PC, Web

## Pattern Catalog

| # | Pattern | Category | Used In |
|---|---------|----------|---------|
| 1 | Accelerate | Gameplay | Race, Qualifying, Countdown |
| 2 | Brake | Gameplay | Race, Qualifying, Countdown |
| 3 | Steer | Gameplay | Race, Qualifying, Countdown |
| 4 | CameraToggle | Gameplay | Race, Qualifying |
| 5 | Pause | Gameplay + UI | All contexts |
| 6 | Confirm | UI | All menus, Qualifying Results, Race Results |
| 7 | Cancel | UI | All menus except root screens |
| 8 | Navigate | UI | All menus |
| 9 | Device Switch | System | All contexts |
| 10 | Pit Entry | Gameplay | Race (pit lane) |
| 11 | Pit Service | Gameplay | Race (pit box) |
| 12 | Gameplay → UI | Context Handoff | Pause, Pit entry, Menu open |
| 13 | UI → Gameplay | Context Handoff | Resume, Race start, Pit exit |
| 14 | Focus Loss | System | All contexts |
| 15 | Confirmation Modal | UI | Pause Menu (Return to Menu) |

---

## Animation Standards

| Animation | Duration | Easing | Reduced Motion |
|-----------|----------|--------|----------------|
| Screen enter (push) | 300ms | Ease-out | Instant (0ms) |
| Screen exit (pop) | 300ms | Ease-in | Instant (0ms) |
| Tab switch crossfade | 200ms | Linear | Instant (0ms) |
| Tab underline slide | 150ms | Ease-out | Instant (0ms) |
| Button focus scale | 150ms | Ease-out | Outline only (no scale) |
| Button press feedback | 200ms | Ease-in-out | Outline flash only |
| Modal fade in | 200ms | Linear | Instant (0ms) |
| Modal fade out | 200ms | Linear | Instant (0ms) |
| Toggle knob slide | 150ms | Ease-out | Instant (0ms) |
| Slider handle follow | Immediate | N/A | N/A |
| Stagger fade-in (per row) | 100ms | Linear | Instant (0ms) |
| Player highlight pulse | Loop 1s | Ease-in-out | Static outline |
| Loading spinner | Loop 1.5s | Linear | Static icon |
| Error banner fade in | 200ms | Linear | Instant (0ms) |
| Screen fade to black | 300ms | Linear | Instant (0ms) |

**Global rule:** All animations respect the Reduced Motion setting. When enabled, all transitions become instant (0ms), all loops stop, all pulses become static.

---

## Sound Standards

| Sound | Trigger | Volume Category | Reduced Motion |
|-------|---------|-----------------|----------------|
| Button click | Confirm/Cancel press | UI | Play (non-motion) |
| Tab switch | Tab change | UI | Play (non-motion) |
| Slider tick | Slider value change | UI | Play (non-motion) |
| Dropdown open/close | Dropdown toggle | UI | Play (non-motion) |
| Error buzz | Invalid action / binding conflict | UI | Play (non-motion) |
| Success chime | Apply success | UI | Play (non-motion) |
| Screen whoosh | Screen enter/exit | UI | Play (non-motion) |
| Countdown beep | Each light (1-4) | SFX | Play (non-motion) |
| Countdown GO | Fifth light off | SFX | Play (non-motion) |
| Engine idle | Menu background | Ambient | Play (non-motion) |
| Crowd murmur | Menu background | Ambient | Play (non-motion) |

**Global rule:** Sound is independent of Reduced Motion. Reduced Motion only affects visual animations, not audio.

---

## Core Gameplay Patterns

### Accelerate

- **Input**: Right trigger / W / Up arrow
- **Action Map**: OverdriveGameplay
- **Behavior**: Analog input, EMA smoothing (α=0.3), brake priority (brake active → accelerate = 0)
- **When to Use**: Any context where the player drives the car forward (Race, Qualifying, Countdown grid lock)
- **When NOT to Use**: Menus, Pit Service (no player control), Results, Qualifying Results

### Brake

- **Input**: Left trigger / S / Down arrow
- **Action Map**: OverdriveGameplay
- **Behavior**: Analog input, EMA smoothing (α=0.3), freezes accelerate EMA while active
- **When to Use**: Any context where the player decelerates or stops the car
- **When NOT to Use**: Menus, Pit Service, Results, Qualifying Results

### Steer

- **Input**: Left stick / A/D / Left/Right arrows
- **Action Map**: OverdriveGameplay
- **Behavior**: Analog input, EMA smoothing (α=0.5). Keyboard is binary (-1/0/+1), gamepad is analog radial.
- **When to Use**: Any context where the player steers the car
- **When NOT to Use**: Menus, Pit Service, Results, Qualifying Results

### CameraToggle

- **Input**: C / gamepad North-Y-Triangle (per input-system.md default bindings)
- **Action Map**: OverdriveGameplay
- **Behavior**: Presentation-only, rising edge, one toggle per press. Never enters SimulationInput. Cycles: Chase → Cockpit → Chase.
- **When to Use**: Race, Qualifying — when the player wants to switch camera view
- **When NOT to Use**: Menus, Pit Service, Countdown (camera is fixed), Results

### Pause

- **Input**: Escape / Start
- **Action Map**: Both (OverdriveGameplay + OverdriveUI)
- **Behavior**: Fixed across ALL contexts — cannot be remapped, replaced, or removed. During gameplay: pauses simulation. During menus: opens pause menu.
- **When to Use**: Any gameplay context where the player needs to pause
- **When NOT to Use**: Never disabled — Pause is always available

---

## UI Patterns

### Confirm

- **Input**: Enter / South (A on Xbox, Cross on PlayStation)
- **Action Map**: OverdriveUI
- **Behavior**: Submit action. Also used to skip Finished Presentation, confirm pit exit, confirm menu selections.
- **When to Use**: Any menu selection, button activation, modal confirmation, screen advancement
- **When NOT to Use**: During active gameplay (Confirm is UI-only, not gameplay)

### Cancel

- **Input**: Escape / East (B on Xbox, Circle on PlayStation)
- **Action Map**: OverdriveUI
- **Behavior**: Back action. Returns to previous menu, closes modal, cancels selection.
- **When to Use**: Any menu navigation back, modal dismissal, selection cancellation
- **When NOT to Use**: Root screens (Title, Qualifying Results, Race Results) — Cancel is no-op

### Navigate

- **Input**: D-pad / Left stick / Arrow keys / WASD
- **Action Map**: OverdriveUI
- **Behavior**: Menu navigation — vertical/horizontal lists, tab switching, slider adjustment.
- **When to Use**: Any menu with multiple interactive elements
- **When NOT to Use**: Screens with single action (Qualifying Results, Race Results)

### Confirmation Modal

- **Input**: Enter/South (Yes) / Escape/East (No)
- **Action Map**: OverdriveUI
- **Behavior**: Overlay modal for destructive/irreversible actions. Dark semi-transparent background, centered panel, 2 buttons (Yes/No). Focus defaults to "No" for safety. Modal blocks all background interaction.
- **When to Use**: Destructive actions that cannot be undone (Return to Menu/Forfeit, Delete Save, Quit Race)
- **When NOT to Use**: Safe actions (Resume, Settings, Confirm Selection) — use direct Confirm pattern
- **Used In**: Pause Menu (Return to Menu confirmation)

### Device Switch

- **Detection**: Last significant input device
- **Behavior**: Changes ActiveScheme on InputContextController. KeyboardMouse is default on desktop until first meaningful gamepad input.
- **When to Use**: Automatic — triggers on any input device change
- **When NOT to Use**: Never disabled — always active

---

## Pit Service Patterns

### Pit Entry

- **Trigger**: Physical — drive car into pit entry zone
- **Behavior**: VP detects entry → sets CarState.PitPhase → PitStopSystem transitions through phases
- **Toggle/Exit**: Confirm during PitService → early exit with partial fuel
- **When to Use**: Race only — when player drives into pit entry zone
- **When NOT to Use**: Qualifying (no pit stops), menus, Countdown

### Pit Service

- **Phase**: InPitBox
- **State**: No player control during service (FOV fixed at 60°)
- **Timer**: Minimum 2s (tire swap) + fueling at 0.8 L/s
- **Exit Condition**: Player may exit after 2s; AI waits for full tank
- **When to Use**: Race only — when car is in pit box
- **When NOT to Use**: Qualifying, menus, Countdown

---

## Context Handoff Patterns

### Gameplay → UI

- **Trigger**: Pause, Pit entry, Menu open
- **Behavior**: InputContextController disables OverdriveGameplay, enables OverdriveUI. Held controls are latched until release. EMA reinitializes on return.
- **When to Use**: Any transition from gameplay to menu/pause
- **When NOT to Use**: Never disabled — always fires on context switch

### UI → Gameplay

- **Trigger**: Resume, Race start, Pit exit
- **Behavior**: InputContextController disables OverdriveUI, enables OverdriveGameplay. EMA reinitializes from current raw values. Pending pauseEdge cleared.
- **When to Use**: Any transition from menu/pause to gameplay
- **When NOT to Use**: Never disabled — always fires on context switch

### Focus Loss

- **Trigger**: Alt+Tab, window lost focus
- **Behavior**: Immediate pause (no tick boundary). Accumulator remainder preserved. Never auto-resumes on focus return.
- **When to Use**: Any context — system-level behavior
- **When NOT to Use**: Never disabled — always active

---

## Gaps & Patterns Needed

- **Tab Navigation**: Q/E (keyboard) or LB/RB (gamepad) for tab switching. Used in Settings. Should be added as a formal pattern.
- **Listening State**: Binding capture mode in Settings Controls. Should be added as a formal pattern.
- **DisplayConfirm Modal**: 15-second countdown for display changes. Should be added as a formal pattern.

---

## Open Questions

- Should button click sounds be different for Confirm vs Cancel? (Currently same sound category)
- Should slider tick sounds have pitch variation based on value direction?
