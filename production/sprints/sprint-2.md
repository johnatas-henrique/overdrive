# Sprint 2 -- 2026-08-10 to 2026-08-19

## Sprint Goal

Deliver the complete Simulation Kernel: the 14-step tick pipeline skeleton with published seams, the manual 60 Hz accumulator driver, the SimulationState lifecycle (session start, interruption, session end), render interpolation, performance protection, and determinism + MVP recordable buffer — the foundation that unlocks all Core epics. Second sprint of the MVP milestone.

## Capacity

- Total: 10 days @ 8h/day = 80h
- Buffer (20%): 16h
- Available: 64h

## Tasks

### Must Have (Critical Path)

| ID | Task | Agent/Owner | Est. (h) | Dependencies | Acceptance Criteria |
|----|------|-------------|----------|-------------|---------------------|
| 2-1 | Contract Spine — 14-step pipeline skeleton, seams & snapshot schemas | engine-programmer + unity-specialist | 6-8 | Input (done) | 10 ACs (story-001) |
| 2-2 | Simulation Driver & Tick Clock | engine-programmer | 4-6 | 2-1 | 12 ACs (story-002) |
| 2-3 | Session Start — content lifecycle, countdown & GO | engine-programmer + unity-specialist | 6-8 | 2-1, 2-2 | 16 ACs (story-003) |
| 2-4 | Interruption — pause, resume & focus-loss | engine-programmer | 4-6 | 2-1, 2-2, 2-3 | 8 ACs (story-004) |
| 2-5 | Session End — finish, results, forfeit & unload | engine-programmer + unity-specialist | 8-10 | 2-1, 2-3, 2-4 | 17 ACs (story-005) |
| 2-6 | Presentation — render interpolation | engine-programmer | 2-4 | 2-1, 2-2 | 6 ACs (story-006) |
| 2-7 | Performance Monitor | engine-programmer | 4-6 | 2-3, 2-4, 2-5 | 9 ACs (story-007) |
| 2-8 | Determinism & MVP Recordable Buffer *(last; defer with explicit carryover only)* | engine-programmer | 4-6 | 2-2, 2-3, 2-4, 2-5 | 7 ACs (story-008) |

> **Contingency (per PR-SPRINT producer, 2026-08-10):** all 8 stories are committed — this IS the full Simulation Kernel epic (85/85 MVP ACs). Execution order: critical path **2-1 → 2-2 → 2-3 → 2-4 → 2-5**; 2-6 after 2-2; then 2-7; then **2-8 last** (parallelizable after its deps). **Checkpoint immediately after 2-4**: if actual effort is materially above estimate, protect the session lifecycle first and defer 2-8 to Sprint 3 with an explicit carryover + epic-completion change — never a silent cut (2-8 contains Must-Have MVP architecture: PCG32, Unity.Mathematics enforcement, recordable-buffer lifecycle, ReplayInitialState).

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
| (none — Sprint 1 closed 8/8 on 2026-08-09) | | |

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Kernel is the first Foundation integration boundary — contract/harness/debug time may exceed Input's isolated velocity | Medium | High | unity-specialist on 2-1/2-3/2-5; 85 embedded qa-lead test specs define acceptance up front |
| 2-3 (16 ACs) / 2-5 (17 ACs) risk-weighted beyond estimates | Medium | High | checkpoint after 2-4; defer 2-8 with explicit carryover only; split 2-5 at AC-4.8a if /story-readiness finds it dense |
| Unity 6.3 API deltas (Physics.Simulate, SimulationMode, interpolation) | Medium | High | unity-specialist; Sprint 1 Input System knowledge |
| Determinism verification (PCG32, Unity.Mathematics scan) | Low | Medium | golden vectors pre-computed + verified (pcg-random.org); scan automated |
| Cross-epic DECLARED (2-8 DifficultyProfile, AC-5.1/5.5) | Low | Low | deferred to MVP-assembly gate; stub tests; Settings epic delivers schema before Kernel closure |
| 2-5 drift toward "implement RSM/Content/UI" | Medium | Medium | acceptance scoped to contract integration with fakes; Core epics own real implementations |

> Full register: `production/risk-register/README.md` (created 2026-08-10 per PR-SPRINT recommendation #4).

## Dependencies on External Factors

- None (MVP offline, no online-services provider selected).
- Cross-epic DECLARED items deferred by design: DifficultyProfile schema (Settings epic, EPIC.md:26), determinism gates AC-5.1/5.5 (MVP-assembly gate, TR-sim-005 precedent).

## Definition of Done for this Sprint

- [ ] All Must Have tasks completed (or 2-8 explicitly carried to Sprint 3 with epic-completion change)
- [ ] All tasks pass acceptance criteria
- [ ] QA plan exists (`production/qa/qa-plan-sprint-2.md`)
- [ ] All Logic/Integration stories have passing unit/integration tests
- [ ] Smoke check passed (`/smoke-check sprint`)
- [ ] QA sign-off report: APPROVED or APPROVED WITH CONDITIONS (`/team-qa sprint`)
- [ ] No S1 or S2 bugs in delivered features
- [ ] Design documents updated for any deviations
- [ ] Code reviewed and merged

> **Scope check:** If this sprint includes stories added beyond the original epic scope, run `/scope-check [epic]` to detect scope creep before implementation begins.
