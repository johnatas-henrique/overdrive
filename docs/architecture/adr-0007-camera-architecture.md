# ADR-0007: Camera Architecture

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                           |
| ------------------------- | ------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                                               |
| **Domain**                | Camera                                                                          |
| **Knowledge Risk**        | LOW — camera APIs (FreeCamera, FollowCamera, ArcRotateCamera) stable since v5.x |
| **References Consulted**  | VERSION.md, camera.md GDD, architecture.md Module Ownership, ADR-0006           |
| **Post-Cutoff APIs Used** | None                                                                            |
| **Verification Required** | Camera Input Mapping System (v9.8) disabled via `camera.inputs.clear()`         |

## ADR Dependencies

| Field             | Value                                                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Depends On**    | ADR-0006 (Input — receives `cameraToggle` pulse)                                                                                                                |
| **Enables**       | HUD layout (camera FOV determines visible HUD area), PostRace drone sequence                                                                                    |
| **Blocks**        | None — camera is pure presentation, game systems function without it                                                                                            |
| **Ordering Note** | Init slot #3 (after Input #2, before Physics #4). Must exist before Entity/Car Lifecycle spawns cars (slot #8) so follow target can be set on `entity.spawned`. |

## Context

### Problem Statement

The game needs three distinct camera modes: cockpit (inside the car, FPS-style), chase (behind the car, third-person), and drone (PostRace orbit). Each mode has different FOV, position logic, and shake behavior. The camera must never affect gameplay — it is purely a presentation layer. It must feel responsive, reinforce the sense of speed, and never fight the player's input.

### Constraints

- Camera never initiates GSM transitions — it is purely reactive to `gsm.state.entered` events
- Camera never reads Input directly — receives `cameraToggle` pulse from InputState (ADR-0006)
- Built-in gamepad input on camera types (v9.8 Camera Input Mapping System) must be disabled — `camera.inputs.clear()`
- Must never clip through geometry — chase camera needs occlusion raycast
- Cockpit camera auto-inherits car position via parenting to `driver_eye` TransformNode
- Shake effects are additive and decay independently — never affect car physics
- FOV shift with speed is linear — no easing in MVP

### Requirements

- Three camera modes: Grid (PreRace static), Racing (cockpit/chase toggle), Drone (PostRace orbit)
- Instant toggle between cockpit and chase (no lerp)
- FOV shifts with speed: `baseFOV + speedFactor x speed_kmh`, clamped to [FOV_min, FOV_max]
- Camera shake: additive, exponential decay, per-event intensity and decay rate
- Chase occlusion: raycast backward from car, snap closer if blocked
- Head bob and lateral lean in cockpit mode (cosmetic only, zero gameplay impact)
- Drone camera orbits the player car automatically (no user input)

## Decision

### Architecture

```
gsm.state.entered ──┐
                     ├── CameraManager.reactToState(state)
Input.cameraToggle ──┘          │
                                ▼
                    ┌──────────────────────┐
                    │   ActiveCameraMode    │
                    ├──────────────────────┤
                    │ Grid (FreeCamera)     │
                    │ Racing (cockpit)      │
                    │ Racing (chase)        │
                    │ Drone (ArcRotate)     │
                    └──────────────────────┘
```

CameraManager owns three Babylon cameras (one active, two dormant per frame). Each tick, the active camera is set as `scene.activeCamera`. The other cameras are not disposed — they are swapped in/out via `scene.activeCamera = camera`.

### Camera Types by Mode

| Mode             | Camera Type     | Babylon API                               | Notes                                                |
| ---------------- | --------------- | ----------------------------------------- | ---------------------------------------------------- |
| Grid (PreRace)   | FreeCamera      | `@babylonjs/core/Cameras/freeCamera`      | Static position, look-at computed to frame grid      |
| Cockpit (Racing) | FreeCamera      | `@babylonjs/core/Cameras/freeCamera`      | Parented to `driver_eye` TransformNode on car mesh   |
| Chase (Racing)   | FollowCamera    | `@babylonjs/core/Cameras/followCamera`    | Chases player car with configurable spring stiffness |
| Drone (PostRace) | ArcRotateCamera | `@babylonjs/core/Cameras/arcRotateCamera` | Auto-orbits player car, no user input                |

### Key Interfaces

