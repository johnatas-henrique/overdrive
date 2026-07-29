# Control Manifest

> **Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS)
> **Last Updated**: 2026-07-28
> **Manifest Version**: 2026-07-28
> **ADRs Covered**: 0001, 0002, 0003, 0004, 0005, 0006, 0007, 0008, 0009, 0010, 0011
> **Status**: Active — regenerate with `/create-control-manifest update` when ADRs change

This manifest is a programmer's quick-reference extracted from all Accepted ADRs (11), technical preferences, and engine reference docs. For the reasoning behind each rule, see the referenced ADR.

Sources reconciled: Pipeline numbering uses the canonical 14-step model (ADR-0006 §4.2 + ADR-0011 §4). ADR-0001 and architecture.md use an abbreviated 13-step listing (resolve-at-start model); the reconciled 14-step model adds Step 9b (PitStopSystem) and Step 14 (resolve input) while preserving the same execution order. Pit phase enum uses `PitServicePhase { NotPitting, PitTransit, InPitBox, PitExiting }` per ADR-0011. FuelSystem.Tick signature includes `TickStartSnapshot` per ADR-0006 §4.2 (amended 2026-07-28).

---

## Foundation Layer Rules

*Applies to: simulation lifecycle, scene/state management, asset loading, settings persistence, input architecture, event architecture*

### Required Patterns

