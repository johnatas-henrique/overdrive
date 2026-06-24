# Story 003: Main Menu Screen

> **Epic**: Menu LITE
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/menu-lite.md`
**Requirement**: `TR-MENU-004` — Main Menu screen: two buttons — Single Player (race flow) and Options (settings). ESC returns to Title.

**ADR Governing Implementation**: ADR-0019: Menu LITE Architecture
**ADR Decision Summary**: Main Menu is a pre-created screen pushed via screen stack. Hub with two buttons (Single Player, Options). ESC returns to Title.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Button controls via `Button.CreateSimpleButton()` or `Button.CreateImageButton()`. `TextBlock` for logo.

**Control Manifest Rules (this layer)**:

- Required: P7 — screen stack push/pop
- Required: P8 — pre-created controls
- Required: P9 — instant transitions
- Forbidden: P-F6 — never use fade/slide in Phase 1

---

## Acceptance Criteria

_From GDD `design/gdd/menu-lite.md`, scoped to this story:_

- [ ] Main Menu shows game logo (smaller than Title) and two buttons: "SINGLE PLAYER" (primary action, accent colour) and "OPTIONS" (secondary action).
- [ ] Default focus: Single Player button is focused/highlighted on screen entry.
- [ ] Tab/arrow down wraps through buttons: Single Player → Options → [wrap to Single Player].
- [ ] ENTER/A on Single Player pushes Car Select via screen stack.
- [ ] ENTER/A on Options pushes Options screen (placeholder — shows "Options — Coming Soon" or similar).
- [ ] ESC/B on Main Menu returns to Title via screen stack pop.
- [ ] Applies Misto dark-panel style per art bible §7.1. Team colour accent on Single Player button (default accent before any team is selected).

---

## Implementation Notes

_Derived from ADR-0019 Implementation Guidelines:_

- Pre-created `Container` with smaller logo `Image`, two `Button` controls, and background panel.
- Button text: uppercase per GDD visual requirements ("SINGLE PLAYER", "OPTIONS").
- Focus management: `Button.focus()` on entry. Arrow up/down cycles through button list. Wrap at ends.
- Single Player button: uses default team accent colour (e.g., white or accent `#ff4444`) until a team is selected on Car Select.
- Options screen: minimal placeholder. Single `TextBlock` with "OPTIONS — Coming Soon" and an ESC handler to pop back. No settings implemented in Phase 1.
- Single Player → Car Select: call `push(CarSelect)` on confirm. Car Select pre-created and ready.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 001: Screen stack infrastructure, input routing
- Story 002: Title screen
- Story 004: Car Select screen grid and selection logic

---

## QA Test Cases

_Manual verification steps:_

### V-003-1: Single Player button visible

- **Setup**: Press ENTER on Title to reach Main Menu.
- **Verify**: Button labeled "SINGLE PLAYER" is visible, centred, interactable.
- **Pass condition**: Button renders with correct text, accent colour, and hit area.

### V-003-2: Options button visible

- **Setup**: Main Menu visible.
- **Verify**: Button labeled "OPTIONS" is visible, positioned below Single Player.
- **Pass condition**: Button renders with correct text, style, and hit area.

### V-003-3: Single Player → Car Select

- **Setup**: Main Menu visible. Single Player focused.
- **When**: Press ENTER/A.
- **Verify**: Car Select screen appears.
- **Pass condition**: Transition is instant. Car Select grid visible.

### V-003-4: Options → Options screen

- **Setup**: Main Menu visible.
- **When**: Navigate to Options button, press ENTER/A.
- **Verify**: Options screen appears (placeholder text).
- **Pass condition**: Screen shows "Options — Coming Soon" or equivalent. ESC returns to Main Menu.

### V-003-5: Default focus on Single Player

- **Setup**: Main Menu opens.
- **Verify**: Single Player button is visually focused/highlighted.
- **Pass condition**: Focus indicator visible on Single Player button immediately.

### V-003-6: Tab/arrow wraps through buttons

- **Setup**: Main Menu visible. Single Player focused.
- **When**: Press arrow down once.
- **Verify**: Focus moves to Options.
- **When**: Press arrow down again.
- **Verify**: Focus wraps back to Single Player.
- **Pass condition**: Arrow up also wraps in reverse direction.

### V-003-7: ESC returns to Title

- **Setup**: Main Menu visible.
- **When**: Press ESC/B.
- **Verify**: Title screen appears with logo + "PRESS ENTER".
- **Pass condition**: Transition is instant. Title state is clean (no stale selection state).

### V-003-8: Misto dark-panel style

- **Setup**: Main Menu visible.
- **Verify**: Background `#0d0d0f`, panel `#111114`, buttons styled per art bible.
- **Pass condition**: Visual matches art bible §7.1.

---

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/story-003-main-menu-evidence.md` or interaction test

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (MenuLite Core — screen stack + input), Story 002 (Title — ENTER flow)
- Unlocks: Story 004 (Car Select), Story 006 (Race Setup)
