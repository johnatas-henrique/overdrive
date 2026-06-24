# ADR-0010: Collision Model

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12                                                              |
| **Domain**                | Collision Detection                                                                                       |
| **Knowledge Risk**        | LOW — `onCollisionObservable` stable API since Havok V2 introduction                                      |
| **References Consulted**  | collision.md GDD, modules/physics.md, ADR-0008 (re `onCollisionObservable` vs `collisionEndedObservable`) |
| **Post-Cutoff APIs Used** | `onCollisionObservable` (stable)                                                                          |
| **Verification Required** | `IPhysicsCollisionEvent.impulse` contains real Havok impulse magnitude                                    |

## ADR Dependencies

| Field             | Value                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------- |
| **Depends On**    | ADR-0008 (Physics — DYNAMIC bodies produce collision data via `onCollisionObservable`)        |
| **Enables**       | Camera shake (player collisions), Audio thud/scrape, AI Driver tactical avoidance             |
| **Blocks**        | None                                                                                          |
| **Ordering Note** | No `update()` — registers callbacks at PreRace entry. Event-only system, zero pipeline ticks. |

## Context

### Problem Statement

When two cars touch, or a car touches a barrier, the game must react — camera shakes, audio plays, AI adjusts. The physics engine (Havok) already resolves contacts; Collision's job is to translate Havok's raw contact callbacks into named game events with impulse magnitude, without adding a tick-to-tick system.

### Constraints

- No per-tick update — event-driven only, zero pipeline slot
- No state machine — registered during PreRace, active during Racing, unregistered at PostRace
- No damage in Phase 1 — Collision emits events only
- Correct observable: `onCollisionObservable` provides `IPhysicsCollisionEvent` with `impulse`, `point`, `normal` (per ADR-0008). `collisionEndedObservable` provides `IBasePhysicsCollisionEvent` with no impulse data and is used only for contact-separation tracking.

### Requirements

- Register Havok contact callbacks at PreRace, unregister at PostRace
- Emit `collision.impact` event per contact pair
- Distinguish car↔car vs car↔barrier contacts
- Include impulse magnitude in event payload
- Include contact world position in event payload
- Suppress grazing contacts (sustained barrier scrape → throttle to avoid event spam)

## Decision

### Architecture

```
Havok executeStep(dt)
  │
  ├── onCollisionObservable ──► Collision ──► Event Bus: collision.impact
  │     IPhysicsCollisionEvent      filter     { carId, otherId, impulse,
  │     (impulse, point, normal)    group      relativeVelocity, position }
  │
  └── onCollisionEndedObservable ──► internal only (contact separation tracking)
        IBasePhysicsCollisionEvent
        (no impulse)
```

Collision subscribes to `onCollisionObservable` on the HavokPlugin instance. On each collision-start event:

1. Identify carId from the PhysicsBody's associated CarEntity (via a body→carId map registered during entity.spawned)
2. Determine other identity (check collision filter group → 'barrier' or other car's carId)
3. Apply grazing suppression (if same carId + barrierId within grazeSuppress frames, skip)
4. Publish `collision.impact` to Event Bus

### Key Interfaces

```typescript
interface ICollisionManager {
  init(havokPlugin: HavokPlugin, eventBus: IEventBus): void;
  registerCar(carId: string, body: PhysicsBody): void;
  registerBarrier(body: PhysicsBody): void; // populate barrier Set
  setActive(active: boolean): void;
  dispose(): void;
}

interface CollisionImpactEvent {
  carId: string;
  otherId: string; // 'barrier' | other carId
  impulse: number; // N·s from Havok
  relativeVelocity: number; // closing speed (km/h)
  position: { x: number; y: number; z: number };
}
```

### Barrier Detection

Barrier meshes are registered via `registerBarrier(body: PhysicsBody)`, which populates a `Set<PhysicsBody>` of known barrier bodies. Collision checks `barrierBodies.has(event.collidedAgainst)` to distinguish barriers from other collision partners.

**Why not collision filter groups?** The Havok V2 API exposes filter membership on `PhysicsShape` (via `shape.filterMembershipMask`), not `PhysicsBody`. Accessing the contact body's shape requires a null-check chain. A simple `Set<PhysicsBody>` is more robust, avoids the shape indirection, and works independently of the Track system's filter group configuration.

### registerCar

```typescript
registerCar(carId: string, body: PhysicsBody): void {
  bodyToCar.set(body, carId);
  body.setCollisionCallbackEnabled(true);  // required for onCollisionObservable
}
```

### COLLISION_STARTED Filter

`onCollisionObservable` fires for both `COLLISION_STARTED` and `COLLISION_CONTINUED` events. The callback filters to `COLLISION_STARTED` only — otherwise sustained contacts (barrier scrape) would emit `collision.impact` every physics tick.

```typescript
onCollisionObservable.add((event) => {
  if (event.type !== PhysicsEventType.COLLISION_STARTED) return;
  // ...
});
```

### Relative Velocity Calculation

```typescript
const computeRelativeVelocity = (event: IPhysicsCollisionEvent): number => {
  const v1 = event.collider.getLinearVelocity();
  const v2 = event.collidedAgainst.getLinearVelocity();
  return Vector3.Distance(v1, v2);
};
```

The closing speed is computed as the magnitude of the relative velocity vector between the two colliding bodies.

````

### Grazing Suppression

```typescript
// Track last emission per (carId, barrierId) pair
const lastEmission = new Map<string, number>(); // key: `${carId}:${barrierId}` → tick

onCollisionObservable.add((event) => {
  if (event.type !== PhysicsEventType.COLLISION_STARTED) return; // ignore COLLISION_CONTINUED
  if (!event.point || !event.normal) return; // skip events without contact position/normal

  const carId = bodyToCar.get(event.collider);
  if (!carId) return;

  const other = barrierBodies.has(event.collidedAgainst)
    ? 'barrier'
    : bodyToCar.get(event.collidedAgainst) ?? 'unknown';

  if (other === 'barrier') {
    // Tick-throttle suppression for sustained grazing contacts
    const key = `${carId}:barrier`;
    const lastTick = lastEmission.get(key) ?? 0;
    const currentTick = pipeline.getCurrentTick();
    if (currentTick - lastTick < config.grazeSuppressFrames) {
      return; // suppress
    }
    lastEmission.set(key, currentTick);
  }

  eventBus.emit('collision.impact', {
    carId,
    otherId: other,
    impulse: event.impulse,
    relativeVelocity: computeRelativeVelocity(event),
    position: { x: event.point.x, y: event.point.y, z: event.point.z },
  });
});
````

### Barrier Detection

Barrier meshes are registered via `registerBarrier(body: PhysicsBody)`, which populates a `Set<PhysicsBody>` of known barrier bodies. Collision checks `barrierBodies.has(event.collidedAgainst)` to distinguish barriers from other collision partners.

**Why not collision filter groups?** The Havok V2 API (`@babylonjs/havok` ^1.3.12) exposes collision filter membership on `PhysicsShape` via `shape.filterMembershipMask` — not on `PhysicsBody`. Accessing the contact body's shape requires a null-check chain. A simple `Set<PhysicsBody>` is more robust, avoids the shape indirection, and does not depend on Track system filter group configuration.

## Alternatives Considered

### Alternative 1: Pipeline tick with polling

- **Description**: Collision runs as a pipeline slot (#4), polling all physics bodies for contact state each tick.
- **Cons**: Reimplements what Havok already provides (callbacks). Every tick = wasted work when no contacts exist. No benefit over callbacks.
- **Rejection Reason**: Event-driven is strictly better for collision — zero cost when nothing touches, no latency advantage to polling since Havok resolves contacts in the same tick's `executeStep()`.

### Alternative 2: Collision subscribed to collisionEndedObservable only

- **Description**: Use `onCollisionEndedObservable` for all collision detection.
- **Rejection Reason**: `IBasePhysicsCollisionEvent` (from `collisionEndedObservable`) has NO impulse, NO point, NO normal fields. Impulse data is essential for Camera shake scaling and Audio volume. Only `IPhysicsCollisionEvent` (from `onCollisionObservable`) carries impulse.

## Consequences

### Positive

- Zero per-tick cost — collision detection is purely event-driven
- Impulse data is real Havok magnitude — `collision.impact.impulse` matches physics resolution
- Grazing suppression prevents event spam on barrier scrapes
- Barrier detection via collision filter group — no geometry lookups
- No damage modeling in Phase 1 — Collision stays simple, Alpha expansion adds downstream consumers only

### Negative

- Contact separation data (from `collisionEndedObservable`) is unused in Phase 1 — available for Alpha Damage system
- Body→carId map must be kept in sync with CarEntity lifecycle (register on `entity.spawned`, remove on `entity.despawned`)

### Risks

- **Risk**: Multiple contacts per tick flood the Event Bus
  **Mitigation**: Grazing suppression handles barrier scrapes. Car↔car contacts are naturally low-frequency (touching cars separate quickly at racing speed). Camera and Audio throttle independently.
- **Risk**: Barrier filter group conflicts with another system's group assignment
  **Mitigation**: Collision filter groups defined in a single location (Track + Environment owns BARRIER group). Collision reads the group constant, never defines it.

## GDD Requirements Addressed

| GDD System   | Requirement                                 | How This ADR Addresses It                                |
| ------------ | ------------------------------------------- | -------------------------------------------------------- |
| collision.md | Event-driven only, no update()              | Subscribes to Havok `onCollisionObservable`              |
| collision.md | Car↔car and car↔barrier detection           | Filter group check + body→carId map                      |
| collision.md | Impulse magnitude in payload                | `IPhysicsCollisionEvent.impulse`                         |
| collision.md | Grazing suppression                         | `grazeSuppressFrames` throttle per (carId, barrier) pair |
| collision.md | Register at PreRace, unregister at PostRace | `setActive(true/false)`                                  |

## Performance Implications

- **CPU**: Zero per tick when no contacts. ~0.001ms per contact event (map lookup + Event Bus emit).
- **Memory**: body→carId map (8 entries) + grazing suppression map (small, cleared on PostRace).

## Validation Criteria

- [ ] `onCollisionObservable` filtered to `COLLISION_STARTED` — sustained contacts don't re-emit every tick
- [ ] `registerCar()` calls `setCollisionCallbackEnabled(true)` — callbacks fire correctly
- [ ] `registerBarrier()` populates barrier Set — collisions with non-barrier static meshes ignored
- [ ] `event.point` and `event.normal` null-guarded — no crash on missing contact data
- [ ] Car↔car contact emits `collision.impact` with impulse > 0
- [ ] Car↔barrier contact emits `collision.impact` with otherId = 'barrier'
- [ ] Grazing barrier suppresses repeated events within `grazeSuppressFrames` ticks
- [ ] Collision registers at PreRace, unregisters at PostRace
- [ ] body→carId map matches CarEntity lifecycle (spawned/despawned)
- [ ] `computeRelativeVelocity()` produces closing speed in km/h

## Related Decisions

- ADR-0008 (Vehicle Physics — confirms `onCollisionObservable` provides impulse data via `IPhysicsCollisionEvent`, `collisionEndedObservable` does not)
- ADR-0001 (Event Bus — `collision.impact` flows through the bus synchronously)
- ADR-0005 (Entity/Car Lifecycle — body→carId map populated on `entity.spawned`)
