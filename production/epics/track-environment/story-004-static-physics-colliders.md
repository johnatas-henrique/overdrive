# Story 004: Static Physics Collider Setup

> **Epic**: Track + Environment
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/track-environment.md`
**Requirements**: `TR-TE-003`

- **TR-TE-003**: Static environment meshes (barriers, walls) — `PhysicsAggregate` with `PhysicsShapeType.MESH` for collision.

**ADR Governing Implementation**: ADR-0025 (Decision 3 — Static Havok colliders per category), ADR-0010 (Collision — barrier registration)
**ADR Decision Summary**: One shared STATIC `PhysicsAggregate` per element category (barriers, track surface, kerbs, buildings) — approximately 3-5 static bodies per track. Meshes merged per category into a single MESH shape. DYNAMIC × MESH is Havok's most optimized collision pair. Barrier meshes registered via `registerBarrier()` on Collision system's `Set<PhysicsBody>`. Track accesses CollisionManager via constructor dependency injection.

**Engine**: Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12 | **Risk**: MEDIUM
**Engine Notes**: `PhysicsAggregate` with `mass: 0` (STATIC) and `PhysicsShapeType.MESH`. `PhysicsBody` for each aggregate. `setCollisionCallbackEnabled(true)` for barrier bodies. Havok builds a BVH per MESH shape — efficient for large tri-meshes.

**Control Manifest Rules (this layer)**:

- C60: Track: static Havok colliders per category — 3-5 bodies per track. `PhysicsAggregate` with `mass: 0` (STATIC), `PhysicsShapeType.MESH`.
- C32: Collision: barrier detection via `Set<PhysicsBody>` (registerBarrier).
- C-F1: Never use `Curve3`, `CatmullRomCurve3`, or `Path3D` for spline data.

---

## Acceptance Criteria

_Revised per QL-STORY-READY gate on 2026-06-23:_

- [ ] **AC-1**: Mesh categorization via GLB node name prefix convention — `barrier_`, `track_`, `building_`, `grandstand_`, `tree_`, `kerb_`, `signage_`. The `TrackEnvironmentManager` matches node names against known category prefixes during mesh instantiation.
- [ ] **AC-2**: One `PhysicsAggregate` (mass: 0, PhysicsShapeType.MESH) created per unique element category present in the track config. At minimum: track surface and barriers each have their own aggregate.
- [ ] **AC-3**: Meshes in the same category are merged into a single MESH shape per `PhysicsAggregate`. Total bodies: one per category present (not ~3-5 arbitrary count).
- [ ] **AC-4**: Physics bodies are created on scene-instanced meshes (`instances.newMeshes`), NOT on container meshes — per ADR-0025 Decision 6 loading rule.
- [ ] **AC-5**: `TrackEnvironmentManager` receives `ICollisionManager` via constructor dependency injection. During `load()`, after creating barrier-category physics bodies, Track calls `collisionManager.registerBarrier(body)` for each barrier aggregate.
- [ ] **AC-6**: `registerBarrier(body: PhysicsBody)` populates `Set<PhysicsBody>` on CollisionManager — used by ADR-0010 collision detection to distinguish barrier contacts.
- [ ] **AC-7**: Barrier Set is cleared on `dispose()` — no stale references to disposed physics bodies.
- [ ] **AC-8**: Trees and signage meshes have NO physics colliders (zero `PhysicsAggregate` for `tree_` and `signage_` categories).

---

## Implementation Notes

_Derived from ADR-0025 and ADR-0010 Implementation Guidelines:_

### Mesh Categorization — Prefix Naming Convention

GLB node names determine category:

| Prefix        | Category      | Physics                       |
| ------------- | ------------- | ----------------------------- |
| `barrier_`    | barriers      | Static MESH + registerBarrier |
| `track_`      | track-surface | Static MESH                   |
| `building_`   | buildings     | Static MESH                   |
| `grandstand_` | grandstands   | Static MESH                   |
| `kerb_`       | kerbs         | Static MESH                   |
| `tree_`       | trees         | None                          |
| `signage_`    | signage       | None                          |

```typescript
const CATEGORY_PREFIXES = [
  "barrier_",
  "track_",
  "building_",
  "grandstand_",
  "tree_",
  "kerb_",
  "signage_",
] as const;

function categorizeMesh(
  name: string
):
  | "barriers"
  | "track-surface"
  | "buildings"
  | "grandstands"
  | "trees"
  | "kerbs"
  | "signage"
  | null {
  for (const prefix of CATEGORY_PREFIXES) {
    if (name.startsWith(prefix)) {
      // Map prefix to category group
      if (prefix === "barrier_") return "barriers";
      if (prefix === "track_") return "track-surface";
      // ... etc
    }
  }
  return null; // unknown prefix — no physics
}
```

### Physics Body Creation (called from load())

```typescript
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { Mesh } from '@babylonjs/core/Meshes/mesh';

