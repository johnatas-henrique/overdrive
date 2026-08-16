# Risk Register

> Created by `/sprint-plan` (Sprint 2, 2026-08-10) per PR-SPRINT producer recommendation #4.
> Format mirrors the Milestone Risk Register (production/milestones/mvp.md).

## Active Risks

| Risk | Probability | Impact | Mitigation | Owner | Status |
|------|------------|--------|-----------|-------|--------|
| Simulation Kernel is the first Foundation integration boundary — contract alignment, test harness setup, and integration debugging can consume time disproportionately vs the Input System's isolated velocity | Medium | High | unity-specialist on HIGH-risk stories (2-1, 2-3, 2-5); embedded qa-lead test specs (85) define acceptance up front; mock-based integration evidence until Core epics exist | lead-programmer | Open |
| Stories 2-3 (Session Start, 16 ACs) and 2-5 (Session End, 17 ACs) are risk-weighted beyond estimates — multiple lifecycle transitions and external seams | Medium | High | Checkpoint immediately after 2-4; if actual effort materially exceeds estimate, protect the session lifecycle first (defer 2-8 with explicit Sprint 3 carryover); split point documented at AC-4.8a if /story-readiness finds 2-5 too dense | producer | Open |
| Unity 6.3 API deltas (Physics.simulationMode, Physics.Simulate, Rigidbody.interpolation, Time.unscaledDeltaTime) | Medium | High | unity-specialist consultation; accumulated Sprint 1 knowledge (Input System 1.19.0 gotchas) | unity-specialist | Open |
| Determinism verification (PCG32 golden sequence, Unity.Mathematics scan) | Low | Medium | Golden vectors pre-computed and verified against pcg-random.org (session 2026-08-10); static source scan automatable | gameplay-programmer | Open |
| Cross-epic DECLARED items (2-8 DifficultyProfile schema, AC-5.1/5.5 determinism gates) deferred to MVP-assembly gate | Low | Low | Declared in story 008; stub-based tests; Settings epic must deliver DifficultyProfile schema before Kernel closure (EPIC.md:26) | producer | Open |
| 2-5 acceptance could drift toward "implement RSM/Content/UI" instead of "integrate with fakes" | Medium | Medium | Acceptance explicitly scoped to contract integration with mocks/fakes; Core epics own real implementations (Integration Contract EPIC.md:18-24) | lead-programmer | Open |

## Resolved / Closed

| Risk | Resolution | Date |
|------|-----------|------|
| (none yet) | | |
