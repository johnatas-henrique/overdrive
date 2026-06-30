# Story 001: AssetManager Init & Two-Scene Setup

> **Epic**: Asset Manager
> **Status**: Complete
> **Last Updated**: 2026-06-29
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/asset-manager.md`
**Requirement**: `TR-AM-001`, `TR-AM-002`, `TR-AM-003`, `TR-AM-004`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0003: Two-Scene Architecture & Asset Lifecycle
**ADR Decision Summary**: Two persistent scenes (`menuScene` + `raceScene`) coexist in `engine.scenes[]`. AssetContainers cached via `Map<string, AssetContainer>`. Only one scene renders per frame via `setActiveScene()`.

**Engine**: Babylon.js 9.12.0 | **Risk**: MEDIUM
**Engine Notes**: AssetContainers are scene-bound — `instantiateModelsToScene()` does NOT accept a scene parameter. Containers must be loaded against their target scene. Use `SceneLoader.LoadAssetContainerAsync(url, null, null, scene)` always passing an explicit scene reference. Pipeline drives from `engine.runRenderLoop()` (ADR-0002), not from `scene.onBeforeRenderObservable`.

**Control Manifest Rules (this layer)**:

- Required: C1 (Two persistent scenes — `menuScene` and `raceScene` coexist in `engine.scenes[]`), C2 (AssetContainers cached — `Map<string, AssetContainer>`), C3 (Only `SceneLoader.LoadAssetContainerAsync` — sync variants deprecated since v7.34), C4 (Containers loaded against raceScene, `removeAllFromScene()` after load; menu assets against menuScene)
- Guardrail: C-G12 (~22MB memory budget), C-G13 (<2s Menu→Race, ~0ms Race Again)

---

## Acceptance Criteria

_From GDD `design/gdd/asset-manager.md`, scoped to this story:_

- [x] AC-1.1: `AssetManager.init(menuScene, raceScene)` creates an empty cache (`Map<string, AssetContainer>`), stores both scene references, and transitions state to `Ready`.
- [x] AC-1.2: After `init()`, both `menuScene` and `raceScene` exist in `engine.scenes[]` — confirmed via `engine.scenes.length >= 2`.
- [x] AC-1.3: `AssetManager.setActiveScene('menu')` sets active scene to `menuScene`; subsequent calls to `addAllToScene(container)` route to `menuScene`.
- [x] AC-1.4: `AssetManager.setActiveScene('race')` sets active scene to `raceScene`; subsequent calls to `addAllToScene(container)` route to `raceScene`.
- [x] AC-1.5: Calling `setActiveScene()` before `init()` throws `AssetError('Not initialized')`.
- [x] AC-1.6: Playground scaffolding removed — `src/playground/gui.ts` and `src/playground/main-scene.ts` deleted. `app.ts` updated to use `AssetManager.init(menuScene, raceScene)` instead of `CreateMainScene`. No imports from `src/playground/` remain in the codebase.

---

## Implementation Notes

_Derived from ADR-0003 Implementation Guidelines:_

1. **Scene creation order** — At `Application.start()`: create `Engine`, then `menuScene = new Scene(engine)`, then `raceScene = new Scene(engine)`. Both exist before `AssetManager.init()`.
2. **init() stores references** — AssetManager stores `menuScene` and `raceScene` as private fields. `activeScene` defaults to `menuScene`.
3. **setActiveScene() is a setter** — Sets `activeScene = menuScene` or `activeScene = raceScene`. Called by GSM orchestration (Story 005b) or manually.
4. **addAllToScene routing** — Internal helper `_addAllToScene(container)` delegates to `container.addAllToScene(this.activeScene)`.
5. **Both scenes respond to resize** — Babylon.js `engine.resize()` iterates `engine.scenes[]` automatically.
6. **Pipeline independence** — Pipeline runs from `engine.runRenderLoop()`, not scene render callbacks. Active scene rendering is separate from simulation tick.
7. **GDD signature deviation** — The GDD (`design/gdd/asset-manager.md`) shows `setActiveScene(scene: Scene)` accepting a Scene object. This story uses `setActiveScene(scene: 'menu' | 'race')` — string-based routing per ADR-0003 Invariant #2. The string approach is safer: it prevents passing an arbitrary Scene and makes the active scene explicit in call sites.

---

## Out of Scope

- **Story 002**: Asset loading via `LoadAssetContainerAsync` (uses the scene references set up here)
- **Story 005b**: GSM orchestration that calls `setActiveScene()` in response to state transitions

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**AC-1.1: Init creates cache and stores scenes**

- Given: A Babylon.js `Engine` with two scenes created via `new Scene(engine)`
- When: `AssetManager.init(menuScene, raceScene)` is called
- Then: Internal cache is an empty `Map` (`cache.size === 0`); `engine.scenes[]` contains both scenes; state is `'ready'`
- Edge: `init()` called twice — second call is idempotent no-op (no error, no double-cleanup)

**AC-1.2: Both scenes registered in engine.scenes[]**

- Given: A Babylon.js `Engine` with zero scenes
- When: `AssetManager.init(menuScene, raceScene)` is called
- Then: `engine.scenes.length === 2`; `engine.scenes[0]` is `menuScene`; `engine.scenes[1]` is `raceScene`

**AC-1.3/1.4: setActiveScene routes getActiveScene()**

- Given: Initialized AssetManager with two real scenes
- When: `setActiveScene('race')` is called
- Then: `getActiveScene()` returns `raceScene`
- When: `setActiveScene('menu')` is called
- Then: `getActiveScene()` returns `menuScene`
- Edge: Calling `setActiveScene` with an invalid scene name throws `AssetError`

_Note: In Babylon.js 9.12.0, `AssetContainer.addAllToScene()` takes no parameters — the container is scene-bound at load time. `setActiveScene()` controls which scene renders, not where containers add meshes._

**AC-1.5: setActiveScene before init throws**

- Given: A new `AssetManager` instance, not initialized
- When: `setActiveScene('race')` is called
- Then: Throws `AssetError('Not initialized')`

**Edge: _addAllToScene before init throws**

- Given: A new `AssetManager` instance, not initialized
- When: Internal `_addAllToScene(mockContainer)` is invoked
- Then: Throws `AssetError('Not initialized')`

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Unit test: `tests/unit/asset-manager/asset-manager.test.ts` — mocked Engine/Scene, verifies internal state (cache, activeScene, routing logic, error paths)
- Integration test: `tests/integration/asset-manager/asset-manager-lifecycle.test.ts` — real Babylon.js NullEngine + Scene instances, verifies engine.scenes registration, scene routing, and playground removal
**Status**: [x] Created — 23 tests (12 unit + 11 integration), all passing

### AC-1.6 Verification Checklist (non-runtime)
- [x] `src/playground/gui.ts` deleted
- [x] `src/playground/main-scene.ts` deleted
- [x] `src/playground/ai-telemetry-mock.ts` deleted (only if no other consumer)
- [x] `app.ts` uses `AssetManager.init(menuScene, raceScene)` — no `CreateMainScene` import
- [x] `grep -r "src/playground" src/` returns zero matches
- [x] `grep -r "CreateMainScene" src/` returns zero matches

---

## Dependencies

- Depends on: None (first Asset Manager story)
- Unlocks: Story 002 (Asset Load & Cache), Story 003 (Loading Events)

---

## Completion Notes

**Completed**: 2026-06-29
**Criteria**: 6/6 passing (all ACs verified via unit + integration tests)
**Deviations**: None
**Test Evidence**: Unit test `tests/unit/asset-manager/asset-manager.test.ts` (12 tests) + Integration test `tests/integration/asset-manager/asset-manager-lifecycle.test.ts` (11 tests) — all passing
**Code Review**: APPROVED (babylonjs-specialist + qa-tester review, all findings addressed)
**Verification Gate**: Lint ✅ | Typecheck ✅ | Test ✅ (1379/1379) | Build ✅

### Post-implementation fixes
- Added placeholder `ArcRotateCamera` to both scenes (Babylon.js requires camera to render)
- Updated test file names to match project convention (`[system].test.ts`)
- Updated test function names to match project convention (`it('should ...')`)
- Added `cacheSize` getter for testability
- Updated QA test case AC-1.3/1.4 to match Babylon.js 9.12.0 zero-args `addAllToScene()` API
