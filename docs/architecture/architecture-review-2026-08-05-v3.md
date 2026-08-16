# Architecture Review Report

> **Date:** 2026-08-05  
> **Mode:** `/architecture-review full`  
> **Engine:** Unity 6000.3.19f1, C#  
> **Rendering:** Universal Render Pipeline 17.3.0  
> **Input:** Input System 1.19.0  
> **Content:** Addressables 3.1.0  
> **GDDs Reviewed:** 21 approved system GDDs  
> **ADRs Reviewed:** 17, ADR-0001 through ADR-0017  
> **Master Architecture:** `docs/architecture/architecture.md`  
> **Technical Preferences:** `docs/framework/technical-preferences.md`  
> **TR Registry:** `docs/architecture/tr-registry.yaml`, version 5  
> **Stories Reviewed:** None found; Phase 3b skipped  
> **Prior Conflict Ledger:** `docs/consistency-failures.md` does not exist; no ledger update applies

---

## 1. Executive Summary

### Verdict: FAIL

The architecture has strong coverage: **114 of 144 technical requirements are explicitly covered**, with only **8 complete gaps**. The failure is caused by implementation-critical conflicts, not by the gap percentage.

The highest-risk problems are:

1. The canonical input-capture order differs between ADR-0001, ADR-0006, and `architecture.md`.
2. The Content Pipeline uses the same `ContentLoadError` event for both recoverable car failure and aborting load failure.
3. ADR-0008’s declared 80-byte ghost header totals only 72 bytes, and its 22,500-tick serialization rules reject the stated valid maximum.
4. The active architecture registry requires `ForceMode.Acceleration` while ADR-0002 requires `ForceMode.Force`.
5. ADR-0017 replays whole-scene PhysX while restoring only selected remote-car kinematics, which can advance non-rollback cars more than once.
6. The required `unity-specialist` consultation could not be launched because this execution context reached the subagent-depth limit.

The dependency graph is acyclic. All 21 systems in `systems-index.md` are represented in the master architecture, although several layer assignments and the ADR audit section are stale.

---

## 2. Traceability Summary

| Status | Count | Percentage |
|---|---:|---:|
| ✅ Covered | 114 | 79.2% |
| ⚠️ Partial | 22 | 15.3% |
| ❌ Gap | 8 | 5.6% |
| **Total** | **144** | **100%** |

### Per-System Summary

| System | Covered | Partial | Gap | Total |
|---|---:|---:|---:|---:|
| Input System | 14 | 0 | 0 | 14 |
| Simulation Architecture | 13 | 1 | 0 | 14 |
| Settings | 7 | 1 | 0 | 8 |
| Content Pipeline | 6 | 1 | 1 | 8 |
| Ghost Recording | 5 | 2 | 0 | 7 |
| Multiplayer Architecture | 5 | 2 | 1 | 8 |
| Vehicle Physics | 6 | 2 | 2 | 10 |
| Fuel System | 4 | 1 | 0 | 5 |
| Tire System | 4 | 0 | 1 | 5 |
| Pit Stop | 5 | 0 | 0 | 5 |
| Qualifying | 8 | 0 | 0 | 8 |
| AI Rival | 4 | 2 | 0 | 6 |
| Track System | 4 | 1 | 0 | 5 |
| Car Definition Data | 2 | 3 | 0 | 5 |
| Race Session Manager | 5 | 0 | 1 | 6 |
| Grid & Start | 3 | 1 | 1 | 5 |
| Camera | 3 | 2 | 0 | 5 |
| HUD | 5 | 0 | 0 | 5 |
| Audio System | 3 | 2 | 0 | 5 |
| VFX | 5 | 0 | 0 | 5 |
| UI Menu | 3 | 1 | 1 | 5 |
| **Total** | **114** | **22** | **8** | **144** |

---

## 3. Complete Traceability Matrix

### 3.1 Input System

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-input-001 | Two action maps: `OverdriveGameplay` with 5 actions and `OverdriveUI` with 6 actions | ADR-0005 | ✅ |
| TR-input-002 | `InputContextController` solely owns action-map and `InputSystemUIInputModule` activation | ADR-0005 | ✅ |
| TR-input-003 | CameraToggle is presentation-only and excluded from simulation, replay, and ghost recording | ADR-0005, ADR-0010 | ✅ |
| TR-input-004 | Confirm, Cancel, and Pause bindings are reserved and cannot be replaced or removed | ADR-0004, ADR-0005 | ✅ |
| TR-input-005 | `CaptureLatestRawSample()` executes exactly once before accumulator evaluation in the same Simulation `Update()` path | ADR-0001, ADR-0005 | ✅ |
| TR-input-006 | `SimulationInput` carries processed axes, raw post-dead-zone axes, pause edge, and input availability | ADR-0001, ADR-0005 | ✅ |
| TR-input-007 | EMA alphas are 0.3/0.3/0.5; brake priority zeros acceleration and freezes Accelerate EMA | ADR-0004, ADR-0005 | ✅ |
| TR-input-008 | Newly enabled digital actions latch until neutral; driving axes are exempt on UI-to-gameplay resume | ADR-0005 | ✅ |
| TR-input-009 | KeyboardMouse is default; last meaningful device wins; same-frame ambiguity preserves the current scheme | ADR-0005 | ✅ |
| TR-input-010 | Mouse input is UI-only and never supplies driving axes | ADR-0005 | ✅ |
| **TR-input-011 [NEW]** | Gamepad stick uses radial dead-zone normalization with inner 0.15 and outer 0.95; triggers use axial inner 0.05; keyboard is exempt | ADR-0004, ADR-0005 | ✅ |
| **TR-input-012 [NEW]** | Non-finite raw axes become zero and processed axes are clamped to their legal ranges before EMA | ADR-0005 | ✅ |
| **TR-input-013 [NEW]** | Binding overrides use stable action and binding GUIDs; an unknown ID invalidates only that override | ADR-0004, ADR-0005 | ✅ |
| **TR-input-014 [NEW]** | `NoInputDevice` produces zeroed driving input without freezing simulation and recovers when a valid scheme returns | ADR-0001, ADR-0005 | ✅ |

**Input total: 14 ✅ / 0 ⚠️ / 0 ❌**

---

### 3.2 Simulation Architecture

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-sim-001 | Fixed 60 Hz manual accumulator in `Update()`, not `FixedUpdate()` | ADR-0001 | ✅ |
| TR-sim-002 | Script simulation mode with exactly one whole-scene `Physics.Simulate(FIXED_DT)` per active tick | ADR-0001 | ✅ |
| TR-sim-003 | Canonical 14-step pipeline from snapshot assembly through next-tick resolved input | ADR-0001, ADR-0006, ADR-0011 | ⚠️ Input-capture order conflicts |
| TR-sim-004 | Focus loss creates an immediate non-physics Paused boundary and focus return never auto-resumes | ADR-0001 | ✅ |
| TR-sim-005 | Representative 16-car simulation must meet p95 ≤6 ms and maximum ≤8 ms | ADR-0001 | ✅ |
| TR-sim-006 | Project-owned LateUpdate interpolation with `Rigidbody.interpolation = None` | ADR-0001, ADR-0002 | ✅ |
| TR-sim-007 | PCG32 and Unity.Mathematics are mandatory on the simulation path; `UnityEngine.Random` is prohibited | ADR-0001, ADR-0009 | ✅ |
| TR-sim-008 | Simulation solely writes `SimulationState`; RSM owns `RaceMode`; Content Pipeline emits lifecycle signals | ADR-0001, ADR-0003 | ✅ |
| TR-sim-009 | Countdown lasts 300 ticks, GO releases grid lock at tick 300, and qualifying bypasses Countdown | ADR-0001, ADR-0013 | ✅ |
| **TR-sim-010 [NEW]** | Accumulator backlog is clamped to `2 × FIXED_DT`; discarded time is never caught up later | ADR-0001 | ✅ |
| **TR-sim-011 [NEW]** | TickStart, Published, PostFinish, and ReplayInitial snapshots are immutable consumer boundaries | ADR-0001 | ✅ |
| **TR-sim-012 [NEW]** | `simulationStepCount`, `activeRaceStepCount`, and race-time progression have explicit Countdown, Racing, Pause, and finish behavior | ADR-0001 | ✅ |
| **TR-sim-013 [NEW]** | Below 30 FPS for 3 seconds emits `PerformanceReduced`; recovery and below-15 FPS pause thresholds are explicit | ADR-0001, ADR-0010, ADR-0014 | ✅ |
| **TR-sim-014 [NEW]** | Finished and Results execute no gameplay simulation; Results remains active until content unload completes | ADR-0001, ADR-0003 | ✅ |

