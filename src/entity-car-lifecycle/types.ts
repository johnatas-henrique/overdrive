import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";

/**
 * A car entity in the race — identity-only, no runtime state.
 *
 * @remarks
 * Each car in an 8-car grid (1 player + 7 AI) gets one CarEntity.
 * The struct holds identity and engine references only — runtime state
 * (fuel, tires, speed, position) lives in each owner system's maps,
 * keyed by `id`.
 *
 * Player and AI use the identical structure. The player car has
 * `aiDriver = undefined`; AI cars carry an `AIDriverRef`.
 *
 * @see ADR-0005 — Entity/Car Lifecycle & State Ownership
 * @see TR-ECL-001 — CarEntity data structure
 * @see TR-ECL-007 — Player/AI uniformity
 */
export interface CarEntity {
  /** Unique car identifier: `'player'`, `'ai_0'`, …, `'ai_6'` */
  readonly id: string;
  /** Team identifier (e.g. `'macklen'`, `'willard'`) */
  readonly teamId: string;
  /** Grid position — 0 = pole position */
  readonly gridIndex: number;
  /** Root `TransformNode` or `Mesh` of the cloned car GLB in the scene */
  readonly mesh: AbstractMesh;
  /**
   * Physics body — convex hull, 800 kg.
   * `null` before `spawnGrid()` is called or after `destroyAll()`.
   */
  readonly physicsBody: PhysicsAggregate | null;
  /**
   * AI driver reference.
   * `undefined` for the player car (TR-ECL-007).
   */
  readonly aiDriver?: AIDriverRef;
}

/**
 * Reference to an AI driver profile.
 *
 * @remarks
 * Created during `spawnGrid()` and stored on each AI car's `CarEntity`.
 * The actual AI controller instantiation happens in the AI Driver system
 * (pipeline slot #3), which subscribes to `'entity.spawned'` events.
 *
 * The `driverProfile` string is a key into the AI driver registry
 * (Gameplay layer, out of scope for this story).
 *
 * @see ADR-0005 — Entity/Car Lifecycle & State Ownership
 */
export interface AIDriverRef {
  /** Team this AI driver belongs to */
  readonly teamId: string;
  /** Key into the AI driver registry (e.g. `'balanced'`, `'aggressive'`) */
  readonly driverProfile: string;
}

/**
 * Configuration for a single team on the grid.
 */
export interface TeamConfig {
  /** Team identifier (e.g. `'macklen'`, `'willard'`) */
  readonly teamId: string;
  /** AI driver profile key — used to create the `AIDriverRef` */
  readonly driverProfile: string;
}

/**
 * Grid configuration passed to `spawnGrid()`.
 *
 * @remarks
 * The order of the `teams` array **is** the grid order:
 * `teams[0]` = pole position, `teams[1]` = second, etc.
 * Grid order is determined by the caller (Race Management),
 * not by the lifecycle system.
 *
 * @see ADR-0005 — Grid order determined by caller
 */
export interface GridConfig {
  /** Ordered list of teams (first = pole position) */
  readonly teams: readonly TeamConfig[];
  /** Which team the player drives for */
  readonly playerTeamId: string;
}

/**
 * States for the `EntityLifecycle` state machine.
 *
 * ```
 * [Uninitialized] --init()--> [Idle] --spawnGrid()--> [Grid Active]
 * ```
 *
 * @see ADR-0005 — State Machine
 */
export type EntityLifecycleState = "Uninitialized" | "Idle" | "GridActive";

/**
 * Error thrown by `EntityLifecycle` on invalid state transitions.
 *
 * @remarks
 * Extends `Error` with a fixed `name` property and restored prototype
 * chain for reliable `instanceof` checks across module boundaries.
 *
 * @example
 * ```typescript
 * throw new EntityLifecycleError("Grid already active");
 * ```
 */
export class EntityLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntityLifecycleError";
    // Restore prototype chain (transpiled class extends Error)
    Object.setPrototypeOf(this, EntityLifecycleError.prototype);
  }
}
