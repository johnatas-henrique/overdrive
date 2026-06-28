# Story 009: AI Telemetry Data Provider

> **Epic**: AI Driver
> **Status**: Ready
> **Layer**: Core B
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/ai-driver.md`
**Requirement**: `TR-AI-012`

- TR-AI-012: Telemetry data provider — per-car exposes personality label, current FSM state, mistakeMag, and speed for Dev Tools overlay consumption.

**ADR Governing Implementation**: ADR-0013: AI Driver Architecture
**ADR Decision Summary**: AI telemetry is a read-only snapshot produced each tick. Exposed via `IAIDriver.getTelemetry(): Map<string, AITelemetry>`. Consumed by Dev Tools overlay (debug panel). Structure is an open set for Alpha extension.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure TypeScript — zero engine imports. Telemetry is data-only, no engine types involved.

**Control Manifest Rules (this layer)**:

- Required: C46 (AIDriverParams open set — telemetry exposes params for debug)
- Dev Infra: D4 (Dev Tools overlay refresh on `engine.onEndFrameObservable`), D5 (toggle/reload keys via DOM keydown listener — keys configurable via `devTools.keys.*`)
- Dev Infra: D-F3 (never emit events on Event Bus for telemetry — it's read-only)

---

## Acceptance Criteria

_From GDD `design/gdd/ai-driver.md`, scoped to this story:_

- [ ] Per-car telemetry object available after each tick containing: `targetSpeed` (AI's internal computed target — resolved: not actual car speed), `fsmState` (Normal | Following | Passing), `mistakeMag`, `personalityLabel` (team name or derived label)
- [ ] Telemetry is a read-only snapshot — immutable copy per tick; external mutations to the returned object do not affect subsequent telemetry snapshots
- [ ] Exposed via `IAIDriver.getTelemetry(): Map<string, AITelemetry>` — 7 entries, one per AI car
- [ ] `AITelemetry` interface uses an extensible structure (open set — adding new optional fields in Alpha does not break consumers)

---

## Implementation Notes

_Derived from ADR-0013 Implementation Guidelines:_

1. **`getTelemetry()` lifecycle**: Called by Dev Tools after each pipeline tick. Returns a snapshot of the current tick's state. The snapshot is a shallow copy — simple objects and primitives, no shared references that could mutate.

2. **Telemetry fields**:
   - `targetSpeed`: The AI's computed target speed for this tick (from Story 003, potentially modulated by Stories 007/008). Not the actual car speed from Physics — that would require Physics integration.
   - `fsmState`: The overtaking FSM state (Story 005).
   - `mistakeMag`: The shared config constant (Story 006).
   - `personalityLabel`: Derived from the team name (e.g., "Macklen — Dominant", "Layton Hall — Aggressive") using the GDD's personality table.

3. **Immutability**: Each `getTelemetry()` call creates a new `Map` with new value objects. Consumers that mutate the returned data do not corrupt internal AI state.

4. **Dev Tools integration**: The Dev Tools system (Story DVT-008 — AI Telemetry tab) calls `getTelemetry()` on its refresh cycle. The AI Driver has no knowledge of Dev Tools — it just exposes the data.

5. **Performance**: 7 entries × 4 simple fields ≈ 0.0001ms to construct. No allocation concerns.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Dev Tools overlay rendering (Dev Infra layer — reads telemetry and renders HTML)
- Actual car speed from Physics (this telemetry exposes AI's _target_ speed only)
- Alpha fields: pressureTolerance, defensiveTendency, contactTolerance (just add to AITelemetry interface)

---

## QA Test Cases

_Manual verification steps for Integration story:_

- **AC-1**: Per-car telemetry shows targetSpeed, fsmState, mistakeMag, personalityLabel
  - Setup: Construct a test harness that wires AI Driver + Team Performance. Create one AI car with Macklen params.
  - Verify: After tick(), call `getTelemetry().get("macklen_car_0")`.
  - Pass condition: telemetry object contains keys "targetSpeed" (number), "fsmState" ("Normal" | "Following" | "Passing"), "mistakeMag" (number ≈ 0.15), "personalityLabel" (string "Macklen — Dominant").

- **AC-2**: Telemetry is read-only snapshot
  - Setup: Same harness. Capture telemetry snapshot after tick N.
  - Verify: Mutate the returned object (set fields, delete keys). Call getTelemetry() again.
  - Pass condition: The new telemetry snapshot is unaffected by mutations to the old one. The two snapshots are different object references.

- **AC-3**: Exposed via IAIDriver.getTelemetry(): Map<string, AITelemetry>
  - Setup: 7 AI cars created.
  - Verify: Call getTelemetry(). Verify it returns a Map with 7 entries, keys match car IDs.
  - Pass condition: Map has exactly 7 entries; each key is a string; each value satisfies the AITelemetry type.

- **AC-4**: Structure extensible (design review — not automatable)
  - Setup: Code review of AITelemetry type definition.
  - Verify: The type uses interfaces (not unions) and consumers access fields via property access.
  - Pass condition: Adding a new optional field to AITelemetry does not break any existing consumer code.

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/unit/ai/telemetry_provider_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (controller framework — for IAIDriver interface), Story 005 (overtaking FSM — for fsmState), Story 006 (mistake model — for mistakeMag)
- Unlocks: Dev Tools AI Telemetry tab (Story DVT-008)
