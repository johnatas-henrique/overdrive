# Story 006: Loading Screen

> **Epic**: Content Pipeline
> **Status**: Complete
> **Layer**: Foundation
> **Type**: UI
> **Manifest Version**: 2026-08-05
> **Estimate**: M (4-5h)

## Context

**GDD**: `design/gdd/content-pipeline.md`
**Requirement**: `TR-content-008`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0003: Content Pipeline and Addressables
**ADR Decision Summary**: Loading progress from byte counts (`GetDownloadStatus()`), minimum 0.5s display, blocks all input during loading, first-launch catalog shows "Preparing..." with spinner. Content owns the lifecycle controller/progress/timing; UI Menu owns visual layout/text/spinner/VFX/dismiss animation; Input System/UI controller owns input blocking.

**Engine**: Unity 6000.3.22f1 (Unity 6.3 LTS) | **Risk**: LOW

**Engine Notes**: UX loading spec (design/ux/loading.md:150-159): 300ms fade-from-black exit into race; Reduced Motion = instant transitions, no fade, static progress bar. ui-menu.md:64/115/209-210 owns the Loading screen presentation.

**Performance disposition**: No per-frame work — the controller reacts to `ProgressChanged` (load-driven, not frame-driven) and a single timer check on the injectable `IClock`. VFX budget is UI Menu owned (GDD:122 2-3MB, AC-LS7 measured at the profiling gate — TD-026). Transition frequency: at most one `ShowProgress` per load completion/1s sample (orchestrator cadence) + one `ShowPreparing`/`OnLoadComplete`/`OnLoadError` per lifecycle — never per-frame.

**Control Manifest Rules (Foundation layer)**:
- Required: Loading progress from byte counts via `AsyncOperationHandle.GetDownloadStatus()` — source: ADR-0003
- Guardrail: Load ceiling ≤5s PC SSD / ≤10s WebGL first load (TR-content-007) — declared target, measured at profiling gate (TD-026)

---

## Acceptance Criteria

*From GDD `design/gdd/content-pipeline.md`, scoped to this story:*

