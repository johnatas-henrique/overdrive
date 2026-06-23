# Story 004: Confirm Gatekeeping & Auto-Release

> **Epic**: Pit Stop
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/pit-stop.md`
**Requirement**: `TR-PIT-006`, `TR-PIT-008`
_(TR-PIT-006: "Emit pit.status (entered, stopped, departed, completed) and car.stalled_in_pit (if merge-timer times out); pit.total_time per car.")_
_(TR-PIT-008: "Stall detection: if car stays in pitStopped longer than maxPitTime (configurable, default 15s), emit car.stalled_in_pit.")_

**ADR Governing Implementation**: ADR-0014: Pit Stop Flow
**ADR Decision Summary**: `confirm` event gatekept to `pitState === 'pitStopped'` AND `tiresDone === true`. Resolved via `playerCarId` from `RaceConfiguration`. Auto-release after `exitGraceTimeout` (3s) when both services complete. Stall detection after `maxPitTime` emits `car.stalled_in_pit`.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript timer + state logic. No Babylon APIs.

**Control Manifest Rules (this layer)**:

- Required: C49 — Pit Stop: `confirm` gatekept — only handled when `pitState === 'pitStopped'`
- Required: C50 — Pit Stop: AI never exits early

---

## Acceptance Criteria

_From GDD `design/gdd/pit-stop.md`, scoped to this story:_

- [ ] **AC-1**: Player can press confirm after tire change completes — leaves with fresh tires and current fuel level (transitions to `departing`)
- [ ] **AC-2**: If confirm not pressed and both services complete, auto-release after `pit.exitGraceTimeout` (3s)
- [ ] **AC-3**: Confirm pressed during tire change is ignored — car remains in `pitStopped`
- [ ] **AC-4**: Confirm pressed when `pitState` is NOT `pitStopped` (i.e., `pitEntry`, `departing`, `onTrack`) is silently ignored
- [ ] **AC-5**: Confirm pressed after tires done but before refuel complete — refuel stops at current fuel level, car departs with partial fuel
- [ ] **AC-6**: `getPitTimer(carId)` returns `PitTimer` with `fuelLevel`, `maxFuel`, `tireDone`, `refuelDone`, `tireTimer` fields for HUD consumption
- [ ] **AC-7**: Stall detection — if car stays in `pitStopped` longer than `maxPitTime` (default 15s), emit `car.stalled_in_pit` on Event Bus

---

## Implementation Notes

_Derived from ADR-0014 Implementation Guidelines:_

### Confirm Gatekeeping Logic

```typescript
// Pit Stop subscribes to confirm event (ADR-0006), resolves to playerCarId:
onConfirm(): void {
  const carId = this.playerCarId;
  if (pitStates.get(carId) !== 'pitStopped') return;   // AC-4: ignore non-pit
  if (!this.tiresDone.get(carId)) return;               // AC-3: ignore — tires still changing
  transitionToDeparting(carId);                          // AC-1, AC-5: exit with partial fuel, fresh tires
}
```

### Auto-Release Logic

```typescript
// Checked each tick during pitStopped for player car:
if (playerCarInPitStopped) {
  const bothDone = refuelDone && tiresDone;
  if (!bothDone) continue; // AC-2: not yet

  // Start grace timer on first tick both services complete
  if (graceTimer === undefined) graceTimer = 0;
  graceTimer += dt;

  if (graceTimer >= exitGraceTimeout) {
    transitionToDeparting(playerCarId); // AC-2: auto-release
  }
}
```

### Stall Detection

```typescript
// Checked each tick during pitStopped for any car:
if (pitStoppedDuration > maxPitTime) {
  eventBus.emit("car.stalled_in_pit", { carId });
}
```

### Key Points

1. `playerCarId` stored from `init(config)` — confirm resolves to player's car.
2. Confirm is ignored if `pitState !== 'pitStopped'` (AC-4) — this covers confirm pressed during `pitEntry`, `departing`, or `onTrack`.
3. Confirm is ignored if `tiresDone === false` (AC-3) — half-changed tires not physically meaningful.
4. Fuel stops exactly at its current level on confirm (AC-5) — no refuel while departing.
5. AI cars never trigger confirm logic — they depart automatically in Story 006.
6. PitTimer updates every tick during pitStopped.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 005: Pit exit guidance, merge check, return to track (the actual `departing` transition mechanics)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these._

- **AC-1**: Confirm after tires done
  - Given: Car in `pitStopped`, `tiresDone === true`, confirm event received
  - When: `confirmPitExit(playerCarId)` is called
  - Then: `getPitState(playerCarId)` returns `'departing'`; fuel level is unchanged from before confirm
  - Edge cases: Confirm called when fuel is at max (full tank, fresh tires — clean exit); confirm called when fuel is at 10% (partial fuel, fresh tires)

- **AC-2**: Auto-release after exitGraceTimeout
  - Given: Car in `pitStopped`, both services complete (refuelDone && tiresDone)
  - When: `tick()` is called repeatedly for `exitGraceTimeout` seconds with no confirm
  - Then: After grace timer elapses, `getPitState(carId)` returns `'departing'`
  - Edge cases: `exitGraceTimeout = 0` — immediate auto-release; both services complete on same tick as a prior service — timer starts correctly

- **AC-3**: Confirm ignored during tire change
  - Given: Car in `pitStopped`, `tiresDone === false` (tires still changing)
  - When: `confirmPitExit(playerCarId)` is called
  - Then: Car remains in `pitStopped`; no transition to `departing`
  - Edge cases: Confirm called on the exact tick tire timer reaches `tireChangeDelay` — depends on execution order (processed after service update)

- **AC-4**: Confirm ignored outside pitStopped
  - Given: Car in `pitEntry` (or `departing`, or `onTrack`)
  - When: `confirmPitExit(playerCarId)` is called
  - Then: No state transition occurs; event is silently dropped
  - Edge cases: Confirm during `departing` — car continues normal exit sequence

- **AC-5**: Confirm with partial refuel
  - Given: Car in `pitStopped`, `tiresDone === true`, fuel at 30%, refuel active
  - When: `confirmPitExit(playerCarId)` is called
  - Then: Car transitions to `departing`; fuel level remains at 30%; no further `addFuel` calls for this car
  - Edge cases: Confirm on same tick as refuel would fill tank (tick order matters — confirm processed after service update)

- **AC-6**: PitTimer interface
  - Given: Car in `pitStopped`
  - When: `getPitTimer(carId)` is called
  - Then: Returns object with `fuelLevel: number`, `maxFuel: number`, `tireDone: boolean`, `tireTimer: number`, `refuelDone: boolean`
  - Edge cases: Car not in `pitStopped` — returns `undefined`; car ID does not exist — returns `undefined`

- **AC-7**: Stall detection
  - Given: Car in `pitStopped` for longer than `maxPitTime` (default 15s)
  - When: `tick()` is called after `maxPitTime` has elapsed
  - Then: `car.stalled_in_pit` event emitted on Event Bus; car remains in `pitStopped`
  - Edge cases: `maxPitTime = 0` — stalls immediately on entry; stall detected while player is away (AFK)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/pit-stop/story-004-confirm-gating.test.ts` — must exist and pass (~8 tests)
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (services — tiresDone flag, refuel state), ADR-0006 (Input — confirm event), ADR-0023 (ConfigManager — pit.exitGraceTimeout, pit.maxPitTime)
- Unlocks: Story 005 (pit exit)
