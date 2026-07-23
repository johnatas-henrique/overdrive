# Multiplayer Architecture

> **Status**: In Design
> **Author**: User + Agents
> **Last Updated**: 2026-07-21
> **Implements Pillar**: Speed You Can Feel

## Overview

**Multiplayer Architecture** is the networking infrastructure layer that integrates the Coherence SDK into the simulation loop — defining how the 60 Hz local simulation communicates with the 60 Hz authoritative server, when data is sent, how client prediction handles the tick rate mismatch, and which Coherence features (Rooms, CloudStorage, KV Database, InputQueues) are used at each development phase. The system is designed in three tiers: MVP (single-player only, no network), Alpha (async ghosts + leaderboards via CloudStorage + KV Database), and Beta (real-time 16-player races via Rooms + relay + InputQueues with rollback). Without this system, there is no network communication, no matchmaking, no leaderboard persistence, and no real-time multiplayer.

**Interaction:** Automatic — the player never interacts with it directly. They experience it as leaderboard rankings, ghost availability, and eventually real-time races against other players.

**Why it exists:** Without multiplayer architecture, the game is single-player only. This system enables competitive features that extend the game's life beyond career completion.

## Player Fantasy

**Framing:** Indirect — the player never thinks about network protocols, replication servers, or packet frequencies. They think about the ghost on the grid, the name on the leaderboard, the presence of other racers in the world.

**Emotional target:** Witnessed solitude. The player is alone in the cockpit, but never alone in the world. The deepest feeling this architecture produces is not "I beat someone" but "I was here, and someone will know." The world feels alive without being crowded — ghosts, leaderboard names, and future opponents create presence without social noise.

**Anchor moment:** Pre-race. The player loads the track. The #1 ghost materializes on the grid — translucent, pulsing, alive. The player realizes: that was a person. That person exists. I am about to race their performance.

**Pillar alignment:** Every Short Race Matters — this system makes races permanent. Without it, a race evaporates. With it, every race becomes a record in a global ledger. Earn the Next Seat — the leaderboard creates the ranks that make "the next seat" a real, occupied place. You don't grind an abstract bar; you displace a specific person.

**Design test:** Do players describe multiplayer in language about people ("I can see the person I'm racing") rather than competition ("PvP," "matchmaking")? If yes, the fantasy is landing.

## Detailed Design

### Core Rules

**1. Network Phases Gate Feature Availability**

The game operates in three network phases. Each phase unlocks specific Coherence features and data flows. The phase is a build-time configuration, not a runtime toggle.

| Phase | Coherence SDK | Simulation | Data Flow |
|---|---|---|---|
| **MVP** | Disconnected (SDK present but not connected) | Local only, single-player | None |
| **Alpha** | Auth + CloudStorage + KV Database (async) | Local only, ghost re-simulation | Ghost upload/download, leaderboard read/write |
| **Beta** | Auth + Rooms + Lobbies + InputQueues + CloudStorage + KV Database (real-time) | Local prediction + remote state via relay | Full bidirectional input/state sync |

**2. Simulation Loop Integration**

The simulation runs at a fixed 60 Hz. In Beta, networking integrates via `CoherenceInputSimulation<TState>` which replaces the manual accumulator loop. The base class handles frame stepping, time synchronization, and input buffer management. The game implements four overrides:

- `SetInputs(CoherenceClientConnection)` — sample input axes into Coherence input
- `Simulate(long simulationFrame)` — apply inputs, call `Physics.Simulate(FIXED_DT)`
- `CreateState()` — snapshot all 16 car states (position, rotation, velocity)
- `Rollback(long toFrame, SimulationState)` — restore state and re-simulate

In MVP and Alpha, the manual accumulator loop is used (no Coherence networking).

**3. Input Packet Format (Shared Across All Phases)**

Input is the only data that crosses the network for real-time play. Fixed size, versioned.

