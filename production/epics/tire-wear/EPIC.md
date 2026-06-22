# Epic: Tire Wear

> **Layer**: Core (slot #9 — writes tireCondition to Physics with 1-tick delay)
> **GDD**: design/gdd/tire-wear.md
> **Architecture Module**: Core — Strategy/Tire
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories tire-wear`

## Overview

Tire degradation model: `wear = lateralG × latFactor + accelG × accelFactor + brakeG × brakeFactor`. Off-track driving applies 2.0× wear multiplier. Single health pool per car (all 4 wheels aggregated, not individual tires). Binary tire change in Pit Stop — complete swap via `resetTires()`, never partial. Emits `car.tire_blown` (one-shot with guard). `tireCondition` written to Physics with 1-tick delay.

## Governing ADRs

| ADR                  | Decision Summary                                                 | Engine Risk |
| -------------------- | ---------------------------------------------------------------- | ----------- |
| ADR-0012: Tire Model | 3-axis wear, single pool, binary change, 1-tick delay to Physics | LOW         |

## GDD Requirements

| TR-ID       | Requirement                                                                              | ADR Coverage |
| ----------- | ---------------------------------------------------------------------------------------- | ------------ |
| TR-TIRE-001 | Tire degradation from lateralG × latFactor + accelG × accelFactor + brakeG × brakeFactor | ADR-0012 ✅  |
| TR-TIRE-002 | Off-track = 2.0× wear multiplier                                                         | ADR-0012 ✅  |
| TR-TIRE-003 | Single health pool per car (4 wheels aggregated)                                         | ADR-0012 ✅  |
| TR-TIRE-004 | tireCondition (0..1) written to Physics, 1-tick delay                                    | ADR-0012 ✅  |
| TR-TIRE-005 | Binary tire change — complete swap, never partial                                        | ADR-0012 ✅  |
| TR-TIRE-006 | resetTires() restores condition to 1.0 after tireChangeDelay                             | ADR-0012 ✅  |
| TR-TIRE-007 | car.tire_blown one-shot, guard prevents re-emission                                      | ADR-0012 ✅  |
| TR-TIRE-008 | Tire durability stat configurable per team                                               | ADR-0012 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/tire-wear.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories tire-wear` to break this epic into implementable stories.
