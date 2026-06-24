# Epic: Physics / Handling

> **Layer**: Core (slot #4 — bottleneck system, 15+ dependents)
> **GDD**: design/gdd/physics-handling.md
> **Architecture Module**: Core — Physics
> **Status**: Ready
> **Stories**: 5 stories (Ready) — run `/story-readiness production/epics/physics-handling/story-001-physics-core-skeleton.md`

## Overview

Arcade Dynamic physics: 1 DYNAMIC PhysicsBody per car (convex hull, 800kg). No wheel bodies, no suspension, no joints. Three-phase pipeline execution within slot #2: Phase 1 (arcade grip model computes target speed/yaw), Phase 2 (Havok `executeStep` resolves collision impulses), Phase 3 (velocity override snaps to arcade speed, collision position delta preserved). Grip formula: `gripMax = baseGrip × cornerStat × tireCondition × speedMod`. `setLocked(carId)` for grid start and pit stop. `setPit(carId)` for pit limiter. `fuelMult`/`tireCondition` with 1-tick delay. Edge-triggered `car.stopped` event. Auto-shift + manual gear override.

## Governing ADRs

| ADR                       | Decision Summary                                                           | Engine Risk |
| ------------------------- | -------------------------------------------------------------------------- | ----------- |
| ADR-0008: Vehicle Physics | Arcade Dynamic — 1 DYNAMIC body, 3-phase, velocity override, no suspension | MEDIUM      |

## GDD Requirements

| TR-ID          | Requirement                                                                        | ADR Coverage |
| -------------- | ---------------------------------------------------------------------------------- | ------------ |
| TR-PHYSICS-001 | Arcade grip model: gripMax = baseGrip × cornerStat × tireCondition × speedMod      | ADR-0008 ✅  |
| TR-PHYSICS-002 | 1 DYNAMIC PhysicsBody per car; no wheel bodies, no suspension                      | ADR-0008 ✅  |
| TR-PHYSICS-003 | Post-step velocity override — preserves collision position delta                   | ADR-0008 ✅  |
| TR-PHYSICS-004 | Consume InputState: steer/throttle/brake/gearDelta; output speed/rpm/gear/lateralG | ADR-0008 ✅  |
| TR-PHYSICS-005 | setLocked(carId, bool) — grid start and pit stop lock                              | ADR-0008 ✅  |
| TR-PHYSICS-006 | setPit(carId, bool) — pit lane speed enforcement                                   | ADR-0008 ✅  |
| TR-PHYSICS-007 | fuelMult (0..1) scales engine power linearly                                       | ADR-0008 ✅  |
| TR-PHYSICS-008 | tireCondition (0..1) scales gripMax proportionally                                 | ADR-0008 ✅  |
| TR-PHYSICS-009 | Edge-triggered events: car.tire_blown, car.fuel_empty, car.stopped                 | ADR-0008 ✅  |
| TR-PHYSICS-010 | Auto-shift + manual gearDelta override; configurable ratios                        | ADR-0008 ✅  |

## Stories

| #   | Story                                                                                         | Type        | Status | ADR      |
| --- | --------------------------------------------------------------------------------------------- | ----------- | ------ | -------- |
| 001 | Physics Core Skeleton — Havok init, pipeline slot, 3-phase skeleton, ground tracking          | Integration | Ready  | ADR-0008 |
| 002 | Arcade Grip Model — gripMax, steering clamp, lift-off oversteer, understeer, telemetry        | Logic       | Ready  | ADR-0008 |
| 003 | Engine, Gears, Drag, Braking — auto-shift, manual override, RPM, power, elevation, coast      | Logic       | Ready  | ADR-0008 |
| 004 | Surface Handling — off-track grip/friction/min-speed, kerb 2-tick timer, telemetry flags      | Logic       | Ready  | ADR-0008 |
| 005 | Lock, Pit, External Inputs & Edge Events — setLocked, setPit, fuelMult, tireCondition, events | Integration | Ready  | ADR-0008 |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/physics-handling.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/story-readiness production/epics/physics-handling/story-001-physics-core-skeleton.md` to begin implementation.
