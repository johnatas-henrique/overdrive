# Entity / Car Lifecycle

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Foundation — entity creation, pooling, and destruction

## Overview

The Entity/Car Lifecycle manages the creation and destruction of all game entities — primarily cars, and in Fase 1 also static track colliders. It owns the `CarEntity` data structure that holds the physical identity of a car (mesh reference, physics body, AI driver link) but NOT its runtime state. Runtime state (fuel, tire wear, damage) lives in the respective owner systems, indexed by `carId` — the lifecycle does not share or manage that data. Cars are spawned from cached AssetContainer clones at PreRace entry and destroyed at PostRace exit. No object pooling — profiles guide that decision later if needed.

## Developer Fantasy

The developer defines a team-based grid configuration. At PreRace, they call `entityLifecycle.spawnGrid(teams, playerTeamId)`. Eight cars appear on the track — meshes cloned, physics bodies attached, AI drivers assigned. At PostRace, they call `entityLifecycle.destroyAll()`. Every car is removed, every physics body cleaned up, every reference released. Between those two calls, `entityLifecycle.getEntity(carId)` returns the `CarEntity` with mesh, position, and physics body — ready for Physics to simulate and AI to decide.

## Detailed Design

### Core Rules

**1. CarEntity — identity only, no runtime state.**

```typescript
interface CarEntity {
  id: string; // 'player', 'ai_0', 'ai_1', ..., 'ai_6'
  teamId: string; // 'macklen', 'willard', ...
  gridIndex: number; // starting grid position (0 = pole)
  mesh: AbstractMesh; // root node of cloned car
  physicsBody: PhysicsAggregate | null; // null until Physics system attaches it
  aiDriver?: AIDriverRef; // undefined for player car
}

/**
 * Lightweight identity reference only — tells which team and driver profile
 * the AI uses. The AI Driver module owns runtime state (AIController)
 * in a Map<carId, AIController> and never accesses CarEntity.aiDriver
 * during gameplay ticks.
 */
interface AIDriverRef {
  readonly teamId: string;
  readonly driverProfile: string; // key into ai driver profile registry
}
```

Fuel level, tire wear, damage, lap count, and all other mutable race state live in the respective owner systems (`Map<carId, FuelState>`, `Map<carId, TireState>`, etc.). The lifecycle never touches runtime data.

**2. Player and AI are the same structure.** The player car has `aiDriver = undefined`. Every other system treats all cars identically — Fuel does not know which car is the player, Collision does not care. This uniformity simplifies AI introduction: adding a new AI car is the same code path as adding the player.

**3. Cloning from AssetContainer.** At PreRace, the lifecycle calls `instantiateModelsToScene()` for each car from the cached AssetContainer. Each clone receives a unique name prefix (`macklen_car_0`, `willard_car_1`) to prevent name collisions. The result is wrapped in a `CarEntity` and stored in `Map<carId, CarEntity>`.

**4. Grid assignment.** The lifecycle receives an ordered array of grid cars — a team definition per slot. It spawns them in grid order. Grid order is determined by Race Management (inverted from previous result, or championship standing). The lifecycle does not decide grid order, only executes it.

**5. Physics body ownership.** The lifecycle creates the `PhysicsAggregate` for each car (convex hull, 800 kg mass). The Physics/Handling system later attaches constraints, vehicle configuration, and suspension. The lifecycle is responsible for disposing the physics body when the car is destroyed.

### States and Transitions

```
[Uninitialized] --init()--> [Idle] --spawnGrid()--> [Grid Active] --destroyAll()--> [Idle]
```

| State             | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| **Uninitialized** | Not ready. `spawnGrid()` throws.                                 |
| **Idle**          | No active cars. `getEntity()` returns null.                      |
| **Grid Active**   | N cars exist on the track. `getEntity()` returns valid entities. |

**Transitions:**

