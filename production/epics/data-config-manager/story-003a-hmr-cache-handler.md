# Story 003a: HMR Cache Handler (invalidateNamespace)

> **Epic**: Data & Config Manager
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/data-config-manager.md`
**Requirements**: `TR-DCM-004`

**ADR Governing Implementation**: ADR-0023: Data & Config Manager
**ADR Decision Summary**: Per-namespace cache invalidation on Vite HMR. Namespace fully replaced on reload (no deep merge). HMR failure preserves stale cache.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer.

**Control Manifest Rules (this layer)**:

- Required: F5 — HMR invalidation per namespace, Vite HMR triggers per-namespace cache flush

---

## Acceptance Criteria

- [ ] `invalidateNamespace('teams')` called → next `get('teams.macklen.motor')` returns the updated registered value, not the pre-invalidation stale value.
- [ ] `invalidateNamespace('teams')` called → env var overrides still apply after cache clear (env vars are not lost on invalidation).
- [ ] `invalidateNamespace('nonexistent')` called → no error thrown (invalidation of unregistered namespace is a no-op).
- [ ] HMR with invalid payload (module exports do not match expected shape) → `console.error` is called, stale cache is preserved.

---

## Implementation Notes

_Derived from ADR-0023 Implementation Guidelines:_

- `invalidateNamespace(ns: string): void` clears the cached value for the given namespace from the internal cache map
- On next `get()`, the config is re-read from the registered config object (with env overrides still applied)
- Invalidating an unregistered namespace: no-op, no error
- HMR invalid payload: catch error from the hot-reloaded module, log via `console.error`, do not clear cache
- No deep diff — the entire namespace cache is replaced, not merged per-key

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 003b: Wiring the handler to `import.meta.hot.accept()` (Vite-specific)

---

## QA Test Cases

**AC-1: Cache cleared after invalidation**

- Given: ConfigManager initialized, `register('teams', { macklen: { motor: 250 } })` called, `get('teams.macklen.motor')` returns `250`
- When: `invalidateNamespace('teams')` is called, then the registered config is updated to `{ macklen: { motor: 300 } }`, then `get('teams.macklen.motor')` is called
- Then: Returns `300` (not `250`)
- Edge cases: Invalidation before any `get()` on a fresh registration

**AC-2: Env vars survive invalidation**

- Given: `process.env.OVERDRIVE__TEAMS__MACKLEN__MOTOR = '999'`, `register('teams', { macklen: { motor: 250 } })` called
- When: `invalidateNamespace('teams')` is called, then `get('teams.macklen.motor')`
- Then: Returns `999` (env override still applied)
- Edge cases: Env var changed between invalidation and next get

**AC-3: Invalidation of unregistered namespace is no-op**

- Given: ConfigManager initialized with one registered namespace
- When: `invalidateNamespace('does-not-exist')` is called
- Then: No error thrown
- Edge cases: Called with empty string `invalidateNamespace('')`

**AC-4: Invalid HMR payload preserves stale cache**

- Given: ConfigManager initialized with registered namespace, cache populated via `get()`
- When: Simulated HMR provides invalid config (null, wrong type), `console.error` is spied
- Then: `console.error` is called, next `get()` returns the original stale value (not corrupted)
- Edge cases: Invalid payload that throws during `JSON.parse` or similar

---

## QA Test Cases

**Test file**: `tests/unit/config-manager.test.ts`

### AC-1: invalidateNamespace clears cache
- Register namespace, get a value (cached)
- Call `invalidateNamespace('teams')`
- Assert: next `get('teams...')` re-fetches from source

### AC-2: other namespaces unaffected
- Register `teams` and `settings` namespaces
- Invalidate `teams`
- Assert: `get('settings...')` still returns cached value

### AC-3: invalidate nonexistent namespace
- Call `invalidateNamespace('nonexistent')`
- Assert: no error, no side effects

## Test Evidence

Test evidence: `tests/unit/config-manager.test.ts` — verify all acceptance criteria pass.

## Dependencies

- Depends on: Story 001 (needs core register + get)
- Unlocks: Story 003b (Vite wiring uses invalidateNamespace)
