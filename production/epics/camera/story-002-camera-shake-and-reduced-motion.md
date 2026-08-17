# Story 002: Camera Shake & Reduced Motion

> **Epic**: Camera
> **Status**: Ready
> **Layer**: Core + Presentation
> **Type**: Visual/Feel
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/camera.md`
**Requirement**: `TR-camera-002` (3-layer shake)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0010: Camera-VFX Rendering Budget and Interpolation (amended: shake 3 additive angular layers clamped 3.0° total; ImpactShakeRequest source corrected — VP writes CarState.WallContact → VFX emits → Camera consumes; Camera NEVER reads CarCollisionMonitor directly)
**ADR Decision Summary**: Three additive angular shake layers (Speed Vibration ~0.15°, Surface ~0.3°, Impact 0.8-2.5° decaying <10% peak within 0.5s) clamped to 3.0° total, speed reduced first. ImpactShakeRequest is consumed via the VFX-emitted seam. Reduced Motion suppresses shake (0°) without mutating saved preferences (Settings owns preference resolution).

**Engine**: Unity 6000.3.22f1 | **Risk**: MEDIUM
**Engine Notes**: Custom C# camera; angular offsets in the LateUpdate presentation pass.

**Control Manifest Rules (this layer)**:
- Required: 3-layer shake clamped 3.0° total, speed reduced first; impact via VFX-emitted request
- Required: Reduced Motion → shake 0, no preference mutation (Settings owns)

---

## Acceptance Criteria

*From camera.md + ADR-0010, scoped per QL-STORY-READY 2026-08-16 (002A split):*

- [ ] **SH1**: injected top-speed visual sample on smooth surface → speed vibration layer 0.10-0.20° (X/Y axis targets verified separately where applicable)
- [ ] **SH2**: given a VFX-emitted `ImpactShakeRequest` carrying an approved impact amplitude → camera applies 0.8-2.5° and decays below 10% within 0.5s (the VP→VFX source chain is a separate integration test)
- [ ] **SH3**: injected speed 2.0° + impact 1.5° → total clamped to 3.0°, speed vibration reduced first (lower priority)
- [ ] **SH4**: injected surface-feedback sample/request → surface shake 0.2-0.4°
- [ ] **SH5/RM1**: resolved runtime preferences report Reduced Motion → shake 0°, zero look-ahead, FOV base; transitions + collision avoidance remain active; camera does NOT mutate the supplied settings/resolver (persistence/non-mutation is Settings integration coverage)

---

## Implementation Notes

*Derived from ADR-0010 Implementation Guidelines:*

- The impact source chain is: VP CarState.WallContact → VFX emits ImpactShakeRequest → Camera consumes. Camera NEVER reads CarCollisionMonitor (2026-08-05 review C3 resolution)
- Shake layers are additive angular offsets applied AFTER the base pose computation (Story 001)
- Clamp order: reduce speed layer first (lowest priority), then surface, then impact
- Reduced Motion resolves through `IRuntimePreferenceResolver`/runtime camera preferences — the camera is a consumer only

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 002B]: collision avoidance (separate story)
- [VFX epic]: ImpactShakeRequest emission (consumed here)
- [Settings epic]: preference persistence/non-mutation
- [vehicle-physics]: WallContact write

---

## QA Test Cases

*Written by qa-lead at story creation (manual — Visual/Feel):*

- **AC-SH1**: smooth track top-speed → speed layer 0.10-0.20°
- **AC-SH2**: inject VFX ImpactShakeRequest → peak 0.8-2.5°, decay <10% within 0.5s
- **AC-SH3**: inject 2.0+1.5 → total ≤3.0°, speed reduced first
- **AC-SH4**: inject curb/surface feedback → 0.2-0.4°
- **AC-SH5/RM1**: toggle Reduced Motion while moving → shake/look-ahead zero, FOV base, transitions + avoidance active, original working values return when disabled

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**:
- Visual/Feel: `production/qa/evidence/camera-002a.md` + sign-off
- Seam tests: `Assets/tests/integration/simulation/CameraTests.cs` (shake layer math, clamp order, decay curve)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (base pose), VFX epic (ImpactShakeRequest seam), Settings (runtime preference resolver)
- Unlocks: Story 002C (shake persists into pit/terminal modes)
