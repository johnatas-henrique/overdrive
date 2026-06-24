# Sprint 1 — Foundation Layer

> **Period**: 2026-06-24 to 2026-07-29 (5 weeks)
> **Mode**: new
> **Review Mode**: full

## Sprint Goal

Implement the complete Foundation layer (6 epics, 29 stories) — all shared infrastructure that every other system depends on: config, events, state machine, determinism, persistence, and snapshot.

## Capacity

| Metric            | Value            |
| ----------------- | ---------------- |
| Total days        | 25 (5 weeks × 5) |
| Hours/day         | 8                |
| Gross capacity    | 200h             |
| Buffer (20%)      | 40h              |
| **Available**         | **160h**             |
| Foundation total  | 142h             |
| **Margin**            | **+18h (11%)**       |

## Tasks

### Must Have (Critical Path — order by dependency)

| ID  | Epic                  | Story                                                | Est.  | Depends On |
| --- | --------------------- | ---------------------------------------------------- | ----- | ---------- |
| 1   | Data & Config Manager | Story 001: Core Register + Get + Error Handling      | 6h    | —          |
| 2   | Data & Config Manager | Story 002: Environment Variable Override             | 4h    | #1         |
| 3   | Data & Config Manager | Story 003a: HMR Cache Handler (invalidateNamespace)  | 4h    | #1         |
| 4   | Data & Config Manager | Story 003b: HMR Vite Wiring                          | 2h    | #3         |
| 5   | Data & Config Manager | Story 004: Access Logging + Debug State              | 4h    | #1         |
| 6   | Event Bus             | Story 001: Event Types and Contracts                 | 3h    | —          |
| 7   | Event Bus             | Story 002: Core Event Bus                            | 8h    | #6         |
| 8   | Event Bus             | Story 003: Edge Cases                                | 6h    | #7         |
| 9   | Game State Machine    | Story 001: Core FSM — Transition Table               | 6h    | #7         |
| 10  | Game State Machine    | Story 002: Async Lifecycle Hooks                     | 8h    | #9         |
| 11  | Game State Machine    | Story 003: Event Bus Integration                     | 6h    | #10        |
| 12  | Game State Machine    | Story 004: Transition Throttling                     | 5h    | #10        |
| 13  | Game State Machine    | Story 005: State History Ring Buffer                 | 4h    | #10        |
| 14  | Game State Machine    | Story 006: Dispose Safety                            | 4h    | #10        |
| 15  | Determinism Contract  | Story 001: SeededRandom                              | 4h    | —          |
| 16  | Determinism Contract  | Story 002: FixedUpdatePipeline                       | 8h    | #15        |
| 17  | Determinism Contract  | Story 003: InputBuffer                               | 4h    | #16        |
| 18  | Determinism Contract  | Story 004: Fixed Timestep Accumulator                | 6h    | #16        |
| 19  | Determinism Contract  | Story 005: Pipeline Engine Integration               | 6h    | #16        |
| 20  | Determinism Contract  | Story 006: Determinism Enforcement (Dev Assertions)  | 4h    | #15–#19    |
| 21  | Persistence           | Story 001: Persistence State Machine + Init          | 3h    | #20        |
| 22  | Persistence           | Story 002: save/load Round-trip + Key Prefix         | 5h    | #21        |
| 23  | Persistence           | Story 003: Error Isolation                           | 2h    | #22        |
| 24  | Persistence           | Story 004: Degraded Mode + retry()                   | 4h    | #22        |
| 25  | Persistence           | Story 005: Migration Chain                           | 3h    | #22        |
| 26  | Simulation Snapshot   | Story 001: ISnapshotable Interface + FNV-1a Hashing  | 4h    | #20        |
| 27  | Simulation Snapshot   | Story 002: Orchestrator Core Lifecycle               | 8h    | #26        |
| 28  | Simulation Snapshot   | Story 003: SHA-256 Sync Hash + Snapshot Determinism  | 6h    | #27        |
| 29  | Simulation Snapshot   | Story 004: Error Isolation + Registration Edge Cases | 5h    | #27        |

