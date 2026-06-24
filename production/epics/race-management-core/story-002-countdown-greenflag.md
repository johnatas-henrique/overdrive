# Story 002: Countdown → GreenFlag Sub-State Machine

> **Epic**: Race Management (Core)
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/race-management.md`
**Requirement**: `TR-RM-001` (sub-state machine — Countdown → GreenFlag)

**ADR Governing Implementation**: ADR-0015: Race Management
**ADR Decision Summary**: Race Management owns 4 sub-states: Countdown → GreenFlag → Racing → Checkered. Countdown uses tick-based (not real-time) timing — 60 ticks (1s) per light interval for deterministic replay.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No Babylon APIs used. Pure TypeScript state machine.

**Control Manifest Rules (this layer)**:

- Required: C52 (sub-state under GSM Racing)
- Guardrail: C-G7 (Race Management: < 0.01ms/tick)

---

## Acceptance Criteria

_From GDD `design/gdd/race-management.md`, scoped to this story:_

- [ ] **AC-3**: `startRace()` begins Countdown sub-state with cars locked at correct grid positions
- [ ] **AC-4**: Countdown plays 5-light sequence (5→4→3→2→1→GREEN) and unlocks all cars

---

## Implementation Notes

_Derived from ADR-0015 Implementation Guidelines:_

1. **Sub-state machine**: Own an internal state enum: `"inactive" | "ready" | "countdown" | "greenFlag" | "racing" | "checkered"`. Do NOT expose sub-states to GSM — GSM only knows it is in `Racing`.
2. **`startRace()` behavior**:
   - Must only succeed from `"ready"` state (set by `init()`).
   - Immediately transitions to `"countdown"` sub-state.
   - Cars are locked via `physics.setLocked(carId, true)` for all grid positions.
   - `race.starting` is NOT emitted synchronously during `startRace()` — it is deferred to the first pipeline tick after Countdown begins.
3. **Countdown timing**: `LIGHT_INTERVAL_TICKS = 60` (60 ticks × 16.667ms = 1s per light). Total countdown = 5 lights × 1s = 5s = 300 ticks.
4. **Lights sequence**: Start with 5 lights illuminated. Every 60 ticks, decrement lights count and emit `race.light.countdown { lightsOn: remaining }`. When `lightsOn` would go negative (after reaching 0), transition to `GreenFlag`.
5. **GreenFlag transition**:
   - Emit `race.green.flag { raceId, timestamp }` once.
   - Call `physics.setLocked(carId, false)` for all cars.
   - Transition sub-state to `"greenFlag"` → on next tick becomes `"racing"`.
   - Race clock (tickCount) starts counting from this point.
6. **Grid order**: Grid positions are defined by `RaceConfiguration` — car entities have `gridIndex` for spawn position. The countdown locks cars at their grid positions; no additional ordering logic needed here.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 001**: Config validation, reentrant init()
- **Story 004**: Position tracking and hysteresis (active only during Racing sub-state)
- **Story 007**: Race-end conditions (active during Racing sub-state)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-3**: startRace() begins Countdown with cars locked at grid positions
  - Given: System in `"ready"` state after `init(validConfig)`
  - When: `startRace()` is called
  - Then: Internal sub-state is `"countdown"`; `physics.setLocked(carId, true)` was called for every car; grid order matches the grid order from RaceConfiguration; `race.starting` event is emitted on the first pipeline tick (not synchronously during `startRace()`)
  - Edge cases: `startRace()` called while already in a race sub-state — should be a no-op or error; `startRace()` called without prior `init()` — should error

- **AC-4**: Countdown 5-light sequence and unlock on GREEN
  - Given: System in `"countdown"` sub-state
  - When: `tick()` is called 60 times
  - Then: `race.light.countdown` fires with `lightsOn: 4`
  - When: `tick()` is called another 60 times (120 total)
  - Then: `race.light.countdown` fires with `lightsOn: 3`
  - (Repeat for 5→4→3→2→1→0 sequence, 60 ticks each phase)
  - When: tick 300 completes (5 × 60)
  - Then: `race.green.flag` is emitted with `{ raceId, timestamp }`; all cars are unlocked (`physics.setLocked(carId, false)`); sub-state transitions to `"greenFlag"`; race clock begins
  - Edge cases: Tick count is exactly 60 per phase — test at tick 59 (no emission yet) and tick 60 (emission fires); GREEN emits on the 60th tick of the 5th phase = tick 300 total (5 phases × 60 ticks); if a car was manually locked externally, GREEN unlocks it

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/race-management/countdown-greenflag_test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (init + config validation must be DONE)
- Unlocks: Story 003, 004, 005, 006, 007, 008