| Field | Type | Size | Range | Description |
|---|---|---|---|---|
| `tick` | uint32 | 4 | 0–2³² | Simulation tick this input targets |
| `playerIndex` | byte | 1 | 0–15 | Player slot in the room |
| `flags` | byte | 1 | bitfield | Bit 0: throttle held, Bit 1: brake held, Bit 2: steer sign, Bit 3: boost, Bit 4: pit request |
| `steerRaw` | int16 | 2 | -32768–32767 | Normalized steering angle |
| `throttle` | byte | 1 | 0–255 | Analog throttle position |
| `brake` | byte | 1 | 0–255 | Analog brake position |
| `checksum` | uint32 | 4 | — | CRC32 integrity check |

**Total: 16 bytes per input, fixed size.**

**4. Client Prediction with Rollback (Beta)**

InputQueues implement GGPO-style rollback. The client predicts forward using local input and re-simulates when remote input arrives late.

| Step | Action |
|------|--------|
| 1 | Player presses input at render frame N |
| 2 | Input enqueued locally, simulation tick N runs with predicted input |
| 3 | Coherence delivers remote input for tick N (may arrive 1–3 ticks late) |
| 4 | If remote input matches prediction → no correction |
| 5 | If remote input differs → rollback to tick N, re-simulate N through current tick |
| 6 | Max rollback: 10 ticks (166 ms at 60 Hz) — beyond this, input is dropped |

**Prediction model:** Repeat last known input (simple, effective for racing where inputs change gradually).

**Rollback state:** Kinematic state only (position, rotation, velocity, angular velocity per car). PhysX runs locally for collision feel but is NOT part of canonical state. This ensures determinism across machines.

**5. Coherence Server Configuration**

| Parameter | Value | Description |
|---|---|---|
| `--send-frequency` | 60 Hz | Server → client state updates |
| `--recv-frequency` | 60 Hz | Client → server input submissions |
| `--max-players` | 16 | Per room (Beta) |

**Relay model:** Server forwards inputs between clients. No server-side simulation. Each client runs its own simulation and resolves discrepancies via rollback. Cheaper on free tier, simpler architecture.

**6. Ghost Data Flow (Alpha+)**

Ghost data is input-only (re-simulated, not state-snapshotted). Format defined in Ghost Recording GDD.

| Action | Timing | Coherence Feature |
|--------|--------|-------------------|
| Ghost upload | Post-race | CloudStorage.SaveObjectAsync(("ghost", "trackId_playerId"), ghostData) |
| Ghost download | Pre-race | CloudStorage.LoadObjectAsync<string>(("ghost", "trackId_playerId")) |
| Ghost delete | On overwrite | CloudStorage.DeleteObjectAsync(("ghost", "ghostId")) |

**Storage budget:** ~352 KB per ghost (22,500 ticks × 16 bytes). CloudStorage free tier (5 GB) supports ~14,500 ghosts.

**7. Leaderboard Data Flow (Alpha+)**

Leaderboard entries stored in Coherence KV Database.

**Key format:** `lb:{trackId}:{difficulty}`

**Value format (JSON):**
```json
{
  "playerId": "coherence_id",
  "playerName": "DriverX",
  "trackId": 1,
  "difficulty": 2,
  "bestLapTime": 72340,
  "totalTime": 361200,
  "finalPosition": 1,
  "ghostRef": "cloudstorage://ghosts/abc123.bin",
  "timestamp": 1721654400000
}
```

**Write rule:** Only personal best is submitted. Duplicate submissions with worse times rejected client-side.

**8. Leaderboard Submission Timing**

| Step | Action |
|------|--------|
| 1 | Player crosses finish line (or DNF) |
| 2 | Final results computed locally |
| 3 | Ghost file built from input stream |
| 4 | Ghost uploaded to CloudStorage → returns ghostRef |
| 5 | Leaderboard entry submitted to KV Database with ghostRef |
| 6 | Client receives confirmation or rejection |

**9. Real-Time Race Session Lifecycle (Beta)**

