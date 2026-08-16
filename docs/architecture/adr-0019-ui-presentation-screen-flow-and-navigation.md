# ADR-0019: UI Presentation — Screen Flow, Navigation, and Car Turntable

## Status

Accepted

## Date

2026-08-05

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Presentation / UI |
| **Knowledge Risk** | LOW — uGUI (UGUI 2.0.0) + Input System UI module; no post-cutoff API surface beyond ADR-0005's verified routing |
| **References Consulted** | `design/gdd/ui-menu.md`, `design/ux/ui-menu.md`, `docs/architecture/architecture.md` |
| **Post-Cutoff APIs Used** | None beyond ADR-0005 (InputSystemUIInputModule, OverdriveUI action map) |
| **Verification Required** | Keyboard-only and controller-only navigation playtest; focus-boundary tests; turntable rotation validation |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (Simulation owns Loading/Countdown/Finished/Results/Idle lifecycle; `terminalPresentationRequest` in PublishedSimulationSnapshot). ADR-0003 (Loading blocks Back/Cancel; `RaceLoadReady`/`ContentLoadError`). ADR-0005 (OverdriveUI action map, Confirm/Cancel/Pause routing, InputContextController). ADR-0013 (Qualifying Results confirm-only screen). ADR-0018 (RSM owns result data and `StartRaceRequested`/`ReturnToMenuRequested` lifecycle rules) |
| **Enables** | All menu, selection, pause, and results screens; car-selection turntable; terminal presentation UI |
| **Blocks** | UI implementation; the title-to-results flow cannot be built against fragmented lifecycle contracts |
| **Ordering Note** | Created in response to architecture-review-2026-08-05-v4 coverage gaps TR-ui-001/002/004 — the complete screen-flow contract, pointer navigation behavior, and the turntable had no single owning ADR |

## Context

UI Menu manages the non-race screens: title, track selection, car selection, settings, and results. The screen-flow, navigation, and car-turntable contracts existed in `ui-menu.md` and `design/ux/ui-menu.md` but were spread across multiple ADR fragments (lifecycle in ADR-0001/0003/0013, input routing in ADR-0005) without a single UI-owning decision. This ADR ratifies the complete flow, the navigation rules, and the presentation contracts so UI implementation has one authoritative source.

The visual language is "Garage Lit" — warm, tactile, team-centered; the car is the hero (ui-menu.md:23).

## Decision

### Screen Flow (TR-ui-001)

The MVP screen flow is content-driven and linear-stack for menu screens (ui-menu.md:13, 54):

```
Title → Track Selection → Car Selection → Qualifying Not Started (optional)
                                      ├─ Start → Loading → Qualifying → Qualifying Results → Loading → Countdown → Race
                                      ├─ Skip  → Qualifying Results → Loading → Countdown → Race
                                      └─ Flying Lap → Finished Presentation → Qualifying Results → Loading → Countdown → Race
                    ↑                                  ↓                                      ↓
                    └── Settings ←─────────────────────┘                              Pause Menu        Idle/Title
                                                                                       ReturnToMenu → Results
                                                                                       Next Race → Loading
```

Screen inventory (ui-menu.md:58-70, 111-121):

| Screen | Role | Lifecycle contract |
|--------|------|--------------------|
| **Title** | Game logo, Single Race, Settings, content error message | SimulationState.Idle |
| **Track Selection** | 4 track cards (map, name, distance, elevation) | Data-driven from Content Pipeline |
| **Car Selection** | Turntable, team name, 6 stats, fuel comparison, Select | See TR-ui-002 below |
| **Qualifying Not Started** | Start Qualifying / Skip | Confirm starts; Cancel returns to Car Select |
| **Loading** | Loading indicator, optional error | Back/Cancel blocked after loading begins (ADR-0003); used before Qualifying and Race |
| **Settings** | Volume, difficulty, control remapping, Chase-HUD toggle | Transactional preview (ADR-0004) |
| **Qualifying Results** | 16 positions, player highlighted, Start Race only | Shared pre-race confirmation (ADR-0013); no timeout, no Back/Cancel |
| **Pause Menu** | Resume, Settings, Return to Menu | `ReturnToMenuRequested` is the only route to Forfeit (ADR-0001); the gameplay Pause action opens it during Race |
| **Race** | HUD active (ADR-0014) | Gameplay |
| **Finished Presentation** | Player-car terminal view | Owns the up-to-5-second timer, pauses on focus loss, emits `DismissTerminalPresentation` (ADR-0001); input routed directly to UI Presentation with Cancel suppressed |
| **Results** | Position/car/time, or FORFEIT summary; Top 3 highlighted | Continue/Back → Idle/Title; Next Race → Loading |

