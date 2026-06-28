# ADR-0009: Dev Tools

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                            |
| ------------------------- | -------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                                                |
| **Domain**                | Developer Tooling                                                                |
| **Knowledge Risk**        | LOW — HTML overlay, no Babylon rendering APIs used                               |
| **References Consulted**  | dev-tools.md GDD, architecture.md Module Ownership, ADR-0004 (Module Boundaries) |
| **Post-Cutoff APIs Used** | None                                                                             |
| **Verification Required** | `import.meta.env.DEV` guard tree-shakes correctly in production build       |

## ADR Dependencies

| Field             | Value                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Depends On**    | None (DOM-based keybinds, no Input system dependency)                                                                       |
| **Enables**       | Debugging all simulation systems during implementation                                                           |
| **Blocks**        | None                                                                                                             |
| **Ordering Note** | Init slot #0 (after Foundation init, no dependencies on other Core systems). Can be created early for debugging. |

## Context

### Problem Statement

During development, the team needs visibility into the running game — FPS, physics step time, AI state, config values, event bus traffic — without stopping the game or adding console.log noise. In production, zero bytes of this code must ship.

### Constraints

- Must never intercept game input — `pointer-events: none` on the overlay
- Must never write to any system state — read-only on all systems
- Must tree-shake completely in production builds
- Must not emit events on the Event Bus
- Must not call `emit()` for dev-only events
- Zero startup time — overlay components are created lazily on first toggle press

### Requirements

- The toggle key (default: backtick) shows/hides overlay visibility; the reload key (default: 1) triggers manual config reload
- Overlay shows: FPS, frame time, draw calls, mesh count
- Config tree with all namespaces and values
- AI Telemetry tab: per-car speed, position, behavior node
- GSM History tab: last 20 transitions with timestamps
- Event Log tab: last 100 events, scrollable
- CSS-styled with game palette (Track Black, Signal Yellow, white monospace)

## Decision

### Architecture

```
window
  ├── canvas (Babylon.js game)
  └── div#dev-overlay (HTML sibling, pointer-events: none)
        ├── Top bar: FPS, frame time, draw calls, mesh count
        ├── Left sidebar: Config tree (<details>/<summary> per namespace)
        ├── Main panel (tabbed):
        │     ├── AI Telemetry (table per car)
        │     ├── Event Log (scrollable, last 100 events)
        │     └── GSM History (timeline, last 20 transitions)
        └── Bottom bar: Input state, physics timestep
```

The HTML overlay is positioned absolutely over the canvas container. `pointer-events: none` ensures clicks pass through to the game. The overlay is not created until first toggle press (lazy init) — zero cost if never opened.

### Pointer-Events Cascade

The overlay uses a cascading `pointer-events` strategy:

```
div#dev-overlay          pointer-events: none    (clicks pass to canvas)
├── .sidebar             pointer-events: auto    (config tree interactive)
├── .tab-bar             pointer-events: auto    (tab buttons clickable)
└── .tab-content         pointer-events: none    (clicks pass to canvas)
      ├── .tab-panel     pointer-events: none    (inherited)
      │     ├── Event Log    → .inspector-log-list  pointer-events: auto (scrollable)
      │     ├── GSM History  → .gsm-history-list    pointer-events: auto (scrollable)
      │     ├── Sim Snapshot → .ssn-systems-list    pointer-events: auto (scrollable, background)
      │     └── AI Telemetry → .ait-table-wrap      pointer-events: auto (scrollable, background)
      └── (empty space)   pointer-events: none    (clicks pass to canvas)
```

**Intentional inconsistency**: Tabs with large scrollable content (Event Log, GSM History) capture clicks for scrolling, preventing canvas interaction. Tabs with small content (Sim Snapshot, AI Telemetry) have empty space below the content where clicks pass through to the canvas. This is by design — scrollable content needs `pointer-events: auto` to function, and empty space should not block game interaction.

**Visual readability**: Scrollable content containers (`.ssn-systems-list`, `.ait-table-wrap`) have `background: var(--od-ui-bg)` for legibility against the game scene. Non-scrollable container elements (`.ssn-container`, `.ait-container`) remain transparent.

