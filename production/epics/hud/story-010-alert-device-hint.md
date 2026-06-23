# Story 010: AlertBlock & DeviceHint

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/hud.md`, `design/ux/hud.md`
**Requirement**: `TR-HUD-010` — Alert block with priority display (max 2 simultaneous, FIFO replacement). Device hint overlay on onDeviceChanged event, auto-fades after 1.5s.

**ADR Governing Implementation**: ADR-0018: HUD Layout & Blocks
**ADR Decision Summary**: Alert messages are contextual overlay blocks managed via visibility toggle. FIFO queue, max 2 simultaneous, auto-dismiss after 2s. Device hint overlay shown briefly on input device change.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: TextBlock for alert messages. Standard Babylon.js GUI.

**Control Manifest Rules (this layer)**:

- Required: P3 (create-once toggle-visibility)
- Forbidden: P-F4 (never use HTML/CSS for HUD)
- Guardrail: P-G1 (HUD < 0.3ms GPU per frame)

## Acceptance Criteria

_From UX doc Alert Block section and GDD Dynamic Behaviours:_

- [ ] AC-1: Text messages display at centre-middle of screen (overlay position)
- [ ] AC-2: Max 2 simultaneous alerts. When a 3rd arrives while 2 are displayed, the oldest alert is immediately replaced (FIFO queue, max length 2)
- [ ] AC-3: Each alert auto-dismisses after 2s — text disappears instantly (no fade animation)
- [ ] AC-4: Predefined message mapping:
  - `pit.status = pitStopped` → "PIT READY"
  - Fuel level drops to 0% → "FUEL EMPTY"
  - Proximity to car ahead → "CAR AHEAD"
  - Proximity to car behind → "CAR BEHIND"
  - Position gained → "+1 POS"
  - Position lost → "-1 POS"
- [ ] AC-5: Device hint overlay shows on `onDeviceChanged` event from Input system — displays "Keyboard" or "Gamepad" text
- [ ] AC-6: Device hint auto-dismisses after 1.5s — disappears instantly (no fade)
- [ ] AC-7: Both alerts and device hint appear instantly and dismiss instantly — no animation or transition

## Implementation Notes

_Derived from UX doc and GDD Dynamic Behaviours:_

1. **Alert queue**: Array of alert objects `{ message: string, timer: number }`. Max length 2. On new alert, push. If length > 2, shift oldest. Each tick, decrement timers. On timer ≤ 0, remove and update display.

2. **Alert text style**: 16px uppercase sans-serif, white (#FFFFFF) text on rgba(0,0,0,0.5) background. Single line per alert.

3. **Device hint**: Subscribe to Input system's `onDeviceChanged` observable. Show hint text for 1.5s, then hide. Hint is a TextBlock with same styling as alerts but positioned at a fixed location (bottom-centre or centre-top, per UX tuning).

4. **No animation** — all visibility changes are instant `isVisible` toggles. No HudAnimator usage.

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 003: HudManager — overlay registration and lifecycle
- Story 011: PitOverlayBlock — separate overlay for pit service UI

## QA Test Cases

_Manual verification steps — written by qa-lead at story creation:_

- **AC-1**: Messages at centre-middle
  - Setup: Trigger PIT READY alert
  - Verify: Alert text position
  - Pass condition: Centre-middle of screen

- **AC-2**: Max 2 alerts, FIFO
  - Setup: Trigger alerts A, B and C rapidly
  - Verify: Visible alerts
  - Pass condition: A and B visible initially; C replaces A when B dismisses (or immediately if 2nd slot is occupied)

- **AC-3**: Auto-dismiss after 2s
  - Setup: Trigger an alert
  - Verify: Alert after 2s
  - Pass condition: Alert disappears instantaneously at 2s mark

- **AC-4**: Message mapping
  - Setup: Trigger each condition per table
  - Verify: Alert text
  - Pass condition: Each condition shows the correct message text

- **AC-5**: Device hint on device change
  - Setup: Simulate device switch (keyboard→gamepad) via Input system
  - Verify: Device hint overlay
  - Pass condition: "Gamepad" text visible

- **AC-6**: Device hint dismisses after 1.5s
  - Setup: Device hint showing
  - Verify: Hint after 1.5s
  - Pass condition: Hint disappears instantaneously

- **AC-7**: No animation
  - Setup: Trigger any alert or hint
  - Verify: Transition is instantaneous
  - Pass condition: No alpha animation, no scale transition — direct isVisible toggle

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/alertBlock-evidence.md` + sign-off
**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 003 (HudManager — overlay registration)
- Unlocks: None directly
