# Game Concept: Overdrive

*Created: 2026-06-16*
*Updated: 2026-06-17 (SMGP-style single championship, team-based upgrade ceiling)*
*Status: Draft*

---

## Elevator Pitch

> An arcade F1 racing-RPG hybrid where every race is a "battle." Start at the back of the grid with a backmarker team (Lorris) and fight your way to the world championship across multiple seasons — managing fuel, tires, and pit strategy — while upgrading your car and crew through a dual progression economy, in a world where each rival's driving style reveals their personality. Switch teams to unlock higher upgrade ceilings: the top teams demand results, but only they can build a championship-winning car. No open world, no simulation complexity, no unfair difficulty — just the raw feeling of speed in cockpit view, with the option to pull back to chase cam and enjoy the ride.

---

## Core Identity

| Field | Value |
|---|---|
| **Working Title** | Overdrive |
| **Genre** | Arcade Racing-RPG Hybrid |
| **Engine** | Babylon.js 9.12.0 |
| **Target Platform** | Web (primary), PC via Tauri (stretch: consoles) |
| **Player Count** | Single-player (multiplayer planned for Tier 2) |
| **Estimated Scope** | Large (18–24 months, solo dev) |
| **Target Release Model** | Steam Early Access → Full 1.0 → Expansion |
| **Development Approach** | **F1 only:** single category. Content released in tiers (4, 8, 16 races), forming a single championship that the player races across multiple seasons until they win and defend the title. |
| **Progression Model** | Each team has a unique car with inherent base stats (top speed, cornering, acceleration, fuel efficiency, tire wear). Part upgrades modify these base stats. Backmarker teams (Lorris) have lower base stats AND a lower upgrade ceiling (level 3) — top teams (Macklen, Willard, Ferrell) have higher base stats AND a higher ceiling (level 5). Switching teams means getting a new car with a different character. |

---

## Core Fantasy & Unique Hook

**Core Fantasy**: You are a rookie driver joining a backmarker F1 team (Lorris). The established stars — Macklen, Willard, Ferrell — have years of experience, better cars, and no reason to respect you. Every race is a proving ground: climb the grid, earn upgrades, earn a better seat, and eventually challenge for the world championship. The paddock is your world: choose when to push, when to conserve, and how to spend your hard-earned credits.

**Unique Hook**: "Like Super Monaco GP and Horizon Chase Turbo, but every rival has a personality you can read from their driving — and your car and crew grow across seasons as you switch teams to chase higher upgrade ceilings." The fusion of **arcade racing controls** + **fuel/tire pit strategy** + **rival personalities** + **team-based progression** creates a loop that's accessible in 3-minute bursts but has depth over 30-hour campaigns.

---

## Product Pillars

### Pillar 1: Speed That Is Felt

**One-Sentence Definition**: The primary sensory promise of the game is the visceral experience of velocity — cockpit camera as default, arcade-grip physics where the car sticks to the road, and visual/audio cues that make every km/h feel earned.

**Target MDA Aesthetics Served**: Sensation (primary), Challenge (secondary)

**Design Test**: If we're debating between a realistic physics tweak and one that makes the car feel faster at the same speed, we choose the one that feels faster.

#### Department Implications

| Department | This Pillar Says... | Example |
|---|---|---|
| **Game Design** | Physics prioritises grip → lift-to-turn over braking; no weight transfer simulation; speedometer is prominent; tracks have straights that reward courage | Monza-style long straight where lift-off at the right moment defines the lap |
| **Art** | Cockpit dashboard is detailed; trackside objects blur past convincingly; particle effects at high speed (tarmac texture, light trails) | Speed lines on straightaways, subtle FOV shift at high velocity |
| **Audio** | Engine pitch rises with RPM; wind noise increases with speed; tyre squeal begins at the edge of grip | Distinct gear-shift sound per car class; Doppler effect on trackside objects |
| **Engineering** | Fixed-step physics at minimum 60 Hz; camera system with automatic FOV adjustment based on speed; zero input lag | Physics update decoupled from render frame rate |

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

**Target MDA Aesthetics Served**: Challenge (primary)

**Design Test**: If a strategy option adds a meaningful choice with visible consequences in a 5-minute race, keep it. If it adds a slider to tweak, remove it.

#### Department Implications

