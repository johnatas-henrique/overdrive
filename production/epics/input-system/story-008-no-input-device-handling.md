# Story 008: NoInputDevice Handling

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-014` (NoInputDevice produces zeroed driving input without freezing simulation and recovers when a valid scheme returns)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0001: Manual Simulation Authority and Determinism Boundary; ADR-0005: Input Context Controller and Action Map Inventory
**ADR Decision Summary**: ADR-0001: the simulation tick never stops for input availability — the tick runs regardless. ADR-0005: if no input device is available, Input supplies zeroed SimulationInput with the NoInputDevice flag; HUD presents a transient overlay while the condition persists.

**Engine**: Unity 6000.3.19f1 | **Risk**: HIGH
**Engine Notes**: Unity 6.3 post-cutoff; verified APIs per ADR-0001. No input injection is possible via editor tooling (Keyboard.current is null in eval) — tests use fake device providers/state, not real hardware.

**Control Manifest Rules (this layer)**:
- Required: InputAvailability enum {Available, NoInputDevice}: zeroed SimulationInput with NoInputDevice flag when no device connected (source: ADR-0005)
- Required: Input sanitization (source: ADR-0005)
- Guardrail: Simulation tick budget p95 ≤ 6 ms, max ≤ 8 ms (source: ADR-0001)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-9: GIVEN no input scheme is available, WHEN the next SimulationInput is generated, THEN Accelerate, Brake, and Steer are all 0.0 and `inputAvailability` equals `NoInputDevice` until a valid scheme is selected.
- [ ] AC-8: GIVEN InputSystem reports a gamepad disconnect while KeyboardMouse is available, WHEN the next SimulationInput is generated, THEN it uses KeyboardMouse and race telemetry remains active.

## Implementation Notes

*Derived from ADR-0005 Decision and GDD Edge Cases (:237-240):*

- NoInputDevice is a PERSISTENT availability state, not a per-tick transient: it remains until a valid scheme is selected (GDD :240 — "HUD presents its transient overlay while this condition persists; availability returns only after a valid scheme is selected").
- When no scheme is available, the next SimulationInput forces accelerate, brake, and steer to 0 and sets `inputAvailability = NoInputDevice`. The car coasts; the simulation tick continues running (no freeze, no pause).
- "Race telemetry remains active" is observed as the simulation tick continuing to emit SimulationInput every tick with zeroed axes — the processor never stalls on availability.
- Gamepad disconnect while KeyboardMouse is available: the disconnected scheme's raw values are discarded at the next capture; KeyboardMouse becomes active; the pending `pauseEdge` clears and EMA initializes from its current post-dead-zone values (GDD :239).
- Recovery: availability returns only after a valid scheme is selected (meaningful input threshold per Story 007 arbitration).
- HUD overlay presentation is HUD's responsibility (out of scope — this story only produces the flag).

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 007: Scheme arbitration (which scheme is selected on recovery)
- Story 006: SimulationInput assembly (consumes the availability state)
- HUD epic: NoInputDevice overlay presentation

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-9** (EditMode unit test):
  - Given: No valid input scheme is available.
  - When: The next SimulationInput is generated.
  - Then: Accelerate, Brake, and Steer equal `0.0`; `inputAvailability` equals `NoInputDevice`.
  - Edge cases: Device disconnects between capture and tick; no device at startup; device returns after several ticks (availability persists until then); Pause input absent.
- **AC-8** (PlayMode integration test):
  - Given: KeyboardMouse is available and the active gamepad disconnects.
  - When: The next SimulationInput is generated.
  - Then: KeyboardMouse becomes active; driving input uses KeyboardMouse; race telemetry continues emitting normally (tick keeps running, zero freeze).
  - Edge cases: Disconnect during accumulator catch-up; no keyboard input; gamepad reconnects immediately; telemetry consumer unavailable.

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- `tests/unit/input/no_input_device_test.cs` — must exist and pass (EditMode state tests + PlayMode tick-continuity test)

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 007 (scheme arbitration decides recovery selection)
- Unlocks: Story 006 (availability flag in SimulationInput), HUD NoInputDevice overlay
