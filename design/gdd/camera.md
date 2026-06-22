# Camera

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Speed That Is Felt

---

## Overview

Camera controls what the player sees during the race and between race phases. It provides two views (cockpit and chase), toggled instantly by the player, and reacts to speed, surface, and collisions to reinforce the sense of velocity. In PreRace it acts as a fixed establishing shot of the grid; in PostRace it switches to a free drone view orbiting the player's car.

The camera never affects gameplay — it is purely a presentation layer that consumes data from Physics, Collision, and the Game State Machine.

---

## Player Fantasy

The player forgets the camera exists. During Racing, the view is responsive, predictable, and reinforces speed without ever fighting the player's input or obscuring the track ahead.

- In **cockpit** the player sees the dashboard, steering wheel, and track ahead — they are _in_ the car.
- In **chase** the player sees the full car from behind and slightly above — they are _the director_ of their own race.

Toggle between them is instant (no lerp), so the player can switch without delay penalty.

---

## Detailed Design

### Core Rules

1. **Two camera modes.** Cockpit (default) and chase. Player toggles via `cameraToggle` digital input with 200ms debounce.
2. **Instant toggle.** No smooth transitions in MVP — switch happens on the same frame.
3. **GSM-driven lifecycle.** Camera subscribes to `gsm.state.entered` and configures its mode based on the target state:
   - `PreRace` → cinematic grid camera
   - `Racing` → cockpit/chase (player's current toggle preference)
   - `PostRace` → drone orbit camera
4. **Follows only the player.** Camera tracks the player's car (`carId === playerCarId`). Rival cars never affect the local camera.
5. **FOV shifts with speed.** Cockpit and chase have different base FOV values. FOV widens at high speed, narrows at low speed — linear interpolation, no easing in MVP.
6. **Shake is additive.** Kerb, collision, and off-track shake effects stack additively and decay independently.
7. **Head bob and lean are cosmetic.** Applied on top of the camera transform, never affect gameplay. Intensity configurable per-knob.
8. **Camera never clips through geometry.** Chase camera uses a simple raycast backward from the car to prevent wall penetration. If occluded it snaps closer.

### States

| State        | Description                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| **Inactive** | Camera exists but does not follow any target. Used in Loading/Menu.                                             |
| **Grid**     | Fixed camera overlooking the starting grid. Active during GSM PreRace, switches on `gsm.state.entered(Racing)`. |
| **Racing**   | Active follow mode — either cockpit or chase based on player preference.                                        |
| **Drone**    | Free orbit around the player's car. PostRace celebration.                                                       |

### Camera Modes Detail

#### Cockpit Camera

| Property        | Value       | Notes                                                  |
| --------------- | ----------- | ------------------------------------------------------ |
| Type            | FreeCamera  | Parented to `driver_eye` TransformNode on the car mesh |
| Base FOV        | 75°         | Wider than chase — gives peripheral sense of speed     |
| Head bob        | ±0.02 units | Subtle vertical oscillation from acceleration/braking  |
| Lateral lean    | ±2° roll    | Subtle lean into corners from lateral G                |
| Shake           | Yes         | Kerb, collision, off-track triggers                    |
| FOV shift range | 65°–85°     | `baseFOV ± speedFactor × speed_kmh`, clamped           |

The cockpit camera is parented to a `TransformNode` placed at the driver's eye position within the car `.glb` asset. This means it automatically inherits the car's position, rotation, and suspension movement — zero manual sync required.

Head bob and lean are expressed as local offsets on a child `TransformNode` between the parent and the camera, allowing them to be disabled independently without breaking the camera hierarchy.

#### Chase Camera

| Property            | Value        | Notes                                                |
| ------------------- | ------------ | ---------------------------------------------------- |
| Type                | FollowCamera | Babylon.js native chase camera                       |
| Base FOV            | 60°          | Narrower than cockpit — cinematic framing            |
| Follow distance     | 6m           | Distance behind the car (knob)                       |
| Follow height       | 3m           | Height above the car (knob)                          |
| Follow offset       | 0.5m         | Lateral offset to the right (knob)                   |
| Spring acceleration | 0.005        | Acceleration toward target (FollowCamera native API) |
| Max spring speed    | 10           | Max approach speed (FollowCamera native API)         |
| Shake               | Yes          | Kerb, collision, off-track triggers                  |
| FOV shift range     | 52°–68°      | `baseFOV ± speedFactor × speed_kmh`, clamped         |

The chase camera uses Babylon.js `FollowCamera` with `cameraAcceleration` and `maxCameraSpeed` parameters. Higher acceleration + higher max speed produces a stiffer follow response (Horizon Chase style). The values are tuning knobs and can be adjusted in playtesting. Note: FollowCamera does NOT use a spring/damper model — the GDD's original `stiffness` concept was corrected during architecture to match the actual Babylon.js API.

Camera position is validated with a simple raycast from the car backward. If the line of sight is blocked (wall, another car), the camera snaps to the closest unoccluded position along the backward ray.

#### Grid Camera (PreRace)

A static camera placed above and ahead of the starting grid, framing all cars and a portion of the track ahead. Active during GSM PreRace. When GSM transitions to Racing, Camera switches to the player's configured cockpit or chase mode.

| Property | Value                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| Position | 30m above track centerline, 40m ahead of grid                                                                      |
| Look-at  | 15m ahead of pole position car, pointing back toward the last car — always frames the full grid regardless of size |
| FOV      | 70°                                                                                                                |

#### Drone Camera (PostRace)

A free-orbit camera that circles the player's car at a fixed distance, allowing the player to see their car and the result position, active during GSM PostRace. When the player presses confirm, the results screen (Menu LITE) advances to Menu — Camera reacts to `gsm.state.entered(Menu)` and deactivates.

| Property    | Value                  |
| ----------- | ---------------------- |
| Type        | ArcRotateCamera        |
| Distance    | 8m from car center     |
| Orbit speed | 15°/s                  |
| Look-at     | Player car center      |
| Skippable   | Via confirm after 0.5s |
| FOV         | 65°                    |

---

### Interactions with Other Systems

| System                   | Data Flow                                                                               | Direction            |
| ------------------------ | --------------------------------------------------------------------------------------- | -------------------- |
| **GSM**                  | `gsm.state.entered` → Camera switches mode (Grid/Racing/Drone)                          | GSM → Camera         |
| **Input**                | `cameraToggle` pulse → Camera swaps cockpit/chase                                       | Input → Camera       |
| **Physics**              | `speedKmh, lateralG, accelG, kerbHit, offTrack` → Camera applies FOV shift, lean, shake | Physics → Camera     |
| **Collision**            | `collision.impact` → Camera shakes (player-only, amp ∝ impulse)                         | Collision → Camera   |
| **Entity/Car Lifecycle** | `entity.spawned` → Camera finds player car by `carId` → sets follow target              | Lifecycle → Camera   |
| **HUD**                  | —                                                                                       | No direct dependency |

---

### Formulas

#### FOV Shift

```
FOV = baseFOV + speedFactor × speed_kmh

speedFactor: configurable constant, default 0.05 (degrees per km/h)
Result clamped to [FOV_min, FOV_max]
```

Cockpit: `baseFOV=75, FOV_min=65, FOV_max=85`
Chase: `baseFOV=60, FOV_min=52, FOV_max=68`

#### Camera Shake

Shake is a 3D positional offset applied to a shake `TransformNode` between the camera and its parent. Decays exponentially.

```
shakeOffset(t) = initialIntensity × e^(-decay × t) × randomUnitVector()

Where:
  initialIntensity = shakeIntensity (from event) + previouslyActiveShakes
  decay = configurable per shake type (higher = faster decay)
  randomUnitVector() = new random direction each frame
```

| Shake Type | Default Intensity | Default Decay | Duration (until < 5% intensity) |
| ---------- | ----------------- | ------------- | ------------------------------- |
| Kerb hit   | 0.03 units        | 6.0/s         | ~0.5s                           |
| Collision  | impulse × 0.001   | 4.0/s         | ~0.75s at impulse=1000          |
| Off-track  | 0.02 units        | 5.0/s         | ~0.6s                           |

All shake values are tuning knobs.

---

### States & Transitions

```
Inactive → Grid (on gsm.state.entered: PreRace)
Grid → Racing (on gsm.state.entered: Racing)
Racing → Drone (on gsm.state.entered: PostRace)
Drone → Inactive (on gsm.state.entered: Menu/Loading)
```

Within Racing state, the user toggle switches between sub-modes:

```
Racing.Cockpit ←toggle→ Racing.Chase
```

Transition to Racing preserves the player's last toggle choice (was cockpit → stays cockpit, was chase → stays chase).

---

### Edge Cases

| Edge Case                       | Handling                                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Toggle spam**                 | Debounced at Input level (200ms window). Camera never receives more than 1 toggle per window.                                                                                                                      |
| **Car destroyed (DNF)**         | Camera continues following the car normally. Fuel-empty DNF triggers only when car stops (velocity ≈ 0). Tire blowout does not trigger DNF — the car can still drive with reduced grip, camera continues normally. |
| **Car off-track**               | Off-track shake triggers briefly. Camera continues following normally — no special behaviour.                                                                                                                      |
| **Chase camera wall occlusion** | Raycast backward from car centre. If occluded, snap to closest unoccluded point along the ray.                                                                                                                     |
| **Very low speed**              | FOV widens to FOV_max. No special handling needed — the linear formula handles it.                                                                                                                                 |
| **Collision during kerb shake** | Shake effects stack additively and decay independently. Both shakes run simultaneously.                                                                                                                            |
| **Player disconnects mid-race** | Camera freezes at last position for 2s, then fades to black — Race Management detects disconnect and handles PostRace transition.                                                                                  |
| **PostRace skip**               | If player skips drone before 0.5s, camera snaps to Inactive for Results screen.                                                                                                                                    |
| **Loading state**               | Camera inactive. Loading screen is handled by Menu LITE.                                                                                                                                                           |

---

### Dependencies

| Dependency                  | Type     | Notes                                  |
| --------------------------- | -------- | -------------------------------------- |
| **GSM**                     | Upstream | Camera subscribes to state transitions |
| **Input**                   | Upstream | Receives `cameraToggle` pulse          |
| **Physics/Handling**        | Upstream | Consumes telemetry data                |
| **Collision**               | Upstream | Consumes `collision.impact`            |
| **Entity/Car Lifecycle**    | Upstream | Finds player car follow target         |
| **Babylon.js FollowCamera** | Engine   | Chase camera mode                      |
| **Babylon.js FreeCamera**   | Engine   | Cockpit camera mode                    |

---

### Tuning Knobs

All values in `camera.*` namespace, runtime-configurable via Data & Config Manager with HMR hot-reload.

| Knob                       | Default | Range      | Description                                                                              |
| -------------------------- | ------- | ---------- | ---------------------------------------------------------------------------------------- |
| `cockpit.fov`              | 75      | 50–100     | Cockpit base FOV (degrees)                                                               |
| `cockpit.fovMin`           | 65      | 40–90      | Cockpit FOV floor — minimum allowed FOV                                                  |
| `cockpit.fovMax`           | 85      | 60–120     | Cockpit FOV ceiling — maximum allowed FOV (applies at high speed, FOV widens with speed) |
| `chase.fov`                | 60      | 40–90      | Chase base FOV (degrees)                                                                 |
| `chase.fovMin`             | 52      | 35–80      | Chase FOV floor — minimum allowed FOV                                                    |
| `chase.fovMax`             | 68      | 45–95      | Chase FOV ceiling — maximum allowed FOV (applies at high speed, FOV widens with speed)   |
| `speedFactor`              | 0.05    | 0–0.2      | Degrees per km/h applied to base FOV                                                     |
| `chase.distance`           | 6       | 3–15       | Chase camera distance behind car (m)                                                     |
| `chase.height`             | 3       | 1–8        | Chase camera height above car (m)                                                        |
| `chase.offset`             | 0.5     | -2–2       | Chase lateral offset (m, + = right)                                                      |
| `chase.cameraAcceleration` | 0.005   | 0.001–0.05 | FollowCamera acceleration toward target (native API)                                     |
| `chase.maxCameraSpeed`     | 10      | 1–30       | FollowCamera max approach speed (higher = stiffer)                                       |
| `headBob.intensity`        | 0.02    | 0–0.1      | Head bob amplitude (units)                                                               |
| `headBob.frequency`        | 2.0     | 0–5        | Head bob oscillation frequency                                                           |
| `lean.intensity`           | 2.0     | 0–10       | Lateral lean amplitude (degrees)                                                         |
| `shake.kerbIntensity`      | 0.03    | 0–0.2      | Kerb hit shake amplitude (units)                                                         |
| `shake.kerbDecay`          | 6.0     | 1–20       | Kerb shake decay rate (per second)                                                       |
| `shake.collisionFactor`    | 0.001   | 0–0.01     | Impulse → shake amplitude multiplier                                                     |
| `shake.collisionDecay`     | 4.0     | 1–20       | Collision shake decay rate (per second)                                                  |
| `shake.offtrackIntensity`  | 0.02    | 0–0.2      | Off-track shake amplitude (units)                                                        |
| `shake.offtrackDecay`      | 5.0     | 1–20       | Off-track shake decay rate (per second)                                                  |
| `drone.distance`           | 8       | 4–20       | PostRace drone orbit distance (m)                                                        |
| `drone.speed`              | 15      | 5–45       | Drone orbit speed (°/s)                                                                  |
| `drone.skipDelay`          | 0.5     | 0–5        | Seconds before PostRace drone is skippable                                               |
| `drone.fov`                | 65      | 40–90      | Drone camera FOV (degrees)                                                               |

---

### Visual/Audio Requirements

**Visual:**

- Cockpit camera expects a `driver_eye` TransformNode in every car `.glb` asset
- Chase camera raycast uses track barrier collision layer; no special visual indicator
- Grid camera is a static Babylon.js camera — no UI overlay, just pure scene framing
- Drone camera uses `ArcRotateCamera` with no user input (orbit is automatic)

**Audio:**

- Camera has no direct audio output. Audio system listens to Physics/Collision events independently

---

### UI Requirements

None. Camera has no UI elements.

---

### Acceptance Criteria

1. Player starts Race with cockpit camera (default view)
2. Pressing camera toggle switches between cockpit and chase instantly (no lerp)
3. FOV narrows as car speeds up, widens as car slows — linear, visible within 2s of acceleration
4. Running over a kerb triggers a brief camera shake (< 1s, decays exponentially)
5. Collision triggers camera shake proportional to impact impulse, player car only
6. Driving off-track triggers brief camera shake
7. PreRace shows a static grid camera framing all cars on the starting line
8. PreRace grid camera is active until GSM transitions to Racing (via auto-skip or confirm)
9. PostRace transitions to a drone camera orbiting the player's car
10. PostRace drone camera is active until player presses confirm (results dismissed, GSM → Menu)
11. Chase camera does not clip through walls (snaps closer when occluded)
12. Cockpit camera correctly inherits car position/rotation via `driver_eye` node
13. Head bob and lateral lean are active in cockpit mode, configurable to zero
14. All 27 tuning knobs accept runtime changes via ConfigManager HMR
15. Camera toggle choice persists across GSM transitions (P→R→P: last toggle wins)
16. Head bob and lean are purely cosmetic — zero impact on car position, physics determinism is preserved
17. On fuel-empty DNF, camera continues following the coasting car during coast-to-stop. Drone activates on PostRace transition (gsm.state.entered: PostRace), not at exact stop moment — timing difference is < 1s. Tire blowout does not trigger DNF.

---

### Open Questions

- **Head bob and lean**: initial values are guesses. Will be calibrated during the first playtest session against the FW14B onboard reference footage.
- **Chase acceleration/maxSpeed**: `cameraAcceleration` = 0.005, `maxCameraSpeed` = 10 are starting points. These map to the FollowCamera's native acceleration-limited velocity model — not a spring/damper. If the camera feels too loose, increase both proportionally. Too rigid, decrease both.
- **Drone orbit speed**: 15°/s provides a full circle in ~24s. If PostRace feels too slow, increase. Too frantic, decrease.
- **Grid camera composition**: exact position/angle will be tuned once we have a track mesh placeholder. The GDD specifies intent — the concrete values will be set during scene assembly.
