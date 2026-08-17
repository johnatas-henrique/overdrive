# Story 008: Runtime Trackside Assembly

> **Epic**: Track
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.5h

## Context

**GDD**: `design/gdd/track-system.md`
**Requirement**: track-system.md (trackside/scenery placement) — `TR-track-XXX` registered with Story 006 at closure
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0007 (spline is the placement origin); ADR-0003 (§content pipeline — Addressables seams, Shared group)
**ADR Decision Summary**: When a race assembles the track (Story 002 materializes the racing mesh from the spline), the trackside assembly iterates the validated placement manifest (Story 006) and instantiates each entry's prefab from the Shared group at its full authored transform. Prefabs are sourced through the shipped Addressables seams (3-10/3-11 release discipline): handles are retained while the track is mounted, released on unload/next-track. The racing mesh from the spline remains the gameplay/collision surface — trackside instances never define driving surfaces. Order of instantiation follows the manifest order (deterministic); the same input yields the same mounted track.

**Engine**: Unity 6000.3.22f1 | **Risk**: MEDIUM
**Engine Notes**: Unity-backed assembly (Overdrive.Content.Unity-style) — Addressables handle retention/release via the shipped loader seams; transform application is plain `Transform.SetPositionAndRotation` + local scale.

**Control Manifest Rules (this layer)**:
- Required: manifest order drives instantiation (deterministic); handles retained while mounted, released on unload/next-track (ADR-0003 release order: instances first, then handles)
- Required: trackside prefabs never affect racing physics/collision semantics (visual/environment layer only)

---

## Acceptance Criteria

*Derived from track-system.md + the 2026-08-16 authoring decision; scoped per QL-STORY-READY:*

- [ ] Mounting a track instantiates every manifest entry at its exact authored transform (position/rotation/scale) through the Shared Addressables group — no derived/repositioned placement
- [ ] Instantiation follows manifest order and is deterministic: same TrackData → same mounted track (transforms byte-exact)
- [ ] Handles for loaded trackside prefabs are retained while the track is mounted and released on unload / next-track assembly — release order per ADR-0003:100-105 (instances first, then base handles)
- [ ] A trackside instance's colliders are active but never define racing surface semantics (physics/surface lookup comes from the spline mesh, Story 002)
- [ ] Reconfiguring to another track destroys the previous trackside instances and releases their handles — no leak across sessions (verified with the operation-log pattern from 3-11)
- [ ] Trackside assembly is logic-only enemy of the track: with an empty/manifest-absent track it mounts with zero instances (no error — Story 006 contract)

---

## Implementation Notes

*Derived from the 2026-08-16 track authoring decision:*

- Reuses `IContentInstantiator` + the release-order discipline from the content pipeline (3-10/3-11) — trackside is another Shared consumer, not a new system
- The visual reference meshes (GP 1988 / Spa CC-BY) never enter this path as game objects — only our Shared prefabs are instantiated (licensing decision 2026-08-16)
- The assembly composes with `TrackMaterializer` (Story 002): racing mesh first, trackside after, both rooted under the track instance owned by the runtime (3-10)

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Story 002]: racing mesh materialization from the spline (this story composes with it)
- [Story 006]: manifest format + validation
- [Story 007]: authoring tool
- [content-pipeline epic]: Shared group topology / Addressables setup

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (exact transform)**: manifest entries → instances at exact authored transforms (float-exact assert)
- **AC-2 (determinism)**: same TrackData mounted twice → identical instances/order
- **AC-3 (release)**: unload/next-track → instances destroyed + handles released in ADR-0003 order (operation-log)
- **AC-4 (no racing semantics)**: trackside colliders never sampled as driving surface
- **AC-5 (reconfigure)**: track A → track B → A's trackside destroyed, B's mounted, no leak
- **AC-6 (empty manifest)**: mount with zero entries → zero instances, no error

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/content/TrackAssemblyTests.cs` — real composition root + manifest fixture: exact transforms, order, release order via operation-log, reconfigure no-leak (mirrors `RaceLoadIntegrationTests` harness)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 002 (racing mesh/composition), Story 006 (validated manifest), content pipeline (3-10/3-11 Addressables seams + release discipline)
- Unlocks: playtest rig floor (free/cars render on a fully mounted track), production track authoring (with Story 007)