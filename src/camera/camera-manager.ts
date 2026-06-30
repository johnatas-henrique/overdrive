/**
 * @fileoverview CameraManager — owns the 4 camera instances and mode switching.
 *
 * **Lifecycle:**
 * ```text
 * constructor(scene) → init(_scene, carId) → [setActiveMode | toggleCockpitChase |
 *   setSpeedData | addShake | update(dt)] → dispose()
 * ```
 *
 * **Architecture:**
 * - 4 camera instances created on init: FreeCamera (grid), FreeCamera (cockpit),
 *   FollowCamera (chase), ArcRotateCamera (drone).
 * - All cameras have `camera.inputs.clear()` + `inertia = 0` (C17).
 * - Only one camera is `scene.activeCamera` per frame; others are dormant.
 * - Camera is purely reactive — never initiates GSM transitions (C-F7).
 *
 * @see ADR-0007 — Camera Architecture
 * @see Control Manifest C17, C19, C-F7
 * @see Story 001 — Camera Foundation
 */

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { FollowCamera } from "@babylonjs/core/Cameras/followCamera";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { IEventBus, Subscription } from "@/foundation/event-bus/types";
import { defined } from "@/shared/assert-defined";
import { createDefaultCameraConfig } from "./camera-defaults";
import {
  type CameraConfig,
  CameraError,
  CameraMode,
  type ICameraManager,
  type ShakeType,
} from "./types";

// ---------------------------------------------------------------------------
// Reader interfaces (dependency inversion — entity system provides these)
// ---------------------------------------------------------------------------

/**
 * Provides grid camera positioning data at runtime.
 *
 * The grid camera needs track center and car positions to frame the grid.
 * Since car positions come from the entity system (not available at camera
 * init time), this reader function pattern inverts the dependency.
 *
 * @see Story 002 — Grid camera positioning (AC-7)
 */
export interface GridCameraReader {
  /** Track center position in world space. */
  getTrackCenter(): Vector3;
  /** World position of the first car on the grid. */
  getFirstCarPosition(): Vector3;
  /** World position of the last car on the grid. */
  getLastCarPosition(): Vector3;
}

/**
 * Provides the player car mesh for FollowCamera targeting.
 *
 * @see Story 002 — Chase camera configuration
 */
export interface ChaseCameraReader {
  /** Returns the player car's AbstractMesh, or null if not yet spawned. */
  getPlayerCarMesh(): unknown;
}

/**
 * CameraManager implementation.
 *
 * Constructed with a Babylon.js Scene reference, then initialised via
 * `init()` which creates all 4 camera instances. After init, external
 * systems call `setActiveMode()` to switch the active camera, and
 * `update(dt)` each tick for FOV shift, shake decay, etc.
 *
 * **Ownership:** CameraManager owns its 4 camera instances and their
 * dispose lifecycle. It does NOT own the Scene.
 */
export class CameraManager implements ICameraManager {
  /** The Babylon.js Scene where cameras are created. */
  private _scene: Scene;

  /** Camera configuration with all 25 tuning knobs. */
  private _config: CameraConfig;

  /** Current active camera mode. */
  private _currentMode: CameraMode = CameraMode.Inactive;

  // ── Camera instances (created in init) ───────────────────────────
  /** Grid camera (FreeCamera) — frames the starting grid from above. */
  private _gridCam: FreeCamera | null = null;
  /** Cockpit camera (FreeCamera) — parented to driver_eye. */
  private _cockpitCam: FreeCamera | null = null;
  /** Chase camera (FollowCamera) — elastic follow behind the car. */
  private _chaseCam: FollowCamera | null = null;
  /** Drone camera (ArcRotateCamera) — auto-orbits the car. */
  private _droneCam: ArcRotateCamera | null = null;

