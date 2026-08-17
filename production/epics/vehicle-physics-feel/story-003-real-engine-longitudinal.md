# Story 003: Real-Engine Longitudinal Formula

> **Epic**: Vehicle Physics — Feel & Telemetry
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.0h

## Context

**GDD**: `design/gdd/vehicle-physics.md`
**Requirement**: `TR-vp-009` (longitudinal acceleration)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0002: Vehicle Physics Implementation Pattern (Validated Force Models — 2026-08-05 amendment)
**ADR Decision Summary**: Real-engine longitudinal model (validated 2026-08-02): `accel = min(enginePower, P/m ÷ v) − K·v²` where `K = (P/m) ÷ vmax³`. `enginePower` caps low-speed acceleration (strong launch); `P/m ÷ v` (real 1989 engine power / 505 kg, e.g. Honda 1012 m²/s³) dominates mid-to-high speed. Traction limit below ~90 km/h: ~13.5 m/s² (tire-limited launch, all cars 0-100 in 2.11 s). Quadratic drag makes equilibrium land exactly at vmax (asymptote — practical top speed = theoretical − 2 km/h). `LinearDamping = 0` when the quadratic model is active. Motor force applied along heading (not velocity) — slip stabilizer.

**Engine**: Unity 6000.3.22f1 | **Risk**: HIGH
**Engine Notes**: Pure C# math. `LinearDamping = 0` emitted as force configuration when the quadratic model is active.

**Control Manifest Rules (this layer)**:
- Required: `accel = min(enginePower, P/m ÷ v) − K·v²` with `K = (P/m) ÷ vmax³`; traction limit ~13.5 m/s² below ~90 km/h
- Required: `LinearDamping = 0` when the quadratic model is active; motor force applied along heading (slip stabilizer)

---

## Acceptance Criteria

*From ADR-0002 + GDD, scoped per QL-STORY-READY 2026-08-16 (standstill rule defined):*

- [ ] Pure formula tested with numeric fixtures (enginePower, P/m, v, vmax, K) — NO Car Definition stat loading/resolution in this story (CP1/CP2 benchmarks move to cross-epic integration after CarDef+Dynamics exist)
- [ ] **Standstill rule (2026-08-16 gate resolution)**: `P/m ÷ v` is singular at v = 0 — the model uses `enginePower` (the min term) as the launch-speed rule; `accel = enginePower` at v = 0 (documented, no division by zero)
- [ ] Traction cap: below ~90 km/h the output is capped at ~13.5 m/s² (tire-limited launch)
- [ ] `K = (P/m) ÷ vmax³`; zero linear damping when quadratic drag is active; motor force direction parallel to heading (not velocity)
- [ ] Equilibrium at vmax asymptote: practical top speed = theoretical − 2 km/h (documented approximation — the asymptote never lands exactly)

---

## Implementation Notes

*Derived from ADR-0002 Implementation Guidelines (Validated Force Models):*

- `enginePower` caps low-speed acceleration (strong launch); `P/m ÷ v` dominates mid-to-high; the min selects the limiting term
- Quadratic drag `K·v²` REPLACES linear Rigidbody damping — `LinearDamping = 0` while active (GDD/prototype presets use DragCoeff = 0, linear damping only — the two presets must not mix)
- Motor force along heading realigns velocity toward heading each tick — acceleration above grip limit produces understeer rather than drift (interacts with Story 002)
- The numeric fixture set is documented in the test file (enginePower, P/m, v, vmax values) — the CP1/CP2 car-stat benchmarks are a cross-epic integration (CarDef + Dynamics) and live in the rig story's evidence

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [car-definition-data epic]: stat → behavior formulas (max_velocity 300 + TS×2, etc.) — consumed via fixtures here
- [vehicle-physics-dynamics Story 003]: the Dynamics longitudinal baseline + Step-6 application — this story replaces the baseline model through the same seam
- [Story 005]: rig benchmark evidence (0→vmax timing)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (formula)**: fixed numeric enginePower/P/m/v/vmax → `min(enginePower, P/m÷v) − ((P/m)÷vmax³)×v²` within tolerance; edge: low speed, high speed, negative/invalid inputs
- **AC-2 (standstill)**: v = 0 → documented launch rule (accel = enginePower), no division by zero; edge: exactly zero, sub-floor speed, reverse velocity
- **AC-3 (traction cap)**: below 90 km/h → capped ~13.5 m/s²; edge: exactly 90 km/h, accel below the cap
- **AC-4 (damping)**: quadratic active → LinearDamping = 0 emitted, drag via the quadratic term; edge: legacy/non-quadratic preset
- **AC-5 (motor along heading)**: heading ≠ velocity direction → force vector parallel to heading, not velocity; edge: zero heading, reversing

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/simulation/VehiclePhysicsTests.cs` — longitudinal formula, standstill, traction cap, damping emission
- Cross-epic benchmark (CP1/CP2): Story 005 rig evidence (`production/qa/evidence/vehicle-physics-feel-rig-evidence.md`)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: vehicle-physics-dynamics Story 003 (longitudinal seam)
- Unlocks: Story 004 (telemetry RPM/gear), Story 005 (rig feel verification)
