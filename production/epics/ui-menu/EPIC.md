# Epic: UI Menu

> **Layer**: Presentation
> **GDD**: design/gdd/ui-menu.md
> **Architecture Module**: UI presentation — screen flow and navigation (ADR-0019); production bootstrapper/composition (TD-038 owner)
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories ui-menu`
> **Estimate**: 4 stories (~11h active — calibrated 0.3×, sprint-3 retrospective)
> **Session**: S2 · Phase 4 (2-orchestrator plan 2026-08-16)
> **Depends on**: **Start contract = merged F3 interfaces** (per PR-EPIC 2026-08-16: begins when F3 epics' interfaces are on main, NOT on full integration); all Foundation+C precurs (settings, content, input, HUD/audio/camera data); ADR-0019. End-to-end integration and final menu verification are a joint phase-end activity with Session 1 (bridge: production composition replaces the dev rig).

## Overview

The application shell that closes the MVP loop (menu → car/track selection → qualifying → race → results): screen flow Title → Track → Car → Qualifying → Qualifying Results → Loading → Countdown → Race; 3D car turntable at 15 RPM with Garage Lit lighting in car selection; Results presentation (Normal position/time, Forfeit no position, DNF); pointer/keyboard/gamepad navigation with explicit focus, boundary, prompt, and reserved keys; non-stack navigation for Loading/Finished Presentation/Qualifying Results/Pause/Results. **Includes the production bootstrapper** (the composition root that wires Settings loader, Content root, Simulation driver, Input, Loading screen, HUD, Camera, Audio, VFX, and menu flow — the TD-038 owner), replacing the dev playtest rig as the single app entry. Loading screen (3-13) and quality wiring (3-14) consumers are wired here.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0019: UI Presentation — Screen Flow, Navigation, and Car Turntable | Screen flow + non-stack navigation; turntable; focus/keyboard/gamepad navigation contract | MEDIUM |
| ADR-0003 (content lifecycle) | Bootstrapper composes startup → catalog → Shared → race flow (startup overload from 3-12) | MEDIUM |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-ui-001 | Screen flow: Title → Track → Car → Qualifying → Qualifying Results → Loading → Countdown → Race | ADR-0019 ✅ |
| TR-ui-002 | 3D car turntable at 15 RPM with Garage Lit lighting in car selection | ADR-0019 ✅ |
| TR-ui-003 | Results: Normal (position, time) vs Forfeit (no position) vs DNF | ADR-0019 ✅ |
| TR-ui-004 | Pointer, keyboard, and gamepad navigation with explicit focus, boundary, prompt, reserved keys | ADR-0019 ✅ |
| TR-ui-005 | Loading, Finished Presentation, Qualifying Results, Pause, and Results use explicit non-stack navigation | ADR-0019 ✅ |

**Untraced requirements**: None — 5/5 covered by Accepted ADRs.

## Deliverables (this epic)

1. Screen flow + navigation per ADR-0019 (non-stack; car turntable scene).
2. **Production bootstrapper/composition root** — single app entry composing all systems (TD-038: LoadingScreenController per-frame Tick driver + InputBlocked enforcement; quality wiring from 3-14; content startup from 3-12).
3. Results presentation (Normal/Forfeit/DNF per TR-ui-003).
4. Joint phase-end activity with Session 1: end-to-end integration verification + final menu verification (CD-PLAYTEST-ready app).

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria of `design/gdd/ui-menu.md` are verified
- The production app composes and runs the full MVP loop: menu → selection → qualifying → race → results
- Bootstrapper wires all prior consumers (loading screen, quality, settings, content, input, simulation)
- End-to-end smoke + CD-PLAYTEST evidence (cockpit camera + engine sound + art-in-motion) recorded
- All UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories ui-menu` to break this epic into implementable stories.