  // ── GSM lifecycle (Story 002) ────────────────────────────────────
  /** EventBus for GSM state subscriptions. */
  private _eventBus: IEventBus | null = null;
  /** Active EventBus subscriptions — cleaned up in dispose(). */
  private _subscriptions: Subscription[] = [];
  /** Player's last toggle choice — restored on Racing entry. */
  private _lastToggleChoice: CameraMode.Cockpit | CameraMode.Chase | null =
    null;
  /** Reader for grid camera positioning (track center + car positions). */
  private _gridReader: GridCameraReader | null = null;
  /** Reader for chase camera target (player car mesh). */
  private _chaseReader: ChaseCameraReader | null = null;

  /** Reference to the player car AbstractMesh for occlusion ray origins (Story 004). */
  private _playerCarMesh: AbstractMesh | null = null;

  /** True when the chase camera is occluded and snapped closer than the configured distance. */
  private _occlusionActive = false;

  /**
   * Shake transform node — sits between driver_eye and the cockpit camera.
   *
   * Created by `attachCockpitToCar()`. The cockpit camera is parented to
   * this node so that shake effects can offset the camera position without
   * affecting the driver_eye transform (Story 007).
   *
   * Car lifecycle may dispose this node before CameraManager.dispose()
   * is called (AC-17 DNF coasting), so dispose() checks isDisposed().
   */
  private _shakeNode: TransformNode | null = null;

  /**
   * @param scene    — The Babylon.js Scene to create cameras in.
   * @param eventBus — Optional EventBus for GSM lifecycle subscription.
   *                   If provided, CameraManager subscribes to
   *                   `gsm.state.entered` and switches cameras automatically.
   */
  constructor(scene: Scene, eventBus?: IEventBus | null) {
    this._scene = scene;
    this._config = createDefaultCameraConfig();
    this._eventBus = eventBus ?? null;
  }

  /**
   * The active camera configuration.
   *
   * Exposed for Dev Tools / debug access. Live config changes are
   * applied via ConfigManager HMR (Story 010). Read-only from the
   * public API — mutate through the ConfigManager namespace.
   */
  get config(): Readonly<CameraConfig> {
    return this._config;
  }

  // ------------------------------------------------------------------
  // Reader injection (dependency inversion)
  // ------------------------------------------------------------------

  /**
   * Set the grid camera reader for dynamic positioning.
   *
   * The grid camera needs track center and car positions to frame the grid.
   * This reader is called each time the Grid camera is activated.
   *
   * @param reader — Provides track center and car positions at runtime
   * @see Story 002 — AC-7 grid camera positioning
   */
  setGridCameraReader(reader: GridCameraReader): void {
    this._gridReader = reader;
  }

  /**
   * Set the chase camera reader for FollowCamera targeting.
   *
   * @param reader — Provides the player car mesh at runtime
   */
  setChaseCameraReader(reader: ChaseCameraReader): void {
    this._chaseReader = reader;
  }

  /**
   * The shake TransformNode, or null if not yet created.
   *
   * This node sits between driver_eye and the cockpit camera. Shake
   * effects (Story 007) offset this node's position to create camera
   * shake without affecting the driver_eye transform.
   *
   * @see Story 007 — Shake system
   */
  get shakeNode(): TransformNode | null {
    return this._shakeNode;
  }

  /**
   * Parent the cockpit camera to the player car's driver_eye node.
   *
   * Creates a shake TransformNode as an intermediate parent so that
   * shake effects (Story 007) can offset the camera position without
   * affecting the driver_eye or car transforms.
   *
   * **Parent chain after this call:**
   * ```text
   * carMesh (AbstractMesh)
   *   └── driver_eye (TransformNode)
   *        └── cockpitShakeNode (TransformNode)  ← created here
   *             └── cockpitCam (FreeCamera)       ← parented here
   * ```
   *
   * @param carMesh — The player car mesh containing a `driver_eye` child
   * @throws {CameraError} If `driver_eye` child transform is not found
   * @throws {Error} If `_cockpitCam` is null (init not called)
   *
   * @see AC-12 — Cockpit camera inherits car position via driver_eye
   * @see Story 003 — Cockpit Camera
   */
  attachCockpitToCar(carMesh: AbstractMesh): void {
    defined(this._cockpitCam, "CameraManager: cockpitCam not initialised");

    // getChildTransformNodes returns all descendant TransformNodes.
    // Babylon.js 9.13 has only getChildTransformNodes (plural), not the singular form.
    const driverEye = carMesh
      .getChildTransformNodes(true)
      .find((node) => node.name === "driver_eye");
    if (!driverEye) {
      throw new CameraError(
        "attachCockpitToCar: driver_eye transform not found on car mesh"
      );
    }

    // Create shake node as intermediary for shake effects
    this._shakeNode = new TransformNode("cockpitShakeNode", this._scene);
    this._shakeNode.parent = driverEye;

    // Parent cockpit camera to shake node at zero local offset
    this._cockpitCam.parent = this._shakeNode;
    this._cockpitCam.position = Vector3.Zero();
  }

