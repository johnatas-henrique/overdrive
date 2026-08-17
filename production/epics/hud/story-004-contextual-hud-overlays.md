# Story 004: Contextual HUD Overlays

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Core + Presentation
> **Type**: UI
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/hud.md`
**Requirement**: `TR-hud-002` (overlays), pit service presentation, result handoff (suppression only — TR-ui-003 rendering is UI Menu)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0014 (HUD data contract) + ADR-0011 (PitThisLap) + ADR-0010 (PerformanceReduced) + ADR-0005 (NoInputDevice)
**ADR Decision Summary**: Contextual overlays consume lifecycle snapshot + event fixtures only. Pit service: InPitBox shows the service overlay in the speed slot (elapsed time, fuel progress, tire-swap status, exit prompt); PitTransit/PitExiting restore the race HUD. NO INPUT DEVICE overlay leaves telemetry visible. PerformanceReduced → non-blocking banner (HUD does not calculate FPS; dismissal timing follows one approved contract). PIT THIS LAP advisory appears before entry, clears at entry (HUD does not calculate the window). Explicit precedence: Finished/Results suppress race HUD; InPitBox replaces only the speed slot; banners never obscure telemetry. Normal/Forfeit Results rendering belongs to UI Menu — HUD only verifies suppression and handoff.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: uGUI Canvas; event consumption.

**Control Manifest Rules (this layer)**:
- Required: overlays consume events; pit service in speed slot only; precedence deterministic
- Required: result rendering is UI Menu's — HUD suppresses and hands off

---

## Acceptance Criteria

*From hud.md + ADRs, scoped per QL-STORY-READY 2026-08-16 (pit service from 002; results moved to UI Menu):*

- [ ] `InPitBox` with a supplied service timer shows the service overlay in the speed slot (elapsed time, fuel progress, tire-swap status, exit prompt); PitTransit/PitExiting restore the race HUD
- [ ] `NoInputDevice` shows "NO INPUT DEVICE" while leaving telemetry visible; supplied `Available` clears it
- [ ] Supplied `PerformanceReduced` event shows a non-blocking overlay without replacing telemetry (dismissal follows one approved contract; HUD does not calculate FPS)
- [ ] Supplied `PitThisLap = true` shows the advisory before pit entry; supplied pit-entry transition clears it (HUD does not calculate the advisory window)
- [ ] Explicit precedence: Finished/Results suppress race HUD; InPitBox replaces only the speed slot; no-input/performance/pit advisories are non-blocking banner anchors that never obscure telemetry
- [ ] On normal Results or Forfeit lifecycle context, HUD yields the screen to Results UI and renders no fabricated position, AI order, or result data

---

## Implementation Notes

*Derived from ADR-0014/0011/0010 Implementation Guidelines:*

- All overlays consume events/state supplied through seams — HUD never derives FPS, advisory windows, or result data
- The service overlay replaces ONLY the speed slot (race HUD intact elsewhere)
- Results rendering (position/time/stats; Forfeit classification) is the UI Menu epic's TR-ui-003 — this story verifies suppression + handoff only
- Banner stacking is deterministic per the precedence list

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [ui-menu epic]: Results rendering (TR-ui-003), Forfeit result model
- [race-strategy]: PitThisLap calculation, pit service timer
- [Simulation]: PerformanceReduced signal, FPS calculation

---

## QA Test Cases

*Written by qa-lead at story creation (manual — UI):*

- **AC-PIT**: InPitBox with timer/progress → service overlay replaces speed only; Transit/Exiting → race HUD returns
- **AC-NOINPUT**: NoInputDevice → overlay + telemetry visible; Available → clears
- **AC-PERF**: PerformanceReduced event → non-blocking banner, telemetry visible, approved dismissal
- **AC-ADVISORY**: PitThisLap=true → advisory before entry; pit-entry transition → clears
- **AC-PRECEDENCE**: combine advisory + performance + no-input; then InPitBox and Results → deterministic stacking; service replaces only speed; Results suppresses HUD
- **AC-HANDOFF**: normal + Forfeit result contexts → HUD absent; Results UI alone owns result fields

---

## Test Evidence

**Story Type**: UI
**Required evidence**:
- UI: `production/qa/evidence/hud-overlays-evidence.md` + screenshots (pit service, banners, stacking)
- Integration companion: `Assets/tests/integration/ui/HudOverlayTests.cs` (event-driven overlay states with fakes)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001-003 (view model, 8 elements, modes), race-strategy (PitThisLap, pit service), race-flow (results lifecycle)
- Unlocks: ui-menu (Results screen), full HUD composition
