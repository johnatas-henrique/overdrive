# Simulation Snapshot

> **Status**: In Design
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-18
> **Implements Pillar**: Foundation — state container enabling replay, multiplayer, and determinism verification

## Overview

The Simulation Snapshot defines the `ISnapshotable` interface and the orchestrator that coordinates snapshots across all game systems. Every system that owns mutable state during a race (Physics, Fuel, AI, Tire Wear, etc.) implements `serialize()`, `deserialize()`, and `hash()`. The SimulationSnapshot manager takes full-game snapshots at configurable intervals — for replay recording, multiplayer sync, or determinism verification. The snapshot format in MVP is JSON (debuggable, inspectable) rather than binary (faster). Hash uses FNV-1a for tick-to-tick consistency checks (fast, non-cryptographic) and SHA-256 for authoritative sync snapshots.

The schema of each system's payload is not designed here — it emerges in Fase 1 when each system is implemented. This GDD defines the interface and the orchestration, not the data.

## Developer Fantasy

The developer implements three methods on their system — `serialize()`, `deserialize()`, `hash()` — and registers it with `SimulationSnapshot.register()`. From that moment, the system's state is captured in every snapshot, replayed in every replay, and verified in every determinism check. Adding snapshot support costs one registration call and three short methods. The debug overlay shows whether each system's snapshot hash matches the expected value — a single mismatched hash points directly to the buggy system.

## Detailed Design

### Core Rules

**1. ISnapshotable interface.** Every system with mutable runtime state implements this contract:

```ts
interface ISnapshotable {
  readonly systemId: string; // unique, e.g. 'physics', 'fuel'
  serialize(): Record<string, unknown>;
  deserialize(state: Record<string, unknown>): void;
  hash(): string; // deterministic hash of current state
}
```

`serialize()` returns a flat JSON-compatible object. `deserialize()` restores state from that object. `hash()` returns a deterministic string — same state → same hash, every time, regardless of platform.

**2. JSON snapshot format (MVP).** Snapshots are plain JSON objects. This makes them human-readable in logs, debuggable in the overlay, and trivially serializable for storage. Binary format (protobuf, flatbuffers) is an optimization path for bandwidth-constrained multiplayer, not an MVP concern.

**3. Two-tier hashing.**

| Hash      | Uses                                           | Algorithm                | Speed                        |
| --------- | ---------------------------------------------- | ------------------------ | ---------------------------- |
| Tick hash | Per-frame consistency check, replay validation | FNV-1a 64-bit            | ~50ns for typical state size |
| Sync hash | Network sync, save-file integrity              | SHA-256 (Web Crypto API) | ~1µs for typical state size  |

FNV-1a is not cryptographically secure — it is intentionally fast for tick-level checks. SHA-256 is only computed when a sync or save is requested, not every tick.

**4. Registration pattern.** During system init, each ISnapshotable system calls `SimulationSnapshot.register(system)`. The manager holds a `Map<string, ISnapshotable>` keyed by `systemId`. Duplicate registration throws `SnapshotError('System already registered: fuel')`.

**5. Snapshot frequency.** The manager can be configured to take snapshots:

- **Every tick** — for deterministic replay recording (high fidelity, high memory)
- **Every Nth tick** — for multiplayer delta sync (bandwidth optimization)
- **On demand** — for save-game or manual debug snapshot
  The frequency is a parameter of the manager, not the systems — systems always expose full state through `serialize()`.

**6. Full snapshot only for MVP.** Delta compression (computing diff between two snapshots) is deferred to multiplayer implementation. MVP always takes and restores full snapshots. The `ISnapshotable` interface is structured so that deltas can be implemented later without changing the systems — the manager computes the diff, not the systems.

### States and Transitions

```
[Uninitialized] --init()--> [Ready] --dispose()--> [Disposed]
```

| State             | Description                                                                        |
| ----------------- | ---------------------------------------------------------------------------------- |
| **Uninitialized** | Manager not created. `register()` and `takeSnapshot()` throw.                      |
| **Ready**         | Manager accepts system registrations. Snapshots can be taken on demand or on tick. |
| **Disposed**      | All systems unregistered. Internal data freed.                                     |

