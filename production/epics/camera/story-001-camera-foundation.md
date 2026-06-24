# Story 001: Camera Foundation

> **Epic**: Camera
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/camera.md`
**Requirements**: `TR-CAM-001`, `TR-CAM-008`

- **TR-CAM-001**: Three camera modes: Grid (FreeCamera), Racing (cockpit/chase toggle via FollowCamera/FreeCamera), Drone (ArcRotateCamera).
- **TR-CAM-008**: Built-in gamepad input on camera types (v9.8 Camera Input Mapping System) explicitly disabled via `camera.inputs.clear()`.

**ADR Governing Implementation**: ADR-0007: Camera Architecture
**ADR Decision Summary**: Three camera types (FreeCamera, FollowCamera, ArcRotateCamera). All cameras disable built-in input via `camera.inputs.clear()`, set `inertia = 0`, and never call `attachControl()`. CameraManager owns switching via `scene.activeCamera`.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Camera Input Mapping System (v9.8) disabled via `camera.inputs.clear()`. ArcRotateCamera requires extra cleanup: `(drone as any).movement.input.inputMap.length = 0`.

**Control Manifest Rules (this layer)**:

- C17: `camera.inputs.clear()` — disables v9.8 Camera Input Mapping System. `camera.inertia = 0`.
- C19: 3 camera types: FreeCamera (cockpit/grid), FollowCamera (chase), ArcRotateCamera (drone). Swapped via `scene.activeCamera`.
- C-F7: Never make Camera initiate GSM transitions.

---

## Acceptance Criteria

_From QL-STORY-READY gate, defined for infrastructure story:_

- [ ] **F1**: `CameraMode` enum compiles with exactly 5 values: `Inactive`, `Grid`, `Cockpit`, `Chase`, `Drone`.
- [ ] **F2**: `ICameraManager` interface is defined with all 8 methods: `init`, `setActiveMode`, `toggleCockpitChase`, `setSpeedData`, `addShake`, `update`, `dispose`.
- [ ] **F3**: A class implementing `ICameraManager` exists and initializes without error.
- [ ] **F4**: 4 camera instances are created on init, each with the correct Babylon.js type: FreeCamera (grid), FreeCamera (cockpit), FollowCamera (chase), ArcRotateCamera (drone).
- [ ] **F5**: Each camera instance has `camera.inputs.clear()` called and `camera.inertia === 0` post-init.
- [ ] **F6**: `setActiveMode(CameraMode.X)` switches `scene.activeCamera` to the correct instance; switching to an invalid mode does not throw.
- [ ] **F7**: `CameraConfig` type can be instantiated with default values for all 27 knobs (compile-time + runtime default check).

---

## Implementation Notes

_Derived from ADR-0007 Implementation Guidelines:_

### CameraMode Enum

```typescript
enum CameraMode {
  Inactive = 0,
  Grid,
  Cockpit,
  Chase,
  Drone,
}
```

### ICameraManager Interface

```typescript
interface ICameraManager {
  init(scene: Scene, playerCarId: string): void;
  setActiveMode(mode: CameraMode): void;
  toggleCockpitChase(): void; // called on cameraToggle pulse
  setSpeedData(speedKmh: number): void;
  addShake(type: ShakeType, intensity: number): void;
  update(dt: number): void; // per-tick: FOV shift, shake decay, occlusion raycast
  dispose(): void;
}
```

### CameraConfig Type

```typescript
interface CameraConfig {
  cockpit: { fov: number; fovMin: number; fovMax: number };
  chase: {
    fov: number;
    fovMin: number;
    fovMax: number;
    distance: number;
    height: number;
    offset: number;
    cameraAcceleration: number;
    maxCameraSpeed: number;
  };
  drone: { distance: number; speed: number; skipDelay: number; fov: number };
  speedFactor: number;
  headBob: { intensity: number; frequency: number };
  lean: { intensity: number };
  shake: ShakeConfig;
}
```

### Camera Creation Pattern (all 4 cameras)

```typescript
// Cockpit camera (FreeCamera)
const cockpitCam = new FreeCamera("cockpitCam", Vector3.Zero(), scene);
cockpitCam.inputs.clear();
cockpitCam.inertia = 0;

// Grid camera (FreeCamera)
const gridCam = new FreeCamera("gridCam", new Vector3(0, 30, -40), scene);
gridCam.inputs.clear();
gridCam.inertia = 0;

