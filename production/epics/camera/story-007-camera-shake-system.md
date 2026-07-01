# Story 007: Camera Shake System

> **Epic**: Camera
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Last Updated**: 2026-06-30
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/camera.md`
**Requirement**: `TR-CAM-004`

- **TR-CAM-004**: Camera shake — additive, per-event with own intensity and exponential decay rate; accumulates from `collision.impact`, kerb strike, off-track rumble.

**ADR Governing Implementation**: ADR-0007: Camera Architecture
**ADR Decision Summary**: ActiveShake array with per-frame exponential decay and 5% removal threshold. Shake offset applied to a `TransformNode` between the camera and its parent. Random direction per frame. Shake is additive (multiple shakes stack independently). Player car only.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW

**Control Manifest Rules (this layer)**:

- C-F7: Never initiate GSM transitions.

---

## Acceptance Criteria

_From GDD `design/gdd/camera.md`, scoped to this story:_

- [ ] **AC-4**: Running over a kerb triggers a brief camera shake (< 1s, decays exponentially). At default values (intensity=0.03, decay=6.0/s), shake intensity drops below 5% threshold within ~0.5s.
- [ ] **AC-5**: Collision triggers camera shake proportional to impact impulse, player car only. For impulse=1000, initial shake intensity = 1000 × 0.001 (collisionFactor default). Non-player car collisions produce zero shake.
- [ ] **AC-6**: Driving off-track triggers brief shake with configurable intensity (default 0.02) and decay rate (default 5.0/s), removed when below 5% of initial (~0.6s).
- [ ] **Additive stacking**: Multiple simultaneous shakes stack additively and decay independently.

---

## Implementation Notes

_Derived from ADR-0007 Implementation Guidelines:_

### Types

```typescript
type ShakeType = "kerb" | "collision" | "offTrack";

interface ActiveShake {
  intensity: number; // current magnitude at time of creation
  decay: number; // per-second decay rate
  time: number; // elapsed time since shake started
}

interface ShakeConfig {
  kerbIntensity: number; // default 0.03
  kerbDecay: number; // default 6.0
  collisionFactor: number; // default 0.001
  collisionDecay: number; // default 4.0
  offtrackIntensity: number; // default 0.02
  offtrackDecay: number; // default 5.0
}
```

### Shake Execution

```typescript
// Active shakes array
private activeShakes: ActiveShake[] = [];

// Add a new shake (called from event handlers)
addShake(type: ShakeType, intensity: number): void {
  const config = this.config.shake;
  let decay: number;

  switch (type) {
    case "kerb":
      decay = config.kerbDecay;
      break;
    case "collision":
      decay = config.collisionDecay;
      break;
    case "offTrack":
      decay = config.offtrackDecay;
      break;
  }

  this.activeShakes.push({ intensity, decay, time: 0 });
}

// Each tick in CameraManager.update():
updateShake(dt: number): void {
  let totalOffset = Vector3.Zero();

  for (let i = this.activeShakes.length - 1; i >= 0; i--) {
    const shake = this.activeShakes[i];
    const current = shake.intensity * Math.exp(-shake.decay * shake.time);

    // Random direction per frame
    totalOffset.addInPlace(new Vector3(
      (Math.random() - 0.5) * current * 2,
      (Math.random() - 0.5) * current * 2,
      (Math.random() - 0.5) * current * 2
    ));

    shake.time += dt;

    // Remove when decayed to < 5% of original intensity
    if (current < shake.intensity * 0.05) {
      this.activeShakes.splice(i, 1);
    }
  }

  // Apply to shake TransformNode local position
  if (this.shakeNode) {
    this.shakeNode.position = totalOffset;
  }
}
```

### Shake Sources

| Source    | How triggered                                                                              | Default values                            |
| --------- | ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Kerb hit  | `physics.kerbHit === true` → `addShake("kerb", config.shake.kerbIntensity)`                | intensity=0.03, decay=6.0 → ~0.5s         |
| Collision | `collision.impact` event → `addShake("collision", impulse × config.shake.collisionFactor)` | factor=0.001, decay=4.0 → ~0.75s @ i=1000 |
| Off-track | `physics.offTrack === true` → `addShake("offTrack", config.shake.offtrackIntensity)`       | intensity=0.02, decay=5.0 → ~0.6s         |

### Player-Only Filtering

Collision events include `carId`. Only shake for `carId === playerCarId`:

```typescript
// In collision event handler:
handleCollision(event: CollisionImpactEvent): void {
  if (event.carId !== this.playerCarId) return; // Non-player: no shake
  const intensity = event.impulse * this.config.shake.collisionFactor;
  this.addShake("collision", intensity);
}
```

### Hierarchy

Shake is applied to the shake TransformNode — never affects car physics. Physics determinism is preserved.

```
Car mesh (physics body)
  └── driver_eye (TransformNode)
       └── shakeNode (TransformNode)  ← shake offset applied here
            └── camera (FreeCamera/FollowCamera)
