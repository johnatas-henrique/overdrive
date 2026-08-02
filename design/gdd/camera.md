# Camera

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Speed You Can Feel

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Cockpit and chase camera, per-car cockpit offsets, local interpolation, FOV, shake, Reduced Motion, and collision avoidance. |
| MVP architecture constraints | Camera consumes visual transforms rather than raw simulation state. |
| Alpha | Not designed. |
| Beta | Not designed. |
| Release | Not designed. |

### Review Boundary
Future camera modes are non-blocking unless MVP visual/simulation separation is violated.

## Overview

**Camera** is the visual framing system that positions the player's viewpoint relative to the car — cockpit as the primary fantasy, chase camera as an option. It reads interpolated visual transforms (produced by Simulation Architecture from Vehicle Physics source data, not raw simulation state) to produce smooth, responsive camera movement that reinforces the sense of speed. The system handles camera shake on wall impacts, field-of-view changes proportional to speed (Directional Velocity), and transition blending between camera modes. Without this system, the player has no viewpoint — the game is invisible.

**Interaction:** Direct — the player feels the camera through immersion. Cockpit view places them inside the car; chase view places them behind it. Both must communicate speed, position, and spatial awareness.

**Why it exists:** The camera is the player's window into the game world. A bad camera breaks immersion, obscures information, and makes fast driving feel slow. A great camera makes 200 km/h feel like 200 km/h.

## Player Fantasy

**Framing:** Direct — the player actively feels the camera through immersion. Cockpit view places them inside the car; chase view places them behind it.

**Emotional target:** "I am the driver, not the director." The camera is the driver's helmet bolted to the chassis. Speed arrives through the player's eyes, not past them. Every camera decision answers one question: does this put the player more inside the car, or less?

**Cockpit experience — two halves of the same feeling:**
- *In the Machine:* The camera is the driver's body geometry. Steering rotates the view. Throttle pushes FOV open. Brake pulls it back. The horizon tilts because the car tilts — never because the camera is being directorially expressive. Dashboard, windshield, mirrors, A-pillars: these are body parts, not decoration.
- *Peripheral Velocity:* Calm center, screaming edges. The road, apex, and rival ahead stay sharp; the periphery blurs, shakes, and bends with velocity. FOV widens with speed, contracts under braking, snaps tighter on impact. This is the Directional Velocity visual language made literal inside the camera.

**Chase experience — a deliberate step out:**
- *Tactical Retreat:* The chase camera is a mode-shift, not a peer view. Useful for learning lines, scanning the grid, recovering from a spin. The transition should feel like a gear change — different posture, different temperature, different relationship to the world.

**Pillar alignment:** Speed You Can Feel — the camera is the central delivery vehicle. Cockpit + FOV response + edge blur + chassis-welded shake IS the Directional Velocity language made literal. Rivals Make the Grid Personal — rivals in the windshield, peripheral blur, and mirror glimpses carry personal stakes.

**Design test:** When a player toggles cockpit to chase, they should feel like they have left the car. When they toggle back, they should feel like they have gotten back in.

## Detailed Design

### Core Rules

**1. Camera Modes**

Two modes. Cockpit is default and primary. Chase is the accessibility/spectacle option.

**Cockpit:**
- Position: Fixed offset from car's visual transform — driver's eye height (~0.35 m above chassis center, 0.1 m behind steering wheel). Per-car tunable.
- Rotation: Locked to car's visual rotation 1:1. No independent rotation except look-ahead and shake.
- FOV default: 78° (see Tuning Knobs — needs playtest)
- Vertical offset from ground: ~1.1 m (F1-style low seating)

**Chase:**
- Position: Fixed offset behind (4.5 m) and above (1.8 m) the car. Dead center horizontally.
- Rotation: Follows car's heading with 0.12s response lag (7.5 frames at 60 FPS). Pitch damped to 40%.
- FOV default: 70° (see Tuning Knobs — needs playtest)

**Mode switch:** `CameraToggle` action. Default binding is C / gamepad North-Y-Triangle. It is remappable in MVP and can switch mid-race or mid-corner anywhere driving input is active. Input routes its performed/rising edge directly to Camera during Dynamic Update, so one press starts one transition immediately; holding the control does not repeat until release. CameraToggle is presentation-only and never enters SimulationInput, the simulation tick, Replay, or Ghost Recording. It is ignored during PitTransit, InPitBox, Exiting, Finished Presentation, and Replay.

