# Playtest Report

## Session Info
- **Date**: 2026-08-03/04 (race-feel prototype sessions)
- **Build**: Race Feel prototype (Assets/Prototype/RaceFeel)
- **Duration**: ~10-15 min to control the cars (learning curve); full session length unrecorded
- **Tester**: Thawane (29, very casual — Bomberman Fantasy Race / Mario Kart background)
- **Platform**: PC
- **Input Method**: Gamepad (played better than keyboard — analog dosing vs binary keys); keyboard also tested
- **Session Type**: First time (external casual playtester — target audience)

## Test Focus
Validate the arcade grip feel foundation: car differentiation (16 teams), drift
(accelerating above corner limit), tuck-in (lift-off), speed sensation,
starting-car experience (tier 4-d), and input method (gamepad vs keyboard).

## First Impressions (First 5 minutes)
- **Understood the goal?** Partially — "you have to get the hang of it"; improved visibly over the session
- **Understood the controls?** Yes — controls understood; technique (lift-off) discovered independently
- **Emotional response**: Engaged — liked the driving, felt a connection to the cars
- **Notes**: Felt the weak car as "skittish, like bald tires" — hard to control; relaxed and started having fun only after the inner walls were moved out (fear-of-error effect)

## Gameplay Flow
### What worked well
- Liked the driving; felt a connection to the cars
- Independently discovered lift-off (tuck-in) to control drifts
- Chose 1-d over 1-b as easier to control — consistent with the stats, without knowing them
- Perceived that each car drives differently ("not several cars that are just faster or slower") — tier 1 technique does not work on tier 3

### Pain points
- Tier 4-d "skittish, like bald tires" (arredio, hard to control) — Severity: High (starting-car risk for casuals — CD CONCERN-2)
- Inner-wall placement shrank the perceived error space — player relaxed only after walls moved out — Severity: Medium (design lever — CD CONCERN-5)

### Confusion points
- None reported — the "get the hang of it" framing shows technique was understood as a learnable skill, not confusion

### Moments of delight
- Drift provokable and controllable (friend watching a video: "NFS Underground 2 style drifts")
- Tuck-in discovery (independently) — satisfying mechanic

## Bugs Encountered
| # | Description | Severity | Reproducible |
|---|-------------|----------|-------------|
| — | No gameplay bugs reported (prototype bugs were fixed during iteration — see REPORT Lessons Learned) | — | — |

## Feature-Specific Feedback
### Car differentiation (16 teams)
- **Understood purpose?** Yes — "not several cars that are just faster or slower"; each drives differently
- **Found engaging?** Yes — preferred tiers 1-2; chose 1-d (easier) over 1-b, consistent with the stats
- **Suggestions**: none

### Grip / drift / tuck-in
- **Understood purpose?** Yes — lift-off discovered independently to control drifts
- **Found engaging?** Yes — drift provokable and controllable
- **Suggestions**: wall out-spacing to preserve error space

### Input (gamepad vs keyboard)
- **Understood purpose?** Yes
- **Found engaging?** Yes — played better with gamepad (analog dosing vs binary keys)
- **Suggestions**: none

## Quantitative Data (if available)
- Lap times (Oval 1240m, gamepad): McLaren 18.4 / 14.0 / 13.3s (lap 1 with crash); 4-d 19.2 / 15.0 / 15.5s (clean) → clean-lap gap ~1.5-1.7s (~11%)
- Playtester learning curve: ~10-15 min to control the cars
- Steering response: 0.85 (1-a) vs 0.62 (4-d) — same input produces less response in the weak car (grip ceiling)
- Throttle-off time: 3% (1-a) vs 15% (4-d) — tuck-in technique
- Slip ratio on clean laps: 0.001-0.002 both cars (lift-off mastering); peaks 0.237 (1-a crash) and 0.091 (4-d adaptation lap)

## Overall Assessment
- **Would play again?** Yes [I — "liked the driving", improved visibly; not explicitly asked]
- **Difficulty**: Tier 4-d "skittish" for casual — Too Hard as the starting car (design action: teach tuck-in in the first Career races — CD CONCERN-2)
- **Pacing**: Good (validated)
- **Session length preference**: [not recorded]

## Creative Director Assessment (CD-PLAYTEST, 2026-08-04)

The creative director evaluated this playtest session as part of the /prototype
Phase 6 gate (REPORT.md:124). Verdict: **CONCERNS — PROCEED confirmed, five
gaps tracked.** Relevant to this session: the 4-d starting-car risk for casuals
(CONCERN-2 — do NOT change the stats; design the first Career races to teach
tuck-in) and the wall out-spacing / trackside density items (CONCERN-5). Full
verdict in `prototypes/race-feel/REPORT.md`.

## Top 3 Priorities from this session
1. Starting-car experience (tier 4-d) for casuals — design first Career races to teach tuck-in (CD CONCERN-2)
2. Wall out-spacing preserving error space (playtester finding — CD CONCERN-5)
3. Cockpit camera as first production deliverable (CD CONCERN-1 — the primary fantasy, unvalidated in the prototype)

## Action Routing

- **Design changes**: wall out-spacing + starting-car design → routed to /propagate-design-change (already executed 2026-08-05 — `docs/architecture/change-impact-2026-08-05-vehicle-physics.md`); Career first-race teaching design deferred to Career design
- **Balance adjustments**: none — the CD decision is to NOT change the 4-d stats (the weakness IS the fantasy)
- **Bug reports**: none
- **Polish items**: trackside content density (empty straights read as slow — Kemmel) → production polish backlog
