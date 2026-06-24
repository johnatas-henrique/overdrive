# ADR-0017: Simulation Snapshot

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                                                                                    |
| **Domain**                | Foundation — state capture/restore                                                                                   |
| **Knowledge Risk**        | LOW — pure TypeScript interfaces + Web Crypto for SHA-256                                                            |
| **References Consulted**  | simulation-snapshot.md GDD, ADR-0001 (Event Bus), Web Crypto API spec, Colyseus docs, buffered-interpolation-babylon |
| **Post-Cutoff APIs Used** | None                                                                                                                 |

## ADR Dependencies

| Field          | Value                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------ |
| **Depends On** | ADR-0004 (Module Boundary — ISnapshotable is cross-module interface)                       |
| **Enables**    | Replay system, multiplayer sync (future), determinism verification, save-and-exit (future) |
| **Blocks**     | None                                                                                       |

## Context

### Problem Statement

Multiple features need a consistent way to capture and restore the full game simulation state: deterministic replay (record → rewind → compare), multiplayer state sync (authority sends snapshot → clients restore), and determinism verification (assert that same seed + same inputs → same outcome). Without a common interface, each system implements its own serialization, and the orchestrator must know about each system individually.

### Constraints

- Zero Babylon.js dependency — the ISnapshotable interface is pure TypeScript
- JSON format for MVP — debuggable, human-readable, no build step
- Two-tier hashing: fast FNV-1a for tick-level checks, SHA-256 for integrity
- Registration pattern — systems opt in by calling `register()` during init
- Full snapshots only — delta compression deferred to multiplayer implementation
- Systems own their snapshot schema — the manager only orchestrates

## Decision

### Architecture

```
                    ┌────────────────────────┐
                    │ SimulationSnapshot      │
                    │ (orchestrator)          │
                    ├────────────────────────┤
                    │ register(system)        │
                    │ takeSnapshot()          │
                    │ restoreSnapshot(snap)   │
                    │ getHashes()             │
                    └──────┬─────────────────┘
                           │ Map<systemId, ISnapshotable>
          ┌────────────────┼──────────────┬──────────────┐
          ▼                ▼              ▼              ▼
   ┌──────────┐    ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ Physics  │    │  Fuel    │   │  Tire    │   │ RM + AI  │
   │snapshot  │    │snapshot  │   │snapshot  │   │snapshot  │
   └──────────┘    └──────────┘   └──────────┘   └──────────┘

   Registration during system init (order matches pipeline order).
```

### Key Interfaces

```typescript
interface ISnapshotable {
  readonly systemId: string; // e.g. 'physics', 'fuel'
  serialize(): Record<string, unknown>; // JSON-compatible
  deserialize(state: Record<string, unknown>): void; // restore from serialized
  hash(): string; // deterministic — same state = same string
}

interface FullGameSnapshot {
  tick: number;
  timestamp: number; // Date.now() at capture
  systems: Record<
    string,
    {
      // keyed by systemId
      state: Record<string, unknown>;
      hash: string; // FNV-1a of serialized state
    }
  >;
  snapshotHash: string; // SHA-256 of all systems' state combined
}

interface ISimulationSnapshot {
  register(system: ISnapshotable): void;
  takeSnapshot(): FullGameSnapshot;
  restoreSnapshot(snapshot: FullGameSnapshot): void;
  getHashes(): Map<string, string>; // systemId → current hash
}
```

### Hashing Strategy

| Hash      | Algorithm     | Location                   | Use                                            | Speed |
| --------- | ------------- | -------------------------- | ---------------------------------------------- | ----- |
| Tick hash | FNV-1a 64-bit | In-system `hash()`         | Per-tick determinism check, replay validation  | ~50ns |
| Sync hash | SHA-256       | Manager's `takeSnapshot()` | Network sync integrity, save-file verification | ~1µs  |

**FNV-1a implementation** — pure TypeScript, zero dependencies:

```typescript
function fnv1a(data: string): string {
  let hash = 0xcbf29ce484222325n; // FNV offset basis (64-bit)
  const prime = 0x100000001b3n; // FNV prime (64-bit)
  for (let i = 0; i < data.length; i++) {
    hash ^= BigInt(data.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn; // force 64-bit
  }
  return hash.toString(16).padStart(16, "0");
}
```

**SHA-256** via Web Crypto API — standard, cross-platform, not deprecated. Available in all modern browsers (2014+), Node.js 15+, Tauri/Electron (webview). Secure-context gated (HTTPS/localhost) — satisfied in all our target environments.

