# Story 006: DNF Exceptions — Pit Entry, Stalled in Pit, Last Lap

> **Epic**: Race Management (Core)
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/race-management.md`
**Requirement**: `TR-RM-004` (DNF lifecycle — exception paths)

**ADR Governing Implementation**: ADR-0015: Race Management
**ADR Decision Summary**: When `car.stopped` fires for a pendingDNF car, three exceptions are checked before registering DNF: (1) car is in pit entry zone → let pit stop handle it, no DNF; (2) car is on last lap near finish line → let car coast across, no DNF; (3) `car.stalled_in_pit` event fires → register DNF with `stalled_in_pit` reason. Pit zone determination uses geometric query from Track data, not Pit Stop system state.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No Babylon APIs used. Depends on Track's `isInPitEntryZone()` for geometric spatial check. Depends on `pit.status` and `car.stalled_in_pit` events from Pit Stop system.

**Control Manifest Rules (this layer)**:

- Required: C54 (DNF lifecycle with exceptions), C52 (sub-state under GSM Racing)
- Forbidden: C-F2 (never use Havok trigger volumes for pit zone detection — use inline XZ point-in-box)
- Guardrail: C-G7 (Race Management: < 0.01ms/tick)

---

## Acceptance Criteria

_From GDD `design/gdd/race-management.md`, scoped to this story:_

- [ ] **AC-10**: Fuel-empty coast to stop is NOT DNF if car reaches pit entry zone before stopping
- [ ] **AC-11**: Fuel-empty coast to stop is NOT DNF if car is on last lap near finish line
- [ ] **AC-12**: Stalled in pit (entered zone but stopped before garage) registers DNF with correct reason

---

## Implementation Notes

_Derived from ADR-0015 Implementation Guidelines:_

1. **Pit zone exception (AC-10)**: On `car.stopped` with pendingDNF, call `track.isInPitEntryZone(car)` — a geometric XZ point-in-box check (see ADR-0025/Track for implementation). If true → do NOT register DNF. The car can coast to its garage slot → Pit Stop system refuels → race continues. Also subscribe to `pit.status(pitStopped)` to clear pendingDNF for that carId.
2. **Last lap exception (AC-11)**: On `car.stopped` with pendingDNF, check if `lapCount[carId] >= raceConfig.lapCount - 1` (on final lap) AND `splinePosition > trackLength * 0.9` (near finish). If both true → do NOT register DNF. The car may coast across the line from momentum, completing the race normally.
3. **Stalled in pit (AC-12)**: Subscribe to `car.stalled_in_pit` event (emitted by Pit Stop). Unlike the `car.stopped` handler, this event directly calls `registerDNF(carId, "stalled_in_pit")`. No exception checks — if Pit Stop says the car stalled, it's DNF.
4. **pendingDNF lifecycle**: Added via `car.fuel_empty` (Story 005). Removed via `pit.status(pitStopped)` — Pit Stop reports the car is being serviced, fuel issue resolved. If neither exception fires and car stops on track → DNF registered (Story 005).
5. **Order of checks in car.stopped handler**: (1) Checkered guard → (2) pendingDNF check → (3) pit entry zone check → (4) last lap check → (5) registerDNF. Order matters — pit zone takes priority over last lap because a car in pit zone cannot be on track.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 005**: Basic DNF lifecycle (fuel_empty → pendingDNF, tire blowout logging)
- **Story 007**: Race-end conditions (player DNF from Story 005/006 triggers race end)
- **Story 008**: Results aggregation (reads dnfRegistry)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-10**: Pit entry zone exception — no DNF
  - Given: Car is in pendingDNF (fuel_empty); car.position is inside pitEntryZone BoundingBox (car reached pit entry before stopping)
  - When: `car.stopped` fires for this carId
  - Then: No DNF registered; `car.dnf` event does NOT fire; car is NOT removed from positionGrid; internal check: `isInPitEntryZone(car)` returns true → returns without DNF
  - Edge cases: Car coasts to EXACTLY the pit entry boundary — isInPitEntryZone check must be inclusive; car enters pit entry zone but doesn't reach garage — handled by AC-12 (stalled_in_pit); car enters pit, is serviced, exits — `pit.exit` fires, race continues normally, no DNF

- **AC-11**: Last lap near finish — no DNF
  - Given: Car is in pendingDNF (fuel_empty); car.lapCount = raceConfig.lapCount - 1 (on last lap); car.splinePos > trackLength × 0.9 (near finish line)
  - When: `car.stopped` fires for this carId
  - Then: No DNF registered; race continues (car may still cross finish line from momentum)
  - Edge cases: Car on last lap but NOT near finish (splinePos < 0.9) — no exception applies, DNF fires normally; car exactly at finish line (splinePos ≈ 0) on last lap — if car has already completed the lap (crossed line), then lap count = raceConfig.lapCount, race ends as checkered → car.stopped ignored (subState === Checkered); car on last lap, near finish, crosses finish line (lap completes) and wheels die AFTER the line — race ends via condition 1 (checkered), car.stopped ignored

- **AC-12**: Stalled in pit registers DNF with correct reason
  - Given: Car entered pit entry zone; car stopped before reaching garage
  - When: `car.stalled_in_pit` fires for this carId
  - Then: `registerDNF(carId, "stalled_in_pit")` is called; `dnfRegistry` contains `{ carId: "stalled_in_pit" }`; `car.dnf` event fires with `{ carId, reason: "stalled_in_pit" }`; car removed from positionGrid; if stalled player → sub-state transitions to Checkered
  - Edge cases: Car reaches garage, is serviced, exits — no stalled_in_pit event, no DNF; car enters pit, stalls at garage entrance — stalled_in_pit fires, DNF registered; car already DNF for fuel_empty when stalled_in_pit fires — second DNF is a no-op (dnfRegistry already has the carId)

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/race-management/dnf-exceptions.test.ts` OR playtest doc
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 005 (basic DNF lifecycle — pendingDNF mechanism, car.stopped handler structure)
- Unlocks: Story 007 (DNF completes the race-end condition set)
