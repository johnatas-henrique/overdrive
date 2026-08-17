# Story 003: Runtime Quality Policy & Camera Parity

> **Epic**: VFX
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.0h

## Context

**GDD**: `design/gdd/vfx.md`
**Requirement**: `TR-vfx-003` (PerformanceReduced → Low), `TR-vfx-005` (Reduced Motion disables blur/shake; smoke caps)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0010: Camera-VFX Rendering Budget and Interpolation
**ADR Decision Summary**: PerformanceReduced → effective VFX density Low + minimum speed streaks remain visible; "no Simulation timing alteration" reduced to: VFX has no simulation-writer/timing-control interface and makes no timing calls. Reduced Motion → VFX consumes readonly resolved preferences and publishes Motion Blur disabled (preference immutability is Settings-owned — duplicate blur criterion removed from the particles story). Cockpit/chase parity: identical visual inputs + effective overrides → identical VFX output parameters (rendered parity deferred to Camera/VFX integration playtest).

**Engine**: Unity 6000.3.22f1 | **Risk**: HIGH
**Engine Notes**: Consumes PerformanceSignal (Reduced/Restored) + runtime preference resolver.

**Control Manifest Rules (this layer)**:
- Required: PerformanceReduced → Low density + min streaks; VFX never alters Simulation timing
- Required: Reduced Motion consumed readonly (Settings owns preference state)

---

## Acceptance Criteria

*From vfx.md + ADR-0010, scoped per QL-STORY-READY 2026-08-16 (policy split from particles):*

- [ ] **PerformanceReduced**: injected `PerformanceSignal.Reduced` → effective Low density + minimum speed streak visibility retained
- [ ] **No timing alteration**: VFX has no simulation-writer/timing-control interface and makes no timing calls (the full "no Simulation timing alteration" gate is a Simulation/VFX integration gate)
- [ ] **Reduced Motion**: injected resolved Reduced Motion preference → Motion Blur disabled; the input preference snapshot is not mutated (immutability/restoration is Settings-owned — AC-CAM6/AC-E10)
- [ ] **Camera parity**: identical visual inputs + effective overrides → VFX output parameters identical for Cockpit and Chase (rendered parity deferred to a Camera/VFX integration playtest)

---

## Implementation Notes

*Derived from ADR-0010 Implementation Guidelines:*

- PerformanceSignal (Reduced/Restored) is Simulation's — VFX consumes it
- VFX is a pure consumer: no simulation-writer or timing-control surface exists (the ADR's "does not alter Simulation timing" is enforced by the absence of such an interface)
- Reduced Motion duplicate removed from the particles story — Settings owns preference resolution (AC-CAM6/AC-E10), VFX consumes readonly
- Parity: output parameters, not rendered frames — rendered parity is a Camera/VFX integration playtest

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [Simulation]: PerformanceReduced production
- [Settings]: Reduced Motion preference resolution/persistence (AC-CAM6/AC-E10)
- [Camera epic]: shake suppression (its own story)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-PERF**: inject Reduced → effective density Low, minimum streaks enabled
- **AC-NO-TIMING**: VFX interface scan → no simulation-writer/timing-control calls
- **AC-REDUCED**: inject Reduced Motion preference → blur disabled; input snapshot unchanged
- **AC-PARITY**: identical inputs in Cockpit + Chase → VFX output parameters match (rendered differences recorded as integration evidence)

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/vfx/VfxPolicyTests.cs` — performance/reduced-motion/parity with fakes
- Playtest: Camera/VFX integration playtest evidence (rendered parity)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001/002 (effects), Simulation (PerformanceSignal), Settings (preference resolver), Camera (mode context)
- Unlocks: full VFX composition
