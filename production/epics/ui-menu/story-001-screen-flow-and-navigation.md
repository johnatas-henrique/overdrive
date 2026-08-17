# Story 001: Screen Flow & Navigation

> **Epic**: UI Menu
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Manifest Version**: 2026-08-05
> **Estimate**: 2.0h

## Context

**GDD**: `design/gdd/ui-menu.md`
**Requirement**: `TR-ui-001` (screen flow), `TR-ui-004` (navigation)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0019: UI Presentation — Screen Flow, Navigation, and Car Turntable
**ADR Decision Summary**: Linear-stack menu flow (Title → Track → Car → Qualifying Not Started optional → ...). Back on navigable screens returns to the explicit previous route; Loading, Results, Pause, Finished Presentation, and Qualifying Results use their dedicated contracts (never stack-back). Focus boundary: navigation stops at the edge, never wraps. Pointer/keyboard/gamepad coexistence: 2px pointer activation, focus assignment, active scheme glyphs, semantic Confirm/Cancel. Pause Cancel/Back → closes Pause, emits ResumeRequested, no stack navigation. Physical bindings, action-map ownership, and InputSystemUIInputModule enable/disable belong to the Input System story.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: uGUI; Input System UI module (input routing is Input epic's).

**Control Manifest Rules (this layer)**:
- Required: linear-stack flow; explicit dedicated contracts for Loading/Results/Pause/Finished/Qualifying Results
- Required: focus boundary no wrap; pointer coexistence 2px

---

## Acceptance Criteria

*From ui-menu.md + ADR-0019, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Given an injected UI host/lifecycle adapter + `QualifyingEnabled` option → activating a menu action renders the expected screen and emits the corresponding request (NO assertion that Simulation enters Loading/Qualifying/Countdown/Race)
- [ ] Back navigation verifies the explicit route table; Loading, Results, Pause, Finished Presentation, and Qualifying Results use their dedicated contracts rather than stack-back
- [ ] Focus boundary: every edge direction tested with no wrap
- [ ] Pointer/keyboard/gamepad coexistence: pointer visibility, 2px threshold, focus assignment, active prompt glyph, semantic Confirm/Cancel (physical key bindings, action-map ownership, InputSystemUIInputModule enable/disable are Input epic)
- [ ] Pause Cancel/Back: given a semantic Pause-Cancel event → closes Pause, emits `ResumeRequested`, no stack navigation (actual Simulation resume is external)
- [ ] Track selection presentation: injected `TrackSelectionViewModel` renders map, name, and distance (Content loading external)

---

## Implementation Notes

*Derived from ADR-0019 Implementation Guidelines:*

- UI is a pure router: it renders screens and emits requests — it never claims Simulation state changes
- Route table: each screen has an explicit Back destination or a dedicated contract (no generic stack pop)
- Focus layouts are per-screen, defined by the UI Menu UX specification (design/ux/ui-menu.md — In Design; per-screen focus layouts required before final implementation per ADR-0019)
- Semantic actions (Confirm/Cancel/Navigate) come from the OverdriveUI action map (ADR-0005) — physical bindings are Input's

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Input epic]: physical bindings, InputSystemUIInputModule activation, Finished Presentation direct routing
- [Simulation]: state transitions (consumed events only)
- [Content pipeline]: track loading

---

## QA Test Cases

*Written by qa-lead at story creation (manual — UI):*

- **AC-FLOW**: fresh launch, qualifying enabled/disabled fixtures → Single Race/Track Next/Car Select/Start/Skip reach correct destinations + outbound requests; no UI claim of Simulation mutation
- **AC-BACK**: navigate Title→Track→Car→Qualifying/Settings → permitted screens return to explicit previous route; excluded screens use dedicated contracts
- **AC-FOCUS**: navigate beyond each edge → focus stays on edge element, no wrap
- **AC-INPUT**: keyboard/gamepad/pointer, 1.99px/exactly 2px/click → correct device active, pointer hides/shows at threshold, glyphs update, focus preserved
- **AC-PAUSE**: inject Pause-opened → semantic Cancel/Back closes + one ResumeRequested; no stack pop
- **AC-TRACK**: injected view model → map/name/distance rendered

---

## Test Evidence

**Story Type**: UI
**Required evidence**:
- UI: `production/qa/evidence/ui-menu-flow-evidence.md` + screenshots/walkthrough
- Integration: `Assets/tests/integration/ui-menu/UiMenuTests.cs` (route table, focus boundary, coexistence with fakes)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Input (OverdriveUI action map), Content (track list view model), UX spec (ui-menu.md focus layouts)
- Unlocks: Stories 002-004
