# Epic: AI Rival

> **Layer**: Core
> **GDD**: design/gdd/ai-rival.md
> **Architecture Module**: AI Rival (kernel step 13 AI cache — reads `PublishedSimulationSnapshot` read-only, writes cached `AIInput` for the next tick per the Simulation Kernel Integration Contract)
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories ai-rival`
> **Estimate**: 4 stories (~10h active — calibrated 0.3×, sprint-3 retrospective)
> **Session**: S1 · Phase 3 (2-orchestrator plan 2026-08-16)
> **Depends on**: vehicle-physics (AI uses the same physics path per TR-ai-006); Track (splines for pace/navigation); Car Definition Data (per-archetype stats); Simulation Kernel (AiSkipStep=12 + published snapshot seam); ADR-0009

## Overview

The 16 opponents with distinct personalities, deterministic per ADR-0009 and ADR-0001: counter-based noise keyed by race seed, car ID, simulation step, and slot ID; four archetypes (Consistent, Aggressive, Inconsistent, Cautious) with specific error parameters; pit projection with 1.10× resource margin (never before lap 1 or the final lap); reads only the published snapshot, writes cached AIInput; target speed combined from base, state, personality, pace-noise, and error-noise factors; same Vehicle Physics path as the player; no active obstacle avoidance in MVP.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0009: AI Rival Deterministic Architecture | Counter-based deterministic noise; reads published snapshot only; same physics path; no active avoidance in MVP | MEDIUM |
| ADR-0001: Manual Simulation Authority and Determinism Boundary | AI cache step (13) writes next-tick input; determinism rules apply | HIGH |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-ai-001 | Deterministic counter-based AI noise keyed by race seed, car ID, simulation step, slot ID | ADR-0009 ✅ |
| TR-ai-002 | 4 archetypes: Consistent, Aggressive, Inconsistent, Cautious with specific error parameters | ADR-0009 ✅ |
| TR-ai-003 | AI pit projection uses 1.10× resource margin; never pits before lap 1 or final lap | ADR-0009 ✅ |
| TR-ai-004 | AI reads only published snapshot; writes cached AIInput for next tick | ADR-0009, ADR-0001 ✅ |
| TR-ai-005 | Target speed combines base, state, personality, pace-noise, and error-noise factors | ADR-0009 ✅ |
| TR-ai-006 | AI uses the same Vehicle Physics path as the player; no active obstacle avoidance in MVP | ADR-0009 ✅ |

**Untraced requirements**: None — 6/6 covered by Accepted ADRs.

## Integration Contract

- Kernel step 13 (AI cache) — seam published by Simulation Kernel (Integration Contract row: AI Rival). Player is `AiSkipStep`-skipped; 15 AI cars run this path.
- AI shares `ResolvedCarInput[carId]` + `CarState[]` with the player (TR-ai-006).
- Grid populated from GridAssignment (race-flow epic); AI slots map to the 16 car definitions (car-definition-data epic) for stats/archetypes.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria of `design/gdd/ai-rival.md` are verified (16 personalities, perception)
- Personality differentiation is playtest-verified (player recognition, not just parameter variance — high-risk system per systems-index:109)
- Determinism verified in the replay harness (same seed → same AI input sequence)
- All Logic and Integration stories have passing test files in `tests/`

## Next Step

Run `/create-stories ai-rival` to break this epic into implementable stories.