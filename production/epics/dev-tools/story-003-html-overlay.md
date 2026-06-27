# Story 003: HTML Overlay

> **Epic**: Dev Tools
> **Status**: Ready
> **Layer**: Core
> **Type**: UI
> **Manifest Version**: 2026-06-21
> **Estimate**: 10h

## Context

**GDD**: `design/gdd/dev-tools.md`
**Requirement**: `TR-DVT-001`
_HTML overlay rendering above 3D viewport — FPS, draw calls, mesh count, physics bodies count, and system tick timing; position absolute, z-index 1000._

**ADR Governing Implementation**: ADR-0009: Dev Tools Architecture
**ADR Decision Summary**: HTML overlay div positioned absolutely over canvas container (`pointer-events: none`). `SceneInstrumentation` for metrics. `engine.onEndFrameObservable` for overlay refresh. Config tree uses `<details>` for collapsed sections (zero DOM nodes). Lazy init on first F1 press.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: `SceneInstrumentation` imported from `@babylonjs/core/Instrumentation/sceneInstrumentation` — standard Core API. `engine.onEndFrameObservable` fires synchronously after each complete frame render.

**Control Manifest Rules (this layer)**:

- **Required** (D1): HTML overlay — positioned absolutely over canvas container (`pointer-events: none`)
- **Required** (D2): Lazy init on first F1 press — zero cost if never opened
- **Required** (D3): `SceneInstrumentation` for metrics (FPS, frame time, draw calls, physics time). Not custom counters.
- **Required** (D4): `engine.onEndFrameObservable` for overlay refresh — fires after complete frame render
- **Forbidden** (D-F1): Never intercept game input — overlay must have `pointer-events: none`

---

## Acceptance Criteria

_From GDD `design/gdd/dev-tools.md`, scoped to this story:_

- [ ] AC-3a: Overlay DOM is created on first F1 press as a sibling of `<canvas>` inside `engine.getRenderingCanvas().parentElement`; subsequent F1 presses toggle `display:none`/`display:flex`
- [ ] AC-3b: Top bar shows FPS, frame time, draw calls, mesh count — values update every frame (refreshed by `engine.onEndFrameObservable`)
- [ ] AC-3c: `SceneInstrumentation` captures `frameTime`, `physicsTime`, `drawCalls` — visible in top bar
- [ ] AC-3d: Overlay refresh is driven by `engine.onEndFrameObservable` (fires synchronously after each complete frame)
- [ ] AC-7: `pointer-events: none` CSS property on overlay div — clicking on the overlay does not interact with the game canvas
- [ ] AC-9: Overlay with 100+ config keys expanded maintains ≥55 FPS during scroll; no visible scroll jank or stutter

---

## Implementation Notes

_Derived from ADR-0009 Implementation Guidelines:_

1. **`IDevTools` interface** (defined here, consumed by Story 002 and panel stories):

   ```typescript
   interface IDevTools {
     registerDataSource(
       name: string,
       reader: () => Record<string, unknown>
     ): void;
     toggle(): void;
     isVisible(): boolean;
     setMinimised(val: boolean): void;
     update(): void;
     dispose(): void;
   }
   ```

2. **Overlay DOM creation** (lazy, on first F1 press):

   ```typescript
   if (import.meta.env.DEV) {
     const canvas = engine.getRenderingCanvas();
     const container = canvas?.parentElement;
     if (!container) return;
     const overlay = document.createElement("div");
     overlay.id = "dev-overlay";
     overlay.style.cssText =
       "position:absolute;inset:0;pointer-events:none;z-index:10";
     container.appendChild(overlay);
   }
   ```

3. **DOM structure**:

   ```
   div#dev-overlay
     ├── .top-bar: FPS, frame time, draw calls, mesh count
     ├── .sidebar: Config tree container (via <details>/<summary>)
     ├── .main-panel: Tab container
     │     ├── [tab: AI Telemetry] table per car
     │     ├── [tab: Event Log] scrollable, last 100 events
     │     └── [tab: GSM History] timeline, last 20 transitions
     └── .bottom-bar: Input state, physics timestep
   ```

