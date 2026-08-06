# Coherence — Architecture & Pricing Verification Note

**Prepared:** 2026-08-05
**Scope:** Verify six claims against primary official sources only (docs.coherence.io, coherence.io pricing/blog/FAQ, official API docs). No secondary sources were used for the claims themselves.
**Access date for all URLs:** 2026-08-05 (unless stated otherwise).
**Version note:** docs.coherence.io/2.3 is labeled "SDK 2.3 Preview" in llms.txt; 2.2 is the newest stable line (official API links resolve to v2.2.0). Unversioned pages (docs.coherence.io/...) track the current stable docs. Where a page exists in both, the 2.3/2.2 versions were read and matched.

**Certainty labels:** [C] verified from official source text · [I] inferred · [S] assumption (validate before relying on it)

---

## Claim 1 — 60 Hz simulation / replication support

**Verdict: partially true — the SDK clock and per-binding sampling run at up to 60 Hz, but cloud-hosted Simulators are capped at 30 FPS and the Replication Server (RS) packet send defaults to 20 Hz.**

| Fact | Evidence | Certainty |
|---|---|---|
| The network simulation clock ("Simulation Frame") runs at **60 Hz** (~16 ms resolution); every Client syncs to it. | docs.coherence.io/2.3/manual/advanced-topics/competitive-games/simulation-frame.md — "This clock runs at a 60Hz frequency which means that the resolution of a single simulation frame is ~16ms." | [C] |
| Per-binding replication sample rate can be configured; **the upper quantization limit is 60 Hz** ("sample rates beyond that are generally not recommended"). Not changeable at runtime. | docs.coherence.io/2.3/manual/optimization/simulation-frequency.md | [C] |
| **Uploaded (cloud-hosted) Simulators are automatically limited to 30 FPS**: "coherence will automatically limit the target framerate of uploaded Simulators to 30 frames per second. We plan to make it possible to lift this restriction in the future." | docs.coherence.io/2.3/manual/optimization/simulation-frequency.md (identical wording in 1.0/1.1/2.3 and unversioned) | [C] |
| RS **default packet send frequency is 20 Hz**; send/receive frequencies are adjustable per project (local CLI `--send-frequency`/`--recv-frequency`, or dashboard Advanced Config — dashboard adjustment is "available for paid plans"). No documented maximum send frequency found. | docs.coherence.io/2.3/manual/replication-server.md ("Adjusting send and receive frequencies"); docs.coherence.io/2.3/manual/optimization/simulation-frequency.md | [C] |

**Interpretation for racing/fast physics:** "60 Hz replication" is achievable in principle (60 Hz sampling + raised RS send frequency), but effective server-side simulation is bounded by the 30 FPS Simulator cap, and default out-of-the-box RS send is 20 Hz. A flat "60 Hz tick" claim would be misleading.

---

## Claim 2 — Client prediction and rollback, or only "anticipation"

