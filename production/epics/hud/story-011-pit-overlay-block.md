# Story 011: PitOverlayBlock

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/hud.md`
**Requirement**: `TR-HUD-005` — HUD lifecycle tied to GSM: activate on Racing entry, deactivate on PostRace. PitOverlay replaces HUD on pit.status.

**ADR Governing Implementation**: ADR-0018: HUD Layout & Blocks
**ADR Decision Summary**: Pit overlay uses same single ADT — no separate render target. All pit controls created at init alongside race controls. Visibility groups toggle between race blocks and pit blocks on `pit.status` transitions. Pit overlay is a centred panel (30% dark background) over the race HUD. Race HUD remains visible behind it.

**Engine**: Babylon.js 9.12.0 | **Risk**: MEDIUM
**Engine Notes**: Rectangle for panel background. TextBlock for labels. ScaleX animation on refuel bar Rectangle. Ellipse for tire status icons. Standard Babylon.js GUI controls.

**Control Manifest Rules (this layer)**:

- Required: P3 (create-once toggle-visibility)
- Forbidden: P-F5 (never destroy/recreate controls), P-F7 (never attach blocks directly to ADT)
- Guardrail: P-G1 (HUD < 0.3ms GPU per frame)

## Acceptance Criteria

_From GDD PitOverlayBlock section — using GDD canonical state values:_

- [ ] AC-1: Pit overlay activates when `pit.status` transitions to `pitStopped` — race blocks hidden, pit blocks shown
- [ ] AC-2: Pit overlay is a centred semi-transparent panel (rgba(0,0,0,0.3), ~30% screen width) over the race HUD
- [ ] AC-3: Refuel progress bar fills from 0% to 100% (smooth animation — only non-mechanical exception). Bar is a Rectangle with `scaleX` driven by HudAnimator SMOOTH style.
- [ ] AC-4: Tire change: 4 tire icons in square layout (top-left, top-right, bottom-left, bottom-right). Each icon gets a check mark (✔ Unicode character) when corresponding tire is done.
- [ ] AC-5: Speed indicator shows "80 km/h" (pit limiter active) — not player's actual speed
- [ ] AC-6: Exit prompt "Press [confirm]" appears after tire change is complete AND refuel is in progress (not yet complete)
- [ ] AC-7: Pit overlay deactivates when `pit.status` transitions to `onTrack` — race blocks restored, pit blocks hidden
- [ ] AC-8: Visibility toggle is atomic — all pit blocks made visible before any race blocks hidden (no frame flash of empty HUD)

## Implementation Notes

_Derived from ADR-0018 Implementation Guidelines:_

1. **State values**: Use GDD canonical values from the Pit Stop system:
   - `pit.status = 'pitStopped'` → activate pit overlay, hide race blocks
   - `pit.status = 'onTrack'` → hide pit overlay, restore race blocks
   - Payload: `pit.status: { carId: string, state: 'onTrack' | 'pitEntry' | 'pitStopped' | 'departing' }`

2. **Visibility toggle order**: To prevent frame flash:

   ```
   function onPitEnter():
     // 1. Make all pit controls visible with correct state
     pitPanel.isVisible = true
     refuelBar.scaleX = currentFuelLevel / maxFuel  // restore current fill
     // 2. Then hide race blocks
     raceBlocks.forEach(b => b.container.isVisible = false)
   ```

   Reverse order on pit exit: show race blocks first, then hide pit panel.

3. **Refuel bar**: Rectangle child with `horizontalAlignment = LEFT`. `scaleX` animated via HudAnimator SMOOTH style as fuel progresses. `pit.fuel_status: { carId, fuelPercent: number }` drives the target.

4. **Tire icons**: 4 Ellipse controls arranged in a 2×2 grid (positioned via `left`/`top`). Initially grey empty circles. On `pit.tire_status: { tireIndex: 0-3, status: 'done' }`, fill green and add check mark text.

5. **Exit prompt**: TextBlock "Press [confirm]" with pulsing effect. Only visible when all tires done AND refuelPercent < 100 (fuel still pumping). Input mapping: Space (keyboard) / A (gamepad) — defined by Input system, HUD just shows "confirm" label.

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 003: HudManager — pit lifecycle hook integration
- Story 002: HudConfig — pit block visibility config (always on in Phase 1)

## QA Test Cases

_Manual verification steps — written by qa-lead at story creation:_

- **AC-1**: Pit overlay activates on pitStopped
  - Setup: Race in progress, emit `pit.status` with `{ carId: playerCarId, state: 'pitStopped' }`
  - Verify: Pit panel visible, race blocks hidden
  - Pass condition: Pit UI visible, speed/lap/position blocks behind (isVisible=false)

- **AC-2**: Centred panel
  - Setup: Pit overlay active
  - Verify: Panel position and size
  - Pass condition: Centred, ~30% screen width, semi-transparent dark background

- **AC-3**: Refuel bar smooth fill
  - Setup: Pit active, emit `pit.fuel_status` with increasing values
  - Verify: Refuel bar fill width
  - Pass condition: Bar fills smoothly, progress matches fuel_status percentage

- **AC-4**: Tire icons with check marks
  - Setup: Pit active, emit `pit.tire_status` for each tire
  - Verify: Each tire icon state
  - Pass condition: Each tire shows ✔ as its status = 'done'

- **AC-6**: Exit prompt timing
  - Setup: All tires done, refuel at 50% (still filling)
  - Verify: Exit prompt visibility
  - Pass condition: "Press [confirm]" visible
  - When: Refuel reaches 100%
  - Then: Prompt remains visible (fuel done, driver confirms to exit)

- **AC-7**: Deactivates on onTrack
  - Setup: Pit active, emit `pit.status` with `{ state: 'onTrack' }`
  - Verify: Race blocks restored, pit blocks hidden
  - Pass condition: Speed/lap/position visible, pit panel gone

- **AC-8**: No frame flash
  - Setup: Toggle pit overlay on and off
  - Verify: Screen during transitions
  - Pass condition: No empty or corrupted HUD frame visible between states

## Test Evidence

**Story Type**: UI
**Required evidence**: `production/qa/evidence/pitOverlayBlock-evidence.md` + sign-off
**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (HudAnimator — SMOOTH refuel bar fill), Story 003 (HudManager — registration)
- Unlocks: None directly
