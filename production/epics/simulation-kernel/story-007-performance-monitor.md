# Story 007: Performance Monitor

> **Epic**: Simulation Kernel
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: M (~4-6h — 9 timer/threshold scenarios with injectable FPS feed)

## Context

**GDD**: `design/gdd/simulation-architecture.md`
**Requirement**: `TR-sim-013` (Below 30 FPS for 3 seconds emits `PerformanceReduced`; recovery and below-15 FPS pause thresholds are explicit)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0001 (Manual Simulation Authority and Determinism Boundary), ADR-0010 (Camera-VFX Rendering Budget and Interpolation)
**ADR Decision Summary**: `PerformanceReduced` is **producer-only** — Simulation owns the signal; consumer behavior (VFX quality reduction, camera shake disable, HUD warning) is defined in the consuming ADRs (0010, 0014). Thresholds: <30 FPS sustained 3s → `PerformanceReduced { severity: Reduced, observedFps }`; below-15 timer starts at 0 when reduced; if FPS remains <15 for another 3s → request Paused with reason `Performance`; ≥30 FPS for 3s while reduced → `PerformanceRestored`. FIXED_DT and Time.timeScale are never changed.

**Engine**: Unity 6000.3.19f1 | **Risk**: HIGH (Unity 6.3 is post-LLM-cutoff)
**Engine Notes**: FPS is measured from `Time.unscaledDeltaTime` only while SimulationState is Countdown or Racing. Tests use an injectable FPS feed (clock) and injectable state — no real display needed.

**Control Manifest Rules (Foundation + Core layers, v2026-08-05)**:
- Required: `PerformanceReduced` is producer-only (Simulation owns the signal, not consumer behavior); camera collision avoidance is NEVER disabled by degradation — source: ADR-0001
- Required: PerformanceReduced trigger: <30 FPS sustained 3s; PerformanceRestored: ≥30 FPS for 3s; race pause: <15 FPS for 3s after reduction — source: ADR-0001, ADR-0010
- Required: This may pause the session for player protection, but never changes `FIXED_DT`, `Time.timeScale`, or gameplay formulas — source: ADR-0001
- Forbidden: Never modify `Time.timeScale` during gameplay — source: ADR-0001
- Guardrail: Simulation tick budget p95 ≤ 6 ms, max ≤ 8 ms — source: ADR-0001

---

## Acceptance Criteria

*From GDD `design/gdd/simulation-architecture.md`, scoped to this story:*

- [ ] **AC-7.6:** Given SimulationState is Countdown or Racing and display FPS remains below 30 for 3 continuous seconds, When performance protection evaluates, Then Simulation emits `PerformanceReduced { severity: Reduced, observedFps }` without changing FIXED_DT or Time.timeScale. *(HUD shows a non-blocking warning is ADR-0014 consumer behavior — DEFERRED to the HUD epic; producer-only per ADR-0001.)*
- [ ] **AC-7.6a:** Given SimulationState is Idle, Loading, Paused, Finished, or Results, When display FPS remains below 30 for 3 continuous seconds, Then PerformanceReduced is not emitted and both sustained-FPS timers remain at 0.
- [ ] **AC-7.7:** Given FPS remains below 15 for another continuous 3 seconds after PerformanceReduced, When performance protection evaluates, Then Simulation requests Paused with reason Performance. *(HUD exposes Resume and Return to Menu is ADR-0014 consumer behavior — DEFERRED to the HUD epic; the Kernel only requests the pause via `pendingPerformancePause`.)*
- [ ] **AC-7.7a:** Given PerformanceReduced is active, When the player resumes and FPS is at or above 30, Then both sustained-FPS timers reset to 0 and the reduced state clears.
- [ ] **AC-7.7b:** Given PerformanceReduced is active, When Simulation enters Finished, Results, or Loading, Then both sustained-FPS timers reset to 0 and the reduced state clears. *(HUD removes its warning is ADR-0014 consumer behavior — DEFERRED to the HUD epic.)*
- [ ] **AC-7.7c:** Given PerformanceReduced is active, When the player resumes and FPS remains below 30, Then the sustained-FPS timers and reduced state persist so protection can re-trigger.
- [ ] **AC-7.7d:** Given PerformanceReduced is active, When FPS remains at or above 30 for 3 continuous seconds without a pause, Then Simulation emits `PerformanceRestored` and resets both sustained-FPS timers; any frame below 30 resets the recovery timer. *(Restores VFX/render quality and clears the warning are ADR-0010/ADR-0014 consumer behaviors — DEFERRED to the VFX/HUD epics; the Kernel owns the signal.)*
- [ ] **AC-7.7e:** Given PerformanceReduced has cleared after automatic recovery, When FPS subsequently remains below 30 for 3 continuous seconds, Then the below-30 timer re-arms from 0 and Simulation emits PerformanceReduced again.
- [ ] **AC-7.7f:** Given any sustained-FPS or performanceRecoveryTimer is non-zero, When Simulation enters Idle, Loading, Finished, or Results, Then all performance timers reset to 0 and the reduced state clears.

