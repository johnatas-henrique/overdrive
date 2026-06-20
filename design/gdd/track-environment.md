# Track + Environment

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Foundation — Track

## Overview

Track + Environment owns every physical element of a circuit except the cars. It provides the track surface, surroundings, pit lane, grid positions, off-track detection data, and sky — packaged as a single loadable unit per circuit.

The system is **config-driven**: all track data lives in per-track config files under `src/config/tracks/`. Adding a new circuit means adding one config directory and its `.glb` + `.png` assets — zero code changes. Phase 1 ships 4 tracks (Interlagos, Monza, Spa, Monaco); the architecture supports an unlimited roster.

---

## Player Fantasy

Tracks are places, not puzzles. Each circuit has a distinct visual character — the colours of its region, the silhouette of its grandstands, the shape of its kerbs — but the player never thinks about "loading zones" or "boundary meshes." The track is the stage for the race; it exists to be driven, not examined.

The fantasy is **geographic variety without friction**: switching from the high-speed straights of Monza to the rain-soaked kerbs of Spa is a single menu selection, immediate and seamless.

---

## Detailed Design

### Track Data Model

Each track is configured by a TypeScript file at `src/config/tracks/{id}.ts` exporting a `TrackConfig`:

```typescript
interface TrackConfig {
  id: string; // "monza", "interlagos", etc.
  name: string; // "Autodromo Nazionale di Monza"
  region: string; // "Italy"
  skyPalette: string; // key into palette.json skyPalettes
  pitEntryZone: BoundingBox;
  pitExitZone: BoundingBox;
  pitLaneSpline: Vec3[]; // waypoints from entry → garage area → exit
  pitGarageSlots: Vec3[]; // 16 positions, first 8 used in MVP
  gridPositions: Vec3[]; // 26 positions, first 8 used for grid start
  spline: SplineSegment[]; // central racing line
  assets: TrackAssets;
}
```

```typescript
interface BoundingBox {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface TrackAssets {
  surface: string;
  barriers: string | string[];
  kerbs: string | string[];
  sky: string;
  buildings?: string | string[];
  grandstands?: string | string[];
  trees?: string | string[];
  signage?: string | string[];
}

interface SplineSegment {
  point: Vec3; // world-space position
  width: number; // track width at this point (centre to edge × 2)
  next: number; // index of next segment (-1 for last)
}
```

The spline is the **authoritative reference** for:

- Off-track detection (Physics/Handling reads `width` per segment)
- AI Driver racing line (reads `point` as path waypoints)
- Pit entry/exit are independent spatial zones, not on the spline

### Loading Flow

```
Single Race ──→ Track + Environment.load("monza")
                     │
                     ├── Read TrackConfig from ConfigManager (src/config/tracks/monza.ts)
                     │
                     ├── Asset Manager.load("tracks/monza_surface")
                     ├── Asset Manager.load("tracks/monza_buildings")
                     ├── Asset Manager.load("shared/barriers")
                     ├── Asset Manager.load("shared/trees")
                     ├── Asset Manager.load("shared/kerbs")
                     └── Asset Manager.load("shared/signage")
                     │
                     └── container.instantiateModelsToScene()
                              │
                              └── Physics impostors added by Track + Environment
                                  (static meshes: track surface, barriers, kerbs,
                                   buildings, grandstands)
```

Track + Environment **owns the asset orchestration**: it knows which assets compose a track. Single Race only calls `load()`.

All meshes share one static physics impostor per element category (one for barriers, one for buildings, etc.) — the environment doesn't move.

### Environment Composition

| Element           | Physics | Notes                                                                              |
| ----------------- | ------- | ---------------------------------------------------------------------------------- |
| **Track surface** | Static  | Most detailed mesh. Includes kerbs rendered on surface. Includes pit lane surface. |
| **Buildings**     | Static  | Simplified boxes with facade texture.                                              |
| **Grandstands**   | Static  | Tiered seating with crowd texture.                                                 |
| **Barriers**      | Static  | Armco + tire walls.                                                                |
| **Trees**         | None    | 2-4 polygon cards. Billboard or static. No collision.                              |
| **Kerbs**         | Static  | 3 variants: standard, fast corner, run-off edge.                                   |
| **Signage**       | None    | Billboard planes with sponsor texture. No collision.                               |
| **Sky**           | —       | Single gradient texture on a skydome.                                              |