Lifecycle rules:
- **Results and Forfeit** use their explicit destination contracts (Results → Idle on Continue/Back; Next Race → Loading) instead of generic stack-back behavior (ui-menu.md:54, 104-105).
- **Loading** blocks Back/Cancel after loading begins until `RaceLoadReady` or `ContentLoadError` (ADR-0003; ui-menu.md:80). A load error returns to Title with the Content error message.
- **Finished Presentation** is the visible screen; **UI Presentation** is its controller — responsible only for the timer, pause flag, and `DismissTerminalPresentation` signal (ui-menu.md:82). It never changes simulation state, race clocks, or results.
- **Qualifying Results** permits Confirm (Start Race) only; no timeout, no Back/Cancel path (ADR-0013; ui-menu.md:66, 116).

### Navigation Rules (TR-ui-004)

- **Pointer navigation:** Mouse hover selects a focusable element; primary click activates it. Pointer input is menu-only and never controls the car (ui-menu.md:74).
- **Keyboard navigation:** movement/submit/back per ui-menu.md default bindings (ui-menu.md:75).
- **Gamepad navigation:** movement/submit/back per ui-menu.md default bindings (ui-menu.md:76).
- **Focus boundary:** Navigation stops at the edge of the current focus group; it never wraps automatically (ui-menu.md:77). Focus layouts are per-screen, defined by the UI Menu UX specification (ui-menu.md:219).
- **Pointer coexistence:** Pointer movement of at least 2 pixels or click makes mouse active; click assigns focus before activation. Keyboard/gamepad Navigate, Confirm, or Cancel hides the pointer and updates prompt glyphs to the active scheme (ui-menu.md:78).
- **Pause contextual action:** During Race, the gameplay Pause action opens the pause menu. In menu contexts, the UI Cancel action performs Back/Cancel (ui-menu.md:79). Confirm and Cancel are not remappable in MVP (ADR-0005).
- **Finished Presentation controls:** InputContextController disables `InputSystemUIInputModule` while SimulationState is Finished, routes the UI Pause and Confirm actions directly to UI Presentation, and suppresses Cancel (ui-menu.md:81).
- **Accessibility:** Keyboard-only and controller-only navigation are required; screen-specific focus layouts are defined by the UX specification before implementation (ui-menu.md:219).

