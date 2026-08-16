# Review Log: Fuel System — Overdrive

## Lean Review — 2026-07-24 — Verdict: NEEDS REVISION

Scope signal: M

Review boundary: MVP tank, throttle-proportional consumption, fuel states, local pit refueling, HUD/UI contracts, and the shared formula registry. Difficulty-dependent resource rules were excluded because the approved design separates difficulty from Fuel behavior.

Specialists: none — lean mode.

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 3

Summary: Fresh lean re-review confirmed all prior findings were resolved. Cross-GDD consistency check found 3 RECOMMENDED issues: Fuel bar color boundary at 25% (Fuel System vs HUD), numeric readout missing from HUD spec, and Ghost Recording contract claiming fuel is recorded per tick when it's actually derived from replay. All issues were corrected.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found display and recording contract gaps.

Blocking items: 5 | Recommended: 4
Prior verdict resolved: First review.

### Findings

| Finding | Severity | Resolution |
|---|---|---|
| Fuel formula still used `difficulty_modifier` | Blocking | Removed the difficulty modifier. MVP Fuel now uses base rate × throttle × efficiency only; difficulty affects AI competence, not Fuel rules. |
| Vehicle Physics and the formula registry used the obsolete Fuel formula | Blocking | Propagated the corrected formula to Vehicle Physics and `design/registry/entities.yaml`. |
| Time-to-empty tables and ACs depended on Hard/Very Easy fuel modifiers | Blocking | Recomputed the tables and ACs using 0.018 L/s as the worst-efficiency full-throttle rate. |
| Pit Stop appeared twice in the interaction table | Blocking | Consolidated refueling and player-advisory ownership into one contract. |
| Pre-race fuel comparison lacked a UI consumer dependency | Blocking | Added UI Menu as the consumer for the pre-race comparison. |
| Open Questions contradicted approved pit/AI/warning decisions | Recommended | Resolved physical pit entry, Confirm exit, hidden AI fuel, multiple entries, and the 25% critical warning threshold. |
| Settings was listed as a runtime Fuel dependency despite Fuel ignoring difficulty | Recommended | Removed the Settings dependency; difficulty is setup data, not a Fuel input. |
| Registry revision date was stale | Recommended | Updated the registry revision date to 2026-07-24. |
| Tire still contains its own old difficulty modifier | Deferred | Forwarded to Tire System review; Tire owns its wear formula and will receive the same difficulty-boundary decision in its review. |

### MVP Contracts Confirmed

- Fuel capacity is 8.0 L for every car and difficulty.
- Fuel rate is `0.02 L/s × throttle_input × efficiency_modifier`.
- Difficulty does not modify Fuel consumption or thresholds.
- Fuel owns `last_lap_fuel_use`; Pit Stop and AI consume that output.
- Pit refueling remains 0.8 L/s, with player Confirm exit after 2s and AI full-tank behavior in MVP.

### Files Revised During This Lean Review

- `design/gdd/fuel-system.md`
- `design/gdd/vehicle-physics.md`
- `design/registry/entities.yaml`
- `design/gdd/systems-index.md`

## Lean Review — 2026-07-26 — Verdict: NEEDS REVISION (corrected)

Scope signal: M
Specialists: none — lean mode
Blocking items: 0 | Recommended: 2 (both corrected)

Summary: Fresh lean re-review found 2 RECOMMENDED issues:
1. Ghost Recording entry mismatch — Dependencies table said "Outbound — Fuel level per tick" but Interactions table correctly says "Indirect — Fuel state derived from replay (not recorded per tick)". Corrected Dependencies entry to match.
2. Fuel State 50% boundary inconsistency — Full range was "100%–50%" with entry "drops below 50%", but HUD showed Yellow at exactly 50% while state was still Full. Corrected state transitions to "drops to 50%" and adjusted ranges to align with HUD thresholds.

Prior verdict resolved: Yes — all items from 2026-07-25 review resolved. This pass found internal table inconsistencies.

### Files Revised During This Lean Review

- `design/gdd/fuel-system.md`

## Review — 2026-07-25 — Verdict: NEEDS REVISION (corrected)

Scope signal: M

Specialists: none — lean mode

Blocking items: 1 | Recommended: 0

Summary: Cross-GDD review flagged game-concept.md contradiction: game-concept says "cannot finish without refueling" and "mandatory pit in most races" but Fuel System math shows lift-and-coast finishes without pit. Fixed by correcting game-concept.md to align with Fuel System design (pit optional, most styles need it, Ice Vein strategy valid).

Prior verdict resolved: Yes — all prior findings resolved; this pass found cross-GDD contradiction with game-concept.

### Files Revised During This Review

- `design/gdd/game-concept.md`

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed Fuel System is internally stable and aligned with Vehicle Physics, Simulation Architecture, Pit Stop, AI Rival, Qualifying, Ghost Recording, and UI Menu after the explicit fuel-comparison consumer was added. The review now closes cleanly with no remaining issues.

Prior verdict resolved: Yes — the open UI Menu consumer gap was corrected in this pass.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed the doubled Fuel base rate is now internally consistent and aligned with Vehicle Physics, Car Definition Data, Pit Stop, and the game-concept pit strategy intent. The revised 0.04 L/s base rate forces aggressive full-throttle runs to pit while lift-and-coast remains a viable no-pit path, and the review closes with no remaining issues.

Prior verdict resolved: Yes — the fuel math contradiction with game-concept was resolved by updating the base rate and all dependent formulas.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed the updated 0.05 L/s Fuel base rate is internally consistent and aligned with Vehicle Physics, Car Definition Data, Pit Stop, and the game-concept pit strategy intent. Full-throttle driving now forces a pit for every Efficiency level in a 5-lap race, while lift-and-coast remains a viable no-pit path, and the review closes with no remaining issues.

Prior verdict resolved: Yes — the 0.05 L/s tuning change was propagated through all dependent formulas and acceptance criteria.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 3 | Nice-to-Have: 1

Summary: Cross-GDD re-review (triggered by review-all-gdds W1 - Vehicle Physics dependency table one-directional) found 4 issues: F1 (VP bidirectionality in Interactions + Dependencies tables), F2 (VP line 226 stale 0.05 L/s), F3 (CDD line 276 stale 0.05 L/s), F4 (stale status header). All 4 corrected in-place. Fuel now correctly lists VP as Bidirectional with low-fuel speed bonus output; VP and CDD updated to 0.06 L/s base rate. No remaining issues.

Prior verdict resolved: Yes — the cross-GDD warning W1 was resolved by correcting VP to Bidirectional and all stale base_rate references were updated.
