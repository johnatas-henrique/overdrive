# Epic: Simulation Snapshot

> **Layer**: Foundation
> **GDD**: design/gdd/simulation-snapshot.md
> **Architecture Module**: Foundation — State
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories simulation-snapshot`

## Overview

`ISnapshotable` interface for systems with mutable race state: `systemId`, `serialize()`, `deserialize()`, `hash()`. Two-tier hashing: FNV-1a 64-bit for tick-level consistency checks (~50ns), SHA-256 via Web Crypto API for network sync/save integrity (~1µs). JSON format in MVP (human-readable, debuggable). Full snapshots only — delta compression deferred to multiplayer. Systems implement: Physics, Fuel, Tire, AI Driver, Race Management. Collision excluded (event-only, no state).

## Governing ADRs

| ADR                           | Decision Summary                                                            | Engine Risk |
| ----------------------------- | --------------------------------------------------------------------------- | ----------- |
| ADR-0017: Simulation Snapshot | ISnapshotable interface, FNV-1a + SHA-256, JSON format, full snapshots only | LOW         |

## GDD Requirements

| TR-ID      | Requirement                                                         | ADR Coverage |
| ---------- | ------------------------------------------------------------------- | ------------ |
| TR-SSN-001 | ISnapshotable interface: serialize, deserialize, hash               | ADR-0017 ✅  |
| TR-SSN-002 | Registration via SimulationSnapshot.register() with unique systemId | ADR-0017 ✅  |
| TR-SSN-003 | Configurable snapshot frequency: every tick, Nth tick, or on-demand | ADR-0017 ✅  |
| TR-SSN-004 | Two-tier hashing: FNV-1a 64-bit + SHA-256 via Web Crypto API        | ADR-0017 ✅  |
| TR-SSN-005 | JSON format in MVP; delta compression path documented               | ADR-0017 ✅  |
| TR-SSN-006 | Error isolation on restore — per-system failure caught and skipped  | ADR-0017 ✅  |
| TR-SSN-007 | Caller responsible for snapshot timing at fixed game loop points    | ADR-0017 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/simulation-snapshot.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories simulation-snapshot` to break this epic into implementable stories.
