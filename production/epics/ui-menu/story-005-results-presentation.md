# Story 005: Results Presentation

> **Epic**: UI Menu
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.0h

## Context

**GDD**: `design/gdd/ui-menu.md`
**Requirement**: `TR-ui-003` (Results: Normal vs Forfeit vs DNF)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0019 (Results lifecycle) + ADR-0018 (RSM result data) + ADR-0001 (Results state)
**ADR Decision Summary**: Consume an immutable `ResultViewModel`. Finished: position, car name, race time. DNF: "DNF", omit unavailable/fabricated position. Forfeit: "FORFEIT", completed laps, elapsed time; omit position and podium placement. Continue/Back emits the exit request and disables interaction until consumed `ContentUnloadComplete`; then shows Title/Idle. Next Race emits the loading request (UI does not initiate Simulation loading). HUD verifies only suppression/handoff — Results rendering is THIS epic's (per QL-STORY-READY 2026-08-16).

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: uGUI Canvas; immutable result model consumption.

**Control Manifest Rules (this layer)**:
- Required: Finished/DNF/Forfeit explicit classifications; no fabricated position
- Required: unload gate — non-interactive until ContentUnloadComplete

---

## Acceptance Criteria

*From ui-menu.md + ADR-0019/0018, scoped per QL-STORY-READY 2026-08-16 (004A split):*

- [ ] Consume an immutable `ResultViewModel`
- [ ] Finished: show position, car name, and race time
- [ ] DNF: show "DNF"; omit unavailable/fabricated position
- [ ] Forfeit: show "FORFEIT", completed laps, and elapsed time; omit position and podium placement
- [ ] Continue/Back emits the exit request and disables interaction until `ContentUnloadComplete`; then shows Title/Idle
- [ ] Next Race emits the loading request; UI does not initiate Simulation loading

---

## Implementation Notes

*Derived from ADR-0019/0018 Implementation Guidelines:*

- The result model is RSM-produced (race-flow) and consumed immutably — UI never derives/fabricates positions or AI order
- The unload gate mirrors ADR-0003's lifecycle: Continue/Back waits for ContentUnloadComplete before Idle/Title
- Results rendering ownership: HUD suppresses + hands off (its Story 004); the full result presentation lives here

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [race-flow]: result model production (RSM), ContentUnloadComplete
- [hud epic]: HUD suppression/handoff
- [Story 006]: Settings handoff

---

## QA Test Cases

*Written by qa-lead at story creation (manual — UI):*

- **AC-FINISHED**: inject Finished model → position, car name, race time shown
- **AC-DNF**: inject DNF model → "DNF", no fabricated position
- **AC-FORFEIT**: inject Forfeit model → "FORFEIT", laps + time, no position/podium
- **AC-UNLOAD-GATE**: Continue/Back before/after ContentUnloadComplete → non-interactive before, Title after
- **AC-NEXT-RACE**: Next Race → loading request emitted; no Simulation loading initiation

---

## Test Evidence

**Story Type**: UI
**Required evidence**:
- UI: `production/qa/evidence/ui-menu-results-evidence.md` + screenshots (Finished/DNF/Forfeit)
- Integration: `Assets/tests/integration/ui-menu/UiMenuTests.cs` (unload gate, result mapping)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003A (lifecycle), race-flow (result model, ContentUnloadComplete)
- Unlocks: Story 006 (settings handoff), sprint close
