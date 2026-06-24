# Story 002: GSM-Driven Camera Lifecycle

> **Epic**: Camera
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/camera.md`
**Requirement**: `TR-CAM-007`

- **TR-CAM-007**: GSM event subscription — Grid camera on `state.entered(PreRace/Grid)`, switch camera on `state.entered(Racing)`, Drone on `state.entered(PostRace)`.

**ADR Governing Implementation**: ADR-0007: Camera Architecture
**ADR Decision Summary**: Camera subscribes to `gsm.state.entered` and `gsm.state.exited` via Event Bus. Transitions between camera modes based on the incoming GSM state. Never calls `gsm.transition()` — purely reactive.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW

**Control Manifest Rules (this layer)**:

- C18: Camera reactive to `gsm.state.entered` only — never initiates GSM transitions.
- C-F7: Never make Camera initiate GSM transitions.

---

## Acceptance Criteria

_From GDD `design/gdd/camera.md`, scoped to this story:_

- [ ] **AC-7 (revised)**: For any grid of N cars (2 ≤ N ≤ 26), the grid camera is positioned at `(trackCenter.x, 30m, trackCenter.z - 40m)` and the look-at target is computed as the midpoint between the first and last car — all car world positions project into the camera's visible frustum (verified by clip-space projection).
- [ ] **AC-8**: PreRace grid camera is active until GSM transitions to Racing (via auto-skip or confirm). "Active" means `scene.activeCamera === gridCamera` instance.
- [ ] **Transition sequence**: Camera mode follows `Inactive → Grid → Cockpit/Chase → Drone → Inactive` as GSM enters PreRace → Racing → PostRace → Menu/Loading.
- [ ] **Never calls gsm.transition()**: A spy on `gsm.transition()` confirms it is never called during any camera lifecycle operation.
- [ ] **Racing preserves toggle choice**: On `gsm.state.entered(Racing)`, the camera restores the player's last toggle choice (cockpit or chase), falling back to cockpit on first entry.

---

## Implementation Notes

_Derived from ADR-0007 Implementation Guidelines:_

### State Machine

```
Inactive ←── Menu/Loading
    │
    ▼
Grid ───────── PreRace (entered)
    │
    ▼
Cockpit/Chase ─ Racing (entered)
    │
    ▼
Drone ──────── PostRace (entered)
```

### Event Bus Subscription

```typescript
// In CameraManager.init():
eventBus.on("gsm.state.entered", (event: { from: string; to: string }) => {
  switch (event.to) {
    case "PreRace":
      this.setActiveMode(CameraMode.Grid);
      break;
    case "Racing":
      // Restore last toggle choice, default to Cockpit
      this.setActiveMode(this.lastToggleChoice ?? CameraMode.Cockpit);
      break;
    case "PostRace":
      this.setActiveMode(CameraMode.Drone);
      break;
    case "Menu":
    case "Loading":
      this.setActiveMode(CameraMode.Inactive);
      break;
  }
});
```

### Grid Camera Setup

```typescript
// Grid camera: static FreeCamera positioned above and ahead of the grid
// Position: 30m above track centerline, 40m ahead of grid
// Look-at: midpoint between first and last car on grid
const gridCam = new FreeCamera(
  "gridCam",
  new Vector3(trackCenter.x, 30, trackCenter.z - 40),
  scene
);

// Compute look-at target to frame all cars:
// Get first car and last car world positions
// Target = midpoint: (firstCarPos + lastCarPos) / 2
// Camera always looks back toward the grid from ahead
gridCam.setTarget(midpoint);

// FOV = 70° for grid framing
gridCam.fov = (70 * Math.PI) / 180;
```

Grid camera FOV is fixed at 70° — no speed-dependent FOV in PreRace.

### Toggle Choice Persistence

```typescript
// Stored in-memory within CameraManager
private lastToggleChoice: CameraMode.Cockpit | CameraMode.Chase | null = null;

// Updated on each toggle:
toggleCockpitChase(): void {
  // ... switch logic ...
  this.lastToggleChoice = this.currentMode;
}

// Restored on Racing entry:
case "Racing":
  const targetMode = this.lastToggleChoice ?? CameraMode.Cockpit;
  this.setActiveMode(targetMode);
  break;
```

The preference is in-memory only (not persisted to disk). It survives race restarts within a session (PreRace → Racing → PostRace → Race Again → PreRace → Racing).

---

## Out of Scope

- Camera creation and camera types (Story 001)
- Cockpit/chase toggle mechanics (Story 005)
- Drone auto-orbit behavior (Story 008)

---

## QA Test Cases

_Written by qa-lead at story creation:_

- **AC-7** (grid framing):
  - Given: A scene with 4 cars positioned on a starting grid at known positions, track centerline at (0, 0, 0)
  - When: GSM enters PreRace state and `camera.init()` has been called
  - Then: `scene.activeCamera` is a FreeCamera at position (0, 30, -40) relative to track centerline; all car world positions project into the camera's clip space (frustum contains all car positions)
  - Edge: 2-car grid (minimum), 26-car grid (maximum), single-seat empty grid → handle gracefully

- **AC-8** (Grid until Racing):
  - Given: GSM in PreRace, grid camera active
  - When: `gsm.state.entered(Racing)` fires
  - Then: `scene.activeCamera` switches to Racing mode camera (cockpit or chase)
  - Edge: Auto-skip vs confirm-triggered transition — same behavior

- **Transition sequence**:
  - Given: Initial state Inactive
  - When: Entering each GSM state in sequence: Menu → PreRace → Racing → PostRace → Menu
  - Then: Camera mode follows: Inactive → Grid → Cockpit/Chase → Drone → Inactive
  - Edge: Loading state → Inactive (camera inactive, no crash)

- **Never calls gsm.transition()**:
  - Given: Spy on `gsm.transition()`
  - When: Camera processes all GSM state transitions (PreRace → Racing → PostRace → Menu)
  - Then: `gsm.transition.callCount === 0`

- **Toggle persistence**:
  - Given: Player toggled to chase in previous Racing segment
  - When: GSM transitions PreRace → Racing
  - Then: `scene.activeCamera === chaseCam`
  - Edge: First race entry (no prior toggle) → `scene.activeCamera === cockpitCam`

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/camera/gsm-camera-lifecycle_test.ts`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (needs CameraManager + camera instances), GSM (Foundation layer — Event Bus events)
- Unlocks: Story 008 (drone lifecycle)
