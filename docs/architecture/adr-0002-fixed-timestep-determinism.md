# ADR-0002: Fixed Timestep & Determinism Pipeline

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| **Engine**                | Babylon.js 9.12.0                                                                          |
| **Domain**                | Core (TypeScript) + Havok                                                                  |
| **Knowledge Risk**        | LOW                                                                                        |
| **References Consulted**  | VERSION.md, architecture.md Data Flow / FixedUpdatePipeline, engine-ref modules/physics.md |
| **Post-Cutoff APIs Used** | None                                                                                       |
| **Verification Required** | Havok auto-step suppressed; `executeStep(dt, bodies[])` called manually in slot #2         |

## ADR Dependencies

| Field             | Value                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| **Depends On**    | ADR-0001 (Event Bus — pipeline emits events)                                                                  |
| **Enables**       | ADR-0004 (Module Boundaries — slot order enforces DAG), ADR-0005 (Entity/Car — lifecycle hooks into pipeline) |
| **Blocks**        | Physics/Handling, AI Driver, Fuel, Tire Wear, Race Management, Pit Stop                                       |
| **Ordering Note** | Must be written before any Core system that registers in the pipeline                                         |

## Context

### Problem Statement

A racing game at 60fps must decouple simulation rate from render rate. Babylon.js rAF provides ~60 calls/second but fluctuates. Without a fixed timestep, physics behaves differently at 58fps vs 62fps — breaking determinism and making replays/multiplayer impossible.

### Constraints

- Fixed timestep at 1/60s (FIXED_DT = 16.667ms)
- Max 4 catch-up ticks per frame (spiral-of-death protection)
- Pipeline slot order must be immutable mid-session
- Must integrate with Babylon.js render loop (rAF) without conflicting with Havok's internal stepping
- Seeded RNG must produce identical sequences across platforms (LCG, not `Math.random()`)
- RNG seed must be configurable (`Date.now()` default, fixed seed for debug/replay)

### Requirements

- 8 pipeline slots with fixed ownership: Input → Physics → AI → Collision → Fuel → Tire → RM → PitStop
- Synchronous execution — all 8 slots run within a single rAF callback
- `Date.now()` / `performance.now()` forbidden inside slot `update()`
- `SeededRandom` with three methods: `random()`, `randomRange(min, max)`, `randomSign()`
- Pipeline emits `race.starting` (deferred to first tick) and `race.light.countdown`

## Decision

### FixedUpdatePipeline

Driven from `engine.runRenderLoop()`. The accumulator and pipeline execution are
scene-independent — they run every frame regardless of which Babylon.js Scene
is active. Each scene's `render()` is called once per frame after the pipeline
completes.

```typescript
engine.runRenderLoop(() => {
  // ─── Fixed timestep accumulator ──────────────────────────────
  accumulator += engine.getDeltaTime();
  let ticks = 0;
  while (accumulator >= FIXED_DT && ticks < MAX_CATCHUP) {
    pipeline.runTick(FIXED_DT); // calls slots 1-8 in order
    accumulator -= FIXED_DT;
    ticks++;
  }
  if (accumulator >= FIXED_DT) accumulator = 0; // spiral-of-death

  // ─── Render the active scene ─────────────────────────────────
  // activeScene is a variable set by IAssetManager.setActiveScene().
  // The pipeline runs independently of which scene renders.
  activeScene.render();
});
```

**⚠️ Why NOT `onBeforeRenderObservable`**: The pipeline was originally placed
in `scene.onBeforeRenderObservable`, but this caused two problems in the
Two-Scene architecture (ADR-0003):

1. **Re-entrancy**: Calling `scene.render()` inside `onBeforeRenderObservable`
   causes infinite recursion — `scene.render()` fires the observable again.
2. **Scene affinity**: A pipeline registered on `raceScene.onBeforeRenderObservable`
   stops executing when `menuScene` is active. The pipeline must run regardless
   of which scene renders.

