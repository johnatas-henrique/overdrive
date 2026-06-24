# Story 001: ISnapshotable Interface + FNV-1a Hashing

> **Epic**: Simulation Snapshot
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/simulation-snapshot.md`
**Requirement**: `TR-SSN-001`, `TR-SSN-004` (FNV-1a)
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0017: Simulation Snapshot
**ADR Decision Summary**: ISnapshotable interface with serialize/deserialize/hash methods. FNV-1a 64-bit for tick-level hashing (~50ns). Systems own their schema; the manager only orchestrates.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Post-cutoff APIs used: None. Pure TypeScript. Zero engine dependencies. Zero npm dependencies.

**Control Manifest Rules (this layer)**:

- **Required** (F33): ISnapshotable interface with `systemId`, `serialize()`, `deserialize()`, `hash()`
- **Required** (F34): FNV-1a 64-bit for tick-level hashing
- **Forbidden** (F-F4): Never import Foundation from higher layers
- **Guardrail** (F-G5): Full snapshot < 200ms serialization (FNV-1a @ ~50ns is irrelevant at this layer)

---

## Acceptance Criteria

_From GDD `design/gdd/simulation-snapshot.md`, scoped to this story:_

- [ ] AC-1: `ISnapshotable` interface is defined with `readonly systemId: string`, `serialize(): Record<string, unknown>`, `deserialize(state: Record<string, unknown>): void`, `hash(): string`
- [ ] AC-2: A concrete test system implements `ISnapshotable` — `serialize()` returns its internal state as a plain JSON-compatible object
- [ ] AC-3: FNV-1a utility `fnv1a(data: string): string` returns a deterministic 16-character hex string (`/^[0-9a-f]{16}$/`)
- [ ] AC-4: Same input to `fnv1a()` → same hex string on every call
- [ ] AC-5: Different inputs to `fnv1a()` → different hex strings (no collisions on 20+ distinct test strings including empty, single-char, and JSON blobs)
- [ ] AC-6: `hash()` on the test system delegates to `fnv1a(JSON.stringify(serialize()))` — same state → same hash

---

## Implementation Notes

_Derived from ADR-0017 Implementation Guidelines:_

1. **ISnapshotable** — interface, not class. `systemId` is `readonly` — immutable post-construction.

2. **serialize()** returns `Record<string, unknown>`. Must contain only JSON.stringify-compatible values (no classes, Maps, Sets, or circular references). Arrays of primitives and nested objects are fine.

3. **deserialize(state)** mutates internal state in-place. Returns `void`. Never creates new instances or replaces `this`.

4. **hash()** returns deterministic string: same state → same hash, always, across all platforms. Implemented as `fnv1a(JSON.stringify(this.serialize()))`.

5. **FNV-1a** implementation — pure TypeScript, zero dependencies:

   ```typescript
   function fnv1a(data: string): string {
     let hash = 0xcbf29ce484222325n; // FNV offset basis (64-bit)
     const prime = 0x100000001b3n; // FNV prime (64-bit)
     for (let i = 0; i < data.length; i++) {
       hash ^= BigInt(data.charCodeAt(i));
       hash = (hash * prime) & 0xffffffffffffffffn; // force 64-bit
     }
     return hash.toString(16).padStart(16, "0");
   }
   ```

6. **No singleton pattern** — the ADR shows `getInstance()` but the project standard (AGENTS.md: "All dependencies injected, no static singletons for game state") prohibits it. The SimulationSnapshot manager is instantiated and injected. The interface and FNV-1a utility functions are stateless exports.

7. **File organisation**: `src/foundation/simulation-snapshot/isnapshotable.ts` for the interface, `src/foundation/simulation-snapshot/fnv1a.ts` for the hashing utility, `src/foundation/simulation-snapshot/test-system.ts` for the test implementation (or keep the test system only in test files).

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 002 (Orchestrator Lifecycle): `SimulationSnapshot` class, `register()`, `takeSnapshot()`, `FullGameSnapshot` type, frequency configuration
- Story 003 (SHA-256 + Determinism): SHA-256 via Web Crypto API, `computeSnapshotHash()`, `restoreSnapshot()` round-trip
- Story 004 (Error Isolation): `SnapshotError` class, duplicate registration guard, deserialize error isolation

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Logic — automated test specs:**

- **AC-1**: ISnapshotable interface is defined with all 4 members
  - Given: A TypeScript file defining the interface
  - When: A concrete class is created implementing ISnapshotable
  - Then: TypeScript compilation succeeds; all 4 members (systemId, serialize, deserialize, hash) are present and correctly typed
  - Edge cases: N/A — compile-time check

- **AC-2**: Concrete test system serializes and deserializes state
  - Given: A test system implementing ISnapshotable with known internal state `{ value: 42, label: 'test' }`
  - When: serialize() is called
  - Then: Returns `{ value: 42, label: 'test' }`
  - Edge cases: State with nested objects, state with arrays, empty state `{}`, state with `null` values

- **AC-3**: fnv1a returns 16-char hex string
  - Given: Input string `"hello"`
  - When: fnv1a("hello") is called
  - Then: Result matches `/^[0-9a-f]{16}$/`
  - Edge cases: Empty string `""`, single char, unicode characters, large JSON string

- **AC-4**: fnv1a is deterministic
  - Given: Input string `"test data"`
  - When: fnv1a is called twice with the same input
  - Then: Both calls return identical hex strings
  - Edge cases: Empty string, maximum-length string within typical state size (~10KB)

- **AC-5**: Different inputs produce different hashes
  - Given: 20+ distinct input strings
  - When: fnv1a() is called for each
  - Then: All 20+ results are unique (no collisions)
  - Edge cases: Very similar inputs ("abc" vs "abd"), inputs differing only in case, inputs with trailing whitespace

- **AC-6**: hash() delegates to fnv1a(JSON.stringify(serialize()))
  - Given: A test system in known state `{ x: 1, y: 2 }`
  - When: system.hash() is called
  - Then: Result equals fnv1a(JSON.stringify({ x: 1, y: 2 }))
  - Edge cases: Same logical state with different property insertion order (object key order is preserved in modern JS, but test should confirm)

---

## QA Test Cases

**Test file**: `tests/unit/snapshot.test.ts`

### AC-1: ISnapshotable interface
- Implement test system with ISnapshotable
- Call `serialize()` — returns state object
- Call `deserialize(state)` — restores from state
- Assert: round-trip produces identical state

### AC-2: FNV-1a deterministic
- Call `hash()` on same state twice
- Assert: identical hash strings

### AC-3: different state, different hash
- Modify state, call `hash()`
- Assert: hash differs from original

### AC-4: cross-run determinism
- Create same state in two separate runs
- Assert: `hash()` produces identical output

## Test Evidence

Test evidence: `tests/unit/snapshot.test.ts` — verify all acceptance criteria pass.

## Dependencies

- Depends on: None (first Foundation-level dependency for this epic)
- Unlocks: Story 002, 003, 004
