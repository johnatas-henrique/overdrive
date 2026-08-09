# Story 004: SimulationInput Tick Processor

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: M (4-6h)

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-006`, `TR-input-012` (parte)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0001 (Manual Simulation Authority and Determinism Boundary), ADR-0005 (Input Context Controller and Action Map Inventory)
**ADR Decision Summary**: Simulation invokes the Input-owned tick processor once per 60 Hz tick with the latest immutable RawInputSample; Input applies validation, dead-zone, EMA, and brake priority and returns the authoritative `SimulationInput`; `SimulationInput` is the sole gameplay-input contract per tick; Pause is consumed by only the first tick in a render frame.

**Engine**: Unity 6000.3.19f1 + Input System 1.19.0 | **Risk**: HIGH
**Engine Notes**: Determinism — the recurrence sequence must produce bitwise-identical results regardless of render rate (30 FPS vs 144 FPS) for identical raw sequences. SimulationInput is a pure C# struct (12-byte: accelerateOut, brakeOut, steerOut).

**Control Manifest Rules (Foundation)**:
- Required: Simulation invokes the Input tick processor once per 60 Hz tick with the latest RawInputSample (ADR-0001).
- Required: Input sanitization — NaN/Infinity → 0.0f; values outside [-1.0, 1.0] → clamped (ADR-0005).
- Required: `SimulationInput` is the sole gameplay-input contract per tick; nothing downstream consumes raw values (ADR-0005).

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-7: GIVEN identical raw input sequences at 30 FPS and 144 FPS, WHEN each sequence advances through the same 60 simulation ticks, THEN both runs produce identical SimulationInput values per tick.
- [ ] AC-22: GIVEN raw input is NaN or infinity, WHEN the tick processor executes, THEN the last valid output is retained and a warning is logged.
- [ ] AC-28: GIVEN Pause rises during Racing, WHEN the next tick begins, THEN its edge is consumed exactly once.
- [ ] AC-34: GIVEN one render update produces two simulation ticks from the same raw Accelerate value of 1.0 at rest, WHEN both ticks execute, THEN their outputs are 0.3 then 0.51 and any pending Pause edge is consumed only by the first tick.

---

## Implementation Notes

*Derived from ADR-0001 and ADR-0005 Implementation Guidelines:*

- `SimulationInput` struct fields: `accelerateOut` (0-1), `brakeOut` (0-1), `steerOut` (-1..1), `rawThrottlePostDeadZone`, `rawBrakePostDeadZone`, `rawSteerPostDeadZone`, `pauseEdge` (bool, one-shot), `inputAvailability` (Available/NoInputDevice).
- The tick processor runs the canonical order once per 60 Hz tick: validation → dead-zone (story 002) → sanitization + clamp → EMA (story 003) → brake priority → assemble `SimulationInput`.
- If one render frame contains multiple simulation ticks, every tick processes the same RawInputSample and advances EMA once; Pause is consumed only by the first tick.
- AC-22: raw NaN/Infinity channels are sanitized to 0.0f (before EMA); a rate-limited warning is logged (1 per channel per 60-tick window, identically for NaN and positive/negative Infinity). (EMA-internal NaN → last valid output is the story 003 Edge Case; this AC covers raw-input validation at the tick.)
- `pauseEdge` is a latched one-shot: true on the consuming tick, false on every subsequent tick without a new rise.

---

## Embedded Definitions

*Testability refinements from QL-STORY-READY gate.*

- **AC-7 equality**: assert bitwise-identical `SimulationInput` (float bit equality) across 30 FPS and 144 FPS render schedules injected via a fake driver. Render schedules inject tick/zero-tick/multi-tick frames deterministically.
- **AC-28/34 fixture**: a known pending-pause fixture (exactly 1 rise pending); per-tick `SimulationInput` observation point — tick1 `pauseEdge == true`, tick2+ `== false`.
- **AC-22**: `InvalidInputWarning` named event (channel id + offending value) via injectable logger; rate-limit = 1 warning per channel per 60-tick window while the invalid value persists, identically for NaN and both Infinity variants.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 002: dead-zone normalization (called by this pipeline).
- Story 003: EMA and brake priority (called by this pipeline).
- Story 006: context handoff (the pipeline consumes the sample; transitions are owned there).

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-7**: Render-rate-independent 60-tick input processing
  - Given: identical raw input sequences and initial state in two deterministic harnesses (30 FPS and 144 FPS).
  - When: each advances through 60 simulation ticks.
  - Then: corresponding `SimulationInput` values are bitwise-identical.
  - Edge cases: multi-tick render frames, zero-tick frames, pause edges, device changes.

- **AC-22**: Invalid raw input retains last valid output and logs a warning
  - Given: a channel with a known last valid filtered output.
  - When: NaN or Infinity is supplied to the tick processor.
  - Then: output retains the last valid value; `InvalidInputWarning` logged (channel id + value); 1 warning per channel per 60-tick window.
  - Edge cases: NaN, positive/negative Infinity, repeated invalid values, rate-limit window boundary.

- **AC-28**: Pause edge is consumed exactly once
  - Given: Racing active; one Pause rising edge pending.
  - When: the next tick begins, subsequent ticks without another rise.
  - Then: tick1 `pauseEdge == true`; every later tick `== false`.
  - Edge cases: repeated Pause presses before the tick, held Pause after consumption.

- **AC-34**: Multiple ticks reuse one raw sample and consume Pause once
  - Given: one render update supplies raw Accelerate 1.0 from rest and one pending Pause edge.
  - When: two simulation ticks execute from that render update.
  - Then: Accelerate outputs 0.3 then 0.51; Pause true only on the first tick.
  - Edge cases: three or more ticks, no pending Pause.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `Assets/tests/integration/input/TickProcessorTests.cs` — must exist and pass (asmdef `InputIntegrationTests`).

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002 (capture/dead-zone), Story 003 (EMA/brake).
- Unlocks: Story 005, Story 006 (consume the produced `SimulationInput` and sample).
