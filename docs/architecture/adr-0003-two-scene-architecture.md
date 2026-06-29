# ADR-0003: Two-Scene Architecture & Asset Lifecycle

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| **Engine**                | Babylon.js 9.12.0                                                                          |
| **Domain**                | Scene Management / Asset Loading                                                           |
| **Knowledge Risk**        | MEDIUM                                                                                     |
| **References Consulted**  | VERSION.md, modules/rendering.md, breaking-changes.md, deprecated-apis.md                  |
| **Post-Cutoff APIs Used** | `LoadAssetContainerAsync()` module-level API (replaces deprecated `SceneLoader.LoadAssetContainerAsync()` static method) |
| **Verification Required** | AssetContainer lifecycle timing; `engine.runRenderLoop()` drives pipeline (see ADR-0002)   |

## ADR Dependencies

| Field             | Value                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Depends On**    | ADR-0001 (Event Bus — `asset.error` event), ADR-0002 (Pipeline drives from `engine.runRenderLoop()`, not `onBeforeRenderObservable`) |
| **Enables**       | ADR-0005 (Entity/Car Lifecycle — consumes AssetContainers for car spawn)                                                             |
| **Blocks**        | Track+Environment (track GLB), Menu LITE (car thumbnails), Entity/Car Lifecycle                                                      |
| **Ordering Note** | Must be written before Asset Manager implementation                                                                                  |

## Context

### Problem Statement

The game transitions between two visual contexts: Menu (Title → Car Select → Track Select → Race Settings) and Race (grid → racing → results → PostRace → back to Menu). Assets (car GLBs, track meshes, UI textures) must load once and be reusable across transitions without hitting disk again. Two million pixels of track geometry cannot dispose and reload on every race restart.

### Constraints

- Race scene load must remain under 2 seconds (Paddock load time rule)
- Menu assets (car thumbnails, track cards) must survive race session
- Track GLBs (~470K tris) cannot reload on Race Again
- Asset load errors must not crash the game (degraded mode: fallback material)
- Audio samples load once, play in both scenes

### Requirements

- `LoadAssetContainerAsync()` (module-level) — load once, instantiate per scene
- Containers cached in `Map<string, AssetContainer>` — zero I/O on transition
- `asset.error` event emitted on load failure, GSM handles recovery
- Both scenes coexist in `engine.scenes[]`, only one renders per frame
- Container disposal on explicit `disposeContainer(id)` — no garbage accumulation

## Decision

### Architecture

Two persistent Babylon.js Scenes — `menuScene` and `raceScene` — coexist in
`engine.scenes[]`. Asset Manager owns both references.

> ⚠️ **Cross-ADR constraint**: The accumulator + pipeline lives in
> `engine.runRenderLoop()` (ADR-0002), NOT in `scene.onBeforeRenderObservable`.
> This makes the pipeline scene-independent — it runs every frame regardless of
> which scene is active.

```
ENGINE
 ┌──────────────────────────────────────────────┐
 │  engine.scenes[]                              │
 │  ┌──────────────────────────────────┐         │
 │  │  menuScene                        │         │
 │  │  ├── Menu LITE ADT               │         │
 │  │  ├── car thumbnails (instantiated)│         │
 │  │  └── skybox / menu HDR           │         │
 │  └──────────────────────────────────┘         │
 │  ┌──────────────────────────────────┐         │
 │  │  raceScene                        │         │
 │  │  ├── track GLB (instantiated)    │         │
 │  │  ├── 8× car GLB (instantiated)   │         │
 │  │  ├── Physics/Handling Havok      │         │
 │  │  ├── HUD ADT                     │         │
 │  │  └── race sky / environment      │         │
 │  └──────────────────────────────────┘         │
 └──────────────────────────────────────────────┘

RENDER LOOP (engine.runRenderLoop):
  1. FixedUpdatePipeline.runTick() — scene-independent
  2. activeScene.render() — whichever scene is set by AssetManager.setActiveScene()

ASSET CACHE (Asset Manager)
 ┌────────────────┐
 │  Map<id,       │
 │  AssetContainer│
 │  ───────────── │
 │  car_base      │ ← loaded against raceScene, removeAllFromScene() called after load
 │  track_01      │ ← loaded against raceScene, removeAllFromScene() called after load
 │  ui_icons      │ ← loaded against menuScene (menu-only assets)
 │  menu_bg       │ ← loaded against menuScene
 └────────────────┘
```

