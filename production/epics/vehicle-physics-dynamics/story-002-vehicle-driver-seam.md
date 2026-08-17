# Story 002: Vehicle Driver Seam

> **Epic**: Vehicle Physics — Dynamics
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/vehicle-physics.md`
**Requirement**: `TR-vp-003` (IVehicleDriver seam)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0002: Vehicle Physics Implementation Pattern
**ADR Decision Summary**: Vehicle Physics uses Unity Physics 3D (Rigidbody) with a custom arcade grip model. Pure C# logic operates on plain structs; a thin `IVehicleDriver` adapter applies results to Rigidbody instances at the tick boundary. The interface uses `VehicleHandle` (struct) to avoid leaking `UnityEngine` types into the abstraction — the DOTS-migration seam.

**Engine**: Unity 6000.3.22f1 | **Risk**: HIGH
**Engine Notes**: Use `Rigidbody.linearVelocity`, `linearDamping`, `angularDamping` (renamed in Unity 6000.3 — the obsolete `velocity`, `drag`, `angularDrag` must never be used). `Rigidbody.maxLinearVelocity` is the hard speed cap. `Rigidbody.interpolation = None` (manual LateUpdate interpolation owned by Simulation). No `FixedUpdate()`/`Time.fixedDeltaTime`/`Time.deltaTime` in the VehiclePhysicsSystem.

**Control Manifest Rules (this layer)**:
- Required: `IVehicleDriver` seam (VehicleHandle, ApplyForces/ReadCarState/ReadSimStateForNextTick); MVP `RigidbodyVehicleDriver`
- Required: `Rigidbody.interpolation = None`
- Forbidden: no `FixedUpdate` in VehiclePhysicsSystem; no WheelCollider; no DOTS/ECS for MVP

---

## Acceptance Criteria

*From ADR-0002 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] `IVehicleDriver` interface signatures exactly match ADR-0002 and contain NO Rigidbody/Unity engine types (only `VehicleHandle`, `VehicleSimState`, `CarState`)
- [ ] MVP `RigidbodyVehicleDriver` indexes `Rigidbody[]` by CarId and implements ApplyForces/ReadCarState/ReadSimStateForNextTick
- [ ] `Rigidbody.interpolation = None` set on all racing bodies (Simulation owns manual LateUpdate interpolation)
- [ ] Player car uses `CollisionDetectionMode.ContinuousDynamic`; AI cars use `Continuous`; both fall back to `Discrete` under profiler-budget pressure (seam-level configuration — the fallback trigger is a documented configuration point, not per-tick logic)
- [ ] Static/source-level guard: no `FixedUpdate()`, `Time.fixedDeltaTime`, or `Time.deltaTime` in the VehiclePhysicsSystem
- [ ] `Rigidbody.linearVelocity` / `linearDamping` / `angularDamping` used throughout (never `velocity` / `drag` / `angularDrag`)

---

## Implementation Notes

*Derived from ADR-0002 Implementation Guidelines:*

- `VehicleHandle { public int CarId; }` — struct handle; DOTS later maps CarId → Entity
- `IVehicleDriver { void ApplyForces(VehicleHandle h, in VehicleSimState state); CarState ReadCarState(VehicleHandle h); VehicleSimState ReadSimStateForNextTick(VehicleHandle h); }`
- `RigidbodyVehicleDriver` is the only MVP implementation; a fake driver exists for unit tests
- `CarCollisionMonitor : MonoBehaviour` (OnCollisionEnter/Stay/Exit) is Story 005's concern — do not implement collision forwarding here
- Force application semantics (ForceMode) are Story 003's concern — this story only defines the seam and the Rigidbody configuration surface

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 003]: longitudinal force application + Step-6 pipeline integration
- [Story 005]: collision monitor + contact processing
- [vehicle-physics-feel]: tuning values

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (seam)**: a fake driver implementing the ADR signature ticks through VP with only VehicleHandle/VehicleSimState/CarState — no Unity type in the interface; edge: unknown handle, multiple car IDs
- **AC-2 (adapter)**: RigidbodyVehicleDriver maps carId → Rigidbody; ReadCarState returns the schema fields from the Rigidbody transform
- **AC-3 (interpolation)**: all racing bodies report `interpolation = None`
- **AC-4 (collision mode)**: player ContinuousDynamic, AI Continuous; edge: profiling fallback to Discrete configured (not per-tick)
- **AC-5 (source guard)**: static scan finds no FixedUpdate/Time.fixedDeltaTime/Time.deltaTime in VehiclePhysicsSystem
- **AC-6 (API)**: static scan finds no `velocity`/`drag`/`angularDrag` usages (only linearVelocity/linearDamping/angularDamping)

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/VehiclePhysicsTests.cs` OR playtest doc
- Source-guard checks: `Assets/tests/unit/simulation/VehiclePhysicsTests.cs` (static scans)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (CarState schema + VehicleSimState)
- Unlocks: Story 003 (uses the driver to apply forces), Story 005 (collision)
