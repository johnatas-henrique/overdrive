# Story 003: Console Summary Log

> **Epic**: Telemetry Recorder
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h
> **Last Updated**: 2026-06-26

## Context

**GDD**: `design/gdd/telemetry-recorder.md`
**Requirement**: `TR-TELEMETRY-003`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0022: Telemetry Recorder
**ADR Decision Summary**: Console log every 5 seconds (300 ticks) during Racing state. Single line, sorted by position. Format: `[TELE] Lap 3/5 | P1 Macklen 245 km/h | P2 Willard 241 km/h | ...`

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: None — pure TypeScript, zero Babylon.js imports.

**Control Manifest Rules (this layer)**:

- Required: D8 (console.log every 5s/300 ticks during Racing), D-F2 (read-only)
- Forbidden: D-F3 (never emit Event Bus events)
- Guardrail: D-G1 (zero bytes in production build)

---

## Acceptance Criteria

_From GDD `design/gdd/telemetry-recorder.md`, scoped to this story:_

- [ ] **AC-1**: `console.log` is called exactly once per 300 calls to `tick()` (default `logInterval` = 300), and on no intermediate calls
- [ ] **AC-2**: Output format matches GDD specification exactly: `[TELE] Lap {currentLap}/{totalLaps} | P1 {teamName} {speed} km/h | P2 ...`
- [ ] **AC-3**: Cars sorted by race position ascending (P1 is first place)
- [ ] **AC-4**: Tuning knob `telemetry.logInterval` (default 300, range 60–600) changes the interval — set to 60 produces 4× more frequent logs
- [ ] **AC-5**: With 0 cars registered, no console.log output (safe silent skip)
- [ ] **AC-6**: Gated by an `isRecording` boolean flag (set by Story 005 via `setRecording(true/false)`) — log only fires when `isRecording === true`

---

## Implementation Notes

_Derived from ADR-0022 Implementation Guidelines:_

**Console log format (exact):**

```
[TELE] Lap 3/5 | P1 Macklen 245 km/h | P2 Willard 241 km/h | P3 Ferrell 238 km/h | ... | P7 Lorris 218 km/h
```

**Sort order:** By race position — `car.runtime.racePosition` (from Race Management, slot #7). Ascending (1st place first).

**Log interval math:**

- Default `logInterval = 300` ticks = 5 seconds at 60Hz
- Minimum `logInterval = 60` ticks = 1 second
- Maximum `logInterval = 600` ticks = 10 seconds

**Current lap:** Read from Race Management — `car.runtime.currentLap` (player car's lap, or leader's lap). Total laps from race config.

**State gating:** The `isRecording` flag is set by Story 005. Default `false`. This story reads it but does not manage lifecycle.

**Performance:** Single `console.log` call every 5 seconds — zero performance impact. String concatenation of up to 8 cars (~200 chars).

**Tuning knobs used:** `telemetry.logInterval` (default 300). Read from ConfigManager.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 005]: Event Bus subscriptions that set `isRecording` flag
- [Story 004]: JSON export of the same data

---

## Integration Contract

**Lifecycle order for Story 005:**
`clear()` → `setTotalLaps(n)` → `setRecording(true)`

`clear()` resets `_isRecording` to `false` and `_totalLaps` to `0`. Story 005 must re-establish both values after calling `clear()` on `race.started`.

---

## QA Test Cases

- **AC-1**: Console.log called every 300 ticks
  - Given: A TelemetryRecorder with 3 cars and `isRecording = true`
  - When: `tick()` is called 600 times
  - Then: `console.log` was called exactly 2 times (at tick 300 and tick 600)
  - And: Not called on any intermediate tick
  - Edge cases: Tick crossing boundary (299→300), logInterval = 60

- **AC-2**: Log format matches specification
  - Given: 3 cars with positions: P1=245km/h, P2=241km/h, P3=218km/h, Lap 3 of 5
  - When: `tick()` reaches a log interval
  - Then: `console.log` was called with exactly: `"[TELE] Lap 3/5 | P1 Macklen 245 km/h | P2 Willard 241 km/h | P3 Lorris 218 km/h"`
  - Edge cases: Single car output, speed rounding (integer km/h)

- **AC-3**: Cars sorted by position
  - Given: 3 cars with mixed positions (Willard P1, Macklen P2, Ferrell P3)
  - When: Log fires
  - Then: Console output starts with P1 (Willard), then P2 (Macklen), then P3 (Ferrell)

- **AC-4**: logInterval tuning knob changes timing
  - Given: `logInterval` set to 60
  - When: `tick()` is called 120 times
  - Then: `console.log` was called exactly 2 times (at tick 60 and tick 120)

- **AC-5**: No log when no cars
  - Given: TelemetryRecorder with 0 cars, `isRecording = true`
  - When: Tick reaches log interval
  - Then: No `console.log` output

- **AC-6**: Gated by isRecording flag
  - Given: TelemetryRecorder with cars, `isRecording = false`
  - When: Tick reaches log interval
  - Then: No `console.log` output

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:

- Logic: `tests/unit/dev-infra/telemetry-console-summary.test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (data model), Story 002 (sampled data in arrays), Story 005 (`isRecording` flag)
- Unlocks: None (leaf story in output layer)

## Completion Notes

**Completed**: 2026-06-26
**Criteria**: 6/6 passing
**Deviations**: None
**Test Evidence**: Logic: tests/unit/dev-infra/telemetry-console-summary.test.ts (27 tests)
**Code Review**: Complete — APPROVED (babylonjs-specialist CLEAN, qa-tester ADEQUATE, lead-programmer APPROVED)
