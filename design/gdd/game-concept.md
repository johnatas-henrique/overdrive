# Game Concept: Overdrive

*Created: 2026-07-19*
*Status: Approved — 2026-07-21 (3 review rounds, 14 blocking items resolved)*

## Core Identity

| Field | Value |
|---|---|
| Working Title | Overdrive |
| Genre | Arcade Racing |
| Engine | Unity 6000.3.19f1, URP 17.3.0 |
| Platforms | PC (Steam/Epic); Web/Browser in Alpha |
| Player Count | Single-player core; async multiplayer in Alpha; real-time multiplayer in Beta |
| Team | Solo developer initially; professional art support if the game proves viable |
| Estimated Scope | Large (18 months, solo) |
| Development Model | MVP first, then tiered content expansion |
| Camera | Cockpit as the primary fantasy; chase camera as an option |

## Elevator Pitch

An arcade racing game where a rookie driver starts in the slowest team on the grid and earns a path to the world championship by mastering short, high-speed races, outthinking rivals with fuel and tire strategy, and proving themselves worthy of better team seats. Every five-lap race matters: mistakes are recoverable, resources create pressure, and named rivals have distinct behavior. Win the championship, then defend it.

## Creative Brief

Overdrive is built around the satisfaction of mastering competition. The player improves through faster and cleaner driving, meaningful race decisions, and victories over increasingly strong rivals. Long-term growth comes from earning better team seats rather than replacing driving skill with character statistics. Grand Prix 2 and Fire Emblem 4 are taste references for championship mastery and the emotional weight of investment.

## Core Fantasy

You are a rookie driver joining Zeroforce — the slowest team on the grid, with the worst car. The team's identity is visible through their livery, garage presentation, and the team principal's reactions to your results. Each race is a proving ground. You learn the car, understand the rivals, choose when to push and conserve, and prove yourself worthy of better seats.

## Unique Hook

Like Super Monaco GP, **and also** a modern arcade racing career with recoverable mistakes, fuel and tire decisions, named rival behavior, team-based progression, and a championship that must be won and defended.

## Reference DNA

| Reference | What Overdrive takes | What Overdrive does not copy |
|---|---|---|
| Super Monaco GP | Team hierarchy, rival challenges, seat ascension, championship pressure, title defense, 16-team grid | Binary punishment, dated controls, and the absence of a modern progression layer |
| Grand Prix 2 | Championship mastery, repeated improvement, racing competence | Simulation complexity and extensive setup spreadsheets |
| 4PGP | Accessible arcade controls, short races, visual speed, assist-friendly entry | Its content structure is not a replacement for Overdrive's career arc |
| Horizon Chase | Fast-paced readable racing, colorful stylization, travel feeling, compact events | A purely event-based progression without career consequences |
| Fire Emblem 4 | Personal reference for betrayal, loss, and the emotional weight of investment | No required tragedy or generational catastrophe |

## MDA Aesthetics

1. **Sensation:** speed, acceleration, grip, audio feedback, and visual momentum.
2. **Challenge:** mastering tracks, managing resources, recovering mistakes, and beating rivals.
3. **Fantasy:** rising from a backmarker to a championship driver.
4. **Discovery:** learning car identities, rival behavior, and effective race strategies.
5. **Narrative:** an emergent career history created by results, offers, defeats, and titles.

## Core Loop

### 30-Second Loop

```text
Push speed
→ avoid or recover from an error
→ read fuel and tire state
→ decide whether to keep pushing or conserve
→ gain or lose time and position
```

The primary feel is high-speed, accessible arcade racing: strong grip, readable acceleration, recoverable mistakes, analog throttle and brake control, and feedback that builds confidence rather than fear of unrecoverable failure.

### Handling Model

**Reference:** 4PGP / Horizon Chase — high grip, forgiving, skill-expressive through speed and efficiency rather than drift control.

- **Grip:** Cars maintain traction through most cornering scenarios. The grip threshold is generous — the player can push hard before losing traction.
- **Recovery:** Loss of traction is recoverable within 1–2 seconds. No unrecoverable spins from normal driving. Wall contact slows the car but does not stop it.
- **Skill expression:** Faster lap times come from optimal racing line, braking points, fuel/tire management, and strategic timing — not from controlling slides or managing oversteer.
- **Speed perception:** Velocity is communicated through Directional Velocity visual language (streaks, blur, camera shake) and audio feedback, not through physics instability.
- **Deterministic:** The simulation uses a fixed timestep (60 Hz) with deterministic physics within the same platform. Cross-platform determinism is not required — client prediction and interpolation handle discrepancies for arcade gameplay. Architecture is designed from the start to support multiplayer: simulation separated from rendering, input recording for replay/ghost, fixed timestep for determinism. Async multiplayer (ghosts, leaderboards) enters in Alpha via Coherence Cloud free tier. Real-time multiplayer enters in Beta via Coherence Rooms + relay.

