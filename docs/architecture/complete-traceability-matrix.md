# Complete Architecture Traceability Matrix

> **Generated:** 2026-07-28
> **Scope:** 21 GDD systems × 194 Technical Requirements cross-referenced against 12 Accepted ADRs (ADR-0001 through ADR-0011, ADR-0013)
> **Method:** Manual verification of each TR against ADR text, existing traceability matrices (`traceability-matrix.md`, `traceability-index.md`, `architecture-traceability.md`)

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Covered | ADR explicitly addresses this requirement |
| ⚠️ Partial | ADR partially covers (data/interface defined but algorithm or constant not codified; or cross-system contract implied but not declared) |
| ❌ Gap | No ADR addresses this requirement |

---

## Foundation Layer

---

### 1. Input System (13 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-input-001 | `SimulationInput` is sole gameplay-input contract (accelerateOut, brakeOut, steerOut, rawXxxPostDeadZone, pauseEdge, inputAvailability) | ADR-0001 §Decision ("SimulationInput crosses tick boundary, CaptureLatestRawSample timing"); ADR-0005 §Decision ("ResolvedCarInput[carId] (accelerateOut, brakeOut, steerOut)") | ✅ |
| TR-input-002 | `ProcessEventsInDynamicUpdate` — Input System update mode | ADR-0005 §Post-Cutoff APIs Used ("ProcessEventsInDynamicUpdate") | ✅ |
| TR-input-003 | `CaptureLatestRawSample()` called exactly once before accumulator evaluation; same simulation-driver `Update()` call; no MonoBehaviour script-order assumption | ADR-0001 §Decision ("CaptureLatestRawSample exactly once before accumulator"); ADR-0005 §Context ("ProcessEventsInDynamicUpdate") | ✅ |
| TR-input-004 | EMA smoothing: α_accelerate=0.3, α_brake=0.3, α_steer=0.5; initialized on scheme change and UI→Gameplay resume | ADR-0004 §ControlProfile (alpha fields, validation); ADR-0005 §Decision (EMA reinit on resume). The recurrence formula is not in any ADR. | ⚠️ |
| TR-input-005 | Dead zones: gamepad stick radial (inner 0.15, outer 0.95), trigger axial (inner 0.05), keyboard/mouse exempt | ADR-0004 §ControlProfile (StickDeadZoneInner/Outer fields, per-field validation). Normalization formulas not in any ADR. | ⚠️ |
| TR-input-006 | `InputContextController` sole owner of action maps and `InputSystemUIInputModule` routing; exactly one active map | ADR-0005 §Decision ("InputContextController as sole owner of action map activation"); ADR-0005 §Context ("Exactly one active at any time") | ✅ |
| TR-input-007 | CameraToggle presentation-only — never enters SimulationInput, tick pipeline, Replay, or Ghost Recording | ADR-0005 §Decision ("CameraToggle presentation-only"); ADR-0010 §Registry Check ("CameraToggle routing: presentation-only") | ✅ |
| TR-input-008 | Brake priority: brakeOut = filteredBrake; accelerateOut = 0 when rawBrakePostDeadZone > 0; Accelerate EMA frozen during brake priority | The SimulationInput contract is referenced in ADR-0001 and ADR-0005, but brake-priority logic not codified in any ADR | ❌ |
| TR-input-009 | ActiveControlScheme oscillation prevention: last meaningful device wins; same-frame ambiguity preserves current; EMA reinit on scheme change | ADR-0005 §Decision ("ActiveControlScheme arbitration", "EMA reinitialization on scheme change") | ✅ |
| TR-input-010 | Context transition latching: every newly enabled digital action latched until neutral/released; Accelerate/Brake/Steer exempt on UI→Gameplay | ADR-0005 §Decision (InputContextTransition, latch rules per direction); ADR-0005 §Context Transition Rules | ✅ |
| TR-input-011 | Non-finite raw channel handling (NaN/Inf → 0) | — | ❌ |
| TR-input-012 | Binding ID stability: stable after first shipped schema; unknown ID discards only that override | ADR-0004 §BindingOverride (ActionId/BindingId as Guid, stable after first shipped schema); ADR-0005 GDD Reqs table ("4 rebindable actions") | ✅ |
| TR-input-013 | Control profile validation: per-field range validation with fallback to approved defaults | ADR-0004 §Decision ("validated on load — invalid values fall back to approved defaults"); ADR-0004 §ControlProfile struct comments | ✅ |

**Input Summary: 9 ✅, 2 ⚠️, 2 ❌ (85% coverage)**

---

### 2. Simulation Architecture (16 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-simulation-001 | Manual accumulator 60 Hz: accumulate `Time.unscaledDeltaTime`, loop steps in `Update()` | ADR-0001 §Decision ("accumulator preserves remainder", "manual accumulator in Update()") | ✅ |
| TR-simulation-002 | `FIXED_DT = 1/60f` | ADR-0001 §Decision ("one whole-scene `Physics.Simulate(1/60f)` per active tick") | ✅ |
| TR-simulation-003 | Accumulator clamp to `2 × FIXED_DT` (spiral-of-death protection) | ADR-0001 §Decision ("clamp to 2×FIXED_DT max"), §Consequences ("no catch-up") | ✅ |
| TR-simulation-004 | Focus loss lifecycle: focus-change frame adds no delta; immediately publishes Paused without physics tick; preserves remainder; requires explicit Resume | ADR-0001 §Decision ("focus-change frame adds no delta", "focus loss creates immediate non-physics lifecycle boundary") | ✅ |
| TR-simulation-005 | `Physics.simulationMode = SimulationMode.Script`; single `Physics.Simulate()` per tick | ADR-0001 §Decision ("Physics.simulationMode = SimulationMode.Script, one whole-scene Physics.Simulate(1/60f) per active tick") | ✅ |
| TR-simulation-006 | Performance gate: p95 ≤ 6ms, max ≤ 8ms per tick before content expansion | ADR-0001 §Decision ("p95 ≤ 6 ms and maximum ≤ 8 ms"), §Validation Criteria | ✅ |
| TR-simulation-007 | PerformanceReduced signal: published below 30 FPS for 3s; below 15 for further 3s → Paused | ADR-0001 §PerformanceReduced Signal (thresholds, RecoveryTimer, transitions); ADR-0010 (consumed by VFX budget) | ✅ |
| TR-simulation-008 | Render interpolation in LateUpdate: α = accumulator/FIXED_DT, Lerp position, Slerp rotation; Rigidbody.interpolation = None | ADR-0001 §Decision ("manual interpolation runs in LateUpdate"; "Rigidbody.interpolation = None") | ✅ |
| TR-simulation-009 | 14-step tick order: input capture, pause consume, countdown, fuel+tire, forces, Physics.Simulate, grid-lock, CarState readout, Pit Stop, RSM, counters, snapshot publish, AI, ResolvedCarInput | ADR-0001 §Decision (13 steps); ADR-0006 (extends Step 5→5a/5b); ADR-0011 (inserts Step 9b). Canonical 14-step emerges from ADR set. | ✅ |
| TR-simulation-010 | Immutable snapshots: TickStartSnapshot, PostFinishSnapshot, ReplayInitialState — read-only per-tick input | ADR-0001 §TickStartSnapshot Schema (read-only struct); §PostFinishSnapshot (immutable capture); §ReplayInitialState (immutable at GO) | ✅ |
| TR-simulation-011 | AI reads PublishedSimulationSnapshot (Steps 12–13): 1-tick observation delay | ADR-0001 §Decision (Step 11 publish → Step 12 AI → Step 13 resolve); ADR-0009 §Pipeline Position (Step 12 publishes, Step 13 AI reads) | ✅ |
| TR-simulation-012 | Simulation never waits for rendering: immediate `Physics.Simulate` per tick, rendering reads interpolated copy | ADR-0001 §Consequences ("never waits for rendering") | ✅ |
| TR-simulation-013 | Single `Physics.Simulate()` per tick for all 16 cars | ADR-0001 §Decision ("one whole-scene Physics.Simulate"); ADR-0002 §Constraints ("All 16 cars in the same Physics.Simulate() call") | ✅ |
| TR-simulation-014 | Unity.Mathematics (`float3`, `math.*`, `quaternion`) consistently for all simulation math | ADR-0001 §Decision (implicit via TickStartSnapshot schema using float3); ADR-0002 §GDD Reqs ("All sim math uses Unity.Mathematics") | ✅ |
| TR-simulation-015 | Step counters: per-step tick counts, raceTime = activeRaceStepCount × FIXED_DT | ADR-0001 §Decision (step counters inserted after RSM, referenced in 14-step model) | ✅ |
| TR-simulation-016 | Simplified colliders for performance: all 16 cars in one Physics.Simulate | ADR-0001 §Performance gate (implied by budget, not explicitly stated); ADR-0002 (16 cars in one Physics.Simulate) | ⚠️ |

