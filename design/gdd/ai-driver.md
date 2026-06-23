# AI Driver

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Simple Strategy

## Overview

The AI Driver produces analog input signals (steer, throttle, brake, gear) for each AI-controlled car — the same signals that the Input system produces for the player. AI cars use the exact same Physics/Handling system as the player: same grip model, same limitations, same speed feel. The AI does not cheat; it drives within the same physics envelope.

Phase 1 delivers 7 AI opponents with varied performance parameters so each race is dynamic. Without variance, the fastest AI always finishes first regardless of driving — a procession. With variance, AI cars with lower top speed can out-brake rivals into corners or carry more speed through exits, creating overtaking opportunities naturally.

---

## Player Fantasy

The player looks at the timing board and sees AI cars swapping positions: "Why did Ribello (#3) pass Vasari (#6) into turn 4? Because Ribello is better under braking." Each AI opponent feels like a distinct driver with a character, even though Phase 1 has no explicit personality system — the character emerges naturally from parameter differences.

The player never wonders "is the AI cheating?" because the AI never accelerates beyond the grip envelope the player experiences.

---

## Detailed Design

### Core Rules

**1. Same physics, same input.** AI cars receive no special treatment. Every steer, throttle, and brake command goes through the same Physics/Handling system as the player. If the AI asks for more lateral grip than `gripMax` allows, the car understeers — same as the player.

**2. Auto gear.** AI shifts gears automatically at fixed RPM points. Gear changes are instantaneous (no clutch delay, no missed shifts). This is a design convenience, not a simulation gap — manual AI shifting would produce no observable gameplay benefit for the player.

**3. Spline-based path following.** Every AI car tracks its progress along the central spline (from `TrackConfig.spline`). The AI produces a steer value proportional to the lateral error between the car's position and the spline, plus a feed-forward term based on spline curvature at the current lookahead point.

**4. Per-AI parameter variance.** Each of the 7 AI cars draws its parameters from a base value with per-AI variance. Variances are assigned at PreRace and fixed for the race duration. Enough variance exists that no two AIs drive identically, but no AI drives erratically.

**5. No collision avoidance system.** The AI does not pathfind around other cars. Instead, a small overtaking state machine (Normal → Following → Passing → Normal) sits on top of the spline follower, adjusting lateral offset and speed targets when a car is ahead.

### AI Controller (per-car)

One `AIController` instance per AI car, created at PreRace and ticked every physics tick during Racing:

```typescript
interface AIController {
  carId: string;
  params: AIDriverParams; // per-AI parameter set
  spline: SplineSegment[]; // reference to TrackConfig.spline
  progress: number; // 0.0–1.0 position along spline
  state: AIDriverState; // Normal | Following | Passing
  targetOffset: number; // current lateral offset target
}
```

### Spline Following

The AI calculates two values each tick:

- **Steer**: `PID(lateralError) + curvatureFeedforward`
  - `lateralError` = perpendicular distance from car position to spline at current progress
  - `curvatureFeedforward` = spline curvature at lookahead point (5m ahead), scaled by speed
  - Steer output clamped to -1..1 just like player input

- **Lateral offset**: each AI has a dynamic `targetOffset` (meters left/right of center spline).
  - Base offset: determined by the AI's natural line preference (e.g. -0.5m means tendency to stay on the left side of the track)
  - During overtaking: offset shifts to ±2.5m temporarily
  - Smooth interpolation toward target at a configurable rate
  - Erratic behavior prevented by capping offset change to `maxOffsetDeltaPerTick`

### Speed Target Calculation

The AI determines a target speed for each point on the spline:

```
targetSpeed = min(
  maxSpeed(vehicleStats, trackStraight),
  cornerSpeed(curvatureAtProgress, gripAvailable, params)
)
```

- `maxSpeed` = determined by the car's `topSpeed` stat × `params.speedMult`
- `cornerSpeed` = maximum speed that keeps lateral acceleration below `gripMax × params.gripMargin`
  - `gripMargin` (0.0–1.0): how close to the grip limit the AI is willing to drive
  - A gripMargin of 0.85 means the AI targets 85% of available grip — safe, consistent
  - A gripMargin of 0.95 means the AI lives on the edge — faster but risks understeer

