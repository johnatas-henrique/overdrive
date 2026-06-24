# Story 002: Asset Load & Cache

> **Epic**: Asset Manager
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 10h

## Context

**GDD**: `design/gdd/asset-manager.md`
**Requirement**: `TR-AM-001`, `TR-AM-002`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0003: Two-Scene Architecture & Asset Lifecycle
**ADR Decision Summary**: AssetContainers cached in `Map<string, AssetContainer>`. Load once via `SceneLoader.LoadAssetContainerAsync`, instantiate per scene, zero I/O on cache hit. Containers loaded against raceScene with `removeAllFromScene()` after load for caching.

**Engine**: Babylon.js 9.12.0 | **Risk**: MEDIUM
**Engine Notes**: `SceneLoader.LoadAssetContainerAsync(url, null, null, scene)` — 4th param is target scene. Containers are scene-bound; `instantiateModelsToScene()` creates clones in the container's bound scene. `removeAllFromScene()` unparents source meshes from the bound scene without disposing them.

**Control Manifest Rules (this layer)**:

- Required: C2 (AssetContainers cached — `Map<string, AssetContainer>`), C3 (Only `LoadAssetContainerAsync` — sync variants deprecated), C4 (Containers loaded against raceScene, `removeAllFromScene()` after load)
- Guardrail: C-G12 (~22MB total memory budget for all containers), C-G13 (Menu→Race < 2s, Race Again ~0ms)

---

## Acceptance Criteria

_From GDD `design/gdd/asset-manager.md`, scoped to this story:_

- [ ] AC-3a: After `registerManifest('spa', spaTrackManifest)` and `await load('spa')`: (a) `LoadAssetContainerAsync` is called once with the manifest's `rootUrl`/`filename`, (b) the returned `AssetContainer` is stored in the cache under key `'spa'`, (c) `container.addAllToScene(activeScene)` is called.
- [ ] AC-3b: `load()` before `init()` throws `AssetError('Not initialized')`.
- [ ] AC-3c: `load()` after `dispose()` throws `AssetError('Already disposed')`.
- [ ] AC-4a: After a successful first `load('spa')`, calling `load('spa')` again — `LoadAssetContainerAsync` is NOT called (spy on the loader).
- [ ] AC-4b: The second `load('spa')` returns synchronously (cached container re-added, zero asynchronous I/O).
- [ ] AC-5a: After `load('spa')` completes, `get('spa_root')` returns the root `TransformNode` of the loaded mesh group.
- [ ] AC-5b: `get('nonexistent')` returns `undefined`.

---

## Implementation Notes

_Derived from ADR-0003 Implementation Guidelines:_

1. **Loading pattern** — See ADR-0003 Loading Strategy section:
   ```typescript
   const container = await SceneLoader.LoadAssetContainerAsync(
     rootUrl,
     null,
     null,
     raceScene
   );
   container.removeAllFromScene(); // unparent source meshes from raceScene
   this.cache.set(id, container);
   ```
2. **Cache hit** — Check `this.cache.has(id)` before calling `LoadAssetContainerAsync`. On hit: call `container.addAllToScene(this.activeScene)` and return.
3. **Manifest resolution** — `registerManifest(id, manifest)` (Story 004) stores path mappings. `load(id)` looks up the manifest to get `rootUrl`/`filename`.
4. **get() implementation** — Iterates the cached container's meshes to find root `TransformNode(s)`. Returns the first match or `undefined`.
5. **Scene binding** — Race assets are loaded against `raceScene` (from Story 001's init). The scene exists and is bound to the engine even when not rendering.

---

## Out of Scope

- **Story 003**: Loading progress/error events (load errors must still propagate, but event emission is Story 003)
- **Story 004**: `registerManifest()` definition and lifecycle methods
- **Story 005a**: Concurrent `preload()` (uses `load()` internally)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**AC-3a: load() calls LoadAssetContainerAsync and caches**

- Given: Initialized AssetManager, mocked `SceneLoader.LoadAssetContainerAsync` that resolves with a fabricated `AssetContainer`, manifest `'spa'` registered via `registerManifest()`
- When: `await assetManager.load('spa')` is called
- Then: `LoadAssetContainerAsync` was called 1× with expected URL params; cache has entry `'spa'` → the container; `container.addAllToScene` called with the active `raceScene`
- Edge: Manifest with `glb.rootUrl + glb.filename` passed as correct args to `LoadAssetContainerAsync`

**AC-4a/b: Second load() is cache hit — zero I/O**

- Given: One completed `load('spa')`, spy on `LoadAssetContainerAsync`
- When: `await assetManager.load('spa')` is called again
- Then: `LoadAssetContainerAsync` spy has `callCount === 1` (first call only); the second call returns synchronously or within <1ms
- Edge: A third call also uses cache — no additional I/O

**AC-5a/b: get() returns loaded mesh group**

- Given: `load('spa')` completed; the mocked container has a root `TransformNode` named `'track_geo'`
- When: `assetManager.get('track_geo')` is called
- Then: Returns the `TransformNode`
- Edge: `get('nonexistent')` returns `undefined`
- Edge: `get()` before any `load()` returns `undefined`

**AC-3b/c: load() lifecycle guards**

- Given: Uninitialized AssetManager
- When: `load('spa')` is called
- Then: Throws `AssetError('Not initialized')`
- Edge: After `dispose()`, `load()` throws `AssetError('Already disposed')`

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/asset-manager/story-002-load-cache_test.ts` OR playtest doc
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (init + scene setup)
- Unlocks: Story 003 (events), Story 005a (preload)
