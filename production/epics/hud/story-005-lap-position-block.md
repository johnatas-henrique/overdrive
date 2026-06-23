# Story 005: LapBlock & PositionBlock

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/hud.md`
**Requirement**: `TR-HUD-002` — All HUD updates driven by Event Bus events. LapBlock reacts to `car.lap.completed`. PositionBlock reacts to `position.changed`.

**ADR Governing Implementation**: ADR-0018: HUD Layout & Blocks
**ADR Decision Summary**: Event-driven blocks update on Event Bus events. Mechanical animation for position change indicator (0.1s tick fade). Create-once/toggle-visibility per block.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Standard TextBlock for text display. No special Babylon.js GUI APIs needed.

**Control Manifest Rules (this layer)**:

- Required: P6 (event-driven for all blocks)
- Forbidden: P-F4 (never use HTML/CSS for HUD)
- Guardrail: P-G1 (HUD < 0.3ms GPU per frame)

## Acceptance Criteria

_From GDD LapBlock and PositionBlock sections:_

- [ ] AC-1: LapBlock displays format "Lap {current}/{total}" — e.g., "Lap 3/5"
- [ ] AC-2: LapBlock updates when `car.lap.completed` fires — payload: `{ carId, currentLap, totalLaps, lapTime }`
- [ ] AC-3: PositionBlock displays format "{current}/{total}" — e.g., "3/8"
- [ ] AC-4: PositionBlock reacts to `position.changed` — payload: `{ carId, currentPosition, totalPositions, delta }`
- [ ] AC-5: Change indicator shows ▲ (gained, green #00FF00), ▼ (lost, red #FF0000), — (unchanged, grey #888888) on position change. Initial state before any position change is "—"
- [ ] AC-6: Change indicator fades after 1.5s via HudAnimator (MECHANICAL style — alpha from 1 to 0 over 1.5s)
- [ ] AC-7: Indicators: ▲/▼ appear alongside the position text only when a change just occurred. If no change between two events, shows "—"

## Implementation Notes

_Derived from ADR-0018 Implementation Guidelines:_

1. **Lap counter**: `car.lap.completed` payload includes `{ currentLap: number, totalLaps: number, lapTime: number }`. Display text: `` `Lap ${currentLap}/${totalLaps}` ``. Only react when `carId === playerCarId`.

2. **Position display**: `position.changed` payload includes `{ currentPosition: number, totalPositions: number, delta: number }`. Display text: `` `${currentPosition}/${totalPositions}` ``. Only react when `carId === playerCarId`.

3. **Change indicator logic**:
   - Track `previousPosition` on each update
   - `currentPosition < previousPosition` → gained (▲ green)
   - `currentPosition > previousPosition` → lost (▼ red)
   - `currentPosition === previousPosition` → unchanged (— grey)
   - Initial state before first `position.changed`: "—"

4. **Fade animation**: On position change, set indicator alpha to 1. Play HudAnimator with style=MECHANICAL, property=alpha, from=1, to=0, duration=1500ms. Reset alpha to 1 and replay on next change.

5. **Bold white text** (~50px at 1920 for position, ~40px for lap), on rgba(0,0,0,0.35) background. Center column in right zone.

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 004: SpeedBlock (separate block in center zone)
- Story 006: GapInfoBlock & LapTimesBlock (separate blocks, different zone)

## QA Test Cases

_Manual verification steps — written by qa-lead at story creation:_

- **AC-1**: LapBlock format
  - Setup: Emit `car.lap.completed` with `{ currentLap: 3, totalLaps: 5 }`
  - Verify: LapBlock text
  - Pass condition: Displays "Lap 3/5"

- **AC-2**: LapBlock updates on event
  - Setup: Initial state, emit car.lap.completed with lap 2/5
  - Verify: Lap text changes
  - Pass condition: "Lap 1/5" → "Lap 2/5"

- **AC-3**: PositionBlock format
  - Setup: Emit `position.changed` with `{ currentPosition: 3, totalPositions: 8 }`
  - Verify: PositionBlock text
  - Pass condition: Displays "3/8"

- **AC-4**: PositionBlock reacts
  - Setup: Position 3/8, emit position.changed with 2/8
  - Verify: Position text
  - Pass condition: Changes from "3/8" to "2/8"

- **AC-5**: Change indicator ▲/▼/—
  - Setup: Emit position.changed indicating gain (3→2), loss (3→4), no change (3→3)
  - Verify: Indicator text and color
  - Pass condition: (gain) ▲ green, (loss) ▼ red, (no change) — grey

- **AC-6**: Indicator fades
  - Setup: Trigger position change, observe indicator
  - Verify: Indicator alpha after 1.5s
  - Pass condition: Indicator becomes invisible (alpha=0) after 1.5s via HudAnimator

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/lapPositionBlock-evidence.md` + sign-off
**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (HudAnimator — for fade animation), Story 003 (HudManager — registration)
- Unlocks: None directly
