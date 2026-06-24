# Story 003: Track Loading / Disposal Lifecycle

> **Epic**: Track + Environment
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/track-environment.md`
**Requirements**: `TR-TE-002`

- **TR-TE-002**: Track GLB loaded via Asset Manager — cached container, instantiated in raceScene via `instantiateModelsToScene()`.

**ADR Governing Implementation**: ADR-0025: Track + Environment — load()/dispose() lifecycle
**ADR Decision Summary**: `load(trackId)`: reads TrackConfig, issues asset load requests to Asset Manager, calls `container.instantiateModelsToScene()` on scene meshes (NOT container meshes), creates static physics bodies per category. Throws ConfigError if called while Ready — caller must `dispose()` first. `dispose()`: removes all track meshes from scene, disposes physics impostors, clears references. Race restart requires no re-load — only car positions reset.

**Engine**: Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12 | **Risk**: MEDIUM
**Engine Notes**: `SceneLoader.LoadAssetContainerAsync()` (async-only since 7.34). `container.instantiateModelsToScene()` passes scene meshes for physics attachment — NOT container meshes. Asset Manager `ctx.cache` used for dedup (two tracks referencing same key load once).

**Control Manifest Rules (this layer)**:

- C2: AssetContainers cached — `Map<string, AssetContainer>`. Load once, instantiate per scene.
- C3: `SceneLoader.LoadAssetContainerAsync` only — sync variants deprecated since v7.34.
- C5: `asset.error` event on load failure — GSM remains in Loading.
- C60: Track: static Havok colliders per category — 3-5 bodies per track.
- C62: Track: config-driven.
- F-F1: Never use `import.meta.glob` for config discovery — registration must be explicit.

---

## Acceptance Criteria

_Revised per QL-STORY-READY gate on 2026-06-23 — validation moved from Story 001 to Story 003 per ADR-0025:_

- [ ] **AC-1**: `TrackEnvironmentManager` has public state observable via `get state(): TrackEnvironmentState` returning `'inactive' | 'loading' | 'ready' | 'disposed'`
- [ ] **AC-2**: `load(trackId)` reads the registered TrackConfig, issues Asset Manager load requests for all assets in `TrackConfig.assets`, transitions to `'loading'` state
- [ ] **AC-3**: On successful AssetManager load, `container.instantiateModelsToScene()` instantiates all meshes in raceScene. State transitions to `'ready'`.
- [ ] **AC-4**: Spline data validation on load (per ADR-0025 Decision 7):
  - Mismatched `next` indices throw `ConfigError('Spline: next index N points to segment out of bounds')`
  - Missing grid positions (< 26 entries) throw `ConfigError('Grid: expected 26 positions, got N')`
  - Pit exit spline endpoint lies within `pitExitZone` BoundingBox — misalignment throws `ConfigError('Pit exit endpoint outside pitExitZone')`
- [ ] **AC-5**: `dispose()` removes all track-instanced meshes from raceScene, disposes physics bodies, clears internal references. State transitions to `'disposed'`.
- [ ] **AC-6**: `load()` while already in `'ready'` state throws `ConfigError('Track already loaded — call dispose() first')`. State does NOT regress.
- [ ] **AC-7**: Loading unknown track ID (not registered) throws `ConfigError('Track config not found: {id}')`.
- [ ] **AC-8**: Asset load failure — Manager stays in `'loading'` state, emits `asset.error` via Event Bus with `{ trackId, assetKey, error }`. GSM subscribes to this event for error state transition.
- [ ] **AC-9**: Race restart (load → dispose → load same track) uses cached AssetManager containers — zero I/O on repeated load.
- [ ] **AC-10**: Two tracks referencing the same asset key (e.g., `"shared/barriers"`) load the file once — confirmed via Asset Manager cache hit on second load.
- [ ] **AC-11**: Grid positions exposed via `getGridPosition(index: number): Vec3` — index 0–7 returns valid Vec3; index ≥ 8 throws `ConfigError('Out of range')`.

---

## Implementation Notes

_Derived from ADR-0025 Implementation Guidelines:_

### Lifecycle State Machine

```
Inactive ──→ Loading ──→ Ready ──→ Disposed ──→ Inactive
                │                        ↑
                └── (on error) ──────────┘
```

- `Inactive`: No track loaded. No meshes in scene.
- `Loading`: Asset Manager resolving assets. Scene has placeholder.
- `Ready`: All meshes instantiated, physics active. Queries valid.
- `Disposed`: Meshes removed, physics freed. Return to Inactive via explicit reset.

### TrackEnvironmentManager Core

```typescript
class TrackEnvironmentManager {
  private state: TrackEnvironmentState = "inactive";
  private config?: TrackConfig;
  private instancedMeshes: AbstractMesh[] = [];
  private physicsBodies: PhysicsAggregate[] = [];

  get state(): TrackEnvironmentState {
    return this.state;
  }

  async load(trackId: string): Promise<void> {
    if (this.state === "ready") {
      throw new ConfigError(`Track already loaded — call dispose() first`);
    }

    this.state = "loading";

    // 1. Resolve config (explicit registration, no import.meta.glob)
    this.config = this.configRegistry.get(trackId);
    if (!this.config) {
      throw new ConfigError(`Track config not found: ${trackId}`);
    }

    // 2. Validate spline data (ADR-0025 Decision 7)
    this.validateSplineData(this.config.spline);
    this.validateGridPositions(this.config.gridPositions);

    // 3. Load assets via Asset Manager
    const container = await this.assetManager.loadAssets(this.config.assets);

    // 4. Instantiate meshes in raceScene
    const instances = container.instantiateModelsToScene();
    this.instancedMeshes = instances.newMeshes;

    // 5. Create physics bodies (delegated to Story 004)
    await this.createPhysicsBodies();

    this.state = "ready";
  }

