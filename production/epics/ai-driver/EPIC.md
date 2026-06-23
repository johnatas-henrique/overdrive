# Epic: AI Driver

> **Layer**: Core (slot #7 — depends on Track + Physics + Collision)
> **GDD**: design/gdd/ai-driver.md
> **Architecture Module**: Core — AI
> **Status**: Ready
> **Stories**: 9 stories (Ready) — see table below

## Overview

7 AI controllers with distinct personality profiles. Spline-based path following: PID + curvature feedforward → steer (-1..1). Same InputState contract as player (steer/throttle/brake/gearDelta) but written via dedicated pipeline slot #3 (double-buffered `Map<string, InputState>`). Overtaking state machine: Normal → Following → Passing → Normal. Deterministic via SeededRandom — same seed, same behavior. 5 difficulty levels (0.75/0.875/1.0/1.125/1.25) multiplying `teamPerformance`. Input suppressed by Pit Stop system during active pit service. Throttle/brake aggression modulated by tireCondition and fuelMult.

## Governing ADRs

| ADR                              | Decision Summary                                                       | Engine Risk |
| -------------------------------- | ---------------------------------------------------------------------- | ----------- |
| ADR-0013: AI Driver Architecture | Spline PID, overtaking FSM, deterministic via LCG, 5 difficulty levels | LOW         |

## GDD Requirements

| TR-ID     | Requirement                                                                           | ADR Coverage |
| --------- | ------------------------------------------------------------------------------------- | ------------ |
| TR-AI-001 | Per-car AI controller with personality (aggression, consistency, risk tolerance)      | ADR-0013 ✅  |
| TR-AI-002 | Spline-based path following — PID + curvature feedforward                             | ADR-0013 ✅  |
| TR-AI-003 | Overtaking state machine: Normal → Following → Passing → Normal                       | ADR-0013 ✅  |
| TR-AI-004 | InputState produced per tick: steer, throttle, brake, gearDelta                       | ADR-0013 ✅  |
| TR-AI-005 | SeededRandom per controller — same seed, same behavior                                | ADR-0013 ✅  |
| TR-AI-006 | Difficulty multiplier (0.75–1.25) × teamPerformance                                   | ADR-0013 ✅  |
| TR-AI-007 | Mistake generation — over/under-braking, missed apex                                  | ADR-0013 ✅  |
| TR-AI-008 | Race strategy awareness — fuel conservation, tire management, pit decision            | ADR-0013 ✅  |
| TR-AI-009 | Defensive driving when being overtaken                                                | ADR-0013 ✅  |
| TR-AI-010 | Input suppressed during active pit stop (by Pit Stop system)                          | ADR-0013 ✅  |
| TR-AI-011 | Rejoin detection — yield if rejoining unsafely                                        | ADR-0013 ✅  |
| TR-AI-012 | Telemetry accessible for debug overlay (personality label, current state, mistakeMag) | ADR-0013 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/ai-driver.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Stories

| #   | Story                                         | Type        | Status | ADR      |
| --- | --------------------------------------------- | ----------- | ------ | -------- |
| 001 | Controller Framework & Input Buffer           | Logic       | Ready  | ADR-0013 |
| 002 | Spline Following (PID Steer & Lateral Offset) | Logic       | Ready  | ADR-0013 |
| 003 | Speed Target & Throttle/Brake Control         | Logic       | Ready  | ADR-0013 |
| 004 | Team Performance Model & Difficulty Scaling   | Logic       | Ready  | ADR-0013 |
| 005 | Overtaking State Machine                      | Logic       | Ready  | ADR-0013 |
| 006 | Mistake Model                                 | Logic       | Ready  | ADR-0013 |
| 007 | Fuel & Tire Awareness                         | Logic       | Ready  | ADR-0013 |
| 008 | Collision Reaction & Rejoin Detection         | Logic       | Ready  | ADR-0013 |
| 009 | AI Telemetry Data Provider                    | Integration | Ready  | ADR-0013 |

## Next Step

Run `/story-readiness production/epics/ai-driver/story-001-controller-framework.md` then `/dev-story` to begin implementation.