The render-loop pattern avoids both issues: the pipeline is scene-independent
and the render call is a single `activeScene.render()` that never self-recurses.

### Havok Integration — Revised Strategy (scene.enablePhysics + auto-step suppression)

**Important correction**: Earlier ADR-0002 drafts specified "Do NOT call
`scene.enablePhysics()`." This was incorrect — both `PhysicsBody` and
`PhysicsAggregate` require a registered physics engine on the scene. Their
constructors call `scene.getPhysicsEngine()` and throw `"No Physics Engine
available."` if none is registered. [Corrected per ADR-0005 engine specialist review.]

The correct approach:

1. Call `scene.enablePhysics(gravityVector, havokPlugin)` — registers the plugin,
   enabling `PhysicsBody`/`PhysicsAggregate` creation
2. Suppress the scene's auto-step — our FixedUpdatePipeline calls
   `havokPlugin.executeStep(fixedDt, activeBodies)` exclusively
3. Track bodies manually in a `PhysicsBody[]` array for the pipeline step

```typescript
import HavokPhysics from '@babylonjs/havok';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/plugins/havokPlugin';
import { Vector3 } from '@babylonjs/core/Maths/math';

const havokInstance = await HavokPhysics();
const havokPlugin = new HavokPlugin(true, havokInstance);
const gravity = new Vector3(0, -9.81, 0);

// REQUIRED: enablePhysics registers the plugin so PhysicsBody constructors work
scene.enablePhysics(gravity, havokPlugin);

// CRITICAL: suppress scene's physics auto-step
// _advancePhysicsEngineStep is called inside scene.render() and would double-step
// if left active. Our pipeline calls executeStep() exclusively.
(scene as any)._advancePhysicsEngineStep = () => {};

// Bodies are tracked manually for the pipeline step call:
const activeBodies: PhysicsBody[] = [];
// ... per-car: body = new PhysicsBody(mesh, ...)
// ...   activeBodies.push(body)

// Inside FixedUpdatePipeline slot #2:
physicsSlot(fixedDt: number): void {
  havokPlugin.executeStep(fixedDt, activeBodies);
}
```

**Trade-off**: The `(scene as any)._advancePhysicsEngineStep` override is a
pragmatic hack. It's a private method — TypeScript would not normally allow
overriding it. The cast is necessary and documented. No public API exists in
Babylon.js 9.12 to disable the physics auto-step after `enablePhysics()`.

### SeededRandom (LCG)

```typescript
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  random(): number {
    // Numerical Recipes LCG constants
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return (this.state >>> 0) / 0xffffffff;
  }

  randomRange(min: number, max: number): number {
    return min + this.random() * (max - min);
  }

  randomSign(): -1 | 1 {
    return this.random() < 0.5 ? -1 : 1;
  }

  // Snapshot / replay support
  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    this.state = state;
  }
}
```

The LCG constants (1664525, 1013904223) are from Numerical Recipes — well-tested
for game use. Not cryptographically secure, not needed to be.

### Pipeline Interface

```typescript
interface IFixedUpdatePipeline {
  register(
    systemId: string,
    update: (dt: number) => void,
    slotIndex: number
  ): void;
  start(): void;
  stop(): void;
  getCurrentTick(): number;
}
```

### Slot Assignment (IMMUTABLE)

| Slot | System           | Notes                                                                                  |
| ---- | ---------------- | -------------------------------------------------------------------------------------- |
| 1    | Input            | `register('input', input.update, 1)`                                                   |
| 2    | Physics/Handling | `register('physics', physics.update, 2)` — calls `havokPlugin.executeStep(dt, bodies)` |
| 3    | AI Driver        | `register('ai', ai.update, 3)`                                                         |
| 4    | Collision        | `register('collision', collision.update, 4)` — event-only, no state mutation           |
| 5    | Fuel             | `register('fuel', fuel.update, 5)`                                                     |
| 6    | Tire Wear        | `register('tire', tire.update, 6)`                                                     |
| 7    | Race Management  | `register('race', rm.update, 7)`                                                       |
| 8    | Pit Stop         | `register('pitstop', pit.update, 8)`                                                   |

