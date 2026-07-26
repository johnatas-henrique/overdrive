# Review Log: Audio System — Overdrive

## Lean Review — 2026-07-24 — Verdict: NEEDS REVISION

Scope signal: L

Review boundary: MVP procedural engine, race SFX, ambience, event stings, local state/events, and direct Car Definition audio-profile contract. Adaptive music, spatial audio, and future memory-budget work remain non-blocking.

Specialists: none — lean mode.

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: L

Specialists: none — lean mode

Blocking items: 0 | Recommended: 2 | Minor: 1

Summary: Fresh lean re-review confirmed all prior findings were resolved. Cross-GDD consistency check found 2 RECOMMENDED issues (UI audio layer undefined, Camera mode → audio mix missing) and 1 Minor issue (Fuel System defers pitch curve to "Audio director" but Audio System already has concrete values). All issues were corrected.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found layer and mix attribution gaps.

Blocking items: 8 | Recommended: 4
Prior verdict resolved: First review.

### Findings

| Finding | Severity | Resolution |
|---|---|---|
| Engine pitch AC omitted cylinder count | Blocking | AC now names a 10-cylinder reference profile and calculates approximately 5667 Hz at 8000 RPM in fourth gear. |
| Car Definition did not provide `cylinders` or `engine_type` | Blocking | Added `engineCylinders` and `engineType` to the Car Definition storage/interface contract; concrete per-team values remain in the Car Definition owner review. |
| Engine output minimum was inconsistent with formula bounds | Blocking | Documented unclamped 16–16800 Hz bounds and audible clamp at 40–20000 Hz. |
| Tire squeal volume contradicted its stated new-tire behavior | Blocking | Added a 0.25 minimum wear factor and made the retrigger multiplier explicitly unitless. |
| Wall-impact high-speed frequency range was reversed | Blocking | Corrected high-speed range to 800–1000 Hz. |
| Countdown still used a 3-2-1 contract | Blocking | Aligned audio to five one-second beeps/lights and GO after the fifth light. |
| Pit and terminal audio states were too coarse | Blocking | Split PitTransit/Exiting, InPitBox, Finished Presentation, and Results. |
| Simulation and RSM were missing direct dependencies | Blocking | Added state, countdown, terminal, lap, final-lap, and finish-event contracts. |
| Audio target parameters were updated only at physics rate | Recommended | Engine targets now smooth at DSP rate from physics-tick snapshots. |
| Two-oscillator model lacked a second-oscillator formula | Recommended | Added the harmonic frequency formula. |
| Pit service sting question was unresolved | Recommended | MVP uses the existing Pit Entry sting; a separate service sting is deferred. |
| Engine sound differentiation question was unresolved | Recommended | Ownership resolved through Car Definition audio fields and Audio procedural interpretation. |

### MVP Contracts Confirmed

- Car Definition owns `engineCylinders` and `engineType`; Audio owns procedural interpretation.
- Countdown audio uses five one-second beeps/lights and GO after the fifth light.
- Audio consumes Simulation and Race Session Manager state/events directly.
- PitTransit/Exiting, InPitBox, Finished Presentation, and Results have separate audio behavior.
- Tire squeal retains an audible floor on new tires and increases its normalized retrigger rate with wear.

### Files Revised During This Lean Review

- `design/gdd/audio-system.md`
- `design/gdd/car-definition-data.md`
- `design/gdd/systems-index.md`

## Review — 2026-07-25 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review with exhaustive artifacts confirmed all prior findings were resolved. 8/8 sections present, 10/10 dependencies validated, 10/10 cross-GDD consistency checks pass. Internal consistency verified: all data-flow claims across Overview, Rules, Interactions, and Dependencies are consistent. Non-MVP constraint check passes. All prior review findings resolved.

Prior verdict resolved: Yes — all 2 RECOMMENDED + 1 Minor findings from the 2026-07-25 NEEDS REVISION review were resolved (UI audio layer, Camera mode mix, Fuel pitch curve).
