# Multiplayer Architecture

> **Status**: Approved
> **Author**: User + Agents
> **Last Updated**: 2026-08-05
> **Implements Pillar**: Rivals Make the Grid Personal

## Phase Scope

| Phase | Scope |
|---|---|
| MVP | Offline single-player only; no network connection, transport, room, or network traffic. |
| MVP architecture constraints | Gameplay systems do not depend on transport types or network runtime state; simulation/render and input/state boundaries stay explicit. |
| Alpha | Optional asynchronous ghost sharing through the Alpha-selected online-services provider. |
| Beta | Real-time multiplayer, rooms, relay, prediction, and reconnect behavior. |
| Release | Complete async and real-time multiplayer, subject to later architecture decisions. |

### Unassigned / Open Phase Decisions
- Global leaderboard, ranked cross-platform play, seasonal resets, and remote ghost discovery remain unassigned.

### Review Boundary
For MVP review, all network SDK APIs and Alpha/Beta networking behavior are non-blocking. They block MVP approval only if an MVP system imports or requires network behavior.

## Overview

**Multiplayer Architecture** is a future-phase networking layer. In MVP it contributes only the architectural boundary that keeps gameplay systems independent from transport types and network runtime state; no network connection or network traffic is permitted. Alpha may add asynchronous ghost sharing through a selected online-services provider, and Beta may add real-time 16-player races through a separately selected real-time SDK. A global leaderboard is deferred until a dedicated service architecture is selected.

> **Provider Decisions (Pending)**: MVP selects no provider. Alpha selects an online-services provider for identity and durable ghost sharing. Beta separately selects a real-time racing SDK. Coherence, Photon Fusion, and other services are candidates only; no example API is an approved dependency. These decisions must not invalidate the MVP boundary.

> **Beta Integration Criteria**: ADR-0016 declares selection timing; ADR-0017 defines the SDK-agnostic real-time contract. A future Accepted Beta selection ADR evaluates candidates against these dimensions and must not alter Simulation authority.

| Criterion | Requirement |
|---|---|
| Manual simulation | Must integrate as a guest; Simulation retains the accumulator and `Physics.Simulate`. |
| Canonical state | Must implement ADR-0017's input-authoritative prediction with owner-published kinematic reconciliation. |
| Input reliability | Must support measurable clock alignment, input delay, jitter buffering, redundancy, `W_drop`, `W_rollback`, and timeout policy. |
| WebGL transport | Must provide viable WebGL behavior; no transport is selected before Beta. |
| Room size | Must prove rooms of up to 16 players. |
| Performance | Must meet the measured rollback CPU and bandwidth budget. |
| Cost and operations | Must expose a viable cost, hosting, observability, and support model for Beta. |

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

The game operates in three network phases. Each phase unlocks specific network SDK features and data flows. The phase is a build-time configuration, not a runtime toggle.

| Phase | Network SDK | Simulation | Data Flow |
|---|---|---|---|
| **MVP** | Disconnected (no network SDK linked) | Local only, single-player | None |
| **Alpha** | Alpha-selected identity + async storage provider | Local only, ghost re-simulation | Ghost upload/download |
| **Beta** | Alpha services + separately selected real-time SDK | Local prediction + owner-published kinematic reconciliation | Measured bidirectional input sync |

**2. Simulation Loop Integration**

The simulation runs at a fixed 60 Hz. In Beta, networking integrates through
ADR-0017's **network simulation driver** as a guest of the manual accumulator.
Simulation retains frame stepping, the 14-step tick pipeline, and
`Physics.Simulate(FIXED_DT)`. The concrete SDK-specific class is selected only
at Beta and implements the project-owned contract:

- `SubmitInputs(ReadOnlySpan<SimulationInput>, uint)`
- `SerializeSnapshot(in PublishedSimulationSnapshot, Span<byte>)`
- `Rollback(uint, in SimulationRollbackState)`
- `GetPredictedInput(int, uint)`
- `RemoteInputsReceived`

In MVP and Alpha, the manual accumulator loop is used (no network integration).

**3. Input Packet Format (Beta candidate; not an MVP contract)**

Input is the only data that crosses the network for real-time play. Fixed size, versioned.

