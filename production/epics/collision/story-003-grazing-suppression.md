# Story 003: Impulse Threshold & Grazing Suppression

> **Epic**: Collision
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/collision.md`
**Requirements**:

- `TR-COLLISION-004`: Minimum impulse threshold (configurable) — collisions below threshold do not emit impact events; prevents trigger-happy on light contact

**ADR Governing Implementation**: ADR-0010: Collision Model
**ADR Decision Summary**: `onCollisionObservable` filtered to `COLLISION_STARTED` only. Grazing suppression via tick-throttle map keyed by `` `${carId}:barrier` ``. Suppression is per (carId, barrier) pair, measured in ticks via `config.grazeSuppressFrames`. Minimum impulse threshold via `config.collision.shakeMinImpulse`.

**Engine**: Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12 | **Risk**: LOW
**Engine Notes**: Pipeline `getCurrentTick()` available from Fixed Timestep Pipeline's tick counter. Config keys defined in GDD tuning knobs section.

**Control Manifest Rules (this layer)**:

- Required (C31): Collision: grazing suppression — sustained barrier scrape suppressed within `grazeSuppressFrames` ticks.
- Required (C30): Collision: event-only — no `update()`, no pipeline slot.
- Guardrail (C-G8): Collision: ~0.001ms per contact event (map lookup + Event Bus emit).

---

## Acceptance Criteria

_From GDD `design/gdd/collision.md`, scoped to this story:_

- [ ] Barrier contact at an angle below `config.collision.grazeAngleDeg` (default 5.0°) suppresses repeated `collision.impact` within `config.collision.grazeSuppress` (default 3) ticks
- [ ] Multiple simultaneous contacts each produce individual events (not grouped or merged)
- [ ] After `config.collision.grazeSuppress` ticks elapse, a new barrier contact with impulse ≥ `config.collision.shakeMinImpulse` (default 1.0 N·s) re-emits `collision.impact`
- [ ] Grazing suppression only applies to barrier contacts — car↔car contacts are not suppressed by tick-throttle

---

## Implementation Notes

_Derived from ADR-0010 Implementation Guidelines:_

### Grazing Suppression Map

```typescript
// Track last emission per (carId, barrierId) pair — cleared on dispose()
const lastEmission = new Map<string, number>(); // key: `${carId}:barrier` → tick
```

### Suppression Logic in the Collision Handler

```typescript
onCollisionObservable.add((event) => {
  if (event.type !== PhysicsEventType.COLLISION_STARTED) return;
  if (!event.point || !event.normal) return; // guard missing contact data

  const carId = bodyToCar.get(event.collider);
  if (!carId) return;

  const other = barrierBodies.has(event.collidedAgainst)
    ? "barrier"
    : (bodyToCar.get(event.collidedAgainst) ?? "unknown");

  if (other === "barrier") {
    const key = `${carId}:barrier`;
    const lastTick = lastEmission.get(key) ?? 0;
    const currentTick = pipeline.getCurrentTick();
    if (currentTick - lastTick < config.grazeSuppressFrames) {
      return; // suppress — within the grazeSuppressFrames window
    }
    lastEmission.set(key, currentTick);
  }

  // Check minimum impulse threshold
  if (event.impulse < config.shakeMinImpulse) return;

  eventBus.emit("collision.impact", {
    carId,
    otherId: other,
    impulse: event.impulse,
    relativeVelocity: computeRelativeVelocity(event),
    position: { x: event.point.x, y: event.point.y, z: event.point.z },
  });
});
```

### Config Keys (Tuning Knobs)

| Config Key                  | Default | Description                                                 |
| --------------------------- | ------- | ----------------------------------------------------------- |
| `collision.shakeMinImpulse` | 1.0     | Minimum impulse (N·s) to emit a collision.impact event      |
| `collision.grazeAngleDeg`   | 5.0     | Angle (°) below which barrier contact is "grazing"          |
| `collision.grazeSuppress`   | 3       | Frames to wait before re-emitting for same car+barrier pair |

### Multiple Simultaneous Contacts

Each callback invocation from Havok represents one contact pair. The handler processes each independently — no grouping, no deduplication across different pairs. Consumers (Camera, Audio) throttle independently if needed.

### Map Cleanup

The `lastEmission` map is cleared when `setActive(false)` is called (PostRace). This prevents stale suppression data from carrying across Race Again sessions.

---

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- GSM lifecycle (register/unregister triggers) — Story 004
- Consumer-side throttling (Camera, Audio) — owned by those systems
- Collision type string ('car-car', 'barrier', 'barrier-hard') — Story 002
- `event.point` and `event.normal` null guards for defensive safety — Story 001 (core subscription)

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

- **AC-1** (REVISED): Grazing suppression on low-angle barrier contacts
  - Given: config.collision.grazeAngleDeg = 5.0, config.collision.grazeSuppress = 3, and C1 registered, barrier B1 registered
  - When: Havok reports a grazing barrier contact (angle < 5°) with impulse 15.0
  - Then: One collision.impact event is emitted
  - When: Havok reports the same C1↔B1 grazing contact again in the next 2 ticks
  - Then: No collision.impact event is emitted (suppressed within grazeSuppressFrames)
  - Edge cases: Non-grazing angle (90° perpendicular) barrier contact — fires every tick, not suppressed; grazing angle with different car+barrier pair — separate suppression bucket

- **AC-2**: Multiple simultaneous contacts are individually emitted
  - Given: C1, C2, C3 registered, and barrier B1
  - When: Havok reports simultaneous contacts in one tick — C1↔C2 at impulse 10, C1↔C3 at impulse 8, C2↔B1 at impulse 5
  - Then: Three collision.impact events are emitted (not grouped/merged), and each event has the correct carId/otherId/impulse
  - Edge cases: Same car contacting two different barriers in the same tick → two events, each with correct position and impulse

- **AC-3** (REVISED): Re-emission after suppression expires
  - Given: config.collision.grazeSuppress = 3, config.collision.shakeMinImpulse = 1.0, and C1, barrier B1 with grazing contact established
  - When: Tick 0 — grazing contact at impulse 10 → event emitted; Tick 1 — same grazing contact → suppressed; Tick 2 — same grazing contact → suppressed; Tick 3 — same grazing contact → event re-emitted (suppression expired)
  - Then: Events emitted at tick 0 and tick 3 only, not at tick 1 or 2
  - Edge cases: After suppression expires, if contact impulse is 0.5 (< shakeMinImpulse), no event emitted (filtered by impulse threshold, not suppression)

- **AC-4**: Grazing suppression does not apply to car↔car contacts
  - Given: config.collision.grazeSuppress = 3, and C1 and C2 in sustained grazing contact over 5 ticks
  - When: Each tick produces a contact callback
  - Then: Each tick produces a collision.impact event (no tick-throttle suppression on car↔car)
  - Edge cases: Mixed contacts — C1 simultaneously in grazing contact with barrier B1 AND with car C2; barrier contact is suppressed after first event, car↔car contact fires each tick (unaffected by grazeSuppressFrames)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/collision/grazing-suppression.test.ts` — must exist and pass
**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (Core Collision Manager), Story 002 (Barrier Detection & Event Classification)
- Unlocks: Story 004 (GSM Lifecycle & Event Bus Integration)
