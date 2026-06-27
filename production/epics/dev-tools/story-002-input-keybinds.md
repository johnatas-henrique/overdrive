# Story 002: Input Keybinds

> **Epic**: Dev Tools
> **Status**: In Progress
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h
> **Last Updated**: 2026-06-26

## Context

**GDD**: `design/gdd/dev-tools.md`
**Requirement**: `TR-DVT-007`
_Dev-menu keybind — toggle key to show/hide overlay, reload key to trigger config reload, minimise key to toggle minimised overlay._

**ADR Governing Implementation**: ADR-0009: Dev Tools Architecture (with ADR-0006: Input Abstraction)
**ADR Decision Summary**: Toggle/reload keys via DOM `keydown` listener — zero Babylon.js dependency, works independently of the game's input pipeline. `event.preventDefault()` prevents toggle/reload keys from reaching game input when overlay is active. Lazy init: overlay DOM not created until first toggle press. Keybind values read from `DEV_TOOLS_KEYS` config (see `src/config/dev-tools-config.ts`).

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No Babylon.js APIs required for keybinds — uses DOM `keydown` events. Zero engine dependency for input handling.

**Control Manifest Rules (this layer)**:

- **Required** (D5): Dev Tools: toggle/reload keys via DOM `keydown` listener — zero Babylon.js dependency
- **Required** (D2): Dev Tools: lazy init on first toggle press — zero cost if never opened
- **Forbidden** (D-F1): Never intercept game input — overlay must have `pointer-events: none`
- **Required** (F21): Behind `import.meta.env.DEV` guard

---

## Acceptance Criteria

_From GDD `design/gdd/dev-tools.md`, scoped to this story:_

- [ ] AC-2a: The toggle key (default: backtick) toggles overlay — `devTools.isVisible()` reflects current state (true after first toggle press, false after toggle press again); DOM is created only on first press (lazy init), not on subsequent toggles
- [ ] AC-2b: The toggle and reload keys call `event.preventDefault()` when overlay is active — keys do not reach game input when consumed by Dev Tools; when overlay is hidden, toggle and reload keys pass through to game input
- [ ] AC-6a: The reload key (default: 1) calls `ConfigManager.reload()` (only when overlay is visible); overlay displays `"config reloaded — <key>: <old> → <new>"` with the changed value
- [ ] AC-6b: The minimise key (default: 2) toggles minimised overlay state (compact mode)
- [ ] AC-2c: `initDevTools(engine, scene)` is called in `app.ts` behind `if (import.meta.env.DEV)` guard — singleton is initialised at engine startup so keybinds can function

---

## Implementation Notes

_Derived from ADR-0009 and ADR-0006 Implementation Guidelines:_

1. **Key detection via DOM `keydown` listener**:

   Dev Tools uses DOM events (not DeviceSourceManager) for keybind handling. This keeps Dev Tools independent of the game's input pipeline — zero Babylon.js dependency for input.

   ```typescript
   document.addEventListener("keydown", handleKeyDown);
   ```

   Keybind values come from `DEV_TOOLS_KEYS` config (`src/config/dev-tools-config.ts`).

2. **Lazy init** (Control Manifest D2): Overlay DOM is not created until first toggle press. `DevTools` class has an `_initialized` flag checked in `toggle()`. On first toggle: create DOM, set up `SceneInstrumentation`, hook `onEndFrameObservable`. On subsequent toggles: toggle visibility only.

3. **`event.preventDefault()`**:

   ```typescript
   import { DEV_TOOLS_KEYS } from "../../config/dev-tools-config";

   // Inside keydown handler:
   const { toggle, reload } = DEV_TOOLS_KEYS;
   if (key === toggle || key === reload) {
     event.preventDefault(); // game never receives toggle/reload keys when overlay handles them
   }
   ```

   When overlay is hidden (isVisible = false), toggle/reload keys pass through to game.

4. **Reload key → ConfigManager.reload()**: Calls the Config Manager's reload API, reads the set of changed keys, and formats the notification string. The notification display is a simple DOM flash element that auto-dismisses after 2 seconds.

5. **Minimise key → minimised overlay**: Sets a `_minimised` flag. When minimised, the overlay collapses to a thin top bar showing only FPS and frame time. Restore on next minimise key press.

6. **`app.ts` wiring** (AC-2c): After engine and scene are created, call `initDevTools(engine, scene)` inside `if (import.meta.env.DEV)` block. This ensures the singleton is available when keybinds fire. Example:

   ```typescript
   if (import.meta.env.DEV) {
     const { initDevTools } = await import("./core/dev-tools");
     initDevTools(engine, scene);
   }
   ```

7. **Interface consumed by Story 003**:
   ```typescript
   interface IDevTools {
     // defined in Story 003, consumed here
     toggle(): void;
     isVisible(): boolean;
     setMinimised(val: boolean): void;
     dispose(): void;
   }
   ```

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 001]: `import.meta.env.DEV` compile guard and module shell
- [Story 003]: HTML overlay DOM, metrics display (`SceneInstrumentation`), `onEndFrameObservable` setup
- [Stories 004-008]: Individual data source panels and their lifecycle

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-2a**: toggle state machine
  - Given: a DevTools instance with `isVisible() = false` (lazy, no DOM created)
  - When: `toggle()` is called
  - Then: `isVisible()` returns `true` and `lazyInit()` has been called exactly once
  - When: `toggle()` is called again
  - Then: `isVisible()` returns `false`

- **AC-2a**: lazy init only on first toggle
  - Given: a DevTools instance with `lazyInit()` not yet called
  - When: `toggle()` is called 3 times (visible, hidden, visible)
  - Then: `lazyInit()` was called exactly once (on the first toggle only)

- **AC-2b**: `preventDefault` when active
  - Given: a DevTools instance with `isVisible() = true`
  - When: `handleKeyDown(mockKeyboardEvent)` is called with `key = DEV_TOOLS_KEYS.toggle`
  - Then: `mockKeyboardEvent.preventDefault()` was called exactly once

- **AC-2b**: no `preventDefault` when inactive
  - Given: a DevTools instance with `isVisible() = false`
  - When: `handleKeyDown(mockKeyboardEvent)` is called with `key = DEV_TOOLS_KEYS.toggle`
  - Then: `mockKeyboardEvent.preventDefault()` was NOT called

- **AC-2b**: only toggle/reload keys are consumed
  - Given: a DevTools instance with `isVisible() = true`
  - When: `handleKeyDown(mockEvent)` is called with `key = 'Escape'`
  - Then: `mockEvent.preventDefault()` was NOT called

- **AC-6a**: reload key triggers config reload
  - Given: overlay is visible and ConfigManager has registered namespaces
  - When: the reload key is pressed
  - Then: `ConfigManager.reload()` is called; overlay shows "config reloaded — teams.macklen.motor: 3 → 4" (with actual changed key/value)

- **AC-2c**: initDevTools called in app.ts
  - Given: game starts in dev mode (`import.meta.env.DEV === true`)
  - When: engine and scene are created
  - Then: `initDevTools(engine, scene)` is called — verify via `getDevTools()` returning non-null instance
  - Note: in production build, `initDevTools` is never called (tree-shaken)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/dev-tools/input-keybinds.test.ts` — must exist and pass (covers AC-2a, AC-2b, AC-6a, AC-6b, AC-2c)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (compile guard), Story 003 (needs `IDevTools` interface for `toggle()`)
- Unlocks: None directly; all panel stories (004-008) depend on overlay shell (003) which depends on keybinds for activation