| Field | Type | Size | Range | Description |
|---|---|---|---|---|
| `tick` | uint32 | 4 | 0–2³² | Simulation tick this input targets |
| `playerIndex` | byte | 1 | 0–15 | Player slot in the room |
| `flags` | byte | 1 | bitfield | Bit 0: throttle held, Bit 1: brake held, Bit 2: steer sign, Bit 3: reserved, Bit 4: InputAvailability, Bits 5–7: reserved |
| `steerRaw` | int16 | 2 | -32768–32767 | Normalized steering angle |
| `throttle` | byte | 1 | 0–255 | Analog throttle position |
| `brake` | byte | 1 | 0–255 | Analog brake position |
| `checksum` | uint32 | 4 | — | CRC32 integrity check |

**Total: 14 bytes per input, fixed size.**

**4. Client Prediction with Rollback (Beta)**

The future Beta network driver maintains sequenced remote-input history. Clients
predict forward and reconcile when an accepted remote input arrives late.

| Step | Action |
|------|--------|
| 1 | Player presses input at render frame N |
| 2 | Input enqueued locally, simulation tick N runs with predicted input |
| 3 | The network driver delivers remote input for tick N, with arrival age measured against the synchronized network frame |
| 4 | If remote input matches prediction → no correction |
| 5 | If remote input differs → rollback to tick N, re-simulate N through current tick |
| 6 | Re-simulate only within the measured `W_rollback`; inputs older than measured `W_drop` are discarded |

**Prediction model:** The driver uses sequenced, acknowledged sliding input
history to repair isolated packet loss. Held-last repeats the last consumed
remote input only under the measured missing-input policy; it is never AI
takeover.

**Rollback state:** Kinematic state only (position, rotation, velocity, angular velocity per car). PhysX runs locally for collision feel but is NOT part of the proposed Beta canonical state. Cross-machine determinism guarantees remain unassigned and require a later architecture decision.

**5. Server Configuration (Beta)**

| Parameter | Value | Description |
|---|---|---|
| Input send/receive cadence | Measured at Beta | Selected driver configuration and packet budget |
| Input reliability policy | Measured at Beta | Input delay, jitter buffer, redundancy, `W_drop`, `W_rollback`, timeout |
| Room capacity | 16 players target | Selected real-time SDK must prove the target capacity |

**Real-time model:** The selected Beta SDK must implement ADR-0017's
input-authoritative prediction and owner-published kinematic reconciliation as a
guest of Simulation. Transport topology and service pricing remain selection
criteria, not current commitments.

**6. Ghost Data Flow (Alpha)**

Ghost data is input-only (re-simulated, not state-snapshotted). Format defined in Ghost Recording GDD.

| Action | Timing | Network SDK Feature |
|--------|--------|-------------------|
| Ghost upload | Post-race | Alpha-selected online-services provider upload contract |
| Ghost download | Pre-race | Alpha-selected online-services provider download contract |
| Ghost delete | On replacement of the player's track PB | Alpha-selected online-services provider deletion contract |

**Storage budget:** ~264 KB uncompressed at the 22,500-tick cap (80-byte header + 12-byte continuous SimulationInput records; Edge Event Stream is event-driven). Current LZ4 target is ~105 KB compressed. The 14-byte NetworkInput transport packet is not stored in ghost files.

**7. Global Leaderboard (Deferred)**

A global ranked leaderboard is not part of MVP, Alpha, or the current Beta
design. A future architecture decision must select a service with global writes,
ordered queries, durable retention, and an explicit integrity model before this
feature is designed.

**8. Real-Time Race Session Lifecycle (Beta)**

| Phase | Duration | Network SDK Feature | Network Activity |
|---|---|---|---|
| **Lobby** | Variable | Lobbies + Rooms | Matchmaking, room join |
| **Ready** | 5 seconds | Room | Player sync, pre-load |
| **Race** | ~375 seconds (5 laps) | Selected Beta real-time driver | Measured input exchange and reconciliation |
| **Result** | 5–10 seconds | Alpha-selected online-services provider | Ghost artifact finalization; Ghost Recording requests upload only for a new PB |

**9. Network Degradation Handling (Beta; provisional)**

