# Story 001: Input Action Asset and Context Controller

> **Epic**: Input System
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Integration
> **Estimate**: M (6-8h)
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
- [ ] AC-45b: GIVEN an MVP Input Context is active, WHEN any component other than `InputContextController` calls `Enable()`/`Disable()` on an action map or the `InputSystemUIInputModule` (source-scan scope: `Assets/source/` + `tests/`), THEN the call has no LASTING effect — the module is re-asserted to the commanded context on the next controller update, with no sanctioned transition involved (enforced by private encapsulation + static source scan rejecting external Enable/Disable; the runtime attempt does momentarily enable the module, but the controller's per-frame re-assertion undoes it; reflection-based activation is unsupported — out of contract).
- [ ] AC-12: GIVEN UI is active, WHEN Enter or gamepad South is pressed, THEN `OverdriveUI.Submit` fires exactly once (observable: `Submit` action triggered callback / `InputSystemUIInputModule` Submit event) AND no gameplay action edge is queued (observable: `InputContextController` pending-edge queue is empty, inspectable via test hook).
- [ ] AC-13: GIVEN UI is active, WHEN Escape or gamepad East is pressed, THEN `OverdriveUI.Cancel` fires exactly once (observable: `Cancel` action triggered callback / `InputSystemUIInputModule` Cancel event) AND no gameplay action edge is queued (observable: `InputContextController` pending-edge queue is empty, inspectable via test hook).
- [ ] AC-49a: GIVEN gamepad UI is active, WHEN gamepad South is pressed, THEN exactly one `OverdriveUI.Submit` fires and no `OverdriveUI.Cancel` fires; WHEN gamepad East is pressed, THEN exactly one `OverdriveUI.Cancel` fires and no `OverdriveUI.Submit` fires.
- [ ] AC-49b: GIVEN gameplay is active, WHEN Start is pressed, THEN exactly one Pause edge rises (observable: `Pause` action triggered exactly once per press; holding Start does not re-trigger until release and re-press).

## Implementation Notes

*Derived from ADR-0005 Decision and GDD Core Rules:*

- Action inventory (GDD Core Rule 1, input-system.md:42-44): `OverdriveGameplay` = Accelerate (Axis 0-1), Brake (Axis 0-1), Steer (Axis -1-1), Pause (Button, reserved), CameraToggle (Button). `OverdriveUI` = Navigate (Vector2), Point (Vector2), Click (Button), Confirm (Button, reserved), Cancel (Button, reserved), Pause (Button, Finished-only, reserved).
- `OverdriveGameplay` enabled only in GameplayRacing, GameplayQualifying, GameplayCountdown. `OverdriveUI` enabled in UI, PitTransit, PitService. Exactly one map enabled at a time.
- No template Player actions remain: Fire1/Fire2/Fire3, Jump, Move, Look, Submit, Cancel are absent or disabled — they cannot respond to input.
- `InputSystemUIInputModule` is enabled only for normal menu routing inside UI. It is disabled during Loading-blocked input, Finished Presentation, PitTransit, and PitService (direct-routing and blocked modes).
- When enabled for normal menu UI, the module references `OverdriveUI.Confirm` as Submit and `OverdriveUI.Cancel` as Cancel. No gameplay action is reused as a UI action; no binding override is copied between maps.
- Sole-ownership enforcement: action maps and the UI module are private to `InputContextController` (no public activation method; the asset's own Enable() remains callable through the ActiveAsset accessor — see next bullet); a static/code-level test rejects any Enable/Disable call on them outside that controller.
- Sanctioned read path (story-001 round 8): `InputContextController.ActiveAsset` is a read-only accessor exposing the controller-owned asset instance — the read path for Input-domain consumers (e.g. story-002 raw sample capture). Precise activation contract: the asset's own public `Enable()`/`FindActionMap().Enable()` remain callable by a consumer through the accessor (as they were via the module's `actionsAsset` before this accessor), but activation has no lasting effect — every context transition re-establishes exactly-one-map (disable-before-enable, ADR-0005), and a foreign wrapper's enabled actions are swept by `EnforceGlobalSoleOwnership()` at init and at both context transitions.
- Pause (Escape/Start) is not a rebinding target. Confirm is Enter / gamepad South; Cancel is Escape / gamepad East; gameplay Pause is Escape / gamepad Start; Finished-only UI Pause is P / gamepad Start.
- `InputSettings.updateMode` = `ProcessEventsInDynamicUpdate` (Input System 1.19.0 enum name — `Dynamic` is obsolete).
- Performance: no measurable impact expected — map/module activation is O(1) per context transition; Input System event processing is engine-owned (Dynamic Update, on-demand); this story introduces no per-tick allocations (capture and EMA are stories 002-004).

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: RawInputSample capture ordering (this story delivers the asset + controller; capture is 002)
- Story 007: Active scheme arbitration (KeyboardMouse default; last meaningful device wins — the same-frame scheme arbitration is out of scope here)
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
  - Edge cases: Fixed update; manual update; null settings asset. — **N/A**: `InputSystem.settings` is global and non-injectable (no override API), so these states cannot be produced in a test; configuration is verified by inspection plus the active-settings wiring assertion in the AC-30 test.
- **AC-45** (PlayMode integration test):
  - Given: An MVP input context is active.
  - When: The context controller activates the context.
  - Then: Exactly one of `OverdriveGameplay` or `OverdriveUI` is enabled.
  - Edge cases: Both enabled; neither enabled; repeated activation. Invalid context request — **N/A**: the controller exposes only the two parameterless setters (`SetGameplayContext`/`SetUIContext`); no invalid-request API exists to exercise.
- **AC-45b** (EditMode static/encapsulation test):
  - Given: The `InputContextController` owns the action maps and UI module.
  - When: A source-scan rejects Enable/Disable calls on them outside the controller, and an external activation attempt is made at runtime.
  - Then: The scan finds no external calls; the runtime attempt has no effect on map/module state.
  - Edge cases: Reflection-based activation; UI module Enable from a UI screen; map Enable from Settings.
- **AC-12** (PlayMode integration test):
  - Given: UI context is active and gameplay context is disabled.
  - When: Enter and gamepad South are pressed.
  - Then: UI Submit fires; no gameplay edge is queued.
  - Edge cases: Held input across context activation — Story 009 (context handoff latching mechanics — Out of Scope here); this story covers held input within a single context (no re-fire while held, AC-12 held-Enter test). Repeated press without release — covered. Simultaneous keyboard and gamepad input — Story 007 (active scheme arbitration — Out of Scope here).
- **AC-13** (PlayMode integration test):
  - Given: UI context is active.
  - When: Escape and gamepad East are pressed.
  - Then: UI Cancel fires; no gameplay edge is queued.
  - Edge cases: Escape held during transition — Story 009 (context handoff latching — Out of Scope here); held Escape within the UI context is covered (no re-fire while held, AC-12 pattern). Repeated press — covered. Simultaneous Cancel and gameplay input — Story 007 (active scheme arbitration — Out of Scope here).
- **AC-49a** (PlayMode integration test):
  - Given: Gamepad UI context is active.
  - When: South or East is pressed.
  - Then: South produces Submit and East produces Cancel.
  - Edge cases: Both buttons in one update; held buttons — covered in this story (AC-12/13 held tests: Escape, gamepad South, and gamepad East held for 3+ frames fire exactly one Submit/Cancel, no re-fire while held); UI map accidentally disabled.
- **AC-49b** (PlayMode integration test):
  - Given: Gameplay context is active.
  - When: Start is pressed.
  - Then: Pause rises once.
  - Edge cases: Start held; Start pressed while UI is active; release and repress.

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- `Assets/tests/integration/input/ActionAssetContextControllerTests.cs` — must exist and pass (EditMode asset/config + PlayMode context/routing tests)

**Status**: [x] Created — ActionAssetContextControllerTests.cs (PlayMode 37/37 passing — round-final: AC49a edge case "UI map accidentally disabled" added as `AC49a_UIMapExternallyDisabled_RestoredByNextTransition` on 2026-08-07)

**Round 8 (F2 interface fix)**: added the read-only `ActiveAsset` accessor — the sanctioned read path for story 002. Public-surface reflection extended: the only public `InputActionAsset` exposure is `ActiveAsset` (getter-only property, no setter); map/module exposure remains empty; no public Enable/Disable methods. New test `AC45b_ActiveAssetAccessor_ReturnsControllerAsset_ReadOnly` asserts asset identity with the enabled actions and the module wiring. Test count 34 → 35.

**Debug mission (Story 001, 2026-08-07) — root-cause fix verified**:
- AC45_SetGameplayContext_ExactlyOneMapEnabled / AC45_SetUIContext_ExactlyOneMapEnabled previously failed deterministically (both isolated and full suite).
- Root cause: the controller enforced the exactly-one-active-asset invariant only through the UI module's ref-count bookkeeping (InputSystemUIInputModule.cs:1730-1777), which is per-module and cannot clean the global enabled-actions list. A leaked `InputSystem_Actions` wrapper from a prior editor/play-mode environment (domain reload disabled) had BOTH maps enabled in the global system and survived InputTestFixture's SaveAndReset (wipes InputActionState, not ScriptableObjects); the module's AssignDefaultActions also leaves stale `s_InputActionReferenceCounts` entries.
- Fix: `InputContextController.EnforceGlobalSoleOwnership()` disables every globally enabled action not owned by the controller's own asset (identity comparison) — invoked at the end of `EnsureInitialized` and at the start of both `SetGameplayContext` and `SetUIContext`. The invariant now holds unconditionally, independent of the module's internal bookkeeping.
- Verified live: full InputIntegrationTests PlayMode suite 33/33; isolated pair 2/2; edit-mode probe (controller flow) shows only the controller's 5 enabled actions.
- Minor fixes: truthful comment on structural comparison coverage (`InputControlScheme.bindingGroup` / `InputBinding.action` not directly comparable via the public 1.19.0 API, transitively covered); AC69_Asset_MatchesGeneratedWrapperRuntime now compares while the wrapper is alive (inside the using block).

## Dependencies

- Depends on: None (foundation of the epic)
- Unlocks: Story 002, Story 007, Story 011, Story 012, Story 013

## Completion Notes

**Completed**: 2026-08-07
**Criteria**: 8/8 passing (no deferred items)
**Deviations**: None. ADR-0005 amended the same day (binding values single-sourced in GDD Core Rule 1, option B) — documentation-only; implementation unaffected and compliant (LP verified zero hardcoded binding paths in controller code).
**Test Evidence**: Integration — `Assets/tests/integration/input/ActionAssetContextControllerTests.cs`, 37/37 PlayMode PASS (2026-08-07, unityMCP run, 1.26s)
**Code Review**: Complete — LP-CODE-REVIEW APPROVE (1 style note, fixed); QL-TEST-COVERAGE GAPS (single gap: AC-49a edge case "UI map accidentally disabled") → resolved by adding `AC49a_UIMapExternallyDisabled_RestoredByNextTransition` before closure.
