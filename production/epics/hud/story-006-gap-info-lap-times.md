# Story 006: GapInfoBlock & LapTimesBlock

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/hud.md`
**Requirement**: `TR-HUD-002` — All HUD updates driven by Event Bus events. GapInfoBlock and LapTimesBlock react to events for display data.

**ADR Governing Implementation**: ADR-0018: HUD Layout & Blocks
**ADR Decision Summary**: All blocks are event-driven, including lap times and gap info. No direct reads from game state — consistent with the architectural decision that eliminated the SpeedBlock direct-read exception.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: TextBlock for time display (MM:SS.mmm format). Standard Babylon.js GUI.

**Control Manifest Rules (this layer)**:

- Required: P6 (event-driven for all blocks)
- Forbidden: P-F4 (never use HTML/CSS for HUD)
- Guardrail: P-G1 (HUD < 0.3ms GPU per frame)

## Acceptance Criteria

_From GDD GapInfoBlock and LapTimesBlock sections:_

- [ ] AC-1: GapInfoBlock shows delta to car ahead as signed seconds: "+1.2s →" — tenths precision
- [ ] AC-2: GapInfoBlock shows delta to leader: "+0.8s L" — tenths precision
- [ ] AC-3: Both deltas update on `position.changed` event — payload: `{ deltaAhead: number, deltaLeader: number }`
- [ ] AC-4: LapTimesBlock shows 3 rows: current split (CUR), last lap (LAST), fastest lap (BEST)
- [ ] AC-5: Time format: "MM:SS.mmm" — e.g., "1:34.200". Leading zero for minutes if <10.
- [ ] AC-6: Current split updates via Event Bus (not direct read — consistent with ADR). Split data received through a throttled event from Race Management.
- [ ] AC-7: Last lap and fastest lap update on `car.lap.completed` — payload: `{ lapTime: number (ms), isFastest: boolean }`
- [ ] AC-8: Fastest lap rendered in accent color (#FF00FF magenta) when current lap is the new fastest
- [ ] AC-9: Labels "CUR", "LAST", "BEST" displayed in muted grey (#888888), ~24px at 1920

## Implementation Notes

_Derived from ADR-0018 Implementation Guidelines:_

1. **GapInfo display format**: Single line or two lines:
   - Delta to car ahead: `+1.2s →` (arrow indicates direction of car ahead)
   - Delta to leader: `+0.8s L` (L suffix for leader)
   - Light grey text, ~24px at 1920

2. **Lap times display**: Three rows, each with label + time:
   - CUR: live current split time
   - LAST: time of most recently completed lap
   - BEST: fastest lap time this session

3. **Time formatting**:

   ```typescript
   function formatTime(ms: number): string {
     const totalSec = ms / 1000;
     const min = Math.floor(totalSec / 60);
     const sec = totalSec % 60;
     const mmm = Math.round((sec - Math.floor(sec)) * 1000);
     return `${String(min)}:${String(Math.floor(sec)).padStart(2, "0")}.${String(mmm).padStart(3, "0")}`;
   }
   ```

4. **Split updates**: Race Management emits split data at a throttled rate (same pattern as SpeedBlock). The HUD subscribes to a `lap.split.tick` event. Do NOT read `playerCar` directly — ADR-0018 rejects direct reads.

5. **Best lap**: On `car.lap.completed`, if `isFastest === true`, the BEST row gets the accent color (#FF00FF). Previous best laps use standard white. If a new lap is even faster, the old "BEST" reverts to white and the new one gets magenta.

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 004: SpeedBlock (separate speed display)
- Story 005: LapBlock (lap counter only — different from lap times)

## QA Test Cases

_Manual verification steps — written by qa-lead at story creation:_

- **AC-1**: GapInfo delta ahead
  - Setup: Emit `position.changed` with `{ deltaAhead: 1.2 }`
  - Verify: GapInfoBlock text
  - Pass condition: Shows "+1.2s →"

- **AC-2**: GapInfo delta leader
  - Setup: Emit `position.changed` with `{ deltaLeader: 0.8 }`
  - Verify: Text
  - Pass condition: Shows "+0.8s L"

- **AC-4**: LapTimes shows 3 rows
  - Setup: After several laps, inspect LapTimesBlock container
  - Verify: 3 text elements with labels "CUR", "LAST", "BEST"
  - Pass condition: 3 visible TextBlocks, each correctly labelled

- **AC-5**: Time format MM:SS.mmm
  - Setup: Known elapsed time of 94.2 seconds
  - Verify: Lap time text
  - Pass condition: "1:34.200"

- **AC-7**: Last/fastest update on car.lap.completed
  - Setup: Emit `car.lap.completed` with `{ lapTime: 94000, isFastest: false }`
  - Verify: LAST and BEST rows
  - Pass condition: LAST updated, BEST unchanged

- **AC-8**: Fastest lap accent
  - Setup: After best lap is set, inspect BEST text color
  - Verify: TextBlock color
  - Pass condition: Color = #FF00FF (magenta)

- **AC-9**: Labels in grey
  - Setup: Inspect "CUR", "LAST", "BEST" label colors
  - Verify: Each label's color property
  - Pass condition: All are grey (#888888)

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/gapLapTimesBlock-evidence.md` + sign-off
**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 003 (HudManager — registration)
- Unlocks: None directly
