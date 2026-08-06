# Traceability Matrix: Foundation GDDs ↔ ADRs

Generated: 2026-07-28
Method: Cross-reference each Foundation GDD Technical Requirement against the 11 Accepted ADRs.

> **Superseded for multiplayer and networking decisions on 2026-08-05.** ADR-0016 and ADR-0017 are not represented here. Do not use this artifact for current networking traceability; a formal `/architecture-review full` regeneration is pending.

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Covered | ADR explicitly addresses this requirement |
| ⚠️ Partial | ADR partially covers this (e.g., schema defined but formula not codified) |
| ❌ Gap | No ADR addresses this requirement |

---

## Input System (Core Rules + Interactions)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| IN-01 | Two action maps: `OverdriveGameplay` (5 actions) + `OverdriveUI` (6 actions), exactly one active | ADR-0005 §Context, §Decision, GDD Reqs table: "2 action maps" | ✅ |
| IN-02 | `InputContextController` as sole owner of action-map activation and `InputSystemUIInputModule` routing | ADR-0005 §Decision, GDD Reqs table: "InputContextController as sole owner" | ✅ |
| IN-03 | Pause (Escape/Start) reserved across ALL contexts — cannot be remapped, replaced, or removed | ADR-0005 §Constraints, §GDD Reqs table: "Pause reserved across all contexts" | ✅ |
| IN-04 | CameraToggle presentation-only — never enters SimulationInput, tick pipeline, Replay, or Ghost Recording | ADR-0005 §Decision (CameraToggle isolation), §GDD Reqs table: "CameraToggle presentation-only" | ✅ |
| IN-05 | Dead zones: gamepad stick radial (inner 0.15, outer 0.95), trigger axial (inner 0.05), keyboard/mouse exempt | ADR-0004 §ControlProfile (StickDeadZoneInner/Outer fields, per-field validation); ADR-0005 depends on ADR-0004 for profiles. Dead-zone normalization formulas are not in any ADR. | ⚠️ |
| IN-06 | EMA smoothing: α_accelerate=0.3, α_brake=0.3, α_steer=0.5; EMA initialized on scheme change and UI→Gameplay resume | ADR-0004 §ControlProfile (alpha fields, validation); ADR-0005 §Context handoff (EMA reinitialization on resume). The recurrence formula `output = α × raw + (1-α) × prev` is not in any ADR. | ⚠️ |
| IN-07 | Brake priority: `brakeOut = filteredBrake`; `accelerateOut = 0 when rawBrakePostDeadZone > 0`; Accelerate EMA frozen during brake priority | The SimulationInput contract (accelerateOut/brakeOut) is referenced in ADR-0001 and ADR-0005, but the brake-priority logic itself is not codified in any ADR. | ❌ |
| IN-08 | SimulationInput contract: `accelerateOut`, `brakeOut`, `steerOut`, `rawXxxPostDeadZone`, `pauseEdge`, `inputAvailability` — the sole gameplay-input contract per tick | ADR-0001 §Decision (SimulationInput crosses tick boundary, CaptureLatestRawSample timing); ADR-0005 §Decision (SimulationInput contract: "ResolvedCarInput[carId] (accelerateOut, brakeOut, steerOut)") | ✅ |
| IN-09 | CaptureLatestRawSample called exactly once before accumulator evaluation; same simulation-driver Update call; no MonoBehaviour script-order assumption | ADR-0001 §Decision: "Input System processes platform events in Dynamic Update... Simulation invokes Input-owned `CaptureLatestRawSample()` exactly once" | ✅ |
| IN-10 | Context handoff latching: every newly enabled digital action latched until neutral/released; Accelerate/Brake/Steer exempt on UI→Gameplay; pending pauseEdge cleared | ADR-0005 §Decision (InputContextTransition, latch rules per direction), §GDD Reqs table: "Context handoff latching" | ✅ |
| IN-11 | Remappable bindings: 4 actions (Accelerate, Brake, Steer, CameraToggle); KeyboardMouse composite-part binding; stable action/binding IDs; unknown ID fallback | ADR-0004 §BindingOverride (ActionId/BindingId as Guid, stable after first shipped schema); ADR-0005 GDD Reqs table: "4 rebindable actions" + reserved exclude list | ✅ |
| IN-12 | `ProcessEventsInDynamicUpdate` — Input System update mode; not `ProcessEventsInFixedUpdate` | ADR-0005 §Post-Cutoff APIs Used: "InputSettings.UpdateMode enum renamed: ProcessEventsInDynamicUpdate" | ✅ |
| IN-13 | Device arbitration: KeyboardMouse default, last meaningful device wins; same-frame ambiguity preserves current; EMA reinit on scheme change | ADR-0005 §Decision (ActiveControlScheme, meaningful-event definitions, same-frame oscillation prevention) | ✅ |
| IN-14 | Input availability: `Available` / `NoInputDevice`; zeroed SimulationInput with flag when no device; HUD overlay | ADR-0005 §Requirements (InputAvailability enum, NoInputDevice → zeroed SimulationInput); ADR-0005 §Validation Criteria (no device test) | ✅ |
| IN-15 | Finished UI Pause: `OverdriveUI.Pause` (P/Start) routed to UI Presentation only while `SimulationState.Finished`; toggles terminal timer; never queues a gameplay edge | ADR-0005 §Decision (OverdriveUI.Pause in Finished context, routed to UI Presentation), §Input Contexts table | ✅ |

