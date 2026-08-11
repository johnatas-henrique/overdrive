# Story 004: Interruption — Pause, Resume & Focus-Loss

> **Epic**: Simulation Kernel
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: S-M (~4-6h — 8 focused transition/handler scenarios)

## Context

**GDD**: `design/gdd/simulation-architecture.md`
**Requirement**: `TR-sim-004` (Focus-loss creates non-physics lifecycle boundary; focus return never auto-resumes), `TR-sim-012` (Pause behavior in counter/race-time progression)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0001 (Manual Simulation Authority and Determinism Boundary)
**ADR Decision Summary**: Pause is implemented by skipping simulation steps, never by `Time.timeScale = 0`. `resumeState` is Simulation-owned and records the Countdown or Racing state active immediately before manual, focus-loss, or performance pause. The focus-loss lifecycle boundary runs BEFORE accumulator evaluation in the driver's Update: record `resumeState`, preserve the sub-tick remainder, increment no counters, update no domain systems, call no `Physics.Simulate`, publish one Paused lifecycle snapshot. Focus return never auto-resumes.

**Engine**: Unity 6000.3.19f1 | **Risk**: HIGH (Unity 6.3 is post-LLM-cutoff)
**Engine Notes**: The focus handler plugs into the pre-accumulator lifecycle boundary hook published by Story 001 and invoked by the driver (Story 002). `Time.timeScale` is never modified. Tests use an injectable clock, an input mock (pause edge), and a focus notification seam.

**Control Manifest Rules (Foundation + Core layers, v2026-08-05)**:
- Required: Focus loss creates an immediate non-physics lifecycle boundary before accumulator evaluation; preserves remainder and counters; publishes Paused; requires explicit Resume; focus-return never auto-resumes — source: ADR-0001
- Required: Pause is fixed and reserved across ALL contexts — cannot be remapped, replaced, or removed — source: ADR-0005
- Required: When Countdown or Racing transitions to Paused through manual pause, focus-loss, or performance protection, record the originating state as `resumeState` before publishing the non-ticking lifecycle snapshot — source: ADR-0001 (Detailed Rules §3)
- Forbidden: Never modify `Time.timeScale` during gameplay; Pause is implemented by skipping simulation steps — source: ADR-0001
- Guardrail: Simulation tick budget p95 ≤ 6 ms, max ≤ 8 ms — source: ADR-0001

---

## Acceptance Criteria

*From GDD `design/gdd/simulation-architecture.md`, scoped to this story:*

- [ ] **AC-4.5:** Given Countdown is active, When Pause transitions simulation to Paused, Then no countdown ticks execute until resume and the remaining tick count is preserved, matching Input System AC-15.
- [ ] **AC-4.6:** Given the game is in Racing state, When the player presses the pause button, Then the state transitions to Paused.
- [ ] **AC-4.6a:** Given Countdown or Racing is active, When Simulation enters Paused through the pause button, focus lifecycle boundary, or performance protection, Then it records the originating state as `resumeState` before publishing the Paused lifecycle snapshot.
- [ ] **AC-4.7:** Given the game is in Paused state, When the player resumes, Then the state returns to its recorded `resumeState` of Countdown or Racing.
- [ ] **AC-5.3:** Given the game enters Paused or loses focus, When Update continues or resumes, Then Time.timeScale remains unchanged, elapsed time is not accumulated, and the pre-pause accumulator remainder is preserved until explicit Resume.
- [ ] **AC-7.1:** Given the game is in Racing or Countdown with accumulator below `FIXED_DT`, When application focus is lost, Then the pre-accumulator lifecycle boundary immediately publishes Paused without waiting for a physics tick and focus return still requires explicit Resume.
- [ ] **AC-7.1a:** Given focus loss is consumed before accumulator evaluation, When the lifecycle boundary executes, Then it records `resumeState`, preserves accumulator remainder, increments no counter, updates no domain system, and calls no `Physics.Simulate`.
- [ ] **AC-7.1b:** Given application focus changes, When that Update frame evaluates its accumulator, Then it adds no `Time.unscaledDeltaTime` and preserves the pre-change remainder.

---

## Implementation Notes

*Derived from ADR-0001 Implementation Guidelines:*

