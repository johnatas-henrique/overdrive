# Story 002: Title Screen

> **Epic**: Menu LITE
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/menu-lite.md`
**Requirement**: `TR-MENU-002` (registry: Title screen design — game title, 'Press ENTER to start')

**ADR Governing Implementation**: ADR-0019: Menu LITE Architecture
**ADR Decision Summary**: Screen stack manages Title as stack bottom. Pre-created container with logo + "Press ENTER." ESC on Title is ignored. ENTER pushes Main Menu.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: All GUI via `AdvancedDynamicTexture`. `Image` for logo, `TextBlock` for version and prompt.

**Control Manifest Rules (this layer)**:

- Required: P7 — screen stack push/pop
- Required: P8 — pre-created controls, instant `isVisible` toggle
- Required: P9 — instant transitions, no fade or slide
- Forbidden: P-F6 — never use fade/slide transitions in Phase 1

---

## Acceptance Criteria

_From GDD `design/gdd/menu-lite.md`, scoped to this story:_

- [ ] Title screen shows game logo (centred, large), version number (muted, below logo), and "PRESS ENTER TO START" text (centred, below version).
- [ ] No other interactive elements on Title — no buttons, no menus, no click targets.
- [ ] ENTER pushes Main Menu screen via screen stack `push(MainMenu)`.
- [ ] ESC on Title does nothing — no exit, no sound, no state change.
- [ ] Double-press ENTER on Title is safe: first press pushes Main Menu, subsequent press is consumed by Main Menu's first input tick (no crash, no screen skip).
- [ ] Applies Misto dark-panel style per art bible §7.1: background `#0d0d0f`, panel `#111114` with 1px border (5% white), 8px corner radius.

---

## Implementation Notes

_Derived from ADR-0019 Implementation Guidelines:_

- Pre-created `Container` for Title, added to ADT at init. `isVisible` toggled by screen stack.
- Logo: `Image` control with `stretch = Image.STRETCH_UNIFORM`. Source from asset bundle.
- Version number: `TextBlock` with muted colour (e.g., `#666670`), 14pt, below logo.
- "PRESS ENTER TO START": `TextBlock`, white, 18pt, centered, below version.
- Double-press safety: ENTER is consumed by screen stack's `onConfirm()`. Main Menu appears on frame N. Main Menu ignores confirm on frame N (no selection active yet).
- Misto style: apply to background panel `Container` via `background = "#111114"` and border via nested thin `Rectangle` with `cornerRadius = 8`. Root ADT background = `#0d0d0f`.
- Post-MVP: strongest car (McLaren Marlboro) rendered behind the title — not implemented in Phase 1.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 001: Screen stack infrastructure, input routing, GSM integration
- Story 003: Main Menu screen layout and navigation

---

## QA Test Cases

_Manual verification steps:_

### V-002-1: Logo is displayed

- **Setup**: Launch game. Scene starts with Menu GSM substate active.
- **Verify**: Game logo asset visible, centered, no distortion.
- **Pass condition**: Logo renders at correct aspect ratio in centre of screen.

### V-002-2: Version number displayed

- **Setup**: Title screen visible.
- **Verify**: Version string visible (e.g., "v0.1.0") below or beside logo, muted colour.
- **Pass condition**: Version text legible, positioned below logo.

### V-002-3: "PRESS ENTER TO START" visible

- **Setup**: Title screen visible.
- **Verify**: Text element visible, centred below version. Correct font, size, colour.
- **Pass condition**: Text matches spec: "PRESS ENTER TO START", white, 18pt, centered.

### V-002-4: No other interactive elements

- **Setup**: Title screen visible.
- **Verify**: No buttons, menus, or other click targets on screen.
- **Pass condition**: Only logo, version, and prompt text visible.

### V-002-5: ENTER pushes Main Menu

- **Setup**: Title screen visible.
- **When**: Press ENTER.
- **Verify**: Main Menu screen appears with Single Player + Options buttons.
- **Pass condition**: Transition occurs instantly (no fade), Main Menu visible.

### V-002-6: Rapid ENTER (×3) is safe

- **Setup**: Title screen visible.
- **When**: Press ENTER three times quickly.
- **Verify**: No crash, no screen skip. Main Menu appears once.
- **Pass condition**: Game remains stable, Main Menu displayed exactly once.

### V-002-7: ESC on Title does nothing

- **Setup**: Title screen visible.
- **When**: Press ESC.
- **Verify**: No action, no exit, Title screen remains visible.
- **Pass condition**: Title unchanged, no GSM transition, no pop.

### V-002-8: Misto dark-panel style

- **Setup**: Title screen visible.
- **Verify**: Background `#0d0d0f`. Panel area (if any) `#111114` with 1px (5% white) border, 8px corner radius.
- **Pass condition**: Visual matches art bible §7.1 spec.

---

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/story-002-title-screen-evidence.md` or interaction test

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (MenuLite Core — screen stack + input)
- Unlocks: Story 003 (Main Menu)
