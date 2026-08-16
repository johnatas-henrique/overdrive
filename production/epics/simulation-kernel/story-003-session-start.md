# Story 003: Session Start — Content Lifecycle, Countdown & GO

> **Epic**: Simulation Kernel
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: M-L (~6-8h — the state machine's session-start flow: content handshake + 300-tick countdown + GO + retry semantics)

## Context

**GDD**: `design/gdd/simulation-architecture.md`
**Requirement**: `TR-sim-008` (Simulation is sole writer of SimulationState; RSM owns RaceMode; Content Pipeline emits signals), `TR-sim-009` (Countdown 300 ticks; GO on tick 300; Qualifying skips Countdown), `TR-sim-012` (counter/race-time progression through Countdown and GO)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0001 (Manual Simulation Authority and Determinism Boundary), ADR-0003 (Content Pipeline and Addressables)
**ADR Decision Summary**: ADR-0001 defines the state authority (Simulation is the sole writer of `SimulationState`; Content emits readiness/error signals; Race → Countdown, Qualifying → Racing directly; countdown = 300 ticks; GO releases grid lock after physics with `activeRaceStepCount = 0`). ADR-0003 defines the content handshake contract: `ContentLoadRequest` / `RaceLoadReady(RaceMode, GridAssignment)` / `ContentLoadError(reason, ContentErrorType)` — Content never writes SimulationState.

**Engine**: Unity 6000.3.19f1 | **Risk**: HIGH (Unity 6.3 is post-LLM-cutoff)
**Engine Notes**: The state machine is pure C# (no MonoBehaviour dependency). Content seam is the ADR-0003 `ContentPipelineSystem` event surface, consumed via mocks in tests. `IPhysicsSimulator` injectable (Story 001) enables the AC-7.10 retry test. **Performance**: no per-tick allocation expected (state transitions are O(1) boolean/enum writes); session init is one-time — no impact on the p95 ≤ 6ms / max ≤ 8ms tick budget.

**Control Manifest Rules (Foundation + Core layers, v2026-08-05)**:
- Required: Simulation Architecture is the only writer of `SimulationState`; RSM owns RaceMode, race rules, result resolution, transition requests; Content Pipeline emits readiness/unload only — source: ADR-0001
- Required: Countdown = 300 simulation ticks; GO releases grid lock after physics; next tick begins Racing; fuel/tire/race time start at GO — source: ADR-0001
- Required: `RaceLoadReady(RaceMode, GridAssignment)` emitted only when ALL assets are fully loaded and instantiated — source: ADR-0003
- Required: `ContentErrorType` = {Track, Shared, Catalog}; Car is never abortive — car failure emits `CarLoadDegraded`, race continues with 15 cars — source: ADR-0003
- Forbidden: Content never writes `SimulationState` — source: ADR-0003
- Guardrail: Load ceiling ≤ 5s PC SSD / ≤ 10s WebGL (first load, TR-content-007) — source: ADR-0003

---

## Acceptance Criteria

*From GDD `design/gdd/simulation-architecture.md`, scoped to this story:*

- [ ] **AC-4.0:** Given SimulationState is Idle, When the player starts Single Race from Title, Then Simulation transitions to Loading and sends ContentLoadRequest.
- [ ] **AC-4.1:** Given the game is in Loading state for `RaceMode.Race` and all required assets plus `gridAssignment` are ready, When Simulation accepts `RaceLoadReady(RaceMode.Race, gridAssignment)`, Then the state transitions to Countdown.
- [ ] **AC-4.1a:** Given Loading receives `RaceLoadReady(RaceMode.Qualifying, gridAssignment)` (Qualifying grid = pit-box slot, one car), When Simulation accepts it, Then state transitions to Racing with RaceMode.Qualifying and the GameplayQualifying input-context signal is emitted (Input context activation itself is Input-epic).
- [ ] **AC-4.1aa:** Given Qualifying content becomes ready, When Simulation starts the session, Then no Countdown tick, grid lock, or lights sequence executes and the first active state is Racing with RaceMode.Qualifying.
- [ ] **AC-4.1b:** Given SimulationState is not Loading, When `RaceLoadReady` arrives, Then Simulation ignores it and state remains unchanged.
- [ ] **AC-4.1c:** Given SimulationState is Loading, When Content emits `ContentLoadError(reason, ContentErrorType)`, Then Simulation transitions to Idle, publishes the error metadata (reason + ContentErrorType) on a lifecycle error signal this story defines (Kernel-owned: `LifecycleErrorRaised(reason, ContentErrorType)` — Story 001 did not publish this contract), Content releases partial race assets (Content-epic verification), and UI receives error metadata for Title (UI-epic consumption).
- [ ] **AC-4.1d:** Given Loading transitions to Countdown or Racing, When Simulation initializes the session, Then `accumulator = 0` before the first active tick.
- [ ] **AC-4.2:** Given Countdown initializes, When its first unpaused simulation tick begins, Then `countdownRemainingTicks` equals 300.
- [ ] **AC-4.3:** Given Countdown has processed 299 unpaused simulation ticks, When the next tick completes, Then `countdownRemainingTicks` reaches zero, grid lock releases, and the state transitions to Racing.
- [ ] **AC-4.4:** Given Countdown is active, When any of its 300 unpaused simulation ticks processes Accelerate, Brake, or Steer, Then SimulationInput and EMA advance while Vehicle Physics keeps the car stationary under grid lock.
- [ ] **AC-4.4a:** Given Countdown is active, When all 300 unpaused ticks complete, Then Fuel and Tire remain at their initial race values. *(Story scope: verifies the session-start machine exposes NO resource mutation seam and Countdown does not touch Fuel/Tire state; the full "remain at initial values" assertion executes at the Fuel/Tire pipeline steps 5a/5b, owned by the Fuel System / Tire System epics — see TD-016.)*
- [ ] **AC-4.4b:** Given Countdown decrements from 1 to 0 on its 300th tick, When that tick completes, Then it increments `simulationStepCount`, releases grid lock after Physics.Simulate, publishes Racing with `activeRaceStepCount = 0`, and the following tick is the first tick that starts Racing. (This story tests the GO **state transition** through the real driver from Story 002 — the counter/physics-order mechanics themselves are Story 002 scope, verified there; here the assertion is that the state machine schedules the transition at the correct tick and publishes Racing.)
- [ ] **AC-4.11:** Given the game is in Loading state, When any event other than loading completion occurs, Then the state remains Loading and no simulation steps execute.
- [ ] **AC-4.13:** Given the game is in Loading state, When the update loop runs, Then no simulation steps (Physics.Simulate) are executed.
- [ ] **AC-1.7:** Given Countdown reaches GO, When the first Racing snapshot publishes, Then `activeRaceStepCount = 0` and `sim_time = 0.0`.
- [ ] **AC-7.10:** Given `Physics.Simulate(FIXED_DT)` throws during an active tick in a **Race** session, When Simulation handles the exception, Then it freezes authoritative state (no counter/resource/car-state advancement from the failed tick; state machine enters a retry-hold without advancing `simulationStepCount`), logs the error via a testable logger seam, and exposes retry via `SimulationStateMachine.RequestRetry()` without executing another tick automatically; retry restarts Countdown at `countdownRemainingTicks = 300` if the exception occurred during Countdown, otherwise reloads the current race from its start (re-emit `ContentLoadRequest(RaceMode.Race, gridAssignment)` → Loading → on `RaceLoadReady` → Countdown per GDD Edge Cases L241). A Qualifying physics failure is NOT retryable (ADR-0013: single flying lap, one attempt, no retry) — it transitions to Idle with the error signal.

---

## Implementation Notes

*Derived from ADR-0001 and ADR-0003 Implementation Guidelines:*

- State authority: Simulation is the sole writer of `SimulationState`. RSM owns `RaceMode` and `GridAssignment`; Content emits `RaceLoadReady`/`ContentLoadError`/`ContentUnloadComplete`. No other system writes state.
- Session initialization on `RaceLoadReady(Race)` → Countdown: `accumulator = 0`, `simulationStepCount = 0`, `activeRaceStepCount = 0`, `sim_time = 0`, resource state and all car positions from the locked `GridAssignment`. Grid & Start applies the assignment before the first Countdown tick.
- `RaceLoadReady(Qualifying)` → Racing directly (no Countdown, no grid lock, no lights sequence); `GameplayQualifying` input context; car spawns at pit box with an out-lap through pit lane.
- Countdown: `countdownRemainingTicks` initializes to 300 and is the only authority for GO. Each unpaused tick decrements once. Fuel and Tire remain at initial values (Steps 5a/5b skipped). Vehicle Physics holds grid lock (GridLocked state) while allowing wheel/engine visual state; Pit and Settings remain blocked.
- GO (tick 300): increments `simulationStepCount`, runs the grid-locked `Physics.Simulate`, releases grid lock AFTER physics, publishes Racing with `activeRaceStepCount = 0` and `sim_time = 0.0`. The following tick is the first to start in Racing. No continuous input record for the GO tick.
- Retry (AC-7.10): the driver's exception seam (`IPhysicsSimulator` throws) freezes authoritative state, logs via the injectable logger seam, and exposes retry; no further tick executes. Retry during Countdown → `countdownRemainingTicks = 300` restart (only that counter resets). Retry during Racing → reload: `ContentLoadRequest(RaceMode.Race, gridAssignment)` → Loading → on `RaceLoadReady(Race, grid)` → Countdown (per GDD Edge Cases: "Offer retry from last checkpoint (race start for MVP)"). Entry point: `SimulationStateMachine.RequestRetry()` — the only way to exit the retry-hold. Retry is Race-only: Qualifying has NO retry (ADR-0013: single flying lap, one attempt, no retry) — a Qualifying physics failure transitions to Idle with the error signal instead.
- Error path (AC-4.1c): on `ContentLoadError`, transition to Idle; the Kernel raises the `LifecycleErrorRaised(reason, ContentErrorType)` signal — a contract THIS story defines (Story 001 did not publish it; the AC-3.8 lifecycle snapshot is distinct). Content's own partial-asset release is verified by the Content Pipeline epic.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- [Story 002]: accumulator mechanics, `Physics.Simulate` call sequencing, counters (the driver loop that drives countdown ticks)
- [Story 004]: pause/resume/focus handling (pause-during-Countdown AC-4.5 belongs there — it tests the pause mechanism applied to Countdown)
- [Story 005]: Finished/Results/forfeit lifecycle (terminal flow after Racing)
- [Story 008]: ReplayInitialState capture at GO (consumes the GO event published here), recordable buffer
- Qualifying pit-lane physics behavior (Vehicle Physics epic, Core wave)

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-4.0**: Idle→Loading + ContentLoadRequest
  - Given: SimulationState Idle; race configuration selected
  - When: player starts Single Race from Title
  - Then: state becomes Loading; content mock receives exactly one matching ContentLoadRequest; no simulation tick executes
  - Edge cases: repeated start requests not duplicated; invalid configuration rejected without leaving Idle; accumulator/counters unchanged

- **AC-4.1**: Loading→Countdown on RaceLoadReady(Race)
  - Given: Loading for RaceMode.Race; content mock prepared all assets + valid GridAssignment
  - When: SUT accepts RaceLoadReady(Race, gridAssignment)
  - Then: state becomes Countdown; RaceMode is Race; grid assignment applied; grid lock active; session initialized for countdown
  - Edge cases: missing/invalid grid assignment rejected; duplicate readiness does not restart session; no active tick before next accumulator-driven update

- **AC-4.1a**: Loading→Racing on RaceLoadReady(Qualifying)
  - Given: Loading; content mock prepared qualifying assets + pit-box gridAssignment
  - When: SUT accepts RaceLoadReady(RaceMode.Qualifying, pitBoxGrid)
  - Then: state becomes Racing; RaceMode Qualifying; GameplayQualifying input-context signal emitted (activation itself Input-epic); pit-box grid applied; no Countdown state entered
  - Edge cases: qualifying readiness with missing assets rejected; duplicate readiness does not reinitialize counters; grid argument null → rejected without transition

- **AC-4.1aa**: Qualifying no countdown/grid lock/lights
  - Given: Qualifying content ready
  - When: qualifying session starts and first active tick processed
  - Then: no countdown tick, grid lock, or lights-sequence operation; first active state Racing with RaceMode.Qualifying
  - Edge cases: Accelerate/Brake/Steer remain available; fuel/tire ticking skipped; race-mode readiness cannot alter qualifying session

- **AC-4.1b**: RaceLoadReady ignored outside Loading
  - Given: state Idle, Countdown, Racing, Paused, Finished, or Results
  - When: content mock emits RaceLoadReady with either mode
  - Then: event ignored; state and session data unchanged; no ContentLoadRequest or simulation tick produced
  - Edge cases: readiness for different race or stale grid ignored; repeated events have no effect

- **AC-4.1c**: ContentLoadError→Idle, releases assets, UI error metadata
  - Given: Loading; content mock holds complete or partial race assets
  - When: ContentLoadError(reason, type) emitted
  - Then: state becomes Idle; error metadata (reason + ContentErrorType) raised on the Kernel's LifecycleErrorRaised signal (contract defined in this story); no physics/domain tick; no stale race asset remains in Simulation
  - Edge cases: errors with null/malformed metadata still return safely to Idle; error signal fires exactly once per ContentLoadError; partial-asset release is Content's own responsibility (Content epic)

- **AC-4.1d**: accumulator=0 before first active tick
  - Given: Loading; accumulator contains nonzero remainder
  - When: RaceLoadReady transitions to Countdown or Qualifying Racing
  - Then: accumulator set to exactly 0 before any first active tick; simulationStepCount, activeRaceStepCount, sim_time initialized to zero
  - Edge cases: readiness during an update cannot consume prior remainder; first active tick requires newly accumulated time; both Race and Qualifying obey the reset

- **AC-4.2**: countdownRemainingTicks=300
  - Given: RaceLoadReady(Race) transitioned SUT to Countdown
  - When: first unpaused simulation tick begins
  - Then: countdownRemainingTicks is 300 at initialization; tick decrements exactly once to 299 after processing
  - Edge cases: value cannot be negative or exceed 300; paused updates do not decrement; no countdown tick created by rendering alone

- **AC-4.3**: 299→0 releases grid lock→Racing
  - Given: Countdown completed 299 unpaused ticks; countdownRemainingTicks = 1
  - When: next simulation tick completes
  - Then: countdownRemainingTicks = 0; Physics.Simulate completes; grid lock released afterward; state becomes Racing
  - Edge cases: grid pose and linear/angular velocity restored/cleared at release; throw from Physics.Simulate prevents release; following tick, not GO tick, starts in Racing

- **AC-4.4**: input/EMA advance under grid lock, car stationary
  - Given: Countdown; locked car at assigned grid pose; input mock supplies Accelerate/Brake/Steer
  - When: each of the 300 countdown ticks processes the sample
  - Then: SimulationInput consumed; EMA advances once per tick; Vehicle Physics keeps car stationary under grid lock; linear/angular velocity cleared
  - Edge cases: changing/maximum input never moves the car; multiple ticks per frame advance EMA once per tick; Physics.Simulate still called once per completed tick

- **AC-4.4a**: Fuel/Tire at initial values after 300 ticks
  - Given: Countdown starts with known initial Fuel/Tire values; nonzero throttle/steering input
  - When: all 300 unpaused countdown ticks complete
  - Then: Fuel and Tire values exactly equal initial race values (machine-level: no resource seam exposed by the session-start machine; full assertion at Fuel/Tire pipeline steps 5a/5b — TD-016)
  - Edge cases: pit-service commands cannot alter countdown resources; zero/max/changing inputs produce same no-consumption/no-wear result; paused interval does not count as a tick

- **AC-4.4b**: tick 300: simStep++, grid lock release after Simulate, publish Racing activeRaceStepCount=0
  - Given: SUT on final Countdown tick with countdownRemainingTicks = 1; driver from Story 002 drives the loop
  - When: tick executes through Physics.Simulate and publishes its result
  - Then: simulationStepCount increments by one; grid lock releases only after Physics.Simulate; published state is Racing with activeRaceStepCount=0 and sim_time=0.0; following tick is first to start in Racing
  - Edge cases: no continuous input sample for GO tick; no activeRaceStepCount increment on that tick; call ordering verified with injectable physics simulator (state transition assertion — counter mechanics themselves are Story 002 tests)

- **AC-4.11**: Loading ignores non-completion events
  - Given: Loading
  - When: Pause, Resume, input, race-session, UI, stale unload, or other non-loading-completion events delivered
  - Then: state remains Loading; no counters/domain change; no simulation step executes
  - Edge cases: Cancel/Back ignored; events before/after ContentLoadError not replayed; only valid RaceLoadReady or ContentLoadError may change state

- **AC-4.13**: Loading no Physics.Simulate
  - Given: Loading; update loop receives arbitrary elapsed time incl. enough for multiple fixed steps
  - When: Update and accumulator processing run
  - Then: Physics.Simulate called zero times; no simulation step; elapsed time does not create deferred catch-up ticks after loading
  - Edge cases: large frame deltas, repeated updates, non-completion events remain non-ticking; after valid readiness, accumulator starts at zero

- **AC-1.7**: GO → first Racing snapshot activeRaceStepCount=0, sim_time=0.0
  - Given: Countdown at one remaining tick; injectable physics simulator completes successfully
  - When: GO tick releases grid lock and publishes first Racing snapshot
  - Then: snapshot reports Racing, activeRaceStepCount=0, sim_time=0.0
  - Edge cases: simulationStepCount includes GO tick; next Racing tick increments activeRaceStepCount to 1 and reports sim_time=FIXED_DT; no float tolerance permits nonzero initial race time

- **AC-7.10**: Physics.Simulate throws → freeze/log/retry
  - Given: active tick in a Race session invokes injectable IPhysicsSimulator and it throws
  - When: SUT handles the exception; test observes frozen state and calls SimulationStateMachine.RequestRetry()
  - Then: authoritative state frozen (no counter/resource/car-state advancement from failed tick); logger seam receives exactly one error log; no additional tick executes automatically; retry exposed. Countdown failure → countdownRemainingTicks=300 restart (and only that counter reset — authoritative state otherwise preserved). Racing failure → ContentLoadRequest(RaceMode.Race, gridAssignment) → Loading → on RaceLoadReady(Race, grid) → Countdown
  - Edge cases: counters/resources/car state/grid state not partially advanced by failed tick; repeated failures repeat freeze/log without tight retry loop; stale readiness ignored until Loading; retry uses current race configuration; Qualifying failure → Idle + error signal (NO retry — ADR-0013)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `Assets/tests/unit/simulation/SessionStartTests.cs` — must exist and pass. Verifies: content handshake transitions (4.0-4.1d, 4.11, 4.13), countdown timer + grid lock + GO (4.2-4.4b, 1.7), retry semantics (7.10).

**Status**: ✅ Created and passing — `SessionStartTests.cs` (29 tests, 225/225 PlayMode green). AC-4.4a verified at machine scope (no resource seam exposed; full Fuel/Tire assertion deferred to steps 5a/5b — TD-016).

---

## Dependencies

- Depends on: Story 001 (content seams, state gate, IPhysicsSimulator), Story 002 (the loop drives countdown ticks). Note: the `LifecycleErrorRaised(reason, ContentErrorType)` error signal is defined in THIS story — Story 001's AC-3.8 lifecycle snapshot does not carry error metadata.
- Unlocks: Story 004 (Countdown/Racing states exist for pause/focus), Story 005 (Racing exists for finish), Story 008 (GO event for ReplayInitialState)

---

## Completion Notes

**Completed**: 2026-08-11
**Criteria**: 16/16 passing (0 deferred — AC-4.4a verified at machine scope, full Fuel/Tire assertion tracked as TD-016)
**Deviations**:
- ADVISORY — AC-4.4a re-scoped to machine-level (no resource seam exposed); full "Fuel/Tire remain at initial race values" assertion deferred to Fuel/Tire pipeline steps 5a/5b (TD-016).
- ADVISORY — TD-015: GDD simulation-architecture.md L191 vs ADR-0003 L100 signature reconciliation (Race=grid, Qualifying=pit-box). Implementation already correct (`GridAssignment.ForQualifying`); reconciliation via /propagate-design-change at Content Pipeline epic.
- ADVISORY — Driver catch for AC-7.10 deviates from the "minimal driver change" briefing: the physics-failure handler prevents counter/accumulator commit on a failed tick. Validated by unity-specialist + lead-programmer (APPROVED).
**Test Evidence**: Logic — `Assets/tests/unit/simulation/SessionStartTests.cs` (29 tests, 225/225 PlayMode green)
**Code Review**: Complete — unity-specialist APPROVED (2 rounds), qa-tester TESTABLE (3 rounds), lead-programmer APPROVED (LP-CODE-REVIEW), qa-lead ADEQUATE (QL-TEST-COVERAGE, 2 rounds)
