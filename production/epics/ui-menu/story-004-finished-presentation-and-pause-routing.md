# Story 004: Finished Presentation & Pause Routing

> **Epic**: UI Menu
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/ui-menu.md`
**Requirement**: `TR-ui-005` (Finished Presentation, Pause explicit lifecycle contracts)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0019 (§UI Presentation Ownership Summary) + ADR-0001 (terminalPresentationRequest, UI Presentation owns timer) + ADR-0005 (input routing) + ADR-0018 (Forfeit)
**ADR Decision Summary**: UI Presentation owns ONLY terminal timer state, focus-loss pause, and `DismissTerminalPresentation` (never changes simulation state/race clocks/results). Confirm and Pause accepted through an injected direct-routing port; Cancel produces no UI action. Timer never exceeds 5s before timeout dismissal. Pause Cancel/Back emits `ResumeRequested`; Return to Menu emits `ReturnToMenuRequested` with race context. Forfeit classification + Results rendering move to the Results story (004A). InputSystemUIInputModule disablement and physical routing move to Input System coverage.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Event-consumption routing; injected host seams.

**Control Manifest Rules (this layer)**:
- Required: UI Presentation owns only timer/pause/DismissTerminalPresentation; never simulation state
- Required: Finished Cancel suppressed; Pause emits ResumeRequested/ReturnToMenuRequested

---

## Acceptance Criteria

*From ADR-0019/0001/0005/0018, scoped per QL-STORY-READY 2026-08-16 (003B split):*

- [ ] UI Presentation owns only terminal timer state, focus-loss pause, and `DismissTerminalPresentation` (never changes simulation state, race clocks, or results)
- [ ] Confirm and Pause accepted through an injected direct-routing port; Cancel produces no UI action (Finished Presentation)
- [ ] Terminal timer never exceeds five seconds before timeout dismissal
- [ ] Pause Cancel/Back emits `ResumeRequested`; Return to Menu emits `ReturnToMenuRequested` with race context
- [ ] Forfeit classification and Results rendering move to the Results story (004A); UI only consumes the host's resulting result model
- [ ] InputSystemUIInputModule disablement and physical routing are Input System coverage (not UI Menu)

---

## Implementation Notes

*Derived from ADR-0019 Implementation Guidelines:*

- Finished Presentation (visible screen) vs UI Presentation (controller): the controller owns only the timer, pause flag, and dismissal signal
- Direct routing: Confirm/Pause reach UI Presentation without generic Submit/Cancel (the input module state is Input's)
- Focus-loss pause: the timer pauses on focus loss (ADR-0001)
- Forfeit result model consumption is 004A's — this story emits the routing requests

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Input epic]: InputSystemUIInputModule state, physical routing
- [Story 004A]: Forfeit/Results rendering
- [Simulation]: actual resume/forfeit transitions

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-TIMER**: terminal presentation timer ≤5s; pauses on focus loss; emits DismissTerminalPresentation
- **AC-DIRECT**: Confirm/Pause via injected direct-routing port; Cancel → no UI action
- **AC-PAUSE**: Pause Cancel/Back → ResumeRequested; Return to Menu → ReturnToMenuRequested with race context
- **AC-NO-SIM**: UI Presentation never changes simulation state/race clocks/results

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/ui-menu/UiMenuTests.cs` — terminal/pause routing with fakes

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003A (lifecycle), race-flow (terminal request), Input (routing seams)
- Unlocks: Story 005 (Results)
