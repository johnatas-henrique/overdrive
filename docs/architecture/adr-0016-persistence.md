# ADR-0016: Persistence Interface

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                                     |
| **Domain**                | Foundation — Persistence                                              |
| **Knowledge Risk**        | LOW — Web Storage API, no Babylon dependency                          |
| **References Consulted**  | persistence.md GDD, MDN localStorage, Tauri/Electron storage patterns |
| **Post-Cutoff APIs Used** | None                                                                  |

## ADR Dependencies

| Field          | Value                                                          |
| -------------- | -------------------------------------------------------------- |
| **Depends On** | None (zero-dependency Foundation system)                       |
| **Enables**    | ConfigManager (load/save player prefs), GSM (save/resume race) |
| **Blocks**     | None                                                           |

## Context

### Problem Statement

The game needs a storage abstraction that works across all target platforms (web, Tauri, Electron) without coupling game code to any specific storage backend. MVP scope is small: save/load audio settings, control preferences, and (future) race state.

### Constraints

- Zero dependencies — no Babylon.js, no Event Bus, no game system imports
- Async-first interface — even though localStorage is synchronous, every public method returns `Promise<T>`
- Versioned payload — stored data carries a semver version; migration chain upgrades old saves
- Error isolation — a corrupted key never breaks other keys
- Degraded mode — when storage is unavailable (private browsing, quota), game continues without crashing

## Decision

### Architecture

```
                  ┌────────────────┐
                  │  IPersistence  │
                  ├────────────────┤
                  │ save<T>()      │
                  │ load<T>()      │
                  │ delete()       │
                  │ migrate()      │
                  │ registerMigration() │
                  │ retry()        │
                  └───────┬────────┘
                          │ implements
                  ┌───────┴────────┐
                  │ LocalStorageAdapter │ ← MVP backend
                  ├────────────────┤
                  │ IndexedDBAdapter │ ← Future: large saves (replays)
                  │ RemoteAdapter  │ ← Future: cloud saves
                  └────────────────┘
```

### State Machine

```
[Uninitialized] --init()--> [Ready] --error--> [Degraded] --retry()--> [Ready]
```

- **Uninitialized**: No backend selected. `save()`/`load()` throw.
- **Ready**: Backend operational.
- **Degraded**: Storage unavailable. Writes queue in memory (max 50), reads return `null`.

### Key Interfaces

```typescript
interface IPersistence {
  /** Initialize storage backend. Probes availability before marking Ready. */
  init(): Promise<void>;

  /** Save typed data to a namespaced key. Version wrapper added automatically. */
  save<T>(key: string, data: T): Promise<void>;

  /** Load typed data. Runs migration chain if stored version < current version. */
  load<T>(key: string): Promise<T | null>;

  /** Delete a key from storage. */
  delete(key: string): Promise<void>;

  /** Register a migration step. Called during system init (before any load). */
  registerMigration(from: string, to: string, fn: MigrationFn): void;

  /** Re-probe storage after a Degraded state. Flushes pending writes on success. */
  retry(): Promise<boolean>;

  /** Current state. */
  readonly state: PersistenceState;
}
```

### Payload Format

```typescript
interface PersistedEntry {
  version: string; // semver (e.g. "0.1.0")
  data: unknown;
  timestamp: number; // Date.now() at save time
}
```

### Init Order

Persistence is initialized early in Foundation Phase 0, before ConfigManager:

```
1. Event Bus (no deps)
2. Persistence (no deps)
3. ConfigManager (loads player prefs from Persistence)
4. GSM (may save/resume race state)
...
```

### Consumer API (Example)

```typescript
// ConfigManager init:
persistence.registerMigration("0.1.0", "0.2.0", (old) => ({
  ...old,
  newField: "default", // added in 0.2.0
}));

const prefs = await persistence.load<Settings>("settings");
if (prefs) applySettings(prefs);
```

## Alternatives Considered

| Alternative                  | Reason for Rejection                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| **IndexedDB direct**         | Overkill for MVP (3 keys, < 1KB each). Requires schema management, transactions, version upgrades.     |
| **Synchronous localStorage** | Impossible to migrate to IndexedDB later — every consumer would need refactoring.                      |
| **Remote / cloud saves**     | Out of scope for MVP. Future adaptor implements same `IPersistence` interface — zero consumer changes. |

Cross-platform note: Tauri and Electron provide the same Web Storage API (localStorage, IndexedDB) in their webview — no special adaptor needed for desktop builds. The `IPersistence` interface isolates storage decisions from the platform.

## Consequences

### Positive

- Zero engine coupling — pure TypeScript, testable with vitest in Node
- Async-first means IndexedDB or remote backend swap requires zero consumer changes
- Versioned payload + migration chain prevents data loss across builds during early development
- Degraded mode prevents crashes in private browsing / quota-exceeded scenarios

### Negative

- localStorage is synchronous under the hood — the microtask wrapping adds latency (~1ms per call). Acceptable for infrequent save/load (settings on boot, race state on pause).
- No cross-tab synchronization — two game tabs writing to the same key has undefined behavior (last write wins). Acceptable for MVP.

### Risks

- **Risk**: Migration chain grows stale if old versions are never tested
  **Mitigation**: Each migration is a pure function with unit tests (`load(version_1) → version_current`)
- **Risk**: Degraded mode queue grows unbounded
  **Mitigation**: Hard limit of 50 entries, FIFO eviction
- **Risk**: `retry()` always re-probes even for non-recoverable failures (private browsing)
  **Mitigation**: `retry()` checks _why_ the prior probe failed. Non-recoverable causes (e.g. `SecurityError` from private browsing) skip re-probe and remain Degraded until next app launch.

## GDD Requirements Addressed

| GDD Requirement   | How This ADR Addresses It                            |
| ----------------- | ---------------------------------------------------- |
| Async-first API   | All methods return `Promise<T>`                      |
| Versioned payload | `PersistedEntry.version` wraps each save             |
| Migration chain   | `registerMigration(from, to, fn)`                    |
| Key namespace     | Global `'overdrive_'` prefix                         |
| Error isolation   | Corrupted key → `null` return, other keys unaffected |
| Degraded mode     | Write queue + null reads + retry()                   |

## Performance Implications

- **CPU**: ~0.01ms per call (microtask + JSON serialize/parse + localStorage get/set)
- **Memory**: Write queue up to 50 entries × ~1KB each = ~50KB max

## Validation Criteria

- [ ] `init()` probes localStorage and enters Ready or Degraded
- [ ] `save()` + `load()` round-trip returns identical data
- [ ] `load()` for nonexistent key returns `null`
- [ ] Corrupted key returns `null`, other keys intact
- [ ] Degraded mode: writes queue, reads return `null`
- [ ] `retry()` re-probes and flushes queue on success
- [ ] Migration chain runs correctly: stored v0.1 → 0.2 → 0.3
- [ ] Missing migration → `MigrationError` thrown
- [ ] Key is stored as `'overdrive_settings'`, not `'settings'`
- [ ] All public methods return `Promise`

## Related Decisions

- None — Persistence is a root-level dependency with no upstream ADRs.

## Open Questions

1. **Race state save/resume (deferred to Alpha)**: The GDD lists GSM as a consumer for save-and-exit. This requires a snapshot of all simulation state (positions, fuel, tires, AI params) at pause time. The Simulation Snapshot ADR (#17) will define the snapshot format. Persistence provides the storage layer.
