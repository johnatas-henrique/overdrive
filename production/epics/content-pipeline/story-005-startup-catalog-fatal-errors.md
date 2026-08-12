# Story 005: Startup, Catalog & Fatal Errors

> **Epic**: Content Pipeline
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: M (4-5h)

## Context

**GDD**: `design/gdd/content-pipeline.md`
**Requirement**: `TR-content-004`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0003: Content Pipeline and Addressables
**ADR Decision Summary**: Catalog init failure: retry once; if retry fails, app closes. Shared group failure at startup: fatal — app cannot start. Track failure: `ContentLoadError(ErrorType.Track)`, return to Idle, no crash. Error classification: `ContentErrorType = {Track, Shared, Catalog}` — Car is never abortive. Content finishes cleanup BEFORE invoking OnContentLoadError (Kernel transitions Loading → Idle at :251-259).

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS) | **Risk**: MEDIUM

**Engine Notes**: None beyond ADR-0003 error contracts.

**Control Manifest Rules (Foundation layer)**:
- Required: `ContentErrorType` = {Track, Shared, Catalog}; Car is never abortive — source: ADR-0003
- Required: Catalog init failure: retry once; if retry fails, app closes — source: ADR-0003
- Required: Memory pressure > 95% during loading: abort, release partial handles, emit ContentLoadError — source: ADR-0003 (memory abort mechanics in Story 003; cleanup in Story 004)

---

## Acceptance Criteria

*From GDD `design/gdd/content-pipeline.md`, scoped to this story (focused: startup, catalog, fatal errors — duplicates removed per gate F9):*

- [ ] **AC-EC1**: Given catalog init fails on startup, When detected, Then retry once. If retry fails, app closes.
- [ ] **AC-EC3**: Given track bundle fails to load, When detected, Then race load aborted, player returns to menu with error.
- [ ] **AC-EC10**: Given Shared group fails on startup, When detected, Then app cannot start, error shown, app closes.
- [ ] **Startup success** (gate F8): Given app starts, When catalog initializes and Shared group loads, Then Content Pipeline reaches Idle with Shared retained (AC-SM1 precondition).
- [ ] **Error classification**: Given an abortive failure, When Content detects it, Then it emits `ContentLoadError(reason, ContentErrorType)` with the correct type (Track/Shared/Catalog) AFTER finishing cleanup of partial handles.
- [ ] **AC-EC7** (platform integration): Given WebGL tab backgrounded during load, When browser throttles, Then loading pauses and resumes on foreground with no corruption.

---

## Implementation Notes

*Derived from ADR-0003 Implementation Guidelines:*

- **Catalog init** (ADR-0003:55): retry once; if retry fails, app closes. Success path: catalog ready → load Shared group → CP_Idle with Shared retained (gate F8).
- **Shared fatal** (ADR-0003:57, GDD:202): Shared group failure at startup = fatal — app cannot start, error shown, close.
- **Track fatal** (ADR-0003:56, GDD:195): track failure = abort — ContentLoadError(ErrorType.Track), return to Idle, no crash. NOT fatal to the app.
- **Cleanup-before-error** (gate F9, Kernel :251-259): Content must finish cleanup of partial handles BEFORE invoking OnContentLoadError — the Kernel transitions Loading → Idle directly on error. (Cleanup mechanics in Story 004; ordering contract here.)
- **WebGL pause/resume** (GDD:199, AC-EC7): injectable focus/lifecycle seam (Application.focusChanged adapter) — loading pauses on background, resumes from where it stopped on foreground, no corruption. Platform integration test (gate F9).
- **Removed duplicates** (gate F9): memory abort → Story 003; partial release → Story 004; VFX failure → Story 006; Cancel/Back blocking → UI Menu/Input (Story 006 cross-ref); duplicate Start → Kernel (:207-218) — Content stays idempotent while busy.

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- [Story 003]: Memory-pressure detection + abort (this story handles the fatal classification + startup)
- [Story 004]: Partial-handle cleanup mechanics
- [Story 006]: Cancel/Back blocking (UI Menu), VFX fallback
- Duplicate Start rejection → Simulation Kernel (already rejects at :207-218)

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate). The developer implements against these — do not invent new test cases during implementation.*

- **AC-EC1**: Given catalog init fails; When detected; Then retry once; if retry fails, app closes. Edge: retry succeeds → proceeds.
- **AC-EC3**: Given track bundle fails; When detected; Then race load aborted, player returns to menu with error. Edge: no crash.
- **AC-EC10**: Given Shared group fails at startup; When detected; Then app cannot start, error shown, app closes. Edge: Shared success → Idle with Shared retained.
- **Startup success**: Given app starts; When catalog + Shared load; Then CP_Idle with Shared retained. Edge: catalog retry then success.
- **Error classification**: Given abortive failure; When detected; Then ContentLoadError(reason, type) correct type emitted AFTER cleanup. Edge: cleanup-before-error ordering violated fails.
- **AC-EC7**: Given WebGL backgrounded during load; When throttled; Then loading pauses; on foreground resumes from where it stopped, no corruption. Edge: repeated background/foreground.

---

## Test Evidence

**Story Type**: Logic
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/content/StartupErrorTests.cs` — catalog retry, Shared fatal, error classification — must exist and pass
- Platform integration: WebGL pause/resume via injectable focus seam (part of the same file or `Assets/tests/integration/content/StartupErrorIntegrationTests.cs`)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002 (CP_ state machine — Idle entry) — DONE; Story 004 (cleanup mechanics) — DONE
- Unlocks: None directly