- **SimulationState writer**: Simulation Architecture is the sole writer of `SimulationState` (Finished, Results, Idle, Racing). RSM owns `RaceMode`. Content Pipeline emits readiness/unload — never writes SimulationState or starts Countdown/Racing. — **source: ADR-0001**
- **Manual physics**: `Physics.simulationMode = SimulationMode.Script`. One `Physics.Simulate(1/60f)` per active tick. — **source: ADR-0001**
- **Rigidbody.interpolation = None**: Manual interpolation runs in LateUpdate. Never set to Interpolate/Extrapolate. — **source: ADR-0001**
- **TickStartSnapshot assembly**: Assembled by Simulation driver before Step 1, distributed to all domain Tick() calls. No system reads before assembly is complete. — **source: ADR-0001 §3.2**
- **PerformanceReduced signal**: Simulation publishes after 3s sustained <30 FPS. VFX reduces particles, HUD shows warning, Camera disables look-ahead. After 3s ≥30 FPS → PerformanceRestored. Below 15 FPS for 3s after reduction → pause race. — **source: ADR-0001 §3.3**
- **Focus loss**: Creates non-physics lifecycle boundary before accumulator evaluation. No catch-up. Preserves remainder and counters. Publishes Paused. Requires explicit Resume. — **source: ADR-0001**
- **Grid lock**: VP holds cars in `IsGridLocked` until GO (tick 300). Input remains active; physics runs for engine/camera animation. — **source: ADR-0001**
- **300-tick countdown**: Fuel, tire, and race time start only at GO. — **source: ADR-0001**
- **RaceMode ownership split**: Simulation owns state machine. RSM owns mode/rules/transitions. Content Pipeline owns readiness. — **source: ADR-0001**
- **UI Presentation owns finished timer**: 0-5s timer, pauses on focus loss, accepts Confirm/Pause, suppresses Cancel. Continue/Back from Results sends `ContentUnloadRequest`. Simulation remains Results until `ContentUnloadComplete`. — **source: ADR-0001**
- **14-step pipeline**: Steps 1-14 per reconciled model (ADR-0006 §4.2 + ADR-0011). Step 9b (PitStopSystem), Step 11 (counters), Step 14 (resolve input). — **source: ADR-0006, ADR-0011**
- **Addressables for async loading**: All async asset loading via Addressables 3.1.0 API (`LoadAssetAsync`, `ReleaseInstance`, `Release`). — **source: ADR-0003**
- **3 Addressable groups**: `Shared` (startup: HUD, shaders, common audio, loading screen, input asset), `Cars/{teamId}` (race: prefab, materials, textures 2048, engine audio, CarDef SO), `Tracks/{trackId}` (race: mesh, environment, spline JSON, surface zones, pit geometry). — **source: ADR-0003**
- **CP_ state machine**: 7-8 states: `CP_Idle` → `CP_LoadingTrack` → `CP_LoadingCars` → `CP_Ready` → `CP_Racing` → `CP_Unloading` → `CP_Idle`. Plus `CP_RaceReconfigure` (during loading, synchronous, no Addressables I/O) and `CP_Error` (any load failure → `CP_Unloading` → `CP_Idle`). — **source: ADR-0003**
- **Parallel loading**: 16 car bundles in parallel (<15s on WebGL). 4 track bundles <10s each. Shared group <2s at startup. — **source: ADR-0003**
- **Error handling**: Track failure → abort (return to Idle). Shared failure → fatal. Car failure → skip car (continue with 15). — **source: ADR-0003**
- **PlayerPrefs JSON blob**: Single blob per primary+backup key (`OverdriveSettings` / `OverdriveSettings_Backup`). Backup-first write. — **source: ADR-0004**
- **Backup-first write**: Serialize → validate → write backup → write primary. If primary fails → restore from backup. If both fail → backup intact for next-launch recovery. — **source: ADR-0004**
- **SettingsEditSession**: Transactional preview with Snapshot (active at session start), Working (editable, previews immediately), Apply/Cancel (restores snapshot to runtime). — **source: ADR-0004**
- **DisplayConfirm**: 15s timer for resolution/fullscreen changes. `Screen.SetResolution(w, h, FullScreenMode.FullScreenWindow, refreshRate)` — mandatory FullScreenMode overload. — **source: ADR-0004**
- **DifficultyProfile immutable per race**: Snapshotted at race init, never mutated mid-race. 5 ScriptableObject assets at `Assets/Settings/Difficulty/`. — **source: ADR-0004**
- **InputContextController**: Sole owner of action map activation, context transitions, device switch arbitration, and CameraToggle routing. — **source: ADR-0005**
- **2 action maps**: `OverdriveGameplay` (contexts: GameplayRacing, GameplayQualifying, GameplayCountdown) and `OverdriveUI` (contexts: UI, PitTransit, PitService, Finished Presentation). — **source: ADR-0005**
- **Reserved actions**: Confirm (Enter/South), Cancel (Escape/East), Pause (Escape/Start during gameplay, P/Start during Finished). Not rebindable. — **source: ADR-0005**
- **Latching on context transition**: Every newly enabled digital action and UI Navigate control held at transition must be latched until neutral/released. Accelerate/Brake/Steer exempt from latching on UI→Gameplay resume. — **source: ADR-0005**
- **CameraToggle presentation-only**: Rising edge in DynamicUpdate, one toggle per press. Never enters simulation tick, Replay, or Ghost Recording. — **source: ADR-0005**
- **EMA reinitialization on scheme change**: `OnActiveSchemeChanged` → EMA state initialized from new scheme's post-dead-zone values. — **source: ADR-0005**
- **Load cascade**: Read primary → if corrupt → read backup → if both corrupt → factory defaults + "Settings restored" message. Migrate sequentially (v1→v2→v3). Validate every field (NaN/Inf → approved default). — **source: ADR-0004**

### Forbidden Approaches

- **Never write to `SimulationState` from RSM or Content Pipeline**: RSM owns mode, Simulation owns state. Content Pipeline never starts Countdown/Racing/Idle. — **source: ADR-0001**
- **Never use `FixedUpdate`**: Manual accumulator in `Update()`. The `VehiclePhysicsSystem` is a standalone class, not a MonoBehaviour. — **source: ADR-0001**
- **Never use `Resources.Load()` for content assets**: Addressables is the standard for all async asset loading. — **source: ADR-0003, deprecated-apis.md**
- **Never use individual PlayerPrefs keys**: Single JSON blob only. — **source: ADR-0004**
- **Never allow Difficulty changes mid-race**: Snapshotted at init, immutable for race duration. — **source: ADR-0004**
- **Never allow Confirm/Cancel/Pause rebinding**: Reserved for consistent UX. — **source: ADR-0005**
- **Never queue CameraToggle into simulation tick**: Presentation-only, same DynamicUpdate as capture. — **source: ADR-0005**

