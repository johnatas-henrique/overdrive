# Story 001: Core Collision Manager

> **Epic**: Collision
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/collision.md`
**Requirements**:

- `TR-COLLISION-001`: Havok onCollisionObservable registered per PhysicsBody — emits collision.impact(event) with impulse magnitude
- `TR-COLLISION-004`: Minimum impulse threshold (configurable) — collisions below threshold do not emit impact events
- `TR-COLLISION-005`: Collision system has no update() callback — event-only; subscribes to Havok callbacks at PreRace entry
- `TR-COLLISION-009`: Callback registration is reentrant — off() before on() to prevent duplicate registrations on Race Again

**ADR Governing Implementation**: ADR-0010: Collision Model
**ADR Decision Summary**: Event-only collision system subscribing to `onCollisionObservable` (not `collisionEndedObservable`). Barrier detection via `Set<PhysicsBody>` (registerBarrier). Grazing suppression via tick-throttle map. No `update()` method.

**Engine**: Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12 | **Risk**: LOW
**Engine Notes**: `onCollisionObservable` stable API since Havok V2 introduction. `IPhysicsCollisionEvent.impulse` must be verified to contain real Havok impulse magnitude.

**Control Manifest Rules (this layer)**:

- Required (C29): Collision: `onCollisionObservable` — provides `IPhysicsCollisionEvent` with `impulse`, `point`, `normal`. NOT `collisionEndedObservable` (no impulse data).
- Required (C30): Collision: event-only — no `update()`, no pipeline slot. Registered at PreRace, unregistered at PostRace.
- Required (C31): Collision: grazing suppression — sustained barrier scrape suppressed within `grazeSuppressFrames` ticks.
- Required (C32): Collision: barrier detection via `Set<PhysicsBody>` (registerBarrier).
- Forbidden (C-F4): Never use `collisionEndedObservable` for impact events — no impulse data.
- Guardrail (C-G8): Collision: ~0.001ms per contact event (map lookup + Event Bus emit).

---

## Acceptance Criteria

_From GDD `design/gdd/collision.md`, scoped to this story:_

- [ ] Car↔car contact emits `collision.impact` with correct carId, otherId, impulse
- [ ] Collision registers/unregisters with Havok on PreRace/PostRace GSM transitions
- [ ] No damage, deformation, or mechanical consequence from any collision event in Phase 1
- [ ] `onCollisionObservable` filtered to `COLLISION_STARTED` only — sustained contacts don't re-emit every tick
- [ ] Minimum impulse threshold configurable via config — collisions below threshold do not emit
- [ ] Reentrant registration — `setActive(true)` after `setActive(false)` does not duplicate listeners
- [ ] `registerCar()` calls `setCollisionCallbackEnabled(true)`
- [ ] No `update()` method — event-only system

---

## Implementation Notes

_Derived from ADR-0010 Implementation Guidelines:_

### ICollisionManager Interface

```typescript
interface ICollisionManager {
  init(havokPlugin: HavokPlugin, eventBus: IEventBus): void;
  registerCar(carId: string, body: PhysicsBody): void;
  registerBarrier(body: PhysicsBody): void; // populated in Story 002
  setActive(active: boolean): void;
  dispose(): void;
}
```

### Core Subscription Pattern

Subscribe to `havokPlugin.onCollisionObservable`. The observable fires for both `COLLISION_STARTED` and `COLLISION_CONTINUED` events. Filter to `COLLISION_STARTED` only — otherwise sustained contacts emit every physics tick:

```typescript
onCollisionObservable.add((event) => {
  if (event.type !== PhysicsEventType.COLLISION_STARTED) return;
  // ... emission logic
});
```

### registerCar

```typescript
registerCar(carId: string, body: PhysicsBody): void {
  bodyToCar.set(body, carId);
  body.setCollisionCallbackEnabled(true); // required for onCollisionObservable
}
```

### Minimum Impulse Threshold

Check `config.collision.shakeMinImpulse` (default 1.0 N·s) before emitting. Collisions below threshold are silently dropped — prevents trigger-happy emission on light contact.

### Reentrant Registration

`setActive(true)` must call `off()` before `on()` to prevent duplicate listener registrations on Race Again. The pattern:

```typescript
setActive(active: boolean): void {
  if (this._active === active) return;
  this._active = active;
  if (active) {
    this._subscription = havokPlugin.onCollisionObservable.add(this._handler);
  } else {
    this._subscription?.unsubscribe();
    this._subscription = undefined;
  }
}
```

### Body→CarId Map Lifecycle

The `Map<PhysicsBody, string>` is populated via `registerCar()` and cleaned up on `dispose()`. No auto-removal — lifecycle is driven by Entity/Car Lifecycle's `entity.spawned` and `entity.despawned` events (to be wired in Story 004).

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Barrier registration (`registerBarrier`) and `Set<PhysicsBody>` — Story 002
- Grazing suppression tick-throttle map — Story 003
- `collisionEndedObservable` tracking — Story 004
- GSM lifecycle integration (register at PreRace, unregister at PostRace via Event Bus) — Story 004
- Config namespace registration — handled by ConfigManager

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1**: Car↔car contact emits collision.impact with correct payload
  - Given: Two CarEntity instances C1 and C2 registered with CollisionManager, and Havok reports a contact between C1 and C2 with impulse 12.5 N·s
  - When: The CollisionManager processes the contact callback
  - Then: Exactly one collision.impact event is emitted on the Event Bus, and the event payload has: carId = C1.id, otherId = C2.id, impulse = 12.5 (number), relativeVelocity = closing speed (number), position = { x, y, z } matching contact point
  - Edge cases: Zero-impulse contact still triggers event (threshold is consumer-side)

- **AC-2**: Registration on PreRace, unregistration on PostRace
  - Given: CollisionManager in unregistered state
  - When: GSM transitions to PreRace
  - Then: CollisionManager calls Havok's setCollisionCallbackEnabled(true)
  - When: GSM transitions to Racing
  - Then: CollisionManager remains registered (no duplicate registration)
  - When: GSM transitions to PostRace
  - Then: CollisionManager calls Havok's setCollisionCallbackEnabled(false)

- **AC-3**: No side effects beyond event emission
  - Given: CarEntity C1 and C2 registered with CollisionManager, and all CarEntity mutators (setHealth, setSpeed, setDurability, etc.) are mocked
  - When: Havok reports a max-impulse contact between C1 and C2
  - Then: Exactly one collision.impact event is emitted, and no CarEntity mutator was called on C1 or C2, and no Damage/Deformation system was invoked

- **AC-4**: Filtered to COLLISION_STARTED only
  - Given: CarEntity C1 and C2 in sustained contact (Havok reports contact every tick for 10 ticks)
  - When: CollisionManager processes the contact callbacks
  - Then: Exactly one collision.impact event is emitted (not 10)
  - Edge cases: Intermittent contact — C1 and C2 separate and re-contact after 5 ticks; a new collision.impact event is emitted for the re-contact

- **AC-5**: Minimum impulse threshold from config
  - Given: config.collision.shakeMinImpulse = 5.0
  - When: Havok reports a contact with impulse 4.9
  - Then: No collision.impact event is emitted
  - When: Havok reports a contact with impulse 5.0
  - Then: Exactly one collision.impact event is emitted
  - Edge cases: Runtime threshold change — if shakeMinImpulse changes to 10.0, an 8.0 impulse contact produces no event

- **AC-6**: Reentrant setActive does not duplicate listeners
  - Given: CollisionManager is active and C1, C2 registered
  - When: setActive(false) is called, then setActive(true) is called, and Havok reports a contact between C1 and C2
  - Then: Exactly one collision.impact event is emitted
  - Edge cases: Rapid toggle — setActive(true), setActive(false), setActive(true) in sequence still produces exactly one event per contact

- **AC-7**: registerCar binds callbacks
  - Given: A PhysicsBody mock for car C1
  - When: registerCar(C1) is called
  - Then: setCollisionCallbackEnabled(true) was called exactly once on C1's PhysicsBody

- **AC-8**: No update() method
  - Given: CollisionManager class definition
  - Then: The class has no public method named "update", and the class exposes no tick-based public API (no "tick", "step", "process" methods)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/collision/collision-manager.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: Story 002 (Barrier Detection & Event Classification), Story 003 (Grazing Suppression), Story 004 (GSM Lifecycle Integration)