---

## Implementation Notes

*Derived from ADR-0001 and ADR-0010 Implementation Guidelines:*

- The monitor runs in Update() and measures display FPS from `Time.unscaledDeltaTime` ONLY while SimulationState is Countdown or Racing. It sets `pendingPerformancePause = true` when the below-15 threshold is reached and does NOT mutate SimulationState directly — the tick's Step 3 consumes the flag (Story 001 spine). Story 004 owns the Paused entry path; the monitor only requests.
- `PerformanceReducedSeverity` has one MVP value, `Reduced`. `PerformanceReduced { severity: Reduced, observedFps }` is emitted below 30 FPS for 3 continuous seconds; `observedFps` is the FPS sampled from the injectable feed during the sustained window.
- Timers: below-30 timer (3s → reduced), below-15 timer (starts at 0 when reduced emits; any frame ≥15 FPS resets it; 3s → pause request), recovery timer (`performanceRecoveryTimer` starts at 0 when recovery begins; 3s ≥30 FPS → restore; any frame <30 resets it).
- State-change resets: Idle, Finished, Results, or Loading always reset both sustained-FPS timers, the recovery timer, and the reduced state (7.7b, 7.7f). Resume semantics: ≥30 FPS clears (7.7a); <30 FPS persists (7.7c).
- Producer-only: the monitor emits signals on the published-snapshot seam (PerformanceReduced/PerformanceRestored). HUD warning (ADR-0014) and VFX/render quality restoration (ADR-0010) are consumer behaviors — out of scope here.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- [Story 004]: the Paused entry path and `resumeState` (the monitor requests pause; Story 004 handles the transition)
- HUD warning rendering (HUD epic, ADR-0014), VFX quality reduction / camera shake disable (VFX/Camera epics, ADR-0010)
- The 16-car profiling gate (TR-sim-005 — deferred to MVP-assembly gate, EPIC.md:71)

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-7.6**: sustained <30 FPS 3s → PerformanceReduced, FIXED_DT/timeScale unchanged
  - Given: state Countdown or Racing; timers clear; FIXED_DT/Time.timeScale baselines recorded
  - When: injectable Time.unscaledDeltaTime feed reports FPS below 30 continuously for exactly 3 seconds
  - Then: exactly one PerformanceReduced {Reduced, observedFps} emitted with observed FPS matching feed; FIXED_DT and Time.timeScale unchanged
  - Edge cases: no event before 3 continuous seconds; FPS exactly 30 does not qualify; frame ≥30 resets below-30 timer; verify Countdown and Racing independently

- **AC-7.6a**: ineligible states emit nothing, timers stay 0
  - Given: state Idle, Loading, Paused, Finished, or Results; any FPS feed
  - When: frames advance for more than 3 seconds incl. FPS below 15 and below 30
  - Then: no PerformanceReduced/PerformanceRestored emitted; reduced state false; below-30, below-15, recovery timers remain zero
  - Edge cases: enter each state while a timer already running; FPS exactly 0 or invalid/non-positive delta produces no event or non-zero timer

