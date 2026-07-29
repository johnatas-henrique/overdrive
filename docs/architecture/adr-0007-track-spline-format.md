# ADR-0007: Track Spline Format

## Status

Accepted

## Date

2026-07-27

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Core / Track |
| **Knowledge Risk** | LOW — JSON deserialization + spline math. No engine-version-specific APIs. |
| **References Consulted** | `design/gdd/track-system.md`, `design/gdd/car-definition-data.md`, `docs/architecture/architecture.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | 4-track JSON deserialization < 50 ms per track on target platforms. Expected JSON size: ~200-500 KB per track (3 splines × 2500 points). |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0003 (`Tracks/{trackId}` Addressable group). ADR-0006 (surface modifiers consumed by TireSystem at Step 5b) |
| **Enables** | AI Rival (racing line), RSM (pit→racing mapping, lap validation), HUD (track map), Pit Stop (16 boxes) |
| **Blocks** | Track content authoring until JSON schema is finalized |
| **Ordering Note** | Schema version 1 must be frozen before first track is authored. JSON file naming convention: `snake_case` |

## Context

Track data must serve 6 consumer systems: Vehicle Physics (grip multiplier), Tire (wear multiplier), AI Rival (racing line), RSM (lap validation, pit→racing mapping), HUD (track map rendering), and Pit Stop (16 pit boxes). The conversion pipeline (GPX/GeoJSON → Python + rasterio → JSON) produces the format; Unity loads it at race init.

### Registry Check

Existing stances relevant to Track:
- `Tracks/{trackId}` Addressable group → Content Pipeline (ADR-0003). Track is loaded via `Tracks/{trackId}` group.
- `surfaceWearMultiplier[carId]` → Track System owns the per-car wear table (ADR-0006). TireSystem reads from TickStartSnapshot.
- `surfaceGripMultiplier[carId]` → Track System owns the per-car grip table. Vehicle Physics consumes via grip stack (ADR-0002).
- Data-driven content: all track data is data (JSON, ScriptableObjects). No code changes for new tracks.

## Decision

Track data is stored as **JSON files** loaded via Addressables (`Tracks/{trackId}`). The format uses `SplineData` for geometry, `SurfaceZone` + `SurfaceModifierTable` for surface data, `PitLaneDefinition` with 16 boxes, `SplineData racingLineSpline` for AI, and `SplineMetadata` for HUD/UI display.

### Key Interfaces

```csharp
// JSON schema — snake_case field naming, schemaVersion=1
[Serializable]
public sealed class TrackDataContainer {
    public TrackData data;
}

[Serializable]
public class TrackData {
    public int schemaVersion = 1;
    public string trackId;
    public SplineData racingSpline;
    public SplineData pitSpline;              // parallel offset, NOT a closed loop
    public SplineData racingLineSpline;       // pre-computed AI racing line (from telemetry)
    public SurfaceZone[] surfaceZones;
    public SurfaceModifierTable surfaceModifiers;  // data-driven grip + wear values
    public PitLaneDefinition pitLane;
    public StartGridDefinition startGrid;
    public SplineMetadata metadata;
}

[Serializable]
public struct SplineData {
    public float3[] points;             // centerline, uniform spacing (~2m). float not double.
    public float[] segmentLengths;      // cumulative per-segment
    public float totalLength;           // meters
    public float[] curvatureRad;        // per-point curvature
    public float[] bankAngleDeg;        // per-point banking
    public float[] widthPerPoint;       // variable track width
}

[Serializable]
public struct SurfaceZone {
    public int startPointIndex;         // inclusive
    public int endPointIndex;           // exclusive
    public SurfaceType surfaceType;
}

[Serializable]
public struct SurfaceModifierTable {
    public SurfaceEntry[] entries;      // data-driven, one per SurfaceType
}

[Serializable]
public struct SurfaceEntry {
    public SurfaceType surface;
    public float gripMultiplier;        // VP stack (Asphalt 1.0, Kerb 0.85, Gravel 0.4, etc.)
    public float wearMultiplier;        // Tire wear (Asphalt 1.0, Kerb 1.2, Off-Track 2.5)
}

[Serializable]
public struct PitLaneDefinition {
    public int entryPointIndex;         // racingSpline index where pit entry begins
    public int exitPointIndex;          // racingSpline index where pit exit rejoins
    public float pitEntryProgress;      // fraction of racing spline at entry (for HUD PitThisLap)
    public float pitSpeedLimitKph;      // 80 km/h (per Track GDD)
    public PitLaneSide side;            // Right (pit lane to right of racing spline) or Left (pit lane to left). Per-circuit property, not derived from track direction.
    public PitBox[] boxes;              // 16 boxes for F1 two-lane model
    public float[] pitToRacingProgress; // per pitSpline point → racingSpline progress
}

public enum PitLaneSide : byte { Right, Left }

