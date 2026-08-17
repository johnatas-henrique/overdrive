# Story 003: Pit Geometry & Progress Mapping

> **Epic**: Track
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/track-system.md` + `pit-stop.md`
**Requirement**: `TR-track-003` (pit lane: separate spline, two-lane F1 model, 16 boxes)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0007: Track Spline Format (PitLaneDefinition) + ADR-0011 (pit geometry consumption)
**ADR Decision Summary**: Pit lane is a separate spline (parallel offset, NOT a closed loop). `PitLaneDefinition { entryPointIndex, exitPointIndex, pitEntryProgress, pitSpeedLimitKph 80, side Right/Left per-circuit, boxes[16], pitToRacingProgress[] }`. PitBox { boxId, entryProgress, exitProgress, lateralOffsetMeters ~3m, lengthMeters }. Runtime: GetPitProgress/GetPitBox/GetPitEntryZone/PitProgressToRacing. Pit entry zone exposes authored forward direction (wrong-direction entry → no PitEntry — the zone's direction validation seam returns false).

**Engine**: Unity 6000.3.22f1 | **Risk**: MEDIUM
**Engine Notes**: Pure C# data + mapping.

**Control Manifest Rules (this layer)**:
- Required: pitSpline separate, parallel, NOT closed; 16 boxes ~10m spacing, ~3m lateral offset
- Required: pitToRacingProgress authored mapping; PitLaneSide per-circuit (not derived from direction)

---

## Acceptance Criteria

*From ADR-0007 + GDD, scoped per QL-STORY-READY 2026-08-16 (split from the original Story 003):*

- [ ] Runtime exposes a separate pit spline parallel to racing geometry and NOT closed
- [ ] Authored per-track pit side (Right/Left) and `pitSpeedLimitKph == 80` exposed
- [ ] Exactly 16 unique pit boxes with ~10m longitudinal spacing, ~3m lateral offset from fast lane, valid entry/exit progress
- [ ] `PitProgressToRacing` and `GetPitProgress` use the authored mapping and pass round-trip fixture tests
- [ ] `GetPitEntryZone` exposes entry bounds and the authored forward direction (wrong-direction entry → the zone validation seam returns false; no PitEntry emission — that's Pit/RSM's)

---

## Implementation Notes

*Derived from ADR-0007 Implementation Guidelines:*

- Pit spline is an offset of the racing spline, not a closed loop (cars enter/exit via entry/exit zones)
- `pitToRacingProgress` is the per-sample authored mapping RSM consumes for lap authority (Story 004)
- The 80 km/h clamp is ENFORCED by VP/Pit (their epics) — this story exposes the limit as data
- Pit lane side is a per-circuit authored property (some circuits have pit right, some left — not derived from track direction)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [race-strategy epic]: 80 km/h enforcement, PitEntry event emission/rejection
- [race-flow Story 004]: lap authority (consumes the mapping)
- [hud epic]: Track Map rendering

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (separate spline)**: pit spline parallel, non-closed; mapping round-trips through authored samples
- **AC-2 (16 boxes)**: unique IDs, ~10m spacing, ~3m lateral offsets, valid entry/exit progress
- **AC-3 (entry zone)**: `GetPitEntryZone` bounds + forward direction; wrong-direction → validation seam returns false (no PitEntry tested here)
- **AC-4 (speed limit)**: `pitSpeedLimitKph == 80` exposed as data

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/content/TrackDataTests.cs` — pit geometry + mapping round-trip
- Logic companion: `Assets/tests/unit/content/TrackDataTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (loaded TrackData), Story 002 (spline sampling)
- Unlocks: race-flow (lap authority via pit mapping), race-strategy (pit service), hud (track map)
