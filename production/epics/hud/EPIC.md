# Epic: HUD

> **Layer**: Core + Presentation
> **GDD**: design/gdd/hud.md
> **Architecture Module**: HUD presentation (reads published simulation snapshot + telemetry readout; ADR-0014 data contract and layout)
> **Status**: Ready
> **Stories**: 4 stories created (1 Integration, 3 UI) — see table below
> **Estimate**: 4 stories (~6.5h active — calibrated 0.3×, sprint-3 retrospective)
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

Run `/story-readiness` on the first story to begin implementation.

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | HUD Snapshot Binding Contract | Integration | Ready | ADR-0014 |
| 002 | Chase HUD Presentation | UI | Ready | ADR-0014 |
| 003 | HUD Mode Composition & Accessibility | UI | Ready | ADR-0014 |
| 004 | Contextual HUD Overlays | UI | Ready | ADR-0014 |

*Note: 4 stories (not 3) — QL-STORY-READY 2026-08-16 mandated binding/presentation split; Results rendering moved to UI Menu (TR-ui-003); accessibility mapping blocked on UX spec (race-hud.md In Design).*