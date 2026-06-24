# Epic: Single Race

> **Layer**: Feature (slot #13 — thin adapter integrating Menu → Race Management)
> **GDD**: design/gdd/single-race.md
> **Architecture Module**: Feature — Mode Adapter
> **Status**: Ready
> **Stories**: 2 stories (Ready) — see Stories section

## Overview

Thin adapter — zero state, zero tick, zero Event Bus subscriptions. `buildConfig()` returns `RaceConfiguration` data object. Passed directly to `RM.init()` (not cached). Fixed grid 8 (player + 7 AI). Difficulty as `number` (0.75–1.25). One-shot lifecycle — each race independent. Zero Babylon.js imports — pure TypeScript.

## Governing ADRs

| ADR                           | Decision Summary                                                       | Engine Risk |
| ----------------------------- | ---------------------------------------------------------------------- | ----------- |
| ADR-0021: Single Race Adapter | buildConfig() → init(), difficulty as number, fixed grid 8, zero state | LOW         |

## GDD Requirements

| TR-ID     | Requirement                                                  | ADR Coverage |
| --------- | ------------------------------------------------------------ | ------------ |
| TR-SR-001 | buildConfig() returns RaceConfiguration from menu selections | ADR-0021 ✅  |
| TR-SR-002 | Pass config to RM.init() — not cached, not stored            | ADR-0021 ✅  |
| TR-SR-003 | Fixed grid 8 player + 7 AI, difficulty as number             | ADR-0021 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/single-race.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Stories

| #   | Story                   | Type        | Status | ADR      |
| --- | ----------------------- | ----------- | ------ | -------- |
| 001 | Build RaceConfiguration | Logic       | Ready  | ADR-0021 |
| 002 | Race Flow Integration   | Integration | Ready  | ADR-0021 |

## Next Step

Run `/story-readiness production/epics/single-race/story-001-build-configuration.md` to begin implementation.
