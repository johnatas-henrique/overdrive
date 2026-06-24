# Story 004: GSM Lifecycle & Event Bus Integration

> **Epic**: Collision
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/collision.md`
**Requirements**:

- `TR-COLLISION-006`: collisionEndedObservable also tracked per body — fires when contact ends, payload includes final frame's impulse
- `TR-COLLISION-007`: Event Bus emission on collision.impact — HUD (flash overlay), Camera (shake), Audio (thud/scrape), AI Driver (tactical avoidance)

**ADR Governing Implementation**: ADR-0010: Collision Model
**ADR Decision Summary**: Collision registers at PreRace (via `gsm.state.entered(PreRace)`), active during Racing, unregisters at PostRace. `collisionEndedObservable` tracked per body for Phase 2 Alpha Damage system (no-op in Phase 1). `collision.impact` flows through Event Bus synchronously per ADR-0001.

**Engine**: Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12 | **Risk**: LOW
**Engine Notes**: GSM emits `gsm.state.entered` and `gsm.state.exited` with payload `{ from, to }` per ADR-0024. Event Bus synchronous dispatch per ADR-0001.

**Control Manifest Rules (this layer)**:

- Required (C30): Collision: event-only — no `update()`, no pipeline slot. Registered at PreRace, unregistered at PostRace.
- Required (C53): Race Management: reentrant `init()` — `eventBus.off().on()` prevents listener duplication on Race Again.
- Forbidden (C-F4): Never use `collisionEndedObservable` for impact events — no impulse data.

---

## Acceptance Criteria

_From GDD `design/gdd/collision.md`, scoped to this story:_

- [ ] `setActive(true)` called on `gsm.state.entered(PreRace)`; `setActive(false)` called on `gsm.state.entered(PostRace)`
- [ ] `collision.impact` event received by Camera (player only), Audio (player + nearby 30m), AI Driver (own contacts)
- [ ] Event Bus `collision.impact` payload matches `CollisionImpactEvent` spec end-to-end
- [ ] `collisionEndedObservable` tracked per body (no-op in Phase 1 — registered but no callback behavior)
- [ ] Reentrant Race Again: off()+on() sequence works without duplicate or missed events

---

## Implementation Notes

_Derived from ADR-0010 Implementation Guidelines:_

### GSM Lifecycle Wiring

Subscribe to Event Bus for GSM state transitions at `init()`:

```typescript
init(havokPlugin: HavokPlugin, eventBus: IEventBus): void {
  this.eventBus = eventBus;
  this.havokPlugin = havokPlugin;

  this.subscriptions.push(
    eventBus.on('gsm.state.entered', (event) => {
      if (event.to === 'PreRace') this.setActive(true);
      if (event.to === 'PostRace') this.setActive(false);
    })
  );
}
```

GSM states and Collision status:
| GSM State | Collision Status |
| --------- | ------------------------ |
| Loading | Not registered |
| Menu | Not registered |
| PreRace | Register callbacks |
| Racing | Active — emitting events |
| PostRace | Unregister callbacks |

### Reentrant Registration for Race Again

Per TR-COLLISION-009 and Rule C53: `off()` before `on()` to prevent duplicate listeners:

```typescript
setActive(active: boolean): void {
  this._active = active;
  // Unsubscribe first if already subscribed
  this._subscription?.unsubscribe();
  if (active) {
    this._subscription = this.havokPlugin.onCollisionObservable.add(this._handler);
    // Also subscribe collisionEndedObservable for Alpha tracking
    this._endedSubscription = this.havokPlugin.onCollisionEndedObservable.add(this._endedHandler);
  } else {
    this._subscription = undefined;
    this._endedSubscription = undefined;
    this.lastEmission.clear(); // clear grazing suppression state
  }
}
```

### `collisionEndedObservable` Tracking (Phase 1 — No-Op)

In Phase 1, subscribe to `onCollisionEndedObservable` per body but take no action on callback. The subscription exists to ensure the observable reference is held and the body is tracked for contact-separation events. The Alpha Damage system will consume this data.

```typescript
private readonly _endedHandler = (event: IBasePhysicsCollisionEvent) => {
  // Phase 1: registered but no-op
  // Alpha: will use contact separation data for persistent damage tracking
};
```

### Event Contract Verification

The `collision.impact` event must flow through end-to-end with the correct `CollisionImpactEvent` shape. Consumers receive the event and filter by their own criteria:

| Consumer  | Filter                                             |
| --------- | -------------------------------------------------- |
| Camera    | `payload.carId === playerCarId` only               |
| Audio     | `payload.carId === playerCarId` OR proximity check |
| AI Driver | `payload.carId === this.carId` (own contacts)      |

This story verifies the emission contract — the right event, with the right payload, on the right channel. Consumer-side filtering logic is tested by those systems' own stories.

### Body→CarId Map Lifecycle Hooks

`registerCar()` is driven by the Entity/Car Lifecycle system. The Collision system exports `registerCar()` for the lifecycle system to call when `entity.spawned` fires. Similarly, disposal hooks into `entity.despawned` (or `dispose()` is called during race cleanup).

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Consumer-side filtering (Camera player-only check, Audio proximity check, AI Driver own-contact check) — owned by those systems
- Minimum impulse threshold and grazing suppression — Story 001, Story 003
- Barrier detection logic — Story 002
- Config namespace registration — handled by ConfigManager

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1**: Events routed to correct consumers
  - Given: Camera system (mock), Audio system (mock), AI Driver (mock) subscribed to Event Bus, and playerCarId = "car-1", and C1.id = "car-1" (player), C2.id = "car-2" (AI), C3.id = "car-3" (AI), barrier B1
  - When: C1 collides with B1 (player↔barrier)
  - Then: Camera receives collision.impact (carId === playerCarId), Audio receives collision.impact (player own collision), AI Driver for C1 receives collision.impact (own contact), and AI Driver for C2 does NOT receive collision.impact
  - When: C2 collides with C3 (AI↔AI, both non-player)
  - Then: Camera does NOT receive collision.impact (non-player), Audio receives collision.impact IF within proximityThreshold (30m), AI Driver C2 receives collision.impact (own contact), AI Driver C3 receives collision.impact (own contact)
  - Edge cases: C2 collides with B1 (AI↔barrier, non-player) — Camera ignores, Audio receives IF within 30m of player car, AI Driver C2 receives own contact

- **AC-2**: Event Bus collision.impact payload matches spec
  - Given: Event Bus subscribed with a listener for 'collision.impact'
  - When: Havok reports a C1↔B1 contact at impulse 20, relativeVel 120, pos {50, 0, -200}
  - Then: The Event Bus delivers a 'collision.impact' event, and the payload has shape: { carId: string, otherId: string, impulse: number, relativeVelocity: number, position: { x: number, y: number, z: number } }, and payload values match the source data

- **AC-3**: collisionEndedObservable tracked per body (no-op in Phase 1)
  - Given: CollisionManager initialized
  - When: C1 collides with B1 and then separates
  - Then: collisionEndedObservable for C1.physicsBody is tracked (non-null), collisionEndedObservable for B1.physicsBody is tracked (non-null), no callback was invoked on collisionEndedObservable for either body, and no 'collision.ended' or similar event was emitted on Event Bus
  - Edge cases: Defensive — a body registered but never collided should not error on the observable reference

- **AC-4**: Full round-trip — Havok → CollisionManager → Event Bus → Handler
  - Given: Real Havok Physics engine, real CollisionManager, real Event Bus, and handler H subscribed to Event Bus for 'collision.impact', and C1, C2 registered with all systems
  - When: Havok simulates C1↔C2 contact at impulse 25.0, relativeVel 95.0, pos {10, 0, 30}
  - Then: H receives exactly one callback with correct payload values (within floating-point tolerance)
  - Edge cases: Zero-impulse contact — event is still emitted (threshold filtering is CollisionManager's config check); handler throws — CollisionManager does not crash, next events still delivered

- **AC-5**: Reentrant Race Again — off()+on() clean
  - Given: Full pipeline active with handler H subscribed
  - When: First race — emit C1↔B1 collision, H receives 1 event; then lifecycle tear-down (unsubscribe all handlers, clear collision state); then lifecycle set-up (resubscribe H); second race — emit C2↔C3 collision, H receives 1 event
  - Then: Total events received by H = 2 (not 0, not 3+), and no stale events from first race leak into second race
  - Edge cases: Partial lifecycle — setActive(false), register new car C3, setActive(true); C3↔C1 collision produces exactly one event, and old C1↔C2 collision state does not produce orphan events

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/collision/gsm-lifecycle_test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (Core Collision Manager), Story 002 (Barrier Detection & Event Classification), Story 003 (Impulse Threshold & Grazing Suppression)
- Unlocks: None (final Collision story)