The AI then applies throttle (to reach targetSpeed) or brake (to shed speed before a corner with lower targetSpeed).

**Braking**: the AI begins braking at a point determined by speed differential and `params.brakingAggression`:

```
brakeStartDistance = (currentSpeed² - targetSpeed²) / (2 × brakingDeceleration × brakingAggression)
brakingAggression = 0.8–1.2 (higher = brakes later, more aggressive)
```

If the AI brakes too late (brakingAggression > 1.0), it may enter the corner faster than intended — the car understeers naturally.

**Throttle application**: on corner exit, throttle rises smoothly at `params.throttleRampRate`. A higher ramp rate means the AI gets on power earlier, carrying more exit speed. A lower rate means cautious, conservative exits.

### Overtaking State Machine

```
                ┌──────────┐
                │  Normal  │
                └────┬─────┘
                     │ car ahead detected < 25m
                     ▼
              ┌──────────────┐
              │  Following   │
              └──────┬───────┘
          ┌──────────┼──────────┐
          │          │          │
          ▼          ▼          ▼
    space &&    no space     car ahead
    speedDiff  (tight       pulls away
    > threshold  corner)     or lap ends
          │          │          │
          ▼          ▼          │
    ┌──────────┐  stay in   ───┘
    │ Passing  │  Following
    └────┬─────┘
         │ pass complete
         ▼
    ┌──────────┐
    │  Normal  │
    └──────────┘
```

**Normal**: AI follows racing line at computed target speed. Lateral offset at base value.

**Following** (car ahead detected < 25m on spline):

- AI reduces throttle to match speed of car ahead
- Lateral offset adjusts toward the side expected to overtake (based on upcoming curvature — inside line if next corner is left, outside if right)
- If `speedDiff > 5%` is sustained for ≥3 ticks AND curvature is open (straight or corner radius > 50m) → transition to Passing
- If car ahead pulls away (> 30m gap) → return to Normal

**Passing**:

- Lateral offset is calculated dynamically: `offset = min(passingOffsetScale × halfWidth, halfWidth − carHalfWidth − 0.5m)`, where `halfWidth` comes from `TrackEnvironment.getTrackHalfWidth()` and `carHalfWidth` from `physics.carHalfWidth`. This guarantees the AI car stays within the track surface during the pass.
- Before entering Passing state, AI checks: `(passingOffsetScale × halfWidth) + carHalfWidth < halfWidth` — if the car physically cannot fit in a passing position, AI stays in Following and waits for a wider section
- Throttle target increases to `min(targetSpeed × 1.05, maxSpeed)` — AI pushes harder during pass
- If pass completes (car ahead is now fully behind with clearance) → return to Normal
- If pass fails (corner approaching, gap closing, or car ahead pulls away > 30m) → return to Following
- During pass, if collision occurs, Collision system handles it normally (same as player collision)

**Important**: the AI does not distinguish between player cars and AI cars — the overtaking logic is identical regardless of who is ahead.

### Input Simulation

The AI controller produces the same data contract as the Input system:

| Signal   | Range   | Method                                                  |
| -------- | ------- | ------------------------------------------------------- |
| steer    | -1..1   | PID(spline error) + curvatureFeedforward                |
| throttle | 0..1    | Speed error to targetSpeed (more error = more throttle) |
| brake    | 0..1    | Speed error to targetSpeed (more error = more brake)    |
| gear     | -1/0/+1 | Auto shift at RPM thresholds, as gearDelta pulse        |

These signals enter Physics/Handling identically to player input. The Physics system does not know whether input came from a human or an AI — it applies the same grip model to both.

### Team Performance Model

AI performance is rooted in the **1991 F1 Constructors Championship** — the real-world season that inspired the game's 8-team grid. Each team has a `teamPerformance` value (0.0–1.0) derived from its real 1991 points, determining how fast, aggressive, and consistent the AI driver is.

#### Constructor Hierarchy

