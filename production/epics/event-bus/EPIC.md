# Epic: Event Bus

> **Layer**: Foundation
> **GDD**: design/gdd/event-bus.md
> **Architecture Module**: Foundation — Communication
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories event-bus`

## Overview

Typed pub-sub event system. Events declared as an `EventMap` interface — every event is a property with its payload type. Synchronous dispatch: `emit()` executes all handlers on the same call stack. `on()`/`once()` return `Subscription` with `unsubscribe()`. Leak detector warns on `dispose()` if subscriptions remain. Max emit depth (default 10) to catch circular chains. Zero external dependencies — pure TypeScript, ~150 lines.

## Governing ADRs

| ADR                              | Decision Summary                                                                      | Engine Risk |
| -------------------------------- | ------------------------------------------------------------------------------------- | ----------- |
| ADR-0001: Event Bus Architecture | Typed EventMap, synchronous dispatch, Subscription pattern, leak detection, zero deps | LOW         |

## GDD Requirements

| TR-ID      | Requirement                                                         | ADR Coverage |
| ---------- | ------------------------------------------------------------------- | ------------ |
| TR-EVB-001 | Typed EventMap interface — compile-time checked emit()/on()         | ADR-0001 ✅  |
| TR-EVB-002 | Synchronous dispatch; handler errors caught individually            | ADR-0001 ✅  |
| TR-EVB-003 | Single payload per event (exactly one argument)                     | ADR-0001 ✅  |
| TR-EVB-004 | on() returns Subscription with .unsubscribe(); leak detector        | ADR-0001 ✅  |
| TR-EVB-005 | Circular emit depth detection (configurable, default 10)            | ADR-0001 ✅  |
| TR-EVB-006 | once() fires then auto-unsubscribes; off() removes specific handler | ADR-0001 ✅  |
| TR-EVB-007 | Subscribe during dispatch does not receive current event            | ADR-0001 ✅  |
| TR-EVB-008 | Zero dependencies on Babylon.js or any game system                  | ADR-0001 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/event-bus.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories event-bus` to break this epic into implementable stories.
