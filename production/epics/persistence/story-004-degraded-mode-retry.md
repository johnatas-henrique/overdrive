# Story 004: Degraded Mode + retry()

> **Epic**: Persistence Interface
> **Status**: Complete
> **Last Updated**: 2026-06-25
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/persistence.md`
**Requirement**: `TR-PER-006`

> Degraded mode: reads return null, writes queue in memory buffer (max 50 entries, FIFO discard); retry() re-probes storage.

**ADR Governing Implementation**: ADR-0016: Persistence Interface
**ADR Decision Summary**: When storage is unavailable, the system enters Degraded mode. Writes are queued in memory (max 50 entries, FIFO eviction). Reads return `null`. `retry()` re-probes storage — on success flushes the queue and transitions to Ready. Non-recoverable failures (SecurityError from private browsing) skip re-probe.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript. Queue and retry logic are pure algorithms, no storage dependency in unit tests.

**Control Manifest Rules (this layer)**:

- Required: F31 — Persistence: degraded mode — when storage unavailable, writes queue in memory (max 50 entries), reads return `null`. `retry()` re-probes.
- Forbidden: F-F9 — Never crash on storage errors — enter degraded mode instead
- Performance: F-G5 — Save/load budget: < 50ms for preferences (~50KB max queue)

---

## Acceptance Criteria

_From GDD `design/gdd/persistence.md`, expanded per QA lead review:_

- [ ] AC-5a: Storage unavailable (simulated) — `init()` enters Degraded state, `load()` returns `null`.
- [ ] AC-5b: In Degraded mode, `save()` queues writes in memory (max 50 entries, FIFO discard on overflow).
- [ ] AC-5c: `retry()` re-probes storage — on success flushes queue and transitions to Ready; on failure remains Degraded. Non-recoverable errors (SecurityError) skip re-probe.

---

## Implementation Notes

_Derived from ADR-0016 Implementation Guidelines:_

1. **Degraded state behavior** — When `state === PersistenceState.Degraded`:
   - `save(key, data)`: Push `{ key, data }` to an internal `writeQueue: Array<{ key: string, data: unknown }>`
   - `load(key)`: Return `Promise.resolve(null)` — do not touch storage
   - `delete(key)`: Remove any pending entry with matching key from the write queue. If not in queue, no-op.
   - Neither method throws — degraded mode is silent.

2. **Queue size enforcement** — Max 50 entries. Before pushing a new entry:

   ```
   if (writeQueue.length >= MAX_QUEUE_SIZE) {
     writeQueue.shift(); // discard oldest (FIFO)
   }
   writeQueue.push({ key, data });
   ```

3. **`retry()` implementation**:
   - If `state !== PersistenceState.Degraded` → no-op, return `Promise.resolve(true)`
   - If previous probe failed with `SecurityError` and `_recoverable === false` → return `Promise.resolve(false)` without re-probing (non-recoverable)
   - Run the same probe as `init()` (setItem + removeItem on `__overdrive_probe__`)
   - On success: iterate `writeQueue` in order, call `localStorage.setItem(PREFIX + key, JSON.stringify({...}))` for each, clear queue, set `state = Ready`, return `Promise.resolve(true)`
   - On failure: stay Degraded, queue persists, return `Promise.resolve(false)`
   - If failure is `SecurityError`, set `_recoverable = false`

4. **Non-recoverable detection** — Booleans `_recoverable` (default `true`) and `_initProbeFailedWithSecurityError`. When the init probe or retry probe catches a `SecurityError`, set both. Once `_recoverable` is `false`, all future `retry()` calls skip probe and return false. This prevents futile probe attempts in private browsing sessions.

5. **Idempotency** — `retry()` is safe to call multiple times. If called from Ready state, it's a no-op. If called repeatedly from Degraded with a persistent failure, each call returns `false` without side effects (non-recoverable path short-circuits).

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 001 (persistence-state-machine-init): state enum, init() probe, state transitions
- Story 002 (save-load-key-prefix): actual localStorage read/write for Ready mode, key prefix

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-5a**: Storage unavailable → Degraded, `load()` returns `null`.
  - **Given**: A `Persistence` instance with storage probe disabled (simulating failure)
  - **When**: `init()` resolves
  - **Then**: `state` equals `Degraded`; calling `load('any')` returns `null`
  - **Edge cases**: `save()` does NOT throw in Degraded; `delete()` does NOT throw in Degraded; calling `load` on a key that exists in localStorage but is in Degraded mode still returns `null`

- **AC-5b**: Degraded save queues writes with max 50 FIFO.
  - **Given**: A `Persistence` instance in Degraded state
  - **When**: 52 unique writes are queued (e.g. `save('k1', 1)` through `save('k52', 52)`)
  - **Then**: The queue contains exactly 50 entries; entries `k1` and `k2` are discarded (FIFO); entry `k52` is present
  - **Edge cases**: Queue size never exceeds 50; repeated save to same key updates in-place (last write wins within queue); queue survives between retry attempts

- **AC-5c**: `retry()` re-probes storage.
  - **Given**: A `Persistence` instance in Degraded state with 3 queued writes
  - **When**: `retry()` is called and the probe succeeds
  - **Then**: `retry()` returns `true`, state transitions to Ready, all 3 queued writes are flushed to localStorage, subsequent `load(key)` returns the flushed data
  - **Given**: A `Persistence` instance in Degraded state where the earlier probe failed with `SecurityError`
  - **When**: `retry()` is called
  - **Then**: `retry()` returns `false` without re-probing (non-recoverable), state remains Degraded
  - **Edge cases**: `retry()` from Ready → no-op, returns `true`; `retry()` on transient failure (QuotaExceeded, later resolved) → probe succeeds, queue flushes

---

## QA Test Cases

**Test file**: `tests/unit/persistence.test.ts`

### AC-1: writes queue in Degraded
- Force Degraded state
- Call `save('key', value)` multiple times
- Assert: writes queued in memory (not lost)

### AC-2: FIFO queue with cap
- Queue 55 entries (cap 50)
- Assert: oldest 5 entries discarded
- Assert: most recent 50 preserved

### AC-3: retry() flushes
- After Degraded, restore storage, call `retry()`
- Assert: queued writes flushed to storage

### AC-4: non-recoverable failure
- Simulate unrecoverable storage error
- Call `retry()`
- Assert: short-circuits (does not retry)

## Test Evidence

Test evidence: `tests/unit/persistence.test.ts` — verify all acceptance criteria pass.

## Dependencies

- Depends on: Story 001 (persistence-state-machine-init), Story 002 (save-load-key-prefix)
- Unlocks: None

## Completion Notes

**Completed**: 2026-06-25
**Criteria**: 3/3 passing
**Deviations**: None
**Test Evidence**: Unit test at `tests/unit/persistence.test.ts` — 159/159 tests
**Code Review**: Complete (APPROVE — LP-CODE-REVIEW + QL-TEST-COVERAGE ADEQUATE)