**Reduced Motion:** When enabled in Settings, camera shake amplitude is 0°, look-ahead is 0 m, and dynamic FOV is disabled so each mode stays at `FOV_base`. Mode blending, collision avoidance, and the player's selected camera mode remain active. Reduced Motion also disables VFX Motion Blur (vfx.md) — Camera logs the setting change for VFX consumption at Step 12.

**Terminal Presentation:** When `PublishedSimulationSnapshot.terminalPresentationRequest` is active, Camera blends from the active player-selected mode to a dedicated external three-quarter view of the player car. The request contains the result kind and resolved player result; UI Presentation owns the up-to-5-second timer and pause flag. The anchor is authored per car/track and guarantees the car is visible; it is not a chase-camera preference override. The blend uses the existing transition timings and yields to Qualifying Results or Race Results when UI Presentation dismisses the request.

**PitCamera:** PitTransit and Exiting retain the player's active Cockpit or Chase camera. When Pit Stop enters `InPitBox`, Camera blends to a dedicated external `PitCamera` anchored at the assigned box. It remains while tires swap and fuel fills. When Pit Stop begins `Exiting`, Camera blends back to the player-selected camera mode; it never snaps when Confirm triggers early exit.

**2. FOV Response (Directional Velocity)**

FOV widens with speed to amplify the sense of velocity.

`FOV(t) = FOV_base + (FOV_max - FOV_base) × clamp(speed_ratio, 0, 1)²`

Quadratic curve makes FOV change subtle at low speeds and aggressive near top speed. Transition smoothed over 0.15s (lerp).

| Mode | FOV_base | FOV_max |
|------|----------|---------|
| Cockpit | 78° | 95° |
| Chase | 70° | 90° |

*Note: All FOV values are initial defaults subject to playtest. See Tuning Knobs.*

**3. Camera Shake**

Three additive layers, clamped at 3.0° total:

| Layer | Trigger | Amplitude | Frequency | Priority |
|-------|---------|-----------|-----------|----------|
| Speed Vibration | Constant while moving | 0°→0.15° (Y), 0°→0.05° (X) | 30-50 Hz | Lowest |
| Surface Feedback | Curb, rumble strip, off-track | 0.3°-0.6° | 15-25 Hz | Medium |
| Impact Shake | Wall/car contact | 0.8°-2.5° | Sharp decay 0.2-0.5s | Highest |

When clamp triggers, speed vibration reduced first, then surface, then impact.

**4. Look-Ahead**

Camera anticipates turns using car's yaw rate.

`lookahead_offset = forward_vector × (base_distance + yaw_rate × yaw_multiplier)`

Clamped to [0, 15 m]. Smoothed over 0.2s. Chase mode uses 60% of cockpit values.

| Mode | base_distance | yaw_multiplier |
|------|--------------|----------------|
| Cockpit | 4.0 m | 3.0 m/(rad/s) |
| Chase | 2.4 m | 1.8 m/(rad/s) |

**5. Transition Blending**

Position and rotation lerp between modes over fixed duration.

| Parameter | Value |
|-----------|-------|
| Position blend | 0.35s |
| Rotation blend | 0.30s |
| FOV blend | 0.25s |
| Easing | Smoothstep (ease-in-out) |

Interrupt rule: switching again during blend restarts from current blended position. Post-blend settle: 0.1s hold before look-ahead/shake apply.

**6. Collision Avoidance**

Sphere-cast from car origin to camera position, excluding the player's own vehicle colliders and trigger volumes. If hit, camera pulled forward to hit point minus buffer.

| Parameter | Cockpit | Chase |
|-----------|---------|-------|
| Sphere radius | 0.15 m | 0.20 m |
| Buffer distance | 0.3 m | 0.3 m |
| Fallback | Car origin + 0.5 m up | Same |

If cast distance < 0.3 m, camera teleports to fallback and lerps back over 0.25s.

**7. Vertical Movement**

