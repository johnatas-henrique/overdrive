# Story 006: AI Pit Strategy

> **Epic**: Pit Stop
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/pit-stop.md`
**Requirement**: `TR-PIT-009`
_(TR-PIT-009: "Race Management integration: pit.total_time (sum of pit stop durations per car) tracked by Race Management.")_

**ADR Governing Implementation**: ADR-0014: Pit Stop Flow
**ADR Decision Summary**: Pit Stop owns AI pit timing trigger (not AI Driver). AI cars pit when fuel or tire hits critical threshold. AI cars never exit early — they wait for both services to complete before departing automatically (no confirm needed).

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript threshold comparison. No Babylon APIs.

**Control Manifest Rules (this layer)**:

- Required: C50 — Pit Stop: AI never exits early — waits for both fuel AND tire service complete
- Required: C47 — AI input suppressed during active pit stop by Pit Stop, not AI Driver

---

## Acceptance Criteria

_From GDD `design/gdd/pit-stop.md`, scoped to this story:_

- [ ] **AC-1a**: AI car enters pit (`pitEntry`) when `fuelLevel ≤ fuelCriticalThreshold`
- [ ] **AC-1b**: AI car enters pit (`pitEntry`) when `tireCondition ≤ tireCriticalThreshold`
- [ ] **AC-1c**: AI car never transitions to `departing` until both refuel is complete (`fuelLevel ≥ maxCapacity`) AND tire change is complete (`tireDone === true`)
- [ ] **AC-1d**: AI car does not require confirm input — departure is automatic when both services are complete
- [ ] **AC-1e**: AI car on track with both fuel and tire above thresholds does not pit (no false positive)
- [ ] **AC-2**: AI pit trigger runs before per-car state machine in `tick()` — flags pending pit on current tick, enters pit on next pass of entry zone

---

## Implementation Notes

_Derived from ADR-0014 Implementation Guidelines:_

```typescript
// AI pit trigger — runs at start of tick(), before per-car state machine
function tick(dt: number): void {
  // Phase 1: AI pit trigger
  for each AI car in onTrack:
    if (pendingPit.get(carId)) continue; // already flagged

    const fuelLevel = fuel.getFuelLevel(carId);
    const tireCond = tireWear.getTireCondition(carId);
    if (fuelLevel <= fuelCriticalThreshold || tireCond <= tireCriticalThreshold):
      pendingPit.set(carId, true);

  // Phase 2: Per-car state machine (existing)
  for each car in pitStates: // ...
}
```

1. AI cars are identified by checking if `carId !== this.playerCarId` (or via `aiDrivers` map if available).
2. `fuelCriticalThreshold` and `tireCriticalThreshold` defined in config (AIRaceConfig or teams config).
3. AI cars use the same `processServices()` mechanics as player — timing is identical.
4. AI departure is automatic: when `refuelDone && tiresDone`, transition immediately to `departing`. No confirm needed (AC-1d).
5. AI never exits early (AC-1c): both services must complete before departing.
6. No false positive (AC-1e): cars with healthy fuel + tire remain on track.
7. The trigger runs before the state machine so the `pendingPit` flag can take effect in the same tick's state transitions.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 003: Service mechanics (refuel + tire) — same for AI and player
- Story 004: Player confirm (AI does not use confirm)
- Story 005: Exit + merge (AI uses same mechanics)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these._

- **AC-1a**: Fuel threshold trigger
  - Given: AI car on track with `fuelLevel = fuelCriticalThreshold`
  - When: `tick()` is called
  - Then: `pendingPit(carId)` is set to `true`; car enters pit on next pass of entry zone
  - Edge cases: `fuelLevel = fuelCriticalThreshold - epsilon` — still triggers; `fuelLevel = fuelCriticalThreshold + epsilon` — does not trigger (AC-1e)

- **AC-1b**: Tire threshold trigger
  - Given: AI car on track with `tireCondition = tireCriticalThreshold`
  - When: `tick()` is called
  - Then: `pendingPit(carId)` is set to `true`
  - Edge cases: Both fuel and tire critical simultaneously — single pendingPit flag (not double-queued); tire threshold reached while fuel is fine — still triggers

- **AC-1c**: AI waits for both services
  - Given: AI car in `pitStopped` with refuel complete but tires still changing
  - When: Multiple `tick()` calls until tires complete
  - Then: Car does NOT depart until both refuelDone && tiresDone
  - Edge cases: Both complete on same tick — departure is immediate (same tick)

- **AC-1d**: AI departure without confirm
  - Given: AI car in `pitStopped` with both services complete
  - When: `tick()` is called
  - Then: Car transitions to `departing` automatically — no confirm
  - Edge cases: exitGraceTimeout does NOT apply to AI cars (AI departs immediately on service completion)

- **AC-1e**: No false positive
  - Given: AI car on track with `fuelLevel >> fuelCriticalThreshold` and `tireCondition >> tireCriticalThreshold`
  - When: `tick()` is called
  - Then: `pendingPit(carId)` remains `undefined` or `false`
  - Edge cases: AI car that just passed pit entry zone does not immediately pit (enters on next pass)

- **AC-2**: Trigger runs before state machine
  - Given: An AI car that reaches fuel critical threshold this tick
  - When: `tick()` begins execution
  - Then: AI trigger evaluation occurs before individual car state machine transitions
  - Edge cases: Trigger sets pendingPit in same tick that car crosses pitEntryZone — entry occurs on next zone pass (not same tick)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/pit-stop/story-006-ai-strategy.test.ts` — must exist and pass (~8 tests)
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (state machine), Story 003 (services), Story 004 (departure — modified to skip confirm for AI), ADR-0013 (AI Driver — AIDriverParams for critical thresholds), ADR-0011 (IFuel — getFuelLevel), ADR-0012 (ITireWear — getTireCondition)
- Unlocks: Story 007 (RM pit timer — AI pit triggers affect timing data)
