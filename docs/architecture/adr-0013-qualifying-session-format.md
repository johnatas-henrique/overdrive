# ADR-0013: Qualifying Session Format

## Status

Accepted

## Date

2026-07-31

## Reviewed

2026-08-01 (architecture-review-2026-08-01.md — PASS)

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Core / Gameplay |
| **Knowledge Risk** | LOW — qualifying is pure game logic, no engine-specific APIs |
| **References Consulted** | `design/gdd/qualifying.md`, `design/gdd/grid-start.md`, `design/gdd/simulation-architecture.md`, `design/gdd/race-session-manager.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | AI time determinism across runs; grid position calculation; pit exit spawn position |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (Simulation Authority — Racing state, tick pipeline), ADR-0006 (Fuel/Tire — qualifying fuel load, no tire wear), ADR-0009 (AI Rival — deterministic qualifying times), ADR-0011 (Pit Stop — pit service blocked during qualifying) |
| **Enables** | Grid & Start (receives GridAssignment), HUD (qualifying timer), Results (qualifying results display) |
| **Blocks** | Qualifying implementation |
| **Ordering Note** | Must be accepted before qualifying system is built |

## Context

### Problem Statement

Qualifying has 3 gaps in the traceability matrix (TR-qual-004, TR-qual-005, TR-qual-006). No ADR documents:
1. The qualifying format (single flying lap, one attempt, no retry)
2. Skip/fail behavior (P16 grid position)
3. Tier order behavior (not artificially preserved)

These decisions exist only in `qualifying.md` — they need architectural recording to prevent implementation drift.

### Constraints

- Qualifying is a `RaceMode` within `SimulationState.Racing` (per ADR-0001)
- No Countdown, no grid lock — qualifying enters Racing directly after `RaceLoadReady(RaceMode.Qualifying)`
- Fuel is computed minimum (not player-managed)
- Tire wear is disabled (100% grip throughout)
- Pit stop is blocked during qualifying
- AI times are deterministic (PCG32 per race seed + carId)

### Requirements

- Must produce a deterministic `GridAssignment { carId → gridSlot[1..16] }` for RSM
- Must support skip (player chooses not to qualify) and fail (crash/spin/no time)
- Must generate 15 AI qualifying times using DifficultyProfile
- Must spawn player at pit box for out-lap before flying lap
- Must record player's qualifying time and compare against AI times

## Decision

Qualifying uses a **single flying lap format** with one attempt and no retry.

### QualifyingPhase Enum

```csharp
public enum QualifyingPhase : byte {
    OutLap,      // Player driving from pit box to start/finish line
    FlyingLap,   // Timed lap — timer active
    Finished     // Lap completed or failed — session over
}