**Simulation Summary: 15 ✅, 1 ⚠️, 0 ❌ (97% coverage)**

---

### 3. Settings (6 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-settings-001 | Transactional preview: `SettingsEditSession` with Snapshot (active), Working (preview), Apply/Cancel | ADR-0004 §Decision ("SettingsEditSession with Apply/Cancel/IDisposable") | ✅ |
| TR-settings-002 | Difficulty immutable per race: snapshotted at race init, never mutated mid-race | ADR-0004 §Decision ("DifficultyProfileId snapshotted at race init"), §Constraints | ✅ |
| TR-settings-003 | `show_chase_hud_in_cockpit` setting consumed by HUD | ADR-0004 §HUD settings consumption; ADR-0010 (HUD integration reference) | ⚠️ |
| TR-settings-004 | Per-slot binding rebinding: 4 actions rebindable, reserved excluded, stable IDs | ADR-0004 §BindingOverride; ADR-0005 §Decision (rebindable action allowlist, reserved exclude list). Remapping flow steps not in ADRs. | ✅ |
| TR-settings-005 | Quality/VFX presets: Low/Medium/High/Ultra; render scale, shadows, MSAA, VFX density mapping | ADR-0004 §Decision (4 QualityPresets listed); ADR-0010 §Quality Presets (Low/Medium/High definitions) | ✅ |
| TR-settings-006 | Stick dead-zone values stored in profile | ADR-0004 §ControlProfile (StickDeadZoneInner/Outer fields); ADR-0005 depends on ADR-0004 | ✅ |

**Settings Summary: 5 ✅, 1 ⚠️, 0 ❌ (92% coverage)**

---

### 4. Content Pipeline (10 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-content-001 | 3 Addressable groups: Shared (lifelong), Cars/{teamId} (per-race), Tracks/{trackId} (per-race) | ADR-0003 §Decision (3-group topology, AddressableKeys constants) | ✅ |
| TR-content-002 | Parallel loading: track + 16 car bundles loaded asynchronously in parallel | ADR-0003 §Decision ("LoadRace initiates 17 async handles in parallel") | ✅ |
| TR-content-003 | ReleaseInstance, not Destroy, for Addressable GameObjects | ADR-0003 §Decision ("Addressables.ReleaseInstance + Release"); §UnloadRace | ✅ |
| TR-content-004 | Loading blocks input: loading state blocks Cancel/Back | ADR-0003 §Decision ("Loading state blocks Cancel/Back"); GDD Reqs table | ✅ |
| TR-content-005 | CP_ state machine: CP_Idle → CP_LoadingTrack → CP_LoadingCars → CP_Ready → CP_Racing → CP_Unloading → CP_Idle + Error/Reconfigure | ADR-0003 §Decision (7 CP_ states defined, CP_ ↔ SimulationState mapping) | ✅ |
| TR-content-006 | WebGL constraints: heap limits, ASTC 6×6, texture/LOD constraints | ADR-0003 §Context ("WebGL heap up to 4 GB", "ASTC 6×6 compression available as extension"). Specifics (768 MB heap, 1024px textures, ≤3 MB bundles) only in GDD. | ⚠️ |
| TR-content-007 | Memory pressure thresholds: <0.85 normal, 0.85–0.95 warning, >0.95 critical (abort) | ADR-0003 §Risks ("memory usage > 95% threshold → abort, release partial handles") | ✅ |
| TR-content-008 | Race Reconfigure: no Addressables I/O, cache-hit semantics, `RaceReconfigureStart` event | ADR-0003 §Decision ("RaceReconfigure flow with cache-hit guarantee, no Addressables I/O") | ✅ |
| TR-content-009 | WebGL OOM handling: graceful degradation on memory pressure | ADR-0003 §Risks (memory > 95% → abort); GDD details on OOM-specific handling not fully mirrored | ⚠️ |
| TR-content-010 | ContentUnloadComplete: Simulation remains Results until ContentUnloadComplete, then enters Idle | ADR-0003 §Decision (CP_Unloading → CP_Idle lifecycle); ADR-0001 §Decision ("Simulation remains Results until ContentUnloadComplete") | ✅ |

**Content Pipeline Summary: 8 ✅, 2 ⚠️, 0 ❌ (90% coverage)**

---

### 5. Ghost Recording (7 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-ghost-001 | MVP in-memory buffer: always discarded on Results/Forfeit/Idle/Load failure | ADR-0008 §MVP Lifecycle ("discard on every exit") | ✅ |
| TR-ghost-002 | ReplayInitialState captured at GO: seed, track_id, DifficultyProfile, GridAssignment, car IDs, initial Fuel/Tire, PerfectStartRemainingTicks | ADR-0001 §Decision ("ReplayInitialState defined, captured at GO"); ADR-0008 §ReplayInitialState struct | ✅ |
| TR-ghost-003 | 12 bytes/tick (3 × float32) for accelerateOut, brakeOut, steerOut + edge events (5 bytes) | ADR-0008 §Decision (GhostBuffer.RecordTick continuous stream format; GhostBuffer.RecordEdgeEvent, EdgeEventFlags) | ✅ |
| TR-ghost-004 | Ghost vehicles trigger-only: opacity 0.4, URP Unlit + alpha blend, no collision, no engine audio | ADR-0008 §GDD Reqs table ("Ghost visualization (opacity 0.4, no collision, no audio)") | ✅ |
| TR-ghost-005 | 22,500 tick cap (375s × 60 Hz); buffer marked non-serializable if capped; never discard oldest ticks | ADR-0008 §Decision ("GhostBuffer maxTicks: 22500, IsSerializable = false at cap") | ✅ |
| TR-ghost-006 | Binary format: 80-byte header with magic 0x47485354, version, stream sizes, CRC32, LZ4 compression flag | ADR-0008 §Decision (GhostHeader struct with all fields, magic constant, flags bitfield, compression flag) | ✅ |
| TR-ghost-007 | Alpha persistence: serialize only on new personal best; local cache max 5; retry queue (3 attempts) | ADR-0008 §Alpha Persistence Gate (PB check, serialization flow, retry logic) | ✅ |