| Team (Parody)   | Reference          | 1991 WCC | Points | teamPerformance | Tier          |
| --------------- | ------------------ | :------: | -----: | --------------: | ------------- |
| **Macklen**     | McLaren-Honda      |    1º    |    139 |            1.00 | Front-runner  |
| **Willard**     | Williams-Renault   |    2º    |    125 |            0.95 | Front-runner  |
| **Ferrell**     | Ferrari            |    3º    |   55.5 |            0.63 | Podium threat |
| **Bennett**     | Benetton-Ford      |    4º    |   38.5 |            0.53 | Midfield      |
| **Jordash**     | Jordan-Ford        |    5º    |     13 |            0.31 | Midfield      |
| **Tyrant**      | Tyrrell-Honda      |    6º    |     12 |            0.29 | Midfield      |
| **Lorris** 🎮   | Lotus-Judd         |    9º    |      3 |            0.15 | Backmarker    |
| **Layton Hall** | Leyton House-Ilmor |   12º    |      1 |            0.08 | Backmarker    |

`teamPerformance` uses sqrt compression (`√(pts / 139)`) rather than linear — this preserves the real hierarchy without making the backmarkers unplayably slow.

#### Personality→Parameter Mapping

Each team's `teamPerformance` and `offsetPreference` produce a distinct on-track personality, defined in the art bible (Section 5.4). This table maps parameters to behaviour so a programmer can see the design intent behind each value:

| Team (Parody)   | teamPerformance | offsetPreference | Personality    | What Drives The Behaviour                                                                  |
| --------------- | --------------: | ---------------: | -------------- | ------------------------------------------------------------------------------------------ |
| **Macklen**     |            1.00 |              0.3 | Dominant       | Max performance + positive offset = perfect but predictable reference. No unforced errors. |
| **Willard**     |            0.95 |             -0.2 | Lightning Bolt | Near-max perf + negative offset = raw speed but inconsistent decisions.                    |
| **Ferrell**     |            0.63 |              0.1 | Technical      | Mid-high perf + neutral offset = smooth, clean, rarely dominant.                           |
| **Bennett**     |            0.53 |              0.0 | Consistent     | Mid perf + zero offset = dependable, maximum grip, no surprises.                           |
| **Jordash**     |            0.31 |              0.5 | Impulsive      | Low perf + high offset = reckless bravery. Best corner speed, worst decision-making.       |
| **Tyrant**      |            0.29 |             -0.6 | Defensive      | Low perf + very negative offset = blocks and brake-tests. Not fast, but hard to pass.      |
| **Lorris**      |            0.15 |             -0.1 | Rookie         | Low perf + near-zero offset = raw talent, erratic execution. Grows stronger mid-race.      |
| **Layton Hall** |            0.08 |              0.2 | Aggressive     | Minimum perf + slight positive offset = drives over the limit. 50% brilliance, 50% crash.  |

> `offsetPreference`: −1.0 = favours defence/conservatism; +1.0 = favours attack/risk.
> `teamPerformance` determines maximum possible pace; `offsetPreference` determines how often the driver reaches it.

> 🎮 = Player team in Phase 1. The #11 Lorris AI driver does not exist — the player occupies that seat.

#### Variance by Tier

Each AI driver's final parameters are `effective = baseValue + SeededRandom(-variance, +variance)`, where `baseValue` is derived from `teamPerformance` and `variance` is set by tier.

> **SeededRandom**: a deterministic pseudo-random number generator defined in the Determinism Contract (`design/gdd/determinism-contract.md`). All simulation RNG uses `SeededRandom` seeded with the race ID, guaranteeing reproducible results across runs — replay sync, multiplayer determinism, and debug reproducibility depend on this. `Math.random()` is never used in simulation code.

| Tier                  | teamPerformance | Variance | Effect                                                                 |
| --------------------- | --------------: | -------: | ---------------------------------------------------------------------- |
| Front-runner          |          ≥ 0.85 |    ±0.02 | Consistent — nearly identical lap times, order decided by tiny margins |
| Podium threat         |       0.45–0.84 |    ±0.04 | Variable — can challenge front-runners on a perfect day                |
| Midfield / Backmarker |          < 0.45 |    ±0.06 | Highly variable — good race = miracle, bad race = early DNF            |

