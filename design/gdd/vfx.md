# VFX

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Speed You Can Feel

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Directional Velocity effects, local speed feedback, surface effects, and quality presets. |
| MVP architecture constraints | VFX consumes explicit local race state and retains extension slots without changing core simulation. |
| Alpha | Not designed. |
| Beta | Not designed. |
| Release | Night and damage VFX if approved. |

### Review Boundary
Deferred weather, night, and damage effects are non-blocking during MVP review.

## Overview

**VFX** delivers visual feedback that reinforces speed, impact, and car state — streaks, motion blur, particle effects, and camera shake. The visual language is "Directional Velocity": every surface is a streak, the world blurs, the car stays sharp. Speed effects intensify sensation but never obscure the racing line, car state, or HUD. Without VFX, the game feels flat — speed has no visual confirmation, impacts have no weight, and the world feels static.

## Player Fantasy

**Framing:** Direct — the player sees and feels speed through visual effects.

**Emotional target:** One layer:

1. **Speed Has a Visual Language (streaks tell the story):** The faster you go, the more the world streaks. The environment blurs into directional lines. The car stays sharp — it's the anchor in a world of motion. At 300 km/h, the world is a tunnel of light. At 50 km/h, you can see every detail. The VFX tells you how fast you're going without looking at the HUD. Anchor: lap 3, you're pushing hard — the world is streaking, the edges are blurring, you feel the speed in your eyes before your hands.

**Pillar alignment:** Speed You Can Feel — VFX is the visual channel for speed perception. Every Short Race Matters — visual feedback for position changes, lap completions, and race events.

**Design test:** Can the player tell their speed range from VFX alone, without looking at the HUD?

## Detailed Design

### Core Rules

**1. VFX Categories**

| Category | Description | Trigger | Intensity Source |
|----------|-------------|---------|-----------------|
| **Speed Streaks** | Directional lines at screen edges | Speed > 100 km/h | Speed relative to `streak_onset_speed` and `global_max_velocity` |
| **Motion Blur** | World blur based on speed | Speed > 50 km/h | Speed relative to `global_max_velocity` |
| **Tire Smoke** | White particles from tire contact | Grip loss > 0.3 | Wear % + grip loss |
| **Sparks** | Orange particles from wall contact | Wall hit velocity > 50 km/h | Impact speed |
| **Dust** | Brown particles from off-track | Surface = gravel/grass | Speed + surface type |
| **Impact Shake Request** | Impact signal for Camera | Wall hit, curb contact, high speed | Impact force; Camera owns shake amplitude, duration, and composition |
| **Vignette** | Darkened screen edges at high speed | Speed > 60% of `global_max_velocity` | Speed relative to `global_max_velocity` |
| **Rain** | Rain particles + wet surface reflections | Weather = rain (post-MVP) | Rain intensity |

**2. VFX Density Presets (Proportional)**

| Preset | Streaks | Blur | Particles | Screen Effects | Shake |
|--------|---------|------|-----------|----------------|-------|
| **Low** | 50% intensity | 50% intensity | 25% count | Vignette off; streaks retained | 50% amplitude |
| **Medium** | 75% intensity | 75% intensity | 50% count | Vignette only | 75% amplitude |
| **High** | 100% intensity | 100% intensity | 100% count | Full | 100% amplitude |
| **Ultra** | 100% + extra trails | 100% + quality | 150% count | Full + extras | 100% + duration |

**3. Cockpit vs Chase**

Same VFX triggers and intensity for both camera modes. The difference comes from the camera itself (shake, FOV), not from VFX scaling. Cockpit is the primary fantasy camera — VFX should be equally intense.

**4. Performance Budget**

| Effect | Max Simultaneous | Budget |
|--------|-----------------|--------|
| Speed Streaks | 1 (screen-space) | Negligible |
| Motion Blur | 1 (screen-space) | Low |
| Tire Smoke | 16 (1 per car) | Medium |
| Sparks | 8 (concurrent wall hits) | Low |
| Dust | 16 (1 per car) | Medium |
| Impact Shake Request | 1 request stream | Negligible; Camera owns the camera component |
| Vignette | 1 (screen-space) | Negligible |
| Rain | 1 (screen-space) | Medium (post-MVP) |

Total VFX budget: ≤10% of frame time at 60 FPS (1.6ms), excluding Camera-owned shake composition.

**5. Speed Streaks Formula**

VFX scales relative to the fastest car's max velocity (read from Car Definition Data at runtime). This ensures the player sees VFX intensity differences between cars.

`global_max_velocity = max(all car top speeds)`
`streak_intensity = clamp((speed - streak_onset_speed) / (global_max_velocity - streak_onset_speed), 0, 1)`

| Speed | Intensity | Visual |
|-------|-----------|--------|
| 0 km/h | 0.0 | No streaks |
| 155 km/h (50% of max) | 0.262 | Mild streaks |
| 340 km/h (100% of max, tier 1) | 1.0 | Maximum streaks |

**6. Motion Blur Formula**

