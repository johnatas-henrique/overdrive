# Story 005: Session End — Finish, Results, Forfeit & Unload

> **Epic**: Simulation Kernel
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: L (~8-10h — the densest story: terminal flow with RSM/UI/content boundary contracts; 17 discrete GWT scenarios)

## Context

**GDD**: `design/gdd/simulation-architecture.md`
**Requirement**: `TR-sim-014` (Finished and Results execute no gameplay simulation; Results remains active until content unload completes)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0001 (Manual Simulation Authority and Determinism Boundary), ADR-0003 (Content Pipeline and Addressables)
**ADR Decision Summary**: ADR-0001 defines the terminal flow: on `FinishDetected`, Simulation captures `PostFinishSnapshot` once, passes it once to RSM's `FinishOrderResolver`, receives `ResolvedFinishOrder`, applies `TransitionRequest(Finished)`, and freezes the resolved order; no PhysX, Fuel, Tire, Pit, collision, or tactical AI runs after finish; Continue/Back from Results sends `ContentUnloadRequest`; Simulation remains Results until `ContentUnloadComplete`, then Idle. ADR-0003 defines the unload handshake contract.

**Engine**: Unity 6000.3.19f1 | **Risk**: HIGH (Unity 6.3 is post-LLM-cutoff)
**Engine Notes**: `FinishOrderResolver` is a pure function over the locked `PostFinishSnapshot` (no scene required). RSM owns resolution rules (ADR-0018) — the Kernel consumes `ResolvedFinishOrder`/`TransitionRequest`, never re-resolves. UI Presentation owns the terminal timer/pause flag and emits `DismissTerminalPresentation`. Tests use RSM mock, UI Presentation mock, content mock, physics spy.

**Control Manifest Rules (Foundation + Core layers, v2026-08-05)**:
- Required: `PostFinishSnapshot` is the immutable terminal-state snapshot; no PhysX, Fuel, Tire, Pit, collision, or tactical AI runs after finish — source: ADR-0001
- Required: Continue/Back from Results → `ContentUnloadRequest`; Simulation remains Results until `ContentUnloadComplete`, then Idle — source: ADR-0001
- Required: `PerformanceReduced` is producer-only (Simulation owns the signal, not consumer behavior) — source: ADR-0001
- Required: RSM owns ranking, FinishOrderResolver, `TransitionRequest` production, immutable `GridAssignment` — source: ADR-0018
- Required: `FinishOrderResolver` consumes ONE immutable PostFinishSnapshot (single read), runs once, never re-runs PhysX/Fuel/Tire/Pit/collisions/AI; player result locked; unfinished AI projected pace-only; Forfeit → no position, never invokes resolver; DNF keeps classification, no fabricated position — source: ADR-0018
- Required: Ghost Recording MVP keeps the buffer in-memory and discards it unconditionally on Results/Forfeit/Idle/load failure; no file I/O during MVP racing — source: ADR-0008
- Forbidden: No simulation code in `FixedUpdate()`; no physics after finish — source: ADR-0001

---

## Acceptance Criteria

*From GDD `design/gdd/simulation-architecture.md`, scoped to this story:*