---

## Simulation Architecture (Core Rules + Snapshots + States)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| SA-01 | Fixed 60 Hz timestep: `FIXED_DT = 1/60`, manual accumulator in `Update()`, not `FixedUpdate()` | ADR-0001 §Decision: "MVP uses `Physics.simulationMode = SimulationMode.Script`, one whole-scene `Physics.Simulate(1/60f)` per active tick" | ✅ |
| SA-02 | Manual accumulator: accumulate `Time.unscaledDeltaTime`, clamp to `2 × FIXED_DT`, loop steps | ADR-0001 §Decision (spiral-of-death clamp: 2× FIXED_DT max), §Consequences (accumulator preserves remainder) | ✅ |
| SA-03 | 14-step tick pipeline (Steps 1–14): input capture, pause consume, countdown, fuel+tire, forces, Physics.Simulate, grid-lock, CarState readout, Pit Stop, RSM, counters, snapshot publish, AI, ResolvedCarInput | ADR-0001 §Decision (13-step pipeline); ADR-0006 §Decision extends Step 5 into 5a/5b; ADR-0011 §Decision inserts Step 9b. The canonical 14-step model emerges from the ADR set. | ✅ |
| SA-04 | Spiral-of-death clamp: `accumulator = min(accumulator, 2 × FIXED_DT)`; excess time permanently discarded | ADR-0001 §Decision (clamp to 2× FIXED_DT), §Consequences (no catch-up) | ✅ |
| SA-05 | Performance gate: 16-car prototype p95 ≤ 6 ms, max ≤ 8 ms per tick before content expansion | ADR-0001 §Decision ("The lowest-cost machine meeting p95 ≤ 6 ms and maximum ≤ 8 ms is recorded in a follow-up ADR"), §Validation Criteria | ✅ |
| SA-06 | Performance protection: `PerformanceReduced` below 30 FPS for 3s; below-15 for further 3s → Paused with Resume/Return to Menu | ADR-0001 §PerformanceReduced Signal (thresholds, RecoveryTimer, state transitions) | ✅ |
| SA-07 | Render interpolation in LateUpdate: `α = accumulator / FIXED_DT`, `Lerp` position, `Slerp` rotation; `Rigidbody.interpolation = None` | ADR-0001 §Decision ("manual interpolation runs in `LateUpdate`"; "Rigidbody.interpolation = None") | ✅ |
| SA-08 | SimulationState ownership: Simulation Architecture is the only writer; RSM owns RaceMode + transition requests; Content Pipeline never writes SimulationState | ADR-0001 §Decision: "Simulation Architecture is the only writer of `SimulationState`" | ✅ |
| SA-09 | Countdown: 300 ticks; tick that decrements to zero is still Countdown; GO releases grid lock after physics; next tick begins Racing | ADR-0001 §Decision: "Race Countdown is 300 simulation ticks" | ✅ |
| SA-10 | Qualifying direct entry: enters Racing directly from Loading; no Countdown, grid lock, or lights sequence for Qualifying | ADR-0001 §Decision: "Qualifying does not use Countdown... enters Racing/GameplayQualifying directly" | ✅ |
| SA-11 | ReplayInitialState captured at GO: immutable copy of sim_seed, track_id, DifficultyProfile, GridAssignment, car IDs, initial Fuel/Tire, PerfectStartRemainingTicks | ADR-0001 §Decision (ReplayInitialState defined, captured at GO), ADR-0008 §ReplayInitialState struct | ✅ |
| SA-12 | PCG32 is the only gameplay PRNG; `UnityEngine.Random` prohibited on simulation path | ADR-0001 §Decision ("PCG32 remains the only gameplay PRNG"); ADR-0009 confirms no UnityEngine.Random | ✅ |
| SA-13 | Unity.Mathematics (`float3`, `math.*`, `quaternion`) consistently for all simulation math | ADR-0001 §Decision (implicit via TickStartSnapshot schema using float3); ADR-0002 §GDD Reqs ("All sim math uses Unity.Mathematics") | ✅ |
| SA-14 | Physics callbacks must not mutate gameplay state: no `OnCollision*`/`OnTrigger*` writes to CarState, Fuel, Tire, RSM, AI | ADR-0001 §Decision ("no physics callbacks mutate state"); ADR-0006 §Registry Check confirmed | ✅ |
| SA-15 | Focus loss lifecycle: focus-change frame adds no delta; immediately publishes Paused without physics tick; preserves remainder; requires explicit Resume | ADR-0001 §Decision ("The accumulator consumes focus-change notifications before reading `Time.unscaledDeltaTime`; the focus-change frame adds no delta"), §PerformanceReduced Signal | ✅ |
| SA-16 | Race reconfigure (content retained, domain owners reset): `RaceReconfigureStart` one-way event | ADR-0003 §Decision (RaceReconfigure flow, cache-hit semantics, no Addressables I/O) | ✅ |
| SA-17 | PostFinishSnapshot: immutable capture of final post-physics state; consumed by RSM FinishOrderResolver once | ADR-0001 §Decision (PostFinishSnapshot captured at Step 11, consumed by FinishOrderResolver) | ✅ |
| SA-18 | MVP buffer discard: in-memory recordable-input always discarded on Results, Forfeit, load failure, Idle | ADR-0001 §Decision ("MVP records only completed Racing continuous inputs... and always discards the buffer"); ADR-0008 §MVP Lifecycle | ✅ |
| SA-19 | PhysX boundary: same executable/same physical machine/environment only; no cross-machine determinism; Beta canonical state must not depend on local PhysX | ADR-0001 §Decision ("MVP repeatability means the same executable on the same physical machine/environment"; "Beta canonical multiplayer state must not depend on local PhysX") | ✅ |

