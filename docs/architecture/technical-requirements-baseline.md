# Technical Requirements Baseline

> **Source**: 24 GDDs + game-concept.md
> **Total**: ~200 requirements across all game systems
> **Created**: 2026-06-21
> **Purpose**: Traceability check against architecture decisions (ADRs)

---

### data-config-manager.md

| Req ID     | GDD                    | System         | Requirement                                                                                                                                                                             | Domain |
| ---------- | ---------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TR-DCM-001 | data-config-manager.md | Config Manager | Provide a typed `get<T>(key: string): T` method that throws `ConfigError('Key not found: ...')` on missing keys — never returns `undefined` or `null`.                                  | Data   |
| TR-DCM-002 | data-config-manager.md | Config Manager | `register(namespace, config)` with unique namespace enforcement; duplicate registration throws `ConfigError('Namespace already registered: ...')`.                                      | Data   |
| TR-DCM-003 | data-config-manager.md | Config Manager | Environment variable override system: prefix `OVERDRIVE__`, double underscore as path separator, leaf values only, highest precedence.                                                  | Data   |
| TR-DCM-004 | data-config-manager.md | Config Manager | Cache with per-namespace invalidation on Vite HMR hot-reload; replace entire namespace on reload (no deep merge).                                                                       | Data   |
| TR-DCM-005 | data-config-manager.md | Config Manager | Access logging ring buffer (last 500 entries) recording key, caller identity, and timestamp; in production only errors retained when overlay inactive.                                  | Data   |
| TR-DCM-006 | data-config-manager.md | Config Manager | Expose `getDebugState(): DebugState` for read-only debug overlay (all namespaces, current values post-override, access log).                                                            | Data   |
| TR-DCM-007 | data-config-manager.md | Config Manager | Initialize before any dependent system; cross-config init race detection — `get()` of unregistered namespace adds hint `'Possible init ordering issue — namespace not yet registered'`. | Data   |

### event-bus.md

| Req ID     | GDD          | System    | Requirement                                                                                                                                                                   | Domain        |
| ---------- | ------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| TR-EVB-001 | event-bus.md | Event Bus | Typed EventMap interface — every event is a property declaration; `emit()` and `on()` compile-time checked against payload type.                                              | Communication |
| TR-EVB-002 | event-bus.md | Event Bus | Synchronous dispatch — `emit()` executes all handlers in registration order on the same call stack; handler throws are caught individually, remaining handlers still execute. | Communication |
| TR-EVB-003 | event-bus.md | Event Bus | Single payload per event (exactly one argument) — no variadic arguments, enforced by type system.                                                                             | Communication |
| TR-EVB-004 | event-bus.md | Event Bus | `on()` returns `Subscription` with `.unsubscribe()`; leak detector at `dispose()` warns for every namespace with active subscriptions.                                        | Communication |
| TR-EVB-005 | event-bus.md | Event Bus | Circular emit depth detection (configurable, default 10) — emits beyond threshold throw `EventBusError('Max emit depth exceeded')` and abort the dispatch chain.              | Communication |
| TR-EVB-006 | event-bus.md | Event Bus | `once()` fires exactly one `emit()`, then auto-unsubscribes; `off()` removes a specific handler.                                                                              | Communication |
| TR-EVB-007 | event-bus.md | Event Bus | Subscribe during dispatch does not receive the current event; unsubscribe during dispatch does not cancel the currently-executing handler.                                    | Communication |
| TR-EVB-008 | event-bus.md | Event Bus | Zero dependencies on Babylon.js or any game system — standalone pure infrastructure.                                                                                          | Communication |

### game-state-machine.md

| Req ID     | GDD                   | System | Requirement                                                                                                                                              | Domain        |
| ---------- | --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| TR-GSM-001 | game-state-machine.md | GSM    | Transition table as `Record<State, State[]>` — transitions not in the table throw `GameStateError`; transition to same state is silent no-op.            | Orchestration |
| TR-GSM-002 | game-state-machine.md | GSM    | Per-state `onEnter()`/`onExit()` hooks returning `void` or `Promise<void>`; GSM awaits async hooks before completing transition.                         | Orchestration |
| TR-GSM-003 | game-state-machine.md | GSM    | On every transition emit two Event Bus events in order: `'gsm.state.exited'` (payload: `{ from }`) then `'gsm.state.entered'` (payload: `{ from, to }`). | Orchestration |
| TR-GSM-004 | game-state-machine.md | GSM    | Serialize transitions — max 1 transition per tick; subsequent calls in same tick queued for next.                                                        | Orchestration |
| TR-GSM-005 | game-state-machine.md | GSM    | State history ring buffer (last 20 transitions) recording from, to, timestamp, and duration in previous state.                                           | Orchestration |
| TR-GSM-006 | game-state-machine.md | GSM    | Async `onEnter()` rejection rolls back to previous state — error logged, transition aborted.                                                             | Orchestration |
| TR-GSM-007 | game-state-machine.md | GSM    | If Event Bus is unavailable during transition, state change still completes and warning is logged.                                                       | Orchestration |
| TR-GSM-008 | game-state-machine.md | GSM    | Dispose during mid-transition aborts: runs `onExit` of source state, does not run `onEnter` of target.                                                   | Orchestration |

### persistence.md

| Req ID     | GDD            | System      | Requirement                                                                                                                                                   | Domain |
| ---------- | -------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TR-PER-001 | persistence.md | Persistence | Async-first API — `save(key, data)` and `load<T>(key)` return `Promise<T>`; never call raw `localStorage` directly.                                           | Data   |
| TR-PER-002 | persistence.md | Persistence | Versioned payload container `{ version: number, data: unknown, timestamp: number }`; `load()` runs migration chain when stored version < current version.     | Data   |
| TR-PER-003 | persistence.md | Persistence | Global key prefix (default `'overdrive_'`) prepended to all storage keys to avoid cross-app collisions on same domain.                                        | Data   |
| TR-PER-004 | persistence.md | Persistence | Storage state machine (Uninitialized → Ready → Degraded); `init()` runs probe write to detect availability.                                                   | Data   |
| TR-PER-005 | persistence.md | Persistence | Error isolation — corrupted/unparseable save for one key returns `null` (logged), other keys unaffected.                                                      | Data   |
| TR-PER-006 | persistence.md | Persistence | Degraded mode: reads return `null`, writes queue in memory buffer (max 50 entries, FIFO discard); `retry()` re-probes storage.                                | Data   |
| TR-PER-007 | persistence.md | Persistence | Migration chain via `registerMigration(from, to, fn)` — walks `storedVersion → currentVersion` one step at a time; missing migration throws `MigrationError`. | Data   |

