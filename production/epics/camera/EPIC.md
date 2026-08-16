# Epic: Camera

> **Layer**: Core + Presentation
> **GDD**: design/gdd/camera.md
> **Architecture Module**: Camera presentation (reads interpolated snapshot state — `CarState` pose + velocity direction; ADR-0010 rendering budget)
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories camera`
> **Estimate**: 2 stories (~5h active — calibrated 0.3×, sprint-3 retrospective)
> **Session**: S2 · Phase 3 (2-orchestrator plan 2026-08-16)
> **Depends on**: vehicle-physics-feel (telemetry readout contract — pose + velocity direction); ADR-0010; render interpolation (kernel story-006). S2 Phase-3 consumer — enters after the VP merge.

## Overview

The cockpit-primary, chase-secondary camera system: 0.35s transitions between views; SphereCast collision avoidance; 3-layer shake (Speed Vibration, Surface, Impact) clamped to 3.0 degrees total; FOV (Cockpit 78-95° quadratic, Chase 70-90°; Reduced Motion suppresses dynamic FOV); **chase look-ahead follows the velocity direction** (velocityDirection × speed × lookAheadFactor — the prototype-validated model per ADR-0010 and camera.md/CW1); PitCamera and terminal three-quarter presentation consume interpolated snapshot state without driving gameplay. Renders through the dev playtest rig (bridge 3): the rig's camera IS this epic's integration point until the UI Menu production composition.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0010: Camera/VFX Rendering Budget and Interpolation | Camera follows velocity direction (drift visible); interpolated snapshot consumption; performance budget integration | MEDIUM |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-camera-001 | Cockpit primary, Chase secondary; 0.35s transitions; SphereCast collision avoidance | ADR-0010 ✅ |
| TR-camera-002 | 3-layer shake (Speed Vibration, Surface, Impact) clamped to 3.0 degrees total | ADR-0010 ✅ |
| TR-camera-003 | FOV: Cockpit 78-95° quadratic; Chase 70-90°; Reduced Motion suppresses dynamic FOV | ADR-0010 ✅ |
| TR-camera-004 | Chase look-ahead follows velocity direction (velocityDirection × speed × lookAheadFactor) | ADR-0010 ✅ |
| TR-camera-005 | PitCamera and terminal three-quarter presentation consume interpolated snapshot state | ADR-0010 ✅ |

**Untraced requirements**: None — 5/5 covered by Accepted ADRs.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria of `design/gdd/camera.md` are verified
- Cockpit/chase verified in the dev rig with screenshot evidence (drift visible — camera follows velocity, not heading)
- Shake/FOV/reduced-motion verified visually; collision avoidance verified in a rig scenario
- All Visual/Feel stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories camera` to break this epic into implementable stories.