---

## Settings (Core Rules + Storage + Apply Model)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| ST-01 | 6 categories: Difficulty, Controls, Audio, Display, Accessibility, Camera | ADR-0004 §Context (9 consumer systems, 5 DifficultyProfiles); §GDD Reqs table lists settings.md categories | ✅ |
| ST-02 | PlayerPrefs JSON blob: single key `"OverdriveSettings"`, version field for migration | ADR-0004 §Decision (SettingsPersistence with PrimaryKey/BackupKey, JSON blob) | ✅ |
| ST-03 | Backup-first write: serialize → validate → write backup → write primary; corrupt primary → restore from backup; both corrupt → factory defaults | ADR-0004 §Decision (backup-first atomic write, SaveResult enum, load cascade) | ✅ |
| ST-04 | Schema migration v1→v3: v1 → inner/outer dead zone, discard vibration; v2 → discard trigger threshold and subtitles | ADR-0004 §Decision (SettingsMigration, sequential migration v1→v2→v3), §Validation Criteria | ✅ |
| ST-05 | DifficultyProfile immutable per race: snapshotted at race init, never mutated mid-race | ADR-0004 §Decision (DifficultyProfileId snapshotted at race init), §Context | ✅ |
| ST-06 | Transactional preview: `SettingsEditSession` with Snapshot (active), Working (preview), Apply/Cancel | ADR-0004 §Decision (SettingsEditSession with Apply/Cancel/IDisposable) | ✅ |
| ST-07 | DisplayConfirm: 15-second timer for resolution/fullscreen changes; timer, Cancel, or focus loss restores pre-preview | ADR-0004 §Decision (DisplayConfirm flow, 15s timer, focus loss → restore) | ✅ |
| ST-08 | Control remapping flow: select slot → Listening → capture → conflict detection → Apply persists | ADR-0004 §BindingOverride; ADR-0005 §Decision (rebindable action allowlist, reserved exclude list). The remapping flow steps are not in ADRs. | ⚠️ |
| ST-09 | Binding IDs stable after first shipped schema; unknown ID → discard only that override, restore slot default | ADR-0004 §Decision (BindingOverride.ActionId/BindingId as Guid, unknown ID fallback) | ✅ |
| ST-10 | Override precedence: PerformanceReduced (highest) > ReducedMotion > player preferences | ADR-0004 §Decision (override precedence rules: "PerformanceReduced has highest runtime authority") | ✅ |
| ST-11 | Blocked during active Countdown: Settings cannot open; available only after Pause transitions Countdown to UI context | ADR-0004 §Decision (Countdown state machine: "Countdown active → Settings BLOCKED"); ADR-0001 §Decision (lifecycle integration) | ✅ |
| ST-12 | Quality presets: Low/Medium/High/Ultra; render scale, shadows, MSAA, anisotropic, VFX density mapping | ADR-0004 §Decision (4 QualityPresets listed); ADR-0010 §Quality Presets (Low/Medium/High definitions) | ✅ |
| ST-13 | Validated profile loading: per-field range validation with fallback to approved defaults | ADR-0004 §Decision (per-field validation, NaN/Inf → default), §ControlProfile struct comments | ✅ |
| ST-14 | `BindingOverride` struct: `ActionId`, `BindingId`, `Path`, `IsReserved`; reserved bindings cannot be rebound | ADR-0004 §Decision (BindingOverride struct); ADR-0005 §Decision (which actions are rebindable) | ✅ |
| ST-15 | SettingsInputPreviewEvaluator: UI-only dead-zone/EMA preview, does not read/write SimulationInput | ADR-0004 §Decision (SettingsInputPreviewEvaluator class); ADR-0005 references SettingsInputPreviewEvaluator | ✅ |

