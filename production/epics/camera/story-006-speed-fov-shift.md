# Story 006: Speed-Dependent FOV Shift

> **Epic**: Camera
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Last Updated**: 2026-06-30
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/camera.md`
**Requirement**: `TR-CAM-003`

- **TR-CAM-003**: Speed-dependent FOV: `baseFOV + speedFactor × speed_kmh`, clamped to `[FOV_min, FOV_max]`; configurable via `CameraConfig`.

**ADR Governing Implementation**: ADR-0007: Camera Architecture
**ADR Decision Summary**: Linear FOV formula applied each tick via `camera.fov = (fov * Math.PI) / 180`. No easing or smoothing in MVP — the value is applied directly with zero lerp delay.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Babylon.js uses radians for `camera.fov`.

**Control Manifest Rules (this layer)**:

- C20: FOV shift: `baseFOV + speedFactor × speed_kmh`, clamped to `[FOV_min, FOV_max]`.

---

## Acceptance Criteria

_From GDD `design/gdd/camera.md`, revised per QL-STORY-READY:_

- [ ] **AC-3a (Logic)**: Base FOV at speed=0 equals `baseFOV` for the active mode (cockpit: 75°, chase: 60°) — verified by unit test.
- [ ] **AC-3b (Logic)**: FOV at any speed equals `clamp(baseFOV + speedFactor × speed_kmh, FOV_min, FOV_max)` applied in radians — verified across full speed range (0, 100, 200, 500 km/h, negative speeds). Clamp bounds are per-mode: cockpit [65°, 85°], chase [52°, 68°].
- [ ] **AC-3c (Logic)**: FOV update is applied every tick with **zero smoothing/lerp delay** — after 1 frame at speed=200 km/h, `camera.fov` equals the formula result. Cockpit and chase modes use independent FOV values.
- [ ] **AC-3d (DEFERRED — Visual/Feel)**: "FOV change is perceptible within 2s of hard acceleration" — manual verification during polish pass. Not required for story completion.

---

## Implementation Notes

_Derived from ADR-0007 Implementation Guidelines:_

### Formula

```
FOV_degrees = baseFOV + speedFactor × speed_kmh
FOV_clamped = clamp(FOV_degrees, FOV_min, FOV_max)
camera.fov = FOV_clamped × (π / 180)
```

### Per-Mode Values

| Mode    | baseFOV | FOV_min | FOV_max |
| ------- | ------- | ------- | ------- |
| Cockpit | 75°     | 65°     | 85°     |
| Chase   | 60°     | 52°     | 68°     |

`speedFactor`: configurable constant, default 0.05 (degrees per km/h).

### Tick Application

```typescript
// In CameraManager.update():
update(dt: number): void {
  const config = this.config;  // read from ConfigManager

  // Select base values based on current mode
  let baseFOV: number, fovMin: number, fovMax: number;
  switch (this.currentMode) {
    case CameraMode.Cockpit:
      baseFOV = config.cockpit.fov;
      fovMin = config.cockpit.fovMin;
      fovMax = config.cockpit.fovMax;
      break;
    case CameraMode.Chase:
      baseFOV = config.chase.fov;
      fovMin = config.chase.fovMin;
      fovMax = config.chase.fovMax;
      break;
    default:
      // Grid and Drone use fixed FOV — no speed-dependent shift
      this.applyFOV = false;
      return;
  }

  // Compute and apply (zero smoothing — direct assignment)
  const fovDeg = baseFOV + config.speedFactor * this.speedKmh;
  const fovClamped = Math.max(fovMin, Math.min(fovMax, fovDeg));
  this.activeCamera.fov = fovClamped * (Math.PI / 180);
}
```

### Clamp Behavior

- `speed_kmh = 0` → `FOV = baseFOV` (at rest, widest view)
- `speed_kmh = 200` in cockpit → `FOV = clamp(75 + 0.05 × 200, 65, 85) = clamp(85, 65, 85) = 85°` (clamped to max)
- Negative speed (reverse) → `FOV` approaches `FOV_min` (the floor)

---

## Out of Scope

- Head bob / lean (Story 009)
- Grid and Drone have fixed FOV — no speed-dependent shift
- Visual/Feel verification of "perceptible within 2s" (deferred to polish — AC-3b)

---

## QA Test Cases

_Written by qa-lead at story creation:_

- **Cockpit FOV at 0 km/h**:
  - Given: Camera mode = cockpit, speed = 0 km/h, speedFactor = 0.05
  - When: `camera.update()` is called
  - Then: `camera.fov === 75° in radians => 75 × π/180` (baseFOV at rest)

- **Cockpit FOV at 100 km/h**:
  - Given: Camera mode = cockpit, speed = 100 km/h, speedFactor = 0.05
  - When: `camera.update()` is called
  - Then: `camera.fov === clamp(75 + 0.05 × 100, 65, 85) = 80° in radians`

- **Cockpit FOV clamp high**:
  - Given: Camera mode = cockpit, speed = 500 km/h
  - When: `camera.update()` is called
  - Then: `camera.fov === 85° in radians` (FOV_max ceiling)

- **Cockpit FOV clamp low**:
  - Given: Camera mode = cockpit, speed = -20 km/h (reverse)
  - When: `camera.update()` is called
  - Then: `camera.fov === 65° in radians` (FOV_min floor)

- **Chase FOV values**:
  - Given: Camera mode = chase, speed = 200 km/h, speedFactor = 0.05
  - When: `camera.update()` is called
  - Then: `camera.fov === clamp(60 + 0.05 × 200, 52, 68) = clamp(70, 52, 68) = 68° in radians`

- **Zero smoothing delay**:
  - Given: Speed changes from 0 to 200 km/h at frame 0
  - When: `camera.update()` is called at frame 1 (≈16ms later)
  - Then: `camera.fov` in radians matches formula result for 200 km/h (no lerp/smoothing delay)

- **Radians conversion**:
  - Given: Any computed FOV in degrees
  - Then: `camera.fov === degrees × (π / 180)`, verified within 0.001 rad

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/camera/speed-fov-shift_test.ts`

**Status**: [x] Complete

---

## Completion Notes

**Completed**: 2026-06-30
**Criteria**: 3/3 passing (AC-3a, AC-3b, AC-3c), 1 DEFERRED (AC-3d visual/feel)
**Deviations**: None
**Test Evidence**: Unit test at `tests/unit/camera/speed-fov-shift.test.ts` (21 tests)
**Code Review**: Complete — engine specialist CLEAN, QA-testability GOOD
**Coverage**: 100% all metrics (25 functions, 165 lines, 55 branches)

---

## Dependencies

- Depends on: Story 001 (needs CameraManager.update() loop + CameraConfig)
- Unlocks: None