Overlay rendering is synchronized to frame boundaries via `engine.onEndFrameObservable` — fires synchronously after each frame's complete render, before the browser's next `requestAnimationFrame`. This prevents display desync between the game canvas and the overlay.

FPS, draw calls, and physics time are captured via `SceneInstrumentation` (not custom counters):

```typescript
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";

if (import.meta.env.DEV) {
  const inst = new SceneInstrumentation(scene);
  inst.captureFrameTime = true;
  inst.captureRenderTime = true;
  inst.capturePhysicsTime = true;
  // Access: inst.drawCallsCounter.current, inst.frameTimeCounter.current
}
```

### Overlay Sibling Position

```typescript
if (import.meta.env.DEV) {
  const canvas = engine.getRenderingCanvas();
  const container = canvas?.parentElement;
  if (!container) return; // no parent — no overlay
  const overlay = document.createElement("div");
  overlay.id = "dev-overlay";
  overlay.style.cssText =
    "position:absolute;inset:0;pointer-events:none;z-index:10";
  container.appendChild(overlay);
}
```

The overlay `<div>` is a direct sibling of the canvas, inside the same container — inheriting the container's size and position automatically.

### Key Interfaces

```typescript
interface IDevTools {
  /** Register system data sources for the overlay to display */
  registerDataSource(name: string, reader: () => Record<string, unknown>): void;
  /** Called each tick to refresh displayed data */
  update(): void;
  /** Tear down overlay, remove DOM elements */
  dispose(): void;
}

// Input pulses consumed (from ADR-0006):
// toggle key → IDevTools.toggle()
// reload key → manual config reload via ConfigManager.reload()
// Keycodes read from DEV_TOOLS_KEYS config (see src/config/dev-tools-config.ts)
```

### Compile Guard

```typescript
// src/core/dev-tools/index.ts
if (import.meta.env.DEV) {
  const devTools = new DevTools();
  pipeline.register("dev-tools", () => devTools.update(), 9);
}
```

Vite evaluates `import.meta.env.DEV` at compile time: `true` in dev, `false` in production. The entire block becomes dead code and is eliminated by the minifier.

### Data Sources

Dev Tools subscribes to system state via a registration pattern, driven by the engine's frame-end observable:

```typescript
// Physics registers its telemetry:
if (import.meta.env.DEV) {
  devTools.registerDataSource("physics", () => ({
    fps: inst.frameTimeCounter.current,
    physicsTime: inst.physicsTimeCounter.current,
    drawCalls: inst.drawCallsCounter.current,
    cars: physics.getAllTelemetry(),
  }));
}

// Config Manager registers its tree:
if (import.meta.env.DEV) {
  devTools.registerDataSource("config", () => configManager.getAllValues());
}

// Frame-end observable drives overlay refresh:
if (import.meta.env.DEV) {
  engine.onEndFrameObservable.add(() => {
    devTools.update(); // Reads data sources, writes to DOM
  });
}
```

Each data source is a zero-arg function called each tick. The overlay re-renders only visible sections.

### GSM History Capture

```typescript
if (import.meta.env.DEV) {
  eventBus.on("gsm.state.entered", (state) => {
    devTools.recordTransition(state, Date.now());
  });
}
```

Dev Tools listens to Event Bus events (read-only subscription, never emits).

## Alternatives Considered

### Alternative 1: Babylon GUI AdvancedDynamicTexture

- **Description**: Render debug overlay using AdvancedDynamicTexture + controls (TextBlock, Rectangle).
- **Cons**: ADT renders inside the canvas — overlay intercepts canvas input. `pointer-events: none` does not exist in Babylon GUI. Text rendering for 100+ config keys would require virtual scrolling (not built into ADT). Styling requires Babylon theme, not CSS.
- **Rejection Reason**: Babylon GUI is designed for game HUDs, not developer overlays with 100+ key/value pairs, scrollable logs, and CSS styling. HTML overlay is simpler, more functional, and zero-cost.

### Alternative 2: Stats.js library