---

## Content Pipeline (Core Rules + State Machine + Edge Cases)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| CP-01 | 3 Addressable groups: Shared (lifelong), Cars/{teamId} (per-race), Tracks/{trackId} (per-race) | ADR-0003 §Decision (3-group topology, AddressableKeys constants), §GDD Reqs table | ✅ |
| CP-02 | Parallel loading: track + 16 car bundles loaded asynchronously in parallel | ADR-0003 §Decision (LoadRace initiates 17 async handles in parallel) | ✅ |
| CP-03 | Loading screen: progress bar from byte counts, minimum 0.5s display, blocks all input | ADR-0003 §Decision (OnLoadingProgress from PercentComplete, loading cancellation blocked); loading screen UI specifics (min 0.5s, VFX budget, "Preparing...") not in ADR | ⚠️ |
| CP-04 | First-launch catalog initialization: "Preparing..." with spinner; retry once then close on failure | ADR-0003 §Risks ("Catalog init failure: retry once. If retry fails, app closes."). First-launch spinner UI not in ADR. | ⚠️ |
| CP-05 | CP_ state machine: CP_Idle/CP_LoadingTrack/CP_LoadingCars/CP_Ready/CP_Racing/CP_Unloading/CP_Error | ADR-0003 §Decision (7 CP_ states defined, CP_ ↔ SimulationState mapping) | ✅ |
| CP-06 | Race reconfigure: no Addressables I/O, cache-hit semantics, `RaceReconfigureStart` event for domain owners | ADR-0003 §Decision (RaceReconfigure flow with cache-hit guarantee) | ✅ |
| CP-07 | Memory budgets: PC 730–1320 MB, WebGL 415–670 MB per race | ADR-0003 §Decision (confirms GDD budgets, delegates profiling) | ✅ |
| CP-08 | WebGL constraints: 768 MB min heap, ASTC 6×6, 1024px textures, 3 LODs, ≤3 MB car bundles, Medium default | ADR-0003 §Context ("WebGL heap up to 4 GB", "ASTC 6×6 compression available as extension"); detailed constraints (768 MB, 1024px, LODs) only in GDD | ⚠️ |
| CP-09 | Graceful degradation: car failure → skip + placeholder; track failure → abort; shared failure → fatal | ADR-0003 §Decision (CarLoadResult enum, ContentErrorType, graceful degradation per type) | ✅ |
| CP-10 | UnloadRace called at start of every LoadRace (safety); destroy instances first, then release handles | ADR-0003 §Decision ("unload last race before loading new one"; Addressables.ReleaseInstance + Release) | ✅ |
| CP-11 | Addressables API only: no `Resources.Load()` for content assets | ADR-0003 §Constraints ("Must use Addressables API for all asynchronous asset loading. Resources.Load() is avoided"), §Validation Criteria | ✅ |
| CP-12 | Loading blocks Cancel/Back: input ignored after loading begins until RaceLoadReady or ContentLoadError | ADR-0003 §Decision ("Loading state blocks Cancel/Back"); GDD Reqs table entry | ✅ |
| CP-13 | Memory pressure threshold: <0.85 normal, 0.85–0.95 warning, >0.95 critical (abort) | ADR-0003 §Risks ("memory usage > 95% threshold during loading → abort, release partial handles, emit ContentLoadError") | ✅ |
| CP-14 | Loading progress from total bytes: `progress = bytes_loaded / total_bytes` | ADR-0003 §Decision (OnLoadingProgress from AsyncOperationHandle.PercentComplete) | ✅ |
| CP-15 | Error recovery: CarLoadResult (Success/SkippedPlaceholder/Failed); ContentErrorType (Track/Car/Shared/Catalog) | ADR-0003 §Decision (CarLoadResult enum, ContentErrorType enum, event-driven error propagation) | ✅ |

