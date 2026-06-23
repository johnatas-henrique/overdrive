# Epic: Track + Environment

> **Layer**: Core (slot #5 — track geometry needed before AI can path-follow)
> **GDD**: design/gdd/track-environment.md
> **Architecture Module**: Core — Track
> **Status**: Ready
> **Stories**: 6 stories (Ready)

## Overview

Track spline as custom `SplineSegment[]` array (not Babylon.js `Curve3`/`CatmullRomCurve3` — cannot carry per-segment metadata). Each segment carries position, heading, curvature, gripSurface, trackWidth. GLB loaded via Asset Manager with static Havok colliders (3-5 bodies per track, `PhysicsShapeType.MESH`). Pit zone detection via inline XZ point-in-box (not Havok trigger volumes). Config-driven: `src/config/tracks/{id}.ts` + GLB assets. Gradient skydome per track. Pit lane geometry included from the start (retrofitting would require remaking the track).

## Stories

| #   | Story                                     | Type        | Status | ADR                |
| --- | ----------------------------------------- | ----------- | ------ | ------------------ |
| 001 | TrackConfig data model + config structure | Config/Data | Ready  | ADR-0025           |
| 002 | Spline query interface                    | Logic       | Ready  | ADR-0025           |
| 003 | Track loading/disposal lifecycle          | Integration | Ready  | ADR-0025           |
| 004 | Static physics collider setup             | Integration | Ready  | ADR-0025, ADR-0010 |
| 005 | Pit lane zones and queries                | Logic       | Ready  | ADR-0025           |
| 006 | Skybox per track                          | Visual/Feel | Ready  | ADR-0025           |

## Governing ADRs

| ADR                           | Decision Summary                                                                               | Engine Risk |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | ----------- |
| ADR-0025: Track + Environment | SplineSegment[] custom array, static Havok colliders, inline pit zone detection, config-driven | MEDIUM      |

## GDD Requirements

| TR-ID     | Requirement                                                                | ADR Coverage |
| --------- | -------------------------------------------------------------------------- | ------------ |
| TR-TE-001 | SplineSegment[] with position, heading, curvature, gripSurface, trackWidth | ADR-0025 ✅  |
| TR-TE-002 | GLB loaded via Asset Manager, instantiated in raceScene                    | ADR-0025 ✅  |
| TR-TE-003 | Static environment meshes with PhysicsShapeType.MESH for collision         | ADR-0025 ✅  |
| TR-TE-004 | Pit lane with entry, exit, 8 pit boxes, speed limit zone                   | ADR-0025 ✅  |
| TR-TE-005 | Gradient skydome per track (time of day, weather preset)                   | ADR-0025 ✅  |
| TR-TE-006 | Off-track detection via spline distance check                              | ADR-0025 ✅  |
| TR-TE-007 | Config-driven track definition — zero code changes to add circuit          | ADR-0025 ✅  |
| TR-TE-008 | TrackEnvironmentManager lifecycle: load()/dispose() with AssetContainer    | ADR-0025 ✅  |
| TR-TE-009 | Pit lane mesh included from the start (not retrofitted)                    | ADR-0025 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/track-environment.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Stories written. Run `/story-readiness production/epics/track-environment/story-001-track-config-data-model.md` to begin implementation.
