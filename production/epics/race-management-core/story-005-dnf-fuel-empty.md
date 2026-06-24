# Story 005: DNF Lifecycle — Fuel Empty Detection

> **Epic**: Race Management (Core)
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/race-management.md`
**Requirement**: `TR-RM-004` (DNF lifecycle — fuel_empty → pendingDNF → exceptions → DNF)

**ADR Governing Implementation**: ADR-0015: Race Management
**ADR Decision Summary**: DNF lifecycle is event-driven: `car.fuel_empty` marks the car as `pendingDNF`. Later `car.stopped` checks exceptions (pit zone, last lap) and, if none apply, calls `registerDNF()`. Tire blowout never triggers DNF — it is logged only.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No Babylon APIs used. Depends on Event Bus events from Fuel and Physics systems.

**Control Manifest Rules (this layer)**:

- Required: C54 (DNF lifecycle — fuel_empty → pendingDNF → guards → DNF), C52 (sub-state under GSM Racing)
- Forbidden: C-F8 (never call `gsm.transition()` from within pipeline slot except from `endRace()`)
- Guardrail: C-G7 (Race Management: < 0.01ms/tick)

---

## Acceptance Criteria

_From GDD `design/gdd/race-management.md`, scoped to this story:_

- [ ] **AC-9**: Player DNF (fuel empty + coast to stop, not near pit, not near finish) transitions to Checkered
- [ ] **AC-13**: Tire blowout does NOT trigger DNF under any circumstance

---

## Implementation Notes

_Derived from ADR-0015 Implementation Guidelines:_

1. **Subscription pattern**: In `init()`, subscribe to `car.fuel_empty` and `car.stopped` using `eventBus.off().on()` for reentrancy.
2. **pendingDNF**: A `Set<string>` added during `init()`. When `car.fuel_empty` fires for carId → `pendingDNF.add(carId)`. The car continues coasting (engine power = 0, velocity decreasing).
3. **car.stopped handler**: When `car.stopped` fires:
   - If subState === "checkered" → return early (race already ended)
   - If carId NOT in pendingDNF → no-op (car stopped for a different reason)
   - If carId in pendingDNF:
     - Check exception 1: isInPitEntryZone(car) → if yes, skip DNF (handled by Story 006)
     - Check exception 2: on last lap near finish → if yes, skip DNF (handled by Story 006)
     - No exception → call `registerDNF(carId, "fuel_empty")`
4. **registerDNF()**:
   - `dnfRegistry.set(carId, reason)`
   - `positionGrid.delete(carId)` — car disappears from live grid
   - Emit `car.dnf { carId, reason }`
   - If carId === playerCarId → `setSubState("Checkered")`
5. **Tire blowout**: Subscribe to `car.tire_blown` but do NOT add to pendingDNF. Log only (no DNF action). See GDD rule: "Tire blowout: logged but never causes DNF automatically."
6. **Guard for car.stopped after Checkered**: The `if (subState === "Checkered") return;` guard at the top of the handler is essential — prevents false DNF registrations when race has already ended and a car coast stops after the checkered flag.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 006**: DNF exceptions (pit entry zone, last lap near finish, stalled in pit)
- **Story 003**: Lap detection (read by exception checks)
- **Story 007**: Race-end conditions
- **Story 008**: Results aggregation (reads dnfRegistry)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-9**: Fuel-empty + coast to stop → DNF → Checkered
  - Given: Car in Racing sub-state; `car.fuel_empty` fires for carId → car added to pendingDNF
  - When: `car.stopped` fires for same carId (car.position is NOT in pitEntryZone AND car is NOT on last lap near finish line)
  - Then: `registerDNF(carId, "fuel_empty")` is called; `dnfRegistry` contains `{ carId: "fuel_empty" }`; car removed from positionGrid; `car.dnf` event fires with `{ carId, reason: "fuel_empty" }`; if carId === playerCarId → sub-state transitions to Checkered; race timer stops
  - Edge cases: `car.stopped` fires but carId is NOT in pendingDNF — no DNF (car stopped for a different reason, e.g., collision debris); multiple cars DNF in sequence — each processed independently; `car.stopped` fires while sub-state is already Checkered — no DNF registered

- **AC-13**: Tire blowout never triggers DNF
  - Given: Racing sub-state
  - When: `car.tire_blown` fires for any carId
  - Then: No DNF is registered; no change to sub-state; no `car.dnf` event fires; the event is silently ignored (logged only)
  - Edge cases: Tire blowout followed by `fuel_empty` later — DNF from `fuel_empty` is processed normally (tire_blown flag is irrelevant); tire blowout + `car.stopped` — car is NOT in pendingDNF, so no DNF even though car is stopped

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/race-management/dnf-fuel-empty_test.ts` OR playtest doc
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (init + event subscriptions), Story 002 (must be in Racing sub-state)
- Unlocks: Story 006 (DNF exceptions)
