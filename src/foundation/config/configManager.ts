import { ConfigError } from "./configError";

type ConfigStore = Map<string, object>;

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
    this._buildResolved(namespace);
  }

  /**
   * Get a config value by dot-separated key path.
   *
   * Reads from the resolved (env-overridden) config cache. If the namespace
   * has not been resolved yet, it is built lazily from the raw config.
   *
   * @param key - Dot-separated path (e.g., "teams.macklen.motor")
   * @returns The value at the resolved path
   * @throws {ConfigError} If ConfigManager is not initialized
   * @throws {ConfigError} If the key path cannot be resolved
   */
  get<T>(key: string): T {
    if (!this._initialized) {
      throw new ConfigError("ConfigManager not initialized");
    }

    const parts = key.split(".");
    const namespace = parts[0];
    const rest = parts.slice(1);

    // Ensure resolved cache is built for this namespace
    if (!this._resolved.has(namespace)) {
      const rawExists = this._store.has(namespace);
      if (!rawExists) {
        throw new ConfigError(
          `Key not found: ${key}. Possible init ordering issue — namespace not yet registered: ${namespace}`
        );
      }
      this._buildResolved(namespace);
    }

    const root = this._resolved.get(namespace);
    if (!root) {
      // Resolved is empty — raw store contained invalid data
      // _buildResolved already logged console.error
      throw new ConfigError(`Key not found: ${key}`);
    }

    // Traverse remaining path segments from the namespace root
    const value = rest.reduce<unknown>(
      (acc, part) => {
        if (!acc || typeof acc !== "object") {
          throw new ConfigError(`Key not found: ${key}`);
        }
        return (acc as Record<string, unknown>)[part];
      },
      root as Record<string, unknown>
    );

    if (value === undefined) {
      throw new ConfigError(`Key not found: ${key}`);
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
      console.error(
        `ConfigManager: cannot build resolved config for namespace '${namespace}' — raw config is invalid`
      );
      return;
    }

    // Deep clone: config objects are always JSON-serializable
    // (no functions, Dates, Maps, Sets — per ADR-0023 constraint)
    const resolved = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;

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
