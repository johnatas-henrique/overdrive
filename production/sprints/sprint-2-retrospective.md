# Sprint 2 Retrospective — Simulation Kernel

**Period**: 2026-08-10 → 2026-08-12 (plan: 08-10 → 08-19; closed in ~2 working days)
**Generated**: 2026-08-12
**Verdict**: 100% complete, 418/418 green, 0 bugs at sign-off, process converged from Sprint 1

## Metrics

| Metric | Planned | Actual | Delta |
|--------|---------|--------|-------|
| Tasks | 8 | 8 | 0 |
| Completion Rate | — | 100% | — |
| Effort (h, active) | 38-54 | ~11-15 | −23 to −43 |
| Bugs Found (review) | — | ~12 (i==7 hardcode, accumulator, NoInputDevice zeroing, _unloadRequested stale, terminal leak, Discard re-arm, capture re-arm, etc.) | — |
| Bugs at QA sign-off | — | 0 | — |
| Unplanned Tasks Added | — | 0 | — |
| Commits | — | ~38 (kernel) | — |

## Velocity Trend

| Sprint | Planned | Completed | Rate |
|--------|---------|-----------|------|
| Sprint 1 (Input) | 44-66h | ~16h | ~27% |
| Sprint 2 (Kernel) | 38-54h | ~11-15h | ~28% |

**Trend**: Stable — real velocity is consistently ~25-30% of the estimate model. The 4-10h/story model overestimates the AI process ~3.5×.

## What Went Well

- **100% completion with 0 carryover** — including 2-8 (the post-2-4 checkpoint contingency never fired; sprint closed 2 days after start vs 10 planned).
- **Quality**: 418/418 green (161 Input + 257 Kernel), 0 bugs at sign-off, 19 TDs registered proactively (TD-011..019 new, all with defined destinations).
- **A/B delegation test validated**: `Agent` (pi-subagents with MCP) delivered 12/12 ACs with tests vs `Task` (5/10 without tests on story-001) — infrastructure decision confirmed empirically.
- **Gates caught real defects**: i==7 hardcode (002), NoInputDevice zeroing (001), _unloadRequested stale (005), terminal state leak (005), Discard overflow re-arm (008), capture re-arm between races (008) — no gate was theater.
- **Cross-epic verifiability hardening** applied and validated (story-003 was the real case; no cross-epic AC escaped in stories 004-008).
- **Persistent review process worked**: same unity-specialist + qa-tester across multi-round sessions, converging in 3-5 rounds per story.

## What Went Poorly

- **First-pass test bugs in 003/004/008** — wrote asserts without re-reading code (AC-4.1d tautology, invented `SimulateElapsedTime` method, wrong accumulator expectations). Recurring "write-before-verify" pattern.
- **MCP TestRunner instability on story-008** (timeouts, orphan runs, lost responses) — cost ~30-40min of waiting; required reading TestResults.xml as source of truth.
- **sub-agent resume still broken** — 3× lost (agent_id not exposed in result); fallback = re-spawn with verification prompt (~100-200K tokens).

## Blockers Encountered

| Blocker | Duration | Resolution | Prevention |
|---------|----------|------------|------------|
| MCP TestRunner timeouts/orphan runs (008) | ~40min | Read TestResults.xml directly | Retry with backoff; verify editor idle before re-firing |
| pi-subagent resume (agent_id) | ~10min × 3 | Re-spawn with verification prompt | Capture agent_id at spawn; resume <10min (#172/#246) |
| Codex overload (2nd spawn 002) | ~2min | Abort and re-spawn | Transparent retry |

## Estimation Accuracy

| Task | Estimated | Actual (active) | Variance | Likely Cause |
|------|-----------|-----------------|----------|--------------|
| Story-001 (6-8h) | 7h | ~4-6h | −2h | First of sprint, A/B test, infra |
| Story-005 (8-10h) | 9h | ~1h | −8h | Mature process, 17 ACs with 46 tests in one pass |
| Story-008 (4-6h) | 5h | ~1.8h | −3.2h | Mature process; MCP instability inflated wallclock |

**Overall estimation accuracy**: ~0% within ±20% — all delivered well below estimate. The producer's estimation model assumes human velocity; the AI process runs ~3.5× faster. **Adjustment: re-base estimates with ~0.3× factor or use the "mature story = 1-2h active" ruler.**

## Carryover Analysis

None — 8/8 complete, 0 carryover.

## Technical Debt Status

- TODO: 0 | FIXME: 0 | HACK: 0 (no trend — clean code)
- TD-011..019 registered (9 new) — all with defined destinations (Story 009 Pit Stop, Fuel/Tire/Pit/AI epics, assembly gate, /propagate-design-change)
- Trend: Stable/growing by registration, not by code — debt tracked proactively, not silently accumulated

## Previous Action Items Follow-Up (Sprint 1)

| Action Item | Status | Notes |
|-------------|--------|-------|
| Recalibrate Sprint 2 estimates (4h/story max) | **Partial** | Estimates still ~3.5× above real (38-54h vs ~11-15h) — re-base in Sprint 3 |
| Validate YAML/stale data at each story close | **Done** | No duplicates/stale data at sprint close |
| Register team_tierX_Y in new design files | **Done** | Convention applied |

## Action Items for Next Iteration

| # | Action | Owner | Priority | Deadline |
|---|--------|-------|----------|----------|
| 1 | Re-base estimates: ~0.3× factor or "mature story = 1-2h active" ruler in /sprint-plan for Sprint 3 | Producer | High | Sprint 3 plan |
| 2 | Read code BEFORE writing asserts (break the "write-before-verify" pattern that produced 5+ wrong asserts) | Orchestrator | High | Continuous |
| 3 | MCP TestRunner retry pipeline (backoff + idle verification before re-fire; read TestResults.xml on timeout) | Orchestrator | Med | Continuous |
| 4 | Start the assembly gate (4 deferred items: frame budget, AC-1.4, AC-5.3, AC-7.6) when a playable build exists | Producer | Med | When MVP build |

## Process Improvements

- **GDD/ADR validation before writing asserts**: the "implement first, validate later" pattern caused 2 cycles of discarded work (003) — the test suite is the final verifier, not the primary one.
- **Memorize the MCP TestRunner pattern**: timeouts complete in Unity but the response expires — use TestResults.xml as source of truth (documented, apply to all runs).
- **Data-driven estimates**: feed /sprint-plan with real velocity (Sprint 1 16h, Sprint 2 11-15h) instead of the human model.

## Summary

Strong sprint: 100% complete, 418/418 green, 0 bugs, 2 days for 10 planned, all 4 gates per story caught real defects. The story-001 investments (A/B test, assembly boundary fix) and cross-epic hardening paid dividends across all subsequent stories. Most important changes going forward: **re-base estimates on the real factor (~3.5× faster than the model)** and **break the write-asserts-before-reading-code pattern** — the two systemic errors that cost time.
