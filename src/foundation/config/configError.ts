/**
 * Custom error for ConfigManager operations.
 *
 * Thrown when:
 * - A config key is not found (get on missing key)
 * - A namespace is registered twice (duplicate registration)
 * - ConfigManager.get() is called before init()
 * - ConfigManager.get() targets a namespace not yet registered (init ordering hint)
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