**Simulation total: 13 ✅ / 1 ⚠️ / 0 ❌**

---

### 3.3 Settings

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-settings-001 | One backup-first JSON blob under `OverdriveSettings` | ADR-0004 | ✅ |
| TR-settings-002 | Sequential schema migration from v1 and v2 to v3 | ADR-0004 | ✅ |
| TR-settings-003 | Transactional `SettingsEditSession` with snapshot, working values, Apply, and Cancel | ADR-0004 | ✅ |
| TR-settings-004 | DifficultyProfile is immutable for an active race | ADR-0001, ADR-0004 | ✅ |
| TR-settings-005 | Control profiles validate dead zones and EMA values and restore invalid fields to defaults | ADR-0004 | ✅ |
| **TR-settings-006 [NEW]** | Display changes use `RefreshRate`, a 15-second confirmation, and rollback on timeout, cancellation, or focus loss | ADR-0004 | ✅ |
| **TR-settings-007 [NEW]** | `show_chase_hud_in_cockpit` controls chase-overlay visibility without changing HUD data ownership | ADR-0014; field absent from ADR-0004 schema | ⚠️ |
| **TR-settings-008 [NEW]** | Four quality presets configure render scale and VFX density without requiring recompilation | ADR-0004, ADR-0010 | ✅ |

**Settings total: 7 ✅ / 1 ⚠️ / 0 ❌**

---

### 3.4 Content Pipeline

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-content-001 | Shared, `Cars/{teamId}`, and `Tracks/{trackId}` Addressable groups | ADR-0003 | ✅ |
| TR-content-002 | Track and 16 car bundles load asynchronously in parallel | ADR-0003 | ✅ |
| TR-content-003 | CP state machine includes cache-hit Race Reconfigure | ADR-0003 | ✅ |
| TR-content-004 | Car failure is recoverable, track failure aborts, Shared failure is fatal, and catalog initialization retries | ADR-0003 | ⚠️ Recoverable car failure emits the same abort event |
| TR-content-005 | Per-race memory budgets are 730–1320 MB on PC and 415–670 MB on WebGL | ADR-0003 | ✅ |
| **TR-content-006 [NEW]** | Addressable instances and handles are released with `ReleaseInstance`/`Release`; race unload completes before Idle | ADR-0001, ADR-0003 | ✅ |
| **TR-content-007 [NEW]** | Race loading must complete within 5 seconds on PC and 10 seconds on Web | No ADR records these accepted ceilings | ❌ |
| **TR-content-008 [NEW]** | Back/Cancel is blocked after loading begins; unload and partial-failure cleanup have explicit completion signals | ADR-0001, ADR-0003 | ✅ |

**Content total: 6 ✅ / 1 ⚠️ / 1 ❌**

---

### 3.5 Ghost Recording

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-ghost-001 | Continuous 12-byte input records plus a separate edge-event stream | ADR-0008 | ✅ |
| TR-ghost-002 | Versioned 80-byte binary header beginning with magic `0x47485354` | ADR-0008 | ⚠️ Listed fields total 72 bytes |
| TR-ghost-003 | 22,500-tick maximum; only an exceeded cap becomes non-serializable | ADR-0008 | ⚠️ Validation rejects exactly 22,500 ticks |
| TR-ghost-004 | MVP buffers are discarded on Results, Forfeit, Idle, and load failure | ADR-0008 | ✅ |
| TR-ghost-005 | Alpha persistence is attempted only for a new local personal best | ADR-0008, ADR-0016 | ✅ |
| **TR-ghost-006 [NEW]** | CRC32 is stored per 256-tick block and LZ4 is optional and version-flagged | ADR-0008 | ✅ |
| **TR-ghost-007 [NEW]** | ReplayInitialState captures race/content identity, seed, grid, cars, resources, and Perfect Start state at GO | ADR-0001, ADR-0008 | ✅ |

**Ghost total: 5 ✅ / 2 ⚠️ / 0 ❌**

---

### 3.6 Multiplayer Architecture

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| **TR-multiplayer-001 [NEW]** | MVP links no online-services or real-time SDK and creates no network traffic | ADR-0016 | ✅ |
| **TR-multiplayer-002 [NEW]** | Alpha selects identity and durable ghost storage independently from Beta’s real-time SDK | ADR-0016 | ✅ |
| **TR-multiplayer-003 [NEW]** | The Beta driver is a guest of the manual accumulator and never owns physics stepping or `SimulationState` | ADR-0017 | ✅ |
| **TR-multiplayer-004 [NEW]** | Beta’s candidate `NetworkInput` is a fixed 14-byte versioned packet distinct from the 12-byte ghost record | ADR-0017 requires mapping but does not finalize the layout | ⚠️ |
| **TR-multiplayer-005 [NEW]** | Real-time play uses input prediction with owner-published corrective kinematic state; local PhysX is not canonical | ADR-0001, ADR-0017 | ✅ |
| **TR-multiplayer-006 [NEW]** | Clock alignment, input delay, jitter buffer, redundancy, `W_drop`, `W_rollback`, held-last, and timeout are empirically selected | ADR-0017 | ✅ |
| **TR-multiplayer-007 [NEW]** | Rollback replays vehicle kinematics and recorded input while Fuel, Tire, Pit, RSM, AI RNG, counters, and Ghost remain forward-only | ADR-0017, but whole-scene replay isolation is unresolved | ⚠️ |
| **TR-multiplayer-008 [NEW]** | Beta reconnects with five exponential-backoff attempts, resynchronizes on success, and transfers a permanently disconnected slot to AI | No ADR owns the provisional disconnect lifecycle | ❌ |

**Multiplayer total: 5 ✅ / 2 ⚠️ / 1 ❌**

---

### 3.7 Vehicle Physics

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-vp-001 | Grip stack is `gripBase × surface × tire`, clamped to 0.20–1.20; Stability affects slip only | ADR-0002, ADR-0006, ADR-0007 | ✅ |
| TR-vp-002 | Full authoritative `CarState` schema is produced every tick | ADR-0001, ADR-0002 | ✅ |
| TR-vp-003 | `IVehicleDriver` hides the Rigidbody implementation and preserves a future DOTS seam | ADR-0002 | ✅ |
| TR-vp-004 | Wall bounce includes shallow-angle handling, 0.2–0.5-second cooldown, and 50% repeated-impulse reduction | ADR-0002 does not explicitly preserve the ≤30° threshold | ⚠️ |
| TR-vp-005 | Lift-off rotation requires a prior 0.3-second throttle hold before reactivation | ADR-0002 validation only; operational contract incomplete | ⚠️ |
| **TR-vp-006 [NEW]** | Steering uses `min(steerCeiling(v), v/minTurnRadius, gripCeiling)` with speed falloff | ADR-0002 | ✅ |
| **TR-vp-007 [NEW]** | Lift-off adds fixed +3.0g in both yaw-request and velocity-rotation consumers | ADR-0002 | ✅ |
| **TR-vp-008 [NEW]** | Drift activation uses the validated track-radius factor and `driftHeadBoost` behavior | No current ADR records the validated drift formula | ❌ |
| **TR-vp-009 [NEW]** | Longitudinal acceleration uses the validated engine-power-over-speed and quadratic-drag formula | No current ADR records the validated acceleration formula | ❌ |
| **TR-vp-010 [NEW]** | Car-to-car contact applies 15–25% speed loss, push impulse, and repeated-contact cooldown through Vehicle Physics | ADR-0002 | ✅ |

**Vehicle Physics total: 6 ✅ / 2 ⚠️ / 2 ❌**

---

