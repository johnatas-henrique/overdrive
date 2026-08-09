# Story 007: Special Input Routing

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: L (8-12h)

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-003` (parte), `TR-input-010`, `TR-input-004` (parte)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0010 (Camera/VFX Rendering Budget and Interpolation), ADR-0005 (Input Context Controller and Action Map Inventory), ADR-0019 (UI Presentation Screen Flow)
**ADR Decision Summary**: `CameraToggle` is a presentation-only rising edge routed directly to Camera during Dynamic Update (one toggle per press, never enters SimulationInput/Replay/Ghost Recording). Mouse is UI-only in MVP — never produces Accelerate/Brake/Steer; pointer visibility follows the active UI scheme. Finished Presentation routes Confirm + UI Pause directly to UI Presentation and suppresses Cancel; PitService routes Confirm directly to Pit Stop after service eligibility; blocked modes (Loading, PitTransit) emit nothing.

**Engine**: Unity 6000.3.19f1 + Input System 1.19.0 | **Risk**: MEDIUM
**Engine Notes**: This story owns the direct-routing destinations (Camera, UI Presentation, Pit Stop). `InputSystemUIInputModule` is disabled during blocked/direct-routing modes. Unity `EventSystem` skips `Process()` on the activation frame — tests must wait one settle frame.

**Control Manifest Rules (Foundation)**:
- Required: `CameraToggle` routes rising edge same-frame via `InputAction.performed` → `Camera.ToggleRequest`; holding does not repeat; one toggle per press (ADR-0010).
- Required: Finished Presentation — `InputContextController` disables `InputSystemUIInputModule` while `SimulationState.Finished`; routes UI Pause + Confirm directly to UI Presentation; suppresses Cancel (ADR-0019).
- Forbidden: PitTransit/Loading-blocked — `InputSystemUIInputModule` disabled, no navigation/Submit/Cancel/gameplay event (ADR-0019).

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-26: GIVEN mouse movement or mouse click occurs during Racing, WHEN a tick processes input, THEN Accelerate, Brake, Steer, and Pause are unchanged by mouse input.
- [ ] AC-36: GIVEN UI is active and pointer movement assigns pointer focus, WHEN Navigate, Confirm, or Cancel arrives from keyboard or gamepad, THEN the pointer hides and that device family becomes the active UI scheme.
- [ ] AC-48: GIVEN UI is active and the pointer is hidden, WHEN pointer delta is at least 2 pixels or the player clicks, THEN the pointer becomes visible and KeyboardMouse becomes the active UI scheme; subsequent keyboard/gamepad Navigate, Confirm, or Cancel hides it and selects that device family.
- [ ] AC-58: GIVEN GameplayRacing, GameplayQualifying, or GameplayCountdown is active, WHEN C or gamepad North/Y/Triangle produces a CameraToggle rising edge, THEN Camera begins one mode transition in the same Dynamic Update; holding the control produces no additional transition until release, and no CameraToggle value enters SimulationInput or Ghost Recording.
- [ ] AC-52: GIVEN PitService is active before tire swap completes, WHEN Enter or South is pressed, THEN no exit occurs; GIVEN tire swap has completed, WHEN Enter or South is pressed, THEN Vehicle Physics begins pit exit with the current fuel level.
- [ ] AC-54: GIVEN Qualifying Finished Presentation is active, WHEN Enter or South is pressed, THEN UI Presentation dismisses it and opens Qualifying Results; Escape or East is ignored and all driving input remains disabled.
- [ ] AC-57: GIVEN SimulationState is Finished, WHEN P or gamepad Start is pressed, THEN UI Presentation toggles terminal presentation pause while SimulationState remains Finished; Escape/East remains suppressed and no generic UI Cancel is dispatched.
- [ ] AC-63: GIVEN Finished Presentation is active, WHEN Escape/East is pressed, THEN InputSystemUIInputModule is disabled for that routing mode, no Cancel handler executes, and the presentation remains active.
- [ ] AC-64: GIVEN PitService is active after tire swap completion, WHEN Enter/South is pressed, THEN Confirm routes directly to Pit Stop exactly once and no generic UI Submit handler executes.
- [ ] AC-65: GIVEN PitTransit or Loading-blocked input is active, WHEN any UI action occurs, THEN InputSystemUIInputModule is disabled and no navigation, Submit, Cancel, or gameplay event is emitted.

---

## Implementation Notes

*Derived from ADR-0010, ADR-0005, and ADR-0019 Implementation Guidelines:*

- **CameraToggle** (presentation-only): `InputAction.performed` rising edge → `Camera.ToggleRequest` routed same-frame during Dynamic Update. Holding does not repeat (one toggle per press). Never enters `SimulationInput`, tick pipeline, Replay, or Ghost Recording.
- **Mouse UI-only**: mouse never produces Accelerate/Brake/Steer. Pointer visibility: pointer input (delta ≥ 2 px or Click) makes it visible + KeyboardMouse active UI scheme; keyboard/gamepad Navigate/Confirm/Cancel hides it and selects that device family.
- **Finished Presentation**: `InputContextController` disables `InputSystemUIInputModule` while `SimulationState.Finished`; routes UI Pause + Confirm directly to UI Presentation; suppresses Cancel. `OverdriveUI.Pause` routed to UI Presentation only while Finished.
- **PitService**: `Confirm` routes directly to Pit Stop (after tire-swap eligibility, ~2s); Cancel ignored. `PitTransit`: OverdriveUI enabled but all UI actions ignored; no driving actions.
- **Blocked modes** (Loading, PitTransit): `InputSystemUIInputModule` disabled; no navigation/Submit/Cancel/gameplay event emitted.
- `InputSystemUIInputModule` enabled only for normal menu routing inside UI.

---

## Embedded Definitions

*Testability refinements from QL-STORY-READY gate.*

- **AC-36/48**: fake EventSystem + element under pointer; `FocusAssignObserver` verifies focus assigned to the element under the pointer position; expected focused element identified.
- **AC-52**: stub Pit Stop with known `currentFuel`; assert the exit command carries the current fuel level, gated by tire-swap completion.
- **AC-54**: Results screen identifier `QualifyingResults`; assert the transition event.
- **AC-58**: `CameraToggleRequestObserver` — exactly 1 request per press, same Dynamic Update, 0 while held.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 001: normal UI Submit/Cancel routing (this story handles the direct/blocked modes that override it).
- Story 006: context transitions (this story owns the destination routing, not the transition machine).

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-26**: Mouse input does not affect racing gameplay input
  - Given: Racing active; baseline Accelerate/Brake/Steer/Pause recorded.
  - When: mouse movement and primary clicks occur during processing.
  - Then: the four gameplay values remain equal to baseline; no gameplay Pause edge created.
  - Edge cases: large pointer deltas, clicks during held keyboard input, multiple clicks.

- **AC-36**: Keyboard/gamepad UI input hides the pointer and changes UI scheme
  - Given: UI active; pointer movement has assigned pointer focus.
  - When: Navigate, Confirm, or Cancel arrives from keyboard/gamepad.
  - Then: pointer hidden; that device family becomes the active UI scheme.
  - Edge cases: keyboard-to-gamepad and gamepad-to-keyboard transitions.

- **AC-48**: Pointer visibility and UI scheme arbitration
  - Given: UI active; pointer hidden.
  - When: pointer delta ≥ 2 px or click, then keyboard/gamepad UI input.
  - Then: pointer visible + KeyboardMouse active after pointer input; subsequent keyboard/gamepad hides it and selects that device family.
  - Edge cases: delta exactly 2 px, 1.99 px, clicks without movement, same-frame events.

- **AC-58**: CameraToggle routes one presentation request per press
  - Given: GameplayRacing/Qualifying/Countdown active.
  - When: C or gamepad North/Y/Triangle pressed and held.
  - Then: `CameraToggleRequestObserver == 1` same Dynamic Update; 0 additional while held; no value in SimulationInput/Ghost Recording.
  - Edge cases: release/repress, simultaneous devices, context transitions.

- **AC-52**: PitService Confirm is gated by tire-swap completion
  - Given: PitService active; tire swap incomplete then complete; known currentFuel.
  - When: Enter/South before and after completion.
  - Then: before completion no exit command; after, exactly one Pit Stop exit command carrying currentFuel.
  - Edge cases: held Confirm, repeated presses, tank-full eligibility.

- **AC-54**: Finished Qualifying Presentation routes Confirm to Results
  - Given: Qualifying Finished Presentation active.
  - When: Enter/South pressed.
  - Then: UI Presentation dismisses; opens `QualifyingResults`; Escape/East ignored; driving input disabled.
  - Edge cases: held Confirm, repeated Cancel, transition-frame input.

- **AC-57**: Finished Presentation Pause toggles terminal timer only
  - Given: SimulationState Finished; Finished Presentation active.
  - When: P or gamepad Start pressed.
  - Then: UI Presentation toggles its terminal timer; SimulationState remains Finished; Escape/East produces no generic Cancel.
  - Edge cases: repeated presses, held Start, timer already paused.

- **AC-63**: Finished Presentation suppresses Cancel
  - Given: Finished Presentation active.
  - When: Escape/East pressed.
  - Then: `InputSystemUIInputModule` disabled; no Cancel handler executes; presentation remains active.
  - Edge cases: held Cancel, press during presentation entry, repeated input.

- **AC-64**: PitService Confirm routes directly to Pit Stop once
  - Given: PitService active; tire swap complete.
  - When: Enter/South pressed.
  - Then: Pit Stop receives exactly one direct Confirm command; generic UI Submit does not execute.
  - Edge cases: held Confirm, repeated presses, simultaneous generic UI input.

- **AC-65**: Blocked contexts emit no input events
  - Given: PitTransit or Loading-blocked input active.
  - When: Navigate, Point, Click, Confirm, Cancel, Pause, and gameplay inputs occur.
  - Then: `InputSystemUIInputModule` disabled; no navigation/Submit/Cancel/gameplay/Pause event emitted.
  - Edge cases: all actions simultaneously, input held across entry into the blocked context.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `Assets/tests/integration/input/SpecialRoutingTests.cs` — must exist and pass (asmdef `InputIntegrationTests`).

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (controller), Story 006 (context machine).
- Unlocks: Story 008 (Settings interaction with direct routes); Core UI Menu / Pit Stop / Camera epics consume the routed actions.