// Chase camera (FollowCamera)
const chaseCam = new FollowCamera("chaseCam", new Vector3(0, 3, -6), scene);
chaseCam.inputs.clear();
chaseCam.inertia = 0;

// Drone camera (ArcRotateCamera)
const droneCam = new ArcRotateCamera(
  "droneCam",
  0,
  Math.PI / 4,
  8,
  target,
  scene
);
droneCam.inputs.clear();
droneCam.inertia = 0;
// Extra cleanup for v9.8+ Input Mapping System:
(droneCam as any).movement.input.inputMap.length = 0;
```

### scene.activeCamera Switching

Only one camera is active per frame. The others remain in the scene but dormant:

```typescript
setActiveMode(mode: CameraMode): void {
  this.currentMode = mode;
  switch (mode) {
    case CameraMode.Inactive:
      scene.activeCamera = null;  // or leave previous, render layer handles it
      break;
    case CameraMode.Grid:
      scene.activeCamera = this.gridCam;
      break;
    case CameraMode.Cockpit:
      scene.activeCamera = this.cockpitCam;
      break;
    case CameraMode.Chase:
      scene.activeCamera = this.chaseCam;
      break;
    case CameraMode.Drone:
      scene.activeCamera = this.droneCam;
      break;
  }
}
```

### Import Paths

Core layer can import from `@babylonjs/core`:

```typescript
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { FollowCamera } from "@babylonjs/core/Cameras/followCamera";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
```

---

## Out of Scope

- **Story 002**: GSM lifecycle + Grid camera setup
- **Story 003**: Cockpit parenting to `driver_eye`
- **Story 004**: Chase occlusion raycast
- **Story 005**: Cockpit/chase toggle
- **Story 006**: FOV shift
- **Story 007**: Shake system
- **Story 008**: Drone auto-orbit
- **Story 009**: Head bob + lean
- **Story 010**: Config HMR

---

## QA Test Cases

_Written by qa-lead at story creation:_

- **F1** (enum values):
  - Given: `CameraMode` enum defined
  - When: Enum is inspected at runtime
  - Then: Exactly 5 values exist with names `Inactive` (0), `Grid` (1), `Cockpit` (2), `Chase` (3), `Drone` (4)
  - Edge: No extra values, correct ordinal mapping

- **F2** (interface methods):
  - Given: `ICameraManager` interface defined
  - When: TypeScript type check is run
  - Then: Interface contains exactly 8 methods with correct signatures
  - Edge: Verify no extra or missing methods

- **F3** (class init):
  - Given: CameraManager class implementing ICameraManager
  - When: `new CameraManager(scene)` is called
  - Then: Constructor returns a valid instance without throwing
  - Edge: Called with null scene → handle gracefully (or typed to never allow null)

- **F4** (camera instances):
  - Given: CameraManager initialized
  - When: All 4 camera instances are inspected
  - Then: `cockpitCam instanceof FreeCamera === true`; `gridCam instanceof FreeCamera === true`; `chaseCam instanceof FollowCamera === true`; `droneCam instanceof ArcRotateCamera === true`
  - Edge: Verify all 4 are distinct instances (not same reference)

- **F5** (inputs cleared):
  - Given: All 4 cameras initialized
  - When: Each camera's `inputs` and `inertia` properties are inspected
  - Then: `camera.inertia === 0` for all; `camera.inputs.attachedToElement === false` after clear
  - Edge: Verify `droneCam` also has `movement.input.inputMap.length === 0`

- **F6** (setActiveMode):
  - Given: CameraManager initialized, all cameras created
  - When: `setActiveMode(CameraMode.Cockpit)` is called
  - Then: `scene.activeCamera === cockpitCam`
  - When: `setActiveMode(CameraMode.Chase)` is called
  - Then: `scene.activeCamera === chaseCam`
  - Edge: `setActiveMode(-1)` (invalid) — does not throw, `scene.activeCamera` unchanged

- **F7** (CameraConfig defaults):
  - Given: `CameraConfig` type with default factory
  - When: `createDefaultCameraConfig()` is called
  - Then: All 27 fields present with correct default values matching GDD tuning knob table
  - Edge: Verify no field is undefined or null

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/camera/camera-foundation_test.ts`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: ConfigManager (Foundation), Scene is provided at init time
- Unlocks: Stories 002–010
