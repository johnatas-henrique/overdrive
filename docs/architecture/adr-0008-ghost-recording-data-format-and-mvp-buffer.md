# ADR-0008: Ghost Recording Data Format and MVP Buffer

## Status

Accepted

## Date

2026-07-27

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Core / Recording |
| **Knowledge Risk** | LOW — Ghost Recording is pure C# binary serialization. No engine APIs used in MVP. |
| **References Consulted** | `design/gdd/ghost-recording.md`, `docs/architecture/architecture.md` |
| **Post-Cutoff APIs Used** | None (pure C# memory buffer) |
| **Verification Required** | Buffer size verification at 22,500 tick cap, CRC integrity |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (for SimulationInput contract, tick pipeline, ReplayInitialState). ADR-0002 (for VehicleSimState schema) |
| **Enables** | Alpha ghost persistence, replay, cloud storage sharing |
| **Blocks** | None (MVP buffer is always discarded) |
| **Ordering Note** | Binary format must be finalized before Alpha ghost serialization begins |

## Context

### Problem Statement

Ghost Recording captures player input per completed Racing tick for future personal-best comparison and sharing. In MVP, the buffer is in-memory only and always discarded. The binary format must be stable across game versions to support future replay and sharing without format conflicts.

### Constraints

- MVP: buffer is in-memory only, always discarded on Results/Forfeit/Idle/Load failure
- Alpha: buffer serialized to binary file on personal best — must survive game version updates
- Continuous stream: 12 bytes/tick (3 × float32) for player's accelerateOut, brakeOut, steerOut
- Cap: 22,500 ticks (375s × 60 Hz) — a race cannot exceed this. If exceeded, buffer is marked non-serializable
- Edge events: standalone Pause events (5 bytes/event — tick_index + flags)
- ReplayInitialState: captured once at GO, contains configuration required to reproduce the race
- Ghost car visualization: opacity 0.4, URP Unlit + alpha blend, no collision, no engine audio

### Requirements

- Must capture exactly one `SimulationInput (accelerateOut, brakeOut, steerOut)` per completed Racing tick
- Must capture Pause edge events as separate stream (standalone lifecycle boundary)
- Must cap at 22,500 ticks — never discard oldest ticks or create replay without ReplayInitialState
- Must compute CRC32 per block (256 ticks) for integrity validation
- Must support LZ4 compression (optional, flagged in header). Dependency note (2026-08-05, unity-specialist): Unity's core API does not ship a managed LZ4 codec — the implementation must add an explicit LZ4 dependency (e.g. Unity.Collections `LZ4Codec`, available via the Unity.Collections package, or a third-party MIT codec). The header flag keeps the format codec-agnostic; the codec choice is an implementation decision made at build time, not a format change. Unity engine types are still avoided on the format path — LZ4 operates on raw byte blocks.
- Must not depend on Unity engine types (pure C# binary)

## Decision

Ghost Recording uses a **80-byte binary header** with **continuous input stream** (12 bytes/tick × 3 × float32) + **edge event stream** (5 bytes/event). MVP keeps the buffer in-memory and discards it unconditionally.

### Binary Format

```
┌─────────────────────────────────────────────────────────┐
│  80-byte Header                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ magic 0x47485354 ("GHST")   │ uint32 (4 B)         │ │
│  │ version                     │ uint16 (2 B) = 1     │ │
│  │ header_size                 │ uint16 (2 B) = 80    │ │
│  │ track_id                    │ uint16 (2 B)         │ │
│  │ player_id                   │ uint64 (8 B)         │ │
│  │ sim_seed                    │ uint64 (8 B)         │ │
│  │ race_time_ms                │ uint32 (4 B)         │ │
│  │ input_count                 │ uint32 (4 B)         │ │
│  │ edge_event_count            │ uint32 (4 B)         │ │
│  │ lap_split_count             │ uint16 (2 B)         │ │
│  │ flags (bitfield)            │ uint16 (2 B)         │ │
│  │ initial_state_bytes         │ uint32 (4 B)         │ │
│  │ input_stream_bytes          │ uint32 (4 B)         │ │
│  │ edge_stream_bytes           │ uint32 (4 B)         │ │
│  │ lap_stream_bytes            │ uint32 (4 B)         │ │
│  │ correction_stream_bytes     │ uint32 (4 B)         │ │
│  │ header_crc32                │ uint32 (4 B)         │ │
│  │ reserved (zeroed)           │ byte[14]  (14 B)     │ │
│  └─────────────────────────────────────────────────────┘ │
│                           Total = 80 bytes               │
│                                                            │
│  sim_seed note: header.sim_seed is authoritative.         │
│  ReplayInitialState.SimSeed MUST match for valid replay.  │
│                                                          │
│  Continuous Input Stream                                 │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ input_count × { accelerateOut, brakeOut, steerOut } │ │
│  │ each: float32 = 12 bytes/tick                       │ │
│  │ CRC32 every 256 ticks, final CRC32 at end           │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  Edge Event Stream                                       │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ edge_event_count × {                                │ │
│  │   tick_index : uint32,                              │ │
│  │   flags      : uint8  (bit 0 = Pause)               │ │
│  │ } = 5 bytes/event                                   │ │
│  │ CRC32 at end                                        │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ReplayInitialState (serialized at GO)                   │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ sim_seed, track_id, race_config_id,                 │ │
│  │ content_version_hash, difficulty_profile_id,        │ │
│  │ grid_assignment[16], car_ids[16],                   │ │
│  │ initial_fuel_state[16], initial_tire_state[16],     │ │
│  │ perfect_start_remaining_ticks                        │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Key Interfaces

```csharp
// MVP — in-memory only, no file I/O
public class GhostBuffer {
    public GhostBuffer(uint maxTicks = 22500);
    public void RecordTick(SimulationInput input);           // append to continuous stream
    public void RecordEdgeEvent(uint tickIndex, EdgeEventFlags flags);
    public GhostBufferStats GetStats();
    public void Discard();                                   // always called in MVP
    public bool IsSerializable { get; }                      // false only on attempted overflow beyond 22,500
}

[Flags]
public enum EdgeEventFlags : byte {
    None = 0,
    Pause = 1 << 0,
}

public struct GhostBufferStats {
    public uint TickCount;
    public uint EdgeEventCount;
    public uint EstimatedCompressedSize;    // ~105 KB for full race
}

// Alpha+ serialization
public class GhostSerializer {
    public static byte[] Serialize(GhostBuffer buffer, ReplayInitialState initialState);
    public static GhostFile Deserialize(byte[] data);        // validates header CRC32
}

// Lap Split (9 bytes each, per GDD)
public readonly struct LapSplit {
    public readonly byte LapNumber;
    public readonly uint TickIndex;
    public readonly uint LapTimeMs;
}

public class GhostFile {
    public readonly GhostHeader Header;
    public readonly ReadOnlyMemory<byte> ContinuousStream;
    public readonly ReadOnlyMemory<byte> EdgeStream;
    public readonly ReplayInitialState InitialState;
}

public readonly struct ReplayInitialState {
    public readonly ulong SimSeed;
    public readonly ushort TrackId;
    public readonly ulong RaceConfigId;
    public readonly uint ContentVersionHash;
    public readonly byte DifficultyProfileId;
    public readonly uint[] GridAssignment;   // [16], matches architecture.md uint[]
    public readonly uint[] CarIds;           // [16]
    public readonly float[] InitialFuel;       // [16]
    public readonly float[] InitialTireWear;   // [16]
    public readonly ushort PerfectStartRemainingTicks;  // 0 or 600
}
```

### MVP Lifecycle

```
Racing (each tick) → GhostBuffer.RecordTick(SimulationInput)
  └── If Pause consumed: GhostBuffer.RecordEdgeEvent(tickIndex, Pause)

Results → GhostBuffer.Discard()  (always in MVP — no file, no upload)
Forfeit → GhostBuffer.Discard()
Load failure → GhostBuffer.Discard()
Idle (from Results) → GhostBuffer.Discard()
```

### Alpha Persistence Gate

> **Note:** The cloud persistence architecture (service selection, auth, quota management, versioning) is selected at the Alpha decision point per ADR-0016. ADR-0008 defines only the binary format and the persistence trigger (PB → serialize → upload); the generic `ghostStorage` interface is implemented by the Alpha-selected provider — no provider API is named in this ADR.

```
Results → IsPersonalBest?
  ├── YES AND isSerializable:
  │     Serialize(GhostBuffer, ReplayInitialState)
  │     → Validate CRC32 → Write to local ghost cache (max 5)
  │     → ghostStorage.UploadAsync(key = "ghost_{trackId}_{playerId}")  // storage interface selected at the Alpha decision point (ADR-0016); no provider API is named here
  │     → On failure: retry queue (3 attempts, 1s→2s→4s)
  └── NO: Discard()
```

## Alternatives Considered

### Alternative 1: Tick-Per-Tick File Write

- **Description:** Write each tick's input to a file during the race.
- **Pros:** No memory buffer. Survives crash.
- **Cons:** File IO during gameplay ticks. 60 writes/second. Requires async file operations to avoid blocking the tick pipeline.
- **Rejection Reason:** In-memory buffer is simpler and introduces no IO latency into the tick pipeline. 264 KB is trivially stored in memory for a 375s race.

### Alternative 2: JSON/Text Format

- **Description:** Human-readable JSON array of inputs instead of binary.
- **Pros:** Debuggable, no binary parser needed.
- **Cons:** ~10× larger than binary (2.6 MB vs 264 KB). Parsing overhead on replay load.
- **Rejection Reason:** WebGL memory budget makes file size matter. Binary format with CRC integrity is appropriate for a competitive feature.

## Consequences

### Positive

- **Minimal footprint:** ~264 KB uncompressed, ~105 KB LZ4 for a full race. 2× that for the edge-event stream.
- **Tick-budget safe:** Append-only. No allocation per tick beyond `Array.Resize` amortized across the cap.
- **Format stability:** Binary header with version field enables forward-compatible reading.
- **Integrity:** CRC32 per 256-tick block catches corruption without reading the entire file.
- **Unmodified in MVP:** No ghost files, no cache, no upload. Buffer is always discarded.

### Negative

- **Format lock-in:** Once Alpha ships, changing the binary format requires version migration.
- **No cross-version replay guarantee:** Old-format ghosts may not replay on new game versions without explicit migration.
- **No mid-race save:** Buffer is in-memory only. Crash during race loses the ghost for that race.

### Risks

- **Tick cap exceeded:** A 375s race at 60 Hz = 22,500 ticks exactly. Any additional time (paused timer, extended presentation) does NOT increment activeRaceStepCount — only completed Racing ticks produce continuous records. Mitigation: activeRaceStepCount per ADR-0001 ensures the cap refers to racing time only.
- **Buffer size at cap:** 22,500 ticks × 12 bytes = 264 KB. With edge events and header, ~280 KB. Well within any platform's memory budget.
- **Alpha migration risk:** If the binary format changes between MVP and Alpha, existing ghost files become unreadable. Mitigation: version field in header enables format migration; retire old versions gracefully.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| ghost-recording.md | Continuous 12 bytes/tick (3 × float32) | GhostBuffer.RecordTick(SimulationInput) |
| ghost-recording.md | Edge events (Pause) as separate stream | GhostBuffer.RecordEdgeEvent(tick_index, flags) |
| ghost-recording.md | 22,500 tick cap | GhostBuffer(maxTicks: 22500); IsSerializable = false only on attempted overflow beyond 22,500 (a full valid race at exactly 22,500 remains serializable) |
| ghost-recording.md | 80-byte header with magic 0x47485354 | GhostHeader struct with all defined fields |
| ghost-recording.md | LZ4 compression (optional) | Flags bitfield in header; compression available in Alpha |
| ghost-recording.md | CRC32 per 256-tick block | Computed per block and at stream end |
| ghost-recording.md | MVP always discards | GhostBuffer.Discard() on Results/Forfeit/Idle/Load failure |
| ghost-recording.md | Alpha persistence on PB only | Alpha persistence gate defined above |
| ghost-recording.md | Ghost visualization (opacity 0.4, no collision, no audio) | Visual requirements documented for Alpha shader |
| simulation-architecture.md | ReplayInitialState captured at GO | ReplayInitialState struct defined for Alpha replay |

## Validation Criteria

- [ ] Buffer at 22,500 ticks = 264 KB continuous + ~1 KB edge events (measured, not estimated)
- [ ] CRC32 computed per 256-tick block — any single byte change invalidates exactly one block
- [ ] Buffer discarded on Results — verified via memory profiler (no leak)
- [ ] Buffer discarded on Forfeit — same verification
- [ ] `IsSerializable == false` only when RecordTick is called beyond 22,500 (attempted overflow); a race at exactly 22,500 ticks remains serializable
- [ ] Header magic + version validated on deserialize (Alpha forward compatibility)
- [ ] Ghost visualization: LOD0 car at opacity 0.4, URP Unlit shader, no collision, no engine audio (Alpha)

## Related Decisions

- ADR-0001: Manual Simulation Authority (ReplayInitialState, activeRaceStepCount, SimulationInput schema)
- ADR-0002: Vehicle Physics (VehicleSimState for ghost replay reconstruction)