---

## Ghost Recording (Core Rules + Format + Lifecycle)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| GR-01 | MVP recordable boundary: in-memory buffer, always discarded on Results/Forfeit/Idle/Load failure | ADR-0008 §MVP Lifecycle (discard on every exit), §GDD Reqs table | ✅ |
| GR-02 | ReplayInitialState: seed, track_id, race_config_id, content_version_hash, DifficultyProfile, GridAssignment, car IDs, initial fuel/tire, PerfectStartRemainingTicks | ADR-0008 §Decision (ReplayInitialState struct with all defined fields) | ✅ |
| GR-03 | Continuous input stream: 12 bytes/tick (3 × float32: accelerateOut, brakeOut, steerOut) per completed Racing tick | ADR-0008 §Decision (GhostBuffer.RecordTick, continuous stream format) | ✅ |
| GR-04 | Edge events: standalone Pause events as separate stream (5 bytes: uint32 tick_index + uint8 flags) | ADR-0008 §Decision (GhostBuffer.RecordEdgeEvent, EdgeEventFlags enum) | ✅ |
| GR-05 | 22,500 tick cap (375s × 60 Hz); buffer marked non-serializable if capped; never discard oldest ticks | ADR-0008 §Decision (GhostBuffer maxTicks: 22500, IsSerializable = false at cap) | ✅ |
| GR-06 | Binary format: 80-byte header with magic 0x47485354, version, stream sizes, CRC32 | ADR-0008 §Decision (GhostHeader struct with all fields, magic constant) | ✅ |
| GR-07 | CRC32 per 256-tick block + final stream CRC for integrity validation | ADR-0008 §Decision (CRC32 per 256-tick block and at stream end) | ✅ |
| GR-08 | LZ4 compression (optional, flagged in header) | ADR-0008 §Decision (flags bitfield, compression flag in header) | ✅ |
| GR-09 | Alpha persistence: serialize only on new personal best; local cache max 5; retry queue (3 attempts) | ADR-0008 §Alpha Persistence Gate (PB check, serialization, retry logic) | ✅ |
| GR-10 | Ghost visualization: opacity 0.4, URP Unlit + alpha blend, no collision, no engine audio | ADR-0008 §GDD Reqs table ("Ghost visualization (opacity 0.4, no collision, no audio)"); visual property details in ADR but HUD integration data flow not defined | ⚠️ |
| GR-11 | HUD integration: time delta, delta bar, lap split comparison, off-screen ghost indicator | Not addressed in any ADR. The GDD defines HUD requirements but no ADR codifies the ghost→HUD data flow contract. | ❌ |
| GR-12 | CloudStorage: upload/download via Coherence, key `"ghost_trackId_playerId"`, PlayerAccount login | ADR-0008 §Alpha Persistence Gate (upload/download flow, retry). Coherence API specifics not in ADR. | ⚠️ |

---

