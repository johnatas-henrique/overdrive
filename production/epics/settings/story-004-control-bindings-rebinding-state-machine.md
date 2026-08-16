# Story 004: Control Bindings & Rebinding State Machine

> **Epic**: Settings
> **Status**: Complete
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

- [ ] **AC-C1**: Given player selects action to rebind, When selected, Then system enters Listening state and exposes the pending target via `PendingTarget` ("Press a key or button..." rendering deferred to UI epic).
- [ ] **AC-C2**: Given Listening state, When player presses a valid non-conflicting key/button, Then working binding updates and state returns to Open. *(Scoped: only the selected BindingTarget slot updates — proven via Target.SlotIndex + CompositePart.)*
- [ ] **AC-C3**: Given Listening state, When player presses Escape or Gamepad East, Then rebinding is cancelled and the previous working binding is preserved.
- [ ] **AC-C4**: Given player binds key already assigned, When conflict detected, Then BindingConflict state opens exposing `PendingConflict.ConflictingActionId` ("This key is bound to [action]" text rendered by UI epic).
- [ ] **AC-C5**: Given player confirms BindingConflict, When accepted, Then working binding updates, old non-critical binding is cleared, and persistence waits for Apply.
- [ ] **AC-C6**: Given player modifies one binding slot, When the working override-set is emitted, Then the FULL `GetWorkingOverrides()` set differs from the pre-rebind baseline by exactly one changed slot (Target.SlotIndex + CompositePart) and all other slots remain unchanged. *(Persistence via Story 002's Apply is deferred — this story asserts the emitted collection diff.)*
- [ ] **AC-C7**: Given player is in Listening, When a valid keyboard or gamepad control is pressed, Then the capture port consumes it and the adapter performs no action-map activation or gameplay routing itself — the adapter never writes `ISchemeProbe.ActiveScheme` or calls routing APIs. *(Verified by adapter-surface scan: no routing calls. Cancel routing during capture remains InputContextController's domain — integration evidence in the Input assembly.)*
- [ ] **AC-C8**: Given a candidate conflicts with any fixed Confirm, Cancel, or Pause binding, When validation runs, Then the candidate is rejected immediately.
- [ ] **AC-C9**: Given player selects Confirm, Cancel, or Pause in the Controls screen, When rebinding is requested, Then Listening does not begin and the fixed binding remains unchanged.
- [ ] **AC-C10**: Given stick magnitude 0.55, inner threshold 0.15, and outer threshold 0.95 in the working profile, When the Settings preview path evaluates it via the existing `SettingsInputPreviewEvaluator` (Input epic deliverable consumed by Settings — no re-implementation), Then normalized magnitude is exactly 0.5 without reading or writing SimulationInput. *(Consumption verification in the Settings integration assembly.)*
- [ ] **AC-C11**: Given Accelerate alpha 0.3, raw input 1.0, and previous output 0.0 in the working profile, When the Settings preview path advances one step via the existing `SettingsInputPreviewEvaluator`, Then displayed EMA output is exactly 0.3 without advancing simulation. *(Consumption verification in the Settings integration assembly.)*
- [ ] **AC-C12**: Given a saved override references an unknown binding ID (an unknown ID subsumes unknown action — a binding id identifies its action implicitly per the shipped 2-field contract), When Input reports the fallback, Then Settings preserves every valid override, restores only the affected slot default, and exposes a non-blocking `BindingMigrationResult` with typed issues (UnknownBindingIds/MalformedPaths).
- [ ] **AC-ST2**: Given Settings Open, When player selects binding, Then transitions to Listening.
- [ ] **AC-ST3**: Given Listening, When valid input provided, Then transitions to Open (captured or rejected) or BindingConflict (non-critical conflict).
- [ ] **AC-ST4**: Given Listening, When Escape pressed, Then transitions to Open, no change.
- [ ] **AC-ST5**: Given BindingConflict, When override is confirmed, Then old non-critical binding is cleared and state transitions to Open.
- [ ] **AC-ST6**: Given BindingConflict, When cancelled, Then working binding set is preserved and state transitions to Open.
- [ ] **AC-E11**: Given a gamepad reconnects during Listening, When it sends a candidate control, Then Settings evaluates it only for rebinding and never mutates `ISchemeProbe.ActiveScheme`. *(Scheme arbitration on reconnect remains InputContextController's domain per ADR-0005 — ResolveActiveScheme re-evaluates per call; Settings never freezes or writes the probe.)*
- [ ] **AC-E4** (adapter boundary): Given persisted overrides contain two actions bound to the same key (external edit), When the mapping adapter processes them, Then the first action keeps its binding, the second falls back to its slot default (RestoredBindingIds), and a typed non-blocking `BindingMigrationResult` is returned. *(The load cascade itself remains Story 001's domain — verified here at the bindings-adapter boundary.)*

---

## Implementation Notes

*Derived from ADR-0004 + ADR-0005 Implementation Guidelines:*

- **`IRebindCapture` port** (Settings-owned consumer contract — gate NEW-1/NEW-6, QL-STORY-READY GAP 4/5):
  ```csharp
  public interface IRebindCapture {
      // Started begins Listening (state machine transitions Open -> Listening).
      // Rejected when the target is reserved, unknown, or malformed — Listening never begins;
      // CaptureStartResult.Reason carries the typed rejection cause (Reserved/UnknownAction/UnknownBinding).
      CaptureStartResult BeginCapture(BindingTarget target);
      void EndCapture();                    // cancels active listening (Escape, Gamepad East, device loss)
      void ConfirmConflict();               // AC-C5: accept the pending override
      void CancelConflict();                // AC-ST6: reject the pending override
      event Action<CaptureResult> Captured; // single delivery mechanism for completed candidates
  }

  public enum CaptureStartStatus { Started, Rejected }
  public readonly struct CaptureStartResult {
      public readonly CaptureStartStatus Status;
      public readonly RejectionReason? Reason; // set when Status == Rejected
  }

  public readonly struct BindingTarget {
      public readonly Guid ActionId;          // stable ID (ADR-0004:148)
      public readonly Guid BindingId;         // stable ID (ADR-0004:149)
      public readonly ControlScheme Scheme;   // KeyboardMouse / Gamepad
      public readonly int SlotIndex;          // 0=Primary, 1=Secondary (KeyboardMouse); 0=only (Gamepad)
      public readonly string CompositePart;   // null/"" for whole binding; "left"/"right" for Steer 1D-axis composite
  }

  public enum CaptureResultKind { Captured, Conflict, Cancelled, Rejected }
  public enum RejectionReason { Reserved, UnknownAction, UnknownBinding, MalformedPath, DuplicateCandidate, DeviceLost }
  // RejectionReason applies to the CAPTURE path only (BeginCapture with a bad target, or an
  // invalid candidate). Persisted-override issues (AC-C12/E4) surface through BindingMigrationResult.
  public readonly struct CaptureResult {
      public readonly CaptureResultKind Kind;
      public readonly BindingTarget Target;           // target that began capture
      public readonly string CandidatePath;           // e.g. "<Keyboard>/w"
      public readonly Guid? ConflictingActionId;      // set when Kind == Conflict
      public readonly Guid? ConflictingBindingId;
      public readonly RejectionReason? Reason;        // set when Kind == Rejected (device loss cancels via Cancelled + Reason = DeviceLost)
  }
  ```
  **Ownership ruling (gate)**: Settings owns the port contract. Its adapter may call the Input catalog and Unity capture APIs but must NOT independently enable maps, route gameplay actions, or duplicate reserved-binding policy — InputContextController remains sole owner of those (ADR-0005). The adapter never writes `InputContextController.ActiveScheme`/`CurrentContext`; capture-time suppression is InputContextController's existing domain.
- **Slot coverage** (GDD:131): KeyboardMouse 10 slots (Accelerate/Brake/Steer Left/Steer Right/CameraToggle × Primary/Secondary), Gamepad 4 slots (Accelerate/Brake/analog Steer/CameraToggle). Steer composite parts via `CompositePart` ("left"/"right"); whole analog Gamepad Steer uses null.
- **Reserved rejection** (AC-C8/C9): BeginCapture on a reserved Confirm/Cancel/Pause target returns `Rejected` immediately — Listening never begins.
- **Settings persistence representation** (gate NEW-4, reconstruct post-gate — shipped governs): the persistence model is the EXISTING `BindingOverrideData { Guid BindingId; string Path }` (2 fields, `Assets/source/Settings.Core/BindingOverrideData.cs:5-10` — doc: "the shipped Input contract, 2 fields, which governs over the draft 4-field ADR-0004 form; ActionId is derivable from the catalog and IsReserved is a catalog property, never persisted"). `IsReserved` is never persisted (reserved slots never rebind — always false) and `ActionId` is derivable from the catalog lookup (binding.id → action). This story defines a Settings→Input mapping adapter with explicit tests. The adapter exposes the working override-set for Story 002's Apply via `IReadOnlyList<BindingOverrideData> GetWorkingOverrides()` and maps persisted overrides synchronously via `BindingMigrationResult MapPersistedOverrides(IReadOnlyList<BindingOverrideData> persisted)`:
  ```csharp
  public readonly struct BindingMigrationResult {
      public readonly IReadOnlyList<BindingOverrideData> PreservedOverrides; // every valid override
      public readonly IReadOnlyList<Guid> RestoredBindingIds;                // slots reset to default
      public readonly IReadOnlyList<Guid> UnknownBindingIds;                 // unknown id (action subsumed — a binding id identifies its action implicitly)
      public readonly IReadOnlyList<string> MalformedPaths;                  // malformed/reserved-conflicting/cap-violated paths
  }
  ```
  Unknown BindingId (which subsumes unknown action) restores only the affected slot default, preserves every valid override, and the returned result is the non-blocking typed notice (AC-C12, AC-E4).
- **State machine** (GDD:183-197): Open → Listening → (Captured→Open | Rejected→Open | Conflict→BindingConflict) → (Override→Open | Cancel→Open). **Dependency injection**: the state machine receives `IRebindCapture` via its constructor and subscribes to `Captured`; tests drive it through a fake capture emitting `CaptureResult` events (no real Input System needed for unit coverage). **Cancel handoff**: the Unity-backed `IRebindCapture` adapter owns the Input System cancel-event subscription (Cancel binding / Escape / Gamepad East) and surfaces it as `CaptureResult.Cancelled`; the state machine's caller-facing `CancelListening()` is the programmatic cancel (device loss, UI Cancel) — composition wires both. Public surface: `BeginListening(BindingTarget)` (returns `CaptureStartStatus`, Rejected when reserved/unknown), `CancelListening()` (→ Open, no mutation), `ConfirmConflict()` (clears old non-critical binding, working updates, Open), `CancelConflict()` (working set preserved, Open), `IReadOnlyList<SettingsBindingOverride> GetWorkingOverrides()` (FULL override-set; changes are verified as a diff against the pre-rebind baseline), `SettingsBindingState State`, `BindingTarget? PendingTarget` (set while Listening — drives the prompt), and `CaptureResult? PendingConflict` (set in BindingConflict — exposes ConflictingActionId for "This key is bound to [action]"). UI presentation deferred to UI epic; Settings owns transitions + transactional working-data changes.
- **Active-scheme probe** (AC-E11): the state machine/adapter consume `ISchemeProbe { ControlScheme ActiveScheme { get; } }` injected at composition — the InputContextController-backed probe is owned elsewhere; tests inject a fake. **Capture never freezes or writes the probe**: `InputContextController.ResolveActiveScheme()` re-evaluates per call and a reconnect may arbitrate a scheme change (ADR-0005 device-switch arbitration) — AC-E11 therefore asserts Settings never mutates the probe and evaluates the candidate only for rebinding; scheme arbitration remains InputContextController's domain.
- **Preview evaluator** (AC-C10/C11): exists at `Assets/source/SettingsInputPreviewEvaluator.cs` — verify only.
- **Gamepad reconnect** (AC-E11, GDD:253): rebind capture consumes the candidate without Settings mutating the active scheme; scheme arbitration on reconnect remains `InputContextController`'s domain (ADR-0005) — the probe is read-only to Settings.
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

- **AC-C1**: Given Open and valid concrete target; When select slot; Then state becomes Listening and `PendingTarget` exposes the target. *(Target = ActionId+BindingId+Scheme+SlotIndex+CompositePart; prompt rendering deferred to UI.)*
- **AC-C2**: Given Listening; When valid non-conflicting candidate; Then only target slot updates and state returns Open. *(Proven via Target.SlotIndex + CompositePart.)*
- **AC-C3**: Given Listening with existing working binding; When Escape/Gamepad East; Then capture cancels and binding is unchanged.
- **AC-C4**: Given candidate conflicts with non-reserved slot; When capture; Then BindingConflict opens with `PendingConflict.ConflictingActionId` identified.
- **AC-C5**: Given BindingConflict; When confirm override; Then old non-critical binding clears, new binding becomes working-only, persistence waits for Apply.
- **AC-C6**: Given one selected slot changed; When working override-set is emitted; Then the FULL `GetWorkingOverrides()` set differs from baseline by exactly one changed slot (proven via Target.SlotIndex + CompositePart); all other slots unchanged. *(Persistence via Apply deferred to Story 002.)*
- **AC-C7**: Given Listening; When candidate arrives; Then capture consumes it and the adapter performs no routing (adapter-surface scan: no routing/probe writes). Cancel routing during capture is InputContextController integration evidence (Input assembly), not asserted here.
- **AC-C8**: Given candidate conflicts with Confirm/Cancel/Pause; When validate; Then immediate Rejected result and no mutation.
- **AC-C9**: Given reserved slot selected; When request rebind; Then Listening never begins.
- **AC-C10**: Given magnitude .55, inner .15, outer .95; When evaluate preview (Settings consumption of the existing evaluator); Then normalized magnitude is exactly .5, with no SimulationInput read/write.
- **AC-C11**: Given alpha .3, input 1.0, previous 0; When advance preview; Then output is .3, with no simulation tick.
- **AC-C12**: Given persisted overrides include unknown BindingId; When map through adapter; Then only affected slot falls back, valid overrides survive, and `BindingMigrationResult` carries typed issues. *(Edge: unknown BindingId → UnknownBindingIds (unknown action subsumed — binding id identifies its action); malformed path → MalformedPaths — all via the migration result, not CaptureResult.)*
- **AC-ST2**: Given Open; When select binding; Then Listening state.
- **AC-ST3**: Given Listening; When captured/rejected/conflicting result; Then Open for captured/rejected and BindingConflict for non-critical conflict.
- **AC-ST4**: Given Listening; When Escape; Then Open with no binding mutation.
- **AC-ST5**: Given BindingConflict; When override; Then old binding clears and state becomes Open.
- **AC-ST6**: Given BindingConflict; When cancel; Then working binding set is unchanged and state becomes Open.
- **AC-E11**: Given gamepad reconnects during Listening; When candidate arrives; Then candidate is evaluated only by capture, Settings never mutates `ISchemeProbe.ActiveScheme` (fake in unit, InputContextController-backed in integration).
- **AC-E4**: Given persisted overrides contain two actions bound to the same key; When map through adapter; Then first binding preserved, second slot defaulted (RestoredBindingIds), and `BindingMigrationResult` returned non-blocking.

**Required edge cases** (each maps to a typed result): primary/secondary slots, Steer composite parts, capture path — unknown ActionId/BindingId in target → Rejected(UnknownAction/UnknownBinding), reserved target → Rejected(Reserved), malformed candidate → Rejected(MalformedPath), duplicate candidate → Rejected(DuplicateCandidate), device loss → Cancelled(DeviceLost); migration path — unknown BindingId (subsumes unknown action) → BindingMigrationResult.UnknownBindingIds, malformed persisted path → MalformedPaths.

---

## Test Evidence

**Story Type**: Logic
**Performance disposition**: No per-frame performance impact expected — the rebind state machine, capture port, and mapping adapter execute only while Settings is open (menu-time), never in the gameplay loop; the Listening path is a settings-time port with no physics or rendering involvement. AC-C7 gameplay suppression is verified through the existing InputContextController contract, not a new hot-path system.
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/settings/ControlBindingTests.cs` — state machine + persistence representation + mapping adapter
- Integration: `Assets/tests/integration/settings/ControlBindingIntegrationTests.cs` — Input contract interaction (capture consumption via `IRebindCapture`, Settings never mutates `ISchemeProbe.ActiveScheme` during capture, AC-C10/C11 preview consumption of the existing `SettingsInputPreviewEvaluator` — new Settings-side consumption tests, distinct from the Input epic's legacy evaluator tests)

**Status**: ✅ Created — `ControlBindingTests.cs` 29 tests + `ControlBindingIntegrationTests.cs` 35 tests = **64 tests**, full suite **639/639 green** (2026-08-13).

---

## Dependencies

- Depends on: Story 001 (Settings Persistence & Migration) — DONE; Input epic (complete, sprint 1) for `ControlProfile`, `InputBindingCatalog`, `SettingsInputPreviewEvaluator`, `InputContextController` — DONE
- Unlocks: None directly (UI epic consumes the rebinding state machine for the Controls screen)

---

## Completion Notes

**Completed**: 2026-08-13
**Criteria**: 19/19 passing (0 deferred)
**Deviations**:
- ADVISORY — TR-settings-005 (registry) requirement is "ControlProfile validation" (covered by Input epic + Story 002); the GDD rebind ACs delivered here (C1-C12/ST2-ST6/E4/E11) have no dedicated TR in the registry → TD-033
- OUT OF SCOPE justified — `InputBindingCatalog.cs` (Input epic) modified: seams `GetActionId`/`HasBinding`/`RefreshSlotPath` + cap substitution/accounting/seeding fixes found by code review; `Overdrive.Settings.asmdef` +`Unity.InputSystem`
**Test Evidence**: Logic — `Assets/tests/unit/settings/ControlBindingTests.cs` (29) + `Assets/tests/integration/settings/ControlBindingIntegrationTests.cs` (35) = 64 tests, full suite 639/639 green
**Code Review**: Complete — code-review 8 qa-tester rounds (BLOCKING → TESTABLE) + 4 unity-specialist rounds (APPROVED); QL-TEST-COVERAGE ADEQUATE (R2); LP-CODE-REVIEW APPROVED (R2)
