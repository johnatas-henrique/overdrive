# Epic: Determinism Contract

> **Layer**: Foundation
> **GDD**: design/gdd/determinism-contract.md
> **Architecture Module**: Foundation — Pipeline
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories determinism-contract`

## Overview

Fixed timestep pipeline and deterministic RNG. `FixedUpdatePipeline` with 8 immutable slots (Input → Physics → AI → Collision → Fuel → Tire → RM → Pit Stop), accumulator pattern at `FIXED_DT = 16.667ms`, `MAX_CATCHUP = 4` spiral-of-death protection. Pipeline runs from `engine.runRenderLoop()`, not `scene.onBeforeRenderObservable`. `SeededRandom` LCG (constants 1664525, 1013904223). Havok auto-step suppressed via monkeypatch; manual `executeStep(dt, bodies)` in Physics slot #2. `Date.now()`/`performance.now()` forbidden inside `update()`.

## Governing ADRs

| ADR                                    | Decision Summary                                                                            | Engine Risk |
| -------------------------------------- | ------------------------------------------------------------------------------------------- | ----------- |
| ADR-0002: Fixed Timestep + Determinism | Accumulator 1/60s, 8 slots, SeededRandom LCG, Havok manual stepping, engine.runRenderLoop() | LOW         |

## GDD Requirements

| TR-ID      | Requirement                                                        | ADR Coverage |
| ---------- | ------------------------------------------------------------------ | ------------ |
| TR-DET-001 | FixedUpdatePipeline — 8 slots at 1/60s each                        | ADR-0002 ✅  |
| TR-DET-002 | Accumulator pattern with max 4 catch-up ticks                      | ADR-0002 ✅  |
| TR-DET-003 | SeededRandom LCG (1664525/1013904223)                              | ADR-0002 ✅  |
| TR-DET-004 | Date.now()/performance.now() forbidden in slot update()            | ADR-0002 ✅  |
| TR-DET-005 | Input buffered between ticks, consumed exactly once                | ADR-0002 ✅  |
| TR-DET-006 | Havok auto-step suppressed; pipeline calls executeStep(dt, bodies) | ADR-0002 ✅  |
| TR-DET-007 | Pipeline from engine.runRenderLoop(), not onBeforeRenderObservable | ADR-0002 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/determinism-contract.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories determinism-contract` to break this epic into implementable stories.
