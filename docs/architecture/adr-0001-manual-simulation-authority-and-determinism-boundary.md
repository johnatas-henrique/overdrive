# ADR-0001: Manual Simulation Authority and Determinism Boundary

## Status
Accepted

## Date
2026-07-23

**Amended:** 2026-07-25 — cross-document Input/Simulation lifecycle closure

**Amended:** 2026-08-05 — TickStartSnapshot no longer carries `RawInputSample[16]` or frame `deltaTime` (single frame-level raw sample passed to Step 2; domain ticks receive explicit `FIXED_DT` — resolves architecture-review C1). PerformanceReduced is now producer-only signal ownership (consumer behavior defined in ADR-0010/ADR-0014; camera collision avoidance never disabled — resolves C2).

## Engine Compatibility

| Field | Value |
|---|---|
| Engine | Unity 6000.3.19f1 |
| Domain | Physics / Core |
| Knowledge Risk | HIGH — Unity 6.3 is post-cutoff |
| Verified APIs | `Physics.simulationMode`, `Physics.Simulate(float)`, `Rigidbody.interpolation`, `Time.unscaledDeltaTime` |
| Required validation | 16-car profiler, same-environment determinism harness, focus/pause test, visual interpolation test |

## ADR Dependencies

| Field | Value |
|---|---|
| Depends On | None |
| Enables | Simulation, Vehicle Physics, AI, RSM, HUD and Content Pipeline implementation |
| Blocks | Implementation until the performance and determinism gates exist |

## Context

The MVP needs local 60 Hz manual PhysX, but PhysX is not a cross-machine canonical state source. Prior GDD text also split lifecycle, countdown timing and per-tick authority across systems.

## Decision

Simulation Architecture is the only writer of `SimulationState`, including `Finished` and `Results`. Race Session Manager owns `RaceMode`, race rules, result resolution and transition requests. Content Pipeline emits mode-specific readiness and unload completion; it never writes SimulationState or starts Countdown/Racing/Idle directly.

MVP uses `Physics.simulationMode = SimulationMode.Script`, one whole-scene `Physics.Simulate(1/60f)` per active tick, and `Rigidbody.interpolation = None`; manual interpolation runs in `LateUpdate`.

Input System processes platform events in Dynamic Update. `InputContextController` is the sole owner of action-map and UI-module activation. At the beginning of the Simulation driver's same `Update()` call, before reading or modifying the accumulator, Simulation invokes Input-owned `CaptureLatestRawSample()` exactly once. No relative MonoBehaviour script-order assumption is permitted.

```text
CaptureLatestRawSample (exactly once, before accumulator evaluation)
→ player SimulationInput + cached AIInput (raw sample passed to Step 2, NOT carried in TickStartSnapshot)
→ TickStartSnapshot (prior domain state + cached AIInput only)
→ Pause consumption and Countdown decrement
→ Tire/Fuel pre-step state
→ force application by ascending carId
→ one whole-scene Physics.Simulate
→ CarState readout by ascending carId
→ RSM events and FinishDetected
→ Simulation-captured PostFinishSnapshot → RSM ResolvedFinishOrder → TransitionRequest
→ Simulation consumes TransitionRequest
→ PublishedSimulationSnapshot
→ Racing continuous-input record
→ AIInput for next tick

### resultClassification Enum

RSM produces a `resultClassification` per car as part of `ResolvedFinishOrder`, capturing why and how the car ended the session. Defined here because it is consumed by Simulation (snapshot publishing, forfeit lifecycle) and owned by RSM:

```csharp
public enum ResultClassification : byte {
    Finished,   // completed all laps under own power
    DNF,        // Did Not Finish — mid-race abandonment
    Forfeit     // Return to Menu from Paused during Countdown or Racing
}
```

Consumption:
- **PublishedSimulationSnapshot** carries `resultClassification[carId]` for Results screen
- **Forfeit** uses `Forfeit` classification with `forfeitLapCount` and `raceTimeAtForfeit` (0 for Countdown forfeit)
- **Ghost Recording** checks classification: `Finished` → buffer eligible for persistence; `DNF/Forfeit` → discard immediately
- **RSM** owns the resolution rules; Simulation publishes the result
```

### TickStartSnapshot Schema

`TickStartSnapshot` is the read-only per-tick input struct consumed by all domain systems (Fuel, Tire, VP, Pit Stop, AI). Its contents are assembled from the previous tick's outputs, gated by SimulationState. The frame-level raw input sample is **not** part of this struct: it is captured once per frame by `CaptureLatestRawSample()` and passed separately to input processing at Step 2 (see ADR-0005 §Single Frame-Level Capture). Domain ticks receive the fixed simulation duration `FIXED_DT` as an explicit argument — never the render-frame `Time.unscaledDeltaTime`.