Network degradation separates two distinct mechanisms, handled independently: **packet jitter** (connection alive, packets delayed) and **disconnection** (connection lost).

| Mechanism | Window / Trigger | Behavior |
|---|---|---|
| **Rollback** (jitter) | Remote input age is within measured `W_drop` / `W_rollback` | Re-simulate accepted late input within `W_rollback`. Beyond `W_drop`, discard it and use the measured held-last policy. This is **not** AI takeover. |
| **Disconnection** (connection lost) | 5 reconnect attempts with exponential backoff (1s→2s→4s→8s→16s); AI takeover after all attempts fail (~31s total) | Enter RECONNECTING — simulation continues for all other players (ADR-0017: a reconnect never pauses the race), "Reconnecting..." overlay. On reconnect, resync via state snapshot and resume through the corrective-kinematics path. On permanent failure, AI fills the slot. |
| **All players disconnected** | — | Room destroyed, race voided — no ghost upload |

**10. Data Flow Summary**

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
    Alpha-selected online services

Beta (Real-Time):
  Player Input → Ring Buffer → network input simulation layer
                                    │
                      ┌─────────────┼─────────────┐
                      ▼             ▼              ▼
                    Input history  Alpha-selected online services
                    (measured)     (ghost on end)
                      │
                      ▼
                  Network relay → Remote Clients
                      │
                      ▼
                  Rollback Re-sim (if input diverges)
