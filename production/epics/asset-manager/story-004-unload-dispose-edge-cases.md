# Story 004: Unload, Dispose & Edge Cases

> **Epic**: Asset Manager
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 10h

## Context

**GDD**: `design/gdd/asset-manager.md`
**Requirement**: `TR-AM-007`, `TR-AM-010`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0003: Two-Scene Architecture & Asset Lifecycle
**ADR Decision Summary**: Containers are never disposed during a session — only at app quit or explicit `disposeContainer(id)`. `dispose()` clears the entire cache. `unloadAll()` removes containers from the active scene without disposing them — ready to re-add on next race.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: `container.dispose()` disposes all meshes, materials, and textures in the container. After dispose, the container cannot be re-used. `container.removeAllFromScene()` only unparents — the container remains valid. Animation groups from a disposed scene are invalid; must re-clone via `instantiateModelsToScene()`.

**Control Manifest Rules (this layer)**:

- Required: C2 (AssetContainers cached), C4 (Containers loaded against raceScene, `removeAllFromScene()` after load), C5 (`'asset.error'` on load failure)
- Forbidden: C-FN/A — no specific forbiddens for lifecycle management

---

## Acceptance Criteria

_From GDD `design/gdd/asset-manager.md`, scoped to this story:_

- [ ] AC-7a: `unloadAll()` calls `container.removeAllFromScene()` on every cached container. Containers remain in the cache.
- [ ] AC-7b: After `unloadAll()`, `load()` still works — containers are cached and can be re-added.
- [ ] AC-7c: `unloadAll()` is idempotent — calling it twice is a safe no-op (second call removes already-removed containers).
- [ ] AC-8a: `dispose()` calls `container.dispose()` on every cached container, clears the cache, and transitions state to `Disposed`.
- [ ] AC-8b: `dispose()` does NOT dispose `menuScene` or `raceScene` (scene ownership is outside AssetManager).
- [ ] AC-8c: After `dispose()`, calling `load()` or `get()` throws `AssetError('Already disposed')`.
- [ ] AC-9a: `registerManifest(id, manifestData)` stores the manifest under a string key.
- [ ] AC-9b: Calling `registerManifest('spa', ...)` a second time (same ID) silently overwrites the previous manifest (consistent with Story 002 AC-2c).
- [ ] AC-9c: Registering two different IDs (`'spa'`, `'monza'`) — both succeed.
- [ ] AC-9d: `registerManifest()` before `init()` throws `AssetError('Not initialized')`.
- [ ] AC-NEW-1: `disposeContainer('spa')` removes the container from cache and calls `container.dispose()`. Other containers unaffected. Missing ID is a safe no-op.
- [ ] AC-NEW-2: When re-instantiating from cache (Race Again), animation groups are re-created via `instantiateModelsToScene()` — no stale `AnimationGroup` references survive.

---

## Implementation Notes

_Derived from ADR-0003 Implementation Guidelines:_

1. **Manifest registration** — `registerManifest()` stores a manifest data object keyed by string ID. The manifest contains `rootUrl`, `filename`, and any metadata needed by `load()`. This is a pure data registry — no Babylon.js types involved. Calling with the same ID silently overwrites (Map.set behavior).
2. **unloadAll()** — Iterates `this.cache.values()`, calls `container.removeAllFromScene(this.activeScene)` on each. Does NOT clear the cache. Used during PostRace→Menu transition.
3. **dispose()** — Iterates `this.cache.values()`, calls `container.dispose()` on each. Clears the cache. Sets state to `Disposed`. Used at application quit.
4. **Disposal order** — Physics bodies must be disposed BEFORE `entries.dispose()` (Havok crash risk). This story disposes containers only — the Entity/Car Lifecycle system disposes physics bodies.
5. **Animation group staleness** — See ADR-0003 Animation Group Lifecycle section:
   ```typescript
   // Safe: re-query after re-instantiation
   entries = container.instantiateModelsToScene();
   const newGroups = entries.animationGroups; // fresh instances
   newGroups[0].play();
   ```
