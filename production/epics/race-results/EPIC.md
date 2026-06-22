# Epic: Race Results

> **Layer**: Core (slot #12 — DNF, results aggregation, post-race flow — completes race management)
> **GDD**: design/gdd/race-management.md
> **Architecture Module**: Core — Race Flow
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories race-results`

## Overview

DNF lifecycle: `car.fuel_empty` → RM marks `pendingDNF[carId]` → guards verify (pit entry zone → no DNF, pitStopped clears pending, finish line crossing → no DNF) → `car.stopped` on track → DNF registered. Three race-end conditions: (1) player completes N laps, (2) penultimate car ahead finishes (immediate Checkered), (3) leader finishes + player ≥1 lap behind (player finishes current lap). Sector timing, results aggregation, post-race flow. `buildResults()` returns `RaceEvent[]` sorted by distance (position ordering for multi-DNF scenarios). Tiebreaker: `gridPosition` at finish line (F1 convention — player never triggers it in practice).

## Governing ADRs

| ADR                       | Decision Summary                                                               | Engine Risk |
| ------------------------- | ------------------------------------------------------------------------------ | ----------- |
| ADR-0015: Race Management | DNF lifecycle, 3 race-end conditions, position tiebreaker, results aggregation | LOW         |

## GDD Requirements

| TR-ID     | Requirement                                                      | ADR Coverage |
| --------- | ---------------------------------------------------------------- | ------------ |
| TR-RM-009 | DNF lifecycle — fuel_empty → pendingDNF → guards → DNF           | ADR-0015 ✅  |
| TR-RM-010 | Three race-end conditions: laps complete, last place, lap behind | ADR-0015 ✅  |
| TR-RM-011 | buildResults() returns sorted RaceEvent[] by distance            | ADR-0015 ✅  |
| TR-RM-012 | Position tiebreaker: gridPosition at finish line                 | ADR-0015 ✅  |
| TR-RM-013 | Sector timing and results for post-race screen                   | ADR-0015 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/race-management.md` (Results section) are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories race-results` to break this epic into implementable stories.
