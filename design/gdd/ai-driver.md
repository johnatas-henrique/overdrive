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

**1. Same physics, same input.** AI cars receive no special treatment. Every steer, throttle, and brake command goes through the same Physics/Handling system as the player. If the AI asks for more lateral grip than `grip_max` allows, the car understeers — same as the player.

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

- **Steer**: `PID(lateral_error) + curvature_feedforward`
  - `lateral_error` = perpendicular distance from car position to spline at current progress
  - `curvature_feedforward` = spline curvature at lookahead point (5m ahead), scaled by speed
  - Steer output clamped to -1..1 just like player input

- **Lateral offset**: each AI has a dynamic `targetOffset` (meters left/right of center spline).
  - Base offset: determined by the AI's natural line preference (e.g. -0.5m means tendency to stay on the left side of the track)
  - During overtaking: offset shifts to ±2.5m temporarily
  - Smooth interpolation toward target at a configurable rate
  - Erratic behavior prevented by capping offset change to `max_offset_delta_per_tick`

### Speed Target Calculation

The AI determines a target speed for each point on the spline:

```
target_speed = min(
  max_speed(vehicle_stats, track_straight),
  corner_speed(curvature_at_progress, grip_available, params)
)
```

- `max_speed` = determined by the car's `velocidade_final` stat × `params.speed_mult`
- `corner_speed` = maximum speed that keeps lateral acceleration below `grip_max × params.grip_margin`
  - `grip_margin` (0.0–1.0): how close to the grip limit the AI is willing to drive
  - A grip_margin of 0.85 means the AI targets 85% of available grip — safe, consistent
  - A grip_margin of 0.95 means the AI lives on the edge — faster but risks understeer

The AI then applies throttle (to reach target_speed) or brake (to shed speed before a corner with lower target_speed).

**Braking**: the AI begins braking at a point determined by speed differential and `params.braking_aggression`:

```
brake_start_distance = (current_speed² - target_speed²) / (2 × braking_deceleration × braking_aggression)
braking_aggression = 0.8–1.2 (higher = brakes later, more aggressive)
```

If the AI brakes too late (braking_aggression > 1.0), it may enter the corner faster than intended — the car understeers naturally.

