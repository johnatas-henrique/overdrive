# Story 007: Race Management Pit Timer Integration

> **Epic**: Pit Stop
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/pit-stop.md`
**Requirement**: `TR-PIT-009` (partial), `TR-PIT-006`
_(TR-PIT-009: "Race Management integration: pit.total_time (sum of pit stop durations per car) tracked by Race Management.")_
_(TR-PIT-006: "Emit pit.status (entered, stopped, departed, completed) and car.stalled_in_pit (if merge-timer times out); pit.total_time per car.")_

**ADR Governing Implementation**: ADR-0014: Pit Stop Flow (enables ADR-0015: Race Management)
**ADR Decision Summary**: Pit Stop emits `pit.exit(carId, totalTimeMs)` on Event Bus. Race Management receives this event and records `pitTotal` per car. Formula: `entryTravelTime + serviceTime + exitWaitTime + exitTravelTime`.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure Event Bus integration. No Babylon APIs.

**Control Manifest Rules (this layer)**:

- Required: F20 — Event Bus is the ONLY cross-system pattern for state-change signals
- Required: C53 — RM: reentrant `init()` — `eventBus.off().on()` prevents listener duplication
- Guardrail: C-G7 — Race Management: < 0.01ms/tick (position sort O(8 log 8))

---

## Acceptance Criteria

_From GDD `design/gdd/pit-stop.md`, scoped to this story:_

- [ ] **AC-1**: Race Management receives `pit.exit(carId, totalTimeMs)` event and stores `pitTotal` per car, accessible via `raceResults.getPitTime(carId): number | undefined`. Formula: `entryTravelTime + serviceTime + exitWaitTime + exitTravelTime`.
- [ ] **AC-2**: `pitTotal` time is zero for cars that never entered pit (baseline)
- [ ] **AC-3**: `pitTotal` is recorded at the moment `pit.exit` event is emitted — timing includes all four segments

---

## Implementation Notes

_Derived from ADR-0014 Implementation Guidelines:_

### Pit Stop Timer Calculation

```typescript
// Pit Stop tracks timing internally:
interface CarPitTiming {
  entryTime: number;   // tick at which car entered pitEntry
  stopTime: number;    // tick at which car reached pitStopped
  departTime: number;  // tick at which car transitioned to departing
  exitTime: number;    // tick at which car exited pitExitZone
}

// On pit.exit emission:
const totalTimeMs = timing.exitTime - timing.entryTime;
eventBus.emit('pit.exit', { carId, totalTimeMs });

// Race Management receives:
eventBus.on('pit.exit', (event) => {
  this.pitTimes.set(event.carId, event.totalTimeMs);
});

// Accessor:
getPitTime(carId: string): number | undefined {
  return this.pitTimes.get(carId); // undefined if never pitted
}
```

### Formula Breakdown

```
entryTravelTime = stopTime - entryTime    (pitEntry → pitStopped)
serviceTime     = departTime - stopTime   (pitStopped → departing)
exitWaitTime    = merge check wait time    (captured within departing)
exitTravelTime  = exitTime - departTime   (departing → onTrack)
pitTotal        = entryTravelTime + serviceTime + exitWaitTime + exitTravelTime
                = exitTime - entryTime    (same result)
```

### Integration Points

1. Pit Stop emits `pit.exit(carId, totalTimeMs)` on Event Bus in `returnToTrack()`.
2. Race Management subscribes via `eventBus.on('pit.exit', ...)` during its `init()`.
3. De-duplication: same pattern as other reentrant init — `eventBus.off().on()`.
4. `raceResults` stores the data; accessible post-race via `raceResults.getPitTime(carId)`.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Race Results display in UI (Presentation layer)
- Pit stop timing breakdown per segment (deferred to Alpha)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these._

- **AC-1**: RM receives pitTotal
  - Given: Pit Stop processes a full pit cycle (entry → stop → depart → exit)
  - When: `pit.exit(carId, totalTimeMs)` is emitted on Event Bus
  - Then: Race Management receives the event and stores `pitTotal = totalTimeMs` for this `carId`; `raceResults.getPitTime(carId)` returns `totalTimeMs`
  - Edge cases: Car pits multiple times — each pit exit overwrites the previous `pitTotal` with the latest

- **AC-2**: Zero time for non-pitting cars
  - Given: A car never enters pit (stays onTrack for entire race)
  - When: Race ends and results are queried
  - Then: `raceResults.getPitTime(carId)` returns `undefined`
  - Edge cases: Car that started pit entry but exited immediately (partial cycle) — emits pit.exit with minimal totalTimeMs (not undefined)

- **AC-3**: Timing is accurate
  - Given: A car completes a pit cycle in known simulated time (e.g., exactly 10,000ms)
  - When: `pit.exit` is emitted
  - Then: `totalTimeMs` in the event payload matches the known value within floating-point tolerance
  - Edge cases: Time is measured in milliseconds (not simulation ticks) — convert tick count via `tick * FIXED_DT`

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/pit-stop/story-007-race-mgmt-timer.test.ts` — must exist and pass (~4 tests)
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (state machine), Story 005 (exit → pit.exit emission), ADR-0015 (Race Management — raceResults.getPitTime interface), ADR-0001 (Event Bus — pit.exit event type)
- Unlocks: Race Results epic