  // ------------------------------------------------------------------
  // ICameraManager implementation
  // ------------------------------------------------------------------

  /**
   * Create all 4 camera instances and apply C17 input cleanup.
   *
   * Cameras are created but NONE is active yet — call `setActiveMode()`
   * after init to activate the first camera. The `_scene` parameter is
   * accepted for interface compatibility (scene was set in constructor).
   *
   * @param _scene       — Unused; scene was injected via constructor
   * @param _playerCarId — Player entity ID (stored for later stories)
   */
  init(_scene: Scene, _playerCarId: string): void {
    this._createCameras();
    this._applyInputCleanup();
    this._currentMode = CameraMode.Inactive;
    this._scene.activeCamera = null;
    this._subscribeToEvents();
  }

  /**
   * Switch `scene.activeCamera` to the camera for `mode`.
   *
   * Only one camera is active per frame. The previous active camera
   * remains in the scene's camera list but is dormant. Invalid or
   * unrecognised mode values are silently ignored (no throw).
   *
   * @param mode — Target CameraMode to activate
   */
  setActiveMode(mode: CameraMode): void {
    this._currentMode = mode;

    switch (mode) {
      case CameraMode.Inactive:
        this._scene.activeCamera = null;
        break;
      case CameraMode.Grid: {
        defined(this._gridCam, "CameraManager: gridCam not initialised");
        this._positionGridCamera();
        this._scene.activeCamera = this._gridCam;
        break;
      }
      case CameraMode.Cockpit: {
        defined(this._cockpitCam, "CameraManager: cockpitCam not initialised");
        this._scene.activeCamera = this._cockpitCam;
        break;
      }
      case CameraMode.Chase: {
        defined(this._chaseCam, "CameraManager: chaseCam not initialised");
        this._wireChaseCameraTarget();
        this._scene.activeCamera = this._chaseCam;
        break;
      }
      case CameraMode.Drone: {
        defined(this._droneCam, "CameraManager: droneCam not initialised");
        this._scene.activeCamera = this._droneCam;
        break;
      }
      // default: invalid mode — silently ignore (F6)
    }
  }

  /**
   * Toggle between Cockpit and Chase modes.
   *
   * If currently in Cockpit, switches to Chase and vice versa.
   * If neither is active, defaults to Cockpit.
   *
   * @see Story 005 — Full toggle implementation with cameraToggle pulse
   * @see TR-CAM-002 — Instant toggle (no lerp)
   */
  toggleCockpitChase(): void {
    if (this._currentMode === CameraMode.Cockpit) {
      this.setActiveMode(CameraMode.Chase);
      this._lastToggleChoice = CameraMode.Chase;
    } else if (this._currentMode === CameraMode.Chase) {
      this.setActiveMode(CameraMode.Cockpit);
      this._lastToggleChoice = CameraMode.Cockpit;
    }
    // Neither Cockpit nor Chase (e.g. Grid, Drone, Inactive) — no-op (AC-16)
  }

  /**
   * Store current player speed for FOV shift calculation.
   *
   * Stub for Story 006 — value is accepted but not yet consumed.
   *
   * @param _speedKmh — Player car speed in km/h
   */
  setSpeedData(_speedKmh: number): void {
    // Story 006: FOV shift calculation
  }

  /**
   * Queue a shake effect.
   *
   * Stub for Story 007 — parameters are accepted but shake not yet applied.
   *
   * @param _type      — Shake source category
   * @param _intensity — Shake strength (0.0 to 1.0)
   */
  addShake(_type: ShakeType, _intensity: number): void {
    // Story 007: Shake system with ActiveShake[]
  }

