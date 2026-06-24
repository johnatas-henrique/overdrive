# Story 005: State History Ring Buffer

> **Epic**: Game State Machine
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/game-state-machine.md`
**Requirement**: `TR-GSM-005` — State history ring buffer (last 20 transitions) recording `from`, `to`, `timestamp`, and `durationInPreviousState`.

**ADR Governing Implementation**: ADR-0024: Game State Machine
**ADR Decision Summary**: Each transition is recorded as `{ from, to, timestamp, durationInPreviousState }`. The ring buffer is readable by Dev Tools overlay for debugging — developers can see the last 20 state transitions with timing. History is debug data (not simulation data), so `Date.now()` is acceptable per control manifest F15 exclusion.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer.

**Control Manifest Rules (this layer)**:

- Required: F27 (20-entry ring buffer of last transitions for debug)
- Guardrail: F15 — `Date.now()` / `performance.now()` forbidden inside pipeline `update()`, but history is debug data, not simulation data — this exclusion is noted

---

## Acceptance Criteria

- [ ] Each successful transition records: `{ from, to, timestamp, durationInPreviousState }`
- [ ] The history buffer has a maximum capacity of exactly 20 entries
- [ ] After 25 transitions, the buffer contains exactly the last 20 entries (FIFO eviction — oldest removed)
- [ ] History is exposed via a read-only accessor `getHistory(): ReadonlyArray<TransitionRecord>` for debug tools
- [ ] Timestamps are recorded from `Date.now()` — acceptable since this is debug data, not simulation data
- [ ] On `dispose()`, history is cleared

---

## Implementation Notes

_Derived from ADR-0024 Implementation Guidelines:_

1. **TransitionRecord type**:
   ```typescript
   interface TransitionRecord {
     from: State;
     to: State;
     timestamp: number; // Date.now() when transition completed (hooks resolved)
     durationInPreviousState: number; // ms — timestamp of this transition - timestamp of previous transition
   }
   ```
2. **Ring buffer implementation**: Use a fixed-size array with `push` + shift-when-over-capacity pattern. For 20 entries, performance is irrelevant — the array is tiny.
   ```typescript
   private readonly _history: TransitionRecord[] = [];
   private readonly _maxHistorySize = 20;
   ```
3. **Recording point**: Record after `onEnter` of target resolves (transition fully complete). Do NOT record for same-state no-ops. Do NOT record for rollbacks (the transition didn't complete).
4. **durationInPreviousState calculation**: `currentTimestamp - previousEntry.timestamp` where `previousEntry` is the last entry in history, or `initTimestamp` for the first transition.
5. **First transition duration**: For Loading → Menu, `durationInPreviousState` = `Date.now() - initTimestamp`.
6. **FIFO eviction**: On push, if `_history.length >= _maxHistorySize`, call `_history.shift()` before push.
7. **getHistory()**: Return a shallow copy (`[...this._history]`) so the caller cannot mutate internal state.
8. **Clear on dispose**: `_history.length = 0`.
9. **File**: Extend `GameStateMachine.ts` with history recording and accessor.

---

## Out of Scope

- Dev Tools overlay consuming history (TR-DVT-005 — Dev Tools epic)
- Transition timing beyond what's needed for history (profiling is separate)
- Persistence of history (debug data, not saved)

---

## QA Test Cases

- **AC-1**: Each successful transition records { from, to, timestamp, durationInPreviousState }
  - Given: GSM initialized in Loading, then transition to Menu at known time
  - When: GSM.transition('Menu') is called and completes
  - Then: getHistory()[0] has: from: 'Loading', to: 'Menu', timestamp: (approx Date.now()), durationInPreviousState: (time since init)
  - Edge cases: durationInPreviousState for first transition (time from init); subsequent durations (diff between consecutive timestamps); same-state no-op NOT recorded

- **AC-2**: History buffer max capacity of 20 entries
  - Given: GSM initialized; 20 successful transitions performed
  - When: Checking getHistory().length
  - Then: length is 20
  - When: A 21st transition is performed
  - Then: length is still 20
  - Edge cases: Buffer at exactly 20 (no eviction yet); buffer at 0 before any transition (empty array)

- **AC-3**: FIFO eviction — oldest removed first
  - Given: 25 transitions with distinct states T1 through T25
  - When: Reading getHistory()
  - Then: Entry[0].to is 'T6'; Entry[19].to is 'T25'; T1-T5 NOT present
  - Edge cases: 100 transitions (only last 20 retained); verify exact count

- **AC-4**: getHistory(): ReadonlyArray<TransitionRecord> accessor
  - Given: GSM with some transition history
  - When: Calling getHistory()
  - Then: Return value is an array; individual entries cannot be mutated (compile-time ReadonlyArray); mutations to returned array do not affect internal state
  - Edge cases: Empty history before transition returns [], not null; getHistory() returns shallow copy

- **AC-5**: Timestamp from Date.now() (debug, not simulation)
  - Given: GSM with fake timer control (sinon.useFakeTimers)
  - When: Transitions occur at known wall-clock times
  - Then: Recorded timestamps match the fake clock; consistent across all entries
  - Edge cases: Timer source is consistent (not mixed Date.now + performance.now)

- **AC-6**: On dispose(), history is cleared
  - Given: GSM with 10 transitions in history
  - When: GSM.dispose() is called
  - Then: getHistory().length is 0
  - Edge cases: dispose() with empty history (no error); after dispose, new transitions not added (Story 006)

---

## QA Test Cases

**Test file**: `tests/unit/gsm.test.ts`

### AC-1: history records transitions
- Execute N transitions
- Assert: ring buffer contains all N entries

### AC-2: buffer wrap
- Execute more transitions than buffer capacity
- Assert: oldest entries are overwritten
- Assert: most recent N entries preserved

### AC-3: history accessible
- Call `getHistory()` or equivalent
- Assert: returns ordered list of transitions
- Assert: each entry has source state, target state, and timestamp

## Test Evidence
## Dependencies

- **Depends on**: Story 001 (core-fsm-transition-table) — requires working transitions to record; Story 003 (event-bus-integration) — for event-based recording; Story 004 (transition-throttling) — for tick-based sequencing
- **Unlocks**: Dev Tools debug overlay (TR-DVT-005) — the history accessor is the data source for the overlay
