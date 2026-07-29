# ADR-0011: Pit Stop Architecture

## Status

Accepted

## Date

2026-07-28

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Core / Pit Stop |
| **Knowledge Risk** | LOW — Pit Stop is pure C# state machine + timer. No engine-version-specific APIs. |
| **References Consulted** | `design/gdd/pit-stop.md`, `design/gdd/fuel-system.md`, `design/gdd/tire-system.md`, `design/gdd/track-system.md`, `design/gdd/camera.md`, `design/gdd/hud.md`, `docs/architecture/architecture.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | 16-car pit entry detection + service timer accuracy in integrated prototype |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0002 (CarState.PitPhase — VP entry detection, 1-tick latency). ADR-0005 (InputContextController disables generic UI in all pit phases; Confirm routes directly to PitStop in PitService context). ADR-0006 (FuelState for refueling, TireState for swap — via TickStartSnapshot PitPhase read, not direct mutation). ADR-0007 (Track pit geometry: 16 boxes, pitSpline, pitToRacingProgress, pitSpeedLimitKph=80). ADR-0009 (AI pitProjectionMargin = 1.10). ADR-0010 (PitCamera activation via PitPhase.InPitBox) |
| **Enables** | Pit Stop implementation, HUD pit advisory, AI pit behavior, PitCamera |
| **Blocks** | None — pit stop can be implemented after Foundation ADRs |
| **Ordering Note** | Pit Stop requires Track JSON format (ADR-0007) finalized for pit geometry |

## Context

Pit Stop is a new domain system owning the pit service lifecycle: entry detection, speed clamping, auto-navigation to box, parallel fuel+tire service, player exit timing, and AI exit logic. It touches 8 other systems (VP, Fuel, Tire, Track, RSM, Camera, HUD, AI) but does not duplicate their owned state — it only triggers actions through them.

### Registry Check

Existing stances relevant to Pit Stop:
- **CarState.PitPhase** → vehicle-physics-system (ADR-0002). VP owns the pit state machine values (Transit, InPitBox, Exiting). PitStopSystem reads PitPhase, triggers transitions.
- **FuelState** → fuel-system (ADR-0006). FuelSystem reads CarState.PitPhase from TickStartSnapshot and applies refuel rate (0.8 L/s) internally during InPitBox — no direct PitStop → FuelSystem call.
- **TireState** → tire-system (ADR-0006). TireSystem reads CarState.PitPhase from TickStartSnapshot and resets wearFraction to 0 after 2s of InPitBox — no direct PitStop → TireSystem call.
- **Track pit geometry** → ADR-0007. Pit Stop consumes pitSpline, pitToRacingProgress, PitBox[16], pitSpeedLimitKph.
- **AI pit projection** → ADR-0009. `AiArchetype.pitProjectionMargin = 1.10` applies to both AI and player pit advisory.
- **PitCamera** → ADR-0010. CameraSystem reads CarState.PitPhase from interpolated visual snapshot. When PitPhase == InPitBox, CameraSystem initiates 0.2s blend to PitCamera. Camera offset is side-aware: reads `PitLaneSide` from TrackData (per-circuit, not direction-derived) and mirrors camera position accordingly (ADR-0007).

## Decision

Pit Stop is an **independent domain system** (`PitStopSystem`) owning the service lifecycle. It does NOT own entry detection (VP does, via CarState.PitPhase), fuel/tire state (FuelSystem/TireSystem own those), or pit geometry (Track owns). It owns only: pit box assignment per car, service timer, player early-exit eligibility, and `PitThisLap` advisory evaluation.

### Key Interfaces

```csharp
// Pit Stop — pure C# state machine + timer
public class PitStopSystem {
    public (PitState[], PitServiceCommand[]) Tick(
        CarState[] carStates,           // PitPhase from VP (1-tick latency)
        TickStartSnapshot snapshot,     // read-only: FuelState, TireState, TrackData
        SimulationState simState,       // gating: non-Racing = no service
        float deltaTime                 // service timer advance
    );
}

public struct PitServiceCommand {
    public bool active;              // true when pit service should be applied
    public float targetFuel;         // 8.0 L (full tank) when fueling
    public bool tireSwapRequired;    // true when tire swap is needed this service
}