```typescript
enum CameraMode {
  Inactive,
  Grid,
  Cockpit,
  Chase,
  Drone,
}

interface ICameraManager {
  init(scene: Scene, playerCarId: string): void;
  setActiveMode(mode: CameraMode): void;
  toggleCockpitChase(): void; // called on cameraToggle pulse
  setSpeedData(speedKmh: number): void;
  addShake(type: ShakeType, intensity: number): void;
  update(dt: number): void; // per-tick: FOV shift, shake decay
  dispose(): void;
}

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

### GSM Lifecycle

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

On `gsm.state.entered(Racing)`, the camera restores the player's last toggle choice (cockpit or chase). This preference is stored locally and persists across race restarts within the same session.

### Disable Camera Input (v9.8+)

All cameras must disable built-in input mapping to avoid double-reads with ADR-0006.
Additionally, set `camera.inertia = 0` to prevent residual drift during dormant frames:

```typescript
const camera = new FreeCamera("cockpitCam", position, scene);
camera.inputs.clear(); // disable all built-in input (keyboard, mouse, gamepad)
camera.inertia = 0; // prevent drift during dormant frames (when not activeCamera)
// Camera is now purely programmatic — only ICameraManager.update() moves it
```

For `ArcRotateCamera` (drone), also clear the v9.8+ Input Mapping System:

```typescript
const drone = new ArcRotateCamera("droneCam", 0, 0, 8, target, scene);
drone.inputs.clear();
drone.inertia = 0;
// Extra cleanup for v9.8+ Input Mapping System:
(drone as any).movement.input.inputMap.length = 0;
```

### FollowCamera Occlusion Raycast

Babylon.js FollowCamera has no built-in occlusion check. A custom raycast runs per frame:

```
1. From car center, cast ray backward (length = chase.distance) on collision layer
2. If ray hits barrier/wall → snap camera to hitPoint - 0.5m
3. If ray is clear → camera returns to configured distance with spring smoothing
```

The raycast uses `scene.pickWithRay()` against the barrier collision layer only (ignores other cars).

### Shake System

```typescript
type ShakeType = "kerb" | "collision" | "offTrack";

interface ActiveShake {
  intensity: number;
  decay: number; // per-second decay rate
  time: number; // elapsed time since shake started
}

