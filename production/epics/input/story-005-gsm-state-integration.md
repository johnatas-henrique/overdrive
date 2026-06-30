# Story 005: GSM State Integration + Input Blocking

> **Epic**: Input
> **Status**: Complete
> **Last Updated**: 2026-06-29
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/input.md`
**Requirement**: `TR-INP-006` — Subscribe to `gsm.state.entered` and `gsm.state.exited` on Event Bus; maintain local `currentState` copy (never call `gsm.getCurrent()`). Block all inputs during the transition window.

**ADR Governing Implementation**: ADR-0006: Input Abstraction
**ADR Decision Summary**: Input subscribes to GSM state events during init. On `exited`: set `transitionBlocking = true`, `getState()` returns InputState.ZERO. On `entered`: set `transitionBlocking = false`, flush stale cache. The `pauseToggle` pulse routes to `gsm.transition()` per local state. The `confirm` pulse routes per local state (PreRace→Race Management, pitStopped→departing, PostRace→overlay, Menu→confirm).

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Zero Babylon imports for this story — communicates entirely through Event Bus (Foundation layer). The `pauseToggle` pulse calls `gsm.transition()` which is a GSM public API.

**Control Manifest Rules (this layer)**:

- Required: Event Bus is the ONLY cross-system pattern for state-change signals (F20).
- Required: No system calls `gsm.getCurrent()` — all systems react to Event Bus events (F23).
- Required: GSM emits 2 events per transition: `exited(old)` then `entered(new)` (F24).
- Forbidden (F-F5): Never call `gsm.getCurrent()` from any system.

---

## Acceptance Criteria

_From GDD `design/gdd/input.md`, scoped to this story:_

- [ ] **AC-1**: On init, subscribes to `gsm.state.entered` and `gsm.state.exited` on Event Bus (uses Subscription pattern from Foundation Event Bus — `on()` returns `Subscription`)
- [ ] **AC-2**: Maintains local `currentState` copy from `gsm.state.entered` payload — never calls `gsm.getCurrent()`
- [ ] **AC-3**: `gsm.state.exited` → `transitionBlocking = true`; `getState()` returns `InputState.ZERO`
- [ ] **AC-4**: `gsm.state.entered` → `transitionBlocking = false`; flushes stale cached values (sets `prevDigitalState` to current hardware state to prevent stale pulse edges)
- [ ] **AC-5**: `pauseToggle` routes per state: when `currentState === 'Racing'` → `gsm.transition('Paused')`; when `currentState === 'Paused'` → `gsm.transition('Racing')`; other states → silently ignored
- [ ] **AC-6**: `confirm` routed per local state via Event Bus:
  - PreRace → `gsm.transition('Racing')` (skip grid cinematic)
  - Racing (pitStopped) → `eventBus.emit('input.pit.depart')` (Pit Stop system consumes)
  - PostRace → `eventBus.emit('input.confirm.postRace')` (PostRace overlay consumes)
  - Menu → `eventBus.emit('input.confirm.menu')` (Menu layer consumes)
- [ ] **AC-7**: Menu navigation (navUp, navDown, cancel) only active when `currentState === 'Menu'`; in all other states these inputs produce zero/false
- [ ] **AC-8**: All inputs blocked during GSM transitions — from `exited` to `entered`, `getState()` returns `InputState.ZERO` for all fields

---

## Implementation Notes

_Derived from ADR-0006 Implementation Guidelines:_

1. **GSM Transition Blocking** (from ADR-0006):

   ```typescript
   eventBus.on("gsm.state.exited", (prevState) => {
     this.transitionBlocking = true;
   });
   eventBus.on("gsm.state.entered", (nextState) => {
     this.transitionBlocking = false;
     this.currentState = nextState;
     this.prevDigitalState = {}; // flush stale cache
   });
   ```

2. **getState() extension** (from ADR-0006):

   ```typescript
   getState(): InputState {
     // 0. GSM transition blocking overrides everything
     if (this.transitionBlocking) return InputState.ZERO;
     // 1. Tab blur (Story 004)
     if (this.hidden) return InputState.ZERO;
     // ... polling loop (Story 003)
   }
   ```

3. **Pause routing** (from GDD Interactions section):

   ```typescript
   processPulse(pulse: InputState): void {
     if (pulse.pauseToggle) {
       if (this.currentState === 'Racing') gsm.transition('Paused');
       else if (this.currentState === 'Paused') gsm.transition('Racing');
       // other states → silently ignore
     }
   }
   ```

4. **Confirm routing** (from GDD):
   - **PreRace** → `gsm.transition('Racing')` (skip grid cinematic)
   - **Racing (pitStopped)** → `eventBus.emit('input.pit.depart')` (Pit Stop system consumes)
   - **PostRace** → `eventBus.emit('input.confirm.postRace')` (PostRace overlay consumes)
   - **Menu** → `eventBus.emit('input.confirm.menu')` (Menu layer consumes)

5. **Transition window characterization** (from ADR-0006): `exited` and `entered` fire in the same tick for instantaneous transitions. For asset-heavy transitions (track load), the window may be up to 3s. During this window, `getState()` returns all-zeros, preventing stale hardware reads and stuck pulses.

6. **Why blocking is needed** (from ADR-0006):
   - Menu→PreRace: menu button pulse could persist into PreRace, causing unintended action
   - Racing→PostRace: held throttle/steer at finish line would carry into results screen
   - PostRace→Menu: input pulse during results screen should not trigger menu action

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- **Story 003 (PlayerInput)**: Core polling loop — this story adds GSM state gating around it
- **Story 006 (Debounce)**: Camera toggle debounce — this story routes `pauseToggle` and `confirm` only
- GSM state machine implementation: The transition table and state validations live in the GSM epic
- Event Bus implementation: Assumed available from Foundation layer Event Bus epic

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Integration story — automated test specs:**

- **AC-1**: subscribes to GSM events on init
  - Given: an EventBus spy
  - When: `PlayerInput.init(engine, eventBus, ...)`
  - Then: `eventBus.on` was called with `'gsm.state.entered'` AND `'gsm.state.exited'`
  - Edge cases: `init()` re-entrancy — calling init a second time unsubscribes old handlers first

- **AC-2**: local currentState from entered events; never calls gsm.getCurrent
  - Given: `gsm.getCurrent` is mocked to throw on call
  - When: `gsm.state.entered` fires with `'Racing'`
  - Then: internal `currentState === 'Racing'` (verified via pause routing behavior)
  - And: `gsm.getCurrent` was never called

- **AC-3**: exited blocks all inputs
  - Given: live inputs: steer = 0.8, confirm = true
  - When: `gsm.state.exited` fires with `previousState = 'Racing'`
  - Then: `getState()` === `InputState.ZERO`
  - Edge cases: exited fires twice → still blocked (idempotent)

- **AC-4**: entered unblocks inputs and resets
  - Given: transition is blocked
  - When: `gsm.state.entered` fires with `nextState = 'Menu'`
  - Then: `getState().steer ≈ liveSteerValue` (not ZERO)
  - And: `transitionBlocking === false`
  - Edge cases: entered fires twice → still unblocked (idempotent)

- **AC-5**: pauseToggle routes per state
  - Given: `currentState = 'Racing'` AND `gsm.transition` is mocked
  - When: `pauseToggle = true` in getState()
  - Then: `gsm.transition` was called with `'Paused'`
  - Given: `currentState = 'Paused'`
  - When: `pauseToggle = true`
  - Then: `gsm.transition` was called with `'Racing'`
  - Edge cases: `currentState` in `['Menu', 'PreRace', 'PostRace']` → `gsm.transition` NOT called

- **AC-6**: confirm routes per state
  - Given: `currentState = 'PreRace'` AND `gsm.transition` is mocked
  - When: `confirm = true`
  - Then: `gsm.transition` was called with `'Racing'`
  - Given: `currentState = 'Racing'` AND `eventBus.emit` is spied AND `pitStopped = true`
  - When: `confirm = true`
  - Then: `eventBus.emit` was called with `'input.pit.depart'`
  - Given: `currentState = 'PostRace'` AND `eventBus.emit` is spied
  - When: `confirm = true`
  - Then: `eventBus.emit` was called with `'input.confirm.postRace'`
  - Given: `currentState = 'Menu'` AND `eventBus.emit` is spied
  - When: `confirm = true`
  - Then: `eventBus.emit` was called with `'input.confirm.menu'`
  - Edge cases: confirm in `'Paused'` state → ignored (pause owns Escape)

- **AC-7**: nav only active in Menu state
  - Given: `currentState = 'Menu'`
  - When: `navUp = true`
  - Then: `getState().navUp === true`
  - Given: `currentState in ['Racing', 'Paused', 'PreRace', 'PostRace']`
  - When: `navUp = true`
  - Then: `getState().navUp === false`
  - Edge cases: all nav fields (navUp, navDown, cancel) follow same rule

- **AC-8**: all inputs blocked during transitions
  - Given: a transition from any state to any other state
  - When: `gsm.state.exited` fires
  - Then: `getState()` === `InputState.ZERO` for all fields
  - Edge cases: engine tick advances during long transition → every tick returns ZERO until `entered`

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:

- Tests: `tests/integration/input/gsm-state-integration.test.ts` — must exist and pass
- Mocked Event Bus + GSM (state machine spy)
- Transition sequence tests for all state pairs

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (PlayerInput class to add GSM gating to)
- Unlocks: None

## Completion Notes

**Completed**: 2026-06-29
**Criteria**: 8/8 passing
**Deviations**: None
**Test Evidence**: Integration test at `tests/integration/input/gsm-state-integration.test.ts` (33 tests)
**Code Review**: Complete — APPROVED (babylonjs-specialist + qa-tester), APPROVED WITH SUGGESTIONS (lead-programmer)
**LP Suggestions Applied**: @internal JSDoc added to setTransitionBlocking and setHidden
