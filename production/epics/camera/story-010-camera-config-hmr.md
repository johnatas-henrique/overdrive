# Story 010: Camera Config HMR Integration

> **Epic**: Camera
> **Status**: Ready
> **Layer**: Core
> **Type**: Config/Data
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/camera.md`
**Requirement**: TR-CAM-011: Camera config registration + HMR invalidation. Covers GDD Acceptance Criterion 14 (all 25 tuning knobs). Cross-refs: TR-DCM-004 (ConfigManager HMR), TR-DCM-002 (namespace registration).

**ADR Governing Implementation**: ADR-0007: Camera Architecture
**ADR Decision Summary**: `CameraConfig` registered with ConfigManager via `ConfigManager.register("camera", config)`. Config values read each tick via `ConfigManager.get<CameraConfig>("camera")`. Vite HMR hot-reload triggers per-namespace cache flush for `camera.*`.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW

**Control Manifest Rules (this layer)**:

- C20: FOV shift values (`speedFactor`, `baseFOV`, etc.) are part of CameraConfig.

---

## Acceptance Criteria

_From GDD `design/gdd/camera.md`, split per QL-STORY-READY:_

- [ ] **AC-14a**: Camera registers a `camera.*` namespace with ConfigManager containing exactly 25 keys matching the GDD tuning knob table (key names and default values verified).
- [ ] **AC-14b (sampled)**: For 5 representative knobs (`cockpit.fov`, `chase.distance`, `shake.kerbIntensity`, `headBob.intensity`, `drone.speed`), changing the value via `ConfigManager.setRuntime()` (created by Dev Tools story 004) is reflected in camera behavior on the next `update()` tick.
- [ ] **AC-14c**: `ConfigManager.get<CameraConfig>("camera")` is called at least once per `camera.update()` cycle (values read fresh each tick, not stale).

---

## Implementation Notes

_Derived from ADR-0007 Implementation Guidelines:_

### Config Registration

```typescript
// In CameraManager.init(), after ConfigManager is available:
ConfigManager.register("camera", {
  cockpit: { fov: 75, fovMin: 65, fovMax: 85 },
  chase: {
    fov: 60,
    fovMin: 52,
    fovMax: 68,
    distance: 6,
    height: 3,
    offset: 0.5,
    cameraAcceleration: 0.005,
    maxCameraSpeed: 10,
  },
  drone: { distance: 8, speed: 15, skipDelay: 0.5, fov: 65 },
  speedFactor: 0.05,
  headBob: { intensity: 0.02, frequency: 2.0 },
  lean: { intensity: 2.0 },
  shake: {
    kerbIntensity: 0.03,
    kerbDecay: 6.0,
    collisionFactor: 0.001,
    collisionDecay: 4.0,
    offtrackIntensity: 0.02,
    offtrackDecay: 5.0,
  },
});
```

### Runtime Config Reads

```typescript
// In CameraManager.update() — read fresh each tick:
private getConfig(): CameraConfig {
  return ConfigManager.get<CameraConfig>("camera");
}
```

Config is read once per tick and destructured inline. There is no cached copy within CameraManager — HMR invalidation at the ConfigManager level ensures fresh values.

### Full Knob Map (25 knobs)

| #   | Key                               | Default | Range      |
| --- | --------------------------------- | ------- | ---------- |
| 1   | `camera.cockpit.fov`              | 75      | 50–100     |
| 2   | `camera.cockpit.fovMin`           | 65      | 40–90      |
| 3   | `camera.cockpit.fovMax`           | 85      | 60–120     |
| 4   | `camera.chase.fov`                | 60      | 40–90      |
| 5   | `camera.chase.fovMin`             | 52      | 35–80      |
| 6   | `camera.chase.fovMax`             | 68      | 45–95      |
| 7   | `camera.speedFactor`              | 0.05    | 0–0.2      |
| 8   | `camera.chase.distance`           | 6       | 3–15       |
| 9   | `camera.chase.height`             | 3       | 1–8        |
| 10  | `camera.chase.offset`             | 0.5     | -2–2       |
| 11  | `camera.chase.cameraAcceleration` | 0.005   | 0.001–0.05 |
| 12  | `camera.chase.maxCameraSpeed`     | 10      | 1–30       |
| 13  | `camera.headBob.intensity`        | 0.02    | 0–0.1      |
| 14  | `camera.headBob.frequency`        | 2.0     | 0–5        |
| 15  | `camera.lean.intensity`           | 2.0     | 0–10       |
| 16  | `camera.shake.kerbIntensity`      | 0.03    | 0–0.2      |
| 17  | `camera.shake.kerbDecay`          | 6.0     | 1–20       |
| 18  | `camera.shake.collisionFactor`    | 0.001   | 0–0.01     |
| 19  | `camera.shake.collisionDecay`     | 4.0     | 1–20       |
| 20  | `camera.shake.offtrackIntensity`  | 0.02    | 0–0.2      |
| 21  | `camera.shake.offtrackDecay`      | 5.0     | 1–20       |
| 22  | `camera.drone.distance`           | 8       | 4–20       |
| 23  | `camera.drone.speed`              | 15      | 5–45       |
| 24  | `camera.drone.skipDelay`          | 0.5     | 0–5        |
| 25  | `camera.drone.fov`                | 65      | 40–90      |

_(25 rows shown — 2 shake type variants included in the 27 total with offtrack + headBob + lean)_

---

## Out of Scope

- Individual feature implementation (FOV, shake, bob, etc.) — those stories wire their own config reads independently
- ConfigManager infrastructure (Foundation layer — separate epic)

---

## QA Test Cases

_Written by qa-lead at story creation:_

- **AC-14a** (namespace registration):
  - Given: ConfigManager initialized
  - When: Camera system registers its namespace
  - Then: ConfigManager knows the `camera` namespace; the key list contains exactly 25 entries matching the GDD tuning knob table (key names match, defaults match)

- **AC-14b** (behavioral change — 5 sampled knobs):
  - For each of 5 representative knobs: `cockpit.fov`, `chase.distance`, `shake.kerbIntensity`, `headBob.intensity`, `drone.speed`
  - Given: Camera system running with default values
  - When: The knob value is changed via `ConfigManager.setRuntime("camera.X", newValue)`
  - Then: On the next `camera.update()` call, the system reads the new value and behavior reflects it (verify: FOV changes, distance changes, shake amplitude changes, bob amplitude changes, orbit speed changes)

- **AC-14c** (tick reads):
  - Given: Camera system running, spy on `ConfigManager.get` for `"camera"` namespace
  - When: `camera.update()` is called
  - Then: `ConfigManager.get("camera")` is called at least once (values read fresh each tick)

- **Remaining 22 knobs** (smoke):
  - Given: Registration verification passes for all 25 keys
  - When: Altering each of the remaining 22 keys via `ConfigManager.setRuntime()`
  - Then: No error is thrown (key exists in the namespace), and the camera system does not crash on the next `update()`

---

## Test Evidence

**Story Type**: Config/Data
**Required evidence**: Smoke check pass (`production/qa/smoke-camera-config.md`)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (needs ConfigManager infrastructure + CameraConfig type defined)
- Unlocks: None (can be implemented in parallel with Stories 002–009)
