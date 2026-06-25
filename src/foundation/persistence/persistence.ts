/**
 * Persistence — Storage abstraction with state machine.
 *
 * Wraps localStorage with an async-first interface, versioned payloads,
 * and degraded mode support. This file implements the state machine
 * and init probe; save/load/delete are stubs filled in by Story 002.
 *
 * ## State Machine
 *
 * ```
 * [Uninitialized] --init()--> [Ready] --error--> [Degraded] --retry()--> [Ready]
 * ```
 *
 * - **Uninitialized**: `save()`/`load()`/`delete()` throw `PersistenceError`.
 * - **Ready**: Storage is operational.
 * - **Degraded**: Storage unavailable. (Write queue and retry probed by Story 004.)
 *
 * ## Features
 * - Three-state machine: Uninitialized → Ready / Degraded
 * - Probe-based availability detection on `init()`
 * - Async-first: all public methods return `Promise<T>`
 * - Never crashes on storage errors (enters Degraded mode instead)
 * - Error type recording for non-recoverable failure detection
 *
 * @see ADR-0016 — Persistence Interface
 * @see F28 — Persistence: async-first
 * @see F31 — Persistence: degraded mode
 * @see F-F9 — Never crash on storage errors
 */

import { PersistenceError } from "./errors";

/**
 * Storage availability state.
 *
 * Tracks the operational state of the persistence backend through its
 * lifecycle. Initial state is `Uninitialized` until `init()` is called.
 *
 * @see ADR-0016 — State machine: [Uninitialized] --init()--> [Ready] --error--> [Degraded] --retry()--> [Ready]
 */
export enum PersistenceState {
  /** No backend selected. save()/load()/delete() throw. */
  Uninitialized = 0,
  /** Backend operational. Normal save/load. */
  Ready = 1,
  /** Storage unavailable. Writes queue, reads return null. */
  Degraded = 2,
}

/**
 * Migration function type.
 *
 * Transforms stored data from one schema version to the next.
 * Must be a pure function (no side effects, no I/O).
 *
 * @param data - The stored data at version `from`
 * @returns The transformed data at version `to`
 *
 * @see ADR-0016 — Versioned payload with migration chain
 */
export type MigrationFn = (data: unknown) => unknown;

/**
 * Default sentinel key for storage probe on init.
 */
const PROBE_KEY = "__overdrive_probe__";

/**
 * Default sentinel value for storage probe on init.
 */
const PROBE_VALUE = "1";

/**
 * Persistence — Async-first storage abstraction.
 *
 * @example
 * ```typescript
 * const persistence = new Persistence();
 *
 * // Initialize (probes localStorage availability)
 * await persistence.init();
 *
 * // Check state
 * if (persistence.state === PersistenceState.Ready) {
 *   // Storage available — save/load work
 * }
 * ```
 */
export class Persistence {
  /** Current storage availability state. */
  private _state: PersistenceState = PersistenceState.Uninitialized;

  /**
   * Error name from the last failed probe.
   *
   * Populated when `init()` enters Degraded mode. Used by Story 004
   * (`retry()`) to distinguish recoverable failures from non-recoverable
   * ones (e.g. `SecurityError` from private browsing).
   */
  private _lastError: string | undefined;

  /**
   * Memoized init promise — prevents double-probing on rapid concurrent calls.
   *
   * When `init()` is called twice before the first microtask resolves,
   * both calls return the same promise. The probe runs exactly once.
   */
  private _initPromise: Promise<void> | null = null;

  /**
   * Current persistence state.
   *
   * Read-only — external code can observe the state but cannot change it.
   *
   * @returns The current PersistenceState
   *
   * @example
   * ```typescript
   * if (persistence.state === PersistenceState.Ready) {
   *   await persistence.save("prefs", { volume: 0.8 });
   * }
   * ```
   */
  get state(): PersistenceState {
    return this._state;
  }

  /**
   * Error name from the last failed probe, if any.
   *
   * Returns `undefined` when no probe has failed (state is Ready or
   * init has not been called).
   *
   * @example
   * ```typescript
   * await persistence.init();
   * if (persistence.state === PersistenceState.Degraded) {
   *   console.warn("Storage failed with:", persistence.lastError);
   * }
   * ```
   */
  get lastError(): string | undefined {
    return this._lastError;
  }