Input routing is owned by Input System (ADR-0005): OverdriveUI action map supplies Confirm, Cancel, Pause, navigation, pointer, and active scheme; `InputSystemUIInputModule` references OverdriveUI.Confirm as Submit and OverdriveUI.Cancel as Cancel; Pause remains a single logical action across gameplay and menus, with default bindings per GDD Core Rule 1 (memory #1466).

### Car Selection Turntable (TR-ui-002)

- The 3D model rotates slowly at **15 RPM** (ui-menu.md:86, 172; tuning range 5–30 RPM — too slow bores, too fast dizzy).
- Warm "Garage Lit" lighting (amber/orange tones) (ui-menu.md:87).
- Stats displayed as horizontal bars (0–20 scale) with team colors on model and UI accents; "Select" confirms the choice (ui-menu.md:88-90).
- Pre-race fuel comparison (bar/number) shown on this screen (ui-menu.md:62).
- Data sources: team stats/names/colors from Car Definition Data (ADR-0015); track list from Content Pipeline (ADR-0003).
- The turntable is presentation-only — it never touches simulation state, car assets beyond visual preview, or race configuration until "Select" is confirmed.

### UI Presentation Ownership Summary

| Contract | Owner | Consumer(s) |
|----------|-------|-------------|
| Screen flow and screen inventory | UI Menu | Player |
| Loading cancellation rules | UI Menu (via ADR-0003 event contract) | Simulation, Content Pipeline |
| Terminal presentation timer, pause flag, `DismissTerminalPresentation` | UI Presentation controller | Simulation, Camera, Audio |
| Navigation rules (pointer/keyboard/gamepad/focus) | UI Menu | Input System (OverdriveUI map) |
| Turntable rotation + Garage Lit lighting | UI Menu / Car Selection | Camera (view), Audio (menu music) |
| `StartRaceRequested` / `ReturnToMenuRequested` submission | UI Menu | RSM (lifecycle rules, ADR-0018) |

## Consequences

### Positive

- Single authoritative source for the complete screen flow, navigation rules, and turntable — resolves TR-ui-001/002/004 coverage gaps.
- Screen inventory and lifecycle rules are ratified from approved GDD/UX text; no new behavior invented.
- Explicit separation: UI Presentation (controller) vs Finished Presentation (screen) prevents lifecycle coupling with simulation.
- Navigation contracts (focus boundary, pointer coexistence, scheme glyphs) are testable without a full game build.

### Negative

- The flow is MVP-scoped; Career and multiplayer navigation (non-blocking per ui-menu.md:19) will extend the flow without altering local race flow — the ADR will be amended when those screens enter scope.
- If playtest proves a screen's flow does not work, this ADR is amended before re-implementation (same cost as no-ADR, but with recorded history).

## GDD Requirements Addressed

| GDD | Requirement |
|-----|-------------|
| ui-menu.md | Complete title-to-results screen flow (TR-ui-001) |
| ui-menu.md | Pointer, keyboard, and gamepad navigation with explicit focus, boundary, prompt, and reserved Confirm/Cancel routing (TR-ui-004) |
| ui-menu.md | 15 RPM Garage Lit car turntable (TR-ui-002) |
| ui-menu.md | Finished Presentation / UI Presentation separation and terminal timer ownership |
| ui-menu.md | Loading cancellation blocked after loading begins; Qualifying Results confirm-only |

## Validation Criteria

- [ ] Keyboard-only and controller-only playtest: every screen reachable and every action completable without a mouse
- [ ] Focus boundary test: Navigate at a focus-group edge stops, never wraps
- [ ] Pointer coexistence test: 2px movement activates mouse; keyboard/gamepad Navigate hides pointer and updates glyphs
- [ ] Turntable test: rotation speed is 15 RPM (±10%); Garage Lit lighting applied
- [ ] Loading test: Back/Cancel blocked after loading begins; `RaceLoadReady` transitions to Countdown/Qualifying; `ContentLoadError` returns to Title with error message
- [ ] Qualifying Results test: Confirm sends `StartRaceRequested`; Cancel does nothing; no timeout
- [ ] Finished Presentation test: UI Pause and Confirm routed to UI Presentation; Cancel suppressed; timer pauses on focus loss; `DismissTerminalPresentation` emitted
- [ ] Results test: Continue/Back → Idle/Title; Next Race → Loading; Forfeit shows FORFEIT with no fabricated position

## Related Decisions

- ADR-0001: Finished/Results lifecycle, terminalPresentationRequest, UI Presentation ownership of timer
- ADR-0003: Loading cancellation, RaceLoadReady/ContentLoadError, content error message on Title
- ADR-0005: OverdriveUI action map, Confirm/Cancel/Pause routing, InputContextController, reserved bindings
- ADR-0013: Qualifying Results confirm-only, GridAssignment display
- ADR-0018: RSM owns result data, StartRaceRequested/ReturnToMenuRequested lifecycle rules

## GDD Revision Flags

None — this ADR ratifies existing ui-menu.md and UX-spec text; no GDD change required.
