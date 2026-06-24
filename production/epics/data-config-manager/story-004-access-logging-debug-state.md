# Story 004: Access Logging + Debug State

> **Epic**: Data & Config Manager
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/data-config-manager.md`
**Requirements**: `TR-DCM-005`, `TR-DCM-006`

**ADR Governing Implementation**: ADR-0023: Data & Config Manager
**ADR Decision Summary**: Every `get()` records `{ key, caller, timestamp }` in a ring buffer (500 entries). `getDebugState()` exposes all namespaces with current values.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer.

**Control Manifest Rules (this layer)**:

- Required: F6 — 500-entry access logging ring buffer for debug via Dev Tools

---

## Acceptance Criteria

_From GDD `design/gdd/data-config-manager.md`, scoped to this story:_

- [ ] After 600 calls to `get()`, the ring buffer contains exactly the last 500 entries (FIFO eviction).
- [ ] `configManager.getDebugState()` returns an object with all namespaces, current values (post-env-override), and access log — never throws.
- [ ] `getDebugState()` before any `register()` returns an empty namespaces object and an empty access log — does not throw.

---

## Implementation Notes

_Derived from ADR-0023 Implementation Guidelines:_

- Ring buffer: fixed-size array (500). Append at end; when full, shift first element out before push
- Each entry: `{ key: string, caller: string, timestamp: number }` — `caller` is from `new Error().stack` parse or a module-level label
- `getDebugState()` returns `{ namespaces: Record<string, object>, accessLog: AccessEntry[], envOverrides: string[] }`
- In production (or when `logAllAccess` is `false`), only errors and invalid-key lookups are retained — happy-path `get()` calls are not logged
- The `getDebugState()` method is a read-only snapshot — the overlay (Dev Tools) reads, never writes
- Timestamps: `Date.now()` (acceptable here — not inside the fixed pipeline update)

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Dev Tools overlay rendering (separate epic)

---

## QA Test Cases

**AC-1: Ring buffer FIFO eviction**

- Given: ConfigManager initialized with registered namespace
- When: `get()` is called 600 times on a valid key
- Then: `getDebugState().accessLog.length` is exactly 500
- Edge cases: 0 calls → empty log; 500 calls exactly → buffer full; 501 calls → first entry evicted

**AC-2: getDebugState() returns full structure**

- Given: ConfigManager with at least one registered namespace and one `get()` call
- When: `getDebugState()` is called
- Then: Returns object with `namespaces`, `currentValues`, `accessLog` properties — never throws
- Edge cases: After namespace invalidation (values still visible? yes — from re-read)

**AC-3: getDebugState() before any register**

- Given: ConfigManager initialized, zero `register()` calls made
- When: `getDebugState()` is called
- Then: Returns `{ namespaces: {}, accessLog: [] }` — does not throw
- Edge cases: State after all namespaces disposed (if dispose exists)

---

## QA Test Cases

**Test file**: `tests/unit/config-manager.test.ts`

### AC-1: getDebugState() returns registered namespaces
- Register `teams` namespace with values
- Call `getDebugState()`
- Assert: returned object contains `teams` with correct values

### AC-2: access log records get() calls
- Call `get('teams.macklen.motor')` multiple times
- Assert: access log contains each call with timestamp and key

### AC-3: debug state reflects env overrides
- Set env var, register namespace
- Assert: `getDebugState()` shows overridden value

### AC-4: getDebugState() before any register
- Call `getDebugState()` on initialized but empty ConfigManager
- Assert: returns empty state (no crash)

## Test Evidence

Test evidence: `tests/unit/config-manager.test.ts` — verify all acceptance criteria pass.

## Dependencies

- Depends on: Story 001 (needs core register + get)
- Unlocks: Dev Tools epic reads `getDebugState()` for overlay
