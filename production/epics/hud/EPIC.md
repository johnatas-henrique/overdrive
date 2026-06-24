# Epic: HUD

> **Layer**: Presentation (slot #14 — renders race data, depends on RM + Physics + Fuel + Tire)
> **GDD**: design/gdd/hud.md
> **Architecture Module**: Presentation — HUD
> **Status**: Ready
> **Stories**: 12 stories — see table below

## Overview

Single `AdvancedDynamicTexture` with `idealHeight=1080`. Grid layout uses `widthFraction` (not `ParameterType.Star` — unsupported in Babylon.js GUI Grid). Create-once/toggle-visibility pattern — all controls created at init, `isVisible` toggled per screen. `HudAnimator` with `HudAnimStyle` enum (`mechanical` default for Phase 1). SpeedBlock at 20Hz via throttled Event Bus (fallback to direct read if jittery). Event-driven for all blocks (SpeedBlock is the only throttled reader). Pit overlay replaces HUD during pit stop via visibility group. Zone-based layout: left zone (speed, lap, pos), center zone (minimap, steering wheel), right zone (fuel, tires, delta).

## Governing ADRs

| ADR                           | Decision Summary                                                                      | Engine Risk |
| ----------------------------- | ------------------------------------------------------------------------------------- | ----------- |
| ADR-0018: HUD Layout & Blocks | ADT idealHeight=1080, Grid widthFraction, create-once/toggle-visibility, event-driven | LOW         |

## GDD Requirements

| TR-ID      | Requirement                                                                                     | ADR Coverage |
| ---------- | ----------------------------------------------------------------------------------------------- | ------------ |
| TR-HUD-001 | Single ADT with idealHeight=1080, responsive to 16:9/ultrawide. Zone-based widthFraction        | ADR-0018 ✅  |
| TR-HUD-002 | HUD data driven by Event Bus subscriptions + direct physics reads (speed); 20Hz throttle        | ADR-0018 ✅  |
| TR-HUD-003 | Modular HudBlock interface: onActivate/onDeactivate/dispose; repositionable via HudConfig       | ADR-0018 ✅  |
| TR-HUD-004 | ResourcesBlock throttled to ~6 updates/s. Critical fuel ≤15% pulses red, tire ≤20% red          | ADR-0018 ✅  |
| TR-HUD-005 | HUD lifecycle tied to GSM: activate on Racing, deactivate on PostRace. PitOverlay on pit        | ADR-0018 ✅  |
| TR-HUD-006 | HudConfig via hud.\* namespace with HMR. Zone widths, visibility, sizes apply within 1 tick     | ADR-0018 ✅  |
| TR-HUD-007 | All animations mechanical — no smooth fades. Configurable per-block via HudAnimStyle            | ADR-0018 ✅  |
| TR-HUD-008 | Minimap — top-down track outline polyline with car positions                                    | ADR-0018 ✅  |
| TR-HUD-009 | Countdown sequence display — 5 back-to-front lights at 1s intervals via LIGHT_INTERVAL_TICKS=60 | ADR-0018 ✅  |
| TR-HUD-010 | Alert block with priority display (max 2, FIFO). Device hint overlay on device switch           | ADR-0018 ✅  |
| TR-HUD-011 | Pit overlay block: tire status, fuel progress bar. Exit after tires done. HUD behind overlay    | ADR-0018 ✅  |
| TR-HUD-012 | Race end overlays — DNF (position frozen, reason) and Checkered (slow-motion, freeze)           | ADR-0018 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/hud.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Stories

| #   | Story                               | Type        | Status | ADR      |
| --- | ----------------------------------- | ----------- | ------ | -------- |
| 001 | HudAnimator                         | Logic       | Ready  | ADR-0018 |
| 002 | HudBlock Interface & HudConfig      | Logic       | Ready  | ADR-0018 |
| 003 | HudManager — Init, Grid & Lifecycle | UI          | Ready  | ADR-0018 |
| 004 | SpeedBlock                          | UI          | Ready  | ADR-0018 |
| 005 | LapBlock & PositionBlock            | UI          | Ready  | ADR-0018 |
| 006 | GapInfoBlock & LapTimesBlock        | UI          | Ready  | ADR-0018 |
| 007 | ResourcesBlock                      | UI          | Ready  | ADR-0018 |
| 008 | MinimapBlock                        | Visual/Feel | Ready  | ADR-0018 |
| 009 | CountdownBlock                      | Visual/Feel | Ready  | ADR-0018 |
| 010 | AlertBlock & DeviceHint             | UI          | Ready  | ADR-0018 |
| 011 | PitOverlayBlock                     | UI          | Ready  | ADR-0018 |
| 012 | RaceEndOverlays (DNF + Checkered)   | UI          | Ready  | ADR-0018 |

## Next Step

Run `/story-readiness production/epics/hud/story-001-hud-animator.md` to begin implementation, or implement stories in order (001 → 002 → 003 → 004-012 in any order after 003).
