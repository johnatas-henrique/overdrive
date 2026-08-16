# Sprint 1 Retrospective — Input System

**Period**: 2026-08-08 → 2026-08-09 (closed in 2 working days; plan was 08-17)
**Generated**: 2026-08-09
**Verdict**: 100% complete, quality strong, process converged during the sprint

## Metrics

| Metric | Planned | Actual | Delta |
|--------|---------|--------|-------|
| Tasks | 8 | 8 | 0 |
| Completion Rate | — | 100% | — |
| Effort Days (8h) | 5.5-8.25 (44-66h) | ~2.0 (~16h) | −3.5 to −6.25 |
| Bugs Found (review) | — | ~7 (startButton binding, leak, AC-47 false-pos, _pendingPauseEdge, etc.) | — |
| Bugs at QA sign-off | — | 0 | — |
| Unplanned Tasks Added | — | 0 | — |
| Commits | — | ~40 (input) | — |

## Velocity Trend

No baseline (first sprint). **Establishes baseline**: 8 stories / ~2 working days. Trend: N/A.

## What Went Well

- **100% completion** — 8/8 stories, 0 carryover, 0 unplanned.
- **Quality**: 156 tests, QA APPROVED, 0 bugs at sign-off; 10 tech-debts tracked (TD-001..010) instead of silent debt.
- **Process converged during the sprint**: wallclock/story dropped from ~4h22m (story-001) to ~1h35m (story-007) — persistent reviewers + A1 pre-verification + embedded test specs.
- **Process correction at close**: Pre-Production→Production gate run through the process (not manual edit), stale data corrected, team_tierX_Y naming convention established.

## What Went Poorly

- **Estimates too conservative**: 44-66h estimated vs ~16h actual — 3× off. The AI process implements faster than the estimation model assumed.
- **Stale data accumulated** at close (sprint-status duplicated `completed`; asset-manifest tier shifts; epics index Input "uncreated") — caught only at closure verification, not continuously.
- **Manual-verification dependency**: sprint-status.yaml had duplicate fields that would break `/sprint-status` — only caught by re-validating the YAML.

## Blockers Encountered

| Blocker | Duration | Resolution | Prevention |
|---------|----------|------------|------------|
| Unity assert loop (IvanMurzak NuGet restore) | ~20-30min | Editor restart | Avoid first-run NuGet in editor (#1852) |
| Engine-programmer loop story-001 (CS0246) | ~1h | Redirected to unity-specialist | 2-failure loop-break (#1833) |
| AC-47 false-positive | ~40min | UGUI navigation diagnosis (mode Explicit) | Navigation tests must set mode (#1900) |

## Estimation Accuracy

| Task | Estimated | Actual | Variance | Likely Cause |
|------|-----------|--------|----------|--------------|
| Story-001 (6-8h) | 7h | ~4h22m | −2.7h | First story, learning curve |
| Story-007 (8-12h) | 10h | ~1h35m | −8.4h | Mature process + embedded specs |

**Overall**: ~0% of tasks within ±20% — all delivered well below estimate. Adjustment: recalibrate Sprint 2 estimates using real velocity (8 stories/2 days ≈ 1-2h/story post-maturity).

## Carryover Analysis

None — 0 carryover.

## Technical Debt Status

- TODO count: 0 real | FIXME: 0 | HACK: 0
- Trend: N/A (first sprint)
- Debt registered proactively as TD-001..010 (tracked, with per-epic destinations)

## Previous Action Items

N/A — first retrospective.

## Action Items for Next Iteration

| # | Action | Owner | Priority | Deadline |
|---|--------|-------|----------|----------|
| 1 | Recalibrate Sprint 2 estimates with real baseline (4h/story max for stories previously estimated at 8h; re-evaluate per story) | Producer | High | Sprint 2 plan |
| 2 | Validate YAML/stale data at each story close (not only at sprint close) | orchestrator | Med | Continuously |
| 3 | Register team_tierX_Y naming convention in new design files | orchestrator | Med | Continuously |

## Process Improvements

- **Recalibrate estimation**: sprint-1 overestimated 3× — use real velocity in `/sprint-plan` for Sprint 2 (avoid unnecessary buffer).
- **Skill evolution**: process adjustments (primary-agent implementer, mandatory estimates) should be folded into the skills themselves rather than accumulated as session memories — see sprint-1 close discussion 2026-08-09.

## Post-Sprint: Input Architecture Refactor (2026-08-10)

Between Sprint 1 and Sprint 2, ran `/improve-codebase-architecture` on the input system. 6 candidates surfaced; executed 5 (C6 observation-seam deferred to the Simulation Kernel epic).

**Executed:**
- **C1 InputFrameDriver** — new module owning resolve → capture → tick → Pause-consumption per render frame (ADR-0001:41 ordering structural instead of documented). 4 tests; the AC-59/AC-60 mock drivers replaced by the seam.
- **C2 Single tuning owner** — `TickProcessor` accepts `ControlProfile?`; arbitration reads the profile; `ControlProfile.Sanitize` now always overwrites `TriggerInner` from Input-owned tuning (ADR-0004:138).
- **C3 Pause-edge single channel** — redundant `PauseRise` removed; 6 cleanup sites consolidated in `ConsumePendingPauseEdgeOnTransition`.
- **C4 Re-seed base** — `EmaReinitializerBase` (idempotent lifecycle) + 2 policies (SchemeChange, ContextResume) preserving both ADR-0005 triggers.
- **C5 Preview** — the report's re-seed contradicted GDD settings AC-C11 (prev=0 → alpha×raw); reverted, AC-11 rewritten to assert AC-C11 + AC-50 + the intentional preview-vs-resumed-tick divergence.

**Result:** 155 → 161 PlayMode + 1 EditMode, 0 regressions, console clean.

**Cost:** C5 consumed ~2 cycles of discarded work — the re-seed was implemented before being validated against the GDD.

**Lessons (carried forward):** architectural analysis (report, grilling, sub-agent proposals) is not authoritative — candidates that touch specified behavior must be validated against the GDD/ADR before implementing (added to `improve-codebase-architecture` Phase 3); the test suite is the final verifier, not the primary one.

## Summary

Strong sprint: 100% complete, high quality, process converged and closure corrected process errors (gate, naming). The post-sprint input architecture refactor closed cleanly (155 → 161 tests, 0 regressions) and taught one durable lesson: validate refactor candidates against the GDD/ADR before implementing. Most important change going forward: **recalibrate estimation** — the 4-8h/story model is ~3× above the AI process's real velocity.