**Verdict: both client-side prediction AND input rollback exist in the current docs. "Anticipation" is not a coherence concept (it is NGO's `AnticipatedNetworkVariable` terminology). However, the built-in rollback path (GGPO) is explicitly marked not production-ready, and FPS-style rollback is on the roadmap, not shipped.**

Two distinct mechanisms are documented:

**2a. Per-binding Client-side prediction (server-authoritative setups)** — [C]
- "With Client-side prediction enabled for a binding, incoming network data is ignored, allowing the Client to calculate (predict) its value locally."
- Prediction is only applied to bindings on objects where the Client holds Input Authority.
- Misprediction is detected and **reconciled manually**: "Misprediction detection and reconciliation can be implemented in a binding's `OnNetworkSampleReceived` event callback... There are many possible approaches to server reconciliation and coherence doesn't favor one over another." (snap vs. blend are both suggested; comparing to a local state-history buffer is recommended for accuracy).
- Source: docs.coherence.io/2.3/manual/networking-state-changes/authority/server-authoritative-setup.md (unversioned copy published 2026-01-20); also "Do client-side prediction" how-to (docs.coherence.io/getting-started/how-to).

**2b. GGPO-style input prediction + rollback + input delay (deterministic simulation)** — [C]
- "**coherence** Input Queues are backed by a rolling buffer of inputs transmitted between the Clients. This buffer can be used to build a fully **deterministic** simulation with a **client-side prediction**, **rollback**, and **input delay**. This game networking model is often called the GGPO."
- Rollback mechanics documented: historical state snapshots per frame, restore-to-last-valid-state + re-simulate on mismatch.
- **Production caveats (verbatim):** "This feature is currently not production ready out-of-the-box." and "GGPO is **not** recommended for FPS-style games. The correct rollback networking solution for those is planned to be added in the future."
- Source: docs.coherence.io/2.3/manual/advanced-topics/competitive-games/determinism-prediction-rollback.md

**Server-authority model:** in the centralized server-authoritative mode, "**coherence** currently only supports using **CoherenceInput** in a centralized way, where a single Simulator is setup to process all inputs and replicate the results to all Clients." — [C] server-authoritative-setup.md.

---

## Claim 3 — Authoritative / relay topology options

**Verdict: relay-centric ("Replication Server always at the center of the network") with four hosting modes; server authority is delegated to customer-run Simulators (headless Unity builds). The repo note's "managed relay + simulator model" is accurate but incomplete — it omits Client-hosting (P2P) and self-hosting.**

| Fact | Evidence | Certainty |
|---|---|---|
| Replication Server = "a lean and performant **smart relay** that keeps the state of the world, and replicates it efficiently between various Simulators and game Clients." Can run in coherence Cloud, locally, on-premise (self-host), or **hosted by one of the Clients (Client-hosting, peer-to-peer)**. | docs.coherence.io/2.2/overview.md (and unversioned /overview) | [C] |
| **Simulator** = "a special version of the Game Client without graphics (a 'headless' client), optimized and configured to perform server-side simulation." Server-side simulation is therefore your own Unity build, not a coherence-managed physics sim. | docs.coherence.io/2.2/overview.md | [C] |
| Two realtime space types: **Rooms** (short-lived, SDK-created sessions) and **Worlds** (long-lived/persistent, dashboard-managed); plus **Lobbies** (matchmaking/chat, not run by a Replication Server). | docs.coherence.io/2.3/manual/replication-server/rooms-and-worlds.md | [C] |
| **Client-hosting** relays available: Steam Relay, Epic Online Services Relay, Azure PlayFab Relay, Custom Relay. | docs.coherence.io/2.3/hosting/client-hosting.md (+ implementing-client-hosting/* subpages, per llms.txt index) | [C] |
| **Self-hosting** is an official option ("using your own server infrastructure"), but docs state it "requires an **Enterprise Support License**" / "special licensing". | docs.coherence.io/2.3/hosting/choosing-where-to-host.md (identical in 2.2); docs.coherence.io/2.2/hosting/self-hosting.md | [C] |
| World persistence caveat: "upon shutting down the World or restarting its Replication Server, the state of persistence is lost under current implementation." | rooms-and-worlds.md | [C] |

**Docs-internal conflict:** choosing-where-to-host.md / self-hosting.md say self-hosting requires an Enterprise Support License, while credit-cost-and-pricing.md says "**Client-Hosting and Self-Hosting options are covered by 3% game revenue share**", and the coherence 2.0 pricing announcement applies the revenue-share model to self-hosted games. These statements are inconsistent as written (license-gated vs. revenue-share). [I — reconcile with coherence before planning around self-hosting; see Claim 6.]

---

## Claim 4 — WebGL / WebSocket transport constraints

**Verdict: WebGL is fully supported, but the transport is WebRTC — NOT WebSocket. The repo note's "Yes, via WebSocket relay" is wrong.**

| Fact | Evidence | Certainty |
|---|---|---|
| "coherence SDK supports networking in WebGL without any additional setup. Both Rooms and World topologies are supported, as are all of coherence features (persistency, authority switch, etc.)." | docs.coherence.io/2.3/support/webgl.md (unversioned published 2026-04-28) | [C] |
| **Transport: "WebGL builds use WebRTC to connect to the Replication Server"** — ports differ from native UDP; the RS acts as the WebRTC signaling server (`--signalling-port`, defaults **42002 for Rooms, 32002 for Worlds**). | docs.coherence.io/2.3/support/webgl.md | [C] |
| Why WebRTC: official coherence blog — browsers block UDP; WebSockets are "simple and reliable, but slow" (TCP-based); coherence implemented a JavaScript interop layer with WebRTC datachannels (Pion/WebRTC on the RS, Twilio STUN/TURN). coherence's custom reliability layer is disabled for this transport because WebRTC is reliable by default. | coherence.io/blog/tech/unity-webgl-game-builds-meet-multiplayer (published 2023-05-25) | [C] |
| WebGL has **no multi-threading**: "inherently threaded functionality (like Task.Delay) will not run properly." | docs.coherence.io/2.3/support/webgl.md | [C] |
| Known issue: "WebGL builds running locally can't connect to the coherence Cloud on Firefox." | docs.coherence.io/2.3/support/webgl.md; docs.coherence.io/support/known-issues.md | [C] |
| Client-hosting in browsers is additionally constrained by browser UDP-blocking; WebRTC datachannel connectivity depends on relay/TURN availability. | [I] from blog + client-hosting docs | [I] |

---

## Claim 5 — CloudStorage / KV availability and limitations

**Verdict: both exist. KV Store is legacy (superseded by Cloud Storage). Cloud Storage currently retains data for only 1 hour — a hard limitation for persistent leaderboards/ghosts unless retention becomes configurable.**

**5a. Cloud Storage (current)** — [C] docs.coherence.io/2.3/hosting/coherence-cloud/game-services/cloud-storage.md (unversioned published 2026-04-27; identical in 2.2)
- General object store in the coherence Cloud. Objects addressed by `StorageObjectId` (type + id), e.g. ("Player", playerAccountId).
- API: `SaveObjectAsync`, `LoadObjectAsync`, `DeleteObjectAsync`. JSON serialization via Json.NET; Unity types (Vector2/3, Quaternion, Color, Color32) supported; `UnityEngine.Object` derivatives not supported.
- **Requires authentication** (logged-in player account).
- **Retention: "Currently, data is held for 1 hour. In the future, this will be configurable."** — [C]
- **Throttling: rate limit of one API request of a particular type per second**, mitigated by automatic client-side batching ("an operation should almost never have to sit in queue for more than a second"). — [C]
- **Security caveat: "Any client can read or write storage objects at any time. Data is available as long as the client knows the identifier to access it."** (no per-object access control) — [C]

**5b. Key-Value Store (Legacy)** — [C] docs.coherence.io/2.3/hosting/coherence-cloud/game-services/key-value-store.md
- Header: "This feature has been superseded by Cloud Storage."
- Per-player scope; requires authentication.
- **Limitations:** keys must be alphanumeric/underscore/dash; **values must be strings only** (numbers/arrays must be stringified); **total stored data ≤ 256 KB per player**; unlimited read/write frequency.
- Still billed as a resource: "KV Database 5 credits / 100MB / Hour" (credit-cost-and-pricing.md).

---

## Claim 6 — Free tier and commercial pricing

**Verdict: the repo note's "Per-CCU + CPU-time (credit system)" is outdated. Since coherence 2.0 (effective 2025-11-18) the model is: free/pro subscription tiers for the tools + usage-based credits for coherence Cloud + 3% revenue share for Client/self-hosting.**

**6a. Subscription tiers (tools license)** — [C] coherence.io/pricing (accessed 2026-08-05)
- **Starter — FREE**: studios with < $200K annual revenue or funding. Full SDK access; **no feature difference vs. Pro**.
- **Pro — $1,000/month or $8,000/year + tax**: studios ≥ $200K.
- Both tiers: unlimited projects, unlimited CCU (tools tier), any platform. Pro adds tailored onboarding + more one-time free credits.
- Eligibility is enforced per the official Pricing Policy (coherence.io/revenue): tier measured over trailing 12 months; Starter cannot be used once Total Finances exceed $200K, even for internal projects. — [C]

**6b. coherence Cloud (managed hosting) — pre-paid credits** — [C] docs.coherence.io/2.3/support/credit-cost-and-pricing.md (unversioned published 2026-01-30)
- Credit costs: **CCU hour = 1 credit**; Simulators = 20/40/80/160 credits per server-hour (Small/Medium/Large/X-Large); **Bandwidth = 200 credits/1 GB**; KV Database = 5 credits/100MB/hour; Storage = 0.07 credits/GB/hour. 1 GB = 1000 MB for billing.
- Credit purchase prices: $1.60 per 1000 (1k–100k), $1.30 (101k–250k), $1.15 (251k–500k), $0.99 (500k+). Up to 60% saving on bulk pre-purchase.
- **CCU caps (non-Enterprise): individual Rooms ≤ 100 CCU; individual Worlds ≤ 1000 CCU.** Enterprise can request custom limits. — [C]
- Free one-time credits: **Starter 5,000; Pro 5,000 + 100,000 after the 30-day trial.** — [C] community.coherence.io/t/updated-coherence-2-0-pricing-faq/794 (2026-03-04)
- Credits are non-expiring; game goes offline if balance drops below 0 (warning email < 1000 credits). — [C]

**6c. Client-hosting & Self-hosting — 3% revenue share** — [C]
- "Client-Hosting and Self-Hosting options are covered by **3% game revenue share**," invoiced only "if your game makes more than $15,000" per quarter, limited to revenue above $15K; custom deal suggested from $5M/quarter. — credit-cost-and-pricing.md; coherence.io/blog/tech/introducing-coherence-2-0 (2025-11-18: "3% revenue share only after a game earns more than $15K per quarter (with a clear upper cap)")
- Conflict with the Enterprise Support License wording for self-hosting (see Claim 3). [C] both statements exist; reconciliation needed [I]

**6d. Transition & staleness flags**
- 2.0 pricing effective 2025-11-18 across all SDK versions; legacy subscribers grandfathered (100% discount on Pro if subscribed before 2025-11-18); forced transition deadline June 30, 2026. — [C] community FAQ (2026-03-04)
- **Stale official page:** coherence.io/multiplayer-sdk-faqs still describes the pre-2.0 model ("The jump from Free to Bronze ($100/month) quadruples your resources"). Contradicts the current pricing page. Treat it as deprecated content. — [C]

---

## Conflicts with the repo's current note (docs/research/multiplayer-networking-comparison-2026.md, §10 "Coherence", prepared 2026-07-19)

| Repo note claim | Verification result |
|---|---|
| "30 Hz tick cap on server-side simulation" | **Overstated.** The 30 FPS cap applies to the framerate of *uploaded (cloud) Simulators* only. The simulation clock is 60 Hz and per-binding sampling quantizes up to 60 Hz; RS send defaults to 20 Hz and is adjustable. [C] |
| "Client prediction with rollback: Not built in at the architecture level... only anticipation" | **Wrong for 2026.** Per-binding client-side prediction (server-auth, manual reconciliation) and GGPO input prediction+rollback are both documented. Caveats: GGPO "not production ready out-of-the-box" and "not recommended for FPS-style games"; FPS-style rollback not yet shipped. "Anticipation" is NGO terminology, not coherence's. [C] |
| "Yes, via WebSocket relay" [I] | **Wrong.** WebGL connects via **WebRTC** (RS acts as signaling server). [C] |
| "License: Per-CCU + CPU-time (credit system)" | **Outdated.** Post-2025-11-18: free Starter / $1k-per-month Pro tools tiers; coherence Cloud billed in credits (CCU-hour, bandwidth, sim hours, storage); Client/self-hosting billed by 3% revenue share above $15K/quarter. [C] |
| "Managed relay + simulator model. For server authority, requires a headless Unity instance... you construct the authority layer yourself" | **Accurate but incomplete.** RS is a smart relay; Simulators are your headless Unity builds. Omits officially supported Client-hosting (P2P with Steam/EOS/PlayFab/custom relays) and self-hosting. [C] |
| "Highest bandwidth cost of all solutions" | **Unsupported by official sources.** No official cross-vendor bandwidth comparison found; credit pricing is documented (200 credits/GB) but no relative claim is verifiable from primary sources. [S] — flag for verification |
| WebGL/CloudStorage/KV coverage | The note says nothing about Cloud Storage/KV. Current facts: KV is legacy (strings only, 256 KB/player); Cloud Storage exists but retains data only **1 hour** (not configurable), throttled to 1 request/type/s, no per-object access control. [C] |

---

## Correction recommendation (concise)

Update §10 of `docs/research/multiplayer-networking-comparison-2026.md` to:

1. Replace "30 Hz tick cap" with the precise wording: *Simulation clock 60 Hz; per-binding sampling up to 60 Hz; uploaded Simulators capped at 30 FPS; RS packet send default 20 Hz (adjustable, dashboard option on paid plans)*.
2. Replace "no prediction/rollback" with: *per-binding client-side prediction with manual reconciliation (server-auth) + GGPO input prediction/rollback (documented but explicitly "not production ready" and "not recommended for FPS-style games"; FPS rollback on roadmap)*. The racing-game verdict ("not suitable") survives, but for these reasons: GGPO immature/not FPS-appropriate, 30 FPS Simulator cap, manual reconciliation burden — not because prediction/rollback is absent.
3. Replace "WebSocket relay" with *WebRTC transport (signalling ports 42002 Rooms / 32002 Worlds; no multithreading; Firefox local-Cloud limitation)*.
4. Replace the license line with the 2.0 model: *free Starter (< $200K revenue) / $1K-per-month Pro; coherence Cloud credits (CCU-hour 1 credit, bandwidth 200 credits/GB, sims 20–160 credits/h); Rooms 100 CCU / Worlds 1000 CCU caps (non-Enterprise); Client/self-hosting 3% revenue share above $15K/quarter; self-hosting license wording conflicts with revenue-share wording in current docs — verify with coherence.*
5. Add a CloudStorage/KV row: *KV legacy (strings-only, 256 KB/player); Cloud Storage current (JSON objects, 1-hour retention, 1 req/type/s, open access by identifier) — insufficient for durable leaderboards/ghost persistence as of 2026-08-05.*
6. Mark "highest bandwidth cost" as unverified; official sources provide credit prices but no cross-vendor comparison.

---

## Source ledger (all official/primary; accessed 2026-08-05)

| # | Source | URL | Published / noted |
|---|---|---|---|
| S1 | Simulation frequency (SDK 2.3) | docs.coherence.io/2.3/manual/optimization/simulation-frequency.md | 2.3 preview; text identical in 1.0/1.1 |
| S2 | Simulation frame | docs.coherence.io/2.3/manual/advanced-topics/competitive-games/simulation-frame.md | 2.3 preview |
| S3 | Determinism, prediction and rollback | docs.coherence.io/2.3/manual/advanced-topics/competitive-games/determinism-prediction-rollback.md | 2.3 preview; identical in 1.3–1.7 |
| S4 | Server-authoritative setup | docs.coherence.io/2.3/manual/networking-state-changes/authority/server-authoritative-setup.md | unversioned copy 2026-01-20 |
| S5 | Overview | docs.coherence.io/2.2/overview.md (+ /overview) | current stable |
| S6 | Replication Server | docs.coherence.io/2.3/manual/replication-server.md | 2.3 preview; identical in 2.0 |
| S7 | Rooms and Worlds | docs.coherence.io/2.3/manual/replication-server/rooms-and-worlds.md | 2.3 preview |
| S8 | WebGL support | docs.coherence.io/2.3/support/webgl.md (+ /support/webgl) | unversioned 2026-04-28 |
| S9 | Choosing where to host | docs.coherence.io/2.3/hosting/choosing-where-to-host.md (= 2.2) | current |
| S10 | Self-hosting | docs.coherence.io/2.2/hosting/self-hosting.md | current |
| S11 | Client-hosting (P2P) | docs.coherence.io/2.3/hosting/client-hosting.md | 2.3 preview |
| S12 | Cloud Storage | docs.coherence.io/2.3/hosting/coherence-cloud/game-services/cloud-storage.md (= 2.2) | unversioned 2026-04-27 |
| S13 | Key-Value Store (Legacy) | docs.coherence.io/2.3/hosting/coherence-cloud/game-services/key-value-store.md | current |
| S14 | Credit cost & pricing | docs.coherence.io/2.3/support/credit-cost-and-pricing.md | unversioned 2026-01-30 |
| S15 | Plans and Pricing (site) | coherence.io/pricing | accessed 2026-08-05 |
| S16 | Pricing Policy (legal) | coherence.io/revenue | current |
| S17 | Introducing coherence 2.0 (blog) | coherence.io/blog/tech/introducing-coherence-2-0 | 2025-11-18 |
| S18 | Updated coherence 2.0 Pricing FAQ (official forum) | community.coherence.io/t/updated-coherence-2-0-pricing-faq/794 | 2026-03-04 |
| S19 | WebGL multiplayer blog (transport rationale) | coherence.io/blog/tech/unity-webgl-game-builds-meet-multiplayer | 2023-05-25 |
| S20 | Multiplayer SDK FAQs (site) — STALE vs. 2.0 pricing | coherence.io/multiplayer-sdk-faqs | references pre-2.0 Bronze tier |

Secondary sources were used only to *locate* official pages (search engine hits for docs.coherence.io / coherence.io domains); no claim in this note rests on them.
