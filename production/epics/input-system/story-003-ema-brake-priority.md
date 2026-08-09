# Story 003: EMA & Brake Priority

> **Epic**: Input System
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: M (4-6h)

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-007`, `TR-input-012` (parte)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0005 (Input Context Controller and Action Map Inventory)
**ADR Decision Summary**: Input sanitization — raw channels validated after dead-zone normalization and before EMA (NaN/Infinity → 0.0f, values outside [-1.0, 1.0] clamped); EMA alphas Accelerate 0.3, Brake 0.3, Steer 0.5; brake priority with Accelerate EMA freeze while raw brake > 0, resuming from the frozen pre-brake value.

**Engine**: Unity 6000.3.19f1 + Input System 1.19.0 | **Risk**: LOW
**Engine Notes**: Pure C# recurrence — no Unity engine dependencies. EMA executes once per 60 Hz simulation tick, never per render frame.

**Control Manifest Rules (Foundation)**:
- Required: Input sanitization — NaN/Infinity → 0.0f; values outside [-1.0, 1.0] → clamped (ADR-0005).
- Required: EMA executes once per simulation tick, never per render frame (ADR-0001).

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-1: GIVEN raw Accelerate is 1.0 from rest (previous output 0.0, α=0.3), WHEN the first simulation tick processes it, THEN Accelerate output is 0.3 and no keyboard-only ramp is applied (keyboard mapping is Story 001's scope).
- [ ] AC-2: GIVEN raw Steer is -1.0 from rest (previous output 0.0, α=0.5), WHEN the first simulation tick processes it, THEN Steer output is -0.5 and no keyboard-only ramp is applied (keyboard mapping is Story 001's scope).
- [ ] AC-3: GIVEN Steer raw input is -1.0 and α=0.5, WHEN one simulation tick processes it from rest, THEN Steer output is -0.5.
- [ ] AC-5: GIVEN raw Accelerate and raw Brake are both 1.0 from rest with Brake α = 0.3, WHEN the tick processes them, THEN Accelerate output is exactly 0.0 and Brake output equals its EMA-filtered value of 0.3.
- [ ] AC-6: GIVEN Accelerate alpha is 0.3 and raw Accelerate is 1.0 for nine consecutive simulation ticks, WHEN tick nine completes, THEN Accelerate output is ≥0.95.
- [ ] AC-27: GIVEN EMA alpha is 0.0, WHEN raw input changes, THEN output retains its previous value; GIVEN alpha is 1.0, output equals raw input exactly.
- [ ] AC-31: GIVEN raw Brake after dead-zone equals 0.0 and filtered Accelerate is the EMA result for the current tick (e.g. prev=0.0, raw=1.0, α=0.3 → 0.3), WHEN Accelerate is processed, THEN Accelerate output equals that filtered value.
- [ ] AC-38: GIVEN Accelerate has reached steady-state output (e.g. 9 ticks at raw=1.0, α=0.3 → 0.95+), WHEN raw Brake rises above its dead-zone threshold (e.g. raw=1.0, Brake prev=0.0, α=0.3), THEN on the next tick Accelerate output immediately becomes 0.0 while Brake output equals its EMA-filtered value for that tick (0.3).
- [ ] AC-42: GIVEN Accelerate EMA is frozen at its pre-brake value (e.g. 0.657 after 3 ticks at raw=1.0, α=0.3) while brake priority is active for 2 ticks with raw Accelerate still 1.0, WHEN raw Brake returns to 0 and the next tick executes, THEN Accelerate EMA resumes from exactly 0.657 (not 0, not a value accumulated during braking).
- [ ] AC-71: GIVEN raw Accelerate/Brake/Steer is NaN, +Infinity, -Infinity, above 1.0, or below -1.0 after dead-zone, WHEN the EMA processor sanitizes it before the recurrence, THEN NaN/Infinity become 0.0 and out-of-range values are clamped to ±1.0 (TR-input-012, Core Rule :152).

---

## Implementation Notes

*Derived from ADR-0005 Implementation Guidelines:*

- EMA recurrence: `output = α × raw + (1 − α) × previous_output`, one per tick. Alphas: Accelerate 0.3, Brake 0.3, Steer 0.5.
- **Config-ready interface**: the EMA processor takes its three alphas as parameters (defaults 0.3/0.3/0.5) — no hardcoded alphas inside the recurrence beyond the defaults. Story 008 passes control-profile alphas instead. Mirrors Story 002's `DeadZoneNormalizer`, which accepts stick/trigger thresholds as optional parameters.
- Input sanitization before EMA: raw channels with NaN/Infinity are replaced by 0.0f; values outside [-1.0, 1.0] are clamped. Tested here by AC-71 (TR-input-012, Core Rule :152). The rate-limited warning (1/channel/60-tick window) lives in Story 004 (AC-22) at the tick level — this story sanitizes the value, Story 004 logs the warning.
- Brake priority: `brakeOut = filteredBrake`; `accelerateOut = 0 when rawBrakePostDeadZone > 0, otherwise filteredAccelerate`.
- While brake priority is active, Accelerate EMA state is FROZEN at its last pre-brake value — it neither advances toward current raw throttle nor resets. When raw brake returns to 0, the next tick resumes the EMA recurrence from that frozen value.
- Vehicle Physics receives `accelerateOut`, `brakeOut`, `steerOut` once per 60 Hz tick and adds no second ramp/smoothing layer.

---

## Performance Budget

- EMA recurrence is a pure C# O(1) computation per channel per tick — three multiplications + one addition, zero heap allocations.
- Executes once per 60 Hz simulation tick (ADR-0001), never per render frame.
- Fits the simulation gate (p95 ≤ 6 ms / max ≤ 8 ms per tick): three channels × constant work per tick is negligible against the tick budget.

---

## Embedded Definitions

*Testability refinements from QL-STORY-READY gate.*

- EMA state is a deterministic pure function of (α, previous output, raw input). Tests assert exact float values using known fixtures (e.g. α=0.3, raw=1.0, prev=0.0 → 0.3, 0.51, 0.657, 0.7599, 0.83193 over five ticks; ≥0.95 on tick 9).
- Brake priority freeze/resume asserts the exact frozen value is carried, never 0 nor a value accumulated during braking.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 004: SimulationInput tick processor (orchestrates validation → dead-zone → EMA → brake and owns AC-22's tick-level warning rate-limiting).
- Story 002: dead-zone normalization (the stage preceding EMA).

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-1**: Raw Accelerate produces 0.3 on the first tick
  - Given: raw Accelerate = 1.0 from rest; Accelerate α=0.3; EMA prev=0.0.
  - When: the first simulation tick processes input.
  - Then: `accelerateOut == 0.3`; no keyboard ramp applied (keyboard mapping is Story 001's scope).
  - Edge cases: α=0.0 and 1.0.

- **AC-2**: Raw Steer produces -0.5 on the first tick
  - Given: raw Steer = -1.0 from rest; Steer α=0.5; prev=0.0.
  - When: the first tick processes input.
  - Then: `steerOut == -0.5`.
  - Edge cases: positive 1.0, nonzero prev, alpha endpoints.

- **AC-3**: Steer EMA produces -0.5 from raw -1.0
  - Given: raw steer -1.0; Steer α=0.5; prev=0.0.
  - When: one tick executes.
  - Then: `steerOut == -0.5`.
  - Edge cases: positive 1.0, nonzero prev, alpha endpoints.

- **AC-5**: Brake priority suppresses Accelerate
  - Given: raw Accelerate and Brake both 1.0; Brake α=0.3; prev values 0.0.
  - When: one tick processes both channels.
  - Then: `accelerateOut == 0.0`; `brakeOut == 0.3`.
  - Edge cases: brake exactly at threshold and just above.

- **AC-6**: Accelerate reaches ≥0.95 after nine EMA ticks
  - Given: Accelerate α=0.3; raw stays 1.0; initial 0.0.
  - When: nine ticks execute.
  - Then: tick nine `accelerateOut >= 0.95`.
  - Edge cases: values never exceed 1.0.

- **AC-27**: EMA alpha endpoints behave exactly
  - Given: known EMA prev and raw.
  - When: processing with α=0.0 then α=1.0.
  - Then: α=0.0 retains prev; α=1.0 equals raw exactly.
  - Edge cases: all three channels, negative Steer.

- **AC-31**: Accelerate is not suppressed when Brake is zero
  - Given: post-dead-zone Brake = 0.0; filtered Accelerate known.
  - When: Accelerate is processed.
  - Then: `accelerateOut == filteredAccelerate`.
  - Edge cases: Brake exactly zero and below trigger threshold.

- **AC-38**: Brake immediately suppresses steady-state Accelerate
  - Given: Accelerate at steady-state; raw Brake rises above its dead-zone threshold.
  - When: the next tick processes.
  - Then: `accelerateOut == 0.0`; `brakeOut` follows Brake EMA.
  - Edge cases: brake just above threshold, full brake.

- **AC-42**: Accelerate EMA resumes from its frozen pre-brake state
  - Given: brake priority active; raw Accelerate nonzero; Accelerate EMA frozen at known value.
  - When: raw Brake returns to 0 and next tick executes.
  - Then: Accelerate EMA resumes from the frozen pre-brake value, not 0 and not accumulated during braking.
  - Edge cases: multiple brake ticks, partial throttle changes.

- **AC-71**: Non-finite and out-of-range raw input is sanitized before EMA
  - Given: raw Accelerate/Brake/Steer = NaN, +Infinity, -Infinity, 1.5, or -1.5 after dead-zone.
  - When: the EMA processor sanitizes the channel before the recurrence.
  - Then: NaN/±Infinity → 0.0; 1.5 → 1.0; -1.5 → -1.0; EMA recurrence uses the sanitized value.
  - Edge cases: all three channels; sanitization precedes the EMA recurrence (not after).

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `Assets/tests/unit/input/EmaBrakePriorityTests.cs` — must exist and pass (unit asmdef `InputUnitTests`, created at implementation time).

**Status**: [x] Created — 20 tests, 45/45 suite green

---

## Dependencies

- Depends on: Story 001 (asset/controller).
- Unlocks: Story 004 (consumes the EMA/brake units in the pipeline).

## Completion Notes
**Completed**: 2026-08-09
**Criteria**: 10/10 passing (AC-1, 2, 3, 5, 6, 27, 31, 38, 42, 71)
**Deviations**: None (ADR-0005 compliant; manifest version 2026-08-05 match; pure C# — no Unity engine dependency)
**Test Evidence**: Logic — `Assets/tests/unit/input/EmaBrakePriorityTests.cs` (20 tests, 45/45 suite green)
**Code Review**: Complete (7 rounds, unity-specialist + qa-tester persistent reviewers, APPROVED)
**Advisory**: retenção de prev não-zero com α=0 → coberta na story-006 (AC-41 `InitializeFromPostDeadZone`); handoff anotado nas Implementation Notes da story-006.
