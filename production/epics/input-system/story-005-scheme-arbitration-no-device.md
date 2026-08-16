# Story 005: Scheme Arbitration & No-Device

> **Epic**: Input System
> **Status**: Complete
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

- [x] AC-8: GIVEN InputSystem reports a gamepad disconnect while KeyboardMouse is available, WHEN the next SimulationInput is generated, THEN it uses KeyboardMouse and race telemetry remains active.
- [x] AC-9: GIVEN no input scheme is available, WHEN the next SimulationInput is generated, THEN Accelerate, Brake, and Steer are all 0.0 and `inputAvailability` equals `NoInputDevice` until a scheme becomes eligible again (a device present in `InputSystem.devices`).
- [x] AC-23: GIVEN a gamepad reconnects while KeyboardMouse is active, WHEN South, East, West, North, Start, or any D-pad direction is pressed, trigger input exceeds its threshold, or stick magnitude exceeds its inner threshold, THEN the active scheme changes to Gamepad and EMA initializes from the new post-dead-zone sample.
- [x] AC-39: GIVEN GameplayQualifying is active and the active gamepad disconnects while KeyboardMouse is available, WHEN the next SimulationInput is generated, THEN KeyboardMouse becomes active and EMA initializes from its post-dead-zone sample (KeyboardMouse has no dead zone, so raw == post-dead-zone).
- [x] AC-40: GIVEN a Pause edge is pending when the active scheme changes, WHEN the next SimulationInput is generated, THEN the pending edge flag is false.
- [x] AC-43: GIVEN desktop starts with KeyboardMouse and a connected gamepad, WHEN no meaningful gamepad input has occurred, THEN KeyboardMouse is the active scheme.
- [x] AC-60: GIVEN Gamepad is active, WHEN a bound keyboard gameplay or UI action is pressed, Click occurs, or pointer delta is at least 2 pixels, THEN ActiveControlScheme changes to KeyboardMouse before the RawInputSample for that Dynamic Update is captured.
- [x] AC-61: GIVEN KeyboardMouse is active, WHEN any D-pad direction is pressed, THEN ActiveControlScheme changes to Gamepad and prompt glyphs update.
- [x] AC-62: GIVEN both schemes produce meaningful events in the same Dynamic Update, WHEN arbitration runs, THEN the current ActiveControlScheme remains unchanged for that update.

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

- **AC-8**: `TelemetrySampleCounter` observer — continues receiving 1 sample/tick without reset or stop after a disconnect. The arbitration is side-effect-free: it does not interrupt external consumers (telemetry, qualifying timer); the test injects the observer and asserts continuity across the scheme change.
- **AC-23/AC-39**: fixture with known post-dead-zone values; assert EMA previous values equal those exact values after a scheme switch. The EMA re-initialization uses the `InitializeFromPostDeadZone(accelerate, brake, steer)` seam (sets EMA previous values to the given post-dead-zone values; no filtered value carries from the prior scheme). AC-39 KeyboardMouse raw input equals post-dead-zone (no keyboard dead zone), so the same seam applies. This seam is also reused by Story 006 (context handoff, AC-41a).
- **AC-40**: the scheme-change path clears the controller's pending Pause latch (`_pendingPauseEdge`) before the next SimulationInput.
- **AC-60**: `ArbitrationOrderRecorder` — the controller exposes `ResolveActiveScheme()` (public); the Simulation driver calls it BEFORE `CaptureLatestRawSample()` in the Update loop (explicit call order, not Unity script execution order). The recorder logs both events and asserts arbitration precedes capture.
- **AC-61**: `PromptGlyphConsumer` mock subscribes to the controller's `OnActiveSchemeChanged(ControlScheme)` event (production seam per ADR-0005 naming: prompt glyphs and pointer policy observe this event); asserts it receives Gamepad after a meaningful D-pad event.
- **AC-62**: same-frame batching — the controller collects meaningful-event flags from all actions during the Dynamic Update's event processing, then resolves the scheme once (before capture). If both schemes produced meaningful events in that update, the pre-update `ActiveControlScheme` is preserved (anti-oscillation). Device-loss precedence: if the current scheme is no longer eligible (device disconnected) in the same frame, eligibility takes priority — the controller must NOT preserve an ineligible scheme; anti-oscillation applies only when both schemes remain eligible.

