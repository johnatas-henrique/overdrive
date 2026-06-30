# Story 002: Dead Zone Formula + Analog Processing

> **Epic**: Input
> **Status**: Complete
> **Last Updated**: 2026-06-29
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/input.md`
**Requirement**: `TR-INP-003` — Dead zone formula applied to analog inputs: `output = |raw| < threshold ? 0 : sign(raw) × (|raw| - threshold) / (1 - threshold)`; configurable per-axis via `input.deadZone`.

**ADR Governing Implementation**: ADR-0006: Input Abstraction
**ADR Decision Summary**: Dead zone formula preserves full range above threshold — no sensitivity loss. A threshold of 0.0 disables the dead zone entirely. Applied to all analog inputs (steer, throttle, brake).

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure math function — zero Babylon imports. Fully deterministically testable.

**Control Manifest Rules (this layer)**:

- Required (C13): Dead zone formula: `output = |raw| < threshold ? 0 : sign(raw) × (|raw| - threshold) / (1 - threshold)`.
- Performance (F-G3): Slot 1 (Input) < 0.01ms per tick — dead zone formula is a single multiply-add.

---

## Acceptance Criteria

_From GDD `design/gdd/input.md`, scoped to this story:_

- [ ] **AC-1**: `applyDeadZone(raw: number, threshold: number): number` returns 0 when `|raw| < threshold`
- [ ] **AC-2**: Above threshold, output preserves sign and remaps: `sign(raw) × (|raw| - threshold) / (1 - threshold)`
- [ ] **AC-3**: `threshold = 0` disables dead zone (passthrough — output equals raw)
- [ ] **AC-4**: `threshold = 0.5` snaps values below ±0.5 to 0; ±1.0 maps to ±1.0
- [ ] **AC-5**: Steering input (-1..1) and throttle/brake input (0..1) pass through same formula (range-agnostic)
- [ ] **AC-6**: Function is pure — no side effects, no state, same inputs always produce same outputs

---

## Implementation Notes

_Derived from ADR-0006 Implementation Guidelines:_

1. **Pure function**: Export `applyDeadZone(raw: number, threshold: number): number`. This is a stateless utility — no class, no instance. File location: `src/core/input/deadZone.ts`.
2. **Formula**: `output = Math.abs(raw) < threshold ? 0 : Math.sign(raw) * (Math.abs(raw) - threshold) / (1 - threshold)`
3. **Floating point**: Use `Math.abs`, `Math.sign` — avoid branching when possible for performance. This runs every tick for 3 axes.
4. **Config integration**: The threshold value is read from Data & Config Manager under `input.deadZone` namespace. This story only owns the formula function. The integration (reading threshold and passing to `applyDeadZone`) happens in Story 003.
5. **DEFERRED — HMR live update**: Changing `input.deadZone` via debug overlay and seeing the next tick use the new value requires a full game build with Data & Config Manager + debug overlay wired. This is a cross-system end-to-end behavior, not unit-testable in this story. Tracked as an E2E smoke check item for the Integration/Polish phase.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 003 (PlayerInput)**: Calling `applyDeadZone()` with the configured threshold from Data & Config Manager; integrating formula into the polling loop
- **Story 005 (GSM State)**: No state management — this is a pure function
- HMR live update of threshold via debug overlay — deferred to E2E verification

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Logic story — automated test specs:**

- **AC-1**: returns 0 when `|raw| < threshold`
  - Given: `threshold = 0.15`
  - When: `raw = 0.1`
  - Then: `applyDeadZone(0.1, 0.15) === 0`
  - When: `raw = -0.1`
  - Then: `applyDeadZone(-0.1, 0.15) === 0`
  - Edge cases: `raw = 0.149` (just below) → 0; `raw = 0.15` (boundary, numerator is zero) → 0

- **AC-2**: preserves sign and remaps above threshold
  - Given: `threshold = 0.15`
  - When: `raw = 0.5`
  - Then: `applyDeadZone(0.5, 0.15)` ≈ 0.412
  - When: `raw = -0.5`
  - Then: `applyDeadZone(-0.5, 0.15)` ≈ -0.412
  - Edge cases: `raw = 1.0` → 1.0, `raw = -1.0` → -1.0

- **AC-3**: threshold=0 disables dead zone
  - Given: `threshold = 0`
  - When: `raw = 0.5`
  - Then: `applyDeadZone(0.5, 0) === 0.5`
  - Edge cases: `raw = -0.3` → -0.3, `raw = 0.0` → 0.0

- **AC-4**: threshold=0.5 snaps below ±0.5 to 0; ±1.0 → ±1.0
  - Given: `threshold = 0.5`
  - When: `raw = 0.5` → 0 (boundary), `raw = 0.49` → 0 (below), `raw = 0.6` → 0.2 (above)
  - Then: each case produces the expected value
  - Edge cases: `raw = 1.0` → 1.0 (full range preserved), negative values mirrored

- **AC-5**: steering and throttle/brake ranges use same formula
  - Given: the same function handles both ranges
  - When: tested with inputs across -1..1 (steering) and 0..1 (throttle)
  - Then: same formula applies — no range-specific branches

- **AC-6**: pure function (no side effects)
  - Given: the function is called with identical inputs
  - When: called 1000 times
  - Then: every call returns the identical result
  - Edge cases: concurrent calls produce no state corruption (no mutable state)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:

- Tests: `tests/unit/core/input/dead-zone.test.ts` — must exist and pass
- Full boundary coverage: threshold boundary, input range boundaries, sign preservation, zero threshold

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (uses `InputState.ZERO` for zero-state reference, type interfaces)
- Unlocks: Story 003 (PlayerInput needs dead zone function for polling loop)

---

## Completion Notes

**Completed**: 2026-06-29
**Criteria**: 6/6 passing
**Deviations**: ADVISORY — File naming conventions corrected: deadZone.ts → dead-zone.ts (kebab-case), test moved from tests/unit/input/ to tests/unit/core/input/ (mirror src/ structure). Logged as tech debt.
**Test Evidence**: Logic: test file at `tests/unit/core/input/dead-zone.test.ts` (36 tests, all passing)
**Code Review**: Complete — APPROVED (babylonjs-specialist + qa-tester + lead-programmer all APPROVE/ADEQUATE)
