# Review Log: Vehicle Physics — Overdrive

## Lean Review — 2026-07-24 — Verdict: NEEDS REVISION

Scope signal: XL

Review boundary: MVP vehicle handling, explicit data/input contracts, resource interfaces, collisions, GridLocked behavior, and direct MVP consumers. Future Multiplayer behavior remained deferred.

Specialists: none — lean mode.

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: XL

Specialists: none — lean mode

Blocking items: 0 | Recommended: 2

Summary: Fresh lean re-review confirmed all prior findings were resolved. Cross-GDD consistency check found 2 RECOMMENDED issues: Surface data flow ambiguity (Tire System reads surface from CarState but CarState had no surface field) and grip_base naming collision. Both issues were corrected by adding surface to CarState and clarifying naming.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found data-flow documentation gaps.

Blocking items: 9 | Recommended: 4
Prior verdict resolved: First review.

### Findings

| Finding | Severity | Resolution |
|---|---|---|
| Stat mapping duplicated Stability and described Efficiency as operational base rates | Blocking | Removed the duplicate mapping and defined Efficiency as the dimensionless Fuel/Tire modifier. |
| Overview still consumed fuel weight although vehicle mass is constant | Blocking | Replaced fuel weight with Fuel state and the low-fuel max-speed modifier; retained constant 505 kg mass. |
| Vehicle Physics consumed `SimulationInput.steer` | Blocking | Updated the contract to `SimulationInput.steerOut`. |
| Movement rules claimed additive stacking and the grip formula omitted Tire, Stability, floor, and ceiling contracts | Blocking | Added the multiplicative `effective_grip` stack with 0.20 floor and 1.20 ceiling. |
| GridLocked held position at zero | Blocking | GridLocked now preserves each car's assigned grid transform while freezing race movement. |
| Pit driving input and exit transition were underspecified | Blocking | Driving input is blocked in Pitting; Pit Stop owns `PitPhase`, Confirm exit, and `PitExit` completion. |
| Grid & Start, Track System, and Pit Stop were absent from the dependency tables | Blocking | Added their direct interaction and dependency contracts. |
| Multiplayer Architecture was a Hard Vehicle Physics dependency | Blocking | Reclassified it as Deferred/Beta; MVP has no network runtime dependency. |
| AC-R1 expected 40–60% fuel use despite the formula yielding 0.75L / 9.4% | Blocking | Corrected AC-R1 to the calculated 0.75L result. |
| A stopped car had an unapproved reduced-mass exception | Recommended | Removed the exception; all cars retain 505 kg mass and use normal collision impulse. |
| Surface recovery incorrectly restored all grip despite persistent tire wear | Recommended | Surface contribution restores immediately; Tire wear and persistent modifiers remain active. |
| AC-M3 used 16ms instead of canonical `FIXED_DT` | Recommended | Changed the criterion to approximately 16.667ms at 60 Hz. |
| Car Definition acceleration/braking formulas require their own owner review | Deferred | Left Car Definition formulas unchanged; Vehicle Physics consumes their outputs and does not redefine them. |

### MVP Contracts Confirmed

- Fuel System and Tire System own their operational formulas.
- Vehicle Physics owns the multiplicative grip stack and applies the approved clamp.
- Grid & Start owns the Perfect Start multiplier and grid assignment boundary.
- Multiplayer is not an MVP runtime dependency.

### Files Revised During This Lean Review

- `design/gdd/vehicle-physics.md`

## Review — 2026-07-25 — Verdict: APPROVED

Scope signal: XL

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review with exhaustive artifacts confirmed all prior findings were resolved. 8/8 sections present, 15/15 dependencies validated, 15/15 cross-GDD consistency checks pass (Simulation Architecture, Input System, Settings, Fuel, Tire, Car Definition Data, Camera, HUD, Audio, AI Rival, Ghost Recording, Multiplayer Architecture, Grid & Start, Track System, Pit Stop). Non-MVP constraint check passes. Field naming consistent (accelerateOut/brakeOut/steerOut, grip_base, tire_runtime_grip_multiplier, surface, PitPhase). All prior review findings resolved.

Prior verdict resolved: Yes — all 2 findings from the 2026-07-25 NEEDS REVISION review were resolved (surface field added to CarState, grip_base naming clarified).
 - `design/gdd/systems-index.md`

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: XL

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed Vehicle Physics remains internally stable after the Fuel base-rate update and stays aligned with Fuel, Tire, Car Definition Data, Simulation Architecture, Grid & Start, Track System, Pit Stop, Camera, HUD, Audio, AI Rival, and Ghost Recording. The updated fuel-rate contract is explicit and the review closes with no remaining issues.

Prior verdict resolved: Yes — the Fuel formula update was propagated through Vehicle Physics' outbound contract and no new issues were found in this pass.
