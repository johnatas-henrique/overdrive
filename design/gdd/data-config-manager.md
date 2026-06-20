# Data & Config Manager

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Foundation — no pillar directly, all depend on it

## Overview

The Data & Config Manager is the central registry for all static game data. Every system publishes its configuration as a typed TypeScript module (`src/config/[system].ts`) and registers it at application startup. The Config Manager provides a `get<T>(key: string): T` interface — all config reads across the entire game go through this single method. It handles loading, caching, hot-reload (via Vite HMR), environment overrides, and access logging. It does not own any schema or business logic; validation is the responsibility of each publishing system via the type system. The Config Manager itself has zero dependencies on Babylon.js.

## Developer Fantasy

The developer edits a config file, saves it, and the game responds instantly without restart — hot-reload via Vite HMR. Every config access is logged, traceable, and inspectable through the debug overlay. Environment overrides (dev, staging, production) apply transparently — the same code picks up secrets in CI and local values in development without branches or .env switching. When something feels wrong in the game (AI too fast, fuel too cheap), the first debugging step is opening the Config Manager overlay and reading the live values. No guessing, no restarts.

## Detailed Design

### Core Rules

**1. Registration.** Every system must call `ConfigManager.register(namespace, config)` during its own initialization. The namespace must be unique and match the module name (e.g. `'teams'` for `src/config/teams.ts`). Duplicate registration throws `ConfigError`. Systems that depend on another system's config register a dependency, not an import — the consumer calls `config.get('teams.macklen.motor')`, never imports `TEAMS` directly.

**2. Environment Override.** Precedence from highest to lowest: 1. Environment variables (prefix `OVERDRIVE__`, double underscore as path separator) — e.g. `OVERDRIVE__TEAMS__MACKLEN__MOTOR=3` overrides `teams.macklen.motor` 2. Local config files in `src/config/` (gitignored overrides for dev) 3. Default config registered by each system
Environment variables override only leaf values (strings, numbers), not objects.

**3. Fail Fast.** `get<T>(key)` throws `ConfigError('Key not found: teams.invalid')` when the key does not exist. It never returns `undefined`. Missing config is a programming error — the game should not recover silently.

**4. Caching & Hot-Reload.** The first `get()` for a key reads the config value and caches it for the session lifetime. Hot-reload (Vite HMR) invalidates the entire cache for the affected namespace; the next `get()` re-reads. Single keys are not individually invalidated — granularity is per-namespace.

**5. Access Logging.** Every `get()` call is recorded with key, caller identity (caller module or stack hint), and timestamp. The internal ring buffer retains the last 500 accesses for the debug overlay. When the overlay is not active, only errors and invalid-key lookups are retained.

### States and Transitions

```
[Uninitialized] --register()--> [Ready] --HMR--> [Ready] (cache invalidated)
                          \--get()--> throws ConfigError
```

| State             | Description                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Uninitialized** | No `register()` has been called yet. `get()` throws `ConfigError('ConfigManager not initialized')`.                  |
| **Ready**         | At least one namespace registered. Cache active. Hot-reload (HMR) invalidates the entire cache; state remains Ready. |

**Transitions:**

- Uninitialized → Ready: first successful `register()` call
- Ready → Ready (HMR): all cached values for the affected namespace are cleared; stale values are never served
- Hot-reload failure: error is logged, stale cache is preserved, state stays Ready

### Interactions with Other Systems

The Data & Config Manager has the simplest interaction pattern in the game: it is a pure data provider. Every system interacts with it in exactly two ways:

1. **Publish:** call `ConfigManager.register('namespace', config)` during system init to make its configuration available
2. **Consume:** call `config.get<T>('namespace.key')` to read any other system's configuration

There is no reverse dependency — the Config Manager never calls into any system. It does not emit events, it does not mutate state. Hot-reload is driven by the module system (Vite HMR), not by configuration changes.

**Known consumers (all 30 other systems):**

- Every system reads at least its own config during initialization
- Systems like AI Driver, Fuel, Tire Wear, Economy will read cross-system configs (e.g. fuel efficiency from TeamConfig)
- Dev Tools reads the access log ring buffer for the debug overlay

## Formulas

None. The Config Manager stores, resolves, and retrieves values — it does not compute or transform any data.

## Edge Cases

1. **Duplicate namespace.** `register('teams', ...)` called twice → throws `ConfigError('Namespace already registered: teams')`. This is a programming error — two systems trying to own the same namespace.
2. **HMR with invalid payload.** If the hot-reloaded module exports a format that does not match the expected shape, the Config Manager logs the error and preserves the stale cache. The game never runs with partial or corrupted config.
3. **Empty env var key.** `OVERDRIVE__=3` (empty namespace) → ignored with a console warning. `OVERDRIVE_______TEAMS__MOTOR=3` (excessive underscores) → parsed as nested path with empty intermediate segments, ignored with warning.
4. **Cross-config init race.** System A calls `get('B.key')` during B's `register()` call — B may or may not have registered yet. The caller is responsible for initialization ordering. Config Manager does not defer or queue.
5. **Unlimited key depth.** `get('a.b.c.d.e.f')` traverses without an arbitrary depth limit — though practical configs are expected to be at most 4 levels deep (namespace.group.field.subfield).

## Dependencies

**Zero.** The Data & Config Manager is the root of the entire dependency graph. No system, engine module, or third-party library is required before it initializes.

## Tuning Knobs

None for gameplay. The only configurable parameters are developer-facing:

- **Log buffer size** (default: 500) — number of access entries retained for the debug overlay
- **logAllAccess** (default: false in production, true in dev) — when false, only errors and invalid-key lookups are retained in the ring buffer

## Visual/Audio Requirements

None. The Config Manager produces no visual or audio output.

## UI Requirements

**Debug Overlay integration** — a read-only tree view of every registered namespace with:

- Current values (post-env-override) for each key
- Last 500 access entries (key, caller, timestamp), newest first
- Visual indicator when a config has been overridden by env var (highlighted differently from defaults)
- Namespace list with registration order and timestamp

The overlay is consumed via a `configManager.getDebugState(): DebugState` method — the overlay system reads, it never writes.

## Acceptance Criteria

1. `ConfigManager.init()` executes before any dependent system init — zero runtime failures from uninitialized config.
2. `register('teams', {...})` followed by `get('teams.macklen.motor')` returns the correct value from default config.
3. `get('nonexistent.key')` throws `ConfigError('Key not found: nonexistent.key')` — never returns `undefined` or `null`.
4. `OVERDRIVE__TEAMS__MACKLEN__MOTOR=3` set as env var → `get('teams.macklen.motor')` returns `3` (env override wins over default).
5. `register('teams', ...)` called a second time → `ConfigError('Namespace already registered: teams')`.
6. After HMR triggers on a config file change, `get('teams.macklen.motor')` returns the new value, not the cached stale value.
7. After 600 calls to `get()`, the ring buffer contains exactly the last 500 entries (FIFO eviction).
8. `configManager.getDebugState()` returns an object with all namespaces, current values, and access log — never throws.

## Open Questions

Resolved:

- **Hot-reload merge strategy:** A — Replace. Namespace is fully replaced on HMR. Each config file must export the complete object. No deep merge — this prevents stale fields from persisting silently after removal.
