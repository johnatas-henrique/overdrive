# Dev Tools

> **Status**: In Design
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-18
> **Implements Pillar**: Developer Velocity — visibility into game systems without stopping the game

## Overview

Dev Tools is a set of developer-only utilities active only in development builds (`__DEV__` compile flag). It contains four features: a Debug Overlay (HTML — F1 toggle) showing FPS, physics step time, draw calls, and system registry; an AI Telemetry Visualizer showing real-time traces of every AI car; a Parameter Hot-Reload indicator showing config changes as they happen via Vite HMR; and a State Inspector showing the Config Manager value tree and SimulationSnapshot per-system hashes. All code inside `if (__DEV__)` blocks is tree-shaken from production builds — zero bytes shipped to players.

## Developer Fantasy

The developer presses F1. An overlay appears on top of the game — FPS counter in the corner, a collapsible tree of all registered config values, a table of AI car states (speed, position, current behavior), and the last 20 GSM transitions. They press F2 and the overlay disappears. They edit `teams.ts` in their editor, save, and the overlay flashes "config reloaded — macklen.motor: 3 → 4". The game never paused. No restart. No guesswork.

## Detailed Design

### Core Rules

**1. Compile-time only.** All Dev Tools code is guarded by `if (__DEV__)`. Vite's `define` replaces `__DEV__` with `false` in production builds, and the minifier eliminates dead code. No runtime toggle, no leak to release builds.

**2. F1 to toggle overlay, F2 to force-reload config.** The overlay is off by default on game start. F1 shows/hides it. F2 triggers a manual config re-scan for when HMR doesn't fire (e.g. config edited outside the editor).

**3. HTML overlay positioned absolutely over the canvas.** The game canvas is wrapped in a container div. The overlay is a sibling div with `position: absolute; pointer-events: none;` — it never intercepts game input. When the overlay is visible, key bindings for dev tools take priority over game input (F1/F2 are consumed and not forwarded to the game).

**4. Zero impact on gameplay.** Dev Tools never modifies game state, never injects input into game systems, never calls `emit()` on the Event Bus for dev-only events. It reads from systems via their public APIs — it does not write.

**5. No persistent state.** Dev Tools preferences (overlay position, collapsed sections) are not saved. Every session starts fresh.

### States and Transitions

```
[Inactive] --F1--> [Overlay Visible] --F2--> [Overlay + Inspector] --F1--> [Inactive]
```

| State                   | Description                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- |
| **Inactive**            | No overlay. F1 key is captured to activate. Game receives all other input.      |
| **Overlay Visible**     | Debug overlay displayed. F1 hides it. Game is still running at full frame rate. |
| **Overlay + Inspector** | Same as above, with the state inspector panel open to a specific system.        |

### Interactions with Other Systems

| System                    | Read                                                     | Write |
| ------------------------- | -------------------------------------------------------- | ----- |
| **Config Manager**        | Reads all registered namespaces and their current values | None  |
| **Event Bus**             | Subscribes to all events for the event inspector         | None  |
| **Simulation Snapshot**   | Reads per-system hashes, last snapshot timestamp         | None  |
| **GSM**                   | Reads current state and transition history               | None  |
| **Game Engine**           | Reads FPS, draw calls, mesh count                        | None  |
| **Fuel / Tire / Physics** | Reads per-car state via `getEntity(carId)` chain         | None  |

Dev Tools is read-only on all systems. It never pushes state.

## Formulas

None. Dev Tools reads and displays — it does not compute.

## Edge Cases

1. **Overlay open during loading.** During Loading state, the overlay shows "no systems registered yet" and a static loading bar. It does not attempt to read from systems that haven't initialized.
2. **F1 during race.** The overlay appears on top of the game. The race continues in the background. No input is lost because `pointer-events: none` means clicks pass through to the canvas.
3. **Game window resized.** The overlay is `width: 100%; height: 100%` with CSS `resize` handling — it fills the canvas container automatically.
4. **Config value is undefined.** The overlay renders `undefined` as `—` (em dash) instead of showing the literal word undefined.
5. **Dev Tools accidentally left on in a production build.** Not possible — `__DEV__` is false, all code tree-shaken. The F1 listener never exists in the bundle.

## Dependencies

- **Event Bus** (#3) — subscribing to all events for the inspector
- **Config Manager** (#1) — reading namespace values
- **GSM** (#4) — reading current state and history
- **Simulation Snapshot** (#6) — reading system hashes
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

1. `__DEV__` is `true` in `vite dev` and `false` in `vite build` — verified by build output.
2. F1 toggles overlay visibility — visible when pressed, hidden when pressed again.
3. Config tree shows all namespaces registered in Config Manager with current values.
4. AI Telemetry tab shows per-car speed, position, and active behavior node.
5. GSM History tab shows the last 20 state transitions with timestamps.
6. F2 triggers a config re-scan and displays "config reloaded" with the changed value.
7. `pointer-events: none` — clicking on the overlay does not interact with the game canvas.
8. Production bundle does not contain Dev Tools code — verified by bundle analysis.
9. Overlay handles 100+ config keys without performance degradation or scroll issues.

## Open Questions

None.
