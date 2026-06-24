# ADR-0021: Single Race Adapter

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                                                                         |
| **Domain**                | Feature — Game Mode                                                                                       |
| **Knowledge Risk**        | LOW — pure TypeScript. Zero Babylon.js imports.                                                           |
| **References Consulted**  | single-race.md GDD, babylonjs-specialist review, ADR-0015 (Race Management), ADR-0004 (Module Boundaries) |
| **Post-Cutoff APIs Used** | None                                                                                                      |

## ADR Dependencies

| Field          | Value                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Depends On** | ADR-0015 (Race Management — `init(config)` + `startRace()`), ADR-0019 (Menu LITE — player selections), ADR-0003 (Two-Scene — asset loading) |
| **Enables**    | MVP gameplay loop: select → race → results → race again                                                                                     |
| **Blocks**     | None                                                                                                                                        |

## Context

### Problem Statement

The player needs a way to turn menu selections into an actual race. Single Race is that bridge — it receives the player's choices (team, track, lap count, difficulty), builds a `RaceConfiguration`, and hands it to Race Management. That is its entire job.

### Constraints

- No state, no tick, no Event Bus subscriptions
- Fixed grid of 8 (player + 7 AI) in MVP
- One-shot lifecycle — each race independent, no persistence
- Mode-agnostic — same pattern for Championship (Alpha), Story (v1.0)
- Zero Babylon.js imports — pure TypeScript function

## Decision

### Architecture

Single Race is a **thin adapter** that translates player intent into a system call and vanishes:

```
Menu LITE (Track Select confirm)
  │
  ▼
Single Race.buildConfig(selectedTeam, selectedTrack, lapCount, difficulty)
  │  returns RaceConfiguration — pure data object
  ▼
Race Management.init(config)     ← called immediately, not cached
  │
  ▼
[GSM: Loading → PreRace → Racing]
  │  Race Management.startRace() ← called when GSM → Racing
  ▼
race.completed → Results (Menu LITE)
```

### Interface

```typescript
// Pure data — zero Babylon types
interface RaceConfiguration {
  trackId: string;
  lapCount: number; // 1–20, default 5
  gridSize: number; // always 8 in MVP
  playerCarId: string;
  difficulty: number; // 0.75 / 0.875 / 1.0 / 1.125 / 1.25
  seed: number; // Date.now() or fixed for replay
  aiDrivers: AIDriverConfig[];
}

interface AIDriverConfig {
  carId: string; // team ID
  teamPerformance: number; // from AI Driver GDD hierarchy
}
```

**Difficulty**: `number` only (no string enum). The 5-level multiplier maps directly to `teamPerformance × difficulty`:

| Label     | Value |
| --------- | ----- |
| Very Easy | 0.75  |
| Easy      | 0.875 |
| Medium    | 1.0   |
| Hard      | 1.125 |
| Very Hard | 1.25  |

### Init Call Chain (Clarified)

1. `buildConfig()` returns `RaceConfiguration` synchronously
2. `raceManager.init(config)` is called **immediately** — no separate cache. Race Management holds the config internally from this point
3. `raceManager.startRace()` is called when GSM executes `Menu → PreRace → Racing` transition
4. On Race Again: `raceManager.init(config)` is called again with the same config (except `seed` — new race, new seed)

There is no "Single Race config cache." RM stores the config passed to `init()`.

### Extensibility for Future Modes

Future modes follow the same pattern:

```
src/feature/
  single-race/        — MVP: one-shot config → RM.init()
  championship/       — Alpha: config + multi-race state management
  story/              — v1.0: config + narrative progression hooks
```

Each produces the same `RaceConfiguration` contract. Race Management never knows which mode called it. Championship would call `raceManager.init(config)` between races with new track/seed, while managing championship points and standings separately.

### Asset Isolation Between Modes

Asset loading is the responsibility of the Loading screen (Menu LITE) and Asset Manager (ADR-0003), not the mode adapter. The mode's role is limited to saying "I need track [id]." The Asset Manager uses `LoadAssetContainerAsync` → cache → `instantiateModelsToScene()` → `dispose()` per ADR-0003.

For Championship: each race disposes the previous track's instantiated models and loads the next. Cached containers remain in memory (removed from scene) and are only evicted on explicit `container.dispose()`.

## Alternatives Considered

| Concern                | Alternative                                                 | Why Rejected                                                                              |
| ---------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Mode coupling          | Single Race owns race lifecycle                             | Race Management already exists and is mode-agnostic. Single Race should not duplicate it. |
| Config caching         | Single Race stores config in a "cache" for RM to read later | RM.init(config) receives the config immediately — no intermediate cache needed.           |
| Difficulty type        | String enum `"easy" \| "medium" \| "hard"`                  | Multiplier `number` is more flexible (5 levels vs 3), maps directly to AI computation.    |
| Babylon.js integration | Mode adapter handles scene setup (camera, lights, skybox)   | Scene setup belongs to Core systems (Camera, Track+Environment), not the mode.            |

## Consequences

### Positive

- Zero Babylon.js imports — fully testable with vitest alone
- Future Championship/Story modes follow the same contract without changing Core or Presentation
- `RaceConfiguration` is a plain-data contract — any producer can create one
- No state means no leaks, no memory, no cleanup

### Negative

- Single Race does nothing but build config and call RM.init() — trivial to implement, almost trivial to break. The "complexity" is in the orchestration (GSM transitions, Loading screen), which lives elsewhere.
- Championship mode adds multi-race state that Single Race doesn't have — but that's a new feature, not a refactor.

### Risks

- **Risk**: `raceManager.init()` called twice (Race Again without proper cleanup)
  **Mitigation**: Race Management's `init()` calls `eventBus.off()` before `eventBus.on()` for all subscriptions (per ADR-0015 Reentrancy rule)

## GDD Requirements Addressed

| GDD Requirement                 | How This ADR Addresses It                                                 |
| ------------------------------- | ------------------------------------------------------------------------- |
| Thin adapter                    | No state, no tick, no Event Bus. Pure function + RM.init() call           |
| Fixed grid 8                    | `gridSize: 8`, 7 AI drivers generated from remaining teams                |
| Mode-agnostic                   | `RaceConfiguration` is the boundary. Race Management never knows the mode |
| One-shot lifecycle              | Each `buildConfig()` call is independent. No persistence                  |
| Race Again preserves selections | Same config (except seed) passed to RM.init() again                       |

## Performance Implications

- Zero. Single Race is a function call — sub-microsecond.

## Validation Criteria

- [ ] `buildConfig()` returns valid `RaceConfiguration` with correct types
- [ ] Player team excluded from AI driver list
- [ ] All 7 AI teams assigned with correct `teamPerformance` from constructor hierarchy
- [ ] `difficulty` is `number` (0.75–1.25), not string enum
- [ ] `raceManager.init(config)` called immediately after `buildConfig()`
- [ ] Race Again: new config (new seed) passed to `RM.init()`, no stale listeners
- [ ] Zero Babylon.js imports in Single Race module

## Related Decisions

- ADR-0015 (Race Management — `init(config)` and `startRace()` API)
- ADR-0004 (Module Boundaries — Feature layer delegates to Core)
- ADR-0003 (Two-Scene — asset loading for mode transitions)
- ADR-0019 (Menu LITE — player selections source)
