/**
 * Persistence — Storage abstraction with state machine.
 *
 * Wraps localStorage with an async-first interface, versioned payloads,
 * and degraded mode support. This file is ~800 lines because it bundles
 * the full state machine, init probe, save/load/delete, migration chain,
 * retry queue, and persistence helpers in a single module.
 * A Future refactor could split into state-machine.ts, queue.ts,
 * migration.ts, and io.ts (low priority — internal cohesion is high).
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

import { MigrationError, PersistenceError } from "./errors";

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
 * Maximum entries in the degraded-mode write queue before FIFO eviction.
 */
const MAX_WRITE_QUEUE = 50;

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
   * In-memory write queue used during Degraded mode.
   *
   * When storage is unavailable, `save()` writes are queued here as
   * pre-serialized JSON strings (including PersistedEntry wrapper with
   * version and timestamp). On successful `retry()`, the queue is flushed
   * to storage. Maximum 50 entries with FIFO eviction.
   *
   * Pre-serializing at queue time ensures deterministic retry:
   * timestamp and JSON key order are frozen when the entry is queued,
   * not regenerated on retry (AC-14).
   *
   * @see F31 — Persistence: degraded mode
   */
  private _writeQueue: Array<{ key: string; json: string }> = [];

  /**
   * Whether the storage backend is considered recoverable.
   *
   * Set to `false` when a probe fails with `SecurityError` (private browsing,
   * cross-origin iframe). When `false`, `retry()` skips the probe entirely
   * and returns `false` without attempting recovery.
   *
   * Defaults to `true`. Reset to `true` on next `init()` / page load.
   */
  private _recoverable: boolean = true;

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
   * Registry of registered migration steps.
   *
   * Maps `from` version → `{ to, fn }` for the migration chain.
   * Populated via `registerMigration()` before `load()` is called.
   *
   * @see ADR-0016 — Migration chain via registerMigration(from, to, fn)
   */
  private _migrationRegistry: Map<string, { to: string; fn: MigrationFn }> =
    new Map();

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
        if (this._lastError === "SecurityError") {
          this._recoverable = false;
        }
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
   * - **Degraded**: queues the write in an in-memory buffer (max 50 entries,
   *   FIFO eviction). Flushed to storage on successful `retry()`.
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
      if (this._writeQueue.length >= MAX_WRITE_QUEUE) {
        this._writeQueue.shift();
      }
      try {
        const json = this._serializeEntry(key, data);
        this._writeQueue.push({ key, json });
      } catch (error) {
        console.warn(
          `[Persistence] Failed to serialize key "${key}" — ${error instanceof Error ? error.message : "unknown error"}`
        );
      }
      return;
    }

    // Ready state
    const json = this._serializeEntry(key, data);

    try {
      localStorage.setItem(this._prefix + key, json);
    } catch (error) {
      this._lastError = error instanceof Error ? error.name : "UnknownError";
      this._state = PersistenceState.Degraded;
      // Check for SecurityError (e.g. private browsing / storage access
      // denied by the browser's security policies). Non-recoverable security
      // errors mark the state as Degraded permanently (retry() will not
      // attempt to recover).
      // See F-006 — SecurityError handling in degraded transitions.
      if (this._lastError === "SecurityError") {
        this._recoverable = false;
      }
      // Queue the already-serialized JSON for retry so it is not lost when
      // storage becomes available again. Queue is empty on first
      // failure (state just transitioned to Degraded), so no eviction needed.
      this._writeQueue.push({ key, json });
    }
  }

  /**
   * Load typed data from a namespaced key.
   *
   * Fetches the raw JSON from localStorage under `PREFIX + key`,
   * deserializes it, unwraps the `PersistedEntry` container, and returns
   * the stored data cast to `T`.
   *
   * If the stored version does not match the current version, migrations
   * are run automatically via `_runMigrations()`.
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
   * @throws {MigrationError} If the migration chain has a missing step
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
    let raw: string | null;
    try {
      raw = localStorage.getItem(this._prefix + key);
    } catch (error) {
      this._lastError = error instanceof Error ? error.name : "UnknownError";
      this._state = PersistenceState.Degraded;
      return null;
    }

    if (raw === null) {
      return null;
    }

    // Separate JSON parse errors from migration errors — parse first, then
    // migrate. This ensures MigrationError propagates rather than being
    // swallowed by a catch-all.
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // JSON parse failure — corrupted or non-JSON data
      console.warn(
        `[Persistence] Corrupted entry for key "${key}" (${raw.length} bytes)`
      );
      return null;
    }

    if (Persistence._isPersistedEntry(parsed)) {
      const entry = parsed as PersistedEntry;

      // Run migrations only when stored version < current version.
      // Downgrades (stored > current) return data as-is (F-008).
      if (Persistence._entryNeedsMigration(entry, this._currentVersion)) {
        const migratedData = this._runMigrations(
          entry.version,
          entry.data,
          this._currentVersion
        );
        return migratedData as T;
      }

      return entry.data as T;
    }

    // Valid JSON but not a PersistedEntry shape — warn and treat as miss
    console.warn(
      `[Persistence] Corrupted entry for key "${key}" (${raw.length} bytes)`
    );
    return null;
  }

  /**
   * Delete a key from storage.
   *
   * Removes the key from localStorage under `PREFIX + key`.
   *
   * **State-dependent behavior:**
   * - **Uninitialized**: throws `PersistenceError`.
   * - **Degraded**: removes any pending entry with matching key from the
   *   in-memory write queue. If not queued, no-op.
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
      this._writeQueue = this._writeQueue.filter((entry) => entry.key !== key);
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
   * Stores the migration function keyed by the `from` version string.
   * The walk algorithm in `_runMigrations()` discovers the chain by
   * looking up each `from` as the cursor progresses.
   *
   * @param from - Source semver version (e.g. "0.1.0")
   * @param to - Target semver version (e.g. "0.2.0")
   * @param fn - Pure migration function transforming `from` → `to`
   *
   * @example
   * ```typescript
   * persistence.registerMigration("0.1.0", "0.2.0", (old) => ({
   *   ...old as Record<string, unknown>,
   *   newField: "default",
   * }));
   * ```
   */
  registerMigration(from: string, to: string, fn: MigrationFn): void {
    if (this._migrationRegistry.has(from)) {
      const existing = this._migrationRegistry.get(from);
      console.warn(
        `[Persistence] Overwriting migration ${from} → ${existing?.to} with ${from} → ${to}`
      );
    }
    this._migrationRegistry.set(from, { to, fn });
  }

  /**
   * Run the migration chain from `storedVersion` to `currentVersion`.
   *
   * Walks the chain one step at a time by looking up each `from` version
   * in the migration registry. Each step applies the registered migration
   * function and advances the cursor to the `to` version.
   *
   * - **Versions match**: returns data as-is (no-op).
   * - **Downgrade** (stored > current): logs a warning, returns data as-is.
   * - **Missing step**: throws `MigrationError` with a descriptive message
   *   including the missing step and the implied next version.
   *
   * @param storedVersion - Version of the stored data
   * @param data - The stored data to migrate
   * @param currentVersion - Target version to migrate to
   * @returns The migrated data at `currentVersion`
   * @throws {MigrationError} If a required migration step is missing
   *
   * @internal
   */
  _runMigrations(
    storedVersion: string,
    data: unknown,
    currentVersion: string
  ): unknown {
    // No migration needed — versions match
    if (storedVersion === currentVersion) {
      return data;
    }

    // Downgrade defense — stored version is ahead of current version
    if (Persistence._compareVersions(storedVersion, currentVersion) > 0) {
      console.warn(
        `[Persistence] Stored version ${storedVersion} > current version ${currentVersion}. No migration applied.`
      );
      return data;
    }

    // Walk the chain from storedVersion to currentVersion
    const MAX_MIGRATION_STEPS = 100;
    let cursor = storedVersion;
    let steps = 0;
    while (cursor !== currentVersion) {
      if (++steps > MAX_MIGRATION_STEPS) {
        throw new MigrationError(
          `Migration chain exceeds ${MAX_MIGRATION_STEPS} steps — possible cycle`
        );
      }
      const migration = this._migrationRegistry.get(cursor);

      if (!migration) {
        // Find the implied next version by scanning the registry for the
        // smallest `from` greater than the current cursor.
        const impliedNext = this._findImpliedNext(cursor, currentVersion);
        throw new MigrationError(
          `Missing migration: ${cursor} → ${impliedNext}`
        );
      }

      data = migration.fn(data);
      cursor = migration.to;
    }

    return data;
  }

  /**
   * Parse a semver string into numeric parts for comparison.
   *
   * @param v - Semver string (e.g. "0.1.0")
   * @returns Array of numeric components (e.g. [0, 1, 0])
   *
   * @example
   * ```typescript
   * Persistence._parseVersion("0.10.0"); // [0, 10, 0]
   * ```
   */
  private static _parseVersion(version: string): [number, number, number] {
    const parts = version.split(".");
    if (parts.length !== 3 || parts.some((p) => p === "" || !/^\d+$/.test(p))) {
      throw new MigrationError(`Invalid version format: "${version}"`);
    }
    return parts.map(Number) as [number, number, number];
  }

  /**
   * Compare two semver strings numerically.
   *
   * Compares component-by-component (major, minor, patch). Unlike
   * lexicographic comparison, this correctly handles e.g. "0.10.0" > "0.9.0".
   *
   * @param a - First semver string
   * @param b - Second semver string
   * @returns Negative if a < b, 0 if equal, positive if a > b
   *
   * @example
   * ```typescript
   * Persistence._compareVersions("0.10.0", "0.9.0");  // > 0
   * Persistence._compareVersions("0.1.0", "0.1.0");    // 0
   * Persistence._compareVersions("0.1.0", "0.2.0");    // < 0
   * ```
   */
  private static _compareVersions(a: string, b: string): number {
    const partsA = Persistence._parseVersion(a);
    const partsB = Persistence._parseVersion(b);
    const maxLen = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLen; i++) {
      const pa = partsA[i] ?? 0;
      const pb = partsB[i] ?? 0;
      if (pa < pb) return -1;
      if (pa > pb) return 1;
    }

    return 0;
  }

  /**
   * Find the implied next version when a migration is missing.
   *
   * Scans the registry for the registered migration with the smallest
   * `from` version that is greater than `cursor`. If none found, falls
   * back to `currentVersion`.
   *
   * @param cursor - The current version cursor where the chain is stuck
   * @param currentVersion - The target version as a fallback
   * @returns The implied next version string
   */
  /**
   * Check if a parsed value looks like a PersistedEntry (has data and version).
   *
   * Extracted from `load()` to reduce method length (AC-15).
   */
  private static _isPersistedEntry(parsed: unknown): boolean {
    return (
      parsed !== null &&
      typeof parsed === "object" &&
      "data" in parsed &&
      "version" in parsed
    );
  }

  /**
   * Check whether a persisted entry needs migration.
   *
   * Only returns true when stored version < current version.
   * Downgrades (stored > current) return false — data is returned as-is.
   * Equal versions return false — no migration needed.
   *
   * Extracted from `load()` to reduce method length (AC-15).
   */
  private static _entryNeedsMigration(
    entry: PersistedEntry,
    currentVersion: string
  ): boolean {
    if (entry.version === currentVersion) return false;
    return Persistence._compareVersions(entry.version, currentVersion) < 0;
  }

  private _findImpliedNext(cursor: string, currentVersion: string): string {
    let impliedNext = currentVersion;

    for (const [fromVersion] of this._migrationRegistry) {
      if (
        Persistence._compareVersions(fromVersion, cursor) > 0 &&
        Persistence._compareVersions(fromVersion, impliedNext) < 0
      ) {
        impliedNext = fromVersion;
      }
    }

    return impliedNext;
  }

  /**
   * Serialize key+data into a JSON string wrapped in PersistedEntry.
   *
   * Used by the degraded-mode write queue to pre-determine the serialized
   * form (including timestamp) so retry can write it directly without
   * re-serializing (AC-14).
   *
   * @throws {PersistenceError} If JSON.stringify fails
   */
  private _serializeEntry(key: string, data: unknown): string {
    const entry: PersistedEntry = {
      version: this._currentVersion,
      data,
      timestamp: Date.now(),
    };
    try {
      return JSON.stringify(entry);
    } catch (error) {
      throw new PersistenceError(
        `Failed to serialize key "${key}": ${error instanceof Error ? error.message : "Unknown serialization error"}`
      );
    }
  }

  /**
   * Re-probe storage after a Degraded state.
   *
   * - **Ready**: No-op, returns `Promise.resolve(true)`.
   * - **Uninitialized**: No-op, returns `Promise.resolve(true)` (caller should use `init()`).
   * - **Degraded**: Re-probes storage. On success, flushes the write queue and
   *     transitions to Ready. On failure, remains Degraded. Non-recoverable
   *     errors (SecurityError) short-circuit future retries.
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
    if (this._state !== PersistenceState.Degraded) {
      return true;
    }

    // Non-recoverable — skip probe entirely
    if (!this._recoverable) {
      return false;
    }

    // Re-probe storage
    try {
      localStorage.setItem(PROBE_KEY, PROBE_VALUE);
      localStorage.removeItem(PROBE_KEY);
    } catch (error) {
      this._lastError = error instanceof Error ? error.name : "UnknownError";
      if (this._lastError === "SecurityError") {
        this._recoverable = false;
      }
      return false;
    }

    // Probe succeeded — flush the write queue
    const pending = [...this._writeQueue];

    for (const entry of pending) {
      try {
        localStorage.setItem(this._prefix + entry.key, entry.json);
      } catch (error) {
        this._lastError = error instanceof Error ? error.name : "UnknownError";
        if (this._lastError === "SecurityError") {
          this._recoverable = false;
        }
        // Queue stays intact — already-flushed entries will be overwritten
        // on the next retry (idempotent writes).
        return false;
      }
    }

    // All flushed successfully
    this._writeQueue = [];
    this._state = PersistenceState.Ready;
    this._lastError = undefined;
    return true;
  }
}
