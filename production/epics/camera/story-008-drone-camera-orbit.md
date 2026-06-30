# Story 008: Drone Camera Auto-Orbit

> **Epic**: Camera
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/camera.md`
**Requirement**: `TR-CAM-010`

- **TR-CAM-010**: Drone camera auto-orbits player car after race end (no user input) — configurable orbital speed and distance.

**ADR Governing Implementation**: ADR-0007: Camera Architecture
**ADR Decision Summary**: ArcRotateCamera with `inputs.clear()` + `inertia = 0`, auto-increments `alpha` each tick. Activated on `gsm.state.entered(PostRace)`. Skippable after skipDelay via confirm input.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: ArcRotateCamera requires extra cleanup for v9.8+ Input Mapping System: `(drone as any).movement.input.inputMap.length = 0`.

**Control Manifest Rules (this layer)**:

- C19: ArcRotateCamera for drone.
- C-F7: Never initiate GSM transitions.

---

## Acceptance Criteria

_From GDD `design/gdd/camera.md`, scoped to this story:_

- [ ] **AC-9**: PostRace transitions to a drone camera orbiting the player's car. On `gsm.state.entered(PostRace)`, `scene.activeCamera` becomes the ArcRotateCamera and `alpha` changes by ~15°/s of game time.
- [ ] **AC-10**: PostRace drone camera is active until player presses confirm (results dismissed, GSM → Menu). When confirm is received (after skip delay), camera switches to Inactive.
- [ ] **AC-17 (timing)**: Drone activates on PostRace transition, not at exact car stop moment. If car is still moving when PostRace fires, drone is active immediately — does not wait for velocity=0.
- [ ] **Skippable**: If player presses confirm before `drone.skipDelay` (0.5s default), drone does NOT skip. After the delay, confirm skips the drone immediately.

---

## Implementation Notes

_Derived from ADR-0007 Implementation Guidelines:_

### Camera Creation

```typescript
const droneCam = new ArcRotateCamera(
  "droneCam",
  0, // alpha (horizontal angle, radians)
  Math.PI / 4, // beta (vertical angle, 45°)
  config.drone.distance, // radius (default 8m)
  playerCarMesh, // target (look-at the car)
  scene
);
droneCam.inputs.clear();
droneCam.inertia = 0;
// Extra cleanup for v9.8+ Input Mapping System:
(droneCam as any).movement.input.inputMap.length = 0;
```

### Auto-Orbit

```typescript
// In CameraManager.update(), when currentMode === Drone:
if (this.currentMode === CameraMode.Drone) {
  // Increment alpha at configured speed (degrees per second → radians per tick)
  const alphaDelta = ((config.drone.speed * Math.PI) / 180) * dt;
  droneCam.alpha += alphaDelta;
}
```

### GSM Activation

```typescript
// On gsm.state.entered(PostRace):
this.setActiveMode(CameraMode.Drone);
// Drone is active immediately — does not wait for car velocity == 0
```

### Skip Logic

```typescript
// In CameraManager, tracking drone state:
private droneStartTime: number = 0;
private droneSkippable: boolean = false;

// On Drone activation:
setActiveMode(CameraMode.Drone): void {
  // ... setup ...
  this.droneStartTime = this.totalElapsed;
  this.droneSkippable = false;
}

// Called on confirm input (during Drone mode only):
trySkipDrone(): void {
  if (!this.droneSkippable) return; // within skipDelay window — ignore

  // Skip to Inactive — GSM handles Menu transition
  this.setActiveMode(CameraMode.Inactive);
}

// In update(), for Drone mode:
update(dt: number): void {
  if (this.currentMode === CameraMode.Drone) {
    // Orbit
    droneCam.alpha += (config.drone.speed * Math.PI / 180) * dt;

    // Check skip delay
    if (!this.droneSkippable &&
        (this.totalElapsed - this.droneStartTime) >= config.drone.skipDelay) {
      this.droneSkippable = true;
    }
  }
}
```

### Configuration

```typescript
drone: {
  distance: 8,     // orbit radius (m)
  speed: 15,       // orbit speed (°/s) — full circle in ~24s
  skipDelay: 0.5,  // seconds before drone is skippable
  fov: 65,         // fixed FOV (degrees)
}
```

---

## Out of Scope

- Speed-dependent FOV (Story 006) — Drone has fixed FOV
- GSM lifecycle infrastructure (Story 002)
- Camera creation (Story 001)

---

## QA Test Cases

_Written by qa-lead at story creation:_

- **AC-9** (drone activation):
  - Given: GSM in Racing, chase camera active
  - When: `gsm.state.entered(PostRace)` fires
  - Then: `scene.activeCamera === ArcRotateCamera` instance; `camera.alpha` changes by ~15° per second of elapsed game time (verify delta over 1s simulated)
  - Edge: Player car destroyed (DNF) — drone still activates on PostRace, orbiting the stopped car

- **AC-10** (drone deactivation):
  - Given: Drone active in PostRace
  - When: Confirm input is received (after 0.5s skip delay)
  - Then: Camera mode → Inactive (results dismissal continues)
  - Edge: Confirm before 0.5s — drone does NOT skip

- **AC-17 timing**:
  - Given: Car moving at 30 km/h, GSM enters PostRace
  - When: `camera.update()` on first tick after PostRace
  - Then: `scene.activeCamera === drone` immediately — does NOT wait for car velocity=0

- **Skippable delay**:
  - Given: PostRace started at t=0
  - When: Confirm at t=0.4s → verify skip does NOT happen
  - When: Confirm at t=0.6s → verify skip DOES happen

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/camera/drone-camera-orbit.test.ts`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (needs camera created + scene), Story 002 (GSM lifecycle for PostRace trigger)
- Unlocks: None
