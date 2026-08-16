# Track System Review Log

## Review — 2026-07-24 — Verdict: NEEDS REVISION
Scope signal: XL
Specialists: None (lean review)
Blocking items: 7 | Recommended: 3
Summary: The lean review found that the Track GDD still declared one MVP track despite the four-track project contract, described runtime spline data as geospatial coordinates, used reference race lap counts as if they were runtime rules, conflicted with the authoritative surface-wear values, redirected invalid pit entries, silently repaired invalid runtime grid assignments, and omitted direct consumers from its dependency graph. The correction batch separates source conversion from runtime meters, makes lap count session-owned, aligns surfaces with Tire, rejects invalid pit/grid data, makes the Track Map mandatory, and adds the missing contracts.
Prior verdict resolved: First review

Corrections applied:

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: L

Specialists: none — lean mode

Blocking items: 0 | Recommended: 1

Summary: Fresh lean re-review confirmed all prior findings were resolved. Cross-GDD consistency check found 1 RECOMMENDED issue: Track defines surface grip modifiers but does not document that Vehicle Physics overrides `surface_grip_multiplier` for the player off-track with DifficultyProfile values. The documentation was added.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found a documentation gap about player override.
- MVP scope is four tracks; alternate layouts remain deferred.
- Runtime JSON contains local meter coordinates after conversion.
- Reference lap counts are metadata; Race Session Manager owns configured race laps.
- Surface wear modifiers are Asphalt 1.0, Kerb 1.2, Gravel/Grass/Runoff 2.5.
- Wrong-way pit entry is rejected; runtime invalid grids fail validation.
- Added RSM, Pit Stop, Grid & Start, and Qualifying dependencies.
- Status remains Revised — Pending Re-review.

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: L

Specialists: none — lean mode

Blocking items: 1 | Recommended: 3

Summary: Lean re-review found 1 BLOCKING internal contradiction (surface wear formula description says "3.0 for gravel" but the surface table says 2.5) and 3 RECOMMENDED issues (grid column spacing ~2m vs Grid & Start 3.5m, Track ↔ RSM misclassified as Bidirectional, Track ↔ Pit Stop misclassified as Bidirectional). All 4 issues corrected in place.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found a formula typo and direction misclassifications.
- Surface wear formula description corrected from 3.0 to 2.5 (matches table).
- Grid column spacing aligned to 3.5m (matches Grid & Start).
- Track ↔ RSM direction corrected from Bidirectional to Outbound.
- Track ↔ Pit Stop direction corrected from Bidirectional to Outbound.
- Status remains Revised — Pending Re-review.

## Review — 2026-07-25 — Verdict: NEEDS REVISION (corrected)

Scope signal: S
Specialists: none — lean mode
Blocking items: 1 | Recommended: 0

Summary: Re-review found 1 BLOCKING issue — grid column spacing tuning knob range (1.5–3m) had current value 3.5m which exceeded the safe range max. Fixed by updating current value to 3.5m and safe range to 2.5–5m.

Prior verdict resolved: Yes — prior formula typo and direction misclassifications resolved. This pass found the tuning knob range was not updated when the current value was corrected.

### Files Revised During This Lean Review

- `design/gdd/track-system.md`

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: L

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed Track System is internally consistent, implementable, and aligned with Vehicle Physics, Tire, Fuel, Camera, AI Rival, HUD, Content Pipeline, Simulation Architecture, Race Session Manager, Pit Stop, Grid & Start, and Qualifying. The spline, pit-lane, grid, and validation contracts are explicit and the review closes with no remaining issues.

Prior verdict resolved: Yes — the grid-spacing and direction issues from prior reviews were already corrected and no new issues were found in this pass.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: L

Specialists: none — lean mode

Blocking items: 0 | Recommended: 2 | Nice-to-Have: 1

Summary: Cross-GDD re-review (triggered by review-all-gdds W2 - lap anti-cut rule missing + W4 - row spacing conflict) found 2 issues: W2 resolved by adding anti-cut note referencing RSM's 90% distance gate; W4 resolved by aligning row spacing range to 6–10 m (matching Grid & Start). Header updated.

Prior verdict resolved: Yes — both cross-GDD warnings were resolved.