### Should Have

(Empty — Sprint 1 has no Should-Have tier. All 29 stories are critical path for Foundation completion. If velocity exceeds plan, promote from Sprint 2 backlog. If velocity falls short, defer to Sprint 2.)

### Nice to Have (none)

## Carryover from Previous Sprint

N/A — first sprint.

## Risks

| Risk                                          | Probability | Impact | Mitigation                                                     |
| --------------------------------------------- | ----------- | ------ | -------------------------------------------------------------- |
| Foundation underestimation (first time)       | Medium      | High   | 11% margin + IA acceleration; defer non-critical if needed     |
| ConfigManager HMR depends on Vite API details | Low         | Medium | Story 003b is only 2h; spike early to validate                 |
| Havok import side-effect (tree-shaking)       | Low         | High   | Known pattern from memory — already handled in scaffolding     |
| Solo dev overcommit / context switching       | Medium      | Medium | 5-week sprint with 20% buffer for unplanned work               |

## Capacity

**Hours per day**: 8h gross (includes context switching, code review, and unplanned interruptions).
**Net focused work budget**: ≈ 6h/day.
**Total gross**: 25 days × 8h = 200h
**Buffer**: 40h (20%)
**Available net**: 160h
**Estimated total**: 142h
**Margin**: 18h (11%)

## Creative Success Criteria (Core A Gate)

These criteria define when the creative hypothesis is validated. They are checked at the end of Core A (the first playable build with Input + Camera + Physics + Track):

1. **Genre recognition**: A non-developer identifies this as an arcade racing game within 30 seconds of play.
2. **Sense of speed**: At 200+ km/h the player perceives speed through camera behaviour (FOV, distance, movement), not just the speed number.
3. **Responsive handling**: The car responds to steering/throttle/brake input without noticeable delay or float — the connection between input and chassis motion feels direct.
4. **Track readability**: The player can distinguish between track surface, runoff, and barrier at racing speed without studying the HUD.
5. **Rival identity (Core B)**: After one race, the player can name at least one trait of their main rival ("Ribello brakes late").

> These are pass/fail criteria documented in the Core A milestone review. If any fails, the corresponding knob is adjusted and the build is re-tested before advancing to Core B.

## Branch Strategy

- **Sprint branch**: `feat/sprint-01-foundation`
- **Cut from**: `feat/technical-setup` (current) → `feat/sprint-01-foundation` at sprint start
- **Merge target**: `main`
- **Merge trigger**: End of sprint — after QA sign-off, code review, and smoke check pass
- **Commits during sprint**: Direct to sprint branch. Use conventional commits (`feat:`, `fix:`, `test:`, `docs:`).
- **Pre-commit**: Husky runs Biome lint + typecheck (4 passing tests baseline)

## Dependencies on External Factors

- Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12 — already installed
- Node 24 + Vite 8 + Biome — already configured
- Vitest — already configured with 4 passing tests

## Definition of Done for this Sprint

- [ ] All 29 stories completed
- [ ] Nenhum arquivo-fonte principal de sistema Foundation excede 500 linhas (excluindo imports em branco) — verificado com `wc -l`
- [ ] Code coverage ≥ 80% on Foundation layer stories
- [ ] If a story deviates from its governing ADR during implementation, the ADR is updated before the story is marked Complete
- [ ] All Logic stories have passing unit tests (Vitest)
- [ ] All Integration stories have passing integration tests (Vitest)
- [ ] Smoke check passed (`/smoke-check sprint`)
- [ ] E2E test: Foundation systems initialise in correct order without errors
- [ ] QA sign-off report: APPROVED or APPROVED WITH CONDITIONS (`/team-qa sprint`)
- [ ] No S1 or S2 bugs in delivered Foundation systems
- [ ] Story files updated to status=Complete
- [ ] Design documents updated for any deviations
- [ ] Code reviewed and merged to `main`
