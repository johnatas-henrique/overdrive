# Story 012: Mouse UI Policy

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-010` (Mouse is UI-only in MVP; never produces Accelerate, Brake, or Steer)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0005: Input Context Controller and Action Map Inventory
**ADR Decision Summary**: Mouse is UI-only in MVP: hover, primary click, pointer selection, and Settings interaction. It never produces Accelerate, Brake, or Steer. Keyboard/mouse and gamepad remain equivalent complete-control schemes. Pointer visibility follows UI scheme activity; Navigate never wraps focus groups.

**Engine**: Unity 6000.3.19f1 | **Risk**: MEDIUM
**Engine Notes**: Input System 1.19.0 core APIs confirmed stable. InputSystemUIInputModule handles pointer routing; this story covers the Input-owned policy (visibility, scheme assignment, gameplay isolation).

**Control Manifest Rules (this layer)**:
- Required: ActiveControlScheme arbitration: KeyboardMouse default, last meaningful device wins (source: ADR-0005)
- Required: Mouse is UI-only in MVP: hover, click, pointer selection (source: ADR-0005 — input-system.md:97)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-26: GIVEN mouse movement or mouse click occurs during Racing, WHEN a tick processes input, THEN Accelerate, Brake, Steer, and Pause are unchanged by mouse input.
- [ ] AC-35: GIVEN UI is active, WHEN Accelerate, Brake, or Steer is pressed, THEN no gameplay value or gameplay edge is emitted.
- [ ] AC-36: GIVEN UI is active and pointer movement assigns pointer focus, WHEN Navigate, Confirm, or Cancel arrives from keyboard or gamepad, THEN the pointer hides and that device family becomes the active UI scheme.
- [ ] AC-47: GIVEN Navigate reaches a UI focus-group boundary, WHEN the player continues navigating outward, THEN focus remains on the boundary element and never wraps.
- [ ] AC-48: GIVEN UI is active and the pointer is hidden, WHEN pointer delta is at least 2 pixels or the player clicks, THEN the pointer becomes visible and KeyboardMouse becomes the active UI scheme; subsequent keyboard/gamepad Navigate, Confirm, or Cancel hides it and selects that device family.

## Implementation Notes

*Derived from GDD Core Rule 3 (:97-102) and ADR-0005 Decision:*

- Mouse never produces Accelerate, Brake, or Steer — in any context. During Racing, mouse movement/click leaves the gameplay axes and Pause unchanged (AC-26). The mouse pointer input is never a gameplay axis (asserted at the dead-zone stage in Story 003).
- While UI is active, gameplay actions (Accelerate/Brake/Steer) emit no gameplay value or gameplay edge (AC-35) — the gameplay map is disabled in UI context.
- Pointer policy (UI contexts): pointer movement of at least 2 pixels or Click makes the pointer visible and assigns KeyboardMouse as the active UI scheme, before activation. Navigate, Confirm, or Cancel from keyboard/gamepad hides the pointer and makes that device family the active UI scheme (AC-36/48). The "active UI scheme" is the same global ActiveControlScheme (Story 007).
- Navigate stops at the boundary of its current focus group and never wraps automatically (AC-47). Pointer-focus ownership belongs to UI Menu — this story covers the Input-side policy (visibility and scheme assignment); the focus assignment behavior is verified in the AC-47 PlayMode test.
- Meaningful-input thresholds apply: pointer delta ≥ 2 pixels or Click counts as KeyboardMouse meaningful input for arbitration (Story 007).

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 007: ActiveControlScheme arbitration (the scheme state this policy consumes)
- UI Menu epic: focus-group layout, pointer focus assignment (AC-47 verified there via PlayMode)
- Story 003: dead-zone pass-through for mouse channels (asserted there)

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-26** (EditMode unit test):
  - Given: Racing is active and a baseline SimulationInput exists.
  - When: Mouse movement or click is supplied.
  - Then: Accelerate, Brake, Steer, and Pause remain unchanged.
  - Edge cases: Large delta; click during a gameplay edge; simultaneous keyboard input; pointer movement across context change.
- **AC-35** (PlayMode integration test):
  - Given: UI context is active.
  - When: Accelerate, Brake, or Steer is pressed.
  - Then: No gameplay value or gameplay edge is emitted.
  - Edge cases: Held input entering UI; analog stick movement; simultaneous Submit/Cancel.
- **AC-36** (PlayMode UI integration test):
  - Given: UI is active and pointer movement has assigned pointer focus.
  - When: Keyboard or gamepad Navigate, Confirm, or Cancel arrives.
  - Then: Pointer hides and the corresponding device family becomes the active UI scheme.
  - Edge cases: Input from both families in one update; pointer movement and Navigate simultaneously; pointer already hidden.
- **AC-47** (PlayMode UI test):
  - Given: UI focus is on a focus-group boundary.
  - When: Navigation continues outward.
  - Then: Focus remains on the boundary element and never wraps.
  - Edge cases: All four directions; first and last element; nested focus groups; disabled adjacent element.
- **AC-48** (PlayMode UI test):
  - Given: UI is active and pointer is hidden.
  - When: Pointer delta is at least two pixels or a click occurs.
  - Then: Pointer becomes visible and KeyboardMouse becomes active; subsequent keyboard/gamepad Navigate, Confirm, or Cancel hides the pointer and selects that device family.
  - Edge cases: Exactly two pixels; one-pixel movement; click with no movement; repeated device changes in one update.

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- `tests/unit/input/mouse_ui_policy_test.cs` — must exist and pass (EditMode policy tests + PlayMode UI focus tests)

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (UI map with Navigate/Point/Click), Story 007 (scheme state)
- Unlocks: UI Menu epic's pointer/focus behavior boundary
