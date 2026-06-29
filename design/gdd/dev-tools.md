# Dev Tools

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Foundation — developer visibility tooling

## Overview

Dev Tools is a set of developer-only utilities active only in development builds (`import.meta.env.DEV` guard). It contains four features: a Debug Overlay (HTML — toggle key to show/hide) showing FPS, physics step time, draw calls, and system registry; an AI Telemetry Visualizer showing real-time traces of every AI car; a Parameter Hot-Reload indicator showing config changes as they happen via Vite HMR; and a State Inspector showing the Config Manager value tree and SimulationSnapshot per-system hashes. All code inside `if (import.meta.env.DEV)` blocks is tree-shaken from production builds — zero bytes shipped to players.

> **Keybinds are configurable via `devTools.keys.*` in the Data & Config Manager.**

## Player Fantasy

_For infrastructure systems, the "player" is the developer using this API._

The developer presses the toggle key. An overlay appears on top of the game — FPS counter in the corner, a collapsible tree of all registered config values, a table of AI car states (speed, position, current behavior), and the last 20 GSM transitions. They press the reload key and the overlay disappears. They edit `teams.ts` in their editor, save, and the overlay flashes "config reloaded — macklen.motor: 3 → 4". The game never paused. No restart. No guesswork.

## Detailed Design

### Core Rules

**1. Compile-time only.** All Dev Tools code is guarded by `if (import.meta.env.DEV)`. Vite evaluates this at compile time: `true` in dev, `false` in production. The minifier eliminates dead code. No runtime toggle, no leak to release builds.

**2. The toggle key to show/hide overlay, the reload key to force-reload config.** The overlay is off by default on game start. The toggle key shows/hides it. The reload key triggers a manual config re-scan for when HMR doesn't fire (e.g. config edited outside the editor).

**3. HTML overlay positioned absolutely over the canvas.** The game canvas is wrapped in a container div. The overlay is a sibling div with `position: absolute; pointer-events: none;` — it never intercepts game input. When the overlay is visible, key bindings for dev tools take priority over game input (toggle/reload keys are consumed and not forwarded to the game).

**4. Zero impact on gameplay.** Dev Tools never modifies game state, never injects input into game systems, never calls `emit()` on the Event Bus for dev-only events. It reads from systems via their public APIs — it does not write.

**5. No persistent state.** Dev Tools preferences (overlay position, collapsed sections) are not saved. Every session starts fresh.

### States and Transitions

```
[Inactive] --toggle--> [Overlay Visible] --reload--> [Overlay + Inspector] --toggle--> [Inactive]
```

| State                   | Description                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| **Inactive**            | No overlay. Toggle key is captured to activate. Game receives all other input.                |
| **Overlay Visible**     | Debug overlay displayed. Toggle key hides it. Game is still running at full frame rate.      |
| **Overlay + Inspector** | Same as above, with the state inspector panel open to a specific system.                     |

### Interactions with Other Systems

| System                    | Read                                                                                | Write |
| ------------------------- | ----------------------------------------------------------------------------------- | ----- |
| **Config Manager**        | Reads all registered namespaces and their current values                            | None  |
| **Event Bus**             | Subscribes to all events for the event inspector                                    | None  |
| **Simulation Snapshot**   | Reads per-system hashes, last snapshot timestamp                                    | None  |
| **GSM**                   | Reads current state and transition history                                          | None  |
| **Game Engine**           | Reads FPS, draw calls, mesh count                                                   | None  |
| **Fuel / Tire / Physics** | Reads per-car state from owner system maps (fuel level, tire wear, speed, position) | None  |

Dev Tools is read-only on all systems. It never pushes state.

## Formulas

None. Dev Tools reads and displays — it does not compute.

## Edge Cases

1. **Overlay open during loading.** During Loading state, the overlay shows "no systems registered yet" and a static loading bar. It does not attempt to read from systems that haven't initialized.
2. **Toggle key during race.** The overlay appears on top of the game. The race continues in the background. No input is lost because `pointer-events: none` means clicks pass through to the canvas.
3. **Game window resized.** The overlay is `width: 100%; height: 100%` with CSS `resize` handling — it fills the canvas container automatically.
4. **Config value is undefined.** The overlay renders `undefined` as `—` (em dash) instead of showing the literal word undefined.
5. **Dev Tools accidentally left on in a production build.** Not possible — `import.meta.env.DEV` is false, all code tree-shaken. The toggle key listener never exists in the bundle.

## Dependencies

- **Event Bus** (#2) — subscribing to all events for the inspector
- **Config Manager** (#1) — reading namespace values
- **GSM** (#3) — reading current state and history
- **Simulation Snapshot** (#5) — reading system hashes
- **Babylon.js** — reading engine stats (FPS, draw calls)

## Tuning Knobs

- **AI telemetry sample rate** (default: every 10 ticks) — how often AI state is polled for display
- **Log level** (default: `verbose`) — controls what appears in the overlay's log output

## Visual/Audio Requirements

None. The overlay is purely informational — no animations, no sounds.

## UI Requirements

The HTML overlay is a single full-viewport div with:

- **Top bar:** FPS, frame time, draw calls, mesh count
- **Left sidebar (collapsible):** Config tree — namespaces as `<details>` elements, values as `<code>` blocks
- **Main panel:** Tabbed — AI Telemetry (table per car), Event Log (last 100 events, scrollable), GSM History (timeline)
- **Bottom bar:** Current input state (throttle/brake/steer values), physics timestep info

Styled with CSS variables matching the game palette (Track Black background, Signal Yellow accents, white monospace text).

## Acceptance Criteria

1. `import.meta.env.DEV` is `true` in `vite dev` and `false` in `vite build` — verified by build output.
2. The toggle key toggles overlay visibility — visible when pressed, hidden when pressed again.
3. Config tree shows all namespaces registered in Config Manager with current values.
4. AI Telemetry tab shows per-car speed, position, and active behavior node.
5. GSM History tab shows the last 20 state transitions with timestamps.
6. The reload key triggers a config re-scan and displays "config reloaded" with the changed value.
7. `pointer-events: none` — clicking on the overlay does not interact with the game canvas.
8. Production bundle does not contain Dev Tools code — verified by bundle analysis.
9. Overlay handles 100+ config keys without performance degradation or scroll issues.

## Open Questions

None.
