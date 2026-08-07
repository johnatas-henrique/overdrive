# Epic: Input System

> **Layer**: Foundation
> **GDD**: design/gdd/input-system.md
> **Architecture Module**: Input System (Foundation Layer — module ownership per docs/architecture/architecture.md:118-125)
> **Status**: Ready
> **Stories**: 15 created — see table below

## Overview

The Input System is the first link between the player's intent and the car's behavior: it captures raw signals from keyboard, mouse, and gamepad, converts them into game-level values (`SimulationInput`) and UI actions, and delivers them to downstream systems with minimal latency. It owns device detection, dead-zone filtering, EMA smoothing, automatic device switching, and the `InputContextController` — the sole owner of action-map and `InputSystemUIInputModule` activation. Without this epic, no gameplay is possible: it produces the authoritative `SimulationInput` contract that Simulation Architecture consumes once per 60 Hz tick, and it guarantees the player always has responsive, predictable control regardless of input method.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0005: Input Context Controller and Action Map Inventory | `InputContextController` is the sole owner of action-map activation; two fixed action maps in one `.inputactions` asset; context handoff latching; device switch arbitration | MEDIUM |
| ADR-0004: Settings Persistence and Control Profiles | Control profiles (dead zones, EMA alphas, binding overrides) validated per-field; preview immediate, persist on Apply | LOW |
| ADR-0001: Manual Simulation Authority and Determinism Boundary | `CaptureLatestRawSample()` executes exactly once before accumulator evaluation in the same Simulation `Update()` path; no script-order assumption | HIGH |
| ADR-0010: Camera/VFX Rendering Budget and Interpolation | `CameraToggle` is a presentation-only rising edge routed directly to Camera; never enters `SimulationInput`, tick pipeline, Replay, or Ghost Recording | MEDIUM |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-input-001 | Two action maps exist: OverdriveGameplay (5 actions) and OverdriveUI (6 actions) | ADR-0005 ✅ |
| TR-input-002 | InputContextController is the sole owner of action-map and InputSystemUIInputModule activation | ADR-0005 ✅ |
| TR-input-003 | CameraToggle is presentation-only; never enters SimulationInput, tick pipeline, Replay, or Ghost Recording | ADR-0005, ADR-0010 ✅ |
| TR-input-004 | Reserved bindings: Confirm (Enter/South), Cancel (Escape/East), Pause (Escape/Start) cannot be replaced or removed | ADR-0004, ADR-0005 ✅ |
| TR-input-005 | CaptureLatestRawSample() called once per frame before accumulator in same Simulation driver Update call | ADR-0001, ADR-0005 ✅ |
| TR-input-006 | SimulationInput contract: accelerateOut, brakeOut, steerOut, rawXxxPostDeadZone, pauseEdge, inputAvailability | ADR-0001, ADR-0005 ✅ |
| TR-input-007 | EMA alphas: Accelerate 0.3, Brake 0.3, Steer 0.5; brake priority with EMA freeze | ADR-0004, ADR-0005 ✅ |
| TR-input-008 | Context handoff latching: newly enabled digital latched until neutral; Accelerate/Brake/Steer exempt on UI to Gameplay | ADR-0005 ✅ |
| TR-input-009 | ActiveControlScheme arbitration: KeyboardMouse default, last meaningful device wins | ADR-0005 ✅ |
| TR-input-010 | Mouse is UI-only in MVP; never produces Accelerate, Brake, or Steer | ADR-0005 ✅ |
| TR-input-011 | Gamepad stick uses radial dead-zone normalization with inner 0.15 and outer 0.95; triggers use axial inner 0.05; keyboard is exempt | ADR-0004, ADR-0005 ✅ |
| TR-input-012 | Non-finite raw axes become zero and processed axes are clamped to their legal ranges before EMA | ADR-0005 ✅ |
| TR-input-013 | Binding overrides use stable action and binding GUIDs; an unknown ID invalidates only that override | ADR-0004, ADR-0005 ✅ |
| TR-input-014 | `NoInputDevice` produces zeroed driving input without freezing simulation and recovers when a valid scheme returns | ADR-0001, ADR-0005 ✅ |

**Untraced requirements**: None — 14/14 covered by Accepted ADRs.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/input-system.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`
- Stable action/binding IDs are published as the input contract consumed by Settings (binding overrides), Simulation (capture + tick processor), and the Simulation Kernel's input boundary — per the handoff sequence in the Simulation Kernel epic

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Input Action Asset and Context Controller | Integration | Ready | ADR-0005 |
| 002 | RawInputSample Capture | Integration | Ready | ADR-0001, ADR-0005 |
| 003 | Dead-Zone Normalization | Logic | Ready | ADR-0004, ADR-0005 |
| 004 | EMA Smoothing Engine | Logic | Ready | ADR-0004, ADR-0005 |
| 005 | Brake Priority and EMA Freeze | Logic | Ready | ADR-0005 |
| 006 | SimulationInput Tick Processor | Integration | Ready | ADR-0001, ADR-0005 |
| 007 | ActiveControlScheme Arbitration | Logic | Ready | ADR-0005 |
| 008 | NoInputDevice Handling | Logic | Ready | ADR-0001, ADR-0005 |
| 009 | Context Handoff Latching | Integration | Ready | ADR-0005 |
| 010 | Countdown and Loading Context Transitions | Integration | Ready | ADR-0005, ADR-0001 |
| 011 | CameraToggle Routing | Integration | Ready | ADR-0005, ADR-0010 |
| 012 | Mouse UI Policy | Logic | Ready | ADR-0005 |
| 013 | Settings Listening and Binding Overrides | Integration | Ready | ADR-0004, ADR-0005 |
| 014 | Control Profile Integration and Preview | Integration | Ready | ADR-0004, ADR-0005 |
| 015 | PitService and Finished Presentation Direct Routing | Integration | Ready | ADR-0005 |

**Coverage**: 14/14 TR-input requirements traced; 0 untraced. QL-STORY-READY passed (4 review rounds; all refinements incorporated with GDD/ADR sources). DEFERRED: AC-21/55 (WebGL platform validation), AC-19 (cross-epic Grid & Start integration).

## Next Step

Run `/story-readiness production/epics/input-system/story-001-input-action-asset-context-controller.md` then `/dev-story` to begin implementation. Work through stories in order — each story's `Depends on:` field tells you what must be DONE before you can start it.