| Department | This Pillar Says... | Example |
|---|---|---|
| **Game Design** | Two strategic resources (fuel + tires); conservative vs aggressive pit window; no tyre compound choice, no ERS | 5-lap race where you decide: pit lap 2 for fresh tires OR stretch to lap 4 with worn rubber |
| **Art** | Visual tire wear (tread pattern fading); fuel gauge on HUD; pit stop animation shows crew | Dashboard fuel bar decreases; visible tire deformation at low grip |
| **Audio** | Tire screech intensifies as wear increases; engine note changes under fuel load | Distinct "graining" sound vs fresh tire grip |
| **Engineering** | Tire model with grip vs wear decoupled; fuel consumption per lap consistent per track per setup | Wear accumulates per corner based on lateral load |

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

**Target MDA Aesthetics Served**: Challenge (primary), Expression (secondary)

**Design Test**: Before adding any content, ask "does this contribute to at least one progression path?" If not, defer.

#### Department Implications

| Department | This Pillar Says... | Example |
|---|---|---|
| **Game Design** | Dual economy: Credits → car parts (motor/aero/brakes/gearbox, each 1-5), XP → crew (pit speed, engineer, strategist); no pilot stats (player controls the car) | Win = 500cr + 200xp, upgrade motor to level 2 costs 1200cr + 300xp |
| **Art** | Crew shown in pit lane UI; upgrades are stat-only — car design is fixed per team and changes only when the player switches teams | Team livery consistency across all upgrade levels; stat bars in dashboard show upgrade level instead of visual car parts |
| **Narrative** | Championship standing is the story; History mode (Tier 3) layers narrative on top of progression | Rising from backmarker to champion across multiple seasons creates a natural story arc |
| **Engineering** | Data-driven stat tables for parts; save/load championship state between sessions; XP/credit balance as JSON config | Upgrade costs, XP gains, stat curves externalised to config files |

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

**Target MDA Aesthetics Served**: Fantasy (primary), Discovery (secondary)

**Design Test**: If two rival AI routines produce behavior that feels interchangeable, one of them is redundant. If a player can't name a rival's personality trait after one race, the personality is too subtle.

#### Department Implications

| Department | This Pillar Says... | Example |
|---|---|---|
| **Game Design** | AI behaviour matrix: aggressiveness (0-1), consistency (0-1), defensive-ness (0-1), error rate (0-1) per rival; overtaking difficulty varies per rival | Macklen (Senna): dominant, reference of the grid. Willard (Mansell): as fast as Macklen but makes errors. Jordash (de Cesaris): fastest corner speed but spins under pressure |
| **Art** | Team livery + helmet design + car number identify each driver at 300 km/h | Driver recognised by helmet colour silhouette in cockpit, not face or unique car |
| **Narrative** | Pre-race flavour text hints at rival's mood/strategy; post-race rival reactions vary by personality; paddock dialogue (Tier 3) | "Willard was fastest in practice — watch his rear wing under braking" |
| **Engineering** | AI driving line with per-corner aggression modifier; error injection system for mistakes (brake too late, miss apex) | Rival AI uses same physics model as player with different parameter profiles |

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

## Anti-Pillars

- **NOT a simulator**: No suspension setup, tyre temperature, ERS modes, or fuel mixture. Keeping strategic depth with minimum complexity is the goal.
- **NOT an open world**: No free-roam exploration, no Forza Horizon-style map. Paddock menu system for upgrades and race selection only. (Revisit for History mode in Tier 3.)
- **NOT punitive difficulty**: A normal player should be able to win races on normal difficulty without memorising every braking point. Difficulty comes from strategic choices, not pixel-perfect driving requirements.
- **NOT combat or violence**: Racing is the confrontation. No weapons, no destruction derby, no intentional wrecking. Rub rail-to-rail is fine; punt-to-pass is not.

---

## Pillar Conflict Resolution

| Priority | Pillar | Rationale |
|---|---|---|
| 1 | Speed That Is Felt | The sensory promise is the reason anyone buys the game. All other pillars serve this one ultimately. |
| 2 | Racing Is Progression | Without meaningful growth, the game has no longevity. Must be in tension with Speed (faster car = easier to win). |
| 3 | Simple Strategy, Real Decisions | Strategic depth separates this from pure arcade. But never at the cost of feel — a strategy screen that breaks flow is worse than no strategy. |
| 4 | Grid of Personalities | The human layer that makes rival encounters memorable. Can be partially sacrificed for launch scope (7 rivals minimum). |

