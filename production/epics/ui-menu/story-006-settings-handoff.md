# Story 006: Settings Handoff

> **Epic**: UI Menu
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/ui-menu.md` + `design/gdd/settings.md`
**Requirement**: `TR-ui-005` (Settings lifecycle contract), `TR-ui-004` (navigation to Settings)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0019 (Settings reachable from Title/Pause; transactional preview per ADR-0004) + ADR-0004 (Settings persistence + control profiles) + ADR-0018 (Settings gating)
**ADR Decision Summary**: UI edits values through the injected `SettingsEditSession` seam. Volume changes emit the preview value immediately (actual audio output is Settings/Audio-owned). Difficulty/control-remapping UI emits preview/apply/cancel requests (transactional persistence Settings-owned). Countdown-not-paused consumes `CanOpenSettings = false`; paused Countdown consumes the allowed settings context. Chase-HUD changes emit the preview/applied value to the UI/HUD boundary (actual Cockpit HUD visibility is the HUD integration story's).

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: SettingsEditSession seam (settings epic).

**Control Manifest Rules (this layer)**:
- Required: UI edits via SettingsEditSession seam; preview immediate; persistence Settings-owned
- Required: Countdown-not-paused → CanOpenSettings false

---

## Acceptance Criteria

*From ADR-0019/0004/0018, scoped per QL-STORY-READY 2026-08-16 (004B split):*

- [ ] UI edits values through the injected `SettingsEditSession` seam
- [ ] Volume changes emit the preview value immediately; actual audio output is Settings/Audio-owned (persistence not implied)
- [ ] Difficulty/control remapping UI emits preview/apply/cancel requests; transactional persistence remains Settings-owned
- [ ] Countdown-not-paused consumes `CanOpenSettings = false`; paused Countdown consumes the allowed settings context (same restrictions as Racing-paused)
- [ ] Chase-HUD changes emit the preview/applied value to the UI/HUD boundary; actual Cockpit HUD visibility is the HUD integration story's
- [ ] Settings navigation reachable from Title and Pause (per the screen flow)

---

## Implementation Notes

*Derived from ADR-0019/0004 Implementation Guidelines:*

- The SettingsEditSession is the transactional preview seam (Snapshot/Working, display-confirm gate) — UI drives it, never persists directly
- Settings gating: the countdown/pause context determines CanOpenSettings (provided by the settings lifecycle context)
- show_chase_hud_in_cockpit: UI emits the preview/applied value; the HUD integration story verifies Cockpit HUD visibility

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Settings epic]: persistence, transactional session internals, audio output
- [hud epic]: Cockpit HUD visibility updates
- [Simulation]: countdown state (consumed via lifecycle context)

---

## QA Test Cases

*Written by qa-lead at story creation (manual — UI):*

- **AC-VOLUME**: open Settings with preview observer → volume slider emits updated preview immediately; persistence not implied
- **AC-TRANSACTION**: difficulty/control changes → preview/apply/cancel events; actual persistence Settings-owned
- **AC-GATING**: active Countdown → CanOpenSettings false; paused Countdown → allowed with restrictions
- **AC-CHASE-HUD**: Chase HUD change → preview/applied event to UI/HUD boundary; Cockpit visibility HUD-owned
- **AC-NAVIGATION**: Settings reachable from Title and Pause

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/ui-menu/UiMenuTests.cs` — settings seam routing, gating, transactions with fakes
- UI evidence: `production/qa/evidence/ui-menu-settings-evidence.md`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (navigation), Settings epic (SettingsEditSession seam, lifecycle context), HUD (chase-HUD boundary)
- Unlocks: full menu flow + settings integration
