# ADR-0025: Track + Environment

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12                                                                                                                                                                    |
| **Domain**                | Core — Track / Environment                                                                                                                                                                                      |
| **Knowledge Risk**        | MEDIUM — Havok static colliders (PhysicsAggregate MESH), Babylon.js SceneLoader, spline queries                                                                                                                 |
| **References Consulted**  | track-environment.md GDD, architecture.md Module Ownership, ADR-0008 (Vehicle Physics), babylonjs-specialist review (Q1–Q6)                                                                                     |
| **Post-Cutoff APIs Used** | `SceneLoader.LoadAssetContainerAsync()` (async-only since 7.34); `PhysicsAggregate` with `PhysicsShapeType.MESH` (stable)                                                                                       |
| **Verification Required** | Static colliders merged per category (3–5 bodies per track); inline XZ point-in-box for pit zones (avoid `BABYLON.BoundingBox` allocation); physics attached after scene instantiation, not on container meshes |

## ADR Dependencies

| Field             | Value                                                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Depends On**    | ADR-0003 (Two-Scene — `LoadAssetContainerAsync` + `instantiateModelsToScene`), ADR-0008 (Vehicle Physics — spline as Y-elevation ref), ADR-0004 (Module Boundaries — Track+Env in Core) |
| **Enables**       | AI Driver (spline waypoints), Pit Stop (entry/exit zones), Race Management (grid positions, lap detection spline), Camera (grid center calculation)                                     |
| **Blocks**        | All racing gameplay — no track, no race                                                                                                                                                 |
| **Ordering Note** | Init slot #1 (Core Group B — after Asset Manager init, before Physics init). Must be ready before `spawnGrid()` to provide grid positions.                                              |

## Context

### Problem Statement

Every race needs a track. The track must provide: a drivable surface with known width and curvature, pit lane with entry/exit zones and garage positions, grid starting positions, barriers for collision, and visual environment (buildings, sky, trees). The track must be loadable on demand, swappable between races, and must not require code changes to add a new circuit.

### Constraints

1. **Static environment** — No moving colliders (no animated barriers, no destructible walls in Phase 1). All environment meshes are STATIC Havok bodies.
2. **Config-driven** — Adding a track means adding `src/config/tracks/{id}.ts` + GLB assets. Zero TypeScript code changes.
3. **Pit zone detection outside Havok** — Pit entry/exit zones use geometric point-in-box checks, not Havok trigger volumes.
4. **Arcade model** — Cars are DYNAMIC bodies with velocity override (ADR-0008). Track colliders must coexist with this.

## Decision

### Decision 1: TrackConfig TypeScript interface

All track data lives in a typed config file per circuit:

```typescript
interface TrackConfig {
  id: string; // "monza", "interlagos", etc.
  name: string; // Display name
  region: string;
  skyPalette: string;
  pitEntryZone: PitZone;
  pitExitZone: PitZone;
  pitLaneSpline: Vec3[];
  pitGarageSlots: Vec3[]; // 16 positions, 8 active in MVP
  gridPositions: Vec3[]; // 26 positions
  spline: SplineSegment[];
  assets: TrackAssets;
}

interface SplineSegment {
  point: Vec3;
  width: number;
  next: number; // index of next segment (-1 for last)
}
```

This is pure data (zero Babylon imports) — lives in Foundation-friendly package `src/config/tracks/`.

### Decision 2: Spline is authoritative reference

The spline serves as the single source of truth for:

- **Off-track detection** — Physics reads `width` per segment via forward scan from last-known index (O(1) average per car per tick)
- **AI racing line** — Reads spline points as waypoints with curvature calculation
- **Grid position** — Grid positions computed from spline + offset, stored as absolute `Vec3[]`
- **Lap detection** — Spline position wrap-around (`prev > 0.9 × length && current < 0.1 × length`)
- **Elevation/exposure** — Spline Y-values inform camera composition and audio doppler

#### Custom array over Babylon curve types

Babylon.js provides `Curve3`, `CatmullRomCurve3`, and `Path3D`, but none carry per-segment metadata (width, surface type, next index). A custom `SplineSegment[]` is the correct choice.

### Decision 3: Static Havok colliders per category

One shared STATIC `PhysicsAggregate` per element category (barriers, track surface, kerbs, buildings) — approximately 3–5 static bodies per track. Meshes are merged per category into a single MESH shape.

**Specialist validation** (babylonjs-specialist, 2026-06-21): "PhysicsAggregate with mass: 0 (STATIC) and PhysicsShapeType.MESH is the correct API. DYNAMIC × MESH is Havok's most optimized collision pair. Merge 100+ barrier segments into one body — Havok builds a BVH per MESH shape and handles large tri-meshes efficiently."

**MINOR note** (not actionable for MVP): For tracks with 300+ barrier segments, compound bodies (individual `PhysicsShapeBox` per segment on a single `PhysicsBody`) are faster than a single large MESH shape.

### Decision 4: Pit zone detection via inline XZ point-in-box (not Havok)

Pit entry/exit zones use a standalone inline check:

```typescript
function isInZone(x: number, z: number, zone: PitZone): boolean {
  return x >= zone.xMin && x <= zone.xMax && z >= zone.zMin && z <= zone.zMax;
}
```

This is **6 float comparisons per car per zone** — ~0.00001ms per frame. No Havok trigger volumes needed. The specialist confirmed: "960 checks/sec is immeasurable."

