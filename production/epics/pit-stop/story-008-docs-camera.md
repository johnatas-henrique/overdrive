# Story 008: Pit Stop Documentation & Visual Verification

> **Epic**: Pit Stop
> **Status**: Ready
> **Layer**: Core
> **Type**: Config/Data + Visual/Feel
> **Manifest Version**: 2026-06-21
> **Estimate**: 3h

## Context

**GDD**: `design/gdd/pit-stop.md`
**Requirement**: None (documentation updates + visual verification)
_(Updates to Fuel and Tire Wear GDDs to reflect that Phase 1 pit stops DO include refuel and tire change — reversing placeholder references from earlier drafts.)_

**ADR Governing Implementation**: ADR-0014: Pit Stop Flow
**ADR Decision Summary**: Pit Stop is a Core layer system with engine risk LOW (no Babylon APIs). Camera is explicitly noted as unchanged during pit cycle (GDD §System Interactions: Camera).

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: No code changes — documentation edits and visual verification.

**Control Manifest Rules (this layer)**:

- Required: C18 — Camera reactive to `gsm.state.entered` only — never initiates GSM transitions
- Required: C20 — FOV shift: `baseFOV + speedFactor × speed_kmh`, clamped to `[FOV_min, FOV_max]`

---

## Acceptance Criteria

_From GDD `design/gdd/pit-stop.md`, scoped to this story:_

- [ ] **AC-1**: Fuel system GDD — remove "no refuel during pit" references. Phase 1 now has refuel during pit.
- [ ] **AC-2**: Tire Wear GDD — remove "no tire change in pit" references. Phase 1 now has tire change during pit.
- [ ] **AC-3**: Camera position and FOV remain unchanged during pit cycle — verify in both cockpit and chase camera modes.

---

## Implementation Notes

### Fuel GDD Updates

1. Open `design/gdd/fuel.md`
2. Search for: "no pit refuel" or "refuel not available in Phase 1" or similar placeholder text
3. Replace with: "Refuel is available during pit stops (`pitStopped` state). Pit Stop calls `addFuel(carId, amount)` each tick at `pit.refuelRate`. See pit-stop.md for details."
4. Verify: any section headers or edge cases that reference "no pit refuel" are updated

### Tire Wear GDD Updates

1. Open `design/gdd/tire-wear.md`
2. Search for: "no tire change in pit" or "tire compound not changeable" or similar placeholder text
3. Replace with: "Tire change is available during pit stops (`pitStopped` state). Pit Stop calls `resetTires(carId)` after `pit.tireChangeDelay`. See pit-stop.md for details."
4. Verify: any references to tire wear being permanent are updated to reflect resets

### Camera Verification

1. Enter pit lane in both cockpit and chase camera modes
2. Record FOV value before pit entry and during `pitEntry`, `pitStopped`, `departing` states
3. Confirm FOV changes only due to the normal speed-dependent FOV shift (C20)
4. Confirm camera mode does not switch during pit cycle
5. Capture screenshot/video as evidence

---

## Out of Scope

_No code changes — this story is documentation and verification only._

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these._

- **AC-1**: Fuel GDD updated
  - Setup: Open `design/gdd/fuel.md`
  - Verify: No references to "no refuel during pit" or similar placeholder text; pit refuel behavior is documented
  - Pass condition: All stale references replaced with accurate Phase 1 descriptions

- **AC-2**: Tire Wear GDD updated
  - Setup: Open `design/gdd/tire-wear.md`
  - Verify: No references to "no tire change in pit" or similar placeholder text; pit tire change behavior is documented
  - Pass condition: All stale references replaced with accurate Phase 1 descriptions

- **AC-3**: Camera unchanged during pit cycle
  - Setup: Start a race, approach pit entry zone in cockpit mode
  - Verify: FOV during pit states matches normal speed-dependent FOV (C20 formula); camera does not switch mode during any pit state
  - Pass condition: FOV difference between "racing at 80 km/h on track" and "pit entry at 80 km/h" is within normal tolerance; repeat verification in chase mode
  - Edge cases: Pit entry at high speed (300→80 km/h deceleration) — FOV changes due to speed delta, not pit state; camera shake from collision (C17) still applies

---

## Test Evidence

**Story Type**: Config/Data + Visual/Feel
**Required evidence**:

- GDD diffs for fuel.md and tire-wear.md (Config/Data)
- `production/qa/evidence/pit-docs-camera-evidence.md` + screenshot/video (Visual/Feel)
  **Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (state machine — pit states must be functional to verify camera behavior)
- Unlocks: None
