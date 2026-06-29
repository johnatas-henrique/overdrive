# Story 006: Determinism Enforcement (Dev Assertions)

> **Epic**: Determinism Contract
> **Status**: Complete
> **Last Updated**: 2026-06-25
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/determinism-contract.md`
**Requirements**: `TR-DET-004`

**ADR Governing Implementation**: ADR-0002: Fixed Timestep & Determinism Pipeline
**ADR Decision Summary**: `Date.now()` / `performance.now()` forbidden inside slot `update()` — breaks determinism. `getCurrentTick()` replaces wall clock reads. Dev-mode runtime assertions patch `Math.random`, `Date.now`, and `performance.now` with throwing wrappers during `executeTick()`. Guards are tree-shaken in production via `import.meta.env.DEV` guard.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon.js APIs — pure TypeScript guard infrastructure. Uses `import.meta.env.DEV` for build-time tree-shaking (Vite convention). Guards are install/uninstall hooks on the pipeline lifecycle.

**Control Manifest Rules (this layer)**:

- Required: F15 — `Date.now()` / `performance.now()` forbidden inside slot `update()` — breaks determinism
- Required: F37 — Cross-reference: DeterminismContract — `SeededRandom.random()` must replace `Math.random()` inside all pipeline `update()` calls
- Forbidden: F-F4 — Never import Foundation from higher layers
- Guardrail: F-G2 — Pipeline overhead < 0.001ms per tick (guard is a no-op in production)

---

## Acceptance Criteria

_From GDD `design/gdd/determinism-contract.md`, scoped to this story:_

- [ ] AC-1: With dev guard active, calling `Math.random()` inside a pipeline `executeTick()` throws `DeterminismError('Math.random forbidden during fixed update')`.
- [ ] AC-2: With dev guard active, calling `Date.now()` inside a pipeline `executeTick()` throws `DeterminismError('Date.now forbidden during fixed update')`.
- [ ] AC-3: With dev guard active, calling `performance.now()` inside a pipeline `executeTick()` throws `DeterminismError('performance.now forbidden during fixed update')`.
- [ ] AC-4: `Math.random()` called outside of `executeTick()` works normally when guards are active (guard does not leak beyond tick scope).
- [ ] AC-5: Guard installs at pipeline `start()` and uninstalls at pipeline `stop()`/`dispose()` — verified by calling `Math.random()` before start, during tick, and after stop.
- [ ] AC-6: In production mode (`import.meta.env.DEV = false`), `start()` does not install any guard — confirmed by asserting `Math.random`, `Date.now`, and `performance.now` are unchanged after `start()`. Use `vi.stubEnv('DEV', 'false')` to simulate production mode.

---

## Implementation Notes

_Derived from ADR-0002 Implementation Guidelines:_

- Guard mechanism:

  ```typescript
  class DeterminismGuard {
    private originalMathRandom: (() => number) | null = null;
    private originalDateNow: (() => number) | null = null;
    private originalPerfNow: (() => number) | null = null;
    private guardActive = false;

    install(): void {
      if (!import.meta.env.DEV) return; // production — no-op
      this.originalMathRandom = Math.random;
      this.originalDateNow = Date.now;
      this.originalPerfNow = performance.now;
      Math.random = this.createThrowFn("Math.random");
      Date.now = this.createThrowFn("Date.now") as typeof Date.now;
      performance.now = this.createThrowFn(
        "performance.now"
      ) as typeof performance.now;
      this.guardActive = true;
    }

    uninstall(): void {
      if (!this.guardActive) return;
      Math.random = this.originalMathRandom!;
      Date.now = this.originalDateNow!;
      performance.now = this.originalPerfNow!;
      this.guardActive = false;
    }

    private createThrowFn(name: string): () => number {
      return () => {
        throw new DeterminismError(`${name} forbidden during fixed update`);
      };
    }
  }
  ```

- The guard is composed into the pipeline: `start()` calls `guard.install()`, `stop()` calls `guard.uninstall()`.
- In production (`import.meta.env.DEV === false`), the `install()` method body is stripped by the bundler (tree-shaking via `import.meta.env.DEV` guard pattern), leaving a no-op or empty call.
- `DeterminismError` — custom error class in `src/foundation/determinism/errors.ts`, extends `Error`, exported alongside `PipelineError` from Story 002.
- File location: `src/foundation/determinism/dev-guard.ts` and `src/foundation/determinism/errors.ts`.
- The guard only covers `Math.random`, `Date.now`, and `performance.now`. It does NOT cover `Math.sin` or other floating-point operations that may differ between platforms (those are addressed by code review and design conventions, not runtime assertion).

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 001]: SeededRandom — the deterministic PRNG that replaces `Math.random()` during simulation
- [Story 002]: FixedUpdatePipeline — the lifecycle hooks (`start()`/`stop()`) that trigger guard install/uninstall
- Cross-platform floating-point guards (e.g. `Math.sin` near boundaries, `NaN` propagation) — these are design conventions, not runtime assertions

---

## QA Test Cases

**AC-1: Math.random guard throws**

- Given: Pipeline started with dev guard active (`import.meta.env.DEV = true`), a system registered at slot 1 that calls `Math.random()` inside `update()`
- When: `executeTick(FIXED_DT)` is called
- Then: `DeterminismError('Math.random forbidden during fixed update')` is thrown (caught by pipeline's per-slot error handling)
- Edge cases: `Math.random()` called inside a try-catch inside the slot — still caught by the guard before user code can catch it

**AC-2: Date.now guard throws**

- Given: Pipeline started with dev guard active, a system that calls `Date.now()` inside `update()`
- When: `executeTick(FIXED_DT)` is called
- Then: `DeterminismError('Date.now forbidden during fixed update')` is thrown
- Edge cases: `Date.now()` called with `.call(null)` or `.apply(null)` — still throws (replacement is a function, not a bound method)

**AC-3: performance.now guard throws**

- Given: Pipeline started with dev guard active, a system that calls `performance.now()` inside `update()`
- When: `executeTick(FIXED_DT)` is called
- Then: `DeterminismError('performance.now forbidden during fixed update')` is thrown
- Edge cases: `performance.now.bind(performance)()` — still throws (the guard replaces the function reference entirely)

**AC-4: Guard does not leak outside tick**

- Given: Pipeline started with dev guard active
- When: `Math.random()` is called outside any `executeTick()` (e.g. before start, after stop, between ticks in the render loop)
- Then: `Math.random()` returns a normal random value — no throw
- Edge cases: start → tick → stop → random outside tick → start again → tick → stop — guard lifecycle is clean across multiple start/stop cycles

**AC-5: Guard lifecycle tied to pipeline**

- Given: A pipeline in Uninitialized state
- When: `pipeline.start()` is called → guard is installed. Then `pipeline.stop()` is called → guard is uninstalled
- Then: Before start, `Math.random()` works normally. During tick (between start/stop), `Math.random()` throws. After stop, `Math.random()` works normally again
- Edge cases: `dispose()` also uninstalls guard; `stop()` called without prior `start()` — safe no-op

**AC-6: Production mode — no guard installed**

- Given: `vi.stubEnv('DEV', 'false')` to simulate production build
- When: `pipeline.start()` is called
- Then: `Math.random`, `Date.now`, and `performance.now` are unchanged (same function references as before `start()`). A slot calling `Math.random()` inside `executeTick()` does NOT throw
- Edge cases: production mode with `import.meta.env.DEV` false, then a dev guard call — no-op; env var restored after test via `vi.unstubAllEnvs()`

---

## QA Test Cases

**Test file**: `tests/unit/determinism.test.ts`

### AC-1: dev assertions fire
- Inside pipeline tick, call `Date.now()` or `Math.random()`
- Assert: dev assertion fires in `import.meta.env.DEV` mode

### AC-2: byte-identical output
- Run two `fixedUpdate()` sequences with same seed
- Assert: each registered system's `ISnapshotable.hash()` produces identical output across runs

### AC-3: production mode
- In production mode (`vi.stubEnv` or similar), call non-deterministic function
- Assert: no assertion fires (guards compiled out)

## Test Evidence

Test evidence: `tests/unit/determinism.test.ts` — verify all acceptance criteria pass.

## Dependencies

- Depends on: Story 002 (FixedUpdatePipeline — guard hooks into pipeline lifecycle)
- Unlocks: All systems that register in the pipeline (guard ensures they don't accidentally use banned APIs during simulation)

## Completion Notes

**Completed**: 2026-06-25
**Criteria**: 6/6 passing
**Deviations**: None
**Test Evidence**: Unit test at `tests/unit/determinism.test.ts` — 156/156 tests, DeterminismGuard AC-1 through AC-6 covered
**Code Review**: Complete (APPROVE — LP-CODE-REVIEW + QL-TEST-COVERAGE ADEQUATE)
**Risk Note**: Tests use `vi.resetModules()` for module re-import. This is NOT thread-safe — parallel test runners may race on module state. All determinism tests are serialized within a single file (Vitest file-level parallelism is safe; test-level parallelism within the file is not).