| Field | Source | Populated By |
|-------|--------|-------------|
| `CarState[16]` | Previous tick VP.ReadCarState | Step 9 of previous tick |
| `FuelState[16]` | Previous tick FuelSystem.Tick | Step 5a of previous tick |
| `TireState[16]` | Previous tick TireSystem.Tick | Step 5b of previous tick |
| `PitServiceCommand[16]` | Previous tick PitStopSystem | Step 9b of previous tick: PitStopSystem writes command; Simulation carries to next tick |
| `AIInput[16]` | Previous tick AI system | Cached AI input for the next tick (Step 12 of previous tick) |
| `TrackData` | Loaded at race init via Content Pipeline | Immutable for race duration |
| `SimulationState` | Simulation owns | Current state + RaceMode from RSM |
| `DifficultyProfile` | Loaded at race init | Immutable for race duration |

Fields are assembled by the Simulation driver before Step 1 and distributed to all domain `Tick()` calls. No system reads from `TickStartSnapshot` before assembly is complete. Multi-tick render frames reuse the single latest raw sample; there is no per-tick raw sample array and no second-missing-tick undefined behavior.

`PitServiceCommand[16]` is the formal pit-service contract: PitStopSystem writes it at Step 9b, Simulation carries it to the next tick's snapshot, and FuelSystem/TireSystem read it at Step 5 to apply refuel/tire-swap. The struct is defined in ADR-0011.

### PostFinishSnapshot Schema

`PostFinishSnapshot` is the immutable terminal-state snapshot captured by Simulation at the lifecycle transition to Finished. It freezes the final race data for Results presentation and ghost disposal; no PhysX, Fuel, Tire, Pit, collision, or tactical AI runs after finish (ADR-0013 reuses the same snapshot with `resultKind = Qualifying`).

| Field | Source | Notes |
|-------|--------|-------|
| `CarState[16]` | Last tick VP.ReadCarState | Final positions, rotations, speeds |
| `FuelState[16]` | Last tick FuelSystem.Tick | Final fuel levels |
| `TireState[16]` | Last tick TireSystem.Tick | Final wear levels |
| `simulationStepCount` | Simulation | Final tick counter |
| `activeRaceStepCount` | Simulation | Final racing tick counter |
| `resultClassification[carId]` | RSM ResolvedFinishOrder | Finished/DNF/Forfeit per car (consumed by Results screen) |
| `resultKind` | RSM | Race or Qualifying — selects destination screen |
| `raceTime` | Simulation `sim_time` | Final clock value |
| `lapTimes[16][]` | RSM | Final lap history per car |
| `raceMode` | RSM | Final session mode |


### PerformanceReduced Signal

When Simulation detects sustained performance degradation (below 30 FPS for 3s), it publishes a `PerformanceReduced` event. **Simulation owns the signal only** — it does not define consumer behavior. Each presentation consumer's degradation behavior is defined in its own ADR:

- **VFX / Camera** — ADR-0010 (VFX moves to Low preset, camera shake disabled; camera collision avoidance is **never** disabled by performance degradation)
- **HUD** — ADR-0014 (discrete performance warning)

When FPS recovers (≥30 for 3s), Simulation publishes `PerformanceRestored` and affected systems restore normal operation. If FPS drops below 15 for 3s after reduction, Simulation pauses the race and offers Resume or Return to Menu.

This signal is owned by Simulation; the threshold rules are defined in simulation-architecture.md and cross-referenced by consuming ADRs.

### Interpolation Phases (LateUpdate)

Simulation architecture produces two interpolation outputs, both computed in **LateUpdate** (after all Update() scripts, before render):

1. **VisualTransform α interpolation:** Lerp/slerp between the previous and current tick's `CarState` (position, rotation) using `α = accumulator / FIXED_DT`. Computed by Simulation driver in LateUpdate.
2. **Consumer read:** CameraSystem, VfxSystem, and AudioSystem read the interpolated VisualTransform and latest `PublishedSimulationSnapshot` in LateUpdate — immediately after the α is computed. This gives zero-frame latency from physics tick to visual output with no jitter (no competing transform writes between Update and render).

Neither Camera, VFX, nor Audio run in DynamicUpdate. All presentation-layer systems (Camera, VFX, Audio, HUD) read from the interpolated state in LateUpdate.

