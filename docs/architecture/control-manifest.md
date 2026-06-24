# Control Manifest

> **Engine**: Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12
> **Last Updated**: 2026-06-21
> **Manifest Version**: 2026-06-21
> **ADRs Covered**: ADR-0001 through ADR-0025 (25 ADRs)
> **Status**: Active — regenerate with `/create-control-manifest update` when ADRs change

This manifest is a programmer's quick-reference extracted from all Accepted ADRs,
technical preferences, and engine reference docs. For the reasoning behind each
rule, see the referenced ADR.

---

## Foundation Layer Rules

_Applies to: ConfigManager, Event Bus, Fixed Timestep Pipeline, Module Boundaries,
Game State Machine, Persistence, Simulation Snapshot. Foundation = zero engine
imports (verified via `tsc --noEmit`)._

### Required Patterns

| #   | Rule                                                                                                                                                                                                                                              | Source   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| F1  | **ConfigManager init Phase 0** — first Foundation system. No system registers or reads config before ConfigManager init.                                                                                                                          | ADR-0023 |
| F2  | **`get<T>(key)` throws ConfigError** — never returns `undefined`. Missing key = compile-time-style error, game stops.                                                                                                                             | ADR-0023 |
| F3  | **`register(namespace, config)` during init** — namespace uniqueness enforced. Duplicate throws `ConfigError`. No filesystem auto-discovery (`import.meta.glob`).                                                                                 | ADR-0023 |
| F4  | **Env override via `OVERDRIVE__NS__KEY`** — applies before cached value.                                                                                                                                                                          | ADR-0023 |
| F5  | **HMR invalidation per namespace** — Vite HMR triggers per-namespace cache flush.                                                                                                                                                                 | ADR-0023 |
| F6  | **500-entry access logging ring buffer** — for debug via Dev Tools.                                                                                                                                                                               | ADR-0023 |
| F7  | **Event Bus: synchronous emit** — `emit()` returns only after all handlers execute. No microtask/macrotask queuing.                                                                                                                               | ADR-0001 |
| F8  | **Event Bus: Subscription pattern** — `on()`/`once()` return `Subscription` with `unsubscribe()`.                                                                                                                                                 | ADR-0001 |
| F9  | **Handler subscribed during dispatch does NOT receive current event.**                                                                                                                                                                            | ADR-0001 |
| F10 | **EventMap central type registry** — 25+ typed events. Payload is `{ carId }` or light identity — never heavy data (speed, fuelLevel).                                                                                                            | ADR-0001 |
| F11 | **Pipeline in `engine.runRenderLoop()`** — NOT in `scene.onBeforeRenderObservable` (re-entrancy + scene affinity with Two-Scene).                                                                                                                 | ADR-0002 |
| F12 | **8 fixed immutable pipeline slots**: Input → Physics → AI → Collision → Fuel → Tire → Race Management → Pit Stop.                                                                                                                                | ADR-0002 |
| F13 | **Fixed timestep at 1/60s** — `FIXED_DT = 16.667ms`. Accumulator-driven from `engine.getDeltaTime()`.                                                                                                                                             | ADR-0002 |
| F14 | **Max 4 catch-up ticks** — spiral-of-death protection. `if (accumulator >= FIXED_DT) accumulator = 0`.                                                                                                                                            | ADR-0002 |
| F15 | **`Date.now()` / `performance.now()` forbidden inside slot `update()`** — breaks determinism.                                                                                                                                                     | ADR-0002 |
| F16 | **SeededRandom LCG** — constants `1664525`, `1013904223` (Numerical Recipes). Three methods: `random()`, `randomRange(min, max)`, `randomSign()`.                                                                                                 | ADR-0002 |
| F17 | **Havok: `scene.enablePhysics()` IS called** — required for `PhysicsBody`/`PhysicsAggregate` constructors. Auto-step suppressed via `(scene as any)._advancePhysicsEngineStep = () => {}`. Manual `executeStep(dt, bodies[])` in Physics slot #2. | ADR-0002 |
| F18 | **Layer directionality**: Foundation → Core → Feature → Presentation. No circular imports.                                                                                                                                                        | ADR-0004 |
| F19 | **Import rule**: system in layer N may import from N-1 or N-2, never from N+1. Within Core, slot N reads from slot N-1.                                                                                                                           | ADR-0004 |
| F20 | **Event Bus is the ONLY cross-system pattern for state-change signals.** Per-frame heavy data via direct getter interface, not Event Bus.                                                                                                         | ADR-0004 |
| F21 | **Dev Infra behind `__DEV__` guard** — `import.meta.env.DEV` dynamic import, zero bytes in production.                                                                                                                                            | ADR-0004 |
| F22 | **GSM: flat FSM** with `Record<State, State[]>` transition table. Invalid transition throws `GameStateError`.                                                                                                                                     | ADR-0024 |
| F23 | **No system calls `gsm.getCurrent()`** — all systems react to `gsm.state.entered`/`gsm.state.exited` via Event Bus.                                                                                                                               | ADR-0024 |
| F24 | **GSM emits 2 events per transition**: `gsm.state.exited(old)` then `gsm.state.entered(new)`.                                                                                                                                                     | ADR-0024 |
| F25 | **Max 1 transition per tick** — prevents transition storms.                                                                                                                                                                                       | ADR-0024 |
| F26 | **`onEnter`/`onExit` async with rollback** — if `onEnter` fails, previous state is restored.                                                                                                                                                      | ADR-0024 |
| F27 | **20-entry ring buffer** of last transitions for debug.                                                                                                                                                                                           | ADR-0024 |
| F28 | **Persistence: async-first** — all public methods return `Promise<T>`, even with synchronous backend.                                                                                                                                             | ADR-0016 |
| F29 | **Persistence: versioned payload** — `{ version, data, timestamp }`. Migration chain for schema upgrades.                                                                                                                                         | ADR-0016 |
| F30 | **Persistence: error isolation** — corrupted key never breaks other keys.                                                                                                                                                                         | ADR-0016 |
| F31 | **Persistence: degraded mode** — when storage unavailable, writes queue in memory (max 50 entries), reads return `null`. `retry()` re-probes.                                                                                                     | ADR-0016 |
| F32 | **Persistence: `'overdrive_'` key prefix** — all storage keys namespaced.                                                                                                                                                                         | ADR-0016 |
| F33 | **Simulation Snapshot: `ISnapshotable`** — `systemId`, `serialize()`, `deserialize()`, `hash()`.                                                                                                                                                  | ADR-0017 |
| F34 | **Two-tier hashing**: FNV-1a 64-bit for tick-level checks, SHA-256 for network/save integrity.                                                                                                                                                    | ADR-0017 |
| F35 | **JSON format for MVP** — debuggable, human-readable, no build step.                                                                                                                                                                              | ADR-0017 |
| F36 | **Full snapshots only** — each system serializes complete state. Delta compression deferred to multiplayer.                                                                                                                                       | ADR-0017 |
| F37 | **Cross-reference: DeterminismContract** — rules live in ADR-0002. `SeededRandom.random()` must replace `Math.random()` inside all pipeline `update()` calls. No `Date.now()`/`performance.now()` in simulation code.                             | ADR-0002 |

