# Player Journey Map: Overdrive

> **Status**: Draft
> **Author**: User + Agents
> **Last Updated**: 2026-07-29
> **Links To**: `design/gdd/game-concept.md`

---

## Journey Overview

The player arrives looking for an unworried racing experience — no punishment, no pressure. The vibrant anime aesthetic and warm atmosphere say "it's safe here." Short races reward both the player who just wants to floor it and the one who wants to feel familiar tarmac beneath the tires. By the end, each player finds their own rhythm: the veteran rediscovers why racing is fun, the newcomer discovers the joy of the track, and every finish line leaves them wanting "one more race."

---

## Target Player Archetype

Two primary archetypes, different mindsets, same game:

### 1. Arcade Veteran (primary)

A player who has finished other arcade racing games and knows the genre. They are not looking for complexity or simulation depth. They want to feel the speed, recognize the tracks, and have fun without studying the game. They prefer learning through feeling over reading. They are not impatient, but they will not tolerate friction that gets between them and the next race.

### 2. Curious Casual

A player who does not normally play racing games. They were attracted by the anime art style and the welcoming atmosphere. The visual identity made them curious enough to try. They appreciate being able to choose between ignoring strategy entirely (just accelerate and brake) or gradually engaging with fuel and tire decisions. They need fast wins and consistent positive feedback. The game feels like a cozy place to be, not a competitive obligation.

---

## Journey Phases

### Phase 1: First Contact (0-5 minutes)

**Emotional state on arrival**: Curious and hopeful. The player saw screenshots and liked the anime style. They want to see if the game is as beautiful and fun as it looks.

**Primary question the player is asking**: "Is this fun?" — Is it worth my time? Is the gameplay good, or is it just pretty visuals?

**Key experience the game must deliver**:
Two paths depending on player type:
- **Curious Casual**: The title screen and first menu already communicate the warm atmosphere. The music welcomes them. Navigating the menu feels pleasant. The first race is a natural consequence, not a barrier.
- **Arcade Veteran**: From menu to track in seconds. Feel the speed, see the anime style in action, hear the engine. The first acceleration must excite.

**Emotional state on exit**: "One more." — It was fast, it was fun. I want to try again. I want to see the next track.

**Risk if this phase fails**: The player continues but is already uninterested. They have formed a negative first impression and will abandon within a few more sessions.

---

### Phase 2: Orientation (5-30 minutes)

**Emotional state on arrival**: Confident and curious. The player got the basic feel. Now they want to try the next track, see another team, feel the difference between cars.

**Primary question the player is asking**: "What do I do now?" — What is the goal? Championship? Improve my time? Move up to a better team?

**Key experience the game must deliver**:
The player must discover that fuel and tire decisions matter. They may run out of fuel or lose grip at a critical moment. "Ah, so THAT'S what those numbers mean." The surface-level arcade controls give way to a realization that there is a layer of strategy underneath.

**Emotional state on exit**: The player has a goal. "I want to win the championship" or "I want to move up to a better team" or "I want to beat my time on Monaco."

**Risk if this phase fails**: Frustration with difficulty. The player loses without understanding why. They think the game is unfair and abandon.

---

### Phase 3: First Mastery (30 minutes - 2 hours)

**Emotional state on arrival**: Competitive. The player understands the basics and wants to beat rivals, climb the championship, prove themselves. Every race is a personal challenge.

**Primary question the player is asking**: "What's possible?" — Can I win from any team? Can I beat the whole championship? What is the limit?

**Key experience the game must deliver**:
The player must discover that a strategic decision — pitting at the right time, conserving fuel, choosing when to push — changed the outcome of a race. They realize the game has depth beyond just driving fast.

**Emotional state on exit**: Belonging. "I understand the game now. I can compete. I belong here." The player feels they are part of the racing world.

**Risk if this phase fails**: Frustration. Difficulty increases and the player does not see progress. They conclude they are not good enough and abandon.

---

### Phase 4: Depth Discovery (2-10 hours)

> **MVP scope note:** Overdrive's MVP has limited depth (4 tracks, 16 teams, championship mode). Fuel/tire strategy and team tier differences exist but may not sustain 10 hours of discovery. This phase applies fully only after content expansion beyond MVP.

**Emotional state on arrival**: Wanting variety. The player has seen the tracks and wants to feel whether each team is truly different. They want to find their favorite team.