- Ground following: Camera follows car's visual Y 1:1 (no vertical lag)
- Bump response: Additive offset proportional to vertical impulse (30% amplitude, 0.15s decay)
- Elevation: Cockpit pitch follows 1:1, chase pitch damped to 40%
- Anti-nausea: Vertical offset clamped to ±0.3 m from car transform

### States and Transitions

| State | Description | Camera Behavior |
|-------|-------------|-----------------|
| `Cockpit` | Primary view, inside car | Fixed offset, 1:1 rotation, full shake/FOV |
| `Chase` | Secondary view, behind car | Lagged follow, reduced lookahead |
| `Transitioning` | Switching between modes | Lerp between anchors, 0.35s duration |
| `Replay` | Watching ghost replay | Same as active mode, no player input |
| `TerminalPresentation` | Finished player result | Dedicated external three-quarter view; no player camera switching |

### Interactions with Other Systems

| System | Direction | Data | Contract |
|--------|-----------|------|----------|
| Input System | Inbound | `CameraToggle` performed/rising edge | Input routes one immediate presentation event per press during allowed driving contexts; no SimulationInput or Ghost field exists. |
| Settings | Inbound | camera_shake_intensity, reduced_motion | Immediate transactional preview; Reduced Motion suppresses shake, dynamic FOV, and look-ahead without mutating saved preferences. Motion Blur remains VFX-owned. |
| Vehicle Physics | Inbound | Raw position, rotation, velocity (source data) | Camera reads visual transform, not raw sim state; interpolation performed by Simulation Architecture |
| Simulation Architecture | Inbound | Interpolated visual transform (position, rotation) via LateUpdate; render interpolation factor α; `PublishedSimulationSnapshot.terminalPresentationRequest` | Camera uses interpolated positions for smooth movement and enters TerminalPresentation only from the immutable published request |
| HUD | Outbound | Camera mode, FOV | HUD adapts layout for cockpit vs chase |
| Audio | Outbound | Camera mode, speed | Audio adjusts mix for cockpit (internal) vs chase (external) |
| VFX | Bidirectional | `impactShakeRequest` inbound; camera speed, FOV outbound | Camera applies impact shake and exposes camera state for Directional Velocity effects |
| Pit Stop | Inbound | `PitPhase`, assigned pit-box anchor | Camera enters PitCamera only during `InPitBox` and returns to the selected mode when `Exiting` begins. |

## Formulas

### FOV Response

`FOV(t) = FOV_base + (FOV_max - FOV_base) × clamp(speed_ratio, 0, 1)²`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| FOV Base | FOV_base | float | 70-78° | Baseline FOV per mode |
| FOV Max | FOV_max | float | 90-95° | Maximum FOV at top speed |
| Speed Ratio | speed_ratio | float | 0.0-∞ | Current speed / top speed before clamping |

**Output Range:** FOV_base to FOV_max
**Example:** Cockpit at 60% speed: 78 + (95-78) × 0.36 = 84.1°

### Look-Ahead Offset