**Device eligibility**: a scheme is eligible when its device is present in `InputSystem.devices` (KeyboardMouse: `Keyboard.current != null` OR `Mouse.current != null`; Gamepad: `Gamepad.current != null`). `NoInputDevice` when no scheme is eligible (including `InputSystem.devices.Count == 0`); availability returns `Available` once a scheme is eligible again.

**Meaningful-event boundaries** (exact): trigger/stick EXACTLY at threshold → NOT meaningful; just above → meaningful; analog triggers/sticks are meaningful while above threshold (each Dynamic Update), not only on the crossing; D-pad and held buttons are meaningful on the press edge (performed), not on every update while held; pointer delta EXACTLY 2 px → meaningful; below 2 px → NOT meaningful, where the pointer delta is `Mouse.current.delta.magnitude` for that Dynamic Update (per-frame delta, not a cross-frame accumulation).

---

## Performance Budget

**O(1)** per Dynamic Update — arbitration performs a fixed set of eligibility checks and resolves the active scheme once; no allocations, no per-device iteration. Fits the existing simulation gate: p95 ≤ 6 ms / max ≤ 8 ms. `OnActiveSchemeChanged` fires only on an actual scheme change, not per frame.

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

**Status**: [x] Created and passing — `SchemeArbitrationTests.cs` (26 tests; 87/87 suite PlayMode PASS)

---

## Dependencies

- Depends on: Story 001 (controller), Story 004 (SimulationInput).
- Unlocks: Story 006 (context transitions interact with scheme state).

---

## Completion Notes

**Completed**: 2026-08-09
**Criteria**: 9/9 passing (0 deferred)
**Deviations**: None blocking. Advisory: AC-8 telemetry continuity and AC-39 qualifying timer are verified test-local — the external consumers (Simulation driver telemetry observer, RSM qualifying timer) do not exist in this story's scope; downstream Simulation Kernel/RSM epic must wire the real observers (TD-006). `SchemeChangeEmaReinitializer` + `TickProcessor.InitializeFromPostDeadZone(sample)` are produced; the Simulation Kernel driver must instantiate the reinitializer per race to close the handoff (TD-007).
**Test Evidence**: Logic — `Assets/tests/unit/input/SchemeArbitrationTests.cs` (26 tests, 87/87 suite PlayMode PASS).
**Code Review**: Complete — 6 rounds (persistent unity-specialist + qa-tester), converged; LP-CODE-REVIEW APPROVE; QL-TEST-COVERAGE ADEQUATE.

### Code Review Convergence Summary

- **Round 1**: qa-tester found 4 blocking (AC-9 zeroing, AC-23/39 tautological EMA handoff, AC-60 recorder artificial, AC-8 keyboard verification) + 6 advisory → all applied.
- **Round 2 (early re-review caught by user)**: incomplete fixes re-invoked — corrected to verify-then-re-review (rule #1929).
- **Round 3**: qa-tester BLOCKING on AC-59 (Peek mutation coverage) + same-scheme reconnect stale EMA → production `PeekLatestRawSample()` (no capture-count inflation) + `OnAvailabilityChanged` + reconnect re-seed added.
- **Round 4**: qa-tester BLOCKING on mutation coverage (capture-count inflation, availability transition events) → 4 mutation tests added.
- **Round 5**: specialist APPROVED; qa-tester APPROVED WITH SUGGESTIONS (same-frame double reinit documented).
- **Round 6**: qa-tester APPROVED (convergence).

**Real defects caught**: redundant AC-9 zeroing (mutation-inadequate — ReadGamepadAxis already returns 0), reinitializer capture-count inflation (AC-59 violation), same-scheme reconnect stale EMA leak, non-idempotent Enable.

**Test Evidence section**: updated to 26 tests / 87/87.
