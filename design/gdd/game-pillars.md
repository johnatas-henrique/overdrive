# Game Pillars: Overdrive

## Document Status

- **Version**: 1.0
- **Last Updated**: 2026-06-22
- **Approved By**: creative-director
- **Status**: Draft

---

## What Are Game Pillars?

Pillars are the 3-5 non-negotiable principles that define this game's identity.
Every design, art, audio, narrative, and technical decision must serve at least
one pillar. If a feature doesn't serve a pillar, it doesn't belong in the game.

**Why pillars matter**: In a typical development cycle, the team makes thousands
of small creative decisions. Pillars ensure all those decisions push in the same
direction, creating a coherent player experience rather than a collection of
disconnected features.

### What Makes a Good Pillar

A good pillar is:

- **Falsifiable**: "Fun gameplay" is not a pillar. "Combat rewards patience over
  aggression" is — it makes a testable claim about design choices.
- **Constraining**: If a pillar never forces you to say no to something, it's
  too vague. Good pillars eliminate options.
- **Cross-departmental**: A pillar that only constrains game design but says
  nothing about art, audio, or narrative is incomplete. Real pillars shape
  every discipline.
- **Memorable**: The team should be able to recite the pillars from memory.
  If they can't, the pillars are too numerous or too complex.

---

## Core Fantasy

You are an F1 driver rising through the grid — every rival has a personality you can read from their driving, every pit stop is a strategic gamble, and every season earns you a shot at a better team.

---

## Target MDA Aesthetics

| Rank | Aesthetic      | How Our Game Delivers It                                                                  |
| ---- | -------------- | ----------------------------------------------------------------------------------------- |
| 1    | **Sensation**  | Cockpit FOV pulse, arcade-grip physics, speed lines, camera shake — "speed that is felt"  |
| 2    | **Challenge**  | Fuel/tire strategy choices, overtaking 7 distinct AI personalities, pit window decisions  |
| 3    | **Fantasy**    | You are an F1 driver fighting through the grid — helmet, team livery, rival personalities |
| 4    | **Discovery**  | Learning each rival's driving patterns, finding the optimal car-track setup combination   |
| 5    | **Expression** | Pit strategy and upgrade path reflect your playstyle — aggressive vs conservative         |
| N/A  | Narrative      | Prologue-style career arc in v1.0 — not a focus in Phase 1                                |
| N/A  | Fellowship     | Single-player only (multiplayer considered for future title)                              |
| N/A  | Submission     | Intentionally not meditative — arcade pacing demands attention                            |

**Aesthetics reference** (Hunicke, LeBlanc, Zubek):

- **Sensation**: Sensory pleasure (visual beauty, satisfying audio, haptic feedback)
- **Fantasy**: Make-believe, inhabiting a role or world
- **Narrative**: Drama, story arcs, emotional plot progression
- **Challenge**: Obstacle course, skill mastery, overcoming difficulty
- **Fellowship**: Social connection, cooperation, shared experience
- **Discovery**: Exploration, uncovering secrets, understanding hidden systems
- **Expression**: Self-expression, creativity, personal identity
- **Submission**: Relaxation, comfort, meditative play

---

## The Pillars

### Pillar 1: Speed That Is Felt

**One-Sentence Definition**: The primary sensory promise of the game is the visceral experience of velocity — cockpit camera as default, arcade-grip physics where the car sticks to the road, and visual/audio cues that make every km/h feel earned.

**Target Aesthetics Served**: Sensation (primary), Challenge (secondary)

**Design Test**: If we're debating between a realistic physics tweak and one that makes the car feel faster at the same speed, we choose the one that feels faster.

#### What This Means for Each Department

