# Story 003: Camera Collision Avoidance

> **Epic**: Camera
> **Status**: Ready
> **Layer**: Core + Presentation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.0h

## Context

**GDD**: `design/gdd/camera.md`
**Requirement**: `TR-camera-001` (SphereCast collision avoidance)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0010: Camera-VFX Rendering Budget and Interpolation
**ADR Decision Summary**: Chase camera collision avoidance: within 0.5m of geometry, sphere-cast → camera pulled forward to hit point minus 0.3m buffer (±0.05m); clipped inside geometry (<0.3m) → teleport to fallback (car origin + 0.5m up) and lerp back over 0.20-0.30s. Collision avoidance continues under Reduced Motion. Per QL-STORY-READY 2026-08-16 (002B split): the camera consumes an injectable collision-query result — the real `Physics.SphereCast` adapter is a separate adapter test.

**Engine**: Unity 6000.3.22f1 | **Risk**: MEDIUM
**Engine Notes**: Injectable collision-query seam; real Physics.SphereCast behind an adapter (adapter test separate).

**Control Manifest Rules (this layer)**:
- Required: avoidance active under Reduced Motion
- Required: camera resolves from injected query results (adapter owns the real cast)

---

## Acceptance Criteria

*From camera.md + ADR-0010, scoped per QL-STORY-READY 2026-08-16:*

- [ ] **CA1**: given an injected collision-query hit → camera resolves to hit point minus 0.3m ±0.05m; a separate adapter test verifies the real `Physics.SphereCast`
- [ ] **CA2**: given a hit distance below 0.3m → camera outputs fallback (car origin + 0.5m up), then returns over 0.20-0.30s
- [ ] Reduced Motion enabled → collision avoidance unchanged and remains active

---

## Implementation Notes

*Derived from ADR-0010 Implementation Guidelines:*

- The camera consumes an injectable `ICameraCollisionQuery` result — never casts physics inside the camera controller
- The adapter (real Physics.SphereCast on the track/wall layers) is verified by its own adapter test
- Fallback position: car origin + 0.5m up, lerp back 0.20-0.30s

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 002A]: shake/Reduced Motion (avoidance continues, not owned here)
- [vehicle-physics/track]: wall geometry (the query target)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-CA1**: injected collision-query hit → camera at hit − 0.3m ±0.05m (adapter test separately verifies real SphereCast)
- **AC-CA2**: hit distance <0.3m → fallback car origin +0.5m up; return lerp 0.20-0.30s
- **AC-RM**: repeat CA1/CA2 with Reduced Motion → avoidance unchanged and active

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/CameraTests.cs` (query-seam resolution, fallback, Reduced Motion)
- Adapter test: `Assets/tests/integration/simulation/CameraTests.cs` (real Physics.SphereCast)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (base chase anchor), Track (wall geometry)
- Unlocks: 002C (avoidance in pit/terminal modes)
