# Story 014: Control Profile Integration and Preview

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-007` (EMA alphas per control profile), `TR-input-011` (stick dead-zone values per control profile)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0004: Settings Persistence and Control Profiles; ADR-0005: Input Context Controller and Action Map Inventory
**ADR Decision Summary**: ADR-0004: Control profiles (dead zones, EMA alphas, bindings) are validated on load — invalid values fall back to approved defaults. Settings uses a transactional preview (`SettingsEditSession`): the working copy applies to runtime immediately for preview; the first 60 Hz tick after resume uses the same profile. TriggerDeadZoneInner is NOT player-owned — always overwritten from Input-owned tuning on load. ADR-0005: per-channel EMA alpha is a profile field; the tick processor consumes the active profile.

**Engine**: Unity 6000.3.19f1 | **Risk**: LOW
**Engine Notes**: PlayerPrefs API stable (ADR-0004 LOW knowledge risk). No post-cutoff APIs in this story. Verification required: schema migration v1→v3 on existing PlayerPrefs blob (Settings epic owns the blob; this story consumes the validated profile).

**Control Manifest Rules (this layer)**:
- Required: Settings uses PlayerPrefs single JSON blob with backup-first write; schema migration v1→v2→v3 sequentially on load (source: ADR-0004 — persistence owned by Settings epic; this story consumes the result)
- Required: `TriggerDeadZoneInner` is NOT player-owned — always overwritten from Input-owned tuning on load (source: ADR-0004)
- Required: Every loaded profile is validated before use: `0 ≤ stick_dead_zone_inner < stick_dead_zone_outer ≤ 1`, `0 ≤ trigger_inner < 1`, every EMA alpha within [0,1]; invalid values fall back per field to the approved default with one rate-limited warning per settings load (source: ADR-0005 — input-system.md:109)
- Forbidden: Never use individual PlayerPrefs keys per setting (source: ADR-0004 — Settings owns persistence)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-11: GIVEN Settings changes a control profile while simulation is paused, WHEN SettingsInputPreviewEvaluator renders its response, THEN it uses the working profile; the first 60 Hz tick after resume uses that same profile.
- [ ] AC-50: GIVEN Settings applies a stick dead-zone or EMA alpha change, WHEN the next 60 Hz tick builds SimulationInput, THEN that tick uses the working values previewed by SettingsInputPreviewEvaluator while the trigger threshold remains the Input-owned tuning value.
- [ ] AC-68: GIVEN a loaded control profile has stick_inner >= stick_outer, non-finite thresholds, or alpha outside [0,1], WHEN validation runs, THEN each invalid field returns to its approved default before any tick processing and one rate-limited warning is emitted.

## Implementation Notes

*Derived from ADR-0004 Decision (ControlProfile, :136-140) and GDD Core Rules 4-6 (:104-157):*

- Approved defaults (GDD tuning knobs, input-system.md:275-277 + ADR-0004 ControlProfile): StickDeadZoneInner 0.15, StickDeadZoneOuter 0.95, StickDeadZoneInner range 0.0-0.95; EMA alphas Accelerate 0.3, Brake 0.3, Steer 0.5. TriggerDeadZoneInner 0.05 is NOT player-owned — always overwritten from Input-owned tuning on load (ADR-0004:136-137).
- Preview semantics: `SettingsInputPreviewEvaluator` renders the working profile (the SettingsEditSession working copy) while simulation is paused; the first 60 Hz tick after resume uses that same profile. Apply persists and commits; Cancel restores the snapshot.
- Trigger threshold remains the Input-owned tuning value — profile changes never alter it (AC-50).
- Validation on load (per field, before any tick processing): `0 ≤ stick_inner < stick_outer ≤ 1`, `0 ≤ trigger_inner < 1`, every EMA alpha within [0,1], non-finite thresholds rejected. Each invalid field returns to its approved default; exactly one rate-limited warning per settings load (not one per tick).
- Deterministic preview fixture (per QA review): with stick magnitude 0.55 and StickDeadZoneInner changed to 0.20 → expected normalized output (0.55−0.20)/(0.95−0.20) = 0.4667; with Accelerate raw 1.0 and EMA alpha changed to 0.5 → expected first-tick output 0.5. The preview renderer and the first resumed tick must both produce these expected outputs, while the trigger threshold remains fixed at 0.05.

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Settings epic: SettingsEditSession, persistence blob, schema migration, and the Settings UI
- Story 003: normalization math (consumes profile stick values)
- Story 004: EMA engine (consumes profile alphas)
- Story 013: binding overrides (a different profile surface)

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-11** (EditMode preview test + PlayMode resume test):
  - Given: Simulation is paused and Settings changes the working control profile.
  - When: Preview renders and simulation resumes.
  - Then: Preview uses the working profile; the first 60 Hz tick uses the same profile.
  - Edge cases: Multiple edits before Apply; cancel changes; resume on the same frame as Apply; profile reload.
- **AC-50** (EditMode integration test):
  - Given: Settings applies a stick dead-zone or EMA alpha change.
  - When: The next tick builds SimulationInput.
  - Then: Stick/EMA processing uses the working previewed values; trigger threshold remains the Input-owned tuning value (0.05).
  - Edge cases: Change only one field; invalid value; change immediately before tick; trigger threshold also present in the profile.
  - Deterministic fixture: stick 0.55 with inner 0.20 → output 0.4667; Accelerate raw 1.0 with alpha 0.5 → first tick 0.5; trigger 0.05 unchanged.
- **AC-68** (EditMode validation test):
  - Given: A loaded profile contains `stick_inner >= stick_outer`, non-finite thresholds, or alpha outside [0,1].
  - When: Profile validation runs before tick processing.
  - Then: Each invalid field is replaced by its approved default; one rate-limited warning is emitted; no invalid value reaches the tick processor.
  - Edge cases: Multiple invalid fields; NaN; positive/negative infinity; equality at `stick_inner == stick_outer`; repeated validation within the rate-limit window.

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- `tests/integration/input/control_profile_preview_test.cs` — must exist and pass (EditMode validation/preview tests + PlayMode resume test)

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 003 (normalization consumes profile values), Story 004 (EMA consumes profile alphas), Story 013 (override surface)
- Unlocks: Settings epic's control-profile UI and preview evaluation