### simulation-snapshot.md

| Req ID     | GDD                    | System              | Requirement                                                                                                                                                     | Domain |
| ---------- | ---------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TR-SSN-001 | simulation-snapshot.md | Simulation Snapshot | `ISnapshotable` interface: `serialize(): Record<string, unknown>`, `deserialize(state)`, `hash(): string` — every system with mutable race state implements it. | State  |
| TR-SSN-002 | simulation-snapshot.md | Simulation Snapshot | Registration via `SimulationSnapshot.register(system)` with unique `systemId`; duplicate throws `SnapshotError`.                                                | State  |
| TR-SSN-003 | simulation-snapshot.md | Simulation Snapshot | Configurable snapshot frequency: every tick, every Nth tick, or on-demand; systems always expose full state via `serialize()`.                                  | State  |
| TR-SSN-004 | simulation-snapshot.md | Simulation Snapshot | Two-tier hashing: FNV-1a 64-bit for per-tick consistency checks (~50ns), SHA-256 via Web Crypto API for sync/save integrity (~1µs).                             | State  |
| TR-SSN-005 | simulation-snapshot.md | Simulation Snapshot | Full snapshots in MVP (JSON format, human-readable); `ISnapshotable` structured so delta compression can be added later without changing systems.               | State  |
| TR-SSN-006 | simulation-snapshot.md | Simulation Snapshot | Error isolation on restore — one system's `deserialize()` failure is caught and skipped; other systems restore normally.                                        | State  |
| TR-SSN-007 | simulation-snapshot.md | Simulation Snapshot | Caller responsible for snapshot timing at fixed game loop points (after all systems update for tick); snapshot mid-update may produce inconsistent state.       | State  |

### entity-car-lifecycle.md

| Req ID     | GDD                     | System               | Requirement                                                                                                                                            | Domain |
| ---------- | ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| TR-ECL-001 | entity-car-lifecycle.md | Entity/Car Lifecycle | `CarEntity` data structure with: `id`, `teamId`, `gridIndex`, `mesh: AbstractMesh`, `physicsBody: PhysicsAggregate`, optional `aiDriver: AIDriverRef`. | Entity |
| TR-ECL-002 | entity-car-lifecycle.md | Entity/Car Lifecycle | `spawnGrid(teams, playerTeamId)` clones from cached AssetContainer, creates PhysicsAggregate (convex hull, 800kg), assigns AIDriverRef per AI car.     | Entity |
| TR-ECL-003 | entity-car-lifecycle.md | Entity/Car Lifecycle | `destroyAll()` disposes all physics bodies, returns meshes to AssetContainer cache, clears entity map; `getEntity()` returns `null` post-destroy.      | Entity |
| TR-ECL-004 | entity-car-lifecycle.md | Entity/Car Lifecycle | Emit `'entity.spawned'` (carId, teamId, gridIndex) and `'entity.despawned'` (carId) on Event Bus for every car.                                        | Entity |
| TR-ECL-005 | entity-car-lifecycle.md | Entity/Car Lifecycle | Gate on double-spawn — `spawnGrid()` while Grid Active throws `EntityLifecycleError('Grid already active')`; `destroyAll()` must precede re-spawn.     | Entity |
| TR-ECL-006 | entity-car-lifecycle.md | Entity/Car Lifecycle | Guard flag during `destroyAll()` — once started, `getEntity()` returns null, physics calls become no-ops.                                              | Entity |
| TR-ECL-007 | entity-car-lifecycle.md | Entity/Car Lifecycle | Player and AI use identical `CarEntity` structure — player car has `aiDriver = undefined`; all systems treat all cars uniformly.                       | Entity |

### dev-tools.md

| Req ID     | GDD          | System    | Requirement                                                                                                                                                                                 | Domain  |
| ---------- | ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| TR-DVT-001 | dev-tools.md | Dev Tools | All Dev Tools code guarded by `if (import.meta.env.DEV)` — evaluated at compile time, code tree-shaken in production builds, zero bytes shipped.                                              | Tooling |
| TR-DVT-002 | dev-tools.md | Dev Tools | F1 toggles HTML overlay with `position: absolute; pointer-events: none;` over the canvas — never intercepts game input.                                                                     | Tooling |
| TR-DVT-003 | dev-tools.md | Dev Tools | Dev Tools is read-only on all systems — reads via public APIs, never writes game state, never calls `emit()` on Event Bus.                                                                  | Tooling |
| TR-DVT-004 | dev-tools.md | Dev Tools | F2 triggers manual config re-scan; overlay responds with changed value indication.                                                                                                          | Tooling |
| TR-DVT-005 | dev-tools.md | Dev Tools | Overlay components: config tree (collapsible `<details>` per namespace), AI telemetry table (per-car), event log (last 100 events, scrollable), GSM history timeline (last 20 transitions). | Tooling |
| TR-DVT-006 | dev-tools.md | Dev Tools | Read and display engine stats: FPS, frame time, draw calls, mesh count — from Babylon.js engine.                                                                                            | Tooling |
| TR-DVT-007 | dev-tools.md | Dev Tools | When overlay is visible, F1/F2 are consumed by Dev Tools and not forwarded to game input.                                                                                                   | Tooling |

### determinism-contract.md

| Req ID     | GDD                     | System              | Requirement                                                                                                                                                                                                    | Domain     |
| ---------- | ----------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| TR-DET-001 | determinism-contract.md | FixedUpdatePipeline | Fixed timestep simulation at exactly 1/60s with accumulator pattern — simulation decoupled from rendering; rendering may fluctuate, simulation never skips or duplicates a tick.                               | Simulation |
| TR-DET-002 | determinism-contract.md | FixedUpdatePipeline | `SeededRandom` LCG PRNG (Numerical Recipes constants) — all simulation random numbers use `SeededRandom` seeded per race, never `Math.random()`.                                                               | Simulation |
| TR-DET-003 | determinism-contract.md | FixedUpdatePipeline | Fixed system update order defined at startup as ordered array of `{ systemId, update }` inserted by index; order never changes mid-session.                                                                    | Simulation |
| TR-DET-004 | determinism-contract.md | FixedUpdatePipeline | Cross-platform determinism rules: no `Date.now()`/`performance.now()` during `fixedUpdate()`; no platform-divergent float ops; integer/fixed-point for critical values (fuel in centiliters, tire wear 0-100). | Simulation |
| TR-DET-005 | determinism-contract.md | FixedUpdatePipeline | Input buffered between ticks consumed exactly once per tick — never lost, never applied twice.                                                                                                                 | Simulation |
| TR-DET-006 | determinism-contract.md | FixedUpdatePipeline | Accumulator cap at `FIXED_DT × 4` (4 ticks max per frame) to prevent catch-up spiral on frame drops; frame delta clamped at 1s max.                                                                            | Simulation |
| TR-DET-007 | determinism-contract.md | FixedUpdatePipeline | Runtime assertion in dev builds that `Math.random` is never called during `fixedUpdate()`.                                                                                                                     | Simulation |

