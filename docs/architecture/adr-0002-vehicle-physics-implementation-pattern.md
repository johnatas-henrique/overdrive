# ADR-0002: Vehicle Physics Implementation Pattern

## Status

Accepted

## Date

2026-07-27

**Amended:** 2026-08-05 — added Validated Force Models section: track-radius drift factor (TR-vp-008) and real-engine longitudinal model (TR-vp-009) ratified from vehicle-physics.md, closing the two coverage gaps found by the 2026-08-05 architecture review.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Physics / Core |
| **Knowledge Risk** | HIGH — Unity 6.3 is post-LLM-cutoff (May 2025) |
| **References Consulted** | `docs/engine-reference/unity/VERSION.md`, `docs/engine-reference/unity/breaking-changes.md`, `docs/engine-reference/unity/deprecated-apis.md`, `docs/engine-reference/unity/current-best-practices.md` |
| **Post-Cutoff APIs Used** | `Rigidbody.linearVelocity` (renamed from `velocity`), `linearDamping`/`angularDamping` (renamed from `drag`/`angularDrag`) — all verified against Unity 6000.3 runtime via `unity_reflect` |
| **Verification Required** | 16-car profiler to confirm per-tick cost stays within simulation budget (p95 ≤ 6 ms, max ≤ 8 ms) |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (Manual Simulation Authority and Determinism Boundary — Accepted). This ADR's 14-step tick pipeline and `Physics.simulationMode = SimulationMode.Script` are prerequisites. |
| **Enables** | ADR-0006 (Fuel/Tire State Ownership & Tick Timing), ADR-0009 (AI Rival Deterministic Architecture), ADR-0010 (Camera-VFX Rendering Budget & Interpolation) |
| **Blocks** | Any Vehicle Physics implementation work. All 10 downstream systems (Fuel, Tire, Pit Stop, AI Rival, Camera, HUD, Audio, VFX, Ghost Recording, Multiplayer Arch) depend on this decision. |
| **Ordering Note** | Must be Accepted before any vehicle code is written. Prototype spike in Week 1 of Pre-Production to validate performance assumptions. |

## Context

### Problem Statement

Vehicle Physics is the core simulation layer — it translates player input (throttle, brake, steer) into car motion at 60 Hz. It must deliver an arcade handling model (high grip, forgiving, inspired by 4PGP and Horizon Chase) while supporting 16 simultaneous cars within the simulation budget (p95 ≤ 6 ms, max ≤ 8 ms). The GDD defines what the physics should feel like, but not how to implement it in Unity 6000.3.

### Constraints

- **Physics Engine:** Must use Unity's PhysX engine (installed by default). DOTS/ECS entities package is not installed and will not be added for MVP.
- **Tick Pipeline:** Must integrate into the 14-step manual accumulator pipeline from ADR-0001. `Physics.Simulate(FIXED_DT)` is called once per tick. No code runs in `FixedUpdate()`.
- **Interpolation:** `Rigidbody.interpolation = None`. Simulation Architecture owns manual LateUpdate interpolation.
- **No WheelCollider:** The arcade grip model uses a custom grip force formula, not WheelCollider slip curves (which are designed for simulation/realism).
- **16 Cars:** All 16 cars (player + 15 AI) simulate in the same Physics.Simulate() call. No per-car isolation.
- **API Correction:** Must use `Rigidbody.linearVelocity`, `linearDamping`, and `angularDamping` (not the obsolete `velocity`, `drag`, `angularDrag`).

### Requirements

