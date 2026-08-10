# Story 006: Context Handoff & Transitions

> **Epic**: Input System
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: L (8-12h)

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-008`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0001 (Manual Simulation Authority and Determinism Boundary), ADR-0005 (Input Context Controller and Action Map Inventory)
**ADR Decision Summary**: Context handoff latching — on every Gameplay ↔ UI transition the pending `pauseEdge` is cleared; every newly enabled digital action and UI Navigate control already actuated at the transition is latched until neutral/released; Accelerate, Brake, and Steer are continuous values exempt on UI → Gameplay resume (they apply immediately, EMA initializes from current post-dead-zone values). Countdown → Racing is the exception: EMA state continues without reset.

**Engine**: Unity 6000.3.19f1 + Input System 1.19.0 | **Risk**: HIGH
**Engine Notes**: This is the story with the most cross-system integration (Simulation, Settings, Content Pipeline, Race Session Manager, Pit Stop). Transitions must be driven by explicit lifecycle events, not real scenes. Unity `EventSystem` skips `Process()` on the frame a UI input module activates — input routing tests must wait one settle frame after activation before simulating presses.

**Control Manifest Rules (Foundation)**:
- Required: `InputContextController` is the sole owner of action-map and UI-module activation; context handoff latching (ADR-0005).
- Required: On UI → GameplayRacing/Qualifying/Countdown resume, EMA previous values initialize from current post-dead-zone values; digital actions remain neutral-release latched (ADR-0005).
- Required: Countdown → Racing is the exception — EMA state continues without reset (ADR-0005).

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [x] AC-14: GIVEN Countdown is active, WHEN the player provides Accelerate, Brake, or Steer input, THEN SimulationInput processes those values and Vehicle Physics keeps the car stationary under grid lock.
- [x] AC-15: GIVEN Countdown is active, WHEN Pause rises, THEN Simulation transitions to Paused while Input enters UI context; Settings may open through that pause menu with Difficulty disabled and all other MVP categories available; resuming returns both to Countdown from the frozen remaining countdown tick value.
- [x] AC-16: GIVEN Countdown is active, WHEN the player provides any driving input, THEN grid lock keeps the car at its grid pose and no pit-lane entry can occur before GO.
- [x] AC-17: GIVEN Countdown is running and not paused, WHEN Settings is requested, THEN Settings does not open; it becomes available only after Pause transitions Countdown into UI context.
- [x] AC-18: GIVEN Countdown is active and Accelerate, Brake, or Steer is held, WHEN GO releases grid lock, THEN the first Racing tick consumes the existing EMA state without reset; Brake priority remains active.
- [x] AC-37: GIVEN RaceMode is Qualifying and the player presses Pause, WHEN Simulation enters Paused, THEN resuming restores GameplayQualifying.
- [x] AC-41: GIVEN Racing, Qualifying, or Countdown resumes from UI without an active-scheme change while Accelerate, Brake, or Steer is held, WHEN the first gameplay tick executes, THEN EMA previous values equal the current post-dead-zone analog values, those controls apply immediately, newly enabled digital actions remain neutral-release latched, and the pending `pauseEdge` flag is false.
- [x] AC-44: GIVEN Escape opens the pause menu from GameplayRacing, WHEN UI context becomes active while Escape remains held, THEN no UI Cancel fires until Escape is released and pressed again.
- [x] AC-53: GIVEN a digital action or UI Navigate control is held during a Gameplay ↔ UI context transition, WHEN the new context is active, THEN that control is ignored until neutral/released and any gameplay edge from the old context is false; continuous Accelerate, Brake, and Steer follow AC-41 on Resume.
- [x] AC-56: GIVEN Qualifying Results confirms Start Race, WHEN `StartRaceRequested` is accepted, THEN Input remains in UI throughout Loading and transitions to GameplayCountdown only after Simulation accepts `RaceLoadReady(RaceMode.Race, gridAssignment)`.
- [x] AC-70: GIVEN the player starts Qualifying, WHEN Content loading is active, THEN Input remains in blocked UI routing until Simulation accepts `RaceLoadReady(RaceMode.Qualifying)`, after which GameplayQualifying becomes the sole active gameplay context without a Countdown transition.

---

## Implementation Notes

*Derived from ADR-0001 and ADR-0005 Implementation Guidelines:*

- Context handoff on every Gameplay ↔ UI transition: clear the pending `pauseEdge`; latch every newly enabled digital action and UI Navigate control already actuated at the transition until neutral/released (prevents Pause → Cancel, held Confirm, held Navigate, held CameraToggle from firing in the new context).
- Accelerate, Brake, Steer are exempt on UI → Gameplay resume: they apply immediately; EMA initializes from their current post-dead-zone values. Countdown → Racing is the exception: EMA continues without reset.
- On `UI → GameplayRacing/Qualifying/Countdown` resume without a scheme change: clear pending `pauseEdge`; EMA previous values initialize from current active-scheme post-dead-zone values; newly enabled digital gameplay actions remain neutral-release latched.
- Loading transitions: Input stays in blocked UI routing while `ContentLoadRequest` is active; switches to GameplayQualifying/Countdown only after Simulation accepts `RaceLoadReady`.
- Contexts (from the GDD table): GameplayRacing/Qualifying/Countdown allow gameplay actions + Pause + CameraToggle; UI allows Navigate/Point/Click/Confirm/Cancel (+ Pause only while Finished); PitTransit/PitService and Loading-blocked route nothing.
- `EventSystem` settle frame: after activating a UI context, wait one frame before simulating presses in tests.
- **Handoff da story-003**: quando o seam `InitializeFromPostDeadZone` (AC-41a) existir, adicionar o teste de retenção de prev NÃO-zero com α=0 **referenciando AC-27** — o EMA com α=0 deve reter um prev estabelecido (verificar os 3 canais), não só o from-rest. O `EmaBrakePriorityTests` da story-003 cobre apenas o from-rest (com α=0 o prev nunca se torna não-zero sem o seam); a retenção de um prev não-zero é verificada aqui, via o seam.

---

## Embedded Definitions

*Testability refinements from QL-STORY-READY gate.*

- **AC-15**: Settings MVP categories enumerated via stub — Audio, Display, Controls, Accessibility, Camera (Difficulty disabled). Assert Difficulty disabled and the enumerated categories enabled. Cross-reference the Settings GDD for the canonical list.
- **AC-17**: `SettingsRequested` event while Countdown is active and not paused — assert the request is ignored (no context transition, Settings stays closed).
- **AC-41**: split into 4 independently verifiable assertions — (a) EMA prev == current post-dead-zone values; (b) analog applies immediately; (c) digital actions latched until neutral; (d) pending `pauseEdge` false.
- **AC-18**: deterministic EMA fixture — known previous Accelerate/Brake/Steer values, known held raw values, and exact expected first Racing-tick outputs. The assertion must prove NO reinitialization occurs at Countdown → Racing: a reset would produce outputs equal to the raw post-dead-zone values (from-rest), while the correct behavior produces outputs derived from the retained EMA state. A test asserting only nonzero output would pass after a reset and is mutation-inadequate.
- **AC-53 latching matrix (enumerated)**:
  - Gameplay → UI: held Pause (Escape → no UI Cancel until release+repress, AC-44), held Confirm/Submit → no Confirm, held Cancel → no Cancel, held Navigate → no navigation.
  - UI → Gameplay: held Pause, held CameraToggle → no toggle until neutral/release; Accelerate/Brake/Steer exempt (analog, AC-41).
  - Point/Click are NOT latched: they are PassThrough handled by the UI module, whose pointer tracking (mouse position read immediately) is desired on activation. A held left-click may produce one click on the UI module's activation — accepted UI behavior, not a phantom-input defect (unity-specialist recommendation).
  - CameraToggle scope: Story 006 owns the LATCHING (a held CameraToggle must not fire on the transition) via a mocked camera consumer; Story 007 owns the ROUTING (what a fired CameraToggle does).
- **AC-56/AC-70 mocked lifecycle contract**: `StartRaceRequested` issued → mock Simulation accepts it; loading-blocked keeps Input in UI routing (no gameplay context); accepted `RaceLoadReady(RaceMode.Race, gridAssignment)` → GameplayCountdown (AC-56) / `RaceLoadReady(RaceMode.Qualifying)` → GameplayQualifying (AC-70); wrong-mode readiness (Qualifying when Race expected and vice-versa) ignored (Input stays in UI); duplicate readiness ignored (only the first accepted readiness transitions); exact resulting InputContext asserted after each event.
- Transition tests drive explicit lifecycle events (PauseRequested, RaceLoadReady, StartRaceRequested) via mocked Simulation/Settings/Content Pipeline/RSM/Pit Stop services — not real scenes.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 007: special routing (CameraToggle ROUTING, Mouse policy, PitService/Finished direct routes) — the CameraToggle LATCHING is Story 006's scope.
- Story 004: the tick pipeline itself (this story owns transitions/context, not the pipeline math).

---

## Performance Budget

**O(1)** per context transition — latching/edge-clear runs only on Gameplay↔UI switches (never per-frame); no allocations, no per-device iteration. The per-tick cost is unchanged (story-004 pipeline is O(1)); transitions add a constant-time latch/clear on context change only. Fits the simulation gate: p95 ≤ 6 ms / max ≤ 8 ms.

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-14**: Countdown driving input is processed while grid lock holds the car
  - Given: GameplayCountdown active; Accelerate, Brake, or Steer provided.
  - When: a simulation tick executes.
  - Then: `SimulationInput` contains the processed values; Vehicle Physics keeps the car stationary under grid lock.
  - Edge cases: full throttle/brake/steer, simultaneous throttle/brake.

- **AC-15**: Countdown Pause enters UI and resumes from the frozen countdown tick
  - Given: Countdown active at a known remaining tick count.
  - When: Pause rises; Settings requested from the pause menu (Difficulty disabled, Audio/Display/Controls/Accessibility/Camera enabled); Resume selected.
  - Then: Simulation enters Paused; Input enters UI; resume returns to Countdown with the original remaining tick count.
  - Edge cases: pause at first/final countdown tick, held Pause, attempt Difficulty modification.

- **AC-16**: Countdown grid lock prevents movement and pit entry
  - Given: Countdown active; driving input held.
  - When: multiple countdown ticks execute before GO.
  - Then: car remains at grid pose; no pit-entry event emitted.
  - Edge cases: held throttle, steer toward pit entry, device switch.

- **AC-17**: Settings cannot open during active Countdown
  - Given: Countdown running and not paused.
  - When: a `SettingsRequested` event is issued.
  - Then: Settings stays closed; no context transition occurs.
  - Edge cases: request from keyboard/gamepad/UI navigation, repeated requests.

- **AC-18**: Countdown-to-Racing preserves EMA state
  - Given: Countdown active; Accelerate/Brake/Steer held; EMA and Brake priority state known.
  - When: GO releases grid lock and the first Racing tick executes.
  - Then: EMA state not reset; held input processed immediately; Brake priority remains active.
  - Edge cases: each analog channel, simultaneous throttle/brake.

- **AC-37**: Paused qualifying resumes to GameplayQualifying
  - Given: RaceMode Qualifying; GameplayQualifying active.
  - When: Pause pressed, then Resume selected.
  - Then: Simulation enters Paused; resumes into GameplayQualifying (not Racing or Countdown).
  - Edge cases: qualifying pause during held analog input.

- **AC-41**: UI-to-gameplay resume initializes analog EMA and latches digital actions (4 assertions)
  - Given: Racing/Qualifying/Countdown resumes from UI without scheme change; analog held; a digital action held.
  - When: the first gameplay tick executes.
  - Then: (a) EMA prev == current post-dead-zone values; (b) analog applies immediately; (c) digital actions latched until neutral/release; (d) `pauseEdge == false`.
  - Edge cases: each transition type; held Pause, Confirm, Cancel, Navigate, CameraToggle.

- **AC-44**: Pause-to-UI Escape latching prevents accidental Cancel
  - Given: GameplayRacing active; Escape opens pause menu and remains held.
  - When: UI context becomes active.
  - Then: UI Cancel does not fire until Escape is released and pressed again.
  - Edge cases: release/repress within separate Dynamic Updates.

- **AC-53**: Digital inputs latch across Gameplay/UI transitions
  - Given: a digital action or Navigate control held during a Gameplay/UI transition.
  - When: the new context becomes active.
  - Then: the held control ignored until neutral/release; old gameplay edges false; analog follows AC-41 on Resume.
  - Edge cases: every digital action, both transition directions.

- **AC-56**: Qualifying loading remains blocked until RaceLoadReady (Race)
  - Given: Qualifying Results confirms Start Race; `StartRaceRequested` accepted.
  - When: Input processed before and after `RaceLoadReady(RaceMode.Race, gridAssignment)`.
  - Then: Input stays in UI throughout Loading; transitions to GameplayCountdown only after readiness.
  - Edge cases: delayed readiness, duplicate readiness, wrong race mode.

- **AC-70**: Qualifying remains blocked until qualifying readiness
  - Given: player starts Qualifying; Content loading active.
  - When: Input processed before and after `RaceLoadReady(RaceMode.Qualifying)`.
  - Then: blocked UI routing before readiness; GameplayQualifying sole active context after; no Countdown transition.
  - Edge cases: wrong-mode readiness, duplicate readiness, input held during loading.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `Assets/tests/integration/input/ContextTransitionsTests.cs` — must exist and pass (asmdef `InputIntegrationTests`).

**Status**: [x] Created and passing — 16 tests / 104 suite PASS (AC14/15/16/17/18/37/41/44/53/56/70 + AC18 brake, AC53 UI→Gameplay + Confirm, blocked-routing input, blocked clears pause, same-context no-latch, OnContextChanged).

---

## Dependencies

- Depends on: Story 001 (controller), Story 004 (pipeline), Story 005 (scheme state).
- Unlocks: Story 007 (special routing interacts with the context machine).

---

## Completion Notes

**Completed**: 2026-08-09
**Criteria**: 11/11 passing (0 deferred)
**Deviations**: TD-008 — QL-TEST-COVERAGE GAPS: downstream consumers (Vehicle Physics grid lock, Pit Stop pit-entry, Simulation Kernel Countdown/GO/RaceMode, RSM) are mocked self-sufficiently because they do not exist in this epic; registered as tech-debt for the owning epics.
**Test Evidence**: Integration — `ContextTransitionsTests.cs` (16 tests, 104/104 PASS). Updated via rule #1934 before gates.
**Code Review**: Complete — converged round 5 (unity-specialist APPROVED r4, qa-tester APPROVED r5); LP-CODE-REVIEW APPROVED; QL-TEST-COVERAGE GAPS → TD-008.