### Input Buffering (Double-Buffer)

Input values must be consumed exactly once per tick and must not leak across
ticks. A double-buffer pattern ensures this:

```typescript
class InputBuffer {
  private buffers: [InputState | null, InputState | null] = [null, null];
  private writeIndex = 0;

  /** Slot #1 calls writeInput with hardware state */
  write(state: InputState): void {
    this.buffers[this.writeIndex] = state;
  }

  /** Slot #2+ call readInput once per tick */
  read(): InputState {
    return this.buffers[this.writeIndex] ?? InputState.ZERO;
  }

  /** Called after all pipeline slots have consumed the tick */
  flip(): void {
    this.writeIndex ^= 1; // toggle write buffer
    this.buffers[this.writeIndex] = null; // clear next write buffer
  }
}
```

**Lifecycle within a tick**:

1. Slot #1 (Input) → `inputBuffer.write(getState())` — hardware snapshot
2. Slots #2-8 → `inputBuffer.read()` — consumed exactly once, no re-read
3. After slot #8 → `inputBuffer.flip()` — ready for next tick

**Edge cases**:

- If Input slot is mid-tick (rAF callback), the previous tick's buffer is still
  the active read buffer — no torn frames
- `InputState.ZERO` default ensures no stale input on first tick before Input
  slot runs
- AI Driver writes to a separate `Map<carId, InputState>` via `IAIDriver.tick()`
  (see ADR-0013), consumed by Physics slot #2 via the same read path — player
  and AI inputs converge in the same consumption interface

### Invariants

1. Slot order never changes mid-session — `register()` throws if called after `start()`
2. `Date.now()` / `performance.now()` forbidden — use `pipeline.getCurrentTick()` for time
3. Tab backgrounded → rAF stops → accumulator resumes on refocus, capped at 4 catch-up ticks
4. A throwing slot does not crash subsequent slots (try/catch per slot)
5. Pipeline runs inside `engine.runRenderLoop()`, NOT inside `scene.onBeforeRenderObservable`
6. The pipeline is scene-independent — it executes every frame regardless of which scene renders

## Alternatives Considered

### Alternative 1: setInterval at 1/60s

- **Description:** Use `setInterval(1000/60)` instead of accumulator + rAF
- **Pros:** Trivially simple, no accumulator to manage
- **Cons:** Drifts from rAF — `setInterval` doesn't align with render loop, causes
  physics to step while frame is not rendering (wasted work), timing degrades with
  tab throttling
- **Rejection Reason:** Must be lockstepped with rAF for rendering interpolation.
  Decoupled timers create frame-order problems.

### Alternative 2: Variable Timestep (delta-time scaling)

- **Description:** Use `engine.getDeltaTime()` directly — no accumulator, no fixed step
- **Pros:** Simplest possible loop, perfectly smooth on stable 60fps
- **Cons:** Non-deterministic — same inputs produce different results at different
  frame rates. Breaks replay, multiplayer, and Simulation Snapshot hashing.
- **Rejection Reason:** Determinism is a hard requirement for Simulation Snapshot
  (future ADR) and future multiplayer. Variable timestep cannot satisfy this.

### Alternative 3: No scene.enablePhysics (Original Strategy A)

- **Description:** Create HavokPlugin without calling `scene.enablePhysics()`.
  Bodies created via direct Havok API (`havokPlugin._hknp.createBody()`),
  bypassing `PhysicsBody` and `PhysicsAggregate` entirely.
- **Pros:** No auto-step to suppress
- **Cons:** Uses undocumented Havok-internal API (`_hknp`). Makes the code
  dependent on Havok's internal structure — engine updates can break it silently.
  Also loses Babylon.js physics integration (collision events, debug rendering).
