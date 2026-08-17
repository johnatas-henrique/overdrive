# Story 001: CarDefinition Data Model & Stat Formulas

> **Epic**: Car Definition Data
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/car-definition-data.md`
**Requirement**: `TR-car-001` (16 teams, 6 stats, 505 kg), `TR-car-002` (stat-to-behavior formulas)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0015: Car Definition Data Validation (§ScriptableObject Schema, §Stat Ownership)
**ADR Decision Summary**: CarDefinition ScriptableObject { teamId `team_tier{1-4}_{a-d}` (ParseTier throws on malformed), CarStats 6 integer stats [0,20], CarAudioProfile, teamColor, cockpitOffset }. Read-only accessors; weight 505 kg is a GLOBAL VP constant (not per-car content). Stat-to-behavior formulas are TUNING KNOBS (owned by ADR-0015 formula / ADR-0002 physics consumption): max_velocity 300 + TS×2, brake_distance, grip % (gripLow 50 → gripHigh 90 of vmax), control_threshold (0.2-1.0, slip-only), efficiency_modifier (1 − stat × 0.025). The exact `t300` physics values (11.38s/8.58s) are Vehicle Physics-owned — NOT this story (per QL-STORY-READY 2026-08-16).

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: ScriptableObjects stable; Mathf/Unity.Mathematics for clamps.

**Control Manifest Rules (this layer)**:
- Required: stat ownership (TS/Accel/Brake/Grip/Stability → VP; Efficiency → Fuel/Tire shared; Weight 505 global)
- Required: formulas are tuning knobs consumed as data — not fixed architecture contracts

---

## Acceptance Criteria

*From ADR-0015 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] `CarDefinition`, `CarStats`, and read-only accessors (TeamId/Tier/Stats/AudioProfile/TeamColor/CockpitOffset) with strict TeamId parsing (malformed → InvalidOperationException)
- [ ] Six integer stats [0,20]; weight resolves to the global VP constant 505 kg (not duplicated per-car)
- [ ] Pure configurable formula evaluator tests (numeric fixtures — consumers are external):
  - `max_velocity`: TS 4 → 308 ±0.1; TS 20 → 340 (identical at every difficulty)
  - `brake_distance`: Brake 4 → 70 ±0.1; Brake 20 → 30
  - grip %: Grip 4 → 58% of supplied vmax; Grip 20 → 90%
  - `control_threshold`: Stability 4 → 0.2 ±0.001; Stability 20 → 1.0 (slip-only)
  - `efficiency_modifier`: Efficiency 4 → 0.90 ±0.001; Efficiency 20 → 0.50 ±0.001
- [ ] Difficulty invariance: identical stats + different difficulty profiles → identical formula results
- [ ] Boundary tests: stats 0 and 20 (low-stat Stability/Efficiency behavior follows the resolved design — no stale "min 4" clamp)

---

## Implementation Notes

*Derived from ADR-0015 Implementation Guidelines:*

- The `t300` metric (Zakspeed 11.38s, McLaren 8.58s) is Vehicle Physics-owned — moved out per the gate; if a reference table is needed here, define an owned deterministic seam
- The formulas are tuning knobs — the evaluator consumes configuration, never hardcodes
- Grip % uses the car's OWN vmax (per-car) — `grip % of vmax`
- Weight 505 kg is the global VP constant — CarDefinition exposes it by reference, not per-asset duplication

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [vehicle-physics epic]: t300 physics values, formula consumption
- [race-strategy epic]: efficiency_modifier consumption (Fuel/Tire)
- [audio epic]: CarAudioProfile playback/consumption

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (team ID parsing)**: valid `team_tier{1-4}_{a-d}` → Tier 1-4; edge: null/empty/wrong tier/wrong suffix/wrong case/extra chars → InvalidOperationException
- **AC-2 (schema accessors)**: exactly 6 stats, no public mutation path; weight = 505
- **AC-3 (formula fixtures)**: all exact values above (308/340, 70/30, 58%/90%, 0.2/1.0, 0.90/0.50)
- **AC-4 (difficulty invariance)**: identical stats, different profiles → identical results
- **AC-5 (boundaries)**: stats 0 and 20; low-stat behavior per resolved design

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/car/CarDefinitionFormulaTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Content pipeline (Cars/{teamId} groups), ADR-0002 (stat consumption contract)
- Unlocks: VP (stats), race-strategy (efficiency), audio (profile), ai-rival (vmax)
