# Ghost Recording

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Rivals Make the Grid Personal

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | No player-facing ghost or replay feature. MVP preserves a recordable `SimulationInput` boundary per tick. |
| MVP architecture constraints | Input/race timing data must remain recordable without coupling simulation to ghost UI, CloudStorage, or network types. |
| Alpha | Local replay, ghost visualization, and CloudStorage ghost sharing. |
| Beta | Ghost functionality continues; real-time multiplayer is owned separately. |
| Release | Not designed. |

### Unassigned / Open Phase Decisions
- Cross-platform replay, ghost customization, and any remote discovery/catalog behavior are unassigned.

### Review Boundary
For MVP review, replay, storage format, CloudStorage, and ghost UI are non-blocking. They block MVP approval only if MVP input or simulation violates the recordable per-tick contract.

## Overview

**Ghost Recording** preserves the authoritative `SimulationInput` boundary at 60 Hz for the MVP and provides the future replay layer that can serialize the stream and replay it through the deterministic simulation loop. The MVP has no player-facing ghost or replay feature and no CloudStorage coupling. Alpha adds ghost visualization, local replay-integrity checks, and personal-best ghost sharing; any global leaderboard requires a separate future service and integrity architecture. Without the recordable boundary, future comparison across runs could not be added without changing the simulation contract.

**Interaction:** MVP-invisible — the player never interacts with the recordable boundary. In Alpha, they experience it as seeing their own ghost on track and racing against rival ghosts shared through CloudStorage.

**Why it exists:** Without ghost recording, each race exists in isolation. There's no memory of past performances, no way to see how you've improved, and no way to race against a friend's time. The system turns individual races into a persistent competitive thread.

## Player Fantasy

**Framing:** Indirect — the player never thinks about input recording, deterministic replay, or snapshot storage. They think about the rival on the grid, the ghost in their mirrors, and the time they need to beat. This system turns a saved performance into visible competition.

**Emotional target:** Anticipation. The moment you load a track and see a rival ghost already in position — translucent, pulsing, alive even when stopped. A saved time became a shape in space. You are about to race *them*, not a clock.

**Anchor moment:** The grid, five seconds before launch. A rival ghost is ahead of you. The countdown starts. You are about to race a rival you can almost touch.

**Pillar alignment:** Rivals Make the Grid Personal — every shared ghost represents a driver, and they are right there on the grid waiting for you.

**Design test:** Does the player look at the ghost before the lights go out? Do they glance at it during the race? If yes, the fantasy is landing. If they treat it as scenery, the system has failed.

## Detailed Design

### Core Rules

**1. Recordable Boundary and Recording Strategy**

At the GO lifecycle boundary, Simulation captures immutable `ReplayInitialState`. From the first Racing tick until Results or Forfeit, Simulation records the MVP in-memory boundary and always discards it. Ghost Recording becomes a runtime owner only in Alpha, when it may serialize a valid complete buffer, replay it, visualize it, and share personal-best artifacts.

**What is recorded:**

| Data | Rate | Size per sample | Purpose |
|------|------|----------------|---------|
| ReplayInitialState | Once at GO | Variable | Reconstruct race configuration and first Racing state without replaying Countdown |
| SimulationInput (accelerateOut, brakeOut, steerOut) | Per completed Racing tick (60 Hz) | 12 bytes | Replay the exact continuous input consumed by Vehicle Physics |
| Digital edges (Pause) | Standalone lifecycle boundary | 5 bytes/event | Replay a Pause request before the next continuous record |
| Simulation tick index | Per simulation tick | 4 bytes | Ordered replay sequence |
| Lap split events | Per lap boundary, Alpha | Variable | Optional split verification without duplicating sim_time every tick |

**What is NOT recorded:**
- AI rival inputs — regenerated from deterministic seed
- Full car state every tick — derived from replay
- Audio, camera, or visual state — cosmetic, not simulation
- Countdown Pause edges — the race stream has not started; only Racing Pause edges are recorded

**Input-to-tick mapping:** Each continuous record belongs to one completed Racing tick. A standalone Pause EdgeEvent may use a simulationStepCount that has no continuous record because the lifecycle boundary ends before physics. Replay processes every edge whose index precedes the next continuous record, then resumes continuous consumption after explicit Resume.

