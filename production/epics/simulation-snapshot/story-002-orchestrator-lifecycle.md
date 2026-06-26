# Story 002: SimulationSnapshot Orchestrator — Core Lifecycle

> **Epic**: Simulation Snapshot
> **Status**: Complete
> **Last Updated**: 2026-06-25
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/simulation-snapshot.md`
**Requirement**: `TR-SSN-002`, `TR-SSN-003`, `TR-SSN-005`, `TR-SSN-007`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0017: Simulation Snapshot
**ADR Decision Summary**: Registration pattern via `register(system)`. `takeSnapshot()` captures all registered systems into `FullGameSnapshot`. JSON format for MVP. Full snapshots only. Configurable frequency (every tick, Nth tick, on-demand). Caller responsible for snapshot timing.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Post-cutoff APIs used: None. Pure TypeScript. Engine-independent — does not import Babylon.js.

**Control Manifest Rules (this layer)**:

- **Required** (F33): ISnapshotable registration — `Map<string, ISnapshotable>` keyed by `systemId`
- **Required** (F35): JSON format for MVP — `Record<string, unknown>` ensures JSON.stringify compatibility
- **Required** (F36): Full snapshots only — each system serializes complete state; no delta compression
- **Forbidden** (F-F4): Never import Foundation from higher layers

---

## Acceptance Criteria

_From GDD `design/gdd/simulation-snapshot.md`, scoped to this story:_

- [ ] AC-1: `SimulationSnapshot` has `init()` → transitions to Ready state; pre-init `register()` and `takeSnapshot()` throw `SnapshotError('Not initialized')`
- [ ] AC-2: `dispose()` → transitions to Disposed state; clears registry; post-dispose `takeSnapshot()` throws
- [ ] AC-3: `register(system)` adds the system to internal registry — systemId appears in subsequent `takeSnapshot()` output
- [ ] AC-4: `takeSnapshot()` returns a `FullGameSnapshot` containing `tick`, `timestamp`, and `systems` record keyed by `systemId` with per-system `state` and `hash` (FNV-1a)
- [ ] AC-5: FullGameSnapshot is JSON-serializable — `JSON.parse(JSON.stringify(snapshot))` round-trips without data loss
- [ ] AC-6: Zero registered systems → `takeSnapshot()` returns valid snapshot with empty `systems: {}` (not an error)
- [ ] AC-7: `takeEveryNthTick = 1` (default) → `takeSnapshot(tick)` returns a snapshot for every tick
- [ ] AC-8: `takeEveryNthTick = 60` → `takeSnapshot(tick)` returns `null` for ticks where `tick % 60 !== 0`; returns snapshot when `tick % 60 === 0`
- [ ] AC-9: On-demand `takeSnapshot({ force: true })` returns snapshot regardless of `takeEveryNthTick` setting
- [ ] AC-10: `dispose()` calls `serialize()` one final time on all registered systems before clearing

---

## Implementation Notes

_Derived from ADR-0017 Implementation Guidelines:_

1. **SimulationSnapshot** is a regular class — not a singleton. Instantiate and inject via constructor. See project standard: "All dependencies injected, no static singletons for game state" (AGENTS.md).

2. **State machine** for the manager itself:

   ```
   [Uninitialized] --init()--> [Ready] --dispose()--> [Disposed]
   ```
   - `Uninitialized`: `register()`, `takeSnapshot()`, `restoreSnapshot()` all throw
   - `Ready`: Normal operation
   - `Disposed`: All methods throw except `dispose()` (idempotent no-op)

3. **Internal registry**: `Map<string, ISnapshotable>` keyed by `systemId`. Systems register during their own `init()` calls.

4. **FullGameSnapshot interface** (from ADR-0017):

   ```typescript
   interface FullGameSnapshot {
     tick: number;
     timestamp: number; // Date.now() at capture
     systems: Record<
       string,
       {
         state: Record<string, unknown>;
         hash: string; // FNV-1a of serialized state
       }
     >;
     snapshotHash: string; // SHA-256 (deferred — string '' in this story)
   }
   ```

   `snapshotHash` is `''` in this story — Story 003 populates it via SHA-256.

5. **Snapshot frequency**: `takeEveryNthTick` parameter on the constructor or config. Defaults to `1` (every tick). `takeSnapshot(tick)` checks `tick % this.takeEveryNthTick === 0` before building snapshot. Returns `null` when frequency condition is not met.

6. **On-demand snapshots**: `takeSnapshot({ force: true })` skips the frequency check entirely. The tick parameter is optional when `force = true`.

7. **JSON compatibility**: All data in FullGameSnapshot must survive `JSON.parse(JSON.stringify(x))`. No Maps, Sets, classes, or circular references in `serialize()` output.

8. **Caller timing**: Document that the caller must call `takeSnapshot()` only at fixed game loop points (after all systems have updated for the tick). This is a convention, not enforced in code.

9. **Final serialization on dispose**: `dispose()` calls `serialize()` on each registered system one last time (for potential recovery), then clears the registry.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 001 (ISnapshotable + FNV-1a): Interface definition, FNV-1a hashing utility, test system
- Story 003 (SHA-256 + Determinism): SHA-256 digest, `computeSnapshotHash()`, `restoreSnapshot()` round-trip verification
- Story 004 (Error Isolation): `SnapshotError` class definition (beyond basic "Not initialized" error), duplicate registration guard, deserialize error isolation

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Integration — automated test specs:**

- **AC-1**: init/dispose lifecycle guards
  - Given: A SimulationSnapshot instance in Uninitialized state
  - When: register() or takeSnapshot() is called
  - Then: Both throw SnapshotError('Not initialized')
  - Edge cases: Double-init is no-op; init after dispose throws

- **AC-2**: Dispose clears registry
  - Given: A SimulationSnapshot instance with 3 registered systems
  - When: dispose() is called
  - Then: Internal registry is empty; post-dispose takeSnapshot() throws
  - Edge cases: Double dispose is idempotent (no error)

- **AC-3**: Register makes system appear in snapshot
  - Given: A SimulationSnapshot instance (Ready) and a test ISnapshotable system with systemId 'test-sys'
  - When: register() is called, then takeSnapshot() is called
  - Then: The snapshot's systems map contains key 'test-sys' with the system's serialized state
  - Edge cases: Register multiple systems — all appear; register then overwrite by same systemId (covered in Story 004)

- **AC-4**: FullGameSnapshot shape
  - Given: 2 registered systems with known states
  - When: takeSnapshot() is called
  - Then: Result has `tick` (number), `timestamp` (number > 0), `systems` (Record), each system has `state` (object) and `hash` (16-char hex string)
  - Edge cases: Empty systems map → `systems: {}`

- **AC-5**: JSON round-trip
  - Given: A FullGameSnapshot from takeSnapshot()
  - When: JSON.parse(JSON.stringify(snapshot)) is computed
  - Then: Deep equality holds between original and round-tripped objects
  - Edge cases: Nested objects in system state, numeric values, null values, empty arrays

- **AC-6**: Empty snapshot valid
  - Given: A SimulationSnapshot instance with zero registered systems
  - When: takeSnapshot() is called
  - Then: Returns `{ tick, timestamp, systems: {}, snapshotHash: '' }` — no exception
  - Edge cases: Verify tick and timestamp are still populated correctly

- **AC-7**: Frequency every tick (default)
  - Given: takeEveryNthTick = 1
  - When: takeSnapshot() is called for ticks 0 through 10
  - Then: All 11 calls return a FullGameSnapshot (none return null)
  - Edge cases: Tick 0 returns snapshot (0 % 1 === 0)

- **AC-8**: Frequency every Nth tick
  - Given: takeEveryNthTick = 60
  - When: takeSnapshot(tick) is called for ticks 0, 59, 60, 119, 120
  - Then: Ticks 0, 60, 120 return snapshots; ticks 59, 119 return null
  - Edge cases: Tick 0 boundary (0 % 60 === 0); tick exactly at N; tick just below N

- **AC-9**: On-demand bypasses frequency
  - Given: takeEveryNthTick = 60
  - When: takeSnapshot({ force: true }) is called at tick 1
  - Then: Returns a FullGameSnapshot despite frequency condition not being met
  - Edge cases: force=true with negative tick; force=true at init before first tick

- **AC-10**: Dispose calls final serialize
  - Given: A registered ISnapshotable system with known state
  - When: dispose() is called
  - Then: The system's serialize() was called at least once during dispose; registry is cleared after
  - Edge cases: Dispose with zero registered systems (no-op, no error)

---

## QA Test Cases

**Test file**: `tests/integration/snapshot.test.ts`

### AC-1: register + capture
- Register 3 test systems
- Call `takeSnapshot()`
- Assert: snapshot contains state from all 3 systems

### AC-2: restore + hash match
- Take snapshot, modify all systems
- Call `restoreSnapshot(snapshot)`
- Assert: `hash()` for each system matches expected values

### AC-3: end-to-end lifecycle
- Full cycle: register → takeSnapshot → modify → restoreSnapshot → verify
- Assert: all systems return to exact captured state

## Test Evidence

Test evidence: `tests/unit/snapshot.test.ts` — verify all acceptance criteria pass.

## Dependencies

- Depends on: Story 001 (ISnapshotable interface + FNV-1a)
- Unlocks: Story 003, Story 004

## Completion Notes

**Completed**: 2026-06-25
**Criteria**: 10/10 passing
**Deviations**: None
**Test Evidence**: Unit test at `tests/unit/snapshot.test.ts` — 143/143 tests
**Code Review**: Complete (APPROVE — LP-CODE-REVIEW + QL-TEST-COVERAGE ADEQUATE)
