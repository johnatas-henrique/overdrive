# Story 011: CameraToggle Routing

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-003` (CameraToggle is presentation-only; never enters SimulationInput, tick pipeline, Replay, or Ghost Recording)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0005: Input Context Controller and Action Map Inventory; ADR-0010: Camera/VFX Rendering Budget and Interpolation
**ADR Decision Summary**: ADR-0005: CameraToggle's performed/rising edge routes directly to Camera (Camera.ToggleRequest), same-frame, during Dynamic Update. Holding does not repeat; one toggle per press. ADR-0010: Camera owns the toggle; `toggleRequest` is a presentation-only field in CameraState; never enters SimulationInput or Ghost Recording.

**Engine**: Unity 6000.3.19f1 | **Risk**: MEDIUM
**Engine Notes**: Input System 1.19.0 core APIs confirmed stable (`InputAction.performed`). URP 17.3 Camera domain (ADR-0010 HIGH risk is for the camera implementation itself; this story only routes the edge — the routing contract per ADR-0005).

**Control Manifest Rules (this layer)**:
- Required: CameraToggle routes rising edge same-frame via `InputAction.performed` → `Camera.ToggleRequest`; holding does not repeat; one toggle per press (source: ADR-0005)
- Required: CameraToggle is presentation-only and is not forwarded into SimulationInput, the simulation tick, Replay, or Ghost Recording (source: ADR-0005)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-58: GIVEN GameplayRacing, GameplayQualifying, or GameplayCountdown is active, WHEN C or gamepad North/Y/Triangle produces a CameraToggle rising edge, THEN Camera begins one mode transition in the same Dynamic Update; holding the control produces no additional transition until release, and no CameraToggle value enters SimulationInput or Ghost Recording.

## Implementation Notes

*Derived from ADR-0005 Key Interfaces (:110-113) and ADR-0010 Decision (CameraState.toggleRequest):*

- Observable for "Camera begins one mode transition": `Camera.ToggleRequest` — the rising edge (InputAction.performed) routes DIRECTLY to Camera in the same Dynamic Update. No queue, no tick pipeline involvement.
- One toggle per press: holding the control produces no additional transition until release and re-press. A rejected transition (camera in an incompatible state, e.g. mid-transition) does not count as a mode transition — Input only delivers the edge; Camera decides.
- CameraToggle is presentation-only: its value NEVER enters SimulationInput, the simulation tick, Replay, or Ghost Recording.
- CameraToggle is ignored during: PitTransit, InPitBox, Exiting, Finished Presentation, Replay (ADR-0005 Key Interface comment).
- The edge is delivered only while GameplayRacing, GameplayQualifying, or GameplayCountdown is active.
- Camera owns the toggle semantics (mode switch, transitions); this story owns the Input-side routing contract only.

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Camera epic (ADR-0010): the mode transition, Camera.ToggleRequest consumption, cockpit/chase/PitCamera behavior
- Story 006: SimulationInput assembly (CameraToggle never enters it — asserted here)
- Ghost Recording: no CameraToggle capture (asserted here)

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-58** (PlayMode integration test with Camera spy):
  - Given: GameplayRacing, GameplayQualifying, or GameplayCountdown is active.
  - When: C or gamepad North/Y/Triangle produces a rising edge.
  - Then: Camera begins exactly one mode transition in that Dynamic Update (Camera.ToggleRequest fires once, same-frame); holding the control produces no additional transition; SimulationInput and Ghost Recording contain no CameraToggle value.
  - Edge cases: Press in each gameplay context; held input; release/repress; simultaneous Pause; input during UI/loading; rejected transition (camera busy) does not re-deliver.
  - Required instrumentation: Camera spy recording ToggleRequest calls with Dynamic Update identity.

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- `tests/integration/input/camera_toggle_routing_test.cs` — must exist and pass (EditMode routing contract + PlayMode Camera spy test)

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (CameraToggle action in the gameplay map)
- Unlocks: Camera epic's toggle consumption boundary
