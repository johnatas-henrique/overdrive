# Story 003: Refuel & Tire Change Services

> **Epic**: Pit Stop
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/pit-stop.md`
**Requirement**: `TR-PIT-004`
_(TR-PIT-004: "During pitStopped: refuels at pit.refuelRate per tick via fuel.addFuel(carId, amount) and resets tires via tire.resetTires(carId) after pit.tireChangeDelay (default 2s); pit timer tracks total service time.")_

**ADR Governing Implementation**: ADR-0014: Pit Stop Flow
**ADR Decision Summary**: Tire change is binary (complete swap after fixed delay, player cannot leave early). Refuel is progressive (tick-by-tick via `addFuel`). Both run in parallel. Dev modes: `refuelRate=0` = instant, `tireChangeDelay=0` = instant.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure interface calls — `IFuel.addFuel()`, `ITireWear.resetTires()`. No Babylon APIs.

**Control Manifest Rules (this layer)**:

- Required: C39 — Binary tire change, `resetTires()` restores to 1.0 after `tireChangeDelay`
- Required: C35 — Pit Stop is sole external writer to fuel level (via `addFuel`)
- Required: C33 — Fuel consumption formula (not relevant here — Pit Stop calls addFuel)
- Guardrail: C-G9 — Fuel: < 0.001ms/car/tick; C-G10 — Tire: < 0.001ms/car/tick

---

## Acceptance Criteria

_From GDD `design/gdd/pit-stop.md`, scoped to this story:_

- [ ] **AC-1**: Refuel begins immediately after garage stop — `addFuel(carId, amount)` is called each tick at `pit.refuelRate` units/s. `PitTimer` exposes `fuelLevel` and `maxFuel` for HUD consumption.
- [ ] **AC-2**: Tire change starts immediately when car reaches `pitStopped`, completes after `pit.tireChangeDelay` — `resetTires(carId)` called, `tireCondition` resets to 1.0
- [ ] **AC-3**: `pit.refuelRate = 0` → instant refuel (dev mode — fuel goes to maxCapacity in one tick)
- [ ] **AC-4**: `pit.tireChangeDelay = 0` → instant tire change (dev mode — `resetTires` called immediately)
- [ ] **AC-5**: If refuel completes (tank full) while tire change is still running, tire change continues unaffected
- [ ] **AC-6**: If tire change completes while refuel is still running, car remains in `pitStopped` (waiting for confirm or grace timeout)

---

## Implementation Notes

_Derived from ADR-0014 Implementation Guidelines:_

```typescript
// Called each tick for each car in pitStopped
function processServices(carId: string, dt: number): void {
  // Refuel — progressive, always active
  const currentFuel = fuel.getFuelLevel(carId);
  if (currentFuel < fuel.maxCapacity) {
    const added = pit.refuelRate * dt;
    fuel.addFuel(carId, added);
  }

  // Tire change — binary, always completes
  if (!tireTimer.has(carId)) {
    tireTimer.set(carId, 0);
  }
  const elapsed = tireTimer.get(carId) + dt;
  tireTimer.set(carId, elapsed);
  if (elapsed >= pit.tireChangeDelay) {
    tireWear.resetTires(carId);
    tireTimer.delete(carId);
  }

  // confirm only becomes available after tires are done
  const tiresDone = tireTimer.has(carId) === false;
  this.tiresDone.set(carId, tiresDone);

  // Update PitTimer for HUD consumption
  updatePitTimer(carId);
}
```

1. Dev mode: `pit.refuelRate = 0` — check `if (pit.refuelRate <= 0)` → set fuel to `maxCapacity` immediately.
2. Dev mode: `pit.tireChangeDelay = 0` — skip timer, call `resetTires(carId)` immediately.
3. Both services are independent — completion of one does not cancel the other.
4. `tiresDone` flag is the gate for confirm availability (Story 004).
5. `PitTimer` fields: `fuelLevel`, `maxFuel`, `tireDone`, `tireTimer`, `refuelDone`. Updated each tick during pitStopped.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 004: Confirm gatekeeping, grace timeout auto-release
- HUD: Pit overlay rendering (this story exposes PitTimer data only)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these._

- **AC-1**: Refuel begins immediately after garage stop
  - Given: A car has just transitioned to `pitStopped`, fuel tank currently at 50% capacity
  - When: `tick()` is called with dt = 0.016 (one frame)
  - Then: `fuel.addFuel(carId, amount)` is called where amount = `pit.refuelRate * 0.016`; `PitTimer.fuelLevel` ≥ previous fuelLevel
  - Edge cases: Tank at 99.9% capacity — single tick fills to max (clamped); `pit.refuelRate = 0` — tank fills to max in first tick

- **AC-2**: Tire change after tireChangeDelay
  - Given: A car has just transitioned to `pitStopped`
  - When: `tick()` is called repeatedly with total elapsed ≥ `pit.tireChangeDelay`
  - Then: `tireWear.resetTires(carId)` is called exactly once; `PitTimer.tireDone` is `true`
  - Edge cases: `pit.tireChangeDelay = 0` — `resetTires` called immediately on first tick

- **AC-3**: Instant refuel (dev mode)
  - Given: `pit.refuelRate = 0`, car in `pitStopped` with fuel at 0
  - When: One `tick()` is called
  - Then: Fuel goes directly to `maxCapacity`; `PitTimer.refuelDone` is `true`

- **AC-4**: Instant tire change (dev mode)
  - Given: `pit.tireChangeDelay = 0`, car in `pitStopped`
  - When: One `tick()` is called
  - Then: `tireWear.resetTires(carId)` is called; `PitTimer.tireDone` is `true`

- **AC-5**: Refuel completes first, tire continues
  - Given: Car in `pitStopped` with small fuel deficit but `tireChangeDelay` is long
  - When: Refuel finishes (tank full) but tire timer < `tireChangeDelay`
  - Then: Tire change continues unaffected; car remains in `pitStopped`; confirm is NOT available

- **AC-6**: Tire completes first, refuel continues
  - Given: Car in `pitStopped` with `tireChangeDelay` small but large fuel deficit
  - When: `tireChangeDelay` elapses and `resetTires` is called
  - Then: Refuel continues until tank full or confirm; car remains in `pitStopped`; confirm IS available after tire done

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/pit-stop/story-003-services.test.ts` — must exist and pass (~10 tests)
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (state machine), Story 002 (garage stop), ADR-0011 (IFuel — addFuel), ADR-0012 (ITireWear — resetTires), ADR-0023 (ConfigManager — pit.\* namespace)
- Unlocks: Story 004 (confirm gatekeeping)
