# ADR-0019: Menu LITE

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                                                                       |
| **Domain**                | Presentation — Menu / UI screens                                                                        |
| **Knowledge Risk**        | MEDIUM — Babylon.js GUI (screen stack, render targets for car thumbnails, input routing)                |
| **References Consulted**  | menu-lite.md GDD, babylonjs-gui specialist review, ADR-0006 (Input), ADR-0003 (Two-Scene/Asset Loading) |
| **Post-Cutoff APIs Used** | None                                                                                                    |

## ADR Dependencies

| Field          | Value                                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Depends On** | ADR-0006 (Input — `confirm`, `cancel`, `navUp`/`navDown` via `IInput.getState()`), ADR-0003 (Two-Scene — `LoadAssetContainerAsync` for loading screen), ADR-0018 (HUD — GUI pattern consistency) |
| **Enables**    | Title, Car Select, Track Select, Race Settings, Loading, Results screens                                                                                                                         |
| **Blocks**     | None                                                                                                                                                                                             |

## Context

### Problem Statement

The player needs pre-race and post-race screens to navigate from game launch to a race and back. In Phase 1 (MVP), the menu is purely 2D GUI — no 3D paddock, no navigable garage, no dialogue. The menu must be simple, responsive, and support keyboard + gamepad input.

### Constraints

- All screens are Babylon.js GUI (AdvancedDynamicTexture) — no HTML/CSS overlay
- Screen stack: one screen active at a time. No overlapping dialogs in Phase 1
- Instant transitions — no fade, no slide between screens
- GSM integration via Event Bus subscription (local copy of GSM state)
- Input via `IInput` pipeline (ADR-0006) — not raw keyboard/gamepad events
- Car thumbnails captured once at init, never re-rendered at runtime
- Load screen waits minimum 0.5s or until assets ready, whichever is longer (skip entirely if loading < 0.5s)

## Decision

### Architecture

```
MenuLITE (manages screen stack, pre-creates all controls at init)
  ├── AdvancedDynamicTexture (idealHeight=1080)
  │     ├── TitleScreen (Container)       — logo + "Press ENTER"
  │     ├── CarSelectScreen (Container)   — 8 team cards in Grid
  │     ├── TrackSelectScreen (Container) — 4 track cards
  │     ├── RaceSettingsScreen (Container) — lap count + difficulty selectors
  │     ├── LoadingScreen (Container)     — track name + tip + timer
  │     └── ResultsScreen (Container)     — position, time, rival reaction
  │
  └── InputConsumer (reads from IInput.getState() each frame)
        └── confirm / cancel / navUp / navDown / navLeft / navRight
```

### Screen Stack

Screens are pre-created at init (all controls allocated once). Navigation pushes/pops by toggling `isVisible`:

```typescript
class MenuLite {
  private screens: Map<MenuScreen, Container>;
  private stack: MenuScreen[] = [];
  private current: MenuScreen | null = null;

  push(screen: MenuScreen): void {
    if (this.current) {
      this.screens.get(this.current)!.isVisible = false;
    }
    this.stack.push(screen);
    this.current = screen;
    this.screens.get(screen)!.isVisible = true;
  }

  pop(): void {
    if (this.stack.length <= 1) return; // never pop Title
    this.screens.get(this.current)!.isVisible = false;
    this.stack.pop();
    this.current = this.stack[this.stack.length - 1];
    this.screens.get(this.current)!.isVisible = true;
  }
}
```

**Why pre-create**: `addControl()` triggers layout recompute (measure + arrange). Doing this on every push would repeatedly pay that cost. 6 screens × ~50 controls each = ~300 controls at ~600KB. Negligible memory, zero runtime allocation during navigation.

### Screen Flow

```
Title ──ENTER──▶ Car Select ──CONFIRM──▶ Track Select ──CONFIRM──▶ Race Settings ──CONFIRM──▶ Loading ──LOADED──▶ [Race starts]
   ▲                  ▲                     │                          │                                            │
   │                  │                     │ ESC                      │ ESC                                        │
   │                  │                     ▼                          ▼                                            │
   │                  └───────────────── Track Select ◀────────── Race Settings                                     │
   │                                                                                                                │
   └───── "Main Menu" ──── Results ◀─────── [Race ends] ──────────────────────────────────────────────────────────┘
                                │
                                └─── "Race Again" ──▶ GSM transition('PreRace') (preserves selections)
```

