# Story 005: Brake Priority and EMA Freeze

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-007` (EMA alphas: Accelerate 0.3, Brake 0.3, Steer 0.5; brake priority with EMA freeze)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0005: Input Context Controller and Action Map Inventory
**ADR Decision Summary**: Brake priority is explicit: `brakeOut = filteredBrake`; `accelerateOut = 0 when rawBrakePostDeadZone > 0, otherwise filteredAccelerate`. While brake priority is active, the Accelerate EMA state freezes at its last pre-brake value; when raw brake returns to 0, the next tick resumes the recurrence from that frozen value.

**Engine**: Unity 6000.3.19f1 | **Risk**: MEDIUM
**Engine Notes**: Input System 1.19.0 core APIs confirmed stable. No post-cutoff APIs in this story (pure state-machine recurrence math). Verification required: frozen-state resume correctness across brake cycles.

**Control Manifest Rules (this layer)**:
- Required: Brake priority: when rawBrakePostDeadZone > 0, accelerateOut = 0 and Accelerate EMA is frozen (source: ADR-0005)
- Required: Input sanitization before EMA (source: ADR-0005)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-5: GIVEN raw Accelerate and raw Brake are both 1.0 from rest with Brake α = 0.3, WHEN the tick processes them, THEN Accelerate output is exactly 0.0 and Brake output equals its EMA-filtered value of 0.3.
- [ ] AC-31: GIVEN raw Brake after dead-zone equals 0.0, WHEN Accelerate is processed, THEN Accelerate output equals filtered Accelerate.
- [ ] AC-38: GIVEN Accelerate has reached steady-state output and raw Brake rises above its dead-zone threshold, WHEN the next tick processes input, THEN Accelerate output immediately becomes 0.0 while Brake output follows its EMA filter.
- [ ] AC-42: GIVEN Brake priority is active while raw Accelerate remains non-zero, WHEN raw Brake returns to 0, THEN Accelerate EMA resumes from its frozen pre-brake value rather than from 0 or from a value accumulated during braking.

## Implementation Notes

*Derived from GDD Core Rule 6 (input-system.md:149-157) and Formulas — Brake Priority (:221-225):*

- Brake priority rules:
  - `brakeOut = filteredBrake` (Brake EMA output).
  - `accelerateOut = 0 when rawBrakePostDeadZone > 0; otherwise filteredAccelerate`.
  - "rawBrakePostDeadZone > 0" uses the post-dead-zone raw value, NOT the filtered Brake output — a light brake press above the trigger dead zone (0.05) already zeroes accelerate.
- EMA freeze: while brake priority is active, the Accelerate EMA state is frozen at its last pre-brake value. It does not advance toward current raw throttle and does not reset. When raw brake returns to 0, the next tick resumes the recurrence from that frozen value.
- Test fixture (per QA review): steady-state is defined as `filteredAccelerate = 1.0` (recurrence converged with raw Accelerate 1.0 and α = 0.3). AC-38: with filteredAccelerate at steady state 1.0 and raw Brake rising above 0.05, the next tick outputs Accelerate 0.0. AC-42: with the pre-brake frozen value at exactly 1.0 and raw Accelerate held at 1.0 throughout braking, the first post-brake tick resumes from 1.0 (output ≥ 1.0 × α + ... — the recurrence continues from 1.0, so with raw still 1.0 the output remains 1.0; with raw changed, the recurrence applies from 1.0, never from 0 or from a braking-period value).

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 004: The base EMA engine this story extends (brake priority is layered on it)
- Story 006: Tick processor pipeline (consumes this story's outputs into SimulationInput)
- Story 003: Dead-zone stage (rawBrakePostDeadZone is produced there)

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-5** (EditMode unit test):
  - Given: Raw Accelerate and Brake are both `1.0`; both EMAs start at rest; Brake alpha is `0.3`.
  - When: One tick processes input.
  - Then: Accelerate output is `0.0`; Brake output is `0.3`.
  - Edge cases: Brake at dead-zone; Accelerate zero; both held for multiple ticks.
- **AC-31** (EditMode unit test):
  - Given: Post-dead-zone Brake equals `0.0` and Accelerate has a nonzero raw value.
  - When: Accelerate is processed.
  - Then: Accelerate output equals its filtered EMA output.
  - Edge cases: Brake exactly threshold; Brake negative; stale brake EMA state.
- **AC-38** (EditMode unit test):
  - Given: Accelerate is at steady state (`filteredAccelerate = 1.0`) and Brake rises above its dead-zone threshold.
  - When: The next tick processes input.
  - Then: Accelerate output immediately becomes `0.0`; Brake follows its EMA filter.
  - Edge cases: Brake exactly threshold; Brake rises from nonzero; simultaneous Accelerate change.
- **AC-42** (EditMode unit test):
  - Given: Brake priority is active, raw Accelerate remains nonzero, and the pre-brake Accelerate EMA state is `1.0` (frozen value recorded).
  - When: Brake returns to zero.
  - Then: Accelerate EMA resumes from the recorded frozen value (`1.0`) and does not include braking-period accumulation.
  - Edge cases: Multiple braking ticks; Accelerate changes during braking; repeated brake cycles.

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- `tests/unit/input/brake_priority_test.cs` — must exist and pass

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 004 (EMA engine), Story 003 (post-dead-zone raw values)
- Unlocks: Story 006 (full tick pipeline)