**MVP discard gate:** Every active race validates an in-memory buffer owned by Simulation. Results, Forfeit, load failure, or Idle always discards it; no file, PB comparison, replay, UI, or upload exists.

**Alpha persistence gate:** At Results, only a complete new local personal best serializes the buffer into a ghost file, validates integrity, persists locally, and uploads it for sharing. A non-PB or incomplete/capped run discards the buffer without a ghost file or upload.

**2. Storage Format (Alpha)**

Binary format with raw float32 input records + optional LZ4 compression:

```
Header (80 bytes)
  - magic: uint32 (0x47485354 "GHST")
  - version: uint16
  - header_size: uint16 (80)
  - track_id: uint16
  - player_id: uint64
  - sim_seed: uint64
  - race_time_ms: uint32
  - input_count: uint32
  - edge_event_count: uint32
  - lap_split_count: uint16
  - flags: uint16 (compressed, has_correction_stream)
  - initial_state_bytes: uint32
  - input_stream_bytes: uint32
  - edge_stream_bytes: uint32
  - lap_stream_bytes: uint32
  - correction_stream_bytes: uint32
  - header_crc32: uint32
  - reserved: byte[14]

ReplayInitialState Block
  - sim_seed (logically part of this block; serialized in file header for structural convenience)
  - race_config_id + content_version_hash
  - difficulty_profile_id
  - grid_assignment[16] + car_ids[16]
  - initial_fuel_state[16] + initial_tire_state[16]
  - perfect_start_remaining_ticks: uint16 (0 or 600 at GO)

Input Stream (compressed)
  - Raw `float32 accelerate`, `float32 brake`, `float32 steer` (12 bytes/tick)
  - LZ4 compressed blocks

Edge Event Stream (compressed)
  - EdgeEvent = tick_index:uint32 + flags:uint8
  - flags bit 0 = Pause

Lap Split Stream (Alpha)
  - LapSplit = lap_number:uint8 + tick_index:uint32 + lap_time_ms:uint32

Correction Snapshot Stream (Alpha architecture slot)
  - Optional versioned visual-trajectory snapshots required before cross-machine sharing
  - Cadence and encoded fields require an Alpha ADR; MVP does not capture this stream

File Integrity Table
  - CRC32 per continuous-input and edge-event block (256 ticks)
  - Final CRC32 of ReplayInitialState plus every present input, edge, lap, and correction stream
```

**Storage budget:** the continuous stream remains ~264 KiB uncompressed at the 22,500-tick cap, plus ReplayInitialState and small event streams. Current input-stream LZ4 target is ~105 KB compressed. Any future correction stream receives a separate Alpha budget before sharing is enabled.

**3. Replay Mechanism (Alpha)**

1. Validate the header, ReplayInitialState, stream sizes, and integrity tables
2. Load the exact compatible race configuration/content version and initialize all cars/resources from ReplayInitialState
3. Begin at the first Racing tick with `perfect_start_remaining_ticks` already applied; Countdown may be presented statically but is not simulated
4. Step simulation at 60 Hz fixed timestep
5. Before each continuous record, process any standalone Pause edge with an earlier/equal simulationStepCount; after Resume, inject the next recorded SimulationInput directly without live raw capture, dead zones, EMA, or device switching
6. AI generates its own inputs from seeded PRNG
7. Same-executable/same-environment local diagnostics compare against the original; cross-machine Alpha visualization additionally requires the future correction stream

**Playback speeds:** Real-time (1x) for ghost visualization, fast-forward (16x) for verification, frame-by-frame for debug.

**4. Ghost Visualization (Alpha)**

| Property | Value | Rationale |
|----------|-------|-----------|
| Opacity | 0.4 (40%) | Visible but distinct from player car |
| Color tint | Team livery with transparency | Preserves rival identity |
| Shader | URP Unlit + alpha blend + rim glow | Readable at speed |
| Collision | Disabled (trigger-only) | Ghosts are visual, not physical |

**HUD integration:** Time delta (+/- seconds), delta bar, lap split comparison, off-screen ghost indicator.

**5. Local Replay Integrity (Alpha)**

1. Ghost file is written with CRC32 coverage for continuous input and edge streams for corruption detection.
2. Client validates the CRC32 before replaying the file.
3. The local replay is used for ghost visualization and diagnostics.
4. Client-side replay and CRC32 detect file corruption only; they do not establish trust outside the local ghost artifact.
5. No global leaderboard exists in MVP, Alpha, or the current Beta relay design.

