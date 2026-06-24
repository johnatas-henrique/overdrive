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
| **Verification Required** | `__DEV__` compile guard tree-shakes correctly in production build                |

## ADR Dependencies

| Field             | Value                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Depends On**    | ADR-0006 (InputState — F1/F2 pulses from Input)                                                                  |
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
- Zero startup time — overlay components are created lazily on first F1 press

### Requirements

- F1 toggles overlay visibility; F2 triggers manual config reload
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

The HTML overlay is positioned absolutely over the canvas container. `pointer-events: none` ensures clicks pass through to the game. The overlay is not created until first F1 press (lazy init) — zero cost if never opened.

Overlay rendering is synchronized to frame boundaries via `engine.onEndFrameObservable` — fires synchronously after each frame's complete render, before the browser's next `requestAnimationFrame`. This prevents display desync between the game canvas and the overlay.

FPS, draw calls, and physics time are captured via `SceneInstrumentation` (not custom counters):

```typescript
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";

if (__DEV__) {
  const inst = new SceneInstrumentation(scene);
  inst.captureFrameTime = true;
  inst.captureRenderTime = true;
  inst.capturePhysicsTime = true;
  // Access: inst.drawCallsCounter.current, inst.frameTimeCounter.current
}
```

### Overlay Sibling Position

```typescript
if (__DEV__) {
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
  update(dt: number): void;
  /** Tear down overlay, remove DOM elements */
  dispose(): void;
}

// Input pulses consumed (from ADR-0006):
// F1 → IDevTools.toggle()
// F2 → manual config reload via ConfigManager.reload()
```

### Compile Guard

```typescript
// src/core/dev-tools/index.ts
if (__DEV__) {
  const devTools = new DevTools();
  pipeline.register("dev-tools", (dt) => devTools.update(dt), 9);
}
```

Vite `define` replaces `__DEV__` with `false` in production. The entire block becomes dead code and is eliminated by the minifier.

### Data Sources

Dev Tools subscribes to system state via a registration pattern, driven by the engine's frame-end observable:

```typescript
// Physics registers its telemetry:
if (__DEV__) {
  devTools.registerDataSource("physics", () => ({
    fps: inst.frameTimeCounter.current,
    physicsTime: inst.physicsTimeCounter.current,
    drawCalls: inst.drawCallsCounter.current,
    cars: physics.getAllTelemetry(),
  }));
}

// Config Manager registers its tree:
if (__DEV__) {
  devTools.registerDataSource("config", () => configManager.getAllValues());
}

// Frame-end observable drives overlay refresh:
if (__DEV__) {
  engine.onEndFrameObservable.add(() => {
    devTools.update(); // Reads data sources, writes to DOM
  });
}
```

Each data source is a zero-arg function called each tick. The overlay re-renders only visible sections.

### GSM History Capture

```typescript
if (__DEV__) {
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
- `__DEV__` tree-shaking guarantees zero production footprint
- Lazy init: zero cost until first F1 press
- CSS-styled with game palette — consistent visual identity
- Read-only on all systems — cannot corrupt game state

### Negative

- HTML overlay sits outside Babylon.js — not integrated with the game's rendering pipeline
- Tab/panel switching requires DOM manipulation — could cause frame drops if not optimized

### Risks

- **Risk**: F1/F2 consumed by Dev Tools but also passed to game input
  **Mitigation**: `event.preventDefault()` on F1/F2 keydown when overlay is active. Input system (ADR-0006) must check if Dev Tools is consuming these keys.
- **Risk**: Event Bus subscription for GSM history leaks in production
  **Mitigation**: `gsm.state.entered` subscription wrapped in `if (__DEV__)` block. Production bundle never registers the handler.
- **Risk**: 100+ config keys cause scroll jank
  **Mitigation**: Config tree uses `<details>` elements — only open sections render children. Collapsed sections render zero DOM nodes.

## GDD Requirements Addressed

| GDD System   | Requirement                            | How This ADR Addresses It                  |
| ------------ | -------------------------------------- | ------------------------------------------ |
| dev-tools.md | F1 toggle overlay, F2 config reload    | InputState pulses consumed by IDevTools    |
| dev-tools.md | `__DEV__` compile guard                | Vite `define` + dead-code elimination      |
| dev-tools.md | Read-only on all systems               | registerDataSource pattern, no write APIs  |
| dev-tools.md | pointer-events: none                   | CSS on overlay div                         |
| dev-tools.md | Config tree, AI Telemetry, GSM History | Tabbed panel with data source registration |

## Performance Implications

- **CPU**: Overlay update per tick (~0.001ms) when visible. Zero when hidden (lazy polling).
- **Memory**: DOM nodes for visible overlay (~50-200 nodes depending on config tree expansion).
- **Production**: Zero bytes — entire file tree-shaken by `__DEV__` guard.

## Validation Criteria

- [ ] F1 shows overlay over gameplay; F1 hides it
- [ ] F2 triggers ConfigManager.reload() and flashes "config reloaded"
- [ ] Overlay `<div>` has `pointer-events: none` — clicks pass to canvas
- [ ] Production bundle: grep for DevTools class returns zero matches
- [ ] AI Telemetry tab shows per-car speed, position, behavior node
- [ ] GSM History tab shows last 20 transitions with timestamps
- [ ] Config tree renders all registered namespaces with current values
- [ ] Overlay does not call emit() on Event Bus
- [ ] `engine.onEndFrameObservable` drives overlay refresh — fires after each complete frame
- [ ] `SceneInstrumentation` captures frameTime, physicsTime, drawCalls — visible in top bar
- [ ] Overlay `<div>` is sibling of canvas inside `engine.getRenderingCanvas().parentElement`
- [ ] `event.preventDefault()` on F1/F2 prevents game from receiving them when overlay is active

## Related Decisions

- ADR-0004 (Module Boundaries — Dev Tools is Core, statically imported only via `__DEV__`)
- ADR-0006 (Input Abstraction — F1/F2 consumed from InputState)
- ADR-0018 (Simulation Snapshot — Dev Tools reads per-system hashes for state inspector)