## Multiplayer Architecture (Network Phases + Data Flow)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| MP-01 | MVP offline only: no Coherence connection, transport, room, or network traffic; gameplay systems independent of transport types | No ADR explicitly states MVP has no network traffic. ADR-0001 implies local-only via PhysX boundary clause. No ADR codifies the "no Coherence dependency" architectural constraint. | ❌ |
| MP-02 | Alpha async ghost sharing: Auth + CloudStorage for ghost upload/download; no real-time | ADR-0008 ⚠️ (ghost persistence gate defines Alpha behavior, but ADR-0008 does not explicitly state the async-only constraint for Alpha) | ⚠️ |
| MP-03 | Beta real-time multiplayer: 16-player rooms, relay, InputQueues, rollback | No ADR defines Beta multiplayer architecture. The multiplayer GDD describes this but no ADR records the decision. | ❌ |
| MP-04 | Build-time phase configuration (MVP/Alpha/Beta); not a runtime toggle | No ADR defines build-time phase gating. | ❌ |
| MP-05 | Simulation loop independence: MVP simulation uses manual accumulator; Beta may replace driver without changing gameplay-system contracts | ADR-0001 §Consequences ("Explicit ownership, tick order, pause behavior and future-network boundary"); no ADR explicitly states the "no transport type dependency" constraint. | ⚠️ |
| MP-06 | Beta input packet format: 14 bytes (tick, playerIndex, flags, steerRaw, throttle, brake, checksum) | No ADR defines the Beta input packet format. The GDD describes it as a candidate. | ❌ |
| MP-07 | GGPO-style rollback: 10-tick max window, repeat last known input prediction, kinematic state only | No ADR defines the rollback mechanism. | ❌ |
| MP-08 | Coherence relay model: server forwards inputs, no server-side simulation | No ADR codifies the Coherence relay architecture. | ❌ |
| MP-09 | Disconnection handling: brief (<3s) buffer, long (>3s) reconnect with backoff, permanent → AI takeover | No ADR defines disconnection behavior. | ❌ |
| MP-10 | No global leaderboard in MVP, Alpha, or current Beta design; Coherence Cloud KV not suitable for ordered queries | No ADR explicitly states the deferred-global-leaderboard constraint. | ❌ |
| MP-11 | 16-player rooms per Beta (Coherence `--max-players 16`) | No ADR defines room capacity or player limits. | ❌ |

---

## Summary

| GDD | Total TRs | ✅ Covered | ⚠️ Partial | ❌ Gap | Coverage Rate |
|-----|-----------|-----------|------------|-------|---------------|
| Input System | 15 | 12 | 2 (IN-05, IN-06) | 1 (IN-07) | 80% ✅ |
| Simulation Architecture | 19 | 19 | 0 | 0 | 100% ✅ |
| Settings | 15 | 14 | 1 (ST-08) | 0 | 93% ✅ |
| Content Pipeline | 15 | 10 | 3 (CP-03, CP-04, CP-08) | 0 | 67% ⚠️ |
| Ghost Recording | 12 | 9 | 2 (GR-10, GR-12) | 1 (GR-11) | 75% ⚠️ |
| Multiplayer Architecture | 11 | 0 | 2 (MP-02, MP-05) | 9 (MP-01, MP-03–MP-11) | 0% ❌ |
| **Total** | **87** | **64** | **10** | **13** | **74% ✅⚠️** |

### Key Findings

**Most complete:** Simulation Architecture (100%), Settings (93%) — both have dedicated ADRs that closely track the GDD requirements.

**Gaps requiring ADRs:**
1. **Multiplayer Architecture (9 of 11 TRs are gaps):** No ADR exists for multiplayer. All Beta design decisions (rollback, input packet, relay, disconnection, room size) and even the MVP offline-only constraint lack architectural coverage. This is expected since the GDD explicitly flags these as "Beta design decisions, not MVP requirements" — but the MVP offline-only constraint is a current-phase requirement that should be codified.
2. **Input brake priority (IN-07):** The brake-priority logic is a core gameplay-feel decision that exists only in the GDD. Should be added to ADR-0005 or a follow-up.
3. **Ghost HUD integration (GR-11):** The HUD data contract for ghost time delta, splits, and off-screen indicator is defined in the GDD but not in ADR-0008.

**Partially addressed (need ADR refinement):**
4. **WebGL constraints (CP-08):** ADR-0003 acknowledges WebGL but the specific constraints (768 MB heap, LOD levels, ≤3 MB bundles) are only in the GDD.
5. **Dead-zone normalization formulas (IN-05, IN-06):** ADR-0004/0005 define the profile schema and validation but not the normalization math itself. Acceptable as implementation detail if the schema is considered sufficient.
6. **Loading screen specifics (CP-03, CP-04):** ADR-0003 addresses loading block behavior and progress but not minimum duration, VFX budget, or "Preparing..." flow.
