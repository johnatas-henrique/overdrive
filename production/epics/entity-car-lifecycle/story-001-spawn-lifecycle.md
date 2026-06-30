# Story 001: CarEntity Spawn & Lifecycle

> **Epic**: Entity/Car Lifecycle
> **Status**: Complete
> **Layer**: Core
> **Type**: Integration
> **Estimate**: 6-8h
> **Manifest Version**: 2026-06-21
> **Last Updated**: 2026-06-30

## Context

**GDD**: `design/gdd/entity-car-lifecycle.md`
**Requirement**: `TR-ECL-001`, `TR-ECL-002`, `TR-ECL-004`, `TR-ECL-005`, `TR-ECL-006`, `TR-ECL-007`

- **TR-ECL-001**: CarEntity data structure with id, teamId, gridIndex, mesh, physicsBody, aiDriver
- **TR-ECL-002**: spawnGrid(teams, playerTeamId) clones from AssetContainer, creates PhysicsAggregate
- **TR-ECL-004**: Emit entity.spawned per car via Event Bus
- **TR-ECL-005**: Gate on double-spawn — spawnGrid() while Grid Active throws EntityLifecycleError
- **TR-ECL-006**: Guard flag during destroyAll() — getEntity() returns null, physics calls no-ops
- **TR-ECL-007**: Player and AI use identical CarEntity structure — player aiDriver = undefined

**ADR Governing Implementation**: ADR-0005: Entity/Car Lifecycle & State Ownership
**ADR Decision Summary**: CarEntity identity-only (mesh, physicsBody, aiDriver). spawnGrid() clones from cached AssetContainer, creates PhysicsAggregate (convex hull, 800kg). State machine: Uninitialized → Idle → Grid Active. Emits entity.spawned per car.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW

**Control Manifest Rules (this layer)**:

- C17: inputs.clear() + inertia=0 on cameras (not applicable — camera story)
- Entity/Car Lifecycle is in Core layer, depends on Asset Manager and Event Bus

**Performance Budget**: 8 PhysicsAggregate creations (convex hull, 800kg) at PreRace ≈ 2-5ms total (one-time). Zero per-frame cost. Per ADR-0005 performance analysis.

---

## Acceptance Criteria

_From GDD `design/gdd/entity-car-lifecycle.md`, scoped to this story:_

- [ ] **AC-1**: `EntityLifecycle.init()` enters Idle state.
- [ ] **AC-2**: `spawnGrid([teamA, teamB, ...], 'teamA')` — N cars are cloned, each has a unique `carId`, physics bodies created, and `'entity.spawned'` emitted per car.
- [ ] **AC-3**: `getEntity('player')` returns the player's `CarEntity` with valid mesh and physics body.
- [ ] **AC-4**: `getEntity('ai_3')` returns the 4th AI car with a valid `aiDriver` — player car has `aiDriver = undefined`.
- [ ] **AC-7**: `spawnGrid()` while Grid Active throws `EntityLifecycleError('Grid already active')`.

---

## Implementation Notes

_Derived from ADR-0005 Implementation Guidelines:_

### CarEntity Interface

```typescript
interface CarEntity {
  id: string; // 'player', 'ai_0', ..., 'ai_6'
  teamId: string; // 'macklen', 'willard', ...
  gridIndex: number; // 0 = pole position
  mesh: AbstractMesh; // root TransformNode of cloned car GLB
  physicsBody: PhysicsAggregate | null; // convex hull, 800 kg
  aiDriver?: AIDriverRef; // undefined for player
}

interface AIDriverRef {
  readonly teamId: string;
  readonly driverProfile: string; // key into AI registry
}
```

### State Machine

```
[Uninitialized] --init()--> [Idle] --spawnGrid()--> [Grid Active]
```

### Spawn Flow

```
spawnGrid(teams[], playerTeamId):
  1. Assert state === Idle (throw if Grid Active)
  2. For each team in grid order:
     a. instantiateModelsToScene() from cached container
     b. Extract the chassis Mesh from the cloned hierarchy
     c. Create PhysicsAggregate(chassisMesh or root, CONVEX_HULL, { mass: 800 })
     d. Wrap in CarEntity, push to entity map
     e. Emit event 'entity.spawned'(carId, teamId, gridIndex)
  3. Transition to Grid Active
```

### Key Rules

- CarEntity is identity-only: mesh ref, physics body, AIDriverRef — never runtime state
- Player and AI use the same structure (`aiDriver = undefined` for player)
- spawnGrid() is synchronous — all 8 cars created before returning
- Grid order determined by caller (Race Management), not by the lifecycle
- PhysicsAggregate CONVEX_HULL requires a mesh with vertices

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 002: destroyAll(), entity.despawned events, GSM integration
- Fuel/Tire/AI state initialization — those systems subscribe to entity.spawned independently

---

## QA Test Cases

_Written by qa-lead at story creation:_

- **AC-1** (init to Idle):
  - Given: EntityLifecycle is Uninitialized
  - When: `init()` is called
  - Then: State is Idle, `getEntity('player')` returns undefined
  - Edge: Double init throws

- **AC-2** (spawnGrid clones + events):
  - Given: EntityLifecycle is Idle, 8 teams provided
  - When: `spawnGrid(teams, 'macklen')` is called
  - Then: 8 CarEntity objects created, each with unique carId, PhysicsAggregate with mass=800kg, `entity.spawned` event emitted 8 times with unique carId/teamId/gridIndex
  - Edge: Spawn while Grid Active throws EntityLifecycleError

- **AC-3** (player entity):
  - Given: spawnGrid completed
  - When: `getEntity('player')` is called
  - Then: Returns CarEntity with valid mesh (in scene), valid physicsBody, aiDriver = undefined

- **AC-4** (AI entity):
  - Given: spawnGrid completed
  - When: `getEntity('ai_3')` is called
  - Then: Returns CarEntity with valid mesh, valid physicsBody, aiDriver.teamId matches team, aiDriver.driverProfile is string

- **AC-7** (double-spawn gate):
  - Given: EntityLifecycle is Grid Active
  - When: `spawnGrid(teams, 'macklen')` is called
  - Then: Throws EntityLifecycleError('Grid already active')

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/entity-car-lifecycle/spawn-lifecycle.test.ts`

**Status**: [x] Created — 22 tests passing at `tests/integration/entity-car-lifecycle/spawn-lifecycle.test.ts`

---

## Dependencies

- Depends on: Story 001 of Camera epic (CameraManager + scene exists), Asset Manager (cached car AssetContainer), Event Bus
- Unlocks: Camera Story 003 (Cockpit Camera — needs `driver_eye` on car mesh)

---

## Completion Notes

**Completed**: 2026-06-30
**Criteria**: 5/5 passing (AC-1, AC-2, AC-3, AC-4, AC-7)
**Deviations**: None
**Test Evidence**: Integration test at `tests/integration/entity-car-lifecycle/spawn-lifecycle.test.ts` (22 tests, 100% lines, 96.67% branches)
**Code Review**: Complete — engine specialist (Babylon.js) + QA testability review. All CRITICAL issues fixed (defined() compile error, InstantiationResult type alignment, mock update).
**Coverage**: 100% lines, 96.67% branches (1 remaining: `_isDestroying` guard → Story 002)