**Avoid** `BABYLON.BoundingBox` for this hot-path use — it allocates `Vector3` objects per instance. The inline struct is allocation-free.

### Decision 5: Garage slots as logical positions

The 16 `pitGarageSlots` are logical `Vec3[]` positions, not physical collider bays. The pit lane surface is part of the track surface collider category; pit lane walls are barriers. Individual bay walls are **not** created.

**Rationale**: The arcade physics model (ADR-0008 Phase 3) overrides velocity every tick. Cars guided to their garage slot by the spline follower will not drift away. Individual bay colliders would create edge cases — cars approaching at slight angles can catch on bay walls.

### Decision 6: load()/dispose() lifecycle

`load(trackId)`: reads `TrackConfig`, issues asset load requests to Asset Manager, calls `container.instantiateModelsToScene()` (passing scene meshes for physics attachment — NOT container meshes), creates static physics bodies per category. Throws `ConfigError` if called while already in Ready state (caller must `dispose()` first).

`dispose()`: removes all track meshes from the scene, disposes physics impostors, clears internal references. Race restart requires no re-load — only car positions reset.

**Loading rule**: Physics bodies must be created on scene-instanced meshes, not container meshes:

```typescript
const container = await SceneLoader.LoadAssetContainerAsync(...);
const instances = container.instantiateModelsToScene();
// Physics on instances.newMeshes (scene meshes with correct transforms)
for (const mesh of instances.newMeshes) { ... }
```

### Decision 7: Validation on load

- Mismatched `next` indices produce `ConfigError`
- Missing grid positions produce `ConfigError`
- Pit exit spline endpoint must lie within `pitExitZone` bounding box — misalignment causes duplicate/missed pit events

## Consequences

### Positive

- **Config-driven** — New track = new config file + assets. Zero code changes to the engine.
- **Efficient physics** — 3–5 static bodies per track vs. 100+ individual colliders. Havok BVH handles large MESH shapes efficiently.
- **Zero GC pressure for pit zones** — Inline XZ check allocates nothing.
- **Spline as single source of truth** — Off-track detection, AI, grid, lap detection all read the same data. No synchronization needed.

### Negative

- **Garage isolation requires spline precision** — Without bay walls, the spline follower must position cars exactly. Off-by-50cm looks wrong visually.
- **Geometry must be triangulated** — `PhysicsShapeType.MESH` uses raw triangle data. Non-triangulated faces in the source GLB are silently ignored.
- **No moving colliders** — Cannot have animated pit crew, moving barriers, or destructible walls in Phase 1.

### Risks

- **Risk**: Compound bodies needed for high-poly tracks (300+ barrier segments).
  **Mitigation**: Deferred to Alpha. MVP tracks (~100 segments) use merged MESH.
- **Risk**: Pit exit misalignment causes missed pit events.
  **Mitigation**: `load()` validation checks pit exit spline endpoint against `pitExitZone`.
- **Risk**: Physics attached to container meshes (wrong transforms).
  **Mitigation**: Rule documented in code review criteria. Dev Tools overlay displays track physics body count for visual verification.

## Performance Implications

- **CPU**: ~3–5 Havok static bodies (negligible — no physics solve needed). Pit zone check ~0.00001ms/frame. Spline forward scan O(1) average per car.
- **Memory**: ~50KB per track (TrackConfig + mesh references). Texture assets tracked by Asset Manager.
- **Load time**: GLB load + `instantiateModelsToScene()` per track. Cached via Asset Manager — race restart is instant.

## Validation Criteria

- [ ] `load(trackId)` reads TrackConfig and instantiates meshes + static physics bodies
- [ ] `dispose()` removes all meshes, disposes physics, clears references
- [ ] `load()` while already Ready throws `ConfigError` — caller must `dispose()` first
- [ ] Spline forward scan returns correct segment and width for any car position
- [ ] Pit zone detection fires `pit.entry`/`pit.exit` at zone boundaries
- [ ] Garage spline follower positions car at the correct `pitGarageSlots[i]` position
- [ ] Mismatched `next` index in spline data throws `ConfigError`
- [ ] `getTrackHalfWidth(pos)` returns `segment.width / 2`
- [ ] Two tracks referencing same asset key load the file once (Asset Manager cache)

## GDD Requirements Addressed

| GDD Requirement                                     | How This ADR Addresses It                          |
| --------------------------------------------------- | -------------------------------------------------- |
| TrackConfig TypeScript with spline, grid, pit zones | Pure data interface in `src/config/tracks/{id}.ts` |
| Spline as authoritative for off-track detection     | Forward scan from last-known segment (O(1) avg)    |
| One static Havok impostor per element category      | 3–5 MERGED MESH bodies per track                   |
| Pit zone detection per tick                         | Inline XZ point-in-box (6 float comparisons)       |
| Pit garage slots (16, 8 active)                     | Logical `Vec3[]` — no collider bays                |
| `getTrackHalfWidth(pos)` for AI overtaking          | `segment.width / 2`                                |
| `load()`/`dispose()` lifecycle                      | `load()` throws if Ready; `dispose()` removes all  |
| Spline data validation on load                      | ConfigError for mismatched next / missing grid     |
| Asset cache for shared assets                       | Same GLB loaded once via Asset Manager             |
