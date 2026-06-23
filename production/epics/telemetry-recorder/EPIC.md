# Epic: Telemetry Recorder

> **Layer**: Core (slot #0 — debug infrastructure, parallel with Physics)
> **GDD**: design/gdd/telemetry-recorder.md
> **Architecture Module**: Dev Infra — Telemetry
> **Status**: Ready
> **Stories**: 6 stories (Ready)

## Overview

Dev-only telemetry capture. Sampling at 20 Hz (every 3 ticks at 60 fps). Reads directly from Physics, Fuel, Tire, AI Driver, Race Management via CarEntity. console.log every 5s during Racing. Export via Dev Tools F3 button + `window.__telemetry.export()` (returns JSON string). All behind `__DEV__` guard — zero bytes in production. Zero Babylon.js imports.

## Governing ADRs

| ADR                          | Decision Summary                                                | Engine Risk |
| ---------------------------- | --------------------------------------------------------------- | ----------- |
| ADR-0022: Telemetry Recorder | Dev-only, 20Hz, direct reads, JSON export, zero production cost | LOW         |

## GDD Requirements

| TR-ID      | Requirement                                                                 | ADR Coverage |
| ---------- | --------------------------------------------------------------------------- | ------------ |
| TR-TEL-001 | Telemetry capture at 20 Hz (every 3 ticks)                                  | ADR-0022 ✅  |
| TR-TEL-002 | Records player and AI driver input, speed, position, fuel, tire, collisions | ADR-0022 ✅  |
| TR-TEL-003 | In-memory ring buffer, capped per race session                              | ADR-0022 ✅  |
| TR-TEL-004 | JSON export — F3 trigger + window.\_\_telemetry.export()                    | ADR-0022 ✅  |
| TR-TEL-005 | Entirely tree-shaken behind **DEV** guard                                   | ADR-0022 ✅  |

## Stories

| #   | Story                          | Type        | Status | ADR      |
| --- | ------------------------------ | ----------- | ------ | -------- |
| 001 | Telemetry Data Model & Storage | Logic       | Ready  | ADR-0022 |
| 002 | 20Hz Sampling Loop             | Logic       | Ready  | ADR-0022 |
| 003 | Console Summary Log            | Logic       | Ready  | ADR-0022 |
| 004 | JSON Export                    | Logic       | Ready  | ADR-0022 |
| 005 | Race Lifecycle Integration     | Integration | Ready  | ADR-0022 |
| 006 | Production No-op Behavior      | Logic       | Ready  | ADR-0022 |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/telemetry-recorder.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- Bundle analysis CI task confirms zero bytes of Telemetry Recorder in production build (`dist/`)
- All `__DEV__` guards confirmed present across all 6 story implementations

## Next Step

Run `/story-readiness production/epics/telemetry-recorder/story-001-telemetry-data-model.md` to begin implementation.
