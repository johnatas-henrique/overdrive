# Story 004: Surface Handling — Off-Track & Kerbs

> **Epic**: Physics / Handling
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 6h

## Context

**GDD**: `design/gdd/physics-handling.md`
**Requirement**: `TR-PHYSICS-004` (partial — kerbHit, offTrack telemetry output)

- **TR-PHYSICS-004** (partial): Output kerbHit, offTrack flags per tick indicating surface contact state.

**ADR Governing Implementation**: ADR-0008: Vehicle Physics — Arcade Dynamic
**ADR Decision Summary**: Arcade grip model applies surface-dependent grip modifiers. Off-track (grass/gravel) multiplies gripMax by `offTrackGripFactor` (0.3) and friction by `offTrackFriction` (6×). Kerbs apply `kerbGripLoss` (0.20) for exactly 2 ticks. Both surface types emit telemetry flags for Camera (shake) and Audio.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: Surface type determined by querying track spline segment data (SplineSegment.gripSurface). No engine-specific physics — all grip/friction modifiers are applied as scalar multipliers in Phase 1.

**Control Manifest Rules (this layer)**:

- C59: Track spline carries per-segment gripSurface metadata (tarmac/kerb/grass).

---

## Acceptance Criteria

_From QL-STORY-READY gate — all ADEQUATE:_

- [ ] **AC-1**: Off-track surface (grass/gravel) applies gripMax × 0.3 grip reduction — car turning ability reduced proportionally
- [ ] **AC-2**: Off-track applies 6× friction multiplier — speed decreases faster on grass than tarmac for the same input
- [ ] **AC-3**: Off-track maintains minimum speed of `topSpeed × offTrackMinSpeed` (default 0.3) — car never slowed below this minimum on grass
- [ ] **AC-4**: Kerb contact applies `gripMax × kerbGripLoss` (0.20) grip reduction for exactly 2 ticks, then recovers fully on tick 3 (timer-based, not hold-based — car recovers even if still on kerb)
- [ ] **AC-5**: Kerb contact sets `kerbHit = true` in telemetry for the duration of the 2-tick grip loss window; cleared on tick 3
- [ ] **AC-6**: Off-track sets `offTrack = true` in telemetry while car surface is grass/gravel; cleared when car returns to tarmac

---

## Implementation Notes

_Derived from ADR-0008 and GDD Edge Cases:_

### Surface Data from Track Spline

```typescript
// Surface type from SplineSegment metadata — queried by car's splinePosition
enum SurfaceType {
  Tarmac = "tarmac",
  Kerb = "kerb",
  Grass = "grass",
  Gravel = "gravel",
}

interface SurfaceModifiers {
  gripFactor: number; // multiplied by gripMax
  frictionMultiplier: number; // multiplied by dragCoeff for drag force
  minSpeedFraction: number; // fraction of topSpeed (minimum on this surface)
}
```

### Surface Modifier Table

```typescript
const SURFACE_MODIFIERS: Record<SurfaceType, SurfaceModifiers> = {
  [SurfaceType.Tarmac]: {
    gripFactor: 1.0,
    frictionMultiplier: 1.0,
    minSpeedFraction: 0,
  },
  [SurfaceType.Kerb]: {
    gripFactor: 1 - KERB_GRIP_LOSS,
    frictionMultiplier: 1.0,
    minSpeedFraction: 0,
  },
  [SurfaceType.Grass]: {
    gripFactor: OFFTRACK_GRIP_FACTOR,
    frictionMultiplier: OFFTRACK_FRICTION,
    minSpeedFraction: OFFTRACK_MIN_SPEED,
  },
  [SurfaceType.Gravel]: {
    gripFactor: OFFTRACK_GRIP_FACTOR,
    frictionMultiplier: OFFTRACK_FRICTION,
    minSpeedFraction: OFFTRACK_MIN_SPEED,
  },
};
```

### Per-Car Surface State

```typescript
interface CarSurfaceState {
  currentSurface: SurfaceType; // updated from track spline each tick
  gripOverride: number; // 1.0 = full grip, multiplied by gripMax later
  kerbTimer: number; // ticks remaining of kerb grip loss (0 = no active kerb effect)
}
```

### Phase 1 Surface Integration

```typescript
// Called during Phase 1 arcade model update
function updateSurfaceState(
  carState: CarPhysicsState,
  surfaceState: CarSurfaceState,
  splinePosition: number,
  trackSystem: TrackSystem,
  config: SurfaceConfig
): void {
  const segment = trackSystem.getSegmentAtPosition(splinePosition);
  surfaceState.currentSurface = segment.gripSurface;

  // Kerb timer management
  if (
    surfaceState.currentSurface === SurfaceType.Kerb &&
    surfaceState.kerbTimer === 0
  ) {
    surfaceState.kerbTimer = 2; // start 2-tick timer on kerb entry
  } else if (surfaceState.kerbTimer > 0) {
    surfaceState.kerbTimer--;
  }

  // Compute effective grip override
  const modifiers = SURFACE_MODIFIERS[surfaceState.currentSurface];
  surfaceState.gripOverride = modifiers.gripFactor;

  // Kerb grip loss overrides surface grip (applied multiplicatively)
  if (surfaceState.kerbTimer > 0) {
    surfaceState.gripOverride *= 1 - config.kerbGripLoss;
  }

  // Friction multiplier for drag (off-track only)
  carState.frictionMultiplier = modifiers.frictionMultiplier;

  // Minimum speed clamp (off-track only)
  carState.minSurfaceSpeed = carState.topSpeed * modifiers.minSpeedFraction;

  // Telemetry flags
  carState.offTrack =
    surfaceState.currentSurface === SurfaceType.Grass ||
    surfaceState.currentSurface === SurfaceType.Gravel;
  carState.kerbHit = surfaceState.kerbTimer > 0;
}
```

