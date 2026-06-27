# Dev Tools Epic — Visual Integration Analysis

**Date**: 2026-06-27
**Purpose**: For each story, define what the user sees, how we test it, and what proves it works.

---

## Story 001 — Dev Compile Guard ✅ DONE

**What it does**: Compile-time guard ensuring Dev Tools code is tree-shaken from production builds.

**What the user sees**: Nothing. This is invisible infrastructure.

**How we test it**:
- Unit tests: `import.meta.env.DEV = true` → code executes; `DEV = false` → code eliminated
- Build verification: `grep -r "DevTools|dev-tools|SceneInstrumentation" dist/ --include="*.js"` returns zero matches

**Evidence**: `tests/unit/dev-tools/dev-compile-guard.test.ts` (7 tests) + CI build step

---

## Story 002 — Input Keybinds ✅ DONE

**What it does**: Keyboard shortcuts to control the Dev Tools overlay.

**What the user sees**:
- Press `1` → overlay appears/disappears (toggle)
- Press `2` → overlay collapses to thin top bar (minimise)
- Press `1` while overlay visible → config reload notification flashes

**How we test it**:
- Unit tests: keydown handler calls `toggle()`, `preventDefault()` when visible, passes through when hidden
- Manual: press keys in browser, verify overlay toggles

**Evidence**: `tests/unit/dev-tools/input-keybinds.test.ts` (15 tests) + manual browser test

---

## Story 003 — HTML Overlay ✅ DONE

**What it does**: Creates the overlay DOM shell with metrics bar.

