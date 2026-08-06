# Overdrive — Master Architecture

## Document Status
- **Version:** 7 (regenerated 2026-08-06 by the formal /create-architecture full after the v6 architecture review)
- **Last Updated:** 2026-08-06
- **Engine:** Unity 6000.3.19f1 (Unity 6.3 LTS)
- **GDDs Covered:** 21 MVP GDDs (all APPROVED)
- **ADRs Referenced:** 19 Accepted ADRs (0001-0019); ADR-0016 and ADR-0017 are Accepted selection-boundary documents (network driver interface, Alpha services / Beta real-time); ADR-0018 (RSM Authority) and ADR-0019 (UI Presentation) Accepted 2026-08-05. See `docs/architecture/control-manifest.md` for the Accepted-ADR rules sheet and `docs/architecture/` for individual ADRs.
- **Technical Director Sign-Off:** 2026-07-27 — APPROVED WITH CONDITIONS. All 5 Foundation ADRs now exist (0001, 0003, 0004, 0005, 0008). Conditions met.
- **Technical Director Sign-Off (v7 regeneration):** 2026-08-06 — APPROVED. TD-ARCHITECTURE self-review: 144/144 TRs covered, HIGH-risk domains flagged, boundaries implementable, Foundation gaps 0.
- **Lead Programmer Feasibility:** 2026-08-06 — FEASIBLE. LP-FEASIBILITY: 0 BLOCKING; 5 MAJOR + 7 MINOR items all resolved in v7 (SimulationInput, GameState, PitServiceCommand, SimulationRollbackState defined; wrapper template; ContentErrorType; deprecated-API notes).

---

## Engine Knowledge Gap Summary

**Engine:** Unity 6000.3.19f1 — LLM training cutoff ~May 2025, release July 2026 (~14 month gap)

### Verified Against Engine Reference + Runtime Reflection

| Domain | Risk | Status | Evidence |
|--------|------|--------|----------|
| Physics API renames | HIGH | ✅ Verified | `Rigidbody.linearVelocity`, `linearDamping`, `angularDamping` confirmed via `unity_reflect`. `velocity`, `drag`, `angularDrag` are `obsolete_members` |
| Physics.Simulate Script mode | HIGH | ✅ Verified | `Physics.simulationMode = SimulationMode.Script` — `SimulationMode` enum exists. `Physics.Simulate(float step)` confirmed with accumulator example |
| URP RenderGraph | HIGH | ✅ Verified | Breaking-changes.md confirms `RecordRenderGraph` path. Old `ScriptableRenderPass.Execute` is compatibility mode |
| Input System 1.19.0 | MEDIUM | 📄 Referenced | Patterns captured in engine reference docs. Package-specific API not re-verified |
| Addressables 3.1.0 | MEDIUM | 📄 Referenced | Patterns captured in engine reference docs |
| WebGL (ASTC, heap) | MEDIUM | ✅ Verified | Wasm heap up to 4GB, ASTC as extension. Captured in CONSTRAINTS #1534 |
| Unity.Mathematics | LOW | ✅ Core | Core Unity 6 package, available without explicit installation — sim-path math (float3, quaternion) |

### Systems touching HIGH risk domains (flagged throughout):
- **Vehicle Physics** → Physics API (velocity→linearVelocity renames)
- **Simulation Architecture** → Physics.Simulate, SimulationMode.Script
- **Camera** → Physics collision avoidance (SphereCast)
- **VFX** → URP RenderGraph (custom post-process passes)

---

## System Layer Map

```
┌──────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                      │
│  Camera · HUD · Audio · VFX · UI Menu                    │
├──────────────────────────────────────────────────────────┤
│  FEATURE LAYER                                           │
│  AI Rival · Pit Stop · Qualifying · Grid & Start          │
│  Multiplayer Architecture (ADR-only in MVP)               │
├──────────────────────────────────────────────────────────┤
│  CORE LAYER                                              │
│  Vehicle Physics · Fuel System · Tire System              │
│  Track System · Car Definition Data · Race Session Mgr    │
├──────────────────────────────────────────────────────────┤
│  FOUNDATION LAYER                                        │
│  Input System · Simulation Architecture · Settings         │
│  Content Pipeline · Ghost Recording                       │
├──────────────────────────────────────────────────────────┤
│  PLATFORM LAYER                                          │
│  URP 17.3.0 · Physics 3D · Input System 1.19.0           │
│  Addressables 3.1.0 · uGUI · AI Navigation 2.0.14        │
└──────────────────────────────────────────────────────────┘
```

### Layer Definitions

**Platform Layer:** Unity engine API surface. Packages installed and configured: URP 17.3.0 for rendering, Physics 3D for simulation, Input System 1.19.0 for input, Addressables 3.1.0 for content management, uGUI for runtime UI, AI Navigation 2.0.14 for future pathfinding. Not installed (out of scope for MVP): DOTS/Entities, Netcode, Cinemachine, VFX Graph.

**Foundation Layer:** Infrastructure systems that everything else depends on. Input System captures raw device input and produces `SimulationInput` per tick. Simulation Architecture owns the 14-step tick pipeline, state machine (Idle→Loading→Countdown→Racing→Finished→Paused→Results), and all immutable snapshots. Settings provides persistence, profile migration, and transactional preview. Content Pipeline manages Addressables groups, loading order, and memory budgets. Ghost Recording captures the recordable SimulationInput buffer for future replay (Alpha+ persistence).

**Core Layer:** Gameplay simulation systems. Vehicle Physics is the architectural bottleneck — 10 downstream systems depend on it. Fuel and Tire own their consumption/wear models and expose state to Pit Stop, HUD, AI, and Audio. Track System provides spline geometry, surface zones, and pit lane layout (F1 two-lane model). Car Definition Data is a static data layer (ScriptableObject assets, one per team). Race Session Manager owns the race lifecycle, position ranking, and finish resolution.

**Feature Layer:** Gameplay features built on Core. AI Rival controls 15 opponents with 4 archetypes, deterministic PCG32 noise, and state-based behavior. Pit Stop manages service logic (tire swap + fuel fill in parallel) and the player pit advisory. Qualifying is a RaceMode variant within SimulationState.Racing (no Countdown, no tire wear, single flying lap). Grid & Start manages 16-car grid formation, 5-light Countdown, and Perfect Start evaluation. Multiplayer Architecture is ADR-only in MVP.

