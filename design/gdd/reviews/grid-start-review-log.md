# Grid & Start Review Log

## Review — 2026-07-24 — Verdict: NEEDS REVISION
Scope signal: L
Specialists: None (lean review)
Blocking items: 8 | Recommended: 3
Summary: The lean review found stale 3-2-1 wording, incorrect ownership of Countdown and GO, an over-restrictive Perfect Start rule, incomplete GridAssignment/Input contracts, random tie-breaking, false tier-position guarantees, and unresolved AI Perfect Start behavior. The correction batch aligned Grid & Start with the 5-second/300-tick Simulation contract and resolved AI Perfect Start as player-only for MVP.
Prior verdict resolved: First review

Corrections applied:

## Review — 2026-07-25 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review confirmed all prior findings were resolved. Cross-GDD consistency check found zero contradictions across all 9 dependencies. Tiebreaker matches Qualifying (fixed in earlier review). Perfect Start contract matches Input System. perfectStartDriveForceMultiplier matches Vehicle Physics. GO_tick and grid-lock lifecycle matches Simulation Architecture. PerfectStartResult and ReplayInitialState match Simulation Architecture.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found no cross-GDD issues.
- Countdown and GO now use five lights, five seconds, and tick 300.
- Simulation owns GO/grid-lock lifecycle; RSM supplies GridAssignment.
- Perfect Start uses the approved pre-GO window and player-only bonus.
- Equal qualifying times use stable carId ordering.
- Grid display, Confirm skip, top-down camera, and spawn-at-assigned-transform behavior are explicit.
- Status remains Revised — Pending Re-review.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed Grid & Start is internally consistent and aligned with UI Menu and Qualifying. The shared grid display now uses a single Confirm-driven Start Race flow, no timeout or Back/Cancel path, and DNQ labels for skipped qualifying.

Prior verdict resolved: Yes — the countdown and grid-display coupling remained intact while the grid contract was simplified, and no new issues were found in this pass.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 1 | Nice-to-Have: 1

Summary: Cross-GDD re-review (triggered by review-all-gdds W4 - row spacing range conflict) found 1 issue: Track row spacing range 6–12m conflicted with Grid & Start 6–10m. Aligned Track to Grid & Start: 6–10m. Header updated.

Prior verdict resolved: Yes — the cross-GDD warning W4 was resolved by aligning Track's row spacing range to Grid & Start's 6–10m.

## Review — 2026-08-01 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 1 | Nice-to-Have: 2

Summary: Re-review of the Grid Display → Qualifying Results rename (standardization #1620) — rename verified complete across Phase 2, Countdown diagram, States, Interactions, and UX flag. Cross-GDD contracts re-verified: first corner direction (Track), AI launch archetypes (AI Rival), GridAssignment ownership (RSM), Perfect Start multiplier (VP, exclusive write), row spacing 8m/6-10m aligned (Track). One recommended (stale Last Updated header) and two nice-to-have (spacing typos in Player Fantasy) corrected in-session. Cross-GDD note logged: qualifying.md:61 wording "opens automatically after 5 seconds" is ambiguous (means terminal presentation timeout, not grid auto-advance) — scheduled for the qualifying.md review.

Prior verdict resolved: Yes — the 2026-07-26 APPROVED verdict stood; the rename introduced only cosmetic residuals.
