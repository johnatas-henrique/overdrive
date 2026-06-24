# Story 002: save/load Round-trip + Key Prefix

> **Epic**: Persistence Interface
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/persistence.md`
**Requirements**: `TR-PER-001`, `TR-PER-003`

> **TR-PER-001**: Async-first API — save(key, data) and load\<T\>(key) return Promise\<T\>; never call raw localStorage directly.
> **TR-PER-003**: Global key prefix (default 'overdrive\_') prepended to all storage keys to avoid cross-app collisions on same domain.

**ADR Governing Implementation**: ADR-0016: Persistence Interface
**ADR Decision Summary**: Async-first public methods (`save<T>`, `load<T>`, `delete` return Promise). PersistedEntry container `{ version: string, data: unknown, timestamp: number }`. Global `'overdrive_'` prefix on all storage keys.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript. Uses `localStorage` Web API (available in all browsers, Tauri webview, Electron webview).

**Control Manifest Rules (this layer)**:

- Required: F28 — Persistence: async-first — all public methods return `Promise<T>`, even with synchronous backend
- Required: F32 — Persistence: `'overdrive_'` key prefix — all storage keys namespaced
- Forbidden: F-F8 — Never use Persistence without versioning — unversioned saves have no migration path
- Performance: F-G5 — Save/load budget: < 50ms for preferences (localStorage sync)

---

## Acceptance Criteria

_From GDD `design/gdd/persistence.md`, scoped to this story:_

- [ ] AC-2: `save('settings', { audio: 0.8 })` followed by `load<Settings>('settings')` returns `{ audio: 0.8 }`.
- [ ] AC-3: `load<UserSettings>('nonexistent')` returns `null` — does not throw.
- [ ] AC-8: `localStorage` key is always prefixed (e.g. `'overdrive_settings'`, not raw `'settings'`).
- [ ] AC-9: `save()`, `load()`, `delete()` return `Promise`.
- [ ] AC-10: `delete(key)` removes the key — subsequent `load(key)` returns `null`. In Degraded mode, `delete()` removes from the queue if pending.

---

## Implementation Notes

_Derived from ADR-0016 Implementation Guidelines:_

1. **PersistedEntry container** — Every saved value wrapped in:

   ```typescript
   interface PersistedEntry {
     version: string; // semver — current game build version (e.g. "0.1.0")
     data: unknown; // the caller's data
     timestamp: number; // Date.now() at save time
   }
   ```

   The `version` is a class-level constant (`CURRENT_VERSION`) set at Persistence construction time. On save, the current version is stamped. On load, this is compared to the stored version to decide whether migration is needed (handled by Story 005).

2. **Key prefix** — A class-level constant `PREFIX = 'overdrive_'`. Every storage key is `PREFIX + key`. The prefix is configurable via the constructor parameter but defaults to `'overdrive_'`. The prefix is applied internally — callers pass the short key (`'settings'`), never the prefixed version.

3. **`save<T>(key, data)` flow**:
   - Guard: if `state === Uninitialized` → throw `PersistenceError`
   - If `state === Degraded` → delegate to queue write (Story 004 behavior)
   - If `state === Ready` → `PersistenceEntry { version: CURRENT_VERSION, data, timestamp: Date.now() }` → `JSON.stringify` → `localStorage.setItem(PREFIX + key, json)`
   - Wrap in `Promise.resolve().then(() => ...)` for async contract
   - Wrap `JSON.stringify` + `setItem` in try/catch — on failure, transition to Degraded (calls into Story 001 state machine)

4. **`load<T>(key)` flow**:
   - Guard: if `state === Uninitialized` → throw `PersistenceError`
   - If `state === Degraded` → return `Promise.resolve(null)`
   - If `state === Ready` → `localStorage.getItem(PREFIX + key)` → if `null` return `null` → `JSON.parse` → unwrap `PersistedEntry.data` → return `data as T`
   - Wrap `JSON.parse` in try/catch — parse failure → log + return `null` (error isolation, Story 003)
   - After parsing `PersistedEntry`, if `stored.version !== CURRENT_VERSION` → run migration chain (Story 005) before returning

5. **`delete(key)` flow**:
   - Guard: if `state === Uninitialized` → throw `PersistenceError`
   - If `state === Degraded` → remove any pending write for this key from the memory queue
   - If `state === Ready` → `localStorage.removeItem(PREFIX + key)`
   - Always returns `Promise<void>`

6. **Async microtask pattern** — Every public method wraps the synchronous body in `Promise.resolve().then(() => body)`. This ensures the async contract even for synchronous localStorage operations.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 003 (error-isolation): corrupted data handling, cross-key isolation, logging
- Story 004 (degraded-mode-retry): memory queue behavior, retry()
- Story 005 (migration-chain): registerMigration, chain walk, MigrationError

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-2**: `save('settings', { audio: 0.8 })` then `load<Settings>('settings')` returns `{ audio: 0.8 }`.
  - **Given**: A `Persistence` instance initialized and in Ready state
  - **When**: `save('settings', { audio: 0.8 })` is called, then `load('settings')` is called
  - **Then**: The result is deeply equal to `{ audio: 0.8 }`
  - **Edge cases**: Data contains `null`, `undefined` fields, nested objects, arrays; data is a primitive (string, number, boolean); empty object `{}`

- **AC-3**: `load('nonexistent')` returns `null` — does not throw.
  - **Given**: A `Persistence` instance in Ready state with no prior save for key `'nonexistent'`
  - **When**: `load('nonexistent')` is called
  - **Then**: The result is `null`, and no exception is thrown
  - **Edge cases**: Load after `delete()` also returns `null`; load key that was never saved; load with empty string key

- **AC-8**: `localStorage` key is always prefixed with `'overdrive_'`.
  - **Given**: A `Persistence` instance in Ready state
  - **When**: `save('settings', {})` is called
  - **Then**: `localStorage.getItem('overdrive_settings')` returns the serialized data; `localStorage.getItem('settings')` returns `null`
  - **Edge cases**: Verify prefix for `delete()` and `load()` as well — all three methods use the same prefix

- **AC-9**: `save()`, `load()`, `delete()` return `Promise`.
  - **Given**: A `Persistence` instance in Ready state
  - **When**: Each method is called
  - **Then**: The return value is an instance of `Promise`
  - **Edge cases**: Also verify `registerMigration()` does NOT return a Promise (it is explicitly synchronous per ADR-0016)

- **AC-10**: `delete(key)` removes the key.
  - **Given**: A `Persistence` instance in Ready state and a key `'test'` with saved data
  - **When**: `delete('test')` is called, then `load('test')` is called
  - **Then**: `load('test')` returns `null`
  - **Edge cases**: Delete a nonexistent key — no error; delete in Degraded mode removes from queue; double delete is safe no-op

---

## QA Test Cases

**Test file**: `tests/integration/persistence.test.ts`

### AC-1: save + load round-trip
- `save('settings', { audio: 0.8 })`
- `load('settings')`
- Assert: returns `{ audio: 0.8 }`

### AC-2: key prefix isolation
- Verify game keys use configured prefix
- Assert: no collision with non-game localStorage entries

### AC-3: load nonexistent returns null
- `load('nonexistent')`
- Assert: returns `null`

### AC-4: delete()
- Save value, call `delete('settings')`
- Assert: `load('settings')` returns `null`

### AC-5: corrupted data
- Manually corrupt stored entry
- `load('settings')`
- Assert: returns `null`, other keys unaffected

## Test Evidence

Test evidence: `tests/unit/persistence.test.ts` — verify all acceptance criteria pass.

## Dependencies

- Depends on: Story 001 (persistence-state-machine-init)
- Unlocks: Story 003 (error-isolation), Story 004 (degraded-mode-retry), Story 005 (migration-chain)