**Presentation Layer:** Visual and audio output. Camera provides two modes (Cockpit default/primary per ADR-0010, Chase as accessibility/spectacle option), FOV response, three additive angular shake layers clamped at 3.0° total, and collision avoidance (preserved during PerformanceReduced). HUD renders 8 chase elements with strict readability targets (0.5s at 200 km/h, max 2 items per glance); HUD consumes only PublishedSimulationSnapshot (ADR-0014 — no direct system reads). Audio drives procedural engine model (two-oscillator), SFX (tire squeal, wall impact, wind), and music stings across a 9-state audio machine mirroring SimulationState. VFX produces speed streaks, motion blur, tire smoke, sparks, and vignette within the 2.25ms planned / 2.4ms ceiling camera+VFX budget (ADR-0010). UI Menu manages screen flow, navigation (keyboard + gamepad + pointer), and all menu state per ADR-0019.

### System-to-Layer Table

> **Layer taxonomy note (2026-08-05):** The `Layer` column here is an
> **implementation-layer dimension** (Foundation = always-on plumbing, Core =
> simulation domain, Feature = optional/conditional systems, Presentation =
> output consumers). `design/gdd/systems-index.md` uses a **design-category
> dimension** (Foundation/Core/Presentation for design ordering), which is why
> Multiplayer, AI Rival, Pit Stop, Qualifying, and Grid & Start are assigned
> differently across the two documents. Both dimensions are valid and
> intentional; they answer different questions (how systems are built vs how
> design work is ordered). Do not "reconcile" them into a single taxonomy.

| System | Layer | GDD | Dependencies |
|--------|-------|-----|-------------|
| Input System | Foundation | input-system.md | — |
| Simulation Architecture | Foundation | simulation-architecture.md | Input System |
| Settings | Foundation | settings.md | Input System |
| Content Pipeline | Foundation | content-pipeline.md | — |
| Ghost Recording | Foundation | ghost-recording.md | Simulation Architecture |
| Vehicle Physics | Core | vehicle-physics.md | Simulation Architecture, Car Def Data |
| Fuel System | Core | fuel-system.md | Vehicle Physics, Car Def Data |
| Tire System | Core | tire-system.md | Vehicle Physics, Car Def Data |
| Track System | Core | track-system.md | Content Pipeline |
| Car Definition Data | Core | car-definition-data.md | Content Pipeline |
| Race Session Manager | Core | race-session-manager.md | Simulation Architecture, Track |
| AI Rival | Feature | ai-rival.md | RSM, Track, Car Def Data, Settings |
| Pit Stop | Feature | pit-stop.md | Fuel, Tire, Track, RSM |
| Qualifying | Feature | qualifying.md | RSM, Grid & Start, Fuel |
| Grid & Start | Feature | grid-start.md | RSM, Track, Car Def Data |
| Multiplayer Architecture | Feature | multiplayer-architecture.md | Simulation Architecture |
| Camera | Presentation | camera.md | Simulation Architecture, Vehicle Physics |
| HUD | Presentation | hud.md | RSM, VP, Fuel, Tire, Simulation |
| Audio | Presentation | audio-system.md | Vehicle Physics, Camera |
| VFX | Presentation | vfx.md | Vehicle Physics, Camera, Settings |
| UI Menu | Presentation | ui-menu.md | Simulation, Content Pipeline, Input |

---

## Module Ownership

### Foundation Layer

#### Input System

| Aspect | Definition |
|--------|-----------|
| **Owns** | `RawInputSample` capture, dead-zone normalization, EMA smoothing, `SimulationInput` production, `OverdriveGameplay`/`OverdriveUI` action map lifecycle, `ActiveControlScheme` arbitration, `InputContextController` (sole owner of context transitions) |
| **Exposes** | `CaptureLatestRawSample()` — called by Simulation once per frame before accumulator. `GameplayInputContext` / `UIInputContext` active state. Binding override storage |
| **Consumes** | `InputSystem_Actions.inputactions` asset (project asset), Settings control profile (dead-zone thresholds, EMA alphas) |
| **Engine APIs** | `InputActionAsset`, `InputActionMap.Enable()/Disable()`, `InputAction.performed` (CameraToggle), `InputSystemUIInputModule`. All verified via Input System 1.19.0 reference docs |

#### Simulation Architecture

| Aspect | Definition |
|--------|-----------|
| **Owns** | `SimulationState` (sole writer), 14-step tick pipeline ordering, `FIXED_DT = 1/60s` accumulator, `Physics.simulationMode = SimulationMode.Script`, all 4 immutable snapshots (`TickStartSnapshot`, `PublishedSimulationSnapshot`, `PostFinishSnapshot`, `ReplayInitialState`), `simulationStepCount`/`activeRaceStepCount`, `countdownRemainingTicks`, focus-loss lifecycle boundary, performance monitor, PCG32 RNG instance |
| **Exposes** | `PublishedSimulationSnapshot` (read-only per tick), `SimulationState`, `RaceMode`, `TransitionRequest` queue, `PerformanceReduced`/`PerformancePaused` signals |
| **Consumes** | Input's `CaptureLatestRawSample()`, Content Pipeline's `RaceLoadReady`/`ContentLoadError`, AI Rival's cached `AIInput[]`, RSM's `TransitionRequest` |
| **Engine APIs** | `Physics.simulationMode = SimulationMode.Script` (✅ verified), `Physics.Simulate(FIXED_DT)` (✅ verified), `Time.unscaledDeltaTime`, `Application.focusChanged`. HIGH RISK: all verified against Unity 6000.3 runtime |

#### Settings

| Aspect | Definition |
|--------|-----------|
| **Owns** | `PlayerPrefs` blob `"OverdriveSettings"` + backup `"OverdriveSettings_Backup"`, schema migration (v1→v3), `SettingsEditSession` (snapshot + working + preview), `DisplayConfirm` timer, 5 DifficultyProfile data, control profile validation |
| **Exposes** | Immutable `DifficultyProfile` (snapshotted at race init), `ControlProfile` (dead zones, alphas, bindings), `QualitySettings` preset, per-system setting values |
| **Consumes** | Input System binding IDs (stable after first shipped schema) |
| **Engine APIs** | `PlayerPrefs.SetString/GetString`, `Screen.SetResolution` (use the `RefreshRate` overload — integer-refresh overloads are obsolete in 6000.3, deprecated-apis.md:15). No HIGH risk APIs |

#### Content Pipeline

