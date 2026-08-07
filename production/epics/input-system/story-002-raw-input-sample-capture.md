# Story 002: RawInputSample Capture

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Integration
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-005` (CaptureLatestRawSample() called once per frame before accumulator in same Simulation driver Update call), `TR-input-006` (SimulationInput contract — the RawInputSample is the capture-side source of the contract)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0001: Manual Simulation Authority and Determinism Boundary; ADR-0005: Input Context Controller and Action Map Inventory
**ADR Decision Summary**: ADR-0001: Simulation invokes Input-owned `CaptureLatestRawSample()` exactly once per render frame, at the beginning of its own `Update()`, before reading/modifying the accumulator — no relative MonoBehaviour script-order assumption. ADR-0005: Input owns capture and routing; SimulationInput is the sole gameplay-input contract.

**Engine**: Unity 6000.3.19f1 | **Risk**: HIGH
**Engine Notes**: Unity 6.3 is post-cutoff. Verified APIs: `Physics.simulationMode`, `Physics.Simulate(float)`, `Rigidbody.interpolation`, `Time.unscaledDeltaTime`. Input System 1.19.0: `ProcessEventsInDynamicUpdate` is the required update mode (ADR-0005). No relative script-order dependency is permitted — the same-call ordering (capture before accumulator evaluation) is authoritative.

**Control Manifest Rules (this layer)**:
- Required: Simulation invokes Input-owned `CaptureLatestRawSample()` exactly once per render frame, at the beginning of its own `Update()`, before reading/modifying the accumulator; no relative MonoBehaviour script-order assumption is permitted (source: ADR-0001)
- Required: Input System processes platform events in Dynamic Update (`ProcessEventsInDynamicUpdate`) (source: ADR-0001, ADR-0005)
- Required: ActiveControlScheme arbitration: KeyboardMouse default, last meaningful device wins; both in same DynamicUpdate preserves current; EMA reinitializes on scheme change (source: ADR-0005)
- Guardrail: Simulation tick budget p95 ≤ 6 ms, max ≤ 8 ms (16-car prototype, Steps 1–14) (source: ADR-0001)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-59: GIVEN a render Update begins after Input System Dynamic Update, WHEN Simulation evaluates its accumulator, THEN it first calls Input-owned `CaptureLatestRawSample()` and receives exactly one immutable RawInputSample with a monotonic `captureSequence`.
- [ ] AC-59b: GIVEN a running session, WHEN a Gameplay↔UI context change occurs and when a scene load occurs, THEN `captureSequence` remains strictly increasing across those boundaries (no reset, no reuse).

## Implementation Notes

*Derived from ADR-0001 Decision and GDD Core Rule 5 (input-system.md:111-128):*

- `CaptureLatestRawSample()` executes exactly once per render frame at the start of the Simulation driver's `Update()`, before the accumulator is read or modified. This same-call ordering is authoritative — no dependency on relative MonoBehaviour script order.
- `RawInputSample` is an immutable value type (readonly struct) with fields: `captureSequence` (uint64, monotonic), `activeScheme` (KeyboardMouse/Gamepad), `accelerateRaw` (0-1), `brakeRaw` (0-1), `steerRaw` (-1-1), `pauseRise` (bool, first pending gameplay Pause rise since prior capture), `inputAvailability` (Available/NoInputDevice), `validityFlags` (bit flags marking non-finite or invalid source channels).
- `captureSequence` starts at 0 and increments strictly per render-Update capture; the counter lives in Input (not per-context) so monotonicity survives context changes and scene loads.
- Non-finite raw channels retain the last valid filtered output for that channel and produce a rate-limited warning (raw-stage sanitization to 0.0f is the tick processor's stage — Story 006; this story captures the flags).
- While `OverdriveGameplay` is active, only Pause rising edges enter the pending simulation flag. Repeated rises while pending are ignored; the first simulation tick in that render update consumes and clears it. CameraToggle does not enter RawInputSample (Story 011).
- If one render frame contains multiple simulation ticks, every tick processes the same sample (Story 006 consumes; this story only captures once per frame).

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 006: Tick processor (validation, dead zone, EMA, brake priority applied to the captured sample)
- Story 001: The `.inputactions` asset and context controller (capture reads the active context's values)

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-59** (EditMode or PlayMode integration harness):
  - Given: The simulation driver begins a render Update after Input System Dynamic Update, and the accumulator will execute zero or more ticks.
  - When: The driver evaluates the accumulator.
  - Then: `CaptureLatestRawSample()` is called exactly once before any tick; it returns one immutable sample with a strictly increasing `captureSequence`.
  - Edge cases: Zero accumulator ticks; multiple accumulator ticks; accumulator backlog; repeated render Updates; attempted mutation after capture (compile-time readonly enforcement + capture-order trace).
  - Required instrumentation: call counter and call-order trace.
- **AC-59b** (PlayMode boundary test):
  - Given: A running session with a known captureSequence value.
  - When: A Gameplay↔UI context change occurs, then a scene load occurs.
  - Then: captureSequence remains strictly increasing across both boundaries (no reset to 0, no reuse of values).
  - Edge cases: Context change without scene load; scene load without context change; repeated rapid transitions.

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- `tests/integration/input/raw_input_sample_capture_test.cs` — must exist and pass (EditMode harness + PlayMode scene-load boundary test)

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (asset + context controller provide the sampled values)
- Unlocks: Story 003, Story 004, Story 006 (all consume the captured sample)
