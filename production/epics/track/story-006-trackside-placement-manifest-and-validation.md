# Story 006: Trackside Placement Manifest & Validation

> **Epic**: Track
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/track-system.md`
**Requirement**: track-system.md (trackside/scenery placement) — `TR-track-XXX` to be registered at closure (precedent: TR-content-009 registered at story 3-14 closure; no trackside TR exists in the registry today)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0007: Track Spline Format (§Runtime API — spline is the placement origin)
**ADR Decision Summary**: The trackside placement manifest is a JSON array inside `TrackData`: each entry carries the FULL authored transform — `{ assetId, position (x,y,z local track space), rotation (x,y,z euler, free), scale (uniform) }`. An optional authoring-hint block (`splineOffset`, `side`) initializes tool snapping but is NOT the stored placement (pit building, distant trees, and curved-barrier rotations are not derivable from "side of spline"). Each entry is independent: the same assetId may appear at many positions/rotations. The manifest is optional data — a track without entries builds with zero trackside (not an error). The manifest is validated at load with the same fail-fast contract as the spline itself.

**Engine**: Unity 6000.3.22f1 | **Risk**: LOW
**Engine Notes**: Pure data model + validation — no engine-specific APIs; the validator is shared by the authoring tool (Story 007) and the load path (Story 001/008).

**Control Manifest Rules (this layer)**:
- Required: full transform per instance (position + rotation + scale); splineOffset/side are authoring hints only
- Required: unknown/duplicate assetId and non-finite transforms rejected at load → `ContentLoadError(Track)` naming the failing entry

---

## Acceptance Criteria

*Derived from track-system.md placement requirements + the 2026-08-16 authoring decision; scoped per QL-STORY-READY:*

- [ ] A placement manifest with `{ assetId, position, rotation, scale }` entries deserializes to a typed `TracksidePlacement[]` preserving exact float values (transform-complete contract — no derived placement)
- [ ] The same `assetId` may appear at multiple positions/rotations (independent instances); duplicate exact position+rotation+scale for the same assetId within tolerance → rejected (accidental double-placement)
- [ ] Unknown assetId (not resolvable to a Shared prefab address), non-finite position/rotation, or scale ≤ 0 → `ContentLoadError(Track)` with assetId + failing field; no partial manifest returned
- [ ] A track without a placement manifest (or with an empty array) loads successfully with zero trackside — absence is valid, never fatal
- [ ] Roundtrip: serialize → deserialize → identical JSON (the tool writes, the runtime reads, byte-stable)
- [ ] Authoring hint block (`splineOffset`, `side`) is optional and non-positional: present or absent changes nothing in the resolved placement

---

## Implementation Notes

*Derived from the 2026-08-16 track authoring decision:*

- The validator is a pure static class (like `ContentTopologyValidator`) — reused by the authoring tool (Story 007) and the load path; never duplicated
- The `assetId` set is resolved from the Shared group addresses (ASSET-101..115 today — extensible ranges, not a cap; e.g. ASSET-116..140 or a 2xx range for future categories)
- Field names are camelCase and EXACTLY match the C# fields (JsonUtility contract from Story 001 — the 2026-08-05 snake_case rejection applies here too)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 001]: TrackData JSON schema + loading (this story extends it with the manifest section)
- [Story 007]: the authoring tool that writes the manifest
- [Story 008]: runtime instantiation of manifest entries
- [content-pipeline epic]: Shared group topology (shipped 3-8)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (transform contract)**: manifest with full transforms → exact float values preserved; edge: negative coords, rotated barrier at curved section (e.g. rotation y=12.5)
- **AC-2 (multi-instance)**: same assetId 3× with different transforms → 3 independent placements; duplicate exact transform → rejected
- **AC-3 (validation)**: unknown assetId / non-finite / scale ≤ 0 → ContentLoadError(Track) with field; no partial
- **AC-4 (absent manifest)**: track without manifest → loads with 0 trackside, no error
- **AC-5 (roundtrip)**: serialize → deserialize → byte-identical
- **AC-6 (hint non-positional)**: with and without `splineOffset`/`side` → identical resolved placement

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/content/TracksidePlacementTests.cs` — manifest parse, validation, roundtrip, hint non-positionality
- Integration companion: `Assets/tests/integration/content/TrackDataTests.cs` (manifest section of the load path)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (TrackData JSON schema/loading), ASSET-101..115 specs (Shared asset catalog)
- Unlocks: Story 008 (runtime assembly consumes the validated manifest)