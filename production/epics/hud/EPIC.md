# Epic: HUD

> **Layer**: Presentation (slot #14 — renders race data, depends on RM + Physics + Fuel + Tire)
> **GDD**: design/gdd/hud.md
> **Architecture Module**: Presentation — HUD
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories hud`

## Overview

Single `AdvancedDynamicTexture` with `idealHeight=1080`. Grid layout uses `widthFraction` (not `ParameterType.Star` — unsupported in Babylon.js GUI Grid). Create-once/toggle-visibility pattern — all controls created at init, `isVisible` toggled per screen. `HudAnimator` with `HudAnimStyle` enum (`mechanical` default for Phase 1). SpeedBlock at 20Hz via throttled Event Bus (fallback to direct read if jittery). Event-driven for all blocks (SpeedBlock is the only throttled reader). Pit overlay replaces HUD during pit stop via visibility group. Zone-based layout: left zone (speed, lap, pos), center zone (minimap, steering wheel), right zone (fuel, tires, delta).

## Governing ADRs

| ADR                           | Decision Summary                                                                      | Engine Risk |
| ----------------------------- | ------------------------------------------------------------------------------------- | ----------- |
| ADR-0018: HUD Layout & Blocks | ADT idealHeight=1080, Grid widthFraction, create-once/toggle-visibility, event-driven | LOW         |

## GDD Requirements

| TR-ID      | Requirement                                                                   | ADR Coverage |
| ---------- | ----------------------------------------------------------------------------- | ------------ |
| TR-HUD-001 | Single ADT with idealHeight=1080, responsive to 16:9/ultrawide                | ADR-0018 ✅  |
| TR-HUD-002 | Zone-based layout: left (speed/lap/pos), center (minimap), right (fuel/tires) | ADR-0018 ✅  |
| TR-HUD-003 | HudBlock interface: container, update(state), show/hide                       | ADR-0018 ✅  |
| TR-HUD-004 | Speed block: numeric speed + RPM bar                                          | ADR-0018 ✅  |
| TR-HUD-005 | Lap/position block: current lap, total laps, position with delta              | ADR-0018 ✅  |
| TR-HUD-006 | Fuel block: fuel gauge (progressive bar)                                      | ADR-0018 ✅  |
| TR-HUD-007 | Tire block: tire condition (integrated bar with color transitions)            | ADR-0018 ✅  |
| TR-HUD-008 | Minimap — top-down track with car positions                                   | ADR-0018 ✅  |
| TR-HUD-009 | Pit overlay replaces HUD during pit stop (visibility group)                   | ADR-0018 ✅  |
| TR-HUD-010 | Event-driven updates — no per-system polling                                  | ADR-0018 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/hud.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories hud` to break this epic into implementable stories.
