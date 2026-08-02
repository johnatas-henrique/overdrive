# Cross-GDD Review Report

Date: 2026-08-01
GDDs Reviewed: 21
Systems Covered: AI Rival, Audio System, Camera, Car Definition Data, Content Pipeline, Fuel System, Ghost Recording, Grid & Start, HUD, Input System, Multiplayer Architecture, Pit Stop, Qualifying, Race Session Manager, Settings, Simulation Architecture, Tire System, Track System, UI Menu, Vehicle Physics, VFX

Context: Re-review after the parallel agent's Grid Display → Qualifying Results rename (30-31/07) and the creation of ADRs 0013-0015. All 21 GDDs were individually APPROVED before this review (design-review re-reviews completed 01/08: HUD, UI Menu, Grid & Start, Simulation Architecture, Input System, Race Session Manager, Qualifying, Content Pipeline).

---

## Consistency Issues

### Blocking (must resolve before architecture)

#### CB1 — Final-lap sting trigger conflict (Audio vs RSM)
- `audio-system.md:159`: "**Final Lap** | Lap count = total laps | 3–5s"
- `race-session-manager.md:245`: "Final lap: Audio sting triggers when lapCount = totalLaps - 1."
- At `lapCount = totalLaps` the car is crossing the finish line — the Finish sting fires there, so a Final-Lap sting at "total laps" collides with the Finish sting and never plays during the actual final lap. RSM's trigger (`totalLaps - 1`) is the correct anticipation timing. Audio System must match RSM.

#### CB2 — Vehicle Physics AC-R1 fuel math error
- `vehicle-physics.md:353` (AC-R1): "Given Efficiency stat 16/20, When player holds full throttle for 60 seconds, Then Fuel reports approximately 1.8L consumed, equal to about 22.5% of the fixed 8.0L tank"
- Shared formula (`fuel-system.md:151-152`, registry `fuel_consumption_rate`): rate = 0.06 × throttle × (1 − 16×0.025) = **0.036 L/s → 2.16 L in 60s = 27%** of 8.0L.
- 1.8L corresponds to Efficiency **20** (0.06 × 0.5 × 60). AC-R1's expected value is for the wrong stat. Either the stat must be 20 or the value must be 2.16L/27%.

#### CB3 — "Seven Chase elements" residual in Settings
- `settings.md:303`: "Show Chase HUD in Cockpit controls whether the **seven** Chase elements are added to the four-element cockpit layout"
- `settings.md:377` (AC-CAM5): "the **seven** Chase elements are visible in addition to the four cockpit elements"
- `hud.md:68`: "all **8** active Chase elements are overlaid on the cockpit view (total: **12** elements including the 4 cockpit elements)" and hud.md:239/242/243 (8 elements, 12 total).
- HUD is now 8 elements (canonicalized 01/08). Settings must be updated to eight/12.

### Warnings (should resolve, but won't block)

#### CW1 — Dependency Asymmetry: 31 one-directional or table-omission edges

