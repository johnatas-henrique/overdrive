# Review Log: Tire System — Overdrive

## Lean Review — 2026-07-24 — Verdict: NEEDS REVISION

Scope signal: M

Review boundary: MVP continuous wear, grip degradation, pit replacement, HUD/UI outputs, and shared Fuel/Vehicle Physics contracts. Additional compounds remain non-blocking future extensibility.

Specialists: none — lean mode.

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 3

Summary: Fresh lean re-review confirmed all prior findings were resolved. Cross-GDD consistency check found 3 RECOMMENDED issues: Tire wear per-tick recording claim (Tire says recorded, Ghost says derived), grip floor authority split (Tire vs Vehicle Physics), and grip_multiplier not listed as HUD outbound. All issues were corrected.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found recording and coupling gaps.

Blocking items: 8 | Recommended: 4
Prior verdict resolved: First review.

### Findings

| Finding | Severity | Resolution |
|---|---|---|
| Tire still used `difficulty_modifier` | Blocking | Removed it from Tire, Vehicle Physics, and the design registry; difficulty does not modify Tire rules in MVP. |
| `distance_factor` had no implementable formula | Blocking | Defined it as `clamp(speed_kmh / 300, 0, 1)`. |
| `gripBase` was unused | Blocking | Included `grip_base` in the compound-aware `tire_runtime_grip_multiplier` formula. |
| Wear variable mixed fraction and percentage semantics | Blocking | Standardized formulas on `wear_fraction` 0–1 and kept HUD output as 0–100%. |
| Pit Stop appeared twice and UI comparison lacked a consumer | Blocking | Consolidated Pit Stop interaction and added UI Menu for pre-race comparison. |
| Audio contract said pitch increased with wear | Blocking | Aligned Tire with Audio: constant 1200 Hz pitch and increasing normalized retrigger rate. |
| Grip-floor AC used 0% wear instead of 100% wear | Blocking | Corrected the AC to the bald-tire case. |
| Qualifying tire behavior was unresolved | Blocking | Propagated Qualifying's explicit rule: no tire wear during the flying lap; grip remains 100%. |
| Tire output name was generic | Recommended | Standardized the producer output as `tire_runtime_grip_multiplier`. |
| Shared grip registry ceiling was stale | Recommended | Updated grip stacking output to 0.20–1.20 and aligned the Tire producer note. |
| Settings was listed as runtime dependency | Recommended | Removed it; difficulty is setup data and does not enter the Tire formula. |
| Force-feedback language exceeded MVP scope | Recommended | Removed haptics/force-feedback dependency from the Tire contract. |

### MVP Contracts Confirmed

- Tire wear is continuous and linear.
- Wear uses distance/speed, aggression, surface penalty, and efficiency; difficulty does not modify wear.
- Tire produces `tire_runtime_grip_multiplier`; Vehicle Physics owns final grip stacking and the 0.20–1.20 clamp.
- Qualifying applies no tire wear.
- Pit service resets wear to 0% after the 2s tire swap, independently of remaining fuel service time.

### Files Revised During This Lean Review

- `design/gdd/tire-system.md`

## Lean Review — 2026-07-26 — Verdict: NEEDS REVISION (corrected)

Scope signal: M
Specialists: none — lean mode
Blocking items: 0 | Recommended: 1 (corrected)

Summary: Fresh lean re-review found 1 RECOMMENDED issue: Ghost Recording entry mismatch — Dependencies table said "Outbound — Tire wear per tick" but Interactions table correctly says "Indirect — Tire state derived from replay (not recorded per tick)". Corrected Dependencies entry to match.

Prior verdict resolved: Yes — all items from 2026-07-25 review resolved. This pass found the same Ghost Recording dependency table inconsistency found in Fuel System.

### Files Revised During This Lean Review

- `design/gdd/tire-system.md`

## Lean Review — 2026-07-25 — Verdict: NEEDS REVISION (corrected)

Scope signal: M
Specialists: none — lean mode
Blocking items: 2 | Recommended: 1

Summary: Re-review found 2 BLOCKING issues — surface_penalty formula range (1.0–2.5) contradicted tuning knob current value (3.0) and edge case reference (3.0), fixed by expanding range to 1.0–3.0; wearRateMultiplier field defined in TireCompound but not consumed by tire_wear_rate formula, fixed by adding it as a multiplier. Also fixed AI Rival interaction direction from Outbound to Bidirectional (AI reads tire wear for pit projection).

Prior verdict resolved: Yes — Ghost Recording mismatch from 2026-07-26 resolved. This pass found the surface_penalty range issue flagged in the cross-GDD review.

### Files Revised During This Lean Review

- `design/gdd/tire-system.md`

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed Tire System is internally stable and aligned with Vehicle Physics, Simulation Architecture, Fuel System, Pit Stop, AI Rival, and UI Menu. The pre-race tire comparison consumer is explicit and the review closes with no remaining issues.

Prior verdict resolved: Yes — the open Ghost Recording dependency-table mismatch was already corrected and no new issues were found in this pass.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed Tire System remains internally stable after removing the UI Menu pre-race comparison claim. The remaining dependencies stay reciprocal with Vehicle Physics, Simulation Architecture, Fuel System, Pit Stop, AI Rival, and Ghost Recording, and no new issues were found in this pass.

Prior verdict resolved: Yes — the UI Menu dependency claim was removed and the review closed cleanly.
