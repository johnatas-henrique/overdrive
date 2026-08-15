# Story 005: Startup, Catalog & Fatal Errors

> **Epic**: Content Pipeline
> **Status**: Complete
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

**Engine**: Unity 6000.3.22f1 (Unity 6.3 LTS) | **Risk**: MEDIUM

**Engine Notes**: None beyond ADR-0003 error contracts.

**Control Manifest Rules (Foundation layer)**:
- Required: `ContentErrorType` = {Track, Shared, Catalog}; Car is never abortive — source: ADR-0003
- Required: Catalog init failure: retry once; if retry fails, app closes — source: ADR-0003
- Required: Memory pressure > 95% during loading: abort, release partial handles, emit ContentLoadError — source: ADR-0003 (memory abort mechanics in Story 003; cleanup in Story 004)

---

## Acceptance Criteria

*From GDD `design/gdd/content-pipeline.md`, scoped to this story (focused: startup, catalog, fatal errors — duplicates removed per gate F9):*

- [ ] **AC-EC1**: Given catalog init fails on startup, When detected, Then retry once (max 2 initializer calls). If retry fails, `Fatal(reason, ContentErrorType.Catalog)` → app closes. Edge: retry succeeds → exactly one Shared load proceeds.
- [ ] **AC-EC10**: Given Shared group fails on startup, When detected, Then app cannot start, error shown, app closes — `Fatal(reason, ContentErrorType.Shared)`, NOT `Fatal(Catalog)`. Edge: Shared success → startup complete, Shared retained.
- [ ] **Startup success** (gate F8): Given app starts, When catalog initializes and Shared group loads, Then the startup completes with Shared retained (CP_Idle precondition satisfied) and the composition root exposes the ready state.
- [ ] **Error classification**: Given a startup failure, When the orchestrator detects it, Then it classifies correctly: catalog init failure (after retry) → `Fatal(reason, ContentErrorType.Catalog)`; Shared load failure → `Fatal(reason, ContentErrorType.Shared)`; neither emits `ContentLoadError` (startup exception — no race loading at startup; GDD:193/:202 more specific than ADR:51 for the startup path).
- [ ] **Fatal exactly-once**: Given a fatal startup error, When `Fatal` is invoked, Then it fires exactly once (idempotent — a duplicate Fatal from a late callback is ignored; the orchestrator is terminal after StartupComplete or Fatal).
- [ ] **AC-EC7** (platform integration, STARTUP scope): Given the startup flow is in progress and the app loses focus (WebGL tab backgrounded), When `IFocusSeam` reports unfocused, Then the orchestrator defers stage advancement — an async stage already in flight continues but its completion is buffered until re-focus; on foreground it resumes from where it stopped with no corruption (handles never released or re-entered mid-flight). Race-load focus handling is out of scope (Story 003 follow-up).

---

## Completion Notes

**Completed**: 2026-08-15
**Criteria**: 6/6 passing (0 deferred)
**Deviations**: None blocking — 2 authorized ADR-consistent decisions (startup-mode overload on composition root with race-only ctor preserved; SharedBootstrap sentinel address), documented in Implementation Contract
**Test Evidence**: Logic — 21 unit (`StartupErrorTests.cs`, ContentUnitTests) + 6 integration (`StartupErrorIntegrationTests.cs`, ContentIntegrationTests) = 27 tests; 938/938 PlayMode + 43/43 EditMode green
**Code Review**: Complete (unity-specialist APPROVED R1; qa-tester TESTABLE R4 — 3 production bugs fixed: forwarder closure NRE, IsFocused initial sample, buffer-overwrite guard)
**Gates**: LP-CODE-REVIEW APPROVED · QL-TEST-COVERAGE ADEQUATE
**Known limitation**: Shared adapter handle retention is runtime-smoke-verified only (requires real Addressables; same class as TD-034) — engine-free retainer contract covered by fakes

## Implementation Notes

*Derived from ADR-0003 Implementation Guidelines:*

- **Catalog init** (ADR-0003:55): retry once; if retry fails, app closes. Success path: catalog ready → load Shared group → CP_Idle with Shared retained (gate F8).
- **Shared fatal** (ADR-0003:57, GDD:202): Shared group failure at startup = fatal — app cannot start, error shown, close.
- **Track fatal** (ADR-0003:56, GDD:195): track failure = abort — ContentLoadError(ErrorType.Track), return to Idle, no crash. NOT fatal to the app.
- **Cleanup-before-error** (gate F9, Kernel :251-259): Content must finish cleanup of partial handles BEFORE invoking OnContentLoadError — the Kernel transitions Loading → Idle directly on error. (Cleanup mechanics in Story 004; ordering contract here.)
- **WebGL pause/resume** (GDD:199, AC-EC7): injectable focus/lifecycle seam (Application.focusChanged adapter) — loading pauses on background, resumes from where it stopped on foreground, no corruption. Platform integration test (gate F9).
- **Performance disposition**: startup is one-shot (transition frequency) — catalog init is ~50 KB (ADR-0003:212) and Shared loads once at startup (ADR-0003:257, target within 2s). No per-frame work; the Shared retain is a single handle held for the app lifetime. Retry adds one bounded re-init — no unbounded retry loop.
- **Removed duplicates** (gate F9): memory abort → Story 003; partial release → Story 004; VFX failure → Story 006; Cancel/Back blocking → UI Menu/Input (Story 006 cross-ref); duplicate Start → Kernel (:207-218) — Content stays idempotent while busy.