### asset-manager.md

| Req ID    | GDD              | System        | Requirement                                                                                                                                                                                             | Domain              |
| --------- | ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| TR-AM-001 | asset-manager.md | Asset Manager | Use Babylon.js `SceneLoader.LoadAssetContainerAsync()` as the sole loading primitive for all 3D assets. Side-effect import `@babylonjs/loaders/glTF/2.0/glTFLoader` required for GLB support.           | Engine capability   |
| TR-AM-002 | asset-manager.md | Asset Manager | Maintain two-scene architecture (`menuScene` persistent, `raceScene` per-race). Use `container.addAllToScene(scene)` / `container.removeAllFromScene()` to transfer containers without reloading files. | Architecture        |
| TR-AM-003 | asset-manager.md | Asset Manager | Manifest files in `src/config/assets/` must be pure TypeScript data objects with zero Babylon.js imports; the Asset Manager service owns all engine API calls.                                          | Data structure      |
| TR-AM-004 | asset-manager.md | Asset Manager | Cache all loaded `AssetContainer` objects for the session duration (no eviction in MVP — ~10 MB total). Repeated `load(id)` returns cached container with zero file I/O.                                | Performance / State |
| TR-AM-005 | asset-manager.md | Asset Manager | Car GLB loaded once; instantiated per team via `container.instantiateModelsToScene()` with `nameFunction` prefix to prevent mesh name collisions across 8 teams.                                        | Engine capability   |
| TR-AM-006 | asset-manager.md | Asset Manager | Emit `'asset.load.progress'` (loaded, total), `'asset.load.complete'`, and `'asset.error'` events on Event Bus for loading screen progress.                                                             | Cross-system        |
| TR-AM-007 | asset-manager.md | Asset Manager | On missing GLB file, reject and emit `'asset.error'` with manifest ID. On missing texture, detect Babylon's checkerboard fallback warning and emit `'asset.error'` (other assets continue loading).     | Reliability         |
| TR-AM-008 | asset-manager.md | Asset Manager | Subscribe to `'gsm.state.entered'` to trigger preloading during Loading→Menu, track load during Menu→PreRace, scene switch, and unload during PostRace→Menu.                                            | Cross-system        |
| TR-AM-009 | asset-manager.md | Asset Manager | Car textures: KTX2 with Basis compression, 512×512, `noMipmap: true`. Track textures: KTX2 with Basis, 1024×1024 with mipmaps. Textures shared across instances (single GPU copy).                      | Performance         |
| TR-AM-010 | asset-manager.md | Asset Manager | On `dispose()`, dispose all containers and clear the entire cache. Animation groups from disposed scenes are invalid — must re-clone from cached container each race.                                   | State               |

### input.md

| Req ID     | GDD      | System | Requirement                                                                                                                                                                                                                                      | Domain                |
| ---------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| TR-INP-001 | input.md | Input  | Read analog steering from gamepad left stick X-axis (-1..+1), throttle from right trigger (0..+1), brake from left trigger (0..+1). Apply dead zone: `output = abs(raw) < threshold ? 0 : sign(raw) × (abs(raw) - threshold) / (1 - threshold)`. | Engine capability     |
| TR-INP-002 | input.md | Input  | Map keyboard WASD/arrows to digital equivalents of steering/throttle/brake. Gear up/down produce discrete +1/-1 pulses per press, capped at most one shift per physics tick (16ms).                                                              | Engine capability     |
| TR-INP-003 | input.md | Input  | On browser tab focus loss, zero all analog outputs immediately (no stuck keys). On focus return, resume at current hardware state — no replay of missed events.                                                                                  | Timing                |
| TR-INP-004 | input.md | Input  | On controller disconnect, zero all gamepad outputs immediately. On reconnection, resume at current hardware state without replay. Keyboard remains active independently.                                                                         | Timing                |
| TR-INP-005 | input.md | Input  | Debounce camera toggle input at 200ms minimum interval between pulses (enforced at Input layer before event reaches Camera). Read debounce window from config.                                                                                   | Timing / Cross-system |
| TR-INP-006 | input.md | Input  | Subscribe to `gsm.state.entered` and `gsm.state.exited` on Event Bus; maintain local `currentState` copy (never call `gsm.getCurrent()`). Block all inputs during the transition window.                                                         | Cross-system          |
| TR-INP-007 | input.md | Input  | Track which device (keyboard or gamepad) last sent meaningful input (above dead zone). Adapt UI control hints accordingly.                                                                                                                       | Cross-system          |
| TR-INP-008 | input.md | Input  | Route `pauseToggle` to GSM: Racing → Paused, Paused → Racing. Silently ignore in other states. Route `confirm` per local state (PreRace skip, pitStopped exit, PostRace dispatch).                                                               | Cross-system          |
| TR-INP-009 | input.md | Input  | Deliver steering/throttle/brake values every tick without dropouts — a dropped throttle tick produces an audible pop in engine audio loop.                                                                                                       | Timing / Performance  |
| TR-INP-010 | input.md | Input  | Read all tuning knobs from Data & Config Manager at namespace `input.*`. Support HMR hot-reload — value changes update behavior live without restart.                                                                                            | Cross-system          |

### camera.md

