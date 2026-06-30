# Story 006: Debounced Inputs + Digital Edge Cases

> **Epic**: Input
> **Status**: Complete
> **Last Updated**: 2026-06-29
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/input.md`
**Requirement**: `TR-INP-007` — Camera toggle debounced at `input.cameraDebounce` ms — single pulse per press, press-and-hold does not cycle.

**Also covers** (from GDD edge cases):

- Opposing digital steering (A+D simultaneously) → net zero steer
- Rapid gear shifts: at most one shift per tick — no queue
- Gear up + gear down simultaneously → both ignored

**ADR Governing Implementation**: ADR-0006: Input Abstraction
**ADR Decision Summary**: Camera toggle debounce at `input.cameraDebounce` (default 200ms) — prevents accidental double-toggle. Gear shift limited to one per tick (no queue). Opposing digital inputs cancel.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Pure logic — no Babylon imports. All behaviors are deterministically testable with virtual time.

**Control Manifest Rules (this layer)**:

- Performance (F-G3): Slot 1 (Input) < 0.01ms per tick — debounce timer check is a single timestamp comparison.

---

## Acceptance Criteria

_From GDD `design/gdd/input.md`, scoped to this story:_

- [ ] **AC-1**: Camera toggle fires at most once per 200ms (configurable via `input.cameraDebounce`); rapid presses within the debounce window produce a single toggle
- [ ] **AC-2**: Multiple rapid gear up/down presses produce at most 1 shift per tick (16ms); no queuing — rapid tapping shifts at tick rate, not press rate
- [ ] **AC-3**: A+D simultaneously (opposing digital steering) produces net zero steering
- [ ] **AC-4**: Gear up + gear down simultaneously → both ignored (gearDelta = 0)
- [ ] **AC-5**: Hold camera toggle button → does NOT cycle; only first press within debounce window counts; release and re-press outside window triggers a new toggle

---

## Implementation Notes

_Derived from ADR-0006 Implementation Guidelines:_

1. **Camera toggle debounce** — add state to `PlayerInput`:

   ```typescript
   private lastToggleTime = 0;
   private cameraDebounce = 200; // ms, from input.cameraDebounce config

   // In pulse detection, inside getState():
   const now = performance.now(); // permitted — outside pipeline slot, no determinism requirement
   if (pulse.cameraToggle && (now - this.lastToggleTime >= this.cameraDebounce)) {
     result.cameraToggle = true;
     this.lastToggleTime = now;
   } else {
     result.cameraToggle = false;
   }
   ```

2. **Gear rate limiting** — not per-tick limit but rather: gearDelta pulses are discrete events (Story 003 pulse detection already limits to one edge per press). The GDD says "at most one gear shift per tick (16ms)" — this is inherently satisfied by the polling architecture since `getState()` runs exactly once per tick. The pulse detection in Story 003 ensures gearDelta is non-zero for exactly one tick per press. No additional queueing logic needed.

3. **Opposing digital steering** — in the keyboard reading path:

   ```typescript
   const leftPressed = dsm.getInput(DeviceSourceType.Keyboard, 65); // A
   const rightPressed = dsm.getInput(DeviceSourceType.Keyboard, 68); // D
   if (leftPressed && rightPressed) {
     keyboardSteer = 0; // net zero
   } else if (leftPressed) {
     keyboardSteer = -1;
   } else if (rightPressed) {
     keyboardSteer = +1;
   } // else 0
   ```

4. **Opposing gear** — in the keyboard reading path:

   ```typescript
   const gearUpPressed = dsm.getInput(DeviceSourceType.Keyboard, 81); // Q
   const gearDownPressed = dsm.getInput(DeviceSourceType.Keyboard, 69); // E
   if (gearUpPressed && gearDownPressed) {
     keyboardGearDelta = 0; // both ignored
   }
   // pulse detection handles the edge/release
   ```

5. **Config for cameraDebounce**: Read from `input.cameraDebounce` on init, same pattern as `input.deadZone`.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 003 (PlayerInput)**: Core pulse detection and key mapping — this story adds debounce and cancellation logic on top of raw pulse detection
- Camera system: The `cameraToggle` boolean itself is just an InputState field; the Camera system (separate epic) reacts to it
- Config HMR for `input.cameraDebounce` — deferred to E2E verification (same pattern as dead zone HMR)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Logic story — automated test specs:**

- **AC-1**: camera toggle debounce at 200ms
  - Given: a debounce controller with `cameraDebounce = 200ms`
  - When: camera button pressed at `t = 0ms`
  - Then: `cameraToggle = true`
  - When: camera button pressed at `t = 50ms` (within window)
  - Then: `cameraToggle = false`
  - When: camera button pressed at `t = 100ms` (within window)
  - Then: `cameraToggle = false`
  - When: camera button pressed at `t = 250ms` (outside window)
  - Then: `cameraToggle = true`
  - Edge cases: `cameraDebounce = 0` → every press toggles; `cameraDebounce = 500` → max delay

- **AC-2**: gear shifts limited to 1 per tick
  - Given: 10 gear-up input events in a single simulated tick
  - Then: `gearDelta = 1` (only one shift)
  - When: next tick with no input
  - Then: `gearDelta = 0`
  - Edge cases: rapid alternating Q-E-Q-E → each press is distinct, limited by tick rate

- **AC-3**: A+D produces zero steer
  - Given: both A and D keys are pressed simultaneously
  - Then: keyboard `steer = 0` (net zero)
  - Given: only A pressed
  - Then: `steer = -1`
  - Given: only D pressed
  - Then: `steer = +1`
  - Edge cases: A+d (with gamepad overriding analog) → gamepad steer wins (Story 003 rule); keyboard nav unaffected

- **AC-4**: gear up + gear down cancel
  - Given: both Q and E pressed simultaneously
  - Then: `gearDelta = 0`
  - Edge cases: one held, other tapped → held side wins on release of the tapped side

- **AC-5**: hold camera toggle does not cycle
  - Given: camera toggle pressed at `t = 0ms`
  - Then: `cameraToggle = true`
  - When: camera toggle held at `t = 16ms, 32ms, 48ms ... 500ms`
  - Then: `cameraToggle = false` for all subsequent ticks
  - When: camera toggle released at `t = 500ms` and re-pressed at `t = 700ms`
  - Then: `cameraToggle = true` (new press outside debounce window)
  - Edge cases: release inside debounce window and re-press inside window → suppressed

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:

- Tests: `tests/unit/input/debounce-edge-cases.test.ts` — must exist and pass
- Virtual time simulation for debounce timing
- Combinatorial input tests for opposing steering and gear

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (PlayerInput pulse detection; this story adds refinement to the raw pulse output)
- Unlocks: None

## Completion Notes

**Completed**: 2026-06-29
**Criteria**: 5/5 passing
**Deviations**: None
**Test Evidence**: Unit test at `tests/unit/core/input/debounce-edge-cases.test.ts` (27 tests)
**Code Review**: Complete — APPROVED (babylonjs-specialist + qa-tester), APPROVED (lead-programmer)