---

## Implementation Contract (startup flow — engine-free ports)

The SM (Story 002) assumes Shared retained in CP_Idle (AC-SM1 precondition) and has NO startup states — the race flow starts at LoadingTrack. This story introduces a **startup orchestrator OUTSIDE the SM** (same engine-free assembly `Overdrive.Content`):

- **`StartupOrchestrator`** (new, engine-free) — owns the app-startup sequence per GDD:65-67: initialize catalog → load Shared → report ready. NOT part of `ContentStateMachine` (Idle is its entry state; the startup precedes any race request).
- **`ICatalogInitializer`** (new port, `ContentSeams.cs`) — `void Initialize(Action<CatalogInitResult> onComplete)` (async callback, matching the project's `IAddressableLoader` pattern; NOT `WaitForCompletion` — single-threaded WebGL). `CatalogInitResult` (new engine-free struct): `bool Success; string ErrorReason;`. Adapter Unity: `Addressables.InitializeAsync`. On failure the orchestrator retries ONCE (bounded — max 2 initializer calls); second failure → `Fatal(reason, ContentErrorType.Catalog)` — `ContentErrorType.Catalog` is emitted for the first time (the enum exists in the Kernel at SimulationContracts.cs:64 but no path emits it yet).
- **`ISharedLoader`** (new port) — `void LoadShared(Action<SharedLoadResult> onComplete)`. `SharedLoadResult` (new engine-free struct): `bool Success; string ErrorReason;`. The Unity adapter loads the Shared group and RETAINS the handle internally (Shared persists for the app lifetime per GDD:54); failure → `Fatal(reason, ContentErrorType.Shared)` per GDD:202 (fatal, app cannot start). Success → startup complete, Shared retained.
- **`IFatalErrorHandler`** (new port) — engine-free `void Fatal(string reason, ContentErrorType type)`; **exactly-once/idempotent** (a second invocation from a late callback is ignored — the orchestrator is terminal after StartupComplete or Fatal). The Unity adapter shows the error and calls `Application.Quit` (GDD:193/:202 "show error and close") — the quit call lives in the ADAPTER (engine-free core only records the fatal); tests never call Application.Quit. The kernel SM is NOT involved — fatal startup errors never transition simulation state.
- **`IFocusSeam`** (new port, AC-EC7, STARTUP scope) — engine-free `bool IsFocused { get; }` + `event Action<bool> FocusChanged`; the orchestrator subscribes in its constructor (lifetime = session, no disposal contract). Unity adapter: `Application.focusChanged`. **Pause/resume contract**: while unfocused the orchestrator DEFERS stage advancement — an async stage already in flight continues (Addressables handles are never cancelled mid-flight), but its completion callback result is BUFFERED (the orchestrator stores the result and does not advance) until `FocusChanged(true)`; on foreground it processes the buffer and resumes from the deferred point. No corruption: handles are never released or re-entered while unfocused. Race-load focus handling is OUT OF SCOPE (Story 003 follow-up — the RaceLoadOrchestrator has no focus concept).
- **Startup gating / handoff**: the composition root runs startup as a SEPARATE STAGE before constructing the race components. `ContentCompositionRoot` (Story 003 file, cross-story authorized) KEEPS the existing race-only constructor unchanged (3-10/3-11 integration tests unaffected — SM constructed immediately with `isSharedLoaded: true`) and ADDS a **startup-mode overload** taking the 4 startup seams (`ICatalogInitializer`, `ISharedLoader`, `IFatalErrorHandler`, `IFocusSeam`). In startup mode: the SM is NOT constructed in the constructor; `RunStartup()` runs the orchestrator; on `StartupComplete` the SM is constructed with `ContentResourceState(isSharedLoaded: true, empty)` + race components + proxy bindings; the PUBLIC `StartupComplete` event fires only AFTER the SM exists and is seeded (subscribers never observe a null `StateMachine`). `Fatal` is exposed. Race requests before startup completion are structurally impossible (the SM does not exist yet; the scene bootstrapper, NOT this story, gates presentation). The orchestrator is terminal (StartupComplete or Fatal — no re-run).
- **Stage fencing (focus/retry safety)**: each async stage (catalog attempt 1, catalog attempt 2, shared) has a completion LATCH — exactly ONE completion is consumed per stage, clear-on-consume (duplicate or late callbacks for a completed stage are ignored). Focus loss during an in-flight stage does NOT trigger a re-init: the in-flight result is buffered once and consumed exactly once on re-focus. Result: the retry bound (max 2 initializer calls) and the single-Shared-load guarantee hold even under repeated background/foreground and late callbacks (AC-EC1 + AC-EC7 combined).
- **Timeout policy**: DEFERRED explicitly — catalog init hang (no timeout/cancellation) is a known limitation registered for a follow-up; this story implements the bounded retry only.
- **ADR note**: ADR-0003:51 lists Shared/Catalog under `ContentLoadError` generically, but GDD:193/:202 (specific startup path) mandates fatal/close — the story resolves the conflict in favor of the GDD for startup: Shared/Catalog startup failures are `Fatal`, never `ContentLoadError`. Race-load track failures remain `ContentLoadError(Track)`.
- **Error classification**: abortive errors during RACE load already emit `ContentLoadError` (Story 002/003); this story adds the STARTUP classifications: Catalog (catalog init, fatal) and Shared (shared load, fatal) — both via `IFatalErrorHandler`. `ContentLoadError` itself is never used at startup (no race is loading).

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- [Story 003]: Memory-pressure detection + abort; race-load track failure → `ContentLoadError(Track)` (AC-EC3 — verification-only here, regression covered by Stories 3-9/3-10/3-11)
- [Story 004]: Partial-handle cleanup mechanics
- [Story 006]: Cancel/Back blocking (UI Menu), VFX fallback, startup progress UI ("Preparing..." spinner GDD:121)
- Race-load focus pause/resume (AC-EC7 extended to race loads): Story 003 follow-up — `RaceLoadOrchestrator` has no focus concept
- Catalog-init timeout/cancellation policy: DEFERRED (known limitation, follow-up)
- Duplicate Start rejection → Simulation Kernel (already rejects at :207-218)

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate). The developer implements against these — do not invent new test cases during implementation.*

