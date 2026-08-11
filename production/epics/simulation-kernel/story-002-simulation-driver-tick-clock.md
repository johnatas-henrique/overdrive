# Story 002: Simulation Driver & Tick Clock

> **Epic**: Simulation Kernel
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: M (~4-6h — one Update() loop; 12 mechanical accumulator/counter scenarios)

## Context

**GDD**: `design/gdd/simulation-architecture.md`
**Requirement**: `TR-sim-001` (Fixed 60 Hz timestep via manual accumulator in Update(), not FixedUpdate), `TR-sim-002` (Physics.simulationMode = SimulationMode.Script; one Physics.Simulate(FIXED_DT) per tick), `TR-sim-010` (Accumulator backlog clamped to 2 × FIXED_DT; discarded time never caught up), `TR-sim-012` (simulationStepCount, activeRaceStepCount, and race-time progression have explicit Countdown, Racing, Pause, and finish behavior)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0001 (Manual Simulation Authority and Determinism Boundary)
**ADR Decision Summary**: The driver owns the manual accumulator in `Update()`, calls `Physics.Simulate(FIXED_DT)` exactly once per accumulated step with `SimulationMode.Script`, invokes Input-owned `CaptureLatestRawSample()` exactly once before accumulator evaluation in the same call path (no script-order assumption), clamps to `2 × FIXED_DT`, and owns the `simulationStepCount`/`activeRaceStepCount` counters and `sim_time` progression.

**Engine**: Unity 6000.3.19f1 | **Risk**: HIGH (Unity 6.3 is post-LLM-cutoff)
**Engine Notes**: Verified APIs: `Physics.simulationMode`, `Physics.Simulate(float)`, `Time.unscaledDeltaTime`. The driver tests use a state gate stub (the `SimulationState` gate interface published by Story 001) and an injectable `IPhysicsSimulator` — no real physics scene required.

**Control Manifest Rules (Foundation + Core layers, v2026-08-05)**:
- Required: `Physics.simulationMode = SimulationMode.Script`; one whole-scene `Physics.Simulate(1/60f)` per active tick; no `FixedUpdate()` on the simulation path — source: ADR-0001
- Required: Simulation invokes Input-owned `CaptureLatestRawSample()` exactly once per render frame, at the beginning of its own `Update()`, before reading/modifying the accumulator; no relative MonoBehaviour script-order assumption — source: ADR-0001
- Required: Multi-tick render frames reuse the single latest raw sample; no per-tick raw sample array — source: ADR-0001
- Forbidden: No simulation code in `FixedUpdate()`; no automatic physics simulation; no `Time.deltaTime`/`Time.fixedDeltaTime`/`Time.inFixedTimeStep` for gameplay timing on the sim path — source: ADR-0001
- Guardrail: Simulation tick budget p95 ≤ 6 ms, max ≤ 8 ms (16-car prototype, Steps 1-14) — source: ADR-0001

---

## Acceptance Criteria

*From GDD `design/gdd/simulation-architecture.md`, scoped to this story:*

