# Story 002: RSM Finish Resolution

> **Epic**: Race Flow
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/race-session-manager.md`
**Requirement**: `TR-rsm-003` (FinishOrderResolver)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0018: Race Session Manager Authority (FinishOrderResolver)
**ADR Decision Summary**: When the player crosses the finish line on `totalLaps` (or retires), Simulation captures the immutable PostFinishSnapshot and hands it to RSM once. FinishOrderResolver runs once, consuming ONE snapshot — never re-runs PhysX/Fuel/Tire/Pit/collisions/tactical AI. Player result locked; unfinished trailing AI projected by pace only (mean last two completed lap times, else `sessionTargetLapTime`). MVP projection ignores pit/resource state (cosmetic). Forfeit has no final position and never invokes the resolver. DNF keeps classification; no fabricated position.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C#.

**Control Manifest Rules (this layer)**:
- Required: resolver consumes one PostFinishSnapshot; pace-only projection; classification Finished/DNF preserved
- Required: Forfeit returns no position; never invokes resolver

---

## Acceptance Criteria

*From ADR-0018 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Given one immutable `PostFinishSnapshot`, the resolver reads it once and runs once; no PhysX/Fuel/Tire/Pit/AI calls occur; repeated invocation returns the cached result without re-reading
- [ ] Unfinished trailing AI projected by pace: two completed laps → `mean(lastTwoCompletedLapTimes)`; fewer → `sessionTargetLapTime`
- [ ] Finished and DNF classifications preserved in `ResolvedFinishOrder`; DNF `position` is **nullable** (no fabricated position — schema decision 2026-08-16); Forfeit returns null position and never invokes the resolver
- [ ] `ResolvedFinishOrder` entries carry carId, final classification, finish position (nullable), final/projected time

---

## Implementation Notes

*Derived from ADR-0018 Implementation Guidelines:*

- Resolver is a pure function over the snapshot — no system access
- `sessionTargetLapTime` = the AI's pre-generated qualifying time for the current track/difficulty (from race-flow story 007's generator) — consumed via seam
- The projection is cosmetic (final standing order among trailing AI for the results screen)
- `ResolvedFinishOrder` is the immutable output consumed by Results presentation, Camera terminal, Audio

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 003]: lifecycle transitions (Forfeit request handling)
- [Story 004]: publication contract (resolver output published)
- [ui-menu epic]: Results presentation

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (single snapshot)**: one PostFinishSnapshot → resolver reads once, runs once, returns resolved order; edge: repeated invocation rejected or cached without re-reading
- **AC-2 (pace projection)**: AI with two laps → mean(lastTwo); fewer → sessionTargetLapTime; edge: existing Finished/DNF cars never projected
- **AC-3 (classification)**: Finished/DNF/Forfeit inputs → Finished/DNF preserved, Forfeit null position + no invocation; edge: nullable-position schema confirmed

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/simulation/RaceSessionManagerTests.cs` — resolver single-read, pace projection, classification

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (ranking context), Simulation Kernel (PostFinishSnapshot)
- Unlocks: Story 004 (terminal publication), ui-menu Results
