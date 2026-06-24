# Story 005: Pit Lane Zones and Queries

> **Epic**: Track + Environment
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/track-environment.md`
**Requirements**: `TR-TE-004`, `TR-TE-008`

- **TR-TE-004**: Pit lane geometry with entry point, exit point, pit boxes (8 total, one per team) and pit lane speed limit zone.
- **TR-TE-008** (revised 2026-06-23): `isInPitEntryZone(x, z)` and `isInPitExitZone(x, z)` based on spline-position-independent XZ bounding box — Pit Stop queries these each tick.

**ADR Governing Implementation**: ADR-0025: Track + Environment — Decisions 4 (inline XZ point-in-box) and 5 (garage slots as logical positions)
**ADR Decision Summary**: Pit entry/exit zones use geometric point-in-box checks (6 float comparisons per car per zone, ~0.00001ms per frame), NOT Havok trigger volumes. No Havok trigger volume support in Havok V2 Scene. Garage slots are logical `Vec3[]` positions — no collider bays (individual bay walls would create edge cases with arcade physics model).

**Engine**: Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12 | **Risk**: LOW
**Engine Notes**: Pure math — inline XZ point-in-box, zero Babylon.js imports. No Havok trigger volumes used.

**Control Manifest Rules (this layer)**:

- C61: Track: pit zone detection via inline XZ point-in-box — NOT Havok trigger volumes (no trigger volume support in Havok V2 Scene).
- C-F2: Never use Havok trigger volumes for pit zone detection — use inline XZ point-in-box.

---

## Acceptance Criteria

_Revised per QL-STORY-READY gate on 2026-06-23:_

- [ ] **AC-1**: `isInPitEntryZone(x: number, z: number): boolean` — returns true if (x, z) is within the entry zone's XZ bounding rectangle. Six float comparisons, zero allocations.
- [ ] **AC-2**: `isInPitExitZone(x: number, z: number): boolean` — same pattern for exit zone.
- [ ] **AC-3**: `isInPitZone(x: number, z: number): 'entry' | 'exit' | null` — combined query returning which zone (if any) the coordinates fall in.
- [ ] **AC-4**: Pit garage slots exposed via `getPitGarageSlot(index: number): Vec3` — config declares 16, Phase 1 exposes indices 0–7. Index ≥ 8 throws `ConfigError('Out of range')`.
- [ ] **AC-5**: Pit lane spline waypoints exposed via `getPitLaneSpline(): Vec3[]` — returns raw array from config.
- [ ] **AC-6**: Per-car pit zone state machine with explicit transitions:

| Current State | Condition                                                   | Next State |
| ------------- | ----------------------------------------------------------- | ---------- |
| `onTrack`     | `isInPitEntryZone(x, z) === true`                           | `entry`    |
| `entry`       | `isInPitEntryZone(x, z) === false` (car reversed out)       | `onTrack`  |
| `entry`       | Travel ≥ pitEntryZone → pitLaneSpline[0] distance threshold | `pitLane`  |
| `pitLane`     | `isInPitExitZone(x, z) === true`                            | `exit`     |
| `exit`        | `isInPitExitZone(x, z) === false`                           | `onTrack`  |

Exposed via `getCarPitState(carId: string): 'onTrack' | 'entry' | 'pitLane' | 'exit'`. State tracking per-car via `Map<carId, PitState>`.

- [ ] **AC-7**: Pit zone overlap with track surface triggers a config warning on load (non-blocking, logged via console.warn). Does NOT prevent load.
- [ ] **AC-8**: All zone checks are allocation-free — no `Vector3` or `BoundingBox` objects created during query execution.

---

## Implementation Notes

_Derived from ADR-0025 Implementation Guidelines:_

### Inline XZ Point-in-Box

```typescript
interface PitZone {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

function isInZone(x: number, z: number, zone: PitZone): boolean {
  return x >= zone.xMin && x <= zone.xMax && z >= zone.zMin && z <= zone.zMax;
}
```

Six float comparisons. Zero allocation. No Babylon types needed.

**Avoid** `BABYLON.BoundingBox` for this hot-path use — it allocates `Vector3` objects per instance.

### Per-Car Pit State Machine

```typescript
type PitState = "onTrack" | "entry" | "pitLane" | "exit";

interface CarPitTracker {
  state: PitState;
  entryTravel: number; // cumulative distance traveled since entering pit zone
}

class PitZoneManager {
  private carStates = new Map<string, CarPitTracker>();

  getCarPitState(carId: string): PitState {
    return this.carStates.get(carId)?.state ?? "onTrack";
  }

