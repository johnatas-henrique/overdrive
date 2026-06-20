# Input

> **Status**: Design Complete
> **Author**: Overdrive Team
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Speed That Is Felt

## Overview

Input is the bridge between the player's physical hardware (keyboard, gamepad)
and the car on track — translating every button press, stick movement, and
trigger pull into steering, acceleration, braking, and menu navigation. It is
the primary channel through which the player acts on the game world: without
it, the game is a screensaver. Input is the player's agency layer — responsive,
predictable, and invisible when done right.

## Player Fantasy

Input is invisible when it works. The player should never think about the
controls — only about the racing line, the braking point, the gap. The
fantasy is that of a connected driver: every stick movement is the steering
wheel, every trigger pull is the throttle. The keyboard player gets the same
instant response, translated through tap-steering and button modulation.
When done right, Input disappears — the player forgets their hands exist
and lives entirely in the cockpit.

## Detailed Design

### Core Rules

- **Analog steering**: left stick X-axis, continuous range -1 (full left) to +1 (full right). Dead zone applied at the bottom (configurable, default 0.15). Steering input is consumed by Physics/Handling each tick — no smoothing or filtering at the Input layer; the feel lives downstream.
- **Analog throttle**: right trigger, continuous range 0 (released) to +1 (full throttle). Same dead zone pattern.
- **Analog brake**: left trigger, continuous range 0 (released) to +1 (full brake).
- **Digital gear**: gear up and gear down are discrete pulses — each press shifts exactly one gear. No analog clutch (sequential gearbox).
- **Digital camera toggle**: each press cycles to the next camera view (cockpit → chase → cockpit).
- **Digital pause**: each press toggles pause state via GSM. Menu navigation (up/down/confirm/cancel) is digital — directional pad or keyboard arrows.
- **Focus loss**: when the browser tab loses focus, all analog inputs are zeroed immediately (no stuck keys). If focus returns, inputs resume at current hardware state — no replay of missed events.
- **Device switching**: the system detects whether the last input came from keyboard or gamepad and adapts UI hints accordingly. No penalty for switching mid-race.

### States and Transitions

| State     | Description                                 | Entry                         | Exit               |
| --------- | ------------------------------------------- | ----------------------------- | ------------------ |
| Active    | Polling all devices, dispatching every tick | Game boots, Input initializes | Game closes        |
| FocusLost | Browser tab hidden — all outputs zeroed     | Window blur event             | Window focus event |

Input has no complex state machine: it's always active while the game runs, and aggressively zeros outputs when focus is lost.

### Interactions with Other Systems

| System           | Data Out                                                           | Data In                                           | Direction           |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------------------- | ------------------- |
| Physics/Handling | steer (-1..1), throttle (0..1), brake (0..1), gear_delta (-1/0/+1) | —                                                 | Input → Physics     |
| GSM              | pause_toggle pulse                                                 | current_state (to block input during transitions) | Input → GSM → Input |
| Menu/Paddock     | nav_up/down/confirm/cancel                                         | —                                                 | Input → Menu        |
| Camera           | camera_toggle pulse                                                | —                                                 | Input → Camera      |
| Dev Tools        | toggle_F1, config_reload_F2                                        | —                                                 | Input → Dev Tools   |

Blocks input during GSM transitions (Loading → Menu, Racing → PostRace) to prevent stale inputs from triggering actions in the wrong state.

## Formulas

### Dead Zone

The dead zone formula is applied to all analog inputs (steering, throttle, brake):

`output = |raw| < threshold ? 0 : sign(raw) * (|raw| - threshold) / (1 - threshold)`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|-----------|--------|-------|-------------|------------------------------------|
| raw | `raw` | float | -1.0 to 1.0 | Raw hardware value from the device |
| threshold | `t` | float | 0.0 to 0.5 | Configurable dead zone size |
| output | — | float | -1.0 to 1.0 | Output value after dead zone |

**Output Range:** -1.0 to 1.0 — same as raw input, but values within the dead zone snap to 0.

**Behavior:** The formula preserves full range above the threshold (no loss of sensitivity). A threshold of 0.0 disables the dead zone entirely.