**6. Cloud Storage (Coherence, Alpha)**

- **Upload:** `cloudStorage.SaveObjectAsync(("ghost", "trackId_playerId"), ghostData)` for ghost sharing only.
- **Download:** `cloudStorage.LoadObjectAsync<string>(("ghost", "trackId_playerId"))`
- **Delete:** `cloudStorage.DeleteObjectAsync(("ghost", "trackId_playerId"))`
- **Requires:** PlayerAccount login to Coherence Cloud

**Note:** Deterministic replay depends on Vehicle Physics being deterministic. If a future ADR selects periodic state snapshots as a fallback, that format and its server-validation implications must be specified before implementation.

### States and Transitions

| State | Recording | Sim loop | Input captured | Ghost visible |
|-------|-----------|----------|---------------|---------------|
| `Idle` | No | No | No | No |
| `Recording` | Alpha Ghost ownership; MVP buffer remains Simulation-owned | Yes (live) | Yes (player) | Optional (Alpha rival ghosts) |
| `Paused` | Frozen | No | No | No |
| `Result` | Finalizing recorded race | No | No | No |
| `PendingUpload` | Personal-best artifact queued for CloudStorage | No | No | No |
| `Replay` | No | Yes (from file) | No (from file) | Yes (this ghost) |

**Transition rules:**

| From | To | Trigger |
|------|----|---------|
| `Idle` | `Recording` | Alpha receives complete ReplayInitialState at GO and first Racing record |
| `Recording` | `Paused` | RaceState → Paused |
| `Paused` | `Recording` | SimulationState returns to Racing after explicit Resume |
| `Recording` | `Idle` | `RaceAborted(Forfeit)` before Finished; discard partial recording and create no ghost file |
| `Paused` | `Idle` | `RaceAborted(Forfeit)` before Finished; discard partial recording and create no ghost file |
| `Recording` | `Result` | RaceState → Finished |
| `Result` | `PendingUpload` | New local personal best serialized into a valid ghost artifact |
| `Result` | `Idle` | Not a new local personal best |
| `PendingUpload` | `Idle` | Upload succeeds, or three retries fail and the artifact is persisted for next-launch retry |
| `Idle` | `PendingUpload` | Alpha boot recovery finds a persistent retry queue |
| `Results` | `Replay` | Player selects ghost to watch |
| `Replay` | `Results` | Replay ends or player exits; Simulation transitions back to Results and Ghost Recording cleans up |

### Interactions with Other Systems

| System | Direction | Data Flow | Timing |
|--------|-----------|-----------|--------|
| Simulation Architecture | Bidirectional | Sim → boundary: ReplayInitialState, continuous SimulationInput, standalone Pause edges; Alpha Ghost → Sim: initial state + recorded inputs/events | GO, completed Racing tick, lifecycle edge, or Replay tick |
| Race Session Manager | Inbound | RSM → Ghost: RaceStarted, LapCompleted, RaceFinished, RaceAborted events | Per lifecycle boundary |
| Content Pipeline | Inbound | Content → Ghost: track data reference for replay initialization | At Ready state |
| Coherence | Alpha / Deferred | Ghost → CloudStorage: upload ghost artifact; CloudStorage → Ghost: download rival ghost | Post-race / pre-race in Alpha only |
| HUD | Outbound | Ghost → HUD: time delta, lap splits, ghost indicator | Per sim tick |
| Global Leaderboard | Deferred | Requires a future dedicated leaderboard-service architecture | Not part of MVP, Alpha, or current Beta relay design |

## Formulas

### Continuous Input Record