  update(
    carId: string,
    x: number,
    z: number,
    dt: number,
    speedKmh: number
  ): void {
    const entryZone = isInZone(x, z, this.config.pitEntryZone);
    const exitZone = isInZone(x, z, this.config.pitExitZone);
    const tracker = this.carStates.get(carId);

    if (!tracker) {
      // Initial state
      if (entryZone)
        this.carStates.set(carId, { state: "entry", entryTravel: 0 });
      else if (exitZone)
        this.carStates.set(carId, { state: "exit", entryTravel: 0 });
      else this.carStates.set(carId, { state: "onTrack", entryTravel: 0 });
      return;
    }

    switch (tracker.state) {
      case "onTrack":
        if (entryZone) tracker.state = "entry";
        break;
      case "entry":
        if (!entryZone) {
          tracker.state = "onTrack";
          break;
        }
        tracker.entryTravel += speedKmh * (dt / 3600); // km travelled this tick
        if (tracker.entryTravel >= ENTRY_THRESHOLD_KM)
          tracker.state = "pitLane";
        break;
      case "pitLane":
        if (exitZone) tracker.state = "exit";
        break;
      case "exit":
        if (!exitZone) tracker.state = "onTrack";
        break;
    }
  }
}
```

### Pit Zone Overlap Warning

```typescript
validatePitZoneOverlap(config: TrackConfig): void {
  // Check if pit entry zone overlaps with track spline within margin
  for (const seg of config.spline) {
    const inEntry = isInZone(seg.point.x, seg.point.z, config.pitEntryZone);
    const inExit = isInZone(seg.point.x, seg.point.z, config.pitExitZone);
    if (inEntry || inExit) {
      console.warn(`Track ${config.id}: Pit zone overlaps racing surface at segment`);
    }
  }
}
```

### Garage Slots

```typescript
getPitGarageSlot(index: number): Vec3 {
  if (index < 0 || index >= 8) {
    throw new ConfigError(`Out of range: pit garage slot ${index}. Phase 1 supports 0-7.`);
  }
  // Config declares 16 slots — Phase 1 uses first 8
  return this.config.pitGarageSlots[index];
}
```

---

## Out of Scope

- **Story 003**: Track config loading — PitZone data consumed from loaded config
- **Pit Stop epic**: Spline follower for garage positioning, pit service timers — Track only provides data
- **Story 001**: PitZone type definition — consumed here

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Test file**: `tests/unit/track-environment/pit-zones_test.ts`

- **AC-1** (isInPitEntryZone):
  - Given: PitEntryZone with xMin=100, xMax=200, zMin=50, zMax=150
  - When: `isInPitEntryZone(150, 100)` is called
  - Then: Returns true (inside zone)
  - When: `isInPitEntryZone(50, 100)` is called
  - Then: Returns false (outside x range)
  - When: `isInPitEntryZone(150, 200)` is called
  - Then: Returns false (outside z range)
  - Edge: Exactly on boundary (x=100, z=50) returns true (inclusive comparison)

- **AC-2** (isInPitExitZone):
  - Given: PitExitZone with xMin=500, xMax=600, zMin=200, zMax=300
  - When: `isInPitExitZone(550, 250)` is called
  - Then: Returns true
  - When: `isInPitExitZone(0, 0)` is called
  - Then: Returns false

- **AC-3** (isInPitZone combined):
  - Given: Both zones defined, position (150, 100) in entry zone, (550, 250) in exit zone, (999, 999) in neither
  - When: `isInPitZone(150, 100)` is called
  - Then: Returns `'entry'`
  - When: `isInPitZone(550, 250)` is called
  - Then: Returns `'exit'`
  - When: `isInPitZone(999, 999)` is called
  - Then: Returns null

- **AC-4** (getPitGarageSlot):
  - Given: Config with 16 pitGarageSlots
  - When: `getPitGarageSlot(0)` through `getPitGarageSlot(7)` are called
  - Then: Each returns a valid Vec3
  - Edge: `getPitGarageSlot(8)` throws ConfigError('Out of range')

- **AC-5** (getPitLaneSpline):
  - Given: Config with pitLaneSpline of 20 waypoints
  - When: `getPitLaneSpline()` is called
  - Then: Returns array of length 20; each element is a valid Vec3

- **AC-6** (pit state machine):
  - Given: Car "car1" at position (0, 0) — far from pit zones, PitZoneManager initialized
  - When: `getCarPitState("car1")` is called
  - Then: Returns `'onTrack'`
  - When: Car moves to (150, 100) (inside entry zone) and `update()` is called
  - Then: `getCarPitState("car1")` returns `'entry'`
  - When: Car travels enough distance along pit lane to trigger entry→pitLane transition
  - Then: `getCarPitState("car1")` returns `'pitLane'`
  - When: Car moves to (550, 250) (inside exit zone) and `update()` is called
  - Then: `getCarPitState("car1")` returns `'exit'`
  - When: Car moves to (0, 0) (outside exit zone) and `update()` is called
  - Then: `getCarPitState("car1")` returns `'onTrack'`
  - Edge: Car enters entry zone but reverses out — reverts to `'onTrack'`
  - Edge: Car enters exit zone directly (teleported) — state goes directly to `'exit'`

- **AC-7** (zone overlap warning):
  - Given: TrackConfig where pit entry zone x range overlaps with a spline segment point
  - When: `validatePitZoneOverlap(config)` is called during load
  - Then: `console.warn` is called with message containing "overlap"
  - Edge: No overlap — no warning emitted

- **AC-8** (allocation-free):
  - Given: PitZoneManager initialized
  - When: `isInPitEntryZone(150, 100)` is called 1000 times in a tight loop
  - Then: Zero `Vector3` or `BoundingBox` constructor calls observed (verified via alloc instrumentation)
  - When: `update()` runs for 3 cars across 100 ticks
  - Then: No allocations per tick beyond the Map lookups (verified)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/track-environment/pit-zones_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 003 (load lifecycle — TrackConfig with pit zone data must be loaded)
- Unlocks: Pit Stop epic (consumes pit zone queries and garage slot data)
