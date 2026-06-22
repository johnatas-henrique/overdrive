# Epic: Fuel

> **Layer**: Core (slot #8 — writes fuelMult to Physics with 1-tick delay)
> **GDD**: design/gdd/fuel.md
> **Architecture Module**: Core — Strategy/Fuel
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories fuel`

## Overview

Fuel consumption model: `fuelUsed = throttleAvg × baseRate × efficiencyRate × fixedDt`. Writes `fuelMult = max(0.0, fuelLevel / maxCapacity)` to Physics with 1-tick delay. Lift-and-coast: `throttle_avg = 0` means zero consumption — refuels while coasting. Pit Stop is the sole external writer via `addFuel(carId, liters)`. Emits `car.fuel_empty` when fuelLevel <= 0.

## Governing ADRs

| ADR                  | Decision Summary                                              | Engine Risk |
| -------------------- | ------------------------------------------------------------- | ----------- |
| ADR-0011: Fuel Model | throttleAvg × rate, fuelMult to Physics, Pit Stop sole writer | LOW         |

## GDD Requirements

| TR-ID       | Requirement                                                                    | ADR Coverage |
| ----------- | ------------------------------------------------------------------------------ | ------------ |
| TR-FUEL-001 | Fuel consumption per tick: throttleAvg × baseRate × efficiencyRate × fixedDt   | ADR-0011 ✅  |
| TR-FUEL-002 | fuelMult = max(0.0, fuelLevel / maxCapacity) sent to Physics with 1-tick delay | ADR-0011 ✅  |
| TR-FUEL-003 | Lift-and-coast — zero throttle = zero consumption                              | ADR-0011 ✅  |
| TR-FUEL-004 | Pit Stop sole external writer via addFuel(carId, liters)                       | ADR-0011 ✅  |
| TR-FUEL-005 | Emit car.fuel_empty when fuelLevel <= 0                                        | ADR-0011 ✅  |
| TR-FUEL-006 | Fuel economy stat configurable per team                                        | ADR-0011 ✅  |
| TR-FUEL-007 | Tank capacity configurable per team                                            | ADR-0011 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/fuel.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories fuel` to break this epic into implementable stories.