- **AC-EC1**: Given catalog init fails; When detected; Then max 2 initializer calls (retry once); if retry fails → `Fatal(reason, Catalog)` exactly-once. Edges: retry succeeds → proceeds (exactly one Shared load); duplicate Fatal from late callback → ignored; repeated foreground/late callbacks never exceed 2 init calls (stage latch).
- **AC-EC10**: Given Shared fails at startup; When detected; Then `Fatal(reason, Shared)` (not Catalog), app cannot start. Edge: Shared success → startup complete, Shared retained.
- **Startup success**: Given app starts; When catalog + Shared load; Then startup complete + Shared retained. Edge: catalog retry then success.
- **Error classification**: Given startup failure; When detected; Then catalog (after retry) → `Fatal(Catalog)`, Shared → `Fatal(Shared)`, NO `ContentLoadError` at startup. Edge: misclassification fails.
- **Fatal exactly-once**: Given fatal error; When Fatal invoked; Then fires once; second invocation ignored (terminal).
- **AC-EC7** (startup): Given startup in progress + focus lost; When unfocused; Then stage advancement deferred, in-flight completion buffered ONCE; on foreground resumes from deferred point, no corruption, Shared loaded exactly once. Edges: repeated background/foreground; focus loss during retry (no extra init); late callback after stage consumed (ignored).
- **AC-EC3 verification** (NOT this story): track bundle failure → race abort + `ContentLoadError(Track)` + cleanup + return to Idle — already implemented in Stories 3-9/3-10/3-11 (`RaceLoadOrchestrator`); regression coverage there, verification-only here.

---

## Test Evidence

**Story Type**: Logic
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/content/StartupErrorTests.cs` — catalog retry (max 2 init calls, retry-success → one Shared load), Shared fatal (Fatal(Shared)), startup success (Shared retained, StartupComplete), error classification (Catalog/Shared types, never ContentLoadError at startup), Fatal exactly-once (duplicate ignored), focus deferral (unfocused buffers completion, foreground resumes) — engine-free via fakes (ContentUnitTests assembly)
- Integration: `Assets/tests/integration/content/StartupErrorIntegrationTests.cs` — composition root `RunStartup()` stage: SM constructed with `isSharedLoaded: true` after StartupComplete, StartupComplete/Fatal exposed, focus pause/resume via injectable `IFocusSeam` (ContentIntegrationTests assembly)

**Status**: [x] Created and passing — `Assets/tests/unit/content/StartupErrorTests.cs` (20 tests, `ContentUnitTests` assembly) + `Assets/tests/integration/content/StartupErrorIntegrationTests.cs` (6 tests, `ContentIntegrationTests` assembly) — 937/937 PlayMode + 43/43 EditMode green (2026-08-15)

---

## Dependencies

- Depends on: Story 002 (CP_ state machine — Idle entry) — DONE; Story 004 (cleanup mechanics) — DONE
- Unlocks: None directly
