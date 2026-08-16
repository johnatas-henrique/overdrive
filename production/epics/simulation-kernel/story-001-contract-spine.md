# Story 001: Contract Spine — 14-Step Pipeline Skeleton, Seams & Snapshot Schemas

> **Epic**: Simulation Kernel
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: M (~6-8h — contract surface is the largest; every seam published here gates downstream stories)

## Context

**GDD**: `design/gdd/simulation-architecture.md`
**Requirement**: `TR-sim-003` (14-step tick pipeline: TickStartSnapshot through PublishedSimulationSnapshot), `TR-sim-011` (TickStart, Published, PostFinish, and ReplayInitial snapshots are immutable consumer boundaries)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0001 (Manual Simulation Authority and Determinism Boundary), ADR-0011 (Pit Stop Architecture — PitServiceCommand seam)
**ADR Decision Summary**: ADR-0001 defines the canonical 14-step tick order, immutable snapshot ownership by Simulation, and the exact seam contracts each owning Core epic implements. ADR-0011 defines the `PitServiceCommand[carId]` pit-service contract consumed at Steps 5a/5b.

**Engine**: Unity 6000.3.19f1 | **Risk**: HIGH (Unity 6.3 is post-LLM-cutoff)
**Engine Notes**: Verified APIs per ADR-0001: `Physics.simulationMode`, `Physics.Simulate(float)`, `Rigidbody.interpolation`, `Time.unscaledDeltaTime`. No relative MonoBehaviour script-order assumption is permitted (ADR-0001:41).

