# Story 006: Production No-op Behavior

> **Epic**: Telemetry Recorder
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h
> **Last Updated**: 2026-06-26

## Context

**GDD**: `design/gdd/telemetry-recorder.md`
**Requirement**: `TR-TELEMETRY-006`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0022: Telemetry Recorder
**ADR Decision Summary**: All code guarded by `if (import.meta.env.DEV)`. Zero bytes in production build. No static imports from production code — Dev Infra loads via dynamic `import()`.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: None — pure TypeScript, zero Babylon.js imports. `import.meta.env.DEV` is Vite's built-in environment variable.

**Control Manifest Rules (this layer)**:

- Required: D-F4 (never statically import Dev Infra from production code), D-G1 (zero bytes in prod)
- Forbidden: D-F4 (static import from production code)
- Guardrail: D-G1 (zero bytes in production build)

---

## Acceptance Criteria

_From GDD `design/gdd/telemetry-recorder.md`, scoped to this story:_

- [ ] **AC-1**: When `import.meta.env.DEV` is false, `tick()` returns immediately without allocating memory, appending to arrays, or calling `console.log`
- [ ] **AC-2**: When `import.meta.env.DEV` is false, `window.__telemetry.export()` returns `null` (no-op guard)
- [ ] **AC-3**: When `import.meta.env.DEV` is false, `console.log` is never called by any TelemetryRecorder method
- [ ] **AC-4**: No static import of Telemetry Recorder module exists in production code paths — all Dev Infra loading is dynamic via `import()` behind `if (import.meta.env.DEV)`

---

## Implementation Notes

_Derived from ADR-0022 Implementation Guidelines:_

**Guard pattern — all public methods:**

```typescript
export class TelemetryRecorder {
  tick(dt: number, cars: CarEntity[], tickCount: number): void {
    if (!import.meta.env.DEV) return; // FIRST LINE — before any work
    // ... implementation
  }

  export(): string | null {
    if (!import.meta.env.DEV) return null;
    // ... implementation
  }
}
```

**`import.meta.env.DEV` resolution:** Vite's built-in environment variable (resolved at compile time). The build system tree-shakes all guarded code when `import.meta.env.DEV` evaluates to `false`.

**No static imports from production code:**

- `import { TelemetryRecorder } from './dev-infra/telemetry'` — FORBIDDEN in production code
- Correct pattern from the Dev Tools / initialization code:
  ```typescript
  if (import.meta.env.DEV) {
    const { TelemetryRecorder } = await import("./dev-infra/telemetry");
    // use it
  }
  ```

**Cross-cutting concern:** This story validates the guard pattern EXISTS in all story files (001–005). It's the final quality gate for the guard pattern, not a rewrite of every method.

---

## Out of Scope

_Handled by separate tasks:_

- **Bundle analysis**: Verifying zero bytes in production build is an Epic DoD task (CI/bundle check), not a unit test. Run after all stories are implemented.
- Story 002, 003, 004, 005 each have their own `import.meta.env.DEV` guards — Story 006 validates they exist.

---

## QA Test Cases

- **AC-1**: tick() returns immediately when **DEV** = false
  - Given: `import.meta.env.DEV = false` (mocked), Recorder with tickCounter at 290 (near log interval)
  - When: `tick()` is called with valid car data
  - Then: Returns without allocating, without appending, without console.log
  - And: tickCounter is NOT incremented

- **AC-2**: export() returns null when **DEV** = false
  - Given: `import.meta.env.DEV = false`
  - When: `export()` is called
  - Then: Returns `null`

- **AC-3**: console.log never called when **DEV** = false
  - Given: `import.meta.env.DEV = false`, Recorder with samples that would trigger a log
  - When: Tick reaches a log boundary
  - Then: `console.log` spy records 0 calls
  - Edge cases: Multiple log boundary ticks

- **AC-4**: No static imports from production [DEFERRED — build verification]
  - Given: Production bundle output
  - When: Bundle is scanned for `telemetry-recorder` imports
  - Then: No telemetry-recorder code present in the bundle
  - _Note: This is a build-level check (CI step / smoke check), not a unit test._

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:

- Logic: `tests/unit/dev-infra/telemetry-noop.test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (guards in data model), Story 002 (guards in sampling), Story 003 (guards in console), Story 004 (guards in export), Story 005 (guards in lifecycle)
- Unlocks: Bundle verification CI task (Epic DoD line item)

## Completion Notes

**Completed**: 2026-06-26
**Criteria**: 3/3 passing (AC-4 deferred to build verification)
**Deviations**: None
**Test Evidence**: Logic: tests/unit/dev-infra/telemetry-noop.test.ts (10 tests)
**Code Review**: Complete — APPROVED WITH SUGGESTIONS fixed (babylonjs-specialist, qa-tester ADEQUATE)