| Phase | Duration | Coherence Feature | Network Activity |
|---|---|---|---|
| **Lobby** | Variable | Lobbies + Rooms | Matchmaking, room join |
| **Ready** | 5 seconds | Room | Player sync, pre-load |
| **Race** | ~375 seconds (5 laps) | InputQueues + relay | 60 Hz input exchange |
| **Result** | 5–10 seconds | CloudStorage + KV DB | Ghost upload, leaderboard submit |

**10. Disconnection Handling**

| Scenario | Behavior |
|---|---|
| Brief disconnect (< 3s) | InputQueue buffers, client predicts, catch up via rollback on reconnect |
| Long disconnect (> 3s) | Pause simulation, "Reconnecting..." overlay, exponential backoff (1s→2s→4s→8s, max 30s) |
| Permanent disconnect | Race continues with AI filling disconnected slot. Last input replayed for 10 ticks, then AI takes over |
| All players disconnected | Room destroyed, race voided — no leaderboard submission |

**11. Data Flow Summary**

```
MVP (Disconnected):
  Player Input → Simulation → Render

Alpha (Async):
  Player Input → Simulation → Render
       │                      │
       ▼                      ▼
  Ghost File              Race Result
       │                      │
       ▼                      ▼
  CloudStorage            KV Database

Beta (Real-Time):
  Player Input → Ring Buffer → CoherenceInputSimulation
                                    │
                      ┌─────────────┼─────────────┐
                      ▼             ▼              ▼
                  InputQueues   CloudStorage    KV Database
                  (60 Hz)       (ghost on end)  (score on end)
                      │
                      ▼
                  Coherence Relay → Remote Clients
                      │
                      ▼
                  Rollback Re-sim (if input diverges)
```

### States and Transitions

| State | Description | Coherence Features | Simulation |
|---|---|---|---|
| `DISCONNECTED` | No network. Default for MVP. | None | Local only |
| `CONNECTED` | Authenticated with Coherence. | Auth, CloudStorage, KV Database | Local only |
| `IN_LOBBY` | Matchmaking search. | Lobbies | No simulation |
| `IN_ROOM` | Joined room, waiting for start. | Room, player slots | No simulation |
| `RACING` | Active race. Inputs exchanged. | InputQueues, relay, Room | Full 60 Hz sim with prediction/rollback |
| `RESULT` | Race ended. Results computed. | Room (connected) | Simulation stopped |
| `UPLOADING` | Ghost + score uploading. | CloudStorage, KV Database | No simulation |
| `RECONNECTING` | Connection lost. Exponential backoff. | Auth (reconnect) | Simulation paused |

**Transition rules:**

| From | To | Trigger |
|------|----|---------|
| `DISCONNECTED` | `CONNECTED` | `Connect()` succeeds |
| `CONNECTED` | `IN_LOBBY` | `JoinLobby()` |
| `IN_LOBBY` | `IN_ROOM` | Room found, `JoinRoom()` |
| `IN_ROOM` | `RACING` | All players ready or countdown expires |
| `RACING` | `RESULT` | Race finished or all cars finished |
| `RESULT` | `UPLOADING` | Ghost upload initiated |
| `UPLOADING` | `CONNECTED` | Upload complete |
| Any | `RECONNECTING` | `ConnectionLost()` |
| `RECONNECTING` | Previous state | Reconnect succeeds |
| `RECONNECTING` | `DISCONNECTED` | Max retries exceeded |

### Interactions with Other Systems

| System | Direction | Data | Contract |
|---|---|---|---|
| **Simulation Architecture** | Bidirectional | Fixed timestep, input, state | Network Tick fires at 60 Hz aligned to sim tick. CoherenceInputSimulation replaces manual accumulator in Beta. |
| **Ghost Recording** | Bidirectional | Input stream, ghost files | GhostRec produces ghost file on race end. Multiplayer uploads to CloudStorage. Downloads for playback. |
| **HUD** | Outbound | Time delta, rank, connection status, opponent positions | HUD reads ghost proximity, leaderboard rank, connection indicator (Beta), minimap dots. |
| **Leaderboard** | Bidirectional | Score entries, query results | KV Database stores entries. Client queries for display. Personal best checked before submit. |

