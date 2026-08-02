# ADR-0010: Camera-VFX Rendering Budget and Interpolation

## Status

Accepted

## Date

2026-07-28

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Presentation / Rendering |
| **Knowledge Risk** | HIGH — URP 17.3 post-cutoff. Volume framework APIs and Render Graph (VRG) confirmed stable via runtime reflection. VFX Graph not installed (MVP uses ParticleSystem). Cinemachine not installed (MVP uses custom C# camera). |
| **References Consulted** | `design/gdd/camera.md`, `design/gdd/vfx.md`, `docs/architecture/architecture.md` |
| **Post-Cutoff APIs Used** | URP 17.3 Volume overrides (MotionBlur). Verified via runtime reflection: `Volume`, `VolumeProfile`, `MotionBlur` present in `UnityEngine.Rendering.Universal`. FullScreenPassRendererFeature for screen-space speed lines (Render Graph API, legacy Blit is obsolete). |
| **Verification Required** | Camera 0.5ms + VFX 1.6ms budgets measured in integrated prototype. Motion Blur quality modes on target hardware. Custom render passes must use `RecordRenderGraph` — `ScriptableRenderPass.Execute()` and `Blit()` are obsolete/dead code in URP 17.3 Render Graph. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (interpolated visual transforms from Simulation Architecture). ADR-0002 (car collision contact data for shake). ADR-0006 (fuel/tire state for HUD-driven VFX). ADR-0007 (track spline for camera position sampling) |
| **Enables** | Camera implementation (cockpit/chase/transition/PitCamera). VFX implementation (speed streaks, tire particles, confetti, impact) |
| **Blocks** | None — camera and VFX can be implemented after Foundation ADRs are settled |
| **Ordering Note** | Camera requires interpolated VisualTransform from Simulation Architecture per ADR-0001. VFX CameraToggle routing requires ADR-0005 |

## Context

Camera and VFX share the Presentation layer — both consume interpolated visual transforms (produced by Simulation Architecture in LateUpdate per ADR-0001), both run in LateUpdate (after all Update() scripts, before render), and both draw from the same rendering budget. Camera owns viewpoint positioning (cockpit view, chase view, transitions, PitCamera). VFX owns all particle effects (speed lines, tire smoke, sparks, confetti, exhaust heat haze). Neither system touches simulation state — they read visual copies only.

### Registry Check

Existing stances relevant to Camera-VFX:
- **Performance budget:** simulation pipeline p95 ≤ 6ms (ADR-0001). Camera+VFX rendering budget is separate from simulation — they share the remaining ~10ms of the 16.6ms frame (at 60 FPS).
- **CameraToggle routing:** presentation-only, never enters SimulationInput or tick pipeline (ADR-0005). Owned by Camera, triggered by InputAction.performed.
- **Camera shake:** driven by collision contact data from CarCollisionMonitor (ADR-0002). Shake is presentation-only, never simulation.
- **URP 17.3 Volume overrides** installed and verified: Bloom, Tonemapping, MotionBlur, Vignette.
- **No Cinemachine** — MVP uses basic Unity Camera + custom C# camera controller.
- **No VFX Graph** — MVP uses ParticleSystem components.

## Decision

Camera uses **custom C# controller** (no Cinemachine dependency) reading interpolated VisualTransform produced by Simulation Architecture in LateUpdate per ADR-0001 §Interpolation Phases. VFX uses **ParticleSystem** components (no VFX Graph dependency). Both run in LateUpdate, consuming simulation output through interpolation.

### Key Interfaces

```csharp
// Camera System — runs in LateUpdate (per ADR-0001 §Interpolation Phases)
public class CameraSystem {
    public void Tick(
        VisualTransform interpolatedTransform,  // lerped between latest two tick snapshots
        CameraState input                       // camera mode, toggle edge, shake request
    );
}

public struct CameraState {
    public CameraMode mode;          // Chase, Cockpit, PitCamera, Finished, Replay
    public bool toggleRequest;       // from CameraToggle action (presentation-only)
    public ImpactShakeRequest shake; // from CarCollisionMonitor (optional per tick)
    public bool reducedMotion;       // from AccessibilitySettings (disables shake)
}

// VFX System — runs in LateUpdate (per ADR-0001 §Interpolation Phases)
public class VfxSystem {
    public void Tick(
        VisualTransform interpolatedTransform,
        CarVisualState[] carStates,     // visual copies: speed, surface, pitting, gear
        VfxQualityPreset quality        // Low, Medium, High (from Settings)
    );
}

// Shared rendering budget
// Camera: 0.5ms per frame (position, rotation, FOV, shake, mode transitions)
// VFX:   1.6ms per frame (particles, speed lines, confetti, heat haze)
// Combined: 2.1ms of the ~16.6ms frame budget (at 60 FPS)
```

### Update Timing

```
Simulation tick (60 Hz, manual accumulator per ADR-0001):  Tick pipeline (Steps 1-14, 14-step model including Step 9b + counters)
DynamicUpdate (frame):   Simulation publishes interpolated VisualTransform
LateUpdate (frame):      CameraSystem.Tick()
                         VfxSystem.Tick()
                         HUD update
                         Presentation rendering
```

### Camera Modes

```
Chase:     Follow camera behind car, configurable distance/height. Default.
           Speed-sensitive FOV (40–65°), wider at high speed per camera GDD.
           Directional Velocity as FOV anchor — not raw speed.

Cockpit:   Driver-eye POV. Steering wheel in foreground.
           FOV fixed at ~75–80°. Dashboard visible.
           Per-car cockpit offset (Car Definition Data).

PitCamera: Dedicated external camera. Active only during InPitBox state.
            Blends from active camera on pit entry, blends back on pit exit.
            Trigger: CameraSystem reads CarState.PitPhase from the interpolated
            visual snapshot (published by Simulation at Step 12, interpolated in
            LateUpdate). When PitPhase == InPitBox, initiates 0.2s blend to
            PitCamera. When PitPhase == PitExiting, initiates 0.2s blend back
            to the player-selected camera mode (Chase or Cockpit).
            Offset is **side-aware**: CameraSystem reads PitLaneSide (Right/Left)
            from the loaded TrackData and mirrors the camera offset accordingly.
            Right-side pits → camera offset to the left of the car, aiming right.
            Left-side pits → camera offset to the right of the car, aiming left.
            No player control during service (FOV fixed at 60°).

Finished:  Slow orbit around car, 0–5s, skippable via Confirm.
           Gentle 0.5m amplitude oscillation, no shake.

Transitions:
  Chase ↔ Cockpit: 0.2s smooth blend (lerp position + Slerp rotation) per GDD.
  PitCamera → active: 0.2s blend on exit begin.
  No snap transitions except on race start (Countdown → GO).
```

### Camera Look-Ahead

Chase camera anticipates car direction for smoother visual tracking:

- `lookAheadOffset = forward × speed × lookAheadFactor`
- `lookAheadFactor` scales quadratically with speed:
  - Low speed: minimal offset (~0.5m)
  - High speed: significant offset (~3m)
- Prevents camera lag behind car at high speed
- Cockpit mode: no look-ahead (fixed to driver eye position)

### SphereCast Collision Avoidance

Camera avoids geometry obstruction via SphereCast:

- `Physics.SphereCast(origin, radius, direction, out hit, maxDistance)`
- When hit detected: camera moves forward along cast direction
- Prevents camera clipping through walls, barriers, bridges
- Radius: ~0.3m (small enough for tight corners)
- MaxDistance: dependent on camera distance from car
- Reduced Motion: still active (prevents visual clipping)

### Camera Shake

```
Source chain: CarCollisionMonitor forwards contact impulse magnitude → VehiclePhysics writes to CarState.WallContact → VfxSystem reads at tick → emits impactShakeRequest → CameraSystem applies shake. CameraSystem NEVER reads CarCollisionMonitor directly.
Formula:  amplitude = clamp(impulse / maxImpulse, 0, 1) × intensityCurve(wallType)
          duration = 0.15–0.5s depending on collision severity
Reduced:  When CameraSettings.reducedMotion is true, shake amplitude = 0.
          CameraSettings is the single source of truth for Reduced Motion (per ADR-0004).
          Duration still applies — allows audio/VFX to sync without visual motion.

Layers (aligned with registry):
  Engine vibration:    subtle 0.01m at 60Hz, always active during Racing (per registry)
  Gear shift:          single 0.05m pulse on gear change
  Kerb rumble:         0.03m at wheel contact frequency
  Wall impact:         0.10–0.30m, 0.15–0.5s
```

### VFX Effects

```
Speed lines:     Screen-space streaks on background only (art bible Section 7).
                 Implemented via FullScreenPassRendererFeature with Full Screen Shader Graph material (URP 17.3 Render Graph API — not legacy Blit).
                 Opacity: 0% at <30% max_velocity → 100% at ≥90% max_velocity (relative to car, per GDD).
                 Color: gold→orange gradient with speed.
                 Render priority: highest.

Motion blur:     URP Volume Motion Blur override.
                 Quality: Off (Low), Low (Medium), High (High) — uses URP MotionBlurQuality enum.
                 Mode: CameraOnly (cheaper, sufficient for racing).
                 Clamp: 0.05 (URP default).
                 Disabled entirely in Reduced Motion mode.

Tire smoke:      ParticleSystem, blue-toned (#B8C4D4).
                 Emitted per axle based on slideState.
                 Max particles: 50 per car (MVP budget).

Sparks:          ParticleSystem, golden radial burst.
                 Emitted on wall contact (via CarCollisionMonitor).
                 Duration: 0.2s burst. No sustained spark.

Exhaust heat:    Shader-based (no particle), blue pop on downshift.
                 Subtle shimmer above exhaust at idle.

Confetti:        Gold + white outlined rectangles (matching UI icon style).
                 Emitted at race finish, 2s duration.
                 Render priority: lowest (can be culled under budget).
```

### Performance Budget

```
Component           | Budget    | Notes
Camera position     | 0.05 ms   | Transform lerp + rotation slerp
Camera FOV          | 0.01 ms   | Speed-sensitive lerp
Camera shake        | 0.10 ms   | Per-layer amplitude + duration, Reduced Motion check
PitCamera blend     | 0.02 ms   | Active only during pit entry/exit
VFX speed lines     | 0.30 ms   | Screen-space overlay, fullscreen
VFX tire smoke      | 0.50 ms   | 15 cars × 50 particles max
VFX sparks          | 0.20 ms   | Burst on collision events
VFX confetti        | 0.10 ms   | Race finish only (culled otherwise)
VFX heat haze       | 0.10 ms   | Shader pass
VFX quality switch  | 0.01 ms   | Per-frame cost of evaluating presets
Unity overhead      | 0.80 ms   | ParticleSystem update, transform sync, culling
Total               | 2.19 ms   | Within 2.4 ms target (allowing 0.2 ms headroom)
```

### PerformanceReduced Signal

When simulation detects sustained <30 FPS for 3s (per ADR-0001), VFxSystem moves to Low preset and CameraSystem disables shake. When FPS recovers to ≥30 for 3s, both systems restore their previous preset. This is driven by `PerformanceReduced` flag from Simulation — Camera/VFX consume the signal but do not own it.

### Quality Presets

```
Low:
  Speed lines:    on (no performance impact — screen-space shader)
  Motion blur:    off (expensive on low-end)
  Tire smoke:     25 max particles per car
  Sparks:         off
  Confetti:       off
  Resolution:     0.8× render scale

Medium (default):
  Speed lines:    on
  Motion blur:    8 samples
  Tire smoke:     50 max per car
  Sparks:         on (0.15s burst)
  Confetti:      off (displayed in menu only)
  Resolution:     1.0× render scale

High:
  Speed lines:    on
  Motion blur:    16 samples
  Tire smoke:     100 max per car
  Sparks:         on (0.2s burst)
  Confetti:      on in-race
  Resolution:     1.0× render scale
```

## Consequences

- **No Cinemachine dependency:** Camera is a simple Transform lerp. Lower learning curve, smaller build, no version risk.
- **No VFX Graph dependency:** ParticleSystem is universally supported. VFX Graph can be introduced later without breaking the contract.
- **Interpolated transforms:** Camera and VFX never read simulation state directly — they consume visual copies produced after interpolation.
- **Budget separation:** The 2.1ms combined budget is distinct from the 6ms simulation budget. They don't compete.
- **Reduced Motion supported:** Shake disabled, motion blur disabled. Speed lines remain (static opacity). Confetti display unaffected.

## Validation Criteria

- [ ] Camera position/rotation matches interpolated VisualTransform within 0.001m tolerance
- [ ] Chase ↔ Cockpit transition completes under 0.5s with no visible snap
- [ ] Camera shake disabled when Reduced Motion is active (amplitude = 0)
- [ ] Speed lines opacity 0% at 80 km/h, 100% at 280 km/h (tested at 10 km/h intervals)
- [ ] VFX combined budget ≤ 2.4ms on target hardware (profiled with 16 cars)
- [ ] Quality presets apply without recompilation or scene reload

## Related Decisions

- ADR-0001: Interpolated visual transforms from Simulation Architecture
- ADR-0002: CarCollisionMonitor forwards collision contact for shake
- ADR-0005: CameraToggle routing (presentation-only, no sim tick)
- ADR-0007: Track spline for camera position sampling

## GDD Requirements Addressed

| GDD | Requirements |
|-----|--------------|
| camera.md | Custom C# camera controller (no Cinemachine), Chase/Cockpit/PitCamera/Finished modes, quadratic FOV response, 3-layer camera shake, PitCamera blend, look-ahead, collision avoidance |
| vfx.md | ParticleSystem (no VFX Graph), speed lines (gold→orange gradient), tire smoke (blue-toned #B8C4D4), firework sparks, heat haze shader, confetti, PerformanceReduced handling |
| hud.md | Performance warning integration (discrete HUD element during <30 FPS sustained) |
| settings.md | ReducedMotion toggle in CameraSettings, VfxQualityPreset (Low/Medium/High) |