The variance is capped so tier crossing is rare (~5% of races) but not impossible. A Lorris with max variance (+0.06) and a Bennett with min variance (-0.04) can meet on pace ~1 race in 20 — creating a memorable underdog moment without breaking the hierarchy.

#### Difficulty Scaling

Single Race passes a `difficulty` multiplier that scales all AI `teamPerformance` values before parameter computation:

| Difficulty | Multiplier | Effect                                        |
| ---------- | ---------- | --------------------------------------------- |
| Very Easy  | 0.75 × tp  | AI significantly slower — leisurely pace      |
| Easy       | 0.875 × tp | AI slower — good for learning tracks          |
| Medium     | 1.0 × tp   | Baseline — as designed above                  |
| Hard       | 1.125 × tp | AI sharper — tighter lines, better exits      |
| Very Hard  | 1.25 × tp  | AI highly optimized — punishes small mistakes |

The multiplier is applied to `teamPerformance` **before** the parameter formulas in Section 3.7.4. This means Very Easy Macklen (1.0 × 0.75 = 0.75) performs at Midfield level, while Very Hard Layton Hall (0.08 × 1.25 = 0.10) remains a backmarker but slightly more competitive.

**Config keys**: `singleRace.difficulty.veryEasy` (default 0.75), `singleRace.difficulty.easy` (0.875), `singleRace.difficulty.medium` (1.0), `singleRace.difficulty.hard` (1.125), `singleRace.difficulty.veryHard` (1.25).

#### Parameter Formulas

Each of the 7 AI parameters is computed from `teamPerformance` at PreRace:

**Rising with performance** (higher tp = higher value):

```
effective = baseMin + (tp × range) + SeededRandom(-variance, +variance)
```

| Parameter           | baseMin | range | Formula          |
| ------------------- | ------: | ----: | ---------------- |
| `speedMult`         |    0.85 |  0.15 | 0.85 + tp × 0.15 |
| `brakingAggression` |    0.80 |  0.40 | 0.80 + tp × 0.40 |
| `gripMargin`        |    0.75 |  0.20 | 0.75 + tp × 0.20 |
| `throttleRampRate`  |    0.40 |  0.50 | 0.40 + tp × 0.50 |
| `passingAggression` |    0.30 |  0.90 | 0.30 + tp × 0.90 |

**Falling with performance** (lower tp = higher value):

```
effective = maxValue × (1.0 - tp × 0.85) + SeededRandom(-variance, +variance)
```

| Parameter       | maxValue | Formula                  |
| --------------- | -------: | ------------------------ |
| `mistakeChance` |     0.06 | 0.06 × (1.0 − tp × 0.85) |

**Neutral** (not derived from performance):

| Parameter          | Range    | Notes                                     |
| ------------------ | -------- | ----------------------------------------- |
| `offsetPreference` | −1.0–1.0 | Fixed per driver, does not change by race |

#### Per-Team Effective Parameters (at mean roll)

| Team            | speedMult | brakingAgg | gripMargin | throttleRamp | passingAgg | mistakeChance |
| --------------- | --------: | ---------: | ---------: | -----------: | ---------: | ------------: |
| **Macklen**     |     1.000 |       1.20 |       0.95 |         0.90 |       1.20 |         0.009 |
| **Willard**     |     0.993 |       1.18 |       0.94 |         0.88 |       1.16 |         0.012 |
| **Ferrell**     |     0.945 |       1.05 |       0.88 |         0.72 |       0.87 |         0.028 |
| **Bennett**     |     0.930 |       1.01 |       0.86 |         0.67 |       0.78 |         0.033 |
| **Jordash**     |     0.897 |       0.92 |       0.81 |         0.56 |       0.58 |         0.044 |
| **Tyrant**      |     0.894 |       0.92 |       0.81 |         0.55 |       0.56 |         0.045 |
| **Lorris**      |     0.873 |       0.86 |       0.78 |         0.48 |       0.44 |         0.052 |
| **Layton Hall** |     0.862 |       0.83 |       0.77 |         0.44 |       0.37 |         0.056 |

#### Data-Driven Configuration

All 8 `teamPerformance` values, tier thresholds, and formula coefficients live in `src/config/ai.ts` — loaded via ConfigManager `ai.*` namespace. Tuning is JSON edit + HMR:

