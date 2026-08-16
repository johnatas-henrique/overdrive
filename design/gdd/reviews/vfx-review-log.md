# VFX Review Log

## Review — 2026-07-24 — Verdict: NEEDS REVISION
Scope signal: L
Specialists: None (lean review)
Blocking items: 6 | Recommended: 3
Summary: The lean review found duplicate Camera Shake ownership, duplicated FPS/performance decisions, stale Tier 4 speed values, frame-rate-dependent particle emission, incomplete Pit/Finished/PerformanceReduced state contracts, and hardcoded speed thresholds that disagreed with the normalized formulas. The correction batch made Camera responsible for shake composition, Simulation responsible for performance protection, normalized streaks against onset/global velocity, and made particle emission frame-delta based.
Prior verdict resolved: First review

Corrections applied:

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 1

Summary: Fresh lean re-review confirmed all prior findings were resolved. Cross-GDD consistency check found 1 RECOMMENDED issue: Camera interactions table said "VFX | Inbound" but dependencies table said "VFX | Bidirectional" (internal contradiction). The interactions table was corrected to "VFX | Bidirectional" to match.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found 1 internal Camera naming inconsistency.
- Impact Shake Request replaces VFX-owned camera transform composition.
- PerformanceReduced is consumed from Simulation; VFX no longer measures FPS.
- Tier 4 uses the Car Definition value of 298 km/h.
- Speed streak, particle, Pit, Finished, and density contracts are explicit.
- Status remains Revised — Pending Re-review.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed VFX is internally consistent, implementable, and aligned with Vehicle Physics, Track, Camera, Settings, Tire System, Simulation Architecture, and Car Definition Data. The speed, shake, density, and reduced-motion contracts are explicit and the review closes with no remaining issues.

Prior verdict resolved: Yes — the Camera ownership and speed-streak formula issues from prior reviews were already corrected and no new issues were found in this pass.

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: M

Specialists: none — lean mode

Blocking items: 1 | Recommended: 0

Summary: Lean re-review found 1 BLOCKING issue: Speed Streaks table entry for 155 km/h says 0.5 intensity but formula gives 0.262. The table value was corrected to match the formula.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found a table/formula mismatch.
- Speed Streaks table corrected: 155 km/h intensity changed from 0.5 to 0.262.
- Status remains Revised — Pending Re-review.