Each screen maps to a GSM substate. Menu LITE is active when GSM is in `Menu` or `PostRace`. Transitions:

- ESC on Title: ignored (no accidental exit)
- Back button disable logic: Confirm is disabled until a selection is made
- "Race Again": preserves car, track, settings — only resets race state

### Input Routing

Menu LITE reads from `IInput.getState()` (ADR-0006), NOT from Babylon.js scene keyboard observables or raw DeviceSourceManager calls:

```typescript
// Called each frame during menu state
update(inputState: InputState): void {
  if (inputState.confirm && this.currentScreen !== 'loading') {
    this.onConfirm();
    inputState.confirm = false; // consume pulse
  }
  if (inputState.cancel && this.currentScreen === 'title') {
    return; // ESC on Title: ignored
  }
  if (inputState.cancel) {
    this.onCancel();
    inputState.cancel = false;
  }
  // Navigation
  if (inputState.navUp)    { this.navigate(-1, 0); inputState.navUp = false; }
  if (inputState.navDown)  { this.navigate(1, 0);  inputState.navDown = false; }
  if (inputState.navLeft)  { this.navigate(0, -1); inputState.navLeft = false; }
  if (inputState.navRight) { this.navigate(0, 1);  inputState.navRight = false; }
}
```

**Rationale**: ADR-0006 already defines `confirm`, `cancel`, `navUp`/`navDown` in `InputState`. These are the exact fields Menu LITE needs. Reading raw keyboard events from `scene.onKeyboardObservable` risks duplicate handling when the GUI has focus. Gamepad D-pad (`GamepadButton.DPadUp/Down/Left/Right`) is already mapped by the Input system.

### Instant Screen Transitions

Setting `containerA.isVisible = false` then `containerB.isVisible = true` in the same JavaScript execution context is **truly instant**. Babylon.js GUI does not use incremental rendering or alpha interpolation on visibility changes. The `isVisible = false` flag is checked during the next render pass — both operations complete before the render loop reads state. The GPU never sees a frame with the wrong screen.

### Car Thumbnails

Each team car thumbnail is captured once at init using a dedicated `RenderTargetTexture` with transparent background:

```typescript
async function captureCarThumbnail(
  carMesh: AbstractMesh,
  scene: Scene,
  size = 256
): Promise<string> {
  const savedClear = scene.clearColor.clone();
  const savedCam = scene.activeCamera;
  const savedEnv = scene.environmentTexture;

  // Dedicated camera
  const cam = new ArcRotateCamera(
    "thumbCam",
    -Math.PI / 4,
    Math.PI / 3,
    5,
    carMesh.getBoundingInfo().boundingSphere.center,
    scene
  );

  // Isolate mesh, transparent background, no environment
  carMesh.setEnabled(true);
  scene.clearColor = new Color4(0, 0, 0, 0);
  scene.environmentTexture = null;

  // Capture
  const dataUrl = await CreateScreenshotUsingRenderTargetAsync(
    scene.getEngine(),
    cam,
    { width: size, height: size }
  );

  // Restore
  scene.clearColor = savedClear;
  scene.environmentTexture = savedEnv;
  scene.activeCamera = savedCam;
  cam.dispose();
  carMesh.setEnabled(false);

  return dataUrl; // used as Image.source in GUI
}
```

8 renders × ~1-2ms = 8-16ms total at init. Cached as data URL, never re-rendered. If the base mesh uses the same geometry across teams (only material differs), the capture runs after applying each team's material.

### Asset Loading (Loading Screen)

The Loading screen waits for two conditions:

```typescript
interface LoadingState {
  minTimeElapsed: boolean; // 2s minimum display
  allAssetsLoaded: boolean; // all requested LoadAssetContainerAsync Promises resolved
}

function startLoading(assets: Promise<void>[]): void {
  const startTime = performance.now();

  // Minimum timer (2s)
  setTimeout(() => {
    loadingState.minTimeElapsed = true;
    tryTransition();
  }, 2000);

  // Assets completion (tracking per-Promise)
  Promise.all(assets).then(() => {
    loadingState.allAssetsLoaded = true;
    tryTransition();
  });

  // Safety net at 10s
  setTimeout(() => {
    if (!loadingState.allAssetsLoaded) {
      showStillLoadingIndicator();
    }
  }, 10000);
}

function tryTransition(): void {
  if (loadingState.minTimeElapsed && loadingState.allAssetsLoaded) {
    gsm.requestTransition("PreRace");
  }
}
```

