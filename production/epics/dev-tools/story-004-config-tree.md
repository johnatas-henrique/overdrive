# Story 004: Config Tree Inspector

> **Epic**: Dev Tools
> **Status**: Complete
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h
> **Last Updated**: 2026-06-27

## Context

**GDD**: `design/gdd/dev-tools.md`
**Requirement**: `TR-DVT-003`
_Config namespace inspector — tree view of all namespaces with current merged values (base + overrides), ability to edit values in-place via DevTools.Config.set()._

**ADR Governing Implementation**: ADR-0009: Dev Tools Architecture
**ADR Decision Summary**: Data source registration pattern (`registerDataSource`). Config tree rendered as `<details>/<summary>` elements (collapsed = zero DOM nodes). Read-only on all systems by default, with explicit exception for in-place config editing under `import.meta.env.DEV` guard via `ConfigManager.setRuntime()`.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No Babylon.js imports needed — pure DOM manipulation.

**Control Manifest Rules (this layer)**:

- **Required** (D6): Dev Tools: read-only on all systems — never writes state, never emits Event Bus events
- **Required** (D1): HTML overlay — positioned absolutely over canvas container (`pointer-events: none`)
- **Exception (D6/D-F2)**: Config in-place edits under `import.meta.env.DEV` are permitted when they flow through `ConfigManager.setRuntime()` — Dev Tools never bypasses Config Manager's API or writes directly to any system. This is the sole write exception for Dev Tools.

---

## Acceptance Criteria

_From GDD `design/gdd/dev-tools.md`, scoped to this story:_

- [ ] AC-4a: Config tree shows all namespaces registered in Config Manager with current merged values (base + env overrides)
- [ ] AC-4b: In-place edit via `DevTools.Config.set(key, value)` updates values by delegating to `ConfigManager.setRuntime()` under `import.meta.env.DEV` guard. This is the sole write exception to Dev Tools read-only rule — documented and deliberate.
- [ ] AC-4c: `undefined` values render as `—` (em dash), not the literal word "undefined"

---

## Implementation Notes

_Derived from ADR-0009 Implementation Guidelines:_

**Prerequisite — `ConfigManager.setRuntime()` (Foundation layer)**:

This story requires a `setRuntime(key: string, value: unknown)` method on ConfigManager. The method was implemented as part of this story. It:

- Accepts a dot-path key (e.g., `"teams.macklen.motor"`) and a value
- Navigates to the correct location in the resolved config cache
- Sets the value and returns the old value (for notification: `"3 → 4"`)
- Is guarded by `import.meta.env.DEV` — this is a dev-only mutation API
- Does NOT bypass Config Manager's internal state (writes to `_resolved` directly, not to `_store`)

1. **Data source registration**:

   ```typescript
   if (import.meta.env.DEV) {
     devTools.registerDataSource("config", () => configManager.getDebugState());
   }
   ```

   Config Manager exposes `getDebugState(): DebugState` (TR-DCM-006) — returns all namespaces, current values post-override, access log.

2. **Tree rendering**: Each namespace becomes a `<details>` element. Each key becomes a `<code>` block inside `<summary>`:

   ```html
   <details>
     <summary>teams <code>macklen</code></summary>
     <ul>
       <li><code>teams.macklen.motor</code>: <span class="value">3</span></li>
     </ul>
   </details>
   ```

3. **Collapsed = zero DOM**: `<details>` elements have no child nodes until expanded. This is the performance mechanism for AC-9 (100+ keys).

4. **In-place editing**: Double-click a value → input field replaces text span → Enter confirms → calls `ConfigManager.setRuntime(key, value)` → overlay shows flash update. Escape cancels edit. All guarded by `import.meta.env.DEV`.

5. **`undefined` rendering** (GDD edge case #4):

   ```typescript
   const displayValue = value === undefined ? "\u2014" : String(value);
   ```

6. **Data refresh**: The `registerDataSource` reader is called each `_refreshDisplay()` tick. Config tree re-renders only visible (expanded) sections.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 003]: HTML overlay shell, `IDevTools` interface, `registerDataSource` plumbing
- [Story 005]: Event Bus inspector panel
- [Story 006]: GSM visualizer panel
- [Story 007]: Simulation Snapshot panel
- [Story 008]: AI Telemetry tab

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-4a**: namespaces rendered
  - Given: ConfigManager has registered namespaces `"teams"` with keys `"macklen.motor = 3"`, `"vasari.bhp = 480"`
  - When: Dev Tools overlay is shown and config tree tab is opened
  - Then: the tree displays:
    - `"teams"` namespace (collapsible)
    - `"teams.macklen.motor: 3"`
    - `"teams.vasari.bhp: 480"`

- **AC-4b**: in-place edit
  - Given: Config tree shows `"teams.macklen.motor: 3"`
  - When: the developer double-clicks the value `3`, types `4`, presses Enter
  - Then: `ConfigManager.setRuntime("teams.macklen.motor", 4)` is called; overlay updates to show `"teams.macklen.motor: 4"`; a flash notification appears with `"config reloaded — teams.macklen.motor: 3 → 4"`

- **AC-4c**: undefined rendering
  - Given: ConfigManager has a key `"teams.macklen.aerokit"` with value `undefined`
  - When: the config tree displays this key in the overlay
  - Then: the displayed value is `"—"` (em dash), not `"undefined"` or blank

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/dev-tools/config-tree.test.ts` or documented playtest

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (needs overlay shell + `IDevTools.registerDataSource`)
- Unlocks: None

## Completion Notes

**Completed**: 2026-06-27
**Criteria**: 3/3 passing (AC-4a, AC-4b, AC-4c)
**Deviations**:
- ADVISORY: `captureRenderTime` not enabled (ADR shows it, implementation omits) — low priority
- ADVISORY: `_initConfigDataSource` registers reader that's never consumed — placeholder for future stories
- ADVISORY: Additional panel styling refinements deferred to later polish pass
**Test Evidence**: Integration test at `tests/integration/dev-tools/config-tree.test.ts` (28 tests)
**Code Review**: APPROVED WITH SUGGESTIONS (LP) — 5 findings, all low/informational
**Coverage**: config-tree.ts 100%/100%/100%/100%, dev-tools.ts 97.93%/94.44%/94.44%/99.24%
