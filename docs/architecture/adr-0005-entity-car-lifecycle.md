# ADR-0005: Entity/Car Lifecycle & State Ownership

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                                                             |
| **Domain**                | Core (Entity/Car Lifecycle)                                                                   |
| **Knowledge Risk**        | LOW                                                                                           |
| **References Consulted**  | VERSION.md, entity-car-lifecycle.md GDD, architecture.md Module Ownership, ADR-0003, ADR-0004 |
| **Post-Cutoff APIs Used** | None                                                                                          |
| **Verification Required** | `PhysicsAggregate` options immutability fix (v9.12 — options object no longer mutated)        |

## ADR Dependencies

| Field             | Value                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| **Depends On**    | ADR-0003 (AssetContainers — car GLB cached), ADR-0004 (Entity/Car in Core, not Foundation)               |
| **Enables**       | Physics/Handling (car body attach), AI Driver (AIDriverRef), Fuel/Tire (state init on `entity.spawned`)  |
| **Blocks**        | Race Management (grid spawn), Camera (player follow target)                                              |
| **Ordering Note** | Init slot #8 (Core group A, after Asset Manager). Must complete before Physics/Handling init (slot #12). |

## Context

### Problem Statement

Each race has 8 cars (1 player + 7 AI). Every car needs a Babylon.js mesh (from cached AssetContainer), a PhysicsBody (convex hull, 800 kg), and an optional AIDriverRef. On PostRace, all must be cleaned up without leaks (physics bodies disposed, meshes removed from scene, state maps cleared). On Race Again, they re-spawn from the same cached container — zero disk I/O. Without a centralized lifecycle, each system manages its own car references, leading to orphaned state on cleanup.

