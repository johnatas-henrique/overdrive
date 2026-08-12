# Story 004: Control Bindings & Rebinding State Machine

> **Epic**: Settings
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: M (4-5h)

## Context

**GDD**: `design/gdd/settings.md`
**Requirement**: `TR-settings-005`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0004: Settings Persistence and Control Profile Schema; ADR-0005: Input Context Controller & Action Map Inventory
**ADR Decision Summary**: Binding overrides are keyed by Input-owned stable action and binding IDs. Reserved bindings (Confirm, Cancel, Pause) are rejected during Listening — cannot be rebound, replaced, or removed. Control profiles validated per-field with fallback to approved defaults. Settings owns the rebinding state machine (Listening/BindingConflict); InputContextController remains sole owner of action-map activation and routing.

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS) | **Risk**: MEDIUM (Input System rebinding capture interaction)

**Engine Notes**: `InputContextController` is the sole owner of action-map activation (ADR-0005) — the Settings-side capture port's adapter must NOT enable maps, route gameplay actions, or duplicate reserved-binding policy.

**Control Manifest Rules (Foundation layer)**:
- Required: Pause is fixed and reserved across ALL contexts — cannot be remapped, replaced, or removed. Confirm and Cancel are reserved in all UI contexts — source: ADR-0005
- Required: Reserved bindings (Confirm, Cancel, Pause) rejected during Listening — cannot be rebound, replaced, or removed; binding Action/Binding GUIDs stable after first shipped schema — source: ADR-0004
- Required: `TriggerDeadZoneInner` is NOT player-owned — always overwritten from Input-owned tuning on load — source: ADR-0004

---

## Acceptance Criteria

*From GDD `design/gdd/settings.md`, scoped to this story:*

- [ ] **AC-C1**: Given player selects action to rebind, When selected, Then system enters Listening state, shows "Press a key or button...". *(Scoped: state transition + prompt trigger via port; UI rendering deferred to UI epic.)*
- [ ] **AC-C2**: Given Listening state, When player presses a valid non-conflicting key/button, Then working binding updates and state returns to Open. *(Scoped: only the selected BindingTarget slot updates — proven via Target.SlotIndex + CompositePart.)*
- [ ] **AC-C3**: Given Listening state, When player presses Escape or Gamepad East, Then rebinding is cancelled and the previous working binding is preserved.
- [ ] **AC-C4**: Given player binds key already assigned, When conflict detected, Then prompt: "This key is bound to [action]. Reassign?"
- [ ] **AC-C5**: Given player confirms BindingConflict, When accepted, Then working binding updates, old non-critical binding is cleared, and persistence waits for Apply.
- [ ] **AC-C6**: Given player modifies one binding slot, When Apply succeeds, Then only that stable slot in the selected scheme is persisted and all other slots remain unchanged.
- [ ] **AC-C7**: Given player is in Listening, When a valid keyboard or gamepad control is pressed, Then Input System delivers it to Settings rebinding capture and not to gameplay or menu navigation. *(Verified through the Input contract — gameplay dispatch suppression per ADR-0005; does not re-implement Input System.)*
- [ ] **AC-C8**: Given a candidate conflicts with any fixed Confirm, Cancel, or Pause binding, When validation runs, Then the candidate is rejected immediately.
- [ ] **AC-C9**: Given player selects Confirm, Cancel, or Pause in the Controls screen, When rebinding is requested, Then Listening does not begin and the fixed binding remains unchanged.
- [ ] **AC-C10**: Given stick magnitude 0.55, inner threshold 0.15, and outer threshold 0.95 in the working profile, When SettingsInputPreviewEvaluator renders it, Then normalized magnitude is exactly 0.5 without reading or writing SimulationInput. *(ALREADY EXISTS in Assets/source/SettingsInputPreviewEvaluator.cs — verify only, no re-implementation.)*
- [ ] **AC-C11**: Given Accelerate alpha 0.3, raw input 1.0, and previous output 0.0 in the working profile, When SettingsInputPreviewEvaluator advances one preview step, Then displayed EMA output is exactly 0.3 without advancing simulation. *(ALREADY EXISTS — verify only.)*
- [ ] **AC-C12**: Given a saved override references an unknown action or binding ID, When Input reports the fallback, Then Settings preserves every valid override, restores only the affected slot default, and exposes a non-blocking migration notice.
- [ ] **AC-ST2**: Given Settings Open, When player selects binding, Then transitions to Listening.
- [ ] **AC-ST3**: Given Listening, When valid input provided, Then transitions to Open (captured or rejected) or BindingConflict (non-critical conflict).
- [ ] **AC-ST4**: Given Listening, When Escape pressed, Then transitions to Open, no change.
- [ ] **AC-ST5**: Given BindingConflict, When override is confirmed, Then old non-critical binding is cleared and state transitions to Open.
- [ ] **AC-ST6**: Given BindingConflict, When cancelled, Then working binding set is preserved and state transitions to Open.
- [ ] **AC-E11**: Given a gamepad reconnects during Listening, When it sends a candidate control, Then Settings evaluates it only for rebinding and active control scheme remains unchanged until Listening ends.
- [ ] **AC-E4** (load path): Given two actions bound to same key (external edit), When game loads, Then first action keeps binding, second reset to default with console warning. *(Also covered in Story 001; verified here at the bindings-adapter boundary.)*

