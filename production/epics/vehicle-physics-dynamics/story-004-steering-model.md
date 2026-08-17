# Story 004: Steering Model (1-state)

> **Epic**: Vehicle Physics — Dynamics
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/vehicle-physics.md`
**Requirement**: `TR-vp-006` (1-state steering)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0002: Vehicle Physics Implementation Pattern
**ADR Decision Summary**: 1-state steering model (validated 2026-08-04): `maxYaw = min(steerCeiling(v), v/minTurnRadius, gripCeiling)`. Steering is instant at the physics boundary — each 60 Hz tick applies the received `SimulationInput.steerOut` without an additional input ramp or smoothing layer. Global steering knobs are identical for all cars. Reverse uses arcade sign inversion (left input turns the car left on screen while reversing).

**Engine**: Unity 6000.3.22f1 | **Risk**: HIGH
**Engine Notes**: Pure C# math — no engine-specific APIs.

**Control Manifest Rules (this layer)**:
- Required: `maxYaw = min(steerCeiling(v), v / minTurnRadius, gripCeiling)` — steering capacity decreases with speed (falloff linear from falloffStartKmh to falloffEndKmh = 99% of the car's own vmax, falloffShape 1.0); `v/minTurnRadius` prevents turning in place; `gripCeiling = maxLateralAccel / v` is the anti-slide safety ceiling
- Required: high-speed steer reduction activates within the 65-75% transition band (no hard cutoff snap) — canonical falloff function resolves the 2026-08-16 gate contradiction (falloffStart 60 km/h vs "100% at 70% speed"): use ONE canonical falloff function; the 65-75% band anchors the reduction, the 60 km/h falloffStart governs the start of the band
- Required: steering instant at the tick boundary (no additional smoothing layer)

---

## Acceptance Criteria

*From GDD + ADR-0002, scoped per QL-STORY-READY 2026-08-16 (contradiction resolved):*

- [ ] `ComputeMaxYaw` returns `min(steerCeiling(v), v/minTurnRadius, gripCeiling)` — pure function of speed, steering ceiling, min radius, and grip ceiling
- [ ] One canonical speed-falloff function: at 70% of vmax steer rate is 100% (no reduction), at 90% of vmax steer rate is ~75% (25% reduction) — GDD AC-M4a/M4b; the 65-75% transition band lerps smoothly (no hard cutoff); falloffStartKmh (60 km/h global knob) anchors band start
- [ ] Instant tick-boundary steering: a new `steerOut` value affects yaw within one physics step with no VP smoothing (GDD AC-M3)
- [ ] Reverse arcade sign inversion: left input turns the car left on screen while reversing (validated 2026-08-04)
- [ ] Steering consumes a configuration object (tuning defaults live in vehicle-physics-feel — this story consumes, does not hardcode, `maxSteerLow 2.5`, `maxSteerHigh 1.5`, `liftOffSteerBonus 0.5`, `minTurnRadius 10`, `falloffStartKmh 60`)

---

## Implementation Notes

*Derived from ADR-0002 Implementation Guidelines:*

- `steerCeiling(v) = Lerp(maxSteerLow, maxSteerHigh, falloff)` — falloff is linear from falloffStartKmh to falloffEndKmh (99% of vmax), falloffShape = 1.0
- `gripCeiling = maxLateralAccel / v` — grip is the limit, not the steering; at standstill `v/minTurnRadius` dominates (car cannot spin in place)
- Global knobs identical for all cars (user decision 2026-08-02) — the feel epic owns the exact tuning pass; this story ships the canonical function + config consumption
- The 2026-08-16 gate resolution: one falloff function is authoritative; the 65-75% band and the 60 km/h falloffStart must not contradict — the band is expressed in % of vmax, the knob in absolute km/h

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [vehicle-physics-feel Story 001]: lift-off rotation bonus (steer bonus)
- [vehicle-physics-feel Story 002]: drift factor (heading yaw request shares ComputeMaxYaw)
- [vehicle-physics-feel]: tuning defaults pass (config values)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (formula)**: maxYaw equals min of the three terms; edge: zero speed (minTurnRadius dominates), zero steer, each term being the limiter
- **AC-2 (falloff anchors)**: canonical falloff at 70% → 100%, at 90% → ~75%; edge: exactly 65%, 70%, 75%, 90%
- **AC-3 (instant)**: new steerOut at tick boundary affects yaw within one physics step, no VP smoothing; edge: sign change, zero-to-full input
- **AC-4 (reverse inversion)**: reverse motion + left/right steer → arcade screen-space inversion; edge: zero speed, full reverse
- **AC-5 (config)**: consumption of the tuning config object (values injected, not hardcoded); edge: config at range limits

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/simulation/VehiclePhysicsTests.cs` — steering model boundaries (70%, 90%, 65-75% band)
- Integration companion: `Assets/tests/integration/simulation/VehiclePhysicsTests.cs` (tick-boundary instant steering)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (CarState + grip ceiling), Story 003 (movement path shares steer application)
- Unlocks: [vehicle-physics-feel Story 001/002] (lift-off and drift modify ComputeMaxYaw inputs)