6. **Name collision prevention** — `instantiateModelsToScene()` accepts a `nameFunction` parameter: `(sourceName) => teamId + '_' + sourceName`. Required when instantiating multiple car instances from the same base container.

---

## Out of Scope

- **Story 002**: `load()` and `get()` core mechanics (uses manifests registered here)
- **Story 005b**: GSM orchestration that calls `unloadAll()` and `setActiveScene()` during transitions

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**AC-7a/b/c: unloadAll removes from scene, keeps cache**

- Given: Initialized AssetManager, two containers cached (`'spa'`, `'monza'`), spy on each container's `removeAllFromScene()`
- When: `assetManager.unloadAll()` is called
- Then: `removeAllFromScene()` called 1× per container; `cache.size` is unchanged (2); `load('spa')` still resolves from cache
- Edge: Call `unloadAll()` twice — second call does not error, removals are no-ops
- Edge: Call `unloadAll()` with zero containers — no error, no-op

**AC-8a/b/c: dispose clears all**

- Given: Initialized AssetManager, two cached containers, spy on each container's `dispose()`
- When: `assetManager.dispose()` is called
- Then: `container.dispose()` called 1× per container; `cache.size === 0`; state is `'disposed'`
- Edge: Calling `dispose()` twice is idempotent (no double-dispose on containers)
- Edge: `load('spa')` after `dispose()` throws `AssetError('Already disposed')`
- Edge: `get('track_geo')` after `dispose()` throws `AssetError('Already disposed')`
- **AC-8b explicit**: menuScene and raceScene remain in `engine.scenes[]` — their `dispose()` was NOT called. Verify `engine.scenes.length` unchanged after `dispose()`.

**AC-9a/b/c/d: registerManifest storage and overwrite behavior**

- Given: Initialized AssetManager
- When: `registerManifest('spa', spaTrackManifest)` called, then called again with same ID
- Then: Both calls succeed; second call silently overwrites the first manifest
- Edge: Registering two different IDs (`'spa'` and `'monza'`) — both succeed
- Edge: `registerManifest` before `init()` throws `AssetError('Not initialized')`

**AC-NEW-1: disposeContainer targeted eviction**

- Given: Two cached containers `'spa'` and `'monza'`
- When: `disposeContainer('spa')` is called
- Then: `'spa'` container is disposed and removed from cache; `'monza'` remains in cache
- Edge: `disposeContainer('nonexistent')` — no error, safe no-op

**AC-NEW-2: Animation group re-clone on re-instantiation**

- Given: Cached container with animation groups
- When: First `instantiateModelsToScene()` → `entries.dispose()` → second `instantiateModelsToScene()` from same cache
- Then: The second `entries.animationGroups` are fresh instances (not disposed); calling `.play()` on them succeeds
- Edge: After `entries.dispose()`, calling `.play()` on old animation group instance throws

> **Note**: This AC tests `container.instantiateModelsToScene()` behavior — a Babylon.js engine concern, not AssetManager API. Validate via integration test or manual smoke check in Story 005b (GSM orchestration) or Entity/Car Lifecycle. Unit test in this story should verify that the container remains valid in cache after `disposeContainer` calls on other containers, not animation group staleness directly.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/asset-manager/asset-manager.test.ts`
**Status**: [x] Created — 22 tests, all passing

---

## Dependencies

- Depends on: Story 001 (init), Story 002 (load mechanism for cache setup)
- Unlocks: Story 005b (GSM orchestration calls `unloadAll()`)

---

## Completion Notes

**Completed**: 2026-06-29
**Criteria**: 11/12 passing (AC-NEW-2 deferred — integration concern for Story 005b)
**Deviations**: None
**Test Evidence**: `tests/unit/asset-manager/asset-manager.test.ts` — 56 tests, 1432/1432 full suite
**Code Review**: APPROVED via /code-review, fixes applied (get() guard, disposeContainer error consistency)
