# Story 001: Race Management Initialization & Config Validation

> **Epic**: Race Management (Core)
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/race-management.md`
**Requirement**: `TR-RM-001` (sub-state machine — init path), `TR-RM-010` (reentrant init)

**ADR Governing Implementation**: ADR-0015: Race Management
**ADR Decision Summary**: Race Management is a pure TypeScript sub-state machine operating inside GSM's `Racing` state. It owns positions, lap counters, DNF status, and race timing. All I/O goes through Event Bus.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No Babylon APIs used. Pure TypeScript state machine + data structures.

**Control Manifest Rules (this layer)**:

- Required: C52 (sub-state under GSM Racing), C53 (reentrant `init()`)
- Forbidden: C-F8 (never call `gsm.transition()` from within pipeline slot except from `endRace()`)
- Guardrail: C-G7 (Race Management: < 0.01ms/tick)

---

## Acceptance Criteria

_From GDD `design/gdd/race-management.md`, scoped to this story:_

- [ ] **AC-1**: Race Management initializes cleanly with a valid `RaceConfiguration`
- [ ] **AC-2**: Invalid configuration (0 laps, unknown track) throws `ConfigError`

---

## Implementation Notes

_Derived from ADR-0015 Implementation Guidelines:_

1. **Config validation at init**: Validate `lapCount` (must be ≥ 1), `trackId` (must exist in track registry), `gridSize` (must be ≤ available positions). First validation failure wins — throw `ConfigError` with a message referencing the specific field. Do not accumulate errors.
2. **Reentrant init pattern**: `init()` must call `eventBus.off()` before `eventBus.on()` for every subscription to prevent listener duplication on Race Again. Clear all runtime state maps first (`lapCount.clear()`, `positionGrid.clear()`, `dnfRegistry.clear()`, etc.).
3. **State transition**: After successful validation, set internal state to `"ready"`. Do not emit any Event Bus events during `init()` — event emission starts at `startRace()`.
4. **Seed propagation**: Store `config.seed` — pass to `SeededRandom` at `startRace()` time, not during `init()`.
5. **Fail-fast design**: Never start a race with bad configuration. `ConfigError` is thrown synchronously.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 002**: `startRace()` → Countdown sub-state, car locking, lights sequence
- **Story 003–008**: Lap detection, position tracking, DNF, race-end, results

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1**: Clean init with valid RaceConfiguration
  - Given: A valid RaceConfiguration with lapCount=3, trackId="monaco", gridSize=8, seed=42
  - When: `init(config)` is called
  - Then: No error is thrown; internal state is `"ready"`; all runtime state maps (lapCount, positionGrid, dnfRegistry, pendingDNF, prevSplinePos, splinePositions, bestLaps, pitStopCount, pitTotalTime, hysteresisTicks) are initialized and empty; Event Bus listeners for `car.fuel_empty`, `car.stopped`, `car.stalled_in_pit`, `car.tire_blown`, `pit.exit` are registered
  - Edge cases: Reinit with same config after full race cycle (init → startRace → endRace → init again) — should cleanly reset all state and re-register listeners; reinit config with different values (different trackId, different lapCount) — state reflects new values

- **AC-2**: Invalid configuration throws ConfigError
  - Given: A config with lapCount=0, trackId="monaco", gridSize=8
  - When: `init(config)` is called
  - Then: `ConfigError` is thrown with a message referencing `"lapCount"`; system remains in `"inactive"` state
  - Given: A config with unknown trackId (lapCount=3, trackId="nonexistent", gridSize=8)
  - When: `init(config)` is called
  - Then: `ConfigError` is thrown with message referencing `"trackId"`; system remains in `"inactive"` state
  - Edge cases: Both invalid (lapCount=0 AND trackId=unknown) — first validation failure wins (must not silently pass one); negative lapCount — should be treated as invalid; gridSize > availableCarCount — should ConfigError (not in AC but implied by GDD core rule 5)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/race-management/init-config-validation.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Event Bus (TR-EVB-001 through TR-EVB-008), ConfigManager (TR-DCM-001 through TR-DCM-006)
- Unlocks: Story 002 (Countdown → GreenFlag), Story 003–008