| Aspect | Definition |
|--------|-----------|
| **Owns** | Addressables group topology (`Shared/`, `Cars/{teamId}/`, `Tracks/{trackId}/`), loading order (parallel track + 16 cars), memory budget enforcement, CP_ state machine, `UnloadRace()` lifecycle, error handling (car skip, track abort, fatal shared failure) |
| **Exposes** | `RaceLoadReady(RaceMode, gridAssignment)`, `ContentLoadError(reason)`, `RaceReconfigureStart`, `ContentUnloadComplete`, per-car/track loading progress |
| **Consumes** | `GridAssignment` from RSM (via TransitionRequest), track/car asset keys from selection |
| **Engine APIs** | `Addressables.LoadAssetAsync<T>()`, `Addressables.ReleaseInstance()`, `Addressables.Release()`, `QualitySettings.globalTextureMipmapLimit`. MEDIUM RISK (Addressables 3.1.0 package) |

#### Ghost Recording

| Aspect | Definition |
|--------|-----------|
| **Owns** | In-memory recordable buffer (12 bytes/tick × 22,500 cap + EdgeEvent stream), buffer lifecycle (discard on Results/Forfeit/Idle), 80-byte binary header format, integrity CRC32 |
| **Exposes** | (MVP) None — buffer is internal and always discarded. Alpha: `GhostFile` serialization, local cache, upload/download via the Alpha-selected storage interface (ADR-0016) |
| **Consumes** | `SimulationInput` per Racing tick (from Simulation), `Pause` edge events, `ReplayInitialState` (captured at GO) |
| **Engine APIs** | None in MVP (pure memory buffer). Alpha deferred |

### Core Layer

#### Vehicle Physics

| Aspect | Definition |
|--------|-----------|
| **Owns** | `ResolvedCarInput[carId]` consumption, 5 car states (Driving/OffTrack/WallHit/Pitting/GridLocked), `effective_grip` multiplicative stack (grip_base × surface × tire), `longitudinalDriveForceFinal` with perfect-start multiplier, high-speed steer reduction, lift-off rotation assist, wall contact cooldown, collision response (speed loss + push impulse), per-tick `CarState[16]` production |
| **Exposes** | `CarState` per car per physics tick: position, rotation, speed, throttle, brake, steer, gripState, forwardDot, isGridLocked, rpm, gear, wallContact, slideState, surface, pitPhase |
| **Consumes** | `SimulationInput.accelerateOut/brakeOut/steerOut`, `tire_runtime_grip_multiplier` (Tire), fuel state + low-fuel modifier (Fuel), `surface_grip_multiplier` (Track), `AIInput` (AI Rival), grid_lock state (Simulation) |
| **Engine APIs** | `Rigidbody.linearVelocity` (✅), `linearDamping` (✅), `angularDamping` (✅), `AddForce()` (ForceMode.Force or raw acceleration only — never Acceleration/Impulse: implicit mass multiply, deprecated-apis.md:29), `MovePosition()`, `interpolation = None`. HIGH RISK: all verified |

#### Fuel System

| Aspect | Definition |
|--------|-----------|
| **Owns** | `fuel_consumption_rate` (base_rate 0.06 L/s × throttle × efficiency_modifier), 4 fuel states (Full/Conserving/Critical/Empty), per-lap `last_lap_fuel_use` accumulator, low-fuel speed bonus (+1% top speed below 25%) |
| **Exposes** | `FuelState` per car: current_fuel, fuel_fraction, fuel_state_enum, low_fuel_active. `last_lap_fuel_use[carId]` for Pit Stop and AI Rival |
| **Consumes** | Throttle from `ResolvedCarInput[carId]` (Tick Step 5), `efficiency_modifier` from Car Definition Data, `LapCompleted` events from RSM |
| **Engine APIs** | Pure C# math |

#### Tire System

| Aspect | Definition |
|--------|-----------|
| **Owns** | `tire_wear_rate`, `tire_runtime_grip_multiplier` (base × (1 - wear_fraction × (1 - grip_floor))), grip_floor = 0.20, `TireCompound` ScriptableObject, per-lap `last_lap_tire_wear` accumulator |
| **Exposes** | `TireState` per car: wear_fraction (0.0–1.0), runtime_grip_multiplier, compound_name. `last_lap_tire_wear[carId]` for Pit Stop and AI Rival |
| **Consumes** | Surface, speed, slideState from `TickStartSnapshot` (Step 5), `efficiency_modifier` from Car Definition Data, `LapCompleted` from RSM |
| **Engine APIs** | Pure C# math. `TireCompound` is a `ScriptableObject` asset |

#### Track System

| Aspect | Definition |
|--------|-----------|
| **Owns** | Spline geometry JSON, pit lane definition (fast lane + 16 offset boxes), surface modifier tables (grip + wear), grid positions (16 × 8m rows, 3.5m cols), `CrossedLapBoundary()`, pit-entry zone geometry, racing→pit spline progress mapping |
| **Exposes** | `surface_grip_multiplier[carId]`, `pit_entry_progress`, pit→racing progress mapping, `track_length`, `reference_flying_lap_time`, racing line spline (for AI), grid transforms |
| **Consumes** | GeoJSON/GPX source → conversion pipeline → JSON asset loaded via Addressables |
| **Engine APIs** | `Vector3` math, static colliders for barriers. No Rigidbody API risk |

#### Car Definition Data

| Aspect | Definition |
|--------|-----------|
| **Owns** | 16 `ScriptableObject` assets (6 stats each 0–20, engine audio profile), the **raw stat values** (data — not behavior formulas; per ADR-0015 the consuming system owns each stat-to-behavior formula: Vehicle Physics owns Top Speed / Acceleration / Brake Power / Grip Level / Stability; Fuel/Tire owns Efficiency), `efficiency_modifier` schema definition (consumed by Fuel/Tire), `global_max_velocity` runtime computation (for VFX) |
| **Exposes** | Per-car: 6 stat values, computed metrics, engine audio profile. `global_max_velocity = max(all car top speeds)` for VFX |
| **Consumes** | None — static data loaded at race start via Addressables `Cars/{teamId}` |
| **Engine APIs** | `ScriptableObject`, loaded via `Addressables.LoadAssetAsync<CarDefinition>()`. MEDIUM RISK |

#### Race Session Manager

