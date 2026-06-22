# Epic: Race Management (Core)

> **Layer**: Core (slot #11 — state machine, lap counting, position tracking)
> **GDD**: design/gdd/race-management.md
> **Architecture Module**: Core — Race Flow
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories race-management-core`

## Overview

Sub-state machine under GSM Racing: Countdown → GreenFlag → Racing → Checkered. Lap detection via spline wrap-around — `prevPos > 0.9 × trackLength AND currentPos < 0.1 × trackLength` (backwards crossing does NOT increment). Position tracking with hysteresis — `position.changed` only emitted if distance delta > `hysteresisThreshold` (0.5m) sustained for 3 ticks. Grid ordering. Countdown sequence (5 lights → green flag). Reentrant `init()` — `eventBus.off().on()` prevents listener duplication on Race Again.

## Governing ADRs

| ADR                       | Decision Summary                                                                        | Engine Risk |
| ------------------------- | --------------------------------------------------------------------------------------- | ----------- |
| ADR-0015: Race Management | Sub-state under GSM, lap detection via spline wrap, position hysteresis, reentrant init | LOW         |

## GDD Requirements

| TR-ID     | Requirement                                                                | ADR Coverage |
| --------- | -------------------------------------------------------------------------- | ------------ |
| TR-RM-001 | Race state machine: Countdown → GreenFlag → Racing → Checkered             | ADR-0015 ✅  |
| TR-RM-002 | Countdown sequence: 5 lights → green flag with RaceManagement timer        | ADR-0015 ✅  |
| TR-RM-003 | Lap detection via spline wrap-around (prevPos > 0.9, currentPos < 0.1)     | ADR-0015 ✅  |
| TR-RM-004 | Position tracking sorted by total distance, updated each tick              | ADR-0015 ✅  |
| TR-RM-005 | Position hysteresis: distance delta + 3-tick sustain                       | ADR-0015 ✅  |
| TR-RM-006 | Grid ordering based on qualifying/starting grid                            | ADR-0015 ✅  |
| TR-RM-007 | Emit race.starting, race.green.flag, race.completed, race.checkered events | ADR-0015 ✅  |
| TR-RM-008 | Reentrant init() — eventBus.off().on() prevents duplicate listeners        | ADR-0015 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/race-management.md` (Core section) are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories race-management-core` to break this epic into implementable stories.
