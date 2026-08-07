# Story 015: PitService and Finished Presentation Direct Routing

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-002` (InputContextController is the sole owner of activation — the direct-routing modes), `TR-input-004` (Reserved bindings — Confirm/Cancel/Pause routing in special contexts)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0005: Input Context Controller and Action Map Inventory
**ADR Decision Summary**: `InputSystemUIInputModule` is enabled only for normal menu routing inside UI. It is disabled during Loading-blocked input, Finished Presentation, PitTransit, and PitService. Finished Presentation routes Confirm and Pause directly to UI Presentation and suppresses Cancel. PitService routes Confirm directly to Pit Stop after service eligibility; PitTransit routes no actions.

**Engine**: Unity 6000.3.19f1 | **Risk**: MEDIUM
**Engine Notes**: Input System 1.19.0 core APIs confirmed stable. Verification required: direct-routing modes must not invoke generic UI Submit/Cancel handlers (InputSystemUIInputModule disabled for those modes).

**Control Manifest Rules (this layer)**:
- Required: `InputContextController` is the sole owner of action-map and UI-module activation — no system else enables/disables maps (source: ADR-0001, ADR-0005)
- Required: Pause (Escape/Start) fixed and reserved; Confirm (Enter/South) and Cancel (Escape/East) reserved in all UI contexts (source: ADR-0005)
- Required: Finished Presentation routes Confirm and Pause directly to UI Presentation and suppresses Cancel; PitService routes Confirm directly to Pit Stop after service eligibility; PitTransit routes no actions (source: ADR-0005 — input-system.md:46)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-52: GIVEN PitService is active before tire swap completes, WHEN Enter or South is pressed, THEN no exit occurs; GIVEN tire swap has completed, WHEN Enter or South is pressed, THEN Vehicle Physics begins pit exit with the current fuel level.
- [ ] AC-64: GIVEN PitService is active after tire swap completion, WHEN Enter/South is pressed, THEN Confirm routes directly to Pit Stop exactly once and no generic UI Submit handler executes.
- [ ] AC-54: GIVEN Qualifying Finished Presentation is active, WHEN Enter or South is pressed, THEN UI Presentation dismisses it and opens Qualifying Results; Escape or East is ignored and all driving input remains disabled.
- [ ] AC-57: GIVEN SimulationState is Finished, WHEN P or gamepad Start is pressed, THEN UI Presentation toggles terminal presentation pause while SimulationState remains Finished; Escape/East remains suppressed and no generic UI Cancel is dispatched.
- [ ] AC-63: GIVEN Finished Presentation is active, WHEN Escape/East is pressed, THEN InputSystemUIInputModule is disabled for that routing mode, no Cancel handler executes, and the presentation remains active.
- [ ] AC-65: GIVEN PitTransit or Loading-blocked input is active, WHEN any UI action occurs, THEN InputSystemUIInputModule is disabled and no navigation, Submit, Cancel, or gameplay event is emitted.

## Implementation Notes

*Derived from ADR-0005 Decision (Key Interfaces, :84-97) and GDD Core Rule 1 (:46):*

- `InputSystemUIInputModule` is enabled ONLY for normal menu routing inside UI. It is disabled during: Loading-blocked input, Finished Presentation, PitTransit, PitService. Direct-routing and blocked modes keep the module disabled; no generic UI Submit/Cancel handler executes in those modes.
- PitService: `OverdriveUI.Confirm` routes DIRECTLY to Pit Stop after tire-swap eligibility (minimum 2s service / full tank). Before eligibility, Confirm does nothing (AC-52 first clause). After eligibility, Confirm routes exactly once per rising edge (per press) and triggers Vehicle Physics pit exit (PitPhase = PitExiting, Pit Stop domain) with the current fuel level (AC-52 second clause, AC-64). Cancel is ignored during active service (ADR-0005:92).
- Finished Presentation (Qualifying and Race): `OverdriveUI.Confirm` routes directly to UI Presentation (skip/dismiss the terminal timer, open Results); `OverdriveUI.Pause` (P/gamepad Start) toggles the terminal presentation timer while SimulationState remains Finished; `OverdriveUI.Cancel` (Escape/East) is suppressed — no generic UI Cancel is dispatched (AC-54/57/63). All driving input remains disabled.
- Blocked modes (PitTransit, Loading-blocked): module disabled; no navigation, Submit, Cancel, or gameplay event is emitted (AC-65).
- "Exactly once" semantics: one Confirm delivery per rising edge; held buttons do not repeat; keyboard and gamepad simultaneous input cannot double-deliver.

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Pit Stop epic: tire-swap service timing, eligibility, PitPhase transitions (observed here via direct Confirm routing)
- UI Menu epic: Finished Presentation screen, terminal timer behavior (observed here via direct routes)
- Story 001: the base asset + controller (this story composes its routing modes)

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-52** (PlayMode integration test):
  - Given: PitService is active and tire swap is incomplete.
  - When: Enter or South is pressed.
  - Then: No pit exit begins.
  - Edge cases: Button held; repeated press; tire swap completes during the same update.
  - Given: Tire swap is complete.
  - When: Enter or South is pressed.
  - Then: Vehicle Physics begins pit exit using the current fuel level.
  - Edge cases: Fuel level zero; fuel changes between capture and action; repeated press.
- **AC-64** (PlayMode integration test):
  - Given: PitService is active after tire swap completion.
  - When: Enter/South produces a rising edge.
  - Then: Confirm routes directly to Pit Stop exactly once; generic UI Submit is not invoked.
  - Edge cases: Held button; keyboard and gamepad simultaneous; duplicate event in one Dynamic Update; generic Submit handler attached (must not fire).
- **AC-54** (PlayMode presentation test):
  - Given: Qualifying Finished Presentation is active.
  - When: Enter or South is pressed.
  - Then: Presentation dismisses and Qualifying Results opens; Escape/East is ignored; driving input remains disabled.
  - Edge cases: Enter held; simultaneous Escape; driving input in same update; repeated Confirm.
- **AC-57** (PlayMode presentation test):
  - Given: SimulationState is Finished.
  - When: P or gamepad Start is pressed.
  - Then: Terminal presentation pause toggles; SimulationState remains Finished; Escape/East remains suppressed; no generic UI Cancel is dispatched.
  - Edge cases: Toggle twice; held Start; simultaneous Confirm; presentation already paused.
- **AC-63** (PlayMode UI routing test):
  - Given: Finished Presentation is active.
  - When: Escape or East is pressed.
  - Then: `InputSystemUIInputModule` is disabled for that routing mode; no Cancel handler executes; presentation remains active.
  - Edge cases: Button held across activation; keyboard/gamepad simultaneous; module already disabled.
- **AC-65** (PlayMode integration test):
  - Given: PitTransit or Loading-blocked input is active.
  - When: Any UI action occurs.
  - Then: `InputSystemUIInputModule` is disabled; no navigation, Submit, Cancel, or gameplay event is emitted.
  - Edge cases: Actions arriving during transition; held action released afterward; duplicate loading signal; module re-enabled only after the unblock condition.

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- `tests/integration/input/direct_routing_test.cs` — must exist and pass (PlayMode routing tests with PitService/UI Presentation spies)

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (base asset + controller), Story 009 (latching mechanics in the routed contexts)
- Unlocks: Pit Stop epic's Confirm consumption, UI Menu epic's Finished Presentation routes
