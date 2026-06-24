# Epic: Collision

> **Layer**: Core (slot #6 — event-only system, feeds HUD/Camera/Audio/AI)
> **GDD**: design/gdd/collision.md
> **Architecture Module**: Core — Collision
> **Status**: Stories Ready
> **Stories**: 4 stories (Ready)

## Overview

Event-only collision system — no `update()`, no pipeline slot. Subscribes to `havokPlugin.onCollisionObservable` (NOT `collisionEndedObservable` — no impulse data). Three collision groups via `PhysicsBody.setCollisionGroup()/setCollisionMask()`: car (bit 0), barrier/track (bit 1), environment (bit 2). Emits `collision.impact` with `{ carId, otherId, impulse, relativeSpeed, type }`. Minimum impulse threshold. Barrier scrape suppression within `grazeSuppressFrames`. Barrier detection via `Set<PhysicsBody>` (registerBarrier). Reentrant registration (`off()` before `on()`).

## Governing ADRs

| ADR                       | Decision Summary                                                        | Engine Risk |
| ------------------------- | ----------------------------------------------------------------------- | ----------- |
| ADR-0010: Collision Model | onCollisionObservable, 3 collision groups, barrier register, event-only | LOW         |

## GDD Requirements

| TR-ID            | Requirement                                                               | ADR Coverage |
| ---------------- | ------------------------------------------------------------------------- | ------------ |
| TR-COLLISION-001 | onCollisionObservable per body — emits collision.impact with impulse      | ADR-0010 ✅  |
| TR-COLLISION-002 | Three collision groups: car, barrier/track, environment                   | ADR-0010 ✅  |
| TR-COLLISION-003 | collision.impact payload: carId, otherId, impulse, relativeSpeed, type    | ADR-0010 ✅  |
| TR-COLLISION-004 | Minimum impulse threshold — below threshold does not emit                 | ADR-0010 ✅  |
| TR-COLLISION-005 | No update() — event-only, subscribes at PreRace                           | ADR-0010 ✅  |
| TR-COLLISION-006 | collisionEndedObservable tracked per body for contact-end detection       | ADR-0010 ✅  |
| TR-COLLISION-007 | Event Bus emission for HUD (flash), Camera (shake), Audio (thud), AI      | ADR-0010 ✅  |
| TR-COLLISION-008 | Car-car vs car-barrier distinguished by otherId prefix (car* vs barrier*) | ADR-0010 ✅  |
| TR-COLLISION-009 | Reentrant registration — off() before on() for Race Again                 | ADR-0010 ✅  |

## Stories

| #   | Story                                    | Type        | Status | ADR      |
| --- | ---------------------------------------- | ----------- | ------ | -------- |
| 001 | Core Collision Manager                   | Logic       | Ready  | ADR-0010 |
| 002 | Barrier Detection & Event Classification | Logic       | Ready  | ADR-0010 |
| 003 | Impulse Threshold & Grazing Suppression  | Logic       | Ready  | ADR-0010 |
| 004 | GSM Lifecycle & Event Bus Integration    | Integration | Ready  | ADR-0010 |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/collision.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/story-readiness production/epics/collision/story-001-core-collision-manager.md` to begin implementation.