### Five-Minute Race Loop

```text
Start and gain positions
→ establish race rhythm
→ battle a named rival
→ manage fuel and tires
→ recover from mistakes
→ make the final push
→ finish with a position result
```

The race is a combined arc. No single system replaces the others: driving skill, recovery, resource management, and rival pressure must coexist.

### Session Loop (Alpha+)

```text
Run several short races
→ accumulate rival outcomes and position results
→ evaluate team opportunities
→ stop with a new objective clearly visible
```

The natural session is more than one race but less than an entire simulated weekend. A short group of races should produce a meaningful career decision. In MVP, each race is standalone — no session structure.

### Progression Loop

```text
Perform against rivals
→ challenge higher-tier drivers
→ earn a better team seat
→ drive a more competitive and distinct car
→ face stronger rivals
→ win and defend the championship
```

The main progression is career ascension through rival challenges. The player defeats higher-tier drivers to earn their seats.

## Player Motivation Profile

| Need | How Overdrive serves it |
|---|---|
| Autonomy | Choose rivals, race strategy, and (Alpha+) whether to accept team offers |
| Competence | Improve lap speed, recover mistakes, read rivals, manage resources, and climb teams |
| Relatedness | Build named rivalries, identify with a team, create a championship record, and later compete asynchronously |

## Player Type Validation

- **Primary:** Competitors — players motivated by defeating rivals, winning championships, and proving superiority.
- **Secondary:** Achievers — players motivated by career milestones, better team seats, records, and long-term completion.
- **Not primarily for:** Combat-focused players seeking weapons, destruction, or vehicle combat.
- **Additional exclusions:** The anti-pillars also reject simulator-first and open-world-first expectations.

## Visual Identity Anchor

### Race Layer: Directional Velocity

**Visual rule:** *Every surface is a streak — the world blurs, the car stays sharp.*

- Cool, restrained environments contrast with highly visible player and rival colors.
- Long horizontal shapes, forward-facing silhouettes, light streaks, and directional motion reinforce speed.
- Rival colors must remain identifiable in a pack at racing speed.
- Speed effects may intensify sensation but must never obscure the racing line, car state, or HUD.

### Non-Race Layer: Garage Lit

**Visual rule:** *The car is the hero — everything else is workshop, pit lane, or memory.*

- Menus, garage, and career screens use warm, tactile, team-centered visual language.
- Materials, lighting, and layout should make the team and car feel owned rather than abstract.
- Career progression should be visible through team identity, livery presentation, crew presentation, and accumulated history.

### HUD Rule

The HUD must be fast to read. Contrast, hierarchy, placement, and state changes take priority over decorative effects. Fuel, tire state, speed, position, lap, and rival information must be understood at a glance while the player is driving.

### Art Production Strategy

The project uses a hybrid-by-tier strategy. MVP assets may use ComfyUI and LoRA for concept development, visual references, provisional liveries, and controlled art experiments. A one-car/one-track end-to-end pipeline must be measured before it becomes a production dependency. If the pipeline is too slow or inconsistent, low-poly modular assets and single-livery textures are the fallback. Later investment may fund professional artists and higher asset fidelity without changing the visual identity.

## Product Pillars

### 1. Speed You Can Feel

Everything communicates speed through responsive arcade grip, readable acceleration, strong visual/audio feedback, and recoverable mistakes.

**Design test:** If realism conflicts with stronger speed sensation, choose the option that feels faster without reducing control.

### 2. Every Short Race Matters

A short race must contain attack, recovery, resource management, rival pressure, and a meaningful position result.

**Design test:** If removing a race does not change the career, it lacks weight.

### 3. Earn the Next Seat

Progression primarily comes from proving yourself against rivals and earning access to better teams and cars.

**Design test:** If any mechanic replaces the need to improve as a driver, reduce or remove that mechanic.

### 4. Rivals Make the Grid Personal

Named rivals have recognizable behavior, remember performance, and make advancement feel relational.

**Behavioral axes:** Confidence (shaped by head-to-head results) affects three observable dimensions: **aggression** (overtaking willingness, blocking intensity), **error rate** (unforced mistakes under pressure), and **defensiveness** (line protection, inside-line occupation). A rival that has been consistently beaten becomes more error-prone and less aggressive; a rival that has consistently won becomes more aggressive and more defensive. These changes must be visible to the player through behavior on track, not through stat screens or post-race summaries.

