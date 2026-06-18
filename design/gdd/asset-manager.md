# Asset Manager

> **Status**: In Design
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-18
> **Implements Pillar**: Foundation — asset loading pipeline for all visual and audio content

## Overview

The Asset Manager orchestrates loading, caching, and lifecycle of all game assets — 3D models, textures, environment maps, and audio files. It uses Babylon.js's `SceneLoader.LoadAssetContainerAsync()` as its loading primitive, wrapping the result in `AssetContainer` objects that can be added to and removed from scenes without reloading files from disk. The manifest is a TypeScript data module (no Babylon imports) that maps logical IDs to file paths. At Loading state, all car models are preloaded. At Menu→PreRace, only the track GLB loads. At PostRace→Menu, the race scene is disposed and containers are detached — ready for the next race with zero I/O.

## Developer Fantasy

The developer declares a manifest in `src/config/assets/tracks/spa.ts` — a pure data object with paths for the track GLB, skybox, and textures. At runtime, `assetManager.load('spa')` resolves the manifest, calls `LoadAssetContainerAsync`, caches the result, and adds it to the scene. Calling `assetManager.load('spa')` a second time is instant — the cached `AssetContainer` is re-added with no file access. When the GSM leaves the race state, `assetManager.unloadAll()` detaches all containers from the scene. The developer never touches Babylon.js loaders directly.

## Detailed Design

### Core Rules

**1. LoadAssetContainerAsync as primitive.** Every 3D model and all associated meshes are loaded via `SceneLoader.LoadAssetContainerAsync()` into an `AssetContainer`. This container is stored in the cache and can be added to or removed from any scene without re-parsing the GLB. In Babylon.js 9.x, side-effect imports are required for GLB support:

```typescript
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
```

Without this import, GLB loading silently fails.

**2. Two-scene architecture.** The game maintains two scene types:

- **menuScene** (persistent, created during Loading, never disposed): contains the AdvancedDynamicTexture for UI, showroom camera, basic lighting.
- **raceScene** (per-race, created in PreRace, disposed in PostRace): contains track meshes, car meshes, Havok physics world. Fresh scene every race guarantees clean physics state and deterministic replay.

AssetContainers are added to the active scene via `container.addAllToScene(scene)` and removed via `container.removeAllFromScene()`. The container itself stays alive across races.

**3. One GLB, N instances.** A single car GLB (base geometry) is loaded once. Each of the 8 teams gets its own instance via `container.instantiateModelsToScene()` with cloned materials for team color and sponsor texture. No skeletons — the car is a rigid body with child wheel meshes. Wheel rotation is code-driven (`wheel.rotation.x += angularVelocity * dt`).

**4. Manifest as pure data.** Manifest files live in `src/config/assets/` and are pure TypeScript objects — no Babylon.js imports, no loading logic. The Asset Manager service owns all engine calls.

```typescript
// src/config/assets/tracks/spa.ts
export const spaTrackManifest = {
  id: "tracks.spa",
  glb: { rootUrl: "models/tracks/", filename: "spa.glb" },
  skybox: "textures/env/spa.env",
  textures: [
    { id: "track_albedo", url: "textures/tracks/spa_alb.ktx2" },
    { id: "track_normal", url: "textures/tracks/spa_nrm.ktx2" },
  ],
} as const;
```

**5. Preloading during Loading state.** All car GLBs (8 teams), UI textures, and audio files are loaded during the Loading→Menu transition — while the splash screen is visible. By the time the player selects a race, only the track GLB needs to load. This makes the 2s track transition target achievable even on slower connections.

**6. Textures in KTX2 with Basis compression.** Babylon.js 9.x loads KTX2 natively. Car textures are 512×512 without mipmaps (`noMipmap: true`). Track textures are 1024×1024 with mipmaps. Textures are shared across instances — GPU holds one copy per texture.

### States and Transitions

```
[Uninitialized] --init()--> [Ready] --dispose()--> [Disposed]
```

| State             | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| **Uninitialized** | No Babylon.js scene bound. `load()`, `get()` throw.        |
| **Ready**         | Asset Manager is operational. Can queue and resolve loads. |
| **Disposed**      | All containers disposed, cache cleared.                    |

**Transitions:**

