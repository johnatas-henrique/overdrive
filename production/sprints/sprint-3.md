# Sprint 3 -- 2026-08-12 to 2026-08-19

## Sprint Goal

Deliver the three remaining Foundation epics (Settings, Content Pipeline, Multiplayer Architecture): settings persistence/migration, difficulty profiles, control bindings, display confirm and quality presets; the Content Pipeline state machine, race load/unload orchestration, startup/error handling, loading screen; and the multiplayer isolation boundary (INetworkSimulationDriver seam). This completes the Foundation layer and unlocks the Core epics (Vehicle Physics, Camera, HUD, Audio, Fuel, Tire, AI Rival, etc.).

## Capacity

- Total: 7 days @ 8h/day = 56h
- Buffer (20%): 11h
- Available: 45h

## Tasks

### Must Have (Critical Path)

| ID | Task | Agent/Owner | Est. (h) | Dependencies | Acceptance Criteria |
|----|------|-------------|----------|-------------|---------------------|
| 3-1 | Multiplayer Isolation Boundary — INetworkSimulatorDriver seam, assembly guardrails, isolation scan | engine-programmer + unity-specialist | 2-4 | Kernel (done) | 7 ACs (story-001) |
| 3-2 | Settings Persistence & Migration | engine-programmer | 3-4 | Kernel (done) | 7+ ACs (story-001) |
| 3-3 | SettingsEditSession & Lifecycle | engine-programmer | 4-5 | 3-2 | 5+ ACs (story-002) |
| 3-4 | DifficultyProfile & Race Snapshot | engine-programmer + unity-specialist | 5-6 | 3-3, Kernel (done) | 4+ ACs (story-003) |
| 3-5 | Control Bindings & Rebinding State Machine | engine-programmer | 4-5 | 3-2, Input (done) | 4+ ACs (story-004) |
| 3-6 | Display Confirm & Quality Presets | engine-programmer + unity-specialist | 5-6 | 3-2 | 8+ ACs (story-005) |
| 3-7 | Settings Values Contract | engine-programmer | 4-5 | 3-2, 3-3 | 5+ ACs (story-006) |
| 3-8 | Content Groups & Address Mirror | tools-programmer | 3-4 | Addressables (installed) | 7 ACs (story-001) |
| 3-9 | CP_ State Machine & Kernel Handshake | engine-programmer | 5-6 | 3-8, Kernel (done) | 12 ACs (story-002) |
| 3-10 | Race Load Orchestration | engine-programmer + unity-specialist | 6-8 | 3-9 | 12 ACs (story-003) |
| 3-11 | Race Unload | engine-programmer | 3-4 | 3-9, 3-10 | 7 ACs (story-004) |
| 3-12 | Startup, Catalog & Fatal Errors | engine-programmer | 4-5 | 3-9, 3-11 | 6 ACs (story-005) |
| 3-13 | Loading Screen | ui-programmer | 4-5 | 3-9, 3-10 | 11 ACs (story-006) |
| 3-14 | Quality Profiles (WebGL) | engine-programmer | 3-4 | 3-10, 3-6 | 4 ACs (story-007) |

> **Execution order (single developer — dependency order only):** Multiplayer 3-1 → Settings 3-2→3-7 (chain) → Content 3-8→3-14 (chain). The single cross-epic rule is **3-6 before 3-14** (Content Quality consumes Settings' IQualityProfileSource). No parallelization — the developer works alone, so story sequence is free beyond dependencies.

> **Contingency (per PR-SPRINT producer, 2026-08-12):** 3-10 (Race Load Orchestration) is the sprint's heaviest story (12 ACs, 17-bundle parallel orchestration). It is the **risk gate by Day 3-4**: if catalog loading or bundle ownership is not proven by then, defer the non-essential 3-12 fatal UX, 3-13, and 3-14 — never the core load/unload path (3-10/3-11). Runtime measurement targets (TD-022..TD-026) are already deferred to the profiling gate — they do not block this sprint.

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
| (none — Sprint 2 closed 8/8 on 2026-08-12) | | |

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| 3-10 (Race Load, 12 ACs, Integration) is the sprint's heaviest story — 17-bundle parallel orchestration, failure/cancellation paths, ownership/release semantics | Medium | High | unity-specialist consultation; 6 injectable Addressables seams (IAddressableLoader, IDownloadStatusSource, IContentInstantiator, IMemoryPressureSource, etc.) defined in the QL-STORY-READY gate; risk-gate checkpoint by Day 3-4 |
| Addressables 3.1.0 API deltas (post-training-cutoff) | Medium | High | IAddressableLoader seam isolates the API surface; unity-addressables-specialist consultation; seams validated at QL-STORY-READY |
| Settings 3-4/3-6 (L, cross-assembly: Simulation contract expansion + composition root + ScriptableObject profiles) | Medium | Medium | unity-specialist; DifficultyProfile stub already exists in Kernel story 2-8 (ReplayInitialState carries it); additive contract expansion pattern (established story-002) |
| New assemblies Overdrive.Settings + Overdrive.Content + 4 test asmdefs | Low | Medium | established pattern (Overdrive.Simulation/Input); test paths Assets/tests/unit/settings\|content/ per coding standards |
| 3-13 (UI Loading Screen) — no UI Menu epic exists yet | Medium | Low | ILoadingScreenPresenter port — Content delivers the lifecycle controller, UI Menu epic implements visual presentation (gate F10); tested against fake/headless presenter; does not claim a player-facing loading UI |
| Settings 3-6 DisplayConfirm rollback (fullscreen/refresh rate) + URP preset application | Medium | Medium | IDisplayApi seam (current/supported/preview/restore); IUnscaledClock for the 15s timer; IQualityPresetApplier for URP |
| Pre-existing (from Sprint 1/2): Unity 6.3 API deltas, MCP TestRunner instability | Low | Medium | accumulated knowledge; TestResults.xml direct-read recovery pattern (#270) |

> Full register: `production/risk-register/README.md`

## Dependencies on External Factors

- None (MVP offline, no online-services provider selected).
- Cross-epic DECLARED items deferred by design: runtime measurement targets (memory budgets MB1/2/6/7, load ceilings 5s PC/10s Web, WebGL constraints WG1-4/6, VFX budget) → TD-022..TD-026 (profiling gate, requires representative Core content).
- Prerequisite (3-8): Addressables package 3.1.0 installed and configured — verified at Packages/manifest.json:5.

## Definition of Done for this Sprint

- [ ] All Must Have tasks completed
- [ ] All tasks pass acceptance criteria
- [ ] QA plan exists (`production/qa/qa-plan-sprint-3-2026-08-12.md`)
- [ ] All Logic/Integration stories have passing unit/integration tests
- [ ] Smoke check passed (`/smoke-check sprint`)
- [ ] QA sign-off report: APPROVED or APPROVED WITH CONDITIONS (`/team-qa sprint`)
- [ ] No S1 or S2 bugs in delivered features
- [ ] Design documents updated for any deviations
- [ ] Code reviewed and merged

> **Scope check:** If this sprint includes stories added beyond the original epic scope, run `/scope-check [epic]` to detect scope creep before implementation begins.