- **Rejection Reason:** Both `PhysicsBody` and `PhysicsAggregate` require
  `scene.getPhysicsEngine()` to be non-null. Without `scene.enablePhysics()`,
  these constructors throw. Direct Havok API usage is too fragile for this project.

## Consequences

### Positive

- Deterministic simulation — same seed = same race, regardless of frame rate
- Frame-rate independence — physics, AI, fuel/tire all compute at 60Hz
- Multiplayer-ready — lockstep network model can use the same pipeline
- Spiral-of-death protection prevents cascade from tab backgrounding
- Strategy A eliminates Havok auto-step at the root via scene-level override

### Negative

- Max 4 catch-up ticks means tab backgrounded >266ms causes simulation lag
- LCG is not cryptographically secure — fine for gameplay, not for security
- Manual `PhysicsBody[]` tracking still needed — `scene.getPhysicsEngine()` exposes bodies
  but the explicit array ensures no stray bodies are stepped by accident

### Risks

- **Risk:** PhysicsBody array not updated when cars are destroyed
  **Mitigation:** Entity/Car Lifecycle's `destroyAll()` also clears the array
- **Risk:** Tab backgrounded 30s, only 4 catch-up ticks → cars didn't move
  **Mitigation:** Acceptable for single-player MVP. Race Management detects pause.
- **Risk:** Accumulator drift accumulates over long sessions (>1h)
  **Mitigation:** `getCurrentTick() × FIXED_DT` is authoritative time. Wall clock
  is reference only for the accumulator driver.

## GDD Requirements Addressed

| GDD System              | Requirement                 | How This ADR Addresses It                                                                       |
| ----------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| determinism-contract.md | Fixed timestep at 1/60s     | Accumulator pattern driven from `engine.runRenderLoop()`                                        |
| determinism-contract.md | SeededRandom LCG            | LCG implementation with three methods + snapshot support                                        |
| determinism-contract.md | Immutable pipeline order    | `register()` throws after `start()`                                                             |
| determinism-contract.md | No Date.now() inside update | `getCurrentTick()` replaces wall clock reads                                                    |
| physics-handling.md     | Havok step at fixed rate    | Havok auto-step suppressed via scene-level override; `executeStep()` called manually in slot #2 |
| simulation-snapshot.md  | Deterministic state hashing | FNV-1a on serialized state; same seed → same state                                              |

## Performance Implications

- **CPU:** 8 function calls per tick at 60 ticks/s = 480 calls/s. Each call is
  a direct function reference — negligible overhead (<0.001ms/frame).
- **Memory:** One function reference per slot × 8 + accumulator state = ~200 bytes.
  `PhysicsBody[]` array — one reference per car (8 in MVP, ~64 bytes).
- **Load Time:** Zero — no async init for the pipeline itself (Havok WASM loads
  separately before Physics init).

## Migration Plan

First implementation is greenfield. Future migration to Web Worker-based physics
would replace the Havok slot with a `postMessage` bridge while keeping the same
`IFixedUpdatePipeline` interface.

## Validation Criteria

- [ ] 60 ticks execute per second of wall time (verified via `getCurrentTick()` after 5s)
- [ ] Same seed produces identical tick sequence across runs
- [ ] SeededRandom LCG: two instances with same seed produce identical `random()` sequence
- [ ] Havok auto-step confirmed suppressed — **dev assertion**: `scene.getPhysicsEngine() === null`
- [ ] < 4 catch-up ticks at 60fps (normal conditions)
- [ ] Spiral-of-death: accumulator correctly capped at 4 ticks
- [ ] `register()` after `start()` throws error
- [ ] PhysicsBody array length matches car count during race

## Related Decisions

- ADR-0001 (Event Bus — pipeline uses Event Bus for deferred `race.starting` emission)
- Architecture.md Data Flow — FixedUpdatePipeline (corrected with Havok step documentation)
