# Persistence Interface

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Foundation — save/load infrastructure

## Overview

The Persistence Interface is a thin abstraction over browser storage APIs (localStorage for MVP). It provides `save(key, data)` and `load<T>(key)` that all systems use instead of calling `localStorage.setItem()` directly. The interface is async even though the underlying implementation uses synchronous localStorage — this prevents blocking the main thread when IndexedDB or a remote save backend is added later. Schema versioning is built in from day 0: each saved payload carries a version number, and the interface provides a `migrate()` hook so old saves can be upgraded on load.

## Developer Fantasy

The developer calls `save('settings', { audio: 0.8, invertY: true })` and the data is persisted. They call `load<Settings>('settings')` and get a typed object back. When the Settings schema gains a field in a new version, they add a `migrate(fromVersion, toVersion)` function — old saves are upgraded automatically on first load with the new binary. Serialization format, storage backend, and compression are all invisible to the caller.

## Detailed Design

### Core Rules

**1. Async-first.** Every public method returns `Promise<T>`. Even localStorage calls are wrapped in a microtask (`Promise.resolve().then(() => ...)`) to maintain the async contract. Systems never call raw `localStorage.setItem()`.

**2. Versioned payload.** Each saved entry is wrapped in a container: `{ version: number, data: unknown, timestamp: number }`. The version is the game build version (semver major.minor), not a separate persistence version. On `load()`, if the stored version < current version, the `migrate()` chain runs.

**3. Schema migration chain.** `Persistence.registerMigration(fromVersion, toVersion, fn)`. Migrations are registered during system init. On load, the interface walks the chain `storedVersion → storedVersion+1 → ... → currentVersion`, applying each migration in order. This allows incremental schema changes across multiple releases.

**4. Key namespace.** Each system owns a namespace: `'settings'`, `'career'`, `'replays'`. The interface prepends a global prefix (e.g. `'overdrive_'`) to avoid collisions with other web apps on the same domain.

**5. Error isolation.** A corrupted or unparseable save for one key never breaks other saves. Corrupted entries are logged and returned as `null` — the caller handles missing data gracefully.

### States and Transitions

```
[Uninitialized] --init()--> [Ready] --error--> [Degraded] --retry()--> [Ready]
```

| State             | Description                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Uninitialized** | No storage backend selected. `save()` and `load()` throw.                                                               |
| **Ready**         | Backend operational. Reads and writes succeed normally.                                                                 |
| **Degraded**      | Storage unavailable (private browsing, quota exceeded, corrupted DB). Reads return `null`, writes are queued in memory. |

**Transitions:**

- Uninitialized → Ready: `init()` detects available storage and runs a probe write
- Ready → Degraded: storage `set`/`get` fails (quota exceeded, write error)
- Degraded → Ready: `retry()` re-probes storage; succeeds if condition resolved
- Degraded persists: writes are queued in a memory buffer (max 50 entries); when storage recovers, the queue is flushed

### Interactions with Other Systems

The Persistence Interface is a passive data store — systems push data to it and pull data from it. It never pushes data to other systems.

**Known consumers (MVP scope):**

- **Settings / Configuration** → save/load audio, control, graphics preferences
- **Game State Machine** → save/load current race state (lap, positions, fuel, tires) for save-and-exit
- **Race Management** → save/load race results for championship progression (deferred to Alpha)

## Formulas

None. The Persistence Interface serializes, stores, retrieves, and deserializes — it does not compute or transform business data.

## Edge Cases

1. **Private browsing.** Safari and some Firefox private modes throw on `localStorage.setItem()`. The init probe detects this and marks the system as Degraded. Reads return `null`, writes queue in memory. The game works without persistence — no crash.
2. **Quota exceeded.** `localStorage` has ~5MB limit. If exceeded, the Degraded state activates. The memory queue starts discarding oldest entries (FIFO) once it hits 50 queued items.
3. **Corrupted save.** A stored JSON string that fails `JSON.parse()` is treated as corrupted. The corrupted entry is logged with key and size, and `load()` returns `null`. Other keys are unaffected.
4. **Migration not found.** If stored version is 0.5 and current version is 0.7, but only migration 0.5→0.6 is registered, the interface throws `MigrationError('Missing migration: 0.6 → 0.7')`. The save is not loaded — data integrity over availability.
5. **Cross-tab access.** Two game tabs open to the same domain share localStorage. The interface does not synchronize between tabs — the most recent tab to write wins. This is acceptable for MVP.
6. **Save during transition.** If `save()` is called while a game-state transition is in progress, it completes asynchronously — the caller does not wait. The save queues behind any in-flight write.

## Dependencies

**Zero.** The Persistence Interface uses only Web APIs available in every browser. It has no dependency on Babylon.js, Event Bus, or any game system.

## Tuning Knobs

None for gameplay. Developer-facing parameters:

- **Degraded mode queue size** (default: 50) — max entries in the in-memory write queue
- **Storage key prefix** (default: `'overdrive_'`) — global prefix to namespace all keys

## Visual/Audio Requirements

None. The Persistence Interface produces no visual or audio output.

## UI Requirements

None in MVP. Future: save file management screen (view saves, delete corrupted saves, backup export).

## Acceptance Criteria

1. `Persistence.init()` probes storage availability and enters Ready or Degraded state.
2. `save('settings', { audio: 0.8 })` followed by `load<Settings>('settings')` returns `{ audio: 0.8 }`.
3. `load<UserSettings>('nonexistent')` returns `null` — does not throw.
4. Corrupted data in storage — `load()` returns `null`, other keys unaffected.
5. Storage unavailable (simulated) — `init()` enters Degraded, writes queue in memory, reads return `null`.
6. Stored version < current version with registered migration — migration runs, data is returned at current version.
7. Missing migration for a version gap — `load()` throws `MigrationError`.
8. `localStorage` key is always prefixed (e.g. `'overdrive_settings'`, not raw `'settings'`).
9. All public methods return `Promise` — even if the underlying implementation is synchronous.

## Open Questions

None yet.
