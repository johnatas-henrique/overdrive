# ADR-0013: AI Driver

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                                                                                    |
| **Domain**                | Simulation — AI                                                                                                      |
| **Knowledge Risk**        | LOW — pure TypeScript math, no engine API usage                                                                      |
| **References Consulted**  | ai-driver.md GDD, ADR-0006 (IInput interface), ADR-0002 (SeededRandom), architecture.md                              |
| **Post-Cutoff APIs Used** | None                                                                                                                 |
| **Verification Required** | AI IInput contract matches player Input; 1-tick delay between AI compute (slot #3) and Physics consumption (slot #2) |

## ADR Dependencies

| Field             | Value                                                                                                                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Depends On**    | ADR-0006 (IInput interface — AI produces same contract as player Input), ADR-0002 (SeededRandom — deterministic RNG for parameters), ADR-0011 (Fuel — reads fuelLevel for pit timing), ADR-0012 (Tire — reads tireCondition for corner speed) |
| **Enables**       | Physics (slot #2 receives AI input via IInput), Race Management (consumes AI positions)                                                                                                                                                       |
| **Blocks**        | None                                                                                                                                                                                                                                          |
| **Ordering Note** | Pipeline slot #3 (after Physics #2, before Collision #4). Init slot #7 (after all physics/simulation init).                                                                                                                                   |

## Context

### Problem Statement

Seven AI opponents must drive competitively around the track using the same physics model as the player — no cheating, no special treatment. Each AI must feel distinct (different strengths/weaknesses), produce realistic lap times, and handle overtaking without a collision avoidance system.

### Constraints

- AI produces IInput-compatible signals (steer/throttle/brake/gear) — same contract as ADR-0006
- Physics does not distinguish player vs AI input
- No collision avoidance system — overtaking via state machine with lateral offset adjustment
- Spline-based path following (PID + curvature feedforward)
- All parameters deterministic via SeededRandom — same seed → same AI behavior
- Per-team performance from 1991 constructor championship data, sqrt-compressed
- Difficulty multiplier scales all teamPerformance before parameter computation
- AI pit strategy delegated to Pit Stop system — AI Driver only provides input during active driving

### Requirements

- 7 AIControllers (one per AI car) created at PreRace, ticking every physics tick during Racing
- Spline follower: PID(lateralError) + curvatureFeedforward → steer output (-1..1)
- Speed target: `min(maxSpeed, cornerSpeed(spline curvature))`
- Overtaking state machine: Normal → Following → Passing → Normal
- Team performance model: 8 teams with sqrt compression, tier-based variance
- Difficulty scaling: 5 levels (0.75, 0.875, 1.0, 1.125, 1.25) × teamPerformance
- Mistake model: random errors at configurable rate and magnitude
- Input suppressed during active pit stop (by Pit Stop system, not AI Driver)

## Decision

### Pipeline Ordering — 1-Tick Delay Design

**Critical understanding**: Physics slot #2 runs BEFORE AI slot #3. The AI's output is consumed by Physics in the **next** tick, not the same tick. This 1-tick delay is intentional and documented.

```
Tick N:
  slot #2: Physics reads inputBuffer[N] → computes physics ← inputBuffer[N] was written by AI in tick N-1
  slot #3: AI reads physics telemetry (speed, position from after slot #2 of tick N)
            AI computes steer/throttle/brake for tick N+1
            AI writes to inputBuffer[N+1]
            inputBuffer[N+1] visible to Physics slot #2 of tick N+1

Tick N+1:
  slot #2: Physics reads inputBuffer[N+1] (written by AI in tick N slot #3)
  slot #3: AI reads physics telemetry (after slot #2 of tick N+1)
            AI writes to inputBuffer[N+2]
```

**Buffer mechanism**: double-buffered `Map<string, InputState>`. AI writes its output in slot #3. Physics reads from the "current" buffer in slot #2. After AI slot #3 completes, the pipeline coordinator swaps buffers.

This 1-tick delay is imperceptible (16ms) and aligns with the same delay pattern used by Fuel and Tire Wear.

### Resolution of ADR-0006 AIDriverInput Contradiction

ADR-0006's `AIDriverInput implements IInput` was an aspirational design that placed AI in slot #1 alongside player input. The actual architecture places AI in dedicated slot #3 — a separate pipeline system, not an Input source.

**Correction to ADR-0006**: Remove the `AIDriverInput` class and `onDeviceChanged` stubs from ADR-0006. Replace with a note: "AI Driver has its own dedicated pipeline slot #3 and produces InputState via IAIDriver.tick(). Physics reads from the double-buffered input store, never branching on player vs AI origin."

**architecture.md update**: The `IAIDriver` in architecture.md line 719 needs a `tick(dt)` method and must specify the double-buffered store pattern, not the `getState(carId)` pull model. (Applied as part of this ADR.)

### Architecture

```
Pipeline slot #3 (FixedUpdatePipeline):
  IAIDriver.tick(dt)
    │
    For each AI car (7 total):
    │
    1. Skip if pitState !== 'onTrack'
    │
    2. Read physics telemetry from current tick (speed, position, lateralG, etc.)
    │     (Physics slot #2 already ran this tick — data is fresh)
    │
    3. Spline following: calculate steer from PID(lateralError) + curvatureFeedforward
    │
    4. Speed target: min(maxSpeed × speedMult, cornerSpeed(gripAvailable))
    │
    5. Overtaking state machine
    │
    6. Apply mistake model
    │
    7. Write InputState to outputBuffer[nextBuffer] — consumed by Physics slot #2 next tick
```

### Key Interfaces

```typescript
interface IAIDriver {
  init(config: AIConfig, track: ITrack, seed: number): void;
  registerCar(
    carId: string,
    teamPerformance: number,
    difficulty: number
  ): AIController;
  tick(dt: number): void; // pipeline slot #3
  /** Returns input buffer for current tick — consumed by Physics slot #2 */
  getInputBuffer(): Map<string, InputState>;
  getController(carId: string): AIController | undefined;
  dispose(): void;
}

interface AIController {
  carId: string;
  params: AIDriverParams;
  state: "Normal" | "Following" | "Passing";
  progress: number;
  targetOffset: number;
  /** Each controller has its own SeededRandom, derived from raceSeed + carIndex */
  rng: SeededRandom;
  computeInputs(telemetry: CarTelemetry): InputState;
}

interface AIDriverParams {
  speedMult: number;
  brakingAggression: number;
  gripMargin: number;
  throttleRampRate: number;
  passingAggression: number;
  mistakeChance: number;
  offsetPreference: number;
  rngSeedOffset: number; // per-car RNG stream isolation
}
```

### Per-Car RNG Isolation

Each AIController receives its own `SeededRandom` instance, seeded from `raceSeed + carIndex`. This isolates the RNG stream per car — a mistake roll on car #3 never shifts car #4's RNG. Determinism is preserved because the per-car seed is deterministic from the race seed.

```typescript
registerCar(carId: string, tp: number, difficulty: number): AIController {
  const seed = baseSeed + index;  // per-car RNG stream
  const rng = new SeededRandom(seed);
  const params = computeParams(tp, difficulty, rng);
  return { carId, params, rng, ... };
}
```

### mistakeMag

`mistakeMag` is a top-level config constant (`ai.mistakeMag`, default 0.15). Not a per-AI parameter — the same error amplitude applies to all AIs; only the frequency (`mistakeChance`) varies by team.

### Team Performance & Variance

```
tp = teamPerformance × difficultyMultiplier
  // difficulty: 0.75 (Very Easy) .. 1.25 (Very Hard)

For each parameter:
  rising: effective = baseMin + (tp × range) + SeededRandom(-variance, +variance)
  falling: effective = maxValue × (1.0 - tp × slope) + SeededRandom(-variance, +variance)
```

Tier variance: front-runner (tp ≥ 0.85) ±0.02, podium threat ±0.04, midfield/backmarker ±0.06.

### Overtaking State Machine

```
Normal ──(car ahead < followDist)──→ Following
Following ──(speedDiff > 5% ≥3 ticks AND open curvature)──→ Passing
Passing ──(pass complete)──→ Normal
Passing ──(car ahead pulls away > 30m OR corner approaching OR gap closing)──→ Following
```

During Passing, lateral offset calculated dynamically:

```
offset = min(passingOffsetScale × halfWidth, halfWidth - carHalfWidth - 0.5m)
// guaranteed to fit within track surface
```

### Mistake Model

```typescript
if (seededRandom.next() < params.mistakeChance) {
  steer += seededRandom.next() * config.mistakeMag; // from ai.mistakeMag
  throttle *= 1.0 - seededRandom.next() * 0.5; // random throttle lift
}
```

## Alternatives Considered

### Alternative 1: Behavior Tree for overtaking

- **Description**: Full behavior tree (BT) with fallback/composite nodes for overtaking decisions.
- **Cons**: BT adds code complexity (selector, sequence, condition decorators) for a state machine with 3 states. Phase 1 overtaking logic is simple enough for a single switch statement.
- **Rejection Reason**: BT is justified when AI has competing priorities (combat, exploration, resource gathering). For racing, the overtaking logic is a linear sequence of conditions — a state machine is simpler and equally expressive.

## Consequences

### Positive

- AI uses same IInput interface as player — Physics never branches on origin
- Spline follower is deterministic — same params, same seed, same trajectory
- Team performance model grounded in real 1991 data — authentic hierarchy without tuning guesswork
- Overtaking state machine has no collision avoidance — Collision system handles physical contacts
- Difficulty scaling applied before parameter formulas — affects all AI characteristics proportionally
- Mistake model creates human-like errors without a personality system

### Negative

- AI does not learn from mistakes — same error pattern repeats identically on the same seed. Acceptable for Phase 1 (feel of distinct drivers is enough)
- No reactive steering mid-corner — AI that enters too fast understeers and loses time. Intentional design choice (mirrors human errors)
- Pit strategy delegated to Pit Stop — AI Driver cannot independently decide to pit based on tactical reasoning
- No drafting/slipstream model in Phase 1 — AI passes only via speed differential and braking, never via aerodynamic tow

### Risks

- **Risk**: AI cars collide frequently at first corner (turn 1 pileup)
  **Mitigation**: 7 AIs on the same spline with different speeds converge at turn 1. Overtaking is suppressed until cars spread. Grid order at race start is the actual qualifying order. If pileup is problematic, add a "first corner caution" where AI reduces aggression by 50% for the first 3 corners.
- **Risk**: AI lap times too fast or too slow relative to player
  **Mitigation**: `ai.formula.*` parameters are all tuning knobs. Adjust speedMin/speedRange to shift all AI pace up/down proportionally.

## GDD Requirements Addressed

| GDD System   | Requirement                 | How This ADR Addresses It                           |
| ------------ | --------------------------- | --------------------------------------------------- |
| ai-driver.md | Same physics, same input    | AI produces IInput signals — Physics doesn't branch |
| ai-driver.md | Spline-based path following | PID + curvature feedforward                         |
| ai-driver.md | Overtaking state machine    | Normal → Following → Passing with dynamic offset    |
| ai-driver.md | Team performance model      | sqrt compression from 1991 points                   |
| ai-driver.md | Difficulty scaling          | multiplier × teamPerformance before param formulas  |
| ai-driver.md | Mistake model               | SeededRandom vs mistakeChance per tick              |
| ai-driver.md | Pit strategy delegated      | Pit Stop suppresses AI input during pit active      |

## Performance Implications

- **CPU**: 7 AIControllers × ~10 math ops per tick ≈ 0.003ms
- **Memory**: 7 AIController × ~200 bytes = ~1.4KB

## Validation Criteria

- [ ] AI completes a race lap without leaving the track surface
- [ ] AI lap time within ±15% of reference hot lap on same track
- [ ] Macklen overtakes Layton Hall within 3 laps on any track
- [ ] AI never exceeds grip envelope (car understeers if gripMax exceeded)
- [ ] Same seed + same config produces same AI trajectory across runs
- [ ] Difficulty 0.75 produces visibly slower AI than difficulty 1.25
- [ ] AI with mistakeChance 0.05 makes more errors than AI with mistakeChance 0.0 over 10 laps
- [ ] InputState from AI car matches same interface as player Input (steer -1..1, throttle 0..1, etc.)

## Related Decisions

- ADR-0006 (Input Abstraction — AI produces same IInput interface)
- ADR-0002 (Fixed Timestep — pipeline slot #3, SeededRandom via race seed)
- ADR-0008 (Physics — consumes AI input identically to player input)
- ADR-0014 (Pit Stop Flow — suppresses AI input during pit active)
- ADR-0011 (Fuel — AI reads fuelLevel for pit timing)
- ADR-0012 (Tire — AI reads tireCondition for corner speed)
