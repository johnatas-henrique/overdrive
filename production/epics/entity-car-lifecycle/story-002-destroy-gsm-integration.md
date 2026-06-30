# Story 002: Destroy All & GSM Integration

> **Epic**: Entity/Car Lifecycle
> **Status**: Complete
> **Layer**: Core
> **Type**: Integration
> **Estimate**: 5-7h
> **Manifest Version**: 2026-06-21
> **Last Updated**: 2026-06-30

## Context

**GDD**: `design/gdd/entity-car-lifecycle.md`
**Requirement**: `TR-ECL-003`, `TR-ECL-004`

- **TR-ECL-003**: destroyAll() disposes all physics bodies, returns meshes to AssetContainer cache, clears entity map; getEntity() returns null post-destroy
- **TR-ECL-004**: Emit entity.despawned per car via Event Bus

**ADR Governing Implementation**: ADR-0005: Entity/Car Lifecycle & State Ownership
**ADR Decision Summary**: destroyAll() disposes physics bodies BEFORE mesh entries (prevents dangling Havok references). Reverse iteration. Guard flag prevents concurrent access. State machine: Grid Active → Idle.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW

**Control Manifest Rules (this layer)**:

- Entity/Car Lifecycle is in Core layer, depends on Asset Manager and Event Bus
- GSM subscription: spawnGrid on PreRace, destroyAll on PostRace

**Performance Budget**: destroyAll() disposes 8 physics bodies + 8 mesh entries at PostRace ≈ 1-2ms total (one-time). Zero per-frame cost. Per ADR-0005 performance analysis.

---

## Acceptance Criteria

_From GDD `design/gdd/entity-car-lifecycle.md`, scoped to this story:_

- [ ] **AC-5**: `destroyAll()` — all physics bodies disposed, all meshes removed from scene, `'entity.despawned'` emitted per car, entity map cleared.
- [ ] **AC-6**: `getEntity('player')` after `destroyAll()` returns `null`.
- [ ] **AC-8**: Fuel system initializes its per-car state map on each `'entity.spawned'` — player and AI alike. _(Note: this AC verifies the event is received, not the Fuel implementation)_
- [ ] **GSM-1**: On `gsm.state.entered(PreRace)`, `spawnGrid()` is called automatically.
- [ ] **GSM-2**: On `gsm.state.entered(PostRace)`, `destroyAll()` is called automatically.
- [ ] **IDEMPOTENT**: `destroyAll()` called twice is a no-op (no errors, no double-dispose).

---

## Implementation Notes

_Derived from ADR-0005 Implementation Guidelines:_

### Cleanup Flow

```
destroyAll():
  1. Set guard flag (getEntity() returns null)
  2. For each car in reverse order:
     a. Emit event 'entity.despawned'(carId)
     b. Dispose physics: entity.physicsBody?.dispose()
  3. Clear activeBodies[]
  4. Dispose all mesh entries: entries.forEach(e => e.dispose())
  5. Clear entries[]
  6. Clear entity map
  7. Remove guard flag
  8. Transition to Idle
```

Physics bodies disposed BEFORE mesh entries — prevents dangling Havok references. Reverse iteration ensures no dependency cascade.

### GSM Integration

```
On gsm.state.entered('PreRace'):
  - Call spawnGrid(teams, playerTeamId) with grid config from caller

On gsm.state.entered('PostRace'):
  - Call destroyAll() to clean up all entities
```

### Key Rules

- destroyAll() is idempotent — second call is no-op
- Guard flag prevents concurrent access during destroy
- Physics body dispose before mesh dispose prevents Havok dangling references
- State machine: Grid Active → Idle after destroyAll()

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 001: CarEntity types, spawnGrid(), entity.spawned events
- Fuel/Tire/AI state cleanup — those systems subscribe to entity.despawned independently

---

## QA Test Cases

_Written by qa-lead at story creation:_

- **AC-5** (destroyAll cleanup):
  - Given: EntityLifecycle is Grid Active with 8 cars
  - When: `destroyAll()` is called
  - Then: All physics bodies disposed (mass = 0 or body null), all meshes removed from scene, `entity.despawned` event emitted 8 times, entity map empty
  - Edge: destroyAll() during race tick — guard flag prevents concurrent access

- **AC-6** (getEntity after destroy):
  - Given: destroyAll() completed
  - When: `getEntity('player')` is called
  - Then: Returns null/undefined

- **AC-8** (event received by downstream):
  - Given: spawnGrid completed, Fuel system subscribed to entity.spawned
  - When: spawnGrid fires events
  - Then: Fuel system's Map has 8 entries (one per car)

- **GSM-1** (PreRace spawn):
  - Given: EntityLifecycle is Idle, GSM in Menu state
  - When: GSM transitions to PreRace
  - Then: spawnGrid() called automatically, 8 entities exist

- **GSM-2** (PostRace destroy):
  - Given: EntityLifecycle is Grid Active, GSM in Racing state
  - When: GSM transitions to PostRace
  - Then: destroyAll() called automatically, entity map empty

- **IDEMPOTENT** (double destroy):
  - Given: EntityLifecycle is Grid Active
  - When: `destroyAll()` called twice in succession
  - Then: First call cleans up, second call is no-op, no errors

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/entity-car-lifecycle/destroy-gsm-integration.test.ts`

**Status**: ✅ Created — 37 tests, 100% coverage

---

## Dependencies

- Depends on: Story 001 (needs CarEntity types, spawnGrid, entity.spawned events)
- Unlocks: None (completes Entity/Car Lifecycle epic)

## Completion Notes

**Completed**: 2026-06-30
**Criteria**: 6/6 passing
**Deviations**: None
**Test Evidence**: Integration test at `tests/integration/entity-car-lifecycle/destroy-gsm-integration.test.ts` (37 tests, 100% coverage)
**Code Review**: Complete — APPROVED
