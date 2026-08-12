# Story 006: Loading Screen

> **Epic**: Content Pipeline
> **Status**: Ready
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

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS) | **Risk**: LOW

**Engine Notes**: UX loading spec (design/ux/loading.md:150-159): 300ms fade-from-black exit into race; Reduced Motion = instant transitions, no fade, static progress bar. ui-menu.md:64/115/209-210 owns the Loading screen presentation.

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
- [ ] **AC-LS5**: Given loading screen visible, When player presses any input, Then input is blocked.
- [ ] **AC-LS6**: Given first launch, When catalog initializes, Then "Preparing..." with spinner is shown.
- [ ] **AC-LS7**: Given loading VFX budget, When measured, Then VFX memory does not exceed 3 MB.
- [ ] **AC-LS8**: Given VFX fails to load, When displayed, Then progress bar and text still function.
- [ ] **AC-LS9**: Given loading screen active, When displayed, Then "Loading..." text appears above bar and percentage below.
- [ ] **AC-EC5** (explicit — gate NEW-08): Given player presses Cancel or Back mid-load, When loading has already begun, Then the request is ignored and the load continues until `RaceLoadReady` or `ContentLoadError`; no async operation is cancelled by normal player input. *(Cross-ref: UI Menu owns the input-block presentation; Content Pipeline contract here.)*
- [ ] **AC-EC9**: Given VFX fails to load, When displayed, Then VFX skipped, progress bar functional, no error shown.

---

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
- **Minimum display** (GDD:119): 0.5s minimum even if instant — prevents flash. Timing contract in the Content controller (testable with injectable clock).
- **Progress binding**: Content's LoadingProgress event (0..1, monotonic, from GetDownloadStatus) → presenter.ShowProgress.
- **First-launch** (GDD:121): catalog init → "Preparing..." + spinner (not progress bar).
- **Input block** (GDD:120, AC-LS5): via Input System/UI controller — Content's ILoadingScreenPresenter.InputBlocked exposes the state; the blocking implementation is UI/Input owned.
- **VFX** (GDD:122): 2-3MB budget; VFX failure → skip, progress bar still works (AC-LS8/EC9). Reduced Motion: no VFX, no fade — static progress bar only (UX loading.md).

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- Loading screen visual layout/text/spinner/dismiss → UI Menu epic (ui-menu.md)
- Input action-map blocking → Input System/UI controller
- AC-LS10/LS11 (5s/10s timing) → TD-026 (profiling gate — measured against real content)
- AC-LS7 measured VFX memory → TD-026 (profiling gate)

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate). The developer implements against these — do not invent new test cases during implementation.*

- **AC-LS1**: Given loading begins; When screen appears; Then progress bar shows 0%. Edge: first event is 0.
- **AC-LS2**: Given loading in progress; When progress updates; Then monotonic 0→100%. Edge: out-of-order progress clamped.
- **AC-LS3**: Given load completes <0.5s; When displayed; Then screen remains ≥0.5s. Edge: instant load still shows 0.5s.
- **AC-LS4**: Given load completes >0.5s; When finished; Then progress reaches 1.0 and controller signals completion immediately; no additional hold. (Fade timing is UI Menu's AC — 300ms, instant under Reduced Motion.)
- **AC-LS5**: Given loading visible; When any input; Then input blocked. Edge: Cancel/Back mid-load ignored (EC5 cross-ref).
- **AC-LS6**: Given first launch; When catalog initializes; Then "Preparing..." + spinner shown.
- **AC-LS7**: Given loading VFX; When measured; Then ≤3MB. (Profiling gate TD-026 for measured evidence.)
- **AC-LS8**: Given VFX fails; When displayed; Then progress bar + text still function.
- **AC-LS9**: Given loading active; When displayed; Then "Loading..." above bar, percentage below.
- **AC-EC5**: Given Cancel/Back mid-load; When loading begun; Then ignored, load continues until RaceLoadReady or ContentLoadError; no async cancellation.
- **AC-EC9**: Given VFX fails; When displayed; Then VFX skipped, progress bar functional, no error shown.

---

## Test Evidence

**Story Type**: UI
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/content/LoadingScreenControllerTests.cs` — min-display timing, monotonic progress, Preparing state via fake presenter
- UI: `production/qa/evidence/loading-screen-evidence.md` + sign-off — visual layout verified in editor (UI Menu epic collaborates)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002 (CP_ state machine — Loading states) — DONE; Story 003 (progress source) — DONE
- Unlocks: None directly (UI Menu epic implements the presenter)