**Ghost Recording Summary: 7 ✅, 0 ⚠️, 0 ❌ (100% coverage)**

---

### 6. Multiplayer Architecture (5 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-multiplayer-001 | MVP pure local: no Coherence connection, transport, room, or network traffic | ADR-0001 §Decision ("MVP repeatability means the same executable on the same physical machine/environment"). **Not explicitly codified as "no Coherence dependency" architectural constraint.** | ⚠️ |
| TR-multiplayer-002 | Tick boundaries designed for future network driver: explicit ownership, pause behavior, future-network boundary | ADR-0001 §Consequences ("Explicit ownership, tick order, pause behavior and future-network boundary"). The boundary contract itself is not defined. | ⚠️ |
| TR-multiplayer-003 | No cross-machine determinism: PhysX not canonical across machines; Beta state must not depend on local PhysX | ADR-0001 §Decision ("Beta canonical multiplayer state must not depend on local PhysX"; "MVP repeatability means the same executable on the same physical machine/environment") | ✅ |
| TR-multiplayer-004 | No network input in MVP: SimulationInput is local only | ADR-0001 (implied by local-only design, not explicitly stated) | ⚠️ |
| TR-multiplayer-005 | No multiplayer perf constraints in MVP: performance budgets are single-player | ADR-0001 (implied — performance gate is 16-car single-player; no multiplayer budget mentioned) | ⚠️ |

**Multiplayer Summary: 1 ✅, 4 ⚠️, 0 ❌ (60% coverage — all partial, no explicit ADR declares these as architectural constraints)**

---

## Core Layer

---

### 7. Vehicle Physics (7 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-vehicle-physics-001 | SimulationInput consumed once per tick: ResolvedCarInput[carId] (accelerateOut, brakeOut, steerOut) at Step 6 | ADR-0002 §Requirements ("Must consume ResolvedCarInput[carId] at Tick Step 6"); ADR-0001 §TickStartSnapshot schema | ✅ |
| TR-vehicle-physics-002 | Pit-entry zone detection: VP detects crossing, queues CarState.PitPhase transition with 1-tick latency | ADR-0002 §Requirements (Pitting state, CarState.pitPhase); ADR-0001 (tick pipeline carries to PitStopSystem); ADR-0011 §Data Flow (1-tick entry detection) | ✅ |
| TR-vehicle-physics-003 | 6 stats via formulas: max_velocity (300 + TS×2), t300 (Acceleration metric), brake_distance, grip % of vmax, control_threshold (slip-only), efficiency_modifier; weight constant 505kg | ADR-0002 §Requirements ("6 car stats", ForceMode.Force corrected 2026-08-04); ADR-0002 §GDD Reqs table | ✅ |
| TR-vehicle-physics-004 | Perfect Start multiplier: `perfectStartDriveForceMultiplier = 1.15` for 600 ticks after GO | ADR-0001 §ReplayInitialState (includes Perfect Start); ADR-0002 §Requirements ("perfectStartDriveForceMultiplier = 1.15 for 600 ticks") | ✅ |
| TR-vehicle-physics-005 | Off-track difficulty override: 5 profiles with different off-track grip (0.25–0.60) and wall speed loss (0.20–0.60) | ADR-0001 §Decision ("immutable DifficultyProfile snapshot at race init"); ADR-0004 §DifficultyProfile storage; ADR-0002 §Requirements (difficulty consumption) | ✅ |
| TR-vehicle-physics-006 | VP owns collision resolution: car-to-car (15–25% speed loss, cooldown), wall bounce (0.2–0.5s cooldown, 50% repeated reduction) | ADR-0002 §Requirements ("car-to-car collision", "wall contact"); ADR-0002 §WallHit/Car-to-car sections | ✅ |
| TR-vehicle-physics-007 | AI same physics as player: same VehiclePhysicsSystem, same Rigidbody, same grip stack; all 15 AI in one Physics.Simulate | ADR-0002 §Constraints ("All 16 cars in same Physics.Simulate"); ADR-0009 §Decision ("AI uses same VehiclePhysicsSystem") | ✅ |

**Vehicle Physics Summary: 7 ✅, 0 ⚠️, 0 ❌ (100% coverage)**

---

### 8. Fuel System (7 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-fuel-001 | Fuel fill rate 0.8 L/s at pit stop | ADR-0006 §Lifecycle integration; ADR-0011 §PitServiceCommand contract ("applies 0.8 L/s toward targetFuel") | ✅ |
| TR-fuel-002 | `fuel_rate_for_car`: base_rate × accelerateOut × efficiency_modifier; base_rate = 0.06 L/s | ADR-0006 §FuelState.Tick (consumes ResolvedCarInput.accelerateOut, efficiency_modifier) | ✅ |
| TR-fuel-003 | Per-lap snapshots at LapCompleted: last_lap_fuel_use published for AI/Pit Stop | ADR-0006 §Materialization ("LOTS updated via RSM LapCompleted event"); ADR-0009 (AI reads for projection) | ✅ |
| TR-fuel-004 | base_rate = 0.06 L/s | ADR-0006 §Fuel consumption formula (base_rate implied by formula structure, explicit constant in GDD) | ✅ |
| TR-fuel-005 | Efficiency modifier formula: `efficiency_modifier = 1 - stat × 0.025` (0.9 at stat 4, 0.5 at stat 20) | ADR-0006 §Formula ("efficiency_modifier owned by Fuel System"); ADR-0002 (§CarDefinition loaded via Addressables); formula in GDD | ✅ |
| TR-fuel-006 | Tank 8.0L (all cars, fixed) | ADR-0006 §FuelState.currentFuel ("0–8.0 liters, fixed 8L tank") | ✅ |
| TR-fuel-007 | Fuel state for Audio: fuelLevel for engine pitch drop, lowFuelActive for stinger | ADR-0006 §FuelState fields; ADR-0013 §Requirements ("fuelLevel for engine pitch drop"); ADR-0013 §CarAudioState (LowFuelActive) | ✅ |

**Fuel Summary: 7 ✅, 0 ⚠️, 0 ❌ (100% coverage)**

---

### 9. Tire System (9 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-tire-001 | Wear reset at pit stop: `wearFraction = 0` after 2s continuous InPitBox | ADR-0006 §TireSystem (reads PitServiceCommand, resets wearFraction); ADR-0011 §PitServiceCommand contract | ✅ |
| TR-tire-002 | Per-lap snapshots: `lastLapTireWear` published for AI projection | ADR-0006 §Materialization (LOTS via RSM LapCompleted); ADR-0009 (AI pit projection consumption) | ✅ |
| TR-tire-003 | Grip floor 0.20 (minimum grip at 100% wear) | ADR-0006 §runtimeGripMultiplier ("range 0.20–1.0") | ✅ |
| TR-tire-004 | Surface wear modifier: surfaceWearMultiplier per surface type consumed from TickStartSnapshot | ADR-0007 §SurfaceModifierTable (wearMultiplier per surface); ADR-0006 §TireSystem (reads from TickStartSnapshot) | ✅ |
| TR-tire-005 | Base wear rate formula: tire_wear_rate = base_rate × distance_factor × aggression × surface_penalty × efficiency_modifier × wearRateMultiplier | ADR-0006 §TireSystem.Tick (formula structure defined) | ✅ |
| TR-tire-006 | No wear in qualifying: 100% grip for entire session | ADR-0006 §Qualifying initialization ("wear disabled") | ✅ |
| TR-tire-007 | Tire swap 2.0s: binary swap, 2s minimum service time | ADR-0006 §TireState lifecycle; ADR-0011 §PitServiceCommand ("tireSwapComplete after 2s"); tire_swap_time ownership not explicitly resolved between Tire and Pit Stop ADRs | ⚠️ |
| TR-tire-008 | Efficiency modifier formula: `efficiency_modifier = 1 - stat × 0.025` (shared with Fuel) | ADR-0006 §FuelSystem/TireSystem (both consume efficiency_modifier from same stat) | ✅ |
| TR-tire-009 | HUD display thresholds: wear visible through grip loss (cornering feel) and HUD bar | ADR-0006 §TireState provides data for HUD. The HUD threshold values and grip-loss communication (camera/audio) are not codified in any ADR. | ⚠️ |