| Department      | This Pillar Says...                                                                                                                                      | Example                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Game Design** | Physics prioritises grip → lift-to-turn over braking; no weight transfer simulation; speedometer is prominent; tracks have straights that reward courage | Monza-style long straight where lift-off at the right moment defines the lap |
| **Art**         | Cockpit dashboard is detailed; trackside objects blur past convincingly; particle effects at high speed (tarmac texture, light trails)                   | Speed lines on straightaways, subtle FOV shift at high velocity              |
| **Audio**       | Engine pitch rises with RPM; wind noise increases with speed; tyre squeal begins at the edge of grip                                                     | Distinct gear-shift sound per car class; Doppler effect on trackside objects |
| **Engineering** | Fixed-step physics at minimum 60 Hz; camera system with automatic FOV adjustment based on speed; zero input lag                                          | Physics update decoupled from render frame rate                              |

#### Serving This Pillar

- Cockpit camera as default view (toggle to chase)
- Arcade-grip handling model — car does not drift; lift-off oversteer is the primary turning technique
- Sense-of-speed effects: FOV pulse, camera shake on kerbs, speed lines, particle trails
- F1 reference for speed sensation (1992 Williams FW14B onboard footage as benchmark)

#### Violating This Pillar

- Simulation weight transfer, tire temperature, or ERS management
- Drift-focused handling model (initial release — revisit only if gameplay testing demands it)

---

### Pillar 2: Simple Strategy, Real Decisions

**One-Sentence Definition**: Fuel consumption and tire wear create a meaningful strategic layer without simulation complexity — every pit stop choice changes the race outcome.

**Target Aesthetics Served**: Challenge (primary)

**Design Test**: If a strategy option adds a meaningful choice with visible consequences in a 5-minute race, keep it. If it adds a slider to tweak, remove it.

#### What This Means for Each Department

| Department      | This Pillar Says...                                                                                            | Example                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Game Design** | Two strategic resources (fuel + tires); conservative vs aggressive pit window; no tyre compound choice, no ERS | 5-lap race where you decide: pit lap 2 for fresh tires OR stretch to lap 4 with worn rubber |
| **Art**         | Visual tire wear (tread pattern fading); fuel gauge on HUD; pit stop animation shows crew                      | Dashboard fuel bar decreases; visible tire deformation at low grip                          |
| **Audio**       | Tire screech intensifies as wear increases; engine note changes under fuel load                                | Distinct "graining" sound vs fresh tire grip                                                |
| **Engineering** | Tire model with grip vs wear decoupled; fuel consumption per lap consistent per track per setup                | Wear accumulates per corner based on lateral load                                           |

#### Serving This Pillar

- Fuel: conservative = fewer stops, slower laps vs aggressive = more stops, faster laps
- Tires: wear affects cornering grip; pushing costs 0.5s/lap but buys track position
- Pit delta: pit lane time penalty large enough that 2-stop vs 3-stop is a real trade-off

#### Violating This Pillar

- Tire temperature simulation, compound choice, or tyre blankets
- ERS harvesting/deployment modes
- Suspension tuning, camber, or gear ratios

---

### Pillar 3: Racing Is Progression

**One-Sentence Definition**: Every race serves a purpose — win to earn credits for car parts, accumulate XP for crew upgrades, climb the championship standings, and advance through the content tiers.

**Target Aesthetics Served**: Challenge (primary), Expression (secondary)

**Design Test**: Before adding any content, ask "does this contribute to at least one progression path?" If not, defer.

#### What This Means for Each Department

| Department      | This Pillar Says...                                                                                                                                            | Example                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Game Design** | Dual economy: Credits → car parts (motor/aero/brakes/gearbox, each 1-5), XP → crew (pit speed, engineer, strategist); no pilot stats (player controls the car) | Win = 500cr + 200xp, upgrade motor to level 2 costs 1200cr + 300xp                                          |
| **Art**         | Crew shown in pit lane UI; upgrades are stat-only — car design is fixed per team and changes only when the player switches teams                               | Team livery consistency across all upgrade levels; stat bars show upgrade level instead of visual car parts |
| **Narrative**   | Championship standing is the story; History mode (v1.0) layers narrative on top of progression                                                                 | Rising from backmarker to champion across multiple seasons creates a natural story arc                      |
| **Engineering** | Data-driven stat tables for parts; save/load championship state between sessions; XP/credit balance as JSON config                                             | Upgrade costs, XP gains, stat curves externalised to config files                                           |

