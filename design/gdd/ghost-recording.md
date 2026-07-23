# Ghost Recording

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-21
> **Implements Pillar**: Rivals Make the Grid Personal

## Overview

**Ghost Recording** is the input capture and replay layer that records player input at render frame rate during races, stores it alongside simulation state snapshots, and replays it through the same deterministic simulation loop to produce identical ghost car behavior. It enables two core features: ghost visualization (racing against your own best lap or a rival's ghost) and leaderboard verification (proving a time was achieved through legitimate play). Without this system, there would be no way to compare performances across runs, no ghosts to race against, and no way to verify that a leaderboard time was actually driven.

**Interaction:** Automatic — the player never interacts with it directly. They experience it as seeing their own ghost on track, racing against rival ghosts, and trusting that leaderboard times are legitimate.

**Why it exists:** Without ghost recording, each race exists in isolation. There's no memory of past performances, no way to see how you've improved, and no way to race against a friend's time. The system turns individual races into a persistent competitive thread.

## Player Fantasy

**Framing:** Indirect — the player never thinks about input recording, deterministic replay, or snapshot storage. They think about the rival on the grid, the ghost in their mirrors, the time they need to beat. This system is the invisible engine that turns numbers on a leaderboard into living, visible competition.

**Emotional target:** Anticipation. The moment you load a track and see the ghost already in position — translucent, pulsing, alive even when stopped. The leaderboard number just became a shape in space. You are about to race *them*, not a clock.

**Anchor moment:** The grid, three seconds before launch. The top-ranked ghost is ahead of you. The countdown starts. You are about to race a rival you can almost touch.

**Pillar alignment:** Rivals Make the Grid Personal — every time on the board is a driver, and they are right there on the grid waiting for you.

**Design test:** Does the player look at the ghost before the lights go out? Do they glance at it during the race? If yes, the fantasy is landing. If they treat it as scenery, the system has failed.

## Detailed Design

### Core Rules

**1. Recording Strategy**

Recording begins when the race transitions from Countdown to Racing. It ends when the race finishes or the player quits.

**What is recorded:**

| Data | Rate | Size per sample | Purpose |
|------|------|----------------|---------|
| Player input (accelerate, brake, steer) | Render frame rate (every Update()) | 12 bytes | Replay the player's exact driving |
| Simulation tick index | Paired with input | 4 bytes | Map render-frame input to sim ticks |
| Race clock (sim_time) | Per sim tick | 4 bytes | Timing reference for splits |
| Lap completion events | Per lap boundary | Variable | Lap split verification |

**What is NOT recorded:**
- AI rival inputs — regenerated from deterministic seed
- Full car state every tick — derived from replay
- Audio, camera, or visual state — cosmetic, not simulation

**Input-to-tick mapping:** Each sim tick reads the render-frame input sample whose timestamp is closest to the tick's sim_time. Multiple render frames between ticks use the latest sample (nearest-neighbor, no interpolation).

**2. Storage Format**

Binary format with delta encoding + optional LZ4 compression:

```
Header (64 bytes)
  - magic: uint32 (0x47485354 "GHST")
  - version: uint16
  - track_id: uint16
  - player_id: uint64
  - sim_seed: uint64
  - race_time_ms: uint32
  - input_count: uint32
  - flags: uint16 (verified, compressed)

Input Stream (compressed)
  - Delta-encoded floats (12 bytes/tick)
  - LZ4 compressed blocks

Checksum Table
  - CRC32 per input block (256 ticks)
  - Final CRC32 of full input stream
```

**Storage budget:** ~105 KB per race (compressed). Well under 10-15 MB target.

**3. Replay Mechanism**

1. Initialize simulation with sim_seed from ghost file header
2. Load track state from track_id
3. Set all 16 cars to grid positions
4. Step simulation at 60 Hz fixed timestep
5. At each sim tick, feed recorded player input
6. AI generates its own inputs from seeded PRNG
7. Simulation produces identical car states to original race

**Playback speeds:** Real-time (1x) for ghost visualization, fast-forward (16x) for verification, frame-by-frame for debug.

**4. Ghost Visualization**

| Property | Value | Rationale |
|----------|-------|-----------|
| Opacity | 0.4 (40%) | Visible but distinct from player car |
| Color tint | Team livery with transparency | Preserves rival identity |
| Shader | URP Unlit + alpha blend + rim glow | Readable at speed |
| Collision | Disabled (trigger-only) | Ghosts are visual, not physical |

**HUD integration:** Time delta (+/- seconds), delta bar, lap split comparison, off-screen ghost indicator.

**5. Leaderboard Verification**

1. Ghost file created with verified = false
2. Client runs full deterministic replay at 16x speed
3. At each 256-tick block, compute CRC32
4. At finish, compare final CRC32
5. If all match → verified = true
6. Upload verified ghost to Coherence CloudStorage

**6. Cloud Storage (Coherence)**

- **Upload:** `cloudStorage.SaveObjectAsync(("ghost", "trackId_playerId"), ghostData)`
- **Download:** `cloudStorage.LoadObjectAsync<string>(("ghost", "trackId_playerId"))`
- **Delete:** `cloudStorage.DeleteObjectAsync(("ghost", "ghostId"))`
- **Requires:** PlayerAccount login to Coherence Cloud

**Note:** Deterministic replay depends on Vehicle Physics being deterministic. If PhysX is used, periodic state snapshots are needed as fallback. This is documented as an assumption — the Vehicle Physics ADR will resolve this.

### States and Transitions

| State | Recording | Sim loop | Input captured | Ghost visible |
|-------|-----------|----------|---------------|---------------|
| `Idle` | No | No | No | No |
| `Recording` | Yes | Yes (live) | Yes (player) | Optional (rival ghosts) |
| `Paused` | Frozen | No | No | No |
| `Replay` | No | Yes (from file) | No (from file) | Yes (this ghost) |

**Transition rules:**

| From | To | Trigger |
|------|----|---------|
| `Idle` | `Recording` | RaceState → Active |
| `Recording` | `Paused` | RaceState → Paused |
| `Paused` | `Recording` | RaceState → Resumed |
| `Recording` | `Idle` | RaceState → Finished or quit |
| `Idle` | `Replay` | Player selects ghost to watch |

### Interactions with Other Systems

| System | Data Flow | Timing |
|--------|-----------|--------|
| Simulation Architecture | Ghost → Sim: tick + recorded input; Sim → Ghost: state for snapshots | Per sim tick |
| Input System | Input → Ghost: normalized values per frame | Per Update() |
| Coherence | Ghost → CloudStorage: upload verified ghost; CloudStorage → Ghost: download rival ghost | Post-race / pre-race |
| HUD | Ghost → HUD: time delta, lap splits, ghost indicator | Per sim tick |
| Leaderboard | Ghost → Leaderboard: submission data (only verified ghosts) | Post-verification |

## Formulas

### Input Delta Encoding

`delta[i] = input[i] - input[i-1]`
`encoded[i] = round(delta[i] * 1000)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Input | input[i] | float | -1.0 to 1.0 | Raw input sample at render frame i |
| Delta | delta[i] | float | -2.0 to 2.0 | Difference from previous sample |
| Encoded | encoded[i] | int16 | -2000 to 2000 | Fixed-point encoded delta |

**Output Range:** int16 (-32768 to 32767)
**Example:** Frame 100: steer = 0.30, Frame 101: steer = 0.32. Delta = 0.02. Encoded = 20.

### Ghost Time Delta

`delta_seconds = ghost_race_time - player_race_time`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Ghost Race Time | ghost_race_time | float | 0-600s | Ghost's total race time |
| Player Race Time | player_race_time | float | 0-600s | Player's total race time |

**Output Range:** -600 to 600 seconds. Clamped to ±99.9s for HUD display.
**Example:** Ghost: 225.0s. Player: 226.3s. Delta = +1.3s. HUD shows "-1.3s" (ghost ahead).

### Verification Checksum

`block_crc[i] = CRC32(input_stream[i*256 .. (i+1)*256])`
`final_crc = CRC32(all input_stream bytes)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Input Stream | input_stream | byte[] | variable | All encoded input data |
| Block CRC | block_crc[i] | uint32 | 0-4294967295 | CRC32 of 256-tick block |
| Final CRC | final_crc | uint32 | 0-4294967295 | CRC32 of full stream |

## Edge Cases

- **If recording starts mid-race (resume from pause):** Resume input capture from exact tick. No gap in recording.
- **If player quits mid-race:** Discard partial recording. No ghost file created.
- **If verification fails (checksum mismatch):** Ghost file marked verified = false. Not uploaded to leaderboard. Player notified.
- **If Coherence CloudStorage upload fails:** Ghost file retained locally. Retry on next session.
- **If downloaded ghost fails verification:** Reject ghost. Player notified. Ghost not added to selection pool.
- **If sim seed is missing from ghost file:** Cannot replay. Ghost file considered corrupt. Discard.
- **If ghost file is corrupted (invalid magic/header):** Discard file. Log error. No crash.
- **If multiple ghosts exist for same track:** Keep top 5 by race_time_ms. Evict oldest on overwrite.
- **If ghost recording uses too much memory (>5MB):** Cap recording at 22,500 frames. If race is longer, oldest frames are discarded (rolling buffer).
- **If replay desyncs during verification:** Log desync tick, compare states, reject upload with diagnostic.

## Dependencies

| System | Direction | Type | Data Flow |
|--------|-----------|------|-----------|
| Simulation Architecture | Bidirectional | Hard | Ghost → Sim: tick + input; Sim → Ghost: state for snapshots |
| Input System | Inbound | Hard | Input → Ghost: normalized values per frame |
| Coherence | Bidirectional | Hard | Ghost → CloudStorage: upload verified ghost; CloudStorage → Ghost: download rival ghost |
| HUD | Outbound | Soft | Ghost → HUD: time delta, lap splits, ghost indicator |
| Leaderboard | Outbound | Soft | Ghost → Leaderboard: submission data (verified only) |

## Tuning Knobs

| Knob | Default | Range | Too Low | Too High |
|------|---------|-------|---------|----------|
| Recording Rate | Render frame rate | 30-240 Hz | Loses input fidelity | Excessive storage |
| Compression | LZ4 | None/LZ4/GZip | Larger files | Slower compression |
| Max Ghost Files Per Track | 5 | 1-20 | Limited history | Storage bloat |
| Verification Speed | 16x | 4x-32x | Slow verification | May miss desyncs |
| Ghost Opacity | 0.4 | 0.2-0.8 | Hard to see | Confusing with real car |
| Time Delta Clamp | ±99.9s | ±10s-±999s | Clips large deltas | Shows meaningless numbers |

## Visual/Audio Requirements

Ghost visualization requires:
- **Visual:** Transparent car model (40% alpha), rim glow shader, optional speed streak trail
- **Audio:** Ghost car should be silent (no engine audio) to avoid confusion with real car

## UI Requirements

Ghost-related UI:
- **Ghost selection menu:** List available ghosts (personal best, rivals, leaderboard) with time and track info
- **In-race HUD:** Time delta display, delta bar, lap split comparison
- **Post-race:** Ghost comparison summary (time gained/lost per lap)

## Acceptance Criteria

### Recording
- **AC-R1:** Given race is active, When player provides input, Then input is recorded at render frame rate.
- **AC-R2:** Given race is paused, When recording resumes, Then input capture resumes from exact tick with no gap.
- **AC-R3:** Given player quits mid-race, When quit is detected, Then partial recording is discarded, no ghost file created.

### Storage
- **AC-S1:** Given a completed race, When ghost file is saved, Then file size is ≤ 200 KB (compressed).
- **AC-S2:** Given ghost file is saved, When header is inspected, Then it contains magic, version, track_id, player_id, sim_seed, race_time_ms, input_count.

### Replay
- **AC-RP1:** Given ghost file with valid seed and inputs, When replay starts, Then simulation produces identical car states to original race (within floating-point tolerance).
- **AC-RP2:** Given ghost replay is active, When ghost car is rendered, Then opacity is 0.4, collision is disabled, and ghost is visually distinct from player car.

### Verification
- **AC-V1:** Given ghost file, When verification runs at 16x speed, Then CRC32 checksums are compared block-by-block.
- **AC-V2:** Given all checksums match, When verification completes, Then ghost is marked verified = true.
- **AC-V3:** Given checksum mismatch, When verification fails, Then ghost is marked verified = false and not uploaded.

### Cloud Storage
- **AC-CS1:** Given verified ghost, When upload is requested, Then ghost is saved to Coherence CloudStorage with key ("ghost", "trackId_playerId").
- **AC-CS2:** Given ghost exists in CloudStorage, When download is requested, Then ghost data is retrieved and verified locally.
- **AC-CS3:** Given CloudStorage upload fails, When failure is detected, Then ghost file is retained locally for retry.

### HUD
- **AC-H1:** Given ghost is ahead of player, When HUD updates, Then time delta shows negative value (e.g., "-1.3s").
- **AC-H2:** Given ghost is behind player, When HUD updates, Then time delta shows positive value (e.g., "+0.5s").
- **AC-H3:** Given ghost is off-screen, When HUD updates, Then directional indicator shows ghost position.

## Open Questions

- **Ghost limit per track:** Should there be a maximum number of ghosts visible simultaneously? (Recommendation: 1-3 ghosts max for performance and visual clarity)
- **Cross-platform replay:** Should ghosts recorded on PC be replayable on WebGL? (Depends on Vehicle Physics determinism across platforms)
- **Ghost customization:** Should players be able to customize ghost opacity/color? (Nice-to-have, not MVP)
