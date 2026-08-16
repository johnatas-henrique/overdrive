# AI Rival Review Log

## Review — 2026-07-24 — Verdict: NEEDS REVISION

Scope signal: XL
Specialists: None (lean review)
Blocking items: 7 | Recommended: 3
Summary: The lean review found an undefined difficulty-to-pace contract, a conflicting MVP collision-avoidance rule, an incorrect 16-archetype/15-AI roster count, per-frame rather than deterministic per-tick noise, unitless racing-line offsets, incomplete direct dependencies, and acceptance criteria that did not isolate baseline speed conditions. The correction batch made difficulty affect competence rather than base car speed, assigned collision recovery to Vehicle Physics for MVP, deferred active obstacle avoidance to Alpha, excluded the player's team from AI control, and completed deterministic timing and dependency contracts.
Prior verdict resolved: First review

Decisions recorded:

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: L

Specialists: none — lean mode

Blocking items: 0 | Recommended: 1

Summary: Fresh lean re-review confirmed all prior findings were resolved. Cross-GDD consistency check found 1 RECOMMENDED issue: HUD dependency table said "Outbound" but interactions table said "Indirect" (internal contradiction). The dependency table was corrected to match. All cross-GDD contracts (pit strategy, DifficultyProfile, collision recovery, HUD reporting) are consistent.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found 1 internal naming inconsistency.

- MVP difficulty changes AI competence, pace noise, error, and decisions; it does not multiply the car's base velocity.
- MVP collision handling uses Vehicle Physics plus deterministic Recovering; active obstacle avoidance is deferred to Alpha.

Corrections applied:

- Added race seed, car ID, and simulation tick to AI noise generation.
- Defined normalized racing-line offsets and Track-owned pit spline usage.
- Added Simulation Architecture, Race Session Manager, Grid & Start, and Pit Stop dependencies.
- Clarified roster exclusion of the player's selected team.
- Status remains Revised — Pending Re-review.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: L

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed AI Rival is internally consistent, implementable, and aligned with Simulation Architecture, Fuel, Tire, Qualifying, Pit Stop, Grid & Start, HUD, Track, Vehicle Physics, and Race Session Manager. The deterministic snapshot-to-input loop, pit strategy, and collision-recovery contracts are explicit and the review closes with no remaining issues.

Prior verdict resolved: Yes — the HUD dependency-direction inconsistency was already corrected and no new issues were found in this pass.

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: L

Specialists: none — lean mode

Blocking items: 0 | Recommended: 1

Summary: Fresh lean re-review with exhaustive artifacts confirmed all prior findings were resolved. 8/8 sections present, 12/12 dependencies validated. Cross-GDD consistency check found 1 RECOMMENDED issue: Pit Stop interactions table (line 118) says AI Rival is "Inbound" but AI Rival correctly says Pit Stop is "Bidirectional". Pit Stop was corrected to match. All other cross-GDD contracts (DifficultyProfile, pit strategy, collision recovery, Qualifying AI times, HUD reporting) are consistent.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found a cross-GDD documentation inconsistency.

Corrections applied:

- Pit Stop interactions table: AI Rival direction changed from "Inbound" to "Bidirectional" with outbound data description added.
- Status remains Revised — Pending Re-review.
