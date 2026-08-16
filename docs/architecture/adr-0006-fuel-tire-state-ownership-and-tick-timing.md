# ADR-0006: Fuel/Tire State Ownership and Tick Timing

## Status

Accepted

## Date

2026-07-27

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Core / Simulation |
| **Knowledge Risk** | LOW — Fuel and Tire are pure C# math. No engine APIs used. |
| **References Consulted** | `design/gdd/fuel-system.md`, `design/gdd/tire-system.md`, `design/gdd/vehicle-physics.md`, `design/gdd/car-definition-data.md`, `docs/architecture/architecture.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Tick timing: Fuel + Tire must complete within 0.2 ms combined for 16 cars. Profiled in Week 1 prototype. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (tick pipeline Step 5 slot, frame-first accumulator). ADR-0002 (grip stack, ResolvedCarInput, CarState schema) |
| **Enables** | Pit Stop (reads fuel/tire fraction). HUD (reads FuelState, TireState). AI Rival (fuel/tire strategy projection) |
| **Blocks** | Fuel and Tire implementation work |
| **Ordering Note** | ADR-0006 refines Step 5 of the canonical 14-step pipeline (ADR-0001) into sub-steps 5a and 5b. Pipeline was expanded from ADR-0001's original 13 steps to 14 (counters step inserted after RSM). See pipeline listing below. |

## Context

Fuel and Tire are paired because both consume `ResolvedCarInput[carId]` (throttle for fuel consumption, steer for tire aggression / slide calculation) and both produce modifiers consumed by Vehicle Physics' grip stack at Step 6. Their tick position must be before `Physics.Simulate` (Step 7) so the `effective_grip` formula includes current tire wear and low-fuel speed bonus.

### Registry Check

Existing architectural stances confirmed:
- **CarState[16]** → vehicle-physics-system (ADR-0002). Fuel/Tire read CarState fields (surface, speed, slideState) but must NOT write them.
- **ForceMode.Force** — grip modifiers must use the mass-aware force model defined by ADR-0002; `ForceMode.Acceleration` is prohibited on this path.
- **Forbidden pattern: physics_callback_mutates_gameplay_state** — Fuel/Tire are pure C# per-tick, no physics callbacks.
- **efficiency_modifier** → car-definition-data (ADR-0015). FuelSystem and TireSystem read `CarDefinition.Stats.Efficiency` at race init and store it as a per-car scaling factor. The formula is a tuning knob defined in ADR-0015. This ADR consumes the modifier but does not define it.

## Decision

Fuel System and Tire System are **separate domain systems** executing as sub-steps 5a and 5b within the canonical Step 5, before `Physics.Simulate` (Step 7). Both are **pure C# math** operating on `ResolvedCarInput[carId]` and producing value-type structs. Neither system references any Unity engine type.

### Key Interfaces

```csharp
// Fuel System — pure C# per tick, no Unity API calls
public class FuelSystem {
    public FuelState Tick(
        ResolvedCarInput[] inputs,
        TickStartSnapshot snapshot, // read-only: PitServiceCommand[carId] (pit refueling)
        SimulationState state,
        float deltaTime
    );
}

public struct FuelState {
    public float currentFuel;        // 0–8.0 (liters)
    public float fuelFraction;       // 0–1.0 (0–100%)
    public FuelStateEnum state;      // Full | Conserving | Critical | Empty
    public float topSpeedModifier;   // 1.0 normal, 1.01 below 25% (low-fuel bonus)
    public float lastLapFuelUse;     // consumed last completed lap (for Pit advisory)
    public bool lowFuelActive;       // true when fuel < 25%
}

// Tire System — pure C# per tick, no Unity API calls
public class TireSystem {
    public TireState Tick(
        ResolvedCarInput[] inputs,
        TickStartSnapshot snapshot,     // read-only: surfaceWearMultiplier[carId], speed, slideState, PitServiceCommand[carId]
        SimulationState state,
        float deltaTime
    );
}

