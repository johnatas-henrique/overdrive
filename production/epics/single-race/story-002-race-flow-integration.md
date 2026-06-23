# Story 002: Race Flow Integration

> **Epic**: Single Race
> **Status**: Ready
> **Layer**: Feature
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/single-race.md`
**Requirement**: `TR-SR-001`, `TR-SR-005`
_(TR-SR-001: "Start() creates RaceConfiguration from Menu LITE selections, calls RaceManagement.init(config) + startRace().")_
_(TR-SR-005: "Race Again from PostRace — reuses same RaceConfiguration, skips Menu entirely; zero I/O on track/car reload.")_

**ADR Governing Implementation**: ADR-0021: Single Race Adapter
**ADR Decision Summary**: `buildConfig()` returns config synchronously. `RM.init(config)` called immediately — no intermediate cache. `RM.startRace()` called when GSM transitions Menu → PreRace → Racing. Race Again: same config (except seed) passed to `RM.init()` again.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: None — pure TypeScript integration orchestration.

**Control Manifest Rules (this layer)**:

- Required: X1 (zero state/zero tick/zero Event Bus), X2 (pass config directly to RM.init, not cached), X5 (one-shot lifecycle)
- Forbidden: X-F1 (never hold state between races), X-F2 (never cache RaceConfiguration)
- Cross-cutting: G2 (all cross-system signals through Event Bus)

---

## Acceptance Criteria

_From GDD `design/gdd/single-race.md`, scoped to this story:_

- [ ] AC-5: `raceManager.init(config)` is called immediately after `buildConfig()`, then `raceManager.startRace()` is called when GSM transitions to Racing
- [ ] Race Again: same config (except new seed) is passed to `RM.init()` again; no stale Event Bus listeners accumulate across repeated races

---

## Implementation Notes

_Derived from ADR-0021 Implementation Guidelines:_

1. **Init call chain** (per ADR-0021):

   ```
   buildConfig() → returns RaceConfiguration synchronously
   RM.init(config) → called immediately, config passed by value
   GSM: Loading → PreRace → Racing
   RM.startRace() → called on GSM → Racing transition
   ```

2. **There is no Single Race config cache.** RM stores the config passed to `init()` internally. Single Race does not hold a reference after `init()`.

3. **Race Again** (per ADR-0021, Risks section):
   - Same config object (team, track, lap count, difficulty) but a **new seed** (`Date.now()`)
   - `RM.init(config)` called again — Race Management's init is reentrant (`eventBus.off()` before `eventBus.on()` for all subscriptions, per ADR-0015 Reentrancy rule)

4. **GSM integration**: Single Race does not call `gsm.transition()` directly. The GSM transition sequence (`Loading → PreRace → Racing`) is owned by the orchestration layer (Menu LITE). Single Race produces the config and hands it to RM; RM reacts to GSM state via Event Bus subscriptions.

5. **Race Again flow**: When player selects "Race Again" from PostRace results:
   - Same selections are preserved (team, track, lap count, difficulty)
   - `buildConfig()` is called again with same params (new seed)
   - `RM.init(config)` is called with the new config
   - GSM enters PreRace again (RM handles re-entrance)

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 001]: Config construction, AI assignment, difficulty scaling
- Menu LITE: Results screen UI, "Race Again" button, "Main Menu" button
- Race Management: race lifecycle, reentrancy internals

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**AC-5**: `raceManager.init(config)` called after `buildConfig()`, then `raceManager.startRace()` called on GSM→Racing

- **Given**: A test-doubled `RaceManager` instance with spy on `init` and `startRace`
- **Given**: A test-doubled `GSM` that supports `transition("Racing")`
- **Given**: A real `EventBus` instance shared between RM and GSM
- **When**: `buildConfig("ferrari", "monza", 1.0)` is called and returns `config`
- **Then**: `raceManager.init` was called with the exact same `config` object (deep-equal)
- **Given**: `raceManager.init` has already been called
- **When**: `gsm.transition("Racing")` is triggered
- **Then**: `raceManager.startRace()` was called
- **Then**: No additional side effects occur (no duplicate init, no events emitted prematurely)
- **Edge cases**: GSM transitions to a non-Racing state — `startRace` must NOT be called
- **Edge cases**: `RM.init` throws (e.g., invalid config) — verify the error propagates and startRace is never called
- **Edge cases**: Double GSM `transition("Racing")` — startRace called only once

**Race Again**: Same config (except seed), no stale Event Bus listeners

- **Given**: First race complete: `RM.endRace()` called, GSM in PostRace
- **Given**: Previous config: `{ trackId: "monza", playerCarId: "ferrari", difficulty: 1.0, lapCount: 5, seed: 100 }`
- **When**: Race Again triggers `buildConfig("ferrari", "monza", 1.0, 5)` (same params)
- **Then**: New config has identical values for trackId, playerCarId, difficulty, lapCount
- **Then**: New config has `seed !== 100` (new seed, likely `Date.now()`)
- **Then**: `RM.init(newConfig)` is called
- **Then**: For every event that RM subscribes to, `eventBus.listenerCount(eventName)` is exactly 1 per subscriber — no duplicate listeners
- **Edge cases**: Race Again immediately after first race (before GSM fully settles) — verify no race conditions
- **Edge cases**: Race Again after a DNF — config is preserved, same assertions
- **Edge cases**: RM.init called 3+ times (repeated Race Again) — listener count never grows

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/single-race/raceFlow_test.ts` OR playtest doc

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (Build RaceConfiguration)
- Unlocks: None (final story in Single Race epic)
