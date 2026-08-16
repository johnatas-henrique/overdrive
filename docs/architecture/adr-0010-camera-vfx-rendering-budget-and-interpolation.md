# ADR-0010: Camera-VFX Rendering Budget and Interpolation

## Status

Accepted

## Date

2026-07-28

**Amended:** 2026-08-05 — Cockpit is default/primary (Chase is accessibility option); shake aligned to camera.md three additive angular layers clamped at 3.0° total; ImpactShakeRequest source corrected (VP writes CarState.WallContact → VFX emits → Camera consumes; Camera never reads CarCollisionMonitor directly — resolves review C3); Finished replaced with TerminalPresentation three-quarter view; MotionBlur quality mapping corrected (URP enum has no Off — Low preset disables override).

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
- **Camera shake:** driven by wall-contact data: VP writes `CarState.WallContact` → VFX reads at tick → emits `ImpactShakeRequest` → Camera applies. Camera never reads CarCollisionMonitor directly. Shake is presentation-only, never simulation.
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
    public CameraMode mode;          // Cockpit, Chase, PitCamera, Finished, Replay
    public bool toggleRequest;       // from CameraToggle action (presentation-only)
    public ImpactShakeRequest shake; // from VFX system, emitted from CarState wall/impact data
                                     // (VP writes CarState.WallContact → VFX emits → Camera consumes)
    public bool reducedMotion;       // from AccessibilitySettings (disables shake)
}

// VFX System — runs in LateUpdate (per ADR-0001 §Interpolation Phases)
public class VfxSystem {
    public void Tick(
        VisualTransform interpolatedTransform,
        CarVisualState[] carStates,     // visual copies: speed, surface, pitting, gear
        VfxQualityPreset quality        // Low, Medium, High, Ultra (from Settings)
    );
}

// Shared rendering budget (authoritative totals in the table below)
// Camera: 0.18ms per frame (position, rotation, FOV, shake, mode transitions)
// VFX:   1.27ms per frame (particles, speed lines, confetti, heat haze, dust, vignette)
// Unity overhead: 0.80ms; Combined: 2.25ms of the ~16.6ms frame budget (at 60 FPS)
```

### Update Timing

```
Simulation tick (60 Hz, manual accumulator per ADR-0001):  Tick pipeline (Steps 1-14, 14-step model including Step 9b + counters)
LateUpdate (frame):      PresentationDriver (ADR-0001 Interpolation Phases):
                         1. Interpolate VisualTransform
                         2. CameraSystem.Tick()
                         3. VfxSystem.Tick()
                         4. AudioSystem.Tick()
                         5. HUD update
                         → Presentation rendering
```

### Camera Modes

```
Cockpit:   Driver-eye POV. Steering wheel in foreground.
            Default and primary mode (camera.md).
            Dynamic FOV: 78° → 95° quadratic per camera GDD.
            Reduced Motion pins FOV to the 78° base. Dashboard visible.
            Per-car cockpit offset (Car Definition Data).

Chase:     Follow camera behind car, configurable distance/height. Accessibility/spectacle option.
            Dynamic FOV: 70° → 90° quadratic per camera GDD.
            Directional Velocity as FOV anchor — not raw speed.

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

Finished:  TerminalPresentation — dedicated external three-quarter view of the player car,
           anchored per car/track (camera.md). Active for 0–5s, skippable via Confirm.
           No player camera switching during terminal presentation.

Transitions:
  Chase ↔ Cockpit: 0.35s smooth blend (lerp position + Slerp rotation) per camera.md (TR-camera-001).
  PitCamera → active: 0.2s blend on entry/exit — intentional distinction: pit camera is a functional automatic view, not a player-selected mode; faster blend minimizes time out of the action (camera.md remains authoritative for player mode switches).
  No snap transitions except on race start (Countdown → GO).
```

### Camera Look-Ahead

Chase camera anticipates car direction for smoother visual tracking:

- `lookAheadOffset = velocityDirection × speed × lookAheadFactor` (velocity direction projected on XZ — not car heading — so the look-ahead follows the trajectory and the drift stays visible when heading diverges; race-feel prototype validation 2026-08-03)
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

Layers (aligned with camera.md — three additive angular layers, clamped at 3.0° total):
  Speed shake:        amplitude 0°→0.15° (Y) / 0°→0.05° (X), 30-50 Hz, proportional to speed
                      (camera.md:95 — initial defaults subject to playtest; 30-50 Hz approaches the
                      60 Hz frame Nyquist, so playtest must verify no aliasing artifacts before locking)
  Surface feedback:   amplitude 0.3°-0.6°, 15-25 Hz, curb/rumble strip/off-track
  Impact shake:       0.8°-2.5°, sharp decay 0.2-0.5s, wall/car contact
  total_shake = min(speed_shake + surface_shake + impact_shake, 3.0°)
  When the total exceeds 3.0°, lower-priority layers are reduced first (camera.md edge case rule).
```

### VFX Effects