- [ ] **AC-4.8:** Given the game is in Racing state and the player crosses the finish line on the final lap, When the finish condition is detected, Then the state transitions to Finished, player race controls are disabled, and FinishOrderResolver runs once from the locked snapshot.
- [ ] **AC-4.8dnf:** Given Racing detects fuel empty and the player car stopped on track, When RSM returns FinishDetected with player DNF, Then Simulation enters Finished and resolves all non-DNF unfinished AI from PostFinishSnapshot without waiting for live simulation.
- [ ] **AC-4.8a:** Given `resultKind = Race` or `Qualifying`, When resolution is complete and terminal presentation is dismissed, Then Simulation transitions from Finished to Results without a physics tick and `resultKind` selects the result-specific UI.
- [ ] **AC-4.8b:** Given `resultKind = Qualifying`, When the flying lap completes or fails, Then `resolutionComplete` is immediately true, Finished Presentation begins, and Confirm or its 5-second timeout transitions Simulation to Results and opens Qualifying Results.
- [ ] **AC-4.8c:** Given terminal presentation is active, When P or gamepad Start toggles UI Pause, Then SimulationState remains Finished and no physics tick executes; the UI Presentation timer pause/resume behavior itself is UI Menu epic scope (DEFERRED to the UI gate — the Kernel verifies only its state invariant and event consumption).
- [ ] **AC-4.8d:** Given terminal presentation is active, When Simulation publishes state, Then PublishedSimulationSnapshot contains immutable RSM-originated copies of `resultKind`, `resolutionComplete`, `playerFinishTime`, `terminalPresentationRequest`, and `ResolvedFinishOrder` for Camera, HUD, and UI Presentation.
- [ ] **AC-4.8e:** Given FinishOrderResolver receives a locked post-finish snapshot, When the Kernel passes it once and consumes the result, Then the Kernel verifies completed drivers and player result remain immutable and no PhysX, Fuel, Tire, Pit, collision or tactical AI executes; tie-break ordering (RSM order then carId) and DNF projection are RSM epic internals, verified in the RSM epic's contract test, not here.
- [ ] **AC-4.8f:** Given a Racing tick first detects player finish, When RSM returns FinishDetected, Then Simulation captures PostFinishSnapshot once, RSM returns ResolvedFinishOrder and `TransitionRequest(Finished)`, the current tick publishes Finished, and no subsequent Finished tick runs physics or resource simulation.
- [ ] **AC-4.8g:** Given UI Presentation dismisses a Race or Qualifying terminal request, When Simulation consumes DismissTerminalPresentation, Then Finished transitions to Results without Physics.Simulate or race-data mutation.
- [ ] **AC-4.8h:** Given Simulation is in Results with `resultKind = Qualifying` and Qualifying Results confirms Start Race, When RSM returns `TransitionRequest(Loading, QualifyingComplete, gridAssignment)`, Then Simulation enters Loading, sends `ContentLoadRequest(Race, gridAssignment)`, and transitions to Countdown only after `RaceLoadReady(RaceMode.Race, gridAssignment)`.
- [ ] **AC-4.8i:** Given SimulationState is Finished and UI Presentation's terminal timer has remaining time, When no `DismissTerminalPresentation` arrives, Then Finished remains unchanged and no physics tick executes; when the timer expires, UI Presentation emits dismissal and Simulation follows the Race or Qualifying result path. *(Timer countdown behavior itself is UI Menu epic scope — DEFERRED to the UI gate; the Kernel verifies only Finished-remains and dismissal consumption.)*
- [ ] **AC-4.8j:** Given a finishing Racing tick publishes SimulationState.Finished, When Step 13 is reached, Then AI evaluation is skipped, stale cached AIInput is cleared, and no tactical AI executes after result resolution.
- [ ] **AC-4.10:** Given the game is in Results state, When the player selects "Next Race", Then the state transitions to Loading.
- [ ] **AC-4.10a:** Given the game is in Results state, When the player selects Continue or Back, Then Simulation sends `ContentUnloadRequest`, remains Results, and executes no simulation tick while unload is in progress.
- [ ] **AC-4.10b:** Given Simulation is waiting in Results after `ContentUnloadRequest`, When Content emits `ContentUnloadComplete`, Then Simulation publishes Idle with no race assets retained.
- [ ] **AC-4.12:** Given a Paused state whose `resumeState` is Countdown or Racing, When the player selects Return to Menu, Then Simulation transitions directly to Results without a resumed physics tick; RSM publishes `resultClassification = Forfeit`, `forfeitLapCount`, and `raceTimeAtForfeit`, with no final position; and Ghost Recording receives `RaceAborted(Forfeit)` and discards its partial buffer.
- [ ] **AC-7.1c:** Given Finished Presentation has 3 seconds remaining, When application focus is lost for 30 seconds and then returns, Then SimulationState remains Finished and the UI retains 3 seconds remaining until focused presentation time resumes. *(The UI timer's focus-retention behavior is UI Menu epic scope — DEFERRED to the UI gate; the Kernel verifies only Finished-remains + no auto-dismiss/no physics resume.)*

---

## Implementation Notes

*Derived from ADR-0001, ADR-0003, ADR-0008, ADR-0018 Implementation Guidelines:*

- Finish flow: the finishing Racing tick detects finish → RSM returns `FinishDetected` → Simulation captures `PostFinishSnapshot` ONCE → passes it once to `FinishOrderResolver` → receives `ResolvedFinishOrder` + `TransitionRequest(Finished)` → the current tick publishes Finished → no subsequent Finished tick runs physics or resource simulation. Step 13 skips AI evaluation and clears stale cached AIInput (AC-4.8j).
- `FinishOrderResolver` (RSM-owned, Kernel consumes): completed drivers and player result immutable; unfinished AI projected pace-only (`trackLength / mean(lastTwoCompletedLapTimes)`, `sessionTargetLapTime` fallback); DNF stays DNF; ties use RSM order then carId; no PhysX/Fuel/Tire/Pit/collision/tactical AI execution. Forfeit never invokes the resolver.
- Published snapshot in Finished/Results carries immutable RSM-originated copies: `resultKind`, `resolutionComplete`, `playerFinishTime`, `terminalPresentationRequest`, `ResolvedFinishOrder` (AC-4.8d).
- Terminal presentation: UI Presentation owns the unscaled up-to-5s timer, its pause flag, and `DismissTerminalPresentation`. Confirm may dismiss immediately; P/Start toggles only the UI-owned timer (SimulationState remains Finished, AC-4.8c). On expiry, UI emits dismissal → Finished → Results without physics (AC-4.8i, AC-4.8g).
- Qualifying: flying lap completes or fails → `resolutionComplete = true` immediately → Finished Presentation begins → Confirm or 5s timeout → Results (Qualifying Results UI) (AC-4.8b). Results with `resultKind=Qualifying` + Start Race → Loading + `ContentLoadRequest(Race, gridAssignment)` → Countdown after matching `RaceLoadReady` (AC-4.8h).
- Forfeit (AC-4.12): Paused with resumeState Countdown/Racing + Return to Menu → direct to Results (no resumed physics tick); RSM publishes `resultClassification = Forfeit`, `forfeitLapCount`, `raceTimeAtForfeit` (0 for Countdown forfeit), no final position; Ghost Recording receives `RaceAborted(Forfeit)` and discards its partial buffer.
- Unload (AC-4.10a/4.10b): Results + Continue/Back → `ContentUnloadRequest`; remains Results while unload in progress; on `ContentUnloadComplete` → Idle with no race assets retained. Next Race (AC-4.10) → Loading.
- Finished focus retention (AC-7.1c): focus loss during Finished Presentation does not expire the timer; UI retains remaining time; SimulationState remains Finished; focus return does not auto-dismiss or resume physics.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- [Story 003]: content lifecycle entry (Idle→Loading, RaceLoadReady acceptance) — AC-4.8h RE-ENTERS that lifecycle via the Story 003 seam, consuming it, not reimplementing it
- [Story 004]: the pause/resume mechanism (AC-4.12 forfeit originates from Paused created there)
- RSM's ranking/lap rules and FinishOrderResolver internals (RSM epic, Core wave) — Kernel consumes the contracts
- UI Presentation screen rendering, timer UI, Qualifying Results screen (UI Menu System epic)
- Ghost buffer discard internals (Story 008 consumes the `RaceAborted(Forfeit)` event)

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-4.8**: finish detected → Finished, controls disabled, resolver once
  - Given: Racing; player crosses finish line on final lap
  - When: RSM mock emits FinishDetected
  - Then: state becomes Finished; player race controls disabled; FinishOrderResolver invoked exactly once with locked post-finish snapshot
  - Edge cases: duplicate FinishDetected does not re-resolve; finish on non-final lap does not transition

- **AC-4.8dnf**: fuel empty DNF resolution
  - Given: Racing detects empty fuel; player car stopped on track
  - When: RSM emits FinishDetected with player classification DNF
  - Then: enters Finished; resolves every non-DNF unfinished AI from PostFinishSnapshot without waiting for another tick
  - Edge cases: existing AI DNFs remain DNF; fuel exactly zero while moving does not trigger retirement

- **AC-4.8a**: Finished→Results without physics tick, resultKind selects UI — gated on dismissal
  - Given: resultKind Race or Qualifying; resolution complete
  - When: terminal presentation dismissed
  - Then: transitions Finished→Results without a physics tick; resultKind selects Race/Qualifying Results UI
  - Edge cases: dismissal before resolution ignored; no Physics.Simulate, resource update, or race-data mutation

- **AC-4.8b**: Qualifying flying lap → immediate resolution, Confirm/timeout → Results (not unconditional)
  - Given: resultKind Qualifying
  - When: flying lap completes or fails
  - Then: resolutionComplete true immediately; Finished Presentation begins; Confirm or 5s timeout transitions to Results and opens Qualifying Results
  - Edge cases: Confirm before lap resolution does not transition; no unconditional immediate Finished→Results; failed lap still produces resolved qualifying result

- **AC-4.8c**: terminal presentation P/Start — Kernel state invariant
  - Given: terminal presentation active
  - When: P or gamepad Start pressed (UI Presentation mock toggles its timer)
  - Then: SimulationState remains Finished; no physics tick executes on the Kernel seam
  - Edge cases: UI timer pause/resume behavior is UI Menu epic scope (DEFERRED); repeated presses must not transition Kernel state; toggling with expired timer cannot resume simulation

- **AC-4.8d**: Published snapshot has immutable RSM-originated copies
  - Given: terminal presentation active
  - When: Simulation publishes its snapshot
  - Then: PublishedSimulationSnapshot contains immutable copies of resultKind, resolutionComplete, playerFinishTime, terminalPresentationRequest, ResolvedFinishOrder
  - Edge cases: mutating RSM source/order after publication does not alter published snapshot; consumers cannot mutate nested order entries

- **AC-4.8e**: Kernel resolver-interface constraint
  - Given: FinishOrderResolver receives locked PostFinishSnapshot (mock RSM resolver)
  - When: Kernel passes it once and consumes ResolvedFinishOrder
  - Then: completed drivers and player result remain immutable; no PhysX/Fuel/Tire/Pit/collision/tactical AI called on the Kernel's seams
  - Edge cases: RSM tie-break ordering and DNF projection are RSM epic internals — verified in the RSM epic's contract test, NOT here; zero remaining distance does not change classification

- **AC-4.8f**: PostFinishSnapshot once, TransitionRequest(Finished), current tick publishes Finished
  - Given: Racing tick first detects player finish
  - When: RSM returns FinishDetected
  - Then: PostFinishSnapshot captured once; ResolvedFinishOrder + TransitionRequest(Finished) received; current tick publishes Finished; no subsequent Finished physics/resource tick
  - Edge cases: finishing tick increments normal counters once; repeated lifecycle processing does not capture/resolve again

- **AC-4.8g**: DismissTerminalPresentation → Results without Simulate
  - Given: UI Presentation emits DismissTerminalPresentation
  - When: Simulation consumes it
  - Then: Finished→Results without calling Physics.Simulate or mutating locked race data
  - Edge cases: dismissal ignored from any state other than Finished; stale/duplicate dismissal causes no additional transition

- **AC-4.8h**: Qualifying Results Start Race → Loading → Countdown after RaceLoadReady
  - Given: Results with resultKind Qualifying; Qualifying Results confirms Start Race
  - When: RSM returns TransitionRequest(Loading, QualifyingComplete, gridAssignment)
  - Then: enters Loading; sends ContentLoadRequest(Race, gridAssignment); enters Countdown only after matching RaceLoadReady
  - Edge cases: readiness before Loading or with mismatched grid ignored; no Countdown tick during Loading

- **AC-4.8i**: Finished timer — Kernel state invariant
  - Given: Finished; terminal timer has remaining time
  - When: no dismissal arrives
  - Then: Finished remains unchanged; no physics tick; on UI dismissal, Simulation follows Race or Qualifying result path
  - Edge cases: timer countdown/expiry behavior is UI Menu epic scope (DEFERRED); exactly zero remaining time dismisses once; duplicate expiry signals idempotent; stale/duplicate dismissal causes no additional transition

- **AC-4.8j**: Step 13 skipped in Finished, stale AI cache cleared
  - Given: finishing Racing tick publishes Finished
  - When: Step 13 reached
  - Then: AI evaluation skipped; stale cached AIInput cleared; no tactical AI after result resolution
  - Edge cases: cached input from prior Racing tick cannot be consumed by later Finished update; entering Results also performs no AI work

- **AC-4.10**: Results Next Race → Loading
  - Given: Results
  - When: player selects Next Race
  - Then: transitions to Loading; issues corresponding race-load request
  - Edge cases: request issued once; no simulation tick before valid RaceLoadReady

- **AC-4.10a**: Results Continue/Back → ContentUnloadRequest, remains Results, no tick
  - Given: Results
  - When: player selects Continue or Back
  - Then: sends ContentUnloadRequest; remains Results while unloading; executes no simulation tick
  - Edge cases: repeated Continue/Back does not duplicate request; load/readiness events do not bypass unload handshake

- **AC-4.10b**: ContentUnloadComplete → Idle, no assets retained
  - Given: Results after requesting unload
  - When: content mock emits ContentUnloadComplete
  - Then: publishes Idle; no race assets, instances, or content handles remain retained
  - Edge cases: incomplete unload leaves Results; duplicate completion harmless

- **AC-4.12**: Paused (resumeState Countdown/Racing) + Return to Menu → Results forfeit
  - Given: Paused with resumeState Countdown or Racing
  - When: player selects Return to Menu
  - Then: transitions directly to Results without resumed physics tick; RSM publishes resultClassification=Forfeit, forfeitLapCount, raceTimeAtForfeit with no final position; Ghost Recording receives RaceAborted(Forfeit) and discards buffer
  - Edge cases: Countdown → lap count 0, race time 0.0; Racing → paused lap count and activeRaceStepCount × FIXED_DT; no finish order created

- **AC-7.1c**: Finished Presentation focus loss — Kernel state invariant
  - Given: Finished Presentation active with time remaining
  - When: focus lost for 30 seconds then returns
  - Then: SimulationState remains Finished; no auto-dismiss; no physics resume
  - Edge cases: UI timer focus-retention behavior is UI Menu epic scope (DEFERRED); unfocused interval cannot transition Kernel state; focus return does not auto-dismiss or resume physics; P/Start remains limited to UI timer

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `Assets/tests/integration/simulation/SessionEndTests.cs` — must exist and pass. Verifies: finish detection/resolution (4.8, 4.8dnf, 4.8e, 4.8f), terminal presentation + dismissal (4.8a, 4.8b, 4.8c, 4.8i, 4.8g), snapshot immutability (4.8d), AI skip (4.8j), results/forfeit/unload (4.8h, 4.10, 4.10a, 4.10b, 4.12), finished focus retention (7.1c).

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (RSM seams: FinishDetected/TransitionRequest/ResolvedFinishOrder, PostFinishSnapshot schema), Story 003 (Racing state, content lifecycle seam for 4.8h/4.10b), Story 004 (pause mechanism for 4.12)
- Unlocks: Story 007 (Finished/Results states for timer resets), Story 008 (Results/Forfeit discard triggers for the recordable buffer)
