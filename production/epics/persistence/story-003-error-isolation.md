# Story 003: Error Isolation

> **Epic**: Persistence Interface
> **Status**: Complete
> **Last Updated**: 2026-06-25
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 2h

## Context

**GDD**: `design/gdd/persistence.md`
**Requirement**: `TR-PER-005`

> Error isolation — corrupted/unparseable save for one key returns null (logged), other keys unaffected.

**ADR Governing Implementation**: ADR-0016: Persistence Interface
**ADR Decision Summary**: Per-key error isolation. A corrupted or unparseable save for one key is logged and returned as `null` — other keys load normally. `save()` also wraps serialization in try/catch.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript. Uses native `JSON.parse`/`JSON.stringify` + `localStorage`.

**Control Manifest Rules (this layer)**:

- Required: F30 — Persistence: error isolation — corrupted key never breaks other keys

---

## Acceptance Criteria

_From GDD `design/gdd/persistence.md`, scoped to this story:_

- [ ] AC-4: Corrupted data in storage — `load()` returns `null`, other keys unaffected.

---

## Implementation Notes

_Derived from ADR-0016 Implementation Guidelines:_

1. **Parse error handling in `load()`** — Wrap `JSON.parse` in a try/catch block:

   ```typescript
   try {
     const parsed = JSON.parse(raw);
     // unwrap PersistedEntry...
   } catch {
     console.warn(
       `[Persistence] Corrupted entry for key "${key}" (${raw.length} bytes)`
     );
     return null;
   }
   ```

2. **Per-key independence** — Each `load()` call operates independently on its own `getItem`→`JSON.parse` sequence. A corrupted key A never interrupts or contaminates a subsequent `load(keyB)` call.

3. **Save error handling** — Wrap `JSON.stringify` + `localStorage.setItem` in a try/catch:
   - `JSON.stringify` failure (circular reference, BigInt, etc.) → caught, logged, not thrown to caller. The data is not saved.
   - `localStorage.setItem` failure (QuotaExceededError) → transition state to Degraded (calls into Story 001's state machine). The caller's Promise resolves — save fails silently in Degraded.

4. **Edge: unexpected root type** — If someone manually writes a non-JSON value to localStorage (e.g. a plain number `42` or a raw string), `JSON.parse` will likely fail → treated as corrupted. If the value happens to parse but isn't a `PersistedEntry` (missing `version` or `data` fields), it still returns `null` with a warning. This is the corruption path.

5. **Edge: empty string stored** — `localStorage.getItem` returns `""` for an empty stored value. `JSON.parse("")` throws `SyntaxError` → caught → `null` returned. This is expected corrupted behavior.

6. **Logging** — All corruption warnings go through `console.warn` with the key name and raw data length. In production builds, this is a minimal cost — persistence errors are rare and the log entry helps debugging.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 002 (save-load-key-prefix): save/load round-trip, key prefix, PersistedEntry format
- Story 001 (persistence-state-machine-init): state machine transitions on storage failure
- Story 004 (degraded-mode-retry): retry() after storage recovers

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-4**: Corrupted data in storage — `load()` returns `null`, other keys unaffected.
  - **Given**: localStorage has `overdrive_corrupt = "not-json!!!"` and `overdrive_valid = '{"version":"0.1.0","data":{"x":1},"timestamp":100}'` (via pre-seed)
  - **When**: `load('corrupt')` is called, then `load('valid')` is called
  - **Then**: `load('corrupt')` returns `null`; `load('valid')` returns `{ x: 1 }`
  - **Edge cases**: Malformed JSON (truncated `{"ver`); missing `PersistedEntry` fields (`{"a":1}` — parses but not a valid entry); empty string value in localStorage; non-string value (number stored directly); values with unexpected types at root; values with extra fields beyond PersistedEntry

---

## QA Test Cases

**Test file**: `tests/integration/persistence.test.ts`

### AC-1: corrupted entry isolated
- Save two keys, corrupt one in localStorage
- `load` corrupted key: returns `null`, error logged (key + size)
- `load` other key: returns correct value

### AC-2: non-existent storage
- `load('nonexistent')`
- Assert: returns `null`

### AC-3: error logging
- Corrupted entry
- Assert: error log contains key name and size of corrupted data

## Test Evidence

Test evidence: `tests/unit/persistence.test.ts` — verify all acceptance criteria pass.

## Dependencies

- Depends on: Story 002 (save-load-key-prefix)
- Unlocks: None

## Completion Notes

**Completed**: 2026-06-25
**Criteria**: 1/1 passing
**Deviations**: None
**Test Evidence**: Unit test at `tests/unit/persistence.test.ts` — AC-4 with 10+ edge cases. Stale reference to `tests/integration/persistence.test.ts` in story QA section (line 94).
**Code Review**: Complete (APPROVE — LP-CODE-REVIEW + QL-TEST-COVERAGE ADEQUATE)
