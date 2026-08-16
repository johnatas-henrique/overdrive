# Epic: Race Flow

> **Layer**: Core
> **GDD**: design/gdd/race-session-manager.md + design/gdd/qualifying.md + design/gdd/grid-start.md
> **Architecture Module**: Race Session Manager (kernel steps 9/10 — `RsmEvaluationStep`/`RsmConsumeStep`), Qualifying (RaceMode.Qualifying), Grid & Start (GoStep + Perfect Start)
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories race-flow`
> **Estimate**: 5 stories (~13h active — calibrated 0.3×, sprint-3 retrospective)
> **Session**: S1 · Phase 2 (2-orchestrator plan 2026-08-16)
> **Depends on**: vehicle-physics (dynamics + feel — sim must produce car state for session transitions); Simulation Kernel (steps 9/10 seams, RaceMode authority); ADR-0018 / ADR-0013

## Overview

One vertical epic for the session-to-session flow (consolidated per PR-EPIC 2026-08-16 — the three GDDs are a tightly coupled sequential player flow with no independently shippable intermediate). Delivers: **Race Session Manager** authority (ranking `lapCount DESC, splinePosition DESC, positionEntryStep ASC, carId ASC`, lap detection via 90% anti-cut, FinishOrderResolver, result classification Finished/DNF/Forfeit, immutable GridAssignment carried through qualifying→race reconfiguration, transition requests while Simulation remains sole state-machine writer), **Qualifying** (single flying lap, no retry, RaceMode.Qualifying within Racing, skip→P16, pre-generated AI times, fixed fuel load, no tire wear, pit-box spawn + out-lap), and **Grid & Start** (16-car 2-wide formation, Perfect Start arming GO-12..GO-1, 1.15×drive force 600 ticks, five one-second countdown lights, Qualifying Results Confirm-only no-timeout screen).

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0018: Race Session Manager Authority — Ranking, Lap Authority, and Finish Resolution | RSM owns ranking/lap/finish; emits transition requests; Simulation remains state-machine writer; PublishStep final publication | MEDIUM |
| ADR-0013: Qualifying Session Format | Single flying lap; RaceMode.Qualifying within Racing; Countdown bypass; mandatory pit-box spawn + untimed out-lap; pre-generated AI times | LOW |
| ADR-0001 (step 10/12 contract) | RSM evaluation/consume at spine 9/10; step 12 publication after RsmConsume (documented 2026-08-15) | HIGH |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-rsm-001 | Position ranking: lapCount DESC, splinePosition DESC, positionEntryStep ASC, carId ASC | ADR-0018 ✅ |
| TR-rsm-002 | Lap detection: CrossedLapBoundary AND distanceSinceLastLap > trackLength × 0.90 | ADR-0018 ✅ |
| TR-rsm-003 | FinishOrderResolver reads PostFinishSnapshot once; projects unfinished AI by pace-only | ADR-0018 ✅ |
| TR-rsm-004 | Result classification Finished/DNF/Forfeit; no fabricated position for Forfeit | ADR-0018 ✅ |
| TR-rsm-005 | RSM emits transition requests while Simulation remains the sole state-machine writer | ADR-0018, ADR-0001 ✅ |
| TR-rsm-006 | RSM owns immutable GridAssignment; carried through qualifying-to-race reconfiguration | ADR-0018, ADR-0013 ✅ |
| TR-qual-001 | Single flying lap; no retry; RaceMode.Qualifying within Racing | ADR-0013 ✅ |
| TR-qual-002 | Qualifying fuel load = min(8.0L, fuel_rate × reference_flying_lap_time × 1.10) | ADR-0013 ✅ |
| TR-qual-003 | No tire wear during qualifying; tires at 100% grip | ADR-0013 ✅ |
| TR-qual-004 | Single flying lap format: one chance, no retry; enters Racing directly (no Countdown) | ADR-0013 ✅ |
| TR-qual-005 | Skip/fail → P16 grid position, no retry; AI times pre-generated | ADR-0013 ✅ |
| TR-qual-006 | Tier order not preserved; cross-tier outqualification allowed by DifficultyProfile | ADR-0013 ✅ |
| TR-qual-007 | Player spawns in pit box, untimed out-lap, times exactly one start-line-to-finish flying lap | ADR-0013 ✅ |
| TR-qual-008 | RSM creates immutable GridAssignment by ascending time with stable carId tie-break | ADR-0013, ADR-0018 ✅ |
| TR-grid-001 | 16 cars in 2-wide formation; column stagger depends on first corner direction | ADR-0018 ✅ |
| TR-grid-002 | Perfect Start: rawAcceleratePostDeadZone > 0.5 AND rawBrakePostDeadZone == 0 from GO-12 through GO | ADR-0018 ✅ |
| TR-grid-003 | perfectStartDriveForceMultiplier = 1.15 for 600 ticks post-GO | ADR-0018 ✅ |
| TR-grid-004 | Countdown: five one-second lights over 300 ticks while driving input advances behind | ADR-0018, ADR-0013 ✅ |
| TR-grid-005 | Qualifying Results permits Confirm only; no timeout/Back/Cancel; no generic dialogs | ADR-0018 ✅ |

**Untraced requirements**: None — 19/19 covered (`rsm` 6 + `qual` 8 + `grid` 5) by Accepted ADRs.

## Integration Contract

- Steps 9/10 (`RsmEvaluationStep`/`RsmConsumeStep`) + step 12 publication — seams published by Simulation Kernel (Integration Contract row: RSM).
- Qualifying bypasses Countdown (kernel delivers Countdown; Qualifying bypass verified with this epic per kernel story-003).
- GridAssignment consumed by Content (RaceContentSelection / grid spawn) and by Qualifying Results presentation (ADR-0019).

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria of race-session-manager.md, qualifying.md, and grid-start.md are verified
- Finish resolution verified end-to-end: qualifying → GridAssignment → race → finish order → results classification (Flawed/Finished/DNF/Forfeit)
- All Logic and Integration stories have passing test files in `tests/`
- Qualifying Results screen flow verified with UI Menu epic (ADR-0019 navigation contract)

## Next Step

Run `/create-stories race-flow` to break this epic into implementable stories.