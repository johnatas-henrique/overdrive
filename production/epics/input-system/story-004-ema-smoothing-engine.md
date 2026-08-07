# Story 004: EMA Smoothing Engine

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-007` (EMA alphas: Accelerate 0.3, Brake 0.3, Steer 0.5; brake priority with EMA freeze)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0004: Settings Persistence and Control Profiles; ADR-0005: Input Context Controller and Action Map Inventory
**ADR Decision Summary**: ADR-0004: EMA alphas are control-profile fields validated per-field with approved defaults (0.3/0.3/0.5). ADR-0005: The EMA recurrence executes once per 60 Hz simulation tick on the post-dead-zone values; keyboard has no ramp; per-channel alpha may be reconfigured by Settings.

**Engine**: Unity 6000.3.19f1 | **Risk**: MEDIUM
**Engine Notes**: Input System 1.19.0 core APIs confirmed stable. No post-cutoff APIs in this story (pure recurrence math). Verification required: frame-rate independence (same tick sequence → same outputs regardless of render rate).

**Control Manifest Rules (this layer)**:
- Required: EMA alphas per channel: Accelerate α = 0.3; Brake α = 0.3; Steer α = 0.5 (source: ADR-0005 — input-system.md:150)
- Required: Input sanitization before EMA: NaN/Infinity → 0.0f; out-of-range → clamped (source: ADR-0005)
- Guardrail: Simulation tick budget p95 ≤ 6 ms, max ≤ 8 ms (source: ADR-0001)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-1: GIVEN keyboard W/Up is held from rest, WHEN the first simulation tick processes input, THEN Accelerate output is 0.3 and no keyboard-only ramp is applied.
- [ ] AC-2: GIVEN keyboard A/Left is held from rest, WHEN the first simulation tick processes input, THEN Steer output is -0.5 and no keyboard-only ramp is applied.
- [ ] AC-3: GIVEN Steer raw input is -1.0 and α=0.5, WHEN one simulation tick processes it from rest, THEN Steer output is -0.5.
- [ ] AC-6: GIVEN Accelerate alpha is 0.3 and raw Accelerate is 1.0 for nine consecutive simulation ticks, WHEN tick nine completes, THEN Accelerate output is ≥0.95.
- [ ] AC-27: GIVEN EMA alpha is 0.0, WHEN raw input changes, THEN output retains its previous value; GIVEN alpha is 1.0, output equals raw input exactly.
- [ ] AC-7: GIVEN identical raw input sequences at 30 FPS and 144 FPS, WHEN each sequence advances through the same 60 simulation ticks, THEN both runs produce identical SimulationInput values per tick.

## Implementation Notes

*Derived from GDD Formulas — EMA Smoothing (input-system.md:206-219) and Core Rule 6 (:149-157):*

- Recurrence: `output = α × raw + (1 − α) × previous_output`. Executes once per 60 Hz simulation tick.
- Alphas: Accelerate 0.3, Brake 0.3, Steer 0.5 (defaults; per-channel alpha is a control-profile field applied by Story 014).
- EMA accepts -1.0 to 1.0 for Steer and 0.0 to 1.0 for Accelerate and Brake.
- Keyboard has no ramp: keys map directly to raw values (W/S → 1 or 0; A/D and Left/Right → -1, 0, +1). The EMA is the only smoothing for all devices.
- Behavior at extremes: α=0 → output never changes; α=1 → output = raw (no smoothing).
- Example check (from GDD): α=0.3, raw=1.0, prev=0.0 produces 0.3, then 0.51, 0.657, 0.7599, 0.83193 over the first five ticks; reaches ≥0.95 on tick 9.
- Frame-rate independence: the recurrence executes per TICK, not per render frame. Identical raw sequences advanced through the same 60 ticks under 30 FPS and 144 FPS schedules must produce identical per-tick outputs (accumulator catch-up processes the same sample per tick — Story 006).
- EMA-internal NaN/Infinity clamps to the last valid output with a rate-limited warning (GDD Edge Case :243) — the two-stage non-finite handling is owned by Story 006; the EMA state machine here must be structured to support it.

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 003: Dead-zone normalization (feeds this story's raw input)
- Story 005: Brake priority and EMA freeze (extends this engine with the priority rule)
- Story 006: Tick processor pipeline and sanitization stages
- Story 014: Profile-driven alpha changes

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-1** (EditMode unit test):
  - Given: Keyboard W/Up is held and Accelerate EMA is at rest.
  - When: One simulation tick processes the input.
  - Then: Accelerate output is `0.3`; no additional keyboard ramp is applied.
  - Edge cases: W and Up simultaneously; first tick after reset; held input across multiple ticks.
- **AC-2** (EditMode unit test):
  - Given: Keyboard A/Left is held and Steer EMA is at rest.
  - When: One simulation tick processes the input.
  - Then: Steer output is `-0.5`; no keyboard-only ramp is applied.
  - Edge cases: A and Left simultaneously; opposite input; first tick after reset.
- **AC-3** (EditMode unit test):
  - Given: Steer previous value is `0`, raw Steer is `-1.0`, alpha is `0.5`.
  - When: One tick runs.
  - Then: Steer output is `-0.5`.
  - Edge cases: Positive input; alpha zero; alpha one; repeated ticks.
- **AC-6** (EditMode unit test):
  - Given: Accelerate alpha is `0.3`, previous output is `0`, raw Accelerate is `1.0`.
  - When: Nine consecutive ticks run.
  - Then: Tick-nine output is at least `0.95`.
  - Edge cases: Reset between ticks; raw input released midway; alpha boundary values.
- **AC-27** (EditMode unit test):
  - Given: EMA alpha is first `0.0`, then `1.0`.
  - When: Raw input changes.
  - Then: Alpha `0.0` retains the previous output; alpha `1.0` equals raw input exactly.
  - Edge cases: Negative raw input; repeated changes; transitions between alpha values.
- **AC-7** (EditMode deterministic tick test):
  - Given: Identical raw samples are delivered through render schedules of 30 FPS and 144 FPS.
  - When: Each schedule advances exactly 60 simulation ticks.
  - Then: SimulationInput values match at every corresponding tick.
  - Edge cases: Zero, one, and multiple ticks per render Update; accumulator remainder; long frame.

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- `tests/unit/input/ema_smoothing_test.cs` — must exist and pass

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 002 (captured sample), Story 003 (post-dead-zone raw values)
- Unlocks: Story 005 (brake priority extends this engine), Story 006 (full tick pipeline)