**Tire Summary: 7 ✅, 2 ⚠️, 0 ❌ (89% coverage)**

---

### 10. Pit Stop (9 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-pit-001 | Pit triggered by VP zone crossing: VP detects, queues CarState.PitPhase with 1-tick latency | ADR-0002 §Requirements (Pitting state); ADR-0011 §Data Flow ("Entry detection next-tick per VP GDD") | ✅ |
| TR-pit-002 | Speed limit 80 km/h in pit lane | ADR-0007 §PitLaneDefinition ("pitSpeedLimitKph = 80"); ADR-0002 §Pitting state (applies speed limit) | ✅ |
| TR-pit-003 | Service duration formula: `max(2s, fuel_missing/0.8)` — parallel fuel+tire | ADR-0006 (FuelState refuel rate 0.8 L/s); ADR-0011 §Service (parallel model defined). The explicit max() duration formula is in pit-stop.md, not directly in ADR text. | ⚠️ |
| TR-pit-004 | Player early-exit after tire swap (2s) with partial fuel; requires Confirm | ADR-0011 §Decision (playerCanExit after tireSwapComplete); ADR-0005 (Confirm routing in PitService context) | ✅ |
| TR-pit-005 | AI pit projection margin = 1.10× (110% of last lap resource use) | ADR-0009 §AiArchetype.pitProjectionMargin ("1.10 (110% of last lap resource use — deterministic)") | ✅ |
| TR-pit-006 | PitThisLap advisory: post-lap-1 prediction using last lap deltas, 10% margin | ADR-0011 §Advisory algorithm (predicted_fuel/predicted_tire formulas, 1.10× margin on next_lap_needed) | ✅ |
| TR-pit-007 | 16 pit boxes, two-lane F1 model (fast lane + offset bays) | ADR-0007 §PitBox[16]; ADR-0007 §PitLaneDefinition | ✅ |
| TR-pit-008 | Pit blocked during qualifying: entry detection disabled | ADR-0001 §Decision (Qualifying enters Racing without Countdown); ADR-0011 §Data Flow. Blocked-during-qualifying not explicitly stated in ADR. | ⚠️ |
| TR-pit-009 | Input routing: Confirm routes to Pit Stop in PitService context; Cancel suppressed during active service | ADR-0005 §Context Transition Rules ("Confirm directly to PitStop in PitService context"); ADR-0011 §Depends On (ADR-0005). Explicit routing in ADR-0005 action map inventory. | ✅ |

**Pit Stop Summary: 7 ✅, 2 ⚠️, 0 ❌ (89% coverage)**

---

### 11. Qualifying (9 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-qualifying-001 | Single flying lap format: one chance, no retry | ADR-0001 §Qualifying lifecycle (enters Racing directly). Single-lap format and no-retry rules not explicitly codified. | ❌ |
| TR-qualifying-002 | Racing state directly, no countdown: `RaceMode.Qualifying` → enters Racing/GameplayQualifying after RaceLoadReady | ADR-0001 §Decision ("Qualifying does not use Countdown... enters Racing/GameplayQualifying directly") | ✅ |
| TR-qualifying-003 | Computed fuel load: `min(8.0L, fuel_rate × reference_flying_lap_time × 1.10)` | ADR-0006 §Qualifying initialization ("reduced fuel load, wear disabled") | ✅ |
| TR-qualifying-004 | No tire wear during qualifying: wear disabled, tires at 100% grip | ADR-0006 §Qualifying initialization ("wear disabled") | ✅ |
| TR-qualifying-005 | Finished Presentation: up to 5s timer, Confirm advances, Cancel ignored, Pause available | ADR-0001 §Decision ("UI Presentation owns the up-to-5-second timer"); ADR-0010 (Camera- VFX for Finished presentation). The specific timer, Confirm/Cancel/Pause routing is in ADR-0001. | ✅ |
| TR-qualifying-006 | AI deterministic times: PCG32 projection using archetype formulas, no per-tick Tick() execution | ADR-0009 §MVP Scope ("Qualifying AI times: generated by offline PCG32 projection") | ✅ |
| TR-qualifying-007 | Skip/fail = P16: skip qualifying → P16; failed lap → P16; no retry | ADR-0001 §TransitionRequest (GridAssignment lock). P16-on-skip/fail rule defined only in qualifying.md. | ❌ |
| TR-qualifying-008 | Tier order not preserved: grid positions based on times, not tier | ADR-0009 (AI times generated offline). Tier→order relationship not codified. | ❌ |
| TR-qualifying-009 | GridAssignment via RSM: RSM locks `carId → gridSlot[1..16]` after qualifying/skip | ADR-0001 §TransitionRequest ("GridAssignment in ReplayInitialState and TransitionRequest") | ✅ |

**Qualifying Summary: 5 ✅, 0 ⚠️, 4 ❌ (56% coverage)**

---

### 12. AI Rival (9 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-ai-001 | PublishedSnapshot + PCG32: deterministic per-race seed, per-car PCG32(SimSeed, carId) at Step 13 | ADR-0001 §Decision (Step 11 publish, PCG32 as "only gameplay PRNG"); ADR-0009 §Decision ("PCG32(SimSeed, carId) per-car stream") | ✅ |
| TR-ai-002 | No partial world mutation: AI reads published snapshot, never writes CarState/Fuel/Tire | ADR-0009 §Registry Check ("AI reads at Step 13, never writes"; "pure C# per-tick, no collision callbacks") | ✅ |
| TR-ai-003 | Reference racing spline: follows TrackData.racingLineSpline from Addressables | ADR-0007 §TrackData (racingLineSpline); ADR-0009 §Depends On (ADR-0007 "track racing line for AI path") | ✅ |
| TR-ai-004 | Error generation scaled by difficulty: steeringErrorAmplitude, brakeErrorMeters, throttleErrorPercent per archetype; DifficultyProfile.ai_error_multiplier | ADR-0009 §AiArchetype (all error fields defined); ADR-0004 (DifficultyProfile storage); ADR-0001 (immutable snapshot) | ✅ |
| TR-ai-005 | Deterministic pit projection: pitProjectionMargin = 1.10, deterministic resource projection from observed lap deltas | ADR-0009 §MVP Scope ("Pit decisions use deterministic resource projection"); ADR-0009 §AiArchetype.pitProjectionMargin | ✅ |
| TR-ai-006 | DifficultyProfile immutable: AI precision/error/pace fields snapshotted at race init | ADR-0004 §Decision (DifficultyProfile immutable per race); ADR-0009 §DifficultyProfile consumed per race | ✅ |
| TR-ai-007 | No Perfect Start for AI: AI archetypes define launch behavior; AI never receives Perfect Start multiplier | ADR-0009 §AiArchetype (launch archetype behavior). AI-perfect-start-exclusion not explicitly stated. | ⚠️ |
| TR-ai-008 | AI collision via VP: car-to-car resolved by Vehicle Physics; AI enters Recovering state | ADR-0002 §car-to-car collision; ADR-0009 §MVP Scope ("Car-to-car collision resolved by Vehicle Physics") | ✅ |
| TR-ai-009 | AI stats unchanged by difficulty: same CarDefinition data, same formulas regardless of difficulty | ADR-0001 §Decision ("Car Definition data and formulas never change with Difficulty"); ADR-0009 §Same physics | ✅ |