  dispose(): void {
    for (const mesh of this.instancedMeshes) {
      mesh.dispose();
    }
    this.instancedMeshes = [];
    this.physicsBodies = [];
    this.config = undefined;
    this.state = "disposed";
  }
}
```

### Loading Rule — Physics on Scene Meshes

Per ADR-0025 Decision 6, physics bodies must be created on scene-instanced meshes, not container meshes:

```typescript
const container = await SceneLoader.LoadAssetContainerAsync(...);
const instances = container.instantiateModelsToScene();
// Physics on instances.newMeshes (scene meshes with correct transforms)
for (const mesh of instances.newMeshes) { ... }
```

### Spline Validation

```typescript
validateSplineData(spline: SplineSegment[]): void {
  for (let i = 0; i < spline.length; i++) {
    const seg = spline[i];
    if (seg.next !== -1 && (seg.next < 0 || seg.next >= spline.length)) {
      throw new ConfigError(`Spline: segment ${i} next index ${seg.next} out of bounds`);
    }
  }
}

validateGridPositions(positions: Vec3[]): void {
  if (positions.length !== 26) {
    throw new ConfigError(`Grid: expected 26 positions, got ${positions.length}`);
  }
}
```

### Pit Exit Validation

```typescript
validatePitExit(): void {
  const exitEndpoint = this.config.pitLaneSpline[this.config.pitLaneSpline.length - 1];
  const zone = this.config.pitExitZone;
  const isInside = exitEndpoint.x >= zone.xMin && exitEndpoint.x <= zone.xMax &&
                   exitEndpoint.z >= zone.zMin && exitEndpoint.z <= zone.zMax;
  if (!isInside) {
    throw new ConfigError('Pit exit endpoint outside pitExitZone');
  }
}
```

---

## Out of Scope

- **Story 004**: PhysicsAggregate creation per category (called by load() but implemented separately)
- **Story 005**: Pit zone runtime detection (uses pit zones from config, not lifecycle)
- **Story 006**: Skybox mesh loading (part of asset load but covered separately)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Test file**: `tests/integration/track-environment/track-loading_test.ts`

- **AC-1** (state observable):
  - Given: Initialized TrackEnvironmentManager
  - When: Constructor completes
  - Then: `get state()` returns `'inactive'`

- **AC-2** (load issues asset requests):
  - Given: TrackEnvironmentManager in Inactive state, TrackConfig for "monza" registered with `assets.surface = "tracks/monza_surface"`
  - When: `load("monza")` is called
  - Then: State immediately transitions to `'loading'`; Asset Manager receives load request for "tracks/monza_surface" (and all other entries in config.assets)

- **AC-3** (successful load instantiates meshes):
  - Given: All assets loaded successfully into AssetContainers
  - When: `container.instantiateModelsToScene()` completes
  - Then: All meshes are children of raceScene (scene.rootNodes includes them); no track meshes exist in menuScene; state transitions to `'ready'`

- **AC-4** (spline validation on load):
  - Given: TrackConfig with spline where `segments[5].next = 99` but spline has only 10 segments
  - When: `load("invalid-track")` is called
  - Then: Throws ConfigError matching /next index.\*out of bounds/i
  - Edge: Grid with 25 entries (not 26) throws ConfigError matching /expected 26/i
  - Edge: Pit exit endpoint outside pitExitZone throws ConfigError matching /pit exit endpoint/i

- **AC-5** (dispose removes all):
  - Given: Track in Ready state with meshes in scene and physics active
  - When: `dispose()` is called
  - Then: All track-instanced meshes removed from raceScene; physics bodies disposed; internal references cleared; state returns to `'disposed'`

- **AC-6** (dual load guard):
  - Given: Track is in Ready state
  - When: `load("monza")` is called again
  - Then: Throws ConfigError matching /already loaded/i; state remains `'ready'`

- **AC-7** (unknown track):
  - Given: No TrackConfig registered with id "nonexistent"
  - When: `load("nonexistent")` is called
  - Then: Throws ConfigError matching /not found/i

- **AC-8** (asset load failure):
  - Given: `load("monza")` called, state is `'loading'`, Asset Manager returns load error
  - When: Asset load fails
  - Then: State remains `'loading'` (never transitions to `'ready'`); Event Bus receives `asset.error` event with `{ trackId: "monza", assetKey: string, error: Error }`

- **AC-9** (race restart cached):
  - Given: `load("monza")` → `dispose()` completed
  - When: `load("monza")` is called again
  - Then: Asset Manager returns cached AssetContainer (no new I/O); state transitions to `'ready'`

- **AC-10** (shared asset dedup):
  - Given: monza assets reference "shared/barriers", spa assets also reference "shared/barriers"
  - When: load("monza") loads "shared/barriers" once
  - When: load("spa") is called (after monza dispose)
  - Then: Asset Manager reports cache hit for "shared/barriers"

- **AC-11** (grid positions):
  - Given: "monza" config declares 26 grid Vec3 positions
  - When: Track is in Ready state
  - When: `getGridPosition(0)` through `getGridPosition(7)` are called
  - Then: Each returns a Vec3 with finite numeric values; `getGridPosition(i) !== getGridPosition(j)` for i ≠ j
  - Edge: `getGridPosition(8)` throws ConfigError('Out of range')

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/track-environment/track-loading_test.ts` OR documented playtest with load/dispose cycle verification

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (TrackConfig types), Story 002 (spline query interface — used during validation)
- Unlocks: Stories 004, 005, 006