---

## Core Loop

### 30-Second Loop (Moment-to-Moment)

- **Input**: Steer, accelerate, brake (or lift-off), shift (automatic or manual)
- **Feedback**: Cockpit FOV pulse at speed, engine RPM climb, tyre squeal at grip limit, dash fuel gauge
- **Sensation**: Grip physics — car sticks to road, corners are taken via lift-off oversteer, no drift/wheel-spin model at launch
- **Decision**: Is my entry speed right? Do I lift or brake? Am I saving fuel or pushing?

### 5-Minute Loop (Per Race)

- Start at back (first race) or inverted from previous result
- Overtake 7 rivals with distinct driving personalities
- Manage fuel consumption and tire wear
- Decide pit window: aggressive (more stops, faster) vs conservative (fewer stops, slower)
- Cross the line: position determines credit + XP payout
- Post-race: see championship standings, upgrade car, next race

### Session Loop (30-120 Minutes)

- Natural stopping point: end of a championship weekend (3-5 races)
- Hook between sessions: "One more upgrade until my motor is level 3 — then I can win at Monza"
- Save-and-exit between races supported (portable gaming)

### Progression Loop (Seasons)

- **Single F1 championship**, multi-season structure
- Each season: race the championship (4/8/16 races depending on content tier)
- **Race results** → credits + XP + championship points
- **Credits** → Car parts (motor 1-5, aero 1-5, brakes 1-5, gearbox 1-5)
- **XP** → Crew upgrades (pit speed, engineer, strategist)
- **Each team has a unique car** with inherent base stats — a Macklen handles differently from a Ferrell, which handles differently from a Lorris. Part upgrades modify these base stats but the car's fundamental character stays recognisable.
- **Team upgrade ceiling**: different per team. Lorris caps at level 3, Macklen at level 5. You cannot make a Lorris as fast as a Macklen — you must earn the seat.
- **Team offers appear** based on championship performance — switching teams is the main progression gate
- **Car preference emerges naturally**: the player discovers which cars they enjoy driving most and works toward earning a seat in them
- **Win condition**: become world champion, then **defend the title** in the following season. Defending successfully = game credits
- **Post-credits**: free play mode, continue racing, chase records

---

## Player Motivation Profile

| Need | Served By | How |
|---|---|---|
| **Autonomy** | Simple Strategy pillar | Choose aggressive vs conservative pit strategy; choose which part to upgrade; choose which championship event to run next |
| **Competence** | Speed That Is Felt + Racing Is Progression | Mastery of the grip physics shows in lap times; visible upgrade progression; skill ceiling in finding the perfect line per car per track |
| **Relatedness** | Grid of Personalities | Rival personalities create a social layer even in single-player; you learn who to respect, who to fear, who to bait into a mistake |

### Bartle Type

- **Primary**: Competitor + Achiever (win races, climb categories, dominate the grid)
- **Secondary**: Explorer (tune cars, find the perfect setup per track-per-car combo)
- **Not for**: Socializers (no co-op, no trading); Killers (no combat mechanics)

---

## Visual Identity Anchor

**Direction Selected**: 3D Stylized Arcade (4PGP / Horizon Chase / Sunrise GP)

**One-Line Visual Rule**: Everything is colourful, stylized, and conveys speed at a glance — no realism, no grit, no bloom-overdose.

**Supporting Visual Principles**:
- Bold, saturated colour palette with high contrast between track, sky, and car
- Cockpit as primary view (detailed dash) with optional chase camera
- Environment stylisation: simplified architecture, geometric trees, gradient skies (4PGP / Horizon Chase style)
- UI is minimal, flat, and does not cover more than 15% of the screen during gameplay
- HUD: speedometer, fuel bar, tire wear indicator, position, lap counter

**F1 Reference**: Art direction references F1 1990–92 (Williams FW14B, McLaren MP4/6, Ferrari 641). All car silhouette, livery, and helmet designs are inspired by this era.

---

## Progression Economy

| Resource | Earned By | Spent On | Granularity |
|---|---|---|---|
| Credits | Race payout (position-based) | Car parts (motor, aero, brakes, gearbox) | 500-5000cr per race |
| XP | Race completion + position bonus | Crew upgrades (pit speed, engineer, strategist) | 100-500xp per race |

