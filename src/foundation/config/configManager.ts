import { ConfigError } from "./configError";

type ConfigStore = Map<string, object>;

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
}
