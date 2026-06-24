# Story 001: Telemetry Data Model & Storage

> **Epic**: Telemetry Recorder
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/telemetry-recorder.md`
**Requirement**: `TR-TELEMETRY-001`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0022: Telemetry Recorder
**ADR Decision Summary**: Dev-only telemetry capture at 20Hz. Direct reads from CarEntity. Plain arrays per car. JSON export. Zero production cost via `__DEV__` guard.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: None — pure TypeScript, zero Babylon.js imports.

**Control Manifest Rules (this layer)**:

- Required: D7 (20Hz sampling), D-F2 (read-only — never writes state)
- Forbidden: D-F3 (never emit Event Bus events), D-F4 (never statically import Dev Infra from production code)
- Guardrail: D-G1 (zero bytes in production build)

---

## Acceptance Criteria

_From GDD `design/gdd/telemetry-recorder.md`, scoped to this story:_

- [ ] **AC-1**: `TelemetrySample` interface defines all 13 typed fields matching the GDD schema (tick, t, speed, rpm, throttle, brake, steer, gear, lateralG, fuel, tireCondition, splinePos, aiState)
- [ ] **AC-2**: `TelemetryRecorder` class maintains `Map<string, TelemetrySample[]>` with lazy key creation — a car's array is created on first sample for that car
- [ ] **AC-3**: `clear()` resets all per-car arrays to empty AND resets `tickCounter` and `logCounter` to 0
- [ ] **AC-4**: `clear()` is idempotent — calling on already-empty state produces no error, no memory leak
- [ ] **AC-5**: Initial state is empty Map, tickCounter = 0, logCounter = 0

---

## Implementation Notes

_Derived from ADR-0022 Implementation Guidelines:_

**Data Structures:**

```
interface TelemetrySample {
  tick: number;       // Physics tick when recorded
  t: number;          // Elapsed race time (seconds)
  speed: number;      // km/h
  rpm: number;
  throttle: number;   // 0.0–1.0
  brake: number;      // 0.0–1.0
  steer: number;      // -1.0–1.0
  gear: number;       // -1, 1–6
  lateralG: number;   // m/s²
  fuel: number;       // 0.0–1.0
  tireCondition: number; // 0.0–1.0
  splinePos: number;  // 0.0–1.0 position on track spline
  aiState: number;    // 0=Normal, 1=Following, 2=Passing (AI only), -1 (player)
}
```

**Storage:** `private samples: Map<string, TelemetrySample[]> = new Map()`

**Counters:** `private tickCounter = 0; private logCounter = 0;`

**`__DEV__` guard:** Class is instantiated only behind `if (__DEV__)`. The entire file compiles away in production builds. Use `import.meta.env.DEV` as the guard expression.

**Team name storage:** Team name is read from CarEntity or config at export time — this story defines the `getTeamName(carId): string` helper or documents where team name lives (e.g., `car.teamId` → resolve from config/teams).

**Key design decisions:**

- Plain arrays, NOT ring buffer (as per ADR-0022 Consequences)
- Map keys are stable string identifiers (`car.id`) matching the CarEntity identity contract (ADR-0005)
- All fields are flat scalars — no nested objects, no serialization needed

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 002]: The `tick()` method that populates samples from CarEntity
- [Story 003]: Console summary log output
- [Story 004]: JSON export serialization
- [Story 005]: Event Bus subscriptions for race lifecycle

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1**: TelemetrySample interface fields
  - Given: A TelemetrySample object
  - When: Constructed with all 13 fields
  - Then: `tick`, `t`, `speed`, `rpm`, `throttle`, `brake`, `steer`, `gear`, `lateralG`, `fuel`, `tireCondition`, `splinePos`, `aiState` all have correct types
  - Edge cases: `aiState = -1` for player, `0/1/2` for AI; `gear = -1` for reverse

- **AC-2**: Map storage accepts per-car arrays
  - Given: An empty TelemetryRecorder
  - When: Adding samples for car `"macklen"` and car `"willard"`
  - Then: `samples.get("macklen")` is an array with correct samples
  - And: `samples.get("willard")` is a separate array
  - And: `samples.size === 2`

- **AC-3**: clear() empties all arrays and resets counters
  - Given: A TelemetryRecorder with samples for 3 cars, tickCounter=42
  - When: clear() is called
  - Then: All per-car arrays are empty (length 0)
  - And: tickCounter === 0, logCounter === 0

- **AC-4**: clear() is idempotent
  - Given: A TelemetryRecorder with empty arrays, counters already 0
  - When: clear() is called twice
  - Then: No error, state unchanged

- **AC-5**: Initial state is empty
  - Given: A new `TelemetryRecorder()`
  - Then: `samples` Map is empty, `tickCounter === 0`, `logCounter === 0`

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:

- Logic: `tests/unit/dev-infra/telemetry-data-model_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None (foundational data types and storage — first story in epic)
- Unlocks: Story 002, Story 003, Story 004, Story 005, Story 006