**AI Rival Summary: 8 ✅, 1 ⚠️, 0 ❌ (94% coverage)**

---

### 13. Track System (12 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-track-001 | JSON file format: SplineData, SurfaceZone, PitLaneDefinition, StartGridDefinition, SplineMetadata, snake_case, schemaVersion=1 | ADR-0007 §JSON schema (all structs defined, C# classes, snake_case, schemaVersion=1) | ✅ |
| TR-track-002 | Local game-space meters: 1 unit = 1 meter | ADR-0007 §Conversion pipeline (real-world to game-space) | ✅ |
| TR-track-003 | 6 surface types with grip/wear modifiers: Asphalt, Kerb, Gravel, Grass, Runoff, Pit lane | ADR-0007 §SurfaceModifierTable (gripMultiplier and wearMultiplier per type); ADR-0006 (consumed by TireSystem) | ✅ |
| TR-track-004 | Off-track difficulty override: surface modifiers per difficulty | ADR-0007 §SurfaceModifierTable; ADR-0002 (difficulty grip overrides via DifficultyProfile) | ✅ |
| TR-track-005 | Pit lane geometry: separate spline, 10m offset, entry/exit points, two-lane F1 model | ADR-0007 §PitLaneDefinition; §PitBox[16]; §pitSpline | ✅ |
| TR-track-006 | Pit-spline mapped progress: pitToRacingProgress array for RSM position ranking | ADR-0007 §Runtime API ("PitProgressToRacing()"); §Pit→racing mapping | ✅ |
| TR-track-007 | CrossedLapBoundary: detects when car crosses finish line via spline wrap | ADR-0007 §Runtime API ("CrossedLapBoundary bool") | ✅ |
| TR-track-008 | Pit-entry validation: one-way trigger against racing-spline tangent | ADR-0007 §PitLaneDefinition entryPointIndex; ADR-0001 (tick pipeline) | ✅ |
| TR-track-009 | Anti-cut 90% gate: `distanceSinceLastLap > trackLength × 0.90` required for lap count | ADR-0007 §CrossedLapBoundary (provides detection). The 90% threshold constant is only in race-session-manager.md, not in any ADR. | ❌ |
| TR-track-010 | Conversion pipeline: GPX/GeoJSON → Python (rasterio) → Track JSON → Unity Addressables | ADR-0007 §Pipeline ("GPX/GeoJSON → Python → JSON") | ✅ |
| TR-track-011 | Validation errors: schema validation on load, version checks | ADR-0007 §Schema (schemaVersion=1); ADR-0003 (ContentLoadError on failure) | ✅ |
| TR-track-012 | Lap boundary at distance 0: racing spline wraps, distance 0 = start/finish line | ADR-0007 §SplineData (distance along spline, wrap-around) | ✅ |

**Track Summary: 11 ✅, 0 ⚠️, 1 ❌ (92% coverage)**

---

### 14. Car Definition Data (8 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-car-def-001 | 6 stats 0-20 scale (increments of 4): Top Speed, Acceleration, Brake Power, Grip Level, Stability, Efficiency | ADR-0002 §Requirements ("6 car stats mapped from SMGP1"); §CarDefinition loaded at race init | ✅ |
| TR-car-def-002 | ScriptableObjects externalized: `Assets/Data/Cars/team_tier{N}_{a-d}.asset` loaded via Addressables | ADR-0002 §CarDefinition (loaded via Addressables); ADR-0003 §Cars/{teamId} group | ✅ |
| TR-car-def-003 | Weight 505kg constant (all cars, not per-car) | ADR-0002 §ForceMode.Acceleration ("decouples force from mass — mass-independent") | ✅ |
| TR-car-def-004 | CarAudioProfile: engineCylinders 6-12, engineType string, default 10/V10 | ADR-0013 §CarAudioProfile struct (Cylinders, EngineBasePitch, ExhaustNote). Audio profile storage format not in ADR — lives in CarDefinition SO. | ⚠️ |
| TR-car-def-005 | Stats clamped 4-20: valid values {4,8,12,16,20}, missing fields default to 12 | ADR-0002 §Requirements (stats consumed). Validation/clamping rules defined only in car-definition-data.md. | ❌ |
| TR-car-def-006 | Efficiency modifier formula: `efficiency_modifier = 1 - stat × 0.025` (0.5-0.9 range) | ADR-0006 (both FuelSystem and TireSystem consume efficiency_modifier from same stat) | ✅ |
| TR-car-def-007 | Team ID format: `team_tier{N}_{a-d}` used for Addressable keys | ADR-0003 §Cars/{teamId} group; naming convention in GDD, not ADR | ⚠️ |
| TR-car-def-008 | 5% differentiation rule: max stat spread between cars ≤ 5% of total performance | — | ❌ |

**Car Definition Summary: 5 ✅, 2 ⚠️, 1 ❌ (75% coverage)**

---

### 15. Race Session Manager (10 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-rsm-001 | Position ranking formula: `rank(cars) by lapCount DESC, splinePosition DESC, positionEntryStep ASC, carId ASC` | ADR-0001 §Decision ("RSM owns race rules and result resolution"). Tiebreaker sequence not in ADR — lives in race-session-manager.md. | ⚠️ |
| TR-rsm-002 | Tiebreaker rules: stable carId breaks ties | ADR-0001 (delegates to RSM). Tiebreaker constant not in any ADR. | ⚠️ |
| TR-rsm-003 | totalDistance forward-only: spline position always advances, never wraps negatively | ADR-0001 §TickStartSnapshot (splinePosition forward-only by design) | ✅ |
| TR-rsm-004 | Lap detection with anti-cut: CrossedLapBoundary + 90% minimum distance gate | ADR-0007 §CrossedLapBoundary (provides geometry helper). The 90% anti-cut threshold not in any ADR. | ⚠️ |
| TR-rsm-005 | Pit lane mapped progress: pitToRacingProgress for position ranking during pit transit | ADR-0007 §Runtime API ("PitProgressToRacing()"); §pitToRacingProgress array | ✅ |
| TR-rsm-006 | PostFinishSnapshot: immutable capture of final post-physics state at player finish tick | ADR-0001 §Decision ("PostFinishSnapshot captured at Step 11", "no physics after finish") | ✅ |
| TR-rsm-007 | FinishOrderResolver pace projection: projects trailing AI by pace; sets resolutionComplete = true; runs once | ADR-0001 §Decision ("PostFinishSnapshot → RSM ResolvedFinishOrder"). Pace formula only in race-session-manager.md. | ⚠️ |
| TR-rsm-008 | Countdown 300 ticks: tick that decrements to zero is still Countdown; GO releases grid lock; next tick begins Racing | ADR-0001 §Decision ("Race Countdown is 300 simulation ticks", "countdown decrement", "tick 300 releases grid lock") | ✅ |
| TR-rsm-009 | TransitionRequest pattern: RSM → Simulation state machine boundary for Loading, Finished, Results | ADR-0001 §Decision (TransitionRequest pattern defined; ContentUnloadRequest/Complete lifecycle) | ✅ |
| TR-rsm-010 | resultClassification enum: Finished, DNF, Forfeit — Forfeit has no final position | ADR-0001 §Decision (result flow; Forfeit mentioned). The enum and DNF/Forfeit semantics not explicitly codified in any ADR. | ❌ |