## Edge Cases

- **Controller disconnects mid-race**: all gamepad inputs zero immediately (throttle released, steering centers). Keyboard remains active. On reconnection, inputs resume from current hardware state — no replay of missed input.
- **Opposing digital steering (A+D / ←→ simultaneously)**: net zero — both cancel out, car does not steer. Same rule for gear up + gear down simultaneously: both ignored.
- **Rapid gear shifts**: at most one gear shift per tick (16ms). No queue — rapid tapping shifts at the tick rate, not the press rate.
- **Camera toggle spam**: debounced — one toggle per 200ms window. Prevents accidental double-toggle from nervous button mashing.
- **Tab backgrounded during race**: all inputs zero immediately. Car coasts (momentum carries). On return, live hardware state resumes — no stuck keys, no missed input replay.
- **Gamepad stick drift**: handled by the dead zone. If hardware drift exceeds the default threshold, the player can increase it via tuning knob.
- **Multiple controllers**: the system tracks which device last sent meaningful input (above dead zone). UI hints follow the active device. No penalty for switching mid-race.

## Dependencies

| Dependency         | Type     | Notes                                                |
| ------------------ | -------- | ---------------------------------------------------- |
| Babylon.js 9.12.0  | Platform | DeviceSourceManager + GamepadManager + keyboard obs. |
| Data & Config Mgmt | Upstream | Reads `input.dead_zone` and `input.camera_debounce`  |
| GSM                | Upstream | Receives `current_state` to block input on trans.    |

Input has no upstream game systems — it sits at the root of the Core Racing layer.
Downstream consumers: Physics/Handling, GSM, Menu/Paddock LITE, Camera, Dev Tools.

## Tuning Knobs

| Knob                          | Namespace             | Default | Range  | Description                       |
| ----------------------------- | --------------------- | ------- | ------ | --------------------------------- |
| Analog dead zone threshold    | input.dead_zone       | 0.15    | 0-0.5  | Values below this snap to zero    |
| Camera toggle debounce window | input.camera_debounce | 200     | 50-500 | Minimum ms between camera toggles |

All knobs read from Data & Config Manager and support HMR — changing values in debug overlay updates behavior live.

## Visual/Audio Requirements

- **Visual**: none — Input has no visual representation.
- **Audio**: Input does not produce audio directly, but must guarantee that throttle/brake/steering signals arrive every tick without dropouts, as audio systems derive engine pitch and tire squeal from these values. A dropped throttle tick produces an audible pop in the engine loop.

## UI Requirements

- **Control hints**: the HUD must display context-sensitive control hints (keyboard or gamepad) based on which device last sent meaningful input. No overlay during races — hints belong in loading screens or pause menu.
- **Menu navigation**: Input must route up/down/confirm/cancel to the active menu screen regardless of whether the input source is keyboard or gamepad. The menu layer does not distinguish between devices.

## Acceptance Criteria

1. Steering axis reads -1 to 1 from gamepad left stick, with dead zone applied
2. Throttle and brake read 0 to 1 from triggers
3. Keyboard WASD/arrows produce correct digital equivalents
4. Gear up/down produce discrete +1/-1 pulses per press
5. Tab blur zeros all outputs; tab focus resumes live values
6. Controller disconnect zeros all gamepad outputs; reconnect resumes
7. A+D simultaneously produces zero steering
8. Multiple rapid gear up presses produce at most 1 shift per tick
9. Camera toggle fires at most once per 200ms
10. Pause fires GSM pause transition on ESC/Start press
11. Menu navigation (up/down/confirm/cancel) works in Menu state only
12. All inputs blocked during GSM transitions (Loading → Menu, Racing → PostRace)
13. Device switching (keyboard → gamepad) updates UI hints correctly
14. Dead zone tuning knob reads from Data & Config Manager and responds to HMR

## Open Questions

- Look-back button — needed for racing awareness? If so, V2 — out of Phase 1 scope.
- Quick race HUD commands (D-pad for fuel mix, brake bias) — Phase 1 or Alpha?
- Should camera toggle debounce be per-player-config in the future? (Fixed in Phase 1)
