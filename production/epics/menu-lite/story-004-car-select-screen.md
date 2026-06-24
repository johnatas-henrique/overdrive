# Story 004: Car Select Screen

> **Epic**: Menu LITE
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/menu-lite.md`
**Requirement**: `TR-MENU-003` (registry: Car Select — grid of 8 car thumbnails, team name, selection)

**ADR Governing Implementation**: ADR-0019: Menu LITE Architecture
**ADR Decision Summary**: Car Select is a pre-created screen with 8 team cards in a Grid container. Navigation via directional input. Selection highlights with accent border. Confirm enabled only when a team is selected.

**Engine**: Babylon.js 9.12.0 | **Risk**: MEDIUM
**Engine Notes**: `Grid` with 2 rows × 4 columns. `widthFraction` for proportional sizing. No star sizing (`ParameterType.Star` unsupported). Team colour accent via dynamic `Rectangle.background` or `TextBlock.color`.

**Control Manifest Rules (this layer)**:

- Required: P2 — Grid with `widthFraction`, proportional values summing to 1.0. NO star sizing.
- Required: P8 — pre-create all controls at init, `isVisible` toggle
- Forbidden: P-F6 — no fade/slide transitions

---

## Acceptance Criteria

_From GDD `design/gdd/menu-lite.md`, scoped to this story:_

- [ ] Car Select shows 8 teams arranged in a 2×4 grid. Each cell displays: team colour swatch, car number, team name.
- [ ] Arrow keys / D-pad navigate the grid: up/down moves between rows, left/right moves within a row. End of grid stays on last cell (no wrap).
- [ ] When a team is selected/highlighted, the cell shows an accent border in that team's colour.
- [ ] Confirm button is disabled (greyed out) when no team is selected. Selecting any team enables it.
- [ ] Changing selection multiple times updates the highlight border and the team colour accent across the screen reactively.
- [ ] CONFIRM (ENTER/A) pushes Race Setup screen via screen stack.
- [ ] ESC (B) returns to Main Menu via screen stack pop.
- [ ] Applies Misto dark-panel style per art bible §7.1. Team colour accent appears as top bar gradient (3px), active cell border, and stat fill. ≤5% of screen area.

---

## Implementation Notes

_Derived from ADR-0019 Implementation Guidelines:_

- Grid: `Grid` with `addRowDefinition(new RowDefinition(undefined, true, 0.5))` × 2 rows, 4 `addColumnDefinition(new ColumnDefinition(undefined, true, 0.25))` columns. Each cell is a `Rectangle` container.
- Each cell: `Rectangle` (team colour swatch as thin top border or background) + `TextBlock` (car number, large) + `TextBlock` (team name, smaller below). Team name per GDD: full proper name (e.g., "Red Bull Racing"), not abbreviation.
- Focus highlight: `Rectangle.outline = teamColour`, `outlineWidth = 2`.
- Confirm button: standard Babylon.js GUI `Button`, initially `.isEnabled = false`. On selection → `.isEnabled = true`.
- Team colour accent reaction: emit an event or callback when selection changes; screens subscribed update their accent elements. Alternatively, a shared `accentColour` state object that screens read each frame.
- ESC/Cancel: stack pop — no selection state needs preserving because Main Menu→Car Select restarts selection.
- Grid navigation: custom handler that tracks `selectedRow` (0-1) and `selectedCol` (0-3). Arrow up/down changes row; arrow left/right changes col. Clamp at boundaries (no wrap).

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 001: Screen stack infrastructure, input routing
- Story 005: Car thumbnail RTT capture (the Image source for each cell)
- Story 006: Race Setup screen

---

## QA Test Cases

_Manual verification steps:_

### V-004-1: 8 teams in 2×4 grid

- **Setup**: Press Single Player on Main Menu.
- **Verify**: Exactly 8 cells visible, arranged in 2 rows × 4 columns.
- **Pass condition**: All 8 team slots rendered, no gaps, no overflow.

### V-004-2: Each cell shows colour swatch + number + name

- **Setup**: Car Select visible.
- **Verify**: Each cell has team colour swatch (coloured rectangle/border), car number (e.g., "1"), team name (e.g., "Red Bull Racing").
- **Pass condition**: Three elements per cell, legible, correctly aligned.

### V-004-3: Arrow navigation across grid

- **Setup**: Car Select visible. First cell (top-left) focused.
- **When**: Press right → focus moves right. Press down → focus moves to second row.
- **Verify**: Arrow keys move focus predictably. End of grid stops (no wrap).
- **Pass condition**: Grid navigation matches expected row-by-row, no-wrap behaviour.

### V-004-4: Selection highlights with accent border

- **Setup**: Car Select visible.
- **When**: Navigate to a team cell.
- **Verify**: Selected cell shows team-colour accent border/highlight. Unselected cells have neutral style.
- **Pass condition**: Highlight clearly distinguishes selected cell.

### V-004-5: Confirm button disabled initially

- **Setup**: Car Select visible, no team pre-selected.
- **Verify**: "Confirm" button is greyed out or non-interactable.
- **Pass condition**: Cannot confirm without selection.

### V-004-6: Confirm button enables on selection

- **Setup**: Car Select visible.
- **When**: Select any team.
- **Verify**: Confirm button becomes active/interactable.
- **Pass condition**: Button style changes to active state immediately.

### V-004-7: Selection changes update accent colour

- **Setup**: Car Select visible.
- **When**: Select team A (red accent). Then select team B (blue accent).
- **Verify**: Screen accent elements (top bar, borders) change colour reactively.
- **Pass condition**: Colour change happens within same frame.

### V-004-8: Multiple selection changes work

- **Setup**: Car Select visible.
- **When**: Cycle through 3+ teams.
- **Verify**: Each change: highlight moves, accent colour updates, Confirm stays enabled.
- **Pass condition**: No glitches, no stale state.

### V-004-9: CONFIRM → Race Setup

- **Setup**: Team selected.
- **When**: Press ENTER/A on Confirm.
- **Verify**: Race Setup screen appears.
- **Pass condition**: Transition instant, Race Setup shows team in info bar.

### V-004-10: ESC → Main Menu

- **Setup**: Car Select visible.
- **When**: Press ESC/B.
- **Verify**: Main Menu appears.
- **Pass condition**: Transition instant. No selection preserved (Main Menu→Car Select restarts).

### V-004-11: Team thumbnail visible (if Story 005 implemented)

- **Setup**: Car Select visible, team selected.
- **Verify**: Selected team's car thumbnail image visible in designated area.
- **Pass condition**: Thumbnail renders with transparent background.

---

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/story-004-car-select-evidence.md` or interaction test

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (MenuLite Core), Story 003 (Main Menu → Car Select flow)
- Unlocks: Story 006 (Race Setup)
