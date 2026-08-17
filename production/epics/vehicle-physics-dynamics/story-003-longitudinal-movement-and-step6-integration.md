# Story 003: Longitudinal Movement & Step-6 Integration

> **Epic**: Vehicle Physics — Dynamics
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/vehicle-physics.md`
**Requirement**: `TR-vp-003` (driver integration), GDD §2.1 Throttle → Forward Speed, §2.2 Brake → Deceleration, GridLocked §2.3
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0002: Vehicle Physics Implementation Pattern
**ADR Decision Summary**: `VehiclePhysicsSystem` (standalone class, not MonoBehaviour) runs at Step 6 of the 14-step kernel; `Physics.Simulate(FIXED_DT)` is called by Simulation, not by VP; CarState readout happens after. Force semantics: `ForceMode.Force` for force values (N), or raw acceleration values applied directly — never pass force-semantics values (mass × acceleration) through `ForceMode.Acceleration`/`Impulse` (implicit mass application over-applies: 28 m/s² × 505 kg = 14,140 m/s²).

**Engine**: Unity 6000.3.22f1 | **Risk**: HIGH
**Engine Notes**: `Physics.simulationMode = SimulationMode.Script` (ADR-0001 — already shipped). LinearDamping = 0 only when the quadratic model is active (Story 003 of the Feel epic) — the Dynamics baseline may use linear damping defaults from the prototype.

**Control Manifest Rules (this layer)**:
- Required: `longitudinalDriveForceFinal` is the final longitudinal force after car-stat, tire-grip, and fuel-state modifiers, immediately before VP applies longitudinal acceleration
- Required: Grid & Start may apply `perfectStartDriveForceMultiplier = 1.15` to `longitudinalDriveForceFinal` for 600 ticks after GO — no other system writes that multiplier
- Required: GridLocked — inputs consumed but translational/rotational race movement frozen at the assigned grid transform (engine/wheel visual state retained)
- Forbidden: no force-semantics values through Acceleration/Impulse

---

## Acceptance Criteria

*From GDD + ADR-0002, scoped per QL-STORY-READY 2026-08-16:*

- [ ] `VehiclePhysicsSystem.Tick(TickStartSnapshot, ResolvedCarInput[])` runs at kernel Step 6: force application occurs before the single `Physics.Simulate` and CarState readout after (explicit pipeline-order contract)
- [ ] Acceleration: given standstill, injected top-speed/acceleration parameters, full throttle, and fixed `FIXED_DT` — speed reaches ≥80% of the supplied top speed within 3 simulated seconds (GDD AC-M1, parameters injected — Car Definition owns derivation)
- [ ] Braking: given top speed and full brake — speed ≤30% of top speed within 3s within tolerance (GDD AC-M2)
- [ ] Coasting/dead-stop: no pedals — speed decays; velocity clamped below 0.1 m/s; never becomes negative; brake never reverses the car (speed floors at zero)
- [ ] GridLocked: `IsGridLocked == true` consumes inputs but position/rotation/velocity do not change (GDD AC — grid lock applied before each whole-scene tick; Countdown/GO ownership belongs to Grid & Start/Simulation)
- [ ] Force semantics: force-valued commands use `ForceMode.Force`; no mass-scaled force passes through `Acceleration`/`Impulse` (505 kg vehicle mass edge)
- [ ] `perfectStartDriveForceMultiplier` consumed from the boundary and applied to `longitudinalDriveForceFinal` only during the Grid & Start window (seam — Grid & Start writes it)

---

## Implementation Notes

*Derived from ADR-0002 Implementation Guidelines:*

- The Dynamics longitudinal baseline is a simple arcade accel/brake model (linear accel toward vmax, linear drag, brake decel) — the real-engine quadratic model (`P/m ÷ v − K·v²`) is Story 003 of the Feel epic; this story's model is the replaceable seam
- `VehicleSimState.LongitudinalForce` carries the post-modifier force into `driver.ApplyForces`
- Pipeline ordering: Step 6 VP.Tick (compute forces + ApplyForces) → Step 7 `PhysicsSimulateStep` → Step 8/9 CarState readout — the driver is called once per tick
- The multiplier wiring (`longitudinalDriveForceFinal`) is a data contract — Grid & Start owns writing it; VP only applies it during the window

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [vehicle-physics-feel Story 003]: real-engine quadratic longitudinal model (replaces this baseline through the same seam)
- [race-flow epic]: Countdown/GO boundary, Perfect Start arming — only the multiplier consumption is here
- [Story 002]: driver seam definition (consumed here)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (pipeline order)**: instrumented Step 6 + PhysicsSimulate + readout — forces once before one simulate, CarState readout after; edge: inactive simulation, multiple render frames
- **AC-2 (acceleration)**: standstill + full throttle + injected params + FIXED_DT → ≥80% of supplied top speed at 3s; edge: partial throttle, zero acceleration
- **AC-3 (braking)**: top speed + full brake → ≤30% at 3s within tolerance; edge: already stopped, partial brake
- **AC-4 (coast/dead-stop)**: no pedals → decays, clamps <0.1 m/s, never negative; edge: zero speed, brake+throttle
- **AC-5 (grid lock)**: IsGridLocked true + non-zero inputs → inputs consumed, position/rotation/velocity unchanged; edge: lock release next tick
- **AC-6 (force semantics)**: driver spy + force-valued command → ForceMode.Force, no mass-scaled force through Acceleration/Impulse; edge: 505 kg
- **AC-7 (perfect start multiplier)**: multiplier present → applied to longitudinalDriveForceFinal in window; absent → not applied

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/VehiclePhysicsTests.cs` (pipeline order via instrumented steps)
- Logic companion: `Assets/tests/unit/simulation/VehiclePhysicsTests.cs` (movement model with injected params)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (grip output + CarState), Story 002 (driver seam)
- Unlocks: Story 004 (steering shares the movement path), Story 005 (collision modifies velocity)