| Aspect | Definition |
|--------|-----------|
| **Owns** | `GameState` (lapCount, position, raceTime, lapTimes[], totalDistance, isFinished, isPitting, raceMode, resultKind, splinePositions[16] — per-car fractional spline progress for Track Map dots and position ranking), `position_ranking` (lapCount DESC → splinePosition DESC → entryStep ASC → carId ASC), `FinishOrderResolver` (pace-only projection), `LapCompleted`/`PositionChanged`/`PitEntry`/`PitExit`/`RaceFinished` events, `TransitionRequest` production, `GridAssignment` creation |
| **Exposes** | `GameState` per tick (via PublishedSimulationSnapshot), race events to Fuel, Tire, AI, Pit Stop, HUD, Camera. `TransitionRequest` to Simulation |
| **Consumes** | `RaceMode` from Content Pipeline, lap detection from Track + distance gate, per-lap deltas from Fuel and Tire, position from `position_ranking` |
| **Engine APIs** | Pure C# logic |

### Feature Layer

| System | Owns | Exposes | Consumes | Engine APIs |
|--------|------|---------|----------|-------------|
| **AI Rival** | 15 AI drivers, 4 archetypes, PCG32 deterministic noise, racing line following, overtake + defend probability, error generation, pit projection (1.10× margin), state machine | Cached `AIInput[carId]` per tick | `PublishedSimulationSnapshot`, Track racing line, Car Def stats, `DifficultyProfile`, `LapCompleted`/pit events from RSM | Pure C# + PCG32 RNG |
| **Pit Stop** | 4 pit states, pit lane speed clamp (80 km/h), tire swap (2s) + fuel fill (0.8 L/s) parallel, player exit (after 2s), AI full tank, `player_pit_advisory`, pit box assignment | `PitState` per car, `PitThisLap` flag | `FuelState`, `TireState`, `pit_entry_progress` from Track, `PitEntry`/`PitExit`/`LapCompleted` from RSM | Pure C# logic |
| **Qualifying** | RaceMode variant, single flying lap, qualifying fuel load, AI time gen (PCG32), `GridAssignment`, Pit blocked, no tire wear | `GridAssignment` (via RSM) | `RaceMode.Qualifying`, `DifficultyProfile`, track `reference_flying_lap_time`, Car Def stats | Pure C# + PCG32 |
| **Grid & Start** | 16-car grid (8 rows × 2), 5-light Countdown (300 ticks), grid-lock, Perfect Start evaluation (GO-12 through GO, 1.15× for 600 ticks) | `PerfectStartResult{active, remainingTicks}` | `GridAssignment`, grid transforms from Track | Pure C# logic |
| **Multiplayer Arch** | (ADR-only MVP) — MVP has no provider. Alpha selects online services for identity/ghost sharing; Beta separately selects real-time racing SDK. MVP defines a transport-independent simulation boundary only | Network phase enum (MVP: Disconnected) | Architecture constraints, no runtime deps in MVP | None in MVP |

### Presentation Layer

| System | Owns | Exposes | Consumes | Engine APIs |
|--------|------|---------|----------|-------------|
| **Camera** | 2 modes (Cockpit/Chase), FOV response (quadratic, 78-95°/70-90°), 3-layer shake (clamped 3.0°), Chase look-ahead (velocity direction × speed × lookAheadFactor, quadratic ~0.5-3 m; none in Cockpit — TR-camera-004), 0.35s transitions, SphereCast collision avoidance, PitCamera, terminal presentation blend, CameraToggle routing | Camera transform + FOV + mode per frame | Interpolated car transform from Simulation, `PublishedSimulationSnapshot`, `impactShakeRequest` from VFX, Settings (shake, Reduced Motion) | `Camera`, `Physics.SphereCast()` (✅ verified) |
| **HUD** | 8 chase + 4 cockpit elements, 7 states, team color tinting, 85% opacity, 150ms transitions, Track Map rendering, `PIT THIS LAP` advisory | Rendered screen-space canvas output | `PublishedSimulationSnapshot` only (ADR-0014 snapshot-only boundary — no direct CarState/GameState/FuelState/TireState reads), Camera mode, Settings overlay toggle, Performance signals | uGUI (Canvas, Image, TextMeshPro) |
| **Audio** | Procedural 2-oscillator engine, 5 audio layers, SFX (squeal/impact/wind), fuel factor curve, 6-speed gear ratios, 9 states mirroring SimulationState, music sting priority + 6dB ducking (ADR-0012) | Mixed audio output to `AudioListener` | `PublishedSimulationSnapshot` (CarState/FuelState fields **via the published boundary** — no direct mutable-state reads), Camera mode, `CarDefinition.AudioProfile.EngineCylinders` | `AudioSource`, `AudioMixer`, `AudioListener` |
| **VFX** | Environment-colored speed streaks, motion blur (max 0.5), speed-driven vignette, white/gray tire smoke (requested 300-3000 particles/s, capped at 25/50/100/150 live particles per car for Low/Medium/High/Ultra), orange/yellow impact sparks, brown dust, `impactShakeRequest`, 4 density presets (Low/Medium/High/Ultra), up to 16 tire-smoke emitters/8 spark bursts/16 dust emitters | `impactShakeRequest{source, factor}` to Camera | `PublishedSimulationSnapshot` (CarState/TireState fields **via the published boundary** — no direct mutable-state reads), `global_max_velocity` from Car Def, Settings (density, Motion Blur, Reduced Motion), `PerformanceReduced` | URP post-processing, `ParticleSystem`. HIGH RISK (RenderGraph) |
| **UI Menu** | Screen flow (Title→Track→Car→Qualifying→Grid→Race→Results), linear stack navigation, 3 input coexistence, 3D car turntable (15 RPM), pause menu, Settings preview, results/forfeit display | Navigation state, screen transitions | `PublishedSimulationSnapshot`, Content Pipeline signals, `OverdriveUI` action map, Car Def stats, Track data | uGUI, `InputSystemUIInputModule`, `EventSystem` |

## Data Flow

### Frame Update Path — 14-Step Tick Pipeline

