# Story 001: AI Controller Framework & Input Buffer

> **Epic**: AI Driver
> **Status**: Ready
> **Layer**: Core B
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/ai-driver.md`
**Requirement**: `TR-AI-001`, `TR-AI-002`, `TR-AI-004`

- TR-AI-001: Per-car AIFollower with spline position, target following, speed decision, and overtaking FSM.
- TR-AI-002: AI produces InputState (same interface as player Input) — Physics never branches on player vs AI.
- TR-AI-004: 1-tick delay between AI computation (pipeline slot #3) and Physics consumption (slot #2) via double-buffered input buffer.

**ADR Governing Implementation**: ADR-0013: AI Driver Architecture
**ADR Decision Summary**: AI runs in pipeline slot #3, produces InputState via double-buffered `Map<string, InputState>`. Physics reads from buffer in slot #2 with 1-tick delay. IAIDriver uses push model (called by pipeline).

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript — zero engine imports. Testable with vitest alone.

**Control Manifest Rules (this layer)**:

- Required: C41 (deterministic via SeededRandom), C44 (7 controllers at PreRace, ticking during Racing)
- Required: C16 (AI produces InputState — same contract, not IInput interface)
- Forbidden: C-F6 (never branch Physics on player vs AI input)

---

## Acceptance Criteria

_From GDD `design/gdd/ai-driver.md`, scoped to this story:_

- [ ] `IAIDriver` interface defined with `init()`, `registerCar()`, `tick()`, `getInputBuffer()`, `dispose()` — push model (called by pipeline, not pull)
- [ ] `AIController` interface with `carId`, `params`, `state`, `progress`, `targetOffset`, `rng`, `computeInputs()`
- [ ] `AIDriverParams` open set with all 7 MVP parameters: speedMult, brakingAggression, gripMargin, throttleRampRate, passingAggression, mistakeChance, offsetPreference — extensible per Pillar 4
- [ ] InputState from AI matches player contract: steer (-1..1), throttle (0..1), brake (0..1), gearDelta (-1/0/+1)
- [ ] Double-buffer swap: AI writes to write buffer in slot #3; Physics reads from read buffer in slot #2
- [ ] 1-tick delay: AI compute at tick N is consumed by Physics at tick N+1 (not same tick)
- [ ] 7 controllers created at init (`registerCar` × 7), ticking during Racing GSM state, silent during Menu/PreRace

---

## Implementation Notes

_Derived from ADR-0013 Implementation Guidelines:_

1. **IAIDriver push model**: `tick(dt)` called by pipeline, not `getState(carId)` pull. The pipeline coordinator calls `tick()`, then reads the output buffer.

2. **Double-buffer mechanism**: Two `Map<string, InputState>` buffers. AI writes to writeBuffer (index 1). Physics reads from readBuffer (index 0). After AI slot #3 completes, the pipeline coordinator swaps buffers for next tick.

3. **InputState is a plain interface**, not a class. Same shape as the player Input contract. No IInput implementation — just structural typing.

4. **AIDriverParams is an OPEN set**. MVP defines 7 parameters. Alpha may add: pressureTolerance, defensiveTendency, mistakePattern, contactTolerance. The `ai.teams.*` config namespace supports extension without breaking MVP data contracts.

5. **Each controller gets its own SeededRandom** (seeded from raceSeed + carIndex). This isolates RNG streams per car.

6. **7 controllers**: one per AI car (player car has no AI controller). Register order determines carIndex for seeding.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 002: Spline following (PID steer + lateral offset)
- Story 003: Speed target calculation + throttle/brake control
- Story 004: Team performance model + difficulty scaling
- Story 005: Overtaking state machine

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1**: IAIDriver interface defines all required methods
  - Given: A TypeScript project with IAIDriver imported
  - When: The type is checked
  - Then: All 5 methods (init, registerCar, tick, getInputBuffer, dispose) are present with correct signatures
  - Edge cases: N/A — structural type check

- **AC-2**: AIController interface defines all required fields
  - Given: An AIController implementation
  - When: A concrete instance is created with mock values
  - Then: Instance has .carId (string), .params (AIDriverParams), .state (AIDriverState enum), .progress (number 0-1), .targetOffset (number), .rng (SeededRandom or compatible), .computeInputs (function)
  - Edge cases: N/A — field presence test

- **AC-3**: InputState produced by AI matches player contract
  - Given: A mock AIController producing known values
  - When: computeInputs() is called and converted to InputState
  - Then: steer ∈ [-1, 1], throttle ∈ [0, 1], brake ∈ [0, 1], gearDelta ∈ {-1, 0, 1}
  - Edge cases: steer exactly -1 and 1, throttle exactly 0 and 1

- **AC-4**: Double-buffer writes to write slot, reads from read slot
  - Given: A mock double-buffer with observable write/read indices
  - When: AI writes input via tick()
  - Then: Data is written to writeBuffer; subsequent readBuffer is previous tick's writeBuffer
  - Edge cases: After swap, write target toggles correctly on each tick

- **AC-5**: 1-tick delay between AI compute and Physics consumption
  - Given: AI computes input value X at tick N
  - When: Physics reads input at tick N (before AI writes) and tick N+1 (after AI writes)
  - Then: Input value X is NOT available at tick N, IS available at tick N+1
  - Edge cases: Tick 0 (initial buffer state — empty or zeroed map)

- **AC-6**: 7 controllers created at init, tick during Racing only
  - Given: IAIDriver.init() with 7 cars, GSM in Racing state
  - When: tick() is invoked during Racing, then during Menu
  - Then: 7 controllers produce output during Racing; 0 output during Menu
  - Edge cases: Transition Racing→Menu mid-tick (controllers stop cleanly)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/ai/controller_framework.test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Foundation layer (SeededRandom, Event Bus, GSM subscriptions via Event Bus)
- Unlocks: Story 002, Story 003, Story 004, Story 005, Story 006, Story 007, Story 008, Story 009
