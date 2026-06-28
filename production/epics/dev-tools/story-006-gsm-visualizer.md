# Story 006: GSM State Visualizer

> **Epic**: Dev Tools
> **Status**: Complete
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h
> **Last Updated**: 2026-06-27

## Context

**GDD**: `design/gdd/dev-tools.md`
**Requirement**: `TR-DVT-005`
_GSM state visualiser — current state, history timeline, manual transition buttons (guarded by `import.meta.env.DEV`)._

**ADR Governing Implementation**: ADR-0009: Dev Tools Architecture (with ADR-0024: Game State Machine)
**ADR Decision Summary**: Dev Tools subscribes to `gsm.state.entered` on Event Bus to record transitions (read-only subscription, never emits). Reads last 20 transitions from GSM's ring buffer (TR-GSM-005). Manual transitions go through `gsm.transition()` — exception to read-only rule for `import.meta.env.DEV`-guarded debug actions. Current state displayed from Event Bus events (never calls `gsm.getCurrent()`).

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No Babylon.js imports needed — pure DOM + Event Bus integration.

**Control Manifest Rules (this layer)**:

- **Required** (D6): Dev Tools: read-only on all systems — never writes state, never emits Event Bus events
- **Required** (F24): GSM emits 2 events per transition — `gsm.state.exited(old)` then `gsm.state.entered(new)`
- **Required** (F27): 20-entry ring buffer of last transitions for debug
- **Forbidden** (F-F5, F23): Never call `gsm.getCurrent()` from any system — react to Event Bus events instead
- **Exception (D6)**: Manual transition buttons under `import.meta.env.DEV` guard are permitted as deliberate debug actions. They call `gsm.transition()` through GSM's public API — Dev Tools never writes directly.

---

## Acceptance Criteria

_From GDD `design/gdd/dev-tools.md`, scoped to this story:_

- [ ] AC-6a: GSM History tab shows the last 20 state transitions with timestamps and duration in previous state (newest first)
- [ ] AC-6b: Current state indicator displayed and highlighted differently from history entries
- [ ] AC-6c: Manual transition buttons (guarded by `import.meta.env.DEV`) — each valid target state has a button; clicking calls `gsm.transition(targetState)`. Exception to read-only rule for deliberate debug actions.

---

## Implementation Notes

_Derived from ADR-0009 Implementation Guidelines:_

1. **Transition capture** via Event Bus:

   ```typescript
   if (import.meta.env.DEV) {
     eventBus.on("gsm.state.exited", (payload) => {
       this._pendingExit = { from: payload.from, timestamp: Date.now() };
     });
     eventBus.on("gsm.state.entered", (payload) => {
       this._recordTransition({
         from: payload.from,
         to: payload.to,
         timestamp: Date.now(),
         duration: this._pendingExit
           ? Date.now() - this._pendingExit.timestamp
           : 0,
       });
     });
   }
   ```

2. **Ring buffer** (20 entries, matching GSM's TR-GSM-005): Newest entry first in display. Each entry shows `from → to` with timestamp and duration in previous state.

3. **Current state indicator**: Maintained via `gsm.state.entered` events — Dev Tools stores the `payload.to` value as `_currentState`. Displayed as a highlighted badge at the top of the tab.

4. **Manual transition buttons**: Query GSM's allowed transition table for the current state. Render a button for each valid target state. On click, call `gsm.transition(targetState)` with confirmation dialog:

   ```typescript
   if (import.meta.env.DEV && confirm(`Transition to "${targetState}"?`)) {
     gsm.transition(targetState);
   }
   ```

5. **Write rule exception**: Manual transitions are deliberate developer actions that call GSM's public `transition()` API. This is explicitly permitted as a `import.meta.env.DEV`-guarded debug action — Dev Tools never bypasses GSM's validation or writes to any system directly.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 003]: HTML overlay shell, `IDevTools` interface, tab scaffolding
- [Story 004]: Config tree panel
- [Story 005]: Event Bus inspector (event capture mechanism shared, but rendering is separate)
- [Story 007]: Simulation Snapshot panel
- [Story 008]: AI Telemetry tab

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-6a**: GSM history display
  - Given: GSM has performed 5 transitions: Loading → Menu → PreRace → Racing → Paused
  - When: Dev Tools GSM History tab is opened
  - Then: it shows all 5 transitions with timestamps, newest first

- **AC-6a**: history ring buffer cap at 20
  - Given: GSM has performed 25 state transitions
  - When: Dev Tools GSM History tab is opened
  - Then: exactly 20 transitions are displayed (entries 6–25, not 1–5)

- **AC-6b**: current state indicator
  - Given: GSM is in `"Racing"` state
  - When: Dev Tools GSM tab is opened
  - Then: the current state indicator shows `"Racing"` (highlighted differently from history entries)
  - When: GSM transitions to `"Paused"`
  - Then: the indicator updates to `"Paused"`

- **AC-6c**: manual transition buttons
  - Given: GSM is in `"Racing"` state (valid transitions: Paused, PostRace)
  - When: the developer clicks the `"Paused"` manual transition button in Dev Tools
  - Then: GSM transitions to `"Paused"` state; the current state indicator updates to `"Paused"`

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/dev-tools/gsm-visualizer.test.ts` or documented playtest

**Status**: [x] Created — 32 tests passing

---

## Dependencies

- Depends on: Story 003 (needs overlay shell + `IDevTools.registerDataSource`)
- Unlocks: None

## Completion Notes

**Completed**: 2026-06-27
**Criteria**: 3/3 passing (AC-6a, AC-6b, AC-6c)
**Deviations**: Advisory — IReadOnlyEventBus duplication (LP S-1), CSS rgba instead of variable (LP S-4)
**Test Evidence**: Integration test at `tests/integration/dev-tools/gsm-visualizer.test.ts` (32 tests)
**Code Review**: Complete — Engine Specialist PASS, QA Tester PASS, Lead Programmer APPROVED WITH SUGGESTIONS
**Tech Debt Resolved**: 2 items (keybinds header doc, config defaults mismatch)
**Tech Debt Logged**: 2 items (IReadOnlyEventBus duplication, CSS rgba inconsistency)