| Req ID     | GDD       | System | Requirement                                                                                                                                                                                                               | Domain                  |
| ---------- | --------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| TR-CAM-001 | camera.md | Camera | Subscribe to `gsm.state.entered` events and switch modes: PreRace→Grid (static), Racing→cockpit/chase, PostRace→Drone (orbit). Transition to Racing preserves player's last toggle choice.                                | Cross-system            |
| TR-CAM-002 | camera.md | Camera | Cockpit camera: parent `FreeCamera` to `driver_eye` TransformNode within car GLB mesh hierarchy. Inherits car position, rotation, suspension movement — zero manual sync.                                                 | Engine capability       |
| TR-CAM-003 | camera.md | Camera | Chase camera: use Babylon.js `FollowCamera` with `cameraAcceleration` (default 0.005) and `maxCameraSpeed` (default 10). Validate position via raycast from car backward — if occluded, snap to closest unoccluded point. | Engine capability       |
| TR-CAM-004 | camera.md | Camera | FOV shift formula: `FOV = baseFOV + speedFactor × speedKmh`, clamped per-mode. Cockpit: base=75°, [65°,85°]; Chase: base=60°, [52°,68°]; `speedFactor` 0.05.                                                              | Data flow / Performance |
| TR-CAM-005 | camera.md | Camera | Shake system: 3D positional offset through a shake TransformNode with exponential decay: `shakeOffset = initialIntensity × e^(-decay × t) × randomUnitVector()`. Multiple shake sources stack additively.                 | Data structure / Timing |
| TR-CAM-006 | camera.md | Camera | PostRace drone: Babylon.js `ArcRotateCamera` at 8m fixed distance, auto-orbit at 15°/s around player car, FOV 65°. Skippable via confirm after 0.5s.                                                                      | Engine capability       |
| TR-CAM-007 | camera.md | Camera | PreRace grid camera: fixed static camera at 30m above track centerline, 40m ahead of grid, looking at 15m ahead of pole position, FOV 70°.                                                                                | Engine capability       |
| TR-CAM-008 | camera.md | Camera | Head bob and lateral lean expressed as local offsets on a child TransformNode — purely cosmetic, zero impact on car position/physics determinism.                                                                         | Data structure          |
| TR-CAM-009 | camera.md | Camera | Consume telemetry from Physics each tick: speedKmh, lateralG, accelG, kerbHit, offTrack. Consume `collision.impact` from Collision for shake proportional to impulse (player car only).                                   | Cross-system / Timing   |
| TR-CAM-010 | camera.md | Camera | All 27 tuning knobs read from Data & Config Manager namespace `camera.*`. Must support runtime HMR changes without restart.                                                                                               | Cross-system            |

### physics-handling.md

| Req ID         | GDD                 | System           | Requirement                                                                                                                                                                                                                           | Domain                   |
| -------------- | ------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------- | ------------------ |
| TR-PHYSICS-001 | physics-handling.md | Physics/Handling | Run exclusively at fixed timestep 1/60s in FixedUpdatePipeline — no physics in render loop. Accumulator capped at `FIXED_DT × 4`. Pipeline order: Input → Physics → AI → Collision → Fuel → Tire → RM → Pit Stop.                     | Timing / Performance     |
| TR-PHYSICS-002 | physics-handling.md | Physics/Handling | Lateral grip model: `gripMax = baseGrip × cornerStat(level) × tireCondition × speedMod` where `cornerStat(level) = 0.6 + (level - 1) × 0.1` and `speedMod = lerp(0.5, 1.0, clamp(speed / referenceSpeed, 0, 1))`.                     | Data structure           |
| TR-PHYSICS-003 | physics-handling.md | Physics/Handling | Lift-off oversteer: when throttle < 0.05 AND brake < 0.05 AND                                                                                                                                                                         | steering                 | > 0.1, rear grip multiplied by `liftOffRearFactor` (0.7). Grip imbalance creates rotation torque. | Timing / Data flow |
| TR-PHYSICS-004 | physics-handling.md | Physics/Handling | Velocity-dependent steering: `steeringLimit = steerMax × clamp(1 - speed/steerClampSpeed, steerMinRatio, 1.0)` with `steerClampSpeed=150`, `steerMinRatio=0.3`.                                                                       | Performance              |
| TR-PHYSICS-005 | physics-handling.md | Physics/Handling | Off-track surface: 6× friction multiplier (`offTrackFriction`), 70% grip reduction (`offTrackGripFactor=0.3`), minimum speed at 30% of top speed. Car can always rejoin.                                                              | Performance              |
| TR-PHYSICS-006 | physics-handling.md | Physics/Handling | Engine power: `power = torqueCurve(rpm) × throttle × fuelMult × powerCeiling`. `fuelMult` (0..1) from Fuel each tick. At 0: zero power, car coasts, emit `car.fuel_empty`. DNF when velocity < `stopEpsilon` (0.01) after fuel empty. | Cross-system / Timing    |
| TR-PHYSICS-007 | physics-handling.md | Physics/Handling | `tireCondition` (0..1) from Tire Wear each tick. Multiplies `gripMax` linearly. At 0: grip drops to `minGripFactor` (0.15). No automatic DNF.                                                                                         | Cross-system / Data flow |
| TR-PHYSICS-008 | physics-handling.md | Physics/Handling | Publish telemetry each tick to: Camera (speedKmh, lateralG, accelG, kerbHit, offTrack), Audio (rpm, speed, gear, lateralG), HUD (speed, rpm, gear).                                                                                   | Cross-system / Timing    |
| TR-PHYSICS-009 | physics-handling.md | Physics/Handling | Grid state: car locked via `setLocked(carId, true)` by RM. Unlocked by `setLocked(carId, false)` on `race.green.flag`. Pit speed enforcement via `setPitMode`.                                                                        | Cross-system / State     |
| TR-PHYSICS-010 | physics-handling.md | Physics/Handling | All formula constants, thresholds, mappings, and upgrade curves runtime-configurable from ConfigManager namespace `physics.*` with HMR support. No hardcoded magic numbers.                                                           | Cross-system             |

### collision.md