**Design test:** A rival whose behavior is interchangeable, who does not remember past races, or whose defeat feels no different from beating a generic opponent must be strengthened or removed.

## Anti-Pillars

- **Not a simulator:** No tire-temperature simulation, ERS modes, suspension spreadsheets, or engineering complexity that weakens arcade readability.
- **Not a content treadmill:** No races whose only purpose is to delay the next unlock.
- **Not punitive:** Mistakes can damage a race, but poor results must leave a recovery path in the next race.
- **Not combat:** Racing is the conflict; there are no weapons or combat abilities.

## Race Results and Retry Policy

Each race result is **final and irreversible** within a career session (Alpha+). The player cannot retry a completed race in career mode. Consequences (position, rival outcomes) persist immediately.

In MVP standalone races, each race is a new instance — the same track with different grid positions and AI behavior. Results are standalone and do not persist across attempts.

However, the career calendar recycles (Alpha+): each season the player returns to the same tracks with a potentially different car, different rivals, and accumulated experience. This creates organic replay — not through retry, but through recurrence. The player's second encounter with a track carries different stakes: a better car, stronger rivals, and the memory of last year's result.

This resolves the tension between "Every Short Race Matters" and "Not punitive": each race matters because its result is permanent, but the player is never permanently locked out of improvement — next season offers a new chance on the same track with different conditions.

## Career and Championship Structure

### MVP
- Standalone races — no championship, no career progression.
- Player selects a race, competes, receives results.
- The MVP validates the core race loop: driving, fuel/tire strategy, pit stops, AI behavior.

### Alpha+
- One F1-style championship category.
- Short races of approximately five laps.
- Championship standings and rival outcomes persist across races.
- The player begins in a backmarker team and earns better seats through rival challenges.
- Team switching changes the car's character; career state persists.
- Winning the championship unlocks a title-defense path.
- A successful title defense is the planned career victory condition.

### Initial Fictional Grid

Based on Super Monaco GP (1990). 16 teams, 1 car each, 16 cars on grid.

| Tier | Team | Color | Rival behavior |
|---|---|---|---|
| 1 | Madonna | Yellow/Red | Reference pace, rarely makes unforced errors |
| 1 | Firenze | Red | Fast and consistent, hard to catch |
| 1 | Millions | Yellow/Blue | Extremely quick, error-prone under pressure |
| 1 | Bestowal | Yellow/Green | Clean line, difficult to pass |
| 2 | Blanche | Blue/White | Smooth entries, consistent execution |
| 2 | Tyrant | White/Blue | Defensive, blocks persistently |
| 2 | Losel | Gold | Fast when confident, inconsistent when pressured |
| 2 | May | Sky Blue | Aggressive overtakes, mistakes under pressure |
| 3 | Bullets | Sky Blue/Blue | Quick in clean air, struggles in traffic |
| 3 | Dardan | Orange | Aggressive, prone to contact |
| 3 | Linden | Blue | Technical, smooth driving style |
| 3 | Minarae | Yellow/White | Reliable but unremarkable |
| 4 | Rigel | Bright Green | Inconsistent, occasional flashes of speed |
| 4 | Comet | White | Cautious, rarely makes mistakes |
| 4 | Orchis | Yellow/Black | Aggressive at start, fades late |
| 4 | Zeroforce | Orange/White | Player's starting team — slowest car, inconsistent AI |

## Progression

### MVP — Race-by-Race
- Standalone races with no tier switching.
- Player chooses a race, competes against 15 AI rivals, and receives position results.
- No progression system — the MVP validates the core race loop (driving, fuel/tire strategy, pit stops, AI behavior).
- The player experiences different tiers by racing against them, not by driving for them.
- Rivals have fixed personalities per race (static behavior). Dynamic confidence-based behavior enters in Alpha when rival memory exists.

### Alpha — Career Progression
- Team switching via rival challenge (variable by tier gap: Tier 4→3 = 2 wins, Tier 3→2 = 3 wins, Tier 2→1 = 4 wins).
- Rival challenges for the player's seat — other drivers may challenge the player.
- Intra-tier challenges (Tier 1: Madonna vs Firenze for grid position).
- Save/load system.
- Basic rival memory.
- Async multiplayer (ghosts + leaderboards via Coherence Cloud free tier).

