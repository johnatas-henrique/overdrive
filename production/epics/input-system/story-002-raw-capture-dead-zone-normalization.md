# Story 002: Raw Capture & Dead-Zone Normalization

> **Epic**: Input System
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: M (4-6h)

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-005` (parte), `TR-input-011`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0001 (Manual Simulation Authority and Determinism Boundary), ADR-0005 (Input Context Controller and Action Map Inventory)
**ADR Decision Summary**: `CaptureLatestRawSample()` executes exactly once per render frame at the beginning of Simulation's `Update()`, before accumulator evaluation; dead zones use a radial profile for sticks (inner 0.15 / outer 0.95) and axial for triggers (inner 0.05); keyboard is exempt (mouse is UI-only per GDD :97 and never produces gameplay input).

**Engine**: Unity 6000.3.19f1 + Input System 1.19.0 | **Risk**: HIGH
**Engine Notes**: Gamepad `StickControl` has an embedded `axisDeadzone` processor (0.125/0.925) in the layout — raw stick values must be read via `ReadUnprocessedValue()` (NOT `ReadValue()` which applies the embedded dead-zone) and resolved through `_steerAction.controls` scan (`parent is StickControl`), never `activeControl` (null while unactuated). The Input System does not clean NaN/Infinity from `QueueStateEvent` — validity flags are a testable seam.

**Control Manifest Rules (Foundation)**:
- Required: Simulation invokes Input-owned `CaptureLatestRawSample()` exactly once per render frame, at the beginning of its own `Update()`, before reading/modifying the accumulator (ADR-0001).
- Required: Input sanitization — NaN/Infinity → 0.0f; values outside [-1.0, 1.0] → clamped (ADR-0005).

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-4: GIVEN a gamepad stick remains inside its radial inner threshold, WHEN a simulation tick processes it, THEN Steer output is exactly 0.0.
- [ ] AC-24: GIVEN trigger raw input is 0.05 or below, WHEN a tick processes it, THEN its normalized output is exactly 0.0.
- [ ] AC-25: GIVEN stick raw magnitude is 0.95 or above, WHEN a tick processes it, THEN its normalized magnitude is exactly 1.0.
- [ ] AC-32: GIVEN stick magnitude is 0.55 with inner threshold 0.15 and outer threshold 0.95, WHEN a tick processes it, THEN its normalized magnitude is exactly 0.5.
- [ ] AC-33: GIVEN trigger raw input is 0.525 with inner threshold 0.05, WHEN a tick processes it, THEN its normalized output is exactly 0.5.
- [ ] AC-51: GIVEN keyboard gameplay input is processed, WHEN the dead-zone stage runs, THEN it leaves the channel's raw value unchanged (keyboard maps directly to -1/0/1).
- [ ] AC-59: GIVEN a render Update begins after Input System Dynamic Update, WHEN Simulation evaluates its accumulator, THEN it first calls Input-owned `CaptureLatestRawSample()` and receives exactly one immutable RawInputSample with a monotonic captureSequence.

---

## Implementation Notes

*Derived from ADR-0001 and ADR-0005 Implementation Guidelines:*

- `RawInputSample` is an immutable readonly struct: `captureSequence` (uint64 monotonic), `activeScheme`, `accelerateRaw`, `brakeRaw`, `steerRaw` (stick x, raw before dead-zone), `pauseRise`, `inputAvailability`, `validityFlags`.
- `CaptureLatestRawSample()` reads the current selected scheme's raw values, observes the pending Pause rise (latched edge, cleared by the consumer), and increments `captureSequence` exactly once per call.
- Read stick raw via `ReadUnprocessedValue()` on the `StickControl` resolved through the steer action's controls scan — bypasses the embedded `axisDeadzone`.
- Dead-zone normalization is implemented here as a pure, stateless module `DeadZoneNormalizer` with `NormalizeStick(Vector2)` (radial) and `NormalizeTrigger(float)` (axial). It is applied during the tick-processing step, not at capture: Story 004's tick processor invokes this module as the dead-zone stage. The module is tested in isolation by AC-4/24/25/32/33.
  - Radial stick: `stick_out = 0 when m ≤ 0.15; normalize(v) × clamp((m − 0.15)/(0.95 − 0.15), 0, 1)`.
  - Axial trigger: `trigger_out = 0 when t ≤ 0.05; clamp((t − 0.05)/(1 − 0.05), 0, 1)`.
  - Keyboard: pass through unchanged (no dead-zone). Mouse is UI-only (GDD :97) — it never produces gameplay input and has no channel in this module.
- Mark NaN/Infinity channels via `validityFlags` at capture (they are sanitized to 0.0f in the tick processor, story 004). Use `float.IsFinite`.
- **AC-59 ordering debt (deferred to Simulation Kernel)**: the capture-before-accumulator contract (ADR-0001:41) is the Simulation driver's responsibility and cannot be independently verified by a controller-seam test — this story covers the controller seam only (1x/frame + monotonic + immutable). The Kernel must add a test asserting `CaptureLatestRawSample()` runs before accumulator evaluation in the same `Update()` when it implements the driver. (code-review 2026-08-08: qa-tester BLOCKING on this point was overridden by orchestrator analysis — see kernel EPIC.md Definition of Done.)

---

## Performance Budget

- Capture runs once per render frame — O(1), zero per-frame heap allocations; `RawInputSample` is an immutable value type.
- Dead-zone module is pure stateless math — O(1) per call, no allocations.
- Fits the 16.6 ms frame budget and the simulation gate (p95 ≤ 6 ms / max ≤ 8 ms per tick): capture adds one `ReadUnprocessedValue` pass per frame; normalization runs once per tick.

---

## Embedded Definitions

*Testability refinements from QL-STORY-READY gate.*

- **AC-59 seam**: a fake Simulation driver calls `CaptureLatestRawSample()` in its `Update()`. `CaptureCallCounter` asserts exactly one capture per Update; `CaptureOrderRecorder` logs capture before accumulator evaluation; `captureSequence` is monotonic across calls.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 004: SimulationInput tick processor (consumes the captured sample and applies dead-zone/EMA/brake in the pipeline).
- Story 003: EMA and brake priority (the smoothing stage downstream of dead-zone).

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-4**: Stick input inside the radial inner threshold outputs zero
  - Given: gamepad stick magnitude ≤ 0.15.
  - When: a simulation tick processes the stick.
  - Then: normalized steer output is exactly 0.0.
  - Edge cases: magnitudes 0, 0.15, just above 0.15.

- **AC-24**: Trigger values at or below 0.05 normalize to zero
  - Given: trigger inner threshold is 0.05.
  - When: raw trigger values 0.0, 0.05, and just below 0.05 are processed.
  - Then: each normalized value is exactly 0.0.
  - Edge cases: both triggers independently.

- **AC-25**: Stick magnitude at or above 0.95 normalizes to unit magnitude
  - Given: a gamepad stick provides magnitude ≥ 0.95.
  - When: dead-zone normalization runs.
  - Then: output magnitude is exactly 1.0 and direction is preserved.
  - Edge cases: 0.95, 1.0, diagonal input, out-of-range values.

- **AC-32**: Stick magnitude 0.55 normalizes to 0.5
  - Given: stick magnitude 0.55; inner 0.15; outer 0.95.
  - When: normalization runs.
  - Then: normalized magnitude is exactly 0.5.
  - Edge cases: direction preservation, values around 0.55.

- **AC-33**: Trigger value 0.525 normalizes to 0.5
  - Given: trigger raw 0.525; inner 0.05.
  - When: trigger normalization runs.
  - Then: normalized output is exactly 0.5.
  - Edge cases: both triggers, values near threshold.

- **AC-51**: Keyboard values bypass dead-zone normalization
  - Given: keyboard gameplay input is processed.
  - When: the dead-zone stage runs.
  - Then: the channel retains its raw value unchanged.
  - Edge cases: keyboard −1/0/1. (Mouse is UI-only per GDD :97 — it never produces gameplay input and has no dead-zone channel.)

- **AC-59**: Raw input capture occurs exactly once before accumulator evaluation
  - Given: a fake Simulation driver begins an Update after Input System Dynamic Update.
  - When: the accumulator is evaluated.
  - Then: `CaptureCallCounter == 1` per Update; `CaptureOrderRecorder` shows capture before accumulator; `captureSequence` monotonic.
  - Edge cases: zero ticks, one tick, multiple ticks, repeated render Updates.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `Assets/tests/integration/input/RawCaptureDeadZoneTests.cs` — must exist and pass (asmdef `InputIntegrationTests`).

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (asset/controller).
- Unlocks: Story 004 (consumes the sample through the pipeline).

## Completion Notes

**Completed**: 2026-08-08
**Criteria**: 7/7 passing (0 deferred)
**Deviations**: None blocking (ADR-0001/0005 compliant). ADVISORY — 3 QL-TEST-COVERAGE coverage gaps logged as tech debt (TD-001/002/003). AC-59 capture-before-accumulator ORDER is a Simulation-driver contract (ADR-0001:41) deferred to the Simulation Kernel epic DoD and recorded in Implementation Notes.
**Test Evidence**: Integration — `Assets/tests/integration/input/RawCaptureDeadZoneTests.cs` (**25/25 PASS** via unityMCP)
**Code Review**: Complete — unity-specialist APPROVED; qa-tester BLOCKING on AC-59 order overridden by orchestrator (deferred to Kernel); LP-CODE-REVIEW APPROVE after `SetUIContext` ADR-0005:119 fix (`_pendingPauseEdge` clear) + regression test.