- **Description**: Use stats.js (the npm package) for FPS/frame-time display.
- **Pros**: Zero-code FPS graph, battle-tested.
- **Cons**: Only covers FPS/frame-time. Does not cover config tree, AI telemetry, GSM history, or event log. Would need separate systems for those features anyway.
- **Rejection Reason**: Dev Tools scope is broader than FPS. A mix of stats.js + custom HTML is more complex than pure custom HTML.

## Consequences

### Positive

- HTML overlay does not interfere with game input (`pointer-events: none`)
- `import.meta.env.DEV` guard tree-shaking guarantees zero production footprint
- Lazy init: zero cost until first toggle press
- CSS-styled with game palette — consistent visual identity
- Read-only on all systems — cannot corrupt game state

### Negative

- HTML overlay sits outside Babylon.js — not integrated with the game's rendering pipeline
- Tab/panel switching requires DOM manipulation — could cause frame drops if not optimized

### Risks

- **Risk**: Toggle/reload keys consumed by Dev Tools but also passed to game input
  **Mitigation**: `event.preventDefault()` on toggle/reload keys via DOM `keydown` listener. Dev Tools uses DOM events (not DeviceSourceManager) — zero Babylon.js dependency, works independently of the game's input pipeline. Toggle/reload keys MUST never map to gameplay actions.
- **Risk**: Event Bus subscription for GSM history leaks in production
  **Mitigation**: `gsm.state.entered` subscription wrapped in `if (import.meta.env.DEV)` block. Production bundle never registers the handler.
- **Risk**: 100+ config keys cause scroll jank
  **Mitigation**: Config tree uses `<details>` elements — only open sections render children. Collapsed sections render zero DOM nodes.

## GDD Requirements Addressed

| GDD System   | Requirement                            | How This ADR Addresses It                  |
| ------------ | -------------------------------------- | ------------------------------------------ |
| dev-tools.md | Toggle key (default: backtick) to show/hide overlay, reload key (default: 1) to trigger config reload    | DOM keydown listener, preventDefault when visible |
| dev-tools.md | `import.meta.env.DEV` guard              | Vite compile-time evaluation + dead-code elimination |
| dev-tools.md | Read-only on all systems               | registerDataSource pattern, no write APIs  |
| dev-tools.md | pointer-events: none                   | CSS on overlay div                         |
| dev-tools.md | Config tree, AI Telemetry, GSM History | Tabbed panel with data source registration |

## Performance Implications

- **CPU**: Overlay update per tick (~0.001ms) when visible. Zero when hidden (lazy polling).
- **Memory**: DOM nodes for visible overlay (~50-200 nodes depending on config tree expansion).
- **Production**: Zero bytes — entire file tree-shaken by `import.meta.env.DEV` guard.

## Validation Criteria

- [ ] The toggle key (default: backtick) shows overlay over gameplay; toggle key hides it
- [ ] The reload key (default: 1) triggers ConfigManager.reload() and flashes "config reloaded"
- [ ] Overlay `<div>` has `pointer-events: none` — clicks pass to canvas
- [ ] Production bundle: grep for DevTools class returns zero matches
- [ ] AI Telemetry tab shows per-car speed, position, behavior node
- [ ] GSM History tab shows last 20 transitions with timestamps
- [ ] Config tree renders all registered namespaces with current values
- [ ] Overlay does not call emit() on Event Bus
- [ ] `engine.onEndFrameObservable` drives overlay refresh — fires after each complete frame
- [ ] `SceneInstrumentation` captures frameTime, physicsTime, drawCalls — visible in top bar
- [ ] Overlay `<div>` is sibling of canvas inside `engine.getRenderingCanvas().parentElement`
- [ ] `event.preventDefault()` on toggle/reload keys via DOM keydown listener prevents game from receiving them when overlay is active

## Related Decisions

- ADR-0004 (Module Boundaries — Dev Tools is Core, statically imported only via `import.meta.env.DEV`)
- ADR-0006 (Input Abstraction — Dev Tools operates independently via DOM events, no Input system dependency)
- ADR-0018 (Simulation Snapshot — Dev Tools reads per-system hashes for state inspector)
