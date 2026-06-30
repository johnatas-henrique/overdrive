# Story 003: Loading Progress & Error Events

> **Epic**: Asset Manager
> **Status**: Complete
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/asset-manager.md`
**Requirement**: `TR-AM-005`, `TR-AM-006`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0003: Two-Scene Architecture & Asset Lifecycle
**ADR Decision Summary**: Asset load errors must not crash the game — `'asset.error'` emitted on Event Bus, fallback material applied by the requesting system. Progress and completion events fire to drive the loading screen.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: `LoadAssetContainerAsync` returns a Promise. Rejection is caught and emitted as `'asset.error'`. Texture load failures produce a Babylon.js warning with a checkerboard fallback — not a rejection. The Asset Manager must detect this pattern.

**Control Manifest Rules (this layer)**:

- Required: C5 (`'asset.error'` event on load failure — GSM remains in Loading, fallback material applied)
- Event Bus pattern (F7-F10): synchronous emit, `Subscription` with `unsubscribe()`, no microtask queuing

---

## Acceptance Criteria

_From GDD `design/gdd/asset-manager.md`, scoped to this story:_

- [ ] AC-6a: When `LoadAssetContainerAsync` rejects (e.g., 404 on GLB), `'asset.error'` is emitted on Event Bus with `{ assetId: string, error: Error }`, AND `load()` rejects with the original Error (caller must handle).
- [ ] AC-6b: After a load error, the failed asset container is NOT added to the cache.
- [ ] AC-6c: When loading a batch via `preload()` and one asset fails, `'asset.error'` is emitted for the failed ID and the other assets continue loading. (Deferred to Story 005a — test preload partial failure.)
- [ ] AC-10a: `'asset.load.start'` is emitted at the beginning of `load()` with `{ ids: [manifestId] }`.
- [ ] AC-10b: `'asset.load.progress'` is emitted during `load()` with `{ id: string, loaded: number, total: number }` — fires at least once. For single-GLB: `{ loaded: 1, total: 1 }`.
- [ ] AC-10c: `'asset.load.complete'` is emitted on successful load with `{ id: string }`.
- [ ] AC-10d: When loading from cache (second `load('spa')`), all three events (`start`, `progress`, `complete`) fire identically to a first load — including correct payload values (`{ loaded: 1, total: 1 }` for progress).

---

## Implementation Notes

_Derived from ADR-0003 Implementation Guidelines:_

0. **EventMap prerequisite** — Before implementation, add to `EventMap` in `src/foundation/event-bus/types.ts`:
   ```typescript
   "asset.load.start": { ids: string[] };
   "asset.load.progress": { id: string; loaded: number; total: number };
   "asset.load.complete": { id: string };
   ```
   Also add `'asset.error': { assetId: string; error: Error }` if not already present.
1. **EventBus injection** — AssetManager receives `IEventBus` via constructor parameter (dependency injection per ADR-0003 and Control Manifest). Store as private field. If no EventBus is provided, events are silently not emitted (graceful degradation for testing).
2. **Event emission order** — For a single asset load: `'asset.load.start'` → `'asset.load.progress'` → `'asset.load.complete'`
3. **Progress values** — For a single-GLB load, `loaded: 1, total: 1`. For batch (Story 005a), cumulative across all assets.
4. **Cache-hit events** — Even when returning from cache, emit all three events so the loading screen has a consistent event model. Progress fires synchronously with `{ loaded: 1, total: 1 }`.
5. **Error handling** — Wrap the `LoadAssetContainerAsync` call in try/catch. On error, emit `'asset.error'` and re-throw so the caller knows the load failed. The failed asset must NOT be added to the cache.
6. **Texture missing** — Babylon.js logs a warning and shows a checkerboard pattern. Detect via `scene.onTextureLoadingErrorObservable` if available. Emit `'asset.error'` with the texture ID. Manual smoke check required (not unit-testable).

---

## Out of Scope

- **Story 005a**: Batch progress via `'asset.load.allComplete'` and partial failure in preload
- **Loading screen UI**: Progress consumption is handled by Menu LITE and HUD

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**AC-6a: Load failure emits asset.error**

- Given: Initialized AssetManager with EventBus, mocked `LoadAssetContainerAsync` that rejects with `Error('404 Not Found')`, spy subscriber on `'asset.error'`
- When: `load('spa')` is called (rejects)
- Then: `eventBus.emit` was called with `'asset.error'` and payload `{ assetId: 'spa', error: Error }`
- Then: `load('spa')` rejects with the original Error (not swallowed)
- Edge: After the error, cache does NOT contain `'spa'`
- Edge: `'asset.load.complete'` is NOT emitted for the failed asset

**AC-10a/b/c: Progress events fire during successful load**

- Given: Initialized AssetManager, `LoadAssetContainerAsync` resolves normally, spy subscribers on `'asset.load.start'`, `'asset.load.progress'`, `'asset.load.complete'`
- When: `await load('spa')` completes
- Then: `'asset.load.start'` emitted with `{ ids: ['spa'] }`; `'asset.load.progress'` emitted ≥1× with `{ id: 'spa', loaded: 1, total: 1 }`; `'asset.load.complete'` emitted with `{ id: 'spa' }`
- Edge: Events fire in order: `start` → `progress` → `complete`
- Edge: No `'asset.error'` emitted for successful load

**AC-10d: Events fire for cached second load**

- Given: First `load('spa')` completed and cached
- When: Second `await load('spa')` completes
- Then: `'asset.load.start'`, `'asset.load.progress'`, and `'asset.load.complete'` all fire (same as first call, even though no I/O occurs)
- Then: progress event payload is `{ id: 'spa', loaded: 1, total: 1 }`
- Then: complete event payload is `{ id: 'spa' }`

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/asset-manager/asset-manager-lifecycle.test.ts` (extend existing) + `tests/unit/asset-manager/asset-manager.test.ts` (extend existing)
**Status**: ✅ Verified — 58 tests pass (38 unit + 20 integration), 100% coverage on `asset-manager.ts`

---

## Dependencies

- Depends on: Story 001 (init), Story 002 (load mechanism)
- Unlocks: Story 005a (preload events), Story 005b (GSM orchestration reacts to events)
