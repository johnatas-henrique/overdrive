# Story 004: Error Isolation + Registration Edge Cases

> **Epic**: Simulation Snapshot
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/simulation-snapshot.md`
**Requirement**: `TR-SSN-006`, `TR-SSN-002` (duplicate), `TR-SSN-007` (caller timing)
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0017: Simulation Snapshot
**ADR Decision Summary**: Error isolation — per-system `deserialize()` failure is caught and logged; remaining systems restore normally. Duplicate `register()` throws `SnapshotError`. Caller responsible for snapshot timing at fixed game loop points.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Post-cutoff APIs used: None. Pure TypeScript. Zero engine dependencies.

**Control Manifest Rules (this layer)**:

- **Required** (F33): ISnapshotable interface — registration guard for duplicate systemId
- **Forbidden** (F-F4): Never import Foundation from higher layers
- **Guardrail** (F-G5): Full snapshot < 200ms — error isolation adds negligible overhead (try/catch)

---

## Acceptance Criteria

_From GDD `design/gdd/simulation-snapshot.md`, scoped to this story:_

- [ ] AC-1: `SnapshotError` extends `Error` with `systemId: string` and `code: 'SNAPSHOT_DUPLICATE_REGISTRATION' | 'SNAPSHOT_DESERIALIZE_FAILURE'` properties
- [ ] AC-2: Duplicate `register()` call with the same `systemId` throws `SnapshotError('System already registered: {systemId}')`
- [ ] AC-3: After a duplicate registration exception, the registry state is unchanged (no partial registration)
- [ ] AC-4: During `restoreSnapshot()`, a system that throws during `deserialize()` is caught — other systems restore normally
- [ ] AC-5: A system that failed during `deserialize()` retains its previous state (not corrupted by the failed partial restore)
- [ ] AC-6: A warning is logged via `console.warn` for the failed system — includes the systemId and error message
- [ ] AC-7: `restoreSnapshot()` returns `SnapshotRestoreResult { succeeded: string[], failed: Array<{ systemId: string, error: Error }> }` — callers can inspect per-system outcomes
- [ ] AC-8: A system present in the snapshot but not in the registry is skipped gracefully — `console.warn` logged, no crash

---

## Implementation Notes

_Derived from ADR-0017 Implementation Guidelines:_

1. **SnapshotError class**:

   ```typescript
   class SnapshotError extends Error {
     constructor(
       message: string,
       public readonly systemId: string,
       public readonly code:
         | "SNAPSHOT_DUPLICATE_REGISTRATION"
         | "SNAPSHOT_DESERIALIZE_FAILURE"
     ) {
       super(message);
       this.name = "SnapshotError";
     }
   }
   ```

2. **Duplicate check** in `register()`:

   ```typescript
   register(system: ISnapshotable): void {
     if (this.systems.has(system.systemId)) {
       throw new SnapshotError(
         `System already registered: ${system.systemId}`,
         system.systemId,
         'SNAPSHOT_DUPLICATE_REGISTRATION'
       );
     }
     this.systems.set(system.systemId, system);
   }
   ```

   The check happens **before** `Map.set()` — the registry is never in an inconsistent state.

3. **Deserialize isolation** in `restoreSnapshot()`:

   ```typescript
   restoreSnapshot(snapshot: FullGameSnapshot): SnapshotRestoreResult {
     const result: SnapshotRestoreResult = { succeeded: [], failed: [] };
     for (const [systemId, data] of Object.entries(snapshot.systems)) {
       const system = this.systems.get(systemId);
       if (!system) {
         console.warn(`Snapshot: system ${systemId} not registered — skipping`);
         continue;
       }
       try {
         system.deserialize(data.state);
         result.succeeded.push(systemId);
       } catch (e) {
         const error = e instanceof Error ? e : new Error(String(e));
         console.warn(`Snapshot: system ${systemId} failed to deserialize: ${error.message}`);
         result.failed.push({ systemId, error });
       }
     }
     return result;
   }
   ```

4. **SnapshotRestoreResult interface**:

   ```typescript
   interface SnapshotRestoreResult {
     succeeded: string[]; // systemIds that restored successfully
     failed: Array<{
       systemId: string;
       error: Error;
     }>;
   }
   ```

5. **Logging**: `console.warn` is the Foundation-safe logging mechanism — zero imports. No dependency on any logging system.

6. **Caller timing documentation**: Add JSDoc to `takeSnapshot()` and `restoreSnapshot()`:
   ```
   @remarks The caller guarantees this is called at fixed game loop points after
   all systems have completed their update for the tick. Calling during a system
   update may produce inconsistent state.
   ```

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 001 (ISnapshotable + FNV-1a): Interface definition, FNV-1a hashing utility
- Story 002 (Orchestrator Lifecycle): Core lifecycle, FullGameSnapshot type, frequency configuration
- Story 003 (SHA-256 + Determinism): SHA-256, computeSnapshotHash, determinism verification

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Logic — automated test specs:**

- **AC-1**: SnapshotError structure
  - Given: A SnapshotError is constructed with message, systemId 'physics', and code 'SNAPSHOT_DUPLICATE_REGISTRATION'
  - When: The error is examined
  - Then: error.message === 'System already registered: physics'; error.systemId === 'physics'; error.code === 'SNAPSHOT_DUPLICATE_REGISTRATION'; error instanceof Error === true; error.name === 'SnapshotError'
  - Edge cases: Both code variants are constructable; message may vary

- **AC-2**: Duplicate register throws
  - Given: A SimulationSnapshot in Ready state with system 'physics' already registered
  - When: register() is called again with a system using systemId 'physics'
  - Then: SnapshotError is thrown with message containing 'physics'
  - Edge cases: Different systemId same object reference (valid); same systemId different object (throws)

- **AC-3**: Registry unchanged on exception
  - Given: After a duplicate registration attempt (AC-2)
  - When: takeSnapshot() is called
  - Then: The snapshot contains only the original system's state (not a partial or duplicate entry)
  - Edge cases: Verify by systemId count in snapshot systems map

- **AC-4**: Deserialize failure isolation
  - Given: 3 registered systems (A, B, C). System B's deserialize() throws.
  - When: restoreSnapshot() is called with a snapshot containing all three
  - Then: System A and C's deserialize() are called normally; System B's deserialize() threw but was caught
  - Edge cases: All systems throw (all caught, all logged, SnapshotRestoreResult reports all failed)

- **AC-5**: Failed system retains previous state
  - Given: System B is in state S1, snapshot expects state S2, System B throws on deserialize
  - When: restoreSnapshot() completes
  - Then: System B remains in state S1 (previous state preserved)
  - Edge cases: Verify by calling system.hash() and comparing to pre-restore hash

- **AC-6**: console.warn called on failure
  - Given: System B throws during restoreSnapshot()
  - When: A spy on console.warn is active
  - Then: console.warn was called with a message containing systemId 'B' and the error message
  - Edge cases: Multiple failures produce multiple warnings

- **AC-7**: SnapshotRestoreResult returned
  - Given: restoreSnapshot() with 2 successful and 1 failed system
  - When: The result is inspected
  - Then: result.succeeded contains ['A', 'C']; result.failed contains [{ systemId: 'B', error: Error }]
  - Edge cases: All succeeded (succeeded=[...], failed=[]); all failed (succeeded=[], failed=[...]); empty snapshot (succeeded=[], failed=[])

- **AC-8**: Missing system in registry skipped gracefully
  - Given: Snapshot contains systems X and Y; registry only has X
  - When: restoreSnapshot() is called
  - Then: System X restores normally; console.warn logged for missing system Y; no crash
  - Edge cases: System Y had never been registered (never existed vs was disposed)

---

## QA Test Cases

**Test file**: `tests/unit/snapshot.test.ts`

### AC-1: duplicate systemId
- Register system with id `fuel`
- Register second system with same id `fuel`
- Assert: throws `SnapshotError('System already registered: fuel')`

### AC-2: unregistered system skipped
- Call `takeSnapshot()` when system has not registered
- Assert: system skipped with warning logged
- Assert: other systems captured normally

### AC-3: corrupted snapshot on restore
- Call `deserialize()` that throws for one system
- Assert: error caught, logged
- Assert: other systems restore normally

### AC-4: restore result structure
- Call `restoreSnapshot()` with partially corrupt snapshot
- Assert: returns `{ succeeded: [...], failed: [...] }`
- Assert: succeeded contains systems that restored
- Assert: failed contains system that threw

## Test Evidence

Test evidence: `tests/unit/snapshot.test.ts` — verify all acceptance criteria pass.

## Dependencies

- Depends on: Story 002 (uses SimulationSnapshot orchestrator, register(), restoreSnapshot())
- Unlocks: None (edge cases on existing functionality — last story in epic)

## Completion Notes

**Completed**: 2026-06-25
**Criteria**: 8/8 passing
**Deviations**: None
**Test Evidence**: Unit test at `tests/unit/snapshot.test.ts` — 143/143 tests
**Code Review**: Complete (APPROVE — LP-CODE-REVIEW + QL-TEST-COVERAGE ADEQUATE)