### 3.8 Fuel System

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-fuel-001 | Fixed 8.0L tank and throttle-proportional consumption | ADR-0006 | ✅ |
| TR-fuel-002 | Base rate 0.06 L/s and `efficiencyModifier = 1 - stat × 0.025` | ADR-0006/0015 defer the formula as a tuning knob | ⚠️ |
| TR-fuel-003 | Below 25% fuel grants +1% top speed | ADR-0002, ADR-0006 | ✅ |
| TR-fuel-004 | Fuel does not drain during Countdown and begins on the first Racing tick | ADR-0001, ADR-0006 | ✅ |
| **TR-fuel-005 [NEW]** | Refueling reads next-tick `PitServiceCommand.active/targetFuel` and fills at 0.8 L/s | ADR-0006, ADR-0011 | ✅ |

**Fuel total: 4 ✅ / 1 ⚠️ / 0 ❌**

---

### 3.9 Tire System

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-tire-001 | Continuous wear drives a linear runtime-grip multiplier | ADR-0006 | ✅ |
| TR-tire-002 | Grip floor is 0.20 and pit tire replacement is a binary two-second service | ADR-0006, ADR-0011 | ✅ |
| TR-tire-003 | `TireCompound` ScriptableObject owns `compoundName`, `gripBase`, and `wearRateMultiplier` | ADR-0006 defines only `compoundId`, not the asset schema | ❌ |
| **TR-tire-004 [NEW]** | Wear consumes distance, aggression, surface, efficiency, and compound multipliers from immutable tick inputs | ADR-0006, ADR-0007 | ✅ |
| **TR-tire-005 [NEW]** | Qualifying disables wear; pit service resets wear only through `PitServiceCommand` | ADR-0006, ADR-0011, ADR-0013 | ✅ |

**Tire total: 4 ✅ / 0 ⚠️ / 1 ❌**

---

### 3.10 Pit Stop

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-pit-001 | Service duration is `max(2s, missingFuel/0.8)` with fuel and tires in parallel | ADR-0011 | ✅ |
| TR-pit-002 | Player may exit after tire replacement with partial fuel; AI waits for full fuel | ADR-0005, ADR-0011 | ✅ |
| TR-pit-003 | Advisory window begins at `min(0.80, max(0, pitEntryProgress - 0.05))` and ends at pit entry | ADR-0011; registry text needs clamp revision | ✅ |
| **TR-pit-004 [NEW]** | Vehicle Physics solely writes `PitPhase`; Pit Stop writes only `PitState` and next-tick `PitServiceCommand` | ADR-0002, ADR-0006, ADR-0011 | ✅ |
| **TR-pit-005 [NEW]** | Pit transit enforces the track’s speed limit and navigates through the assigned one-of-16 pit box | ADR-0002, ADR-0007, ADR-0011 | ✅ |

**Pit total: 5 ✅ / 0 ⚠️ / 0 ❌**

---

### 3.11 Qualifying

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-qual-001 | Single flying lap, no retry, represented as `RaceMode.Qualifying` inside Racing | ADR-0001, ADR-0013 | ✅ |
| TR-qual-002 | Fuel load is `min(8.0L, fuelRate × referenceFlyingLapTime × 1.10)` | ADR-0006, ADR-0013 | ✅ |
| TR-qual-003 | Tire wear is disabled and grip begins at 100% | ADR-0006, ADR-0013 | ✅ |
| TR-qual-004 | One attempt enters Racing directly without Countdown or grid lock | ADR-0001, ADR-0013 | ✅ |
| TR-qual-005 | Skip/failure produces DNQ/P16 with pre-generated AI times | ADR-0013 | ✅ |
| TR-qual-006 | Tier order is not forced; lower-tier cars can outqualify higher-tier cars | ADR-0013 | ✅ |
| **TR-qual-007 [NEW]** | Player spawns in a pit box, drives an untimed out-lap, then times exactly one start-line-to-start-line flying lap | ADR-0013 | ✅ |
| **TR-qual-008 [NEW]** | RSM creates immutable GridAssignment by ascending time with stable `carId` tie-break | ADR-0013 | ✅ |

**Qualifying total: 8 ✅ / 0 ⚠️ / 0 ❌**

> Registry ambiguity: `TR-qual-001` and `TR-qual-004` overlap heavily. Both permanent IDs must remain until the user chooses deprecation or supersession.

---

### 3.12 AI Rival

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-ai-001 | Deterministic AI noise is keyed by race seed, car ID, and simulation step | ADR-0009 defines a stateful per-car PCG32 stream instead | ⚠️ |
| TR-ai-002 | Four data-driven archetypes with distinct error and aggression parameters | ADR-0009 | ✅ |
| TR-ai-003 | Pit projection uses 110% of prior-lap resource demand and is disabled before lap one and on the final lap | ADR-0009, ADR-0011 | ✅ |
| TR-ai-004 | AI reads only the Published snapshot and writes cached next-tick `AIInput` | ADR-0001, ADR-0009 | ✅ |
| **TR-ai-005 [NEW]** | Target speed combines base, state, personality, pace-noise, and error-noise factors | ADR-0009 defines fields but not the complete formula/consumption order | ⚠️ |
| **TR-ai-006 [NEW]** | AI uses the same Vehicle Physics path as the player and has no active obstacle avoidance in MVP | ADR-0002, ADR-0009 | ✅ |

**AI total: 4 ✅ / 2 ⚠️ / 0 ❌**

---

### 3.13 Track System

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-track-001 | JSON contains splines, width, surfaces, pit lane, grid data, and metadata | ADR-0007 | ✅ |
| TR-track-002 | Six surface types use the approved grip values | ADR-0007 defines a data table but does not enumerate every authoritative value | ⚠️ |
| TR-track-003 | Separate two-lane pit spline with 16 pit boxes | ADR-0007 | ✅ |
| **TR-track-004 [NEW]** | Track JSON is schema-versioned, Addressable, and materialized into chordal Catmull-Rom runtime structures | ADR-0003, ADR-0007 | ✅ |
| **TR-track-005 [NEW]** | Pit progress maps to racing progress and lap counting requires the 90%-distance anti-cut gate | ADR-0007 | ✅ |

**Track total: 4 ✅ / 1 ⚠️ / 0 ❌**

---

### 3.14 Car Definition Data

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-car-001 | Six integer stats in [0,20] across 16 teams; global vehicle mass is 505 kg | ADR-0002, ADR-0015; registry still says increments of four | ✅ |
| TR-car-002 | Stats map to speed, acceleration, braking, grip, slip stability, and efficiency formulas | ADR-0002/0015 do not record the complete validated formula set | ⚠️ |
| TR-car-003 | Out-of-range stats clamp to the nearest integer in [0,20] at race initialization | ADR-0015 still models configurable sparse valid values such as 4/8/12/16/20 | ⚠️ |
| TR-car-004 | Authoring validation detects duplicate or insufficiently differentiated performance profiles | ADR-0015 warns when spread is greater than the threshold, reversing the intended condition | ⚠️ |
| **TR-car-005 [NEW]** | CarDefinition stores stats, structured audio profile, opaque team color, and cockpit offset through read-only accessors | ADR-0012, ADR-0015 | ✅ |

**Car Definition total: 2 ✅ / 3 ⚠️ / 0 ❌**

---

### 3.15 Race Session Manager

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-rsm-001 | Position ranking is lap count descending, spline progress descending, entry step ascending, then car ID ascending | No ADR explicitly records the ranking algorithm | ❌ |
| TR-rsm-002 | Lap count requires boundary crossing and more than 90% track traversal | ADR-0007 | ✅ |
| TR-rsm-003 | Finish resolver consumes one PostFinishSnapshot and projects unfinished AI by pace only | ADR-0001, ADR-0009 | ✅ |
| **TR-rsm-004 [NEW]** | Result classification is Finished, DNF, or Forfeit, with no fabricated position for Forfeit | ADR-0001 | ✅ |
| **TR-rsm-005 [NEW]** | RSM emits transition requests while Simulation remains the sole state-machine writer | ADR-0001 | ✅ |
| **TR-rsm-006 [NEW]** | RSM owns immutable GridAssignment and carries it through qualifying-to-race reconfiguration | ADR-0001, ADR-0003, ADR-0013 | ✅ |

**RSM total: 5 ✅ / 0 ⚠️ / 1 ❌**

---

