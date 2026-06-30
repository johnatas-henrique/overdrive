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
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { defined } from "@/shared/assert-defined";
import { createDefaultCameraConfig } from "./camera-defaults";
import {
  type CameraConfig,
  CameraMode,
  type ICameraManager,
  type ShakeType,
} from "./types";

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

  /**
   * @param scene — The Babylon.js Scene to create cameras in.
   *   Must be a valid, non-disposed Scene instance. CameraManager does
   *   NOT own the Scene — it will not dispose it.
   */
  constructor(scene: Scene) {
    this._scene = scene;
    this._config = createDefaultCameraConfig();
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
    switch (this._currentMode) {
      case CameraMode.Cockpit: // Cockpit -> Chase
        this.setActiveMode(CameraMode.Chase);
        break;
      case CameraMode.Chase: // Chase -> Cockpit
        this.setActiveMode(CameraMode.Cockpit);
        break;
      default:
        // Neither active — default to Cockpit
        this.setActiveMode(CameraMode.Cockpit);
        break;
    }
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
   * Stub for Story 001 — active camera is set but no per-tick effects
   * are applied yet. Stories 002-009 incrementally add update logic.
   *
   * @param _dt — Delta time in seconds (fixed 1/60s)
   */
  update(_dt: number): void {
    // Stories 006-009: FOV shift, shake decay, head bob, lean
  }

  /**
   * Dispose all owned camera instances.
   *
   * Resets internal state to post-constructor. Does NOT dispose the
   * Scene. Safe to call multiple times (idempotent).
   */
  dispose(): void {
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
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

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

    // Chase camera: offset behind the player car
    this._chaseCam = new FollowCamera(
      "chaseCam",
      new Vector3(0, 3, -6),
      this._scene
    );

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
