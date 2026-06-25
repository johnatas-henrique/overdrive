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
 * Persistence construction options.
 *
 * @example
 * ```typescript
 * const persistence = new Persistence({ prefix: "myapp_", version: "1.0.0" });
 * ```
 */
export interface PersistenceOptions {
  /**
   * Storage key prefix applied to all keys internally.
   * @default "overdrive_"
   */
  prefix?: string;

  /**
   * Current schema version stamped into every saved entry.
   * @default "0.1.0"
   */
  version?: string;
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
 * PersistedEntry — Versioned container wrapping every saved value.
 *
 * Every `save()` call wraps the caller's data in this container before
 * serialization. On `load()`, the container is unwrapped and the stored
 * `version` is compared to `CURRENT_VERSION` to decide whether migration
 * is needed (handled by Story 005).
 *
 * @typeParam T - The type of `data` known at compile time (runtime value is `unknown`)
 */
export interface PersistedEntry {
  /** Semver version at save time (e.g. "0.1.0"). */
  version: string;
  /** The caller's data. */
  data: unknown;
  /** `Date.now()` at save time. */
  timestamp: number;
}

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
   * Error name from the last failed probe or storage operation.
   *
   * Populated when `init()` or `save()` enters Degraded mode. Used by Story 004
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
   * Key prefix prepended to all storage keys.
   *
   * Applied internally — callers pass short keys (e.g. `"settings"`),
   * never the prefixed version.
   */
  private readonly _prefix: string;

  /**
   * Schema version stamped into every `PersistedEntry` at save time.
   *
   * Set at construction time and treated as immutable for the lifetime
   * of the instance.
   */
  private readonly _currentVersion: string;

  /**
   * Create a new Persistence instance.
   *
   * @param options - Optional configuration
   * @param options.prefix - Storage key prefix (default: `"overdrive_"`)
   * @param options.version - Schema version stamped on every save (default: `"0.1.0"`)
   *
   * @example
   * ```typescript
   * // Defaults
   * const p = new Persistence();
   *
   * // Custom prefix + version
   * const p = new Persistence({ prefix: "myapp_", version: "2.0.0" });
   * ```
   */
  constructor(options?: PersistenceOptions) {
    this._prefix = options?.prefix ?? "overdrive_";
    this._currentVersion = options?.version ?? "0.1.0";
  }

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
   * Error name from the last failed probe or storage operation, if any.
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
   * Wraps the data in a `PersistedEntry` container (with current version
   * and timestamp), serializes to JSON, and writes to localStorage under
   * `PREFIX + key`.
   *
   * **State-dependent behavior:**
   * - **Uninitialized**: throws `PersistenceError`.
   * - **Degraded**: no-op — resolves silently (write queuing is handled
   *   by Story 004).
   * - **Ready**: writes to localStorage. On storage error, transitions
   *   to Degraded mode.
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
  async save<T>(key: string, data: T): Promise<void> {
    if (this._state === PersistenceState.Uninitialized) {
      throw new PersistenceError("Not initialized. Call init() first.");
    }

    if (this._state === PersistenceState.Degraded) {
      // Story 004: delegate to memory queue
      return;
    }

    // Ready state
    const entry: PersistedEntry = {
      version: this._currentVersion,
      data,
      timestamp: Date.now(),
    };

    try {
      const json = JSON.stringify(entry);
      localStorage.setItem(this._prefix + key, json);
    } catch (error) {
      this._lastError = error instanceof Error ? error.name : "UnknownError";
      this._state = PersistenceState.Degraded;
    }
  }

  /**
   * Load typed data from a namespaced key.
   *
   * Fetches the raw JSON from localStorage under `PREFIX + key`,
   * deserializes it, unwraps the `PersistedEntry` container, and returns
   * the stored data cast to `T`.
   *
   * **State-dependent behavior:**
   * - **Uninitialized**: throws `PersistenceError`.
   * - **Degraded**: returns `null` immediately.
   * - **Ready**: fetches from localStorage. If the key does not exist,
   *   returns `null`. If JSON parse fails, returns `null`.
   *
   * @param key - Storage key (without prefix — prefix added internally)
   * @returns The stored data, or `null` if the key does not exist or
   *   storage is unavailable
   * @throws {PersistenceError} If state is Uninitialized
   *
   * @example
   * ```typescript
   * await persistence.init();
   * const name = await persistence.load<string>("player.name");
   * ```
   */
  async load<T>(key: string): Promise<T | null> {
    if (this._state === PersistenceState.Uninitialized) {
      throw new PersistenceError("Not initialized. Call init() first.");
    }

    if (this._state === PersistenceState.Degraded) {
      return null;
    }

    // Ready state
    try {
      const raw = localStorage.getItem(this._prefix + key);

      if (raw === null) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);

      if (parsed !== null && typeof parsed === "object" && "data" in parsed) {
        return (parsed as PersistedEntry).data as T;
      }

      // Valid JSON but not a PersistedEntry shape — treat as miss
      // (full error isolation is handled by Story 003)
      return null;
    } catch {
      // JSON parse failure — corrupted or non-JSON data
      // Error logging is added by Story 003
      return null;
    }
  }

  /**
   * Delete a key from storage.
   *
   * Removes the key from localStorage under `PREFIX + key`.
   *
   * **State-dependent behavior:**
   * - **Uninitialized**: throws `PersistenceError`.
   * - **Degraded**: no-op — resolves silently (queue removal is handled
   *   by Story 004).
   * - **Ready**: removes the key from localStorage. Safe to call on
   *   nonexistent keys.
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
  async delete(key: string): Promise<void> {
    if (this._state === PersistenceState.Uninitialized) {
      throw new PersistenceError("Not initialized. Call init() first.");
    }

    if (this._state === PersistenceState.Degraded) {
      // Story 004: remove from memory queue if pending
      return;
    }

    // Ready state
    try {
      localStorage.removeItem(this._prefix + key);
    } catch (error) {
      this._lastError = error instanceof Error ? error.name : "UnknownError";
      this._state = PersistenceState.Degraded;
    }
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