---

## Implementation Notes

*Derived from ADR-0004 + ADR-0005 Implementation Guidelines:*

- **`IRebindCapture` port** (Settings-owned consumer contract — gate NEW-1/NEW-6):
  ```csharp
  public interface IRebindCapture {
      CaptureResult BeginCapture(BindingTarget target);
      event Action<CaptureResult> Captured; // or polling CurrentResult
  }

  public readonly struct BindingTarget {
      public readonly Guid ActionId;          // stable ID (ADR-0004:148)
      public readonly Guid BindingId;         // stable ID (ADR-0004:149)
      public readonly ControlScheme Scheme;   // KeyboardMouse / Gamepad
      public readonly int SlotIndex;          // 0=Primary, 1=Secondary (KeyboardMouse); 0=only (Gamepad)
      public readonly string CompositePart;   // null/"" for whole binding; "left"/"right" for Steer 1D-axis composite
  }

  public enum CaptureResultKind { Captured, Conflict, Cancelled, Rejected }
  public readonly struct CaptureResult {
      public readonly CaptureResultKind Kind;
      public readonly BindingTarget Target;       // associated with the target that began capture
      public readonly string CandidatePath;       // e.g. "<Keyboard>/w"
      public readonly Guid? ConflictingActionId;  // set when Kind == Conflict
      public readonly Guid? ConflictingBindingId;
  }
  ```
  **Ownership ruling (gate)**: Settings owns the port contract. Its adapter may call the Input catalog and Unity capture APIs but must NOT independently enable maps, route gameplay actions, or duplicate reserved-binding policy — InputContextController remains sole owner of those (ADR-0005).
- **Slot coverage** (GDD:131): KeyboardMouse 10 slots (Accelerate/Brake/Steer Left/Steer Right/CameraToggle × Primary/Secondary), Gamepad 4 slots (Accelerate/Brake/analog Steer/CameraToggle). Steer composite parts via `CompositePart` ("left"/"right"); whole analog Gamepad Steer uses null.
- **Reserved rejection** (AC-C8/C9): BeginCapture on a reserved Confirm/Cancel/Pause target returns `Rejected` immediately — Listening never begins.
- **Settings persistence representation** (gate NEW-4): `SettingsBindingOverride { Guid ActionId; Guid BindingId; string Path; bool IsReserved; }` — separate from the Input-side catalog which models BindingId+Path only (`InputBindingCatalog.cs:54-71`). This story defines a Settings→Input mapping adapter with explicit tests. Unknown ActionId OR BindingId → affected slot default + valid overrides preserved + typed non-blocking warning (AC-C12).
- **State machine** (GDD:183-197): Open → Listening → (Captured→Open | Rejected→Open | Conflict→BindingConflict) → (Override→Open | Cancel→Open). UI presentation deferred to UI epic; Settings owns transitions + transactional working-data changes.
- **Preview evaluator** (AC-C10/C11): exists at `Assets/source/SettingsInputPreviewEvaluator.cs` — verify only.
- **Gamepad reconnect** (AC-E11, GDD:253): rebind capture consumes candidate without changing active scheme; scheme may change only after Listening ends.
- **`TriggerDeadZoneInner`**: NOT player-owned — always overwritten from Input-owned tuning (ADR-0004:44, manifest:44).

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- [Story 002]: EditSession Apply/Cancel lifecycle (bindings persisted via its Apply)
- UI rendering of the Controls screen, Listening prompt, conflict dialog → UI Menu epic
- Actual Input System capture-mode API (WaitForControl) beyond the catalog → TD-registered for UI epic (Input epic is complete — not re-opened)
- Audio output for rebinding clicks → Audio epic

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate, round 3 + NEW-6 correction). The developer implements against these — do not invent new test cases during implementation.*

