# Epic: Vehicle Physics — Feel & Telemetry

> **Layer**: Core
> **GDD**: design/gdd/vehicle-physics.md
> **Architecture Module**: Vehicle Physics (validated-feel values + telemetry readout consumed by Camera/HUD/Audio/VFX; playtest rig owner)
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories vehicle-physics-feel`
> **Estimate**: 4 stories (~10h active — calibrated 0.3×, sprint-3 retrospective)
> **Session**: S1 · Phase 1 (2-orchestrator plan 2026-08-16)
> **Depends on**: vehicle-physics-dynamics (stable CarState); prototype race-feel (values are source of truth — prototypes/race-feel/REPORT.md); ADR-0002; telemetry consumers' data contracts (ADR-0014 HUD, ADR-0010 camera, ADR-0012 audio)

## Overview

The taste half of Vehicle Physics: the validated tuning values from the race-feel prototype (lift-off +3.0g bonus, steering falloff curves, drift factor, longitudinal engine-power-over-speed and quadratic drag) implemented on top of the deterministic dynamics cell — plus the **telemetry readout contract** that unblocks the presentation consumers (pose, speed, RPM, drift, fuel/tire state exposure) and the **dev playtest rig** (minimal scene composing kernel + driver + input + one track + one car + camera), which is the hard acceptance gate of this epic per PR-EPIC (2026-08-16). The rig is a DEVELOPMENT harness — production bootstrapper is UI Menu (TD-038).

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0002: Vehicle Physics Implementation Pattern | Deterministic forces + interpolation pattern — feel values ride the same deterministic path | HIGH |
| ADR-0014: HUD Data Contract and Layout | Authoritative per-element data owners and update cadence — telemetry readout feeds the HUD | LOW |
| ADR-0010: Camera/VFX Rendering Budget and Interpolation | Camera follows velocity direction; VFX threshold — telemetry readout feeds both | MEDIUM |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-vp-005 | Lift-off rotation with 0.3s anti-spam cooldown | ADR-0002 ✅ |
| TR-vp-007 | Lift-off adds fixed +3.0g in both yaw-request and velocity-rotation consumers | ADR-0002 ✅ (prototype-validated) |
| TR-vp-008 | Drift activation uses the validated track-radius factor and driftHeadBoost behavior | ADR-0002 ✅ (prototype-validated) |
| TR-vp-009 | Longitudinal acceleration uses the validated engine-power-over-speed and quadratic-drag formulas | ADR-0002 ✅ (prototype-validated) |

**TR partition note**: dynamics TRs (001-004, 006, 010) belong to `vehicle-physics-dynamics`; see that epic's partition note.

**Untraced requirements**: None — 4/4 covered by Accepted ADRs (10/10 across both VP epics).

## Deliverables (this epic)

1. Feel implementations of TR-vp-005/007/008/009 with prototype values (REPORT.md is source of truth).
2. **Telemetry contract**: readout structs for Camera (pose + velocity direction), HUD (speed/gear/position/fuel/tire/lap/rival), Audio (RPM → `IEngineSoundProvider`), VFX (global_max_velocity).
3. **Dev playtest rig** (deliverable gate): kernel + driver + input + one track + one car + camera — Game View sandbox for S2 Phase-3 visual epics (bridge 3 of the 2-orchestrator plan).
4. Feel verification: playable feedback loops (not just unit) validated in the rig.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria of the feel subset of `design/gdd/vehicle-physics.md` are verified (lift-off feel, steering, drift factor, longitudinal)
- The telemetry readout contract is published with a documented data shape consumed by Camera/HUD/Audio/VFX
- The dev playtest rig is playable (drive one car on one track with a camera) — the hard gate between Dynamics and Feel per PR-EPIC
- All Logic/Feel stories have passing tests; feel tuning has rig-verified evidence (screenshot/playtest) in `production/qa/evidence/`

## Next Step

Run `/create-stories vehicle-physics-feel` to break this epic into implementable stories.