# Control Manifest

> **Engine**: Unity 6000.3.22f1 (Unity 6.3 LTS) + URP 17.3.0
> **Last Updated**: 2026-08-05
> **Manifest Version**: 2026-08-05
> **ADRs Covered**: 0001–0019 (all Accepted)
> **Status**: Active — regenerate with `/create-control-manifest update` when ADRs change

`Manifest Version` is the date this manifest was generated. Story files embed
this date when created. `/story-readiness` compares a story's embedded version
to this field to detect stories written against stale rules. Always matches
`Last Updated` — they are the same date, serving different consumers.

This manifest is a programmer's quick-reference extracted from all Accepted ADRs,
technical preferences, and engine reference docs. For the reasoning behind each
rule, see the referenced ADR.

---

## Foundation Layer Rules

*Applies to: scene management, event architecture, save/load, engine initialisation*

### Required Patterns
- **Input System processes platform events in Dynamic Update** (`ProcessEventsInDynamicUpdate` — the `UpdateMode` enum was renamed in Input System 1.19.0; there is no fixed update mode) — source: ADR-0001, ADR-0005
- **`InputContextController` is the sole owner of action-map and UI-module activation** — no other system enables/disables maps — source: ADR-0001, ADR-0005
- **Exactly two action maps in a single `.inputactions` asset**: OverdriveGameplay (5 actions) + OverdriveUI (6 actions); exactly one active at any time — source: ADR-0005
- **Disable one action map before enabling the other** (no overlapping bindings); clear pending pauseEdge on Gameplay→UI transition — source: ADR-0005
- **Latch every newly enabled digital action and UI Navigate control** actuated at transition until neutral/released; the latch evaluates on the frame AFTER the transition is committed; Accelerate/Brake/Steer are exempt on UI→Gameplay resume — source: ADR-0005
- **Simulation invokes Input-owned `CaptureLatestRawSample()` exactly once per render frame**, at the beginning of its own `Update()`, before reading/modifying the accumulator; no relative MonoBehaviour script-order assumption is permitted — source: ADR-0001
- **CameraToggle routes rising edge same-frame via `InputAction.performed` → `Camera.ToggleRequest`**; holding does not repeat; one toggle per press — source: ADR-0005
- **ActiveControlScheme arbitration**: KeyboardMouse default, last meaningful device wins; both in same DynamicUpdate preserves current; EMA reinitializes on scheme change — source: ADR-0005
- **Brake priority**: when rawBrakePostDeadZone > 0, accelerateOut = 0 and Accelerate EMA is frozen — source: ADR-0005
- **Input sanitization**: NaN/Infinity → 0.0f; values outside [-1.0, 1.0] → clamped — source: ADR-0005
- **InputAvailability enum** {Available, NoInputDevice}: zeroed SimulationInput with NoInputDevice flag when no device connected — source: ADR-0005
- **Pause is fixed and reserved across ALL contexts** — cannot be remapped, replaced, or removed. Confirm and Cancel are reserved in all UI contexts (default bindings per GDD Core Rule 1) — source: ADR-0005
- **Settings uses PlayerPrefs single JSON blob** with backup-first write and transactional preview (`SettingsEditSession`); schema migration runs on load (v1→v2→v3 sequentially, never by jump) — source: ADR-0004
- **Every successful save must call `PlayerPrefs.Save()` explicitly** after the backup-first write completes, before reporting Success (SetString alone does not flush synchronously on some platforms) — source: ADR-0004
- **SettingsEditSession**: snapshot (active values) + working copy (preview); Apply persists, Cancel restores; only one session at a time (Save is non-reentrant) — source: ADR-0004
- **DisplayConfirm with 15s timer** for resolution/fullscreen changes; reverts on focus loss — source: ADR-0004
- **5 DifficultyProfiles** (Very Easy–Very Hard), **4 QualityPresets** (Low/Medium/High/Ultra); Difficulty is immutable, snapshotted at race init; Settings blocked during active Countdown — source: ADR-0004
- **Load cascade**: primary → backup → factory defaults + "Settings restored" message; every field validated (NaN/Inf → per-field default); unsupported resolution → nearest supported + warning — source: ADR-0004
- **Reserved bindings (Confirm, Cancel, Pause) rejected during Listening** — cannot be rebound, replaced, or removed; binding Action/Binding GUIDs stable after first shipped schema — source: ADR-0004
- **`TriggerDeadZoneInner` is NOT player-owned** — always overwritten from Input-owned tuning on load — source: ADR-0004
- **Use `RefreshRate` struct exclusively for `Screen.SetResolution`** — the `int preferredRefreshRate` overloads are deprecated in Unity 6000.3 — source: ADR-0004
- **Content Pipeline uses Addressables for all async asset loading**: 3 groups (Shared, Cars/{teamId}, Tracks/{trackId}); 17 bundles (1 track + 16 cars) load in parallel — source: ADR-0003
- **Addressable GROUP NAMES are never runtime load keys** — the load key is the asset's ADDRESS; editor tooling must mirror group names with explicit address assignment (`Cars/{teamId}`, `Tracks/{trackId}`); editor import script asserts the mirror — source: ADR-0003
- **Per-car address, never a shared constant**: `Cars/{teamId}/CarDefinition`; `Tracks/{trackId}/TrackData` ("CarDefinition" alone resolves ambiguously across 16 cars) — source: ADR-0003
- **CP_ state machine**: CP_Idle → CP_LoadingTrack → CP_LoadingCars → CP_Ready → CP_Racing → CP_Unloading → CP_Idle (7-state base lifecycle) + transient `CP_RaceReconfigure` — source: ADR-0003
- **`ContentErrorType` = {Track, Shared, Catalog}**; Car is never abortive — car failure emits `CarLoadDegraded(reason, teamId)`, race continues with 15 cars + placeholder — source: ADR-0003
- **`RaceLoadReady(RaceMode, GridAssignment)` emitted only when ALL required slots are completed** — loaded OR degraded-placeholder per slot (GDD:144; degraded car counts as completed; car prefabs, MonoBehaviours incl. CarCollisionMonitor, CarDefinition, track data) — source: ADR-0003 as interpreted by story 002/003 + architecture.yaml:224
- **RaceReconfigure performs NO Addressables load/unload** (cache hit only); `RaceReconfigureStart` is a one-way event — domain owners subscribe, Content Pipeline never calls them directly — source: ADR-0003
- **Loading progress from byte counts** via `AsyncOperationHandle.GetDownloadStatus()` (DownloadedBytes / TotalBytes) — source: ADR-0003
- **Memory pressure > 95% during loading**: abort, release partial handles, emit `ContentLoadError("Memory pressure", ContentErrorType.Track)` — source: ADR-0003
- **Catalog init failure**: retry once; if retry fails, app closes — source: ADR-0003
- **Unload all race-specific assets on race end**; release every instance and handle — source: ADR-0003
- **Ghost Recording MVP keeps the buffer in-memory and discards it unconditionally** on Results/Forfeit/Idle/Load failure; no file I/O during MVP racing — source: ADR-0008