**Why Promise-based instead of AssetsManager**: ADR-0003 mandates `LoadAssetContainerAsync` for asset loading (not the older `AssetsManager` class). `LoadAssetContainerAsync` returns a Promise, so the loading screen tracks per-Promise resolution. There is no unified progress bar in Phase 1 — only a binary "all loaded" flag.

### Count-Up Animation (Results Screen)

The finish position number counts up from 1 to the final position over ~0.5s:

```typescript
async function countUpAnimation(finalPosition: number): Promise<void> {
  const steps = Math.max(finalPosition, 1);
  const intervalMs = Math.min(500 / steps, 100);

  for (let i = 0; i < steps; i++) {
    await delay(intervalMs);
    positionTextBlock.text = `P${i + 1}`;
  }
  positionTextBlock.text = `P${finalPosition}`;
}
```

10-15 `textBlock.text` updates over 500ms is trivially performant — each update is an O(1) string assignment + dirty-flag set. This is a one-shot post-race animation, not part of the game loop. `setTimeout`-based timing is acceptable (discrepancy with frame timing is imperceptible for a one-shot).

**Why not HudAnimator**: `HudAnimator` (ADR-0018) is designed for continuous property tweens (scale, alpha, rotation). A discretely changing text string is not a good fit. Inline async/await is simpler and correct.

### GSM Integration

Menu LITE subscribes to Event Bus for GSM state transitions:

| Event                            | Reaction                                         |
| -------------------------------- | ------------------------------------------------ |
| `gsm.state.entered(to=Menu)`     | Push Title screen                                |
| `gsm.state.entered(to=Racing)`   | Menu LITE deactivates (handled by GSM lifecycle) |
| `gsm.state.entered(to=PostRace)` | Push Results screen                              |
| `gsm.state.entered(to=PreRace)`  | Menu LITE deactivates                            |

GSM maintains a flat state machine. Menu LITE reads GSM state events to know when to show/hide. It does NOT call `gsm.getCurrent()` (per ADR-0004 Core Rule — systems subscribe to events, not poll GSM).

### RaceConfiguration Emission

When the player confirms Race Settings, Menu LITE emits a `RaceConfiguration` to the Single Race system:

```typescript
interface RaceConfiguration {
  trackId: string;
  lapCount: number; // 1–20, default 5
  gridSize: number; // default 8
  playerCarId: string; // selected team ID
  difficulty: number; // 0.75 / 0.875 / 1.0 / 1.125 / 1.25
  seed: number; // Date.now() — unique per race
  aiDrivers: AIDriverConfig[];
}
```

This is passed to Single Race, which forwards to Race Management.

## Alternatives Considered

| Concern            | Alternative                                                    | Why Rejected                                                                                                 |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Screen lifecycle   | Create controls on push, destroy on pop                        | `addControl` layout recompute per push; GC pressure from 50 controls × 5 transitions. Pre-create is cheaper. |
| Input              | Babylon.js keyboard observables (`scene.onKeyboardObservable`) | Risk of duplicate handling with GUI focus. ADR-0006 already defines menu actions.                            |
| Car thumbnail      | Procedurally drawn placeholder (colored rectangle)             | Not immersive. RTT with transparent background is the standard Babylon.js approach and is confirmed working. |
| Asset loading      | `AssetsManager` with `onFinishObservable`                      | ADR-0003 mandates `LoadAssetContainerAsync`. Promise-based tracking is consistent.                           |
| Count-up animation | `HudAnimator` from ADR-0018                                    | HudAnimator is for continuous property tweens. One-shot text animation is simpler with inline async.         |

## Consequences

### Positive

- Pre-created controls mean zero runtime allocation during screen navigation
- Input via `IInput` pipeline is consistent with gameplay input — no special input handling for menus
- Transitions are truly instant (zero frames of wrong state) per Babylon.js GUI guarantees
- Car thumbnails are rendered once with transparent background and cached forever
- Loading screen timer + Promise tracking works with ADR-0003's asset loading pattern
- Screen stack gives natural back navigation semantics

