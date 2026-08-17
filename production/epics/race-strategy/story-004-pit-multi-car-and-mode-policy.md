# Story 004: Pit Multi-Car & Mode Policy

> **Epic**: Race Strategy
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.0h

## Context

**GDD**: `design/gdd/pit-stop.md`
**Requirement**: `TR-pit-004` (multi-car isolation), qualifying suppression
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0011: Pit Stop Architecture (§PitState, §Validation Criteria)
**ADR Decision Summary**: 16 cars serviced simultaneously without conflict (unique box assignment per car, per-car timers/commands isolated, no shared mutable state). RaceMode.Qualifying suppresses PitEntry/service progression at the PitStop seam. Split per QL-STORY-READY 2026-08-16 (003B).

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C#.

**Control Manifest Rules (this layer)**:
- Required: 16 cars no-conflict; per-car isolation; qualifying suppresses service progression

---

## Acceptance Criteria

*From ADR-0011, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Stable unique box assignment for cars 0..15 (assigned at race init)
- [ ] Per-car service timers and commands are isolated (one car completing/exiting early does not affect others; no shared mutable state)
- [ ] Qualifying suppresses service-command/lifecycle progression at the PitStop seam (RaceMode.Qualifying)
- [ ] AI full-tank policy emitted/represented correctly (from Story 003's service rules, applied per car)

---

## Implementation Notes

*Derived from ADR-0011 Implementation Guidelines:*

- Box assignment: `PitState.assignedBoxId` 0-15, assigned at race init
- The suppression signal is consumed by the qualifying lifecycle (race-flow Story 006) — RSM's PitEntry suppression is tested there, not here
- No direct Fuel/Tire/PitPhase writes — only PitServiceCommand/PitState

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [race-flow Story 006]: RSM/qualifying PitEntry suppression (the seam is consumed here)
- [vehicle-physics]: PitPhase ownership
- [track]: pit geometry (box positions)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (isolation)**: 16 cars enter service simultaneously → unique box IDs, per-car timers/commands independent; edge: cars complete at different times, one exits early, no shared mutable state
- **AC-2 (qualifying)**: RaceMode.Qualifying + Transit/InPitBox-like input → no service command/advisory progression emitted
- **AC-3 (assignment)**: box assignment stable and unique across cars 0..15

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/PitStopTests.cs` — 16-car isolation, mode suppression
- Logic companion: `Assets/tests/unit/simulation/PitStopTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (service rules)
- Unlocks: Story 005 (advisory per car), 16-car race integrity