| Req ID           | GDD          | System    | Requirement                                                                                                                                                                       | Domain                  |
| ---------------- | ------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| TR-COLLISION-001 | collision.md | Collision | Subscribe to Havok's `onCollisionObservable` via Babylon.js and emit events on Event Bus. No polling, no `update()` method — entirely event-driven.                               | Engine capability       |
| TR-COLLISION-002 | collision.md | Collision | `collision.impact` payload: `{ carId, otherId, impulse, relativeVelocity, position }`. `otherId` is rival `carId` or `'barrier'`, distinguished via Havok collision filter group. | Data structure          |
| TR-COLLISION-003 | collision.md | Collision | Register Havok contact callbacks on PreRace GSM entry, unregister on PostRace GSM entry. No per-tick enable/disable.                                                              | Cross-system / Timing   |
| TR-COLLISION-004 | collision.md | Collision | Track+Environment assigns barrier meshes to Havok collision filter group `BARRIER`. Collision checks filter group on contact to set `otherId = 'barrier'`.                        | Cross-system            |
| TR-COLLISION-005 | collision.md | Collision | Filter `collision.impact` for camera shake: trigger only when `carId === playerCarId`. AI collisions never affect player camera.                                                  | Cross-system            |
| TR-COLLISION-006 | collision.md | Collision | Audio reacts to player collisions (thud/scrape by type) and nearby non-player collisions (muffled) when `relativePosition < 30m`.                                                 | Cross-system            |
| TR-COLLISION-007 | collision.md | Collision | Grazing barrier contact (angle < 5°) suppresses repeated `collision.impact` for same car+barrier pair within `grazeSuppress` frames (default 3).                                  | Timing / Performance    |
| TR-COLLISION-008 | collision.md | Collision | Multiple simultaneous contacts each produce individual `collision.impact` event. Consumers (Camera, Audio) throttle independently.                                                | Performance / Data flow |
| TR-COLLISION-009 | collision.md | Collision | No damage, deformation, or mechanical consequence from any collision event in Phase 1. Alpha Damage system consumes same events with no changes to Collision.                     | State                   |

### track-environment.md

| Req ID    | GDD                  | System              | Requirement                                                                                                                                                                                                      | Domain                          |
| --------- | -------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| TR-TE-001 | track-environment.md | Track + Environment | Track config via `TrackConfig` TypeScript interface: spline segments (`SplineSegment[]`), grid positions (26 × `Vec3`), pit entry/exit zones (`BoundingBox`), pit lane spline, 16 garage slots, sky palette ref. | Data structure                  |
| TR-TE-002 | track-environment.md | Track + Environment | Spline is authoritative for off-track detection (Physics reads `width` per segment via forward scan from last-known index — O(1) average per car per tick) and AI racing line.                                   | Performance / Cross-system      |
| TR-TE-003 | track-environment.md | Track + Environment | Own asset orchestration: read `TrackConfig`, issue load requests to Asset Manager, call `container.instantiateModelsToScene()`. Single Race calls only `load(trackId)`.                                          | Cross-system                    |
| TR-TE-004 | track-environment.md | Track + Environment | Share one static Havok physics impostor per element category (barriers, buildings, track surface, kerbs). Entire environment is static — no moving colliders.                                                    | Engine capability / Performance |
| TR-TE-005 | track-environment.md | Track + Environment | Detect car entry/exit of `pitEntryZone`/`pitExitZone` BoundingBox per tick and notify Pit Stop. Pit speed limit (80 km/h) enforced by Physics when `pit.active === true`.                                        | Cross-system / Timing           |
| TR-TE-006 | track-environment.md | Track + Environment | Expose `getTrackHalfWidth(splinePosition): number` returning `segment.width / 2` for AI overtaking feasibility.                                                                                                  | Data structure                  |
| TR-TE-007 | track-environment.md | Track + Environment | `load(trackId)` throws `ConfigError` if already in Ready state — caller must `dispose()` first. `dispose()` removes all track meshes, frees physics impostors.                                                   | State                           |
| TR-TE-008 | track-environment.md | Track + Environment | Validate spline data on load: mismatched `next` index and missing grid positions produce `ConfigError`. Pit exit spline endpoint must lie within `pitExitZone` bounding box.                                     | Reliability                     |
| TR-TE-009 | track-environment.md | Track + Environment | Two tracks referencing same asset key load the file once (Asset Manager cache). Race restart requires no asset reload — only reset car positions.                                                                | Performance / State             |

### fuel.md

| Req ID      | GDD     | System           | Requirement                                                                                                                                         | Domain                  |
| ----------- | ------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| TR-FUEL-001 | fuel.md | Fuel Consumption | Per-car `fuelLevel` updated each fixed tick via `fuelUsed = throttleAvg × baseRate × efficiencyRate × fixedDt`. ThrottleAvg from Physics each tick. | Data structure / Timing |
| TR-FUEL-002 | fuel.md | Fuel Consumption | `fuelMult = max(0.0, fuelLevel / maxCapacity)` sent to Physics next tick (one-tick delay) for `effectivePower = basePower × fuelMult`.              | Cross-system / Timing   |
| TR-FUEL-003 | fuel.md | Event Bus        | `car.fuel_empty` emitted when `fuelMult = 0`. Car coasts; DNF declared when velocity ≈ 0 (unless in pit). Each car emits independently.             | Cross-system            |
| TR-FUEL-004 | fuel.md | Fuel API         | `addFuel(carId, amount)` exposed as public API for Pit Stop. Clamps to `maxCapacity`. Only external write to fuel levels.                           | Cross-system            |
| TR-FUEL-005 | fuel.md | Upgrades         | Efficiency upgrade (L1–L5) → `efficiencyRate`: [1.0, 0.9, 0.8, 0.7, 0.6]. Per-team config.                                                          | Data structure          |
| TR-FUEL-006 | fuel.md | Configuration    | All tuning knobs in `fuel.*` namespace: `baseRate` (0.02), `upgradeL1–L5`, `maxCapacity` (global constant).                                         | Data structure          |
| TR-FUEL-007 | fuel.md | HUD              | HUD receives `fuelLevel` (0.0–1.0) per car each frame for fuel bar. Flash warning when `fuelMult < 0.1`.                                            | Cross-system            |
| TR-FUEL-008 | fuel.md | State Machine    | State: Inactive → Ready → Racing → Empty → Ready. Race restart resets all cars to `maxCapacity`.                                                    | State                   |
| TR-FUEL-009 | fuel.md | Dev Mode         | `baseRate = 0` disables fuel depletion (infinite fuel dev mode).                                                                                    | Performance             |
| TR-FUEL-010 | fuel.md | AI Integration   | AI Driver reads `fuelLevel` per car to inform pit timing and fuel conservation.                                                                     | Cross-system            |

### tire-wear.md

