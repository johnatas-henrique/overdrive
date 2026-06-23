# Epic: Persistence Interface

> **Layer**: Foundation
> **GDD**: design/gdd/persistence.md
> **Architecture Module**: Foundation — Data/Storage
> **Status**: Stories Ready — 5 stories created on 2026-06-22
> **Stories**: 5 stories — run `/story-readiness` to begin implementation

## Overview

Async-first localStorage wrapper. Payload versioned as `{ version, data, timestamp }` with migration chain (`registerMigration(from, to, fn)`). Degraded mode: when storage unavailable, writes queue in memory (max 50 entries, FIFO discard), reads return `null`. Error isolation per key — corrupted key never affects others. Global `'overdrive_'` key prefix. State machine: Uninitialized → Ready → Degraded.

## Governing ADRs

| ADR                   | Decision Summary                                               | Engine Risk |
| --------------------- | -------------------------------------------------------------- | ----------- |
| ADR-0016: Persistence | Async-first, versioned payload, degraded mode, error isolation | LOW         |

## GDD Requirements

| TR-ID      | Requirement                                                      | ADR Coverage |
| ---------- | ---------------------------------------------------------------- | ------------ |
| TR-PER-001 | Async-first API — save/load return Promise\<T\>                  | ADR-0016 ✅  |
| TR-PER-002 | Versioned payload: { version, data, timestamp }; migration chain | ADR-0016 ✅  |
| TR-PER-003 | Global key prefix 'overdrive\_' prepended to all storage keys    | ADR-0016 ✅  |
| TR-PER-004 | Storage state machine: Uninitialized → Ready → Degraded          | ADR-0016 ✅  |
| TR-PER-005 | Error isolation — corrupted key returns null, others unaffected  | ADR-0016 ✅  |
| TR-PER-006 | Degraded mode: in-memory queue (50 max), retry() re-probes       | ADR-0016 ✅  |
| TR-PER-007 | Migration chain via registerMigration(from, to, fn)              | ADR-0016 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/persistence.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Stories

| #   | Story                          | Type        | Status | ADR      |
| --- | ------------------------------ | ----------- | ------ | -------- |
| 001 | persistence-state-machine-init | Logic       | Ready  | ADR-0016 |
| 002 | save-load-key-prefix           | Integration | Ready  | ADR-0016 |
| 003 | error-isolation                | Integration | Ready  | ADR-0016 |
| 004 | degraded-mode-retry            | Logic       | Ready  | ADR-0016 |
| 005 | migration-chain                | Logic       | Ready  | ADR-0016 |

## Next Step

Run `/story-readiness production/epics/persistence/story-001-persistence-state-machine-init.md` to begin implementation.
