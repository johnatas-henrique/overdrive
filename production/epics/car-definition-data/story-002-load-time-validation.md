# Story 002: Load-Time Validation

> **Epic**: Car Definition Data
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/car-definition-data.md`
**Requirement**: `TR-car-003` (load-time stat validation)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0015: Car Definition Data Validation (§Load-Time Validation)
**ADR Decision Summary**: Stats validated at load (race init): out-of-range → `Mathf.Clamp(value, 0, 20)` with LogWarning; missing/null stat → default 12 (midpoint) + warning; valid integer [0,20] range (the prior "increments of 4" model was RETIRED 2026-08-05); validation runs once at race init, not per tick. Per QL-STORY-READY 2026-08-16: presence-aware input (int? / field-presence) distinguishes a valid `0` from a missing field; injectable diagnostics sink; configurable min/max/default; audio profile validation (cylinders 6-12, pitch 0.8-1.2, exhaust enum, defaults 10/1.0/Standard + warning) may live here.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Mathf.Clamp; ScriptableObject serialization.

**Control Manifest Rules (this layer)**:
- Required: clamp out-of-range to nearest integer in [0,20] with warning; default 12 for missing; once at race init

---

## Acceptance Criteria

*From ADR-0015 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Out-of-range (−5/25) → clamped to 0/20 respectively with a warning emitted
- [ ] Valid boundaries (0 and 20) remain unchanged with no clamp warning
- [ ] Missing/null field → default 12 + warning; explicit `0` remains 0 (presence-aware input distinguishes them)
- [ ] Per-field isolation: corruption/missing in one stat leaves the other five unchanged
- [ ] Validation occurs once per car at race init, never per tick (observable lifecycle seam)
- [ ] Audio profile validation (if owned here): cylinders integer 6-12, pitch 0.8-1.2, exhaust enum Standard/Deep/Sharp; missing profile → defaults 10/1.0/Standard + warning

---

## Implementation Notes

*Derived from ADR-0015 Implementation Guidelines:*

- The presence-aware seam is required: ScriptableObject serialization can leave a field at its default (0) — a valid stat of 0 must not be treated as missing
- Diagnostics go through an injectable sink (testable warnings, not Debug.Log coupling)
- `StatValidationConfig` (min/max/default) comes from `Shared/CarValidationConfig` (ADR-0015 §Configuration Storage)
- Validation frequency: an explicit `ValidateAtRaceInit` seam — the invocation host is a Race/Content integration concern

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 003b]: Addressables integration (16 assets load)
- [vehicle-physics epic]: formula consumption (validated values)
- [race-strategy epic]: corrupted-Efficiency handling (consumes validated results)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (clamp)**: −5 → 0, 25 → 20, warnings emitted
- **AC-2 (valid boundaries)**: 0 and 20 unchanged, no warning
- **AC-3 (missing vs zero)**: absent field → 12 + warning; explicit 0 stays 0
- **AC-4 (per-field isolation)**: one corrupted stat → others unchanged
- **AC-5 (frequency)**: tick-like calls after init → no re-validation
- **AC-6 (audio)**: cylinders 6-12, pitch 0.8-1.2, exhaust enum; missing → 10/1.0/Standard + warning; edge: cylinders outside range, invalid enum

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/car/CarDefinitionValidationTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (schema), Shared/CarValidationConfig
- Unlocks: Story 003b (assets load validated), VP/Fuel/Tire consumers