#### Serving This Pillar

- Car parts: Motor (top speed), Aero (cornering grip), Brakes (stopping power), Gearbox (acceleration)
- Crew upgrades: Faster pit stops (3.5s → 1.5s), Race engineer (fuel consumption optimisation), Strategist (pit window recommendations)
- Every race pays out credits + XP proportional to finishing position and AI difficulty

#### Violating This Pillar

- Pilot stat upgrades (reflex, consistency, overtaking) — player controls the car, not a character sheet
- Cosmetic-only upgrades that don't affect performance
- Grind walls where the only way forward is repeating the same race

---

### Pillar 4: Grid of Personalities

**One-Sentence Definition**: Every rival driver has a distinct, recognisable driving style that reflects their character — aggressive closes lines, consistent rarely errs, impulsive is fast but cracks under pressure, defensive protects the racing line stubbornly.

**Target Aesthetics Served**: Fantasy (primary), Discovery (secondary)

**Design Test**: If two rival AI routines produce behavior that feels interchangeable, one of them is redundant. If a player can't name a rival's personality trait after one race, the personality is too subtle.

#### What This Means for Each Department

| Department      | This Pillar Says...                                                                                                                                    | Example                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Game Design** | AI behaviour matrix: aggressiveness (0-1), consistency (0-1), defensive-ness (0-1), error rate (0-1) per rival; overtaking difficulty varies per rival | Macklen (Senna): dominant, reference of the grid. Willard (Mansell): as fast as Macklen but makes errors. Jordash (de Cesaris): fastest corner speed but spins under pressure |
| **Art**         | Team livery + helmet design + car number identify each driver at 300 km/h                                                                              | Driver recognised by helmet colour silhouette in cockpit, not face or unique car                                                                                              |
| **Narrative**   | Pre-race flavour text hints at rival's mood/strategy; post-race rival reactions vary by personality; paddock dialogue (v1.0)                           | "Willard was fastest in practice — watch his rear wing under braking"                                                                                                         |
| **Engineering** | AI driving line with per-corner aggression modifier; error injection system for mistakes (brake too late, miss apex)                                   | Rival AI uses same physics model as player with different parameter profiles                                                                                                  |

#### Serving This Pillar

- 8 teams (1 driver each for launch), each with a distinct personality-driver-style pairing
- Driver identity = helmet + number + behaviour (not unique car per driver)
- Car identity = team livery (two drivers from same team share identical car colours)
- Post-race results screen shows rival reaction text based on personality + finishing position

#### Violating This Pillar

- Rivals that are just "same AI, different car colour"
- Rivals that rubber-band (catch-up logic in place of personality)
- Generic driver names without personality context

---

## Anti-Pillars (What This Game Is NOT)

Great anti-pillars are things the team might actually want to do. "NOT a racing game" is obvious and useless. The statements below protect the pillars from plausible scope creep.

- **NOT a simulator**: No suspension setup, tire temperature, ERS modes, or fuel mixture. Keeping strategic depth with minimum complexity is the goal.
- **NOT an open world**: No free-roam exploration, no Forza Horizon-style map. Paddock menu system for upgrades and race selection only. (History mode in v1.0 may revisit this.)
- **NOT punitive difficulty**: A normal player should be able to win races on normal difficulty without memorising every braking point. Difficulty comes from strategic choices, not pixel-perfect driving requirements.
- **NOT combat or violence**: Racing is the confrontation. No weapons, no destruction derby, no intentional wrecking. Rub rail-to-rail is fine; punt-to-pass is not.

---

## Pillar Conflict Resolution

When two pillars conflict (and they will), use this priority order.