**Presentation ordering (review 2026-08-06 C2):** presentation consumption runs inside a single **PresentationDriver** MonoBehaviour whose LateUpdate executes the fixed sequence: (1) interpolate VisualTransform, (2) CameraSystem.Tick, (3) VfxSystem.Tick, (4) AudioSystem.Tick, (5) HUD update. The driver is the only presentation entry point per frame; no presentation system is invoked from another MonoBehaviour's Update/LateUpdate, and no Script Execution Order configuration is used (relative script order remains forbidden).

The accumulator consumes focus-change notifications before reading `Time.unscaledDeltaTime`; the focus-change frame adds no delta. Focus loss creates an immediate non-physics lifecycle boundary before accumulator evaluation, preserves the remainder and counters, publishes Paused, and requires explicit Resume. It never waits for another fixed tick.

Race Countdown is 300 simulation ticks. The tick that decrements the counter to zero is still Countdown; it releases grid lock after physics and the next tick begins Racing. Fuel, tire wear and race time start only at GO. Qualifying does not use Countdown: after `RaceLoadReady(RaceMode.Qualifying)`, Simulation enters Racing/GameplayQualifying directly.

At GO, before the first Racing tick, Simulation captures immutable ReplayInitialState containing compatible race/content identity, seed, DifficultyProfile, GridAssignment, car IDs, initial Fuel/Tire state, first Racing simulation step, and Perfect Start remaining ticks. MVP records only completed Racing continuous inputs plus ordered standalone Pause/Resume lifecycle events and always discards the buffer. Future Replay starts at the first Racing tick. Alpha cross-machine ghost sharing requires a versioned corrective-snapshot stream whose cadence and payload are defined by a later ADR.

Simulation snapshots one immutable DifficultyProfile at race initialization. It transports AI precision/error/pace fields to AI Rival and player-recovery fields to Vehicle Physics. Car Definition data and formulas never change with Difficulty.

Qualifying and Race share Finished terminal presentation and Results. UI Presentation owns the up-to-5-second timer, pauses it on focus loss, and accepts direct Confirm/Pause routing while generic Cancel is suppressed. Simulation captures PostFinishSnapshot, RSM returns result data, and PublishedSimulationSnapshot carries immutable copies. No PhysX, Fuel, Tire, Pit, collision or tactical AI runs after finish. Continue/Back from Results sends `ContentUnloadRequest`; Simulation remains Results until `ContentUnloadComplete`, then enters Idle.

Before content expansion, the 16-car prototype is profiled on at least three PC machines; the measured tick covers Steps 1–14 excluding rendering/UI. The lowest-cost machine meeting p95 ≤ 6 ms and maximum ≤ 8 ms is recorded in a follow-up ADR. PCG32 remains the only gameplay PRNG. MVP repeatability means the same executable on the same physical machine/environment. Beta canonical multiplayer state must not depend on local PhysX.

## Consequences

### Positive
- Explicit ownership, tick order, pause behavior and future-network boundary.
- Local PhysX remains valid for MVP feel without an invalid cross-machine promise.

### Negative
- AI decisions apply on the tick after their observed snapshot.
- Performance gate can block scope expansion.
- Alpha ghosts need corrective snapshot data.

## GDD Requirements Addressed

| GDD | Requirement |
|---|---|
| Simulation Architecture | Script-controlled 60 Hz loop, interpolation and lifecycle ownership |
| Input System | `SimulationInput` crosses the fixed tick boundary |
| Race Session Manager | RaceMode and explicit result flow |
| Grid & Start | 300-tick countdown and grid lock |
| AI Rival | Deterministic next-tick AI input |
| Ghost Recording | Future replay compatibility without cross-machine PhysX dependency |

## Validation Criteria

1. Representative 16-car prototype meets p95 ≤ 6 ms and max ≤ 8 ms per tick.
2. Five fresh-process same-environment races with identical PCG32 seed/input satisfy GDD tolerance.
3. Focus loss pauses without catch-up; Resume preserves remainder.
4. GO occurs on tick 300 with unchanged fuel/tire/race time before GO.
5. Manual interpolation has no Unity double-interpolation jitter.
6. RawInputSample capture occurs exactly once before accumulator evaluation in the same Simulation-driver Update call.
7. Qualifying readiness enters Racing directly without Countdown; Race readiness enters Countdown with GridAssignment.
8. Results remains active until ContentUnloadComplete.
9. ReplayInitialState recreates the first Racing state including Perfect Start remaining ticks.