public struct TireState {
    public float wearFraction;            // 0.0–1.0 (0–100% wear)
    public float runtimeGripMultiplier;   // 0.20–1.0 (linearly decreasing from 1.0 at 0%)
    public TireCompoundId compoundId;     // current compound
    public float lastLapTireWear;         // wear delta on last completed lap (for Pit advisory)
}
```

### Tick Pipeline Position

```
Step 1:  Simulation.AdvanceClock()
Step 2:  Input tick processor consumes the frame's captured RawInputSample → ResolvedCarInput
Step 3:  Consume Pause
Step 4:  Decrement Countdown (if active)
Step 5a: FuelSystem.Tick() → FuelState[16]               [consumes throttle from Step 2; during PitServiceCommand.active, applies refuel rate]
Step 5b: TireSystem.Tick() → TireState[16]               [consumes surfaceWearMultiplier from TickStartSnapshot; during PitServiceCommand.active, resets wear after 2s]
Step 6:  VehiclePhysics.SimulateTick() → grip stack       [consumes topSpeedModifier + runtimeGripMultiplier]
Step 7:  Physics.Simulate(FIXED_DT)
Step 8:  GridLock release (GO tick)
Step 9:  VehiclePhysics.ReadCarState() → CarState[16]
Step 9b: PitStopSystem.Tick() — read PitPhase, advance service timer
Step 10: RSM produces TransitionRequest
Step 11: Simulation increments counters (raceStepCount)
Step 12: Simulation publishes snapshot
Step 13: AI reads snapshot → produces AIInput
Step 14: Simulation resolves next-tick ResolvedCarInput
```

### Pit-Mode Behavior

When `TickStartSnapshot.PitServiceCommand[carId].active == true`:
- **FuelSystem** applies refuel rate (0.8 L/s) to `currentFuel` toward `PitServiceCommand.targetFuel`. Fuel does not drain during pit service.
- **TireSystem** reads `PitServiceCommand[carId].tireSwapRequired` and advances a `pitServiceTimer` internally. After 2s of continuous active service, sets `wearFraction = 0` (fresh tires). Tire does not wear during pit service.
- Both systems resume normal consumption/wear on the first tick after `PitServiceCommand.active == false`.

The pit behavior is gated by reading `PitServiceCommand[carId]` from TickStartSnapshot — not by CarState.PitPhase. This is the formal pit-service contract (ADR-0011), consistent with the read-only input contract.

### Surface Data Source

Surface modifiers are owned by Track System. Track exposes `float[] surfaceWearMultiplier` (per car, singular field name) and `float[] surfaceGripMultiplier` (per car) via TickStartSnapshot. TireSystem reads surfaceWearMultiplier from the snapshot — no direct track dependency.

On the first Racing tick (no previous CarState with valid surface), surface defaults to Asphalt (wear multiplier 1.0, grip multiplier 1.0).

### Materialization Structure

`lastLapFuelUse` and `lastLapTireWear` are NOT computed inside the per-tick `Tick()` call. They are updated via RSM `LapCompleted` event subscription at Step 10 — the system snapshots the value at lap boundary and publishes it on the next `LapCompleted` trigger. The per-tick `Tick()` only consumes inputs and produces current-tick state.

### Lifecycle Integration

**Countdown gating:** FuelSystem.Tick and TireSystem.Tick are called every tick but produce no changes when `SimulationState != Racing`. The `state` parameter gates consumption — fuel does not drain, tires do not wear. This ensures replay replay state captures the exact pre-GO configuration.

**Qualifying initialization:** Fuel loads a reduced amount per fuel-system.md: `min(8.0L, fuel_rate × reference_flying_lap_time × 1.10)`. Tire starts at zero wear and wear accumulation is disabled for the single flying lap.

## Consequences

- **Clear pipeline order:** Step 5a (Fuel) → Step 5b (Tire) → Step 6 (grip stack). No circular dependencies.
- **Modifier freshness:** Tire grip multiplier computed before grip stack evaluates.
- **Separability:** Both systems testable independently via EditMode NUnit (pure C# inputs → expected outputs).
- **No API dependency:** No Unity API calls in either system — compatible with any engine version.

## Validation Criteria

- [ ] Tick pipeline order: Step 5a (Fuel) → Step 5b (Tire) → Step 6 (VP grip) — consistent with ADR-0001's 14-step pipeline
- [ ] `effective_grip` at Step 6 includes current tick's `runtimeGripMultiplier` and `topSpeedModifier`
- [ ] Low-fuel bonus (+1% top speed) activates at `fuelFraction < 0.25`
- [ ] Tire `runtimeGripMultiplier` linearly decreases from 1.0 at `wearFraction=0` to 0.20 at `wearFraction=1.0`
- [ ] 16-car Fuel + Tire tick completes within 0.2 ms combined (profiled)
- [ ] No Unity API calls in FuelSystem or TireSystem (EditMode test)
- [ ] Countdown: fuel and tire do not change during non-Racing states
- [ ] Pit InPitBox: FuelSystem applies refuel rate (0.8 L/s) instead of consumption
- [ ] Pit InPitBox: TireSystem resets wearFraction to 0 after 2s continuous InPitBox

## Related Decisions

- ADR-0001: Tick pipeline ordering (Step 5 slot for Fuel/Tire)
- ADR-0002: Grip stack integration, CarState, ResolvedCarInput

## GDD Requirements Addressed

| GDD | Requirements |
|-----|--------------|
| fuel-system.md | Fuel consumption formula, FuelState struct, throttle-proportional model, lift-and-coast, low-fuel bonus, lastLapFuelUse for pit advisory |
| tire-system.md | Tire wear formula, TireState struct, runtimeGripMultiplier, continuous linear grip curve, lastLapTireWear |
| vehicle-physics.md | Grip stack consumes topSpeedModifier + runtimeGripMultiplier at Step 6 |
| simulation-architecture.md | Step 5a/5b pipeline position, countdown gating, qualifying reduced fuel + no wear |
| pit-stop.md | Pit refueling and tire swap via TickStartSnapshot.PitServiceCommand (Option B) |
