# Story 001: Track JSON Schema & Addressable Loading

> **Epic**: Track
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/track-system.md`
**Requirement**: `TR-track-001` (JSON storage), `TR-track-004` (schema-versioned, Addressable)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0007: Track Spline Format
**ADR Decision Summary**: Track data is JSON loaded via `Addressables.LoadAssetAsync<TextAsset>($"Tracks/{trackId}")`, deserialized via `JsonUtility.FromJson<TrackDataContainer>(textAsset.text).data`, then the handle is released. The `TrackDataContainer` wrapper is REQUIRED (JsonUtility can only deserialize into a `[Serializable]` class root — no bare top-level arrays/generic containers). Field names are **camelCase** and EXACTLY match the C# fields (the former snake_case contract was REJECTED 2026-08-05 — JsonUtility is case-sensitive with no renaming attribute). Schema version mismatch or corrupt JSON → `ContentLoadError(ContentErrorType.Track)`. Deserialization+validation < 50 ms per track.

**Engine**: Unity 6000.3.22f1 | **Risk**: MEDIUM
**Engine Notes**: JsonUtility constraints (case-sensitive, no renaming); Addressables via the shipped content loader seams (3-10).

**Control Manifest Rules (this layer)**:
- Required: `TrackDataContainer` wrapper; camelCase field names matching the C# schema
- Required: release handle after deserialize; corrupt/mismatch → ContentLoadError(Track)

---

## Acceptance Criteria

*From ADR-0007 + GDD, scoped per QL-STORY-READY 2026-08-16:*

- [ ] A v1 JSON document rooted in `TrackDataContainer` with camelCase fields (`segmentLengths`, `curvatureRad`, `startPointIndex`) loads to a populated `TrackData` with `schemaVersion == 1` and no defaulted required fields
- [ ] The loader uses the exact key `Tracks/{trackId}`; the handle is released after deserialization/validation (release still occurs on corrupt JSON or validation failure)
- [ ] Corrupt JSON, unsupported schema version, or a missing required field → `ContentLoadError(ContentErrorType.Track)` with `trackId` and the failing field/category; no usable partial track returned
- [ ] Coordinate contract: loaded points preserve authored local game-space `float3` meter values within float tolerance; the validator rejects source-coordinate fields (longitude/latitude) — schema/fixture contract, not runtime heuristics
- [ ] The four MVP tracks (monaco, monza, silverstone, spa) load through the same contract with parse/validation time below 50 ms per track (deserialization+validation measured separately from Addressables I/O)

---

## Implementation Notes

*Derived from ADR-0007 Implementation Guidelines:*

- All schema classes are `[Serializable]`; `float3[]` fields live inside `[Serializable]` wrapper classes
- camelCase naming is a hard contract — a snake_case-emitting pipeline silently deserializes to defaults (the 2026-08-05 rejection)
- Reuse the shipped Addressables loader seams (Overdrive.Content.Unity) — this story supplies the Track-specific deserialization + validation path
- **Data authoring source (2026-08-16 decision)**: the four TrackData assets are authored by MEASURING reference geometry from downloaded circuit models (CC-BY) + real geolocs (OSM/GPX/SRTM) — centerline → spline, trackside positions → placement manifest, elevation → altimetry (prefer SRTM/GPS over mesh). The circuit layout is a fact (not copyrightable); the mesh is a measurement source, never redistributed as a game asset. Spa 1992 layout == 1989 (changed only in 1994).

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 002]: runtime spline materialization (consumes the loaded TrackData)
- [Content pipeline epic]: Addressables group topology (shipped 3-8)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (valid contract)**: v1 TrackDataContainer camelCase → populated TrackData, schemaVersion 1, no defaulted required fields; edge: bare top-level array, snake_case names, null data, empty required arrays
- **AC-2 (addressables release)**: adapter records calls → exact key `Tracks/{trackId}` used + handle released; edge: release still occurs after corrupt JSON/validation failure
- **AC-3 (load failures)**: corrupt JSON/unsupported version/missing field → ContentLoadError(Track) with trackId + failing field; no partial track
- **AC-4 (coordinate contract)**: local float3 meters preserved exactly; no lon/lat accepted
- **AC-5 (performance)**: 4 MVP tracks load, parse+validate < 50 ms each

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/content/TrackDataTests.cs` — load/release/failure paths with the loader adapter
- Logic companion: `Assets/tests/unit/content/TrackDataTests.cs` (validation)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Content pipeline (Addressables seams, Tracks/{trackId} groups)
- Unlocks: Stories 002-005 (consume the loaded TrackData)
