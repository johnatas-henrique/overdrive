# Story 009: Head Bob + Lateral Lean

> **Epic**: Camera
> **Status**: Ready
> **Layer**: Core
> **Type**: Visual/Feel
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/camera.md`
**Requirement**: `TR-CAM-009`

- **TR-CAM-009**: Head bob and lateral lean in cockpit mode (cosmetic only, zero gameplay impact) — derived from lateralG and kerbHit telemetry.

**ADR Governing Implementation**: ADR-0007: Camera Architecture
**ADR Decision Summary**: Head bob and lateral lean applied to the shake TransformNode (child of `driver_eye`, parent of camera). Zero impact on car position or physics determinism because the TransformNode is a leaf in the hierarchy — changes never propagate up to the car.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW

**Control Manifest Rules (this layer)**:

- C-F7: Never initiate GSM transitions.

---

## Acceptance Criteria

_From GDD `design/gdd/camera.md`, scoped to this story:_

- [ ] **AC-13**: Head bob and lateral lean are active in cockpit mode, configurable to zero. With `headBob.intensity=0` and `lean.intensity=0`, no oscillation or roll is produced.
- [ ] **AC-16**: Head bob and lean are purely cosmetic — zero impact on car position, physics determinism is preserved.
- [ ] **AC-16a**: With a deterministic physics replay, running identical inputs with `headBob.intensity=0.1` vs `0.0` produces identical car telemetry at frame N.

---

## Implementation Notes

_Derived from ADR-0007 Implementation Guidelines:_

### Hierarchy

```
Car mesh (physics body)
  └── driver_eye (TransformNode)
       └── shakeNode (TransformNode)  ← head bob + lean applied here
            └── camera (FreeCamera)
```

The `shakeNode` is a child of `driver_eye`. Any transform applied to `shakeNode` is local — it never propagates upward to `driver_eye` or the car mesh. Physics determinism is preserved.

### Head Bob

```typescript
// Vertical oscillation from acceleration/braking
// intensity: config knob (default 0.02 units)
// frequency: config knob (default 2.0 Hz)

const bobOffset =
  Math.sin(this.elapsed * config.headBob.frequency * 2 * Math.PI) *
  config.headBob.intensity;
this.shakeNode.position.y = bobOffset;
```

### Lateral Lean

```typescript
// Roll into corners from lateral G
// intensity: config knob (default 2.0 degrees)

const leanAngle = this.lateralG * config.lean.intensity * (Math.PI / 180);
this.shakeNode.rotation.z = leanAngle; // roll around Z in local space
```

### Config Zero Check

```typescript
// Both effects gracefully degrade to identity when intensity is 0:
// headBob.intensity = 0  → bobOffset = 0  → no vertical oscillation
// lean.intensity = 0     → leanAngle = 0  → no roll rotation
```

### Combining with Shake (Story 007)

The shake node accumulates both bob/lean AND shake offset:

```typescript
// In CameraManager.update():
update(dt: number): void {
  if (this.currentMode !== CameraMode.Cockpit) return;

  // 1. Head bob
  if (config.headBob.intensity > 0) {
    const bob = Math.sin(this.elapsed * config.headBob.frequency * 2 * Math.PI) * config.headBob.intensity;
    this.shakeNode.position.y = bob;
  }

  // 2. Lateral lean
  if (config.lean.intensity > 0) {
    this.shakeNode.rotation.z = this.lateralG * config.lean.intensity * (Math.PI / 180);
  }

  // 3. Shake offset (additive — from Story 007)
  this.shakeNode.position.addInPlace(this.currentShakeOffset);
}
```

### Default Tuning

| Knob                | Default | Range | Description                      |
| ------------------- | ------- | ----- | -------------------------------- |
| `headBob.intensity` | 0.02    | 0–0.1 | Head bob amplitude (units)       |
| `headBob.frequency` | 2.0     | 0–5   | Head bob oscillation frequency   |
| `lean.intensity`    | 2.0     | 0–10  | Lateral lean amplitude (degrees) |

---

## Out of Scope

- Camera shake (Story 007) — separate system, also applies to shakeNode
- Speed-dependent FOV (Story 006)
- Chase camera effects
- Grid/Drone camera effects (cockpit only)

---

## QA Test Cases

_Written by qa-lead at story creation:_

### Automated Sub-Tests

- **AC-13** (active at nonzero):
  - Given: Cockpit mode, `headBob.intensity=0.1` (max), `lean.intensity=10` (max)
  - When: `camera.update()` is called with `lateralG=1.0`, `accelG=0.5`
  - Then: Shake TransformNode has: vertical oscillation ≠ 0, roll rotation ≠ 0; offset values are within configured ranges (bob ≤ 0.1 units, lean ≤ 10°)

- **AC-13** (zero config):
  - Given: Same setup, `headBob.intensity=0`, `lean.intensity=0`
  - Then: Shake TransformNode `localPosition.y === 0`, `localRotation.z === 0` (no oscillation)

- **AC-16a** (determinism):
  - Given: Deterministic replay with car telemetry recorded (sample N frames)
  - When: Replay is run twice — once with bob/lean at max, once at zero
  - Then: Car's world position at each frame is identical between runs (within physics epsilon)
  - Edge: Camera transform differs between runs (bob/lean only affects camera, not car)

### Manual Verification Steps

| Setup                                  | Action                                                         | Verify                                                                             | Pass Condition                                            |
| -------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Full game build with cockpit car model | Launch race, drive at moderate speed on a straight             | Vertical oscillation on the cockpit view (subtle up/down on acceleration lift)     | Oscillation is visible but subtle (< 0.02 units apparent) |
| Same                                   | Steer into a corner at speed                                   | Camera tilts into the corner (positive roll on right turn)                         | Lean is visible but subtle (< 2°)                         |
| Same, with ConfigManager open          | Set `headBob.intensity=0` and `lean.intensity=0` while driving | Oscillation and lean immediately stop                                              | Effect stops within 1s of config change                   |
| Same                                   | Drive over a kerb, collide with wall, drive off-track          | Each trigger produces distinct shake feel (kerb: sharp brief; collision: stronger) | Effects are distinguishable                               |

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**: `production/qa/evidence/camera-head-bob-lean-evidence.md` + sign-off from playtest

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (needs cockpit camera + shake TransformNode hierarchy)
- Unlocks: None
