# Story 005b: GSM Orchestration

> **Epic**: Asset Manager
> **Status**: Complete
> **Last Updated**: 2026-06-29
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/asset-manager.md`
**Requirement**: `TR-AM-008`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0003: Two-Scene Architecture & Asset Lifecycle
**ADR Decision Summary**: Asset Manager subscribes to `'gsm.state.entered'` to trigger preloading, scene switching, and unloading at the correct lifecycle points. This keeps orchestration logic in the Asset Manager — not scattered across GSM or other systems.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: GSM (ADR-0024) emits two events per transition: `'gsm.state.exited'` then `'gsm.state.entered'`. The Asset Manager subscribes to `'gsm.state.entered'` only. Event Bus is synchronous — handlers execute on the same call stack.

**Control Manifest Rules (this layer)**:

- Required: C1 (Two persistent scenes — `setActiveScene()` controls rendering), C4 (Containers loaded against raceScene)
- Event Bus pattern: F7 (synchronous emit), F8 (Subscription with `unsubscribe()`), F23 (No system calls `gsm.getCurrent()` — all systems react to GSM events)

---

## Acceptance Criteria

_From GDD `design/gdd/asset-manager.md`, scoped to this story:_

- [ ] AC-g1: On `'gsm.state.entered'` with `{ to: 'Menu', from: 'Loading' }`, Asset Manager calls `preload(carManifestIds)` — all 8 car GLBs, UI textures, and audio files.
- [ ] AC-g2: On `'gsm.state.entered'` with `{ to: 'PreRace', from: 'Menu' }`, Asset Manager calls `setActiveScene('race')` then `load(currentTrackId)`.
- [ ] AC-g3: On `'gsm.state.entered'` with `{ to: 'Menu', from: 'PostRace' }`, Asset Manager calls `unloadAll()` then `setActiveScene('menu')`.
- [ ] AC-g4: Asset Manager subscribes to `'gsm.state.entered'` during `init()`. The subscription is released on `dispose()` — no dangling listeners after shutdown.
- [ ] AC-g5: `src/config/assets/cars.ts` exports `CAR_MANIFEST_IDS` — an array of 8 string IDs, one per team. No Babylon.js imports.

---

## Implementation Notes

_Derived from ADR-0003 Implementation Guidelines:_

1. **Subscription pattern** — In `init()`:
   ```typescript
   this.gsmSub = eventBus.on("gsm.state.entered", (payload) => {
     switch (payload.state) {
       case "Menu":
         if (payload.previous === "Loading") this.preload(CAR_MANIFEST_IDS);
         if (payload.previous === "PostRace") {
           this.unloadAll();
           this.setActiveScene("menu");
         }
         break;
       case "PreRace":
         this.setActiveScene("race");
         this.load(currentTrackId);
         break;
     }
   });
   ```
2. **Subscription release** — In `dispose()`: `this.gsmSub.unsubscribe()`. Prevents leaks on app quit.
3. **No async in handler** — The GSM event handler fires `preload()`/`load()` which are async. The handler itself does not await — it fires and forgets. The loading screen listens to progress events.
4. **Car manifest IDs** — Defined in `src/config/assets/cars.ts` (8 entries, one per team). Referenced by constant, not hardcoded.
5. **Current track ID** — Read from `TrackConfig.currentTrackId` (a simple string setter in `src/config/`). Set by the UI adapter before GSM transitions to PreRace. Never read via `gsm.getCurrent()`.

---

## Out of Scope

- **Story 001**: `setActiveScene()` implementation (called but not defined here)
- **Story 004**: `unloadAll()` implementation (called but not defined here)
- **Story 005a**: `preload()` implementation (called but not defined here)
- **Loading screen UI**: Progress consumption by Menu LITE/HUD

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**AC-g1: GSM Loading→Menu triggers car preload**

- Given: Initialized AssetManager, spy on `assetManager.preload()`, mock Event Bus
- When: `eventBus.emit('gsm.state.entered', { to: 'Menu', from: 'Loading' })`
- Then: Asset Manager's handler calls `preload()` with the car manifest IDs (8 cars)
- Edge: Other `'gsm.state.entered'` events (e.g., Racing→PostRace) do NOT trigger preload

**AC-g2: GSM Menu→PreRace triggers track load + scene switch**

- Given: Mock Event Bus, spy on `setActiveScene()` and `load()`
- When: `eventBus.emit('gsm.state.entered', { to: 'PreRace', from: 'Menu' })`
- Then: `setActiveScene('race')` is called first, then `load(currentTrackId)` is called; order is: scene switch before load
- Edge: Guard — load is NOT called if no track ID is configured

**AC-g3: GSM PostRace→Menu triggers unload + scene switch**

- Given: Mock Event Bus, spy on `unloadAll()` and `setActiveScene()`
- When: `eventBus.emit('gsm.state.entered', { to: 'Menu', from: 'PostRace' })`
- Then: `unloadAll()` is called, then `setActiveScene('menu')` is called; order is: unload before scene switch

**AC-g4: Subscription lifecycle**

- Given: Spy on `eventBus.on('gsm.state.entered')`
- When: `init()` is called
- Then: `eventBus.on()` was called with `'gsm.state.entered'` and a handler function
- Edge: After `dispose()`, verify the subscription was unsubscribed

**AC-g5: Car manifest IDs config file**

- Given: `src/config/assets/cars.ts` exists
- When: File is imported
- Then: Exports `CAR_MANIFEST_IDS` array with exactly 8 string entries
- Edge: No Babylon.js imports in the file

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/asset-manager/gsm-orchestration.test.ts` OR playtest doc
**Status**: [x] Created and passing (11 integration tests)

---

## Dependencies

- Depends on: Story 001 (`setActiveScene()`), Story 004 (`unloadAll()`), Story 005a (`preload()`)
- Unlocks: GSM integration — Menu LITE, HUD, Entity/Car Lifecycle (downstream consumers)

## Completion Notes

**Completed**: 2026-06-29
**Criteria**: 5/5 passing
**Deviations**: None
**Test Evidence**: 11 integration tests at `tests/integration/asset-manager/gsm-orchestration.test.ts`
**Code Review**: Complete — APPROVED with fixes applied (fire-and-forget .catch, call ordering, AC-g5 assertion)
**Tech Debt Logged**: 2 items (currentTrackId validation, fire-and-forget error suppression)
**Docs Fixed**: Story ACs corrected from `{ state, previous }` to `{ from, to }` per EventMap