### Tier System
- Each team has stats that transfer to the car: Tier 1 teams have the best cars, Tier 4 the worst.
- Performance gap between tiers scales with difficulty. MVP ships with 3-5 difficulty levels that adjust tier gaps: lower difficulties = smaller gaps (Tier 4 can compete), higher difficulties = larger gaps (Tier 4 is uncompetitive).
- A player in a Tier 4 car rarely wins against Tier 1 cars on Normal difficulty — but with perfect mechanics and a favorable day, it is possible. This rarity is the motivation to move up.

## Race Systems (High-Level)

### Fuel Model

Fuel consumption is throttle-proportional: full throttle consumes fuel at the base rate; lifting off the throttle reduces or eliminates consumption. In most 5-lap races, the player must pit to refuel — the tank does not last the full race at full throttle. The strategic decision is whether to save fuel (lift-and-coast on straights) to delay or avoid the pit stop, trading lap time for fewer seconds lost in the pits. Fuel load affects car weight — a heavier car (full tank) corners slightly slower than a lighter car (low tank), creating a secondary trade-off. At 0% fuel, the car loses power proportionally and eventually stops — the player cannot finish the race without refueling.

### Tire Model

Tire wear is distance-based with multipliers for driving style and surface contact. Aggressive driving (hard braking, sharp turning, sustained sliding) accelerates wear. Off-track excursions significantly increase wear rate. Tire degradation reduces grip progressively — the player starts feeling reduced cornering confidence around lap 3-4, and by lap 4-5 the car is significantly harder to control. Tire wear is visible through a HUD element (tire state indicator) and through audio/visual cues (increased tire squeal, reduced visual grip feedback). At 0% tire grip, the car becomes nearly undrivable — the player must pit before this point.

### Pit Stops

Pit stops are available in all races. The player can choose to pit at any point during a race. Pit actions: refuel (scales with amount), change tires (fixed duration). Both can be performed simultaneously. Pit stop duration is approximately 8-10 seconds (pit lane transit + service + exit). In a 5-lap race (~375 seconds), a pit stop costs approximately 2-3% of total race time. AI rivals also pit, with timing based on their personality and strategy — the player can observe rivals entering the pits and adjust accordingly. Pit strategy is the primary strategic variable in the race: the decision of when to pit (or whether fuel savings can avoid a stop entirely) creates the mid-race arc that the five-lap format is designed to support.

### Qualifying

Each race includes an optional single-attempt qualifying session. The qualifying lap determines grid position: a fast qualifying time earns a better starting position. Qualifying uses a fixed fuel load (not race-start fuel) to ensure qualifying pace reflects car performance, not fuel state. If the player skips qualifying or fails to complete a qualifying lap, they start at the back of the grid (position 16 of 16). This mirrors the Super Monaco GP model: qualifying is a skill-expressive moment that rewards preparation, but the race itself is always winnable from the back.

### Session Structure (Alpha+)

A session consists of 3 races (approximately 25-30 minutes total including menus and transitions). Each race is approximately 6-7 minutes of racing time (5 laps at ~75 seconds per lap). The session loop: qualifying → race → results → qualifying → race → results → qualifying → race → results. The natural stopping point is after the third race. In MVP, each race is standalone with no session structure.

## Scope

### MVP — Corrida Funcional

- 16 F1 teams (1 car each, 16 cars on grid).
- Player starts on Zeroforce (slowest team).
- 1 track for testing.
- 5-lap races with qualifying.
- Fuel, tire wear, and pit stops (mandatory pit in most races, 8-10s stop).
- AI rivals with distinct behavior.
- Directional Velocity race layer with legible HUD.
- Difficulty scales tier performance gaps (3-5 levels).
- **Success state:** Win races. The player competes to win each standalone race. Success = victory. Failure = learn and try again in the next race.
- Architecture: fixed timestep 60 Hz, deterministic physics, simulation separated from rendering, input recording for future ghost system.

### Alpha — Progressão

- 4 tracks.
- Team switching via rival challenge (variable by tier gap: Tier 4→3 = 2 wins, Tier 3→2 = 3 wins, Tier 2→1 = 4 wins).
- Rival challenges for the player's seat.
- Intra-tier challenges.
- Championship standings persist across races.
- Save/load system.
- Basic rival memory.
- Async multiplayer (ghosts + leaderboards via Coherence Cloud free tier).
- Web/Browser build for investor access.
- More tracks added progressively.

### Beta — Multiplayer + Polish

- 8+ tracks.
- Real-time online multiplayer (Coherence Rooms + relay).
- Expanded rival memory and career consequences.
- Performance profiling and optimization.

### Release — Conteúdo Completo

- 16 tracks.
- Full championship with title defense.
- Advanced rival memory and career consequences.
- Professional art investment if project proves viable.
- Complete async + real-time multiplayer.

## MVP Validation Criteria

