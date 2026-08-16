# Loading Screen — Visual Evidence (Story 3-13)

> **Story**: `production/epics/content-pipeline/story-006-loading-screen.md` (Loading Screen)
> **Status**: PENDING — UI Menu epic collaboration
> **Date**: 2026-08-15

## Scope of this evidence

The Content Pipeline story 3-13 delivers the **lifecycle controller** (`LoadingScreenController`)
and the **presenter port** (`ILoadingScreenPresenter`) — engine-free, fully covered by
unit tests (`Assets/tests/unit/content/LoadingScreenControllerTests.cs`, 22+ tests).
The **visual presentation** (layout, text, spinner, VFX, 300ms fade, Reduced Motion
behavior) is owned by the UI Menu epic (ui-menu.md) and does not exist in the editor
yet — this file records that boundary and will be completed when the UI Menu
implements the presenter.

## Controller-boundary evidence (this story — verified)

| Criterion | Verification |
|-----------|--------------|
| AC-LS1..LS6, LS8, EC5, EC9 | `LoadingScreenControllerTests.cs` — monotonic progress, 0.5s min display, Preparing, InputBlocked lifecycle, no cancellation API, SafePublish |
| Wiring (composition root) | `StartupErrorIntegrationTests.cs` — Attach single-attach guard, RaceLoadReady → NotifyLoaded, pre-startup attach rejected |

## UI-boundary evidence (UI Menu epic — pending)

To be verified in the editor when the UI Menu epic implements `ILoadingScreenPresenter`:

- [ ] Progress bar shows 0%..100% monotonic fill (byte-derived)
- [ ] "Loading..." text above bar, percentage below (AC-LS9 — deferred to UI Menu)
- [ ] "Preparing..." + spinner on first-launch catalog (AC-LS6 visual)
- [ ] 300ms fade-to-black exit into race; instant under Reduced Motion (UX loading.md:150-159)
- [ ] VFX within 2-3MB budget (AC-LS7 — TD-026 profiling gate)
- [ ] VFX failure → skipped, progress bar functional (AC-LS8/EC9 visual)
- [ ] Input blocked during loading (AC-LS5 — Input System/UI controller composition story)
- [ ] Error banner 200ms fade (UX loading.md)

## Sign-off

| Role | Verdict | Date |
|------|---------|------|
| Content Pipeline (3-13) | Controller + wiring verified (unit + integration) | 2026-08-15 |
| UI Menu (pending) | Visual layout/sign-off — pending epic implementation | — |
