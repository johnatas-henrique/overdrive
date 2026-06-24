# Epic: Dev Tools

> **Layer**: Core (slot #0 — debug infrastructure, parallel with Physics)
> **GDD**: design/gdd/dev-tools.md
> **Architecture Module**: Dev Infra — Tooling
> **Status**: Ready
> **Stories**: 8 stories (Ready)

## Overview

HTML overlay for debug (positioned over canvas container, `pointer-events: none`). Lazy init on first F1 press. Metrics via `SceneInstrumentation` (FPS, frame time, draw calls, physics time). `engine.onEndFrameObservable` for overlay refresh. Event Bus inspector, Config namespace inspector with in-place edit, GSM state visualiser, Simulation Snapshot debug panel. All behind `__DEV__` guard — zero bytes in production (`import.meta.env.DEV` dynamic import).

## Governing ADRs

| ADR                              | Decision Summary                                             | Engine Risk |
| -------------------------------- | ------------------------------------------------------------ | ----------- |
| ADR-0009: Dev Tools Architecture | HTML overlay, SceneInstrumentation, **DEV** guard, read-only | LOW         |

## GDD Requirements

| TR-ID      | Requirement                                                                     | ADR Coverage |
| ---------- | ------------------------------------------------------------------------------- | ------------ |
| TR-DVT-001 | HTML overlay with FPS, draw calls, mesh count, physics bodies, tick timing      | ADR-0009 ✅  |
| TR-DVT-002 | Event Bus inspector — live subscription list, emit history (last 100)           | ADR-0009 ✅  |
| TR-DVT-003 | Config namespace inspector — tree view, in-place edit via DevTools.Config.set() | ADR-0009 ✅  |
| TR-DVT-004 | Simulation Snapshot debug panel — per-system hash, diff, take/restore           | ADR-0009 ✅  |
| TR-DVT-005 | GSM state visualiser — current state, history timeline, manual transitions      | ADR-0009 ✅  |
| TR-DVT-006 | Tree-shaken in production via **DEV** guard                                     | ADR-0009 ✅  |
| TR-DVT-007 | F1 toggle overlay, F2 toggle full event display, F3 toggle minimised            | ADR-0009 ✅  |
| TR-DVT-008 | AI Telemetry tab in Dev Tools overlay — per-car speed, position, behavior node  | ADR-0009 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/dev-tools.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Stories

| #   | Story               | Type        | Status | ADR      |
| --- | ------------------- | ----------- | ------ | -------- |
| 001 | dev-compile-guard   | Logic       | Ready  | ADR-0009 |
| 002 | input-keybinds      | Logic       | Ready  | ADR-0009 |
| 003 | html-overlay        | UI          | Ready  | ADR-0009 |
| 004 | config-tree         | Integration | Ready  | ADR-0009 |
| 005 | event-bus-inspector | Integration | Ready  | ADR-0009 |
| 006 | gsm-visualizer      | Integration | Ready  | ADR-0009 |
| 007 | sim-snapshot-panel  | Integration | Ready  | ADR-0009 |
| 008 | ai-telemetry-tab    | Integration | Ready  | ADR-0009 |

## Next Step

Run `/story-readiness production/epics/dev-tools/story-001-dev-compile-guard.md` to begin implementation.
