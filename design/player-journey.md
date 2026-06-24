# Player Journey Map: Overdrive

> **Status**: Draft
> **Author**: game-designer
> **Last Updated**: 2026-06-22
> **Links To**: `design/gdd/game-concept.md`, `design/gdd/game-pillars.md`

---

## Journey Overview

The player arrives excited and hungry for competition. They start at the back of the grid, learning tracks and rivals one race at a time. As the championship unfolds, rivalries take shape — some drivers become enemies you know how to exploit, others become benchmarks you measure yourself against. The emotional peak comes when a season-long rivalry culminates in a title-deciding race, and the long-term drive is the pursuit of the perfect car: earning a seat in the team that fits your driving style, then defending your crown.

---

## Target Player Archetype

A player who may have played other racing games but does not need to know F1 to enjoy Overdrive — the game teaches its systems through play. They arrive seeking challenge: the thrill of overtaking, the satisfaction of a well-timed pit stop, the tension of a title-deciding final lap. They are patient enough to learn rival personalities and track layouts, but expect the game to explain when something is not clear — tooltips, contextual hints, and clear feedback replace manuals.

Both the perfectionist (who replays a race until every corner is clean) and the progress-driven player (who moves to the next track regardless of result) are accommodated. The championship structure inherently favours constant progression — the driver always has a next race, a next upgrade, a next team to earn.

---

## Journey Phases

---

### Phase 1: First Contact (0-5 minutes)

**Scope**: MVP (Single Race)

**Emotional state on arrival**: Animated, competitive spirit. The player arrives excited to race.

**Primary question the player is asking**: "Is this fun?"

**Key experience the game must deliver**:
A moment of speed that impresses — the first straight where the cockpit FOV pulses, the engine screams, and the world blurs past. The player should feel fast before they even overtake anyone.

**Emotional state on exit**: "I want one more, I'll do better next time."

**Risk if this phase fails**: The game must be immediately playable — the player presses OK through Single Race setup and lands in a race they can drive. If this basic flow fails, it is a development failure, not a player failure. There is no "the player gives up" scenario here because the game must not let them experience a broken first launch.

---

### Phase 2: Orientation (5-30 minutes)

**Scope**: MVP (Single Race)

**Emotional state on arrival**: Intrigued — the first race is over, and the player wants to understand how the game works beyond just driving.

**Primary question the player is asking**: "How do I win, and what do the upgrades do? Will they give me what I need to win?"

**Key experience the game must deliver**:
Being able to complete a race without finishing last. Discovering that leaving the pit before full refuel (after tires are done) can be strategically advantageous — the first "aha" moment where the player feels smarter than the default strategy. Understanding the fuel bar and tire indicator as tools, not decoration.

**Emotional state on exit**: "I've got the hang of this." The player understands the basic loop: drive → manage resources → pit → finish.

**Risk if this phase fails**: The player does not learn that fuel and tires must be managed through pit stops. When the car slows from worn tires or stops from empty fuel, they conclude "the car is broken" rather than "I need to pit." The game must surface pit entry guidance (visual marker on track, HUD alert) before resource depletion becomes critical.

---

### Phase 3: First Mastery (30 minutes - 2 hours)

**Scope**: Alpha (Championship mode)

**Emotional state on arrival**: Confident — "I know how to race, now I want to win."

**Primary question the player is asking**: "Can I beat this rival on my own skill?"

**Key experience the game must deliver**:
The first clean victory — overtaking through the right line, not by luck. Noticing that a specific rival brakes late, and using that knowledge to pass them. The click of "I read that driver and I beat them."

**Emotional state on exit**: "This feels great — I want to try a different car/track."

**Risk if this phase fails**: Track variety across different circuits keeps each race fresh. If a player feels all races are the same despite different layouts, rival personalities, and championship stakes, the racing genre itself may not be for them — and that is acceptable. The game is designed for players who find excitement in the repetition of mastering a craft, not for those who need novelty of mechanics.

---

### Phase 4: Depth Discovery — "The Familiar Fun" (2-10 hours)

**Scope**: Alpha (Championship mode + free play)

**Emotional state on arrival**: Comfortable — "I know this game. I know what I'm here for."