**(A) Genuinely one-directional: counterpart has zero reference anywhere (17):**
1. Track→Camera `track-system.md:204` ("Track geometry") — camera.md has no Track row
2. UI Menu→Camera `ui-menu.md:163` ("Finished Presentation camera request") — camera.md attributes trigger to Simulation (`camera.md:69`)
3. Track→Fuel `track-system.md:203` ("Pit lane state triggers refueling") — fuel-system.md has no Track row
4. Grid & Start→HUD `grid-start.md:152` ("Grid display, countdown") — hud.md has no Grid & Start row
5. HUD→CarDef `hud.md:187` ("Team color, icon") — car-definition-data.md has no HUD row
6. VFX→CarDef `vfx.md:210` ("global_max_velocity") — car-definition-data.md has no VFX row
7. Content Pipeline→VP `content-pipeline.md:209` ("car prefab references for spawning") — vehicle-physics.md has no Content Pipeline row
8. CarDef→Content Pipeline `car-definition-data.md:323` ("team_id → asset path") — content-pipeline.md has no CarDef row
9. CarDef→RSM `car-definition-data.md:325` ("team_id → grid composition") — race-session-manager.md has no CarDef row
10. UI Menu→RSM `ui-menu.md:161` ("StartRaceRequested, ReturnToMenuRequested") — RSM has no UI Menu row
11. Qualifying→HUD `qualifying.md:150` ("Timer, position") — hud.md has no Qualifying dependency row
12. Audio→RSM `audio-system.md:282` ("lap, final-lap, finish events") — RSM has no Audio row
13. RSM→VP `race-session-manager.md:220` ("final CarState and Track-mapped spline progress") — vehicle-physics.md has no RSM row
14. Grid & Start→Audio `grid-start.md:153` ("Countdown sounds") — audio-system.md has no Grid & Start row
15. Content Pipeline←Settings `content-pipeline.md:214` ("Medium WebGL or High PC default quality") — settings.md has no Content Pipeline reference
16. UI Menu→Audio `ui-menu.md:164` ("Menu music") — audio-system.md has no UI Menu row
17. Audio→Track `audio-system.md:276` ("surface_type") — track-system.md has no Audio row

**(B) Dependencies-table omission: edge exists in counterpart's Interactions/prose but not its Dependencies section (14):**
18. Qualifying↔Fuel `qualifying.md:145` — fuel-system.md Interactions:127 lists Qualifying; Dependencies omit
19. UI Menu→Fuel `ui-menu.md:159` — fuel Interactions:130 lists UI Menu; Dependencies omit
20. Audio→Fuel `audio-system.md:275` — fuel Interactions:129 lists Audio; Dependencies omit
21. Audio→Tire `audio-system.md:274` — tire prose:202 references Audio; Dependencies omit
22. Track→Tire `track-system.md:202` — tire prose:51 references Track surface table; Dependencies omit
23. VFX→Tire `vfx.md:209` — tire prose:201 references VFX; Dependencies omit
24. Qualifying→Tire `qualifying.md:146` — tire prose:231 references Qualifying; Dependencies omit
25. Qualifying→Pit Stop `qualifying.md:153` — pit-stop Interactions:122 lists Qualifying; Dependencies omit
26. Pit Stop→Input `pit-stop.md:137` ("Direct Confirm action in PitService") — input-system.md Dependencies omit Pit Stop
27. Qualifying→Input `qualifying.md:142` — input-system.md has GameplayQualifying context:165; Dependencies omit
28. RSM→Fuel/Tire `race-session-manager.md:221-222` ("LapCompleted, PitEntry, PitExit") — fuel/tire Dependencies omit RSM
29. AI→HUD (indirect) `ai-rival.md:260` ("via RSM… Soft") — hud.md no AI row
30. Qualifying→Settings `qualifying.md:147` ("via Simulation") — settings.md no Qualifying mention
31. Input→Ghost `input-system.md:116` ("via Simulation… Architecture constraint") — ghost-recording.md no Input row

**Root pattern [debt]:** GDDs maintain two parallel tables (Dependencies vs Interactions with Other Systems) that have drifted apart; a single source-of-truth table per GDD would eliminate ~14 of the 31 asymmetries. **This is the "two sources of truth" problem — resolve ASAP as a cross-GDD table normalization pass.**

#### CW2 — "grid display" residuals in Grid & Start + UI Menu (rename incomplete)
- `grid-start.md:90` ("pre-generated before grid display"), `:111` ("Grid display, countdown, perfect start indicator"), `:152` (Dependencies), `:165` ("Grid display duration"), `:169` ("**Grid display:** Full grid with positions, names, and times"), `:194` ("Grid display camera angle")
- `ui-menu.md:173` ("Grid display duration" knob)
- Note: systems-index.md:134/:136 records this rename as "verified complete" — contradicted by current files. The design-review pass on 01/08 checked "Grid Display" (capitalized, the old screen name) but missed lowercase descriptive occurrences.
- Canonical name is "Qualifying Results" per ui-menu/RSM/ADR-0013. Lines 111/152 describe HUD output (acceptable as-is or reword); lines 90/165/169/194 + ui-menu:173 refer to the screen and must be renamed.

