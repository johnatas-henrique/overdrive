/**
 * Interface for systems that can capture and restore their state.
 *
 * Systems implement this interface to participate in the simulation snapshot
 * system. The orchestrator (SimulationSnapshot) calls these methods to take
 * full-game snapshots and restore from them.
 *
 * All methods must be synchronous and JSON-stringify-compatible. The interface
 * is engine-agnostic — zero dependencies on Babylon.js.
 *
 * @example
 * ```typescript
 * class FuelSystem implements ISnapshotable {
 *   readonly systemId = "fuel";
 *   private fuelLevel = 100;
 *
 *   serialize(): Record<string, unknown> {
 *     return { fuelLevel: this.fuelLevel };
 *   }
 *
 *   deserialize(state: Record<string, unknown>): void {
 *     this.fuelLevel = state.fuelLevel as number;
 *   }
 *
 *   hash(state?: Record<string, unknown>): string {
 *     const data = state ?? this.serialize();
 *     return fnv1a(JSON.stringify(data));
 *   }
 * }
 * ```
 */
export interface ISnapshotable {
  /** Unique identifier for this system (e.g. "physics", "fuel"). Immutable. */
  readonly systemId: string;

  /**
   * Returns the system's current state as a plain JSON-compatible object.
   *
   * Must not contain classes, Maps, Sets, circular references, or any value
   * that cannot be serialised by JSON.stringify. Plain objects, arrays,
   * primitives, and null are supported.
   */
  serialize(): Record<string, unknown>;

  /**
   * Restores the system's state from a previously serialized object.
   *
   * Mutates internal state in-place. Never creates new instances or replaces
   * `this`. Returns void.
   *
   * @param state — The state object previously returned by serialize().
   */
  deserialize(state: Record<string, unknown>): void;

  /**
   * Returns a deterministic hash of the system's current state.
   *
   * Accepts an optional pre-serialized state to avoid double-serializing
   * when the caller has already called `serialize()`. When `state` is
   * provided, implementations MUST ignore it (not re-serialize from
   * internal state).
   *
   * Same state must always produce the same hash string, across all platforms
   * and runs. Implemented as `fnv1a(JSON.stringify(data))`.
   *
   * @param state — Optional pre-serialized state. When provided, hash uses
   *   this instead of calling `serialize()`.
   */
  hash(state?: Record<string, unknown>): string;
}
