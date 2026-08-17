# Story 007: Track Authoring Tool

> **Epic**: Track
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 2h

## Context

**GDD**: `design/gdd/track-system.md`
**Requirement**: track-system.md (trackside/scenery placement) — `TR-track-XXX` registered with Story 006 at closure
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0007: Track Spline Format (spline is the placement origin); ADR-0003 (content pipeline — Shared group sourcing)
**ADR Decision Summary**: Editor-only authoring tool (`Overdrive.Content.Editor`-style assembly) that materializes the authored spline visually in the editor and lets the author place trackside prefabs (Shared group, ASSET-101..115) along it with full transform control. The tool writes the placement manifest into the TrackData JSON (Story 006 format) — the Unity editor is the AUTHORING surface, the JSON is the product; the runtime never reads scenes or tool state. The visual mesh of downloaded reference circuits (GP 1988 pack, Spa CC-BY) is NEVER imported as an authoring base or game asset — it is an external reference the author looks at while placing our own prefabs.

**Engine**: Unity 6000.3.22f1 | **Risk**: MEDIUM
**Engine Notes**: Editor-only assembly (platform: Editor) — same pattern as `AddressAssignmentTool` / `ContentTopologyValidator`; nothing from this story ships in the runtime build. Runtime reads only the JSON.

**Control Manifest Rules (this layer)**:
- Required: tool serializes via Story 006 validation (no duplicated validation logic — call the shared validator)
- Required: spline preview is tool-only (gizmos/materialized preview), never in the runtime build

---

## Acceptance Criteria

*Derived from the 2026-08-16 track authoring decision; scoped per QL-STORY-READY:*

- [ ] Authoring scene opens with the spline of a loaded TrackData materialized visually (gizmo/mesh preview) — editor-only; a guardrail test confirms the tool assembly never compiles into the runtime build
- [ ] Placing a trackside prefab snaps to the spline (initial rotation from tangent + initial position from splineOffset/side hint) then remains freely adjustable (move/rotate/scale) — the stored placement is the full transform, hints are authoring-only
- [ ] The Shared palette (ASSET-101..115) is resolved from Addressables editor APIs; unknown assetIds are not placeable
- [ ] Saving the manifest calls the Story 006 validator inline (invalid entries flagged in the tool UI, never silently written)
- [ ] Roundtrip: save → reload TrackData → placement identical (byte-stable with Story 006)
- [ ] No scene/prefab state leaks into the runtime: the runtime build contains zero tool code; the tool creates no runtime-scene dependencies

---

## Implementation Notes

*Derived from the 2026-08-16 track authoring decision:*

- Error flags reuse Story 006's validator — the tool surfaces `ContentLoadError(Track)`-equivalent messages inline (assetId + failing field)
- The reference circuit meshes (GP 1988 mods, Spa CC-BY) are NOT imported into the authoring scene as game objects — they are external visual references, consistent with the 2026-08-16 licensing decision (reference-for-observation only, no redistribution of mod meshes)
- Structure mirrors `AddressAssignmentTool` (editor window + serialization) and `ContentTopologyValidator` (validation reuse)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 006]: manifest format + validation rules (the tool consumes them)
- [Story 008]: runtime assembly (the tool never runs in the game)
- [content-pipeline epic]: Shared group topology / Addressables setup

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (spline preview)**: loaded TrackData → materialized preview in the authoring scene; tool assembly excluded from runtime build (guardrail)
- **AC-2 (snap then free)**: place at offset/side → initial transform from tangent+hint; manual adjust → saved transform is the adjusted one
- **AC-3 (palette)**: ASSET-101..115 placeable; unknown assetId not placeable
- **AC-4 (inline validation)**: invalid placement (non-finite, scale ≤ 0) → flagged in UI, not written
- **AC-5 (roundtrip)**: save → reload → identical
- **AC-6 (isolation)**: runtime build has zero tool code

---

## Test Evidence

**Story Type**: Integration (editor tooling)
**Required evidence**:
- Editor tests: `Assets/tests/editor/track/TrackAuthoringToolTests.cs` — snap math (pure), serialize roundtrip, palette resolution, validator reuse, runtime-isolation guardrail (mirrors `ContentTopologyTests` pattern)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 006 (manifest format + validator), Story 002 (spline materialization used for the preview), ASSET-101..115 (Shared palette), content-pipeline editor tooling pattern
- Unlocks: Story 008 (plus production authoring of the 4 MVP tracks)