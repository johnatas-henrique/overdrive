# Unity Multiplayer Networking Solutions — 2026 Comparison

**Prepared:** 2026-07-19  
**Scope:** Racing game needing client prediction with rollback, server-authoritative simulation, deterministic physics support, PC + WebGL (WebSocket), and async (ghosts/leaderboards) + real-time multiplayer.

---

## Executive Summary

For a racing game with the stated requirements, the shortlist narrows to three solutions that fully support **server-authoritative client-predicted physics with rollback**:

| Solution | Verdict |
|---|---|
| **Photon Fusion 2.1** | Best overall match. Production-ready racing sample (Fusion Karts), built-in prediction/rollback, physics addon with client-side physics resimulation, WebGL via Shared Authority mode, Photon Cloud for async services. Pay-per-CCU. |
| **Netick 2** | Best free option. Rocket Cars demo (Rocket League clone) proves full-vehicle-physics prediction with rollback. Industry-leading bandwidth efficiency. No WebGL support (TCP/WebSocket not built-in). |
| **Photon Quantum 3** | Best for deterministic physics (fixed-point, own physics engine). Racing samples exist (Quantum Karts, 99-player Racer 2.5D). WebGL supported. High CPU cost on WebGL. Highest learning curve. |

Realistic options for self-hosted / free:
| **FishNet** | Strong prediction, WebGL via Bayou (WebSocket), proving racing examples exist. Weaker determinism (plain PhysX resimulation). |
| **Mirror** | Largest community, WebGL via SimpleWebTransport, prediction is experimental (not production-recommended per docs). |
| **Netcode for Entities (N4E) 6.6** | Full prediction/rollback in ECS, new GameObject layer in 2026 preview. WebGL via WebSocket transport. Requires DOTS expertise. Server-authoritative by design. |
| **Netcode for GameObjects (NGO) 2.12** | WebGL via WebSocket supported. No built-in prediction — requires manual build atop `AnticipatedNetworkVariable`. Not suitable for racing without major custom work. |

Managed hosting / high-physics contenders:
| **Reactor (KinematicSoup)** | Best server-side physics (PhysX at 120 Hz), built-in prediction/reconciliation, 9.5× less transform bandwidth than Fusion/NGO. WebGL supported. Proprietary hosting model. |
| **Coherence** | Managed relay + simulator. No server-side physics, 30 Hz tick cap. WebGL supported. Most expensive bandwidth. |

---

## 1. Unity Netcode for Entities (N4E) — DOTS Path

**Current version:** 6.6.0 (Feb 2026) [C]  
**Package:** `com.unity.netcode`  
**License:** Free (Unity package)

### Architecture
- Server-authoritative by design. "Ghosts" are server-owned entities replicated via snapshots. [C: docs.unity3d.com/Packages/com.unity.netcode@6.6/manual/intro-to-prediction.html]
- Client prediction built in: `PredictedSimulationSystemGroup` runs same code client+server on a fixed-timestep loop. Selective rollback (only ghosts that received updates in the snapshot). [C]
- Two prediction modes: `Predicted` (all clients predict) and `OwnerPredicted` (owner predicts, others interpolate). Dynamic switching at runtime. [C]
- Binary world model: separate client and server worlds. Single-World-Host also supported (server+client in one process, no rollback for host). [C]

### Determinism
- **Not strict determinism.** Docs state: *"It isn't necessary for the simulation itself to be fully deterministic, although this is something you should aim for (without achieving it) to reduce corrections."* [C]
- Physics resimulation uses Unity Physics (DOTS physics) — not deterministic across machines. Corrections smooth errors via `GhostPredictionSmoothingSystem`. [C]
- Netcode provides partial tick handling, tick batching for performance, and configurable `MaxSendRate` per ghost type. [C]