```
Simulation Update() — per render frame:
  0. InputSystem.CaptureLatestRawSample() — exactly once, before accumulator
  1. Consume focus-loss/focus-return
  2. Accumulate Time.unscaledDeltaTime (clamp to 2×FIXED_DT)
  3. While accumulator ≥ FIXED_DT:
     → EXECUTE ONE TICK (Steps 1-14 below)
     → accumulator -= FIXED_DT
  4. Compute interpolation factor α = accumulator / FIXED_DT
     (VisualTransform interpolation and all presentation consumers run in LateUpdate via PresentationDriver — ADR-0001 Interpolation Phases; they never run in the Simulation Update path)

Per tick (60 Hz fixed; multiple ticks per frame reuse the same raw sample):

STEP  1:  Build TickStartSnapshot (from the prior PublishedSimulationSnapshot + cached AIInput; includes PitServiceCommand from previous Step 9b)
STEP  2:  Invoke Input tick processor with the latest captured RawInputSample → ResolvedCarInput[16]
STEP  3:  Consume Pause edge + pendingPerformancePause
STEP  4:  Decrement countdown (if Countdown state)
STEP  5a: FuelSystem.Tick → FuelState[16] (consumes PitServiceCommand for refuel)
STEP  5b: TireSystem.Tick → TireState[16] (consumes PitServiceCommand for swap)
STEP  6:  Apply Vehicle Physics forces
STEP  7:  Physics.Simulate(FIXED_DT)
STEP  8:  GO grid-lock release (last Countdown tick)
STEP  9:  VP.ReadCarState → CarState[16] (incl. PitPhase)
STEP  9b: PitStopSystem.Tick → PitState[16] + PitServiceCommand[16]
STEP 10:  RSM evaluates (position, lap, finish, TransitionRequest)
STEP 11:  Increment counters (simulationStepCount, activeRaceStepCount)
STEP 12:  Publish PublishedSimulationSnapshot
          → Ghost Recording captures continuous SimulationInput (if Racing state)
STEP 13:  AI reads snapshot → produces AIInput[16]
STEP 14:  Resolve next-tick ResolvedCarInput[16] (cached AIInput from Step 13; player input is processed at Step 2 of the current tick per ADR-0005)
          → feeds into next tick's TickStartSnapshot
```

**Cross-step data:**
- Step 0 (frame) → Step 2: captured RawInputSample (once per render frame, pre-accumulator; reused by multiple ticks in the same frame)
- Step 1 → Steps 5a/5b: TickStartSnapshot (surface, speed, slideState, PitServiceCommand, surfaceWearMultiplier)
- Step 2 → Steps 5a/5b/6: ResolvedCarInput (player SimulationInput + cached AIInput)
- Step 5a → Step 6: FuelState (topSpeedModifier)
- Step 5b → Step 6: TireState (runtimeGripMultiplier)
- Step 7 → Step 9: PhysX mutable state → CarState (read-only)
- Step 9 → Steps 9b/10: CarState consumed by Pit Stop, RSM
- Step 9b → Step 1 (next tick): PitServiceCommand carried to next TickStartSnapshot
- Step 10 → Step 11/12: TransitionRequest consumed by Simulation
- Step 12 → Step 13: PublishedSimulationSnapshot consumed by AI
- Step 12 → LateUpdate: PublishedSimulationSnapshot consumed by Camera, VFX, Audio, HUD (interpolated)
- Step 14 → Step 1 (next tick): ResolvedCarInput carried to next TickStartSnapshot

### Initialization Order

```
BOOT:
  Input System loads .inputactions asset
  Settings loads PlayerPrefs blob + migrates if needed
  Content Pipeline initializes Addressables catalog

PRE-RACE:
  Content Pipeline: LoadShared() → parallel LoadTrack(id) + LoadCars(16 ids) (parallel race bundle, ADR-0003)
  Car Definition Data: deserialize 16 CarDefinition assets
  Track System: load + validate track JSON → build spline geometry
  RSM: receives GridAssignment → publishes to Grid & Start

RACE START:
  Grid & Start: position 16 cars on grid
  Simulation: enter Countdown (300 ticks)
  AI: derive per-car draws from counter-based PCG32 (seed, carId, step, slot) — no mutable per-car stream (ADR-0009)
  Fuel/Tire: initialize to race start values

RACING LOOP:
  14-step tick pipeline at 60 Hz
  All systems read from PublishedSimulationSnapshot
  Camera/HUD/Audio/VFX render from interpolated state

POST-RACE:
  RSM: FinishOrderResolver runs once
  PublishedSimulationSnapshot: terminalPresentationRequest
  Content Pipeline: UnloadRace()
```

### Event/Signal Path

| Event | Producer | Consumers | Type |
|-------|----------|-----------|------|
| `LapCompleted(carId, lapNumber, lapTime)` | RSM | Fuel (snapshot), Tire (snapshot), AI, HUD | Sync, Step 10-11 |
| `PitEntry` / `PitExit` | RSM | Pit Stop, Camera, HUD, Audio | Sync |
| `RaceFinished(carId, pos, time)` | RSM | UI Menu, Camera, Audio | Lifecycle |
| `TransitionRequest(targetState, ...)` | RSM | Simulation Architecture | Sync |
| `PerformanceReduced` / `Paused` | Simulation | HUD, VFX, Camera | Lifecycle |
| `ContentLoadError(reason)` | Content Pipeline | Simulation, UI Menu | Lifecycle |
| `RaceLoadReady(mode, gridAssignment)` | Content Pipeline | Simulation | Lifecycle |
| `impactShakeRequest{source, factor}` | VFX | Camera | Per-tick async |

### Save/Load Path

- **Settings:** `PlayerPrefs` blob + backup. Migration v1→v3. Snapshot/preview model
- **Ghost files (Alpha):** Binary file on disk (LZ4 compressed). A provider selected in Alpha supplies authenticated durable upload/download. Key format is selected with that provider contract.
- **No other persistence in MVP** — race results are ephemeral, no career, no save game

## API Boundaries

All boundaries use C# `readonly struct` value types (no GC allocation per tick, no boxing). Where an enumerated set exists, use `byte` or `enum` backed by integer — never `string` or `object`.

### Shared Type Definitions

