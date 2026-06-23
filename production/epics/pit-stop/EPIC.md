# Epic: Pit Stop

> **Layer**: Core (slot #10 — depends on Fuel, Tire, RM, Physics)
> **GDD**: design/gdd/pit-stop.md
> **Architecture Module**: Core — Pit Stop
> **Status**: Ready
> **Stories**: 8 stories (Ready)

## Overview

Velocity-driven pit stop system (no position override — would oscillate with Physics velocity snap). Per-car state machine: onTrack → pitEntry → pitStopped → departing → onTrack. Spline guidance speed-limited to `pitSpeedLimit` (80 km/h). Tire change is binary (complete swap, fixed delay). Refuel is progressive (liquid filling). `confirm` event gatekept — only handled when `pitState === 'pitStopped'`. AI never exits early (waits for both fuel AND tires). Merge check config-driven (`mergeCheckDistance`, `forceMergeTimeout`). `playerCarId` stored from RaceConfiguration.

## Governing ADRs

| ADR                     | Decision Summary                                                               | Engine Risk |
| ----------------------- | ------------------------------------------------------------------------------ | ----------- |
| ADR-0014: Pit Stop Flow | Velocity-driven guidance, per-car FSM, binary tire, progressive fuel, AI waits | MEDIUM      |

## GDD Requirements

| TR-ID      | Requirement                                                                  | ADR Coverage |
| ---------- | ---------------------------------------------------------------------------- | ------------ |
| TR-PIT-001 | Per-car state machine: onTrack → pitEntry → pitStopped → departing → onTrack | ADR-0014 ✅  |
| TR-PIT-002 | Pit entry detection via Track zone query (BoundingBox)                       | ADR-0014 ✅  |
| TR-PIT-003 | Spline guidance to assigned pit box with speed limit enforcement             | ADR-0014 ✅  |
| TR-PIT-004 | Refuel (progressive) + tire change (binary, complete swap)                   | ADR-0014 ✅  |
| TR-PIT-005 | Confirm gatekept — only handled when pitState === 'pitStopped'               | ADR-0014 ✅  |
| TR-PIT-006 | AI waits for both services complete before departing                         | ADR-0014 ✅  |
| TR-PIT-007 | Merge check at garage exit (config-driven distance/timeout)                  | ADR-0014 ✅  |
| TR-PIT-008 | Pit stop timer per car for HUD display                                       | ADR-0014 ✅  |

## Stories

| #   | Story                               | Type               | Status | ADR      |
| --- | ----------------------------------- | ------------------ | ------ | -------- |
| 001 | Pit State Machine & Zone Detection  | Logic              | Ready  | ADR-0014 |
| 002 | Pit Entry Guidance & Garage Stop    | Integration        | Ready  | ADR-0014 |
| 003 | Refuel & Tire Change Services       | Integration        | Ready  | ADR-0014 |
| 004 | Confirm Gatekeeping & Auto-Release  | Logic              | Ready  | ADR-0014 |
| 005 | Pit Exit, Merge Check & Return      | Logic              | Ready  | ADR-0014 |
| 006 | AI Pit Strategy                     | Logic              | Ready  | ADR-0014 |
| 007 | Race Management Pit Timer           | Integration        | Ready  | ADR-0014 |
| 008 | Documentation & Visual Verification | Config/Data+Visual | Ready  | ADR-0014 |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/pit-stop.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/story-readiness production/epics/pit-stop/story-001-pit-state-machine.md` → `/dev-story` to begin implementation.
