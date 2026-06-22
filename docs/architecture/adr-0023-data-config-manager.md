# ADR-0023: Data & Config Manager

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                                                                                                                     |
| **Domain**                | Foundation — Data / Configuration                                                                                                                     |
| **Knowledge Risk**        | LOW — pure TypeScript. Zero Babylon.js APIs.                                                                                                          |
| **References Consulted**  | data-config-manager.md GDD, architecture.md Module Ownership                                                                                          |
| **Post-Cutoff APIs Used** | None                                                                                                                                                  |
| **Verification Required** | `get<T>(key)` throws ConfigError for missing keys; env override `OVERDRIVE__NS__KEY` applies before cached value; HMR invalidates per-namespace cache |

## ADR Dependencies

| Field             | Value                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Depends On**    | None                                                                                                                          |
| **Enables**       | All systems that read config (every system in the game)                                                                       |
| **Blocks**        | ADR-0004 (Module Boundaries — config reads are the single data path), all systems that register or read config during init    |
| **Ordering Note** | Init Phase 0 — first Foundation system to initialize. No other system can register or read config before Config Manager init. |

## Context

### Problem Statement

Every system in the game needs configuration values — physics constants (baseGrip, steerClampSpeed), upgrade curves (fuel efficiency L1–L5), AI parameters (aggression, mistakeChance), camera knobs, audio volumes, track data, lap counts. Without a central config registry, each system reads values differently (some from JSON, some from hardcoded objects, some from env vars), creating an inconsistent debugging experience and making it impossible to hot-reload values during development.

### Constraints

1. **Zero engine dependency** — Config Manager must live in the Foundation layer (ADR-0004), which cannot import `@babylonjs/core`.
2. **Environment-specific values** — Dev, staging, and production may need different values (API URLs, debug flags) without code changes.
3. **Hot-reload support needed** — Developers edit TypeScript config files and expect instant feedback via Vite HMR without game restart.
4. **Security: no secrets** — The game config system is for tuning data only. Secrets (API keys, tokens) are loaded from environment variables and consumed directly, not through the Config Manager.

## Decision

### Decision 1: `get<T>(key)` throws on missing, never returns undefined

All config reads use `get<T>(key: string): T`. If the key does not exist, it throws `ConfigError('Key not found: ...')`. This makes missing config a compile-time-style error — the game stops, the developer fixes the key. Never returning `undefined` eliminates an entire class of "silent failure" bugs.

#### Alternatives Considered

- **Return `T | undefined`** — Rejected. Callers would need `if (value === undefined)` checks everywhere, or use non-null assertions `value!`, defeating type safety.
- **Return `T` with default fallback** — Rejected. A fallback hides the fact that a required key is missing. Defaults belong in the config file, not in the getter.

### Decision 2: `register(namespace, config)` with duplicate detection

Systems call `register(namespace, config)` during their init. Namespace uniqueness is enforced — duplicate registration throws `ConfigError`. No filesystem auto-discovery: the dependency graph is explicit and visible in init code.

#### Alternatives Considered

- **Auto-discovery via `import.meta.glob`** — Rejected. Implicit registration makes it harder to trace where a namespace comes from. HMR invalidation also requires knowing which namespace changed, which is explicit with manual registration.
- **Single global object** — Rejected. Breaks environment override and access logging — cannot intercept reads without a method call.

### Decision 3: Environment variable override

`OVERDRIVE__NAMESPACE__KEY=value` overrides the registered config value at the leaf level. Double underscore is the path separator (because single underscore appears in config keys). Only leaf values (strings, numbers) are overridden — objects cannot be replaced partially.

Precedence: env var > local override file > registered default.

#### Alternatives Considered

- **`.env` files only** — Rejected. `.env` is loaded at Vite build time; runtime env vars (e.g., `process.env.OVERDRIVE__API_URL`) are more flexible for CI/CD.
- **Override entire namespace** — Rejected. Replacing an entire config object from env vars is fragile and hard to debug. Leaf-level overrides are self-documenting.

### Decision 4: Vite HMR invalidates per-namespace cache