### Forbidden Approaches

| #     | Rule                                                                                                            | Source   |
| ----- | --------------------------------------------------------------------------------------------------------------- | -------- |
| F-F1  | Never use `import.meta.glob` for config discovery — registration must be explicit and traceable.                | ADR-0023 |
| F-F2  | Never return `T \| undefined` from `get()` — throws `ConfigError`.                                              | ADR-0023 |
| F-F3  | Never use default fallback in `get()` — defaults live in config files, not the getter.                          | ADR-0023 |
| F-F4  | Never import Foundation from higher layers (Core/Feature/Presentation).                                         | ADR-0004 |
| F-F5  | Never call `gsm.getCurrent()` from any system.                                                                  | ADR-0024 |
| F-F6  | Never use async Event Bus (microtask/macrotask) — breaks frame ordering.                                        | ADR-0001 |
| F-F7  | Never use third-party library for Event Bus — Foundation must have zero dependencies.                           | ADR-0001 |
| F-F8  | Never use Persistence without versioning — unversioned saves have no migration path.                            | ADR-0016 |
| F-F9  | Never crash on storage errors — enter degraded mode instead.                                                    | ADR-0016 |
| F-F10 | Never register pipeline in `scene.onBeforeRenderObservable`.                                                    | ADR-0002 |
| F-F11 | Never skip `scene.enablePhysics()` — `PhysicsBody`/`PhysicsAggregate` constructors require a registered engine. | ADR-0002 |

### Performance Guardrails

| #    | Rule                                                                                                                      | Source             |
| ---- | ------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| F-G1 | Event Bus: < 1 KB gzipped.                                                                                                | ADR-0001           |
| F-G2 | Pipeline: < 0.001ms overhead per tick (8 function calls).                                                                 | ADR-0002           |
| F-G3 | **Simulation tick sub-budgets** (cumulative, per 16.6ms frame):                                                           | —                  |
|      | Slot 1 — Input: < 0.01ms                                                                                                  | ADR-0006           |
|      | Slot 2 — Physics (Havok executeStep, 8 DYNAMIC bodies): < 0.06ms                                                          | ADR-0008           |
|      | Slot 3 — AI Driver (7 controllers): < 0.10ms                                                                              | ADR-0013           |
|      | Slot 4 — Collision (event dispatch only): < 0.01ms                                                                        | ADR-0010           |
|      | Slot 5 — Fuel (throttle integral): < 0.01ms                                                                               | ADR-0011           |
|      | Slot 6 — Tire Wear (load-based degradation): < 0.01ms                                                                     | ADR-0012           |
|      | Slot 7 — Race Management (lap, pos, DNF): < 0.02ms                                                                        | ADR-0015           |
|      | Slot 8 — Pit Stop (state machine, spline guidance): < 0.02ms                                                              | ADR-0014           |
|      | **Total estimated: < 0.25ms** (leaves >16ms for rendering pipeline)                                                       | —                  |
| F-G4 | **Asset loading budget**: cold start (first load) < 2s; scene transition < 100ms (zero I/O — cached AssetContainers).     | ADR-0003           |
| F-G5 | **Save/load budget**: < 50ms for preferences (localStorage sync); < 200ms for full snapshot (JSON serialize/deserialize). | ADR-0016, ADR-0017 |

---

## Core Layer Rules

