# Overdrive — Master Architecture

## Document Status

- **Version**: 1.0 (complete)
- **Last Updated**: 2026-06-21
- **Engine**: Babylon.js 9.12.0
- **GDDs Covered**: 24 MVP (all systems-index entries) + game-concept.md
- **ADRs Written**: 25 (ADR-0001 through ADR-0025, all Accepted)

## Engine Knowledge Gap Summary

| Risk       | Domains                                                                   | Systems Affected            | Mitigation / Action                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **HIGH**   | Audio Engine V2 (node-based API, legacy `Sound` deprecated since 8.0)     | Audio Manager (#22)         | ADR-0020 (Accepted) — pure Audio Engine V2 via `CreateSoundAsync` + `AudioBus` + `CreateSoundSourceAsync`. No legacy `Sound` class. See ADR-0020 for complete API. |
| **HIGH**   | Vite build (webpack removed in 9.5)                                       | Project build system        | Use `vite.config.ts` template from engine-reference. Standard Vite config, no special migration needed.                                                            |
| **HIGH**   | TypeScript 6.0 (removed ts-patch, native `using` declarations)            | All systems                 | Project does not use ts-patch. Native `using` is additive, not breaking. No action.                                                                                |
| **HIGH**   | @babylonjs/havok 1.3.12 (ESM WASM, independent versioning)                | Physics/Handling, Collision | `optimizeDeps.exclude: ["@babylonjs/havok"]` in vite.config.ts. WASM loader verified in scaffolding doc.                                                           |
| **MEDIUM** | PhysicsBody API (disablePreStep, Aggregate options immutability in v9.12) | Physics/Handling            | Havok auto-step must be suppressed; `executeStep(dt, scene)` called manually in FixedUpdatePipeline slot #2. See Data Flow.                                        |
| **MEDIUM** | SceneLoader async APIs (LoadAsync, AppendAsync, ImportMeshAsync)          | Asset Manager               | Use `LoadAssetContainerAsync` exclusively. Verified pattern in engine-reference modules/rendering.md.                                                              |
| **MEDIUM** | GUI markAsDirty public API                                                | HUD                         | Existing API — verified functional in engine-reference modules/ui.md. No migration needed.                                                                         |
| **MEDIUM** | DSM gamepad detection (v9.11 Linux fix)                                   | Input                       | `DeviceSourceManager` API unchanged. Linux fix is automatic. Verified in engine-reference modules/input.md.                                                        |
| **LOW**    | Scene management, cameras, meshes, materials                              | All remaining systems       | Within training data coverage. Synchronous API surface confirms to known patterns.                                                                                 |

**HIGH risk resolution status**:

- Audio Engine V2 → resolved via ADR-0020 (Accepted). Pure V2 path: `CreateSoundAsync` for engine WAV loops, `CreateSoundSourceAsync` for synth overlays, `AudioBus` for 4-channel mixing (music, sfx, ui, ambient). No legacy `Sound` class, no hybrid approach.
- Vite 9.5 → resolved in scaffolding doc. No migration risk.
- TypeScript 6.0 → no action. Project uses standard TS, no ts-patch.
- @babylonjs/havok 1.3.12 → resolved in scaffolding doc (`optimizeDeps.exclude` pattern).

## System Layer Map

Approved 2026-06-21.

### Foundation Layer (7 systems)

Zero engine dependency — pure TypeScript. Initialized first.

| System                   | Dependency      | Risk |
| ------------------------ | --------------- | ---- |
| Data & Config Manager    | None            | —    |
| Event Bus                | None            | —    |
| Game State Machine (GSM) | Event Bus       | —    |
| Determinism Contract     | None            | —    |
| Persistence              | None (Web APIs) | —    |
| Simulation Snapshot      | None            | —    |

### Core Layer (12 systems)

Engine-dependent runtime systems. Transforms simulation data per-car.

| System               | Dependencies                                | Risk                       |
| -------------------- | ------------------------------------------- | -------------------------- |
| Asset Manager        | Data & Config                               | MEDIUM (SceneLoader async) |
| Entity/Car Lifecycle | Asset Manager, Event Bus                    | LOW                        |
| Input                | Babylon.js DSM                              | MEDIUM (DSM v9.11)         |
| Camera               | Babylon.js cameras                          | LOW                        |
| Physics/Handling     | Babylon.js Havok                            | MEDIUM (Havok v1.3.12)     |
| Collision            | Havok                                       | MEDIUM                     |
| Track + Environment  | Asset Manager                               | LOW                        |
| Fuel                 | Physics                                     | LOW                        |
| Tire Wear            | Physics, Track                              | LOW                        |
| AI Driver            | Track, Physics, Fuel, Tire                  | LOW                        |
| Pit Stop             | Track, Physics, Fuel, Tire, Race Management | LOW                        |
| Race Management      | 10+ systems (see Phase 2)                   | LOW                        |

### Feature Layer (1 system)

Mode-specific adapters that consume Core services.

| System      | Dependencies               |
| ----------- | -------------------------- |
| Single Race | Race Management, Menu LITE |

### Presentation Layer (3 systems)

Player-facing output.

| System    | Dependencies       | Risk                   |
| --------- | ------------------ | ---------------------- |
| HUD       | Event Bus, Physics | MEDIUM (GUI API)       |
| Audio     | Event Bus, Physics | HIGH (Audio Engine V2) |
| Menu LITE | GSM, Input         | LOW                    |

### Dev & Infrastructure (2 systems)

Cross-cutting, compiled out in production.

| System             | Dependencies                                            |
| ------------------ | ------------------------------------------------------- |
| Dev Tools          | Event Bus, Config, GSM, Simulation Snapshot, Babylon.js |
| Telemetry Recorder | Physics, Fuel, Tire Wear, AI Driver, Race Management    |

---

## Module Ownership

Approved 2026-06-21.

### Foundation Layer

| Module                | Owns                                                                                                            | Exposes                                                                                  | Consumes                                    | Engine APIs |
| --------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------- | ----------- |
| Data & Config Manager | `ConfigManager` instance, ring buffer (500 entries), per-namespace cache                                        | `register(namespace, config)`, `get<T>(key)`, `getDebugState()`                          | None                                        | None        |
| Event Bus             | `EventMap` type registry, subscriber lists per event, leak detector                                             | `on<T>(handler): Subscription`, `emit(event, payload)`, `once()`, `off()`, `dispose()`   | None                                        | None        |
| GSM                   | Current state, valid transition table `Record<State, State[]>`, state history (20 entries), async hook registry | `transition(to)`, `getState()`, `getHistory()`                                           | Event Bus (`gsm.state.entered`/`exited`)    | None        |
| Determinism Contract  | `SeededRandom` instance (LCG), `FixedUpdatePipeline` (ordered array), tick accumulator                          | `register(systemId, fn, slotIndex)`, `random()`, `randomRange(min, max)`, `randomSign()` | None                                        | None        |
| Persistence           | Storage key prefix, migration registry, memory queue (50 max)                                                   | `save(key, data)`, `load<T>(key)`, `registerMigration(from, to, fn)`, `retry()`          | None                                        | None        |
| Simulation Snapshot   | `Map<systemId, ISnapshotable>`, snapshot history                                                                | `register(system)`, `takeSnapshot(): Snapshot`, `restore(snapshot)`, `getHash(): string` | `ISnapshotable` from each registered system | None        |

### Core Layer

| Module                                         | Owns                                                                                                                       | Exposes                                                                                                                                                                | Consumes                                                                                                                                      | Engine APIs                                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Asset Manager                                  | `Map<id, AssetContainer>` cache, manifest, two-scene references (menu + race)                                              | `preload(ids)`, `load(id)`, `setActiveScene(scene)`, `disposeContainer(id)`                                                                                            | Data & Config (manifest paths)                                                                                                                | `SceneLoader.LoadAssetContainerAsync` (MEDIUM), `container.addAllToScene()`, `container.instantiateModelsToScene()` |
| Entity/Car Lifecycle (_moved from Foundation_) | `CarEntity[]` (mesh + body refs), spawn/despawn tracking, `destroyAll()` guard flag                                        | `spawnGrid(config)`, `destroyAll()`, `getEntity(carId)`                                                                                                                | Asset Manager (AssetContainers), Event Bus (emits `entity.spawned`/`despawned`)                                                               | `PhysicsAggregate` creation, `container.instantiateModelsToScene()`                                                 |
| Input                                          | Axis states (steer -1..1, throttle 0..1, brake 0..1), digital buffer, local `currentState` copy (from GSM events)          | `getState(): InputState`                                                                                                                                               | GSM state (via Event Bus), Babylon.js DSM + GamepadManager                                                                                    | `DeviceSourceManager` (MEDIUM), `GamepadManager` (LOW)                                                              |
| Camera                                         | Camera instances (cockpit FreeCamera, chase FollowCamera, drone ArcRotateCamera), current mode, shake state accumulators   | None (side-effect only — renders player view)                                                                                                                          | Physics (speed, lateralG, kerbHit, offTrack), Collision (impulse), GSM (state), Entity/Car (player mesh)                                      | `FreeCamera` (LOW), `FollowCamera` (LOW), `ArcRotateCamera` (LOW), `TransformNode` parenting                        |
| Physics/Handling                               | Per-car simulation state: speed, RPM, gear, grip, splinePosition. `Map<carId, PhysicsState>`                               | `getSpeed(carId)`, `getRPM(carId)`, `getGear(carId)`, `getLoads(carId)`, `setLocked(carId, bool)`, `setPit(carId, bool)`, `brakeCar(carId, force)`, `isStopped(carId)` | Input (steer, throttle, brake, gearDelta), Track (spline, grip surface), Fuel (fuelMult), Tire (tireCondition)                                | `HavokPlugin` (MEDIUM), `PhysicsBody` (MEDIUM), `PhysicsAggregate` (LOW)                                            |
| Collision                                      | Havok contact callback registrations, collision filter groups                                                              | None (side-effect only — emits `collision.impact`)                                                                                                                     | Havok contact callbacks, Entity/Car (mesh references for filter groups)                                                                       | `PhysicsBody.setCollisionGroup()`, `setCollisionMask()` (LOW)                                                       |
| Track + Environment                            | TrackConfig, `SplineSegment[]`, per-car last-known segment index, pit zone detection                                       | `getTrackHalfWidth(pos): number`, `isInPitEntryZone(carId): bool`, `isInPitExitZone(carId): bool`, `getSegment(pos): SplineSegment`, `load(trackId)`, `dispose()`      | Asset Manager (track GLB + textures)                                                                                                          | `MeshBuilder`, `Texture` (sky) (LOW)                                                                                |
| Fuel                                           | `Map<carId, { fuelLevel, efficiencyRate }>`, per-car fuelMult                                                              | `addFuel(carId, amount)`, `getFuelLevel(carId)`, `getFuelMult(carId)`                                                                                                  | Physics (throttleAvg per tick), Data & Config (baseRate, upgrade levels, maxCapacity)                                                         | None                                                                                                                |
| Tire Wear                                      | `Map<carId, { tireCondition, efficiencyRate }>`, per-car load factors                                                      | `resetTires(carId)`, `getTireCondition(carId)`                                                                                                                         | Physics (lateralG, accelG, brakeG per tick), Track (offTrack flag), Data & Config (rates, upgrade levels, trackAbrasion)                      | None                                                                                                                |
| AI Driver                                      | `Map<carId, AIController>` (params, spline follower, overtaking FSM), variance assignments                                 | `getState(carId): { steer, throttle, brake, gearDelta }`                                                                                                               | Track (spline, width), Physics (speed, position), Fuel (fuelLevel), Tire (tireCondition), Collision (impact), Race Management (position data) | None                                                                                                                |
| Pit Stop                                       | `Map<carId, PitState>` (onTrack → pitEntry → pitStopped → departing → onTrack), merge check timer                          | `getPitState(carId)`, `isInPitZone(carId)`                                                                                                                             | Track (pit zone detection), Physics (`setPit`, `brakeCar`), Fuel (`addFuel`), Tire (`resetTires`), Race Management (pit exit event)           | None                                                                                                                |
| Race Management                                | `RaceConfiguration`, `Map<carId, { laps, totalDistance, pitStopCount, pitTotalTime }>`, pendingDNF registry, results cache | `init(config)`, `startRace()`, `getResults(): RaceResults`, `endRace()`                                                                                                | Physics (`car.stopped`, speed), Fuel (`car.fuel_empty`), Tire (`car.tire_blown`), Pit Stop (`pit.exit`), GSM (state), Collision (impact)      | None                                                                                                                |

### Feature Layer

| Module      | Owns                                                                | Exposes                                       | Consumes                                                           |
| ----------- | ------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| Single Race | None (thin adapter — no state, no tick, no Event Bus subscriptions) | `start()` (called by Menu LITE on race start) | Race Management (`init()` + `startRace()`), Menu LITE (selections) |

### Presentation Layer

| Module    | Owns                                                                                                      | Exposes                                                       | Consumes                                                                                                         | Engine APIs                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| HUD       | ADT instances (race HUD, pit overlay, pause overlay), `Map<blockId, BlockController>`, zone layout config | None (side-effect only — renders player-facing data)          | Event Bus (race events, state changes), Physics (speed — direct read per frame exception)                        | `AdvancedDynamicTexture` (LOW), `TextBlock`, `Rectangle`, `Image`, `StackPanel`, `Grid` (LOW) |
| Audio     | 4 AudioBus groups (music, sfx, ui, ambient), engine oscillator nodes per active car, volume prefs         | `setVolume(category, vol)`, `playMusic(trackId)`, `stopAll()` | Event Bus (GSM state transitions, race events), Physics (rpm, speed, throttle, lateralG — direct reads per tick) | Audio Engine V2 (`AudioEngineV2`, `AudioBus`), Web Audio `OscillatorNode` (LOW)               |
| Menu LITE | ADT instances per screen, screen stack (array), local selections state                                    | None (side-effect only — renders + navigates screens)         | GSM (PreRace → triggers race start), Input (navigation pulses), Asset Manager (car thumbnails, track cards)      | `AdvancedDynamicTexture` (LOW)                                                                |

### Dev & Infrastructure

| Module             | Owns                                                             | Exposes                                              | Consumes                                                                                                                                                                                                        | Engine APIs                                         |
| ------------------ | ---------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Dev Tools          | HTML overlay DOM, FPS/draw call sampling, section collapse state | None (side-effect only — guarded by `__DEV__`)       | Event Bus (all events for inspector), Config Manager (namespaces), GSM (state history), Simulation Snapshot (system hashes), Engine (stats)                                                                     | `engine.getFps()`, `scene.getActiveMeshes().length` |
| Telemetry Recorder | `TelemetrySample[]` per car, console log timer                   | `window.__telemetry.export()` (guarded by `__DEV__`) | Physics (speed, rpm, throttle, brake, steer, gear, lateralG), Fuel (fuelLevel), Tire (tireCondition), AI Driver (aiState — Normal/Following/Passing), Race Management (splinePosition, elapsedTime, currentLap) | None                                                |

### Dependency Diagram

```
FOUNDATION                    CORE                          PRESENTATION
┌──────────────┐       ┌──────────────────┐
│ Config       │       │    Asset Manager  │──→ Track+Env
│ Manager      │       │                  │
└──────┬───────┘       └──────────────────┘
       │                      │
       │               ┌──────▼───────┐       ┌───────────┐
       │               │    Input     │       │   HUD     │ ←── Physics,
       │               └──────┬───────┘       │           │     events
       │                      │               └───────────┘
┌──────▼───────┐       ┌──────▼───────┐       ┌───────────┐
│  Event Bus   │       │  Physics/    │──→ Fuel│   Audio   │ ←── Physics,
│              │       │  Handling    │──→ Tire│           │     events
└──────┬───────┘       │              │──→ AI  └───────────┘
       │               └──────┬───────┘
       │gsm.state.*           │              ┌───────────┐
       ▼                      │              │ Menu LITE │ ←── Input,
┌──────────────┐              ▼              │           │     GSM
│     GSM      │         ┌──────────┐        └─────┬─────┘
│              │         │ Pit Stop │──→ Fuel.addFuel │
│              │         │          │──→ Tire.reset   │
└──────┬───────┘         │          │──→ Physics.setPit│
       │                 └────┬─────┘                  │
       │                      │                        │
       ▼                      ▼                        ▼
┌──────────────┐         ┌──────────────────┐    ┌──────────────┐
│ Persistence  │         │ Race Management  │◄───│ Single Race  │
│ SimSnapshot  │         │                  │    └──────────────┘
│ Determinism  │         └──────────────────┘
└──────────────┘

CORE
┌──────────────┐
│ Entity/Car   │
└──────────────┘

DEV INFRA
┌──────────────────┐  ┌───────────────────┐
│   Dev Tools      │  │ Telemetry Recorder│
│ (reads all,      │  │ (reads Physics,   │
│  never writes)   │  │  Fuel, Tire, AI,  │
└──────────────────┘  │  Race Mgmt)       │
                      └───────────────────┘
```

**Direction**: arrows point from consumer to producer. E.g. `Physics → Fuel` means Fuel consumes Physics data.

### Engine Awareness

| System        | Engine API                                      | Risk                                                       | Verification                                                                                           |
| ------------- | ----------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Audio         | Audio Engine V2 (`AudioEngineV2` + `AudioBus`)  | MEDIUM (V2 stable since 7.52, verified in ADR-0020)        | engine-ref modules/audio.md — Audio Engine V2 confirmed via ADR-0020. `Sound` class (legacy) not used. |
| Audio         | Web Audio `OscillatorNode`                      | LOW (Web API, not Babylon.js)                              | —                                                                                                      |
| Asset Manager | `SceneLoader.LoadAssetContainerAsync`           | MEDIUM (v7.34+ async-only return signature)                | engine-ref modules/rendering.md                                                                        |
| Input         | `DeviceSourceManager`                           | MEDIUM (v9.11 Linux gamepad detection fix)                 | engine-ref modules/input.md                                                                            |
| Physics       | `HavokPlugin` + `PhysicsBody`                   | MEDIUM (v9.12 disablePreStep, options object immutability) | engine-ref modules/physics.md                                                                          |
| Camera        | `FreeCamera`, `FollowCamera`, `ArcRotateCamera` | LOW (training data)                                        | engine-ref modules/rendering.md                                                                        |
| HUD           | `AdvancedDynamicTexture`, controls              | LOW (training data)                                        | engine-ref modules/ui.md                                                                               |
| Menu LITE     | `AdvancedDynamicTexture`                        | LOW (training data)                                        | engine-ref modules/ui.md                                                                               |

## Data Flow

Approved 2026-06-21.

### 1. Frame Update Path (Fixed Tick)

The fixed pipeline runs at exactly 1/60s. Slots execute in order every tick:

```
[Accumulator check] → if (accumulator >= FIXED_DT):

  Slot 1: Input.poll()
  Slot 2: Physics/Handling      ← Input (steer/throttle/brake/gearDelta)
  Slot 3: AI Driver             ← Track (spline), Physics (speed, load)
  Slot 4: Collision             (no-op — emits events via Havok callbacks)
  Slot 5: Fuel                  ← Physics (throttleAvg)
  Slot 6: Tire Wear             ← Physics (lateralG, accelG, brakeG)
  Slot 7: Race Management       ← all systems (reads state, writes results)
  Slot 8: Pit Stop              ← Track (pit zone), Physics (state)

  → accumulator -= FIXED_DT

[Rendering] — visual interpolation between tick N and N+1
```

**Data transfer per slot** (all synchronous, same call stack):

| Data                                  | Producer           | Consumer                   | Mechanism                                                |
| ------------------------------------- | ------------------ | -------------------------- | -------------------------------------------------------- |
| steer, throttle, brake, gearDelta     | Input              | Physics/Handling           | `getState()` (direct)                                    |
| steer, throttle, brake (AI cars)      | AI Driver          | Physics/Handling           | `getState(carId)` (direct)                               |
| fuelMult                              | Fuel (tick N)      | Physics (tick N+1)         | `getFuelMult(carId)` (direct)                            |
| tireCondition                         | Tire Wear (tick N) | Physics (tick N+1)         | `getTireCondition(carId)` (direct)                       |
| throttleAvg, lateralG, accelG, brakeG | Physics            | Fuel, Tire Wear            | `getLoads(carId)` (direct)                               |
| splinePosition, speed                 | Physics            | Race Management, AI Driver | `getSpeed(carId)` (direct)                               |
| fuelLevel                             | Fuel               | AI Driver, HUD, Pit Stop   | `getFuelLevel(carId)` (direct)                           |
| tireCondition                         | Tire Wear          | AI Driver, HUD, Pit Stop   | `getTireCondition(carId)` (direct)                       |
| pitState, pitZone                     | Pit Stop, Track    | Race Management            | `getPitState(carId)`, `isInPitEntryZone(carId)` (direct) |

### 2. Event/Signal Path

Decoupled systems (Presentation, condition-triggered reactions) communicate via Event Bus. All dispatch is synchronous — `emit()` runs all handlers before returning.

| Event                        | Producer                   | Consumers                             | Trigger                                                 |
| ---------------------------- | -------------------------- | ------------------------------------- | ------------------------------------------------------- |
| `gsm.state.entered`/`exited` | GSM                        | Input, Camera, Audio, HUD, Dev Tools  | Every GSM transition                                    |
| `entity.spawned`/`despawned` | Entity/Car Lifecycle       | Fuel, Tire Wear, AI, Camera, Pit Stop | Car created/destroyed on grid                           |
| `collision.impact`           | Collision                  | Camera, Audio, AI Driver              | Havok contact between two bodies                        |
| `car.fuel_empty`             | Fuel                       | Race Management, Audio, HUD           | fuelLevel = 0                                           |
| `car.tire_blown`             | Tire Wear                  | Physics, Audio, HUD, Race Management  | tireCondition = 0                                       |
| `car.stopped`                | Physics                    | Race Management                       | engineDead && speed ≈ 0                                 |
| `pit.entry`                  | Pit Stop                   | Race Management, HUD, Audio           | Car enters pitEntry zone                                |
| `pit.exit`                   | Pit Stop                   | Race Management, HUD, Audio           | Car leaves pitExit zone                                 |
| `pit.status`                 | Pit Stop                   | HUD, Audio                            | pitState changes (per-car)                              |
| `pit.fuel_status`            | Pit Stop                   | HUD                                   | Refuel progress update                                  |
| `pit.tire_status`            | Pit Stop                   | HUD                                   | Tire change progress update                             |
| `position.changed`           | Race Management            | HUD, Audio, AI Driver                 | Car position changes (hysteresis threshold met)         |
| `race.starting`              | Race Management (deferred) | HUD (CountdownBlock), Camera          | Countdown begins (first pipeline tick after GSM→Racing) |
| `race.light.countdown`       | Race Management            | HUD                                   | Each light turns off (5→4→...→1→0)                      |
| `race.green.flag`            | Race Management            | Physics, HUD, Audio, AI Driver        | Countdown complete → race active                        |
| `race.completed`             | Race Management            | Audio, Menu LITE                      | Player crosses finish line on final lap                 |
| `race.abandoned`             | Race Management            | Audio, Menu LITE                      | Quit from Paused (no results recorded)                  |
| `asset.load.start`           | Asset Manager              | Menu LITE, HUD                        | Batch loading started                                   |
| `asset.load.progress`        | Asset Manager              | Menu LITE, HUD                        | Per-file load progress (loaded, total)                  |
| `asset.load.complete`        | Asset Manager              | Menu LITE, HUD                        | Single asset finished loading                           |
| `asset.load.allComplete`     | Asset Manager              | Menu LITE, HUD                        | Entire batch finished loading                           |
| `asset.error`                | Asset Manager              | GSM, Dev Tools                        | Asset load failure                                      |

**Event payload convention**: minimal identity only (e.g. `{ carId }`). Heavy per-frame data (speed, fuelLevel, tireCondition) is always direct getter call — never wrapped in events.

### 3. Save/Load Path

Only Persistence in MVP. Session state is volatile (Single Race has no save).

**Scope:**

- Audio volume preferences: `Persistence.save('audio_prefs', { musicVol, sfxVol })`
- Storage format: `{ version: "0.1.0", data: { ... }, timestamp: number }` via localStorage
- Migration chain registered by Audio system on init

**Non-persisted by design:**

- Race state (volatile — fresh each race)
- Config overrides (HMR-sourced, gitignored local files)
- Dev Tools preferences (fresh start every session)

**Championship Mode (Alpha)** will add `Persistence.save('championship', progress)` — deferred.

### 4. Initialization Order

Dependency graph determines order. Foundation → Core → Presentation → Dev Infra.

```
FOUNDATION (ordered):
  1. Data & Config Manager      — root, zero dependencies
  2. Determinism Contract       — FixedUpdatePipeline, SeededRandom
  3. Persistence                — probes localStorage
  4. Event Bus                  — communication backbone
  5. GSM                        — needs Event Bus
  6. Simulation Snapshot        — interface-driven
  [GSM.transition('Menu') — GSM begins emitting]

CORE (group A — engine bootstrap):
  7. Asset Manager              — creates menuScene & raceScene, preloads assets
  8. Entity/Car Lifecycle       — needs Event Bus, Asset Manager (containers)
  9. Input                      — Babylon.js DSM + GamepadManager
 10. Camera                     — no follow target yet
 11. Track + Environment        — loads TrackConfig

CORE (group B — simulation):
 12. Physics/Handling           — Havok init, registers in FixedUpdatePipeline
 13. Collision                  — registers Havok callbacks
 14. Fuel                       — registers ISnapshotable
 15. Tire Wear                  — registers ISnapshotable
 16. AI Driver                  — loads team params
 17. Pit Stop                   — registers in pipeline (slot #8)
 18. Race Management            — subscribes to events, idle until race

PRESENTATION:
 19. HUD                        — creates ADT, blocks hidden until race.green.flag
 20. Audio                      — creates AudioBuses, loads engine samples
 21. Menu LITE                  — creates ADT, shows Title Screen

DEV INFRA:
 22. Dev Tools                  — registers hotkeys, __DEV__ only
 23. Telemetry Recorder         — waits for race.started, __DEV__ only
```

**Race start sequence (gameplay, not init):**

```
Menu → PreRace:
  SingleRace.buildConfig() → Track.load() + RM.init() + Entity.spawnGrid()
  GSM → PreRace
  Camera shows Grid (8s, skippable via confirm)
  GSM → Racing
  RM.startRace():
    ├── emit race.starting (deferred to first pipeline tick)
    ├── countdown 5→4→3→2→1→0 (emits race.light.countdown per light)
    ├── emit race.green.flag
    ├── Physics.setLocked(carId, false) — all cars released
    ├── Fuel/Tire/AI begin consuming
    └── RM race clock starts
```

## API Boundaries

Approved 2026-06-21.

Public contracts between modules in TypeScript pseudocode. These are the invariants that each boundary guarantees.

### Root: ConfigManager

```typescript
interface IConfigManager {
  register(namespace: string, config: Record<string, unknown>): void;
  get<T>(key: string): T;
  getDebugState(): ConfigDebugState;
}

// Invariants:
// - register() throws ConfigError if namespace already registered
// - get() throws ConfigError if key not found — never returns undefined
// - First get() caches value for session lifetime
// - HMR invalidates cache per-namespace
```

### Communication: Event Bus

```typescript
interface IEventBus {
  on<E extends keyof EventMap>(
    event: E,
    handler: (payload: EventMap[E]) => void
  ): Subscription;
  once<E extends keyof EventMap>(
    event: E,
    handler: (payload: EventMap[E]) => void
  ): Subscription;
  emit<E extends keyof EventMap>(event: E, payload: EventMap[E]): void;
  off(handler: Subscription): void;
  dispose(): void;
}

// Invariants:
// - emit() executes all handlers synchronously on same call stack
// - subscribe during dispatch does NOT receive current event
// - handler error does not affect other handlers
// - Systems MUST call .unsubscribe() on dispose
```

### Fixed Update Pipeline (Determinism)

```typescript
interface IFixedUpdatePipeline {
  register(
    systemId: string,
    update: (dt: number) => void,
    slotIndex: number
  ): void;
  start(): void;
  stop(): void;
  getCurrentTick(): number;
}

// Slot assignment (IMMUTABLE):
//  1 = Input          2 = Physics/Handling  3 = AI Driver
//  4 = Collision      5 = Fuel              6 = Tire Wear
//  7 = Race Management 8 = Pit Stop

// ⚠️ Havok Physics Integration (CRITICAL):
// Havok auto-steps on scene.onBeforeRenderObservable by default.
// This MUST be suppressed — Physics does NOT auto-step.
// Instead, Physics calls HavokPlugin.executeStep(dt, scene)
// MANUALLY inside FixedUpdatePipeline slot #2.
// Without this, physics runs at render rate AND fixed rate — desync.

// ⚠️ Accumulator + requestAnimationFrame (CRITICAL):
// The accumulator is driven from engine.runRenderLoop(), NOT from
// scene.onBeforeRenderObservable. Placing it in an observable causes:
//   1. Re-entrancy (scene.render() inside observable → infinite loop)
//   2. Scene affinity (pipeline stops when that scene is not active)
// The render-loop pattern avoids both: pipeline is scene-independent:
//   engine.runRenderLoop(() => {
//     accumulator += engine.getDeltaTime();
//     let ticks = 0;
//     while (accumulator >= FIXED_DT && ticks < MAX_CATCHUP) {
//       pipeline.runTick(FIXED_DT);    // calls all slots in order
//       accumulator -= FIXED_DT;
//       ticks++;
//     }
//     if (accumulator >= FIXED_DT) accumulator = 0;  // spiral-of-death
//     activeScene.render();  // scene set by Asset Manager's setActiveScene()
//   });

// Invariants:
// - accumulator pattern — never skips a tick
// - max 4 catch-up ticks per frame (FIXED_DT × 4)
// - Date.now()/performance.now() forbidden inside update()
// - slot order is immutable mid-session
// - tab backgrounded → rAF stops → accumulator does not drift (resume triggers catch-up capped at 4 ticks)
```

### Input → Physics (Control Contract)

```typescript
interface InputState {
  steer: number; // -1..+1, dead zone applied
  throttle: number; // 0..+1
  brake: number; // 0..+1
  gearDelta: -1 | 0 | 1; // pulse — shift command, not absolute gear
  cameraToggle: boolean; // pulse, debounced 200ms
  pauseToggle: boolean; // pulse
  confirm: boolean; // pulse — routed per GSM state
}

interface IInput {
  getState(): InputState;
}
```

### Camera (Player View)

```typescript
interface ICamera {
  setMode(mode: CameraMode): void;
  getMode(): CameraMode;
  setTarget(carId: string): void;
  getCurrentView(): { mode: CameraMode; target: string };
}

type CameraMode = "cockpit" | "chase" | "drone";

// Invariants:
// - setTarget() called by Race Management on race start (player car)
// - Camera reacts to GSM state (PreRace=grid view, Racing=follow target)
// - Camera NEVER initiates GSM transitions (reactive-only)
// - Shake accumulators reset on mode change
```

### Physics ↔ Fuel/Tire (Simulation Data)

```typescript
// Physics exposes (read — consumed by Fuel, Tire, AI, Camera, Audio):
interface IPhysicsRead {
  getLoads(carId: string): CarLoads;
  getSpeed(carId: string): CarSpeed;
  isStopped(carId: string): boolean;
}

interface CarLoads {
  throttleAvg: number; // 0..1
  lateralG: number;
  accelG: number;
  brakeG: number;
  offTrack: boolean;
}

interface CarSpeed {
  speedKmh: number;
  rpm: number;
  gear: number; // -1=reverse, 0=neutral, 1..6
  splinePosition: number; // 0..trackLength in meters
}

// Physics exposes (write — called by Fuel, Tire, Pit Stop, Race Management):
interface IPhysicsWrite {
  setFuelMult(carId: string, mult: number): void;
  setTireCondition(carId: string, condition: number): void;
  setLocked(carId: string, locked: boolean): void;
  setPit(carId: string, active: boolean): void;
  brakeCar(carId: string, force: number): void;
}

// Invariants:
// - Physics never imports Fuel or Tire Wear (module boundary)
// - setFuelMult/setTireCondition effects apply next tick
// - setLocked(true) = car velocity forced to 0, input ignored
// - setPit(true) = smooth deceleration toward pitSpeedLimit
```

### Fuel & Tire Wear (Mutant APIs — Only Pit Stop Writes)

```typescript
interface IFuel {
  addFuel(carId: string, amount: number): void; // clamps to maxCapacity
  getFuelLevel(carId: string): number; // 0..maxCapacity
  getFuelMult(carId: string): number; // 0..1
}

interface ITireWear {
  resetTires(carId: string): void; // sets tireCondition = 1.0
  getTireCondition(carId: string): number; // 0..1
}
```

### Track (Spatial Queries)

```typescript
interface ITrack {
  load(trackId: string): Promise<void>;
  dispose(): void;
  getTrackHalfWidth(splinePosition: number): number;
  isInPitEntryZone(carId: string): boolean;
  isInPitExitZone(carId: string): boolean;
  getSpline(): SplineSegment[];
}

// Invariants:
// - load() throws ConfigError if already Ready (caller must dispose() first)
// - pit zone detection is point-in-box, not Havok collision
```

### Race Management (Single Source of Truth for Results)

```typescript
interface IRaceManagement {
  init(config: RaceConfiguration): void;
  startRace(): void;
  endRace(): void;
  getResults(): RaceResults;
}

interface RaceConfiguration {
  trackId: string;
  lapCount: number;
  gridSize: number;
  playerCarId: string;
  difficulty: Difficulty;
  seed: number;
  aiDrivers: AIDriverDef[];
}

// Invariants:
// - init() calls off() before on() for all subscriptions (reentrancy)
// - getResults() returns cached object post-endRace()
// - init() throws ConfigError on invalid config
```

### Simulation Snapshot (Deterministic State Capture)

```typescript
interface ISnapshotable {
  systemId: string;
  serialize(): Record<string, unknown>;
  deserialize(state: Record<string, unknown>): void;
  hash(): string; // FNV-1a — same state = same hash across platforms
}

interface ISimulationSnapshot {
  register(system: ISnapshotable): void;
  takeSnapshot(): Snapshot;
  restore(snapshot: Snapshot): void;
}

// Invariants:
// - deserialize errors are per-system — failing system is skipped, others restore normally
// - snapshot during mid-update produces inconsistent state (caller responsibility)
```

### Core Types

```typescript
// Central event registry — every event declared here, consumed by all systems
type EventMap = {
  "gsm.state.entered": { state: string; previous: string };
  "gsm.state.exited": { state: string; next: string };
  "entity.spawned": { carId: string };
  "entity.despawned": { carId: string };
  "collision.impact": { carIdA: string; carIdB: string; impulse: number };
  "car.fuel_empty": { carId: string };
  "car.tire_blown": { carId: string };
  "car.stopped": { carId: string };
  "pit.entry": { carId: string };
  "pit.exit": { carId: string };
  "pit.status": { carId: string; status: PitState };
  "pit.fuel_status": { carId: string; progress: number };
  "pit.tire_status": { carId: string; progress: number };
  "position.changed": { carId: string; old: number; new: number };
  "race.starting": {};
  "race.light.countdown": { lightsOn: number };
  "race.green.flag": {};
  "race.completed": { results: RaceResults };
  "race.abandoned": {};
  "asset.load.start": { ids: string[] };
  "asset.load.progress": { id: string; loaded: number; total: number };
  "asset.load.complete": { id: string };
  "asset.load.allComplete": { ids: string[] };
  "asset.error": { assetId: string; error: Error };
};

// Spline segment returned by Track.getSpline()
interface SplineSegment {
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  tangent: { x: number; y: number; z: number };
  width: number; // track half-width at this segment
  length: number; // segment arc length in meters
  curvature: number; // 1/radius (m⁻¹). Zero = straight; positive = left, negative = right
  isPitEntry: boolean; // segment belongs to pit entry lane
  isPitExit: boolean; // segment belongs to pit exit lane
}

// Car entity — identity + references only, no gameplay state
interface CarEntity {
  carId: string;
  mesh: AbstractMesh;
  physicsBody: PhysicsBody;
  aiDriver?: AIDriverRef;
}
```

### Asset Manager

```typescript
interface IAssetManager {
  preload(ids: string[]): Promise<void>;
  load(id: string): Promise<AssetContainer>;
  setActiveScene(scene: Scene): void;
  disposeContainer(id: string): void;
}

// Invariants:
// - Loads into menuScene or raceScene depending on current state
// - Containers cached in Map<id, AssetContainer>; dispose() removes from cache
// - Both scenes coexist in engine.scenes[]; only active scene renders each frame
// - preload() during Menu LITE ensures zero I/O during race start
```

### Game State Machine

```typescript
interface IGameStateMachine {
  transition(to: State): void;
  getState(): State;
  getHistory(): StateEntry[];
}

type State =
  | "Boot"
  | "Loading"
  | "Menu"
  | "PreRace"
  | "Racing"
  | "Paused"
  | "PostRace";

interface StateEntry {
  state: State;
  enteredAt: number; // tick count, not wall clock
  metadata?: Record<string, unknown>;
}

// Invariants:
// - transition() emits gsm.state.exited THEN gsm.state.entered via Event Bus
// - Only valid transitions execute; invalid ones throw StateError
// - Max 1 transition per tick (prevents transition storms)
// - getState() returns current state synchronously — no external mutation
```

### Persistence

```typescript
interface IPersistence {
  save(key: string, data: Record<string, unknown>): void;
  load<T>(key: string): T | null;
  registerMigration(
    from: string,
    to: string,
    migrate: (data: unknown) => unknown
  ): void;
  retry(): void;
}

// Invariants:
// - load() returns null if key never saved (caller treats as "first run")
// - Data stored as { version: string, data: T, timestamp: number }
// - Queue up to 50 requests; flush on next tick
// - Degraded mode if localStorage unavailable (runtime flag)
```

### Entity/Car Lifecycle

```typescript
interface IEntityManager {
  spawnGrid(config: GridConfig): CarEntity[];
  destroyAll(): void;
  getEntity(carId: string): CarEntity | undefined;
}

interface GridConfig {
  trackId: string;
  gridSize: number; // 8 (MVP)
  carBasePath: string; // asset path for car GLB
  teamColors: string[]; // per-team color index
}

// Invariants:
// - spawnGrid() creates all cars before returning (no partial grid)
// - destroyAll() is idempotent — subsequent calls safe
// - Entity spawned = all systems get entity.spawned event
```

### AI Driver

```typescript
interface IAIDriver {
  init(config: AIConfig, track: ITrack, seed: number): void;
  registerCar(
    carId: string,
    teamPerformance: number,
    difficulty: number
  ): AIController;
  /** Pipeline slot #3 — computes AI input for next tick, writes to double-buffered store */
  tick(dt: number): void;
  /** Returns the input buffer written by tick() — consumed by Physics slot #2 next tick */
  getInputBuffer(): Map<string, InputState>;
  getController(carId: string): AIController | undefined;
  dispose(): void;
}

interface AIController {
  carId: string;
  params: AIDriverParams;
  state: "Normal" | "Following" | "Passing";
  progress: number;
  targetOffset: number;
  rng: SeededRandom; // per-car RNG stream isolated from other cars
}

// Invariants:
// - tick() called inside FixedUpdatePipeline slot #3
// - AI reads physics telemetry from current tick (Physics slot #2 already ran)
// - AI writes InputState to output buffer — consumed by Physics slot #2 in NEXT tick
// - Double-buffered Map<string, InputState>: AI writes to buffer[1], Physics reads buffer[0]
// - Player IInput.getState() (slot #1) and IAIDriver.tick() (slot #3) write to the same
//   InputState buffer — Physics slot #2 reads without branching on origin
// - SeededRandom ensures same seed = same driving decisions
// - Each AIController has its own SeededRandom instance (seed + carIndex) for RNG isolation
```

### Pit Stop

```typescript
type PitState = "onTrack" | "pitEntry" | "pitStopped" | "departing";

interface IPitStop {
  getPitState(carId: string): PitState;
  isInPitZone(carId: string): boolean;
}

// Invariants:
// - Pit state transitions driven by Track zone detection + service timing
// - Merge check runs every 200ms with force-merge at 15s timeout
// - confirm event only handled when pitState === 'pitStopped'
```

## ADR Audit

Status: 2026-06-21 — 25 ADRs written, all Accepted (ADR-0001 through ADR-0025).

### ADR Quality Summary

| Criteria                                 | Result                         |
| ---------------------------------------- | ------------------------------ |
| Engine Compatibility section             | ✅ 25/25                       |
| Engine version (9.12.0) recorded         | ✅ 25/25                       |
| Post-cutoff APIs flagged                 | ✅ 25/25                       |
| GDD Requirements Addressed section       | ✅ 25/25                       |
| Conflicts with layer/ownership decisions | ✅ Zero                        |
| Valid for pinned engine version          | ✅ 25/25 (specialist-verified) |

### ADR Overview

| #   | Title                                    | Domain                     | Risk   | Gaps Found                                                | Status                                                       |
| --- | ---------------------------------------- | -------------------------- | ------ | --------------------------------------------------------- | ------------------------------------------------------------ | -------- |
| 1   | Event Bus Architecture                   | Foundation — Communication | LOW    | —                                                         | Accepted                                                     |
| 2   | Fixed Timestep & Determinism Pipeline    | Foundation — Pipeline      | LOW    | Havok stepping corrected                                  | Accepted                                                     |
| 3   | Two-Scene Architecture & Asset Lifecycle | Core — Asset Loading       | MEDIUM | Container scene-binding corrected                         | Accepted                                                     |
| 4   | Module Boundary & Dependency Rules       | Foundation — Architecture  | LOW    | Entity/Car moved from Foundation to Core                  | Accepted                                                     |
| 5   | Entity/Car Lifecycle & State Ownership   | Core — Entity              | LOW    | `                                                         | null`removed,`\_advancePhysicsEngineStep` override corrected | Accepted |
| 6   | Input Abstraction                        | Core — Input               | MEDIUM | —                                                         | Accepted                                                     |
| 7   | Camera Architecture                      | Core — Camera              | LOW    | —                                                         | Accepted                                                     |
| 8   | Vehicle Physics                          | Core — Physics             | MEDIUM | Havok vehicle rejected, Arcade Dynamic chosen             | Accepted                                                     |
| 9   | Dev Tools                                | Foundation — Tooling       | LOW    | TD review promoted from defer to should-have              | Accepted                                                     |
| 10  | Collision Model                          | Core — Collision           | LOW    | —                                                         | Accepted                                                     |
| 11  | Fuel Model                               | Core — Simulation          | LOW    | —                                                         | Accepted                                                     |
| 12  | Tire Model                               | Core — Simulation          | LOW    | —                                                         | Accepted                                                     |
| 13  | AI Driver                                | Core — Simulation          | LOW    | 1-tick delay documented, per-car RNG, IAIDriver corrected | Accepted                                                     |
| 14  | Pit Stop Flow                            | Core — Simulation          | LOW    | Velocity guidance, confirm gating, tire binary design     | Accepted                                                     |
| 15  | Race Management                          | Core — Simulation          | LOW    | Countdown timing, 3 race-end conditions, hysteresis       | Accepted                                                     |
| 16  | Persistence Interface                    | Foundation — Persistence   | LOW    | —                                                         | Accepted                                                     |
| 17  | Simulation Snapshot                      | Foundation — State Capture | LOW    | —                                                         | Accepted                                                     |
| 18  | HUD Layout & Blocks                      | Presentation — GUI         | MEDIUM | Grid star→fraction, throttled events, anim styles         | Accepted                                                     |
| 19  | Menu LITE                                | Presentation — GUI         | MEDIUM | —                                                         | Accepted                                                     |
| 20  | Audio Engine                             | Presentation — Audio       | HIGH   | Full V2 API rewrite (SoundTrack→AudioBus)                 | Accepted                                                     |
| 21  | Single Race Adapter                      | Feature — Game Mode        | LOW    | —                                                         | Accepted                                                     |
| 22  | Telemetry Recorder                       | Dev Infra                  | LOW    | —                                                         | Accepted                                                     |
| 23  | Data & Config Manager                    | Foundation — Data          | LOW    | —                                                         | Accepted                                                     |
| 24  | Game State Machine                       | Foundation — Orchestration | LOW    | —                                                         | Accepted                                                     |
| 25  | Track + Environment                      | Core — Track               | MEDIUM | Static merged colliders, inline pit zones confirmed       | Accepted                                                     |

**Total**: 6 blockers found across ADRs (all resolved with specialist). 10 medium-risk, 15 low-risk. All 25 valid for Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12.

## Required ADRs

**All 25 ADRs have been written (ADR-0001 through ADR-0025).** No ADRs remain to create. The list below is historical reference of the full set.

### Foundation Layer (8 ADRs)

| #   | Title                                 | GDDs Covered         |
| --- | ------------------------------------- | -------------------- |
| 1   | Event Bus Architecture                | event-bus            |
| 2   | Fixed Timestep & Determinism Pipeline | determinism-contract |
| 4   | Module Boundary & Dependency Rules    | systems-index        |
| 9   | Dev Tools Architecture                | dev-tools            |
| 16  | Persistence Interface                 | persistence          |
| 17  | Simulation Snapshot                   | simulation-snapshot  |
| 23  | Data & Config Manager                 | data-config-manager  |
| 24  | Game State Machine                    | game-state-machine   |

### Core Layer (12 ADRs)

| #   | Title                                    | GDDs Covered         |
| --- | ---------------------------------------- | -------------------- |
| 3   | Two-Scene Architecture & Asset Lifecycle | asset-manager        |
| 5   | Entity/Car Lifecycle & State Ownership   | entity-car-lifecycle |
| 6   | Input Abstraction & GSM Routing          | input                |
| 7   | Camera Architecture                      | camera               |
| 8   | Vehicle Physics                          | physics-handling     |
| 10  | Collision & Impact System                | collision            |
| 11  | Fuel Consumption Model                   | fuel                 |
| 12  | Tire Degradation Model                   | tire-wear            |
| 13  | AI Driver Architecture                   | ai-driver            |
| 14  | Pit Stop State Machine                   | pit-stop             |
| 15  | Race Management & Results                | race-management      |
| 25  | Track + Environment                      | track-environment    |

### Presentation Layer (3 ADRs)

| #   | Title                  | GDDs Covered |
| --- | ---------------------- | ------------ |
| 18  | HUD Block Architecture | hud          |
| 19  | Menu LITE Screen Stack | menu-lite    |
| 20  | Audio Strategy         | audio        |

### Feature + Dev Infra (2 ADRs)

| #   | Title                     | GDDs Covered       |
| --- | ------------------------- | ------------------ |
| 21  | Single Race Adapter       | single-race        |
| 22  | Telemetry Recorder Schema | telemetry-recorder |

## Architecture Principles

1. **Foundation is pure TypeScript.** Data & Config, Event Bus, GSM, Determinism, Persistence, Simulation Snapshot — zero Babylon.js imports. Can be tested with `vitest`, no browser needed.

2. **Physics owns gear. Systems own their state.** No duplicated state across modules. CarEntity is identity-only. Runtime state lives in `Map<carId, State>` per system.

3. **Event Bus for decoupling, direct getters for per-frame data.** Heavy data (speed, fuel level, tire condition) is always a direct read. Events carry minimal payload (carId, event type). Speed is the one Physics-direct read exception for HUD.

> **⚠️ Deliberate trade-off**: HUD and Audio read Physics data directly every frame (speed, rpm, throttle, lateralG). This couples Presentation to Physics. It is a conscious performance choice: serializing 4 floats through Event Bus at 60fps costs more in allocation/dispatch than the coupling cost. Future engine swaps would need an abstraction layer between Physics reads and Presentation. This trade-off is documented here so maintainers know it was deliberate, not an oversight.

4. **Pipeline order is law.** Slot assignment (Input=1, Physics=2, AI=3, Collision=4, Fuel=5, Tire=6, RaceMgmt=7, PitStop=8) never changes mid-session. Determinism depends on this.

5. **Set over get for cross-system writes.** Systems expose `IFuel.addFuel()`, `IPhysicsWrite.setFuelMult()` — never direct property assignment. Physics never imports Fuel or Tire Wear.

6. **Every system is replaceable.** All public interfaces are abstract — implementation can be swapped (e.g. Persistence localStorage → IndexedDB, Audio legacy → V2) without changing consumers.

## Open Questions

### HIGH Engine Risks (need resolution before end of Phase 3)

| #   | Question                                                                                                                                                                                        | Status                                                                               | Resolved by             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------- |
| 1   | **Audio API path**: legacy `Sound` + OscillatorNode hybrid, or Audio Engine V2 native?                                                                                                          | ✅ Resolved — Audio Engine V2 (CreateSoundAsync + AudioBus + CreateSoundSourceAsync) | ADR-0020 (Audio Engine) |
| 2   | **Havok deterministic cross-platform?** Bit-identical simulation across GPU vendors is not guaranteed. MVP scope is seed-based AI determinism only — acceptable.                                | ✅ Acknowledged — MVP scope accepts seed-based determinism                           | ADR-0002 (Determinism)  |
| 3   | **Tab backgrounding**: rAF stops, max 4 catch-up ticks. Player loses ~33ms of simulation per second of backgrounding. Spiral-of-death protection discards excess. Acceptable for single-player. | ✅ Acknowledged — acceptable for MVP                                                 | —                       |
| 4   | **Scene transition memory**: Both scenes coexist during menu→race transition. On memory-constrained devices, peak usage spikes. MVP target is desktop/Tauri — acceptable.                       | ✅ Acknowledged — spike during implementation if needed                              | —                       |

### Director Sign-Off

#### TD-ARCHITECTURE (Technical Director)

- **Status**: CONCERNS → Resolved
- **Date**: 2026-06-21
- **4-Criteria Evaluation**:
  - TR Coverage: PASS — structural coverage complete
  - HIGH Risk Domains: CONCERN → Resolved — mitigation plans documented, specialist-verified
  - API Boundaries: CONCERN → Resolved — 6 missing interfaces added (IAssetManager, IEntityManager, IGameStateMachine, IPersistence, IAIDriver, IPitStop), EventMap, SplineSegment, CarEntity types added
  - Foundation Gaps: CONCERN → Resolved — 25 ADRs written, all Accepted
- **Quote**: "Not rejected — comprehensive and coherent."

#### LP-FEASIBILITY (Lead Programmer)

- **Status**: CONCERNS → Resolved
- **Date**: 2026-06-21
- **6-Area Evaluation**:
  - Engine/Language: CONCERN → Resolved — Audio Engine V2 confirmed, Havok stepping documented
  - Missing Interfaces: CONCERN → Resolved — all interfaces added
  - Tech Debt: CONCERN → Resolved — Physics→HUD/Audio direct coupling documented as deliberate trade-off
  - FixedUpdatePipeline: CONCERN → Resolved — accumulator+rAF documented, Havok dual-stepping prevented
  - Two-Scene: FEASIBLE — no changes needed
  - Audio: CONCERN → Resolved — hybrid path replaced with pure V2 (CreateSoundAsync + CreateSoundSourceAsync on same AudioBus)
- **Quote**: "Not INFEASIBLE — every issue has a known resolution path."

### Next Steps

1. /create-control-manifest — extract flat actionable rules from all 25 ADRs
2. /gate-check Pre-Production — verify all architecture artifacts are complete
3. Begin Foundation implementation (Data & Config → Event Bus → GSM → Determinism)

### Deferred to Alpha

| #   | Question                                                                         | Alpha System               |
| --- | -------------------------------------------------------------------------------- | -------------------------- |
| 5   | Multiplayer state reconciliation protocol (deterministic lockstep vs state sync) | Championship / Multiplayer |
| 6   | Damage model integration with Collision event system                             | Damage (#25)               |
| 7   | Night race lighting strategy (time-of-day vs baked shadows)                      | Night Race (#26)           |
| 8   | Full audio settings UI (volume sliders, mute, device selection)                  | Menu Enhancements          |
