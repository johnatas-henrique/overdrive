# Story 001: Tech Debt Cleanup (4 CRITICALs + 5 WARNings)

> **Epic**: Tech Debt
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 25h
> **Last Updated**: 2026-06-26

## Context

PR #12 review found 4 CRITICALs and 5 WARNings across Foundation systems. This story fixes all 9 items before Core A implementation begins. Foundation systems must be robust before higher layers depend on them.

## Acceptance Criteria

- [ ] **AC-1**: `persistence.ts save()` throws `PersistenceError` on JSON.stringify failure instead of returning resolved Promise silently (C-1)
- [ ] **AC-2**: `simulation-snapshot.ts dispose()` uses try/catch around each system's serialize() — registry.clear() always runs even if individual systems throw (C-2)
- [ ] **AC-3**: `persistence.ts save()` queues serialized data to retry queue when localStorage.setItem() fails after successful serialization (C-3)
- [ ] **AC-4**: `configManager.ts register()` throws `ConfigError` on _isValidConfig failure instead of logging and leaving orphaned namespace (C-4)
- [ ] **AC-5**: Stack trace extraction in configManager.ts handles non-V8 engines and minified stacks gracefully (W-1)
- [ ] **AC-6**: process.env iteration in configManager.ts is tree-shaken in browser builds or guarded by feature detection (W-2)
- [ ] **AC-7**: `fixed-update-pipeline.ts` empty catch block replaced with error logging — slot exceptions are logged, not swallowed (W-3)
- [ ] **AC-8**: `pipeline-runtime.ts` dev guard installed in attach() not constructor (W-4)
- [ ] **AC-9**: `pipeline-runtime.ts` JSDoc corrected from static call to instance method (W-5)

## Out of Scope

- Refactoring persistence migration chain (deferred to future sprint)
- Adding new telemetry or logging infrastructure
- Changing public API signatures

## Dependencies

- None (Foundation layer, no upstream dependencies)

## ADR Governing Implementation

- ADR-0001: Event Bus Architecture (for error propagation patterns)
- ADR-0016: Persistence (for save/load semantics)
- ADR-0017: Simulation Snapshot (for dispose lifecycle)
- ADR-0023: Data Config Manager (for register semantics)

## Test Evidence

`tests/unit/tech-debt-cleanup.test.ts`

## Completion Notes

**Completed**: 2026-06-26
**Criteria**: 9/9 passing
**Deviations**: 3 advisory (LP code review suggestions — logged as tech debt)
**Test Evidence**: Logic: 39 unit tests in tests/unit/tech-debt-cleanup.test.ts
**Code Review**: Complete (APPROVED WITH SUGGESTIONS — all suggestions logged as tech debt)