### Off-Track Minimum Speed Enforcement

```typescript
// Applied in Phase 1 target speed calculation — after computing target speed,
// clamp to minimum surface speed if applicable:
function enforceMinSurfaceSpeed(
  targetSpeed: number,
  minSurfaceSpeed: number
): number {
  // If minSurfaceSpeed > 0 (off-track), there is a floor
  // The car is never slowed below this minimum on grass/gravel
  return minSurfaceSpeed > 0
    ? Math.max(targetSpeed, minSurfaceSpeed)
    : targetSpeed;
}
```

---

## Out of Scope

- **Story 001**: Pipeline integration, Havok init, ground tracking, Phase 2/3
- **Story 002**: Core gripMax formula, steering, lift-off oversteer (surface modifiers multiply gripMax from Story 002)
- **Story 003**: Engine power, gears, drag formula (friction multiplier is applied to the drag formula)
- **Story 005**: setLocked/setPit, fuelMult/tireCondition, edge-triggered events

---

## QA Test Cases

_Written by qa-lead at story creation:_

- **AC-1** (off-track grip):
  - Given: `offTrackGripFactor = 0.3`, gripMax = 9.0, car surface = GRASS
  - When: effectiveGrip = gripMax × offTrackGripFactor = 9.0 × 0.3 = 2.7
  - Then: effectiveGrip on grass = 2.7 vs on tarmac = 9.0 (70% reduction)
  - Edge: `offTrackGripFactor = 0.05` (config min) → near-zero grip; gripMax already low (tireCondition near 0) → off-track still applies multiplicatively

- **AC-2** (off-track friction):
  - Given: `offTrackFriction = 6`, `dragCoeff = 0.012`, speed = 200 km/h (55.56 m/s)
  - When: drag_offtrack = 6 × 0.012 × (55.56)² × sign(-55.56) = -222.2
  - When: drag_tarmac = 0.012 × (55.56)² × sign(-55.56) = -37.0
  - Then: |Δv_offtrack| ≈ 6× |Δv_tarmac| for same speed
  - Edge: `offTrackFriction = 3` (config min) → still 3×; speed = 0 → zero drag regardless

- **AC-3** (off-track min speed):
  - Given: `offTrackMinSpeed = 0.3`, topSpeed = 300 km/h → minGrassSpeed = 90 km/h
  - When: Car on grass, speed = 120 km/h, zero throttle → after drag, speed ≥ 90 km/h
  - When: speed = 90 km/h → no further deceleration on grass
  - Edge: `offTrackMinSpeed = 0.1` → min = 30 km/h; topSpeed varies per car → per-car minGrassSpeed correct

- **AC-4** (kerb 2-tick timer):
  - Given: `kerbGripLoss = 0.20`, gripMax = 9.0, car on kerb at tick N
  - When: tick N (initial kerb contact) → effectiveGrip = 9.0 × (1 - 0.20) = 7.2
  - When: tick N+1 (still on kerb or returned to track) → effectiveGrip = 7.2
  - When: tick N+2 → effectiveGrip = 9.0 (recovered regardless of current surface)
  - Edge: Continuous kerb contact for 5 ticks → grip recovers on tick N+2 (timer-based, not hold-based); car touches kerb for 1 tick → still 2-tick timer runs to completion

- **AC-5** (kerbHit telemetry):
  - Given: SurfaceHandler producing CarTelemetry output
  - When: Car enters kerb on tick N → telemetry.kerbHit === true on tick N and N+1
  - When: tick N+2 → telemetry.kerbHit === false
  - Edge: kerbHit is false before kerb contact and after recovery; multiple kerb strikes — each starts independent 2-tick timer

- **AC-6** (offTrack telemetry):
  - Given: SurfaceHandler producing CarTelemetry output
  - When: car surface = GRASS → telemetry.offTrack === true
  - When: car surface = TARMAC → telemetry.offTrack === false
  - Edge: offTrack is false on kerb (kerb !== off-track); flag clears on same tick as surface transition

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/physics-handling/surface-handling_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (CarPhysicsState, trackSystem access), Story 002 (gripMax formula — this story applies surface modifiers to it)
- Unlocks: Story 005 (surface state feeds into grip chain consumed by lock/pit logic)
