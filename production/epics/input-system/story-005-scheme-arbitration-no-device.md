# Story 005: Scheme Arbitration & No-Device

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: M (4-8h)

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-009`, `TR-input-014`
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0005 (Input Context Controller and Action Map Inventory)
**ADR Decision Summary**: `ActiveControlScheme` (KeyboardMouse | Gamepad) is a global, KeyboardMouse by default; the most recently processed meaningful device event wins; if both schemes produce meaningful events in the same Dynamic Update, the current scheme remains to prevent oscillation. `NoInputDevice` forces zeroed driving input without freezing simulation and recovers when a valid scheme returns.

**Engine**: Unity 6000.3.19f1 + Input System 1.19.0 | **Risk**: LOW
**Engine Notes**: Pure C# state logic over the Input System device list — no Unity engine dependencies beyond reading device events. `InputSystem.devices.Count == 0` is the "no device" state (InputTestFixture starts with zero devices).

**Control Manifest Rules (Foundation)**:
- Required: InputAvailability enum {Available, NoInputDevice} — zeroed SimulationInput with NoInputDevice flag when no device connected (ADR-0005).
- Required: ActiveControlScheme used by gameplay capture, prompt glyphs, and pointer policy; KeyboardMouse default (ADR-0005).

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-8: GIVEN InputSystem reports a gamepad disconnect while KeyboardMouse is available, WHEN the next SimulationInput is generated, THEN it uses KeyboardMouse and race telemetry remains active.
- [ ] AC-9: GIVEN no input scheme is available, WHEN the next SimulationInput is generated, THEN Accelerate, Brake, and Steer are all 0.0 and `inputAvailability` equals `NoInputDevice` until a valid scheme is selected.
- [ ] AC-23: GIVEN a gamepad reconnects while KeyboardMouse is active, WHEN South, East, West, North, Start, or any D-pad direction is pressed, trigger input exceeds its threshold, or stick magnitude exceeds its inner threshold, THEN the active scheme changes to Gamepad and EMA initializes from the new post-dead-zone sample.
- [ ] AC-39: GIVEN GameplayQualifying is active and the active gamepad disconnects while KeyboardMouse is available, WHEN the next SimulationInput is generated, THEN KeyboardMouse becomes active and EMA initializes from its raw sample.
- [ ] AC-40: GIVEN a Pause edge is pending when the active scheme changes, WHEN the next SimulationInput is generated, THEN the pending edge flag is false.
- [ ] AC-43: GIVEN desktop starts with KeyboardMouse and a connected gamepad, WHEN no meaningful gamepad input has occurred, THEN KeyboardMouse is the active scheme.
- [ ] AC-60: GIVEN Gamepad is active, WHEN a bound keyboard gameplay key is pressed, Click occurs, or pointer delta is at least 2 pixels, THEN ActiveControlScheme changes to KeyboardMouse before the RawInputSample for that Dynamic Update is captured.
- [ ] AC-61: GIVEN KeyboardMouse is active, WHEN any D-pad direction is pressed, THEN ActiveControlScheme changes to Gamepad and prompt glyphs update.
- [ ] AC-62: GIVEN both schemes produce meaningful events in the same Dynamic Update, WHEN arbitration runs, THEN the current ActiveControlScheme remains unchanged for that update.

---

## Implementation Notes

*Derived from ADR-0005 Implementation Guidelines:*

- Meaningful events: KeyboardMouse — any bound keyboard gameplay/UI action, Click, or pointer movement ≥ 2 pixels in the update; Gamepad — South, East, West, North, Start, any D-pad direction, trigger above the trigger threshold, or stick magnitude above the stick inner threshold.
- `ActiveControlScheme` defaults to KeyboardMouse. Last meaningful event wins; if both schemes produce meaningful events in one Dynamic Update, the current scheme is kept (anti-oscillation).
- On scheme change: the pending `pauseEdge` clears and EMA previous values initialize from the newly selected scheme's current post-dead-zone values. No filtered value carries from the prior scheme.
- `NoInputDevice`: when `InputSystem.devices.Count == 0` (or no eligible scheme), the next `SimulationInput` forces accelerate/brake/steer to 0 and sets `inputAvailability = NoInputDevice`. The car coasts. Availability returns only after a valid scheme is selected.
- Arbitration runs BEFORE raw capture in the same Dynamic Update (AC-60).

---

## Embedded Definitions

*Testability refinements from QL-STORY-READY gate.*

- **AC-8**: `TelemetrySampleCounter` observer — continues receiving 1 sample/tick without reset or stop after a disconnect.
- **AC-23/AC-39**: fixture with known post-dead-zone values; assert EMA previous values equal those exact values after a scheme switch.
- **AC-60**: `ArbitrationOrderRecorder` — arbitration event logged before capture in the same Dynamic Update.
- **AC-61**: `PromptGlyphConsumer` mock records the received scheme (KeyboardMouse/Gamepad); assert == Gamepad after a meaningful D-pad event.

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 006: context handoff latching (scheme change and context transition share the EMA-init/edge-clear path but are distinct mechanisms).
- Story 002: capture (reads the resolved `ActiveControlScheme`).

---

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-8**: Gamepad disconnect falls back to KeyboardMouse with telemetry continuity
  - Given: Gamepad active; KeyboardMouse available; telemetry recording.
  - When: Gamepad disconnects and next `SimulationInput` is generated.
  - Then: scheme becomes KeyboardMouse; input uses KeyboardMouse values; `TelemetrySampleCounter` continues (1/tick, no reset/stop).
  - Edge cases: disconnect during qualifying, held analog input.

- **AC-9**: No-device input is zeroed
  - Given: no eligible scheme available.
  - When: next `SimulationInput` is generated.
  - Then: Accelerate, Brake, Steer all 0.0; `inputAvailability == NoInputDevice`.
  - Edge cases: state persists across ticks; clears after a valid scheme returns.

- **AC-23**: Meaningful gamepad input activates Gamepad and initializes EMA
  - Given: KeyboardMouse active; gamepad reconnects and is available.
  - When: any meaningful gamepad event occurs.
  - Then: scheme becomes Gamepad before the next sample is processed; EMA previous values equal the new post-dead-zone sample.
  - Edge cases: every meaningful event, values exactly at thresholds.

- **AC-39**: Qualifying falls back to KeyboardMouse after gamepad disconnect
  - Given: GameplayQualifying active; Gamepad active; KeyboardMouse available.
  - When: Gamepad disconnects and next `SimulationInput` is built.
  - Then: KeyboardMouse becomes active; EMA initializes from its raw sample.
  - Edge cases: held throttle/steer, qualifying timer continuity.

- **AC-40**: Scheme change clears pending Pause
  - Given: Pause edge pending; active scheme changes.
  - When: next `SimulationInput` is generated.
  - Then: `pauseEdge == false`.
  - Edge cases: scheme change before and after raw capture.

- **AC-43**: KeyboardMouse is the startup scheme
  - Given: desktop starts with KeyboardMouse and a connected gamepad.
  - When: no meaningful gamepad event occurs.
  - Then: `ActiveControlScheme` remains KeyboardMouse.
  - Edge cases: gamepad available without input, below-threshold analog noise.

- **AC-60**: KeyboardMouse meaningful input wins before raw capture
  - Given: Gamepad active.
  - When: a bound keyboard key, Click, or pointer delta ≥ 2 pixels occurs.
  - Then: scheme changes to KeyboardMouse before that Dynamic Update's raw sample is captured (`ArbitrationOrderRecorder`).
  - Edge cases: delta exactly 2 pixels, below-threshold delta, simultaneous gamepad input.

- **AC-61**: D-pad input activates Gamepad and updates prompts
  - Given: KeyboardMouse active; Gamepad available.
  - When: any D-pad direction is pressed.
  - Then: scheme changes to Gamepad before capture; `PromptGlyphConsumer` receives Gamepad.
  - Edge cases: all D-pad directions, held direction.

- **AC-62**: Same-frame meaningful events do not oscillate schemes
  - Given: both KeyboardMouse and Gamepad produce meaningful events in one Dynamic Update.
  - When: arbitration runs.
  - Then: `ActiveControlScheme` remains unchanged for that update.
  - Edge cases: both current schemes, all meaningful-event categories.

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `Assets/tests/unit/input/SchemeArbitrationTests.cs` — must exist and pass (unit asmdef `InputUnitTests`).

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (controller), Story 004 (SimulationInput).
- Unlocks: Story 006 (context transitions interact with scheme state).