Each element is identified by its key in `TrackConfig.assets`. The Asset Manager caches by key: if two tracks reference the same key, the file loads once. No element is hardcoded as "shared" or "per-track" — that distinction is determined by which key each track config specifies. Convention places unique meshes under `assets/tracks/{id}/` and reusable ones under `assets/shared/`, but the system treats all keys identically.

### Grid Positions

Each track config declares **26 grid positions** (standard 1991 F1 grid), ordered from pole position (#1) to #26. Phase 1 (8 cars) uses positions 1-8. Phase 2 (16 cars) uses positions 1-16. The remaining 10 positions exist for future grid expansion — no track data change needed.

Positions are marked on the track geometry itself (painted grid marks on asphalt), reinforcing the visual authenticity.

### Pit Lane

The pit lane includes:

- **Visible geometry**: Pit entry line, pit lane surface (separated by white line), pit boxes, pit exit line — modelled as part of the track surface mesh
- **Entry zone**: `BoundingBox` — when car enters this box, Pit Stop receives `pit.entry`
- **Exit zone**: `BoundingBox` — when car crosses this box, Pit Stop receives `pit.exit`

Pit speed limit (80 km/h) is enforced by Physics/Handling when `pit.active === true`. Pit Stop activates this per-car via direct API call on entry and deactivates on exit — Physics does not subscribe to Event Bus events for pit speed control.

### Off-Track Detection

Physics/Handling checks off-track status each tick:

```
trackConfig.spline.forEach(segment => {
  const dist = distance(car.position, segment.point);
  if (dist > segment.width / 2) {
    car.offTrack = true;
    return;
  }
});
```

The spline is the same data structure used by AI Driver. Only Physics/Handling reads it for off-track. Performance: O(1) search per car per tick (last-known segment index with forward scan — splines are linear by lap order).

### Sky Per Track

Each track references a fixed sky palette from `palette.json`. The sky is a single gradient texture on a skydome mesh — no dynamic sky simulation. Sky changes only when the player changes track.

---

## States & Transitions

| State        | Description                                                    |
| ------------ | -------------------------------------------------------------- |
| **Inactive** | No track loaded. No meshes in scene.                           |
| **Loading**  | Asset Manager is resolving assets. Scene has placeholder.      |
| **Ready**    | All meshes instantiated, impostors active, physics running.    |
| **Disposed** | Meshes removed from scene, physics freed. Returns to Inactive. |

Transition flow: `Inactive → Loading → Ready → Disposed → Inactive`.

- `load(trackId)`: If Ready, asks caller to unload first.
- `dispose()`: Removes all track meshes from scene, frees physics impostors, clears references.

---

## Formulas

No runtime formulas. Per-track configuration is data-driven, not computed.

---

## System Interactions

| System               | Interaction                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Asset Manager**    | Receives asset load requests for all track meshes + textures.                                                                                     |
| **Data & Config**    | Provides `TrackConfig` from `src/config/tracks/{id}.ts`.                                                                                          |
| **Physics/Handling** | Reads spline `width` per segment for off-track detection.                                                                                         |
| **AI Driver**        | Reads spline `point[]` as racing line waypoints.                                                                                                  |
| **Collision**        | Barriers exist as static colliders — Collision emits `collision.impact` for them.                                                                 |
| **Single Race**      | Orchestrator: calls `load(trackId)` before race, `dispose()` after.                                                                               |
| **Pit Stop**         | Provides `pitLaneSpline`, `pitGarageSlots` for guidance. Track + Environment detects `pitEntryZone`/`pitExitZone` per tick and notifies Pit Stop. |
| **Race Management**  | Finish line is a spatial zone in Race Management, not in Track.                                                                                   |

---

## Edge Cases

| Case                            | Behaviour                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Track not found**             | `load("nonexistent")` throws `ConfigError`. Caller handles (falls back to default track or error screen). |
| **Asset load failure**          | Asset Manager returns error. Track stays in Loading. GSM transitions to error state via Event Bus.        |
| **Dual track load**             | If called while Ready, config error — caller must `dispose()` first.                                      |
| **Race restart**                | No reload needed — Assets are cached. Track + Environment only resets car positions.                      |
| **Spline with corrupted data**  | Each segment validated on load. Mismatched `next` index = config error.                                   |
| **No grid positions defined**   | Config error. Grid screen refuses to start race.                                                          |
| **Pit zone overlap with track** | Config validation warns if pit entry/exit zones overlap the racing surface. Non-blocking.                 |

---

## Dependencies

| System                   | Dependency Type | Notes                                    |
| ------------------------ | --------------- | ---------------------------------------- |
| **Asset Manager**        | Hard            | Loads all .glb and .png assets           |
| **Data & Config**        | Hard            | Provides `TrackConfig` per track         |
| **Entity/Car Lifecycle** | Optional        | Positions cars on grid during Race phase |

---

## Tuning Knobs / Config

| Knob                        | Type      | Default     | Description                                |
| --------------------------- | --------- | ----------- | ------------------------------------------ |
| Tracks (number of built-in) | Data      | 4           | 4 in Phase 1, expandable                   |
| Grid positions              | Data      | 26          | Per-track, Phase 1 uses first 8            |
| Spline segment count        | Per-track | ~200        | Resolution of the central racing line      |
| Pit entry/exit zone         | Per-track | BBox        | Coordinates of pit entry/exit detection    |
| Pit lane spline waypoints   | Per-track | ~20         | Guide path from entry → garage area → exit |
| Pit garage slots            | Per-track | 16 (MVP: 8) | Stop position for each team in pit lane    |

All triangle and texture budgets are in the art bible (Section 8), not duplicated here.

---

## Visual & Audio Requirements

| Element           | Requirement                                                                          |
| ----------------- | ------------------------------------------------------------------------------------ |
| **Track surface** | .glb mesh merges asphalt, markings, kerbs, pit lane into a single surface            |
| **Buildings**     | Simplified boxes with 512×512 facade texture.                                        |
| **Grandstands**   | Tiered seating mesh + 512×256 crowd texture.                                         |
| **Barriers**      | Armco + tire walls. Collides with cars.                                              |
| **Trees**         | 2-4 polygon cards, no transparency, no collision.                                    |
| **Kerbs**         | 3 variants. High-contrast color blocks.                                              |
| **Signage**       | Billboard planes with 256×256 sponsor textures.                                      |
| **Sky**           | Gradient .png on skydome. No dynamic sky.                                            |
| **Audio**         | No audio owned by this system. Audio cues come from Physics/Handling + Audio system. |

---

## Acceptance Criteria

1. ✅ `trackEnvironment.load("monza")` instantiates all track meshes in the scene
2. ✅ `trackEnvironment.dispose()` removes all track meshes and frees impostors
3. ✅ Loading unknown track ID throws `ConfigError`
4. ✅ Grid positions array has exactly 26 entries per track config
5. ✅ First 8 grid positions are used in Phase 1 grid start
6. ✅ Pit entry zone detects car crossing into pit lane
7. ✅ Pit exit zone detects car leaving pit lane
8. ✅ Spline provides AI Driver with trajectory waypoints
9. ✅ Physics/Handling can query off-track status via spline distance
10. ✅ Sky texture loads and applies on skydome per track
11. ✅ Race restart does not reload assets (cached by Asset Manager)
12. ✅ Asset load failure prevents Ready state and emits error via Event Bus
13. ✅ Two tracks referencing the same asset key load the file once (Asset Manager cache)
14. ✅ Dual `load()` without `dispose()` returns config error
