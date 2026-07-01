import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Node } from "@babylonjs/core/node";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import type { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import type { Scene } from "@babylonjs/core/scene";

import type { IEventBus, Subscription } from "@/foundation/event-bus/types";
import { defined } from "@/shared/assert-defined";
import type { CarEntity, EntityLifecycleState, GridConfig } from "./types";
import { EntityLifecycleError } from "./types";

// ── Local Type ────────────────────────────────────────────────

/**
 * Instantiation result shape from `AssetContainer.instantiateModelsToScene()`.
 *
 * Aligned with Babylon.js 9.x `InstantiatedEntries` which exposes
 * `rootNodes: Node[]` and a `dispose()` method for cleanup.
 *
 * @see ADR-0003 — AssetContainers
 */
interface InstantiationResult {
  rootNodes: Node[];
  /** Dispose all root nodes and associated resources. */
  dispose(): void;
}

// ── Constants ─────────────────────────────────────────────────

/** Mass of each car's PhysicsAggregate (convex hull), in kilograms. */
const CAR_MASS_KG = 800;

/** Physics shape type for car bodies. */
const PHYSICS_SHAPE = PhysicsShapeType.CONVEX_HULL;

/** Reserved car ID for the player-driven car. */
const PLAYER_CAR_ID = "player";

/** Prefix for AI car IDs. */
const AI_CAR_ID_PREFIX = "ai_";

/** Event name for GSM state entry (subscribed in `init()`). */
const GSM_STATE_ENTERED = "gsm.state.entered";

// ── EntityLifecycle ───────────────────────────────────────────

/**
 * Manages the lifecycle of all car entities in a race.
 *
 * ### Responsibilities
 * - State machine: Uninitialized → Idle → GridActive → Idle (or → Disposed)
 * - Spawning grid cars from cached AssetContainers
 * - Creating per-car PhysicsAggregate (CONVEX_HULL, 800 kg)
 * - Destroying all cars: physics bodies before meshes, reverse iteration
 * - GSM integration: auto-spawn on PreRace, auto-destroy on PostRace
 * - Maintaining the car entity registry (`Map<carId, CarEntity>`)
 * - Tracking cleanup refs (PhysicsBody[], InstantiationResult[])
 * - Emitting `'entity.spawned'` / `'entity.despawned'` events per car
 *
 * ### Ownership Rules
 * - **CarEntity is identity-only**: mesh ref, physics body, AI driver link.
 *   Runtime state (fuel, tires, speed, position) lives in each owner system's
 *   maps, keyed by `carId`. (See ADR-0005 — Entity/Car Lifecycle & State Ownership)
 * - **Player and AI share the same structure**: `aiDriver` is `undefined` for
 *   the player car. (See TR-ECL-007)
 * - **Grid order is caller-determined**: the `teams` array order IS the grid
 *   order; first element = pole position. (See ADR-0005)
 *
 * ### GSM Integration
 * - On `gsm.state.entered` → `PreRace`: `spawnGrid()` called with stored
 *   container and config (from the previous manual spawn or first setup).
 * - On `gsm.state.entered` → `PostRace`: `destroyAll()` called to clean up.
 *
 * ### Usage
 * ```typescript
 * const lifecycle = new EntityLifecycle();
 * lifecycle.init(eventBus, raceScene);
 *
 * // Manual spawn (first time)
 * const container = await assetManager.load("car");
 * lifecycle.spawnGrid(container, {
 *   teams: [{ teamId: "macklen", driverProfile: "balanced" }, ...],
 *   playerTeamId: "macklen",
 * });
 *
 * // Subsequent races are auto-triggered by GSM transitions:
 * //   PreRace → spawnGrid()  (uses stored container/config)
 * //   PostRace → destroyAll()
 * const player = lifecycle.getEntity("player");
 * ```
 *
 * @see ADR-0005 — Entity/Car Lifecycle & State Ownership
 * @see TR-ECL-001 — CarEntity data structure
 * @see TR-ECL-002 — spawnGrid() implementation
 * @see TR-ECL-003 — destroyAll() implementation
 * @see TR-ECL-004 — EntityLifecycleError on double-spawn
 * @see TR-ECL-005 — getEntity() accessor
 * @see TR-ECL-006 — State machine
 * @see TR-ECL-007 — Player/AI uniformity
 * @see TR-ECL-008 — GSM integration
 * @see TR-ECL-009 — dispose() teardown
 */
export class EntityLifecycle {
  // ── State Machine ───────────────────────────────────────────
  private _state: EntityLifecycleState = "Uninitialized";

  // ── Dependencies (set by init()) ────────────────────────────
  private _eventBus: IEventBus | null = null;
  private _scene: Scene | null = null;

  // ── Entity Registry ─────────────────────────────────────────
  /** Maps `carId` → `CarEntity`. */
  private readonly _entities: Map<string, CarEntity> = new Map();

  // ── Cleanup Tracking ────────────────────────────────────────
  /**
   * Active `PhysicsBody` references, collected during `spawnGrid()`.
   *
   * Used by the fixed-timestep pipeline (slot #2) for
   * `executeStep(dt, bodies)` and by `destroyAll()` for body teardown.
   *
   * @see ADR-0002 — Fixed Timestep Determinism
   */
  private readonly _activeBodies: PhysicsBody[] = [];

  /**
   * `InstantiationResult` entries from each `instantiateModelsToScene()`
   * call, retained for mesh cleanup in `destroyAll()`.
   */
  private readonly _entries: InstantiationResult[] = [];

  // ── GSM Integration ─────────────────────────────────────────

  /**
   * Subscription handle for the `gsm.state.entered` event.
   * Created in `init()`, unsubscribed in `dispose()`.
   */
  private _gsmStateSub: Subscription | null = null;

  /**
   * Last `AssetContainer` passed to `spawnGrid()`, retained so the
   * GSM can auto-spawn on `PreRace` without the caller re-supplying it.
   */
  private _storedContainer: AssetContainer | null = null;

  /**
   * Last `GridConfig` passed to `spawnGrid()`, retained for GSM re-spawn.
   */
  private _storedGridConfig: GridConfig | null = null;

  // ═════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═════════════════════════════════════════════════════════════

  /**
   * Initialize the lifecycle with an EventBus, a Scene, and subscribe
   * to GSM state transitions.
   *
   * Transitions state from `Uninitialized` to `Idle`, making the
   * system ready to accept a `spawnGrid()` call.
   *
   * Subscribes to `gsm.state.entered` events to automatically react
   * to `PreRace` (spawn grid) and `PostRace` (destroy all).
   *
   * **Pre-condition**: The Scene must have physics enabled
   * (`scene.enablePhysics()`) — `PhysicsAggregate` constructors
   * require a registered physics engine (ADR-0002, F17).
   *
   * @param eventBus - Typed Event Bus for emitting lifecycle events
   * @param scene - Babylon.js Scene to instantiate meshes into
   *
   * @throws {EntityLifecycleError} If called more than once (state is not Uninitialized)
   *
   * @example
   * ```typescript
   * lifecycle.init(eventBus, raceScene);
   * ```
   */
  init(eventBus: IEventBus, scene: Scene): void {
    this._assertUninitialized();
    this._eventBus = eventBus;
    this._scene = scene;

    // Subscribe to GSM state transitions for auto-spawn / auto-destroy
    this._gsmStateSub = eventBus.on(GSM_STATE_ENTERED, (payload) => {
      this._onGsmStateEntered(payload);
    });

    this._state = "Idle";
  }

  /**
   * Spawn all cars on the grid from a pre-loaded, cached AssetContainer.
   *
   * ### Per-car flow
   * 1. Clone the car mesh via `container.instantiateModelsToScene()`
   * 2. Extract the chassis `Mesh` (with vertex data) for the physics shape
   * 3. Create a `PhysicsAggregate` (CONVEX_HULL, 800 kg) bound to the chassis
   * 4. Wrap in a `CarEntity` and store in the entity registry
   * 5. Emit `'entity.spawned'{ carId, teamId, gridIndex }` on the Event Bus
   *
   * After all cars are created, the state machine transitions to `GridActive`.
   *
   * The container and config are retained internally so the GSM can
   * auto-spawn on future `PreRace` transitions.
   *
   * **Pre-condition**: The AssetContainer **must** already be loaded and cached.
   * The caller (Race Management) obtains it from `AssetManager.load()`.
   *
   * **Synchronous guarantee**: All 8 cars are fully created before the
   * function returns — no promises, no deferred work. (See ADR-0005 C8.)
   *
   * @param container - Pre-loaded AssetContainer with the car GLB
   * @param config - Grid configuration: team order and player team ID
   *
   * @throws {EntityLifecycleError} If state is not `Idle` (double-spawn guard)
   * @throws {EntityLifecycleError} If no mesh with geometry is found in the GLB
   *
   * @example
   * ```typescript
   * const container = await assetManager.load("car");
   * lifecycle.spawnGrid(container, {
   *   teams: [
   *     { teamId: "macklen", driverProfile: "balanced" },
   *     { teamId: "willard", driverProfile: "aggressive" },
   *     { teamId: "stark",   driverProfile: "defensive" },
   *   ],
   *   playerTeamId: "macklen",
   * });
   * ```
   */
  spawnGrid(container: AssetContainer, config: GridConfig): void {
    this._assertStateIs("Idle");

    const { teams, playerTeamId } = config;
    let aiIndex = 0;

    for (let gridIndex = 0; gridIndex < teams.length; gridIndex++) {
      const team = teams[gridIndex];
      const isPlayer = team.teamId === playerTeamId;

      // (2a) Clone from the cached AssetContainer into the scene
      const result =
        container.instantiateModelsToScene() as unknown as InstantiationResult;

      // (2b) Extract the root node and the chassis Mesh (with geometry)
      const root = this._resolveRoot(result);
      const chassisMesh = this._extractChassisMesh(root, result);

      // (2c) Create the PhysicsAggregate (CONVEX_HULL, 800 kg)
      const physicsAggregate = this._createAggregate(root, chassisMesh);

      // (2d) Build the car ID and entity
      const carId = isPlayer
        ? PLAYER_CAR_ID
        : `${AI_CAR_ID_PREFIX}${aiIndex++}`;
      const aiDriver = isPlayer
        ? undefined
        : { teamId: team.teamId, driverProfile: team.driverProfile };

      const entity: CarEntity = {
        id: carId,
        teamId: team.teamId,
        gridIndex,
        mesh: root as unknown as AbstractMesh,
        physicsBody: physicsAggregate,
        aiDriver,
      };

      // Store in the registry and track cleanup refs
      this._entities.set(carId, entity);
      this._activeBodies.push(physicsAggregate.body);
      this._entries.push(result);

      // (2e) Emit the spawn event for any downstream subscribers
      this._eventBus?.emit("entity.spawned", {
        carId,
        teamId: team.teamId,
        gridIndex,
      });
    }

    // Store container and config for GSM auto-replay AFTER successful spawn
    this._storedContainer = container;
    this._storedGridConfig = config;

    // Transition to GridActive — all cars are in the scene
    this._state = "GridActive";
  }

  /**
   * Destroy all car entities and clean up the grid.
   *
   * ### Cleanup Order (per ADR-0005)
   * 1. Reverse-iterate cars: emit `entity.despawned`, dispose physics bodies
   * 2. Clear `_activeBodies` array
   * 3. Dispose all mesh entries (removes meshes from scene)
   * 4. Clear `_entries` array
   * 5. Clear entity map
   * 6. Transition to `Idle`
   *
   * Physics bodies are disposed BEFORE mesh entries to prevent dangling
   * Havok references. Reverse iteration ensures no dependency cascade.
   *
   * **Idempotent**: If state is not `GridActive`, this is a no-op.
   * Safe to call multiple times.
   *
   * @see ADR-0005 — Cleanup Flow
   * @see TR-ECL-003 — destroyAll() implementation
   *
   * @example
   * ```typescript
   * lifecycle.destroyAll();
   * expect(lifecycle.state).toBe("Idle");
   * ```
   */
  destroyAll(): void {
    // Idempotent: no-op if not GridActive
    if (this._state !== "GridActive") return;

    // (1) Reverse-iterate cars (per ADR-0005 — prevents dependency cascade)
    const carIds = Array.from(this._entities.keys());
    for (let i = carIds.length - 1; i >= 0; i--) {
      const carId = carIds[i];
      const entity = this._entities.get(carId);
      defined(
        entity,
        `EntityLifecycle: entity '${carId}' not found during destroyAll`
      );

      // (1a) Emit despawn event for downstream subscribers
      this._eventBus?.emit("entity.despawned", { carId });

      // (1b) Dispose physics body BEFORE mesh entries
      // PhysicsAggregate.dispose() removes the onDisposeObservable handler,
      // preventing double-dispose when the mesh is released.
      entity.physicsBody?.dispose();
    }

    // (2) Clear physics body tracking
    this._activeBodies.length = 0;

    // (3) Dispose all mesh entries (removes meshes from scene)
    for (const entry of this._entries) {
      entry.dispose();
    }

    // (4) Clear cleanup tracking
    this._entries.length = 0;

    // (5) Clear entity map
    this._entities.clear();

    // (6) Transition to Idle — ready for next race
    this._state = "Idle";
  }

  /**
   * Retrieve a `CarEntity` by its identifier.
   *
   * Safe to call from any state. Returns `undefined` when the car ID
   * does not exist in the registry.
   *
   * @param carId - `'player'` for the player car, or `'ai_0'` … `'ai_6'`
   * @returns The `CarEntity`, or `undefined` if not found
   *
   * @example
   * ```typescript
   * const player = lifecycle.getEntity("player");
   * if (player?.physicsBody) {
   *   // Use player physics body
   * }
   * ```
   */
  getEntity(carId: string): CarEntity | undefined {
    return this._entities.get(carId);
  }

  /**
   * Dispose the lifecycle — permanent teardown.
   *
   * ### What this does
   * - Unsubscribes from GSM state events
   * - Disposes any remaining physics bodies (if called mid-race)
   * - Disposes any remaining mesh entries
   * - Clears all internal state
   * - Transitions to `Disposed` (terminal state)
   *
   * After `dispose()`:
   * - State is `"Disposed"`
   * - `init()`, `spawnGrid()`, `destroyAll()` all throw or are no-ops
   * - The lifecycle is **not reusable** — create a new instance
   *
   * @remarks
   * Unlike `destroyAll()` which cleans up cars but keeps the lifecycle
   * ready for another race, `dispose()` completely shuts down the
   * lifecycle. Call this during app teardown or when the race scene
   * is being unloaded.
   *
   * @see TR-ECL-009 — dispose() teardown
   *
   * @example
   * ```typescript
   * lifecycle.dispose();
   * expect(lifecycle.state).toBe("Disposed");
   * ```
   */
  dispose(): void {
    // Unsubscribe from GSM state events
    this._gsmStateSub?.unsubscribe();
    this._gsmStateSub = null;

    // Dispose any remaining physics bodies (cleanup regardless of state)
    for (const entity of this._entities.values()) {
      entity.physicsBody?.dispose();
    }
    this._activeBodies.length = 0;

    // Dispose any remaining mesh entries
    for (const entry of this._entries) {
      entry.dispose();
    }

    // Clear all tracking
    this._entities.clear();
    this._entries.length = 0;
    this._storedContainer = null;
    this._storedGridConfig = null;

    // Clear dependencies
    this._eventBus = null;
    this._scene = null;

    // Transition to terminal state
    this._state = "Disposed";
  }

  /**
   * Expose stored container for inspection (testing/debug).
   *
   * @returns The stored AssetContainer, or `null` if never set
   *
   * @internal
   */
  getStoredContainer(): AssetContainer | null {
    return this._storedContainer;
  }

  /**
   * Expose stored grid config for inspection (testing/debug).
   *
   * @returns The stored GridConfig, or `null` if never set
   *
   * @internal
   */
  getStoredGridConfig(): GridConfig | null {
    return this._storedGridConfig;
  }

  // ── State Accessors ─────────────────────────────────────────

  /**
   * The current state of the lifecycle state machine.
   *
   * @example
   * ```typescript
   * expect(lifecycle.state).toBe("GridActive");
   * ```
   */
  get state(): EntityLifecycleState {
    return this._state;
  }

  /**
   * Number of active physics bodies (for pipeline stepping and debug).
   *
   * @example
   * ```typescript
   * expect(lifecycle.activeBodyCount).toBe(8);
   * ```
   */
  get activeBodyCount(): number {
    return this._activeBodies.length;
  }

  /**
   * Number of entities in the registry.
   *
   * @example
   * ```typescript
   * expect(lifecycle.entityCount).toBe(8);
   * ```
   */
  get entityCount(): number {
    return this._entities.size;
  }

  // ═════════════════════════════════════════════════════════════
  //  INTERNAL: GSM Integration
  // ═════════════════════════════════════════════════════════════

  /**
   * Handle `gsm.state.entered` events for auto-spawn and auto-destroy.
   *
   * - `PreRace` → calls `spawnGrid()` with the stored container and config
   * - `PostRace` → calls `destroyAll()` to clean up
   *
   * If no container/config is stored (spawnGrid was never called manually),
   * the PreRace handler is a silent no-op — the caller must first set up the
   * grid via an explicit `spawnGrid()` call.
   *
   * @param payload - The GSM state transition payload
   */
  private _onGsmStateEntered(payload: { from: string; to: string }): void {
    if (payload.to === "PreRace") {
      // Auto-spawn the grid using stored container/config
      if (this._storedContainer && this._storedGridConfig) {
        this.spawnGrid(this._storedContainer, this._storedGridConfig);
      }
    } else if (payload.to === "PostRace") {
      // Auto-destroy all entities
      this.destroyAll();
    }
  }

  // ═════════════════════════════════════════════════════════════
  //  INTERNAL: Chassis Extraction
  // ═════════════════════════════════════════════════════════════

  /**
   * Resolve the root node from an instantiation result.
   *
   * The GLB root is the first entry in `rootNodes`.
   * It may be a `Mesh` (with geometry) or a `TransformNode` (without geometry).
   * In the latter case, `_extractChassisMesh` searches children for a `Mesh`.
   */
  private _resolveRoot(result: InstantiationResult): Node {
    const node = result.rootNodes[0];
    if (!node) {
      throw new EntityLifecycleError("No root node in instantiation result");
    }
    return node;
  }

  /**
   * Extract the chassis `Mesh` (with vertex geometry) from the car hierarchy.
   *
   * The GLB root may be a `TransformNode` without geometry. Since
   * `PhysicsAggregate` with `CONVEX_HULL` requires vertex data, we
   * search for the first child `Mesh` that has a non-null `geometry`.
   *
   * Search order:
   * 1. If the root itself is a `Mesh` with geometry, use it directly
   * 2. Scan all nodes returned by `instantiateModelsToScene()` for a Mesh with geometry
   * 3. Scan the root's child hierarchy for a `Mesh` with geometry
   *
   * @throws {EntityLifecycleError} If no mesh with geometry is found anywhere
   *
   * @see ADR-0005 — CONVEX_HULL constraint note
   */
  private _extractChassisMesh(root: Node, result: InstantiationResult): Mesh {
    // (1) Root is already a Mesh with geometry — best case
    if (root instanceof Mesh && root.geometry) {
      return root;
    }

    // (2) Scan root nodes from the instantiation result
    for (const node of result.rootNodes) {
      if (node instanceof Mesh && node.geometry) {
        return node;
      }
    }

    // (3) Fallback: walk the root's child hierarchy
    const childMeshes = root.getChildMeshes(false);
    for (const child of childMeshes) {
      if (child instanceof Mesh && child.geometry) {
        return child;
      }
    }

    throw new EntityLifecycleError(
      "No chassis mesh with geometry found in car GLB"
    );
  }

  // ── Internal: Physics Aggregate ─────────────────────────────

  /**
   * Create a `PhysicsAggregate` for a car.
   *
   * Supports two cases:
   * - **Root is a Mesh with geometry**: passes `{ mass: 800 }` only.
   * - **Root is a TransformNode**: passes `{ mass: 800, mesh: chassisMesh }`
   *   so the `CONVEX_HULL` shape is built from the correct vertex data.
   */
  private _createAggregate(root: Node, chassisMesh: Mesh): PhysicsAggregate {
    const rootHasGeometry = root instanceof Mesh && root.geometry !== null;
    defined(this._scene, "EntityLifecycle: scene not initialized");

    return new PhysicsAggregate(
      root as AbstractMesh,
      PHYSICS_SHAPE,
      rootHasGeometry
        ? { mass: CAR_MASS_KG }
        : { mass: CAR_MASS_KG, mesh: chassisMesh },
      this._scene
    );
  }

  // ── Internal: Assertions ────────────────────────────────────

  /** Assert state is `"Uninitialized"` (for `init()`). */
  private _assertUninitialized(): void {
    if (this._state !== "Uninitialized") {
      throw new EntityLifecycleError(
        `Cannot init() from state '${this._state}' — expected 'Uninitialized'`
      );
    }
  }

  /**
   * Assert state matches the expected value.
   *
   * Provides clear error messages for each invalid state:
   * - `GridActive` → "Grid already active"
   * - `Disposed` → "Lifecycle is disposed — create a new instance"
   * - Other → generic message with current and expected state
   */
  private _assertStateIs(expected: EntityLifecycleState): void {
    if (this._state !== expected) {
      let message: string;
      if (this._state === "GridActive") {
        message = "Grid already active";
      } else if (this._state === "Disposed") {
        message = "Lifecycle is disposed — create a new instance";
      } else {
        message = `Cannot spawnGrid() from state '${this._state}' — expected '${expected}'`;
      }
      throw new EntityLifecycleError(message);
    }
  }
}
