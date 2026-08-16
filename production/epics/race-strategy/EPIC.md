# Epic: Race Strategy

> **Layer**: Core
> **GDD**: design/gdd/fuel-system.md + design/gdd/tire-system.md + design/gdd/pit-stop.md
> **Architecture Module**: Fuel & Tire runtime state (kernel steps 5a/5b — `TickStartSnapshot` + `PitServiceCommand[carId]` contract); Pit Stop (step 9b — `CarState[].PitPhase` + pit geometry via `TickStartSnapshot`)
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories race-strategy`
> **Estimate**: 4 stories (~11h active — calibrated 0.3×, sprint-3 retrospective)
> **Session**: S2 · Phase 2 (2-orchestrator plan 2026-08-16)
> **Depends on**: State contracts only (FuelState/TireState already shipped) — NOT the VP implementation; Simulation Kernel steps 5a/5b and 9b seams; ADR-0006 / ADR-0011

## Overview

One vertical epic for the strategic layer (consolidated per PR-EPIC 2026-08-16 — tightly coupled with no independently shippable intermediate): **Fuel** (8.0L fixed tank; fuel_rate = base_rate × throttle × efficiency_modifier; base 0.06 L/s with efficiency_modifier as a Car-Definition-owned tuning knob; +1% top speed below 25%; no consumption during Countdown — begins on first Racing tick after GO; refuel via `PitServiceCommand.active/targetFuel` at 0.8 L/s), **Tire** (continuous linear wear; grip_multiplier = grip_base × (1 − wear_fraction × (1 − grip_floor)); grip floor 0.20; TireCompound ScriptableObject; wear consumes distance/aggression/surface/efficiency/compound multipliers; qualifying disables wear; pit resets via `PitServiceCommand`), and **Pit Stop** (service duration = max(2s, missing_fuel/0.8); tire+fuel parallel; player may exit after tire swap with partial fuel, AI waits for full tank; PitThisLap advisory; VP writes `PitPhase`, Pit writes `PitState`/`PitServiceCommand`; pit transit enforces track speed limit through the assigned one-of-16 pit boxes).

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0006: Fuel/Tire State Ownership and Tick Timing | Fuel/Tire runtime state at steps 5a/5b from `TickStartSnapshot`; consumption/wear per-tick deterministic | LOW |
| ADR-0011: Pit Stop Architecture | Pit service model (max(2s, fuel/0.8), parallel tire+fuel); `PitState`/`PitServiceCommand` ownership; AI full-tank wait | MEDIUM |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-fuel-001 | Fixed 8.0L tank for all cars; fuel_rate = base_rate × throttle × efficiency_modifier | ADR-0006 ✅ |
| TR-fuel-002 | Base rate 0.06 L/s; efficiency_modifier is a tuning knob owned by Car Definition Data | ADR-0006, ADR-0015 ✅ |
| TR-fuel-003 | Low fuel speed bonus: +1% top speed below 25% fuel | ADR-0006 ✅ |
| TR-fuel-004 | No fuel consumption during Countdown; begins on first Racing tick after GO | ADR-0006 ✅ |
| TR-fuel-005 | Refueling reads next-tick PitServiceCommand.active/targetFuel and fills at 0.8 L/s | ADR-0006, ADR-0011 ✅ |
| TR-tire-001 | Continuous linear wear; grip_multiplier = grip_base × (1 − wear_fraction × (1 − grip_floor)) | ADR-0006 ✅ |
| TR-tire-002 | Grip floor 0.20; tire change at pit is binary 2.0s service | ADR-0006, ADR-0011 ✅ |
| TR-tire-003 | TireCompound ScriptableObject: compoundName, gripBase, wearRateMultiplier | ADR-0006 ✅ |
| TR-tire-004 | Wear consumes distance, aggression, surface, efficiency, and compound multipliers from immutable snapshots | ADR-0006 ✅ |
| TR-tire-005 | Qualifying disables wear; pit service resets wear only through PitServiceCommand | ADR-0006, ADR-0013 ✅ |
| TR-pit-001 | Service duration = max(2s, missing_fuel_liters / 0.8 L/s); tire and fuel in parallel | ADR-0011 ✅ |
| TR-pit-002 | Player may exit after tire swap (2s) with partial fuel; AI waits for full tank | ADR-0011 ✅ |
| TR-pit-003 | PitThisLap advisory from min(0.80, max(0, pit_entry_progress − 0.05)) until pit entry | ADR-0011 ✅ |
| TR-pit-004 | Vehicle Physics solely writes PitPhase; Pit Stop writes only PitState and next-tick PitServiceCommand | ADR-0011, ADR-0002 ✅ |
| TR-pit-005 | Pit transit enforces track speed limit and navigates through assigned one-of-16 pit boxes | ADR-0011, ADR-0007 ✅ |

**Untraced requirements**: None — 15/15 covered (`fuel` 5 + `tire` 5 + `pit` 5) by Accepted ADRs.

## Integration Contract

- Steps 5a/5b (Fuel/Tire runtime state) + step 9b (PitStopSystem) — seams published by Simulation Kernel (Integration Contract rows: Fuel/Tire, Pit Stop).
- Consumes `TickStartSnapshot` + `PitServiceCommand[carId]`; publishes FuelState/TireState readout to HUD (ADR-0014) and AI (pit projection, 1.10× margin + no-lap-1/final-lap rules).
- Qualifying integration: no wear, fixed fuel (TR-qual-002/003).

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria of fuel-system.md, tire-system.md, and pit-stop.md are verified
- Fuel/Tire/Pit verified in the dev rig (bridge 3): car consumes/degrades/pits in real motion; HUD telemetry reads correct values
- All Logic and Integration stories have passing test files in `tests/`

## Next Step

Run `/create-stories race-strategy` to break this epic into implementable stories.