| Priority | Pillar                              | Rationale                                                                                                                                      |
| -------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | **Speed That Is Felt**              | The sensory promise is the reason anyone buys the game. All other pillars serve this one ultimately.                                           |
| 2        | **Racing Is Progression**           | Without meaningful growth, the game has no longevity. Must be in tension with Speed (faster car = easier to win).                              |
| 3        | **Simple Strategy, Real Decisions** | Strategic depth separates this from pure arcade. But never at the cost of feel — a strategy screen that breaks flow is worse than no strategy. |
| 4        | **Grid of Personalities**           | The human layer that makes rival encounters memorable. Can be partially sacrificed for launch scope (7 rivals minimum).                        |

**Resolution Process**:

1. Identify which pillars are in tension
2. Consult the priority ranking above
3. If the lower-priority pillar can be served partially without compromising the higher-priority one, do so
4. If not, the higher-priority pillar wins
5. Document the decision and rationale in the relevant design document
6. If the conflict is fundamental (two pillars are irreconcilable), escalate to the creative-director to consider revising the pillars themselves

---

## Player Motivation Alignment

| Need                                                    | Which Pillar Serves It                     | How                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Autonomy** (meaningful choice, player agency)         | Simple Strategy + Racing Is Progression    | Choose aggressive vs conservative pit strategy; choose which part to upgrade; choose which championship event to run next                |
| **Competence** (mastery, skill growth, clear feedback)  | Speed That Is Felt + Racing Is Progression | Mastery of the grip physics shows in lap times; visible upgrade progression; skill ceiling in finding the perfect line per car per track |
| **Relatedness** (connection, belonging, emotional bond) | Grid of Personalities                      | Rival personalities create a social layer even in single-player; you learn who to respect, who to fear, who to bait into a mistake       |

**Gap check**: All three SDT needs are served by at least one pillar.

---

## Emotional Arc

### Session Emotional Arc

#### MVP (Single Race, ~5 minutes)

| Phase      | Duration  | Target Emotion | Pillar(s) Driving It                    | Mechanics Delivering It                                       |
| ---------- | --------- | -------------- | --------------------------------------- | ------------------------------------------------------------- |
| Opening    | 0-15s     | Anticipation   | Speed That Is Felt                      | Grid cinematic, countdown lights, engine revving              |
| Rising     | 15s-3min  | Focus          | Speed That Is Felt + Simple Strategy    | First corners, overtaking, reading rivals, managing fuel/tire |
| Climax     | 3-5min    | Tension        | Simple Strategy + Racing Is Progression | Final lap battles, pit window decision, position fights       |
| Resolution | +30s      | Satisfaction   | Racing Is Progression                   | Checkered flag, results screen, upgrade currency earned       |
| Hook       | Post-race | "One more"     | Racing Is Progression                   | See upgrade cost, next race available immediately             |

#### Full Product (Championship Weekend, 3-5 races, 30-120 min)

| Phase      | Duration          | Target Emotion       | Pillar(s) Driving It                    | Mechanics Delivering It                           |
| ---------- | ----------------- | -------------------- | --------------------------------------- | ------------------------------------------------- |
| Opening    | Race 1            | Optimism             | Racing Is Progression                   | First race of weekend, drivers on same tires/fuel |
| Rising     | Races 2-3         | Ambition             | Grid of Personalities                   | Rivalries develop, championship picture emerging  |
| Climax     | Race 4 (or final) | Urgency              | Simple Strategy + Grid of Personalities | Pit strategy matters for points; rival grudges    |
| Resolution | Post-race         | Pride or frustration | Racing Is Progression                   | Points total, upgrade purchases, team offers      |
| Hook       | End of weekend    | Long-term goal       | Racing Is Progression                   | "Next weekend I can unlock level 3 aero"          |

#### Alpha — Championship Mode

| Delivery  | What Changes                                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| **MVP**   | Single race only. Session arc covers one race. Hook is "I can beat my time / try a different strategy."                |
| **Alpha** | Championship mode (4 races). Session arc spans a weekend. Hook becomes "I need to score more points in the next race." |
| **v1.0**  | Full multi-season championship (16 races). Session arc per weekend, with long-term arc across seasons.                 |

### Long-Term Emotional Progression