```
Speed lines:     Screen-space streaks on background only (art bible Section 7).
                 Implemented via FullScreenPassRendererFeature with Full Screen Shader Graph material (URP 17.3 Render Graph API — not legacy Blit).
                  Intensity: `clamp((speed - streak_onset_speed) / (global_max_velocity - streak_onset_speed), 0, 1)`.
                  `streak_onset_speed` defaults to 100 km/h; `global_max_velocity` is the maximum top speed across the loaded grid (per vfx.md).
                  Color: environment-colored (green for grass, gray for asphalt) per vfx.md.
                 Render priority: highest.

Motion blur:     URP Volume Motion Blur override.
                 Quality mapping (URP MotionBlurQuality enum has NO Off value):
                   Low preset → override disabled (intensity 0)
                   Medium preset → MotionBlurQuality.Low
                   High/Ultra preset → MotionBlurQuality.High
                 Mode: CameraOnly (cheaper, sufficient for racing).
                 Clamp: 0.05 (URP default).
                 Disabled entirely in Reduced Motion mode.

 Tire smoke:      ParticleSystem, white/gray per vfx.md.
                  Requested emission is frame-delta scaled from grip loss; actual emission is clamped by the selected per-car live-particle cap.
                  Max alive particles/car: Low 25, Medium 50, High 100, Ultra 150.

Sparks:          ParticleSystem, orange/yellow radial burst.
                 Emitted on wall contact (VFX reads CarState.WallContact — never the monitor directly).
                 Duration: 0.3-0.8s above 50 km/h; 0.5-1.2s above 150 km/h. No sustained spark.

Dust:            ParticleSystem, brown particles on gravel/grass.
                 Limited to 16 active dust emitters across the grid.

Vignette:        Screen-space effect. Intensity follows the vfx.md speed formula;
                 starts at 60% of global_max_velocity and caps at 0.4.

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
VFX tire smoke      | 0.50 ms   | 16 cars × selected live-particle cap; Medium default is 50/car
VFX sparks          | 0.20 ms   | Burst on collision events
VFX confetti        | 0.10 ms   | Race finish only (culled otherwise)
VFX heat haze       | 0.10 ms   | Shader pass
VFX dust            | 0.05 ms   | Up to 16 active dust emitters across the grid
VFX vignette        | 0.01 ms   | Screen-space speed effect
VFX quality switch  | 0.01 ms   | Per-frame cost of evaluating presets
Unity overhead      | 0.80 ms   | ParticleSystem update, transform sync, culling
Total               | 2.25 ms   | Within 2.4 ms target (allowing 0.15 ms headroom)
```

### PerformanceReduced Signal

When simulation detects sustained <30 FPS for 3s (per ADR-0001), VFxSystem moves to Low preset and CameraSystem disables shake. When FPS recovers to ≥30 for 3s, both systems restore their previous preset. This is driven by `PerformanceReduced` flag from Simulation — Camera/VFX consume the signal but do not own it.

### Quality Presets

```
Low:
  Speed lines:    on (no performance impact — screen-space shader)
  Motion blur:    off (expensive on low-end)
  Tire smoke:     25 max alive particles per car
  Sparks:         off
  Confetti:       off
  Resolution:     0.75× render scale

Medium (default):
  Speed lines:    on
  Motion blur:    8 samples
  Tire smoke:     50 max alive particles per car
  Sparks:         on (duration follows wall-impact speed)
  Confetti:      off (displayed in menu only)
  Resolution:     0.85× render scale

High:
  Speed lines:    on
  Motion blur:    16 samples
  Tire smoke:     100 max alive particles per car
  Sparks:         on (duration follows wall-impact speed)
  Confetti:      on in-race
  Resolution:     1.0× render scale

Ultra:
  Speed lines:    on
  Motion blur:    16 samples
  Tire smoke:     150 max alive particles per car
  Sparks:         on (duration follows wall-impact speed)
  Confetti:       on in-race
  Resolution:     1.0× render scale
```

## Consequences

- **No Cinemachine dependency:** Camera is a simple Transform lerp. Lower learning curve, smaller build, no version risk.
- **No VFX Graph dependency:** ParticleSystem is universally supported. VFX Graph can be introduced later without breaking the contract.
- **Interpolated transforms:** Camera and VFX never read simulation state directly — they consume visual copies produced after interpolation.
- **Budget separation:** The 2.25ms combined budget is distinct from the 6ms simulation budget. They don't compete.
- **Reduced Motion supported:** Shake disabled, motion blur disabled. Speed lines remain (static opacity). Confetti display unaffected.

## Validation Criteria

- [ ] Camera position/rotation matches interpolated VisualTransform within 0.001m tolerance
- [ ] Chase ↔ Cockpit transition completes under 0.5s with no visible snap
- [ ] Camera shake disabled when Reduced Motion is active (amplitude = 0)
- [ ] Speed-line intensity is 0 at `streak_onset_speed` and 1 at `global_max_velocity`, verified against the vfx.md formula at 10 km/h intervals
- [ ] VFX combined budget ≤ 2.4ms on target hardware (profiled with 16 cars)
- [ ] Quality presets apply without recompilation or scene reload

## Related Decisions

- ADR-0001: Interpolated visual transforms from Simulation Architecture
- ADR-0002: CarCollisionMonitor forwards collision contact to VP; VP writes CarState.WallContact → VFX → ImpactShakeRequest → Camera (shake path, review C3)
- ADR-0005: CameraToggle routing (presentation-only, no sim tick)
- ADR-0007: Track spline for camera position sampling

## GDD Requirements Addressed

| GDD | Requirements |
|-----|--------------|
| camera.md | Custom C# camera controller (no Cinemachine), Chase/Cockpit/PitCamera/Finished modes, quadratic FOV response, 3-layer camera shake, PitCamera blend, look-ahead, collision avoidance |
| vfx.md | ParticleSystem (no VFX Graph), environment-colored speed lines, white/gray tire smoke with requested-emission and live-particle-cap contract, orange/yellow impact sparks, brown dust, speed-driven vignette, heat haze shader, confetti, PerformanceReduced handling |
| hud.md | Performance warning integration (discrete HUD element during <30 FPS sustained) |
| settings.md | ReducedMotion toggle in CameraSettings, VfxQualityPreset (Low/Medium/High) |