**Primary question the player is asking**: "Is there more?" — I know the basics, but is there another layer? How do I win with worse teams?

**Key experience the game must deliver**:
The player must feel a clear difference between Tier 1 and Tier 4 cars. They understand why moving up matters. The car stats translate into real driving feel, not just numbers.

**Emotional state on exit**: The player has an opinion about which team is their favorite and why. They may have found a preferred track or strategy style.

**Risk if this phase fails**: The player concludes "I've seen everything" and stops playing. They describe the game as fun but shallow.

---

### Phase 5: Habitual Play (10-50 hours)

> **MVP scope note:** Outside MVP scope. Full-game phase.

[To be designed]

---

### Phase 6: Long-Term Engagement (50+ hours)

> **MVP scope note:** Outside MVP scope. Full-game phase.

[To be designed]

---

## Critical Moments

| Moment | Phase | Emotional Target | If It Fails |
|--------|-------|-----------------|-------------|
| First time running out of fuel | Orientation | Surprise followed by understanding — "Ah, so THAT'S how fuel works." A learning moment, not a punishment. | Player thinks the game glitched or has a bug. Does not understand that fuel ran out. |
| First championship win | First Mastery | Earned pride — "I deserved that." Genuine satisfaction from progress. | Win feels handed to the player. They do not value the achievement. |
| Final-lap overtake for position | First Mastery | Adrenaline peak — "YES!" Tension, release, reward. High emotional payoff. | Overtake feels scripted or the rival offers no resistance. No satisfaction. |

---

## Retention Hooks

| Hook Type | Hook Description | Systems That Deliver It |
|-----------|-----------------|------------------------|
| **Session Start** | Unfinished championship — "one more race to close the championship." | Career/championship progression |
| **Session Start** | Team progression — "if I win more races, I get offers from better teams." | Team seat ascension system |
| **Session Start** | Experimentation — "I want to try a different team on this track." | 16 teams with distinct stats, 4 tracks |
| **Session End** | Almost there — championship goal left incomplete. One race away. | Session-bounded championship length (short races) |

---

## Player Progression Feel

**Primary progression feeling: Skill improvement.**

The player should feel themselves getting sharper with each race. Corners that were difficult become manageable. Decisions that were mysterious become clear. The car does not get faster — the driver gets better. The game communicates this by showing the player making intentional strategic choices (pitting, conserving fuel) and seeing them pay off.

At the beginning: every corner is a struggle, fuel runs out unexpectedly, tires wear faster than expected.

At the middle: the player predicts when fuel will run low, feels when tires are degrading, plans pit strategy.

At the end (MVP): the player has a mental model of each track and team. They know which corners demand lift-and-coast and which allow full throttle. They can win with lower-tier teams through strategy alone.

---

## Anti-Patterns to Avoid

- **Fuel and tire feel like punishment, not choice**: If the player runs out of fuel or loses grip without understanding why, they feel the game unfairly punished them. Every resource depletion must be preceded by clear visual feedback (HUD color change, bar depletion) so the player can trace cause to effect. "I saw the bar was low and I didn't pit" is a lesson. "The car suddenly stopped" is a bug.

- **Team differences are imperceptible**: If all cars feel identical, there is no motivation to move up teams. The difference between Tier 1 (fast, responsive) and Tier 4 (sluggish, slow to accelerate) must be immediately felt within the first corner of driving a new car. Players should be able to guess their tier from feel alone.

---

## Validation Questions

**First Contact (0-5 min)**
- [ ] "Without looking at any menus or tooltips, what do you think this game is about?"
- [ ] "What's the first thing you want to do next?"

**Orientation (5-30 min)**
- [ ] "What does winning or succeeding look like to you right now?"
- [ ] "Is there anything you feel like you should understand but don't?"

**First Mastery (30 min - 2 hrs)**
- [ ] "What's the best decision you've made so far? Why did you make it?"
- [ ] "What would you do differently if you started over?"

**Depth Discovery (2-10 hrs)**
- [ ] "Has the game surprised you? When? How did it feel?"
- [ ] "What questions do you have about systems you haven't fully explored?"

**General (any phase)**
- [ ] "If you had to stop playing right now, what would you be most eager to come back for?"
- [ ] "Is there anything you feel the game is not letting you do that you want to do?"

---

## Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| [To be added] | | | |
