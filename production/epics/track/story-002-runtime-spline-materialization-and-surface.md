# Story 002: Runtime Spline Materialization & Surface

> **Epic**: Track
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/track-system.md`
**Requirement**: `TR-track-002` (6 surface types), `TR-track-004` (chordal Catmull-Rom materialization)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0007: Track Spline Format (§Runtime API)
**ADR Decision Summary**: At race init, TrackSystem pre-builds acceleration structures (segment index with Catmull-Rom chordal parameterization, surface lookup table). Per tick: SamplePoint → float3 + forward quaternion, SampleCurvature → curvature radius, SampleSurface → SurfaceType, GetSurfaceGripMultiplier/GetSurfaceWearMultiplier per progress. Closed loop: `SamplePoint(0) == SamplePoint(1)` within float tolerance. Surface table: Asphalt 1.0/1.0, Kerb 0.85/1.2, Gravel 0.4/2.5, Grass 0.3/2.5, Runoff 0.6/2.5, PitLane 1.0/1.0 (grip/wear).

**Engine**: Unity 6000.3.22f1 | **Risk**: MEDIUM
**Engine Notes**: Pure C# math (Catmull-Rom) — no engine-specific APIs.

**Control Manifest Rules (this layer)**:
- Required: chordal Catmull-Rom materialization at race init; surface modifier tables data-driven
- Required: SamplePoint(0) == SamplePoint(1) closed loop within tolerance

---

## Acceptance Criteria

*From ADR-0007 + GDD, scoped per QL-STORY-READY 2026-08-16 (pit mapping moved to Story 003):*

- [ ] At race initialization, chordal Catmull-Rom acceleration data + segment lookup structures are built once from the loaded TrackData
- [ ] `SamplePoint`, `SampleCurvature`, `SampleSurface` return expected values for a deterministic fixture, including progress-boundary tolerances
- [ ] `SamplePoint(0)` equals `SamplePoint(1)` within defined float tolerance (closed loop)
- [ ] Surface getters return the exact approved table values for all six surface types (Asphalt 1.0/1.0, Kerb 0.85/1.2, Gravel 0.4/2.5, Grass 0.3/2.5, Runoff 0.6/2.5, PitLane 1.0/1.0) — provider data only, no VP/Tire behavior asserted
- [ ] Elevation and bank-angle data preserved in the runtime sample/pose; `metadata.elevationRangeMeters` validated

---

## Implementation Notes

*Derived from ADR-0007 Implementation Guidelines:*

- Catmull-Rom ensures smooth tangent derivatives even with non-uniform point spacing (curvature-based sampling from the pipeline)
- SurfaceZone uses inclusive start / exclusive end point indices
- The surface getters are pure provider methods — Vehicle Physics consumes grip, Tire consumes wear (their epics)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 003]: pit geometry + pit→racing mapping (moved per gate)
- [vehicle-physics epic]: grip application
- [race-strategy epic]: tire wear consumption
- Camera tilt: presentation (camera epic)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (materialization)**: deterministic spline fixture → chordal Catmull-Rom sampling + segment lookup return expected positions/tangents within tolerance
- **AC-2 (closed loop)**: closed racing spline → SamplePoint(0) matches SamplePoint(1); edge: progress at zone boundaries, wrapping, out-of-range
- **AC-3 (surface lookup)**: zones with inclusive-start/exclusive-end → SampleSurface + grip/wear getters return the exact approved table; edge: default asphalt gaps, first/last zone, PitLane
- **AC-4 (elevation/banking)**: varying Z elevation + bank angles → preserved in runtime pose/metadata

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/content/TrackDataTests.cs` — spline sampling, closed loop, surface table, elevation

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (loaded TrackData)
- Unlocks: VP grip (surface), Tire wear (surface), AI racing line
