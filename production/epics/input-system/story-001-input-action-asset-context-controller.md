# Story 001: Input Action Asset and Context Controller

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-001` (Two action maps exist: OverdriveGameplay (5 actions) and OverdriveUI (6 actions)), `TR-input-002` (InputContextController is the sole owner of action-map and InputSystemUIInputModule activation), `TR-input-004` (Reserved bindings cannot be replaced or removed)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0005: Input Context Controller and Action Map Inventory
**ADR Decision Summary**: `InputContextController` is the sole owner of action map activation, context transitions, device switch arbitration, and CameraToggle routing. Two fixed action maps in a single `.inputactions` asset. Context handoff latching prevents held digital actions from firing in the new context.

**Engine**: Unity 6000.3.19f1 | **Risk**: MEDIUM
**Engine Notes**: Input System 1.19.0 is post-LLM-cutoff. `InputSettings.UpdateMode` enum renamed: `ProcessEventsInDynamicUpdate` (was `Dynamic`), `ProcessEventsInFixedUpdate` (was `FixedUpdate`) — verified in 1.19.0 runtime. Core APIs (InputActionAsset, InputActionMap, InputAction) confirmed stable. Verification required: context handoff latching (held inputs across transition), device switch arbitration.

**Control Manifest Rules (this layer)**:
- Required: `InputContextController` is the sole owner of action-map and UI-module activation — no other system enables/disables maps (source: ADR-0001, ADR-0005)
- Required: Exactly two action maps in a single `.inputactions` asset: OverdriveGameplay (5 actions) + OverdriveUI (6 actions); exactly one active at any time (source: ADR-0005)
- Required: Disable one action map before enabling the other (no overlapping bindings); clear pending pauseEdge on Gameplay→UI transition (source: ADR-0005)
- Required: Pause (Escape/Start) is fixed and reserved across ALL contexts; Confirm (Enter/South) and Cancel (Escape/East) are reserved in all UI contexts (source: ADR-0005)
- Forbidden: Never use a single action map with per-action enable/disable (source: ADR-0005)
- Forbidden: Never have no central input controller (source: ADR-0005)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-69: GIVEN the project input asset is prepared for implementation, WHEN its maps and actions are inspected, THEN it contains `OverdriveGameplay` and `OverdriveUI` with the actions defined in Core Rule 1 and no template Player gameplay actions remain enabled.
- [ ] AC-30: GIVEN the Input System configuration loads, WHEN its update mode is read, THEN it equals `ProcessEventsInDynamicUpdate`.
- [ ] AC-45: GIVEN an MVP Input Context is active, WHEN enabled action maps are inspected, THEN exactly one of `OverdriveGameplay` or `OverdriveUI` is enabled.
- [ ] AC-45b: GIVEN an MVP Input Context is active, WHEN any component other than `InputContextController` attempts to enable or disable an action map or the `InputSystemUIInputModule`, THEN the attempt has no effect on map/module state (enforced by private encapsulation + static test rejecting external Enable/Disable).
- [ ] AC-12: GIVEN UI is active, WHEN Enter or gamepad South is pressed, THEN UI Submit fires and no gameplay edge is queued.
- [ ] AC-13: GIVEN UI is active, WHEN Escape or gamepad East is pressed, THEN UI Cancel fires and no gameplay edge is queued.
- [ ] AC-49a: GIVEN gamepad UI is active, WHEN Submit or Cancel is triggered, THEN South triggers Submit and East triggers Cancel.
- [ ] AC-49b: GIVEN gameplay is active, WHEN Start is pressed, THEN Pause rises.

## Implementation Notes

*Derived from ADR-0005 Decision and GDD Core Rules:*

- Action inventory (GDD Core Rule 1, input-system.md:42-44): `OverdriveGameplay` = Accelerate (Axis 0-1), Brake (Axis 0-1), Steer (Axis -1-1), Pause (Button, reserved), CameraToggle (Button). `OverdriveUI` = Navigate (Vector2), Point (Vector2), Click (Button), Confirm (Button, reserved), Cancel (Button, reserved), Pause (Button, Finished-only, reserved).
- `OverdriveGameplay` enabled only in GameplayRacing, GameplayQualifying, GameplayCountdown. `OverdriveUI` enabled in UI, PitTransit, PitService. Exactly one map enabled at a time.
- No template Player actions remain: Fire1/Fire2/Fire3, Jump, Move, Look, Submit, Cancel are absent or disabled — they cannot respond to input.
- `InputSystemUIInputModule` is enabled only for normal menu routing inside UI. It is disabled during Loading-blocked input, Finished Presentation, PitTransit, and PitService (direct-routing and blocked modes).
- When enabled for normal menu UI, the module references `OverdriveUI.Confirm` as Submit and `OverdriveUI.Cancel` as Cancel. No gameplay action is reused as a UI action; no binding override is copied between maps.
- Sole-ownership enforcement: action maps and the UI module are private to `InputContextController` (no public activation API); a static/code-level test rejects any Enable/Disable call on them outside that controller.
- Pause (Escape/Start) is not a rebinding target. Confirm is Enter / gamepad South; Cancel is Escape / gamepad East; gameplay Pause is Escape / gamepad Start; Finished-only UI Pause is P / gamepad Start.
- `InputSettings.updateMode` = `ProcessEventsInDynamicUpdate` (Input System 1.19.0 enum name — `Dynamic` is obsolete).

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: RawInputSample capture ordering (this story delivers the asset + controller; capture is 002)
- Story 009: Context handoff latching behavior (the latch evaluation mechanics)
- Story 011: CameraToggle routing (the rising-edge routing to Camera)
- Story 013: Settings Listening and binding overrides

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-69** (EditMode asset inspection):
  - Given: The project `.inputactions` asset is imported.
  - When: Its action maps, actions, bindings, and enabled states are inspected.
  - Then: `OverdriveGameplay` and `OverdriveUI` exist; all actions listed in Core Rule 1 exist with the required bindings; no template gameplay action remains enabled.
  - Edge cases: Missing map; duplicate action; disabled required action; orphaned template action; duplicate binding.
- **AC-30** (EditMode configuration test):
  - Given: The Input System configuration is loaded.
  - When: `InputSettings.updateMode` is read.
  - Then: It equals `ProcessEventsInDynamicUpdate`.
  - Edge cases: Fixed update; manual update; null settings asset.
- **AC-45** (PlayMode integration test):
  - Given: An MVP input context is active.
  - When: The context controller activates the context.
  - Then: Exactly one of `OverdriveGameplay` or `OverdriveUI` is enabled.
  - Edge cases: Both enabled; neither enabled; repeated activation; invalid context request.
- **AC-45b** (EditMode static/encapsulation test):
  - Given: The `InputContextController` owns the action maps and UI module.
  - When: A source-scan rejects Enable/Disable calls on them outside the controller, and an external activation attempt is made at runtime.
  - Then: The scan finds no external calls; the runtime attempt has no effect on map/module state.
  - Edge cases: Reflection-based activation; UI module Enable from a UI screen; map Enable from Settings.
- **AC-12** (PlayMode integration test):
  - Given: UI context is active and gameplay context is disabled.
  - When: Enter and gamepad South are pressed.
  - Then: UI Submit fires; no gameplay edge is queued.
  - Edge cases: Held input across context activation; repeated press without release; simultaneous keyboard and gamepad input.
- **AC-13** (PlayMode integration test):
  - Given: UI context is active.
  - When: Escape and gamepad East are pressed.
  - Then: UI Cancel fires; no gameplay edge is queued.
  - Edge cases: Escape held during transition; repeated press; simultaneous Cancel and gameplay input.
- **AC-49a** (PlayMode integration test):
  - Given: Gamepad UI context is active.
  - When: South or East is pressed.
  - Then: South produces Submit and East produces Cancel.
  - Edge cases: Both buttons in one update; held buttons; UI map accidentally disabled.
- **AC-49b** (PlayMode integration test):
  - Given: Gameplay context is active.
  - When: Start is pressed.
  - Then: Pause rises once.
  - Edge cases: Start held; Start pressed while UI is active; release and repress.

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- `tests/integration/input/action_asset_context_controller_test.cs` — must exist and pass (EditMode asset/config + PlayMode context/routing tests)

**Status**: [ ] Not yet created

## Dependencies

- Depends on: None (foundation of the epic)
- Unlocks: Story 002, Story 007, Story 011, Story 012, Story 013
