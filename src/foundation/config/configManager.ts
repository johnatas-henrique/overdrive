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
 */
export class ConfigManager {
  private _initialized = false;
  private _store: ConfigStore = new Map();

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
   * Stores the config object under the given namespace, then applies
   * any matching environment variable overrides (ADR-0023 Decision 3).
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
    this._applyEnvOverrides(namespace);
  }

  /**
   * Get a config value by dot-separated key path.
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

    // Check if the root namespace exists to provide init ordering hint
    const root = this._store.get(namespace);
    if (!root) {
      throw new ConfigError(
        `Key not found: ${key}. Possible init ordering issue — namespace not yet registered: ${namespace}`
      );
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
   * Scan process.env for `OVERDRIVE__` prefixed keys matching this namespace
   * and apply leaf-level overrides to the stored config.
   *
   * Env var format: `OVERDRIVE__{NAMESPACE}__{KEY_PATH}`
   * Example: `OVERDRIVE__TEAMS__MACKLEN__MOTOR=3` overrides
   * `get('teams.macklen.motor')` to `3`.
   *
   * Empty key segments (e.g. `OVERDRIVE__TEAMS____MOTOR`) trigger a
   * `console.warn` and are skipped. Only leaf values (string, number) are
   * overridden — object values are skipped.
   *
   * Note: overrides are applied in-place on the registered config object
   * (not a clone). This is intentional — env var &gt; default per ADR-0023.
   * If the config object is frozen, this method will throw at runtime.
   */
  private _applyEnvOverrides(namespace: string): void {
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

      // Traverse stored config to the parent of the leaf
      const config = this._store.get(namespace) as Record<string, unknown>;
      let current: Record<string, unknown> = config;
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
