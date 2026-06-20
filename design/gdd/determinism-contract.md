# Determinism Contract

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Foundation — guarantees that same inputs + same seed → identical simulation output

## Overview

The Determinism Contract defines four rules that guarantee reproducible simulation: fixed timestep (1/60s), seeded PRNG, fixed system update order, and cross-platform determinism. It is not a runtime system — it is a set of constraints enforced by architecture review and unit tests. Every system that participates in SimulationSnapshot agrees to these rules. If a system breaks determinism, replay desyncs and multiplayer diverges — the contract is the foundation that makes those features possible.

## Developer Fantasy

The developer implements `update(deltaTime)` for their system using the provided `SeededRandom` instance instead of `Math.random()`. Their system runs in a fixed order after Physics, before AI, guaranteed every tick. They write a test: run the same seed + same sequence of inputs through their system twice — the output is byte-identical both times. They commit knowing replay will work.

## Detailed Design

### Core Rules

**1. Fixed timestep (1/60s).** The game loop decouples simulation from rendering. Simulation runs at exactly 60 ticks per second regardless of display refresh rate. The rendering frame rate may fluctuate; the simulation never skips or duplicates a tick. Implemented by an accumulator pattern:

```typescript
const FIXED_DT = 1 / 60;
let accumulator = 0;

function gameLoop(frameDelta: number): void {
  accumulator += frameDelta;
  while (accumulator >= FIXED_DT) {
    fixedUpdate(FIXED_DT); // simulation tick
    accumulator -= FIXED_DT;
  }
  render(frameDelta); // interpolation between ticks
}
```

**2. Seeded PRNG.** All random numbers in the simulation come from a seeded PRNG, never from `Math.random()`. Each race session draws from a single `SeededRandom` instance initialized with a race seed. The seed is stored in the race configuration and serialized in SimulationSnapshot.

```typescript
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff;
    return (this.state >>> 0) / 0x100000000;
  }

  /** Returns an integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Returns a float in [min, max) */
  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}
```

The algorithm is Linear Congruential Generator (LCG) — deterministic, ~5ns per call, trivially portable.

**3. Fixed system update order.** Systems are registered with `FixedUpdatePipeline` in a specific order that never changes mid-session:

```
1.  Input          → read and buffer player input
2.  Physics/Handling → apply forces, integrate positions
3.  AI Driver      → decision-making (reads current world state)
4.  Collision      → detect and resolve contacts
5.  Fuel           → consume fuel based on throttle
6.  Tire Wear      → degrade tires based on forces
7.  Race Management → evaluate lap completions, positions, finish
8.  [Spatial detection — runs before Physics: off-track spline check, pit entry/exit BoundingBox check]
    Note: Exact pipeline position defined during architecture. Candidate positions: pre-Physics (position 1, same tick) or post-RaceMgmt (position 8, 1-tick latency).
```

This order is defined at startup and enforced every tick. Two ticks with the same inputs + same seed produce identical results because every system reads from the same deterministic world state.

The pipeline is an ordered array of `{ systemId: string, update: (dt: number) => void }`. Systems are inserted by index — no priority values, no sorting.

**4. Cross-platform determinism.** All systems must:

- Use `SeededRandom` instead of `Math.random()`
- Avoid `Date.now()`, `performance.now()`, or any time-source during `fixedUpdate()` — only the fixed timestep parameter
- Avoid floating-point operations whose result differs between platforms (e.g. `Math.sin` near boundaries, `NaN` propagation)
- Use fixed-point or integer arithmetic for gameplay-critical values (fuel level as integer centiliters, tire wear as integer 0-100)
- Never read input twice in the same tick — input is consumed once and buffered

### States and Transitions

The Determinism Contract has no runtime state — it is a set of rules enforced statically. The `FixedUpdatePipeline` and `SeededRandom` have lifecycle, but the contract itself is always active.

```
[FixedUpdatePipeline]
[Uninitialized] --register()--> [Ready] --executeTick()--> (loops) --dispose()--> [Disposed]
```

| State             | Description                                                                     |
| ----------------- | ------------------------------------------------------------------------------- |
| **Uninitialized** | Pipeline empty. `executeTick()` throws.                                         |
| **Ready**         | Pipeline populated with registered systems. `executeTick()` runs them in order. |
| **Disposed**      | Pipeline cleared. No further ticks possible.                                    |

### Interactions with Other Systems

The Determinism Contract touches every system that has a `fixedUpdate()`:

| System                  | Contract Rule                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| **Input**               | Reads controller state once per frame, provides the same buffered input to each fixed tick |
| **Physics/Handling**    | Uses fixed timestep; applies forces deterministically                                      |
| **AI Driver**           | Uses `SeededRandom` for behavior decisions                                                 |
| **Fuel**                | Integer fuel values                                                                        |
| **Race Management**     | Lap detection, finish detection — deterministic geometry queries                           |
| **Simulation Snapshot** | Consumes snapshots at fixed tick boundaries                                                |

## Formulas

**LCG PRNG:**

```
state_{n+1} = (state_n × 1664525 + 1013904223) mod 2^32
value_n = state_n / 2^32            // float in [0, 1)
```

Parameters are the Numerical Recipes LCG constants — well-distributed, no short cycles.

## Edge Cases

1. **Input buffering across ticks.** If the player presses a key between tick N and tick N+1, that input is not applied until tick N+1. The buffer is consumed exactly once per tick — input is never lost and never applied twice.
2. **Frame drop catch-up.** If the browser drops frames, the accumulator may grow beyond `FIXED_DT × 2`. To prevent a spiral of catch-up ticks, the accumulator is capped at `FIXED_DT × 4` (4 ticks max per frame). The game may visually slow down; the simulation never skips a tick.
3. **Seed collision.** Two races with the same seed produce identical AI behavior patterns. The seed is `Date.now()` at race start, combined with a counter — practical uniqueness is sufficient for development.
4. **Determinism test harness.** A test runs two `SeededRandom` instances with the same seed through the same `fixedUpdate()` sequence and asserts byte-identical output from `SimulationSnapshot.hash()` for every system.

## Dependencies

**Zero runtime dependencies.** `SeededRandom` and `FixedUpdatePipeline` are pure TypeScript. `Date.now()` is used only for seed generation, never during simulation.

## Tuning Knobs

- **Accumulator cap** (default: 4 ticks) — max catch-up ticks per frame to prevent spiral
- **Max frame delta** (default: 1s) — frames longer than this are clamped to prevent huge accumulator values

## Visual/Audio Requirements

None.

## UI Requirements

**Dev Tools integration:** the debug overlay shows:

- Current tick number
- Tick accumulator value
- Number of catch-up ticks this frame (excess over 1)
- Per-system update time (profiling)

## Acceptance Criteria

1. `SeededRandom` with seed 42 — `next()` returns the same sequence of 1000 floats on every platform and every run.
2. `FixedUpdatePipeline.executeTick(dt)` runs registered systems in declared order — verified by a spy system that records call order.
3. Input buffered between ticks is consumed exactly once — tested with a simulated frame with input event.
4. Accumulator cap at 4 ticks — a frame with delta 5/60s processes exactly 4 ticks and renders with remaining time.
5. Two simulation runs with same seed + same inputs produce identical `SimulationSnapshot.hash()` output for every system.
6. `SeededRandom` is used by AI system — AI behavior is deterministic for the same seed.
7. `Math.random` is never called during `fixedUpdate()` — verified by runtime assertion in dev build.

## Open Questions

None.
