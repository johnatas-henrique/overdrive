# Story 005: Grid Slot Materialization & Validation

> **Epic**: Track
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.0h

## Context

**GDD**: `design/gdd/track-system.md` + `grid-start.md`
**Requirement**: `TR-track-001` (grid positions in JSON) — materialization + validation split per QL-STORY-READY 2026-08-16
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0007 (StartGridDefinition)
**ADR Decision Summary**: `StartGridDefinition { firstRowPointIndex, rowSpacing 8m, columnOffset, firstCornerRight }`. 16 deterministic grid slots materialized from the definition; no two positions closer than 2m; invalid row/column spacing rejected at load with a descriptive `ContentLoadError(Track)` — never silently repaired. Actual car spawning is Grid & Start's.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C#.

**Control Manifest Rules (this layer)**:
- Required: grid slots materialized deterministically; min 2m spacing; invalid spacing → ContentLoadError(Track), never silent repair

---

## Acceptance Criteria

*From ADR-0007 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] 16 deterministic grid slots materialized from `StartGridDefinition` (firstRowPointIndex, rowSpacing 8m, columnOffset, firstCornerRight)
- [ ] Slot transforms/positions exposed with no pair closer than 2m
- [ ] Invalid row/column spacing rejected at load with a descriptive `ContentLoadError(Track)` — never silently repaired at runtime
- [ ] `firstCornerRight` and the authored column offset preserved (Grid & Start consumes the direction for stagger)

---

## Implementation Notes

*Derived from ADR-0007 Implementation Guidelines:*

- Grid materialization is data-derived (new tracks = data changes only)
- The load-time validation may live in Story 001's validator (it owns content validation) — the seam decision is documented at implementation; the AC is the same
- Actual car spawning, spawn-overlap integration, and stagger-by-direction belong to Grid & Start (race-flow epic)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [race-flow Story 008]: car spawning, stagger, grid-lock
- [Story 001]: load-time validation host (if merged there — AC unchanged)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (materialization)**: valid StartGridDefinition → 16 deterministic slots with correct spacing/offsets
- **AC-2 (spacing)**: no pair closer than 2m; edge: exactly 2m
- **AC-3 (validation)**: invalid row/column spacing → ContentLoadError(Track) with description, no repair; edge: boundary spacing values
- **AC-4 (direction)**: firstCornerRight + column offset preserved

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/content/TrackDataTests.cs` — grid slots, validation
- Logic companion: `Assets/tests/unit/content/TrackDataTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (loaded TrackData / validator)
- Unlocks: race-flow Story 008 (Grid & Start)