- Must support the arcade grip stack: `effective_grip = clamp(grip_base × surface_grip_multiplier × tire_runtime_grip_multiplier, 0.20, 1.20)` (control_threshold REMOVED from the stack — Stability modulates slip behavior only, validated 2026-08-04)
- Must produce a `CarState` per car per physics tick (Position, Rotation, LinearVelocity, SpeedKmh, Rpm, Gear, Throttle, Brake, Steer, IsGridLocked, Surface, PitPhase, State, SlipState, SlideState, WallContact, ForwardDot)
- Must consume `ResolvedCarInput[carId]` (accelerateOut, brakeOut, steerOut) at Tick Step 6
- Must support 5 car states: Driving, OffTrack, WallHit, Pitting, GridLocked
- Must support `perfectStartDriveForceMultiplier = 1.15` for 600 ticks after GO (written by Grid & Start)
- Must support the 1-state steering model (validated 2026-08-04): `maxYaw = min(steerCeiling(v), v / minTurnRadius, gripCeiling)` — steering capacity falls with speed (falloff start → 99% of vmax), minTurnRadius prevents turning in place, grip is the anti-slide ceiling
- Must support lift-off grip bonus (tuck-in, validated 2026-08-03): fixed +3.0 g to maxLateralAccel when throttle ≤ 0, applied in both the yaw request and the velocity rotation rate
- Must support the track-radius drift factor (validated 2026-08-03): while accelerating above a corner's grip limit (`v > sqrt(aMax × R_ahead)`, R from track curvature ahead), heading may request up to `driftFactor × grip` (default 1.15) while velocity follows only the real grip — the rear axle slides out. Below the limit F = 1 (clean line); lifting off returns F = 1 immediately (tuck-in). F applies to BOTH consumers; `driftHeadBoost` (default 1.40) makes heading ask F × boost while velocity follows only F — the gap between them is the slip angle. Implemented via `track.GetCornerRadiusAhead(pos, driftLookahead=40m)` with a 12% transition band (InverseLerp(vLimit, vLimit × 1.12)).
- Must support the real-engine longitudinal model (validated 2026-08-02): `accel = min(enginePower, P/m ÷ v) − K·v²` where K = P/m ÷ vmax³; below ~90 km/h the traction limit (13.5 m/s²) dominates (tire-limited launch, all cars 0-100 in 2.11 s); equilibrium lands exactly at vmax (asymptote); LinearDamping = 0 when the quadratic model is active (real-engine presets)
- Must support wall contact (0.2–0.5s persist, repeated bounce impulse reduction by 50%)
- Must support car-to-car collision (15–25% speed loss + push impulse, cooldown between repeated impacts)
- Must be replaceable by a DOTS/ECS implementation in the future without rewriting game logic

## Decision

