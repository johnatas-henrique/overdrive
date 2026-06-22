# Epic: Menu LITE

> **Layer**: Presentation (slot #15 — menu screens for single race flow)
> **GDD**: design/gdd/menu-lite.md
> **Architecture Module**: Presentation — Menu
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories menu-lite`

## Overview

6 screens (Title → Car Select → Track Select → Race Settings → Loading → Results) managed via screen stack push/pop. All Babylon.js GUI with `idealHeight=1080`, proportional fractions. Pre-created at init (~600KB controls + ~1MB thumbnails). Instant transitions via `isVisible` toggle — no fade or slide in Phase 1. GSM local copy via Event Bus subscription (same pattern as Input ADR-0006). Loading screen minimum 2s (synchronized with Asset Manager). Car thumbnails captured once at init via `CreateScreenshotUsingRenderTargetAsync` with isolated camera and alpha background. Navigation actions reuse `confirm`/`cancel`/directional from Input (ADR-0006).

## Governing ADRs

| ADR                              | Decision Summary                                                       | Engine Risk |
| -------------------------------- | ---------------------------------------------------------------------- | ----------- |
| ADR-0019: Menu LITE Architecture | Screen stack, pre-create controls, instant transitions, RTT thumbnails | LOW         |

## GDD Requirements

| TR-ID       | Requirement                                                                         | ADR Coverage |
| ----------- | ----------------------------------------------------------------------------------- | ------------ |
| TR-MENU-001 | Screen stack: Title → Car Select → Track Select → Race Settings → Loading → Results | ADR-0019 ✅  |
| TR-MENU-002 | Babylon.js GUI with idealHeight=1080, proportional fractions                        | ADR-0019 ✅  |
| TR-MENU-003 | Instant transitions — isVisible toggle, no fade/slide in Phase 1                    | ADR-0019 ✅  |
| TR-MENU-004 | GSM local copy via Event Bus subscription                                           | ADR-0019 ✅  |
| TR-MENU-005 | Loading screen min 2s; 'Still loading' at 10s                                       | ADR-0019 ✅  |
| TR-MENU-006 | Car thumbnails via RTT — captured once at init                                      | ADR-0019 ✅  |
| TR-MENU-007 | Navigation via confirm/cancel/directional from Input (ADR-0006)                     | ADR-0019 ✅  |
| TR-MENU-008 | Results screen — finishing position, race time, fastest lap                         | ADR-0019 ✅  |
| TR-MENU-009 | Race Again option returns to Racing; Quit returns to Title                          | ADR-0019 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/menu-lite.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories menu-lite` to break this epic into implementable stories.