`lookahead = forward × (base_distance + yaw_rate × yaw_multiplier)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Base Distance | base_distance | float | 2.4-4.0 m | Static forward offset |
| Yaw Rate | yaw_rate | float | -∞ to +∞ rad/s | Car's angular velocity |
| Yaw Multiplier | yaw_multiplier | float | 1.8-3.0 m/(rad/s) | How much yaw stretches lookahead |

**Output Range:** 0-15 m (clamped)
**Example:** Cockpit at tight corner (yaw=2 rad/s): 4.0 + 2.0 × 3.0 = 10.0 m ahead

### Shake Amplitude

`total_shake = min(speed_shake + surface_shake + impact_shake, 3.0°)`

Priority order for clamping: speed (lowest) → surface → impact (highest)

## Edge Cases

- **If camera clips through wall in cockpit mode:** Sphere-cast detects, camera pulled forward to hit point. If trapped (distance < 0.3m), teleports to fallback above car.
- **If player switches mode mid-transition:** Blend restarts from current blended position toward new target. No snap-back.
- **If car flips upside down:** Camera follows car rotation 1:1 in cockpit (disorienting but correct). Chase mode pitch damped to 40% limits the effect.
- **If speed is 0:** FOV stays at base. No shake. Lookahead at base_distance only.
- **If multiple impacts occur simultaneously:** Impact shake amplitudes add. If total exceeds 3.0°, lower-priority layers are reduced first.
- **If car goes off-track and hits wall in same frame:** Surface shake and impact shake both apply. Total clamped at 3.0°.
- **If WebGL frame rate drops:** Camera operations are ~0.04ms. No performance concern even at low FPS.
- **If car enters pit lane:** PitTransit continues with the active camera. `PitCamera` activates only after the car reaches InPitBox and returns to the active camera when Exiting begins.

## Dependencies

| System | Direction | Type | Data Flow |
|--------|-----------|------|-----------|
| Input System | Upstream | Hard | CameraToggle performed/rising edge → immediate presentation-only mode switch |
| Settings | Upstream | Hard | Shake intensity and Reduced Motion → runtime camera comfort overrides; Motion Blur is not a Camera setting consumer |
| Vehicle Physics | Upstream | Hard | Visual position, rotation, velocity → Camera |
| Simulation Architecture | Upstream | Hard | Render interpolation factor → Camera |
| HUD | Downstream | Soft | Camera mode, FOV → HUD layout adaptation |
| Audio | Downstream | Soft | Camera mode, speed → Audio mix (internal vs external) |
| VFX | Bidirectional | Soft | Camera exposes speed/FOV for Directional Velocity and consumes `impactShakeRequest` |
| Pit Stop | Inbound | Hard | PitPhase and pit-box anchor → PitCamera state |
| Track | Inbound | Hard | Track geometry → camera follows racing line (mirrors PitLaneSide) |
| UI Menu | Inbound | Hard | Finished Presentation camera request → terminal viewpoint |

## Tuning Knobs

| Knob | Default | Range | Too Low | Too High | Notes |
|------|---------|-------|---------|----------|-------|
| FOV Base (Cockpit) | 78° | 65-85° | Slow feel, claustrophobic | Fisheye distortion | **Needs playtest** |
| FOV Max (Cockpit) | 95° | 85-110° | Subtle speed feel | Motion sickness | **Needs playtest** |
| FOV Base (Chase) | 70° | 60-80° | Can't see track | Can't see car | **Needs playtest** |
| FOV Max (Chase) | 90° | 80-100° | Same as above | Same as above | **Needs playtest** |
| FOV Smoothing | 0.15s | 0.05-0.3s | Snappy, jarring | Sluggish, delayed | |
| Lookahead Base (Cockpit) | 4.0 m | 2.0-6.0 m | Can't see apex | Distortion at speed | |
| Lookahead Yaw Multiplier | 3.0 | 1.0-5.0 | No anticipation | Over-rotates | |
| Shake Speed Amplitude | 0.15° | 0.05-0.3° | No vibration | Nauseating | |
| Shake Impact Max | 2.5° | 1.0-4.0° | Weak feedback | Disorienting | |
| Blend Time | 0.35s | 0.2-0.6s | Jarring switch | Sluggish switch | |
| Vertical Clamp | ±0.3 m | ±0.1-±0.5 m | No bump feel | Seasickness | |

## Visual/Audio Requirements

Camera has no direct visual/audio output — it IS the visual framing. Requirements are consumed by downstream systems:
- **VFX:** Directional Velocity effects (streaks, blur) scale with camera FOV and speed
- **Audio:** Engine/ambient mix changes between cockpit (internal) and chase (external)
- **HUD:** Layout adapts for cockpit (minimal, immersive) vs chase (wider information)

No assets owned by this system.

## UI Requirements

Camera has no direct UI. The player accesses camera mode switch via mapped input. HUD adapts layout based on camera mode (owned by HUD System GDD).

## Acceptance Criteria

### Camera Modes
- **AC-CM1:** Given cockpit mode, When car rotates, Then camera rotation matches car rotation within ±0.5°.
- **AC-CM2:** Given chase mode, When car rotates 90° in 1s, Then camera reaches car heading within 0.10-0.14s (target 0.12s ±0.02s).
- **AC-CM3:** Given an allowed driving context and a `CameraToggle` rising edge, When Input processes the Dynamic Update, Then Camera starts exactly one mode transition immediately and position, rotation, and FOV lerp over their defined blend durations with smoothstep easing.
- **AC-CM3a:** Given `CameraToggle` remains held after starting a transition, When subsequent Dynamic Updates execute, Then no additional mode transition starts until the control is released and pressed again; no CameraToggle value enters SimulationInput or Ghost Recording.
- **AC-CM4:** Given chase mode at 0% speed, When rendering, Then camera is 4.5m behind and 1.8m above car (±0.2m).
- **AC-CM5:** Given two cars have different authored cockpit offsets, When the player switches to Cockpit, Then the active car's offset is used without changing the global camera mode or blend timing.

### FOV Response
- **AC-FOV1:** Given cockpit at 0% speed, When rendering, Then FOV is 78° (±2°).
- **AC-FOV2:** Given cockpit at 100% speed, When rendering, Then FOV is 95° (±2°). FOV max is a design decision (quadratic curve endpoint — see Tuning Knobs).
- **AC-FOV3:** Given speed drops from 100% to 0% in 1 frame, When FOV updates, Then FOV eases back over 0.12-0.18s (target 0.15s ±0.03s).
- **AC-FOV4:** Given chase at 0% speed, When rendering, Then FOV is 70° (±2°).
- **AC-FOV5:** Given chase at 100% speed, When rendering, Then FOV is 90° (±2°).
- **AC-FOV6:** Given speed exceeds Top Speed, When FOV updates, Then `speed_ratio` is clamped to 1.0 and FOV does not exceed `FOV_max`.

### Camera Shake
- **AC-SH1:** Given car at top speed on smooth track, When shake amplitude is measured, Then speed vibration amplitude is 0.10°-0.20° (target 0.15° ±0.05°).
- **AC-SH2:** Given car hits wall at 200 km/h, When impact occurs, Then camera shake amplitude is 0.8°-2.5° and decays to <10% of peak within 0.5s.
- **AC-SH3:** Given speed shake = 2.0° + impact shake = 1.5° (total 3.5°), When clamp activates, Then total is clamped to 3.0° and speed shake is reduced first.
- **AC-SH4:** Given car drives over curb, When surface contact occurs, Then surface shake amplitude is 0.2°-0.4° (target 0.3° ±0.1°).
- **AC-SH5:** Given Settings working copy sets Reduced Motion On, When Camera resolves runtime presentation, Then shake, dynamic FOV, and look-ahead are suppressed immediately without changing the saved shake/FOV preferences; turning Reduced Motion Off restores the working values.

### Look-Ahead
- **AC-LA1:** Given car in straight line (yaw rate = 0) at any speed, When rendering, Then camera lookahead is 3.0-5.0 m (target 4.0m ±1.0m).
- **AC-LA2:** Given car in tight corner (yaw rate = 2.0 rad/s), When rendering, Then camera lookahead is 10.0-15.0 m (target 10.0m for cockpit: 4.0 + 2.0 × 3.0).

### Collision Avoidance
- **AC-CA1:** Given chase camera approaches wall within 0.5m, When sphere-cast hits geometry, Then camera position is pulled forward to hit point minus 0.3m buffer (±0.05m).
- **AC-CA2:** Given camera is clipped inside geometry (distance < 0.3m), When detection fires, Then camera teleports to fallback (car origin + 0.5m up) and lerps back over 0.20-0.30s.

### Transition
- **AC-TR1:** Given player switches mode during active blend, When new switch detected, Then blend restarts from current blend weight (position + rotation + FOV) toward new target.
- **AC-TR2:** Given blend completes, When 0.1s elapses, Then look-ahead and shake apply normally (no wobble).

### Reduced Motion
- **AC-RM1:** Given Reduced Motion is enabled, When the camera updates at any speed, Then shake is 0°, look-ahead is 0 m, and FOV remains at the mode's base value while collision avoidance and mode transitions continue to function.

## Open Questions

- **Per-car cockpit offsets:** Resolved for MVP — driver eye position is per-car tunable.
- **Chase camera car visibility:** How much of the player's car is visible in chase? Full car or just rear wing?
- **Motion sickness toggle:** Resolved for MVP — Reduced Motion disables shake, look-ahead, and dynamic FOV while preserving base FOV, mode transitions, and collision avoidance.
- **Mirror/rear-view:** Does camera GDD define rear-view mirrors or is that a separate HUD system?
