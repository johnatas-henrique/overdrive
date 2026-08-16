# Sprint 1 -- 2026-08-08 to 2026-08-17

## Sprint Goal

Deliver the complete Input System: the authoritative `SimulationInput` contract, capture/dead-zone/EMA/brake pipeline, context controller, scheme arbitration, context transitions, special routing, and settings configuration — the foundation that unlocks the Simulation Kernel. First sprint of the MVP milestone.

## Capacity

- Total: 10 days @ 8h/day = 80h
- Buffer (20%): 16h
- Available: 64h

## Tasks

### Must Have (Critical Path)

| ID | Task | Agent/Owner | Est. (h) | Dependencies | Acceptance Criteria |
|----|------|-------------|----------|-------------|---------------------|
| 1-1 | Input Action Asset & Context Controller | engine-programmer + unity-specialist | 6-8 | — | 8 ACs (story-001) |
| 1-2 | Raw Capture & Dead-Zone Normalization | engine-programmer + unity-specialist | 4-6 | 1-1 | 7 ACs (story-002) |
| 1-3 | EMA & Brake Priority | engine-programmer | 4-6 | 1-1 | 9 ACs (story-003) |
| 1-4 | SimulationInput Tick Processor | engine-programmer + unity-specialist | 4-6 | 1-2, 1-3 | 4 ACs (story-004) |
| 1-5 | Scheme Arbitration & No-Device | engine-programmer | 4-8 | 1-1, 1-4 | 9 ACs (story-005) |
| 1-6 | Context Handoff & Transitions | engine-programmer + unity-specialist | 8-12 | 1-4, 1-5 | 11 ACs (story-006) |
| 1-7 | Special Input Routing | engine-programmer + unity-specialist | 8-12 | 1-1, 1-6 | 10 ACs (story-007) |
| 1-8 | Settings Configuration *(first to cut)* | engine-programmer | 6-8 | 1-1, 1-2, 1-3 | 8 ACs (story-008) |

> **Contingency (per user decision, opção B):** all 8 stories are committed. `1-8 Settings Configuration` is the **first to cut** — if the critical path (1-6/1-7) runs long or capacity is exceeded, 1-8 defers to Sprint 2. Critical path tracked daily.

### Should Have

| ID | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------------|-----------|-------------|---------------------|
| (none — no other epic has stories yet) | | | | | |

### Nice to Have

| ID | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------------|-----------|-------------|---------------------|
| (none) | | | | | |

## Carryover from Previous Sprint

| Task | Reason | New Estimate |
|------|--------|-------------|
| (none — first sprint) | | |

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Engine: Input System 1.19.0 API deltas (actionMaps, UpdateMode, wrapper generation) | Medium | High | unity-specialist on HIGH-risk stories; accumulated knowledge (#1832/#1835/#1840/#1841) |
| Stories 1-6/1-7 are L (8-12h) on the sequential critical path | Medium | High | buffer covers; 1-8 is first-to-cut if they run long; daily critical-path tracking |
| Per-story flow cost (readiness → dev → review → done) | Medium | High | persistent reviewers, embedded test specs (66), wallclock tracking |
| Input pipeline cross-contamination / EventSystem settle-frame gotchas | Medium | Medium | known failure classes; regression tests guard transitions |

## Dependencies on External Factors

- None (MVP offline, no online-services provider selected).

## Definition of Done for this Sprint

- [ ] All Must Have tasks completed
- [ ] All tasks pass acceptance criteria
- [ ] QA plan exists (`production/qa/qa-plan-sprint-1.md`)
- [ ] All Logic/Integration stories have passing unit/integration tests
- [ ] Smoke check passed (`/smoke-check sprint`)
- [ ] QA sign-off report: APPROVED or APPROVED WITH CONDITIONS (`/team-qa sprint`)
- [ ] No S1 or S2 bugs in delivered features
- [ ] Design documents updated for any deviations
- [ ] Code reviewed and merged

> **Scope check:** If this sprint includes stories added beyond the original epic scope, run `/scope-check [epic]` to detect scope creep before implementation begins.
