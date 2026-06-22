# Epic: Game State Machine

> **Layer**: Foundation
> **GDD**: design/gdd/game-state-machine.md
> **Architecture Module**: Foundation — Orchestration
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories game-state-machine`

## Overview

Flat finite state machine governing application-level states: Loading → Menu → PreRace → Racing → PostRace → Menu (loop). Transition table as `Record<State, State[]>`. Async `onEnter`/`onExit` hooks with rollback on failure. Max 1 transition per tick. Emits two Event Bus events per transition (`gsm.state.exited` + `gsm.state.entered`). No system calls `gsm.getCurrent()` — all consumers react to events. 20-entry ring buffer of last transitions for debug.

## Governing ADRs

| ADR                          | Decision Summary                                                                | Engine Risk |
| ---------------------------- | ------------------------------------------------------------------------------- | ----------- |
| ADR-0024: Game State Machine | Flat FSM, max 1 transition/tick, Event Bus emissions, async hooks with rollback | LOW         |

## GDD Requirements

| TR-ID      | Requirement                                                                     | ADR Coverage |
| ---------- | ------------------------------------------------------------------------------- | ------------ |
| TR-GSM-001 | Transition table Record\<State, State[]\>; invalid throws GameStateError        | ADR-0024 ✅  |
| TR-GSM-002 | Per-state onEnter/onExit hooks, async with rollback                             | ADR-0024 ✅  |
| TR-GSM-003 | Two Event Bus events per transition: exited then entered                        | ADR-0024 ✅  |
| TR-GSM-004 | Max 1 transition per tick; subsequent calls queued                              | ADR-0024 ✅  |
| TR-GSM-005 | 20-entry ring buffer of last transitions                                        | ADR-0024 ✅  |
| TR-GSM-006 | Async onEnter() rejection rolls back to previous state                          | ADR-0024 ✅  |
| TR-GSM-007 | Event Bus unavailable during transition: state change completes, warning logged | ADR-0024 ✅  |
| TR-GSM-008 | Dispose mid-transition: runs onExit of source, skips onEnter of target          | ADR-0024 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/game-state-machine.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories game-state-machine` to break this epic into implementable stories.
