# Qualifying Review Log

## Review — 2026-07-24 — Verdict: NEEDS REVISION
Scope signal: L
Specialists: None (lean review)
Blocking items: 5 | Recommended: 2
Summary: The lean review found that the fixed 1.0L qualifying load did not guarantee a complete flying lap under the Fuel formula, the AI-time examples and output range were arithmetically wrong, and grid ownership bypassed the RSM-owned GridAssignment contract. It also found missing Simulation/Pit Stop dependencies, missing deterministic tie handling, and no explicit display for skipped or failed qualifying. The corrected design computes the minimum load from car rate and track reference time with a 10% margin, aligns the formula examples, routes the assignment through RSM, blocks pit behavior, and makes failure results explicit.
Prior verdict resolved: First review

Decision recorded:

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: L

Specialists: none — lean mode

Blocking items: 1 | Recommended: 3

Summary: Fresh lean re-review confirmed all prior findings were resolved. Cross-GDD consistency check found 1 BLOCKING issue (tiebreaker chain mismatch between Qualifying 3-level and Grid & Start 1-level) and 3 RECOMMENDED issues (grid screen exit mechanism, fuel/tire pipeline exemption, Loading vs Race Reconfigure). All issues were corrected.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found grid and pipeline contract gaps.
- Qualifying fuel is computed per car and track as the minimum amount covering the reference lap plus a 10% margin; it is not player-managed.

Corrections applied:
- Corrected AI time bounds and Monaco examples.
- Added deterministic tie-breakers: tier priority, car stats, stable `car_id`.
- Added `Simulation Architecture` and `Pit Stop` contracts.
- Clarified shared Countdown/GO entry and RSM-owned GridAssignment transport.
- Added `Skipped`/`DNF` result semantics and no-pit acceptance criteria.
- Status remains Revised — Pending Re-review.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: S

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed Qualifying is internally consistent and aligned with the shared Grid Display contract. The post-qualifying screen now opens into a single Start Race flow, the grid result for skipped runs is DNQ, and the qualifying handoff no longer implies a separate grid timeout behavior.

Prior verdict resolved: Yes — the tiebreak and grid-handling issues were already corrected and no new issues were found in this pass.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: L

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed Qualifying is internally consistent, implementable, and aligned with Simulation Architecture, Race Session Manager, Fuel, Tire, Pit Stop, AI Rival, Grid & Start, HUD, Input, and Track. The one-shot qualifying flow and deterministic grid assignment are explicit and the review closes with no remaining issues.

Prior verdict resolved: Yes — the tie-break and pit-blocking issues from the prior review were already corrected and no new issues were found in this pass.

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: S

Specialists: none — lean mode

Blocking items: 1 | Recommended: 1

Summary: Re-review found that the prior tiebreaker correction was incomplete — the formula (line 170) was corrected to stable_car_id only, but the edge case (line 189) still used the old 3-level chain (tier → stats → car_id). This contradicted both the GDD's own formula and Grid & Start's formula. Also found that Pit Stop GDD did not document Qualifying-mode pit blocking despite Qualifying AC requiring it.

Prior verdict resolved: Partially — prior BLOCKING (tiebreaker) was corrected in formula but not in edge case; prior RECOMMENDED items (grid screen, fuel/tire pipeline, Loading vs Reconfigure) were resolved.

Corrections applied:
- Corrected edge case line 189: tiebreaker now uses stable_car_id only (matches formula and Grid & Start).
- Added Qualifying entry to Pit Stop interactions table documenting RaceMode.Qualifying pit blocking.
- Status remains Revised — Pending Re-review.

## Review — 2026-07-25 — Verdict: NEEDS REVISION (corrected)

Scope signal: S

Specialists: none — lean mode

Blocking items: 1 | Recommended: 0 | Nice-to-Have: 0

Summary: Re-review found 1 BLOCKING issue — AC-242 (line 242) stated "higher tier gets better position" for identical qualifying times, contradicting the formula (line 170), edge case (line 189), and AC-246 (line 246) which all use stable_car_id only. The 3rd review corrected the edge case but missed AC-242. Fixed by updating AC-242 to match the formula.

Prior verdict resolved: Partially — prior BLOCKING (edge case tiebreaker) was corrected in 3rd review; this pass found the AC was not updated.

Corrections applied:
- Corrected AC-242: "higher tier gets better position" → "stable car_id determines the deterministic order (same as Grid & Start)".
- Status remains Revised — Pending Re-review.
