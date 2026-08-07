# Story 010: Countdown and Loading Context Transitions

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-008` (Context handoff latching — the Countdown/Qualifying/Loading transition flows)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0005: Input Context Controller and Action Map Inventory; ADR-0001: Manual Simulation Authority and Determinism Boundary
**ADR Decision Summary**: ADR-0005: gameplay context is enabled only in GameplayRacing, GameplayQualifying, GameplayCountdown; UI is enabled in UI, PitTransit, PitService; transitions follow Simulation state (RaceLoadReady acceptance, Pause, GO). ADR-0001: the tick pipeline runs during Countdown (engine/camera animation and grid positioning), and Settings is blocked from affecting simulation while Input remains active.

**Engine**: Unity 6000.3.19f1 | **Risk**: HIGH
**Engine Notes**: Unity 6.3 post-cutoff; verified APIs per ADR-0001. Transition sequencing verified against the Simulation Kernel's published seams (RaceLoadReady, TransitionRequest) — the Input side only reacts to Simulation state changes.

**Control Manifest Rules (this layer)**:
- Required: `InputContextController` is the sole owner of action-map and UI-module activation (source: ADR-0001, ADR-0005)
- Required: Disable one action map before enabling the other; clear pending pauseEdge on Gameplay→UI transition (source: ADR-0005)
- Guardrail: Simulation tick budget p95 ≤ 6 ms, max ≤ 8 ms (source: ADR-0001)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-14: GIVEN Countdown is active, WHEN the player provides Accelerate, Brake, or Steer input, THEN SimulationInput processes those values and Vehicle Physics keeps the car stationary under grid lock (pose displacement < 0.001 m / 0.001 rad over 60 ticks).
- [ ] AC-15: GIVEN Countdown is active, WHEN Pause rises, THEN Simulation transitions to Paused while Input enters UI context; Settings may open through that pause menu with Difficulty disabled and all other MVP categories (Controls, Audio, Display, Accessibility, Camera) visible/selectable/editable; resuming returns both to Countdown from the frozen remaining countdown tick value.
- [ ] AC-17: GIVEN Countdown is running and not paused, WHEN Settings is requested (SettingsOpenRequested), THEN Settings does not open (request ignored); it becomes available only after Pause transitions Countdown into UI context.
- [ ] AC-18: GIVEN Countdown is active and Accelerate, Brake, or Steer is held, WHEN GO releases grid lock, THEN the first Racing tick consumes the existing EMA state without reset; Brake priority remains active.
- [ ] AC-37: GIVEN RaceMode is Qualifying and the player presses Pause, WHEN Simulation enters Paused, THEN resuming restores GameplayQualifying.
- [ ] AC-56: GIVEN Qualifying Results confirms Start Race, WHEN StartRaceRequested is accepted, THEN Input remains in UI throughout Loading and transitions to GameplayCountdown only after Simulation accepts RaceLoadReady(RaceMode.Race, gridAssignment).
- [ ] AC-70: GIVEN the player starts Qualifying, WHEN Content loading is active, THEN Input remains in blocked UI routing until Simulation accepts RaceLoadReady(RaceMode.Qualifying), after which GameplayQualifying becomes the sole active gameplay context without a Countdown transition.

## Implementation Notes

*Derived from ADR-0005 Decision and GDD Input Contexts and Transitions (:161-189):*

- Countdown behavior: gameplay controls (Accelerate, Brake, Steer, Pause) remain active before GO (GDD AC-14/15). The Input side asserts SimulationInput keeps being processed normally; the stationarity observable (GridLock == true, pose displacement < 0.001 m / 0.001 rad over 60 ticks) is the Vehicle Physics grid-lock behavior verified in the Countdown context.
- Settings gate (AC-17): while Countdown is running and not paused, the SettingsOpenRequested event is ignored — Settings does not open. It becomes available only after Pause transitions Countdown into UI context.
- Countdown pause (AC-15): Pause rises → Simulation transitions to Paused, Input enters UI context; Settings opens through the pause menu with Difficulty disabled and the other 5 MVP categories (Controls, Audio, Display, Accessibility, Camera) available (visible, selectable, editable); resume returns both to Countdown from the frozen remaining countdown tick value.
- GO (AC-18): grid lock releases on GO; the first Racing tick consumes the existing EMA state WITHOUT reset; Brake priority remains active. Countdown → Racing is the exception where EMA state continues (input-system.md:157).
- Qualifying (AC-37/70): GameplayQualifying is a separate context; pause in Qualifying resumes GameplayQualifying; Qualifying start keeps Input in blocked UI routing until Simulation accepts RaceLoadReady(RaceMode.Qualifying), then switches to GameplayQualifying with NO Countdown transition.
- Race start (AC-56): from Qualifying Results, Input remains in UI throughout Loading and transitions to GameplayCountdown only after Simulation accepts RaceLoadReady(RaceMode.Race, gridAssignment).

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 009: General latching mechanics (this story composes them into the Countdown/Qualifying flows)
- Vehicle Physics epic: grid-lock implementation (observed here, not owned)
- Settings epic: the SettingsOpenRequested event and pause-menu behavior
- Content Pipeline epic: RaceLoadReady emission (observed here, not owned)

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-14** (PlayMode integration test):
  - Given: Countdown is active and grid lock is enabled.
  - When: Accelerate, Brake, and Steer input is supplied across several ticks.
  - Then: SimulationInput contains processed input; Vehicle Physics position and rotation remain at the grid pose (displacement < 0.001 m / 0.001 rad over 60 ticks).
  - Edge cases: Maximum input; brake priority; multiple cars; accumulated ticks.
- **AC-15** (PlayMode integration test):
  - Given: Countdown is active with a known remaining countdown tick value.
  - When: Pause rises, Settings is opened through the pause menu, and resume is selected.
  - Then: Simulation enters Paused; Input enters UI context; Difficulty is disabled; the other MVP categories (Controls, Audio, Display, Accessibility, Camera) are visible/selectable/editable; resume returns to Countdown at the frozen tick value.
  - Edge cases: Pause held; Settings requested without pause; resume before opening Settings; repeated pause/resume.
- **AC-17** (PlayMode integration test):
  - Given: Countdown is running and not paused.
  - When: Settings is requested (SettingsOpenRequested).
  - Then: Settings does not open (request ignored); after Pause transitions to UI context, Settings becomes available.
  - Edge cases: Request on the same tick as Pause; keyboard/gamepad request; repeated requests.
- **AC-18** (PlayMode integration test):
  - Given: Countdown is active and a driving control is held.
  - When: GO releases grid lock.
  - Then: The first Racing tick uses existing EMA state without reset; Brake priority remains active.
  - Edge cases: Brake held at GO; controls released exactly on GO; resume after pause immediately before GO.
- **AC-37** (PlayMode integration test):
  - Given: RaceMode is Qualifying.
  - When: Pause is pressed and then the game resumes.
  - Then: Resume restores GameplayQualifying.
  - Edge cases: Pause during countdown boundary; repeated pause; race mode changed while paused.
- **AC-56** (PlayMode loading harness):
  - Given: Qualifying Results is active.
  - When: Start Race is confirmed and loading begins.
  - Then: Input remains UI-routed throughout loading; GameplayCountdown is not enabled until Simulation accepts `RaceLoadReady(Race, gridAssignment)`.
  - Edge cases: Load failure; ready signal early; duplicate ready signal; invalid grid assignment.
- **AC-70** (PlayMode loading harness):
  - Given: Qualifying content loading is active.
  - When: Loading proceeds before and after `RaceLoadReady(Qualifying)`.
  - Then: Input remains blocked UI routing during loading; after acceptance, GameplayQualifying is the sole gameplay context; no Countdown transition occurs.
  - Edge cases: Ready signal duplicate; ready signal before loading; loading cancellation; stale Race ready signal.

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- `tests/integration/input/countdown_context_transitions_test.cs` — must exist and pass (PlayMode with controlled Simulation/Content/Settings/Vehicle Physics doubles)

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 009 (latching mechanics), Story 001 (context controller)
- Unlocks: Simulation Kernel epic's Countdown boundary, Grid & Start Perfect Start flow (GO tick)