```typescript
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

### Multiplayer Compatibility (Future)

Babylon.js 9.12.0 has **no built-in multiplayer** — Colyseus is the official recommendation. The ISnapshotable approach is fully compatible with Colyseus + `buffered-interpolation-babylon`:

| Layer                              | Role                          | What it sends                                          |
| ---------------------------------- | ----------------------------- | ------------------------------------------------------ |
| **ISnapshotable (this ADR)**       | Coarse-grained full state     | Full JSON on join/reconnect, tick hash for determinism |
| **Colyseus Schema**                | Fine-grained incremental sync | Binary delta of changed properties (per frame)         |
| **buffered-interpolation-babylon** | Smooth rendering              | Interpolated position/rotation from Colyseus state     |

The snapshot format is transport-agnostic — it can be sent via Colyseus `room.send()`, serialized into `@colyseus/schema`, or stored via IPersistence (ADR-0016).

### Snapshot Frequency

| Mode                     | Frequency              | Use                                            |
| ------------------------ | ---------------------- | ---------------------------------------------- |
| **Every tick** (default) | `takeEveryNthTick = 1` | Deterministic replay recording (high fidelity) |
| **Every Nth tick**       | `takeEveryNthTick = N` | Bandwidth optimization for multiplayer         |
| **On demand**            | Manual call            | Save-game, debug snapshot                      |

MVP default: every tick (`takeEveryNthTick = 1`). ~10KB per snapshot at 60Hz = ~600KB/s. Acceptable for debug builds; multiplayer will use `N > 1` or delta compression.

### Registration Pattern

```typescript
// During system init:
const snapshotManager = SimulationSnapshot.getInstance();
snapshotManager.register(physicsSystem); // systemId: 'physics'
snapshotManager.register(fuelSystem); // systemId: 'fuel'
snapshotManager.register(tireSystem); // systemId: 'tire'
snapshotManager.register(aiDriverSystem); // systemId: 'ai-driver'
snapshotManager.register(raceMgmtSystem); // systemId: 'race-management'
```

Systems register themselves during their `init()` call. The manager logs warnings for unregistered systems but does not block.

### Edge Cases

- **Duplicate systemId**: second `register()` throws `SnapshotError`
- **System throws during deserialize**: caught and logged — other systems restore normally
- **Empty snapshot** (zero registered): returns valid `FullGameSnapshot` with empty `systems` map
- **Snapshot during update**: caller guarantees snapshots happen after all systems have ticked (end of pipeline)

## Alternatives Considered

| Alternative                                          | Reason                                                                                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **structuredClone** instead of serialize/deserialize | Doesn't handle classes, Maps, Sets without replacer. JSON.stringify gives more control and is debuggable.                                                      |
| **hash.js npm package** for FNV-1a                   | Unnecessary — 20 lines of pure TypeScript. Zero deps is better for Foundation.                                                                                 |
| **Protobuf / Flatbuffers** for snapshot format       | Faster and smaller, but not human-readable. Introduces schema compilation. Premature optimization for MVP where snapshots are primarily for determinism debug. |
| **Delta-only sync** (no full snapshots)              | Impractical — initial join and reconnect need full state. Deltas are an optimization on top of full snapshots.                                                 |

## Consequences

### Positive

- Zero Babylon.js imports — testable in Node with vitest
- Full JSON snapshots are human-readable in logs and the debug overlay
- Two-tier hashing catches non-determinism at the tick level (FNV-1a) and integrity failures at the sync level (SHA-256)
- Registration pattern is open/closed — new systems add snapshot support without modifying the manager
- Colyseus compatibility ensures future multiplayer path

### Negative

- Full JSON snapshots at 60Hz produce ~600KB/s — significant for multiplayer bandwidth. Addressed by `takeEveryNthTick` config and future delta compression.
- SHA-256 via Web Crypto API requires Secure Context — not available on plain HTTP. Fine for localhost dev and HTTPS prod.

### Risks

- **Risk**: System implements `hash()` incorrectly (non-deterministic — uses Math.random, Date.now)
  **Mitigation**: `hash()` is the system owner's responsibility. Test: call `hash()` twice on same state → same result.
- **Risk**: Large snapshots block the pipeline (JSON.stringify is synchronous)
  **Mitigation**: MVP snapshots are tiny (~10KB, <0.5ms serialization). Future multiplayer can snapshot on a background schedule.

## GDD Requirements Addressed

| GDD Requirement                 | How This ADR Addresses It                             |
| ------------------------------- | ----------------------------------------------------- |
| ISnapshotable interface         | `serialize()`, `deserialize()`, `hash()`              |
| JSON snapshot format            | `Record<string, unknown>` — JSON.stringify-compatible |
| Two-tier hashing                | FNV-1a (tick) + SHA-256 (sync)                        |
| Registration pattern            | `register(system)` during system init                 |
| Full snapshots only             | `FullGameSnapshot` with all systems' state            |
| Snapshot frequency configurable | `takeEveryNthTick` parameter                          |

## Performance Implications

- **CPU**: FNV-1a ~50ns per system = ~400ns per full snapshot. JSON.stringify ~0.5ms (10KB). SHA-256 ~1µs.
- **Memory**: ~10KB per snapshot. At 60Hz with circular buffer of 600 frames = ~6MB (10 seconds of replay).
- **Network (future)**: Full snapshot ~10KB. With `takeEveryNthTick = 60` (1 snapshot/second) = ~600 bytes/s.

## Validation Criteria

- [ ] `register(physics)` makes physics state appear in `takeSnapshot()`
- [ ] Duplicate register throws `SnapshotError`
- [ ] `takeSnapshot()` → `restoreSnapshot()` → `hash()` matches original for all systems
- [ ] FNV-1a deterministic: same input → same hex string
- [ ] SHA-256 via `crypto.subtle.digest` produces expected hash
- [ ] Zero registered systems → valid empty snapshot, no error
- [ ] System throws during `deserialize()` → other systems restore correctly
- [ ] `takeEveryNthTick = 1` → snapshot every tick
- [ ] `takeEveryNthTick = 60` → snapshot once per second
- [ ] On-demand `takeSnapshot()` works regardless of tick interval

## Related Decisions

- ADR-0004 (Module Boundary Rules — cross-module interfaces)
- ADR-0016 (Persistence — storage layer for snapshots)
- Future: Colyseus ADR (multiplayer transport, delta compression, @colyseus/schema alignment)