### Performance Guardrails

- **Simulation tick budget**: p95 ≤ 6 ms, max ≤ 8 ms (measured with 16 cars, Steps 1-14, excluding render/UI). — **source: ADR-0001**
- **Memory per race (PC)**: 730-1320 MB. **WebGL**: 415-670 MB. — **source: ADR-0003**
- **SettingsPersistence**: ~5 KB blob, no file IO. — **source: ADR-0004**
- **Ghost buffer**: 12 bytes/tick × 22,500 cap = ~264 KB uncompressed (~105 KB LZ4). — **source: ADR-0008**

---

## Core Layer Rules

*Applies to: vehicle physics, fuel, tire, track, pit stop, grip stack, tick pipeline Steps 5-14*

### Required Patterns

- **Rigidbody + custom grip**: Unity Physics 3D Rigidbody with custom arcade grip force model. Never WheelCollider. Never DOTS/ECS. — **source: ADR-0002**
- **IVehicleDriver seam**: Interface `ApplyForces/ReadCarState/ReadSimStateForNextTick` abstracts Rigidbody. MVP: `RigidbodyVehicleDriver`. Future DOTS: `DOTSVehicleDriver`. — **source: ADR-0002**
- **ForceMode.Acceleration**: Mass-independent force model for grip forces. — **source: ADR-0002**
- **CollisionDetectionMode**: Use `ContinuousDynamic` for player car, `Continuous` for AI cars. — **source: ADR-0002**
- **Trigger: grid-lock release**: GO tick. — **source: ADR-0002**
- **Force application order**: By ascending `carId`. — **source: ADR-0002**
- **CarState readout order**: By ascending `carId`. — **source: ADR-0002**
- **Physics.Simulate called by Simulation, not VP**: VP computes forces, Simulation calls `Physics.Simulate(FIXED_DT)`. — **source: ADR-0002**
- **CarCollisionMonitor**: MonoBehaviour on each car forwarding `OnCollisionEnter/Stay/Exit` to VP system. — **source: ADR-0002**
- **Perfect Start**: 1.15× `longitudinalDriveForceFinal` for 600 ticks after GO, if `rawThrottlePostDeadZone > 0.5 && rawBrakePostDeadZone == 0` at tick GO (from GO-12 through GO to GO). — **source: ADR-0002**
- **High-speed steer reduction**: ~25% reduction above 70% top speed, transition band 65-75%. — **source: ADR-0002**
- **Lift-off rotation assist**: 0.3s anti-spam cooldown. — **source: ADR-0002**
- **Wall contact**: 0.2-0.5s persist + 50% repeated-bounce reduction. — **source: ADR-0002**
- **Car-to-car collision**: 15-25% speed loss. — **source: ADR-0002**
- **Grip floor/ceiling**: `effective_grip` floor = 0.20, ceiling = 1.2. Grip stack: 4 multipliers (tire, surface, speed, aggression). — **source: ADR-0002**
- **FuelSystem/TireSystem**: Separate domain systems, pure C# math, Step 5a/5b before Physics.Simulate. — **source: ADR-0006**
- **Fuel consumption**: Base 0.06 L/s × throttle × `efficiency_modifier` (Normal difficulty). Lift-off stops consumption. — **source: ADR-0006, fuel-system.md**
- **Tire wear**: Continuous linear grip curve (no breakpoints), grip floor = 0.20 at fully worn. Driven by distance, aggression, off-track. — **source: ADR-0006**
- **Pit refueling**: FuelSystem reads `CarState.PitPhase` from TickStartSnapshot, applies 0.8 L/s during InPitBox. — **source: ADR-0006**
- **Pit tire swap**: TireSystem reads `CarState.PitPhase`, resets `wearFraction = 0` after 2s continuous InPitBox. — **source: ADR-0006**
- **lastLapFuelUse/lastLapTireWear**: Updated via RSM `LapCompleted` event subscription at Step 10, not inside per-tick Tick(). — **source: ADR-0006**
- **Countdown gating**: Fuel and Tire produce no changes when `SimulationState != Racing`. — **source: ADR-0006**
- **Qualifying**: Fuel loads reduced amount (`min(8.0L, fuel_rate × reference_flying_lap_time × 1.10)`). Tire wear disabled for single flying lap. — **source: ADR-0006**
- **Track JSON**: snake_case field naming, `schemaVersion=1`. `float3[]` points (not double). Catmull-Rom chordal interpolation. Pipeline: GPX/GeoJSON → Python + rasterio → JSON. — **source: ADR-0007**
- **16 pit boxes**: Track declares `PitLaneDefinition` with `pitBoxes[16]` and `pitEntryProgress` mapping. — **source: ADR-0007**
- **Surface modifiers**: Track owns per-car `surfaceWearMultiplier[]` and `surfaceGripMultiplier[]` via TickStartSnapshot. — **source: ADR-0007**
- **PitStopSystem**: Independent system owning service lifecycle. 4-phase `PitServicePhase { NotPitting, PitTransit, InPitBox, PitExiting }`. — **source: ADR-0011**
- **Entry detection**: VP detects zone crossing on tick N → queues `CarState.PitPhase = PitTransit`. PitStopSystem reads on tick N+1 at Step 9b. — **source: ADR-0011**
- **Service duration**: `max(2s, missingFuel / 0.8 L/s)`. Fuel and tire run in parallel. Player may exit after 2s with partial fuel (Confirm in PitService context). AI waits for full tank. — **source: ADR-0011**
- **PitThisLap advisory**: Checks both fuel AND tire against 110% of last lap usage. Window: `min(0.80, max(0.0, pitEntryProgress - 0.05))` to `pitEntryProgress`. — **source: ADR-0011**