  /**
   * Per-tick update. Runs FOV shift, shake decay, and chase occlusion.
   *
   * Chase occlusion raycast (Story 004) runs every tick when the active
   * mode is Chase and a player car mesh reference is available.
   * Stories 006-009 incrementally add more update logic.
   *
   * @param _dt — Delta time in seconds (fixed 1/60s), reserved for Stories 006-009
   */
  update(_dt: number): void {
    // Chase camera occlusion raycast (Story 004 — AC-11a, AC-11b)
    if (
      this._currentMode === CameraMode.Chase &&
      this._chaseCam &&
      this._playerCarMesh
    ) {
      this._runOcclusionRaycast();
    }

    // Stories 006-009: FOV shift, shake decay, head bob, lean
  }

  /**
   * Per-frame occlusion raycast for the chase camera.
   *
   * Casts a ray from the car center backward (TR-CAM-005). If an
   * occluding mesh is detected on the barrier collision layer, the
   * camera position is snapped to `hitPoint - 0.5m` along the backward
   * ray (AC-11a). When clear, the occlusion state is released and the
   * FollowCamera's lockedTarget spring returns the camera to the
   * configured follow distance (AC-11b).
   *
   * The barrier collision layer check uses a numeric group placeholder
   * until the CollisionGroup enum is defined by the collision system.
   *
   * @see TR-CAM-005 — Occlusion raycast snap closer
   */
  private _runOcclusionRaycast(): void {
    // Guard: chaseCam and playerCarMesh are asserted in the caller (update)
    // biome-ignore lint/style/noNonNullAssertion: guarded by caller
    const cam = this._chaseCam!;
    // biome-ignore lint/style/noNonNullAssertion: guarded by caller
    const car = this._playerCarMesh!;
    const maxDist = this._config.chase.distance;

    // Ray origin: car's absolute world position
    const carPos = car.absolutePosition;

    // Backward direction: negate the car's forward direction (world space).
    // In Babylon.js, Vector3.Backward() returns (0, 0, 1) in local space;
    // car.forward is already in world space, so negating it is equivalent
    // to TransformNormal(Vector3.Backward(), car.getWorldMatrix()).
    const backward = car.forward.scale(-1);

    const ray = new Ray(carPos, backward, maxDist);
    const hit = this._scene.pickWithRay(ray, (mesh) => {
      // TODO: Replace magic number with CollisionGroup.Barrier when the
      //       collision system defines the CollisionGroup enum.
      //       Barrier layer = group 2 (bit 1).
      return (mesh as AbstractMesh).collisionGroup === 2;
    });

    if (hit?.hit && hit.pickedMesh && hit.pickedPoint) {
      // Occluded — snap camera closer with 0.5m buffer toward the car.
      // Using subtract moves the snap position from the hit point toward
      // the car (along the backward direction).
      const snapPosition = hit.pickedPoint.subtract(backward.scale(0.5));
      cam.position = snapPosition;
      this._occlusionActive = true;
    } else if (this._occlusionActive) {
      // Clear — release occlusion. FollowCamera.lockedTarget is still set,
      // so the native spring snaps the camera back to configured distance.
      this._occlusionActive = false;
    }
  }