**Throttle application**: on corner exit, throttle rises smoothly at `params.throttle_ramp_rate`. A higher ramp rate means the AI gets on power earlier, carrying more exit speed. A lower rate means cautious, conservative exits.

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
    speed_diff  (tight       pulls away
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
- If `speed_diff > 5%` AND curvature is open (straight or corner radius > 50m) → transition to Passing
- If car ahead pulls away (> 30m gap) → return to Normal

**Passing**:

- Lateral offset shifts by `params.passing_offset` (default 2.5m) toward the passing side
- Throttle target increases to `min(target_speed × 1.05, max_speed)` — AI pushes harder during pass
- If pass completes (car ahead is now fully behind with clearance) → return to Normal
- If pass fails (corner approaching, gap closing, or car ahead pulls away > 30m) → return to Following
- During pass, if collision occurs, Collision system handles it normally (same as player collision)

**Important**: the AI does not distinguish between player cars and AI cars — the overtaking logic is identical regardless of who is ahead.

### Input Simulation

The AI controller produces the same data contract as the Input system:

| Signal   | Range   | Method                                                   |
| -------- | ------- | -------------------------------------------------------- |
| steer    | -1..1   | PID(spline error) + curvature_feedforward                |
| throttle | 0..1    | Speed error to target_speed (more error = more throttle) |
| brake    | 0..1    | Speed error to target_speed (more error = more brake)    |
| gear     | -1/0/+1 | Auto shift at RPM thresholds, as gear_delta pulse        |

These signals enter Physics/Handling identically to player input. The Physics system does not know whether input came from a human or an AI — it applies the same grip model to both.

### Team Performance Model

AI performance is rooted in the **1991 F1 Constructors Championship** — the real-world season that inspired the game's 8-team grid. Each team has a `team_performance` value (0.0–1.0) derived from its real 1991 points, determining how fast, aggressive, and consistent the AI driver is.

#### 3.7.1 Constructor Hierarchy

| Team (Parody)   | Reference          | 1991 WCC | Points | team_performance | Tier          |
| --------------- | ------------------ | :------: | -----: | ---------------: | ------------- |
| **Macklen**     | McLaren-Honda      |    1º    |    139 |             1.00 | Front-runner  |
| **Willard**     | Williams-Renault   |    2º    |    125 |             0.95 | Front-runner  |
| **Ferrell**     | Ferrari            |    3º    |   55.5 |             0.63 | Podium threat |
| **Bennett**     | Benetton-Ford      |    4º    |   38.5 |             0.53 | Midfield      |
| **Jordash**     | Jordan-Ford        |    5º    |     13 |             0.31 | Midfield      |
| **Tyrant**      | Tyrrell-Honda      |    6º    |     12 |             0.29 | Midfield      |
| **Lorris** 🎮   | Lotus-Judd         |    9º    |      3 |             0.15 | Backmarker    |
| **Layton Hall** | Leyton House-Ilmor |   12º    |      1 |             0.08 | Backmarker    |

`team_performance` uses sqrt compression (`√(pts / 139)`) rather than linear — this preserves the real hierarchy without making the backmarkers unplayably slow.

> 🎮 = Player team in Phase 1. The #11 Lorris AI driver does not exist — the player occupies that seat.

#### 3.7.2 Variance by Tier

Each AI driver's final parameters are `effective = base_value + SeededRandom(-variance, +variance)`, where `base_value` is derived from `team_performance` and `variance` is set by tier.

> **SeededRandom**: a deterministic pseudo-random number generator defined in the Determinism Contract (`design/gdd/determinism-contract.md`). All simulation RNG uses `SeededRandom` seeded with the race ID, guaranteeing reproducible results across runs — replay sync, multiplayer determinism, and debug reproducibility depend on this. `Math.random()` is never used in simulation code.

| Tier                  | team_performance | Variance | Effect                                                                 |
| --------------------- | ---------------: | -------: | ---------------------------------------------------------------------- |
| Front-runner          |           ≥ 0.85 |    ±0.02 | Consistent — nearly identical lap times, order decided by tiny margins |
| Podium threat         |        0.45–0.84 |    ±0.04 | Variable — can challenge front-runners on a perfect day                |
| Midfield / Backmarker |           < 0.45 |    ±0.06 | Highly variable — good race = miracle, bad race = early DNF            |

The variance is capped so tier crossing is rare (~5% of races) but not impossible. A Lorris with max variance (+0.06) and a Bennett with min variance (-0.04) can meet on pace ~1 race in 20 — creating a memorable underdog moment without breaking the hierarchy.

#### 3.7.3 Difficulty Scaling

Single Race passes a `difficulty` multiplier that scales all AI `team_performance` values before parameter computation:

| Difficulty | Multiplier | Effect                                         |
| ---------- | ---------- | ---------------------------------------------- |
| Easy       | 0.8 × tp   | AI braking earlier, less aggressive overtaking |
| Medium     | 1.0 × tp   | Baseline — as designed above                   |
| Hard       | 1.2 × tp   | AI braking later, more aggressive overtaking   |

The multiplier is applied to `team_performance` **before** the parameter formulas in Section 3.7.4. This means Easy Macklen (1.0 × 0.8 = 0.80) performs like a Podium threat, while Hard Layton Hall (0.08 × 1.2 = 0.096) remains a backmarker but slightly more competitive.

**Config key**: `single_race.difficulty.easy` (default 0.8), `single_race.difficulty.hard` (default 1.2).

#### 3.7.4 Parameter Formulas

Each of the 7 AI parameters is computed from `team_performance` at PreRace:

**Rising with performance** (higher tp = higher value):

```
effective = base_min + (tp × range) + SeededRandom(-variance, +variance)
```

| Parameter            | base_min | range | Formula          |
| -------------------- | -------: | ----: | ---------------- |
| `speed_mult`         |     0.85 |  0.15 | 0.85 + tp × 0.15 |
| `braking_aggression` |     0.80 |  0.40 | 0.80 + tp × 0.40 |
| `grip_margin`        |     0.75 |  0.20 | 0.75 + tp × 0.20 |
| `throttle_ramp_rate` |     0.40 |  0.50 | 0.40 + tp × 0.50 |
| `passing_aggression` |     0.30 |  0.90 | 0.30 + tp × 0.90 |

**Falling with performance** (lower tp = higher value):

```
effective = max_value × (1.0 - tp × 0.85) + SeededRandom(-variance, +variance)
```

| Parameter        | max_value | Formula                  |
| ---------------- | --------: | ------------------------ |
| `mistake_chance` |      0.06 | 0.06 × (1.0 − tp × 0.85) |

**Neutral** (not derived from performance):

| Parameter           | Range    | Notes                                     |
| ------------------- | -------- | ----------------------------------------- |
| `offset_preference` | −1.0–1.0 | Fixed per driver, does not change by race |

#### 3.7.5 Per-Team Effective Parameters (at mean roll)

| Team            | speed_mult | braking_agg | grip_margin | throttle_ramp | passing_agg | mistake_chance |
| --------------- | ---------: | ----------: | ----------: | ------------: | ----------: | -------------: |
| **Macklen**     |      1.000 |        1.20 |        0.95 |          0.90 |        1.20 |          0.009 |
| **Willard**     |      0.993 |        1.18 |        0.94 |          0.88 |        1.16 |          0.012 |
| **Ferrell**     |      0.945 |        1.05 |        0.88 |          0.72 |        0.87 |          0.028 |
| **Bennett**     |      0.930 |        1.01 |        0.86 |          0.67 |        0.78 |          0.033 |
| **Jordash**     |      0.897 |        0.92 |        0.81 |          0.56 |        0.58 |          0.044 |
| **Tyrant**      |      0.894 |        0.92 |        0.81 |          0.55 |        0.56 |          0.045 |
| **Lorris**      |      0.873 |        0.86 |        0.78 |          0.48 |        0.44 |          0.052 |
| **Layton Hall** |      0.862 |        0.83 |        0.77 |          0.44 |        0.37 |          0.056 |

#### 3.7.6 Data-Driven Configuration

All 8 `team_performance` values, tier thresholds, and formula coefficients live in `src/config/ai.ts` — loaded via ConfigManager `ai.*` namespace. Tuning is JSON edit + HMR:

```typescript
// src/config/ai.ts
export const aiConfig = {
  teams: {
    macklen: { team_performance: 1.0, offset_preference: 0.3 },
    willard: { team_performance: 0.95, offset_preference: -0.2 },
    ferrell: { team_performance: 0.63, offset_preference: 0.1 },
    bennett: { team_performance: 0.53, offset_preference: 0.0 },
    jordash: { team_performance: 0.31, offset_preference: 0.5 },
    tyrant: { team_performance: 0.29, offset_preference: -0.6 },
    lorris: { team_performance: 0.15, offset_preference: -0.1 },
    laytonHall: { team_performance: 0.08, offset_preference: 0.2 },
  },
  formula: {
    speed_min: 0.85,
    speed_range: 0.15,
    braking_min: 0.8,
    braking_range: 0.4,
    grip_min: 0.75,
    grip_range: 0.2,
    throttle_min: 0.4,
    throttle_range: 0.5,
    passing_min: 0.3,
    passing_range: 0.9,
    mistake_max: 0.06,
    mistake_slope: 0.85,
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
steer = clamp(PID(lateral_error) + curvature_feedforward, -1, 1)
```

where:

```
PID(lateral_error) = Kp × lat_error + Kd × d_lat_error/dt
curvature_feedforward = lookahead_curvature × speed × Kff
```

### Target Corner Speed

```
corner_speed = sqrt(grip_max × grip_margin × curvature_radius)
```

This is the same formula the player experiences: maximum lateral acceleration before grip breaks.

### Brake Start Distance

```
brake_distance = (v_curr² - v_target²) / (2 × BRAKE_DECEL × braking_aggression)
```

If `brake_distance > distance_to_corner`, the AI brakes now.

### Gear Shift Points

```
upshift_rpm = 0.95 × max_rpm
downshift_rpm = 0.30 × max_rpm
```

AI shifts up at 95% RPM and downshifts at 30% RPM. These are tuning knobs, but Phase 1 uses sensible defaults.

---

## System Interactions

| System               | Data Out                                            | Data In                                         | Direction             |
| -------------------- | --------------------------------------------------- | ----------------------------------------------- | --------------------- |
| Physics/Handling     | steer, throttle, brake, gear_delta (same as player) | —                                               | AI Driver → Physics   |
| Entity/Car Lifecycle | —                                                   | CarEntity references (mesh, physics body ID)    | AI Driver ← Lifecycle |
| Track + Environment  | —                                                   | spline data, track width at progress            | AI Driver ← Track     |
| Collision            | —                                                   | collision events (to detect if overtake failed) | AI Driver ← Collision |
| Fuel                 | —                                                   | fuel_level (to inform pit timing)               | AI Driver ← Fuel      |
| Tire Wear            | —                                                   | tire_condition (grip available)                 | AI Driver ← Tire Wear |
| Pit Stop             | per-AI pit_state (block AI input during pit stop)   | AI Driver ← Pit Stop                            |
| Data & Config        | —                                                   | per-AI parameter range config, tuning knobs     | AI Driver ← Config    |

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

- **AI gets stuck behind slower AI on overtake-prohibited section**: state machine stays in Following. When a straight opens, the Passing condition triggers naturally. If the entire lap is tight corners (Monaco), the passing_aggression parameter determines whether the AI attempts a pass in marginal space.

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

| Knob                         | Namespace                 | Default | Range    | Description                                           |
| ---------------------------- | ------------------------- | ------- | -------- | ----------------------------------------------------- |
| Macklen team_performance     | ai.teams.macklen          | 1.00    | 0–1.0    | Constructor performance baseline                      |
| Willard team_performance     | ai.teams.willard          | 0.95    | 0–1.0    | Constructor performance baseline                      |
| Ferrell team_performance     | ai.teams.ferrell          | 0.63    | 0–1.0    | Constructor performance baseline                      |
| Bennett team_performance     | ai.teams.bennett          | 0.53    | 0–1.0    | Constructor performance baseline                      |
| Jordash team_performance     | ai.teams.jordash          | 0.31    | 0–1.0    | Constructor performance baseline                      |
| Tyrant team_performance      | ai.teams.tyrant           | 0.29    | 0–1.0    | Constructor performance baseline                      |
| Lorris team_performance      | ai.teams.lorris           | 0.15    | 0–1.0    | Constructor performance baseline                      |
| Layton Hall team_performance | ai.teams.laytonHall       | 0.08    | 0–1.0    | Constructor performance baseline                      |
| AI speed min                 | ai.formula.speed_min      | 0.85    | 0.5–1.0  | Min speed_mult (floor for team_performance = 0)       |
| AI speed range               | ai.formula.speed_range    | 0.15    | 0–0.5    | Range added per unit team_performance                 |
| AI braking min               | ai.formula.braking_min    | 0.80    | 0.5–1.5  | Min braking_aggression floor                          |
| AI braking range             | ai.formula.braking_range  | 0.40    | 0–1.0    | Range added per unit team_performance                 |
| AI grip min                  | ai.formula.grip_min       | 0.75    | 0.5–1.0  | Min grip_margin floor                                 |
| AI grip range                | ai.formula.grip_range     | 0.20    | 0–0.5    | Range added per unit team_performance                 |
| AI throttle min              | ai.formula.throttle_min   | 0.40    | 0.2–1.0  | Min throttle_ramp_rate floor                          |
| AI throttle range            | ai.formula.throttle_range | 0.50    | 0–1.0    | Range added per unit team_performance                 |
| AI passing min               | ai.formula.passing_min    | 0.30    | 0–1.5    | Min passing_aggression floor                          |
| AI passing range             | ai.formula.passing_range  | 0.90    | 0–2.0    | Range added per unit team_performance                 |
| AI mistake max               | ai.formula.mistake_max    | 0.06    | 0–0.2    | Max mistake_chance (ceiling for team_performance = 0) |
| AI mistake slope             | ai.formula.mistake_slope  | 0.85    | 0–1.0    | How much team_performance reduces mistakes            |
| Front-runner variance        | ai.tiers[0].variance      | 0.02    | 0–0.1    | ± parameter spread for tp ≥ 0.85                      |
| Midfield variance            | ai.tiers[1].variance      | 0.04    | 0–0.1    | ± parameter spread for 0.45 ≤ tp < 0.85               |
| Backmarker variance          | ai.tiers[2].variance      | 0.06    | 0–0.15   | ± parameter spread for tp < 0.45                      |
| AI passing offset            | ai.passing_offset         | 2.5     | 1.5–5.0  | Lateral shift (meters) during overtaking              |
| AI passing timeout           | ai.passing_timeout        | 3.0     | 1.0–8.0  | Seconds before aborting a pass attempt                |
| AI following distance        | ai.follow_dist            | 25      | 10–50    | Meters on spline to trigger Following state           |
| AI max offset delta per tick | ai.offset_delta           | 0.05    | 0.01–0.2 | Max lateral offset change per tick                    |
| AI mistake magnitude         | ai.mistake_mag            | 0.15    | 0–0.5    | Amplitude of random steer/throttle error              |

---

## Acceptance Criteria

1. AI car completes a full race lap without leaving the track surface (spline error < track width at all points).
2. AI car's lap time is within ±15% of a reference hot lap on the same track.
3. 7 AI cars complete a 5-lap race without any car failing to finish (excluding DNF from fuel/tire depletion).
4. Macklen AI overtakes Layton Hall AI within 3 laps on any track — the full hierarchical gap from top to bottom produces a demonstrable pace difference.
5. AI performs at least one overtake during a 5-lap race on Interlagos (high variance).
6. AI never exceeds the physics grip envelope — car understeers if AI requests more lateral G than grip_max allows.
7. AI pit strategy triggers at least 2 pit entries across 7 AIs during a fuel-exhausting race distance.
8. AI never merges from pit lane into an occupied slot (200ms check prevents collision).
9. AI recovers from a missed braking point within one corner (no spiral of errors).
10. All 7 AI cars finish with different lap times (variance is effective).
11. Player colliding with an AI car triggers `collision.impact` with correct participants (AI does not react defensively, Collision handles it).
12. AI driver with `mistake_chance = 0.05` makes visibly more errors than one with `mistake_chance = 0.0` over 10 laps.
13. After pit exit, AI returns to its racing line within 3 corners.