Vehicle Physics uses **Unity Physics 3D (Rigidbody) with a custom arcade grip force model**, not WheelCollider or DOTS/ECS. The grip math, force calculation, and state management are implemented as **pure C# logic operating on plain data structs**, with a thin Unity adapter layer that applies results to Rigidbody instances at the tick boundary.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                VehiclePhysicsSystem                      │
│  (standalone class, not MonoBehaviour — no Update())     │
│                                                         │
│  VehicleSimState[16]  ← pure C# data (float3, quat…)   │
│  IVehicleDriver       ← interface for physics engine    │
│                                                         │
│  Tick(TickStartSnapshot, ResolvedCarInput[]) → CarState[]│
│    ├─ compute effective_grip (pure C# math)             │
│    ├─ compute forces (longitudinal, lateral, brake)     │
│    ├─ driver.ApplyForces(carId, rb, VehicleSimState)    │
│    ├─ Physics.Simulate()  ← called BY Simulation, not VP│
│    └─ ReadCarState() from Rigidbody transforms          │
└─────────────────────────────────────────────────────────┘
```

### Key Interfaces

```csharp
// The seam for future DOTS migration — uses a struct handle to avoid
// leaking UnityEngine types into the abstraction.
// MVP: RigidbodyVehicleDriver (indexes Rigidbody[] by CarId)
// DOTS: DOTSVehicleDriver (maps CarId to Entity)
public struct VehicleHandle {
    public int CarId;
}

public interface IVehicleDriver {
    void ApplyForces(VehicleHandle handle, in VehicleSimState state);
    CarState ReadCarState(VehicleHandle handle);
    VehicleSimState ReadSimStateForNextTick(VehicleHandle handle);
}

// Each car GameObject carries this MonoBehaviour to forward collision
// events to VehiclePhysicsSystem (standalone class, no OnCollisionEnter).
public class CarCollisionMonitor : MonoBehaviour {
    void OnCollisionEnter(Collision c);  // forwards to VP system
    void OnCollisionStay(Collision c);   // continues wall contact timer
    void OnCollisionExit(Collision c);   // ends wall contact
}

// Pure C# data — no Unity engine types except float3/quaternion
public struct VehicleSimState {
    public float3 Position, Velocity, AngularVelocity;
    public quaternion Rotation;
    public float SpeedKmh, Rpm, Gear;
    public float GripMultiplier;          // computed effective_grip
    public float LongitudinalForce;       // post-modifier
    public bool IsGridLocked;
    public SurfaceType Surface;
    public PitPhase PitPhase;
    public CarStateEnum State;             // Driving/OffTrack/WallHit/Pitting/GridLocked
    public SlipState SlipState;            // Normal/Slipping/SpinOut
    public float SlideState;               // normalized lateral-slip
    public bool WallContact;               // per-tick wall hit flag
    public float ForwardDot;               // car-forward dot track-tangent
}

// The grip formula — standalone pure math, testable without Unity
public static class GripMath {
    public static float ComputeEffectiveGrip(
        float gripBase,          // from CarDef stats → maxLateralG
        float surfaceMultiplier, // from Track System
        float tireGripMultiplier,// from Tire System
        float gripFloor = 0.20f,
        float gripCeiling = 1.20f
    ) => math.clamp(
        gripBase * surfaceMultiplier * tireGripMultiplier,
        gripFloor, gripCeiling
    );
}
```

### Migration Strategy (Future DOTS)

```csharp
// Step 1: Extract all game logic to pure C# (already done by this ADR)
// Step 2: Implement IVehicleDriver with DOTS:
//   - VehicleSimState becomes an ECS component
//   - Forces applied via IJobEntity instead of Rigidbody.AddForce
// Step 3: Swap driver at VehiclePhysicsSystem construction
//   - No game logic changes needed
//   - GripMath, CarState production, state machine unchanged
```

### Implementation Notes

**ForceMode:** Use `ForceMode.Force` (or raw acceleration values applied directly). `ForceMode.Acceleration` ignores mass, so passing a force-like `mass × acceleration` value over-applies acceleration by the mass factor (observed: 28 m/s² × 505 kg = 14,140 m/s²). `ForceMode.Impulse` expects impulse rather than force. Neither mode accepts this grip path's force-semantics values. Corrected 2026-08-03. Cross-referenced in `docs/engine-reference/unity/deprecated-apis.md`.

**CollisionDetectionMode:** Player car uses `ContinuousDynamic` (prevents tunneling with thin walls/kerbs at high speed). AI cars use `Continuous` (detects collisions at reduced cost). All cars fall back to `Discrete` if profiling shows the continuous modes exceed the simulation budget.

**Speed Capping:** `Rigidbody.maxLinearVelocity` (Unity 6000.3, confirmed available) serves as the hard speed cap per car, complementary to the high-speed steer reduction formula.

**CarState Schema Consistency:**
- `CarState.State` (CarStateEnum: Driving/OffTrack/WallHit/Pitting/GridLocked) is the 5-state machine — distinct from `CarState.SlipState` (SlipState: Normal/Slipping/SpinOut)
- `CarState.SlideState` is a normalized float (not a bit flag) — VFX and Audio consume the float value directly
- `CarState.WallContact` is a bool per tick
- `CarState.ForwardDot` is a float for RSM lap validation
- `CarState.LinearVelocity` (float3) added for AI racing-line logic

### Validated Force Models (2026-08-05, TR-vp-008 / TR-vp-009 coverage)

**Drift Factor (track-radius activated)** — see vehicle-physics.md §Drift Factor:

```
F = 1.0 when v ≤ sqrt(aMax × R_ahead)                      // clean line below corner limit
F = driftFactor (default 1.15) when v > sqrt(aMax × R_ahead) and throttle > 0
F = 1.0 immediately on lift-off                               // tuck-in

heading yaw request:    maxYaw = min(steerCeiling(v), v / minTurnRadius, F × driftHeadBoost × gripCeiling)
velocity rotation rate:  maxCentripetal = F × gripCeiling     // follows only the real grip
```

- `R_ahead` comes from `track.GetCornerRadiusAhead(pos, driftLookahead=40m)` (ADR-0007 track spline)
- 12% transition band: `InverseLerp(vLimit, vLimit × 1.12)` smooths F between clean line and drift
- F MUST be applied to BOTH consumers (heading and velocity rotation). F on heading alone causes understeer because velocity follows only real grip and slip grows too slowly
- `driftHeadBoost` (default 1.40) creates the heading-vs-velocity gap that IS the slip angle; without the boost, equal F on both consumers produces zero slip (no drift)
- Knobs are global tuning values (identical for all cars): driftFactor 1.15, driftHeadBoost 1.40, driftLookahead 40 m

**Longitudinal Model (real-engine power curve)** — see vehicle-physics.md §Acceleration Model:

```
accel = min(enginePower, P/m ÷ v) − K·v²
K = (P/m) ÷ vmax³
```

- `enginePower` caps low-speed acceleration (strong launch); `P/m ÷ v` (real 1989 engine power / 505 kg, e.g. Honda 1012 m²/s³) dominates mid-to-high speed
- Traction limit below ~90 km/h: ~13.5 m/s² (tire-limited launch; all cars 0-100 in 2.11 s)
- Quadratic drag `K·v²` replaces linear Rigidbody damping; equilibrium lands exactly at vmax (asymptote — no car reaches the theoretical ceiling; practical top speed = theoretical − 2 km/h)
- `LinearDamping = 0` when the quadratic model is active (real-engine presets); GDD/prototype presets use `DragCoeff = 0` (linear damping only)
- Motor force is applied along heading (not velocity) — acts as a slip stabilizer: the motor's perpendicular component realigns velocity toward heading each tick, making acceleration above grip limit produce understeer rather than drift

**PitPhase Ownership:**
- Vehicle Physics is the sole writer of `PitPhase` in CarState. VP detects pit-entry/exit zone crossing during Physics.Simulate and queues the transition.
- PitPhase values: `NotPitting`, `PitTransit`, `InPitBox`, `PitExiting` (defined in ADR-0011).
- On tick N: VP detects car crossed pit-entry zone → sets `PitPhase = PitTransit` on tick N+1's ReadCarState (1-tick latency per VP GDD).
- On tick N: VP reads `PitServiceCommand[carId].requestExit == true` from TickStartSnapshot (written by PitStopSystem at Step 9b of tick N-1) → sets `PitPhase = PitExiting` on tick N+1's ReadCarState, then clears requestExit. VP is the only writer of PitPhase; PitStopSystem requests the transition via the command, never by writing PitPhase (ADR-0011).
- This ownership boundary is formalized in ADR-0011 §Registry Check and enforced by the tick pipeline ordering (Step 9 VP.ReadCarState → Step 9b PitStopSystem.Tick).
- Refer to architecture.md CarState struct for authoritative field list

## Alternatives Considered

### Alternative 1: WheelCollider Approach

- **Description:** Use Unity's WheelCollider component per wheel with custom slip curves, powered by standard Rigidbody.
- **Pros:** Built-in suspension simulation, native wheel rotation, per-wheel friction curves supported by PhysX.
- **Cons:** Designed for simulation/realism tuning. Arcade grip requires fighting the slip curve model. Each car needs 4 WheelColliders + configuration = 64 colliders for 16 cars. Tuning is indirect (slip curves are not intuitive).
- **Rejection Reason:** The GDD explicitly requires arcade handling (high grip, forgiving, 4PGP/Horizon Chase). WheelCollider is the wrong tool for this feel. The custom grip model gives direct control over the exact formula and is trivially tunable.

### Alternative 2: DOTS/ECS with Unity Physics

- **Description:** Use Entities package, Burst compiler, and custom physics via `IJobEntity`. All vehicle state in ECS components.
- **Pros:** Maximum performance (SIMD Burst, multi-threaded). Deterministic physics within Unity Physics (not PhysX). Native job system integration.
- **Cons:** DOTS package is NOT installed and would need to be added. Steep learning curve. Future networking-provider compatibility is not a reason to adopt DOTS before a Beta SDK decision. Overkill for 16 cars at 60 Hz — PhysX handles this trivially. Migration seam (IVehicleDriver) preserves the option to adopt DOTS later if scaling demands it.
- **Rejection Reason:** Not needed for MVP. The IVehicleDriver seam keeps the door open without incurring DOTS complexity now.

## Consequences

### Positive

- **Fastest path to implementation:** Rigidbody is the default Unity physics pattern. All Unity developers know it.
- **Arcade tuning is direct:** The grip formula is explicit C# math, testable in isolation without Unity. Change one float, see the result immediately.
- **No new dependencies:** Uses installed packages only (Unity Physics 3D, Unity.Mathematics). Addressables used only for car definition data loading.
- **Migration path preserved:** IVehicleDriver seam allows future DOTS swap without rewriting game logic.
- **Testable:** `GripMath` is pure C# — write NUnit tests that never need a Rigidbody or scene.
- **All engine APIs verified:** Breaking changes (velocity→linearVelocity, drag→linearDamping) accounted for.

### Negative

- **PhysX is not deterministic cross-platform:** Same as ADR-0001. Ghost replay and multiplayer (future) will need corrective snapshots or DOTS migration.
- **Threading:** All force application and CarState readout runs on the main thread. For 16 cars this is well within budget, but limits future scale.
- **Rigidbody overhead:** Each car carries a full PhysX Rigidbody (collision detection, sleep management, joint constraints) even though most features are unused. Negligible for 16 cars.

### Risks

- **16-car budget not validated:** The simulation budget (p95 ≤ 6 ms) is estimated from documentation, not profiled. Mitigation: Week 1 prototype spike with 16 cars before building track or AI content.
- **Custom grip math may need iterative tuning:** The arcade feel requires subjective tuning, not just formula correctness. Mitigation: GripMath parameters are exposed as tuning knobs in the Vehicle Physics GDD; dedicated tuning pass after first playable build.
- **IVehicleDriver abstraction may leak:** The interface now uses `VehicleHandle` instead of `Rigidbody` — this avoids leaking the Unity type. However, if the Rigidbody implementation relies on PhysX-specific features (continuous collision, compound colliders), the DOTS replacement may still need different collision handling. Mitigation: MVP uses simple colliders (box + wheel-shaped triggers). DOTS path may need simplified collision shapes.
- **Collision events need a MonoBehaviour:** VehiclePhysicsSystem is a standalone class and cannot receive `OnCollisionEnter`. Each car requires `CarCollisionMonitor : MonoBehaviour` to forward collision events. This is trivially implementable but is an explicit architecture seam that must be documented at implementation time.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| vehicle-physics.md | Arcade handling model (4PGP/Horizon Chase feel) | Custom grip formula (GripMath.ComputeEffectiveGrip) over Rigidbody forces — not WheelCollider slip curves |
| vehicle-physics.md | `effective_grip = clamp(grip_base × surface × tire, 0.20, 1.20)` (no stability term) | Pure C# math in GripMath, testable without Unity |
| vehicle-physics.md | 5 car states (Driving/OffTrack/WallHit/Pitting/GridLocked) | VehicleSimState.Flags, evaluated per tick in pure C# |
| vehicle-physics.md | CarState[16] per physics tick (Position, Rotation, LinearVelocity, SpeedKmh, Rpm, Gear, Throttle, Brake, Steer, IsGridLocked, Surface, PitPhase, State, SlipState, SlideState, WallContact, ForwardDot) | ReadCarState() at Tick Step 9 after Physics.Simulate. CarState now includes LinearVelocity (float3 for AI) and ForwardDot (float for RSM). gripState split into State (5-state machine) + SlipState (Normal/Slipping/SpinOut) |
| vehicle-physics.md | Steering is instant at physics boundary (no input ramp) | steerOut applied directly without additional smoothing layer |
| vehicle-physics.md | 1-state steering: maxYaw = min(steerCeiling(v), v/minTurnRadius, gripCeiling) | Steering model in ComputeMaxYaw; global knobs (maxSteerLow 2.5, maxSteerHigh 1.5, liftOffSteerBonus 0.5, minTurnRadius 10, falloff start 60); grip is the anti-slide ceiling |
| vehicle-physics.md | Lift-off grip bonus (tuck-in), fixed +3 g | Added to maxLateralAccel in both the yaw request and the velocity rotation rate when throttle ≤ 0 |
| vehicle-physics.md | Wall contact 0.2-0.5s persist, bounce impulse reduction 50% | WallHit state timer + impulse scaling in pure C# |
| vehicle-physics.md | Car-to-car collision 15-25% speed loss + push impulse | Post-collision speed evaluation in pure C# after Physics.Simulate |
| vehicle-physics.md | `Rigidbody.interpolation = None`, manual LateUpdate interpolation | Applied via IVehicleDriver adapter; interpolation owned by Simulation Architecture |
| simulation-architecture.md | 14-step tick pipeline, manual accumulator | VehiclePhysicsSystem.SimulateTick() called at Step 6, Physics.Simulate at Step 7, CarState read at Step 9 |
| simulation-architecture.md | All sim math uses Unity.Mathematics | VehicleSimState uses float3/quaternion, GripMath uses math.* |
| car-definition-data.md | 6 stats mapped to performance formulas | Stats consumed as data by force calculation; CarDefinition loaded once at race init via Addressables |
| tire-system.md | `tire_runtime_grip_multiplier` consumed in grip stack | Consumed at Tick Step 6 as part of effective_grip formula |
| fuel-system.md | Low-fuel speed modifier (+1% top speed below 25%) | Applied as post-force longitudinal multiplier |
| grid-start.md | Perfect Start 1.15× drive force for 600 ticks | `perfectStartDriveForceMultiplier` applied to `longitudinalDriveForceFinal` |
| track-system.md | Surface grip modifiers (asphalt 1.0, kerb 0.85, grass 0.3, etc.) | Consumed as surfaceMultiplier in GripMath, provided by TickStartSnapshot |

## Performance Implications

| Metric | Expected Impact | Notes |
|--------|----------------|-------|
| **CPU** | ~0.5–1.5 ms per tick (16 cars) | Force calc + CarState readout in C#. Physics.Simulate cost dominant. Must profile in Week 1 prototype to validate ≤6 ms total budget |
| **Memory** | ~2 KB per car (VehicleSimState + CarState structs) | Struct arrays, no per-car heap allocation. Rigidbody overhead is Unity-managed (~1–2 KB per RB) |
| **Load Time** | Negligible | No asset loading at race start beyond CarDefinition ScriptableObjects |
| **Network** | None (MVP offline) | Multiplayer (future Beta) may need kinematic state serialization |

## Migration Plan

N/A — this is a greenfield MVP. No existing code to migrate.

If DOTS migration is ever needed:
1. Implement `DOTSVehicleDriver : IVehicleDriver` using Unity Physics (ECS) `IJobEntity`
2. Replace `RigidbodyVehicleDriver` at `VehiclePhysicsSystem` construction time
3. All game logic (GripMath, state machine, CarState production) remains unchanged
4. Re-profile to validate the simulation budget improvement

## Validation Criteria

- [ ] Prototype with 16 identically-behaving cars running full VehiclePhysicsSystem tick meets simulation budget: p95 ≤ 6 ms, max ≤ 8 ms, measured over ≥60s
- [ ] `GripMath.ComputeEffectiveGrip()` has unit test coverage for boundary conditions (grip floor at 0.20, ceiling at 1.20, intermediate values)
- [ ] `CarState` produced every tick matches the schema in vehicle-physics.md Section 5
- [ ] All 5 car states reachable and observable in CarState (Driving, OffTrack, WallHit, Pitting, GridLocked)
- [ ] Perfect Start 1.15× multiplier active for exactly 600 ticks after GO
- [ ] High-speed steer reduction activates within 65–75% transition band
- [ ] Wall contact cooldown (0.2–0.5s) and repeated-bounce reduction (50%) verified
- [ ] Lift-off rotation assist does not re-trigger within 0.3s
- [ ] `Rigidbody.linearVelocity` and `linearDamping` used throughout (not `velocity` or `drag`)
- [ ] No `FixedUpdate()`, `Time.fixedDeltaTime`, or `Time.deltaTime` used in VehiclePhysicsSystem
- [ ] No `UnityEngine.Random` calls on simulation path
- [ ] Pure C# grip tests pass without a Unity scene (NUnit EditMode test)

## Related Decisions

- ADR-0001: Manual Simulation Authority and Determinism Boundary (tick pipeline, Physics.Simulate, interpolation ownership)
- ADR-0006: Fuel/Tire State Ownership & Tick Timing (forthcoming — depends on this ADR for tick position)
- ADR-0010: Camera-VFX Rendering Budget & Interpolation (forthcoming — depends on this ADR for CarState schema)
