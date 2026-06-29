# ADR-0006: Input Abstraction

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                                                                                                                                                                              |
| **Domain**                | Input                                                                                                                                                                                                          |
| **Knowledge Risk**        | MEDIUM — DeviceSourceManager gamepad detection (v9.11 Linux fix). Note: this risk applies to DSM device-type detection for HUD hints only — gamepad polling uses GamepadManager (native Gamepad API), not DSM. |
| **References Consulted**  | VERSION.md, `modules/input.md`, input.md GDD, architecture.md Module Ownership                                                                                                                                 |
| **Post-Cutoff APIs Used** | DeviceSourceManager (stable since v7.x, no breaking changes in 9.x)                                                                                                                                            |
| **Verification Required** | Gamepad hot-plug detection on Linux (DSM v9.11), gamepad disconnect zeros all outputs                                                                                                                          |

## ADR Dependencies

| Field             | Value                                                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Depends On**    | None — Input is the root of Core layer, slot #1 in pipeline                                                                                                                             |
| **Enables**       | ADR-0008 Vehicle Physics (consumes IInput), ADR-0007 Camera (receives cameraToggle)                                                                                                     |
| **Blocks**        | Physics/Handling implementation (slot #1 must exist before slot #2)                                                                                                                     |
| **Ordering Note** | Init slot #9 (Core slot #3 — after Entity/Car Lifecycle, before Camera). Pipeline slot #1 (first in fixed timestep pipeline). Must be created before Physics can register its update(). |

## Context

### Problem Statement

The player interacts with the game through keyboard and gamepad. Every system tick (60 Hz), Physics needs steering (-1..1), throttle (0..1), brake (0..1), and gear delta (-1/0/+1). The AI driver needs to produce the **same interface** so Physics never branches on player vs AI. Without a unified input abstraction, two problems emerge:

1. **Physics must know its caller**: if Input and AI Driver expose different APIs, Physics needs an `if (isPlayer)` check every tick — coupling Physics to game mode logic
2. **Device diversity**: keyboard is digital (on/off), gamepad is analog (0..1, -1..1). The abstraction must merge both into normalized ranges without losing feel

### Constraints

- Pipeline slot #1: Input must be ready before Physics slot #2 runs
- Polling per tick (not event-driven) — Physics needs the **current frame's** values, not the last event
- AI Driver must expose the same `IInput` interface — Physics calls one `getState()`, not `getPlayerInput()` vs `getAIInput()`
- Focus loss (tab blur) zeros all outputs immediately — no stuck keys
- Device switching mid-race must be seamless — no penalty, HUD hints update via `onDeviceChanged`

### Requirements

- `IInput.getState(): InputState` — readable every tick with zero allocation
- `InputState` contains: steer (-1..1), throttle (0..1), brake (0..1), gearDelta (-1/0/+1), confirm/pauseToggle/cameraToggle/cancel/navUp/navDown (all boolean pulses)
- Dead zone formula applied to analog inputs (configurable via `input.deadZone`)
- Camera toggle debounced at `input.cameraDebounce` ms
- Gamepad disconnect → gamepad axes zeroed immediately; keyboard remains active
- Tab blur → all outputs zeroed; tab focus → resume live hardware state

## Decision

### Architecture

```
Keyboard ──┐
            ├── DeviceSourceManager ──┐
Gamepad ───┘                          │
                                      ├── IInput.getState() ──► Pipeline slot #1
AI Driver ────────────────────────────┘
```

Input owns a `DeviceSourceManager` instance (keyboard) and a `GamepadManager` instance (gamepad). Every tick, `getState()` polls both and merges into a single `InputState`. If the last active device was keyboard, `onDeviceChanged` fires once; gamepad input switches it back.

The dead zone formula is applied to analog inputs:

```
output = |raw| < threshold ? 0 : sign(raw) × (|raw| - threshold) / (1 - threshold)
```

This preserves full range above the threshold — no sensitivity loss. A threshold of 0.0 disables the dead zone.

### Key Interfaces

```typescript
interface IInput {
  init(engine: Engine): void;
  dispose(): void;
  getState(): InputState;
  onDeviceChanged: Observable<"keyboard" | "gamepad">;
}

interface InputState {
  steer: number; // -1..1
  throttle: number; // 0..1
  brake: number; // 0..1
  gearDelta: -1 | 0 | 1;
  confirm: boolean;
  pauseToggle: boolean;
  cameraToggle: boolean;
  cancel: boolean;
  navUp: boolean;
  navDown: boolean;
}
```

### AI Driver Integration

AI Driver has its own dedicated pipeline slot #3 and produces `InputState` via `IAIDriver.tick()`. Physics reads from a double-buffered `Map<string, InputState>` — never branching on player vs AI origin. The `IInput` interface is for **player input only**; AI is a separate simulation system.

```
Pipeline:
  slot #1: IInput.getState()   → player Input (keyboard/gamepad)
  slot #2: Physics              → consumes inputBuffer (player OR AI)
  slot #3: IAIDriver.tick()    → writes to inputBuffer for next tick
```

This separation keeps Input purely about hardware abstraction and AI purely about simulation — no shared code, no `instanceof` checks.

### Polling Detail

```
getState() → per-tick:
  1. If tab is blurred → return all-zeros (cached until focus returns)
  2. Read keyboard DSM: WASD → steer binary (-1/0/+1), throttle binary (0/1), brake binary
  3. Read gamepad: leftStick.x → steer (after dead zone), rightTrigger → throttle, leftTrigger → brake
  4. Gamepad takes priority when both are active (analog override)
  5. Apply dead zone to all analog inputs
  6. Detect pulse edges for digital buttons (confirm, pause, etc.)
  7. Return InputState
```

### Focus Loss Handling

`window.blur`/`focus` fires when the window loses OS-level focus. However, switching tabs without changing OS focus (multi-monitor) does not fire `blur` reliably. Using `document.visibilitychange` alongside blur provides complete coverage:

```typescript
// Tab blur detection
window.addEventListener("blur", () => {
  input.hidden = true;
});
window.addEventListener("focus", () => {
  input.hidden = false;
});

// Tab visibility detection (covers alt-tab, tab switch, multi-monitor)
document.addEventListener("visibilitychange", () => {
  input.hidden = document.hidden;
});
```

When `blurred === true`, `getState()` returns all-zeros. On focus return, the next `getState()` reads live hardware values — no replay of missed inputs. This prevents stuck keys when the player alt-tabs mid-corner.

### Gamepad State Management

```typescript
gamepadManager.onGamepadConnectedObservable.add((gp) => {
  input.activeGamepad = gp;
  input.onDeviceChanged.notifyObservers("gamepad");
});

gamepadManager.onGamepadDisconnectedObservable.add(() => {
  input.activeGamepad = null;
  // gamepad axes already zero in getState() since activeGamepad is null
  // keyboard still works
});
```

### GSM Transition Blocking

During GSM state transitions (e.g., Menu → PreRace, Racing → PostRace), input
must be blocked to prevent stale inputs from carrying across state boundaries.
The Input system subscribes to GSM events:

```typescript
// Subscribed during Input.init():
eventBus.on("gsm.state.exited", (prevState) => {
  // Transition started — zero outputs immediately
  input.transitionBlocking = true;
});

eventBus.on("gsm.state.entered", (nextState) => {
  // Transition complete — resume live input
  input.transitionBlocking = false;
  input.hardwareCache = null; // flush stale cached values
});
```

The `getState()` method is extended to check the blocking flag:

```typescript
getState(): InputState {
  // 0. GSM transition blocking overrides everything
  if (input.transitionBlocking) return InputState.ZERO;

  // 1. If tab is blurred → return all-zeros (cached until focus returns)
  // ... (remainder of polling unchanged)
}
```

**Why blocking is needed**:

- Menu → PreRace: the player may press a menu button whose digital pulse
  persists into PreRace, causing an unintended action (e.g. pause trigger)
- Racing → PostRace: the player may hold throttle/steer at the finish line;
  these values would carry into the results screen
- PostRace → Menu: any input pulse during the results screen should not
  trigger a menu action

**Transition window characterization**:

- `gsm.state.exited` and `gsm.state.entered` fire in the same tick for
  instantaneous transitions (Menu → PreRace requires asset loading, which
  happens between the two events — blocking covers the async gap)
- Max transition window: bounded by asset loading + GSM handler — typically
  < 50ms for state-only transitions, up to 3s for asset-heavy transitions
  (track load). During this window, `getState()` returns all-zeros,
  which prevents stale hardware reads and stuck pulses.

## Alternatives Considered

### Alternative 1: Babylon Observables (event-driven)

- **Description**: Subscribe to `scene.onKeyboardObservable` and `gamepad.onButtonDownObservable`. Cache last known value per key/axis. Physics reads cache each tick.
- **Pros**: Zero polling overhead when no input, reactive paradigm
- **Cons**: Gamepad analog sticks have no "event" — you poll them anyway. Keyboard events fire mid-frame, not at tick boundary — Physics sees stale values for up to 16ms. AI Driver needs a separate code path. **Híbrido inconsistente**: parte polling, parte evento, parte observable.
- **Rejection Reason**: Inconsistent hybrid. Physics must trust the tick's input values. Event-driven introduces non-determinism in the pipeline timing.

### Alternative 2: Raw DOM Events

- **Description**: `window.addEventListener('keydown'/'keyup')` + `navigator.getGamepads()`. Zero Babylon imports.
- **Pros**: Foundation-compatible (zero engine imports), full control
- **Cons**: Loses DeviceSourceManager device detection (DSM v9.11 Linux fix), GamepadManager connection/disconnection observables, pointer/touch for menu. Reimplements what the engine already provides.
- **Rejection Reason**: Reimplementing DSM is wasted effort. The engine's input layer already handles cross-browser gamepad quirks — using raw DOM means fixing those ourselves.

## Consequences

### Positive

- Physics slot #2 calls `getState()` — never branches on player vs AI
- Same `IInput` interface enables AI to participate in the same pipeline, same dead zone, same range conventions
- DeviceSourceManager handles cross-browser keyboard and gamepad differences
- Focus loss is a single flag — guaranteed zero-output during blur
- Gamepad disconnect is safe — null check in `getState()` returns zeroed axes

### Negative

- Input imports `@babylonjs/core` submodules (DeviceSourceManager, GamepadManager) — cannot live in Foundation layer
  - Import paths must be tree-shakeable: `@babylonjs/core/DeviceInput/InputDevices/deviceSourceManager` and `@babylonjs/core/Gamepads/gamepadManager`
- One additional function call per tick (IInput → getState) — negligible (<0.001ms)
- AI Driver must implement the same interface — adds no-op methods (init/dispose/onDeviceChanged) to satisfy TypeScript

### Risks

- **Risk**: GamepadManager onGamepadDisconnectedObservable fires late (after stale axis values)
  **Mitigation**: Cache last activeGamepad. On disconnect, immediately set to null. The tick's getState() sees null and returns zeroed axes.
- **Risk**: Camera's built-in gamepad input (v9.8 Camera Input Mapping System) double-reads same axes
  **Mitigation**: ADR-0007 Camera must explicitly disable its built-in gamepad input via `camera.inputs.clear()`. The only gamepad readings must come from ADR-0006's GamepadManager.
- **Risk**: DSM v9.11 Linux detection edge cases for niche controllers
  **Mitigation**: DSM is used only for keyboard and device-type detection (HUD hints). Gamepad polling uses GamepadManager (native Gamepad API), which does not have the DSM Linux detection issue.

## GDD Requirements Addressed

| GDD System   | Requirement                                | How This ADR Addresses It                      |
| ------------ | ------------------------------------------ | ---------------------------------------------- |
| input.md     | Analog steer/throttle/brake with dead zone | Dead zone formula + getState() polling         |
| input.md     | Digital gear pulses                        | `gearDelta` field, one shift per tick max      |
| input.md     | Focus loss zeros all outputs               | `blurred` flag check in getState()             |
| input.md     | Device switching updates UI hints          | `onDeviceChanged` observable                   |
| input.md     | Camera toggle debounce                     | `input.cameraDebounce` threshold in getState() |
| input.md     | Pause toggle routes to GSM                 | `pauseToggle` pulse in InputState              |
| ai-driver.md | AI exposes same IInput interface           | AIDriverInput implements IInput                |

## Performance Implications

- **CPU**: One poll per tick with 3 float reads (steer, throttle, brake) + 3 boolean reads (gear up/down, camera) + dead zone arithmetic = <0.005ms per frame
- **Memory**: One InputState struct (32 bytes) + one DeviceSourceManager (shared, ~500 bytes) + one GamepadManager (~200 bytes) = ~732 bytes total
- **Load Time**: DSM constructor is synchronous — zero load time impact

## Validation Criteria

- [ ] `getState()` returns correct steer range (-1..1) for full left stick deflection
- [ ] Dead zone snaps values below `input.deadZone` to zero; above threshold preserves full range
- [ ] Tab blur → getState() returns all-zeros; tab focus → returns live values next frame
- [ ] Gamepad disconnect → steer/throttle/brake read as 0 while keyboard still works
- [ ] Camera toggle fires at most once per 200ms (configurable via input.cameraDebounce)
- [x] AIDriverInput.getState() returns same shape as PlayerInput.getState() (implemented via ADR-0013 pipeline buffer)
- [ ] Gear delta produces +1 exactly once per gear-up press (not held)
- [ ] Keyboard WASD produces binary steer (-1/0/+1) and binary throttle/brake (0/1)
- [ ] `onDeviceChanged` fires on keyboard input (if last was gamepad) and vice versa

## Related Decisions

- ADR-0002 (Fixed Timestep Pipeline — Input is slot #1)
- ADR-0004 (Module Boundaries — Input is Core, not Foundation)
- ADR-0005 (Entity/Car Lifecycle — deferred via entity.spawned for AI Driver binding)