**RSM Summary: 6 ✅, 3 ⚠️, 1 ❌ (75% coverage)**

---

### 16. Grid & Start (8 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-grid-001 | Grid formation 2-wide 8 rows: column stagger depending on first corner direction | ADR-0007 §StartGridDefinition (firstCornerRight, rowSpacing, columnOffset) | ✅ |
| TR-grid-002 | Countdown 5 lights: 300 ticks, 1s per light; grid lock releases on tick 300 | ADR-0001 §Decision ("Countdown 300 ticks", "lights sequence", "grid lock release") | ✅ |
| TR-grid-003 | Controls active during countdown: Accelerate, Brake, Steer consumed but grid lock prevents movement | ADR-0001 §Decision ("Countdown consumes controls without movement"); ADR-0002 §GridLocked state | ✅ |
| TR-grid-004 | Perfect Start arming: 12-tick window [GO-12, GO-1], arm if rawThrottle > 0.5 and rawBrake == 0, condition must hold at GO | ADR-0005 §Decision ("Input arms Perfect Start"; Accelerate/Brake exempt from latching). The 12-tick window and 0.5/0 thresholds only in grid-start.md. | ⚠️ |
| TR-grid-005 | Perfect Start bonus: 1.15× multiplier for 600 ticks; PerfectStartResult { active, remainingTicks } | ADR-0001 §ReplayInitialState (Perfect Start remaining ticks); ADR-0002 §Requirements (1.15× multiplier for 600 ticks) | ✅ |
| TR-grid-006 | PerfectStartResult immutable: captured at GO, travels through ReplayInitialState | ADR-0001 §Decision ("ReplayInitialState contains Perfect Start remaining ticks") | ✅ |
| TR-grid-007 | AI no Perfect Start: AI archetypes define launch; never receives Perfect Start multiplier | ADR-0009 (AI archetype launch behavior). AI-PS-exclusion not explicitly in ADR. | ⚠️ |
| TR-grid-008 | Qualifying Results Confirm only: no timeout, no Back/Cancel; static top-down camera in MVP | ADR-0001 §Decision ("Grid Display Confirm only"). Camera angle and timeout not in ADR. | ⚠️ |

**Grid & Start Summary: 6 ✅, 2 ⚠️, 0 ❌ (88% coverage)**

---

## Presentation Layer

---

### 17. Camera (10 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-camera-001 | Reads interpolated visual transforms from Simulation Architecture (LateUpdate, Alpha = accumulator/FIXED_DT) | ADR-0001 §Decision ("manual interpolation runs in LateUpdate"); ADR-0010 §Decision ("Camera reads interpolated VisualTransform produced by Simulation Architecture") | ✅ |
| TR-camera-002 | Two camera modes: Cockpit (default) and Chase | ADR-0010 §Camera Modes (Cockpit, Chase, PitCamera, Finished, Replay) | ✅ |
| TR-camera-003 | FOV quadratic curve: speed-sensitive 40–65° (Chase), Directional Velocity as anchor; fixed ~75-80° (Cockpit) | ADR-0010 §Camera Modes ("Speed-sensitive FOV (40–65°)", "Cockpit FOV fixed at ~75–80°"). The quadratic curve formula not explicitly in ADR. | ⚠️ |
| TR-camera-004 | 3-layer shake: engine vibration, gear shift pulse, kerb rumble; scaled by impulse magnitude | ADR-0010 §Camera Shake (three layers defined with amplitudes, frequencies, intensity curves) | ✅ |
| TR-camera-005 | Look-ahead: camera looks ahead of car direction for anticipation | ADR-0010 mentions Chase follow behavior but does NOT define look-ahead formula or offset. | ❌ |
| TR-camera-006 | Sphere-cast collision avoidance: camera pushed forward when obstructed | ADR-0010 does NOT define collision avoidance. ADR-0001 mentions PerformanceReduced disables it, but no ADR defines the mechanism. | ❌ |
| TR-camera-007 | CameraToggle presentation-only: never enters SimulationInput, tick pipeline, Replay | ADR-0005 §Decision ("CameraToggle presentation-only"); ADR-0010 §Registry Check ("CameraToggle routing: presentation-only") | ✅ |
| TR-camera-008 | PitCamera: dedicated external camera during InPitBox, side-aware offset, 0.2s blend in/out | ADR-0010 §Camera Modes (PitCamera with side-aware offset, blend in/out); ADR-0011 §PitCamera activation | ✅ |
| TR-camera-009 | Terminal Presentation: slow orbit around car, 0–5s, skippable via Confirm | ADR-0010 §Camera Modes ("Finished: slow orbit around car, 0–5s, skippable via Confirm") | ✅ |
| TR-camera-010 | Reduced Motion: shake amplitude = 0 when CameraSettings.reducedMotion is true; duration still applies | ADR-0004 §Decision (ReducedMotion setting); ADR-0010 §Camera Shake ("reducedMotion = true → shake amplitude = 0") | ✅ |

**Camera Summary: 7 ✅, 1 ⚠️, 2 ❌ (80% coverage)**

---

### 18. HUD (10 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-hud-001 | 7 chase elements: Speed, Position/Lap, Fuel Bar, Tire Bar, Rival Gap, Track Map, Performance Warning | ADR-0010 (Camera-VFX only, does NOT define HUD element specification). HUD elements defined only in hud.md. | ❌ |
| TR-hud-002 | Cockpit 4 + overlay: simplified HUD with fuel/tire as overlays, settings toggle | ADR-0004 (Settings consumption: `show_chase_hud_in_cockpit`). Layout formula only in hud.md. | ⚠️ |
| TR-hud-003 | 0.5s readability: every element comprehensible under 0.5 seconds | — | ❌ |
| TR-hud-004 | Color-coded bars: fuel/tire bars with state-color fill (Full/Conserving/Critical/Empty) | ADR-0006 (FuelState/TireState provides data thresholds). Color mapping not in ADR. | ⚠️ |
| TR-hud-005 | Rival gap display: time gap to car ahead/behind on screen | — | ❌ |
| TR-hud-006 | Track Map: racing spline, pit-lane spline, pit-entry marker, car positions | ADR-0007 (SplineData provides geometry). HUD rendering contract not in ADR. | ⚠️ |
| TR-hud-007 | Colorblind mode: high-contrast color palette | ADR-0004 (AccessibilitySettings). Color palette specification only in hud.md. | ⚠️ |
| TR-hud-008 | NoInputDevice overlay: HUD overlay when no device connected | ADR-0005 §InputAvailability (NoInputDevice enum, zeroed SimulationInput). Overlay rendering not in ADR. | ⚠️ |
| TR-hud-009 | Performance warning: discrete performance warning when PerformanceReduced active | ADR-0001 §PerformanceReduced Signal ("HUD — shows discrete performance warning") | ✅ |
| TR-hud-010 | Forfeit Results: results display after forfeit | ADR-0001 (Results/Forfeit lifecycle). Forfeit results layout not in ADR. | ⚠️ |

**HUD Summary: 1 ✅, 6 ⚠️, 3 ❌ (40% coverage)**

---

