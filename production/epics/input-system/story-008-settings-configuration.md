# Story 008: Settings Configuration

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: M (6-8h)

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-013`, `TR-input-004` (parte)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0004 (Settings Persistence and Control Profiles), ADR-0005 (Input Context Controller and Action Map Inventory)
**ADR Decision Summary**: Control profiles (dead-zone, EMA alphas, binding overrides) are validated per-field before use — invalid fields fall back to approved defaults with a rate-limited warning; preview is immediate, persist happens on Apply. Binding overrides use stable action/binding GUIDs; an unknown ID invalidates only that override. Reserved Confirm/Cancel/Pause bindings cannot be replaced or removed. `TriggerDeadZoneInner` is NOT player-owned (Input-owned tuning).

**Engine**: Unity 6000.3.19f1 + Input System 1.19.0 | **Risk**: LOW
**Engine Notes**: Settings integration — the Input side exposes binding slots and display strings, receives per-slot overrides + profile fields. Persistence is via ADR-0004's transactional preview (working copy → Apply/Cancel).

**Control Manifest Rules (Foundation)**:
- Required: `TriggerDeadZoneInner` is NOT player-owned — always overwritten from Input-owned tuning on load (ADR-0004).
- Required: Binding overrides use stable action and binding GUIDs; an unknown ID invalidates only that override (ADR-0005).
- Required: Reserved Confirm, Cancel, and Pause bindings cannot be replaced or removed (ADR-0005).

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-10: GIVEN Settings enters Listening, WHEN a remappable race-action candidate arrives, THEN Settings receives Captured, Conflict, or Rejected and no gameplay edge is queued.
- [ ] AC-11: GIVEN Settings changes a control profile while simulation is paused, WHEN SettingsInputPreviewEvaluator renders its response, THEN it uses the working profile; the first 60 Hz tick after resume uses that same profile.
- [ ] AC-29: GIVEN a remap candidate conflicts with a reserved Confirm, Cancel, or Pause binding, WHEN capture validation runs, THEN the candidate is rejected immediately.
- [ ] AC-46: GIVEN Settings displays Confirm, Cancel, or Pause, WHEN the player attempts to select one as a rebinding target or remove its binding, THEN Listening does not begin and the fixed reserved binding remains.
- [ ] AC-50: GIVEN Settings applies a stick dead-zone or EMA alpha change, WHEN the next 60 Hz tick builds SimulationInput, THEN that tick uses the working values previewed by SettingsInputPreviewEvaluator while the trigger threshold remains the Input-owned tuning value.
- [ ] AC-66: GIVEN Settings selects KeyboardMouse Steer Left Secondary for rebinding, WHEN a valid candidate completes, THEN only that composite-part binding ID is overridden and Steer Right plus all other slots remain unchanged.
- [ ] AC-67: GIVEN a saved override references an unknown stable binding ID, WHEN overrides load, THEN only that slot returns to its default and all other valid overrides remain active.
- [ ] AC-68: GIVEN a loaded control profile has `stick_inner >= stick_outer`, non-finite thresholds, or alpha outside `[0,1]`, WHEN validation runs, THEN each invalid field returns to its approved default before any tick processing and one rate-limited warning is emitted.

---

## Implementation Notes

*Derived from ADR-0004 and ADR-0005 Implementation Guidelines:*

- **Listening**: while Listening is active, `OverdriveGameplay` is disabled; `OverdriveUI.Cancel` cancels capture; `OverdriveUI.Confirm` confirms a non-binding modal choice. Captured race-action candidates return `Captured`, `Conflict`, or `Rejected`. Reserved Confirm/Cancel/Pause bindings cannot be replaced or removed.
- **Binding overrides** use stable action and binding GUIDs. Keyboard Steer rebinds the selected 1D-axis composite part by stable binding ID/index — never the composite root. If a saved override references an unknown ID, discard only that override, restore that slot's default, preserve valid overrides, report the migration result to Settings.
- **Control profile validation**: before any tick, validate `0 ≤ stick_inner < stick_outer ≤ 1`, `0 ≤ trigger_inner < 1`, and every EMA alpha within `[0,1]`. Invalid fields fall back per-field to approved defaults with one rate-limited warning per settings load. `TriggerDeadZoneInner` is always overwritten from Input-owned tuning.
- **Preview**: `SettingsInputPreviewEvaluator` renders the working profile (immediate preview while paused); the first 60 Hz tick after Resume/Apply uses the same profile. Apply persists; Cancel restores the snapshot.

---

## Embedded Definitions

*Testability refinements from QL-STORY-READY gate (AC-10 mapping corrected to match AC-29).*

- **AC-10/AC-29 mapping**: valid non-conflicting candidate → `Captured`; candidate conflicting with an existing NON-reserved binding → `Conflict`; candidate that is reserved (Confirm/Cancel/Pause), malformed, or exceeded → `Rejected` (satisfies AC-29's "rejected immediately" for reserved bindings).
- **AC-11**: `SettingsInputPreviewEvaluator` receives the raw sample, applies the working profile; output compared against the first resumed tick (same profile).
- **AC-50**: working profile injected via a `SettingsEditSession` mock; assert the tick uses the working values; trigger threshold remains Input-owned tuning.
- **AC-68**: per-field named warning (`StickDeadZoneInvalid`, `TriggerThresholdInvalid`, `EmaAlphaInvalid`); EACH invalid field emits its named warning at most once per settings load.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002/003: the actual dead-zone/EMA math (this story wires the working profile into them).
- Settings epic (Core layer): the Settings UI, persistence, and edit-session lifecycle — Input only exposes slots + accepts overrides.

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-10**: Listening classifies remap candidates
  - Given: Settings in Listening; gameplay input disabled.
  - When: a remappable race-action candidate is submitted.
  - Then: Settings receives exactly one result: Captured (valid non-conflicting), Conflict (conflicts with non-reserved binding), or Rejected (reserved/malformed/exceeded); no gameplay edge queued.
  - Edge cases: valid, conflicting, reserved, malformed, simultaneous input.

- **AC-11**: Settings preview uses the working control profile
  - Given: Simulation paused; snapshot + modified working profile.
  - When: `SettingsInputPreviewEvaluator` evaluates input; next tick runs after resume.
  - Then: preview uses the working profile; first resumed tick uses the same profile and produces the same expected output.
  - Edge cases: stick inner/outer changes, EMA changes, Cancel, Apply.

- **AC-29**: Reserved binding conflict is rejected immediately
  - Given: candidate conflicts with reserved Confirm/Cancel/Pause.
  - When: capture validation runs.
  - Then: candidate status is `Rejected`; no override created.
  - Edge cases: reserved action replacement, removal, alternate device bindings.

- **AC-46**: Reserved bindings cannot be selected or removed
  - Given: Settings displays Confirm, Cancel, or Pause.
  - When: player attempts to select one as a rebinding target or remove it.
  - Then: Listening does not begin; the fixed binding remains unchanged.
  - Edge cases: all reserved actions, both keyboard/gamepad bindings.

- **AC-50**: Settings profile changes apply on the next simulation tick
  - Given: Settings changes stick dead-zone or EMA alpha; trigger threshold remains Input-owned.
  - When: the next 60 Hz tick builds `SimulationInput`.
  - Then: the tick uses the working values from the `SettingsEditSession`; trigger processing uses the Input-owned threshold.
  - Edge cases: each configurable field, invalid working values.

- **AC-66**: KeyboardMouse Steer Left Secondary overrides only its binding
  - Given: Settings selects KeyboardMouse Steer Left Secondary; valid candidate available.
  - When: rebinding completes.
  - Then: only the selected composite-part binding ID is overridden; Steer Right and every other slot unchanged.
  - Edge cases: composite root not changed, all binding IDs compared before/after.

- **AC-67**: Unknown binding ID falls back without discarding valid overrides
  - Given: saved settings contain one unknown stable binding ID and other valid overrides.
  - When: overrides load.
  - Then: only the unknown slot returns to default; valid overrides remain active; Settings receives the migration/fallback result.
  - Edge cases: unknown action ID, multiple unknown IDs, malformed path, empty override list.

- **AC-68**: Invalid control-profile fields fall back before ticking
  - Given: loaded profile has `stick_inner >= stick_outer`, non-finite thresholds, or alpha outside `[0,1]`.
  - When: profile validation runs before any tick.
  - Then: each invalid field replaced with its approved default (valid fields unchanged); one named warning per invalid field, at most once per load.
  - Edge cases: each invalid field independently, multiple invalid fields, NaN, ±Infinity, repeated loads.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `Assets/tests/integration/input/Story008SettingsConfigurationTests.cs` — must exist and pass (asmdef `InputIntegrationTests`).

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002 (dead-zone), Story 003 (EMA), Story 001 (asset/controller).
- Unlocks: Settings epic (Core layer) consumes the exposed slots + override/profile API.