### Scene Lifecycle

```
Application.start():
  1. Create Engine
  2. Create menuScene (new Scene(engine)) — will render during Menu
  3. Create raceScene (new Scene(engine)) — dormant, no meshes yet
  4. AssetManager.init(menuScene, raceScene)
  5. Preload menu containers: LoadAssetContainerAsync(url, null, null, menuScene)
     → addAllToScene() — thumbnails, UI background visible immediately
  6. Preload base containers: LoadAssetContainerAsync(url, null, null, raceScene)
     → removeAllFromScene() — meshes cached but invisible during Menu
  7. GSM → Menu

Menu → PreRace:
  1. Track.load(id) → LoadAssetContainerAsync(url, null, null, raceScene)
     → removeAllFromScene() → cache
  2. Entity.spawnGrid() → car_base container → instantiateModelsToScene()
     → entries stored for cleanup
  3. Track container → instantiateModelsToScene() → entries stored
  4. GSM → PreRace

Race completed → PostRace:
  1. Race Again:
     a. Dispose physics bodies: activeBodies.forEach(b => b.dispose())
     b. entries.dispose() for all instantiated containers
     c. Clear activeBodies array
     d. Re-instantiate from cache (step 2-3 above, zero I/O)
  2. Back to Menu:
     a. Dispose physics bodies + entries (same as Race Again)
     b. AssetManager.setActiveScene('menu')
     c. GSM → Menu — menu assets were never disposed
  3. Quit:
     disposeContainer() for all → dispose both scenes → dispose Engine
```

### Key Interfaces

```typescript
interface IAssetManager {
  preload(ids: string[]): Promise<void>;
  load(id: string): Promise<AssetContainer>;
  setActiveScene(scene: "menu" | "race"): void;
  disposeContainer(id: string): void;

  // Internal state:
  // - cache: Map<string, AssetContainer>
  // - entries: Map<string, AssetContainerInstantiationResult>
  // - menuScene: Scene
  // - raceScene: Scene
  // - activeScene: 'menu' | 'race'
}
```

### Loading Strategy (Container Scene Binding)

**Critical**: Containers loaded against `raceScene` stay scene-bound. All
race-runtime containers must be loaded against `raceScene`, even though the
scene is dormant during Menu. This enables `instantiateModelsToScene()` to
create clones in the correct scene.

```typescript
// ✅ Correct pattern for race assets (module-level API):
// raceScene exists from init, even though it doesn't render yet
const container = await LoadAssetContainerAsync(
  filename,
  raceScene,
  { rootUrl } // rootUrl in options for correct relative texture resolution
);
container.removeAllFromScene(); // unparent source meshes from raceScene
this.cache.set(id, container);

// Later, on race start:
const entries = container.instantiateModelsToScene();
// Clones appear in raceScene because container is scene-bound to raceScene
// entries.dispose() cleans up on Race Again
```

**Important API note**: `instantiateModelsToScene()` does NOT accept a scene
parameter. Its first argument is an optional naming function:

```typescript
instantiateModelsToScene(
  nameFunction?: (sourceName: string) => string,
  useInstantiate?: boolean | ((mesh: AbstractMesh) => boolean),
  root?: Nullable<TransformNode>
): AssetContainerInstantiationResult
```

Clones are always created in the container's bound scene (the one passed to
`LoadAssetContainerAsync`).

### Invariants

1. Containers are never disposed during a session — only at app quit or explicit
   `disposeContainer(id)` (e.g., switching to a different track)
2. `setActiveScene('menu')` sets a variable `activeScene = menuScene` consumed
   by the render loop; `setActiveScene('race')` sets `activeScene = raceScene`
3. Both scenes respond to `engine.resize()` regardless of active scene
4. Audio (Sound) attaches to the engine, not to a scene — plays across transitions