The MVP succeeds if:

1. Players enjoy at least five consecutive races without an external instruction to continue.
2. Players want to run another race after a defeat because the next attempt feels achievable.
3. Fuel and tire decisions create visible trade-offs without interrupting the speed fantasy.
4. Errors are understandable and recoverable rather than arbitrary.
5. Rivals feel different in behavior — the player can identify which rival they're racing against by driving style alone.
6. The 16-car grid feels alive — cars are visible, readable, and distinct at racing speed.
7. Adding the next track is primarily content work, not a rewrite of gameplay code.
8. The architecture supports future multiplayer without refactoring.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Physics feel | Prototype vehicle approaches before content production; validate speed, grip, recovery, and resource interaction with external playtesters |
| Art production | Measure one car and one track section end-to-end; retain low-poly modular fallback; do not let AI art consistency remain unmeasured |
| 16-car performance | Profile early with 16 cars on track; set draw call and physics budgets in MVP |
| AI rival distinctness | Define personality in the rival GDD; test telemetry and player recognition, not just parameter differences |
| Fuel/tire balance | Validate pit strategy with concrete numbers in system GDDs; a 1-stop race can become 0 with lift-and-coast, a 2-stop can become 1 — the player decides by reading fuel and tire state |
| Tier gap tuning | Difficulty-based scaling requires careful tuning; test with external players at multiple difficulty levels |
| Multiplayer architecture | Design simulation/rendering separation, input recording, and fixed timestep from day one; validate with async ghosts in Alpha |
| Web performance | Treat Web as a reduced 60 FPS profile (Alpha); profile with the full 16-car roster and simplify effects/content when required |
| Scope creep | Re-test every addition against the four pillars and the six-month re-estimation checkpoint |

## Timeline

The planning target is **18 months solo**. This is an accepted optimistic target based on prior delivery speed with OCGS and AI-assisted development. The project must perform a formal scope and timeline re-evaluation at month 6 using working evidence from physics, art pipeline, 16-car performance, rival behavior, and content authoring.

If the six-month evidence shows that the MVP cannot be completed within the remaining schedule, cut scope by dependency and player value: optional Web content, visual density, track count, and post-MVP features are candidates before cutting the core race loop.

## Technical Feasibility Gate Record

- **Gate:** TD-FEASIBILITY
- **Verdict:** CONCERNS
- **Accepted response:** Keep the full MVP and plan for 18 months, with a mandatory month-six re-estimation checkpoint.
- **Primary concerns:** Art pipeline throughput and Web/content performance.

- **Gate:** PR-SCOPE
- **Verdict:** OPTIMISTIC
- **Accepted response:** Keep the stated MVP and 18-month target; realign scope or timeline if month-six evidence requires it.

## Development Sequence

### Phase 1: Concept

1. Run `/concept-brainstorm` to produce the game concept. **Complete.**
2. Run `/design-review design/gdd/game-concept.md` to validate concept completeness. **Complete — Approved.**
3. Run `/setup-engine` to configure the engine and populate version-aware reference docs. **Complete.**
4. Decompose the concept into individual systems with `/map-systems` — map dependencies, assign priorities, and create the systems index.

### Phase 2: Systems Design

5. Run `/art-bible` to create the visual identity specification. **Complete.**
6. Author per-system GDDs with `/design-system` — write each MVP system identified in dependency order.
7. Review each GDD with `/design-review`.
8. Cross-check all GDDs with `/review-all-gdds`.

### Phase 3: Technical Setup

9. Plan technical architecture with `/create-architecture` — produce the master architecture blueprint and Required ADR list. Architecture must support future multiplayer from day one.
10. Record key architectural decisions with `/architecture-decision (×N)` — write one ADR per decision in the Required ADR list.
11. Validate all ADRs with `/architecture-review`.
12. Produce flat programmer rules with `/create-control-manifest`.

### Phase 4: Pre-Production

13. Prototype the riskiest system with `/prototype [core-mechanic]` — validate the core loop with 16 cars before full implementation.
14. Run `/playtest-report` after the prototype to validate the core hypothesis.
15. Create UX specs with `/ux-design` for key screens.
16. Create epics and stories with `/create-epics` and `/create-stories`.
17. Plan the first sprint with `/sprint-plan new`.
18. Build and playtest a Vertical Slice (hard gate).

### Phase 5: Production

19. Implement stories in sprint cycles using `/dev-story`.
20. Track progress with `/sprint-status` and `/retrospective`.

### Phase 6–7: Polish and Release

21. Performance profiling, balance, accessibility, and polish passes.
22. Release preparation and launch.
