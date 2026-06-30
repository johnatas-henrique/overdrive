/**
 * PhysicsService — Arcade Dynamic vehicle physics implementation.
 *
 * Implements the 3-phase pipeline (ADR-0008 C22) within FixedUpdatePipeline
 * slot #2:
 *
 * 1. **Phase 1** (Arcade Model): Compute target speed and yaw per car
 * 2. **Phase 2** (Havok Collision): Resolve DYNAMIC×DYNAMIC contact impulses
 * 3. **Phase 3** (Velocity Override): Snap to arcade speed, preserve collision
 *    position delta, track ground elevation
 *
 * Performance budget: < 0.06ms/tick for 8 cars (C-G1).
 * Memory budget: < 4KB for 8 PhysicsBody instances (C-G2).
 *
 * @see ADR-0008 — Vehicle Physics — Arcade Dynamic
 * @see C21 — 1 DYNAMIC body per car, no wheel bodies
 * @see C22 — 3-phase execution within pipeline slot #2
 * @see C24 — setLocked() — zero velocity for grid/pit
 * @see C25 — setPit() — pit speed limiter
 */

import { Vector3 } from "@babylonjs/core/Maths/math";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import type { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import type { Scene } from "@babylonjs/core/scene";
// Required side-effect import for PhysicsBody constructor in node environment
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";

import type { IFixedUpdatePipeline } from "@/foundation/determinism/fixed-update-pipeline";
import { InputState } from "@/foundation/determinism/types";
import { ArcadeGripModel } from "./arcade-grip-model";
import type { CarPhysicsState } from "./car-physics-state";
import type { CarTelemetry, IPhysics } from "./i-physics";
import type { ITrackSystem } from "./i-track-system";
import type { PhysicsConfig } from "./physics-config";

/**
 * PhysicsService implements the Arcade Dynamic vehicle model.
 *
 * @example
 * ```typescript
 * const physics = new PhysicsService(scene, trackSystem);
 * await physics.init(physicsConfig);
 * pipeline.register("physics", (dt) => physics.update(dt), 2);
 * ```
 */
export class PhysicsService implements IPhysics {
  private readonly _scene: Scene;
  private readonly _trackSystem: ITrackSystem | null;
  private _havokPlugin: HavokPlugin | null = null;
  private _config: PhysicsConfig | null = null;
  private _initialized = false;
  private _disposed = false;

  /** Per-car physics state map — indexed by carId. */
  private readonly _carStates: Map<string, CarPhysicsState> = new Map();

  /** Active PhysicsBody array passed to havokPlugin.executeStep(). */
  private readonly _activeBodies: PhysicsBody[] = [];

  /** Set of carIds whose Phase 3 velocity is zeroed (grid/pit lock). */
  private readonly _lockedCars: Set<string> = new Set();

  /** Set of carIds currently in pit lane speed-limited mode. */
  private readonly _pitCars: Set<string> = new Set();

  /** Pending fuelMult updates (applied next tick for 1-tick delay). */
  private readonly _pendingFuelUpdates: Map<string, number> = new Map();

  /** Pending tireCondition updates (applied next tick for 1-tick delay). */
  private readonly _pendingTireUpdates: Map<string, number> = new Map();

  /**
   * Per-car input states for Phase 1.
   *
   * Populated by the Input System (Story 005) via double-buffered InputBuffer.
   * Until Story 005 integration, defaults to InputState.ZERO for all cars.
   *
   * @todo Story 005: wire this to InputBuffer.read() for each carId per tick.
   */
  private readonly _inputStates: Map<string, InputState> = new Map();

  /** Phase 1 arcade grip model. */
  private readonly _phase1: ArcadeGripModel;

  /** Scratch Vector3 for velocity override (reused per tick to avoid allocation). */
  private readonly _scratchVel = new Vector3(0, 0, 0);

  /** Scratch Vector3 for angular velocity (reused per tick to avoid allocation). */
  private readonly _scratchAngVel = new Vector3(0, 0, 0);

  /** Scratch Vector3 for world position (reused per tick to avoid allocation). */
  private readonly _scratchWorldPos = new Vector3(0, 0, 0);

  /** Last tick's telemetry cache — rebuilt each update(). */
  private readonly _telemetry: Map<string, CarTelemetry> = new Map();

  // Reserved for Story 002+ race-conditioned grip logic; unused in Story 001.
  // private _raceActive = false;

  /**
   * Create a PhysicsService.
   *
   * @param scene - Babylon.js Scene to enable physics on
   * @param trackSystem - Optional track system for ground tracking and spline queries
   * @param havokPlugin - Optional HavokPlugin instance (for testing injection)
   */
  constructor(
    scene: Scene,
    trackSystem?: ITrackSystem,
    havokPlugin?: HavokPlugin
  ) {
    this._scene = scene;
    this._trackSystem = trackSystem ?? null;
    this._havokPlugin = havokPlugin ?? null;
    this._phase1 = new ArcadeGripModel();
  }

  // ─── Initialization ──────────────────────────────────────────────────

  /**
   * Initialize the physics subsystem.
   *
   * 1. Creates or configures the Havok plugin
   * 2. Enables physics on the scene (required for PhysicsBody constructors)
   * 3. Suppresses the scene's auto-step to prevent double-stepping
   *
   * If a HavokPlugin was injected via constructor, it is used directly.
   * Otherwise, a new Havok instance is created via dynamic import.
   *
   * @param config - Physics configuration
   */
  async init(config: PhysicsConfig): Promise<void> {
    if (this._initialized) {
      return;
    }
    this._config = config;

    if (!this._havokPlugin) {
      // Dynamic import avoids WASM load in environments that don't support it
      // (e.g., unit tests with mock HavokPlugin injection)
      const HavokPhysics = (await import("@babylonjs/havok")).default;
      const havokInstance = await HavokPhysics();
      this._havokPlugin = new HavokPlugin(true, havokInstance);
    }

    // enablePhysics is required for PhysicsBody/PhysicsAggregate constructors
    // (ADR-0002 F17, ADR-0008 init flow)
    const gravity = new Vector3(0, -9.81, 0);
    this._scene.enablePhysics(gravity, this._havokPlugin);

    // Suppress auto-step — our pipeline calls executeStep exclusively
    // (ADR-0002 F17, TR-DET-006)
    (
      this._scene as unknown as { _advancePhysicsEngineStep: () => void }
    )._advancePhysicsEngineStep = () => {
      /* no-op — pipeline controls stepping */
    };

    this._initialized = true;
  }

  // ─── Core Update (3-Phase Pipeline Slot #2) ──────────────────────────

  /**
   * Execute one physics tick.
   *
   * **Phase 1**: Arcade model computes targetSpeed and targetYawRate per car.
   * Locked cars skip Phase 1 (their state is already zero from Phase 3).
   *
   * **Phase 2**: Havok executeStep resolves DYNAMIC×DYNAMIC and
   * DYNAMIC×STATIC collisions. Contact callbacks fire → collision.impact events.
   *
   * **Phase 3**: Velocity override snaps each car to arcade velocity.
   * Car position = previous position + collision push-apart delta
   * (from Phase 2) + arcade target velocity × dt (from Phase 3).
   *
   * Pending fuel/tire updates are applied after Phase 3 (1-tick delay).
   * Telemetry cache is rebuilt for external consumers.
   *
   * @param dt - Delta time in seconds (typically 1/60)
   */
  update(dt: number): void {
    if (!this._initialized || this._disposed || !this._config) {
      return;
    }
    const havokPlugin = this._havokPlugin;

    // ── Phase 1: Arcade Model ──────────────────────────────────────────
    // Compute target speed/yaw per car.
    // Locked cars still receive Phase 1 updates (for telemetry/visuals),
    // but Phase 3 zeros their velocity (per ADR-0008).
    //
    // Inputs are read from _inputStates (populated by Story 005 InputBuffer).
    // Cars without a registered input state receive InputState.ZERO (no-input
    // default). See TR-PHYSICS-010 — Engine model integration.
    for (const state of this._carStates.values()) {
      const input = this._inputStates.get(state.carId) ?? InputState.ZERO;
      this._phase1.compute(state, input, dt, this._config);
    }

    // ── Phase 2: Havok Collision Step ──────────────────────────────────
    // Resolves all DYNAMIC×DYNAMIC and DYNAMIC×STATIC contacts.
    // Contact callbacks fire during this call.
    // Active bodies are rebuilt each tick from the car state map, sorted
    // by carId for deterministic collision resolution order (AC-7).
    this._activeBodies.length = 0;
    const sortedStates = [...this._carStates.values()].sort((a, b) =>
      a.carId.localeCompare(b.carId)
    );
    for (const state of sortedStates) {
      if (state.body) {
        this._activeBodies.push(state.body);
      }
    }
    havokPlugin?.executeStep(dt, this._activeBodies);

    // ── Phase 3: Velocity Override ─────────────────────────────────────
    // Snap each car to the arcade target velocity while preserving the
    // collision position delta from Phase 2.
    for (const state of this._carStates.values()) {
      if (!state.body) {
        continue;
      }
      const body = state.body;

      if (state.locked || this._lockedCars.has(state.carId)) {
        body.setLinearVelocity(Vector3.Zero());
        body.setAngularVelocity(Vector3.Zero());
        continue;
      }

      const forwardDir = this._getForwardDirection(state.splinePosition);
      forwardDir.scaleToRef(state.targetSpeed, this._scratchVel);

      // Y-up ground tracking: Y velocity correction from spline elevation
      // (ADR-0008 Ground Tracking section)
      if (this._trackSystem) {
        const splineY = this._trackSystem.getElevation(state.splinePosition);
        body.getObjectCenterWorldToRef(this._scratchWorldPos);
        this._scratchVel.y = (splineY - this._scratchWorldPos.y) / dt;
      }

      body.setLinearVelocity(this._scratchVel);
      this._scratchAngVel.y = state.targetYawRate;
      body.setAngularVelocity(this._scratchAngVel);
    }

    // ── Apply Pending External Updates (1-tick delay) ──────────────────
    this._applyPendingUpdates();

    // ── Rebuild Telemetry Cache ────────────────────────────────────────
    this._rebuildTelemetry();
  }

  // ─── Control Methods ─────────────────────────────────────────────────

  /**
   * Lock or unlock a car.
   *
   * @inheritdoc
   */
  setLocked(carId: string, locked: boolean): void {
    if (locked) {
      this._lockedCars.add(carId);
    } else {
      this._lockedCars.delete(carId);
    }
  }

  /**
   * Enable or disable pit mode for a car.
   *
   * @inheritdoc
   */
  setPit(carId: string, enabled: boolean): void {
    if (enabled) {
      this._pitCars.add(carId);
    } else {
      this._pitCars.delete(carId);
    }
  }

  // ─── Query Methods ───────────────────────────────────────────────────

  /**
   * Get telemetry for a car.
   *
   * @inheritdoc
   */
  getTelemetry(carId: string): CarTelemetry | undefined {
    return this._telemetry.get(carId);
  }

  /**
   * Get spline position for a car.
   *
   * @inheritdoc
   */
  getSplinePosition(carId: string): number {
    return this._carStates.get(carId)?.splinePosition ?? 0;
  }

  // ─── Event Handlers ──────────────────────────────────────────────────

  /**
   * Prepare for race start.
   *
   * @inheritdoc
   */
  onRaceGreenFlag(): void {
    // Reset per-car integration state that should not carry across races
    for (const state of this._carStates.values()) {
      state.wasAboveStopEpsilon = false;
    }
  }

  /**
   * Receive fuel multiplier update (1-tick delay).
   *
   * @inheritdoc
   */
  onFuelUpdate(carId: string, fuelMult: number): void {
    this._pendingFuelUpdates.set(carId, fuelMult);
  }

  /**
   * Receive tire condition update (1-tick delay).
   *
   * @inheritdoc
   */
  onTireUpdate(carId: string, tireCondition: number): void {
    this._pendingTireUpdates.set(carId, tireCondition);
  }

  // ─── Pipeline Registration ───────────────────────────────────────────

  /**
   * Register this service's update method in the pipeline at slot #2.
   *
   * The pipeline must be in the `uninitialized` state (before start() is called).
   * Slot #2 must not already be occupied — if it contains a NO-OP placeholder
   * from PipelineRuntime, the PipelineRuntime must support replacing placeholders
   * (a future cross-story concern).
   *
   * @param pipeline - FixedUpdatePipeline to register into
   * @throws PipelineError if slot 2 is occupied or pipeline is not uninitialized
   *
   * @example
   * ```typescript
   * physics.register(pipeline);
   * pipeline.start(); // then attach to engine
   * ```
   */
  register(pipeline: IFixedUpdatePipeline): void {
    pipeline.register("physics", (dt: number) => this.update(dt), 2);
  }

  // ─── Disposal ────────────────────────────────────────────────────────

  /**
   * Dispose all physics resources.
   *
   * @inheritdoc
   */
  dispose(): void {
    this._disposed = true;
    this._scene.disablePhysicsEngine();
    this._havokPlugin?.dispose();
    this._carStates.clear();
    this._activeBodies.length = 0;
    this._lockedCars.clear();
    this._pitCars.clear();
    this._pendingFuelUpdates.clear();
    this._pendingTireUpdates.clear();
    this._inputStates.clear();
    this._telemetry.clear();
  }

  // ─── Private Helpers ─────────────────────────────────────────────────

  /**
   * Get the forward direction for a car at its spline position.
   *
   * Uses the track system if available; falls back to a default forward
   * vector (Vector3.Forward) when no track system is configured.
   *
   * @param splinePosition - Car's current spline position
   * @returns Normalized forward direction
   */
  private _getForwardDirection(splinePosition: number): Vector3 {
    if (this._trackSystem) {
      return this._trackSystem.getTangent(splinePosition);
    }
    return Vector3.Forward();
  }

  /**
   * Apply pending fuel and tire updates (1-tick delay).
   *
   * Called at the end of update() after Phase 3 completes.
   * Clears the pending maps after application.
   */
  private _applyPendingUpdates(): void {
    for (const [carId, fuelMult] of this._pendingFuelUpdates) {
      const state = this._carStates.get(carId);
      if (state) {
        state.fuelMult = fuelMult;
      }
    }
    this._pendingFuelUpdates.clear();

    for (const [carId, tireCondition] of this._pendingTireUpdates) {
      const state = this._carStates.get(carId);
      if (state) {
        state.tireCondition = tireCondition;
      }
    }
    this._pendingTireUpdates.clear();
  }

  /**
   * Rebuild the telemetry cache from current car state.
   *
   * Called at the end of each update() after all phases complete.
   *
   * TODO: Clearing and repopulating all telemetry objects every 60Hz tick
   * creates ~480 object allocations/second. Consider lazy-update on
   * getTelemetry() call or write-mutable struct for post-Story-005 optimization.
   */
  private _rebuildTelemetry(): void {
    this._telemetry.clear();
    for (const [carId, state] of this._carStates) {
      this._telemetry.set(carId, {
        speedKmh: state.speedKmh,
        rpm: state.rpm,
        gear: state.gear as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        lateralG: state.lateralG,
        accelG: state.accelG,
        tireSqueal: state.tireSqueal,
        kerbHit: state.kerbHit,
        offTrack: state.offTrack,
      });
    }
  }
}
