# Story 001: Pit State Machine & Zone Detection

> **Epic**: Pit Stop
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/pit-stop.md`
**Requirement**: `TR-PIT-001`, `TR-PIT-002`
_(TR-PIT-001: "Map<carId, PitState> — FSM: onTrack → pitEntry → pitStopped → departing → onTrack; transitions gated by spline position.")_
_(TR-PIT-002: "PitStop reads pit zone from Track+Environment (isInPitEntryZone, isInPitExitZone) each tick during Racing state.")_

**ADR Governing Implementation**: ADR-0014: Pit Stop Flow
**ADR Decision Summary**: Per-car FSM with velocity-driven pit guidance. PitStop is a standalone Core system operating at pipeline slot #8. Zone detection via inline XZ point-in-box (no Havok triggers).

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No Babylon APIs used — pure TypeScript state machine over spline data.

**Control Manifest Rules (this layer)**:

- Required: C48 — Per-car state machine (`onTrack → pitEntry → pitStopped → departing → onTrack`)
- Required: C49 — `confirm` gatekept to `pitStopped`
- Forbidden: C-F2 — Never use Havok trigger volumes for pit zone detection
- Forbidden: C-F3 — Never set position/heading directly on a DYNAMIC PhysicsBody during pit entry/exit
- Guardrail: C-G6 — Pit Stop: ~0.001ms/car/tick

---

## Acceptance Criteria

_From GDD `design/gdd/pit-stop.md`, scoped to this story:_

- [ ] **AC-1**: Car entering pit entry BoundingBox transitions to `pitEntry` state — `getPitState(carId) === 'pitEntry'`
- [ ] **AC-2**: Two cars in `pitEntry` and `pitStopped` states maintain independent state transitions — calling `tick()` on one does not affect the other's state or progress
- [ ] **AC-3**: All cars initialize to `onTrack` state when `init()` is called
- [ ] **AC-4**: Pit Stop stores the 4-state enum as `PitState = 'onTrack' | 'pitEntry' | 'pitStopped' | 'departing'`

---

## Implementation Notes

_Derived from ADR-0014 Implementation Guidelines:_

1. Pure TypeScript FSM — zero Babylon imports. Fully testable with vitest.
2. `Map<carId, PitState>` with method `transitionTo(carId, newState)`. Invalid transitions throw `PitStopError`.
3. Zone detection via Track+Environment inline XZ point-in-box (ADR-0025 C61) — NOT Havok trigger volumes.
4. Pit Stop exposes `onZoneEntry(carId, zone: "pitEntry" | "pitExit")` — called by Track each tick.
5. Event Bus emissions: `pit.status(carId, 'idle'|'pitEntry'|'pitStopped'|'departing')` on every transition.
6. Each car tracks independent `pitState` — no shared state across cars.
7. `init()` subscribes to Event Bus, stores `playerCarId` from `RaceConfiguration`, initializes all cars to `onTrack`.
8. `PitTimer` data structure: `{ fuelLevel, maxFuel, tireDone, tireTimer, refuelDone }` — exposed via `getPitTimer(carId)`.

```typescript
// Core interface (ADR-0014)
interface IPitStop {
  init(
    track: ITrack,
    fuel: IFuel,
    tireWear: ITireWear,
    physics: IPhysicsWrite
  ): void;
  tick(dt: number): void;
  onZoneEntry(carId: string, zone: "pitEntry" | "pitExit"): void;
  getPitState(carId: string): PitState;
  getPitTimer(carId: string): PitTimer | undefined;
  confirmPitExit(carId: string): void;
  dispose(): void;
}

type PitState = "onTrack" | "pitEntry" | "pitStopped" | "departing";

interface PitTimer {
  fuelLevel: number;
  maxFuel: number;
  tireDone: boolean;
  tireTimer: number;
  refuelDone: boolean;
}
```

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 002: Pit entry guidance, speed limiting, garage stop
- Story 003: Refuel + tire change service timers
- Story 004: Confirm gatekeeping, grace timeout, auto-release
- Story 005: Pit exit merge check, return to track
- Story 006: AI pit strategy

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these._

- **AC-1**: Car entering pit entry BoundingBox transitions to `pitEntry` state
  - Given: A car at position X inside `pitEntryZone`
  - When: `onZoneEntry(carId, 'pitEntry')` is called
  - Then: `getPitState(carId)` returns `'pitEntry'`
  - Edge cases: Calling `onZoneEntry(carId, 'pitEntry')` when already `'pitEntry'` is a safe no-op; car outside zone has state `'onTrack'`

- **AC-2**: Two cars in different pit stages without interference
  - Given: Car A in `pitEntry`, Car B in `pitStopped`
  - When: `tick()` is called for both
  - Then: Car A's state does not change to `pitStopped` and Car B's state does not change to `departing` unless their respective spline progress conditions are met

- **AC-3**: All cars initialize to `onTrack`
  - Given: Pit Stop has been initialized with N cars
  - When: `getPitState()` is called for each car
  - Then: Every car returns `'onTrack'`
  - Edge cases: N = 0 (no cars — system handles gracefully)

- **AC-4**: PitState type definition
  - Given: The `PitState` type is defined
  - When: Used in a TypeScript type context
  - Then: Only the four literal strings `'onTrack'`, `'pitEntry'`, `'pitStopped'`, `'departing'` are assignable to it; any other value causes a compile-time error

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/pit-stop/story-001-state-machine.test.ts` — must exist and pass (~5 tests)
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: TR-EVB-001 (Event Bus), TR-TE-001 (Track spline data), TR-ECL-001 (CarEntity), TR-DCM-001 (ConfigManager for pit.\* namespace)
- Unlocks: Story 002