### Client Prediction with Rollback
- Full support built in. When a snapshot arrives, entities roll back to the oldest received tick and resimulate forward to the client's current predicted tick. [C]
- Prediction cost scales with ping: a 300 ms connection expects ~22 frames of re-simulation. Physics scheduling overhead can be reduced by disabling multi-threaded physics. [C]
- Prediction Switching: dynamically convert interpolated ghosts to predicted (e.g., within a radius bubble). Transition smoothing mitigates timeline jumps. [C]

### WebGL Support
- Netcode supports WebSocket transport. [I — Unity Transport has WebSocket mode].
- DOTS/ECS runs on WebGL (IL2CPP, no Burst on WebGL). Prediction CPU cost may be high on browser targets.

### Maturity & Community
- Unity's strategic direction for multiplayer. Actively developed (v6.6.0 released Feb 2026, new GameObject layer in preview). [C]
- Smaller community than NGO/Mirror. Documentation is thorough but requires DOTS knowledge.

### Suitability for Racing
- **Challenging.** Requires writing vehicle code in ECS (or using the new GameObject layer, still preview as of mid-2026). The pseudo-deterministic approach works — corrections occur on mismatch — but vehicle physics determinism without fixed-point math means constant small corrections.
- New GameObject layer (DevLog Entry 4, May 2026) adds `PredictedUpdate()` method on `GhostBehaviour` for OOP-style prediction. Rigidbody/CharacterController predicted primitives in development. [C: discussions.unity.com/t/prediction-in-gameobject-netcode-devlog-entry-4/1719927]

---

## 2. Unity Netcode for GameObjects (NGO)

**Current version:** 2.12.0 (May 2026) [C]  
**Package:** `com.unity.netcode.gameobjects`  
**License:** Free (Unity package)

### Architecture
- Server-authoritative (dedicated server or listen server). Client-hosted mode also supported. [C]
- Transport layer: `UnityTransport` (UDP) with WebSocket option for WebGL. Distributed Authority mode available. [C: docs.unity3d.com/Packages/com.unity.netcode.gameobjects@2.12]

