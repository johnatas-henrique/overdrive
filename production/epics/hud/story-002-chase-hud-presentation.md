# Story 002: Chase HUD Presentation

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Core + Presentation
> **Type**: UI
> **Manifest Version**: 2026-08-05
> **Estimate**: 2.0h

## Context

**GDD**: `design/gdd/hud.md`
**Requirement**: `TR-hud-001` (8 chase elements), `TR-hud-002` (0.5s readability), `TR-hud-003` (team theming)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0014: HUD Data Contract and Layout
**ADR Decision Summary**: Race/chase context renders exactly eight persistent elements (Speed+Gear, Position, Lap, Fuel Bar, Tire %, Lap Time, Rival Gap, Track Map). Fuel 30% yellow (25-50%), 20% red+pulse; tire 40% remaining yellow; rival gap "+0.4s"/"LEADER"; team color accents with low-contrast outline fallback (state colors override team color); readable <0.5s at 200+ km/h; ≤0.5ms/frame profiled in 16-car rig.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: uGUI Canvas; readability/performance measured in the dev rig.

**Control Manifest Rules (this layer)**:
- Required: 8 chase elements; fuel/tire thresholds; team theming with contrast fallback
- Required: 0.5s readability + ≤0.5ms budget (measured)

---

## Acceptance Criteria

*From hud.md + ADR-0014, scoped per QL-STORY-READY 2026-08-16 (001B split — presentation):*

- [ ] Race/chase context renders exactly eight persistent elements with the required formats
- [ ] Fuel 30% renders yellow (25-50% threshold); 20% renders red and pulses (boundaries documented: 25% and 50% yellow)
- [ ] Tire remaining 40% renders yellow (25-50% threshold)
- [ ] Rival gap 0.4s renders "+0.4s"; leader/no rival renders "LEADER"
- [ ] Madonna and ZeroForce use team accents; low contrast adds the approved white/black outline fallback; fuel/tire state colors override team color
- [ ] At 200+ km/h each required information group is readable within 0.5s under the approved UX layout
- [ ] Representative 16-car profiling records HUD cost ≤0.5ms/frame (ADR-0014 budget)

---

## Implementation Notes

*Derived from ADR-0014 Implementation Guidelines:*

- Binds to the Story 001 view model — no direct simulation access
- Fuel thresholds: yellow 25-50%, red+pulse <25%; tire: yellow 25-50% remaining
- Team colors from Car Definition (opaque, auto-contrast fallback); state colors (fuel/tire) override
- Readability evidence: timed glance test + profiler capture in the dev rig

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 001]: binding contract (consumed)
- [Story 003]: contextual overlays (pit service, banners)
- [race-strategy]: fuel/tire production

---

## QA Test Cases

*Written by qa-lead at story creation (manual — UI):*

- **AC-8ELEMENTS**: race/chase with representative snapshot → exactly 8 persistent elements, correct formats (1080p screenshot)
- **AC-FUEL**: 30% → yellow; 20% → red+pulse
- **AC-TIRE**: 40% remaining → yellow
- **AC-RIVAL**: 0.4s → "+0.4s"; leader → "LEADER"
- **AC-THEME**: Madonna/ZeroForce + low-contrast background → correct accents + outline fallback; state colors authoritative
- **AC-READ**: 16-car rig at 200+ km/h → readable within 0.5s
- **AC-BUDGET**: profiler → HUD ≤0.5ms/frame

---

## Test Evidence

**Story Type**: UI
**Required evidence**:
- UI: `production/qa/evidence/hud-chase-evidence.md` + screenshots
- Readability/performance: profiler capture + timed glance test in rig

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (view model), car-definition (team colors), vehicle-physics-feel (rig)
- Unlocks: Story 003 (overlays compose with the 8 elements)