### Forbidden Approaches
- **Never use a single action map with per-action enable/disable** — InputSystemUIInputModule cannot coexist with gameplay actions in one map; no clean latching boundary — source: ADR-0005
- **Never have no central input controller** — Pause could fire twice, no coordinated latching, device-switch ambiguity — source: ADR-0005
- **Never use individual PlayerPrefs keys per setting** — no atomicity, no built-in migration, stale keys accumulate — source: ADR-0004
- **Never use a JSON file on disk for settings** — no atomic write guarantee on all platforms, no benefit at <10 KB blob size — source: ADR-0004
- **Never use a monolithic single Addressables group** — ~500 MB+ at startup, WebGL OOM risk, no incremental rebuilds — source: ADR-0003
- **Never use lazy per-asset Addressables loading** — serial load spikes, unpredictable load time, HUD pop-in mid-race — source: ADR-0003
- **No `Resources.Load()` calls in the content path** (editor tooling exceptions allowed) — source: ADR-0003
- **Never write per-tick to file (ghost recording)** — file IO during gameplay ticks, 60 writes/second — source: ADR-0008

### Performance Guardrails
- **Simulation tick budget**: p95 ≤ 6 ms, max ≤ 8 ms (16-car prototype, Steps 1–14) — source: ADR-0001
- **Load ceiling**: ≤ 5s PC SSD / ≤ 10s WebGL (first load, TR-content-007) — source: ADR-0003
- **Individual track bundle ≤ 10s; Shared group at startup ≤ 2s** — source: ADR-0003
- **Memory per race**: PC 730–1320 MB, WebGL 415–670 MB; Shared adds ~40–60 MB at startup — source: ADR-0003
- **PerformanceReduced trigger**: < 30 FPS sustained 3s; **PerformanceRestored**: ≥ 30 FPS for 3s; race pause: < 15 FPS for 3s after reduction — source: ADR-0001

### Engine API Constraints
- **Unity 6000.3.19f1 is post-LLM-cutoff** (Knowledge Risk HIGH) — verify APIs against `docs/engine-reference/unity/` before use — source: ADR-0001
- **`InputSettings.UpdateMode` enum renamed**: `ProcessEventsInDynamicUpdate` (was `Dynamic`), `ProcessEventsInFixedUpdate` (was `FixedUpdate`) — source: ADR-0005
- **`Screen.SetResolution` with `int preferredRefreshRate` is deprecated** in Unity 6000.3 — use `RefreshRate` struct — source: ADR-0004
- **Addressables 3.1.0** is post-cutoff; `LoadAssetAsync<T>()`, `ReleaseInstance()`, `Release()` confirmed — source: ADR-0003
- **Known Addressables 2.x/3.x WebGL bundle-load throughput regression (2025)** — validate first-load throughput in profiling — source: ADR-0003

---

## Core Layer Rules

*Applies to: core gameplay loop, main player systems, physics, collision*

