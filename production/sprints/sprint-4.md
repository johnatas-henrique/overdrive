# Sprint 4 -- 2026-08-17 to 2026-08-23

## Sprint Goal

Deliver Phases 1-2 of the Core layer with two parallel orchestrator sessions (S1 simulation, S2 data): Vehicle Physics Dynamics + Feel (S1) and Track + Car Definition + Race Strategy (S2). This is the racing core — car + track — and establishes the cross-phase bridges: telemetry contracts (S1 → F3 presentation) and Track/Car data assets (S2 → F4 AI/menu).

## Capacity

- Total: 7 days @ 8h/day × 2 sessions = 112h
- Buffer (20%): 22h
- Available: 90h
- Planned utilization: ~53h active (59%) — headroom for gates, reviews, and per-phase merges. Per session: S1 ~21h effective (46% of its 45h liquid), S2 ~32.5h (73% of its 45h liquid) — S2 is the bottleneck and still has comfortable slack.

## Tasks

### Must Have (Critical Path) — 27 stories

| ID | Task | Owner | Est. (h) | Dependencies | Acceptance Criteria |
|----|------|-------|----------|--------------|---------------------|
| 4-1 | vp-dynamics 001 Grip Stack & CarState Contract | S1 | 2.0 | — | ACs story-001 (grip stack, CarState contract) |
| 4-2 | vp-dynamics 002 Vehicle Driver Seam | S1 | 1.5 | 4-1 | ACs story-002 |
| 4-3 | vp-dynamics 003 Longitudinal & Step 6 Integration | S1 | 1.5 | 4-2 | ACs story-003 (deterministic Step 6) |
| 4-4 | vp-dynamics 004 Steering Model | S1 | 1.5 | 4-3 | ACs story-004 |
| 4-5 | vp-dynamics 005 Wall Contact & Car-to-Car | S1 | 2.0 | 4-4 | ACs story-005 |
| 4-6 | vp-feel 001 Lift-off Rotation & Tuck-in | S1 | 1.0 | 4-5 | ACs story-001 |
| 4-7 | vp-feel 002 Drift Factor | S1 | 1.5 | 4-6 | ACs story-002 |
| 4-8 | vp-feel 003 Real Engine Longitudinal | S1 | 1.0 | 4-7 | ACs story-003 |
| 4-9 | vp-feel 004 Telemetry Contracts (bridge → F3) | S1 | 2.0 | 4-8 | ACs story-004 (telemetry seams) |
| 4-10 | vp-feel 005 Dev Playtest Rig | S1 | 2.0 | 4-9 + **Gate F1** | ACs story-005 (rig runs on merged F1) |
| 4-11 | track 001 JSON Schema & Addressable Loading | S2 | 1.5 | — | ACs story-001 |
| 4-12 | track 002 Spline Materialization | S2 | 1.5 | 4-11 | ACs story-002 |
| 4-13 | track 003 Pit Geometry & Progress | S2 | 1.5 | 4-12 | ACs story-003 |
| 4-14 | track 004 Lap Boundary | S2 | 1.0 | 4-12 | ACs story-004 |
| 4-15 | track 005 Grid Slots | S2 | 1.0 | 4-12 | ACs story-005 |
| 4-16 | track 006 Trackside Manifest & Validation | S2 | 1.5 | 4-11 | ACs story-006 |
| 4-17 | track 008 Runtime Trackside Assembly | S2 | 1.5 | 4-12, 4-16 | ACs story-008 |
| 4-18 | track 007 Authoring Tool (last in S2, checkpoint Day-4, non-blocking) | S2 | 2.0 | 4-16 | ACs story-007 |
| 4-19 | car-def 001 Model & Stat Formulas | S2 | 1.5 | registry/entities.yaml | ACs story-001 |
| 4-20 | car-def 002 Load-time Validation | S2 | 1.5 | 4-19 | ACs story-002 |
| 4-21 | car-def 003 Editor Differentiation Validator | S2 | 1.5 | 4-20 | ACs story-003 |
| 4-22 | car-def 004 Asset Authoring & Addressables | S2 | 2.0 | 4-21, 4-11 | ACs story-004 |
| 4-23 | race-strategy 001 Fuel System | S2 | 2.0 | 4-19 | ACs story-001 |
| 4-24 | race-strategy 002 Tire System | S2 | 2.0 | 4-19 | ACs story-002 |
| 4-25 | race-strategy 003 Pit Service Lifecycle & Command | S2 | 1.5 | 4-23, 4-24 | ACs story-003 |
| 4-26 | race-strategy 004 Pit Multi-Car & Mode Policy | S2 | 1.0 | 4-25 | ACs story-004 |
| 4-27 | race-strategy 005 Pit Advisory & Lifecycle | S2 | 1.5 | 4-26 | ACs story-005 |