### Negative

- 300 GUI controls pre-created at init (~600KB) — negligible but slightly more memory than lazy creation
- Car thumbnail RTT adds 8-16ms to init time — acceptable one-time cost
- No progress bar on loading screen (Phase 1) — player sees a static screen for minimum 0.5s

### Risks

- **Risk**: `CreateScreenshotUsingRenderTargetAsync` with transparent clear color doesn't produce alpha in WebGPU mode
  **Mitigation**: Fallback to manual `RenderTargetTexture` with `readPixels()` and manual PNG generation
- **Risk**: `setTimeout` for loading timer and count-up animation drifts from fixed timestep
  **Mitigation**: These are menu-only operations, not gameplay. Timer drift is imperceptible
- **Risk**: "Race Again" preserves selections but GSM transition resets some state
  **Mitigation**: Menu LITE holds the `RaceConfiguration` in memory and re-emits it on next race start

## GDD Requirements Addressed

| GDD Requirement                          | How This ADR Addresses It                                           |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Screen stack (push/pop)                  | `MenuLite.push()` / `pop()`. Pre-created controls toggle visibility |
| Instant transitions                      | `isVisible` swap in same JS frame — truly zero-frame                |
| GSM integration                          | Event Bus subscription, local state copy                            |
| Input via `IInput`                       | `confirm`, `cancel`, `navUp`/`navDown` from ADR-0006 pipeline       |
| Car thumbnail (BeautyContour)            | RTT with `clearColor = Color4(0,0,0,0)` + dedicated camera          |
| Asset loading (min 0.5s, skip if faster) | `performance.now()` delta + `Promise.all(containers)`               |
| Count-up animation                       | Inline async/await, 10-15 `textBlock.text` updates                  |
| "Race Again" preserves selections        | `RaceConfiguration` held in memory                                  |

## Performance Implications

- **Init**: ~8-16ms for 8 car thumbnails, ~1ms for 300 GUI controls creation
- **Per frame (inactive)**: 0ms — controls exist but are invisible, Babylon.js skips them in the draw list
- **Per frame (active)**: ~0.1-0.3ms for a screen with 50 controls (Grid + Text + Image)
- **Memory**: ~600KB for controls + ~1MB for 8 thumbnail data URLs = ~1.6MB total
- **Loading screen timer**: Two `setTimeout` calls (2s + 10s). No per-frame overhead

## Validation Criteria

- [ ] `push(Title)` → Title visible, all other screens invisible
- [ ] `push(CarSelect)` → Title hidden, CarSelect visible (no intermediate frame)
- [ ] ESC on Title does nothing
- [ ] `pop()` returns to previous screen with state preserved
- [ ] Car thumbnail RTT produces transparent-background PNG
- [ ] Loading screen transitions to PreRace only after 2s + all assets loaded
- [ ] Loading screen shows "Still loading..." indicator after 10s
- [ ] Results screen count-up animation plays correctly
- [ ] "Race Again" re-emits same `RaceConfiguration` (except seed)
- [ ] "Main Menu" returns to Title
- [ ] Input: menu navigation via keyboard arrows AND gamepad D-pad
- [ ] Input: confirm via ENTER AND gamepad A button
- [ ] Input: cancel via ESC AND gamepad B button

## Related Decisions

- ADR-0006 (Input — `IInput.getState()` with `confirm`/`cancel`/`navUp`/`navDown`)
- ADR-0003 (Two-Scene — `LoadAssetContainerAsync` for loading screen assets)
- ADR-0018 (HUD — same control lifecycle pattern, `idealHeight=1080`)
- ADR-0015 (Race Management — `RaceConfiguration` format)

## Open Questions

- **Car thumbnail render in WebGPU**: If `CreateScreenshotUsingRenderTargetAsync` doesn't preserve alpha in WebGPU mode, fallback to manual `RenderTargetTexture.readPixels()` + `canvas.toBlob()` PNG generation.
- **Rival reaction text pool**: Phase 1 uses 2 variants per personality (win/non-win) + 1 DNF variant. Expanded in Alpha.