_Applies to: Asset Manager, Two-Scene, Entity/Car Lifecycle, Input, Camera,
Physics/Handling, Collision, Track+Environment, Fuel, Tire Wear, AI Driver,
Pit Stop, Race Management._

### Required Patterns

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                          | Source                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------- | --- | -------------------------------- | -------- |
| C1  | **Two persistent scenes** — `menuScene` and `raceScene` coexist in `engine.scenes[]`. Only one renders per frame via `setActiveScene()`.                                                                                                                                                                                                                                                      | ADR-0003                |
| C2  | **AssetContainers cached** — `Map<string, AssetContainer>`. Load once (`LoadAssetContainerAsync`), instantiate per scene, zero I/O on transitions.                                                                                                                                                                                                                                            | ADR-0003                |
| C3  | **`SceneLoader.LoadAssetContainerAsync` only** — sync variants (Load/Append/ImportMesh) deprecated since v7.34.                                                                                                                                                                                                                                                                               | ADR-0003                |
| C4  | **Containers loaded against raceScene**, `removeAllFromScene()` after load for caching. Menu assets against menuScene.                                                                                                                                                                                                                                                                        | ADR-0003                |
| C5  | **`asset.error` event** on load failure — GSM remains in Loading, fallback material applied.                                                                                                                                                                                                                                                                                                  | ADR-0003                |
| C6  | **CarEntity is identity-only** — `id`, `teamId`, `gridIndex`, `mesh`, `physicsBody`, optional `aiDriver`. Never runtime state.                                                                                                                                                                                                                                                                | ADR-0005                |
| C7  | **Player and AI use same CarEntity structure** — player has `aiDriver = undefined`.                                                                                                                                                                                                                                                                                                           | ADR-0005                |
| C8  | **`spawnGrid()` synchronous** — all 8 cars created before returning. Throws `EntityLifecycleError` if Grid Active.                                                                                                                                                                                                                                                                            | ADR-0005                |
| C9  | **`destroyAll()` idempotent** — disposes physics bodies, scene meshes, clears entity map.                                                                                                                                                                                                                                                                                                     | ADR-0005                |
| C10 | **`PhysicsAggregate` CONVEX_HULL (800kg)** — if GLB root is `TransformNode` without geometry, extract chassis `Mesh` child and pass via `{ mesh: chassisMesh }`.                                                                                                                                                                                                                              | ADR-0005                |
| C11 | **`activeBodies: PhysicsBody[]`** — for pipeline `executeStep(dt, bodies)` and cleanup.                                                                                                                                                                                                                                                                                                       | ADR-0005                |
| C12 | **Input: polling per tick** — Physics needs current frame's values, not last event.                                                                                                                                                                                                                                                                                                           | ADR-0006                |
| C13 | **Dead zone formula**: `output =                                                                                                                                                                                                                                                                                                                                                              | raw                     | < threshold ? 0 : sign(raw) × ( | raw | - threshold) / (1 - threshold)`. | ADR-0006 |
| C14 | **Tab blur zeros all outputs** — no stuck keys on focus loss. Resume live state on focus.                                                                                                                                                                                                                                                                                                     | ADR-0006                |
| C15 | **`IInput.getState()` reads player input only** — AI has separate pipeline slot #3.                                                                                                                                                                                                                                                                                                           | ADR-0006                |
| C16 | **AI produces `InputState` (steer/throttle/brake/gearDelta)** — same signal contract as player Input but does NOT implement `IInput`. AI writes to double-buffered `Map<string, InputState>` at slot #3. Physics reads from map at slot #2, never branches on player vs AI origin.                                                                                                            | ADR-0006, ADR-0013      |
| C17 | **Camera: `camera.inputs.clear()`** — disables v9.8 Camera Input Mapping System. `camera.inertia = 0`. `attachControl()` still called.                                                                                                                                                                                                                                                        | ADR-0007                |
| C18 | **Camera: reactive to `gsm.state.entered` only** — never initiates GSM transitions. `cameraToggle` from `InputState` only.                                                                                                                                                                                                                                                                    | ADR-0007                |
| C19 | **3 camera types**: FreeCamera (cockpit/grid), FollowCamera (chase), ArcRotateCamera (drone). Swapped via `scene.activeCamera`.                                                                                                                                                                                                                                                               | ADR-0007                |
| C20 | **FOV shift**: `baseFOV + speedFactor × speed_kmh`, clamped to `[FOV_min, FOV_max]`.                                                                                                                                                                                                                                                                                                          | ADR-0007                |
| C21 | **Physics: 1 DYNAMIC body per car** — no wheel bodies, no suspension joints, no constraint-based vehicle.                                                                                                                                                                                                                                                                                     | ADR-0008                |
| C22 | **3-phase execution within pipeline slot #2**: Phase 1 (arcade grip model → target speed/yaw), Phase 2 (Havok `executeStep` → collision impulse resolve), Phase 3 (velocity override → snap to arcade speed, preserve collision position delta).                                                                                                                                              | ADR-0008                |
| C23 | **Grip formula**: `gripMax = baseGrip × cornerStat × tireCondition × speedMod`.                                                                                                                                                                                                                                                                                                               | ADR-0008                |
| C24 | **`setLocked(carId, bool)`** — `true` → velocity = 0 regardless of input. Used for grid start and pit stop.                                                                                                                                                                                                                                                                                   | ADR-0008                |
| C25 | **`setPit(carId, bool)`** — target speed clamped to `pitSpeedLimit` (80 km/h) with smooth deceleration.                                                                                                                                                                                                                                                                                       | ADR-0008                |
| C26 | **`fuelMult = 0` → engine power = 0** — car coasts to stop. Delivered with 1-tick delay.                                                                                                                                                                                                                                                                                                      | ADR-0008, ADR-0011      |
| C27 | **`tireCondition = 0` → grip drops to `minGripFactor` (0.15)** — engine power unaffected. Delivered with 1-tick delay.                                                                                                                                                                                                                                                                        | ADR-0008, ADR-0012      |
| C28 | **`car.stopped` is edge-triggered** — emitted once when velocity crosses below `stopEpsilon` from above. Hysteresis prevents chatter.                                                                                                                                                                                                                                                         | ADR-0008                |
| C29 | **Collision: `onCollisionObservable`** — provides `IPhysicsCollisionEvent` with `impulse`, `point`, `normal`. NOT `collisionEndedObservable` (no impulse data).                                                                                                                                                                                                                               | ADR-0010                |
| C30 | **Collision: event-only** — no `update()`, no pipeline slot. Registered at PreRace, unregistered at PostRace.                                                                                                                                                                                                                                                                                 | ADR-0010                |
| C31 | **Collision: grazing suppression** — sustained barrier scrape suppressed within `grazeSuppressFrames` ticks.                                                                                                                                                                                                                                                                                  | ADR-0010                |
| C32 | **Collision: barrier detection** via `Set<PhysicsBody>` (registerBarrier).                                                                                                                                                                                                                                                                                                                    | ADR-0010                |
| C33 | **Fuel consumption**: `fuelUsed = throttleAvg × baseRate × efficiencyRate × fixedDt`.                                                                                                                                                                                                                                                                                                         | ADR-0011                |
| C34 | **`fuelMult = max(0.0, fuelLevel / maxCapacity)`** — sent to Physics each tick with 1-tick delay.                                                                                                                                                                                                                                                                                             | ADR-0011                |
| C35 | **Pit Stop is sole external writer** to fuel level (via `addFuel`).                                                                                                                                                                                                                                                                                                                           | ADR-0011                |
| C36 | **Tire degradation**: `wear = lateralG × latFactor + accelG × accelFactor + brakeG × brakeFactor`.                                                                                                                                                                                                                                                                                            | ADR-0012                |
| C37 | **Off-track = 2.0× wear multiplier**.                                                                                                                                                                                                                                                                                                                                                         | ADR-0012                |
| C38 | **Single health pool per car** — all 4 wheels aggregated.                                                                                                                                                                                                                                                                                                                                     | ADR-0012                |
| C39 | **Binary tire change** — complete swap, never partial. `resetTires()` restores to 1.0 after `tireChangeDelay`.                                                                                                                                                                                                                                                                                | ADR-0012                |
| C40 | **`car.tire_blown` one-shot** — guard prevents re-emission.                                                                                                                                                                                                                                                                                                                                   | ADR-0012                |
| C41 | **AI: deterministic via SeededRandom** — same seed → same AI behavior.                                                                                                                                                                                                                                                                                                                        | ADR-0013                |
| C42 | **AI: spline-based path following** — PID(lateralError) + curvatureFeedforward → steer (-1..1).                                                                                                                                                                                                                                                                                               | ADR-0013                |
| C43 | **AI: overtaking state machine** — Normal → Following → Passing → Normal. No collision avoidance system.                                                                                                                                                                                                                                                                                      | ADR-0013                |
| C44 | **AI: 7 controllers** created at PreRace, ticking every physics tick during Racing.                                                                                                                                                                                                                                                                                                           | ADR-0013                |
| C45 | **AI: difficulty multiplier** — 5 levels (0.75, 0.875, 1.0, 1.125, 1.25) × `teamPerformance`.                                                                                                                                                                                                                                                                                                 | ADR-0013                |
| C46 | **AI: `AIDriverParams` is an OPEN set** — MVP defines 7 parameters (speedMult, brakingAggression, gripMargin, throttleRampRate, passingAggression, mistakeChance, offsetPreference). Alpha may add personality parameters (pressureTolerance, defensiveTendency, mistakePattern, contactTolerance) without breaking MVP data contracts. The `ai.teams.*` config namespace supports extension. | ADR-0013, CD-PHASE-GATE |
| C47 | **AI: input suppressed during active pit stop** — by Pit Stop system, not AI Driver.                                                                                                                                                                                                                                                                                                          | ADR-0013                |
| C47 | **Pit Stop: velocity-driven** — no position override (causes per-tick oscillation with Physics velocity snap). Speed limiting + spline guidance via `setPitVelocity`.                                                                                                                                                                                                                         | ADR-0014                |
| C48 | **Pit Stop: per-car state machine** — `onTrack → pitEntry → pitStopped → departing → onTrack`.                                                                                                                                                                                                                                                                                                | ADR-0014                |
| C49 | **Pit Stop: `confirm` gatekept** — only handled when `pitState === 'pitStopped'`.                                                                                                                                                                                                                                                                                                             | ADR-0014                |
| C50 | **Pit Stop: AI never exits early** — waits for both fuel AND tire service complete.                                                                                                                                                                                                                                                                                                           | ADR-0014                |
| C51 | **Pit Stop: merge check** — config-driven via `mergeCheckDistance`, `forceMergeTimeout`.                                                                                                                                                                                                                                                                                                      | ADR-0014                |
| C52 | **Race Management: sub-state under GSM Racing** — Countdown → GreenFlag → Racing → Checkered. GSM only knows Racing.                                                                                                                                                                                                                                                                          | ADR-0015                |
| C53 | **Race Management: reentrant `init()`** — `eventBus.off().on()` prevents listener duplication on Race Again.                                                                                                                                                                                                                                                                                  | ADR-0015                |
| C54 | **Race Management: DNF lifecycle** — `fuel_empty` → `pendingDNF[carId]` → guards (`car.stopped` in pit entry zone → no DNF, `pit.status(pitStopped)` clears, `car.stalled_in_pit` registers) → `car.stopped` on track → DNF.                                                                                                                                                                  | ADR-0015                |
| C55 | **Race Management: 3 race-end conditions** — (1) player completes N laps, (2) penultimate car ahead finishes (immediate Checkered), (3) leader finishes + player ≥1 lap behind (player finishes current lap).                                                                                                                                                                                 | ADR-0015                |
| C56 | **Race Management: lap detection** — spline wrap-around (`prevPos > 0.9 × trackLength && currentPos < 0.1 × trackLength`). Backwards crossing does NOT increment.                                                                                                                                                                                                                             | ADR-0015                |
| C57 | **Race Management: position hysteresis** — `position.changed` only if distance delta > `hysteresisThreshold` (0.5m) sustained for 3 ticks.                                                                                                                                                                                                                                                    | ADR-0015                |
| C58 | **Race Management: `gsm.transition()` deferred** — from `endRace()` deferred to end-of-tick (not synchronous from pipeline slot #7).                                                                                                                                                                                                                                                          | ADR-0015                |
| C59 | **Track: `SplineSegment[]` custom array** — carries per-segment `width` + `next` index. NOT `Curve3`/`CatmullRomCurve3`/`Path3D` (no metadata).                                                                                                                                                                                                                                               | ADR-0025                |
| C60 | **Track: static Havok colliders per category** — 3–5 bodies per track. `PhysicsAggregate` with `mass: 0` (STATIC), `PhysicsShapeType.MESH`. DYNAMIC × MESH is Havok's most optimized collision pair.                                                                                                                                                                                          | ADR-0025                |
| C61 | **Track: pit zone detection via inline XZ point-in-box** — NOT Havok trigger volumes (no trigger volume support in Havok V2 Scene).                                                                                                                                                                                                                                                           | ADR-0025                |
| C62 | **Track: config-driven** — `src/config/tracks/{id}.ts` + GLB assets. Zero TypeScript code changes to add a circuit.                                                                                                                                                                                                                                                                           | ADR-0025                |

### Forbidden Approaches

| #    | Rule                                                                                                                                              | Source             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| C-F1 | Never use `Curve3`, `CatmullRomCurve3`, or `Path3D` for spline data — cannot carry per-segment metadata.                                          | ADR-0025           |
| C-F2 | Never use Havok trigger volumes for pit zone detection — use inline XZ point-in-box.                                                              | ADR-0025           |
| C-F3 | Never set position/heading directly on a DYNAMIC PhysicsBody during pit entry/exit — creates per-tick oscillation with Physics velocity override. | ADR-0014           |
| C-F4 | Never use `collisionEndedObservable` for impact events — no impulse data.                                                                         | ADR-0010           |
| C-F5 | Never implement vehicle physics with multiple bodies (wheels, suspension) per car — arcade model uses 1 body.                                     | ADR-0008           |
| C-F6 | Never branch Physics on player vs AI input — Physics reads from unified `inputBuffer` map.                                                        | ADR-0006, ADR-0013 |
| C-F7 | Never make Camera initate GSM transitions — Camera is purely reactive.                                                                            | ADR-0007           |
| C-F8 | Never call `gsm.transition()` from within pipeline slot except from `endRace()` (and even that is deferred to end-of-tick).                       | ADR-0015           |
| C-F9 | Never read Input on `scene.onBeforeRenderObservable` — pipeline must own all input reads deterministically.                                       | ADR-0006           |

### Performance Guardrails

| #     | Rule                                                                                 | Source   |
| ----- | ------------------------------------------------------------------------------------ | -------- |
| C-G1  | Physics: ~0.06ms/tick (8 DYNAMIC bodies, 0 joints).                                  | ADR-0008 |
| C-G2  | Physics: ~4KB for bodies.                                                            | ADR-0008 |
| C-G3  | Havok WASM instantiation: ~50-200ms (one-time during init).                          | ADR-0008 |
| C-G4  | HUD: ~80KB memory (~40 GUI controls).                                                | ADR-0018 |
| C-G5  | CarEntity: ~32KB total (8 cars × ~200 bytes + 8 PhysicsAggregate × ~2KB + 8 meshes). | ADR-0005 |
| C-G6  | Pit Stop: ~0.001ms/car/tick (spline interpolation + service timers).                 | ADR-0014 |
| C-G7  | Race Management: < 0.01ms/tick (position sort O(8 log 8)).                           | ADR-0015 |
| C-G8  | Collision: ~0.001ms per contact event (map lookup + Event Bus emit).                 | ADR-0010 |
| C-G9  | Fuel: < 0.001ms/car/tick (single multiply-add).                                      | ADR-0011 |
| C-G10 | Tire: < 0.001ms/car/tick (single multiply-add).                                      | ADR-0012 |
| C-G11 | AI: ~0.01ms/car/tick (PID + spline query + state machine).                           | ADR-0013 |
| C-G12 | Asset Manager: ~22MB total (menu 2MB + race 15MB + cached containers 5MB).           | ADR-0003 |
| C-G13 | Load time: Menu→Race < 2s. Race Again: ~0ms (from cache).                            | ADR-0003 |

---

## Dev Infra Layer Rules

_Applies to: Dev Tools, Telemetry Recorder. All code behind `__DEV__` guard
(`import.meta.env.DEV` dynamic import). Zero bytes in production builds.
Dev Infra is NOT in the Core dependency DAG — it loads itself via dynamic
import, never statically imported by production code._

### Required Patterns

| #   | Rule                                                                                                                                 | Source             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| D1  | **Dev Tools: HTML overlay** — positioned absolutely over canvas container (`pointer-events: none`).                                  | ADR-0009           |
| D2  | **Dev Tools: lazy init on first F1 press** — zero cost if never opened.                                                              | ADR-0009           |
| D3  | **Dev Tools: `SceneInstrumentation`** for metrics (FPS, frame time, draw calls, physics time). Not custom counters.                  | ADR-0009           |
| D4  | **Dev Tools: `engine.onEndFrameObservable`** for overlay refresh — fires after complete frame render.                                | ADR-0009           |
| D5  | **Dev Tools: F1/F2 polled via Input's DeviceSourceManager keyboard path** — not named `InputState` fields (InputState has no F1/F2). | ADR-0009, ADR-0006 |
| D6  | **Dev Tools: read-only on all systems** — never writes state, never emits Event Bus events.                                          | ADR-0009           |
| D7  | **Telemetry: 20Hz sampling** (every 3 ticks at 60Hz).                                                                                | ADR-0022           |
| D8  | **Telemetry: console.log every 5s** (every 300 ticks) during Racing.                                                                 | ADR-0022           |
| D9  | **Telemetry: export via Dev Tools F3 + `window.__telemetry.export()`** — returns JSON string.                                        | ADR-0022           |

### Forbidden Approaches

| #    | Rule                                                                                | Source   |
| ---- | ----------------------------------------------------------------------------------- | -------- |
| D-F1 | Never intercept game input — overlay must have `pointer-events: none`.              | ADR-0009 |
| D-F2 | Never write to any system state — read-only on all systems.                         | ADR-0009 |
| D-F3 | Never emit events on the Event Bus.                                                 | ADR-0009 |
| D-F4 | Never statically import Dev Infra from production code — always dynamic `import()`. | ADR-0004 |

### Performance Guardrails

| #    | Rule                                                                        | Source   |
| ---- | --------------------------------------------------------------------------- | -------- |
| D-G1 | Dev Tools: zero bytes in production build (tree-shaken by `__DEV__` guard). | ADR-0009 |
| D-G2 | Telemetry: ~1.4 MB/hour/car in dev memory (capped to race duration).        | ADR-0022 |

---

## Feature Layer Rules

_Applies to: Single Race adapter (mode-specific bridge between Menu and Race
Management). Same pattern for future modes (Championship, Story)._

### Required Patterns

| #   | Rule                                                                                                               | Source   |
| --- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| X1  | **Zero state, zero tick, zero Event Bus subscriptions** — thin adapter that translates player intent and vanishes. | ADR-0021 |
| X2  | **`buildConfig()` returns `RaceConfiguration`** — pure data object. Passed to `RM.init()` immediately, not cached. | ADR-0021 |
| X3  | **Fixed grid 8** — player + 7 AI.                                                                                  | ADR-0021 |
| X4  | **Difficulty as `number`** (0.75 / 0.875 / 1.0 / 1.125 / 1.25) — not string enum.                                  | ADR-0021 |
| X5  | **One-shot lifecycle** — each race independent, no persistence.                                                    | ADR-0021 |
| X6  | **Zero Babylon.js imports** — pure TypeScript.                                                                     | ADR-0021 |

### Forbidden Approaches

| #    | Rule                                                                               | Source   |
| ---- | ---------------------------------------------------------------------------------- | -------- |
| X-F1 | Never hold state between races — no Event Bus subscriptions, no tick registration. | ADR-0021 |
| X-F2 | Never cache `RaceConfiguration` — pass directly to `RM.init()`.                    | ADR-0021 |

---

## Presentation Layer Rules

_Applies to: HUD, Menu LITE, Audio Engine. All consumer-only — never write to
gameplay state._

### Required Patterns

| #   | Rule                                                                                                                                                                       | Source   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| P1  | **HUD: single AdvancedDynamicTexture** (`idealHeight=1080`, `useSmallestIdeal=false`).                                                                                     | ADR-0018 |
| P2  | **HUD: Grid with `widthFraction`** — proportional values summing to 1.0. NO star sizing (`ParameterType.Star` unsupported in Babylon.js GUI Grid).                         | ADR-0018 |
| P3  | **HUD: create-once, toggle-visibility** — all controls created at init, `isVisible` toggled. No runtime `addControl()`.                                                    | ADR-0018 |
| P4  | **HUD: `HudAnimator` with `HudAnimStyle` enum** — `mechanical` (0.1s tick) default for Phase 1. `smooth` and `cut` available per-block.                                    | ADR-0018 |
| P5  | **HUD: SpeedBlock at 20Hz via Event Bus** (every 3 ticks). Fallback path: if jittery, escalate to 60Hz → direct read via `HudContext.playerCar`.                           | ADR-0018 |
| P6  | **HUD: event-driven for all blocks** — SpeedBlock is the only block that reads per-frame data via throttled event.                                                         | ADR-0018 |
| P7  | **Menu LITE: screen stack push/pop** — one active screen at a time. No overlapping dialogs in Phase 1.                                                                     | ADR-0019 |
| P8  | **Menu LITE: pre-create 6 screens** at init (~600KB controls + ~1MB thumbnails). Navigation toggles `isVisible` — zero runtime allocation.                                 | ADR-0019 |
| P9  | **Menu LITE: instant transitions** — no fade or slide in Phase 1.                                                                                                          | ADR-0019 |
| P10 | **Menu LITE: GSM local copy** via Event Bus subscription (same pattern as Input ADR-0006).                                                                                 | ADR-0019 |
| P11 | **Menu LITE: Loading screen minimum 0.5s** — skip entirely if assets load faster. "Still loading" indicator at 10s.                                                        | ADR-0019 |
| P12 | **Menu LITE: car thumbnails** via `CreateScreenshotUsingRenderTargetAsync` with isolated camera, captured once at init.                                                    | ADR-0019 |
| P13 | **Audio: Audio Engine V2 ONLY** — `CreateSoundAsync` (not `new Sound()`), `CreateAudioBusAsync` (not `SoundTrack`), `CreateSoundSourceAsync`, `CreateStreamingSoundAsync`. | ADR-0020 |
| P14 | **Audio: 4 AudioBuses** — `music` (0.5), `sfx` (0.7), `ui` (0.6), `ambient` (0.4).                                                                                         | ADR-0020 |
| P15 | **Audio: hybrid engine sound** — WAV loop + OscillatorNode via `CreateSoundSourceAsync`, both routing through same `sfxBus`.                                               | ADR-0020 |
| P16 | **Audio: 500ms linear crossfade** — `setVolume(0, { duration: 0.5 })` between GSM state changes.                                                                           | ADR-0020 |
| P17 | **Audio: `maxInstances` for collisions** — default 5. No custom pooling.                                                                                                   | ADR-0020 |
| P18 | **Audio: engine WAV loop 2-4s** — `StaticSound.playbackRate` for pitch shift (not `StreamingSound` — no `playbackRate` support).                                           | ADR-0020 |

### Forbidden Approaches

| #    | Rule                                                                                                                | Source   |
| ---- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| P-F1 | Never use legacy `Sound` class — deprecated since v8.0, no longer updated.                                          | ADR-0020 |
| P-F2 | Never use `SoundTrack` — Audio Engine V2 uses `AudioBus` (`CreateAudioBusAsync`).                                   | ADR-0020 |
| P-F3 | Never bypass Babylon.js Audio Engine with raw Web Audio API — use `CreateSoundSourceAsync` on an existing AudioBus. | ADR-0020 |
| P-F4 | Never use HTML/CSS for HUD — all UI via Babylon.js GUI (`AdvancedDynamicTexture`).                                  | ADR-0018 |
| P-F5 | Never destroy/recreate HUD controls at runtime — create once, toggle visibility.                                    | ADR-0018 |
| P-F6 | Never use fade/slide transitions in Menu LITE Phase 1 — instant `isVisible` toggle only.                            | ADR-0019 |
| P-F7 | Never attach HUD blocks directly to ADT — always use a zone grid and `HudBlock.container`.                          | ADR-0018 |

### Performance Guardrails

| #    | Rule                                                                  | Source   |
| ---- | --------------------------------------------------------------------- | -------- |
| P-G1 | HUD: < 0.3ms GPU per frame (single ADT, 8 blocks + overlays).         | ADR-0018 |
| P-G2 | Menu LITE: ~1.6MB total (~600KB controls + ~1MB thumbnail data URLs). | ADR-0019 |
| P-G3 | Audio: ~2MB for 4 WAV samples (~500KB each at 2-4s, 44.1kHz/16-bit).  | ADR-0020 |
| P-G4 | Menu LITE init: ~8-16ms for 8 car thumbnails, ~1ms for 300 controls.  | ADR-0019 |
| P-G5 | Menu LITE per frame (active screen): ~0.1-0.3ms for ~50 controls.     | ADR-0019 |

---

## Global Rules (All Layers)

### Naming Conventions

| Element             | Convention                            | Example                                  | Source                   |
| ------------------- | ------------------------------------- | ---------------------------------------- | ------------------------ |
| Classes             | PascalCase                            | `PlayerController`, `SceneManager`       | technical-preferences.md |
| Interfaces          | PascalCase with `I` prefix            | `IPlayerState`, `IVehicleConfig`         | technical-preferences.md |
| Variables/functions | camelCase                             | `moveSpeed`, `takeDamage()`              | technical-preferences.md |
| Constants           | UPPER_SNAKE_CASE                      | `MAX_PLAYER_SPEED`, `GRAVITY`            | technical-preferences.md |
| Files               | camelCase                             | `playerController.ts`, `sceneManager.ts` | technical-preferences.md |
| Private members     | `_` prefix                            | `_health`, `_updatePosition()`           | technical-preferences.md |
| Enums/types         | PascalCase                            | `GameState`, `PlayerAction`              | technical-preferences.md |
| Test files          | co-located `*.test.ts` or `*.spec.ts` | `playerController.test.ts`               | technical-preferences.md |

### Performance Budgets

| Target         | Value                            | Source                   |
| -------------- | -------------------------------- | ------------------------ |
| Framerate      | 60 fps                           | technical-preferences.md |
| Frame budget   | 16.6 ms                          | technical-preferences.md |
| Draw calls     | < 500 (target), < 1000 (ceiling) | technical-preferences.md |
| Memory ceiling | 512 MB                           | technical-preferences.md |

### Approved Libraries / Addons

| Library                      | Purpose                | Source                                 |
| ---------------------------- | ---------------------- | -------------------------------------- |
| `@babylonjs/core`            | Engine                 | technical-preferences.md               |
| `@babylonjs/gui`             | HUD and menus          | technical-preferences.md               |
| `@babylonjs/havok` (^1.3.12) | Physics                | technical-preferences.md               |
| `@babylonjs/loaders`         | GLB/GLTF model loading | technical-preferences.md               |
| `vite`                       | Build tool             | technical-preferences.md               |
| `typescript` (^6.0)          | Language               | technical-preferences.md, package.json |

### Forbidden APIs (Babylon.js 9.12.0)

These APIs are deprecated, removed, or incompatible with the pinned engine version.

| API                             | Replacement                                        | Since   | Source                       |
| ------------------------------- | -------------------------------------------------- | ------- | ---------------------------- |
| `Sound` class (legacy)          | `CreateSoundAsync` + Audio Engine V2               | v8.0    | ADR-0020, deprecated-apis.md |
| `new Sound(...)` constructor    | `CreateSoundAsync` from `@babylonjs/core/AudioV2/` | v8.0    | ADR-0020                     |
| `SoundTrack`                    | `CreateAudioBusAsync` from V2                      | v8.0    | ADR-0020                     |
| `SceneLoader.Load` (sync)       | `SceneLoader.LoadAsync`                            | v7.34   | ADR-0003, deprecated-apis.md |
| `SceneLoader.Append` (sync)     | `SceneLoader.AppendAsync`                          | v7.34   | deprecated-apis.md           |
| `SceneLoader.ImportMesh` (sync) | `SceneLoader.ImportMeshAsync`                      | v7.34   | deprecated-apis.md           |
| Webpack                         | Vite                                               | v9.5.0  | deprecated-apis.md           |
| Jest                            | Vitest                                             | v8.56.2 | deprecated-apis.md           |
| ts-patch                        | TypeScript 6.0 native (no patch needed)            | v9.1.0  | deprecated-apis.md           |
| WebVR                           | WebXR                                              | v7.0    | deprecated-apis.md           |

### Forbidden Patterns

| Pattern                                      | Why                                                 | Source                   |
| -------------------------------------------- | --------------------------------------------------- | ------------------------ |
| `import * as BABYLON from "@babylonjs/core"` | Barrel import breaks tree-shaking                   | technical-preferences.md |
| Singletons for game systems                  | Use dependency injection via constructor parameters | technical-preferences.md |
| Hardcoded gameplay values                    | Must be data-driven via ConfigManager               | technical-preferences.md |
| Direct DOM manipulation                      | Use Babylon.js GUI for UI                           | technical-preferences.md |

### Cross-Cutting Constraints

| #   | Rule                                                                                                                  | Source             |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------ |
| G1  | All config reads must go through `ConfigManager.get<T>()` — never access raw JSON or hardcoded objects.               | ADR-0023           |
| G2  | All cross-system state-change signals must go through Event Bus — never direct method calls across system boundaries. | ADR-0001, ADR-0004 |
| G3  | Colour values must be imported from `design/art/palette.json` — no hardcoded hex in game code.                        | art-bible.md       |
| G3  | Foundation layer must have zero `@babylonjs/core` imports — verified by `tsc --noEmit`.                               | ADR-0004           |
| G4  | Dev Infra code must compile to zero bytes in production (`__DEV__` guard).                                            | ADR-0004           |
| G5  | `Entity/Car Lifecycle` is in Core, not Foundation (uses `PhysicsAggregate`, `AbstractMesh`).                          | ADR-0004, ADR-0005 |
| G6  | Player and AI share identical physics model — no cheating, no special treatment for AI.                               | ADR-0008, ADR-0013 |
| G7  | All simulation code must use `SeededRandom.random()` — never `Math.random()` inside pipeline `update()`.              | ADR-0002           |
| G8  | Config keys are camelCase. Event Bus events are snake_case (intentional visual marker).                               | ADR convention     |