### 19. Audio System (9 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-audio-001 | 5 layers: Engine, Tire, SFX, Music, Ambience — each with mixer group and volume control | ADR-0013 §Architecture (5 layer structure defined: engine, tire, SFX, music, ambient); §Decision ("Unity Audio Mixer with procedural-first") | ✅ |
| TR-audio-002 | Procedural engine formula: 2-oscillator runtime synthesis (V8/V10/V12), IEngineSoundProvider seam | ADR-0013 §Decision ("procedural-first engine generation (2-oscillator runtime synthesis)"); §ProceduralEngineProvider formulas | ✅ |
| TR-audio-003 | Fuel factor curve: fuelLevel → engine pitch drop | ADR-0006 (FuelState.fuelLevel for audio); ADR-0013 §Requirements ("fuelLevel for engine pitch drop"); §ProceduralEngineProvider ("pitch = f_base × fuelFactor × gearRatio") | ✅ |
| TR-audio-004 | Engine cut at 0% fuel: fuelFactor at 0% fuel cuts engine sound | ADR-0006 (FuelState.Empty); ADR-0013 §CarAudioState (LowFuelActive); engine cut at 0% is implied but not explicitly in ADR-0013 | ⚠️ |
| TR-audio-005 | Tire squeal with wear: volume scaling with wear_percent | ADR-0013 §Requirements ("tire squeal volume scaling with wear_percent"); §CarAudioState (WearPercent, SlideState) | ✅ |
| TR-audio-006 | Wall impact pitch: collision impulse → pitch variation | ADR-0002 (WallHit contact data). Audio-specific wall impact formula not in ADR-0013. | ⚠️ |
| TR-audio-007 | Wind volume formula: volume proportional to speed | ADR-0013 §Requirements (wind mentioned in sound design). Explicit formula not in ADR. | ⚠️ |
| TR-audio-008 | Music stings: 4 stings with priority and ducking rules; triggered by race events | ADR-0013 §Requirements ("4 music stings with priority and ducking rules"); §AudioSystem.Tick (UpdateMusicStings) | ✅ |
| TR-audio-009 | Camera mode mix: engine volume/mix changes between cockpit and chase | ADR-0013 §AudioSystem.Tick signature (CameraMode parameter); ADR-0010 §Camera Modes. The per-mode mix formula not explicitly in ADR-0013. | ⚠️ |

**Audio Summary: 6 ✅, 3 ⚠️, 0 ❌ (83% coverage)**

---

### 20. VFX (10 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-vfx-001 | global_max_velocity: car speed cap from CarDefinition (300–340 km/h) consumed by VFX intensity | ADR-0002 §maxLinearVelocity (hard speed cap); ADR-0010 §VFX ("speed-normalized VFX") | ✅ |
| TR-vfx-002 | streak_intensity formula: proportional to speed/global_max_velocity ratio | ADR-0010 §VFX ("speed streaks formula"). Explicit math not in ADR. | ⚠️ |
| TR-vfx-003 | blur_amount formula: proportional to speed, capped at max blur | ADR-0010 §Post-Cutoff APIs (MotionBlur Volume override confirmed). Blur formula not explicitly in ADR. | ⚠️ |
| TR-vfx-004 | vignette_intensity formula: proportional to speed/cornering load | ADR-0010 §VFX (Vignette confirmed). Formula not in ADR. | ⚠️ |
| TR-vfx-005 | impactShakeRequest: CarCollisionMonitor → VFX → Camera shake chain | ADR-0010 §Camera Shake (source chain: CarCollisionMonitor → VfxSystem → CameraSystem) | ✅ |
| TR-vfx-006 | VFX budget ≤1.6ms per frame: combined budget 2.1ms (Camera 0.5ms + VFX 1.6ms) | ADR-0010 §Shared rendering budget ("VFX: 1.6ms per frame") | ✅ |
| TR-vfx-007 | Density presets: Low/Medium/High mapped from QualityPresets; particle count, LOD, texture scale | ADR-0010 §VfxSystem.Tick (VfxQualityPreset parameter); ADR-0004 (QualityPresets). Explicit per-preset density values not in ADR. | ⚠️ |
| TR-vfx-008 | PerformanceReduced: reduces particle count and speed-line density | ADR-0001 §PerformanceReduced Signal ("reduces particle count and speed-line density"); ADR-0010 §PerformanceReduced → Low | ✅ |
| TR-vfx-009 | Reduced Motion: Motion Blur off, shake disabled per CameraSettings.reducedMotion | ADR-0004 (ReducedMotion setting); ADR-0010 (§Camera Shake "reducedMotion = true → shake amplitude = 0") | ✅ |
| TR-vfx-010 | Same VFX cockpit/chase: visual state independent of camera mode | ADR-0010 §VFX (shared VisualTransform consumption). Explicit same-intensity rule not in ADR. | ⚠️ |

**VFX Summary: 5 ✅, 5 ⚠️, 0 ❌ (75% coverage)**

---

### 21. UI Menu (10 TRs)

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-uimenu-001 | Linear stack navigation: screens push/pop on a stack | ADR-0003 (Content Pipeline integration for loading screens); ADR-0004 (Settings integration). Linear stack pattern not explicitly in ADR. | ⚠️ |
| TR-uimenu-002 | Finished Presentation input routing: Confirm skip timer, Pause pause timer, Cancel ignored | ADR-0001 §Decision ("UI Presentation owns the up-to-5-second timer, Confirm/Pause direct routing"); ADR-0005 §Context ("Finished Presentation Pause/Confirm routing") | ✅ |
| TR-uimenu-003 | Settings difficulty disabled: Difficulty dropdown disabled during active race | ADR-0004 §Decision ("Settings blocked during active Countdown") | ✅ |
| TR-uimenu-004 | Qualifying Results Confirm only: no timeout, no Back/Cancel | ADR-0001 §Decision ("Grid Display Confirm only") | ✅ |
| TR-uimenu-005 | Results display: race results with position, time, classification | ADR-0001 §Decision (Results lifecycle; Simulation remains Results until ContentUnloadComplete). Results layout not in ADR. | ⚠️ |
| TR-uimenu-006 | Navigate boundary behavior: Navigate wraps at screen boundaries | ADR-0005 (UI Navigate binding defined). Wrap behavior not in ADR. | ⚠️ |
| TR-uimenu-007 | Car selection turntable: rotating car display in selection screen | ADR-0003 (Car Addressable loading). Turntable presentation not in ADR. | ❌ |
| TR-uimenu-008 | Loading progress: progress bar from byte counts | ADR-0003 §Decision (OnLoadingProgress from AsyncOperationHandle.PercentComplete). Minimum 0.5s display not in ADR. | ⚠️ |
| TR-uimenu-009 | Content Unload: unload happens at ContentUnloadRequest → ContentUnloadComplete | ADR-0001 §Decision ("Simulation remains Results until ContentUnloadComplete"); ADR-0003 §UnloadRace | ✅ |
| TR-uimenu-010 | Return to Menu: TransitionRequest from Results/Pause to Idle | ADR-0001 §Decision ("Continue/Back from Results sends ContentUnloadRequest"; "enters Idle after ContentUnloadComplete"); ADR-0003 (CP_ state machine) | ✅ |

**UI Menu Summary: 5 ✅, 4 ⚠️, 1 ❌ (70% coverage)**

---

## Summary