### Forbidden Approaches

- **Never use WheelCollider**: Designed for realistic simulation, antithetical to arcade grip model. — **source: ADR-0002**
- **Never use DOTS/ECS for Vehicle Physics**: Not installed. Not needed for 16-car arcade. — **source: ADR-0002**
- **Never use `Physics.Simulate` from VehiclePhysicsSystem**: Called by Simulation only. — **source: ADR-0002**
- **Never use `UnityEngine.Random`, `System.Random` on simulation or AI path**: PCG32 is the only gameplay PRNG. — **source: ADR-0001, ADR-0009**
- **Never directly mutate FuelState/TireState from PitStopSystem**: Pit behavior gated by CarState.PitPhase read from TickStartSnapshot (Option B). No Fill()/Swap() API. — **source: ADR-0011, ADR-0006**
- **Never use AnimationCurve for spline data**: 2D only, no editor. Use JSON + Catmull-Rom. — **source: ADR-0007**

### Performance Guardrails

- **Fuel + Tire**: ≤0.2 ms combined for 16 cars. — **source: ADR-0006**
- **PitStopSystem**: ≤0.05 ms (pure C# counters, no allocations). — **source: ADR-0011**

---

## Feature Layer Rules

*Applies to: AI rival, ghost recording, replay*

### Required Patterns

- **AiRivalSystem**: Pure C# snapshot observer at Step 13. Same `VehiclePhysicsSystem` as player — no separate AI physics. — **source: ADR-0009**
- **Per-car PCG32**: Each car gets independent `PCG32(SimSeed, carId)` stream. Archetypes data-driven, not random. — **source: ADR-0009**
- **4 archetypes**: Consistent, Aggressive, Inconsistent, Cautious. `AiArchetype` struct data-driven. — **source: ADR-0009**
- **Pit projection**: 110% margin (`AiArchetype.pitProjectionMargin = 1.10`). Applies to both AI and player advisory. — **source: ADR-0009**
- **Ghost binary format**: 80-byte header + continuous input stream (12 bytes/tick: 3 × float32) + edge event stream (5 bytes/event: tick_index + flags). — **source: ADR-0008**
- **Track cap**: 22,500 ticks (375s × 60 Hz). Buffer marked non-serializable if exceeded. — **source: ADR-0008**
- **CRC32 per block**: 256-tick blocks for integrity validation. LZ4 compression optional (flagged in header). — **source: ADR-0008**
- **MVP always discard**: Buffer never persisted. Discarded unconditionally on Results/Forfeit/Idle/Load failure. — **source: ADR-0008**
- **Ghost visualization**: Opacity 0.4, URP Unlit + alpha blend, no collision, no engine audio. — **source: ADR-0008**

### Forbidden Approaches

- **Never drive AI with MonoBehaviour**: AI is pure C# per-tick evaluation. No Update(), no FixedUpdate(). — **source: ADR-0009**
- **Never use active obstacle avoidance in MVP**: Car-to-car collision resolved by Vehicle Physics. — **source: ADR-0009**
- **Never keep ghost buffer across races**: MVP unconditionally discards. — **source: ADR-0008**

---

## Presentation Layer Rules

*Applies to: camera, VFX, HUD, UI menu, audio*

### Required Patterns

- **CameraSystem**: Custom C# controller (no Cinemachine). Runs in DynamicUpdate consuming interpolated `VisualTransform`. — **source: ADR-0010**
- **VfxSystem**: ParticleSystem (no VFX Graph). Runs in DynamicUpdate. — **source: ADR-0010**
- **PitCamera**: Dedicated camera mode, active only during `InPitBox`. Blends from active camera at box arrival, back on `PitExiting`. — **source: ADR-0010**
- **Camera shake source chain**: `CarCollisionMonitor` → VP writes `CarState.WallContact` → VfxSystem reads at tick → emits `ImpactShakeRequest` → CameraSystem applies shake. CameraSystem must never subscribe to `CarCollisionMonitor` directly. — **source: ADR-0010**
- **100% RenderGraph**: All custom render passes must use `RecordRenderGraph`. No `ScriptableRenderPass.Execute()` or `Blit()`. — **source: ADR-0010, unity-specialist**
- **ParticleSystem is project standard**: Use for all new VFX. VFX Graph is not installed. — **source: deprecated-apis.md, current-best-practices.md**

### Forbidden Approaches

- **Never use Cinemachine**: Not installed. Custom C# camera controller. — **source: ADR-0010**
- **Never use VFX Graph**: Not installed. ParticleSystem for all VFX. — **source: ADR-0010**
- **Never use old Execute/Blit paths**: 100% RenderGraph required. — **source: ADR-0010**
- **Never subscribe CameraSystem to CarCollisionMonitor directly**: Shake chain must go through VfxSystem. — **source: ADR-0010**
- **Never use real-time GI**: Baked lighting only for all tracks. — **source: art-bible.md (environment)**

### Performance Guardrails

- **Camera**: 0.5 ms/frame (position, rotation, FOV, shake, mode transitions). — **source: ADR-0010**
- **VFX**: 1.6 ms/frame (particles, speed lines, confetti, heat haze). — **source: ADR-0010**
- **Camera + VFX combined**: 2.1 ms of ~16.6 ms frame budget (at 60 FPS, separate from 6 ms simulation budget). — **source: ADR-0010**

---

## Global Rules (All Layers)

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `VehiclePhysicsSystem`, `FuelState` |
| Public fields | PascalCase | `public float CurrentFuel` |
| Private fields | `_camelCase` | `private float _currentFuel` |
| Parameters/locals | camelCase | `float deltaTime` |
| Events/Signals | PascalCase | `LapCompleted`, `PitEntry` |
| Files | PascalCase matching primary class | `VehiclePhysicsSystem.cs` |
| Scenes/Prefabs | PascalCase | `SampleScene.unity` |
| Constants | PascalCase | `public const float FIXED_DT = 1f/60f` |
| JSON fields | snake_case | `schema_version`, `track_id` |
| Team IDs | `team_tier{N}_{letter}` | `team_tier1_a`, `team_tier4_d` |

### Performance Budgets

| Target | Value |
|--------|-------|
| Framerate | 60 FPS |
| Frame budget | 16.6 ms |
| Simulation budget (16 cars) | p95 ≤ 6 ms, max ≤ 8 ms |
| Camera budget | 0.5 ms/frame |
| VFX budget | 1.6 ms/frame |
| Fuel + Tire (16 cars) | ≤ 0.2 ms combined |
| PitStopSystem | ≤ 0.05 ms |
| Ghost buffer cap | 22,500 ticks (~264 KB uncompressed) |

### Approved Libraries / Addons

| Library | Version | Purpose |
|---------|---------|---------|
| Universal Render Pipeline | 17.3.0 | Rendering |
| Input System | 1.19.0 | Input handling |
| AI Navigation | 2.0.14 | AI pathfinding |
| Addressables | 3.1.0 | Async asset loading |
| Coherence | 2.1 | Multiplayer SDK (Alpha+) |
| Unity Test Framework | 1.6.0 | Testing (NUnit) |
| MCP for Unity | — | Editor tooling (CoplayDev) |

### Forbidden APIs (Unity 6000.3.19f1)

These APIs are deprecated or project-forbidden:

| API | Replacement | Source |
|-----|------------|--------|
| `Rigidbody.velocity` | `Rigidbody.linearVelocity` | deprecated-apis.md |
| `Rigidbody.drag` | `Rigidbody.linearDamping` | deprecated-apis.md |
| `Rigidbody.angularDrag` | `Rigidbody.angularDamping` | deprecated-apis.md |
| Input legacy (`Input.*`) | Input System actions/controls | deprecated-apis.md |
| `Resources.Load()` | Addressables (`LoadAssetAsync`) | ADR-0003 |
| `Physics.RaycastAll()` | Non-allocating queries in hot paths | deprecated-apis.md |
| `UnityEngine.Random`, `System.Random` on sim path | PCG32 | ADR-0001, ADR-0009 |
| `Screen.SetResolution(w, h, bool)` | `Screen.SetResolution(w, h, FullScreenMode, refreshRate)` | ADR-0004 |
| UGUI `Text` | TextMeshPro for new text | deprecated-apis.md |
| Legacy `Animation` component | Animator for new gameplay animation | deprecated-apis.md |
| `Unity.Entities.*`, `Unity.Netcode.*`, VFX Graph APIs | — (packages not installed) | current-best-practices.md |

### Cross-Cutting Constraints

- **PCG32 only**: No `UnityEngine.Random` or `System.Random` on simulation, AI, or ghost paths.
- **No FixedUpdate**: Manual accumulator in `Update()`. `Time.fixedDeltaTime`/`Time.deltaTime` not used in simulation systems.
- **No Runtime Instantiate/Destroy**: Use object pooling for particles, Addressables for asset lifecycle.
- **No quality tiers in MVP**: Single quality target (60 FPS). `QualitySettings.globalTextureMipmapLimit` for platform texture resolution.
- **No real-time GI**: Baked lighting.
- **No Framerate-dependent logic**: Never use `Time.deltaTime` in simulation path — use fixed `FIXED_DT = 1f/60f`.