#### CW3 — global_max_velocity attributed to Car Definition Data but not a field there
- `vfx.md:168`: "global_max_velocity = max(all car top speeds) from Car Definition Data" and `vfx.md:210` (Dependencies row)
- `car-definition-data.md:190-200` defines per-car `max_velocity = min + (stat/20) × (max−min)` with max 310 — **no global field**
- The value exists only as a global constant in `design/registry/entities.yaml` (global_max_velocity ~310 km/h). Fix: either add the global to CarDef or reword VFX to "computed at runtime from all car max_velocity values".

#### CW4 — engine_type string residual (removed field)
- `audio-system.md:280` and Interactions:226: "Car Definition Data | Inbound | cylinders, engine type"
- `car-definition-data.md:147`: "The engineType (string) field is **removed** — replaced by structured CarAudioProfile"
- `car-definition-data.md` is itself internally stale: `:164` (Interface Contract engine_type string) and `:383` (AC "engine_type is a non-empty project-defined identifier")
- Fix: remove engine_type from audio-system.md, car-definition-data.md:164/:383.

#### CW5 — hud.md internal element-count contradictions
- `hud.md:105`: "Full HUD (**7/4** elements)" vs `hud.md:43`: "8 elements in MVP" / `hud.md:57`: "8 persistent chase elements"
- `hud.md:103`: "Timer-focused (**3** elements)" and `hud.md:241`: "the three-element Qualifying HUD" vs `hud.md:84` states table (Speed, Position, Lap, Lap Time = 4)
- Residual from the 01/08 re-review — two spots missed.

#### CW6 — Ownership soft conflicts
- **1.10× pit margin circular citation**: `pit-stop.md:81` ("The 1.10× margin is owned by AI Rival") ↔ `ai-rival.md:273` ("Pit Stop's formula applies the 1.10 multiplier"). Value consistent; ownership ambiguous. Registry registers two separate formulas (player_pit_advisory and pit_required_before_next_lap) both using 1.10. Recommend a single explicit owner note.
- **Grip floor knob safe range contradicts own constraint**: `tire-system.md:159`: "grip_floor … 0.20 … Must be ≥ 0.20 (VP effective_grip floor); values below 0.20 are silently overridden" vs `tire-system.md:194` Tuning knob: "Grip floor | 0.20 | **0.10–0.30**". The knob advertises values the same doc says are overridden by the VP clamp (vehicle-physics.md:234/:245/:255, clamp(…, 0.20, 1.20)). Knob range must be 0.20–0.30 or the override rule must change.

#### CW7 — Divergent tire_wear_rate formula copies
- `vehicle-physics.md:230`: "tire_wear_rate = base_rate × distance_factor × aggression × surface_penalty × efficiency_modifier" (no compound term)
- `tire-system.md:135`: includes "× **wearRateMultiplier**" (1.0 MVP, tire-system.md:81/:145)
- Numerically identical at 1.0, but two docs state different formulas for the same owned formula. Tire System owns it; VP must cite it verbatim.

---

## Game Design Issues

### Blocking

None. All findings below are warnings requiring design judgment, not architecture blockers.

### Warnings

#### DW1 — Car-selection freedom vs "start on Zeroforce" (requires design decision)
- `ui-menu.md:62` and `:84-90`: Car Selection among all 16 teams; `ai-rival.md:164`: "the player's selected team is excluded from AI control"
- `game-concept.md:291`: "Player starts on Zeroforce (slowest team)"; `game-concept.md:248`: "The player experiences different tiers by racing against them, not by driving for them."
- Either car choice is free (then "Earn the Next Seat" is hollow and players self-select team_tier1_a) or locked to Zeroforce (then ui-menu.md and ai-rival.md:164 are wrong). **MVP behavior depends on which doc wins — decision required.**