**Control Manifest Rules (Foundation + Core layers, v2026-08-05)**:
- Required: 14-step tick pipeline is canonical (capture → input → TickStartSnapshot → Pause/Countdown → Fuel/Tire 5a/5b → forces by ascending carId → one Physics.Simulate → CarState readout → PitStop 9b → RSM events → counters → PostFinishSnapshot → ResolvedFinishOrder → TransitionRequest → PublishedSimulationSnapshot → AI 13 → ResolvedCarInput 14) — source: ADR-0001
- Required: `TickStartSnapshot` carries no `RawInputSample[16]` and no frame `deltaTime`; domain ticks receive `FIXED_DT` explicitly, never `Time.unscaledDeltaTime` — source: ADR-0001
- Required: Multi-tick render frames reuse the single latest raw sample; no per-tick raw sample array — source: ADR-0001
- Required: `PostFinishSnapshot` is the immutable terminal-state snapshot; no PhysX, Fuel, Tire, Pit, collision, or tactical AI runs after finish — source: ADR-0001
- Required: Addressable GROUP NAMES are never runtime load keys (the load key is the asset's ADDRESS) — source: ADR-0003
- Forbidden: No `FixedUpdate()` on the simulation path; no per-tick file IO — source: ADR-0001, ADR-0008
- Guardrail: Simulation tick budget p95 ≤ 6 ms, max ≤ 8 ms (16-car prototype, Steps 1-14) — source: ADR-0001

---

## Acceptance Criteria

*From GDD `design/gdd/simulation-architecture.md`, scoped to this story:*

- [ ] **AC-3.1:** Given several Dynamic Update captures occur before one fixed tick, When the tick builds SimulationInput, Then it uses the latest RawInputSample.
- [ ] **AC-3.2:** Given the same raw sample is used by two fixed ticks in one render frame, When both ticks execute, Then each advances EMA exactly once.
- [ ] **AC-3.3 (Contract reference — Input System AC-7):** Given identical raw input sequences at 30 FPS and 144 FPS, When both runs execute the same 60 fixed ticks, Then Simulation consumes the identical per-tick SimulationInput sequence verified by Input System.
- [ ] **AC-3.4:** Given a Pause rising edge is captured, When the next fixed tick begins, Then the edge is consumed once at that tick boundary.
- [ ] **AC-3.5 (Contract reference — Input System AC-8):** Given a gamepad disconnect is observed while KeyboardMouse remains available, When the next fixed tick builds SimulationInput, Then Simulation consumes KeyboardMouse input without freezing race simulation.
- [ ] **AC-3.6:** Given a `PublishedSimulationSnapshot` is published, When AI, HUD, Camera, or RSM reads it, Then no consumer mutation can change the published value or any domain owner state.
- [ ] **AC-3.7:** Given a fixed tick begins, When player SimulationInput and cached AIInput are combined, Then each car has exactly one ascending-`carId` `ResolvedCarInput` consumed identically by Fuel, Tire, and Vehicle Physics.
- [ ] **AC-3.8:** Given Simulation enters Idle, Loading, Paused, Finished, or Results, When a consumer reads the lifecycle snapshot or direct domain outputs before the next active tick, Then state/presentation metadata reflects the transition and CarState, Fuel, Tire, and RSM values equal their last authoritative tick values.
- [ ] **AC-7.8:** Given Input System reports `NoInputDevice` at a tick boundary, When Simulation builds input, Then it consumes zeroed Accelerate, Brake, and Steer plus `inputAvailability = NoInputDevice` until an available scheme returns.
- [ ] **AC-7.9:** Given the active input scheme changes during Racing, When the next capture occurs, Then the next SimulationInput uses the new active scheme without interrupting the tick loop.

---

## Implementation Notes

*Derived from ADR-0001 Implementation Guidelines:*

- Publish the 14-step pipeline skeleton as an ordered invocation spine. Steps are seams (interfaces + data shapes), NOT implementations: Step 2 (tick processor invocation — `ResolvedCarInput[]`), Steps 5a/5b (Fuel/Tire — `TickStartSnapshot` + `PitServiceCommand[carId]`), Step 6 (Vehicle Physics — `ResolvedCarInput[carId]` + `FIXED_DT`; `CarState[carId]` readout), Step 9b (Pit Stop — `CarState[].PitPhase` + pit geometry), Step 10 (RSM — `FinishDetected`/`TransitionRequest`/`ResolvedFinishOrder`), Step 13 (AI — `PublishedSimulationSnapshot` read-only). Integration Contract table in EPIC.md:18-24 is authoritative; owning Core epics deliver implementations.
- Define the four immutable snapshot schemas: `TickStartSnapshot` (Step 1, prior Published values + cached AIInput), `PublishedSimulationSnapshot` (Step 12 / lifecycle transitions), `PostFinishSnapshot` (Step 11, before FinishOrderResolver), `ReplayInitialState` (GO boundary, before first Racing tick). Simulation is the only assembler and owner; no consumer mutates a snapshot or pushes fields into one.
- Publish the Kernel-internal seams that gate testability of downstream stories: `SimulationState` enum + state gate interface (driver tests use a faithful stub), pre-accumulator lifecycle boundary hook (invoked in the driver's Update), `IPhysicsSimulator` (injectable `Physics.Simulate` — enables retry tests), and lifecycle state-change events (consumed by the recordable buffer discard).
- The tick processor invocation (Step 2) receives the single latest immutable `RawInputSample` per render frame — never an array, never a frame `deltaTime`. Domain `Tick()` calls receive `FIXED_DT` as an explicit argument.
- `ResolvedCarInput[]` must be strictly ascending by `carId`, consumed identically by Fuel, Tire, and Vehicle Physics in the same tick.
- Multi-tick render frames reuse the single latest raw sample; each tick advances EMA exactly once. No per-tick raw sample array, no second-missing-tick undefined behavior.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- [Story 002]: accumulator loop, `Physics.Simulate` call sequencing, counters, capture-before-accumulator (the driver consumes the spine)
- [Story 003]: content lifecycle transitions, countdown timer, GO (consumes the state gate + content seams)
- [Story 004]: pause/resume/focus handler wiring into the pre-accumulator boundary hook
- [Story 008]: recordable buffer discard consuming the lifecycle state-change events
- Core epics (Fuel, Tire, VP, Pit, RSM, AI): step implementations per Integration Contract — NOT this epic's stories

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-3.1**: latest RawInputSample used by tick
  - Given: Input mock captures samples A, B, C before the tick; C is latest
  - When: Simulation executes the fixed tick
  - Then: tick processor called with C; resulting SimulationInput reflects C, not A or B
  - Edge cases: no captures before tick reuses latest valid sample; capture after tick processing deferred to next tick

- **AC-3.2**: same sample, two ticks, EMA once per tick
  - Given: one immutable RawInputSample; accumulator produces two fixed ticks
  - When: both ticks process the same sample
  - Then: input processing invoked twice; EMA update spy reports exactly two advances; second tick consumes first tick's EMA output
  - Edge cases: one tick → one advance; zero ticks → zero advances; sample not mutated/re-filtered between ticks

- **AC-3.3**: identical SimulationInput at 30/144 FPS (contract ref Input AC-7)
  - Given: two isolated drivers receive same ordered raw sequence, 60 fixed ticks each, one at 30 FPS one at 144 FPS
  - When: consumption spy records inputs per tick
  - Then: the two 60-item sequences are identical (accelerate, brake, steer, availability/edge fields)
  - Edge cases: multi-tick frames reuse latest sample; frames with no new sample don't alter sequence; float comparisons use contract tolerance

- **AC-3.4**: Pause rising edge consumed once at tick boundary
  - Given: input queues exactly one Pause rising edge before a Racing tick
  - When: next fixed tick begins and input-consumption seam invoked
  - Then: edge consumed once; Simulation transitions to Paused; repeated reads/ticks do not re-consume
  - Edge cases: held Pause produces no additional consumption; edge captured after boundary consumed next tick; Countdown Pause consumed but not recorded as Racing event

- **AC-3.5**: gamepad disconnect → KeyboardMouse no freeze (contract ref Input AC-8)
  - Given: active gamepad disconnects before next tick; KeyboardMouse available with valid sample
  - When: next tick processed
  - Then: input seam receives KeyboardMouse values; tick completes; physics spy confirms no freeze/skip
  - Edge cases: both devices disconnect → NoInputDevice zeroed; reconnection uses new scheme next capture; no stale gamepad values

- **AC-3.6**: PublishedSimulationSnapshot immutable
  - Given: snapshot with nested car/fuel/tire/pit/RSM values delivered to consumer spies
  - When: each consumer attempts mutation of snapshot and nested collections
  - Then: mutation rejected or no effect; original snapshot unchanged; domain-owner outputs unchanged
  - Edge cases: scalar, nested object, array, and ordering mutation blocked; retained consumer reference cannot affect later snapshots

- **AC-3.7**: ascending-carId ResolvedCarInput consumed identically
  - Given: player and AI inputs for multiple non-sequential car IDs with distinct values
  - When: Simulation resolves and dispatches tick inputs
  - Then: resolved array strictly ascending by carId; Fuel, Tire, VP each receive same value set per car exactly once
  - Edge cases: missing AI input uses defined fallback; duplicate/missing car IDs fail validation; zero and max car IDs preserve ordering

- **AC-3.8**: lifecycle snapshot preserves last authoritative values
  - Given: prior active tick publishes known CarState/Fuel/Tire/RSM values
  - When: Simulation enters each non-ticking lifecycle state (Idle/Loading/Paused/Finished/Results) and consumers read seams
  - Then: metadata reflects new state; domain values identical to prior authoritative values; no simulation/domain tick
  - Edge cases: repeated reads publish no periodic changes; transitions right after a tick preserve that tick's values; Paused includes correct resumeState

- **AC-7.8**: NoInputDevice → zeroed input
  - Given: Input reports NoInputDevice; no valid device-specific sample
  - When: input-consumption seam invoked for one or more ticks
  - Then: every consumed SimulationInput has zero Accelerate/Brake/Steer and inputAvailability = NoInputDevice; tick loop continues
  - Edge cases: repeated NoInputDevice ticks remain zeroed; reconnect switches scheme on next capture; stale prior-device values never reused

- **AC-7.9**: scheme change during Racing → next SimulationInput uses new scheme
  - Given: Racing active, KeyboardMouse current, active scheme changes to Gamepad between ticks with valid Gamepad input
  - When: next raw capture and fixed tick performed
  - Then: next SimulationInput from Gamepad values; tick/Physics.Simulate sequence uninterrupted; no old-scheme values consumed
  - Edge cases: scheme change between multiple ticks uses new scheme next tick; pending Pause edge cleared; EMA initialized from new scheme's post-dead-zone values, no carry-over

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `Assets/tests/integration/simulation/ContractSpineTests.cs` — must exist and pass. Verifies: step ordering with mock steps, snapshot immutability, ascending-carId resolution, input consumption contracts (latest sample, EMA-once, pause edge, NoInputDevice, scheme change).

**Status**: ✅ Created and passing — `ContractSpineTests.cs` (12 tests, 173/173 PlayMode green)

---

## Dependencies

- Depends on: Input System epic (DONE — contracts AC-7/AC-8 delivered; `CaptureLatestRawSample` seam available)
- Unlocks: Story 002 (Driver consumes the spine), Story 003 (state gate + content seams), Story 004 (boundary hook), Story 008 (lifecycle events)

## Completion Notes

**Completed**: 2026-08-11
**Criteria**: 10/10 passing (AC-3.1..3.8, AC-7.8, AC-7.9) — all auto-verified via `ContractSpineTests.cs` (12 tests, 173/173 PlayMode green)
**Deviations**:
- ADVISORY — ADR-0011 DRIFT: `PitServiceCommand` carries 2 fields (CarId, Requested) vs ADR's 4-field contract (`active`, `targetFuel`, `tireSwapRequired`, `requestExit`). Additive expansion in Story 009 (Pit Stop). Logged as tech debt TD-011.
- ADVISORY — PostFinishSnapshot subset: ADR-0001 additional terminal fields (`simulationStepCount`, `activeRaceStepCount`, `resultClassification`, `resultKind`, `raceTime`, `lapTimes`, `raceMode`) deferred to Story 008 (Determinism & Replay). Additive expansion. Logged as tech debt TD-012.
- ADVISORY — QL-TEST-COVERAGE GAPS: duplicate car ID rejection test, AI/CarId mismatch test, capture-after-tick deferred test recommended in follow-up. Logged as tech debt TD-013.
**Test Evidence**: `Assets/tests/integration/simulation/ContractSpineTests.cs` — 12 tests (10 ACs + spine ordering + dispatch), 173/173 PlayMode green
**Code Review**: Complete — unity-specialist APPROVED (ADR-0001 COMPLIANT, SOLID COMPLIANT, assembly CLEAN); qa-tester TESTABLE after 7 convergence rounds (NoInputDevice zeroing gap fixed in TickProcessor); lead-programmer LP-CODE-REVIEW APPROVED; qa-lead QL-TEST-COVERAGE GAPS (ADVISORY)
**QA Coverage**: 10/10 ACs COVERED — 0% UNTESTED
