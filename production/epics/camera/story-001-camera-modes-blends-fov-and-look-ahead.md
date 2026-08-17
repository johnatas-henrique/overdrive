# Story 001: Camera Modes, Blends, FOV & Look-Ahead

> **Epic**: Camera
> **Status**: Ready
> **Layer**: Core + Presentation
> **Type**: Visual/Feel
> **Manifest Version**: 2026-08-05
> **Estimate**: 2.0h

## Context

**GDD**: `design/gdd/camera.md`
**Requirement**: `TR-camera-001` (cockpit/chase), `TR-camera-003` (FOV), `TR-camera-004` (look-ahead)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0010: Camera-VFX Rendering Budget and Interpolation (Cockpit default/primary, Chase accessibility option)
**ADR Decision Summary**: Camera consumes `InterpolatedVisualTransform`/`PublishedSimulationSnapshot` — never live simulation state. CameraToggle is presentation-only (never enters SimulationInput/Ghost). Mode transitions: exactly one per rising-edge request; position/rotation/FOV lerp over defined durations with smoothstep. Per-car cockpit offsets without changing global mode/blend timing. FOV quadratic (Cockpit 78-95°, Chase 70-90°) with speed_ratio clamped. Chase look-ahead follows the velocity direction (not heading).

**Engine**: Unity 6000.3.22f1 | **Risk**: MEDIUM
**Engine Notes**: Custom C# camera (Cinemachine NOT installed); manual LateUpdate presentation pass.

**Control Manifest Rules (this layer)**:
- Required: presentation consumes interpolated presentation state, never live simulation state
- Required: CameraToggle is presentation-only; per-car cockpit offsets from Car Definition

---

## Acceptance Criteria

*From camera.md + ADR-0010, scoped per QL-STORY-READY 2026-08-16:*

- [ ] **CM1**: given an injected interpolated cockpit pose and stable Cockpit mode, camera base rotation matches the pose within ±0.5° (measured before shake/look-ahead additives)
- [ ] **CM2**: given chase mode + a no-slip 90° velocity-direction turn, the filtered horizontal velocity-direction target is reached within 0.10-0.14s (heading benchmark only with no-slip fixture)
- [ ] **CM3**: given one presentation-layer `ToggleRequest` at the Camera seam, exactly one transition starts; position/rotation/FOV use smoothstep with the defined durations (0.35s/0.30s/0.25s)
- [ ] **CM3a**: camera consumes one injected rising-edge request once; held/no-new-edge input creates no further transition ("never enters SimulationInput/Ghost" is Input/Ghost integration scope)
- [ ] **CM4**: zero-speed base chase anchor = 4.5m behind, 1.8m above (±0.2m); low-speed look-ahead onset defined (avoids LA1 conflict)
- [ ] **CM5**: injected two car definitions with different cockpit offsets → only the active offset changes; global mode and blend durations unchanged
- [ ] **FOV1/2/4/5**: injected speed/mode samples with no active transition → Cockpit 78°/95° and Chase 70°/90° (±2°)
- [ ] **FOV3**: dynamic speed-FOV response while mode is stable: 100%→0% speed settles in 0.12-0.18s (mode-switch FOV blending separate at 0.25s)
- [ ] **FOV6**: injected speed above top speed → speed_ratio clamps to 1.0, FOV ≤ max
- [ ] **LA1**: chase straight-line fixtures → look-ahead ~0.5m low-speed → ~3m top-speed (±0.1m), quadratic growth at named samples
- [ ] **LA2**: drift fixture (heading ≠ velocity) → look-ahead vector direction matches normalized horizontal velocity direction within an angular tolerance, not heading
- [ ] **LA3**: cockpit output has zero look-ahead for identical movement samples
- [ ] **TR1/TR2**: mode switch during active blend → restarts from current blend weight toward new target; blend complete + 0.1s → look-ahead/shake apply normally (transition-controller behavior)

---

## Implementation Notes

*Derived from ADR-0010 Implementation Guidelines:*

- All inputs injected at the seams (interpolated pose, ToggleRequest, per-car cockpit config, speed samples) — no direct Input/Simulation/VP access
- The camera is presentation-only: it never reads CarCollisionMonitor, VP internals, or SimulationInput
- Blend durations: position 0.35s, rotation 0.30s, FOV 0.25s (smoothstep)
- Look-ahead formula per TR-camera-004: velocityDirection × speed × lookAheadFactor (quadratic)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 002A/002B]: shake, collision avoidance
- [Input epic]: CameraToggle not entering SimulationInput/Ghost (integration coverage)
- [race-flow]: velocity telemetry production (consumed via snapshot)

---

## QA Test Cases

*Written by qa-lead at story creation (manual — Visual/Feel):*

- **AC-CM1**: cockpit, additives suppressed, rotate car through known angles → base rotation error ≤0.5°
- **AC-CM2**: chase no-slip 90° velocity-direction turn → filtered response completes in 0.10-0.14s
- **AC-CM3**: inject one toggle edge → exactly one transition; smoothstep; durations 0.35/0.30/0.25s
- **AC-CM3a**: hold toggle, release, press again → one per press; no transition on hold
- **AC-CM4**: chase at zero speed → anchor 4.5m/1.8m ±0.2m
- **AC-CM5**: switch cars with different offsets → correct offset, mode/blend unchanged
- **AC-FOV1-6**: injected speed/mode samples → 78/95/70/90 ±2°; FOV3 settles 0.12-0.18s; FOV6 clamps ratio
- **AC-LA1-3**: fixtures → 0.5m→3m quadratic ±0.1m; velocity-direction during drift; zero in cockpit
- **AC-TR1/2**: blend restart from current weight; +0.1s → normal application

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**:
- Visual/Feel: `production/qa/evidence/camera-001.md` + sign-off (debug overlay: mode/transition weights/FOV/look-ahead/timestamps)
- Seam tests: `Assets/tests/integration/simulation/CameraTests.cs` (numeric contracts — mode anchors, blend durations, FOV values)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: vehicle-physics-feel (telemetry/InterpolatedVisualTransform), Input (CameraToggle presentation request)
- Unlocks: Stories 002A-002C