#### DW2 — AI pit asymmetry: player always waits less
- `pit-stop.md:56-57`, `:65`, `:77`: player may exit after the 2s tire swap with partial fuel; **AI always waits for a full 8L tank** (`pit-stop.md:57`, `:65`, `:77`; `ai-rival.md:125`)
- Player saves ~3-8s of service time per stop, systematically and risk-free — undermines AI pressure at higher tiers. Fix options: AI partial-fuel early exit, or make the player's early exit cost more.

#### DW3 — Qualifying skip == fail: no participation incentive
- `qualifying.md:86-98`: skipping and failing both produce P16 with no retry
- `game-concept.md:280`: "the race itself is always winnable from the back"
- A time-minimizing player always skips — qualifying becomes dead content for that segment. Not a win exploit (P16 winnable), but a participation incentive gap. Fix options: differentiate failure penalty or add qualifying-specific reward.

#### DW4 — Very Hard asymmetric physics vs AI baselines
- `vehicle-physics.md:247` (off-track grip 0.25 at Very Hard), `:299` (wall speed-loss 0.60 at Very Hard) — player scales with difficulty
- AI always uses Normal baselines 0.40/0.40 (`vehicle-physics.md:298-299`, track-system.md:92)
- At Very Hard the player is more fragile than the AI on top of 0-error AI (`ai-rival.md:151`). Borders the "not punitive" anti-pillar (game-concept.md:66, :190). Requires validation of Very Hard against game-concept.md:334.

#### DW5 — Tier-gap benchmark undefined + qualifying modifier not derived from in-race stats
- `ai-rival.md:153`: Tier Gap is "an integrated benchmark target, not a direct car-stat multiplier"; DifficultyProfile gaps 5/15/25/40/60% with no stated mechanism
- `qualifying.md:82`: tier modifier 1.00/1.015/1.035/1.055 (5.5% spread) while in-race pace comes from car stats (top speed spread ~3.9%)
- The grid and the race can disagree about who is fast. Define how "tier gap" is measured and verify the two curves compose.

#### DW6 — Tire "aggression as weapon" may be dominated by clean driving
- `tire-system.md:135-146` + `game-concept.md:70-74`: aggressive/slide playstyle is slower AND wears more
- Base wear rate is still "playtesting" (`tire-system.md:191`), so dominance cannot be ruled out until tuned. Ensure aggressive cornering yields lap-time gain exceeding late-race grip cost.

#### DW7 — Attention convergence on laps 3-4 (5-lap race)
- Fuel critical (~148s for Eff 4, ~267s for Eff 20) and tire degradation ("significantly harder" lap 4-5) cross decision thresholds in the same window (fuel-system.md:154-161, tire-system.md:67-74, game-concept.md:272)
- Mitigations exist (one-stop consolidation, audio cues), but this is the tightest attention budget point. Recommendation: ensure fuel and tire critical points are offset per track length.

---

## Cross-System Scenario Issues

Scenarios walked: 5
1. Pit stop with PIT THIS LAP advisory
2. Countdown → GO with Perfect Start
3. Forfeit during pause in Countdown
4. Qualifying → Grid → Race with 16 cars
5. Laps 3-4 attention convergence

### Blockers
None.

### Warnings
- ⚠️ **Scenario 1 — Pit Stop** [PitStop/Fuel/Tire/RSM/HUD/Audio]: player/AI service asymmetry (DW2) makes the player's pit stop strictly cheaper; final-lap sting collides with finish sting when the final lap begins (CB1).
- ⚠️ **Scenario 4 — Qualifying → Grid** [Qualifying/RSM/ContentPipeline/GridStart]: qualifying skip == fail (DW3) removes participation incentive; spawn model divergence GDD (pit-exit) vs ADR-0013 Proposed (pit-box + out-lap) is unresolved — registered for propagate-design-change after architecture review.
- ⚠️ **Scenario 5 — Attention convergence** [Fuel/Tire/Pit/RSM/HUD]: 6 simultaneously active systems at laps 3-4; design-count of 4 decision categories holds but the tightest budget point (DW7).