`record[i] = (accelerateOut: float32, brakeOut: float32, steerOut: float32)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Accelerate | accelerate | float32 | 0.0 to 1.0 | Authoritative SimulationInput acceleration at tick i |
| Brake | brake | float32 | 0.0 to 1.0 | Authoritative SimulationInput brake at tick i |
| Steer | steer | float32 | -1.0 to 1.0 | Authoritative SimulationInput steering at tick i |

**Record Size:** 12 bytes per simulation tick. LZ4 compresses complete blocks but never changes the replay contract or introduces a delta dependency.

### Ghost Time Delta

`delta_seconds = ghost_race_time - player_race_time`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Ghost Race Time | ghost_race_time | float | 0-600s | Ghost's total race time |
| Player Race Time | player_race_time | float | 0-600s | Player's total race time |

**Output Range:** -600 to 600 seconds. Clamped to ±99.9s for HUD display.
**Example:** Ghost: 225.0s. Player: 226.3s. Delta = -1.3s. HUD shows "-1.3s" (ghost ahead).

### File Integrity Checksum

`block_crc[i] = CRC32(input_stream[i*256 .. (i+1)*256] + edge_events for that tick block)`
`final_crc = CRC32(replay_initial_state + input_stream + edge_stream + lap_stream + correction_stream)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Input Stream | input_stream | byte[] | variable | All encoded continuous input data |
| Edge Stream | edge_stream | byte[] | variable | All encoded Pause edge events |
| Initial State | replay_initial_state | byte[] | variable | Versioned first-Racing initialization block |
| Block CRC | block_crc[i] | uint32 | 0-4294967295 | CRC32 of continuous input and edge events for a 256-tick block |
| Final CRC | final_crc | uint32 | 0-4294967295 | CRC32 of initial state and every present stream |

## Edge Cases

- **If race resumes from pause:** The standalone Pause edge remains in the event stream and the next completed Racing tick appends the next continuous record. No fabricated continuous sample fills the paused boundary.
- **If player quits mid-race:** Discard partial recording. No ghost file created.
- **If completed result is not a new local personal best:** Discard the in-memory buffer. No ghost file or upload is created.
- **If file integrity check fails (checksum mismatch):** Ghost file is rejected as corrupt. The player is notified and the file is not used for replay.
- **If Coherence CloudStorage upload fails:** Retry in-session after 1s, 2s, and 4s. If all three attempts fail, retain the artifact in a persistent upload queue for retry on the next game launch.
- **If downloaded ghost fails file-integrity validation:** Reject ghost. Player notified. Ghost not added to selection pool.
- **If sim seed is missing from ghost file:** Cannot replay. Ghost file considered corrupt. Discard.
- **If ghost file is corrupted (invalid magic/header):** Discard file. Log error. No crash.
- **If multiple local ghosts exist for same track:** `LocalGhostCacheLimit = 5`; keep the fastest local files by race_time_ms and evict the slowest on overwrite. Any future remote discovery/catalog limit requires a separate architecture decision.
- **If recording reaches 22,500 continuous ticks:** Mark the run non-serializable and keep gameplay unaffected. Never discard oldest ticks or create a replay that lacks its ReplayInitialState and opening inputs.
- **If local replay diagnostics detect divergence:** Log the tick and diagnostic state. Do not use client-side diagnostics to establish any global score or ranking.

## Dependencies

| System | Direction | Type | Data Flow |
|--------|-----------|------|-----------|
| Simulation Architecture | Bidirectional | Hard | Simulation supplies ReplayInitialState, continuous input and standalone Pause events; Alpha Ghost returns the validated streams during Replay |
| Race Session Manager | Inbound | Hard | RSM supplies RaceStarted, LapCompleted, RaceFinished, RaceAborted events for lap-split recording and lifecycle hooks |
| Content Pipeline | Inbound | Soft | Content supplies track data reference for replay initialization at Ready state |
| Coherence | Alpha / Deferred | Future hard | Ghost → CloudStorage: upload ghost artifact; CloudStorage → Ghost: download rival ghost in Alpha only |
| HUD | Outbound | Soft | Ghost → HUD: time delta, lap splits, ghost indicator |
| Global leaderboard | Deferred | Future hard | No global leaderboard exists in MVP, Alpha, or the current Beta relay design; a future service decision owns any ranked feature. |

## Tuning Knobs

| Knob | Default | Range | Too Low | Too High |
|------|---------|-------|---------|----------|
| Recording Rate | Simulation tick rate | 60 Hz | Breaks authoritative replay contract | Adds no fidelity because simulation remains 60 Hz |
| Compression | LZ4 | None/LZ4/GZip | Larger files | Slower compression |
| LocalGhostCacheLimit | 5 | 1-20 | Limited history | Storage bloat |
| Replay Diagnostic Speed | 16x | 4x-32x | Slow diagnostics | Harder to inspect replay behavior |
| Ghost Opacity | 0.4 | 0.2-0.8 | Hard to see | Confusing with real car |
| Time Delta Clamp | ±99.9s | ±10s-±999s | Clips large deltas | Shows meaningless numbers |

