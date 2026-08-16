# Epic: Car Definition Data

> **Layer**: Core
> **GDD**: design/gdd/car-definition-data.md
> **Architecture Module**: Car Definition data pipeline (CarDefinition Addressable content — AddressableKeys.CarDefinition already shipped; stat→behavior mapping)
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories car-definition-data`
> **Estimate**: 3 stories (~8h active — calibrated 0.3×, sprint-3 retrospective)
> **Session**: S2 · Phase 1 (2-orchestrator plan 2026-08-16)
> **Depends on**: Nothing (data + validation, independent); statistics already validated in the race-feel prototype (1989 F1 values → entities.yaml, 2026-08-04); ADR-0015. Stat CONTRACT ships first so VP can consume behavior mapping.

## Overview

The 16 F1 teams (one car each) as data with validated stats: six integer stats in [0,20] (TS/AC/GR/ST/BR — real 1989 F1 values from the prototype) with constant 505 kg weight; stat-to-behavior formulas (max_velocity 300 + TS×2, t300 acceleration metric, brake_distance, etc.); load-time validation (clamp out-of-range to nearest integer with warning) and authoring-time differentiation check (no duplicate stat profiles); CarDefinition stores stats, structured audio profile (CarAudioProfile — consumed by the Audio epic), opaque team color, and cockpit offset. The stat contract (shape + formulas) is a phase-1 deliverable so the VP epic can consume it without the full 16 teams.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0015: Car Definition Data Validation | Six integer stats [0,20]; load-time clamp-with-warning; authoring-time differentiation check; stat→behavior formulas | LOW |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-car-001 | 16 teams with 6 integer stats in [0,20]; weight constant 505 kg | ADR-0015 ✅ |
| TR-car-002 | Stat-to-behavior formulas (max_velocity 300 + TS×2, t300 acceleration metric, brake_distance, …) | ADR-0015 ✅ |
| TR-car-003 | Load-time stat validation: clamp out-of-range to nearest integer in [0,20] with warning | ADR-0015 ✅ |
| TR-car-004 | Authoring-time differentiation check: team stats must differ (no duplicate profiles) | ADR-0015 ✅ |
| TR-car-005 | CarDefinition stores stats, structured audio profile, opaque team color, cockpit offset | ADR-0015 ✅ |

**Untraced requirements**: None — 5/5 covered by Accepted ADRs.

## Deliverables (this epic)

1. Stat contract: shape + behavior formulas (consumed by VP dynamics early — bridge to Session-1).
2. CarDefinition data model + load-time validator + authoring-time differentiation check.
3. 16 team definitions (real 1989 F1 stat sets from entities.yaml) as Addressable CarDefinition assets (topology: 16 Cars groups).
4. CarAudioProfile + opaque team color + cockpit offset fields per TR-car-005.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria of `design/gdd/car-definition-data.md` are verified
- 16 CarDefinition assets load via Addressables with correct validation behavior (clamp + differentiate)
- Stat contract consumed by the VP epic (behavior mapping verified in-rig)
- All Logic and Integration stories have passing test files in `tests/`

## Next Step

Run `/create-stories car-definition-data` to break this epic into implementable stories.