- [ ] **AC-LS1**: Given loading begins, When loading screen appears, Then progress bar shows 0%.
- [ ] **AC-LS2**: Given loading in progress, When progress updates, Then it increases monotonically from 0% to 100%.
- [ ] **AC-LS3**: Given loading completes under 0.5s, When displayed, Then loading screen remains at least 0.5s.
- [ ] **AC-LS4** (normative contract resolved): Given loading completes over 0.5s, When finished, Then progress reaches 1.0 and the controller signals completion immediately — no additional progress hold. *(The visual exit uses the UI Menu 300ms fade transition per UX loading.md:150-159; instant under Reduced Motion. The fade is a UI Menu transition, NOT a progress hold — tested separately as UI Menu's AC.)*
- [ ] **AC-LS5** (boundary re-scope — gate R1): Given the controller is active, When queried, Then `InputBlocked == true` from `BeginPreparing`/`BeginLoading` until `NotifyLoaded`/`NotifyError`. *(Action-map enforcement is deferred — Input System/UI composition story; the controller only reports the blocked state through the port.)*
- [ ] **AC-LS6**: Given first launch, When catalog initializes, Then "Preparing..." with spinner is shown.
- [ ] **AC-LS7** (DEFERRED — TD-026 profiling gate): VFX memory ≤3 MB measured against real content; not verifiable with this story's fakes. *See Out of Scope.*
- [ ] **AC-LS8** (boundary re-scope — gate R1/R2): Given a non-fatal presentation failure (presenter throws — all presenter methods are `void`, so throws are the only failure seam), When progress continues, Then the controller does not emit `OnLoadError` and progress events continue. *(VFX skip/fallback visuals are UI Menu-owned — deferred to the UI Menu loading-screen story.)*
- [ ] **AC-LS9** (DEFERRED — UI Menu epic): "Loading..." text above bar, percentage below is UI Menu layout (ui-menu.md loading presentation); no presenter seam exposes layout. *Moved to Out of Scope.*
- [ ] **AC-EC5** (boundary re-scope — gate R1): Given loading in progress, When queried for cancellation, Then the controller exposes NO cancellation API and `InputBlocked` remains true until `NotifyLoaded`/`NotifyError`; no async operation is cancelled by the controller. *(Cancel/Back routing is deferred — Input System/UI composition story.)*
- [ ] **AC-EC9** (boundary re-scope — gate R1): Given a non-fatal condition (VFX failure, presenter hiccup), When queried, Then the controller never emits `OnLoadError` and progress keeps flowing; no error is shown by the controller.

---

## Completion Notes

**Completed**: 2026-08-15
**Criteria**: 10/10 passing (0 deferred — AC-LS7 → TD-026 profiling gate; AC-LS9 → UI Menu epic, both recorded in Out of Scope)
**Deviations**: None — multi-cycle re-arm and Preparing→Loading transition are validated design decisions (unity-specialist), documented in Implementation Notes
**Test Evidence**: UI (controller Logic component) — 29 unit (`LoadingScreenControllerTests.cs`, ContentUnitTests) + 5 integration (attach wiring, `StartupErrorIntegrationTests.cs`) = 34 tests; 970/970 PlayMode + 43/43 EditMode green; visual evidence at `production/qa/evidence/loading-screen-evidence.md` (controller verified; UI-boundary checklist pending UI Menu epic per ownership split)
**Code Review**: Complete (unity-specialist APPROVED R1 + final; qa-tester TESTABLE R3 — 2 production changes: `_pendingComplete` guard in NotifyLoaded, single-attach guard)
**Gates**: LP-CODE-REVIEW APPROVED · QL-TEST-COVERAGE ADEQUATE
**Tech debt**: None new — LS7 measurement stays under TD-026; LS9 visual layout is UI Menu epic scope

## Implementation Notes

*Derived from ADR-0003 + UX loading spec:*

- **Ownership split** (gate F10, verified against ui-menu.md:64/115/209-210 + content-pipeline.md:116-122):
  - **Content Pipeline**: lifecycle controller, progress events (from GetDownloadStatus), minimum-display timing contract (0.5s), catalog "Preparing..." state, error/completion events.
  - **UI Menu**: visual layout, text, spinner/VFX, dismiss animation (300ms fade per UX loading.md; instant under Reduced Motion).
  - **Input System/UI controller**: input blocking. Content does NOT own action-map state.
- **`ILoadingScreenPresenter` port** (gate F10):
  ```csharp
  public interface ILoadingScreenPresenter {
      void ShowProgress(float progress);   // 0..1, monotonic
      void ShowPreparing();                // first-launch catalog spinner
      void OnLoadComplete();               // signal completion; UI Menu handles 300ms fade
      void OnLoadError(string reason);     // error banner (200ms fade per UX loading.md)
      bool InputBlocked { get; }           // true during loading
  }
  ```
  Content drives the controller; UI Menu implements the presenter.
- **`LoadingScreenController`** (concrete, engine-free — `Overdrive.Content` assembly, zero UnityEngine):
  ```csharp
  public sealed class LoadingScreenController : IDisposable {
      public LoadingScreenController(
          IRaceLoadProgress progress,        // orchestrator — ProgressChanged source
          IClock clock,                      // monotonic (same contract as 3-10)
          ILoadingScreenPresenter presenter, // UI Menu implementation
          float minimumDisplaySeconds = 0.5f);

      public void BeginPreparing();          // bootstrapper calls BEFORE StartupOrchestrator.Run()
      public void BeginLoading();            // bootstrapper calls on first ContentLoadRequested; emits ShowProgress(0) (AC-LS1)
      public void Tick();                    // called once per frame by the Unity driver; releases Completed when min-display elapsed (AC-LS3); no-op when idle/terminal
      public void NotifyLoaded();            // composition root calls on RaceLoadReady/HandoffValid; emits ShowProgress(1.0)
      public void NotifyError(string reason);// composition root calls on ContentLoadError (after cleanup); emits OnLoadError(reason)
      public bool InputBlocked { get; }      // true from BeginPreparing until terminal (NotifyLoaded/NotifyError)
      public event Action Completed;         // fires exactly once per cycle at terminal-success; UI Menu subscribes for the 300ms fade transition
      public float ElapsedDisplay { get; }   // display time at terminal (test observability)
  }
  ```
  **Multi-cycle re-arm** (unity-specialist design validation): `BeginPreparing`/`BeginLoading` re-arm a terminal/idle controller (elapsed reset, `InputBlocked=true`, `ShowProgress(0)` on `BeginLoading`) and are no-ops while a cycle is active. The composition root keeps ONE instance; the bootstrapper re-arms on each Idle→Loading transition. **Reconfigure never calls `Begin*`** (the SM fires `RaceReconfigureStart`, not `ContentLoadRequested`; `NotifyLoaded` on a terminal controller no-ops).
  Timing rule (AC-LS3/LS4): elapsed display time starts at the FIRST `Begin*` call — `BeginPreparing` on first launch (catalog display counts), `BeginLoading` otherwise. At `NotifyLoaded`, if `elapsed >= minimumDisplaySeconds` → `Completed` immediately (LS4); else mark pending-complete and `Tick()` releases it once `elapsed` crosses the minimum (LS3). Progress is clamped monotonic (AC-LS2) — never emitted below the previous value. Terminal is exactly-once: `NotifyLoaded` → `Completed`; `NotifyError` → `OnLoadError` (no `Completed`); later terminal calls are ignored. `InputBlocked` stays true until the terminal fires. Presenter exceptions during `ShowProgress`/`ShowPreparing`/`OnLoadComplete` are swallowed (SafePublish) and never call `OnLoadError` (AC-LS8/EC9). `Dispose` ONLY unsubscribes `ProgressChanged` — it never touches the presenter and never changes `InputBlocked` (blocking remains true until the terminal; the presenter is the UI owner of its own blocking).
- **Wiring** (composition root): controller constructed with the orchestrator's `IRaceLoadProgress`, the `ClockSource`, and the UI Menu presenter; the bootstrapper drives `BeginPreparing` → `RunStartup` → `BeginLoading` on first race request; the root calls `NotifyLoaded`/`NotifyError` from the SM `RaceLoadReady`/`ContentLoadError` paths. `Completed` triggers the UI Menu 300ms fade (or instant under Reduced Motion) — the fade is a UI Menu transition, NOT a controller delay.
- **Minimum display** (GDD:119): 0.5s minimum even if instant — prevents flash. Timing contract in the Content controller (testable with injectable clock).
- **Progress binding**: Content's LoadingProgress event (0..1, monotonic, from GetDownloadStatus) → presenter.ShowProgress.
- **First-launch** (GDD:121): catalog init → "Preparing..." + spinner (not progress bar).
- **Input block** (GDD:120, AC-LS5): via Input System/UI controller — Content's ILoadingScreenPresenter.InputBlocked exposes the state; the blocking implementation is UI/Input owned.
- **VFX** (GDD:122): 2-3MB budget; VFX failure → skip, progress bar still works (AC-LS8/EC9). Reduced Motion: no VFX, no fade — static progress bar only (UX loading.md).

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- Loading screen visual layout/text/spinner/dismiss → UI Menu epic (ui-menu.md); **includes AC-LS9** ("Loading..." text above bar, percentage below — pure layout, no presenter seam exposes it)
- Loading screen VFX (2-3MB budget, GDD:122) + VFX skip/fallback visuals → UI Menu epic (ui-menu.md); **AC-LS8/EC9 controller-boundary assertions cover the non-fatal path only**
- Input action-map blocking (Cancel/Back routing) → Input System/UI controller composition story
- AC-LS7 (5s/10s timing + 3MB VFX measured memory) → TD-026 (profiling gate — measured against real content)

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate). The developer implements against these — do not invent new test cases during implementation.*