### 3.16 Grid & Start

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-grid-001 | Sixteen cars form eight two-wide rows with first-corner-dependent staggering | ADR-0007 | ✅ |
| TR-grid-002 | Perfect Start requires throttle above 0.5 and brake at zero from GO-12 through GO | No ADR records the arming window and thresholds | ❌ |
| TR-grid-003 | Successful Perfect Start applies 1.15× drive force for 600 ticks | ADR-0001, ADR-0002 | ✅ |
| **TR-grid-004 [NEW]** | Countdown contains five one-second lights over 300 ticks while driving input advances behind grid lock | ADR-0001, ADR-0002 | ✅ |
| **TR-grid-005 [NEW]** | Qualifying Results permits Confirm only, has no timeout or Back/Cancel path, and owns no generic stack navigation | Confirm-only is covered; presentation details remain distributed | ⚠️ |

**Grid total: 3 ✅ / 1 ⚠️ / 1 ❌**

---

### 3.17 Camera

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-camera-001 | Cockpit primary, Chase secondary, 0.35-second transitions, and SphereCast avoidance | ADR-0010 uses 0.2 seconds | ⚠️ |
| TR-camera-002 | Speed, surface, and impact shake layers clamp to 3° total | ADR-0010 defines four named contributors and no explicit 3° aggregate clamp | ⚠️ |
| TR-camera-003 | Quadratic 78–95° Cockpit and 70–90° Chase FOV; Reduced Motion pins base FOV | ADR-0004, ADR-0010 | ✅ |
| **TR-camera-004 [NEW]** | Chase follows filtered horizontal velocity and uses speed-scaled look-ahead plus SphereCast collision avoidance | ADR-0010 | ✅ |
| **TR-camera-005 [NEW]** | PitCamera and terminal three-quarter presentation consume interpolated snapshot state without changing simulation | ADR-0001, ADR-0010, ADR-0011 | ✅ |

**Camera total: 3 ✅ / 2 ⚠️ / 0 ❌**

---

### 3.18 HUD

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-hud-001 | Eight Chase elements, with Ghost Delta as an Alpha+ ninth element | ADR-0014 | ✅ |
| TR-hud-002 | Every element is readable within 0.5 seconds at 200+ km/h and presents no more than two items per glance | ADR-0014 | ✅ |
| TR-hud-003 | Team-color accents use automatic contrast fallback over 85%-opacity Asphalt Black panels | ADR-0014, ADR-0015 | ✅ |
| **TR-hud-004 [NEW]** | Every HUD element has one authoritative data owner and an explicit update cadence | ADR-0014 | ✅ |
| **TR-hud-005 [NEW]** | Cockpit uses a four-element warning layout; the settings toggle may reveal the full Chase overlay; pit/performance advisories remain transient | ADR-0014 | ✅ |

**HUD total: 5 ✅ / 0 ⚠️ / 0 ❌**

---

### 3.19 Audio System

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-audio-001 | Procedural two-oscillator engine derives pitch from base frequency, fuel factor, and gear ratio | ADR-0012 | ✅ |
| TR-audio-002 | Race Start, Final Lap, Finish, and Pit Entry stings duck background audio by 6 dB | ADR-0012 says four stings but does not explicitly preserve the full inventory and ducking constant | ⚠️ |
| TR-audio-003 | Tire-squeal volume rises with wear and its approved pitch/frequency behavior remains stable | ADR-0012 captures wear scaling but not the complete pitch contract | ⚠️ |
| **TR-audio-004 [NEW]** | Master, Music, SFX, and UI settings route through the Unity Audio Mixer and follow Simulation/Race/Pit lifecycle state | ADR-0004, ADR-0012 | ✅ |
| **TR-audio-005 [NEW]** | `IEngineSoundProvider` permits procedural/sample replacement and passes parameters safely to the audio callback thread | ADR-0012 | ✅ |

**Audio total: 3 ✅ / 2 ⚠️ / 0 ❌**

---

### 3.20 VFX

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-vfx-001 | Speed streaks begin at 100 km/h and normalize against the loaded grid’s global maximum velocity | ADR-0010 | ✅ |
| TR-vfx-002 | VFX remains within a 1.6 ms frame allocation | ADR-0010 | ✅ |
| TR-vfx-003 | Low/Medium/High/Ultra density presets exist and `PerformanceReduced` forces Low | ADR-0004, ADR-0010 | ✅ |
| **TR-vfx-004 [NEW]** | Screen-space effects use URP RenderGraph/FullScreenPass; Motion Blur uses URP Volume overrides | ADR-0010 | ✅ |
| **TR-vfx-005 [NEW]** | Reduced Motion disables motion blur and shake while preserving non-motion visibility; particles follow the approved effect and quality set | ADR-0004, ADR-0010 | ✅ |

**VFX total: 5 ✅ / 0 ⚠️ / 0 ❌**

---

### 3.21 UI Menu

| TR-ID | Requirement | ADR Coverage | Status |
|---|---|---|---|
| TR-ui-001 | Current flow is Title → Track → Car → optional Qualifying → Qualifying Results → Loading → Countdown → Race → Results → Title | ADR-0001, ADR-0003, ADR-0013; registry still says “Grid” | ⚠️ |
| TR-ui-002 | Car selection presents a 3D turntable at 15 RPM with Garage Lit lighting | No ADR records this presentation contract | ❌ |
| TR-ui-003 | Results distinguishes Finished, DNF, and Forfeit, omitting unavailable position data | ADR-0001 | ✅ |
| **TR-ui-004 [NEW]** | Pointer, keyboard, and gamepad navigation have explicit focus, boundary, prompt, and reserved Confirm/Cancel routing | ADR-0005 | ✅ |
| **TR-ui-005 [NEW]** | Loading, Finished Presentation, Qualifying Results, Pause, and Results use explicit non-stack lifecycle and input behavior | ADR-0001, ADR-0003, ADR-0005, ADR-0013 | ✅ |

**UI total: 3 ✅ / 1 ⚠️ / 1 ❌**

---

## 4. Proposed New TR Registry Entries

The full matrix proposes **57 append-only IDs**:

- `TR-input-011` through `TR-input-014`
- `TR-sim-010` through `TR-sim-014`
- `TR-settings-006` through `TR-settings-008`
- `TR-content-006` through `TR-content-008`
- `TR-ghost-006` through `TR-ghost-007`
- `TR-multiplayer-001` through `TR-multiplayer-008`
- `TR-vp-006` through `TR-vp-010`
- `TR-fuel-005`
- `TR-tire-004` through `TR-tire-005`
- `TR-pit-004` through `TR-pit-005`
- `TR-qual-007` through `TR-qual-008`
- `TR-ai-005` through `TR-ai-006`
- `TR-track-004` through `TR-track-005`
- `TR-car-005`
- `TR-rsm-004` through `TR-rsm-006`
- `TR-grid-004` through `TR-grid-005`
- `TR-camera-004` through `TR-camera-005`
- `TR-hud-004` through `TR-hud-005`
- `TR-audio-004` through `TR-audio-005`
- `TR-vfx-004` through `TR-vfx-005`
- `TR-ui-004` through `TR-ui-005`

### Existing Registry Entries Requiring Same-ID Revision

| TR-ID | Required revision |
|---|---|
| TR-car-001 | Remove “increments of 4”; stats are integers in `[0,20]` |
| TR-car-003 | Replace sparse configured values with clamp-to-nearest-integer `[0,20]` |
| TR-pit-003 | Add the lower clamp: `min(0.80, max(0, pitEntryProgress - 0.05))` |
| TR-ui-001 | Replace obsolete “Grid” terminology with Qualifying Results and current lifecycle flow |
| Registry header | Update `last_updated` from 2026-07-28 to 2026-08-05 and replace stale review totals |

### Ambiguous Existing Match

`TR-qual-001` and `TR-qual-004` represent substantially the same single-lap/no-retry/no-Countdown contract. Both are permanent IDs. A later registry decision should designate one as superseding the other rather than deleting or renumbering either.

---

## 5. Coverage Gaps and Suggested ADR Work

