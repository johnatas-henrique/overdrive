# ADR-0001: Manual Simulation Authority and Determinism Boundary

## Status
Accepted

## Date
2026-07-23

**Amended:** 2026-07-25 — cross-document Input/Simulation lifecycle closure

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
CaptureLatestRawSample
→ TickStartSnapshot
→ player SimulationInput + cached AIInput
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
```

The accumulator consumes focus-change notifications before reading `Time.unscaledDeltaTime`; the focus-change frame adds no delta. Focus loss creates an immediate non-physics lifecycle boundary before accumulator evaluation, preserves the remainder and counters, publishes Paused, and requires explicit Resume. It never waits for another fixed tick.

Race Countdown is 300 simulation ticks. The tick that decrements the counter to zero is still Countdown; it releases grid lock after physics and the next tick begins Racing. Fuel, tire wear and race time start only at GO. Qualifying does not use Countdown: after `RaceLoadReady(RaceMode.Qualifying)`, Simulation enters Racing/GameplayQualifying directly.

At GO, before the first Racing tick, Simulation captures immutable ReplayInitialState containing compatible race/content identity, seed, DifficultyProfile, GridAssignment, car IDs, initial Fuel/Tire state, first Racing simulation step, and Perfect Start remaining ticks. MVP records only completed Racing continuous inputs plus ordered standalone Pause/Resume lifecycle events and always discards the buffer. Future Replay starts at the first Racing tick. Alpha cross-machine ghost sharing requires a versioned corrective-snapshot stream whose cadence and payload are defined by a later ADR.

Simulation snapshots one immutable DifficultyProfile at race initialization. It transports AI precision/error/pace fields to AI Rival and player-recovery fields to Vehicle Physics. Car Definition data and formulas never change with Difficulty.

Qualifying and Race share Finished terminal presentation and Results. UI Presentation owns the up-to-5-second timer, pauses it on focus loss, and accepts direct Confirm/Pause routing while generic Cancel is suppressed. Simulation captures PostFinishSnapshot, RSM returns result data, and PublishedSimulationSnapshot carries immutable copies. No PhysX, Fuel, Tire, Pit, collision or tactical AI runs after finish. Continue/Back from Results sends `ContentUnloadRequest`; Simulation remains Results until `ContentUnloadComplete`, then enters Idle.

Before content expansion, the 16-car prototype is profiled on at least three PC machines; the measured tick covers Steps 1–13 excluding rendering/UI. The lowest-cost machine meeting p95 ≤ 6 ms and maximum ≤ 8 ms is recorded in a follow-up ADR. PCG32 remains the only gameplay PRNG. MVP repeatability means the same executable on the same physical machine/environment. Beta canonical multiplayer state must not depend on local PhysX.

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
