# Multiplayer Architecture

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Rivals Make the Grid Personal

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Offline single-player only; no Coherence connection, transport, room, or network traffic. |
| MVP architecture constraints | Gameplay systems do not depend on transport types or network runtime state; simulation/render and input/state boundaries stay explicit. |
| Alpha | Optional asynchronous CloudStorage ghost sharing. |
| Beta | Real-time multiplayer, rooms, relay, prediction, and reconnect behavior. |
| Release | Complete async and real-time multiplayer, subject to later architecture decisions. |

### Unassigned / Open Phase Decisions
- Global leaderboard, ranked cross-platform play, seasonal resets, and remote ghost discovery remain unassigned.

### Review Boundary
For MVP review, all Coherence APIs and Alpha/Beta networking behavior are non-blocking. They block MVP approval only if an MVP system imports or requires network behavior.

## Overview

**Multiplayer Architecture** is a future-phase networking layer. In MVP it contributes only the architectural boundary that keeps gameplay systems independent from transport types and network runtime state; no Coherence connection or network traffic is permitted. Alpha may add asynchronous CloudStorage ghost sharing, and Beta may add real-time 16-player races through Rooms, relay, and InputQueues with rollback. A global leaderboard is deferred until a dedicated service architecture is selected.

**Interaction:** Automatic — the player never interacts with it directly. They experience it as ghost availability and eventually real-time races against other players; global rankings remain a future feature.

**Why it exists:** Without multiplayer architecture, the game is single-player only. This system enables competitive features that extend the game's life beyond career completion.

## Player Fantasy

**Framing:** Indirect — the player never thinks about network protocols, replication servers, or packet frequencies. They think about the ghost on the grid and the presence of other racers in the world.

**Emotional target:** Witnessed solitude. The player is alone in the cockpit, but never alone in the world. The deepest feeling this architecture produces is not "I beat someone" but "I was here, and someone will know." The world feels alive without being crowded — shared ghosts and future opponents create presence without social noise.

**Anchor moment:** Pre-race. The player loads the track. A rival ghost materializes on the grid — translucent, pulsing, alive. The player realizes: that was a person. That person exists. I am about to race their performance.

**Pillar alignment:** Every Short Race Matters — this system makes races persistent through shared ghost artifacts. Earn the Next Seat — rival ghosts make the next seat feel occupied even before a future ranked service exists.

**Design test:** Do players describe multiplayer in language about people ("I can see the person I'm racing") rather than competition ("PvP," "matchmaking")? If yes, the fantasy is landing.

## Detailed Design

### Core Rules

**1. Network Phases Gate Feature Availability**

The game operates in three network phases. Each phase unlocks specific Coherence features and data flows. The phase is a build-time configuration, not a runtime toggle.

| Phase | Coherence SDK | Simulation | Data Flow |
|---|---|---|---|
| **MVP** | Disconnected (SDK present but not connected) | Local only, single-player | None |
| **Alpha** | Auth + CloudStorage (async) | Local only, ghost re-simulation | Ghost upload/download |
| **Beta** | Auth + Rooms + Lobbies + InputQueues + CloudStorage (real-time) | Local prediction + forwarded remote inputs via relay | Full bidirectional input sync |

**2. Simulation Loop Integration**

The simulation runs at a fixed 60 Hz. In Beta, networking integrates via `CoherenceInputSimulation<TState>` which replaces the manual accumulator loop. The base class handles frame stepping, time synchronization, and input buffer management. The game implements four overrides:

- `SetInputs(CoherenceClientConnection)` — sample input axes into Coherence input
- `Simulate(long simulationFrame)` — apply inputs, call `Physics.Simulate(FIXED_DT)`
- `CreateState()` — snapshot all 16 car states (position, rotation, velocity)
- `Rollback(long toFrame, SimulationState)` — restore state and re-simulate

In MVP and Alpha, the manual accumulator loop is used (no Coherence networking).

**3. Input Packet Format (Beta candidate; not an MVP contract)**

Input is the only data that crosses the network for real-time play. Fixed size, versioned.

| Field | Type | Size | Range | Description |
|---|---|---|---|---|
| `tick` | uint32 | 4 | 0–2³² | Simulation tick this input targets |
| `playerIndex` | byte | 1 | 0–15 | Player slot in the room |
| `flags` | byte | 1 | bitfield | Bit 0: throttle held, Bit 1: brake held, Bit 2: steer sign, Bit 3: boost, Bit 4: reserved for a future Beta design |
| `steerRaw` | int16 | 2 | -32768–32767 | Normalized steering angle |
| `throttle` | byte | 1 | 0–255 | Analog throttle position |
| `brake` | byte | 1 | 0–255 | Analog brake position |
| `checksum` | uint32 | 4 | — | CRC32 integrity check |

