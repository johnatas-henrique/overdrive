# Single Race

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Foundation — Game Mode

## Overview

Single Race is the MVP game mode — a standalone race with no progression, no career, no championship. It translates the player's menu selections (team, track) into a `RaceConfiguration` and hands it to Race Management. That's its entire job.

Single Race is a thin adapter, not a system with state machines or complex logic. Race Management owns the race lifecycle; Menu LITE owns the UI flow; Single Race connects them.

---

## Developer Fantasy

The developer selects a team and track in the menu. Single Race builds a config object and passes it to Race Management. The race starts. When it ends, the results screen shows. The developer never thinks about Single Race — it's invisible plumbing.

---

## Detailed Design

### Core Rules

**1. Thin adapter.** Single Race has no state, no tick, no Event Bus subscriptions. It is a function that builds a `RaceConfiguration` from player choices and calls `raceManager.init(config)`.

**2.1 Fixed grid.** Grid is always 8 cars (player + 7 AI). No grid size customization in MVP.

**2. Mode-agnostic Race Management.** Race Management already accepts a `RaceConfiguration` — Single Race is one configuration. Championship would be another. In MVP, only Single Race exists.

**3. Default values.** Single Race supplies defaults for configuration fields the player doesn't choose: lap count (3), grid size (8), all 7 AI drivers.

**4. One-shot lifecycle.** Single Race is called once per race. No persistence, no session memory. Each race is independent.

### Configuration

```typescript
interface RaceConfiguration {
  trackId: string;           // Selected track (from Menu LITE)
  lapCount: number;          // Player-selectable, default: 3 (from ConfigManager: single_race.default_laps)
  gridSize: number;          // Default: 8 (player + 7 AI)
  playerCarId: string;       // Selected team (from Menu LITE)
  difficulty: Difficulty;    // 'easy' | 'medium' | 'hard', default: 'medium'
  aiDrivers: AIDriverConfig[]; // 7 AI drivers with team assignments
}

type Difficulty = 'easy' | 'medium' | 'hard';
```

**Lap count**: Player selects from a predefined list in Menu LITE (3, 5, 10, 20). Default is 3.

**Difficulty multiplier**: Scales all AI `team_performance` values. Medium is the baseline (1991 F1 hierarchy as designed). Easy makes AI slower (easier to beat). Hard makes AI faster (harder to beat).

| Difficulty | AI multiplier | Effect |
|---|---|---|
| Easy | 0.8 × team_performance | AI braking earlier, less aggressive overtaking |
| Medium | 1.0 × team_performance | Baseline — as designed in AI Driver GDD |
| Hard | 1.2 × team_performance | AI braking later, more aggressive overtaking |

**AI driver assignment**: The 7 AI cars are assigned to the 7 teams not selected by the player. Each AI gets its `team_performance` value from the AI Driver GDD's constructor hierarchy (Section 3.7), scaled by the difficulty multiplier.

### Flow

```
Menu LITE (Track Select confirm)
  │
  ▼
Single Race.buildConfig(selectedTeam, selectedTrack)
  │
  ▼
raceManager.init(config)
  │
  ▼
raceManager.startRace()
  │
  ▼
[Race Management takes over — Showing Grid → Countdown → GreenFlag → Racing → Checkered]
  │
  ▼
race.completed event → Results screen (Menu LITE)
   │
   ├── "Race Again" ──▶ PreRace (preserves config)
   │                     rebuildConfig() → raceManager.init(config) → startRace()
   │
   └── "Main Menu" ──▶ Menu (clears selections)
```

Single Race exits the flow after `raceManager.startRace()`. It does not participate in the race itself. Race Management owns everything from that point.

### Post-Race

When `race.completed` fires, Race Management has already transitioned to PostRace. Menu LITE shows the Results screen.

**"Race Again"**: Preserves all previous selections (team, track, lap count, difficulty). Single Race rebuilds the config with the same values and calls `raceManager.init()` + `startRace()` again. No re-selection needed — instant re-race.

**"Main Menu"**: Returns to Title Screen. All selections cleared.

### Interactions with Other Systems

| System              | Read                                        | Write                    |
| ------------------- | ------------------------------------------- | ------------------------ |
| **Menu LITE**       | selectedTeam, selectedTrack, lapCount, difficulty | None                |
| **Race Management** | None                                        | `init(config)`, `startRace()` |
| **Data & Config**   | default_laps, team data, track data          | None                     |
| **AI Driver**       | team_performance values for AI assignment    | None                     |

---

## Edge Cases

| #  | Edge Case                          | Handling                                           |
| -- | ---------------------------------- | -------------------------------------------------- |
| 1  | Player selects last possible team  | All 7 remaining teams assigned to AI — no validation needed |
| 2  | Track has no spline data           | Race Management throws ConfigError at init          |
| 3  | Developer injects invalid config   | Race Management throws ConfigError — Single Race doesn't validate |

---

## Acceptance Criteria

| #  | Criterion                                                    | Test type  |
| -- | ------------------------------------------------------------ | ---------- |
| 1  | `buildConfig()` produces valid `RaceConfiguration`           | Unit       |
| 2  | Player's selected team is excluded from AI driver list       | Unit       |
| 3  | All 7 AI teams are assigned correctly                        | Unit       |
| 4  | Default lap count comes from ConfigManager                   | Unit       |
| 5  | `raceManager.init()` and `raceManager.startRace()` are called in sequence | Integration |

---

## Out of Scope (MVP)

- Championship mode
- Career mode
- Time trial
- Multiplayer race setup
- Race customization (lap count UI, grid size UI)


---

## Tuning Knobs

| Key                              | Default | Range   | Description                    |
| -------------------------------- | ------- | ------- | ------------------------------ |
| `single_race.default_laps`       | 3       | 1–20    | Default lap count per race     |
| `single_race.difficulty.easy`    | 0.8     | 0.5–1.0 | AI multiplier for Easy mode    |
| `single_race.difficulty.hard`    | 1.2     | 1.0–1.5 | AI multiplier for Hard mode    |

**Total**: 3 tuning knobs.