- Uninitialized → Ready: `AssetManager.init(scene, menuScene)` — binds to the engine
- During gameplay, the manager switches between scenes:
  - `setActiveScene(menuScene)` — during Menu, PostRace
  - `setActiveScene(raceScene)` — during PreRace, Racing
- Ready → Disposed: `AssetManager.dispose()` — disposes all containers, clears cache

### Interactions with Other Systems

| System                   | Interaction                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| **Data & Config**        | Provides asset manifest definitions (paths, file types, IDs)                             |
| **GSM**                  | Listens to `'gsm.state.entered'` to know when to preload, switch scenes, and unload      |
| **Event Bus**            | Emits `'asset.load.progress'` (current, total), `'asset.load.complete'`, `'asset.error'` |
| **Menu/Paddock LITE**    | Requests UI textures and showroom car via `get()`                                        |
| **Entity/Car Lifecycle** | Requests car meshes via `get('car.macklen')` during PreRace setup                        |
| **Track + Environment**  | Provides track manifest definition                                                       |

## Formulas

None. The Asset Manager orchestrates loading — it does not compute or transform data.

## Edge Cases

1. **GLB file not found.** `LoadAssetContainerAsync` rejects. The error is emitted on Event Bus as `'asset.error'` with the manifest ID. The system that requested the asset handles the missing asset gracefully (e.g. fallback to a placeholder cube).
2. **Texture missing.** Unlike GLB loading, a missing texture URL does not reject — Babylon logs a warning and creates a checkerboard fallback. The Asset Manager detects the warning pattern and emits `'asset.error'` anyway.
3. **Cross-container name collision.** Two GLBs containing meshes with the same name. `instantiateModelsToScene()` accepts a `nameFunction` parameter — each instance is prefixed with team ID (e.g. `'macklen_chassis'`, `'willard_chassis'`).
4. **Physics body re-registration.** When `addAllToScene()` re-adds meshes to a new raceScene, Havok physics bodies are not carried over. The Entity/Car Lifecycle must re-create `PhysicsAggregate` for each car after the container is attached to the new scene.
5. **Animation group staleness.** Animation groups from a disposed scene are invalid. The Asset Manager always re-clones animation groups from the cached container rather than storing references from a previous race.
6. **Cache eviction.** With 8 cars + 4 tracks + UI + audio (~10 MB total), there is no eviction strategy in MVP — everything stays cached for the session. If memory pressure becomes an issue, the `disposeContainer(id)` method allows targeted eviction.

## Dependencies

- **Data & Config** (#1) — asset manifest definitions
- **Babylon.js** — `SceneLoader`, `AssetContainer`, `Texture`, `CubeTexture`
- `@babylonjs/loaders/glTF/2.0/glTFLoader` — required side-effect import for GLB support

## Tuning Knobs

- **Log level** (dev: `verbose`, prod: `warn`) — controls asset loading/detach logging

## Visual/Audio Requirements

None directly. The Asset Manager loads visual and audio assets but produces no output itself.

## UI Requirements

**Loading screen integration** — a progress bar driven by `'asset.load.progress'` events (loaded / total count). Shown during Loading→Menu (preload) and Menu→PreRace (track load). Hidden on `'asset.load.complete'`.

**Debug Overlay** — per-container status (cached / loading / error), cache hit rate, total loaded size.

## Acceptance Criteria

1. `AssetManager.init(menuScene)` creates the cache and binds to the engine.
2. `AssetManager.setActiveScene(raceScene)` redirects all subsequent `addAllToScene()` calls to the race scene.
3. A manifest registered in Data & Config can be loaded by ID — `assetManager.load('spa')` loads the GLB, caches it, and adds meshes to the active scene.
4. Second `assetManager.load('spa')` — no file access, cached container is re-added instantly.
5. `assetManager.get('track.geometry')` returns the loaded mesh group.
6. Missing GLB file — `'asset.error'` emitted on Event Bus, other assets continue loading.
7. `assetManager.unloadAll()` removes all containers from the active scene without disposing them.
8. `assetManager.dispose()` disposes all containers and clears the cache.
9. Duplicate manifest registration throws `AssetError`.
10. Loading progress is emitted on Event Bus — `'asset.load.progress'` fires at least once with `loaded` and `total` values.

## Open Questions

None resolved yet. The Asset Manager design was reviewed by `babylonjs-specialist` and all architectural recommendations have been incorporated.
