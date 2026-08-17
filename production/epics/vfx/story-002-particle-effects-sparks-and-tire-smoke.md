# Story 002: Particle Effects — Sparks & Tire Smoke

> **Epic**: VFX
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Visual/Feel
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/vfx.md`
**Requirement**: `TR-vfx-003` (density presets + live caps)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0010: Camera-VFX Rendering Budget and Interpolation
**ADR Decision Summary**: Wall impact sparks: injected `WallContactInput { impactSpeedKmh = 100 }` → spark burst count 10-30 (wall detection is VP-owned). Tire smoke: injected `TireSmokeRequest { requestedRate, deltaTime }` — at 60 FPS, 300-1200/s converts to ≈5-20 requested particles/frame; actual emission capped by the live-particle capacity. Live caps per `VfxDensityLevel`: Low 25, Medium 50, High 100, Ultra 150 per car (tested across all tire emitters for one car). The grip_loss → emission-rate mapping is Tire's; VFX consumes the request (per QL-STORY-READY 2026-08-16).

**Engine**: Unity 6000.3.22f1 | **Risk**: HIGH
**Engine Notes**: ParticleSystem (VFX Graph NOT installed per ADR-0010); deterministic particle math testable.

**Control Manifest Rules (this layer)**:
- Required: sparks 10-30; smoke requested 300-1200/s → capped by live capacity
- Required: density caps 25/50/100/150 per car; ParticleSystem (no VFX Graph)

---

## Acceptance Criteria

*From vfx.md + ADR-0010, scoped per QL-STORY-READY 2026-08-16 (particles split from policy):*

- [ ] **Sparks**: injected `WallContactInput { impactSpeedKmh = 100 }` → spark burst count 10-30 (wall detection VP-owned)
- [ ] **Smoke request**: injected `TireSmokeRequest { requestedRate, deltaTime }` — 300-1200/s at 60 FPS → ≈5-20 requested particles/frame; actual emission capped
- [ ] **Live cap**: injected `VfxDensityLevel` → live smoke counts never exceed 25/50/100/150 per car (tested across all tire emitters for one car)
- [ ] Grip-loss → emission-rate mapping is Tire's (VFX consumes the request — the GDD does not define the mapping)

---

## Implementation Notes

*Derived from ADR-0010 Implementation Guidelines:*

- Sparks: wall detection is VP-owned (CarState.WallContact); VFX receives the impact input
- Tire smoke: the request carries the rate; VFX converts by frame delta and applies the live-particle cap
- The emission-rate mapping from grip_loss is Tire-owned (the GDD leaves it undefined — VFX consumes `TireSmokeRequest`)
- ParticleSystem is the MVP emitter (VFX Graph NOT installed)
- **Emitter anchor contract (rig gap closure 2026-08-16, corrected)**: VFX NEVER anchors by object name — the art pipeline's ASR export names (`WHEEL_*`/`TYRE_*`/`STEER_HR`) are Assetto Corsa export conventions from an in-progress pilot, NOT a validated contract. Anchoring uses a semantic socket-slot component on the car prefab (`CarSocketAnchors`): rear-wheel sockets (tire smoke), impact-projection point (sparks), steering-wheel socket (rig). The art pipeline fills the slots when building the final prefab; an empty mandatory slot is a clear EDITOR warning, never a silent runtime miss. VFX consumes pre-resolved Transform references — the internal object names are irrelevant.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 003]: runtime quality policy (PerformanceReduced density, parity)
- [vehicle-physics]: wall contact detection
- [race-strategy]: grip_loss → emission-rate mapping

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-SPARKS**: inject wall contact 100 km/h → burst 10-30; no direct collision-monitor read
- **AC-SMOKE**: inject 300 and 1200/s with Δt=1/60 → requested ≈5 and ≈20/frame; actual never exceeds live cap
- **AC-CAPS**: each density near capacity → per-car aggregate never exceeds 25/50/100/150

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**:
- Visual/Feel: `production/qa/evidence/vfx-particles-density-evidence.md` + screenshots
- Logic: `Assets/tests/unit/vfx/VfxParticleTests.cs` (burst count, request conversion, cap enforcement)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (screen-space base), vehicle-physics (wall contact), race-strategy (TireSmokeRequest)
- Unlocks: Story 003 (policy composes)