### Loading Events (Progress / Completion)

The Asset Manager exposes loading events through the Event Bus so that HUD and
Menu LITE can react to load progress:

```typescript
interface IAssetManager {
  // ... (existing interface from Key Interfaces section)
  // Loading events (emitted via Event Bus):
  // - 'asset.load.start'(ids: string[])     — batch started
  // - 'asset.load.progress'(id: string, loaded: number, total: number) — per-file progress
  // - 'asset.load.complete'(id: string)     — single asset finished
  // - 'asset.error'(assetId: string, error: Error) — load failure (re-thrown)
  // - 'asset.load.allComplete'(ids: string[]) — entire batch finished
}
```

**Implementation**: `preload()` and `load()` emit events at these points:

```typescript
async preload(ids: string[]): Promise<void> {
  eventBus.emit('asset.load.start', ids);
  let completed = 0;
  for (const id of ids) {
    try {
      const container = await this.loadOne(id);
      this.cache.set(id, container);
      eventBus.emit('asset.load.complete', id);
    } catch (e) {
      eventBus.emit('asset.error', { assetId: id, error: e });
      throw e;
    }
    completed++;
    eventBus.emit('asset.load.progress', 'group', completed, ids.length);
  }
  eventBus.emit('asset.load.allComplete', ids);
}
```

**Consumers**:

- Menu LITE shows a loading bar on title screen using `progress`/`allComplete`
- Race scene start gates on `allComplete` for track + car containers
- HUD hides loading overlay on `allComplete`

### Animation Group Lifecycle on Scene Dispose

When a scene is disposed (raceScene dispose on quit), any `AnimationGroup`
instances created by `instantiateModelsToScene()` are destroyed along with the
scene. Re-creating them on a fresh scene requires:

```typescript
// Race Again flow (from Scene Lifecycle section):
// 1. entries.dispose() — destroys all instantiated meshes + animation groups
// 2. container.instantiateModelsToScene() — re-creates everything, including
//    new AnimationGroup instances bound to the same raceScene
// 3. Animation groups must be re-registered with the new AnimationGroup array
//
// The container retains the original animation definitions — re-instantiation
// recreates the groups automatically. No manual animation group serialization
// is needed.
```

**Key constraint**: Storing references to `AnimationGroup` instances returned
by `instantiateModelsToScene()` is unsafe after `entries.dispose()`. Always
re-query the new `entries.animationGroups` after re-instantiation:

```typescript
// ❌ Unsafe — held reference points to disposed groups
const oldGroups = entries.animationGroups;
entries.dispose();
oldGroups[0].play(); // Error: disposed group

// ✅ Safe — re-query after instantiation
entries = container.instantiateModelsToScene();
const newGroups = entries.animationGroups; // fresh instances
newGroups[0].play();
```

5. Race-runtime containers are loaded against `raceScene` with `removeAllFromScene()`
   after load — source meshes never render until explicitly instantiated
6. Physics bodies are disposed manually BEFORE `entries.dispose()` — see Risks

## Alternatives Considered

### Alternative 1: Single Scene + Dispose/Rebuild

- **Description:** One Scene. On transition, dispose all meshes, load fresh
  from disk.
