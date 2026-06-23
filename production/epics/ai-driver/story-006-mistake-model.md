# Story 006: Mistake Model

> **Epic**: AI Driver
> **Status**: Ready
> **Layer**: Core B
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/ai-driver.md`
**Requirement**: `TR-AI-003`

- TR-AI-003: SeededRandom per AI car for parametrisation: cornerSpeedBias, aggression, brakingPointVariance — deterministic from same seed.

**ADR Governing Implementation**: ADR-0013: AI Driver Architecture
**ADR Decision Summary**: Per-tick mistake roll using each car's SeededRandom. On mistake: steer perturbation (amplitude `mistakeMag`) and throttle lift (50% max reduction). mistakeMag is a shared config constant (not per-AI). Only frequency varies by team via mistakeChance.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript — zero engine imports. Deterministic RNG ensures reproducible mistake patterns for same seed.

**Control Manifest Rules (this layer)**:

- Required: C41 (deterministic via SeededRandom — mistakes come from the per-car RNG, same seed → same pattern)
- Required: C46 (AIDriverParams open set — mistakeChance is an MVP parameter; mistakePattern may be added in Alpha)

---

## Acceptance Criteria

_From GDD `design/gdd/ai-driver.md`, scoped to this story:_

- [ ] Per-tick mistake roll: `seededRandom.next() < params.mistakeChance` determines if a mistake occurs
- [ ] On mistake — steer: `steer += seededRandom.next() × config.mistakeMag`, result clamped to [-1, 1]
- [ ] On mistake — throttle: `throttle ×= (1.0 − seededRandom.next() × 0.5)` (random throttle lift, up to 50%)
- [ ] `mistakeMag` is a shared config constant (`ai.mistakeMag`, default 0.15) — NOT per-AI; only frequency varies
- [ ] `mistakeChance = 0.05` produces measurably more errors than `mistakeChance = 0.0` over 10,000 ticks
- [ ] Mistakes are deterministic: same seed + same config → same mistake pattern across runs

---

## Implementation Notes

_Derived from ADR-0013 Implementation Guidelines:_

1. **Mistake model code** (from ADR-0013):

   ```typescript
   if (seededRandom.next() < params.mistakeChance) {
     steer += seededRandom.next() * config.mistakeMag; // from ai.mistakeMag
     throttle *= 1.0 - seededRandom.next() * 0.5; // random throttle lift
   }
   ```

2. **mistakeMag constant**: Same for all AIs. Only `mistakeChance` varies by team (0.009 for Macklen, 0.056 for Layton Hall). mistakeMag (default 0.15) determines how big a mistake is when it happens.

3. **Steer clamping**: After applying the mistake perturbation, steer is clamped to [-1, 1]. If the AI was already at full steer and the perturbation pushes it further, it stays at ±1.

4. **Throttle lift**: The `(1.0 - RNG × 0.5)` multiplier means the throttle is reduced by 0% to 50%. An AI at full throttle (1.0) may drop to 0.5 at worst. An AI already coasting stays at 0.

5. **No mistake decay**: The mistake model does not accumulate or compound — each tick is independent. The "spiral of errors" risk is intentionally absent per ADR (the PID controller naturally recovers within one corner as tested in Story 002 AC-6).

6. **Multiple mistakes per tick**: If `mistakeChance` were high enough, multiple mistakes could theoretically roll in the same tick (since the RNG check is per-tick, not per-action). At MVP values (max 0.056 for Layton Hall), this is statistically negligible (~0.3% chance of double mistake).

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 004: Team performance (provides mistakeChance per car at init)
- Story 002: Spline following (the PID controller handles recovery from mistakes)
- Alpha: mistakePattern parameter (different mistake types), pressureTolerance (mistakes increase under pressure)

---

## QA Test Cases

- **AC-1**: Mistake roll triggers exactly when seededRandom.next() < mistakeChance
  - Given: A SeededRandom with known sequence, mistakeChance=0.05
  - When: 10,000 ticks are run with a fixed RNG seed
  - Then: The exact set of tick indices where mistakes fire is deterministic and matches the RNG threshold test
  - Edge cases: mistakeChance=0.0 (never triggers), mistakeChance=1.0 (always triggers)

- **AC-2**: Steer error applied correctly on mistake
  - Given: A mistake is triggered, current steer=0.3, seededRandom returns 0.5, mistakeMag=0.15
  - When: Mistake is applied
  - Then: steer = clamp(0.3 + 0.5 × 0.15, -1, 1) = 0.375
  - Edge cases: steer already at 0.99 + positive error → clamped to 1.0; steer at -0.99 + negative error → clamped to -1.0

- **AC-3**: Throttle lift applied correctly on mistake
  - Given: A mistake is triggered, current throttle=1.0, seededRandom returns 0.4
  - When: Mistake is applied
  - Then: throttle = 1.0 × (1.0 − 0.4 × 0.5) = 1.0 × 0.8 = 0.8
  - Edge cases: throttle already at 0.0 (multiply remains 0), seededRandom returns 1.0 (max reduction 50%, throttle ×= 0.5)

- **AC-4**: mistakeMag is shared config constant
  - Given: ai.mistakeMag config value
  - When: Read config and check
  - Then: mistakeMag = 0.15 (default), identical across all AI controllers
  - Edge cases: Config override changes all AIs uniformly; AIMistakeConfig structure is a single number

- **AC-5**: mistakeChance=0.05 produces more errors than 0.0 over 10,000 ticks
  - Given: Two AI controllers, same RNG seed, mistakeChance=0.0 vs 0.05
  - When: 10,000 ticks simulated
  - Then: mistakeChance=0.0 produces exactly 0 mistakes; mistakeChance=0.05 produces > 0 mistakes
  - Edge cases: Different RNG seeds should not affect the 0.0 case (always zero)

- **AC-6**: Deterministic — same seed, same mistake pattern
  - Given: Same AI controller config, same seed
  - When: Two separate 10,000-tick runs
  - Then: Both runs produce identical mistake timestamps and magnitudes (bit-exact or epsilon)
  - Edge cases: Different seed produces different pattern (stochasticity verified)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/ai/mistake_model_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (controller framework for AIController), Story 004 (team performance for mistakeChance param)
- Unlocks: None (terminal story in the AI pipeline — runs after FSM, outputs to InputState)
