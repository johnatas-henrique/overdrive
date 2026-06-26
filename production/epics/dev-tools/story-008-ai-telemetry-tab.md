# Story 008: AI Telemetry Tab

> **Epic**: Dev Tools
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/dev-tools.md`
**Requirement**: `TR-DVT-008` (added 2026-06-22)
_AI Telemetry tab in Dev Tools overlay — per-car speed, position, and active behavior node._

**ADR Governing Implementation**: ADR-0009: Dev Tools Architecture
**ADR Decision Summary**: Data source registration pattern. AI telemetry reads from Physics system (`physics.getAllTelemetry()`) and AI Driver (`aiDriver.getBehavior(carId)`). AI telemetry sample rate: every 10 ticks (configurable). Read-only on all systems.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No Babylon.js imports needed — pure DOM + Physics/AI Driver integration.

**Control Manifest Rules (this layer)**:

- **Required** (D6): Dev Tools: read-only on all systems — never writes state, never emits Event Bus events
- **Required** (D1): HTML overlay (`pointer-events: none`)
- **Data source coordination**: Requires `physics.getAllTelemetry()` to expose per-car speed and position, and `aiDriver.getBehavior(carId): 'Normal' | 'Following' | 'Passing'` to be added to AI Driver's public API (coordinate with AI Programmer)

---

## Acceptance Criteria

_From GDD `design/gdd/dev-tools.md`, scoped to this story:_

- [ ] AC-8a: AI Telemetry tab shows per-car speed (`physics.getSpeed(carId)`), position (`raceManager.getPosition(carId)`: lap + track progress), and active behavior node (`aiDriver.getBehavior(carId)`: `'Normal' | 'Following' | 'Passing'`)
- [ ] AC-8b: Table has one row per car with all three values; values update live each tick (sample rate: every 10 ticks)
- [ ] AC-8c: When no AI cars are registered (single-player test without AI), the tab renders a placeholder row with text "No AI cars on track" — graceful empty state

---

## Implementation Notes

_Derived from ADR-0009 Implementation Guidelines:_

1. **Data source registration**:

   ```typescript
   if (__DEV__) {
     devTools.registerDataSource("ai-telemetry", () => {
       const cars = physics.getAllTelemetry();
       return cars.map((car) => ({
         id: car.id,
         speed: physics.getSpeed(car.id),
         position: raceManager.getPosition(car.id),
         behavior: aiDriver.getBehavior(car.id),
       }));
     });
   }
   ```

2. **Data source APIs needed** (coordinate with respective system owners):
   - `physics.getSpeed(carId: string): number` — returns speed in km/h
   - `raceManager.getPosition(carId: string): { lap: number; trackProgress: number; overall: number }` — overall = 1-based position in race
   - `aiDriver.getBehavior(carId: string): 'Normal' | 'Following' | 'Passing'` — returns the AI car's current behavior state

3. **Sample rate**: Per GDD tuning knobs, default every 10 ticks. The `registerDataSource` reader is called by `_refreshDisplay()` which fires from `onEndFrameObservable`. Dev Tools caches the value and only re-reads every Nth call.

4. **Table rendering**: HTML `<table>` with columns: Car ID | Speed (km/h) | Position (Lap/Overall) | Behavior. Colored rows: player car in yellow, AI cars in white. Top row is always current race leader.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 003]: HTML overlay shell, `IDevTools` interface, tab scaffolding
- [Story 004]: Config tree panel
- [Story 005]: Event Bus inspector
- [Story 006]: GSM visualizer panel
- [Story 007]: Simulation Snapshot panel

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-8a**: per-car telemetry display
  - Given: the race has 3 AI cars (car-1, car-2, car-3)
  - And: physics reports speeds (car-1=120, car-2=115, car-3=108)
  - And: race management reports positions (car-1=1st, car-2=2nd, car-3=3rd)
  - And: AI driver reports behaviors (car-1=Following, car-2=Normal, car-3=Passing)
  - When: Dev Tools AI Telemetry tab is opened
  - Then: a table is displayed with 3 rows, one per car
  - And: each row shows car ID, speed, position, behavior node
  - And: the values match the system-reported data above

- **AC-8b**: live updates
  - Given: Dev Tools AI Telemetry tab is open
  - When: 10 game ticks elapse and physics speeds change
  - Then: the speed values in the table update to match the new physics state
  - And: the behavior node updates if the AI state changed

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/dev-tools/ai-telemetry-tab_test.ts` or documented playtest

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (needs overlay shell + `IDevTools.registerDataSource`)
- Unlocks: None
