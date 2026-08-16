# Story 001: Input Action Asset & Context Controller

> **Epic**: Input System
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: M (6-8h)

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-001`, `TR-input-002`, `TR-input-003` (parte)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0005 (Input Context Controller and Action Map Inventory), ADR-0001 (Manual Simulation Authority and Determinism Boundary)
**ADR Decision Summary**: `InputContextController` is the sole owner of action-map and `InputSystemUIInputModule` activation; two fixed action maps in one `.inputactions` asset; exactly one map enabled at a time; no other component may enable either map.

**Engine**: Unity 6000.3.19f1 + Input System 1.19.0 | **Risk**: MEDIUM
**Engine Notes**: Input System 1.19.0 API deltas — `actionMaps` (renamed from `maps`), `UpdateMode` enum has no value 0 (Dynamic=1), `.inputsettings` extension is not importable (use `.asset`), `InputActionImporter` is internal (configure via SerializedObject), `wrapperCodePath` MUST be set or the generated wrapper class never lands on disk. `InputSystemUIInputModule.OnEnable → AssignDefaultActions` enables 10 default actions; all wrappers share the same JSON so asset identity must be checked by `ReferenceEquals`, not name.

**Control Manifest Rules (Foundation)**:
- Required: `InputContextController` is the sole owner of action-map and UI-module activation — no other system enables/disables maps (ADR-0005).
- Required: `InputSettings.UpdateMode` = `ProcessEventsInDynamicUpdate` (enum renamed in 1.19.0; no fixed update mode).
- Forbidden: Never use a single action map with per-action enable/disable — `InputSystemUIInputModule` cannot coexist with gameplay actions in one map (ADR-0005).

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [x] AC-12: GIVEN UI is active, WHEN Enter or gamepad South is pressed, THEN UI Submit fires and no gameplay edge is queued.
- [x] AC-13: GIVEN UI is active, WHEN Escape or gamepad East is pressed, THEN UI Cancel fires and no gameplay edge is queued.
- [x] AC-30: GIVEN the Input System configuration loads, WHEN its update mode is read, THEN it equals `ProcessEventsInDynamicUpdate`.
- [x] AC-35: GIVEN UI is active, WHEN Accelerate, Brake, or Steer is pressed, THEN no gameplay value or gameplay edge is emitted.
- [x] AC-45: GIVEN an MVP Input Context is active, WHEN enabled action maps are inspected, THEN exactly one of `OverdriveGameplay` or `OverdriveUI` is enabled.
- [x] AC-47: GIVEN Navigate reaches a UI focus-group boundary, WHEN the player continues navigating outward, THEN focus remains on the boundary element and never wraps.
- [x] AC-49: GIVEN gamepad UI is active, WHEN Submit or Cancel is triggered, THEN South triggers Submit and East triggers Cancel; GIVEN gameplay is active, Start triggers Pause.
- [x] AC-69: GIVEN the project input asset is prepared for implementation, WHEN its maps and actions are inspected, THEN it contains `OverdriveGameplay` and `OverdriveUI` with the actions defined in Core Rule 1 and no template Player gameplay actions remain enabled.

---

## Implementation Notes

*Derived from ADR-0005 and ADR-0001 Implementation Guidelines:*

- Replace the Unity template `.inputactions` with a single asset containing exactly two action maps:
  - `OverdriveGameplay`: `Accelerate`, `Brake`, `Steer`, `Pause`, `CameraToggle`.
  - `OverdriveUI`: `Navigate`, `Point`, `Click`, `Confirm`, `Cancel`, and context-gated `Pause`.
- Generate the wrapper class (via SerializedObject on the importer) with `wrapperCodePath` set so the class lands on disk inside the `Overdrive.Input` assembly.
- `InputContextController` owns all map/UI-module enable/disable. `OverdriveGameplay` enabled only in GameplayRacing/Qualifying/Countdown; `OverdriveUI` in UI/PitTransit/PitService. Exactly one map enabled at all times.
- `InputSystemUIInputModule` references `OverdriveUI.Confirm` as Submit and `OverdriveUI.Cancel` as Cancel for normal menu routing. No gameplay action is reused as a UI action; no binding override is copied between maps.
- Enforce the "exactly one asset active" invariant unconditionally (identity by `ReferenceEquals`, not name — all wrappers share the same JSON). Global sweep: disable any action whose asset is not the controller's.
- AC-30: verify the `InputSettings.UpdateMode` value resolves to `ProcessEventsInDynamicUpdate` on the actual asset.

---

## Performance Budget

- Context transitions: O(1) — one map enable + one module activation per transition; no heap allocations at transition time.
- Transitions occur only at lifecycle boundaries (context switch), never per tick — zero impact on the 60 Hz simulation tick path. Raw capture runs once per render frame (story 002), not here.
- Fits the simulation gate (p95 ≤ 6 ms / max ≤ 8 ms per tick): the controller adds no per-tick work.

---

## Embedded Definitions

*Testability refinements from QL-STORY-READY gate. These make the verbatim ACs deterministic — the AC text does not change.*

- **Named observers (AC-12/13/35/49)**: the controller exposes event counters on its output surface — `SubmitCount`, `CancelCount`, `GameplayEdgeCount`, `PauseEdgeCount`. Assert exact counts (`SubmitCount == 1` per press in UI, `CancelCount == 1`, `GameplayEdgeCount == 0` in UI, `PauseEdgeCount == 1` in gameplay). "Fires"/"queued"/"emitted" are defined as these counter increments.
- **AC-47 ownership**: Navigate boundary processing is owned by this story via `InputSystemUIInputModule`. Test with a fake focus group of 3 elements + `FocusPositionObserver`; navigating beyond the first/last element keeps focus on the boundary and never wraps.
- **AC-69 definition**: "template Player gameplay actions" = Unity template actions (`Jump`, `Move`, `Look`, `Fire`, `Sprint`, etc.) must neither exist nor be enabled. Assert: the asset contains exactly the 11 Core-Rule-1 actions (5 gameplay + 6 UI); zero template action names are present.
- **AC-35 observer**: add a gameplay-value output observer (`GameplayValueEventCount`) that records every emitted Accelerate/Brake/Steer value. Assert: while UI context is active, `GameplayValueEventCount == 0` (no gameplay value is emitted at all) — complementary to `GameplayEdgeCount == 0`, which only covers edges.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: Raw capture and dead-zone normalization (consumes the asset/controller).
- Story 006: Context handoff latching (the controller's transition behaviour lives there).

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-12**: UI Confirm routes to Submit without gameplay Pause
  - Given: UI context is active.
  - When: Enter or gamepad South is pressed.
  - Then: `SubmitCount == 1`; `PauseEdgeCount == 0`; `GameplayEdgeCount == 0`.
  - Edge cases: Hold the button, press during a transition, both devices.

- **AC-13**: UI Cancel routes to Cancel without gameplay Pause
  - Given: UI context is active.
  - When: Escape or gamepad East is pressed.
  - Then: `CancelCount == 1`; `PauseEdgeCount == 0`; `GameplayEdgeCount == 0`.
  - Edge cases: Hold Escape across a transition, repeated presses.

- **AC-30**: Input System uses Dynamic Update processing
  - Given: the project Input System configuration is loaded.
  - When: its update mode is inspected.
  - Then: it equals `ProcessEventsInDynamicUpdate`.
  - Edge cases: verify no runtime override changes it to Fixed Update.

- **AC-35**: Gameplay actions are ignored in UI
  - Given: UI context is active.
  - When: Accelerate, Brake, or Steer is pressed.
  - Then: `GameplayEdgeCount == 0` and no gameplay value is emitted.
  - Edge cases: held analog controls, keyboard controls, transition-frame input.

- **AC-45**: Exactly one action map is enabled
  - Given: each MVP Input Context is activated in turn.
  - When: enabled action maps are inspected.
  - Then: exactly one of `OverdriveGameplay` and `OverdriveUI` is enabled.
  - Edge cases: transition frames, repeated context-setting calls.

- **AC-47**: UI navigation stops at the focus boundary
  - Given: focus is on the first or last element of a fake 3-element focus group.
  - When: the player navigates outward beyond the group.
  - Then: focus remains on the boundary element and does not wrap.
  - Edge cases: all four directions, one-element groups, disabled neighbours.

- **AC-49**: UI Submit/Cancel and gameplay Pause use the correct bindings
  - Given: gamepad UI context active, then gameplay context activated.
  - When: South and East in UI, Start in gameplay.
  - Then: `SubmitCount == 1`, `CancelCount == 1`, `PauseEdgeCount == 1`; no cross-map action fires.
  - Edge cases: held controls across transitions.

- **AC-69**: Input action asset contains the approved maps and actions
  - Given: the implementation input asset is loaded.
  - When: its maps, actions, bindings, and enabled states are inspected.
  - Then: it contains `OverdriveGameplay` and `OverdriveUI` with the Core Rule 1 actions (11 total); zero template action names present or enabled.
  - Edge cases: exact action count, reserved bindings, generated wrapper availability, duplicate map names.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `Assets/tests/integration/input/InputContextControllerTests.cs` — must exist and pass (asmdef `InputIntegrationTests`, created at implementation time).

**Status**: [x] Created and passing (11/11)

---

## Dependencies

- Depends on: None (base story).
- Unlocks: Story 002, Story 003, Story 004 (consume the controller and asset).

---

## Completion Notes

**Completed**: 2026-08-08
**Criteria**: 8/8 passing (11/11 PlayMode tests)
**Deviations**: None
**Test Evidence**: Integration — `Assets/tests/integration/input/InputContextControllerTests.cs` (11/11 PASS)
**Code Review**: Complete — 3 rounds converged (unity-specialist + qa-tester APPROVED x2); gates QL-TEST-COVERAGE ADEQUATE, LP-CODE-REVIEW APPROVE
**Notes**: Bug `startButton`→`start` fixed in `InputAssetBootstrap.cs` (control is `start`, not `startButton` — a stale binding path the rebuild tool would have regenerated). AC-47 reworked from a false-positive into a real navigation test (Selectable.navigation requires `mode = Explicit` for selectOn* links).
