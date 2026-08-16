# Car Definition Data Review Log

## Review — 2026-07-24 — Verdict: NEEDS REVISION
Scope signal: L
Specialists: None (lean review)
Blocking items: 5 | Recommended: 2
Summary: The lean review found that Car Definition still allowed Difficulty to alter vehicle formulas despite the approved AI decision, contained incorrect Top Speed examples, referenced a nonexistent Car Differentiation system, disagreed on the corrupted-stat fallback, and introduced audio-profile fields without a default profile. The correction batch fixed the MVP Top Speed baseline at 250–310 km/h, recalculated the shared AI value, removed the broken dependency, unified the fallback at stat 12, and added a default 10-cylinder V10 profile with per-team overrides.
Prior verdict resolved: First review

Corrections applied:

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 1

Summary: Fresh lean re-review confirmed all prior findings were resolved. Cross-GDD consistency check found 1 RECOMMENDED issue: Car Definition Data defines `cornering_speed` formula for Grip Level stat but Vehicle Physics uses `grip_base` without documenting the mapping. The documentation was added.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found a documentation gap about Grip Level → grip_base mapping.
- Difficulty no longer changes Car Definition stat formulas.
- Top Speed examples and acceptance criteria now use the fixed MVP baseline.
- Audio profile fields are part of the ScriptableObject schema and have an explicit fallback.
- Status remains Revised — Pending Re-review.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed Car Definition Data remains internally stable after the Fuel base-rate update and stays aligned with Vehicle Physics, Fuel, Tire, AI Rival, Content Pipeline, Settings, and Race Session Manager. The example values and shared efficiency mapping are explicit and the review closes with no remaining issues.

Prior verdict resolved: Yes — the fuel base-rate example was updated and no new issues were found in this pass.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed Car Definition Data remains internally stable after the Fuel base-rate update and stays aligned with Vehicle Physics, Fuel, Tire, AI Rival, Content Pipeline, Settings, and Race Session Manager. The example values and shared efficiency mapping are explicit and the review closes with no remaining issues.

Prior verdict resolved: Yes — the fuel base-rate example was updated and no new issues were found in this pass.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: M

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed Car Definition Data is internally consistent, implementable, and aligned with Vehicle Physics, Fuel, Tire, AI Rival, Content Pipeline, Settings, and Race Session Manager. The stat ladder, formulas, defaults, and UI-facing contracts are explicit and the review closes with no remaining issues.

Prior verdict resolved: Yes — the formula example and direction convention issues from prior reviews were already corrected and no new issues were found in this pass.

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: M

Specialists: none — lean mode

Blocking items: 5 | Recommended: 1

Summary: Lean re-review found 5 BLOCKING issues: Brake Power formula examples don't match formula (stat 4: 64m→70m, stat 8: 56m→60m), Grip Level formula example doesn't match (stat 4: 144→136 km/h), Interactions table direction convention inverted for VP/Fuel/Tire/AI (says Inbound, should be Outbound), Dependencies table CP direction wrong (Inbound→Outbound), Dependencies table RSM direction wrong (Inbound→Outbound). 1 RECOMMENDED: tier gap AC claim doesn't hold for T3→T4. All 6 issues corrected in place.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found formula example errors and direction convention inconsistencies.
- Brake Power examples corrected (stat 4: 70m, stat 8: 60m).
- Grip Level example corrected (stat 4: 136 km/h).
- Interactions table direction corrected for VP/Fuel/Tire/AI (Inbound→Outbound).
- Dependencies table CP direction corrected (Inbound→Outbound).
- Dependencies table RSM direction corrected (Inbound→Outbound).
- Tier gap AC adjusted to "2–4 points" with T3→T4 note.
- Status remains Revised — Pending Re-review.
