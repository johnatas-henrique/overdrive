# Story 006: Race Setup Screen

> **Epic**: Menu LITE
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/menu-lite.md`
**Requirement**: `TR-MENU-005` (registry: Race Setup — track selection, lap count, difficulty, confirm to begin)

**ADR Governing Implementation**: ADR-0019: Menu LITE Architecture
**ADR Decision Summary**: Combined Track Select + Race Settings screen. Pre-created container with track cards, lap/difficulty toggle groups, team info bar, START RACE button. ESC preserves all selections. Confirm emits `RaceConfiguration`.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: `Grid` for track card layout. `Button` toggle groups for lap count and difficulty. `TextBlock` for team info bar. Track card `Image` for circuit silhouette.

**Control Manifest Rules (this layer)**:

- Required: P2 — Grid with `widthFraction`, proportional values, no star sizing
- Required: P7 — screen stack push/pop
- Required: P8 — pre-created controls
- Required: P9 — instant transitions
- Forbidden: P-F6 — no fade/slide in Phase 1

---

## Acceptance Criteria

_From GDD `design/gdd/menu-lite.md`, scoped to this story:_

- [ ] Race Setup shows 4 track cards arranged in a 2×2 grid (or horizontal row). Each card displays a circuit silhouette/photo and the track name.
- [ ] Selecting a track card highlights it with the team's accent colour border.
- [ ] Lap count selector: 4 button options (3, 5, 10, 20). Default selection: 5. Left/right navigation toggles between them.
- [ ] Difficulty selector: 5 button options (Very Easy, Easy, Medium, Hard, Very Hard). Default selection: Medium. Left/right navigation toggles between them.
- [ ] A team info bar at the bottom of the screen shows the confirmed team name and number (e.g., "Confirmed: LORRIS #7").
- [ ] START RACE button is always enabled (all settings have defaults).
- [ ] ENTER/A on START RACE pushes Loading screen via screen stack. Confirm is single-fire (rapid presses do not double-push).
- [ ] ESC/B on Race Setup pops to Car Select with all selections preserved (track, laps, difficulty).
- [ ] CONFIRM on START RACE emits a `RaceConfiguration` payload to the Single Race system: `{ trackId, lapCount, gridSize, playerCarId, difficulty, seed, aiDrivers }`.
- [ ] Applies Misto dark-panel style per art bible §7.1.

---

## Implementation Notes

_Derived from ADR-0019 Implementation Guidelines:_

- Track cards: 4 `Rectangle` containers in a `Grid` (2×2). Each has an `Image` (circuit silhouette) and `TextBlock` (track name) as children. If silhouette assets aren't ready, use a placeholder `Rectangle` with a filled colour.
- Track selection: `selectedTrackId` local state. Highlight via `Rectangle.outline` = team accent colour.
- Lap count: `Button[]` horizontal group. Active button highlighted. Navigation: arrow left/right moves selection within the group.
- Difficulty: same pattern as lap count. Values map to multipliers: Very Easy=0.75, Easy=0.875, Medium=1.0, Hard=1.125, Very Hard=1.25.
- Team info bar: `TextBlock` reading from local `selectedTeamId` → team name/number lookup. Updated when screen is pushed.
- `RaceConfiguration` interface:
  ```typescript
  interface RaceConfiguration {
    trackId: string;
    lapCount: number;
    gridSize: number;
    playerCarId: string;
    difficulty: number;
    seed: number;
    aiDrivers: AIDriverConfig[];
  }
  ```
- Single-fire confirm: consume `inputState.confirm` immediately on START RACE activation. Subsequent same-frame confirms are no-ops.
- Selection preservation on pop: `selectedTrackId`, `selectedLapCount`, `selectedDifficulty` stored in the screen's snapshot state (Story 001's push/pop contract). When Race Setup is re-pushed via CONFIRM from Car Select, these are restored.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 001: Screen stack, input routing, push/pop state preservation
- Story 007: Loading screen display and GSM transition

---

## QA Test Cases

_Manual verification steps:_

### V-006-1: 4 track cards visible

- **Setup**: CONFIRM on Car Select with a team selected.
- **Verify**: Four cards arranged in 2×2 or horizontal row. Each shows circuit silhouette/photo + track name.
- **Pass condition**: All 4 cards rendered, distinct, legible.

### V-006-2: Selected track has accent border

- **Setup**: Race Setup visible.
- **When**: Navigate to a track card.
- **Verify**: Selected card's border changes to team colour accent.
- **Pass condition**: Clear accent border on active track card.

### V-006-3: Lap count selector

- **Setup**: Race Setup visible.
- **Verify**: Lap count shows current value (default 5).
- **When**: Arrow left/right on the lap group.
- **Verify**: Changes between 3, 5, 10, 20. No values outside this set.
- **Pass condition**: 4 valid lap values, one always selected.

### V-006-4: Difficulty selector

- **Setup**: Race Setup visible.
- **Verify**: Difficulty shows current value (default Medium).
- **When**: Arrow left/right on the difficulty group.
- **Verify**: Changes between: Very Easy, Easy, Medium, Hard, Very Hard.
- **Pass condition**: 5 difficulty levels, one always selected.

### V-006-5: Team info bar visible

- **Setup**: Race Setup visible.
- **Verify**: Confirmed team name/number shown in info bar at bottom of screen.
- **Pass condition**: Info bar reads e.g., "Confirmed: LORRIS #7" in team colour.

### V-006-6: START RACE button visible

- **Setup**: Race Setup visible.
- **Verify**: Button labeled "START RACE" is visible, interactable.
- **Pass condition**: Button has correct label, hit area, positioned below settings.

### V-006-7: CONFIRM → Loading screen

- **Setup**: Race Setup visible, settings at defaults.
- **When**: Press ENTER/A on START RACE.
- **Verify**: Loading screen appears.
- **Pass condition**: Transition instant, Loading shows track name + tip.

### V-006-8: Single-fire confirm

- **Setup**: Race Setup visible.
- **When**: Rapidly press START RACE 3 times.
- **Verify**: Loading screen appears exactly once. No double-push.
- **Pass condition**: Second and third confirmations silently consumed.

### V-006-9: ESC preserves selections

- **Setup**: Race Setup. Select track B, laps=10, difficulty=Hard.
- **When**: Press ESC/B.
- **Verify**: Car Select appears with previously selected team still highlighted.
- **When**: Press CONFIRM again (re-enter Race Setup).
- **Verify**: Track B is still selected, laps=10, difficulty=Hard.
- **Pass condition**: All selections preserved through pop→push cycle.

### V-006-10: RaceConfiguration emitted

- **Setup**: Race Setup visible.
- **When**: Press START RACE.
- **Verify**: `RaceConfiguration` payload is emitted to Single Race system with correct values.
- **Pass condition**: Payload contains teamId, trackId, lapCount, difficulty, seed.

---

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/story-006-race-setup-evidence.md` or interaction test

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (MenuLite Core), Story 004 (Car Select → CONFIRM flow)
- Unlocks: Story 007 (Loading screen)
