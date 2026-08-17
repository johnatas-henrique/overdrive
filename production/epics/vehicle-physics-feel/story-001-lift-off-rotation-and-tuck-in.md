# Story 001: Lift-Off Rotation & Tuck-In

> **Epic**: Vehicle Physics — Feel & Telemetry
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 1.0h

## Context

**GDD**: `design/gdd/vehicle-physics.md`
**Requirement**: `TR-vp-005` (lift-off rotation), `TR-vp-007` (+3.0g lift-off bonus)
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**: ADR-0002: Vehicle Physics Implementation Pattern
**ADR Decision Summary**: Lift-off grip bonus (tuck-in, validated 2026-08-03): fixed +3.0 g to maxLateralAccel when throttle ≤ 0, applied in BOTH the yaw request (ComputeMaxYaw) and the velocity rotation rate (SetInput). Fixed g (not %) gives weaker cars proportionally more cornering speed — an excellent driver in a weak car can fight. Anti-spam: requires throttle held ≥0.3s before next activation (GDD AC-L3).

**Engine**: Unity 6000.3.22f1 | **Risk**: HIGH
**Engine Notes**: Pure C# math (29.43 m/s² = 3.0 × 9.81). No engine-specific APIs.

**Control Manifest Rules (this layer)**:
- Required: lift-off grip bonus fixed +3.0g to maxLateralAccel when throttle ≤ 0, applied in BOTH the yaw request and the velocity rotation rate
- Required: anti-spam — activation requires throttle held ≥0.3s (18 ticks at 60 Hz) before the next activation

---

## Acceptance Criteria

*From GDD + ADR-0002, scoped per QL-STORY-READY 2026-08-16:*

- [ ] Given throttle ≤ 0 and steering active, the feel layer emits exactly **+3.0g (29.43 m/s²)** to BOTH consumers: the yaw-request lateral-capacity input and the velocity-rotation lateral-capacity input (seam-level assertion — final velocity rotation belongs to Dynamics)
- [ ] Given throttle > 0, neither consumer receives the lift-off bonus
- [ ] Anti-spam: at 60 Hz the next activation requires ≥18 continuously-held throttle ticks (0.3s) — 17-tick hold must NOT activate; the boundary at exactly 18 ticks is defined (activates)
- [ ] Runtime degree assertions replaced by deterministic output assertions with fixed speed/steer/grip/FIXED_DT fixtures (the 5-10° / <2° visual checks move to the rig evidence, Story 005)

---

## Implementation Notes

*Derived from ADR-0002 Implementation Guidelines:*

- The bonus is a modifier on `maxLateralAccel` consumed by `ComputeMaxYaw` (yaw request) and the velocity rotation rate — the Feel layer computes the modifier; the Dynamics consumers apply it
- `liftOffSteerBonus 0.5` (global knob) belongs to the tuning config — consumed, not hardcoded
- Activation requires a throttle *held* period: the transition from held → released while steering active; taps shorter than the hold requirement do not re-arm
- The story owns the modifier seam and the anti-spam state machine; the Feel verification (rotation degrees in the rig) is Story 005's evidence

---

## Out of Scope

*Handled by neighbouring stories — do not implement here:*
- [vehicle-physics-dynamics Story 004]: ComputeMaxYaw application of the bonus (consumes this modifier)
- [Story 005]: playtest-rig rotation-degree evidence (5-10° / <2°)
- [Story 002]: drift factor (shares the yaw/velocity consumers — do not conflate)

---

## QA Test Cases

*Written by qa-lead at story creation.*

- **AC-1 (+3.0g both consumers)**: throttle zero + steering active → both yaw and velocity-rotation inputs contain 29.43 m/s² bonus; edge: throttle exactly zero, nonzero brake, zero speed
- **AC-2 (acceleration suppresses)**: throttle > 0 → no bonus to either consumer; edge: throttle epsilon above zero, clamped throttle
- **AC-3 (anti-spam 0.3s)**: after an activation, holds of 17/18/19 ticks before release → only 18+ activate; edge: repeated taps, zero-length hold, hold across a state reset

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `Assets/tests/unit/simulation/VehiclePhysicsTests.cs` (modifier seam + anti-spam)
- Rig evidence (degrees): Story 005 (`production/qa/evidence/vehicle-physics-feel-rig-evidence.md`)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: vehicle-physics-dynamics Story 004 (ComputeMaxYaw consumer)
- Unlocks: Story 002 (drift shares the consumers), Story 005 (rig verification)