  /**
   * Dispose all owned camera instances.
   *
   * Resets internal state to post-constructor. Does NOT dispose the
   * Scene. Safe to call multiple times (idempotent).
   */
  dispose(): void {
    // Unsubscribe from EventBus before disposing cameras
    for (const sub of this._subscriptions) {
      sub.unsubscribe();
    }
    this._subscriptions = [];

    // Dispose shakeNode if it hasn't already been cleaned up by the
    // car lifecycle (AC-17 DNF coasting — car may have already
    // disposed driver_eye, which cascades to shakeNode and camera).
    if (this._shakeNode && !this._shakeNode.isDisposed()) {
      this._shakeNode.dispose();
    }
    this._shakeNode = null;

    // Dispose camera instances
    const cameras = [
      this._gridCam,
      this._cockpitCam,
      this._chaseCam,
      this._droneCam,
    ];
    for (const cam of cameras) {
      if (cam) {
        cam.dispose();
      }
    }

    // Reset state
    this._gridCam = null;
    this._cockpitCam = null;
    this._chaseCam = null;
    this._droneCam = null;
    this._currentMode = CameraMode.Inactive;
    this._scene.activeCamera = null;
    this._playerCarMesh = null;
    this._occlusionActive = false;
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  /**
   * Subscribe to GSM state events via EventBus.
   *
   * Maps `gsm.state.entered` events to CameraMode transitions:
   * - PreRace → Grid
   * - Racing → Cockpit (or Chase if toggle preference exists)
   * - PostRace → Drone
   * - Menu/Loading/other → Inactive
   *
   * Paused state is intentionally omitted — the active camera is preserved
   * (frozen view) when the game is paused.
   *
   * @see C18 — Camera reactive to gsm.state.entered only
   * @see C-F7 — Never make Camera initiate GSM transitions
   */
  private _subscribeToEvents(): void {
    if (!this._eventBus) return;

    const sub = this._eventBus.on(
      "gsm.state.entered",
      ({ from, to }: { from: string; to: string }) => {
        const mode = this._mapStateToCameraMode(to, from);
        this.setActiveMode(mode);
      }
    );
    this._subscriptions.push(sub);
  }

  /**
   * Map a GSM state string to the corresponding CameraMode.
   *
   * @param to   — The GSM state being entered
   * @param _from — The GSM state being exited (unused, reserved for future)
   * @returns The CameraMode for the incoming state
   * @see ADR-0007 §GSM Lifecycle
   */
  private _mapStateToCameraMode(to: string, _from: string): CameraMode {
    switch (to) {
      case "PreRace":
        return CameraMode.Grid;
      case "Racing":
        // Restore last toggle choice, default to Cockpit on first entry
        return this._lastToggleChoice ?? CameraMode.Cockpit;
      case "PostRace":
        return CameraMode.Drone;
      case "Paused":
        // Preserve the current active camera — freeze the view
        return this._currentMode;
      default:
        // Menu, Loading, and unknown states → Inactive
        return CameraMode.Inactive;
    }
  }

  /**
   * Position the grid camera based on track center and car positions.
   *
   * Uses the GridCameraReader if available, otherwise falls back to
   * the default position (0, 30, -40) with no explicit look-at target.
   *
   * @see AC-7 — Grid camera at (trackCenter.x, 30, trackCenter.z - 40)
   */
  private _positionGridCamera(): void {
    if (!this._gridReader || !this._gridCam) return;

    const center = this._gridReader.getTrackCenter();
    this._gridCam.position = new Vector3(center.x, 30, center.z - 40);

    // Look-at: midpoint between first and last car
    const first = this._gridReader.getFirstCarPosition();
    const last = this._gridReader.getLastCarPosition();
    const mid = new Vector3(
      (first.x + last.x) / 2,
      (first.y + last.y) / 2,
      (first.z + last.z) / 2
    );
    this._gridCam.setTarget(mid);
  }

  /**
   * Wire the FollowCamera target to the player car mesh.
   *
   * Uses the ChaseCameraReader if available. Called each time Chase
   * camera is activated to pick up late-spawned car meshes. Also
   * stores the mesh reference for occlusion raycast (Story 004).
   */
  private _wireChaseCameraTarget(): void {
    if (!this._chaseReader || !this._chaseCam) return;

    const mesh = this._chaseReader.getPlayerCarMesh();
    if (mesh) {
      // Set lockedTarget so FollowCamera._checkInputs() calls _follow()
      // each frame to auto-track the car mesh with elastic spring behavior.
      // ChaseCameraReader returns unknown to avoid entity system dependency.
      // biome-ignore lint/suspicious/noExplicitAny: mesh is AbstractMesh at runtime
      const carMesh = mesh as any;
      this._chaseCam.lockedTarget = carMesh;
      this._playerCarMesh = carMesh;
    }
  }

  /**
   * Create all 4 Babylon.js camera instances.
   *
   * FreeCamera (grid) — positioned above and behind the grid for a
   *   top-down framing view.
   * FreeCamera (cockpit) — at origin; parented to driver_eye in Story 003.
   * FollowCamera (chase) — at offset behind the car; follows via elastic spring.
   * ArcRotateCamera (drone) — at orbit distance; auto-rotates in Story 008.
   */
  private _createCameras(): void {
    // Grid camera: static position looking down at the grid
    this._gridCam = new FreeCamera(
      "gridCam",
      new Vector3(0, 30, -40),
      this._scene
    );

    // Cockpit camera: placed at origin, parented to driver_eye later
    this._cockpitCam = new FreeCamera(
      "cockpitCam",
      Vector3.Zero(),
      this._scene
    );

    // Chase camera: FollowCamera elastic follow behind the player car
    this._chaseCam = new FollowCamera(
      "chaseCam",
      new Vector3(0, this._config.chase.height, -this._config.chase.distance),
      this._scene
    );
    this._chaseCam.heightOffset = this._config.chase.height;
    this._chaseCam.radius = this._config.chase.distance;
    this._chaseCam.rotationOffset = this._config.chase.offset;
    this._chaseCam.cameraAcceleration = this._config.chase.cameraAcceleration;
    this._chaseCam.maxCameraSpeed = this._config.chase.maxCameraSpeed;

    // Drone camera: ArcRotateCamera orbiting the origin
    this._droneCam = new ArcRotateCamera(
      "droneCam",
      0, // initial alpha
      Math.PI / 4, // initial beta (~45° above horizon)
      8, // orbit distance
      Vector3.Zero(), // target position
      this._scene
    );
  }

  /**
   * Disable all built-in camera input (C17).
   *
   * All cameras:
   * 1. `camera.inputs.clear()` — disables v9.8 Camera Input Mapping System
   * 2. `camera.inertia = 0` — prevents residual drift during dormant frames
   *
   * ArcRotateCamera also clears the v9.8+ Input Mapping System:
   * `(drone as any).movement.input.inputMap.length = 0`
   *
   * @see TR-CAM-008 — Input explicitly disabled
   * @see Control Manifest C17 — inputs.clear() + inertia = 0
   */
  private _applyInputCleanup(): void {
    // Assert all cameras are created before cleanup
    defined(this._gridCam, "CameraManager: gridCam not created before cleanup");
    defined(
      this._cockpitCam,
      "CameraManager: cockpitCam not created before cleanup"
    );
    defined(
      this._chaseCam,
      "CameraManager: chaseCam not created before cleanup"
    );
    defined(
      this._droneCam,
      "CameraManager: droneCam not created before cleanup"
    );

    this._gridCam.inputs.clear();
    this._gridCam.inertia = 0;
    this._cockpitCam.inputs.clear();
    this._cockpitCam.inertia = 0;
    this._chaseCam.inputs.clear();
    this._chaseCam.inertia = 0;
    this._droneCam.inputs.clear();
    this._droneCam.inertia = 0;

    // Extra cleanup for ArcRotateCamera (v9.8+ Input Mapping System).
    // The `movement` property is not in ArcRotateCamera's public types
    // but exists at runtime in Babylon.js 9.8+.
    CameraManager._clearDroneInputMapping(this._droneCam);
  }

  /**
   * Clear the v9.8+ Input Mapping System on an ArcRotateCamera.
   *
   * Extracted as a static method for testability — the `movement` property
   * only exists at runtime in Babylon.js 9.8+ and cannot be mocked via
   * NullEngine. Static method allows direct testing with mock objects.
   *
   * @param droneCam — The ArcRotateCamera instance to clean up
   * @internal Visible for testing
   */
  static _clearDroneInputMapping(droneCam: ArcRotateCamera): void {
    // biome-ignore lint/suspicious/noExplicitAny: movement exists only at runtime
    const droneMovement = (droneCam as any).movement;
    if (droneMovement?.input?.inputMap) {
      droneMovement.input.inputMap.length = 0;
    }
  }
}
