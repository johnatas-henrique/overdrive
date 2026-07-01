# Epic: Entity/Car Lifecycle

> **Layer**: Core (Infrastructure)
> **GDD**: design/gdd/entity-car-lifecycle.md
> **Architecture Module**: Entity/Car Lifecycle
> **Status**: Complete
> **Stories**: 2 stories (Complete)

## Overview

Manages creation and destruction of all game entities — primarily cars, and in Fase 1 also static track colliders. Owns the `CarEntity` data structure (mesh, physics body, AI driver link) but NOT runtime state. Runtime state lives in respective owner systems indexed by `carId`. Cars are spawned from cached AssetContainer clones at PreRace and destroyed at PostRace. Emits `entity.spawned`/`entity.despawned` events for all downstream systems.

## Governing ADRs

| ADR                         | Decision Summary                                                                | Engine Risk |
| --------------------------- | ------------------------------------------------------------------------------- | ----------- |
| ADR-0005: Entity/Car Lifecycle | CarEntity identity-only, spawnGrid/destroyAll lifecycle, Event Bus integration | LOW         |

## Stories

| #   | Story                          | Type        | Status | ADR      |
| --- | ------------------------------ | ----------- | ------ | -------- |
| 001 | CarEntity Spawn & Lifecycle    | Integration | Ready  | ADR-0005 |
| 002 | Destroy All & GSM Integration  | Integration | Ready  | ADR-0005 |

## GDD Requirements

| TR-ID      | Requirement                                                                           | ADR Coverage |
| ---------- | ------------------------------------------------------------------------------------- | ------------ |
| TR-ECL-001 | CarEntity data structure (id, teamId, gridIndex, mesh, physicsBody, aiDriver)         | ADR-0005 ✅  |
| TR-ECL-002 | spawnGrid(teams, playerTeamId) — clones from AssetContainer, creates PhysicsAggregate | ADR-0005 ✅  |
| TR-ECL-003 | destroyAll() — disposes physics, clears mesh, clears entity map                       | ADR-0005 ✅  |
| TR-ECL-004 | Emit entity.spawned/entity.despawned per car via Event Bus                            | ADR-0005 ✅  |
| TR-ECL-005 | Gate on double-spawn — spawnGrid() while Grid Active throws EntityLifecycleError      | ADR-0005 ✅  |
| TR-ECL-006 | Guard flag during destroyAll() — getEntity() returns null, physics calls no-ops       | ADR-0005 ✅  |
| TR-ECL-007 | Player and AI use identical CarEntity structure — player aiDriver = undefined         | ADR-0005 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/entity-car-lifecycle.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- `spawnGrid()` creates 8 CarEntity objects with unique carIds
- `destroyAll()` cleans up all physics bodies, meshes, and entity map
- `entity.spawned`/`entity.despawned` events fire per car via Event Bus
- `getEntity(carId)` returns valid entities during Grid Active, null after destroyAll

## Next Step

Run `/create-stories entity-car-lifecycle` to break this epic into implementable stories.