public struct PitState {
    public int carId;
    public int assignedBoxId;           // 0-15, assigned at race init
    public PitServicePhase phase;       // NotPitting, PitTransit, InPitBox, PitExiting
    public float serviceTimer;          // seconds elapsed in InPitBox
    public bool tireSwapComplete;       // true after 2s
    public float fuelLoaded;            // liters loaded so far
    public bool playerCanExit;          // true after tireSwapComplete && playerCar
    public bool pitThisLap;             // advisory: true when resources insufficient
}

public enum PitServicePhase : byte {
    NotPitting,
    PitTransit,     // auto-navigating to box (80 km/h clamp active)
    InPitBox,       // service active
    PitExiting      // leaving box, merging to track
}
```

### PitServiceCommand (Formal Pit Contract)

`PitServiceCommand` is the explicit contract between PitStopSystem and FuelSystem/TireSystem. PitStopSystem writes one command per car at Step 9b; Simulation carries it to the next tick's `TickStartSnapshot`, where FuelSystem (Step 5a) and TireSystem (Step 5b) read and apply it.

```csharp
public struct PitServiceCommand {
    public bool active;              // true when pit service should be applied
    public float targetFuel;         // 8.0 L (full tank) when fueling
    public bool tireSwapRequired;    // true when tire swap is needed this service
}
```

Contract rules:
- PitStopSystem sets `active = true` when `PitPhase == InPitBox` and service is in progress
- `active = false` when not pitting, during PitTransit, or after service is complete (PitExiting or NotPitting)
- FuelSystem reads `PitServiceCommand[carId].active` and `targetFuel` — applies 0.8 L/s toward targetFuel when true
- TireSystem reads `PitServiceCommand[carId].active` and `tireSwapRequired` — resets `wearFraction = 0` after 2s of continuous InPitBox when true
- Neither FuelSystem nor TireSystem mutate `PitServiceCommand` — it is read-only at consumption

### Data Flow

```
Entry detection (next-tick per VP GDD):
  Tick N:   VP detects car crossed pit-entry zone via Physics.Simulate
            → VP queues transition: CarState.PitPhase = PitTransit (next tick)
  Tick N+1: PitStopSystem reads CarState.PitPhase = PitTransit
            → transitions to PitTransit phase

Service (Option B — explicit PitServiceCommand contract):
  PitStopSystem reaches InPitBox phase, writes PitServiceCommand[carId] { active=true, targetFuel=8.0, tireSwapRequired=true }.
  Simulation carries command to next tick's TickStartSnapshot.
  FuelSystem.Tick reads PitServiceCommand[carId].active=true from TickStartSnapshot,
  applies fill rate (0.8 L/s) toward targetFuel internally.
  TireSystem.Tick reads PitServiceCommand[carId].active=true from TickStartSnapshot,
  resets wearFraction to 0 after 2s continuous InPitBox.
  PitStopSystem only manages timer and PitServiceCommand — never writes fuel/tire state directly.
  → after 2s: tireSwapComplete = true
  → playerCanExit = true (if player car)
  → at full tank or player exit: PitStopSystem clears PitServiceCommand (active=false), transitions to PitExiting

Exit:
  PitStopSystem transitions to PitExiting → VP resumes player control
  → RSM publishes PitExit event → CameraSystem reads CarState.PitPhase = PitExiting
  → CameraSystem initiates 0.2s blend back to player-selected mode
  → PitState returns to NotPitting

Advisory (matches pit-stop.md GDD registry `player_pit_advisory`):
  After lap 1 (LapCompleted event), before final lap:
  predicted_fuel = currentFuel - lastLapFuelUse × remainingProgress
  predicted_tire = (1 - currentWearFraction) - lastLapTireWear × remainingProgress
  next_lap_fuel_needed = 1.10 × lastLapFuelUse
  next_lap_tire_needed = 1.10 × lastLapTireWear
  if predicted_fuel < next_lap_fuel_needed OR predicted_tire < next_lap_tire_needed
    → pitThisLap = true

  HUD displays PIT THIS LAP from
  min(0.80, max(0, Track.pitEntryProgress - 0.05)) to Track.pitEntryProgress.

### Pipeline Position

