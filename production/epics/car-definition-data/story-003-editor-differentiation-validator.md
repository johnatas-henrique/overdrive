# Story 003: Editor Differentiation Validator

> **Epic**: Car Definition Data
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/car-definition-data.md`
**Requirement**: `TR-car-004` (authoring-time differentiation)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0015: Car Definition Data Validation (§Authoring-Time Differentiation Check)
**ADR Decision Summary**: Editor-time check — Euclidean distance over 6 stats; configurable threshold (e.g. 1.0 stat point) + scope (withinTierOnly e.g. true); warns when `distance < minimumRequiredDifference` (insufficient spread is the defect — no duplicate profiles like 12/12/12/12/12/12); warning is NON-blocking (designer decides). Pure validator + editor adapter seam (per QL-STORY-READY 2026-08-16).

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Editor-only tooling; pure validator testable via EditMode.

**Control Manifest Rules (this layer)**:
- Required: differentiation check (Euclidean over 6 stats, configurable threshold/within-tier, warning-not-block)
- Required: editor adapter invokes the validator through a testable seam

---

## Acceptance Criteria

*From ADR-0015 + GDD, scoped per QL-STORY-READY 2026-08-16 (split from the original Story 003):*

- [ ] Pure validator accepts a car collection + `DifferentiationConfig` (minimumRequiredDifference, withinTierOnly)
- [ ] Euclidean distance over the six stats; warning when `distance < threshold`; warning is non-blocking (no throw)
- [ ] Distance exactly at threshold → no warning; above → no warning
- [ ] `withinTierOnly = true` ignores cross-tier pairs; `false` evaluates them
- [ ] Custom threshold changes the result predictably
- [ ] Editor adapter invokes the validator against an injected asset collection (testable seam)

---

## Implementation Notes

*Derived from ADR-0015 Implementation Guidelines:*

- Warning condition is INSUFFICIENT spread (`distance < minimumRequiredDifference`), not excess spread — duplicate/near-duplicate profiles are the defect (2026-08-05 correction)
- Config stored in `Shared/CarValidationConfig` (differentiationThreshold, withinTierOnly)
- The editor adapter (AssetPostprocessor/menu item) calls the pure validator; tests exercise the validator + the seam

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 004]: 16-asset authoring + Addressables
- [Story 002]: load-time clamping (differentiation is editor-time only)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (duplicate profiles)**: identical same-tier profiles → warning, no throw, non-blocking
- **AC-2 (near-duplicate)**: distance below threshold → warning
- **AC-3 (threshold boundary)**: distance exactly at threshold → no warning
- **AC-4 (above threshold)**: distance above → no warning
- **AC-5 (scope)**: withinTierOnly true ignores cross-tier; false evaluates
- **AC-6 (config)**: custom threshold changes the result predictably
- **AC-7 (adapter seam)**: editor adapter validates an injected asset collection

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Editor: `Assets/tests/editor/car/CarDifferentiationEditorTests.cs`
- Logic companion: `Assets/tests/unit/car/CarDefinitionValidationTests.cs`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (schema), Shared/CarValidationConfig
- Unlocks: Story 004 (assets authored against the check)
