# Story 001: MenuLite Core — Screen Stack + Input + GSM

> **Epic**: Menu LITE
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/menu-lite.md`
**Requirement**: `TR-MENU-001` (screen stack + ADT), `TR-MENU-006` (input navigation from `InputState`), `TR-MENU-007` (GSM local copy via Event Bus subscription)

**ADR Governing Implementation**: ADR-0019: Menu LITE Architecture
**ADR Decision Summary**: Screen stack with pre-created controls, instant `isVisible` transitions, GSM local copy via Event Bus subscription, input via `IInput.getState()`.

**Engine**: Babylon.js 9.12.0 | **Risk**: MEDIUM
**Engine Notes**: `CreateFullscreenUI("Menu", true, scene)` — `foreground=true`. Both Menu and HUD ADTs use foreground=true. During Race: Menu's root container hidden via `isVisible=false`. During Menu: HUD's root container hidden via `isVisible=false`.

**Control Manifest Rules (this layer)**:

- Required: P7 — screen stack push/pop, one active screen at a time, no overlapping dialogs in Phase 1
- Required: P8 — pre-create 6 screens at init (~600KB controls + ~1MB thumbnails), navigation toggles `isVisible`
- Required: P9 — instant transitions, no fade or slide in Phase 1
- Required: P10 — GSM local copy via Event Bus subscription
- Forbidden: P-F6 — never use fade/slide transitions in Phase 1
- Forbidden: P-F4 — never use HTML/CSS for UI
- F23 — no system calls `gsm.getCurrent()` — react to `gsm.state.entered`/`exited` via Event Bus

---

## Acceptance Criteria

_From GDD `design/gdd/menu-lite.md`, scoped to this story:_

- [ ] `push(screenId, state?)` pushes a screen onto the stack, hides the current screen, shows the new one. `pop()` hides the current screen, shows the previous one, restores its state snapshot.
- [ ] `pop()` on stack depth 1 (Title only) is a no-op — never pops Title.
- [ ] Stack enforces max depth of 3 — attempting to push beyond 3 fails gracefully (no crash, no silent ignore).
- [ ] At init: all 6 screen containers pre-created and added to ADT, only Title visible.
- [ ] Screen transition is truly instant — `containerA.isVisible = false` + `containerB.isVisible = true` in the same execution frame.
- [ ] GSM Event Bus subscription: on `gsm.state.entered(to=Menu)` → push Title. On `gsm.state.entered(to=PostRace)` → push Results. On `gsm.state.entered(to=Racing)`/`PreRace` → menu deactivates (handled by GSM lifecycle).
- [ ] Input: each frame, reads `IInput.getState()` and routes `confirm`, `cancel`, `navUp`, `navDown`, `navLeft`, `navRight` to the active screen's handler.
- [ ] Each input action is consumed (set to `false`) after routing — single-fire per press.
- [ ] `cancel` on Title is consumed silently (no-op, no game exit).
- [ ] Gamepad D-pad + A + B buttons are routed via the Input system (ADR-0006), not read directly.
- [ ] Selection state (`selectedTeamId`, `selectedTrackId`, `selectedLaps`, `selectedDifficulty`) survives `pop()` — when Race Setup pops back to Car Select, the previously selected team is restored.

---

## Implementation Notes

_Derived from ADR-0019 Implementation Guidelines:_

- Menu ADT: `CreateFullscreenUI("Menu", true, scene)` — `foreground=true`. Both Menu and HUD use `foreground=true`; one root container is hidden at any time.
- Screen stack as `Map<MenuScreen, Container>` + `MenuScreen[]` array. Pre-create all containers at init, never call `addControl()` at runtime.
- `push()`/`pop()` accept an optional state snapshot that is serialized/restored per screen.
- Input consumer runs in `menuScene.onBeforeRenderObservable` or via pipeline-like per-frame `update()` call. The pipeline (ADR-0002) may not own menu updates — coordinate with engine-programmer.
- Input consumer: `if (inputState.confirm) { handle(); inputState.confirm = false; }` pattern for each action.
- GSM events arrive via Event Bus: subscribe `eventBus.on('gsm.state.entered', handler)` with local `currentGsmState` copy.
- Stack depth guard: `if (this.stack.length >= 3) return;` in `push()`.
- Pre-allocated controls: 6 screens × ~50 controls = ~300 controls at ~600KB. Negligible memory cost.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 002 (Title): visual content of Title screen — logo, text, layout
- Story 003 (Main Menu): Main Menu button layout and navigation
- Story 004 (Car Select): Car Select grid, selection, highlight logic
- Story 005 (Car Thumbnails): RTT capture of car models
- Story 006 (Race Setup): track cards, lap/difficulty selectors
- Story 007 (Loading): loading screen timer, tip display, transition coordination
- Story 008 (Results): results screen layout, count-up, rival reactions

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

### TC-001-01: Stack push preserves caller state

- **Given**: A screen stack with [Title, MainMenu]
- **When**: CarSelect is pushed with state `{ selectedTeamId: 3 }`
- **Then**: MainMenu state is preserved on the stack. CarSelect is visible. Stack depth = 3.

### TC-001-02: Stack pop restores previous screen state

- **Given**: A screen stack with [Title, MainMenu, CarSelect]. CarSelect has state `{ selectedTeamId: 3 }`.
- **When**: `pop()` is called
- **Then**: CarSelect is hidden. MainMenu is visible. MainMenu's state is unchanged from before CarSelect was pushed. Stack depth = 2.

### TC-001-03: ESC on Title is no-op

- **Given**: Screen stack has [Title] only (depth = 1)
- **When**: `cancel` action is routed from input
- **Then**: Stack depth unchanged at 1. Title screen remains visible. No transition request emitted.

### TC-001-04: Single-fire consumption prevents double-confirm

- **Given**: CarSelect is the active screen. A team IS selected (Confirm enabled).
- **When**: `confirm` action is received twice in the same frame
- **Then**: RaceSetup is pushed exactly once. Second confirm is consumed silently (no error, no double-push).

### TC-001-05: Max stack depth enforced

- **Given**: Stack depth = 3 (Title, MainMenu, CarSelect)
- **When**: A `push` is attempted
- **Then**: `push()` returns false or no-ops. Stack remains at depth 3. No screen change occurs.

### TC-001-06: Input routing reaches active screen only

- **Given**: Screen stack has [Title, MainMenu]. MainMenu is active.
- **When**: `navDown` is received
- **Then**: Only MainMenu's focus handler receives the event. Title does not process it.

**Edge cases:**

- `pop()` on empty stack (Title only) → no-op, no error
- `push()` with null/undefined screen ID → graceful rejection
- Input received between frames (no active screen) → consumed silently

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/menu-lite/menu-lite-core.test.ts` — must exist and pass

**Status**: [ ] Not yet created

## Dependencies

- Depends on: ADR-0019 (Accepted), ADR-0006 (Input — `IInput.getState()`), Event Bus (Foundation), GSM (Foundation)
- Unlocks: Story 002 (Title Screen), Story 003 (Main Menu), Story 004 (Car Select), Story 006 (Race Setup), Story 007 (Loading), Story 008 (Results)
