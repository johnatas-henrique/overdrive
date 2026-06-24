# Story 003: fuel_empty Event & Edge Cases

> **Epic**: Fuel
> **Status**: Ready
> **Layer**: Core (slot #5 — pipeline)
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/fuel.md`
**Requirement**: `TR-FUEL-004` — fuelLevel === 0 → emit `car.fuel_empty` via Event Bus
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0011: Fuel Model
**ADR Decision Summary**: One-shot event emission with guard flag. `car.fuel_empty` emitted exactly once per car when `fuelLevel ≤ 0`. Race Management listens for this event to initiate DNF lifecycle. `baseRate = 0` (dev mode) means fuel never depletes.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript — Event Bus dependency is a typed interface (no engine API). Event payload is `{ carId: string }` per EventMap.

**Control Manifest Rules (this layer)**:

- Required: F7 — Event Bus synchronous emit
- Required: F8 — Subscriptions return `Subscription` with `unsubscribe()`
- Required: F10 — EventMap central type registry
- Required: F20 — Event Bus for state-change signals only
- Guardrail: F-G1 — Event Bus < 1 KB gzipped

---

## Acceptance Criteria

_From GDD `design/gdd/fuel.md`, scoped to this story:_

- [ ] AC-5: `car.fuel_empty` emitted via Event Bus when `fuelMult = 0` (i.e., fuelLevel ≤ 0)
- [ ] AC-6: Car coasts after `fuel_empty`; DNF only when velocity ≈ 0 (Fuel emits event; Race Management handles DNF lifecycle)
- [ ] AC-9: `baseRate = 0` makes fuel never deplete (dev mode)
- [ ] One-shot guard: `car.fuel_empty` emitted exactly once per car — `emittedEmpty[carId]` flag prevents re-emission every tick while fuel stays at 0
- [ ] Event payload: `"car.fuel_empty"` with `{ carId: string }` — matches EventMap type
- [ ] Emit is synchronous per ADR-0001 contract — `emit()` returns after all handlers execute on same call stack
- [ ] `baseRate = 0` → `fuelUsed = 0` every tick → fuelLevel never reaches 0 → no `car.fuel_empty` emission
- [ ] `fuelLevel ≤ 0` → `fuelMult = 0` (from Story 002) → Physics receives zero power → car coasts to stop

---

## Implementation Notes

_Derived from ADR-0011 Implementation Guidelines:_

```typescript
// One-shot event guard — placed after fuelLevel update in calculate():
if (fuelLevel <= 0 && !this.emittedEmpty[carId]) {
  this.emittedEmpty[carId] = true;
  eventBus.emit("car.fuel_empty", { carId });
}
```

_Key details:_

- The `emittedEmpty` guard is critical — without it, every tick where fuelLevel ≤ 0 would re-emit, flooding the Event Bus
- Event Bus interface is injected (not imported directly) — Fuel depends on `IEventBus` type, not a concrete implementation
- `Race Management` uses `car.fuel_empty` + `car.stopped` to declare DNF — Fuel only emits the empty event
- `baseRate` is read from `FuelConfig` each tick — setting `baseRate = 0` in config disables all consumption without code change
- If `addFuel` (Story 005) refuels a car that was empty, `emittedEmpty[carId]` is cleared so the event can fire again if the car re-empties

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 002]: `fuelMult` calculation and delivery to Physics
- [Story 005]: `addFuel` — clears `emittedEmpty` flag during refuel
- Race Management epic: DNF lifecycle (listens for `car.fuel_empty` + `car.stopped`)
- HUD epic: fuel empty warning flash (consumes `car.fuel_empty`)
- Audio epic: engine sputter audio cue (consumes `car.fuel_empty`)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1 (car.fuel_empty emitted when empty)**:
  - Given: "car-1" with `fuelLevel = 0.0001`, `baseRate = 0.02`, `efficiencyRate = 1.0`; Event Bus listener registered for `"car.fuel_empty"`
  - When: `calculate(0.016)` with `throttleAvg = 1.0`
  - Then: Event Bus received `emit("car.fuel_empty", { carId: "car-1" })`

- **AC-2 (emitted exactly once)**:
  - Given: "car-1" fuelMult = 0 (empty), `emittedEmpty[car-1] = true`
  - When: `calculate(0.016)` called for 5 consecutive ticks
  - Then: `"car.fuel_empty"` emitted exactly 1 time total

- **AC-3 (baseRate = 0 dev mode)**:
  - Given: "car-1" with `fuelLevel = 0.001`, `baseRate = 0.0`, `efficiencyRate = 1.0`
  - When: `calculate(0.016)` with `throttleAvg = 1.0` for 1000 ticks
  - Then: `fuelLevel` never reaches 0 (`fuelUsed = 0` each tick); `"car.fuel_empty"` never emitted

- **AC-4 (synchronous emit per ADR-0001)**:
  - Given: Event Bus listener that sets a synchronous flag
  - When: `calculate(0.016)` triggers fuel empty
  - Then: Flag is set before `calculate()` returns

- **AC-5 (multiple cars independent)**:
  - Given: "car-1" and "car-2" both at `fuelLevel = 0.0001`
  - When: `calculate(0.016)` with `throttleAvg = 1.0` for both
  - Then: `"car.fuel_empty"` emitted for car-1 AND car-2 (2 total events)

- **Integration assertions**:
  - Event payload type: `{ carId: string }` — TypeScript compile check against EventMap
  - `"car.fuel_empty"` is a registered literal in the EventMap type (no typos)

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/fuel/fuel-event.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002 (Consumption Math) — must be DONE (fuelMult = 0 triggers this event)
- Unlocks: Race Management DNF lifecycle (consumes `car.fuel_empty`)