```csharp
// Enumerations (all backed by byte)
public enum SimulationState : byte { Idle, Loading, Countdown, Racing, Finished, Paused, Results, Replay }
public enum RaceMode : byte { Race, Qualifying }
public enum ResultKind : byte { Race, Qualifying }
public enum SurfaceType : byte { Asphalt, Kerb, Gravel, Grass, Runoff, PitLane }
public enum PitPhase : byte { NotPitting, PitTransit, InPitBox, PitExiting }
public enum SlipState : byte { Normal, Slipping, SpinOut }
public enum InputAvailability : byte { Available, NoInputDevice }
public enum ControlScheme : byte { KeyboardMouse, Gamepad }
public enum ImpactSource : byte { WallHit, Curb, MicroShake }
public enum FuelStateEnum : byte { Full, Conserving, Critical, Empty }
public enum CarStateEnum : byte { Driving, OffTrack, WallHit, Pitting, GridLocked }

public struct GridAssignment {
    public uint[] carIdBySlot;    // slot 0-15 → carId 0-15
    public int playerSlot;
}

public enum FinishClassification : byte { Finished, DNF, Forfeit }

public struct ResolvedFinishEntry {
    public ushort carId;
    public FinishClassification classification;
    public ushort position;        // 0 when classification != Finished (no fabricated position)
    public float time;             // final or pace-projected from one PostFinishSnapshot
}

public struct ResolvedFinishOrder {
    public ResolvedFinishEntry[] entriesByPosition;  // finished entries 1-16, then DNF/Forfeit entries
}

public struct PlayerResult {
    public FinishClassification classification;   // Finished/DNF/Forfeit (ADR-0018)
    public ushort position;                       // 0 when classification != Finished
    public float raceTime;
    public ushort completedLaps;
    public ResultKind resultKind;
}
```

### Foundation Layer

```csharp
// Simulation → all downstream systems (read-only per tick)
public readonly struct PublishedSimulationSnapshot {
    public readonly SimulationState State;
    public readonly RaceMode RaceMode;
    public readonly uint SimulationStepCount;
    public readonly uint ActiveRaceStepCount;
    public readonly float SimTime;
    public readonly CarStateArray16 CarStates;
    public readonly GameState RaceState;      // renamed — was `State`, collided with SimulationState State
    public readonly FuelStateArray16 FuelStates;
    public readonly TireStateArray16 TireStates;
    public readonly PitStateArray16 PitStates;
    public readonly bool TerminalPresentationRequest;
    public readonly ResultKind ResultKind;
    public readonly PlayerResult PlayerResult;
}

// RSM → all consumers (per tick via PublishedSimulationSnapshot)
public readonly struct GameState {
    public readonly ushort LapCount;               // player lap
    public readonly ushort Position;               // live position ranking
    public readonly float RaceTime;
    public readonly float[] LapTimes;              // completed laps (allocated once at race init)
    public readonly float TotalDistance;
    public readonly bool IsFinished;
    public readonly bool IsPitting;
    public readonly RaceMode RaceMode;
    public readonly ResultKind ResultKind;
    public readonly FloatArray16 SplinePositions;  // per-car fractional spline progress (Track Map dots, ranking)
}

// Zero-allocation wrapper template (CarStateArray16, FuelStateArray16, TireStateArray16,
// PitStateArray16, FloatArray16, Vector3Array16, QuaternionArray16) — hot path uses the
// indexer; foreach allocates only via the explicit IEnumerator. No custom attributes
// (the former [NoGC, ValueType] markers were documentation-only):
public readonly struct CarStateArray16 : IReadOnlyList<CarState> {
    private readonly CarState e0, e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11, e12, e13, e14, e15;
    public CarState this[int i] => i switch {
        0 => e0, 1 => e1, 2 => e2, 3 => e3, 4 => e4, 5 => e5, 6 => e6, 7 => e7,
        8 => e8, 9 => e9, 10 => e10, 11 => e11, 12 => e12, 13 => e13, 14 => e14, _ => e15 };
    public int Count => 16;
    public IEnumerator<CarState> GetEnumerator() { for (int i = 0; i < 16; i++) yield return this[i]; }
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

// Input System → Simulation (called 1x/frame before accumulator)
RawInputSample CaptureLatestRawSample();
struct RawInputSample {
    ulong captureSequence;
    ControlScheme activeScheme;
    float accelerateRaw, brakeRaw, steerRaw;
    bool pauseRise;
    InputAvailability inputAvailability;
}

// Input System → Simulation (per tick) — the sole gameplay-input contract
// (input-system.md; 12 bytes — the exact record Ghost stores per tick, ghost-recording.md:108)
public struct SimulationInput {
    public float accelerateOut;    // 0–1, post dead-zone + EMA
    public float brakeOut;         // 0–1, post dead-zone + EMA
    public float steerOut;         // -1–1, post dead-zone + EMA
}

// Settings → Simulation (snapshotted at race init)
struct DifficultyProfile {
    float aiPrecision, aiErrorMultiplier, paceNoise;
    float playerOfftrackGrip, playerWallSpeedLoss;
}

// Content Pipeline → Simulation (lifecycle signals)
void RaceLoadReady(RaceMode mode, GridAssignment grid);
void ContentLoadError(string reason, ContentErrorType type);  // Car failure is never abortive (CarLoadDegraded)

public enum ContentErrorType : byte { Track, Shared, Catalog }   // per ADR-0003
void RaceReconfigureStart();
void ContentUnloadComplete();
```

### Core Layer

```csharp
// Vehicle Physics → all consumers (per tick)
public readonly struct CarState {
    public readonly float3 Position;              // Unity.Mathematics (not Vector3 — sim-path math)
    public readonly quaternion Rotation;          // quaternion, not Euler angles (no gimbal lock)
    public readonly float3 LinearVelocity;        // full velocity vector for AI racing-line logic
    public readonly float SpeedKmh, Rpm;
    public readonly byte Gear;                    // 6-speed discrete gear (1-6, 0 = neutral)
    public readonly float Throttle, Brake, Steer;
    public readonly bool IsGridLocked;
    public readonly SurfaceType Surface;
    public readonly PitPhase PitPhase;
    public readonly CarStateEnum State;            // Driving/OffTrack/WallHit/Pitting/GridLocked
    public readonly SlipState SlipState;           // Normal/Slipping/SpinOut (separate from state machine)
    public readonly float SlideState;              // normalized lateral-slip value (float, not bit)
    public readonly bool WallContact;              // true for tick containing wall impact
    public readonly float ForwardDot;              // car-forward dot track-tangent, for RSM lap validation
}

public enum CarStateEnum : byte { Driving, OffTrack, WallHit, Pitting, GridLocked }
public enum SlipState : byte { Normal, Slipping, SpinOut }

// Fuel System → Pit Stop, HUD, AI
struct FuelState {
    float currentFuel, fuelFraction;
    FuelStateEnum state;
    bool lowFuelActive;
    float lastLapFuelUse;
}

// Tire System → Pit Stop, HUD, AI, VFX
public readonly struct TireState {
    public readonly float WearFraction;              // 0.0–1.0
    public readonly float RuntimeGripMultiplier;     // 0.20–1.0
    public readonly byte CompoundId;                  // 0=MVP default, extended in data
    public readonly float LastLapTireWear;
}   // compound name is a data-driven lookup (read once at race init), not per-tick

// Pit Stop → Fuel/Tire (via TickStartSnapshot, Step 9b → next tick Step 5)
public struct PitServiceCommand {
    public bool active;              // true when pit service should be applied
    public float targetFuel;         // 8.0 L (full tank) when fueling
    public bool tireSwapRequired;    // true when tire swap is needed this service
    public bool requestExit;         // service complete/player exit — VP consumes to set PitPhase = PitExiting
}   // ADR-0011:62-67

// RSM → Simulation (state machine request — typed per transition)
// Discriminated payload struct — only one field is valid per TargetState.
// Not a true union: all fields are stored (~150 bytes/request), negligible at
// <10 lifecycle events per race.
public readonly struct TransitionRequest {
    public readonly SimulationState TargetState;
    public readonly TransitionPayload Payload;
}

public readonly struct TransitionPayload {
    // Only one of these is valid per TargetState:
    public readonly GridAssignment GridAssignment;      // Idle → Loading (race start)
    public readonly RaceMode RaceMode;                  // Loading → Countdown/Qualifying
    public readonly FinishResult FinishResult;           // Racing/Countdown/Paused → Finished/Results
}
// Forfeit is NOT a SimulationState — it is a FinishClassification (ADR-0018:82).
// Return to Menu from Countdown/Racing/Paused produces TransitionRequest(Results)
// with FinishResult carrying classification = Forfeit; Forfeit never invokes
// FinishOrderResolver and has no final position.

public readonly struct FinishResult {
    public readonly ResultKind Kind;
    public readonly ResolvedFinishOrder Order;
    public readonly PlayerResult Player;               // player entry incl. classification
}
```

