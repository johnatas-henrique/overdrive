# Story 003: Cockpit Camera

> **Epic**: Camera
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 10h

## Context

**GDD**: `design/gdd/camera.md`
**Requirement**: `TR-CAM-006`

- **TR-CAM-006**: Cockpit camera parented to `driver_eye` TransformNode on car mesh — inherits car position automatically.

**ADR Governing Implementation**: ADR-0007: Camera Architecture
**ADR Decision Summary**: FreeCamera parented to `driver_eye` TransformNode on the car mesh. A child TransformNode sits between `driver_eye` and the camera as the attachment point for shake/bob/lean offsets, allowing them to be disabled independently without breaking the hierarchy.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW

**Control Manifest Rules (this layer)**:

- C19: FreeCamera for cockpit/grid.

---

## Acceptance Criteria

_From GDD `design/gdd/camera.md`, scoped to this story:_

- [ ] **AC-1**: Player starts Race with cockpit camera (default view). When GSM enters Racing state and no toggle has been pressed, `scene.activeCamera` is the cockpit FreeCamera.
- [ ] **AC-12**: Cockpit camera correctly inherits car position/rotation via `driver_eye` node. When car moves by (x, y, z), camera's absolute position tracks within floating-point epsilon after `update()`.
- [ ] **AC-17 (partial — DNF coasting)**: On fuel-empty DNF, camera continues following the coasting car. Camera's absolute position tracks car's absolute position (difference never exceeds 0.1 units from expected follow offset).

---

## Implementation Notes

_Derived from ADR-0007 Implementation Guidelines:_

### Camera Hierarchy

```
Car mesh root (physics body)
  └── driver_eye (TransformNode)     ← placed at driver eye position in GLB
       └── shakeNode (TransformNode)  ← shake/bob/lean offsets applied here
            └── cockpitCam (FreeCamera) ← always at origin relative to shakeNode
```

### Code

```typescript
// 1. Find driver_eye on the player's car mesh
const driverEye = carMesh.getChildTransformNode("driver_eye", true);
if (!driverEye) {
  throw new CameraError(
    "driver_eye TransformNode not found on player car mesh"
  );
}

// 2. Create shake node as child of driver_eye
const shakeNode = new TransformNode("cockpitShake", scene);
shakeNode.parent = driverEye;

// 3. Create cockpit camera as child of shake node
const cockpitCam = new FreeCamera("cockpitCam", Vector3.Zero(), scene);
cockpitCam.parent = shakeNode; // camera is at origin relative to shakeNode
cockpitCam.inputs.clear();
cockpitCam.inertia = 0;

// 4. Inherits car position automatically through the chain:
//    car position → driver_eye → shakeNode → camera
//    Suspension movement, body roll, etc. all propagate automatically
```

### Shake Node Specifications

- Position: `Vector3.Zero()` (no offset — camera sees from `driver_eye` position)
- Rotation: `Quaternion.Identity()`
- The shake node is where Story 007 (shake) and Story 009 (head bob/lean) apply their offsets

### Default Camera (AC-1)

On `gsm.state.entered(Racing)`, the camera manager defaults to cockpit mode if no toggle has been made yet:

```typescript
// In GSM lifecycle handler:
case "Racing":
  const targetMode = this.lastToggleChoice ?? CameraMode.Cockpit;
  this.setActiveMode(targetMode);
```

### Cockpit Base FOV (for reference by Story 006)

Base FOV: 75°, FOV shift range: 65°–85°, `speedFactor: 0.05` degrees per km/h.

---

## Out of Scope

- Head bob and lateral lean (Story 009) — applied to shakeNode, not camera directly
- Camera shake (Story 007) — applied to shakeNode
- Chase camera (Story 004)
- Toggle mechanics (Story 005)

---

## QA Test Cases

_Written by qa-lead at story creation:_

- **AC-1** (default cockpit):
  - Given: GSM is in Racing state, no toggle ever pressed
  - When: `camera.update()` is called
  - Then: `scene.activeCamera === cockpitCam` (FreeCamera parented to `driver_eye`)
  - Edge: After toggling to chase and back, cockpit is still valid

- **AC-12** (driver_eye inheritance):
  - Given: Car at world position P with rotation R, `driver_eye` is a child TransformNode at local position (0, 1.2, 0)
  - When: `camera.update()` is called (no shake active)
  - Then: `cockpitCam.absolutePosition ≈ driverEye.getAbsolutePosition()` within 0.001 units; `cockpitCam.absoluteRotation ≈ driverEye.absoluteRotation` within 0.1°
  - Edge: Car moving at 300 km/h — camera still tracks within epsilon

- **AC-17** (DNF coasting):
  - Given: Car moving at 50 km/h, DNF triggered
  - When: `camera.update()` called each frame for 120 frames (2s at 60fps)
  - Then: `cockpitCam.absolutePosition` tracks car's absolute position (difference never exceeds 0.1 units from expected follow offset)
  - Edge: Car at 0 km/h after coast-to-stop — camera stays at last valid relative offset

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/camera/cockpit-camera_test.ts`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (needs camera instances + scene), Entity/Car Lifecycle (for `driver_eye` node on car mesh)
- Unlocks: Story 005 (toggle needs cockpit functional), Story 009 (head bob needs cockpit hierarchy)
