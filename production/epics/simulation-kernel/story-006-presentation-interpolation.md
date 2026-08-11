# Story 006: Presentation — Render Interpolation

> **Epic**: Simulation Kernel
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: S (~2-4h — pure math, 6 scenarios, no scene required)

## Context

**GDD**: `design/gdd/simulation-architecture.md`
**Requirement**: `TR-sim-006` (Render interpolation in LateUpdate; Rigidbody.interpolation = None)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0001 (Manual Simulation Authority and Determinism Boundary), ADR-0002 (Vehicle Physics Implementation Pattern)
**ADR Decision Summary**: Interpolation runs in LateUpdate (after all Update scripts, before render). `α = accumulator / FIXED_DT` in range [0, 1). Visual position = `Lerp(previousStepPosition, currentStepPosition, α)`; visual rotation = `Slerp(previousStepRotation, currentStepRotation, α)`. Applies only to the separate visual hierarchy — never to an authoritative Rigidbody Transform. All participating Rigidbodies use `Rigidbody.interpolation = None`; Unity interpolation and `PhysicsScene.InterpolateBodies()` are not used. After every completed physics step, the previous/current visual buffers advance so a multi-step frame interpolates only its final two completed states (visual snappiness rule).

**Engine**: Unity 6000.3.19f1 | **Risk**: HIGH (Unity 6.3 is post-LLM-cutoff)
**Engine Notes**: Verified API: `Rigidbody.interpolation`. The α/Lerp/Slerp math is pure — testable without a Unity scene. `Unity.Mathematics` types (`float3`, `quaternion`) are used on the interpolation path per the sim-path math rule (AC-5.4 governs authoritative state; visual interpolation is explicitly outside that rule's constraint set but uses the same types).

**Control Manifest Rules (Foundation + Core layers, v2026-08-05)**:
- Required: `Rigidbody.interpolation = None`; manual interpolation runs in LateUpdate (α = accumulator / FIXED_DT) — source: ADR-0001
- Required: Simulation path math uses `Unity.Mathematics` (`float3`, `math.*`) consistently; no mixing with `System.MathF` — source: ADR-0001
- Required: No simulation logic in `Update()`; gameplay state changes happen inside the fixed step except explicit non-physics lifecycle boundaries — source: ADR-0001
- Forbidden: No Unity interpolation / `PhysicsScene.InterpolateBodies()`; interpolation never writes to an authoritative Rigidbody Transform — source: ADR-0001

---

## Acceptance Criteria

*From GDD `design/gdd/simulation-architecture.md`, scoped to this story:*

- [ ] **AC-2.1:** Given the accumulator holds 8ms after the latest simulation step, When the render pass calculates interpolation alpha, Then α = accumulator / FIXED_DT ≈ 0.48 (±0.02).
- [ ] **AC-2.2:** Given a constant-velocity test car, a 60Hz display, and a 60Hz simulation, When 10 consecutive frames render, Then every visual pose equals `Lerp(previousStep, currentStep, accumulator_remainder / FIXED_DT)` within 1e-4 units and the positions are monotonic along the velocity vector.
- [ ] **AC-2.3:** Given a constant-velocity test car, a 30Hz display, and a 60Hz simulation, When 10 consecutive frames render, Then every visual pose equals `Lerp(previousStep, currentStep, accumulator_remainder / FIXED_DT)` within 1e-4 units and the positions are monotonic along the velocity vector.
- [ ] **AC-2.4:** Given a constant-velocity test car, a 144Hz display, and a 60Hz simulation, When 10 consecutive frames render, Then every visual pose equals `Lerp(previousStep, currentStep, accumulator_remainder / FIXED_DT)` within 1e-4 units and the positions are monotonic along the velocity vector.
- [ ] **AC-2.5:** Given two simulation snapshots with positions P0, P1 and rotations R0, R1, When the render pass interpolates, Then position is computed as Lerp(P0, P1, α) and rotation as Slerp(R0, R1, α).
- [ ] **AC-2.6:** Given the accumulator holds a remainder after the last simulation step, When the render pass interpolates, Then α is always in the range [0, 1), and the visual never leads ahead of the simulation state.

---

## Implementation Notes

*Derived from ADR-0001 and ADR-0002 Implementation Guidelines:*

- Interpolation runs in `LateUpdate()` — after all Update scripts, before render. The kernel's LateUpdate stage: (1) compute α from the accumulator remainder, (2) interpolate the VisualTransform between the previous and current step's CarState, (3) present consumers (Camera/VFX/Audio/HUD read the interpolated transform + latest PublishedSimulationSnapshot immediately after, per ADR-0010 PresentationDriver ordering).
- `α = accumulator / FIXED_DT`, always in [0, 1). The next tick fires before α reaches 1.0, so α strictly approaches but never reaches 1. The visual never leads ahead of the authoritative state — no extrapolation.
- Position: `Lerp(previousStepPosition, currentStepPosition, α)`; rotation: `Slerp(previousStepRotation, currentStepRotation, α)` (shortest-path, normalized).
- Visual snappiness rule: interpolation is always between the two most recent completed simulation steps. A step is completed only after `Physics.Simulate(FIXED_DT)` returns AND the ascending-carId CarState readout has captured every Rigidbody. After each completed step, advance the previous/current visual buffers — a multi-step frame interpolates only its final two completed states.
- Interpolation applies only to the separate visual hierarchy (visual transforms, VFX, camera) — never to an authoritative Rigidbody Transform or simulation state. `Rigidbody.interpolation = None` on all participating bodies.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- [Story 002]: accumulator mechanics producing the remainder that feeds α
- [Story 001]: PublishedSimulationSnapshot schema (the source of the two interpolated CarState snapshots)
- Camera/VFX/Audio/HUD consumption of the interpolated transform (ADR-0010 PresentationDriver, Camera/VFX/HUD epics)
- Interpolation of non-car entities (replay ghosts — Alpha scope)

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-2.1**: α = accumulator/FIXED_DT ≈ 0.48 ±0.02 at 8ms
  - Given: FIXED_DT = 1/60; accumulator = 0.008s after latest step
  - When: interpolation factor calculated as α = accumulator / FIXED_DT
  - Then: α ≈ 0.48 within ±0.02
  - Edge cases: accumulator = 0 → α = 0; accumulator approaching FIXED_DT → α approaching but never reaching 1; negative/non-finite accumulator fails validation

- **AC-2.2**: 60Hz display: Lerp within 1e-4, monotonic
  - Given: constant-velocity test car; FIXED_DT = 1/60; ten consecutive 60Hz frame intervals
  - When: each frame computes Lerp(previousStepPosition, currentStepPosition, accumulator/FIXED_DT)
  - Then: every visual position matches independently calculated Lerp within 1e-4; positions monotonic along velocity vector
  - Edge cases: zero velocity → identical positions; negative velocity → monotonic in negative direction; remainder exactly zero uses previous-step position

- **AC-2.3**: 30Hz display: same
  - Given: constant-velocity car; FIXED_DT = 1/60; ten consecutive 30Hz intervals of 2×FIXED_DT
  - When: each frame advances two steps and interpolates final two completed states with accumulator/FIXED_DT
  - Then: every visual position matches Lerp within 1e-4; positions monotonic along velocity vector
  - Edge cases: remainder zero after each pair must not skip or extrapolate; exact two-step frames execute two ticks; excess duration handled only by accumulator clamp

- **AC-2.4**: 144Hz display: same
  - Given: constant-velocity car; FIXED_DT = 1/60; ten consecutive 144Hz intervals
  - When: each frame performs zero or one step per accumulator, then interpolates latest two completed states
  - Then: every visual position matches Lerp within 1e-4; positions monotonic along velocity vector across all frames
  - Edge cases: frames without a completed step still render using current remainder; step between frames advances buffers before rendering; no stale buffers or extrapolation

- **AC-2.5**: Position Lerp, rotation Slerp
  - Given: two snapshots with positions P0, P1; rotations R0, R1; interpolation factor α ∈ [0, 1)
  - When: render pass interpolates the snapshots
  - Then: position = Lerp(P0, P1, α); rotation = normalized shortest-path Slerp(R0, R1, α)
  - Edge cases: α = 0 returns previous pose; identical poses unchanged; antipodal quaternion representations treated as equivalent; invalid/non-normalized rotations must not produce non-finite output

- **AC-2.6**: α ∈ [0, 1), visual never leads ahead
  - Given: accumulator remainder preserved after all completed fixed steps; 0 ≤ accumulator < FIXED_DT
  - When: interpolation factor and visual pose calculated
  - Then: α in [0, 1); visual pose lies on or between previous and current authoritative states; never extrapolates beyond current state
  - Edge cases: accumulator = 0 renders previous state; accumulator approaching FIXED_DT remains strictly below 1; accumulator ≥ FIXED_DT triggers step processing before rendering; negative/NaN/infinite fail safely rather than producing a leading pose

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/simulation/InterpolationTests.cs` — must exist and pass. Pure math: α computation, Lerp/Slerp correctness, monotonicity at 30/60/144 Hz, non-leading invariant.

**Deferred integration constraints (NOT unit-testable here — verified at the MVP-assembly engine/integration gate):** execution in `LateUpdate`, `Rigidbody.interpolation = None` on all participating bodies, interpolation applied only to the separate visual hierarchy, and no writes to authoritative Rigidbody transforms. These are engine-level wiring checks (per ADR-0001: LateUpdate stage, ADR-0001 Forbidden: no Unity interpolation, ADR-0002: separate visual hierarchy); the unit test covers the math, the assembly gate covers the wiring.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (PublishedSimulationSnapshot schema — source of the two interpolated states), Story 002 (accumulator remainder feeds α)
- Unlocks: None (presentation consumers read the interpolated transform in their own epics)