**Total: 14 bytes per input, fixed size.**

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

**Rollback state:** Kinematic state only (position, rotation, velocity, angular velocity per car). PhysX runs locally for collision feel but is NOT part of the proposed Beta canonical state. Cross-machine determinism guarantees remain unassigned and require a later architecture decision.

**5. Coherence Server Configuration (Beta)**

| Parameter | Value | Description |
|---|---|---|
| `--send-frequency` | 60 Hz | Relay → client forwarded remote inputs |
| `--recv-frequency` | 60 Hz | Client → relay input submissions |
| `--max-players` | 16 | Per room (Beta) |

**Relay model:** Server forwards inputs between clients. No server-side simulation. Each client runs its own simulation and resolves discrepancies via rollback. Cheaper on free tier, simpler architecture.

**6. Ghost Data Flow (Alpha)**

Ghost data is input-only (re-simulated, not state-snapshotted). Format defined in Ghost Recording GDD.

| Action | Timing | Coherence Feature |
|--------|--------|-------------------|
| Ghost upload | Post-race | CloudStorage.SaveObjectAsync(("ghost", "trackId_playerId"), ghostData) |
| Ghost download | Pre-race | CloudStorage.LoadObjectAsync<string>(("ghost", "trackId_playerId")) |
| Ghost delete | On replacement of the player's track PB | CloudStorage.DeleteObjectAsync(("ghost", "trackId_playerId")) |

**Storage budget:** ~264 KB uncompressed at the 22,500-tick cap (80-byte header + 12-byte continuous SimulationInput records; Edge Event Stream is event-driven). Current LZ4 target is ~105 KB compressed. The 14-byte NetworkInput transport packet is not stored in ghost files.

**7. Global Leaderboard (Deferred)**

A global ranked leaderboard is not part of MVP, Alpha, or the current Beta relay design. Coherence Cloud KV is player-context-only and exposes no ordered global query; a future architecture decision must select a service with global writes, ordered queries, and an explicit integrity model before this feature is designed.

**8. Real-Time Race Session Lifecycle (Beta)**

| Phase | Duration | Coherence Feature | Network Activity |
|---|---|---|---|
| **Lobby** | Variable | Lobbies + Rooms | Matchmaking, room join |
| **Ready** | 5 seconds | Room | Player sync, pre-load |
| **Race** | ~375 seconds (5 laps) | InputQueues + relay | 60 Hz input exchange |
| **Result** | 5–10 seconds | CloudStorage | Ghost artifact finalization; Ghost Recording requests upload only for a new PB |

**10. Disconnection Handling (Beta; provisional)**

| Scenario | Behavior |
|---|---|
| Brief disconnect (< 3s) | InputQueue buffers, client predicts, catch up via rollback on reconnect |
| Long disconnect (> 3s) | Pause simulation, "Reconnecting..." overlay, exponential backoff (1s→2s→4s→8s, max 30s) |
| Permanent disconnect | Race continues with AI filling disconnected slot. Last input replayed for 10 ticks, then AI takes over |
| All players disconnected | Room destroyed, race voided — no ghost upload |

**11. Data Flow Summary**

