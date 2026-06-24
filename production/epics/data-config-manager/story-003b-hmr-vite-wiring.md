# Story 003b: HMR Vite Wiring

> **Epic**: Data & Config Manager
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 2h

## Context

**GDD**: `design/gdd/data-config-manager.md`
**Requirements**: `TR-DCM-004`

**ADR Governing Implementation**: ADR-0023: Data & Config Manager
**ADR Decision Summary**: Per-namespace cache invalidation on Vite HMR. The wiring connects `import.meta.hot.accept()` to `invalidateNamespace()`.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript Foundation layer. Vite `import.meta.hot` is the only external integration point.

**Control Manifest Rules (this layer)**:

- Required: F5 — HMR invalidation per namespace, Vite HMR triggers per-namespace cache flush

---

## Acceptance Criteria

- [ ] When a config module at `src/config/teams.ts` is edited and saved, Vite HMR triggers `invalidateNamespace('teams')` with the correct namespace name derived from the file path.

---

## Implementation Notes

_Derived from ADR-0023 Implementation Guidelines:_

- Each config module calls `import.meta.hot.accept()` in its module scope (only in dev builds — tree-shaken in production via `if (import.meta.hot)` guard)
- The callback calls `configManager.invalidateNamespace(namespace)` where namespace matches the module name (e.g. `'teams'` for `src/config/teams.ts`)
- In production build, the `import.meta.hot` block is dead-code eliminated by Vite — zero bytes in the bundle
- Test via mock `import.meta.hot`: verify that `accept()` is called and the callback invokes `invalidateNamespace` with the correct namespace

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 003a: The `invalidateNamespace()` method itself (this story just wires it)

---

## QA Test Cases

**AC-1: HMR triggers invalidateNamespace**

- Given: `import.meta.hot` is available (dev mode), config module `src/config/teams.ts` loads
- When: Module executes and calls `import.meta.hot.accept(callback)`
- Verify: The `accept()` call's callback calls `configManager.invalidateNamespace('teams')`
- Edge cases: Module name does not match a registered namespace; multiple config modules hot-reloaded simultaneously

---

## QA Test Cases

**Test file**: `tests/integration/config-manager.test.ts`

### AC-1: HMR payload triggers invalidation
- Simulate Vite HMR payload for config namespace
- Assert: `invalidateNamespace()` called with correct namespace

### AC-2: invalid HMR payload
- Simulate HMR payload with invalid format
- Assert: ConfigManager logs error, preserves stale cache

### AC-3: HMR error handling
- Simulate HMR with exception in payload processing
- Assert: game does not crash, error logged

## Test Evidence

Test evidence: `tests/unit/config-manager.test.ts` — verify all acceptance criteria pass.

## Dependencies

- Depends on: Story 003a (needs `invalidateNamespace()` to exist)
- Unlocks: None