## Visual/Audio Requirements

Ghost visualization requires:
- **Visual:** Transparent car model (40% alpha), rim glow shader, optional speed streak trail
- **Audio:** Ghost car should be silent (no engine audio) to avoid confusion with real car

## UI Requirements

Ghost-related UI:
- **Ghost selection menu:** List available personal-best and rival ghosts with time and track info
- **In-race HUD:** Time delta display, delta bar, lap split comparison
- **Post-race:** Ghost comparison summary (time gained/lost per lap)

## Acceptance Criteria

### MVP Recordable Boundary
- **AC-R1:** Given GO releases grid lock, When the first Racing tick is about to begin, Then Simulation captures one ReplayInitialState containing compatible race configuration, seed, DifficultyProfile, GridAssignment, car IDs, initial resources, and perfectStartRemainingTicks.
- **AC-R2:** Given race is in Racing, When a simulation tick completes after consuming SimulationInput, Then its accelerate, brake, and steer outputs plus tick index are appended exactly once.
- **AC-R3:** Given a Racing Pause edge ends the tick before physics, When the boundary is recorded, Then one standalone edge exists and no continuous sample is required for that same tick index.
- **AC-R4:** Given Results, Forfeit, load failure, or return to Idle in MVP, When the lifecycle boundary executes, Then ReplayInitialState and all in-memory streams are discarded without serialization, PB comparison, replay, UI, or upload.

### Storage (Alpha)
- **AC-S1:** Given a completed race improves the local personal best, When ghost file is saved, Then file size is ≤ 200 KB (compressed).
- **AC-S2:** Given ghost file is saved, When header is inspected, Then it contains magic, version, track_id, player_id, sim_seed, race_time_ms, input_count.
- **AC-S3:** Given an Alpha ghost file is inspected, When its header and initial block are validated, Then header_size is 80 bytes and ReplayInitialState contains all fields required to begin at the first Racing tick without simulating Countdown.

### Replay (Alpha)
- **AC-RP1:** Given a ghost file with a valid seed and SimulationInput records produced by the same executable and physical environment, When replay starts, Then ghost vehicle position matches the original simulation within ≤0.001 units at every simulation tick.
- **AC-RP2:** Given ghost replay is active, When ghost car is rendered, Then opacity is 0.4, collision is disabled, and ghost is visually distinct from player car.
- **AC-RP3:** Given ReplayInitialState has `perfect_start_remaining_ticks = 600`, When the first Racing replay tick begins, Then Vehicle Physics receives the same active Perfect Start multiplier state as the original run.

### File Integrity (Alpha)
- **AC-V1:** Given a saved ghost file, When it is loaded, Then CRC32 checksums are compared block-by-block before replay.
- **AC-V2:** Given all checksums match, When validation completes, Then the ghost is accepted for local replay and ghost sharing.
- **AC-V3:** Given checksum mismatch, When validation fails, Then the ghost is rejected as corrupt and is not used for replay.

### Cloud Storage (Alpha)
- **AC-CS1:** Given a new local personal best has been confirmed and serialized into a locally valid ghost file, When upload is requested, Then the ghost artifact is saved to Coherence CloudStorage with key ("ghost", "trackId_playerId").
- **AC-CS2:** Given ghost exists in CloudStorage, When download is requested, Then ghost data is retrieved and passes local file-integrity validation before replay.
- **AC-CS3:** Given CloudStorage upload fails, When failure is detected, Then retries occur after 1s, 2s, and 4s; if all fail, the artifact is retained in a persistent queue for retry on the next game launch.

### HUD
- **AC-H1:** Given ghost is ahead of player, When HUD updates, Then time delta shows negative value (e.g., "-1.3s").
- **AC-H2:** Given ghost is behind player, When HUD updates, Then time delta shows positive value (e.g., "+0.5s").
- **AC-H3:** Given ghost is off-screen, When HUD updates, Then directional indicator shows ghost position.

## Open Questions

- **Ghost limit per track:** Should there be a maximum number of ghosts visible simultaneously? (Recommendation: 1-3 ghosts max for performance and visual clarity)
- **Cross-platform replay:** Should ghosts recorded on PC be replayable on WebGL? (Depends on Vehicle Physics determinism across platforms)
- **Ghost customization:** Should players be able to customize ghost opacity/color? (Nice-to-have, not MVP)
