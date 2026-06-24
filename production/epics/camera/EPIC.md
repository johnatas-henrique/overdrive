# Epic: Camera

> **Layer**: Core (slot #2 — depends on Physics for telemetry, renders what player sees)
> **GDD**: design/gdd/camera.md
> **Architecture Module**: Core — Camera
> **Status**: Stories Ready
> **Stories**: 10 stories — run `/story-readiness production/epics/camera/story-001-camera-foundation.md` to begin implementation

## Overview

Three camera types: FreeCamera (cockpit/grid), FollowCamera (chase), ArcRotateCamera (drone). Built-in camera input system disabled via `camera.inputs.clear()` + `camera.inertia = 0`. Reactive to `gsm.state.entered` events only — never initiates GSM transitions. Speed-dependent FOV widening. Additive shake from collision impacts with exponential decay. Cockpit parented to `driver_eye` TransformNode on car mesh. Chase occlusion raycast. Drone auto-orbits player post-race.

## Governing ADRs

| ADR                           | Decision Summary                                            | Engine Risk |
| ----------------------------- | ----------------------------------------------------------- | ----------- |
| ADR-0007: Camera Architecture | 3 camera types, camera.inputs.clear(), reactive to GSM only | LOW         |

## Stories

| #   | Story                | Type        | Status | ADR      |
| --- | -------------------- | ----------- | ------ | -------- |
| 001 | Camera Foundation    | Integration | Ready  | ADR-0007 |
| 002 | GSM Camera Lifecycle | Integration | Ready  | ADR-0007 |
| 003 | Cockpit Camera       | Integration | Ready  | ADR-0007 |
| 004 | Chase + Occlusion    | Integration | Ready  | ADR-0007 |
| 005 | Instant Toggle       | Logic       | Ready  | ADR-0007 |
| 006 | Speed-Dependent FOV  | Logic       | Ready  | ADR-0007 |
| 007 | Camera Shake System  | Logic       | Ready  | ADR-0007 |
| 008 | Drone Auto-Orbit     | Integration | Ready  | ADR-0007 |
| 009 | Head Bob + Lean      | Visual/Feel | Ready  | ADR-0007 |
| 010 | Camera Config HMR    | Config/Data | Ready  | ADR-0007 |

## GDD Requirements

| TR-ID      | Requirement                                                                     | ADR Coverage |
| ---------- | ------------------------------------------------------------------------------- | ------------ |
| TR-CAM-001 | Three modes: Grid (FreeCamera), Racing (cockpit/chase), Drone (ArcRotateCamera) | ADR-0007 ✅  |
| TR-CAM-002 | Instant toggle cockpit ↔ chase (no lerp) on cameraToggle pulse                  | ADR-0007 ✅  |
| TR-CAM-003 | Speed-dependent FOV: baseFOV + speedFactor × speed_kmh, clamped                 | ADR-0007 ✅  |
| TR-CAM-004 | Additive shake with exponential decay from collision.impact                     | ADR-0007 ✅  |
| TR-CAM-005 | Chase occlusion raycast — snap closer, lerp back when clear                     | ADR-0007 ✅  |
| TR-CAM-006 | Cockpit parented to driver_eye TransformNode                                    | ADR-0007 ✅  |
| TR-CAM-007 | GSM event reactive — Grid/PreRace → Racing → PostRace camera switching          | ADR-0007 ✅  |
| TR-CAM-008 | Built-in camera inputs disabled via camera.inputs.clear()                       | ADR-0007 ✅  |
| TR-CAM-009 | Head bob + lateral lean in cockpit (cosmetic only)                              | ADR-0007 ✅  |
| TR-CAM-010 | Drone auto-orbits player car post-race (no user input)                          | ADR-0007 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/camera.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/story-readiness production/epics/camera/story-001-camera-foundation.md` to begin implementation. Stories should be worked in dependency order (001 → 002-010 as per their `Depends on` fields).