| Priority | TR-ID | Gap | Suggested action |
|---|---|---|---|
| HIGH | TR-vp-008 | Validated drift activation and head/velocity behavior are absent from ADR-0002 | Amend ADR-0002 with the accepted drift formula and consumer order |
| HIGH | TR-vp-009 | Validated engine-power/quadratic-drag acceleration formula is absent from ADR-0002 | Amend ADR-0002 with the authoritative longitudinal model |
| HIGH | TR-rsm-001 | Position-ranking and deterministic tie-break algorithm exist only in the GDD | Amend ADR-0001 or create Race Classification and Ranking ADR |
| HIGH | TR-grid-002 | Perfect Start arming window and thresholds are not architectural | Amend ADR-0005 or create Grid Start Input Contract ADR |
| MEDIUM | TR-content-007 | PC ≤5s and Web ≤10s loading ceilings are not in ADR-0003 | Amend ADR-0003 after defining measurement hardware and cache state |
| MEDIUM | TR-tire-003 | TireCompound asset schema is undefined | Amend ADR-0006 or create Tire Compound Data ADR |
| FUTURE/BETA | TR-multiplayer-008 | Reconnection, resync, timeout, and AI takeover are provisional GDD behavior | Create Beta Disconnect and Session Recovery ADR |
| LOW | TR-ui-002 | Car-selection turntable and Garage Lit presentation lack an ADR | Capture in a UI presentation ADR or explicitly classify as UX-owned, non-architectural |

---

## 6. Cross-ADR and Architecture Conflicts

### C1. Input capture has two incompatible canonical positions

**Severity:** HIGH  
**Status:** Resolved (2026-08-05)
**Documents:**

- `docs/architecture/adr-0001-manual-simulation-authority-and-determinism-boundary.md:39-43,78-92`
- `docs/architecture/adr-0006-fuel-tire-state-ownership-and-tick-timing.md:89-96`
- `docs/architecture/architecture.md:241-243`

**Conflict:**

ADR-0001 requires `CaptureLatestRawSample()` at the beginning of the Simulation driver’s `Update()`, before the accumulator, and shows:

```text
CaptureLatestRawSample → TickStartSnapshot
```

ADR-0006 places input capture at per-tick Step 2 after Step 1. `architecture.md` builds `TickStartSnapshot` at Step 1 and captures input at Step 2 through an `InputEventQueue`.

**Impact:** Implementers cannot know whether current render-frame input belongs in the current tick snapshot or the next one. Multiple ticks in one render frame can capture more than once or consume stale input.

**Required resolution:** Keep ADR-0001’s pre-accumulator, once-per-render-frame capture. Make per-tick Step 1 assemble the snapshot using that captured sample. Remove the Step 2 recapture and obsolete `InputEventQueue` wording.

---

### C2. Recoverable car failure emits the abort event

**Severity:** HIGH  
**Status:** Resolved (2026-08-05)
**Documents:**

- `docs/architecture/adr-0003-content-pipeline-and-addressables.md:46-56`
- `docs/architecture/adr-0003-content-pipeline-and-addressables.md:240-250`
- `design/gdd/simulation-architecture.md:342`

**Conflict:**

ADR-0003 requires car-load failure to skip the car, instantiate a placeholder, and continue. Its validation criterion nevertheless emits `ContentLoadError(ErrorType.Car)`. Simulation’s load-error contract transitions Loading to Idle on `ContentLoadError`.

**Impact:** The same event means both “continue” and “abort.” A single failed car can incorrectly terminate the whole load.

**Required resolution:** Introduce a non-fatal `CarLoadDegraded`/`CarLoadResult` notification. Reserve `ContentLoadError` for errors that abort Loading.

---

### C3. Ghost header size and tick-cap contracts are internally impossible

**Severity:** HIGH  
**Status:** Resolved (2026-08-05)
**Document:**

- `docs/architecture/adr-0008-ghost-recording-data-format-and-mvp-buffer.md:37-58`
- `docs/architecture/adr-0008-ghost-recording-data-format-and-mvp-buffer.md:64-85`
- `docs/architecture/adr-0008-ghost-recording-data-format-and-mvp-buffer.md:121-128`
- `docs/architecture/adr-0008-ghost-recording-data-format-and-mvp-buffer.md:234-261`

**Conflict:**

The fields listed for the “80-byte” header total **72 bytes**, including the six reserved bytes. Separately, the ADR says a race may validly contain 22,500 ticks and becomes non-serializable only if that cap is exceeded, but `IsSerializable` becomes false when the count reaches 22,500.

**Impact:** Serializer offsets and CRC coverage cannot be implemented consistently. A full valid 375-second race is rejected.

**Required resolution:** Either add eight explicitly reserved bytes or change the header size/version to 72. Define validity as `tickCount <= 22500`; mark only attempted overflow as non-serializable.

---

### C4. Active architecture registry reverses the accepted ForceMode decision

**Severity:** HIGH  
**Status:** Resolved (2026-08-05)
**Documents:**

- `docs/registry/architecture.yaml:424-434`
- `docs/architecture/adr-0002-vehicle-physics-implementation-pattern.md:151-157`
- `docs/architecture/control-manifest.md:93-98`

**Conflict:**

The architecture registry requires `ForceMode.Acceleration` and prohibits `ForceMode.Force`. ADR-0002 and the regenerated control manifest require `ForceMode.Force` because passing force-semantics values to Acceleration multiplied the result by vehicle mass.

**Impact:** The registry can reintroduce the measured 14,140 m/s² acceleration error.

**Required resolution:** Revise the existing registry stance in place. Preserve its identity/history, set `api: ForceMode.Force`, update `not:`, explanation, and revision date.

---

### C5. Whole-scene rollback can advance non-rollback cars more than once

**Severity:** HIGH, Beta scope  
**Status:** Resolved (2026-08-05); ADR-0017 Accepted — D4 emended: full kinematic restore of ALL 16 cars per replay frame
**Documents:**

- `docs/architecture/adr-0017-network-simulation-driver-interface-and-beta-canonical-state-model.md:115-145`
- `docs/architecture/adr-0001-manual-simulation-authority-and-determinism-boundary.md:37-54`
- `docs/architecture/adr-0006-fuel-tire-state-ownership-and-tick-timing.md:89-105`

**Conflict:**

ADR-0017 restores corrective state only for selected remote cars, then calls whole-scene `Physics.Simulate()` for each replay frame. PhysX necessarily advances every active Rigidbody and resolves collisions against local and non-reconciled cars, while Fuel, Tire, Pit, RSM, counters, and AI remain forward-only.

**Impact:** Local cars can move twice, collision partners can be altered without matching domain rollback, and published corrections can represent a physically inconsistent world.

**Required resolution:** Before ADR-0017 can be Accepted, define one of:

1. full kinematic restore for all simulated cars per replay frame;
2. isolated rollback physics scene;
3. kinematic corrective replay that does not invoke whole-scene PhysX; or
4. another empirically validated method that guarantees non-replayed state is unchanged.

---

### C6. Camera blend duration differs between GDD and ADR

**Severity:** MEDIUM  
**Status:** Resolved (2026-08-05)
**Documents:**

- `design/gdd/camera.md:120,152,243`
- `docs/architecture/adr-0010-camera-vfx-rendering-budget-and-interpolation.md:121-124`
- `docs/architecture/tr-registry.yaml`, `TR-camera-001`

**Conflict:** Camera GDD and TR-camera-001 specify 0.35 seconds. ADR-0010 specifies 0.2 seconds for Chase/Cockpit and pit-camera transitions.

**Required resolution:** Choose one data value. Recommendation: keep the GDD’s 0.35-second player mode switch and allow a separately tuned 0.2-second pit transition if that distinction is intentional.

---

### C7. AI randomness is counter-keyed in the GDD but stateful in ADR-0009

**Severity:** MEDIUM  
**Status:** Resolved (2026-08-05)
**Documents:**

- `design/gdd/ai-rival.md:41-43`
- `docs/architecture/adr-0009-ai-rival-deterministic-architecture.md:89-94`
- `docs/architecture/tr-registry.yaml`, `TR-ai-001`

**Conflict:** The GDD defines deterministic noise using `(race_seed, car_id, simulationStepCount)`. ADR-0009 creates one mutable PCG32 stream per car and captures its state in ReplayInitialState.

