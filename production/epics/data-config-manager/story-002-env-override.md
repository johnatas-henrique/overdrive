# Story 002: Environment Variable Override

> **Epic**: Data & Config Manager
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/data-config-manager.md`
**Requirements**: `TR-DCM-003`

**ADR Governing Implementation**: ADR-0023: Data & Config Manager
**ADR Decision Summary**: Leaf-level env var override via `OVERDRIVE__NS__KEY` prefix. Only leaf values (strings, numbers) overridden — objects cannot be partially replaced.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer.

**Control Manifest Rules (this layer)**:

- Required: F4 — Env override via `OVERDRIVE__NS__KEY`, applies before cached value

---

## Acceptance Criteria

_From GDD `design/gdd/data-config-manager.md`, scoped to this story:_

- [ ] `OVERDRIVE__TEAMS__MACKLEN__MOTOR=3` set as env var → `get('teams.macklen.motor')` returns `3` (env override wins over default).
- [ ] `OVERDRIVE__NONEXISTENT__KEY=5` set as env var → ignored silently (namespace does not exist), `get('teams.macklen.motor')` returns the default value.
- [ ] `OVERDRIVE__TEAMS__MACKLEN__MOTOR=3` → `get<number>()` returns the numeric value `3`, not the string `"3"`.
- [ ] `OVERDRIVE___=` (empty key segment) → `console.warn` is called and no override is applied.
- [ ] Env vars are cleaned up between tests — no test leaks `process.env.OVERDRIVE__*` into another test.

---

## Implementation Notes

_Derived from ADR-0023 Implementation Guidelines:_

- On `register()`, scan `process.env` for keys matching `OVERDRIVE__{NAMESPACE}__*`
- Parse namespace and key path from env var name: split by `__`, first segment after `OVERDRIVE` is namespace, rest is key path
- Apply override at the leaf: when building the cached config object, replace the default value with the env var value
- Numeric env var values: `String(process.env[key])` → try `Number()` parse; if it produces a valid number, store as number. Otherwise store as string.
- Empty key segments (`OVERDRIVE_______TEAMS__MOTOR`) detected when split produces empty strings — call `console.warn` and skip
- Only leaf-level values are overridden — if the config value at the path is an object, skip the override

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 003a: HMR cache invalidation (env vars still apply after cache clear)

---

## QA Test Cases

**AC-1: Env var overrides default**

- Given: `process.env.OVERDRIVE__TEAMS__MACKLEN__MOTOR = '3'`, ConfigManager initialized, `register('teams', { macklen: { motor: 250 } })` called
- When: `get<number>('teams.macklen.motor')` is called
- Then: Returns `3` (not `250`)
- After: Clean up: `delete process.env.OVERDRIVE__TEAMS__MACKLEN__MOTOR`
- Edge cases: Override with `'0'` (falsy but valid); override with negative number

**AC-2: Env var for non-existent namespace is ignored**

- Given: `process.env.OVERDRIVE__UNKNOWN__KEY = '999'`, `register('teams', { macklen: { motor: 250 } })` called
- When: `get<number>('teams.macklen.motor')` is called
- Then: Returns `250` (default, not overridden)
- Edge cases: Partial namespace match (`OVERDRIVE__TEAM` — single s, should not match `teams`)

**AC-3: Numeric env var is coerced to number**

- Given: `process.env.OVERDRIVE__TEAMS__MACKLEN__MOTOR = '3'`
- When: `get<number>('teams.macklen.motor')` is called
- Then: Returns `3` (type `number`), not `'3'` (type `string`)
- Edge cases: `OVERDRIVE__TEAMS__NAME = 'Macklen'` — non-numeric stays as string

**AC-4: Empty key segment warns**

- Given: `process.env.OVERDRIVE___ = '5'`
- Then: `console.warn` is called
- Edge cases: Multiple empty segments `OVERDRIVE_______TEAMS__MOTOR`

**AC-5: Env var cleanup between tests**

- Given: Test A sets `OVERDRIVE__TEAMS__MACKLEN__MOTOR = '3'` and cleans up
- When: Test B does not set any env var
- Then: `get('teams.macklen.motor')` returns the default `250` (no cross-test pollution)

---

## QA Test Cases

**Test file**: `tests/unit/config-manager.test.ts`

### AC-1: env var overrides default
- Set `OVERDRIVE__TEAMS__MACKLEN__MOTOR=3` env var, register default with value `1`
- Call `get('teams.macklen.motor')`
- Assert: returns `3`

### AC-2: override on nonexistent namespace
- Set env var `OVERDRIVE__NONEXISTENT__KEY=5`
- Assert: silently ignored (no error, no namespace created)

### AC-3: empty env var key
- Set `OVERDRIVE___=3`
- Assert: `console.warn` called, ignored

### AC-4: type coercion
- Set `OVERDRIVE__COUNT=3` (string), register `count` with default number `0`
- Assert: `get('count')` returns `3` (number, coerced)

### AC-5: env var cleanup
- Run test with env var set, verify after test env var is restored
- Assert: no cross-test contamination

## Test Evidence
## Dependencies

- Depends on: Story 001 (needs core register + get to be implemented)
- Unlocks: None
