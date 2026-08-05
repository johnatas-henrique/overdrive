# Change Impact Report — Vehicle Physics & Car Stats

**Date:** 2026-08-05
**GDDs revised:** vehicle-physics.md, car-definition-data.md, ai-rival.md, vfx.md, camera.md, track-system.md, game-concept.md
**Skill:** /propagate-design-change
**Verdict:** COMPLETE — all ADRs validated, 4 documentation drifts fixed, traceability index updated.

## 1. Change Summary

Source: race-feel prototype validation (2026-08-03/04). Prototype values are the
source of truth for production implementation (see `prototypes/race-feel/REPORT.md`
— CD verdict: CONCERNS, PROCEED).

| GDD | Change |
|-----|--------|
| vehicle-physics.md | Grip stack: `control_threshold` REMOVED (stability = slip-only). Steering: 1-state model. Lift-off: fixed +3.0g in both consumers. Drift: track-radius-activated factor (F=1.15, headBoost 1.40). Acceleration: `min(enginePower, P/m ÷ v) − K·v²` |
| car-definition-data.md | Stats re-scaled to real 1989 F1: TS linear 310-338 (4-20), AC = 0-280 time, GR = % of vmax (global high/low), ST = slip-only |
| ai-rival.md, vfx.md | Top speed 310 → 340 km/h propagated |
| camera.md | Chase rotation follows velocity direction (drift visible), not heading |
| track-system.md | Suzuka added as canonical validation-reference track |
| game-concept.md | Team design intents documented (Dallara gem, Brabham trap, Benetton accessibility) |

## 2. Impact Analysis

ADRs referencing the changed GDDs: ADR-0002, 0003, 0006, 0007, 0009, 0010, 0011, 0012, 0015.

All 8 verified **Still Valid** (technical-director gate, file:line evidence):

- **ADR-0002** — Already updated (commit 9225669): control_threshold removed from stack (line 48), 1-state model (line 53), lift-off +3.0g (line 54), GripMath 3-param signature (lines 126-136). Consistent line-by-line.
- **ADR-0006** — Mechanism-level only (Step 5a/5b position); no grip stack formula embedded (lines 33, 143).
- **ADR-0007** — Surface multiplier table is a mechanism; values are data (line 95; track-system.md:81-89).
- **ADR-0009** — AI uses same VP ("does not have special physics", line 35); ai-rival.md:51,134,288-289 consume 340 km/h correctly.
- **ADR-0010** — Already updated: look-ahead `velocityDirection × speed × lookAheadFactor` (line 130).
- **ADR-0011** — References VP only in GDD Requirements Addressed (line 198); no formula dependency.
- **ADR-0012** — CarAudioProfile schema (lines 82-91) unaffected by stats.
- **ADR-0015** — "values are tuning knobs — defined in data" (line 60); the re-scaling is exactly the case the ADR anticipated.

Cascading systems verified unaffected: fuel-system, tire-system, settings (offtrack
grip tables match), hud (reads post-physics CarState), grid-start (Perfect Start
multiplier applies to any force model), qualifying, race-session-manager
(pace-only MVP resolution).

## 3. Director Gate — CONCERNS (4 documentation drifts, fixed)

The technical-director verified all classifications correct but flagged 4 stale
grip-stack descriptions. All applied:

1. `architecture.md:155` — "× stability" dropped from the effective_grip description
2. `architecture.md:191` — clarified "control_threshold slip-only (NOT in effective_grip stack)"
3. `control-manifest.md:89` — "4 multipliers (tire, surface, speed, aggression)" → "3 multipliers (grip_base, surface_grip_multiplier, tire_runtime_grip_multiplier)"
4. `vehicle-physics.md:290` — Edge Cases formula: `× control_threshold` removed (internal inconsistency vs. line 234)

## 4. Resolution

- **ADRs marked Superseded:** none
- **ADRs updated in place:** none this pass (ADR-0002, ADR-0010 already updated in session commits)
- **Traceability:** `architecture-traceability-matrix.md` renamed to `architecture-traceability.md` (the framework-convention name used by /propagate-design-change, /adopt, /gate-check); Superseded Requirements table added with 8 entries
- **Follow-up:** re-run /architecture-review when all post-prototype ADR updates land (recommended by the gate)

## 5. Files Changed

- `docs/architecture/architecture.md` (2 edits)
- `docs/architecture/control-manifest.md` (1 edit)
- `docs/architecture/architecture-traceability-matrix.md` → `architecture-traceability.md` (rename)
- `docs/architecture/architecture-traceability.md` (Superseded table)
- `docs/architecture/complete-traceability-matrix.md` (reference fix)
- `STRUCTURE.md` (reference fix)
- `design/gdd/vehicle-physics.md` (Edge Cases fix)
- This report