- **AC-7.7**: <15 FPS additional 3s → Paused reason Performance
  - Given: Countdown or Racing; reduced active; PerformanceReduced already emitted; below-15 timer zero
  - When: FPS feed remains below 15 continuously for exactly 3 additional seconds
  - Then: exactly one pause request for reason Performance; no simulation tick or state mutation by the monitor itself
  - Edge cases: no pause before additional 3s; FPS exactly 15 resets below-15 timer; frame ≥15 prevents accumulation; duplicate pause requests not emitted while already pending

- **AC-7.7a**: resume + FPS≥30 → timers reset, clears
  - Given: Paused due to performance protection; reduced active; timers non-zero
  - When: Resume injected; FPS feed ≥30
  - Then: session resumes to recorded Countdown/Racing state; reduced clears; all timers reset to zero
  - Edge cases: FPS exactly 30 qualifies; verify both resume states; FIXED_DT/timeScale unchanged

- **AC-7.7b**: enter Finished/Results/Loading → reset, clears
  - Given: reduced active; timers non-zero
  - When: state transitions to Finished, Results, or Loading
  - Then: reduced clears; all performance timers reset to zero; no performance event emitted by the transition
  - Edge cases: transition from Countdown/Racing and from Paused; transition exactly at threshold boundary; subsequent low-FPS frames in non-active state do not re-arm

- **AC-7.7c**: resume + FPS<30 → persist, re-triggerable
  - Given: Paused due to performance protection; reduced active; below-30/below-15 timers non-zero
  - When: Resume injected; FPS feed remains below 30
  - Then: session resumes; reduced state and current timer values persist; monitor can reach below-15 again and issue another Performance pause request
  - Edge cases: FPS exactly 30 follows clearing path; FPS below 15 continues existing below-15 duration rather than restarting; no timer accidentally reset on resume

- **AC-7.7d**: while reduced, ≥30 FPS 3s → PerformanceRestored; frame <30 resets recovery
  - Given: Countdown or Racing; reduced active; recovery timer zero
  - When: FPS feed remains ≥30 continuously for 3 seconds; published-snapshot seam invoked
  - Then: exactly one PerformanceRestored emitted; reduced clears; all timers reset to zero (Kernel state); warning/VFX restoration are HUD/VFX consumer behavior — DEFERRED
  - Edge cases: no restore before 3s; FPS exactly 30 qualifies; frame <30 resets recovery timer to zero requiring fresh 3s; reaching 3s without invoking seam emits nothing until seam invoked

- **AC-7.7e**: after recovery, <30 FPS 3s → re-arm, emit again
  - Given: PerformanceRestored cleared reduced and all timers; state Countdown or Racing
  - When: FPS feed subsequently remains below 30 continuously for 3 seconds
  - Then: new PerformanceReduced {Reduced, observedFps} emitted; reduced active again; continued <15 FPS 3s can produce new Performance pause request
  - Edge cases: FPS exactly 30 does not start low-FPS timer; frame ≥30 resets it; second emission independent of first recovery cycle

- **AC-7.7f**: enter Idle/Loading/Finished/Results with non-zero timers → reset all
  - Given: Countdown or Racing; reduced active or inactive; below-30, below-15, and/or recovery timers non-zero
  - When: state changes to Idle, Loading, Finished, or Results
  - Then: all timers exactly zero; reduced false; no pending performance pause or event remains
  - Edge cases: each timer non-zero independently and simultaneously; transition immediately before an emission threshold; re-entering Countdown/Racing starts with all monitoring state clear

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `Assets/tests/unit/simulation/PerformanceMonitorTests.cs` — must exist and pass. Verifies: threshold emission (7.6), state eligibility (7.6a), pause request (7.7), timer reset/persist/re-arm semantics (7.7a-f), restore signal (7.7d).

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (published-snapshot seam for PerformanceReduced/PerformanceRestored, pendingPerformancePause consumption at Step 3), Story 003 (Countdown/Racing states), Story 004 (Paused entry with reason Performance), Story 005 (Finished/Results states for timer resets)
- Unlocks: None (consumers HUD/VFX in their own epics)
