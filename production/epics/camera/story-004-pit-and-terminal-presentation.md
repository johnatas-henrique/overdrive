# Story 004: Pit & Terminal Presentation

> **Epic**: Camera
> **Status**: Ready
> **Layer**: Core + Presentation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.0h

## Context

**GDD**: `design/gdd/camera.md` + `pit-stop.md` + `race-session-manager.md`
**Requirement**: `TR-camera-005` (PitCamera + terminal three-quarter presentation consume interpolated snapshot state without changing simulation)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0010 (PitCamera activation via PitPhase.InPitBox; 0.2s blend; side-aware offset from TrackData.PitLaneSide) + ADR-0011 (PitCamera) + ADR-0001 (terminal presentation)
**ADR Decision Summary**: When CarState.PitPhase == InPitBox, camera blends to the authored PitCamera anchor (0.2s, side-aware via PitLaneSide); on PitExiting it blends back to the selected mode without snapping. Terminal presentation: given an injected terminal presentation request + interpolated player pose, camera enters the authored external three-quarter view without changing simulation state. UI-owned timer/pause/Confirm dismissal/Results handoff belong to UI Presentation.

**Engine**: Unity 6000.3.22f1 | **Risk**: MEDIUM
**Engine Notes**: Consumes interpolated visual snapshot state (ADR-0001 render pass).

**Control Manifest Rules (this layer)**:
- Required: PitCamera during InPitBox only; blends, never snaps
- Required: terminal three-quarter view consumes interpolated presentation state; never mutates simulation

---

## Acceptance Criteria

*From camera.md + ADR-0010/0011/0001, scoped per QL-STORY-READY 2026-08-16 (002C split):*

- [ ] Given an interpolated snapshot with `PitPhase=InPitBox` → camera enters the authored PitCamera anchor and consumes interpolated pose data
- [ ] Given `PitPhase=Exiting` → camera returns to the selected Cockpit/Chase mode without snapping
- [ ] PitCamera offset is side-aware: reads `PitLaneSide` from TrackData (per-circuit) and mirrors camera position accordingly
- [ ] Given an injected terminal presentation request + interpolated player pose → camera enters the authored external three-quarter view without changing simulation state
- [ ] UI-owned timer, pause, Confirm dismissal, and Results handoff are NOT camera behavior (UI Presentation owns)

---

## Implementation Notes

*Derived from ADR-0010/0011 Implementation Guidelines:*

- PitCamera activation: `CameraSystem` reads `CarState.PitPhase` from the interpolated visual snapshot; InPitBox → 0.2s blend to PitCamera
- Side-aware: `PitLaneSide` (Right/Left) is a per-circuit authored property — mirrors camera position accordingly (ADR-0007)
- Terminal three-quarter view: consumed on `terminalPresentationRequest` (ADR-0001) — camera presents, never transitions simulation
- The terminal timer/pause/Confirm ownership is UI Presentation (ADR-0019)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [ui-menu epic]: terminal timer, pause, Confirm dismissal, Results handoff
- [race-strategy epic]: PitPhase production
- [track epic]: PitLaneSide data

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-PIT**: injected snapshots through InPitBox → PitCamera blends in with interpolated pose; Exiting → blends back without snapping; edge: side-aware offset both directions
- **AC-TERM**: injected terminal request + changing interpolated pose → three-quarter view follows presentation state; simulation state not modified
- **AC-BLEND**: blend duration 0.2s on entry; no snap on exit

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/CameraTests.cs` — pit blend in/out, terminal view, side-awareness
- Visual/Feel evidence: `production/qa/evidence/camera-002c.md`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (base modes), race-strategy (PitPhase seam), Track (PitLaneSide), race-flow (terminal request)
- Unlocks: ui-menu (terminal presentation UI), pit camera presentation
