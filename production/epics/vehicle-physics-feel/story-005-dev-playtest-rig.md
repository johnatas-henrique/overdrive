# Story 005: Dev Playtest Rig

> **Epic**: Vehicle Physics — Feel & Telemetry
> **Status**: Ready
> **Layer**: Core
> **Type**: Integration
> **Manifest Version**: 2026-08-05
> **Estimate**: 2.0h

## Context

**GDD**: `design/gdd/vehicle-physics.md` (the feel is validated in motion — prototype race-feel REPORT.md is the source of truth)
**Requirement**: Epic deliverable — the hard acceptance gate per PR-EPIC 2026-08-16 (bridge 3 of the 2-orchestrator plan)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0002 (the rig exercises the real VP path); ADR-0001 (manual accumulator); ADR-0003 (content load for one track + one car)
**ADR Decision Summary**: The dev playtest rig is a DEVELOPMENT harness — a minimal scene composing kernel + driver + input + one track + one car + a development camera adapter. It unblocks visual/feel verification of the S2 Phase-3 epics (Camera, HUD, Audio, VFX) before the production bootstrapper (UI Menu) exists. The camera adapter must be replaceable by the Camera epic's implementation.

**Engine**: Unity 6000.3.22f1 | **Risk**: HIGH
**Engine Notes**: Game View sandbox — `screenshot-game-view` evidence. One real track fixture + one real car fixture via the Content pipeline.

**Control Manifest Rules (this layer)**:
- Required: the rig is a dev harness, NOT the production composition (production bootstrapper = UI Menu epic, TD-038)
- Required: rig evidence = integration tests + Game View/manual verification

---

## Acceptance Criteria

*Per QL-STORY-READY 2026-08-16 (split of the original telemetry+rig story):*

- [ ] Minimal dev scene: kernel + driver + input + **one real track fixture** + **one real car fixture** + development camera adapter
- [ ] Playable critical path: input reaches the kernel, the car moves on the track, telemetry updates, and the camera renders a playable Game View
- [ ] Rig evidence: integration tests (kernel→driver→car→telemetry chain) + Game View screenshot/manual evidence
- [ ] Camera adapter replaceable by the Camera epic implementation (explicit adapter seam — no rig-coupled camera logic)
- [ ] Feel verification in motion: lift-off rotation degrees (Story 001 — 5-10° at 70% speed), drift visibility (Story 002), and longitudinal benchmark (Story 003 — CP1/CP2 cross-epic: 0→vmax timing) recorded with evidence

---

## Implementation Notes

*Derived from ADR-0001/0002/0003 Implementation Guidelines:*

- Reuses the Foundation composition: ContentCompositionRoot (one car + one track — Addressable keys CarDefinition/TrackData exist), SimulationDriver + kernel, InputContextController
- The rig scene lives under `Assets/Scenes/` (dev-only, not in the production bootstrapper path)
- Evidence file `production/qa/evidence/vehicle-physics-feel-rig-evidence.md` captures: screenshot, feel observations (lift-off/drift/launch), benchmark numbers (0→vmax, top speed vs stat formula)
- This is the S2 Phase-3 unblocker (bridge 3) — Camera/HUD/Audio/VFX plug into the rig as they ship

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [ui-menu epic]: production bootstrapper (replaces the rig — TD-038)
- [camera/hud/audio/vfx epics]: consumer implementations (plug into the rig)
- [track / car-definition-data epics]: the fixtures themselves (consumed here)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (critical path)**: saved dev scene launches → input reaches kernel, car moves on track, telemetry updates, camera renders playable view; edge: zero input, scene reload, missing optional presentation consumer, compilation failure
- **AC-2 (adapter seam)**: camera adapter is replaceable (contract documented; the Camera epic can swap in)
- **AC-3 (feel evidence)**: lift-off/drift/launch verified in motion with recorded evidence (screenshot + notes)
- **AC-4 (benchmark)**: 0→vmax and top-speed vs stat formula recorded (CP1/CP2 cross-epic)

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: `Assets/tests/integration/simulation/VehiclePhysicsTests.cs` (rig chain) OR playtest doc
- Visual/Feel: `production/qa/evidence/vehicle-physics-feel-rig-evidence.md` + sign-off

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 004 (telemetry contracts), vehicle-physics-dynamics (all), track + car-definition-data (fixtures — S2 F1)
- Unlocks: S2 Phase-3 epics (Camera/HUD/Audio/VFX plug into the rig)
