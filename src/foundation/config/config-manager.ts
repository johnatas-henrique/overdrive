import { ConfigError } from "./config-error";

type ConfigStore = Map<string, object>;

/** A single config value change detected by reload(). */
export interface ConfigChange {
  key: string;
  old: unknown;
  new: unknown;
}

/** Entry in the access log ring buffer. */
interface AccessEntry {
  key: string;
  caller: string;
  timestamp: number;
}

/** Read-only debug snapshot returned by getDebugState(). */
export interface DebugState {
  namespaces: Record<string, object>;
  accessLog: AccessEntry[];
  envOverrides: string[];
}

/**
 * Coerce an environment variable string to a number if it represents
 * a finite numeric value, otherwise return the string as-is.
 *
 * - `"3"`        → `3`     (number)
 * - `"0"`        → `0`     (number)
 * - `"-5"`       → `-5`    (number)
 * - `"Macklen"`  → `"Macklen"` (string)
 * - `"Infinity"` → `"Infinity"` (string — not finite)
 */
// ---------------------------------------------------------------------------
// ConfigManager singleton
// ---------------------------------------------------------------------------

let _configManagerInstance: ConfigManager | null = null;

/**
 * Register the ConfigManager singleton instance.
 * Must be called once during init phase 0.
 */
export function setConfigManager(instance: ConfigManager): void {
  _configManagerInstance = instance;
}

/**
 * Return the registered ConfigManager singleton instance.
 *
 * @throws {Error} If setConfigManager() has not been called
 */
export function getConfigManager(): ConfigManager {
  if (!_configManagerInstance) {
    throw new Error(
      "ConfigManager not initialized. Call setConfigManager(cm) first."
    );
  }
  return _configManagerInstance;
}

function _coerceEnvValue(value: string): string | number {
  const num = Number(value);
  if (Number.isFinite(num)) {
    return num;
  }
  return value;
}

/**
 * Central configuration registry for the game.
 *
 * Init Phase 0 — first Foundation system to initialize.
 * All systems register their config via `register()` during init,
 * then read values via `get<T>(key)`.
 *
 * Key design decisions (ADR-0023):
 * - `get<T>()` throws ConfigError on missing key — never returns undefined
 * - Namespace uniqueness enforced — duplicate register throws
 * - Init ordering hint when namespace not yet registered
 * - Env override via `OVERDRIVE__NS__KEY` on register()
 * - Two-tier storage: raw config in `_store`, env-overridden clone in `_resolved`
 * - Per-namespace cache invalidation via `invalidateNamespace()` for HMR
 */
export class ConfigManager {
  private _initialized = false;
  private _store: ConfigStore = new Map();
  private _resolved: ConfigStore = new Map();
  private _accessLog: AccessEntry[] = [];
  private _logAllAccess: boolean = true;

  /**
   * Initialize the ConfigManager.
   * Must be called before any `get()` call.
   * Idempotent — safe to call multiple times.
   */
  init(): void {
    this._initialized = true;
  }

  /**
   * Register a config namespace.
   *
   * Stores the raw config object under the given namespace, then builds
   * a resolved (env-overridden) copy in the internal cache.
   *
   * @param namespace - Unique namespace key (e.g., "teams", "physics")
   * @param config - Config object to store under this namespace
   * @throws {ConfigError} If the namespace is already registered
   */
  register(namespace: string, config: object): void {
    if (!this._initialized) {
      throw new ConfigError("ConfigManager not initialized");
    }
    if (this._store.has(namespace)) {
      throw new ConfigError(`Namespace already registered: ${namespace}`);
    }
    this._store.set(namespace, config);
    try {
      this._buildResolved(namespace);
    } catch (error) {
      // Clean up: remove the namespace if build failed (e.g., non-serializable)
      this._store.delete(namespace);
      throw error;
    }
  }

  get<T>(key: string): T {
    if (!this._initialized) {
      this._recordAccess(key, "production");
      throw new ConfigError("ConfigManager not initialized");
    }

    const { rest, root } = this._ensureNamespace(key);
    const value = this._traversePath(root, rest);

    if (value === undefined) {
      this._recordAccess(key, "production");
      throw new ConfigError(`Key not found: ${key}`);
    }

    // Log successful access (only when logAllAccess is true)
    if (this._logAllAccess) {
      let caller = "";
      try {
        caller = (new Error().stack as string).split("\n")[2].trim();
      } catch {
        // Stack trace unavailable (non-V8 engine, minified code, or restricted
        // environment) — leave caller as empty string.
      }
      this._recordAccess(key, caller);
    }

    return value as T;
  }