public enum QualifyingResult : byte {
    Completed,   // Player finished flying lap — time recorded
    Failed,      // Crash/spin/DNF — no time recorded
    Skipped      // Player chose to skip — no time recorded
}
```

- `QualifyingPhase` tracks the current session state
- `QualifyingResult` tracks the outcome (separate from phase)
- Both are owned by Race Session Manager

### Session Flow

```
1. Player selects "Start Qualifying" on Qualifying Not Started screen
2. Content Pipeline loads qualifying assets (track + car bundles already loaded from race)
3. Simulation enters Racing/GameplayQualifying directly (no Countdown)
4. Player spawns at pit box — car is stationary, engine running
5. Player drives out-lap through pit lane onto track
6. Player crosses start/finish line → timer starts (flying lap begins)
7. Player completes flying lap, crosses start/finish line → timer stops
8. Finished Presentation (up to 5s, skippable via Confirm)
9. Qualifying Results screen (all 16 positions with times)
10. Player confirms "Start Race" → Loading → Countdown → Race
```

### Spawn Position

- **Location:** Pit box (assigned by boxId from TrackData.PitLaneDefinition)
- **State:** Car stationary, engine running, pit lane speed limit active
- **Player control:** Full driving controls active (Accelerate, Brake, Steer, Pause)
- **No countdown:** Player drives when ready

### Out-Lap

- Player drives from pit box through pit lane onto track
- Pit lane speed limit enforced: `pitSpeedLimitKph` from TrackData (same limit as race)
- No fuel consumption during out-lap (fuel only consumed during flying lap)
- No tire wear during out-lap
- Timer does NOT start during out-lap
- Phase: `QualifyingPhase.OutLap`

### Flying Lap

- Phase: `QualifyingPhase.FlyingLap`
- **Timer starts:** when player crosses start/finish line after out-lap (rising edge detection on spline position wrap)
- **Timer stops:** when player crosses start/finish line again (second wrap)
- Fuel consumption active — qualifying fuel load = `min(8.0L, fuel_rate × reference_time × 1.10)`, enough for 1 full lap at limit with 10% margin
- No tire wear
- Pit stop blocked
- If player fails to cross start/finish line (crash, spin, out of fuel): timer never stops, phase transitions to Finished with `QualifyingResult.Failed`

### Skip Behavior

If player selects "Skip" on Qualifying Not Started screen:
- Phase: `QualifyingPhase.Finished`
- Result: `QualifyingResult.Skipped`
- AI times are still generated (grid is populated)
- Player grid position = 16 (last)
- No out-lap, no flying lap
- Player labeled **DNQ** (Did Not Qualify) in Qualifying Results
- Qualifying Results displayed with all 16 positions

### Fail Behavior

If player crashes, spins, or fails to complete the flying lap:
- Phase: `QualifyingPhase.Finished`
- Result: `QualifyingResult.Failed`
- No time recorded
- Player grid position = 16 (last)
- No retry — one chance only
- Player labeled **DNQ** (Did Not Qualify) in Qualifying Results

### Slow Completion

If player completes the flying lap but is slowest:
- Phase: `QualifyingPhase.Finished`
- Result: `QualifyingResult.Completed`
- Time IS recorded and displayed
- Player grid position = 16 (or wherever their time places them)
- Player sees their actual time in Qualifying Results (not DNQ)

### AI Qualifying Times

AI times are generated deterministically before qualifying starts:

```
precision_penalty = 1 - profile.ai_precision
error_penalty = PCG32Float01 × 0.005 × profile.ai_error_multiplier
pace_variation = PCG32Range(-profile.pace_noise, +profile.pace_noise)
ai_time = track_reference_lap_time × tier_modifier × (1 + precision_penalty + error_penalty + pace_variation)
```

**tier_modifier:** Tier 1 = 1.00, Tier 2 = 1.015, Tier 3 = 1.035, Tier 4 = 1.055

### Tier Order

Tier order is NOT artificially preserved. On forgiving difficulty profiles, deterministic AI imprecision may allow a lower-tier car to outqualify a higher-tier car. This is intentional — it creates natural grid variety.

### Grid Position Calculation

```
grid_position = rank(qualifying_times, ascending, stable_car_id)
```

- Fastest time = position 1
- Ties broken by stable car ID (deterministic)
- Player's time compared against 15 AI times
- If player skips: grid_position = 16

### GridAssignment

When qualifying completes or is skipped, RSM locks `GridAssignment { carId → gridSlot[1..16] }`. This is immutable and travels through `TransitionRequest(Loading, QualifyingComplete, gridAssignment)` to Content Pipeline and Grid & Start.

### Finished Presentation

Qualifying uses the **same Finished Presentation system as race** (per ADR-0001):
- Up to 5 seconds timer, owned by UI Presentation controller
- Confirm (Enter/South) advances immediately
- Cancel (Escape/East) is ignored
- Pause available
- `resultKind = Qualifying` in PostFinishSnapshot
- No physics, fuel, tire, or AI runs after finish

### Cross-References to Other ADRs

| ADR | Relationship | Details |
|-----|-------------|---------|
| ADR-0001 | Depends on | Qualifying enters Racing/GameplayQualifying directly (no Countdown). Finished Presentation shared. PostFinishSnapshot carries `resultKind = Qualifying`. GridAssignment in TransitionRequest. |
| ADR-0006 | Depends on | Qualifying fuel load = `min(8.0L, fuel_rate × reference_time × 1.10)`. Tire wear disabled (100% grip). Fuel rate supplied by FuelSystem. |
| ADR-0009 | Depends on | AI qualifying times generated via PCG32. Same DifficultyProfile as race. Tier order not preserved. |
| ADR-0011 | Depends on | Pit stop blocked during qualifying. Pit lane entry zone detected by Vehicle Physics but service not triggered. |

## Alternatives Considered

### Alternative 1: Multiple Laps with Best Time
- **Description:** Player gets 3 laps, best time counts (F1 1991 style)
- **Pros:** More forgiving, closer to real F1
- **Cons:** 3× longer session, more complex timer logic, not in GDD
- **Rejection Reason:** GDD specifies single flying lap. MVP scope is minimal.

### Alternative 2: Qualifying Sessions (Q1/Q2/Q3)
- **Description:** Three elimination sessions like modern F1 (Q1/Q2/Q3)
- **Pros:** Most realistic
- **Cons:** Way too complex for MVP, requires elimination logic, multiple grids
- **Rejection Reason:** Out of scope for MVP. Could be Alpha+ addition.

### Alternative 3: No Out-Lap (Spawn on Track)
- **Description:** Player spawns on track near start/finish line, immediate flying lap
- **Pros:** Fastest start
- **Cons:** No acclimatization, unrealistic, no pit lane experience
- **Rejection Reason:** User chose pit box spawn for acclimatization.

## Consequences

### Positive
- **Simple implementation:** One lap, one timer, one result
- **Deterministic:** Same inputs = same grid (PCG32 + DifficultyProfile)
- **Clear skip/fail:** P16 is unambiguous, no complex edge cases
- **Out-lap acclimatization:** Player gets familiar with car/track before timed lap

### Negative
- **No retry:** Frustrating for some players — intentional design choice (consequence matters)
- **Short session:** ~1-2 minutes total (out-lap + flying lap) — may feel brief

### Risks
- **Pit box position varies by track:** Pit box placement differs per track layout (some before start/finish, some after). Must verify spawn position per track.
- **Mitigation:** Pit box position is data-driven (from TrackData), not hardcoded.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| qualifying.md | Single flying lap format, one chance, no retry | §Decision: Session Flow, Flying Lap |
| qualifying.md | Skip/fail = P16 grid position, no retry | §Decision: Skip Behavior, Fail Behavior |
| qualifying.md | Tier order not preserved | §Decision: Tier Order |
| qualifying.md | AI deterministic times | §Decision: AI Qualifying Times |
| qualifying.md | Grid position calculation | §Decision: Grid Position Calculation |
| qualifying.md | GridAssignment via RSM | §Decision: GridAssignment |
| qualifying.md | Finished Presentation | §Decision: Finished Presentation |
| qualifying.md | Fuel during qualifying | §Decision: Flying Lap (fuel load formula) |
| qualifying.md | Tire wear disabled | §Decision: Flying Lap (no wear) |
| qualifying.md | Pit blocked | §Decision: Cross-References (ADR-0011) |
| grid-start.md | GridAssignment received from RSM | §Decision: GridAssignment |
| simulation-architecture.md | Qualifying enters Racing directly | §Decision: Session Flow (step 3), Cross-References (ADR-0001) |
| race-session-manager.md | resultKind = Qualifying | §Decision: Finished Presentation |

## Performance Implications

- **CPU:** Negligible — single car physics, no multi-car simulation during out-lap
- **Memory:** Same as race (track + car bundles already loaded)
- **Load Time:** Minimal — reuses race-loaded assets via RaceReconfigure (no unload/reload)

## Validation Criteria

- [ ] Player spawns at pit box with engine running
- [ ] Out-lap: pit lane speed limit enforced (80 km/h)
- [ ] Flying lap: timer starts on start/finish line crossing
- [ ] Flying lap: timer stops on second start/finish line crossing
- [ ] Skip: player at P16, AI times generated
- [ ] Fail (crash/spin): no time recorded, player at P16
- [ ] GridAssignment deterministic across runs with same seed
- [ ] AI times match formula within ±0.001s tolerance
- [ ] Tier order not preserved when DifficultyProfile allows cross-tier outqualification

## Related Decisions

- ADR-0001: Simulation Authority (Racing state, tick pipeline, Countdown bypass)
- ADR-0006: Fuel/Tire (qualifying fuel load, no tire wear)
- ADR-0009: AI Rival (deterministic PCG32 qualifying times)
- ADR-0011: Pit Stop (pit lane blocked during qualifying)