Per ADR-0004, Entity/Car Lifecycle was moved from Foundation (slot #7) to Core (slot #8) because it consumes `PhysicsAggregate` and `AbstractMesh` from `@babylonjs/core` — violating the Foundation "zero engine imports" invariant.

### Constraints

- CarEntity is identity-only: mesh ref, physics body, AIDriverRef — never runtime state
- Player and AI use the same structure (`aiDriver = undefined` for player)
- spawnGrid() is synchronous — all 8 cars created before returning
- destroyAll() is idempotent — subsequent calls are safe
- PhysicsAggregate created here, vehicle setup deferred to Physics/Handling (slot #12)
- ⚠️ **PhysicsAggregate CONVEX_HULL requires a mesh with vertices.** The car GLB root node may be a `TransformNode` without geometry — in that case, the child chassis `Mesh` must be extracted and passed via `{ mesh: chassisMesh }` in the options parameter. See spawn flow notes below.
- Grid order determined by caller (Race Management), not by the lifecycle

### Requirements

- `spawnGrid(teams, playerTeamId)` → 8 CarEntity objects, each with unique `carId`
- `destroyAll()` disposes: physics bodies, scene meshes, clears entity map
- `getEntity(carId)` returns entity or `undefined`
- Emits `entity.spawned` and `entity.despawned` per car via Event Bus
- spawnGrid() while Grid Active throws `EntityLifecycleError`
- destroyAll() during race tick guarded by flag (mid-tick physics dispose safety)

## Decision

### Architecture

```
[Idle] --spawnGrid()--> [Grid Active] --destroyAll()--> [Idle]
                            │
                            ▼
                    Map<carId, CarEntity>
                    + PhysicsBody[] / entries[]
```

Entity/Car Lifecycle owns:

- `Map<string, CarEntity>` — the entity registry
- `entries: AssetContainerInstantiationResult[]` — for mesh cleanup (ADR-0003 pattern)
- `activeBodies: PhysicsBody[]` — for physics body cleanup and pipeline stepping (ADR-0002)
- State machine: Uninitialized → Idle → Grid Active → Idle

**What it does NOT own** (by design):

- Fuel level, tire wear, damage, lap count — all live in respective owner systems
- Grid order/selection — determined by Race Management, passed via `GridConfig`

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

### Spawn Flow

```
spawnGrid(teams[], playerTeamId):
  1. Assert state === Idle (throw if Grid Active)
   2. For each team in grid order:
      a. instantiateModelsToScene() from cached container
      b. Extract the chassis Mesh from the cloned hierarchy
         (root may be TransformNode without geometry — see constraint note)
      c. Create PhysicsAggregate(chassisMesh or root, CONVEX_HULL, { mass: 800, mesh: chassisMesh }):
         - If root has geometry: PhysicsAggregate(root, CONVEX_HULL, { mass: 800 })
         - If root is TransformNode only: PhysicsAggregate(root, CONVEX_HULL, { mass: 800, mesh: chassisMesh })
      d. Wrap in CarEntity, push to entity map
      e. Push physics body to activeBodies[]
      f. Push instantiation result to entries[]
      g. Emit event 'entity.spawned'(carId, teamId, gridIndex)
   3. Transition to Grid Active
```

### Cleanup Flow

```
destroyAll():
  1. Set guard flag (getEntity() returns null)
  2. For each car in reverse order:
     a. Emit event 'entity.despawned'(carId)
     b. Dispose physics: entity.physicsBody?.dispose()
        (PhysicsAggregate.dispose() removes the onDisposeObservable
        handler, preventing double-dispose when the mesh is released)
  3. Clear activeBodies[]
  4. Dispose all mesh entries: entries.forEach(e => e.dispose())
  5. Clear entries[]
  6. Clear entity map
  7. Remove guard flag
  8. Transition to Idle
```

Physics bodies disposed BEFORE mesh entries — prevents dangling Havok
references. Reverse iteration ensures no dependency cascade.

### State Ownership (What Lives Where)

| Data                         | Owner                | Initialized By                          | Notes                            |
| ---------------------------- | -------------------- | --------------------------------------- | -------------------------------- |
| mesh, physicsBody, aiDriver  | Entity/Car Lifecycle | `spawnGrid()`                           | Identity — never changes         |
| fuelLevel                    | Fuel System          | `entity.spawned` handler                | Per-car Map                      |
| tireCondition                | Tire Wear            | `entity.spawned` handler                | Per-car Map                      |
| speed, RPM, gear, grip       | Physics/Handling     | `entity.spawned` handler                | Physics creates constraints here |
| lap, position, totalDistance | Race Management      | `entity.spawned` handler                | Per-car Map                      |
| team_performance params      | AI Driver            | `entity.spawned` handler (AI cars only) | Behavior tree params             |

## Alternatives Considered

### Alternative 1: Each system manages its own entities

- **Description:** Physics creates physics bodies directly. Fuel inits state maps without a centralized lifecycle event. No shared CarEntity type.
- **Pros:** No centralized coordinator, each system owns its data completely
- **Cons:** `destroyAll()` must iterate N systems. If one system forgets cleanup, orphaned state leaks. No single source of truth for "what cars exist."
- **Rejection Reason:** Leak-prone. A centralized lifecycle emitting events ensures all systems initialize and clean up deterministically. The event pattern means Fuel doesn't need to know about Physics internals — it just listens for spawn events.

### Alternative 2: Object Pooling (pre-create 8, reuse)

- **Description:** Create 8 CarEntity objects once at init. On spawn, reset state (zero fuel, full tires, fresh position). On destroy, return to pool.
- **Pros:** No allocation/deallocation between races. Predictable memory.
- **Cons:** Object pooling adds state-reset complexity. The pool size must be decided upfront (8 for MVP, but Championship Mode may need more). Browsers handle short-lived object allocation efficiently — pooling is over-engineering for 8 cars at 60Hz.
- **Rejection Reason:** Premature optimization. The GDD profiles will guide if pooling is needed. For MVP, create + dispose is simpler and correct.

## Consequences

### Positive

- Single source of truth for "what cars exist" — `getEntity(carId)` is the authoritative check
- All systems receive `entity.spawned`/`entity.despawned` — no system misses cleanup
- Player/AI uniformity — same code path for both, `aiDriver` flag is the only difference
- Physics body dispose before mesh dispose prevents Havok dangling references

### Negative

- Physics body creation in lifecycle (slot #8) but vehicle setup deferred to Physics (slot #12) — physics body exists without vehicle config for ~4 init slots
- `spawnGrid()` throws on double-call — caller must `destroyAll()` first or handle the error

### Risks

- **Risk:** A system subscribes to `entity.spawned` but never to `entity.despawned` — state accumulates across Race Again cycles
  **Mitigation:** Architecture review checklist requires paired `spawned`/`despawned` subscriptions.
- **Risk:** `destroyAll()` called mid-tick — Physics slot #2 reads car data while lifecycle slot #8 disposes bodies
  **Mitigation:** GSM guarantees `destroyAll()` only during PostRace (no pipeline tick during transition). Guard flag prevents concurrent access.

## GDD Requirements Addressed

| GDD System              | Requirement                                | How This ADR Addresses It                                  |
| ----------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| entity-car-lifecycle.md | CarEntity identity-only (no runtime state) | Section "State Ownership" table — runtime state per-system |
| entity-car-lifecycle.md | Player/AI same structure                   | `aiDriver?: AIDriverRef` — undefined for player            |
| entity-car-lifecycle.md | Cloning from AssetContainer                | `instantiateModelsToScene()` from ADR-0003 cache           |
| entity-car-lifecycle.md | Physics body ownership + disposal          | `physicsBody.dispose()` before `entries.dispose()`         |
| entity-car-lifecycle.md | Events emitted per car                     | `entity.spawned`/`entity.despawned` via Event Bus          |

## Performance Implications

- **CPU:** 8 clones + 8 PhysicsAggregate creations ~= 2-5ms total at PreRace (one-time). Zero per-frame cost.
- **Memory:** 8 CarEntity objects (~200 bytes each) + 8 PhysicsAggregate (~2KB each) + 8 mesh instantiations (shared materials, ~1KB each) = ~32 KB total per race.
- **Load Time:** Zero — spawn is synchronous from cached containers.

## Validation Criteria

- [ ] `spawnGrid([8 teams], 'macklen')` returns 8 unique CarEntity objects with sequential carIds
- [ ] Player car has `aiDriver === undefined`; AI cars have `aiDriver.teamId` + `driverProfile`
- [ ] `getEntity('player')` returns valid entity after spawn; `undefined` after `destroyAll()`
- [ ] `entity.spawned` event fires 8 times — each with unique carId
- [ ] `entity.despawned` event fires 8 times on destroy
- [ ] `destroyAll()` idempotent — second call is no-op
- [ ] `spawnGrid()` while Grid Active throws `EntityLifecycleError`
- [ ] PhysicsAggregate convex hull with mass=800 kg confirmed via `aggregate.body.getMassProperties().mass`
- [ ] `activeBodies.length === 0` after destroyAll() — no dangling Havok refs
- [ ] Fuel system inits 8 entries in its Map on spawn; 0 entries on despawn

## Related Decisions

- ADR-0003 (AssetContainers — car GLB cache, `removeAllFromScene()` + `instantiateModelsToScene()`)
- ADR-0004 (Module Boundaries — Entity/Car in Core, not Foundation)
- ADR-0002 (PhysicsBody array management for fixed-step pipeline)
