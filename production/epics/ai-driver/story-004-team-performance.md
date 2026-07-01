# Story 004: Team Performance Model & Difficulty Scaling

> **Epic**: AI Driver
> **Status**: Ready
> **Layer**: Core B
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/ai-driver.md`
**Requirement**: `TR-AI-003`

- TR-AI-003: SeededRandom per AI car for parametrisation: cornerSpeedBias, aggression, brakingPointVariance — deterministic from same seed.

**ADR Governing Implementation**: ADR-0013: AI Driver Architecture
**ADR Decision Summary**: Team performance model uses sqrt compression of 1991 constructor points. 7 parameters derived from teamPerformance via rising/falling/neutral formulas. Difficulty multiplier (0.75–1.25) applied before parameter computation. Tier variance (±0.02/0.04/0.06) via SeededRandom.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript — zero engine imports. Config data in `src/config/ai.ts` loaded via ConfigManager `ai.*` namespace.

**Control Manifest Rules (this layer)**:

- Required: C41 (deterministic via SeededRandom — parameters derived deterministically from seed)
- Required: C45 (difficulty multiplier — 5 levels)
- Required: C46 (AIDriverParams open set — extensible without breaking contracts)
- Required: C16 (C-F6 corollary — AI params never affect Physics branching)

---

## Acceptance Criteria

_From GDD `design/gdd/ai-driver.md`, scoped to this story:_

- [ ] 8 teams defined with `teamPerformance` values (0.08–1.0) using sqrt compression of 1991 constructor points: Macklen=1.0, Willard=0.95, Ferrell=0.63, Bennett=0.53, Jordash=0.31, Tyrant=0.29, Lorris=0.15, LaytonHall=0.08
- [ ] 5 rising parameters computed: `effective = baseMin + (tp × range) + SeededRandom(-variance, +variance)` — speedMult, brakingAggression, gripMargin, throttleRampRate, passingAggression
- [ ] 1 falling parameter computed: `effective = maxValue × (1.0 - tp × 0.85) + SeededRandom(-variance, +variance)` — mistakeChance
- [ ] 1 neutral parameter: `offsetPreference` (−1.0–1.0, fixed per driver, not derived from performance)
- [ ] Effective parameters at mean roll (no variance) match GDD table values within floating-point epsilon
- [ ] Difficulty multiplier applied to teamPerformance BEFORE formulas: `tp = teamPerformance × difficultyMultiplier`
- [ ] 5 difficulty levels: Very Easy (0.75), Easy (0.875), Medium (1.0), Hard (1.125), Very Hard (1.25)
- [ ] Tier variance applied: front-runner (±0.02, tp ≥ 0.85), mid-field (±0.04, tp 0.45–0.84), backmarker (±0.06, tp < 0.45)
- [ ] All 7 AI cars produce different effective params (different carIndex seeds → different SeededRandom streams)
- [ ] Config structure in `src/config/ai.ts` with all tuning knobs — loaded via ConfigManager `ai.*` namespace

---

## Implementation Notes

_Derived from ADR-0013 Implementation Guidelines:_

1. **Formula coefficients** live in `src/config/ai.ts` as tuning knobs. The formulas themselves are pure functions in the AI module.

2. **Rising parameter formulas** (explicit from GDD):
   | Parameter | baseMin | range |
   |---|---|---|
   | speedMult | 0.85 | 0.15 |
   | brakingAggression | 0.80 | 0.40 |
   | gripMargin | 0.75 | 0.20 |
   | throttleRampRate | 0.40 | 0.50 |
   | passingAggression | 0.30 | 0.90 |

3. **Falling parameter formula**: `mistakeChance = 0.06 × (1.0 − tp × 0.85) + SeededRandom(-variance, +variance)`

4. **Variance is deterministic**: Same seed + same raceConfig → same parameter set. `registerCar()` stores the variance offsets alongside the base parameters.

5. **Difficulty before formulas**: The difficulty multiplier is applied to `teamPerformance` directly. A Very Easy Macklen (1.0 × 0.75 = 0.75) has the same `tp` as a Medium Bennett. This is intentional — the hierarchy compresses at lower difficulty.

6. **SeededRandom per car**: Each `registerCar()` call receives `baseSeed + carIndex`. The RNG is used for variance AND is stored for runtime use (mistake rolls).

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 001: Controller framework (provides AIDriverParams interface, this story populates it)
- Story 006: Mistake model (uses mistakeChance at runtime, this story computes it at init)
- ConfigManager integration (Foundation layer — AI registers its namespace and reads config)

---

## QA Test Cases

- **AC-1**: 8 teams defined with correct performance values
  - Given: The team performance config
  - When: All 8 teams are enumerated
  - Then: Macklen=1.0, Willard=0.95, Ferrell=0.63, Bennett=0.53, Jordash=0.31, Tyrant=0.29, Lorris=0.15, LaytonHall=0.08
  - Edge cases: N/A — static data verification

- **AC-2**: Parameter formulas match GDD expected values (at mean roll, no variance)
  - Given: Macklen teamPerformance=1.0
  - When: All 5 parameters are computed with zero variance
  - Then: speedMult=1.0, brakingAgg=1.20, gripMargin=0.95, throttleRamp=0.90, passingAgg=1.20
  - Edge cases: Verify all 8 teams against GDD table values

- **AC-3**: mistakeChance falls with rising performance
  - Given: Macklen tp=1.0, LaytonHall tp=0.08, zero variance
  - When: mistakeChance formula applied
  - Then: Macklen = 0.06 × (1.0 − 1.0 × 0.85) = 0.009; LaytonHall = 0.06 × (1.0 − 0.08 × 0.85) ≈ 0.056
  - Edge cases: teamPerformance=0 (max mistakes = 0.06), teamPerformance=1.0 (min mistakes = 0.009)

- **AC-4**: offsetPreference is fixed per driver, not derived
  - Given: Team performance config loaded
  - When: Parameters computed for same team across 100 different seeds
  - Then: offsetPreference is identical across all runs (not derived from performance or RNG)
  - Edge cases: N/A — static constant test

- **AC-5**: Difficulty multiplier shifts teamPerformance before formulas
  - Given: Macklen tp=1.0 with difficulty multipliers 0.75, 0.875, 1.0, 1.125, 1.25
  - When: Parameters computed for each difficulty
  - Then: Very Easy produces lowest speedMult, Very Hard produces highest; all 5 values are distinct
  - Edge cases: Very Hard LaytonHall (min tp × max multiplier) still produces sensible values

- **AC-6**: Tier variance produces different effective params within bounds
  - Given: Front-runner team (tp ≥ 0.85, variance ±0.02), two different SeededRandom streams
  - When: Parameters computed for each stream
  - Then: The two result sets differ by ≤ 0.04 per parameter (bounded by 2 × variance)
  - Edge cases: All three tier variances tested: ±0.02, ±0.04, ±0.06

- **AC-7**: All 7 cars produce different effective params from same base
  - Given: Same teamPerformance base, 7 different SeededRandom instances (seeds 0–6)
  - When: Parameters computed
  - Then: No two parameter vectors are identical (floating-point comparison with epsilon)
  - Edge cases: Confirm that identical seeds produce identical results (determinism check)

- **AC-8**: Config file exists with all tuning knobs
  - Given: `src/config/ai.ts` exists
  - When: File is read and parsed
  - Then: All 8 teams, 7 formula coefficients, 3 tier thresholds, and all tuning knobs from the GDD Tuning Knobs table are present
  - Edge cases: N/A — static coverage verification

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/ai/team_performance.test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (controller framework — for AIDriverParams type), Foundation SeededRandom
- Unlocks: Story 005 (overtaking — needs passingAggression), Story 006 (mistake model — needs mistakeChance)
