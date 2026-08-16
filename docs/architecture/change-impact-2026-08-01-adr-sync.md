# Change Impact — ADR → GDD Synchronization

**Date:** 2026-08-01
**Direction:** ADR→GDD (inverse of the skill's default — 3 new ADRs accepted + 4 modified ADRs)
**Trigger:** architecture-review-2026-08-01.md (PASS)

## Change Summary

This is a reverse-direction propagation: the ADRs changed (not a GDD), so affected GDDs were checked against the new architectural decisions.

| ADR | Change | GDDs affected |
|-----|--------|---------------|
| 0005 | CameraToggle direct route (InputEventQueue removed); brake priority; input sanitization | input-system.md |
| 0006 | efficiency_modifier consumed from ADR-0015 | car-definition-data.md, fuel-system.md |
| 0007 | Lap validation rules (90% min-distance gate) | track-system.md |
| 0010 | VFX/Camera run in LateUpdate (not DynamicUpdate) | camera.md, vfx.md |
| 0013 | Qualifying spawn: pit box + out-lap (new, Accepted) | qualifying.md, simulation-architecture.md |
| 0014 | HUD data contract: 8 chase elements + Ghost 9th (new, Accepted) | hud.md, settings.md |
| 0015 | Car stat validation + differentiation (new, Accepted) | car-definition-data.md |

## Impact Analysis

### Already Consistent (no action)

| ADR | GDD | Evidence |
|-----|-----|----------|
| 0005 CameraToggle direct | input-system.md | GDD used direct route since 26/07 review |
| 0005 brake priority | input-system.md | GDD lines 152-153, 220 |
| 0006→0015 efficiency_modifier | car-definition-data.md | GDD line 272 formula defined |
| 0007 90% lap gate | track-system.md | GDD line 100 (RSM owns, Track provides helper) |
| 0010 LateUpdate | camera.md | GDD lines 65/162/262 |
| 0012 LateUpdate | audio-system.md | ADR-0012 lines 26/29/42/65/84 already LateUpdate |
| 0014 8 elements | hud.md, settings.md | Synced in design-review (DR-1, 12 corrections) |
| 0013 spawn model | qualifying.md, simulation-architecture.md | Synced in architecture-review Phase 5b (A2) |
| 0015 validation | car-definition-data.md | ADR documents new validation; GDD data fields unchanged |

### Updated in This Propagation (2)

| # | ADR change | GDD | Action |
|---|-----------|-----|--------|
| P1 | ADR-0005:140 input sanitization (NaN/Inf → 0.0f, clamp ±1 after dead zone, before EMA) | input-system.md | Added sanitization step to EMA pipeline (line ~150). Clarified edge case 242: GDD's "clamp to last valid output" covers EMA-internal NaN; ADR's "0.0f" covers raw-input NaN. Two defense layers, not a conflict. |
| P2 | ADR-0010 LateUpdate consumption | vfx.md | AC at line 249 now references LateUpdate + interpolated VisualTransform per ADR-0010. |

### Superseded

None.

## Resolution Decisions

- **P1** resolved as complementary layers (documented in GDD edge case), not a contradiction
- **P2** resolved by explicit cross-reference
- No ADR marked Superseded
- No GDD remains Needs Review from this propagation

## ADRs Written or Updated in This Cycle

None (all 15 ADRs Accepted; no new ADRs needed for this propagation).

## Follow-Up

- architecture-review verified full coherence post-corrections (PASS, 2026-08-01)
- Next: /architecture-decision only if a new decision emerges; none pending from this propagation