- **AC-C1**: Given Open and valid concrete target; When select slot; Then state becomes Listening and prompt is shown. *(Target = ActionId+BindingId+Scheme+SlotIndex+CompositePart.)*
- **AC-C2**: Given Listening; When valid non-conflicting candidate; Then only target slot updates and state returns Open. *(Proven via Target.SlotIndex + CompositePart.)*
- **AC-C3**: Given Listening with existing working binding; When Escape/Gamepad East; Then capture cancels and binding is unchanged.
- **AC-C4**: Given candidate conflicts with non-reserved slot; When capture; Then BindingConflict opens with conflicting action identified.
- **AC-C5**: Given BindingConflict; When confirm override; Then old non-critical binding clears, new binding becomes working-only, persistence waits for Apply.
- **AC-C6**: Given one selected slot changed; When Apply; Then only that stable slot persists; all other schemes/slots remain unchanged. *(Edge: primary/secondary slots, Steer composite parts.)*
- **AC-C7**: Given Listening; When candidate arrives; Then capture consumes it and gameplay/menu navigation receives no event. Edge: cancellation still routes through reserved Cancel.
- **AC-C8**: Given candidate conflicts with Confirm/Cancel/Pause; When validate; Then immediate Rejected result and no mutation.
- **AC-C9**: Given reserved slot selected; When request rebind; Then Listening never begins.
- **AC-C10**: Given magnitude .55, inner .15, outer .95; When evaluate preview; Then normalized magnitude is exactly .5, with no SimulationInput read/write.
- **AC-C11**: Given alpha .3, input 1.0, previous 0; When advance preview; Then output is .3, with no simulation tick.
- **AC-C12**: Given persisted overrides include unknown ActionId/BindingId; When map through adapter; Then only affected slot falls back, valid overrides survive, and migration notice is non-blocking. *(Edge: unknown ActionId, unknown BindingId, malformed path.)*
- **AC-ST2**: Given Open; When select binding; Then Listening state.
- **AC-ST3**: Given Listening; When captured/rejected/conflicting result; Then Open for captured/rejected and BindingConflict for non-critical conflict.
- **AC-ST4**: Given Listening; When Escape; Then Open with no binding mutation.
- **AC-ST5**: Given BindingConflict; When override; Then old binding clears and state becomes Open.
- **AC-ST6**: Given BindingConflict; When cancel; Then working binding set is unchanged and state becomes Open.
- **AC-E11**: Given gamepad reconnects during Listening; When candidate arrives; Then candidate is evaluated only by capture, active scheme remains unchanged until Listening ends.

**Required edge cases**: primary/secondary slots, Steer composite parts, unknown ActionId, unknown BindingId, reserved path, malformed path, duplicate candidate, capture cancellation during device loss.

---

## Test Evidence

**Story Type**: Logic
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/settings/ControlBindingTests.cs` — state machine + persistence representation + mapping adapter
- Integration: `Assets/tests/integration/settings/ControlBindingIntegrationTests.cs` — Input contract interaction (suppression via existing InputContextController)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (Settings Persistence & Migration) — DONE; Input epic (complete, sprint 1) for `ControlProfile`, `InputBindingCatalog`, `SettingsInputPreviewEvaluator`, `InputContextController` — DONE
- Unlocks: None directly (UI epic consumes the rebinding state machine for the Controls screen)