- [ ] **AC-1.1:** Given the game is in the Racing state and the frame rate is above 60 FPS, When 10 seconds of wall-clock time elapse, Then exactly 600 simulation steps have been executed (±0 steps).
- [ ] **AC-1.2:** Given Racing receives exactly 30.0 FPS frame durations of `2 × FIXED_DT`, When 10 seconds of wall-clock time elapse, Then exactly 600 simulation steps execute and no time is discarded; only frames exceeding `2 × FIXED_DT` fall under AC-1.6.
- [ ] **AC-1.3:** Given a frame takes 18ms (at 60Hz fixed timestep of ~16.67ms), When the frame completes, Then the accumulator holds approximately 1.33ms of leftover time for the next frame (0.018 − FIXED_DT ≈ 0.001333s, tolerance ±1e-6).
- [ ] **AC-1.4:** Given the accumulator has accumulated ≥ FIXED_DT, When the simulation loop runs, Then Physics.Simulate(FIXED_DT) is called once per accumulated step, and no call to Unity's automatic Physics simulation occurs.
- [ ] **AC-1.5:** Given a frame exceeds `2 × FIXED_DT` due to system load, When the simulation loop processes the frame, Then the accumulator is clamped to `2 × FIXED_DT`, and at most 2 simulation steps execute in that frame.
- [ ] **AC-1.6:** Given the accumulator exceeds 2× FIXED_DT after a long frame, When it is clamped, Then time above the clamp is permanently discarded and the next normal frame resumes ordinary fixed-step processing without catch-up.
- [ ] **AC-1.8:** Given a Racing snapshot publishes after N Racing physics ticks, When its counters are read, Then `sim_time = activeRaceStepCount × FIXED_DT` within ±1e-6.
- [ ] **AC-1.9:** Given Countdown is active, When any snapshot publishes, Then `sim_time = 0.0` regardless of `simulationStepCount`.
- [ ] **AC-3.1a:** Given a Simulation-driver Update begins, When the accumulator is evaluated, Then Input-owned `CaptureLatestRawSample()` has already executed exactly once in that same call path and no MonoBehaviour script-order assumption is required.
- [ ] **AC-7.2:** Given one render frame contains multiple simulation ticks and no newer Dynamic Update sample, When Simulation resolves each tick, Then every tick processes the latest valid RawInputSample and advances EMA once.
- [ ] **AC-7.4:** Given the game is Paused for 30 seconds, When the player resumes, Then the accumulator retains its pre-pause remainder, adds no paused elapsed time, and runs no catch-up steps.
- [ ] **AC-7.5:** Given a 200ms frame spike, When the accumulator is clamped to `2 × FIXED_DT`, Then exactly two simulation steps execute and no catch-up executes in later frames.

---

## Implementation Notes

*Derived from ADR-0001 Implementation Guidelines:*

