# Prototype Report: Race Feel

<!-- Phase 5 — filled 2026-08-04 after testing, data analysis, and external playtest -->

## Hypothesis

The arcade grip model (ADR-0002: Rigidbody + grip stack, velocity rotated
toward heading preserving magnitude) is fun and responsive enough to sustain
the game's core loop. The base stat formulas (Top Speed → vmax, Acceleration →
P/m power curve, Grip → % of vmax cornering, Stability → slip behavior, Brake →
deceleration) differentiate the 16 cars in a way players can perceive and
enjoy, and a skilled driver in a weak car can fight cars above its tier.

## Approach

4 days of iteration (2026-08-01 to 2026-08-04), far beyond the skill's 1-3 day
timebox — scope grew by joint decision into a feel laboratory.

**Built:**
- `ArcadeCar`: grip stack, 1-state speed-dependent steering (user-approved
  model: `maxYaw = min(steerCeiling(v), v/minTurnRadius, gripCeiling)`),
  lift-off grip bonus (tuck-in), track-radius drift factor, reverse with arcade
  sign inversion, manual render interpolation (ADR-0001 pattern)
- `RaceFeelController`: manual accumulator (60 Hz fixed ticks), countdown,
  grid lock (GDD #1400), 3-lap races, projection-based lap counting, R restart
- `PrototypeTrack`: procedural Oval (400m straights, 70m radius) + real
  Spa-Francorchamps (OSM centerline, 7km, 445 points) + cartoon visual layer
  (RCC asset: road/grass materials, 4 wall prefab types, grid slots, start
  lights, start line)
- `RaceFeelTuningPanel`: runtime tuning (Tab), speed cap, track switch,
  16 team car presets
- `PrototypeCamera`: chase, velocity-based follow (drift visible), speed FOV
- `MinimalHud`: speed, lap, current/last/best lap time, countdown overlay

**Real 1989 F1 data** (engine research): P/m for 7 engines (Honda 1012 →
Yamaha 832), per-team vmax estimates, quadratic drag model
(`K = P/m / vmax³`), 16 presets with real TS/AC registry values.

**Shortcuts taken:** car is a cartoon prefab (not the game's art style),
tracks are 2D (no elevation), no engine sound, no drift VFX, minimal HUD,
single car on track (no AI grid).

**Iteration count:** 10+ physics bugs found and corrected (anti-lateral that
braked the car mid-corner, double-mass torque, concave MeshCollider, 50 Hz
`Time.fixedDeltaTime` vs 60 Hz accumulator mismatch, Unity serialized values
overriding code defaults, camera double-smoothing, lap counter dead-zone
failure at top speed, grass traction trap at standstill, and more).

## Result

**Core question answered: YES.** The arcade grip sustains the loop and is fun.
Confirmed by 4 days of developer play, an external casual playtester, and
telemetry data.

**What worked definitively:**
- Car differentiation is perceptible and data-backed: clean-lap times McLaren
  13.3-14.0s vs 4-d 15.0-15.5s; stick response (yaw/steer) 0.85 vs 0.62; the
  weak car demands a different driving style (lift-off 15% of the time vs 3%),
  not just lower speed
- Tuck-in (lift-off gains cornering) is satisfying and was discovered
  independently by the playtester
- Drift is provokable and controllable; even the worst cars rarely spin
  unrecoverably (friend watching a video: "NFS Underground 2 style drifts")
- Gamepad analog works well: "the car feels alive, it talks to you — it warns
  you it's escaping" (long-radius oval corners)
- Weak cars are challenging, not frustrating — the 4-d is a good career
  starter (teaches tuck-in), can fight tier 3 and pressure tier 2, but must
  not beat tier 1 (preserves the desire to buy a better car)

**External playtest (Thawane, 29, very casual — Bomberman Fantasy Race /
Mario Kart):**
- Liked the driving, felt a connection to the cars, understood "you have to
  get the hang of it"; improved visibly over the session
- Preferred tiers 1-2; tier 4 felt like "bald tires" (skittish, hard to
  control)
- Independently discovered lift-off to control drifts
- Chose 1-d over 1-b as easier to control — consistent with the stats,
  without knowing them
- Perceived that each car drives differently ("not several cars that are just
  faster or slower") — tier 1 technique does not work on tier 3
- Played better with gamepad than keyboard (analog dosing vs binary keys)

**Key finding (divergence):** wall placement on the INNER side of curves
shrinks the perceived error space — the playtester relaxed and started having
fun only after the oval walls were moved out. Fear of error is a design lever.

**Imperfect / production work:**
- Camera: chase shows drift well (validated), but has ease-in/positioning
  quirks; cockpit camera not tested; re-evaluate Cinemachine vs ADR-0010's
  "simple Transform lerp" before production
- Empty straights kill speed sensation (Spa's Kemmel straight reads as
  "standing still") — trackside content density is a speed-feel requirement
- Wall placement on Spa still needs the same out-spacing treatment as the oval
- Art style (Fujishima + Hino Matsuri) never validated in motion — the cartoon
  prefabs do not represent the game's style; open question for production

## Metrics

- Lap times (Oval 1240m, gamepad): McLaren 18.4 / 14.0 / 13.3s (lap 1 with
  crash); 4-d 19.2 / 15.0 / 15.5s (clean) → clean-lap gap ~1.5-1.7s (~11%)
- Top speed: McLaren 339 km/h (theoretical 340); 4-d 309 (theoretical 312)
- Steering response (yaw per stick unit, partial input): 0.85 (1-a) vs 0.62
  (4-d) — same input produces less response in the weak car (grip ceiling)
- Steering time in full lock: 23% (1-a) vs 37% (4-d) — weak car demands
  coarser corrections
- Throttle-off time: 3% (1-a) vs 15% (4-d) — tuck-in technique
- Slip ratio on clean laps: 0.001-0.002 both cars (lift-off mastering);
  peaks 0.237 (1-a crash) and 0.091 (4-d adaptation lap)
- Feel (developer): steering instant, no simulator inertia; 300+ km/h reads
  fast when the track has reference objects; FOV/zebras/posts work
- Playtester learning curve: ~10-15 min to control the cars, discovered
  lift-off unaided
- Frame times: collected by the controller but not formally analyzed —
  performance is production scope

## Recommendation: PROCEED

The base the prototype validated is solid, functional, and — most importantly —
fun. Evidence: developer + external playtester agreement on feel and
differentiation; telemetry confirms the design (weak cars demand technique,
technique pays off); 4 of 5 stats validated by feel, the 5th (brake) has
perceptible differentiation and low gameplay impact.

## Creative Director Review (CD-PLAYTEST, 2026-08-04)

**Verdict: CONCERNS — PROCEED confirmed, five gaps tracked.**

The creative director confirmed the prototyper's PROCEED (the feel foundation
is validated and production should not be blocked), but flagged five gaps
between the intended fantasy and the tested experience — none invalidate the
foundation, all must be on the record before production scales:

- **CONCERN-1 [HIGH] — Cockpit camera (the primary fantasy, game-concept:18)
  is unvalidated.** The prototype tested only the chase camera — an option, not
  the primary. Build the cockpit as the FIRST production deliverable and
  re-validate with a second playtest before committing to either camera as
  primary; if the cockpit under-delivers, the concept may need to revise the
  camera decision (chase-as-primary matches genre references).
- **CONCERN-2 [MEDIUM] — Starting-car risk for casual players.** The 4-d is
  challenging-not-frustrating for experienced players, but the casual playtester
  (the target demographic) called it "skittish, like bald tires" and it demands
  a 15% lift-off technique tax. Do not change the 4-d stats (the weakness IS
  the fantasy) — instead design the first 2-3 Career races to teach lift-off/
  tuck-in, offer a "very easy" tier-4 variant, and validate the
  starting-car-first-session experience with a second external playtest.
- **CONCERN-3 [MEDIUM] — Art style in motion unvalidated.** The Directional
  Velocity visual rule was never exercised (cartoon prefabs ≠ Fujishima+Matsuri
  style). The visual half of Pillar 1 is untested. Minimal art test (one car +
  one track section, production style, human playtester) is an explicit gate
  BEFORE asset production scales.
- **CONCERN-4 [MEDIUM] — Engine sound (ADR-0012) is a pillar component, not
  polish.** Pillar 1 couples visual AND audio feedback; the prototype felt fun
  without sound, but that is not evidence sound is optional. Staff it alongside
  the cockpit camera, not in a polish phase.
- **CONCERN-5 [LOW] — Trackside content density is a track-design ownership
  item.** The empty Kemmel straight is a content-design requirement (Directional
  Velocity already specifies density); codify it in a track-design GDD instead
  of leaving it to individual track authors. Wall out-spacing (playtester
  finding) is the same category.

**Validation criteria:** the five CONCERNS appear as named items in the
production backlog with owners; the cockpit+sound+art-in-motion playtest is
scheduled with a date; the If-Proceeding list is replicated into the systems
index and GDDs; the starting-car-first-session scenario is in the Alpha Career
test plan.

## If Proceeding

**Replicate into GDD/ADR (the prototype values ARE the source of truth):**
- Stats TS/AC/GR/ST/BR with real 1989 F1 values (scale 310-338 km/h, 0-280
  acceleration times, P/m per engine, grip % of vmax formula, stability slip
  behavior)
- Steering model 1-state, lift-off grip bonus (fixed g), drift factor
  (track-radius activated), reverse arcade inversion
- Update: car-definition-data.md, vehicle-physics.md, entities.yaml,
  simulation-architecture, ADR-0002, ADR-0015 and any formula-dependent docs

**Production essentials (not covered by the prototype):**
- Engine sound (ADR-0012) — the single biggest remaining feel gap
- Drift VFX (smoke/body roll, ADR-0010)
- Splines with elevation (ADR-0007) — prototype tracks are 2D
- AI rival grid (16 cars) — prototype has 1 car
- Real HUD (8 elements), cockpit camera, menus/car-track selection, settings
- Per-track retuning expected (16 tracks; cars may diverge on extreme layouts)
- Trackside content density for speed sensation (empty straights read as slow)
- Wall/runoff spacing preserving error space (playtester finding)
- Art-style-in-motion validation: minimal art test before heavy production

**Deferrable:** multiplayer, ghost (already Alpha scope), Cinemachine decision
(re-evaluate before production camera).

## Lessons Learned

- Arcade physics: rotating velocity toward heading preserves speed (anti-lateral
  subtraction brakes the car mid-corner); ForceMode.Acceleration/Impulse already
  apply mass (double-mass blows up values); concave MeshColliders on dynamic
  rigidbodies error — mark convex; consistent dt across the tick (Unity
  fixedDeltaTime 50 Hz vs custom 60 Hz accumulator silently skews steering)
- Unity: serialized values override code defaults (Inspector/prefab wins —
  tune via SerializedObject, verify at runtime); stop Play Mode before script
  edits; runInBackground controls Play Mode under unfocused editor
- Design: a weak car is fun when it is challenging-but-recoverable, not
  frustrating; casual players discover lift-off unaided if feedback is clear;
  perceived error space (walls) changes how much players are willing to try
- Process: the prototype outgrew its skill timebox into a feel laboratory and
  produced almost a mini-game in 4 days; external playtest is invaluable (it
  found what the creator could not see — the inner-wall fear effect); tools
  (Unity CLI, MCP) work and their potential is not yet fully used
- The prototype is NOT an MVP — it validated the feel foundation; MVP systems
  (AI, pit, fuel/tires, qualifying, menus, settings, HUD, audio, cockpit) were
  not sketched