> **Execution model (two sessions, per `docs/plans/sprint4-mvp-flow-2026-08-16.html`):** S1 (simulation) and S2 (data) run in PARALLEL, each in its own worktree/branch (`chore/s4-f1-s1` / `chore/s4-f1-s2`, then `chore/s4-f2-s*`), merging to main at each phase boundary. F1 and F2 are dependency-free across sessions except the Gate F1 below. Story files live in `production/epics/` per epic.

> **Gate F1 (PR-SPRINT 2026-08-16, mandatory before 4-10):** before S1 starts vp-feel 005 (playtest rig), main must contain: (a) Step-6 deterministic evidence (≤0.001 replay tolerance — the assembly gate), and (b) the merged Track/Car fixtures (S2 F1). The rig depends on both.

> **Contingency (per PR-SPRINT producer, 2026-08-16):** Track-007 (authoring tool, editor-only) is the only isolated-risk story — it does NOT block track-008 (runtime assembly) or anything else. Checkpoint at Day-4: if not landing cleanly, defer to Sprint 5 (it is only needed when authoring the 4 real tracks, not for the playtest rig). Never defer the spline/materialization path (4-11..4-17) or vp-dynamics (4-1..4-5).

### Should Have

| ID | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------------|-----------|-------------|---------------------|
| (none) | | | | | |

### Nice to Have

| ID | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------------|-----------|-------------|---------------------|
| (none) | | | | | |

## Carryover from Previous Sprint

| Task | Reason | New Estimate |
|------|--------|-------------|
| (none — Sprint 3 closed 14/14 on 2026-08-15) | | |

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Vehicle Physics Dynamics is kernel-touching (Step 6) — determinism boundary (≤0.001) is an assembly gate; F1 S1 overrun would stall vp-feel (depends on it) | Medium | High | unity-specialist consult per story; Gate F1 before 4-10; S1 has 46% utilization (21h effective vs 45h liquid) — real headroom |
| S2 is the session bottleneck (32.5h effective vs 45h liquid = 73%) | Medium | Medium | 27% slack absorbs review/merge overhead; track-007 is the flex story (deferable to Sprint 5) |
| Track-007 (editor authoring tool) — Addressables editor APIs (3.1.0 deltas) | Medium | Medium | isolated, last in S2, checkpoint Day-4; does not block track-008; defer path to Sprint 5 |
| MCP TestRunner instability (recurrent across 3 sprints) | Medium | Medium | TestResults.xml direct-read recovery pattern (#270) |
| Merge conflicts at phase boundaries (2 worktrees → main) | Low | Medium | per-phase merges while diff is small; both branches merge before F2 starts |
| Art workstream runs in parallel (AI pipeline) | Low | Low | asset swap rule #411-a — no story depends on art; placeholders via Addressables |
| Cross-epic deferred runtime measurements (memory budgets MB1/2/6/7, load ceilings) | — | — | TD-022..TD-026 (profiling gate — requires representative Core content; post-Core) |

> Full register: `production/risk-register/README.md`

## Dependencies on External Factors

- None (MVP offline, no online-services provider selected).
- Data authoring sources (2026-08-16 decision): TrackData authored by MEASURING reference circuits (F1 1988 pack / Spa CC-BY) — reference-only, never redistributed as game assets; CarDefinition stats from `design/registry/entities.yaml`.
- Prerequisite: Content Pipeline (Sprint 3) Addressables seams + Shared group topology + fixtures (`Assets/tests/content/Fixtures/` — teamA/B/C CarDefinition.asset, monaco TrackData.asset).

## Definition of Done for this Sprint

- [ ] All Must Have tasks completed (27/27)
- [ ] All tasks pass acceptance criteria
- [ ] QA plan exists (`production/qa/qa-plan-sprint-4-2026-08-16.md`)
- [ ] All Logic/Integration stories have passing unit/integration tests
- [ ] Smoke check passed (`/smoke-check sprint`)
- [ ] QA sign-off report: APPROVED or APPROVED WITH CONDITIONS (`/team-qa sprint`)
- [ ] No S1 or S2 bugs in delivered features
- [ ] Design documents updated for any deviations
- [ ] Code reviewed and merged (per-phase merges to main)

> **Scope check:** If this sprint includes stories added beyond the original epic scope, run `/scope-check [epic]` to detect scope creep before implementation begins.