### Interpolated State (Render Path)

```csharp
// Simulation → Presentation systems (per LateUpdate, after interpolation)
public readonly struct InterpolatedCarState {
    public readonly float3 Position;                // Lerp(TickN, TickN+1, α)
    public readonly quaternion Rotation;            // Slerp(TickN, TickN+1, α)
    public readonly float SpeedKmh;                 // Lerp
    // Non-interpolated fields (snapped to latest simulation value):
    public readonly float Rpm, Throttle, Brake, Steer;
    public readonly byte Gear;                    // snapped (discrete)
    public readonly SurfaceType Surface;
    public readonly PitPhase PitPhase;
}
// Accessed via Simulation.ExecuteInterpolatedRead(InterpolatedCarState[16])
// Called by Camera (transform), Audio (rpm, speed), VFX (speed, surface)
```

### Feature Layer

```csharp
// AI Rival → Vehicle Physics (cached per tick)
public readonly struct AIInput {
    public readonly float AccelerateOut, BrakeOut, SteerOut;
    public readonly uint CarId;
}

// Simulation Step 2: ResolvedCarInput — the single contract for all downstream systems
public readonly struct ResolvedCarInput {
    public readonly float AccelerateOut;        // 0–1, post-dead-zone and EMA
    public readonly float BrakeOut;             // 0–1, post-dead-zone and EMA
    public readonly float SteerOut;             // -1–1, post-dead-zone and EMA
    public readonly float RawThrottlePostDeadZone;  // for Perfect Start detection
    public readonly float RawBrakePostDeadZone;
    public readonly InputAvailability Availability;
}

// Grid & Start → Simulation
struct PerfectStartResult {
    bool active;
    ushort remainingTicks;    // 600 when active, 0 otherwise
}
```

### Presentation Layer

```csharp
// VFX → Camera
struct ImpactShakeRequest {
    ImpactSource source;
    float impactFactor;       // 0.02–0.5
}
```

### Networking Boundaries (ADR-0016/0017 — Accepted, Beta-scoped)

MVP and Alpha do not link any real-time networking SDK. Alpha selects one online-services provider (identity, durable ghost storage, account/privacy, quota, retry, deletion/export). Beta separately selects the real-time racing SDK against the ADR-0017 driver interface, which operates as a **guest of the manual accumulator** — Simulation retains sole authority over focus-loss, performance gating, Pause consumption, countdown, and the 14-step pipeline.

```csharp
// ADR-0017 driver boundary (Beta) — project-owned, SDK-agnostic
public delegate void RemoteInputsReceivedHandler(uint simulationFrame, ReadOnlySpan<NetworkInput> inputs);

public interface INetworkSimulationDriver {
    void SubmitInputs(ReadOnlySpan<SimulationInput> localInputs, uint simulationFrame);
    int SerializeSnapshot(in PublishedSimulationSnapshot snapshot, Span<byte> destination);
    void Rollback(uint toFrame, in SimulationRollbackState state);
    NetworkInput GetPredictedInput(int carId, uint frame);
    event RemoteInputsReceivedHandler RemoteInputsReceived;
}
// The 14-byte NetworkInput transport layout maps the consumed 12-byte
// SimulationInput plus network metadata (ADR-0017:88-91); connection objects are
// never input parameters — one connection multiplexes all player streams.
// Metadata bit map (ADR-0017:90-91): bits 0-2 GDD packet table, bit 3 reserved,
// bit 4 InputAvailability, bits 5-7 reserved until explicitly defined.

// Per-car corrective kinematic state for all 16 cars (ADR-0017:117-121) —
// captured before replay, restored before re-simulation. All arrays use the
// zero-allocation wrapper template:
public readonly struct SimulationRollbackState {
    public readonly Vector3Array16 Positions;         // per-car world position
    public readonly QuaternionArray16 Rotations;      // per-car rotation
    public readonly Vector3Array16 LinearVelocities;  // per-car
    public readonly Vector3Array16 AngularVelocities; // per-car
}
```

- **Rollback scope:** whole-scene `Physics.Simulate(FIXED_DT)` per replay frame with all 16 cars restored (kinematics captured in `SimulationRollbackState`); Fuel, Tire, Pit Stop, RSM, countdown, counters, AI (PCG32), and Ghost Recording are **forward-only**, never re-run (ADR-0017 D4).
- **Reliability:** `InputReliabilityPolicy` (clock alignment, input delay, jitter buffer, redundancy, `W_drop`, `W_rollback`, held-last) is measured at Beta — no fixed tick window (ADR-0017 D3).
- **Disconnect lifecycle:** five reconnect attempts with exponential backoff, resync, then AI takeover via the cached-input path; the missing-input policy is never a disconnect timer (ADR-0017 D7).
- **Alpha services** (identity, ghost storage) are provider-agnostic per ADR-0016; no provider import is allowed before the selection boundary is exercised.

