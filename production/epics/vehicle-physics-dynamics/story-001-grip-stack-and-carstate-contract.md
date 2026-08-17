# Story 001: Grip Stack & CarState Contract

> **Epic**: Vehicle Physics — Dynamics
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 2.0h

## Context

**GDD**: `design/gdd/vehicle-physics.md`
**Requirement**: `TR-vp-001` (grip stack), `TR-vp-002` (CarState schema)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0002: Vehicle Physics Implementation Pattern
**ADR Decision Summary**: Grip math, force calculation, and state are pure C# on plain data structs (`GripMath.ComputeEffectiveGrip`), with a thin Unity adapter at the tick boundary. No WheelCollider, no DOTS. Stability modulates slip behavior only — it is NOT part of the grip stack (validated 2026-08-04).

**Engine**: Unity 6000.3.22f1 | **Risk**: HIGH
**Engine Notes**: All sim math uses `Unity.Mathematics` (`math.clamp`, `float3`, `quaternion`). No `UnityEngine.Random` on the simulation path (ADR-0001).

**Control Manifest Rules (this layer)**:
- Required: `effective_grip = clamp(grip_base × surface_grip_multiplier × tire_runtime_grip_multiplier, 0.20, 1.20)`; control_threshold REMOVED from the stack
- Required: CarState per car per tick with the ADR-0002 field list
- Forbidden: no stateful RNG stream; no Unity engine types in pure C# logic

---

## Acceptance Criteria

*From GDD `design/gdd/vehicle-physics.md` + ADR-0002, scoped per QL-STORY-READY 2026-08-16:*

- [ ] `GripMath.ComputeEffectiveGrip(gripBase, surfaceMultiplier, tireGripMultiplier)` returns `math.clamp(product, 0.20f, 1.20f)`; changing Stability does not change effective grip
- [ ] The existing Foundation `CarState` (CarId, Position scalar track-progress, Position3 world pose, Rotation) is **expanded** with the ADR-0002 schema fields without breaking the Foundation consumers: LinearVelocity (float3), SpeedKmh, Rpm, Gear, Throttle, Brake, Steer, IsGridLocked (bool), Surface (SurfaceType), PitPhase, State (CarStateEnum: Driving/OffTrack/WallHit/Pitting/GridLocked), SlipState (Normal/Slipping/SpinOut), SlideState (float, normalized), WallContact (bool), ForwardDot (float)
- [ ] Five-state reachability observable from **injected boundary inputs** (surface change, wall contact, pit entry/service, grid lock) — Track/Pit detection itself is NOT this story (Track/Pit epics)
- [ ] Off-track surface multiplier (injected) applied on the next tick (GDD AC-G2 re-scoped to seam)
- [ ] Surface recovery restores instantly while the supplied tire multiplier remains unchanged (GDD AC-G3)
- [ ] `tireRuntimeGripMultiplier = 0.20` clamps effective grip to floor 0.20 (GDD AC-R4 seam-scoped)
- [ ] Player/AI surface multipliers (0.60/0.40) consumed unchanged from the boundary; selection belongs to Settings/Difficulty (GDD AC-R5 seam-scoped)
- [ ] Immutable car-stat and difficulty inputs are never mutated by VP (GDD AC-R6 seam-scoped)

---

## Implementation Notes

*Derived from ADR-0002 Implementation Guidelines:*

- `GripMath` is a standalone static pure-math class — NUnit-testable with no Unity scene
- The grip stack consumes three inputs from their authoritative owners: `grip_base` (Car Definition → maxLateralG), `surface_grip_multiplier` (Track / DifficultyProfile player off-track), `tire_runtime_grip_multiplier` (Tire System). VP does NOT derive any of them in this story
- `CarState.SlipState` (Normal/Slipping/SpinOut) is distinct from `CarState.State` (5-state machine); `SlideState` is a normalized float (VFX/Audio consume it directly); `WallContact` is a per-tick bool; `ForwardDot` feeds RSM lap validation
- The scalar `Position` (track progress, RSM ranking) and `Position3` (world pose, render) coexist — do not collapse one into the other
- 5-state transitions consumed from injected inputs: `Driving↔OffTrack` (surface), `Driving↔WallHit` (wall contact), `Driving→Pitting` (pit entry), `Pitting→Driving` (pit exit), GridLocked (lock/release). Simultaneous-trigger precedence must be deterministic and documented in the state evaluation

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 002/003]: Rigidbody adapter + force application (consumes the grip output)
- [Track epic]: surface boundary detection; [Pit epic]: pit-phase ownership — only consumed here via injected inputs
- [vehicle-physics-feel]: visual slide judgment, tuning values

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-1 (grip stack)**: `ComputeEffectiveGrip` clamps to 0.20–1.20; floor, ceiling, exact boundaries, zero multipliers; changing Stability does not change the result
- **AC-2 (CarState schema)**: one immutable CarState published per tick with the agreed field names/types/enum values from a complete driver readout + boundary snapshot; edge: zero velocity, every State, every SlipState, pit-phase boundaries
- **AC-3 (5-state reachability)**: injected surface/wall/pit/grid-lock inputs produce observable Driving/OffTrack/WallHit/Pitting/GridLocked; edge: simultaneous triggers, repeated events
- **AC-4 (off-track)**: surface input change → new multiplier applied next tick; edge: minimum surface multiplier
- **AC-5 (recovery)**: restored surface + unchanged tire input → grip restores immediately, tire unchanged; edge: restoration at floor/ceiling
- **AC-6 (tire floor)**: tire input 0.20 → effective grip 0.20; edge: below-floor input, high grip base
- **AC-7 (player/AI)**: 0.60 (player) and 0.40 (AI) consumed unchanged; edge: identical surface, different roles
- **AC-8 (immutability)**: VP never mutates car-stat/difficulty inputs; edge: same input reused across ticks

---

## Test Evidence

**Story Type**: Logic
**Required evidence** (file names describe the system, NOT the story):
- Logic: `Assets/tests/unit/simulation/VehiclePhysicsTests.cs` — must exist and pass
- Companion: `GripMath` boundary tests (floor 0.20, ceiling 1.20, intermediate)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Simulation Kernel (CarState Foundation contract — story 2-001 contract spine)
- Unlocks: Stories 002-005 (all consume the grip output and CarState schema)