```

### States and Transitions

| State | Description | Network SDK Features | Simulation |
|---|---|---|---|
| `DISCONNECTED` | No network. Default for MVP. | None | Local only |
| `CONNECTED` | Authenticated with the selected service. | Auth, async storage | Local only |
| `IN_LOBBY` | Matchmaking search. | Lobbies | No simulation |
| `IN_ROOM` | Joined room, waiting for start. | Room, player slots | No simulation |
| `RACING` | Active race. Inputs exchanged. | InputQueues, relay, Room | Full 60 Hz sim with prediction/rollback |
| `RESULT` | Race ended. Results computed. Ghost Recording may request PB artifact transport. | Room (connected), selected online services | Simulation stopped |
| `RECONNECTING` | Connection lost. Exponential backoff. | Auth (reconnect) | Simulation continues (ADR-0017 — never pauses for a reconnecting slot) |

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
| **Simulation Architecture** | Deferred / Beta | Fixed timestep, input, state | MVP has no Multiplayer runtime dependency. In Beta only, the selected driver aligns to Simulation as a guest; it never replaces the manual accumulator. |
| **Ghost Recording** | Deferred / Alpha | Input stream, ghost files | Ghost Recording owns the Alpha artifact lifecycle; the selected online-services provider supplies optional transport only after Alpha integration is enabled. |
| **HUD** | Deferred / Alpha/Beta | Time delta, connection status, opponent positions | HUD may consume ghost proximity and Beta connection/opponent data in future phases; MVP has no Multiplayer HUD contract. |
| **Global leaderboard** | Deferred | Future service contract | No ranked score entry, query, or HUD rank exists in MVP, Alpha, or the current Beta relay design. |

## Formulas

### Bandwidth Per Client

`bandwidth = num_remote_cars × send_frequency × packet_size × redundancy_factor`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Remote Cars | num_remote_cars | int | 0–15 | Number of other players in the room |
| Send Frequency | send_frequency | int | Measured at Beta | Selected driver send rate |
| Packet Size | packet_size | int | 14 bytes | Fixed NetworkInput struct |
| Redundancy Factor | redundancy_factor | float | Measured at Beta | Sliding input-history payload overhead |

**Output:** measured at Beta against AC-CP3's approved upload budget. The
previous 12.6 KB/s example excluded redundancy and is not an accepted estimate.

### Rollback Cost

`rollback_cost = rollback_ticks × physics_cost_per_tick × num_cars`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Rollback Ticks | rollback_ticks | int | 0–`W_rollback` | Number of measured replay ticks |
| Physics Cost Per Tick | physics_cost_per_tick | float | Measured at Beta | Whole-scene replay cost per tick |
| Number of Cars | num_cars | int | Measured at Beta | Cars affected by the accepted reconciliation policy |

**Output:** measured p95 and maximum replay cost must remain inside the accepted
simulation budget. No fixed 10-tick/16-car estimate is accepted.

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

- **If remote input exceeds the rollback window mid-race (Beta):** Input older than measured `W_drop` is discarded and the remote car follows the measured held-last policy. This is not AI takeover; AI takeover applies only after the separate disconnection timeout or failed reconnect policy.
- **If ghost download fails pre-race:** Retry with exponential backoff (3 attempts). If all fail, race starts without ghost. Ghost visualization skipped.
- **If ghost upload fails post-race:** Retry in-session after 1s, 2s, and 4s. If all three attempts fail, Ghost Recording persists the artifact in its upload queue for retry on the next game launch; Multiplayer returns to CONNECTED without a global UPLOADING state.
- **If all players disconnect simultaneously:** Room destroyed. Race voided. No ghost upload.
- **If player joins room with mismatched track/car:** Room validation rejects join. Player returned to lobby.
- **If WebGL client cannot maintain the selected network cadence:** Simulation follows its existing spiral-of-death protection. The selected driver must define the resulting reliability and correction behavior before Beta implementation.
- **If Alpha provider quotas are reached:** Provider-specific retention and upload behavior are defined by the Alpha selection ADR. Global ranking data does not exist in this phase.

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
| Input Send/Receive Cadence | Measured at Beta | Provider-specific | Choppy or stale remote state | Excessive bandwidth/CPU |
| Input Delay / Jitter Buffer | Measured at Beta | Provider-specific | Frequent rollback / visual correction | Excess remote latency |
| `W_drop` / `W_rollback` | Measured at Beta | Provider-specific | More input drops or rejected late input | Higher replay CPU cost |
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
- **AC-NP1:** Given MVP build, When game starts, Then no network connection is established and no network traffic occurs.
- **AC-NP2:** Given Alpha build, When player completes a new local personal best, Then its ghost is uploaded through the Alpha-selected online-services provider without a global leaderboard submission.
- **AC-NP3:** Given Beta build, When player joins a room, Then 16 players exchange inputs at the selected driver's measured cadence and within its approved bandwidth budget.

### Client Prediction (Beta)
- **AC-CP1:** Given remote input arrives 3 ticks late, When rollback triggers, Then simulation re-simulates 3 ticks with corrected input and visual state is smooth.
- **AC-CP2:** Given remote input arrives `W_drop + 2` ticks late, When input is discarded, Then the measured held-last policy engages and the approved correction metric is met.
- **AC-CP3:** Given 16 players all sending input at 60 Hz, When bandwidth is measured, Then total upload per client is ≤ 15 KB/s.

### Ghost Flow (Alpha)
- **AC-GF1:** Given ghost file exists in the Alpha-selected online-services provider, When player loads track (Alpha), Then ghost is downloaded and available for playback within the provider-selection latency target.
- **AC-GF2:** Given ghost upload fails, When retry logic runs, Then 3 attempts are made with exponential backoff before giving up.
- **AC-GF3:** Given ghost file is 264 KB uncompressed, When uploaded to CloudStorage, Then upload completes within 10 seconds on 1 Mbps connection.

### Disconnection (Beta; provisional)
- **AC-DC1:** Given connection drops, When reconnection succeeds before the five attempts are exhausted, Then the client reconnects, resyncs via state snapshot, and resumes through the corrective-kinematics path without AI takeover.
- **AC-DC2:** Given connection drops, When reconnection fails after all five attempts (~31s of exponential backoff), Then player's slot is filled by AI and the race continues.
- **AC-DC3:** Given all players disconnect, When room is destroyed, Then race is voided with no ghost upload.

## Open Questions

- **Global leaderboard service:** Deferred architecture decision. It requires global writes, ordered queries, and a defined integrity model; the async provider's KV service cannot provide the Alpha feature previously described.
- **Cross-platform ranked play:** Deferred with the global leaderboard service decision; it depends on an explicit integrity model.
- **Season/reset:** Deferred with the global leaderboard service decision.
- **Beta disconnection contract:** Provisional and deferred. `W_drop` is a missing-input policy, not a disconnect timer; reconnect and AI-takeover thresholds must be reconciled with the selected driver's measured reliability policy before Beta implementation.