When a config module changes via HMR, the entire namespace cache is invalidated. The next `get()` re-reads from the original registered config (with env overrides still applied). Granularity is per-namespace, not per-key — the cost of invalidating an entire namespace is negligible (~100 keys).

#### Alternatives Considered

- **Per-key granularity** — Rejected. Tracking which keys changed requires diff logic. Namespace-level invalidation is simpler and equally correct.
- **Full cache flush** — Rejected. Clearing all namespaces on any single change means unrelated systems lose their cached values unnecessarily.

### Decision 5: Access logging ring buffer

Every `get()` records `{ key, caller, timestamp }` in a ring buffer (500 entries). When the debug overlay is active, the full buffer is available. When inactive, only errors and invalid-key lookups are retained.

### Decision 6: Init ordering hint

When `get()` is called for a namespace that has not yet been registered, the error message includes: `ConfigError('Possible init ordering issue — namespace not yet registered: ...')`. This reduces debugging time when two systems have a dependency order problem.

## Consequences

### Positive

- **Single data path** — Every config read across the entire game goes through one typed method. Traceable, loggable, debuggable.
- **HMR without ceremony** — Developer edits a config file, Vite hot-reloads it, next tick picks up new values. No restart needed.
- **Environment-aware** — Same code works in dev, CI, and production. Overrides are explicit and visible.
- **Linha zero extra bundle** — Config Manager is pure TypeScript logic (~200 lines). All config files are tree-shakeable.
- **Fail-fast** — Missing config keys are caught at the first `get()` call, not silently ignored.

### Negative

- **Manual registration** — Every system must explicitly call `register()` in its init. Forgetting a registration causes a runtime error on first `get()`.
- **No schema validation** — Config Manager trusts TypeScript types. If a system exports `{ speed: "fast" }` instead of `{ speed: 300 }`, the type catches it at compile time but the Config Manager does not validate at runtime.

### Risks

- **Risk**: HMR module order — if a config module is hot-reloaded before the system that consumes it, the system may read stale values for one frame.
  **Mitigation**: One frame of stale config is invisible to the player. HMR is a development-only concern.
- **Risk**: Env var leakage — `OVERDRIVE__` prefix is generic; a host environment variable that happens to start with `OVERDRIVE__` could accidentally override a config value.
  **Mitigation**: Only leaf-level overrides apply. Non-existent namespaces are silently ignored.

## Performance Implications

- **CPU**: `get<T>()` is a single object traversal (`key.split('.').reduce()`) — ~0.0001ms per call
- **Memory**: `Map<string, object>` with ~200 entries total (all systems combined). Ring buffer 500 entries × ~80 bytes = ~40KB max.

## Validation Criteria

- [ ] `get<T>('nonexistent.key')` throws `ConfigError`
- [ ] `register('dup', {})` followed by `register('dup', {})` throws `ConfigError`
- [ ] `OVERDRIVE__TEAMS__MACKLEN__MOTOR=3` overrides `config.get('teams.macklen.motor')` to `3`
- [ ] HMR invalidation clears namespace cache; next `get()` reads updated value
- [ ] `getDebugState()` returns all namespaces with current values and env overrides
- [ ] Init ordering hint includes the hint text for unregistered namespace access

## GDD Requirements Addressed

| GDD Requirement                               | How This ADR Addresses It                                     |
| --------------------------------------------- | ------------------------------------------------------------- |
| Typed `get<T>(key)` throws on missing         | `ConfigError` on any missing key — never `undefined`          |
| `register(namespace, config)` with uniqueness | Duplicate namespace throws `ConfigError`                      |
| Env override with `OVERDRIVE__` prefix        | Leaf-value override via double-underscore path                |
| HMR hot-reload with cache invalidation        | Per-namespace cache clear on Vite HMR                         |
| Access logging ring buffer (500 entries)      | Every `get()` recorded with key, caller, timestamp            |
| `getDebugState()` for overlay                 | Read-only snapshot of all namespaces                          |
| Init ordering hint                            | Error message includes hint when namespace not yet registered |
