# VFX

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-22
> **Implements Pillar**: Speed You Can Feel

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
| **Speed Streaks** | Directional lines at screen edges | Speed > 100 km/h | Speed (linear 100-350 km/h) |
| **Motion Blur** | World blur based on speed | Speed > 50 km/h | Speed (linear 50-350 km/h) |
| **Tire Smoke** | White particles from tire contact | Grip loss > 0.3 | Wear % + grip loss |
| **Sparks** | Orange particles from wall contact | Wall hit velocity > 50 km/h | Impact speed |
| **Dust** | Brown particles from off-track | Surface = gravel/grass | Speed + surface type |
| **Camera Shake** | Screen shake on impacts | Wall hit, curb contact, high speed | Impact force |
| **Vignette** | Darkened screen edges at high speed | Speed > 200 km/h | Speed (linear 200-350 km/h) |
| **Rain** | Rain particles + wet surface reflections | Weather = rain (post-MVP) | Rain intensity |

**2. VFX Density Presets (Proportional)**

| Preset | Streaks | Blur | Particles | Screen Effects | Shake |
|--------|---------|------|-----------|----------------|-------|
| **Low** | 50% intensity | 50% intensity | 25% count | Off | 50% amplitude |
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
| Camera Shake | 1 (camera component) | Negligible |
| Vignette | 1 (screen-space) | Negligible |
| Rain | 1 (screen-space) | Medium (post-MVP) |

Total VFX budget: ≤10% of frame time at 60 FPS (1.6ms).

**5. Speed Streaks Formula**

VFX scales relative to the fastest car's max velocity (read from Car Definition Data at runtime). This ensures the player sees VFX intensity differences between cars.

`global_max_velocity = max(all car top speeds)`
`streak_intensity = clamp(speed / global_max_velocity, 0, 1)`

| Speed | Intensity | Visual |
|-------|-----------|--------|
| 0 km/h | 0.0 | No streaks |
| 155 km/h (50% of max) | 0.5 | Moderate streaks |
| 310 km/h (100% of max) | 1.0 | Maximum streaks |

**6. Motion Blur Formula**

`blur_amount = clamp(speed / global_max_velocity, 0, 1) × 0.5`

Where `global_max_velocity` = max(all car top speeds). Maximum blur at car's top speed = 0.5 (50% screen blur).

**7. Vignette Formula**

`vignette_intensity = clamp((speed / global_max_velocity) - 0.6, 0, 0.4)`

Where `global_max_velocity` = max(all car top speeds). Vignette starts at 60% of max speed, reaches maximum at 100%.

**8. Tire Smoke**

| Trigger | Particle Count | Lifetime | Color |
|---------|---------------|----------|-------|
| Grip loss > 0.3 | 5–20 per frame | 0.5–1.0s | White/gray |
| Grip loss > 0.7 | 20–50 per frame | 1.0–2.0s | White/gray |

**9. Sparks (Wall Contact)**

| Trigger | Particle Count | Lifetime | Color |
|---------|---------------|----------|-------|
| Wall hit > 50 km/h | 10–30 | 0.3–0.8s | Orange/yellow |
| Wall hit > 150 km/h | 30–60 | 0.5–1.2s | Orange/yellow + smoke |

**10. Camera Shake**

| Trigger | Amplitude | Duration | Frequency |
|---------|-----------|----------|-----------|
| Wall hit | 0.1–0.5 (based on speed) | 0.2–0.5s | 30 Hz |
| Curb contact | 0.05–0.15 | 0.1–0.2s | 40 Hz |
| High speed (>250 km/h) | 0.02–0.05 | Continuous | 20 Hz |

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
| **Pit** | Reduced speed effects | Pit lane speed limit |
| **Results** | None | Clean UI |

### Interactions with Other Systems

| System | Direction | Data | Notes |
|--------|-----------|------|-------|
| **Vehicle Physics** | Inbound | Speed, grip state, wall contact | Drives all VFX triggers |
| **Track** | Inbound | Surface type | Drives dust particles |
| **Camera** | Outbound | Shake amplitude | Camera applies shake |
| **Settings** | Inbound | VFX density preset | Scales all VFX |
| **HUD** | Outbound | VFX intensity | HUD ensures readability |
| **Tire System** | Inbound | Wear % | Drives tire smoke intensity |

## Formulas

### Speed Streaks

`streak_intensity = clamp(speed / global_max_velocity, 0, 1)`

Where `global_max_velocity = max(all car top speeds)` from Car Definition Data.

**Output Range:** 0.0 (stationary) to 1.0 (fastest car at max speed).

### Motion Blur

