# Story 003: Dead-Zone Normalization

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-011` (Gamepad stick uses radial dead-zone normalization with inner 0.15 and outer 0.95; triggers use axial inner 0.05; keyboard is exempt)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0004: Settings Persistence and Control Profiles; ADR-0005: Input Context Controller and Action Map Inventory
**ADR Decision Summary**: ADR-0004: Control profiles carry stick dead-zone inner/outer and are validated per-field with approved defaults. ADR-0005: Input sanitization and dead-zone normalization run per 60 Hz tick, per control class, before EMA.

**Engine**: Unity 6000.3.19f1 | **Risk**: MEDIUM
**Engine Notes**: Input System 1.19.0 core APIs confirmed stable. No post-cutoff APIs in this story (pure math on sampled values). Verification required: numeric normalization correctness against the GDD formulas.

**Control Manifest Rules (this layer)**:
- Required: Input sanitization: NaN/Infinity → 0.0f; values outside [-1.0, 1.0] → clamped (source: ADR-0005)
- Required: Profiles are data-driven and applied per control class during the 60 Hz input-processing step; players may configure stick dead-zone values; trigger threshold remains design tuning in MVP (source: ADR-0005 — input-system.md:107)
- Forbidden: (none specific to this story)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-4: GIVEN a gamepad stick remains inside its radial inner threshold, WHEN a simulation tick processes it, THEN Steer output is exactly 0.0.
- [ ] AC-24: GIVEN trigger raw input is 0.05 or below, WHEN a tick processes it, THEN its normalized output is exactly 0.0.
- [ ] AC-25: GIVEN stick raw magnitude is 0.95 or above, WHEN a tick processes it, THEN its normalized magnitude is exactly 1.0.
- [ ] AC-32: GIVEN stick magnitude is 0.55 with inner threshold 0.15 and outer threshold 0.95, WHEN a tick processes it, THEN its normalized magnitude is exactly 0.5.
- [ ] AC-33: GIVEN trigger raw input is 0.525 with inner threshold 0.05, WHEN a tick processes it, THEN its normalized output is exactly 0.5.
- [ ] AC-51a: GIVEN keyboard gameplay input is processed, WHEN the dead-zone stage runs, THEN that channel's raw value passes through unchanged.
- [ ] AC-51b: GIVEN mouse pointer input is processed during gameplay, WHEN the dead-zone stage runs, THEN it produces no gameplay-axis value (pointer never feeds Accelerate, Brake, or Steer — mouse policy is Story 012's scope; asserted here for the dead-zone stage).

## Implementation Notes

*Derived from GDD Formulas section (input-system.md:204-235) and Core Rule 4 (:104-109):*

- Thresholds are INCLUSIVE at the inner bound: stick magnitude ≤ 0.15 outputs 0.0; trigger value ≤ 0.05 outputs 0.0; stick magnitude ≥ 0.95 outputs unit magnitude.
- Radial normalization (stick): `stick_out = 0 when m ≤ i; otherwise normalize(v) × clamp((m − i)/(o − i), 0, 1)` where m = |v|, i = 0.15, o = 0.95. Direction is preserved (normalize(v)).
- Axial normalization (trigger): `trigger_out = 0 when t ≤ i; otherwise clamp((t − i)/(1 − i), 0, 1)` where i = 0.05.
- Keyboard gameplay channels (W/S/A/D, arrows) and mouse pointer input have NO dead zone: keyboard channels pass through unchanged; pointer input never becomes a gameplay axis.
- Check values: magnitude 0.55 → (0.55−0.15)/(0.95−0.15) = 0.5 exactly. Trigger 0.525 → (0.525−0.05)/(1−0.05) = 0.5 exactly.
- Stick inner/outer values come from the control profile (Story 014 applies profile changes); the formulas here use the defaults 0.15/0.95. Trigger inner 0.05 is Input-owned tuning, not player-owned.
- Input sanitization runs after dead-zone normalization and before EMA (NaN/Infinity → 0.0f; out-of-range clamped) — Story 006 owns the sanitization stage; this story owns the normalization math.

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 004: EMA smoothing (consumes the normalized values)
- Story 014: Control profile integration (applies player-configured dead-zone values)
- Story 006: Sanitization of NaN/Infinity (raw stage) and clamping

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-4** (EditMode unit test):
  - Given: A gamepad stick sample has magnitude below or at the defined inner threshold (≤ 0.15).
  - When: Dead-zone normalization runs.
  - Then: Normalized Steer equals exactly `0.0`.
  - Edge cases: Zero vector; exactly inner threshold (0.15, inclusive); just outside threshold; diagonal vector.
- **AC-24** (EditMode unit test):
  - Given: Trigger raw input is `0.05` or lower.
  - When: Trigger normalization runs.
  - Then: Normalized output equals exactly `0.0`.
  - Edge cases: `0.0`; exactly `0.05` (inclusive); negative input; NaN; infinity.
- **AC-25** (EditMode unit test):
  - Given: Stick magnitude is `0.95` or greater.
  - When: Radial normalization runs.
  - Then: Normalized magnitude equals exactly `1.0`.
  - Edge cases: Exactly `0.95` (inclusive); `1.0`; above `1.0`; diagonal direction preservation.
- **AC-32** (EditMode unit test):
  - Given: Stick magnitude is `0.55`, inner threshold `0.15`, outer threshold `0.95`.
  - When: Radial normalization runs.
  - Then: Normalized magnitude equals exactly `0.5`.
  - Edge cases: Direction preservation; values just below and above `0.55`; zero-length vector.
- **AC-33** (EditMode unit test):
  - Given: Trigger raw input is `0.525`, inner threshold `0.05`.
  - When: Axial normalization runs.
  - Then: Normalized output equals exactly `0.5`.
  - Edge cases: Exactly inner threshold; exact outer endpoint; negative values; values above `1.0`.
- **AC-51a** (EditMode unit test):
  - Given: Keyboard gameplay samples (W/S/A/D) are supplied.
  - When: The dead-zone stage runs.
  - Then: Those channels retain their raw values unchanged.
  - Edge cases: Zero, negative, values outside legal ranges.
- **AC-51b** (EditMode unit test):
  - Given: Mouse pointer samples are supplied during gameplay.
  - When: The dead-zone stage runs.
  - Then: No gameplay-axis value is produced (Accelerate/Brake/Steer unchanged).
  - Edge cases: Mouse delta, mouse button values, pointer movement across context change.

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- `tests/unit/input/dead_zone_normalization_test.cs` — must exist and pass

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 002 (captured sample provides the raw values)
- Unlocks: Story 006 (tick processor pipeline), Story 014 (profile-driven values)
