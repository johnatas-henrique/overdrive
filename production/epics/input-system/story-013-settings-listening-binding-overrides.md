# Story 013: Settings Listening and Binding Overrides

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-013` (Binding overrides use stable action and binding GUIDs; an unknown ID invalidates only that override), `TR-input-004` (Reserved bindings cannot be replaced or removed)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0004: Settings Persistence and Control Profiles; ADR-0005: Input Context Controller and Action Map Inventory
**ADR Decision Summary**: ADR-0004: binding overrides are persisted per-slot with stable IDs; reserved bindings (Confirm, Cancel, Pause) are rejected during Listening; an unknown ID restores that slot's default. ADR-0005: Settings selects one concrete slot; keyboard Steer rebinds the selected 1D-axis composite part by stable binding ID, never the composite root.

**Engine**: Unity 6000.3.19f1 | **Risk**: LOW
**Engine Notes**: PlayerPrefs API stable. Input System 1.19.0 binding APIs (InputActionRebindingExtensions) confirmed stable. Action IDs and binding IDs become stable after the first shipped settings schema.

**Control Manifest Rules (this layer)**:
- Required: Reserved bindings (Confirm, Cancel, Pause) rejected during Listening — cannot be rebound, replaced, or removed; binding Action/Binding GUIDs stable after first shipped schema (source: ADR-0004)
- Required: Pause (Escape/Start) fixed and reserved across ALL contexts (source: ADR-0005)
- Required: Settings uses PlayerPrefs single JSON blob (source: ADR-0004 — persistence side; this story provides the override payloads)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-10: GIVEN Settings enters Listening, WHEN a remappable race-action candidate arrives, THEN Settings receives Captured, Conflict, or Rejected and no gameplay edge is queued.
- [ ] AC-29: GIVEN a remap candidate conflicts with a reserved Confirm, Cancel, or Pause binding, WHEN capture validation runs, THEN the candidate is rejected immediately.
- [ ] AC-46: GIVEN Settings displays Confirm, Cancel, or Pause, WHEN the player attempts to select one as a rebinding target or remove its binding, THEN Listening does not begin and the fixed reserved binding remains.
- [ ] AC-66: GIVEN Settings selects KeyboardMouse Steer Left Secondary for rebinding, WHEN a valid candidate completes, THEN only that composite-part binding ID is overridden and Steer Right plus all other slots remain unchanged.
- [ ] AC-67: GIVEN a saved override references an unknown stable binding ID, WHEN overrides load, THEN only that slot returns to its default and all other valid overrides remain active.

## Implementation Notes

*Derived from ADR-0004 Decision, ADR-0005 Decision, and GDD Core Rules 1-2 (:42-95):*

- Remappable in MVP: Accelerate, Brake, Steer (per composite part), CameraToggle. Reserved (not rebinding targets, cannot be removed): Confirm (Enter/gamepad South), Cancel (Escape/gamepad East), gameplay Pause (Escape/gamepad Start), Finished-only UI Pause (P/gamepad Start). Pause is never a rebinding target.
- Capture result classes (input-system.md:244):
  - **Captured**: supported control, valid binding, no conflict.
  - **Conflict**: candidate binding already used by another remappable action, or duplicate binding within the same action.
  - **Rejected**: reserved binding (Confirm, Cancel, Pause), unsupported control, or malformed binding.
- During Listening, OverdriveGameplay is disabled. OverdriveUI.Cancel cancels capture; OverdriveUI.Confirm confirms a non-binding modal choice. No gameplay edge is queued during capture (AC-10).
- Composite-part override: Settings rebinds the selected 1D-axis composite part (e.g. Steer Left Secondary) by stable binding ID, never the composite root; other parts and slots remain unchanged (AC-66).
- Unknown IDs (AC-67): if a saved override references an unknown action or binding ID, Input discards ONLY that override, restores that slot's default, preserves other valid overrides, and reports the migration result to Settings (input-system.md:95).
- Binding Action/Binding GUIDs become stable after the first shipped settings schema (ADR-0004).

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 014: Control profile integration (profile fields; this story is the binding-override surface)
- Settings epic: the Listening UI flow, override persistence blob, and schema migration
- Story 006: gameplay-edge suppression during Listening (asserted here via the controller)

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-10** (EditMode integration test):
  - Given: Settings is in Listening for a remappable race action.
  - When: A candidate binding arrives.
  - Then: Settings receives exactly one result: Captured, Conflict, or Rejected; no gameplay edge is queued.
  - Edge cases: Invalid device; duplicate candidate; reserved binding; candidate during UI transition; timeout.
- **AC-29** (EditMode unit test):
  - Given: A candidate conflicts with Confirm, Cancel, or Pause.
  - When: Capture validation runs.
  - Then: Candidate is rejected immediately and the reserved binding remains unchanged.
  - Edge cases: Conflict by action GUID; conflict by binding GUID; equivalent keyboard/gamepad binding; simultaneous candidate.
- **AC-46** (PlayMode Settings test):
  - Given: Settings displays Confirm, Cancel, or Pause.
  - When: The player selects it as a rebinding target or attempts to remove it.
  - Then: Listening does not begin and the fixed binding remains unchanged.
  - Edge cases: Keyboard and gamepad reserved bindings; duplicate UI request; stale selection.
- **AC-66** (EditMode unit test):
  - Given: KeyboardMouse Steer Left Secondary is selected and a valid candidate is captured.
  - When: The override is saved.
  - Then: Only that composite-part binding ID changes; Steer Right and every other slot remain unchanged.
  - Edge cases: Composite root versus part ID; repeated remap; duplicate candidate; reload after save.
- **AC-67** (EditMode persistence test):
  - Given: Saved overrides contain one unknown stable binding ID and other valid IDs.
  - When: Overrides load.
  - Then: Only the unknown slot returns to its default; valid overrides remain active.
  - Edge cases: Unknown action GUID; malformed override; multiple unknown IDs; missing defaults.

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- `tests/integration/input/binding_overrides_test.cs` — must exist and pass (EditMode binding-validation tests + PlayMode Settings flow tests)

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (action asset with stable IDs), Story 006 (no gameplay edge during Listening)
- Unlocks: Story 014 (profile preview applies overrides), Settings epic's rebinding UI