  /**
   * Initialize the persistence backend.
   *
   * Runs a write-then-delete cycle on a sentinel key (`__overdrive_probe__`)
   * to probe localStorage availability. The probe runs inside a microtask
   * to maintain the async-first contract.
   *
   * - **Probe succeeds** → state becomes `Ready`.
   * - **Probe fails** (setItem throws) → state becomes `Degraded`, error
   *   name is recorded in `lastError` for non-recoverable detection.
   * - **Already initialized** (state !== Uninitialized) → silent no-op.
   *
   * @returns A Promise that resolves when the probe completes
   *
   * @example
   * ```typescript
   * const persistence = new Persistence();
   * await persistence.init();
   * console.log(persistence.state); // Ready or Degraded
   * ```
   */
  async init(): Promise<void> {
    if (this._state !== PersistenceState.Uninitialized) {
      return;
    }

    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = Promise.resolve().then(() => {
      try {
        localStorage.setItem(PROBE_KEY, PROBE_VALUE);
        localStorage.removeItem(PROBE_KEY);
        this._state = PersistenceState.Ready;
      } catch (error) {
        this._lastError = error instanceof Error ? error.name : "UnknownError";
        this._state = PersistenceState.Degraded;
      }
    });

    return this._initPromise;
  }

  /**
   * Save typed data to a namespaced key.
   *
   * **Uninitialized guard**: throws `PersistenceError` if `init()` has not
   * been called. Actual save logic is implemented in Story 002.
   *
   * @param key - Storage key (without prefix — prefix added internally)
   * @param data - Data to store
   * @returns A Promise that resolves when the data is written
   * @throws {PersistenceError} If state is Uninitialized
   *
   * @example
   * ```typescript
   * await persistence.init();
   * await persistence.save("player.name", "Player1");
   * ```
   */
  async save<T>(_key: string, _data: T): Promise<void> {
    if (this._state === PersistenceState.Uninitialized) {
      throw new PersistenceError("Not initialized. Call init() first.");
    }
    // Stub: actual save logic in Story 002
  }

  /**
   * Load typed data from a namespaced key.
   *
   * **Uninitialized guard**: throws `PersistenceError` if `init()` has not
   * been called. Actual load logic is implemented in Story 002.
   *
   * @param key - Storage key (without prefix — prefix added internally)
   * @returns The stored data, or `null` if the key does not exist
   * @throws {PersistenceError} If state is Uninitialized
   *
   * @example
   * ```typescript
   * await persistence.init();
   * const name = await persistence.load<string>("player.name");
   * ```
   */
  async load<T>(_key: string): Promise<T | null> {
    if (this._state === PersistenceState.Uninitialized) {
      throw new PersistenceError("Not initialized. Call init() first.");
    }
    // Stub: actual load logic in Story 002
    return null;
  }

  /**
   * Delete a key from storage.
   *
   * **Uninitialized guard**: throws `PersistenceError` if `init()` has not
   * been called. Actual delete logic is implemented in Story 002.
   *
   * @param key - Storage key to delete (without prefix)
   * @returns A Promise that resolves when the key is deleted
   * @throws {PersistenceError} If state is Uninitialized
   *
   * @example
   * ```typescript
   * await persistence.init();
   * await persistence.delete("player.name");
   * ```
   */
  async delete(_key: string): Promise<void> {
    if (this._state === PersistenceState.Uninitialized) {
      throw new PersistenceError("Not initialized. Call init() first.");
    }
    // Stub: actual delete logic in Story 002
  }

  /**
   * Register a migration step for schema version upgrades.
   *
   * Called during system init (before any `load()`). Synchronous and
   * allowed in any state, including `Uninitialized`.
   *
   * @param _from - Source semver version (e.g. "0.1.0")
   * @param _to - Target semver version (e.g. "0.2.0")
   * @param _fn - Pure migration function transforming `from` → `to`
   *
   * @example
   * ```typescript
   * persistence.registerMigration("0.1.0", "0.2.0", (old) => ({
   *   ...old as Record<string, unknown>,
   *   newField: "default",
   * }));
   * ```
   */
  registerMigration(_from: string, _to: string, _fn: MigrationFn): void {
    // Stub: migration chain implemented in Story 003
  }

  /**
   * Re-probe storage after a Degraded state.
   *
   * - **Ready**: No-op, returns `Promise.resolve(true)`.
   * - **Degraded / Uninitialized**: Stub returns `Promise.resolve(false)`.
   *   Actual retry logic (re-probe + queue flush) is implemented in Story 004.
   *
   * @returns `true` if storage is operational, `false` otherwise
   *
   * @example
   * ```typescript
   * const recovered = await persistence.retry();
   * if (recovered) {
   *   console.log("Storage recovered!");
   * }
   * ```
   */
  async retry(): Promise<boolean> {
    if (this._state === PersistenceState.Ready) {
      return true;
    }
    // Stub: actual retry logic in Story 004
    return false;
  }
}
