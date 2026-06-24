# Story 003: SHA-256 Sync Hash + Snapshot Determinism

> **Epic**: Simulation Snapshot
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/simulation-snapshot.md`
**Requirement**: `TR-SSN-004` (SHA-256), `TR-SSN-005` (determinism)
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0017: Simulation Snapshot
**ADR Decision Summary**: SHA-256 via Web Crypto API `crypto.subtle.digest` for network sync/save integrity (~1µs). `restoreSnapshot()` restores all systems exactly. Two snapshots at same tick with same state produce identical output.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Post-cutoff APIs used: None. Web Crypto API (`crypto.subtle.digest`) is standard since 2014. Available in all modern browsers, Node.js 15+. Requires Secure Context (HTTPS/localhost). For vitest in Node.js environment, `crypto.subtle` may require a polyfill or global mock — documented in test setup.

**Control Manifest Rules (this layer)**:

- **Required** (F34): Two-tier hashing — SHA-256 for network/save integrity
- **Required** (F36): Full snapshots only — restoreSnapshot restores complete system state
- **Forbidden** (F-F4): Never import Foundation from higher layers

---

## Acceptance Criteria

_From GDD `design/gdd/simulation-snapshot.md`, scoped to this story:_

- [ ] AC-1: `sha256(data: string): Promise<string>` returns a 64-character lowercase hex string via `crypto.subtle.digest("SHA-256", ...)`
- [ ] AC-2: Same input to `sha256()` → same output (deterministic)
- [ ] AC-3: `computeSnapshotHash(snapshot: FullGameSnapshot): Promise<string>` computes SHA-256 of all systems' state, sorted by `systemId`, returns hex string
- [ ] AC-4: `restoreSnapshot(snapshot)` calls `deserialize()` on each registered system with the stored state from the snapshot
- [ ] AC-5: After `restoreSnapshot()`, each system's `hash()` matches the stored hash from the snapshot (restore fidelity)
- [ ] AC-6: Two `takeSnapshot(tick)` calls at the same tick with identical system state produce snapshots with deeply equal `systems` payloads and identical per-system hashes (timestamp may differ between calls)
- [ ] AC-7: SHA-256 produces correct output for known inputs: empty string `""`, string `"hello"`, and complex JSON string (verify against known SHA-256 vectors)
- [ ] AC-8: `computeSnapshotHash()` returns the same hash for logically identical snapshots regardless of system registration order

---

## Implementation Notes

_Derived from ADR-0017 Implementation Guidelines:_

1. **SHA-256 utility** (from ADR-0017):

   ```typescript
   async function sha256(data: string): Promise<string> {
     const encoder = new TextEncoder();
     const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
     const bytes = new Uint8Array(buffer);
     return Array.from(bytes)
       .map((b) => b.toString(16).padStart(2, "0"))
       .join("");
   }
   ```

2. **computeSnapshotHash** (`snapshotHash` computation):
   - Iterate `snapshot.systems` entries sorted by `systemId` (alphabetical)
   - Concatenate each system's state (JSON.stringify) in sorted order
   - Compute `sha256(concatenatedInput)` — returns a single hex string
   - Deterministic order is critical: same systems in any registration order → same hash

3. **snapshotHash field**: The `FullGameSnapshot.snapshotHash` is populated by calling `computeSnapshotHash()` and assigned to the snapshot. This is **not** computed inline in `takeSnapshot()` — it's a separate step to keep `takeSnapshot()` synchronous (performance-critical path).

4. **restoreSnapshot(snapshot)**:
   - Iterates over `snapshot.systems` entries
   - For each `(systemId, { state })`: looks up system in registry, calls `system.deserialize(state)`
   - After all systems restored: optionally calls `system.hash()` and compares to `snapshot.systems[systemId].hash`
   - Returns `void` (success/failure tracking added in Story 004)

5. **Determinism verification** (AC-6):
   - `timestamp` is the one non-deterministic field — `Date.now()` differs between calls
   - The "identical" assertion applies to the `systems` payload (state + hashes), not the top-level metadata
   - Two snapshots at same tick with same system state → per-system FNV-1a hashes are identical

6. **SHA-256 correctness** (AC-7):
   - Empty string SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
   - `"hello"` SHA-256: `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824`

7. **Test environment**: `vitest --environment node` does not expose `crypto.subtle` by default. Use `import { webcrypto } from 'node:crypto'` and assign to `globalThis.crypto` before tests, or use vitest's `setupFiles` to polyfill.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 001 (ISnapshotable + FNV-1a): Interface definition, FNV-1a hashing utility
- Story 002 (Orchestrator Lifecycle): `SimulationSnapshot` class, `register()`, `takeSnapshot()`, frequency configuration
- Story 004 (Error Isolation): `SnapshotError`, error isolation on deserialize, duplicate check

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Integration — automated test specs:**

- **AC-1**: sha256 returns 64-char hex string
  - Given: Input string `"test data"`
  - When: await sha256("test data") is called
  - Then: Result matches `/^[0-9a-f]{64}$/`
  - Edge cases: Empty string, single character, unicode, JSON string, very long string (10KB)

- **AC-2**: sha256 is deterministic
  - Given: Input string `"hello"`
  - When: sha256 is called twice with the same input
  - Then: Both calls return identical hex strings
  - Edge cases: Empty string, string with trailing newline vs without

- **AC-3**: computeSnapshotHash sorts by systemId
  - Given: A FullGameSnapshot with systems `{ z: {...}, a: {...}, m: {...} }`
  - When: computeSnapshotHash(snapshot) is called
  - Then: The system state is processed in order a, m, z (alphabetical by systemId)
  - Edge cases: Single system, empty systems map (hash of empty string)

- **AC-4**: restoreSnapshot calls deserialize
  - Given: A registered system with spy on deserialize, and a snapshot containing that system's state
  - When: restoreSnapshot(snapshot) is called
  - Then: system.deserialize was called exactly once with the stored state
  - Edge cases: System in snapshot not in registry → skipped (logged); system in registry not in snapshot → skipped

- **AC-5**: Restore fidelity — hash matches
  - Given: A system with known state, a snapshot captured from that state
  - When: restoreSnapshot(snapshot) is called, then system.hash() is called
  - Then: system.hash() matches snapshot.systems[systemId].hash
  - Edge cases: Multiple systems all verify; system with zero state

- **AC-6**: Same tick → same snapshot content
  - Given: Two registered systems with identical state
  - When: takeSnapshot(42) is called twice, then systems payloads are compared
  - Then: Both snapshots have deeply equal `systems` maps and identical per-system hashes
  - Edge cases: Timestamps differ but are excluded from comparison; verify with deep-equal excluding `timestamp`

- **AC-7**: SHA-256 correctness against known vectors
  - Given: Known SHA-256 vectors
  - When: sha256("") and sha256("hello") are called
  - Then: Results match `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (empty) and `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824` ("hello")
  - Edge cases: Complex JSON blob with nested structures

- **AC-8**: Registration order independence
  - Given: Two identical state sets, registered in opposite order (A then B vs B then A)
  - When: computeSnapshotHash() is called on both snapshots
  - Then: Both return the identical hash string
  - Edge cases: Three or more systems with varied order permutations

---

## QA Test Cases

**Test file**: `tests/unit/snapshot.test.ts`

### AC-1: SHA-256 deterministic
- Call `crypto.subtle.digest('SHA-256', data)` on same input twice
- Assert: identical digest output

### AC-2: dual hashing (FNV-1a + SHA-256)
- Take snapshot, compute FNV-1a (tick hash) and SHA-256 (sync hash)
- Assert: both hashes deterministic for same state
- Assert: FNV-1a faster but less collision-resistant than SHA-256

### AC-3: timestamp excluded from comparison
- Create same state with different timestamps
- Assert: hash excludes timestamp — same state = same hash

## Test Evidence

Test evidence: `tests/unit/snapshot.test.ts` — verify all acceptance criteria pass.

## Dependencies

- Depends on: Story 002 (uses FullGameSnapshot type and SimulationSnapshot orchestrator)
- Unlocks: None (standalone verification — can be implemented in parallel with Story 004 after Story 002)
