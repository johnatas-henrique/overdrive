# Story 007: Qualifying Rules — Fuel, Tire, AI Times, Skip

> **Epic**: Race Flow
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 2.0h

## Context

**GDD**: `design/gdd/qualifying.md`
**Requirement**: `TR-qual-002` (fuel load), `TR-qual-003` (no tire wear), `TR-qual-005` (skip/fail → P16 + DNQ), `TR-qual-006` (tier order not preserved)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0013: Qualifying Session Format (§AI Qualifying Times, §Tier Order, §Grid Position Calculation)
**ADR Decision Summary**: Fuel load = `min(8.0L, fuel_rate × reference_flying_lap_time × 1.10)` (fuel_rate and reference from Fuel/Track seams). Tire wear disabled for the session (Qualifying emits the no-wear policy; Tire implements). AI times deterministic via the ADR-0013 formula with PCG32 draws (ADR-0009 owns the counter-based keying; ADR-0013 owns the formula): `ai_time = reference × tier_modifier × (1 + precision_penalty + error_penalty + pace_variation)`. Skip/fail → no time, DNQ label, P16 candidate — RSM creates the final GridAssignment. Tier order NOT preserved (deterministic imprecision may cross tiers).

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C#. PCG32 draw values injected (ADR-0009 keying — not re-tested here).

**Control Manifest Rules (this layer)**:
- Required: fuel `min(8.0L, rate × reference × 1.10)`; no tire wear; single flying lap
- Required: skip/fail → P16 + DNQ; tier order not preserved; ties by stable carId

---

## Acceptance Criteria

*From ADR-0013 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Given `fuel_rate` and `reference_flying_lap_time` as input seams → Qualifying computes `min(8.0L, fuel_rate × reference × 1.10)` (Fuel's rate production and actual consumption are external)
- [ ] Qualifying publishes the qualifying-mode no-wear policy contract (Tire's actual 100% grip/zero wear tested by Tire)
- [ ] AI time generator applies the ADR-0013 formula with **injected deterministic PCG32 draw values**: exact-value test — Easy profile precision 0.95, error multiplier 1.2, PCG sample 0.5, pace variation −0.02, Tier 1, 75s reference → **77.475s ±0.001**; tier_modifier T1 1.00 / T2 1.015 / T3 1.035 / T4 1.055 (PCG32 internals not re-tested)
- [ ] Skip/failed → Qualifying emits `Skipped/Failed`, no time, `DNQ`, P16 candidate (RSM creates the final P16 GridAssignment — Story 003)
- [ ] Tier order NOT artificially sorted — generated AI times preserved (lower tier may outqualify higher tier)

---

## Implementation Notes

*Derived from ADR-0013 Implementation Guidelines:*

- `precision_penalty = 1 − profile.ai_precision`; `error_penalty = PCG32Float01 × 0.005 × profile.ai_error_multiplier`; `pace_variation = PCG32Range(−profile.pace_noise, +profile.pace_noise)`
- The generator consumes DifficultyProfile fields + deterministic draws via seams — the ADR-0009 counter-based keying (`PCG32Hash(SimSeed, carId, step, slot)`) supplies the draw values; this story does not re-implement PCG32
- The no-wear policy and the fuel load are POLICY outputs (consumed by Fuel/Tire) — not direct state writes
- Slow completion records the actual time (not DNQ); DNQ is only skip/fail

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 003]: final GridAssignment creation (RSM)
- [race-strategy epic]: fuel/tire implementations
- [ADR-0009 / ai-rival epic]: PCG32 counter-based generation internals

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (fuel formula)**: injected rate + reference → `min(8.0, rate × reference × 1.10)`; edge: below and above the 8.0L cap
- **AC-2 (AI formula exact)**: Easy/Tier1/75s/error 0.5/pace −0.02 → 77.475s ±0.001; edge: all four tiers, zero noise, positive/negative pace variation, identical seed repeatability
- **AC-3 (skip/fail)**: skip or failed lap → no time, DNQ, P16 candidate, no retry; edge: slow completed lap records a time (not DNQ)
- **AC-4 (tier order)**: generated times preserved; lower-tier outqualification allowed; edge: equal times → stable carId (upstream)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/simulation/QualifyingTests.cs` — fuel formula, AI formula exact-value, skip/fail, tier order

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Fuel/Track seams (fuel_rate, reference), ADR-0009 draws (injected)
- Unlocks: Story 003 (GridAssignment from times), ui-menu (Qualifying Results)