**What the user sees** (after pressing `1`):
```
┌─────────────────────────────────────────────────────┐
│ FPS 1000 | Frame 1.0 ms | DC 4 | Meshes 2 | Phys 0.1 ms │  ← top bar
├──────────────┬──────────────────────────────────────┤
│ sidebar      │ main panel (empty for now)            │
│ (config tree)│                                      │
├──────────────┴──────────────────────────────────────┤
│ bottom bar                                          │
└─────────────────────────────────────────────────────┘
```
- Dark background (#0a0a0a), yellow accents (#ffd700), monospace white text
- `pointer-events: none` — clicks pass through to game
- Metrics update every frame

**How we test it**:
- Manual: open overlay in browser, verify metrics update, verify clicks pass through
- Automated: DOM structure checks in unit tests

**Evidence**: `production/qa/evidence/html-overlay-evidence.md` (signed off by Johnatas)

---

## Story 004 — Config Tree Inspector ✅ DONE

**What it does**: Shows all Config Manager namespaces and values in a tree view.

**What the user sees** (in sidebar):
```
teams ▸
  teams.macklen.motor: 3
  teams.vasari.bhp: 480
physics ▸
  physics.gripFactor: 0.95
  physics.dragCoefficient: 0.3
```
- Click namespace to expand/collapse
- Double-click value → edit in-place → Enter to save
- `undefined` values show as `—`

**How we test it**:
- Integration tests: namespace rendering, in-place edit, undefined display
- Manual: expand namespaces, edit values, verify config updates

**Evidence**: `tests/integration/dev-tools/config-tree.test.ts` (28 tests, 100% coverage on config-tree.ts)

---

## Story 005 — Event Bus Inspector 🔄 IN PROGRESS

**What it does**: Captures all Event Bus events and shows live subscription list.

**What the user sees** (in main panel, "Event Log" tab):
```
[Event Log]  ← tab button
┌─────────────────────────────────────┐
│ Filter: [____________]              │
│                                     │
│ 16:37:49  gsm.state.entered  {"state":"Racing"} │
│ 16:37:48  fuel.low          {"remaining":5}     │
│ 16:37:47  race.started      {"track":"monaco"}  │
│ ...                                │
│ (scrollable, max 100 entries)      │
├─────────────────────────────────────┤
│ Subscriptions:                      │
│ gsm.state.entered: 3               │
│ fuel.low: 1                        │
│ collision.impact: 2                │
└─────────────────────────────────────┘
```
- Events captured via wildcard `on("*", handler)`
- Newest first, FIFO eviction at 100
- Filter by event name (case-insensitive)
- Subscription list updates live

**How we test it**:
- Integration tests: event capture, FIFO eviction, filter, subscription list
- Manual: open overlay, trigger game events, verify they appear in log

**Evidence**: `tests/integration/dev-tools/event-bus-inspector.test.ts` (30 tests)

### ⚠️ KNOWN ISSUE

The Event Bus Inspector **won't work in the browser** until `app.ts` passes an event bus to `initDevTools()`. Currently:
```typescript
initDevTools(this.engine, this.scene);  // no event bus!
```
Needs:
```typescript
const eventBus = new EventBus();
initDevTools(this.engine, this.scene, eventBus);
```
And the same `eventBus` must be shared with GSM and other systems.

**Decision needed**: Create a global EventBus singleton now, or defer to when GSM is integrated?

---

## Story 006 — GSM State Visualizer 📋 READY

**What it does**: Shows GSM state transitions and allows manual transitions.

**What the user sees** (in main panel, "GSM History" tab):
```
[Event Log] [GSM History]  ← tab buttons
┌─────────────────────────────────────┐
│ Current: Racing                     │  ← highlighted badge
│                                     │
│ History (last 20):                  │
│ Grid → PreRace    16:37:49  8.2s   │
│ PreRace → Racing  16:37:57  0.0s   │
│ Racing → Paused   16:40:12  —      │
│ ...                                │
├─────────────────────────────────────┤
│ Manual Transitions:                 │
│ [Pause] [PostRace] [Menu]          │  ← buttons for valid targets
└─────────────────────────────────────┘
```
- Current state highlighted differently from history
- History shows `from → to`, timestamp, duration in previous state
- Manual transition buttons (guarded by DEV)

**How we test it**:
- Integration tests: history rendering, current state indicator, manual transition buttons
- Manual: trigger GSM transitions, verify they appear; click manual transition button

**Evidence**: `tests/integration/dev-tools/gsm-visualizer.test.ts` (not yet created)

### ⚠️ DEPENDENCY

Requires GSM with Event Bus integration. The GSM must emit `gsm.state.entered` events for the visualizer to capture transitions.

---

## Story 007 — Simulation Snapshot Panel 📋 READY

**What it does**: Shows registered snapshot systems, their hashes, and allows take/restore.

**What the user sees** (in main panel, "Snapshots" tab):
```
[Event Log] [GSM History] [Snapshots]  ← tab buttons
┌─────────────────────────────────────┐
│ System         Hash         Status  │
│ physics        a3f2b1c...   ✓       │
│ fuel           7e9d4a2...   ✓       │
│ tire           1b8c3f5...   ✗       │  ← changed since last snapshot
│ ai             4d2e7a1...   ✓       │
├─────────────────────────────────────┤
│ [Take Snapshot] [Restore Snapshot]  │
└─────────────────────────────────────┘
```
- Per-system FNV-1a 64-bit hash as hex string
- Green ✓ = matches last snapshot; Red ✗ = diverged; — = no baseline
- Take/Restore buttons (guarded by DEV)

**How we test it**:
- Integration tests: system list, hash display, diff indicators, take/restore
- Manual: take snapshot, modify state, verify diff indicator changes

**Evidence**: `tests/integration/dev-tools/sim-snapshot-panel.test.ts` (not yet created)

### ⚠️ DEPENDENCY

Requires Simulation Snapshot system with registered ISnapshotable systems.

---

## Story 008 — AI Telemetry Tab 📋 READY

**What it does**: Shows per-car telemetry data (speed, position, behavior).

**What the user sees** (in main panel, "AI Telemetry" tab):
```
[Event Log] [GSM History] [Snapshots] [AI Telemetry]  ← tab buttons
┌─────────────────────────────────────┐
│ Car     Speed    Position    Behavior│
│ Player  285 km/h  Lap 3/5   Normal  │  ← yellow row
│ AI-1    270 km/h  Lap 3/5   Passing │
│ AI-2    265 km/h  Lap 2/5   Following│
│ AI-3    280 km/h  Lap 3/5   Normal  │
└─────────────────────────────────────┘
```
- One row per car, player car in yellow
- Values refresh every 10 ticks
- Empty state: "No AI cars on track"

**How we test it**:
- Integration tests: table rendering, value updates, empty state
- Manual: start race with AI, verify telemetry updates live

**Evidence**: `tests/integration/dev-tools/ai-telemetry-tab.test.ts` (not yet created)

### ⚠️ DEPENDENCY

Requires Physics (getSpeed), Race Management (getPosition), and AI Driver (getBehavior) systems.

---

## Integration Summary

### What the final overlay looks like (all stories done):

```
┌─────────────────────────────────────────────────────────────┐
│ FPS 60 | Frame 16.7ms | DC 12 | Meshes 8 | Phys 2.1ms     │  ← top bar
├──────────────┬──────────────────────────────────────────────┤
│ Config Tree  │ [Event Log] [GSM History] [Snapshots] [AI]  │  ← tabs
│              │                                              │
│ teams ▸      │  (active tab content)                        │
│ physics ▸    │                                              │
│              │                                              │
├──────────────┴──────────────────────────────────────────────┤
│ bottom bar                                                  │
└─────────────────────────────────────────────────────────────┘
```

### Key integration points:

1. **Event Bus must be shared** — all systems (GSM, Fuel, Collision, etc.) and Dev Tools must use the same EventBus instance
2. **Systems must emit events** — `gsm.state.entered`, `fuel.low`, `collision.impact`, etc. must be emitted for the Event Log to capture them
3. **Systems must register with Snapshot** — Physics, Fuel, Tire, AI must implement `ISnapshotable` and register with `SimulationSnapshot`
4. **Systems must expose APIs** — `physics.getSpeed()`, `raceManager.getPosition()`, `aiDriver.getBehavior()` must exist for AI Telemetry

### Test evidence summary:

| Story | Automated Tests | Manual Evidence | Status |
|-------|----------------|-----------------|--------|
| 001 | 7 unit tests | CI build step | ✅ |
| 002 | 15 unit tests | Browser keypress test | ✅ |
| 003 | 41 unit tests | `html-overlay-evidence.md` | ✅ |
| 004 | 28 integration tests | Browser config edit test | ✅ |
| 005 | 30 integration tests | Browser event log test | 🔄 |
| 006 | — (not created) | — | 📋 |
| 007 | — (not created) | — | 📋 |
| 008 | — (not created) | — | 📋 |