**Primary question the player is asking**: Not a question — the player already knows the answer. They are here for the reliable experience: speed, rival battles, the rhythm of race-pit-race.

**Key experience the game must deliver**:
The realisation that the game does not need to surprise you to be worth returning to. Every race is a variation on a familiar loop, and that is exactly why it works — like putting on a favourite album or ordering a known pizza. The player stops analysing and starts enjoying.

**Emotional state on exit**: Satisfied. Not because something new was discovered, but because something reliable delivered again.

**Risk if this phase fails**: The player never reaches this phase because earlier phases were broken — controls felt wrong, AI was unfair, pit stops were confusing. The responsibility is on the fundamentals being rock-solid so the player can stop thinking and start racing.

---

### Phase 5: Habitual Play — "Self-Generated Goals" (10-50 hours)

**Scope**: v1.0 (Multi-season championship)

**Emotional state on arrival**: The player is a veteran. They know every track, every rival, every upgrade path. They are here because they choose to be.

**Primary question the player is asking**: Not a question — they have their own goals. "Can I win with the worst team?" "Can I win with zero upgrades?" "What if I only pit when absolutely necessary?"

**Key experience the game must deliver**:
The game stays out of the way and lets the player set their own challenges. The championship structure rewards different approaches — switching teams, conservative vs aggressive strategies, different upgrade orders. Reliable physics means the player's skill growth is real, not random. Achievements (post-v1.0) can formalise these self-generated goals, but the game does not need them — the loop is the reward.

**Emotional state on exit**: "One more season. Let me try something different this time."

**Risk if this phase fails**: If the core loop is not rock-solid — physics feels inconsistent, AI is predictable, pit strategy is always optimal — the player has no reason to experiment. The game must be a known, reliable instrument the player trusts enough to play with.

---

### Phase 6: Long-Term Engagement — "Part of the Rotation" (50+ hours)

**Scope**: Post-v1.0 (Free play, records, community)

**Emotional state on arrival**: The game is part of the player's rotation. They launch it when they want 15 minutes of reliable fun — like queueing a favourite song.

**Primary question the player is asking**: None. The player is not solving the game anymore — they are experiencing it.

**Key experience the game must deliver**:
Being a dependable presence — the game loads fast, the first race is immediate, the feeling is always the same reliable satisfaction. This phase does not require new content; it requires that the game respects the player's time and delivers the promised experience every single launch.

**Emotional state on exit**: Relaxed and satisfied. "That hit the spot."

**Risk if this phase fails**: The game fails to earn a place in the player's rotation. If any launch involves friction (slow loading, broken save, confusing state after an update), the player moves on to the next comfort game. This phase is won by reliability, not features.

---

## Critical Moments

| Moment                                                                                | Phase           | Emotional Target                        | If It Fails                                                                    |
| ------------------------------------------------------------------------------------- | --------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| **First start** — grid countdown 5→1, green lights                                    | First Contact   | Excitement — "Let's go!"                | Player feels no rush; countdown feels like a delay, not a build-up             |
| **First clean overtake** — passing a rival through skill, not luck                    | Orientation     | Satisfaction — "I did that."            | Player beats rivals by accident and doesn't feel progression                   |
| **First pit stop** — entering pit lane, seeing the overlay, exiting with fresh tires  | Orientation     | Understanding — "I get how this works." | Player doesn't notice tire wear or fuel depletion and thinks the car is broken |
| **First victory** — crossing the line in P1                                           | First Mastery   | Triumph — "I earned this."              | Win feels undeserved (AI too easy, or win by luck) — player undervalues it     |
| **Reading a rival** — noticing a specific driver's pattern (e.g., always brakes late) | First Mastery   | Discovery — "I can read them."          | Player never notices patterns; all rivals feel interchangeable                 |
| **First team switch** — earning a seat in a faster team                               | Depth Discovery | Ambition — "New chapter."               | Switch feels arbitrary; player doesn't feel they earned it                     |
| **Championship title** — winning the season                                           | Depth Discovery | Realisation — "I did it."               | Final race has no ceremony; moment passes without emotional weight             |
| **Defending the title** — winning again with a different approach or weaker team      | Habitual Play   | Mastery — "I'm in control."             | Second season feels identical to the first with no reason to experiment        |