[Serializable]
public struct PitBox {
    public int boxId;
    public float entryProgress;         // pitSpline progress where box lane diverges
    public float exitProgress;          // pitSpline progress where box merges back
    public float lateralOffsetMeters;   // ~3m offset from fast lane center
    public float lengthMeters;          // box length for visual representation
}

[Serializable]
public struct StartGridDefinition {
    public int firstRowPointIndex;      // racingSpline index for grid front
    public float rowSpacing;            // 8m (range 6–10)
    public float columnOffset;          // lateral offset per column
    public bool firstCornerRight;       // direction of turn 1
}

[Serializable]
public struct SplineMetadata {
    public string displayName;          // e.g. "Monaco"
    public string country;              // e.g. "Monaco"
    public int turnCount;
    public float elevationRangeMeters;
    public float referenceFlyingLapTimeSec;  // for AI base speed + Qualifying fuel calc
}
```

### Addressables Loading

TrackData is loaded via `Addressables.LoadAssetAsync<TextAsset>($"Tracks/{trackId}")` then deserialized via `JsonUtility.FromJson<TrackDataContainer>(textAsset.text).data`. The `TrackDataContainer` wrapper is required because `JsonUtility.FromJson<T>` uses `UnityEngine.JSONNode` internally and can't deserialize generic `float3[]` at the top level of a non-`[Serializable]` class. After deserialization, `Addressables.Release(handle)` frees the TextAsset memory. Schema version mismatch or corrupt JSON produces `ContentLoadError(ContentErrorType.Track)`.

### Runtime API

At race init, TrackSystem pre-builds acceleration structures (segment index with Catmull-Rom chordal parameterization, surface lookup table, pit→racing map). Catmull-Rom spline interpolation ensures smooth tangent derivatives even with non-uniform point spacing (curvature-based sampling from the conversion pipeline). Per tick:

- `SamplePoint(float progress)` → float3 + quaternion forward
- `SampleCurvature(float progress)` → float curvature radius
- `SampleSurface(float progress)` → SurfaceType
- `GetSurfaceGripMultiplier(float progress)` → float grip modifier
- `GetSurfaceWearMultiplier(float progress)` → float wear modifier
- `GetSurfaceWearMultipliers()` → `float[16]` per car (consumed by TireSystem at Step 5b)
- `GetPitProgress(float racingProgress)` → pitProgress + isInPitLane (HUD PitThisLap trigger)
- `PitProgressToRacing(float pitProgress)` → racingProgress (per-sample mapping for RSM)
- `GetPitBox(int boxId)` → PitBox data (for Pit Stop)
- `GetNearestProgress(float3 worldPos)` → nearest progress + distance (RSM lap validation)
- `CrossedLapBoundary(float prevProgress, float currProgress)` → bool (RSM detects lap line crossing)
- `GetPitEntryZone(float progress)` → PitEntryZone (entry trigger zone for Vehicle Physics)
- `GetRacingLine(float progress)` → float3 racing line position (for AI Rival)

## Consequences

- **Simple serialization:** `JsonUtility.FromJson` with `[Serializable]` attributes. No custom parser.
- **Pipeline-friendly:** GPX/GeoJSON → JSON conversion in standalone Python step.
- **All consumers satisfied:** VP (gripMultiplier), Tire (wearMultiplier), AI (racingLineSpline), RSM (pit→racing mapping), HUD (metadata), Pit Stop (16 boxes).
- **Schema evolution:** `schemaVersion` enables forward-compatible upgrades.
- **Surface modifiers in data:** a track with unique surface properties (wet kerb, special gravel) does not require code changes.

## Validation Criteria

- [ ] 4-track JSON deserialization < 50 ms per track on target platforms
- [ ] `SamplePoint(0.0)` == `SamplePoint(1.0)` within float tolerance (closed loop)
- [ ] Surface zone + modifier lookup at any progress returns correct values
- [ ] Pit entry/exit progress maps correctly to racing spline
- [ ] 16 pit boxes created from JSON, each with correct lateral offset

## Related Decisions

- ADR-0003: Tracks/{trackId} Addressable group
- ADR-0006: surface modifiers consumed by TireSystem at Step 5b

## GDD Requirements Addressed

| GDD | Requirements |
|-----|--------------|
| track-system.md | JSON schema, SplineData, SurfaceZone, SurfaceModifierTable, PitLaneDefinition, StartGridDefinition, SplineMetadata |
| content-pipeline.md | Tracks/{trackId} Addressable group topology |
| vehicle-physics.md | surfaceGripMultiplier per car, per-point curvatureRad |
| tire-system.md | surfaceWearMultiplier per car via TickStartSnapshot |
| grid-start.md | StartGridDefinition for car positioning |
| pit-stop.md | PitLaneDefinition with 16 pit boxes, pitEntryProgress, pitToRacingProgress |
| ai-rival.md | racingLineSpline for AI path |