## ADR Audit

### Audit Summary

| ADR | Domain | Status | Engine Compat | Verdict |
|-----|--------|--------|---------------|---------|
| 0001 | Simulation | Accepted | PASS | Valid |
| 0002 | Vehicle Physics | Accepted | PASS | Valid |
| 0003 | Content Pipeline | Accepted | PASS | Valid |
| 0004 | Settings | Accepted | 1 advisory | Valid |
| 0005 | Input | Accepted | PASS | Valid |
| 0006 | Fuel/Tire | Accepted | PASS | Valid |
| 0007 | Track Spline | Accepted | PASS | Valid |
| 0008 | Ghost Recording | Accepted | PASS | Valid |
| 0009 | AI Rival | Accepted | PASS | Valid |
| 0010 | Camera-VFX | Accepted | PASS | Valid |
| 0011 | Pit Stop | Accepted | PASS | Valid |
| 0012 | Audio | Accepted | PASS | Valid |
| 0013 | Qualifying Session Format | Accepted | PASS | Valid |
| 0014 | HUD Data Contract & Layout | Accepted | PASS | Valid |
| 0015 | Car Definition Data Validation | Accepted | PASS | Valid |
| 0016 | Alpha Services / Beta Real-time Selection Boundary | Accepted | PASS | Valid |
| 0017 | Network Simulation Driver Interface & Beta Canonical State Model | Accepted | PASS | Valid |
| 0018 | RSM Authority (ranking, lap, finish resolution) | Accepted | PASS | Valid |
| 0019 | UI Presentation (screen flow, navigation, turntable) | Accepted | PASS | Valid |

### ADR-0001 Detail (Root ADR — template for all)

| Check | Status |
|-------|--------|
| Engine Compatibility section | Present (version 6000.3.19f1, HIGH risk flagged) |
| Post-cutoff APIs flagged | Knowledge Risk: HIGH — verified against Unity 6000.3 runtime |
| GDD Requirements Addressed | 6 GDDs (Simulation, Input, RSM, Grid and Start, AI, Ghost) |
| Conflicts with Phase 1-4 decisions | None — this regeneration (2026-08-06) aligned all 13 drift points found by the v6 review |
| Still valid for pinned engine | Physics.Simulate and SimulationMode.Script verified |

**Verdict:** Valid. No revision needed.

All ADRs follow the same structure (Engine Compatibility, Registry Check, Decision, Consequences, Validation Criteria, GDD Requirements Addressed). See individual ADR files under docs/architecture/ for full detail.

### Traceability Coverage

| Metric | Value |
|--------|-------|
| Registry | 144 TRs, version 8 (all active) |
| Covered | 144 (100%) |
| Partial | 0 |
| Gaps | 0 |

Audit 2026-08-06 (v6 + create-architecture regeneration): 0 cross-ADR conflicts (C1 player-input timing, C2 presentation timing, C3 premature CloudStorage contract all resolved by amends); the regeneration aligned all 13 drift points and the TR-camera-004 partial (Chase look-ahead formula). See `docs/architecture/architecture-traceability.md` (144-row matrix) and `docs/architecture/complete-traceability-matrix.md` for the per-TR mapping. Registry: `docs/architecture/tr-registry.yaml`.

## Required ADRs (All Completed)

All 19 ADRs (0001-0019) are created and Accepted. See `docs/architecture/` for each ADR's full text and `docs/architecture/control-manifest.md` for the consolidated rules sheet. The table below links each layer to its governing ADRs.

| Layer | ADRs | Key Decisions |
|-------|------|---------------|
| Foundation | 0001, 0003, 0004, 0005, 0008 | Manual simulation, Addressables groups, PlayerPrefs blob, InputContextController, Ghost binary format |
| Core | 0002, 0006, 0007, 0011, 0015, 0018 | Rigidbody + custom grip, Fuel/Tire Step 5a/5b, JSON spline format, PitStopSystem, CarDefinition validation, RSM authority |
| Feature | 0009, 0013 | AI deterministic counter-based PCG32, AIInput from PublishedSimulationSnapshot, qualifying session format |
| Presentation | 0010, 0012, 0014, 0019 | Custom camera (no Cinemachine), ParticleSystem (no VFX Graph), RenderGraph, budget 2.4ms ceiling, Unity Audio Mixer + procedural engine, HUD snapshot contract, UI screen flow |
| Networking (Beta) | 0016, 0017 | Alpha services / Beta real-time selection boundary, driver interface + rollback boundary |

## Architecture Principles

1. **Simulation is sacred.** The 60 Hz tick pipeline is the single source of truth. No system mutates gameplay state outside the tick. No system reads `Time.deltaTime` or `Time.fixedDeltaTime` for gameplay timing. Render is a projection of simulation state, never its driver.

2. **Data flows one way through the tick.** Systems consume from `TickStartSnapshot`, produce for the next step. No circular reads within a tick. AI reads snapshot from tick N and writes input for tick N+1 — never reads its own pending input.

3. **Ownership is exclusive.** Every data field has exactly one owning system. Other systems read via immutable snapshots or explicit producer methods. No shared mutable state. Cross-system values (`fuel_fill_rate` owned by Fuel, `tire_swap_time` by Tire) are referenced, not redefined.

4. **Determinism is a feature, not an accident.** Gameplay randomness uses project-owned PCG32 with explicit `uint64` seeds. `UnityEngine.Random` is prohibited on the simulation path. All simulation math uses `Unity.Mathematics`. Same seed + same inputs = same outputs within the same executable.

5. **Platform capability is data, not code.** Car stats, tire compounds, AI archetypes, track geometry, DifficultyProfiles, control profiles — all data-driven. Adding a new team, compound, or difficulty requires zero code changes.

## Open Questions

- **Multiplayer network seam** — MVP is offline-only. Simulation/render separation is provider-agnostic. Alpha selects online services; Beta separately selects the real-time SDK under ADR-0017's driver and reconciliation contract.
- **UI Toolkit vs uGUI for menus** — HUD uses uGUI (proven, performant). Menu screens could use UI Toolkit (UXML/USS workflow). Decision deferred to UX spec phase.
- **Tire-wear multi-sensory feedback** — How Camera, Audio, and VFX receive tire degradation signals for non-HUD feedback (steering lightness, squeal intensity, smoke density). Cross-system contract needed before prototype. See ADR-0006 (TireSystem) and ADR-0010 (Camera shake chain).