`blur_amount = 0` when Motion Blur preference is Off or Reduced Motion is active; otherwise `clamp(speed / global_max_velocity, 0, 1) × 0.5`.

Where `global_max_velocity` = max(all car top speeds). Maximum blur at car's top speed = 0.5 (50% screen blur).

**7. Vignette Formula**

`vignette_intensity = clamp((speed / global_max_velocity) - 0.6, 0, 0.4)`

Where `global_max_velocity` = max(all car top speeds). Vignette starts at 60% of max speed, reaches maximum at 100%.

**8. Tire Smoke**

| Trigger | Particle Count | Lifetime | Color |
|---------|---------------|----------|-------|
| Grip loss > 0.3 | 300–1200 particles/s, frame-delta scaled | 0.5–1.0s | White/gray |
| Grip loss > 0.7 | 1200–3000 particles/s, frame-delta scaled | 1.0–2.0s | White/gray |

**9. Sparks (Wall Contact)**

| Trigger | Particle Count | Lifetime | Color |
|---------|---------------|----------|-------|
| Wall hit > 50 km/h | 10–30 | 0.3–0.8s | Orange/yellow |
| Wall hit > 150 km/h | 30–60 | 0.5–1.2s | Orange/yellow + smoke |

**10. Impact Shake Request**

VFX emits `impactShakeRequest { source, impact_factor }`. Camera converts this request into amplitude, duration, and frequency using the Camera shake contract; VFX does not calculate or stack camera transforms.

| Trigger | impact_factor range | Notes |
|---------|---------------------|-------|
| Wall hit | 0.1–0.5 (based on speed) | Higher speed = higher impact_factor |
| Curb contact | 0.05–0.15 | Lighter impact |
| High speed (>250 km/h) | 0.02–0.05 | Continuous micro-shake |

**11. Rain VFX (Post-MVP)**

Designed slots for future implementation:
- Rain particles: screen-space, intensity scales with weather
- Wet surface reflections: shader-based, glossy multiplier on surfaces
- Spray from cars: particle system behind each car at speed
- Wiper animation: cockpit camera only

### States and Transitions

| State | Active VFX | Notes |
|-------|-----------|-------|
| **Menu** | None | Clean UI |
| **Qualifying** | Speed streaks, blur, smoke | Same as race |
| **Race** | All categories | Full VFX |
| **PitTransit/Exiting** | Reduced speed effects | Pit lane speed limit |
| **InPitBox** | No speed effects; service/impact presentation only | Car stationary |
| **Finished Presentation** | Finish burst and presentation effects; no continuous speed effects | Simulation has no race tick |
| **Results** | None | Clean UI |

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Vehicle Physics** | Inbound | Speed, grip state, wall contact | Drives all VFX triggers |
| **Track** | Inbound | Surface type | Drives dust particles |
| **Camera** | Outbound | `impactShakeRequest` | Camera applies the shake contract |
| **Settings** | Inbound | VFX density, Motion Blur preference, Reduced Motion | Supplies transactional working/persisted player preferences without runtime override mutation |
| **Tire System** | Inbound | Wear % | Drives tire smoke intensity |
| **Simulation Architecture** | Inbound | `PerformanceReduced`, SimulationState | Owns performance protection; VFX applies the requested density state |

## Formulas

### Speed Streaks

`streak_intensity = clamp((speed - streak_onset_speed) / (global_max_velocity - streak_onset_speed), 0, 1)`

Where `streak_onset_speed = 100 km/h` and `global_max_velocity` = max(all car top speeds) — computed at runtime from each car's `max_velocity` (Car Definition Data).

**Output Range:** 0.0 (at or below onset) to 1.0 (fastest car at max speed).

### Motion Blur

`blur_amount = clamp(speed / global_max_velocity, 0, 1) × 0.5`

**Output Range:** 0.0 (no blur) to 0.5 (50% blur at max speed).

### Vignette

`vignette_intensity = clamp((speed / global_max_velocity) - 0.6, 0, 0.4)`

**Output Range:** 0.0 (below 60% of max) to 0.4 (at max speed).

### Impact Shake Request

VFX emits `impactShakeRequest { source, impact_factor }`. Camera converts this request into amplitude, duration, and frequency using the Camera shake contract; VFX does not calculate or stack camera transforms.

## Edge Cases

