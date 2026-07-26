# Review Log: Camera — Overdrive

## Lean Review — 2026-07-24 — Verdict: NEEDS REVISION

Scope signal: L

Review boundary: MVP cockpit/chase framing, interpolation boundary, FOV, shake, collision avoidance, PitCamera, CameraToggle, and Reduced Motion. Future camera modes remained non-blocking.

Specialists: none — lean mode.

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: L

Specialists: none — lean mode

Blocking items: 0 | Recommended: 2

Summary: Fresh lean re-review confirmed all prior findings were resolved. Cross-GDD consistency check found 2 RECOMMENDED issues: Interpolated visual transform producer misattribution (Camera/VP claimed VP produces interpolated data, but SimArch owns interpolation) and VFX Impact Shake Request table headers mismatch. Both issues were corrected.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found data-flow attribution issues.

Blocking items: 4 | Recommended: 3
Prior verdict resolved: First review.

### Findings

| Finding | Severity | Resolution |
|---|---|---|
| Camera mode switching referenced an undefined mapped button | Blocking | Added `CameraToggle` to Input System and Settings, with C / North-Y-Triangle defaults; it is remappable and does not enter `SimulationInput`. |
| Pit Stop was missing from Camera's dependency graph despite PitCamera consuming `PitPhase` and the pit-box anchor | Blocking | Added Pit Stop to Camera interactions and dependencies. |
| FOV `speed_ratio` could exceed 1.0 when speed exceeded Top Speed | Blocking | Clamped `speed_ratio` to `[0,1]` in both the rule and formula and added AC-FOV6. |
| Collision sphere-cast could hit the player's own vehicle | Blocking | Explicitly excluded the player's vehicle colliders and trigger volumes. |
| Per-car cockpit offsets were an open MVP question | Decision | Resolved for MVP: offsets remain per-car tunable. Phase Scope was updated accordingly. |
| Motion mitigation was an open question | Decision | Added Reduced Motion to Camera and Settings; it disables shake, look-ahead, and dynamic FOV while preserving base FOV, blending, and collision avoidance. |
| Camera contract needed direct acceptance coverage for the new behavior | Recommended | Added AC-CM5 and AC-RM1; propagated the Reduced Motion setting and AC to Settings. |

### MVP Contracts Confirmed

- Camera reads interpolated visual transforms, never raw simulation state.
- `CameraToggle` is a camera-only gameplay action and is ignored in pit/service/terminal/replay contexts.
- PitCamera is active only during `InPitBox` and returns to the selected mode when `Exiting` begins.
- Reduced Motion preserves mode transitions and collision avoidance while disabling camera motion effects.

### Files Revised During This Lean Review

- `design/gdd/camera.md`
- `design/gdd/input-system.md`
- `design/gdd/settings.md`
- `design/gdd/systems-index.md`

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 1

Summary: Fresh lean re-review with exhaustive artifacts confirmed all prior findings were resolved. 8/8 sections present, 8/8 dependencies validated, 8/8 cross-GDD consistency checks pass. 1 RECOMMENDED issue: Overview (line 23) still says "reads interpolated visual transforms from Vehicle Physics" but interpolation is performed by Simulation Architecture. The Interactions table (line 161) was corrected in the prior review but the Overview was not. Corrected by updating Overview to attribute interpolation to Simulation Architecture.

Prior verdict resolved: Partially — the 2026-07-25 RECOMMENDED issue #1 (interpolation attribution) was only half-corrected (Interactions table fixed, Overview not). This pass completed the correction.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: L

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed Camera stays aligned with Simulation Architecture, Input System, Settings, Vehicle Physics, HUD, Audio, VFX, and Pit Stop. The document now cleanly matches the MVP visual-framing scope with no remaining blockers.

Prior verdict resolved: Yes — the tracker had remained on pending despite the earlier approved state.
