# Story 005a: Preload Concurrency

> **Epic**: Asset Manager
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/asset-manager.md`
**Requirement**: `TR-AM-009`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0003: Two-Scene Architecture & Asset Lifecycle
**ADR Decision Summary**: `preload(ids: string[])` handles concurrency — multiple simultaneous loads via `Promise.all`. Race-session assets (all car GLBs, UI textures) load during Loading→Menu while splash screen is visible. Only the track GLB loads during Menu→PreRace transition.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Multiple concurrent `LoadAssetContainerAsync` calls are safe — Babylon.js queues them internally. Progress events per-asset (Story 003) fire independently for each concurrent load.

**Control Manifest Rules (this layer)**:

- Required: C2 (AssetContainers cached), C4 (Containers loaded against raceScene)
- Guardrail: C-G13 (Menu→Race < 2s, Race Again ~0ms)

---

## Acceptance Criteria

_From GDD `design/gdd/asset-manager.md`, scoped to this story:_

- [ ] AC-p1: `preload(['spa', 'monza'])` calls `LoadAssetContainerAsync` for each uncached ID. All started concurrently (no sequential await).
- [ ] AC-p2: `preload()` returns a single `Promise<void>` that resolves when ALL loads complete.
- [ ] AC-p3: If one preload asset fails, `'asset.error'` is emitted for that ID. Other assets continue loading. The overall Promise rejects.
- [ ] AC-p4: `'asset.load.allComplete'` is emitted with `{ ids: ['spa', 'monza'] }` when the entire batch finishes successfully.
- [ ] AC-p5: Preloading an already-cached ID skips that ID immediately (no I/O, no duplicate events).
- [ ] AC-p6: `preload([])` with an empty array resolves immediately — no events emitted, no async overhead.

---

## Implementation Notes

_Derived from ADR-0003 Implementation Guidelines:_

1. **Concurrent pattern** — Use `Promise.all(ids.map(id => this.loadOne(id)))` or similar. Each `loadOne()` calls `LoadAssetContainerAsync` independently.
2. **Batch events** — Emit `'asset.load.allComplete'` only when ALL assets in the batch complete successfully.
3. **Partial failure** — Wrap each individual load in try/catch. On failure, emit `'asset.error'` and store the error. After all settles, reject the overall preload Promise with one of the errors.
4. **Cache skip** — Check `this.cache.has(id)` before initiating load. Cached IDs are excluded from the batch entirely — no events fire for them during preload.
5. **Empty batch** — Return immediately. No events.

---

## Out of Scope

- **Story 005b**: GSM orchestration that calls `preload()` in response to state transitions
- **Story 003**: Per-asset progress events (consumed by this story's batch events)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**AC-p1/p2: preload loads multiple assets concurrently**

- Given: Initialized AssetManager, manifests `'spa'` and `'monza'` registered, spy on `LoadAssetContainerAsync`
- When: `await assetManager.preload(['spa', 'monza'])`
- Then: Both `LoadAssetContainerAsync` calls are initiated (concurrent — no sequence dependency); both containers cached; `cache.size === 2`
- Edge: Preloading an already-cached ID — skipped, only uncached IDs loaded

**AC-p3: preload partial failure**

- Given: `'spa'` load succeeds, `'monza'` load fails (rejects)
- When: `assetManager.preload(['spa', 'monza'])`
- Then: `'asset.error'` emitted for `'monza'`; `'spa'` container is cached; overall preload Promise rejects
- Edge: `'asset.load.allComplete'` is NOT emitted if any asset fails

**AC-p4: allComplete event on successful batch**

- Given: Both assets load successfully
- When: `await preload(['spa', 'monza'])` completes
- Then: `'asset.load.allComplete'` emitted with `{ ids: ['spa', 'monza'] }`

**AC-p6: Empty preload**

- Given: Empty array
- When: `preload([])`
- Then: Resolves immediately; no events emitted; no `LoadAssetContainerAsync` calls

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/asset-manager/story-005a-preload-concurrency_test.ts` OR playtest doc
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002 (single `load()`), Story 003 (event emission)
- Unlocks: Story 005b (GSM orchestration calls `preload()`)