### Info
- ℹ️ **Scenario 2 — Countdown/GO** [GridStart/Input/Simulation/VP]: verified consistent (300 ticks, EMA freeze, Perfect Start thresholds, 1.15× for 600 ticks).
- ℹ️ **Scenario 3 — Forfeit** [Input/Pause/RSM/Simulation/UI]: verified consistent (forfeit classification, no simulation resume, ghost buffer discard).

---

## GDDs Flagged for Revision

| GDD | Reason | Type | Priority |
|-----|--------|------|----------|
| audio-system.md | Final-lap sting trigger conflicts with RSM (CB1); engine_type residual (CW4); asymmetry edges 12/14/16/17/20/21 | Consistency | Blocking (CB1) |
| vehicle-physics.md | AC-R1 fuel math wrong (CB2); tire_wear_rate copy diverges (CW7); asymmetry 7/13 | Consistency | Blocking (CB2) |
| settings.md | "seven Chase elements" (CB3); asymmetry 15 | Consistency | Blocking (CB3) |
| hud.md | Internal 7/4 and 3-vs-4 element counts (CW5); asymmetry 4/11 | Consistency | Warning |
| grid-start.md | "grid display" residuals (CW2); asymmetries 4/14 | Consistency | Warning |
| ui-menu.md | "grid display duration" residual (CW2); asymmetry 2/10/16 | Consistency | Warning |
| car-definition-data.md | engine_type residual internal (CW4); asymmetries 5/6/8/9 | Consistency | Warning |
| vfx.md | global_max_velocity attribution (CW3); asymmetry 6/23 | Consistency | Warning |
| tire-system.md | Grip floor knob range (CW6); tire_wear_rate divergence (CW7); asymmetries 21/22/23/24/28 | Consistency | Warning |
| pit-stop.md | 1.10 ownership circular (CW6); AI full-tank wait (DW2); asymmetry 25/26 | Design + Consistency | Warning |
| ai-rival.md | 1.10 ownership circular (CW6); tier gap undefined (DW5); asymmetry 29 | Design | Warning |
| qualifying.md | Skip == fail (DW3); spawn model divergence vs ADR-0013 (pending); asymmetries 11/18/24/25/27/30 | Design | Warning |
| race-session-manager.md | Asymmetries 9/10/12/13/28 | Consistency | Warning |
| track-system.md | Asymmetries 1/3/17/22 | Consistency | Warning |
| camera.md | Asymmetries 1/2 | Consistency | Warning |
| fuel-system.md | Asymmetries 3/18/19/20/28 | Consistency | Warning |
| input-system.md | Asymmetry 26/27/31 | Consistency | Warning |

---

## Verdict: **CONCERNS**

No blocking design issues; 3 blocking consistency issues (CB1-CB3) are simple edits. The dependency-table normalization (CW1, "two sources of truth") is the largest structural debt and should be resolved as a dedicated cross-GDD pass before stories are created. DW1 (car selection vs Zeroforce) requires a design decision. CB1-CB3, CW2, CW4, CW5 are quick fixes.

### Required before re-running or proceeding:
1. ~~Fix CB1 (audio-system.md:159), CB2 (vehicle-physics.md:353), CB3 (settings.md:303/:377)~~ — **RESOLVED 01/08**
2. ~~Complete the rename residuals: grid-start.md (4 spots), ui-menu.md:173~~ — **RESOLVED 01/08**
3. ~~Resolve DW1 (car selection freedom vs Zeroforce)~~ — **RESOLVED 01/08: Single Race = free car choice; Career (Alpha) starts on Zeroforce**
4. ~~Normalize Dependencies vs Interactions tables across all GDDs (CW1)~~ — **RESOLVED 01/08: 25 rows added across 14 GDDs**
5. ~~Fix CW2-CW7 residuals~~ — **RESOLVED 01/08**
6. DW2: **KEPT as designed** (player early-exit advantage is intentional accessibility)
7. DW3: **KEPT as designed** (skip == fail == P16)
8. DW4 (Very Hard physics), DW5 (tier gap benchmark), DW6 (tire aggression), DW7 (attention convergence): **deferred to playtest** — no design change now; validate against game-concept.md:334