4. **SceneInstrumentation** (only Babylon.js Core import):

   ```typescript
   import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
   const inst = new SceneInstrumentation(scene);
   inst.captureFrameTime = true;
   inst.captureRenderTime = true;
   inst.capturePhysicsTime = true;
   // Access: inst.drawCallsCounter.current, inst.frameTimeCounter.current
   ```

5. **Frame-end refresh**:

   ```typescript
   if (import.meta.env.DEV) {
     engine.onEndFrameObservable.add(() => {
       this._refreshDisplay();
     });
   }
   ```

6. **CSS**: Game palette — Track Black `#0a0a0a` background, Signal Yellow `#ffd700` accents, white monospace text (`font-family: 'Courier New', monospace`). `width: 100%; height: 100%` with automatic resize to fill canvas container.

7. **Performance (AC-9)**: Config tree uses `<details>` elements — collapsed sections render zero DOM nodes. Only visible tab panels render their content. DOM node count stays < 200 even with 100+ config keys.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 001]: `import.meta.env.DEV` compile guard and module shell
- [Story 002]: Keybind handling (F1/F2/F3) — this story provides `IDevTools` interface they consume
- [Story 004]: Config tree content population and in-place editing
- [Story 005]: Event Bus inspector panel
- [Story 006]: GSM visualizer panel
- [Story 007]: Simulation Snapshot panel
- [Story 008]: AI Telemetry tab panel

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-3a**: DOM creation and visibility toggle
  - Setup: Run game in dev mode, open browser DevTools Elements panel
  - Step 1: Verify no `div#dev-overlay` exists in DOM before pressing F1
  - Step 2: Press F1 → `div#dev-overlay` appears in DOM as a sibling of `<canvas>`
  - Step 3: Verify `overlay.style.display === "flex"`
  - Step 4: Press F1 again → `overlay.style.display === "none"`
  - Step 5: Press F1 again → `overlay.style.display === "flex"`
  - Pass condition: DOM node created only on first F1 toggles between visible/hidden on subsequent presses

- **AC-3b/3c**: metrics visible in top bar
  - Setup: Overlay visible, game running (any state)
  - Step 1: Locate top bar of overlay
  - Step 2: Verify FPS counter shows a number that changes each frame
  - Step 3: Verify frame time shows a millisecond value
  - Step 4: Verify draw calls shows an integer that changes based on scene complexity
  - Step 5: Verify mesh count shows an integer
  - Pass condition: All four metrics present, values are live-updating

- **AC-3d**: overlay refresh via onEndFrameObservable
  - Setup: Overlay visible, game running
  - Step 1: Observe FPS counter value
  - Step 2: Wait for 60 frames (~1 second)
  - Pass condition: FPS counter updates every frame (changes at game frame rate)

- **AC-7**: pointer-events none
  - Setup: Overlay visible, mouse cursor on an overlay element
  - Step 1: Inspect `dev-overlay` in Elements panel → computed style
  - Step 2: Click anywhere on overlay while a clickable game element is behind it
  - Pass condition: `pointer-events` CSS property is `"none"`; clicking on overlay passes through to game canvas

- **AC-9**: 100+ config keys performance
  - Setup: Register 100+ config keys in Config Manager, open overlay, expand all config tree sections
  - Step 1: Observe FPS counter on overlay while scrolling through all config keys
  - Step 2: Verify no visible stutter/jank during smooth scrolling
  - Pass condition: FPS stays ≥55 and scroll is visually smooth

---

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/html-overlay-evidence.md` or interaction test with sign-off

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (compile guard must exist for `import.meta.env.DEV` gating)
- Unlocks: Story 002 (needs `IDevTools.toggle()`), Stories 004-008 (need `IDevTools.registerDataSource()`)