- **Pros:** Simplest mental model, lowest memory (only one scene's assets resident)
- **Cons:** 2-second paddock load rule broken on Race Again (must reload track GLB
  from disk). Menu assets (thumbnails, backgrounds) must reload on PostRace → Menu.
  Track GLB at ~470K tris takes 400-800ms to re-parse even from browser cache.
- **Rejection Reason:** Race Again would reload track geometries every time —
  violates the 2-second paddock load rule and makes quick restart feel sluggish.

### Alternative 2: Single Scene + Show/Hide Groups

- **Description:** One Scene. Both menu and race meshes always resident.
  `setEnabled(false)` on menu group during race, `setEnabled(false)` on race group
  during menu.
- **Pros:** Zero I/O on transitions, instant scene switching
- **Cons:** ~470K tris of track always resident + 8 car meshes + menu geometry =
  double the GPU memory during menu. Menu scene still rendering behind race scene
  (wasted draw calls).
- **Rejection Reason:** GPU memory waste. Menu rendering behind race would consume
  draw budget unnecessarily. Two-scene approach is the standard Babylon.js pattern.

## Consequences

### Positive

- Zero I/O on Race Again and PostRace → Menu transitions
- GPU memory only holds active scene's assets + cached containers (uninstantiated)
- Both scenes available for preloading (menu scene loads first, race scene loads
  in background during Car Select)
- Standard Babylon.js pattern — well-documented, no hacks

### Negative

- Two scenes = two lists of meshes, lights, cameras to manage
- `entries.dispose()` + physics body cleanup required on every transition
- Loading screen must wait for `LoadAssetContainerAsync` to complete before
  GSM transition (handled in Single Race adapter)

### Risks

- **Risk:** Memory spike during scene transition — both scenes fully resident
  **Mitigation:** MVP target is desktop/Tauri with 8 GB+ RAM. 470K track + 8 cars
  at ~50K each = ~870K triangles total ~15 MB geometry. Acceptable.
- **Risk:** `LoadAssetContainerAsync(url, undefined, undefined, scene)` omits
  the scene parameter (associates with active scene)
  **Mitigation:** Asset Manager always passes explicit scene reference.
- **Risk:** Physics bodies not cleaned before `entries.dispose()` — dangling
  physics refs → Havok crash
  **Mitigation:** Explicit disposal order: physics bodies → `entries.dispose()`.
  Dev assertion checks `activeBodies.length === 0` after each cleanup cycle.

## GDD Requirements Addressed

| GDD System           | Requirement                                    | How This ADR Addresses It                      |
| -------------------- | ---------------------------------------------- | ---------------------------------------------- |
| asset-manager.md     | AssetContainers cache for zero-I/O transitions | `Map<string, AssetContainer>` cache            |
| asset-manager.md     | Two-scene references (menu + race)             | `menuScene` + `raceScene` in `engine.scenes[]` |
| asset-manager.md     | Asset load error recovery                      | `asset.error` event + fallback material        |
| track-environment.md | Track GLB load under 2s                        | Cached container → zero-I/O on Race Again      |
| menu-lite.md         | Car thumbnails survive race                    | Menu scene keeps its meshes (not disposed)     |

## Performance Implications

- **CPU:** `LoadAssetContainerAsync` I/O bound — happens once per track per session
  (~400ms on SSD, ~800ms on HDD). Zero cost on Race Again.
- **Memory:** Two scenes: ~2 MB menu overhead (HUD ADT, thumbnails, skybox) +
  ~15 MB race scene (track + 8 cars + HUD ADT). Cached containers add
  ~5 MB (uninstantiated GLB data). Total: ~22 MB — acceptable for desktop.
- **Load Time:** Menu → Race: 2s budget. Race Again: ~0ms (instantiate from cache).

## Migration Plan

First implementation is greenfield. Future improvements (Championship Mode with
multiple tracks) will use the same cache — just load additional track containers.

## Validation Criteria

- [ ] `LoadAssetContainerAsync` completes and container is cached
- [ ] `container.instantiateModelsToScene()` creates clones in raceScene
- [ ] `container.removeAllFromScene()` removes source meshes from scene
- [ ] Race Again: `entries.dispose()` cleans all meshes; physics bodies disposed
      beforehand; re-instantiate from cache — zero `LoadAssetContainerAsync` calls
- [ ] `setActiveScene('menu')` renders menuScene, `setActiveScene('race')` renders
      raceScene; pipeline continues during both
- [ ] `disposeContainer(id)` removes from cache and disposes all associated meshes
- [ ] `asset.error` emitted when load fails — GSM remains in Loading state
- [ ] Dev assertion: `activeBodies.length === 0` after cleanup cycle

## Related Decisions

- ADR-0001 (Event Bus — `asset.error` event)
- ADR-0002 (Pipeline driven from `engine.runRenderLoop()`, scene-independent)
- ADR-0005 (Entity/Car Lifecycle — consumes AssetContainers for car spawn)
- Architecture.md System Layer Map (Asset Manager in Core)
