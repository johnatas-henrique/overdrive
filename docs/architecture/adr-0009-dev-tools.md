# ADR-0009: Dev Tools Architecture

**Status**: Accepted
**Date**: 2026-06-21
**Author**: johnatas-henrique (technical-director)

## Context

The project requires developer tools that provide real-time visibility into game state, configuration, telemetry, and system internals during development. These tools must be available in development builds only and must not affect gameplay or ship to production.

Previous attempts at building dev tools in other projects have suffered from three problems:
1. Dev tools leak into production builds through missed compile guards
2. Dev tools mutate game state during debugging, causing non-deterministic bugs
3. Dev tools overlay blocks game input, frustrating the developer

## Decision

We will implement a compile-time-guarded HTML overlay with a data-source registration pattern for extensible panels.

### Architecture

**Compile-time guard**: All Dev Tools code lives behind `if (import.meta.env.DEV)` which Vite evaluates at compile time. The minifier eliminates dead code from production bundles. No runtime toggle — the code literally does not exist in the shipped bundle.

**Singleton proxy**: `src/core/dev-tools/index.ts` exports `initDevTools()` for async singleton creation and `getDevTools()` for access. Both are tree-shaken in production. A guard at line 75 returns early if `_instance` or `_initializing` is already set, preventing concurrent initialization races.

**DOM lifecycle**: The overlay `<div>` is created on first toggle, not on init. Append to container via `scene.getEngine().getRenderingCanvas().parentElement!.appendChild(overlay)`. The overlay is positioned `position: absolute; pointer-events: none;` over the canvas container. Toggle toggles `display: flex` / `display: none`.

**Tab system**: Tabs are created via `_create*Tab()` methods in `dev-tools.ts`. Each tab method constructs its panel instance and appends to the tab bar and content area. Tab switching is handled by `_switchTab()` which hides all panels and shows the selected one.

**Data source registration**: `registerDataSource(name, reader)` stores a reader function. `_refreshDisplay()` iterates all registered readers and updates corresponding DOM elements. Readers are called each refresh cycle.

**Metric refresh**: `onEndFrameObservable` triggers `_refreshDisplay()` each frame. FPS, frame time, draw calls, mesh count, physics time are read from `SceneInstrumentation`.

**Key handling**: DOM keydown listener registered on window. When overlay is visible, toggle/reload keys call `preventDefault()` to prevent game input consumption. Editable elements (INPUT, TEXTAREA, contentEditable) are skipped. Keys are configurable via `devTools.keys.*` in the Data & Config Manager.

**Tab activation**: After creating all tabs, `_createTabs()` activates the first available tab via `_switchTab()`, ensuring at least one tab panel is visible on initial overlay open. If the AI Telemetry tab is the only tab (event bus and GSM are null), it is activated correctly.

**Tab panel pattern**: Each panel is a class that receives its container element on construction and implements `refresh()` for data updates. Panels are read-only observers — they never write to game state or emit Event Bus events. The sole exception is for deliberate debug actions (config in-place edit via `ConfigManager.setRuntime()`, GSM manual transitions, snapshot Take/Restore buttons), which are explicitly documented in the Control Manifest.

**Config tree**: Uses `<details>` elements for namespace collapsible sections. Double-click on a value opens an `<input>` for in-place editing. Enter confirms via `ConfigManager.setRuntime()`. Escape cancels. `undefined` values render as `—` (em dash). Collapsed sections render zero DOM nodes for performance with 100+ config keys.

### Panels

**Event Bus Inspector** (`event-bus-inspector.ts`): Subscribes to wildcard `"*"` Event Bus events. Maintains a 100-entry FIFO ring buffer. Shows event history with filter support (case-insensitive), live subscription count, and payload depth expansion.

**GSM Visualizer** (`gsm-visualizer.ts`): Subscribes to `gsm.state.exited`/`gsm.state.entered`. Seeds from GSM's internal 20-entry ring buffer on attach. Shows current state, last 20 transitions with timestamps and duration. Provides manual transition buttons for debugging (under DEV guard, Control Manifest D6 exception).

**Sim Snapshot Panel** (`sim-snapshot-panel.ts`): Reads from `SimulationSnapshot.getRegisteredSystems()` and `getHashes()`. Shows per-system FNV-1a hash with diff indicators on change. Provides Take/Restore buttons (under DEV guard, Control Manifest D6 exception).

**AI Telemetry Panel** (`ai-telemetry-panel.ts`): Reads per-car AI telemetry each refresh tick. Displays a table with columns: Car ID, Speed, Position (lap/overall), and Behavior node. Player car row highlighted in yellow, AI cars in white. Top row is the current race leader.

**Config Tree Panel** (`config-tree.ts`): Renders all ConfigManager namespaces as a collapsible tree. Each key-value pair shown as `<key>: <value>`. Double-click opens an inline edit field. Updates flow through `ConfigManager.setRuntime()`.

## Consequences

**Positive**:
- Zero bytes shipped to players — full tree-shaking guarantee
- Read-only observer pattern prevents debug state pollution
- `pointer-events: none` preserves game interactivity
- Extensible via `registerDataSource()` — adding new panels requires no changes to existing code
- Tabbed interface gives structured navigation between different inspection modes
- All four tab panels are correctly activated regardless of which data sources are available

**Negative**:
- `SceneInstrumentation` required for engine metrics — adds ~2KB to dev bundle even with tree-shaking (acceptable)
- Overlay only available in `vite dev` — no debug capability in production builds (intentional)
- Tab switching logic requires explicit activation call; new tab panels must follow this pattern

**Risks**:
- **Risk**: Event Bus subscription for GSM history leaks in production
  **Mitigation**: `gsm.state.entered` subscription wrapped in `if (import.meta.env.DEV)` block. Production bundle never registers the handler.
- **Risk**: 100+ config keys cause scroll jank
  **Mitigation**: Config tree uses `<details>` elements — only open sections render children. Collapsed sections render zero DOM nodes.

## GDD Requirements Addressed

| GDD System   | Requirement                            | How This ADR Addresses It                  |
| ------------ | -------------------------------------- | ------------------------------------------ |
| dev-tools.md | Toggle key to show/hide overlay, reload key to trigger config reload    | DOM keydown listener, `preventDefault()` when overlay is visible |
| dev-tools.md | `import.meta.env.DEV` guard              | Vite compile-time evaluation + dead-code elimination |
| dev-tools.md | Read-only on all systems               | `registerDataSource` pattern, no write APIs  |
| dev-tools.md | `pointer-events: none`                   | CSS on overlay div                         |
| dev-tools.md | Config tree, AI Telemetry, GSM History | Tabbed panel with data source registration |

## Performance Implications

- **CPU**: Overlay update per tick (~0.001ms) when visible. Zero when hidden (lazy polling).
- **Memory**: DOM nodes for visible overlay (~50-200 nodes depending on config tree expansion).
- **Production**: Zero bytes — entire file tree-shaken by `import.meta.env.DEV` guard.

## Validation Criteria

- [ ] The toggle key shows overlay over gameplay; toggle key hides it
- [ ] The reload key triggers `ConfigManager.reload()` and flashes "config reloaded"
- [ ] Overlay `<div>` has `pointer-events: none` — clicks pass to canvas
- [ ] Production bundle: grep for DevTools class returns zero matches
- [ ] AI Telemetry tab shows per-car speed, position, behavior node
- [ ] GSM History tab shows last 20 transitions with timestamps
- [ ] Config tree renders all registered namespaces with current values
