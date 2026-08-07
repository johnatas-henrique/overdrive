# Story 007: ActiveControlScheme Arbitration

> **Epic**: Input System
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05

## Context

**GDD**: `design/gdd/input-system.md`
**Requirement**: `TR-input-009` (ActiveControlScheme arbitration: KeyboardMouse default, last meaningful device wins)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0005: Input Context Controller and Action Map Inventory
**ADR Decision Summary**: Input owns one global `ActiveControlScheme = KeyboardMouse | Gamepad` used by gameplay capture, prompt glyphs, and pointer policy. KeyboardMouse is the startup default. The most recently processed meaningful device event wins. If both schemes produce meaningful events in the same Dynamic Update, the current scheme remains active to prevent oscillation. EMA reinitializes on scheme change.

**Engine**: Unity 6000.3.19f1 | **Risk**: MEDIUM
**Engine Notes**: Input System 1.19.0 core APIs confirmed stable. AC-21/55 (WebGL) are DEFERRED — they require WebGL platform builds, not a local harness; they are not blockers.

**Control Manifest Rules (this layer)**:
- Required: ActiveControlScheme arbitration: KeyboardMouse default, last meaningful device wins; both in same DynamicUpdate preserves current; EMA reinitializes on scheme change (source: ADR-0005)
- Required: Latch every newly enabled digital action and UI Navigate control actuated at transition until neutral/released (source: ADR-0005 — interacts with scheme change)

---

## Acceptance Criteria

*From GDD `design/gdd/input-system.md`, scoped to this story:*

- [ ] AC-43: GIVEN desktop starts with KeyboardMouse and a connected gamepad, WHEN no meaningful gamepad input has occurred, THEN KeyboardMouse is the active scheme.
- [ ] AC-60: GIVEN Gamepad is active, WHEN a bound keyboard gameplay key is pressed, Click occurs, or pointer delta is at least 2 pixels, THEN ActiveControlScheme changes to KeyboardMouse before the RawInputSample for that Dynamic Update is captured.
- [ ] AC-61: GIVEN KeyboardMouse is active, WHEN any D-pad direction is pressed, THEN ActiveControlScheme changes to Gamepad and OnActiveSchemeChanged fires once with Gamepad (prompt glyphs consume the event).
- [ ] AC-62: GIVEN both schemes produce meaningful events in the same Dynamic Update, WHEN arbitration runs, THEN the current ActiveControlScheme remains unchanged for that update.
- [ ] AC-21: GIVEN WebGL has not exposed a gamepad, WHEN the game starts, THEN KeyboardMouse remains active and gameplay input is functional. [DEFERRED — WebGL platform validation]
- [ ] AC-55: GIVEN WebGL exposes a gamepad after focus or user interaction while KeyboardMouse is active, WHEN the gamepad has not met the meaningful-input threshold, THEN KeyboardMouse remains the active scheme. [DEFERRED — WebGL platform validation]

## Implementation Notes

*Derived from ADR-0005 Key Interfaces (ActiveScheme, OnActiveSchemeChanged) and GDD Core Rule 3 (:97-102):*

- Meaningful input (input-system.md:100-102):
  - KeyboardMouse meaningful: any bound keyboard gameplay or UI action, Click, or pointer movement with magnitude ≥ 2 pixels in the update.
  - Gamepad meaningful: South, East, West, North, Start, any D-pad direction, trigger value above the trigger threshold (0.05), or stick magnitude above the stick inner threshold (0.15).
- Startup default: KeyboardMouse, even when a gamepad is connected (desktop). Gamepad takes control only after the meaningful-input threshold is met (AC-43; WebGL variants AC-21/55 DEFERRED).
- Same-DynamicUpdate tie: if both schemes produce meaningful events in one update, the current scheme remains active — no oscillation. A later meaningful event may switch it.
- AC-60 ordering: the scheme change happens BEFORE the RawInputSample for that Dynamic Update is captured (arbitration runs during Dynamic Update event processing, capture runs at Simulation's Update start).
- Scheme change effects: pending `pauseEdge` clears; EMA previous values initialize from the newly selected scheme's current post-dead-zone values; no filtered value carries from the prior scheme (GDD :156).
- Prompt-glyph observable: the UI glyph provider subscribes to the Input-owned `OnActiveSchemeChanged` event (ADR-0005 Key Interface, `public event Action<ControlScheme> OnActiveSchemeChanged`); assertion = the event fires exactly once per scheme change with the new scheme (AC-61).
- Binding candidates captured during Settings Listening never change ActiveControlScheme; a later meaningful event after Listening ends may change it (GDD :102).

## Out of Scope

*Handled by neighbouring stories — do not implement here:*

- Story 006: pauseEdge clearing on scheme change (consumes the arbitration result)
- Story 009: Context handoff latching (interacts with scheme changes across transitions)
- Story 012: Pointer policy UI behaviors (consumes ActiveControlScheme)
- UI Menu / HUD: prompt glyph rendering (consumes OnActiveSchemeChanged)
- WebGL AC-21/55: platform validation (DEFERRED)

## QA Test Cases

*Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation.*

- **AC-43** (EditMode arbitration test):
  - Given: Desktop starts with KeyboardMouse and a connected gamepad.
  - When: No meaningful gamepad input occurs.
  - Then: Active scheme remains KeyboardMouse.
  - Edge cases: Device connected before startup; device connected after startup; noise below threshold.
- **AC-60** (PlayMode integration test):
  - Given: Gamepad is active.
  - When: A qualifying keyboard key, click, or pointer delta of at least two pixels occurs.
  - Then: Active scheme changes to KeyboardMouse before that Dynamic Update's raw sample is captured.
  - Edge cases: Delta exactly two pixels; sub-threshold delta; simultaneous gamepad input; click and keyboard input in same update.
- **AC-61** (PlayMode event test):
  - Given: KeyboardMouse is active.
  - When: Any D-pad direction is pressed.
  - Then: Active scheme changes to Gamepad; `OnActiveSchemeChanged` fires exactly once with Gamepad (prompt glyphs update via the event).
  - Edge cases: D-pad held; diagonal D-pad input; keyboard and D-pad input simultaneously.
- **AC-62** (EditMode arbitration test):
  - Given: Both schemes produce meaningful events during one Dynamic Update.
  - When: Arbitration runs.
  - Then: The existing active scheme remains unchanged for that update.
  - Edge cases: Events arrive in different device-event order; both schemes inactive before update; next update contains only one device.
- **AC-21** [DEFERRED — WebGL platform verification]:
  - Setup: WebGL build without gamepad exposure.
  - Verify: KeyboardMouse remains active and gameplay input functions.
  - Pass condition: keyboard driving works from startup in the WebGL build.
- **AC-55** [DEFERRED — WebGL platform verification]:
  - Setup: WebGL build; connect a gamepad after focus/user interaction.
  - Verify: Until meaningful input threshold is met, KeyboardMouse remains active.
  - Pass condition: scheme does not switch on connect alone.

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- `tests/unit/input/active_scheme_arbitration_test.cs` — must exist and pass
- AC-21/AC-55: DEFERRED — WebGL platform validation (documented in evidence, not a sprint blocker)

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (context controller owns scheme state per ADR-0005)
- Unlocks: Story 008 (availability arbitration), Story 006 (pauseEdge clearing on change)
