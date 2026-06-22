# Epic: Telemetry Recorder

> **Layer**: Core (slot #0 — debug infrastructure, parallel with Physics)
> **GDD**: design/gdd/telemetry-recorder.md
> **Architecture Module**: Dev Infra — Telemetry
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories telemetry-recorder`

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

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/telemetry-recorder.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories telemetry-recorder` to break this epic into implementable stories.
