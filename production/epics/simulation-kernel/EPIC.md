# Epic: Simulation Kernel

> **Layer**: Foundation
> **GDD**: design/gdd/simulation-architecture.md
> **Architecture Module**: Simulation Architecture (Foundation Layer — module ownership per docs/architecture/architecture.md:127-134)
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories simulation-kernel`

## Overview

The Simulation Kernel is the fixed-timestep heartbeat of the local MVP. It owns the manual 60 Hz accumulator in `Update()` (not `FixedUpdate`), `SimulationState` authority (sole writer), the 14-step tick pipeline skeleton, the four immutable snapshot schemas, the focus-loss lifecycle boundary, the performance monitor, and the MVP recordable-input buffer. This epic implements the kernel's own spine and contracts with Foundation systems (Input boundary, Settings `DifficultyProfile` snapshot, Content lifecycle handshake) — the Core system integrations are explicitly NOT stories of this epic: each Core epic (Vehicle Physics, Fuel, Tire, Pit Stop, RSM, AI Rival) carries its own pipeline-integration story when created, per the Integration Contract below. The kernel defines the seams; the owners implement their steps.

## Integration Contract (handoff sequence — no retroactive wiring stories)

The 14-step pipeline is the load-bearing skeleton of the MVP. The Kernel publishes each integration seam; the owning system's epic delivers the implementation. **A "wiring story" created after multiple epics to connect systems is a process failure — every integration is born inside the owner's epic.** The contract:

| Pipeline step | Seam published by Kernel | Integration delivered by |
|---|---|---|
| Step 2 — tick processor invocation | `ResolvedCarInput[]` contract (player `SimulationInput` + cached `AIInput`) | Input System epic (Foundation) — Kernel consumes |
| Step 5a/5b — Fuel/Tire runtime state | `TickStartSnapshot` + `PitServiceCommand[carId]` contract | Fuel System / Tire System epics (Core wave) |
| Step 6 — Vehicle Physics forces | `ResolvedCarInput[carId]` + `FIXED_DT`; `CarState[carId]` readout contract | Vehicle Physics epic (Core wave) |
| Step 9b — PitStopSystem | `CarState[].PitPhase` + pit geometry via `TickStartSnapshot` | Pit Stop epic (Core wave) |
| Step 10 — RSM evaluation | `FinishDetected` / `TransitionRequest` / `ResolvedFinishOrder` contracts | Race Session Manager epic (Core wave) |
| Step 13 — AI cache | `PublishedSimulationSnapshot` (read-only) | AI Rival epic (Core wave) |

Handoff sequence (story-level, from PR-EPIC review 2026-08-06): **Input contracts → Kernel contract spine → Content Pipeline (lifecycle contracts) → Kernel lifecycle/replay integration closure**, with the Settings `DifficultyProfile` schema available before that final closure (the GO lifecycle boundary captures `ReplayInitialState` including the profile ID — simulation-architecture.md:83).

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0001: Manual Simulation Authority and Determinism Boundary | `SimulationState` sole-writer authority; `SimulationMode.Script` + one `Physics.Simulate(FIXED_DT)` per tick; `CaptureLatestRawSample()` before accumulator; PCG32 determinism rules; focus-loss boundary; spiral-of-death clamp | HIGH |
| ADR-0003: Content Pipeline and Addressables | `ContentLoadRequest`/`RaceLoadReady`/`ContentUnloadRequest`/`ContentUnloadComplete` lifecycle handshake contracts; Content never writes `SimulationState` | MEDIUM |
| ADR-0002: Vehicle Physics Implementation Pattern | `Rigidbody.interpolation = None` + LateUpdate manual interpolation (render snapshot pattern) | HIGH |
| ADR-0010: Camera/VFX Rendering Budget and Interpolation | Performance protection thresholds (below-30/15 FPS) feed `PerformanceReduced`/pause request into the Kernel | MEDIUM |

**Related ADRs whose pipeline integrations land in Core epics**: ADR-0006 (Fuel/Tire tick timing — Step 5a/5b), ADR-0011 (Pit Stop — Step 9b), ADR-0013 (Qualifying Countdown bypass), ADR-0009 (AI published-snapshot read), ADR-0014 (HUD reading published state). These govern the Kernel's seam contracts but their implementations are delivered by the owning system's epic.

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-sim-001 | Fixed 60 Hz timestep via manual accumulator in Update(), not FixedUpdate | ADR-0001 ✅ |
| TR-sim-002 | Physics.simulationMode = SimulationMode.Script; one Physics.Simulate(FIXED_DT) per tick | ADR-0001 ✅ |
| TR-sim-003 | 14-step tick pipeline: TickStartSnapshot through PublishedSimulationSnapshot | ADR-0001, ADR-0006, ADR-0011 ✅ (kernel delivers pipeline skeleton + seams; Core steps delivered by owning epics per Integration Contract) |
| TR-sim-004 | Focus-loss creates non-physics lifecycle boundary; focus return never auto-resumes | ADR-0001 ✅ |
| TR-sim-005 | Performance gate: 16-car prototype p95 <= 6ms, max <= 8ms | ADR-0001 ✅ (dependent verification — requires representative Core content; validated by the ADR-0001 16-car profiling gate + follow-up benchmark ADR) |
| TR-sim-006 | Render interpolation in LateUpdate; Rigidbody.interpolation = None | ADR-0001, ADR-0002 ✅ |
| TR-sim-007 | Determinism: PCG32 for all randomness, Unity.Mathematics, no UnityEngine.Random on sim path | ADR-0001, ADR-0009 ✅ |
| TR-sim-008 | Simulation is sole writer of SimulationState; RSM owns RaceMode; Content Pipeline emits signals | ADR-0001, ADR-0003 ✅ |
| TR-sim-009 | Countdown 300 ticks; GO on tick 300; Qualifying skips Countdown | ADR-0001, ADR-0013 ✅ (kernel delivers Countdown; Qualifying bypass verified with RSM epic) |
| TR-sim-010 | Accumulator backlog is clamped to `2 × FIXED_DT`; discarded time is never caught up later | ADR-0001 ✅ |
| TR-sim-011 | TickStart, Published, PostFinish, and ReplayInitial snapshots are immutable consumer boundaries | ADR-0001 ✅ |
| TR-sim-012 | `simulationStepCount`, `activeRaceStepCount`, and race-time progression have explicit Countdown, Racing, Pause, and finish behavior | ADR-0001 ✅ |
| TR-sim-013 | Below 30 FPS for 3 seconds emits `PerformanceReduced`; recovery and below-15 FPS pause thresholds are explicit | ADR-0001, ADR-0010, ADR-0014 ✅ |
| TR-sim-014 | Finished and Results execute no gameplay simulation; Results remains active until content unload completes | ADR-0001, ADR-0003 ✅ |

**Untraced requirements**: None — 14/14 covered by Accepted ADRs.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/simulation-architecture.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`
- The MVP recordable buffer (12 bytes/tick continuous + standalone Pause edges, 22,500-tick cap, always discarded on Results/Forfeit/Idle/load failure) and `ReplayInitialState` capture are accepted as Ghost Recording criteria (TR-ghost-003/004/007) — the buffer is Kernel-owned in MVP
- Every seam in the Integration Contract above is published with a documented contract (interface + data shape) that the owning Core epic implements
- The Simulation driver test asserts `CaptureLatestRawSample()` runs before accumulator evaluation in the same `Update()` — this is the input-system story-002 AC-59 ordering debt (the capture-before-accumulator contract is ADR-0001:41; a controller-seam test cannot independently verify it, so the Kernel owns the test that does)
- The lifecycle handshake with Content Pipeline (contracts in, readiness/error/unload signals out) closes the loop: Kernel lifecycle + replay capture integrated after Content implements its side
- TR-sim-005 (16-car gate) verification is recorded as deferred to the ADR-0001 profiling gate once Core content exists — the Kernel declares the gate, does not claim to pass it

## Next Step

Run `/create-stories simulation-kernel` to break this epic into implementable stories.
