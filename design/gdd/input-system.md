# Input System

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-21
> **Implements Pillar**: Speed You Can Feel

## Overview

The Input System captures player actions from keyboard, mouse, and gamepad devices, converts raw hardware signals into game-level actions (accelerate, brake, steer, pit, menu), and delivers them to downstream systems with minimal latency. It handles device detection, dead zone filtering, EMA smoothing, and automatic device switching — ensuring the player always has responsive, predictable control regardless of input method. Without this system, no gameplay is possible: it is the first link between the player's intent and the car's behavior on track.

## Player Fantasy

**Framing:** Pure Response — the input is invisible. The player never thinks about controls; they think about the track, the rivals, and the strategy. Every car responds with the same crispness — the difference between a Tier 4 and Tier 1 car is speed and handling, not how the steering feels under the player's hands.

**Emotional target:** Confidence. The player trusts that pressing left makes the car go left, pressing the brake slows down proportionally, and every input is exactly as responsive as they expect. No surprises, no lag, no dead zones that eat inputs. The controls disappear, and only the race remains.

**Pillar alignment:** Speed You Can Feel — input responsiveness is the foundation of speed perception. If the input feels sluggish, speed feels wrong.

**Design test:** Can the player forget they're using a controller? If they're thinking about the input instead of the race, the system has failed.

## Detailed Design

### Core Rules

1. **Input Actions:** The system exposes 6 game-level actions:
   - `Accelerate` (analog 0–1, gamepad trigger / keyboard W/Up)
   - `Brake` (analog 0–1, gamepad trigger / keyboard S/Down)
   - `Steer` (analog -1 to 1, gamepad stick / keyboard A/D/Left/Right)
   - `Pit` (digital, keyboard P / gamepad button)
   - `Pause` (digital, keyboard Escape / gamepad Start)
   - `Confirm` (digital, keyboard Enter / gamepad A)

2. **Keyboard Steering:** Binary keys (A/D/Left/Right) produce analog output via speed-scaled ramp:
   - Hold key → ramp from 0 to 1 over ~300ms at high speed, ~500ms at low speed
   - Release key → ramp back to 0 over ~200ms
   - Ramp rate scales linearly with current speed (0–1 normalized)

3. **Dead Zone Model:**
   - Gamepad sticks: radial dead zone (inner threshold ~0.15, outer threshold ~0.95)
   - Gamepad triggers: axial dead zone with anti-crease (inner threshold ~0.05)
   - Keyboard: no dead zone (binary → analog conversion handles it)

4. **EMA Smoothing:** Per-action exponential moving average:
   - `Accelerate`: α = 0.3 (fast response)
   - `Brake`: α = 0.3 (fast response)
   - `Steer`: α = 0.5 (smoother, prevents twitchy steering)
   - Formula: `output = α × raw + (1 - α) × previous_output`

5. **Device Switching:** Instant auto-detection. The system monitors all connected devices and uses the last device that produced input. No prompt, no toast. HUD updates device icon silently.

6. **Output Contract:** All outputs are normalized:
   - Accelerate/Brake: 0.0 (none) to 1.0 (full)
   - Steer: -1.0 (full left) to 1.0 (full right)
   - Digital actions: true/false

**Note:** All numerical values (dead zone thresholds, EMA alphas, ramp times) are starting points that will require playtesting and refinement.

### States and Transitions

| State | Description | Allowed Actions |
|-------|-------------|-----------------|
| `Racing` | Active race — all gameplay inputs active | Accelerate, Brake, Steer, Pit, Pause |
| `Qualifying` | Qualifying lap — same as Racing but no Pit | Accelerate, Brake, Steer, Pause |
| `Menu` | Title/pause/results screens — navigation only | Confirm, Pause (as Back), Steer (as navigate) |
| `Replay` | Ghost replay (Alpha+) — no player input | None (read-only) |

Transitions:
- `Menu → Qualifying`: Player starts a race
- `Qualifying → Racing`: Qualifying lap complete (or skipped)
- `Racing → Menu`: Player pauses mid-race
- `Menu → Racing`: Player resumes from pause
- `Racing → Menu`: Race finishes (results screen)
- Any → `Replay`: Alpha+ ghost replay mode

### Interactions with Other Systems

| System | Data In | Data Out | Interface |
|--------|---------|----------|-----------|
| Vehicle Physics | Accelerate (0–1), Brake (0–1), Steer (-1–1) | — | Per-frame normalized values |
| UI Menu | Confirm, Pause, Steer (navigate) | — | Digital events |
| Ghost Recording | All normalized outputs + timestamp | — | Per-frame snapshot |
| Settings | Dead zone, EMA alpha, key bindings | — | Configuration read (supports remapping) |
| HUD | Current device icon | — | Device type enum |

## Formulas

### EMA Smoothing

`output = α × raw_input + (1 - α) × previous_output`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Alpha | α | float | 0.0–1.0 | Smoothing factor (0 = no response, 1 = no smoothing) |
| Raw Input | raw | float | 0.0–1.0 | Current frame's raw hardware value |
| Previous Output | prev | float | 0.0–1.0 | Last frame's smoothed output |

**Output Range:** 0.0 to 1.0
**Behavior at extremes:** α=0 → output never changes; α=1 → output = raw (no smoothing)
**Example:** α=0.3, raw=1.0, prev=0.0 → output = 0.3. Next frame: raw=1.0, prev=0.3 → output = 0.51. Converges to 1.0 over ~5 frames.

