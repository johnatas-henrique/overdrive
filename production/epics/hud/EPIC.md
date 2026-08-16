# Epic: HUD

> **Layer**: Core + Presentation
> **GDD**: design/gdd/hud.md
> **Architecture Module**: HUD presentation (reads published simulation snapshot + telemetry readout; ADR-0014 data contract and layout)
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories hud`
> **Estimate**: 3 stories (~8h active — calibrated 0.3×, sprint-3 retrospective)
> **Session**: S2 · Phase 3 (2-orchestrator plan 2026-08-16)
> **Depends on**: vehicle-physics-feel (telemetry readout — speed/gear); race-strategy (Fuel bar, Tire %); race-flow (Position, Lap, Rival Gap); ADR-0014. S2 Phase-3 consumer — data-contract portion may start against contracts before the VP merge completes (bridge 1).

## Overview

The race HUD: 8 chase elements (Speed+Gear, Position, Lap, Fuel Bar, Tire %, Lap Time, Rival Gap, Track Map) + 4 cockpit warning elements; every element readable in under 0.5s at 200+ km/h (max 2 items per glance); team-color theming with auto-contrast fallback (85% opacity Asphalt Black panels); **every HUD element has one authoritative data owner and an explicit update cadence** (ADR-0014); settings toggle may reveal the full chase layout over the cockpit view. Delivered against the published-snapshot readout — the HUD never reads live simulation state.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0014: HUD Data Contract and Layout | Authoritative per-element data owners; explicit update cadence; published-state reads only | LOW |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-hud-001 | 8 chase elements: Speed+Gear, Position, Lap, Fuel Bar, Tire %, Lap Time, Rival Gap, Track Map | ADR-0014 ✅ |
| TR-hud-002 | Every element readable in under 0.5 seconds at 200+ km/h; max 2 items per glance | ADR-0014 ✅ |
| TR-hud-003 | Team color theming with auto-contrast fallback; 85% opacity Asphalt Black panels | ADR-0014 ✅ |
| TR-hud-004 | Every HUD element has one authoritative data owner and an explicit update cadence | ADR-0014 ✅ |
| TR-hud-005 | Cockpit uses a four-element warning layout; settings toggle may reveal the full Chase overlay | ADR-0014, ADR-0004 ✅ |

**Untraced requirements**: None — 5/5 covered by Accepted ADRs.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria of `design/gdd/hud.md` are verified (8 chase + 4 cockpit element counts — CW5 8/4)
- HUD verified in the dev rig with screenshot evidence at 200+ km/h (readability, cadence)
- Fuel/Tire/Lap/Rival data owners verified against race-strategy and race-flow contracts
- All Visual/UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories hud` to break this epic into implementable stories.