- **If speed is exactly 100 km/h:** Streaks at 0.0 intensity (threshold).
- **If speed exceeds global_max_velocity:** All speed-based effects remain capped at maximum.
- **If multiple wall hits in same frame:** VFX emits separate impact requests; Camera owns composition and applies its cap.
- **If VFX density is Low:** Particles at 25% count, vignette off, and speed streaks retained at 50% intensity.
- **If Simulation emits PerformanceReduced:** VFX enters Low density while preserving minimum speed streaks; VFX does not measure FPS or own the performance decision.
- **If Reduced Motion is enabled:** Motion Blur is forced Off and Camera suppresses shake, dynamic FOV, and look-ahead without changing saved preferences. Disabling Reduced Motion restores the working preferences.
- **If PerformanceReduced and Reduced Motion are both active:** Performance protection owns Low VFX density; Reduced Motion additionally suppresses motion effects.
- **If cockpit camera active:** Same VFX intensity as chase.
- **If rain is active (post-MVP):** Rain particles + wet reflections override dry VFX.
- **If car is stationary:** No speed-based VFX; Audio owns engine idle presentation.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Vehicle Physics** | Inbound | Speed, grip, wall contact | Hard — drives all VFX |
| **Track** | Inbound | Surface type | Hard — drives dust |
| **Camera** | Outbound | `impactShakeRequest` | Hard — camera applies the shake contract |
| **Settings** | Inbound | density, Motion Blur, Reduced Motion | Hard — supplies player quality/accessibility preferences; Simulation-owned PerformanceReduced has higher runtime precedence |
| **Tire System** | Inbound | Wear % | Soft — drives smoke intensity |
| **Car Definition Data** | Inbound | Per-car `max_velocity` (derives `global_max_velocity` = max of all) | Hard — normalizes speed effects |
| **Simulation Architecture** | Inbound | `PerformanceReduced`, SimulationState | Hard — owns state/performance gating |

## Tuning Knobs

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Streak onset speed | 100 km/h | 50–150 km/h | Streaks too early | Streaks too late |
| Blur max amount | 0.5 | 0.3–0.7 | Blur too subtle | Blur too strong |
| Vignette max | 0.4 | 0.2–0.6 | Vignette invisible | Vignette too dark |
| Particle count (Low) | 25% | 10–50% | Too few particles | Performance hit |
| Impact request factor max | 1.0 | Fixed | Impact response too weak | Camera owns the final cap |
| VFX frame budget | 1.6ms | 1.0–2.5ms | Effects cut short | Frame drops |

## Visual/Audio Requirements

- **Speed streaks:** Directional lines at screen edges, color = environment (green for grass, gray for asphalt).
- **Motion blur:** Radial blur centered on car, intensity scales with speed.
- **Tire smoke:** White/gray particles, volume scales with wear.
- **Sparks:** Orange/yellow particles, burst on wall contact.
- **Dust:** Brown particles, volume scales with surface type (gravel > grass).
- **Impact shake request:** VFX emits impact source and normalized factor; Camera owns procedural frequency, amplitude, duration, and composition.
- **Vignette:** Darkened edges, intensity scales with speed.
- **Rain (post-MVP):** White particles falling, wet surface shader, spray particles.

## UI Requirements

No UI requirements for this system. VFX is visual-only.

## Acceptance Criteria

- **GIVEN** Tier1 car at max speed (340 km/h), **WHEN** streaks are rendered, **THEN** intensity is 1.0.
- **GIVEN** Tier4 car at max speed (316 km/h), **WHEN** streaks are rendered against a global max of 340 km/h and onset of 100 km/h, **THEN** intensity is approximately 0.90.
- **GIVEN** car at 50% of global max, **WHEN** blur is rendered, **THEN** amount is 0.25.
- **GIVEN** car at 60% of global max, **WHEN** vignette is checked, **THEN** intensity is 0.0 (threshold).
- **GIVEN** wall hit at 100 km/h, **WHEN** sparks are rendered, **THEN** 10-30 particles burst.
- **GIVEN** grip loss at 0.5 and a 60 FPS frame, **WHEN** tire smoke is rendered, **THEN** emission is 300–1200 particles/s converted by frame delta to approximately 5–20 particles per frame.
- **GIVEN** VFX density Low, **WHEN** particles are rendered, **THEN** count is 25% of High.
- **GIVEN** cockpit camera, **WHEN** VFX intensity is checked, **THEN** same as chase camera unless Reduced Motion or a density preset changes the output.
- **GIVEN** Simulation emits `PerformanceReduced`, **WHEN** VFX updates (LateUpdate, per ADR-0010 — reads interpolated VisualTransform after the α is computed), **THEN** density is Low, minimum speed streaks remain available, and VFX does not alter Simulation timing.
- **GIVEN** Reduced Motion is enabled while saved Motion Blur is On, **WHEN** VFX resolves runtime effects, **THEN** Motion Blur is Off without mutating the saved preference; disabling Reduced Motion restores the working Motion Blur value.
- **GIVEN** PerformanceReduced and Reduced Motion are both active, **WHEN** VFX resolves overrides, **THEN** density is Low from Simulation and motion effects remain suppressed by Reduced Motion.

## Open Questions

- **Speed streak color:** MVP follows the approved Directional Velocity rule: environment-colored streaks, with readability overrides if contrast is insufficient.
- **HDR support:** Deferred rendering-quality detail; sparks must remain readable without HDR.
- **Performance scaling:** Resolved: Simulation owns PerformanceReduced; VFX applies Low density and preserves minimum streaks.
- **Night racing:** Should VFX include headlight beams, taillight trails? (Post-MVP)
- **Damage VFX:** Should car damage show visual effects (smoke, sparks from damaged parts)? (Post-MVP)