```

### Default Values Reference

| Shake Type | Default Intensity | Default Decay | Duration (to <5%) |
| ---------- | ----------------- | ------------- | ----------------- |
| Kerb hit   | 0.03 units        | 6.0/s         | ~0.5s             |
| Collision  | impulse × 0.001   | 4.0/s         | ~0.75s @ i=1000   |
| Off-track  | 0.02 units        | 5.0/s         | ~0.6s             |

---

## Out of Scope

- Head bob and lateral lean (Story 009) — also applied to shakeNode but conceptually different
- Collision event emission (handled by Collision system — Story not yet created)
- Physics telemetry for kerb/offTrack detection (handled by Physics/Handling)

---

## QA Test Cases

_Written by qa-lead at story creation:_

- **AC-4** (kerb shake):
  - Given: Shake system initialized, seed set to predictable value
  - When: `triggerShake("kerb")` is called (intensity=0.03, decay=6.0)
  - Then: At t=0, offset magnitude ≈ 0.03; at t=0.5s, offset magnitude ≈ 0.03 × e^(-6.0 × 0.5) ≈ 0.00149 (below 5% threshold → removed); verify offset returns to zero after t > 0.6s

- **AC-5** (collision shake):
  - Given: `collision.impact` = 1000, collisionFactor = 0.001, player carId matches
  - When: `handleCollision({carId: playerId, impact: 1000})`
  - Then: Shake initial intensity = 1000 × 0.001 = 1.0 unit

- **AC-5** (player only):
  - Given: Non-player carId collides with impact = 5000
  - When: `handleCollision({carId: rivalId, impact: 5000})`
  - Then: No shake is added (activeShakes array unchanged)

- **AC-6** (offtrack shake):
  - Given: offTrackIntensity = 0.02, offTrackDecay = 5.0
  - When: `triggerShake("offTrack")`
  - Then: Initial intensity = 0.02; verify removed after t > (-ln(0.05) / 5.0) ≈ 0.6s

- **Additive stacking**:
  - Given: No active shakes
  - When: Kerb shake (0.03) and collision shake (1.0) triggered simultaneously
  - Then: Total offset at t=0 ≈ 0.03 + 1.0 = 1.03 directional magnitude (within seeding tolerance)

- **Independent decay**:
  - Given: Kerb shake (decay 6.0) and collision shake (decay 4.0) start at t=0
  - When: Evaluated at t=0.5s
  - Then: Each shake decays independently (evaluate each formula separately; total = sum)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/camera/camera-shake-system.test.ts`

**Status**: [x] Complete

---

## Completion Notes

**Completed**: 2026-06-30
**Criteria**: 4/4 passing (AC-4, AC-5, AC-6, additive stacking)
**Deviations**: None
**Test Evidence**: Unit test at `tests/unit/camera/camera-shake-system.test.ts` (29 tests)
**Code Review**: Complete — engine specialist CLEAN, QA-testability GOOD
**Coverage**: 100% all metrics (26 functions, 187 lines, 62 branches)
**Stale test fix**: Updated camera-foundation.test.ts ShakeConfig references to new per-type structure

---

## Dependencies

- Depends on: Story 001 (needs CameraManager.update() loop + shake TransformNode created in Story 003)
- Unlocks: None
