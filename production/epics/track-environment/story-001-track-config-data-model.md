# Story 001: TrackConfig Data Model + Config Structure

> **Epic**: Track + Environment
> **Status**: Ready
> **Layer**: Core
> **Type**: Config/Data
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/track-environment.md`
**Requirements**: `TR-TE-001`

- **TR-TE-001** (revised 2026-06-23): Track spline defined as array of SplineSegment with point (Vec3), width (number), next (number), and gripSurface ('tarmac' | 'kerb' | 'grass'). Heading and curvature derived from point→next topology.

**ADR Governing Implementation**: ADR-0025: Track + Environment — TrackConfig TypeScript interface
**ADR Decision Summary**: All track data lives in a typed config file per circuit. SplineSegment[] custom array carries per-segment metadata. Pure data (zero Babylon imports) — lives in Foundation-friendly package `src/config/tracks/`.

**Engine**: Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12 | **Risk**: LOW
**Engine Notes**: No Babylon.js imports in this story — pure TypeScript interfaces and data.

**Control Manifest Rules (this layer)**:

- C59: Track: SplineSegment[] custom array — carries per-segment `width` + `next` index. NOT `Curve3`/`CatmullRomCurve3`/`Path3D` (no metadata).
- C62: Track: config-driven — `src/config/tracks/{id}.ts` + GLB assets. Zero TypeScript code changes to add a circuit.
- C-F1: Never use `Curve3`, `CatmullRomCurve3`, or `Path3D` for spline data — cannot carry per-segment metadata.

---

## Acceptance Criteria

_Revised per QL-STORY-READY gate on 2026-06-23:_

- [ ] **AC-1**: `SplineSegment` interface defined with fields: `point: Vec3`, `width: number`, `next: number`, `gripSurface: 'tarmac' | 'kerb' | 'grass'`
- [ ] **AC-2**: `PitZone` interface defined with fields: `xMin: number`, `xMax: number`, `zMin: number`, `zMax: number`
- [ ] **AC-3**: `Vec3` interface defined with fields: `x: number`, `y: number`, `z: number`
- [ ] **AC-4**: `TrackAssets` interface with per-element asset keys: `surface`, `barriers`, `kerbs`, `sky`, plus optional `buildings`, `grandstands`, `trees`, `signage`
- [ ] **AC-5**: `TrackConfig` interface with all fields: `id`, `name`, `region`, `skyPalette`, `pitEntryZone`, `pitExitZone`, `pitLaneSpline`, `pitGarageSlots`, `gridPositions`, `spline`, `assets`
- [ ] **AC-6**: All interfaces exported from a shared types module under `src/config/tracks/types.ts`
- [ ] **AC-7**: Per-track config file at `src/config/tracks/{id}.ts` exports `default config: TrackConfig` — no code changes needed to add new tracks beyond creating this file and associated GLB assets

---

## Implementation Notes

_Derived from ADR-0025 Implementation Guidelines:_

### SplineSegment (the authoritative racing line)

```typescript
interface SplineSegment {
  point: Vec3; // world-space position
  width: number; // track width (centre to edge × 2)
  next: number; // index of next segment (-1 for last)
  gripSurface: "tarmac" | "kerb" | "grass";
}
```

- **Heading** is derived from `point → spline[seg.next].point` vector direction. Not stored.
- **Curvature** is derived from heading delta between adjacent segments. Not stored.
- `gripSurface` is the authoritative surface type for Physics grip formula consumption. Default on missing: `'tarmac'`.

### PitZone (inline XZ point-in-box region)

```typescript
interface PitZone {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}
```

Named `PitZone` per ADR-0025 (not `BoundingBox` from GDD). Same field structure.

### TrackConfig — per-track data

```typescript
interface TrackConfig {
  id: string; // "monza", "interlagos", etc.
  name: string; // "Autodromo Nazionale di Monza"
  region: string; // "Italy"
  skyPalette: string; // key into SkyPalettes config
  pitEntryZone: PitZone;
  pitExitZone: PitZone;
  pitLaneSpline: Vec3[]; // waypoints from entry → garage area → exit
  pitGarageSlots: Vec3[]; // 16 positions, first 8 active in MVP
  gridPositions: Vec3[]; // exactly 26 entries
  spline: SplineSegment[]; // central racing line (~200 segments)
  assets: TrackAssets;
}
```

### Config Discovery

Per control manifest rule F-F1, `import.meta.glob` is forbidden. Track configs are registered explicitly via `TrackEnvironmentManager.registerConfig(config: TrackConfig)` during init phase. Each track folder at `src/config/tracks/{id}.ts` exports a default `TrackConfig`, and the registration call enumerates them. The number of tracks is known at compile time — no filesystem auto-discovery.

### Import Restriction

All types in this story are pure data — no imports from `@babylonjs/core`. Zero engine dependency. The `Vec3` type is our own local interface, NOT `BABYLON.Vector3`.

---

## Out of Scope

- **Story 002**: Spline query functions — `getTrackHalfWidth`, `getElevation`, `getTangent`, forward scan
- **Story 003**: Spline validation (mismatched `next`, grid size, pit exit alignment) — runs during `load()`, not registration
- **Story 005**: Pit zone detection runtime (`isInPitEntryZone`, `isInPitExitZone`) — consumes PitZone type
- **Story 006**: Skybox loading — consumes `skyPalette` key from TrackConfig

---

## QA Test Cases

_Written by qa-lead at story creation. The developer implements against these — do not invent new test cases during implementation._

**Test file**: `tests/unit/track-environment/track-config.test.ts`

- **AC-1** (SplineSegment interface):
  - Given: A valid SplineSegment object with point, width, next, gripSurface
  - When: It is created with correct types
  - Then: TypeScript compilation succeeds; each field is accessible and typed correctly
  - Edge: gripSurface rejects invalid values — `'gravel'` should produce TypeScript compile error

- **AC-2** (PitZone interface):
  - Given: A valid PitZone with xMin, xMax, zMin, zMax as numbers
  - When: Zone boundaries are accessed
  - Then: All four coordinates are finite numbers, xMin < xMax, zMin < zMax
  - Edge: xMin > xMax — the data is valid structurally but runtime checks (Story 003) may flag this

- **AC-3** (Vec3 interface):
  - Given: A valid Vec3 with x, y, z as numbers
  - When: Fields are accessed
  - Then: All three coordinates are finite numbers

- **AC-4** (TrackAssets interface):
  - Given: A TrackAssets object with required keys (surface, barriers, kerbs, sky) and optional keys
  - When: Created
  - Then: Required fields are non-optional (TS enforces); optional fields may be undefined

- **AC-5** (TrackConfig interface):
  - Given: A TrackConfig with all fields populated
  - When: Instantiated
  - Then: gridPositions.length === 26; pitGarageSlots.length === 16; spline.length > 0

- **AC-6** (module exports):
  - Given: Module `src/config/tracks/types.ts`
  - When: Imported
  - Then: All six interfaces (SplineSegment, PitZone, Vec3, TrackAssets, TrackConfig) are exported

- **AC-7** (per-track config):
  - Given: A file `src/config/tracks/monza.ts`
  - When: Imported
  - Then: It has a `default` export of type TrackConfig with `id: "monza"`
  - Edge: Track config without `default` export should fail at import level

---

## Test Evidence

**Story Type**: Config/Data
**Required evidence**: `tests/unit/track-environment/track-config.test.ts` — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None (pure data types, zero imports)
- Unlocks: Stories 002, 003, 005, 006
