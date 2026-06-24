# Epic: Menu LITE

> **Layer**: Presentation (slot #15 — menu screens for single race flow)
> **GDD**: design/gdd/menu-lite.md
> **Architecture Module**: Presentation — Menu
> **Status**: Ready
> **Stories**: 8 stories (Ready) — see table below

## Overview

6 screens (Title → Car Select → Track Select → Race Settings → Loading → Results) managed via screen stack push/pop. All Babylon.js GUI with `idealHeight=1080`, proportional fractions. Pre-created at init (~600KB controls + ~1MB thumbnails). Instant transitions via `isVisible` toggle — no fade or slide in Phase 1. GSM local copy via Event Bus subscription (same pattern as Input ADR-0006). Loading screen minimum 2s (synchronized with Asset Manager). Car thumbnails captured once at init via `CreateScreenshotUsingRenderTargetAsync` with isolated camera and alpha background. Navigation actions reuse `confirm`/`cancel`/directional from Input (ADR-0006).

## Governing ADRs

| ADR                              | Decision Summary                                                       | Engine Risk |
| -------------------------------- | ---------------------------------------------------------------------- | ----------- |
| ADR-0019: Menu LITE Architecture | Screen stack, pre-create controls, instant transitions, RTT thumbnails | LOW         |

## GDD Requirements

| TR-ID       | Requirement                                                                               | ADR Coverage |
| ----------- | ----------------------------------------------------------------------------------------- | ------------ |
| TR-MENU-001 | Screen stack: Title → Main Menu → Car Select → Race Setup → Loading → Results → PostRace  | ADR-0019 ✅  |
| TR-MENU-002 | Title screen: game title, 'Press ENTER to start', transitions to Main Menu                | ADR-0019 ✅  |
| TR-MENU-003 | Car Select: grid of 8 team cards with thumbnails; confirm locks in                        | ADR-0019 ✅  |
| TR-MENU-004 | Main Menu: Single Player and Options buttons; ESC returns to Title                        | ADR-0019 ✅  |
| TR-MENU-005 | Race Setup: track selection (4 circuit cards), lap count, difficulty, confirm             | ADR-0019 ✅  |
| TR-MENU-006 | Input navigation: confirm/cancel/navUp/navDown from InputState — never direct device read | ADR-0019 ✅  |
| TR-MENU-007 | GSM local copy via Event Bus subscription; instant isVisible toggle on transitions        | ADR-0019 ✅  |
| TR-MENU-008 | Car thumbnails via RenderTarget — captured once at init with isolated camera              | ADR-0019 ✅  |
| TR-MENU-009 | Loading screen: min 0.5s display; 10s timeout shows "Still loading..."                    | ADR-0019 ✅  |
| TR-MENU-010 | Results screen: position count-up animation, total time, fastest lap, rival reaction text | ADR-0019 ✅  |
| TR-MENU-011 | Race Again preserves selections; Main Menu clears all                                     | ADR-0019 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/menu-lite.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Stories

| #   | Story                                      | Type        | Status | ADR      |
| --- | ------------------------------------------ | ----------- | ------ | -------- |
| 001 | MenuLite Core — Screen Stack + Input + GSM | Integration | Ready  | ADR-0019 |
| 002 | Title Screen                               | UI          | Ready  | ADR-0019 |
| 003 | Main Menu Screen                           | UI          | Ready  | ADR-0019 |
| 004 | Car Select Screen                          | UI          | Ready  | ADR-0019 |
| 005 | Car Thumbnails via RenderTarget            | Visual/Feel | Ready  | ADR-0019 |
| 006 | Race Setup Screen                          | UI          | Ready  | ADR-0019 |
| 007 | Loading Screen + GSM Transition            | Integration | Ready  | ADR-0019 |
| 008 | Results Screen — Count-Up + Race Actions   | Visual/Feel | Ready  | ADR-0019 |

## Next Step

Run `/story-readiness production/epics/menu-lite/story-001-menu-lite-core.md` to validate, then `/dev-story` to begin implementation.