async createPhysicsBodies(config: TrackConfig, instancedMeshes: AbstractMesh[]): Promise<void> {
  // Group meshes by category
  const categories = new Map<string, AbstractMesh[]>();

  for (const mesh of instancedMeshes) {
    const category = categorizeMesh(mesh.name);
    if (category && !['trees', 'signage'].includes(category)) {
      if (!categories.has(category)) categories.set(category, []);
      categories.get(category)!.push(mesh);
    }
  }

  // Create one aggregate per category (merged MESH shape)
  for (const [category, meshes] of categories) {
    // Merge category meshes into a single MESH shape
    // Babylon.js PhysicsShapeType.MESH accepts merged geometry
    const aggregate = new PhysicsAggregate(
      meshes[0],  // root mesh (other meshes merged into this shape)
      PhysicsShapeType.MESH,
      { mass: 0, mesh: meshes },  // static, all category meshes
      this.scene
    );

    this.physicsAggregates.push(aggregate);

    // Register barrier aggregates with Collision system
    if (category === 'barriers') {
      for (const mesh of meshes) {
        this.collisionManager.registerBarrier(mesh.physicsBody!);
      }
    }
  }
}
```

**Note**: The exact Babylon.js API for merged MESH shapes may vary. If `PhysicsAggregate({ mesh: meshes[] })` is not supported, use `PhysicsBody` directly with `physicsbody.shape.addChild()` for each mesh in the category. Verify against the actual Havok V2 API during implementation.

### Collision Integration

```typescript
interface ICollisionManager {
  // From ADR-0010
  registerBarrier(body: PhysicsBody): void;
  // ...
}

class TrackEnvironmentManager {
  constructor(
    private readonly assetManager: IAssetManager,
    private readonly collisionManager: ICollisionManager,
    private readonly scene: Scene
  ) {}
}
```

`registerBarrier` populates the barrier `Set<PhysicsBody>` that ADR-0010 Collision system uses for barrier detection. The Set is cleared during `dispose()`.

---

## Out of Scope

- **Story 003**: Loading lifecycle — this story implements the physics step called by `load()`
- **Story 005**: Pit zone detection — uses spatial math, not physics colliders
- **Story 006**: Skybox — no physics

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Test file**: `tests/integration/track-environment/track-physics_test.ts`

- **AC-1** (mesh categorization):
  - Given: A GLB with meshes named "barrier_main", "track_surface_01", "tree_palm_01"
  - When: `categorizeMesh("barrier_main")` is called
  - Then: Returns `'barriers'`
  - When: `categorizeMesh("track_surface_01")` is called
  - Then: Returns `'track-surface'`
  - When: `categorizeMesh("tree_palm_01")` is called
  - Then: Returns `'trees'` (known category but no physics)
  - Edge: `categorizeMesh("unknown_object")` returns null

- **AC-2** (aggregate per category):
  - Given: Track with barrier, track surface, and building meshes
  - When: `load()` completes
  - Then: Exactly 3 `PhysicsAggregate` instances exist (barriers + track-surface + buildings)
  - Edge: Track with no buildings — only 2 aggregates created

- **AC-3** (merged shape):
  - Given: 50 barrier segments all prefixed `barrier_`
  - When: `createPhysicsBodies()` runs
  - Then: All 50 barrier meshes share a single `PhysicsAggregate` with `PhysicsShapeType.MESH`

- **AC-4** (scene meshes, not container):
  - Given: Container meshes loaded by Asset Manager
  - When: `instantiateModelsToScene()` creates scene-instanced copies
  - Then: `PhysicsAggregate` references scene-instanced meshes, NOT container meshes — verified by checking `mesh.getScene() === raceScene`
  - Edge: Container meshes have no physics bodies attached

- **AC-5/6** (collision integration):
  - Given: `TrackEnvironmentManager` constructed with `ICollisionManager` mock
  - When: `load()` completes and barrier physics bodies exist
  - Then: `collisionManager.registerBarrier()` was called N times where N = number of barrier-category bodies
  - Edge: `registerBarrier` NOT called for non-barrier categories

- **AC-7** (clear on dispose):
  - Given: Barriers registered, Set has N entries
  - When: `dispose()` is called
  - Then: CollisionManager's barrier Set is cleared (size === 0)

- **AC-8** (no physics for trees/signage):
  - Given: Track config includes tree and signage meshes
  - When: `load()` completes
  - Then: Zero `PhysicsAggregate` for tree-category or signage-category meshes
  - Edge: Zero `registerBarrier()` calls for tree/signage meshes

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/track-environment/track-physics_test.ts` OR documented playtest with physics body count verification via Dev Tools overlay

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (load lifecycle — physics bodies created during load())
- Unlocks: Collision system barrier detection (cross-epic)
