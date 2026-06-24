# Epic: Data & Config Manager

> **Layer**: Foundation
> **GDD**: design/gdd/data-config-manager.md
> **Architecture Module**: Foundation — Data/Config
> **Status**: Ready
> **Stories**: 5 created — see table below

## Stories

| #    | Story                                   | Type        | Status | ADR      |
| ---- | --------------------------------------- | ----------- | ------ | -------- |
| 001  | Core Register + Get + Error Handling    | Logic       | Ready  | ADR-0023 |
| 002  | Environment Variable Override           | Logic       | Ready  | ADR-0023 |
| 003a | HMR Cache Handler (invalidateNamespace) | Logic       | Ready  | ADR-0023 |
| 003b | HMR Vite Wiring                         | Integration | Ready  | ADR-0023 |
| 004  | Access Logging + Debug State            | Logic       | Ready  | ADR-0023 |

## Overview

Central typed configuration system. Every system registers its own config namespace during init. Reads go through `get<T>(key)` which throws `ConfigError` on missing keys. Supports environment variable override (`OVERDRIVE__NS__KEY`), HMR per-namespace invalidation, and a 500-entry access logging ring buffer for debug. Foundation Phase 0 — must init before any other system.

## Governing ADRs

| ADR                             | Decision Summary                                                                                                              | Engine Risk |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------- |
| ADR-0023: Data & Config Manager | Manual per-system register(), get\<T\>(key) throws ConfigError, env override OVERDRIVE\_\_ prefix, HMR namespace invalidation | LOW         |

## GDD Requirements

| TR-ID      | Requirement                                                                    | ADR Coverage |
| ---------- | ------------------------------------------------------------------------------ | ------------ |
| TR-DCM-001 | Typed get\<T\>(key: string): T throws ConfigError on missing keys              | ADR-0023 ✅  |
| TR-DCM-002 | register(namespace, config) with unique namespace enforcement                  | ADR-0023 ✅  |
| TR-DCM-003 | Environment variable override: OVERDRIVE\_\_, double underscore path separator | ADR-0023 ✅  |
| TR-DCM-004 | Per-namespace HMR invalidation on Vite hot-reload                              | ADR-0023 ✅  |
| TR-DCM-005 | 500-entry access logging ring buffer                                           | ADR-0023 ✅  |
| TR-DCM-006 | getDebugState() for read-only debug overlay                                    | ADR-0023 ✅  |
| TR-DCM-007 | Init before any dependent system; cross-config init race detection             | ADR-0023 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/data-config-manager.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories data-config-manager` to break this epic into implementable stories.
