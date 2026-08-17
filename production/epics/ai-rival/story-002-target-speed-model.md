# Story 002: Target-Speed Model

> **Epic**: AI Rival
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/ai-rival.md`
**Requirement**: `TR-ai-005` (target speed)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0009: AI Rival Deterministic Architecture (§Target-Speed Model, TR-ai-005 ratified)
**ADR Decision Summary**: `target_speed = base_speed × state_modifier × personality_modifier × pace_noise × error_noise`, applied = `min(target_speed, vmax, cornerSpeedFromRacingLine(curvatureAhead), trafficSpeed(carAhead))`. Difficulty is an explicit input: `pace_noise = 1 ± DifficultyProfile.pace_noise`; `error_noise = 1 + base_error_noise × DifficultyProfile.ai_error_multiplier`. The min-order never boosts the AI above the GDD product. Neutral Tier 1 ≈ 340 km/h before clamps; Tier 4 TS8 ≈ 316 km/h.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure C# — consumes scalar inputs via seams (Settings/CarDefinition/Track lookups are external).

**Control Manifest Rules (this layer)**:
- Required: target_speed formula with difficulty as explicit input; applied = min(product, caps) — caps never increase the product
- Required: no AI-only physics — same car stats and grip formulas as the player

---

## Acceptance Criteria

*From ADR-0009 + GDD, scoped per QL-STORY-READY 2026-08-16 (split of target-speed from error application):*

- [ ] The model accepts scalar inputs (baseSpeed, state modifier, personality modifier, pace noise, error noise, vmax, corner-speed cap, traffic-speed cap) — it does NOT read Settings/CarDefinition/Track directly
- [ ] Calculates `base × state × personality × paceNoise × errorNoise`
- [ ] Applied speed = min(product, all physical/traffic caps) — caps never increase the product
- [ ] Fixture values: neutral Tier 1 → 340 km/h within a declared numeric tolerance (e.g. ±1 km/h); neutral TS8 → 316 km/h within tolerance
- [ ] Difficulty-derived values consumed through explicit inputs, not fetched globally

---

## Implementation Notes

*Derived from ADR-0009 Implementation Guidelines:*

- `base_speed` = the car's max velocity from Car Definition (Top Speed formula 300 + TS×2) — the same vmax the player's car uses; difficulty does not multiply it
- `state_modifier` (0.7-1.1) depends on the AI's current state; `personality_modifier` (0.95-1.05) per archetype
- `pace_noise` (0.92-1.08) and `error_noise` (0.97-1.03) are deterministic per-tick draws (counter-based, slot-ordered — Story 001)
- The min-order clamps to physical limits: vmax, corner capacity from the racing-line curvature ahead (same grip physics as the player), traffic/defensive adjustments

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 003]: error application (throttle/brake/steering) + line correction — separate seams
- [Track epic]: racing-line curvature provider (seam consumed here)
- [car-definition-data epic]: stat → max_velocity derivation

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (formula)**: scalar inputs → product computed correctly
- **AC-2 (caps)**: each individual cap below the product wins; all caps above the product leave it unchanged
- **AC-3 (fixtures)**: neutral Tier 1 → 340 km/h within declared tolerance; neutral TS8 → 316 km/h within tolerance
- **AC-4 (difficulty inputs)**: values passed explicitly; no Settings/Track/CarDefinition lookup; edge: pace/error noise at bounds

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/simulation/AiRivalTests.cs` — target-speed product, cap min-order, fixture tolerance

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (noise draws), car-definition-data (vmax seam), Track (curvature seam)
- Unlocks: Story 003 (error application on top of target speed)