## Formulas

### Bandwidth Per Client

`bandwidth = num_remote_cars × send_frequency × packet_size`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Remote Cars | num_remote_cars | int | 0–15 | Number of other players in the room |
| Send Frequency | send_frequency | int | 30–60 Hz | Coherence send rate |
| Packet Size | packet_size | int | 16 bytes | Fixed NetworkInput struct |

**Output Range:** 0–14,400 bytes/s (0.48 KB/s per remote car at 60 Hz)
**Example:** 15 remote cars × 60 Hz × 16 bytes = 14,400 bytes/s = 14.1 KB/s upload per client

### Rollback Cost

`rollback_cost = rollback_ticks × physics_cost_per_tick × num_cars`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Rollback Ticks | rollback_ticks | int | 0–10 | Number of ticks to re-simulate |
| Physics Cost Per Tick | physics_cost_per_tick | float | 0.05–0.1 ms | Cost per car per tick |
| Number of Cars | num_cars | int | 16 | Total cars in simulation |

**Output Range:** 0–16 ms (10 ticks × 0.1 ms × 16 cars)
**Example:** 5 ticks × 0.05 ms × 16 cars = 4 ms (within 16.6 ms frame budget)

### Ghost Storage Budget

`ghost_size = header_size + (total_ticks × input_size)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Header Size | header_size | int | 64 bytes | Fixed header + metadata |
| Total Ticks | total_ticks | int | 0–22,500 | Sim ticks in race (375s × 60 Hz) |
| Input Size | input_size | int | 16 bytes | NetworkInput struct |

**Output Range:** 64 bytes (empty) to 360,064 bytes (352 KB)
**Example:** 5-lap race: 64 + (22,500 × 16) = 360,064 bytes ≈ 352 KB

## Edge Cases

- **If Coherence connection drops mid-race (Beta):** InputQueue buffers last 10 ticks of remote inputs. Client continues predicting. On reconnect, rollback catches up if within window. If beyond 10 ticks, disconnected player's slot filled by AI.
- **If ghost download fails pre-race:** Retry with exponential backoff (3 attempts). If all fail, race starts without ghost. Ghost visualization skipped.
- **If ghost upload fails post-race:** Ghost file cached locally. Retry on next session. No leaderboard submission until ghost is verified.
- **If leaderboard submission receives duplicate (worse time):** KV Database rejects. Client notified "Not a personal best."
- **If all players disconnect simultaneously:** Room destroyed. Race voided. No leaderboard submission. No ghost upload.
- **If player joins room with mismatched track/car:** Room validation rejects join. Player returned to lobby.
- **If rollback exceeds 10 ticks:** Input is dropped. Client continues with predicted state. Acceptable for arcade gameplay — visual correction is smooth.
- **If WebGL client cannot maintain 60 Hz:** Simulation slows via spiral-of-death clamp (same as single-player). Network tick rate drops proportionally. Other clients see slight delay but no desync.
- **If Coherence free tier limit is reached (5 GB storage):** Oldest ghosts evicted. Personal bests protected. Leaderboard entries preserved.

## Dependencies

| System | Direction | Type | Data Flow |
|--------|-----------|------|-----------|
| Simulation Architecture | Bidirectional | Hard | Sim → Network: fixed timestep, input, state. Network → Sim: remote inputs, rollback triggers |
| Ghost Recording | Bidirectional | Hard | Ghost → Network: ghost file for upload. Network → Ghost: downloaded ghost for playback |
| HUD | Downstream | Soft | Network → HUD: ghost proximity, leaderboard rank, connection status, opponent positions |
| Settings | Downstream | Soft | Settings → Network: network quality preferences (bandwidth cap, ghost quality) |

## Tuning Knobs

| Knob | Default | Range | Too Low | Too High |
|------|---------|-------|---------|----------|
| Server Send Frequency | 60 Hz | 30–60 Hz | Choppy remote car positions | Excessive bandwidth |
| Server Recv Frequency | 60 Hz | 30–60 Hz | Input delay for remote clients | Server overload |
| Max Rollback Ticks | 10 | 5–15 | More input drops, visual pops | Higher CPU cost per frame |
| Ghost Upload Timeout | 15s | 5–30s | Upload fails on slow connections | Long post-race wait |
| Reconnect Max Retries | 5 | 3–10 | Premature disconnect | Long reconnection delay |
| Reconnect Backoff Max | 30s | 15–60s | Aggressive retries | Slow reconnection |
| Max Ghosts Per Track | 50 | 10–100 | Limited leaderboard depth | Storage bloat |

## Visual/Audio Requirements

This system has no direct visual or audio output. It provides network state that other systems consume:
- **HUD** reads connection status indicator (Beta only)
- **Ghost Visualization** (owned by Ghost Recording) uses network-downloaded ghost data
- **Audio** has no network dependency

## UI Requirements

Network-related UI:
- **Connection indicator:** Small icon in HUD showing connected/reconnecting/disconnected state (Beta only)
- **Matchmaking screen:** Room browser or auto-match (Beta)
- **Leaderboard screen:** Per-track ranking with ghost download option (Alpha+)
- **Post-race:** Ghost comparison summary, leaderboard position update

## Acceptance Criteria

### Network Phases
- **AC-NP1:** Given MVP build, When game starts, Then no Coherence connection is established and no network traffic occurs.
- **AC-NP2:** Given Alpha build, When player completes a race, Then ghost is uploaded to CloudStorage and score is submitted to KV Database.
- **AC-NP3:** Given Beta build, When player joins a room, Then 16 players can exchange inputs at 60 Hz via Coherence relay.

### Client Prediction
- **AC-CP1:** Given remote input arrives 3 ticks late, When rollback triggers, Then simulation re-simulates 3 ticks with corrected input and visual state is smooth.
- **AC-CP2:** Given remote input arrives 12 ticks late (beyond 10-tick window), When input is dropped, Then client continues with predicted state and no visual pop occurs.
- **AC-CP3:** Given 16 players all sending input at 60 Hz, When bandwidth is measured, Then total upload per client is ≤ 15 KB/s.

### Ghost Flow
- **AC-GF1:** Given ghost file exists in CloudStorage, When player loads track (Alpha), Then ghost is downloaded and available for playback within 5 seconds.
- **AC-GF2:** Given ghost upload fails, When retry logic runs, Then 3 attempts are made with exponential backoff before giving up.
- **AC-GF3:** Given ghost file is 352 KB, When uploaded to CloudStorage, Then upload completes within 10 seconds on 1 Mbps connection.

### Leaderboard
- **AC-LB1:** Given player finishes race with time 72,340 ms, When submission is made, Then KV Database entry contains bestLapTime, totalTime, ghostRef, and timestamp.
- **AC-LB2:** Given player's new time is worse than personal best, When submission is attempted, Then client rejects submission before upload with "Not a personal best" message.
- **AC-LB3:** Given leaderboard query for track 1 difficulty 2, When results are returned, Then entries are sorted by bestLapTime ascending.

### Disconnection
- **AC-DC1:** Given connection drops for 2 seconds, When reconnection occurs, Then rollback catches up within 10-tick window and no visual discontinuity occurs.
- **AC-DC2:** Given connection drops for 10 seconds, When reconnection fails after 5 attempts, Then player's slot is filled by AI and race continues.
- **AC-DC3:** Given all players disconnect, When room is destroyed, Then race is voided with no leaderboard submission.

## Open Questions

- **Anti-cheat:** Should leaderboard ghosts be validated server-side (re-simulate and verify checksum)? (Current: client-side only. Future enhancement.)
- **Ranked vs casual:** Should there be separate leaderboard tracks for ranked (verified ghosts) and casual (unverified)? (Alpha decision)
- **Cross-platform play:** Should PC and WebGL players share the same leaderboards? (Depends on PhysX determinism across platforms — likely no for ranked)
- **Season/reset:** Should leaderboards reset periodically (seasonal) or persist forever? (Alpha decision)
