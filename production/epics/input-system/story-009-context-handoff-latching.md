# Story 009: Context Handoff Latching

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-008` (Context handoff latching: newly enabled digital latched until neutral; Accelerate/Brake/Steer exempt on UI to Gameplay)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0005: Input Context Controller and Action Map Inventory
**ADR Decision Summary**: On every Gameplay ↔ UI context transition, the pending `pauseEdge` is cleared. Every newly enabled digital action and UI Navigate control already actuated at the transition is latched until neutral/released, preventing Pause → Cancel, held Confirm, held Navigate, or held CameraToggle from firing in the new context. Accelerate, Brake, and Steer are continuous gameplay values and are exempt when returning from UI to gameplay: they apply immediately on Resume, and EMA initializes from their current post-dead-zone raw values.

**Engine**: Unity 6000.3.19f1 | **Risk**: MEDIUM
**Engine Notes**: Input System 1.19.0 — verification required: context handoff latching (held inputs across transition) per ADR-0005 Engine Compatibility.

**Control Manifest Rules (this layer)**:
- Required: Disable one action map before enabling the other (no overlapping bindings); clear pending pauseEdge on Gameplay→UI transition (source: ADR-0005)
- Required: Latch every newly enabled digital action and UI Navigate control actuated at transition until neutral/released; the latch evaluates on the frame AFTER the transition is committed; Accelerate/Brake/Steer are exempt on UI→Gameplay resume (source: ADR-0005)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-41: GIVEN Racing, Qualifying, or Countdown resumes from UI without an active-scheme change while Accelerate, Brake, or Steer is held, WHEN the first gameplay tick executes, THEN EMA previous values equal the current post-dead-zone analog values, those controls apply immediately, newly enabled digital actions remain neutral-release latched, and the pending `pauseEdge` flag is false.
- [ ] AC-44: GIVEN Escape opens the pause menu from GameplayRacing, WHEN UI context becomes active while Escape remains held, THEN no UI Cancel fires until Escape is released and pressed again.
- [ ] AC-53: GIVEN a digital action or UI Navigate control is held during a Gameplay ↔ UI context transition, WHEN the new context is active, THEN that control is ignored until neutral/released and any gameplay edge from the old context is false; continuous Accelerate, Brake, and Steer follow AC-41 on Resume.

## Implementation Notes

*Derived from ADR-0005 Decision (Context Transition Rules, :116-134) and GDD Core Rule 5 Context handoff (:130):*

- Digital actions subject to neutral-release latching (enumerated): Pause, Confirm, Cancel, Navigate, CameraToggle — all digital actions in both maps. "Neutral/released" means the digital value returns to its not-actuated state.
- The latch evaluates on the frame AFTER the transition is committed (control-manifest ADR-0005 rule) — a control held at the transition moment is consumed once, then ignored until neutral and re-actuated.
- Gameplay → UI transition:
  - Clear pending `pauseEdge` (consumed by the Pause that triggered the transition).
  - Every digital action and UI Navigate control actuated at the transition is latched (prevents Pause still held → Cancel in pause menu; Confirm held → fires in UI; Navigate held → skips UI elements).
  - Accelerate/Brake/Steer normalize to 0 (gameplay no longer processes them).
- UI → Gameplay transition (no scheme change):
  - Accelerate, Brake, Steer applied immediately (NOT latched): EMA initializes from current post-dead-zone values. Player pressing throttle during Pause → car accelerates on Resume.
  - All other digital actions latched as above; Pause remains consumed (not a new Pause event).
  - Pending `pauseEdge` flag is false.
- Countdown → Racing is the exception: EMA state continues without reset (Story 010 owns that transition's input behavior; this story owns the general handoff mechanics).
- On active scheme change, EMA previous values initialize from the newly selected scheme's current post-dead-zone values (Story 007).

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 010: Countdown/Qualifying/Loading-specific transitions (consume the latching mechanics in their flows)
- Story 007: Scheme-change EMA reinitialization
- Story 006: pauseEdge consumption in the tick processor

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-41** (PlayMode integration test or EditMode context harness):
  - Given: Racing, Qualifying, or Countdown resumes from UI without a scheme change; Accelerate, Brake, or Steer is held.
  - When: The first gameplay tick executes.
  - Then: EMA previous values equal current post-dead-zone analog values; controls apply immediately; newly enabled digital actions remain neutral-release latched; `pauseEdge` is false.
  - Edge cases: Scheme change during pause; held Pause; held digital acceleration; no analog input; resume into each supported state.
- **AC-44** (PlayMode integration test):
  - Given: Escape opens the pause menu and remains held.
  - When: UI context becomes active.
  - Then: UI Cancel does not fire until Escape is released and pressed again.
  - Edge cases: Escape released during transition; Escape pressed again in same update; gamepad East equivalent.
- **AC-53** (PlayMode integration test):
  - Given: A digital action or UI Navigate control is held across a Gameplay/UI transition.
  - When: The new context becomes active.
  - Then: The held control is ignored until neutral/released; old-context gameplay edges are false; continuous analog controls follow AC-41 on resume.
  - Edge cases: Multiple held controls; release before first tick; transition in both directions; simultaneous device change.

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- `tests/integration/input/context_handoff_latching_test.cs` — must exist and pass (PlayMode controlled context-transition tests)

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (context controller performs the transitions), Story 006 (pauseEdge semantics)
- Unlocks: Story 010 (Countdown/Loading transitions), Story 015 (direct-routing contexts)