`blur_amount = clamp(speed / global_max_velocity, 0, 1) × 0.5`

**Output Range:** 0.0 (no blur) to 0.5 (50% blur at max speed).

### Vignette

`vignette_intensity = clamp((speed / global_max_velocity) - 0.6, 0, 0.4)`

**Output Range:** 0.0 (below 60% of max) to 0.4 (at max speed).

### Camera Shake

`shake_amplitude = base_amplitude × impact_factor`

Where `impact_factor` = speed / global_max_velocity (for wall hits).

## Edge Cases

- **If speed is exactly 100 km/h:** Streaks at 0.0 intensity (threshold).
- **If speed exceeds 350 km/h:** All effects capped at maximum.
- **If multiple wall hits in same frame:** Shake amplitudes stack (capped at 0.8).
- **If VFX density is Low:** Particles at 25% count, no screen effects.
- **If WebGL performance is poor:** Auto-reduce VFX density to Low.
- **If cockpit camera active:** Same VFX intensity as chase.
- **If rain is active (post-MVP):** Rain particles + wet reflections override dry VFX.
- **If car is stationary:** No speed-based VFX, only idle engine particles.

## Dependencies

| System | Direction | Type | Nature |
|--------|-----------|------|--------|
| **Vehicle Physics** | Inbound | Speed, grip, wall contact | Hard — drives all VFX |
| **Track** | Inbound | Surface type | Hard — drives dust |
| **Camera** | Outbound | Shake amplitude | Hard — camera applies shake |
| **Settings** | Inbound | VFX density preset | Hard — scales all VFX |
| **Tire System** | Inbound | Wear % | Soft — drives smoke intensity |

## Tuning Knobs

| Knob | Current Value | Safe Range | Breaks If Too Low | Breaks If Too High |
|------|--------------|------------|-------------------|-------------------|
| Streak onset speed | 100 km/h | 50–150 km/h | Streaks too early | Streaks too late |
| Blur max amount | 0.5 | 0.3–0.7 | Blur too subtle | Blur too strong |
| Vignette max | 0.4 | 0.2–0.6 | Vignette invisible | Vignette too dark |
| Particle count (Low) | 25% | 10–50% | Too few particles | Performance hit |
| Camera shake max | 0.5 | 0.3–0.8 | Shake too subtle | Shake too strong |
| VFX frame budget | 1.6ms | 1.0–2.5ms | Effects cut short | Frame drops |

## Visual/Audio Requirements

- **Speed streaks:** Directional lines at screen edges, color = environment (green for grass, gray for asphalt).
- **Motion blur:** Radial blur centered on car, intensity scales with speed.
- **Tire smoke:** White/gray particles, volume scales with wear.
- **Sparks:** Orange/yellow particles, burst on wall contact.
- **Dust:** Brown particles, volume scales with surface type (gravel > grass).
- **Camera shake:** Procedural, frequency 20-40 Hz, amplitude scales with impact.
- **Vignette:** Darkened edges, intensity scales with speed.
- **Rain (post-MVP):** White particles falling, wet surface shader, spray particles.

## UI Requirements

No UI requirements for this system. VFX is visual-only.

## Acceptance Criteria

- **GIVEN** Tier1 car at max speed (310 km/h), **WHEN** streaks are rendered, **THEN** intensity is 1.0.
- **GIVEN** Tier4 car at max speed (240 km/h), **WHEN** streaks are rendered, **THEN** intensity is ~0.77.
- **GIVEN** car at 50% of global max, **WHEN** blur is rendered, **THEN** amount is 0.25.
- **GIVEN** car at 60% of global max, **WHEN** vignette is checked, **THEN** intensity is 0.0 (threshold).
- **GIVEN** wall hit at 100 km/h, **WHEN** sparks are rendered, **THEN** 10-30 particles burst.
- **GIVEN** grip loss at 0.5, **WHEN** tire smoke is rendered, **THEN** 5-20 particles per frame.
- **GIVEN** VFX density Low, **WHEN** particles are rendered, **THEN** count is 25% of High.
- **GIVEN** cockpit camera, **WHEN** VFX intensity is checked, **THEN** same as chase camera.

## Open Questions

- **Speed streak color:** Should streaks match environment color (green for grass) or be neutral (white/gray)?
- **HDR support:** Should VFX use HDR for brighter sparks/glow effects?
- **Performance scaling:** Should VFX auto-reduce on low-end hardware, or rely on preset only?
- **Night racing:** Should VFX include headlight beams, taillight trails? (Post-MVP)
- **Damage VFX:** Should car damage show visual effects (smoke, sparks from damaged parts)? (Post-MVP)