- Pause entry paths (all three): pause button (gameplay pauseEdge consumed at Step 3 of the tick), focus lifecycle boundary (pre-accumulator), performance protection (pendingPerformancePause flag consumed at Step 3 — Story 007 sets it). All record `resumeState` = originating Countdown or Racing state before publishing the Paused lifecycle snapshot.
- Focus-loss boundary (the pre-accumulator hook from Story 001, invoked by Story 002's driver): before reading `Time.unscaledDeltaTime`, consume focus notifications; the focus-change frame adds no delta; publish one Paused lifecycle snapshot with `resumeState` recorded; preserve the sub-tick remainder; no counters, no domain updates, no `Physics.Simulate`.
- Focus return NEVER auto-resumes. Explicit Resume (player action) returns to the recorded `resumeState`.
- `Time.timeScale` is never modified during gameplay. Pause = skip simulation steps. The accumulator remainder is preserved across the pause; no paused elapsed time accumulates; no catch-up on resume.
- Pause during Countdown: no countdown ticks execute while paused; `countdownRemainingTicks` is preserved (AC-4.5, matching Input System AC-15).
- Paused → Resume: no physics tick on the resume transition itself; fixed-step processing resumes from the preserved remainder without catch-up.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- [Story 002]: the driver's accumulator mechanics and the pre-accumulator boundary invocation (Story 004 wires the focus HANDLER into that hook)
- [Story 003]: Countdown state creation and tick semantics (pause-during-Countdown tests the mechanism applied to Countdown)
- [Story 005]: Finished-state focus behavior (AC-7.1c belongs there — Finished Presentation focus retention), forfeit from Paused (AC-4.12), Results lifecycle
- [Story 007]: performance protection timers (sets `pendingPerformancePause`; Story 004 consumes it as a pause entry path)
- Pause menu UI (UI Menu System epic)

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-4.5**: Countdown pause preserves remaining ticks
  - Given: Countdown with countdownRemainingTicks = 120; non-zero accumulator remainder
  - When: pause edge injected; update loop processes it
  - Then: transitions to Paused; no Countdown ticks execute while paused; countdownRemainingTicks remains 120 until Resume
  - Edge cases: pause at 300 remaining, at 1 remaining, with zero remainder, with pause edge coincident with tick boundary

- **AC-4.6**: Racing→Paused on pause button
  - Given: Racing; input mock reports one rising pause edge
  - When: next fixed-tick boundary consumes the pause edge
  - Then: transitions to Paused; publishes one Paused lifecycle snapshot without executing a physics tick
  - Edge cases: repeated pause levels produce only one transition; pause edge with no accumulated full tick; pause edge while multiple ticks pending

- **AC-4.6a**: Paused records resumeState before publishing snapshot
  - Given: Countdown or Racing
  - When: Paused entered through pause button, focus lifecycle boundary, or performance protection
  - Then: originating state stored as resumeState before Paused snapshot published; snapshot exposes the value
  - Edge cases: all three pause causes; Countdown and Racing independently; already-Paused state does not overwrite resumeState; failed/duplicate pause request produces no additional lifecycle snapshot

- **AC-4.7**: Resume returns to recorded resumeState
  - Given: Paused with resumeState Countdown or Racing; preserved accumulator remainder
  - When: explicit Resume injected
  - Then: transitions to recorded resumeState; retains remainder; resumes fixed-step processing without catch-up
  - Edge cases: resume after long pause; remainder zero or just below FIXED_DT; Resume ignored if no valid resumeState; focus return alone does not resume

- **AC-5.3**: Paused/unfocused preserves timeScale, elapsed time, accumulator remainder
  - Given: active state; injectable clock; unchanged Time.timeScale; accumulator remainder r in [0, FIXED_DT)
  - When: Update runs while Paused or during focus loss, incl. arbitrary elapsed wall-clock time
  - Then: Time.timeScale unchanged; no elapsed time accumulated; no ticks execute; remainder r preserved until explicit Resume
  - Edge cases: pause/focus duration 0, exactly FIXED_DT, long; r = 0 and r just below FIXED_DT; timeScale values other than 1; focus return without Resume

- **AC-7.1**: Focus loss immediately publishes Paused before accumulator processing
  - Given: Countdown or Racing; accumulator below FIXED_DT; focus seam reports loss
  - When: focus-change update processed
  - Then: immediately publishes Paused before reading/evaluating Time.unscaledDeltaTime; focus return leaves Paused until explicit Resume
  - Edge cases: focus loss with zero remainder; remainder just below FIXED_DT; focus loss on a frame whose delta would cause a tick; focus loss while already Paused

- **AC-7.1a**: Focus boundary records resumeState, no simulation work
  - Given: focus loss consumed before accumulator evaluation; Countdown or Racing
  - When: focus lifecycle boundary executes
  - Then: records resumeState; preserves accumulator remainder; increments no counters; updates no domain systems; calls no Physics.Simulate; publishes exactly one Paused lifecycle snapshot
  - Edge cases: both source states; remainder zero and just below FIXED_DT; pending input/AI/performance-pause/finish signals do not cause domain work or additional transition

- **AC-7.1b**: Focus-change frame adds no unscaled delta time
  - Given: injectable clock reports focus change; Time.unscaledDeltaTime = d; pre-change remainder r
  - When: that Update frame evaluates focus lifecycle handling and accumulator
  - Then: d not added; post-frame remainder equals r; no catch-up tick; subsequent focused frames resume normal clock handling only after explicit Resume
  - Edge cases: d = 0, d = FIXED_DT, large d; focus loss and return on adjacent frames; multiple focus notifications in one frame; delta exceeding 2×FIXED_DT clamp discarded rather than applied

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/simulation/InterruptionTests.cs` — must exist and pass. Verifies: pause entry paths + resumeState (4.5-4.7, 4.6a), timeScale/remainder invariants (5.3), focus-loss boundary (7.1, 7.1a, 7.1b).

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (pre-accumulator boundary hook, state gate), Story 002 (driver invokes the boundary), Story 003 (Countdown/Racing states exist)
- Unlocks: Story 005 (pause mechanism for forfeit AC-4.12 and Finished focus AC-7.1c), Story 007 (Performance pause entry consumes the pause path), Story 008 (Pause edge events on the recordable buffer)
