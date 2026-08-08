# Story 006: SimulationInput Tick Processor

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-006` (SimulationInput contract: accelerateOut, brakeOut, steerOut, rawXxxPostDeadZone, pauseEdge, inputAvailability), `TR-input-012` (Non-finite raw axes become zero and processed axes are clamped to their legal ranges before EMA)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0001: Manual Simulation Authority and Determinism Boundary; ADR-0005: Input Context Controller and Action Map Inventory
**ADR Decision Summary**: ADR-0001: At every simulation tick, Simulation invokes the Input-owned tick processor with the latest immutable RawInputSample; Input applies validation, dead zone, EMA, and brake priority and returns SimulationInput — the sole gameplay-input contract per tick. ADR-0005: Input sanitization replaces NaN/Infinity with 0.0f and clamps out-of-range values before EMA.

**Engine**: Unity 6000.3.19f1 | **Risk**: HIGH
**Engine Notes**: Unity 6.3 post-cutoff; verified APIs per ADR-0001 (`Physics.simulationMode`, `Physics.Simulate(float)`). Input System 1.19.0: `ProcessEventsInDynamicUpdate`. Multi-tick frames process the same sample (once per render frame capture, per-tick processing).

**Control Manifest Rules (this layer)**:
- Required: Input sanitization: NaN/Infinity → 0.0f; values outside [-1.0, 1.0] → clamped (source: ADR-0005)
- Required: Brake priority: when rawBrakePostDeadZone > 0, accelerateOut = 0 and Accelerate EMA is frozen (source: ADR-0005)
- Required: InputAvailability enum {Available, NoInputDevice}: zeroed SimulationInput with NoInputDevice flag when no device connected (source: ADR-0005)
- Guardrail: Simulation tick budget p95 ≤ 6 ms, max ≤ 8 ms (source: ADR-0001)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-22: GIVEN raw input is NaN or infinity, WHEN the tick processor executes at the raw stage, THEN that channel is sanitized to 0.0f before EMA and a rate-limited warning is logged; GIVEN NaN or infinity arises inside the EMA recurrence, THEN the affected channel retains its last valid output and a rate-limited warning is logged.
- [ ] AC-34: GIVEN one render update produces two simulation ticks from the same raw Accelerate value of 1.0 at rest, WHEN both ticks execute, THEN their outputs are 0.3 then 0.51 and any pending Pause edge is consumed only by the first tick.
- [ ] AC-28: GIVEN Pause rises during Racing, WHEN the next tick begins, THEN its edge is consumed exactly once.
- [ ] AC-40: GIVEN a Pause edge is pending when the active scheme changes, WHEN the next SimulationInput is generated, THEN the pending edge flag is false.
- [ ] AC-19: GIVEN rawThrottlePostDeadZone > 0.5 and rawBrakePostDeadZone == 0 occur on at least one tick from GO-12 through GO-1 and still hold on the GO tick, WHEN Grid & Start evaluates Perfect Start, THEN the result is independent of EMA output. (Input scope: expose rawThrottlePostDeadZone and rawBrakePostDeadZone post-dead-zone, pre-EMA.)

## Implementation Notes

*Derived from ADR-0001 Decision, ADR-0005 Decision (Input Sanitization), and GDD Core Rules 5-6 (:111-157):*

- Full SimulationInput contract (input-system.md:136-145): `accelerateOut` (0-1), `brakeOut` (0-1), `steerOut` (-1-1), `rawThrottlePostDeadZone` (0-1), `rawBrakePostDeadZone` (0-1), `rawSteerPostDeadZone` (-1-1), `pauseEdge` (bool), `inputAvailability` (Available/NoInputDevice).
- `rawXxxPostDeadZone` fields are sampled after dead-zone normalization but BEFORE EMA and brake-priority processing. Perfect Start (Grid & Start epic) evaluates raw values, never EMA output — this story only exposes them.
- Pipeline order per tick: validation/sanitization → dead zone (Story 003) → EMA (Story 004) → brake priority (Story 005) → SimulationInput assembly. If one render frame contains multiple ticks, every tick processes the same sample and advances EMA once; Pause is consumed only by the first tick.
- Two-stage non-finite handling (GDD :152 and :243):
  - Raw stage: NaN/Infinity replaced by 0.0f after dead-zone normalization and before EMA, with a rate-limited warning.
  - EMA-internal: NaN/Infinity arising inside the EMA recurrence clamps to the last valid output with a warning.
  - Rate-limit policy: max 1 warning per channel per second (documented implementation detail; the GDD requires "rate-limited").
- `pauseEdge`: only Pause rising edges enter the pending simulation flag while OverdriveGameplay is active. Repeated rises while pending are ignored; the first simulation tick in that render update consumes and clears it. On active scheme change, the pending pauseEdge is cleared (Story 007 arbitration triggers this).
- AC-19 is cross-epic: the Input side exposes the raw post-dead-zone values; the Perfect Start evaluation and its GO-12..GO window belong to the Grid & Start epic. The integration test is cross-epic and marked as a dependency — not a blocker of this story.
- **Review note (story-002 round 7, 2026-08-07):** `pauseRise` is consumable by ANY `CaptureLatestRawSample()` call — a `PauseEdge` subscriber that captures inside its callback marks the edge observed and the driver's sample then reports false. Decide the sole-consumer rule (tick processor only) and document it at implementation.
- **Review note (story-002 round 7):** first-tick consumption must also reset `_observedPausePending` — reuse `ClearPendingPauseEdge()` (lineage: story-002 :51; covers AC-40 scheme-change clearing). Verify in this story's review.
- **Review note (story-002 round 7):** add a pin test locking finite out-of-range values → `validityFlags.None` (GDD:124 "non-finite or invalid"; wording reconciliation from story-002 :56) — or document the gap explicitly.

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 003: Dead-zone stage (feeds this processor)
- Story 004: EMA engine (feeds this processor)
- Story 005: Brake priority (feeds this processor)
- Story 007: Scheme-change pauseEdge clearing (triggered by arbitration)
- Story 008: NoInputDevice availability flag (zeroed input assembly)
- Grid & Start epic: Perfect Start evaluation (consumes the raw post-dead-zone fields)

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-22** (EditMode unit test):
  - Given: The previous output is valid.
  - When: A raw axis is NaN or infinity.
  - Then: At the raw stage, the channel is sanitized to `0.0f` before EMA and a rate-limited warning is logged; when NaN/Infinity arises inside the EMA recurrence, the affected channel retains its last valid output.
  - Edge cases: NaN on one axis; infinity on multiple axes; invalid first sample; repeated invalid samples; warning rate limit (max 1 per channel per second).
- **AC-34** (EditMode accumulator harness):
  - Given: One render Update produces two ticks; raw Accelerate is `1.0` from rest; a Pause edge is pending.
  - When: Both ticks execute.
  - Then: Accelerate outputs are `0.3` then `0.51`; Pause is consumed by tick one only.
  - Edge cases: Three ticks; no pending Pause; Pause arriving between ticks; input sample captured once.
- **AC-28** (EditMode tick test):
  - Given: Racing is active and Pause rises.
  - When: The next tick begins.
  - Then: Pause edge is consumed exactly once.
  - Edge cases: Pause held; Pause rises during accumulator catch-up; Pause while UI is active.
- **AC-40** (EditMode integration test):
  - Given: A Pause edge is pending and the active control scheme changes.
  - When: The next SimulationInput is generated.
  - Then: `pauseEdge` is false.
  - Edge cases: Scheme changes before capture; scheme changes after capture; multiple pending edges.
- **AC-19** (EditMode contract test + Grid & Start integration test — cross-epic):
  - Given: At least one tick from GO-12 through GO-1 and the GO tick has post-dead-zone throttle above `0.5` and brake equal to `0`.
  - When: Perfect Start is evaluated with different EMA outputs.
  - Then: Perfect Start result is identical for all EMA outputs; `SimulationInput` exposes the raw post-dead-zone values.
  - Edge cases: Exactly `0.5`; exactly zero brake; values changing on GO tick; no qualifying tick.
  - Status: Cross-epic integration dependency (Grid & Start epic).

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- `tests/unit/input/tick_processor_test.cs` — must exist and pass
- Cross-epic AC-19: integration coverage with Grid & Start (deferred dependency, not a blocker)

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 003 (dead zone), Story 004 (EMA), Story 005 (brake priority)
- Unlocks: Story 009 (context handoff clears pauseEdge via this processor), Story 013/014 (Settings-driven behavior), Simulation Kernel epic's input boundary
