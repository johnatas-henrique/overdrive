# ADR-0009: AI Rival Deterministic Architecture

## Status

Accepted

## Date

2026-07-27

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Core / AI |
| **Knowledge Risk** | LOW — AI Rival is pure C# behavior logic. No engine-version-specific APIs. |
| **References Consulted** | `design/gdd/ai-rival.md`, `design/gdd/vehicle-physics.md`, `design/gdd/track-system.md`, `docs/architecture/architecture.md`, `design/gdd/simulation-architecture.md`, `design/gdd/race-session-manager.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | PCG32 determinism: same seed + same snapshot sequence = same AIInput across runs |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (`docs/architecture/adr-0001-manual-simulation-authority-and-determinism-boundary.md`: published snapshot Step 12, AI reads at Step 13). ADR-0002 (`docs/architecture/adr-0002-vehicle-physics-implementation-pattern.md`: AI uses same Rigidbody as player). ADR-0006 (`docs/architecture/adr-0006-fuel-tire-state-ownership-and-tick-timing.md`: FuelState/TireState for AI pit projection). ADR-0007 (`docs/architecture/adr-0007-track-spline-format.md`: track racing line for AI path) |
| **Enables** | AI Rival implementation. Qualifying AI time generation (offline PCG32 projection, not runtime Tick) |
| **Blocks** | None — AI can be implemented after Track spline format is finalized |
| **Ordering Note** | AI archetype data (4 archetypes per ai-rival.md) must be finalized before story creation |

## Context

AI Rival controls 15 cars using the same Vehicle Physics system as the player. AI decisions are deterministic per race seed, producing consistent behavior across replays. AI does not have special physics — it uses the same Rigidbody, grip stack, collision resolution, and car stats. All decisions are pure C# evaluation from the published snapshot.

### Registry Check

Existing stances confirmed:
- **CarState[16]** → vehicle-physics-system (ADR-0002). AI reads at Step 13, never writes.
- **FuelState[16]** → fuel-system (ADR-0006). AI reads for pit resource projection.
- **TireState[16]** → tire-system (ADR-0006). AI reads for pit resource projection.
- **No UnityEngine.Random** on simulation path (ADR-0001). PCG32 only.
- **Physics callback forbidden** — AI is pure C# per-tick, no collision callbacks.

## Decision

AI Rival is a **pure C# evaluation system** running at Step 13 of the tick pipeline (14-step model). It reads the published snapshot and produces `AIInput[16]` (indexed by carId; player slot is unused). AI cars use exactly the same `VehiclePhysicsSystem` as the player — no separate AI-only physics simulation.

### Key Interfaces

```csharp
// AI Rival — deterministic per race seed (counter-based PCG32 draws)
public class AiRivalSystem {
    public AiRivalSystem(ulong simSeed, AiArchetype[] archetypes, TrackData track);
    public AIInput[] Tick(PublishedSimulationSnapshot snapshot);
}

public struct AIInput {
    public int CarId;                 // matches architecture.md schema
    public float AccelerateOut;       // 0–1
    public float BrakeOut;            // 0–1
    public float SteerOut;            // -1 to 1
}

