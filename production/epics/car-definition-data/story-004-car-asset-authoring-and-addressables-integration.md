# Story 004: Car Asset Authoring & Addressables Integration

> **Epic**: Car Definition Data
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/car-definition-data.md`
**Requirement**: `TR-car-005` (CarDefinition stores stats, audio profile, team color, cockpit offset)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0015: Car Definition Data Validation (§File Organization, §Configuration Storage)
**ADR Decision Summary**: One ScriptableObject per team via `Cars/{teamId}`; runtime root addresses `Cars/{teamId}/CarDefinition`; shared config via `Shared/CarValidationConfig`. Read-only accessors; opaque teamColor (alpha = 1); cockpitOffset round-trips. Per QL-STORY-READY 2026-08-16: tier-average acceptance bands defined numerically (current data: T1 ~17.0, T2 ~14.5, T3 ~10.83, T4 ~8.88 — the GDD's "~4.5 T1→T2" gap does not match actual data (~2.5); define measurable bands or update the data — the T2/T3/T4 values in the current authoritative table are to be reconciled at authoring time).

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Addressables via shipped content seams; ScriptableObject assets.

**Control Manifest Rules (this layer)**:
- Required: exactly 16 IDs/assets; six stats [0,20] with exact registry values; no duplicate profiles
- Required: audio profile 6-12 cylinders, pitch 0.8-1.2, exhaust enum; defaults 10/1.0/Standard

---

## Acceptance Criteria

*From ADR-0015 + GDD, scoped per QL-STORY-READY 2026-08-16 (split from the original Story 003):*

- [ ] Exactly 16 car assets (`team_tier1_a` … `team_tier4_d`) load via `Cars/{teamId}/CarDefinition` addresses; each `TeamId` matches its address
- [ ] Six stats per asset, all integer [0,20], exact registry values (entities.yaml 2026-08-04); weight 505 via the global constant
- [ ] No duplicate six-stat profiles across the 16 (differentiation verified against the authoring check — known duplicates team_tier3_b/3_d/4_b resolved at authoring time per gate)
- [ ] Opaque TeamColor (alpha = 1); CockpitOffset round-trips; audio profile validated (cylinders 6-12, pitch 0.8-1.2, exhaust enum; defaults 10/1.0/Standard)
- [ ] Tier averages verified against explicitly defined numeric acceptance bands (data-vs-GDD discrepancy resolved: measure or update)
- [ ] `Shared/CarValidationConfig` loads; missing/corrupt fixture asset produces the expected validation diagnostics

---

## Implementation Notes

*Derived from ADR-0015 Implementation Guidelines:*

- The GDD's tier-average spread text ("~4.5 T1→T2") conflicts with actual data (T1 17.0 → T2 14.5 ≈ 2.5) — the gate requires a measurable tolerance or updated data; the authoring pass reconciles this (documented decision at authoring)
- Known duplicate profiles (team_tier3_b, team_tier3_d, team_tier4_b) must be corrected during authoring
- Addressable root addresses `Cars/{teamId}/CarDefinition` (ADR-0003 topology)
- `CarAudioProfile` fields per ADR-0012 (engineCylinders 6-12 per current contract — the ADR text still says 8/10/12 in places; the current contract governs)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 003]: differentiation validator (consumed at authoring)
- [vehicle-physics epic]: formula consumption
- [audio epic]: profile playback

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (16 assets)**: all `Cars/{teamId}/CarDefinition` load; TeamId matches address
- **AC-2 (stats)**: six ints [0,20], exact registry values, weight 505
- **AC-3 (no duplicates)**: no duplicate six-stat profiles
- **AC-4 (accessors)**: teamColor opaque, cockpitOffset round-trips
- **AC-5 (config)**: `Shared/CarValidationConfig` loads
- **AC-6 (tier bands)**: all four tier averages within defined numeric bands
- **AC-7 (corrupt fixture)**: missing/corrupt asset → expected validation diagnostics

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/car/CarDefinitionAddressablesTests.cs`
- Authoring evidence: differentiation report at authoring time

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Stories 001-003 (schema/validation/differentiation), Content pipeline (Cars groups)
- Unlocks: VP, Fuel/Tire, Audio, AI (consume the 16 definitions)