**Impact:** Branch-dependent random consumption can change future AI output despite identical tick identity.

**Required resolution:** Choose either counter-based random derivation or a strictly specified per-tick consumption schedule for the stateful stream.

---

### C8. Pit Stop transitions a phase it does not own

**Severity:** MEDIUM  
**Status:** Resolved (2026-08-05)
**Documents:**

- `docs/architecture/adr-0002-vehicle-physics-implementation-pattern.md:166-171`
- `docs/architecture/adr-0011-pit-stop-architecture.md:35-47`
- `docs/architecture/adr-0011-pit-stop-architecture.md:115-131`

**Conflict:** ADR-0002 makes Vehicle Physics the sole writer of `CarState.PitPhase`. ADR-0011 says Pit Stop “triggers transitions” and directly “transitions to PitExiting,” but defines no command or request returned to Vehicle Physics.

**Impact:** Early exit and full-service completion have no valid cross-system write path.

**Required resolution:** Add an immutable `PitPhaseTransitionRequest` or extend `PitServiceCommand` with an exit request consumed and applied by Vehicle Physics on the next authoritative tick.

---

### C9. HUD may bypass the immutable snapshot boundary

**Severity:** MEDIUM  
**Status:** Resolved (2026-08-05)
**Documents:**

- `docs/architecture/adr-0014-hud-data-contract-and-layout.md:61-89`
- `docs/architecture/adr-0001-manual-simulation-authority-and-determinism-boundary.md:125-132`

**Conflict:** ADR-0014 permits HUD elements to read a Published snapshot “or direct system interface.” ADR-0001 requires all presentation consumers, including HUD, to consume immutable published state in LateUpdate.

**Impact:** Direct reads can mix values from different ticks and bypass the snapshot’s consistency guarantee.

**Required resolution:** Publish all HUD-required domain values in one presentation snapshot, or explicitly define direct interfaces as immutable copies captured at the same publication boundary.

---

### C10. Car validation architecture is stale and differentiation comparison is reversed

**Severity:** MEDIUM  
**Status:** Resolved (2026-08-05)
**Documents:**

- `design/gdd/car-definition-data.md:137-167,436-439`
- `docs/architecture/adr-0015-car-definition-data-validation.md:137-168`
- `docs/architecture/adr-0015-car-definition-data-validation.md:170-193`
- `docs/architecture/tr-registry.yaml`, `TR-car-001`, `TR-car-003`, `TR-car-004`

**Conflict:**

Current design permits every integer in `[0,20]`; ADR-0015 still models sparse configurable valid values such as 4/8/12/16/20. Its differentiation pseudocode warns when spread is **greater** than the threshold, although insufficient spread or duplication is the condition that should warn.

**Required resolution:** Amend ADR-0015 to clamp to `[0,20]` and define an unambiguous distance metric with warning condition `distance < minimumRequiredDifference` or equivalent.

---

### C11. Registry fixes the network clock that ADR-0017 explicitly defers

**Severity:** MEDIUM  
**Status:** Resolved (2026-08-05)
**Documents:**

- `docs/registry/architecture.yaml:514-523`
- `docs/architecture/adr-0017-network-simulation-driver-interface-and-beta-canonical-state-model.md:93-113`

**Conflict:** The registry makes relay/room frame number the fixed source of truth. ADR-0017 requires clock mapping, synchronization cadence, drift correction, and uncertainty to be selected empirically with the future SDK.

**Required resolution:** Replace the registry’s fixed clock choice with a pending-measurement contract matching ADR-0017.

---

### C12. Architecture registry still uses obsolete pit vocabulary

**Severity:** MEDIUM  
**Status:** Resolved (2026-08-05)
**Documents:**

- `docs/registry/architecture.yaml:91-100`
- `docs/architecture/architecture.md:332-337`
- ADR-0002 and ADR-0011

**Conflict:** Registry uses `PitServicePhase`; accepted ADRs and master architecture use `PitPhase`.

**Required resolution:** Change the interface text to canonical `PitPhase`.

---

### C13. Architecture registry puts Audio in DynamicUpdate

**Severity:** MEDIUM  
**Status:** Resolved (2026-08-05)
**Documents:**

- `docs/registry/architecture.yaml:126-135`
- `docs/architecture/adr-0012-audio-system-architecture.md:22-29,84-95`
- `docs/architecture/adr-0001-manual-simulation-authority-and-determinism-boundary.md:125-132`

**Conflict:** Registry explanation says “DynamicUpdate per ADR-0010 pattern.” ADR-0001 and ADR-0012 require LateUpdate presentation consumption.

**Required resolution:** Replace DynamicUpdate with LateUpdate.

---

### C14. Architecture registry’s CarDefinition contract is incomplete

**Severity:** MEDIUM  
**Status:** Resolved (2026-08-05)
**Documents:**

- `docs/registry/architecture.yaml:281-296`
- `docs/architecture/adr-0015-car-definition-data-validation.md:62-135`
- `design/gdd/car-definition-data.md:137-167`

**Conflict:** Registry contract lists stats, weight, and audio only. Current schema also requires `TeamColor` and `CockpitOffset`, while mass is a global physics constant rather than per-car content.

**Required resolution:** Update the registry signature without creating a new contract ID.

---

### C15. Registry simulation budget still names a 13-step scope

**Severity:** LOW  
**Status:** Resolved (2026-08-05)
**Documents:**

- `docs/registry/architecture.yaml:373-382`
- `docs/architecture/architecture.md:227-272`

**Conflict:** Registry measurement scope says Steps 1–13. Canonical architecture says 14 steps.

**Required resolution:** Correct the existing budget description to Steps 1–14.

---

### C16. Addressables progress contract does not provide byte progress

**Severity:** MEDIUM  
**Status:** Resolved (2026-08-05)
**Documents:**

- `docs/architecture/adr-0003-content-pipeline-and-addressables.md:203-219`
- `docs/architecture/adr-0003-content-pipeline-and-addressables.md:240-247`
- `design/gdd/content-pipeline.md`, loading-progress requirements

**Conflict:** ADR-0003 derives byte progress from `AsyncOperationHandle.PercentComplete`. That property is operation progress, not a guarantee of byte-weighted transfer progress. Addressables exposes `GetDownloadStatus()` for byte totals.

**Required resolution:** Define whether progress is phase-weighted operation progress or byte-weighted download progress. Use `GetDownloadStatus()` where byte semantics are required.

---

### C17. Proposed ADR stances are marked active in the architecture registry

**Severity:** LOW/MEDIUM governance issue  
**Status:** Resolved (2026-08-05)
**Documents:**

- `docs/architecture/adr-0016-multiplayer-sdk-deferral-and-boundary.md:1-7`
- `docs/architecture/adr-0017-network-simulation-driver-interface-and-beta-canonical-state-model.md:1-7`
- `docs/registry/architecture.yaml:325-336,502-523`

**Conflict:** ADR-0016 and ADR-0017 remain Proposed, but their interface/API decisions are marked active in the registry.

**Required resolution:** Either accept the ADRs through the normal decision workflow or mark their registry entries proposed/pending so programmers cannot treat Beta contracts as Accepted implementation rules.

---

### C18. Master architecture and systems index assign different layers

**Severity:** LOW  
**Status:** Resolved (2026-08-05)
**Documents:**

- `design/gdd/systems-index.md:13-33`
- `docs/architecture/architecture.md:74-96`

**Conflict:**

Systems index places Multiplayer in Foundation and AI/Pit/Qualifying/Grid in Core. Master architecture places all five in Feature.

**Required resolution:** Select one layer taxonomy or explicitly document that “design category” and “architecture layer” are different dimensions.

---

### Previously Reported Conflicts Now Resolved

| Conflict | Resolution |
|---|---|
| Coherence simultaneously selected and deferred | Resolved: technical preferences, ADR-0016/0017, and master architecture now keep it unselected |
| Pit enum divergence across active ADRs | Resolved in ADRs/master architecture with `PitPhase`; registry remains stale |
| Camera FOV range mismatch | Resolved at 70–90° Chase and 78–95° Cockpit; blend timing remains unresolved |
| TeamColor and CockpitOffset absent from CarDefinition | Resolved in ADR-0015 and GDD; registry remains stale |
| Audio profile field-name divergence | Resolved with `EngineCylinders`, `EngineBasePitch`, and `ExhaustNote` |
| Control manifest ForceMode/PitServiceCommand/LateUpdate rules | Resolved in the current control manifest; architecture registry still conflicts |

