# Story 001: Fuel System

> **Epic**: Race Strategy
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 2.0h

## Context

**GDD**: `design/gdd/fuel-system.md`
**Requirement**: `TR-fuel-001..005`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0006: Fuel/Tire State Ownership and Tick Timing
**ADR Decision Summary**: FuelSystem (pure C#) at Step 5a: `fuel_rate = 0.06 × throttle × efficiency_modifier` (efficiency consumed once at race init from CarDefinition.Stats.Efficiency → 1 − stat × 0.025: Eff4 → 0.9, Eff20 → 0.5). FuelState { currentFuel 0-8.0, fuelFraction, state Full/Conserving/Critical/Empty, topSpeedModifier, lastLapFuelUse, lowFuelActive }. Countdown/non-Racing gating via the `state` param. Pit mode: refuel 0.8 L/s toward targetFuel via TickStartSnapshot.PitServiceCommand (no drain during service). **Low-fuel discrepancy resolved (2026-08-16 gate): ADR-0006 governs — `fuelFraction < 0.25 → topSpeedModifier = 1.01`, else 1.00; the GDD "0.6% at 10%" criterion is SUPERSEDED.** Depletion benchmarks: numeric fixed-tick fixtures (Eff4 full throttle: 8/0.054 = 148.148s; Eff20: 8/0.030 = 266.667s; Eff20 50%: 8/0.015 = 533.333s) — lap placement is a simulation/rig integration.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C# — no Unity APIs (EditMode test: no Unity API calls in FuelSystem).

**Control Manifest Rules (this layer)**:
- Required: `fuel_rate = 0.06 × throttle × efficiency_modifier`; low-fuel bonus 1.01 < 25%
- Required: Countdown gating; pit refuel 0.8 L/s; no drain during service
- Forbidden: Fuel must never write CarState fields; no stateful RNG

---

## Acceptance Criteria

*From ADR-0006 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] At race init, the validated efficiency modifier is consumed once (Eff4 → 0.9, Eff20 → 0.5)
- [ ] `fuelRate = 0.06 × throttle × efficiencyModifier`; state output: currentFuel clamped 0..8.0, fuelFraction, state, low-fuel modifier, lastLapFuelUse
- [ ] Countdown/non-Racing ticks do not change fuel (300-tick countdown → unchanged)
- [ ] Active PitServiceCommand refills toward targetFuel at 0.8 L/s; no consumption concurrently
- [ ] `LapCompleted` consumer updates `lastLapFuelUse` once, clamped non-negative
- [ ] State thresholds: 50.1→49.9 Conserving; 25.1→24.9 Critical; exactly 50%/25% remain the prior state; zero → Empty
- [ ] Same initial state + same input sequence → identical output (determinism)
- [ ] Numeric depletion fixtures: Eff4 full throttle ≈ 148.148s to empty; Eff20 ≈ 266.667s; Eff20 at 50% throttle survives 5 × 75s fixture

---

## Implementation Notes

*Derived from ADR-0006 Implementation Guidelines:*

- Fuel consumes `ResolvedCarInput[carId]` throttle at Step 5a, before physics (Step 6)
- Pit mode is gated by `TickStartSnapshot.PitServiceCommand[carId].active`, NOT by CarState.PitPhase
- `lastLapFuelUse` is updated via RSM LapCompleted (Step 10) — not per-tick
- No acceleration/braking at empty fuel, 505 kg mass, HUD colors, critical stinger → their owning epics (VP/CarDef/HUD/Audio)
- Raw corrupted Efficiency handling → Car Definition validation (Fuel consumes the validated result)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [vehicle-physics epic]: no-accel-at-empty, mass
- [hud/audio epics]: fuel bar colors, critical stinger
- [car-definition-data]: efficiency stat validation

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (formula)**: 8.0L, Eff modifier 0.9, throttle 1.0, dt 1.0 → decreases 0.054L; edge: throttle 0/clamped, zero dt, near empty
- **AC-2 (thresholds)**: 50.1→49.9 Conserving; edge: exactly 50% stays, 25.1→24.9 Critical, exactly 25% stays, zero Empty
- **AC-3 (low-fuel)**: 24.99%/10%/0% → topSpeedModifier 1.01; edge: 25.00% → 1.00; no linear 0.6% ramp
- **AC-4 (countdown)**: 300 Countdown ticks → unchanged; edge: Loading/Paused/Finished, first Racing tick begins consumption
- **AC-5 (pit refuel)**: 4.0L + active command target 8.0 → 2s service → 5.6L ±0.01; edge: target reached, active false, no drain during service
- **AC-6 (LapCompleted)**: lastLapFuelUse = max(0, prev − current) once; edge: pit refill apparent increase, duplicate event, zero consumption
- **AC-7 (determinism)**: identical states+inputs → all FuelState fields match every tick
- **AC-8 (depletion)**: Eff4 ≈ 148.148s; Eff20 ≈ 266.667s; Eff20 50% throttle survives fixture

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/simulation/FuelSystemTests.cs` (or `Assets/tests/unit/settings/`-adjacent — system-named)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: car-definition-data (efficiency), Simulation Kernel (Step 5a seam, PitServiceCommand)
- Unlocks: Story 003 (pit service), VP (topSpeedModifier), hud (fuel bar)
