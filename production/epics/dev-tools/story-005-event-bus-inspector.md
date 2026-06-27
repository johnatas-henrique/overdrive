# Story 005: Event Bus Inspector

> **Epic**: Dev Tools
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/dev-tools.md`
**Requirement**: `TR-DVT-002`
_Event Bus inspector — live subscription list, emit history (last 100 events), filter by event name._

**ADR Governing Implementation**: ADR-0009: Dev Tools Architecture
**ADR Decision Summary**: Dev Tools subscribes to all events for the inspector — read-only subscription only, never emits. 100-entry ring buffer of emit history in Dev Tools. Event Bus subscription list read via public API (`getSubscriptions(): Map<string, number>` — coordinate with Event Bus owner).

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No Babylon.js imports needed — pure DOM manipulation + Event Bus integration.

**Control Manifest Rules (this layer)**:

- **Required** (D6): Dev Tools: read-only on all systems — never writes state, never emits Event Bus events
- **Forbidden** (D-F3): Never emit events on the Event Bus
- **Required** (D1): HTML overlay (`pointer-events: none`)
- **Guardrail**: Event Bus subscription data retrieved via `getSubscriptions(): Map<string, number>` (needs addition to IEventBus — coordinate with Event Bus owner)

---

## Acceptance Criteria

_From GDD `design/gdd/dev-tools.md`, scoped to this story:_

- [ ] AC-5a: Event Log tab shows last 100 events, newest first, scrollable (FIFO eviction)
- [ ] AC-5b: Live subscription list — reads Event Bus via `getSubscriptions(): Map<string, number>` (coordinate with Event Bus owner to add this method); shows event name and handler count
- [ ] AC-5c: Filter by event name — text input filters the event log by substring match
- [ ] AC-5d: Dev Tools never calls `emit()` on the Event Bus; uses read-only wrapper or proxy to enforce this

---

## Implementation Notes

_Derived from ADR-0009 Implementation Guidelines:_

1. **Event capture**: Dev Tools subscribes to all Event Bus events via a wildcard or by hooking into `emit()`. Stores in a 100-entry ring buffer:

   ```typescript
   if (import.meta.env.DEV) {
     // Store a reference to emit for inspection, but never call it
     const originalEmit = eventBus.emit.bind(eventBus);
     // Subscribe to all events via a catch-all handler
     eventBus.on("*", (event) => {
       this._eventLog.push({
         name: event.name,
         payload: event.payload,
         timestamp: Date.now(),
       });
       if (this._eventLog.length > 100) this._eventLog.shift();
     });
   }
   ```

   Note: The Event Bus's `EventMap` central type registry enables typed subscription.

2. **Subscription list** (AC-5b): The Event Bus must expose `getSubscriptions(): Map<string, number>` — a method that returns event names and their handler counts. This requires coordination with the Event Bus owner to add to `IEventBus`. If not available, Dev Tools instruments internally by tracking `on()`/`off()` calls.

3. **Read-only enforcement** (AC-5d): Dev Tools receives a wrapped Event Bus reference that only exposes `on()` and `off()` — not `emit()`. This is enforced at the type level:

   ```typescript
   interface IReadOnlyEventBus {
     on<K extends keyof EventMap>(
       event: K,
       handler: (payload: EventMap[K]) => void
     ): Subscription;
     off<K extends keyof EventMap>(
       event: K,
       handler: (payload: EventMap[K]) => void
     ): void;
   }
   ```

4. **Event log filter** (AC-5c): A text `<input>` above the event list. `input.value` is used as a substring filter — only events whose `name` includes the filter text are displayed. Filter is case-insensitive.

5. **GSM history integration**: Dev Tools listens to `gsm.state.entered` events for the GSM visualizer (Story 006) — same mechanism, different rendering:
   ```typescript
   if (import.meta.env.DEV) {
     eventBus.on("gsm.state.entered", (state) => {
       devTools.recordTransition(state, Date.now());
     });
   }
   ```

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 003]: HTML overlay shell, `IDevTools` interface, tab scaffolding
- [Story 004]: Config tree panel
- [Story 006]: GSM visualizer panel (uses same event capture but separate rendering)
- [Story 007]: Simulation Snapshot panel
- [Story 008]: AI Telemetry tab

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-5a**: event log shows last 100
  - Given: Event Bus has dispatch history
  - When: Dev Tools event log tab is opened
  - Then: the log shows the most recent 100 events, newest first; each entry has timestamp and event name; if more than 100 events have been dispatched, only the latest 100 are visible; the log container is scrollable (`overflow: auto`)

- **AC-5a**: FIFO eviction
  - Given: Event Bus has had 105 events dispatched
  - When: Dev Tools event log tab is opened
  - Then: exactly 100 events are displayed; the oldest event in the log is event #6 (events #1–5 are evicted)

- **AC-5b**: subscription list
  - Given: Event Bus has 3 subscribers for `"gsm.state.entered"`, 1 subscriber for `"fuel.low"`, 0 subscribers for `"race.checkered"`
  - When: Dev Tools subscription list is viewed
  - Then: it shows `"gsm.state.entered: 3"`, `"fuel.low: 1"`; `"race.checkered"` is not shown (or shown as 0)

- **AC-5c**: filter by event name
  - Given: Event Log tab shows 100 events from various event types
  - When: user types `"fuel"` in the filter input
  - Then: only events whose name contains `"fuel"` (e.g. `"fuel.low"`, `"fuel.empty"`) are displayed
  - When: filter is cleared
  - Then: all 100 events are visible again

- **AC-5d**: no emit
  - Given: a wrapped Event Bus with an emit call counter
  - When: Dev Tools is active and all features are used (open tabs, scroll logs, expand config tree)
  - Then: the emit counter remains at 0 (no `emit()` calls originated from Dev Tools code)

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/dev-tools/event-bus-inspector_test.ts` or documented playtest

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (needs overlay shell + `IDevTools.registerDataSource`)
- Unlocks: Story 006 (GSM visualizer uses same event capture mechanism)
