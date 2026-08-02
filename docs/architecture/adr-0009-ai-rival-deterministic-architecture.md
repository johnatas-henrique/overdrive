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
// AI Rival — deterministic per race seed
public class AiRivalSystem {
    public AiRivalSystem(Pcg32 seed, AiArchetype[] archetypes, TrackData track);
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
Step 12: Simulation publishes snapshot (CarState[16], FuelState[16], TireState[16], TrackData)
Step 13: AiRivalSystem.Tick(snapshot) → AIInput[16] (player slot unused)
Step 14: Simulation resolves ResolvedCarInput[16] (player SimulationInput + cached AIInput)
```

Pipeline numbering per ADR-0001 (14-step: ADR-0001 + Step 9b per ADR-0011). AI reads at Step 13 after snapshot publish at Step 12.

**Timing note:** Step 14 produces `ResolvedCarInput` for the **next** tick. It is assembled into `TickStartSnapshot` at Step 1 of tick N+1 and consumed by FuelSystem (Step 5a) and TireSystem (Step 5b). This is the canonical 1-tick latency between AI decision and physics effect.

### Determinism

- Each race seeds one `Pcg32` per car from the main `SimSeed`: `PCG32(SimSeed, carId)`. Each car has an independent deterministic stream.
- Archetypes are data-driven, not random: same seed + same snapshot = same AIInput.
- No `UnityEngine.Random`, no `System.Random`.
- `Pcg32` state is captured in `ReplayInitialState` for ghost replay consistency (Alpha+).

### MVP Scope

- No active obstacle avoidance (car-to-car collision resolved by Vehicle Physics).
- No track limit penalty awareness (wall collisions handled by Vehicle Physics).
- Pit decisions use deterministic resource projection: forecast next-lap Fuel + Tire from observed lap deltas + 110% margin.
- AI finishing time projection uses pace-only (mean of last 2 completed laps) per RSM FinishOrderResolver.
- Qualifying AI times: generated by offline PCG32 projection using the DifficultyProfile time formula (ADR-0013 §AI Qualifying Times) — precision/error/pace fields, not per-tick Tick() execution. ADR-0013 owns the qualifying time formula; ADR-0009 owns the in-race archetype behavior.

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
- [ ] No `UnityEngine.Random` calls on AI path
- [ ] 4 archetypes from ai-rival.md produce distinguishable behavior: steeringErrorAmplitude 0.02 (Cautious) vs 0.10 (Inconsistent), brakeErrorMeters 1.5 vs 6.0
- [ ] PCG32 independent streams: changing one car's seed does not affect other cars' AIInput

## Related Decisions

- ADR-0001: Published snapshot timing (Step 11), PCG32 determinism
- ADR-0002: Vehicle Physics collision resolution (same path as player)
- ADR-0006: FuelState/TireState for pit resource projection
- ADR-0007: Track racing line for AI path following

## GDD Requirements Addressed

| GDD | Requirements |
|-----|--------------|
| ai-rival.md | 4 archetypes (Consistent/Aggressive/Inconsistent/Cautious), deterministic per-race seed, per-car PCG32, pitProjectionMargin 1.10, same VehiclePhysics as player, no active obstacle avoidance MVP |
| simulation-architecture.md | Step 13 pipeline position (14-step model), PublishedSimulationSnapshot consumer |