PitStopSystem executes as Step 9b — inserted after VP.ReadCarState (Step 9) and before RSM (Step 10). The canonical 14-step pipeline (ADR-0001) is extended with `9b` between 9 and 10.

Performance budget: ~0.05 ms for PitStopSystem (16-car state read + service timer + advisory evaluation — pure C# counters, no allocations).

```
Step 1-4:  normal tick
Step 5a:   FuelSystem.Tick — fuel consumption (pre-physics)
Step 5b:   TireSystem.Tick — tire wear (pre-physics)
Step 6:    VP.SimulateTick — apply forces
Step 7:    Physics.Simulate — single whole-scene step
Step 8:    GridLock release (GO tick)
Step 9:    VP.ReadCarState — CarState[16] (incl. PitPhase)
Step 9b:   PitStopSystem.Tick — read PitPhase, write PitServiceCommand,
            advance service timer, evaluate pitThisLap advisory
Step 10:   RSM evaluates → TransitionRequest (PitEntry, PitExit events)
Step 11:   Simulation increments counters (raceStepCount)
Step 12:   Simulation publishes snapshot (includes PitState, PitServiceCommand)
Step 13:   AI reads snapshot → AIInput
Step 14:   Simulation resolves ResolvedCarInput
```

## Consequences

- **Clear ownership boundary:** PitStop owns service logic; VP owns entry detection; Fuel/Tire own their state; Track owns geometry.
- **Testable:** Pure C# per-tick evaluation (no Unity API calls).
- **No state duplication:** PitStopState is transient per-tick; persistent FuelState and TireState are never copied.
- **Advisory in HUD:** `pitThisLap` flag is set by PitStopSystem, consumed by HUD — no duplicating the formula.

## Validation Criteria

- [ ] Pit entry detected via CarState.PitPhase → PitStop transitions to PitTransit on tick N+1 (1-tick latency per VP GDD)
- [ ] Service timer at 2s triggers tireSwapComplete; max(timer, fuelTimer governed by FuelSystem) controls total service
- [ ] Player can exit after tireSwapComplete (Confirm in PitService context per ADR-0005); AI always waits for full tank
- [ ] pitThisLap advisory checks BOTH fuel and tire (per registry formula `player_pit_advisory`); warning window clamped to `min(0.80, max(0.0, pitEntryProgress - 0.05))`
- [ ] FuelSystem.Tick and TireSystem.Tick handle fill/swap internally via PitServiceCommand read from TickStartSnapshot — PitStopSystem does not write fuel or tire state, only PitServiceCommand
- [ ] PitCamera activates during InPitBox, blends out on PitExiting (per ADR-0010)
- [ ] No Unity API calls in PitStopSystem (EditMode test)
- [ ] RaceMode.Qualifying suppresses PitEntry (RSM does not publish during qualifying)

## Related Decisions

- ADR-0002: CarState.PitPhase, entry detection via VP
- ADR-0006: FuelState/TireState for service operations
- ADR-0007: Track pit geometry (boxes, spline, speed limit)
- ADR-0009: AI pitProjectionMargin = 1.10
- ADR-0010: PitCamera activation via PitPhase

## GDD Requirements Addressed

| GDD | Requirements |
|-----|--------------|
| pit-stop.md | Service lifecycle (4-phase PitServicePhase), entry detection (1-tick latency), parallel fuel+tire service, service duration formula, early-exit after 2s, PitThisLap advisory (fuel + tire), AI waits for full tank |
| fuel-system.md | Pit refueling at 0.8 L/s via CarState.PitPhase read (Option B — no direct mutation) |
| tire-system.md | Pit tire swap at 2s via CarState.PitPhase read, wearFraction reset |
| track-system.md | Pit geometry consumption (PitBox[16], pitSpeedLimitKph, pitEntryProgress) |
| camera.md | PitCamera activation during InPitBox only, blend on entry/exit |
| hud.md | PIT THIS LAP advisory display |
| input-system.md | Confirm routed to Pit Stop in PitService context (after tire swap eligibility) |
| ai-rival.md | AI uses same pit lane, speed cap, box, service flow as player |
| vehicle-physics.md | CarState.PitPhase write on entry detection, speed clamp to 80 km/h, auto-navigation |