// Archetype (data-driven, 4 archetypes per ai-rival.md)
public struct AiArchetype {
    public ArchetypeId id;                    // Consistent, Aggressive, Inconsistent, Cautious
    public float personalityModifier;         // 0.95–1.05 (per-archetype speed adjustment)
    public float steeringErrorAmplitude;      // 0.02–0.10 (per GDD error_amplitude)
    public float brakeErrorMeters;            // 1.5–6.0 m (per GDD brake_error_m)
    public float throttleErrorPercent;        // 1.5–5.0% (per GDD throttle_error_pct)
    public float overtakeAggression;          // 0.6× to 1.3×
    public float defendAggression;            // 0.5× to 1.4×
    public float pitProjectionMargin;         // 1.10 (110% of last lap resource use — deterministic)
}
```

### Pipeline Position

```
Step 12: Simulation publishes snapshot (CarState[16], FuelState[16], TireState[16], PitState[16])
Step 13: AiRivalSystem.Tick(snapshot) → AIInput[16] (player slot unused)
Step 14: Simulation resolves ResolvedCarInput[16] (player SimulationInput + cached AIInput)
```

Pipeline numbering per ADR-0001 (14-step: ADR-0001 + Step 9b per ADR-0011). AI reads at Step 13 after snapshot publish at Step 12.

**Timing note:** Step 14 produces `ResolvedCarInput` for the **next** tick. It is assembled into `TickStartSnapshot` at Step 1 of tick N+1 and consumed by FuelSystem (Step 5a) and TireSystem (Step 5b). This is the canonical 1-tick latency between AI decision and physics effect.

### Determinism

- AI randomness is **counter-based, not stateful**: every random draw is a pure
  function of the race seed, car ID, simulation step, and a per-tick slot
  counter — `PCG32Hash(SimSeed, carId, simulationStepCount, slotId)`. There is
  no mutable per-car stream, so branch-dependent consumption cannot desync
  future draws (a stateful stream would diverge if one code path consumed
  the RNG more times than another).
- `ReplayInitialState` captures only `SimSeed`; every AI draw is re-derivable
  from it, so no RNG state needs to be persisted or restored.
- Archetypes are data-driven, not random: same seed + same snapshot = same AIInput.
- No `UnityEngine.Random`, no `System.Random`, no stateful `Pcg32` instance on
  the AI path.

#### Counter-based draw contract

| Input | Meaning |
|---|---|
| `SimSeed` | Race seed (uint64, per-race, from ReplayInitialState) |
| `carId` | Car index (0–15) |
| `simulationStepCount` | Current tick counter (per ADR-0001) |
| `slotId` | Draw ordinal within the tick (0, 1, 2, …) — stable per call site |

Consumption order within a tick is fixed (declared per archetype); the same
(seed, car, step, slot) quadruple always yields the same value. No AI code
path may draw with a different slot count than its declared schedule.

### MVP Scope

- No active obstacle avoidance (car-to-car collision resolved by Vehicle Physics).
- No track limit penalty awareness (wall collisions handled by Vehicle Physics).
- Pit decisions use deterministic resource projection: forecast next-lap Fuel + Tire from observed lap deltas + 110% margin.
- **Pit restriction (TR-ai-003):** after its first completed lap, each AI pits before a non-final next lap only if post-current-lap resources cannot cover that forecast; it never pits before lap 1 and never before the final lap. AI waits for full fuel in MVP.
- AI finishing time projection uses pace-only (mean of last 2 completed laps) per RSM FinishOrderResolver.
- Qualifying AI times: generated by offline PCG32 projection using the DifficultyProfile time formula (ADR-0013 §AI Qualifying Times) — precision/error/pace fields, not per-tick Tick() execution. ADR-0013 owns the qualifying time formula; ADR-0009 owns the in-race archetype behavior.

### Target-Speed Model (TR-ai-005)

AI target speed is the canonical GDD formula (ai-rival.md:47,210), ratified here: the AI targets
the same speed the player's car would sustain, and **difficulty is an explicit input to the model**
so "AI strength" is tunable per DifficultyProfile.

```text
target_speed = base_speed × state_modifier × personality_modifier × pace_noise × error_noise
applied = min(target_speed, vmax, cornerSpeedFromRacingLine(curvatureAhead), trafficSpeed(carAhead))
```

- `base_speed` = the car's max velocity from Car Definition Data (Top Speed formula: 300 + TS×2) — the same vmax the player's car uses (ADR-0002); difficulty does not multiply it.
- `state_modifier` (0.7–1.1) depends on the AI's current state; `personality_modifier` (0.95–1.05) is the per-archetype adjustment (AiArchetype.personalityModifier).
- `pace_noise` (0.92–1.08) and `error_noise` (0.97–1.03) are deterministic per-tick draws (counter-based PCG32, slot-ordered): `pace_noise = 1 ± DifficultyProfile.pace_noise`; `error_noise = 1 + base_error_noise × DifficultyProfile.ai_error_multiplier` (ai-rival.md:212-214). **Difficulty lives in the model, not only in the error layer.**
- `applied` clamps the product to the car's physical limits: vmax (the GDD clamp), corner capacity from the racing-line curvature ahead (same grip physics as the player, ADR-0002/ADR-0007), and traffic/defensive adjustments. The min-order never boosts the AI above the GDD product — it only prevents physically impossible requests.
- The AI drives the corner with applied × (1 − throttleErrorPercent) and brakes at brakeErrorMeters before the curvature-derived braking point.
- **No AI-only physics:** the model uses exactly the player's car stats and grip formulas (ADR-0002) — the player must never perceive the AI as using different rules.
- GDD acceptance criteria are ratified: neutral Tier 1 (all modifiers 1.0) ≈ 340 km/h before clamps; Tier 4 with Top Speed 8 ≈ 316 km/h.

### Lifecycle Integration

- `lastLapTireWear` and `lastLapFuelUse` are consumed from FuelState/TireState (updated via RSM `LapCompleted` event at Step 10).
- `LapCompleted` from RSM triggers AI pit decision re-evaluation — not per-tick polling.

## Consequences

- **Deterministic:** Same seed + same snapshot sequence = identical AI decisions.
- **Same physics:** No AI-only grip cheats. AI must drive within the same car stats as the player.
- **Testable:** Pure C# with no Unity dependency — EditMode tests with mocked snapshots.
- **Data-driven archetypes:** 4 archetypes per ai-rival.md. Adding a new archetype = data change, no code.

## Validation Criteria

- [ ] Same seed + pre-recorded snapshot sequence produces identical AIInput across 3 consecutive runs
- [ ] AI uses same Vehicle Physics (no separate AI physics) — verified via ResolvedCarInput pipeline
- [ ] AI pit decision fires when resource projection shows insufficient fuel/tire for forecast at 110% margin
- [ ] AI never pits before lap 1 and never before the final lap; AI waits for full fuel (TR-ai-003)
- [ ] No `UnityEngine.Random` calls on AI path
- [ ] 4 archetypes from ai-rival.md produce distinguishable behavior: steeringErrorAmplitude 0.02 (Cautious) vs 0.10 (Inconsistent), brakeErrorMeters 1.5 vs 6.0
- [ ] Counter-based PCG32 draws: changing one car's seed does not affect other cars' AIInput; same (seed, car, step, slot) quadruple yields identical values

## Related Decisions

- ADR-0001: Published snapshot timing (Step 12), PCG32 determinism
- ADR-0002: Vehicle Physics collision resolution (same path as player)
- ADR-0006: FuelState/TireState for pit resource projection
- ADR-0007: Track racing line for AI path following

## GDD Requirements Addressed

| GDD | Requirements |
|-----|--------------|
| ai-rival.md | 4 archetypes (Consistent/Aggressive/Inconsistent/Cautious), deterministic per-race seed, counter-based PCG32 (seed, car, step, slot), pitProjectionMargin 1.10, same VehiclePhysics as player, no active obstacle avoidance MVP, target-speed model (TR-ai-005), lap-1/final-lap pit restriction (TR-ai-003) |
| simulation-architecture.md | Step 13 pipeline position (14-step model), PublishedSimulationSnapshot consumer |