```
MVP (Disconnected):
  Player Input → Simulation → Render

Alpha (Async):
  Player Input → Simulation → Render
       │                      │
       ▼                      ▼
   Ghost File
        │
        ▼
   CloudStorage

Beta (Real-Time):
  Player Input → Ring Buffer → CoherenceInputSimulation
                                    │
                      ┌─────────────┼─────────────┐
                      ▼             ▼              ▼
                   InputQueues   CloudStorage
                   (60 Hz)       (ghost on end)
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
| `CONNECTED` | Authenticated with Coherence. | Auth, CloudStorage | Local only |
| `IN_LOBBY` | Matchmaking search. | Lobbies | No simulation |
| `IN_ROOM` | Joined room, waiting for start. | Room, player slots | No simulation |
| `RACING` | Active race. Inputs exchanged. | InputQueues, relay, Room | Full 60 Hz sim with prediction/rollback |
| `RESULT` | Race ended. Results computed. Ghost Recording may request PB artifact transport. | Room (connected), CloudStorage | Simulation stopped |
| `RECONNECTING` | Connection lost. Exponential backoff. | Auth (reconnect) | Simulation paused |

**Transition rules:**

| From | To | Trigger |
|------|----|---------|
| `DISCONNECTED` | `CONNECTED` | `Connect()` succeeds |
| `CONNECTED` | `IN_LOBBY` | `JoinLobby()` |
| `IN_LOBBY` | `IN_ROOM` | Room found, `JoinRoom()` |
| `IN_ROOM` | `RACING` | All players ready or countdown expires |
| `RACING` | `RESULT` | Race finished or all cars finished |
| `RESULT` | `CONNECTED` | Results finalized; any Ghost Recording pending upload continues independently of multiplayer state |
| Any | `RECONNECTING` | `ConnectionLost()` |
| `RECONNECTING` | Previous state | Reconnect succeeds |
| `RECONNECTING` | `DISCONNECTED` | Max retries exceeded |

### Interactions with Other Systems

| System | Direction | Data | Contract |
|---|---|---|---|
| **Simulation Architecture** | Deferred / Beta | Fixed timestep, input, state | MVP has no Multiplayer runtime dependency. In Beta only, a future network driver may align network ticks to the simulation tick and replace the manual accumulator after a separate architecture decision. |
| **Ghost Recording** | Deferred / Alpha | Input stream, ghost files | Ghost Recording owns the Alpha artifact lifecycle; Multiplayer provides optional CloudStorage transport only after Alpha integration is enabled. |
| **HUD** | Deferred / Alpha/Beta | Time delta, connection status, opponent positions | HUD may consume ghost proximity and Beta connection/opponent data in future phases; MVP has no Multiplayer HUD contract. |
| **Global leaderboard** | Deferred | Future service contract | No ranked score entry, query, or HUD rank exists in MVP, Alpha, or the current Beta relay design. |

## Formulas

### Bandwidth Per Client

`bandwidth = num_remote_cars × send_frequency × packet_size`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Remote Cars | num_remote_cars | int | 0–15 | Number of other players in the room |
| Send Frequency | send_frequency | int | 30–60 Hz | Coherence send rate |
| Packet Size | packet_size | int | 14 bytes | Fixed NetworkInput struct |

**Output Range:** 0–12,600 bytes/s (0.42 KB/s per remote car at 60 Hz)
**Example:** 15 remote cars × 60 Hz × 14 bytes = 12,600 bytes/s = 12.3 KB/s upload per client

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
| Header Size | header_size | int | 80 bytes | Fixed header + metadata |
| Total Ticks | total_ticks | int | 0–22,500 | Sim ticks in race (375s × 60 Hz) |
| Input Size | input_size | int | 12 bytes | Ghost SimulationInput record; distinct from 14-byte NetworkInput transport packet |

**Output Range:** 80 bytes (empty) to 270,080 bytes (264 KB uncompressed)
**Example:** 5-lap race: 80 + (22,500 × 12) = 270,080 bytes ≈ 264 KB

## Edge Cases

- **If Coherence connection drops mid-race (Beta):** InputQueue buffers last 10 ticks of remote inputs. Client continues predicting. On reconnect, rollback catches up if within window. If beyond 10 ticks, disconnected player's slot filled by AI.
- **If ghost download fails pre-race:** Retry with exponential backoff (3 attempts). If all fail, race starts without ghost. Ghost visualization skipped.
- **If ghost upload fails post-race:** Retry in-session after 1s, 2s, and 4s. If all three attempts fail, Ghost Recording persists the artifact in its upload queue for retry on the next game launch; Multiplayer returns to CONNECTED without a global UPLOADING state.
- **If all players disconnect simultaneously:** Room destroyed. Race voided. No ghost upload.
- **If player joins room with mismatched track/car:** Room validation rejects join. Player returned to lobby.
- **If rollback exceeds 10 ticks:** Input is dropped. Client continues with predicted state. Acceptable for arcade gameplay — visual correction is smooth.
- **If WebGL client cannot maintain 60 Hz:** Simulation slows via spiral-of-death clamp (same as single-player). Network tick rate drops proportionally. Other clients see slight delay but no desync.
- **If Coherence free tier limit is reached (5 GB storage):** Oldest cloud ghosts are evicted according to the future cloud-retention policy. Global ranking data does not exist in this phase.

## Dependencies

| System | Direction | Type | Data Flow |
|--------|-----------|------|-----------|
| Simulation Architecture | Deferred / Beta | Architecture constraint only | MVP Simulation does not import transport types or network runtime state. Future Beta integration requires a separate architecture decision. |
| Ghost Recording | Deferred / Alpha | Architecture constraint only | Alpha Ghost Recording may request CloudStorage transport; MVP does not upload, download, or depend on Multiplayer. |
| HUD | Deferred / Alpha/Beta | Soft | Future Multiplayer → HUD: ghost proximity, connection status, opponent positions. No MVP data flow. |
| Settings | Deferred / Alpha/Beta | Soft | Future Settings → Multiplayer: network quality preferences if a later phase defines them. No MVP dependency. |

## Tuning Knobs

| Knob | Default | Range | Too Low | Too High |
|------|---------|-------|---------|----------|
| Server Send Frequency | 60 Hz | 30–60 Hz | Choppy remote car positions | Excessive bandwidth |
| Server Recv Frequency | 60 Hz | 30–60 Hz | Input delay for remote clients | Server overload |
| Max Rollback Ticks | 10 | 5–15 | More input drops, visual pops | Higher CPU cost per frame |
| Ghost Upload Timeout | 15s | 5–30s | Upload fails on slow connections | Long post-race wait |
| Reconnect Max Retries | 5 | 3–10 | Premature disconnect | Long reconnection delay |
| Reconnect Backoff Max | 30s | 15–60s | Aggressive retries | Slow reconnection |
| RemoteGhostCatalogLimit | 50 | 10–100 | Reserved for a future remote ghost-discovery architecture; distinct from `LocalGhostCacheLimit = 5` | Storage bloat |

## Visual/Audio Requirements

This system has no direct visual or audio output. It provides network state that other systems consume:
- **HUD** reads connection status indicator (Beta only)
- **Ghost Visualization** (owned by Ghost Recording) uses network-downloaded ghost data
- **Audio** has no network dependency

## UI Requirements

Network-related UI:
- **Connection indicator:** Small icon in HUD showing connected/reconnecting/disconnected state (Beta only)
- **Matchmaking screen:** Room browser or auto-match (Beta)
- **Post-race:** Ghost comparison summary

## Acceptance Criteria

### Network Phases (MVP / Alpha / Beta)
- **AC-NP1:** Given MVP build, When game starts, Then no Coherence connection is established and no network traffic occurs.
- **AC-NP2:** Given Alpha build, When player completes a new local personal best, Then its ghost is uploaded to CloudStorage without a global leaderboard submission.
- **AC-NP3:** Given Beta build, When player joins a room, Then 16 players can exchange inputs at 60 Hz via Coherence relay.

### Client Prediction (Beta)
- **AC-CP1:** Given remote input arrives 3 ticks late, When rollback triggers, Then simulation re-simulates 3 ticks with corrected input and visual state is smooth.
- **AC-CP2:** Given remote input arrives 12 ticks late (beyond 10-tick window), When input is dropped, Then client continues with predicted state and no visual pop occurs.
- **AC-CP3:** Given 16 players all sending input at 60 Hz, When bandwidth is measured, Then total upload per client is ≤ 15 KB/s.

### Ghost Flow (Alpha)
- **AC-GF1:** Given ghost file exists in CloudStorage, When player loads track (Alpha), Then ghost is downloaded and available for playback within 5 seconds.
- **AC-GF2:** Given ghost upload fails, When retry logic runs, Then 3 attempts are made with exponential backoff before giving up.
- **AC-GF3:** Given ghost file is 264 KB uncompressed, When uploaded to CloudStorage, Then upload completes within 10 seconds on 1 Mbps connection.

### Disconnection (Beta; provisional)
- **AC-DC1:** Given connection drops for 2 seconds, When reconnection occurs, Then rollback catches up within 10-tick window and no visual discontinuity occurs.
- **AC-DC2:** Given connection drops for 10 seconds, When reconnection fails after 5 attempts, Then player's slot is filled by AI and race continues.
- **AC-DC3:** Given all players disconnect, When room is destroyed, Then race is voided with no ghost upload.

## Open Questions

- **Global leaderboard service:** Deferred architecture decision. It requires global writes, ordered queries, and a defined integrity model; Coherence Cloud KV cannot provide the Alpha feature previously described.
- **Cross-platform ranked play:** Deferred with the global leaderboard service decision; it depends on an explicit integrity model.
- **Season/reset:** Deferred with the global leaderboard service decision.
- **Beta disconnection contract:** Provisional and deferred. The current 10-tick rollback window cannot cover the 2-second disconnect criterion, and the AI takeover threshold must be reconciled with the reconnect backoff policy before Beta implementation.