| # | GDD System | TRs | ✅ Covered | ⚠️ Partial | ❌ Gap | Coverage Rate |
|---|------------|-----|-----------|------------|-------|---------------|
| 1 | Input System | 13 | 9 | 2 | 2 | 85% |
| 2 | Simulation Architecture | 16 | 15 | 1 | 0 | 97% |
| 3 | Settings | 6 | 5 | 1 | 0 | 92% |
| 4 | Content Pipeline | 10 | 8 | 2 | 0 | 90% |
| 5 | Ghost Recording | 7 | 7 | 0 | 0 | 100% |
| 6 | Multiplayer Architecture | 5 | 1 | 4 | 0 | 60% |
| 7 | Vehicle Physics | 7 | 7 | 0 | 0 | 100% |
| 8 | Fuel System | 7 | 7 | 0 | 0 | 100% |
| 9 | Tire System | 9 | 7 | 2 | 0 | 89% |
| 10 | Pit Stop | 9 | 7 | 2 | 0 | 89% |
| 11 | Qualifying | 9 | 5 | 0 | 4 | 56% |
| 12 | AI Rival | 9 | 8 | 1 | 0 | 94% |
| 13 | Track System | 12 | 11 | 0 | 1 | 92% |
| 14 | Car Definition Data | 8 | 5 | 2 | 1 | 75% |
| 15 | Race Session Manager | 10 | 6 | 3 | 1 | 75% |
| 16 | Grid & Start | 8 | 6 | 2 | 0 | 88% |
| 17 | Camera | 10 | 7 | 1 | 2 | 80% |
| 18 | HUD | 10 | 1 | 6 | 3 | 40% |
| 19 | Audio System | 9 | 6 | 3 | 0 | 83% |
| 20 | VFX | 10 | 5 | 5 | 0 | 75% |
| 21 | UI Menu | 10 | 5 | 4 | 1 | 70% |
| **Total** | **21 systems** | **194** | **137** | **41** | **16** | **70.6% ✅** |

### Aggregate

| Status | Count | Percentage |
|--------|-------|-----------|
| ✅ Covered | 137 | 70.6% |
| ⚠️ Partial | 41 | 21.1% |
| ❌ Gap | 16 | 8.2% |
| **Total** | **194** | **100%** |

---

## Critical Gaps (❌ — No ADR Coverage)

These 16 TRs have NO architectural decision recording their design. They exist only in GDDs.

### Must Resolve Before Coding

| Priority | TR-ID | GDD | Gap | Suggested ADR |
|----------|-------|-----|-----|---------------|
| 🔴 HIGH | TR-input-008 | Input System | Brake priority logic (accelerateOut = 0 when brake > 0, EMA freeze during brake) | Amend ADR-0005 or new "Input Brake Priority and Axis Blending" ADR |
| 🔴 HIGH | TR-input-011 | Input System | Non-finite raw channel handling (NaN/Inf → 0) | Amend ADR-0005 with input sanitization section |
| 🔴 HIGH | TR-track-009 | Track System | Anti-cut 90% gate threshold (distanceSinceLastLap > trackLength × 0.90) | Amend ADR-0007 or new "Lap Validation Rules" ADR |
| 🔴 HIGH | TR-rsm-010 | Race Session Manager | resultClassification enum (Finished/DNF/Forfeit) and DNF vs Forfeit semantics | New "Race Result Classification and Finish Resolution" ADR |

### Must Resolve Before the Relevant System Is Built

| Priority | TR-ID | GDD | Gap | Suggested ADR |
|----------|-------|-----|-----|---------------|
| 🟡 HIGH | TR-qualifying-001 | Qualifying | Single flying lap format, one chance, no retry | New "Qualifying Session Format and Rules" ADR |
| 🟡 HIGH | TR-qualifying-007 | Qualifying | Skip/fail = P16 grid position, no retry | Part of Qualifying ADR |
| 🟡 HIGH | TR-qualifying-008 | Qualifying | Tier order not preserved in grid assignment | Part of Qualifying ADR |
| 🟡 HIGH | TR-car-def-005 | Car Definition Data | Validation/clamping rules for stats (clamp to nearest valid value {4,8,12,16,20}; missing = 12) | New "Car Definition Data Validation and Error Recovery" ADR |
| 🟡 HIGH | TR-car-def-008 | Car Definition Data | 5% differentiation rule (max stat spread ≤ 5% of total performance) | Part of car definition ADR |

### Presentation Layer (Resolve During Story Creation)

| Priority | TR-ID | GDD | Gap | Suggested ADR |
|----------|-------|-----|-----|---------------|
| 🟡 MED | TR-camera-005 | Camera | Look-ahead formula and offset | Amend ADR-0010 |
| 🟡 MED | TR-camera-006 | Camera | Sphere-cast collision avoidance mechanism | Amend ADR-0010 |
| 🟡 MED | TR-hud-001 | HUD | 7 chase element specification (data sources, positions, sizes) | New "HUD Data Contract and Layout" ADR |
| 🟡 MED | TR-hud-003 | HUD | 0.5s readability budget | Part of HUD ADR |
| 🟡 MED | TR-hud-005 | HUD | Rival gap display | Part of HUD ADR |
| 🟡 LOW | TR-uimenu-007 | UI Menu | Car selection turntable presentation | UI Menu ADR or resolve in implementation |

---

## Systems With Highest Coverage

| Rank | System | Coverage | ADRs |
|------|--------|----------|------|
| 1 | Ghost Recording | 100% | ADR-0008 (dedicated), ADR-0001 |
| 2 | Vehicle Physics | 100% | ADR-0002 (dedicated), ADR-0001, ADR-0009 |
| 3 | Fuel System | 100% | ADR-0006 (dedicated), ADR-0002, ADR-0011, ADR-0013 |
| 4 | Simulation Architecture | 97% | ADR-0001 (dedicated), ADR-0002, ADR-0003, ADR-0006, ADR-0011 |
| 5 | AI Rival | 94% | ADR-0009 (dedicated), ADR-0001, ADR-0002, ADR-0004, ADR-0007 |

## Systems Needing Most Attention

| Rank | System | Coverage | Gaps/Partials |
|------|--------|----------|---------------|
| 18 | HUD | 40% | 3 gaps, 6 partials — no dedicated HUD ADR exists |
| 19 | Qualifying | 56% | 4 gaps — no dedicated Qualifying ADR; format and rules in GDD only |
| 20 | Multiplayer Architecture | 60% | 4 partials — ADR-0001 implies local-only but doesn't declare the constraint explicitly |
| 21 | UI Menu | 70% | 1 gap, 4 partials — navigation structure in GDD only |

## Cross-ADR Concerns

1. **ADR-0006 pipeline numbering**: States "refines Step 5 of canonical 14-step pipeline" but ADR-0001 (the parent) was written with 13 steps. ADR-0006 should explicitly amend ADR-0001.
2. **ADR-0011 claims "13 steps unchanged"** but inserts Step 9b and acknowledges 14-step model. This claim contradicts the added step.
3. **ADR-0002 labels ADR-0006 and ADR-0009 as "forthcoming"** — they are now Accepted and should be updated to current status.
4. **Tire swap time (2s) ownership**: Both Tire System (TR-tire-007) and Pit Stop (TR-pit-003) claim authority. No ADR resolves which owns the 2s constant.
5. **HUD has no dedicated ADR**: 10 TRs are foundational to the player experience but only 1 is fully covered (PerformanceReduced warning from ADR-0001). The HUD data contract, layout, and interaction patterns need architectural codification.
6. **Qualifying has no dedicated ADR**: 4 of 9 TRs are gaps. The single-lap format, skip/fail → P16 rules, and tier→grid assignment are design decisions with architecture implications.