# Quick Design Spec: Camera Chase Follows Velocity Direction

**Type**: Tweak
**System**: Camera
**GDD Reference**: `design/gdd/camera.md` — Detailed Design → Chase
**Date**: 2026-08-05

## Change Summary

The chase camera rotation must follow the car's horizontal VELOCITY direction
instead of its heading. When the car drifts (heading diverges from trajectory),
the velocity-based camera shows the car sideways on screen — the drift is
visible. Heading-based rotation rotates with the car and masks the slip angle,
which the race-feel prototype showed hides the most expressive part of the
driving (validated 2026-08-03, user-approved).

## Motivation

The race-feel prototype proved that drift is only perceivable when the camera
follows the trajectory (velocity), not the car's facing (heading). This is a
core Directional Velocity requirement: the camera must not mask motion.

## Design Delta

Current GDD says (quoting `design/gdd/camera.md`, Detailed Design → Chase):

> - Rotation: Follows car's heading with 0.12s response lag (7.5 frames at 60 FPS). Pitch damped to 40%.

This spec changes that to:

> - Rotation: Follows the car's horizontal VELOCITY direction (not heading) with 0.12s response lag (7.5 frames at 60 FPS). Pitch damped to 40%. When heading and velocity diverge (drift), the car appears sideways on screen — the drift must be visible, not masked by the camera (race-feel prototype validation 2026-08-03). Below a low-speed threshold, maintain the last filtered velocity direction instead of switching to heading (no heading fallback while moving).

## New Rules / Values

- Chase camera rotation target = the car's horizontal velocity direction
  (`Rigidbody.linearVelocity` projected on XZ, normalized).
- Response lag 0.12s (unchanged), pitch damping 40% (unchanged).
- Low-speed threshold: below the defined threshold, keep the last filtered
  velocity direction (EMA-filtered) — no heading fallback while moving.
- The same applies to camera look-ahead: look-ahead points along the velocity
  direction (ADR-0010: `lookAheadOffset = velocityDirection × speed × lookAheadFactor`).

## Affected Systems

| System | Impact | Action Required |
|--------|--------|-----------------|
| Camera | Chase rotation target changes from heading to velocity | Update GDD (camera.md) |
| Camera-VFX (ADR-0010) | Look-ahead direction (`forward` → velocityDirection) | Update ADR-0010 |
| Vehicle Physics | No change — the camera consumes the interpolated visual transform | No action |

## Acceptance Criteria

- [ ] With the car drifting (heading ≠ velocity), the chase camera shows the car sideways on screen
- [ ] On a straight, the camera follows the trajectory without oscillation
- [ ] At low speed (below threshold), the camera holds the last direction — no snapping to heading
- [ ] No regression: camera shake, FOV response, mode blending unchanged

## GDD Update Required?

Yes — `design/gdd/camera.md`, Detailed Design → Chase rotation line. Exact
old/new shown in Design Delta above.