---

## 7. ADR Dependency Order

### Declared Dependency Graph

| ADR | Depends On |
|---|---|
| ADR-0001 | None |
| ADR-0002 | 0001 |
| ADR-0003 | 0001 |
| ADR-0004 | 0001 |
| ADR-0005 | 0001, 0004 |
| ADR-0006 | 0001, 0002 |
| ADR-0007 | 0003, 0006 |
| ADR-0008 | 0001, 0002 |
| ADR-0009 | 0001, 0002, 0006, 0007 |
| ADR-0010 | 0001, 0002, 0006, 0007 |
| ADR-0011 | 0002, 0005, 0006, 0007, 0009, 0010 |
| ADR-0012 | 0001, 0002, 0003, 0004, 0006, 0010 |
| ADR-0013 | 0001, 0006, 0009, 0011 |
| ADR-0014 | 0001, 0002, 0006, 0010 |
| ADR-0015 | 0002, 0006, 0012 |
| ADR-0016 | 0001, 0008 |
| ADR-0017 | 0001, 0005, 0006, 0008, 0016 |

### Topological Layers

```text
Layer 0: ADR-0001
Layer 1: ADR-0002, ADR-0003, ADR-0004
Layer 2: ADR-0005, ADR-0006, ADR-0008
Layer 3: ADR-0007, ADR-0016
Layer 4: ADR-0009, ADR-0010, ADR-0017
Layer 5: ADR-0011, ADR-0012, ADR-0014
Layer 6: ADR-0013, ADR-0015
```

Valid topological order:

```text
0001
→ 0002, 0003, 0004
→ 0005, 0006, 0008
→ 0007, 0016
→ 0009, 0010, 0017
→ 0011, 0012, 0014
→ 0013, 0015
```

### Dependency Verdict

- **Cycles:** None.
- **Missing declared ADR dependency:** None producing a graph cycle or unresolved node.
- **Semantic dependency concerns:**
  - ADR-0011 lacks a formal Pit Stop-to-Vehicle Physics phase-transition request.
  - ADR-0017 requires a future Camera/HUD correction contract before Beta implementation.
  - ADR-0016/0017 are Proposed but represented as active registry stances.
  - ADR-0006’s pipeline listing conflicts with its root dependency, ADR-0001.

---

## 8. GDD Revision Flags

These flags are based on GDD `Last Updated` metadata being newer than the primary addressing ADR’s date/amendment metadata. This does not prove incompatibility; it means the architecture needs explicit confirmation.

| GDD | GDD Last Updated | Primary ADR(s) | Latest relevant ADR metadata | Flag reason | Recommended action |
|---|---|---|---|---|---|
| `input-system.md` | 2026-08-01 | ADR-0005 | 2026-07-27 | Input sanitization and revised lifecycle text postdate ADR | Mark Needs Review |
| `simulation-architecture.md` | 2026-08-01 | ADR-0001 | Amended 2026-07-25 | Current 14-step and lifecycle GDD postdate root ADR metadata | Mark Needs Review |
| `content-pipeline.md` | 2026-08-01 | ADR-0003 | 2026-07-27 | New PC/Web load ceilings are absent from ADR-0003 | Mark Needs Review |
| `race-session-manager.md` | 2026-08-01 | ADR-0001 | Amended 2026-07-25 | Ranking and classification detail postdate root architecture | Mark Needs Review |
| `grid-start.md` | 2026-08-01 | ADR-0001, ADR-0007 | 2026-07-27 | Perfect Start arming and Qualifying Results details remain untraced | Mark Needs Review |
| `ui-menu.md` | 2026-08-01 | ADR-0001, 0003, 0004, 0005 | 2026-07-27 | Current Qualifying Results terminology and non-stack navigation postdate ADRs | Mark Needs Review |

`systems-index.md` was not modified during this review.

---

## 9. Engine Compatibility Audit

### Installed Package Verification

Live Unity inspection confirmed:

| Component | Installed |
|---|---|
| Unity | 6000.3.19f1 |
| URP | 17.3.0 |
| Input System | 1.19.0 |
| Addressables | 3.1.0 |
| AI Navigation | 2.0.14 |
| Unity Test Framework | 1.6.0 |
| uGUI | 2.0.0 |
| Real-time networking SDK | None |
| DOTS/Entities | Not installed |
| Cinemachine | Not installed |
| VFX Graph | Not installed |

### API Verification

The running editor confirmed:

- `Physics.simulationMode` is writable and not obsolete.
- `Physics.Simulate(float)` exists and is not obsolete.
- `Rigidbody.linearVelocity`, `linearDamping`, `maxLinearVelocity`, and `interpolation` exist.
- Input System `UpdateMode` contains `ProcessEventsInDynamicUpdate`.
- `Screen.SetResolution(..., RefreshRate)` is current; integer refresh-rate overloads are obsolete.
- `FullScreenPassRendererFeature` exists in URP 17.3.
- `MotionBlur`, `MotionBlurQuality`, and their Volume fields exist.
- `ScriptableRenderPass.RecordRenderGraph` is current.
- `ScriptableRenderPass.Execute` is obsolete compatibility-mode behavior.
- Non-`_3D` `AudioClip.Create` overloads exist; `_3D` overloads are obsolete.
- `Physics.SphereCast` exists.
- Addressables types are loaded, and `AsyncOperationHandle.GetDownloadStatus()` is available for byte download status.

### Per-ADR Engine Assessment

| ADR | Result | Notes |
|---|---|---|
| ADR-0001 | PASS | Manual physics APIs and interpolation properties confirmed; performance remains empirical |
| ADR-0002 | PASS | Renamed Rigidbody APIs confirmed; ForceMode conflict is registry drift, not API absence |
| ADR-0003 | CONCERN | Addressables APIs exist; byte-progress and WebGL memory/load assumptions need correction and measurement |
| ADR-0004 | PASS | `RefreshRate` and current SetResolution overload confirmed |
| ADR-0005 | PASS | Input System update-mode names confirmed |
| ADR-0006 | PASS | Pure C# domain logic |
| ADR-0007 | CONCERN | Runtime JSON schema requires a real `float3[]` deserialization fixture; “JSONNode internally” claim is unsupported |
| ADR-0008 | PASS, non-engine FAIL | No Unity dependency; binary arithmetic is internally inconsistent |
| ADR-0009 | PASS | Pure C# AI and PCG32 boundary |
| ADR-0010 | PASS | URP RenderGraph, FullScreenPass, MotionBlur, ParticleSystem, and SphereCast APIs confirmed |
| ADR-0011 | PASS | Pure C# state machine; interface gap is architectural |
| ADR-0012 | CONCERN | Audio APIs exist; audio-thread handoff and ≤0.1/0.4 ms budgets require prototype evidence |
| ADR-0013 | PASS | Pure gameplay logic |
| ADR-0014 | PASS | uGUI package installed and stable |
| ADR-0015 | PASS, contract concern | ScriptableObjects supported; validation algorithm needs correction |
| ADR-0016 | PASS | No online-services or real-time SDK is installed, matching the decision |
| ADR-0017 | CONCERN/DEFERRED | No SDK-specific API is adopted; WebGL transport, rollback cost, and clock policy remain empirical Beta gates |

### Engine Compatibility Issues

#### E1. Addressables progress semantics

`adr-0003:245` requires progress derived from total bytes, while its requirement mapping uses `AsyncOperationHandle.PercentComplete`. Byte semantics should use download status or explicitly be redefined as operation progress.

#### E2. Track JSON deserialization

`adr-0007:141` asserts details about `JsonUtility` internals and direct `float3[]` deserialization that are not validated by the engine-reference corpus. A round-trip fixture with representative Track JSON is required before schema freeze.

#### E3. WebGL budgets remain estimates

ADR-0003’s memory and first-load estimates have no representative WebGL build evidence. The 4 GB upper heap capability is not an acceptable operating budget.

#### E4. Procedural audio thread handoff

