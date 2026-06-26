# Story 002: 20Hz Sampling Loop

> **Epic**: Telemetry Recorder
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/telemetry-recorder.md`
**Requirement**: `TR-TELEMETRY-002`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0022: Telemetry Recorder
**ADR Decision Summary**: Dev-only telemetry capture at 20Hz (every 3 ticks). Direct reads from CarEntity physics/runtime fields. Appends TelemetrySample to per-car array.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: None — pure TypeScript, zero Babylon.js imports.

**Control Manifest Rules (this layer)**:

- Required: D7 (20Hz sampling every 3 ticks), D-F2 (read-only — never writes state)
- Forbidden: D-F3 (never emit Event Bus events)
- Guardrail: D-G1 (zero bytes in production build) — applies globally via `__DEV__`

---

## Acceptance Criteria

_From GDD `design/gdd/telemetry-recorder.md`, scoped to this story:_

- [ ] **AC-1**: `tick()` called 9 times with 1 car appends exactly 3 samples (every 3rd call: tick 0, 3, 6)
- [ ] **AC-2**: Each sample's fields match the CarEntity state at the moment of sampling — speed, rpm, throttle, brake, steer, gear, lateralG, fuel, tireCondition, splinePos, aiState
- [ ] **AC-3**: `tick()` with empty `cars` array produces no error and no samples
- [ ] **AC-4**: New car appearing mid-session (late joiner) starts receiving samples on the next sample tick — no gap or crash
- [ ] **AC-5**: `tick()` does nothing when `__DEV__` is false (early return guard)

---

## Implementation Notes

_Derived from ADR-0022 Implementation Guidelines:_

**Signature:**

```typescript
tick(dt: number, cars: CarEntity[], tickCount: number): void {
  if (!__DEV__) return;
  // ...
}
```

**Sampling interval:** `telemetry.sampleInterval` (default 3 ticks = 20Hz at 60Hz tick rate). Config key from Tuning Knobs table in GDD.

**Data paths (reads only — never writes game state):**

| CarEntity field             | Sample field  | Source system     |
| --------------------------- | ------------- | ----------------- |
| `car.physics.speedKmh`      | speed         | Physics/Handling  |
| `car.physics.rpm`           | rpm           | Physics/Handling  |
| `car.runtime.throttle`      | throttle      | Input / AI Driver |
| `car.runtime.brake`         | brake         | Input / AI Driver |
| `car.runtime.steer`         | steer         | Input / AI Driver |
| `car.physics.gear`          | gear          | Physics/Handling  |
| `car.physics.lateralG`      | lateralG      | Physics/Handling  |
| `car.runtime.fuelLevel`     | fuel          | Fuel              |
| `car.runtime.tireCondition` | tireCondition | Tire Wear         |
| `car.runtime.splinePos`     | splinePos     | Race Management   |
| `car.aiDriver?.state ?? -1` | aiState       | AI Driver         |

**CarEntity interface reference:** See ADR-0005 (CarEntity identity-only) and the per-system ADRs listed in ADR-0022 Dependencies.

**Tuning knobs used:** `telemetry.sampleInterval` (default 3, range 1–10). Read from ConfigManager.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 001]: Data model and storage construction
- [Story 003]: Console summary log (separate interval logic)
- [Story 004]: JSON export serialization
- [Story 005]: Race lifecycle event wiring

---

## QA Test Cases

- **AC-1**: Samples every 3 ticks (20Hz at 60Hz)
  - Given: A TelemetryRecorder with 1 car `"test-car"`
  - When: `tick()` is called 9 times with tickCount 0, 1, 2, ... 8
  - Then: `samples["test-car"].length === 3` (calls at ticks 0, 3, 6)
  - And: No samples recorded on ticks 1, 2, 4, 5, 7, 8
  - Edge cases: tickCounter wraps around (defensive, ~2³² ticks)

- **AC-2**: Sample fields match CarEntity data
  - Given: A mock CarEntity with known values in physics/runtime fields
  - When: `tick()` is called on tick 3
  - Then: The recorded sample has matching values for all 12 fields
  - Edge cases: Player car (aiDriver = undefined → aiState = -1)

- **AC-3**: Empty cars array produces no samples
  - Given: An empty `cars[]`
  - When: `tick()` is called 6 times
  - Then: No errors thrown, no samples appended
  - And: `samples` Map remains unchanged

- **AC-4**: Late-joining car recorded immediately
  - Given: 2 cars initially, then a 3rd added on tick 3
  - When: `tick()` is called on ticks 0, 3, 6
  - Then: 3rd car's first sample is on tick 3 (not before)
  - And: All 3 cars have correct sample counts

- **AC-5**: No-op when **DEV** is false
  - Given: A mock with `__DEV__ = false`
  - When: `tick()` is called
  - Then: Returns immediately without allocating or appending

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:

- Logic: `tests/unit/dev-infra/telemetry-sampling_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (TelemetrySample type, Map storage)
- Unlocks: Story 003 (needs samples to generate console output)