| Req ID      | GDD          | System              | Requirement                                                                                                                                         | Domain                  |
| ----------- | ------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| TR-TIRE-001 | tire-wear.md | Degradation Model   | Per-car `tireCondition` (0.0–1.0) updated each fixed tick. Receives `TireLoad` from Physics: `lateralG`, `accelG`, `brakeG`, `offTrack` flag.       | Data structure / Timing |
| TR-TIRE-002 | tire-wear.md | Degradation Formula | `tireLoad = ((lateralG × latFactor) + (accelG × accelFactor) + (brakeG × brakeFactor)) × (offTrack ? offTrackMult : 1.0)`.                          | Data structure          |
| TR-TIRE-003 | tire-wear.md | Physics Feedback    | `tireCondition` sent to Physics each tick for `gripMax`. At 0.0, grip drops to `physics.minGripFactor` (~15%). No DNF.                              | Cross-system / Timing   |
| TR-TIRE-004 | tire-wear.md | Event Bus           | `car.tire_blown` emitted when `tireCondition = 0`. Car continues at reduced grip.                                                                   | Cross-system            |
| TR-TIRE-005 | tire-wear.md | Tire API            | `resetTires(carId)` exposed for Pit Stop. Sets `tireCondition = 1.0`. Called after `tireChangeDelay`.                                               | Cross-system            |
| TR-TIRE-006 | tire-wear.md | Upgrades            | Durability upgrade (L1–L5) → `efficiencyRate`: [1.0, 0.9, 0.8, 0.7, 0.6]. Same progression as fuel.                                                 | Data structure          |
| TR-TIRE-007 | tire-wear.md | Configuration       | All knobs in `tire.*` namespace: `latFactor` (1.5), `accelFactor` (1.0), `baseDegradationRate` (0.01). Global `trackAbrasion` multiplier (0.5–2.0). | Data structure          |
| TR-TIRE-008 | tire-wear.md | HUD & Audio         | HUD receives `tireCondition` per car each frame with flash warning at < 0.2. Audio uses load data for tire squeal.                                  | Cross-system            |
| TR-TIRE-009 | tire-wear.md | Off-Track Detection | Track provides `offTrack` flag per tick (spline distance > width/2). Activates `offTrackMult` (~2.0×).                                              | Cross-system            |
| TR-TIRE-010 | tire-wear.md | State & Dev         | State: Inactive → Ready → Racing → Blown → Ready. Race restart resets all cars. `baseDegradationRate = 0` = dev mode.                               | State                   |

### ai-driver.md

| Req ID    | GDD          | System             | Requirement                                                                                                                                                                 | Domain                  |
| --------- | ------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| TR-AI-001 | ai-driver.md | AI Controller      | One `AIController` instance per AI car (7 total), ticking every physics tick during Racing. Produces steer/throttle/brake/gearDelta — same contract as player Input.        | Data structure / Timing |
| TR-AI-002 | ai-driver.md | Spline Following   | Steer = `clamp(PID(lateralError) + curvatureFeedforward, -1, 1)`. Lookahead at 5m. Dynamic `targetOffset` with smooth interpolation, capped by `offsetDelta` (0.05 m/tick). | Data structure          |
| TR-AI-003 | ai-driver.md | Speed Target       | `targetSpeed = min(maxSpeed, cornerSpeed)` where corner speed uses `sqrt(gripMax × gripMargin × curvatureRadius)`.                                                          | Data structure          |
| TR-AI-004 | ai-driver.md | Braking Model      | Brake distance: `(vCurr² - vTarget²) / (2 × brakeDecel × aggression)`. Aggression 0.8–1.2. Late braking causes natural understeer.                                          | Data structure          |
| TR-AI-005 | ai-driver.md | Overtaking         | State machine: Normal → Following (< 25m) → Passing (speedDiff > 5% for ≥3 ticks, curvature > 50m) → Normal. Passing offset clamped to track surface.                       | State / Cross-system    |
| TR-AI-006 | ai-driver.md | Parameter System   | 7 AI parameters from `teamPerformance` (0.0–1.0): `effective = baseMin + (tp × range) + SeededRandom(-variance, +variance)`. Three-tier variance.                           | Data structure          |
| TR-AI-007 | ai-driver.md | Difficulty Scaling | `singleRace.difficulty.*` (0.75×–1.25×) applied to `teamPerformance` before parameter computation. 5 levels.                                                                | Data structure          |
| TR-AI-008 | ai-driver.md | Gear Shifts        | AI shifts automatically: upshift at 95% maxRpm, downshift at 30% maxRpm. Instantaneous gear changes.                                                                        | Timing                  |
| TR-AI-009 | ai-driver.md | Pit Integration    | AI reads `fuelLevel` and `tireCondition` from Fuel/Tire Wear. Pit Stop blocks AI output during pit states.                                                                  | Cross-system            |
| TR-AI-010 | ai-driver.md | Determinism        | All simulation RNG uses `SeededRandom` seeded with race ID. `Math.random()` never used in simulation code.                                                                  | Performance             |

### pit-stop.md

| Req ID     | GDD         | System             | Requirement                                                                                                                                                                                     | Domain                |
| ---------- | ----------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| TR-PIT-001 | pit-stop.md | Pit Lifecycle      | Per-car `pitState`: `onTrack → pitEntry → pitStopped → departing → onTrack`. GSM stays in Racing. Spatial BoundingBox zones detected each tick by Track+Environment.                            | State / Cross-system  |
| TR-PIT-002 | pit-stop.md | Pit Guidance       | On pitEntry: Pit Stop overrides car input; Physics decelerates to `pitSpeedLimit` (80 km/h) over `speedTransitionTime` (2s). Spline follower guides car to garage slot. Velocity = 0 at garage. | Data structure        |
| TR-PIT-003 | pit-stop.md | Refuel             | Refuel starts immediately at pitStopped: `addFuel(carId, refuelRate × dt)` each tick. Player can confirm to exit early with partial fuel.                                                       | Cross-system          |
| TR-PIT-004 | pit-stop.md | Tire Change        | Tire change starts immediately at pitStopped. After `tireChangeDelay` (~2s), calls `resetTires(carId)`. Player cannot leave before tires complete.                                              | Cross-system / Timing |
| TR-PIT-005 | pit-stop.md | Merge Check        | Before pit exit, checks 30m clearance. If occupied, waits 200ms and retries. After 5s timeout, force-merges.                                                                                    | Cross-system / Timing |
| TR-PIT-006 | pit-stop.md | Configuration      | All knobs in `pit.*` namespace: `refuelRate`, `tireChangeDelay`, `exitGraceTimeout`, `mergeCheckDistance`, `forceMergeTimeout`, `speedTransitionTime`.                                          | Data structure        |
| TR-PIT-007 | pit-stop.md | Race Timing        | RM records `pitTotal = entryTravel + serviceTime + exitWait + exitTravel` per car. Visible in results.                                                                                          | Persistence           |
| TR-PIT-008 | pit-stop.md | Event Bus          | Emits `pit.entry`, `pit.exit`, `pit.status`, `pit.fuel_status`, `pit.tire_status` for HUD and audio.                                                                                            | Cross-system          |
| TR-PIT-009 | pit-stop.md | AI Pit             | AI pits when fuel/tires critical. Waits for both services complete before exit. 16 garage slots, 8 active in MVP.                                                                               | Cross-system          |
| TR-PIT-010 | pit-stop.md | Auto-Release & Dev | Auto-release after `exitGraceTimeout` (~3s) if player doesn't confirm after services complete. Dev: `refuelRate = 0` = instant; `tireChangeDelay = 0` = instant.                                | Timing                |