`adr-0012:201-202` correctly recognizes that PCM callbacks run off the main thread. The chosen lock-free handoff and its cost must be proven before the procedural provider becomes production architecture.

#### E5. Beta networking remains unverified

ADR-0017 appropriately defers numeric reliability windows, but whole-scene replay compatibility, browser transport, bandwidth, and rollback CPU cost remain unresolved.

### Engine Specialist Findings

The required `unity-specialist` Task consultation was completed by the orchestrator after the subagent hit the subagent-depth limit. The specialist confirmed, against live reflection on Unity 6000.3.19f1, all audit items: installed package versions match declarations, `Physics.simulationMode`/`Physics.Simulate` non-obsolete, `Rigidbody.linearVelocity`/`linearDamping`/`maxLinearVelocity` present, Input `ProcessEventsInDynamicUpdate` verified, `Screen.SetResolution(..., RefreshRate)` current (int-refresh overloads obsolete), URP RenderGraph + `FullScreenPassRendererFeature` + `MotionBlur`/`MotionBlurQuality` present, non-`_3D` `AudioClip.Create` overloads current, `SphereCast` exists, `AsyncOperationHandle.GetDownloadStatus()` available for byte progress. E1–E5 below remain as measurement/validation CONCERNS, not API-absence failures.

---

## 10. Architecture Document Coverage

### Systems Coverage

All 21 systems in `design/gdd/systems-index.md` appear in the master architecture:

- Input
- Simulation
- Settings
- Content Pipeline
- Ghost Recording
- Multiplayer Architecture
- Vehicle Physics
- Camera
- HUD
- Audio
- Fuel
- Tire
- Pit Stop
- Qualifying
- AI Rival
- Track
- Car Definition Data
- Race Session Manager
- Grid & Start
- VFX
- UI Menu

**Missing systems:** None.  
**Orphaned architecture systems:** None.

### Coverage Drift

#### A1. Layer taxonomy mismatch

`systems-index.md:13-33` and `architecture.md:74-96` disagree on Multiplayer, AI Rival, Pit Stop, Qualifying, and Grid & Start layer placement.

#### A2. “Required ADRs” section is stale

`architecture.md:580-589` says all 15 ADRs are complete and lists an incomplete layer-to-ADR map:

- Feature lists only ADR-0009 and omits ADR-0013.
- Presentation omits ADR-0014.
- Core/data mapping omits ADR-0015.
- ADR-0016/0017 exist but their Proposed status is not represented in this audit section.

#### A3. Traceability totals are stale

`architecture.md:569-579` references superseded traceability counts and matrices. The current review has 144 requirements, not the prior 194-row superseded result or the 87-entry registry baseline alone.

#### A4. Architecture registry is stale

`docs/registry/architecture.yaml` contains outdated ForceMode, pit vocabulary, audio timing, CarDefinition schema, simulation-step count, and network-clock claims.

#### A5. TR registry metadata is stale

`docs/architecture/tr-registry.yaml:27-29` says `last_updated: 2026-07-28`, although several entries have `revised: 2026-08-05`. It contains 87 active entries before the 57 proposed additions, not the approximate 76 stated in initial context.

### Architecture Coverage Verdict

**CONCERNS:** System enumeration is complete, but the master ADR audit, layer map, architecture registry, and traceability references are not synchronized with current authority documents.

---

## 11. Blocking Issues

The following block a PASS verdict:

1. **Canonical input ordering is contradictory.**  
   Resolve ADR-0001/0006/master architecture before Simulation or Input implementation.

2. **Content load error severity is ambiguous.**  
   Separate recoverable degraded-car loading from aborting load errors.

3. **Ghost binary format is not implementable as written.**  
   Correct the 72/80-byte discrepancy and the valid maximum tick rule.

4. **Architecture registry contradicts accepted ForceMode authority.**  
   Correct the active stance before programmers consume the registry.

5. **ADR-0017 rollback does not isolate whole-scene physics effects.**  
   ADR-0017 must remain Proposed until a safe reconciliation model is defined.

6. **Engine-specialist consultation** — resolved: completed by the orchestrator via `unity-specialist` Task; all Phase 5 audit items confirmed with live reflection evidence. E1–E5 remain measurement concerns (Addressables byte-progress, Track JSON fixture, WebGL budgets, audio-thread handoff, Beta networking).

7. **Current architecture-critical GDD revisions have not been acknowledged.**  
   Input, Simulation, Content, RSM, Grid, and UI require explicit Needs Review/confirmed-current decisions.

---

## 12. Required ADRs and Amendments

### Required Before Foundation/Core Implementation

1. **ADR-0001/ADR-0006 Amendment: Canonical Input Capture and Tick Assembly**
   - Once-per-render-frame capture before accumulator.
   - Snapshot assembly position.
   - Removal of obsolete InputEventQueue language.

2. **ADR-0003 Amendment: Content Error Severity, Progress, and Load Budgets**
   - Recoverable car-degradation event.
   - Aborting error event.
   - Byte versus operation progress.
   - PC/Web load ceilings and measurement conditions.

3. **ADR-0008 Amendment: Ghost Header Layout and Overflow Semantics**
   - Exact byte offsets.
   - Header size.
   - CRC coverage.
   - Valid 22,500-tick behavior.

4. **ADR-0002 Amendment: Production Vehicle Formula Set**
   - Engine-power/quadratic-drag acceleration.
   - Drift activation and drift-heading behavior.
   - Lift-off arming contract.
   - Wall-angle threshold.

5. **Race Ranking and Grid Start ADR or ADR-0001/0005 Amendment**
   - RSM ranking/tie-break algorithm.
   - Perfect Start GO-12 window and thresholds.
   - Confirm-only Qualifying Results contract.

6. **ADR-0015 Amendment: Current Car Validation**
   - Integer `[0,20]` clamping.
   - Correct differentiation condition and metric.

7. **ADR-0006 Amendment or Tire Compound Data ADR**
   - TireCompound ScriptableObject schema and ownership.

### Required Before ADR-0017 Acceptance or Beta Implementation

8. **Rollback Isolation and Corrective Presentation ADR**
   - Whole-scene versus isolated replay.
   - State restore scope.
   - Collision handling.
   - Camera/HUD correction metrics.
   - CPU budget.

9. **Network Clock and Input Reliability Selection ADR**
   - Concrete SDK.
   - Clock source and synchronization.
   - `W_drop`, `W_rollback`, jitter, redundancy, and timeout measurements.

10. **Disconnect and Session Recovery ADR**
    - Reconnection attempts.
    - Snapshot resynchronization.
    - AI takeover.
    - Room destruction and race validity.

### Optional / UX-Owned Decision

11. **UI Presentation Architecture ADR**
    - Only required if the 15-RPM car turntable and Garage Lit scene are considered cross-screen technical contracts rather than UX/art implementation detail.

---

## 13. Final Verdict

# Verdict: FAIL

Coverage is high enough to proceed with document correction, but the project is **not architecture-ready for production implementation**.

> **Resolution note (2026-08-05, post-review):** All 18 conflicts (C1–C18)
> were resolved in-session after this report was written. See the resolution
> log in `production/session-state/active.md` and the per-conflict status lines
> above. C1–C4 fixed in ADR-0001/0003/0006/0008/0015, architecture.md,
> docs/registry/architecture.yaml and content-pipeline.md. C5 resolved by
> emending ADR-0017 D4 (full kinematic restore of all 16 cars per replay
> frame); ADR-0016 and ADR-0017 were Accepted. C6–C18 resolved per decision
> log. The FAIL verdict reflects the state at review time; re-run
> `/architecture-review full` to confirm the corrected state.

The FAIL is driven by five open HIGH-severity technical conflicts:

- input sampling order;
- content failure semantics;
- ghost binary layout;
- ForceMode registry authority;
- Beta whole-scene rollback.

### Gate Guidance

- **Do not begin Foundation implementation** until C1, C2, C3, and C4 are resolved.
- **Do not accept ADR-0017** until C5 has an empirically testable isolation model.
- Presentation stories may continue only where they do not depend on disputed lifecycle or snapshot boundaries.
- ADR drafting and registry cleanup may proceed immediately.
- Rerun `/architecture-review full` after the blocking ADR/registry corrections are complete.
