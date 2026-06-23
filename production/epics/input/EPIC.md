# Epic: Input

> **Layer**: Core (slot #1 — Input must be ready before Physics)
> **GDD**: design/gdd/input.md
> **Architecture Module**: Core — Input
> **Status**: Stories Ready
> **Stories**: 7 stories — run `/story-readiness production/epics/input/story-001-input-interface-types.md` to begin

## Overview

Polling-based input system reading keyboard and gamepad each tick. `IInput.getState(): InputState` returns `{ steer, throttle, brake, gearDelta, confirm, pauseToggle, cameraToggle, cancel, navUp, navDown }`. `DeviceSourceManager` + `GamepadManager` wrappers. Dead zone formula with per-axis threshold. Gamepad takes priority for analog axes. Tab blur zeros all outputs. GSM local copy via Event Bus subscription (never calls `gsm.getCurrent()`). AI Driver writes to separate pipeline slot #3 (not IInput).

## Governing ADRs

| ADR                         | Decision Summary                                                  | Engine Risk |
| --------------------------- | ----------------------------------------------------------------- | ----------- |
| ADR-0006: Input Abstraction | DSM + GamepadManager wrappers, polling per tick, IInput interface | MEDIUM      |

## GDD Requirements

| TR-ID      | Requirement                                                                                                | ADR Coverage |
| ---------- | ---------------------------------------------------------------------------------------------------------- | ------------ |
| TR-INP-001 | IInput interface with getState(): InputState (steer, throttle, brake, gearDelta, etc.)                     | ADR-0006 ✅  |
| TR-INP-002 | DeviceSourceManager + GamepadManager, polled per tick                                                      | ADR-0006 ✅  |
| TR-INP-003 | Dead zone formula: output = \|raw\| \< threshold ? 0 : sign(raw) × (\|raw\| - threshold) / (1 - threshold) | ADR-0006 ✅  |
| TR-INP-004 | Gamepad priority over keyboard for analog axes                                                             | ADR-0006 ✅  |
| TR-INP-005 | Tab blur zeros all outputs; resume live state on focus                                                     | ADR-0006 ✅  |
| TR-INP-006 | GSM via Event Bus subscription — local copy, never gsm.getCurrent()                                        | ADR-0006 ✅  |
| TR-INP-007 | Camera toggle debounced at input.cameraDebounce ms                                                         | ADR-0006 ✅  |
| TR-INP-008 | onDeviceChanged observable for HUD hints                                                                   | ADR-0006 ✅  |
| TR-INP-009 | Gamepad disconnect → zeroed axes; keyboard remains active                                                  | ADR-0006 ✅  |
| TR-INP-010 | AI Driver exposes same InputState format (not IInput)                                                      | ADR-0006 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/input.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Stories

| #   | Story                               | Type        | Status | ADR      |
| --- | ----------------------------------- | ----------- | ------ | -------- |
| 001 | IInput Interface + InputState Types | Logic       | Ready  | ADR-0006 |
| 002 | Dead Zone Formula                   | Logic       | Ready  | ADR-0006 |
| 003 | PlayerInput Polling Loop            | Integration | Ready  | ADR-0006 |
| 004 | Tab Blur + Disconnect Safety        | Integration | Ready  | ADR-0006 |
| 005 | GSM State Integration               | Integration | Ready  | ADR-0006 |
| 006 | Debounce + Digital Edge Cases       | Logic       | Ready  | ADR-0006 |
| 007 | Device Detection + Observable       | Integration | Ready  | ADR-0006 |

Work through stories in order — each story's `Depends on:` field tells you what must be DONE before you can start it.

## Next Step

Run `story-readiness production/epics/input/story-001-input-interface-types.md` to begin implementing the first Input story.