- Car parts: Levels 1-5, each level costs more credits + requires higher XP
- Crew: Pit speed (3.5s → 1.5s in 4 tiers), Engineer (fuel efficiency +5% per tier), Strategist (pit window recommendations unlock)

---

## F1 Grid (1991 Reference)

The game's 8-team grid is inspired by the 1991 F1 season. These 8 teams form the entire roster.

| Team (Parody) | Reference | Car № | Helmet Inspiration | Driving Personality |
|---|---|---|---|---|
| **Macklen** | McLaren 1991 | #1 | Senna — yellow + navy + green | Dominant — reference of the grid, does not make unforced errors |
| **Willard** | Williams 1991 | #5 | Mansell — blue + white diagonal | Lightning bolt — as fast as #1 but error-prone |
| **Ferrell** | Ferrari 1991 | #27 | Prost — white + multi-colour bands | Technical — smooth inputs, fast corner entry, rarefies errors |
| **Bennett** | Benetton 1991 | #20 | Piquet — white + blue/red stripes | Consistent — clean line, hard to pass, no gifts |
| **Jordash** | Jordan 1991 | #33 | de Cesaris — white + green/blue V | Impulsive — fastest in corners, spins under pressure |
| **Tyrant** | Tyrrell 1991 | #3 | Nakajima — white + red circle | Defensive — stubborn line blocker, not a win threat |
| **Lorris** 🎮 | Lotus 1991 | #11 | Häkkinen — silver/white + diagonal bands | Rookie — fast when confident, erratic when not |
| **Layton Hall** | Leyton House 1991 | #16 | Capelli — red + turquoise band | Aggressive — limit driver, 50% brilliant, 50% contact |

> 🎮 = Player team in Phase 1. The player occupies the #11 Lorris seat as the team's sole driver. The #11 car on track is always the player. No AI drives #11.

---

## Championship Structure

### Format

- A single F1 championship. No divisions to unlock.
- The championship length grows with content releases:
  - **Early Access**: 4 races (4 tracks)
  - **1.0 Release**: 8 races (8 tracks)
  - **Expansion**: 16 races (full 1991 season calendar)
- Each race weekend: qualifying-free, inverted grid from previous race result
- Points system: standard F1 scoring (10 for 1st, 6 for 2nd, 4 for 3rd, 3, 2, 1)

### Multi-Season & Victory Condition

- The player races **as many seasons as needed** to win the world championship
- Between seasons: championship resets, but car upgrades, crew upgrades, and team reputation carry over
- **Win the title** → unlock **Defend the Title** season
- **Defend successfully** → game credits roll (victory condition)
- After credits: free play mode (continue racing, chasing records, climbing leaderboards)

### Team Upgrade Ceiling

Each team has a unique car with inherent base stats AND a maximum upgrade level. A Macklen is faster than a Lorris even with zero upgrades — the ceiling difference means you can never fully close that gap by upgrading alone. You must earn the seat.

| Team Tier | Teams | Base Stat Character | Max Part Level | Max Crew Level |
|-----------|-------|-------------------|----------------|----------------|
| **Backmarker** | Lorris | Low in all areas, forgiving handling | 3 | 3 |
| **Midfield** | Bennett, Jordash, Tyrant, Layton Hall | Medium stats, each with one strength (e.g. Jordash corners well, Bennett is fuel-efficient) | 4 | 4 |
| **Top** | Macklen, Willard, Ferrell | High in all areas, each with a distinct edge (Macklen balanced, Willard top speed, Ferrell cornering) | 5 | 5 |

*A player at Lorris can upgrade, but the Lorris car will never match a Macklen. To build a championship-winning machine, you need a top-team seat — and to earn it, you must outperform the current driver.*

### Team Switching

- After strong performances (podiums, consistent top-5 finishes), **team offers** appear
- Offers come from teams one tier above current performance level
- Player may accept, decline, or wait for a better offer
- Switching teams resets car upgrade progress (new car, new parts to level) but **crew XP carries over**
- The player's previous team reputation affects future offers from that team
- Each team's car has a unique feel — the player develops preferences and works toward the car they want
- In Phase 2 (16-car grid): the player can also leave Lorris for one of 3 specialist backmarker teams (top speed, cornering, or fuel/tire efficiency) instead of climbing the traditional ladder

