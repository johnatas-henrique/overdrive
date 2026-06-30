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
import type { IEventBus, Subscription } from "@/foundation/event-bus/types";
import { ArcadeGripModel } from "./arcade-grip-model";
import type { CarPhysicsState } from "./car-physics-state";
import type { CarTelemetry, IPhysics } from "./i-physics";
import type { ITrackSystem } from "./i-track-system";
import type { PhysicsConfig } from "./physics-config";
import {
  buildSurfaceModifiers,
  type CarSurfaceState,
  enforceMinSurfaceSpeed,
  type SurfaceModifiers,
  SurfaceType,
  updateSurfaceState,
} from "./surface-handler";

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

  /** Reusable sorted car states array (avoids per-tick allocation). */
  private readonly _sortedStates: CarPhysicsState[] = [];

  /** Set of carIds whose Phase 3 velocity is zeroed (grid/pit lock). */
  private readonly _lockedCars: Set<string> = new Set();

  /** Set of carIds currently in pit lane speed-limited mode. */
  private readonly _pitCars: Set<string> = new Set();

  /**
   * Per-car surface state for surface handling (Story 004).
   * Populated lazily in update() — created on first tick a car is processed.
   */
  private readonly _surfaceStates: Map<string, CarSurfaceState> = new Map();

  /**
   * Pre-built surface modifier lookup table, built from PhysicsConfig at init time.
   * Null until init() completes. Used by updateSurfaceState() each tick.
   *
   * @see CONCERN-2 — build once, not per tick
   */
  private _surfaceModifiers: Record<SurfaceType, SurfaceModifiers> | null =
    null;

  /**
   * Surface provider callback — injected by the track system to convert
   * a spline position to a SurfaceType.
   *
   * Follows CONCERN-6: callback/closure pattern to avoid modifying ITrackSystem.
   * Must be set before the first update tick — throws if null at update time.
   */
  private _surfaceProvider: ((splinePosition: number) => SurfaceType) | null =
    null;

  /** Event Bus reference for emitting edge-triggered events. Null until set. */
  private _eventBus: IEventBus | null = null;

  /** Active Event Bus subscriptions, cleaned up in dispose(). */
  private readonly _subscriptions: Subscription[] = [];

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
   * @param eventBus - Optional Event Bus for edge-triggered events
   */
  constructor(
    scene: Scene,
    trackSystem?: ITrackSystem,
    havokPlugin?: HavokPlugin,
    eventBus?: IEventBus
  ) {
    this._scene = scene;
    this._trackSystem = trackSystem ?? null;
    this._havokPlugin = havokPlugin ?? null;
    this._eventBus = eventBus ?? null;
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

    // Build surface modifier lookup table from config (Story 004).
    // Cached once — zero per-tick allocation.
    // @see CONCERN-2 — physics specialist review: build once at init
    this._surfaceModifiers = buildSurfaceModifiers(this._config);

    if (!this._havokPlugin) {
      // Dynamic import avoids WASM load in environments that don't support it
      // (e.g., unit tests with mock HavokPlugin injection)
      const HavokPhysics = (await import("@babylonjs/havok")).default;
      const havokInstance = await HavokPhysics();
      this._havokPlugin = new HavokPlugin(true, havokInstance);
    }

    // enablePhysics is required for PhysicsBody/PhysicsAggregate constructors
    // (ADR-0002 F17, ADR-0008 init flow)
    const gravity = new Vector3(0, -config.gravity, 0);
    this._scene.enablePhysics(gravity, this._havokPlugin);

    // Suppress auto-step — our pipeline calls executeStep exclusively
    // (ADR-0002 F17, TR-DET-006)
    (
      this._scene as unknown as { _advancePhysicsEngineStep: () => void }
    )._advancePhysicsEngineStep = () => {
      /* no-op — pipeline controls stepping */
    };

    // Subscribe to Event Bus events
    // race.green.flag resets per-car edge-event guards for a fresh race session.
    // fuelMult and tireCondition arrive via direct onFuelUpdate/onTireUpdate calls
    // (per-frame data, not Event Bus — avoids Event Bus flooding per tick).
    if (this._eventBus) {
      this._subscriptions.push(
        this._eventBus.on("race.green.flag", () => this.onRaceGreenFlag())
      );
    }

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
    // _surfaceModifiers is always set when _initialized is true (built in init()).
    // The null guard on _initialized above ensures this is safe.
    const surfaceModifiers = this._surfaceModifiers as Record<
      SurfaceType,
      SurfaceModifiers
    >;
    const config = this._config;

    // ── Apply Pending External Updates (1-tick delay) ──────────────────
    // Applied BEFORE Phase 1 so fuelMult/tireCondition take effect on the
    // tick AFTER receipt (1-tick delay contract per AC-8 / C26 / C27).
    this._applyPendingUpdates();

    // ── Phase 1: Arcade Model + Surface Handling (Story 004) ────────────
    // Compute target speed/yaw per car with surface-dependent grip and
    // friction modifiers.
    //
    // Surface handling (Story 004) runs BEFORE ArcadeGripModel.compute():
    // 1. Query surface type from track spline via provider callback
    // 2. Update per-car surface state (kerb timer, grip override, telemetry)
    // 3. Pass gripOverride and frictionMultiplier to compute()
    //
    // Locked cars still receive Phase 1 updates (for telemetry/visuals),
    // but Phase 3 zeros their velocity (per ADR-0008).
    //
    // Inputs are read from _inputStates (populated by Story 005 InputBuffer).
    // Cars without a registered input state receive InputState.ZERO (no-input
    // default). See TR-PHYSICS-010 — Engine model integration.
    //
    // @see STORY-004 — Surface handling integration
    // @see AC-1/AC-2 — Surface grip/friction applied via compute() params
    // @see CONCERN-6 — SurfaceProvider callback pattern (no ITrackSystem change)
    for (const state of this._carStates.values()) {
      const input = this._inputStates.get(state.carId) ?? InputState.ZERO;

      // ── Surface Type Query ─────────────────────────────────────────
      // Provider must be set before the first update tick.
      // See CONCERN-6 — callback pattern, no ITrackSystem change.
      if (!this._surfaceProvider) {
        throw new Error(
          "[PhysicsService] Surface provider not set. Call setSurfaceProvider() before the first update tick."
        );
      }
      const surfaceType = this._surfaceProvider(state.splinePosition);

      // ── Lazy Surface State Init ────────────────────────────────────
      // Create on first tick a car is processed.
      let surfaceState = this._surfaceStates.get(state.carId);
      if (!surfaceState) {
        surfaceState = {
          currentSurface: SurfaceType.Tarmac,
          gripOverride: 1.0,
          kerbTimer: 0,
          wasOnKerb: false,
        };
        this._surfaceStates.set(state.carId, surfaceState);
      }

      // Use per-car topSpeedMs (initialized from config at car state creation).
      // Will be replaced by per-car stats lookup when car stats integration
      // lands (Story 005b+). @see TD-PHYS-001
      const topSpeedMs = state.topSpeedMs;

      // ── Update Surface State ───────────────────────────────────────
      // Mutates carState: frictionMultiplier, minSurfaceSpeed,
      //                   kerbHit, offTrack (telemetry flags)
      // Mutates surfaceState: currentSurface, gripOverride, kerbTimer
      updateSurfaceState(
        state,
        surfaceState,
        surfaceType,
        surfaceModifiers,
        config.kerbGripLoss,
        topSpeedMs
      );

      // ── Phase 1 Arcade Model ───────────────────────────────────────
      // Pass surface grip override and friction multiplier (Story 004).
      // gripOverride: 1.0 (tarmac) / 0.3 (grass) / 0.8 (kerb, timer active)
      // frictionMultiplier: 1.0 (tarmac) / 6.0 (grass, via config)
      this._phase1.compute(
        state,
        input,
        dt,
        this._config,
        surfaceState.gripOverride,
        state.frictionMultiplier
      );
    }

    // ── Enforce Minimum Surface Speed (Story 004) ──────────────────────
    // After Phase 1 compute, clamp target speed to surface minimum floor.
    // Only off-track surfaces (grass/gravel) have minSurfaceSpeed > 0.
    // Tarmac/kerb have minSurfaceSpeed = 0 (no clamp).
    // See AC-3: car never slowed below topSpeed × offTrackMinSpeed on grass.
    for (const state of this._carStates.values()) {
      state.targetSpeed = enforceMinSurfaceSpeed(
        state.targetSpeed,
        state.minSurfaceSpeed
      );
      // Update speedKmh to match clamped target speed (compute() already
      // set speedKmh = targetSpeed × 3.6, but targetSpeed may have been
      // clamped upward).
      state.speedKmh = state.targetSpeed * 3.6;
    }

    // ── Pit Limiter (Story 005) ──────────────────────────────────────────
    // Apply after Phase 1 target speed computation. For cars in pit mode,
    // smoothly transition target speed toward pitSpeedLimit using a linear
    // ramp over pitSpeedTransitionTime seconds.
    //
    // @see C25 — setPit() speed clamping with smooth deceleration
    // @see AC-2 — Pit limiter linear ramp acceptance criteria
    for (const state of this._carStates.values()) {
      if (this._pitCars.has(state.carId)) {
        const currentSpeed = state.speedKmh / 3.6;
        state.targetSpeed = PhysicsService.applyPitLimiter(
          state.targetSpeed,
          currentSpeed,
          config.pitSpeedLimit,
          true,
          config.pitSpeedTransitionTime,
          dt,
          state.pitEntrySpeed
        );
        state.speedKmh = state.targetSpeed * 3.6;
      }
    }

    // ── Phase 2: Havok Collision Step ──────────────────────────────────
    // Resolves all DYNAMIC×DYNAMIC and DYNAMIC×STATIC contacts.
    // Contact callbacks fire during this call.
    // Active bodies are rebuilt each tick from the car state map, sorted
    // by carId for deterministic collision resolution order (AC-7).
    // Contact callbacks fire during this call.
    // Active bodies are rebuilt each tick from the car state map, sorted
    // by carId for deterministic collision resolution order (AC-7).
    this._activeBodies.length = 0;
    this._sortedStates.length = 0;
    for (const state of this._carStates.values()) {
      this._sortedStates.push(state);
    }
    this._sortedStates.sort((a, b) => a.carId.localeCompare(b.carId));
    for (const state of this._sortedStates) {
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

      if (this._lockedCars.has(state.carId)) {
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

    // ── Edge-Triggered Events (Story 005) ───────────────────────────────
    // Check and emit car.tire_blown, car.fuel_empty, car.stopped AFTER
    // pending updates are applied so edge events consume the updated
    // fuelMult/tireCondition values from 1-tick-delayed external inputs.
    //
    // @see C28 — car.stopped edge-triggered
    // @see C40 — car.tire_blown one-shot
    // @see AC-5, AC-6, AC-7 — Acceptance criteria
    for (const state of this._carStates.values()) {
      this._checkEdgeEvents(state, config);
    }

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
      if (!this._pitCars.has(carId)) {
        // Record entry speed for constant-rate linear deceleration (AC-2)
        const state = this._carStates.get(carId);
        if (state) {
          state.pitEntrySpeed = state.speedKmh / 3.6;
        }
      }
      this._pitCars.add(carId);
    } else {
      this._pitCars.delete(carId);
      const state = this._carStates.get(carId);
      if (state) {
        state.pitEntrySpeed = null;
      }
    }
  }

  /**
   * Set the surface provider callback.
   *
   * The provider converts a car's spline position to a SurfaceType
   * by querying the track spline's per-segment gripSurface metadata (C59).
   *
   * This uses a callback/closure pattern (CONCERN-6) to avoid adding
   * surface query methods to the ITrackSystem interface.
   *
   * @param provider - Function that maps splinePosition (0..trackLength)
   *                   to SurfaceType. Must be set before the first update tick.
   *
   * @example
   * ```typescript
   * physics.setSurfaceProvider((pos) => trackSystem.getSurfaceAt(pos));
   * ```
   *
   * @see STORY-004 — Surface handling integration
   * @see C59 — Track spline carries per-segment gripSurface metadata
   */
  setSurfaceProvider(
    provider: ((splinePosition: number) => SurfaceType) | null
  ): void {
    this._surfaceProvider = provider;
    // Clear stale per-car surface state when provider changes.
    // Kerb timers and wasOnKerb flags are tied to the previous provider's
    // surface decisions and must restart fresh with the new provider.
    if (provider === null) {
      this._surfaceStates.clear();
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
      state.tireBlownEmitted = false;
      state.fuelEmptyEmitted = false;
    }

    // Clear pending external updates to prevent stale fuel/tire values
    // from a previous race carrying into the new one (TD-PHYS-004).
    this._pendingFuelUpdates.clear();
    this._pendingTireUpdates.clear();
  }

  /**
   * Receive fuel multiplier update (1-tick delay).
   *
   * @inheritdoc
   */
  onFuelUpdate(carId: string, fuelMult: number): void {
    // Defense-in-depth: clamp to [0, 1] to prevent invalid values from
    // propagating into the engine model (TD-PHYS-003).
    this._pendingFuelUpdates.set(carId, Math.max(0, Math.min(1, fuelMult)));
  }

  /**
   * Receive tire condition update (1-tick delay).
   *
   * @inheritdoc
   */
  onTireUpdate(carId: string, tireCondition: number): void {
    // Defense-in-depth: clamp to [0, 1] to prevent invalid values from
    // propagating into the grip model (TD-PHYS-003).
    this._pendingTireUpdates.set(
      carId,
      Math.max(0, Math.min(1, tireCondition))
    );
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
    this._sortedStates.length = 0;
    this._lockedCars.clear();
    this._pitCars.clear();
    this._surfaceStates.clear();
    this._pendingFuelUpdates.clear();
    this._pendingTireUpdates.clear();
    this._inputStates.clear();
    this._telemetry.clear();

    // Unsubscribe from Event Bus
    for (const sub of this._subscriptions) {
      sub.unsubscribe();
    }
    this._subscriptions.length = 0;
    this._eventBus = null;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────

  /**
   * Apply pit lane speed limiter with linear ramp.
   *
   * When pit mode is active, this function smoothly transitions the car's
   * target speed toward `pitSpeedLimit` using a constant-rate linear
   * deceleration profile over `transitionTime` seconds.
   *
   * The deceleration rate is computed from `pitEntrySpeed` (the speed at pit
   * mode entry), not the current speed. This produces a true linear ramp:
   * constant deceleration per tick until pitSpeedLimit is reached.
   *
   * @param targetSpeed - Current arcade target speed (m/s)
   * @param currentSpeed - Car's actual speed this tick (m/s)
   * @param pitSpeedLimit - Maximum allowed speed in pit lane (m/s)
   * @param isPitMode - True if pit limiter is active
   * @param transitionTime - Time in seconds for the full speed→limit transition
   * @param dt - Delta time in seconds
   * @param pitEntrySpeed - Speed at pit mode entry (m/s), or null if not set
   * @returns Clamped target speed (m/s)
   *
   * @see C25 — setPit() speed clamping with smooth deceleration
   * @see AC-2 — Pit limiter linear ramp acceptance criteria
   */
  private static applyPitLimiter(
    targetSpeed: number,
    currentSpeed: number,
    pitSpeedLimit: number,
    isPitMode: boolean,
    transitionTime: number,
    dt: number,
    pitEntrySpeed: number | null
  ): number {
    if (!isPitMode) {
      return targetSpeed;
    }

    // Linear ramp toward pitSpeedLimit using constant deceleration rate
    const speedDiff = currentSpeed - pitSpeedLimit;
    if (Math.abs(speedDiff) < 0.1) {
      return pitSpeedLimit; // near-zero → snap to limit
    }

    // Constant deceleration rate from entry speed to pitSpeedLimit
    const entryDiff =
      pitEntrySpeed !== null ? pitEntrySpeed - pitSpeedLimit : speedDiff;
    const safeTransitionTime = Math.max(transitionTime, 0.001);
    const maxStep = (Math.abs(entryDiff) / safeTransitionTime) * dt;
    const clampedDiff =
      Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), maxStep);
    return currentSpeed - clampedDiff;
  }

  /**
   * Check and emit edge-triggered events for a car.
   *
   * Called after Phase 1 each tick. Emits:
   * - `car.tire_blown` — one-shot when tireCondition → 0
   * - `car.fuel_empty` — one-shot when fuelMult → 0
   * - `car.stopped` — edge-triggered with hysteresis when speed drops below stopEpsilon
   *
   * @param state - Per-car physics state (mutated for guard flags)
   * @param config - Physics configuration (for stopEpsilon)
   *
   * @see C28 — car.stopped edge-triggered
   * @see C40 — car.tire_blown one-shot
   * @see AC-5, AC-6, AC-7 — Acceptance criteria for edge events
   */
  private _checkEdgeEvents(
    state: CarPhysicsState,
    config: PhysicsConfig
  ): void {
    // tire_blown — one-shot guard (C40)
    if (state.tireCondition <= 0 && !state.tireBlownEmitted) {
      state.tireBlownEmitted = true;
      this._eventBus?.emit("car.tire_blown", { carId: state.carId });
    }

    // fuel_empty — one-shot guard
    if (state.fuelMult <= 0 && !state.fuelEmptyEmitted) {
      state.fuelEmptyEmitted = true;
      this._eventBus?.emit("car.fuel_empty", { carId: state.carId });
    }

    // car.stopped — edge-triggered with hysteresis (C28)
    // Uses speedKmh (arcade model target) rather than raw body velocity.
    // This is intentional: in the arcade model, speedKmh IS the car's
    // effective speed after all Phase 1 computations (engine, drag, grip).
    // Raw body velocity can diverge during collision resolution (Phase 2)
    // and would produce false stopped/started events during contact pushes.
    const speedMs = state.speedKmh / 3.6;
    const isBelowEpsilon = speedMs < config.stopEpsilon;
    if (isBelowEpsilon && state.wasAboveStopEpsilon) {
      // Edge: was above, now below → emit once
      this._eventBus?.emit("car.stopped", { carId: state.carId });
    }
    // Hysteresis: re-arm when speed rises above stopEpsilon + 50% margin
    state.wasAboveStopEpsilon = speedMs > config.stopEpsilon * 1.5;
  }

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
   * Called at the START of update() before Phase 1, so fuelMult/tireCondition
   * take effect on the tick AFTER receipt (1-tick delay contract per AC-8 / C26 / C27).
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
   * Uses write-into-existing pattern: reuses CarTelemetry objects when
   * available, creates new ones only for newly added cars.
   */
  private _rebuildTelemetry(): void {
    for (const [carId, state] of this._carStates) {
      let telemetry = this._telemetry.get(carId);
      if (!telemetry) {
        telemetry = {} as CarTelemetry;
        this._telemetry.set(carId, telemetry);
      }
      // Write via Object.assign to bypass readonly interface properties
      // (internal mutation — consumers see readonly via CarTelemetry type)
      Object.assign(telemetry, {
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
    // Remove telemetry for cars that were removed
    for (const carId of this._telemetry.keys()) {
      if (!this._carStates.has(carId)) {
        this._telemetry.delete(carId);
      }
    }
  }
}
