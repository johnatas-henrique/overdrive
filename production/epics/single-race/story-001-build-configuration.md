# Story 001: Build RaceConfiguration

> **Epic**: Single Race
> **Status**: Ready
> **Layer**: Feature
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/single-race.md`
**Requirement**: `TR-SR-001`
_(Requirement: "Start() creates RaceConfiguration from Menu LITE selections (trackId, car, AI teams, lapCount), calls RaceManagement.init(config) + startRace().")_

**ADR Governing Implementation**: ADR-0021: Single Race Adapter
**ADR Decision Summary**: Single Race is a thin adapter — pure TypeScript function that translates menu selections into a `RaceConfiguration` data object and calls `RM.init()` immediately. Zero state, zero tick, zero Event Bus subscriptions.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: None — zero Babylon.js imports. Pure TypeScript.

**Control Manifest Rules (this layer)**:

- Required: X1 (zero state/zero tick/zero Event Bus), X2 (buildConfig returns RaceConfiguration, passed immediately to RM.init), X3 (fixed grid 8), X4 (difficulty as number), X5 (one-shot lifecycle), X6 (zero Babylon.js imports)
- Forbidden: X-F1 (never hold state between races), X-F2 (never cache RaceConfiguration)

---

## Acceptance Criteria

_From GDD `design/gdd/single-race.md`, scoped to this story:_

- [ ] AC-1: `buildConfig()` produces valid `RaceConfiguration` with correct types (trackId, lapCount, gridSize=8, playerCarId, difficulty as number, seed, 7 aiDrivers)
- [ ] AC-2: Player's selected team is excluded from AI driver list
- [ ] AC-3: All 7 AI teams are assigned correctly with correct `teamPerformance` from constructor hierarchy, scaled by difficulty multiplier
- [ ] AC-4: Default lap count comes from ConfigManager (`singleRace.defaultLaps`)

---

## Implementation Notes

_Derived from ADR-0021 Implementation Guidelines:_

1. **Interface definitions** (from ADR-0021):

   ```typescript
   interface RaceConfiguration {
     trackId: string;
     lapCount: number; // 1–20, default from ConfigManager
     gridSize: number; // always 8 in MVP
     playerCarId: string;
     difficulty: number; // 0.75 / 0.875 / 1.0 / 1.125 / 1.25
     seed: number; // Date.now() or fixed for replay
     aiDrivers: AIDriverConfig[];
   }

   interface AIDriverConfig {
     carId: string;
     teamPerformance: number;
   }
   ```

2. **Difficulty as number** (not string enum). ADR-0021 explicitly rejected string enum for flexibility:
   | Label | Value |
   |-----------|-------|
   | Very Easy | 0.75 |
   | Easy | 0.875 |
   | Medium | 1.0 |
   | Hard | 1.125 |
   | Very Hard | 1.25 |

3. **AI assignment**: 7 AI drivers from the 7 teams not selected by the player. Each AI's `teamPerformance` comes from the constructor hierarchy (AI Driver GDD Section 3.7), scaled by the difficulty multiplier.

4. **Default lap count**: Read from `ConfigManager.get<number>("singleRace.defaultLaps")`. No fallback in code — ConfigManager throws `ConfigError` for missing keys.

5. **Seed**: `Date.now()` by default. Accept a fixed seed override for testing/determinism.

6. **Zero Babylon.js imports** — verify with `tsc --noEmit` that the module has no `@babylonjs/core` dependency tree.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 002]: RM.init() and startRace() call sequence, Race Again lifecycle
- Menu LITE: selection screens, player input gathering
- Race Management: config validation, race lifecycle

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**AC-1**: `buildConfig()` produces valid `RaceConfiguration` with correct types

- **Given**: Player selected team `"ferrari"`, track `"monza"`, difficulty value `1.0`
- **When**: `buildConfig("ferrari", "monza", 1.0)` is called
- **Then**: returned object has shape `{ trackId: string, lapCount: number, gridSize: number, playerCarId: string, difficulty: number, seed: number, aiDrivers: AIDriverConfig[] }` with 7 aiDriver entries
- **Then**: `gridSize === 8`
- **Edge cases**: All 5 difficulty values produce correct numeric type; seed is any finite number (not NaN, not Infinity); `buildConfig` with no difficulty argument defaults to `1.0`; gridSize is always exactly 8 regardless of input

**AC-2**: Player's selected team excluded from AI driver list

- **Given**: Player selected team `"ferrari"`
- **When**: `buildConfig("ferrari", "monza", 1.0)` returns config
- **Then**: `aiDrivers.every(d => d.carId !== "ferrari")` is true
- **Edge cases**: Player selects team #8 (last remaining) — all 7 remaining teams assigned, none are the player's team; repeated calls with different player teams always exclude the correct one

**AC-3**: All 7 AI teams assigned with correct `teamPerformance`, scaled by difficulty multiplier

- **Given**: Constructor hierarchy performance table — a map of `teamId → basePerformance`
- **Given**: Difficulty multiplier `1.0` (Medium)
- **When**: `buildConfig("ferrari", "monza", 1.0)` returns config
- **Then**: `aiDrivers` contains exactly the 7 teams not selected by player, with no duplicates
- **Then**: For each AI driver, `driver.teamPerformance === constructorHierarchy[driver.carId] * 1.0`
- **Edge cases**: Each difficulty level scales correctly: Very Easy `*0.75`, Easy `*0.875`, Hard `*1.125`, Very Hard `*1.25`; scaling produces non-integer values (verify against tolerance ≈0.001); player selects the team with highest base performance — AI list correctly excludes it

**AC-4**: Default lap count from ConfigManager

- **Given**: `ConfigManager.get("singleRace.defaultLaps")` returns `5`
- **When**: `buildConfig("ferrari", "monza", 1.0)` is called (no lapCount override)
- **Then**: `config.lapCount === 5`
- **Edge cases**: `ConfigManager.get("singleRace.defaultLaps")` returns `20` → `config.lapCount === 20`; returns `1` (minimum) → `config.lapCount === 1`; ConfigManager not configured / throws — implementation should propagate the `ConfigError` (no hardcoded fallback)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/single-race/buildConfig_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None (pure TypeScript utility)
- Unlocks: Story 002 (Race Flow Integration)
