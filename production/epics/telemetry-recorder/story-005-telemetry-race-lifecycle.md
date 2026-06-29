# Story 005: Race Lifecycle Integration

> **Epic**: Telemetry Recorder
> **Status**: Complete
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h
> **Last Updated**: 2026-06-26

## Context

**GDD**: `design/gdd/telemetry-recorder.md`
**Requirement**: `TR-TELEMETRY-004`
_(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)_

**ADR Governing Implementation**: ADR-0022: Telemetry Recorder
**ADR Decision Summary**: Subscribe to `race.started` (clear arrays), subscribe to `gsm.state.entered(PostRace)` (export-ready). Read-only. Player car recorded alongside AI.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: None — pure TypeScript, zero Babylon.js imports. Event Bus subscriptions follow ADR-0001 pattern.

**Control Manifest Rules (this layer)**:

- Required: D7 (20Hz sampling), D-F2 (read-only — never writes state)
- Forbidden: D-F3 (never emit Event Bus events — subscription only, no emission)
- Guardrail: D-G1 (zero bytes in production build)

---

## Acceptance Criteria

_From GDD `design/gdd/telemetry-recorder.md`, scoped to this story:_

- [ ] **AC-1**: When `race.started` fires on the Event Bus, `clear()` is called — all accumulated samples discarded, counters reset, `isRecording` set to `true`
- [ ] **AC-2**: Multiple `race.started` events without intervening PostRace clear correctly each time — no error, no data leak across sessions
- [ ] **AC-3**: When `gsm.state.entered(PostRace)` fires, `isRecording` set to `false` and race data remains available via `export()` with no data loss
- [ ] **AC-4**: Player car (identified via `RaceManagement.getPlayerCarId()` or `car.isPlayer` flag) recorded alongside 7 AI cars — player sample has `aiState === -1`, AI samples have `aiState` in `{0, 1, 2}`
- [ ] **AC-5**: Full lifecycle: `race.started` → recording produces samples → PostRace → second `race.started` → second recording correctly isolates sessions (no cross-contamination)

---

## Implementation Notes

_Derived from ADR-0022 Implementation Guidelines:_

**Event subscriptions:**

```typescript
// Subscribe (reentrant — off() before on() to prevent duplicates on Race Again)
eventBus.off("race.started").on("race.started", () => {
  this.clear();
  this.isRecording = true;
  this.startTime = Date.now(); // Capture for export metadata
});

eventBus.on("gsm.state.entered", (payload) => {
  if (payload.to === "PostRace") {
    this.isRecording = false;
    // Data remains in arrays for export
  }
});
```

**Player car identification:**

- `RaceManagement.getPlayerCarId(): string` — returns player's car ID
- Or `car.isPlayer: boolean` flag on CarEntity
- Either works — coordinate with Race Management system owner
- Player car sample: `aiState = -1` (sentinel, not a valid AI state)
- AI cars: `aiState` read from `car.aiDriver.state` (0=Normal, 1=Following, 2=Passing)

**`startTime` capture:** On `race.started`, capture `Date.now()` for race metadata (used by Story 004).

**Subscription lifecycle:**

- Subscriptions registered in constructor or `init()`
- Use the reentrant pattern (`off().on()`) to prevent duplicate subscriptions on Race Again
- No explicit unsubscribe needed — TelemetryRecorder lives for the entire app lifetime

**`isRecording` flag:** Public or package-visible setter `setRecording(bool)` that Story 003 reads. Default `false`.

**Race metadata for export:**

- Sets a `raceMeta` object on `race.started` with `track`, `laps`, `startTime`
- Story 004 reads `raceMeta` during `export()`

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- [Story 001]: Data model and `clear()` implementation
- [Story 002]: The per-tick sampling loop
- [Story 003]: Console log that reads `isRecording` flag

---

## QA Test Cases

- **AC-1**: Arrays cleared on race.started
  - Given: TelemetryRecorder with samples for 2 cars, `isRecording = true`
  - When: Event Bus emits `"race.started"`
  - Then: All per-car arrays are empty
  - And: `tickCounter === 0`, `logCounter === 0`
  - And: `isRecording === true`

- **AC-2**: Multiple race.started events
  - Given: TelemetryRecorder with samples
  - When: `"race.started"` fires twice consecutively (no PostRace between)
  - Then: After each event, arrays are cleared
  - And: No error on second clear

- **AC-3**: PostRace makes data available, stops recording
  - Given: TelemetryRecorder with full race data, `isRecording = true`
  - When: `gsm.state.entered(PostRace)` fires
  - Then: `isRecording === false`
  - And: `export()` returns complete race data with all cars' last samples present

- **AC-4**: Player car recorded alongside AI cars
  - Given: 7 AI cars + 1 player car (playerCarId = "player_one")
  - When: `tick()` runs for one full sampling cycle (3 ticks)
  - Then: 8 samples recorded (7 AI + 1 player)
  - And: Player sample has `aiState === -1`
  - And: AI samples have `aiState` in `{0, 1, 2}`

- **AC-5**: Race lifecycle isolation
  - Given: `race.started` → 100 ticks of recording → PostRace
  - When: `race.started` fires again → 50 more ticks
  - Then: Samples from first race are gone (cleared)
  - And: Only 50/3 ≈ 16 samples per car from session 2 are present
  - Edge cases: Race restart before any samples recorded, PostRace before first race.started

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:

- Integration: `tests/integration/dev-infra/telemetry-lifecycle.test.ts` (12 tests passing)

**Status**: [x] Created — 12 tests passing

---

## Dependencies

- Depends on: Story 001 (data model — `clear()`, Map storage), Event Bus (ADR-0001), GSM (ADR-0024)
- Unlocks: Story 003 (`isRecording` flag), Story 004 (race metadata, startTime)

## Completion Notes

**Completed**: 2026-06-26
**Criteria**: 5/5 passing
**Deviations**: None
**Test Evidence**: Integration: tests/integration/dev-infra/telemetry-lifecycle.test.ts (12 tests)
**Code Review**: Complete — APPROVED WITH SUGGESTIONS fixed (babylonjs-specialist CONCERNS resolved, qa-tester GAPS resolved)
