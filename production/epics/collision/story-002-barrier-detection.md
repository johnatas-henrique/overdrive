# Story 002: Barrier Detection & Event Classification

> **Epic**: Collision
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/collision.md`
**Requirements**:

- `TR-COLLISION-002`: Three collision groups: car (bit 0), barrier/track (bit 1), environment (bit 2) — set via PhysicsBody.setCollisionGroup()/setCollisionMask()
- `TR-COLLISION-003`: collision.impact payload: carId, otherId, impulse (float, Newton-seconds), relativeSpeed (float), type (car-car | barrier | barrier-hard)
- `TR-COLLISION-008`: car-car collisions distinguished from car-barrier by otherId prefix (car* vs barrier*). Barrier-hard is >15m/s impact into static mesh

**ADR Governing Implementation**: ADR-0010: Collision Model
**ADR Decision Summary**: Barrier meshes registered via `registerBarrier(body)`, which populates a `Set<PhysicsBody>`. Collision checks `barrierBodies.has(event.collidedAgainst)` to distinguish barriers from car bodies. Not collision filter groups (shape indirection risk). `computeRelativeVelocity()` uses `Vector3.Distance` between colliding body velocities.

**Engine**: Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12 | **Risk**: LOW
**Engine Notes**: `IPhysicsCollisionEvent` exposes `collider` and `collidedAgainst` as `PhysicsBody` references. `body.getLinearVelocity()` is available on both DYNAMIC and STATIC bodies (STATIC returns zero vector).

**Control Manifest Rules (this layer)**:

- Required (C32): Collision: barrier detection via `Set<PhysicsBody>` (registerBarrier).
- Required (C29): Collision: `onCollisionObservable` — provides `IPhysicsCollisionEvent` with `impulse`, `point`, `normal`.
- Forbidden (C-F4): Never use `collisionEndedObservable` for impact events — no impulse data.

---

## Acceptance Criteria

_From GDD `design/gdd/collision.md`, scoped to this story:_

- [ ] Car↔barrier contact emits `collision.impact` with `otherId = 'barrier'`
- [ ] Car↔car contact emits `collision.impact` with `otherId` = the other car's carId string
- [ ] Barrier meshes distinguishable from other static meshes via `Set<PhysicsBody>` (registerBarrier)
- [ ] `CollisionImpactEvent` payload includes: carId, otherId, impulse (number), relativeVelocity (number), position ({x, y, z})
- [ ] `computeRelativeVelocity()` produces closing speed as a number (vector distance between two body velocities)

---

## Implementation Notes

_Derived from ADR-0010 Implementation Guidelines:_

### Barrier Detection via Set<PhysicsBody>

**Do NOT use collision filter groups for barrier detection.** The Havok V2 API exposes filter membership on `PhysicsShape` (via `shape.filterMembershipMask`), not `PhysicsBody`. Accessing the contact body's shape requires a null-check chain. A simple `Set<PhysicsBody>` is more robust and avoids the shape indirection:

```typescript
private readonly barrierBodies = new Set<PhysicsBody>();

registerBarrier(body: PhysicsBody): void {
  this.barrierBodies.add(body);
}
```

### Identity Resolution

When a collision event fires, determine `otherId`:

```typescript
const collidedAgainst = event.collidedAgainst;
const other = this.barrierBodies.has(collidedAgainst)
  ? "barrier"
  : (this.bodyToCar.get(collidedAgainst) ?? "unknown");
```

The `bodyToCar` map is populated by `registerCar()` (Story 001).

### CollisionImpactEvent Payload

```typescript
interface CollisionImpactEvent {
  carId: string;
  otherId: string; // 'barrier' | other carId
  impulse: number; // N·s from IPhysicsCollisionEvent.impulse
  relativeVelocity: number; // closing speed in km/h
  position: { x: number; y: number; z: number }; // event.point
}
```

### Relative Velocity Calculation

```typescript
const computeRelativeVelocity = (event: IPhysicsCollisionEvent): number => {
  const v1 = event.collider.getLinearVelocity();
  const v2 = event.collidedAgainst.getLinearVelocity();
  return Vector3.Distance(v1, v2);
};
```

### Collision Type String

For the `type` field in the payload (TR-COLLISION-003, TR-COLLISION-008):

- `otherId === 'barrier'` → type = `'barrier'`
- `otherId` is another carId → type = `'car-car'`
- If `otherId === 'barrier'` and `relativeVelocity > 15` m/s → type = `'barrier-hard'`

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Grazing suppression tick-throttle — Story 003
- GSM lifecycle integration — Story 004
- Config namespace registration — handled by ConfigManager
- `setCollisionGroup`/`setCollisionMask` configuration on PhysicsBody — the collision filter groups themselves are set by Track + Environment, not Collision. Collision only _reads_ the result via barrier Set membership.

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1**: Car↔barrier contact emits otherId='barrier'
  - Given: CarEntity C1 registered with CollisionManager, and barrier B1 registered via registerBarrier(B1.physicsBody)
  - When: Havok reports a contact between C1 and B1 with impulse 8.0 N·s
  - Then: One collision.impact event is emitted, and event.otherId = 'barrier'
  - Edge cases: Multiple barriers registered — both B1 and B2; contact with either produces otherId = 'barrier' (consistent across all barriers, not the body's physics ID)

- **AC-2**: Car↔car contact emits other car's ID
  - Given: CarEntity C1 and C2 registered, with C1.id = "player-1", C2.id = "ai-37"
  - When: Havok reports contact between C1 and C2
  - Then: Event from C1's perspective has otherId = "ai-37", and event from C2's perspective has otherId = "player-1"
  - Edge cases: Defensive handling if a body somehow contacts itself — should not crash, otherId = same carId

- **AC-3**: Barrier identification via registered Set
  - Given: C1, barrier B1, and static mesh M1 (non-barrier, e.g. a kerb)
  - When: registerBarrier(B1.physicsBody) is called
  - Then: B1.physicsBody is in the barrier set, and M1.physicsBody is NOT in the barrier set
  - When: Havok reports contact between C1 and M1
  - Then: event.otherId != 'barrier' (non-barrier static meshes are not misidentified)

- **AC-4**: CollisionImpactEvent payload completeness
  - Given: A collision between C1 and C2 with impulse 15.0, relativeVel 85.4, pos {12, 0, -34}
  - When: The event is captured from Event Bus
  - Then: The payload has exactly these fields — carId: string, otherId: string, impulse: number (equal to 15.0), relativeVelocity: number (equal to 85.4), position: object with x, y, z (equal to {12, 0, -34}), and no additional fields are present

- **AC-5**: computeRelativeVelocity closing speed
  - Given: Two PhysicsBody velocity vectors: v1 = {100, 0, 0} and v2 = {80, 0, 0} (same direction, 20 km/h difference)
  - When: computeRelativeVelocity(v1, v2) is called
  - Then: result = 20.0
  - Edge cases: Head-on (v1=100, v2=-50 → 150.0), perpendicular (v1=100, v2=60 in Z → ~116.62), one zero (v1=0, v2=200 → 200.0), both zero (→ 0.0)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/collision/barrier-detection_test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (Core Collision Manager)
- Unlocks: Story 003 (Grazing Suppression), Story 004 (GSM Lifecycle Integration)