### Keyboard Steering Ramp

`ramp_rate = lerp(min_rate, max_rate, speed_normalized)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Min Rate | min_rate | float | 2.0 | Ramp speed at zero velocity (units/sec) |
| Max Rate | max_rate | float | 3.33 | Ramp speed at max velocity (units/sec) |
| Speed Normalized | speed | float | 0.0–1.0 | Current car speed as fraction of max |

**Output Range:** 0.0 to 1.0 (steering value)
**Example:** At speed=0.5, ramp_rate = lerp(2.0, 3.33, 0.5) = 2.67 units/sec. Holding A for 300ms → output ≈ 0.8.

## Edge Cases

- **If gamepad disconnects mid-race:** Switch to last available device (keyboard). HUD updates icon. No input interruption — the race continues.
- **If all devices disconnect:** Freeze all inputs (accelerate=0, brake=0, steer=0). Car coasts. Show "No input device" message. Resume when any device reconnects.
- **If player presses both accelerate and brake simultaneously:** Brake takes priority (safety). Output = max(0, brake - accelerate).
- **If steering key is released during ramp:** Ramp reverses from current value back to 0 at release rate (~200ms). No snap to zero.
- **If player switches device during qualifying:** Instant switch. Qualifying continues with new device.
- **If EMA receives NaN or infinity:** Clamp to last valid output. Log warning.

## Dependencies

| System | Direction | Type | Data Flow |
|--------|-----------|------|-----------|
| Vehicle Physics | Upstream | Hard | Input → Physics: normalized accelerate/brake/steer values per frame |
| UI Menu | Upstream | Hard | Input → Menu: digital events (Confirm, Pause, navigate) |
| Ghost Recording | Upstream | Hard | Input → Recording: all normalized outputs + timestamp per frame |
| Settings | Downstream | Hard | Settings → Input: dead zone, EMA alpha, key bindings (configuration) |
| HUD | Downstream | Soft | Input → HUD: current device type for icon display |
| Simulation Architecture | Upstream | Hard | SimArch → Input: fixed timestep timing for consistent frame updates |

## Tuning Knobs

| Knob | Default | Range | Too Low | Too High |
|------|---------|-------|---------|----------|
| EMA Alpha (Accelerate) | 0.3 | 0.1–0.8 | Sluggish throttle response | Twitchy, no smoothing |
| EMA Alpha (Brake) | 0.3 | 0.1–0.8 | Sluggish brake response | Twitchy, no smoothing |
| EMA Alpha (Steer) | 0.5 | 0.2–0.8 | Twitchy steering | Over-smoothed, unresponsive |
| Keyboard Ramp Min Rate | 2.0 | 1.0–4.0 | Too slow to reach full steer | Snaps to full steer |
| Keyboard Ramp Max Rate | 3.33 | 2.0–6.0 | Slow steering at speed | Overshoots at high speed |
| Dead Zone Inner (Stick) | 0.15 | 0.05–0.25 | Drift from stick noise | Misses small inputs |
| Dead Zone Outer (Stick) | 0.95 | 0.85–1.0 | Loses range at edges | Can't reach full output |
| Dead Zone Inner (Trigger) | 0.05 | 0.0–0.10 | False triggers | Misses light presses |

## Visual/Audio Requirements

[To be designed]

## UI Requirements

[To be designed]

## Acceptance Criteria

1. **GIVEN** player presses W/Up or gamepad right trigger, **WHEN** input is processed, **THEN** accelerate output ramps from 0.0 to 1.0 within 500ms (keyboard) or tracks trigger position directly (gamepad).
2. **GIVEN** player presses S/Down or gamepad left trigger, **WHEN** input is processed, **THEN** brake output ramps from 0.0 to 1.0 within 500ms (keyboard) or tracks trigger position directly (gamepad).
3. **GIVEN** player holds A/D/Left/Right, **WHEN** car is at 50% speed, **THEN** steering ramps to full deflection within 300ms.
4. **GIVEN** player releases steering key mid-ramp, **WHEN** input is released, **THEN** steering ramps back to 0.0 over ~200ms (no snap).
5. **GIVEN** gamepad stick is at rest (within dead zone), **WHEN** input is processed, **THEN** output is exactly 0.0 (no drift).
6. **GIVEN** gamepad is disconnected mid-race, **WHEN** disconnection is detected, **THEN** input switches to keyboard within 1 frame, HUD icon updates, race continues without interruption.
7. **GIVEN** all devices are disconnected, **WHEN** no input is available, **THEN** all outputs freeze at 0.0, car coasts, "No input device" message appears.
8. **GIVEN** player presses both accelerate and brake simultaneously, **WHEN** inputs conflict, **THEN** brake takes priority (output = brake value).
9. **GIVEN** EMA receives valid input, **WHEN** 5 consecutive frames of raw=1.0, **THEN** output converges to ≥0.95.
10. **GIVEN** settings change dead zone or EMA alpha, **WHEN** settings are applied, **THEN** new values take effect on next frame without restart.

## Open Questions

- Should the Input System support control remapping in Settings? (User confirmed: yes, Settings must support remapping)
- Should keyboard steering ramp be adjustable in Settings? (Tuning knob — TBD)
- Should there be a "vibration/rumble" action for gamepad? (Depends on Vehicle Physics — TBD)