  /**
   * Invalidate the resolved cache for a single namespace.
   *
   * When a Vite HMR update replaces a config file, call this to clear
   * the cached resolved config. The next `get()` will re-read from the
   * raw registered config (with env overrides still applied).
   *
   * If the raw config for the namespace is invalid (null, undefined,
   * not a plain object), the stale cache is preserved and an error is
   * logged to assist debugging.
   *
   * Invalidating an unregistered namespace is a safe no-op.
   *
   * @param namespace - Namespace to invalidate
   */
  invalidateNamespace(namespace: string): void {
    if (!this._store.has(namespace)) {
      return;
    }

    const raw = this._store.get(namespace);
    if (!this._isValidConfig(raw)) {
      console.error(
        `ConfigManager: invalid payload for namespace '${namespace}' — cache not cleared (stale value preserved)`
      );
      return;
    }

    this._resolved.delete(namespace);
  }

  /**
   * Reload all config namespaces: invalidate cached resolved configs,
   * re-apply environment overrides, and return any value changes.
   *
   * Called by Dev Tools (reload key) to force a configuration refresh.
   * Config values are registered programmatically at init time, so this
   * primarily re-evaluates env overrides.
   *
   * @returns Array of changed key paths with old and new values.
   *          Empty array when no values changed.
   */
  reload(): ConfigChange[] {
    if (!this._initialized) return [];

    // Snapshot current resolved values before invalidation
    const snapshot = this._flattenResolved();

    // Invalidate all namespaces and rebuild from raw configs
    for (const [namespace] of this._store) {
      this.invalidateNamespace(namespace);
      try {
        this._buildResolved(namespace);
      } catch {
        // Namespace stays without resolved cache;
        // next get() will attempt rebuild on demand
      }
    }

    // Snapshot new resolved values and diff
    const newValues = this._flattenResolved();
    const changes: ConfigChange[] = [];

    for (const [key, oldVal] of snapshot) {
      const newVal = newValues.get(key);
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ key, old: oldVal, new: newVal });
      }
    }

    return changes;
  }

  /**
   * Flatten all resolved config namespaces into dot-path key to value map.
   */
  private _flattenResolved(): Map<string, unknown> {
    const flat = new Map<string, unknown>();
    for (const [namespace] of this._store) {
      const resolved = this._resolved.get(namespace);
      if (resolved) {
        this._flattenObject(
          namespace,
          resolved as Record<string, unknown>,
          flat
        );
      }
    }
    return flat;
  }

  /**
   * Recursively flatten an object into dot-path entries.
   */
  private _flattenObject(
    prefix: string,
    obj: Record<string, unknown>,
    result: Map<string, unknown>
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = `${prefix}.${key}`;
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        this._flattenObject(fullKey, value as Record<string, unknown>, result);
      } else {
        result.set(fullKey, value);
      }
    }
  }

  /**
   * Build the resolved (env-overridden) config for a namespace and
   * store it in the internal resolved cache.
   *
   * Clones the raw config from `_store` so env overrides never mutate
   * the registered config object. Applies `OVERDRIVE__`-prefixed env
   * var overrides to the clone, then caches the result in `_resolved`.
   *
   * If the raw config is invalid (not a plain object), an error is
   * logged and the resolved cache is NOT updated — any existing stale
   * cache remains accessible.
   *
   * @param namespace - The namespace to build
   */
  private _buildResolved(namespace: string): void {
    const raw = this._store.get(namespace);

    if (!this._isValidConfig(raw)) {
      throw new ConfigError(
        `ConfigManager: cannot build resolved config for namespace '${namespace}' — raw config is invalid`
      );
    }

    // Deep clone, preserving undefined values for debug tree rendering.
    // Non-serializable values (circular refs) are still rejected.
    let resolved: Record<string, unknown>;
    try {
      resolved = this._deepClone(raw as Record<string, unknown>);
    } catch {
      throw new ConfigError(
        `ConfigManager: namespace '${namespace}' contains non-serializable values (functions, circular references, etc.). All config values must be JSON-serializable per ADR-0023.`
      );
    }

    // Apply env overrides to the clone
    this._applyEnvOverridesToClone(namespace, resolved);

    this._resolved.set(namespace, resolved);
  }

  /**
   * Validate that a payload is a non-null, non-array, plain object
   * suitable as a config namespace value.
   */
  private _isValidConfig(payload: unknown): payload is object {
    return (
      payload !== null &&
      payload !== undefined &&
      typeof payload === "object" &&
      !Array.isArray(payload)
    );
  }

  /**
   * Deep-clone a plain object, preserving `undefined` values.
   *
   * Unlike `JSON.parse(JSON.stringify(obj))`, this does NOT strip
   * `undefined` — leaf values with `undefined` are preserved so that
   * debug overlays can display them as "—" (em dash).
   *
   * Circular references are detected and throw an error to prevent
   * infinite recursion.
   *
   * Uses the native `structuredClone()` under the hood (F-003), which
   * correctly handles arrays, Date, Map, Set, and other built-in types
   * that the previous hand-rolled clone skipped. Because `structuredClone`
   * throws on `undefined` values, we post-process the result to restore
   * `undefined` leaf values from the original object.
   *
   * @param obj - The object to clone
   * @returns A deep clone of the input object
   */
  private _deepClone(obj: Record<string, unknown>): Record<string, unknown> {
    // structuredClone handles the deep traversal including arrays,
    // nested objects, Date, Map, Set, etc. (F-003 — deep clone arrays).
    const clone = structuredClone(obj);

    // Restore undefined leaf values that structuredClone strips.
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        clone[key] = undefined;
      } else if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        // Recursively restore undefined leaves in nested objects
        clone[key] = this._deepClone(value as Record<string, unknown>);
      }
    }

    return clone;
  }

  /**
   * Ensure a dot-path key's namespace is resolved and return the root + segments.
   *
   * Extracted from `get()` and `setRuntime()` to eliminate duplicate namespace
   * resolution logic (AC-16).
   *
   * @param key - Dot-path key (e.g. "teams.macklen.motor")
   * @returns The namespace name, remaining segments, and resolved config root
   * @throws {ConfigError} If the key is empty or the namespace is not registered
   */
  private _ensureNamespace(key: string): {
    namespace: string;
    rest: string[];
    root: Record<string, unknown>;
  } {
    const parts = key.split(".");
    const namespace = parts[0];
    const rest = parts.slice(1);

    if (namespace === "") {
      throw new ConfigError(`Key not found: ${key}`);
    }

    // Ensure resolved cache is built for this namespace
    if (!this._resolved.has(namespace)) {
      const rawExists = this._store.has(namespace);
      if (!rawExists) {
        this._recordAccess(key, "production");
        throw new ConfigError(
          `Key not found: ${key}. Possible init ordering issue — namespace not yet registered: ${namespace}`
        );
      }
      this._buildResolved(namespace);
    }

    const root = this._resolved.get(namespace) as Record<string, unknown>;
    return { namespace, rest, root };
  }

  /**
   * Traverse a path of segments from a root object, returning the leaf value.
   *
   * Returns `undefined` if any segment is missing or the intermediate value
   * is not an object. Used by `get()` for type-safe config lookups (AC-16).
   */
  private _traversePath(
    root: Record<string, unknown>,
    segments: string[]
  ): unknown {
    return segments.reduce<unknown>((acc, part) => {
      if (!acc || typeof acc !== "object") return undefined;
      return (acc as Record<string, unknown>)[part];
    }, root);
  }

  /**
   * Record a single access in the ring buffer.
   *
   * Pushes `{ key, caller, timestamp }` into `_accessLog`. When the buffer
   * exceeds 500 entries, the oldest (first) entry is evicted.
   */
  private _recordAccess(key: string, caller: string): void {
    this._accessLog.push({ key, caller, timestamp: Date.now() });
    if (this._accessLog.length > 500) {
      this._accessLog.shift();
    }
  }

  /**
   * Control whether successful get() calls are logged.
   *
   * When disabled, only errors and invalid-key lookups are recorded in
   * the access log. The Dev Tools overlay can toggle this to reduce
   * memory overhead when the access log is not actively inspected.
   *
   * @param enabled - true to log all access (default), false to log only errors
   */
  setLogAllAccess(enabled: boolean): void {
    this._logAllAccess = enabled;
  }

  /**
   * Set a resolved config value at a dot-path key at runtime (dev-only).
   *
   * THIS IS A DEV-ONLY MUTATION API. It writes directly to the resolved cache
   * (`_resolved`), bypassing the raw registered config (`_store`). Changes are
   * ephemeral — they survive until the next `invalidateNamespace()` or `reload()`,
   * which re-read from `_store` and re-apply env overrides.
   *
   * The old value is returned so callers can format a notification string
   * (e.g. `"3 → 4"`).
   *
   * @param key - Dot-path key (e.g. `"teams.macklen.motor"`)
   * @param value - The new value to assign
   * @returns The previous value at that key (for diff messaging)
   * @throws {ConfigError} If the key does not exist in the resolved cache
   *
   * @see TR-DVT-003 — Config namespace inspector with in-place editing
   * @see ADR-0009 — Dev Tools Architecture (sole write exception)
   */
  setRuntime(key: string, value: unknown): unknown {
    if (!import.meta.env.DEV) {
      return undefined;
    }

    const { rest, root } = this._ensureNamespace(key);

    // Navigate to the parent of the leaf value
    let current: unknown = root;

    for (let i = 0; i < rest.length - 1; i++) {
      const segment = rest[i];
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object" ||
        Array.isArray(current) ||
        !(segment in current)
      ) {
        this._recordAccess(key, "production");
        throw new ConfigError(`Key not found: ${key}`);
      }
      current = (current as Record<string, unknown>)[segment];
    }

    const lastSegment = rest[rest.length - 1];
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object" ||
      Array.isArray(current) ||
      !(lastSegment in current)
    ) {
      this._recordAccess(key, "production");
      throw new ConfigError(`Key not found: ${key}`);
    }

    const oldValue = (current as Record<string, unknown>)[lastSegment];
    (current as Record<string, unknown>)[lastSegment] = value;
    return oldValue;
  }

  /**
   * Return a read-only snapshot of the current config state for debug/dev
   * tool overlays.
   *
   * The returned object contains:
   * - `namespaces` — every registered namespace, showing env-overridden values
   *   when the resolved cache is available, or the raw config otherwise.
   * - `accessLog` — a snapshot copy of the ring buffer (up to 500 entries).
   * - `envOverrides` — all active `OVERDRIVE__`-prefixed environment variables.
   *
   * This method NEVER throws.
   */
  getDebugState(): DebugState {
    const namespaces: Record<string, object> = {};

    for (const [ns, raw] of this._store) {
      const resolved = this._resolved.get(ns);
      const source = resolved ?? raw;
      try {
        namespaces[ns] = this._deepClone(source as Record<string, unknown>);
      } catch {
        // Non-serializable config — return a safe placeholder instead of crashing
        namespaces[ns] = { error: "non-serializable config" };
      }
    }

    const envOverrides: string[] = [];
    if (typeof process !== "undefined") {
      for (const key of Object.keys(process.env)) {
        if (key.startsWith("OVERDRIVE__")) {
          envOverrides.push(key);
        }
      }
    }

    return {
      namespaces,
      accessLog: this._accessLog.map((e) => ({ ...e })),
      envOverrides,
    };
  }

  /**
   * Scan process.env for `OVERDRIVE__` prefixed keys matching this namespace
   * and apply leaf-level overrides to the provided resolved config object
   * (a clone, not the raw store entry).
   *
   * Env var format: `OVERDRIVE__{NAMESPACE}__{KEY_PATH}`
   * Example: `OVERDRIVE__TEAMS__MACKLEN__MOTOR=3` overrides
   * `get('teams.macklen.motor')` to `3`.
   *
   * Empty key segments (e.g. `OVERDRIVE__TEAMS____MOTOR`) trigger a
   * `console.warn` and are skipped. Only leaf values (string, number) are
   * overridden — object values are skipped.
   */
  private _applyEnvOverridesToClone(
    namespace: string,
    resolved: Record<string, unknown>
  ): void {
    const namespaceUpper = namespace.toUpperCase();

    if (typeof process === "undefined") return;

    for (const [envKey, envValue] of Object.entries(process.env)) {
      if (!envKey.startsWith("OVERDRIVE__")) continue;

      // Split by __ to extract namespace and key path segments
      const parts = envKey.split("__");
      // parts[0] should be "OVERDRIVE"
      const keySegments = parts.slice(1);

      // Check for empty segments anywhere in the key path
      if (keySegments.some((s) => s === "")) {
        console.warn(`ConfigManager: empty key segment in env var ${envKey}`);
        continue;
      }

      // Namespace must match the one being registered
      const envNamespace = keySegments[0];
      if (envNamespace !== namespaceUpper) continue;

      // Convert remaining segments to lowercase key path
      const pathSegments = keySegments.slice(1).map((s) => s.toLowerCase());

      if (pathSegments.length === 0) continue;

      // Traverse resolved config to the parent of the leaf
      let current: Record<string, unknown> = resolved;
      let pathExists = true;

      for (let i = 0; i < pathSegments.length - 1; i++) {
        const segment = pathSegments[i];
        if (!current || typeof current !== "object" || !(segment in current)) {
          pathExists = false;
          break;
        }
        current = current[segment] as Record<string, unknown>;
      }

      if (!pathExists) continue;

      const lastSegment = pathSegments[pathSegments.length - 1];
      if (
        !lastSegment ||
        typeof current !== "object" ||
        !(lastSegment in current)
      ) {
        continue;
      }

      // Skip override if the existing value is an object (leafs only)
      const existingValue = current[lastSegment];
      if (existingValue !== null && typeof existingValue === "object") {
        continue;
      }

      current[lastSegment] = _coerceEnvValue(envValue as string);
    }
  }
}
