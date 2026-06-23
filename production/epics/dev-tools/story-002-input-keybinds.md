# Story 002: Input Keybinds

> **Epic**: Dev Tools
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/dev-tools.md`
**Requirement**: `TR-DVT-007`
_Dev-menu keybind — F1 to toggle overlay, F2 to toggle full event display, F3 to toggle minimised overlay._

**ADR Governing Implementation**: ADR-0009: Dev Tools Architecture (with ADR-0006: Input Abstraction)
**ADR Decision Summary**: F1/F2 polled via Input's `DeviceSourceManager` keyboard path — not named `InputState` fields (InputState has no F1/F2). `event.preventDefault()` prevents F1/F2 from reaching game input when overlay is active. Lazy init: overlay DOM not created until first F1 press.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Uses `DeviceSourceManager` from `@babylonjs/core` (`DeviceInput/deviceSourceManager`). This is a standard Babylon.js Core import — no post-cutoff APIs needed.

**Control Manifest Rules (this layer)**:

- **Required** (D5): F1/F2 polled via Input's DeviceSourceManager keyboard path — not named InputState fields
- **Required** (D2): Dev Tools: lazy init on first F1 press — zero cost if never opened
- **Forbidden** (D-F1): Never intercept game input — overlay must have `pointer-events: none`
- **Required** (F21): Behind `__DEV__` guard

---

## Acceptance Criteria

_From GDD `design/gdd/dev-tools.md`, scoped to this story:_

- [ ] AC-2a: F1 toggles overlay — `devTools.isVisible()` reflects current state (true after first F1 press, false after F1 press again); DOM is created only on first press (lazy init), not on subsequent toggles
- [ ] AC-2b: F1/F2 call `event.preventDefault()` when overlay is active — keys do not reach game input when consumed by Dev Tools; when overlay is hidden, F1/F2 pass through to game input
- [ ] AC-6a: F2 calls `ConfigManager.reload()` (only when overlay is visible); overlay displays `"config reloaded — <key>: <old> → <new>"` with the changed value
- [ ] AC-6b: F3 toggles minimised overlay state (compact mode)

---

## Implementation Notes

_Derived from ADR-0009 and ADR-0006 Implementation Guidelines:_

1. **Key detection via `DeviceSourceManager`**:

   ```typescript
   import { DeviceSourceManager } from "@babylonjs/core/DeviceInput/deviceSourceManager";
   import { DeviceType } from "@babylonjs/core/DeviceInput/deviceEnums";
   ```

   Poll keyboard state each tick via `dsm.getDeviceSource(DeviceType.Keyboard)`.

2. **Lazy init** (Control Manifest D2): Overlay DOM is not created until first F1 press. `DevTools` class has an `_initialized` flag checked in `toggle()`. On first toggle: create DOM, set up `SceneInstrumentation`, hook `onEndFrameObservable`. On subsequent toggles: toggle visibility only.

3. **`event.preventDefault()`**:

   ```typescript
   // Inside keydown handler:
   if (key === "F1" || key === "F2") {
     event.preventDefault(); // game never receives F1/F2 when overlay handles them
   }
   ```

   When overlay is hidden (isVisible = false), F1/F2 pass through to game.

4. **F2 → ConfigManager.reload()**: Calls the Config Manager's reload API, reads the set of changed keys, and formats the notification string. The notification display is a simple DOM flash element that auto-dismisses after 2 seconds.

5. **F3 → minimised overlay**: Sets a `_minimised` flag. When minimised, the overlay collapses to a thin top bar showing only FPS and frame time. Restore on next F3 press.

6. **Interface consumed by Story 003**:
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

- [Story 001]: `__DEV__` compile guard and module shell
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
  - When: `handleKeyDown(mockKeyboardEvent)` is called with `key = 'F1'`
  - Then: `mockKeyboardEvent.preventDefault()` was called exactly once

- **AC-2b**: no `preventDefault` when inactive
  - Given: a DevTools instance with `isVisible() = false`
  - When: `handleKeyDown(mockKeyboardEvent)` is called with `key = 'F1'`
  - Then: `mockKeyboardEvent.preventDefault()` was NOT called

- **AC-2b**: only F1/F2 are consumed
  - Given: a DevTools instance with `isVisible() = true`
  - When: `handleKeyDown(mockEvent)` is called with `key = 'Escape'`
  - Then: `mockEvent.preventDefault()` was NOT called

- **AC-6a**: F2 triggers config reload
  - Given: overlay is visible and ConfigManager has registered namespaces
  - When: F2 is pressed
  - Then: `ConfigManager.reload()` is called; overlay shows "config reloaded — teams.macklen.motor: 3 → 4" (with actual changed key/value)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/dev-tools/input-keybinds_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (compile guard), Story 003 (needs `IDevTools` interface for `toggle()`)
- Unlocks: None directly; all panel stories (004-008) depend on overlay shell (003) which depends on keybinds for activation