- Uninitialized → Idle: `EntityLifecycle.init()`
- Idle → Grid Active: `spawnGrid(teams, playerTeamId)` — clones meshes, creates physics bodies, assigns AI
- Grid Active → Idle: `destroyAll()` — disposes physics bodies, returns meshes to AssetContainer cache, clears entity map

### Interactions with Other Systems

| System                    | Role                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| **GSM**                   | Listens to `'gsm.state.entered'` — calls `spawnGrid()` on PreRace, `destroyAll()` on PostRace         |
| **Asset Manager**         | Provides cached `AssetContainer` for car GLB; called to `instantiateModelsToScene()`                  |
| **Event Bus**             | Emits `'entity.spawned'` (carId, teamId, gridIndex) and `'entity.despawned'` (carId) for each car     |
| **Physics/Handling**      | Receives car entity via Event Bus `'entity.spawned'` — attaches physics constraints and suspension    |
| **AI Driver**             | Receives `'entity.spawned'` for AI cars — starts behavior tree                                        |
| **Fuel, Tire Wear, etc.** | Listen to `'entity.spawned'` to initialize their per-car state maps; clean up on `'entity.despawned'` |
| **Camera**                | On `'entity.spawned'`, checks if car is player — if so, sets follow target                            |

## Formulas

None. The Entity/Car Lifecycle only creates and destroys — it does not compute race data.

## Edge Cases

1. **Re-spawn without destroy.** `spawnGrid()` called while Grid Active. The lifecycle throws — `destroyAll()` must be called first. This prevents accidental double-spawn.
2. **Car mesh not in cache.** `instantiateModelsToScene()` returns empty. The lifecycle skips this car, logs error, emits `'entity.spawn.error'`. Race continues with N-1 cars.
3. **Duplicate carId.** Player car and an AI car both try to use `'player'`. The lifecycle uses the grid array index as suffix for AI cars (`ai_0...ai_6`) — guaranteed unique.
4. **destroyAll() during race.** If Physics/Handling is mid-step when `destroyAll()` is called (should not happen — GSM ensures PreRace→Racing→PostRace), the physics body dispose may fail. The lifecycle guards with a flag: once `destroyAll()` starts, `getEntity()` returns null, physics calls are no-ops.

## Dependencies

- **Asset Manager** (#6) — cached car `AssetContainer` for cloning
- **Event Bus** (#2) — emits spawn/despawn events
- **Data & Config** (#1) — team definitions (stats, AI personality, paint colors)
- **Babylon.js** — `PhysicsAggregate`, `PhysicsShapeType`, `AbstractMesh`

## Tuning Knobs

None. The lifecycle is config-free — grid size is determined by the caller.

## Visual/Audio Requirements

None directly. Visual and audio effects tied to car presence (engine sound, exhaust) are owned by Audio and VFX systems reacting to `'entity.spawned'` / `'entity.despawned'`.

## UI Requirements

None. The HUD reads car data from the Fuel System, Race Management, and other owner systems — not from the lifecycle.

## Acceptance Criteria

1. `EntityLifecycle.init()` enters Idle state.
2. `spawnGrid([teamA, teamB, ...], 'teamA')` — N cars are cloned, each has a unique `carId`, physics bodies created, and `'entity.spawned'` emitted per car.
3. `getEntity('player')` returns the player's `CarEntity` with valid mesh and physics body.
4. `getEntity('ai_3')` returns the 4th AI car with a valid `aiDriver` — player car has `aiDriver = undefined`.
5. `destroyAll()` — all physics bodies disposed, all meshes removed from scene, `'entity.despawned'` emitted per car, entity map cleared.
6. `getEntity('player')` after `destroyAll()` returns `null`.
7. `spawnGrid()` while Grid Active throws `EntityLifecycleError('Grid already active')`.
8. Fuel system initializes its per-car state map on each `'entity.spawned'` — player and AI alike.

## Open Questions

None.