---

## Retention Hooks

| Hook Type         | Hook Description                                                                             | Systems That Deliver It                                |
| ----------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Session Start** | Player has a self-generated goal ("can I win with the worst team?") or an upgrade 500cr away | Championship progression, upgrade shop, team offers    |
| **Session End**   | Satisfied from a good race — no cliffhanger, just the reliable feeling                       | Clean race loop, immediate Race Again option           |
| **Daily Return**  | No forced daily mechanic — the game earns its place in the rotation by being reliably fun    | Fast boot, instant Race Again, championship continuity |
| **Long-Term**     | Multi-season championship, team switching, title defence                                     | Save system, championship standings, team offer logic  |

> **Post-1.0**: Achievements and daily challenges can be added to give formal structure to self-generated goals. Not before MVP validation.

---

## Player Progression Feel

**Primary: Skill improvement.** The player should feel themselves getting sharper. Rivals they struggled against in the first season become predictable — not because the AI got easier, but because the player learned their patterns. A corner that felt tight now flows naturally. The physical act of driving transitions from "thinking about it" to "feeling it" — from conscious competence to unconscious competence.

**Secondary: Power growth.** Upgrades make the car measurably faster, and the player feels that speed. But the primary satisfaction is knowing they earned it — they won races, saved credits, chose the right part. The car's improvement is a record of the player's decisions, not a participation award.

---

## Anti-Patterns to Avoid

- **[Rivals feel interchangeable]**: All AI drivers must have distinct, readable driving patterns. If a player cannot name a rival's trait after one race, the pillar fails. Never use catch-up logic (rubber-band AI) in place of personality.

- **[Pit stop confusion]**: Player runs out of fuel or has worn tires and does not know why the car feels slow. The game must proactively guide the player to the pit — like Super Monaco GP, which highlights pit entry when the car needs service. HUD indicators show resource levels, visual markers on track point to pit entry when fuel is low or tires are critical, and the pit overlay explains what is happening during service.

- **[Difficulty spike creates a wall]**: A casual player should win races on Normal without memorising every braking point. Strategic choices (pit window, upgrade priority) should matter more than pixel-perfect driving.

- **[Player feels punished for experimenting]**: Trying a different pit strategy should never end the race irrecoverably. Multiple pit windows and early exit (after tires done) ensure experimentation has a safety net.

- **[Upgrade path is unclear]**: Player saves credits for an upgrade but does not know what it affects. Stat bars show before/after values; upgrade descriptions are concrete ("+8% top speed"), not vague ("improves performance").

---

## Validation Questions

**First Contact (0-5 min)**

- "Without looking at any instructions, what do you think this game is about?"
- "What's the first thing you want to do when the race starts?"

**Orientation (5-30 min)**

- "Did you know when to enter the pit? How did you know?"
- "Do you feel like you understand what the fuel bar and tire indicator mean?"

**First Mastery (30 min - 2h)**

- "What's the best race you've had so far? Why was it the best?"
- "Can you name one rival's driving trait? How did you figure it out?"

**Depth Discovery (2-10h)**

- "Did you ever switch teams? Why?"
- "What would you do differently if you started a new championship?"

**Habitual Play (10-50h)**

- "Do you still have a goal you're working toward? What is it?"
- "Have you tried a self-imposed challenge (e.g., no upgrades, worst team)?"

## Open Questions

| Question                                                                                                    | Owner           | Deadline         | Resolution   |
| ----------------------------------------------------------------------------------------------------------- | --------------- | ---------------- | ------------ |
| [Does the pit guidance system (highlighting pit entry on low fuel) work without feeling like hand-holding?] | [game-designer] | [MVP playtest]   | [Unresolved] |
| [Is 5 difficulty levels enough range for both casual and experienced players?]                              | [game-designer] | [MVP playtest]   | [Unresolved] |
| [Do self-generated goals emerge naturally, or do players need achievement prompts?]                         | [game-designer] | [Alpha playtest] | [Unresolved] |
| [Add question]                                                                                              | [Owner]         | [Date]           | [Resolution] |

---

_This document maps the player's emotional journey from first launch to long-term engagement. It is referenced by UX design and game design to ensure every screen and system serves the intended emotional arc._
