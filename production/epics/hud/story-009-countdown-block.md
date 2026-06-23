# Story 009: CountdownBlock

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Visual/Feel
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/hud.md`
**Requirement**: `TR-HUD-009` — Countdown sequence display — 5 back-to-front lights at 1s intervals via LIGHT_INTERVAL_TICKS=60. Disappears on green flag.

**ADR Governing Implementation**: ADR-0018: HUD Layout & Blocks
**ADR Decision Summary**: CountdownBlock subscribes to `race.starting` (show 5 red lights), `race.light.countdown({ lightsOn })` (turn off one per event), `race.green.flag` (hide all). Row of 5 Ellipse controls (24px diameter, red). LightsOn indicates number of remaining lights.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Ellipse controls for countdown lights. Standard Babylon.js GUI — no special APIs.

**Control Manifest Rules (this layer)**:

- Required: P3 (create-once toggle-visibility)
- Forbidden: P-F4 (never use HTML/CSS for HUD)
- Guardrail: P-G1 (HUD < 0.3ms GPU per frame)

## Acceptance Criteria

_From GDD Event Subscriptions and Countdown section:_

- [ ] AC-1: 5 Ellipse controls (red, 24px diameter, spaced evenly) shown at centre-top of screen
- [ ] AC-2: Shows on `race.starting` event — container becomes visible
- [ ] AC-3: Each `race.light.countdown({ lightsOn: number })` event turns off the Nth light: `lightsOn=5` → all 5 on, `lightsOn=4` → 4 on, ..., `lightsOn=0` → all off
- [ ] AC-4: All lights hidden on `race.green.flag` — container `isVisible = false`
- [ ] AC-5: Block is managed as overlay (top-level ADT child, not in Grid)

## Implementation Notes

_Derived from ADR-0018 Implementation Guidelines:_

1. **Light array**: 5 `Ellipse` controls created at init:

   ```typescript
   for (let i = 0; i < 5; i++) {
     const light = new Ellipse(`countdown_${i}`);
     light.width = "24px";
     light.height = "24px";
     light.color = "#FF0000"; // red border
     light.background = "#FF0000"; // red fill
     // position spaced horizontally, centre-top
     light.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
     // offset left/right from center
     light.left = (i - 2) * 36; // 36px spacing, centered
     light.top = 20; // 20px from top
   }
   ```

2. **LightsOn logic**: `lightsOn` is the count of remaining lit lights. When `lightsOn=5`, all 5 are visible. When `lightsOn=4`, index 4 is hidden. When `lightsOn=0`, all hidden.

3. **Hide on green flag**: On `race.green.flag`, set `container.isVisible = false`. All subscriptions are cleared.

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 003: HudManager — overlay registration lifecycle
- Story 010: AlertBlock — separate overlay for contextual messages

## QA Test Cases

_Manual verification steps — written by qa-lead at story creation:_

- **AC-1**: 5 red Ellipses at centre-top
  - Setup: Emit `race.starting`
  - Verify: 5 Ellipse controls at centre-top of screen
  - Pass condition: 5 red circles of 24px, evenly spaced, centre-top

- **AC-3**: Each event turns off one light
  - Setup: After race.starting, emit `race.light.countdown({ lightsOn: 4 })`
  - Verify: Count of visible red lights
  - Pass condition: 4 red lights visible (1 off)
  - Repeat for 3, 2, 1, 0

- **AC-4**: Green flag hides all
  - Setup: Emit `race.green.flag`
  - Verify: CountdownBlock container
  - Pass condition: `container.isVisible === false`

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**: `production/qa/evidence/countdownBlock-evidence.md` + sign-off
**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 003 (HudManager — overlay registration)
- Unlocks: None directly