### Determinism & Prediction
- **No built-in client prediction.** NGO offers `AnticipatedNetworkVariable` and `AnticipatedNetworkTransform` as building blocks — these let you set an assumed value while awaiting server confirmation, but you implement the prediction/reconciliation loop yourself. [C: docs.unity3d.com/Packages/com.unity.netcode.gameobjects@2.7/manual/learn/dealing-with-latency.html]
- Docs explicitly state: *"We recommend only advanced users pursue this option."* [C]
- Enhanced Determinism toggle exists in project physics settings (used by community projects like Apollo99-Games' Rigidbody-Network-Prediction-and-Reconciliation for NGO). [C: github.com/Apollo99-Games/Rigidbody-Network-Prediction-and-Reconciliation-for-Unity-NGO]

### WebGL Support
- WebSocket transport built in since v2.9+. Distributed Authority quickstart for WebGL exists. [C: docs.unity3d.com/Packages/com.unity.netcode.gameobjects@2.11/manual/learn/distributed-authority-webgl.html]

### Maturity & Community
- Official Unity package, active development (v2.12.0 May 2026). [C]
- Largest documentation base among Unity solutions. Growing community.

### Suitability for Racing
- **Not recommended without custom prediction layer.** The absence of built-in prediction/rollback means you build it from scratch or use community frameworks on top. For a racing game requiring responsive physics, this is prohibitive engineering effort.

---

## 3. Photon Fusion 2

**Current version:** Fusion 2.1 Stable (Jul 2026) [C]  
**License:** Per-CCU pricing (free tier available)  
**Certified:** Unity Verified Solution [C]

### Architecture
- Two topologies: **Shared Mode** (client authority, no dedicated server) and **Host/Server Mode** (server-authoritative with client prediction). [C: doc.photonengine.com/fusion/v2]
- Dedicated server mode uses a headless Unity build. You pay Photon CCU fees + your server infrastructure costs separately. [C]
- Tick-based state synchronization. Client prediction with server reconciliation is built into Host/Server mode. [C]
- Fusion 2.1 adds **Forecast Physics** — an extrapolation-based approach for physics objects that avoids full resimulation CPU cost. Supported in Shared Authority mode too. [C: blog.photonengine.com/fusion-2-1-stable-release/]

### Client Prediction with Rollback
- Full client-side prediction for characters (via `NetworkCharacterController`) and rigidbodies (via the Physics Addon). [C]
- **Physics Addon 2.1** (Jul 2026): `NetworkRigidbody` + `RunnerSimulatePhysics` components. Client physics simulation modes: `Disabled`, `SyncTransforms`, `SimulateForward`, `SimulateAlways`. Full resimulation on clients (`SimulateAlways`) is expensive. [C: doc.photonengine.com/fusion/v2/addons/physics-addon-2.1]
- Fusion 2.1 adds **Input Delay** — a tuning feature that reduces resimulation count at the cost of slight added input latency. [C]
- Sub-tick lag compensation, configurable tick and send rates, interest management, object priority for bandwidth control. [C]

### Determinism
- **Not deterministic.** Uses Unity PhysX. Non-deterministic float math means corrections are expected. Fusion's prediction/reconciliation handles this via server authority corrections. [I]
- In Shared Mode, deterministic simulation is not possible (client authority). [C]

### WebGL Support
- Fully supported. Photon recommends Shared Authority mode for WebGL (no prediction rollback, lower CPU). [C: linkedin.com/pulse/photon-multiplayer-webgl-game-jams-photonengine-lwhse]
- WebSocket transport via Photon Cloud.
- Quantum is recommended over Fusion for WebGL when deterministic rollback is required. [C]

### Racing Game Evidence
- **Fusion Karts sample** — a complete racing game template (up to 8 players, two tracks, items, client-predicted vehicle physics). Updated to Fusion 2.0.5 (Mar 2025). [C: doc.photonengine.com/fusion/current/game-samples/fusion-karts]
- **Multiplayer Racing Template** on Unity Asset Store (Fusion 2, Unity 6000.2+, car physics based on WheelCollider, network physics simulation for non-kinematic network cars). Nov 2025. [C: assetstore.unity.com/packages/templates/packs/multiplayer-racing-template-photon-fusion-2-280533]

### Maturity & Community
- One of the most widely adopted Unity networking solutions globally. [C]
- Large community, extensive documentation, 80+ samples. [C]
- 2026 releases show active development. Fusion 2.1 is a major update. [C]

### Suitability for Racing
- **Strong match.** The dedicated racing sample (Fusion Karts) directly validates this use case. Client-predicted vehicle physics with WheelCollider works. Physics Addon handles rigidbody resimulation. WebGL supported via Shared Authority (with the tradeoff of client authority). For server-authoritative WebGL, you run a dedicated server and connect via Photon Cloud.

---

## 4. Photon PUN 2

**Current version:** PUN 2 (maintenance mode)  
**License:** Per-CCU pricing

### Architecture
- **Client-hosted (P2P) only.** No server authority. One client acts as host. [C]
- Mesh topology: each client syncs data from every other client. Scales poorly beyond 4–8 players. [C: images.response.unity3d.com/.../Unity-Choosing_Netcode-Research_Report-v1_1.pdf]

### Prediction & Determinism
- **No client prediction, no rollback, no server authority.** [C]
- No delta compression. Missing higher-level features like prediction. [C]

### WebGL Support
- Yes, via Photon Cloud's WebSocket relay. [C]

### Suitability for Racing
- **Not suitable.** Lack of server authority means no cheat prevention — critical for competitive racing. No prediction means noticeable input delay. PUN is for casual co-op prototypes only.

---

## 5. Photon Quantum 3

**Current version:** Quantum 3.0.10 (Mar 2026) [C]  
**License:** Per-CCU pricing  
**Engine:** Deterministic ECS (own fixed-point math, own physics engine)

### Architecture
- **Fully deterministic predict/rollback.** Only inputs are sent over the network. Every client runs the same simulation with identical results. [C: doc.photonengine.com/quantum/v2/quantum-intro]
- Server Plugin (Photon-managed) manages input timing, acts as clock. No server-side physics simulation — clients simulate independently. Optional server plugin can act as referee. [C]
- Quantum ECS is separate from Unity ECS. Uses its own DSL, fixed-point math (`FP` type, Q48.16), physics engine (2D & 3D), navmesh, and KCC. Simulation is pure C# decoupled from Unity. [C]

### Determinism
- **Strict determinism by design.** Fixed-point math replaces floats/doubles. Deterministic 3D vector math, physics engine, RNG. All libraries are stateless and deterministic. [C]
- This is the only solution listed with genuinely deterministic simulation. No float/double/Unity API allowed in simulation code. [C]

### Client Prediction with Rollback
- Built into the core. Input prediction and rollback are the fundamental architecture. Clients run ahead of the server plugin, roll back on correction. [C]

### WebGL Support
- Supported since Quantum 2.1 (Build 967). WebGL forced to single-thread. IL2CPP recommended, Release mode essential (Debug builds extremely slow on WebGL). [C: doc.photonengine.com/quantum/v2/manual/webgl]
- WebSockets over TCP (no UDP in browsers) — TCP reliability issues may affect players with poor connections. Photon recommends offering a downloadable client as alternative. [C]
- Cross-play between WebGL and native clients supported. [C]
- Quantum's deterministic simulation is CPU-intensive on WebGL — Photon themselves advise: *"Unless deterministic simulation and rollback are absolutely required... Fusion Shared Authority remains the more performance-friendly choice for WebGL deployments."* [C: linkedin.com/pulse/photon-multiplayer-webgl-game-jams-photonengine-lwhse]

### Racing Game Evidence
- **Quantum Karts 3.0.10** — full arcade racing game sample: up to 12 karts, 2 tracks, 4 powerups, 3 kart types, AI opponents. Custom arcade physics using Broadphase Queries, drifting mechanics, different surface friction. WebGL build available. [C: doc.photonengine.com/quantum/current/game-samples/karts]
- **Quantum Racer 2.5D** — retro racer with 99-player capacity. [C: doc.photonengine.com/quantum/current/game-samples/racer-25d]
- **Quantum Arcade Racing Sample** (v2) — low-poly multiplayer racing, city environment, AI driving lines. [C]

### Maturity & Community
- Mature product with v3 released. Smaller community than Fusion but dedicated niche. [I]
- Steep learning curve: custom DSL, fixed-point math, no Unity API in simulation. The Quantum simulation is a separate codebase from the Unity view layer. [C]

### Suitability for Racing
- **Excellent for deterministic racing.** The Quantum Karts sample directly validates arcade racing with deterministic physics. 99-player Racer 2.5D proves large-scale capacity. 
- **Tradeoffs:** Custom physics engine means you cannot use Unity's WheelCollider — you build vehicle physics using Quantum's API. WebGL CPU cost is high. Per-CCU pricing can be expensive at scale. Determinism is overkill for a racing game unless you absolutely need identical simulation across all clients (e.g., e-sports / competitive fairness).

---

## 6. Mirror Networking

**Current version:** Stable (2026)  
**License:** Free, MIT, open-source  
**Stars:** ~2K+ on GitHub

### Architecture
- Server-authoritative (dedicated server or listen server) and peer-to-peer modes. [C: mirror-networking.gitbook.io]
- Transport layer: KCP (reliable UDP default), WebSocket (SimpleWebTransport for WebGL), Steam, Epic, etc. [C]
- HLAPI-style: `NetworkBehaviour`, `[SyncVar]`, `[Command]`, `[ClientRpc]`. Familiar to UNet veterans. [C]

### Client Prediction with Rollback
- **Experimental.** Mirror's docs explicitly warn: *"Mirror is currently experimenting with various Prediction algorithms. This is all purely experimental, we don't recommend using this just yet."* [C: mirror-networking.gitbook.io/docs/manual/general/client-side-prediction]
- Uses a custom approach without `Physics.Simulate()` — manually resimulates Rigidbody position/rotation/velocity/angularVelocity in C#. Sacrifices accuracy for performance. [C]
- Good for large physics scenes where player interacts with few objects. PredictedRigidbody for physics objects. [C]
- Predicted player movement *"has not yet been tested whatsoever"* (as of docs). [C]
- Not production-recommended for racing.

### Determinism
- None. Uses Unity PhysX. Mirror acknowledges non-determinism: *"most Physics engines (including Unity's PhysX) are not deterministic."* [C]

### WebGL Support
- Yes, via **SimpleWebTransport** (WebSocket). Proven in production: Castaways runs in browser using Mirror's WebGL support. [C: github.com/vis2k/Mirror]
- Requires separate server build (Windows/Linux headless). Client is WebGL build hosted on any web server (IIS, nginx). [C: discussions.unity.com/t/mirror-multi-player-deployment-strategy/822339]

### Async Services (Ghosts/Leaderboards)
- **None built in.** Mirror is transport + state sync only. Auth, matchmaking, leaderboards, persistence all need external implementation. [C: gsb.supercraft.host/blog/mirror-networking-vs-managed-backend/]
- Can pair with Nakama, PlayFab, Supercraft GSB, or custom backend. [C]

### Racing Game Evidence
- **Rumble Racer** case study: production mobile racing game using Mirror for match simulation, with a .NET lobby server for matchmaking. [C: dev.to/firulais/how-i-built-a-scalable-lobby-for-a-real-time-mobile-racing-game-3jam]
- Prediction used: not mentioned — likely no client prediction for vehicle physics.

### Maturity & Community
- Largest community of any open-source Unity networking solution. Used by over 200 million players across shipped games. [C]
- Battle-tested, stable, extensive third-party integrations. [C]
- Development is mature/stable rather than cutting-edge. No major architectural changes expected. [I]

### Suitability for Racing
- **Not ideal.** Prediction is experimental and not validated for vehicle physics. You would likely disable Mirror's prediction and build client-authoritative vehicle movement with server validation — workable for casual racing but not for competitive/fair racing where responsive physics are critical.

---

## 7. FishNet

**Current version:** 4.7.2 (Apr 2026) [C]  
**License:** Free, MIT, open-source (Asset Store)  
**Stars:** ~1.9K on GitHub

### Architecture
- Server-authoritative or P2P. [C]
- Built-in client-side prediction with mature API. `PredictionRigidbody` for physics objects. [C: fish-networking.gitbook.io]
- Object-based (MonoBehaviour), similar API to Mirror but more modern/performant. [C]

### Client Prediction with Rollback
- **Mature client-side prediction.** Multiple modes: State Forwarding (all clients see all inputs) for spectating, owner-only prediction. [C]
- `PredictionRigidbody` handles force/velocity application with resimulation. Only framework that handles Enter/Exit trigger/collision events with prediction. [C]
- `PredictionManager` for global settings. Configurable interpolation, teleport thresholds, graphical object detachment for jitter-free rendering. [C]

### Determinism
- None. Uses Unity PhysX. Non-deterministic like all PhysX-based solutions. [I]

### WebGL Support
- Yes, via **Bayou** (WebSocket transport). Edgegap deployment guide exists for FishNet + WebGL. [C: docs.edgegap.com/docs/sample-projects/unity-netcodes/fishnet-on-edgegap-webgl]
- Works with WebRTC, Steam, Epic Online Services, Unity Relay as free plugins. [C: marketplace.unity.com/packages/tools/network/fishnet-networking-evolved-207815]

### Async Services
- None built in (open-source, self-hosted). Same as Mirror — you need external services for leaderboards/ghosts. [I]

### Racing Game Evidence
- Community vehicle prediction examples exist:
  - **FishNet Car Controller Prediction Test** (Roceh, 2022) — adapted car controller to FishNet CSP. [C: github.com/Roceh/FishNet---Car-Controller-Prediction-Test]
  - **FishNet Multiplayer Vehicle Example** (dexsper) — FishNet CSP V2 vehicle controller with wheel colliders, steer curves, spring/damper tuning. [C: github.com/dexsper/FishNet-Multiplayer-Vehicle-Example]
- No official racing sample from the developer.

### Maturity & Community
- Growing community. Smaller than Mirror, larger than Netick. [C]
- Active development: 192 releases as of Apr 2026. Responsive maintainer. [C]
- Benchmarks show lower bandwidth overhead than Mirror for equivalent workloads. [C: dev.to/oceanviewgames/cross-platform-multiplayer-networking-in-unity-fishnet-mirror-and-photon-compared-3m36]

### Suitability for Racing
- **Solid free option.** Mature prediction system, community vehicle examples prove the concept, WebGL via Bayou. The main gap is lack of official racing sample/template — you build the vehicle networking yourself. No built-in async services.

---

## 8. Netick 2

**Current version:** 2.0 (2026)  
**License:** Free (core), Pro features paid  
**Repository:** github.com/NetickNetworking/NetickForUnity

### Architecture
- Server-authoritative state sync. Built on unmanaged C# with data-oriented architecture. [C: netick.net]
- Tick-aligned atomic state synchronization — eliminates race conditions and desyncs. [C]
- Patent-level delta snapshot algorithm for bandwidth efficiency. [C]

### Client Prediction with Rollback
- Full CSP built in. Input-based simulation with `FetchInput` and `NetworkFixedUpdate`. [C: netick.gitbook.io/v1/understanding-client-side-prediction/writing-client-side-prediction-code]
- Physics prediction supported but with the same PhysX non-determinism caveats as others. Netick's 3D physics prediction is described as *"particularly expensive"* and *"not recommended"* in practice. [C: netick.net/docs/2/articles/physics-prediction.html]
- Built-in replay system (full-game replay, not just ghost replays). [C]
- Lag compensation (Pro). [C]

### Determinism
- None (uses Unity PhysX). The Rocket Cars sample explicitly notes this as a limitation and suggests using a third-party deterministic physics engine. [C: github.com/NetickNetworking/NetickRocketCars]

### WebGL Support
- **Not supported.** No WebSocket transport built in. Netick relies on UDP. [I]

### Racing Game Evidence
- **Netick Rocket Cars** — full open-source Rocket League clone. Custom vehicle physics, full prediction for all cars and ball, goal replay, full-match replay. Proves vehicle physics with prediction at scale. [C: github.com/NetickNetworking/NetickRocketCars]

### Maturity & Community
- Newer than Mirror/FishNet. Smaller community but very active development (still in v0.x range). [I]
- Proven in at least one commercial title (Thetan Immortal). [C]

### Suitability for Racing
- **Excellent if you skip WebGL.** The Rocket Cars sample directly validates vehicle physics with full world prediction. Bandwidth efficiency is industry-leading. The lack of WebGL support is a hard blocker for browser deployment. No built-in async services.

---

## 9. Reactor (KinematicSoup)

**Current version:** 1.1.x (2025–2026)  
**License:** Proprietary (managed hosting or self-host)

### Architecture
- **Server-authoritative by design.** Server runs PhysX physics simulation natively. Client input is treated as input to validate, not state to trust. [C: kinematicsoup.com/reactor]
- Separate server runtime (not Unity-based). Compiles independently from client code. Fast iteration (no Unity rebuild for server changes). [C]
- Tick rates up to 120 Hz. Tick rate independently configurable from network send rate. [C]
- Multi-room player connections — a player can be connected to multiple rooms simultaneously (enables zone sharding, microservice architecture). [C]

### Client Prediction with Rollback
- Built-in prediction and reconciliation. Player controller system runs same controller code on client and server. Client runs ahead of server for responsive feel. [C]
- Custom predictors for complex movement (vehicles, physics chains, curved paths). [C]
- Shared-authority mode for simpler games (client drives transform, server validates). [C]

### Determinism
- **Not deterministic** (uses PhysX). Server authority means the server's simulation is truth. Clients correct to server state. [I]

### WebGL Support
- Supported. [C: discussions.unity.com/t/reactor-a-server-authoritative-unity-multiplayer-engine-9-5x-less-transform-bandwidth-than-photon-fusion-2-and-ngo/832040]

### Async Services
- Cluster API for inter-room communication. Can build matchmaking lobbies, guild systems, chat rooms as separate rooms. [C]
- Built-in persistence across instances. [C]

### Maturity & Community
- Smaller community. Niche product for teams needing high-physics server authority. [I]
- Proven at scale: braains.io rebuilt on Reactor (100 players, double tick rate, triple physics objects, bandwidth went down). [C]

### Suitability for Racing
- **Strong technical fit.** Server-side PhysX at up to 120 Hz, built-in prediction, vehicle physics feasible. WebGL supported. Multi-room architecture enables ghost/leaderboard servers as separate rooms.
- **Tradeoffs:** Proprietary hosting model. Smaller community means fewer racing-specific examples/help.

---

## 10. Coherence

**Current version:** 2026  
**License:** Per-CCU + CPU-time (credit system)

### Architecture
- Managed relay + simulator model. For server authority, requires a headless Unity instance running alongside Coherence — you construct the authority layer yourself. [C: kinematicsoup.com/blog/reactor-vs-coherence-unity-multiplayer]
- 30 Hz tick cap on server-side simulation. [C]

### Client Prediction with Rollback
- Not built in at the architecture level. Shared authority means clients drive their objects. [C]

### WebGL Support
- Yes, via WebSocket relay. [I]

### Suitability for Racing
- **Not suitable.** No built-in server authority, 30 Hz tick cap is insufficient for responsive vehicle physics, no server-side physics support. Highest bandwidth cost of all solutions.

---

## Summary Comparison Table

| Criterion | N4E 6.6 | NGO 2.12 | Fusion 2.1 | Quantum 3 | Mirror | FishNet | Netick 2 | Reactor |
|---|---|---|---|---|---|---|---|---|
| **Server-authoritative** | ✅ | ✅ | ✅ (Host/Server) | ✅ (via plugin) | ✅ | ✅ | ✅ | ✅ |
| **Client prediction + rollback** | ✅ built-in | ❌ (custom) | ✅ built-in | ✅ core | ⚠️ experimental | ✅ mature | ✅ built-in | ✅ built-in |
| **Deterministic physics** | ❌ pseudo | ❌ | ❌ | ✅ fixed-point | ❌ | ❌ | ❌ | ❌ |
| **WebGL (WebSocket)** | ✅ | ✅ | ✅ | ✅ (heavy CPU) | ✅ | ✅ (Bayou) | ❌ | ✅ |
| **Racing sample** | ❌ | ❌ | ✅ Karts | ✅ Karts, Racer | ❌ | ⚠️ community | ✅ Rocket Cars | ❌ |
| **Async services (leaderboards)** | ❌ | ❌ | ❌ (Photon separate) | ❌ (Photon separate) | ❌ | ❌ | ❌ | ✅ (Cluster API) |
| **Pricing** | Free | Free | Per-CCU | Per-CCU | Free MIT | Free MIT | Free core | CPU-time |
| **Community size** | Medium | Medium | Very large | Small | Very large | Medium | Small | Small |
| **Bandwidth efficiency** | Good | Good | Good | Excellent (inputs only) | Moderate | Very good | Excellent | Best (9.5× less) |

---

## Recommendations for a Racing Game

### Tier 1 — Best Matches

**🥇 Photon Fusion 2.1** — Best overall for your requirements.
- Direct racing sample (Fusion Karts) validates the full stack.
- Built-in prediction/rollback for vehicle physics.
- WebGL supported (Shared Authority mode for browser).
- Photon Cloud provides relay infrastructure; add async services via Photon's other products or a custom backend.
- Cost scales with CCU — model carefully for your expected player count.

**🥈 Photon Quantum 3** — Best for deterministic physics.
- If you must have identical simulation on all clients (e-sports / competitive integrity), this is the only option.
- Quantum Karts sample directly applies. 99-player Racer 2.5D shows scalability.
- Drawbacks: custom physics engine (no WheelCollider), steeper learning curve, expensive WebGL CPU cost, per-CCU pricing.

**🥉 Netick 2** — Best free option if WebGL is optional.
- Rocket Cars demo proves full-vehicle physics prediction.
- Industry-leading bandwidth efficiency and performance.
- Hard blocker: no WebGL support. If browser deployment can be dropped, this is the strongest free solution.

### Tier 2 — Viable with Caveats

**FishNet** — Best free option with WebGL.
- Mature prediction, community vehicle examples, WebSocket transport via Bayou.
- No official racing template — more engineering work to integrate vehicle physics.
- No built-in async services.

**Netcode for Entities 6.6** — Best if already committed to DOTS.
- Full prediction/rollback, new GameObject layer in preview.
- Requires DOTS expertise. No racing sample.

### Tier 3 — Not Recommended

- **NGO 2.12** — No prediction = too much custom work.
- **Mirror** — Prediction experimental, not validated for vehicles.
- **PUN 2** — No server authority, no prediction.
- **Coherence** — No server-side physics, 30 Hz cap, expensive bandwidth.

### For Async Multiplayer (Ghosts, Leaderboards)

None of the real-time networking solutions provide built-in async features (except Reactor's Cluster API). For leaderboards and ghost data:
- **Photon** ecosystem includes Photon Voice, Chat, and a separate Cloud service for player data.
- **Self-hosted backend** (Node.js, Go, Nakama, PlayFab, Supercraft GSB) paired with any real-time solution is the common pattern.
- Ghost replay data can be stored as input sequences (Quantum/Netick) or state snapshots and replayed by the local client.

---

## Sources

- Unity Netcode for Entities 6.6 docs: docs.unity3d.com/Packages/com.unity.netcode@6.6
- Unity Netcode for GameObjects 2.12 changelog: docs.unity3d.com/Packages/com.unity.netcode.gameobjects@2.12/changelog/CHANGELOG.html
- Fusion 2.1 release notes: blog.photonengine.com/fusion-2-1-stable-release/
- Fusion Karts sample: doc.photonengine.com/fusion/current/game-samples/fusion-karts
- Fusion Physics Addon 2.1: doc.photonengine.com/fusion/v2/addons/physics-addon-2.1
- Quantum Karts 3: doc.photonengine.com/quantum/current/game-samples/karts
- Quantum WebGL: doc.photonengine.com/quantum/v2/manual/webgl
- Mirror client prediction: mirror-networking.gitbook.io/docs/manual/general/client-side-prediction
- FishNet prediction: fish-networking.gitbook.io/docs/guides/features/prediction
- Netick Rocket Cars: github.com/NetickNetworking/NetickRocketCars
- Netick physics prediction: netick.net/docs/2/articles/physics-prediction.html
- Reactor comparison: kinematicsoup.com/blog/reactor-vs-coherence-unity-multiplayer
- Reactor features: kinematicsoup.com/reactor
- Uverse comparison: uversedigital.com/blog/unity-netcode-vs-mirror-vs-photon (Jul 2026)
- OceanView Games comparison: dev.to/oceanviewgames/cross-platform-multiplayer-networking-in-unity-fishnet-mirror-and-photon-compared-3m36 (Jul 2026)
- Unity Research Report: images.response.unity3d.com/.../Unity-Choosing_Netcode-Research_Report-v1_1.pdf
- Rumble Racer case study: dev.to/firulais/how-i-built-a-scalable-lobby-for-a-real-time-mobile-racing-game-3jam
- NGO prediction devlog: discussions.unity.com/t/prediction-in-gameobject-netcode-devlog-entry-4/1719927
- StinkySteak benchmark: github.com/StinkySteak/unity-netcode-benchmark
- Photon WebGL guide: linkedin.com/pulse/photon-multiplayer-webgl-game-jams-photonengine-lwhse
- Mirror + backend guide: gsb.supercraft.host/blog/mirror-networking-vs-managed-backend/