// Each tick:
let totalOffset = Vector3.Zero();
for (const shake of activeShakes) {
  const current = shake.intensity * Math.exp(-shake.decay * shake.time);
  totalOffset.addInPlace(
    new Vector3(
      (Math.random() - 0.5) * current,
      (Math.random() - 0.5) * current,
      (Math.random() - 0.5) * current
    )
  );
  shake.time += dt;
  if (current < shake.intensity * 0.05) activeShakes.splice(i--); // remove at 5%
}
// Apply totalOffset to shake TransformNode
```

### FOV Shift

```
FOV = baseFOV + speedFactor x speed_kmh
Clamped to [FOV_min, FOV_max]
```

Applied each tick via `camera.fov = (fov * Math.PI) / 180` (Babylon.js uses radians).

## Alternatives Considered

### Alternative 1: All cameras via UniversalCamera

- **Description**: Use UniversalCamera for all modes. UniversalCamera supports WASD + mouse + gamepad input natively.
- **Pros**: Single camera type, consistent API
- **Cons**: UniversalCamera's built-in input must be disabled (same as FreeCamera), but it's heavier (carries input mapping infrastructure). FollowCamera has native chase behavior (elastic follow, look-at target) — reimplementing that manually is wasted effort.
- **Rejection Reason**: Each mode benefits from the specific camera type. FollowCamera's native spring behavior is exactly what chase needs — reimplementing it on UniversalCamera adds code with zero benefit.

### Alternative 2: Single manual camera (no Babylon camera types)

- **Description**: Create a single camera positioned/rotated manually each tick. Zero engine camera dependency.
- **Pros**: Full control, no engine camera quirks
- **Cons**: Reimplements FollowCamera spring, ArcRotateCamera orbit, and FreeCamera parenting logic. Cockpit parenting to `driver_eye` is trivial with FreeCamera (2 lines) but requires manual matrix math without it.
- **Rejection Reason**: Reimplementing engine camera features is wasted effort. FreeCamera parenting, FollowCamera spring, and ArcRotateCamera orbit are exactly what the GDD specifies — use them.

## Consequences

### Positive

- Each camera type uses the engine API designed for its purpose — minimal code
- FollowCamera spring gives chase mode a responsive feel (Horizon Chase style) with zero custom code
- Cockpit parenting to `driver_eye` is automatic — no manual position sync
- Camera inputs disabled (v9.8+) prevents double-read with ADR-0006
- Shake is additive and purely cosmetic — zero impact on physics determinism
- Grid camera look-at adapts to any grid size (works for 8 cars in MVP, more in Championship)

### Negative

- Three camera instances in memory per frame (one active, two dormant) — ~3KB total, negligible
- Occlusion raycast adds one `scene.pickWithRay()` per frame — ~0.01ms
- FollowCamera stiffness must be tuned per-track feel — knob-dependent
- Drone camera has no user input — must feel good as an auto-orbit, or players get motion sick
- **GDD correction**: camera.md uses `chase.stiffness` (0.9). The ADR replaces it with `chase.cameraAcceleration` + `chase.maxCameraSpeed` — the FollowCamera's native API uses acceleration-limited velocity, not spring stiffness. The GDD must be updated to match.

### Risks

- **Risk**: FollowCamera spring stiffness interacts with low framerate — loose spring at 30fps feels different than at 60fps
  **Mitigation**: Fixed timestep pipeline means camera update runs at 60Hz regardless of render framerate. Camera position is interpolated from the last fixed-tick state.
- **Risk**: `camera.inputs.clear()` breaks if Babylon.js changes input attachment API in a future version
  **Mitigation**: Verify on engine upgrade. If API changes, the camera loses input either way (it's a 2-line fix).
- **Risk**: Drone orbit causes motion sickness in some players
  **Mitigation**: Drone duration is short (~3-5s before player skips with confirm). PostRace skip is available after 0.5s.

## GDD Requirements Addressed

| GDD System          | Requirement                                     | How This ADR Addresses It                                       |
| ------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| camera.md           | Two camera modes (cockpit/chase) instant toggle | FreeCamera + FollowCamera, `toggleCockpitChase()`               |
| camera.md           | FOV shifts with speed (linear formula)          | `baseFOV + speedFactor x speed_kmh` each tick                   |
| camera.md           | Shake additive, exponential decay               | ActiveShake array with per-frame decay and 5% removal threshold |
| camera.md           | GSM-driven lifecycle                            | `reactToState(gsm.state.entered)` transitions                   |
| camera.md           | Chase occlusion protection                      | Raycast backward from car center, snap if blocked               |
| camera.md           | Head bob and lean are cosmetic                  | Applied on shake TransformNode, zero gameplay impact            |
| camera.md           | Cockpit inherits car position via `driver_eye`  | FreeCamera parented to `driver_eye` TransformNode               |
| camera.md           | Grid camera frames full grid                    | Look-at computed from first car position, framing backward      |
| input.md (ADR-0006) | Camera input disabled to prevent double-read    | `camera.inputs.clear()` on all cameras                          |

## Performance Implications

- **CPU**: Three camera position computations per frame (~0.003ms) + one occlusion raycast (~0.01ms) + FOV calc (~0.001ms) = ~0.014ms total
- **Memory**: Three camera instances (~1KB each) + CameraConfig (~500 bytes) + activeShakes array (~200 bytes peak) = ~4KB total
- **Load Time**: Camera constructors are synchronous — zero load time impact

## Validation Criteria

- [ ] Cockpit camera correctly parented to `driver_eye` — inherits all car transforms
- [ ] Camera toggle switches cockpit ↔ chase instantly (same frame, no lerp)
- [ ] FOV visibly narrows from 75°→65° at 200 km/h in cockpit mode
- [ ] Kerb hit produces shake that decays to <5% within ~0.5s
- [ ] Chase camera raycast detects wall occlusion and snaps closer
- [ ] Drone camera orbits player car at 15°/s automatically
- [ ] `camera.inputs.clear()` verified — no gamepad input leaks through camera
- [ ] Toggle preference persists across PreRace → Racing → PostRace → Race Again cycle
- [ ] Head bob + lean active in cockpit, zero impact on car trajectory (physics determinism verified)
- [ ] Grid camera look-at frames all 8 cars at any grid position

## Related Decisions

- ADR-0002 (Fixed Timestep Pipeline — camera update in presentation layer, not simulation pipeline)
- ADR-0006 (Input Abstraction — cameraToggle pulse, camera input disabled to prevent double-read)
- ADR-0005 (Entity/Car Lifecycle — camera sets follow target on `entity.spawned` for player car)
