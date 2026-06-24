# Story 002: Spline Query Interface

> **Epic**: Track + Environment
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 8h

## Context

**GDD**: `design/gdd/track-environment.md`
**Requirements**: `TR-TE-006`, `TR-TE-007`

- **TR-TE-006**: `getTrackHalfWidth(splinePosition)` returns track width at a given spline position for off-track detection and AI line calculation.
- **TR-TE-007**: Per-car last-known segment index cached to O(1) lookup — full spline scan only at race start.

**ADR Governing Implementation**: ADR-0025: Track + Environment — Spline is authoritative reference
**ADR Decision Summary**: The spline serves as the single source of truth for off-track detection (Physics reads `width` per segment via forward scan from last-known index), AI racing line (reads spline points as waypoints with curvature calculation), and elevation queries. Custom `SplineSegment[]` over Babylon curve types (cannot carry per-segment metadata).

**Engine**: Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12 | **Risk**: LOW
**Engine Notes**: Pure math — no Babylon.js APIs consumed. Types only: `Vec3` local interface (not BABYLON.Vector3).

**Control Manifest Rules (this layer)**:

- C59: Track: SplineSegment[] custom array — carries per-segment `width` + `next` index.
- C-F1: Never use `Curve3`, `CatmullRomCurve3`, or `Path3D` for spline data.

---

## Acceptance Criteria

_Revised per QL-STORY-READY gate on 2026-06-23:_

- [ ] **AC-1**: `getTrackHalfWidth(splinePosition: number): number` — returns `segment.width / 2` for the segment nearest to the given spline position (normalized 0..1). Interpolates between adjacent segments for smooth results.
- [ ] **AC-2**: `getElevation(x: number, z: number): number` — returns Y value from spline at the nearest point to (x, z), with interpolation between adjacent segment points. Throws `ConfigError` on empty spline.
- [ ] **AC-3**: `getTangent(splinePosition: number): Vec3` — returns forward direction (normalized) at the given spline position. Last segment (next = -1) returns direction of last→previous (reversed).
- [ ] **AC-4**: Forward scan algorithm — given a last-known segment index, follows `seg.next` pointers until finding a segment where car position (x, z) is within `segment.width / 2`. Average O(1) per tick.
- [ ] **AC-5**: `Map<carId, number>` caches last-known segment index per car. Updated after each successful forward scan.
- [ ] **AC-6**: Full spline scan (from segment 0) on first tick for each car (no cached index). Subsequent ticks start from last-known index.
- [ ] **AC-7**: All query functions throw `ConfigError('Spline is empty')` if the spline has no segments.
- [ ] **AC-8**: All off-track / no-match cases throw `ConfigError` — consistent with system-wide approach (never return undefined/null).
- [ ] **AC-9**: `splinePosition` parameter is a normalized float in range [0, 1). Externally clamped — caller guarantees valid range; behavior outside [0, 1) is undefined.

---

## Implementation Notes

_Derived from ADR-0025 Implementation Guidelines:_

### Spline Query Interface

```typescript
interface ISplineQueries {
  getTrackHalfWidth(splinePosition: number): number;
  getElevation(x: number, z: number): number;
  getTangent(splinePosition: number): Vec3;
  getSplineLength(): number;
  getSegmentCount(): number;
}
```

### Forward Scan Algorithm

```typescript
// Per-car last known segment index
private lastSegmentIndex = new Map<string, number>();

forwardScan(carId: string, carX: number, carZ: number): number | null {
  const startIdx = this.lastSegmentIndex.get(carId) ?? 0;
  let seg = startIdx;

  while (seg !== -1) {
    const s = this.spline[seg];
    const dx = carX - s.point.x;
    const dz = carZ - s.point.z;
    const distSq = dx * dx + dz * dz;

    if (distSq <= (s.width / 2) * (s.width / 2)) {
      this.lastSegmentIndex.set(carId, seg);
      return seg; // found — car is on-track
    }
    seg = s.next;
  }

  return null; // off-track
}
```

### Elevation Interpolation

