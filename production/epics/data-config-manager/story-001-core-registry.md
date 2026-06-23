# Story 001: Core Register + Get + Error Handling

> **Epic**: Data & Config Manager
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/data-config-manager.md`
**Requirements**: `TR-DCM-001`, `TR-DCM-002`, `TR-DCM-007`

**ADR Governing Implementation**: ADR-0023: Data & Config Manager
**ADR Decision Summary**: Manual per-system register(), get\<T\>(key) throws ConfigError, env override OVERDRIVE\_\_ prefix, HMR namespace invalidation.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer.

**Control Manifest Rules (this layer)**:

- Required: F1 — ConfigManager init Phase 0, first Foundation system
- Required: F2 — get\<T\>(key) throws ConfigError, never returns undefined
- Required: F3 — register(namespace, config) during init, uniqueness enforced

---

## Acceptance Criteria

_From GDD `design/gdd/data-config-manager.md`, scoped to this story:_

- [ ] `ConfigManager.init()` executes before any dependent system init — zero runtime failures from uninitialized config.
- [ ] `register('teams', {...})` followed by `get('teams.macklen.motor')` returns the correct value from default config.
- [ ] `get('nonexistent.key')` throws `ConfigError('Key not found: nonexistent.key')` — never returns `undefined` or `null`.
- [ ] `register('teams', ...)` called a second time → `ConfigError('Namespace already registered: teams')`.
- [ ] `get()` before `init()` throws `ConfigError('ConfigManager not initialized')`.
- [ ] `get()` after `init()` but before any namespace is registered throws `ConfigError` with init ordering hint text.

---

## Implementation Notes

_Derived from ADR-0023 Implementation Guidelines:_

- `get<T>(key)` does `key.split('.').reduce()` on the stored config object — single traversal, ~0.0001ms
- `register(namespace, config)` stores in `Map<string, object>`. Throws if namespace key already exists in the map.
- `init()` sets an internal `_initialized` flag. Without it, `get()` and `register()` throw.
- Error messages include the exact key that was not found: `ConfigError('Key not found: ' + key)`
- Init ordering hint: when `get()` targets a namespace not yet registered, message includes `'Possible init ordering issue — namespace not yet registered: ' + namespace`

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 002: Environment variable override logic
- Story 003a: HMR cache invalidation handler
- Story 004: Access logging ring buffer + debug state

---

## QA Test Cases

**AC-1: Init executes before dependent systems**

- Given: A new ConfigManager instance
- When: `init()` is called
- Then: Internal `_initialized` flag is set to `true`
- Edge cases: `init()` called twice — must be idempotent

**AC-2: register + get returns correct value**

- Given: ConfigManager initialized, `register('teams', { macklen: { motor: 250 } })` called
- When: `get<number>('teams.macklen.motor')` is called
- Then: Returns `250`
- Edge cases: Key path with 4+ levels; key pointing to an object not a leaf

**AC-3: get() for nonexistent key throws**

- Given: ConfigManager initialized with a registered namespace
- When: `get('nonexistent.key')` is called
- Then: Throws `ConfigError` with message `'Key not found: nonexistent.key'`
- Edge cases: Empty string key `get('')`; dot-only key `get('...')`

**AC-4: Duplicate register throws**

- Given: ConfigManager initialized, `register('teams', {...})` called once
- When: `register('teams', {...})` is called again
- Then: Throws `ConfigError` with message `'Namespace already registered: teams'`
- Edge cases: Same namespace, different casing (`'Teams'` vs `'teams'`)

**AC-5: get() before init() throws**

- Given: A new ConfigManager instance (not initialized)
- When: `get('anything')` is called
- Then: Throws `ConfigError('ConfigManager not initialized')`

**AC-6: get() after init but before register throws with hint**

- Given: ConfigManager initialized but no namespace registered yet
- When: `get('teams.macklen.motor')` is called
- Then: Throws `ConfigError` with message containing `'Possible init ordering issue'`

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/config-manager.test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None (Foundation root)
- Unlocks: Stories 002, 003a, 004 (all depend on core registry)