---

## Grid Evolution (Phase 1 → Phase 2)

### Phase 1 (Early Access — 4 races, single championship)

- **8 teams, 1 driver each = 8 cars on grid**
- Player occupies **Lorris (#11)** as the team's sole driver
- 7 AI rivals with distinct personalities
- Grid size balanced for first-time arcade racer: enough variety, not overwhelming
- No team switching yet — player learns the loop at Lorris

### Phase 2 (1.0 — 8 races, team switching)

- **8 teams, 2 drivers each = 16 cars on grid**
- Each team gains a second driver with a complementary (or contrasting) personality
- **Team switching enabled**: player receives offers based on championship performance
- Player may also **switch from Lorris** to one of **3 backmarker teams** with specialisations:
  - A top-speed specialist
  - A cornering specialist
  - A fuel/tire efficiency specialist
- Upgrade ceiling system active: top teams require proven results to join
- Exact 3 starter teams and stats defined during GDD phase

### Why Phase First?

- Phase 1 lets the player learn 7 rival personalities in a manageable 8-car grid without the complexity of team management
- Phase 2 adds team-mate dynamics, switching strategy, and meaningful car choice without redesigning the roster
- 3 specialist backmarker cars create replay value: different playthroughs with different trade-offs

---

## Scope Tiers

| Tier | Grid | Content | Platform |
|---|---|---|---|
| **Tier 1 — Early Access** | 8 cars (7 AI + player at Lorris) | 4-race F1 championship, 4 tracks, car parts 1-3 (Lorris ceiling), fuel/tires/pits, 7 rival personalities, save/load, 3 difficulty levels (AI speed). Multiplayer architecture in place (backend offline). | Steam Early Access, Web demo |
| **Tier 2 — 1.0** | 16 cars (15 AI + player choice of 3 cars) | 8-race championship (4 new tracks = 8 total), upgrades 1-5 + crew, rain/night, **team switching**, upgrade ceilings per team, new driver per team, **online multiplayer**, leaderboards | Steam full launch |
| **Tier 3 — Expansion** | 16 cars + History | 16-race championship (8 new tracks = 16 total — full 1991 season), History mode (narrative campaign), replay system, workshop, "Defend the Title" victory condition | Steam DLC |

---

## Development Milestones (F1 Only)

```
Milestone 1 — Reference & Design (current)
  └── Art bible (cars, liveries, helmets, tracks)
  └── System design (physics, AI, economy)
  └── Track prototypes (4 circuits)

Milestone 2 — Early Access Build (4-race championship)
  └── 8 teams, 1 driver each. Player at Lorris (#11)
  └── 4 tracks, fuel/tires/pits
  └── Car parts 1-3 (Lorris ceiling = level 3)
  └── 7 AI rival personalities (Macklen → Layton Hall)
  └── Championship mode, multi-season (keep racing until win)
  └── Save/load between races
  └── 3 difficulty levels (AI speed: 80%/100%/120%)
  └── Multiplayer architecture in place (backend offline)
  └── Steam Early Access launch

Milestone 3 — 1.0 Build (8-race championship + team switching)
  └── Second driver per team (16 cars on grid)
  └── 4 new tracks (8 total)
  └── Parts 1-5 + crew upgrades
  └── Team switching: offers based on performance
  └── Upgrade ceiling per team (3 tiers: backmarker/midfield/top)
  └── Player can choose between Lorris and 3 specialist backmarker teams
  └── Rain/night variants
  └── Online multiplayer (lobby + race)
  └── Defend the Title victory condition
  └── Steam 1.0 launch

Milestone 4 — Expansion (16-race season + History)
  └── 8 new tracks (16 total — full 1991 season)
  └── History mode (narrative campaign)
  └── Replay system, workshop
  └── Post-credits free play
  └── Steam DLC
```

---

## MVP Definition

The minimum build to test "is the core loop fun?"

- 1 championship (4 races, single season)
- 1 car (Lorris, base stats)
- 4 tracks (faithful 1991 F1 circuit recreations): high-speed (Monza), technical forest (Spa), city (Monaco), elevation hillside (Interlagos)
- Fuel + tire simulation
- Pit stops (2 pit crews, different speeds)
- 7 rivals with distinct personalities (Macklen through Layton Hall)
- Credits payout system
- Upgrade 1 part to level 2
- Cockpit camera + chase camera toggle
- Save/exit between races
- 3 difficulty levels: Easy (AI at 80% speed), Normal (100%), Hard (120%)

**Difficulty Philosophy**: AI speed scales with difficulty, not AI error rate. On Easy, the player catches up because rivals are slower — not because they make more mistakes. This keeps the driving experience authentic (AI drives like AI, just at different pace) and lets the player feel progression through speed.

**Validation Criteria**: The player enjoys 5 consecutive races *without* an external goal telling them to. The "one more race" feeling appears naturally.

---

## Biggest Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Physics feel** — arcade grip is hard to tune: too sticky = boring, too slidey = frustrating | HIGH — core loop invalid | Iterate in prototype before any content production; test with 5 external players |
| **AI personalities** — same-engine AI may produce same-looking behaviour despite different params | HIGH — pillar 4 invalid | Build AI testing tool: record rival telemetry per personality, visualise deviation. If variance < 20%, redesign AI system |
| **Art pipeline** — 3D stylized still requires modelling, texturing, track building per circuit | MEDIUM — scope delay | Procedural track layout tool (spline-based); reuse modular environment assets across tracks; palette-swap liveries |
| **Multiplayer architecture** — adding after single-player is complete is a rewrite | MEDIUM — Tier 2 risk | Netcode layer from day 0: state container separates simulation from rendering; entity ownership model; replay system doubles as network sync validation |
| **F1 scope creep** — richest references may tempt feature bloat | MEDIUM — timeline risk | Strict pillar test: "Does this F1 feature serve an arcade racer or a simulator?" If simulator, cut. |

---

## MDA Aesthetics Ranking

| Rank | Aesthetic | How Overdrive Delivers It |
|---|---|---|
| 1 | **Sensation** | Cockpit camera + speed effects + engine audio + arcade grip — the primary "feel" is the product |
| 2 | **Challenge** | Overtaking 7 unique rivals, managing fuel/tires, pit window decisions, learning each track-car combo |
| 3 | **Fantasy** | Rising from backmarker to F1 champion; rival personalities create a living world feeling |
| 4 | **Narrative** | Championship standing is the default story; History mode (Tier 3) adds scripted narrative |
| 5 | **Discovery** | Learning each rival's AI pattern, finding the optimal setup per track, uncovering tuning synergies |
| — | Expression | Car upgrade choices express play style (top speed vs cornering vs acceleration) |
| — | Fellowship | Multiplayer in Tier 2 adds shared experience |
| — | Submission | Not targeted — game demands active attention |

---

## Reference Games

| Game | What We Take | Our Twist | Validates Pillar |
|---|---|---|---|
| **Grand Prix 2** | Reward feeling of a perfect lap; race strategy depth | Modernised UI, shorter races, grip physics | Speed That Is Felt, Simple Strategy |
| **Horizon Chase Turbo — Senna Forever** | Camera duality (cockpit + chase), sense of speed, vibrant palette | Rival personalities, deeper progression, pit strategy | Speed That Is Felt, Grid of Personalities |
| **4PGP** | Cockpit-focused arcade grip, retro 90s 3D feel | Fuel/tires, crew upgrades, championship tiers | Speed That Is Felt, Racing Is Progression |
| **Top Gear (SNES)** | Fuel management as strategic element; accessible arcade racing | Individual rival AI per driver, not just pack behaviour | Simple Strategy |
| **Super Monaco GP** | Career mode structure; parody team names with recognisable references | No quali — inverted grid from previous result keeps racing focus | Racing Is Progression |
| **Fire Emblem 4 / Warcraft 3** | Emotional weight of character-driven story beats | Translation: rivals + championship drama create emotional stakes (Tier 3 History mode) | Grid of Personalities |

---

## Suggested Next Steps

1. **Complete the Art Bible** — finish Sections 6-9 (Environment, UI/HUD, Asset Standards, Reference Catalog).
2. Run `/design-review design/gdd/game-concept.md` to validate concept completeness.
3. Decompose into individual systems with `/map-systems` — maps dependencies and priorities.
4. Author per-system GDDs with `/design-system` — guided, section-by-section GDD writing.
5. Plan the technical architecture with `/create-architecture`.
6. Prototype the riskiest system (physics feel) with `/prototype` — validate the core loop before full implementation.
