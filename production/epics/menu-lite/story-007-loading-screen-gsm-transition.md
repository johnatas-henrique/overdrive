# Story 007: Loading Screen + GSM Transition

> **Epic**: Menu LITE
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/menu-lite.md`
**Requirement**: `TR-MENU-009` — Loading screen: minimum 0.5s display (design goal: zero loading for Race Again). 10s timeout shows Still loading... message.

**ADR Governing Implementation**: ADR-0019: Menu LITE Architecture
**ADR Decision Summary**: Loading screen pre-created container. Track name + tip display. Configurable minimum display time (`menu.minLoadDuration`, default 2000ms). Promise-based asset tracking via `Promise.all()`. `tryTransition()` fires when both `minTimeElapsed` AND `allAssetsLoaded`. Calls `gsm.requestTransition(Menu→PreRace)`. 10s safety net → "Still loading..." indicator. Asset load failure → graceful return to Title.

**Engine**: Babylon.js 9.12.0 | **Risk**: MEDIUM
**Engine Notes**: `performance.now()` for timing (acceptable in menu code — not simulation). `Promise.all()` for asset containers. `setTimeout` for min duration timer and 10s safety net (acceptable for menu — timer drift imperceptible). ADR-0003 mandates `LoadAssetContainerAsync` (not `AssetsManager`).

**Control Manifest Rules (this layer)**:

- Required: P11 — Loading screen minimum configurable duration; skip if assets load faster; "Still loading" indicator at 10s
- Required: P10 — GSM local copy via Event Bus subscription
- Required: P8 — pre-created controls
- F23 — no system calls `gsm.getCurrent()` — react to events
- F7 — Event Bus synchronous emit

---

## Acceptance Criteria

_From GDD `design/gdd/menu-lite.md`, scoped to this story:_

- [ ] Loading screen displays the selected track name (large, centered) and a single random tip from the config tip pool (smaller, centered below).
- [ ] The screen remains visible for a minimum of `menu.minLoadDuration` ms (configurable, default 2000ms, range 500-5000).
- [ ] If all assets load before `minTimeElapsed`, the screen waits for the remaining time. If `minTimeElapsed` passes while assets are still loading, the screen waits for assets.
- [ ] `tryTransition()` fires only when BOTH `minTimeElapsed` === true AND `allAssetsLoaded` === true.
- [ ] When `tryTransition()` fires, calls `gsm.requestTransition(Menu→PreRace)` exactly once.
- [ ] If assets take longer than 10 seconds, a "Still loading..." text indicator appears below the tip. The original tip remains visible.
- [ ] If an asset fails to load (Promise rejection), display "Failed to load assets. Returning to menu..." text and automatically return to Title after 2 seconds.
- [ ] Applies Misto dark-panel style per art bible §7.1.

---

## Implementation Notes

_Derived from ADR-0019 Implementation Guidelines:_

```typescript
interface LoadingState {
  minTimeElapsed: boolean;
  allAssetsLoaded: boolean;
  transitionFired: boolean; // guard — fire only once
}
```

- Start loading: record `performance.now()`. Start `setTimeout(minDuration)` and `Promise.all(assetPromises)`.
- `tryTransition()`: `if (this.state.minTimeElapsed && this.state.allAssetsLoaded && !this.state.transitionFired)` → `this.state.transitionFired = true; gsm.requestTransition('PreRace')`.
- Asset failure: `Promise.allSettled()` or per-promise `.catch()` to track failures. On any failure, show failure message and set a 2s timer to pop to Title.
- Random tip: `SeededRandom` or simple `Math.floor(Math.random() * tips.length)`. Since this is not in the simulation pipeline, `Math.random()` is acceptable.
- "Race Again" logic lives in Story 008 (Results). This story provides only the `tryTransition()` infrastructure — it does not handle race configuration re-emission.
- The loading screen is a pure UI screen. The 3D scene is set up behind it and becomes visible when GSM transitions to PreRace.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 006: Race Setup → CONFIRM trigger. This story receives the asset loading request after CONFIRM.
- Story 008: Results screen, "Race Again" button, RaceConfiguration re-emission.
- Asset container loading: handled by Asset Manager (ADR-0003).

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

### TC-007-01: Minimum display duration enforced

- **Given**: All assets load in 500ms. `menu.minLoadDuration` = 2000ms.
- **When**: Loading screen is pushed.
- **Then**: Loading screen remains visible for at least 2000ms. `tryTransition` is NOT called before `minTimeElapsed`.

### TC-007-02: Assets-still-loading wait extends beyond min duration

- **Given**: `menu.minLoadDuration` = 2000ms. Assets take 5000ms to load.
- **When**: Loading screen is pushed.
- **Then**: After 2000ms, screen remains visible (assets not ready). `tryTransition` fires at 5000ms when all assets complete.

### TC-007-03: Both gates required for transition

- **Given**: `minTimeElapsed = true`, `allAssetsLoaded = false`.
- **When**: System checks transition readiness.
- **Then**: `tryTransition` is NOT called.
- **And**: `minTimeElapsed = false`, `allAssetsLoaded = true`.
- **Then**: `tryTransition` is NOT called.

### TC-007-04: Transition fires when both gates pass

- **Given**: `minTimeElapsed = true` AND `allAssetsLoaded = true`.
- **When**: System checks transition readiness.
- **Then**: `gsm.requestTransition(Menu→PreRace)` is called exactly once.

### TC-007-05: "Still loading..." appears after 10s

- **Given**: Assets have not loaded after 10000ms.
- **When**: 10001ms have elapsed on the loading screen.
- **Then**: "Still loading..." text element is visible. Original tip text remains visible (not replaced).

### TC-007-06: Loading tip sourced from config pool

- **Given**: Config pool has tips = ["Tip A", "Tip B", "Tip C"].
- **When**: Loading screen is pushed.
- **Then**: Displayed tip text matches one of the pool entries.

### TC-007-07: Asset load failure returns to Title

- **Given**: At least one asset fails to load.
- **When**: Loading screen is active.
- **Then**: "Failed to load assets" message appears. After 2000ms, screen automatically returns to Title.

**Edge cases:**

- All assets loaded before minLoadDuration → screen stays for min duration, then transitions immediately
- Empty tip pool → fallback text or no tip displayed (graceful degradation)
- Asset load starts before Race Setup confirm (prefetch) → `allAssetsLoaded` may already be true; transition still waits for `minTimeElapsed`
- `menu.minLoadDuration` set to 0 → floor at 1 frame (16ms)
- GSM transition fails → error logged, stack stays on Loading

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/menu-lite/loading-gsm-transition_test.ts` — must exist and pass

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (MenuLite Core — screen stack + GSM integration), Story 006 (Race Setup → CONFIRM trigger), Asset Manager (ADR-0003)
- Unlocks: Story 008 (Results screen — after Race ends)