**Transitions:**

- Uninitialized → Ready: `SimulationSnapshot.init()` called
- Ready → Disposed: `SimulationSnapshot.dispose()` — calls `serialize()` one final time on all registered systems for potential recovery, then clears the registration map

### Interactions with Other Systems

The Simulation Snapshot is a data collector — it pulls state from registered systems and provides it to consumers. It never pushes data.

**Consumers (future):**

- **Replay System** → requests a snapshot at every Nth tick during recording; serializes the snapshot sequence to storage
- **Multiplayer** → calls `takeSnapshot()` on the authoritative server, sends the snapshot (or delta) to clients, who call `restoreSnapshot()` to synchronize
- **Persistence Interface** → stores the last snapshot before exit (save-and-exit for championship mode)
- **Dev Tools / Debug Overlay** → displays current hash per system, snapshot size, and frequency stats

**Producers (all ISnapshotable systems in Fase 1):**

- Physics/Handling — car position, velocity, rotation
- Fuel — fuel level per car
- Tire Wear — tire degradation per car
- AI Driver — AI internal state (target waypoint, current behavior)
- Race Management — lap counters, positions, race phase
- Collision — per-car collision state (none needed — stateless, events-only)

## Formulas

None. The Simulation Snapshot orchestrates capture and restore — it does not compute values. Each system's `hash()` implements its own deterministic hash function.

## Edge Cases

1. **System not registered.** `takeSnapshot()` encounters a system that hasn't registered via `register()`. It skips it (no snapshot entry for that system). Missing systems are logged as warnings — the game continues, but replay/multiplayer will lack that system's state.
2. **Duplicate systemId.** Two systems register with the same `systemId`. The second `register()` call throws `SnapshotError('System already registered: fuel')`.
3. **Corrupted snapshot on restore.** `deserialize()` throws for one system. The manager catches the error, logs it, and skips restoring that system — other systems restore normally. The game may behave unpredictably for the failed system, but does not crash.
4. **Hash mismatch on restore.** After `restoreSnapshot()`, a subsequent `hash()` check reveals the system's state does not match the expected hash. Logged as a warning — useful for detecting desync in multiplayer development.
5. **Empty snapshot.** `takeSnapshot()` with zero registered systems returns `{ systems: {}, timestamp, tick: 0 }` — valid but empty. Not an error.
6. **Snapshot during system update.** If `takeSnapshot()` is called while a system is mid-update (e.g. mid-physics-step), the serialized state may be inconsistent. The caller is responsible for calling snapshots only at fixed points in the game loop (e.g. after all systems have updated for the tick).

## Dependencies

**Zero.** The Simulation Snapshot defines its own interface and orchestrator. It makes no imports — every system brings its own ISnapshotable implementation.

## Tuning Knobs

None for gameplay. Developer-facing parameters:

- **Default tick interval** (default: 1) — take a snapshot every N ticks (1 = every tick for deterministic replay)
- **Warn on missing systems** (default: true) — whether to log warnings when a system hasn't registered

## Visual/Audio Requirements

None. Snapshots contain no visual or audio data — only structured game state.

## UI Requirements

**Debug Overlay integration:**

- Per-system hash value (current vs expected)
- Snapshot size per system (bytes)
- Last snapshot timestamp and tick number
- Registration status (green = registered, red = missing, grey = not applicable)

## Acceptance Criteria

1. `ISnapshotable` implemented by a test system — `serialize()` returns its state, `deserialize()` restores it, `hash()` produces a deterministic string.
2. `SimulationSnapshot.register(system)` makes the system visible to `takeSnapshot()`.
3. `takeSnapshot()` produces a `FullGameSnapshot` containing all registered systems' serialized state.
4. `restoreSnapshot(snapshot)` restores all systems to exactly the captured state — `hash()` confirms match.
5. Duplicate `register()` throws `SnapshotError`.
6. Two `takeSnapshot()` calls at the same tick produce identical snapshots (determinism).
7. A system that throws during `deserialize()` is skipped — other systems restore normally.
8. Zero registered systems — `takeSnapshot()` returns a valid empty snapshot, no error.

## Open Questions

None yet — schema details deferred to each system's implementation (Fase 1).
