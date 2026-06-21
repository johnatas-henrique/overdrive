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

## Player Fantasy

> _For infrastructure systems, the "player" is the developer using this API._

The developer selects a team and track in the menu. Single Race builds a config object and passes it to Race Management. The race starts. When it ends, the results screen shows. The developer never thinks about Single Race — it's invisible plumbing.

---

## Detailed Design

### Core Rules

**Thin adapter.** Single Race has no state, no tick, no Event Bus subscriptions. It is a function that builds a `RaceConfiguration` from player choices and calls `raceManager.init(config)`.

**Fixed grid.** Grid is always 8 cars (player + 7 AI). No grid size customization in MVP.

**Mode-agnostic.** Race Management already accepts a `RaceConfiguration` — Single Race is one configuration. Championship would be another. In MVP, only Single Race exists.

**Default values.** Single Race supplies defaults for configuration fields the player doesn't choose: lap count (5), grid size (8), all 7 AI drivers.

**One-shot lifecycle.** Single Race is called once per race. No persistence, no session memory. Each race is independent.

### Configuration

```typescript
interface RaceConfiguration {
  trackId: string; // Selected track (from Menu LITE)
  lapCount: number; // Player-selectable, default: 3 (from ConfigManager: singleRace.defaultLaps)
  gridSize: number; // Default: 8 (player + 7 AI)
  playerCarId: string; // Selected team (from Menu LITE)
  difficulty: Difficulty; // 'easy' | 'medium' | 'hard', default: 'medium'
  seed: number; // PRNG seed. Date.now() at race start by default. Override for replay/debug determinism.
  aiDrivers: AIDriverConfig[]; // 7 AI drivers with team assignments
}

type Difficulty = "easy" | "medium" | "hard";
```

**Seed**: By default, `Date.now()` (unique per race, good for variety). For testing or debugging, provide a fixed seed — same seed + same inputs + same configuration → same race outcome (Determinism Contract AC #5). Replay (future): seed is read from the replay file.

**Lap count**: Player selects from a predefined list in Menu LITE (3, 5, 10, 20). Default is 5.

**Difficulty multiplier**: Scales all AI `teamPerformance` values. Medium (1.0×) is the baseline (1991 F1 hierarchy as designed). 5 levels provide granular tuning between arcade-easy and punishing-hard.

| Difficulty | AI multiplier           | Effect                                                      |
| ---------- | ----------------------- | ----------------------------------------------------------- |
| Very Easy  | 0.75 × teamPerformance  | AI significantly slower — leisurely pace, frequent mistakes |
| Easy       | 0.875 × teamPerformance | AI noticeably slower — good for learning tracks             |
| Medium     | 1.0 × teamPerformance   | Baseline — as designed in AI Driver GDD                     |
| Hard       | 1.125 × teamPerformance | AI sharper — tighter lines, better exits                    |
| Very Hard  | 1.25 × teamPerformance  | AI highly optimized — punishes small mistakes               |

**AI driver assignment**: The 7 AI cars are assigned to the 7 teams not selected by the player. Each AI gets its `teamPerformance` value from the AI Driver GDD's constructor hierarchy (Section 3.7), scaled by the difficulty multiplier.

### Flow

```
Menu LITE (Track Select confirm)
  │
  ▼
Single Race.buildConfig(selectedTeam, selectedTrack)
  stores RaceConfiguration in memory cache
  │
  ▼
[GSM: Loading → PreRace]
  │  RM starts grid timer (8s), locks all cars
  ▼
[GSM: PreRace → Racing]
  │  RM reads config from Single Race cache
  │  RM.init(config) → sub-state Countdown → race.starting
  │  [Countdown → GreenFlag → Racing → Checkered]
  ▼
race.completed event → Results screen (Menu LITE)
  │
  ├── "Race Again" ──▶ PreRace (preserves config)
  │                     (RM reads same config on next GSM→Racing)
  │
  └── "Main Menu" ──▶ Menu (clears selections)
```

Single Race exits the flow after `buildConfig()`. It does not participate in the race itself. Race Management owns everything from that point. RM reads config from Single Race's cache when GSM enters Racing.

### Post-Race

When `race.completed` fires, Race Management has already transitioned to PostRace. Menu LITE shows the Results screen.

**"Race Again"**: Preserves all previous selections (team, track, lap count, difficulty). Single Race rebuilds the config with the same values and calls `raceManager.init()` + `startRace()` again. No re-selection needed — instant re-race.

**"Main Menu"**: Returns to Title Screen. All selections cleared.

### Interactions with Other Systems

| System              | Read                                              | Write                         |
| ------------------- | ------------------------------------------------- | ----------------------------- |
| **Menu LITE**       | selectedTeam, selectedTrack, lapCount, difficulty | None                          |
| **Race Management** | None                                              | `init(config)`, `startRace()` |
| **Data & Config**   | defaultLaps, team data, track data                | None                          |
| **AI Driver**       | teamPerformance values for AI assignment          | None                          |

---

## Edge Cases

| #   | Edge Case                         | Handling                                                          |
| --- | --------------------------------- | ----------------------------------------------------------------- |
| 1   | Player selects last possible team | All 7 remaining teams assigned to AI — no validation needed       |
| 2   | Track has no spline data          | Race Management throws ConfigError at init                        |
| 3   | Developer injects invalid config  | Race Management throws ConfigError — Single Race doesn't validate |

---

## Acceptance Criteria

| #   | Criterion                                                                 | Test type   |
| --- | ------------------------------------------------------------------------- | ----------- |
| 1   | `buildConfig()` produces valid `RaceConfiguration`                        | Unit        |
| 2   | Player's selected team is excluded from AI driver list                    | Unit        |
| 3   | All 7 AI teams are assigned correctly                                     | Unit        |
| 4   | Default lap count comes from ConfigManager                                | Unit        |
| 5   | `raceManager.init()` and `raceManager.startRace()` are called in sequence | Integration |

---

## Out of Scope (MVP)

- Championship mode
- Career mode
- Time trial
- Multiplayer race setup
- Race customization (lap count UI, grid size UI)

---

## Tuning Knobs

| Key                              | Default | Range   | Description                      |
| -------------------------------- | ------- | ------- | -------------------------------- |
| `singleRace.defaultLaps`         | 5       | 1–20    | Default lap count per race       |
| `singleRace.difficulty.veryEasy` | 0.75    | 0.5–1.0 | AI multiplier for Very Easy mode |
| `singleRace.difficulty.easy`     | 0.875   | 0.5–1.0 | AI multiplier for Easy mode      |
| `singleRace.difficulty.medium`   | 1.0     | 0.8–1.2 | AI multiplier for Medium mode    |
| `singleRace.difficulty.hard`     | 1.125   | 1.0–1.5 | AI multiplier for Hard mode      |
| `singleRace.difficulty.veryHard` | 1.25    | 1.0–1.5 | AI multiplier for Very Hard mode |

**Total**: 6 tuning knobs.
