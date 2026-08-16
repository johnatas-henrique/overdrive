# Epic: Track

> **Layer**: Core
> **GDD**: design/gdd/track-system.md
> **Architecture Module**: Track data pipeline (TrackData Addressable content — AddressableKeys.TrackData already shipped; chordal Catmull-Rom runtime materialization)
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories track`
> **Estimate**: 3 stories (~8h active — calibrated 0.3×, sprint-3 retrospective)
> **Session**: S2 · Phase 1 (2-orchestrator plan 2026-08-16)
> **Depends on**: Nothing (independent — prototype tracks are 2D; elevation is pending production per prototype findings); ADR-0007. First track ships early to unblock the VP feel rig (bridge 3).

## Overview

The four MVP tracks as spline-based content: JSON format (spline, width, surface zones, pit lane, grid positions, metadata) schema-versioned and Addressable, materialized into chordal Catmull-Rom runtime splines; six surface types (Asphalt 1.0, Kerb 0.85, Gravel 0.4, Grass 0.3, Runoff 0.6, PitLane); pit lane as a separate two-lane spline with 16 boxes at ~10m intervals; pit-progress → racing-progress mapping with the 90% anti-cut gate; elevation support (prototype pending item — production splines carry elevation per ADR-0007). S2 parallel with VP (zero dependency); delivers the first track early into the main so the Session-1 feel rig and later the AI epic can consume it.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0007: Track Spline Format | JSON schema-versioned spline format; chordal Catmull-Rom materialization; elevation-capable; Addressable | MEDIUM |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-track-001 | Track stored as JSON: spline, width, surface zones, pit lane, grid positions, metadata | ADR-0007 ✅ |
| TR-track-002 | 6 surface types: Asphalt (1.0), Kerb (0.85), Gravel (0.4), Grass (0.3), Runoff (0.6), PitLane | ADR-0007 ✅ |
| TR-track-003 | Pit lane: separate spline, two-lane F1 model, 16 boxes at ~10m intervals | ADR-0007 ✅ |
| TR-track-004 | Track JSON schema-versioned, Addressable, materialized into chordal Catmull-Rom runtime splines | ADR-0007 ✅ |
| TR-track-005 | Pit progress maps to racing progress; lap counting requires 90%-distance anti-cut gate | ADR-0007, ADR-0018 ✅ |

**Untraced requirements**: None — 5/5 covered by Accepted ADRs.

## Deliverables (this epic)

1. Track JSON schema + validator (authoring-time), schema-versioned.
2. Chordal Catmull-Rom runtime materialization (engine-free, in Overdrive.Content-adjacent or Track assembly decision per `/create-stories`).
3. Four MVP tracks: monaco, monza, silverstone, spa (Addressable — group topology exists: 4 Tracks groups + 16 Cars + Shared).
4. Pit lane, surface zones, grid positions per track; elevation where the MVP demands (ADR-0007).

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria of `design/gdd/track-system.md` are verified
- 4 tracks load via Addressables and materialize to runtime splines with correct surface/pit/grid semantics
- Pit progress mapping and anti-cut lap gate verified against the RSM (race-flow epic)
- All Logic and Integration stories have passing test files in `tests/`

## Next Step

Run `/create-stories track` to break this epic into implementable stories.