- The driver is ONE `Update()`: (1) consume focus-change notifications (before reading `Time.unscaledDeltaTime`; the focus-change frame adds no delta — boundary hook published by Story 001), (2) invoke `CaptureLatestRawSample()` exactly once, (3) read the frame delta via an injectable clock seam (`IFrameDeltaSource` — production wraps `Time.unscaledDeltaTime`; tests inject deterministic deltas), (4) accumulate, (5) clamp to `2 × FIXED_DT`, (6) while accumulator ≥ `FIXED_DT`: run the 14-step pipeline (Story 001 spine) and subtract `FIXED_DT`.
- Call `Physics.Simulate(FIXED_DT)` exactly once per accumulated step via the injectable `IPhysicsSimulator` seam (never the raw static call in tests; production uses the Unity-backed implementation). `Physics.simulationMode = SimulationMode.Script` — automatic physics is prohibited.
- `simulationStepCount` increments for every completed physics tick, including Countdown. `activeRaceStepCount` increments after every physics tick that started in Racing, including the finish-detecting tick. `sim_time = activeRaceStepCount × FIXED_DT`. The GO tick (Story 003) publishes the first Racing snapshot with `activeRaceStepCount = 0`.
- **PublishedSnapshot counters (additive expansion of Story 001)**: the driver publishes the counters on `PublishedSimulationSnapshot` (GDD simulation-architecture.md:101 requires `simulationStepCount`, `activeRaceStepCount`, `sim_time`; Story 001 delivered the snapshot with only the `PostFinishSnapshot terminal`). This story adds the three fields to the publishable snapshot — additive constructor (new parameters with defaults), does not break existing Story 001 consumers. `TickStartSnapshot` (Step 1) already carries the counters from the prior published snapshot.
- While Paused (state gate reports Paused), do not add elapsed time and preserve the existing sub-tick remainder for Resume. Resume never executes catch-up steps.
- Multi-tick frames reuse the single latest raw sample; each tick's Step 2 invocation advances EMA exactly once. There is no per-tick raw sample array.
- No `FixedUpdate()` anywhere on the simulation path — Unity invokes it independently of the manual accumulator even under `SimulationMode.Script`; it must not mutate any gameplay state.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- [Story 001]: pipeline skeleton, seam contracts, snapshot schemas (the driver CONSUMES the spine)
- [Story 003]: state transitions into/out of Countdown/Racing, countdown timer, GO, retry reset semantics (the driver exposes the exception seam; Story 003 verifies AC-7.10's full reload sequence)
- [Story 004]: pause/focus handler logic (the driver invokes the pre-accumulator boundary hook; Story 004 wires focus handling into it)
- Focus-loss boundary behavior (AC-7.1/7.1a/7.1b) — Story 004
- Countdown state semantics (AC-4.2-4.4b), content lifecycle (AC-4.0-4.1d) — Story 003

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-1.1**: 600 steps in 10s at >60 FPS
  - Given: state gate stub reports Racing; injectable clock emits 1/120s frames for 1200 frames
  - When: driver processes all frames
  - Then: `IPhysicsSimulator.Simulate(FIXED_DT)` called exactly 600 times
  - Edge cases: final accumulator remainder below FIXED_DT must not produce an extra step; zero-duration frames produce no steps

- **AC-1.2**: 30 FPS, 2×FIXED_DT frames, no discard
  - Given: state gate stub Racing; clock emits exactly 2×FIXED_DT for 300 frames
  - When: driver processes all frames
  - Then: exactly 600 physics steps; accumulator never exceeds clamp; no elapsed time discarded
  - Edge cases: duration exactly 2×FIXED_DT not treated as excess; float tolerance must not remove a step

- **AC-1.3**: 18ms frame → ~1.33ms remainder
  - Given: state gate stub Racing; accumulator starts at zero; clock emits 0.018s
  - When: one driver update completes
  - Then: one step executes; accumulator = 0.018 − FIXED_DT ≈ 0.001333s
  - Edge cases: remainder non-negative and strictly < FIXED_DT; duration exactly FIXED_DT leaves zero remainder

- **AC-1.4**: Physics.Simulate once per step, no auto physics
  - Given: state gate stub Racing; clock provides enough for three fixed steps; simulator records calls; physics mode configurable
  - When: driver processes the frame
  - Then: simulator receives exactly three calls each with FIXED_DT; mode is Script
  - Edge cases: duration below FIXED_DT → zero calls
  - **Deferred (engine gate)**: absence of Unity automatic physics is an engine config check (`Physics.simulationMode = SimulationMode.Script`) verified at the assembly integration gate, not via the injectable simulator mock. Exception-freezing edge deferred to Story 003 (AC-7.10 retry semantics).

- **AC-1.5**: clamp 2×FIXED_DT, max 2 steps
  - Given: state gate stub Racing; accumulator zero; clock emits 2×FIXED_DT + 1ms
  - When: one driver update completes
  - Then: exactly two physics steps; never more than two regardless of excess
  - Edge cases: exactly 2×FIXED_DT → two steps; just above → two steps

- **AC-1.6**: clamp discards excess permanently
  - Given: state gate stub Racing; clock emits 1.0s then FIXED_DT
  - When: driver processes both frames
  - Then: spike frame executes two steps; following frame executes one step; no catch-up from discarded excess
  - Edge cases: repeated spikes discard independently; frame exactly at clamp boundary discards nothing

- **AC-1.8**: sim_time = activeRaceStepCount × FIXED_DT ±1e-6
  - Given: state gate stub starts Racing; driver executes known N (0, 1, 600) completed Racing ticks
  - When: each published snapshot inspected
  - Then: activeRaceStepCount equals number of ticks that started in Racing; sim_time matches product within 1e-6
  - Edge cases: Countdown ticks do not increment activeRaceStepCount; finish-detecting Racing tick increments before publication

- **AC-1.9**: Countdown → sim_time = 0.0
  - Given: state gate stub reports Countdown (fresh-race precondition: driver initialized with `accumulator = 0`, `simulationStepCount = 0`, `activeRaceStepCount = 0`, `sim_time = 0` per GDD:168 Loading→Countdown); simulationStepCount set to zero, one, and a large value
  - When: driver executes Countdown ticks; every published snapshot inspected
  - Then: every Countdown snapshot reports sim_time == 0.0 and activeRaceStepCount == 0 (corollary of GDD:54 — activeRaceStepCount only increments for ticks that started in Racing)
  - Edge cases: 300th Countdown/GO tick still publishes sim_time = 0.0; first subsequent Racing tick advances race time only after it starts

- **AC-3.1a**: CaptureLatestRawSample exactly once before accumulator
  - Given: input mock records invocation count and event order; clock provides zero, one, or multiple ticks
  - When: driver executes one Update
  - Then: CaptureLatestRawSample called exactly once before any accumulator read/modification and before tick input processing
  - Edge cases: multiple ticks still one capture; frame with no tick still captures once; re-entrant/duplicate capture fails the test

- **AC-7.2**: multi-tick frame, same sample, EMA once per tick
  - Given: input mock returns one identifiable sample; clock emits 2×FIXED_DT; EMA state observable
  - When: driver processes the frame
  - Then: two ticks consume identical sample; EMA advances exactly once per tick (two advances total)
  - Edge cases: frame producing three ticks capped at two; newer sample eligible only on next driver Update

- **AC-7.4**: pause 30s preserves remainder, no catch-up
  - Given: state gate stub Racing with pre-pause remainder seeded at 0.25×FIXED_DT (seed via driver test API: drive one partial frame, then switch gate stub to Paused); clock emits 30s while Paused
  - When: driver processes paused frames, then receives explicit Resume (gate stub returns to Racing)
  - Then: no physics calls during pause; remainder unchanged; Resume does not catch up; only subsequent active elapsed time completes next step
  - Edge cases: Resume with zero remainder executes no step; focus return without explicit Resume leaves state Paused

- **AC-7.5**: 200ms spike → exactly 2 steps, no catch-up
  - Given: state gate stub Racing; accumulator zero; clock emits 0.200s then a normal FIXED_DT frame
  - When: driver processes both frames
  - Then: spike frame executes exactly two steps; excess discarded; following frame executes exactly one step, not the backlog
  - Edge cases: simulator never receives more than two calls for the spike; subsequent zero-duration frame executes no step

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `Assets/tests/unit/simulation/SimulationDriverTests.cs` — must exist and pass. Verifies: accumulator math (1.1-1.6), counter/sim_time relationships (1.8, 1.9), capture-before-accumulator ordering (3.1a), multi-tick EMA (7.2), pause/spike remainder preservation (7.4, 7.5).

**Status**: [x] Current — 23 tests in `Assets/tests/unit/simulation/SimulationDriverTests.cs`, full PlayMode suite green **196/196** (161 Input + 12 ContractSpine + 23 Driver). Verified 2026-08-11.

---

## Dependencies

- Depends on: Story 001 (pipeline spine, state gate interface, IPhysicsSimulator seam, pre-accumulator boundary hook), Input System epic (DONE — CaptureLatestRawSample)
- Unlocks: Story 003 (loop exists for countdown ticks), Story 006 (accumulator remainder for α), Story 008 (per-tick loop for buffer append)

---

## Completion Notes

**Completed**: 2026-08-11
**Criteria**: 11/12 fully passing + AC-1.4 partially passing (Script-mode/auto-physics check deferred to assembly gate — TD-014)
**Deviations**: None. AC-1.4's auto-physics/SimulationMode.Script verification is deferred to the assembly gate (documented in Implementation Notes + QA Test Cases; the adapter sets Script defensively at construction and before each Simulate call). Registered as TD-014.
**Test Evidence**: Logic — `Assets/tests/unit/simulation/SimulationDriverTests.cs` (23 tests). Full PlayMode suite green 196/196 (161 Input + 12 ContractSpine + 23 Driver).
**Code Review**: Complete — specialist code-review converged in 4 rounds (unity-specialist APPROVED, qa-tester TESTABLE); QL-TEST-COVERAGE ADEQUATE (12/12); LP-CODE-REVIEW APPROVED (6/6 standards).
**Scoped changes**: SimulationDriver.cs (new), SimulationDriverAdapters.cs (new), InputFrameCapture.cs (new), SimulationKernel.cs (modified — snapshot counters + sole-writer), SimulationDriverTests.cs (new).
**Estimated**: M (~4-6h) | **Actual**: ~4h implementation + ~1.5h review (specialist 4 rounds + 2 gate runs) + ~0.5h story-done.
