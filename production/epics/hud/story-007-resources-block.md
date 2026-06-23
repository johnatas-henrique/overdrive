# Story 007: ResourcesBlock

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/hud.md`
**Requirement**: `TR-HUD-004` — ResourcesBlock throttled to ~6 updates/s (every 10 ticks). Critical fuel ≤15% pulses red, tire ≤20% pulses red.

**ADR Governing Implementation**: ADR-0018: HUD Layout & Blocks
**ADR Decision Summary**: ResourcesBlock stacks FuelBar (top) + TireBar (bottom) in a right-zone container. Throttled updates via Event Bus (every 10 ticks ~6Hz). Critical state pulsing via HudAnimator (toggle between normal and red color at 0.5s interval).

**Engine**: Babylon.js 9.12.0 | **Risk**: MEDIUM
**Engine Notes**: Rectangle controls for bar backgrounds and fill. TextBlock for percentage text. HudAnimator does not support color interpolation — pulsing is implemented as instant color toggle between two values at 0.5s intervals.

**Control Manifest Rules (this layer)**:

- Required: P3 (create-once toggle-visibility), P6 (event-driven for all blocks)
- Forbidden: P-F4 (never use HTML/CSS for HUD)
- Guardrail: P-G1 (HUD < 0.3ms GPU per frame)

## Acceptance Criteria

_From GDD ResourcesBlock section:_

- [ ] AC-1: Fuel bar displays correct fuel level (0–100%) in blue (#00BFFF)
- [ ] AC-2: Tire bar displays correct tire condition (0–100%) in cyan (#00E5FF)
- [ ] AC-3: Icons replace text labels: ⛽ for fuel, ⚙ for tire — displayed as TextBlock content
- [ ] AC-4: Percentage text (e.g., "64%") centered on each bar
- [ ] AC-5: Updates at throttled rate (every 10 ticks, ~6Hz) — driven by Event Bus events from Fuel and Tire Wear systems
- [ ] AC-6: Fuel bar pulses when fuel ≤ 15%: toggles between #00BFFF and #FF0000 at 0.5s interval via HudAnimator (MECHANICAL toggle style)
- [ ] AC-7: Tire bar pulses when tire ≤ 20%: toggles between #00E5FF and #FF0000 at 0.5s interval via HudAnimator
- [ ] AC-8: Bars do not pulse when above critical thresholds — stable color
- [ ] AC-9: Bar width fills proportionally to level: 0% = empty (no fill), 100% = full fill. Bar fill is a Rectangle scaled via `scaleX`.

## Implementation Notes

_Derived from ADR-0018 Implementation Guidelines:_

1. **Bar structure**: Each bar is a container with:
   - Background Rectangle (colour, full size of zone)
   - Fill Rectangle (same colour, `scaleX = level/100`, `horizontalAlignment = LEFT`)
   - Percentage TextBlock (centred over the fill)
   - Icon TextBlock (⛽ or ⚙, positioned left of or inside the bar)

2. **Throttled updates**: Resource bar events come at ~6Hz (every 10 ticks). HUD renders each event as it arrives. Do NOT poll `playerCar.runtime.fuelLevel` — this violates the event-driven ADR.

3. **Pulsing mechanism**: HudAnimator does NOT interpolate colours. Pulse is a mechanical toggle:
   - Start HudAnimator with MECHANICAL style, duration=500ms (half the 0.5s interval... actually 0.5s = 500ms per colour, so one full toggle cycle = 1s)
   - When toggle fires, swap fill colour between normal and #FF0000
   - Use a two-tween sequence: tween A (500ms, snap to red) → tween B (500ms, snap to normal → repeat)
   - Alternatively, use `setInterval`-style tick counting in `update()` for the toggle, since HudAnimator's MECHANICAL style is single-shot, not looping.
   - **Recommendation**: Simple approach — maintain a `pulseTimer` tick counter in ResourcesBlock. When critical, increment `pulseCounter` each tick. At `pulseCounter % 30 === 0` (30 ticks = 0.5s at 60fps), toggle colour. This avoids looping HudAnimator tweens.

4. **Fill scaling**: `fillRect.scaleX = level / 100`. The fill Rectangle has `clipContent = true` and its parent clips overflow. When level=0, scaleX=0 (invisible). When level=100, scaleX=1 (full width).

5. **Bar dimensions**: ~92% of zone container width, ~40% of zone height per bar with ~10% gap between them.

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 004: SpeedBlock (separate block)
- Story 005: LapBlock (separate block)

## QA Test Cases

_Manual verification steps — written by qa-lead at story creation:_

- **AC-1**: Fuel bar colour
  - Setup: Fuel level = 64%, emit fuel update event
  - Verify: Fuel fill Rectangle colour
  - Pass condition: #00BFFF (blue)

- **AC-2**: Tire bar colour
  - Setup: Tire condition = 82%, emit tire update event
  - Verify: Tire fill Rectangle colour
  - Pass condition: #00E5FF (cyan)

- **AC-3**: Icons displayed
  - Setup: Inspect resource area
  - Verify: TextBlock content for icons
  - Pass condition: ⛽ visible for fuel, ⚙ visible for tire

- **AC-4**: Percentage centred
  - Setup: Arbitrary fuel/tire level
  - Verify: Percentage text position on bar
  - Pass condition: Centred vertically and horizontally on each bar

- **AC-6**: Fuel pulses at ≤15%
  - Setup: Fuel = 15%, then 10%, then 5%
  - Verify: Fuel bar colour over 2 seconds
  - Pass condition: Toggles between #00BFFF and #FF0000 at ~0.5s intervals

- **AC-7**: Tire pulses at ≤20%
  - Setup: Tire = 20%, then 15%
  - Verify: Tire bar colour over 2 seconds
  - Pass condition: Toggles between #00E5FF and #FF0000 at ~0.5s intervals

- **AC-8**: No pulse above thresholds
  - Setup: Fuel = 16%, Tire = 21%
  - Verify: Both bars for 2 seconds
  - Pass condition: Stable colour, no toggling

- **AC-9**: Bar fill proportional
  - Setup: Fuel level = 50%
  - Verify: fill Rectangle scaleX
  - Pass condition: `scaleX ≈ 0.50`

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/resourcesBlock-evidence.md` + sign-off
**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (HudAnimator — pulsing toggle), Story 003 (HudManager — registration)
- Unlocks: None directly
