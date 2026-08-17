# Epic: Vehicle Physics — Dynamics

> **Layer**: Core
> **GDD**: design/gdd/vehicle-physics.md
> **Architecture Module**: Vehicle Physics (Simulation step 6 — `PhysicsSimulateStep` per Simulation Kernel Integration Contract; `RigidbodyVehicleDriver` implementing `IVehicleDriver`)
> **Status**: Ready
> **Stories**: 5 stories created (3 Logic, 2 Integration) — see table below
> **Estimate**: 5 stories (~8.5h active — calibrated 0.3×, sprint-3 retrospective)
> **Session**: S1 · Phase 1 (2-orchestrator plan 2026-08-16)
> **Depends on**: Simulation Kernel (spine + `CarState` / `ResolvedCarInput[carId]` + `FIXED_DT` seam); Car Definition stat contract (prototype-validated — not the 16 teams); Gameplay & Physics ADR-0002

## Overview

The deterministic core of the car: the physics integration cell at spine step 6 of the 14-step pipeline. This epic delivers the force-generation and state-propagating machinery — grip stack application, `CarState` production every tick, the `IVehicleDriver` seam (Rigidbody-backed for MVP, DOTS-eligible), wall bounce with cooldown, and car-to-car contact semantics — all deterministic per ADR-0001 rules (PCG32, Unity.Mathematics, no `UnityEngine.Random`). **Tuning values are NOT this epic's stories**: the validated feel values (lift-off bonus, steering falloff, drift factor) are owned by the Feel split (vehicle-physics-feel).

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0002: Vehicle Physics Implementation Pattern | `Rigidbody.interpolation = None` + LateUpdate manual interpolation; deterministic forces at Step 6; `IVehicleDriver` seam for future DOTS migration | HIGH |
| ADR-0001: Manual Simulation Authority and Determinism Boundary | Sole-writer authority; one `Physics.Simulate(FIXED_DT)` per tick; determinism rules (PCG32, Unity.Mathematics) | HIGH |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-vp-001 | Grip stack multiplicative: effective_grip = clamp(grip_base × surface × tire, 0.20, 1.20) | ADR-0002 ✅ |
| TR-vp-002 | CarState produced every tick: Position (float3), Rotation (quaternion), linear/angular velocity | ADR-0002, ADR-0001 ✅ |
| TR-vp-003 | IVehicleDriver interface for future DOTS migration; MVP uses RigidbodyVehicleDriver | ADR-0002 ✅ |
| TR-vp-004 | Wall bounce angle ≤ 30°; WallHit cooldown 0.2-0.5s; repeated bounce impulse reduction | ADR-0002 ✅ |
| TR-vp-006 | Steering uses min(steerCeiling(v), v/minTurnRadius, gripCeiling) with speed falloff | ADR-0002 ✅ |
| TR-vp-010 | Car-to-car contact: 15-25% speed loss, push impulse, repeated-contact cooldown | ADR-0002 ✅ |

**TR partition note**: TR-vp-005/007/008/009 (validated feel tuning) belong to `vehicle-physics-feel`. If `/create-stories` finds a better split, it may re-partition the 10 TR-vp-* entries across the two Vehicle Physics epics — the boundary is the Determinism/math cell vs the validated-taste cell.

**Untraced requirements**: None — 6/6 covered by Accepted ADRs (10/10 across both VP epics).

## Integration Contract

- Pipeline step 6 (`PhysicsSimulateStep`) — seam published by Simulation Kernel; player and AI cars share the same vehicle path per TR-ai-006.
- Consumes `ResolvedCarInput[carId]` + `FIXED_DT`; publishes `CarState[carId]` readout contract consumed by readout, RSM, presentation consumers.
- `CarState.Physics` fields reserved for Fuel (5a/5b), Tire (5a/5b), Pit (`PitPhase`) writers per the Kernel Integration Contract.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria of the dynamics subset of `design/gdd/vehicle-physics.md` are verified (grip stack, contact, bounce, CarState contract)
- All Logic and Integration stories have passing test files in `tests/`
- Determinism verified: same seed + same input → identical `CarState` sequence (companion to simulation-kernel story-008 harness)
- The `IVehicleDriver` seam is published with a documented contract; RigidbodyVehicleDriver is the MVP implementation
- Handoff to `vehicle-physics-feel` is ready: stable `CarState`/telemetry readout exists for the feel/rig phase

## Next Step

Run `/story-readiness` on the first story to begin implementation.

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Grip Stack & CarState Contract | Logic | Ready | ADR-0002 |
| 002 | Vehicle Driver Seam | Integration | Ready | ADR-0002 |
| 003 | Longitudinal Movement & Step-6 Integration | Integration | Ready | ADR-0002 |
| 004 | Steering Model (1-state) | Logic | Ready | ADR-0002 |
| 005 | Wall Contact & Car-to-Car | Integration | Ready | ADR-0002 |

*Note: 5 stories (not 4) — QL-STORY-READY 2026-08-16 mandated splitting the driver/movement story (002/003).*