```typescript
// src/config/ai.ts
export const aiConfig = {
  teams: {
    macklen: { teamPerformance: 1.0, offsetPreference: 0.3 },
    willard: { teamPerformance: 0.95, offsetPreference: -0.2 },
    ferrell: { teamPerformance: 0.63, offsetPreference: 0.1 },
    bennett: { teamPerformance: 0.53, offsetPreference: 0.0 },
    jordash: { teamPerformance: 0.31, offsetPreference: 0.5 },
    tyrant: { teamPerformance: 0.29, offsetPreference: -0.6 },
    lorris: { teamPerformance: 0.15, offsetPreference: -0.1 },
    laytonHall: { teamPerformance: 0.08, offsetPreference: 0.2 },
  },
  formula: {
    speedMin: 0.85,
    speedRange: 0.15,
    brakingMin: 0.8,
    brakingRange: 0.4,
    gripMin: 0.75,
    gripRange: 0.2,
    throttleMin: 0.4,
    throttleRange: 0.5,
    passingMin: 0.3,
    passingRange: 0.9,
    mistakeMax: 0.06,
    mistakeSlope: 0.85,
  },
  tiers: [
    { threshold: 0.85, variance: 0.02 },
    { threshold: 0.45, variance: 0.04 },
    { threshold: 0.0, variance: 0.06 },
  ],
};
```

### Pit Strategy

AI pit strategy is handled by the Pit Stop system (see pit-stop.md §AI Pit Strategy). AI pits when fuel or tires are critical; the Pit Stop system owns all timing decisions. The AI Driver provides only throttle/brake/steer blocking during pit active state.

---

## Formulas

### Steer Command

```
steer = clamp(PID(lateralError) + curvatureFeedforward, -1, 1)
```

where:

```
PID(lateralError) = Kp × latError + Kd × dLatErrorDt
curvatureFeedforward = lookaheadCurvature × speed × Kff
```

### Target Corner Speed

```
cornerSpeed = sqrt(gripMax × gripMargin × curvatureRadius)
```

This is the same formula the player experiences: maximum lateral acceleration before grip breaks.

### Brake Start Distance

```
brakeDistance = (vCurr² - vTarget²) / (2 × brakeDecel × brakingAggression)
```

If `brakeDistance > distanceToCorner`, the AI brakes now.

### Gear Shift Points

```
upshiftRpm = 0.95 × maxRpm
downshiftRpm = 0.30 × maxRpm
```

AI shifts up at 95% RPM and downshifts at 30% RPM. These are tuning knobs, but Phase 1 uses sensible defaults.

---

## System Interactions

| System               | Data Out                                           | Data In                                         | Direction             |
| -------------------- | -------------------------------------------------- | ----------------------------------------------- | --------------------- |
| Physics/Handling     | steer, throttle, brake, gearDelta (same as player) | —                                               | AI Driver → Physics   |
| Entity/Car Lifecycle | —                                                  | CarEntity references (mesh, physics body ID)    | AI Driver ← Lifecycle |
| Track + Environment  | —                                                  | spline data, track width at progress            | AI Driver ← Track     |
| Collision            | —                                                  | collision events (to detect if overtake failed) | AI Driver ← Collision |
| Fuel                 | —                                                  | fuelLevel (to inform pit timing)                | AI Driver ← Fuel      |
| Tire Wear            | —                                                  | tireCondition (grip available)                  | AI Driver ← Tire Wear |
| Pit Stop             | per-AI pitState (block AI input during pit stop)   | AI Driver ← Pit Stop                            |
| Data & Config        | —                                                  | per-AI parameter range config, tuning knobs     | AI Driver ← Config    |

---

## States & Transitions

| State        | Description                               | Entry                   | Exit                        |
| ------------ | ----------------------------------------- | ----------------------- | --------------------------- |
| **Inactive** | No race. AI controllers not created.      | Game boots              | PreRace start               |
| **Racing**   | All 7 AI controllers ticking every cycle. | GSM enters Racing state | GSM transitions to PostRace |