```typescript
getElevation(x: number, z: number): number {
  if (this.spline.length === 0) throw new ConfigError('Spline is empty');

  // Find nearest segment point by 2D distance
  let nearestIdx = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < this.spline.length; i++) {
    const dx = x - this.spline[i].point.x;
    const dz = z - this.spline[i].point.z;
    const d = dx * dx + dz * dz;
    if (d < nearestDist) {
      nearestDist = d;
      nearestIdx = i;
    }
  }
  return this.spline[nearestIdx].point.y;
}
```

For smoother results, interpolate between nearest and next segment. MVP may start with nearest-point clamping.

### Tangent Derivation

```typescript
getTangent(splinePosition: number): Vec3 {
  if (this.spline.length === 0) throw new ConfigError('Spline is empty');

  const idx = Math.floor(splinePosition * this.spline.length);
  const seg = this.spline[idx];

  if (seg.next === -1) {
    // Last segment — reverse direction from previous → current
    const prev = this.spline[idx - 1];
    return normalize({ x: seg.point.x - prev.point.x, y: seg.point.y - prev.point.y, z: seg.point.z - prev.point.z });
  }

  const next = this.spline[seg.next];
  return normalize({ x: next.point.x - seg.point.x, y: next.point.y - seg.point.y, z: next.point.z - seg.point.z });
}
```

### Zero Babylon Imports

This module operates on pure data (SplineSegment[], Vec3). No imports from `@babylonjs/core`. Vec3 is the local interface (not BABYLON.Vector3).

---

## Out of Scope

- **Story 001**: SplineSegment type definition — consumed here
- **Story 003**: Spline validation on load — ensures data integrity before queries run
- **Story 005**: Pit zone detection — separate spatial query system

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Test file**: `tests/unit/track-environment/spline-queries_test.ts`

- **AC-1** (getTrackHalfWidth):
  - Given: Spline with 3 segments where segment[0].point = (0,0,0), width = 12, segment[1].point = (10,0,0), width = 20, segment[2].point = (20,0,0), width = 8
  - When: `getTrackHalfWidth(0)` is called
  - Then: Returns 6.0 (segment[0].width / 2)
  - When: `getTrackHalfWidth(0.5)` is called
  - Then: Returns interpolated half-width between segment[1] width/2 and segment[2] width/2 (or nearest-segment, per implementation choice)
  - Edge: Empty spline throws ConfigError

- **AC-2** (getElevation):
  - Given: Spline where segment[0].point = (50, 5, 100)
  - When: `getElevation(51, 101)` is called (5m from nearest point)
  - Then: Returns 5.0 (Y value of nearest segment point)
  - Edge: Empty spline throws ConfigError

- **AC-3** (getTangent):
  - Given: Spline where segment[0] = (0,0,0), segment[1] = (0,0,10), linked via next
  - When: `getTangent(0)` is called
  - Then: Returns normalized Vec3(0, 0, 1) (direction from seg[0] → seg[1])
  - Edge: Last segment (next = -1) returns direction of last → previous

- **AC-4/5** (forward scan with cache):
  - Given: Spline with 10 segments linked by next, car "car1" has lastKnownIndex = 3, car1 position is within width/2 of segment[5]
  - When: Forward scan runs for "car1"
  - Then: Returns segment index 5 after scanning 2 iterations (3→4→5); lastKnownIndex updated to 5
  - Edge: Off-track — no segment within width/2 for any segment from startIdx onwards; returns null, lastKnownIndex unchanged

- **AC-6** (first tick full scan):
  - Given: Spline with 10 segments, car "car1" has NO cached index
  - When: Forward scan runs for "car1"
  - Then: Scans from segment 0 until match found; lastKnownIndex set to match
  - Edge: If no match, returns null (off-track); lastKnownIndex NOT set

- **AC-7** (empty spline):
  - Given: An empty SplineSegment[]
  - When: Any query function (getTrackHalfWidth, getElevation, getTangent) is called
  - Then: Throws ConfigError('Spline is empty')
  - Edge: Each query function independently validates empty spline

- **AC-8** (off-track throws):
  - Given: Car position far from all spline segments (> width/2 for all)
  - When: `getTrackHalfWidth(0)` or `getElevation(x, z)` or `getTangent(0)` is called
  - Then: Throws ConfigError (off-track condition requires external handling by Physics)

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/track-environment/spline-queries_test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (TrackConfig types, SplineSegment interface)
- Unlocks: Story 003 (Physics reads spline for elevation/tangent during load verification)
