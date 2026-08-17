# Story 004: Lap Boundary Provider

> **Epic**: Track
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.0h

## Context

**GDD**: `design/gdd/track-system.md` + `race-session-manager.md`
**Requirement**: `TR-track-005` (anti-cut gate data — provider half)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0007 (CrossedLapBoundary) + ADR-0018 (lap authority ownership split)
**ADR Decision Summary**: Track provides the boundary-crossing test (`CrossedLapBoundary(prevMappedProgress, currentMappedProgress)`) and the 90% distance-accumulator data (forward-distance tracking: `max(0, mapped_progress_delta × trackLength)` with one wrap adjustment; reverse/lateral movement does not increase the accumulator). RSM owns the lap-counting rule composition (both conditions), the per-car lap counter, and the `LapCompleted` event — Track is the detection provider.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C#.

**Control Manifest Rules (this layer)**:
- Required: Track provides boundary test + 90% distance data; RSM owns lap authority
- Required: reverse/lateral movement does not increase the anti-cut accumulator

---

## Acceptance Criteria

*From ADR-0007/0018, scoped per QL-STORY-READY 2026-08-16 (split from the original Story 003):*

- [ ] `CrossedLapBoundary(previousMappedProgress, currentMappedProgress)` detects authored wrap, including `0.94 → 0.01`; non-wrap and reverse movement return false
- [ ] Forward-distance accumulator data exposed for RSM: `max(0, mapped_progress_delta × trackLength)` with one wrap adjustment
- [ ] Reverse or lateral movement does not increase the forward-distance accumulator

---

## Implementation Notes

*Derived from ADR-0007/0018 Implementation Guidelines:*

- The boundary test works even when one tick crosses from 0.94 to 0.01 (wrap across 1.0 → 0.0)
- The 90% rule composition (`distanceSinceLastLap > trackLength × 0.90`) and lap counting are RSM's (race-flow epic) — this story supplies the provider data only
- Pit-lane crossings count via the racing-spline mapping (Story 003) — the line crossing inside pit lane is a lap completion per ADR-0018

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [race-flow Story 001]: lap-counting rule composition, LapCompleted event
- [Story 003]: pit→racing mapping (consumed by the wrap test)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (wrap detection)**: `CrossedLapBoundary(0.94, 0.01)` → true; edge: non-wrap, reverse movement → false
- **AC-2 (distance accumulator)**: forward delta accumulates; wrap adjusted once; reverse/lateral → no increase; edge: exactly trackLength traversal
- **AC-3 (pit mapping interplay)**: pit-lane crossing via the racing-spline mapping → wrap detected (data only, no lap event)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/content/TrackDataTests.cs` — wrap detection, accumulator rules

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002 (spline sampling), Story 003 (pit mapping)
- Unlocks: race-flow Story 001 (RSM lap authority)