The AI Driver has no intermediate states. During pit stops, the AI car's physics input is blocked by Pit Stop (not by AI Driver) — the AI controller continues ticking but its output is suppressed by the pit guidance system.

During menu screens (Loading → Menu → PreRace), AI controllers exist in memory but do not tick.

---

## Edge Cases

- **AI car lapped by player**: no special logic. AI continues on racing line as normal. If the player is faster, they pass naturally via the overtaking system (player is "car ahead" from AI's perspective — AI reacts identically regardless of lap count).

- **AI enters pit mid-overtake**: abort pass immediately. AI pitState overrides AI Driver output. Overtaking aborted by Pit Stop system. After pit exit, AI returns to Normal state at current spline progress.

- **All 7 AI cars hit critical fuel/tire on the same lap**: expected behavior. Each car goes to its own garage slot (16 slots exist, 8 active in MVP) — no pit entry queue. Only pit exit merge is regulated by the merge check (200ms, force-merge at 5s). AI drivers in adjacent garages merge in natural order as gaps appear.

- **AI car damage (Alpha)**: when Damage is implemented, `collision.impact → car.damage_reported → physics affected`. AI Driver does not process damage events — Physics/Handling feeds back the mechanical effect naturally (car handles differently → AI's spline follower compensates). AI may understeer more, brake later, or lose exit speed — all emergent from the reduced grip, not from AI damage logic.

- **AI misses braking point (overcooks corner)**: AI enters corner too fast → understeers → misses apex → loses time. The AI does not correct mid-corner (no reactive steer adjustment beyond the PID controller). It recovers on exit and tries again next lap. This is intentional — it mirrors a human driver's mistake.

- **AI gets stuck behind slower AI on overtake-prohibited section**: state machine stays in Following. When a straight opens, the Passing condition triggers naturally. If the entire lap is tight corners (Monaco), the passingAggression parameter determines whether the AI attempts a pass in marginal space.

- **Full grid restart**: AI cars all at their original grid positions, same parameter sets. Race is independent — no memory of previous race.

---

## Dependencies

| Dependency           | Type     | Notes                                             |
| -------------------- | -------- | ------------------------------------------------- |
| Data & Config        | Upstream | Per-AI parameter ranges, tuning knobs             |
| Track + Environment  | Upstream | Spline data, track width                          |
| Entity/Car Lifecycle | Upstream | CarEntity with aiDriver references                |
| Physics/Handling     | Output   | Receives AI-generated input signals               |
| Collision            | Upstream | Receives collision events (optional in Phase 1)   |
| Fuel                 | Upstream | Reads fuel levels for pit timing strategy         |
| Tire Wear            | Upstream | Reads tire condition for corner speed calculation |
| Pit Stop             | Upstream | Coordinates AI pit entry/exit timing              |
| Race Management      | Upstream | Position grid for overtaking decisions            |

---

## Tuning Knobs

| Knob                         | Namespace                | Default | Range    | Description                                                                                                                                            |
| ---------------------------- | ------------------------ | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Macklen teamPerformance      | ai.teams.macklen         | 1.00    | 0–1.0    | Constructor performance baseline                                                                                                                       |
| Willard teamPerformance      | ai.teams.willard         | 0.95    | 0–1.0    | Constructor performance baseline                                                                                                                       |
| Ferrell teamPerformance      | ai.teams.ferrell         | 0.63    | 0–1.0    | Constructor performance baseline                                                                                                                       |
| Bennett teamPerformance      | ai.teams.bennett         | 0.53    | 0–1.0    | Constructor performance baseline                                                                                                                       |
| Jordash teamPerformance      | ai.teams.jordash         | 0.31    | 0–1.0    | Constructor performance baseline                                                                                                                       |
| Tyrant teamPerformance       | ai.teams.tyrant          | 0.29    | 0–1.0    | Constructor performance baseline                                                                                                                       |
| Lorris teamPerformance       | ai.teams.lorris          | 0.15    | 0–1.0    | Constructor performance baseline                                                                                                                       |
| Layton Hall teamPerformance  | ai.teams.laytonHall      | 0.08    | 0–1.0    | Constructor performance baseline                                                                                                                       |
| AI speed min                 | ai.formula.speedMin      | 0.85    | 0.5–1.0  | Min speedMult (floor for teamPerformance = 0)                                                                                                          |
| AI speed range               | ai.formula.speedRange    | 0.15    | 0–0.5    | Range added per unit teamPerformance                                                                                                                   |
| AI braking min               | ai.formula.brakingMin    | 0.80    | 0.5–1.5  | Min brakingAggression floor                                                                                                                            |
| AI braking range             | ai.formula.brakingRange  | 0.40    | 0–1.0    | Range added per unit teamPerformance                                                                                                                   |
| AI grip min                  | ai.formula.gripMin       | 0.75    | 0.5–1.0  | Min gripMargin floor                                                                                                                                   |
| AI grip range                | ai.formula.gripRange     | 0.20    | 0–0.5    | Range added per unit teamPerformance                                                                                                                   |
| AI throttle min              | ai.formula.throttleMin   | 0.40    | 0.2–1.0  | Min throttleRampRate floor                                                                                                                             |
| AI throttle range            | ai.formula.throttleRange | 0.50    | 0–1.0    | Range added per unit teamPerformance                                                                                                                   |
| AI passing min               | ai.formula.passingMin    | 0.30    | 0–1.5    | Min passingAggression floor                                                                                                                            |
| AI passing range             | ai.formula.passingRange  | 0.90    | 0–2.0    | Range added per unit teamPerformance                                                                                                                   |
| AI mistake max               | ai.formula.mistakeMax    | 0.06    | 0–0.2    | Max mistakeChance (ceiling for teamPerformance = 0)                                                                                                    |
| AI mistake slope             | ai.formula.mistakeSlope  | 0.85    | 0–1.0    | How much teamPerformance reduces mistakes                                                                                                              |
| Front-runner variance        | ai.tiers[0].variance     | 0.02    | 0–0.1    | ± parameter spread for tp ≥ 0.85                                                                                                                       |
| Midfield variance            | ai.tiers[1].variance     | 0.04    | 0–0.1    | ± parameter spread for 0.45 ≤ tp < 0.85                                                                                                                |
| Backmarker variance          | ai.tiers[2].variance     | 0.06    | 0–0.15   | ± parameter spread for tp < 0.45                                                                                                                       |
| AI passing offset scale      | ai.passingOffsetScale    | 0.35    | 0–0.5    | Fraction of track half-width used as lateral offset during overtaking. Dynamic: actual meters = offsetScale × halfWidth (clamped to fit track surface) |
| AI following distance        | ai.followDist            | 25      | 10–50    | Meters on spline to trigger Following state                                                                                                            |
| AI max offset delta per tick | ai.offsetDelta           | 0.05    | 0.01–0.2 | Max lateral offset change per tick                                                                                                                     |
| AI mistake magnitude         | ai.mistakeMag            | 0.15    | 0–0.5    | Amplitude of random steer/throttle error                                                                                                               |

---

## Acceptance Criteria

1. AI car completes a full race lap without leaving the track surface (spline error < track width at all points).
2. AI car's lap time is within ±15% of a reference hot lap on the same track.
3. 7 AI cars complete a 5-lap race without any car failing to finish (excluding DNF from fuel/tire depletion).
4. Macklen AI overtakes Layton Hall AI within 3 laps on any track — the full hierarchical gap from top to bottom produces a demonstrable pace difference.
5. AI performs at least one overtake during a 5-lap race on Interlagos (high variance).
6. AI never exceeds the physics grip envelope — car understeers if AI requests more lateral G than gripMax allows.
7. AI pit strategy triggers at least 2 pit entries across 7 AIs during a fuel-exhausting race distance.
8. AI never merges from pit lane into an occupied slot (200ms check prevents collision).
9. AI recovers from a missed braking point within one corner (no spiral of errors).
10. All 7 AI cars finish with different lap times (variance is effective).
11. Player colliding with an AI car triggers `collision.impact` with correct participants (AI does not react defensively, Collision handles it).
12. AI driver with `mistakeChance = 0.05` makes visibly more errors than one with `mistakeChance = 0.0` over 10 laps.
13. After pit exit, AI returns to its racing line within 3 corners.