| Phase          | Target Emotion           | Scope         | Player Experience                                                                                                                           |
| -------------- | ------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Early game** | Discovery                | **MVP**       | Learning tracks, rival personalities, and basic strategy. Just trying to finish. Every race teaches something new.                          |
| **Mid game**   | Mastery                  | **Alpha**     | Championship battles, upgrade decisions take shape. Player develops favourite car/track combos. Switching teams opens new tactical options. |
| **Late game**  | Triumph                  | **v1.0**      | Title defence season. Player has mastered at least one car. Rivalries are personal. Every race has championship stakes.                     |
| **Endgame**    | Reflection + Competition | **Post-v1.0** | Free play, record chasing, community leaderboards. Player identity as "Overdrive veteran." New content keeps the grid fresh.                |

---

## Reference Games

| Reference                                     | What We Take From It                                                                      | What We Do Differently                                                                          | Which Pillar It Validates                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Super Monaco GP**                           | Arcade grip handling; cockpit-forward perspective; accessible controls                    | Fuel/tires create real strategic layer; no tyre compound choice                                 | Pillar 1 (Speed That Is Felt), Pillar 2 (Simple Strategy)       |
| **Horizon Chase Turbo**                       | Bold colour palette; sense of speed; stylized environments                                | Cockpit default (not chase); single-seat formula cars (not sports cars)                         | Pillar 1 (Speed That Is Felt)                                   |
| **4PGP**                                      | Modern take on 90s arcade formula racing; simplified cockpit view; instant-action pacing  | Progression system (upgrades + crew + team switching); rival personalities                      | Pillar 1 (Speed That Is Felt), Pillar 3 (Racing Is Progression) |
| **Top Gear**                                  | Long-distance race feel; car upgrade between races (SNES era); music-driven pacing        | Real F1 context; distinct AI personalities; pit strategy with consequences                      | Pillar 3 (Racing Is Progression)                                |
| **Nigel Mansell's World Championship Racing** | Licensed F1 atmosphere; 1992 season structure; pit stop mechanics (mandatory tyre change) | Arcade feel over simulation; no setup screen (downforce/gears); simpler pit = fuel only + tyres | Pillar 2 (Simple Strategy), Pillar 4 (Grid of Personalities)    |
| **Vroom**                                     | Pure arcade speed; simple controls; fast cornering feel                                   | Strategic depth separates us; AI personalities add replayability                                | Pillar 1 (Speed That Is Felt)                                   |

**Non-game inspirations**: Williams FW14B (1992) — onboard footage benchmark for cockpit camera positioning, FOV, and sense-of-speed reference. Real F1 telemetry data for engine note authenticity.

---

## Pillar Validation Checklist

Before finalizing the pillars, verify:

- [x] **Count**: 4 pillars (within 3-5 range)
- [ ] **Falsifiable**: Each pillar makes a claim that could be wrong
- [ ] **Constraining**: Each pillar forces saying "no" to some plausible ideas
- [x] **Cross-departmental**: Each pillar has implications for design, art, audio, narrative, AND engineering
- [ ] **Design-tested**: Each pillar has a concrete design test that resolves a real decision
- [x] **Anti-pillars defined**: 4 explicit "this game is NOT" statements
- [x] **Priority-ranked**: Clear order for resolving conflicts between pillars
- [x] **MDA-aligned**: Pillars collectively deliver the top-ranked target aesthetics
- [x] **SDT coverage**: Autonomy, Competence, and Relatedness all served
- [ ] **Memorable**: The team can recite all pillars from memory
- [x] **Core fantasy served**: "You are an F1 driver rising through the grid..."

---

## Next Steps

- [x] Core Fantasy chosen (A)
- [ ] Get pillar approval from creative-director
- [ ] Distribute to all department leads for sign-off
- [ ] Schedule first pillar review (after 2 weeks of development)

---

_This document is the creative north star. It lives in `design/gdd/game-pillars.md`
and is referenced by every design, art, audio, and narrative document in the project.
Review quarterly or after major milestone pivots._
