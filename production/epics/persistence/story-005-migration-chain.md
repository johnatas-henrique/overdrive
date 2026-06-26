# Story 005: Migration Chain

> **Epic**: Persistence Interface
> **Status**: In Progress
> **Last Updated**: 2026-06-24
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/persistence.md`
**Requirements**: `TR-PER-002`, `TR-PER-007`

> **TR-PER-002**: Versioned payload container { version: number, data: unknown, timestamp: number }; load() runs migration chain when stored version < current version.
> **TR-PER-007**: Migration chain via registerMigration(from, to, fn) — walks storedVersion → currentVersion one step at a time; missing migration throws MigrationError.

**ADR Governing Implementation**: ADR-0016: Persistence Interface
**ADR Decision Summary**: `registerMigration(from, to, fn)` stores migration functions keyed by version step. On load, the chain walks from the stored version to the current version one step at a time. Each migration function is a pure `(data: unknown) => unknown` transform. Missing steps throw `MigrationError`. Data integrity over availability — if the chain is incomplete, the load is aborted.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript. Migration functions are pure transformations, no storage dependency.

**Control Manifest Rules (this layer)**:

- Required: F29 — Persistence: versioned payload — `{ version, data, timestamp }`. Migration chain for schema upgrades.
- Forbidden: F-F8 — Never use Persistence without versioning — unversioned saves have no migration path.

---

## Acceptance Criteria

_From GDD `design/gdd/persistence.md`, scoped to this story:_

- [ ] AC-6: Stored version < current version with registered migration — migration runs, data is returned at current version.
- [ ] AC-7: Missing migration for a version gap — `load()` throws `MigrationError`.

---

## Implementation Notes

_Derived from ADR-0016 Implementation Guidelines:_

1. **Version format** — Versions are semver strings (e.g. `"0.1.0"`, `"0.2.0"`, `"1.0.0"`). The chain does NOT compare semver by string comparison — that breaks for `"0.10.0"` vs `"0.9.0"`. Instead, parse each component numerically:

   ```typescript
   function parseVersion(v: string): number[] {
     return v.split(".").map(Number);
   }
   ```

   Comparison is done component-by-component (major, then minor, then patch). The chain steps are matched by exact string equality on the `to` field — `registerMigration("0.1.0", "0.2.0", fn)` means "migrate from 0.1.0 to 0.2.0".

2. **`registerMigration(from: string, to: string, fn: MigrationFn): void`** — Stores in an internal `Map<string, MigrationFn>` keyed by a compound key `"${from}→${to}"`. The `from` version must not match the `to` version. No validation on ordering — the walk algorithm discovers the path.

3. **`MigrationFn` type**: `(data: unknown) => unknown`. Contract: the function should treat input as immutable and return a new object. This is a convention, not enforced at runtime.

4. **Internal `_runMigrations(storedVersion: string, data: unknown, currentVersion: string): unknown`**:

   ```
   cursor = storedVersion
   while cursor !== currentVersion:
     // Find the registered migration where migration.from === cursor
     // The chain assumes sequential steps: 0.1.0 → 0.2.0 → 0.3.0
     // Look for the entry where `from` matches the current cursor
     migration = registry.get(cursor)
     if !migration:
       throw MigrationError(`Missing migration: ${cursor} → ${next}`)
     data = migration.fn(data)
     cursor = migration.to
   return data
   ```

5. **Lookup strategy** — The registry stores `from → { to, fn }` in a `Map<string, { to: string, fn: MigrationFn }>` keyed by the `from` version string. The walk algorithm: given cursor `"0.1.0"`, look up `registry.get("0.1.0")` → returns `{ to: "0.2.0", fn }`, sets cursor to `"0.2.0"`, repeats. This requires migratory steps to be chained contiguously (each step's `to` must be the next step's `from`).

6. **When no migration is needed** — If `storedVersion === currentVersion`, no migration runs, data is returned as-is. If `storedVersion > currentVersion` (defensive — would mean a downgrade), log warning and return data as-is without migration.

7. **`CURRENT_VERSION` constant** — The game build version. Set at Persistence construction. Used to stamp `PersistedEntry.version` on save (Story 002) and as the target version for migration on load.

8. **Integration with `load()`** — Story 002's `load()` calls `_runMigrations(stored.version, stored.data, CURRENT_VERSION)` when `stored.version !== CURRENT_VERSION` and `stored.version` is numerically less. This story tests the `_runMigrations` algorithm; the full load → detect → migrate → return pipeline is covered by the cross-story integration test (Epic DoD item: `tests/integration/persistence/migration_load_integration_test.ts`).

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 002 (save-load-key-prefix): PersistedEntry format, load() path, key prefix
- Epic DoD: Full integration test for load → detect version mismatch → run migrations → return migrated data

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-6**: Migration chain walks correctly from version A to B.
  - **Given**: `registerMigration("0.1.0", "0.2.0", addFieldX)` and `registerMigration("0.2.0", "0.3.0", renameFieldX)` are registered
  - **When**: `_runMigrations("0.1.0", data, "0.3.0")` is called
  - **Then**: Both migration functions execute in order; the returned data has both transformations applied; the output version concept is at "0.3.0"
  - **Edge cases**: Stored version === current version → no-op, data returned as-is; stored version > current version → no-op, warning logged; single-step migration (stored=0.1, current=0.2, one reg); long chain of 5+ steps; migration function that returns a deeply transformed object

- **AC-7**: Missing migration for a version gap throws `MigrationError`.
  - **Given**: `registerMigration("0.1.0", "0.2.0", fn)` but NO migration from `"0.2.0"` to `"0.3.0"`
  - **When**: `_runMigrations("0.1.0", data, "0.3.0")` is called
  - **Then**: A `MigrationError` is thrown with a message including the missing step (e.g. `"Missing migration: 0.2.0 → 0.3.0"`)
  - **Edge cases**: No migrations registered at all → throws; gap in the middle of a chain → throws; gap at the beginning (missing from→first) → throws; stored version has no registered path to current version → throws

---

## QA Test Cases

**Test file**: `tests/unit/persistence.test.ts`

### AC-1: migration chain executes
- Store payload at version `0.5.0`
- Register migrations `0.5→0.6`, `0.6→0.7`
- Load
- Assert: both migrations run, payload at version `0.7.0`

### AC-2: missing migration throws
- Store at `0.5.0`
- Register only `0.6→0.7` (missing `0.5→0.6`)
- Load
- Assert: throws `MigrationError('Missing migration: 0.5 → 0.6')`
- Assert: save not loaded (data integrity)

### AC-3: semver comparison (not lexicographic)
- Store at `0.10.0`, current `0.7.0`
- Register `0.7→0.10` and `0.10→0.11`
- Assert: correct chain detected (`0.7→0.10→0.11`)
- Assert: lexicographic comparison would fail (`"0.10" > "0.7"` lexicographically is `false`)

## Test Evidence

Test evidence: `tests/unit/persistence.test.ts` — verify all acceptance criteria pass.

## Dependencies

- Depends on: Story 002 (save-load-key-prefix — PersistedEntry format, load path)
- Unlocks: None