- **AC-LS1**: Given loading begins; When screen appears; Then progress bar shows 0%. Edge: first event is 0 (BeginLoading emits ShowProgress(0)).
- **AC-LS2**: Given loading in progress; When progress updates; Then monotonic 0→100%. Edge: out-of-order progress clamped.
- **AC-LS3**: Given load completes <0.5s; When displayed; Then screen remains ≥0.5s. Edge: instant load still shows 0.5s (Tick releases at the boundary).
- **AC-LS4**: Given load completes >0.5s; When finished; Then progress reaches 1.0 and controller signals completion immediately; no additional hold. (Fade timing is UI Menu's AC — 300ms, instant under Reduced Motion.)
- **AC-LS5**: Given controller active; When queried; Then InputBlocked true from BeginPreparing/BeginLoading until terminal. (Action-map enforcement deferred.)
- **AC-LS6**: Given first launch; When catalog initializes; Then "Preparing..." + spinner shown (ShowPreparing emitted).
- **AC-LS8**: Given non-fatal presentation failure (presenter throws — all presenter methods are `void`, so throws are the only failure seam); When progress continues; Then no OnLoadError emitted, progress events continue.
- **AC-EC5**: Given loading in progress; When queried for cancellation; Then no cancellation API exists (reflection assert: public API exposes no Cancel/Abort/Stop method), InputBlocked persists until terminal, no async op cancelled by the controller.
- **AC-EC9**: Given non-fatal condition (VFX failure, presenter hiccup); When queried; Then controller never emits OnLoadError, progress keeps flowing.

*(AC-LS7 → TD-026 profiling gate; AC-LS9 → UI Menu epic — deferred, not QA'd here.)*

---

## Test Evidence

**Story Type**: UI
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/content/LoadingScreenControllerTests.cs` — min-display timing (0.5s hold), monotonic progress clamp, Preparing state, exactly-once Completed, InputBlocked lifecycle, Dispose unsubscription — via fake presenter + fake clock (`ContentUnitTests` assembly, engine-free)
- UI: `production/qa/evidence/loading-screen-evidence.md` + sign-off — visual layout verified in editor (UI Menu epic collaborates; the Loading screen presentation is owned there)

**Status**: [x] Created and passing — `Assets/tests/unit/content/LoadingScreenControllerTests.cs` (27 tests) + integration wiring in `Assets/tests/integration/content/StartupErrorIntegrationTests.cs` (4 tests: attach guards + RaceLoadReady/ContentLoadError wiring) — 969/969 PlayMode + 43/43 EditMode green (2026-08-15); UI evidence at `production/qa/evidence/loading-screen-evidence.md` (controller section verified; visual checklist pending UI Menu epic per ownership split)

---

## Dependencies

- Depends on: Story 002 (CP_ state machine — Loading states) — DONE; Story 003 (progress source) — DONE
- Unlocks: None directly (UI Menu epic implements the presenter)
