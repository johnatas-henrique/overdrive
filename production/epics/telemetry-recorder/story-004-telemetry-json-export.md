# Story 004: JSON Export

> **Epic**: Telemetry Recorder
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h
> **Last Updated**: 2026-06-26

## Context

**GDD**: `design/gdd/telemetry-recorder.md`
**Requirement**: `TR-TELEMETRY-005`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0022: Telemetry Recorder
**ADR Decision Summary**: JSON export via `window.__telemetry.export()` returning a JSON string. Race metadata + per-car sample arrays. Output structure defined in GDD.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: None — pure TypeScript, zero Babylon.js imports.

**Control Manifest Rules (this layer)**:

- Required: D9 (export via Dev Tools F3 + `window.__telemetry.export()`), D-F2 (read-only)
- Forbidden: D-F3 (never emit Event Bus events)
- Guardrail: D-G1 (zero bytes in production build)

---

## Acceptance Criteria

_From GDD `design/gdd/telemetry-recorder.md`, scoped to this story:_

- [ ] **AC-1**: `window.__telemetry.export()` returns a string that can be parsed by `JSON.parse()` AND the parsed object contains `race` and `cars` top-level keys matching the GDD JSON structure
- [ ] **AC-2**: JSON structure matches GDD specification exactly — race metadata (`track`, `laps`, `startTime`, `duration`) plus per-car entries with `team` string and `samples` array of full TelemetrySample objects
- [ ] **AC-3**: Empty export (no samples recorded) returns valid JSON with empty `cars: {}` and race metadata with sensible defaults (duration=0)
- [ ] **AC-4**: `export()` returns a point-in-time snapshot — subsequent sample recording does not mutate the already-returned JSON
- [ ] **AC-5**: Team names appear correctly in JSON — `cars["macklen"].team === "Macklen"`
- [ ] **AC-6**: When `__DEV__` is false, `export()` returns `null` (guard behavior)

---

## Implementation Notes

_Derived from ADR-0022 Implementation Guidelines:_

**Export structure (exact):**

```json
{
  "race": {
    "track": "interlagos",
    "laps": 5,
    "startTime": 1718800000000,
    "duration": 420.5
  },
  "cars": {
    "macklen": {
      "team": "Macklen",
      "samples": [
        { "tick": 0, "t": 0.0, "speed": 0, "throttle": 0.0, ... }
      ]
    }
  }
}
```

**Race metadata sources:**

- `track`: from Race Management config (`config.tracks.{id}.name`)
- `laps`: from race config (`race.laps`)
- `startTime`: timestamp captured on first `race.started` event (Story 005 sets this)
- `duration`: `elapsedTime` of the last sample across all cars

**`window.__telemetry` namespace:**

- Initialized by this story with `window.__telemetry = { export: () => string }`
- No other system writes to `window.__telemetry`
- Guarded by `if (__DEV__)` — in production, `window.__telemetry` is never assigned

**F3 keybind integration:** This story does NOT handle the F3 keypress. The Dev Tools system (separate epic) triggers `window.__telemetry.export()` on F3 press. This story only provides the function — the binding belongs to the Dev Tools epic.

**Performance:** JSON serialization of up to ~11 MB of data. This is a developer action (not per-frame) — no performance concern.

**Tuning knobs used:** None directly. Reads race metadata from ConfigManager and runtime state.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 005]: Capturing `startTime` from `race.started` event
- Dev Tools epic: F3 keybind to trigger export + download `.json` file
- CSV or other export formats (MVP is JSON only)

---

## Implementation Deviations

**ADR-0022 sampling approach**: The ADR pseudocode samples based on `this.tickCounter` (count of `tick()` calls), while the implementation samples based on `tickCount` (the pipeline tick parameter). The implementation's approach is more correct — it ties samples to simulation ticks rather than recorder invocations. This is a strict improvement, not a regression.

---

## QA Test Cases

- **AC-1**: export() returns valid parseable JSON
  - Given: TelemetryRecorder with recorded samples for 3 cars
  - When: `window.__telemetry.export()` is called
  - Then: Return value is a string
  - And: `JSON.parse(result)` does not throw
  - And: Parsed object has `"race"` and `"cars"` top-level keys

- **AC-2**: JSON structure matches GDD specification
  - Given: Seeded data: track="interlagos", laps=5, startTime=..., duration=420.5, 3 cars
  - When: `export()` is called
  - Then: `race.track === "interlagos"`, `race.laps === 5`
  - And: `cars` object has 3 keys matching car IDs
  - And: Each car entry has `"team"` string and `"samples"` array
  - Edge cases: 8 cars, 1 car, 0 cars

- **AC-3**: Empty export returns valid structure
  - Given: A TelemetryRecorder with no samples recorded
  - When: `export()` is called
  - Then: Returns valid JSON with `cars: {}`
  - And: `race.duration === 0`

- **AC-4**: Point-in-time snapshot
  - Given: Samples for ticks 0–99
  - When: `export()` is called at tick 100
  - Then: Output contains exactly samples for ticks 0–99
  - And: Export is not mutated by future samples (tick 102+)

- **AC-5**: Team names in JSON
  - Given: Car "macklen" with team "Macklen", car "willard" with team "Willard"
  - When: `export()` is called
  - Then: `cars["macklen"].team === "Macklen"`
  - And: `cars["willard"].team === "Willard"`

- **AC-6**: No-op when **DEV** is false
  - Given: `__DEV__ = false`
  - When: `export()` is called
  - Then: Returns `null`

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:

- Logic: `tests/unit/dev-infra/telemetry-json-export.test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (TelemetrySample type, storage), Story 005 (race metadata, startTime)
- Unlocks: Dev Tools epic (provides `window.__telemetry.export()` surface)

## Completion Notes

**Completed**: 2026-06-26
**Criteria**: 6/6 passing
**Deviations**: None
**Test Evidence**: Logic: tests/unit/dev-infra/telemetry-json-export.test.ts (24 tests)
**Code Review**: Complete — APPROVED WITH SUGGESTIONS (babylonjs-specialist, qa-tester ADEQUATE, lead-programmer)