### race-management.md

| Req ID    | GDD                | System          | Requirement                                                                                                                                                                       | Domain             |
| --------- | ------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| TR-RM-001 | race-management.md | Race Management | Internal sub-state machine (Countdown → GreenFlag → Racing → Checkered) driven by fixed tick pipeline (60 Hz), not async timers/setTimeout. GSM stays in Racing throughout.       | Timing             |
| TR-RM-002 | race-management.md | Race Management | Position grid recomputed every tick via `lap × trackLength + splinePosition` with hysteresis threshold (0.5m) to prevent position flicker.                                        | Data / Performance |
| TR-RM-003 | race-management.md | Race Management | Lap detection via spline position wrap-around: `prev > trackLength × 0.9 && current < trackLength × 0.1`. Reverse crossings ignored.                                              | Data               |
| TR-RM-004 | race-management.md | Race Management | DNF pipeline: subscribe `car.fuel_empty` → pendingDNF; on `car.stopped`, check exceptions (pit zone, finish line) → register DNF or skip.                                         | State machine      |
| TR-RM-005 | race-management.md | Race Management | Race results computed once at `endRace()`: sort finishers by totalDistance, then DNF cars by distance, assign positions. Results frozen after endRace().                          | Data / Persistence |
| TR-RM-006 | race-management.md | Race Management | Race clock in game ticks (1/60s each), starts at GreenFlag, stops at Checkered. Lap time measured finish-line to finish-line. Best lap = min lapTime.                             | Timing             |
| TR-RM-007 | race-management.md | Race Management | `RaceConfiguration.seed` passed to `SeededRandom` at init. All simulation RNG draws from this single seeded instance.                                                             | Cross-system (RNG) |
| TR-RM-008 | race-management.md | Race Management | Subscribe to 7+ events; emit 8+ event types (race.starting, race.light.countdown, race.green.flag, car.lap.completed, race.checkered, race.completed, car.dnf, position.changed). | Cross-system       |
| TR-RM-009 | race-management.md | Race Management | `init()` must call `eventBus.off()` before `eventBus.on()` for each subscription to prevent listener duplication on Race Again.                                                   | State machine      |
| TR-RM-010 | race-management.md | Race Management | Fail-fast validation: invalid RaceConfiguration (lapCount=0, unknown trackId) throws ConfigError at init before any race starts.                                                  | Data validation    |

### single-race.md

| Req ID    | GDD            | System      | Requirement                                                                                                                            | Domain        |
| --------- | -------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| TR-SR-001 | single-race.md | Single Race | `buildConfig()` produces valid `RaceConfiguration` from player menu selections. Defaults from ConfigManager.                           | Data          |
| TR-SR-002 | single-race.md | Single Race | Grid fixed at 8 cars. Player team excluded from AI assignment. Remaining 7 teams assigned with `teamPerformance` scaled by difficulty. | Data          |
| TR-SR-003 | single-race.md | Single Race | `seed` defaults to `Date.now()` at race start; accepts override for deterministic replay. Config stored in memory cache.               | State         |
| TR-SR-004 | single-race.md | Single Race | Difficulty multiplier (0.75×–1.25×, 5 levels) scales all AI `teamPerformance`. Configurable via `singleRace.difficulty.*`.             | Data / Config |
| TR-SR-005 | single-race.md | Single Race | Single Race is a function-call adapter with zero state, no tick, no Event Bus subscriptions. Exits after `buildConfig()`.              | Architecture  |
| TR-SR-006 | single-race.md | Single Race | Race Again preserves selections. Main Menu clears all selections. Cache invalidated on Main Menu.                                      | State         |

### hud.md

| Req ID     | GDD    | System | Requirement                                                                                                                                          | Domain               |
| ---------- | ------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| TR-HUD-001 | hud.md | HUD    | Renders via Babylon.js GUI (AdvancedDynamicTexture) with `idealHeight = 1080`. Zone-based layout: Grid columns 20%/58%/22% (proportional fractions). | Engine capability    |
| TR-HUD-002 | hud.md | HUD    | All HUD updates driven by Event Bus events (consumer-only). SpeedBlock reads `playerCar.physics.speedKmh` at 20hz throttle via Event Bus.            | Cross-system         |
| TR-HUD-003 | hud.md | HUD    | Modular HudBlock interface: `onActivate(ctx)` / `onDeactivate(ctx)`. Blocks repositionable via HudConfig zone assignments.                           | Architecture         |
| TR-HUD-004 | hud.md | HUD    | ResourcesBlock throttled to ~6 updates/s (every 10 ticks). Critical fuel ≤15% pulses red, tire ≤20% pulses red.                                      | Performance          |
| TR-HUD-005 | hud.md | HUD    | HUD lifecycle tied to GSM: activate on Racing entry, deactivate on PostRace. PitOverlay replaces HUD on pit.status.                                  | State machine        |
| TR-HUD-006 | hud.md | HUD    | HudConfig via `hud.*` namespace with HMR. Zone widths, block visibility, sizes apply within 1 tick.                                                  | Config / Performance |
| TR-HUD-007 | hud.md | HUD    | All animations mechanical (flips, ticks, cuts) — no smooth fades. Configurable per-block via HudAnimStyle.                                           | Timing / UX          |
| TR-HUD-008 | hud.md | HUD    | MinimapBlock requires track outline polyline from Track+Environment. Must not crash if absent — renders empty dark container with "MAP" label.       | Data / Resilience    |

### audio.md

