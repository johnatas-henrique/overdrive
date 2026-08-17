# Story 002: Car Selection Turntable

> **Epic**: UI Menu
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/ui-menu.md`
**Requirement**: `TR-ui-002` (3D car turntable 15 RPM, Garage Lit)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0019: UI Presentation (§Car Selection Turntable)
**ADR Decision Summary**: The 3D model rotates at 15 RPM (±10%, tuning range 5-30); warm "Garage Lit" lighting (amber/orange); stats displayed as horizontal bars (0-20 scale) with team colors on model + UI accents; pre-race fuel comparison (bar/number) shown; "Select" confirms. Data sources: CarDef metadata/stats/colors via an injected `CarSelectionViewModel` (never CarDef/Content internals); track list from Content. The turntable is presentation-only — it never touches simulation state, car assets beyond visual preview, or race configuration until Select.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: uGUI; deterministic clock/transform seam for rotation.

**Control Manifest Rules (this layer)**:
- Required: 15 RPM ±10%; Garage Lit lighting; stats 0-20 with team colors; fuel comparison
- Required: presentation-only — no simulation/configuration writes until Select (one CarSelectionConfirmed event)

---

## Acceptance Criteria

*From ui-menu.md + ADR-0019, scoped per QL-STORY-READY 2026-08-16:*

- [ ] UI consumes an injected `CarSelectionViewModel` (CarDef metadata, preview asset reference, stats, team colors, fuel comparison) — no CarDef/Content loading internals
- [ ] Car rotation is 15 RPM ±10% using a deterministic clock/transform seam (or measured manual evidence); revolution period 3.636-4.444s
- [ ] Garage Lit lighting applied and visually verifiable with screenshot evidence
- [ ] Stats render on a 0-20 scale with team colors; invalid source values handled or require validated CarDef input
- [ ] Fuel comparison renders the supplied selected-car and grid-average values (no fuel formula here)
- [ ] Presentation-only: rotations, hover, and redraws produce no simulation/configuration writes; Select emits ONE `CarSelectionConfirmed` event containing the selected IDs

---

## Implementation Notes

*Derived from ADR-0019 Implementation Guidelines:*

- The view-model seam decouples UI from CarDef/Content internals
- 15 RPM → revolution period = 60/15 = 4s (tolerance ±10% → 3.636-4.444s)
- Stats bars 0-20 scale; team colors from the view model (validated CarDef input per car-definition epic)
- Presentation-only guarantee: a simulation spy verifies zero writes before Select

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [car-definition-data]: validation/loading internals (consumed via view model)
- [Content]: car preview asset loading
- [race-flow]: race configuration

---

## QA Test Cases

*Written by qa-lead at story creation (manual — UI):*

- **AC-ROTATION**: known preview + stopwatch/video → revolution 3.636-4.444s
- **AC-LIGHTING**: Garage Lit preview scene → warm presentation visible + consistent (screenshot)
- **AC-STATS**: fixtures 0/10/20 + known palette → bars align 0-20, team colors applied
- **AC-FUEL**: known selected-car + grid-average → both values match the supplied view model
- **AC-PRESENTATION-ONLY**: simulation spy → no simulation/configuration calls before Select; ONE CarSelectionConfirmed on Select

---

## Test Evidence

**Story Type**: UI
**Required evidence**:
- UI: `production/qa/evidence/ui-menu-turntable-evidence.md` + screenshots
- Integration: `Assets/tests/integration/ui-menu/UiMenuTests.cs` (rotation seam, view-model binding, presentation-only)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (flow), car-definition (view model data), Content (preview asset)
- Unlocks: Story 003A (StartRaceRequested after selection)