### Required Patterns
- **Simulation Architecture is the only writer of `SimulationState`**; RSM owns RaceMode, race rules, result resolution, and transition requests; Content Pipeline emits readiness/unload only — source: ADR-0001
- **`Physics.simulationMode = SimulationMode.Script`**; one whole-scene `Physics.Simulate(1/60f)` per active tick; no `FixedUpdate()` on the simulation path — source: ADR-0001
- **`Rigidbody.interpolation = None`**; manual interpolation runs in LateUpdate (α = accumulator / FIXED_DT) — source: ADR-0001
- **14-step tick pipeline is canonical**: capture raw sample (once, frame-level, passed separately to Step 2) → input → TickStartSnapshot → Pause/Countdown → Fuel/Tire (5a/5b) → forces by ascending carId → one Physics.Simulate → CarState readout by ascending carId → PitStop (9b) → RSM events → counters → PostFinishSnapshot → ResolvedFinishOrder → TransitionRequest → PublishedSimulationSnapshot → AI (13) → ResolvedCarInput (14) — source: ADR-0001
- **`TickStartSnapshot` carries no `RawInputSample[16]` and no frame `deltaTime`**; domain ticks receive `FIXED_DT` as an explicit argument, never `Time.unscaledDeltaTime` — source: ADR-0001
- **Multi-tick render frames reuse the single latest raw sample** — there is no per-tick raw sample array — source: ADR-0001
- **`PostFinishSnapshot` is the immutable terminal-state snapshot**; no PhysX, Fuel, Tire, Pit, collision, or tactical AI runs after finish — source: ADR-0001
- **`PerformanceReduced` is producer-only** (Simulation owns the signal, not consumer behavior); camera collision avoidance is NEVER disabled by degradation — source: ADR-0001
- **Focus loss creates an immediate non-physics lifecycle boundary** before accumulator evaluation; preserves remainder and counters; publishes Paused; requires explicit Resume; focus-return never auto-resumes — source: ADR-0001
- **Countdown = 300 simulation ticks**; GO releases grid lock after physics; next tick begins Racing; fuel/tire/race time start at GO — source: ADR-0001
- **At GO, before the first Racing tick, Simulation captures immutable ReplayInitialState** (race/content identity, grid, cars, Fuel/Tire state, Perfect Start data; AI RNG state is represented solely by SimSeed) — source: ADR-0001
- **Continue/Back from Results** → `ContentUnloadRequest`; Simulation remains Results until `ContentUnloadComplete`, then Idle — source: ADR-0001
- **PCG32 is the only gameplay PRNG**; no `UnityEngine.Random`/`System.Random` on the simulation path — source: ADR-0001
- **Vehicle Physics uses PhysX** (no DOTS/ECS for MVP, behind `IVehicleDriver` seam); no WheelCollider — custom grip force formula — source: ADR-0002
- **Use `Rigidbody.linearVelocity`, `linearDamping`, `angularDamping`** — never obsolete `velocity`, `drag`, `angularDrag` — source: ADR-0002
- **Grip stack**: `effective_grip = clamp(grip_base × surface_grip_multiplier × tire_runtime_grip_multiplier, 0.20, 1.20)`; control_threshold is REMOVED from the stack — source: ADR-0002
- **1-state steering**: `maxYaw = min(steerCeiling(v), v / minTurnRadius, gripCeiling)` — source: ADR-0002
- **Lift-off grip bonus (tuck-in)**: fixed +3.0 g to maxLateralAccel when throttle ≤ 0, applied in BOTH the yaw request and the velocity rotation rate — source: ADR-0002
- **Track-radius drift factor**: F = 1.0 when v ≤ sqrt(aMax × R_ahead); F = driftFactor (1.15) when above limit and throttle > 0; F = 1.0 immediately on lift-off; F applied to BOTH consumers; `driftHeadBoost` (1.40) creates the heading-vs-velocity slip gap; 12% transition band `InverseLerp(vLimit, vLimit × 1.12)`; `track.GetCornerRadiusAhead(pos, driftLookahead=40m)`; knobs are global tuning values — source: ADR-0002
- **Real-engine longitudinal model**: `accel = min(enginePower, P/m ÷ v) − K·v²` with `K = (P/m) ÷ vmax³`; traction limit ~13.5 m/s² below ~90 km/h; `LinearDamping = 0` when the quadratic model is active; motor force applied along heading (slip stabilizer) — source: ADR-0002
- **Force application**: `ForceMode.Force` for values with force semantics (N), OR raw acceleration values (m/s²) applied directly — for pure acceleration semantics, `ForceMode.Acceleration` is the direct-application mode and is correct. Never pass force-semantics values (mass × acceleration) through `ForceMode.Acceleration` or impulse-semantics values through `ForceMode.Impulse` — both implicitly apply/ignore mass and over-apply by the mass factor (observed: 28 m/s² × 505 kg = 14,140 m/s²) — source: ADR-0002
- **Perfect Start**: `perfectStartDriveForceMultiplier = 1.15` for exactly 600 ticks after GO — source: ADR-0002
- **Collision detection**: player ContinuousDynamic, AI Continuous, all fall back to Discrete if profiling exceeds budget; `Rigidbody.maxLinearVelocity` is the hard speed cap — source: ADR-0002
- **Vehicle Physics is the sole writer of `PitPhase`** in CarState; detects pit-entry/exit crossing during Physics.Simulate; reads `PitServiceCommand[carId].requestExit` from TickStartSnapshot and transitions PitExiting next tick, then clears (1-tick latency) — source: ADR-0002
- **CarState per car per tick**: Position, Rotation, LinearVelocity, SpeedKmh, Rpm, Gear, Throttle, Brake, Steer, IsGridLocked, Surface, PitPhase, State, SlipState, SlideState, WallContact, ForwardDot — source: ADR-0002
- **Grip math/force/state pure C#** on plain data structs; thin Unity adapter applies results at the tick boundary; `CarCollisionMonitor` forwards events to the standalone VehiclePhysicsSystem — source: ADR-0002
- **Fuel/Tire are separate pure C# systems at Steps 5a/5b** (before Physics.Simulate); no Unity engine types; read CarState but must NOT write it; per-tick calls receive FIXED_DT — source: ADR-0006
- **Fuel/Tire read `CarDefinition.Stats.Efficiency` at race init** once, stored as per-car float scaling factor; both read the same value per car; formula is a tuning knob (ADR-0015) — source: ADR-0006
- **Pit service gated by `PitServiceCommand[carId]` from TickStartSnapshot** — not by CarState.PitPhase — source: ADR-0006
- **Refuel at 0.8 L/s toward targetFuel** during active service (fuel does not drain); tire swap resets `wearFraction = 0` after 2s continuous InPitBox; service ceases immediately when active=false — source: ADR-0006
- **Low-fuel bonus**: `topSpeedModifier = 1.01` when `fuelFraction < 0.25` — source: ADR-0006
- **`runtimeGripMultiplier` linearly decreases** 1.0 at 0% wear → 0.20 at 100% wear — source: ADR-0006
- **`lastLapFuelUse`/`lastLapTireWear` updated via RSM `LapCompleted` event at Step 10**, not per-tick — source: ADR-0006
- **Track data as snake_case JSON (`schemaVersion=1`, frozen)** via Addressables `Tracks/{trackId}`; `TrackDataContainer` wrapper required (JsonUtility can only deserialize into a `[Serializable]` class root — cannot bind bare top-level arrays or generic containers); release handle after deserialize — source: ADR-0007
- **TrackSystem pre-builds at race init**: segment index with Catmull-Rom chordal parameterization, surface lookup table, pit→racing map; new tracks = data changes only (no code) — source: ADR-0007
- **Ghost Recording**: 80-byte binary header + continuous input stream (12 bytes/tick × 3 float32) + edge event stream (5 bytes/event); exactly one SimulationInput per completed Racing tick; Pause edge events as separate stream; cap 22,500 ticks (never discard oldest, never replay without ReplayInitialState); CRC32 per 256-tick block + final stream CRCs; `IsSerializable == false` only on attempted overflow beyond the cap; pure C# — no Unity engine types — source: ADR-0008
- **LZ4 compression optional, flagged in header** — codec-agnostic format; an explicit LZ4 dependency is required (Unity core has no managed LZ4 codec; e.g. Unity.Collections LZ4Codec or third-party MIT) — source: ADR-0008
- **`header.sim_seed` is authoritative**; `ReplayInitialState.SimSeed` MUST match for valid replay — source: ADR-0008
- **Position ranking per tick, all 16 cars**: `lapCount DESC → splinePosition DESC → positionEntryStep ASC → carId ASC`; tie tolerance 0.001; same-step finish crossing → higher previous-step spline position ranks first; `totalDistance` never ranks (anti-cut only) — source: ADR-0018
- **Lap authority**: lap counts when BOTH boundary crossing (Track's `CrossedLapBoundary`, wrap-safe) AND `distanceSinceLastLap > trackLength × 0.90` (anti-cut; reverse/lateral movement never increases the accumulator; one wrap adjustment); Track is detection provider, RSM owns the rule/lap counter/`LapCompleted` — source: ADR-0018
- **FinishOrderResolver**: consumes ONE immutable PostFinishSnapshot (single read), runs once, never re-runs PhysX/Fuel/Tire/Pit/collisions/AI; player result locked; unfinished AI projected pace-only (2 laps → `trackLength / mean(lastTwoCompletedLapTimes)`, else `sessionTargetLapTime` fallback); MVP approximation ignores pit/fuel/tire (cosmetic); Forfeit → no position, never invokes resolver; DNF keeps classification, no fabricated position — source: ADR-0018
- **RSM owns** ranking algorithm, lap-counting rule, FinishOrderResolver, `LapCompleted`/`PositionChanged`/`PitEntry`/`PitExit`/`RaceFinished` events, `TransitionRequest` production, immutable `GridAssignment` creation — source: ADR-0018
- **CarDefinition as ScriptableObjects** with load-time validation + authoring-time differentiation check; all values tuning knobs (data-driven, not hardcoded) — source: ADR-0015
- **Stats are integers in [0,20]** — no sparse valid-value set ("increments of 4" retired 2026-08-05); out-of-range clamps to nearest integer with warning; validation once at race init, not per tick — source: ADR-0015
- **TeamId must match `team_tier{1-4}_{a-d}`** (length 12, character validation); invalid → `InvalidOperationException` — source: ADR-0015
- **Stat ownership**: TopSpeed/Acceleration/BrakePower/GripLevel/Stability → Vehicle Physics; Efficiency → Fuel/Tire (shared); Weight constant (505 kg), not a differentiating stat — source: ADR-0015
- **Schema accessors read-only** (no mutation after load); formula application deferred to consumers; Efficiency exception (int→float once at race init) — source: ADR-0015

### Forbidden Approaches
- **Never use WheelCollider** — designed for simulation realism; arcade grip requires fighting the slip curve; 64 colliders; indirect tuning — source: ADR-0002
- **Never adopt DOTS/ECS for MVP** — package not installed, overkill for 16 cars at 60 Hz; IVehicleDriver seam preserves the option — source: ADR-0002
- **Never pass force-semantics values (mass × acceleration) through `ForceMode.Acceleration` or impulse-semantics values through `ForceMode.Impulse`** — implicit mass application over-applies by the mass factor (observed: 28 m/s² × 505 kg = 14,140 m/s²); use ForceMode.Force for force semantics, raw m/s² values for acceleration semantics — source: ADR-0002
- **No `FixedUpdate()`, `Time.fixedDeltaTime`, or `Time.deltaTime` in VehiclePhysicsSystem** — source: ADR-0002
- **Never use a stateful RNG stream (AI)** — branch-dependent consumption desyncs future draws; counter-based `PCG32Hash(SimSeed, carId, simulationStepCount, slotId)` only — source: ADR-0009
- **Fuel/Tire must never write CarState fields** — source: ADR-0006
- **Never use JSON with schema validation for CarDefinition** — ScriptableObjects provide editor integration + Addressables compatibility — source: ADR-0015

### Performance Guardrails
- **Fuel + Tire combined ≤ 0.2 ms** for 16 cars — source: ADR-0006
- **PitStopSystem ~0.05 ms** (pure C# counters, no allocations) — source: ADR-0011
- **Track deserialization < 50 ms** per track; ~200–500 KB per track JSON — source: ADR-0007
- **Ghost buffer at cap ~280 KB** (264 KB continuous + ~1 KB edges + header); ~105 KB LZ4 compressed — source: ADR-0008
- **Pit lane speed limit 80 km/h** — source: ADR-0007, ADR-0011
- **CPU ~0.5–1.5 ms per tick (16 cars)**; ~2 KB per car structs, no per-car heap allocation — source: ADR-0002

### Engine API Constraints
- **`Rigidbody.linearVelocity`/`linearDamping`/`angularDamping`** (renamed from velocity/drag/angularDrag in Unity 6000.3) — verified via unity_reflect — source: ADR-0002
- **`Rigidbody.maxLinearVelocity`** confirmed available in Unity 6000.3 — source: ADR-0002
- **`JsonUtility` (Unity 6.3)**: `[Serializable]` class root only; no bare top-level arrays or generic containers — source: ADR-0007
- **`Physics.Simulate(float)` called ONLY by Simulation** — source: ADR-0017

---

## Feature Layer Rules

*Applies to: secondary mechanics, AI systems, secondary features, pit stop, qualifying, networking*

### Required Patterns
- **AI Rival is pure C# at Step 13**, reads the published snapshot, produces `AIInput[16]` (player slot unused); AI cars use exactly the same VehiclePhysicsSystem as the player — no AI-only physics — source: ADR-0009
- **Counter-based PCG32**: every random draw is a pure function of `(SimSeed, carId, simulationStepCount, slotId)`; fixed consumption order per archetype; no mutable per-car stream; same seed + same snapshot = same AIInput — source: ADR-0009
- **4 data-driven archetypes** (Consistent/Aggressive/Inconsistent/Cautious); personalityModifier 0.95–1.05 is the per-archetype speed adjustment; pace_noise/error_noise (DifficultyProfile) and steering/throttle/brake errors modulate the model — source: ADR-0009
- **Target-speed model (TR-ai-005)**: `target_speed = base_speed × state_modifier × personality_modifier × pace_noise × error_noise`; `applied = min(target_speed, vmax, cornerSpeedFromRacingLine(curvatureAhead), trafficSpeed(carAhead))`; difficulty is an explicit input to the model (pace_noise/error_noise derived from DifficultyProfile); corner capacity from Grip stat, vmax from Top Speed stat — same physics formulas as the player, no AI grip cheats — source: ADR-0009
- **Pit policy (TR-ai-003)**: after first completed lap, AI pits before a non-final next lap only if post-current-lap resources cannot cover forecast (observed lap deltas + 110% margin); never before lap 1, never before final lap; AI waits for full fuel in MVP; `LapCompleted` triggers re-evaluation, not per-tick polling — source: ADR-0009
- **Qualifying AI times**: offline PCG32 projection using the DifficultyProfile formula (ADR-0013 owns the formula) — not per-tick execution — source: ADR-0009
- **Canonical 1-tick AI latency**: AI decision at tick N → physics effect at tick N+1 (ResolvedCarInput assembled into next tick's TickStartSnapshot) — source: ADR-0005, ADR-0009
- **PitStopSystem is an independent domain system** owning only: pit box assignment (one stable boxId per car at race init, data-driven from TrackData), service timer, player early-exit eligibility, `PitThisLap` advisory; does NOT own entry detection (VP), fuel/tire state, or pit geometry — source: ADR-0011
- **`PitServiceCommand` written at Step 9b**, carried to next tick's TickStartSnapshot, read by Fuel (5a)/Tire (5b); **neither Fuel nor Tire mutate it** (read-only); PitStopSystem never writes PitPhase — source: ADR-0011
- **`requestExit = true`** when service complete (tireSwapComplete && full fuel, or player early exit); VP consumes next authoritative tick → PitExiting, then clears — source: ADR-0011
- **PitTransit**: 80 km/h clamp (limit from ADR-0007 TrackData) + auto-navigation to box — implementation ownership: Vehicle Physics (ADR-0002), limit supplied by Track (ADR-0007) — source: ADR-0011
- **Pit advisory (after lap 1, before final lap)**: `predicted_fuel = currentFuel − lastLapFuelUse × remainingProgress`; `predicted_tire = (1 − currentWearFraction) − lastLapTireWear × remainingProgress`; `next_lap_fuel_needed = 1.10 × lastLapFuelUse`; `next_lap_tire_needed = 1.10 × lastLapTireWear`; pitThisLap when predicted < needed (fuel OR tire); margin 1.10 applies to AI and player — source: ADR-0011
- **HUD PIT THIS LAP window**: `min(0.80, max(0, Track.pitEntryProgress − 0.05))` to `Track.pitEntryProgress` — source: ADR-0011
- **Player can exit after tireSwapComplete** (Confirm in PitService); AI always waits for full tank; Qualifying suppresses PitEntry — source: ADR-0011
- **Qualifying**: single flying lap, one attempt, no retry; enters Racing/GameplayQualifying directly after `RaceLoadReady(RaceMode.Qualifying)` — no Countdown; player spawns at pit box (boxId from TrackData), stationary, engine running, full driving controls; no fuel/tire/timer during out-lap; flying-lap timer starts on rising-edge spline wrap, stops on second crossing; fuel `min(8.0L, fuel_rate × reference_time × 1.10)`; tire wear disabled for the entire session; pit blocked — source: ADR-0013
- **Qualifying results**: fail/skip → grid position 16, labeled DNQ, no retry; slow completion → time recorded, grid by time placement; tier order NOT preserved (deterministic imprecision allows lower-tier car to outqualify higher-tier — intentional); grid rank ascending by time, ties by stable carId; GridAssignment immutable via TransitionRequest — source: ADR-0013
- **AI qualifying formula**: `ai_time = track_reference_lap_time × tier_modifier × (1 + precision_penalty + error_penalty + pace_variation)`; tier_modifier Tier1 1.00 / Tier2 1.015 / Tier3 1.035 / Tier4 1.055 — source: ADR-0013
- **Ghost persistence (Alpha)**: serialize only on personal best; local ghost cache max 5; `CloudStorage.UploadAsync` (key `ghost_trackId_playerId`); retry queue 3 attempts (1s→2s→4s) — source: ADR-0008
- **Ghost visualization**: opacity 0.4, URP Unlit + alpha blend, no collision, no engine audio — source: ADR-0008
- **MVP selects no online-services or real-time networking provider**; no network package (NGO, DOTS, Coherence) is installed — source: ADR-0016
- **Alpha selects ONE online-services provider** (identity, durable ghost storage, account/privacy, quota, retry, deletion/export); **Beta separately selects the real-time racing SDK**; the two selections are independent — source: ADR-0016
- **Alpha selection criteria (all 8)**: Identity (authenticated, device-independent), Durability (durable retention), Authorization (per-player/server-enforced, no public read/write by guessed identifier), Privacy (deletion/export/account-lifecycle), Quotas (documented limits), Platform (PC + WebGL2 viability), Cost (covers volume/growth), Boundary (behind project-owned storage/auth interfaces); selections require fresh primary-source evidence AND a proof of concept, ratified in a new/amended Accepted ADR — source: ADR-0016
- **Ghost-first ordering**: async sharing in Alpha precedes real-time multiplayer in Beta — source: ADR-0016
- **Provider abstraction must prevent online-service/transport types from leaking into gameplay systems** — source: ADR-0016
- **ADR-0017 driver is a guest**: never calls `Physics.Simulate`, owns no `FixedUpdate`, never writes `SimulationState`; Simulation owns published snapshots; driver serializes only owner-car data into caller-provided storage; one connection MAY multiplex all player streams — source: ADR-0017
- **Input-authoritative prediction with owner-published kinematic reconciliation** (D1): each owner publishes only its car's corrective kinematic state; remote clients converge to corrective state; no cross-machine PhysX determinism claimed — source: ADR-0017
- **`NetworkInput` 14-byte layout must explicitly map the consumed 12-byte `SimulationInput`** before Beta; Bits 0–2 = GDD packet table, Bit 3 reserved, Bit 4 = `InputAvailability`, Bits 5–7 reserved — source: ADR-0017
- **No fixed missing-input window (D3)**: `InputReliabilityPolicy` from empirical PC/WebGL measurements — clock alignment explicit (relay/room mapping, sync cadence, drift correction, max clock uncertainty); input delay explicit and distinct from packet-loss; jitter buffer depth/adaptation explicit; redundancy = sequenced, acknowledged, sliding input history; `W_drop` from p99 arrival age + jitter + clock uncertainty; `W_rollback ≥ W_drop` and inside rollback CPU budget; held-last only within the policy, never AI takeover; timeout separate from W_drop — source: ADR-0017
- **AC-CP2 parameterized**: input arriving `W_drop + 2` ticks late is discarded; held-last engages only when age exceeds W_drop; numeric values recorded only after Beta measurement — source: ADR-0017
- **Rollback (D4)**: `SimulationRollbackState` contains per-car corrective kinematics (position, rotation, linearVelocity, angularVelocity) for ALL 16 cars; replay subset = resolve recorded remote inputs → VP forces → one whole-scene Physics.Simulate → ReadCarState → publish corrective remote-car state; local/AI cars restored with original inputs (no car advances more than once per replay frame) — source: ADR-0017
- **Forward-only during rollback** (never re-run): raw input capture, countdown, Fuel, Tire, Pit Stop, RSM, counters, Ghost Recording, AI evaluation (AI uses cached input; PCG32 derivation never advanced); Ghost never captures replay ticks; HUD/map/camera/VFX consume published corrective state, never simulate — source: ADR-0017
- **Disconnect lifecycle (D7)**: disconnection is a connection-session event, NOT a missing-input condition; detection = transport session loss or connection-level timeout; at most 5 reconnect attempts with exponential backoff (`base × 2^N`, configured cap); resync (clock re-alignment, sequence space) before play resumes; after 5 exhausted attempts → AI takeover via cached-input path for the remainder (slot never left empty, never re-enters held-last); reconnected slot resumes corrective-kinematics path (no ghost playback); Simulation never pauses/rewinds for a reconnecting slot — source: ADR-0017
- **MVP/Alpha**: zero real-time networking cost; no rollback car-count/CPU estimate accepted before Beta measurement — source: ADR-0017

### Forbidden Approaches
- **Never let the selected SDK own the game loop** (physics stepping/state) — violates manual simulation authority — source: ADR-0017
- **Never use state interpolation only** — cannot meet responsive remote-racing/AC-CP1 — source: ADR-0017
- **Never select a real-time SDK now** — premature before Beta — source: ADR-0017
- **Never select Coherence now** — candidate, not dependency (1-hour retention, open access by known identifier documented) — source: ADR-0016
- **Never select one provider for Alpha and Beta** — storage/auth requirements do not determine rollback/relay/prediction suitability — source: ADR-0016
- **Never rely on GDD wording alone for networking** — requires an Accepted ADR boundary — source: ADR-0016
- **Never multiple qualifying laps / Q1-Q2-Q3 elimination** — single flying lap only — source: ADR-0013
- **Never spawn qualifying on track without out-lap** — pit box spawn chosen — source: ADR-0013
- **No physics callbacks in AI** — pure C# per-tick — source: ADR-0009
- **No AI-only grip cheats** — AI drives within the same car stats as the player — source: ADR-0009

### Performance Guardrails
- **VFX smoke caps**: 25/50/100/150 live particles per car (Low/Medium/High/Ultra) — source: ADR-0010
- **Rollback cost**: p95/max are Beta empirical measurements; no final budget accepted — source: ADR-0017
- **Reconnect**: at most 5 attempts, exponential backoff — source: ADR-0017
- **Finished Presentation**: up to 5 seconds — source: ADR-0013

### Engine API Constraints
- **`Physics.Simulate(FIXED_DT)` called only by Simulation** — source: ADR-0017
- **Local PhysX is NOT cross-machine deterministic** — source: ADR-0017
- **No online-services or real-time networking package is approved or installed** — source: ADR-0016

---

## Presentation Layer Rules

*Applies to: rendering, audio, UI, VFX, shaders, animations*

### Required Patterns
- **Camera = custom C# controller** (no Cinemachine dependency), reads interpolated VisualTransform in LateUpdate per ADR-0001 — source: ADR-0010
- **VFX = ParticleSystem** (no VFX Graph); CameraSystem and VfxSystem run in LateUpdate and never touch simulation state — source: ADR-0010
- **Cockpit is the default and primary camera mode** (amended 2026-08-05); Chase is the accessibility/spectacle option — source: ADR-0010
- **Cockpit FOV 78° → 95° quadratic** (dynamic); Reduced Motion pins FOV to the 78° base; dashboard visible; per-car cockpit offset from CarDefinition — source: ADR-0010
- **Chase FOV 70° → 90° quadratic**; Directional Velocity as FOV anchor (not raw speed); look-ahead = velocity direction projected on XZ (not car heading), quadratic factor ~0.5m low → ~3m high; no look-ahead in Cockpit — source: ADR-0010
- **PitCamera**: dedicated external camera active ONLY during InPitBox; 0.2s blends on entry/exit; side-aware offset (reads PitLaneSide from TrackData); FOV fixed 60°; no player control during service — source: ADR-0010
- **TerminalPresentation**: external three-quarter view of the player car, anchored per car/track; 0–5s, skippable via Confirm; no player camera switching during terminal presentation — source: ADR-0010
- **Chase ↔ Cockpit transition 0.35s** smooth blend (lerp position + Slerp rotation); no snap transitions except race start (Countdown → GO) — source: ADR-0010
- **SphereCast collision avoidance**: `Physics.SphereCast(origin, radius, direction, out hit, maxDistance)`, radius ~0.3m; ACTIVE during Reduced Motion (prevents visual clipping) — source: ADR-0010
- **Shake = three additive angular layers clamped at 3.0° total** (amended 2026-08-05): speed 0.6°–1.2° @ 4–12 Hz; surface 0.3°–0.6° @ 15–25 Hz; impact 0.8°–2.5° sharp decay 0.2–0.5s; when over 3.0°, lower-priority layers reduced first — source: ADR-0010
- **Shake source chain**: CarCollisionMonitor → VP writes CarState.WallContact → VfxSystem reads at tick → emits impactShakeRequest → CameraSystem applies; CameraSystem NEVER reads CarCollisionMonitor directly — source: ADR-0010
- **CameraSettings is the single source of truth for Reduced Motion** (per ADR-0004); Reduced: shake amplitude = 0, motion blur disabled, cockpit FOV pinned 78°, collision avoidance remains active — source: ADR-0010
- **Speed lines**: screen-space streaks on background only; FullScreenPassRendererFeature with Full Screen Shader Graph material (URP 17.3 Render Graph API — NOT legacy Blit); intensity `clamp((speed − streak_onset_speed)/(global_max_velocity − streak_onset_speed), 0, 1)`; streak_onset_speed default 100 km/h; global_max_velocity = max top speed across loaded grid; environment-colored — source: ADR-0010
- **Motion blur**: URP Volume override, Mode CameraOnly (cheaper), Clamp 0.05; disabled entirely in Reduced Motion; quality mapping — Low preset → override disabled (intensity 0), Medium → MotionBlurQuality.Low, High/Ultra → MotionBlurQuality.High; samples Medium 8 / High+Ultra 16 — source: ADR-0010
- **Tire smoke**: requested emission frame-delta scaled from grip loss; actual emission clamped by the per-car live-particle cap — source: ADR-0010
- **Sparks**: emitted on wall contact (VFX reads CarState.WallContact — never the monitor directly); 0.3–0.8s above 50 km/h, 0.5–1.2s above 150 km/h; no sustained spark — source: ADR-0010
- **Dust limited to 16 active emitters across the grid**; vignette follows speed formula, starts at 60% of global_max_velocity, caps at 0.4; exhaust heat shader-based (no particle); confetti at race finish 2s, lowest render priority — source: ADR-0010
- **Quality presets** (Low/Medium default/High/Ultra) with render scale 0.75×/0.85×/1.0×/1.0×; presets apply without recompilation or scene reload; PerformanceReduced → VFX Low preset + shake disabled; PerformanceRestored → restore previous — source: ADR-0010
- **Audio = Unity Audio Mixer + procedural-first engine (2-oscillator synthesis)** behind `IEngineSoundProvider` seam (procedural MVP; SampleEngineProvider is an approved fallback; hybrid future) — source: ADR-0012
- **AudioSystem runs in LateUpdate** (not per tick); mixer hierarchy Master → Music/SFX/UI; engine routes through SFX group (SFX mute mutes engine — by design); audio is 2D in MVP — source: ADR-0012
- **Tire squeal (TR-audio-003)**: `squeal_active = (grip_loss > 0.15) AND (speed > 30 km/h)`; `squeal_vol = grip_loss × (0.25 + 0.75 × wear_percent/100) × sfx_volume`; pitch constant 1200 Hz; `squeal_event_rate_mult = 0.1 + 0.9 × wear_percent/100` — source: ADR-0012
- **4 music stings (TR-audio-002)**: race_start_sting, final_lap_sting, finish_sting, pit_entry_sting; duck background music by 6 dB during playback; max 1 sting active (priority Finish > Final Lap > Race Start > Pit Entry); two triggers within 2s → higher priority wins; all four in Shared at startup — source: ADR-0012
- **9 audio states mirroring SimulationState** — source: ADR-0012
- **Engine amplitude fades to zero over 0.5s at empty fuel**; wind/tire/surface audio remain active; oscillator parameters pass to the audio thread via thread-safe handoff (ring buffer or Volatile.Read/Interlocked.Exchange) — source: ADR-0012
- **HUD = uGUI Canvas (Screen Space - Overlay), pre-built in scene** (no runtime instantiation); every element reads EXCLUSIVELY from `PublishedSimulationSnapshot` (or a lifecycle snapshot for non-ticking states) in LateUpdate — no direct system interface reads — source: ADR-0014
- **Element ownership**: Speed+Gear → VP CarState; Position/Lap/Rival Gap/Track Map → RSM GameState; Fuel Bar → FuelState; Tire Bar → TireState; current Lap Time → Simulation sim_time; recorded laps → RSM GameState.lapTimes[]; PIT THIS LAP → PitThisLap; Performance Warning → PerformanceReduced (event edge, auto-dismiss 3s) — source: ADR-0014
- **Track Map dots** from GameState.splinePositions[16] (tick-state positions, not interpolated); player dot via PlayerCarId; dot colors from CarDefinition.TeamColor — source: ADR-0014
- **8-element MVP Chase layout is the canonical contract**; Ghost 9th element Alpha+ additive; cockpit overlay toggle (`show_chase_hud_in_cockpit`) controls visibility only, not data source — source: ADR-0014
- **Readability contract**: 0.5s per glance at 200+ km/h; max 2 pieces of information per glance; fonts min 16px secondary / 24px primary at 1080p; white text on Asphalt Black (85% alpha) with 2px outline; state colors first, team colors for accents only — source: ADR-0014
- **Cockpit HUD = 4 elements**; Fuel/Tire warnings are color flashes only (no bars); thresholds — FuelState.state: Conserving yellow flash / Critical red flash / Empty red persistent; TireState.wearFraction: >0.50 yellow / >0.75 red / >0.90 red persistent — source: ADR-0014
- **Team theming**: borders/position/speed accent = team color; Fuel/Tire fills = state colors (never team colors); low-contrast fallback to white/black outline — source: ADR-0014
- **UI Menu (ADR-0019) screen flow** (linear-stack for menus): Title → Track Selection → Car Selection → Qualifying Not Started (Start Qualifying / Skip) → Qualifying Results → Loading → Countdown → Race; Settings from Title and Pause Menu; Pause Menu = Resume/Settings/Return to Menu (ReturnToMenu is the only route to Forfeit); Results = Continue/Back → Idle/Title, Next Race → Loading; Qualifying flow Start/Skip/Flying Lap phases per ADR-0013 — source: ADR-0019
- **Loading blocks Back/Cancel after loading begins** until RaceLoadReady or ContentLoadError (error → Title with message) — source: ADR-0019
- **Finished Presentation is the visible screen; UI Presentation is its controller** (timer, pause flag, DismissTerminalPresentation; never changes simulation state/race clocks/results) — source: ADR-0019
- **Qualifying Results permits Confirm (Start Race) only**; no timeout, no Back/Cancel path — source: ADR-0019
- **Navigation**: pointer hover+click (menu-only, never controls the car); keyboard/gamepad bindings per GDD Core Rule 1; focus stops at group boundary (never wraps); 2px pointer movement or click activates mouse (click assigns focus before activation); keyboard/gamepad Navigate/Confirm/Cancel hides pointer and updates glyphs; Confirm/Cancel not remappable in MVP — source: ADR-0019
- **Finished Presentation controls**: InputContextController disables InputSystemUIInputModule while SimulationState is Finished; routes UI Pause + Confirm directly to UI Presentation; suppresses Cancel; terminal timer pauses on focus loss — source: ADR-0019
- **`InputSystemUIInputModule` references OverdriveUI.Confirm as Submit and OverdriveUI.Cancel as Cancel**; Pause is a single logical action: OverdriveGameplay.Pause during gameplay, UI Cancel covers Escape in menus — source: ADR-0019
- **Keyboard-only and controller-only navigation required**; per-screen focus layouts from the UX spec before implementation — source: ADR-0019
- **Car Selection turntable**: 15 RPM (±10%; tuning range 5–30 RPM); Garage Lit warm lighting (amber/orange); stats as horizontal bars (0–20); fuel comparison bar/number; team colors on model + UI accents; turntable is presentation-only until "Select" confirmed — source: ADR-0019
- **Ghost car visualization**: opacity 0.4, URP Unlit + alpha blend, no collision, no engine audio — source: ADR-0008
- **Presentation consumes ADR-0017 corrective state via LateUpdate interpolation path only**; owns additional correction smoothing; never invokes simulation or replays domain state; Camera/HUD correction contracts (cadence, interpolation delay, max visible correction, "no visual pop" meaning) defined before Beta — source: ADR-0017

### Forbidden Approaches
- **Never use Cinemachine** — no dependency; custom camera is a simple Transform lerp — source: ADR-0010
- **Never use VFX Graph in MVP** — ParticleSystem universally supported — source: ADR-0010
- **Never use `ScriptableRenderPass.Execute()` / `Blit()`** — obsolete/dead code in URP 17.3 Render Graph; must use `RecordRenderGraph`; speed lines must use FullScreenPassRendererFeature — source: ADR-0010
- **CameraSystem NEVER reads CarCollisionMonitor directly** — shake flows via CarState.WallContact — source: ADR-0010
- **Do not assume a "MotionBlur Off" enum value exists** — URP MotionBlurQuality has NO Off; Low preset disables the override — source: ADR-0010
- **Never use UI Toolkit runtime for the HUD** — uGUI production-proven for racing HUDs — source: ADR-0014
- **Never use a custom mesh renderer for HUD** — 0.5ms budget achievable with uGUI — source: ADR-0014
- **Never use FMOD/Wwise middleware** — Unity Audio Mixer covers MVP scope — source: ADR-0012
- **Never use the 16-unique-per-car pre-recorded engine strategy as MVP default** — procedural-first; SampleEngineProvider remains an approved fallback — source: ADR-0012
- **Avoid the deprecated `_3D` `AudioClip.Create` overload** — MVP audio is 2D — source: ADR-0012

### Performance Guardrails
- **Camera + VFX combined ≤ 2.25 ms planned / 2.4 ms ceiling** (Camera 0.18 + VFX 1.27 + Unity overhead 0.80) — source: ADR-0010
- **HUD ≤ 0.5 ms per frame** (Canvas 0.15 + Text 0.10 + Bar 0.05 + Track Map 0.15 + Theming 0.02 + overhead 0.03) — source: ADR-0014
- **Audio ≤ 0.4 ms total** (engine ≤ 0.1; tire + SFX + music + ambient ≤ 0.3) — source: ADR-0012
- **Turntable 15 RPM (±10%)**; Finished Presentation ≤ 5s; pointer coexistence threshold 2 px — source: ADR-0019
- **PerformanceReduced**: < 30 FPS sustained 3s → VFX Low + shake disabled; restore after ≥ 30 FPS 3s — source: ADR-0010

### Engine API Constraints
- **URP 17.3 Volume overrides verified**: Volume, VolumeProfile, MotionBlur present; installed overrides: Bloom, Tonemapping, MotionBlur, Vignette — source: ADR-0010
- **`MotionBlurQuality` enum has NO Off value** — source: ADR-0010
- **VFX Graph and Cinemachine NOT installed** — source: ADR-0010
- **uGUI (UGUI 2.0.0) production-proven, no post-cutoff changes**; InputSystemUIInputModule verified routing — source: ADR-0014, ADR-0019

---

## Global Rules (All Layers)

### Naming Conventions
| Element | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `ContentPipelineSystem` |
| Variables | PascalCase visible / `_camelCase` private / camelCase params+locals | `_engineCylinders` |
| Signals/Events | PascalCase | `OnRaceLoadReady` |
| Files | PascalCase matching primary class | `CarDefinition.cs` |
| Scenes/Prefabs | PascalCase | `RaceFeelPrototype.unity` |
| Constants | PascalCase unless an ADR establishes a system-specific convention | `FIXED_DT` |
| Track JSON fields | snake_case (ADR-0007) | `segment_lengths` |
| Team IDs | `team_tier{1-4}_{a-d}` (length 12) | `team_tier1_a` |

### Performance Budgets
| Target | Value |
|--------|-------|
| Framerate | 60 FPS |
| Frame budget | 16.6 ms |
| Simulation tick | p95 ≤ 6 ms / max ≤ 8 ms |
| Camera + VFX | 2.25 ms planned / 2.4 ms ceiling |
| HUD | ≤ 0.5 ms |
| Audio | ≤ 0.4 ms |
| Fuel + Tire | ≤ 0.2 ms |
| Pit Stop | ~0.05 ms |
| Load (first) | ≤ 5s PC SSD / ≤ 10s WebGL |
| Draw calls | Establish from first representative PC + Web prototype |
| Memory ceiling | Establish from first representative PC + Web prototype |

### Approved Libraries / Addons
- Universal Render Pipeline 17.3.0 — rendering
- Input System 1.19.0 — input
- AI Navigation 2.0.14 — future pathfinding
- Addressables 3.1.0 — content management
- Unity Test Framework 1.6.0 (NUnit) — testing
- MCP for Unity (CoplayDev) `com.coplaydev.unity-mcp` — editor tooling
- No online-services provider or real-time networking SDK is approved before its Alpha or Beta selection ADR is Accepted (Coherence = candidate only)

### Forbidden APIs (Unity 6000.3.19f1)
These APIs are deprecated or unverified for the pinned engine; see `docs/engine-reference/unity/deprecated-apis.md`:
- `Input.*` APIs — use Input System actions/controls
- `Physics.RaycastAll()` — use non-allocating queries in hot paths
- `Resources.Load()` — use Addressables for content
- UGUI `Text` — use TextMeshPro for new text
- Legacy `Animation` component — use Animator for new gameplay animation
- `Rigidbody.velocity`/`drag`/`angularDrag` — use `linearVelocity`/`linearDamping`/`angularDamping` (renamed in 6000.3)
- `FixedUpdate()` for simulation logic — manual accumulator in `Update()` per ADR-0001
- `Time.fixedDeltaTime` as simulation tick constant — use the `FIXED_DT` constant (1/60)
- `ForceMode.Acceleration`/`ForceMode.Impulse` with force/impulse semantics — mass-scaling trap (memory #1737); force semantics → `ForceMode.Force`, pure m/s² values may use Acceleration directly
- `Screen.SetResolution` int-overload — project-policy: use `RefreshRate` struct (simple overload is not obsolete; this is project policy)
- `ScriptableRenderPass.Execute()`/`Blit()` — obsolete in URP 17.3 Render Graph; use `RecordRenderGraph`
- `AudioClip.Create` `_3D` overload — MVP audio is 2D

### Cross-Cutting Constraints
- **Simulation is sacred**: the 60 Hz tick pipeline is the single source of truth; no system mutates gameplay state outside the tick; no system reads `Time.deltaTime`/`Time.fixedDeltaTime` for gameplay timing; render is a projection of simulation state, never its driver — source: ADR-0001
- **Data flows one way through the tick**: systems consume from TickStartSnapshot, produce for the next step; no circular reads within a tick — source: ADR-0001
- **Ownership is exclusive**: every data field has exactly one owning system; other systems read via immutable snapshots or explicit producer methods — source: ADR-0001
- **Determinism is a feature**: gameplay randomness uses project-owned PCG32 with explicit uint64 seeds; `UnityEngine.Random` prohibited on the simulation path; all simulation math uses Unity.Mathematics — source: ADR-0001
- **Platform capability is data, not code**: car stats, tire compounds, AI archetypes, track geometry, DifficultyProfiles, control profiles — all data-driven — source: ADR-0015
- **Unity Test Framework required**: EditMode for deterministic logic, PlayMode for Unity behavior; balance formulas and gameplay systems covered; every fixed bug gets a regression test
- **Persistent documents and session state in English** (project rule #1422)