| Req ID       | GDD      | System | Requirement                                                                                                                                                                                 | Domain                     |
| ------------ | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| TR-AUDIO-001 | audio.md | Audio  | Must use Babylon.js Audio Engine V2 APIs. Four AudioBus instances (music/sfx/ui/ambient) with independent volume through master gain.                                                       | Engine capability          |
| TR-AUDIO-002 | audio.md | Audio  | Engine sound: hybrid WAV loop (`CreateSoundAsync` + `playbackRate`) + OscillatorNode (`CreateSoundSourceAsync`) on same `sfxBus`. RPM from physics (60hz). Volume proportional to throttle. | Performance / Cross-system |
| TR-AUDIO-003 | audio.md | Audio  | Tire squeal: single looping WAV triggered when `lateralG` exceeds threshold. Effective threshold decreases with tire wear.                                                                  | Cross-system               |
| TR-AUDIO-004 | audio.md | Audio  | Collision sounds: `maxInstances: 5`. Player collisions full volume. Rival collisions within 30m muffled (-12dB).                                                                            | Performance / Cross-system |
| TR-AUDIO-005 | audio.md | Audio  | GSM state transitions with 500ms linear crossfade via `setVolume()` with `AudioParameterRampShape.Linear`. All 6 GSM states mapped.                                                         | State machine / Timing     |
| TR-AUDIO-006 | audio.md | Audio  | Audio init during Loading. Context unlock via `resumeOnInteraction: true`. Sample load failure → fallback to oscillator-only engine sound.                                                  | Engine capability          |
| TR-AUDIO-007 | audio.md | Audio  | RPM pitch spikes interpolated over 3 ticks (~16ms ramp) to prevent glitching. Configurable via `rpmRampTicks`.                                                                              | Timing / Performance       |
| TR-AUDIO-008 | audio.md | Audio  | All 18 tuning knobs via ConfigManager `audio.*` namespace, runtime-configurable.                                                                                                            | Config                     |

### menu-lite.md

| Req ID      | GDD          | System    | Requirement                                                                                                                                                            | Domain                 |
| ----------- | ------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| TR-MENU-001 | menu-lite.md | Menu LITE | All screens via Babylon.js GUI. Screen stack: one active at a time, Back/ESC pops. Title is stack bottom; ESC on Title ignored.                                        | Engine capability      |
| TR-MENU-002 | menu-lite.md | Menu LITE | Navigation: keyboard (arrows/wasd + ENTER + ESC) and gamepad (D-pad + A + B). Confirm buttons single-fire — second press in same tick ignored.                         | Input                  |
| TR-MENU-003 | menu-lite.md | Menu LITE | Car Select: 8 team cards. Track Select: 4 track cards. Team colour accent updates reactively on selection.                                                             | Data / UI              |
| TR-MENU-004 | menu-lite.md | Menu LITE | Race Settings: lap count (3/5/10/20, default from config) and difficulty (5 levels). Confirmed as `RaceConfiguration` to Single Race.                                  | Data / Cross-system    |
| TR-MENU-005 | menu-lite.md | Menu LITE | Loading screen: min duration (`menu.minLoadDuration`, default 2000ms). Waits for assets OR min duration, whichever longer. 10s timeout → "Still loading..." indicator. | Timing / Performance   |
| TR-MENU-006 | menu-lite.md | Menu LITE | Results screen on GSM PostRace. Position (animated count-up), time (monospace), fastest lap, rival reaction. Race Again preserves selections. Main Menu clears all.    | State / UI             |
| TR-MENU-007 | menu-lite.md | Menu LITE | All screens follow Misto dark-panel style: #0d0d0f background, #111114 panel, 8px radius, team colour accent ≤5% screen area.                                          | Engine capability (UI) |

### telemetry-recorder.md

| Req ID           | GDD                   | System             | Requirement                                                                                                                                                   | Domain              |
| ---------------- | --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| TR-TELEMETRY-001 | telemetry-recorder.md | Telemetry Recorder | All code guarded by `if (import.meta.env.DEV)` — zero bytes in production builds.                                                                            | Build / Performance |
| TR-TELEMETRY-002 | telemetry-recorder.md | Telemetry Recorder | Samples at 20 Hz (every 3 ticks). 13 fields per sample: tick, t, speed, rpm, throttle, brake, steer, gear, lateralG, fuel, tireCondition, splinePos, aiState. | Performance / Data  |
| TR-TELEMETRY-003 | telemetry-recorder.md | Telemetry Recorder | Console log every 5 seconds (configurable `logInterval`, default 300 ticks) during Racing: positions and speeds for all 8 cars.                               | Performance         |
| TR-TELEMETRY-004 | telemetry-recorder.md | Telemetry Recorder | JSON export via Dev Tools (F3) and `window.__telemetry.export()`. Output: race metadata + per-car sample arrays.                                              | Data / Cross-system |
| TR-TELEMETRY-005 | telemetry-recorder.md | Telemetry Recorder | Samples accumulated in plain arrays per car. Cleared on `race.started`. Retained for despawned cars. ~1.4 MB/hour/car.                                        | Data / Performance  |
| TR-TELEMETRY-006 | telemetry-recorder.md | Telemetry Recorder | Reads from 5 systems: Physics, Fuel, Tire Wear, AI Driver, Race Management — direct CarEntity reads.                                                          | Cross-system        |

### game-concept.md

| Req ID    | GDD             | System       | Requirement                                                                                                                                       | Domain             |
| --------- | --------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| TR-GC-001 | game-concept.md | Championship | Single F1 championship, multi-season. Persist: standings, car upgrades, crew upgrades, team reputation, season progress. Save/exit between races. | Persistence        |
| TR-GC-002 | game-concept.md | Economy      | Dual economy: Credits → car parts, XP → crew upgrades. All costs/curves externalised to JSON config.                                              | Data / Config      |
| TR-GC-003 | game-concept.md | AI Driver    | 8-team grid with distinct AI personality profiles (aggressiveness, consistency, defensiveness, error rate). Same physics model as player.         | Cross-system       |
| TR-GC-004 | game-concept.md | Grid / Race  | Inverted grid from previous race. Must support grid position ordering per race session.                                                           | Data / State       |
| TR-GC-005 | game-concept.md | Progression  | Car parts (4 parts, L1–L5) modifying base stats. Per-team upgrade ceiling: backmarker max L3, midfield max L4, top max L5.                        | Data / Persistence |
| TR-GC-006 | game-concept.md | Physics      | Fixed-step physics at minimum 60 Hz, decoupled from render. Zero input lag. Camera FOV auto-adjustment by speed.                                  | Performance        |
| TR-GC-007 | game-concept.md | Network      | Multiplayer netcode layer from day 0: state container separates sim from rendering. Replay system supports network sync validation.               | Architecture       |
